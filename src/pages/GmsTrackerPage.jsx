import React, { useState, useEffect, useMemo, useCallback, useTransition, useRef } from 'react';
import {
  Card, Row, Col, Table, Button, DatePicker, Upload, Modal, Typography, Space, Input, Tag, Tooltip, message, Empty, Progress, Skeleton, Select, Segmented, Radio
} from 'antd';
import {
  UploadOutlined, SearchOutlined, InfoCircleOutlined, DownloadOutlined
} from '@ant-design/icons';
import Chart from 'react-apexcharts';
import { sellerApi, asinApi, gmsApi, exportApi } from '../services/api';
import { useDateRange } from '../contexts/DateRangeContext';
import { useAuth } from '../contexts/AuthContext';
import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(weekOfYear);
dayjs.extend(isoWeek);

const { Text } = Typography;

// Helper to pre-resolve seller names (resolvedDbBrand) for GMS records
const resolveDbBrands = (data, asins, sellers) => {
  if (!data || !Array.isArray(data)) return [];
  const asinMap = new Map();
  asins.forEach(a => {
    asinMap.set((a.asinCode || '').toUpperCase(), a);
  });
  const sellerMap = new Map();
  sellers.forEach(s => {
    sellerMap.set(s._id || s.id, s.name || '');
  });
  
  return data.map(d => {
    if (d.resolvedDbBrand) return d;
    const matchedDbAsin = asinMap.get((d.asin || '').toUpperCase());
    let dbBrandName = '';
    if (matchedDbAsin) {
      if (matchedDbAsin.brand) {
        dbBrandName = matchedDbAsin.brand;
      } else if (matchedDbAsin.sellerName) {
        dbBrandName = matchedDbAsin.sellerName;
      } else if (matchedDbAsin.sellerId) {
        const matchedSellerName = sellerMap.get(matchedDbAsin.sellerId);
        if (matchedSellerName) {
          dbBrandName = matchedSellerName;
        }
      }
    }
    return {
      ...d,
      resolvedDbBrand: d.dbBrand || dbBrandName || '-'
    };
  });
};

// Pre-compute MoM, WoW, DoD trends for all rows from grouped data — no gmsData scanning
const precomputeTrends = (rows) => {
  rows.forEach(row => {
    row._momTrends = {};
    row._wowTrends = {};
    row._dodTrends = {};

    // MoM: current month vs previous month from row.monthlyRev
    const months = Object.keys(row.monthlyRev).sort();
    for (let i = 1; i < months.length; i++) {
      const curr = row.monthlyRev[months[i]] || 0;
      const prev = row.monthlyRev[months[i - 1]] || 0;
      row._momTrends[months[i]] = prev > 0 ? ((curr - prev) / prev) * 100 : null;
    }

    // WoW: current week vs previous week from row.weeklyRev
    const weeks = Object.keys(row.weeklyRev).sort();
    for (let i = 1; i < weeks.length; i++) {
      const curr = row.weeklyRev[weeks[i]] || 0;
      const prev = row.weeklyRev[weeks[i - 1]] || 0;
      row._wowTrends[weeks[i]] = prev > 0 ? ((curr - prev) / prev) * 100 : null;
    }

    // DoD: each day vs previous day from row.dailyRev
    const days = Object.keys(row.dailyRev).sort();
    for (let i = 1; i < days.length; i++) {
      const curr = row.dailyRev[days[i]] || 0;
      const prev = row.dailyRev[days[i - 1]] || 0;
      row._dodTrends[days[i]] = prev > 0 ? ((curr - prev) / prev) * 100 : null;
    }
  });
  return rows;
};

// Get pre-computed trend for a record by period and key
const getTrend = (record, period, key) => {
  if (!record || !key || typeof key !== 'string') return null;
  const trendMap = period === 'month' ? record._momTrends : period === 'week' ? record._wowTrends : record._dodTrends;
  return trendMap?.[key] ?? null;
};

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function GmsTrackerPage() {
  const { user: currentUser, isAdmin, isGlobalUser, hasPermission } = useAuth();
  const [gmsData, setGmsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isComputing, setIsComputing] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadDate, setUploadDate] = useState(dayjs());
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [selectedAsins, setSelectedAsins] = useState([]);
  const { startDate, endDate } = useDateRange();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedMonths, setExpandedMonths] = useState({});
  const [expandedWeeks, setExpandedWeeks] = useState({});
  const [fileList, setFileList] = useState([]);
  const [viewLevel, setViewLevel] = useState('asin'); // 'asin' or 'seller'
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportLevel, setExportLevel] = useState('asin');
  const [exportDateType, setExportDateType] = useState('current');
  const [exportCustomDates, setExportCustomDates] = useState(null);
  const [exportBrandType, setExportBrandType] = useState('current');
  const [exportCustomBrands, setExportCustomBrands] = useState([]);
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(50);

  // Database Sellers / Brands
  const [dbSellers, setDbSellers] = useState([]);
  const dbAsinsRef = useRef([]);

  // Deferred filter flag for smooth UX during heavy filter recomputation
  const [isFilterPending, startFilterTransition] = useTransition();

  // Upload Progress States
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');

  // Fetch Brands/Sellers, ASINs & GMS Tracker data from Database
  useEffect(() => {
    const loadAllData = async () => {
      setLoading(true);
      try {
        const [sellersRes, asinsRes, gmsRes] = await Promise.all([
          sellerApi.getAll({ limit: 1000 }).catch(() => null),
          gmsApi.getAsins().catch(() => null),
          gmsApi.getAll({
            startDate: startDate ? dayjs(startDate).format('YYYY-MM-DD') : undefined,
            endDate: endDate ? dayjs(endDate).format('YYYY-MM-DD') : undefined
          }).catch(() => null)
        ]);

        let sellers = [];
        let asins = [];

        if (sellersRes && sellersRes.success && sellersRes.data?.sellers) {
          sellers = sellersRes.data.sellers;
          setDbSellers(sellers);
        }
        if (asinsRes && asinsRes.success && asinsRes.data) {
          asins = asinsRes.data || [];
          dbAsinsRef.current = asins;
        }
        if (gmsRes && gmsRes.success && gmsRes.data) {
          const resolved = resolveDbBrands(gmsRes.data, asins, sellers);
          setGmsData(resolved);
        }
      } catch (err) {
        console.error('Failed to load initial GMS data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadAllData();
  }, []);

  const clearAllData = useCallback(() => {
    Modal.confirm({
      title: 'Are you sure you want to clear all GMS Tracker data?',
      content: 'This will delete all uploaded GMS records permanently from the database.',
      okText: 'Clear Data',
      okType: 'danger',
      cancelText: 'Cancel',
      async onOk() {
        try {
          const res = await gmsApi.clearAll();
          if (res.success) {
            setGmsData([]);
            message.success('GMS Tracker cleared successfully.');
          }
        } catch (err) {
          message.error('Failed to clear GMS data: ' + err.message);
        }
      }
    });
  }, []);

  // Handle GMS spreadsheet matrix export via background job served in Downloads drawer
  const handleExport = async () => {
    try {
      const exportParams = {
        exportLevel,
        exportDateType,
        exportCustomDates: (exportDateType === 'custom' && exportCustomDates && exportCustomDates[0] && exportCustomDates[1])
          ? [exportCustomDates[0].toISOString(), exportCustomDates[1].toISOString()]
          : null,
        exportBrandType,
        exportCustomBrands,
        startDate: (exportDateType === 'current' && startDate) ? dayjs(startDate).format('YYYY-MM-DD') : null,
        endDate: (exportDateType === 'current' && endDate) ? dayjs(endDate).format('YYYY-MM-DD') : null,
        selectedBrands
      };

      message.loading({ content: 'Initiating GMS matrix export...', key: 'gms-export', duration: 2 });
      
      const res = await exportApi.startGmsExport(exportParams);
      if (res.success) {
        message.success({ content: 'GMS export started! Open the Downloads drawer to track progress.', key: 'gms-export', duration: 3 });
        setIsExportOpen(false);
        // Trigger Header drawer slide open
        window.dispatchEvent(new CustomEvent('export-started'));
      } else {
        throw new Error(res.message || 'Export failed to start');
      }
    } catch (err) {
      message.error({ content: 'GMS export failed: ' + err.message, key: 'gms-export', duration: 4 });
    }
  };

  // Extract unique brands from database sellers only
  const uniqueBrands = useMemo(() => {
    return dbSellers.map(s => s.name).filter(Boolean).sort();
  }, [dbSellers]);

  // Handle CSV file parsing with visual loading stages
  const handleFileUpload = async (file) => {
    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus('Uploading report to database...');

    try {
      const formattedDate = uploadDate.format('YYYY-MM-DD');
      const res = await gmsApi.upload(file, formattedDate, (percent) => {
        setUploadProgress(Math.min(95, percent));
        if (percent >= 100) {
          setUploadStatus('Processing and ingestion running on server...');
        }
      });

      if (res.success) {
        setUploadProgress(100);
        setUploadStatus('Processing completed successfully!');
        message.success(`Successfully uploaded GMS report: ${res.processed} rows processed, ${res.skipped} skipped.`);

        // Reload fresh data from database
        const freshGms = await gmsApi.getAll();
        if (freshGms.success && freshGms.data) {
          const resolved = resolveDbBrands(freshGms.data, dbAsinsRef.current, dbSellers);
          setGmsData(resolved);
        }

        setTimeout(() => {
          setIsUploadOpen(false);
          setIsUploading(false);
          setFileList([]);
          setUploadProgress(0);
          setUploadStatus('');
        }, 800);
      } else {
        throw new Error(res.error || 'Ingestion failed');
      }
    } catch (err) {
      console.error(err);
      message.error('File upload failed: ' + err.message);
      setIsUploading(false);
      setUploadProgress(0);
      setUploadStatus('');
    }
    return false; // prevent default upload
  };

  // Filter Data — pre-compute date boundaries to avoid per-item dayjs creation
  const filteredData = useMemo(() => {
    const startMs = startDate ? dayjs(startDate).startOf('day').valueOf() : 0;
    const endMs = endDate ? dayjs(endDate).endOf('day').valueOf() : Infinity;
    const hasDateFilter = !!startDate && !!endDate;
    const brandSet = selectedBrands.length > 0 ? new Set(selectedBrands) : null;
    const asinSet = selectedAsins.length > 0 ? new Set(selectedAsins) : null;
    const searchLower = searchQuery ? searchQuery.toLowerCase() : '';

    return gmsData.filter(item => {
      if (hasDateFilter) {
        const itemMs = new Date(item.date).getTime();
        if (itemMs < startMs || itemMs > endMs) return false;
      }
      if (brandSet && !brandSet.has(item.brand) && !brandSet.has(item.dbBrand)) return false;
      if (asinSet && !asinSet.has(item.asin)) return false;
      if (searchLower) {
        if (!(item.asin && item.asin.toLowerCase().includes(searchLower)) &&
            !(item.productTitle && item.productTitle.toLowerCase().includes(searchLower)) &&
            !(item.brand && item.brand.toLowerCase().includes(searchLower)) &&
            !(item.dbBrand && item.dbBrand.toLowerCase().includes(searchLower))) return false;
      }
      return true;
    });
  }, [gmsData, startDate, endDate, selectedBrands, selectedAsins, searchQuery]);

  const uniqueAsins = useMemo(() => {
    const set = new Set();
    filteredData.forEach(d => { if (d.asin) set.add(d.asin); });
    return [...set].sort();
  }, [filteredData]);

  // Reset table pagination when filters change
  useEffect(() => { setTablePage(1); }, [selectedBrands, selectedAsins, searchQuery, viewLevel]);

  // Aggregate Metrics for KPIs
  const kpiMetrics = useMemo(() => {
    let orderedRevenue = 0;
    let orderedUnits = 0;
    let shippedRevenue = 0;
    let shippedCOGS = 0;
    let shippedUnits = 0;
    let customerReturns = 0;

    filteredData.forEach(d => {
      orderedRevenue += d.orderedRevenue;
      orderedUnits += d.orderedUnits;
      shippedRevenue += d.shippedRevenue;
      shippedCOGS += d.shippedCOGS;
      shippedUnits += d.shippedUnits;
      customerReturns += d.customerReturns;
    });

    const profit = shippedRevenue - shippedCOGS;
    const returnRatio = orderedUnits > 0 ? (customerReturns / orderedUnits) * 100 : 0;

    return {
      orderedRevenue,
      orderedUnits,
      shippedRevenue,
      shippedCOGS,
      shippedUnits,
      customerReturns,
      profit,
      returnRatio
    };
  }, [filteredData]);

  // Compute period-over-period percentage change for each metric
  const percentageChanges = useMemo(() => {
    const sortedDates = [...new Set(filteredData.map(d => d.date))].sort();
    if (sortedDates.length < 2) {
      return { orderedRevenue: 0, orderedUnits: 0, shippedRevenue: 0, shippedUnits: 0, customerReturns: 0, returnRatio: 0, profit: 0 };
    }

    const mid = Math.floor(sortedDates.length / 2);
    const firstSet = new Set(sortedDates.slice(0, mid));
    const secondSet = new Set(sortedDates.slice(mid));

    const calcChange = (field, isProfit = false) => {
      let firstSum = 0, secondSum = 0;
      filteredData.forEach(d => {
        const val = isProfit ? (d.shippedRevenue - d.shippedCOGS) : d[field];
        if (firstSet.has(d.date)) firstSum += val || 0;
        else if (secondSet.has(d.date)) secondSum += val || 0;
      });
      return firstSum === 0 ? 0 : ((secondSum - firstSum) / firstSum) * 100;
    };

    let firstReturns = 0, firstOrdered = 0, secondReturns = 0, secondOrdered = 0;
    filteredData.forEach(d => {
      if (firstSet.has(d.date)) { firstReturns += d.customerReturns || 0; firstOrdered += d.orderedUnits || 0; }
      else { secondReturns += d.customerReturns || 0; secondOrdered += d.orderedUnits || 0; }
    });
    const firstRatio = firstOrdered > 0 ? (firstReturns / firstOrdered) * 100 : 0;
    const secondRatio = secondOrdered > 0 ? (secondReturns / secondOrdered) * 100 : 0;

    return {
      orderedRevenue: calcChange('orderedRevenue'),
      orderedUnits: calcChange('orderedUnits'),
      shippedRevenue: calcChange('shippedRevenue'),
      shippedUnits: calcChange('shippedUnits'),
      customerReturns: calcChange('customerReturns'),
      returnRatio: firstRatio === 0 ? 0 : ((secondRatio - firstRatio) / firstRatio) * 100,
      profit: calcChange('profit', true)
    };
  }, [filteredData]);

  // Dynamic Excel-style horizontal columns and row data grouping by ASIN or Seller
  const { tableColumns, tableDataSource } = useMemo(() => {
    if (filteredData.length === 0) {
      return { tableColumns: [], tableDataSource: [] };
    }

    let rows = [];
    let fixedCols = [];

    if (viewLevel === 'seller') {
      const sellersMap = {};
      filteredData.forEach(d => {
        const isUnmatched = !d.resolvedDbBrand || d.resolvedDbBrand === '-';
        const sellerName = !isUnmatched ? d.resolvedDbBrand : (d.brand || '-');
        if (!sellersMap[sellerName]) {
          sellersMap[sellerName] = {
            key: sellerName,
            dbBrand: sellerName,
            isUnmatched: isUnmatched,
            asins: new Set(),
            brands: new Set(),
            storeCodes: new Set(),
            dailyRev: {},
            weeklyRev: {},
            monthlyRev: {}
          };
        }
        const s = sellersMap[sellerName];
        if (d.asin) s.asins.add(d.asin);
        if (d.brand) s.brands.add(d.brand);
        if (d.storeCode) s.storeCodes.add(d.storeCode);

        const dObj = dayjs(d.date);
        const dateStr = d.date;
        const monthKey = dObj.format('YYYY-MM');
        const weekNum = dObj.isoWeek();
        const weekKey = `${dObj.format('YYYY')}-W${String(weekNum).padStart(2, '0')}`;

        // Day Revenue
        if (!s.dailyRev[dateStr]) s.dailyRev[dateStr] = 0;
        s.dailyRev[dateStr] += d.orderedRevenue;

        // Week Revenue
        if (!s.weeklyRev[weekKey]) s.weeklyRev[weekKey] = 0;
        s.weeklyRev[weekKey] += d.orderedRevenue;

        // Month Revenue
        if (!s.monthlyRev[monthKey]) s.monthlyRev[monthKey] = 0;
        s.monthlyRev[monthKey] += d.orderedRevenue;
      });

      rows = Object.values(sellersMap).map(s => ({
        ...s,
        asinsList: Array.from(s.asins),
        brandsList: Array.from(s.brands),
        storeCodesList: Array.from(s.storeCodes)
      }));

      fixedCols = [
        {
          title: 'Seller (DB)',
          dataIndex: 'dbBrand',
          key: 'dbBrand',
          width: 140,
          sorter: (a, b) => (a.dbBrand || '').localeCompare(b.dbBrand || ''),
          render: (text, record) => {
            if (record.isUnmatched) {
              return (
                <Space>
                  <Text type="secondary">{text}</Text>
                  <Tag color="orange" style={{ border: 'none', fontSize: 9, margin: 0, padding: '0 4px', lineHeight: '14px' }}>Unmatched</Tag>
                </Space>
              );
            }
            return <Text strong>{text}</Text>;
          }
        },
        {
          title: 'ASIN',
          dataIndex: 'asin',
          key: 'asin',
          width: 120,
          render: () => '-',
        },
        {
          title: 'Brand (Sheet)',
          dataIndex: 'brand',
          key: 'brand',
          width: 120,
          render: (text, record) => record.brandsList && record.brandsList.length > 0 ? record.brandsList.join(', ') : '-',
          sorter: (a, b) => (a.brand || '').localeCompare(b.brand || '')
        },
        {
          title: 'Store Code',
          dataIndex: 'storeCode',
          key: 'storeCode',
          width: 90,
          render: (text, record) => record.storeCodesList && record.storeCodesList.length > 0 ? record.storeCodesList.join(', ') : '-',
          sorter: (a, b) => (a.storeCode || '').localeCompare(b.storeCode || '')
        }
      ];
    } else {
      // Group by ASIN to generate rows
      const asinsMap = {};
      filteredData.forEach(d => {
        if (!asinsMap[d.asin]) {
          asinsMap[d.asin] = {
            key: d.asin,
            asin: d.asin,
            productTitle: d.productTitle || '-',
            dbBrand: d.resolvedDbBrand || '-',
            brand: d.brand || 'Generic',
            storeCode: d.storeCode || 'IN',
            dailyRev: {},
            weeklyRev: {},
            monthlyRev: {}
          };
        }

        const dObj = dayjs(d.date);
        const dateStr = d.date;
        const monthKey = dObj.format('YYYY-MM');
        const weekNum = dObj.isoWeek();
        const weekKey = `${dObj.format('YYYY')}-W${String(weekNum).padStart(2, '0')}`;

        // Day Revenue
        if (!asinsMap[d.asin].dailyRev[dateStr]) asinsMap[d.asin].dailyRev[dateStr] = 0;
        asinsMap[d.asin].dailyRev[dateStr] += d.orderedRevenue;

        // Week Revenue
        if (!asinsMap[d.asin].weeklyRev[weekKey]) asinsMap[d.asin].weeklyRev[weekKey] = 0;
        asinsMap[d.asin].weeklyRev[weekKey] += d.orderedRevenue;

        // Month Revenue
        if (!asinsMap[d.asin].monthlyRev[monthKey]) asinsMap[d.asin].monthlyRev[monthKey] = 0;
        asinsMap[d.asin].monthlyRev[monthKey] += d.orderedRevenue;
      });

      rows = Object.values(asinsMap);

      fixedCols = [
        {
          title: 'Seller (DB)',
          dataIndex: 'dbBrand',
          key: 'dbBrand',
          width: 140,
          sorter: (a, b) => (a.dbBrand || '').localeCompare(b.dbBrand || '')
        },
        {
          title: 'ASIN',
          dataIndex: 'asin',
          key: 'asin',
          width: 120,
          render: (text) => <Text strong style={{ fontFamily: 'monospace' }}>{text}</Text>,
          sorter: (a, b) => (a.asin || '').localeCompare(b.asin || '')
        },
        {
          title: 'Brand (Sheet)',
          dataIndex: 'brand',
          key: 'brand',
          width: 120,
          sorter: (a, b) => (a.brand || '').localeCompare(b.brand || '')
        },
        {
          title: 'Store Code',
          dataIndex: 'storeCode',
          key: 'storeCode',
          width: 90,
          sorter: (a, b) => (a.storeCode || '').localeCompare(b.storeCode || '')
        }
      ];
    }

    // Gather and sort all unique dates from filteredData
    const dates = [...new Set(filteredData.map(d => d.date))].sort();
    const monthGroups = {};

    dates.forEach(dateStr => {
      const d = dayjs(dateStr);
      const monthKey = d.format('YYYY-MM');
      const monthLabel = d.format('MMMM YYYY');
      const weekNum = d.isoWeek();
      const weekKey = `${d.format('YYYY')}-W${String(weekNum).padStart(2, '0')}`;

      const startOfWeek = d.startOf('isoWeek').format('DD MMM');
      const endOfWeek = d.endOf('isoWeek').format('DD MMM');
      const weekLabel = `Week ${weekNum} (${startOfWeek} - ${endOfWeek})`;

      if (!monthGroups[monthKey]) {
        monthGroups[monthKey] = {
          label: monthLabel,
          key: monthKey,
          weeks: {}
        };
      }

      if (!monthGroups[monthKey].weeks[weekKey]) {
        monthGroups[monthKey].weeks[weekKey] = {
          label: weekLabel,
          key: weekKey,
          days: []
        };
      }

      monthGroups[monthKey].weeks[weekKey].days.push(dateStr);
    });

    // Build nested dynamic Excel columns with collapsible month and week levels
    const dynamicCols = Object.values(monthGroups).map(month => {
      const isMonthExpanded = expandedMonths[month.key] !== false; // default to expanded

      const toggleMonth = (e) => {
        e.stopPropagation();
        setExpandedMonths(prev => ({ ...prev, [month.key]: !isMonthExpanded }));
      };

      const monthTitle = (
        <span className="gms-col-month" onClick={toggleMonth}>
          <span className="gms-col-toggle">
            {isMonthExpanded ? '▼' : '▶'}
          </span>
          {month.label}
        </span>
      );

      if (!isMonthExpanded) {
        // Collapsed Month: show only Month Total and MoM Trend directly under the Month header
        return {
          title: monthTitle,
          children: [
            {
              title: 'Month Total',
              key: `month-total-${month.key}`,
              align: 'right',
              width: 130,
              render: (_, record) => {
                const rev = record.monthlyRev[month.key] || 0;
                return rev ? <span style={{ fontWeight: 800, color: '#0f172a' }}>₹{rev.toLocaleString('en-IN')}</span> : '-';
              },
              sorter: (a, b) => (a.monthlyRev[month.key] || 0) - (b.monthlyRev[month.key] || 0)
            },
            {
              title: 'MoM Trend',
              key: `mom-trend-${month.key}`,
              align: 'center',
              width: 110,
              render: (_, record) => {
                const trend = getTrend(record, 'month', month.key);
                if (trend === null) return <span style={{ color: '#94a3b8' }}>-</span>;
                const isUp = trend >= 0;
                return <Tag color={isUp ? 'success' : 'error'} style={{ border: 'none', fontWeight: 700 }}>{isUp ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}%</Tag>;
              },
              sorter: (a, b) => (getTrend(a, 'month', month.key) || 0) - (getTrend(b, 'month', month.key) || 0)
            }
          ]
        };
      }

      // Expanded Month: build week sub-columns
      const weekCols = Object.values(month.weeks).map(week => {
        const isWeekExpanded = expandedWeeks[week.key] !== false; // default to expanded

        const toggleWeek = (e) => {
          e.stopPropagation();
          setExpandedWeeks(prev => ({ ...prev, [week.key]: !isWeekExpanded }));
        };

        const weekTitle = (
          <span className="gms-col-week" onClick={toggleWeek}>
            <span className="gms-col-week-toggle">
              {isWeekExpanded ? '▼' : '▶'}
            </span>
            {week.label}
          </span>
        );

        if (!isWeekExpanded) {
          // Collapsed Week: show only Week Total and WoW Trend
          return {
            title: weekTitle,
            children: [
              {
                title: 'Week Total',
                key: `week-total-${week.key}`,
                align: 'right',
                width: 120,
                render: (_, record) => {
                  const rev = record.weeklyRev[week.key] || 0;
                  return rev ? <span style={{ fontWeight: 700, color: '#1976D2' }}>₹{rev.toLocaleString('en-IN')}</span> : '-';
                },
                sorter: (a, b) => (a.weeklyRev[week.key] || 0) - (b.weeklyRev[week.key] || 0)
              },
              {
                title: 'WoW Trend',
                key: `wow-trend-${week.key}`,
                align: 'center',
                width: 110,
                render: (_, record) => {
                  const trend = getTrend(record, 'week', week.key);
                  if (trend === null) return <span style={{ color: '#94a3b8' }}>-</span>;
                  const isUp = trend >= 0;
                  return <Tag color={isUp ? 'success' : 'error'} style={{ border: 'none', fontWeight: 700 }}>{isUp ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}%</Tag>;
                },
                sorter: (a, b) => (getTrend(a, 'week', week.key) || 0) - (getTrend(b, 'week', week.key) || 0)
              }
            ]
          };
        }

        // Expanded Week: show day columns with interleaved DoD trend columns
        // Layout: Day1 | Day2 | Trend(1→2) | Day3 | Trend(2→3) | ...
        const sortedDays = [...week.days].sort();
        const dayCols = [];

        sortedDays.forEach((dayStr, idx) => {
          // Add the day column
          dayCols.push({
            title: dayjs(dayStr).format('DD MMM'),
            key: `day-${dayStr}`,
            align: 'right',
            width: 100,
            render: (_, record) => {
              const rev = record.dailyRev[dayStr] || 0;
              return rev ? `₹${rev.toLocaleString('en-IN')}` : '-';
            },
            sorter: (a, b) => (a.dailyRev[dayStr] || 0) - (b.dailyRev[dayStr] || 0)
          });

          // After the 2nd day onward, add a DoD trend column between prev day and current day
          if (idx > 0) {
            const prevDayStr = sortedDays[idx - 1];
            const currDayStr = dayStr;
            const trendLabel = `${dayjs(prevDayStr).format('DD')}→${dayjs(currDayStr).format('DD')}`;

            dayCols.push({
              title: <Tooltip title={`Trend: ${dayjs(prevDayStr).format('DD MMM')} → ${dayjs(currDayStr).format('DD MMM')}`}>
                <span style={{ fontSize: 11, color: '#1976D2', fontWeight: 700, whiteSpace: 'nowrap' }}>▸ {trendLabel}</span>
              </Tooltip>,
              key: `dod-trend-${prevDayStr}-${currDayStr}`,
              align: 'center',
              width: 90,
              render: (_, record) => {
                const prevRev = record.dailyRev[prevDayStr] || 0;
                const currRev = record.dailyRev[currDayStr] || 0;

                if (!prevRev && !currRev) return <span style={{ color: '#94a3b8' }}>-</span>;
                if (!prevRev) return <Tag color="success" style={{ border: 'none', fontWeight: 700, fontSize: 11 }}>NEW</Tag>;

                const change = ((currRev - prevRev) / prevRev) * 100;
                const isUp = change >= 0;
                return (
                  <Tag
                    color={isUp ? 'success' : 'error'}
                    style={{ border: 'none', fontWeight: 700, fontSize: 11, margin: 0 }}
                  >
                    {isUp ? '▲' : '▼'} {Math.abs(change).toFixed(1)}%
                  </Tag>
                );
              },
              sorter: (a, b) => {
                const aPrev = a.dailyRev[prevDayStr] || 0;
                const aCurr = a.dailyRev[currDayStr] || 0;
                const bPrev = b.dailyRev[prevDayStr] || 0;
                const bCurr = b.dailyRev[currDayStr] || 0;
                const aChange = aPrev ? ((aCurr - aPrev) / aPrev) * 100 : 0;
                const bChange = bPrev ? ((bCurr - bPrev) / bPrev) * 100 : 0;
                return aChange - bChange;
              }
            });
          }
        });

        // Week Total
        dayCols.push({
          title: 'Week Total',
          key: `week-total-${week.key}`,
          align: 'right',
          width: 120,
          render: (_, record) => {
            const rev = record.weeklyRev[week.key] || 0;
            return rev ? <span style={{ fontWeight: 700, color: '#1976D2' }}>₹{rev.toLocaleString('en-IN')}</span> : '-';
          },
          sorter: (a, b) => (a.weeklyRev[week.key] || 0) - (b.weeklyRev[week.key] || 0)
        });

        // WoW Trend
        dayCols.push({
          title: 'WoW Trend',
          key: `wow-trend-${week.key}`,
          align: 'center',
          width: 110,
          render: (_, record) => {
            const trend = getTrend(record, 'week', week.key);
            if (trend === null) return <span style={{ color: '#94a3b8' }}>-</span>;
            const isUp = trend >= 0;
            return <Tag color={isUp ? 'success' : 'error'} style={{ border: 'none', fontWeight: 700 }}>{isUp ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}%</Tag>;
          },
          sorter: (a, b) => (getTrend(a, 'week', week.key) || 0) - (getTrend(b, 'week', week.key) || 0)
        });

        return {
          title: weekTitle,
          children: dayCols
        };
      });

      // Month Total
      weekCols.push({
        title: 'Month Total',
        key: `month-total-${month.key}`,
        align: 'right',
        width: 130,
        render: (_, record) => {
          const rev = record.monthlyRev[month.key] || 0;
          return rev ? <span style={{ fontWeight: 800, color: '#0f172a' }}>₹{rev.toLocaleString('en-IN')}</span> : '-';
        },
        sorter: (a, b) => (a.monthlyRev[month.key] || 0) - (b.monthlyRev[month.key] || 0)
      });

      // MoM Trend
      weekCols.push({
        title: 'MoM Trend',
        key: `mom-trend-${month.key}`,
        align: 'center',
        width: 110,
        render: (_, record) => {
          const trend = getTrend(record, 'month', month.key);
          if (trend === null) return <span style={{ color: '#94a3b8' }}>-</span>;
          const isUp = trend >= 0;
          return <Tag color={isUp ? 'success' : 'error'} style={{ border: 'none', fontWeight: 700 }}>{isUp ? '▲' : '▼'} {trend.toFixed(1)}%</Tag>;
        },
        sorter: (a, b) => (getTrend(a, 'month', month.key) || 0) - (getTrend(b, 'month', month.key) || 0)
      });

      return {
        title: monthTitle,
        children: weekCols
      };
    });

    // Pre-compute all trends during aggregation — eliminates per-cell gmsData scans
    precomputeTrends(rows);

    return {
      tableColumns: [...fixedCols, ...dynamicCols],
      tableDataSource: rows
    };
  }, [filteredData, dbSellers, expandedMonths, expandedWeeks, viewLevel]);

  // Chart configuration
  const chartSeries = useMemo(() => {
    const dailyData = {};
    filteredData.forEach(d => {
      if (!dailyData[d.date]) dailyData[d.date] = 0;
      dailyData[d.date] += d.orderedRevenue;
    });

    // Round values to integers
    Object.keys(dailyData).forEach(k => {
      dailyData[k] = Math.round(dailyData[k]);
    });

    const sortedDates = Object.keys(dailyData).sort();
    const palette = ['#D32F2F', '#0288D1', '#2E7D32', '#ED6C02', '#9C27B0', '#9C27B0', '#0288D1', '#ED6C02'];
    const barColors = sortedDates.map((_, i) => palette[i % palette.length]);
    return {
      options: {
        chart: {
          id: 'gms-revenue-trend',
          toolbar: { show: false },
          sparkline: { enabled: false }
        },
        colors: barColors,
        dataLabels: { enabled: false },
        stroke: { show: false },
        plotOptions: { bar: { columnWidth: '50%', borderRadius: 4, distributed: true } },
        xaxis: {
          categories: sortedDates.map(d => dayjs(d).format('DD MMM')),
          labels: { style: { colors: '#64748b', fontSize: '10px', fontWeight: 600 } },
          axisBorder: { show: false }, axisTicks: { show: false }
        },
        yaxis: {
          labels: {
            formatter: (val) => `₹${val >= 100000 ? (val / 100000).toFixed(1) + 'L' : val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}`,
            style: { colors: '#64748b', fontSize: '10px' }
          }
        },
        tooltip: {
          enabled: true,
          theme: 'light',
          y: { formatter: (val) => `₹${Math.round(val).toLocaleString('en-IN')}` }
        },
        grid: {
          borderColor: '#f1f5f9',
          strokeDashArray: 4
        },
        legend: { show: false }
      },
      series: [
        {
          name: 'Ordered Revenue',
          data: sortedDates.map(d => dailyData[d])
        }
      ]
    };
  }, [filteredData]);

  const btnStyle = { borderRadius: 8, fontWeight: 600, fontSize: 11, height: 32 };

  return (
    <div style={{ background: '#f4f5f7', minHeight: '100%', padding: '0 24px' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60, flexWrap: 'wrap', gap: 8 }}>
        <Space orientation="vertical" size={2}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Text strong style={{ fontSize: 16, color: '#0f172a' }}>GMS Tracker</Text>
            <Tag color="blue" style={{ border: 'none', fontWeight: 700, borderRadius: 4, fontSize: 10 }}>Interactive</Tag>
          </div>
          <Text type="secondary" style={{ fontSize: 11 }}>
            Spreadsheet-style horizontal matrix mapping Ordered Revenue across {viewLevel === 'seller' ? 'Sellers' : 'ASINs'}.
          </Text>
        </Space>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Segmented
            value={viewLevel}
            onChange={(value) => startFilterTransition(() => setViewLevel(value))}
            options={[{ label: 'ASIN View', value: 'asin' }, { label: 'Seller View', value: 'seller' }]}
            size="small"
          />
          {(isAdmin || isGlobalUser || hasPermission('gms_tracker_export')) && (
            <Button icon={<DownloadOutlined />} size="small" style={btnStyle}
              onClick={() => { setExportLevel(viewLevel); setIsExportOpen(true); }}>
              Export
            </Button>
          )}
          {(isAdmin || isGlobalUser || hasPermission('gms_tracker_import')) && (
            <Button type="primary" icon={<UploadOutlined />} size="small" style={btnStyle}
              onClick={() => setIsUploadOpen(true)}>
              Upload Data
            </Button>
          )}
        </div>
      </div>

      {/* FILTERS */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <Select mode="multiple" placeholder="All Brands / Sellers" size="small" allowClear maxTagCount="responsive"
          value={selectedBrands} onChange={(val) => startFilterTransition(() => setSelectedBrands(val))}
          style={{ minWidth: 200, maxWidth: 320 }} />
        <Select mode="multiple" placeholder="All ASINs" size="small" allowClear maxTagCount="responsive"
          value={selectedAsins} onChange={(val) => startFilterTransition(() => setSelectedAsins(val))}
          style={{ minWidth: 200, maxWidth: 320 }} />
        <Input.Search placeholder="Search ASIN, Title, Brand..." size="small" allowClear style={{ width: 220, borderRadius: 8 }}
          prefix={<SearchOutlined style={{ color: '#94a3b8', fontSize: 12 }} />}
          value={searchQuery} onChange={e => startFilterTransition(() => setSearchQuery(e.target.value))} />
      </div>

      {/* KPI STRIP */}
      {loading ? (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          {[1, 2, 3, 4, 5].map(i => (
            <Col key={i} xs={12} sm={6} md={4} style={{ flex: '1 1 160px' }}>
              <Card style={{ borderRadius: 12, border: '1px solid #d9e6e9', padding: 8 }}><Skeleton active paragraph={{ rows: 1 }} /></Card>
            </Col>
          ))}
        </Row>
      ) : (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'Ordered Revenue', value: `₹${kpiMetrics.orderedRevenue.toLocaleString('en-IN')}`, color: '#1976D2', change: percentageChanges.orderedRevenue },
            { label: 'Ordered Units', value: kpiMetrics.orderedUnits.toLocaleString(), color: '#0288D1', change: percentageChanges.orderedUnits },
            { label: 'Shipped Units', value: kpiMetrics.shippedUnits.toLocaleString(), color: '#2E7D32', change: percentageChanges.shippedUnits },
            { label: 'Customer Returns', value: kpiMetrics.customerReturns.toLocaleString(), color: '#D32F2F', change: percentageChanges.customerReturns, invertColor: true },
            { label: 'Return Ratio', value: `${(kpiMetrics.returnRatio || 0).toFixed(2)}%`, color: '#ED6C02', change: percentageChanges.returnRatio, invertColor: true },
          ].map((kpi, idx) => {
            const isPositive = kpi.invertColor ? kpi.change <= 0 : kpi.change >= 0;
            const trendColor = isPositive ? '#2E7D32' : '#D32F2F';
            return (
              <div key={idx} style={{ height: 32, minWidth: 'max-content', flexShrink: 0, borderRadius: 6,
                border: '1px solid #e5e7eb', background: '#ffffff', display: 'flex',
                alignItems: 'center', gap: 8, padding: '0 12px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: kpi.color }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: kpi.color, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{kpi.label}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>{kpi.value}</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: trendColor }}>
                  {kpi.change >= 0 ? '+' : ''}{kpi.change.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* REVENUE TREND CHART */}
      {filteredData.length > 0 && (
        <Card style={{ borderRadius: 12, border: '1px solid #d9e6e9', marginBottom: 16 }} styles={{ body: { padding: '10px 14px' } }}>
          <div style={{ marginBottom: 8 }}>
            <Text strong style={{ color: '#0f172a', fontSize: 13 }}>Ordered Revenue Trend Timeline</Text>
          </div>
          <Chart
                options={chartSeries.options}
                series={chartSeries.series}
                type="bar"
                height={180}
              />
        </Card>
      )}

      {/* DATA MATRIX TABLE */}
      <Card style={{ borderRadius: 12, border: '1px solid #d9e6e9' }} styles={{ body: { padding: 0 } }}>
        <div style={{ padding: '8px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text strong style={{ fontSize: 13, color: '#0f172a' }}>Spreadsheet Data Matrix</Text>
          <Tooltip title="Horizontal breakdown of Ordered Revenue by Month, Week, and Day.">
            <InfoCircleOutlined style={{ color: '#94a3b8', fontSize: 12 }} />
          </Tooltip>
        </div>
        {tableDataSource.length > 0 ? (
          <div style={{ position: 'relative' }}>
            {(isFilterPending || isComputing) && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(2px)', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #e2e8f0' }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #e2e8f0', borderTopColor: '#1976D2', animation: 'gms-spin 0.8s linear infinite' }} />
                <Text style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Computing...</Text>
              </div>
            )}
          <Table
            columns={tableColumns}
            dataSource={tableDataSource}
            pagination={{
              current: tablePage,
              pageSize: tablePageSize,
              showSizeChanger: true,
              pageSizeOptions: ['25', '50', '100'],
              size: 'small',
              onChange: (page, size) => { setTablePage(page); setTablePageSize(size); },
              total: tableDataSource.length,
              showTotal: (total) => `${total} rows`
            }}
            size="small"
            scroll={{ x: 'max-content' }}
            bordered
            className="gms-tracker-table"
            style={{ borderRadius: '0 0 8px 8px', overflow: 'hidden' }}
          />
          </div>
        ) : (
          <div style={{ padding: 30, textAlign: 'center' }}>
            <Empty description="No data loaded. Click 'Upload GMS Data' to upload your report file." />
          </div>
        )}
      </Card>

      {/* FILE UPLOAD MODAL */}
      <Modal
        title={<span style={{ fontWeight: 800 }}>Upload GMS Report</span>}
        open={isUploadOpen}
        onCancel={() => { if (!isUploading) { setIsUploadOpen(false); setFileList([]); } }}
        footer={null}
        destroyOnHidden
        centered
        width={450}
        closable={!isUploading}
        mask={{ closable: !isUploading }}
      >
        {isUploading ? (
          <div style={{ padding: '20px 10px', textAlign: 'center' }}>
            <Progress type="circle" percent={uploadProgress} strokeColor="#0f172a" />
            <div style={{ marginTop: 16, fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
              {uploadStatus}
            </div>
            <div style={{ marginTop: 6, fontSize: 11, color: '#64748b' }}>
              Please do not close this window while processing is running.
            </div>
          </div>
        ) : (
          <div style={{ padding: '4px 0' }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                1. ASSOCIATE DATE / MONTH FOR REPORT
              </div>
              <DatePicker
                value={uploadDate}
                onChange={setUploadDate}
                style={{ width: '100%', borderRadius: 6 }}
                picker="date"
                placeholder="Select date for this sheet"
              />
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>
                Assigns the loaded metrics to the chosen date for MoM/WoW/DoD trend comparison.
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                2. SELECT FILE TO PARSE
              </div>
              <Upload.Dragger
                accept=".csv,.xlsx,.xls"
                beforeUpload={handleFileUpload}
                fileList={fileList}
                onChange={({ fileList }) => setFileList(fileList)}
                maxCount={1}
              >
                <p className="ant-upload-drag-icon" style={{ marginBottom: 8 }}>
                  <UploadOutlined style={{ color: '#1976D2', fontSize: 24 }} />
                </p>
                <p className="ant-upload-text" style={{ fontSize: 11, fontWeight: 600, color: '#1e293b' }}>
                  Click or drag GMS CSV/Excel report here
                </p>
                <p className="ant-upload-hint" style={{ fontSize: 10, color: '#64748b', padding: '0 8px' }}>
                  Required headers: ASIN, Product Title, Brand, StoreCode, Ordered Revenue, Ordered Units, Shipped Revenue, Shipped COGS, Shipped Units, Customer Returns
                </p>
              </Upload.Dragger>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button onClick={() => { setIsUploadOpen(false); setFileList([]); }} style={{ borderRadius: 6, fontSize: 12, height: 32 }}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* EXPORT DATA CONFIGURATION MODAL */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 10, borderBottom: '1px solid #f1f5f9' }}>
            <div style={{
              width: 30,
              height: 30,
              borderRadius: 6,
              background: 'linear-gradient(135deg, #1976D2 0%, #1976D2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 2px 6px rgba(79,70,229,0.2)'
            }}>
              <DownloadOutlined style={{ fontSize: 14 }} />
            </div>
            <div>
              <span style={{ fontWeight: 800, fontSize: 14, color: '#0f172a', display: 'block' }}>Export GMS Report</span>
              <span style={{ fontSize: 10.5, fontWeight: 500, color: '#64748b', display: 'block', marginTop: 1 }}>Configure and download GMS matrix spreadsheets</span>
            </div>
          </div>
        }
        open={isExportOpen}
        onCancel={() => setIsExportOpen(false)}
        footer={null}
        destroyOnHidden
        centered
        width={520}
      >
        <div style={{ padding: '12px 0 4px 0' }}>
          {/* Level Switcher Option */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#1976D2', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, letterSpacing: '0.05em' }}>
              <span style={{ background: '#eef2ff', padding: '2px 6px', borderRadius: 4, fontSize: 9 }}>01</span>
              EXPORT LEVEL
            </div>
            <Segmented
              value={exportLevel}
              onChange={(value) => setExportLevel(value)}
              options={[
                { label: 'ASIN Wise Matrix', value: 'asin' },
                { label: 'Seller Wise Matrix', value: 'seller' }
              ]}
              block
              className="gms-view-toggle"
              style={{ fontWeight: 600 }}
            />
          </div>

          {/* Date Filtering Options */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#1976D2', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, letterSpacing: '0.05em' }}>
              <span style={{ background: '#eef2ff', padding: '2px 6px', borderRadius: 4, fontSize: 9 }}>02</span>
              DATE RANGE BREAKDOWN
            </div>
            <Radio.Group
              value={exportDateType}
              onChange={(e) => setExportDateType(e.target.value)}
              style={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}
            >
              <div className={`gms-export-option-card ${exportDateType === 'all' ? 'active' : ''}`} onClick={() => setExportDateType('all')}>
                <Radio value="all">
                  <div style={{ marginLeft: 4 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>All Time Data</div>
                    <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 1 }}>Export all historical records available in the database</div>
                  </div>
                </Radio>
              </div>
              <div className={`gms-export-option-card ${exportDateType === 'current' ? 'active' : ''}`} onClick={() => setExportDateType('current')}>
                <Radio value="current">
                  <div style={{ marginLeft: 4 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>
                      Currently Filtered Range
                      {startDate && endDate && (
                        <span style={{ color: '#1976D2', fontWeight: 700, marginLeft: 6, fontSize: 11 }}>
                          ({dayjs(startDate).format('DD MMM YYYY')} - {dayjs(endDate).format('DD MMM YYYY')})
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 1 }}>Export only records within the page's current date range filters</div>
                  </div>
                </Radio>
              </div>
              <div className={`gms-export-option-card ${exportDateType === 'custom' ? 'active' : ''}`} onClick={() => setExportDateType('custom')}>
                <Radio value="custom">
                  <div style={{ marginLeft: 4 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>Custom Range</div>
                    <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 1 }}>Define a custom date range window for the exported report</div>
                  </div>
                </Radio>
              </div>
            </Radio.Group>

            {exportDateType === 'custom' && (
              <div style={{ marginTop: 8, paddingLeft: 4 }}>
                <RangePicker
                  value={exportCustomDates}
                  onChange={setExportCustomDates}
                  style={{ width: '100%', borderRadius: 8, height: 36 }}
                />
              </div>
            )}
          </div>

          {/* Brand Filtering Options */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#1976D2', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, letterSpacing: '0.05em' }}>
              <span style={{ background: '#eef2ff', padding: '2px 6px', borderRadius: 4, fontSize: 9 }}>03</span>
              BRAND / SELLER FILTER
            </div>
            <Radio.Group
              value={exportBrandType}
              onChange={(e) => setExportBrandType(e.target.value)}
              style={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}
            >
              <div className={`gms-export-option-card ${exportBrandType === 'all' ? 'active' : ''}`} onClick={() => setExportBrandType('all')}>
                <Radio value="all">
                  <div style={{ marginLeft: 4 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>All Brands / Sellers</div>
                    <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 1 }}>Export records for all sellers and brands without filtering</div>
                  </div>
                </Radio>
              </div>
              <div className={`gms-export-option-card ${exportBrandType === 'current' ? 'active' : ''}`} onClick={() => setExportBrandType('current')}>
                <Radio value="current">
                  <div style={{ marginLeft: 4 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>
                      Currently Selected Page Brands
                      {selectedBrands.length > 0 && (
                        <span style={{ color: '#1976D2', fontWeight: 700, marginLeft: 6, fontSize: 11 }}>
                          ({selectedBrands.length} selected)
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 1 }}>Export only records matching the currently active page brand filters</div>
                  </div>
                </Radio>
              </div>
              <div className={`gms-export-option-card ${exportBrandType === 'custom' ? 'active' : ''}`} onClick={() => setExportBrandType('custom')}>
                <Radio value="custom">
                  <div style={{ marginLeft: 4 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>Custom Selected Brands</div>
                    <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 1 }}>Manually choose one or more specific brands/sellers to export</div>
                  </div>
                </Radio>
              </div>
            </Radio.Group>

            {exportBrandType === 'custom' && (
              <div style={{ marginTop: 8, paddingLeft: 4 }}>
                <Select
                  mode="multiple"
                  placeholder="Select custom brands to export"
                  value={exportCustomBrands}
                  onChange={setExportCustomBrands}
                  style={{ width: '100%' }}
                  allowClear
                  maxTagCount="responsive"
                  styles={{
                    selector: {
                      borderRadius: '8px !important'
                    }
                  }}
                >
                  {uniqueBrands.map(b => (
                    <Select.Option key={b} value={b}>{b}</Select.Option>
                  ))}
                </Select>
              </div>
            )}
          </div>

          {/* Footer buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
            <Button onClick={() => setIsExportOpen(false)} style={{ borderRadius: 8, fontSize: 12, fontWeight: 600, height: 34 }}>
              Cancel
            </Button>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleExport}
              style={{ borderRadius: 8, fontWeight: 600, fontSize: 12, height: 34 }}
            >
              Export to Excel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

<style>{`@keyframes gms-spin { to { transform: rotate(360deg); } }`}</style>
