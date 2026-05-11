import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';

const STORAGE_KEY = 'asin-datatable-columns';

// Define all available columns with their keys, labels, and default visibility
export const ALL_COLUMNS = [
  { key: 'checkbox', label: 'Select', defaultVisible: true, required: true, category: 'Core' },
  { key: 'asinCode', label: 'ASIN ID', defaultVisible: true, required: true, category: 'Core' },
  { key: 'sellerBrand', label: 'Seller / Brand', defaultVisible: true, category: 'Core' },
  { key: 'parentAsin', label: 'Parent ASIN', defaultVisible: true, category: 'Core' },
  { key: 'sku', label: 'SKU', defaultVisible: true, category: 'Core' },
  { key: 'title', label: 'Product Title', defaultVisible: true, required: true, category: 'Core' },
  { key: 'category', label: 'Category', defaultVisible: true, category: 'Core' },
  { key: 'tags', label: 'Tags', defaultVisible: true, category: 'Core' },
  { key: 'releaseDate', label: 'Release Date', defaultVisible: false, category: 'Core' },
  
  { key: 'titleScore', label: 'Title Score (TTL)', defaultVisible: true, category: 'LQS' },
  { key: 'bulletScore', label: 'Bullet Score (BLT)', defaultVisible: true, category: 'LQS' },
  { key: 'imageScore', label: 'Image Score (IMG)', defaultVisible: true, category: 'LQS' },
  { key: 'descriptionScore', label: 'Desc Score (DSC)', defaultVisible: true, category: 'LQS' },
  { key: 'lqs', label: 'Total LQS', defaultVisible: true, category: 'LQS' },
  { key: 'cdq', label: 'CDQ', defaultVisible: false, category: 'LQS' },
  { key: 'cdqGrade', label: 'CDQ Grade', defaultVisible: false, category: 'LQS' },
  
  { key: 'price', label: 'Price', defaultVisible: true, category: 'Pricing' },
  { key: 'priceDispute', label: 'Price Dispute', defaultVisible: true, category: 'Pricing' },
  { key: 'mrp', label: 'MRP', defaultVisible: true, category: 'Pricing' },
  { key: 'dealBadge', label: 'Deal', defaultVisible: true, category: 'Pricing' },
  { key: 'discountPercentage', label: 'Discount %', defaultVisible: false, category: 'Pricing' },
  
  { key: 'priceTrend', label: 'Price Trend (7D)', defaultVisible: true, category: 'Trends' },
  { key: 'mainBsr', label: 'Main BSR', defaultVisible: true, category: 'Rankings' },
  { key: 'subBsr', label: 'Sub BSR', defaultVisible: true, category: 'Rankings' },
  { key: 'video', label: 'Video', defaultVisible: false, category: 'Rankings' },
  { key: 'bsrTrendStatus', label: 'BSR Trend', defaultVisible: true, category: 'Trends' },
  { key: 'bsrTrend', label: 'BSR History (7D)', defaultVisible: false, category: 'Trends' },
  
  { key: 'rating', label: 'Rating', defaultVisible: true, category: 'Reviews' },
  { key: 'reviewCount', label: 'Reviews Count', defaultVisible: true, category: 'Reviews' },
  { key: 'ratingTrendStatus', label: 'Rating Trend', defaultVisible: true, category: 'Trends' },
  { key: 'ratingTrend', label: 'Rating History (7D)', defaultVisible: false, category: 'Trends' },
  { key: 'reviewTrend', label: 'Review History (7D)', defaultVisible: false, category: 'Trends' },
  
  { key: 'status', label: 'Status', defaultVisible: true, category: 'Info' },
  { key: 'ads', label: 'Ads Active', defaultVisible: true, category: 'Info' },
  { key: 'availability', label: 'Availability', defaultVisible: false, category: 'Info' },
  { key: 'currentBuybox', label: 'Current BuyBox', defaultVisible: true, category: 'BuyBox' },
  { key: 'otherBuybox', label: 'Other BuyBox', defaultVisible: true, category: 'BuyBox' },
  
  { key: 'imagesCount', label: 'Images (I)', defaultVisible: true, category: 'Content' },
  { key: 'imageTrend', label: 'Image Trend (7D)', defaultVisible: false, category: 'Trends' },
  { key: 'bulletPoints', label: 'Bullet Points (B)', defaultVisible: true, category: 'Content' },
  { key: 'hasAplus', label: 'A+ Content', defaultVisible: true, category: 'Content' },
  { key: 'aplusDays', label: 'A+ Days Absent', defaultVisible: true, category: 'Content' },
];

export const COLUMN_CATEGORIES = [...new Set(ALL_COLUMNS.map(c => c.category))];

export function useColumnVisibility() {
  const { user } = useAuth();
  
  const isCatalogManager = useMemo(() => {
    const roleName = (user?.role?.name || '').toString().toLowerCase();
    const roleDisp = (user?.role?.displayName || '').toString().toLowerCase();
    return roleName === 'catalog manager' || roleDisp === 'catalog manager' || roleName === 'catalog_manager';
  }, [user]);

  const allowedCategoriesForCatalogManager = useMemo(() => ['Core', 'Content', 'LQS'], []);

  const [visibleColumns, setVisibleColumns] = useState(() => {
    // Try to load from localStorage
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      // Ignore parse errors
    }
    // Default: all defaultVisible columns
    return ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.key);
  });

  // Filter columns and categories dynamically for Catalog Manager
  const filteredAllColumns = useMemo(() => {
    if (isCatalogManager) {
      return ALL_COLUMNS.filter(c => allowedCategoriesForCatalogManager.includes(c.category));
    }
    return ALL_COLUMNS;
  }, [isCatalogManager, allowedCategoriesForCatalogManager]);

  const filteredCategories = useMemo(() => {
    if (isCatalogManager) {
      return COLUMN_CATEGORIES.filter(cat => allowedCategoriesForCatalogManager.includes(cat));
    }
    return COLUMN_CATEGORIES;
  }, [isCatalogManager, allowedCategoriesForCatalogManager]);

  const isVisible = useCallback((key) => {
    if (isCatalogManager) {
      const col = ALL_COLUMNS.find(c => c.key === key);
      if (!col || !allowedCategoriesForCatalogManager.includes(col.category)) return false;
    }
    return visibleColumns.includes(key);
  }, [visibleColumns, isCatalogManager, allowedCategoriesForCatalogManager]);

  const toggleColumn = useCallback((key) => {
    if (isCatalogManager) {
      const col = ALL_COLUMNS.find(c => c.key === key);
      if (!col || !allowedCategoriesForCatalogManager.includes(col.category)) return;
    }
    setVisibleColumns(prev => {
      const column = ALL_COLUMNS.find(c => c.key === key);
      if (column?.required) return prev; // Don't toggle required columns
      
      const next = prev.includes(key) 
        ? prev.filter(k => k !== key) 
        : [...prev, key];
      
      // Save to localStorage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (e) {}
      
      return next;
    });
  }, [isCatalogManager, allowedCategoriesForCatalogManager]);

  const toggleCategory = useCallback((category, makeVisible) => {
    if (isCatalogManager && !allowedCategoriesForCatalogManager.includes(category)) return;
    setVisibleColumns(prev => {
      const categoryKeys = ALL_COLUMNS
        .filter(c => c.category === category && !c.required)
        .map(c => c.key);
      
      let next;
      if (makeVisible) {
        next = [...new Set([...prev, ...categoryKeys])];
      } else {
        next = prev.filter(k => !categoryKeys.includes(k));
      }
      
      // Save to localStorage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (e) {}
      
      return next;
    });
  }, [isCatalogManager, allowedCategoriesForCatalogManager]);

  const resetToDefaults = useCallback(() => {
    let defaults = ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.key);
    if (isCatalogManager) {
      defaults = ALL_COLUMNS
        .filter(c => c.defaultVisible && allowedCategoriesForCatalogManager.includes(c.category))
        .map(c => c.key);
    }
    setVisibleColumns(defaults);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
    } catch (e) {}
  }, [isCatalogManager, allowedCategoriesForCatalogManager]);

  const selectAll = useCallback(() => {
    let all = ALL_COLUMNS.map(c => c.key);
    if (isCatalogManager) {
      all = ALL_COLUMNS
        .filter(c => allowedCategoriesForCatalogManager.includes(c.category))
        .map(c => c.key);
    }
    setVisibleColumns(all);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch (e) {}
  }, [isCatalogManager, allowedCategoriesForCatalogManager]);

  const finalVisibleColumns = useMemo(() => {
    if (isCatalogManager) {
      return visibleColumns.filter(key => {
        const col = ALL_COLUMNS.find(c => c.key === key);
        return col && allowedCategoriesForCatalogManager.includes(col.category);
      });
    }
    return visibleColumns;
  }, [visibleColumns, isCatalogManager, allowedCategoriesForCatalogManager]);

  return {
    visibleColumns: finalVisibleColumns,
    isVisible,
    toggleColumn,
    toggleCategory,
    resetToDefaults,
    selectAll,
    visibleCount: finalVisibleColumns.length,
    totalCount: filteredAllColumns.length,
    allColumns: filteredAllColumns,
    columnCategories: filteredCategories,
    isCatalogManager
  };
}
