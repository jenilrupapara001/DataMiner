import React, { useState, useEffect } from 'react';
import {
  Modal, Form, Input, InputNumber, Rate, Select, Button,
  Space, Row, Col, Tooltip, Tag, notification
} from 'antd';
import {
  SendOutlined, FlagOutlined, FlagFilled,
  DeleteOutlined, PlusOutlined, CheckCircleOutlined, PaperClipOutlined
} from '@ant-design/icons';
import { formatUserName } from './workflowHelpers';

const { TextArea } = Input;
const { Option } = Select;

const METRIC_PRESETS = [
  'ACoS', 'ROAS', 'CTR', 'CVR', 'BSR', 'Revenue',
  'Orders', 'Sessions', 'Reviews', 'Rating', 'LQS', 'Impressions'
];

const DIFFICULTY_TOOLTIPS = ['Very Easy', 'Easy', 'Moderate', 'Hard', 'Very Hard'];

const FieldLabel = ({ children, required }) => (
  <div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>
    {children} {required && <span style={{ color: '#dc2626' }}>*</span>}
  </div>
);

const SubmitTaskModal = ({ isOpen, task, currentUser, onClose, onSubmit }) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [links, setLinks] = useState(['']);
  const [timeSpentVal, setTimeSpentVal] = useState(undefined);

  useEffect(() => {
    if (isOpen && task) {
      const startedAt = task.timeTracking?.startedAt;
      let calculatedHours = undefined;
      if (startedAt) {
        const msDiff = new Date() - new Date(startedAt);
        calculatedHours = Math.max(0.5, Math.round((msDiff / 3600000) * 2) / 2);
      }

      form.setFieldsValue({
        workCompleted: '',
        outcome: '',
        beforeValue: '',
        afterValue: '',
        metricsImproved: [],
        timeSpent: calculatedHours,
        difficulty: 3,
        reviewerNotes: '',
      });
      setTimeSpentVal(calculatedHours);
      setLinks(['']);
    }
  }, [isOpen, task, form]);

  if (!task) return null;

  const handleAddLink = () => { if (links.length < 5) setLinks([...links, '']); };
  const handleLinkChange = (index, value) => { const n = [...links]; n[index] = value; setLinks(n); };
  const handleRemoveLink = (index) => { const n = links.filter((_, i) => i !== index); setLinks(n.length > 0 ? n : ['']); };

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
      const reviewerName = formatUserName(task.reviewer);
      notification.success({
        message: hasReviewer ? 'Submitted for review!' : 'Task marked complete!',
        description: hasReviewer ? `${reviewerName} has been notified.` : 'Great work! Task completed.',
        duration: 4,
      });
      onClose();
    } catch (e) { console.error(e); }
    finally { setSubmitting(false); }
  };

  const hasReviewer = !!task.reviewer;

  return (
    <Modal open={isOpen} onCancel={onClose} footer={null} width={600} centered
      closable={!submitting} maskClosable={false} destroyOnClose
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SendOutlined style={{ fontSize: 14, color: '#7c3aed' }} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#18181b' }}>Submit for Review</div>
            <div style={{ fontSize: 11, color: '#a1a1aa', marginTop: 1 }}>
              {task.title || task.action || task.name}
            </div>
          </div>
        </div>
      }
    >
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        {/* Work Summary */}
        <div style={{ fontSize: 10, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Work Summary</div>
        <Form.Item name="workCompleted" style={{ marginBottom: 4 }}
          rules={[{ required: true, message: 'Describe your work' }, { min: 30, message: 'At least 30 characters' }]}>
          <TextArea rows={4} autoSize={{ minRows: 3, maxRows: 8 }}
            placeholder="Describe what you did, tools used, challenges faced..."
            showCount maxLength={3000} style={{ borderRadius: 8 }} />
        </Form.Item>

        {/* Outcome */}
        <div style={{ fontSize: 10, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, marginTop: 16 }}>Outcome</div>
        <Form.Item name="outcome" style={{ marginBottom: 8 }}>
          <Input placeholder="e.g. ACoS reduced from 22% to 14%, 6 images uploaded" maxLength={500} style={{ borderRadius: 8 }} />
        </Form.Item>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="beforeValue" style={{ marginBottom: 8 }}>
              <Input placeholder="Before: e.g. ACoS 22%" maxLength={100} style={{ borderRadius: 8 }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="afterValue" style={{ marginBottom: 8 }}>
              <Input placeholder="After: e.g. ACoS 14%" maxLength={100} style={{ borderRadius: 8 }} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="metricsImproved" style={{ marginBottom: 8 }}>
          <Select mode="tags" placeholder="Select or type metrics that improved" style={{ borderRadius: 8 }}>
            {METRIC_PRESETS.map(m => <Option key={m} value={m}>{m}</Option>)}
          </Select>
        </Form.Item>

        {/* Time & Effort */}
        <div style={{ fontSize: 10, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, marginTop: 16 }}>Time & Effort</div>
        <Row gutter={12}>
          <Col span={8}>
            <Form.Item name="timeSpent" style={{ marginBottom: 8 }}
              rules={[{ required: true, message: 'Required' }]}
              help={timeSpentVal ? <span style={{ fontSize: 10, color: '#059669' }}>Auto-calculated</span> : null}>
              <InputNumber min={0.5} max={999} step={0.5} addonAfter="hrs" placeholder="0"
                style={{ width: '100%', borderRadius: 8 }} />
            </Form.Item>
          </Col>
          <Col span={16}>
            <Form.Item name="difficulty" style={{ marginBottom: 8 }}>
              <Rate count={5} tooltips={DIFFICULTY_TOOLTIPS}
                character={({ index, value }) =>
                  index < value ? <FlagFilled style={{ fontSize: 14 }} /> : <FlagOutlined style={{ fontSize: 14 }} />
                } />
            </Form.Item>
          </Col>
        </Row>

        {/* Evidence */}
        <div style={{ fontSize: 10, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, marginTop: 16 }}>Evidence & Notes</div>
        {links.map((link, idx) => (
          <div key={idx} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <Input size="small" prefix={<PaperClipOutlined style={{ color: '#a1a1aa' }} />} placeholder="https://..."
              value={link} onChange={e => handleLinkChange(idx, e.target.value)} style={{ borderRadius: 8 }} />
            {links.length > 1 && <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => handleRemoveLink(idx)} />}
          </div>
        ))}
        {links.length < 5 && (
          <Button type="text" size="small" icon={<PlusOutlined />} onClick={handleAddLink}
            style={{ fontSize: 11, color: '#71717a', marginBottom: 8, padding: 0 }}>Add link</Button>
        )}
        <Form.Item name="reviewerNotes" style={{ marginBottom: 0 }}>
          <TextArea rows={2} maxLength={500} placeholder="Additional notes for reviewer..." showCount style={{ borderRadius: 8 }} />
        </Form.Item>
      </Form>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid #f4f4f5', paddingTop: 12, marginTop: 16 }}>
        <Button onClick={onClose} disabled={submitting} style={{ borderRadius: 8, fontSize: 11 }}>Cancel</Button>
        <Button type="primary" loading={submitting}
          disabled={!form.getFieldValue('workCompleted') || (form.getFieldValue('workCompleted') || '').trim().length < 30}
          onClick={handleConfirmSubmit}
          icon={hasReviewer ? <SendOutlined /> : <CheckCircleOutlined />}
          style={{ borderRadius: 8, fontWeight: 600, fontSize: 11, height: 32 }}>
          {hasReviewer ? 'Submit for Review' : 'Mark Complete'}
        </Button>
      </div>
    </Modal>
  );
};

export default SubmitTaskModal;
