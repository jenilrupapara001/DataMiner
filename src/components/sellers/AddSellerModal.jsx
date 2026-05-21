// components/sellers/AddSellerModal.jsx

import React, {
  useState, useEffect, useCallback, useMemo, memo
} from 'react';
import {
  Store, LayoutGrid, Globe, Key, Users, AlertCircle
} from 'lucide-react';
import { userApi } from '../../services/api';
import {
  Modal, Form, Input, Select, Button,
  Space, Typography, Alert, Spin
} from 'antd';
import { useAuth } from '../../contexts/AuthContext';

const { Text, Title } = Typography;

// ─── Pure helper — outside component, never recreated ────────────────────────

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

// ─── Component ────────────────────────────────────────────────────────────────

const AddSellerModal = memo(({
  onClose, onSave, isAdmin, isGlobalUser, initialData
}) => {
  const { hasPermission } = useAuth();

  const canAccessAmazon = isAdmin || hasPermission('marketplace_amazon');
  const canAccessAjio = isAdmin || hasPermission('marketplace_ajio');
  const canAccessMyntra = isAdmin || hasPermission('marketplace_myntra');

  // ✅ Fix 4: computed once via useMemo, not a function recreated per render
  const defaultMarketplace = useMemo(() => {
    if (canAccessAmazon) return 'amazon.in';
    if (canAccessAjio) return 'ajio';
    if (canAccessMyntra) return 'myntra';
    return 'amazon.in';
  }, [canAccessAmazon, canAccessAjio, canAccessMyntra]);

  const [form] = Form.useForm();

  // ✅ Fix 6: separate loading state for managers
  const [managers, setManagers] = useState([]);
  const [loadingManagers, setLoadingManagers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // ✅ Fix 8: track marketplace via Form.useWatch — always in sync with form
  const watchedMarketplace = Form.useWatch('marketplace', form);

  // ── Fetch managers ─────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoadingManagers(true);

    userApi.getManagers()
      .then(res => {
        if (cancelled) return;
        setManagers(normaliseManagerList(res));
      })
      .catch(() => {
        if (!cancelled) setManagers([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingManagers(false);
      });

    return () => { cancelled = true; };
  }, []);

  // ── Fix 3+5: Initialise form correctly when initialData changes ────────
  // Use form.setFieldsValue with values derived DIRECTLY from initialData —
  // not from a stale formData state snapshot.
  useEffect(() => {
    if (initialData) {
      form.setFieldsValue({
        name: initialData.name ?? '',
        marketplace: initialData.marketplace ?? defaultMarketplace,
        sellerId: initialData.sellerId ?? '',
        apiKey: initialData.apiKey ?? 'Default',
        plan: initialData.plan ?? 'Starter',
        scrapeLimit: initialData.scrapeLimit ?? 100,
        assignedUserIds: normaliseManagerIds(initialData.managers ?? initialData.assignedUserIds),
      });
    } else {
      form.resetFields();
      form.setFieldValue('marketplace', defaultMarketplace);
    }
  }, [initialData, defaultMarketplace, form]);

  // ── Manager options ─────────────────────────────────────────────────────
  const managerOptions = useMemo(() =>
    managers.map(m => ({
      label: `${m.firstName || ''} ${m.lastName || ''} (${m.email || ''})`.trim(),
      value: m._id
    })),
    [managers]
  );

  // ── Submit ──────────────────────────────────────────────────────────────
  // ✅ Fix 1+2: no formData state — use ONLY form values, no dual state
  const handleSubmit = useCallback(async () => {
    setSubmitError(null);
    try {
      // `validateFields` returns the latest form values — always fresh
      const values = await form.validateFields();
      setSubmitting(true);
      await onSave(values);
    } catch (error) {
      // Ant Design validation errors are objects with `errorFields`
      if (!error?.errorFields) {
        // Real API/save error
        setSubmitError(error?.message || 'Failed to save. Please try again.');
      }
      // Validation errors are already shown inline — no extra handling needed
    } finally {
      setSubmitting(false);
    }
  }, [form, onSave]);

  const isEditMode = !!initialData;

  return (
    <Modal
      open={true}
      onCancel={onClose}
      // ✅ Fix 5: destroyOnHidden ensures form resets cleanly on re-open
      destroyOnHidden
      centered
      width={520}
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
          <Button
            onClick={onClose}
            disabled={submitting}
            style={{ borderRadius: 9, fontWeight: 600, height: 40 }}
          >
            Cancel
          </Button>
          <Button
            type="primary"
            loading={submitting}
            onClick={handleSubmit}
            style={{
              borderRadius: 9, fontWeight: 700, height: 40,
              background: '#0f172a', borderColor: '#0f172a',
              paddingInline: 24
            }}
          >
            {isEditMode ? 'Save Changes' : 'Launch Store'}
          </Button>
        </div>
      }
    >
      {/* ✅ Fix 10: show save errors to the user */}
      {submitError && (
        <Alert
          type="error"
          showIcon
          message={submitError}
          closable
          onClose={() => setSubmitError(null)}
          style={{ marginBottom: 16, borderRadius: 9 }}
        />
      )}

      <Form
        form={form}
        layout="vertical"
        // ✅ Fix 1: NO onValuesChange syncing to separate state
        // Form is single source of truth — no dual state
        requiredMark={false}
        disabled={submitting}
      >
        {/* Brand Name */}
        <Form.Item
          name="name"
          label={<FieldLabel icon={<LayoutGrid size={13} color="#94a3b8" />} text="BRAND NAME" required />}
          rules={[{ required: true, message: 'Brand name is required' }]}
          style={{ marginBottom: 16 }}
        >
          <Input
            placeholder="e.g. RetailOps Storefront"
            style={{ height: 42, borderRadius: 10, fontWeight: 600, fontSize: 13 }}
            maxLength={100}
          />
        </Form.Item>

        {/* Marketplace + Seller ID */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <Form.Item
            name="marketplace"
            label={<FieldLabel icon={<Globe size={13} color="#94a3b8" />} text="MARKETPLACE" required />}
            rules={[{ required: true }]}
            style={{ marginBottom: 0 }}
          >
            <Select style={{ height: 42, borderRadius: 10 }}>
              {canAccessAmazon && <Select.Option value="amazon.in">Amazon.in</Select.Option>}
              {canAccessAjio && <Select.Option value="ajio">Ajio</Select.Option>}
              {canAccessMyntra && <Select.Option value="myntra">Myntra</Select.Option>}
            </Select>
          </Form.Item>

          <Form.Item
            name="sellerId"
            label={
              // ✅ Fix 8: use Form.useWatch value, not stale formData state
              <FieldLabel
                icon={<Key size={13} color="#94a3b8" />}
                text="SELLER ID"
                required={watchedMarketplace === 'amazon.in'}
                optional={watchedMarketplace !== 'amazon.in'}
              />
            }
            rules={[{
              required: watchedMarketplace === 'amazon.in',
              message: 'Seller ID is required for Amazon'
            }]}
            style={{ marginBottom: 0 }}
          >
            <Input
              placeholder={watchedMarketplace === 'amazon.in' ? 'Merchant ID' : 'Optional'}
              style={{
                height: 42, borderRadius: 10,
                fontWeight: 700, fontFamily: 'monospace', color: '#2563eb'
              }}
              maxLength={30}
            />
          </Form.Item>
        </div>

        {/* Brand Managers */}
        <Form.Item
          name="assignedUserIds"
          label={
            <FieldLabel
              icon={<Users size={13} color="#94a3b8" />}
              text="BRAND MANAGER"
            />
          }
          style={{ marginBottom: 0 }}
        >
          {/* ✅ Fix 6: show spinner while managers load */}
          <Select
            mode="multiple"
            placeholder={
              loadingManagers
                ? 'Loading managers…'
                : '— Unassigned (Public Pool) —'
            }
            style={{ borderRadius: 10 }}
            options={managerOptions}
            maxTagCount="responsive"
            loading={loadingManagers}
            notFoundContent={
              loadingManagers
                ? <Spin size="small" />
                : <Text style={{ fontSize: 12, color: '#94a3b8' }}>No managers found</Text>
            }
            filterOption={(input, opt) =>
              (opt?.label || '').toLowerCase().includes(input.toLowerCase())
            }
          />
        </Form.Item>
      </Form>
    </Modal>
  );
});

// ─── Field label sub-component ────────────────────────────────────────────────

const FieldLabel = memo(({ icon, text, required, optional }) => (
  <Space size={6} style={{ marginBottom: 4 }}>
    {icon}
    <Text strong style={{ fontSize: 11, color: '#64748b', letterSpacing: '0.05em' }}>
      {text}
    </Text>
    {/* ✅ Fix 11: visual required/optional indicator */}
    {required && (
      <span style={{ color: '#ef4444', fontSize: 12, lineHeight: 1 }}>*</span>
    )}
    {optional && (
      <Text style={{ fontSize: 10, color: '#94a3b8', fontWeight: 400, letterSpacing: 0 }}>
        (optional)
      </Text>
    )}
  </Space>
));

export default AddSellerModal;