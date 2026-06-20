import React, { useState, useEffect, useMemo } from 'react';
import {
  Package, IndianRupee, Star, Award, Store, Activity, BarChart3,
  TrendingUp, TrendingDown, Eye, ExternalLink, Calendar, ListChecks,
  Image, AlertCircle, Trophy, Sparkles, CheckCircle2, AlertTriangle,
  Loader2, RefreshCcw, ChevronDown, X
} from 'lucide-react';
import { asinApi } from '../services/api';
import Chart from 'react-apexcharts';
import { subDays, endOfDay, format } from 'date-fns';
import AdvancedDateRangePicker from '../contexts/DateRangeContext';
import Popover from './common/Popover';
import DOMPurify from 'dompurify';
import {
  Modal, Tabs, Card, Row, Col, Progress, Tag, Typography,
  Button, Divider, Tooltip, Empty, Space, Statistic
} from 'antd';

const { Title, Text, Paragraph } = Typography;

const C = {
  primary: '#fb4f40',
  primaryLight: '#fce8e6',
  primaryBg: '#fff5f5',
  dark: '#121b1e',
  text: '#27272a',
  textSecondary: '#71717a',
  border: '#e4e4e7',
  borderLight: '#f0f0f3',
  bg: '#f4f5f7',
  white: '#fff',
  success: '#22c55e',
  successBg: '#f0fdf4',
  warning: '#f59e0b',
  warningBg: '#fffbeb',
  danger: '#ef4444',
  dangerBg: '#fef2f2',
};

const getLastValidData = (asin, field, defaultValue = 0) => {
  if (asin[field] && asin[field] > 0) {
    return { value: asin[field], source: 'current' };
  }
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
  const parsedIssues = typeof issues === 'string'
    ? (issues.startsWith('[') ? JSON.parse(issues) : issues.split(',').filter(Boolean))
    : (issues || []);
  const parsedRecs = typeof recommendations === 'string'
    ? (recommendations.startsWith('[') ? JSON.parse(recommendations) : recommendations.split(',').filter(Boolean))
    : (recommendations || []);
  const score = rawScore > 10 ? parseFloat((rawScore / 10).toFixed(1)) : parseFloat((rawScore || 0).toFixed(1));
  const color = score >= 8.5 ? C.success : score >= 7.0 ? C.warning : C.danger;
  const bgColor = score >= 8.5 ? C.successBg : score >= 7.0 ? C.warningBg : C.dangerBg;

  return (
    <Card
      hoverable
      style={{
        height: '100%', borderRadius: 12, border: `1px solid ${C.borderLight}`, background: C.white
      }}
      styles={{ body: { padding: 20 } }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Text strong style={{ fontSize: 13, color: C.text }}>{title}</Text>
        <Tag color={color} style={{ borderRadius: 6, border: 'none', fontWeight: 700, padding: '2px 8px', fontSize: 10 }}>
          GRADE {grade || 'N/A'}
        </Tag>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <Progress percent={score * 10} showInfo={false} strokeColor={color} trailColor={C.borderLight} size={[undefined, 6]} />
        </div>
        <Text strong style={{ fontSize: 15, color: C.dark, minWidth: 42, textAlign: 'right' }}>
          {score.toFixed(1)}
          <span style={{ fontSize: 11, color: C.textSecondary, fontWeight: 400 }}>/10</span>
        </Text>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {parsedIssues.length > 0 && (
          <div>
            <Text style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4, color: C.danger, marginBottom: 6 }}>
              <AlertTriangle size={11} color={C.danger} /> Issues Found
            </Text>
            <ul style={{ paddingLeft: 0, listStyle: 'none', margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {parsedIssues.slice(0, 3).map((issue, idx) => (
                <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 11, color: C.textSecondary, lineHeight: 1.4 }}>
                  <span style={{ color: C.danger, marginTop: 2 }}>•</span>
                  <span>{issue}</span>
                </li>
              ))}
              {parsedIssues.length > 3 && (
                <li style={{ fontSize: 10, color: C.textSecondary, paddingLeft: 10, fontStyle: 'italic' }}>
                  +{parsedIssues.length - 3} more issues
                </li>
              )}
            </ul>
          </div>
        )}
        {parsedRecs.length > 0 ? (
          <div>
            <Text style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4, color: C.primary, marginBottom: 6 }}>
              <Sparkles size={11} color={C.warning} /> Optimization
            </Text>
            <ul style={{ paddingLeft: 0, listStyle: 'none', margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {parsedRecs.slice(0, 3).map((rec, idx) => (
                <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 11, color: C.text, lineHeight: 1.4 }}>
                  <CheckCircle2 size={12} color={C.success} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span style={{ fontWeight: 500 }}>{rec}</span>
                </li>
              ))}
              {parsedRecs.length > 3 && (
                <li style={{ fontSize: 10, color: C.textSecondary, paddingLeft: 18, fontStyle: 'italic' }}>
                  +{parsedRecs.length - 3} suggestions
                </li>
              )}
            </ul>
          </div>
        ) : (
          <div style={{ padding: '8px 12px', background: C.successBg, borderRadius: 8, border: `1px solid #dcfce7`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={14} color={C.success} />
            <Text strong style={{ color: '#15803d', fontSize: 11 }}>Fully Optimized!</Text>
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

  useEffect(() => {
    const targetId = asin?._id || asin?.id;
    if (isOpen && targetId) {
      const fetchSubTrend = async () => {
        setIsLoadingSubTrend(true);
        try {
          const res = await asinApi.getSubBsrTrend(targetId, 30);
          if (res.success) setSubBsrTrend(res.data);
        } catch (error) {
          console.error('Failed to fetch Sub BSR trend:', error);
        } finally {
          setIsLoadingSubTrend(false);
        }
      };
      fetchSubTrend();
    }
  }, [isOpen, asin?._id, asin?.id]);

  const { currentData, bsrData, ratingData, ratingBreakdownData } = useMemo(() => {
    if (!asin) return { currentData: {}, bsrData: {}, ratingData: {}, ratingBreakdownData: {} };
    const priceInfo = getLastValidData(asin, 'currentPrice') || getLastValidData(asin, 'price');
    const bsrInfo = getLastValidData(asin, 'bsr');
    const ratingInfo = getLastValidData(asin, 'rating');
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

  const SourceBadge = ({ source, date }) => {
    if (source === 'current') return null;
    if (source === 'history') {
      return (
        <Tooltip title={`Loaded from database history snapshot (${date ? new Date(date).toLocaleDateString('en-IN') : 'N/A'})`}>
          <Tag color="warning" style={{ marginLeft: 6, border: 'none', fontSize: 9, fontWeight: 600, borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
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

  const commonOptions = {
    chart: { toolbar: { show: false }, zoom: { enabled: false }, background: 'transparent', fontFamily: 'Inter, system-ui, sans-serif' },
    xaxis: {
      categories: chartCategories,
      labels: { style: { fontSize: '10px', fontWeight: 500, colors: C.textSecondary } },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    grid: { show: true, borderColor: C.borderLight, strokeDashArray: 4 },
    tooltip: { theme: 'light' }
  };

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
          if (p && p > 0) { lastValidPrice = p; break; }
        }
      }
      if (lastValidPrice === null) lastValidPrice = currentData.value;
    }
    return history.map(h => {
      const price = h.price || h.currentPrice;
      if (price && price > 0) { lastValidPrice = price; return price; }
      return lastValidPrice;
    });
  }, [history, asin, currentData]);

  const priceSeries = [{ name: 'Price (₹)', data: processedPriceHistory }];
  const priceOptions = {
    ...commonOptions,
    chart: { ...commonOptions.chart, type: 'area', height: 280 },
    dataLabels: {
      enabled: history.length <= 15,
      formatter: (val) => val ? `₹${Number(val).toLocaleString()}` : '',
      offsetY: -10,
      style: { fontSize: '10px', colors: [C.primary], fontWeight: 600 },
      background: { enabled: true, borderWidth: 0, borderRadius: 4, padding: 4, opacity: 0.9 }
    },
    stroke: { curve: 'smooth', width: 3, colors: [C.primary] },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1, opacityFrom: 0.25, opacityTo: 0, stops: [0, 100],
        colorStops: [{ offset: 0, color: C.primary, opacity: 0.2 }, { offset: 100, color: C.primary, opacity: 0 }]
      }
    },
    yaxis: {
      labels: { style: { fontSize: '10px', colors: C.textSecondary }, formatter: (val) => val ? `₹${Number(val).toLocaleString()}` : '' }
    },
    markers: { size: 4, strokeWidth: 2, strokeColors: C.white, colors: [C.primary] }
  };

  const { subBsrSeries, subBsrOptions } = useMemo(() => {
    if (!subBsrTrend || !subBsrTrend.trends || subBsrTrend.trends.length === 0) {
      return { subBsrSeries: [], subBsrOptions: {} };
    }
    const colors = [C.primary, C.success, C.warning, '#ec4899', '#06b6d4', '#8b5cf6'];
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
        labels: { style: { fontSize: '10px', colors: C.textSecondary } }
      },
      yaxis: {
        reversed: true,
        labels: {
          style: { fontSize: '10px', colors: C.textSecondary },
          formatter: (val) => val ? `#${Number(val).toLocaleString()}` : ''
        }
      },
      stroke: { curve: 'smooth', width: 3 },
      markers: { size: 4 },
      legend: {
        show: true, position: 'bottom', fontSize: '11px',
        fontFamily: 'Inter, sans-serif', fontWeight: 500,
        itemMargin: { horizontal: 12, vertical: 4 }
      },
      tooltip: { y: { formatter: (val) => val ? `#${val.toLocaleString()}` : 'N/A' } }
    };
    return { subBsrSeries: series, subBsrOptions: options };
  }, [subBsrTrend, commonOptions]);

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
              if (lastValidBreakdown[key] === null && h.ratingBreakdown[key] !== undefined) lastValidBreakdown[key] = h.ratingBreakdown[key];
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
    const breakdownSeries = { fiveStar: [], fourStar: [], threeStar: [], twoStar: [], oneStar: [] };
    let foundAnyBreakdown = false;
    history.forEach(h => {
      if (h.rating && h.rating > 0) lastValidRating = h.rating;
      avgSeries.push(lastValidRating);
      if (h.ratingBreakdown) {
        foundAnyBreakdown = true;
        Object.keys(breakdownSeries).forEach(key => {
          if (h.ratingBreakdown[key] !== undefined) lastValidBreakdown[key] = h.ratingBreakdown[key];
          breakdownSeries[key].push(lastValidBreakdown[key]);
        });
      } else {
        Object.keys(breakdownSeries).forEach(key => breakdownSeries[key].push(lastValidBreakdown[key]));
      }
    });
    const series = [{ name: 'Avg Rating', type: 'line', data: avgSeries }];
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
    chart: { ...commonOptions.chart, type: 'line', height: 300 },
    colors: hasBreakdownHistory
      ? [C.warning, C.success, '#84cc16', '#eab308', '#f97316', C.danger]
      : [C.warning],
    stroke: { width: hasBreakdownHistory ? [4, 2, 2, 2, 2, 2] : [3], curve: 'smooth' },
    dataLabels: {
      enabled: history.length <= 10,
      formatter: (val, opts) => opts.seriesIndex === 0 ? val?.toFixed(1) : `${val}%`,
      style: { fontSize: '9px', fontWeight: 600 }
    },
    yaxis: hasBreakdownHistory ? [
      {
        seriesName: 'Avg Rating', min: 0, max: 5, tickAmount: 5,
        title: { text: 'Avg (1-5)', style: { color: C.warning, fontWeight: 600, fontSize: '11px' } },
        labels: { style: { colors: C.warning, fontWeight: 500 }, formatter: (v) => v?.toFixed(1) }
      },
      {
        opposite: true, min: 0, max: 100, tickAmount: 5,
        title: { text: 'Percentage (%)', style: { color: C.textSecondary, fontWeight: 600, fontSize: '11px' } },
        labels: { style: { colors: C.textSecondary, fontWeight: 500 }, formatter: (v) => `${v}%` }
      }
    ] : {
      min: 0, max: 5, tickAmount: 5,
      labels: { style: { fontSize: '10px', colors: C.textSecondary }, formatter: (val) => val?.toFixed(1) || '' }
    },
    legend: {
      show: hasBreakdownHistory, position: 'bottom', horizontalAlign: 'center',
      fontSize: '11px', fontWeight: 500, markers: { radius: 12 },
      itemMargin: { horizontal: 10, vertical: 5 }
    },
    tooltip: {
      shared: true, intersect: false,
      y: { formatter: (val, opts) => opts.seriesIndex === 0 ? `${val?.toFixed(2)} ★` : `${val}%` }
    },
    markers: { size: hasBreakdownHistory ? [4, 0, 0, 0, 0, 0] : [4], strokeWidth: 2, strokeColors: C.white, hover: { sizeOffset: 2 } }
  };

  if (!isOpen || !asin) return null;

  const tabItems = [
    {
      key: '1',
      label: <Space size={6}><Package size={16} /><span>Catalog Overview</span></Space>,
      children: (
        <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <Card style={{ borderRadius: 12, border: `1px solid ${C.borderLight}` }} styles={{ body: { padding: 24 } }}>
            <Row gutter={[24, 24]} align="middle">
              <Col xs={24} md={5}>
                <div style={{ width: '100%', height: 200, borderRadius: 12, border: `1px solid ${C.borderLight}`, padding: 8, display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#fafafa', overflow: 'hidden' }}>
                  {asin.imageUrl ? (
                    <img src={asin.imageUrl} alt={asin.asinCode} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: C.textSecondary }}>
                      <Package size={48} />
                      <Text type="secondary" style={{ fontSize: 11, marginTop: 8 }}>NO IMAGE</Text>
                    </div>
                  )}
                </div>
              </Col>
              <Col xs={24} md={19}>
                <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                  <div>
                    <Space wrap size={6} style={{ marginBottom: 8 }}>
                      <Tag color="error" style={{ fontWeight: 700, border: 'none', letterSpacing: '0.03em', fontFamily: 'monospace', fontSize: 12 }}>
                        {asin.asinCode}
                      </Tag>
                      {asin.category && asin.category.split('›').map((node, i) => (
                        <Tag key={i} style={{ borderRadius: 6, fontSize: 10, background: C.bg, border: 'none', color: C.textSecondary, fontWeight: 600 }}>
                          {node.trim()}
                        </Tag>
                      ))}
                    </Space>
                    <Title level={4} style={{ margin: '0 0 8px 0', fontWeight: 800, color: C.dark, lineHeight: 1.3 }}>
                      {asin.title}
                    </Title>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <Text type="secondary" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Store size={13} /> Sold By: <strong style={{ color: C.text }}>{asin.soldBy || 'Amazon.in'}</strong>
                      </Text>
                      <Button
                        type="link"
                        size="small"
                        href={asin.marketplace === 'ajio' ? (asin.pageUrl || `https://www.ajio.com/p/${asin.asinCode}`) : asin.marketplace === 'myntra' ? (asin.pageUrl || 'https://www.myntra.com') : `https://www.amazon.in/dp/${asin.asinCode}`}
                        target="_blank"
                        icon={<ExternalLink size={12} />}
                        style={{ padding: 0, height: 'auto', fontSize: 12, fontWeight: 600 }}
                      >
                        Open in Marketplace
                      </Button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginTop: 8 }}>
                    <div style={{ background: C.white, padding: '14px 16px', borderRadius: 10, border: `1px solid ${C.borderLight}` }}>
                      <Text type="secondary" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Price</Text>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <Text strong style={{ fontSize: 18, color: C.primary }}>₹{currentData.value?.toLocaleString() || 0}</Text>
                        <SourceBadge source={currentData.source} date={currentData.date} />
                      </div>
                    </div>
                    <div style={{ background: C.white, padding: '14px 16px', borderRadius: 10, border: `1px solid ${C.borderLight}` }}>
                      <Text type="secondary" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>MRP Reference</Text>
                      <div style={{ marginTop: 4 }}>
                        <Text strong style={{ fontSize: 18, color: C.textSecondary }}>{asin.mrp ? `₹${asin.mrp.toLocaleString()}` : '—'}</Text>
                      </div>
                    </div>
                    <div style={{ background: C.white, padding: '14px 16px', borderRadius: 10, border: `1px solid ${C.borderLight}` }}>
                      <Text type="secondary" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Main BSR Rank</Text>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <Text strong style={{ fontSize: 18, color: C.success }}>#{bsrData.value?.toLocaleString() || '—'}</Text>
                        <SourceBadge source={bsrData.source} date={bsrData.date} />
                      </div>
                    </div>
                    <div style={{ background: C.white, padding: '14px 16px', borderRadius: 10, border: `1px solid ${C.borderLight}` }}>
                      <Text type="secondary" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Buy Box Info</Text>
                      <div style={{ marginTop: 4 }}>
                        <Popover
                          trigger="click"
                          placement="bottom"
                          content={
                            <div style={{ minWidth: 240, padding: 4 }}>
                              <Text strong style={{ fontSize: 11, color: C.textSecondary, textTransform: 'uppercase', display: 'block', borderBottom: `1px solid ${C.borderLight}`, paddingBottom: 8, marginBottom: 8 }}>
                                Offer Hierarchy Map
                              </Text>
                              <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                                {(asin.allOffers && asin.allOffers.length > 0 ? asin.allOffers : [
                                  { seller: asin.soldBy, price: currentData.value, isBuyBoxWinner: true },
                                  { seller: asin.soldBySec, price: asin.secondAsp, isBuyBoxWinner: false }
                                ].filter(o => o.seller || o.price > 0)).map((offer, idx) => (
                                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.bg, padding: '8px 12px', borderRadius: 8 }}>
                                    <div>
                                      <Text strong style={{ fontSize: 12, color: C.text, display: 'flex', alignItems: 'center', gap: 4 }}>
                                        {offer.seller || 'Unknown Seller'}
                                        {offer.isBuyBoxWinner && <Trophy size={11} style={{ color: C.warning }} />}
                                      </Text>
                                      <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>{offer.isBuyBoxWinner ? 'Winner' : 'Secondary Offer'}</Text>
                                      {offer.delivery && (
                                        <Text type="secondary" style={{ fontSize: 9, display: 'block', color: C.textSecondary, marginTop: 2, maxWidth: 160 }}>
                                          {offer.delivery}
                                        </Text>
                                      )}
                                    </div>
                                    <Text strong style={{ color: C.primary, fontSize: 13 }}>₹{offer.price?.toLocaleString()}</Text>
                                  </div>
                                ))}
                              </Space>
                            </div>
                          }
                        >
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '2px 8px', borderRadius: 6, border: `1px solid ${C.border}` }}>
                            <Store size={12} style={{ color: C.textSecondary }} />
                            <Text strong style={{ fontSize: 12, color: C.text, maxWidth: 100 }} ellipsis>{asin.soldBy || 'Amazon.in'}</Text>
                            {asin.allOffers && asin.allOffers.length > 1 && (
                              <Tag color="error" style={{ border: 'none', fontSize: 9, margin: 0, padding: '0 4px', lineHeight: '16px' }}>+{asin.allOffers.length - 1}</Tag>
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

          <Card style={{ borderRadius: 12, border: `1px solid ${C.borderLight}` }} styles={{ body: { padding: 24 } }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ background: C.primaryLight, color: C.primary, padding: 8, borderRadius: 8 }}><ListChecks size={18} /></div>
              <Text strong style={{ fontSize: 15, color: C.text }}>Product Key Features</Text>
            </div>
            {(() => {
              const bullets = (() => {
                if (Array.isArray(asin.bulletPointsText) && asin.bulletPointsText.length > 0) {
                  return asin.bulletPointsText.filter(b => typeof b === 'string' && b.trim().length > 0);
                }
                if (typeof asin.bulletPointsText === 'string' && asin.bulletPointsText.length > 10) {
                  try {
                    const parsed = JSON.parse(asin.bulletPointsText);
                    if (Array.isArray(parsed) && parsed.length > 0) return parsed.filter(b => typeof b === 'string' && b.trim().length > 0);
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
                  <Row gutter={[12, 12]}>
                    {bullets.map((bullet, idx) => (
                      <Col xs={24} md={12} key={idx}>
                        <div style={{
                          display: 'flex', gap: 12, padding: '12px 16px', background: C.white,
                          borderRadius: 10, border: `1px solid ${C.borderLight}`,
                          borderLeft: `3px solid ${C.primary}`, height: '100%'
                        }}>
                          <div style={{
                            width: 22, height: 22, borderRadius: '50%', background: C.primary,
                            color: C.white, display: 'flex', justifyContent: 'center', alignItems: 'center',
                            fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 1
                          }}>
                            {idx + 1}
                          </div>
                          <Text style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>{bullet}</Text>
                        </div>
                      </Col>
                    ))}
                  </Row>
                );
              }
              if (typeof asin.bullet_points === 'string' && asin.bullet_points.length > 20) {
                return (
                  <div
                    style={{ padding: 20, background: C.bg, borderRadius: 12, border: `1px solid ${C.borderLight}`, color: C.text, fontSize: 13, lineHeight: 1.6 }}
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(asin.bullet_points) }}
                  />
                );
              }
              return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ color: C.textSecondary, fontSize: 13 }}>No product features synced for this listing yet</span>} />;
            })()}
          </Card>
        </div>
      )
    },
    {
      key: '2',
      label: <Space size={6}><Activity size={16} /><span>Listing Quality Score (LQS)</span></Space>,
      children: (
        <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {(() => {
            const lqsScore = typeof asin.lqs === 'number'
              ? (asin.lqs > 10 ? asin.lqs / 10 : asin.lqs)
              : (parseFloat(asin.lqs || 0) > 10 ? parseFloat(asin.lqs || 0) / 10 : parseFloat(asin.lqs || 0));
            const accentColor = lqsScore >= 8.5 ? C.success : lqsScore >= 7.0 ? C.warning : C.danger;
            const gradientBg = lqsScore >= 8.5 ? 'linear-gradient(90deg, #f0fdf4 0%, #ffffff 100%)'
              : lqsScore >= 7.0 ? 'linear-gradient(90deg, #fffbeb 0%, #ffffff 100%)'
                : 'linear-gradient(90deg, #fef2f2 0%, #ffffff 100%)';
            return (
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: gradientBg, padding: '20px 28px', borderRadius: 12,
                border: `1px solid ${C.borderLight}`, borderLeft: `5px solid ${accentColor}`
              }}>
                <div>
                  <Title level={4} style={{ margin: 0, fontWeight: 800, color: C.dark }}>Overall Catalog Performance</Title>
                  <Text type="secondary" style={{ fontSize: 13 }}>Algorithmic scoring mapped against optimal marketplace benchmarks</Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <div style={{ textAlign: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>OVERALL SCORE</Text>
                    <div style={{ fontSize: 28, fontWeight: 900, marginTop: 2, lineHeight: 1, color: accentColor }}>{lqsScore.toFixed(1)}</div>
                  </div>
                  <Divider type="vertical" style={{ height: 32, borderColor: C.border }} />
                  <div style={{ textAlign: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>QUALITY GRADE</Text>
                    <div style={{ marginTop: 4 }}>
                      <Tag style={{
                        fontSize: 11, fontWeight: 800, padding: '4px 12px', borderRadius: 6,
                        border: 'none', color: accentColor,
                        background: lqsScore >= 8.5 ? C.successBg : lqsScore >= 7.0 ? C.warningBg : C.dangerBg
                      }}>
                        {lqsScore >= 8.5 ? 'EXCELLENT' : lqsScore >= 7.0 ? 'GOOD' : lqsScore >= 5.0 ? 'POOR' : 'CRITICAL'}
                      </Tag>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={6}>
              <ScoreCard title="Product Title" score={asin.titleScore} grade={asin.titleGrade} issues={asin.titleIssues} recommendations={asin.titleRecommendations} />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <ScoreCard title="Bullet Points" score={asin.bulletScore} grade={asin.bulletGrade} issues={asin.bulletIssues} recommendations={asin.bulletRecommendations} />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <ScoreCard title="Images & Media" score={asin.imageScore} grade={asin.imageGrade} issues={asin.imageIssues} recommendations={asin.imageRecommendations} />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <ScoreCard title="Description / A+" score={asin.descriptionScore} grade={asin.descriptionGrade} issues={asin.descriptionIssues} recommendations={asin.descriptionRecommendations} />
            </Col>
          </Row>
        </div>
      )
    },
    {
      key: '3',
      label: <Space size={6}><TrendingUp size={16} /><span>Price & Rank History</span></Space>,
      children: (
        <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <Card
            style={{ borderRadius: 12, border: `1px solid ${C.borderLight}` }}
            styles={{ body: { padding: 24 } }}
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ background: C.primaryLight, color: C.primary, padding: '6px 8px', borderRadius: 6 }}><IndianRupee size={16} /></div>
                <Text strong style={{ fontSize: 15 }}>Marketplace Pricing Flow</Text>
              </div>
            }
            extra={<Text type="secondary" style={{ fontSize: 11 }}>Snapshots recorded: <strong>{history.length}</strong></Text>}
          >
            <div style={{ minHeight: 280 }}>
              <Chart options={priceOptions} series={priceSeries} type="area" height={280} />
            </div>
          </Card>
          <Card
            style={{ borderRadius: 12, border: `1px solid ${C.borderLight}` }}
            styles={{ body: { padding: 24 } }}
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ background: C.primaryLight, color: C.primary, padding: '6px 8px', borderRadius: 6 }}><TrendingUp size={16} /></div>
                <Text strong style={{ fontSize: 15 }}>Sub-BSR Category Performance (30-Day Snapshot)</Text>
              </div>
            }
            extra={<Tag color="error" style={{ border: 'none', fontWeight: 600, fontSize: 10 }}>NICHE MONITORING</Tag>}
          >
            <div style={{ minHeight: 350, position: 'relative' }}>
              {isLoadingSubTrend ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 350 }}>
                  <Loader2 size={32} className="animate-spin" style={{ color: C.primary, marginBottom: 12 }} />
                  <Text type="secondary" style={{ fontWeight: 500 }}>Running niche data indexing...</Text>
                </div>
              ) : subBsrSeries.length > 0 ? (
                <>
                  <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                    {subBsrTrend.trends.map((t, i) => (
                      <Col xs={24} sm={8} key={i}>
                        <div style={{ padding: '12px 16px', background: C.bg, borderRadius: 10, border: `1px solid ${C.borderLight}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ overflow: 'hidden' }}>
                            <Text type="secondary" strong style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.category}</Text>
                            <Text strong style={{ fontSize: 16, color: C.dark, marginTop: 2, display: 'block' }}>#{t.latestRank?.toLocaleString() || '—'}</Text>
                          </div>
                          <div style={{ padding: 8, background: C.white, borderRadius: 8, boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
                            <Trophy size={14} style={{ color: i === 0 ? C.warning : C.border }} />
                          </div>
                        </div>
                      </Col>
                    ))}
                  </Row>
                  <Chart options={subBsrOptions} series={subBsrSeries} type="line" height={350} />
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 350, color: C.textSecondary }}>
                  <RefreshCcw size={32} style={{ marginBottom: 8, opacity: 0.6 }} />
                  <Text type="secondary" style={{ fontWeight: 500, fontSize: 13 }}>No historical sub-BSR categorization synchronized yet</Text>
                  <Text style={{ fontSize: 11, color: C.border }}>Synchronizing pipeline will populate metrics on next active crawler window.</Text>
                </div>
              )}
            </div>
          </Card>
        </div>
      )
    },
    {
      key: '4',
      label: <Space size={6}><Star size={16} /><span>Customer Reviews</span></Space>,
      children: (
        <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <Card
            style={{ borderRadius: 12, border: `1px solid ${C.borderLight}` }}
            styles={{ body: { padding: 24 } }}
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ background: C.warningBg, color: C.warning, padding: '6px 8px', borderRadius: 6 }}><Star size={16} /></div>
                <Text strong style={{ fontSize: 15 }}>Star Rating Composition</Text>
                {ratingBreakdownData.date && <SourceBadge source="history" date={ratingBreakdownData.date} />}
              </div>
            }
          >
            <Row gutter={[24, 16]}>
              {[
                { stars: 5, key: 'fiveStar', color: C.success },
                { stars: 4, key: 'fourStar', color: '#84cc16' },
                { stars: 3, key: 'threeStar', color: C.warning },
                { stars: 2, key: 'twoStar', color: '#f97316' },
                { stars: 1, key: 'oneStar', color: C.danger }
              ].map(({ stars, key, color }) => {
                const percentage = ratingBreakdownData.data?.[key] || asin.ratingBreakdown?.[key] || 0;
                return (
                  <Col xs={24} md={12} key={stars}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Text strong style={{ minWidth: 36, color: C.textSecondary, fontSize: 13 }}>{stars} ★</Text>
                      <div style={{ flex: 1 }}>
                        <Progress percent={percentage} strokeColor={color} trailColor={C.borderLight} size={[undefined, 10]} showInfo={false} />
                      </div>
                      <div style={{ minWidth: 80, textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
                        <Text strong style={{ fontSize: 13, color: C.dark }}>{percentage}%</Text>
                        <Text type="secondary" style={{ fontSize: 10 }}>({Math.round((percentage / 100) * (asin.reviewCount || 0)).toLocaleString()} count)</Text>
                      </div>
                    </div>
                  </Col>
                );
              })}
            </Row>
          </Card>
          <Card
            style={{ borderRadius: 12, border: `1px solid ${C.borderLight}` }}
            styles={{ body: { padding: 24 } }}
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ background: C.warningBg, color: C.warning, padding: '6px 8px', borderRadius: 6 }}><TrendingUp size={16} /></div>
                <Text strong style={{ fontSize: 15 }}>Historic Satisfaction Index</Text>
              </div>
            }
          >
            <div style={{ minHeight: 300 }}>
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
      width={1200}
      centered
      destroyOnClose
      closeIcon={<X size={18} />}
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: C.primaryLight, padding: 10, borderRadius: 10, color: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={20} />
            </div>
            <div>
              <Title level={5} style={{ margin: 0, fontWeight: 800, letterSpacing: '-0.01em' }}>Catalog Specifications</Title>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <Text strong style={{ fontSize: 12, color: C.text, fontFamily: 'monospace' }}>{asin.asinCode}</Text>
                <Text type="secondary" style={{ fontSize: 11 }}>•</Text>
                <Text type="secondary" style={{ fontSize: 11 }}>{asin.marketplace === 'ajio' ? 'Ajio IN' : asin.marketplace === 'myntra' ? 'Myntra' : 'Amazon India'}</Text>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.primary, padding: '5px 12px', borderRadius: 8 }}>
              <Calendar size={13} color={C.white} />
              <Text style={{ fontSize: 11, fontWeight: 600, color: C.white }}>
                {format(dateRange.start, 'MMM dd')} — {format(dateRange.end, 'MMM dd, yyyy')}
              </Text>
              <Button
                type="text"
                size="small"
                onClick={() => setIsPickerOpen(true)}
                style={{ height: 'auto', padding: '1px 8px', fontSize: 10, background: C.white, fontWeight: 700, color: C.primary, borderRadius: 4, lineHeight: '20px' }}
              >
                Change
              </Button>
            </div>
            <AdvancedDateRangePicker
              isOpen={isPickerOpen}
              onClose={() => setIsPickerOpen(false)}
              onApply={(range) => setDateRange({ start: range.startDate, end: range.endDate })}
              initialStartDate={dateRange.start}
              initialEndDate={dateRange.end}
              initialRangeType="last7"
            />
          </div>
        </div>
      }
      styles={{
        body: { padding: 0, backgroundColor: C.bg },
        mask: { backdropFilter: 'blur(6px)', backgroundColor: 'rgba(15, 23, 42, 0.3)' }
      }}
    >
      <style>{`
        .ant-modal-content { border-radius: 16px !important; overflow: hidden !important; }
        .ant-modal-header { border-bottom: 1px solid ${C.borderLight} !important; padding: 16px 24px !important; margin-bottom: 0 !important; border-radius: 16px 16px 0 0 !important; }
        .premium-asin-tabs .ant-tabs-nav { background: #fff !important; margin-bottom: 0 !important; padding: 0 32px !important; border-bottom: 1px solid ${C.borderLight} !important; }
        .premium-asin-tabs .ant-tabs-tab { padding: 16px 8px !important; font-weight: 600 !important; }
        .premium-asin-tabs .ant-tabs-tab-active { font-weight: 700 !important; }
        .premium-score-card:hover { transform: translateY(-3px); box-shadow: 0 12px 24px rgba(0,0,0,0.06) !important; transition: all 0.3s cubic-bezier(0.4,0,0.2,1) !important; }
        .bullet-item-hover:hover { border-left-color: ${C.primary} !important; background: #fff !important; box-shadow: 0 8px 16px rgba(0,0,0,0.04) !important; transform: translateY(-2px); }
        .premium-metric-card:hover { transform: translateY(-2px); box-shadow: 0 8px 16px rgba(0,0,0,0.04) !important; border-color: ${C.borderLight} !important; }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
      <div style={{ padding: '0 32px 24px 32px', maxHeight: '75vh', overflowY: 'auto' }}>
        <Tabs defaultActiveKey="1" items={tabItems} className="premium-asin-tabs" animated={{ inkBar: true, tabPane: true }} />
      </div>
    </Modal>
  );
};

export default AsinDetailModal;
