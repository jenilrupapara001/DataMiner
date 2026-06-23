import React from 'react';
import { Button, Space } from 'antd';
import {
  ThunderboltOutlined, BellOutlined,
  EyeOutlined, ExclamationCircleOutlined
} from '@ant-design/icons';
import { formatUserName, formatRelativeTime } from './workflowHelpers';

const WorkflowNotification = ({ task, currentUser, onAction }) => {
  if (!task || !currentUser) return null;

  const currentStatus = (task.status || 'PENDING').toUpperCase();
  const userId = currentUser._id || currentUser.id;
  const role = (currentUser.role?.name || currentUser.role || '').toLowerCase();
  const isAdmin = ['admin', 'superadmin'].includes(role);

  const isAssignee = task.assignedTo && (
    Array.isArray(task.assignedTo)
      ? task.assignedTo.some(u => (u._id || u.id || u) === userId)
      : (task.assignedTo._id || task.assignedTo.id || task.assignedTo) === userId
  );

  const isReviewer = task.reviewer && (
    (task.reviewer._id || task.reviewer.id || task.reviewer) === userId
  );

  const assigneeName = Array.isArray(task.assignedTo)
    ? task.assignedTo.map(u => formatUserName(u)).join(', ')
    : formatUserName(task.assignedTo);
  const reviewerName = formatUserName(task.reviewer);

  // Common banner layout wrapper
  const bannerContainerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 8,
    padding: '10px 14px',
    marginBottom: 16,
    transition: 'all 0.3s ease',
  };

  // Case 1: Task in progress, user is assignee -> Submit for review banner
  if (currentStatus === 'IN_PROGRESS' && isAssignee) {
    return (
      <div style={{ ...bannerContainerStyle, background: '#fffbeb', border: '1px solid #fde68a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ThunderboltOutlined style={{ color: '#d97706', fontSize: 16 }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 12, color: '#92400e' }}>Ready to submit?</div>
            <div style={{ fontSize: 11, color: '#b45309' }}>Click below when your work is done.</div>
          </div>
        </div>
        <Button
          size="small"
          type="primary"
          style={{ background: '#8b5cf6', borderColor: '#8b5cf6', borderRadius: 6, fontSize: 11, fontWeight: 600 }}
          onClick={() => onAction('SUBMIT', task)}
        >
          Submit for Review
        </Button>
      </div>
    );
  }

  // Case 2: Task is awaiting review, user is reviewer -> Review Now banner with pulse effect
  if (currentStatus === 'REVIEW' && (isReviewer || isAdmin)) {
    const pulseKeyframes = `
      @keyframes pulseGlow {
        0% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.4); }
        70% { box-shadow: 0 0 0 6px rgba(139, 92, 246, 0); }
        100% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0); }
      }
    `;

    return (
      <div style={{
        ...bannerContainerStyle,
        background: '#f5f3ff',
        border: '1px solid #ddd6fe',
        animation: 'pulseGlow 2s infinite'
      }}>
        <style>{pulseKeyframes}</style>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="relative flex h-2 w-2 mr-1" style={{ display: 'inline-flex', alignSelf: 'center' }}>
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
            <BellOutlined style={{ color: '#8b5cf6', fontSize: 16 }} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 12, color: '#5b21b6' }}>This task needs your review.</div>
            <div style={{ fontSize: 11, color: '#7c3aed' }}>
              Submitted {task.timeTracking?.submittedAt ? formatRelativeTime(task.timeTracking.submittedAt) : ''} by {assigneeName}
            </div>
          </div>
        </div>
        <Button
          size="small"
          type="primary"
          style={{ background: '#8b5cf6', borderColor: '#8b5cf6', borderRadius: 6, fontSize: 11, fontWeight: 600 }}
          onClick={() => onAction('REVIEW', task)}
        >
          Review Now
        </Button>
      </div>
    );
  }

  // Case 3: Task is awaiting review, user is assignee -> informative banner
  if (currentStatus === 'REVIEW' && isAssignee) {
    return (
      <div style={{ ...bannerContainerStyle, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <EyeOutlined style={{ color: '#2563eb', fontSize: 16 }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 12, color: '#1e40af' }}>Your submission is being reviewed by {reviewerName}</div>
            <div style={{ fontSize: 11, color: '#3b82f6' }}>
              Submitted {task.timeTracking?.submittedAt ? formatRelativeTime(task.timeTracking.submittedAt) : ''}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Case 4: Task is rejected, user is assignee -> resubmit/feedback banner
  if (currentStatus === 'REJECTED' && isAssignee) {
    const lastRejection = task.rejections && task.rejections.length > 0
      ? task.rejections[task.rejections.length - 1]
      : null;
    const reason = lastRejection?.reason || task.rejection?.reason || 'No comments left';

    return (
      <div style={{ ...bannerContainerStyle, background: '#fef2f2', border: '1px solid #fecaca' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, marginRight: 16 }}>
          <ExclamationCircleOutlined style={{ color: '#dc2626', fontSize: 16 }} />
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontWeight: 600, fontSize: 12, color: '#991b1b' }}>Your submission was rejected</div>
            <div style={{ fontSize: 11, color: '#dc2626', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              Reviewer feedback: "{reason}"
            </div>
          </div>
        </div>
        <Button
          size="small"
          type="primary"
          danger
          style={{ borderRadius: 6, fontSize: 11, fontWeight: 600 }}
          onClick={() => onAction('RESTART', task)}
        >
          View Feedback &amp; Restart
        </Button>
      </div>
    );
  }

  return null;
};

export default WorkflowNotification;
