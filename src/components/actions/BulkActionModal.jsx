import React, { useState, useMemo } from 'react';
import {
  Modal, Button, Space, Typography, Tag, Select, Radio,
  DatePicker, Checkbox, Alert, Badge, message, Divider,
} from 'antd';
import {
  LockOutlined, DeleteOutlined, UserOutlined,
  CalendarOutlined, SwapOutlined, FlagOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { db } from '../../services/db';
import {
  STATUS_OPTIONS, PRIORITY_OPTIONS,
  can, formatUserName, buildUserSelectOptions, MODAL_STYLES,
  getStatusStyle,
} from './modalHelpers';
import { useAuth } from '../../contexts/AuthContext';

const { Text } = Typography;
const { Option } = Select;

const BulkActionModal = ({ isOpen, onClose, selectedTasks, currentUser, onComplete }) => {
  const { user: authUser } = useAuth();
  const user = currentUser || authUser;

  const [actionType, setActionType] = useState(null);
  const [targetStatus, setTargetStatus] = useState(null);
  const [targetPriority, setTargetPriority] = useState(null);
  const [targetAssignee, setTargetAssignee] = useState(null);
  const [targetReviewer, setTargetReviewer] = useState(null);
  const [targetDueDate, setTargetDueDate] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isBlocked = !can(user, 'bulk_operations');
  const canDelete = can(user, 'delete_task');

  const taskCount = selectedTasks?.length || 0;

  const bulkActions = [
    { value: 'STATUS', label: 'Change Status', icon: <SwapOutlined /> },
    { value: 'PRIORITY', label: 'Change Priority', icon: <FlagOutlined /> },
    { value: 'ASSIGNEE', label: 'Reassign To', icon: <UserOutlined /> },
    { value: 'REVIEWER', label: 'Change Reviewer', icon: <UserOutlined /> },
    { value: 'DUE_DATE', label: 'Set Due Date', icon: <CalendarOutlined /> },
    ...(canDelete ? [{ value: 'DELETE', label: 'Delete Selected', icon: <DeleteOutlined /> }] : []),
  ];

  const userOptions = useMemo(() => {
    return buildUserSelectOptions([]).length > 0 ? buildUserSelectOptions([]) : [];
  }, []);

  const reviewerOptions = useMemo(() => {
    if (!Array.isArray([])) return [];
    return [];
  }, []);

  const handleApply = async () => {
    if (!actionType) {
      message.error('Select an action');
      return;
    }
    if (actionType === 'STATUS' && !targetStatus) {
      message.error('Select a target status');
      return;
    }
    if (actionType === 'DELETE' && !confirmDelete) {
      message.error('Please confirm the deletion');
      return;
    }
    if (taskCount === 0) {
      message.error('No tasks selected');
      return;
    }

    setSubmitting(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (const task of selectedTasks) {
        const id = task._id || task.id;
        try {
          if (actionType === 'DELETE') {
            await db.deleteAction(id);
          } else {
            const updates = {};
            switch (actionType) {
              case 'STATUS':
                updates.status = targetStatus;
                break;
              case 'PRIORITY':
                updates.priority = targetPriority;
                break;
              case 'ASSIGNEE':
                updates.assignedTo = targetAssignee ? [targetAssignee] : [];
                break;
              case 'REVIEWER':
                updates.reviewer = targetReviewer || null;
                break;
              case 'DUE_DATE':
                updates.dueDate = targetDueDate ? targetDueDate.toISOString() : null;
                break;
            }
            await db.updateAction(id, updates);
          }
          successCount++;
        } catch {
          failCount++;
        }
      }

      if (successCount > 0) {
        message.success(`${successCount} task${successCount > 1 ? 's' : ''} updated successfully`);
      }
      if (failCount > 0) {
        message.warning(`${failCount} task${failCount > 1 ? 's' : ''} failed`);
      }
      onComplete?.();
      resetAndClose();
    } catch (err) {
      message.error(err?.message || 'Bulk operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const resetAndClose = () => {
    setActionType(null);
    setTargetStatus(null);
    setTargetPriority(null);
    setTargetAssignee(null);
    setTargetReviewer(null);
    setTargetDueDate(null);
    setConfirmDelete(false);
    onClose();
  };

  if (isBlocked) {
    return (
      <Modal open={isOpen} onCancel={resetAndClose} footer={null} width={480} centered destroyOnHidden>
        <div style={{ padding: '40px 24px', textAlign: 'center' }}>
          <LockOutlined style={{ fontSize: 40, color: '#cbd5e1', display: 'block', marginBottom: 16 }} />
          <Text strong style={{ fontSize: 16, color: '#1e293b', display: 'block', marginBottom: 8 }}>
            Admin Only Feature
          </Text>
          <Text style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 24 }}>
            You need admin or super admin permissions to perform bulk operations.
          </Text>
          <Button onClick={resetAndClose} style={MODAL_STYLES.cancelBtn}>Close</Button>
        </div>
      </Modal>
    );
  }

  const labelStyle = MODAL_STYLES.labelStyle;

  return (
    <Modal
      open={isOpen}
      onCancel={resetAndClose}
      footer={null}
      width={560}
      centered
      destroyOnHidden
    >
      <div style={MODAL_STYLES.headerStyle}>
        <Space size={12} align="center">
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
            Bulk Actions
          </span>
          <Badge count={`${taskCount} tasks selected`} style={{ background: '#1976D2', borderRadius: 6, fontSize: 11, fontWeight: 600 }} />
        </Space>
      </div>

      <div style={{ ...MODAL_STYLES.bodyStyle, maxHeight: '70vh', overflowY: 'auto' }}>
        {taskCount > 0 && (
          <div style={{
            maxHeight: 200, overflowY: 'auto', marginBottom: 16,
            border: '1px solid #e2e8f0', borderRadius: 8, padding: '4px 0',
          }}>
            {selectedTasks.map((task, i) => {
              const st = getStatusStyle(task.status);
              return (
                <div key={task._id || task.id || i} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 12px',
                  borderBottom: i < taskCount - 1 ? '1px solid #f1f5f9' : 'none',
                }}>
                  <Tag style={{ borderRadius: 4, fontSize: 10, fontWeight: 600, color: st.color, background: st.bg, border: `1px solid ${st.border}`, margin: 0, flexShrink: 0 }}>
                    {task.status}
                  </Tag>
                  <Text style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {task.title || 'Untitled'}
                  </Text>
                  <Tag style={{ borderRadius: 4, fontSize: 10, flexShrink: 0, margin: 0 }}>
                    {task.priority || 'MEDIUM'}
                  </Tag>
                </div>
              );
            })}
            <div style={{ padding: '6px 12px', borderTop: '1px solid #f1f5f9' }}>
              <Text style={{ fontSize: 11, color: '#94a3b8' }}>All {taskCount} task{taskCount > 1 ? 's' : ''} will be affected</Text>
            </div>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <span style={labelStyle}>Select Action</span>
          <Radio.Group
            value={actionType}
            onChange={e => { setActionType(e.target.value); setConfirmDelete(false); }}
            style={{ width: '100%', marginTop: 6 }}
          >
            <Space orientation="vertical" size={6} style={{ width: '100%' }}>
              {bulkActions.map(action => (
                <Radio
                  key={action.value}
                  value={action.value}
                  style={{
                    display: 'flex', alignItems: 'center', width: '100%',
                    padding: '10px 14px', margin: 0,
                    border: `1px solid ${actionType === action.value ? '#1976D2' : '#e2e8f0'}`,
                    borderRadius: 8,
                    background: actionType === action.value ? '#eef2ff' : 'white',
                    height: 'auto',
                  }}
                >
                  <Space size={10}>
                    <span style={{ color: actionType === action.value ? '#1976D2' : '#64748b', fontSize: 16 }}>
                      {action.icon}
                    </span>
                    <Text strong style={{ fontSize: 13, color: actionType === action.value ? '#1976D2' : '#374151' }}>
                      {action.label}
                    </Text>
                  </Space>
                </Radio>
              ))}
            </Space>
          </Radio.Group>
        </div>

        {actionType && actionType !== 'DELETE' && (
          <Divider style={{ margin: '8px 0 16px' }} />
        )}

        {actionType === 'STATUS' && (
          <div style={{ marginBottom: 16 }}>
            <span style={labelStyle}>Target Status</span>
            <Select
              value={targetStatus}
              onChange={setTargetStatus}
              placeholder="Select status"
              style={{ width: '100%', ...MODAL_STYLES.inputStyle, marginTop: 6 }}
            >
              {STATUS_OPTIONS.map(s => (
                <Option key={s.value} value={s.value}>
                  <Space size={6}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
                    {s.label}
                  </Space>
                </Option>
              ))}
            </Select>
          </div>
        )}

        {actionType === 'PRIORITY' && (
          <div style={{ marginBottom: 16 }}>
            <span style={labelStyle}>Target Priority</span>
            <Radio.Group
              value={targetPriority}
              onChange={e => setTargetPriority(e.target.value)}
              style={{ display: 'flex', gap: 8, marginTop: 6, width: '100%' }}
            >
              {PRIORITY_OPTIONS.map(p => (
                <Radio.Button key={p.value} value={p.value} style={{
                  flex: 1, textAlign: 'center', height: 34, lineHeight: '32px',
                  borderRadius: 6, fontSize: 11, fontWeight: 600,
                }}>
                  {p.label}
                </Radio.Button>
              ))}
            </Radio.Group>
          </div>
        )}

        {actionType === 'ASSIGNEE' && (
          <div style={{ marginBottom: 16 }}>
            <span style={labelStyle}>Reassign To</span>
            <Select
              value={targetAssignee}
              onChange={setTargetAssignee}
              placeholder="Select user"
              style={{ width: '100%', ...MODAL_STYLES.inputStyle, marginTop: 6 }}
              showSearch
              optionFilterProp="label"
              allowClear
              options={userOptions.length > 0 ? userOptions : undefined}
            >
              {userOptions.length === 0 && (users => users?.map(u => (
                <Option key={u._id || u.id} value={u._id || u.id}>
                  {formatUserName(u)}
                </Option>
              )))(undefined)}
            </Select>
          </div>
        )}

        {actionType === 'REVIEWER' && (
          <div style={{ marginBottom: 16 }}>
            <span style={labelStyle}>Change Reviewer</span>
            <Select
              value={targetReviewer}
              onChange={setTargetReviewer}
              placeholder="Select reviewer (managers+)"
              style={{ width: '100%', ...MODAL_STYLES.inputStyle, marginTop: 6 }}
              showSearch
              optionFilterProp="label"
              allowClear
            />
          </div>
        )}

        {actionType === 'DUE_DATE' && (
          <div style={{ marginBottom: 16 }}>
            <span style={labelStyle}>Set Due Date</span>
            <DatePicker
              value={targetDueDate}
              onChange={setTargetDueDate}
              style={{ width: '100%', ...MODAL_STYLES.inputStyle, marginTop: 6 }}
              disabledDate={(d) => d && d.isBefore(dayjs().startOf('day'))}
            />
          </div>
        )}

        {actionType === 'DELETE' && (
          <div style={{ background: '#fef2f2', borderRadius: 8, padding: 12, border: '1px solid #fecdd3', marginBottom: 16 }}>
            <Space orientation="vertical" size={8}>
              <Space>
                <DeleteOutlined style={{ color: '#D32F2F' }} />
                <Text style={{ color: '#e11d48', fontWeight: 600, fontSize: 13 }}>
                  Delete {taskCount} task{taskCount > 1 ? 's' : ''}
                </Text>
              </Space>
              <Alert
                type="error"
                showIcon
                message={`This will permanently delete ${taskCount} task${taskCount > 1 ? 's' : ''}. This cannot be undone.`}
                style={{ fontSize: 12, borderRadius: 6, padding: '6px 12px' }}
              />
              <Checkbox
                checked={confirmDelete}
                onChange={e => setConfirmDelete(e.target.checked)}
              >
                <Text style={{ fontSize: 12, color: '#e11d48' }}>
                  I understand this will permanently delete {taskCount} task{taskCount > 1 ? 's' : ''}
                </Text>
              </Checkbox>
            </Space>
          </div>
        )}
      </div>

      <div style={MODAL_STYLES.footerStyle}>
        <Button onClick={resetAndClose} style={MODAL_STYLES.cancelBtn}>Cancel</Button>
        <Button
          type="primary"
          onClick={handleApply}
          loading={submitting}
          disabled={!actionType}
          style={{
            height: 36, borderRadius: 8, fontWeight: 600,
            background: actionType === 'DELETE' ? '#D32F2F' : '#1976D2',
            border: 'none',
            boxShadow: actionType === 'DELETE' ? '0 2px 8px rgba(239,68,68,0.3)' : '0 2px 8px rgba(99,102,241,0.3)',
          }}
        >
          {actionType === 'DELETE' ? `Delete ${taskCount} Task${taskCount > 1 ? 's' : ''}` : `Apply to ${taskCount} Task${taskCount > 1 ? 's' : ''}`}
        </Button>
      </div>
    </Modal>
  );
};

export default BulkActionModal;
