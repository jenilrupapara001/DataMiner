export const ACTIONS_BY_TYPE = {
  ASIN: [
    { value: 'pause_ads', label: 'Pause Ads for ASIN', hasValue: false, group: 'Ads' },
    { value: 'enable_ads', label: 'Enable Ads for ASIN', hasValue: false, group: 'Ads' },
    { value: 'increase_bids_pct', label: 'Increase Bids by', hasValue: true, unit: '%', group: 'Ads' },
    { value: 'decrease_bids_pct', label: 'Decrease Bids by', hasValue: true, unit: '%', group: 'Ads' },
    { value: 'increase_price', label: 'Increase Price by', hasValue: true, unit: '₹', group: 'Pricing' },
    { value: 'decrease_price', label: 'Decrease Price by', hasValue: true, unit: '₹', group: 'Pricing' },
    { value: 'set_price', label: 'Set Price to', hasValue: true, unit: '₹', group: 'Pricing' },
    { value: 'set_discount', label: 'Set Discount to', hasValue: true, unit: '%', group: 'Pricing' },
    { value: 'match_buybox', label: 'Match Buy Box Price', hasValue: false, group: 'Pricing' },
    { value: 'send_email', label: 'Send Email Alert', hasValue: false, group: 'Alerts' },
    { value: 'send_notification', label: 'Send In-App Notification', hasValue: false, group: 'Alerts' },
    { value: 'add_to_watchlist', label: 'Add to Watchlist', hasValue: false, group: 'Alerts' },
    { value: 'create_task', label: 'Create Action/Task', hasValue: false, group: 'Alerts' },
    { value: 'add_tag', label: 'Add Tag', hasValue: true, group: 'Labels' },
    { value: 'remove_tag', label: 'Remove Tag', hasValue: true, group: 'Labels' },
    { value: 'flag_review', label: 'Flag for Review', hasValue: false, group: 'Listing' },
    { value: 'trigger_audit', label: 'Trigger Listing Audit', hasValue: false, group: 'Listing' },
  ],

  Product: [
    { value: 'pause_ads', label: 'Pause Ads for Product', hasValue: false, group: 'Ads' },
    { value: 'enable_ads', label: 'Enable Ads for Product', hasValue: false, group: 'Ads' },
    { value: 'increase_bids_pct', label: 'Increase Bids by', hasValue: true, unit: '%', group: 'Ads' },
    { value: 'decrease_bids_pct', label: 'Decrease Bids by', hasValue: true, unit: '%', group: 'Ads' },
    { value: 'increase_price', label: 'Increase Price by', hasValue: true, unit: '₹', group: 'Pricing' },
    { value: 'decrease_price', label: 'Decrease Price by', hasValue: true, unit: '₹', group: 'Pricing' },
    { value: 'set_price', label: 'Set Price to', hasValue: true, unit: '₹', group: 'Pricing' },
    { value: 'send_email', label: 'Send Email Alert', hasValue: false, group: 'Alerts' },
    { value: 'send_notification', label: 'Send In-App Notification', hasValue: false, group: 'Alerts' },
    { value: 'create_task', label: 'Create Action/Task', hasValue: false, group: 'Alerts' },
    { value: 'flag_review', label: 'Flag for Review', hasValue: false, group: 'Listing' },
  ],

  Inventory: [
    { value: 'send_reorder_alert', label: 'Send Reorder Alert', hasValue: false, group: 'Alerts' },
    { value: 'send_oos_warning', label: 'Send Out-of-Stock Warning', hasValue: false, group: 'Alerts' },
    { value: 'pause_ads', label: 'Pause Ads (stock < threshold)', hasValue: false, group: 'Ads' },
    { value: 'enable_ads', label: 'Enable Ads (stock > threshold)', hasValue: false, group: 'Ads' },
    { value: 'create_reorder_task', label: 'Create Reorder Task', hasValue: false, group: 'Tasks' },
    { value: 'send_email_alert', label: 'Send Email Alert', hasValue: false, group: 'Alerts' },
  ],

  Pricing: [
    { value: 'increase_price', label: 'Increase Price by', hasValue: true, unit: '₹', group: 'Price' },
    { value: 'decrease_price', label: 'Decrease Price by', hasValue: true, unit: '₹', group: 'Price' },
    { value: 'set_price', label: 'Set Price to', hasValue: true, unit: '₹', group: 'Price' },
    { value: 'match_competitor', label: 'Match Competitor Price', hasValue: false, group: 'Price' },
    { value: 'match_buybox', label: 'Match Buy Box Price', hasValue: false, group: 'Price' },
    { value: 'send_price_alert', label: 'Send Price Alert', hasValue: false, group: 'Alerts' },
  ]
};

export const ACTION_UNITS = {
  percent: '%',
  absolute: '₹',
  '₹': '₹'
};

export default {
  ACTIONS_BY_TYPE,
  ACTION_UNITS
};