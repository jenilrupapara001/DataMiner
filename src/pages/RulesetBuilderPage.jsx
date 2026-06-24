import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button, Input, Select, Space, Tag, Tooltip, Card, Switch, Typography,
  InputNumber, Drawer, Modal, Badge, Divider, Spin, Empty, Popconfirm,
  Segmented, message as antdMessage, notification
} from 'antd';
import {
  ArrowLeft, Plus, Trash2, GripVertical, PlayCircle, PauseCircle,
  Copy, Clock, CheckCircle2, AlertTriangle, Tag as TagIcon, Mail,
  Bell, Eye, ChevronUp, ChevronDown, Settings, ChevronRight,
  Zap, Shield, Activity, Calendar
} from 'lucide-react';
import { rulesetApi } from '../services/api';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import {
  ATTRIBUTES_BY_TYPE, OPERATORS, DATE_RANGES, EXCLUDE_OPTIONS,
  FREQUENCY_OPTIONS, TIME_OPTIONS
} from '../constants/rulesetAttributes';
import { ACTIONS_BY_TYPE, TASK_PRIORITIES, TASK_DEADLINES } from '../constants/rulesetActions';

const { Text, Title } = Typography;

const RULESET_TYPES = [
  { value: 'ASIN', label: 'ASIN Operations', icon: <Activity size={13} />, description: 'Rules for managing individual ASINs' },
];

const initialRule = (order) => ({
  order,
  name: `Rule ${order + 1}`,
  isActive: true,
  conditions: [{ attribute: '', operator: '>', value: '', value2: '', logicalOp: 'AND' }],
  action: { actionType: 'create_task', value: '' }
});

const RulesetBuilderPage = () => {
  const { id: rulesetId } = useParams();
  const navigate = useNavigate();
  const socket = useSocket();
  const { user } = useAuth();
  const [messageApi, msgCtx] = antdMessage.useMessage();

  const [loading, setLoading] = useState(!!rulesetId);
  const [saving, setSaving] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [executingId, setExecutingId] = useState(null);

  const [ruleset, setRuleset] = useState({
    name: '',
    description: '',
    type: 'ASIN',
    sellerId: '',
    rules: [initialRule(0)],
    usingDataFrom: 'Last 14 days',
    excludeDays: 'Latest day',
    isActive: true,
    isAutomated: false,
    runFrequency: 'Daily',
    runTime: '08 AM',
    scope: { applyTo: 'all' },
    emailOnRun: false,
    emailAddress: '',
  });

  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [executionHistory, setExecutionHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (rulesetId) {
      setLoading(true);
      rulesetApi.getById(rulesetId).then(res => {
        if (res.success && res.data) {
          const d = res.data;
          let rules = [];
          try { rules = JSON.parse(d.rules || '[]'); } catch (e) { rules = []; }
          setRuleset({
            name: d.name || '',
            description: d.description || '',
            type: d.type || 'ASIN',
            sellerId: d.sellerId || '',
            rules: rules.length > 0 ? rules : [initialRule(0)],
            usingDataFrom: d.usingDataFrom || 'Last 14 days',
            excludeDays: d.excludeDays || 'Latest day',
            isActive: d.isActive !== undefined ? d.isActive : true,
            isAutomated: d.isAutomated || false,
            runFrequency: d.runFrequency || 'Daily',
            runTime: d.runTime || '08 AM',
            scope: d.scope || { applyTo: 'all' },
            emailOnRun: d.emailOnRun || false,
            emailAddress: d.emailEmailAddress || '',
          });
        }
      }).catch(() => messageApi.error('Failed to load ruleset'))
        .finally(() => setLoading(false));
    }
  }, [rulesetId, messageApi]);

  const handleSave = async () => {
    if (!ruleset.name.trim()) {
      messageApi.warning('Please enter a ruleset name');
      return;
    }
    if (ruleset.rules.length === 0) {
      messageApi.warning('Add at least one rule');
      return;
    }
    for (const rule of ruleset.rules) {
      if (!rule.conditions.some(c => c.attribute)) {
        messageApi.warning(`Rule "${rule.name}" has no conditions`);
        return;
      }
      if (!rule.action?.actionType) {
        messageApi.warning(`Rule "${rule.name}" has no action`);
        return;
      }
    }

    setSaving(true);
    try {
      const data = {
        name: ruleset.name,
        description: ruleset.description,
        type: ruleset.type,
        sellerId: ruleset.sellerId || undefined,
        rules: JSON.stringify(ruleset.rules),
        usingDataFrom: ruleset.usingDataFrom,
        excludeDays: ruleset.excludeDays,
        isActive: ruleset.isActive,
        isAutomated: ruleset.isAutomated,
        runFrequency: ruleset.runFrequency,
        runTime: ruleset.runTime,
        scope: JSON.stringify(ruleset.scope),
        emailOnRun: ruleset.emailOnRun,
        emailAddress: ruleset.emailAddress,
      };
      if (rulesetId) {
        await rulesetApi.update(rulesetId, data);
        messageApi.success('Ruleset updated');
      } else {
        const res = await rulesetApi.create(data);
        messageApi.success('Ruleset created');
        if (res.data?._id || res.data?.id) {
          navigate(`/rule-sets/${res.data._id || res.data.id}`, { replace: true });
        }
      }
    } catch (e) {
      messageApi.error(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleExecute = async () => {
    if (!rulesetId) { messageApi.warning('Save the ruleset first'); return; }
    setExecuting(true);
    setExecutingId(rulesetId);
    try {
      const res = await rulesetApi.execute(rulesetId);
      const s = res.data?.summary || {};
      messageApi.success(`Executed: ${s.totalMatched || 0} matched, ${s.totalActioned || 0} actioned`);
      loadHistory();
    } catch (e) {
      messageApi.error(e.message || 'Execution failed');
    } finally {
      setExecuting(false);
      setExecutingId(null);
    }
  };

  const handleToggle = async () => {
    if (!rulesetId) return;
    try {
      await rulesetApi.toggle(rulesetId);
      setRuleset(prev => ({ ...prev, isActive: !prev.isActive }));
      messageApi.success(`Ruleset ${ruleset.isActive ? 'paused' : 'activated'}`);
    } catch (e) {
      messageApi.error('Failed to toggle');
    }
  };

  const handleDuplicate = async () => {
    if (!rulesetId) return;
    try {
      const res = await rulesetApi.duplicate(rulesetId);
      messageApi.success('Ruleset duplicated');
      const newId = res.data?._id || res.data?.id;
      if (newId) navigate(`/rule-sets/${newId}`);
    } catch (e) {
      messageApi.error('Failed to duplicate');
    }
  };

  const loadHistory = async () => {
    if (!rulesetId) return;
    setHistoryLoading(true);
    try {
      const res = await rulesetApi.getHistory(rulesetId);
      setExecutionHistory(res.data?.logs || res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setHistoryLoading(false);
    }
  };

  const updateRule = (index, updates) => {
    setRuleset(prev => {
      const rules = [...prev.rules];
      rules[index] = { ...rules[index], ...updates };
      return { ...prev, rules };
    });
  };

  const updateCondition = (ruleIdx, condIdx, updates) => {
    setRuleset(prev => {
      const rules = [...prev.rules];
      const conditions = [...rules[ruleIdx].conditions];
      conditions[condIdx] = { ...conditions[condIdx], ...updates };
      if (updates.attribute) {
        const attr = Object.values(ATTRIBUTES_BY_TYPE).flat().find(a => a.value === updates.attribute);
        if (attr) {
          const ops = OPERATORS[attr.type] || OPERATORS.number;
          conditions[condIdx].operator = ops[0]?.value || '>';
          conditions[condIdx].value = '';
          conditions[condIdx].value2 = '';
        }
      }
      rules[ruleIdx] = { ...rules[ruleIdx], conditions };
      return { ...prev, rules };
    });
  };

  const updateAction = (ruleIdx, updates) => {
    setRuleset(prev => {
      const rules = [...prev.rules];
      rules[ruleIdx] = { ...rules[ruleIdx], action: { ...rules[ruleIdx].action, ...updates } };
      return { ...prev, rules };
    });
  };

  const addRule = () => {
    setRuleset(prev => ({
      ...prev,
      rules: [...prev.rules, initialRule(prev.rules.length)]
    }));
  };

  const removeRule = (index) => {
    if (ruleset.rules.length <= 1) { messageApi.warning('Need at least one rule'); return; }
    setRuleset(prev => ({
      ...prev,
      rules: prev.rules.filter((_, i) => i !== index)
    }));
  };

  const moveRule = (index, dir) => {
    const newIdx = index + dir;
    if (newIdx < 0 || newIdx >= ruleset.rules.length) return;
    setRuleset(prev => {
      const rules = [...prev.rules];
      [rules[index], rules[newIdx]] = [rules[newIdx], rules[index]];
      return { ...prev, rules };
    });
  };

  const addCondition = (ruleIdx) => {
    setRuleset(prev => {
      const rules = [...prev.rules];
      const conditions = [...rules[ruleIdx].conditions, { attribute: '', operator: '>', value: '', value2: '', logicalOp: 'AND' }];
      rules[ruleIdx] = { ...rules[ruleIdx], conditions };
      return { ...prev, rules };
    });
  };

  const removeCondition = (ruleIdx, condIdx) => {
    setRuleset(prev => {
      const rules = [...prev.rules];
      const conditions = rules[ruleIdx].conditions.filter((_, i) => i !== condIdx);
      rules[ruleIdx] = { ...rules[ruleIdx], conditions };
      return { ...prev, rules };
    });
  };

  const getAllAttributes = useMemo(() => {
    const attrs = ATTRIBUTES_BY_TYPE[ruleset.type] || ATTRIBUTES_BY_TYPE.ASIN;
    return attrs;
  }, [ruleset.type]);

  const getAttributeType = useCallback((value) => {
    const attr = getAllAttributes.find(a => a.value === value);
    return attr?.type || 'number';
  }, [getAllAttributes]);

  const getOperatorsForAttribute = useCallback((attribute) => {
    const type = getAttributeType(attribute);
    return OPERATORS[type] || OPERATORS.number;
  }, [getAttributeType]);

  const getActionsForType = useMemo(() => {
    return ACTIONS_BY_TYPE[ruleset.type] || ACTIONS_BY_TYPE.ASIN;
  }, [ruleset.type]);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Never';
    try { return new Date(dateStr).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
    catch { return dateStr; }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}><Spin size="large" /></div>;

  return (
    <div style={{ background: '#fff', minHeight: 'calc(100vh - 60px)' }}>
      {msgCtx}

      {/* Header */}
      <div style={{ padding: '16px 28px', borderBottom: '1px solid #f4f4f7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button type="text" icon={<ArrowLeft size={16} />} onClick={() => navigate('/rule-sets')} style={{ borderRadius: 8 }} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#18181b' }}>
                {rulesetId ? 'Edit Ruleset' : 'Create Ruleset'}
              </h2>
              {ruleset.isActive ? (
                <Tag color="success" style={{ borderRadius: 10, fontSize: 10, fontWeight: 700 }}>Active</Tag>
              ) : (
                <Tag color="default" style={{ borderRadius: 10, fontSize: 10, fontWeight: 700 }}>Paused</Tag>
              )}
            </div>
            <p style={{ fontSize: 11, color: '#71717a', margin: 0, marginTop: 2 }}>Define conditions and automated actions for your ASINs</p>
          </div>
        </div>
        <Space size={8}>
          {rulesetId && (
            <>
              <Button icon={<Clock size={13} />} onClick={() => { setShowHistoryDrawer(true); loadHistory(); }}
                style={{ borderRadius: 8, fontWeight: 600, fontSize: 11, height: 32 }}>History</Button>
              <Tooltip title={ruleset.isActive ? 'Pause' : 'Activate'}>
                <Button icon={ruleset.isActive ? <PauseCircle size={13} /> : <PlayCircle size={13} />}
                  onClick={handleToggle} style={{ borderRadius: 8, fontSize: 11, height: 32 }} />
              </Tooltip>
              <Tooltip title="Duplicate">
                <Button icon={<Copy size={13} />} onClick={handleDuplicate}
                  style={{ borderRadius: 8, fontSize: 11, height: 32 }} />
              </Tooltip>
              <Button icon={<PlayCircle size={13} />} loading={executing} onClick={handleExecute}
                style={{ borderRadius: 8, fontWeight: 600, fontSize: 11, height: 32, color: '#059669', borderColor: '#059669' }}>
                Run Now
              </Button>
            </>
          )}
          <Button type="primary" loading={saving} onClick={handleSave}
            style={{ borderRadius: 8, fontWeight: 600, fontSize: 11, height: 32 }}>
            {rulesetId ? 'Save Changes' : 'Create Ruleset'}
          </Button>
        </Space>
      </div>

      <div style={{ padding: '20px 28px', display: 'flex', gap: 20 }}>
        {/* Main Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Settings Card */}
          <Card style={{ borderRadius: 12, border: '1px solid #e4e4e7', marginBottom: 16 }} styles={{ body: { padding: '16px 20px' } }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Settings</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Name *</div>
                <Input size="small" placeholder="e.g. Low LQS Alert" value={ruleset.name}
                  onChange={e => setRuleset({ ...ruleset, name: e.target.value })} style={{ borderRadius: 8 }} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Description</div>
                <Input size="small" placeholder="Brief description..." value={ruleset.description}
                  onChange={e => setRuleset({ ...ruleset, description: e.target.value })} style={{ borderRadius: 8 }} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Data Range</div>
                <Select size="small" value={ruleset.usingDataFrom} style={{ width: '100%', borderRadius: 8 }}
                  onChange={v => setRuleset({ ...ruleset, usingDataFrom: v })}
                  options={DATE_RANGES} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Exclude</div>
                <Select size="small" value={ruleset.excludeDays} style={{ width: '100%', borderRadius: 8 }}
                  onChange={v => setRuleset({ ...ruleset, excludeDays: v })}
                  options={EXCLUDE_OPTIONS} />
              </div>
            </div>
            <Divider style={{ margin: '12px 0' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Switch size="small" checked={ruleset.isAutomated}
                  onChange={v => setRuleset({ ...ruleset, isAutomated: v })} />
                <span style={{ fontSize: 11, fontWeight: 600, color: '#52525b' }}>Auto-run</span>
              </div>
              {ruleset.isAutomated && (
                <>
                  <Select size="small" value={ruleset.runFrequency} style={{ width: 130, borderRadius: 8 }}
                    onChange={v => setRuleset({ ...ruleset, runFrequency: v })}
                    options={FREQUENCY_OPTIONS} />
                  <Select size="small" value={ruleset.runTime} style={{ width: 100, borderRadius: 8 }}
                    onChange={v => setRuleset({ ...ruleset, runTime: v })}
                    options={TIME_OPTIONS.map(t => ({ value: t, label: t }))} />
                </>
              )}
            </div>
          </Card>

          {/* Rules */}
          <div style={{ fontSize: 10, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Rules ({ruleset.rules.length})
          </div>

          {ruleset.rules.map((rule, ruleIdx) => (
            <RuleCard
              key={ruleIdx}
              rule={rule}
              index={ruleIdx}
              total={ruleset.rules.length}
              getAllAttributes={getAllAttributes}
              getOperatorsForAttribute={getOperatorsForAttribute}
              getActionsForType={getActionsForType}
              onMove={moveRule}
              onRemove={() => removeRule(ruleIdx)}
              onUpdate={(updates) => updateRule(ruleIdx, updates)}
              onConditionChange={(condIdx, updates) => updateCondition(ruleIdx, condIdx, updates)}
              onAddCondition={() => addCondition(ruleIdx)}
              onRemoveCondition={(condIdx) => removeCondition(ruleIdx, condIdx)}
              onActionChange={(updates) => updateAction(ruleIdx, updates)}
            />
          ))}

          <Button type="dashed" block icon={<Plus size={13} />} onClick={addRule}
            style={{ borderRadius: 8, height: 36, fontWeight: 600, fontSize: 11, marginTop: 4, borderStyle: 'dashed' }}>
            Add Rule
          </Button>
        </div>

        {/* Right Sidebar - Quick Info */}
        <div style={{ width: 260, flexShrink: 0 }}>
          <Card style={{ borderRadius: 12, border: '1px solid #e4e4e7', marginBottom: 12 }} styles={{ body: { padding: '14px 16px' } }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Summary</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: '#71717a' }}>Rules</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#18181b' }}>{ruleset.rules.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: '#71717a' }}>Data Range</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#18181b' }}>{ruleset.usingDataFrom}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: '#71717a' }}>Auto-run</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: ruleset.isAutomated ? '#059669' : '#71717a' }}>
                  {ruleset.isAutomated ? `${ruleset.runFrequency} at ${ruleset.runTime}` : 'Off'}
                </span>
              </div>
            </div>
          </Card>

          <Card style={{ borderRadius: 12, border: '1px solid #e4e4e7' }} styles={{ body: { padding: '14px 16px' } }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>How it works</div>
            <div style={{ fontSize: 11, color: '#71717a', lineHeight: 1.6 }}>
              <p style={{ margin: '0 0 6px' }}>1. Define <b>conditions</b> that filter your ASINs</p>
              <p style={{ margin: '0 0 6px' }}>2. Set an <b>action</b> for each matching ASIN</p>
              <p style={{ margin: '0 0 6px' }}>3. Rules run top to bottom — first match wins</p>
              <p style={{ margin: 0 }}>4. <b>Run Now</b> executes immediately, or set auto-run schedule</p>
            </div>
          </Card>
        </div>
      </div>

      {/* History Drawer */}
      <Drawer title="Execution History" open={showHistoryDrawer} onClose={() => setShowHistoryDrawer(false)}
        width={500} styles={{ body: { padding: '12px 20px' } }}>
        {historyLoading ? <Spin style={{ display: 'block', margin: '40px auto' }} /> : (
          executionHistory.length === 0 ? <Empty description="No execution history yet" /> :
            executionHistory.map((log, i) => {
              let summary = {};
              try { summary = JSON.parse(log.Summary || '{}'); } catch (e) {}
              return (
                <div key={log.Id || i} style={{ padding: '10px 0', borderBottom: '1px solid #f4f4f5' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CheckCircle2 size={14} style={{ color: log.Status === 'SUCCESS' ? '#059669' : '#dc2626' }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#18181b' }}>
                        {log.MatchedCount || 0} matched · {log.ActionedCount || 0} actioned
                      </span>
                    </div>
                    <span style={{ fontSize: 10, color: '#a1a1aa' }}>{formatDate(log.ExecutedAt)}</span>
                  </div>
                  <div style={{ fontSize: 10, color: '#71717a', marginTop: 4 }}>
                    {log.TriggeredBy} · {summary.executionTimeMs ? `${(summary.executionTimeMs / 1000).toFixed(1)}s` : ''}
                  </div>
                </div>
              );
            })
        )}
      </Drawer>
    </div>
  );
};

// Rule Card Component
const RuleCard = ({
  rule, index, total,
  getAllAttributes, getOperatorsForAttribute, getActionsForType,
  onMove, onRemove, onUpdate, onConditionChange, onAddCondition,
  onRemoveCondition, onActionChange
}) => {
  const groupedAttrs = useMemo(() => {
    const groups = {};
    getAllAttributes.forEach(attr => {
      if (!groups[attr.group]) groups[attr.group] = [];
      groups[attr.group].push(attr);
    });
    return groups;
  }, [getAllAttributes]);

  const actionTypes = getActionsForType;
  const selectedAction = actionTypes.find(a => a.value === rule.action?.actionType);

  return (
    <div style={{
      background: rule.isActive ? '#fff' : '#fafafa',
      border: `1px solid ${rule.isActive ? '#e4e4e7' : '#f4f4f5'}`,
      borderRadius: 12, marginBottom: 10, overflow: 'hidden',
      opacity: rule.isActive ? 1 : 0.65
    }}>
      {/* Rule Header */}
      <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f4f4f5', background: '#fafafa' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#a1a1aa', minWidth: 20 }}>#{index + 1}</span>
          <Input size="small" value={rule.name} onChange={e => onUpdate({ name: e.target.value })}
            style={{ width: 200, fontWeight: 600, fontSize: 12, borderRadius: 6, border: 'none', background: 'transparent', padding: 0 }}
            variant="borderless" />
        </div>
        <Space size={4}>
          <Switch size="small" checked={rule.isActive} onChange={v => onUpdate({ isActive: v })} />
          <Tooltip title="Move Up">
            <Button type="text" size="small" icon={<ChevronUp size={14} />} disabled={index === 0}
              onClick={() => onMove(index, -1)} />
          </Tooltip>
          <Tooltip title="Move Down">
            <Button type="text" size="small" icon={<ChevronDown size={14} />} disabled={index === total - 1}
              onClick={() => onMove(index, 1)} />
          </Tooltip>
          <Popconfirm title="Delete this rule?" onConfirm={onRemove} okText="Delete" cancelText="Cancel">
            <Button type="text" danger size="small" icon={<Trash2 size={13} />} />
          </Popconfirm>
        </Space>
      </div>

      <div style={{ padding: '12px 16px' }}>
        {/* Conditions */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Conditions ({rule.conditions.length})
          </div>
          {rule.conditions.map((cond, condIdx) => {
            const ops = getOperatorsForAttribute(cond.attribute);
            const attr = getAllAttributes.find(a => a.value === cond.attribute);
            return (
              <div key={condIdx} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                {condIdx > 0 && (
                  <Select size="small" value={cond.logicalOp}
                    onChange={v => onConditionChange(condIdx, { logicalOp: v })}
                    style={{ width: 55, borderRadius: 6 }}
                    options={[{ value: 'AND', label: 'AND' }, { value: 'OR', label: 'OR' }]} />
                )}
                {condIdx === 0 && <span style={{ fontSize: 11, fontWeight: 600, color: '#71717a', width: 55, textAlign: 'right' }}>IF</span>}

                <Select size="small" showSearch optionFilterProp="label" value={cond.attribute || undefined}
                  placeholder="Attribute" style={{ width: 170, borderRadius: 6 }}
                  onChange={v => onConditionChange(condIdx, { attribute: v })}
                  options={Object.entries(groupedAttrs).map(([group, attrs]) => ({
                    label: <span style={{ fontWeight: 700, fontSize: 10, color: '#71717a' }}>{group}</span>,
                    options: attrs.map(a => ({ value: a.value, label: `${a.label}${a.unit ? ` (${a.unit})` : ''}` }))
                  }))} />

                <Select size="small" value={cond.operator}
                  onChange={v => onConditionChange(condIdx, { operator: v })}
                  style={{ width: 100, borderRadius: 6 }}
                  options={ops.map(o => ({ value: o.value, label: o.label }))} />

                {cond.attribute && (
                  attr?.type === 'enum' ? (
                    <Select size="small" value={cond.value || undefined}
                      placeholder="Value" style={{ width: 140, borderRadius: 6 }}
                      onChange={v => onConditionChange(condIdx, { value: v })}
                      options={(attr.options || []).map(o => ({ value: o, label: o }))} />
                  ) : attr?.type === 'boolean' ? (
                    <Select size="small" value={cond.value || undefined}
                      placeholder="Value" style={{ width: 100, borderRadius: 6 }}
                      onChange={v => onConditionChange(condIdx, { value: v })}
                      options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]} />
                  ) : cond.operator === 'between' ? (
                    <Space size={4}>
                      <InputNumber size="small" value={cond.value}
                        onChange={v => onConditionChange(condIdx, { value: v })}
                        style={{ width: 70, borderRadius: 6 }} placeholder="Min" />
                      <InputNumber size="small" value={cond.value2}
                        onChange={v => onConditionChange(condIdx, { value2: v })}
                        style={{ width: 70, borderRadius: 6 }} placeholder="Max" />
                    </Space>
                  ) : cond.operator !== 'is empty' && cond.operator !== 'is not empty' ? (
                    <InputNumber size="small" value={cond.value}
                      onChange={v => onConditionChange(condIdx, { value: v })}
                      style={{ width: 100, borderRadius: 6 }} placeholder="Value"
                      addonAfter={attr?.unit || null} />
                  ) : null
                )}

                {rule.conditions.length > 1 && (
                  <Button type="text" danger size="small" icon={<Trash2 size={12} />}
                    onClick={() => onRemoveCondition(condIdx)} />
                )}
              </div>
            );
          })}
          <Button type="text" size="small" icon={<Plus size={12} />} onClick={onAddCondition}
            style={{ fontSize: 11, fontWeight: 600, color: '#71717a' }}>
            Add Condition
          </Button>
        </div>

        {/* Action */}
        <div style={{ borderTop: '1px solid #f4f4f5', paddingTop: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Action</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#71717a' }}>THEN</span>
            <Select size="small" value={rule.action?.actionType}
              onChange={v => onActionChange({ actionType: v, value: '' })}
              style={{ width: 220, borderRadius: 6 }}
              options={actionTypes.map(a => ({
                value: a.value,
                label: <span style={{ fontSize: 11 }}>{a.label}</span>
              }))} />

            {selectedAction?.hasValue && (
              <Input size="small" value={rule.action?.value || ''}
                onChange={e => onActionChange({ value: e.target.value })}
                placeholder={selectedAction.unit || 'Value'}
                style={{ width: 150, borderRadius: 6 }}
                addonBefore={selectedAction.unit === 'tag name' ? <TagIcon size={10} /> : undefined} />
            )}

            {rule.action?.actionType === 'create_task' || rule.action?.actionType === 'create_task_high' ? (
              <Select size="small" value={rule.action?.priority || 'Medium'}
                onChange={v => onActionChange({ priority: v })}
                style={{ width: 90, borderRadius: 6 }}
                options={TASK_PRIORITIES.map(p => ({
                  value: p.value,
                  label: <span style={{ color: p.color, fontWeight: 700, fontSize: 11 }}>{p.label}</span>
                }))} />
            ) : null}
          </div>
          {selectedAction?.description && (
            <div style={{ fontSize: 10, color: '#a1a1aa', marginTop: 4 }}>{selectedAction.description}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RulesetBuilderPage;
