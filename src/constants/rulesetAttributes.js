export const ATTRIBUTES_BY_TYPE = {
  Bid: [
    { value: 'orders', label: 'Orders', type: 'number', unit: '', group: 'Performance' },
    { value: 'clicks', label: 'Clicks', type: 'number', unit: '', group: 'Performance' },
    { value: 'impressions', label: 'Impressions', type: 'number', unit: '', group: 'Performance' },
    { value: 'spend', label: 'Spend', type: 'number', unit: '₹', group: 'Performance' },
    { value: 'sales', label: 'Sales', type: 'number', unit: '₹', group: 'Performance' },
    { value: 'acos', label: 'ACoS', type: 'percent', unit: '%', group: 'Performance' },
    { value: 'roas', label: 'ROAS', type: 'number', unit: 'x', group: 'Performance' },
    { value: 'ctr', label: 'CTR', type: 'percent', unit: '%', group: 'Performance' },
    { value: 'cvr', label: 'CVR', type: 'percent', unit: '%', group: 'Performance' },
    { value: 'cpc', label: 'CPC', type: 'number', unit: '₹', group: 'Performance' },
    { value: 'bid', label: 'Bid', type: 'number', unit: '₹', group: 'Bid' },
    { value: 'keyword', label: 'Keyword', type: 'list', unit: '', group: 'Keyword' },
    { value: 'match_type', label: 'Match Type', type: 'enum', unit: '', group: 'Keyword', options: ['Exact', 'Phrase', 'Broad'] },
  ],

  Campaign: [
    { value: 'campaign_spend', label: 'Campaign Spend', type: 'number', unit: '₹', group: 'Performance' },
    { value: 'campaign_sales', label: 'Campaign Sales', type: 'number', unit: '₹', group: 'Performance' },
    { value: 'campaign_acos', label: 'Campaign ACoS', type: 'percent', unit: '%', group: 'Performance' },
    { value: 'campaign_roas', label: 'Campaign ROAS', type: 'number', unit: 'x', group: 'Performance' },
    { value: 'campaign_budget', label: 'Campaign Budget', type: 'number', unit: '₹', group: 'Campaign' },
    { value: 'campaign_state', label: 'Campaign State', type: 'enum', unit: '', group: 'Campaign', options: ['Enabled', 'Paused', 'Archived'] },
    { value: 'impressions', label: 'Impressions', type: 'number', unit: '', group: 'Performance' },
    { value: 'clicks', label: 'Clicks', type: 'number', unit: '', group: 'Performance' },
    { value: 'orders', label: 'Orders', type: 'number', unit: '', group: 'Performance' },
    { value: 'bidding_strategy', label: 'Bidding Strategy', type: 'enum', unit: '', group: 'Campaign', options: ['Manual', 'Auto', 'Dynamic'] },
    { value: 'days_running', label: 'Days Running', type: 'number', unit: 'days', group: 'Campaign' },
  ],

  ASIN: [
    { value: 'orders', label: 'Orders', type: 'number', unit: '', group: 'Performance' },
    { value: 'units_sold', label: 'Units Sold', type: 'number', unit: '', group: 'Performance' },
    { value: 'revenue', label: 'Revenue', type: 'number', unit: '₹', group: 'Performance' },
    { value: 'sessions', label: 'Sessions', type: 'number', unit: '', group: 'Performance' },
    { value: 'cvr', label: 'Conversion Rate', type: 'percent', unit: '%', group: 'Performance' },
    { value: 'buy_box_rate', label: 'Buy Box Win Rate', type: 'percent', unit: '%', group: 'Performance' },
    { value: 'bsr', label: 'BSR', type: 'number', unit: '', group: 'Listing' },
    { value: 'rating', label: 'Rating', type: 'number', unit: '★', group: 'Listing' },
    { value: 'review_count', label: 'Review Count', type: 'number', unit: '', group: 'Listing' },
    { value: 'lqs', label: 'LQS Score', type: 'number', unit: '', group: 'Listing' },
    { value: 'image_count', label: 'Image Count', type: 'number', unit: '', group: 'Listing' },
    { value: 'has_aplus', label: 'Has A+ Content', type: 'boolean', unit: '', group: 'Listing' },
    { value: 'buy_box_winner', label: 'Is Buy Box Winner', type: 'boolean', unit: '', group: 'Listing' },
    { value: 'current_price', label: 'Current Price', type: 'number', unit: '₹', group: 'Pricing' },
    { value: 'discount_pct', label: 'Discount %', type: 'percent', unit: '%', group: 'Pricing' },
    { value: 'profit_margin', label: 'Profit Margin', type: 'percent', unit: '%', group: 'Pricing' },
    { value: 'price_gap', label: 'Price Gap vs Comp.', type: 'number', unit: '₹', group: 'Pricing' },
    { value: 'stock_level', label: 'Stock Level', type: 'number', unit: 'units', group: 'Inventory' },
    { value: 'days_inventory', label: 'Days of Inventory', type: 'number', unit: 'days', group: 'Inventory' },
    { value: 'fba_units', label: 'FBA Available Units', type: 'number', unit: 'units', group: 'Inventory' },
    { value: 'ad_spend', label: 'Ad Spend', type: 'number', unit: '₹', group: 'Ads' },
    { value: 'ad_sales', label: 'Ad Sales', type: 'number', unit: '₹', group: 'Ads' },
    { value: 'acos', label: 'ACoS', type: 'percent', unit: '%', group: 'Ads' },
    { value: 'tacos', label: 'TACOS', type: 'percent', unit: '%', group: 'Ads' },
    { value: 'roas', label: 'ROAS', type: 'number', unit: 'x', group: 'Ads' },
    { value: 'asin_status', label: 'ASIN Status', type: 'enum', unit: '', group: 'Status', options: ['Active', 'Inactive', 'Suppressed', 'Stranded'] },
    { value: 'category', label: 'Category', type: 'text', unit: '', group: 'Status' },
    { value: 'brand', label: 'Brand', type: 'text', unit: '', group: 'Status' },
    { value: 'tags', label: 'Tags', type: 'list', unit: '', group: 'Status' },
  ],

  Product: [
    { value: 'orders', label: 'Orders', type: 'number', unit: '', group: 'Performance' },
    { value: 'units_sold', label: 'Units Sold', type: 'number', unit: '', group: 'Performance' },
    { value: 'revenue', label: 'Revenue', type: 'number', unit: '₹', group: 'Performance' },
    { value: 'sessions', label: 'Sessions', type: 'number', unit: '', group: 'Performance' },
    { value: 'cvr', label: 'Conversion Rate', type: 'percent', unit: '%', group: 'Performance' },
    { value: 'bsr', label: 'BSR', type: 'number', unit: '', group: 'Listing' },
    { value: 'rating', label: 'Rating', type: 'number', unit: '★', group: 'Listing' },
    { value: 'review_count', label: 'Review Count', type: 'number', unit: '', group: 'Listing' },
    { value: 'current_price', label: 'Current Price', type: 'number', unit: '₹', group: 'Pricing' },
    { value: 'stock_level', label: 'Stock Level', type: 'number', unit: 'units', group: 'Inventory' },
  ],

  Inventory: [
    { value: 'stock_level', label: 'Stock Level', type: 'number', unit: 'units', group: 'Stock' },
    { value: 'days_inventory', label: 'Days of Inventory Remaining', type: 'number', unit: 'days', group: 'Stock' },
    { value: 'reorder_point', label: 'Reorder Point', type: 'number', unit: 'units', group: 'Stock' },
    { value: 'sales_velocity', label: 'Sales Velocity', type: 'number', unit: 'units/day', group: 'Velocity' },
    { value: 'fba_units', label: 'FBA Available Units', type: 'number', unit: 'units', group: 'Stock' },
    { value: 'lead_time', label: 'Lead Time', type: 'number', unit: 'days', group: 'Lead Time' },
    { value: 'stranded_units', label: 'Stranded Units', type: 'number', unit: 'units', group: 'Stock' },
    { value: 'reserved_units', label: 'Reserved Units', type: 'number', unit: 'units', group: 'Stock' },
    { value: 'inbound_units', label: 'Inbound Units', type: 'number', unit: 'units', group: 'Stock' },
  ],

  Pricing: [
    { value: 'current_price', label: 'Current Price', type: 'number', unit: '₹', group: 'Price' },
    { value: 'mrp', label: 'MRP', type: 'number', unit: '₹', group: 'Price' },
    { value: 'buy_box_price', label: 'Buy Box Price', type: 'number', unit: '₹', group: 'Price' },
    { value: 'lowest_competitor_price', label: 'Lowest Competitor Price', type: 'number', unit: '₹', group: 'Competitor' },
    { value: 'profit_margin', label: 'Profit Margin', type: 'percent', unit: '%', group: 'Profit' },
    { value: 'acos', label: 'ACoS', type: 'percent', unit: '%', group: 'Ads' },
    { value: 'tacos', label: 'TACOS', type: 'percent', unit: '%', group: 'Ads' },
    { value: 'bsr', label: 'BSR', type: 'number', unit: '', group: 'Listing' },
    { value: 'stock_level', label: 'Stock Level', type: 'number', unit: 'units', group: 'Inventory' },
    { value: 'review_count', label: 'Review Count', type: 'number', unit: '', group: 'Listing' },
    { value: 'rating', label: 'Rating', type: 'number', unit: '★', group: 'Listing' },
  ],

  SOV: [
    { value: 'impression_share', label: 'Impression Share', type: 'percent', unit: '%', group: 'Share' },
    { value: 'share_of_voice', label: 'Share of Voice', type: 'percent', unit: '%', group: 'Share' },
    { value: 'organic_rank', label: 'Organic Rank', type: 'number', unit: '', group: 'Ranking' },
    { value: 'sponsored_rank', label: 'Sponsored Rank', type: 'number', unit: '', group: 'Ranking' },
    { value: 'keyword_bid', label: 'Keyword Bid', type: 'number', unit: '₹', group: 'Bid' },
    { value: 'keyword_state', label: 'Keyword State', type: 'enum', unit: '', group: 'Status', options: ['Active', 'Paused', 'Archived'] },
    { value: 'search_volume', label: 'Search Volume', type: 'number', unit: '', group: 'Volume' },
  ]
};

export const OPERATORS_BY_TYPE = {
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
    { value: '≠', label: 'not equals' },
    { value: '<', label: 'less than' },
    { value: '<=', label: 'less than or equal' },
    { value: '>', label: 'greater than' },
    { value: '>=', label: 'greater than or equal' },
    { value: 'between', label: 'between' },
  ],
  text: [
    { value: '=', label: 'equals' },
    { value: '≠', label: 'not equals' },
    { value: 'contains', label: 'contains' },
    { value: 'not contains', label: 'does not contain' },
    { value: 'starts with', label: 'starts with' },
    { value: 'is empty', label: 'is empty' },
    { value: 'is not empty', label: 'is not empty' },
  ],
  enum: [
    { value: '=', label: 'equals' },
    { value: '≠', label: 'not equals' },
  ],
  boolean: [
    { value: '=', label: 'equals' },
  ],
  list: [
    { value: '=', label: 'equals' },
    { value: '≠', label: 'not equals' },
    { value: 'contains', label: 'contains' },
    { value: 'not contains', label: 'does not contain' },
  ],
  date: [
    { value: '=', label: 'equals' },
    { value: '≠', label: 'not equals' },
    { value: '<', label: 'before' },
    { value: '>', label: 'after' },
    { value: 'between', label: 'between' },
  ]
};

export const VALUE_TYPES = [
  { value: 'Absolute Value', label: 'Absolute Value' },
  { value: '% of Target', label: '% of Target' },
  { value: 'Statistically Significant Count', label: 'Statistically Significant Count' },
];

export const DATE_RANGES = [
  { value: 'Last 7 days', label: 'Last 7 days' },
  { value: 'Last 14 days', label: 'Last 14 days' },
  { value: 'Last 30 days', label: 'Last 30 days' },
  { value: 'Last 60 days', label: 'Last 60 days' },
  { value: 'Last 90 days', label: 'Last 90 days' },
  { value: 'Last 6 months', label: 'Last 6 months' },
  { value: 'Last 1 year', label: 'Last 1 year' },
];

export const EXCLUDE_OPTIONS = [
  { value: 'Latest day', label: 'Latest day' },
  { value: 'Latest 2 days', label: 'Latest 2 days' },
  { value: 'Latest 3 days', label: 'Latest 3 days' },
  { value: 'Latest 7 days', label: 'Latest 7 days' },
  { value: 'None', label: 'None' },
];

export const FREQUENCY_OPTIONS = [
  { value: 'Hourly', label: 'Hourly' },
  { value: 'Every 6 hours', label: 'Every 6 hours' },
  { value: 'Every 12 hours', label: 'Every 12 hours' },
  { value: 'Daily', label: 'Daily' },
  { value: 'Weekly', label: 'Weekly' },
];

export const TIME_OPTIONS = [
  '12 AM', '01 AM', '02 AM', '03 AM', '04 AM', '05 AM', '06 AM', '07 AM',
  '08 AM', '09 AM', '10 AM', '11 AM', '12 PM', '01 PM', '02 PM', '03 PM',
  '04 PM', '05 PM', '06 PM', '07 PM', '08 PM', '09 PM', '10 PM', '11 PM'
];

export default {
  ATTRIBUTES_BY_TYPE,
  OPERATORS_BY_TYPE,
  VALUE_TYPES,
  DATE_RANGES,
  EXCLUDE_OPTIONS,
  FREQUENCY_OPTIONS,
  TIME_OPTIONS
};