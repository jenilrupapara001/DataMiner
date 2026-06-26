/**
 * Ant Design Theme Configuration for RetailOps
 * Uses MUI-compatible brand palette for consistent UI.
 */
const theme = {
  token: {
    // Primary Brand — Operations & Trust
    colorPrimary: '#1976D2',
    colorPrimaryBg: '#E3F2FD',
    colorPrimaryBgHover: '#BBDEFB',
    colorPrimaryBorder: '#42A5F5',
    colorPrimaryBorderHover: '#1E88E5',
    colorPrimaryHover: '#1E88E5',
    colorPrimaryActive: '#1565C0',
    colorPrimaryTextHover: '#1565C0',
    colorPrimaryTextActive: '#0D47A1',

    // Success
    colorSuccess: '#2E7D32',
    colorSuccessBg: '#E8F5E9',
    colorSuccessBorder: '#4CAF50',

    // Warning
    colorWarning: '#ED6C02',
    colorWarningBg: '#FFF3E0',
    colorWarningBorder: '#FF9800',

    // Error
    colorError: '#D32F2F',
    colorErrorBg: '#FFEBEE',
    colorErrorBorder: '#EF5350',

    // Info
    colorInfo: '#0288D1',
    colorInfoBg: '#E1F5FE',

    // Neutral
    colorText: '#111827',
    colorTextSecondary: '#4B5563',
    colorTextTertiary: '#9CA3AF',
    colorBgContainer: '#FFFFFF',
    colorBgLayout: '#F8FAFC',
    colorBgElevated: '#FFFFFF',
    colorBorder: '#E5E7EB',
    colorBorderSecondary: '#F1F5F9',

    // Typography
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontSize: 13,
    fontSizeHeading4: 18,
    fontSizeHeading5: 16,

    // Radius
    borderRadius: 8,
    borderRadiusLG: 12,
    borderRadiusSM: 6,

    // Sizing
    controlHeight: 32,
    controlHeightSM: 28,
    controlHeightLG: 40,
  },
  components: {
    Button: {
      controlHeight: 32,
      controlHeightSM: 28,
      controlHeightLG: 40,
      borderRadius: 8,
      fontWeightStrong: 600,
      primaryShadow: '0 2px 8px rgba(25,118,210,0.25)',
    },
    Input: {
      controlHeight: 32,
      controlHeightSM: 28,
      borderRadius: 8,
      activeBorderColor: '#1976D2',
      activeShadow: '0 0 0 3px rgba(25,118,210,0.1)',
    },
    Select: {
      controlHeight: 32,
      controlHeightSM: 28,
      borderRadius: 8,
    },
    Table: {
      headerBg: '#F8FAFC',
      headerColor: '#475569',
      headerFontSize: 11,
      rowHoverBg: '#F1F5F9',
      borderColor: '#E5E7EB',
      cellPaddingBlock: 12,
    },
    Card: {
      borderRadiusLG: 12,
    },
    Modal: {
      borderRadiusLG: 16,
    },
    Tag: {
      borderRadiusSM: 6,
    },
    Segmented: {
      controlHeight: 32,
    },
  },
};

export default theme;
