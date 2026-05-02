import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy, useRef } from 'react';
const TablePagination = lazy(() => import('@mui/material/TablePagination'));
import KPICard from '../components/KPICard';
import ProgressBar from '../components/common/ProgressBar';
import EmptyState from '../components/common/EmptyState';
import octoparseService from '../services/octoparseService';
import { db } from '../services/db';
import { asinApi, marketSyncApi, sellerApi, taskApi } from '../services/api';
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
  Clock,
  ExternalLink,
  Video,
  PlayCircle,
  Award,
  Filter,
  Tag,
  SlidersHorizontal
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useRefresh } from '../contexts/RefreshContext';
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
const getWeekHistoryBadge = (value, type, uploadedPrice = 0) => {
  if (!value) return <span style={{ color: '#9ca3af' }}>-</span>;

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
    return <span style={{ fontWeight: 600, color: '#7c3aed', fontSize: '10px' }}>#{value.toLocaleString()}</span>;
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
  const { isAdmin, isGlobalUser, hasPermission } = useAuth();
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

  const [repairStatus, setRepairStatus] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [activeEditAsin, setActiveEditAsin] = useState(null);
  const [importingTags, setImportingTags] = useState(false);
  const tagsImportRef = useRef(null);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const {
    visibleColumns,
    isVisible,
    toggleColumn,
    toggleCategory,
    resetToDefaults,
    selectAll,
    visibleCount,
    totalCount
  } = useColumnVisibility();

  const [showColumnPanel, setShowColumnPanel] = useState(false);
  const [showBulkTagsModal, setShowBulkTagsModal] = useState(false);
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  const actionsRef = useRef(null);

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

        // Lexical sort on YYYY-MM-DD gives chronological order (Oldest -> Newest)
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

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (actionsRef.current && !actionsRef.current.contains(event.target)) {
        setShowActionsDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const visibleLQSCount = useMemo(() => ['titleScore', 'bulletScore', 'imageScore', 'descriptionScore', 'lqs'].filter(isVisible).length, [isVisible]);
  const visiblePriceTrendCount = useMemo(() => isVisible('priceTrend') ? visibleHistoryCols : 0, [isVisible, visibleHistoryCols]);
  const visibleBsrTrendCount = useMemo(() => isVisible('bsrTrend') ? visibleHistoryCols : 0, [isVisible, visibleHistoryCols]);
  const visibleRatingTrendCount = useMemo(() => isVisible('ratingTrend') ? visibleHistoryCols : 0, [isVisible, visibleHistoryCols]);
  const visibleReviewTrendCount = useMemo(() => isVisible('reviewTrend') ? visibleHistoryCols : 0, [isVisible, visibleHistoryCols]);
  const visibleImageTrendCount = useMemo(() => isVisible('imageTrend') ? visibleHistoryCols : 0, [isVisible, visibleHistoryCols]);

  const [tagSearch, setTagSearch] = useState('');
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [filters, setFilters] = useState({
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
    minLQS: '',
    maxLQS: '',
    minRating: '',
    maxRating: '',
    minReviewCount: '',
    maxReviewCount: '',
    minImagesCount: '',
    maxImagesCount: '',
    minBulletPoints: '',
    maxBulletPoints: '',
    minTitleScore: '',
    maxTitleScore: '',
    minBulletScore: '',
    maxBulletScore: '',
    minImageScore: '',
    maxImageScore: '',
    minDescriptionScore: '',
    maxDescriptionScore: '',
    subBsrCategory: '',
    buyBoxWin: '',
    hasAplus: '',
    hasVideo: '',
    hasDeal: '',
    ageFilter: '',
    selectedTags: [],
    minReleaseDate: '',
    maxReleaseDate: '',
    priceDispute: ''
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
    minLQS: '',
    maxLQS: '',
    minRating: '',
    maxRating: '',
    minReviewCount: '',
    maxReviewCount: '',
    minImagesCount: '',
    maxImagesCount: '',
    minBulletPoints: '',
    maxBulletPoints: '',
    minTitleScore: '',
    maxTitleScore: '',
    minBulletScore: '',
    maxBulletScore: '',
    minImageScore: '',
    maxImageScore: '',
    minDescriptionScore: '',
    maxDescriptionScore: '',
    subBsrCategory: '',
    buyBoxWin: '',
    hasAplus: '',
    hasVideo: '',
    hasDeal: '',
    ageFilter: '',
    selectedTags: [],
    minReleaseDate: '',
    maxReleaseDate: '',
    priceDispute: ''
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
      status: '', category: '', brand: '', scrapeStatus: '',
      parentAsin: '', sku: '', subBsrCategory: '',
      minPrice: '', maxPrice: '', minBSR: '', maxBSR: '',
      minLQS: '', maxLQS: '', minRating: '', maxRating: '',
      selectedTags: [],
      buyBoxWin: '', hasAplus: '', hasVideo: '', hasDeal: '',
      ageFilter: '', minReleaseDate: '', maxReleaseDate: '',
      minTitleScore: '', maxTitleScore: '', minBulletScore: '', maxBulletScore: '',
      minImageScore: '', maxImageScore: '', minDescriptionScore: '', maxDescriptionScore: '',
      minReviewCount: '', maxReviewCount: '', minImagesCount: '', maxImagesCount: '',
      minBulletPoints: '', maxBulletPoints: '', priceDispute: ''
    };
    setFilters(resetState);
    setAppliedFilters(resetState);
    setSearchQuery('');
    setAppliedSearchQuery('');
    setFilterPanelOpen(false);
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
      priceDispute: 'Price Dispute'
    };

    Object.entries(appliedFilters).forEach(([key, value]) => {
      if (value && mapping[key]) {
        let label = value;
        if (value === 'true') label = 'Yes';
        if (value === 'false') label = 'No';

        badges.push(
          <div key={key} className="badge bg-zinc-100 text-zinc-700 border border-zinc-200 d-flex align-items-center gap-1.5 py-1.5 px-2 rounded-2" style={{ fontSize: '10px' }}>
            <span className="fw-bold opacity-60 text-uppercase" style={{ fontSize: '8.5px' }}>{mapping[key]}:</span>
            <span className="fw-bold">{label}</span>
            <button
              className="btn btn-link p-0 text-zinc-400 hover-text-red-500 transition-colors"
              onClick={() => removeAppliedFilter(key)}
            >
              <X size={12} />
            </button>
          </div>
        );
      }
    });

    if (appliedFilters.selectedTags?.length > 0) {
      appliedFilters.selectedTags.forEach(tag => {
        badges.push(
          <div key={`tag-${tag}`} className="badge bg-indigo-50 text-indigo-700 border border-indigo-100 d-flex align-items-center gap-1.5 py-1.5 px-2 rounded-2" style={{ fontSize: '10px' }}>
            <Tag size={10} className="opacity-60" />
            <span className="fw-bold">{tag}</span>
            <button
              className="btn btn-link p-0 text-indigo-400 hover-text-red-500 transition-colors"
              onClick={() => removeAppliedFilter('selectedTags', tag)}
            >
              <X size={12} />
            </button>
          </div>
        );
      });
    }

    if (selectedSeller) {
      const seller = sellers.find(s => s._id === selectedSeller);
      badges.unshift(
        <div key="seller" className="badge bg-zinc-900 text-white border border-zinc-900 d-flex align-items-center gap-1.5 py-1.5 px-2 rounded-2" style={{ fontSize: '10px' }}>
          <Store size={10} className="opacity-60" />
          <span className="fw-bold">{seller?.name || 'Selected Seller'}</span>
          <button
            className="btn btn-link p-0 text-zinc-400 hover-text-white transition-colors"
            onClick={() => setSelectedSeller('')}
          >
            <X size={12} />
          </button>
        </div>
      );
    }

    if (appliedSearchQuery) {
      badges.unshift(
        <div key="search" className="badge bg-amber-50 text-amber-700 border border-amber-200 d-flex align-items-center gap-1.5 py-1.5 px-2 rounded-2" style={{ fontSize: '10px' }}>
          <Search size={10} className="opacity-60" />
          <span className="fw-bold italic">"{appliedSearchQuery}"</span>
          <button
            className="btn btn-link p-0 text-amber-400 hover-text-red-500 transition-colors"
            onClick={() => { setAppliedSearchQuery(''); setSearchQuery(''); }}
          >
            <X size={12} />
          </button>
        </div>
      );
    }

    return badges;
  }, [appliedFilters, appliedSearchQuery, removeAppliedFilter, selectedSeller, sellers]);

  const handleApplyFilters = () => {
    setSelectedIds(new Set()); // Reset selection on new filter
    setAppliedFilters(filters);
    setFilterPanelOpen(false); // Close drawer automatically on apply
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

  const loadData = useCallback(async (page = 1, limit = pagination.limit, seller = selectedSeller) => {
    try {
      setLoading(true);

      // Only fetch paginated data and stats - NOT all data (optimization)
      const asinRes = await asinApi.getAll({
        page,
        limit,
        seller,
        search: appliedSearchQuery,
        ...appliedFilters,
        sortBy: 'lastScraped',
        sortOrder: 'desc'
      });

      const statsRes = await asinApi.getStats({ seller });

      // 🔍 DEBUG: Log the first ASIN to check allOffers
      if (asinRes?.asins?.length > 0) {
        const sample = asinRes.asins[0];
        console.log('🔍 DEBUG First ASIN:', {
          asinCode: sample.asinCode,
          soldBy: sample.soldBy,
          soldBySec: sample.soldBySec,
          secondAsp: sample.secondAsp,
          allOffers: sample.allOffers,
          allOffersType: typeof sample.allOffers,
          isArray: Array.isArray(sample.allOffers)
        });
      }

      setAsins(asinRes?.asins || []);
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
  }, [pagination.limit, selectedSeller, appliedSearchQuery, appliedFilters]);

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

    return () => {
      socket.off('scrape_progress');
      socket.off('scrape_data_ingested');
      socket.off('scrape_batch_complete');
      socket.off('repair_job_progress');
      socket.off('repair_job_finished');
      if (pendingRefreshRef.current) clearTimeout(pendingRefreshRef.current);
    };
  }, [socket, loadData, pagination.page]);

  const fetchSellerDropdownData = useCallback(async (page = 1, search = '') => {
    try {
      const response = await sellerApi.getAll({ page, limit: 1000, search });
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
  }, []);

  const kpis = useMemo(() => {
    if (stats) {
      const reviewChange = stats.reviewAnalysis?.currentVsPreviousChange || 0;
      const reviewTrend = reviewChange >= 0 ? '↑' : '↓';
      const reviewColor = reviewChange >= 0 ? '#10b981' : '#ef4444';
      const bestSeller = stats.bestSellingAsins?.[0];

      return [
        {
          label: 'ALL ASINS', value: (stats.total || 0).toLocaleString(), color: '#6366f1', icon: <Package size={14} />,
          sub: `${stats.uniqueParents || 0} parent groups`
        },
        {
          label: 'ACTIVE ASINS', value: (stats.active || 0).toLocaleString(), color: '#10b981', icon: <Activity size={14} />,
          sub: `${stats.standaloneAsins || 0} standalone`
        },
        {
          label: 'TOTAL REVIEWS',
          value: (stats.totalReviews || 0).toLocaleString(),
          color: '#8b5cf6',
          icon: <Star size={14} />,
          sub: `Avg ${stats.avgReviewsPerParent || 0}/parent`,
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
          value: bestSeller ? `#${bestSeller.bsr?.toLocaleString()}` : '-',
          sub: bestSeller?.asinCode || '',
          color: '#06b6d4',
          icon: <Award size={14} />,
          onClick: () => { setShowAllBsrHistory(true); }
        },
        {
          label: 'AVG PRICE',
          value: '₹' + (stats.avgPrice || 0).toLocaleString(),
          color: '#ec4899',
          icon: <IndianRupee size={14} />,
          onClick: () => { setShowAllPriceHistory(true); }
        },
        {
          label: 'AVG LQS',
          value: (stats.avgLQS || 0) + '%',
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

  if (loading && asins.length === 0) {
    return <PageLoader message="Loading ASIN Manager..." />;
  }




  const thStyle = {
    fontSize: '0.66rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#71717a', // zinc-500
    padding: '4px 8px',
    background: '#fafafa',
    position: 'sticky',
    top: 0,
    zIndex: 10,
    whiteSpace: 'nowrap',
    border: '0.5px solid #f1f1f1'
  };

  const tdStyle = {
    padding: '4px 8px',
    fontSize: '0.68rem',
    borderBottom: '0.5px solid #f1f5f9',
    verticalAlign: 'middle',
    color: '#27272a', // zinc-800
    height: '28px',
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', backgroundColor: '#f9fafb' }}>
      {loading && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}>
          <LoadingIndicator type="line-simple" size="md" />
        </div>
      )}

      {/* [Filter Sidebar/Drawer Overlay] — PREMIUM FULL-HEIGHT DRAWER */}
      {filterPanelOpen && (
        <>
          {/* Backdrop */}
          <div
            className="position-fixed top-0 start-0 w-100 h-100"
            style={{
              zIndex: 2000,
              backgroundColor: 'rgba(0, 0, 0, 0.45)',
              backdropFilter: 'blur(4px)',
              animation: 'fadeIn 0.25s ease-out'
            }}
            onClick={() => setFilterPanelOpen(false)}
          />

          <div
            className="position-fixed top-0 end-0 h-100 bg-white shadow-2xl d-flex flex-column"
            style={{
              width: '420px',
              zIndex: 2010,
              animation: 'slideInRight 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
              boxShadow: '-10px 0 50px rgba(0,0,0,0.25)'
            }}
          >
            {/* Header */}
            <div className="p-4 border-bottom d-flex align-items-center justify-content-between bg-zinc-900 text-white">
              <div className="d-flex align-items-center gap-3">
                <div className="p-2 bg-zinc-800 rounded-3">
                  <SlidersHorizontal size={20} className="text-white" />
                </div>
                <div>
                  <h5 className="mb-0 fw-bold" style={{ fontSize: '15px', letterSpacing: '0.02em' }}>ADVANCED FILTERS</h5>
                  <p className="mb-0 text-zinc-400" style={{ fontSize: '11px' }}>Refine your catalog search</p>
                </div>
              </div>
              <button
                className="btn btn-ghost p-2 rounded-circle hover-bg-zinc-800 text-white opacity-70 hover-opacity-100"
                onClick={() => setFilterPanelOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content - Scrollable */}
            <div className="flex-grow-1 overflow-auto p-4 custom-scrollbar">

              {/* SEARCH & BASIC */}
              <div className="mb-5">
                <h6 className="filter-section-title">Identity & Search</h6>
                <div className="d-flex flex-column gap-3">
                  <div className="filter-group">
                    <label className="filter-label">SKU</label>
                    <input type="text" className="form-control form-control-sm rounded-2 border-zinc-200" value={filters.sku} onChange={(e) => setFilters({ ...filters, sku: e.target.value })} placeholder="Enter SKU..." style={{ fontSize: '12px', height: '38px' }} />
                  </div>
                  <div className="filter-group">
                    <label className="filter-label">PARENT ASIN</label>
                    <input type="text" className="form-control form-control-sm rounded-2 border-zinc-200" value={filters.parentAsin} onChange={(e) => setFilters({ ...filters, parentAsin: e.target.value })} placeholder="Enter Parent ASIN..." style={{ fontSize: '12px', height: '38px' }} />
                  </div>
                </div>
              </div>

              {/* ATTRIBUTES */}
              <div className="mb-5">
                <h6 className="filter-section-title">Product Attributes</h6>
                <div className="d-flex flex-column gap-3">
                  <div className="filter-group">
                    <label className="filter-label">SCRAPE STATUS</label>
                    <select className="form-select form-select-sm rounded-2 border-zinc-200" value={filters.scrapeStatus} onChange={(e) => setFilters({ ...filters, scrapeStatus: e.target.value })} style={{ fontSize: '12px', height: '38px' }}>
                      <option value="">All Statuses</option>
                      <option value="Success">Success</option>
                      <option value="Failed">Failed</option>
                      <option value="Pending">Pending</option>
                    </select>
                  </div>
                  <div className="filter-group">
                    <label className="filter-label">BRAND</label>
                    <select className="form-select form-select-sm rounded-2 border-zinc-200" value={filters.brand} onChange={(e) => setFilters({ ...filters, brand: e.target.value })} style={{ fontSize: '12px', height: '38px' }}>
                      <option value="">All Brands</option>
                      {filterOptions.brands.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div className="filter-group">
                    <label className="filter-label">CATEGORY</label>
                    <select className="form-select form-select-sm rounded-2 border-zinc-200" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })} style={{ fontSize: '12px', height: '38px' }}>
                      <option value="">All Categories</option>
                      {filterOptions.categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="filter-group">
                    <label className="filter-label">SUB BSR CATEGORY</label>
                    <select className="form-select form-select-sm rounded-2 border-zinc-200" value={filters.subBsrCategory || ''} onChange={(e) => setFilters({ ...filters, subBsrCategory: e.target.value })} style={{ fontSize: '12px', height: '38px' }}>
                      <option value="">All Sub BSR Categories</option>
                      {filterOptions.subBsrCategories?.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* QUICK FLAGS */}
              <div className="mb-5">
                <h6 className="filter-section-title">Quick Flags</h6>
                <div className="row g-2">
                  <div className="col-6">
                    <div className="filter-group">
                      <label className="filter-label">BUYBOX WINNER</label>
                      <select className="form-select form-select-sm rounded-2 border-zinc-200" value={filters.buyBoxWin} onChange={(e) => setFilters({ ...filters, buyBoxWin: e.target.value })} style={{ fontSize: '12px', height: '38px' }}>
                        <option value="">All</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="filter-group">
                      <label className="filter-label">A+ CONTENT</label>
                      <select className="form-select form-select-sm rounded-2 border-zinc-200" value={filters.hasAplus} onChange={(e) => setFilters({ ...filters, hasAplus: e.target.value })} style={{ fontSize: '12px', height: '38px' }}>
                        <option value="">All</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="filter-group">
                      <label className="filter-label">VIDEO PRESENCE</label>
                      <select className="form-select form-select-sm rounded-2 border-zinc-200" value={filters.hasVideo} onChange={(e) => setFilters({ ...filters, hasVideo: e.target.value })} style={{ fontSize: '12px', height: '38px' }}>
                        <option value="">All</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="filter-group">
                      <label className="filter-label">ACTIVE DEAL</label>
                      <select className="form-select form-select-sm rounded-2 border-zinc-200" value={filters.hasDeal} onChange={(e) => setFilters({ ...filters, hasDeal: e.target.value })} style={{ fontSize: '12px', height: '38px' }}>
                        <option value="">All</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    </div>
                  </div>
                  <div className="col-12">
                    <div className="filter-group">
                      <label className="filter-label">PRICE DISPUTE</label>
                      <select className="form-select form-select-sm rounded-2 border-zinc-200" value={filters.priceDispute} onChange={(e) => setFilters({ ...filters, priceDispute: e.target.value })} style={{ fontSize: '12px', height: '38px' }}>
                        <option value="">All ASINs</option>
                        <option value="true">Disputed Only</option>
                        <option value="false">Non-Disputed</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* RANGES */}
              <div className="mb-5">
                <h6 className="filter-section-title">Metrics & Ranges</h6>
                <div className="d-flex flex-column gap-3">
                  <div className="filter-group">
                    <label className="filter-label">PRICE RANGE (₹)</label>
                    <div className="d-flex gap-2">
                      <input type="number" placeholder="Min" className="form-control form-control-sm rounded-2 border-zinc-200" value={filters.minPrice} onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })} style={{ fontSize: '12px', height: '38px' }} />
                      <input type="number" placeholder="Max" className="form-control form-control-sm rounded-2 border-zinc-200" value={filters.maxPrice} onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })} style={{ fontSize: '12px', height: '38px' }} />
                    </div>
                  </div>
                  <div className="filter-group">
                    <label className="filter-label">BSR RANGE</label>
                    <div className="d-flex gap-2">
                      <input type="number" placeholder="Min" className="form-control form-control-sm rounded-2 border-zinc-200" value={filters.minBSR} onChange={(e) => setFilters({ ...filters, minBSR: e.target.value })} style={{ fontSize: '12px', height: '38px' }} />
                      <input type="number" placeholder="Max" className="form-control form-control-sm rounded-2 border-zinc-200" value={filters.maxBSR} onChange={(e) => setFilters({ ...filters, maxBSR: e.target.value })} style={{ fontSize: '12px', height: '38px' }} />
                    </div>
                  </div>
                  <div className="filter-group">
                    <label className="filter-label">RATING RANGE</label>
                    <div className="d-flex gap-2">
                      <input type="number" placeholder="Min" step="0.1" className="form-control form-control-sm rounded-2 border-zinc-200" value={filters.minRating || ''} onChange={(e) => setFilters({ ...filters, minRating: e.target.value })} style={{ fontSize: '12px', height: '38px' }} />
                      <input type="number" placeholder="Max" step="0.1" className="form-control form-control-sm rounded-2 border-zinc-200" value={filters.maxRating || ''} onChange={(e) => setFilters({ ...filters, maxRating: e.target.value })} style={{ fontSize: '12px', height: '38px' }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* TAGS */}
              <div className="mb-5">
                <h6 className="filter-section-title">Tags</h6>
                <div className="filter-group">
                  <div className="position-relative">
                    <Search size={14} className="position-absolute top-50 start-0 translate-middle-y ms-2.5 text-zinc-400" />
                    <input
                      type="text"
                      className="form-control form-control-sm rounded-2 ps-5 border-zinc-200"
                      placeholder="Search tags..."
                      value={tagSearch}
                      onChange={(e) => setTagSearch(e.target.value)}
                      style={{ fontSize: '12px', height: '38px' }}
                    />
                  </div>
                  <div className="d-flex flex-wrap gap-2 mt-3">
                    {filterOptions.tags
                      .filter(t => t.toLowerCase().includes(tagSearch.toLowerCase()))
                      .map(tag => (
                        <button
                          key={tag}
                          className={`btn btn-xs rounded-pill px-3 py-1.5 transition-all d-flex align-items-center gap-1 ${filters.selectedTags.includes(tag) ? 'bg-zinc-900 text-white shadow-md' : 'bg-zinc-100 text-zinc-600 border border-zinc-200 hover-bg-zinc-200'}`}
                          onClick={() => {
                            const newTags = filters.selectedTags.includes(tag)
                              ? filters.selectedTags.filter(t => t !== tag)
                              : [...filters.selectedTags, tag];
                            setFilters({ ...filters, selectedTags: newTags });
                          }}
                          style={{ fontSize: '11px', fontWeight: 600 }}
                        >
                          {tag}
                          {filters.selectedTags.includes(tag) && <X size={10} />}
                        </button>
                      ))}
                  </div>
                </div>
              </div>

              {/* AGE FILTER */}
              <div className="mb-5">
                <h6 className="filter-section-title">Listing Age</h6>
                <div className="filter-group">
                  <div className="d-flex flex-wrap gap-2">
                    {[
                      { label: 'New (<30D)', value: '30' },
                      { label: '30-60D', value: '60' },
                      { label: '60-90D', value: '90' },
                      { label: '90-180D', value: '180' },
                      { label: '180-365D', value: '365' },
                      { label: '365+ Days', value: '365+' }
                    ].map(opt => (
                      <button
                        key={opt.value}
                        className={`btn btn-sm rounded-pill px-3 py-1 transition-all ${filters.ageFilter === opt.value ? 'bg-zinc-900 text-white shadow-sm' : 'bg-zinc-100 text-zinc-600 border border-zinc-200 hover-bg-zinc-200'}`}
                        onClick={() => setFilters({ ...filters, ageFilter: filters.ageFilter === opt.value ? '' : opt.value })}
                        style={{ fontSize: '10px', fontWeight: 600 }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="filter-group mt-4">
                  <label className="filter-label">RELEASE DATE RANGE</label>
                  <div className="d-flex gap-2">
                    <input
                      type="date"
                      className="form-control form-control-sm rounded-2 border-zinc-200"
                      value={filters.minReleaseDate}
                      onChange={(e) => setFilters({ ...filters, minReleaseDate: e.target.value })}
                      style={{ fontSize: '12px', height: '38px' }}
                    />
                    <input
                      type="date"
                      className="form-control form-control-sm rounded-2 border-zinc-200"
                      value={filters.maxReleaseDate}
                      onChange={(e) => setFilters({ ...filters, maxReleaseDate: e.target.value })}
                      style={{ fontSize: '12px', height: '38px' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-top bg-zinc-50 d-flex gap-3">
              <button
                className="btn btn-white flex-grow-1 border-zinc-200 fw-bold rounded-3 py-2.5 shadow-sm hover-bg-zinc-100"
                onClick={resetAllFilters}
                style={{ fontSize: '13px' }}
              >
                Reset All
              </button>
              <button
                className="btn btn-zinc-900 flex-grow-1 fw-bold rounded-3 py-2.5 shadow-md hover-bg-zinc-800"
                onClick={handleApplyFilters}
                style={{ fontSize: '13px', backgroundColor: '#18181B', color: '#fff' }}
              >
                Apply Filters
              </button>
            </div>
          </div>
        </>
      )}

      <div className="page-header" style={{ padding: '0.6rem 1.25rem', background: '#fff', borderBottom: '1px solid #e5e7eb' }}>
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
          <div className="d-flex align-items-center gap-3">
            <h1 className="h6 mb-0 fw-bold text-zinc-900 d-flex align-items-center gap-2">
              <Package size={18} className="text-zinc-900" />
              ASIN Manager
            </h1>
            <div className="vr mx-1 d-none d-sm-block" style={{ height: '16px', color: '#e5e7eb' }} />
            <span className="smallest text-zinc-500 fw-medium d-none d-md-inline">Operational Metrics</span>
          </div>

          <div className="d-flex align-items-center gap-2">
            <div className="position-relative" ref={actionsRef}>
              <button
                className={`btn btn-xs d-flex align-items-center gap-2 px-3 py-1.5 rounded-2 shadow-sm transition-all ${selectedIds.size > 0 ? 'btn-amber-50 text-amber-900 border-amber-200' : 'btn-zinc-100 text-zinc-500 border-zinc-200'}`}
                onClick={() => setShowActionsDropdown(!showActionsDropdown)}
                disabled={selectedIds.size === 0}
                style={{ fontSize: '11px', fontWeight: 700 }}
              >
                <SlidersHorizontal size={12} />
                <span>Actions ({selectedIds.size})</span>
                <ChevronDown size={12} className={`transition-transform ${showActionsDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showActionsDropdown && (
                <div className="position-absolute end-0 mt-2 bg-white shadow-xl rounded-3 border py-2" style={{ zIndex: 1000, minWidth: '200px' }}>
                  <div className="px-3 py-2 border-bottom mb-1">
                    <span className="text-zinc-400 fw-bold text-uppercase tracking-wider" style={{ fontSize: '9px' }}>Dispute Management</span>
                  </div>
                  <button
                    className="dropdown-item px-3 py-2 d-flex align-items-center gap-2 text-zinc-700 hover-bg-zinc-50"
                    onClick={() => handleBulkPriceDispute(true)}
                    style={{ fontSize: '12px', fontWeight: 500 }}
                  >
                    <AlertTriangle size={14} className="text-amber-500" />
                    Mark as Price Dispute
                  </button>
                  <button
                    className="dropdown-item px-3 py-2 d-flex align-items-center gap-2 text-zinc-700 hover-bg-zinc-50"
                    onClick={() => handleBulkPriceDispute(false)}
                    style={{ fontSize: '12px', fontWeight: 500 }}
                  >
                    <RefreshCw size={14} className="text-emerald-500" />
                    Resolve Dispute
                  </button>
                </div>
              )}
            </div>

            <button
              className="btn btn-zinc-900 btn-xs border-0 d-flex align-items-center gap-2 px-3 py-1.5 rounded-2 shadow-sm"
              onClick={() => setShowAddModal(true)}
              style={{ backgroundColor: '#18181B', color: '#fff', fontSize: '11px' }}
            >
              <Plus size={12} />
              <span className="fw-bold">Add ASIN</span>
            </button>
          </div>
        </div>

        {/* Compressed KPI Strip - Responsive Grid */}
        <div className="mt-2" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          background: '#f8fafc',
          borderRadius: '8px',
          border: '1px solid #f1f5f9',
          overflow: 'hidden'
        }}>
          {kpis.map((kpi, idx) => (
            <div key={idx}
              onClick={kpi.onClick}
              className="p-2 transition-all d-flex align-items-center gap-3"
              style={{
                borderRight: '1px solid #f1f5f9',
                borderBottom: '1px solid #f1f5f9',
                cursor: kpi.onClick ? 'pointer' : 'default',
                background: kpi.onClick ? '#fff' : 'transparent',
                minWidth: '130px'
              }}
            >
              <div className="d-flex align-items-center justify-content-center rounded-2" style={{
                width: '18px', height: '18px', flexShrink: 0,
                background: kpi.color + '10', color: kpi.color
              }}>
                {React.cloneElement(kpi.icon, { size: 10 })}
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="smallest text-zinc-400 fw-bold text-uppercase tracking-wider lh-1 mb-1" style={{ fontSize: '8px' }}>
                  {kpi.label}
                </div>
                <div className="d-flex align-items-baseline gap-2">
                  <span className="fw-bold text-zinc-900" style={{ fontSize: '11px' }}>
                    {kpi.value}
                  </span>
                  {kpi.sub && !kpi.sub.includes('vs') && <span className="smallest text-zinc-400 font-monospace" style={{ fontSize: '8px' }}>{kpi.sub}</span>}
                </div>
              </div>
            </div>
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

      <div className="page-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '0.75rem 1.25rem' }}>
        {/* Alerts & Errors row */}
        {error && (
          <div className="alert alert-warning border-0 shadow-sm rounded-2 py-1 px-2 mb-2 d-flex align-items-center gap-2 smallest" role="alert">
            <AlertTriangle size={12} className="text-warning" />
            <span className="fw-medium">{error}</span>
          </div>
        )}



        {/* [E] High-Density Table Area */}
        <div className="bg-white border border-zinc-200 rounded-4 shadow-sm overflow-hidden flex-grow-1 d-flex flex-column position-relative">
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
                  .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                  }
                  .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                  }
                  .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e4e4e7;
                    border-radius: 10px;
                  }
                  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #d4d4d8;
                  }
                  .hover-translate-y-px:hover {
                    transform: translateY(-1px);
                  }
                  .shadow-2xl {
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                  }
          `}</style>

          {/* Table Toolbar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 16px', background: '#fff', borderBottom: '1px solid #e5e7eb',
            flexShrink: 0, gap: '12px 16px', flexWrap: 'wrap'
          }}>
            <div className="d-flex align-items-center gap-3 flex-wrap flex-grow-1">
              <div className="d-flex align-items-center gap-2">
                <span style={{ fontSize: 9, fontWeight: 800, color: '#18181b', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                  INVENTORY MASTER
                  <span style={{ marginLeft: 6, padding: '1px 5px', borderRadius: 2, background: '#f4f4f5', color: '#71717a', fontSize: 8 }}>
                    {pagination.total} ASINs
                  </span>
                </span>
              </div>

              <div className="d-flex align-items-center gap-2 flex-wrap">
                <div className="position-relative d-flex" style={{ width: '200px' }}>
                  <Search className="position-absolute top-50 start-0 translate-middle-y ms-2 text-zinc-400" size={12} />
                  <input
                    type="text"
                    className="form-control form-control-xs ps-4.5 bg-zinc-50 border-zinc-200 shadow-none rounded-start-2 rounded-end-0 smallest"
                    placeholder="Search ASIN, SKU..."
                    style={{ height: '26px', fontSize: '11px' }}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleApplySearch(); }}
                  />
                  <button
                    className="btn btn-zinc-900 pb-0 pt-0 px-2.5 rounded-start-0 rounded-end-2 smallest fw-bold text-white"
                    style={{ height: '26px', fontSize: '10px', backgroundColor: '#18181B' }}
                    onClick={handleApplySearch}
                  >
                    Find
                  </button>
                </div>
                <div style={{ width: '140px' }}>
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

                {/* Scrape Progress */}
                {scrapeProgress && (
                  <div className="bg-blue-50 border border-blue-100 rounded-2 px-2 py-0 d-flex align-items-center gap-2" style={{ height: '26px' }}>
                    <RefreshCw size={10} className="text-blue-600 spin" />
                    <span className="fw-bold text-blue-700 font-monospace" style={{ fontSize: '9px' }}>{scrapeProgress.processed}/{scrapeProgress.total}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="d-flex align-items-center gap-1.5 flex-wrap justify-content-end">
              <div className="d-flex align-items-center gap-1.5 flex-wrap">
                <button
                  className="btn btn-white btn-xs border border-zinc-200 d-flex align-items-center gap-1.5 rounded-2 px-2 py-1"
                  onClick={handleBulkScrape}
                  disabled={syncing}
                  style={{ fontSize: '10px', height: '26px' }}
                >
                  <RefreshCw size={11} className={`text-zinc-500 ${syncing ? 'spin' : ''}`} />
                  <span className="fw-bold text-zinc-700">SYNC</span>
                </button>

                {/* FILTERS Button */}
                <button
                  onClick={() => setFilterPanelOpen(!filterPanelOpen)}
                  className={`btn btn-xs d-flex align-items-center gap-1 fw-bold rounded-2 px-2 py-1 border transition-all ${filterPanelOpen ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-700 border-zinc-200 hover-bg-zinc-50'
                    }`}
                  style={{ fontSize: '10px', height: '24px' }}
                >
                  <ListChecks size={12} />
                  {(() => {
                    const count = Object.values(appliedFilters).filter(v =>
                      v !== '' && (!Array.isArray(v) || v.length > 0)
                    ).length;
                    return <>FILTERS {count > 0 && `(${count})`}</>;
                  })()}
                </button>

                {/* ✅ COLUMNS Button - NEW */}
                <div className="position-relative">
                  <button
                    onClick={() => setShowColumnPanel(!showColumnPanel)}
                    className={`btn btn-xs d-flex align-items-center gap-1 fw-bold rounded-2 px-2 py-1 border transition-all ${showColumnPanel ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-700 border-zinc-200 hover-bg-zinc-50'
                      }`}
                    style={{ fontSize: '10px', height: '24px' }}
                  >
                    <LayoutGrid size={12} />
                    COLUMNS
                  </button>

                  {/* Column Visibility Panel */}
                  <ColumnVisibilityPanel
                    isOpen={showColumnPanel}
                    onClose={() => setShowColumnPanel(false)}
                    visibleColumns={visibleColumns}
                    onToggle={toggleColumn}
                    onToggleCategory={toggleCategory}
                    onReset={resetToDefaults}
                    onSelectAll={selectAll}
                    visibleCount={visibleCount}
                    totalCount={totalCount}
                  />
                </div>
              </div>

              {/* Selected Actions */}
              {selectedIds.size > 0 && (
                <div className="d-flex align-items-center gap-1.5 pe-3 ms-2 border-end border-zinc-200 flex-wrap animate-in fade-in slide-in-from-right-4">
                  <span className="smallest fw-bold text-zinc-900 bg-zinc-100 px-2 py-1 rounded-2 shadow-sm border border-zinc-200" style={{ fontSize: '9px' }}>
                    {selectedIds.size} SELECTED
                  </span>

                  <button
                    className="btn btn-white btn-xs border border-zinc-200 d-flex align-items-center gap-2 rounded-2 px-2 py-1 hover-shadow transition-all"
                    onClick={() => setShowBulkTagsModal(true)}
                    style={{ fontSize: '10px' }}
                  >
                    <Tag size={10} className="text-indigo-500" />
                    <span className="fw-bold">Tags</span>
                  </button>

                  <button
                    className="btn btn-white btn-xs border border-zinc-200 d-flex align-items-center gap-2 rounded-2 px-2 py-1 hover-shadow transition-all"
                    onClick={handleBulkSyncSelected}
                    style={{ fontSize: '10px' }}
                    disabled={syncing}
                  >
                    <RefreshCw size={10} className={`text-blue-600 ${syncing ? 'spin' : ''}`} />
                    <span className="fw-bold">Sync</span>
                  </button>
                  <button
                    className="btn btn-white btn-xs border border-zinc-200 d-flex align-items-center gap-2 rounded-2 px-2 py-1 hover-shadow transition-all"
                    onClick={handleSelectedCreateActions}
                    style={{ fontSize: '10px' }}
                    disabled={syncing}
                  >
                    <Zap size={10} className="text-amber-500 fill-amber-500" />
                    <span className="fw-bold">Tasks</span>
                  </button>
                  <button
                    className="btn btn-ghost-danger btn-xs d-flex align-items-center gap-1 rounded-2 px-2 py-1"
                    onClick={clearSelection}
                    style={{ fontSize: '10px' }}
                  >
                    <X size={10} />
                    <span className="fw-bold">Clear</span>
                  </button>
                </div>
              )}

              <div className="d-flex align-items-center gap-1.5 flex-wrap">
                <button
                  onClick={handleBulkCreateActions}
                  disabled={asins.length === 0 || syncing}
                  className="btn btn-white btn-xs border border-zinc-200 d-flex align-items-center gap-1.5 rounded-2 px-3 py-1 shadow-sm"
                  style={{ fontSize: '10px', height: '26px' }}
                >
                  <Zap size={11} className={syncing ? 'spin text-amber-500' : 'text-amber-500 fill-amber-500'} />
                  <span className="fw-bold">BULK OPTIMIZATION</span>
                </button>

                {/* Export Button */}
                {true && (
                  <button
                    onClick={() => setShowExportModal(true)}
                    className="btn btn-white btn-xs border border-zinc-200 d-flex align-items-center gap-1.5 rounded-2 px-2.5 py-1 shadow-sm"
                    style={{ fontSize: '10px', height: '26px' }}
                  >
                    <Download size={11} className="text-blue-600" />
                    <span className="fw-bold">EXPORT</span>
                  </button>
                )}

                {/* Bulk Import Button */}
                <button
                  onClick={() => setShowBulkImportModal(true)}
                  className="btn btn-white btn-xs border border-zinc-200 d-flex align-items-center gap-1.5 rounded-2 px-2.5 py-1 shadow-sm"
                  style={{ fontSize: '10px', height: '26px' }}
                >
                  <FileUp size={11} className="text-emerald-600" />
                  <span className="fw-bold">IMPORT</span>
                </button>
              </div>
            </div>
          </div>

          {/* APPLIED FILTERS BADGES */}
          {(Object.values(appliedFilters).some(v => v !== '' && (!Array.isArray(v) || v.length > 0)) || appliedSearchQuery || selectedSeller) && (
            <div className="px-4 py-2 bg-zinc-50 border-bottom d-flex align-items-center flex-wrap gap-2 animate-in fade-in slide-in-from-top-2">
              <span className="text-zinc-400 fw-bold me-2" style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Applied Filters
              </span>
              <div className="d-flex flex-wrap gap-2">
                {getAppliedFiltersBadges()}
              </div>
              <button
                className="btn btn-link btn-xs text-red-500 p-0 ms-auto fw-bold text-decoration-none shadow-none"
                style={{ fontSize: '10px' }}
                onClick={resetAllFilters}
              >
                CLEAR ALL
              </button>
            </div>
          )}

          {/* Scrollable Table Container */}
          <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
            <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 20 }}>
                <tr>
                  {isVisible('checkbox') && (
                    <th rowSpan={2} style={{ ...thStyle, width: '40px', left: 0, zIndex: 22, background: '#fafafa', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.size === filteredAsins.length && filteredAsins.length > 0}
                        onChange={handleToggleSelectAll}
                        style={{ cursor: 'pointer', width: '14px', height: '14px' }}
                      />
                    </th>
                  )}
                  {isVisible('asinCode') && (
                    <th rowSpan={2} style={{ ...thStyle, width: '110px', left: isVisible('checkbox') ? '40px' : '0px', zIndex: 21, background: '#fff', borderRight: '1px solid #f1f1f1' }}>
                      <div className="d-flex align-items-center justify-content-between">
                        ASIN ID
                      </div>
                    </th>
                  )}
                  {isVisible('releaseDate') && <th rowSpan={2} style={{ ...thStyle, width: '80px', textAlign: 'center' }}>RELEASED</th>}
                  {isVisible('parentAsin') && (
                    <th rowSpan={2} style={{ ...thStyle, width: '110px' }}>
                      <div className="d-flex align-items-center justify-content-between">
                        PARENT ASIN
                      </div>
                    </th>
                  )}
                  {isVisible('sellerBrand') && <th rowSpan={2} style={{ ...thStyle, width: '110px' }}>SELLER / BRAND</th>}
                  {isVisible('sku') && <th rowSpan={2} style={{ ...thStyle, width: '90px' }}>SKU</th>}
                  {isVisible('title') && <th rowSpan={2} style={{ ...thStyle, width: '220px' }}>PRODUCT TITLE</th>}
                  {isVisible('category') && (
                    <th rowSpan={2} style={{ ...thStyle, width: '130px' }}>
                      <div className="d-flex align-items-center justify-content-between">
                        CATEGORY
                      </div>
                    </th>
                  )}
                  {isVisible('tags') && <th rowSpan={2} style={{ ...thStyle, width: '100px' }}>TAGS</th>}

                  {visibleLQSCount > 0 && (
                    <th colSpan={visibleLQSCount} style={{ ...thStyle, background: '#f8fafc', color: '#1e293b', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>
                      LISTING QUALITY (LQS)
                    </th>
                  )}

                  {isVisible('price') && <th rowSpan={2} style={{ ...thStyle, width: '75px', textAlign: 'right' }}>PRICE</th>}
                  {isVisible('priceDispute') && <th rowSpan={2} style={{ ...thStyle, width: '70px', textAlign: 'center' }}>DISPUTE</th>}
                  {isVisible('mrp') && <th rowSpan={2} style={{ ...thStyle, width: '75px', textAlign: 'right', color: '#6b7280' }}>MRP</th>}

                  {visiblePriceTrendCount > 0 && (
                    <th colSpan={visiblePriceTrendCount}
                      onClick={async () => { setShowAllPriceHistory(true); }}
                      style={{ ...thStyle, background: '#eef2ff', color: '#4338ca', textAlign: 'center', cursor: 'pointer' }}>
                      Price Trend (7 Days) <Eye size={10} />
                    </th>
                  )}

                  {isVisible('mainBsr') && <th rowSpan={2} style={{ ...thStyle, width: '80px', textAlign: 'center', background: '#f5f3ff' }}>MAIN BSR</th>}
                  {isVisible('subBsr') && <th rowSpan={2} style={{ ...thStyle, width: '60px', textAlign: 'center' }}>SUB-BSR</th>}
                  {isVisible('bsr') && <th rowSpan={2} style={{ ...thStyle, width: '110px' }}>CATEGORY RANK</th>}
                  {isVisible('video') && <th rowSpan={2} style={{ ...thStyle, width: '50px', textAlign: 'center' }} title="Video Present">Video</th>}
                  {isVisible('bsrTrendStatus') && <th rowSpan={2} style={{ ...thStyle, width: '75px', textAlign: 'center', background: '#f5f3ff' }}>BSR TR</th>}

                  {visibleBsrTrendCount > 0 && (
                    <th colSpan={visibleBsrTrendCount}
                      onClick={async () => { setShowAllBsrHistory(true); }}
                      style={{ ...thStyle, background: '#f5f3ff', color: '#6d28d9', textAlign: 'center', cursor: 'pointer', borderBottom: '1px solid #ddd6fe' }}>
                      SUB-BSR TREND (7D)
                    </th>
                  )}

                  {isVisible('rating') && <th rowSpan={2} style={{ ...thStyle, width: '45px', textAlign: 'center' }}>RT</th>}
                  {isVisible('reviewCount') && <th rowSpan={2} style={{ ...thStyle, width: '55px', textAlign: 'center' }}>CNT</th>}
                  {isVisible('ratingTrendStatus') && <th rowSpan={2} style={{ ...thStyle, width: '75px', textAlign: 'center' }}>RATING TR</th>}

                  {visibleRatingTrendCount > 0 && (
                    <th colSpan={visibleRatingTrendCount}
                      onClick={async () => { setShowAllRatingHistory(true); }}
                      style={{ ...thStyle, background: '#fffbeb', color: '#92400e', textAlign: 'center', cursor: 'pointer', borderBottom: '1px solid #fef3c7' }}>
                      RATING TREND
                    </th>
                  )}

                  {visibleReviewTrendCount > 0 && (
                    <th colSpan={visibleReviewTrendCount}
                      onClick={async () => { setShowAllRatingHistory(true); }}
                      style={{ ...thStyle, background: '#e0e7ff', color: '#3730a3', textAlign: 'center', cursor: 'pointer', borderBottom: '1px solid #c7d2fe' }}>
                      REVIEWS TREND
                    </th>
                  )}

                  {isVisible('status') && <th rowSpan={2} style={{ ...thStyle, width: '70px', textAlign: 'center' }}>STATUS</th>}
                  {isVisible('dealBadge') && <th rowSpan={2} style={{ ...thStyle, width: '80px', textAlign: 'center' }}>DEAL</th>}
                  {isVisible('currentBuybox') && <th rowSpan={2} style={{ ...thStyle, width: '110px', textAlign: 'left' }}>CURRENT BUYBOX</th>}
                  {isVisible('otherBuybox') && <th rowSpan={2} style={{ ...thStyle, width: '110px', textAlign: 'left' }}>OTHER BUYBOX</th>}
                  {isVisible('imagesCount') && <th rowSpan={2} style={{ ...thStyle, width: '35px', textAlign: 'center' }}>IMG</th>}

                  {visibleImageTrendCount > 0 && (
                    <th colSpan={visibleImageTrendCount}
                      style={{ ...thStyle, background: '#fdf2f8', color: '#be185d', textAlign: 'center', cursor: 'pointer', borderBottom: '1px solid #fbcfe8' }}>
                      IMG TREND (7D)
                    </th>
                  )}

                  {isVisible('bulletPoints') && <th rowSpan={2} style={{ ...thStyle, width: '35px', textAlign: 'center' }}>B</th>}
                  {isVisible('hasAplus') && <th rowSpan={2} style={{ ...thStyle, width: '40px', textAlign: 'center' }}>A+</th>}
                  {isVisible('aplusDays') && <th rowSpan={2} style={{ ...thStyle, width: '50px', textAlign: 'center', color: '#b91c1c' }}>A+ DAYS</th>}
                </tr>
                <tr>
                  {isVisible('titleScore') && <th style={{ ...thStyle, width: '45px', textAlign: 'center', background: '#f8fafc' }} title="Title Quality Score">TTL</th>}
                  {isVisible('bulletScore') && <th style={{ ...thStyle, width: '45px', textAlign: 'center', background: '#f8fafc' }} title="Bullet Points Score">BLT</th>}
                  {isVisible('imageScore') && <th style={{ ...thStyle, width: '45px', textAlign: 'center', background: '#f8fafc' }} title="Image Quality Score">IMG</th>}
                  {isVisible('descriptionScore') && <th style={{ ...thStyle, width: '45px', textAlign: 'center', background: '#f8fafc' }} title="Description Score">DSC</th>}
                  {isVisible('lqs') && <th style={{ ...thStyle, width: '50px', textAlign: 'center', background: '#f1f5f9', fontWeight: 800 }} title="Overall LQS Score">TOTAL</th>}

                  {/* Price Trend Dates */}
                  {isVisible('priceTrend') && historyStructure.map(week => week.dates.map((date, idx) => (
                    <th key={`p-h-${idx}`} style={{ ...thStyle, padding: '2px 4px', fontSize: 9, textAlign: 'center', background: '#eef2ff', color: '#6366f1' }}>
                      {date.label}
                    </th>
                  )))}

                  {/* BSR Trend Dates */}
                  {isVisible('bsrTrend') && historyStructure.map(week => week.dates.map((date, idx) => (
                    <th key={`b-h-${idx}`} style={{ ...thStyle, padding: '2px 4px', fontSize: 9, textAlign: 'center', background: '#f5f3ff', color: '#7c3aed' }}>
                      {date.label}
                    </th>
                  )))}

                  {/* Rating Trend Dates */}
                  {isVisible('ratingTrend') && historyStructure.map(week => week.dates.map((date, idx) => (
                    <th key={`r-h-${idx}`} style={{ ...thStyle, padding: '2px 4px', fontSize: 9, textAlign: 'center', background: '#fffbeb', color: '#b45309' }}>
                      {date.label}
                    </th>
                  )))}

                  {/* Review Trend Dates */}
                  {isVisible('reviewTrend') && historyStructure.map(week => week.dates.map((date, idx) => (
                    <th key={`rev-h-${idx}`} style={{ ...thStyle, padding: '2px 4px', fontSize: 9, textAlign: 'center', background: '#e0e7ff', color: '#4338ca' }}>
                      {date.label}
                    </th>
                  )))}

                  {/* Image Trend Dates */}
                  {isVisible('imageTrend') && historyStructure.map(week => week.dates.map((date, idx) => (
                    <th key={`i-h-${idx}`} style={{ ...thStyle, padding: '2px 4px', fontSize: 9, textAlign: 'center', background: '#fdf2f8', color: '#db2777' }}>
                      {date.label}
                    </th>
                  )))}
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
                        action={{ label: 'Add ASINs', onClick: () => setShowAddModal(true) }}
                      />
                    </td>
                  </tr>
                ) : (
                  filteredAsins.map((asin, idx) => (
                    <tr key={asin._id || idx} className="table-row-hover" style={{
                      background: idx % 2 === 0 ? '#fff' : '#f9fafb'
                    }}>
                      {isVisible('checkbox') && (
                        <td style={{
                          ...tdStyle,
                          width: '40px',
                          position: 'sticky',
                          left: 0,
                          background: idx % 2 === 0 ? '#fff' : '#f9fafb',
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
                          background: idx % 2 === 0 ? '#fff' : '#f9fafb',
                          zIndex: 5,
                          borderRight: '2px solid #e5e7eb'
                        }}
                          onClick={() => handleViewAsin(asin)}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            <span>{asin.asinCode}</span>
                            <a
                              href={`https://www.amazon.in/dp/${asin.asinCode}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Open on Amazon"
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
                            <div className="d-flex flex-column align-items-center">
                              <span style={{ fontSize: '10px', fontWeight: 600 }}>
                                {new Date(asin.releaseDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                              </span>
                              <span className="badge bg-zinc-100 text-zinc-500 mt-1" style={{ fontSize: '8px' }}>
                                {(() => {
                                  const days = Math.floor((Date.now() - new Date(asin.releaseDate)) / (1000 * 60 * 60 * 24));
                                  if (days <= 30) return `${days}d`;
                                  if (days <= 60) return `${days}d ⚡`;
                                  if (days <= 90) return `${days}d 📈`;
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
                          <div className="d-flex align-items-center">
                            {asin.parentAsin || asin.ParentAsin ? (
                              <span
                                className="badge font-monospace shadow-sm"
                                style={{
                                  backgroundColor: '#1e1b4b',
                                  color: '#ffffff',
                                  border: '1px solid #1e1b4b',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  padding: '5px 10px',
                                  borderRadius: '6px',
                                  letterSpacing: '0.05em',
                                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                }}
                                title="Parent ASIN"
                              >
                                {asin.parentAsin || asin.ParentAsin}
                              </span>
                            ) : (
                              <span style={{ color: '#d1d5db' }}>-</span>
                            )}
                          </div>
                        </td>
                      )}
                      {isVisible('sellerBrand') && (
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            <span style={{ fontWeight: 600, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                              {asin.seller?.name || asin.seller || 'Global'}
                            </span>
                            <span style={{ fontSize: 9, color: '#9ca3af' }}>{asin.soldBy || '-'}</span>
                          </div>
                        </td>
                      )}
                      {isVisible('sku') && <td style={tdStyle}>{asin.sku || '-'}</td>}
                      {isVisible('title') && (
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {asin.imageUrl && (
                              <img src={asin.imageUrl} alt="" style={{ width: 20, height: 20, borderRadius: 3, objectFit: 'cover' }} />
                            )}
                            <span style={{
                              whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden',
                              fontSize: 11, cursor: 'pointer'
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
                      {isVisible('titleScore') && (
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
                      )}

                      {isVisible('bulletScore') && (
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
                      )}

                      {isVisible('imageScore') && (
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
                      )}

                      {isVisible('descriptionScore') && (
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
                      )}

                      {isVisible('lqs') && (
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
                      )}
                      {isVisible('price') && (
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, cursor: 'pointer' }}
                          onClick={(e) => handleViewPrice(asin, e)}
                          title="View Price Trend Matrix">
                          <div className="d-flex flex-column align-items-end">
                            <span style={{ color: (asin.uploadedPrice > 0 && Math.abs(asin.uploadedPrice - (asin.currentPrice || 0)) > 0.01) ? '#dc2626' : '#16a34a' }}>
                              ₹{(asin.uploadedPrice || 0).toLocaleString()}
                            </span>
                            {(asin.uploadedPrice > 0 && Math.abs(asin.uploadedPrice - (asin.currentPrice || 0)) > 0.01) && (
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
                          </div>
                        </td>
                      )}
                      {isVisible('priceDispute') && (
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <div className="d-flex justify-content-center">
                            {asin.uploadedPrice > 0 && Math.abs(asin.uploadedPrice - (asin.currentPrice || 0)) > 0.01 ? (
                              <span className="badge shadow-sm d-flex align-items-center justify-content-center gap-1" style={{ 
                                backgroundColor: '#dc2626', 
                                color: '#fff', 
                                fontSize: '10px', 
                                fontWeight: 800,
                                padding: '5px 12px',
                                borderRadius: '4px',
                                minWidth: '55px'
                              }}>
                                <AlertTriangle size={10} />
                                YES
                              </span>
                            ) : (
                              <span className="badge shadow-sm d-flex align-items-center justify-content-center" style={{ 
                                backgroundColor: '#16a34a', 
                                color: '#fff', 
                                fontSize: '10px', 
                                fontWeight: 800,
                                padding: '5px 12px',
                                borderRadius: '4px',
                                minWidth: '55px'
                              }}>
                                NO
                              </span>
                            )}
                          </div>
                        </td>
                      )}
                      {isVisible('mrp') && (
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: '#6b7280', fontSize: '10.5px' }}>
                          ₹{(asin.mrp || 0).toLocaleString()}
                        </td>
                      )}
                      {isVisible('priceTrend') && historyStructure.map(week => week.dates.map((date, dIdx) => {
                        const wData = asin.weekHistory?.find(w => new Date(w.date).toISOString().split('T')[0] === date.raw)
                          || asin.history?.find(h => new Date(h.date).toISOString().split('T')[0] === date.raw);
                        return (
                          <td key={`p-${week.label}-${dIdx}`}
                            onClick={(e) => handleViewPrice(asin, e)}
                            title="View Price Trend Matrix"
                            style={{ ...tdStyle, textAlign: 'center', background: '#f5f3ff33', width: 45, cursor: 'pointer' }}>
                            {wData?.price ? getWeekHistoryBadge(wData.price, 'price', asin.uploadedPrice) : '-'}
                          </td>
                        );
                      }))}
                      {isVisible('mainBsr') && (
                        <td style={{ ...tdStyle, textAlign: 'center', cursor: 'pointer', background: '#f5f3ff1a' }}
                          onClick={(e) => handleViewBsr(asin, e)}>
                          <div className="d-flex flex-column align-items-center">
                            <div style={{ fontWeight: 700, color: '#7c3aed', fontSize: '11px' }}>
                              {asin.bsr ? `#${asin.bsr.toLocaleString()}` : '-'}
                            </div>
                            {asin.category && (
                              <span className="text-zinc-400 text-truncate" style={{ fontSize: '8px', maxWidth: '75px' }} title={asin.category}>
                                in {asin.category}
                              </span>
                            )}
                          </div>
                        </td>
                      )}
                      {isVisible('subBsr') && (
                        <td style={{ ...tdStyle, textAlign: 'center', cursor: 'pointer' }}
                          onClick={(e) => handleViewBsr(asin, e)}>
                          <div style={{ fontWeight: 600, color: '#6b7280' }}>
                            {asin.subBsr && asin.subBsr !== '0' ? (asin.subBsr.includes(' in ') ? asin.subBsr.split(' in ')[0] : asin.subBsr) : '-'}
                          </div>
                        </td>
                      )}
                      {isVisible('bsr') && (
                        <td style={{ ...tdStyle, width: '120px' }}>
                          {(() => {
                            const subBsrValue = (asin.subBsr && asin.subBsr !== '0' && asin.subBsr !== 0) ? asin.subBsr : ((Array.isArray(asin.subBSRs) && asin.subBSRs[0]) || '');
                            const hasMultiple = Array.isArray(asin.subBSRs) && asin.subBSRs.length > 1;
                            let rank = subBsrValue;
                            let category = '';
                            if (subBsrValue.includes(' in ')) {
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
                      {isVisible('bsrTrendStatus') && (
                        <td style={{ ...tdStyle, textAlign: 'center', background: '#f5f3ff1a' }}>
                          <TrendBadge status={asin.bsrTrend} />
                        </td>
                      )}
                      {isVisible('bsrTrend') && historyStructure.map(week => week.dates.map((date, dIdx) => {
                        const wData = asin.weekHistory?.find(w => new Date(w.date).toISOString().split('T')[0] === date.raw)
                          || asin.history?.find(h => new Date(h.date).toISOString().split('T')[0] === date.raw);
                        return (
                          <td key={`b-${week.label}-${dIdx}`}
                            onClick={(e) => handleViewBsr(asin, e)}
                            style={{ ...tdStyle, textAlign: 'center', background: '#f5f3ff33', width: 40, cursor: 'pointer' }}>
                            {wData?.subBsr ? getWeekHistoryBadge(wData.subBsr, 'subBsr') : (wData?.bsr ? getWeekHistoryBadge(wData.bsr, 'subBsr') : '-')}
                          </td>
                        );
                      }))}
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
                          {(asin.reviewCount || 0).toLocaleString()}
                        </td>
                      )}
                      {isVisible('ratingTrendStatus') && (
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <TrendBadge status={asin.ratingTrend} />
                        </td>
                      )}
                      {isVisible('ratingTrend') && historyStructure.map(week => week.dates.map((date, dIdx) => {
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

                      {isVisible('reviewTrend') && historyStructure.map(week => week.dates.map((date, dIdx) => {
                        const wData = asin.weekHistory?.find(w => new Date(w.date).toISOString().split('T')[0] === date.raw)
                          || asin.history?.find(h => new Date(h.date).toISOString().split('T')[0] === date.raw);
                        return (
                          <td key={`rev-${week.label}-${dIdx}`}
                            onClick={(e) => handleViewRating(asin, e)}
                            style={{ ...tdStyle, textAlign: 'center', background: '#e0e7ff33', width: 40, cursor: 'pointer' }}>
                            {(wData?.reviews || wData?.reviewCount) ? <span style={{ fontSize: '10px', color: '#4338ca', fontWeight: 600 }}>{(wData.reviews || wData.reviewCount).toLocaleString()}</span> : '-'}
                          </td>
                        );
                      }))}
                      {isVisible('status') && (
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <span
                            className="badge"
                            style={{
                              backgroundColor: (asin.availabilityStatus || 'Available').toLowerCase().includes('unavailable') ? '#dc2626' : '#059669',
                              color: '#fff',
                              fontWeight: 600,
                              fontSize: '0.75rem',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              maxWidth: '75px',
                              display: 'inline-block',
                              verticalAlign: 'middle'
                            }}
                            title={asin.availabilityStatus || 'Available'}
                          >
                            {asin.availabilityStatus || 'Available'}
                          </span>
                        </td>
                      )}
                      {isVisible('dealBadge') && (
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          {asin.dealBadge && asin.dealBadge !== 'No deal found' && asin.dealBadge !== '' ? (
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
                                whiteSpace: 'nowrap'
                              }}
                              title={asin.dealBadge}
                            >
                              {asin.dealBadge}
                            </span>
                          ) : (
                            <span style={{ color: '#9ca3af', fontSize: '9px' }}>-</span>
                          )}
                        </td>
                      )}
                      {/* ===== CURRENT BUYBOX ===== */}
                      {isVisible('currentBuybox') && (
                        <td style={{ ...tdStyle, width: '110px', padding: '4px 8px' }}>
                          {(() => {
                            // Current BuyBox winner info
                            const seller = asin.soldBy || null;
                            const price = asin.currentPrice || 0;

                            if (!seller && !price) return <span style={{ color: '#9ca3af', fontSize: '10px' }}>-</span>;

                            return (
                              <div className="d-flex flex-column gap-1">
                                <span
                                  className="fw-bold text-zinc-800 text-truncate"
                                  style={{ fontSize: '10px' }}
                                  title={seller || 'Unknown'}
                                >
                                  {seller || 'Unknown'}
                                </span>
                                <span className="fw-bold text-indigo-600" style={{ fontSize: '11px' }}>
                                  ₹{price.toLocaleString()}
                                </span>
                              </div>
                            );
                          })()}
                        </td>
                      )}

                      {/* ===== OTHER BUYBOX ===== */}
                      {isVisible('otherBuybox') && (
                        <td style={{ ...tdStyle, width: '110px', padding: '4px 8px' }}>
                          {(() => {
                            // Get all offers and find the non-winner
                            const allOffers = (asin.allOffers && Array.isArray(asin.allOffers) && asin.allOffers.length > 0)
                              ? asin.allOffers
                              : [];

                            // Filter out the BuyBox winner
                            const otherOffers = allOffers.filter(o => {
                              // Skip the winner
                              if (o.isBuyBoxWinner === true) return false;
                              // Skip if same as current seller
                              if (o.seller && asin.soldBy &&
                                o.seller.toLowerCase().trim() === asin.soldBy.toLowerCase().trim()) return false;
                              // Must have a seller name
                              if (!o.seller || o.seller.trim() === '') return false;
                              const sellerLower = o.seller.toLowerCase().trim();
                              if (sellerLower === 'unknown' || sellerLower === 'view details') return false;
                              return true;
                            });

                            // ✅ If otherOffers has data, show it
                            if (otherOffers.length > 0) {
                              const firstOther = otherOffers[0];
                              const remainingCount = otherOffers.length - 1;

                              return (
                                <div className="d-flex flex-column gap-1">
                                  <span
                                    className="fw-medium text-zinc-600 text-truncate"
                                    style={{ fontSize: '10px', maxWidth: '100px' }}
                                    title={firstOther.seller}
                                  >
                                    {firstOther.seller}
                                  </span>
                                  {firstOther.price > 0 ? (
                                    <span className="fw-bold text-zinc-500" style={{ fontSize: '11px' }}>
                                      ₹{firstOther.price.toLocaleString()}
                                    </span>
                                  ) : (
                                    <span style={{ color: '#9ca3af', fontSize: '9px' }}>No price data</span>
                                  )}
                                  {remainingCount > 0 && (
                                    <span className="text-zinc-400" style={{ fontSize: '8px' }}
                                      title={otherOffers.slice(1).map(o => `${o.seller}: ₹${(o.price || 0).toLocaleString()}`).join('\n')}>
                                      +{remainingCount} more
                                    </span>
                                  )}
                                </div>
                              );
                            }

                            // ✅ FALLBACK: Use legacy soldBySec/secondAsp
                            const secSeller = (asin.soldBySec || '').trim();
                            const secPrice = parseFloat(asin.secondAsp) || 0;
                            const secSellerLower = secSeller.toLowerCase();

                            // Check if it's different from the current seller
                            if (secSeller && secSellerLower !== 'unknown' && secSellerLower !== 'details' && secSellerLower !== 'view details' && secSeller.length > 0) {
                              const isSameAsCurrent = asin.soldBy &&
                                secSellerLower === (asin.soldBy || '').toLowerCase();

                              if (!isSameAsCurrent) {
                                return (
                                  <div className="d-flex flex-column gap-1">
                                    <span
                                      className="fw-medium text-zinc-600 text-truncate"
                                      style={{ fontSize: '10px', maxWidth: '100px' }}
                                      title={secSeller}
                                    >
                                      {secSeller}
                                    </span>
                                    {secPrice > 0 ? (
                                      <span className="fw-bold text-zinc-500" style={{ fontSize: '11px' }}>
                                        ₹{secPrice.toLocaleString()}
                                      </span>
                                    ) : (
                                      <span style={{ color: '#9ca3af', fontSize: '9px' }}>No price</span>
                                    )}
                                  </div>
                                );
                              }
                            }

                            // ✅ Nothing found
                            return <span style={{ color: '#9ca3af', fontSize: '10px' }}>-</span>;
                          })()}
                        </td>
                      )}

                      {isVisible('imagesCount') && <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600 }}>{asin.imagesCount || 0}</td>}

                      {isVisible('imageTrend') && historyStructure.map(week => week.dates.map((date, dIdx) => {
                        const wData = asin.weekHistory?.find(w => new Date(w.date).toISOString().split('T')[0] === date.raw)
                          || asin.history?.find(h => new Date(h.date).toISOString().split('T')[0] === date.raw);
                        return (
                          <td key={`i-${week.label}-${dIdx}`}
                            style={{ ...tdStyle, textAlign: 'center', background: '#fdf2f833', width: 40, borderRight: '1px solid #fce7f3' }}>
                            <span style={{ fontSize: '10px', color: '#db2777', fontWeight: 600 }}>
                              {wData?.imageCount !== undefined ? wData.imageCount : (asin.imagesCount || '-')}
                            </span>
                          </td>
                        );
                      }))}

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
                    </tr>
                  )))}
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
            </Suspense>
          </div>
        </div>

        {/* [M] Modals Consolidated */}
        <Suspense fallback={<div />}>
          {showExportModal && (
            <ExportAsinModal
              isOpen={showExportModal}
              onClose={() => setShowExportModal(false)}
            />
          )}

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
                  <InfiniteScrollSelect
                    fetchData={fetchSellerDropdownData}
                    value={selectedSellerId}
                    onSelect={setSelectedSellerId}
                    placeholder="Select Seller..."
                  />
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
                  <InfiniteScrollSelect
                    fetchData={fetchSellerDropdownData}
                    value={selectedSellerId}
                    onSelect={setSelectedSellerId}
                    placeholder="Select Seller..."
                  />
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

      {/* [N] Secondary Modals - Lazy Loaded */}
      <Suspense fallback={null}>
        <AsinDetailModal
          asin={selectedAsin}
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
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
          selectedAsins={asins.filter(a => selectedIds.has(a._id))}
          onComplete={() => {
            setShowBulkTagsModal(false);
            clearSelection();
            loadData(pagination.page, pagination.limit);
          }}
        />
      )}
    </div>
  );
};

export default AsinManagerPage;
