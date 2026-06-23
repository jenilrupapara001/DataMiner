import React, { useState, useEffect } from 'react';
import {
  Modal, Form, Input, InputNumber, Rate, Select, Collapse,
  Button, Space, Divider, Row, Col, Alert, notification, Tooltip
} from 'antd';
import {
  SendOutlined, FlagOutlined, FlagFilled,
  DeleteOutlined, PlusOutlined, CheckCircleOutlined
} from '@ant-design/icons';
import { formatUserName } from './workflowHelpers';

const { TextArea } = Input;
const { Option } = Select;
const { Panel } = Collapse;

const METRIC_PRESETS = [
  'ACoS', 'ROAS', 'CTR', 'CVR', 'BSR', 'Revenue',
  'Orders', 'Sessions', 'Reviews', 'Rating', 'LQS', 'Impressions'
];

const DIFFICULTY_TOOLTIPS = ['Very Easy', 'Easy', 'Moderate', 'Hard', 'Very Hard'];

const SubmitTaskModal = ({ isOpen, task, currentUser, onClose, onSubmit }) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [draftBanner, setDraftBanner] = useState(null);
  
  // Live states for preview
  const [workCompletedVal, setWorkCompletedVal] = useState('');
  const [outcomeVal, setOutcomeVal] = useState('');
  const [timeSpentVal, setTimeSpentVal] = useState(undefined);
  const [isAutoCalculated, setIsAutoCalculated] = useState(false);

  // Dynamic links list state
  const [links, setLinks] = useState(['']);

  useEffect(() => {
    if (isOpen && task) {
      // 1. Calculate time spent from startedAt
      const startedAt = task.timeTracking?.startedAt;
      let calculatedHours = undefined;
      let isAuto = false;
      if (startedAt) {
        const msDiff = new Date() - new Date(startedAt);
        const hours = msDiff / 3600000;
        calculatedHours = Math.max(0.5, Math.round(hours * 2) / 2);
        isAuto = true;
      }

      form.setFieldsValue({
        workCompleted: '',
        outcome: '',
        beforeValue: '',
        afterValue: '',
        metricsImproved: [],
        timeSpent: calculatedHours,
        difficulty: 3,
        completedSubtasks: task.subtasks
          ? task.subtasks.filter(s => s.status === 'COMPLETED').map(s => s._id || s.id)
          : [],
        reviewerNotes: '',
      });

      setWorkCompletedVal('');
      setOutcomeVal('');
      setTimeSpentVal(calculatedHours);
      setIsAutoCalculated(isAuto);
      setLinks(['']);

      // Check draft
      const draftKey = `task_draft_${task._id || task.id}`;
      const savedDraftStr = localStorage.getItem(draftKey);
      if (savedDraftStr) {
        try {
          const draft = JSON.parse(savedDraftStr);
          setDraftBanner(draft);
        } catch (_) {}
      } else {
        setDraftBanner(null);
      }
    }
  }, [isOpen, task, form]);

  if (!task) return null;

  const handleRestoreDraft = () => {
    if (draftBanner) {
      form.setFieldsValue(draftBanner.formValues);
      setLinks(draftBanner.links || ['']);
      setWorkCompletedVal(draftBanner.formValues.workCompleted || '');
      setOutcomeVal(draftBanner.formValues.outcome || '');
      setTimeSpentVal(draftBanner.formValues.timeSpent);
      localStorage.removeItem(`task_draft_${task._id || task.id}`);
      setDraftBanner(null);
    }
  };

  const handleStartFresh = () => {
    localStorage.removeItem(`task_draft_${task._id || task.id}`);
    setDraftBanner(null);
  };

  const handleSaveDraft = () => {
    const draftKey = `task_draft_${task._id || task.id}`;
    const formValues = form.getFieldsValue();
    const draftData = {
      timestamp: new Date().toISOString(),
      formValues,
      links,
    };
    localStorage.setItem(draftKey, JSON.stringify(draftData));
    notification.success({
      message: 'Draft Saved',
      description: 'Your submission draft has been saved locally.',
      duration: 3,
    });
  };

  const handleAddLink = () => {
    if (links.length < 5) {
      setLinks([...links, '']);
    }
  };

  const handleLinkChange = (index, value) => {
    const newLinks = [...links];
    newLinks[index] = value;
    setLinks(newLinks);
  };

  const handleRemoveLink = (index) => {
    const newLinks = links.filter((_, i) => i !== index);
    setLinks(newLinks.length > 0 ? newLinks : ['']);
  };

  const handleConfirmSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      
      const hasReviewer = !!task.reviewer;
      const submissionData = {
        workCompleted: values.workCompleted,
        outcome: values.outcome || null,
        before: values.beforeValue || null,
        after: values.afterValue || null,
        metricsImproved: values.metricsImproved || [],
        timeSpent: values.timeSpent,
        difficulty: values.difficulty,
        completedSubtasks: values.completedSubtasks || [],
        referenceLinks: links.filter(Boolean),
        reviewerNotes: values.reviewerNotes || '',
        submittedAt: new Date().toISOString(),
        stage: hasReviewer ? 'REVIEW' : 'COMPLETED',
      };

      await onSubmit(task._id || task.id, submissionData);

      localStorage.removeItem(`task_draft_${task._id || task.id}`);
      
      const reviewerName = formatUserName(task.reviewer);
      notification.success({
        message: hasReviewer ? "Submitted for review!" : "Task marked complete!",
        description: hasReviewer
          ? `${reviewerName} has been notified and will review your work.`
          : "Great work! This task has been marked as completed.",
        duration: 5
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const hasReviewer = !!task.reviewer;
  const reviewerFirstName = task.reviewer
    ? (task.reviewer.firstName || task.reviewer.name || '').split(' ')[0]
    : '';

  return (
    <Modal
      open={isOpen}
      onCancel={onClose}
      footer={null}
      width={640}
      centered
      maskClosable={false}
      destroyOnClose
    >
      {/* HEADER AREA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ background: '#eef2ff', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1' }}>
            <SendOutlined style={{ fontSize: 20 }} />
          </div>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#1e293b' }}>Submit for Review</h3>
            <p style={{ fontSize: 13, color: '#64748b', margin: 0, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {task.action || task.title || task.name}
            </p>
          </div>
        </div>

        {hasReviewer ? (
          <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 20, padding: '4px 10px', fontSize: 11, color: '#8b5cf6', fontWeight: 600 }}>
            Sending to {reviewerFirstName}
          </div>
        ) : (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 20, padding: '4px 10px', fontSize: 11, color: '#d97706', fontWeight: 600 }}>
            No reviewer assigned — will auto-complete
          </div>
        )}
      </div>

      {/* DRAFT BANNER */}
      {draftBanner && (
        <Alert
          message={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
              <span>You have an unsaved draft from {new Date(draftBanner.timestamp).toLocaleTimeString()}</span>
              <Space>
                <Button size="small" type="primary" onClick={handleRestoreDraft}>Restore Draft</Button>
                <Button size="small" onClick={handleStartFresh}>Start Fresh</Button>
              </Space>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 16, borderRadius: 8 }}
        />
      )}

      {/* FORM CONTENT */}
      <Form
        form={form}
        layout="vertical"
        onValuesChange={(changedValues, allValues) => {
          if ('workCompleted' in changedValues) setWorkCompletedVal(changedValues.workCompleted);
          if ('outcome' in changedValues) setOutcomeVal(changedValues.outcome);
          if ('timeSpent' in changedValues) setTimeSpentVal(changedValues.timeSpent);
        }}
      >
        {/* SECTION A: WORK SUMMARY */}
        <Divider orientation="left" style={{ margin: '12px 0', borderColor: '#f1f5f9' }}>
          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700, letterSpacing: 0.5 }}>WORK SUMMARY</span>
        </Divider>

        <Form.Item
          name="workCompleted"
          label={<span style={{ fontWeight: 600, fontSize: 12 }}>Work Completed <span style={{ color: '#ef4444' }}>*</span></span>}
          rules={[
            { required: true, message: 'Please describe your work' },
            { min: 30, message: 'Please provide at least 30 characters' },
          ]}
        >
          <TextArea
            rows={4}
            autoSize={{ minRows: 4, maxRows: 10 }}
            placeholder="Describe exactly what you did for this task. Be specific — the reviewer will use this to evaluate your work."
            showCount
            minLength={30}
            maxLength={3000}
            style={{ borderRadius: 8 }}
          />
        </Form.Item>
        <p style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic', marginTop: -18, marginBottom: 12 }}>
          Tip: Include what changed, what tools or platforms you used, and any challenges you encountered.
        </p>

        {/* SECTION B: OUTCOME */}
        <Divider orientation="left" style={{ margin: '12px 0', borderColor: '#f1f5f9' }}>
          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700, letterSpacing: 0.5 }}>OUTCOME</span>
        </Divider>

        <Form.Item
          name="outcome"
          label={<span style={{ fontWeight: 600, fontSize: 12 }}>Result / Outcome (Optional)</span>}
        >
          <Input
            placeholder="e.g. ACoS reduced from 22% to 14%, CTR improved by 0.8%, 6 new images uploaded"
            maxLength={500}
            style={{ borderRadius: 8 }}
          />
        </Form.Item>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="beforeValue"
              label={<span style={{ fontWeight: 600, fontSize: 12 }}>Before (Optional)</span>}
            >
              <Input placeholder="Before: e.g. ACoS 22%" maxLength={100} style={{ borderRadius: 8 }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="afterValue"
              label={<span style={{ fontWeight: 600, fontSize: 12 }}>After (Optional)</span>}
            >
              <Input placeholder="After: e.g. ACoS 14%" maxLength={100} style={{ borderRadius: 8 }} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="metricsImproved"
          label={<span style={{ fontWeight: 600, fontSize: 12 }}>Metrics Improved (Optional)</span>}
        >
          <Select
            mode="tags"
            placeholder="Select or type metrics that improved"
            style={{ width: '100%', borderRadius: 8 }}
          >
            {METRIC_PRESETS.map(m => (
              <Option key={m} value={m}>{m}</Option>
            ))}
          </Select>
        </Form.Item>

        {/* SECTION C: TIME TRACKING */}
        <Divider orientation="left" style={{ margin: '12px 0', borderColor: '#f1f5f9' }}>
          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700, letterSpacing: 0.5 }}>TIME &amp; EFFORT</span>
        </Divider>

        <Row gutter={16} align="bottom">
          <Col span={8}>
            <Form.Item
              name="timeSpent"
              label={<span style={{ fontWeight: 600, fontSize: 12 }}>Time Spent <span style={{ color: '#ef4444' }}>*</span></span>}
              rules={[{ required: true, message: 'Required' }]}
              help={isAutoCalculated ? <span style={{ fontSize: 10, color: '#10b981' }}>Auto-calculated from start time</span> : null}
            >
              <InputNumber
                min={0.5}
                max={999}
                step={0.5}
                addonAfter="hours"
                placeholder="0"
                style={{ width: '100%', borderRadius: 8 }}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="difficulty"
              label={<span style={{ fontWeight: 600, fontSize: 12 }}>Difficulty</span>}
            >
              <Rate
                count={5}
                tooltips={DIFFICULTY_TOOLTIPS}
                character={({ index, value }) => {
                  return index < value ? <FlagFilled style={{ fontSize: 18 }} /> : <FlagOutlined style={{ fontSize: 18 }} />;
                }}
              />
            </Form.Item>
          </Col>
          {task.subtasks && task.subtasks.length > 0 && (
            <Col span={8}>
              <Form.Item
                name="completedSubtasks"
                label={<span style={{ fontWeight: 600, fontSize: 12 }}>Subtasks Completed</span>}
              >
                <Select
                  mode="multiple"
                  placeholder="Mark subtasks done"
                  style={{ width: '100%' }}
                >
                  {task.subtasks.map(s => (
                    <Option key={s._id || s.id} value={s._id || s.id}>
                      {s.title || s.action || 'Untitled Subtask'}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          )}
        </Row>

        {/* SECTION D: EVIDENCE collapse */}
        <Divider orientation="left" style={{ margin: '12px 0', borderColor: '#f1f5f9' }}>
          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700, letterSpacing: 0.5 }}>SUPPORTING EVIDENCE</span>
        </Divider>

        <Collapse ghost style={{ background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 16 }}>
          <Panel header={<span style={{ fontWeight: 600, fontSize: 12, color: '#334155' }}>Add links, screenshots, or notes (optional)</span>} key="1">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={{ fontWeight: 600, fontSize: 12 }}>Reference Links (Max 5)</span>
              {links.map((link, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Input
                    placeholder="https://..."
                    value={link}
                    onChange={(e) => handleLinkChange(idx, e.target.value)}
                    style={{ borderRadius: 8 }}
                  />
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleRemoveLink(idx)}
                  />
                </div>
              ))}
              {links.length < 5 && (
                <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddLink} style={{ width: 'fit-content' }}>
                  Add another link
                </Button>
              )}

              <Form.Item
                name="reviewerNotes"
                label={<span style={{ fontWeight: 600, fontSize: 12, marginTop: 10, display: 'block' }}>Additional Notes for Reviewer</span>}
              >
                <TextArea
                  rows={2}
                  maxLength={500}
                  placeholder="Anything else the reviewer should know..."
                  showCount
                  style={{ borderRadius: 8 }}
                />
              </Form.Item>
            </div>
          </Panel>
        </Collapse>

        {/* SUBMISSION PREVIEW */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Preview — Reviewer will see:
          </div>
          <div style={{ fontSize: 12, color: '#334155', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div>
              <span style={{ fontWeight: 600 }}>Work summary:</span>{' '}
              {workCompletedVal ? (
                workCompletedVal.length > 100 ? `${workCompletedVal.substring(0, 100)}...` : workCompletedVal
              ) : (
                <span style={{ color: '#a0aec0', fontStyle: 'italic' }}>Required - Type to preview</span>
              )}
            </div>
            <div>
              <span style={{ fontWeight: 600 }}>Result:</span>{' '}
              {outcomeVal || <span style={{ color: '#a0aec0' }}>Not specified</span>}
            </div>
            <div>
              <span style={{ fontWeight: 600 }}>Time spent:</span>{' '}
              {timeSpentVal !== undefined ? `${timeSpentVal}h` : <span style={{ color: '#a0aec0' }}>Required</span>}
            </div>
            <div>
              <span style={{ fontWeight: 600 }}>Reviewer:</span>{' '}
              {hasReviewer ? formatUserName(task.reviewer) : 'Auto-complete (no reviewer)'}
            </div>
          </div>
        </div>
      </Form>

      {/* FOOTER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
        <div style={{ fontSize: 11, color: '#94a3b8' }}>
          Submitting will lock this task until reviewed
        </div>
        <Space size={12}>
          <Button onClick={handleSaveDraft} style={{ height: 34, borderRadius: 8 }}>
            Save Draft
          </Button>
          <Button type="text" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          
          <Button
            type="primary"
            loading={submitting}
            disabled={workCompletedVal.trim().length < 30 || timeSpentVal === undefined || timeSpentVal === null}
            onClick={handleConfirmSubmit}
            icon={hasReviewer ? <SendOutlined /> : <CheckCircleOutlined />}
            style={{
              height: 36,
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 13,
              border: 'none',
              background: workCompletedVal.trim().length < 30 || timeSpentVal === undefined || timeSpentVal === null
                ? '#cbd5e1'
                : hasReviewer
                  ? 'linear-gradient(135deg, #8b5cf6, #6366f1)'
                  : 'linear-gradient(135deg, #10b981, #059669)',
            }}
          >
            {hasReviewer ? 'Submit for Review' : 'Mark as Complete'}
          </Button>
        </Space>
      </div>
    </Modal>
  );
};

export default SubmitTaskModal;
