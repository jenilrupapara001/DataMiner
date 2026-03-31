import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Store
} from 'lucide-react';
import { PageLoader } from '@/components/application/loading-indicator/PageLoader';
import { LoadingIndicator } from '@/components/application/loading-indicator/loading-indicator';
import AsinDetailModal from '../components/AsinDetailModal';

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
    hasAPlus: true,
    descLength: 520,
    lqs: 85,
    status: 'Active',
    weekHistory: [
      { week: 'Week 1', date: '2024-12-01', price: 2399, bsr: 1400, rating: 4.4, reviews: 1180 },
      { week: 'Week 2', date: '2024-12-08', price: 2499, bsr: 1350, rating: 4.4, reviews: 1200 },
      { week: 'Week 3', date: '2024-12-15', price: 2499, bsr: 1300, rating: 4.5, reviews: 1215 },
      { week: 'Week 4', date: '2024-12-22', price: 2599, bsr: 1280, rating: 4.5, reviews: 1225 },
      { week: 'Week 5', date: '2024-12-29', price: 2499, bsr: 1250, rating: 4.5, reviews: 1235 },
      { week: 'Week 6', date: '2025-01-05', price: 2399, bsr: 1220, rating: 4.5, reviews: 1240 },
      { week: 'Week 7', date: '2025-01-12', price: 2499, bsr: 1200, rating: 4.5, reviews: 1245 },
      { week: 'Week 8', date: '2025-01-19', price: 2499, bsr: 1250, rating: 4.5, reviews: 1250 },
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
    hasAPlus: true,
    descLength: 480,
    lqs: 72,
    status: 'Active',
    weekHistory: [
      { week: 'Week 1', date: '2024-12-01', price: 8799, bsr: 950, rating: 4.1, reviews: 820 },
      { week: 'Week 2', date: '2024-12-08', price: 8999, bsr: 920, rating: 4.1, reviews: 835 },
      { week: 'Week 3', date: '2024-12-15', price: 9199, bsr: 900, rating: 4.2, reviews: 850 },
      { week: 'Week 4', date: '2024-12-22', price: 8999, bsr: 910, rating: 4.2, reviews: 860 },
      { week: 'Week 5', date: '2024-12-29', price: 8799, bsr: 895, rating: 4.2, reviews: 870 },
      { week: 'Week 6', date: '2025-01-05', price: 8999, bsr: 890, rating: 4.2, reviews: 880 },
      { week: 'Week 7', date: '2025-01-12', price: 9199, bsr: 885, rating: 4.2, reviews: 885 },
      { week: 'Week 8', date: '2025-01-19', price: 8999, bsr: 890, rating: 4.2, reviews: 890 },
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
    hasAPlus: false,
    descLength: 280,
    lqs: 68,
    status: 'Active',
    weekHistory: [
      { week: 'Week 1', date: '2024-12-01', price: 1199, bsr: 3500, rating: 4.7, reviews: 3050 },
      { week: 'Week 2', date: '2024-12-08', price: 1299, bsr: 3400, rating: 4.7, reviews: 3080 },
      { week: 'Week 3', date: '2024-12-15', price: 1299, bsr: 3350, rating: 4.7, reviews: 3100 },
      { week: 'Week 4', date: '2024-12-22', price: 1399, bsr: 3300, rating: 4.7, reviews: 3120 },
      { week: 'Week 5', date: '2024-12-29', price: 1299, bsr: 3250, rating: 4.8, reviews: 3140 },
      { week: 'Week 6', date: '2025-01-05', price: 1199, bsr: 3220, rating: 4.8, reviews: 3160 },
      { week: 'Week 7', date: '2025-01-12', price: 1299, bsr: 3210, rating: 4.8, reviews: 3180 },
      { week: 'Week 8', date: '2025-01-19', price: 1299, bsr: 3200, rating: 4.8, reviews: 3200 },
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
    hasAPlus: true,
    descLength: 420,
    lqs: 78,
    status: 'Active',
    weekHistory: [
      { week: 'Week 1', date: '2024-12-01', price: 699, bsr: 4800, rating: 4.2, reviews: 4300 },
      { week: 'Week 2', date: '2024-12-08', price: 799, bsr: 4700, rating: 4.2, reviews: 4350 },
      { week: 'Week 3', date: '2024-12-15', price: 849, bsr: 4650, rating: 4.3, reviews: 4400 },
      { week: 'Week 4', date: '2024-12-22', price: 799, bsr: 4600, rating: 4.3, reviews: 4420 },
      { week: 'Week 5', date: '2024-12-29', price: 749, bsr: 4550, rating: 4.3, reviews: 4440 },
      { week: 'Week 6', date: '2025-01-05', price: 799, bsr: 4520, rating: 4.3, reviews: 4460 },
      { week: 'Week 7', date: '2025-01-12', price: 849, bsr: 4510, rating: 4.3, reviews: 4480 },
      { week: 'Week 8', date: '2025-01-19', price: 799, bsr: 4500, rating: 4.3, reviews: 4500 },
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
    hasAPlus: true,
    descLength: 680,
    lqs: 82,
    status: 'Active',
    weekHistory: [
      { week: 'Week 1', date: '2024-12-01', price: 3299, bsr: 2000, rating: 4.0, reviews: 1750 },
      { week: 'Week 2', date: '2024-12-08', price: 3499, bsr: 1950, rating: 4.0, reviews: 1770 },
      { week: 'Week 3', date: '2024-12-15', price: 3699, bsr: 1900, rating: 4.1, reviews: 1790 },
      { week: 'Week 4', date: '2024-12-22', price: 3499, bsr: 1880, rating: 4.1, reviews: 1805 },
      { week: 'Week 5', date: '2024-12-29', price: 3299, bsr: 1860, rating: 4.1, reviews: 1820 },
      { week: 'Week 6', date: '2025-01-05', price: 3499, bsr: 1855, rating: 4.1, reviews: 1830 },
      { week: 'Week 7', date: '2025-01-12', price: 3699, bsr: 1852, rating: 4.1, reviews: 1840 },
      { week: 'Week 8', date: '2025-01-19', price: 3499, bsr: 1850, rating: 4.1, reviews: 1850 },
    ],
  },
];

const AsinManagerPage = () => {
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

  const handleViewAsin = (asin) => {
    setSelectedAsin(asin);
    setShowDetailModal(true);
  };

  const loadData = useCallback(async (page = 1) => {
    try {
      setLoading(true);

      const [asinRes, statsRes] = await Promise.all([
        asinApi.getAll({ page, limit: 25 }),
        asinApi.getStats()
      ]);

      setAsins(asinRes?.asins || []);
      setPagination(asinRes?.pagination || { page: 1, limit: 25, total: 0, totalPages: 0 });
      setStats(statsRes);
      setError(null);
    } catch (err) {
      console.error('Error fetching ASINs:', err);
      setError(err.message);
      setAsins(demoAsins);
    } finally {
      setLoading(false);
    }
  }, []);

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
    return () => socket.off('scrape_progress');
  }, [socket, loadData, pagination.page]);

  useEffect(() => {
    const fetchSellers = async () => {
      try {
        const response = await sellerApi.getAll();
        setSellers(response || []);
      } catch (err) {
        console.error('Error fetching sellers:', err);
      }
    };
    fetchSellers();
  }, []);

  const kpis = useMemo(() => {
    if (stats) {
      return [
        { label: 'ALL ASINS', value: stats.total || 0, color: '#6366f1', icon: <Package size={14} /> },
        { label: 'AVG LQS', value: (stats.avgLQS || 0) + '%', color: '#10b981', icon: <Activity size={14} /> },
        { label: 'BUY BOX', value: (stats.buyBoxRate || 0) + '%', color: '#f59e0b', icon: <Trophy size={14} /> },
        { label: 'TOTAL REVIEWS', value: (stats.totalReviews || 0).toLocaleString(), color: '#8b5cf6', icon: <Star size={14} /> },
        { label: 'AVG BSR', value: '#' + (stats.avgBSR || 0).toLocaleString(), color: '#ef4444', icon: <Activity size={14} /> },
        { label: 'AVG PRICE', value: '₹' + (stats.avgPrice || 0).toLocaleString(), color: '#06b6d4', icon: <IndianRupee size={14} /> },
      ];
    }

    const total = asins.length;
    const avgLqs = total > 0 ? Math.round(asins.reduce((sum, a) => sum + (a.lqs || 0), 0) / total) : 0;
    const buyBoxWins = asins.filter(a => a.buyBoxWin).length;
    const buyBoxRate = total > 0 ? Math.round((buyBoxWins / total) * 100) : 0;
    const lowLqs = asins.filter(a => (a.lqs || 0) < 70).length;
    const activeDeals = asins.filter(a => a.dealDetails && a.dealDetails !== 'None').length;
    const avgPrice = total > 0 ? Math.round(asins.reduce((sum, a) => sum + (a.currentPrice || 0), 0) / total) : 0;

    return [
      { label: 'ALL ASINS', value: total, color: '#6366f1', icon: <Package size={14} /> },
      { label: 'AVG LQS', value: avgLqs + '%', color: '#10b981', icon: <Activity size={14} /> },
      { label: 'BUY BOX', value: buyBoxRate + '%', color: '#f59e0b', icon: <Trophy size={14} /> },
      { label: 'LOW LQS', value: lowLqs, color: '#ef4444', icon: <AlertTriangle size={14} /> },
      { label: 'DEALS', value: activeDeals, color: '#8b5cf6', icon: <Zap size={14} /> },
      { label: 'AVG PRICE', value: '₹' + avgPrice.toLocaleString(), color: '#06b6d4', icon: <IndianRupee size={14} /> },
    ];
  }, [asins, stats]);

  const historyStructure = useMemo(() => {
    if (asins.length > 0) {
      // Find the ASIN with the most history to determine columns
      const sample = asins.sort((a, b) => (b.weekHistory?.length || 0) - (a.weekHistory?.length || 0))[0];
      if (sample && sample.weekHistory) {
        return generateHistoryStructure(sample.weekHistory);
      }
    }
    return [{ label: 'W1', dates: [{ label: 'N/A' }] }];
  }, [asins]);

  const totalHistoryCols = useMemo(() => {
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
    const confirmScrape = window.confirm(`Initiate scraping for all ${totalCount} ASINs? This will be processed in the background.`);
    if (!confirmScrape) return;

    try {
      await marketSyncApi.syncAll();
      alert(`Scraping initiated successfully for all ${totalCount} ASINs.`);
      loadData(pagination.page);
    } catch (err) {
      console.error('Bulk scrape failed:', err);
      alert('Failed to start bulk scraping: ' + err.message);
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

  const getAplusBadge = (hasAPlus, status) => {
    if (status === 'Scraping') return <span style={{ color: '#9ca3af' }}>-</span>;
    const bgColor = hasAPlus ? '#059669' : '#6b7280';
    return (
      <span
        className="badge"
        style={{ backgroundColor: bgColor, color: '#fff', fontWeight: 600, fontSize: '0.75rem' }}
      >
        {hasAPlus ? 'Yes' : 'No'}
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

    // Very condensed mini bar chart or simple text representation
    // Using a tooltip might be best for full details, but let's show a tiny inline representation
    return (
      <div className="d-flex flex-column gap-1" style={{ fontSize: '0.65rem', width: '60px' }}>
        <div className="d-flex align-items-center justify-content-between">
          <span className="text-success fw-bold">5★</span>
          <span className="text-muted">{breakdown.fiveStar || 0}%</span>
        </div>
        <div className="d-flex align-items-center justify-content-between">
          <span className="text-secondary fw-bold">1★</span>
          <span className="text-muted">{breakdown.oneStar || 0}%</span>
        </div>
      </div>
    );
  };

  // Collapsible Section Component
  const CollapsibleSection = ({ title, icon: Icon, isOpen, onToggle, children, badge }) => (
    <div className="card mb-4 border-zinc-200 shadow-sm" style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--zinc-200)' }}>
      <div
        className="card-header d-flex justify-content-between align-items-center cursor-pointer px-4 py-3"
        onClick={onToggle}
        style={{ cursor: 'pointer', backgroundColor: '#fff', borderBottom: '1px solid var(--zinc-200)' }}
      >
        <h5 className="card-title mb-0 d-flex align-items-center gap-2" style={{ color: 'var(--zinc-900)', fontWeight: 600 }}>
          <div className="p-2 bg-primary-subtle text-primary rounded-3">
            <Icon size={18} />
          </div>
          {title}
          {badge && <span className="badge rounded-pill bg-primary shadow-sm ms-2" style={{ fontSize: '10px' }}>{badge}</span>}
        </h5>
        <button className="btn btn-sm btn-light rounded-circle p-1 border-0 shadow-none hover-bg-light">
          {isOpen ? <ChevronUp size={16} className="text-muted" /> : <ChevronDown size={16} className="text-muted" />}
        </button>
      </div>
      {isOpen && <div className="card-body px-4 pb-4 pt-4" style={{ backgroundColor: '#fff' }}>{children}</div>}
    </div>
  );

  if (loading && asins.length === 0) {
    return <PageLoader message="Loading ASIN Manager..." />;
  }

  if (loading && asins.length > 0) {
    return (
      <div className="container-fluid p-0">
        <header className="main-header" style={{ padding: '1.5rem 2rem', background: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
          <h1 className="page-title mb-0 d-flex align-items-center gap-2" style={{ fontSize: '1.75rem', fontWeight: 700 }}>
            <Scan className="text-primary" size={28} />
            ASIN Manager
          </h1>
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}>
            <LoadingIndicator type="line-simple" size="md" />
          </div>
        </header>
        <div className="page-content py-5">
          {error ? (
            <div className="alert alert-warning border-0 shadow-sm rounded-4 mx-4" role="alert">
              <AlertTriangle className="me-2" size={18} />
              {error} - Showing demo data
            </div>
          ) : (
            <div className="d-flex flex-column justify-content-center align-items-center" style={{ minHeight: '400px' }}>
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
      <div className="container-fluid p-0">
        <header className="main-header" style={{ padding: '1.5rem 2rem', background: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
          <h1 className="page-title mb-0 d-flex align-items-center gap-2" style={{ fontSize: '1.75rem', fontWeight: 700 }}>
            <Scan className="text-primary" size={28} />
            ASIN Manager
          </h1>
        </header>
        <div className="page-content">
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

  return (
    <div className="page-container pb-5">
      <div className="page-header mb-4">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <div className="p-2 bg-primary-subtle text-primary rounded-3">
                <Scan size={20} />
              </div>
              <h1 className="page-title mb-0">ASIN Manager</h1>
            </div>
            <p className="text-muted small mb-0">Operational Inventory tracking & Listing Quality Metrics</p>
          </div>
          <div className="d-flex align-items-center gap-3">
            <div className="btn-group p-1 bg-white border border-zinc-200 shadow-sm rounded-pill">
              <button className="btn btn-sm px-3 rounded-pill border-0 transition-all btn-primary shadow-sm" style={{ fontSize: '11px', fontWeight: '600' }}>
                <TrendingUp size={12} className="me-1" /> Performance
              </button>
              <button className="btn btn-sm px-3 rounded-pill border-0 transition-all text-muted hover-bg-light" style={{ fontSize: '11px', fontWeight: '600' }}>
                <Table size={12} className="me-1" /> Analytics
              </button>
            </div>
            <button className="btn btn-primary d-flex align-items-center gap-2 rounded-pill px-4 py-2 shadow-sm border-0" onClick={() => setShowAddModal(true)} style={{ fontWeight: '600' }}>
              <Plus size={18} /> Add ASIN
            </button>
          </div>
        </div>
      </div>

      <div className="page-content">
        {error && (
          <div className="alert alert-warning d-flex align-items-center mb-4 mx-2 border-0 shadow-sm rounded-4" role="alert" style={{ padding: '0.75rem 1.25rem' }}>
            <AlertTriangle className="me-2 text-warning" size={18} />
            <span className="small fw-500">Database connection intermittent. Performance metrics may reflect cached or baseline data.</span>
          </div>
        )}

        {scrapeProgress && (
          <div className="card border-0 shadow rounded-4 mb-4" style={{ overflow: 'hidden', borderLeft: '4px solid #4f46e5' }}>
            <div className="card-body p-4 bg-white">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div className="fw-bold text-primary d-flex align-items-center gap-2">
                  <RefreshCw size={18} className="animate-spin" />
                  Live Syncing Operation Data...
                </div>
                <div className="fw-bold text-primary smallest">
                  {scrapeProgress.processed} / {scrapeProgress.total} ASINs PROCESSED
                </div>
              </div>
              <ProgressBar
                value={(scrapeProgress.processed / scrapeProgress.total) * 100}
                color="primary"
                size="md"
              />
              <div className="text-muted smallest mt-2 fw-medium d-flex align-items-center gap-2">
                <div className="spinner-grow spinner-grow-sm text-primary" style={{ width: '8px', height: '8px' }}></div>
                {scrapeProgress.status}
              </div>
            </div>
          </div>
        )}

        {/* Single Collapsible Section containing KPIs and Performance Overview */}
        <CollapsibleSection
          title="ASIN Performance Overview"
          icon={TrendingUp}
          isOpen={showDashboard}
          onToggle={() => setShowDashboard(!showDashboard)}
        >
          {/* KPI Dashboard - Compact Dot Badges */}
          <div className="d-flex flex-wrap gap-3 mb-4 mt-2">
            {kpis.map((kpi, idx) => (
              <div
                key={idx}
                className="d-flex align-items-center gap-2 px-3 py-2 rounded-pill border bg-white border-light-subtle shadow-sm transition-all hover-shadow-md"
                style={{ fontSize: '13px', fontWeight: '500', minWidth: 'fit-content' }}
              >
                <div
                  className="d-flex align-items-center justify-content-center rounded-circle"
                  style={{ width: '24px', height: '24px', backgroundColor: kpi.color + '20', color: kpi.color }}
                >
                  {kpi.icon}
                </div>
                <div className="d-flex flex-column" style={{ lineHeight: '1.1' }}>
                  <span className="text-muted text-uppercase" style={{ fontSize: '9px', fontWeight: '700', letterSpacing: '0.05em' }}>{kpi.label}</span>
                  <span className="fw-bold text-dark" style={{ fontSize: '14px' }}>{kpi.value}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Performance Summary Cards */}
          <div className="row g-4 mb-4">
            <div className="col-lg-4">
              <div className="card h-100 border-zinc-200 shadow-sm" style={{ borderRadius: '16px', border: '1px solid var(--zinc-200)' }}>
                <div className="card-body p-4">
                  <div className="d-flex align-items-center gap-3 mb-4">
                    <div className="p-2 bg-success-subtle text-success rounded-3"><IndianRupee size={20} /></div>
                    <div>
                      <h6 className="mb-0 fw-bold text-zinc-900">Price Dynamics</h6>
                      <p className="text-muted smallest mb-0">Historical listing trends</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="d-flex justify-content-between align-items-center">
                      <span className="text-zinc-500 small">Average Price</span>
                      <span className="fw-bold text-zinc-900">₹{(stats?.avgPrice || 0).toLocaleString()}</span>
                    </div>
                    <div className="d-flex justify-content-between align-items-center">
                      <span className="text-zinc-500 small">Highest Recorded</span>
                      <span className="fw-bold text-success">₹{(Math.max(...asins.map(a => a.currentPrice || 0), 0)).toLocaleString()}</span>
                    </div>
                    <div className="d-flex justify-content-between align-items-center">
                      <span className="text-zinc-500 small">Lowest Entry</span>
                      <span className="fw-bold text-danger">₹{(Math.min(...asins.map(a => a.currentPrice || 0), Infinity) === Infinity ? 0 : Math.min(...asins.map(a => a.currentPrice || 0))).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="col-lg-4">
              <div className="card h-100 border-zinc-200 shadow-sm" style={{ borderRadius: '16px', border: '1px solid var(--zinc-200)' }}>
                <div className="card-body p-4">
                  <div className="d-flex align-items-center gap-3 mb-4">
                    <div className="p-2 bg-primary-subtle text-primary rounded-3"><BarChart2 size={20} /></div>
                    <div>
                      <h6 className="mb-0 fw-bold text-zinc-900">Algorithm Visibility</h6>
                      <p className="text-muted smallest mb-0">BSR & Category performance</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="d-flex justify-content-between align-items-center">
                      <span className="text-zinc-500 small">Average BSR</span>
                      <span className="fw-bold text-zinc-900">#{(stats?.avgBSR || 0).toLocaleString()}</span>
                    </div>
                    <div className="d-flex justify-content-between align-items-center">
                      <span className="text-zinc-500 small">Best Performer</span>
                      <span className="fw-bold text-primary">#{(Math.min(...asins.map(a => a.bsr || 9999999), 9999999) === 9999999 ? 0 : Math.min(...asins.map(a => a.bsr || 9999999))).toLocaleString()}</span>
                    </div>
                    <div className="d-flex justify-content-between align-items-center">
                      <span className="text-zinc-500 small">Tracking Pool</span>
                      <span className="fw-bold text-zinc-900">{stats?.total || 0} Active ASINs</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-lg-4">
              <div className="card h-100 border-zinc-200 shadow-sm" style={{ borderRadius: '16px', border: '1px solid var(--zinc-200)' }}>
                <div className="card-body p-4">
                  <div className="d-flex align-items-center gap-3 mb-4">
                    <div className="p-2 bg-warning-subtle text-warning rounded-3"><Zap size={20} /></div>
                    <div>
                      <h6 className="mb-0 fw-bold text-zinc-900">Optimization Index</h6>
                      <p className="text-muted smallest mb-0">A+ Content & Media Assets</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="d-flex justify-content-between align-items-center">
                      <span className="text-zinc-500 small">A+ Content Adoption</span>
                      <span className="fw-bold text-zinc-900">{asins.filter(a => a.hasAPlus).length} / {asins.length}</span>
                    </div>
                    <div className="d-flex justify-content-between align-items-center">
                      <span className="text-zinc-500 small">Avg Description</span>
                      <span className="fw-bold text-zinc-900">{Math.round(asins.reduce((sum, a) => sum + (a.descLength || 0), 0) / (asins.length || 1))} chars</span>
                    </div>
                    <div className="d-flex justify-content-between align-items-center">
                      <span className="text-zinc-500 small">Avg Media Assets</span>
                      <span className="fw-bold text-zinc-900">{Math.round(asins.reduce((sum, a) => sum + (a.imagesCount || 0), 0) / (asins.length || 1))} imgs</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CollapsibleSection>

        {/* Inventory & Performance Ledger Table */}
        <div className="card border-zinc-200 shadow-sm" style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--zinc-200)' }}>
          <div className="card-header d-flex justify-content-between align-items-center px-4 py-3" style={{ backgroundColor: '#fff', borderBottom: '1px solid var(--zinc-200)' }}>
            <h5 className="card-title mb-0 d-flex align-items-center gap-2 text-zinc-900 fw-bold" style={{ fontSize: '1.1rem' }}>
              <Table size={18} className="text-primary" />
              Inventory & Performance Ledger
              <span className="badge rounded-pill bg-primary-subtle text-primary border border-primary-subtle smallest px-3 ms-2" style={{ fontWeight: 600 }}>
                {asins.length} Active SKUs
              </span>
            </h5>
            <button
              className="btn btn-sm btn-light p-1 border-0 shadow-none hover-bg-light"
              onClick={() => setShowTable(!showTable)}
            >
              {showTable ? <ChevronUp size={20} className="text-muted" /> : <ChevronDown size={20} className="text-muted" />}
            </button>
          </div>
          {showTable && (
            <div className="card-body p-0" style={{ backgroundColor: '#fff' }}>
              <div className="d-flex justify-content-between align-items-center gap-2 p-3 border-bottom bg-zinc-50">
                <div className="d-flex align-items-center gap-2">
                  <div className="input-group input-group-sm rounded-pill overflow-hidden border border-zinc-200 shadow-sm" style={{ width: '320px', backgroundColor: '#fff' }}>
                    <span className="input-group-text bg-white border-0 text-muted ps-3"><Search size={14} /></span>
                    <input type="text" className="form-control border-0 ps-0" placeholder="Search ASIN, SKU or Product..." style={{ fontSize: '13px' }} />
                  </div>
                </div>
                <div className="d-flex gap-2">
                  <button className="btn btn-white btn-sm fw-bold d-flex align-items-center gap-2 shadow-sm border border-zinc-200 rounded-pill px-3 py-1.5" onClick={handleBulkCreateActions} disabled={asins.length === 0} style={{ fontSize: '12px' }}>
                    <Zap size={14} className="text-amber-500" /> Actions
                  </button>
                  <button className="btn btn-white btn-sm fw-bold d-flex align-items-center gap-2 shadow-sm border border-zinc-200 rounded-pill px-3 py-1.5" onClick={() => console.log('Export CSV')} style={{ fontSize: '12px' }}>
                    <Download size={14} className="text-primary" /> Export
                  </button>
                  <button className="btn btn-white btn-sm fw-bold d-flex align-items-center gap-2 shadow-sm border border-zinc-200 rounded-pill px-3 py-1.5" onClick={handleBulkScrape} disabled={asins.length === 0} style={{ fontSize: '12px' }}>
                    <RefreshCw size={14} className="text-zinc-500" /> Scrape All
                  </button>
                  <button className="btn btn-primary btn-sm fw-bold d-flex align-items-center gap-2 shadow-sm border-0 rounded-pill px-3 py-1.5" onClick={() => loadData()} style={{ fontSize: '12px' }}>
                    <RefreshCw size={14} /> Sync All
                  </button>
                </div>
              </div>

              {/* Scrollable table container */}
              <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px', margin: '0' }}>
                <table className="table table-bordered table-hover mb-0 w-100" style={{ fontSize: '0.8rem', minWidth: '1200px' }}>
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f9fafb', zIndex: 10 }}>
                    <tr>
                      <th rowSpan="3" style={{ verticalAlign: 'middle', backgroundColor: '#f3f4f6', color: '#111827', fontWeight: 600, borderBottom: '2px solid #d1d5db', padding: '0.75rem 0.5rem' }}>ASIN</th>
                      <th rowSpan="3" style={{ verticalAlign: 'middle', backgroundColor: '#f3f4f6', color: '#111827', fontWeight: 600, borderBottom: '2px solid #d1d5db', padding: '0.75rem 0.5rem' }}>Management / Buy Box</th>
                      <th rowSpan="3" style={{ verticalAlign: 'middle', backgroundColor: '#f3f4f6', color: '#111827', fontWeight: 600, borderBottom: '2px solid #d1d5db', padding: '0.75rem 0.5rem' }}>SKU</th>
                      <th rowSpan="3" style={{ verticalAlign: 'middle', backgroundColor: '#f3f4f6', color: '#111827', fontWeight: 600, borderBottom: '2px solid #d1d5db', padding: '0.75rem 0.5rem' }}>Category</th>
                      <th rowSpan="3" style={{ verticalAlign: 'middle', backgroundColor: '#f3f4f6', color: '#111827', fontWeight: 600, borderBottom: '2px solid #d1d5db', padding: '0.75rem 0.5rem', minWidth: '180px' }}>Product</th>
                      <th rowSpan="3" style={{ verticalAlign: 'middle', backgroundColor: '#f3f4f6', color: '#111827', fontWeight: 600, borderBottom: '2px solid #d1d5db', padding: '0.75rem 0.5rem' }}>Price</th>
                      <th colSpan={totalHistoryCols} style={{ backgroundColor: '#e0e7ff', color: '#3730a3', fontWeight: 700, textAlign: 'center', padding: '0.5rem', borderBottom: '1px solid #c7d2fe', fontSize: '12px', textTransform: 'uppercase' }}>Price by Week</th>
                      <th rowSpan="3" style={{ verticalAlign: 'middle', backgroundColor: '#f3f4f6', color: '#111827', fontWeight: 600, borderBottom: '2px solid #d1d5db', padding: '0.75rem 0.5rem', textAlign: 'center' }}>BSR</th>
                      <th colSpan={totalHistoryCols} style={{ backgroundColor: '#f0fdf4', color: '#166534', fontWeight: 700, textAlign: 'center', padding: '0.5rem', borderBottom: '1px solid #bbf7d0', fontSize: '10px', textTransform: 'uppercase' }}>
                        <div className="d-flex align-items-center justify-content-center gap-2">
                          <BarChart2 size={12} /> BSR by Week
                        </div>
                      </th>
                      <th rowSpan="3" style={{ verticalAlign: 'middle', backgroundColor: '#f3f4f6', color: '#111827', fontWeight: 600, borderBottom: '2px solid #d1d5db', padding: '0.75rem 0.5rem', textAlign: 'center' }}>Rating</th>
                      <th colSpan={totalHistoryCols} style={{ backgroundColor: '#fffbeb', color: '#92400e', fontWeight: 700, textAlign: 'center', padding: '0.5rem', borderBottom: '1px solid #fde68a', fontSize: '10px', textTransform: 'uppercase' }}>
                        <div className="d-flex align-items-center justify-content-center gap-2">
                          <Star size={12} /> Rating by Week
                        </div>
                      </th>
                      <th rowSpan="3" style={{ verticalAlign: 'middle', backgroundColor: '#f3f4f6', color: '#111827', fontWeight: 600, borderBottom: '2px solid #d1d5db', padding: '0.75rem 0.5rem', textAlign: 'center' }}>Reviews</th>
                      <th rowSpan="3" style={{ verticalAlign: 'middle', backgroundColor: '#f3f4f6', color: '#111827', fontWeight: 600, borderBottom: '2px solid #d1d5db', padding: '0.75rem 0.5rem', textAlign: 'center' }}>5/1 Split</th>
                      <th rowSpan="3" style={{ verticalAlign: 'middle', backgroundColor: '#f3f4f6', color: '#111827', fontWeight: 600, borderBottom: '2px solid #d1d5db', padding: '0.75rem 0.5rem', textAlign: 'center' }}>LQS</th>
                      <th rowSpan="3" style={{ verticalAlign: 'middle', backgroundColor: '#f3f4f6', color: '#111827', fontWeight: 600, borderBottom: '2px solid #d1d5db', padding: '0.75rem 0.5rem', textAlign: 'center' }}>Buy Box</th>
                      <th rowSpan="3" style={{ verticalAlign: 'middle', backgroundColor: '#f3f4f6', color: '#111827', fontWeight: 600, borderBottom: '2px solid #d1d5db', padding: '0.75rem 0.5rem', textAlign: 'center' }}>A+</th>
                      <th rowSpan="3" style={{ verticalAlign: 'middle', backgroundColor: '#f3f4f6', color: '#111827', fontWeight: 600, borderBottom: '2px solid #d1d5db', padding: '0.75rem 0.5rem', textAlign: 'center' }}>Images</th>
                      <th rowSpan="3" style={{ verticalAlign: 'middle', backgroundColor: '#f3f4f6', color: '#111827', fontWeight: 600, borderBottom: '2px solid #d1d5db', padding: '0.75rem 0.5rem', textAlign: 'center' }}>Bullets</th>
                      <th rowSpan="3" style={{ verticalAlign: 'middle', backgroundColor: '#f3f4f6', color: '#111827', fontWeight: 600, borderBottom: '2px solid #d1d5db', padding: '0.75rem 0.5rem', textAlign: 'center' }}>Status</th>
                      <th rowSpan="3" style={{ verticalAlign: 'middle', backgroundColor: '#f3f4f6', color: '#111827', fontWeight: 600, borderBottom: '2px solid #d1d5db', padding: '0.75rem 0.5rem', textAlign: 'center' }}>Scraped</th>
                      <th rowSpan="3" style={{ verticalAlign: 'middle', backgroundColor: '#f3f4f6', color: '#111827', fontWeight: 600, borderBottom: '2px solid #d1d5db', padding: '0.75rem 0.5rem', textAlign: 'center' }}>Actions</th>
                    </tr>
                    <tr>
                      {/* Week Group Headers */}
                      {historyStructure.map(week => (
                        <th key={`week-price-${week.label}`} colSpan={week.dates.length} style={{ backgroundColor: '#ebf0ff', color: '#4338ca', fontWeight: 700, fontSize: '10px', textAlign: 'center', borderBottom: '1px solid #c7d2fe' }}>{week.label}</th>
                      ))}
                      {historyStructure.map(week => (
                        <th key={`week-bsr-${week.label}`} colSpan={week.dates.length} style={{ backgroundColor: '#dcfce7', color: '#166534', fontWeight: 700, fontSize: '10px', textAlign: 'center', borderBottom: '1px solid #bbf7d0' }}>{week.label}</th>
                      ))}
                      {historyStructure.map(week => (
                        <th key={`week-rating-${week.label}`} colSpan={week.dates.length} style={{ backgroundColor: '#fffbeb', color: '#92400e', fontWeight: 700, fontSize: '10px', textAlign: 'center', borderBottom: '1px solid #fde68a' }}>{week.label}</th>
                      ))}
                    </tr>
                    <tr>
                      {/* Date Sub-headers */}
                      {historyStructure.map(week => week.dates.map((date, idx) => (
                        <th key={`date-price-${week.label}-${idx}`} style={{ backgroundColor: '#e0e7ff', color: '#3730a3', fontWeight: 500, fontSize: '0.65rem', padding: '0.25rem', border: '1px solid #c7d2fe', textAlign: 'center' }}>{date.label}</th>
                      )))}
                      {historyStructure.map(week => week.dates.map((date, idx) => (
                        <th key={`date-bsr-${week.label}-${idx}`} style={{ backgroundColor: '#dcfce7', color: '#166534', fontWeight: 500, fontSize: '0.65rem', padding: '0.25rem', border: '1px solid #bbf7d0', textAlign: 'center' }}>{date.label}</th>
                      )))}
                      {historyStructure.map(week => week.dates.map((date, idx) => (
                        <th key={`date-rating-${week.label}-${idx}`} style={{ backgroundColor: '#fffbeb', color: '#92400e', fontWeight: 500, fontSize: '0.65rem', padding: '0.25rem', border: '1px solid #fde68a', textAlign: 'center' }}>{date.label}</th>
                      )))}
                    </tr>
                  </thead>
                  <tbody>
                    {asins.map((asin, index) => (
                      <tr key={asin._id || index} style={{ backgroundColor: '#fff' }}>
                        <td style={{ fontWeight: 600, color: '#111827', padding: '0.75rem 0.5rem', borderBottom: '1px solid #e5e7eb' }}>
                          <div className="d-flex align-items-center gap-2">
                            <span 
                              onClick={() => handleViewAsin(asin)} 
                              style={{ cursor: 'pointer', color: '#2563eb' }}
                              className="hover-underline"
                            >
                              {asin.asinCode}
                            </span>
                            <button 
                              onClick={() => handleViewAsin(asin)} 
                              className="btn btn-link p-0 text-zinc-400 hover:text-primary transition-colors"
                              title="View History Charts"
                            >
                              <Eye size={14} />
                            </button>
                          </div>
                        </td>
                        <td style={{ color: '#4b5563', padding: '0.75rem 0.5rem', borderBottom: '1px solid #e5e7eb' }}>
                          <div className="d-flex flex-column" style={{ fontSize: '0.7rem' }}>
                            <span className="fw-bold text-dark">{asin.seller?.name || asin.seller || <span className="text-muted">Global</span>}</span>
                            {asin.soldBy && (
                              <span className="text-primary mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.65rem' }}>
                                <Store size={10} /> {asin.soldBy}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ color: '#4b5563', padding: '0.75rem 0.5rem', borderBottom: '1px solid #e5e7eb' }}>{asin.sku || <span style={{ color: '#9ca3af' }}>-</span>}</td>
                        <td style={{ color: '#4b5563', padding: '0.75rem 0.5rem', borderBottom: '1px solid #e5e7eb', fontSize: '0.75rem', maxWidth: '120px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={asin.category || ''}>{asin.category || <span style={{ color: '#9ca3af' }}>-</span>}</td>
                        <td style={{ padding: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>
                          <div className="d-flex align-items-center gap-2" style={{ maxWidth: '280px' }}>
                            <img src={asin.imageUrl} alt={asin.title} style={{ width: '32px', height: '32px', borderRadius: '4px', objectFit: 'cover', flexShrink: 0 }} />
                              <span 
                                onClick={() => handleViewAsin(asin)}
                                style={{
                                  display: 'block',
                                  whiteSpace: 'normal',
                                  wordBreak: 'break-word',
                                  lineHeight: '1.3',
                                  fontSize: '0.85rem',
                                  cursor: 'pointer'
                                }}
                                className="hover-text-primary"
                              >
                                {asin.title}
                              </span>
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', borderBottom: '1px solid #e5e7eb' }}>
                          <div className="d-flex flex-column align-items-center">
                            <span style={{ fontWeight: 600, color: '#059669' }}>
                              {asin.currentPrice ? `₹${asin.currentPrice.toLocaleString()}` : <span style={{ color: '#9ca3af' }}>-</span>}
                            </span>
                            {asin.mrp > asin.currentPrice && (
                              <div className="d-flex align-items-center gap-1" style={{ fontSize: '0.65rem' }}>
                                <span className="text-muted text-decoration-line-through">₹{asin.mrp.toLocaleString()}</span>
                                <span className="text-danger fw-bold">-{Math.round(((asin.mrp - asin.currentPrice) / asin.mrp) * 100)}%</span>
                              </div>
                            )}
                          </div>
                        </td>
                        {/* Price by Week columns */}
                        {historyStructure.map(week => week.dates.map((date, idx) => {
                          const wData = asin.weekHistory?.find(w => new Date(w.date).toDateString() === new Date(date.raw).toDateString());
                          return (
                            <td key={`price-${week.label}-${idx}`} style={{ backgroundColor: '#f5f3ff', padding: '0.5rem 0.25rem', border: '1px solid #e5e7eb', textAlign: 'center', verticalAlign: 'middle' }}>
                              {wData && wData.price ? getWeekHistoryBadge(wData.price, 'price') : '-'}
                            </td>
                          );
                        }))}
                        <td style={{ padding: '0.75rem 0.5rem', borderBottom: '1px solid #e5e7eb', verticalAlign: 'middle' }}>
                          <div className="d-flex flex-column align-items-center">
                            <span style={{ fontWeight: 600, color: '#2563eb' }}>
                              {asin.bsr ? `#${asin.bsr.toLocaleString()}` : <span style={{ color: '#9ca3af' }}>-</span>}
                            </span>
                            {asin.subBSRs && asin.subBSRs.length > 0 && (
                              <div className="mt-1 d-flex flex-column gap-1 w-100">
                                {asin.subBSRs.map((sub, idx) => (
                                  <span key={idx} className="smallest text-muted text-center" style={{ fontSize: '0.65rem', lineHeight: '1.2' }}>
                                    #{sub}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                        {/* BSR by Week columns */}
                        {historyStructure.map(week => week.dates.map((date, idx) => {
                          const wData = asin.weekHistory?.find(w => new Date(w.date).toDateString() === new Date(date.raw).toDateString());
                          return (
                            <td key={`bsr-${week.label}-${idx}`} style={{ backgroundColor: '#f0fdf4', padding: '0.5rem 0.25rem', border: '1px solid #e5e7eb', textAlign: 'center', verticalAlign: 'middle' }}>
                              {wData && wData.bsr ? (
                                <div className="d-flex flex-column align-items-center">
                                  {getWeekHistoryBadge(wData.bsr, 'number')}
                                  {wData.subBSRs && wData.subBSRs.length > 0 && (
                                    <div className="mt-1 d-flex flex-column gap-1 w-100">
                                      {wData.subBSRs.map((sub, sIdx) => (
                                        <span key={sIdx} className="smallest text-muted text-center" style={{ fontSize: '0.6rem', lineHeight: '1.2' }}>
                                          #{sub}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ) : '-'}
                            </td>
                          );
                        }))}
                        <td style={{ padding: '0.75rem 0.5rem', borderBottom: '1px solid #e5e7eb', verticalAlign: 'middle' }}>
                          {asin.rating ? (
                            <div className="d-flex align-items-center justify-content-center gap-1">
                              <Star size={12} className="text-warning fill-warning" />
                              <span style={{ fontWeight: 500 }}>{asin.rating}</span>
                            </div>
                          ) : <span style={{ color: '#9ca3af', display: 'block', textAlign: 'center' }}>-</span>}
                        </td>
                        {/* Rating by Week columns */}
                        {historyStructure.map(week => week.dates.map((date, idx) => {
                          const wData = asin.weekHistory?.find(w => new Date(w.date).toDateString() === new Date(date.raw).toDateString());
                          return (
                            <td key={`rating-${week.label}-${idx}`} style={{ backgroundColor: '#fffbeb', padding: '0.5rem 0.25rem', border: '1px solid #e5e7eb', textAlign: 'center', verticalAlign: 'middle' }}>
                              {wData && wData.rating ? getWeekHistoryBadge(wData.rating, 'rating') : '-'}
                            </td>
                          );
                        }))}
                        <td style={{ padding: '0.75rem 0.5rem', borderBottom: '1px solid #e5e7eb', textAlign: 'center', verticalAlign: 'middle' }}>
                          {asin.reviewCount ? asin.reviewCount.toLocaleString() : <span style={{ color: '#9ca3af' }}>-</span>}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', borderBottom: '1px solid #e5e7eb', textAlign: 'center', verticalAlign: 'middle' }}>
                          {renderRatingBreakdown(asin.ratingBreakdown)}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', borderBottom: '1px solid #e5e7eb', textAlign: 'center', verticalAlign: 'middle' }}>
                          {asin.lqs ? getLqsBadge(asin.lqs) : <span style={{ color: '#9ca3af' }}>-</span>}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', borderBottom: '1px solid #e5e7eb', textAlign: 'center', verticalAlign: 'middle' }}>
                          {getBuyBoxBadge(asin.buyBoxWin, asin.status)}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', borderBottom: '1px solid #e5e7eb', textAlign: 'center', verticalAlign: 'middle' }}>
                          {getAplusBadge(asin.hasAplus, asin.status)}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', borderBottom: '1px solid #e5e7eb', textAlign: 'center', verticalAlign: 'middle' }}>
                          {asin.imagesCount ? (
                            <span className="badge" style={{ backgroundColor: '#f3f4f6', color: '#374151', fontWeight: 500 }}>
                              {asin.imagesCount}
                            </span>
                          ) : <span style={{ color: '#9ca3af' }}>-</span>}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', borderBottom: '1px solid #e5e7eb', textAlign: 'center', verticalAlign: 'middle' }}>
                          {asin.bulletPoints ? (
                            <span className="badge" style={{ backgroundColor: '#f3f4f6', color: '#374151', fontWeight: 500 }}>
                              {asin.bulletPoints}
                            </span>
                          ) : <span style={{ color: '#9ca3af' }}>-</span>}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', borderBottom: '1px solid #e5e7eb', textAlign: 'center', verticalAlign: 'middle' }}>
                          {asin.descLength ? (
                            <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                              {asin.descLength}
                            </span>
                          ) : <span style={{ color: '#9ca3af' }}>-</span>}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', borderBottom: '1px solid #e5e7eb', textAlign: 'center', verticalAlign: 'middle' }}>
                          {getStatusBadge(asin.status)}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', borderBottom: '1px solid #e5e7eb', textAlign: 'center', verticalAlign: 'middle' }}>
                          {asin.lastScraped ? (
                            <span style={{ fontSize: '0.75rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                              {new Date(asin.lastScraped).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : <span style={{ color: '#9ca3af' }}>-</span>}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', borderBottom: '1px solid #e5e7eb', textAlign: 'center', verticalAlign: 'middle' }}>
                          <div className="d-flex align-items-center justify-content-center gap-1">
                            <button
                              className="btn btn-sm btn-outline-primary rounded-pill d-flex align-items-center gap-1"
                              style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem' }}
                              onClick={() => handleIndividualScrape(asin._id)}
                              disabled={scrapingIds.has(asin._id) || asin.scrapeStatus === 'SCRAPING'}
                            >
                              {(scrapingIds.has(asin._id) || asin.scrapeStatus === 'SCRAPING') ? (
                                <><RefreshCw size={12} className="spin" /> Scraping...</>
                              ) : (
                                <><RefreshCw size={12} /> Scrape</>
                              )}
                            </button>
                            <button
                              className="btn btn-sm btn-outline-success rounded-pill d-flex align-items-center gap-1"
                              style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem', whiteSpace: 'nowrap' }}
                              onClick={() => handleCreateTasks(asin._id, asin.asinCode)}
                            >
                              <Plus size={12} /> Create Task
                            </button>
                            {asin.imagesCount < 7 && (
                              <button
                                className="btn btn-sm btn-warning rounded-pill d-flex align-items-center gap-1"
                                style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem', whiteSpace: 'nowrap', backgroundColor: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' }}
                                onClick={() => handleGenerateAiImages(asin._id, asin.asinCode)}
                                disabled={scrapingIds.has(asin._id)}
                              >
                                {scrapingIds.has(asin._id) ? <RefreshCw size={12} className="spin" /> : <Sparkles size={12} />}
                                AI Image
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination UI */}
              <div className="d-flex justify-content-between align-items-center p-4 border-top bg-light-subtle">
                <div className="text-muted small">
                  Showing <span className="fw-bold">{asins.length}</span> of <span className="fw-bold">{pagination.total}</span> ASINs
                </div>
                <nav>
                  <ul className="pagination pagination-sm mb-0 gap-1">
                    <li className={`page-item ${pagination.page === 1 ? 'disabled' : ''}`}>
                      <button
                        className="page-link rounded-pill border-0 shadow-sm px-3"
                        onClick={() => loadData(pagination.page - 1)}
                        disabled={pagination.page === 1}
                      >
                        Previous
                      </button>
                    </li>
                    {[...Array(pagination.totalPages)].map((_, i) => {
                      const pageNum = i + 1;
                      // Only show first, last, and pages around current
                      if (
                        pageNum === 1 ||
                        pageNum === pagination.totalPages ||
                        (pageNum >= pagination.page - 1 && pageNum <= pagination.page + 1)
                      ) {
                        return (
                          <li key={pageNum} className={`page-item ${pagination.page === pageNum ? 'active' : ''}`}>
                            <button
                              className={`page-link rounded-circle border-0 shadow-sm mx-1 ${pagination.page === pageNum ? 'bg-primary' : ''}`}
                              onClick={() => loadData(pageNum)}
                              style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              {pageNum}
                            </button>
                          </li>
                        );
                      } else if (
                        pageNum === pagination.page - 2 ||
                        pageNum === pagination.page + 2
                      ) {
                        return <li key={pageNum} className="page-item disabled"><span className="page-link border-0">...</span></li>;
                      }
                      return null;
                    })}
                    <li className={`page-item ${pagination.page === pagination.totalPages ? 'disabled' : ''}`}>
                      <button
                        className="page-link rounded-pill border-0 shadow-sm px-3"
                        onClick={() => loadData(pagination.page + 1)}
                        disabled={pagination.page === pagination.totalPages}
                      >
                        Next
                      </button>
                    </li>
                  </ul>
                </nav>
              </div>
            </div>
          )}
        </div>

        {/* Add ASIN Modal */}
        {showAddModal && (
          <div className="modal show d-block" style={{ backgroundColor: 'rgba(17, 24, 39, 0.7)', backdropFilter: 'blur(4px)' }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '24px' }}>
                <div className="modal-header border-0 px-4 pt-4 pb-0">
                  <h5 className="h5 fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                    <div className="p-2 bg-primary-subtle text-primary rounded-3">
                      <Plus size={20} />
                    </div>
                    Add New ASINs
                  </h5>
                  <button type="button" className="btn-close" onClick={() => setShowAddModal(false)}></button>
                </div>
                <div className="modal-body px-4 py-4">
                  <p className="text-muted small mb-4">Enter Amazon Standard Identification Numbers separated by commas. Our agents will begin scraping live performance data immediately.</p>
                  <div className="mb-0">
                    <label className="form-label fw-bold text-dark small mb-2 d-flex align-items-center gap-2">
                      <Scan size={14} className="text-primary" /> Target ASIN List
                    </label>
                    <textarea
                      className="form-control border shadow-sm"
                      rows="4"
                      style={{ borderRadius: '12px', fontSize: '14px', padding: '12px' }}
                      placeholder="Enter ASINs here (one per line or comma separated)..."
                      value={newAsin}
                      onChange={(e) => setNewAsin(e.target.value)}
                    ></textarea>
                  </div>
                  <div className="mt-4">
                    <label className="form-label fw-bold text-dark small mb-2 d-flex align-items-center gap-2">
                       <Store size={14} className="text-primary" /> Target Seller Association
                    </label>
                    <select 
                      className="form-select border shadow-sm"
                      style={{ borderRadius: '12px', fontSize: '14px', padding: '10px' }}
                      value={selectedSellerId}
                      onChange={(e) => setSelectedSellerId(e.target.value)}
                    >
                      <option value="">Select a seller...</option>
                      {sellers.map(seller => (
                        <option key={seller._id} value={seller._id}>{seller.name}</option>
                      ))}
                    </select>
                    <p className="text-muted smallest mt-2 px-1">Mapping these ASINs to a seller ensures correct inventory tracking and performance attribution.</p>
                  </div>
                </div>
                <div className="modal-footer border-0 px-4 pb-4 pt-0">
                  <button type="button" className="btn btn-light fw-bold rounded-pill px-4" onClick={() => setShowAddModal(false)}>Cancel</button>
                  <button type="button" className="btn btn-primary fw-bold rounded-pill px-4 shadow-sm" onClick={handleSync} disabled={syncing}>
                    {syncing ? <><RefreshCw size={16} className="me-2 spin" /> Initiating...</> : 'Start Scraping'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <AsinDetailModal 
        asin={selectedAsin} 
        isOpen={showDetailModal} 
        onClose={() => setShowDetailModal(false)} 
      />
    </div>
  );
};

export default AsinManagerPage;
