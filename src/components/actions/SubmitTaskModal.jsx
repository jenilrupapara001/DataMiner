import React, { useState, useEffect, useRef } from 'react';
import {
  Modal, Form, Input, InputNumber, Rate, Select, Button,
  Space, Row, Col, Tag, notification, Upload, Typography, Progress
} from 'antd';
import {
  SendOutlined, FlagOutlined, FlagFilled, DeleteOutlined, PlusOutlined,
  CheckCircleOutlined, PaperClipOutlined, UploadOutlined, SoundOutlined
} from '@ant-design/icons';
import { formatUserName } from './workflowHelpers';

const { TextArea } = Input;
const { Option } = Select;
const { Text } = Typography;

const METRIC_PRESETS = [
  'ACoS', 'ROAS', 'CTR', 'CVR', 'BSR', 'Revenue',
  'Orders', 'Sessions', 'Reviews', 'Rating', 'LQS', 'Impressions'
];

const DIFFICULTY_TOOLTIPS = ['Very Easy', 'Easy', 'Moderate', 'Hard', 'Very Hard'];

const SectionHeader = ({ title, icon }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, marginTop: 16 }}>
    {icon && <div style={{ width: 20, height: 20, borderRadius: 5, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>}
    <span style={{ fontSize: 10, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</span>
  </div>
);

const SubmitTaskModal = ({ isOpen, task, currentUser, onClose, onSubmit }) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [links, setLinks] = useState(['']);
  const [audioFile, setAudioFile] = useState(null);
  const [audioPreview, setAudioPreview] = useState(null);
  const [audioUploading, setAudioUploading] = useState(false);
  const [audioTranscript, setAudioTranscript] = useState('');
  const fileInputRef = useRef(null);

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
      setLinks(['']);
      setAudioFile(null);
      setAudioPreview(null);
      setAudioTranscript('');
    }
  }, [isOpen, task, form]);

  if (!task) return null;

  const handleAddLink = () => { if (links.length < 5) setLinks([...links, '']); };
  const handleLinkChange = (index, value) => { const n = [...links]; n[index] = value; setLinks(n); };
  const handleRemoveLink = (index) => { const n = links.filter((_, i) => i !== index); setLinks(n.length > 0 ? n : ['']); };

  const handleAudioSelect = (e) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      notification.warning({ message: 'Audio file too large', description: 'Maximum 10MB allowed.' });
      return;
    }
    setAudioFile(file);
    setAudioPreview({ name: file.name, size: (file.size / 1024 / 1024).toFixed(2) + ' MB' });
  };

  const handleConfirmSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      let audioUrl = null;
      if (audioFile) {
        setAudioUploading(true);
        const formData = new FormData();
        formData.append('audio', audioFile);
        formData.append('transcript', audioTranscript);
        audioUrl = await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', `/api/actions/${task._id || task.id}/upload-audio`);
          const token = localStorage.getItem('authToken');
          if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          xhr.onload = () => {
            try {
              const res = JSON.parse(xhr.responseText);
              resolve(res.data?.audioUrl || null);
            } catch { resolve(null); }
          };
          xhr.onerror = () => reject(new Error('Upload failed'));
          xhr.send(formData);
        });
        setAudioUploading(false);
      }

      const hasReviewer = !!task.reviewer;
      const submissionData = {
        workCompleted: values.workCompleted || '',
        outcome: values.outcome || null,
        before: values.beforeValue || null,
        after: values.afterValue || null,
        metricsImproved: values.metricsImproved || [],
        timeSpent: values.timeSpent || null,
        difficulty: values.difficulty || 3,
        completedSubtasks: values.completedSubtasks || [],
        referenceLinks: links.filter(Boolean),
        audioUrl,
        audioTranscript: audioTranscript || null,
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
    finally { setSubmitting(false); setAudioUploading(false); }
  };

  const hasReviewer = !!task.reviewer;
  const completedCount = (task.subTasks || []).filter(st => st.completed).length;
  const totalCount = (task.subTasks || []).length;

  return (
    <Modal open={isOpen} onCancel={onClose} footer={null} width={620} centered
      closable={!submitting} mask={{ closable: false }} destroyOnHidden
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: hasReviewer ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 2px 8px ${hasReviewer ? 'rgba(99,102,241,0.3)' : 'rgba(16,185,129,0.3)'}` }}>
            {hasReviewer ? <SendOutlined style={{ fontSize: 14, color: '#fff' }} /> : <CheckCircleOutlined style={{ fontSize: 14, color: '#fff' }} />}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{hasReviewer ? 'Submit for Review' : 'Mark Complete'}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1, maxWidth: 350, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {task.title || task.action || task.name}
            </div>
          </div>
        </div>
      }
    >
      <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
        {/* Work Summary - REQUIRED */}
        <SectionHeader title="Work Summary" />
        <Form.Item name="workCompleted" style={{ marginBottom: 4 }}
          rules={[{ required: true, message: 'Please describe what you did' }]}>
          <TextArea rows={4} autoSize={{ minRows: 3, maxRows: 8 }}
            placeholder="Describe what you did, tools used, challenges faced..."
            showCount maxLength={3000} style={{ borderRadius: 8 }} />
        </Form.Item>

        {/* Outcome */}
        <SectionHeader title="Outcome & Results" />
        <Form.Item name="outcome" style={{ marginBottom: 8 }}>
          <Input placeholder="e.g. ACoS reduced from 22% to 14%, 6 images uploaded" maxLength={500} style={{ borderRadius: 8 }} />
        </Form.Item>
        <Row gutter={10}>
          <Col span={12}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#a1a1aa', marginBottom: 4 }}>Before</div>
            <Form.Item name="beforeValue" style={{ marginBottom: 8 }}>
              <Input placeholder="e.g. ACoS 22%" maxLength={100} style={{ borderRadius: 8 }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#a1a1aa', marginBottom: 4 }}>After</div>
            <Form.Item name="afterValue" style={{ marginBottom: 8 }}>
              <Input placeholder="e.g. ACoS 14%" maxLength={100} style={{ borderRadius: 8 }} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="metricsImproved" style={{ marginBottom: 0 }}>
          <Select mode="tags" placeholder="Select or type metrics that improved" style={{ borderRadius: 8 }}>
            {METRIC_PRESETS.map(m => <Option key={m} value={m}>{m}</Option>)}
          </Select>
        </Form.Item>

        {/* Time & Effort */}
        <SectionHeader title="Time & Effort" />
        <Row gutter={10}>
          <Col span={8}>
            <Form.Item name="timeSpent" style={{ marginBottom: 8 }}>
              <InputNumber min={0.5} max={999} step={0.5} addonAfter="hrs" placeholder="0"
                style={{ width: '100%', borderRadius: 8 }} />
            </Form.Item>
          </Col>
          <Col span={16}>
            <Form.Item name="difficulty" style={{ marginBottom: 8 }}>
              <Rate count={5} tooltips={DIFFICULTY_TOOLTIPS}
                character={({ index, value }) =>
                  index < value ? <FlagFilled style={{ fontSize: 14, color: '#f59e0b' }} /> : <FlagOutlined style={{ fontSize: 14, color: '#d4d4d8' }} />
                } />
            </Form.Item>
          </Col>
        </Row>

        {/* Subtasks Progress */}
        {totalCount > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: '#71717a' }}>Subtask Progress</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: completedCount === totalCount ? '#059669' : '#71717a' }}>{completedCount}/{totalCount}</span>
            </div>
            <Progress percent={Math.round((completedCount / totalCount) * 100)} size="small"
              strokeColor={completedCount === totalCount ? '#10b981' : '#6366f1'} showInfo={false} />
          </div>
        )}

        {/* Evidence */}
        <SectionHeader title="Evidence & Links" />
        {links.map((link, idx) => (
          <div key={idx} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <Input size="small" prefix={<PaperClipOutlined style={{ color: '#a1a1aa' }} />} placeholder="https://..."
              value={link} onChange={e => handleLinkChange(idx, e.target.value)} style={{ borderRadius: 8 }} />
            {links.length > 1 && (
              <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => handleRemoveLink(idx)}
                style={{ flexShrink: 0 }} />
            )}
          </div>
        ))}
        {links.length < 5 && (
          <Button type="text" size="small" icon={<PlusOutlined />} onClick={handleAddLink}
            style={{ fontSize: 11, color: '#64748b', marginBottom: 8, padding: 0 }}>Add link</Button>
        )}

        {/* Audio Recording */}
        <div style={{ marginTop: 8, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input ref={fileInputRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={handleAudioSelect} />
            <Button size="small" icon={<SoundOutlined />} onClick={() => fileInputRef.current?.click()}
              style={{ borderRadius: 8, fontSize: 11, border: '1px dashed #d4d4d8', color: '#64748b' }}>
              {audioFile ? 'Replace Audio' : 'Attach Audio'}
            </Button>
            {audioPreview && (
              <Tag closable onClose={() => { setAudioFile(null); setAudioPreview(null); setAudioTranscript(''); }}
                style={{ borderRadius: 6, fontSize: 11, background: '#f0fdf4', color: '#059669', border: '1px solid #a7f3d0' }}>
                {audioPreview.name} ({audioPreview.size})
              </Tag>
            )}
          </div>
          {audioFile && (
            <Input.TextArea size="small" rows={2} value={audioTranscript}
              onChange={e => setAudioTranscript(e.target.value)}
              placeholder="Audio transcript or notes (optional)"
              style={{ borderRadius: 8, marginTop: 6 }} />
          )}
        </div>

        {/* Notes */}
        <SectionHeader title="Additional Notes" />
        <Form.Item name="reviewerNotes" style={{ marginBottom: 0 }}>
          <TextArea rows={2} maxLength={500} placeholder="Any extra context for the reviewer..." showCount style={{ borderRadius: 8 }} />
        </Form.Item>
      </Form>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: 14, marginTop: 16 }}>
        <Text style={{ fontSize: 11, color: '#94a3b8' }}>
          {hasReviewer ? 'Your submission will be sent to the reviewer for approval.' : 'Task will be marked as completed.'}
        </Text>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button onClick={onClose} disabled={submitting} style={{ borderRadius: 8, fontSize: 11, height: 32 }}>Cancel</Button>
          <Button type="primary" loading={submitting || audioUploading}
            onClick={handleConfirmSubmit}
            icon={hasReviewer ? <SendOutlined /> : <CheckCircleOutlined />}
            style={{ borderRadius: 8, fontWeight: 600, fontSize: 11, height: 32,
              background: hasReviewer ? '#4f46e5' : '#059669', borderColor: hasReviewer ? '#4f46e5' : '#059669' }}>
            {submitting ? 'Submitting...' : audioUploading ? 'Uploading audio...' : hasReviewer ? 'Submit for Review' : 'Mark Complete'}
        </Button>
        </div>
      </div>
    </Modal>
  );
};

export default SubmitTaskModal;
