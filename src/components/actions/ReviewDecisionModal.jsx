import React, { useState, useEffect } from 'react';
import {
  Modal, Card, Button, Avatar, Space, Badge, Collapse, Rate,
  Input, DatePicker, Select, Radio, notification, Tooltip
} from 'antd';
import {
  EyeOutlined, LockOutlined, ClockCircleOutlined,
  LinkOutlined, CheckCircleOutlined, CloseCircleOutlined,
  CheckOutlined, CloseOutlined, FlagFilled, FlagOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { formatUserName, formatRelativeTime } from './workflowHelpers';

const { TextArea } = Input;
const { Option } = Select;
const { Panel } = Collapse;

const ReviewDecisionModal = ({ isOpen, task, currentUser, onClose, onDecision }) => {
  const [decision, setDecision] = useState(null); // 'APPROVE' or 'REJECT'
  const [feedback, setFeedback] = useState('');
  const [newDueDate, setNewDueDate] = useState(null);
  const [rejectionCategory, setRejectionCategory] = useState(undefined);
  const [issuesPriority, setIssuesPriority] = useState('Minor');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDecision(null);
      setFeedback('');
      setNewDueDate(null);
      setRejectionCategory(undefined);
      setIssuesPriority('Minor');
    }
  }, [isOpen]);

  if (!task) return null;

  // RBAC Authentication
  const reviewerId = task.reviewer?._id || task.reviewer?.id || task.reviewer;
  const currentUserId = currentUser?._id || currentUser?.id;
  const role = (currentUser?.role?.name || currentUser?.role || '').toLowerCase();
  const isAuthorized = reviewerId === currentUserId || ['admin', 'superadmin'].includes(role);

  if (!isAuthorized) {
    return (
      <Modal
        open={isOpen}
        onCancel={onClose}
        footer={[
          <Button key="close" type="primary" onClick={onClose}>
            Close
          </Button>
        ]}
        width={480}
        centered
        maskClosable={false}
      >
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <LockOutlined style={{ fontSize: 48, color: '#ef4444', marginBottom: 16 }} />
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#1e293b' }}>Not your task to review</h3>
          <p style={{ fontSize: 14, color: '#64748b', marginTop: 8 }}>
            Only {formatUserName(task.reviewer)} can review this task.
          </p>
        </div>
      </Modal>
    );
  }

  const handleConfirm = async () => {
    if (!decision) return;
    if (decision === 'REJECT' && !feedback.trim()) {
      notification.error({
        message: 'Feedback Required',
        description: 'Please specify what needs to be fixed before rejecting.',
      });
      return;
    }

    try {
      setSubmitting(true);
      const decisionData = {
        decision,
        feedback: feedback.trim(),
        newDueDate: decision === 'REJECT' && newDueDate ? newDueDate.toISOString() : null,
        rejectionCategory: decision === 'REJECT' ? rejectionCategory : null,
        issuesPriority: decision === 'REJECT' ? issuesPriority : null,
        reviewedAt: new Date().toISOString(),
        reviewedBy: currentUser?._id || currentUser?.id,
      };

      await onDecision(task._id || task.id, decision, decisionData);

      const assigneeName = Array.isArray(task.assignedTo)
        ? task.assignedTo.map(u => formatUserName(u)).join(', ')
        : formatUserName(task.assignedTo);

      notification.success({
        message: decision === 'APPROVE' ? 'Task Approved!' : 'Task Rejected',
        description: decision === 'APPROVE'
          ? `${assigneeName} has been notified. Task is now complete.`
          : `${assigneeName} has been notified and must resubmit.`,
        icon: decision === 'APPROVE'
          ? <CheckCircleOutlined style={{ color: '#10b981' }} />
          : <CloseCircleOutlined style={{ color: '#ef4444' }} />,
        duration: 5,
      });

      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const submission = task.submission || {};
  const assignee = Array.isArray(task.assignedTo) ? task.assignedTo[0] : task.assignedTo;

  return (
    <Modal
      open={isOpen}
      onCancel={onClose}
      footer={null}
      width={660}
      centered
      maskClosable={false}
      destroyOnClose
    >
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ background: '#f5f3ff', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6' }}>
            <EyeOutlined style={{ fontSize: 18 }} />
          </div>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#1e293b' }}>Review Submission</h3>
            <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>{task.action || task.title || task.name}</p>
          </div>
        </div>
        {submission.submittedAt && (
          <Badge count={`Submitted ${formatRelativeTime(submission.submittedAt)}`} style={{ backgroundColor: '#8b5cf6' }} />
        )}
      </div>

      {/* CONTENT */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '65vh', overflowY: 'auto', paddingRight: 6 }}>
        {/* SECTION A: Worker's Submission */}
        <Card style={{ background: '#1e293b', color: 'white', borderRadius: 12, border: 'none' }} styles={{ body: { padding: 20 } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Space size={10}>
              <Avatar size={28} style={{ backgroundColor: '#6366f1' }}>
                {assignee ? (assignee.firstName || assignee.name || 'U').charAt(0).toUpperCase() : 'U'}
              </Avatar>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#f8fafc' }}>{formatUserName(assignee)}</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>Assignee</div>
              </div>
            </Space>
            <Tag color="purple" style={{ border: 'none', fontWeight: 600, borderRadius: 20 }}>
              Submitted for Review
            </Tag>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, letterSpacing: 0.5, marginBottom: 4 }}>WHAT THEY DID</div>
              <p style={{ fontSize: 13, lineHeight: 1.7, color: '#e2e8f0', margin: 0, whiteSpace: 'pre-wrap' }}>
                {submission.workCompleted || 'No work summary details provided.'}
              </p>
            </div>

            {submission.outcome && (
              <div>
                <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, letterSpacing: 0.5, marginBottom: 4 }}>RESULT</div>
                <p style={{ fontSize: 13, color: '#e2e8f0', margin: 0 }}>{submission.outcome}</p>
              </div>
            )}

            {(submission.before || submission.after) && (
              <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                {submission.before && (
                  <Tag color="red" style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, fontWeight: 600, border: 'none' }}>
                    Before: {submission.before}
                  </Tag>
                )}
                {submission.after && (
                  <Tag color="green" style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, fontWeight: 600, border: 'none' }}>
                    After: {submission.after}
                  </Tag>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #334155', paddingTop: 12, marginTop: 4 }}>
              <Space size={4} style={{ color: '#cbd5e1', fontSize: 12 }}>
                <ClockCircleOutlined />
                <span>Time spent: <strong>{submission.timeSpent || 0} hours</strong></span>
              </Space>
              <Space size={6} style={{ color: '#cbd5e1', fontSize: 12 }}>
                <span>Difficulty:</span>
                <Rate
                  disabled
                  value={submission.difficulty || 3}
                  count={5}
                  style={{ fontSize: 12 }}
                  character={({ index, value }) => {
                    return index < value ? <FlagFilled style={{ color: '#fbbf24' }} /> : <FlagOutlined style={{ color: '#475569' }} />;
                  }}
                />
              </Space>
            </div>

            {submission.referenceLinks && submission.referenceLinks.length > 0 && (
              <div style={{ borderTop: '1px solid #334155', paddingTop: 10 }}>
                <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, letterSpacing: 0.5, marginBottom: 6 }}>REFERENCE LINKS</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {submission.referenceLinks.map((link, idx) => (
                    <a key={idx} href={link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#818cf8', display: 'inline-flex', alignItems: 'center', gap: 4, width: 'fit-content' }}>
                      <LinkOutlined /> {link}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {submission.reviewerNotes && (
              <div style={{ border: '1px dashed #475569', borderRadius: 8, padding: '10px 14px', background: '#1e293b' }}>
                <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Note to reviewer:</span>
                <p style={{ fontSize: 12, color: '#e2e8f0', margin: '4px 0 0 0' }}>{submission.reviewerNotes}</p>
              </div>
            )}
          </div>
        </Card>

        {/* SECTION B: Original Task Details Context */}
        <Collapse ghost style={{ border: '1px solid #e2e8f0', borderRadius: 10, background: '#fafafa' }}>
          <Panel header={<span style={{ fontWeight: 600, fontSize: 12, color: '#475569' }}>View Original Task Details</span>} key="1">
            <div style={{ fontSize: 12, color: '#4b5563', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div><strong>Description:</strong> {task.description || 'No description provided.'}</div>
              <div style={{ display: 'flex', gap: 20 }}>
                <div><strong>Due Date:</strong> {task.dueDate || task.DueDate ? dayjs(task.dueDate || task.DueDate).format('MMM D, YYYY') : 'None'}</div>
                <div><strong>Priority:</strong> {task.priority || 'MEDIUM'}</div>
                <div><strong>Category:</strong> {task.type || task.category || 'General'}</div>
              </div>
              {task.asins && task.asins.length > 0 && (
                <div><strong>Linked ASINs:</strong> {task.asins.length} ASIN(s)</div>
              )}
            </div>
          </Panel>
        </Collapse>

        {/* SECTION C: Your Decision */}
        <div>
          <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, letterSpacing: 0.5, marginBottom: 10 }}>YOUR DECISION</div>
          
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            {/* APPROVE card */}
            <div
              onClick={() => setDecision('APPROVE')}
              style={{
                flex: 1,
                height: 110,
                borderRadius: 12,
                padding: 16,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                border: decision === 'APPROVE' ? '2px solid #10b981' : '1px solid #e2e8f0',
                background: decision === 'APPROVE' ? '#ecfdf5' : 'white',
                boxShadow: decision === 'APPROVE' ? '0 0 0 4px #10b98118' : 'none',
              }}
            >
              <CheckCircleOutlined style={{ fontSize: 28, color: '#10b981' }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#065f46' }}>Approve</div>
                <div style={{ fontSize: 11, color: '#047857', marginTop: 2 }}>Task meets requirements and is complete</div>
              </div>
            </div>

            {/* REJECT card */}
            <div
              onClick={() => setDecision('REJECT')}
              style={{
                flex: 1,
                height: 110,
                borderRadius: 12,
                padding: 16,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                border: decision === 'REJECT' ? '2px solid #ef4444' : '1px solid #e2e8f0',
                background: decision === 'REJECT' ? '#fef2f2' : 'white',
                boxShadow: decision === 'REJECT' ? '0 0 0 4px #ef444418' : 'none',
              }}
            >
              <CloseCircleOutlined style={{ fontSize: 28, color: '#ef4444' }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#991b1b' }}>Reject</div>
                <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 2 }}>Needs more work — send back to assignee</div>
              </div>
            </div>
          </div>

          {/* Feedback Area */}
          {decision && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: 12, display: 'block', marginBottom: 4 }}>
                  {decision === 'APPROVE' ? 'Feedback (Recommended)' : 'What needs to be fixed (Required) *'}
                </span>
                <TextArea
                  rows={3}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder={decision === 'APPROVE' ? 'Let them know what they did well...' : 'Be specific about what needs to change and how...'}
                  maxLength={1000}
                  showCount
                  style={{ borderRadius: 8 }}
                />
              </div>

              {/* REJECT specific fields */}
              {decision === 'REJECT' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, background: '#fafafa', padding: 14, borderRadius: 10, border: '1px solid #f0f0f0' }}>
                  <Row gutter={16}>
                    <Col span={12}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Set new deadline for resubmission</div>
                      <DatePicker
                        style={{ width: '100%' }}
                        disabledDate={(d) => d && d.isBefore(dayjs().startOf('day'))}
                        value={newDueDate}
                        onChange={setNewDueDate}
                      />
                    </Col>
                    <Col span={12}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Reason category</div>
                      <Select
                        placeholder="Select category"
                        style={{ width: '100%' }}
                        value={rejectionCategory}
                        onChange={setRejectionCategory}
                        allowClear
                      >
                        <Option value="Incomplete Work">Incomplete Work</Option>
                        <Option value="Quality Issues">Quality Issues</Option>
                        <Option value="Wrong Approach">Wrong Approach</Option>
                        <Option value="Missing Evidence">Missing Evidence</Option>
                        <Option value="Needs More Detail">Needs More Detail</Option>
                        <Option value="Other">Other</Option>
                      </Select>
                    </Col>
                  </Row>

                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Priority Level of Issues</div>
                    <Radio.Group value={issuesPriority} onChange={(e) => setIssuesPriority(e.target.value)}>
                      <Radio value="Minor">Minor</Radio>
                      <Radio value="Major">Major</Radio>
                      <Radio value="Critical">Critical</Radio>
                    </Radio.Group>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: 16, marginTop: 16 }}>
        <div style={{ fontSize: 11, color: '#94a3b8' }}>
          Your decision will notify the assignee immediately
        </div>
        <Space size={12}>
          <Button type="text" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="primary"
            loading={submitting}
            disabled={!decision || (decision === 'REJECT' && !feedback.trim())}
            onClick={handleConfirm}
            style={{
              height: 36,
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 13,
              border: 'none',
              background: !decision
                ? '#cbd5e1'
                : decision === 'APPROVE'
                  ? '#10b981'
                  : '#ef4444',
            }}
          >
            {!decision
              ? 'Select a Decision'
              : decision === 'APPROVE'
                ? 'Approve Task'
                : 'Reject & Return'}
          </Button>
        </Space>
      </div>
    </Modal>
  );
};

export default ReviewDecisionModal;
