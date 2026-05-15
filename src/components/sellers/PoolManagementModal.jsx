import React, { useState } from 'react';
import { Modal, Button, Input, Space, Typography, Card, Statistic, Row, Col, Divider, message, Alert } from 'antd';
import { Database, RefreshCw, Upload, Search, Activity, Trash2 } from 'lucide-react';
import { marketSyncApi } from '../../services/api';

const { TextArea } = Input;
const { Text, Title } = Typography;

const PoolManagementModal = ({ stats, onClose, onRefresh }) => {
  const [taskIdsText, setTaskIdsText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleUpload = async () => {
    const ids = taskIdsText.split(/[\n,]+/).map(id => id.trim()).filter(id => id.length > 0);
    if (ids.length === 0) return;

    setIsSubmitting(true);
    try {
      const response = await marketSyncApi.uploadPoolTasks(ids);
      if (response.success) {
        message.success(`Successfully added ${response.added} tasks to pool.`);
        setTaskIdsText('');
        onRefresh();
      }
    } catch (error) {
      message.error(error.message || 'Failed to upload tasks');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFullSync = async () => {
    setIsSyncing(true);
    try {
      const response = await marketSyncApi.syncTaskPool();
      if (response.success) {
        message.success(response.message || 'Successfully synchronized task pool with Octoparse.');
        onRefresh();
      }
    } catch (error) {
      message.error(error.message || 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Modal
      title={
        <Space>
          <div style={{ 
            padding: '8px', 
            background: '#f8fafc', 
            borderRadius: '8px', 
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Database size={18} className="text-indigo-600" />
          </div>
          <Text strong style={{ fontSize: '16px' }}>Octoparse Task Pool Management</Text>
        </Space>
      }
      open={true}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose} shape="round">
          Close
        </Button>,
        <Button 
          key="sync" 
          icon={<RefreshCw size={14} className={isSyncing ? 'spin' : ''} />} 
          onClick={handleFullSync}
          loading={isSyncing}
          shape="round"
          style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}
        >
          Sync from Octoparse
        </Button>,
        <Button 
          key="submit" 
          type="primary" 
          icon={<Upload size={14} />} 
          onClick={handleUpload}
          loading={isSubmitting}
          disabled={!taskIdsText.trim()}
          shape="round"
          style={{ background: '#18181b', borderColor: '#18181b' }}
        >
          Register to Pool
        </Button>
      ]}
      width={600}
      className="modern-modal"
    >
      <div style={{ padding: '8px 0' }}>
        <Row gutter={16} style={{ marginBottom: '24px' }}>
          <Col span={8}>
            <Card bordered={false} style={{ background: '#f8fafc', textAlign: 'center', borderRadius: '12px' }} bodyStyle={{ padding: '16px' }}>
              <Statistic 
                title={<Text strong style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Total Tasks</Text>} 
                value={stats.total} 
                valueStyle={{ fontWeight: 800, color: '#1e293b' }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card bordered={false} style={{ background: '#f0fdf4', textAlign: 'center', borderRadius: '12px' }} bodyStyle={{ padding: '16px' }}>
              <Statistic 
                title={<Text strong style={{ fontSize: '10px', color: '#166534', textTransform: 'uppercase' }}>Available</Text>} 
                value={stats.available} 
                valueStyle={{ fontWeight: 800, color: '#15803d' }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card bordered={false} style={{ background: '#eff6ff', textAlign: 'center', borderRadius: '12px' }} bodyStyle={{ padding: '16px' }}>
              <Statistic 
                title={<Text strong style={{ fontSize: '10px', color: '#1e40af', textTransform: 'uppercase' }}>Assigned</Text>} 
                value={stats.assigned} 
                valueStyle={{ fontWeight: 800, color: '#2563eb' }}
              />
            </Card>
          </Col>
        </Row>

        <Alert
          message="Dynamic Task Discovery"
          description="Click 'Sync from Octoparse' to automatically fetch and update all task names, groups, and IDs from your Octoparse account. This will populate the local database for automated allocation."
          type="info"
          showIcon
          icon={<Activity size={18} />}
          style={{ marginBottom: '20px', borderRadius: '12px' }}
        />

        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <Text strong style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Manual Import Task IDs</Text>
            <Text style={{ fontSize: '10px', color: '#94a3b8' }}>Supports multi-line paste</Text>
          </div>
          <TextArea
            rows={6}
            placeholder="e.g.&#10;c6ebbaff-448f-3c6d-92d2-5caa10ea5db5&#10;74be0547-1adc-4c46-a31d-011d759d672d"
            value={taskIdsText}
            onChange={(e) => setTaskIdsText(e.target.value)}
            style={{ 
              borderRadius: '12px', 
              fontSize: '11px', 
              fontFamily: 'monospace',
              border: '1px solid #e2e8f0'
            }}
          />
          <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginTop: '8px' }}>
            Allocated tasks are automatically linked to new sellers during setup.
          </Text>
        </div>
      </div>
    </Modal>
  );
};

export default React.memo(PoolManagementModal);
