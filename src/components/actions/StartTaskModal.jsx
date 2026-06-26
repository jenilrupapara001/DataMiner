import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, DatePicker, Checkbox, Button, Tag, Space, Alert, Avatar } from 'antd';
import { UserOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { formatUserName } from './workflowHelpers';

const { TextArea } = Input;

const StartTaskModal = ({ isOpen, task, currentUser, onClose, onConfirm }) => {
  const [form] = Form.useForm();
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && task) {
      form.setFieldsValue({
        startNote: '',
      });
      setAcknowledged(false);
    }
  }, [isOpen, task, form]);

  if (!task) return null;

  const handleConfirm = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const startData = {
        startNote: values.startNote,
        startedAt: new Date().toISOString(),
      };
      await onConfirm(task._id || task.id, startData);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // Due Date alert/text computation
  const dueDateVal = task.dueDate || task.DueDate;
  const isOverdue = dueDateVal && dayjs(dueDateVal).isBefore(dayjs().startOf('day'));
  const isDueToday = dueDateVal && dayjs(dueDateVal).isSame(dayjs(), 'day');
  const daysOverdue = dueDateVal ? dayjs().diff(dayjs(dueDateVal), 'day') : 0;

  return (
    <Modal
      open={isOpen}
      onCancel={onClose}
      footer={null}
      width={480}
      centered
      mask={{ closable: false }}
      destroyOnHidden
    >
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#1e293b' }}>Start Task</h3>
        <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0 0' }}>{task.action || task.title || task.name}</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Block 1: Task Summary Card */}
        <div style={{ background: '#eff6ff', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#1e3a8a' }}>
            {task.action || task.title || task.name}
          </div>

          <Space size={8} wrap>
            <Tag style={{ background: '#dbeafe', color: '#1e40af', border: 'none' }}>
              {task.type || task.category || 'General'}
            </Tag>
            <Tag color={task.priority === 'HIGH' ? 'red' : task.priority === 'LOW' ? 'blue' : 'orange'} style={{ border: 'none' }}>
              {task.priority || 'MEDIUM'}
            </Tag>
          </Space>

          {dueDateVal && (
            <div>
              {isOverdue && (
                <Alert
                  message={`This task is overdue by ${daysOverdue} day${daysOverdue > 1 ? 's' : ''}`}
                  type="error"
                  showIcon
                  style={{ borderRadius: 6, padding: '4px 10px' }}
                />
              )}
              {isDueToday && (
                <Alert
                  message="This task is due today"
                  type="warning"
                  showIcon
                  style={{ borderRadius: 6, padding: '4px 10px' }}
                />
              )}
              {!isOverdue && !isDueToday && (
                <span style={{ fontSize: 12, color: '#4b5563', fontWeight: 500 }}>
                  Due {dayjs(dueDateVal).format('MMM D, YYYY')} ({dayjs(dueDateVal).fromNow()})
                </span>
              )}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: '#1e293b', borderTop: '1px solid #dbeafe', paddingTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#64748b', width: 80 }}>Assignee:</span>
              <Avatar size={18} icon={<UserOutlined />} style={{ background: '#0288D1' }} />
              <span style={{ fontWeight: 500 }}>
                {Array.isArray(task.assignedTo)
                  ? task.assignedTo.map(u => formatUserName(u)).join(', ')
                  : formatUserName(task.assignedTo)}
              </span>
            </div>
            {task.reviewer && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#64748b', width: 80 }}>Reviewer:</span>
                <Avatar size={18} icon={<UserOutlined />} style={{ background: '#9C27B0' }} />
                <span style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {formatUserName(task.reviewer)}
                  <EyeOutlined style={{ color: '#94a3b8' }} />
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Block 2: Start Confirmation Form */}
        <Form form={form} layout="vertical">
          <Form.Item
            name="startNote"
            label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Start Note (Optional)</span>}
          >
            <TextArea
              rows={2}
              maxLength={500}
              placeholder="Any initial notes or questions before starting?"
              showCount
              style={{ borderRadius: 8 }}
            />
          </Form.Item>

          <Form.Item
            name="estimatedCompletion"
            label={<span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>When do you expect to finish this?</span>}
          >
            <DatePicker
              style={{ width: '100%', borderRadius: 8 }}
              disabledDate={(d) => d && d.isBefore(dayjs().startOf('day'))}
            />
          </Form.Item>

          <Form.Item valuePropName="checked">
            <Checkbox
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              style={{ fontSize: 13 }}
            >
              I understand what needs to be done and am ready to start
            </Checkbox>
          </Form.Item>
        </Form>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, borderTop: '1px solid #f1f5f9', paddingTop: 16, marginTop: 12 }}>
        <Button type="text" onClick={onClose} disabled={submitting}>
          Not Now
        </Button>
        <Button
          type="primary"
          onClick={handleConfirm}
          disabled={!acknowledged}
          loading={submitting}
          style={{
            background: acknowledged ? 'linear-gradient(135deg, #1976D2, #9C27B0)' : '#cbd5e1',
            border: 'none',
            borderRadius: 8,
            height: 36,
            fontWeight: 600,
          }}
        >
          Start Task
        </Button>
      </div>
    </Modal>
  );
};

export default StartTaskModal;
