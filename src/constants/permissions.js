// src/constants/permissions.js

export const PERMISSIONS = {
    // Target vs Achievement Permissions
    TARGETS_VIEW: 'targets_view',
    TARGETS_CREATE: 'targets_create',
    TARGETS_EDIT: 'targets_edit',
    TARGETS_DELETE: 'targets_delete',
    TARGETS_EXPORT: 'targets_export',

    // Existing System Permissions
    DASHBOARD_VIEW: 'dashboard_view',
    ACTIVITYLOGS_VIEW: 'activitylogs_view',
    SKUREPORT_VIEW: 'skureport_view',
    SKUREPORT_EXPORT: 'skureport_export',
    PARENTREPORT_VIEW: 'parentreport_view',
    PARENTREPORT_EXPORT: 'parentreport_export',
    MONTHLYREPORT_VIEW: 'monthlyreport_view',
    MONTHLYREPORT_EXPORT: 'monthlyreport_export',
    ADSREPORT_VIEW: 'adsreport_view',
    ADSREPORT_EXPORT: 'adsreport_export',
    PNLREPORT_VIEW: 'pnlreport_view',
    PNLREPORT_EXPORT: 'pnlreport_export',
    INVENTORYREPORT_VIEW: 'inventoryreport_view',
    INVENTORYREPORT_EXPORT: 'inventoryreport_export',
    GOALSREPORT_VIEW: 'goalsreport_view',
    GOALSREPORT_MANAGE: 'goalsreport_manage',
    SELLER_VIEW: 'seller_view',
    SELLER_MANAGE: 'seller_manage',
    MARKETPLACE_AMAZON: 'marketplace_amazon',
    MARKETPLACE_AJIO: 'marketplace_ajio',
    ASINMANAGER_VIEW: 'asinmanager_view',
    ASINMANAGER_MANAGE: 'asinmanager_manage',
    ASINMANAGER_IMPORT: 'asinmanager_import',
    ASINMANAGER_EXPORT: 'asinmanager_export',
    ASINTRACKER_VIEW: 'asintracker_view',
    SCRAPING_VIEW: 'scraping_view',
    SCRAPING_MANAGE: 'scraping_manage',
    RULES_VIEW: 'rules_view',
    RULES_MANAGE: 'rules_manage',
    TEMPLATES_MANAGE: 'templates_manage',
    TASKS_VIEW: 'tasks_view',
    TASKS_MANAGE: 'tasks_manage',
    CALCULATOR_VIEW: 'calculator_view',
    CALCULATOR_MANAGE: 'calculator_manage',
    ACTIONS_VIEW: 'actions_view',
    ACTIONS_MANAGE: 'actions_manage',
    CHAT_VIEW: 'chat_view',
    TEAMS_MANAGE: 'teams_manage',
    FILES_MANAGE: 'files_manage',
    USERS_VIEW: 'users_view',
    USERS_MANAGE: 'users_manage',
    ROLES_VIEW: 'roles_view',
    ROLES_MANAGE: 'roles_manage',
    APIKEYS_MANAGE: 'apikeys_manage',
    SETTINGS_MANAGE: 'settings_manage',
    ALERTS_VIEW: 'alerts_view',
    ALERTS_MANAGE: 'alerts_manage',
};

export const ROLE_DEFAULT_PERMISSIONS = {
    admin: [
        PERMISSIONS.TARGETS_VIEW,
        PERMISSIONS.TARGETS_CREATE,
        PERMISSIONS.TARGETS_EDIT,
        PERMISSIONS.TARGETS_DELETE,
        PERMISSIONS.TARGETS_EXPORT
    ],
    operational_manager: [
        PERMISSIONS.TARGETS_VIEW,
        PERMISSIONS.TARGETS_CREATE,
        PERMISSIONS.TARGETS_EDIT,
        PERMISSIONS.TARGETS_DELETE,
        PERMISSIONS.TARGETS_EXPORT
    ],
    'Brand Manager': [
        PERMISSIONS.TARGETS_VIEW
    ],
    catalog_manager: [
        PERMISSIONS.TARGETS_VIEW
    ],
    listing_team: [
        PERMISSIONS.TARGETS_VIEW
    ]
};
