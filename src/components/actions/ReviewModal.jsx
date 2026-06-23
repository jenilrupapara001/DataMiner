import React, { useState, useEffect } from 'react';
import {
  Modal, Button, Space, Typography, Tag, Avatar, Alert,
  Input, Checkbox, DatePicker, message, Card, Collapse, Divider,
} from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, UserOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  MODAL_STYLES, formatUserName, getStatusStyle, getPriorityStyle,
  can, getInitials,
} from './modalHelpers';

const { Text } = Typography;
const { TextArea } = Input;

const ReviewModal = ({ isOpen, action, onClose, onReview }) => {
  const [decision, setDecision] = useState(null);
  const [comments, setComments] = useState('');
  const [setNewDueDate, setSetNewDueDate] = useState(false);
  const [newDueDate, setNewDueDateValue] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const isReviewer = action?.reviewer && (
    (action.reviewer._id || action.reviewer.id) === (action?.currentUser?._id || action?.currentUser?.id)
  );
  const isAdminOrAbove = can(action?.currentUser, 'approve_reject');
  const canReview = isReviewer || isAdminOrAbove || !action?.reviewer;

  useEffect(() => {
    if (isOpen) {
      setDecision(null);
      setComments('');
      setSetNewDueDate(false);
      setNewDueDateValue(null);
    }
  }, [isOpen]);

  if (!action) return null;

  if (!canReview) {
    return (
      <Modal open={isOpen} onCancel={onClose} footer={null} width={480} centered destroyOnClose>
        <div style={{ padding: '40px 24px', textAlign: 'center' }}>
          <Alert
            type="warning"
            showIcon
            message="Not Authorized"
            description="You are not the assigned reviewer for this task."
            style={{ textAlign: 'left', marginBottom: 24 }}
          />
          <Button onClick={onClose} style={MODAL_STYLES.cancelBtn}>Close</Button>
        </div>
      </Modal>
    );
  }

  const handleSubmit = async () => {
    if (!decision) {
      message.error('Please select Approve or Reject');
      return;
    }
    if (decision === 'REJECT' && (!comments || comments.trim().length < 10)) {
      message.error('Please provide detailed feedback (minimum 10 characters)');
      return;
    }

    setSubmitting(true);
    try {
      const success = await onReview(action, decision, comments);
      if (success !== false) {
        message.success(decision === 'APPROVE' ? 'Task approved' : 'Task rejected');
        onClose();
      }
    } catch (err) {
      message.error(err?.message || 'Review submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const statusStyle = getStatusStyle(action.status);
  const priorityStyle = getPriorityStyle(action.priority);
  const submittedBy = action.submittedBy || action.assignedTo;

  return (
    <Modal
      open={isOpen}
      onCancel={onClose}
      footer={null}
      width={580}
      centered
      destroyOnClose
    >
      <div style={MODAL_STYLES.headerStyle}>
        <Space size={12} align="center">
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>Review Task</span>
        </Space>
      </div>

      <div style={{ ...MODAL_STYLES.bodyStyle, maxHeight: '70vh', overflowY: 'auto' }}>
        <Text strong style={{ fontSize: 16, color: '#1e293b', display: 'block', marginBottom: 8 }}>
          {action.title}
        </Text>
        <Space size={8} style={{ marginBottom: 16 }}>
          <Tag style={{ borderRadius: 6, fontSize: 11, fontWeight: 600, color: statusStyle.color, background: statusStyle.bg, border: `1px solid ${statusStyle.border}` }}>
            {action.status}
          </Tag>
          <Tag style={{ borderRadius: 6, fontSize: 11, fontWeight: 600, color: priorityStyle.color, background: priorityStyle.bg, border: `1px solid ${priorityStyle.border}` }}>
            {action.priority || 'MEDIUM'}
          </Tag>
          {action.type && (
            <Tag style={{ borderRadius: 6, fontSize: 11 }}>
              {action.type}
            </Tag>
          )}
        </Space>

        {submittedBy && (
          <Space size={8} style={{ marginBottom: 16 }}>
            <Avatar size={24} icon={<UserOutlined />} style={{ background: '#eef2ff', color: '#6366f1' }} />
            <Text style={{ fontSize: 12, color: '#64748b' }}>
              Submitted by {formatUserName(submittedBy)}
              {action.reviewSubmittedAt ? ` on ${dayjs(action.reviewSubmittedAt).format('MMM D, YYYY')}` : ''}
            </Text>
          </Space>
        )}

        <div style={{
          background: '#1e293b', color: 'white', borderRadius: 10, padding: 16,
          marginBottom: 16,
        }}>
          <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>
            Completion Summary
          </Text>
          <Text style={{ color: '#f1f5f9', fontSize: 13, display: 'block', whiteSpace: 'pre-wrap' }}>
            {action.completionSummary || action.remarks || 'No summary provided'}
          </Text>
          {action.outcome && (
            <>
              <Divider style={{ borderColor: '#334155', margin: '12px 0' }} />
              <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Outcome
              </Text>
              <Text style={{ color: '#10b981', fontSize: 13 }}>{action.outcome}</Text>
            </>
          )}
          {action.timeSpent && (
            <div style={{ marginTop: 8, color: '#94a3b8', fontSize: 12 }}>
              <CalendarOutlined style={{ marginRight: 4 }} />
              Time spent: {action.timeSpent} hours
            </div>
          )}
        </div>

        <Collapse
          ghost
          items={[{
            key: 'details',
            label: <Text style={{ fontSize: 12, color: '#6366f1', fontWeight: 600 }}>View Original Task Details</Text>,
            children: (
              <div style={{ padding: '8px 0' }}>
                {action.description && (
                  <div style={{ marginBottom: 8 }}>
                    <Text style={{ fontSize: 11, color: '#94a3b8', display: 'block' }}>Description</Text>
                    <Text style={{ fontSize: 12, color: '#374151' }}>{action.description}</Text>
                  </div>
                )}
                <div style={{ marginBottom: 4 }}>
                  <Text style={{ fontSize: 11, color: '#94a3b8', display: 'block' }}>
                    Assigned to: {Array.isArray(action.assignedTo) ? action.assignedTo.map(formatUserName).join(', ') : formatUserName(action.assignedTo)}
                  </Text>
                </div>
                {action.dueDate && (
                  <div style={{ marginBottom: 4 }}>
                    <Text style={{ fontSize: 11, color: '#94a3b8', display: 'block' }}>
                      Due: {dayjs(action.dueDate).format('MMM D, YYYY')}
                    </Text>
                  </div>
                )}
                {action.asins && action.asins.length > 0 && (
                  <div>
                    <Text style={{ fontSize: 11, color: '#94a3b8', display: 'block' }}>
                      Linked ASINs: {action.asins.length}
                    </Text>
                  </div>
                )}
              </div>
            ),
          }]}
        />

        <Divider style={{ margin: '16px 0' }} />

        <Text strong style={{ fontSize: 13, color: '#1e293b', display: 'block', marginBottom: 12 }}>
          Review Decision
        </Text>

        <Space size={12} style={{ width: '100%', marginBottom: 16 }}>
          <div
            onClick={() => setDecision('APPROVE')}
            style={{
              flex: 1, height: 100, borderRadius: 10, padding: 16, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 12,
              border: `2px solid ${decision === 'APPROVE' ? '#10b981' : '#e2e8f0'}`,
              background: decision === 'APPROVE' ? '#ecfdf5' : 'white',
              transition: 'all 0.15s ease',
            }}
          >
            <CheckCircleOutlined style={{ fontSize: 28, color: decision === 'APPROVE' ? '#10b981' : '#cbd5e1' }} />
            <div>
              <Text strong style={{ fontSize: 15, color: decision === 'APPROVE' ? '#059669' : '#1e293b', display: 'block' }}>
                Approve
              </Text>
              <Text style={{ fontSize: 12, color: '#94a3b8' }}>Mark this task as completed</Text>
            </div>
          </div>

          <div
            onClick={() => setDecision('REJECT')}
            style={{
              flex: 1, height: 100, borderRadius: 10, padding: 16, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 12,
              border: `2px solid ${decision === 'REJECT' ? '#ef4444' : '#e2e8f0'}`,
              background: decision === 'REJECT' ? '#fef2f2' : 'white',
              transition: 'all 0.15s ease',
            }}
          >
            <CloseCircleOutlined style={{ fontSize: 28, color: decision === 'REJECT' ? '#ef4444' : '#cbd5e1' }} />
            <div>
              <Text strong style={{ fontSize: 15, color: decision === 'REJECT' ? '#e11d48' : '#1e293b', display: 'block' }}>
                Reject
              </Text>
              <Text style={{ fontSize: 12, color: '#94a3b8' }}>Send back for rework</Text>
            </div>
          </div>
        </Space>

        <div style={{ marginBottom: 12 }}>
          <Text style={MODAL_STYLES.labelStyle}>
            Review Comments {decision === 'REJECT' ? <span style={{ color: '#ef4444' }}>*</span> : null}
          </Text>
          <TextArea
            rows={3}
            value={comments}
            onChange={e => setComments(e.target.value)}
            placeholder={decision === 'APPROVE'
              ? 'Add any feedback or notes (optional)...'
              : 'Explain what needs to be corrected (required)...'
            }
            style={{ borderRadius: 8, fontSize: 13 }}
            maxLength={2000}
            showCount
          />
        </div>

        {decision === 'REJECT' && (
          <div style={{ background: '#fafbfc', borderRadius: 8, padding: 12, border: '1px solid #e2e8f0' }}>
            <Checkbox checked={setNewDueDate} onChange={e => setSetNewDueDate(e.target.checked)}>
              <Text style={{ fontSize: 12 }}>Set a new due date for resubmission</Text>
            </Checkbox>
            {setNewDueDate && (
              <div style={{ marginTop: 8 }}>
                <DatePicker
                  value={newDueDate}
                  onChange={setNewDueDateValue}
                  style={{ width: '100%', borderRadius: 8 }}
                  disabledDate={(d) => d && d.isBefore(dayjs().startOf('day'))}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div style={MODAL_STYLES.footerStyle}>
        <Button onClick={onClose} style={MODAL_STYLES.cancelBtn}>Cancel</Button>
        <Button
          type="primary"
          onClick={handleSubmit}
          loading={submitting}
          disabled={!decision}
          style={{
            height: 36, borderRadius: 8, fontWeight: 600,
            background: decision === 'REJECT' ? '#ef4444' : decision === 'APPROVE' ? '#10b981' : '#6366f1',
            border: 'none',
            boxShadow: decision ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
          }}
        >
          {decision === 'APPROVE' ? 'Approve Task' : decision === 'REJECT' ? 'Reject Task' : 'Submit Review'}
        </Button>
      </div>
    </Modal>
  );
};

export default ReviewModal;
