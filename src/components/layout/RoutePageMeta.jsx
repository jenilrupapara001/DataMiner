import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useHeader } from '../../contexts/HeaderContext';

const routeMeta = {
  '/':                    { title: 'Dashboard', breadcrumbs: [{ label: 'Workspace' }, { label: 'Dashboard' }] },
  '/dashboard':           { title: 'Dashboard', breadcrumbs: [{ label: 'Workspace' }, { label: 'Dashboard' }] },
  '/sellers':             { title: 'Seller Management', breadcrumbs: [{ label: 'Global' }, { label: 'Sellers' }] },
  '/asin-tracker':        { title: 'ASIN Tracker', breadcrumbs: [{ label: 'Workspace' }, { label: 'ASIN Tracker' }] },
  '/ads-manager':         { title: 'Ads Manager', breadcrumbs: [{ label: 'Workspace' }, { label: 'Ads Manager' }] },
  '/ads-report':          { title: 'Ads Intelligence', breadcrumbs: [{ label: 'Workspace' }, { label: 'Ads Intelligence' }] },
  '/gms-tracker':         { title: 'GMS Tracker', breadcrumbs: [{ label: 'Workspace' }, { label: 'GMS Tracker' }] },
  '/profit-loss':         { title: 'Profit & Loss', breadcrumbs: [{ label: 'Workspace' }, { label: 'Profit & Loss' }] },
  '/inventory':           { title: 'Inventory', breadcrumbs: [{ label: 'Workspace' }, { label: 'Inventory' }] },
  '/actions':             { title: 'Workflows', breadcrumbs: [{ label: 'Workspace' }, { label: 'Workflows' }] },
  '/sku-report':          { title: 'SKU Report', breadcrumbs: [{ label: 'Workspace' }, { label: 'SKU Report' }] },
  '/parent-asin-report':  { title: 'Parent ASIN Report', breadcrumbs: [{ label: 'Workspace' }, { label: 'Parent ASIN Report' }] },
  '/month-wise-report':   { title: 'Monthly Intelligence', breadcrumbs: [{ label: 'Workspace' }, { label: 'Monthly Intelligence' }] },
  '/users':               { title: 'User Management', breadcrumbs: [{ label: 'Admin' }, { label: 'Users' }] },
  '/roles':               { title: 'Roles & Permissions', breadcrumbs: [{ label: 'Admin' }, { label: 'Roles' }] },
  '/team-management':     { title: 'Team Management', breadcrumbs: [{ label: 'Admin' }, { label: 'Team Management' }] },
  '/settings':            { title: 'Settings', breadcrumbs: [{ label: 'Admin' }, { label: 'Settings' }] },
  '/api-keys':            { title: 'API Keys', breadcrumbs: [{ label: 'Admin' }, { label: 'API Keys' }] },
  '/file-manager':        { title: 'File Manager', breadcrumbs: [{ label: 'Workspace' }, { label: 'File Manager' }] },
  '/upload-export':       { title: 'Upload & Export', breadcrumbs: [{ label: 'Workspace' }, { label: 'Upload & Export' }] },
  '/alerts':              { title: 'Alerts', breadcrumbs: [{ label: 'Workspace' }, { label: 'Alerts' }] },
  '/alert-rules':         { title: 'Alert Rules', breadcrumbs: [{ label: 'Workspace' }, { label: 'Alert Rules' }] },
  '/rule-sets':           { title: 'Rule Sets', breadcrumbs: [{ label: 'Workspace' }, { label: 'Rule Sets' }] },
  '/scrape-tasks':        { title: 'Data Pipeline Status', breadcrumbs: [{ label: 'Workspace' }, { label: 'Scrape Tasks' }] },
  '/scheduled-runs':      { title: 'Scheduled Runs', breadcrumbs: [{ label: 'Workspace' }, { label: 'Scheduled Runs' }] },
  '/seller-tracker':      { title: 'Seller ASIN Tracker', breadcrumbs: [{ label: 'Workspace' }, { label: 'Seller Tracker' }] },
  '/activity-log':        { title: 'Activity Log', breadcrumbs: [{ label: 'Workspace' }, { label: 'Activity Log' }] },
  '/revenue-calculator':  { title: 'Revenue Calculator', breadcrumbs: [{ label: 'Workspace' }, { label: 'Revenue Calculator' }] },
  '/tasks':               { title: 'Optimization Tasks', breadcrumbs: [{ label: 'Workspace' }, { label: 'Tasks' }] },
  '/webhooks':            { title: 'Webhook & Notifications', breadcrumbs: [{ label: 'Workspace' }, { label: 'Webhooks' }] },
  '/profile':             { title: 'Profile', breadcrumbs: [{ label: 'Workspace' }, { label: 'Profile' }] },
  '/chat':                { title: 'Chat', breadcrumbs: [{ label: 'Workspace' }, { label: 'Chat' }] },
  '/target-achievement':  { title: 'Revenue Targets', breadcrumbs: [{ label: 'Workspace' }, { label: 'Targets' }] },
};

const sortedPrefixes = Object.keys(routeMeta)
  .filter(k => k !== '/')
  .sort((a, b) => b.length - a.length);

const RoutePageMeta = () => {
  const { pathname } = useLocation();
  const { setPageMeta } = useHeader();

  useEffect(() => {
    const exact = routeMeta[pathname];
    if (exact) {
      setPageMeta({ title: exact.title, subtitle: '', breadcrumbs: exact.breadcrumbs });
      return;
    }
    const matched = sortedPrefixes.find(p => pathname.startsWith(p + '/') || pathname === p);
    if (matched) {
      const meta = routeMeta[matched];
      setPageMeta({ title: meta.title, subtitle: '', breadcrumbs: meta.breadcrumbs });
    }
  }, [pathname, setPageMeta]);

  return null;
};

export default RoutePageMeta;
