import React, { useState, useEffect } from 'react';
import { Store, LayoutGrid, Globe, Key, Users } from 'lucide-react';
import { userApi } from '../../services/api';
import { Modal, Form, Input, Select, Button, Space, Typography } from 'antd';
import { useAuth } from '../../contexts/AuthContext';

const { Text, Title } = Typography;

const AddSellerModal = ({ onClose, onSave, isAdmin, isGlobalUser, initialData }) => {
  const { hasPermission } = useAuth();
  const canAccessAmazon = isAdmin || hasPermission('marketplace_amazon');
  const canAccessAjio = isAdmin || hasPermission('marketplace_ajio');
  const canAccessMyntra = isAdmin || hasPermission('marketplace_myntra');

  const getDefaultMarketplace = () => {
    if (canAccessAmazon) return 'amazon.in';
    if (canAccessAjio) return 'ajio';
    if (canAccessMyntra) return 'myntra';
    return 'amazon.in'; // safe default fallback
  };

  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    marketplace: initialData?.marketplace || getDefaultMarketplace(),
    sellerId: initialData?.sellerId || '',
    apiKey: initialData?.apiKey || 'Default',
    plan: initialData?.plan || 'Starter',
    scrapeLimit: initialData?.scrapeLimit || 100,
    assignedUserIds: initialData?.managers?.map(m => m._id) || [],
  });
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    userApi.getManagers()
      .then(res => {
        const list = Array.isArray(res) ? res : (res && Array.isArray(res.data) ? res.data : []);
        setManagers(list);
      })
      .catch(() => setManagers([]));
  }, []);

  useEffect(() => {
    if (initialData) {
      form.setFieldsValue(formData);
    }
  }, [initialData, form]);

  const managerOptions = Array.isArray(managers) ? managers.map(m => ({
    label: `${m.firstName || ''} ${m.lastName || ''} (${m.email || ''})`,
    value: m._id
  })) : [];

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      await onSave({ ...formData, ...values });
    } catch (error) {
      console.error('Validation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={true}
      onCancel={onClose}
      footer={[
        <Button key="back" onClick={onClose} disabled={loading} style={{ borderRadius: 8, fontWeight: 600 }}>
          Dismiss
        </Button>,
        <Button 
          key="submit" 
          type="primary" 
          loading={loading} 
          onClick={handleSubmit}
          style={{ borderRadius: 8, fontWeight: 700, background: '#0f172a', borderColor: '#0f172a' }}
        >
          {initialData ? 'Save Changes' : 'Launch Store'}
        </Button>
      ]}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0' }}>
          <div style={{ padding: '8px', background: '#0f172a', color: '#fff', borderRadius: 10, display: 'flex' }}>
            <Store size={20} strokeWidth={2.5} />
          </div>
          <Title level={5} style={{ margin: 0, fontWeight: 800, letterSpacing: '-0.01em' }}>
            {initialData ? 'Edit Seller Details' : 'Configure New Store'}
          </Title>
        </div>
      }
      styles={{
        content: { borderRadius: 16, padding: '24px' },
        header: { borderBottom: 'none', marginBottom: 24 },
        footer: { borderTop: 'none', marginTop: 24, padding: '0 4px' }
      }}
      width={520}
      centered
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={formData}
        onValuesChange={(changedValues) => setFormData(prev => ({ ...prev, ...changedValues }))}
        requiredMark={false}
      >
        <Form.Item
          name="name"
          label={
            <Space size={8} style={{ marginBottom: 4 }}>
              <LayoutGrid size={14} style={{ color: '#94a3b8' }} />
              <Text strong style={{ fontSize: 11, color: '#64748b', letterSpacing: '0.05em' }}>BRAND NAME</Text>
            </Space>
          }
          rules={[{ required: true, message: 'Brand name is required' }]}
        >
          <Input 
            placeholder="e.g. RetailOps Storefront" 
            style={{ height: 42, borderRadius: 10, fontWeight: 600, fontSize: 13 }}
          />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item
            name="marketplace"
            label={
              <Space size={8} style={{ marginBottom: 4 }}>
                <Globe size={14} style={{ color: '#94a3b8' }} />
                <Text strong style={{ fontSize: 11, color: '#64748b', letterSpacing: '0.05em' }}>MARKETPLACE</Text>
              </Space>
            }
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
              <Space size={8} style={{ marginBottom: 4 }}>
                <Key size={14} style={{ color: '#94a3b8' }} />
                <Text strong style={{ fontSize: 11, color: '#64748b', letterSpacing: '0.05em' }}>
                  SELLER ID {(formData.marketplace === 'ajio' || formData.marketplace === 'myntra') && <span style={{ fontWeight: 400, color: '#94a3b8', textTransform: 'none' }}>(Optional)</span>}
                </Text>
              </Space>
            }
            rules={[{ required: formData.marketplace === 'amazon.in', message: 'Seller ID is required for Amazon' }]}
          >
            <Input 
              placeholder={formData.marketplace === 'amazon.in' ? "Merchant ID" : "Optional"} 
              style={{ height: 42, borderRadius: 10, fontWeight: 700, fontFamily: 'monospace', color: '#2563eb' }}
            />
          </Form.Item>
        </div>

        <Form.Item
          name="assignedUserIds"
          label={
            <Space size={8} style={{ marginBottom: 4 }}>
              <Users size={14} style={{ color: '#94a3b8' }} />
              <Text strong style={{ fontSize: 11, color: '#64748b', letterSpacing: '0.05em' }}>BRAND MANAGER</Text>
            </Space>
          }
        >
          <Select
            mode="multiple"
            placeholder="— Unassigned (Public Pool) —"
            style={{ borderRadius: 10 }}
            options={managerOptions}
            maxTagCount="responsive"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default React.memo(AddSellerModal);
