import React, { useState, useMemo } from 'react';
import {
  ChevronDown, ChevronRight, Package, CheckCircle2,
  Clock, AlertTriangle, Users, TrendingUp, Sparkles,
  Edit2, Trash2, Play, Eye, MoreHorizontal, Building2,
  Tag, FileText, Image, List, Star, Target, Zap
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// OPTIMIZATION TYPE CONFIG
// ═══════════════════════════════════════════════════════════════
const OPT_TYPES = {
  TITLE_OPTIMIZATION: {
    label: 'Title Optimization',
    shortLabel: 'Title',
    icon: Tag,
    color: '#0288D1',
    bg: '#eff6ff',
    border: '#bfdbfe',
    emoji: '✏️'
  },
  A_PLUS_CONTENT: {
    label: 'A+ Content',
    shortLabel: 'A+',
    icon: Star,
    color: '#9C27B0',
    bg: '#f5f3ff',
    border: '#ddd6fe',
    emoji: '⭐'
  },
  IMAGE_OPTIMIZATION: {
    label: 'Image Optimization',
    shortLabel: 'Images',
    icon: Image,
    color: '#2E7D32',
    bg: '#ecfdf5',
    border: '#a7f3d0',
    emoji: '🖼️'
  },
  BULLET_POINTS: {
    label: 'Bullet Points',
    shortLabel: 'Bullets',
    icon: List,
    color: '#ED6C02',
    bg: '#fffbeb',
    border: '#fde68a',
    emoji: '📋'
  },
  DESCRIPTION_OPTIMIZATION: {
    label: 'Description',
    shortLabel: 'Desc',
    icon: FileText,
    color: '#0288D1',
    bg: '#ecfeff',
    border: '#a5f3fc',
    emoji: '📝'
  },
  GENERAL_OPTIMIZATION: {
    label: 'General',
    shortLabel: 'General',
    icon: Zap,
    color: '#64748b',
    bg: '#f8fafc',
    border: '#e2e8f0',
    emoji: '⚡'
  }
};

const getOptConfig = (type) => OPT_TYPES[type] || OPT_TYPES.GENERAL_OPTIMIZATION;

// ═══════════════════════════════════════════════════════════════
// STATUS HELPERS
// ═══════════════════════════════════════════════════════════════
const STATUS_CONFIG = {
  PENDING: { label: 'Pending', color: '#ED6C02', bg: '#fffbeb', border: '#fde68a' },
  IN_PROGRESS: { label: 'In Progress', color: '#0288D1', bg: '#eff6ff', border: '#bfdbfe' },
  REVIEW: { label: 'In Review', color: '#9C27B0', bg: '#f5f3ff', border: '#ddd6fe' },
  COMPLETED: { label: 'Completed', color: '#2E7D32', bg: '#ecfdf5', border: '#a7f3d0' },
  REJECTED: { label: 'Rejected', color: '#D32F2F', bg: '#fef2f2', border: '#fecaca' }
};

const getStatusConfig = (status) =>
  STATUS_CONFIG[String(status || 'PENDING').toUpperCase()] || STATUS_CONFIG.PENDING;

// ═══════════════════════════════════════════════════════════════
// CIRCULAR PROGRESS RING
// ═══════════════════════════════════════════════════════════════
const ProgressRing = ({ pct = 0, size = 56, color = '#1976D2' }) => {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={4} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={4}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle"
        fontSize={size < 50 ? 9 : 11} fontWeight="800" fill={color}>
        {Math.round(pct)}%
      </text>
    </svg>
  );
};

// ═══════════════════════════════════════════════════════════════
// ASIN DETAIL TABLE  
// ═══════════════════════════════════════════════════════════════
const AsinDetailTable = ({ action, config }) => {
  const asins = action.asins || [];
  if (asins.length === 0) return (
    <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
      No ASINs attached to this task
    </div>
  );

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: config.bg, borderBottom: `1px solid ${config.border}` }}>
            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: config.color, width: '15%' }}>ASIN</th>
            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#475569', width: '40%' }}>Product Title</th>
            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#475569' }}>SKU</th>
            <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, color: '#475569' }}>Issue</th>
          </tr>
        </thead>
        <tbody>
          {asins.map((asin, i) => {
            const code = asin.asinCode || asin.asin || asin;
            const title = asin.title || asin.productTitle || '—';
            const sku = asin.sku || asin.SKU || '—';
            return (
              <tr key={i} style={{
                borderBottom: '1px solid #f1f5f9',
                background: i % 2 === 0 ? '#ffffff' : '#fafbfc',
                transition: 'background 0.15s'
              }}
                onMouseEnter={e => e.currentTarget.style.background = config.bg}
                onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#ffffff' : '#fafbfc'}
              >
                <td style={{ padding: '8px 12px' }}>
                  <code style={{
                    background: config.bg, border: `1px solid ${config.border}`,
                    color: config.color, padding: '2px 7px', borderRadius: 6,
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.04em'
                  }}>{typeof code === 'string' ? code : JSON.stringify(code)}</code>
                </td>
                <td style={{ padding: '8px 12px', color: '#374151', maxWidth: 280 }}>
                  <span style={{
                    display: 'inline-block', maxWidth: '100%',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                  }} title={title}>{title}</span>
                </td>
                <td style={{ padding: '8px 12px', color: '#64748b', fontFamily: 'monospace' }}>{sku}</td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    background: '#fef2f2', border: '1px solid #fecaca',
                    color: '#D32F2F', fontSize: 10, fontWeight: 700,
                    padding: '2px 8px', borderRadius: 10
                  }}>
                    <AlertTriangle size={9} />
                    Needs {config.shortLabel}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// OPTIMIZATION ROW (per category)
// ═══════════════════════════════════════════════════════════════
const OptimizationRow = ({ action, config, onEdit, onDelete, onStart, onSubmitForReview, onReview, currentUser, isAdmin }) => {
  const [expanded, setExpanded] = useState(false);
  const status = String(action.status || 'PENDING').toUpperCase();
  const statusCfg = getStatusConfig(status);
  const asinCount = (action.asins || []).length;
  const TypeIcon = config.icon;

  const canEdit = isAdmin || (currentUser?._id || currentUser?.id) === (action.assignedTo?._id || action.assignedTo);
  const isStarted = action.timeTracking?.startedAt && !action.timeTracking?.completedAt;
  const isCompleted = action.timeTracking?.completedAt || status === 'COMPLETED';

  return (
    <div style={{ borderBottom: '1px solid #f1f5f9' }}>
      {/* Row header */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 16px', cursor: 'pointer',
          transition: 'background 0.15s',
          background: expanded ? config.bg : 'transparent'
        }}
        onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = '#f8fafc'; }}
        onMouseLeave={e => { if (!expanded) e.currentTarget.style.background = 'transparent'; }}
        onClick={() => setExpanded(v => !v)}
      >
        {/* Expand chevron */}
        <span style={{ color: '#94a3b8', flexShrink: 0, transition: 'transform 0.2s', transform: expanded ? 'rotate(90deg)' : 'none' }}>
          <ChevronRight size={14} />
        </span>

        {/* Type icon & label */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7,
          minWidth: 170, flexShrink: 0
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: config.bg, border: `1px solid ${config.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: config.color, flexShrink: 0
          }}>
            <TypeIcon size={14} strokeWidth={2.5} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{config.label}</span>
        </div>

        {/* Progress bar */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, height: 6, background: '#f1f5f9', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: isCompleted ? '100%' : status === 'IN_PROGRESS' ? '50%' : '0%',
              background: isCompleted ? '#2E7D32' : config.color,
              borderRadius: 10, transition: 'width 0.6s ease'
            }} />
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap' }}>
            {isCompleted ? '100%' : status === 'IN_PROGRESS' ? '50%' : '0%'}
          </span>
        </div>

        {/* ASIN count */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          background: '#f1f5f9', border: '1px solid #e2e8f0',
          borderRadius: 10, padding: '3px 10px', flexShrink: 0
        }}>
          <Package size={11} color="#64748b" />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>
            {asinCount} ASIN{asinCount !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Status badge */}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          background: statusCfg.bg, border: `1px solid ${statusCfg.border}`,
          color: statusCfg.color, fontSize: 10, fontWeight: 700,
          padding: '3px 10px', borderRadius: 10, flexShrink: 0,
          minWidth: 90, justifyContent: 'center'
        }}>
          {statusCfg.label}
        </span>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          {!isCompleted && !isStarted && status !== 'REVIEW' && canEdit && (
            <button
              onClick={() => onStart && onStart(action)}
              title="Start Task"
              style={{ padding: '4px 8px', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#0288D1', borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <Play size={10} fill="currentColor" /> Start
            </button>
          )}
          {isStarted && status === 'IN_PROGRESS' && canEdit && (
            <button
              onClick={() => onSubmitForReview && onSubmitForReview(action)}
              title="Submit for Review"
              style={{ padding: '4px 8px', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#2E7D32', borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <CheckCircle2 size={10} /> Submit
            </button>
          )}
          {status === 'REVIEW' && isAdmin && (
            <button
              onClick={() => onReview && onReview(action)}
              style={{ padding: '4px 8px', background: '#f5f3ff', border: '1px solid #ddd6fe', color: '#9C27B0', borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}
            >
              Review
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => onEdit && onEdit(action, 'ACTION')}
              title="Edit"
              style={{ padding: '5px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', borderRadius: 7, cursor: 'pointer', display: 'flex' }}
            >
              <Edit2 size={11} />
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => onDelete && onDelete(action._id || action.id, 'ACTION')}
              title="Delete"
              style={{ padding: '5px', background: '#fef2f2', border: '1px solid #fecaca', color: '#D32F2F', borderRadius: 7, cursor: 'pointer', display: 'flex' }}
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Expanded ASIN table */}
      {expanded && (
        <div style={{
          borderTop: `2px solid ${config.border}`,
          background: '#fafbfc',
          animation: 'slideDown 0.2s ease'
        }}>
          <AsinDetailTable action={action} config={config} />
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MAIN BRAND TASK CARD
// ═══════════════════════════════════════════════════════════════
const BrandTaskCard = ({
  seller,
  actions = [],
  currentUser,
  isAdmin,
  onEdit,
  onDelete,
  onStart,
  onSubmitForReview,
  onReviewAction,
  index = 0
}) => {
  const [expanded, setExpanded] = useState(true);

  // Compute aggregate stats
  const stats = useMemo(() => {
    const total = actions.length;
    const completed = actions.filter(a => {
      const s = String(a.status || 'PENDING').toUpperCase();
      return s === 'COMPLETED';
    }).length;
    const inProgress = actions.filter(a => String(a.status || '').toUpperCase() === 'IN_PROGRESS').length;
    const inReview = actions.filter(a => String(a.status || '').toUpperCase() === 'REVIEW').length;
    const pending = total - completed - inProgress - inReview;
    const totalAsins = actions.reduce((sum, a) => sum + (a.asins?.length || 0), 0);
    const completedAsins = actions
      .filter(a => String(a.status || '').toUpperCase() === 'COMPLETED')
      .reduce((sum, a) => sum + (a.asins?.length || 0), 0);
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    const hasOverdue = actions.some(a => {
      const dl = a.timeTracking?.deadline;
      return dl && new Date(dl) < new Date() && String(a.status || '').toUpperCase() !== 'COMPLETED';
    });
    return { total, completed, inProgress, inReview, pending, totalAsins, completedAsins, pct, hasOverdue };
  }, [actions]);

  const sellerName = seller?.name || seller?.sellerName || 'Unknown Brand';
  const marketplace = seller?.marketplace || seller?.Marketplace || '';

  // Sort: pending/overdue first, completed last
  const sortedActions = useMemo(() => {
    const order = { PENDING: 0, IN_PROGRESS: 1, REVIEW: 2, COMPLETED: 3, REJECTED: 4 };
    return [...actions].sort((a, b) => {
      const sa = String(a.status || 'PENDING').toUpperCase();
      const sb = String(b.status || 'PENDING').toUpperCase();
      return (order[sa] ?? 99) - (order[sb] ?? 99);
    });
  }, [actions]);

  const cardColor = stats.pct >= 100 ? '#2E7D32' : stats.hasOverdue ? '#D32F2F' : '#1976D2';
  const gradientStart = stats.pct >= 100 ? '#ecfdf5' : stats.hasOverdue ? '#fef2f2' : '#f5f3ff';
  const gradientEnd = stats.pct >= 100 ? '#d1fae5' : stats.hasOverdue ? '#fee2e2' : '#ede9fe';

  return (
    <div style={{
      background: '#ffffff',
      borderRadius: 16,
      border: `1.5px solid ${stats.hasOverdue ? '#fecaca' : '#e2e8f0'}`,
      boxShadow: '0 2px 12px -4px rgba(0,0,0,0.08)',
      overflow: 'hidden',
      marginBottom: 16,
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      animation: `fadeSlideUp 0.3s ease ${index * 0.05}s both`
    }}>

      {/* ── CARD HEADER ── */}
      <div
        onClick={() => setExpanded(v => !v)}
        style={{
          background: `linear-gradient(135deg, ${gradientStart} 0%, ${gradientEnd} 100%)`,
          borderBottom: expanded ? `1px solid ${stats.hasOverdue ? '#fecaca' : '#e8e4fd'}` : 'none',
          padding: '16px 20px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          userSelect: 'none',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Decorative circle */}
        <div style={{
          position: 'absolute', top: -30, right: -30,
          width: 100, height: 100,
          background: `${cardColor}08`,
          borderRadius: '50%', pointerEvents: 'none'
        }} />

        {/* Progress ring */}
        <ProgressRing pct={stats.pct} size={56} color={cardColor} />

        {/* Brand info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: `${cardColor}15`, border: `1px solid ${cardColor}30`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: cardColor, flexShrink: 0
            }}>
              <Building2 size={14} strokeWidth={2.5} />
            </div>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>
              {sellerName}
            </span>
            {stats.hasOverdue && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: '#fef2f2', border: '1px solid #fecaca',
                color: '#D32F2F', fontSize: 9, fontWeight: 800,
                padding: '2px 7px', borderRadius: 10, textTransform: 'uppercase', letterSpacing: '0.05em'
              }}>
                <AlertTriangle size={9} /> Overdue
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            {marketplace && (
              <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                {marketplace}
              </span>
            )}
            {seller?.managers?.length > 0 && (
              <span style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Users size={11} />
                {seller.managers.map(m => `${m.firstName || ''} ${m.lastName || ''}`.trim()).filter(Boolean).join(', ')}
              </span>
            )}
          </div>
        </div>

        {/* Stats pills */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
          <div style={{
            background: '#ffffff', border: '1.5px solid #e2e8f0',
            borderRadius: 10, padding: '6px 12px', textAlign: 'center', minWidth: 60
          }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{stats.total}</div>
            <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>Tasks</div>
          </div>

          <div style={{
            background: '#ffffff', border: '1.5px solid #e2e8f0',
            borderRadius: 10, padding: '6px 12px', textAlign: 'center', minWidth: 60
          }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1976D2', lineHeight: 1 }}>{stats.totalAsins}</div>
            <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>ASINs</div>
          </div>

          {stats.inProgress > 0 && (
            <div style={{
              background: '#eff6ff', border: '1.5px solid #bfdbfe',
              borderRadius: 10, padding: '6px 12px', textAlign: 'center', minWidth: 60
            }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#0288D1', lineHeight: 1 }}>{stats.inProgress}</div>
              <div style={{ fontSize: 9, color: '#93c5fd', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>Active</div>
            </div>
          )}

          {stats.completed > 0 && (
            <div style={{
              background: '#ecfdf5', border: '1.5px solid #a7f3d0',
              borderRadius: 10, padding: '6px 12px', textAlign: 'center', minWidth: 60
            }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#2E7D32', lineHeight: 1 }}>{stats.completed}</div>
              <div style={{ fontSize: 9, color: '#6ee7b7', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>Done</div>
            </div>
          )}
        </div>

        {/* Expand chevron */}
        <span style={{
          color: '#94a3b8', transition: 'transform 0.25s', flexShrink: 0,
          transform: expanded ? 'rotate(180deg)' : 'none'
        }}>
          <ChevronDown size={18} />
        </span>
      </div>

      {/* ── OPTIMIZATION ROWS ── */}
      {expanded && (
        <div>
          {/* Category summary bar */}
          <div style={{
            display: 'flex', gap: 6, padding: '10px 20px',
            background: '#fafbfc', borderBottom: '1px solid #f1f5f9',
            flexWrap: 'wrap'
          }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', alignSelf: 'center', marginRight: 4 }}>
              Categories:
            </span>
            {sortedActions.map(action => {
              const cfg = getOptConfig(action.type);
              const s = String(action.status || 'PENDING').toUpperCase();
              return (
                <span key={action._id || action.id} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: cfg.bg, border: `1px solid ${cfg.border}`,
                  color: cfg.color, fontSize: 10, fontWeight: 700,
                  padding: '3px 9px', borderRadius: 10
                }}>
                  <cfg.icon size={9} strokeWidth={2.5} />
                  {cfg.shortLabel}
                  {s === 'COMPLETED' && <CheckCircle2 size={9} />}
                </span>
              );
            })}
          </div>

          {/* Optimization type rows */}
          {sortedActions.map(action => {
            const cfg = getOptConfig(action.type);
            return (
              <OptimizationRow
                key={action._id || action.id}
                action={action}
                config={cfg}
                currentUser={currentUser}
                isAdmin={isAdmin}
                onEdit={onEdit}
                onDelete={onDelete}
                onStart={onStart}
                onSubmitForReview={onSubmitForReview}
                onReview={onReviewAction}
              />
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideDown {
          from { opacity: 0; max-height: 0; }
          to { opacity: 1; max-height: 600px; }
        }
      `}</style>
    </div>
  );
};

export { OPT_TYPES, getOptConfig };
export default BrandTaskCard;
