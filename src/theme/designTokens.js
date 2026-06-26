/**
 * RetailOps Design System — Color Tokens & Constants
 * Central source of truth for all UI colors, spacing, and component tokens.
 */

export const COLORS = {
  // Primary Brand
  primary: { light: '#42A5F5', main: '#1976D2', dark: '#1565C0' },
  // Secondary
  secondary: { light: '#BA68C8', main: '#9C27B0', dark: '#7B1FA2' },
  // Semantic
  success: { light: '#4CAF50', main: '#2E7D32', dark: '#1B5E20' },
  warning: { light: '#FF9800', main: '#ED6C02', dark: '#E65100' },
  error: { light: '#EF5350', main: '#D32F2F', dark: '#C62828' },
  info: { light: '#03A9F4', main: '#0288D1', dark: '#01579B' },
  // Neutral
  text: { primary: '#111827', secondary: '#4B5563', disabled: '#9CA3AF', inverse: '#FFFFFF' },
  bg: { default: '#F8FAFC', paper: '#FFFFFF', sidebar: '#0F172A', hover: '#F1F5F9', selected: '#E3F2FD' },
  border: { light: '#E5E7EB', main: '#D1D5DB', dark: '#9CA3AF' },
};

export const MODULE_COLORS = {
  sellerOnboarding: '#1976D2',
  catalogManagement: '#42A5F5',
  inventoryPlanning: '#FF9800',
  purchaseOrders: '#ED6C02',
  dailyOperations: '#1565C0',
  orderManagement: '#0288D1',
  advertisingManagement: '#9C27B0',
  dealsManagement: '#BA68C8',
  reviewsRatings: '#7B1FA2',
  listingHealth: '#D32F2F',
  businessIntelligence: '#03A9F4',
  sellerSuccess: '#4CAF50',
  growthPlanning: '#2E7D32',
  governance: '#64748B',
  kpiDashboard: '#0F172A',
};

export const CHART_PALETTE = [
  '#1976D2', '#42A5F5', '#0288D1', '#9C27B0', '#BA68C8',
  '#4CAF50', '#FF9800', '#D32F2F', '#64748B', '#0F172A'
];

// Tailwind-compatible color classes for inline use
export const TAILWIND = {
  slate: { 50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1', 400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155', 800: '#1e293b', 900: '#0f172a' },
  blue: { 50: '#eff6ff', 100: '#dbeafe', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8' },
  green: { 50: '#f0fdf4', 100: '#dcfce7', 500: '#22c55e', 600: '#16a34a', 700: '#15803d' },
  red: { 50: '#fef2f2', 100: '#fee2e2', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c' },
  amber: { 50: '#fffbeb', 100: '#fef3c7', 500: '#f59e0b', 600: '#d97706', 700: '#b45309' },
  indigo: { 50: '#eef2ff', 100: '#e0e7ff', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca' },
  violet: { 50: '#f5f3ff', 100: '#ede9fe', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9' },
  cyan: { 50: '#ecfeff', 100: '#cffafe', 500: '#06b6d4', 600: '#0891b2', 700: '#0e7490' },
  emerald: { 50: '#ecfdf5', 100: '#d1fae5', 500: '#10b981', 600: '#059669', 700: '#047857' },
  rose: { 50: '#fff1f2', 100: '#ffe4e6', 500: '#f43f5e', 600: '#e11d48', 700: '#be123c' },
};

// Helper: Get a consistent color for a role name
export const ROLE_COLORS = {
  super_admin: '#dc2626', admin: '#ea580c', developer: '#64748b',
  operational_manager: '#7c3aed', brand_manager: '#2563eb',
  catalog_manager: '#db2777', listing_team: '#16a34a',
  manager: '#8b5cf6', analyst: '#06b6d4', viewer: '#94a3b8',
};

export function getRoleColor(roleName) {
  const name = (roleName || '').toLowerCase().replace(/\s+/g, '_');
  return ROLE_COLORS[name] || '#64748b';
}
