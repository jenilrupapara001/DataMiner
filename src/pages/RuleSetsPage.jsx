import React, { useState, useEffect, useMemo } from 'react';
import { 
  Layout, Button, Input, Select, Space, Typography, Tag, Tooltip, 
  Popconfirm, message, Divider, Pagination, Card, Row, Col, Switch, Badge
} from 'antd';
import { 
  Plus, Search, Play, Trash2, Copy, Sliders, Zap, Settings, 
  Target, Package, DollarSign, TrendingUp, Star, BarChart2, RefreshCw
} from 'lucide-react';
import { rulesetApi } from '../services/api';

const { Content } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;

const RULE_TYPE_INFO = [
  { value: 'ASIN', label: 'ASIN/Product', icon: Package, color: '#f59e0b', bg: '#fffbeb', desc: 'Evaluate ASIN data and take actions' },
  { value: 'Inventory', label: 'Inventory', icon: Package, color: '#06b6d4', bg: '#ecfeff', desc: 'Monitor stock and trigger reorder alerts' },
  { value: 'Pricing', label: 'Pricing', icon: DollarSign, color: '#10b981', bg: '#f0fdf4', desc: 'Adjust prices based on competitors' },
  { value: 'Product', label: 'Product', icon: Star, color: '#ec4899', bg: '#fdf2f8', desc: 'Product-level rules and actions' }
];

const RuleSetsPage = () => {
  const [rulesets, setRulesets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [executing, setExecuting] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  useEffect(() => {
    loadRulesets();
  }, [filterType, pagination.page]);

  const loadRulesets = async () => {
    try {
      setLoading(true);
      const params = { page: pagination.page, limit: pagination.limit };
      if (filterType !== 'all') params.type = filterType;
      
      const response = await rulesetApi.getAll(params);
      setRulesets(response.data || []);
      if (response.pagination) {
        setPagination(prev => ({ ...prev, ...response.pagination }));
      } else {
        setPagination(prev => ({ ...prev, total: (response.data || []).length }));
      }
    } catch (error) {
      console.error('Error loading rulesets:', error);
      message.error('Failed to load rulesets');
    } finally {
      setLoading(false);
    }
  };

  const filteredRulesets = useMemo(() => {
    if (!searchQuery.trim()) return rulesets;
    const query = searchQuery.toLowerCase();
    return rulesets.filter(rs => 
      (rs.name || '').toLowerCase().includes(query) ||
      (rs.type || '').toLowerCase().includes(query)
    );
  }, [rulesets, searchQuery]);

  const handleToggle = async (rulesetId, currentActive) => {
    try {
      await rulesetApi.toggle(rulesetId);
      message.success(`Ruleset ${currentActive ? 'disabled' : 'enabled'} successfully`);
      loadRulesets();
    } catch (error) {
      console.error('Error toggling ruleset:', error);
      message.error('Failed to toggle ruleset status');
    }
  };

  const handleDelete = async (ruleset) => {
    try {
      await rulesetApi.delete(ruleset._id);
      message.success('Ruleset deleted successfully');
      loadRulesets();
    } catch (error) {
      console.error('Error deleting ruleset:', error);
      message.error('Failed to delete ruleset');
    }
  };

  const handleExecute = async (rulesetId) => {
    try {
      setExecuting(rulesetId);
      message.info('Executing ruleset actions...');
      const result = await rulesetApi.execute(rulesetId);
      const summary = result.data?.summary || result.summary;
      message.success(
        `Execution Complete! Matched: ${summary?.totalMatched || 0}, Actioned: ${summary?.totalActioned || 0}`
      );
    } catch (error) {
      console.error('Error executing ruleset:', error);
      message.error('Failed to execute ruleset actions');
    } finally {
      setExecuting(null);
    }
  };

  const handleDuplicate = async (ruleset) => {
    try {
      const result = await rulesetApi.duplicate(ruleset._id);
      message.success(`Duplicated successfully! New ruleset: ${result.data?.Name || result.data?.name || ''}`);
      loadRulesets();
    } catch (error) {
      console.error('Error duplicating ruleset:', error);
      message.error('Failed to duplicate ruleset');
    }
  };

  const navigateToBuilder = (rulesetId = null) => {
    window.location.href = rulesetId ? `/rule-sets/${rulesetId}/edit` : '/rule-sets/new';
  };

  const getTypeInfo = (type) => RULE_TYPE_INFO.find(t => t.value === type) || RULE_TYPE_INFO[2];

  const formatDate = (date) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', { 
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <Layout style={{ minHeight: 'calc(100vh - 72px)', background: '#f8fafc', padding: '24px 32px' }}>
      {/* ── Page Header ──────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Text style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginTop: 4 }}>
            Automated rules for bid management, pricing, inventory alerts & more.
          </Text>
        </div>

        <Button 
          type="primary" 
          icon={<Plus size={14} />} 
          onClick={() => navigateToBuilder()}
          style={{ background: '#4f46e5', borderColor: '#4f46e5', fontWeight: 600, borderRadius: 20 }}
        >
          New Ruleset
        </Button>
      </div>

      {/* ── Toolbar with search + filters ───────────────────── */}
      <div style={{
        background: '#fff', padding: '16px 24px',
        borderRadius: 12, border: '1px solid #e2e8f0',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16,
        marginBottom: 24, flexWrap: 'wrap'
      }}>
        <Input
          prefix={<Search size={14} style={{ color: '#94a3b8' }} />}
          placeholder="Search rulesets..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          allowClear
          style={{ width: 280, borderRadius: 6 }}
        />

        <Space size={12}>
          <Select 
            value={filterType} 
            onChange={v => { setFilterType(v); setPagination(p => ({ ...p, page: 1 })); }}
            style={{ width: 160 }}
          >
            <Option value="all">All Types</Option>
            {RULE_TYPE_INFO.map(t => (
              <Option key={t.value} value={t.value}>{t.label}</Option>
            ))}
          </Select>

          <Tag color="blue" style={{ borderRadius: 20, padding: '2px 10px', fontWeight: 600, border: 'none', background: '#e0e7ff', color: '#4f46e5' }}>
            {pagination.total} Rulesets
          </Tag>
          <Tag color="green" style={{ borderRadius: 20, padding: '2px 10px', fontWeight: 600, border: 'none', background: '#d1fae5', color: '#059669' }}>
            {rulesets.filter(r => r.isActive).length} Active
          </Tag>
        </Space>
      </div>

      {/* ── Grid List Content ─────────────────────────────────── */}
      <Content style={{ minHeight: 0 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <RefreshCw size={24} className="animate-spin text-primary" style={{ color: '#4f46e5', animation: 'spin 1.5s linear infinite' }} />
            <Text style={{ display: 'block', marginTop: 12, color: '#94a3b8' }}>Loading rulesets...</Text>
          </div>
        ) : filteredRulesets.length === 0 ? (
          <div style={{
            background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
            padding: '64px 24px', textAlign: 'center'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%', background: '#f1f5f9',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Zap size={24} color="#94a3b8" />
              </div>
              <div>
                <Title level={5} style={{ margin: '0 0 4px', fontWeight: 600, color: '#475569' }}>
                  No rulesets configured
                </Title>
                <Text style={{ fontSize: 12, color: '#94a3b8' }}>
                  Create your first ruleset to automate your retail operations
                </Text>
              </div>
              <Button type="primary" style={{ marginTop: 8 }} onClick={() => navigateToBuilder()}>
                Create First Ruleset
              </Button>
            </div>
          </div>
        ) : (
          <Row gutter={[20, 20]}>
            {filteredRulesets.map(ruleset => {
              const typeInfo = getTypeInfo(ruleset.type);
              const TypeIcon = typeInfo.icon || Settings;

              return (
                <Col key={ruleset._id} xs={24} sm={12} lg={8}>
                  <Card
                    hoverable
                    style={{
                      borderRadius: 12,
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                      overflow: 'hidden'
                    }}
                    bodyStyle={{ padding: 20 }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <div style={{
                          padding: 8,
                          borderRadius: 8,
                          background: typeInfo.bg,
                          color: typeInfo.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <TypeIcon size={18} />
                        </div>
                        <div>
                          <Text strong style={{ fontSize: 14, color: '#1e293b', display: 'block' }}>
                            {ruleset.name}
                          </Text>
                          <Tag style={{
                            margin: 0,
                            borderRadius: 12,
                            fontSize: 9,
                            fontWeight: 600,
                            background: typeInfo.bg,
                            color: typeInfo.color,
                            border: `1px solid ${typeInfo.color}30`
                          }}>
                            {typeInfo.label}
                          </Tag>
                        </div>
                      </div>
                      <Switch 
                        checked={ruleset.isActive}
                        onChange={() => handleToggle(ruleset._id, ruleset.isActive)}
                        size="small"
                      />
                    </div>

                    {/* Description */}
                    <div style={{ height: 40, overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 12 }}>
                      <Text type="secondary" style={{ fontSize: 12, lineHeight: '18px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {ruleset.description || typeInfo.desc}
                      </Text>
                    </div>

                    {/* Badges / Run info */}
                    <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                      <Tag style={{ borderRadius: 4, background: '#f1f5f9', border: 'none', color: '#475569', fontWeight: 600, fontSize: 10 }}>
                        {ruleset.rules?.length || 0} Rules
                      </Tag>
                      <Tag style={{ borderRadius: 4, background: '#f1f5f9', border: 'none', color: '#475569', fontWeight: 600, fontSize: 10 }}>
                        {ruleset.runFrequency || 'Manual'}
                      </Tag>
                    </div>

                    {/* Stats panel */}
                    <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, display: 'flex', justifyContent: 'space-around', marginBottom: 16 }}>
                      <div style={{ textAlign: 'center' }}>
                        <Text strong style={{ display: 'block', fontSize: 13, color: '#4f46e5' }}>{ruleset.totalRunCount || 0}</Text>
                        <Text style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Runs</Text>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <Text strong style={{ display: 'block', fontSize: 13, color: '#059669' }}>{ruleset.lastRunAt ? '✓' : '—'}</Text>
                        <Text style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Last Run</Text>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <Text strong style={{ display: 'block', fontSize: 13, color: '#0f172a' }}>{ruleset.isAutomated ? 'Auto' : 'Manual'}</Text>
                        <Text style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Mode</Text>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <Divider style={{ margin: '12px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Space size={6}>
                        <Tooltip title="Run Ruleset">
                          <Button 
                            shape="circle" 
                            size="small" 
                            icon={<Play size={12} />} 
                            onClick={() => handleExecute(ruleset._id)}
                            disabled={executing === ruleset._id}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          />
                        </Tooltip>
                        <Tooltip title="Duplicate">
                          <Button 
                            shape="circle" 
                            size="small" 
                            icon={<Copy size={12} />} 
                            onClick={() => handleDuplicate(ruleset)}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          />
                        </Tooltip>
                        <Tooltip title="Configure / Edit">
                          <Button 
                            shape="circle" 
                            size="small" 
                            icon={<Sliders size={12} />} 
                            onClick={() => navigateToBuilder(ruleset._id)}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          />
                        </Tooltip>
                        <Tooltip title="Delete">
                          <Popconfirm
                            title="Delete this ruleset?"
                            description={`Are you sure you want to delete "${ruleset.name}"?`}
                            onConfirm={() => handleDelete(ruleset)}
                            okText="Delete"
                            cancelText="Cancel"
                            okButtonProps={{ danger: true }}
                          >
                            <Button 
                              danger 
                              shape="circle" 
                              size="small" 
                              icon={<Trash2 size={12} />} 
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            />
                          </Popconfirm>
                        </Tooltip>
                      </Space>
                      
                      <Text style={{ fontSize: 10, color: '#94a3b8' }}>
                        Run: {formatDate(ruleset.lastRunAt)}
                      </Text>
                    </div>
                  </Card>
                </Col>
              );
            })}
          </Row>
        )}

        {/* ── Pagination ───────────────────────────────────────── */}
        {!loading && filteredRulesets.length > 0 && pagination.totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
            <Pagination
              current={pagination.page}
              pageSize={pagination.limit}
              total={pagination.total}
              onChange={p => setPagination(prev => ({ ...prev, page: p }))}
              showSizeChanger={false}
            />
          </div>
        )}
      </Content>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Layout>
  );
};

export default RuleSetsPage;