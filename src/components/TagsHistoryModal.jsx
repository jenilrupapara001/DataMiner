import React, { useState, useEffect } from 'react';
import {
  Modal,
  Table,
  Tag,
  Avatar,
  Space,
  Typography,
  Card,
  Alert,
  Row,
  Col,
  Button
} from 'antd';
import {
  History,
  Clock,
  User,
  PlusCircle,
  MinusCircle,
  Tag as TagIcon
} from 'lucide-react';
import { format } from 'date-fns';
import { asinApi } from '../services/api';

const TagsHistoryModal = ({ isOpen, onClose, asinId, asinCode }) => {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });
  const [summary, setSummary] = useState(null);
  const [predefinedTags, setPredefinedTags] = useState([]);

  // Load predefined tags to map categories to colors
  useEffect(() => {
    if (isOpen && asinId) {
      fetchHistory(1);
      fetchSummary();
      
      const fetchPredefined = async () => {
        try {
          const res = await asinApi.getPredefinedTags();
          if (res.success) {
            setPredefinedTags(res.data);
          }
        } catch (err) {
          console.error('Failed to load predefined tags in history modal:', err);
        }
      };
      fetchPredefined();
    }
  }, [isOpen, asinId]);

  const fetchHistory = async (page) => {
    setLoading(true);
    try {
      const res = await asinApi.getTagsHistory(asinId, page, pagination.limit);
      if (res.success) {
        setHistory(res.data.history);
        setPagination(prev => ({
          ...prev,
          page: res.data.pagination.page,
          total: res.data.pagination.total
        }));
      }
    } catch (error) {
      console.error('Failed to fetch tags history:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const res = await asinApi.getTagsSummary(asinId);
      if (res.success) {
        setSummary(res.data);
      }
    } catch (error) {
      console.error('Failed to fetch tags summary:', error);
    }
  };

  const getTagCategory = (tagName) => {
    const found = predefinedTags.find(t => t.name === tagName);
    return found ? found.category : 'Custom';
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case 'Performance': return 'green';
      case 'Content': return 'blue';
      case 'BuyBox': return 'orange';
      case 'Lifecycle': return 'purple';
      case 'Risk': return 'red';
      case 'Ads': return 'cyan';
      case 'Opportunity': return 'gold';
      case 'General': return 'geekblue';
      case 'Assigned': return 'magenta';
      case 'Custom': return 'volcano';
      default: return 'default';
    }
  };

  const getCategoryHexColor = (category) => {
    switch (category) {
      case 'Performance': return '#52c41a'; // Green
      case 'Content': return '#1890ff'; // Blue
      case 'BuyBox': return '#fa8c16'; // Orange
      case 'Lifecycle': return '#722ed1'; // Purple
      case 'Risk': return '#f5222d'; // Red
      case 'Ads': return '#13c2c2'; // Cyan
      case 'Opportunity': return '#faad14'; // Gold
      case 'General': return '#2f54eb'; // Geekblue
      case 'Assigned': return '#eb2f96'; // Magenta
      case 'Custom': return '#fa541c'; // Volcano
      default: return '#8c8c8c'; // Gray
    }
  };

  const columns = [
    {
      title: 'Date & User',
      key: 'user',
      width: '35%',
      render: (_, record) => {
        const formattedDate = format(new Date(record.createdAt), 'dd MMM yyyy, HH:mm');
        return (
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#434343' }}>
              <Clock size={12} className="me-1 text-muted" style={{ display: 'inline', verticalAlign: 'middle' }} />
              {formattedDate}
            </span>
            {record.user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <Avatar 
                  size={24} 
                  src={record.user.avatar} 
                  style={{ backgroundColor: '#f0f5ff', color: '#2f54eb', fontSize: '10px', fontWeight: 'bold' }}
                >
                  {(record.user.firstName || record.userName || 'U')[0].toUpperCase()}
                </Avatar>
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.2' }}>
                  <Typography.Text strong style={{ fontSize: '11px' }}>
                    {`${record.user.firstName || ''} ${record.user.lastName || ''}`.trim() || record.userName}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: '9px' }}>
                    {record.user.email} {record.user.role?.displayName && ` • `}
                    <span style={{ color: '#722ed1', fontWeight: 600 }}>{record.user.role?.displayName || ''}</span>
                  </Typography.Text>
                </div>
              </div>
            ) : (
              <span style={{ fontSize: '11px', color: '#8c8c8c' }}>
                <User size={12} className="me-1" style={{ display: 'inline', verticalAlign: 'middle' }} />
                {record.userName}
              </span>
            )}
          </Space>
        );
      }
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      width: '15%',
      render: (action) => {
        let color = 'blue';
        if (action === 'add') color = 'green';
        if (action === 'remove') color = 'red';
        return (
          <Tag color={color} style={{ textTransform: 'uppercase', fontWeight: 'bold', fontSize: '10px' }}>
            {action}
          </Tag>
        );
      }
    },
    {
      title: 'Changes',
      key: 'changes',
      width: '38%',
      render: (_, record) => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {record.removedTags?.map(tag => (
            <Tag 
              key={`rem-${tag}`} 
              color="error" 
              style={{ textDecoration: 'line-through', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <MinusCircle size={10} /> {tag}
            </Tag>
          ))}
          {record.addedTags?.map(tag => (
            <Tag 
              key={`add-${tag}`} 
              color="success" 
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <PlusCircle size={10} /> {tag}
            </Tag>
          ))}
          {record.addedTags?.length === 0 && record.removedTags?.length === 0 && (
            <span style={{ color: '#bfbfbf', fontStyle: 'italic', fontSize: '11px' }}>No visible tag changes</span>
          )}
        </div>
      )
    },
    {
      title: 'Source',
      dataIndex: 'source',
      key: 'source',
      width: '12%',
      render: (source) => (
        <Tag color="default" style={{ fontSize: '10px' }}>
          {source?.toUpperCase() || 'MANUAL'}
        </Tag>
      )
    }
  ];

  return (
    <Modal
      title={
        <Space>
          <History size={18} className="text-indigo-600" />
          <Typography.Text strong style={{ fontSize: '16px' }}>
            Tags Audit Trail
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: '13px', fontWeight: 'normal' }}>
            (ASIN: {asinCode})
          </Typography.Text>
        </Space>
      }
      open={isOpen}
      onCancel={onClose}
      width={800}
      footer={[
        <Button key="close" type="primary" onClick={onClose}>
          Close
        </Button>
      ]}
      destroyOnClose
    >
      <Space direction="vertical" size="middle" style={{ width: '100%', marginTop: '12px' }}>
        {/* Summary Info Cards */}
        {summary && (
          <Row gutter={16}>
            <Col span={18}>
              <Card 
                size="small" 
                title={<span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#8c8c8c', fontWeight: 'bold' }}>Current Tags</span>} 
                style={{ background: '#fafafa', height: '100%' }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {summary.currentTags?.length > 0 ? (
                    summary.currentTags.map(t => {
                      const cat = getTagCategory(t);
                      const hex = getCategoryHexColor(cat);
                      return (
                        <Tag 
                          key={t}
                          style={{
                            border: `1px solid ${hex}`,
                            backgroundColor: `${hex}15`,
                            color: hex,
                            borderRadius: '6px',
                            padding: '2px 8px',
                            fontSize: '11px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <TagIcon size={10} />
                          {t}
                        </Tag>
                      );
                    })
                  ) : (
                    <Typography.Text type="secondary" italic style={{ fontSize: '12px' }}>
                      No tags assigned
                    </Typography.Text>
                  )}
                </div>
              </Card>
            </Col>
            <Col span={6}>
              <Card 
                size="small" 
                title={<span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#ffffff', fontWeight: 'bold' }}>Total Changes</span>} 
                style={{ background: '#4f46e5', color: '#ffffff', textAlign: 'center', height: '100%' }}
                headStyle={{ borderBottom: 'none' }}
              >
                <Typography.Title level={3} style={{ margin: 0, color: '#ffffff', fontWeight: 'bold' }}>
                  {summary.totalChanges}
                </Typography.Title>
              </Card>
            </Col>
          </Row>
        )}

        {/* Audit Log Table */}
        <Table
          dataSource={history}
          columns={columns}
          rowKey="id"
          size="small"
          loading={loading}
          pagination={{
            current: pagination.page,
            pageSize: pagination.limit,
            total: pagination.total,
            onChange: (page) => fetchHistory(page),
            showSizeChanger: false,
            size: 'small',
            position: ['bottomRight']
          }}
          bordered
        />

        {/* Info Alert */}
        <Alert
          type="warning"
          showIcon
          message="Permanent Audit Trail"
          description="These logs are immutable and cannot be modified or deleted. All changes, including bulk uploads and automated system updates, are tracked with user attribution."
        />
      </Space>
    </Modal>
  );
};

export default TagsHistoryModal;
