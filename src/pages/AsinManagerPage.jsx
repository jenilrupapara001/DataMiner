import React, { useState, useEffect, useMemo, useCallback } from 'react';
import TablePagination from '@mui/material/TablePagination';
import KPICard from '../components/KPICard';
import ProgressBar from '../components/common/ProgressBar';
import EmptyState from '../components/common/EmptyState';
import octoparseService from '../services/octoparseService';
import { db } from '../services/db';
import { asinApi, marketSyncApi, sellerApi } from '../services/api';
import { useSocket } from '../contexts/SocketContext';
import { calculateLQS } from '../utils/lqs';
import {
  Package,
  Activity,
  Trophy,
  AlertTriangle,
  Zap,
  TrendingUp,
  BarChart2,
  Star,
  Plus,
  Table,
  ChevronDown,
  ChevronUp,
  Download,
  RefreshCw,
  Search,
  Scan,
  IndianRupee,
  ChevronRight,
  TrendingDown,
  Trash2,
  Sparkles,
  Image,
  Eye,
  Store,
  ListChecks,
  FileUp,
  LayoutGrid,
  X,
  AlertCircle,
  Clock
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { PageLoader } from '@/components/application/loading-indicator/PageLoader';
import { LoadingIndicator } from '@/components/application/loading-indicator/loading-indicator';
import AsinDetailModal from '../components/AsinDetailModal';
import AsinTrendsModal from '../components/AsinTrendsModal';
import PriceViewModal from '../components/PriceViewModal';
import BSRViewModal from '../components/BSRViewModal';
import RatingViewModal from '../components/RatingViewModal';

// Helper to generate tiered structure for history columns
const generateHistoryStructure = (history) => {
  if (!history || history.length === 0) return [{ label: 'W1', dates: [{ label: 'N/A' }] }];

  // 1. Group by Week
  const groups = {};
  [...history].sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(item => {
    // Extract week label (e.g., "W45" from "W45-2024")
    const weekLabel = item.week ? item.week.split('-')[0] : 'W?';
    if (!groups[weekLabel]) groups[weekLabel] = [];
    groups[weekLabel].push(item);
  });

  // 2. Format structure for rendering
  return Object.keys(groups).map(week => ({
    label: week,
    dates: groups[week].map(d => ({
      raw: d.date,
      label: new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
    }))
  }));
};

// Helper to generate history structure from sorted date strings (YYYY-MM-DD format)
const generateHistoryStructureFromDates = (sortedDates) => {
  if (!sortedDates || sortedDates.length === 0) return [{ label: 'W1', dates: [{ label: 'N/A' }] }];

  // Limit to the last 7 unique days for the "Current Week" view in the table
  const recentDates = sortedDates.slice(-7);

  return [{
    label: 'Current Week',
    dates: recentDates.map(dateStr => {
      const date = new Date(dateStr + 'T00:00:00');
      return {
        raw: dateStr,
        label: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
      };
    })
  }];
};

// Helper to get week number from date
const getWeekNumber = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};

// Helper function for week history badges
const getWeekHistoryBadge = (value, type) => {
  if (!value) return <span style={{ color: '#9ca3af' }}>-</span>;

  if (type === 'price') {
    return <span style={{ fontWeight: 500, color: '#059669' }}>₹{value.toLocaleString()}</span>;
  } else if (type === 'number') {
    return <span style={{ fontWeight: 500, color: '#2563eb' }}>#{value.toLocaleString()}</span>;
  } else if (type === 'rating') {
    return <span style={{ fontWeight: 500, color: '#d97706' }}>{value.toFixed(1)}</span>;
  }
  return value;
};

// Extended demo ASIN data with date stamps and 8 weeks of history
const demoAsins = [
  {
    id: '1',
    asinCode: 'B07XYZ123',
    sku: 'SKU-WE-001',
    title: 'Wireless Bluetooth Earbuds Pro with Noise Cancellation',
    imageUrl: 'https://placehold.co/100x100?text=Earbuds',
    brand: 'AudioTech',
    category: 'Electronics',
    currentPrice: 2499,
    bsr: 1250,
    rating: 4.5,
    reviewCount: 1250,
    buyBoxWin: true,
    couponDetails: '₹100 Off',
    dealDetails: 'Lightning Deal',
    totalOffers: 15,
    imagesCount: 7,
    hasAplus: true,
    descLength: 520,
    lqs: 85,
    status: 'Active',
    weekHistory: [
      { week: 'W48-2024', date: '2024-12-01', price: 2399, bsr: 1400, rating: 4.4, reviews: 1180, hasAplus: true },
      { week: 'W49-2024', date: '2024-12-08', price: 2499, bsr: 1350, rating: 4.4, reviews: 1200, hasAplus: true },
      { week: 'W50-2024', date: '2024-12-15', price: 2499, bsr: 1300, rating: 4.5, reviews: 1215, hasAplus: true },
      { week: 'W51-2024', date: '2024-12-22', price: 2599, bsr: 1280, rating: 4.5, reviews: 1225, hasAplus: true },
      { week: 'W52-2024', date: '2024-12-29', price: 2499, bsr: 1250, rating: 4.5, reviews: 1235, hasAplus: true },
      { week: 'W01-2025', date: '2025-01-05', price: 2399, bsr: 1220, rating: 4.5, reviews: 1240, hasAplus: true },
      { week: 'W02-2025', date: '2025-01-12', price: 2499, bsr: 1200, rating: 4.5, reviews: 1245, hasAplus: true },
      { week: 'W03-2025', date: '2025-01-19', price: 2499, bsr: 1250, rating: 4.5, reviews: 1250, hasAplus: true },
    ],
  },
  {
    id: '2',
    asinCode: 'B07ABC456',
    sku: 'SKU-SW-002',
    title: 'Smart Watch Elite - Fitness Tracker with GPS',
    imageUrl: 'https://placehold.co/100x100?text=Watch',
    brand: 'FitGear',
    category: 'Electronics',
    currentPrice: 8999,
    bsr: 890,
    rating: 4.2,
    reviewCount: 890,
    buyBoxWin: true,
    couponDetails: 'None',
    dealDetails: 'None',
    totalOffers: 8,
    imagesCount: 5,
    hasAplus: true,
    descLength: 480,
    lqs: 72,
    status: 'Active',
    weekHistory: [
      { week: 'W48-2024', date: '2024-12-01', price: 8799, bsr: 950, rating: 4.1, reviews: 820 },
      { week: 'W49-2024', date: '2024-12-08', price: 8999, bsr: 920, rating: 4.1, reviews: 835 },
      { week: 'W50-2024', date: '2024-12-15', price: 9199, bsr: 900, rating: 4.2, reviews: 850 },
      { week: 'W51-2024', date: '2024-12-22', price: 8999, bsr: 910, rating: 4.2, reviews: 860 },
      { week: 'W52-2024', date: '2024-12-29', price: 8799, bsr: 895, rating: 4.2, reviews: 870 },
      { week: 'W01-2025', date: '2025-01-05', price: 8999, bsr: 890, rating: 4.2, reviews: 880 },
      { week: 'W02-2025', date: '2025-01-12', price: 9199, bsr: 885, rating: 4.2, reviews: 885 },
      { week: 'W03-2025', date: '2025-01-19', price: 8999, bsr: 890, rating: 4.2, reviews: 890 },
    ],
  },
  {
    id: '3',
    asinCode: 'B07DEF789',
    sku: 'SKU-YM-003',
    title: 'Premium Yoga Mat - Non-Slip Exercise Mat',
    imageUrl: 'https://placehold.co/100x100?text=Yoga',
    brand: 'FitLife',
    category: 'Sports',
    currentPrice: 1299,
    bsr: 3200,
    rating: 4.8,
    reviewCount: 3200,
    buyBoxWin: true,
    couponDetails: '₹50 Off',
    dealDetails: 'None',
    totalOffers: 22,
    imagesCount: 6,
    hasAplus: false,
    descLength: 280,
    lqs: 68,
    status: 'Active',
    weekHistory: [
      { week: 'W48-2024', date: '2024-12-01', price: 1199, bsr: 3500, rating: 4.7, reviews: 3050 },
      { week: 'W49-2024', date: '2024-12-08', price: 1299, bsr: 3400, rating: 4.7, reviews: 3080 },
      { week: 'W50-2024', date: '2024-12-15', price: 1299, bsr: 3350, rating: 4.7, reviews: 3100 },
      { week: 'W51-2024', date: '2024-12-22', price: 1399, bsr: 3300, rating: 4.7, reviews: 3120 },
      { week: 'W52-2024', date: '2024-12-29', price: 1299, bsr: 3250, rating: 4.8, reviews: 3140 },
      { week: 'W01-2025', date: '2025-01-05', price: 1199, bsr: 3220, rating: 4.8, reviews: 3160 },
      { week: 'W02-2025', date: '2025-01-12', price: 1299, bsr: 3210, rating: 4.8, reviews: 3180 },
      { week: 'W03-2025', date: '2025-01-19', price: 1299, bsr: 3200, rating: 4.8, reviews: 3200 },
    ],
  },
  {
    id: '4',
    asinCode: 'B07GHI012',
    sku: 'SKU-KT-004',
    title: 'Kitchen Scale Digital - Precision Food Scale',
    imageUrl: 'https://placehold.co/100x100?text=Scale',
    brand: 'HomeChef',
    category: 'Home & Kitchen',
    currentPrice: 799,
    bsr: 4500,
    rating: 4.3,
    reviewCount: 4500,
    buyBoxWin: false,
    couponDetails: 'None',
    dealDetails: 'None',
    totalOffers: 35,
    imagesCount: 8,
    hasAplus: true,
    descLength: 420,
    lqs: 78,
    status: 'Active',
    weekHistory: [
      { week: 'W48-2024', date: '2024-12-01', price: 699, bsr: 4800, rating: 4.2, reviews: 4300 },
      { week: 'W49-2024', date: '2024-12-08', price: 799, bsr: 4700, rating: 4.2, reviews: 4350 },
      { week: 'W50-2024', date: '2024-12-15', price: 849, bsr: 4650, rating: 4.3, reviews: 4400 },
      { week: 'W51-2024', date: '2024-12-22', price: 799, bsr: 4600, rating: 4.3, reviews: 4420 },
      { week: 'W52-2024', date: '2024-12-29', price: 749, bsr: 4550, rating: 4.3, reviews: 4440 },
      { week: 'W01-2025', date: '2025-01-05', price: 799, bsr: 4520, rating: 4.3, reviews: 4460 },
      { week: 'W02-2025', date: '2025-01-12', price: 849, bsr: 4510, rating: 4.3, reviews: 4480 },
      { week: 'W03-2025', date: '2025-01-19', price: 799, bsr: 4500, rating: 4.3, reviews: 4500 },
    ],
  },
  {
    id: '5',
    asinCode: 'B07JKL345',
    sku: 'SKU-SP-005',
    title: 'Security Camera 1080P - Wireless Home Security',
    imageUrl: 'https://placehold.co/100x100?text=Camera',
    brand: 'SecureHome',
    category: 'Electronics',
    currentPrice: 3499,
    bsr: 1850,
    rating: 4.1,
    reviewCount: 1850,
    buyBoxWin: true,
    couponDetails: '₹200 Off',
    dealDetails: 'Prime Deal',
    totalOffers: 12,
    imagesCount: 9,
    hasAplus: true,
    descLength: 680,
    lqs: 82,
    status: 'Active',
    weekHistory: [
      { week: 'W48-2024', date: '2024-12-01', price: 3299, bsr: 2000, rating: 4.0, reviews: 1750 },
      { week: 'W49-2024', date: '2024-12-08', price: 3499, bsr: 1950, rating: 4.0, reviews: 1770 },
      { week: 'W50-2024', date: '2024-12-15', price: 3699, bsr: 1900, rating: 4.1, reviews: 1790 },
      { week: 'W51-2024', date: '2024-12-22', price: 3499, bsr: 1880, rating: 4.1, reviews: 1805 },
      { week: 'W52-2024', date: '2024-12-29', price: 3299, bsr: 1860, rating: 4.1, reviews: 1820 },
      { week: 'W01-2025', date: '2025-01-05', price: 3499, bsr: 1855, rating: 4.1, reviews: 1830 },
      { week: 'W02-2025', date: '2025-01-12', price: 3699, bsr: 1852, rating: 4.1, reviews: 1840 },
      { week: 'W03-2025', date: '2025-01-19', price: 3499, bsr: 1850, rating: 4.1, reviews: 1850 },
    ],
  },
];

const AsinManagerPage = () => {
  const { isAdmin, isGlobalUser } = useAuth();
  const [asins, setAsins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDashboard, setShowDashboard] = useState(true);
  const [showTable, setShowTable] = useState(true);
  const [newAsin, setNewAsin] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [error, setError] = useState(null);
  const [scrapingIds, setScrapingIds] = useState(new Set());
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [scrapeProgress, setScrapeProgress] = useState(null);
  const socket = useSocket();
  const [selectedAsin, setSelectedAsin] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [sellers, setSellers] = useState([]);
  const [selectedSellerId, setSelectedSellerId] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAsinForPrice, setSelectedAsinForPrice] = useState(null);
  const [selectedAsinForBsr, setSelectedAsinForBsr] = useState(null);
  const [selectedAsinForRating, setSelectedAsinForRating] = useState(null);
  const [showAllPriceHistory, setShowAllPriceHistory] = useState(false);
  const [showAllBsrHistory, setShowAllBsrHistory] = useState(false);
  const [showAllRatingHistory, setShowAllRatingHistory] = useState(false);
  const [allAsins, setAllAsins] = useState([]);
  const [selectedSeller, setSelectedSeller] = useState('');

  // Filter asins based on search query
  const filteredAsins = useMemo(() => {
    if (!searchQuery.trim()) return asins;
    const query = searchQuery.toLowerCase().trim();
    return asins.filter(asin => {
      const asinCode = asin.asinCode?.toLowerCase() || '';
      const title = asin.title?.toLowerCase() || '';
      const sku = asin.sku?.toLowerCase() || '';
      return asinCode.includes(query) || title.includes(query) || sku.includes(query);
    });
  }, [asins, searchQuery]);

  // CSV Upload handler
  const handleCsvUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedSellerId) {
      alert('Please select a file and seller');
      return;
    }

    setUploading(true);
    try {
      const result = await asinApi.importCsv(file, selectedSellerId);
      alert(`Imported ${result.inserted} ASINs. ${result.duplicates} duplicates skipped.`);
      setShowUploadModal(false);
      loadData();
    } catch (err) {
      alert('Import failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleViewAsin = (asin) => {
    setSelectedAsin(asin);
    setShowDetailModal(true);
  };

  const handleViewTrends = (asin, metric = 'price') => {
    setSelectedAsin(asin);
    setTrendsMetric(metric);
    setShowTrendsModal(true);
  };

  const handleViewPrice = (asin, e) => {
    e.stopPropagation();
    setSelectedAsinForPrice(asin);
  };

  const handleViewBsr = (asin, e) => {
    e.stopPropagation();
    setSelectedAsinForBsr(asin);
  };

  const handleViewRating = (asin, e) => {
    e.stopPropagation();
    setSelectedAsinForRating(asin);
  };

  const loadData = useCallback(async (page = 1, limit = pagination.limit, seller = selectedSeller) => {
    try {
      setLoading(true);

      // Only fetch paginated data and stats - NOT all data (optimization)
      const [asinRes, statsRes] = await Promise.all([
        asinApi.getAll({
          page,
          limit,
          seller,
          sortBy: 'lastScraped',
          sortOrder: 'desc'
        }),
        asinApi.getStats({ seller })
      ]);

      setAsins(asinRes?.asins || []);
      setPagination(asinRes?.pagination || { page: 1, limit: limit, total: 0, totalPages: 0 });
      setStats(statsRes);
      setError(null);
    } catch (err) {
      console.error('Error fetching ASINs:', err);
      setError(err.message);
      setAsins(demoAsins);
    } finally {
      setLoading(false);
    }
  }, [pagination.limit, selectedSeller]);



  const handleChangePage = (event, newPage) => {
    // MUI uses 0-indexed pages, API uses 1-indexed
    loadData(newPage + 1, pagination.limit);
  };

  const handleChangeRowsPerPage = (event) => {
    const newLimit = parseInt(event.target.value, 10);
    // Reset to first page when limit changes
    loadData(1, newLimit);
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!socket) return;
    socket.on('scrape_progress', (data) => {
      setScrapeProgress(data);
      if (data.status === 'Complete') {
        setTimeout(() => {
          setScrapeProgress(null);
          loadData(pagination.page);
        }, 3000);
      }
    });

    socket.on('scrape_data_ingested', (data) => {
      console.log('📬 Data ingested via socket, refreshing table...', data);
      // Refresh first page to show the most recent data
      loadData(1);
    });

    return () => {
      socket.off('scrape_progress');
      socket.off('scrape_data_ingested');
    };
  }, [socket, loadData, pagination.page]);

  useEffect(() => {
    const fetchSellers = async () => {
      try {
        const response = await sellerApi.getAll();
        const sellerList = response?.data?.sellers || response?.data || response?.sellers || [];
        setSellers(Array.isArray(sellerList) ? sellerList : []);
      } catch (err) {
        console.error('Error fetching sellers:', err);
      }
    };

    fetchSellers();
  }, []);

  const kpis = useMemo(() => {
    if (stats) {
      // Review analysis for display
      const reviewChange = stats.reviewAnalysis?.currentVsPreviousChange || 0;
      const reviewTrend = reviewChange >= 0 ? '↑' : '↓';
      const reviewColor = reviewChange >= 0 ? '#10b981' : '#ef4444';

      // Best selling ASIN (lowest BSR)
      const bestSeller = stats.bestSellingAsins?.[0];

      return [
        { label: 'ALL ASINS', value: stats.total || 0, color: '#6366f1', icon: <Package size={14} /> },
        { label: 'AVG LQS', value: (stats.avgLQS || 0) + '%', color: '#10b981', icon: <Activity size={14} /> },
        {
          label: 'BEST SELLER',
          value: bestSeller ? `#${bestSeller.bsr?.toLocaleString()}` : '-',
          sub: bestSeller?.asinCode || '',
          color: '#f59e0b',
          icon: <Trophy size={14} />,
          onClick: () => { setShowAllBsrHistory(true); }
        },
        {
          label: 'TOTAL REVIEWS',
          value: (stats.totalReviews || 0).toLocaleString(),
          color: '#8b5cf6',
          icon: <Star size={14} />,
          onClick: () => { setShowAllRatingHistory(true); }
        },
        {
          label: 'REVIEWS (7 DAYS)',
          value: `${reviewTrend} ${Math.abs(reviewChange)}%`,
          color: reviewColor,
          icon: <TrendingUp size={14} />,
          sub: `Current: ${stats.reviewAnalysis?.currentWeek || 0} vs Previous: ${stats.reviewAnalysis?.previousWeek || 0}`
        },
        {
          label: 'AVG PRICE',
          value: '₹' + (stats.avgPrice || 0).toLocaleString(),
          color: '#06b6d4',
          icon: <IndianRupee size={14} />,
          onClick: () => { setShowAllPriceHistory(true); }
        },
        { label: 'AVG IMAGES', value: stats.avgImages || 0, color: '#ec4899', icon: <Image size={14} /> },
        { label: 'AVG BULLETS', value: stats.avgBullets || 0, color: '#8b5cf6', icon: <ListChecks size={14} /> },
      ];
    }

    const total = asins.length;
    const avgLqs = total > 0 ? Math.round(asins.reduce((sum, a) => sum + (a.lqs || 0), 0) / total) : 0;
    const buyBoxWins = asins.filter(a => a.buyBoxWin).length;
    const buyBoxRate = total > 0 ? Math.round((buyBoxWins / total) * 100) : 0;
    const lowLqs = asins.filter(a => (a.lqs || 0) < 70).length;
    const activeDeals = asins.filter(a => a.dealDetails && a.dealDetails !== 'None').length;
    const avgPrice = total > 0 ? Math.round(asins.reduce((sum, a) => sum + (a.currentPrice || 0), 0) / total) : 0;

    // return [
    //   { label: 'ALL ASINS', value: total, color: '#6366f1', icon: <Package size={14} /> },
    //   { label: 'AVG LQS', value: avgLqs + '%', color: '#10b981', icon: <Activity size={14} /> },
    //   {
    //     label: 'BUY BOX',
    //     value: buyBoxRate + '%',
    //     color: '#f59e0b',
    //     icon: <Trophy size={14} />,
    //     onClick: () => { setShowAllBsrHistory(true); }
    //   },
    //   {
    //     label: 'LOW LQS',
    //     value: lowLqs,
    //     color: '#ef4444',
    //     icon: <AlertTriangle size={14} />,
    //     onClick: () => { setShowAllRatingHistory(true); }
    //   },
    //   { label: 'DEALS', value: activeDeals, color: '#8b5cf6', icon: <Zap size={14} /> },
    //   {
    //     label: 'AVG PRICE',
    //     value: '₹' + avgPrice.toLocaleString(),
    //     color: '#06b6d4',
    //     icon: <IndianRupee size={14} />,
    //     onClick: () => { setShowAllPriceHistory(true); }
    //   },
    //   { label: 'AVG IMAGES', value: Math.round(asins.reduce((sum, a) => sum + (a.imagesCount || 0), 0) / (asins.length || 1)), color: '#ec4899', icon: <Image size={14} /> },
    //   { label: 'AVG BULLETS', value: Math.round(asins.reduce((sum, a) => sum + (a.bulletPoints || 0), 0) / (asins.length || 1)), color: '#8b5cf6', icon: <ListChecks size={14} /> },
    // ];
  }, [asins, stats]);

  const historyStructure = useMemo(() => {
    if (asins.length > 0) {
      const dateMap = new Map();

      const asinsWithHistory = asins.filter(a => (a.weekHistory && a.weekHistory.length > 0) || (a.history && a.history.length > 0));

      if (asinsWithHistory.length > 0) {
        asinsWithHistory.forEach(asin => {
          const allHistory = [
            ...(asin.weekHistory || []),
            ...(asin.history || [])
          ];

          allHistory.forEach(h => {
            if (h.date) {
              const dateObj = new Date(h.date);
              const dateKey = dateObj.toISOString().split('T')[0];

              const existing = dateMap.get(dateKey);
              if (!existing || new Date(h.date) > new Date(existing.timestamp)) {
                dateMap.set(dateKey, { dateStr: h.date, timestamp: h.date });
              }
            }
          });
        });

        const sortedDates = Array.from(dateMap.keys()).sort();
        return generateHistoryStructureFromDates(sortedDates);
      }
    }
    return [{ label: 'W1', dates: [{ label: 'N/A' }] }];
  }, [asins]);

  const totalHistoryCols = useMemo(() => {
    if (!historyStructure) return 0;
    return historyStructure.reduce((sum, w) => sum + w.dates.length, 0);
  }, [historyStructure]);

  const visibleHistoryCols = useMemo(() => {
    if (!historyStructure) return 0;
    // Since we now always show exactly the entries in historyStructure (7 days)
    return historyStructure.reduce((sum, w) => sum + w.dates.length, 0);
  }, [historyStructure]);

  const handleSync = useCallback(async () => {
    if (!newAsin.trim()) {
      alert('Please enter at least one ASIN');
      return;
    }

    if (!selectedSellerId) {
      alert('Please select a target seller association first.');
      return;
    }

    setSyncing(true);
    try {
      const asinList = newAsin.split(/[,\s]+/).map(a => a.trim().toUpperCase()).filter(a => a.length > 0);

      if (asinList.length === 0) {
        alert('No valid ASINs found.');
        setSyncing(false);
        return;
      }

      const asinsPayload = asinList.map(code => ({
        asinCode: code,
        status: 'Active',
        sellerId: selectedSellerId
      }));

      // Call the bulk API method
      await asinApi.createBulk(asinsPayload);

      // Refresh list
      await loadData();

      alert(`Successfully added ${asinList.length} ASIN(s) to the tracking pool.`);
      setNewAsin('');
      setSelectedSellerId('');
      setShowAddModal(false);

    } catch (error) {
      console.error('Failed to add ASINs:', error);
      alert('Failed to add ASINs: ' + error.message);
    } finally {
      setSyncing(false);
    }
  }, [newAsin, loadData, selectedSellerId]);

  const handleIndividualScrape = async (asinId) => {
    try {
      setScrapingIds(prev => new Set(prev).add(asinId));
      await marketSyncApi.syncAsin(asinId);
      alert('Scraping initiated successfully!');
      loadData();
    } catch (err) {
      console.error('Scrape failed:', err);
      alert('Failed to start scraping: ' + err.message);
    } finally {
      setScrapingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(asinId);
        return newSet;
      });
    }
  };

  const handleCreateTasks = async (asinId, asinCode) => {
    try {
      if (!window.confirm(`Auto-generate optimization tasks for ASIN ${asinCode}?`)) return;
      const res = await db.createActionsFromAnalysis(asinId);
      if (res && res.count > 0) {
        alert(`✅ Successfully created ${res.count} optimization task(s) for ${asinCode}!`);
      } else if (res && res.success === false) {
        alert(`❌ Error: ${res.message || 'Failed to create tasks'}`);
      } else {
        alert(`Analysis complete for ${asinCode}. No critical tasks needed at this time.`);
      }
    } catch (err) {
      console.error('Task creation failed:', err);
      alert('Failed to create tasks: ' + err.message);
    }
  };

  const handleGenerateAiImages = async (asinId, asinCode) => {
    try {
      if (!window.confirm(`Generate AI lifestyle images for ASIN ${asinCode}? This uses Nvidia NIM (SD3 Medium).`)) return;

      setScrapingIds(prev => new Set(prev).add(asinId));
      const res = await asinApi.generateImages(asinId);

      if (res.success) {
        alert(`✅ AI Image Generated!\nView it at: ${res.imageUrl}`);
        // Refresh ASIN data to show updated action status if needed
        loadData();
      } else {
        alert(`❌ Generation failed: ${res.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('AI Image generation failed:', err);
      alert('AI Generation Error: ' + (err.response?.data?.error || err.message));
    } finally {
      setScrapingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(asinId);
        return newSet;
      });
    }
  };

  const handleBulkScrape = async () => {
    const totalCount = stats?.total || asins.length;

    // Quick confirmation for global heavy action
    if (!window.confirm(`Force-sync and refresh all ${totalCount} ASINs? This starts concurrent Octoparse tasks in the background.`)) return;

    try {
      setSyncing(true);

      // 1. Trigger concurrent background scrapes in Octoparse
      await marketSyncApi.syncAll();

      // 2. Refresh current local database data in UI
      await loadData(pagination.page);

      alert(`✅ Success: Sync initiated for all ${totalCount} ASINs. Background scrapes are now running concurrently.`);
    } catch (err) {
      console.error('Bulk scrape failed:', err);
      alert('❌ Failed to start bulk scraping: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleBulkCreateActions = async () => {
    try {
      if (!window.confirm('Auto-generate optimization tasks for all ASINs?')) return;
      const res = await db.createBulkActionsFromAnalysis();
      if (res && res.count > 0) {
        alert(`✅ Successfully generated ${res.count} bulk optimization tasks!`);
      } else if (res && res.success === false) {
        alert(`❌ Error: ${res.message || 'Failed to create tasks'}`);
      } else {
        alert('Analysis complete. All ASINs look good! No optimization actions needed.');
      }
    } catch (err) {
      console.error('Bulk task creation failed:', err);
      alert('Failed to create bulk tasks: ' + err.message);
    }
  };

  const getLqsBadge = (lqs) => {
    let bgColor = '#059669';
    let textColor = '#fff';
    if (lqs < 60) { bgColor = '#dc2626'; }
    else if (lqs < 80) { bgColor = '#d97706'; }
    return (
      <span
        className="badge"
        style={{ backgroundColor: bgColor, color: textColor, fontWeight: 600, fontSize: '0.75rem' }}
      >
        {lqs}
      </span>
    );
  };

  const getBuyBoxBadge = (buyBoxWin, status) => {
    if (status === 'Scraping') return <span style={{ color: '#9ca3af' }}>-</span>;
    const bgColor = buyBoxWin ? '#059669' : '#6b7280';
    return (
      <span
        className="badge"
        style={{ backgroundColor: bgColor, color: '#fff', fontWeight: 600, fontSize: '0.75rem' }}
      >
        {buyBoxWin ? 'Won' : 'Lost'}
      </span>
    );
  };

  const getAplusBadge = (hasAplus, status) => {
    if (status === 'Scraping') return <span style={{ color: '#9ca3af' }}>-</span>;
    const bgColor = hasAplus ? '#059669' : '#6b7280';
    return (
      <span
        className="badge"
        style={{ backgroundColor: bgColor, color: '#fff', fontWeight: 600, fontSize: '0.75rem' }}
      >
        {hasAplus ? 'Yes' : 'No'}
      </span>
    );
  };

  const getStatusBadge = (status) => {
    const bgColor = status === 'Active' ? '#059669' : '#d97706';
    return (
      <span
        className="badge"
        style={{ backgroundColor: bgColor, color: '#fff', fontWeight: 600, fontSize: '0.75rem' }}
      >
        {status}
      </span>
    );
  };

  const renderRatingBreakdown = (breakdown) => {
    if (!breakdown || (!breakdown.fiveStar && !breakdown.fourStar && !breakdown.threeStar && !breakdown.twoStar && !breakdown.oneStar)) {
      return <span style={{ color: '#9ca3af' }}>-</span>;
    }

    // Mini horizontal bar chart showing star distribution
    const stars = [
      { key: 'fiveStar', label: '5', color: '#22c55e' },
      { key: 'fourStar', label: '4', color: '#84cc16' },
      { key: 'threeStar', label: '3', color: '#eab308' },
      { key: 'twoStar', label: '2', color: '#f97316' },
      { key: 'oneStar', label: '1', color: '#ef4444' }
    ];

    return (
      <div className="d-flex flex-column gap-1" style={{ width: '50px' }}>
        {stars.slice(0, 3).map(star => {
          const pct = breakdown[star.key] || 0;
          return (
            <div key={star.key} className="d-flex align-items-center gap-1">
              <span className="text-muted" style={{ fontSize: '0.6rem', width: '10px' }}>{star.label}★</span>
              <div style={{ flex: 1, height: '4px', backgroundColor: '#e5e7eb', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', backgroundColor: star.color, borderRadius: '2px' }} />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Collapsible Section Component - Zinc Redesign
  const CollapsibleSection = ({ title, icon: Icon, isOpen, onToggle, children, badge }) => (
    <div className="bg-white border border-zinc-200 rounded-4 shadow-sm mb-4 overflow-hidden">
      <div
        onClick={onToggle}
        className="px-4 py-3 d-flex align-items-center justify-content-between cursor-pointer transition-all"
        style={{ background: isOpen ? '#fff' : '#fcfcfc', borderBottom: isOpen ? '1px solid #f1f5f9' : 'none' }}
      >
        <div className="d-flex align-items-center gap-3">
          <div className="d-flex align-items-center justify-content-center rounded-2" style={{
            width: '28px', height: '28px',
            background: '#f8fafc', color: '#64748b'
          }}>
            <Icon size={14} />
          </div>
          <span className="smallest fw-bold text-zinc-900 text-uppercase tracking-wider">
            {title}
          </span>
          {badge && (
            <span className="badge rounded-pill bg-zinc-900 text-white smallest px-2">
              {badge}
            </span>
          )}
        </div>
        <div className="text-zinc-400">
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>
      {isOpen && <div className="p-4" style={{ background: '#fff' }}>{children}</div>}
    </div>
  );

  if (loading && asins.length === 0) {
    return <PageLoader message="Loading ASIN Manager..." />;
  }

  if (loading && asins.length > 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', backgroundColor: '#f9fafb' }}>
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}>
          <LoadingIndicator type="line-simple" size="md" />
        </div>
        <div className="page-header" style={{ padding: '1.5rem 2rem', background: '#fff', borderBottom: '1px solid #e5e7eb' }}>
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
            <div>
              <h1 className="page-title mb-1">ASIN Manager</h1>
              <p className="text-muted small mb-0">Operational Inventory tracking & Listing Quality Metrics</p>
            </div>
          </div>
        </div>
        <div className="page-content py-5 d-flex flex-column align-items-center justify-content-center" style={{ flex: 1 }}>
          {error ? (
            <div className="alert alert-warning border-0 shadow-sm rounded-4 mx-4" role="alert">
              <AlertTriangle className="me-2" size={18} />
              {error} - Showing demo data
            </div>
          ) : (
            <div className="d-flex flex-column justify-content-center align-items-center">
              <RefreshCw className="text-primary spin mb-3" size={40} />
              <p className="text-muted fw-500">Synchronizing Operation Data...</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (asins.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', backgroundColor: '#f9fafb' }}>
        <div className="page-header" style={{ padding: '1.5rem 2rem', background: '#fff', borderBottom: '1px solid #e5e7eb' }}>
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
            <div>
              <h1 className="page-title mb-1">ASIN Manager</h1>
              <p className="text-muted small mb-0">Operational Inventory tracking & Listing Quality Metrics</p>
            </div>
            <div className="d-flex gap-2">
              <button className="btn btn-zinc-900 btn-sm shadow-sm border-0 d-flex align-items-center gap-2 px-4 rounded-pill" onClick={() => setShowAddModal(true)} style={{ backgroundColor: '#18181B', color: '#fff' }}>
                <Plus size={16} />
                <span className="fw-bold">Add ASIN</span>
              </button>
            </div>
          </div>
        </div>
        <div className="page-content" style={{ flex: 1 }}>
          <EmptyState
            icon={Package}
            title="No ASINs tracked"
            description="Add ASINs to start monitoring listings, LQS scores, and performance metrics."
            action={{ label: 'Add ASINs', onClick: () => setShowAddModal(true) }}
          />
        </div>
      </div>
    );
  }

  const thStyle = {
    fontSize: '0.68rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: '#6b7280',
    padding: '6px 8px',
    background: '#f3f4f6',
    position: 'sticky',
    top: 0,
    zIndex: 10,
    whiteSpace: 'nowrap',
    border: '1px solid #e5e7eb'
  };

  const tdStyle = {
    padding: '5px 8px',
    fontSize: '0.75rem',
    borderBottom: '1px solid #f3f4f6',
    verticalAlign: 'middle',
    color: '#374151',
    height: '38px',
    borderLeft: '1px solid #f3f4f6',
    borderRight: '1px solid #f3f4f6'
  };

  const actionBtnStyle = {
    padding: '2px 8px',
    fontSize: '10px',
    fontWeight: '600',
    height: '24px',
    borderRadius: '12px'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', backgroundColor: '#f9fafb' }}>
      {loading && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}>
          <LoadingIndicator type="line-simple" size="md" />
        </div>
      )}

      <div className="page-header" style={{ padding: '1.5rem 2rem', background: '#fff', borderBottom: '1px solid #e5e7eb' }}>
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
          <div>
            <h1 className="page-title mb-1">ASIN Manager</h1>
            <p className="text-muted small mb-0">Operational Inventory tracking & Listing Quality Metrics</p>
          </div>
          <div className="d-flex gap-2">
            <div className="position-relative">
              <Search className="position-absolute top-50 start-0 translate-middle-y ms-3 text-muted" size={14} />
              <input
                type="text"
                className="form-control form-control-sm ps-5 bg-white border border-zinc-200 shadow-none rounded-3 smallest"
                placeholder="Search ASIN, SKU or Product..."
                style={{ width: '280px', height: '36px' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              className="form-select form-select-sm border-zinc-200 rounded-3 smallest fw-semibold text-zinc-600 shadow-none"
              style={{ width: '180px', height: '36px' }}
              value={selectedSeller}
              onChange={(e) => {
                setSelectedSeller(e.target.value);
                loadData(1, pagination.limit, e.target.value);
              }}
            >
              <option value="">All Sellers</option>
              {sellers.map(s => (
                <option key={s._id} value={s._id}>{s.name || s.storeName || s._id}</option>
              ))}
            </select>
            <button
              className="btn btn-white btn-sm shadow-sm border border-zinc-200 d-flex align-items-center gap-2 rounded-pill px-3"
              onClick={handleBulkScrape}
              disabled={syncing}
            >
              <RefreshCw size={16} className={`text-zinc-500 ${syncing ? 'spin' : ''}`} />
              <span className="fw-bold text-zinc-700">Sync All</span>
            </button>
            <button
              className="btn btn-white btn-sm shadow-sm border border-zinc-200 d-flex align-items-center gap-2 rounded-pill px-3"
              onClick={() => setShowUploadModal(true)}
            >
              <FileUp size={16} className="text-zinc-500" />
              <span className="fw-bold text-zinc-700">Upload CSV</span>
            </button>
            <button
              className="btn btn-zinc-900 btn-sm shadow-sm border-0 d-flex align-items-center gap-2 px-4 rounded-pill"
              onClick={() => setShowAddModal(true)}
              style={{ backgroundColor: '#18181B', color: '#fff' }}
            >
              <Plus size={16} />
              <span className="fw-bold">Add ASIN</span>
            </button>
          </div>
        </div>
      </div>

      <div className="page-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '1.5rem 2rem' }}>



        {/* [H] Error Banner */}
        {error && (
          <div className="alert alert-warning border-0 shadow-sm rounded-3 py-2 px-3 mb-3 d-flex align-items-center gap-2 smallest" role="alert">
            <AlertTriangle size={14} className="text-warning" />
            <span className="fw-medium">{error} — Showing cached data</span>
          </div>
        )}

        {/* [G] Scrape Progress Banner */}
        {scrapeProgress && (
          <div className="bg-blue-50 border border-blue-100 rounded-3 py-2 px-3 mb-3 d-flex align-items-center gap-3 flex-shrink-0">
            <RefreshCw size={14} className="text-blue-600 spin" />
            <span className="fw-bold text-blue-700 smallest">Live Sync</span>
            <span className="text-blue-600 smallest font-monospace">{scrapeProgress.processed}/{scrapeProgress.total} ASINs</span>
            <div className="flex-grow-1">
              <ProgressBar value={(scrapeProgress.processed / scrapeProgress.total) * 100} color="primary" size="xs" />
            </div>
            <span className="text-muted smallest fw-medium">{scrapeProgress.status}</span>
          </div>
        )}

        {/* [C] KPI Strip */}
        <div className="bg-white border border-zinc-200 rounded-4 shadow-sm mb-4 flex-shrink-0" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(8, 1fr)',
          overflow: 'hidden'
        }}>
          {kpis.map((kpi, idx) => (
            <div key={idx}
              onClick={kpi.onClick}
              className="p-3 transition-all"
              style={{
                borderRight: idx < 7 ? '1px solid #f1f5f9' : 'none',
                display: 'flex', flexDirection: 'column', gap: 4,
                cursor: kpi.onClick ? 'pointer' : 'default',
                background: kpi.onClick ? '#fdfdfd' : '#fff'
              }}
              onMouseEnter={(e) => kpi.onClick && (e.currentTarget.style.background = '#f8fafc')}
              onMouseLeave={(e) => kpi.onClick && (e.currentTarget.style.background = kpi.onClick ? '#fdfdfd' : '#fff')}
            >
              <div className="d-flex align-items-center gap-2">
                <div className="d-flex align-items-center justify-content-center rounded-2" style={{
                  width: '24px', height: '24px',
                  background: kpi.color + '15', color: kpi.color
                }}>
                  {kpi.icon}
                </div>
                <span className="smallest fw-bold text-zinc-400 text-uppercase tracking-wider">
                  {kpi.label}
                </span>
              </div>
              <div className="d-flex align-items-baseline gap-2 mt-1">
                <span className="h5 mb-0 fw-bold text-zinc-900" style={{ letterSpacing: '-0.02em' }}>
                  {kpi.value}
                </span>
                {kpi.sub && <span className="smallest text-zinc-400 fw-medium">{kpi.sub}</span>}
              </div>
            </div>
          ))}
        </div>



        {/* [E] High-Density Table Area */}
        <div className="bg-white border border-zinc-200 rounded-4 shadow-sm overflow-hidden flex-grow-1 d-flex flex-column">
          {/* Table Toolbar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 20px', background: '#fff', borderBottom: '1px solid #e5e7eb',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>
                INVENTORY & PERFORMANCE LEDGER
                <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 10, background: '#eff6ff', color: '#2563eb', fontSize: 10 }}>
                  {pagination.total} SKUs
                </span>
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button onClick={handleBulkCreateActions} disabled={asins.length === 0}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
                  fontSize: 10, fontWeight: 600, borderRadius: 4, border: '1px solid #e5e7eb',
                  background: '#fff', cursor: 'pointer'
                }}>
                <Zap size={10} color="#f59e0b" /> Bulk Action
              </button>
              <button
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
                  fontSize: 10, fontWeight: 600, borderRadius: 4, border: '1px solid #e5e7eb',
                  background: '#fff', cursor: 'pointer'
                }}>
                <Download size={10} color="#2563eb" /> Export
              </button>
            </div>
          </div>

          {/* Scrollable Table Container */}
          <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
            <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 20 }}>
                <tr>
                  <th rowSpan={2} style={{ ...thStyle, width: '100px', left: 0, zIndex: 21 }}>ASIN</th>
                  <th rowSpan={2} style={{ ...thStyle, width: '120px' }}>Owner/BB</th>
                  <th rowSpan={2} style={{ ...thStyle, width: '100px' }}>SKU</th>
                  <th rowSpan={2} style={{ ...thStyle, width: '280px' }}>Product</th>
                  <th rowSpan={2} style={{ ...thStyle, width: '80px', textAlign: 'right' }}>Price</th>
                  <th colSpan={visibleHistoryCols}
                    onClick={async () => { setShowAllPriceHistory(true); }}
                    style={{ ...thStyle, background: '#eef2ff', color: '#4338ca', textAlign: 'center', cursor: 'pointer' }}>
                    Price Trend (7 Days) <Eye size={10} style={{ marginLeft: 4 }} />
                  </th>
                  <th rowSpan={2} style={{ ...thStyle, width: '70px', textAlign: 'center' }}>BSR</th>
                  <th colSpan={visibleHistoryCols}
                    onClick={async () => { setShowAllBsrHistory(true); }}
                    style={{ ...thStyle, background: '#f0fdf4', color: '#166534', textAlign: 'center', cursor: 'pointer' }}>
                    BSR Trend (7 Days) <Eye size={10} style={{ marginLeft: 4 }} />
                  </th>
                  <th rowSpan={2} style={{ ...thStyle, width: '50px', textAlign: 'center' }}>Rating</th>
                  <th rowSpan={2} style={{ ...thStyle, width: '60px', textAlign: 'center' }}>Count</th>
                  <th colSpan={visibleHistoryCols}
                    onClick={async () => { setShowAllRatingHistory(true); }}
                    style={{ ...thStyle, background: '#fffbeb', color: '#92400e', textAlign: 'center', cursor: 'pointer' }}>
                    Rating Trend <Eye size={10} style={{ marginLeft: 4 }} />
                  </th>
                  <th rowSpan={2} style={{ ...thStyle, width: '70px', textAlign: 'center' }}>BuyBox</th>
                  <th rowSpan={2} style={{ ...thStyle, width: '40px', textAlign: 'center' }}>Imgs</th>
                  <th rowSpan={2} style={{ ...thStyle, width: '40px', textAlign: 'center' }}>Pts</th>
                  <th rowSpan={2} style={{ ...thStyle, width: '50px', textAlign: 'center' }}>A+</th>
                  <th rowSpan={2} style={{ ...thStyle, width: '100px', textAlign: 'center' }}>Actions</th>
                </tr>
                <tr>
                  {/* Price Trend Dates */}
                  {historyStructure.map(week => week.dates.map((date, idx) => (
                    <th key={`p-h-${idx}`} style={{ ...thStyle, padding: '2px 4px', fontSize: 9, textAlign: 'center', background: '#eef2ff', color: '#6366f1' }}>
                      {date.label}
                    </th>
                  )))}
                  {/* BSR Trend Dates */}
                  {historyStructure.map(week => week.dates.map((date, idx) => (
                    <th key={`b-h-${idx}`} style={{ ...thStyle, padding: '2px 4px', fontSize: 9, textAlign: 'center', background: '#f0fdf4', color: '#16a34a' }}>
                      {date.label}
                    </th>
                  )))}
                  {/* Rating Trend Dates */}
                  {historyStructure.map(week => week.dates.map((date, idx) => (
                    <th key={`r-h-${idx}`} style={{ ...thStyle, padding: '2px 4px', fontSize: 9, textAlign: 'center', background: '#fffbeb', color: '#b45309' }}>
                      {date.label}
                    </th>
                  )))}
                </tr>
              </thead>
              <tbody>
                {filteredAsins.map((asin, idx) => (
                  <tr key={asin._id || idx} className="table-row-hover" style={{
                    background: idx % 2 === 0 ? '#fff' : '#f9fafb'
                  }}>
                    <td style={{
                      ...tdStyle,
                      fontWeight: 600,
                      color: '#2563eb',
                      cursor: 'pointer',
                      position: 'sticky',
                      left: 0,
                      background: idx % 2 === 0 ? '#fff' : '#f9fafb',
                      zIndex: 5,
                      borderRight: '2px solid #e5e7eb'
                    }}
                      onClick={() => handleViewAsin(asin)}>
                      {asin.asinCode}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <span style={{ fontWeight: 600, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                          {asin.seller?.name || asin.seller || 'Global'}
                        </span>
                        <span style={{ fontSize: 9, color: '#9ca3af' }}>{asin.soldBy || '-'}</span>
                      </div>
                    </td>
                    <td style={tdStyle}>{asin.sku || '-'}</td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <img src={asin.imageUrl} alt="" style={{ width: 20, height: 20, borderRadius: 3, objectFit: 'cover' }} />
                        <span style={{
                          whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden',
                          fontSize: 11, cursor: 'pointer'
                        }} onClick={() => handleViewAsin(asin)} title={asin.title}>
                          {asin.title}
                        </span>
                      </div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#16a34a', cursor: 'pointer' }}
                      onClick={(e) => handleViewPrice(asin, e)}>
                      ₹{(asin.uploadedPrice || asin.currentPrice || 0).toLocaleString()}
                    </td>
                    {historyStructure.map(week => week.dates.map((date, dIdx) => {
                      const wData = asin.weekHistory?.find(w => new Date(w.date).toISOString().split('T')[0] === date.raw)
                        || asin.history?.find(h => new Date(h.date).toISOString().split('T')[0] === date.raw);
                      return (
                        <td key={`p-${week.label}-${dIdx}`}
                          onClick={(e) => handleViewPrice(asin, e)}
                          style={{ ...tdStyle, textAlign: 'center', background: '#f5f3ff33', width: 40, cursor: 'pointer' }}>
                          {wData?.price ? getWeekHistoryBadge(wData.price, 'price') : '-'}
                        </td>
                      );
                    }))}
                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600, color: '#2563eb', cursor: 'pointer' }}
                      onClick={(e) => handleViewBsr(asin, e)}>
                      {asin.bsr ? `#${asin.bsr.toLocaleString()}` : '-'}
                    </td>
                    {historyStructure.map(week => week.dates.map((date, dIdx) => {
                      const wData = asin.weekHistory?.find(w => new Date(w.date).toISOString().split('T')[0] === date.raw)
                        || asin.history?.find(h => new Date(h.date).toISOString().split('T')[0] === date.raw);
                      return (
                        <td key={`b-${week.label}-${dIdx}`}
                          onClick={(e) => handleViewBsr(asin, e)}
                          style={{ ...tdStyle, textAlign: 'center', background: '#f0fdf433', width: 40, cursor: 'pointer' }}>
                          {wData?.bsr ? getWeekHistoryBadge(wData.bsr, 'number') : '-'}
                        </td>
                      );
                    }))}
                    <td style={{ ...tdStyle, textAlign: 'center', cursor: 'pointer' }}
                      onClick={(e) => handleViewRating(asin, e)}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                        <Star size={10} className="text-warning fill-warning" />
                        <span style={{ fontWeight: 600 }}>
                          {typeof asin.rating === 'number' ? asin.rating.toFixed(1) : (asin.rating || '-')}
                        </span>
                      </div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center', color: '#6b7280', fontWeight: 500 }}>
                      {(asin.reviewCount || 0).toLocaleString()}
                    </td>
                    {historyStructure.map(week => week.dates.map((date, dIdx) => {
                      const wData = asin.weekHistory?.find(w => new Date(w.date).toISOString().split('T')[0] === date.raw)
                        || asin.history?.find(h => new Date(h.date).toISOString().split('T')[0] === date.raw);
                      return (
                        <td key={`r-${week.label}-${dIdx}`}
                          onClick={(e) => handleViewRating(asin, e)}
                          style={{ ...tdStyle, textAlign: 'center', background: '#fffbeb33', width: 40, cursor: 'pointer' }}>
                          {wData?.rating ? getWeekHistoryBadge(wData.rating, 'rating') : '-'}
                        </td>
                      );
                    }))}
                    <td style={{ ...tdStyle, textAlign: 'center' }}>{getBuyBoxBadge(asin.buyBoxWin, asin.status)}</td>
                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600 }}>{asin.imagesCount || 0}</td>
                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600 }}>{asin.bulletPoints || 0}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>{getAplusBadge(asin.hasAplus, asin.status)}</td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                        <button onClick={() => handleIndividualScrape(asin._id)} disabled={scrapingIds.has(asin._id)}
                          style={{
                            padding: '2px 8px', fontSize: 10, fontWeight: 600, borderRadius: 10,
                            border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer'
                          }}>
                          {scrapingIds.has(asin._id) ? <RefreshCw size={10} className="spin" /> : 'Sync'}
                        </button>
                        <button onClick={() => handleCreateTasks(asin._id, asin.asinCode)}
                          style={{
                            padding: '2px 8px', fontSize: 10, fontWeight: 600, borderRadius: 10,
                            border: 'none', background: '#eff6ff', color: '#2563eb', cursor: 'pointer'
                          }}>
                          Task
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* [F] Pagination Footer */}
          <div style={{
            background: '#f9fafb', borderTop: '1px solid #e5e7eb',
            flexShrink: 0
          }}>
            <TablePagination
              component="div"
              count={pagination.total || 0}
              page={(pagination.page || 1) - 1}
              onPageChange={handleChangePage}
              rowsPerPage={pagination.limit || 25}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[25, 50, 100, 150, 200, 300, 500]}
              sx={{
                fontSize: '11px',
                '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#6b7280',
                  margin: 0
                },
                '.MuiTablePagination-select': {
                  fontSize: '11px',
                  fontWeight: 600
                }
              }}
            />
          </div>
        </div>

        {/* [M] Modals Consolidated */}
        {showAddModal && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center',
            justifyContent: 'center', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)'
          }}>
            <div style={{ width: 450, background: '#fff', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between' }}>
                <h5 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Add New ASINs</h5>
                <X size={18} style={{ cursor: 'pointer' }} onClick={() => setShowAddModal(false)} />
              </div>
              <div style={{ padding: 20 }}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 6 }}>ASIN LIST (COMMA SEPARATED)</label>
                  <textarea value={newAsin} onChange={(e) => setNewAsin(e.target.value)}
                    placeholder="B0XXXXXXX, B0YYYYYYY"
                    style={{ width: '100%', padding: 12, borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, height: 80 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 6 }}>ASSOCIATE WITH SELLER</label>
                  <select value={selectedSellerId} onChange={(e) => setSelectedSellerId(e.target.value)}
                    style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12 }}>
                    <option value="">Select Seller...</option>
                    {sellers.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ padding: '12px 20px', background: '#f9fafb', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={() => setShowAddModal(false)}
                  style={{ padding: '6px 16px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid #d1d5db', background: '#fff' }}>
                  Cancel
                </button>
                <button onClick={handleSync} disabled={syncing}
                  style={{ padding: '6px 20px', fontSize: 12, fontWeight: 700, borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff' }}>
                  {syncing ? 'Adding...' : 'Add ASINs'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showUploadModal && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center',
            justifyContent: 'center', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)'
          }}>
            <div style={{ width: 450, background: '#fff', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between' }}>
                <h5 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Upload CSV</h5>
                <X size={18} style={{ cursor: 'pointer' }} onClick={() => setShowUploadModal(false)} />
              </div>
              <div style={{ padding: 20 }}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 6 }}>SELECT SELLER</label>
                  <select value={selectedSellerId} onChange={(e) => setSelectedSellerId(e.target.value)}
                    style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12 }}>
                    <option value="">Select Seller...</option>
                    {sellers.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 6 }}>CSV FILE</label>
                  <input type="file" accept=".csv" onChange={handleCsvUpload}
                    style={{ width: '100%', fontSize: 12 }} />
                </div>
              </div>
              <div style={{ padding: '12px 20px', background: '#f9fafb', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={() => setShowUploadModal(false)}
                  style={{ padding: '6px 16px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid #d1d5db', background: '#fff' }}>
                  Cancel
                </button>
                <button onClick={() => document.querySelector('input[type="file"]')?.click()}
                  disabled={uploading || !selectedSellerId}
                  style={{ padding: '6px 20px', fontSize: 12, fontWeight: 700, borderRadius: 6, border: 'none', background: '#16a34a', color: '#fff' }}>
                  {uploading ? 'Uploading...' : 'Import CSV'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* [N] Secondary Modals */}
      <AsinDetailModal
        asin={selectedAsin}
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
      />
      <PriceViewModal
        selectedAsin={selectedAsinForPrice}
        isOpen={!!selectedAsinForPrice || showAllPriceHistory}
        onClose={() => { setSelectedAsinForPrice(null); setShowAllPriceHistory(false); }}
      />
      <BSRViewModal
        selectedAsin={selectedAsinForBsr}
        isOpen={!!selectedAsinForBsr || showAllBsrHistory}
        onClose={() => { setSelectedAsinForBsr(null); setShowAllBsrHistory(false); }}
      />
      <RatingViewModal
        selectedAsin={selectedAsinForRating}
        isOpen={!!selectedAsinForRating || showAllRatingHistory}
        onClose={() => { setSelectedAsinForRating(null); setShowAllRatingHistory(false); }}
      />
    </div>
  );
};

export default AsinManagerPage;
