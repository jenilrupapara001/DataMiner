import React, { useState, useEffect } from 'react';
import {
  Modal, Button, Input, DatePicker, Select, notification, Tooltip, Tag
} from 'antd';
import {
  EyeOutlined, LockOutlined, ClockCircleOutlined,
  LinkOutlined, CheckCircleOutlined, CloseCircleOutlined, SendOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { formatUserName, formatRelativeTime } from './workflowHelpers';

const { TextArea } = Input;

const ReviewDecisionModal = ({ isOpen, task, currentUser, onClose, onDecision }) => {
  const [decision, setDecision] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [newDueDate, setNewDueDate] = useState(null);
  const [rejectionCategory, setRejectionCategory] = useState(undefined);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDecision(null);
      setFeedback('');
      setNewDueDate(null);
      setRejectionCategory(undefined);
    }
  }, [isOpen]);

  if (!task) return null;

  const reviewerId = task.reviewer?._id || task.reviewer?.id || task.reviewer;
  const currentUserId = currentUser?._id || currentUser?.id;
  const role = (currentUser?.role?.name || currentUser?.role || '').toLowerCase();
  const isAuthorized = reviewerId === currentUserId || ['admin', 'super_admin', 'developer', 'operational_manager'].includes(role);

  if (!isAuthorized) {
    return (
      <Modal open={isOpen} onCancel={onClose} centered width={400} closable={false}
        footer={<Button type="primary" block onClick={onClose} style={{ borderRadius: 8, fontWeight: 600, fontSize: 11 }}>Close</Button>}
        title={<span style={{ fontSize: 14, fontWeight: 700 }}>Not Authorized</span>}>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <LockOutlined style={{ fontSize: 32, color: '#C62828', marginBottom: 12 }} />
          <div style={{ fontSize: 13, fontWeight: 600, color: '#18181b', marginBottom: 4 }}>Only {formatUserName(task.reviewer)} can review</div>
        </div>
      </Modal>
    );
  }

  const handleConfirm = async () => {
    if (!decision) return;
    if (decision === 'REJECT' && !feedback.trim()) {
      notification.error({ message: 'Feedback Required', description: 'Specify what needs to be fixed.' });
      return;
    }
    try {
      setSubmitting(true);
      await onDecision(task._id || task.id, decision, {
        decision,
        feedback: feedback.trim(),
        newDueDate: decision === 'REJECT' && newDueDate ? newDueDate.toISOString() : null,
        rejectionCategory: decision === 'REJECT' ? rejectionCategory : null,
        reviewedAt: new Date().toISOString(),
        reviewedBy: currentUser?._id || currentUser?.id,
      });
      notification.success({
        message: decision === 'APPROVE' ? 'Task Approved!' : 'Task Rejected',
        description: decision === 'APPROVE' ? 'Task is now complete.' : 'Assignee has been notified.',
      });
      onClose();
    } catch (e) { console.error(e); }
    finally { setSubmitting(false); }
  };

  const submission = task.submission || {};
  const assignee = Array.isArray(task.assignedTo) ? task.assignedTo[0] : task.assignedTo;

  return (
    <Modal open={isOpen} onCancel={onClose} footer={null} width={600} centered closable={!submitting}
      mask={{ closable: false }} destroyOnHidden
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <EyeOutlined style={{ fontSize: 14, color: '#9C27B0' }} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#18181b' }}>Review Submission</div>
            <div style={{ fontSize: 11, color: '#a1a1aa', marginTop: 1 }}>{task.title || task.action || task.name}</div>
          </div>
        </div>
      }
    >
      {/* Worker's Submission */}
      <div style={{ background: '#f8fafc', border: '1px solid #e4e4e7', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#18181b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700 }}>
              {assignee ? (assignee.firstName || assignee.name || 'U').charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#18181b' }}>{formatUserName(assignee)}</div>
              <div style={{ fontSize: 10, color: '#a1a1aa' }}>Assignee</div>
            </div>
          </div>
          <Tag style={{ fontSize: 9, borderRadius: 4, background: '#f5f3ff', color: '#9C27B0', border: '1px solid #ddd6fe', fontWeight: 600, margin: 0 }}>SUBMITTED</Tag>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Work Completed</div>
            <p style={{ fontSize: 12, color: '#3f3f46', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {submission.workCompleted || 'No details provided.'}
            </p>
          </div>

          {submission.outcome && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Result</div>
              <p style={{ fontSize: 12, color: '#3f3f46', margin: 0 }}>{submission.outcome}</p>
            </div>
          )}

          {(submission.before || submission.after) && (
            <div style={{ display: 'flex', gap: 8 }}>
              {submission.before && <Tag style={{ fontSize: 10, borderRadius: 4, background: '#fef2f2', color: '#C62828', border: '1px solid #fecaca', fontWeight: 600, margin: 0 }}>Before: {submission.before}</Tag>}
              {submission.after && <Tag style={{ fontSize: 10, borderRadius: 4, background: '#ecfdf5', color: '#2E7D32', border: '1px solid #a7f3d0', fontWeight: 600, margin: 0 }}>After: {submission.after}</Tag>}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e4e4e7', paddingTop: 10, fontSize: 11, color: '#71717a' }}>
            <span><ClockCircleOutlined style={{ marginRight: 4 }} />{submission.timeSpent || 0}h</span>
            <span>Difficulty: {'●'.repeat(submission.difficulty || 3)}{'○'.repeat(5 - (submission.difficulty || 3))}</span>
            {submission.submittedAt && <span>{formatRelativeTime(submission.submittedAt)}</span>}
          </div>

          {submission.reviewerNotes && (
            <div style={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: 8, padding: 10, fontSize: 11, color: '#52525b' }}>
              <span style={{ fontWeight: 600 }}>Note:</span> {submission.reviewerNotes}
            </div>
          )}
        </div>
      </div>

      {/* Decision */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Your Decision</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div onClick={() => setDecision('APPROVE')} style={{
            flex: 1, padding: '12px 14px', borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', gap: 10, border: decision === 'APPROVE' ? '2px solid #2E7D32' : '1px solid #e4e4e7',
            background: decision === 'APPROVE' ? '#ecfdf5' : '#fff'
          }}>
            <CheckCircleOutlined style={{ fontSize: 20, color: '#2E7D32' }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#065f46' }}>Approve</div>
              <div style={{ fontSize: 10, color: '#2E7D32' }}>Task is complete</div>
            </div>
          </div>
          <div onClick={() => setDecision('REJECT')} style={{
            flex: 1, padding: '12px 14px', borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', gap: 10, border: decision === 'REJECT' ? '2px solid #C62828' : '1px solid #e4e4e7',
            background: decision === 'REJECT' ? '#fef2f2' : '#fff'
          }}>
            <CloseCircleOutlined style={{ fontSize: 20, color: '#C62828' }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#991b1b' }}>Reject</div>
              <div style={{ fontSize: 10, color: '#C62828' }}>Needs more work</div>
            </div>
          </div>
        </div>
      </div>

      {/* Feedback */}
      {decision && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>
              {decision === 'APPROVE' ? 'Feedback (optional)' : 'What needs to be fixed *'}
            </div>
            <TextArea rows={3} value={feedback} onChange={e => setFeedback(e.target.value)} maxLength={1000} showCount
              placeholder={decision === 'APPROVE' ? 'What they did well...' : 'Be specific about what needs to change...'}
              style={{ borderRadius: 8 }} />
          </div>

          {decision === 'REJECT' && (
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>New Deadline</div>
                <DatePicker style={{ width: '100%', borderRadius: 8 }} size="small"
                  disabledDate={d => d && d.isBefore(dayjs().startOf('day'))}
                  value={newDueDate} onChange={setNewDueDate} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Reason</div>
                <Select size="small" placeholder="Select" value={rejectionCategory}
                  onChange={setRejectionCategory} allowClear style={{ width: '100%', borderRadius: 8 }}
                  options={[
                    { value: 'Incomplete Work', label: 'Incomplete Work' },
                    { value: 'Quality Issues', label: 'Quality Issues' },
                    { value: 'Wrong Approach', label: 'Wrong Approach' },
                    { value: 'Missing Evidence', label: 'Missing Evidence' },
                    { value: 'Other', label: 'Other' },
                  ]} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid #f4f4f5', paddingTop: 12 }}>
        <Button onClick={onClose} disabled={submitting} style={{ borderRadius: 8, fontSize: 11 }}>Cancel</Button>
        <Button type="primary" loading={submitting}
          disabled={!decision || (decision === 'REJECT' && !feedback.trim())}
          onClick={handleConfirm}
          icon={decision === 'APPROVE' ? <CheckCircleOutlined /> : decision === 'REJECT' ? <CloseCircleOutlined /> : <SendOutlined />}
          style={{ borderRadius: 8, fontWeight: 600, fontSize: 11, height: 32,
            background: !decision ? '#d4d4d8' : decision === 'APPROVE' ? '#2E7D32' : '#C62828',
            borderColor: 'transparent' }}>
          {!decision ? 'Select Decision' : decision === 'APPROVE' ? 'Approve' : 'Reject & Return'}
        </Button>
      </div>
    </Modal>
  );
};

export default ReviewDecisionModal;
