/**
 * RetailOps Color Mapping
 * Maps common hardcoded colors to design tokens for consistent usage.
 */

// Old hardcoded → Token mapping
export const COLOR_MAP = {
  // Success / Green family
  '#10b981': 'success.main',
  '#059669': 'success.dark',
  '#22c55e': 'success.main',
  '#4CAF50': 'success.light',
  '#2E7D32': 'success.main',
  '#1B5E20': 'success.dark',

  // Primary / Blue family
  '#4f46e5': 'primary.main',
  '#6366f1': 'primary.main',
  '#4338ca': 'primary.dark',
  '#1976D2': 'primary.main',
  '#42A5F5': 'primary.light',
  '#3b82f6': 'info.main',
  '#2563eb': 'info.main',
  '#0288D1': 'info.dark',

  // Warning / Amber family
  '#f59e0b': 'warning.main',
  '#d97706': 'warning.dark',
  '#FF9800': 'warning.light',
  '#ED6C02': 'warning.main',
  '#E65100': 'warning.dark',

  // Error / Red family
  '#ef4444': 'error.main',
  '#dc2626': 'error.dark',
  '#D32F2F': 'error.main',
  '#EF5350': 'error.light',
  '#C62828': 'error.dark',
  '#f43f5e': 'error.main',

  // Secondary / Purple family
  '#9C27B0': 'secondary.main',
  '#BA68C8': 'secondary.light',
  '#7B1FA2': 'secondary.dark',
  '#8b5cf6': 'secondary.light',
  '#7c3aed': 'secondary.main',

  // Cyan family
  '#06b6d4': 'info.light',
  '#0891b2': 'info.main',

  // Slate / Neutral family
  '#0F172A': 'bg.sidebar',
  '#1E293B': 'text.primary',
  '#334155': 'text.secondary',
  '#475569': 'text.secondary',
  '#64748B': 'text.disabled',
  '#94A3B8': 'text.disabled',
  '#CBD5E1': 'border.main',
  '#E2E8F0': 'border.light',
  '#F1F5F9': 'bg.hover',
  '#F8FAFC': 'bg.default',
};

// Get CSS variable name from token
export function getTokenVar(token) {
  const map = {
    'primary.main': 'var(--color-primary)',
    'primary.light': 'var(--color-primary-light)',
    'primary.dark': 'var(--color-primary-dark)',
    'secondary.main': 'var(--color-secondary)',
    'success.main': 'var(--color-success)',
    'warning.main': 'var(--color-warning)',
    'error.main': 'var(--color-error)',
    'info.main': 'var(--color-info)',
    'bg.default': 'var(--bg-primary)',
    'text.primary': 'var(--text-primary)',
    'text.secondary': 'var(--text-secondary)',
  };
  return map[token] || null;
}

// Get token value from hardcoded hex
export function resolveColor(hex) {
  const lower = (hex || '').toLowerCase();
  return COLOR_MAP[lower] || lower;
}
