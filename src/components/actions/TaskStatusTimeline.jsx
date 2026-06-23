import React from 'react';
import { Timeline, Tag } from 'antd';
import {
  CalendarOutlined, PlayCircleOutlined, SendOutlined,
  CloseCircleOutlined, CheckCircleOutlined, LoadingOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { formatUserName, formatRelativeTime } from './workflowHelpers';

dayjs.extend(relativeTime);

const TaskStatusTimeline = ({ task, compact = false }) => {
  if (!task) return null;

  const timelineItems = [];

  const timeTracking = task.timeTracking || {};
  const rejections = task.rejections || [];
  const submission = task.submission || {};

  const createdBy = formatUserName(task.createdBy || task.CreatedBy);
  const assigneeName = Array.isArray(task.assignedTo)
    ? task.assignedTo.map(u => formatUserName(u)).join(', ')
    : formatUserName(task.assignedTo);
  const reviewerName = formatUserName(task.reviewer);

  // 1. Created
  const createdAtVal = task.createdAt || task.CreatedAt;
  if (createdAtVal) {
    timelineItems.push({
      dot: <CalendarOutlined style={{ color: '#94a3b8', fontSize: compact ? 12 : 14 }} />,
      label: 'Created',
      color: 'gray',
      children: (
        <div style={{ fontSize: compact ? 11 : 13 }}>
          <strong style={{ color: '#475569' }}>Created</strong>
          <div style={{ color: '#64748b', fontSize: compact ? 10 : 11 }}>
            {createdBy ? `By ${createdBy}` : ''} • {dayjs(createdAtVal).format('MMM D, YYYY h:mm A')}
          </div>
        </div>
      ),
    });
  }

  // 2. Started
  if (timeTracking.startedAt) {
    timelineItems.push({
      dot: <PlayCircleOutlined style={{ color: '#6366f1', fontSize: compact ? 12 : 14 }} />,
      label: 'Started',
      color: 'blue',
      children: (
        <div style={{ fontSize: compact ? 11 : 13 }}>
          <strong style={{ color: '#3730a3' }}>Started</strong>
          <div style={{ color: '#4f46e5', fontSize: compact ? 10 : 11 }}>
            {assigneeName} started working • {formatRelativeTime(timeTracking.startedAt)}
          </div>
          {!compact && timeTracking.startNote && (
            <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic', background: '#f8fafc', padding: '4px 8px', borderRadius: 4, marginTop: 4, borderLeft: '2px solid #818cf8' }}>
              " {timeTracking.startNote} "
            </div>
          )}
        </div>
      ),
    });
  }

  // 3. Rejections (history if any)
  if (rejections && rejections.length > 0) {
    rejections.forEach((rej, index) => {
      timelineItems.push({
        dot: <CloseCircleOutlined style={{ color: '#ef4444', fontSize: compact ? 12 : 14 }} />,
        label: `Rejected`,
        color: 'red',
        children: (
          <div style={{ fontSize: compact ? 11 : 13 }}>
            <strong style={{ color: '#991b1b' }}>Rejected (#{index + 1})</strong>
            <div style={{ color: '#dc2626', fontSize: compact ? 10 : 11 }}>
              By {formatUserName(rej.rejectedBy)} • {formatRelativeTime(rej.rejectedAt || rej.timestamp)}
            </div>
            {!compact && rej.reason && (
              <div style={{ fontSize: 11, color: '#7f1d1d', background: '#fef2f2', padding: '4px 8px', borderRadius: 4, marginTop: 4, borderLeft: '2px solid #f87171' }}>
                Reason: " {rej.reason} "
              </div>
            )}
          </div>
        ),
      });
    });
  }

  // 4. Submitted for Review
  if (timeTracking.submittedAt) {
    timelineItems.push({
      dot: <SendOutlined style={{ color: '#8b5cf6', fontSize: compact ? 12 : 14 }} />,
      label: 'Submitted',
      color: 'purple',
      children: (
        <div style={{ fontSize: compact ? 11 : 13 }}>
          <strong style={{ color: '#5b21b6' }}>Submitted for Review</strong>
          <div style={{ color: '#7c3aed', fontSize: compact ? 10 : 11 }}>
            {assigneeName} submitted • {formatRelativeTime(timeTracking.submittedAt)}
          </div>
          {!compact && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
              {submission.timeSpent && (
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  Time Spent: <strong>{submission.timeSpent}h</strong>
                </div>
              )}
              {submission.outcome && (
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#64748b' }}>Outcome:</span>
                  <Tag color="success" style={{ fontSize: 10, padding: '0 6px', borderRadius: 4 }}>
                    {submission.outcome}
                  </Tag>
                </div>
              )}
            </div>
          )}
        </div>
      ),
    });
  }

  // 5. Awaiting Review (Active status is REVIEW and pending)
  if (task.status === 'REVIEW') {
    timelineItems.push({
      dot: <LoadingOutlined style={{ color: '#8b5cf6', fontSize: compact ? 12 : 14 }} spin />,
      label: 'Reviewing',
      color: 'purple',
      children: (
        <div style={{ fontSize: compact ? 11 : 13 }}>
          <strong style={{ color: '#6d28d9' }}>Awaiting Review</strong>
          <div style={{ color: '#8b5cf6', fontSize: compact ? 10 : 11 }}>
            Waiting for {reviewerName || 'Reviewer'} {timeTracking.submittedAt ? `• Submitted ${formatRelativeTime(timeTracking.submittedAt)}` : ''}
          </div>
        </div>
      ),
    });
  }

  // 6. Completed
  if (timeTracking.completedAt) {
    let durationText = '';
    if (timeTracking.startedAt) {
      const ms = dayjs(timeTracking.completedAt).diff(dayjs(timeTracking.startedAt));
      const hours = ms / 3600000;
      durationText = hours > 24
        ? `${(hours / 24).toFixed(1)} days`
        : `${hours.toFixed(1)} hours`;
    }

    timelineItems.push({
      dot: <CheckCircleOutlined style={{ color: '#10b981', fontSize: compact ? 12 : 14 }} />,
      label: 'Completed',
      color: 'green',
      children: (
        <div style={{ fontSize: compact ? 11 : 13 }}>
          <strong style={{ color: '#065f46' }}>Completed</strong>
          <div style={{ color: '#059669', fontSize: compact ? 10 : 11 }}>
            Approved {reviewerName ? `by ${reviewerName}` : ''} • {formatRelativeTime(timeTracking.completedAt)}
          </div>
          {!compact && durationText && (
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              Total duration: <strong>{durationText}</strong>
            </div>
          )}
        </div>
      ),
    });
  }

  if (timelineItems.length === 0) {
    return <div style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '10px 0' }}>No activity yet</div>;
  }

  return (
    <Timeline
      mode="left"
      style={{ padding: compact ? '8px 0' : '16px 8px' }}
      items={timelineItems}
    />
  );
};

export default TaskStatusTimeline;
