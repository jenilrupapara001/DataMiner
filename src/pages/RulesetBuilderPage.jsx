import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Layout, Button, Input, Select, Space, Typography, Tag, Tooltip, 
  message, Divider, Card, Row, Col, Switch, Tabs, Alert, Collapse, InputNumber, Popconfirm
} from 'antd';
import { 
  Zap, Save, X, Plus, Trash2, ChevronDown, ChevronUp, 
  FileText, Link2, Eye, Clock, Sliders, BarChart, Lightbulb,
  AlertTriangle, CheckCircle, Info, Play, RefreshCw, ArrowLeft,
  Tag as TagIcon, Target, Package, DollarSign, TrendingUp, Star, Settings, HelpCircle
} from 'lucide-react';
import { rulesetApi } from '../services/api';
import { 
  ATTRIBUTES_BY_TYPE, OPERATORS_BY_TYPE, VALUE_TYPES, 
  DATE_RANGES, EXCLUDE_OPTIONS, FREQUENCY_OPTIONS, TIME_OPTIONS 
} from '../constants/rulesetAttributes';
import { ACTIONS_BY_TYPE } from '../constants/rulesetActions';

const { Content } = Layout;
const { Title, Text } = Typography;
const { Option, OptGroup } = Select;

const RULE_TYPE_EXPLANATIONS = {
  ASIN: {
    title: 'What is an ASIN ruleset?',
    body: 'ASIN rulesets evaluate your ASIN data and automatically take actions such as pausing ads, changing prices, updating inventory alerts, or modifying listing content.'
  },
  Product: {
    title: 'What is a Product ruleset?',
    body: 'Product rulesets are an ordered set of rules that evaluate your ASIN data and automatically take actions. Rules are evaluated in order and the first matching action is applied.'
  },
  Inventory: {
    title: 'What is an Inventory ruleset?',
    body: 'Inventory rulesets monitor stock levels and sales velocity to trigger reorder alerts, pause ads for out-of-stock products, or adjust pricing.'
  },
  Pricing: {
    title: 'What is a Pricing ruleset?',
    body: 'Pricing rulesets automatically adjust product prices based on competitor prices, BSR rank, buy box status, profit margins, and inventory levels.'
  }
};

const ruleTypeInfo = {
  ASIN: { icon: Package, color: '#f59e0b', bg: '#fffbeb' },
  Product: { icon: Star, color: '#ec4899', bg: '#fdf2f8' },
  Inventory: { icon: Package, color: '#06b6d4', bg: '#ecfeff' },
  Pricing: { icon: DollarSign, color: '#10b981', bg: '#f0fdf4' }
};

const RulesetBuilderPage = () => {
  const [ruleset, setRuleset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('definition');
  const [error, setError] = useState(null);
  
  const { id } = useParams();
  const navigate = useNavigate();
  const rulesetId = id;

  useEffect(() => {
    if (rulesetId && rulesetId !== 'new') {
      loadRuleset(rulesetId);
    } else {
      setLoading(false);
      setRuleset({
        name: 'New Ruleset',
        type: 'ASIN',
        description: '',
        isActive: true,
        isAutomated: false,
        usingDataFrom: 'Last 14 days',
        excludeDays: 'Latest day',
        runFrequency: 'Daily',
        runTime: '08 AM',
        rules: [],
        scope: { applyTo: 'all' }
      });
    }
  }, [rulesetId]);

  const loadRuleset = async (id) => {
    try {
      setLoading(true);
      const data = await rulesetApi.getById(id);
      setRuleset(data.data);
    } catch (err) {
      setError(err.message);
      message.error('Failed to load ruleset details');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      if (ruleset._id) {
        await rulesetApi.update(ruleset._id, ruleset);
        message.success('Ruleset saved successfully!');
        navigate('/rule-sets');
      } else {
        await rulesetApi.create(ruleset);
        message.success('Ruleset created successfully!');
        navigate('/rule-sets');
      }
    } catch (err) {
      message.error('Error saving: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddRule = () => {
    const newRule = {
      order: ruleset.rules.length,
      name: `Rule ${ruleset.rules.length + 1}`,
      isActive: true,
      conditions: [],
      action: { actionType: '', value: null, value2: null, unit: 'percent' }
    };
    setRuleset({
      ...ruleset,
      rules: [...ruleset.rules, newRule]
    });
    message.success('New rule added');
  };

  const handleUpdateRule = (index, updates) => {
    const newRules = [...ruleset.rules];
    newRules[index] = { ...newRules[index], ...updates };
    setRuleset({ ...ruleset, rules: newRules });
  };

  const handleDeleteRule = (index) => {
    const newRules = ruleset.rules.filter((_, i) => i !== index);
    newRules.forEach((r, i) => r.order = i);
    setRuleset({ ...ruleset, rules: newRules });
    message.info('Rule removed');
  };

  const handleAddCondition = (ruleIndex) => {
    const newCondition = {
      attribute: '',
      operator: '=',
      valueType: 'Absolute Value',
      value: null,
      value2: null,
      logicalOp: 'AND'
    };
    const rule = ruleset.rules[ruleIndex];
    handleUpdateRule(ruleIndex, {
      conditions: [...(rule.conditions || []), newCondition]
    });
  };

  const handleUpdateCondition = (ruleIndex, condIndex, updates) => {
    const rule = ruleset.rules[ruleIndex];
    const conditions = [...rule.conditions];
    conditions[condIndex] = { ...conditions[condIndex], ...updates };
    handleUpdateRule(ruleIndex, { conditions });
  };

  const handleDeleteCondition = (ruleIndex, condIndex) => {
    const rule = ruleset.rules[ruleIndex];
    const conditions = rule.conditions.filter((_, i) => i !== condIndex);
    handleUpdateRule(ruleIndex, { conditions });
  };

  const getAttributesForType = (type) => ATTRIBUTES_BY_TYPE[type] || ATTRIBUTES_BY_TYPE.ASIN;
  
  const getAttributeType = (attr) => {
    for (const type of Object.values(ATTRIBUTES_BY_TYPE)) {
      const found = type.find(a => a.value === attr);
      if (found) return found.type;
    }
    return 'number';
  };

  const getOperatorsForAttribute = (attr) => {
    const attrType = getAttributeType(attr);
    return OPERATORS_BY_TYPE[attrType] || OPERATORS_BY_TYPE.number;
  };

  const getActionsForType = (type) => ACTIONS_BY_TYPE[type] || ACTIONS_BY_TYPE.ASIN;

  const explanation = RULE_TYPE_EXPLANATIONS[ruleset?.type] || RULE_TYPE_EXPLANATIONS.ASIN;
  const TypeIcon = ruleTypeInfo[ruleset?.type]?.icon || Package;

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '128px 0', background: '#f8fafc', minHeight: 'calc(100vh - 72px)' }}>
        <RefreshCw size={24} className="animate-spin text-primary" style={{ color: '#4f46e5', animation: 'spin 1.5s linear infinite' }} />
        <Text style={{ display: 'block', marginTop: 12, color: '#94a3b8' }}>Loading ruleset details...</Text>
      </div>
    );
  }

  const tabsItems = [
    {
      key: 'definition',
      label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><FileText size={14} /> Definition</span>,
    },
    {
      key: 'preview',
      label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Eye size={14} /> Preview</span>,
    },
    {
      key: 'history',
      label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Clock size={14} /> Change History</span>,
    },
    {
      key: 'advanced',
      label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Sliders size={14} /> Advanced Settings</span>,
    },
    {
      key: 'analytics',
      label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><BarChart size={14} /> Analytics</span>,
    }
  ];

  return (
    <Layout style={{ minHeight: 'calc(100vh - 72px)', background: '#f8fafc', padding: '24px 32px' }}>
      {/* ── Page Header ──────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button 
            shape="circle" 
            icon={<ArrowLeft size={16} />} 
            onClick={() => window.location.href = '/rule-sets'} 
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              padding: 8,
              borderRadius: 8,
              background: ruleTypeInfo[ruleset?.type]?.bg || '#ede9fe',
              color: ruleTypeInfo[ruleset?.type]?.color || '#4f46e5',
              display: 'flex'
            }}>
              <TypeIcon size={18} />
            </div>
            <Input
              value={ruleset.name}
              onChange={e => setRuleset({ ...ruleset, name: e.target.value })}
              style={{ fontWeight: 700, fontSize: 16, border: 'none', background: 'transparent', width: 300, padding: '4px 8px' }}
            />
          </div>
        </div>

        <Space size={16}>
          <Space size={6}>
            <Text style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Active</Text>
            <Switch 
              checked={ruleset.isActive}
              onChange={checked => setRuleset({ ...ruleset, isActive: checked })}
              size="small"
            />
          </Space>
          <Button 
            type="primary" 
            icon={<Save size={14} />} 
            loading={saving}
            onClick={handleSave}
            style={{ background: '#4f46e5', borderColor: '#4f46e5', borderRadius: 20 }}
          >
            {saving ? 'Saving...' : 'Save Ruleset'}
          </Button>
        </Space>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabsItems} style={{ marginBottom: 20 }} />

      {activeTab === 'definition' && (
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={16}>
            <Alert
              title={explanation.title}
              description={explanation.body}
              type="info"
              showIcon
              icon={<HelpCircle style={{ color: '#3b82f6' }} />}
              style={{
                marginBottom: 20,
                borderRadius: 8,
                background: '#eff6ff',
                border: '1px solid #bfdbfe'
              }}
            />

            {/* Basic Settings */}
            <Card title="Basic Settings" style={{ borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 20 }}>
              <Row gutter={[16, 16]}>
                <Col xs={24} md={8}>
                  <Text strong style={{ fontSize: 11, color: '#475569', display: 'block', marginBottom: 6 }}>Type</Text>
                  <Select
                    value={ruleset.type}
                    onChange={v => setRuleset({ ...ruleset, type: v })}
                    style={{ width: '100%' }}
                  >
                    {Object.keys(ATTRIBUTES_BY_TYPE).map(t => (
                      <Option key={t} value={t}>{t}</Option>
                    ))}
                  </Select>
                </Col>
                <Col xs={24} md={8}>
                  <Text strong style={{ fontSize: 11, color: '#475569', display: 'block', marginBottom: 6 }}>Using data from</Text>
                  <Select
                    value={ruleset.usingDataFrom}
                    onChange={v => setRuleset({ ...ruleset, usingDataFrom: v })}
                    style={{ width: '100%' }}
                  >
                    {DATE_RANGES.map(d => (
                      <Option key={d.value} value={d.value}>{d.label}</Option>
                    ))}
                  </Select>
                </Col>
                <Col xs={24} md={8}>
                  <Text strong style={{ fontSize: 11, color: '#475569', display: 'block', marginBottom: 6 }}>Exclude</Text>
                  <Select
                    value={ruleset.excludeDays}
                    onChange={v => setRuleset({ ...ruleset, excludeDays: v })}
                    style={{ width: '100%' }}
                  >
                    {EXCLUDE_OPTIONS.map(d => (
                      <Option key={d.value} value={d.value}>{d.label}</Option>
                    ))}
                  </Select>
                </Col>
                <Col xs={24} md={8}>
                  <Text strong style={{ fontSize: 11, color: '#475569', display: 'block', marginBottom: 6 }}>Run Frequency</Text>
                  <Select
                    value={ruleset.runFrequency}
                    onChange={v => setRuleset({ ...ruleset, runFrequency: v })}
                    style={{ width: '100%' }}
                  >
                    {FREQUENCY_OPTIONS.map(f => (
                      <Option key={f.value} value={f.value}>{f.label}</Option>
                    ))}
                  </Select>
                </Col>
                {['Daily', 'Weekly'].includes(ruleset.runFrequency) && (
                  <Col xs={24} md={8}>
                    <Text strong style={{ fontSize: 11, color: '#475569', display: 'block', marginBottom: 6 }}>Time</Text>
                    <Select
                      value={ruleset.runTime}
                      onChange={v => setRuleset({ ...ruleset, runTime: v })}
                      style={{ width: '100%' }}
                    >
                      {TIME_OPTIONS.map(t => (
                        <Option key={t} value={t}>{t}</Option>
                      ))}
                    </Select>
                  </Col>
                )}
              </Row>
            </Card>

            {/* Rules Cards Container */}
            <Card 
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <div>
                    <Text strong style={{ fontSize: 14, color: '#1e293b' }}>Rules</Text>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, marginTop: 2 }}>
                      Add multiple rules evaluated sequentially. First matched rule takes action.
                    </div>
                  </div>
                  <Button 
                    type="primary" 
                    size="small" 
                    icon={<Plus size={14} />} 
                    onClick={handleAddRule}
                    style={{ background: '#4f46e5', borderColor: '#4f46e5', borderRadius: 4 }}
                  >
                    Add Rule
                  </Button>
                </div>
              }
              style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}
              styles={{ body: { padding: 20 } }}
            >
              {ruleset.rules.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 24px', background: '#f8fafc', borderRadius: 8 }}>
                  <FileText size={32} color="#cbd5e1" style={{ marginBottom: 12 }} />
                  <Text style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 12 }}>No rules defined yet</Text>
                  <Button type="dashed" icon={<Plus size={14} />} onClick={handleAddRule}>
                    Add First Rule
                  </Button>
                </div>
              ) : (
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  {ruleset.rules.map((rule, ruleIndex) => (
                    <RuleCard
                      key={ruleIndex}
                      rule={rule}
                      ruleIndex={ruleIndex}
                      type={ruleset.type}
                      attributes={getAttributesForType(ruleset.type)}
                      actions={getActionsForType(ruleset.type)}
                      onUpdate={(updates) => handleUpdateRule(ruleIndex, updates)}
                      onDelete={() => handleDeleteRule(ruleIndex)}
                      onAddCondition={() => handleAddCondition(ruleIndex)}
                      onUpdateCondition={(condIndex, condUpdates) => handleUpdateCondition(ruleIndex, condIndex, condUpdates)}
                      onDeleteCondition={(condIndex) => handleDeleteCondition(ruleIndex, condIndex)}
                      getAttributeType={getAttributeType}
                      getOperatorsForAttribute={getOperatorsForAttribute}
                      moveUp={ruleIndex > 0 ? () => {
                        const newRules = [...ruleset.rules];
                        [newRules[ruleIndex - 1], newRules[ruleIndex]] = [newRules[ruleIndex], newRules[ruleIndex - 1]];
                        newRules.forEach((r, i) => r.order = i);
                        setRuleset({ ...ruleset, rules: newRules });
                      } : null}
                      moveDown={ruleIndex < ruleset.rules.length - 1 ? () => {
                        const newRules = [...ruleset.rules];
                        [newRules[ruleIndex], newRules[ruleIndex + 1]] = [newRules[ruleIndex + 1], newRules[ruleIndex]];
                        newRules.forEach((r, i) => r.order = i);
                        setRuleset({ ...ruleset, rules: newRules });
                      } : null}
                    />
                  ))}
                </Space>
              )}
            </Card>
          </Col>

          {/* Audit Sidebar */}
          <Col xs={24} lg={8}>
            <div style={{ position: 'sticky', top: 20 }}>
              <Card 
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Lightbulb size={16} color="#06b6d4" />
                    <Text strong style={{ fontSize: 13 }}>Ruleset Audit Summary</Text>
                  </div>
                }
                style={{ borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 20 }}
              >
                <Alert
                  title="AI Audit Insights"
                  description="Save your ruleset first to evaluate and get AI feedback on your criteria optimization."
                  type="warning"
                  showIcon
                  style={{ marginBottom: 16, borderRadius: 8 }}
                />
                
                <Button block type="dashed" style={{ borderRadius: 8 }}>
                  Generate Audit
                </Button>

                <Divider style={{ margin: '16px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ fontSize: 12, color: '#64748b' }}>Total Rules</Text>
                  <Text strong style={{ fontSize: 12, color: '#1e293b' }}>{ruleset.rules.length}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ fontSize: 12, color: '#64748b' }}>Active Rules</Text>
                  <Text strong style={{ fontSize: 12, color: '#1e293b' }}>{ruleset.rules.filter(r => r.isActive).length}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 12, color: '#64748b' }}>Conditions</Text>
                  <Text strong style={{ fontSize: 12, color: '#1e293b' }}>
                    {ruleset.rules.reduce((sum, r) => sum + (r.conditions?.length || 0), 0)}
                  </Text>
                </div>
              </Card>
            </div>
          </Col>
        </Row>
      )}



      {activeTab === 'preview' && (
        <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0', textAlign: 'center', padding: '48px 24px' }}>
          <Eye size={48} color="#cbd5e1" style={{ marginBottom: 16 }} />
          <Title level={5} style={{ margin: '0 0 8px', fontWeight: 600, color: '#475569' }}>Preview Mode</Title>
          <Text style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 16 }}>
            Run a dry preview to see what this ruleset would do without making any changes.
          </Text>
          <Button type="primary" icon={<Play size={14} />} style={{ background: '#4f46e5', borderColor: '#4f46e5' }}>
            Run Preview
          </Button>
        </Card>
      )}

      {activeTab === 'history' && (
        <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0', textAlign: 'center', padding: '48px 24px' }}>
          <Clock size={48} color="#cbd5e1" style={{ marginBottom: 16 }} />
          <Title level={5} style={{ margin: '0 0 8px', fontWeight: 600, color: '#475569' }}>Change History</Title>
          <Text style={{ color: '#94a3b8', fontSize: 12 }}>
            View the execution history of this ruleset.
          </Text>
        </Card>
      )}

      {activeTab === 'advanced' && (
        <Card title="Advanced Settings" style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <Row gutter={[16, 24]}>
            <Col xs={24} md={12}>
              <Text strong style={{ fontSize: 11, color: '#475569', display: 'block', marginBottom: 6 }}>Apply to</Text>
              <Select
                value={ruleset.scope?.applyTo || 'all'}
                onChange={v => setRuleset({ ...ruleset, scope: { ...ruleset.scope, applyTo: v } })}
                style={{ width: '100%' }}
              >
                <Option value="all">All ASINs</Option>
                <Option value="selected">Selected Only</Option>
                <Option value="tagged">Tagged Only</Option>
              </Select>
            </Col>
            <Col xs={24} md={12}>
              <Text strong style={{ fontSize: 11, color: '#475569', display: 'block', marginBottom: 6 }}>Conflict Resolution</Text>
              <Select
                value={ruleset.conflictResolution || 'first'}
                onChange={v => setRuleset({ ...ruleset, conflictResolution: v })}
                style={{ width: '100%' }}
              >
                <Option value="first">First ruleset wins</Option>
                <Option value="restrictive">Most restrictive action wins</Option>
                <Option value="aggressive">Most aggressive action wins</Option>
              </Select>
            </Col>
            <Col xs={24} md={12}>
              <Space direction="vertical">
                <Space>
                  <Switch 
                    checked={ruleset.emailOnRun || false}
                    onChange={v => setRuleset({ ...ruleset, emailOnRun: v })}
                    size="small"
                  />
                  <Text style={{ fontSize: 12, color: '#475569' }}>Email me when this ruleset runs</Text>
                </Space>
                <Space>
                  <Switch 
                    checked={ruleset.emailOnAction || false}
                    onChange={v => setRuleset({ ...ruleset, emailOnAction: v })}
                    size="small"
                  />
                  <Text style={{ fontSize: 12, color: '#475569' }}>Email me when actions are applied</Text>
                </Space>
              </Space>
            </Col>
            {(ruleset.emailOnRun || ruleset.emailOnAction) && (
              <Col xs={24} md={12}>
                <Text strong style={{ fontSize: 11, color: '#475569', display: 'block', marginBottom: 6 }}>Email Address</Text>
                <Input
                  type="email"
                  value={ruleset.emailAddress || ''}
                  onChange={e => setRuleset({ ...ruleset, emailAddress: e.target.value })}
                  placeholder="your@email.com"
                />
              </Col>
            )}
          </Row>
        </Card>
      )}

      {activeTab === 'analytics' && (
        <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0', textAlign: 'center', padding: '48px 24px' }}>
          <BarChart size={48} color="#cbd5e1" style={{ marginBottom: 16 }} />
          <Title level={5} style={{ margin: '0 0 8px', fontWeight: 600, color: '#475569' }}>Analytics</Title>
          <Text style={{ color: '#94a3b8', fontSize: 12 }}>
            View performance analytics for this ruleset after it has been executed.
          </Text>
        </Card>
      )}
      
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Layout>
  );
};

const RuleCard = ({
  rule,
  ruleIndex,
  type,
  attributes,
  actions,
  onUpdate,
  onDelete,
  onAddCondition,
  onUpdateCondition,
  onDeleteCondition,
  getAttributeType,
  getOperatorsForAttribute,
}) => {
  const [expanded, setExpanded] = useState(true);

  const groupedAttributes = useMemo(() => {
    const groups = {};
    attributes.forEach(attr => {
      const group = attr.group || 'Other';
      if (!groups[group]) groups[group] = [];
      groups[group].push(attr);
    });
    return groups;
  }, [attributes]);

  const groupedActions = useMemo(() => {
    const groups = {};
    actions.forEach(action => {
      const group = action.group || 'Other';
      if (!groups[group]) groups[group] = [];
      groups[group].push(action);
    });
    return groups;
  }, [actions]);

  return (
    <Card 
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            <Text strong style={{ fontSize: 13, color: '#1e293b' }}>
              {rule.name || `Rule ${ruleIndex + 1}`}
            </Text>
            <Tag style={{ borderRadius: 12, margin: 0, fontSize: 10 }}>{rule.conditions?.length || 0} conditions</Tag>
          </div>
          <Space size={6}>
            <Switch 
              checked={rule.isActive}
              onChange={checked => onUpdate({ isActive: checked })}
              size="small"
            />
            <Popconfirm
              title="Remove this rule?"
              description="Are you sure you want to delete this rule?"
              onConfirm={onDelete}
              okText="Delete"
              cancelText="Cancel"
              okButtonProps={{ danger: true }}
            >
              <Button 
                type="text" 
                danger 
                size="small" 
                icon={<Trash2 size={13} />}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              />
            </Popconfirm>
          </Space>
        </div>
      }
      style={{ borderRadius: 8, borderLeft: '4px solid #3b82f6', borderTop: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}
      styles={{ body: { display: expanded ? 'block' : 'none', padding: 20 } }}
    >
      <div style={{ marginBottom: 20 }}>
        <Text strong style={{ fontSize: 11, color: '#475569', display: 'block', marginBottom: 6 }}>Rule Name</Text>
        <Input
          value={rule.name}
          onChange={e => onUpdate({ name: e.target.value })}
          placeholder="Enter rule name"
          style={{ maxWidth: 400 }}
        />
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
          Used to describe why an automated action was triggered.
        </div>
      </div>

      {/* Conditions Section */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <Text strong style={{ fontSize: 12, color: '#1e293b' }}>Criteria (AND)</Text>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>Conditions must all match for the rule to trigger.</div>
          </div>
          <Button type="dashed" size="small" icon={<Plus size={12} />} onClick={onAddCondition}>
            Add Condition
          </Button>
        </div>

        {(rule.conditions || []).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '16px', background: '#f8fafc', borderRadius: 6 }}>
            <Text type="secondary" style={{ fontSize: 11 }}>No conditions defined yet.</Text>
          </div>
        ) : (
          <Space direction="vertical" size={10} style={{ width: '100%' }}>
            {rule.conditions.map((condition, condIndex) => (
              <div key={condIndex} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', padding: 8, borderRadius: 6, flexWrap: 'wrap' }}>
                {condIndex > 0 ? (
                  <Select
                    value={condition.logicalOp || 'AND'}
                    onChange={v => onUpdateCondition(condIndex, { logicalOp: v })}
                    style={{ width: 80 }}
                  >
                    <Option value="AND">AND</Option>
                    <Option value="OR">OR</Option>
                  </Select>
                ) : (
                  <Tag color="blue" style={{ margin: 0, fontWeight: 700 }}>IF</Tag>
                )}

                <Select
                  value={condition.attribute || undefined}
                  onChange={v => onUpdateCondition(condIndex, { attribute: v })}
                  placeholder="Select Attribute"
                  style={{ minWidth: 180 }}
                >
                  {Object.entries(groupedAttributes).map(([group, attrs]) => (
                    <OptGroup key={group} label={group}>
                      {attrs.map(attr => (
                        <Option key={attr.value} value={attr.value}>{attr.label}</Option>
                      ))}
                    </OptGroup>
                  ))}
                </Select>

                <Select
                  value={condition.operator}
                  onChange={v => onUpdateCondition(condIndex, { operator: v })}
                  disabled={!condition.attribute}
                  style={{ minWidth: 120 }}
                >
                  {getOperatorsForAttribute(condition.attribute).map(op => (
                    <Option key={op.value} value={op.value}>{op.label}</Option>
                  ))}
                </Select>

                {!['is empty', 'is not empty'].includes(condition.operator) && (
                  <>
                    <InputNumber
                      placeholder="Value"
                      value={condition.value}
                      onChange={v => onUpdateCondition(condIndex, { value: v })}
                      style={{ width: 100 }}
                    />
                    {condition.operator === 'between' && (
                      <>
                        <Text style={{ fontSize: 11, color: '#94a3b8' }}>and</Text>
                        <InputNumber
                          placeholder="Max Value"
                          value={condition.value2}
                          onChange={v => onUpdateCondition(condIndex, { value2: v })}
                          style={{ width: 100 }}
                        />
                      </>
                    )}
                  </>
                )}

                <Button 
                  type="text" 
                  danger 
                  size="small" 
                  icon={<X size={14} />} 
                  onClick={() => onDeleteCondition(condIndex)} 
                  style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                />
              </div>
            ))}
          </Space>
        )}
      </div>

      {/* Action Section */}
      <div>
        <Text strong style={{ fontSize: 12, color: '#1e293b', display: 'block', marginBottom: 4 }}>Action</Text>
        <Text style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 12 }}>Action to execute on matched criteria.</Text>
        
        <Space size={8} style={{ background: '#f8fafc', padding: 12, borderRadius: 6, width: '100%' }}>
          <Select
            value={rule.action?.actionType || undefined}
            onChange={v => onUpdate({ 
              action: { 
                ...rule.action, 
                actionType: v,
                value: null,
                value2: null
              } 
            })}
            placeholder="Select Action"
            style={{ minWidth: 200 }}
          >
            {Object.entries(groupedActions).map(([group, acts]) => (
              <OptGroup key={group} label={group}>
                {acts.map(act => (
                  <Option key={act.value} value={act.value}>{act.label}</Option>
                ))}
              </OptGroup>
            ))}
          </Select>

          {rule.action?.actionType && 
            actions.find(a => a.value === rule.action?.actionType)?.hasValue && (
            <>
              <InputNumber
                placeholder="Value"
                value={rule.action?.value}
                onChange={v => onUpdate({
                  action: { ...rule.action, value: v }
                })}
                style={{ width: 120 }}
              />
              <Text style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                {actions.find(a => a.value === rule.action?.actionType)?.unit}
              </Text>
            </>
          )}
        </Space>
      </div>
    </Card>
  );
};

export default RulesetBuilderPage;