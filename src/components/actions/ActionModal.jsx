import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal, Form, Input, Select, DatePicker, Radio, InputNumber,
  Tag, Space, Divider, Button, message, Row, Col, Avatar, Badge,
} from 'antd';
import {
  ArrowDownOutlined, MinusOutlined, ArrowUpOutlined,
  ExclamationCircleOutlined, UserOutlined, ClockCircleOutlined,
  TagOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  TASK_TYPES, ACTION_TYPES, STATUS_OPTIONS, PRIORITY_OPTIONS,
  can, formatUserName, buildUserSelectOptions, getReviewerCandidates,
  getInitials, MODAL_STYLES,
} from './modalHelpers';
import { db } from '../../services/db';

const { TextArea } = Input;
const { Option } = Select;

const ActionModal = ({ isOpen, onClose, onSave, action, currentUser, users, sellers, asins, initialKeyResultId }) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [objectives, setObjectives] = useState([]);

  const isEditMode = !!action;

  useEffect(() => {
    if (isOpen) {
      db.getObjectives()
        .then(res => {
          const d = res?.data || res;
          setObjectives(Array.isArray(d) ? d : []);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      if (action) {
        form.setFieldsValue({
          title: action.title || '',
          description: action.description || '',
          type: action.type || undefined,
          actionType: action.actionType || undefined,
          assignedTo: action.assignedTo
            ? (Array.isArray(action.assignedTo)
              ? action.assignedTo.map(u => (typeof u === 'string' ? u : u._id || u.id))
              : [typeof action.assignedTo === 'string' ? action.assignedTo : action.assignedTo._id || action.assignedTo.id])
            : [],
          reviewer: action.reviewer
            ? (typeof action.reviewer === 'string' ? action.reviewer : action.reviewer._id || action.reviewer.id)
            : undefined,
          seller: action.seller
            ? (typeof action.seller === 'string' ? action.seller : action.seller._id || action.seller.id)
            : undefined,
          priority: action.priority || 'MEDIUM',
          dueDate: action.dueDate ? dayjs(action.dueDate) : null,
          estimatedHours: action.estimatedHours || undefined,
          keyResultId: initialKeyResultId || action.keyResultId || undefined,
          linkedAsins: action.asins
            ? action.asins.map(a => (typeof a === 'string' ? a : a._id || a.id))
            : [],
          tags: action.tags || [],
          statusOverride: action.status || undefined,
          internalNotes: action.internalNotes || '',
        });
      } else {
        form.resetFields();
        if (initialKeyResultId) {
          form.setFieldValue('keyResultId', initialKeyResultId);
        }
      }
    }
  }, [isOpen, action, initialKeyResultId, form]);

  const safeUsers = Array.isArray(users) ? users : [];
  const safeSellers = Array.isArray(sellers) ? sellers : [];
  const safeAsins = Array.isArray(asins) ? asins : [];

  const userOptions = useMemo(() => buildUserSelectOptions(safeUsers), [safeUsers]);

  const reviewerOptions = useMemo(() => {
    const candidates = getReviewerCandidates(safeUsers);
    return buildUserSelectOptions(candidates);
  }, [safeUsers]);

  const sellerOptions = useMemo(() => {
    return safeSellers.map(s => ({
      value: s._id || s.id,
      label: s.name || s.sellerName || s.businessName || 'Unknown',
    }));
  }, [safeSellers]);

  const asinOptions = useMemo(() => {
    return safeAsins.map(a => ({
      value: a._id || a.id,
      label: `${a.asin || a.code || ''} — ${a.title || a.name || ''}`,
    }));
  }, [safeAsins]);

  const objectiveOptions = useMemo(() => {
    if (!objectives || !Array.isArray(objectives)) return [];
    return objectives.map(o => ({
      value: o._id || o.id,
      label: o.title || 'Untitled Objective',
    }));
  }, [objectives]);

  const canAssign = can(currentUser, 'assign_users');
  const canSetReviewer = can(currentUser, 'set_reviewer');
  const canSetPriority = can(currentUser, 'set_priority');
  const canAdminSection = can(currentUser, 'delete_task');

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const data = {
        ...values,
        dueDate: values.dueDate ? values.dueDate.toISOString() : null,
        estimatedHours: values.estimatedHours || null,
      };

      if (isEditMode) {
        data._id = action._id || action.id;
        if (!data.statusOverride) data.status = action.status;
      }

      if (!isEditMode) {
        data.status = 'PENDING';
      }

      delete data.statusOverride;

      await onSave(data);
      message.success(isEditMode ? 'Task updated' : 'Task created');
      form.resetFields();
      onClose();
    } catch (err) {
      if (err.errorFields) return;
      message.error(err?.message || 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = { ...MODAL_STYLES.inputStyle };
  const labelStyle = MODAL_STYLES.labelStyle;

  return (
    <Modal
      open={isOpen}
      onCancel={() => { form.resetFields(); onClose(); }}
      footer={null}
      width={720}
      centered
      destroyOnHidden
    >
      <div style={MODAL_STYLES.headerStyle}>
        <Space size={12} align="center">
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
            {isEditMode ? 'Edit Task' : 'Create Task'}
          </span>
          <Tag color={isEditMode ? (action?.status === 'COMPLETED' ? 'green' : action?.status === 'REVIEW' ? 'purple' : 'blue') : 'blue'}>
            {isEditMode ? (action?.status || 'Draft') : 'New Task'}
          </Tag>
        </Space>
      </div>

      <div style={{ ...MODAL_STYLES.bodyStyle, maxHeight: '70vh', overflowY: 'auto' }}>
        <Form form={form} layout="vertical" scrollToFirstError>
          <Divider orientation="left" style={MODAL_STYLES.sectionDivider}>
            Basic Information
          </Divider>

          <Form.Item
            name="title"
            label={<span style={labelStyle}>Task Title <span style={{ color: '#ef4444' }}>*</span></span>}
            rules={[
              { required: true, message: 'Title is required' },
              { min: 3, message: 'Minimum 3 characters' },
              { max: 200, message: 'Maximum 200 characters' },
            ]}
          >
            <Input
              placeholder="Enter task title..."
              maxLength={200}
              showCount
              style={{ ...inputStyle, height: 40 }}
            />
          </Form.Item>

          <Form.Item
            name="description"
            label={<span style={labelStyle}>Description</span>}
            rules={[{ max: 1000, message: 'Maximum 1000 characters' }]}
          >
            <TextArea rows={3} maxLength={1000} showCount placeholder="Describe the task..." style={{ borderRadius: 8, fontSize: 13 }} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="type"
                label={<span style={labelStyle}>Task Type <span style={{ color: '#ef4444' }}>*</span></span>}
                rules={[{ required: true, message: 'Select a type' }]}
              >
                <Select placeholder="Select type" style={inputStyle}>
                  {TASK_TYPES.map(t => (
                    <Option key={t.value} value={t.value}>{t.label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="actionType"
                label={<span style={labelStyle}>Action Type</span>}
              >
                <Select placeholder="Select action type" style={inputStyle} allowClear>
                  {ACTION_TYPES.map(t => (
                    <Option key={t.value} value={t.value}>{t.label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" style={MODAL_STYLES.sectionDivider}>
            Assignment &amp; Scheduling
          </Divider>

          {canAssign ? (
            <Form.Item
              name="assignedTo"
              label={<span style={labelStyle}>Assigned To</span>}
            >
              <Select
                mode="multiple"
                showSearch
                optionFilterProp="label"
                placeholder="Select assignees"
                style={inputStyle}
                options={userOptions.map(u => ({
                  ...u,
                  label: (
                    <Space size={8}>
                      <Avatar size={20} icon={<UserOutlined />} />
                      <span>{u.label}</span>
                      <Tag style={{ fontSize: 10, lineHeight: '16px', marginLeft: 4 }}>{u.role}</Tag>
                    </Space>
                  ),
                }))}
              />
            </Form.Item>
          ) : (
            <div style={{ marginBottom: 16 }}>
              <span style={labelStyle}>Assigned To</span>
              <div style={{ marginTop: 4 }}>
                <Tag color="blue">{formatUserName(currentUser)}</Tag>
              </div>
            </div>
          )}

          {canSetReviewer && (
            <Form.Item
              name="reviewer"
              label={<span style={labelStyle}>Reviewer</span>}
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="Select reviewer"
                style={inputStyle}
                allowClear
                options={reviewerOptions.map(u => ({
                  ...u,
                  label: (
                    <Space size={8}>
                      <Avatar size={20} icon={<UserOutlined />} />
                      <span>{u.label}</span>
                    </Space>
                  ),
                }))}
              />
            </Form.Item>
          )}

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="seller"
                label={<span style={labelStyle}>Seller</span>}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder="Select seller"
                  style={inputStyle}
                  allowClear
                  options={sellerOptions}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="dueDate"
                label={<span style={labelStyle}>Due Date</span>}
                rules={[
                  {
                    validator: (_, value) =>
                      value && value.isBefore(dayjs().startOf('day'))
                        ? Promise.reject(new Error('Due date cannot be in the past'))
                        : Promise.resolve(),
                  },
                ]}
              >
                <DatePicker
                  style={{ width: '100%', ...inputStyle }}
                  disabledDate={(d) => d && d.isBefore(dayjs().startOf('day'))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="priority"
                label={<span style={labelStyle}>Priority <span style={{ color: '#ef4444' }}>*</span></span>}
                rules={[{ required: true, message: 'Select priority' }]}
              >
                <Radio.Group
                  disabled={!canSetPriority}
                  style={{ display: 'flex', gap: 8, width: '100%' }}
                >
                  {PRIORITY_OPTIONS.map(p => (
                    <Radio.Button
                      key={p.value}
                      value={p.value}
                      style={{
                        flex: 1, textAlign: 'center', height: 34, lineHeight: '32px',
                        borderRadius: 8, fontSize: 12, fontWeight: 600,
                        borderColor: '#e2e8f0',
                      }}
                    >
                      <Space size={4}>
                        <span style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: p.color, display: 'inline-block',
                        }} />
                        {p.label}
                      </Space>
                    </Radio.Button>
                  ))}
                </Radio.Group>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="estimatedHours"
                label={<span style={labelStyle}>Estimated Hours</span>}
              >
                <InputNumber
                  min={0}
                  max={9999}
                  step={0.5}
                  style={{ width: '100%', ...inputStyle }}
                  addonAfter="hrs"
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" style={MODAL_STYLES.sectionDivider}>
            Linked Resources
          </Divider>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="keyResultId"
                label={<span style={labelStyle}>Parent Objective / Key Result</span>}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder="Link to objective"
                  style={inputStyle}
                  allowClear
                  options={objectiveOptions}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="linkedAsins"
                label={<span style={labelStyle}>Linked ASINs</span>}
              >
                <Select
                  mode="multiple"
                  showSearch
                  optionFilterProp="label"
                  placeholder="Search ASINs..."
                  style={inputStyle}
                  options={asinOptions.map(a => ({ ...a, label: a.label }))}
                  tagRender={(props) => {
                    const { label, closable, onClose } = props;
                    return (
                      <Tag closable={closable} onClose={onClose} style={{ borderRadius: 6, fontSize: 11, margin: 2 }}>
                        {label}
                      </Tag>
                    );
                  }}
                  maxTagCount={3}
                />
              </Form.Item>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: -12 }}>
                {form.getFieldValue('linkedAsins')?.length || 0} ASINs linked
              </div>
            </Col>
          </Row>

          <Form.Item
            name="tags"
            label={<span style={labelStyle}>Tags</span>}
          >
            <Select
              mode="tags"
              placeholder="Type to add tags"
              style={inputStyle}
              tokenSeparators={[',']}
            />
          </Form.Item>

          {canAdminSection && (
            <>
              <Divider orientation="left" style={MODAL_STYLES.sectionDivider}>
                Admin Settings
              </Divider>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="statusOverride"
                    label={<span style={labelStyle}>Status Override</span>}
                  >
                    <Select style={inputStyle} allowClear placeholder="Override status">
                      {STATUS_OPTIONS.map(s => (
                        <Option key={s.value} value={s.value}>
                          <Space size={6}>
                            <Badge dot color={s.color} />
                            {s.label}
                          </Space>
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item
                name="internalNotes"
                label={<span style={labelStyle}>Internal Notes</span>}
              >
                <TextArea rows={2} placeholder="Admin notes (not visible to assignees)" style={{ borderRadius: 8, fontSize: 13 }} />
              </Form.Item>
            </>
          )}
        </Form>
      </div>

      <div style={MODAL_STYLES.footerStyle}>
        <Button onClick={() => { form.resetFields(); onClose(); }} style={MODAL_STYLES.cancelBtn}>
          Cancel
        </Button>
        <Button
          type="primary"
          onClick={handleSubmit}
          loading={submitting}
          style={MODAL_STYLES.primaryBtn}
        >
          {isEditMode ? 'Save Changes' : 'Create Task'}
        </Button>
      </div>
    </Modal>
  );
};

export default ActionModal;
