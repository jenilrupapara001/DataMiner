import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy, useRef } from 'react';
import { Drawer, Button, Input, Select, Space, Typography, Badge, Segmented, Tooltip, Dropdown, Menu, Modal, Form, Tag, message } from 'antd';
const { Text, Title } = Typography;
const TablePagination = lazy(() => import('@mui/material/TablePagination'));
import KPICard from '../components/KPICard';
import ProgressBar from '../components/common/ProgressBar';
import EmptyState from '../components/common/EmptyState';
import octoparseService from '../services/octoparseService';
import { db } from '../services/db';
import { asinApi, marketSyncApi, sellerApi, taskApi, rulesetApi } from '../services/api';
import InfiniteScrollSelect from '../components/common/InfiniteScrollSelect';
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
  PlusCircle,
  Table,
  ChevronDown,
  ChevronUp,
  Download,
  RefreshCw,
  Search,
  Scan,
  IndianRupee,
  ChevronRight,
  ChevronLeft,
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
  Clock,
  ExternalLink,
  Video,
  PlayCircle,
  PauseCircle,
  Award,
  Filter,
  Tag as TagIcon,
  SlidersHorizontal,
  Megaphone,
  MoreVertical,
  MoreHorizontal,
  Edit3,
  Upload
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useRefresh } from '../contexts/RefreshContext';
import { useHeader } from '../contexts/HeaderContext';
import { PageLoader } from '@/components/application/loading-indicator/PageLoader';
import { LoadingIndicator } from '@/components/application/loading-indicator/loading-indicator';
const AsinDetailModal = lazy(() => import('../components/AsinDetailModal'));
const AsinTrendsModal = lazy(() => import('../components/AsinTrendsModal'));
const PriceViewModal = lazy(() => import('../components/PriceViewModal'));
const BSRViewModal = lazy(() => import('../components/BSRViewModal'));
const RatingViewModal = lazy(() => import('../components/RatingViewModal'));
const ExportAsinModal = lazy(() => import('../components/asins/ExportAsinModal'));
const EditTagsModal = lazy(() => import('../components/asins/EditTagsModal'));
const BulkImportModal = lazy(() => import('../components/asins/BulkImportModal'));
import TagsCell from '../components/asins/TagsCell';
import BulkTagsModal from '../components/asins/BulkTagsModal';
import { useColumnVisibility, ALL_COLUMNS, COLUMN_CATEGORIES } from '../hooks/useColumnVisibility';
import ColumnVisibilityPanel from '../components/asins/ColumnVisibilityPanel';

import Popover from '../components/common/Popover';

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

// Helper to generate history structure from actual availability (Oldest to Newer)
const generateHistoryStructureFromDates = (sortedDates) => {
  if (!sortedDates || sortedDates.length === 0) return [{ label: 'W1', dates: [{ label: 'N/A' }] }];

  // Limit to most recent 7 unique days available in the data
  const recentDates = sortedDates.slice(-7);

  return [{
    label: 'Current Week',
    dates: recentDates.map(dateStr => {
      const date = new Date(`${dateStr}T00:00:00Z`);
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

// Helper to normalize dates to YYYY-MM-DD string without timezone offset
const normalizeDateStr = (dateInput) => {
  if (!dateInput) return '';
  if (typeof dateInput === 'string') {
    return dateInput.substring(0, 10);
  }
  try {
    return new Date(dateInput).toISOString().split('T')[0];
  } catch (e) {
    return '';
  }
};

// Helper function for week history badges
const getWeekHistoryBadge = (value, type, uploadedPrice = 0) => {
  if (value === undefined || value === null || value === '') return <span style={{ color: '#9ca3af' }}>-</span>;

  if (type === 'price') {
    return (
      <div className="d-flex flex-column align-items-center justify-content-center">
        <span style={{
          fontWeight: 700,
          color: '#059669',
          fontSize: '10.5px',
          lineHeight: 1
        }}>
          ₹{value.toLocaleString()}
        </span>
      </div>
    );
  } else if (type === 'number') {
    return <span style={{ fontWeight: 600, color: '#2563eb', fontSize: '10.5px' }}>#{value.toLocaleString()}</span>;
  } else if (type === 'rating') {
    return <span style={{ fontWeight: 600, color: '#d97706', fontSize: '10.5px' }}>{value.toFixed(1)}</span>;
  } else if (type === 'subBsr') {
    const clean = String(value).replace(/[^0-9]/g, '');
    if (!clean) return <span style={{ color: '#9ca3af' }}>-</span>;
    const num = parseInt(clean, 10);
    if (isNaN(num)) return <span style={{ color: '#9ca3af' }}>-</span>;
    return <span style={{ fontWeight: 600, color: '#7c3aed', fontSize: '10px' }}>#{num.toLocaleString()}</span>;
  }
  return value;
};

// Trend Badge Component
const TrendBadge = ({ status }) => {
  if (!status || status === 'Stable') return (
    <div className="d-flex align-items-center gap-1 text-zinc-400" style={{ fontSize: '10px', fontWeight: 600 }}>
      <Activity size={10} />
      <span>Stable</span>
    </div>
  );

  if (status === 'Grow') {
    return (
      <div className="d-flex align-items-center gap-1 text-emerald-600" style={{ fontSize: '10px', fontWeight: 700 }}>
        <TrendingUp size={10} />
        <span>GROW</span>
      </div>
    );
  }

  if (status === 'Down') {
    return (
      <div className="d-flex align-items-center gap-1 text-red-500" style={{ fontSize: '10px', fontWeight: 700 }}>
        <TrendingDown size={10} />
        <span>DOWN</span>
      </div>
    );
  }

  return <span style={{ fontSize: '10px' }}>{status}</span>;
};

const getReviewTrendStatus = (asin) => {
  if (asin.reviewTrendStatus) return asin.reviewTrendStatus;

  let history = [];
  try {
    history = asin.History ? (typeof asin.History === 'string' ? JSON.parse(asin.History) : asin.History) : [];
  } catch (e) {
    history = [];
  }

  if (!Array.isArray(history) || history.length < 2) return 'Stable';

  const sortedHistory = [...history].sort((a, b) => new Date(a.date) - new Date(b.date));
  const currentReviews = asin.reviewCount || sortedHistory[sortedHistory.length - 1]?.reviews || sortedHistory[sortedHistory.length - 1]?.reviewCount || 0;

  const prevPoints = sortedHistory.slice(0, -1).filter(h => (h.reviews || h.reviewCount || 0) > 0);
  if (prevPoints.length === 0) return 'Stable';

  const baselineReviews = prevPoints[prevPoints.length - 1].reviews || prevPoints[prevPoints.length - 1].reviewCount || 0;

  if (currentReviews < baselineReviews) return 'Down';
  if (currentReviews > baselineReviews) return 'Grow';
  return 'Stable';
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

const AsinManagerPage = (props) => {
  const { isAdmin, isGlobalUser, hasPermission } = useAuth();
  const [asins, setAsins] = useState([]);
  const [globalHistoryDates, setGlobalHistoryDates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDashboard, setShowDashboard] = useState(true);
  const [showTable, setShowTable] = useState(true);
  const [newAsin, setNewAsin] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showManualTaskModal, setShowManualTaskModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskPriority, setTaskPriority] = useState('MEDIUM');
  const [taskCategory, setTaskCategory] = useState('GENERAL_OPTIMIZATION');
  const [error, setError] = useState(null);
  const [scrapingIds, setScrapingIds] = useState(new Set());
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [sortBy, setSortBy] = useState('lastLiveSyncAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const { setPageMeta } = useHeader();

  useEffect(() => {
    setPageMeta({
      title: 'ASIN Manager',
      subtitle: `Managing ${pagination.total} ASINs`,
      breadcrumbs: [{ label: 'Workspace' }, { label: 'ASIN Manager' }],
    });
  }, [setPageMeta, pagination.total]);
  const [scrapeProgress, setScrapeProgress] = useState(null);
  const socket = useSocket();
  const [selectedAsin, setSelectedAsin] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showTrendsModal, setShowTrendsModal] = useState(false);
  const [trendsMetric, setTrendsMetric] = useState('price');
  const [sellers, setSellers] = useState([]);
  const [selectedSellerId, setSelectedSellerId] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
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
  const [selectedSeller, setSelectedSeller] = useState(() => localStorage.getItem('selectedSeller') || '');
  // Persist seller selection
  useEffect(() => {
    localStorage.setItem('selectedSeller', selectedSeller);
  }, [selectedSeller]);

  const [marketplaceFilter, setMarketplaceFilter] = useState(() => localStorage.getItem('selectedMarketplace') || 'all');
  // Persist marketplace selection
  useEffect(() => {
    localStorage.setItem('selectedMarketplace', marketplaceFilter);
  }, [marketplaceFilter]);

  const canAccessAmazon = isAdmin || hasPermission('marketplace_amazon');
  const canAccessAjio = isAdmin || hasPermission('marketplace_ajio');
  const canAccessMyntra = isAdmin || hasPermission('marketplace_myntra');

  useEffect(() => {
    if (!canAccessAmazon && !canAccessMyntra && canAccessAjio && marketplaceFilter !== 'ajio') {
      setMarketplaceFilter('ajio');
    } else if (!canAccessAmazon && !canAccessAjio && canAccessMyntra && marketplaceFilter !== 'myntra') {
      setMarketplaceFilter('myntra');
    } else if (canAccessAmazon && !canAccessAjio && !canAccessMyntra && (marketplaceFilter === 'ajio' || marketplaceFilter === 'myntra' || marketplaceFilter === 'all')) {
      setMarketplaceFilter('amazon.in');
    }
  }, [canAccessAmazon, canAccessAjio, canAccessMyntra, marketplaceFilter]);

  const [repairStatus, setRepairStatus] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [activeEditAsin, setActiveEditAsin] = useState(null);
  const [importingTags, setImportingTags] = useState(false);
  const tagsImportRef = useRef(null);
  const initialLoadCompleteRef = useRef(false);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [filterTrigger, setFilterTrigger] = useState(0);
  const {
    visibleColumns,
    isVisible: baseIsVisible,
    toggleColumn,
    toggleCategory,
    resetToDefaults,
    selectAll,
    updateVisibleColumns,
    visibleCount,
    totalCount,
    allColumns,
    columnCategories,
    isCatalogManager
  } = useColumnVisibility();

  const isVisible = useCallback((key) => {
    // Removed restriction for marketplaceFilter === 'ajio' to ensure parity with Amazon datatable.

    // For Amazon/General datatables: Show Deal Badge, but hide Discount Percentage as requested
    if (key === 'discountPercentage') return false;
    if (key === 'dealBadge') return true;

    return baseIsVisible(key);
  }, [baseIsVisible, marketplaceFilter]);

  const [showColumnPanel, setShowColumnPanel] = useState(false);
  const [showBulkTagsModal, setShowBulkTagsModal] = useState(false);
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  const actionsRef = useRef(null);

  const historyStructure = useMemo(() => {
    if (globalHistoryDates && globalHistoryDates.length > 0) {
      // Lexical sort on YYYY-MM-DD gives chronological order (Oldest -> Newest)
      // Reverse if needed, but generateHistoryStructureFromDates takes sorted Oldest -> Newest
      const sortedDates = [...globalHistoryDates].sort();
      return generateHistoryStructureFromDates(sortedDates);
    }
    return [{ label: 'W1', dates: [{ label: 'N/A' }] }];
  }, [globalHistoryDates]);

  const totalHistoryCols = useMemo(() => {
    if (!historyStructure) return 0;
    return historyStructure.reduce((sum, w) => sum + w.dates.length, 0);
  }, [historyStructure]);

  const visibleHistoryCols = useMemo(() => {
    if (!historyStructure) return 0;
    // Since we now always show exactly the entries in historyStructure (7 days)
    return historyStructure.reduce((sum, w) => sum + w.dates.length, 0);
  }, [historyStructure]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (actionsRef.current && !actionsRef.current.contains(event.target)) {
        setShowActionsDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [priceTrendExpanded, setPriceTrendExpanded] = useState(false);
  const [bsrTrendExpanded, setBsrTrendExpanded] = useState(false);
  const [ratingTrendExpanded, setRatingTrendExpanded] = useState(false);
  const [reviewTrendExpanded, setReviewTrendExpanded] = useState(false);
  const [imageTrendExpanded, setImageTrendExpanded] = useState(false);
  const [ordersExpanded, setOrdersExpanded] = useState(false);
  const [availableMonths, setAvailableMonths] = useState([]);

  const formatMonthHeader = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  };

  const visibleLQSCount = useMemo(() => ['titleScore', 'bulletScore', 'imageScore', 'descriptionScore', 'lqs'].filter(isVisible).length, [isVisible]);
  const visibleOrdersCount = useMemo(() => {
    if (!isVisible('totalOrders')) return 0;
    return ordersExpanded ? availableMonths.length + 1 : 1;
  }, [isVisible, ordersExpanded, availableMonths]);

  const hasSecondHeaderRow = useMemo(() => {
    if (visibleLQSCount > 0) return true;
    if (ordersExpanded && isVisible('totalOrders')) return true;
    if (isVisible('priceTrend') || isVisible('bsrTrend') || isVisible('ratingTrend') || isVisible('reviewTrend') || isVisible('imageTrend')) return true;
    return false;
  }, [visibleLQSCount, ordersExpanded, isVisible]);
  const visiblePriceTrendCount = useMemo(() => {
    if (!isVisible('priceTrend')) return 0;
    return visibleHistoryCols;
  }, [isVisible, visibleHistoryCols]);

  const visibleBsrTrendCount = useMemo(() => {
    if (!isVisible('bsrTrend')) return 0;
    return visibleHistoryCols;
  }, [isVisible, visibleHistoryCols]);

  const visibleRatingTrendCount = useMemo(() => {
    if (!isVisible('ratingTrend')) return 0;
    return visibleHistoryCols;
  }, [isVisible, visibleHistoryCols]);

  const visibleReviewTrendCount = useMemo(() => {
    if (!isVisible('reviewTrend')) return 0;
    return visibleHistoryCols;
  }, [isVisible, visibleHistoryCols]);

  const visibleImageTrendCount = useMemo(() => {
    if (!isVisible('imageTrend')) return 0;
    return visibleHistoryCols;
  }, [isVisible, visibleHistoryCols]);

  const getTransitionStyle = (isExpanded, index, totalCount, baseWidth = '42px') => {
    const isLast = index === totalCount - 1;
    const isVisible = isExpanded || isLast;
    return {
      width: isVisible ? baseWidth : '0px',
      minWidth: isVisible ? baseWidth : '0px',
      maxWidth: isVisible ? baseWidth : '0px',
      opacity: isVisible ? 1 : 0,
      padding: isVisible ? '2px 4px' : '0px',
      borderLeftWidth: isVisible ? '1px' : '0px',
      borderRightWidth: isVisible ? '1px' : '0px',
      overflow: 'hidden',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      pointerEvents: isVisible ? 'auto' : 'none',
      whiteSpace: 'nowrap'
    };
  };

  const [tagSearch, setTagSearch] = useState('');
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [filters, setFilters] = useState({
    category: '',
    brand: '',
    scrapeStatus: '',
    parentAsin: '',
    tag: '',
    sku: '',
    minPrice: '',
    maxPrice: '',
    minBSR: '',
    maxBSR: '',
    minRating: '',
    maxRating: '',
    minReviewCount: '',
    maxReviewCount: '',
    minImagesCount: '',
    maxImagesCount: '',
    minBulletPoints: '',
    maxBulletPoints: '',
    subBsrCategory: '',
    buyBoxWin: '',
    hasAplus: '',
    hasVideo: '',
    hasDeal: '',
    ageFilter: '',
    selectedTags: [],
    minReleaseDate: '',
    maxReleaseDate: '',
    priceDispute: '',
    bsrTrend: '',
    ratingTrend: '',
    historyDays: '',
    ads: '',
    availabilityStatus: '',
    manufacturer: '',
    dealAccessType: ''
  });

  const [appliedSearchQuery, setAppliedSearchQuery] = useState('');
  const [appliedFilters, setAppliedFilters] = useState({
    status: '',
    category: '',
    brand: '',
    scrapeStatus: '',
    parentAsin: '',
    tag: '',
    sku: '',
    minPrice: '',
    maxPrice: '',
    minBSR: '',
    maxBSR: '',
    minRating: '',
    maxRating: '',
    minReviewCount: '',
    maxReviewCount: '',
    minImagesCount: '',
    maxImagesCount: '',
    minBulletPoints: '',
    maxBulletPoints: '',
    subBsrCategory: '',
    buyBoxWin: '',
    hasAplus: '',
    hasVideo: '',
    hasDeal: '',
    ageFilter: '',
    selectedTags: [],
    minReleaseDate: '',
    maxReleaseDate: '',
    priceDispute: '',
    bsrTrend: '',
    ratingTrend: '',
    historyDays: '',
    ads: '',
    availabilityStatus: '',
    manufacturer: '',
    dealAccessType: ''
  });
  const [filterOptions, setFilterOptions] = useState({
    categories: [],
    brands: [],
    scrapeStatuses: [],
    statuses: [],
    tags: []
  });

  // Explicit Apply Handlers
  const handleApplySearch = () => {
    setSelectedIds(new Set()); // Reset selection on new search
    setAppliedSearchQuery(searchQuery);
  };

  const resetAllFilters = useCallback(() => {
    const resetState = {
      category: '', brand: '', scrapeStatus: '',
      parentAsin: '', sku: '', subBsrCategory: '',
      minPrice: '', maxPrice: '', minBSR: '', maxBSR: '',
      minRating: '', maxRating: '',
      selectedTags: [],
      buyBoxWin: '', hasAplus: '', hasVideo: '', hasDeal: '',
      ageFilter: '', minReleaseDate: '', maxReleaseDate: '',
      minReviewCount: '', maxReviewCount: '', minImagesCount: '', maxImagesCount: '',
      minBulletPoints: '', maxBulletPoints: '',
      bsrTrend: '', ratingTrend: '', historyDays: '', ads: '',
      availabilityStatus: '', manufacturer: '', dealAccessType: ''
    };
    setFilters(resetState);
    setAppliedFilters(resetState);
    setSearchQuery('');
    setAppliedSearchQuery('');
    setFilterPanelOpen(false);
    setFilterTrigger(t => t + 1);
  }, []);

  const removeAppliedFilter = useCallback((key, value = null) => {
    setAppliedFilters(prev => {
      const next = { ...prev };
      if (key === 'selectedTags') {
        next.selectedTags = (next.selectedTags || []).filter(t => t !== value);
      } else {
        next[key] = '';
      }
      return next;
    });
    // Also sync the drawer filters state
    setFilters(prev => {
      const next = { ...prev };
      if (key === 'selectedTags') {
        next.selectedTags = (next.selectedTags || []).filter(t => t !== value);
      } else {
        next[key] = '';
      }
      return next;
    });
    setFilterTrigger(t => t + 1);
  }, []);

  const getAppliedFiltersBadges = useCallback(() => {
    const badges = [];
    const mapping = {
      sku: 'SKU',
      parentAsin: 'Parent ASIN',
      scrapeStatus: 'Scrape Status',
      brand: 'Brand',
      category: 'Category',
      subBsrCategory: 'Sub BSR',
      buyBoxWin: 'BuyBox Winner',
      hasAplus: 'A+ Content',
      hasVideo: 'Video',
      hasDeal: 'Deal',
      minPrice: 'Min Price',
      maxPrice: 'Max Price',
      minBSR: 'Min BSR',
      maxBSR: 'Max BSR',
      minRating: 'Min Rating',
      maxRating: 'Max Rating',
      ageFilter: 'Age',
      minReleaseDate: 'From',
      maxReleaseDate: 'To',
      priceDispute: 'Price Dispute',
      bsrTrend: 'BSR Trend',
      ratingTrend: 'Rating Trend',
      historyDays: 'History Range',
      ads: 'Ads',
      availabilityStatus: 'Availability',
      manufacturer: 'Manufacturer',
      dealAccessType: 'Deal Type'
    };

    Object.entries(appliedFilters).forEach(([key, value]) => {
      if (value && mapping[key]) {
        let label = value;
        if (value === 'true') label = 'Yes';
        if (value === 'false') label = 'No';

        badges.push(
          <div key={key} className="d-flex align-items-center gap-1.5 px-2 border shadow-sm" style={{ height: '26px', fontSize: '10px', backgroundColor: '#f4f4f5', color: '#3f3f46', borderColor: '#e4e4e7', borderRadius: '6px' }}>
            <span className="fw-bold opacity-70 text-uppercase" style={{ fontSize: '8px', letterSpacing: '0.02em' }}>{mapping[key]}:</span>
            <span className="fw-bold">{label}</span>
            <button
              type="button"
              className="p-0 border-0 bg-transparent d-flex align-items-center hover-text-danger transition-colors"
              style={{ color: '#9ca3af', cursor: 'pointer', marginLeft: '2px' }}
              onClick={() => removeAppliedFilter(key)}
            >
              <X size={11} strokeWidth={2.5} />
            </button>
          </div>
        );
      }
    });

    if (appliedFilters.selectedTags?.length > 0) {
      appliedFilters.selectedTags.forEach(tag => {
        badges.push(
          <div key={`tag-${tag}`} className="d-flex align-items-center gap-1.5 px-2 border shadow-sm" style={{ height: '26px', fontSize: '10px', backgroundColor: '#eef2ff', color: '#4338ca', borderColor: '#c7d2fe', borderRadius: '6px' }}>
            <TagIcon size={10} className="opacity-80" />
            <span className="fw-bold">{tag}</span>
            <button
              type="button"
              className="p-0 border-0 bg-transparent d-flex align-items-center hover-text-danger transition-colors"
              style={{ color: '#818cf8', cursor: 'pointer', marginLeft: '2px' }}
              onClick={() => removeAppliedFilter('selectedTags', tag)}
            >
              <X size={11} strokeWidth={2.5} />
            </button>
          </div>
        );
      });
    }

    if (selectedSeller) {
      const seller = sellers.find(s => s._id === selectedSeller);
      badges.unshift(
        <div key="seller" className="d-flex align-items-center gap-1.5 px-2 border shadow-sm" style={{ height: '26px', fontSize: '10px', backgroundColor: '#18181b', color: '#ffffff', borderColor: '#18181b', borderRadius: '6px' }}>
          <Store size={10} className="opacity-80" />
          <span className="fw-bold">{seller?.name || 'Selected Seller'}</span>
          <button
            type="button"
            className="p-0 border-0 bg-transparent d-flex align-items-center text-zinc-400 hover-text-white transition-colors"
            style={{ color: '#a1a1aa', cursor: 'pointer', marginLeft: '2px' }}
            onClick={() => setSelectedSeller('')}
          >
            <X size={11} strokeWidth={2.5} />
          </button>
        </div>
      );
    }

    if (appliedSearchQuery) {
      badges.unshift(
        <div key="search" className="d-flex align-items-center gap-1.5 px-2 border shadow-sm" style={{ height: '26px', fontSize: '10px', backgroundColor: '#fffbeb', color: '#b45309', borderColor: '#fcd34d', borderRadius: '6px' }}>
          <Search size={10} className="opacity-80" />
          <span className="fw-bold italic">"{appliedSearchQuery}"</span>
          <button
            type="button"
            className="p-0 border-0 bg-transparent d-flex align-items-center hover-text-danger transition-colors"
            style={{ color: '#f59e0b', cursor: 'pointer', marginLeft: '2px' }}
            onClick={() => { setAppliedSearchQuery(''); setSearchQuery(''); }}
          >
            <X size={11} strokeWidth={2.5} />
          </button>
        </div>
      );
    }

    return badges;
  }, [appliedFilters, appliedSearchQuery, removeAppliedFilter, selectedSeller, sellers]);

  const filtersRef = useRef(filters);
  filtersRef.current = appliedFilters;

  const handleApplyFilters = () => {
    setSelectedIds(new Set());
    setAppliedFilters(filters);
    setFilterPanelOpen(false);
    // loadData reads appliedFilters via ref, but state update is async
    // so we force a reload with a trigger
    setFilterTrigger(t => t + 1);
  };

  // Removed client-side filteredAsins useMemo as we now use server-side search
  const filteredAsins = asins;

  // Fetch filter options when seller changes
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const res = await asinApi.getFilters(selectedSeller ? { seller: selectedSeller } : {});
        if (res.success) setFilterOptions(res.data);
      } catch (err) {
        console.error('Error fetching filter options:', err);
      }
    };
    fetchFilters();
  }, [selectedSeller]);

  // Fetch all sellers once for badge labels
  useEffect(() => {
    const fetchSellers = async () => {
      try {
        const res = await sellerApi.getAll({ page: 1, limit: 1000 });
        if (res.success) setSellers(res.data.sellers || []);
      } catch (err) {
        console.error('Error fetching sellers for labels:', err);
      }
    };
    fetchSellers();
  }, []);

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

  const handleToggleSelectRow = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    setSelectedIds(prev => {
      if (prev.size === filteredAsins.length && filteredAsins.length > 0) {
        return new Set();
      }
      return new Set(filteredAsins.map(a => a._id));
    });
  }, [filteredAsins]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

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

  const handleBulkPriceDispute = async (isDispute) => {
    if (selectedIds.size === 0) {
      alert('Please select at least one ASIN');
      return;
    }

    if (!window.confirm(`Mark ${selectedIds.size} ASINs as ${isDispute ? 'Disputed' : 'Resolved'}?`)) return;

    setLoading(true);
    try {
      const res = await asinApi.bulkUpdate(Array.from(selectedIds), { priceDispute: isDispute });
      if (res.success) {
        // toast or notification here
        loadData(pagination.page);
        setSelectedIds(new Set());
      }
    } catch (err) {
      alert('Bulk update failed: ' + err.message);
    } finally {
      setLoading(false);
      setShowActionsDropdown(false);
    }
  };

  const handleRunRulesets = async () => {
    if (selectedIds.size === 0) {
      alert('Please select at least one ASIN');
      return;
    }

    const selectedAsinCodes = asins
      .filter(a => selectedIds.has(a._id || a.Id))
      .map(a => a.asinCode || a.AsinCode);

    if (selectedAsinCodes.length === 0) {
      alert('No valid ASIN codes found in selection.');
      return;
    }

    if (!window.confirm(`Are you sure you want to run active rulesets on ${selectedAsinCodes.length} selected ASIN(s)?`)) {
      return;
    }

    setLoading(true);
    try {
      const res = await rulesetApi.executeForAsins(selectedAsinCodes);
      if (res.success) {
        alert(`Successfully evaluated active rulesets and generated tasks!`);
        setSelectedIds(new Set());
      } else {
        alert('Ruleset execution failed: ' + (res.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('Ruleset execution error:', err);
      alert('Error running rulesets: ' + err.message);
    } finally {
      setLoading(false);
      setShowActionsDropdown(false);
    }
  };

  const handleOpenTaskModal = () => {
    if (selectedIds.size === 0) {
      alert('Please select at least one ASIN');
      return;
    }
    setTaskTitle('');
    setTaskDescription('');
    setTaskPriority('MEDIUM');
    setTaskCategory('GENERAL_OPTIMIZATION');
    setShowManualTaskModal(true);
    setShowActionsDropdown(false);
  };

  const handleCreateManualTask = async () => {
    if (!taskTitle.trim()) {
      alert('Please enter a task title');
      return;
    }

    const selectedAsinCodes = asins
      .filter(a => selectedIds.has(a._id || a.Id))
      .map(a => a.asinCode || a.AsinCode);

    if (selectedAsinCodes.length === 0) {
      alert('No valid ASIN codes found in selection.');
      return;
    }

    const firstSelectedAsin = asins.find(a => selectedIds.has(a._id || a.Id));
    const sellerId = firstSelectedAsin?.sellerId || firstSelectedAsin?.SellerId || null;

    setLoading(true);
    try {
      const payload = {
        title: taskTitle.trim(),
        description: taskDescription.trim(),
        priority: taskPriority,
        type: taskCategory,
        asins: selectedAsinCodes,
        sellerId: sellerId
      };

      const res = await db.createAction(payload);
      if (res && (res.success || res.data)) {
        alert(`✅ Successfully created task for ${selectedAsinCodes.length} ASIN(s)!`);
        setSelectedIds(new Set());
        setShowManualTaskModal(false);
      } else {
        alert('Failed to create task: ' + (res?.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('Task creation error:', err);
      alert('Error creating task: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadData = useCallback(async (page = 1, limit = pagination.limit, seller = selectedSeller, marketplace = marketplaceFilter) => {
    try {
      setLoading(true);

      // Only fetch paginated data and stats - NOT all data (optimization)
      const asinRes = await asinApi.getAll({
        page,
        limit,
        seller,
        marketplace: marketplace !== 'all' ? marketplace : undefined,
        search: appliedSearchQuery,
        ...appliedFilters,
        historyDays: appliedFilters.historyDays,
        sortBy,
        sortOrder
      });

      const statsRes = await asinApi.getStats({
        seller,
        marketplace: marketplace !== 'all' ? marketplace : undefined
      });


      initialLoadCompleteRef.current = true;
      setAsins(asinRes?.asins || []);
      setGlobalHistoryDates(asinRes?.globalHistoryDates || []);
      setAvailableMonths(asinRes?.months || []);
      setPagination(asinRes?.pagination || { page: 1, limit: limit, total: 0, totalPages: 0 });
      setStats(statsRes);
      setError(null);
    } catch (err) {
      console.error('Error fetching ASINs:', err);
      setError(err.message);
      setAsins([]);
    } finally {
      setLoading(false);
    }
  }, [pagination.limit, selectedSeller, appliedSearchQuery, appliedFilters, marketplaceFilter, sortBy, sortOrder]);

  const handleSort = (field) => {
    const nextOrder = sortBy === field && sortOrder === 'desc' ? 'asc' : 'desc';
    setSortBy(field);
    setSortOrder(nextOrder);
    setPagination(p => ({ ...p, page: 1 }));
  };

  const renderSortableHeader = (label, field, align = 'between') => {
    const active = sortBy === field;
    const justify = align === 'right' ? 'justify-content-end' : align === 'center' ? 'justify-content-center' : 'justify-content-between';
    return (
      <div className={`d-flex align-items-center ${justify} cursor-pointer`} onClick={() => handleSort(field)} style={{ userSelect: 'none' }}>
        <span className={justify === 'justify-content-end' ? 'me-1' : ''}>{label}</span>
        <div className="d-flex flex-column ms-1" style={{ fontSize: '7px', gap: '-3px', opacity: active ? 1 : 0.4, minWidth: '10px' }}>
          <ChevronUp size={8} strokeWidth={4} style={{ color: active && sortOrder === 'asc' ? '#1890ff' : '#8c8c8c', marginBottom: '-2px' }} />
          <ChevronDown size={8} strokeWidth={4} style={{ color: active && sortOrder === 'desc' ? '#1890ff' : '#8c8c8c' }} />
        </div>
      </div>
    );
  };

  const handleImportTags = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportingTags(true);
    try {
      const response = await asinApi.bulkUploadTags(file, selectedSeller);
      if (response.success) {
        alert(`Successfully updated tags for ${response.updated} ASINs`);
        loadData(pagination.page, pagination.limit); // Refresh
      } else {
        alert('Failed to import tags: ' + (response.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Tags import error:', err);
      alert('Error importing tags');
    } finally {
      setImportingTags(false);
      if (e.target) e.target.value = ''; // reset
    }
  };

  const handleRecalculateLQS = async () => {
    const msg = selectedRows.length > 0
      ? `Recalculate LQS for ${selectedRows.length} selected ASINs?`
      : 'Recalculate LQS for all ASINs in your current view/scope?';

    if (!window.confirm(msg)) return;

    setLoading(true);
    try {
      const response = await asinApi.recalculateLQS(selectedRows);
      if (response.success) {
        alert(`Successfully recalculated LQS for ${response.processedCount} ASINs`);
        loadData(pagination.page, pagination.limit);
        setSelectedRows([]); // Clear selection after processing
      }
    } catch (err) {
      console.error('Recalculate LQS error:', err);
      alert('Error recalculating LQS: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTagsTemplate = () => {
    asinApi.downloadTagsTemplate(selectedSeller);
  };

  const handleChangePage = (event, newPage) => {
    // MUI uses 0-indexed pages, API uses 1-indexed
    loadData(newPage + 1, pagination.limit);
  };

  const handleChangeRowsPerPage = (event) => {
    const newLimit = parseInt(event.target.value, 10);
    // Reset to first page when limit changes
    loadData(1, newLimit);
  };

  const { refreshCount } = useRefresh();

  useEffect(() => {
    loadData();
  }, [loadData, refreshCount]);

  // Reload data when filters are applied
  useEffect(() => {
    if (filterTrigger > 0) {
      loadData(1, pagination.limit);
    }
  }, [filterTrigger]);

  // Track pending updates for debouncing
  const pendingRefreshRef = useRef(null);
  const updatedAsinIdsRef = useRef(new Set());

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

    // BATCH UPDATES: Collect all updated ASIN IDs and refresh once
    socket.on('scrape_data_ingested', (data) => {
      // If we're already handling a batch complete event, we might want to skip individual ones
      // But for real-time feel, we keep the debounce
      updatedAsinIdsRef.current.add(data.asinCode);

      // Clear existing timeout
      if (pendingRefreshRef.current) clearTimeout(pendingRefreshRef.current);

      // Wait 3 seconds for more updates, then refresh once
      pendingRefreshRef.current = setTimeout(() => {
        console.log(`📬 Batch refresh: Updating table after ${updatedAsinIdsRef.current.size} ASINs changed via socket`);
        updatedAsinIdsRef.current.clear();
        loadData(pagination.page);
        pendingRefreshRef.current = null;
      }, 3000); // Increased batch window to 3 seconds for stability
    });

    socket.on('scrape_batch_complete', (data) => {
      console.log(`📬 Batch update: ${data.count} ASINs processed for seller ${data.sellerId}`);
      // Refresh the table once for the entire batch
      loadData(pagination.page);
    });

    socket.on('repair_job_progress', (data) => {
      console.log('🛠️ Repair progress:', data);
      setRepairStatus({ running: true, ...data });
    });

    socket.on('repair_job_finished', (data) => {
      console.log('✅ Repair finished:', data);
      setRepairStatus(null);
      alert(`Data repair completed! Processed: ${data.processed}, Failed: ${data.failed}`);
      loadData();
    });

    // Live Sync events - auto-refresh ASIN data with toast notifications
    socket.on('ASINS_UPDATED', (data) => {
      console.log('⚡ ASINS_UPDATED received:', data);
      loadData(pagination.page);
    });

    socket.on('liveSync:completed', (data) => {
      console.log('⚡ Live sync completed:', data);
      message.success({
        content: `Live sync completed — ${data.updatedAsins} ASINs updated for seller`,
        icon: <Zap size={16} style={{ color: '#7c3aed' }} />,
        duration: 4
      });
      loadData(pagination.page);
    });

    socket.on('liveSyncAll:completed', (data) => {
      console.log('⚡ Global live sync completed:', data);
      message.success({
        content: `Global live sync completed — ${data.totalAsinsUpdated} ASINs updated across ${data.totalSellers} sellers`,
        icon: <Zap size={16} style={{ color: '#7c3aed' }} />,
        duration: 5
      });
      loadData(pagination.page);
    });

    socket.on('SELLERS_UPDATED', (data) => {
      console.log('📡 Sellers updated:', data);
      loadData(pagination.page);
    });

    return () => {
      socket.off('scrape_progress');
      socket.off('scrape_data_ingested');
      socket.off('scrape_batch_complete');
      socket.off('repair_job_progress');
      socket.off('repair_job_finished');
      socket.off('ASINS_UPDATED');
      socket.off('liveSync:completed');
      socket.off('liveSyncAll:completed');
      socket.off('SELLERS_UPDATED');
      if (pendingRefreshRef.current) clearTimeout(pendingRefreshRef.current);
    };
  }, [socket, loadData, pagination.page]);

  const fetchSellerDropdownData = useCallback(async (page = 1, search = '') => {
    try {
      const params = { page, limit: 1000, search };
      if (marketplaceFilter && marketplaceFilter !== 'all') {
        params.marketplace = marketplaceFilter;
      }
      const response = await sellerApi.getAll(params);
      if (response.success) {
        return {
          data: response.data.sellers || [],
          hasMore: response.data.pagination.page < response.data.pagination.totalPages
        };
      }
      return { data: [], hasMore: false };
    } catch (err) {
      console.error('Error fetching sellers for dropdown:', err);
      return { data: [], hasMore: false };
    }
  }, [marketplaceFilter]);

  const kpis = useMemo(() => {
    if (stats) {
      const reviewChange = stats.reviewAnalysis?.currentVsPreviousChange || 0;
      const reviewTrend = reviewChange >= 0 ? '↑' : '↓';
      const reviewColor = reviewChange >= 0 ? '#10b981' : '#ef4444';
      const bestSeller = stats.bestSellingAsins?.[0];

      // Compute derived values not directly in API response
      const totalNum = Number(stats.total) || 0;
      const activeNum = Number(stats.active) || 0;
      const uniqueParents = Number(stats.uniqueParents) || 1;
      const totalReviews = Number(stats.totalReviews) || 0;
      const avgReviewsPerParent = uniqueParents > 0 ? Math.round(totalReviews / uniqueParents) : 0;
      const standaloneCount = totalNum - activeNum;
      const avgPriceNum = parseFloat(stats.avgPrice) || 0;
      const avgLqsNum = parseFloat(stats.avgLQS) || 0;

      return [
        {
          label: 'ALL ASINS', value: totalNum.toLocaleString(), color: '#6366f1', icon: <Package size={14} />,
          sub: `${uniqueParents} parent groups`
        },
        {
          label: 'ACTIVE ASINS', value: activeNum.toLocaleString(), color: '#10b981', icon: <Activity size={14} />,
          sub: `${totalNum - activeNum} inactive`
        },
        {
          label: 'TOTAL REVIEWS',
          value: totalReviews.toLocaleString(),
          color: '#8b5cf6',
          icon: <Star size={14} />,
          sub: `Avg ${avgReviewsPerParent.toLocaleString()}/parent`,
          onClick: () => { setShowAllRatingHistory(true); }
        },
        {
          label: 'AVG RATING',
          value: `${stats.avgRating || '0.00'} ★`,
          color: '#f59e0b',
          icon: <Trophy size={14} />,
          sub: `${stats.above4Star || 0} above 4★`,
          onClick: () => { setShowAllRatingHistory(true); }
        },
        {
          label: 'BEST SELLER',
          value: bestSeller ? `#${(bestSeller.BSR || bestSeller.bsr || 0).toLocaleString()}` : '-',
          sub: bestSeller?.AsinCode || bestSeller?.asinCode || '',
          color: '#06b6d4',
          icon: <Award size={14} />,
          onClick: () => { setShowAllBsrHistory(true); }
        },
        {
          label: 'AVG PRICE',
          value: '₹' + avgPriceNum.toLocaleString(),
          color: '#ec4899',
          icon: <IndianRupee size={14} />,
          onClick: () => { setShowAllPriceHistory(true); }
        },
        {
          label: 'AVG LQS',
          value: avgLqsNum.toFixed(1) + '%',
          color: '#8b5cf6',
          icon: <Sparkles size={14} />
        },
        {
          label: 'REVIEWS (7D)',
          value: `${reviewTrend} ${Math.abs(reviewChange)}%`,
          color: reviewColor,
          icon: <TrendingUp size={14} />,
          sub: `${stats.reviewAnalysis?.currentWeek || 0} vs ${stats.reviewAnalysis?.previousWeek || 0}`
        },
      ];
    }

    // Fallback when stats not available
    const total = asins?.length || 0;
    return [
      { label: 'ALL ASINS', value: total.toLocaleString(), color: '#6366f1', icon: <Package size={14} /> },
      { label: 'ACTIVE', value: asins.filter(a => a.status === 'Active').length, color: '#10b981', icon: <Activity size={14} /> },
    ];
  }, [asins, stats]);


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

  const handleRepairData = async () => {
    const sellerToRepair = selectedSeller || selectedSellerId;
    if (!sellerToRepair) return alert('Please select a seller first.');

    try {
      setSyncing(true);
      const res = await asinApi.repairIncomplete(sellerToRepair);
      setRepairStatus({ running: true, total: res.total, processed: 0, failed: 0, percentage: 0 });
      alert(`🛠️ Repair job started for ${res.total} incomplete ASINs.`);
    } catch (err) {
      alert('❌ Repair failed: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };


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

  const handleDeleteAsin = async (asinId) => {
    if (!window.confirm('Are you sure you want to completely delete this ASIN from the database? This action cannot be undone.')) return;
    try {
      setSyncing(true);
      await asinApi.delete(asinId);
      alert('✅ ASIN deleted successfully from the database.');
      loadData();
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Failed to delete ASIN: ' + err.message);
    } finally {
      setSyncing(false);
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
      const totalCount = stats?.total || asins.length;
      if (!window.confirm(`Auto-generate optimization tasks for ALL ${totalCount} ASINs? This will analyze every ASIN in the current filter.`)) return;

      setSyncing(true);
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
    } finally {
      setSyncing(false);
    }
  };

  const handleSelectedCreateActions = async () => {
    try {
      const selectedAsinIds = Array.from(selectedIds);
      if (selectedAsinIds.length === 0) {
        alert('Please select at least one ASIN first.');
        return;
      }

      if (!window.confirm(`Analyze ${selectedAsinIds.length} ASINs and generate optimization tasks?`)) return;

      setSyncing(true);
      const res = await taskApi.generate(selectedAsinIds);

      if (res.success) {
        alert(`✅ Generated ${res.savedCount} optimization tasks from ${res.summary.analyzed} ASINs!\n\n` +
          `By Category: ${JSON.stringify(res.summary.byCategory)}\n` +
          `High Priority: ${res.summary.byPriority.High} | Medium: ${res.summary.byPriority.Medium}`);
        clearSelection();
      } else if (res && res.success === false) {
        alert(`❌ Error: ${res.message || 'Failed to create tasks'}`);
      } else {
        alert('Selected ASINs analyzed. No immediate optimizations required for these specific items.');
      }
    } catch (err) {
      console.error('Selected task creation failed:', err);
      alert('Failed to create selected tasks: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState(null);
  const [showAiAnalysisModal, setShowAiAnalysisModal] = useState(false);

  const handleAiListingAnalysis = async () => {
    const selectedAsinIds = Array.from(selectedIds);
    if (selectedAsinIds.length === 0) { alert('Please select ASINs first.'); return; }
    if (selectedAsinIds.length > 5) { alert('AI analysis supports max 5 ASINs at a time for quality results.'); return; }

    setAiAnalysisLoading(true);
    setShowAiAnalysisModal(true);
    setAiAnalysisResult(null);

    try {
      const results = [];
      for (const asinId of selectedAsinIds) {
        const res = await db.analyzeListing(asinId, false);
        if (res?.success && res.data) {
          results.push({ asinId, ...res.data });
        }
      }
      setAiAnalysisResult(results);
    } catch (err) {
      console.error('AI analysis failed:', err);
      setAiAnalysisResult([{ error: err.message || 'Analysis failed' }]);
    } finally {
      setAiAnalysisLoading(false);
    }
  };

  const handleAiCreateTasks = async (asinId) => {
    try {
      setSyncing(true);
      const res = await db.analyzeListing(asinId, true);
      if (res?.success && res.data?.createdTasks) {
        alert(`✅ Created ${res.data.tasksCount} optimization tasks`);
        setShowAiAnalysisModal(false);
        clearSelection();
      }
    } catch (err) {
      alert('Failed to create tasks: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleBulkSyncSelected = async () => {
    const selectedAsinIds = Array.from(selectedIds);
    if (selectedAsinIds.length === 0) return;

    if (!window.confirm(`Force-sync and refresh data for the ${selectedAsinIds.length} selected ASINs?`)) return;

    try {
      setSyncing(true);
      // For each selected, trigger individual sync (or if there's a bulk sync by ID, use that)
      // Since there is no bulk-sync-by-id api, we'll loop or just call syncAll if many?
      // Better: Use a Promise.all or similar for selection

      setScrapingIds(prev => new Set([...prev, ...selectedAsinIds]));

      const syncPromises = selectedAsinIds.map(id => marketSyncApi.syncAsin(id));
      await Promise.allSettled(syncPromises);

      await loadData(pagination.page);
      alert(`✅ Sync initiated for ${selectedAsinIds.length} selected items.`);
      clearSelection();
    } catch (err) {
      console.error('Selected sync failed:', err);
      alert('❌ Failed to start sync for some items: ' + err.message);
    } finally {
      setSyncing(false);
      setScrapingIds(new Set());
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

  const getBuyBoxBadge = (asin) => {
    const { buyBoxWin, status, soldBy, secondAsp, currentPrice } = asin;
    if (status === 'Scraping') return <span style={{ color: '#9ca3af' }}>-</span>;

    const formatRupee = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

    if (buyBoxWin) {
      const diff = secondAsp > 0 ? (secondAsp - currentPrice) : null;
      let alertMsg = null;
      if (diff !== null && diff <= 5 && diff >= -50) {
        alertMsg = "Close competition. May lose Buy Box.";
      }
      return (
        <div className="d-flex flex-column align-items-center">
          <div className="d-flex align-items-center gap-1">
            <span
              className="badge mb-1"
              style={{ backgroundColor: '#059669', color: '#fff', fontWeight: 600, fontSize: '0.75rem' }}
            >
              Won
            </span>
            {alertMsg && <AlertTriangle size={14} className="text-danger mb-1" title={alertMsg} />}
          </div>
          {diff !== null && (
            <div className={`smallest fw-bold ${alertMsg ? 'text-danger' : 'text-zinc-500'}`} style={{ fontSize: '9px' }} title="Competitor vs Our ASP Diff">
              Diff: {diff > 0 ? '+' : ''}{formatRupee(diff)}
            </div>
          )}
        </div>
      );
    }

    const diff = secondAsp > 0 ? (secondAsp - currentPrice) : null;
    return (
      <div className="d-flex flex-column align-items-center">
        <span
          className="badge mb-1"
          style={{ backgroundColor: '#ef4444', color: '#fff', fontWeight: 600, fontSize: '0.75rem' }}
        >
          Lost
        </span>
        <span className="smallest text-zinc-500 fw-bold text-center" style={{ fontSize: '9px', lineHeight: 1.2, maxWidth: '100px', whiteSpace: 'normal', overflow: 'hidden', textOverflow: 'ellipsis' }} title={soldBy}>
          {soldBy || 'N/A'}
        </span>
        {diff !== null && (
          <div className="smallest mt-1 text-danger fw-bold d-flex gap-1 align-items-center" style={{ fontSize: '9px' }} title="Our loss vs Winner ASP Diff">
            Diff: {formatRupee(diff)}
          </div>
        )}
      </div>
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

  if (!initialLoadCompleteRef.current && loading && asins.length === 0) {
    return <PageLoader message="Loading ASIN Manager..." />;
  }

  const thStyle = {
    fontSize: '10px',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: '#4b5563', // cool gray 600
    padding: '10px 12px',
    background: '#f9fafb',
    position: 'sticky',
    top: 0,
    borderBottom: '1px solid #e5e7eb',
    whiteSpace: 'nowrap',
    border: '0.5px solid #f1f1f1',
    zIndex: 10
  };

  const tdStyle = {
    padding: '3px 8px',
    fontSize: '0.68rem',
    borderBottom: '0.5px solid #f1f5f9',
    verticalAlign: 'middle',
    color: '#27272a', // zinc-800
    height: '34px',
    borderLeft: '0.5px solid #f1f5f9',
    borderRight: '0.5px solid #f1f5f9',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  };

  const actionBtnStyle = {
    padding: '1px 6px',
    fontSize: '9px',
    fontWeight: '700',
    height: '18px',
    borderRadius: '4px',
    border: '1px solid #e4e4e7'
  };

  return (
    <div className="asin-page-container">
      {loading && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}>
          <LoadingIndicator type="line-simple" size="md" />
        </div>
      )}

      {/* [Filter Sidebar/Drawer Overlay] — PREMIUM FULL-HEIGHT DRAWER */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
            <div style={{ background: '#f4f4f5', padding: 7, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <SlidersHorizontal size={16} style={{ color: '#3f3f46' }} />
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#18181b' }}>Filters</span>
          </div>
        }
        placement="right"
        onClose={() => setFilterPanelOpen(false)}
        open={filterPanelOpen}
        width={400}
        styles={{
          header: { borderBottom: '1px solid #f4f4f5', padding: '12px 20px' },
          body: { padding: 0, display: 'flex', flexDirection: 'column', background: '#fff' }
        }}
        extra={
          <Button type="link" size="small" onClick={resetAllFilters} style={{ fontSize: 12, color: '#fb4f40', fontWeight: 600, padding: 0 }}>
            Reset All
          </Button>
        }
      >
        {/* Content - Scrollable */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>

          {/* SEARCH & BASIC */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Identity & Search</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>SKU</div>
                <Input size="small" placeholder="Enter SKU..." value={filters.sku} onChange={(e) => setFilters({ ...filters, sku: e.target.value })} allowClear style={{ borderRadius: 8 }} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Parent ASIN</div>
                <Input size="small" placeholder="Enter Parent ASIN..." value={filters.parentAsin} onChange={(e) => setFilters({ ...filters, parentAsin: e.target.value })} allowClear style={{ borderRadius: 8 }} />
              </div>
            </div>
          </div>

          <div style={{ height: 1, background: '#f4f4f5', margin: '0 -20px 24px' }} />

          {/* ATTRIBUTES */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Product Attributes</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Scrape Status</div>
                <Select size="small" placeholder="All Statuses" value={filters.scrapeStatus || undefined} onChange={(v) => setFilters({ ...filters, scrapeStatus: v || '' })} allowClear style={{ width: '100%', borderRadius: 8 }} options={[{ value: 'Success', label: 'Success' }, { value: 'Failed', label: 'Failed' }, { value: 'Pending', label: 'Pending' }]} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Brand</div>
                <Select size="small" placeholder="All Brands" value={filters.brand || undefined} onChange={(v) => setFilters({ ...filters, brand: v || '' })} allowClear showSearch optionFilterProp="label" style={{ width: '100%', borderRadius: 8 }} options={filterOptions.brands.map(b => ({ value: b, label: b }))} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Category</div>
                <Select size="small" placeholder="All Categories" value={filters.category || undefined} onChange={(v) => setFilters({ ...filters, category: v || '' })} allowClear showSearch optionFilterProp="label" style={{ width: '100%', borderRadius: 8 }} options={filterOptions.categories.map(c => ({ value: c, label: c }))} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Sub BSR Category</div>
                <Select size="small" placeholder="All Sub BSR Categories" value={filters.subBsrCategory || undefined} onChange={(v) => setFilters({ ...filters, subBsrCategory: v || '' })} allowClear showSearch optionFilterProp="label" style={{ width: '100%', borderRadius: 8 }} options={(filterOptions.subBsrCategories || []).map(s => ({ value: s, label: s }))} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Manufacturer</div>
                <Input size="small" placeholder="Search manufacturer..." value={filters.manufacturer} onChange={(e) => setFilters({ ...filters, manufacturer: e.target.value })} allowClear style={{ borderRadius: 8 }} />
              </div>
            </div>
          </div>

          <div style={{ height: 1, background: '#f4f4f5', margin: '0 -20px 24px' }} />

          {/* QUICK FLAGS */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Quick Flags</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>BuyBox</div>
                <Select size="small" placeholder="All" value={filters.buyBoxWin || undefined} onChange={(v) => setFilters({ ...filters, buyBoxWin: v || '' })} allowClear style={{ width: '100%', borderRadius: 8 }} options={[{ value: 'true', label: 'Won (Own)' }, { value: 'false', label: 'Lost (Other)' }]} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>A+ Content</div>
                <Select size="small" placeholder="All" value={filters.hasAplus || undefined} onChange={(v) => setFilters({ ...filters, hasAplus: v || '' })} allowClear style={{ width: '100%', borderRadius: 8 }} options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Video</div>
                <Select size="small" placeholder="All" value={filters.hasVideo || undefined} onChange={(v) => setFilters({ ...filters, hasVideo: v || '' })} allowClear style={{ width: '100%', borderRadius: 8 }} options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Active Deal</div>
                <Select size="small" placeholder="All" value={filters.hasDeal || undefined} onChange={(v) => setFilters({ ...filters, hasDeal: v || '' })} allowClear style={{ width: '100%', borderRadius: 8 }} options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Ads Active</div>
                <Select size="small" placeholder="All" value={filters.ads || undefined} onChange={(v) => setFilters({ ...filters, ads: v || '' })} allowClear style={{ width: '100%', borderRadius: 8 }} options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Availability</div>
                <Select size="small" placeholder="All" value={filters.availabilityStatus || undefined} onChange={(v) => setFilters({ ...filters, availabilityStatus: v || '' })} allowClear style={{ width: '100%', borderRadius: 8 }} options={[{ value: 'In stock', label: 'In Stock' }, { value: 'Out of Stock', label: 'Out of Stock' }, { value: 'Available', label: 'Available' }, { value: 'Currently unavailable', label: 'Unavailable' }]} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Deal Type</div>
                <Select size="small" placeholder="All" value={filters.dealAccessType || undefined} onChange={(v) => setFilters({ ...filters, dealAccessType: v || '' })} allowClear style={{ width: '100%', borderRadius: 8 }} options={[{ value: 'ALL', label: 'ALL' }, { value: 'PRIME', label: 'PRIME' }]} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Price Dispute</div>
                <Select size="small" placeholder="All ASINs" value={filters.priceDispute || undefined} onChange={(v) => setFilters({ ...filters, priceDispute: v || '' })} allowClear style={{ width: '100%', borderRadius: 8 }} options={[{ value: 'true', label: 'Disputed Only' }, { value: 'false', label: 'Non-Disputed' }]} />
              </div>
            </div>
          </div>

          <div style={{ height: 1, background: '#f4f4f5', margin: '0 -20px 24px' }} />

          {/* TRENDS & HISTORY */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Performance Trends</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>BSR Trend</div>
                <Select size="small" placeholder="All Trends" value={filters.bsrTrend || undefined} onChange={(v) => setFilters({ ...filters, bsrTrend: v || '' })} allowClear style={{ width: '100%', borderRadius: 8 }} options={[{ value: 'Grow', label: 'Growing' }, { value: 'Down', label: 'Down' }, { value: 'Stable', label: 'Stable' }]} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Rating Trend</div>
                <Select size="small" placeholder="All Trends" value={filters.ratingTrend || undefined} onChange={(v) => setFilters({ ...filters, ratingTrend: v || '' })} allowClear style={{ width: '100%', borderRadius: 8 }} options={[{ value: 'Grow', label: 'Growing' }, { value: 'Down', label: 'Down' }, { value: 'Stable', label: 'Stable' }]} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>History Data Range</div>
              <Select size="small" placeholder="Default: 14 Days" value={filters.historyDays || undefined} onChange={(v) => setFilters({ ...filters, historyDays: v || '' })} allowClear style={{ width: '100%', borderRadius: 8 }} options={[{ value: '1', label: 'Today Only' }, { value: '7', label: 'Last 7 Days' }, { value: '14', label: 'Last 14 Days' }, { value: '30', label: 'Last 30 Days' }, { value: '90', label: 'Last 90 Days' }]} />
            </div>
          </div>

          <div style={{ height: 1, background: '#f4f4f5', margin: '0 -20px 24px' }} />

          {/* RANGES */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Metrics & Ranges</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Price Range (₹)</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Input size="small" type="number" placeholder="Min" value={filters.minPrice} onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })} style={{ borderRadius: 8, flex: 1 }} />
                  <Input size="small" type="number" placeholder="Max" value={filters.maxPrice} onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })} style={{ borderRadius: 8, flex: 1 }} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>BSR Range</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Input size="small" type="number" placeholder="Min" value={filters.minBSR} onChange={(e) => setFilters({ ...filters, minBSR: e.target.value })} style={{ borderRadius: 8, flex: 1 }} />
                  <Input size="small" type="number" placeholder="Max" value={filters.maxBSR} onChange={(e) => setFilters({ ...filters, maxBSR: e.target.value })} style={{ borderRadius: 8, flex: 1 }} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Rating Range</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Input size="small" type="number" step="0.1" placeholder="Min" value={filters.minRating} onChange={(e) => setFilters({ ...filters, minRating: e.target.value })} style={{ borderRadius: 8, flex: 1 }} />
                  <Input size="small" type="number" step="0.1" placeholder="Max" value={filters.maxRating} onChange={(e) => setFilters({ ...filters, maxRating: e.target.value })} style={{ borderRadius: 8, flex: 1 }} />
                </div>
              </div>
            </div>
          </div>

          <div style={{ height: 1, background: '#f4f4f5', margin: '0 -20px 24px' }} />

          {/* TAGS */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Tags</div>
            <Input.Search size="small" placeholder="Search tags..." value={tagSearch} onChange={(e) => setTagSearch(e.target.value)} style={{ borderRadius: 8, marginBottom: 10 }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {filterOptions.tags
                .filter(t => typeof t === 'string' && t.toLowerCase().includes(tagSearch.toLowerCase()))
                .map(tag => {
                  const active = filters.selectedTags.includes(tag);
                  return (
                    <Tag
                      key={tag}
                      style={{ cursor: 'pointer', borderRadius: 100, fontSize: 10, fontWeight: 600, padding: '2px 10px', margin: 0, border: active ? '1px solid #18181b' : '1px solid #e4e4e7', background: active ? '#18181b' : '#f4f4f5', color: active ? '#fff' : '#52525b' }}
                      onClick={() => {
                        const newTags = active ? filters.selectedTags.filter(t => t !== tag) : [...filters.selectedTags, tag];
                        setFilters({ ...filters, selectedTags: newTags });
                      }}
                    >
                      {tag}
                    </Tag>
                  );
                })}
            </div>
          </div>

          <div style={{ height: 1, background: '#f4f4f5', margin: '0 -20px 24px' }} />

          {/* AGE FILTER */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Listing Age</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {[
                { label: 'New (<30D)', value: '30' },
                { label: '30-60D', value: '60' },
                { label: '60-90D', value: '90' },
                { label: '90-180D', value: '180' },
                { label: '180-365D', value: '365' },
                { label: '365+ Days', value: '365+' }
              ].map(opt => (
                <Tag
                  key={opt.value}
                  style={{ cursor: 'pointer', borderRadius: 100, fontSize: 10, fontWeight: 600, padding: '2px 10px', margin: 0, border: filters.ageFilter === opt.value ? '1px solid #18181b' : '1px solid #e4e4e7', background: filters.ageFilter === opt.value ? '#18181b' : '#f4f4f5', color: filters.ageFilter === opt.value ? '#fff' : '#52525b' }}
                  onClick={() => setFilters({ ...filters, ageFilter: filters.ageFilter === opt.value ? '' : opt.value })}
                >
                  {opt.label}
                </Tag>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Release Date Range</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Input size="small" type="date" value={filters.minReleaseDate} onChange={(e) => setFilters({ ...filters, minReleaseDate: e.target.value })} style={{ borderRadius: 8, flex: 1 }} />
                <Input size="small" type="date" value={filters.maxReleaseDate} onChange={(e) => setFilters({ ...filters, maxReleaseDate: e.target.value })} style={{ borderRadius: 8, flex: 1 }} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #f4f4f5', background: '#fafafa', display: 'flex', gap: 8, flexShrink: 0 }}>
          <Button size="small" block onClick={resetAllFilters} style={{ borderRadius: 8, fontWeight: 600, height: 32 }}>Reset</Button>
          <Button size="small" type="primary" block onClick={handleApplyFilters} style={{ borderRadius: 8, fontWeight: 600, height: 32, background: '#18181b', borderColor: '#18181b' }}>Apply Filters</Button>
        </div>
      </Drawer>

      {/* Relocated header actions to Table Toolbar for dense view UI */}

      {/* ANALYTICS MODULE AREA - RECTANGULAR PILLS STYLE */}
      <div className="flex-shrink-0 overflow-hidden" style={{ maxHeight: showDashboard ? '52px' : '0px', transition: 'all 0.3s ease', opacity: showDashboard ? 1 : 0, pointerEvents: showDashboard ? 'auto' : 'none' }}>
        <div className="px-3 py-1 d-flex align-items-center gap-2 overflow-x-auto custom-scrollbar" style={{ width: '100%' }}>
          {kpis.map((kpi, idx) => (
            <Tooltip key={idx} title={kpi.sub || null} placement="bottom" mouseEnterDelay={0.3}>
              <div
                className="bg-white border shadow-sm d-flex align-items-center gap-2 px-3 hover-up-mild"
                style={{
                  height: '32px',
                  minWidth: 'max-content',
                  flexShrink: 0,
                  cursor: kpi.onClick ? 'pointer' : 'default',
                  borderRadius: '6px',
                  borderColor: '#e4e4e7'
                }}
                onClick={kpi.onClick}
              >
                {/* Status Dot */}
                <div
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: kpi.color,
                    flexShrink: 0
                  }}
                />

                {/* Label */}
                <span className="text-uppercase fw-bold" style={{ fontSize: '10px', letterSpacing: '0.03em', color: kpi.color, whiteSpace: 'nowrap' }}>
                  {kpi.label}
                </span>

                {/* Value */}
                <span className="fw-bolder ms-1" style={{ fontSize: '11px', color: '#09090b' }}>
                  {kpi.value}
                </span>

                {/* Inline sub hint */}
                {kpi.sub && (
                  <span style={{ fontSize: '9px', color: '#a1a1aa', whiteSpace: 'nowrap', marginLeft: '2px' }}>
                    ({kpi.sub})
                  </span>
                )}
              </div>
            </Tooltip>
          ))}
        </div>
      </div>

      {/* Repair Progress simplified */}
      {repairStatus && (
        <div className="mt-2 py-1 px-3 bg-amber-50 border border-amber-100 rounded-2 d-flex align-items-center gap-3">
          <div className="spin text-amber-500"><Zap size={12} /></div>
          <span className="smallest text-amber-900 fw-bold text-uppercase tracking-wider" style={{ fontSize: '9px' }}>Data Repair</span>
          <div className="flex-grow-1" style={{ height: '4px', background: '#fef3c7', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: '#f59e0b', width: `${repairStatus.percentage}%`, transition: 'width 0.4s ease' }} />
          </div>
          <span className="smallest text-amber-600 fw-bold" style={{ fontSize: '9px' }}>{repairStatus.processed}/{repairStatus.total}</span>
        </div>
      )}

      <div className="page-content flex-grow-1 d-flex flex-column overflow-hidden px-3 pb-3" style={{ minHeight: 0 }}>
        {/* Alerts & Errors row */}
        {error && (
          <div className="alert alert-danger border-0 shadow-sm rounded-3 py-2 px-3 mb-3 d-flex align-items-center gap-2" role="alert">
            <AlertTriangle size={14} className="text-danger" />
            <span className="fw-medium small text-danger-emphasis">{error}</span>
          </div>
        )}

        {/* ELEVATED MODULE CONTAINER */}
        <div className="bg-white shadow-sm rounded-4 overflow-hidden flex-grow-1 d-flex flex-column border border-light-subtle position-relative">

          <style>{`
                  .filter-section-title {
                    font-size: 11px;
                    font-weight: 800;
                    color: #18181b;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    margin-bottom: 16px;
                    padding-bottom: 8px;
                    border-bottom: 1.5px solid #f4f4f5;
                  }
                  .filter-group {
                    margin-bottom: 4px;
                  }
                  .filter-label {
                    display: block;
                    font-size: 10px;
                    font-weight: 700;
                    color: #71717a;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    margin-bottom: 8px;
                  }
                  @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                  }
                  @keyframes slideInRight {
                    from { transform: translateX(100%); }
                    to { transform: translateX(0); }
                  }
                  .hover-up-mild {
                    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                  }
                  .hover-up-mild:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 10px 20px -5px rgba(0,0,0,0.08) !important;
                  }
                  .rotate-180 {
                    transform: rotate(180deg);
                  }
                  .transition-all {
                    transition: all 0.2s ease-in-out;
                  }
                  .tracking-tight {
                    letter-spacing: -0.02em;
                  }
                  .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                    height: 6px;
                  }
                  .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                  }
                  .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 10px;
                  }
                  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #94a3b8;
                  }
                  .asin-page-container {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    overflow: hidden;
                    background-color: #f4f5f7;
                  }
                  .asin-toolbar {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    flex-shrink: 0;
                    gap: 12px;
                    padding: 8px 16px;
                  }
                  .asin-toolbar-left {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                  }
                  .asin-toolbar-right {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                  }
                  .asin-search-input {
                    width: 230px;
                  }
                  .asin-seller-select-wrapper {
                    width: 160px;
                  }
                  @media (max-width: 992px) {
                    .asin-page-container {
                      margin: -0.75rem;
                      height: calc(100vh - 60px);
                    }
                  }
                  @media (max-width: 768px) {
                    .asin-toolbar {
                      flex-direction: column;
                      align-items: stretch;
                      padding: 12px 16px;
                      gap: 12px;
                    }
                    .asin-toolbar-left {
                      flex-direction: column;
                      align-items: stretch;
                      gap: 12px;
                    }
                    .asin-toolbar-left > div {
                      width: 100%;
                      justify-content: space-between;
                    }
                    .asin-toolbar-right {
                      justify-content: flex-start;
                      flex-wrap: wrap;
                      gap: 8px;
                    }
                    .asin-search-input, 
                    .asin-seller-select-wrapper {
                      width: 100% !important;
                      flex: 1;
                    }
                    .asin-toolbar-right .btn {
                      flex-grow: 1;
                      justify-content: center;
                    }
                  }
          `}</style>

          {/* Table Toolbar */}
          <div className="asin-toolbar border-bottom bg-white">
            <div className="asin-toolbar-left d-flex align-items-center gap-2 flex-grow-1" style={{ flexWrap: 'wrap', minWidth: 0 }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#27272a', letterSpacing: '0.02em', whiteSpace: 'nowrap' }} className="text-uppercase d-flex align-items-center gap-1">
                Inventory
                <span className="bg-light border text-secondary px-1.5 rounded-pill fw-semibold" style={{ fontSize: '10px', lineHeight: '18px' }}>
                  {pagination.total.toLocaleString()}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost p-0 ms-1 rounded-circle text-secondary d-flex align-items-center justify-content-center"
                  onClick={() => setShowDashboard(!showDashboard)}
                  style={{ width: '20px', height: '20px', border: 'none', background: 'transparent' }}
                  title={showDashboard ? 'Collapse Overview' : 'Expand Overview'}
                >
                  {showDashboard ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
              </span>

              {/* MARKETPLACE SWITCHER */}
              <Segmented
                size="small"
                value={marketplaceFilter === 'amazon.in' || (marketplaceFilter === 'all' && !canAccessAjio && !canAccessMyntra) ? 'amazon.in' : marketplaceFilter}
                onChange={(val) => {
                  setMarketplaceFilter(val);
                  loadData(1, pagination.limit, selectedSeller, val);
                }}
                options={[
                  {
                    value: 'amazon.in',
                    label: (
                      <span className="d-flex align-items-center justify-content-center" style={{ height: '20px', padding: '0 4px' }}>
                        <img src="https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg" style={{ height: '10px', width: 'auto', objectFit: 'contain', filter: marketplaceFilter === 'amazon.in' ? 'none' : 'grayscale(100%)' }} alt="Amazon" />
                      </span>
                    )
                  },
                  {
                    value: 'ajio',
                    label: (
                      <span className="d-flex align-items-center justify-content-center" style={{ height: '20px', padding: '0 4px' }}>
                        <img src="https://cdn.brandfetch.io/id78Xj7CCR/w/820/h/238/theme/dark/logo.png?c=1bxid64Mup7aczewSAYMX&t=1776791426160" style={{ height: '9px', width: 'auto', objectFit: 'contain', filter: marketplaceFilter === 'ajio' ? 'none' : 'grayscale(100%)' }} alt="Ajio" />
                      </span>
                    )
                  },
                  ...(canAccessMyntra ? [{
                    value: 'myntra',
                    label: (
                      <span className="d-flex align-items-center justify-content-center" style={{ height: '20px', padding: '0 4px' }}>
                        <img src="https://cdn.brandfetch.io/idDW82Qwj2/theme/dark/logo.svg?c=1bxid64Mup7aczewSAYMX&t=1772274333492" style={{ height: '10px', width: 'auto', objectFit: 'contain', filter: marketplaceFilter === 'myntra' ? 'none' : 'grayscale(100%)' }} alt="Myntra" />
                      </span>
                    )
                  }] : [])
                ]}
                style={{ background: '#f4f4f5', padding: '2px', borderRadius: '6px', flexShrink: 0 }}
              />

              <Input.Search
                placeholder="Search ASIN, SKU, Title..."
                size="small"
                enterButton="Find"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onSearch={handleApplySearch}
                className="antd-dense-search asin-search-input"
              />
              <div className="asin-seller-select-wrapper">
                <InfiniteScrollSelect
                  fetchData={fetchSellerDropdownData}
                  value={selectedSeller}
                  onSelect={(val) => {
                    setSelectedSeller(val);
                    loadData(1, pagination.limit, val);
                  }}
                  placeholder="All Sellers"
                />
              </div>

              {/* ACTIONS DROPDOWN */}
              <Dropdown
                menu={{
                  items: [
                    {
                      key: 'filters-grp',
                      type: 'group',
                      label: 'QUICK FILTERS',
                      children: [
                        {
                          key: 'price-dispute',
                          label: appliedFilters.priceDispute === 'true' ? 'Show All Products' : 'Show Dispute Only',
                          icon: <AlertTriangle size={14} className={appliedFilters.priceDispute === 'true' ? "text-amber-600" : "text-amber-400"} />,
                          onClick: () => {
                            const newFilters = { ...appliedFilters, priceDispute: appliedFilters.priceDispute === 'true' ? '' : 'true' };
                            setAppliedFilters(newFilters);
                            setFilters(newFilters);
                            setFilterTrigger(t => t + 1);
                          }
                        },
                        {
                          key: 'bsr-trend',
                          label: appliedFilters.bsrTrend === 'Down' ? 'Clear BSR Filter' : 'Show Falling BSR',
                          icon: <TrendingDown size={14} className={appliedFilters.bsrTrend === 'Down' ? "text-rose-600" : "text-rose-400"} />,
                          onClick: () => {
                            const newFilters = { ...appliedFilters, bsrTrend: appliedFilters.bsrTrend === 'Down' ? '' : 'Down' };
                            setAppliedFilters(newFilters);
                            setFilters(newFilters);
                            setFilterTrigger(t => t + 1);
                          }
                        },
                        {
                          key: 'rating-trend',
                          label: appliedFilters.ratingTrend === 'Down' ? 'Clear Rating Filter' : 'Show Falling Ratings',
                          icon: <Star size={14} className={appliedFilters.ratingTrend === 'Down' ? "text-amber-600" : "text-amber-400"} />,
                          onClick: () => {
                            const newFilters = { ...appliedFilters, ratingTrend: appliedFilters.ratingTrend === 'Down' ? '' : 'Down' };
                            setAppliedFilters(newFilters);
                            setFilters(newFilters);
                            setFilterTrigger(t => t + 1);
                          }
                        }
                      ]
                    },
                    { type: 'divider' },
                    {
                      key: 'views-grp',
                      type: 'group',
                      label: 'QUICK VIEWS',
                      children: [
                        {
                          key: 'bsr-matrix',
                          label: 'BSR Ranking Matrix',
                          icon: <BarChart2 size={14} />,
                          onClick: () => setShowAllBsrHistory(true)
                        },
                        {
                          key: 'rating-analytics',
                          label: 'Rating Analytics',
                          icon: <LayoutGrid size={14} />,
                          onClick: () => setShowAllRatingHistory(true)
                        }
                      ]
                    },
                    { type: 'divider' },
                    {
                      key: 'bulk-grp',
                      type: 'group',
                      label: (
                        <div className="d-flex justify-content-between align-items-center w-100">
                          <span>BULK ACTIONS</span>
                          {selectedIds.size === 0 && <Tag style={{ fontSize: '9px', borderRadius: '4px' }}>SELECT ROWS</Tag>}
                        </div>
                      ),
                      children: [
                        {
                          key: 'mark-dispute',
                          label: 'Mark as Price Dispute',
                          icon: <AlertTriangle size={14} className="text-amber-500" />,
                          disabled: selectedIds.size === 0,
                          onClick: () => handleBulkPriceDispute(true)
                        },
                        {
                          key: 'resolve-dispute',
                          label: 'Resolve Dispute',
                          icon: <RefreshCw size={14} className="text-emerald-500" />,
                          disabled: selectedIds.size === 0,
                          onClick: () => handleBulkPriceDispute(false)
                        },
                        {
                          key: 'run-rulesets',
                          label: 'Run Rulesets on Selected',
                          icon: <PlayCircle size={14} />,
                          disabled: selectedIds.size === 0,
                          onClick: handleRunRulesets
                        },
                        {
                          key: 'create-task',
                          label: 'Create Task for Selected',
                          icon: <PlusCircle size={14} className="text-emerald-500" />,
                          disabled: selectedIds.size === 0,
                          onClick: handleOpenTaskModal
                        }
                      ]
                    }
                  ]
                }}
                trigger={['click']}
                placement="bottomRight"
              >
                <Button
                  icon={<MoreVertical size={14} />}
                  style={{
                    height: '32px',
                    fontSize: '11px',
                    fontWeight: 600,
                    borderRadius: '8px'
                  }}
                  className="d-flex align-items-center gap-1 shadow-sm"
                >
                  Actions
                </Button>
              </Dropdown>

              {/* Scrape Progress */}
              {scrapeProgress && (
                <div className="bg-light border rounded-2 px-2 d-flex align-items-center gap-2" style={{ height: '32px', borderColor: '#e4e4e7' }}>
                  <RefreshCw size={12} className="spin" style={{ color: '#fb4f40' }} />
                  <span className="fw-bold font-monospace small" style={{ color: '#27272a' }}>{scrapeProgress.processed}/{scrapeProgress.total}</span>
                </div>
              )}

              {/* Spacer */}
              <div style={{ flex: '1 1 0', minWidth: 0 }} />

              <div className="d-flex align-items-center gap-2" style={{ flexShrink: 0 }}>
                <Button
                  icon={<RefreshCw size={14} className={syncing ? 'spin' : ''} />}
                  onClick={handleBulkScrape}
                  disabled={syncing}
                  style={{
                    height: '32px',
                    fontSize: '11px',
                    fontWeight: 600,
                    borderRadius: '8px'
                  }}
                  className="d-flex align-items-center gap-2 shadow-sm"
                >
                  Sync
                </Button>

                <Button
                  onClick={() => setFilterPanelOpen(!filterPanelOpen)}
                  type={filterPanelOpen ? 'primary' : 'default'}
                  icon={<ListChecks size={14} />}
                  style={{
                    height: '32px',
                    fontSize: '11px',
                    fontWeight: 600,
                    borderRadius: '8px'
                  }}
                  className="d-flex align-items-center gap-2 shadow-sm"
                >
                  {(() => {
                    const count = Object.values(appliedFilters).filter(v =>
                      v !== '' && (!Array.isArray(v) || v.length > 0)
                    ).length;
                    return `Filters ${count > 0 ? `(${count})` : ''}`;
                  })()}
                </Button>

                <div className="position-relative">
                  <Button
                    onClick={() => setShowColumnPanel(!showColumnPanel)}
                    type={showColumnPanel ? 'primary' : 'default'}
                    icon={<LayoutGrid size={14} />}
                    style={{
                      height: '32px',
                      fontSize: '11px',
                      fontWeight: 600,
                      borderRadius: '8px'
                    }}
                    className="d-flex align-items-center gap-2 shadow-sm"
                  >
                    Columns
                  </Button>

                  <ColumnVisibilityPanel
                    isOpen={showColumnPanel}
                    onClose={() => setShowColumnPanel(false)}
                    visibleColumns={visibleColumns}
                    onApply={updateVisibleColumns}
                    allColumns={allColumns}
                    columnCategories={columnCategories}
                  />
                </div>

                <div className="vr mx-1 text-secondary opacity-25" style={{ height: '20px' }} />

                {hasPermission('asinmanager_manage') && (
                  <Tooltip title="Bulk Optimization">
                    <Button
                      onClick={handleBulkCreateActions}
                      disabled={asins.length === 0 || syncing}
                      icon={<Zap size={14} style={{ color: '#fb4f40' }} />}
                      style={{ width: '32px', height: '32px', borderRadius: '8px' }}
                      className="d-flex align-items-center justify-content-center shadow-sm"
                    />
                  </Tooltip>
                )}

                {hasPermission('asinmanager_export') && (
                  <Tooltip title="Export">
                    <Button
                      onClick={() => setShowExportModal(true)}
                      icon={<Download size={14} style={{ color: '#27272a' }} />}
                      style={{ width: '32px', height: '32px', borderRadius: '8px' }}
                      className="d-flex align-items-center justify-content-center shadow-sm"
                    />
                  </Tooltip>
                )}

                {hasPermission('asinmanager_import') && (
                  <Tooltip title="Import">
                    <Button
                      onClick={() => setShowBulkImportModal(true)}
                      icon={<FileUp size={14} className="text-emerald-600" />}
                      style={{ width: '32px', height: '32px', borderRadius: '8px' }}
                      className="d-flex align-items-center justify-content-center shadow-sm"
                    />
                  </Tooltip>
                )}
                {hasPermission('asinmanager_manage') && (
                  <Tooltip title="Add ASIN">
                    <Button
                      onClick={() => setShowAddModal(true)}
                      icon={<Plus size={14} className="text-indigo-600" />}
                      style={{ width: '32px', height: '32px', borderRadius: '8px' }}
                      className="d-flex align-items-center justify-content-center shadow-sm ms-1"
                    />
                  </Tooltip>
                )}
              </div>
            </div>
          </div>

          {/* SELECTION BAR - HIGHLIGHT MODE */}
          {selectedIds.size > 0 && (
            <div className="bg-indigo-50 px-3 py-2 border-bottom d-flex align-items-center gap-3 animate-in slide-in-from-top-2 duration-200" style={{ flexShrink: 0 }}>
              <div className="d-flex align-items-center gap-2">
                <div className="bg-indigo-600 text-white fw-bold rounded-circle d-flex align-items-center justify-content-center" style={{ width: '20px', height: '20px', fontSize: '10px' }}>
                  {selectedIds.size}
                </div>
                <span className="small fw-bold text-indigo-900">items selected</span>
              </div>
              <div className="vr bg-indigo-200 opacity-50" style={{ height: '16px' }}></div>
              <div className="d-flex align-items-center gap-2">
                <button
                  className="btn btn-sm btn-white border border-indigo-100 shadow-sm text-indigo-700 fw-bold rounded-2 d-flex align-items-center gap-1.5"
                  onClick={() => setShowBulkTagsModal(true)}
                  style={{ fontSize: '11px' }}
                >
                  <TagIcon size={12} /> Tag
                </button>
                <button
                  className="btn btn-sm btn-white border border-indigo-100 shadow-sm text-indigo-700 fw-bold rounded-2 d-flex align-items-center gap-1.5"
                  onClick={handleBulkSyncSelected}
                  disabled={syncing}
                  style={{ fontSize: '11px' }}
                >
                  <RefreshCw size={12} className={syncing ? 'spin' : ''} /> Sync
                </button>
                <button
                  className="btn btn-sm btn-white border border-indigo-100 shadow-sm text-indigo-700 fw-bold rounded-2 d-flex align-items-center gap-1.5"
                  onClick={handleSelectedCreateActions}
                  style={{ fontSize: '11px' }}
                >
                  <Zap size={12} className="fill-indigo-700" /> Tasks
                </button>
                <button
                  className="btn btn-sm btn-white border shadow-sm fw-bold rounded-2 d-flex align-items-center gap-1.5"
                  onClick={handleAiListingAnalysis}
                  disabled={aiAnalysisLoading}
                  style={{ fontSize: '11px', borderColor: '#c4b5fd', color: '#6d28d9', backgroundColor: '#f5f3ff' }}
                >
                  <Sparkles size={12} /> {aiAnalysisLoading ? 'Analyzing...' : 'AI Analyze'}
                </button>
              </div>
              <button
                className="btn btn-link text-indigo-600 fw-bold text-decoration-none ms-auto p-0"
                style={{ fontSize: '11px' }}
                onClick={clearSelection}
              >
                Deselect All
              </button>
            </div>
          )}

          {/* APPLIED FILTERS BADGES */}
          {(Object.values(appliedFilters).some(v => v !== '' && (!Array.isArray(v) || v.length > 0)) || appliedSearchQuery || selectedSeller) && (
            <div className="border-bottom d-flex align-items-center flex-wrap gap-3" style={{ flexShrink: 0, padding: '8px 24px', backgroundColor: '#f8fafc' }}>
              <span className="text-secondary fw-bold text-uppercase tracking-wider" style={{ fontSize: '9px' }}>
                Active Filters
              </span>
              <div className="d-flex flex-wrap gap-2">
                {getAppliedFiltersBadges()}
              </div>
              <button
                className="btn btn-link text-danger text-decoration-none ms-auto fw-bold p-0"
                style={{ fontSize: '11px' }}
                onClick={resetAllFilters}
              >
                Clear All
              </button>
            </div>
          )}


          {/* Scrollable Table Container */}
          <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
            <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 20 }}>
                <tr>
                  {isVisible('checkbox') && (
                    <th rowSpan={2} style={{ ...thStyle, width: '40px', left: 0, zIndex: 22, background: '#f8fafc', textAlign: 'center', borderBottom: '2px solid #e2e8f0' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.size === filteredAsins.length && filteredAsins.length > 0}
                        onChange={handleToggleSelectAll}
                        style={{ cursor: 'pointer', width: '14px', height: '14px' }}
                      />
                    </th>
                  )}
                  {isVisible('asinCode') && (
                    <th rowSpan={2} style={{ ...thStyle, width: '110px', left: isVisible('checkbox') ? '40px' : '0px', zIndex: 21, background: '#f8fafc', borderRight: '1px solid #e2e8f0', borderBottom: '2px solid #e2e8f0' }}>
                      {renderSortableHeader(marketplaceFilter === 'ajio' ? 'JIOCODE' : 'ASIN ID', 'asinCode')}
                    </th>
                  )}
                  {isVisible('releaseDate') && (
                    <th rowSpan={2} style={{ ...thStyle, width: '85px', textAlign: 'center', background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      {renderSortableHeader('RELEASED', 'releaseDate', 'center')}
                    </th>
                  )}
                  {isVisible('parentAsin') && (
                    <th rowSpan={2} style={{ ...thStyle, width: '110px', background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      {renderSortableHeader('PARENT ASIN', 'parentAsin')}
                    </th>
                  )}
                  {isVisible('sellerBrand') && (
                    <th rowSpan={2} style={{ ...thStyle, width: '115px', background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      {renderSortableHeader('SELLER / BRAND', 'sellerBrand')}
                    </th>
                  )}
                  {isVisible('sku') && (
                    <th rowSpan={2} style={{ ...thStyle, width: '95px', background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      {renderSortableHeader('SKU', 'sku')}
                    </th>
                  )}
                  {isVisible('title') && (
                    <th rowSpan={2} style={{ ...thStyle, width: '220px', background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      {renderSortableHeader('PRODUCT TITLE', 'title')}
                    </th>
                  )}
                  {isVisible('category') && (
                    <th rowSpan={2} style={{ ...thStyle, width: '135px', background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      {renderSortableHeader('CATEGORY', 'category')}
                    </th>
                  )}
                  {isVisible('tags') && <th rowSpan={2} style={{ ...thStyle, width: '100px', background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>TAGS</th>}

                  {/* LQS columns disabled per user request
                  {visibleLQSCount > 0 && (
                    <th colSpan={visibleLQSCount} style={{ ...thStyle, background: '#f8fafc', color: '#1e293b', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>
                      LISTING QUALITY (LQS)
                    </th>
                  )}
                  */}

                  {/* ===== DEAL & MANUFACTURER COLUMNS (Slate Palette) ===== */}
                  {isVisible('manufacturer') && <th rowSpan={2} style={{ ...thStyle, width: '120px', textAlign: 'left', background: '#f8fafc', color: '#334155', borderBottom: '2px solid #cbd5e1' }}>MANUFACTURER</th>}
                  {isVisible('availabilityStatus') && <th rowSpan={2} style={{ ...thStyle, width: '100px', textAlign: 'center', background: '#f8fafc', color: '#334155', borderBottom: '2px solid #cbd5e1' }}>AVAILABILITY</th>}

                  {isVisible('ads') && <th rowSpan={2} style={{ ...thStyle, width: '60px', textAlign: 'center', background: '#f8fafc', color: '#334155', borderBottom: '2px solid #cbd5e1' }}>ADS</th>}
                  {visibleOrdersCount > 0 && (
                    <th
                      rowSpan={ordersExpanded ? 1 : 2}
                      colSpan={ordersExpanded ? (availableMonths.length + 1) : 1}
                      style={{ ...thStyle, background: '#f8fafc', color: '#334155', textAlign: 'center', borderBottom: '2px solid #cbd5e1', transition: 'all 0.3s ease' }}
                    >
                      <div className="d-flex align-items-center justify-content-center gap-1" style={{ fontSize: '10px', fontWeight: 700 }}>
                        {ordersExpanded ? (
                          <span>ORDERS</span>
                        ) : (
                          renderSortableHeader('ORDERS', 'totalOrders', 'center')
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); setOrdersExpanded(!ordersExpanded); }}
                          className="btn btn-sm p-0 d-inline-flex align-items-center justify-content-center ms-1"
                          style={{ border: 'none', background: 'none', color: '#334155', cursor: 'pointer' }}
                          title={ordersExpanded ? "Collapse to Total" : "Expand to Monthly Orders"}
                        >
                          {ordersExpanded ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
                        </button>
                      </div>
                    </th>
                  )}
                  {isVisible('dealBadge') && <th rowSpan={2} style={{ ...thStyle, width: '80px', textAlign: 'center', background: '#f8fafc', color: '#334155', borderBottom: '2px solid #cbd5e1' }}>DEAL</th>}
                  {isVisible('dealStartTime') && <th rowSpan={2} style={{ ...thStyle, width: '90px', textAlign: 'center', background: '#f8fafc', color: '#334155', borderBottom: '2px solid #cbd5e1' }}>DEAL START</th>}
                  {isVisible('dealEndTime') && <th rowSpan={2} style={{ ...thStyle, width: '90px', textAlign: 'center', background: '#f8fafc', color: '#334155', borderBottom: '2px solid #cbd5e1' }}>DEAL END</th>}
                  {isVisible('dealAccessType') && <th rowSpan={2} style={{ ...thStyle, width: '80px', textAlign: 'center', background: '#f8fafc', color: '#334155', borderBottom: '2px solid #cbd5e1' }}>DEAL TYPE</th>}
                  {isVisible('currentBuybox') && <th rowSpan={2} style={{ ...thStyle, width: '140px', textAlign: 'left', background: '#f8fafc', color: '#334155', borderBottom: '2px solid #cbd5e1' }}>BUYBOX</th>}

                  {/* ===== PRICE COLUMNS (MRP, Price, Dispute, Price Trend) (Indigo Palette) ===== */}
                  {isVisible('mrp') && (
                    <th rowSpan={2} style={{ ...thStyle, width: '85px', textAlign: 'right', background: '#eef2ff', color: '#4338ca', borderBottom: '2px solid #c7d2fe' }}>
                      {renderSortableHeader('MRP', 'mrp', 'right')}
                    </th>
                  )}
                  {isVisible('price') && (
                    <th rowSpan={2} style={{ ...thStyle, width: '85px', textAlign: 'right', background: '#eef2ff', color: '#4338ca', borderBottom: '2px solid #c7d2fe' }}>
                      {renderSortableHeader('CHANNEL PRICE', 'uploadedPrice', 'right')}
                    </th>
                  )}
                  {isVisible('discountPercentage') && (
                    <th rowSpan={2} style={{ ...thStyle, width: '85px', textAlign: 'center', background: '#eef2ff', color: '#4338ca', borderBottom: '2px solid #c7d2fe' }}>
                      {renderSortableHeader('DISCOUNT %', 'discountPercentage', 'center')}
                    </th>
                  )}
                  {isVisible('priceDispute') && (
                    <th rowSpan={2} style={{ ...thStyle, width: '85px', textAlign: 'center', background: '#eef2ff', color: '#4338ca', borderBottom: '2px solid #c7d2fe' }}>
                      {renderSortableHeader('DISPUTE', 'priceDispute', 'center')}
                    </th>
                  )}
                  {visiblePriceTrendCount > 0 && (
                    <th colSpan={visiblePriceTrendCount}
                      style={{ ...thStyle, background: '#eef2ff', color: '#4338ca', textAlign: 'center', borderBottom: '2px solid #c7d2fe', transition: 'all 0.3s ease' }}>
                      <div className="d-flex align-items-center justify-content-center gap-1" style={{ fontSize: '10px', fontWeight: 700 }}>
                        <span>{priceTrendExpanded ? 'Price Trend' : 'Price'}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setPriceTrendExpanded(!priceTrendExpanded); }}
                          className="btn btn-sm p-0 d-inline-flex align-items-center justify-content-center"
                          style={{ border: 'none', background: 'none', color: '#4338ca', cursor: 'pointer' }}
                          title={priceTrendExpanded ? "Collapse to Latest" : "Expand to 7 Days"}
                        >
                          {priceTrendExpanded ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
                        </button>
                      </div>
                    </th>
                  )}

                  {isVisible('mainBsr') && (
                    <th rowSpan={2} style={{ ...thStyle, width: '90px', textAlign: 'center', background: '#f5f3ff', color: '#6d28d9', borderBottom: '2px solid #ddd6fe', transition: 'all 0.3s ease' }}>
                      {renderSortableHeader('MAIN BSR', 'bsr', 'center')}
                    </th>
                  )}
                  {isVisible('subBsr') && <th rowSpan={2} style={{ ...thStyle, width: '110px', background: '#f5f3ff', color: '#6d28d9', borderBottom: '2px solid #ddd6fe', transition: 'all 0.3s ease' }}>SUB BSR</th>}
                  {isVisible('bsrTrendStatus') && <th rowSpan={2} style={{ ...thStyle, width: '75px', textAlign: 'center', background: '#f5f3ff', color: '#6d28d9', borderBottom: '2px solid #ddd6fe', transition: 'all 0.3s ease' }}>BSR TR</th>}
                  {visibleBsrTrendCount > 0 && (
                    <th colSpan={visibleBsrTrendCount}
                      style={{ ...thStyle, background: '#f5f3ff', color: '#6d28d9', textAlign: 'center', borderBottom: '2px solid #ddd6fe', transition: 'all 0.3s ease' }}>
                      <div className="d-flex align-items-center justify-content-center gap-1" style={{ fontSize: '10px', fontWeight: 700 }}>
                        <span>{bsrTrendExpanded ? 'SUB-BSR TREND' : 'Sub BSR'}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setBsrTrendExpanded(!bsrTrendExpanded); }}
                          className="btn btn-sm p-0 d-inline-flex align-items-center justify-content-center"
                          style={{ border: 'none', background: 'none', color: '#6d28d9', cursor: 'pointer' }}
                          title={bsrTrendExpanded ? "Collapse to Latest" : "Expand to 7 Days"}
                        >
                          {bsrTrendExpanded ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
                        </button>
                      </div>
                    </th>
                  )}

                  {/* ===== RATING COLUMNS (Amber Palette) ===== */}
                  {isVisible('rating') && (
                    <th rowSpan={2} style={{ ...thStyle, width: '60px', textAlign: 'center', background: '#fffbeb', color: '#b45309', borderBottom: '2px solid #fde68a', transition: 'all 0.3s ease' }}>
                      {renderSortableHeader('RT', 'rating', 'center')}
                    </th>
                  )}
                  {isVisible('reviewCount') && (
                    <th rowSpan={2} style={{ ...thStyle, width: '65px', textAlign: 'center', background: '#fffbeb', color: '#b45309', borderBottom: '2px solid #fde68a', transition: 'all 0.3s ease' }}>
                      {renderSortableHeader('CNT', 'reviewCount', 'center')}
                    </th>
                  )}
                  {isVisible('ratingTrendStatus') && <th rowSpan={2} style={{ ...thStyle, width: '75px', textAlign: 'center', background: '#fffbeb', color: '#b45309', borderBottom: '2px solid #fde68a', transition: 'all 0.3s ease' }}>RATING TR</th>}
                  {visibleRatingTrendCount > 0 && (
                    <th colSpan={visibleRatingTrendCount}
                      style={{ ...thStyle, background: '#fffbeb', color: '#b45309', textAlign: 'center', borderBottom: '2px solid #fde68a', transition: 'all 0.3s ease' }}>
                      <div className="d-flex align-items-center justify-content-center gap-1" style={{ fontSize: '10px', fontWeight: 700 }}>
                        <span>{ratingTrendExpanded ? 'RATING TREND' : 'RT'}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setRatingTrendExpanded(!ratingTrendExpanded); }}
                          className="btn btn-sm p-0 d-inline-flex align-items-center justify-content-center"
                          style={{ border: 'none', background: 'none', color: '#b45309', cursor: 'pointer' }}
                          title={ratingTrendExpanded ? "Collapse to Latest" : "Expand to 7 Days"}
                        >
                          {ratingTrendExpanded ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
                        </button>
                      </div>
                    </th>
                  )}
                  {isVisible('reviewCount') && <th rowSpan={2} style={{ ...thStyle, width: '75px', textAlign: 'center', background: '#fffbeb', color: '#b45309', borderBottom: '2px solid #fde68a', transition: 'all 0.3s ease' }} title="Reviews Trend Status">REV TR</th>}
                  {visibleReviewTrendCount > 0 && (
                    <th colSpan={visibleReviewTrendCount}
                      style={{ ...thStyle, background: '#fffbeb', color: '#b45309', textAlign: 'center', borderBottom: '2px solid #fde68a', transition: 'all 0.3s ease' }}>
                      <div className="d-flex align-items-center justify-content-center gap-1" style={{ fontSize: '10px', fontWeight: 700 }}>
                        <span>{reviewTrendExpanded ? 'REVIEWS TREND' : 'REV'}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setReviewTrendExpanded(!reviewTrendExpanded); }}
                          className="btn btn-sm p-0 d-inline-flex align-items-center justify-content-center"
                          style={{ border: 'none', background: 'none', color: '#b45309', cursor: 'pointer' }}
                          title={reviewTrendExpanded ? "Collapse to Latest" : "Expand to 7 Days"}
                        >
                          {reviewTrendExpanded ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
                        </button>
                      </div>
                    </th>
                  )}

                  {/* ===== VISUALS & CONTENT COLUMNS (Video, Images, Bullet Points, A+) (Pink Palette) ===== */}
                  {isVisible('video') && (
                    <th rowSpan={2} style={{ ...thStyle, width: '65px', textAlign: 'center', background: '#fdf2f8', color: '#db2777', borderBottom: '2px solid #fbcfe8', transition: 'all 0.3s ease' }} title="Video Present">
                      {renderSortableHeader('Video', 'videoCount', 'center')}
                    </th>
                  )}
                  {isVisible('imagesCount') && (
                    <th rowSpan={2} style={{ ...thStyle, width: '55px', textAlign: 'center', background: '#fdf2f8', color: '#db2777', borderBottom: '2px solid #fbcfe8', transition: 'all 0.3s ease' }}>
                      {renderSortableHeader('IMG', 'imagesCount', 'center')}
                    </th>
                  )}
                  {visibleImageTrendCount > 0 && (
                    <th colSpan={visibleImageTrendCount}
                      style={{ ...thStyle, background: '#fdf2f8', color: '#db2777', textAlign: 'center', borderBottom: '2px solid #fbcfe8', transition: 'all 0.3s ease' }}>
                      <div className="d-flex align-items-center justify-content-center gap-1" style={{ fontSize: '10px', fontWeight: 700 }}>
                        <span>{imageTrendExpanded ? 'IMG TREND' : 'IMG'}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setImageTrendExpanded(!imageTrendExpanded); }}
                          className="btn btn-sm p-0 d-inline-flex align-items-center justify-content-center"
                          style={{ border: 'none', background: 'none', color: '#db2777', cursor: 'pointer' }}
                          title={imageTrendExpanded ? "Collapse to Latest" : "Expand to 7 Days"}
                        >
                          {imageTrendExpanded ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
                        </button>
                      </div>
                    </th>
                  )}
                  {isVisible('bulletPoints') && <th rowSpan={2} style={{ ...thStyle, width: '35px', textAlign: 'center', background: '#fdf2f8', color: '#db2777', borderBottom: '2px solid #fbcfe8' }}>B</th>}
                  {isVisible('hasAplus') && (
                    <th rowSpan={2} style={{ ...thStyle, width: '55px', textAlign: 'center', background: '#fdf2f8', color: '#db2777', borderBottom: '2px solid #fbcfe8' }}>
                      {renderSortableHeader('A+', 'hasAplus', 'center')}
                    </th>
                  )}
                  {isVisible('aplusDays') && <th rowSpan={2} style={{ ...thStyle, width: '50px', textAlign: 'center', background: '#fdf2f8', color: '#db2777', borderBottom: '2px solid #fbcfe8' }}>A+ DAYS</th>}
                  <th rowSpan={2} style={{
                    ...thStyle,
                    width: '60px',
                    textAlign: 'center',
                    background: '#f8fafc',
                    position: 'sticky',
                    right: 0,
                    zIndex: 25,
                    borderLeft: '1px solid #e5e7eb',
                    borderBottom: '2px solid #e2e8f0'
                  }}>
                    ACTIONS
                  </th>
                </tr>

                <tr>
                  {/* LQS sub-columns disabled per user request
                  {isVisible('titleScore') && <th style={{ ...thStyle, width: '45px', textAlign: 'center', background: '#f8fafc' }} title="Title Quality Score">TTL</th>}
                  {isVisible('bulletScore') && <th style={{ ...thStyle, width: '45px', textAlign: 'center', background: '#f8fafc' }} title="Bullet Points Score">BLT</th>}
                  {isVisible('imageScore') && <th style={{ ...thStyle, width: '45px', textAlign: 'center', background: '#f8fafc' }} title="Image Quality Score">IMG</th>}
                  {isVisible('descriptionScore') && <th style={{ ...thStyle, width: '45px', textAlign: 'center', background: '#f8fafc' }} title="Description Score">DSC</th>}
                  {isVisible('lqs') && <th style={{ ...thStyle, width: '50px', textAlign: 'center', background: '#f1f5f9', fontWeight: 800 }} title="Overall LQS Score">TOTAL</th>}
                  */}

                  {/* Orders Expanded Monthly Columns */}
                  {ordersExpanded && isVisible('totalOrders') && availableMonths.map((month, idx) => (
                    <th key={`ord-m-${idx}`} style={{
                      ...thStyle,
                      ...getTransitionStyle(ordersExpanded, idx, availableMonths.length + 1, '70px'),
                      fontSize: 9,
                      textAlign: 'center',
                      background: '#f8fafc',
                      color: '#334155'
                    }}>
                      <div style={{
                        width: ordersExpanded ? 'auto' : '0px',
                        overflow: 'hidden',
                        transition: 'all 0.3s ease'
                      }}>
                        {formatMonthHeader(month)}
                      </div>
                    </th>
                  ))}
                  {ordersExpanded && isVisible('totalOrders') && (
                    <th style={{
                      ...thStyle,
                      ...getTransitionStyle(ordersExpanded, availableMonths.length, availableMonths.length + 1, '70px'),
                      fontSize: 9,
                      textAlign: 'center',
                      background: '#f1f5f9',
                      fontWeight: 800,
                      color: '#334155'
                    }}>
                      <div style={{
                        width: ordersExpanded ? 'auto' : '0px',
                        overflow: 'hidden',
                        transition: 'all 0.3s ease'
                      }}>
                        TOTAL
                      </div>
                    </th>
                  )}

                  {/* Price Trend Dates */}
                  {isVisible('priceTrend') && historyStructure.map(week => (
                    week.dates.map((date, idx) => (
                      <th key={`p-h-${idx}`} style={{
                        ...thStyle,
                        ...getTransitionStyle(priceTrendExpanded, idx, week.dates.length),
                        fontSize: 9,
                        textAlign: 'center',
                        background: '#eef2ff',
                        color: '#4338ca'
                      }}>
                        <div style={{
                          width: (priceTrendExpanded || idx === week.dates.length - 1) ? 'auto' : '0px',
                          overflow: 'hidden',
                          transition: 'all 0.3s ease'
                        }}>
                          {date.label}
                        </div>
                      </th>
                    ))
                  ))}

                  {/* BSR Trend Dates */}
                  {isVisible('bsrTrend') && historyStructure.map(week => (
                    week.dates.map((date, idx) => (
                      <th key={`b-h-${idx}`} style={{
                        ...thStyle,
                        ...getTransitionStyle(bsrTrendExpanded, idx, week.dates.length),
                        fontSize: 9,
                        textAlign: 'center',
                        background: '#f5f3ff',
                        color: '#6d28d9'
                      }}>
                        <div style={{
                          width: (bsrTrendExpanded || idx === week.dates.length - 1) ? 'auto' : '0px',
                          overflow: 'hidden',
                          transition: 'all 0.3s ease'
                        }}>
                          {date.label}
                        </div>
                      </th>
                    ))
                  ))}

                  {/* Rating Trend Dates */}
                  {isVisible('ratingTrend') && historyStructure.map(week => (
                    week.dates.map((date, idx) => (
                      <th key={`r-h-${idx}`} style={{
                        ...thStyle,
                        ...getTransitionStyle(ratingTrendExpanded, idx, week.dates.length),
                        fontSize: 9,
                        textAlign: 'center',
                        background: '#fffbeb',
                        color: '#b45309'
                      }}>
                        <div style={{
                          width: (ratingTrendExpanded || idx === week.dates.length - 1) ? 'auto' : '0px',
                          overflow: 'hidden',
                          transition: 'all 0.3s ease'
                        }}>
                          {date.label}
                        </div>
                      </th>
                    ))
                  ))}

                  {/* Review Trend Dates */}
                  {isVisible('reviewTrend') && historyStructure.map(week => (
                    week.dates.map((date, idx) => (
                      <th key={`rev-h-${idx}`} style={{
                        ...thStyle,
                        ...getTransitionStyle(reviewTrendExpanded, idx, week.dates.length),
                        fontSize: 9,
                        textAlign: 'center',
                        background: '#fffbeb',
                        color: '#b45309'
                      }}>
                        <div style={{
                          width: (reviewTrendExpanded || idx === week.dates.length - 1) ? 'auto' : '0px',
                          overflow: 'hidden',
                          transition: 'all 0.3s ease'
                        }}>
                          {date.label}
                        </div>
                      </th>
                    ))
                  ))}

                  {/* Image Trend Dates */}
                  {isVisible('imageTrend') && historyStructure.map(week => (
                    week.dates.map((date, idx) => (
                      <th key={`i-h-${idx}`} style={{
                        ...thStyle,
                        ...getTransitionStyle(imageTrendExpanded, idx, week.dates.length),
                        fontSize: 9,
                        textAlign: 'center',
                        background: '#fdf2f8',
                        color: '#db2777'
                      }}>
                        <div style={{
                          width: (imageTrendExpanded || idx === week.dates.length - 1) ? 'auto' : '0px',
                          overflow: 'hidden',
                          transition: 'all 0.3s ease'
                        }}>
                          {date.label}
                        </div>
                      </th>
                    ))
                  ))}
                </tr>

              </thead>
              <tbody>
                {filteredAsins.length === 0 ? (
                  <tr>
                    <td colSpan={56} style={{ padding: '60px 0', background: '#fff' }}>
                      <EmptyState
                        icon={Package}
                        title="No ASINs Found"
                        description="There are no ASINs matching the current filters or seller selection."
                        action={hasPermission('asinmanager_manage') ? { label: 'Add ASINs', onClick: () => setShowAddModal(true) } : null}
                      />
                    </td>
                  </tr>
                ) : (
                  filteredAsins.map((asin, idx) => {
                    const historyMap = {};
                    asin.history?.forEach(h => historyMap[normalizeDateStr(h.date)] = h);

                    const weekHistoryMap = {};
                    asin.weekHistory?.forEach(w => weekHistoryMap[normalizeDateStr(w.date)] = w);

                    const subBsrHistoryMap = {};
                    asin.subBsrHistory?.forEach(h => subBsrHistoryMap[normalizeDateStr(h.date)] = h);

                    return (
                      <tr key={asin._id || idx} className="table-row-hover" style={{
                        background: (() => {
                          const s = (asin.availabilityStatus || '').toLowerCase();
                          const isUnavailable = s.includes('unavailable') || s.includes('out of stock') || s.includes('out_of_stock') || s.includes('currently unavailable');
                          if (isUnavailable) return '#fef2f2';
                          return idx % 2 === 0 ? '#fff' : '#f9fafb';
                        })()
                      }}>
                        {isVisible('checkbox') && (
                          <td style={{
                            ...tdStyle,
                            width: '40px',
                            position: 'sticky',
                            left: 0,
                            background: (() => {
                              const s = (asin.availabilityStatus || '').toLowerCase();
                              const isUnavail = s.includes('unavailable') || s.includes('out of stock') || s.includes('out_of_stock') || s.includes('currently unavailable');
                              if (isUnavail) return '#fef2f2';
                              return idx % 2 === 0 ? '#fff' : '#f9fafb';
                            })(),
                            zIndex: 6,
                            textAlign: 'center',
                            padding: 0
                          }}>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(asin._id)}
                              onChange={() => handleToggleSelectRow(asin._id)}
                              style={{ cursor: 'pointer', verticalAlign: 'middle', width: '13px', height: '13px' }}
                            />
                          </td>
                        )}
                        {isVisible('asinCode') && (
                          <td style={{
                            ...tdStyle,
                            fontWeight: 600,
                            color: '#2563eb',
                            cursor: 'pointer',
                            position: 'sticky',
                            width: '110px',
                            left: isVisible('checkbox') ? '40px' : '0px',
                            background: (() => {
                              const s = (asin.availabilityStatus || '').toLowerCase();
                              const isUnavail = s.includes('unavailable') || s.includes('out of stock') || s.includes('out_of_stock') || s.includes('currently unavailable');
                              if (isUnavail) return '#fef2f2';
                              return idx % 2 === 0 ? '#fff' : '#f9fafb';
                            })(),
                            zIndex: 5,
                            borderRight: '2px solid #e5e7eb'
                          }}
                            onClick={() => handleViewAsin(asin)}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                              <span>{asin.asinCode}</span>
                              <a
                                href={(asin.marketplace === 'ajio' || marketplaceFilter === 'ajio') ? (asin.pageUrl || `https://www.ajio.com/p/${asin.asinCode}`) : (asin.marketplace === 'myntra' || marketplaceFilter === 'myntra') ? (asin.pageUrl || 'https://www.myntra.com') : `https://www.amazon.in/dp/${asin.asinCode}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={asin.marketplace === 'ajio' || marketplaceFilter === 'ajio' ? "Open on Ajio" : "Open on Amazon"}
                                style={{
                                  color: '#9ca3af',
                                  display: 'flex',
                                  alignItems: 'center',
                                  marginLeft: '4px',
                                  transition: 'color 0.2s'
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onMouseOver={(e) => e.currentTarget.style.color = '#2563eb'}
                                onMouseOut={(e) => e.currentTarget.style.color = '#9ca3af'}
                              >
                                <ExternalLink size={13} />
                              </a>
                            </div>
                          </td>
                        )}
                        {/* ===== RELEASE DATE ===== */}
                        {isVisible('releaseDate') && (
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            {asin.releaseDate ? (
                              <div className="d-flex align-items-center justify-content-center gap-2" style={{ whiteSpace: 'nowrap' }}>
                                <span style={{ fontSize: '10px', fontWeight: 600 }}>
                                  {new Date(asin.releaseDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                                </span>
                                <span className="badge bg-light text-zinc-500 border border-light" style={{ fontSize: '8px', padding: '2px 4px' }}>
                                  {(() => {
                                    const days = Math.floor((Date.now() - new Date(asin.releaseDate)) / (1000 * 60 * 60 * 24));
                                    if (days <= 30) return `${days}d`;
                                    if (days <= 60) return `${days}d⚡`;
                                    return `${Math.floor(days / 30)}m`;
                                  })()}
                                </span>
                              </div>
                            ) : (
                              <span style={{ color: '#9ca3af', fontSize: '10px' }}>-</span>
                            )}
                          </td>
                        )}
                        {/* ===== PARENT ASIN ===== */}
                        {isVisible('parentAsin') && (
                          <td style={tdStyle}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                              {(() => {
                                const pAsin = asin.parentAsin || asin.ParentAsin;
                                if (!pAsin) return <span style={{ color: '#d1d5db' }}>-</span>;
                                return (
                                  <>
                                    <span style={{ fontWeight: 600, color: '#2563eb' }}>{pAsin}</span>
                                    <a
                                      href={(asin.marketplace === 'ajio' || marketplaceFilter === 'ajio') ? `https://www.ajio.com/p/${pAsin}` : (asin.marketplace === 'myntra' || marketplaceFilter === 'myntra') ? 'https://www.myntra.com' : `https://www.amazon.in/dp/${pAsin}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title={asin.marketplace === 'ajio' || marketplaceFilter === 'ajio' ? "Open Parent on Ajio" : "Open Parent on Amazon"}
                                      style={{
                                        color: '#9ca3af',
                                        display: 'flex',
                                        alignItems: 'center',
                                        marginLeft: '4px',
                                        transition: 'color 0.2s'
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      onMouseOver={(e) => e.currentTarget.style.color = '#2563eb'}
                                      onMouseOut={(e) => e.currentTarget.style.color = '#9ca3af'}
                                    >
                                      <ExternalLink size={13} />
                                    </a>
                                  </>
                                );
                              })()}
                            </div>
                          </td>
                        )}
                        {isVisible('sellerBrand') && (
                          <td style={tdStyle}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              <span style={{ fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                {asin.seller?.name || asin.seller || 'Global'}
                              </span>
                              {asin.soldBy && <span style={{ fontSize: 9, color: '#9ca3af' }}>• {asin.soldBy}</span>}
                            </div>
                          </td>
                        )}
                        {isVisible('sku') && <td style={tdStyle}>{asin.sku || '-'}</td>}
                        {isVisible('title') && (
                          <td style={{ ...tdStyle, width: '220px', maxWidth: '220px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                              {asin.imageUrl && (
                                <img src={asin.imageUrl} alt="" style={{ width: 18, height: 18, borderRadius: 3, objectFit: 'cover', flexShrink: 0 }} />
                              )}
                              <span style={{
                                display: 'inline-block',
                                whiteSpace: 'nowrap',
                                textOverflow: 'ellipsis',
                                overflow: 'hidden',
                                fontSize: '10.5px',
                                cursor: 'pointer',
                                maxWidth: '180px',
                                fontWeight: 500
                              }} onClick={() => handleViewAsin(asin)} title={asin.title}>
                                {asin.title}
                              </span>
                            </div>
                          </td>
                        )}
                        {isVisible('category') && (
                          <td style={tdStyle}>
                            <div className="d-flex flex-column" style={{ overflow: 'hidden' }}>
                              <span style={{
                                fontWeight: 500,
                                color: '#4b5563',
                                fontSize: '10.5px',
                                whiteSpace: 'nowrap',
                                textOverflow: 'ellipsis',
                                overflow: 'hidden'
                              }} title={asin.category?.replace(/&amp;/g, '&')}>
                                {(asin.category || '').replace(/&amp;/g, '&').split(/[›>]/).pop()?.trim() || '-'}
                              </span>
                            </div>
                          </td>
                        )}
                        {isVisible('tags') && (
                          <td style={tdStyle}>
                            <TagsCell asin={asin} onRefresh={loadData} />
                          </td>
                        )}
                        {/* ===== LISTING QUALITY SCORES ===== */}
                        {/* {isVisible('titleScore') && (
                        <td style={{ ...tdStyle, textAlign: 'center', background: '#fafafa' }}>
                          {asin.titleScore != null ? (
                            <span
                              className="badge fw-bold"
                              style={{
                                fontSize: '10px',
                                backgroundColor: (asin.titleScore || 0) >= 8.5 ? '#059669' :
                                  (asin.titleScore || 0) >= 7.0 ? '#d97706' :
                                    (asin.titleScore || 0) >= 5.0 ? '#dc2626' : '#991b1b',
                                color: '#fff',
                                minWidth: '28px'
                              }}
                            >
                              {typeof asin.titleScore === 'number' ? (asin.titleScore > 10 ? (asin.titleScore / 10).toFixed(1) : asin.titleScore.toFixed(1)) : (parseFloat(asin.titleScore || 0) > 10 ? (parseFloat(asin.titleScore || 0) / 10).toFixed(1) : parseFloat(asin.titleScore || 0).toFixed(1))}
                            </span>
                          ) : (
                            <span style={{ color: '#9ca3af', fontSize: '10px' }}>-</span>
                          )}
                        </td>
                      )} */}

                        {/* {isVisible('bulletScore') && (
                          <td style={{ ...tdStyle, textAlign: 'center', background: '#fafafa' }}>
                            {asin.bulletScore != null ? (
                              <span
                                className="badge fw-bold"
                                style={{
                                  fontSize: '10px',
                                  backgroundColor: (asin.bulletScore || 0) >= 8.5 ? '#059669' :
                                    (asin.bulletScore || 0) >= 7.0 ? '#d97706' :
                                      (asin.bulletScore || 0) >= 5.0 ? '#dc2626' : '#991b1b',
                                  color: '#fff',
                                  minWidth: '28px'
                                }}
                              >
                                {typeof asin.bulletScore === 'number' ? (asin.bulletScore > 10 ? (asin.bulletScore / 10).toFixed(1) : asin.bulletScore.toFixed(1)) : (parseFloat(asin.bulletScore || 0) > 10 ? (parseFloat(asin.bulletScore || 0) / 10).toFixed(1) : parseFloat(asin.bulletScore || 0).toFixed(1))}
                              </span>
                            ) : (
                              <span style={{ color: '#9ca3af', fontSize: '10px' }}>-</span>
                            )}
                          </td>
                        )} */}

                        {/* {isVisible('imageScore') && (
                          <td style={{ ...tdStyle, textAlign: 'center', background: '#fafafa' }}>
                            {asin.imageScore != null ? (
                              <span
                                className="badge fw-bold"
                                style={{
                                  fontSize: '10px',
                                  backgroundColor: (asin.imageScore || 0) >= 8.5 ? '#059669' :
                                    (asin.imageScore || 0) >= 7.0 ? '#d97706' :
                                      (asin.imageScore || 0) >= 5.0 ? '#dc2626' : '#991b1b',
                                  color: '#fff',
                                  minWidth: '28px'
                                }}
                              >
                                {typeof asin.imageScore === 'number' ? (asin.imageScore > 10 ? (asin.imageScore / 10).toFixed(1) : asin.imageScore.toFixed(1)) : (parseFloat(asin.imageScore || 0) > 10 ? (parseFloat(asin.imageScore || 0) / 10).toFixed(1) : parseFloat(asin.imageScore || 0).toFixed(1))}
                              </span>
                            ) : (
                              <span style={{ color: '#9ca3af', fontSize: '10px' }}>-</span>
                            )}
                          </td>
                        )} */}

                        {/* {isVisible('descriptionScore') && (
                          <td style={{ ...tdStyle, textAlign: 'center', background: '#fafafa' }}>
                            {asin.descriptionScore != null ? (
                              <span
                                className="badge fw-bold"
                                style={{
                                  fontSize: '10px',
                                  backgroundColor: (asin.descriptionScore || 0) >= 8.5 ? '#059669' :
                                    (asin.descriptionScore || 0) >= 7.0 ? '#d97706' :
                                      (asin.descriptionScore || 0) >= 5.0 ? '#dc2626' : '#991b1b',
                                  color: '#fff',
                                  minWidth: '28px'
                                }}
                              >
                                {typeof asin.descriptionScore === 'number' ? (asin.descriptionScore > 10 ? (asin.descriptionScore / 10).toFixed(1) : asin.descriptionScore.toFixed(1)) : (parseFloat(asin.descriptionScore || 0) > 10 ? (parseFloat(asin.descriptionScore || 0) / 10).toFixed(1) : parseFloat(asin.descriptionScore || 0).toFixed(1))}
                              </span>
                            ) : (
                              <span style={{ color: '#9ca3af', fontSize: '10px' }}>-</span>
                            )}
                          </td>
                        )} */}

                        {/* {isVisible('lqs') && (
                          <td style={{ ...tdStyle, textAlign: 'center', background: '#f1f5f9', fontWeight: 700 }}>
                            {asin.lqs != null ? (
                              <span
                                className="badge fw-bold"
                                style={{
                                  fontSize: '11px',
                                  backgroundColor: (asin.lqs || 0) >= 8.5 || (asin.lqs || 0) >= 85 ? '#059669' :
                                    (asin.lqs || 0) >= 7.0 || (asin.lqs || 0) >= 70 ? '#d97706' :
                                      (asin.lqs || 0) >= 5.0 || (asin.lqs || 0) >= 50 ? '#dc2626' : '#991b1b',
                                  color: '#fff',
                                  padding: '3px 8px',
                                  minWidth: '36px'
                                }}
                              >
                                {typeof asin.lqs === 'number' ? (asin.lqs > 10 ? (asin.lqs / 10).toFixed(1) : asin.lqs.toFixed(1)) : (parseFloat(asin.lqs || 0) > 10 ? (parseFloat(asin.lqs || 0) / 10).toFixed(1) : parseFloat(asin.lqs || 0).toFixed(1))}
                              </span>
                            ) : (
                              <span style={{ color: '#9ca3af', fontSize: '10px' }}>-</span>
                            )}
                          </td>
                        )} */}
                        {isVisible('manufacturer') && (
                          <td style={{ ...tdStyle, textAlign: 'left' }}>
                            <span style={{ fontSize: '10px', color: '#334155', maxWidth: '110px', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={asin.manufacturer || ''}>
                              {asin.manufacturer || <span style={{ color: '#9ca3af' }}>-</span>}
                            </span>
                          </td>
                        )}
                        {isVisible('availabilityStatus') && (
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            {asin.availabilityStatus ? (
                              (() => {
                                const s = (asin.availabilityStatus || '').toLowerCase();
                                const isUnavailable = s.includes('unavailable') || s.includes('out of stock') || s.includes('out_of_stock') || s.includes('currently unavailable');
                                const isInStock = s.includes('in stock') || s.includes('add to bag') || s.includes('add to cart') || s === 'available';
                                const bgColor = isUnavailable ? '#fef2f2' : isInStock ? '#ecfdf5' : '#f8fafc';
                                const textColor = isUnavailable ? '#dc2626' : isInStock ? '#059669' : '#334155';
                                const borderColor = isUnavailable ? '#fecaca' : isInStock ? '#a7f3d0' : '#e2e8f0';
                                return (
                                  <Tooltip title={asin.availabilityStatus} placement="top" styles={{ root: { fontSize: 11 } }}>
                                    <span className="badge" style={{
                                      backgroundColor: bgColor,
                                      color: textColor,
                                      border: `1px solid ${borderColor}`,
                                      fontWeight: 600, fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', maxWidth: '90px', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'default'
                                    }}>
                                      {asin.availabilityStatus}
                                    </span>
                                  </Tooltip>
                                );
                              })()
                            ) : <span style={{ color: '#9ca3af', fontSize: '9px' }}>-</span>}
                          </td>
                        )}

                        {isVisible('ads') && (
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            {asin.Ads ? (
                              <div className="d-flex align-items-center justify-content-center gap-1" title="Advertising Active">
                                <span className="badge d-flex align-items-center gap-1 shadow-sm" style={{ backgroundColor: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', padding: '3px 6px', fontSize: '0.65rem', fontWeight: 800, borderRadius: '4px' }}>
                                  <Megaphone size={10} />
                                  YES
                                </span>
                              </div>
                            ) : (
                              <span className="text-zinc-300" style={{ fontSize: '10px' }}>—</span>
                            )}
                          </td>
                        )}
                        {/* Orders Monthly Cells */}
                        {isVisible('totalOrders') && ordersExpanded && availableMonths.map((month, mIdx) => {
                          const monthOrders = asin.monthlyOrders ? asin.monthlyOrders[month] : 0;
                          return (
                            <td key={`ord-c-${mIdx}`} style={{
                              ...tdStyle,
                              ...getTransitionStyle(ordersExpanded, mIdx, availableMonths.length + 1, '70px'),
                              textAlign: 'center'
                            }}>
                              <div style={{
                                width: ordersExpanded ? 'auto' : '0px',
                                overflow: 'hidden',
                                transition: 'all 0.3s ease'
                              }}>
                                {monthOrders > 0 ? (
                                  <span className="text-zinc-600" style={{ fontSize: '11px' }}>
                                    {monthOrders.toLocaleString()}
                                  </span>
                                ) : (
                                  <span className="text-zinc-300" style={{ fontSize: '10px' }}>—</span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                        {/* Orders Total Cell */}
                        {isVisible('totalOrders') && (
                          <td style={{
                            ...tdStyle,
                            ...getTransitionStyle(ordersExpanded, availableMonths.length, availableMonths.length + 1, '70px'),
                            textAlign: 'center',
                            background: ordersExpanded ? '#f8fafc' : 'transparent'
                          }}>
                            <div style={{
                              width: 'auto',
                              overflow: 'hidden',
                              transition: 'all 0.3s ease'
                            }}>
                              {asin.totalOrders !== undefined && asin.totalOrders > 0 ? (
                                <span className="fw-bold text-zinc-700" style={{ fontSize: '11px' }}>
                                  {asin.totalOrders.toLocaleString()}
                                </span>
                              ) : (
                                <span className="text-zinc-300" style={{ fontSize: '10px' }}>—</span>
                              )}
                            </div>
                          </td>
                        )}
                        {isVisible('dealBadge') && (
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            {asin.dealBadge && asin.dealBadge !== 'No deal found' && asin.dealBadge !== '' ? (
                              <Tooltip title={asin.dealBadge} placement="top" styles={{ root: { fontSize: 11 } }}>
                                <span
                                  className="badge"
                                  style={{
                                    backgroundColor: '#fef2f2',
                                    color: '#dc2626',
                                    border: '1px solid #fecaca',
                                    fontWeight: 700,
                                    fontSize: '0.65rem',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    display: 'inline-block',
                                    maxWidth: '75px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    cursor: 'default'
                                  }}
                                >
                                  {asin.dealBadge}
                                </span>
                              </Tooltip>
                            ) : (
                              <span style={{ color: '#9ca3af', fontSize: '9px' }}>-</span>
                            )}
                          </td>
                        )}
                        {isVisible('dealStartTime') && (
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            {asin.dealStartTime ? (
                              <span style={{ fontSize: '10px', color: '#334155' }}>
                                {new Date(asin.dealStartTime).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                              </span>
                            ) : <span style={{ color: '#9ca3af', fontSize: '9px' }}>-</span>}
                          </td>
                        )}
                        {isVisible('dealEndTime') && (
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            {asin.dealEndTime ? (
                              <span style={{ fontSize: '10px', color: '#334155' }}>
                                {new Date(asin.dealEndTime).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                              </span>
                            ) : <span style={{ color: '#9ca3af', fontSize: '9px' }}>-</span>}
                          </td>
                        )}
                        {isVisible('dealAccessType') && (
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            {asin.dealAccessType ? (
                              <span className="badge" style={{
                                backgroundColor: asin.dealAccessType === 'ALL' ? '#ecfdf5' : '#eff6ff',
                                color: asin.dealAccessType === 'ALL' ? '#059669' : '#2563eb',
                                border: `1px solid ${asin.dealAccessType === 'ALL' ? '#a7f3d0' : '#bfdbfe'}`,
                                fontWeight: 700, fontSize: '0.6rem', padding: '2px 5px', borderRadius: '4px'
                              }}>
                                {asin.dealAccessType}
                              </span>
                            ) : <span style={{ color: '#9ca3af', fontSize: '9px' }}>-</span>}
                          </td>
                        )}
                        {/* ===== CURRENT BUYBOX ===== */}
                        {isVisible('currentBuybox') && (
                          <td style={{ ...tdStyle, width: '110px', padding: '4px 8px' }}>
                            {(() => {
                              const buyBoxes = asin.buyBoxes || [];
                              const winner = buyBoxes.find(b => b.isBuyBoxWinner) || buyBoxes[0];
                              const seller = winner?.seller || asin.soldBy || null;
                              const price = winner?.priceAmount || asin.currentPrice || 0;
                              const mrp = winner?.mrpAmount || 0;
                              const savings = winner?.savingsAmount || 0;
                              const savingsPct = winner?.savingsPercentage || 0;
                              const condition = winner?.condition?.value || '';
                              const availability = winner?.availability || '';

                              if (!seller && !price) return <span style={{ color: '#9ca3af', fontSize: '10px' }}>-</span>;

                              return (
                                <Tooltip title={
                                  <div style={{ fontSize: 11 }}>
                                    <div><b>Seller:</b> {seller || 'Unknown'}</div>
                                    <div><b>Price:</b> ₹{price.toLocaleString()}</div>
                                    {mrp > 0 && <div><b>MRP:</b> ₹{mrp.toLocaleString()}</div>}
                                    {savings > 0 && <div><b>Savings:</b> ₹{savings.toLocaleString()} ({savingsPct}% OFF)</div>}
                                    {condition && <div><b>Condition:</b> {condition}</div>}
                                    {availability && <div><b>Avail:</b> {availability}</div>}
                                  </div>
                                } placement="left" styles={{ root: { fontSize: 11 } }}>
                                  <div className="d-flex flex-column gap-1">
                                    <span className="fw-bold text-zinc-800 text-truncate" style={{ fontSize: '10px' }} title={seller || 'Unknown'}>
                                      {seller || 'Unknown'}
                                    </span>
                                    <span className="fw-bold text-indigo-600" style={{ fontSize: '11px' }}>
                                      ₹{price.toLocaleString()}
                                    </span>
                                    {savings > 0 && (
                                      <span style={{ fontSize: '8px', color: '#059669', fontWeight: 600 }}>
                                        {savingsPct}% OFF
                                      </span>
                                    )}
                                  </div>
                                </Tooltip>
                              );
                            })()}
                          </td>
                        )}

                        {isVisible('mrp') && (
                          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: '#6b7280', fontSize: '10.5px' }}>
                            ₹{(asin.mrp || 0).toLocaleString()}
                          </td>
                        )}
                        {isVisible('price') && (
                          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, cursor: 'pointer' }}
                            onClick={(e) => handleViewPrice(asin, e)}
                            title="View Price Trend Matrix">
                            <div className="d-flex flex-column align-items-end">
                              <>
                                <span style={{ color: asin.priceDispute ? '#dc2626' : '#16a34a' }}>
                                  ₹{(asin.uploadedPrice || 0).toLocaleString()}
                                </span>
                                {asin.priceDispute && (
                                  <span className="badge mt-1 shadow-sm" style={{
                                    fontSize: '8px',
                                    padding: '2px 6px',
                                    fontWeight: 800,
                                    backgroundColor: '#dc2626',
                                    color: '#fff',
                                    borderRadius: '4px',
                                    textTransform: 'uppercase'
                                  }}>
                                    PRICE DISPUTE
                                  </span>
                                )}
                              </>
                            </div>
                          </td>
                        )}
                        {isVisible('discountPercentage') && (
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            <span className="badge bg-danger bg-opacity-10 text-danger" style={{ fontWeight: 700, fontSize: '11px' }}>
                              {asin.discountPercentage ? `${asin.discountPercentage}% OFF` : '-'}
                            </span>
                          </td>
                        )}
                        {isVisible('priceDispute') && (
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            <Tooltip title={asin.priceDispute ? 'Channel price differs from current price by >₹5' : 'No price dispute'} placement="top" styles={{ root: { fontSize: 11 } }}>
                              <span className="badge" style={{
                                backgroundColor: asin.priceDispute ? '#fef2f2' : '#ecfdf5',
                                color: asin.priceDispute ? '#dc2626' : '#059669',
                                border: `1px solid ${asin.priceDispute ? '#fecaca' : '#a7f3d0'}`,
                                fontWeight: 600, fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px',
                                cursor: 'default'
                              }}>
                                {asin.priceDispute ? 'DISPUTED' : 'No Dispute'}
                              </span>
                            </Tooltip>
                          </td>
                        )}
                        {isVisible('priceTrend') && historyStructure.map(week => (
                          week.dates.map((date, dIdx) => {
                            const wData = weekHistoryMap[date.raw] || historyMap[date.raw];
                            const currentOrUploadedPrice = asin.currentPrice;
                            let priceVal = (wData && wData.price !== undefined && wData.price !== null && wData.price !== 0)
                              ? wData.price
                              : null;

                            // Fallback removed to expose data integrity gaps

                            return (
                              <td key={`p-${week.label}-${dIdx}`}
                                onClick={(e) => handleViewPrice(asin, e)}
                                title="View Price Trend Matrix"
                                style={{
                                  ...tdStyle,
                                  ...getTransitionStyle(priceTrendExpanded, dIdx, week.dates.length),
                                  textAlign: 'center',
                                  background: '#f5f3ff33',
                                  cursor: 'pointer'
                                }}>
                                <div style={{
                                  width: (priceTrendExpanded || dIdx === week.dates.length - 1) ? 'auto' : '0px',
                                  overflow: 'hidden',
                                  transition: 'all 0.3s ease'
                                }}>
                                  {priceVal ? getWeekHistoryBadge(priceVal, 'price', currentOrUploadedPrice) : '-'}
                                </div>
                              </td>
                            );
                          })
                        ))}
                        {isVisible('mainBsr') && (
                          <td style={{ ...tdStyle, textAlign: 'center', cursor: 'pointer', background: '#f5f3ff1a' }}
                            onClick={(e) => handleViewBsr(asin, e)}>
                            <div className="d-flex flex-column align-items-center">
                              <div style={{ fontWeight: 700, color: '#7c3aed', fontSize: '11px' }}>
                                {asin.bsr ? `#${asin.bsr.toLocaleString()}` : '-'}
                              </div>
                              {asin.bsr && asin.category && (
                                <span className="text-zinc-400 text-truncate" style={{ fontSize: '8px', maxWidth: '75px' }} title={asin.category}>
                                  in {asin.category}
                                </span>
                              )}
                            </div>
                          </td>
                        )}

                        {isVisible('subBsr') && (
                          <td style={{ ...tdStyle, width: '120px' }}>
                            {(() => {
                              const subBsrValue = (asin.subBsr && asin.subBsr !== '0' && asin.subBsr !== 0) ? asin.subBsr : ((Array.isArray(asin.subBSRs) && asin.subBSRs[0]) || '');
                              const hasMultiple = Array.isArray(asin.subBSRs) && asin.subBSRs.length > 1;
                              let rank = subBsrValue;
                              let category = '';
                              if (typeof subBsrValue === 'string' && subBsrValue.includes(' in ')) {
                                const parts = subBsrValue.split(' in ');
                                rank = parts[0];
                                category = parts.slice(1).join(' in ');
                              }

                              return subBsrValue && subBsrValue !== '0' ? (
                                <div className="d-flex flex-column gap-1">
                                  <div className="d-flex align-items-center gap-1">
                                    <span style={{
                                      fontSize: '10px',
                                      color: '#4b5563',
                                      fontWeight: 600,
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      maxWidth: hasMultiple ? '85px' : '110px'
                                    }} title={rank}>
                                      {rank}
                                    </span>
                                    {hasMultiple && (
                                      <span
                                        className="badge rounded-pill bg-zinc-100 text-zinc-500 border border-zinc-200"
                                        style={{ fontSize: '8px', padding: '1px 4px' }}
                                        title={asin.subBSRs.slice(1).join('\n')}
                                      >
                                        +{asin.subBSRs.length - 1}
                                      </span>
                                    )}
                                  </div>
                                  {category && (
                                    <span style={{
                                      fontSize: '9px',
                                      color: '#6b7280',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      maxWidth: '110px'
                                    }} title={category}>
                                      {category}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: '#9ca3af' }}>-</span>
                              );
                            })()}
                          </td>
                        )}
                        {isVisible('bsrTrendStatus') && (
                          <td
                            style={{ ...tdStyle, textAlign: 'center', background: '#f5f3ff1a', cursor: 'pointer' }}
                            onClick={() => handleViewTrends(asin, 'bsr')}
                          >
                            <TrendBadge status={asin.bsrTrend} />
                          </td>
                        )}
                        {isVisible('bsrTrend') && historyStructure.map(week => (
                          week.dates.map((date, dIdx) => {
                            const hDate = date.raw;
                            const subBsrPoint = subBsrHistoryMap[hDate];
                            const displayVal = subBsrPoint?.rank ?? asin.subBsr;
                            return (
                              <td key={`b-${week.label}-${dIdx}`}
                                onClick={(e) => handleViewBsr(asin, e)}
                                style={{
                                  ...tdStyle,
                                  ...getTransitionStyle(bsrTrendExpanded, dIdx, week.dates.length),
                                  textAlign: 'center',
                                  background: '#f5f3ff33',
                                  cursor: 'pointer'
                                }}>
                                <div style={{
                                  width: (bsrTrendExpanded || dIdx === week.dates.length - 1) ? 'auto' : '0px',
                                  overflow: 'hidden',
                                  transition: 'all 0.3s ease'
                                }}>
                                  {displayVal ? getWeekHistoryBadge(displayVal, 'subBsr') : '-'}
                                </div>
                              </td>
                            );
                          })
                        ))}
                        {isVisible('rating') && (
                          <td style={{ ...tdStyle, textAlign: 'center', cursor: 'pointer' }}
                            onClick={(e) => handleViewRating(asin, e)}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                              <Star size={10} className="text-warning fill-warning" />
                              <span style={{ fontWeight: 600 }}>
                                {typeof asin.rating === 'number' ? asin.rating.toFixed(1) : (asin.rating || '-')}
                              </span>
                            </div>
                          </td>
                        )}
                        {isVisible('reviewCount') && (
                          <td style={{ ...tdStyle, textAlign: 'center', color: '#6b7280', fontWeight: 500 }}>
                            {asin.reviewCount !== null && asin.reviewCount !== undefined ? asin.reviewCount.toLocaleString() : '-'}
                          </td>
                        )}
                        {isVisible('ratingTrendStatus') && (
                          <td
                            style={{ ...tdStyle, textAlign: 'center', cursor: 'pointer' }}
                            onClick={() => handleViewTrends(asin, 'rating')}
                          >
                            <TrendBadge status={asin.ratingTrend} />
                          </td>
                        )}
                        {isVisible('ratingTrend') && historyStructure.map(week => (
                          week.dates.map((date, dIdx) => {
                            const wData = weekHistoryMap[date.raw] || historyMap[date.raw];
                            const ratingVal = (wData && wData.rating !== undefined && wData.rating !== null) ? wData.rating : asin.rating;
                            return (
                              <td key={`r-${week.label}-${dIdx}`}
                                onClick={(e) => handleViewRating(asin, e)}
                                style={{
                                  ...tdStyle,
                                  ...getTransitionStyle(ratingTrendExpanded, dIdx, week.dates.length),
                                  textAlign: 'center',
                                  background: '#fffbeb33',
                                  cursor: 'pointer'
                                }}>
                                <div style={{
                                  width: (ratingTrendExpanded || dIdx === week.dates.length - 1) ? 'auto' : '0px',
                                  overflow: 'hidden',
                                  transition: 'all 0.3s ease'
                                }}>
                                  {(ratingVal !== undefined && ratingVal !== null && ratingVal !== '') ? getWeekHistoryBadge(ratingVal, 'rating') : '-'}
                                </div>
                              </td>
                            );
                          })
                        ))}
                        {isVisible('reviewCount') && (
                          <td
                            style={{ ...tdStyle, textAlign: 'center', cursor: 'pointer' }}
                            onClick={() => handleViewTrends(asin, 'reviews')}
                          >
                            <TrendBadge status={getReviewTrendStatus(asin)} />
                          </td>
                        )}
                        {isVisible('reviewTrend') && historyStructure.map(week => (
                          week.dates.map((date, dIdx) => {
                            const wData = weekHistoryMap[date.raw] || historyMap[date.raw];
                            const reviewsVal = (wData && wData.reviews !== undefined && wData.reviews !== null) ? wData.reviews : (wData?.reviewCount !== undefined && wData?.reviewCount !== null ? wData.reviewCount : asin.reviewCount);
                            return (
                              <td key={`rev-${week.label}-${dIdx}`}
                                onClick={(e) => handleViewRating(asin, e)}
                                style={{
                                  ...tdStyle,
                                  ...getTransitionStyle(reviewTrendExpanded, dIdx, week.dates.length),
                                  textAlign: 'center',
                                  background: '#fffbeb33',
                                  cursor: 'pointer'
                                }}>
                                <div style={{
                                  width: (reviewTrendExpanded || dIdx === week.dates.length - 1) ? 'auto' : '0px',
                                  overflow: 'hidden',
                                  transition: 'all 0.3s ease'
                                }}>
                                  {(reviewsVal !== undefined && reviewsVal !== null && reviewsVal !== '') ? <span style={{ fontSize: '10px', color: '#b45309', fontWeight: 600 }}>{reviewsVal.toLocaleString()}</span> : '-'}
                                </div>
                              </td>
                            );
                          })
                        ))}
                        {isVisible('video') && (
                          <td style={{ ...tdStyle, width: '50px', textAlign: 'center' }}>
                            <span
                              className="badge"
                              style={{
                                backgroundColor: asin.videoCount > 0 ? '#059669' : '#6b7280',
                                color: '#fff',
                                fontWeight: 600,
                                fontSize: '0.75rem'
                              }}
                            >
                              {asin.videoCount > 0 ? 'Yes' : 'No'}
                            </span>
                          </td>
                        )}
                        {isVisible('imagesCount') && <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600 }}>{asin.imagesCount || 0}</td>}

                        {isVisible('imageTrend') && historyStructure.map(week => (
                          week.dates.map((date, dIdx) => {
                            const wData = weekHistoryMap[date.raw] || historyMap[date.raw];
                            return (
                              <td key={`i-${week.label}-${dIdx}`}
                                style={{
                                  ...tdStyle,
                                  ...getTransitionStyle(imageTrendExpanded, dIdx, week.dates.length),
                                  textAlign: 'center',
                                  background: '#fdf2f833',
                                  borderRight: '1px solid #fce7f3'
                                }}>
                                <div style={{
                                  width: (imageTrendExpanded || dIdx === week.dates.length - 1) ? 'auto' : '0px',
                                  overflow: 'hidden',
                                  transition: 'all 0.3s ease'
                                }}>
                                  <span style={{ fontSize: '10px', color: '#db2777', fontWeight: 600 }}>
                                    {wData?.imageCount !== undefined ? wData.imageCount : (asin.imagesCount || '-')}
                                  </span>
                                </div>
                              </td>
                            );
                          })
                        ))}

                        {isVisible('bulletPoints') && (
                          <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600 }}>
                            {asin.bulletPoints || asin.bulletPointsText?.length || 0}
                          </td>
                        )}

                        {isVisible('hasAplus') && (
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            {asin.status === 'Scraping' ? (
                              <span style={{ color: '#9ca3af' }}>-</span>
                            ) : (
                              <span
                                className="badge"
                                style={{
                                  backgroundColor: asin.hasAplus ? '#059669' : '#6b7280',
                                  color: '#fff',
                                  fontWeight: 600,
                                  fontSize: '0.75rem'
                                }}
                              >
                                {asin.hasAplus ? 'Yes' : 'No'}
                              </span>
                            )}
                          </td>
                        )}

                        {isVisible('aplusDays') && (
                          <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700, color: '#dc2626' }}>
                            {asin.aplusAbsentSince && !asin.hasAplus
                              ? Math.floor((Date.now() - new Date(asin.aplusAbsentSince)) / (1000 * 60 * 60 * 24))
                              : '-'}
                          </td>
                        )}
                        {/* ===== ROW ACTIONS ===== */}
                        <td style={{
                          ...tdStyle,
                          width: '60px',
                          textAlign: 'center',
                          position: 'sticky',
                          right: 0,
                          background: idx % 2 === 0 ? '#fff' : '#f9fafb',
                          zIndex: 6,
                          borderLeft: '1px solid #e5e7eb',
                          padding: '4px'
                        }}>
                          <Dropdown
                            menu={{
                              items: [
                                {
                                  key: 'view',
                                  label: 'View Details',
                                  icon: <Eye size={14} className="text-blue-500" />,
                                  onClick: () => handleViewAsin(asin)
                                },
                                {
                                  key: 'trends',
                                  label: 'View Trends',
                                  icon: <TrendingUp size={14} className="text-indigo-500" />,
                                  onClick: () => handleViewTrends(asin)
                                },
                                {
                                  key: 'sync',
                                  label: 'Sync Marketplace',
                                  icon: <RefreshCw size={14} className="text-emerald-500" />,
                                  onClick: () => handleSyncAsin(asin._id)
                                },
                                {
                                  key: 'edit',
                                  label: 'Edit ASIN',
                                  icon: <Edit3 size={14} className="text-amber-500" />,
                                  onClick: () => {
                                    setEditingAsin(asin);
                                    setShowEditModal(true);
                                  }
                                },
                                {
                                  key: 'toggle',
                                  label: asin.status === 'Active' ? 'Deactivate' : 'Activate',
                                  icon: asin.status === 'Active' ? <PauseCircle size={14} className="text-zinc-500" /> : <PlayCircle size={14} className="text-emerald-500" />,
                                  onClick: () => handleToggleAsinStatus(asin._id, asin.status)
                                },
                                isAdmin ? { type: 'divider' } : null,
                                isAdmin ? {
                                  key: 'delete',
                                  label: 'Delete ASIN',
                                  icon: <Trash2 size={14} className="text-rose-500" />,
                                  danger: true,
                                  onClick: () => handleDeleteAsin(asin._id)
                                } : null
                              ].filter(Boolean)
                            }}
                            trigger={['click']}
                            placement="bottomRight"
                          >
                            <Button
                              type="text"
                              size="small"
                              icon={<MoreHorizontal size={16} color="#71717a" />}
                              className="hover-bg-zinc-100 rounded-circle"
                              style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            />
                          </Dropdown>
                        </td>
                      </tr>
                    );
                  }))}
              </tbody>
            </table>
          </div>

          {/* [F] Pagination Footer */}
          <div style={{
            background: '#f9fafb', borderTop: '1px solid #e5e7eb',
            flexShrink: 0
          }}>
            <Suspense fallback={<div className="h-10 w-full animate-pulse bg-zinc-100" />}>
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
                  minHeight: '36px',
                  '.MuiToolbar-root': {
                    minHeight: '36px',
                    height: '36px',
                    paddingLeft: '12px',
                    paddingRight: '12px'
                  },
                  '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#6b7280',
                    margin: 0
                  },
                  '.MuiTablePagination-select': {
                    fontSize: '11px',
                    fontWeight: 600
                  },
                  '.MuiTablePagination-actions': {
                    marginLeft: '8px',
                    '& .MuiIconButton-root': {
                      padding: '4px'
                    }
                  }
                }}
              />
            </Suspense>
          </div>
        </div>

        {/* [M] Modals Consolidated */}
        <Suspense fallback={<div />}>

          {activeEditAsin && (
            <EditTagsModal
              isOpen={!!activeEditAsin}
              asin={activeEditAsin}
              onClose={() => setActiveEditAsin(null)}
              onUpdate={(asinId, newTags) => {
                setAsins(prev => prev.map(a =>
                  a._id === asinId ? { ...a, tags: newTags } : a
                ));
              }}
            />
          )}
        </Suspense>

        {/* MODERNIZED ADD ASIN MODAL */}
        <Modal
          title={
            <div className="d-flex align-items-center gap-2">
              <PlusCircle size={18} className="text-primary" />
              <span style={{ fontWeight: 700 }}>Add New ASINs</span>
            </div>
          }
          open={showAddModal}
          onCancel={() => setShowAddModal(false)}
          footer={[
            <Button key="cancel" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>,
            <Button
              key="submit"
              type="primary"
              loading={syncing}
              onClick={handleSync}
              style={{ fontWeight: 700 }}
            >
              {syncing ? 'Adding...' : 'Add ASINs'}
            </Button>
          ]}
          width={480}
          centered
          styles={{
            header: { borderBottom: '1px solid #f0f0f0', paddingBottom: 12 },
            footer: { borderTop: '1px solid #f0f0f0', paddingTop: 12 }
          }}
        >
          <div className="py-2">
            <Form layout="vertical">
              <Form.Item
                label={<span className="fw-bold text-zinc-600" style={{ fontSize: '11px' }}>ASIN LIST (COMMA SEPARATED)</span>}
              >
                <Input.TextArea
                  value={newAsin}
                  onChange={(e) => setNewAsin(e.target.value)}
                  placeholder="B0XXXXXXX, B0YYYYYYY"
                  rows={4}
                  style={{ borderRadius: '8px' }}
                />
              </Form.Item>
              <Form.Item
                label={<span className="fw-bold text-zinc-600" style={{ fontSize: '11px' }}>SELECT SELLER</span>}
              >
                <InfiniteScrollSelect
                  fetchData={fetchSellerDropdownData}
                  value={selectedSellerId}
                  onSelect={setSelectedSellerId}
                  placeholder="Select Seller..."
                />
              </Form.Item>
            </Form>
          </div>
        </Modal>

        {/* MODERNIZED MANUAL TASK MODAL */}
        <Modal
          title={
            <div>
              <div className="d-flex align-items-center gap-2">
                <PlusCircle size={18} className="text-emerald-500" />
                <span style={{ fontWeight: 800 }}>Create Task for Selected ASINs</span>
              </div>
              <p className="m-0 mt-1 text-zinc-500 fw-medium" style={{ fontSize: '11px' }}>
                Assigning a custom task category-wise for {selectedIds.size} selected ASIN(s)
              </p>
            </div>
          }
          open={showManualTaskModal}
          onCancel={() => setShowManualTaskModal(false)}
          footer={[
            <Button key="cancel" onClick={() => setShowManualTaskModal(false)}>
              Cancel
            </Button>,
            <Button
              key="submit"
              type="primary"
              loading={loading}
              onClick={handleCreateManualTask}
              style={{ background: '#10b981', borderColor: '#10b981', fontWeight: 700 }}
            >
              {loading ? 'Creating...' : 'Create Task'}
            </Button>
          ]}
          width={540}
          centered
          styles={{
            header: { borderBottom: '1px solid #f0f0f0', paddingBottom: 16 },
            footer: { borderTop: '1px solid #f0f0f0', paddingTop: 16 }
          }}
        >
          <div className="py-3">
            <Form layout="vertical">
              <Form.Item label={<span className="fw-bold text-zinc-600 text-uppercase tracking-wider" style={{ fontSize: '10px' }}>Task Title</span>}>
                <Input
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="e.g., Update listing bullet points"
                  style={{ borderRadius: '8px', padding: '8px 12px' }}
                />
              </Form.Item>
              <Form.Item label={<span className="fw-bold text-zinc-600 text-uppercase tracking-wider" style={{ fontSize: '10px' }}>Task Description</span>}>
                <Input.TextArea
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="Describe the steps or requirements for this task..."
                  rows={3}
                  style={{ borderRadius: '8px' }}
                />
              </Form.Item>
              <div className="row">
                <div className="col-md-6">
                  <Form.Item label={<span className="fw-bold text-zinc-600 text-uppercase tracking-wider" style={{ fontSize: '10px' }}>Priority</span>}>
                    <Select
                      value={taskPriority}
                      onChange={setTaskPriority}
                      style={{ height: '40px' }}
                    >
                      <Select.Option value="LOW">Low</Select.Option>
                      <Select.Option value="MEDIUM">Medium</Select.Option>
                      <Select.Option value="HIGH">High</Select.Option>
                      <Select.Option value="CRITICAL">Critical</Select.Option>
                    </Select>
                  </Form.Item>
                </div>
                <div className="col-md-6">
                  <Form.Item label={<span className="fw-bold text-zinc-600 text-uppercase tracking-wider" style={{ fontSize: '10px' }}>Task Category</span>}>
                    <Select
                      value={taskCategory}
                      onChange={setTaskCategory}
                      style={{ height: '40px' }}
                    >
                      <Select.Option value="TITLE_OPTIMIZATION">Title Optimization</Select.Option>
                      <Select.Option value="IMAGE_OPTIMIZATION">Image Optimization</Select.Option>
                      <Select.Option value="DESCRIPTION_OPTIMIZATION">Description Optimization</Select.Option>
                      <Select.Option value="A_PLUS_CONTENT">A+ Content Optimization</Select.Option>
                      <Select.Option value="GENERAL_OPTIMIZATION">Listing Quality (LQS)</Select.Option>
                      <Select.Option value="GENERAL">Custom General Task</Select.Option>
                    </Select>
                  </Form.Item>
                </div>
              </div>
            </Form>
          </div>
        </Modal>

        {/* MODERNIZED UPLOAD MODAL */}
        <Modal
          title={
            <div className="d-flex align-items-center gap-2">
              <Upload size={18} className="text-emerald-600" />
              <span style={{ fontWeight: 700 }}>Upload CSV</span>
            </div>
          }
          open={showUploadModal}
          onCancel={() => setShowUploadModal(false)}
          footer={[
            <Button key="cancel" onClick={() => setShowUploadModal(false)}>
              Cancel
            </Button>,
            <Button
              key="submit"
              type="primary"
              loading={uploading}
              disabled={!selectedSellerId}
              onClick={() => document.querySelector('input[type="file"]')?.click()}
              style={{ background: '#16a34a', borderColor: '#16a34a', fontWeight: 700 }}
            >
              {uploading ? 'Uploading...' : 'Import CSV'}
            </Button>
          ]}
          width={450}
          centered
        >
          <div className="py-3">
            <Form layout="vertical">
              <Form.Item label={<span className="fw-bold text-zinc-600" style={{ fontSize: '11px' }}>SELECT SELLER</span>}>
                <InfiniteScrollSelect
                  fetchData={fetchSellerDropdownData}
                  value={selectedSellerId}
                  onSelect={setSelectedSellerId}
                  placeholder="Select Seller..."
                />
              </Form.Item>
              <Form.Item label={<span className="fw-bold text-zinc-600" style={{ fontSize: '11px' }}>CSV FILE</span>}>
                <Input
                  type="file"
                  accept=".csv"
                  onChange={handleCsvUpload}
                  style={{ borderRadius: '8px' }}
                />
              </Form.Item>
            </Form>
          </div>
        </Modal>
      </div>

      {/* [N] Secondary Modals - Lazy Loaded */}
      <Suspense fallback={null}>
        <AsinDetailModal
          asin={selectedAsin}
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
        />
        <AsinTrendsModal
          asin={selectedAsin}
          isOpen={showTrendsModal}
          onClose={() => setShowTrendsModal(false)}
        />
        <PriceViewModal
          isOpen={!!selectedAsinForPrice || showAllPriceHistory}
          onClose={() => { setSelectedAsinForPrice(null); setShowAllPriceHistory(false); }}
          filters={appliedFilters}
          searchQuery={appliedSearchQuery}
          sellerId={selectedSeller}
        />
        <BSRViewModal
          isOpen={!!selectedAsinForBsr || showAllBsrHistory}
          onClose={() => { setSelectedAsinForBsr(null); setShowAllBsrHistory(false); }}
          filters={appliedFilters}
          searchQuery={appliedSearchQuery}
          sellerId={selectedSeller}
        />
        <RatingViewModal
          isOpen={!!selectedAsinForRating || showAllRatingHistory}
          onClose={() => { setSelectedAsinForRating(null); setShowAllRatingHistory(false); }}
          filters={appliedFilters}
          searchQuery={appliedSearchQuery}
          sellerId={selectedSeller}
        />
        <ExportAsinModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          currentFilters={appliedFilters}
          searchQuery={appliedSearchQuery}
          selectedSeller={selectedSeller}
          selectedIds={Array.from(selectedIds)}
        />
        <BulkImportModal
          isOpen={showBulkImportModal}
          onClose={() => setShowBulkImportModal(false)}
          onComplete={loadData}
        />
      </Suspense>
      {/* Bulk Tags Modal */}
      {showBulkTagsModal && (
        <BulkTagsModal
          isOpen={showBulkTagsModal}
          onClose={() => setShowBulkTagsModal(false)}
          selectedAsins={asins.filter(a => selectedIds.has(a._id || a.Id))}
          onComplete={() => {
            setShowBulkTagsModal(false);
            clearSelection();
            loadData(pagination.page, pagination.limit);
          }}
        />
      )}

      {/* AI Listing Analysis Modal */}
      {showAiAnalysisModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => !aiAnalysisLoading && setShowAiAnalysisModal(false)}>
          <div style={{ background: '#fff', borderRadius: 16, width: '90%', maxWidth: 800, maxHeight: '85vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #6d28d9, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={16} color="#fff" />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>AI Listing Quality Analysis</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Amazon policy compliance & optimization recommendations</div>
                </div>
              </div>
              <button onClick={() => setShowAiAnalysisModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#64748b', fontSize: 18 }}>×</button>
            </div>
            <div style={{ padding: 24, overflowY: 'auto', maxHeight: 'calc(85vh - 120px)' }}>
              {aiAnalysisLoading && (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid #e2e8f0', borderTopColor: '#6d28d9', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
                  <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>AI is analyzing your listings against Amazon policies...</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>This may take 15-30 seconds per ASIN</div>
                </div>
              )}
              {!aiAnalysisLoading && aiAnalysisResult && aiAnalysisResult.map((result, idx) => (
                <div key={idx} style={{ marginBottom: 20, border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                  {result.error ? (
                    <div style={{ padding: 20, background: '#fef2f2', color: '#dc2626', fontSize: 12 }}>Error: {result.error}</div>
                  ) : (
                    <>
                      <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Score: {result.overallScore}/100</span>
                          <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8 }}>{result.summary}</span>
                        </div>
                        <button onClick={() => handleAiCreateTasks(result.asinId)}
                          disabled={syncing}
                          style={{ fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 6, background: '#0f172a', color: '#fff', border: 'none', cursor: 'pointer' }}>
                          {syncing ? 'Creating...' : 'Create Tasks'}
                        </button>
                      </div>
                      {result.issues?.length > 0 && (
                        <div style={{ padding: 12 }}>
                          {result.issues.map((issue, i) => (
                            <div key={i} style={{ padding: '8px 12px', background: issue.severity === 'critical' ? '#fef2f2' : issue.severity === 'high' ? '#fffbeb' : '#f8fafc', borderLeft: `3px solid ${issue.severity === 'critical' ? '#ef4444' : issue.severity === 'high' ? '#f59e0b' : '#6366f1'}`, borderRadius: 6, marginBottom: 8, fontSize: 12 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span style={{ fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', fontSize: 10 }}>{issue.field} · {issue.severity}</span>
                                <span style={{ fontSize: 10, fontWeight: 600, color: issue.priority === 'HIGH' ? '#dc2626' : '#64748b' }}>{issue.priority}</span>
                              </div>
                              <div style={{ color: '#334155', marginBottom: 2 }}>{issue.issue}</div>
                              <div style={{ color: '#059669', fontSize: 11 }}>→ {issue.recommendation}</div>
                              {issue.amazonPolicy && <div style={{ color: '#94a3b8', fontSize: 10, marginTop: 2 }}>Policy: {issue.amazonPolicy}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AsinManagerPage;
