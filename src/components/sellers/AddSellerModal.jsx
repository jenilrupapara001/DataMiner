// components/sellers/AddSellerModal.jsx

import React, {
  useState, useEffect, useCallback, useMemo, memo
} from 'react';
import {
  Store, LayoutGrid, Globe, Key, Users, ToggleRight
} from 'lucide-react';
import { userApi } from '../../services/api';
import {
  Modal, Form, Input, Select, Switch, Button,
  Space, Typography, Alert, Spin, Row, Col
} from 'antd';
import { useAuth } from '../../contexts/AuthContext';

const { Text, Title } = Typography;

function normaliseManagerIds(managers) {
  if (!Array.isArray(managers)) return [];
  return managers.map(m => (typeof m === 'string' ? m : m._id)).filter(Boolean);
}

function normaliseManagerList(res) {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.managers)) return res.managers;
  return [];
}

const AddSellerModal = memo(({
  onClose, onSave, isAdmin, isGlobalUser, initialData
}) => {
  const { hasPermission } = useAuth();

  const canAccessAmazon = isAdmin || hasPermission('marketplace_amazon');
  const canAccessAjio = isAdmin || hasPermission('marketplace_ajio');
  const canAccessMyntra = isAdmin || hasPermission('marketplace_myntra');

  const defaultMarketplace = useMemo(() => {
    if (canAccessAmazon) return 'amazon.in';
    if (canAccessAjio) return 'ajio';
    if (canAccessMyntra) return 'myntra';
    return 'amazon.in';
  }, [canAccessAmazon, canAccessAjio, canAccessMyntra]);

  const [form] = Form.useForm();
  const [managers, setManagers] = useState([]);
  const [loadingManagers, setLoadingManagers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const watchedMarketplace = Form.useWatch('marketplace', form);
  const watchedIsActive = Form.useWatch('isActive', form);

  useEffect(() => {
    let cancelled = false;
    setLoadingManagers(true);
    userApi.getManagers()
      .then(res => { if (!cancelled) setManagers(normaliseManagerList(res)); })
      .catch(() => { if (!cancelled) setManagers([]); })
      .finally(() => { if (!cancelled) setLoadingManagers(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (initialData) {
      form.setFieldsValue({
        name: initialData.name ?? '',
        email: initialData.email ?? initialData.Email ?? '',
        marketplace: initialData.marketplace ?? defaultMarketplace,
        sellerId: initialData.sellerId ?? '',
        isActive: initialData.isActive ?? initialData.IsActive ?? true,
        assignedUserIds: normaliseManagerIds(initialData.managers ?? initialData.assignedUserIds),
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        marketplace: defaultMarketplace,
        isActive: true,
        assignedUserIds: [],
      });
    }
  }, [initialData, defaultMarketplace, form]);

  const managerOptions = useMemo(() =>
    managers.map(m => ({
      label: `${m.firstName || ''} ${m.lastName || ''} (${m.email || ''})`.trim(),
      value: m._id
    })),
    [managers]
  );

  const handleSubmit = useCallback(async () => {
    setSubmitError(null);
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await onSave({
        ...values,
        status: values.isActive ? 'Active' : 'Inactive',
      });
    } catch (error) {
      if (!error?.errorFields) {
        setSubmitError(error?.message || 'Failed to save. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }, [form, onSave]);

  const isEditMode = !!initialData;

  return (
    <Modal
      open={true}
      onCancel={onClose}
      destroyOnHidden
      centered
      width={560}
      styles={{
        content: { borderRadius: 16, padding: 0, overflow: 'hidden' },
        header: { padding: '20px 24px 0', borderBottom: 'none' },
        body: { padding: '16px 24px' },
        footer: { padding: '0 24px 20px', borderTop: 'none' }
      }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0' }}>
          <div style={{
            padding: 9, background: '#0f172a', color: '#fff',
            borderRadius: 10, display: 'flex', flexShrink: 0
          }}>
            <Store size={20} strokeWidth={2.5} />
          </div>
          <div>
            <Title level={5} style={{ margin: 0, fontWeight: 800, letterSpacing: '-0.01em' }}>
              {isEditMode ? 'Edit Seller Details' : 'Configure New Store'}
            </Title>
            <Text style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>
              {isEditMode
                ? `Updating ${initialData?.name || 'seller'}`
                : 'Fill in the details to register a new storefront'}
            </Text>
          </div>
        </div>
      }
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose} disabled={submitting}
            style={{ borderRadius: 8, fontWeight: 600, height: 36, fontSize: 12 }}>
            Cancel
          </Button>
          <Button type="primary" loading={submitting} onClick={handleSubmit}
            style={{
              borderRadius: 8, fontWeight: 700, height: 36, fontSize: 12,
              background: '#0f172a', borderColor: '#0f172a', paddingInline: 20
            }}>
            {isEditMode ? 'Save Changes' : 'Create Seller'}
          </Button>
        </div>
      }
    >
      {submitError && (
        <Alert type="error" showIcon message={submitError} closable
          onClose={() => setSubmitError(null)}
          style={{ marginBottom: 16, borderRadius: 8 }} />
      )}

      <Form form={form} layout="vertical" requiredMark={false} disabled={submitting}>
        <div style={{ paddingTop: 8 }}>
          {/* Brand Name */}
          <Form.Item name="name"
            label={<FieldLabel icon={<LayoutGrid size={13} color="#94a3b8" />} text="BRAND NAME" required />}
            rules={[{ required: true, message: 'Brand name is required' }]}
            style={{ marginBottom: 16 }}>
            <Input placeholder="e.g. 101-BHARVITA"
              style={{ height: 38, borderRadius: 8, fontWeight: 600, fontSize: 13 }}
              maxLength={100} />
          </Form.Item>

          {/* Marketplace + Seller ID */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <Form.Item name="marketplace"
              label={<FieldLabel icon={<Globe size={13} color="#94a3b8" />} text="MARKETPLACE" required />}
              rules={[{ required: true }]}
              style={{ marginBottom: 0 }}>
              <Select size="small" style={{ borderRadius: 8 }}>
                {canAccessAmazon && <Select.Option value="amazon.in">Amazon.in</Select.Option>}
                {canAccessAjio && <Select.Option value="ajio">Ajio</Select.Option>}
                {canAccessMyntra && <Select.Option value="myntra">Myntra</Select.Option>}
              </Select>
            </Form.Item>
            <Form.Item name="sellerId"
              label={
                <FieldLabel icon={<Key size={13} color="#94a3b8" />}
                  text="SELLER ID"
                  required={watchedMarketplace === 'amazon.in'}
                  optional={watchedMarketplace !== 'amazon.in'} />
              }
              rules={[{
                required: watchedMarketplace === 'amazon.in',
                message: 'Seller ID is required for Amazon'
              }]}
              style={{ marginBottom: 0 }}>
              <Input placeholder={watchedMarketplace === 'amazon.in' ? 'Merchant ID' : 'Optional'}
                style={{ height: 38, borderRadius: 8, fontWeight: 700, fontFamily: 'monospace', color: '#0288D1' }}
                maxLength={30} />
            </Form.Item>
          </div>

          {/* Email */}
          <Form.Item name="email"
            label={<FieldLabel icon={<Globe size={13} color="#94a3b8" />} text="EMAIL" />}
            style={{ marginBottom: 16 }}>
            <Input placeholder="seller@example.com" type="email"
              style={{ height: 38, borderRadius: 8, fontSize: 13 }} />
          </Form.Item>

          {/* Active Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <Form.Item name="isActive" label={
              <FieldLabel icon={<ToggleRight size={13} color="#94a3b8" />} text="STATUS" />
            } valuePropName="checked" style={{ marginBottom: 0 }}>
              <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
            </Form.Item>
          </div>

          {/* Brand Managers */}
          <Form.Item name="assignedUserIds"
            label={<FieldLabel icon={<Users size={13} color="#94a3b8" />} text="BRAND MANAGER" />}
            style={{ marginBottom: 0 }}>
            <Select mode="multiple" size="small"
              placeholder={loadingManagers ? 'Loading managers…' : '— Unassigned (Public Pool) —'}
              style={{ borderRadius: 8 }}
              options={managerOptions}
              maxTagCount="responsive"
              loading={loadingManagers}
              notFoundContent={
                loadingManagers ? <Spin size="small" /> :
                  <Text style={{ fontSize: 12, color: '#94a3b8' }}>No managers found</Text>
              }
              filterOption={(input, opt) =>
                (opt?.label || '').toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
});

const FieldLabel = memo(({ icon, text, required, optional }) => (
  <Space size={4} style={{ marginBottom: 4 }}>
    {icon}
    <Text strong style={{ fontSize: 11, color: '#64748b', letterSpacing: '0.05em' }}>
      {text}
    </Text>
    {required && <span style={{ color: '#D32F2F', fontSize: 12, lineHeight: 1 }}>*</span>}
    {optional && (
      <Text style={{ fontSize: 10, color: '#94a3b8', fontWeight: 400 }}>(optional)</Text>
    )}
  </Space>
));

export default AddSellerModal;
