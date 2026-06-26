import React, { useMemo, useState } from 'react';
import { Building2, Search, Package, CheckCircle2, Clock, AlertTriangle, TrendingUp, Plus, Filter, X } from 'lucide-react';
import BrandTaskCard from './BrandTaskCard';

// ═══════════════════════════════════════════════════════════════
// BRAND TASK VIEW — groups actions by seller
// ═══════════════════════════════════════════════════════════════
const BrandTaskView = ({
  actions = [],
  sellers = [],
  currentUser,
  activeFilter = 'ALL',
  searchQuery = '',
  onEdit,
  onDelete,
  onStart,
  onSubmitForReview,
  onReviewAction,
  onCreateBrandTask,
}) => {
  const [localSearch, setLocalSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const isAdmin = useMemo(() => {
    if (!currentUser) return false;
    const rawRole = currentUser.role?.name || currentUser.role?.Name ||
      (typeof currentUser.role === 'string' ? currentUser.role : '') || '';
    const role = String(rawRole).toLowerCase();
    return ['admin', 'super_admin', 'developer', 'operational_manager', 'manager', 'administrator'].includes(role);
  }, [currentUser]);

  // ── Group actions by seller ──────────────────────────────────
  const brandGroups = useMemo(() => {
    const groups = {};

    actions.forEach(action => {
      // Get seller ID from action
      const sellerId = action.sellerId?._id || action.sellerId?.id ||
        (typeof action.sellerId === 'string' ? action.sellerId : null);

      // Try to find seller in sellers list
      let sellerData = sellers.find(s => {
        const sid = s._id || s.id;
        return sid && sellerId && (sid === sellerId || sid.toString() === sellerId.toString());
      });

      // Fallback: use the populated sellerId object from action if it has name
      if (!sellerData && action.sellerId?.name) {
        sellerData = action.sellerId;
      }

      // Key: use sellerId or "unassigned"
      const key = sellerId || 'unassigned';
      const sellerLabel = sellerData?.name || sellerData?.sellerName || action.sellerId?.name || 'Unassigned Brand';

      if (!groups[key]) {
        groups[key] = {
          sellerId: key,
          seller: sellerData || (action.sellerId?.name ? action.sellerId : { name: sellerLabel, _id: key }),
          actions: []
        };
      }
      groups[key].actions.push(action);
    });

    return Object.values(groups);
  }, [actions, sellers]);

  // ── Apply filters ────────────────────────────────────────────
  const filteredGroups = useMemo(() => {
    const q = (localSearch || searchQuery || '').toLowerCase().trim();

    return brandGroups
      .map(group => {
        // Filter actions in group
        let filteredActions = group.actions.filter(action => {
          const status = String(action.status || 'PENDING').toUpperCase();

          // Status filter
          if (statusFilter !== 'ALL' && status !== statusFilter) return false;

          // Active filter from parent
          if (activeFilter !== 'ALL') {
            const now = new Date();
            const dl = action.timeTracking?.deadline;
            if (activeFilter === 'PENDING' && status !== 'PENDING') return false;
            if (activeFilter === 'IN_PROGRESS' && status !== 'IN_PROGRESS') return false;
            if (activeFilter === 'REVIEW' && status !== 'REVIEW') return false;
            if (activeFilter === 'COMPLETED' && status !== 'COMPLETED') return false;
            if (activeFilter === 'REJECTED' && status !== 'REJECTED') return false;
            if (activeFilter === 'OVERDUE' && !(dl && new Date(dl) < now && status !== 'COMPLETED')) return false;
            if (activeFilter === 'TODO' && status === 'COMPLETED') return false;
          }

          return true;
        });

        // Search by brand name or task title or ASIN
        if (q) {
          const sellerName = (group.seller?.name || '').toLowerCase();
          const sellerMatch = sellerName.includes(q);

          if (!sellerMatch) {
            filteredActions = filteredActions.filter(action => {
              const titleMatch = (action.title || '').toLowerCase().includes(q);
              const asinMatch = (action.asins || []).some(asin => {
                const code = asin.asinCode || asin.asin || String(asin);
                return code.toLowerCase().includes(q);
              });
              return titleMatch || asinMatch;
            });
          }
        }

        if (filteredActions.length === 0) return null;
        return { ...group, actions: filteredActions };
      })
      .filter(Boolean)
      .sort((a, b) => {
        // Sort by: overdue > pending > in_progress > completed
        const getScore = (g) => {
          const hasOverdue = g.actions.some(a => {
            const dl = a.timeTracking?.deadline;
            return dl && new Date(dl) < new Date() && String(a.status || '').toUpperCase() !== 'COMPLETED';
          });
          const allDone = g.actions.every(a => String(a.status || '').toUpperCase() === 'COMPLETED');
          if (hasOverdue) return 0;
          if (allDone) return 2;
          return 1;
        };
        return getScore(a) - getScore(b);
      });
  }, [brandGroups, localSearch, searchQuery, activeFilter, statusFilter]);

  // ── Aggregate stats ─────────────────────────────────────────
  const stats = useMemo(() => {
    const totalBrands = filteredGroups.length;
    const totalTasks = filteredGroups.reduce((s, g) => s + g.actions.length, 0);
    const totalAsins = filteredGroups.reduce((s, g) =>
      s + g.actions.reduce((as, a) => as + (a.asins?.length || 0), 0), 0);
    const completedTasks = filteredGroups.reduce((s, g) =>
      s + g.actions.filter(a => String(a.status || '').toUpperCase() === 'COMPLETED').length, 0);
    const overdueTasks = filteredGroups.reduce((s, g) =>
      s + g.actions.filter(a => {
        const dl = a.timeTracking?.deadline;
        return dl && new Date(dl) < new Date() && String(a.status || '').toUpperCase() !== 'COMPLETED';
      }).length, 0);
    return { totalBrands, totalTasks, totalAsins, completedTasks, overdueTasks };
  }, [filteredGroups]);

  const STATUS_PILLS = [
    { key: 'ALL', label: 'All Tasks', color: '#1976D2' },
    { key: 'PENDING', label: 'Pending', color: '#ED6C02' },
    { key: 'IN_PROGRESS', label: 'In Progress', color: '#0288D1' },
    { key: 'REVIEW', label: 'Review', color: '#9C27B0' },
    { key: 'COMPLETED', label: 'Completed', color: '#2E7D32' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── Stats summary bar ── */}
      <div style={{
        display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20,
        padding: '14px 0', borderBottom: '1px solid #f1f5f9'
      }}>
        {[
          { icon: Building2, label: 'Brands', value: stats.totalBrands, color: '#1976D2' },
          { icon: CheckCircle2, label: 'Tasks', value: stats.totalTasks, color: '#0288D1' },
          { icon: Package, label: 'ASINs', value: stats.totalAsins, color: '#9C27B0' },
          { icon: TrendingUp, label: 'Completed', value: stats.completedTasks, color: '#2E7D32' },
          ...(stats.overdueTasks > 0 ? [{ icon: AlertTriangle, label: 'Overdue', value: stats.overdueTasks, color: '#D32F2F' }] : []),
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#ffffff', border: '1px solid #e2e8f0',
            borderRadius: 10, padding: '8px 14px',
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: `${color}12`, display: 'flex', alignItems: 'center',
              justifyContent: 'center', color, flexShrink: 0
            }}>
              <Icon size={14} strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
            </div>
          </div>
        ))}

        {/* Create brand task button */}
        {onCreateBrandTask && (
          <button
            onClick={onCreateBrandTask}
            style={{
              marginLeft: 'auto',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 16px',
              background: 'linear-gradient(135deg, #1976D2 0%, #1976D2 100%)',
              color: '#ffffff', border: 'none', borderRadius: 10,
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 4px 12px -2px rgba(99,102,241,0.4)',
              transition: 'all 0.2s',
              alignSelf: 'center'
            }}
          >
            <Plus size={14} strokeWidth={2.5} />
            New Brand Task
          </button>
        )}
      </div>

      {/* ── Search + Status filter ── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 300 }}>
          <Search size={13} style={{
            position: 'absolute', left: 10, top: '50%',
            transform: 'translateY(-50%)', color: '#94a3b8'
          }} />
          <input
            value={localSearch}
            onChange={e => setLocalSearch(e.target.value)}
            placeholder="Search brand or ASIN..."
            style={{
              width: '100%', padding: '7px 10px 7px 30px',
              fontSize: 12, fontWeight: 600, borderRadius: 10,
              border: '1.5px solid #e2e8f0', background: '#ffffff',
              outline: 'none', color: '#0f172a', boxSizing: 'border-box'
            }}
            onFocus={e => e.target.style.borderColor = '#1976D2'}
            onBlur={e => e.target.style.borderColor = '#e2e8f0'}
          />
          {localSearch && (
            <button
              onClick={() => setLocalSearch('')}
              style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: '#f1f5f9', border: 'none', width: 18, height: 18,
                borderRadius: '50%', display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', color: '#64748b'
              }}
            >
              <X size={10} />
            </button>
          )}
        </div>

        {/* Status pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <Filter size={12} color="#94a3b8" />
          {STATUS_PILLS.map(pill => (
            <button
              key={pill.key}
              onClick={() => setStatusFilter(pill.key)}
              style={{
                padding: '5px 12px',
                borderRadius: 16,
                border: `1.5px solid ${statusFilter === pill.key ? pill.color : '#e2e8f0'}`,
                background: statusFilter === pill.key ? `${pill.color}10` : '#ffffff',
                color: statusFilter === pill.key ? pill.color : '#64748b',
                fontSize: 10, fontWeight: 700, cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: statusFilter === pill.key ? `0 4px 10px -2px ${pill.color}30` : 'none'
              }}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Brand cards ── */}
      {filteredGroups.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '80px 20px', gap: 16
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'linear-gradient(135deg, #eef2ff 0%, #ddd6fe 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #c7d2fe'
          }}>
            <Building2 size={32} color="#1976D2" strokeWidth={1.5} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
              No Brand Tasks Found
            </div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20, maxWidth: 320 }}>
              {actions.length === 0
                ? 'Create your first brand-level optimization task to get started.'
                : 'No tasks match the current filters. Try adjusting your search or filter.'}
            </div>
            {onCreateBrandTask && actions.length === 0 && (
              <button
                onClick={onCreateBrandTask}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '10px 20px',
                  background: 'linear-gradient(135deg, #1976D2 0%, #1976D2 100%)',
                  color: '#ffffff', border: 'none', borderRadius: 12,
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 4px 12px -2px rgba(99,102,241,0.4)'
                }}
              >
                <Plus size={16} strokeWidth={2.5} />
                Create Brand Task
              </button>
            )}
          </div>
        </div>
      ) : (
        <div>
          {filteredGroups.map((group, idx) => (
            <BrandTaskCard
              key={group.sellerId}
              seller={group.seller}
              actions={group.actions}
              currentUser={currentUser}
              isAdmin={isAdmin}
              index={idx}
              onEdit={onEdit}
              onDelete={onDelete}
              onStart={onStart}
              onSubmitForReview={onSubmitForReview}
              onReviewAction={onReviewAction}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default BrandTaskView;
