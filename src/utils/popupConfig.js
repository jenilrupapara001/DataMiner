/**
 * GLOBAL POPUP CONFIGURATION
 * Use this for ALL Ant Design components that render popups
 * Ensures popups render to document.body to avoid clipping
 */

export const POPUP_CONTAINER = () => document.body;

export const POPUP_PROPS = {
  getPopupContainer: () => document.body,
};

export const PICKER_PROPS = {
  getPopupContainer: () => document.body,
  popupStyle: { zIndex: 1400 },
};

export const SELECT_PROPS = {
  getPopupContainer: () => document.body,
  dropdownStyle: { zIndex: 1300 },
};

export const TOOLTIP_PROPS = {
  getPopupContainer: () => document.body,
  zIndex: 1200,
};
