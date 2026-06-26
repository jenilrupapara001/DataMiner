/**
 * WorkflowActionButton — Renders the single correct action button
 * for a task based on its current status and the current user role.
 *
 * This component is fully automatic — it reads task.status and
 * currentUser.role to decide what to render. No manual prop passing
 * of which button to show.
 */

import React from 'react';
import {
  Button, Space, Tag, Tooltip, Badge, Popconfirm,
} from 'antd';
import {
  PlayCircleOutlined, SendOutlined, CheckOutlined,
  CloseOutlined, CheckCircleOutlined, CloseCircleOutlined,
  SyncOutlined, EyeOutlined, ExclamationCircleOutlined,
  ReloadOutlined, LoadingOutlined,
} from '@ant-design/icons';
import { canDoTransition, getDisplayStatus, getRejectionCount, getLastRejection, hasEverBeenStarted } from '../../services/workflowEngine';

// ─── STATUS COLOUR MAP ────────────────────────────────────────────────────────
const STATUS_STYLE = {
  PENDING:     { color: '#64748b', bg: '#f1f5f9', border: '#e2e8f0' },
  IN_PROGRESS: { color: '#1976D2', bg: '#eef2ff', border: '#c7d2fe' },
  REVIEW:      { color: '#9C27B0', bg: '#f5f3ff', border: '#ddd6fe' },
  COMPLETED:   { color: '#2E7D32', bg: '#ecfdf5', border: '#a7f3d0' },
  REJECTED:    { color: '#e11d48', bg: '#fff1f2', border: '#fecdd3' },
  OVERDUE:     { color: '#C62828', bg: '#fef2f2', border: '#fecaca' },
};

// ─── SHARED BUTTON STYLE ──────────────────────────────────────────────────────
const btnStyle = (bg, size) => ({
  background:    bg,
  border:        'none',
  color:         'white',
  fontWeight:    600,
  fontSize:      size === 'small' ? 11 : 13,
  height:        size === 'small' ? 28 : 34,
  borderRadius:  8,
  display:       'inline-flex',
  alignItems:    'center',
  gap:           5,
  boxShadow:     `0 2px 6px ${bg}50`,
  transition:    'all 0.15s ease',
});

// ─── STATUS PILL (for terminal / non-actionable states) ───────────────────────
const StatusPill = ({ status, size, extra }) => {
  const cfg  = STATUS_STYLE[status] || STATUS_STYLE.PENDING;
  const meta = {
    PENDING:     { icon: null,                      label: 'Pending'     },
    IN_PROGRESS: { icon: <SyncOutlined spin />,     label: 'In Progress' },
    REVIEW:      { icon: <EyeOutlined />,            label: 'In Review'   },
    COMPLETED:   { icon: <CheckCircleOutlined />,    label: 'Completed'   },
    REJECTED:    { icon: <CloseCircleOutlined />,    label: 'Rejected'    },
    OVERDUE:     { icon: <ExclamationCircleOutlined />, label: 'Overdue'  },
  };
  const { icon, label } = meta[status] || { icon: null, label: status };

  return (
    <Space size={4} orientation="vertical" style={{ lineHeight: 1 }}>
      <Tag
        icon={icon}
        style={{
          background:   cfg.bg,
          color:        cfg.color,
          border:       `1px solid ${cfg.border}`,
          borderRadius: 20,
          fontWeight:   600,
          fontSize:     size === 'small' ? 10 : 11,
          padding:      size === 'small' ? '0 7px' : '1px 9px',
          display:      'inline-flex',
          alignItems:   'center',
          gap:          4,
        }}
      >
        {status === 'IN_PROGRESS' && (
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#1976D2',
            animation: 'wfPulse 1.5s ease infinite',
            display: 'inline-block',
          }} />
        )}
        {label}
      </Tag>
      {extra}
    </Space>
  );
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
const WorkflowActionButton = ({
  task,
  currentUser,
  onStart,
  onSubmit,
  onApprove,
  onReject,
  onReopen,
  size       = 'small',
  showStatus = false,    // show status pill alongside action button
  isLoading  = false,
}) => {
  if (!task) return null;

  const displayStatus = getDisplayStatus(task);
  const rejectionCount = getRejectionCount(task);
  const lastRejection  = getLastRejection(task);
  const everStarted    = hasEverBeenStarted(task);

  const can = (key) => canDoTransition(currentUser, task, key);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Button
        size="small"
        disabled
        style={{
          height: size === 'small' ? 28 : 34,
          borderRadius: 8,
          fontSize: size === 'small' ? 11 : 13,
        }}
        icon={<LoadingOutlined />}
      >
        Updating...
      </Button>
    );
  }

  // ── PENDING / TODO + NEVER STARTED → Start Task ────────────────────────────
  if (['PENDING', 'TODO'].includes(displayStatus) && !everStarted) {
    if (!can('START')) {
      return showStatus
        ? <StatusPill status="PENDING" size={size} />
        : null;
    }
    return (
      <Space orientation="vertical" size={3}>
        {showStatus && <StatusPill status="PENDING" size={size} />}
        <Button
          size={size}
          icon={<PlayCircleOutlined />}
          style={btnStyle('#1976D2', size)}
          onClick={() => onStart?.(task)}
        >
          Start Task
        </Button>
      </Space>
    );
  }

  // ── IN_PROGRESS / OVERDUE or PENDING (if ever started) → Submit for Review ──
  if (
    ['IN_PROGRESS', 'OVERDUE'].includes(displayStatus) ||
    (displayStatus === 'PENDING' && everStarted)
  ) {
    const isOverdueTask = displayStatus === 'OVERDUE';

    // Show rejection context if task was previously rejected
    const rejectionContext = rejectionCount > 0 && lastRejection ? (
      <Tooltip
        title={
          <div>
            <div style={{ fontWeight: 700, marginBottom: 4, color: '#fca5a5' }}>
              Rejected {rejectionCount} time{rejectionCount > 1 ? 's' : ''}
            </div>
            <div style={{ fontSize: 11 }}>
              Reason: {lastRejection.reason || 'No reason provided'}
            </div>
          </div>
        }
        placement="top"
      >
        <Tag
          style={{
            fontSize: 10, borderRadius: 12, cursor: 'help',
            background: '#fef2f2', color: '#e11d48',
            border: '1px solid #fecdd3', padding: '0 6px',
          }}
        >
          <ExclamationCircleOutlined style={{ marginRight: 3 }} />
          {rejectionCount}x rejected
        </Tag>
      </Tooltip>
    ) : null;

    if (!can('SUBMIT_REVIEW')) {
      return (
        <Space orientation="vertical" size={3}>
          <StatusPill
            status={isOverdueTask ? 'OVERDUE' : 'IN_PROGRESS'}
            size={size}
            extra={rejectionContext}
          />
        </Space>
      );
    }

    return (
      <Space orientation="vertical" size={3}>
        {showStatus && (
          <StatusPill
            status={isOverdueTask ? 'OVERDUE' : 'IN_PROGRESS'}
            size={size}
            extra={rejectionContext}
          />
        )}
        {rejectionContext && !showStatus && rejectionContext}
        <Button
          size={size}
          icon={<SendOutlined />}
          style={btnStyle('#9C27B0', size)}
          onClick={() => onSubmit?.(task)}
        >
          Submit for Review
        </Button>
      </Space>
    );
  }

  // ── REVIEW → Approve / Reject ──────────────────────────────────────────────
  if (displayStatus === 'REVIEW') {
    const canAct = can('APPROVE') || can('REJECT');

    if (!canAct) {
      // Assignee or non-reviewer sees "Awaiting Review" pill
      return (
        <Space orientation="vertical" size={3}>
          <Tag
            icon={<EyeOutlined />}
            style={{
              background: '#f5f3ff', color: '#9C27B0',
              border: '1px solid #ddd6fe', borderRadius: 20,
              fontWeight: 600, fontSize: size === 'small' ? 10 : 11,
              padding: size === 'small' ? '0 7px' : '1px 9px',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}
          >
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#9C27B0',
              animation: 'wfPulse 1.5s ease infinite',
              display: 'inline-block',
            }} />
            Awaiting Review
          </Tag>
        </Space>
      );
    }

    return (
      <Space orientation="vertical" size={3}>
        {showStatus && <StatusPill status="REVIEW" size={size} />}
        <Space size={4}>
          <Tooltip title="Approve — mark this task complete">
            <Button
              size={size}
              icon={<CheckOutlined />}
              style={btnStyle('#2E7D32', size)}
              onClick={() => onApprove?.(task)}
            >
              Approve
            </Button>
          </Tooltip>
          <Tooltip title="Reject — send back for rework">
            <Button
              size={size}
              icon={<CloseOutlined />}
              style={btnStyle('#D32F2F', size)}
              onClick={() => onReject?.(task)}
            >
              Reject
            </Button>
          </Tooltip>
        </Space>
      </Space>
    );
  }

  // ── COMPLETED ──────────────────────────────────────────────────────────────
  if (displayStatus === 'COMPLETED') {
    const canReopenTask = can('REOPEN');
    return (
      <Space orientation="vertical" size={3}>
        <StatusPill status="COMPLETED" size={size} />
        {canReopenTask && (
          <Popconfirm
            title="Reopen this task?"
            description="It will move back to In Progress."
            onConfirm={() => onReopen?.(task)}
            okText="Reopen"
            cancelText="Cancel"
            okButtonProps={{ danger: false, style: { background: '#1976D2', border: 'none' } }}
          >
            <Button
              type="link"
              size="small"
              icon={<ReloadOutlined />}
              style={{ fontSize: 10, color: '#94a3b8', height: 18, padding: 0 }}
            >
              Reopen
            </Button>
          </Popconfirm>
        )}
      </Space>
    );
  }

  // ── REJECTED (terminal) ────────────────────────────────────────────────────
  if (displayStatus === 'REJECTED') {
    return <StatusPill status="REJECTED" size={size} />;
  }

  // ── Fallback ───────────────────────────────────────────────────────────────
  return <StatusPill status={displayStatus} size={size} />;
};

export default WorkflowActionButton;
