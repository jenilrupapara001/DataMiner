import React, { useState, useMemo, useEffect } from 'react';
import {
  Modal, Form, Input, Select, Segmented, DatePicker, Button,
  Space, Typography, message, Avatar,
} from 'antd';
import { UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  can, formatUserName, buildUserSelectOptions, MODAL_STYLES,
} from './modalHelpers';

const { Text } = Typography;
const { Option } = Select;

const QuickTaskModal = ({ isOpen, onClose, onSave, currentUser, sellers, users }) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [priority, setPriority] = useState('MEDIUM');
  const [fullFormTriggered, setFullFormTriggered] = useState(false);

  const canAssign = can(currentUser, 'assign_users');

  useEffect(() => {
    if (isOpen) {
      form.resetFields();
      setPriority('MEDIUM');
      form.setFieldValue('priority', 'MEDIUM');
    }
  }, [isOpen, form]);

  const sellerOptions = useMemo(() => {
    if (!sellers) return [];
    return sellers.map(s => ({
      value: s._id || s.id,
      label: s.name || s.sellerName || s.businessName || 'Unknown',
    }));
  }, [sellers]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const data = {
        title: values.title,
        assignedTo: values.assignedTo ? [values.assignedTo] : (canAssign ? [] : [currentUser?._id || currentUser?.id]),
        priority,
        dueDate: values.dueDate ? values.dueDate.toISOString() : null,
        seller: values.seller || null,
        status: 'PENDING',
        type: 'GENERAL',
      };

      await onSave(data);
      message.success('Quick task created');
      form.resetFields();
      onClose();
    } catch (err) {
      if (err.errorFields) return;
      message.error(err?.message || 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenFullForm = () => {
    setFullFormTriggered(true);
    onClose();
  };

  const inputStyle = { ...MODAL_STYLES.inputStyle, height: 40, fontSize: 14 };
  const labelStyle = MODAL_STYLES.labelStyle;

  return (
    <Modal
      open={isOpen}
      onCancel={() => { form.resetFields(); onClose(); }}
      footer={null}
      width={480}
      centered
      destroyOnHidden
    >
      <div style={MODAL_STYLES.headerStyle}>
        <Text style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
          Quick Task
        </Text>
      </div>

      <div style={{ padding: '24px' }}>
        <Form form={form} layout="vertical">
          <Form.Item
            name="title"
            label={<span style={labelStyle}>Task Title <span style={{ color: '#D32F2F' }}>*</span></span>}
            rules={[
              { required: true, message: 'Title is required' },
              { min: 3, message: 'Minimum 3 characters' },
              { max: 200, message: 'Maximum 200 characters' },
            ]}
          >
            <Input
              placeholder="What needs to be done?"
              autoFocus
              maxLength={200}
              showCount
              style={inputStyle}
            />
          </Form.Item>

          {canAssign ? (
            <Form.Item
              name="assignedTo"
              label={<span style={labelStyle}>Assign To</span>}
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="Select assignee (optional)"
                style={inputStyle}
                allowClear
                options={buildUserSelectOptions(users).map(u => ({
                  ...u,
                  label: (
                    <Space size={8}>
                      <Avatar size={18} icon={<UserOutlined />} />
                      <span>{u.label}</span>
                    </Space>
                  ),
                }))}
              />
            </Form.Item>
          ) : (
            <div style={{ marginBottom: 16 }}>
              <span style={labelStyle}>Assign To</span>
              <div style={{ marginTop: 6, padding: '6px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}>
                <Avatar size={18} icon={<UserOutlined />} style={{ marginRight: 8 }} />
                {formatUserName(currentUser)}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <span style={labelStyle}>Priority</span>
            <div style={{ marginTop: 6 }}>
              <Segmented
                value={priority}
                onChange={setPriority}
                options={[
                  { value: 'LOW', label: 'Low' },
                  { value: 'MEDIUM', label: 'Medium' },
                  { value: 'HIGH', label: 'High' },
                  { value: 'CRITICAL', label: 'Critical' },
                ]}
                style={{
                  background: '#f1f5f9', borderRadius: 8, fontWeight: 600, fontSize: 12,
                  width: '100%',
                }}
                block
              />
            </div>
          </div>

          <Form.Item
            name="dueDate"
            label={<span style={labelStyle}>Due Date</span>}
          >
            <DatePicker
              style={{ width: '100%', ...inputStyle }}
              disabledDate={(d) => d && d.isBefore(dayjs().startOf('day'))}
            />
          </Form.Item>

          <Form.Item
            name="seller"
            label={<span style={labelStyle}>Seller</span>}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Select seller (optional)"
              style={inputStyle}
              allowClear
              options={sellerOptions}
            />
          </Form.Item>
        </Form>
      </div>

      <div style={{ borderTop: '1px solid #f1f5f9', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button
          type="link"
          onClick={handleOpenFullForm}
          style={{ fontSize: 12, color: '#94a3b8', padding: 0 }}
        >
          Need more options? Use the full form →
        </Button>
        <Space size={8}>
          <Button onClick={() => { form.resetFields(); onClose(); }} style={MODAL_STYLES.cancelBtn}>
            Maybe later
          </Button>
          <Button
            type="primary"
            onClick={handleSubmit}
            loading={submitting}
            style={MODAL_STYLES.primaryBtn}
          >
            Create Task
          </Button>
        </Space>
      </div>
    </Modal>
  );
};

export default QuickTaskModal;
