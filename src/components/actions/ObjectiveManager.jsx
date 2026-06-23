import React, { useState, useEffect, useMemo } from 'react';
import {
  Form, Input, Select, DatePicker, Radio, Button,
  Space, Row, Col, Card, Typography, message, Empty,
  Divider, Alert,
} from 'antd';
import { PlusOutlined, DeleteOutlined, FlagOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { db } from '../../services/db';
import {
  can, formatUserName, buildUserSelectOptions, MODAL_STYLES,
} from './modalHelpers';
import { useAuth } from '../../contexts/AuthContext';

const { Text, Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const ObjectiveManager = ({ objective, users, onClose, onObjectiveCreated }) => {
  const { user: currentUser } = useAuth();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [keyResults, setKeyResults] = useState([]);
  const [sellers, setSellers] = useState([]);

  const isEditMode = !!objective;

  useEffect(() => {
    db.getSellers().then(setSellers).catch(() => setSellers([]));
  }, []);

  useEffect(() => {
    if (objective) {
      form.setFieldsValue({
        title: objective.title || '',
        description: objective.description || '',
        seller: objective.seller
          ? (typeof objective.seller === 'string' ? objective.seller : objective.seller._id || objective.seller.id)
          : undefined,
        owner: objective.owner
          ? (typeof objective.owner === 'string' ? objective.owner : objective.owner._id || objective.owner.id)
          : undefined,
        targetDate: objective.targetDate ? dayjs(objective.targetDate) : null,
        priority: objective.priority || 'MEDIUM',
      });
      if (objective.keyResults && objective.keyResults.length > 0) {
        setKeyResults(objective.keyResults.map(kr => ({
          _id: kr._id || kr.id,
          title: kr.title || '',
          targetMetric: kr.targetMetric || '',
          owner: kr.owner
            ? (typeof kr.owner === 'string' ? kr.owner : kr.owner._id || kr.owner.id)
            : undefined,
        })));
      } else {
        setKeyResults([{ title: '', targetMetric: '', owner: undefined }]);
      }
    } else {
      form.resetFields();
      setKeyResults([{ title: '', targetMetric: '', owner: undefined }]);
    }
  }, [objective, form]);

  const cannotCreate = !can(currentUser, 'create_objective');

  const sellerOptions = useMemo(() => {
    if (!sellers) return [];
    return sellers.map(s => ({
      value: s._id || s.id,
      label: s.name || s.sellerName || s.businessName || 'Unknown',
    }));
  }, [sellers]);

  const userOptions = useMemo(() => buildUserSelectOptions(users), [users]);
  const managerOptions = useMemo(() => {
    if (!users) return [];
    return users.filter(u => {
      const role = (u?.role?.name || u?.role || '').toLowerCase();
      return ['superadmin', 'admin', 'manager'].includes(role);
    }).map(u => ({
      value: u._id || u.id,
      label: formatUserName(u),
    }));
  }, [users]);

  const addKeyResult = () => {
    if (keyResults.length >= 10) return;
    setKeyResults([...keyResults, { title: '', targetMetric: '', owner: undefined }]);
  };

  const removeKeyResult = (index) => {
    if (keyResults.length <= 1) return;
    setKeyResults(keyResults.filter((_, i) => i !== index));
  };

  const updateKeyResult = (index, field, value) => {
    const updated = [...keyResults];
    updated[index] = { ...updated[index], [field]: value };
    setKeyResults(updated);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const krErrors = keyResults.some(kr => !kr.title || !kr.title.trim());
      if (krErrors) {
        message.error('All key results must have a title');
        return;
      }
      if (keyResults.length === 0) {
        message.error('At least one key result is required');
        return;
      }

      setSubmitting(true);

      const data = {
        ...values,
        targetDate: values.targetDate ? values.targetDate.toISOString() : null,
        keyResults: keyResults.map(kr => ({
          ...(kr._id ? { _id: kr._id } : {}),
          title: kr.title.trim(),
          targetMetric: kr.targetMetric || '',
          owner: kr.owner || null,
        })),
      };

      if (isEditMode) {
        await db.updateObjective(objective._id || objective.id, data);
        message.success('Objective updated');
      } else {
        await db.createObjective(data);
        message.success('Objective created');
      }

      onObjectiveCreated?.();
      onClose();
    } catch (err) {
      if (err.errorFields) return;
      message.error(err?.message || 'Failed to save objective');
    } finally {
      setSubmitting(false);
    }
  };

  if (cannotCreate) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center' }}>
        <Alert
          type="warning"
          showIcon
          message="Access Restricted"
          description="You don't have permission to create objectives. Contact your manager."
          style={{ textAlign: 'left', marginBottom: 24 }}
        />
        <Button onClick={onClose} style={MODAL_STYLES.cancelBtn}>Close</Button>
      </div>
    );
  }

  const labelStyle = MODAL_STYLES.labelStyle;
  const inputStyle = MODAL_STYLES.inputStyle;

  return (
    <>
      <div style={MODAL_STYLES.headerStyle}>
        <Space size={12} align="center">
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
            {isEditMode ? 'Edit Objective' : 'Create Objective'}
          </span>
        </Space>
      </div>

      <div style={{ ...MODAL_STYLES.bodyStyle, maxHeight: '70vh', overflowY: 'auto' }}>
        <Row gutter={24}>
          <Col span={13}>
            <Text strong style={{ fontSize: 13, color: '#1e293b', display: 'block', marginBottom: 16 }}>
              Objective Details
            </Text>
            <Form form={form} layout="vertical" scrollToFirstError>
              <Form.Item
                name="title"
                label={<span style={labelStyle}>Objective Title <span style={{ color: '#ef4444' }}>*</span></span>}
                rules={[
                  { required: true, message: 'Title is required' },
                  { max: 200, message: 'Maximum 200 characters' },
                ]}
              >
                <Input placeholder="e.g. Improve Listing Quality Score" maxLength={200} showCount style={{ ...inputStyle, height: 40 }} />
              </Form.Item>

              <Form.Item
                name="description"
                label={<span style={labelStyle}>Description</span>}
              >
                <TextArea rows={3} placeholder="Describe the objective..." style={{ borderRadius: 8, fontSize: 13 }} />
              </Form.Item>

              <Form.Item
                name="seller"
                label={<span style={labelStyle}>Linked Seller <span style={{ color: '#ef4444' }}>*</span></span>}
                rules={[{ required: true, message: 'Select a seller' }]}
              >
                <Select showSearch optionFilterProp="label" placeholder="Select seller" style={inputStyle} options={sellerOptions} />
              </Form.Item>

              <Form.Item
                name="owner"
                label={<span style={labelStyle}>Owner / Responsible <span style={{ color: '#ef4444' }}>*</span></span>}
                rules={[{ required: true, message: 'Select an owner' }]}
              >
                <Select showSearch optionFilterProp="label" placeholder="Select owner" style={inputStyle} options={managerOptions} />
              </Form.Item>

              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item
                    name="targetDate"
                    label={<span style={labelStyle}>Target Date</span>}
                    rules={[{
                      validator: (_, value) =>
                        value && value.isBefore(dayjs().startOf('day'))
                          ? Promise.reject(new Error('Cannot be in the past'))
                          : Promise.resolve(),
                    }]}
                  >
                    <DatePicker style={{ width: '100%', ...inputStyle }} disabledDate={(d) => d && d.isBefore(dayjs().startOf('day'))} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="priority"
                    label={<span style={labelStyle}>Priority</span>}
                  >
                    <Radio.Group style={{ display: 'flex', gap: 4, width: '100%' }}>
                      {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(p => (
                        <Radio.Button key={p} value={p} style={{
                          flex: 1, textAlign: 'center', height: 34, lineHeight: '32px',
                          borderRadius: 6, fontSize: 11, fontWeight: 600,
                        }}>
                          {p.charAt(0) + p.slice(1).toLowerCase()}
                        </Radio.Button>
                      ))}
                    </Radio.Group>
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Col>

          <Col span={11}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text strong style={{ fontSize: 13, color: '#1e293b' }}>Key Results</Text>
              <Button
                size="small"
                icon={<PlusOutlined />}
                onClick={addKeyResult}
                disabled={keyResults.length >= 10}
                style={{ borderRadius: 6, fontSize: 12, height: 28 }}
              >
                Add KR
              </Button>
            </div>

            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12 }}>
              {keyResults.length} / 10 key results
            </div>

            {keyResults.length === 0 ? (
              <Card
                styles={{ body: { padding: '20px 16px', textAlign: 'center' } }}
                style={{ borderRadius: 8, border: '1px dashed #e2e8f0', background: '#fafbfc' }}
              >
                <Empty
                  image={<FlagOutlined style={{ fontSize: 32, color: '#cbd5e1' }} />}
                  description={<Text style={{ fontSize: 12, color: '#94a3b8' }}>Add at least one key result to measure progress</Text>}
                >
                  <Button size="small" icon={<PlusOutlined />} onClick={addKeyResult} style={{ borderRadius: 6, marginTop: 8 }}>
                    Add First Key Result
                  </Button>
                </Empty>
              </Card>
            ) : (
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {keyResults.map((kr, i) => (
                  <Card
                    key={i}
                    size="small"
                    style={{
                      borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 8,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                    }}
                    styles={{ body: { padding: '12px' } }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <Text style={{ fontSize: 11, fontWeight: 600, color: '#6366f1' }}>KR #{i + 1}</Text>
                      {keyResults.length > 1 && (
                        <Button
                          type="text"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => removeKeyResult(i)}
                          style={{ height: 22, width: 22, minWidth: 22 }}
                        />
                      )}
                    </div>

                    <div style={{ marginBottom: 8 }}>
                      <div style={labelStyle}>Title <span style={{ color: '#ef4444' }}>*</span></div>
                      <Input
                        placeholder="e.g. Increase revenue by 20%"
                        value={kr.title}
                        onChange={e => updateKeyResult(i, 'title', e.target.value)}
                        style={{ ...inputStyle, height: 32, fontSize: 12 }}
                      />
                    </div>

                    <div style={{ marginBottom: 8 }}>
                      <div style={labelStyle}>Target Metric</div>
                      <Input
                        placeholder="e.g. 20% or £50,000"
                        value={kr.targetMetric}
                        onChange={e => updateKeyResult(i, 'targetMetric', e.target.value)}
                        style={{ ...inputStyle, height: 32, fontSize: 12 }}
                      />
                    </div>

                    <div>
                      <div style={labelStyle}>Owner</div>
                      <Select
                        placeholder="Select owner"
                        value={kr.owner}
                        onChange={v => updateKeyResult(i, 'owner', v)}
                        style={{ width: '100%', height: 32 }}
                        size="small"
                        allowClear
                        options={managerOptions}
                      />
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </Col>
        </Row>
      </div>

      <div style={MODAL_STYLES.footerStyle}>
        <Button onClick={onClose} style={MODAL_STYLES.cancelBtn}>Cancel</Button>
        <Button
          type="primary"
          onClick={handleSubmit}
          loading={submitting}
          style={MODAL_STYLES.primaryBtn}
        >
          {isEditMode ? 'Save Objective' : 'Create Objective'}
        </Button>
      </div>
    </>
  );
};

export default ObjectiveManager;
