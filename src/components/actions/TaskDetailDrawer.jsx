import React from 'react';
import { Drawer, Tag, Space, Button, Descriptions, Card, Progress, Typography, Avatar, Divider, Tooltip } from 'antd';
import { CloseOutlined, EditOutlined, UserOutlined, LinkOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { can, formatUserName, getInitials } from './modalHelpers';
import WorkflowActionButton from './WorkflowActionButton';
import TaskStatusTimeline from './TaskStatusTimeline';
import WorkflowNotification from './WorkflowNotification';

const { Text } = Typography;

const TaskDetailDrawer = ({
  isOpen,
  onClose,
  action,
  currentUser,
  onEdit,
  onStart,
  onSubmit,
  onReview
}) => {
  if (!action) return null;

  const currentStatus = (action.status || 'PENDING').toUpperCase();

  const canEdit = can(currentUser, 'edit_any_task') ||
    (can(currentUser, 'edit_own_task') &&
      (action.assignedTo && (
        Array.isArray(action.assignedTo)
          ? action.assignedTo.some(u => (u._id || u.id) === (currentUser._id || currentUser.id))
          : (action.assignedTo._id || action.assignedTo.id) === (currentUser._id || currentUser.id)
      )));

  const getAssigneeName = (assignee) => {
    if (!assignee) return null;
    if (typeof assignee === 'string') return assignee;
    return formatUserName(assignee);
  };

  const handleNotificationAction = (type, t) => {
    onClose();
    if (type === 'SUBMIT') {
      onSubmit?.(t);
    } else if (type === 'REVIEW') {
      onReview?.(t);
    } else if (type === 'RESTART') {
      onStart?.(t);
    }
  };

  const linkedAsins = action.asins || action.linkedAsins || [];
  const showAllAsins = linkedAsins.length > 5;
  const displayAsins = showAllAsins ? linkedAsins.slice(0, 5) : linkedAsins;

  return (
    <Drawer
      open={isOpen}
      onClose={onClose}
      placement="right"
      styles={{ body: { padding: 0 }, wrapper: { width: 560 } }}
      destroyOnClose
      closable
      title={null}
    >
      <div style={{ borderLeft: '4px solid #6366f1', padding: '20px 24px 12px', borderBottom: '1px solid #f1f5f9' }}>
        <Space orientation="vertical" size={8} style={{ width: '100%' }}>
          <Text strong style={{ fontSize: 16, color: '#1e293b', lineHeight: 1.3 }}>
            {action.title || action.action || 'Untitled Task'}
          </Text>
          <Space size={8} wrap>
            <Tag style={{ borderRadius: 6, fontSize: 11, fontWeight: 600, margin: 0 }}>
              {action.status || 'PENDING'}
            </Tag>
            {action.priority && (
              <Tag color={action.priority === 'HIGH' ? 'red' : action.priority === 'LOW' ? 'blue' : 'orange'} style={{ borderRadius: 6, fontSize: 11, fontWeight: 600, margin: 0 }}>
                {action.priority}
              </Tag>
            )}
            {action.type && (
              <Tag style={{ borderRadius: 6, fontSize: 11, margin: 0 }}>
                {action.type}
              </Tag>
            )}
          </Space>
        </Space>
      </div>

      <div style={{ padding: '20px 24px', maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
        {/* Workflow Notification Banner */}
        <WorkflowNotification
          task={action}
          currentUser={currentUser}
          onAction={handleNotificationAction}
        />

        <Descriptions column={1} size="small" colon={false} labelStyle={{ fontSize: 12, color: '#94a3b8', fontWeight: 500, paddingBottom: 4 }} contentStyle={{ fontSize: 13, color: '#1e293b', paddingBottom: 8 }}>
          <Descriptions.Item label="Task ID">
            <Text copyable style={{ fontFamily: 'monospace', fontSize: 12 }}>{action._id || action.id}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Category / Type">
            {action.type || action.category || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Action Type">
            {action.actionType || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Created by">
            <Space size={6}>
              <Avatar size={22} icon={<UserOutlined />} style={{ background: '#eef2ff', color: '#6366f1' }} />
              <span>{formatUserName(action.createdBy)}</span>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="Created at">
            {action.createdAt ? dayjs(action.createdAt).format('MMM D, YYYY h:mm A') : '—'}
          </Descriptions.Item>
        </Descriptions>

        <Divider style={{ margin: '12px 0' }} />

        <Text strong style={{ fontSize: 13, color: '#1e293b', display: 'block', marginBottom: 8 }}>Assignment</Text>
        <Descriptions column={1} size="small" colon={false} labelStyle={{ fontSize: 12, color: '#94a3b8', fontWeight: 500, paddingBottom: 4 }} contentStyle={{ fontSize: 13, color: '#1e293b', paddingBottom: 8 }}>
          <Descriptions.Item label="Assigned To">
            {Array.isArray(action.assignedTo) && action.assignedTo.length > 0 ? (
              <Avatar.Group size={24} max={{ count: 3 }}>
                {action.assignedTo.map((u, i) => (
                  <Tooltip key={i} title={getAssigneeName(u)}>
                    <Avatar style={{ background: '#6366f1' }}>{getInitials(getAssigneeName(u))}</Avatar>
                  </Tooltip>
                ))}
              </Avatar.Group>
            ) : action.assignedTo ? (
              <Space size={6}>
                <Avatar size={22} icon={<UserOutlined />} style={{ background: '#eef2ff', color: '#6366f1' }} />
                <span>{formatUserName(action.assignedTo)}</span>
              </Space>
            ) : (
              <Text style={{ color: '#94a3b8' }}>—</Text>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Reviewer">
            {action.reviewer ? (
              <Space size={6}>
                <Avatar size={22} icon={<UserOutlined />} style={{ background: '#f5f3ff', color: '#8b5cf6' }} />
                <span>{formatUserName(action.reviewer)}</span>
              </Space>
            ) : (
              <Text style={{ color: '#94a3b8' }}>—</Text>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Seller">
            {action.seller
              ? (typeof action.seller === 'string' ? action.seller : action.seller.name || action.seller.sellerName || action.seller.businessName || '—')
              : <Text style={{ color: '#94a3b8' }}>—</Text>}
          </Descriptions.Item>
          <Descriptions.Item label="Linked Objective">
            {action.keyResultId ? (
              <Space size={4}>
                <LinkOutlined style={{ color: '#6366f1', fontSize: 12 }} />
                <Text style={{ color: '#6366f1' }}>
                  {typeof action.keyResultId === 'string' ? action.keyResultId : action.keyResultId.title || 'Linked Objective'}
                </Text>
              </Space>
            ) : (
              <Text style={{ color: '#94a3b8' }}>—</Text>
            )}
          </Descriptions.Item>
        </Descriptions>

        <Divider style={{ margin: '12px 0' }} />

        <Text strong style={{ fontSize: 13, color: '#1e293b', display: 'block', marginBottom: 12 }}>Status Timeline</Text>
        <TaskStatusTimeline task={action} compact={false} />

        <Divider style={{ margin: '12px 0' }} />

        <Text strong style={{ fontSize: 13, color: '#1e293b', display: 'block', marginBottom: 8 }}>Linked ASINs</Text>
        {linkedAsins.length > 0 ? (
          <Card styles={{ body: { padding: 0 } }} style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textAlign: 'left' }}>ASIN</th>
                  <th style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textAlign: 'left' }}>Title</th>
                  <th style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textAlign: 'left' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {displayAsins.map((a, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 12px', fontSize: 12, fontFamily: 'monospace' }}>
                      {typeof a === 'string' ? a : a.asin || a.code || '—'}
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: 12 }}>
                      {typeof a === 'string' ? '—' : a.title || a.name || '—'}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      {typeof a === 'string' ? '—' : (
                        <Tag style={{ fontSize: 10, borderRadius: 4 }}>{a.status || 'Active'}</Tag>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ) : (
          <div style={{ padding: '12px 0' }}>
            <Text style={{ color: '#94a3b8', fontSize: 12 }}>No ASINs linked</Text>
          </div>
        )}

        <Divider style={{ margin: '12px 0' }} />

        <Text strong style={{ fontSize: 13, color: '#1e293b', display: 'block', marginBottom: 8 }}>Progress</Text>
        <Progress
          percent={action.status === 'COMPLETED' ? 100 : action.status === 'IN_PROGRESS' ? 50 : 0}
          size="small"
          strokeColor="#6366f1"
          railColor="#f1f5f9"
          style={{ marginBottom: 12 }}
        />

        {(action.description || action.internalNotes || (action.tags && action.tags.length > 0)) && (
          <>
            <Divider style={{ margin: '12px 0' }} />
            <Text strong style={{ fontSize: 13, color: '#1e293b', display: 'block', marginBottom: 8 }}>Notes &amp; Description</Text>
            {action.description && (
              <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12, marginBottom: 8 }}>
                <Text style={{ fontSize: 12, color: '#374151', whiteSpace: 'pre-wrap' }}>{action.description}</Text>
              </div>
            )}
            {action.internalNotes && (
              <div style={{ background: '#fffbeb', borderRadius: 8, padding: 12, marginBottom: 8, border: '1px solid #fde68a' }}>
                <Text style={{ fontSize: 11, color: '#92400e', fontWeight: 600, display: 'block', marginBottom: 4 }}>Internal Notes</Text>
                <Text style={{ fontSize: 12, color: '#374151', whiteSpace: 'pre-wrap' }}>{action.internalNotes}</Text>
              </div>
            )}
            {action.tags && action.tags.length > 0 && (
              <Space size={4} wrap>
                {action.tags.map((tag, i) => (
                  <Tag key={i} style={{ borderRadius: 6, fontSize: 11 }}>{tag}</Tag>
                ))}
              </Space>
            )}
          </>
        )}
      </div>

      <div style={{ borderTop: '1px solid #f1f5f9', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button icon={<CloseOutlined />} onClick={onClose} style={{ height: 36, borderRadius: 8 }}>
          Close
        </Button>
        <Space size={8}>
          {canEdit && (
            <Button
              icon={<EditOutlined />}
              onClick={() => { onClose(); onEdit?.(action); }}
              style={{ height: 36, borderRadius: 8, border: '1px solid #e2e8f0' }}
            >
              Edit
            </Button>
          )}
          <WorkflowActionButton
            task={action}
            currentUser={currentUser}
            onStart={(t) => { onClose(); onStart?.(t); }}
            onSubmit={(t) => { onClose(); onSubmit?.(t); }}
            onApprove={(t) => { onClose(); onReview?.(t); }}
            onReject={(t) => { onClose(); onReview?.(t); }}
            size="default"
          />
        </Space>
      </div>
    </Drawer>
  );
};

export default TaskDetailDrawer;
