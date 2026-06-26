import React, { useState, useEffect } from 'react';
import {
  Modal, Form, Input, InputNumber, Radio, Button, Space,
  Typography, Tag, Avatar, Alert, message, Divider,
} from 'antd';
import {
  EyeOutlined, CheckCircleOutlined, UserOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import {
  MODAL_STYLES, formatUserName, getStatusStyle, can,
} from './modalHelpers';

const { Text } = Typography;
const { TextArea } = Input;

const CompletionModal = ({ isOpen, action, onClose, onComplete }) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState('REVIEW');

  const hasReviewer = action?.reviewer;
  const canSelfComplete = !hasReviewer && can(action?.currentUser || {}, 'approve_reject');

  useEffect(() => {
    if (isOpen && action) {
      form.resetFields();
      form.setFieldsValue({
        summary: '',
        outcome: '',
        timeSpent: action.estimatedHours || undefined,
      });
      setStage(hasReviewer ? 'REVIEW' : 'COMPLETED');
    }
  }, [isOpen, action, form, hasReviewer]);

  if (!action) return null;

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const data = {
        stage,
        summary: values.summary,
        outcome: values.outcome || '',
        timeSpent: values.timeSpent || null,
        completedAt: new Date().toISOString(),
      };

      await onComplete(action._id || action.id, data);
      message.success(stage === 'REVIEW' ? 'Submitted for review' : 'Task completed');
      form.resetFields();
      onClose();
    } catch (err) {
      if (err.errorFields) return;
      message.error(err?.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const labelStyle = MODAL_STYLES.labelStyle;
  const inputStyle = MODAL_STYLES.inputStyle;
  const statusStyle = getStatusStyle(action.status);
  const reviewerName = action.reviewer ? formatUserName(action.reviewer) : null;

  return (
    <Modal
      open={isOpen}
      onCancel={() => { form.resetFields(); onClose(); }}
      footer={null}
      width={540}
      centered
      destroyOnHidden
    >
      <div style={MODAL_STYLES.headerStyle}>
        <Space size={12} align="center">
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
            Submit Work
          </span>
        </Space>
      </div>

      <div style={{ ...MODAL_STYLES.bodyStyle, maxHeight: '70vh', overflowY: 'auto' }}>
        <Card
          styles={{ body: { padding: '12px 16px' } }}
          style={{ borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 16, background: '#fafbfc' }}
        >
          <Space orientation="vertical" size={6} style={{ width: '100%' }}>
            <Text strong style={{ fontSize: 14, color: '#1e293b' }}>{action.title}</Text>
            <Space size={8}>
              <Tag style={{ borderRadius: 6, fontSize: 11, fontWeight: 600, color: statusStyle.color, background: statusStyle.bg, border: `1px solid ${statusStyle.border}`, margin: 0 }}>
                {action.status}
              </Tag>
            </Space>
            {reviewerName ? (
              <Space size={6}>
                <Avatar size={20} icon={<UserOutlined />} style={{ background: '#f5f3ff', color: '#8b5cf6' }} />
                <Text style={{ fontSize: 12, color: '#64748b' }}>Reviewer: {reviewerName}</Text>
              </Space>
            ) : (
              <Alert
                type="info"
                showIcon
                message="No reviewer assigned — you can mark this complete directly"
                style={{ fontSize: 12, borderRadius: 6, padding: '6px 12px' }}
              />
            )}
          </Space>
        </Card>

        <Form form={form} layout="vertical" scrollToFirstError>
          <Form.Item
            name="summary"
            label={<span style={labelStyle}>Completion Summary <span style={{ color: '#ef4444' }}>*</span></span>}
            rules={[
              { required: true, message: 'Summary is required' },
              { min: 20, message: 'Minimum 20 characters' },
              { max: 2000, message: 'Maximum 2000 characters' },
            ]}
          >
            <TextArea
              rows={4}
              maxLength={2000}
              showCount
              placeholder="Describe what was done and what changed..."
              style={{ borderRadius: 8, fontSize: 13 }}
            />
          </Form.Item>

          <Form.Item
            name="outcome"
            label={<span style={labelStyle}>Outcome / Result</span>}
          >
            <Input placeholder="e.g. ACoS reduced from 22% to 15%" style={{ ...inputStyle, height: 40 }} />
          </Form.Item>

          <Form.Item
            name="timeSpent"
            label={<span style={labelStyle}>Time Spent</span>}
          >
            <InputNumber
              min={0}
              max={999}
              step={0.5}
              style={{ width: '100%', ...inputStyle }}
              addonAfter="hours"
              placeholder="Est: {action.estimatedHours || 0}h"
            />
          </Form.Item>

          <Divider style={{ margin: '12px 0' }} />

          <Form.Item
            label={<span style={labelStyle}>Completion Stage <span style={{ color: '#ef4444' }}>*</span></span>}
          >
            <Radio.Group
              value={stage}
              onChange={e => setStage(e.target.value)}
              style={{ width: '100%' }}
            >
              <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                <Radio
                  value="REVIEW"
                  style={{
                    display: 'flex', alignItems: 'center', padding: '12px 16px',
                    border: `1px solid ${stage === 'REVIEW' ? '#8b5cf6' : '#e2e8f0'}`,
                    borderRadius: 8, background: stage === 'REVIEW' ? '#f5f3ff' : 'white',
                    width: '100%', height: 'auto', margin: 0,
                  }}
                >
                  <Space size={12}>
                    <EyeOutlined style={{ fontSize: 18, color: stage === 'REVIEW' ? '#8b5cf6' : '#94a3b8' }} />
                    <Space orientation="vertical" size={2}>
                      <Text strong style={{ fontSize: 13, color: stage === 'REVIEW' ? '#8b5cf6' : '#374151' }}>
                        Submit for Review
                      </Text>
                      <Text style={{ fontSize: 11, color: '#94a3b8' }}>
                        Send to {reviewerName || 'reviewer'} for approval
                      </Text>
                    </Space>
                  </Space>
                </Radio>

                <Radio
                  value="COMPLETED"
                  disabled={!!hasReviewer}
                  style={{
                    display: 'flex', alignItems: 'center', padding: '12px 16px',
                    border: `1px solid ${stage === 'COMPLETED' ? '#10b981' : '#e2e8f0'}`,
                    borderRadius: 8, background: stage === 'COMPLETED' ? '#ecfdf5' : 'white',
                    width: '100%', height: 'auto', margin: 0,
                    opacity: hasReviewer ? 0.5 : 1,
                  }}
                >
                  <Space size={12}>
                    <CheckCircleOutlined style={{ fontSize: 18, color: stage === 'COMPLETED' ? '#10b981' : '#94a3b8' }} />
                    <Space orientation="vertical" size={2}>
                      <Text strong style={{ fontSize: 13, color: stage === 'COMPLETED' ? '#10b981' : '#374151' }}>
                        Mark as Complete
                      </Text>
                      <Text style={{ fontSize: 11, color: '#94a3b8' }}>
                        {hasReviewer ? 'Disabled — reviewer assigned' : 'Mark done without review'}
                      </Text>
                    </Space>
                  </Space>
                </Radio>
              </Space>
            </Radio.Group>
          </Form.Item>
        </Form>
      </div>

      <div style={MODAL_STYLES.footerStyle}>
        <Button onClick={() => { form.resetFields(); onClose(); }} style={MODAL_STYLES.cancelBtn}>Cancel</Button>
        <Button
          type="primary"
          onClick={handleSubmit}
          loading={submitting}
          style={{
            ...MODAL_STYLES.primaryBtn,
            background: stage === 'COMPLETED' ? '#10b981' : '#6366f1',
          }}
        >
          {stage === 'REVIEW' ? 'Submit for Review' : 'Mark Complete'}
        </Button>
      </div>
    </Modal>
  );
};

export default CompletionModal;
