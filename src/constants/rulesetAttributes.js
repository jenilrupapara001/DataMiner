export const ATTRIBUTES_BY_TYPE = {
  ASIN: [
    { value: 'lqs', label: 'LQS Score', type: 'number', unit: 'pts', group: 'Listing Quality', description: 'Listing Quality Score (0-100)' },
    { value: 'titleScore', label: 'Title Score', type: 'number', unit: 'pts', group: 'Listing Quality', description: 'Title quality metric' },
    { value: 'bulletScore', label: 'Bullet Score', type: 'number', unit: 'pts', group: 'Listing Quality', description: 'Bullet points quality metric' },
    { value: 'imageScore', label: 'Image Score', type: 'number', unit: 'pts', group: 'Listing Quality', description: 'Image quality metric' },
    { value: 'descriptionScore', label: 'Description Score', type: 'number', unit: 'pts', group: 'Listing Quality', description: 'Description quality metric' },
    { value: 'imagesCount', label: 'Image Count', type: 'number', unit: 'images', group: 'Listing Quality', description: 'Number of product images' },
    { value: 'bulletPoints', label: 'Bullet Points', type: 'number', unit: 'bullets', group: 'Listing Quality', description: 'Number of bullet points' },
    { value: 'hasAplus', label: 'Has A+ Content', type: 'boolean', unit: '', group: 'Listing Quality', description: 'Whether A+ Content is present' },

    { value: 'priceDispute', label: 'Price Dispute', type: 'boolean', unit: '', group: 'Price & Buybox', description: 'Channel price differs from current price by >₹5' },
    { value: 'uploadedPrice', label: 'Channel Price', type: 'number', unit: '₹', group: 'Price & Buybox', description: 'Master/channel price set by team' },
    { value: 'currentPrice', label: 'Current Price', type: 'number', unit: '₹', group: 'Price & Buybox', description: 'Live buybox price on marketplace' },
    { value: 'mrp', label: 'MRP', type: 'number', unit: '₹', group: 'Price & Buybox', description: 'Maximum Retail Price' },
    { value: 'discountPercentage', label: 'Discount %', type: 'number', unit: '%', group: 'Price & Buybox', description: 'Discount percentage from MRP' },
    { value: 'buyBoxWin', label: 'BuyBox Status', type: 'boolean', unit: '', group: 'Price & Buybox', description: 'Our seller winning BuyBox' },
    { value: 'hasDeal', label: 'Active Deal', type: 'boolean', unit: '', group: 'Price & Buybox', description: 'Has active deal (Lightning/Limited/Best Deal)' },
    { value: 'dealBadge', label: 'Deal Badge', type: 'text', unit: '', group: 'Price & Buybox', description: 'Type of active deal' },

    { value: 'stockLevel', label: 'Stock Level', type: 'number', unit: 'units', group: 'Inventory', description: 'Current stock/availability' },
    { value: 'availabilityStatus', label: 'Availability Status', type: 'enum', unit: '', group: 'Inventory', options: ['In stock', 'Out of Stock', 'Available', 'Currently unavailable'], description: 'Marketplace availability status' },
    { value: 'daysInventory', label: 'Days of Inventory', type: 'number', unit: 'days', group: 'Inventory', description: 'Estimated days stock will last' },

    { value: 'bsr', label: 'Main BSR', type: 'number', unit: 'rank', group: 'Performance', description: 'Best Seller Rank (main category)' },
    { value: 'subBsr', label: 'Sub BSR', type: 'number', unit: 'rank', group: 'Performance', description: 'Best Seller Rank (sub-category)' },
    { value: 'bsrTrend', label: 'BSR Trend', type: 'enum', unit: '', group: 'Performance', options: ['Grow', 'Down', 'Stable'], description: 'BSR trend direction' },
    { value: 'rating', label: 'Rating', type: 'number', unit: '★', group: 'Performance', description: 'Customer rating (1-5)' },
    { value: 'reviewCount', label: 'Review Count', type: 'number', unit: 'reviews', group: 'Performance', description: 'Total customer reviews' },
    { value: 'ratingTrend', label: 'Rating Trend', type: 'enum', unit: '', group: 'Performance', options: ['Grow', 'Down', 'Stable'], description: 'Rating trend direction' },
    { value: 'totalOrders', label: 'Total Orders', type: 'number', unit: 'orders', group: 'Performance', description: 'Total orders from GMS data' },

    { value: 'ads', label: 'Ads Active', type: 'boolean', unit: '', group: 'Ads', description: 'Whether ads campaign is running' },
    { value: 'tags', label: 'Tags', type: 'list', unit: '', group: 'Filters', description: 'ASIN tags (comma-separated)' },
    { value: 'category', label: 'Category', type: 'text', unit: '', group: 'Filters', description: 'Product category' },
    { value: 'brand', label: 'Brand', type: 'text', unit: '', group: 'Filters', description: 'Product brand name' },
    { value: 'seller', label: 'Seller', type: 'text', unit: '', group: 'Filters', description: 'Seller/brand name' },
    { value: 'asinStatus', label: 'ASIN Status', type: 'enum', unit: '', group: 'Filters', options: ['Active', 'Error', 'Archived'], description: 'ASIN sync/status state' },
  ],
};

export const OPERATORS = {
  number: [
    { value: '=', label: 'equals' },
    { value: '≠', label: 'not equals' },
    { value: '<', label: 'less than' },
    { value: '<=', label: 'less than or equal' },
    { value: '>', label: 'greater than' },
    { value: '>=', label: 'greater than or equal' },
    { value: 'between', label: 'between' },
    { value: 'is empty', label: 'is empty' },
    { value: 'is not empty', label: 'is not empty' },
  ],
  percent: [
    { value: '=', label: 'equals' },
    { value: '<', label: 'less than' },
    { value: '>', label: 'greater than' },
    { value: 'between', label: 'between' },
  ],
  text: [
    { value: '=', label: 'equals' },
    { value: '≠', label: 'not equals' },
    { value: 'contains', label: 'contains' },
    { value: 'not contains', label: 'does not contain' },
    { value: 'starts with', label: 'starts with' },
    { value: 'is empty', label: 'is empty' },
  ],
  enum: [
    { value: '=', label: 'equals' },
    { value: '≠', label: 'not equals' },
  ],
  boolean: [
    { value: '=', label: 'is' },
  ],
  list: [
    { value: 'contains', label: 'contains' },
    { value: 'not contains', label: 'does not contain' },
  ],
};

export const DATE_RANGES = [
  { value: 'Last 7 days', label: 'Last 7 days' },
  { value: 'Last 14 days', label: 'Last 14 days' },
  { value: 'Last 30 days', label: 'Last 30 days' },
  { value: 'Last 60 days', label: 'Last 60 days' },
  { value: 'Last 90 days', label: 'Last 90 days' },
];

export const EXCLUDE_OPTIONS = [
  { value: 'Latest day', label: 'Latest day' },
  { value: 'Latest 2 days', label: 'Latest 2 days' },
  { value: 'Latest 3 days', label: 'Latest 3 days' },
  { value: 'None', label: 'None' },
];

export const FREQUENCY_OPTIONS = [
  { value: 'Daily', label: 'Daily' },
  { value: 'Every 12 hours', label: 'Every 12 hours' },
  { value: 'Weekly', label: 'Weekly' },
];

export const TIME_OPTIONS = [
  '12 AM', '01 AM', '02 AM', '03 AM', '04 AM', '05 AM', '06 AM', '07 AM',
  '08 AM', '09 AM', '10 AM', '11 AM', '12 PM', '01 PM', '02 PM', '03 PM',
  '04 PM', '05 PM', '06 PM', '07 PM', '08 PM', '09 PM', '10 PM', '11 PM'
];

export default {
  ATTRIBUTES_BY_TYPE,
  OPERATORS,
  DATE_RANGES,
  EXCLUDE_OPTIONS,
  FREQUENCY_OPTIONS,
  TIME_OPTIONS
};
