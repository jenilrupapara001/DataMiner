import React, { useState, useEffect, useMemo } from 'react';
import { X, Package, IndianRupee, Star, Award, Store, Activity, BarChart3, TrendingUp, TrendingDown, Eye, ExternalLink, Calendar, ListChecks, Image, AlertCircle, Trophy, Sparkles, CheckCircle2, AlertTriangle, Loader2, RefreshCcw } from 'lucide-react';
import { asinApi } from '../services/api';
import Chart from 'react-apexcharts';
import { subDays, endOfDay, format } from 'date-fns';
import AdvancedDateRangePicker from '../contexts/DateRangeContext';
import Popover from './common/Popover';
import DOMPurify from 'dompurify';
import { Modal, Tabs, Card, Row, Col, Progress, Tag, Typography, Button, Divider, Tooltip, Empty, Space } from 'antd';

const { Title, Text, Paragraph } = Typography;

// Helper to get last valid data from history fallback
const getLastValidData = (asin, field, defaultValue = 0) => {
  // First check current field
  if (asin[field] && asin[field] > 0) {
    return { value: asin[field], source: 'current' };
  }

  // Fallback to most recent history with valid data
  const history = asin.history || asin.weekHistory || [];
  if (history.length > 0) {
    const sorted = [...history].sort((a, b) => new Date(b.date || b.week) - new Date(a.date || a.week));
    for (const h of sorted) {
      if (h[field] && h[field] > 0) {
        return { value: h[field], source: 'history', date: h.date || h.week };
      }
    }
  }

  return { value: defaultValue, source: 'none' };
};

const ScoreCard = ({ title, score: rawScore, grade, issues = [], recommendations = [] }) => {
  const parsedIssues = typeof issues === 'string' ? (issues.startsWith('[') ? JSON.parse(issues) : issues.split(',').filter(Boolean)) : (issues || []);
  const parsedRecs = typeof recommendations === 'string' ? (recommendations.startsWith('[') ? JSON.parse(recommendations) : recommendations.split(',').filter(Boolean)) : (recommendations || []);

  // Handle 0-100 scale legacy data
  const score = rawScore > 10 ? parseFloat((rawScore / 10).toFixed(1)) : parseFloat((rawScore || 0).toFixed(1));

  const color = score >= 8.5 ? '#059669' :
    score >= 7.0 ? '#d97706' :
      score >= 5.0 ? '#dc2626' : '#991b1b';

  const gradient = score >= 8.5 ? 'linear-gradient(135deg, #10b981, #059669)' :
    score >= 7.0 ? 'linear-gradient(135deg, #f59e0b, #d97706)' :
      'linear-gradient(135deg, #ef4444, #b91c1c)';

  return (
    <Card
      hoverable
      style={{
        height: '100%',
        borderRadius: '16px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
        border: '1px solid #f1f5f9',
        background: '#fff',
        overflow: 'hidden'
      }}
      styles={{ body: { padding: '20px' } }}
      className="premium-score-card"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <Text strong style={{ fontSize: '14px', color: '#334155', letterSpacing: '-0.01em' }}>{title}</Text>
        <Tag color={color} style={{ borderRadius: '8px', border: 'none', fontWeight: 700, padding: '2px 8px', fontSize: '10px' }}>
          GRADE {grade || 'N/A'}
        </Tag>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <div style={{ flex: 1 }}>
          <Progress
            percent={score * 10}
            showInfo={false}
            strokeColor={{ from: color, to: color }}
            railColor="#f1f5f9"
            size={[undefined, 6]}
          />
        </div>
        <Text strong style={{ fontSize: '15px', color: '#0f172a', minWidth: '42px', textAlign: 'right' }}>{score.toFixed(1)}<span style={{ fontSize: '11px', color: '#64748b', fontWeight: 400 }}>/10</span></Text>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {parsedIssues.length > 0 && (
          <div>
            <Text type="secondary" style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px', color: '#94a3b8', marginBottom: '6px' }}>
              <AlertTriangle size={11} style={{ color: '#ef4444' }} /> Issues Found
            </Text>
            <ul style={{ paddingLeft: 0, listStyle: 'none', margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {parsedIssues.slice(0, 3).map((issue, idx) => (
                <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '11px', color: '#475569', lineHeight: 1.4 }}>
                  <span style={{ color: '#ef4444', marginTop: '2px' }}>•</span>
                  <span>{issue}</span>
                </li>
              ))}
              {parsedIssues.length > 3 && <li style={{ fontSize: '10px', color: '#94a3b8', paddingLeft: '10px', fontStyle: 'italic' }}>+{parsedIssues.length - 3} more issues</li>}
            </ul>
          </div>
        )}

        {parsedRecs.length > 0 ? (
          <div>
            <Text style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px', color: '#6366f1', marginBottom: '6px' }}>
              <Sparkles size={11} style={{ color: '#f59e0b' }} /> Optimization
            </Text>
            <ul style={{ paddingLeft: 0, listStyle: 'none', margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {parsedRecs.slice(0, 3).map((rec, idx) => (
                <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '11px', color: '#334155', lineHeight: 1.4 }}>
                  <CheckCircle2 size={12} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ fontWeight: 500 }}>{rec}</span>
                </li>
              ))}
              {parsedRecs.length > 3 && <li style={{ fontSize: '10px', color: '#94a3b8', paddingLeft: '18px', fontStyle: 'italic' }}>+{parsedRecs.length - 3} suggestions</li>}
            </ul>
          </div>
        ) : (
          <div style={{ padding: '8px 12px', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #dcfce7', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={14} style={{ color: '#10b981' }} />
            <Text strong style={{ color: '#15803d', fontSize: '11px' }}>Fully Optimized!</Text>
          </div>
        )}
      </div>
    </Card>
  );
};

const AsinDetailModal = ({ asin, isOpen, onClose }) => {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [dateRange, setDateRange] = useState({
    start: subDays(endOfDay(new Date()), 7),
    end: endOfDay(new Date())
  });
  const [subBsrTrend, setSubBsrTrend] = useState(null);
  const [isLoadingSubTrend, setIsLoadingSubTrend] = useState(false);

  // Fetch Sub BSR trend data
  useEffect(() => {
    const targetId = asin?._id || asin?.id;
    if (isOpen && targetId) {
      const fetchSubTrend = async () => {
        setIsLoadingSubTrend(true);
        try {
          const res = await asinApi.getSubBsrTrend(targetId, 30);
          if (res.success) {
            setSubBsrTrend(res.data);
          }
        } catch (error) {
          console.error('Failed to fetch Sub BSR trend:', error);
        } finally {
          setIsLoadingSubTrend(false);
        }
      };
      fetchSubTrend();
    }
  }, [isOpen, asin?._id, asin?.id]);

  // Compute current values with history fallback
  const { currentData, bsrData, ratingData, ratingBreakdownData } = useMemo(() => {
    if (!asin) return { currentData: {}, bsrData: {}, ratingData: {}, ratingBreakdownData: {} };

    const priceInfo = getLastValidData(asin, 'currentPrice') || getLastValidData(asin, 'price');
    const bsrInfo = getLastValidData(asin, 'bsr');
    const ratingInfo = getLastValidData(asin, 'rating');

    // Get rating breakdown from current or history
    let breakdownData = asin.ratingBreakdown;
    let breakdownDate = null;
    if (!breakdownData) {
      const history = asin.history || asin.weekHistory || [];
      if (history.length > 0) {
        const sorted = [...history].sort((a, b) => new Date(b.date || b.week) - new Date(a.date || a.week));
        for (const h of sorted) {
          if (h.ratingBreakdown) {
            breakdownData = h.ratingBreakdown;
            breakdownDate = h.date || h.week;
            break;
          }
        }
      }
    }

    return {
      currentData: { value: priceInfo.value, source: priceInfo.source, date: priceInfo.date },
      bsrData: { value: bsrInfo.value, source: bsrInfo.source, date: bsrInfo.date },
      ratingData: { value: ratingInfo.value, source: ratingInfo.source, date: ratingInfo.date },
      ratingBreakdownData: { data: breakdownData, date: breakdownDate }
    };
  }, [asin]);

  // Helper to display data source badge
  const SourceBadge = ({ source, date }) => {
    if (source === 'current') return null;
    if (source === 'history') {
      return (
        <Tooltip title={`Loaded from database history Snapshot (${date ? new Date(date).toLocaleDateString('en-IN') : 'N/A'})`}>
          <Tag
            color="warning"
            style={{
              marginLeft: '6px',
              border: 'none',
              fontSize: '9px',
              fontWeight: 600,
              borderRadius: '6px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px'
            }}
          >
            <AlertCircle size={9} />
            {date ? new Date(date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : 'HISTORY'}
          </Tag>
        </Tooltip>
      );
    }
    return null;
  };

  const history = useMemo(() => {
    if (!asin) return [];

    let rawHistory = asin.history || asin.weekHistory || [];
    if (rawHistory.length === 0) return [];

    const sorted = [...rawHistory].sort((a, b) => new Date(a.date || a.week) - new Date(b.date || b.week));

    return sorted.filter(h => {
      const itemDate = new Date(h.date || h.week);
      return itemDate >= dateRange.start && itemDate <= dateRange.end;
    });
  }, [asin, dateRange]);

  const chartCategories = history.map(h => {
    if (!h.date && !h.week) return '';
    const d = new Date(h.date || h.week);
    return d.toLocaleDateString('en-IN', { month: 'short', day: '2-digit' });
  });

  // Common Chart Base Options
  const commonOptions = {
    chart: {
      toolbar: { show: false },
      zoom: { enabled: false },
      background: 'transparent',
      fontFamily: 'Inter, system-ui, sans-serif'
    },
    xaxis: {
      categories: chartCategories,
      labels: { style: { fontSize: '10px', fontWeight: 500, colors: '#64748b' } },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    grid: { show: true, borderColor: '#f1f5f9', strokeDashArray: 4 },
    tooltip: { theme: 'light' }
  };

  // Price History Chart Config - Forward fill with last valid price
  const processedPriceHistory = useMemo(() => {
    if (!asin || !history) return [];
    let lastValidPrice = null;

    if (history.length > 0) {
      const fullHistory = asin.history || asin.weekHistory || [];
      const firstDate = new Date(history[0].date || history[0].week);
      const beforeHistory = fullHistory
        .filter(h => new Date(h.date || h.week) < firstDate)
        .sort((a, b) => new Date(b.date || b.week) - new Date(a.date || a.week));

      if (beforeHistory.length > 0) {
        for (const h of beforeHistory) {
          const p = h.price || h.currentPrice;
          if (p && p > 0) {
            lastValidPrice = p;
            break;
          }
        }
      }

      if (lastValidPrice === null) lastValidPrice = currentData.value;
    }

    return history.map(h => {
      const price = h.price || h.currentPrice;
      if (price && price > 0) {
        lastValidPrice = price;
        return price;
      }
      return lastValidPrice;
    });
  }, [history, asin, currentData]);

  const priceSeries = [{
    name: 'Price (₹)',
    data: processedPriceHistory
  }];

  const priceOptions = {
    ...commonOptions,
    chart: { ...commonOptions.chart, type: 'area', height: 280 },
    dataLabels: {
      enabled: history.length <= 15,
      formatter: (val) => val ? `₹${Number(val).toLocaleString()}` : '',
      offsetY: -10,
      style: { fontSize: '10px', colors: ['#4f46e5'], fontWeight: 600 },
      background: { enabled: true, borderWidth: 0, borderRadius: 4, padding: 4, opacity: 0.9 }
    },
    stroke: { curve: 'smooth', width: 3, colors: ['#4f46e5'] },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1, opacityFrom: 0.25, opacityTo: 0, stops: [0, 100],
        colorStops: [{ offset: 0, color: '#4f46e5', opacity: 0.2 }, { offset: 100, color: '#4f46e5', opacity: 0 }]
      }
    },
    yaxis: {
      labels: { style: { fontSize: '10px', colors: '#64748b' }, formatter: (val) => val ? `₹${Number(val).toLocaleString()}` : '' }
    },
    markers: { size: 4, strokeWidth: 2, strokeColors: '#fff', colors: ['#4f46e5'] }
  };

  // Multi-Category Sub-BSR Trend Chart Config
  const { subBsrSeries, subBsrOptions } = useMemo(() => {
    if (!subBsrTrend || !subBsrTrend.trends || subBsrTrend.trends.length === 0) {
      return { subBsrSeries: [], subBsrOptions: {} };
    }

    const colors = ['#4f46e5', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6'];

    const series = subBsrTrend.trends.map(t => ({
      name: t.category.length > 30 ? t.category.substring(0, 30) + '...' : t.category,
      data: t.data.map(d => d.rank),
      fullName: t.category
    }));

    const options = {
      ...commonOptions,
      chart: { ...commonOptions.chart, type: 'line', height: 350 },
      colors: colors.slice(0, series.length),
      xaxis: {
        categories: subBsrTrend.dates.map(d => format(new Date(d), 'MMM dd')),
        labels: { style: { fontSize: '10px', colors: '#64748b' } }
      },
      yaxis: {
        reversed: true,
        labels: {
          style: { fontSize: '10px', colors: '#64748b' },
          formatter: (val) => val ? `#${Number(val).toLocaleString()}` : ''
        }
      },
      stroke: { curve: 'smooth', width: 3 },
      markers: { size: 4 },
      legend: {
        show: true,
        position: 'bottom',
        fontSize: '11px',
        fontFamily: 'Inter, sans-serif',
        fontWeight: 500,
        itemMargin: { horizontal: 12, vertical: 4 }
      },
      tooltip: {
        y: { formatter: (val) => val ? `#${val.toLocaleString()}` : 'N/A' }
      }
    };

    return { subBsrSeries: series, subBsrOptions: options };
  }, [subBsrTrend, commonOptions]);

  // Rating History Chart Config
  const { ratingSeries, hasBreakdownHistory } = useMemo(() => {
    if (!asin || !history) return { ratingSeries: [], hasBreakdownHistory: false };
    let lastValidRating = null;
    let lastValidBreakdown = { fiveStar: null, fourStar: null, threeStar: null, twoStar: null, oneStar: null };

    const fullHistory = asin.history || asin.weekHistory || [];
    const firstDate = history.length > 0 ? new Date(history[0].date || history[0].week) : null;

    if (firstDate) {
      const beforeHistory = fullHistory
        .filter(h => new Date(h.date || h.week) < firstDate)
        .sort((a, b) => new Date(b.date || b.week) - new Date(a.date || a.week));

      if (beforeHistory.length > 0) {
        for (const h of beforeHistory) {
          if (lastValidRating === null && h.rating && h.rating > 0) lastValidRating = h.rating;
          if (h.ratingBreakdown) {
            Object.keys(lastValidBreakdown).forEach(key => {
              if (lastValidBreakdown[key] === null && h.ratingBreakdown[key] !== undefined) {
                lastValidBreakdown[key] = h.ratingBreakdown[key];
              }
            });
          }
          if (lastValidRating !== null && Object.values(lastValidBreakdown).every(v => v !== null)) break;
        }
      }
    }

    if (lastValidRating === null) lastValidRating = ratingData.value;
    Object.keys(lastValidBreakdown).forEach(key => {
      if (lastValidBreakdown[key] === null) lastValidBreakdown[key] = ratingBreakdownData.data?.[key] || 0;
    });

    const avgSeries = [];
    const breakdownSeries = {
      fiveStar: [], fourStar: [], threeStar: [], twoStar: [], oneStar: []
    };

    let foundAnyBreakdown = false;

    history.forEach(h => {
      if (h.rating && h.rating > 0) lastValidRating = h.rating;
      avgSeries.push(lastValidRating);

      if (h.ratingBreakdown) {
        foundAnyBreakdown = true;
        Object.keys(breakdownSeries).forEach(key => {
          if (h.ratingBreakdown[key] !== undefined) {
            lastValidBreakdown[key] = h.ratingBreakdown[key];
          }
          breakdownSeries[key].push(lastValidBreakdown[key]);
        });
      } else {
        Object.keys(breakdownSeries).forEach(key => {
          breakdownSeries[key].push(lastValidBreakdown[key]);
        });
      }
    });

    const series = [{
      name: 'Avg Rating',
      type: 'line',
      data: avgSeries
    }];

    if (foundAnyBreakdown) {
      series.push(
        { name: '5★ %', type: 'line', data: breakdownSeries.fiveStar },
        { name: '4★ %', type: 'line', data: breakdownSeries.fourStar },
        { name: '3★ %', type: 'line', data: breakdownSeries.threeStar },
        { name: '2★ %', type: 'line', data: breakdownSeries.twoStar },
        { name: '1★ %', type: 'line', data: breakdownSeries.oneStar }
      );
    }

    return { ratingSeries: series, hasBreakdownHistory: foundAnyBreakdown };
  }, [history, asin, ratingData, ratingBreakdownData]);

  const ratingOptions = {
    ...commonOptions,
    chart: {
      ...commonOptions.chart,
      type: 'line',
      height: 300
    },
    colors: hasBreakdownHistory
      ? ['#f59e0b', '#10b981', '#84cc16', '#eab308', '#f97316', '#ef4444']
      : ['#f59e0b'],
    stroke: {
      width: hasBreakdownHistory ? [4, 2, 2, 2, 2, 2] : [3],
      curve: 'smooth'
    },
    dataLabels: {
      enabled: history.length <= 10,
      formatter: (val, opts) => {
        if (opts.seriesIndex === 0) return val?.toFixed(1);
        return `${val}%`;
      },
      style: { fontSize: '9px', fontWeight: 600 }
    },
    yaxis: hasBreakdownHistory ? [
      {
        seriesName: 'Avg Rating',
        min: 0, max: 5, tickAmount: 5,
        title: { text: 'Avg (1-5)', style: { color: '#f59e0b', fontWeight: 600, fontSize: '11px' } },
        labels: { style: { colors: '#f59e0b', fontWeight: 500 }, formatter: (v) => v?.toFixed(1) }
      },
      {
        opposite: true,
        min: 0, max: 100, tickAmount: 5,
        title: { text: 'Percentage (%)', style: { color: '#64748b', fontWeight: 600, fontSize: '11px' } },
        labels: { style: { colors: '#64748b', fontWeight: 500 }, formatter: (v) => `${v}%` }
      }
    ] : {
      min: 0, max: 5, tickAmount: 5,
      labels: { style: { fontSize: '10px', colors: '#64748b' }, formatter: (val) => val?.toFixed(1) || '' }
    },
    legend: {
      show: hasBreakdownHistory,
      position: 'bottom',
      horizontalAlign: 'center',
      fontSize: '11px',
      fontWeight: 500,
      markers: { radius: 12 },
      itemMargin: { horizontal: 10, vertical: 5 }
    },
    tooltip: {
      shared: true,
      intersect: false,
      y: {
        formatter: (val, opts) => {
          if (opts.seriesIndex === 0) return `${val?.toFixed(2)} ★`;
          return `${val}%`;
        }
      }
    },
    markers: {
      size: hasBreakdownHistory ? [4, 0, 0, 0, 0, 0] : [4],
      strokeWidth: 2,
      strokeColors: '#fff',
      hover: { sizeOffset: 2 }
    }
  };

  if (!isOpen || !asin) return null;

  const tabItems = [
    {
      key: '1',
      label: (
        <Space size={6}>
          <Package size={16} />
          <span>Catalog Overview</span>
        </Space>
      ),
      children: (
        <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Product Overview Card */}
          <Card style={{ borderRadius: '20px', border: '1px solid #f1f5f9', boxShadow: '0 4px 24px rgba(0,0,0,0.02)' }} styles={{ body: { padding: '24px' } }}>
            <Row gutter={[24, 24]} align="middle">
              {/* Thumbnail */}
              <Col xs={24} md={5}>
                <div style={{
                  width: '100%',
                  height: '200px',
                  borderRadius: '16px',
                  border: '1.5px solid #e0e7ff',
                  padding: '8px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  background: '#fafafa',
                  overflow: 'hidden'
                }}>
                  {asin.imageUrl ? (
                    <img src={asin.imageUrl} alt={asin.asinCode} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#cbd5e1' }}>
                      <Package size={48} />
                      <Text type="secondary" style={{ fontSize: '11px', marginTop: '8px' }}>NO IMAGE</Text>
                    </div>
                  )}
                </div>
              </Col>

              {/* Content Info */}
              <Col xs={24} md={19}>
                <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                  <div>
                    <Space wrap size={6} style={{ marginBottom: '8px' }}>
                      <Tag color="blue" style={{ fontWeight: 700, border: 'none', letterSpacing: '0.03em', fontFamily: 'monospace', fontSize: '12px' }}>
                        {asin.asinCode}
                      </Tag>
                      {asin.category && asin.category.split('›').map((node, i) => (
                        <Tag key={i} style={{ borderRadius: '6px', fontSize: '10px', background: '#f1f5f9', border: 'none', color: '#475569', fontWeight: 600 }}>
                          {node.trim()}
                        </Tag>
                      ))}
                    </Space>
                    <Title level={4} style={{ margin: '0 0 8px 0', fontWeight: 800, color: '#0f172a', lineHeight: 1.3 }}>
                      {asin.title}
                    </Title>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Text type="secondary" style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Store size={13} /> Sold By: <strong style={{ color: '#334155' }}>{asin.soldBy || 'Amazon.in'}</strong>
                      </Text>
                      <Button
                        type="link"
                        size="small"
                        href={asin.marketplace === 'ajio' ? (asin.pageUrl || `https://www.ajio.com/p/${asin.asinCode}`) : asin.marketplace === 'myntra' ? (asin.pageUrl || 'https://www.myntra.com') : `https://www.amazon.in/dp/${asin.asinCode}`}
                        target="_blank"
                        icon={<ExternalLink size={12} />}
                        style={{ padding: 0, height: 'auto', fontSize: '12px', fontWeight: 600 }}
                      >
                        Open in Marketplace
                      </Button>
                    </div>
                  </div>

                  {/* Modern Statistics Row */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: '16px',
                    marginTop: '16px'
                  }}>
                    {/* Stat Card 1 */}
                    <div style={{
                      background: '#fff',
                      padding: '16px 20px',
                      borderRadius: '16px',
                      border: '1px solid #f1f5f9',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }} className="premium-metric-card">
                      <Text type="secondary" style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Price</Text>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                        <Text strong style={{ fontSize: '18px', color: '#4f46e5' }}>₹{currentData.value?.toLocaleString() || 0}</Text>
                        <SourceBadge source={currentData.source} date={currentData.date} />
                      </div>
                    </div>

                    {/* Stat Card 2 */}
                    <div style={{
                      background: '#fff',
                      padding: '16px 20px',
                      borderRadius: '16px',
                      border: '1px solid #f1f5f9',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }} className="premium-metric-card">
                      <Text type="secondary" style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>MRP Reference</Text>
                      <div style={{ marginTop: '6px' }}>
                        <Text strong style={{ fontSize: '18px', color: '#64748b' }}>{asin.mrp ? `₹${asin.mrp.toLocaleString()}` : '—'}</Text>
                      </div>
                    </div>

                    {/* Stat Card 3 */}
                    <div style={{
                      background: '#fff',
                      padding: '16px 20px',
                      borderRadius: '16px',
                      border: '1px solid #f1f5f9',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }} className="premium-metric-card">
                      <Text type="secondary" style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Main BSR Rank</Text>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                        <Text strong style={{ fontSize: '18px', color: '#10b981' }}>#{bsrData.value?.toLocaleString() || '—'}</Text>
                        <SourceBadge source={bsrData.source} date={bsrData.date} />
                      </div>
                    </div>

                    {/* Stat Card 4 */}
                    <div style={{
                      background: '#fff',
                      padding: '16px 20px',
                      borderRadius: '16px',
                      border: '1px solid #f1f5f9',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }} className="premium-metric-card">
                      <Text type="secondary" style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Buy Box Info</Text>
                      <div style={{ marginTop: '6px' }}>
                        <Popover
                          trigger="click"
                          placement="bottom"
                          content={
                            <div style={{ minWidth: '240px', padding: '4px' }}>
                              <Text strong style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', display: 'block', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px', marginBottom: '8px' }}>
                                Offer Hierarchy Map
                              </Text>
                              <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                                {(asin.allOffers && asin.allOffers.length > 0 ? asin.allOffers : [
                                  { seller: asin.soldBy, price: currentData.value, isBuyBoxWinner: true },
                                  { seller: asin.soldBySec, price: asin.secondAsp, isBuyBoxWinner: false }
                                ].filter(o => o.seller || o.price > 0)).map((offer, idx) => (
                                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '8px 12px', borderRadius: '10px' }}>
                                    <div>
                                      <Text strong style={{ fontSize: '12px', color: '#334155', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        {offer.seller || 'Unknown Seller'}
                                        {offer.isBuyBoxWinner && <Trophy size={11} style={{ color: '#f59e0b' }} />}
                                      </Text>
                                      <Text type="secondary" style={{ fontSize: '10px', display: 'block' }}>{offer.isBuyBoxWinner ? 'Winner' : 'Secondary Offer'}</Text>
                                      {offer.delivery && (
                                        <Text type="secondary" style={{ fontSize: '9px', display: 'block', color: '#64748b', marginTop: '2px', maxWidth: '160px' }}>
                                          🚚 {offer.delivery}
                                        </Text>
                                      )}
                                    </div>
                                    <Text strong style={{ color: '#4f46e5', fontSize: '13px' }}>₹{offer.price?.toLocaleString()}</Text>
                                  </div>
                                ))}
                              </Space>
                            </div>
                          }
                        >
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '2px 6px', borderRadius: '6px', background: '#fff', border: '1px solid #cbd5e1' }}>
                            <Store size={12} style={{ color: '#94a3b8' }} />
                            <Text strong style={{ fontSize: '12px', color: '#334155', maxWidth: '100px' }} ellipsis>{asin.soldBy || 'Amazon.in'}</Text>
                            {asin.allOffers && asin.allOffers.length > 1 && (
                              <Tag color="blue" style={{ border: 'none', fontSize: '9px', margin: 0, padding: '0 4px' }}>+{asin.allOffers.length - 1}</Tag>
                            )}
                          </div>
                        </Popover>
                      </div>
                    </div>
                  </div>
                </Space>
              </Col>
            </Row>
          </Card>

          {/* Bullet Points Cards */}
          <Card style={{ borderRadius: '20px', border: '1px solid #f1f5f9', boxShadow: '0 4px 24px rgba(0,0,0,0.02)' }} styles={{ body: { padding: '24px' } }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <div style={{ p: '8px', background: '#ede9fe', color: '#7c3aed', padding: '8px', borderRadius: '10px' }}><ListChecks size={20} /></div>
              <Text strong style={{ fontSize: '16px', color: '#1e293b' }}>Product Key Features</Text>
            </div>

            {(() => {
              const bullets = (() => {
                if (Array.isArray(asin.bulletPointsText) && asin.bulletPointsText.length > 0) {
                  return asin.bulletPointsText.filter(b => typeof b === 'string' && b.trim().length > 0);
                }
                if (typeof asin.bulletPointsText === 'string' && asin.bulletPointsText.length > 10) {
                  try {
                    const parsed = JSON.parse(asin.bulletPointsText);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                      return parsed.filter(b => typeof b === 'string' && b.trim().length > 0);
                    }
                  } catch (e) { }

                  if (asin.bulletPointsText.includes('<li') || asin.bulletPointsText.includes('<span')) {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = asin.bulletPointsText;
                    const items = Array.from(tempDiv.querySelectorAll('li, .a-list-item'))
                      .map(el => el.textContent.trim())
                      .filter(t => t.length > 3);
                    if (items.length > 0) return items;
                  }
                  return [asin.bulletPointsText.replace(/<[^>]+>/g, '').trim()];
                }
                if (asin.bulletPointsList && Array.isArray(asin.bulletPointsList)) return asin.bulletPointsList;
                if (asin.bullets && Array.isArray(asin.bullets)) return asin.bullets;
                return [];
              })();

              if (bullets.length > 0) {
                return (
                  <Row gutter={[16, 16]}>
                    {bullets.map((bullet, idx) => (
                      <Col xs={24} md={12} key={idx}>
                        <div style={{
                          display: 'flex',
                          gap: '12px',
                          padding: '16px 20px',
                          background: '#fff',
                          borderRadius: '16px',
                          border: '1px solid #f1f5f9',
                          borderLeft: '4px solid #6366f1',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                          height: '100%',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                        }} className="bullet-item-hover">
                          <div style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                            color: '#fff',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            fontSize: '10px',
                            fontWeight: 700,
                            flexShrink: 0,
                            marginTop: '1px'
                          }}>
                            {idx + 1}
                          </div>
                          <Text style={{ fontSize: '13px', color: '#334155', lineHeight: 1.5 }}>{bullet}</Text>
                        </div>
                      </Col>
                    ))}
                  </Row>
                );
              }

              if (typeof asin.bullet_points === 'string' && asin.bullet_points.length > 20) {
                return (
                  <div
                    style={{ padding: '20px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0', color: '#334155', fontSize: '13px', lineHeight: '1.6' }}
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(asin.bullet_points) }}
                  />
                );
              }

              return (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={<span style={{ color: '#94a3b8', fontSize: '13px' }}>No product features synced for this listing yet</span>}
                />
              );
            })()}
          </Card>
        </div>
      )
    },
    {
      key: '2',
      label: (
        <Space size={6}>
          <Activity size={16} />
          <span>Listing Quality Score (LQS)</span>
        </Space>
      ),
      children: (
        <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Score Header */}
          {/* Score Header */}
          {(() => {
            const lqsScore = typeof asin.lqs === 'number'
              ? (asin.lqs > 10 ? asin.lqs / 10 : asin.lqs)
              : (parseFloat(asin.lqs || 0) > 10 ? parseFloat(asin.lqs || 0) / 10 : parseFloat(asin.lqs || 0));

            const accentColor = lqsScore >= 8.5 ? '#059669' :
              lqsScore >= 7.0 ? '#d97706' :
                lqsScore >= 5.0 ? '#dc2626' : '#991b1b';

            const gradientBg = lqsScore >= 8.5 ? 'linear-gradient(90deg, #f0fdf4 0%, #ffffff 100%)' :
              lqsScore >= 7.0 ? 'linear-gradient(90deg, #fffbeb 0%, #ffffff 100%)' :
                'linear-gradient(90deg, #fef2f2 0%, #ffffff 100%)';

            return (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#fff',
                backgroundImage: gradientBg,
                padding: '24px 32px',
                borderRadius: '20px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.03)',
                border: '1px solid #f1f5f9',
                borderLeft: `6px solid ${accentColor}`
              }}>
                <div>
                  <Title level={4} style={{ margin: 0, fontWeight: 800, color: '#0f172a' }}>Overall Catalog Performance</Title>
                  <Text type="secondary" style={{ fontSize: '13px' }}>Algorithmic scoring mapped against optimal marketplace benchmarks</Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <Text type="secondary" style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>OVERALL SCORE</Text>
                    <div style={{
                      fontSize: '32px',
                      fontWeight: 900,
                      marginTop: '2px',
                      lineHeight: 1,
                      color: accentColor
                    }}>
                      {lqsScore.toFixed(1)}
                    </div>
                  </div>
                  <div style={{ width: '1px', height: '36px', background: '#e2e8f0' }} />
                  <div style={{ textAlign: 'center' }}>
                    <Text type="secondary" style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>QUALITY GRADE</Text>
                    <div style={{ marginTop: '4px' }}>
                      <Tag
                        style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          padding: '4px 12px',
                          borderRadius: '8px',
                          border: 'none',
                          color: accentColor,
                          background: lqsScore >= 8.5 ? '#ecfdf5' : lqsScore >= 7.0 ? '#fffbeb' : '#fef2f2'
                        }}
                      >
                        {lqsScore >= 8.5 ? 'EXCELLENT' : lqsScore >= 7.0 ? 'GOOD' : lqsScore >= 5.0 ? 'POOR' : 'CRITICAL'}
                      </Tag>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Grid cards */}
          <Row gutter={[20, 20]}>
            <Col xs={24} sm={12} lg={6}>
              <ScoreCard
                title="Product Title"
                score={asin.titleScore}
                grade={asin.titleGrade}
                issues={asin.titleIssues}
                recommendations={asin.titleRecommendations}
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <ScoreCard
                title="Bullet Points"
                score={asin.bulletScore}
                grade={asin.bulletGrade}
                issues={asin.bulletIssues}
                recommendations={asin.bulletRecommendations}
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <ScoreCard
                title="Images & Media"
                score={asin.imageScore}
                grade={asin.imageGrade}
                issues={asin.imageIssues}
                recommendations={asin.imageRecommendations}
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <ScoreCard
                title="Description / A+"
                score={asin.descriptionScore}
                grade={asin.descriptionGrade}
                issues={asin.descriptionIssues}
                recommendations={asin.descriptionRecommendations}
              />
            </Col>
          </Row>
        </div>
      )
    },
    {
      key: '3',
      label: (
        <Space size={6}>
          <TrendingUp size={16} />
          <span>Price & Rank History</span>
        </Space>
      ),
      children: (
        <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Price Chart */}
          <Card
            style={{ borderRadius: '20px', border: '1px solid #f1f5f9', boxShadow: '0 4px 24px rgba(0,0,0,0.02)' }}
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ p: '8px', background: '#ecfdf5', color: '#059669', padding: '6px', borderRadius: '8px' }}><IndianRupee size={16} /></div>
                <Text strong style={{ fontSize: '15px' }}>Marketplace Pricing Flow</Text>
              </div>
            }
            extra={<Text type="secondary" style={{ fontSize: '11px' }}>Snapshots recorded: <strong>{history.length}</strong></Text>}
          >
            <div style={{ minHeight: '280px' }}>
              <Chart options={priceOptions} series={priceSeries} type="area" height={280} />
            </div>
          </Card>

          {/* Detailed Sub-BSR Historical Trends */}
          <Card
            style={{ borderRadius: '20px', border: '1px solid #f1f5f9', boxShadow: '0 4px 24px rgba(0,0,0,0.02)' }}
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ p: '8px', background: '#e0e7ff', color: '#4f46e5', padding: '6px', borderRadius: '8px' }}><TrendingUp size={16} /></div>
                <Text strong style={{ fontSize: '15px' }}>Sub-BSR Category Performance (30-Day Snapshot)</Text>
              </div>
            }
            extra={<Tag color="blue" style={{ border: 'none', fontWeight: 600, fontSize: '10px' }}>NICHE MONITORING</Tag>}
          >
            <div style={{ minHeight: '350px', position: 'relative' }}>
              {isLoadingSubTrend ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '350px' }}>
                  <Loader2 size={32} className="animate-spin" style={{ color: '#4f46e5', marginBottom: '12px' }} />
                  <Text type="secondary" style={{ fontWeight: 500 }}>Running niche data indexing...</Text>
                </div>
              ) : subBsrSeries.length > 0 ? (
                <>
                  <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
                    {subBsrTrend.trends.map((t, i) => (
                      <Col xs={24} sm={8} key={i}>
                        <div style={{
                          padding: '14px 18px',
                          background: '#f8fafc',
                          borderRadius: '16px',
                          border: '1px solid #e2e8f0',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <div style={{ overflow: 'hidden' }}>
                            <Text strong type="secondary" style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.category}</Text>
                            <Text strong style={{ fontSize: '16px', color: '#0f172a', marginTop: '2px', display: 'block' }}>#{t.latestRank?.toLocaleString() || '—'}</Text>
                          </div>
                          <div style={{ padding: '8px', background: '#fff', borderRadius: '10px', boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
                            <Trophy size={14} style={{ color: i === 0 ? '#f59e0b' : '#cbd5e1' }} />
                          </div>
                        </div>
                      </Col>
                    ))}
                  </Row>
                  <Chart options={subBsrOptions} series={subBsrSeries} type="line" height={350} />
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '350px', color: '#94a3b8' }}>
                  <RefreshCcw size={32} style={{ marginBottom: '8px', opacity: 0.6 }} />
                  <Text type="secondary" style={{ fontWeight: 500, fontSize: '13px' }}>No historical sub-BSR categorization synchronized yet</Text>
                  <Text style={{ fontSize: '11px', color: '#cbd5e1' }}>Synchronizing pipeline will populate metrics on next active crawler window.</Text>
                </div>
              )}
            </div>
          </Card>
        </div>
      )
    },
    {
      key: '4',
      label: (
        <Space size={6}>
          <Star size={16} />
          <span>Customer Reviews</span>
        </Space>
      ),
      children: (
        <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Rating Breakdown Card */}
          <Card
            style={{ borderRadius: '20px', border: '1px solid #f1f5f9', boxShadow: '0 4px 24px rgba(0,0,0,0.02)' }}
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ p: '8px', background: '#fffbeb', color: '#d97706', padding: '6px', borderRadius: '8px' }}><Star size={16} /></div>
                <Text strong style={{ fontSize: '15px' }}>Star Rating Composition</Text>
                {ratingBreakdownData.date && <SourceBadge source="history" date={ratingBreakdownData.date} />}
              </div>
            }
          >
            <Row gutter={[32, 20]}>
              {[
                { stars: 5, key: 'fiveStar', color: '#10b981' },
                { stars: 4, key: 'fourStar', color: '#84cc16' },
                { stars: 3, key: 'threeStar', color: '#f59e0b' },
                { stars: 2, key: 'twoStar', color: '#f97316' },
                { stars: 1, key: 'oneStar', color: '#ef4444' }
              ].map(({ stars, key, color }) => {
                const percentage = ratingBreakdownData.data?.[key] || asin.ratingBreakdown?.[key] || 0;
                return (
                  <Col xs={24} md={12} key={stars}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Text strong style={{ minWidth: '36px', color: '#475569', fontSize: '13px' }}>{stars} ★</Text>
                      <div style={{ flex: 1 }}>
                        <Progress
                          percent={percentage}
                          strokeColor={color}
                          railColor="#f1f5f9"
                          size={[undefined, 10]}
                          showInfo={false}
                        />
                      </div>
                      <div style={{ minWidth: '80px', textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
                        <Text strong style={{ fontSize: '13px', color: '#0f172a' }}>{percentage}%</Text>
                        <Text type="secondary" style={{ fontSize: '10px' }}>
                          ({Math.round((percentage / 100) * (asin.reviewCount || 0)).toLocaleString()} count)
                        </Text>
                      </div>
                    </div>
                  </Col>
                );
              })}
            </Row>
          </Card>

          {/* Rating progression chart */}
          <Card
            style={{ borderRadius: '20px', border: '1px solid #f1f5f9', boxShadow: '0 4px 24px rgba(0,0,0,0.02)' }}
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ p: '8px', background: '#fffbeb', color: '#d97706', padding: '6px', borderRadius: '8px' }}><TrendingUp size={16} /></div>
                <Text strong style={{ fontSize: '15px' }}>Historic Satisfaction Index</Text>
              </div>
            }
          >
            <div style={{ minHeight: '300px' }}>
              <Chart options={ratingOptions} series={ratingSeries} type="line" height={300} />
            </div>
          </Card>
        </div>
      )
    }
  ];

  return (
    <Modal
      open={isOpen}
      onCancel={onClose}
      footer={null}
      width={1240}
      centered
      destroyOnHidden
      styles={{
        body: { padding: 0, backgroundColor: '#f8fafc' },
        mask: {
          backdropFilter: 'blur(6px)',
          backgroundColor: 'rgba(15, 23, 42, 0.3)'
        }
      }}
    >
      <style>{`
        .ant-modal-content {
          border-radius: 24px !important;
          overflow: hidden !important;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15) !important;
        }
        .premium-asin-tabs .ant-tabs-nav {
          background: #fff !important;
          margin-bottom: 0 !important;
          padding: 0 32px !important;
          border-bottom: 1px solid #f1f5f9 !important;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.01) !important;
        }
        .premium-asin-tabs .ant-tabs-tab {
          padding: 18px 8px !important;
          font-weight: 600 !important;
        }
        .premium-asin-tabs .ant-tabs-tab-active {
          font-weight: 700 !important;
        }
        .premium-score-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 16px 32px rgba(0, 0, 0, 0.07) !important;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        .bullet-item-hover:hover {
          border-left-color: #4f46e5 !important;
          background: #fff !important;
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.05) !important;
          transform: translateY(-3px);
        }
        .premium-metric-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.04) !important;
          border-color: #e2e8f0 !important;
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Modal Sticky Header Top */}
      <div style={{
        padding: '20px 32px',
        background: '#fff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid #f1f5f9'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ p: '12px', background: '#e0e7ff', padding: '10px', borderRadius: '12px', color: '#4f46e5' }}>
            <Package size={22} />
          </div>
          <div>
            <Title level={5} style={{ margin: 0, fontWeight: 800, letterSpacing: '-0.01em' }}>Catalog Specifications</Title>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              <Text strong style={{ fontSize: '12px', color: '#334155', fontFamily: 'monospace' }}>{asin.asinCode}</Text>
              <Text type="secondary" style={{ fontSize: '11px' }}>•</Text>
              <Text type="secondary" style={{ fontSize: '11px' }}>{asin.marketplace === 'ajio' ? 'Ajio IN' : asin.marketplace === 'myntra' ? 'Myntra' : 'Amazon India'}</Text>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#007dfaff', padding: '6px 12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <Calendar size={14} style={{ color: '#ffffffff' }} />
            <Text style={{ fontSize: '12px', fontWeight: 600, color: '#ffffffff' }}>
              {format(dateRange.start, 'MMM dd')} — {format(dateRange.end, 'MMM dd, yyyy')}
            </Text>
            <Button
              type="text"
              size="small"
              onClick={() => setIsPickerOpen(true)}
              style={{ height: 'auto', padding: '2px 6px', fontSize: '11px', background: '#fff', fontWeight: 700, color: '#4f46e5', border: '1px solid #dbeafe', marginLeft: '6px' }}
            >
              Change
            </Button>
          </div>
          <AdvancedDateRangePicker
            isOpen={isPickerOpen}
            onClose={() => setIsPickerOpen(false)}
            onApply={(range) => {
              setDateRange({ start: range.startDate, end: range.endDate });
            }}
            initialStartDate={dateRange.start}
            initialEndDate={dateRange.end}
            initialRangeType="last7"
          />
        </div>
      </div>

      {/* Tab Contents */}
      <div style={{ padding: '0 32px 32px 32px', maxHeight: '80vh', overflowY: 'auto' }}>
        <Tabs
          defaultActiveKey="1"
          items={tabItems}
          className="premium-asin-tabs"
          animated={{ inkBar: true, tabPane: true }}
        />
      </div>
    </Modal>
  );
};

export default AsinDetailModal;