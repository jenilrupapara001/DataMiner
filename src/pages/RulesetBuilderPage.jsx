import React, { useState, useEffect, useMemo } from 'react';
import { 
  Zap, Save, X, Plus, Trash2, Copy, ChevronDown, ChevronUp, 
  FileText, Link2, Eye, Clock, Sliders, BarChart, Lightbulb,
  AlertTriangle, CheckCircle, Info, Play, RefreshCw, ArrowLeft,
  ToggleLeft, ToggleRight, HelpCircle, Tag, Target, Package,
  DollarSign, TrendingUp, Activity, Star, Settings
} from 'lucide-react';
import { rulesetApi } from '../services/api';
import { 
  ATTRIBUTES_BY_TYPE, OPERATORS_BY_TYPE, VALUE_TYPES, 
  DATE_RANGES, EXCLUDE_OPTIONS, FREQUENCY_OPTIONS, TIME_OPTIONS 
} from '../constants/rulesetAttributes';
import { ACTIONS_BY_TYPE } from '../constants/rulesetActions';

const RULE_TYPE_EXPLANATIONS = {
  Bid: {
    title: 'What is a Bid ruleset?',
    body: 'Bid Management rulesets are simply an **ordered** set of rules that can be used to control bids of keywords and product targets. You can define the rules below and associate these with specific campaigns from the campaigns tab above. Rules will be evaluated **in the order defined below**, one after the other, and the action corresponding to **the first matching rule** will be applied to all **keywords, or product targets** in the associated campaigns.'
  },
  ASIN: {
    title: 'What is an ASIN ruleset?',
    body: 'Product rulesets are an **ordered** set of rules that evaluate your ASIN data and automatically take actions such as pausing ads, changing prices, updating inventory alerts, or modifying listing content. Rules are evaluated **in the order defined below** and the action of the **first matching rule** is applied to all matched ASINs.'
  },
  Product: {
    title: 'What is a Product ruleset?',
    body: 'Product rulesets are an **ordered** set of rules that evaluate your ASIN data and automatically take actions such as pausing ads, changing prices, updating inventory alerts, or modifying listing content. Rules are evaluated **in the order defined below** and the action of the **first matching rule** is applied to all matched ASINs.'
  },
  Campaign: {
    title: 'What is a Campaign ruleset?',
    body: 'Campaign rulesets dynamically modify campaign-level properties including bidding strategy, placement modifiers, campaign state, budget, and Target ACoS based on the criteria you define.'
  },
  Inventory: {
    title: 'What is an Inventory ruleset?',
    body: 'Inventory rulesets monitor stock levels and sales velocity to trigger reorder alerts, pause ads for out-of-stock products, or adjust pricing based on inventory thresholds.'
  },
  Pricing: {
    title: 'What is a Pricing ruleset?',
    body: 'Pricing rulesets automatically adjust product prices based on competitor prices, BSR rank, buy box status, profit margins, and inventory levels.'
  },
  SOV: {
    title: 'What is a SOV ruleset?',
    body: 'Share of Voice rulesets manage impression share and bidding based on your keyword visibility targets.'
  }
};

const TABS = [
  { id: 'definition', label: 'Ruleset Definition', icon: FileText },
  { id: 'linked', label: 'Linked Campaigns', icon: Link2 },
  { id: 'preview', label: 'Preview', icon: Eye },
  { id: 'history', label: 'Change History', icon: Clock },
  { id: 'advanced', label: 'Advanced Settings', icon: Sliders },
  { id: 'analytics', label: 'Analytics', icon: BarChart }
];

const ruleTypeInfo = {
  Bid: { icon: Target, color: '#3b82f6' },
  Campaign: { icon: BarChart, color: '#8b5cf6' },
  ASIN: { icon: Package, color: '#f59e0b' },
  Product: { icon: Star, color: '#ec4899' },
  Inventory: { icon: Package, color: '#06b6d4' },
  Pricing: { icon: DollarSign, color: '#10b981' },
  SOV: { icon: TrendingUp, color: '#6366f1' }
};

const RulesetBuilderPage = () => {
  const [ruleset, setRuleset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('definition');
  const [error, setError] = useState(null);
  
  const rulesetId = window.location.pathname.split('/').pop();
  const isNew = rulesetId === 'new' || rulesetId === 'edit';

  useEffect(() => {
    if (rulesetId && rulesetId !== 'new' && rulesetId !== 'edit') {
      loadRuleset();
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

  const loadRuleset = async () => {
    try {
      setLoading(true);
      const data = await rulesetApi.getById(rulesetId);
      setRuleset(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      if (ruleset._id) {
        await rulesetApi.update(ruleset._id, ruleset);
      } else {
        const created = await rulesetApi.create(ruleset);
        window.location.href = `/rule-sets/${created._id}/edit`;
        return;
      }
      alert('Ruleset saved successfully!');
    } catch (err) {
      alert('Error saving: ' + err.message);
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
  };

  const handleUpdateRule = (index, updates) => {
    const newRules = [...ruleset.rules];
    newRules[index] = { ...newRules[index], ...updates };
    setRuleset({ ...ruleset, rules: newRules });
  };

  const handleDeleteRule = (index) => {
    if (!confirm('Delete this rule?')) return;
    const newRules = ruleset.rules.filter((_, i) => i !== index);
    newRules.forEach((r, i) => r.order = i);
    setRuleset({ ...ruleset, rules: newRules });
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
      <div className="page-container d-flex align-items-center justify-content-center" style={{ minHeight: '400px' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container pb-5">
      <div className="page-header mb-4">
        <div className="d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-3">
            <button 
              className="btn btn-light rounded-circle"
              onClick={() => window.location.href = '/rule-sets'}
            >
              <ArrowLeft size={18} />
            </button>
            <div className="d-flex align-items-center gap-2">
              <div 
                className="p-2 rounded-lg"
                style={{ backgroundColor: (ruleTypeInfo[ruleset?.type]?.color || '#6366f1') + '20' }}
              >
                <TypeIcon size={20} style={{ color: ruleTypeInfo[ruleset?.type]?.color || '#6366f1' }} />
              </div>
              <input
                type="text"
                className="form-control border-0 fw-bold fs-5"
                value={ruleset.name}
                onChange={(e) => setRuleset({ ...ruleset, name: e.target.value })}
                style={{ maxWidth: '400px' }}
              />
            </div>
          </div>
          <div className="d-flex align-items-center gap-3">
            <label className="d-flex align-items-center gap-2 mb-0">
              <span className="text-muted small">Active</span>
              <button 
                className="btn btn-link p-0"
                onClick={() => setRuleset({ ...ruleset, isActive: !ruleset.isActive })}
              >
                {ruleset.isActive ? 
                  <ToggleRight size={28} className="text-success" /> : 
                  <ToggleLeft size={28} className="text-muted" />
                }
              </button>
            </label>
            <button 
              className="btn btn-primary d-flex align-items-center gap-2 rounded-pill px-4"
              onClick={handleSave}
              disabled={saving}
            >
              <Save size={18} />
              {saving ? 'Saving...' : 'Save Ruleset'}
            </button>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <ul className="nav nav-underline">
          {TABS.map(tab => (
            <li className="nav-item" key={tab.id}>
              <button
                className={`nav-link d-flex align-items-center gap-2 ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {activeTab === 'definition' && (
        <div className="row">
          <div className="col-lg-8">
            <div className="alert alert-info d-flex align-items-start gap-3 mb-4" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div className="p-2 bg-info-subtle rounded-lg">
                <HelpCircle size={20} className="text-info" />
              </div>
              <div>
                <h6 className="fw-bold mb-1">{explanation.title}</h6>
                <p className="mb-0 small">{explanation.body}</p>
              </div>
            </div>

            <div className="card border-0 shadow-sm mb-4">
              <div className="card-body p-4">
                <h6 className="fw-bold mb-4">Basic Settings</h6>
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label small fw-bold">Type</label>
                    <select
                      className="form-select"
                      value={ruleset.type}
                      onChange={(e) => setRuleset({ ...ruleset, type: e.target.value })}
                    >
                      {Object.keys(ATTRIBUTES_BY_TYPE).map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-bold">Using data from</label>
                    <select
                      className="form-select"
                      value={ruleset.usingDataFrom}
                      onChange={(e) => setRuleset({ ...ruleset, usingDataFrom: e.target.value })}
                    >
                      {DATE_RANGES.map(d => (
                        <option key={d.value} value={d.value}>{d.label}</option>
                      ))}
                    </select>
                    <small className="text-muted">Number of days of data based on which the rule will be evaluated.</small>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-bold">Exclude</label>
                    <select
                      className="form-select"
                      value={ruleset.excludeDays}
                      onChange={(e) => setRuleset({ ...ruleset, excludeDays: e.target.value })}
                    >
                      {EXCLUDE_OPTIONS.map(d => (
                        <option key={d.value} value={d.value}>{d.label}</option>
                      ))}
                    </select>
                    <small className="text-muted">Number of days of data to exclude.</small>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-bold">Run Frequency</label>
                    <select
                      className="form-select"
                      value={ruleset.runFrequency}
                      onChange={(e) => setRuleset({ ...ruleset, runFrequency: e.target.value })}
                    >
                      {FREQUENCY_OPTIONS.map(f => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                  </div>
                  {['Daily', 'Weekly'].includes(ruleset.runFrequency) && (
                    <div className="col-md-4">
                      <label className="form-label small fw-bold">Time</label>
                      <select
                        className="form-select"
                        value={ruleset.runTime}
                        onChange={(e) => setRuleset({ ...ruleset, runTime: e.target.value })}
                      >
                        {TIME_OPTIONS.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="card border-0 shadow-sm">
              <div className="card-body p-4">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div>
                    <h6 className="fw-bold mb-1">Rules</h6>
                    <p className="text-muted small mb-0">
                      Add multiple rules and they will be executed in order. Each rule will match the ASINs based on the criteria, and apply the corresponding action.
                    </p>
                  </div>
                  <button 
                    className="btn btn-primary btn-sm d-flex align-items-center gap-1 rounded-pill px-3"
                    onClick={handleAddRule}
                  >
                    <Plus size={16} /> Add Rule
                  </button>
                </div>

                {ruleset.rules.length === 0 ? (
                  <div className="text-center py-5 bg-light rounded-3">
                    <FileText size={32} className="text-muted mb-2" />
                    <p className="text-muted mb-2">No rules defined yet</p>
                    <button className="btn btn-primary btn-sm" onClick={handleAddRule}>
                      <Plus size={16} className="me-1" /> Add First Rule
                    </button>
                  </div>
                ) : (
                  <div className="d-flex flex-column gap-3">
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
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="col-lg-4">
            <div className="card border-0 shadow-sm sticky-top" style={{ top: '20px' }}>
              <div className="card-body p-4">
                <h6 className="fw-bold mb-3">
                  <Lightbulb size={18} className="me-2" style={{ color: '#06b6d4' }} />
                  Ruleset Audit Summary
                </h6>
                <div className="alert alert-light">
                  <p className="small mb-2">Enhance and refine your ruleset with AI Intelligence.</p>
                  <p className="text-muted small mb-0">Save your ruleset to run the AI Audit.</p>
                </div>
                <button className="btn btn-outline-dark btn-sm w-100 rounded-pill">
                  Generate Audit
                </button>
                
                <hr />
                
                <div className="d-flex justify-content-between mb-2">
                  <span className="text-muted small">Rules</span>
                  <span className="fw-bold">{ruleset.rules.length}</span>
                </div>
                <div className="d-flex justify-content-between mb-2">
                  <span className="text-muted small">Active Rules</span>
                  <span className="fw-bold">{ruleset.rules.filter(r => r.isActive).length}</span>
                </div>
                <div className="d-flex justify-content-between">
                  <span className="text-muted small">Conditions</span>
                  <span className="fw-bold">
                    {ruleset.rules.reduce((sum, r) => sum + (r.conditions?.length || 0), 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'linked' && (
        <div className="card border-0 shadow-sm">
          <div className="card-body p-4 text-center py-5">
            <Link2 size={48} className="text-muted mb-3" />
            <h5>Linked Campaigns</h5>
            <p className="text-muted">
              Link campaigns or ASINs to this ruleset from the Advanced Settings tab.
            </p>
          </div>
        </div>
      )}

      {activeTab === 'preview' && (
        <div className="card border-0 shadow-sm">
          <div className="card-body p-4 text-center py-5">
            <Eye size={48} className="text-muted mb-3" />
            <h5>Preview Mode</h5>
            <p className="text-muted">
              Run a dry preview to see what this ruleset would do without making any changes.
            </p>
            <button className="btn btn-primary">
              <Play size={16} className="me-2" /> Run Preview
            </button>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="card border-0 shadow-sm">
          <div className="card-body p-4 text-center py-5">
            <Clock size={48} className="text-muted mb-3" />
            <h5>Change History</h5>
            <p className="text-muted">
              View the execution history of this ruleset.
            </p>
          </div>
        </div>
      )}

      {activeTab === 'advanced' && (
        <div className="card border-0 shadow-sm">
          <div className="card-body p-4">
            <h6 className="fw-bold mb-4">Advanced Settings</h6>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label small fw-bold">Apply to</label>
                <select
                  className="form-select"
                  value={ruleset.scope?.applyTo || 'all'}
                  onChange={(e) => setRuleset({ 
                    ...ruleset, 
                    scope: { ...ruleset.scope, applyTo: e.target.value } 
                  })}
                >
                  <option value="all">All ASINs</option>
                  <option value="selected">Selected Only</option>
                  <option value="tagged">Tagged Only</option>
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-bold">Conflict Resolution</label>
                <select
                  className="form-select"
                  value={ruleset.conflictResolution || 'first'}
                  onChange={(e) => setRuleset({ ...ruleset, conflictResolution: e.target.value })}
                >
                  <option value="first">First ruleset wins</option>
                  <option value="restrictive">Most restrictive action wins</option>
                  <option value="aggressive">Most aggressive action wins</option>
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-bold d-flex align-items-center gap-2">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={ruleset.emailOnRun || false}
                    onChange={(e) => setRuleset({ ...ruleset, emailOnRun: e.target.checked })}
                  />
                  Email me when this ruleset runs
                </label>
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-bold d-flex align-items-center gap-2">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={ruleset.emailOnAction || false}
                    onChange={(e) => setRuleset({ ...ruleset, emailOnAction: e.target.checked })}
                  />
                  Email me when actions are applied
                </label>
              </div>
              {ruleset.emailOnRun || ruleset.emailOnAction ? (
                <div className="col-md-6">
                  <label className="form-label small fw-bold">Email Address</label>
                  <input
                    type="email"
                    className="form-control"
                    value={ruleset.emailAddress || ''}
                    onChange={(e) => setRuleset({ ...ruleset, emailAddress: e.target.value })}
                    placeholder="your@email.com"
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="card border-0 shadow-sm">
          <div className="card-body p-4 text-center py-5">
            <BarChart size={48} className="text-muted mb-3" />
            <h5>Analytics</h5>
            <p className="text-muted">
              View performance analytics for this ruleset after it has been executed.
            </p>
          </div>
        </div>
      )}
    </div>
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
  moveUp,
  moveDown
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
    <div className="card border-0 shadow-sm" style={{ borderLeft: '4px solid #3b82f6', borderRadius: '8px' }}>
      <div 
        className="card-header bg-white border-0 d-flex justify-content-between align-items-center py-3 px-4"
        style={{ cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="d-flex align-items-center gap-3">
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          <span className="fw-bold">{rule.name || `Rule ${ruleIndex + 1}`}</span>
          <span className="badge bg-light text-dark">{rule.conditions?.length || 0} conditions</span>
        </div>
        <div className="d-flex gap-1">
          {moveUp && (
            <button className="btn btn-sm btn-light" onClick={(e) => { e.stopPropagation(); moveUp(); }} title="Move up">
              ↑
            </button>
          )}
          {moveDown && (
            <button className="btn btn-sm btn-light" onClick={(e) => { e.stopPropagation(); moveDown(); }} title="Move down">
              ↓
            </button>
          )}
          <button className="btn btn-sm btn-light" onClick={(e) => { e.stopPropagation(); onUpdate({ isActive: !rule.isActive }); }} title={rule.isActive ? 'Disable' : 'Enable'}>
            {rule.isActive ? <ToggleRight size={16} className="text-success" /> : <ToggleLeft size={16} className="text-muted" />}
          </button>
          <button className="btn btn-sm btn-light" onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Delete">
            <Trash2 size={14} className="text-danger" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="card-body py-3 px-4">
          <div className="row g-3 mb-4">
            <div className="col-md-6">
              <label className="form-label small fw-bold">Rule Name</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={rule.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                placeholder="Enter rule name"
              />
              <small className="text-muted">This name will be used to indicate 'why' a change was made.</small>
            </div>
          </div>

          <div className="mb-4">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div>
                <h6 className="fw-bold mb-0">Criteria</h6>
                <small className="text-muted">Each condition will be AND'd together.</small>
              </div>
            </div>

            {(rule.conditions || []).length === 0 ? (
              <div className="text-center py-3 bg-light rounded-2">
                <p className="text-muted small mb-2">No conditions defined</p>
                <button className="btn btn-sm btn-outline-primary" onClick={onAddCondition}>
                  <Plus size={14} className="me-1" /> Add Condition
                </button>
              </div>
            ) : (
              <div className="d-flex flex-column gap-2">
                {rule.conditions.map((condition, condIndex) => (
                  <div key={condIndex} className="d-flex align-items-center gap-2 p-2 bg-light rounded-2">
                    <select
                      className="form-select form-select-sm"
                      style={{ width: '180px' }}
                      value={condition.attribute}
                      onChange={(e) => onUpdateCondition(condIndex, { attribute: e.target.value })}
                    >
                      <option value="">Select Attribute</option>
                      {Object.entries(groupedAttributes).map(([group, attrs]) => (
                        <optgroup key={group} label={group}>
                          {attrs.map(attr => (
                            <option key={attr.value} value={attr.value}>{attr.label}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    
                    <select
                      className="form-select form-select-sm"
                      style={{ width: '140px' }}
                      value={condition.operator}
                      onChange={(e) => onUpdateCondition(condIndex, { operator: e.target.value })}
                      disabled={!condition.attribute}
                    >
                      {getOperatorsForAttribute(condition.attribute).map(op => (
                        <option key={op.value} value={op.value}>{op.label}</option>
                      ))}
                    </select>

                    {!['is empty', 'is not empty'].includes(condition.operator) && (
                      <>
                        <input
                          type="number"
                          className="form-control form-control-sm"
                          style={{ width: '100px' }}
                          placeholder="Value"
                          value={condition.value ?? ''}
                          onChange={(e) => onUpdateCondition(condIndex, { value: e.target.value ? parseFloat(e.target.value) : null })}
                        />
                        {condition.operator === 'between' && (
                          <input
                            type="number"
                            className="form-control form-select-sm"
                            style={{ width: '100px' }}
                            placeholder="Value 2"
                            value={condition.value2 ?? ''}
                            onChange={(e) => onUpdateCondition(condIndex, { value2: e.target.value ? parseFloat(e.target.value) : null })}
                          />
                        )}
                      </>
                    )}

                    {condIndex > 0 && (
                      <span className="badge bg-secondary">{condition.logicalOp}</span>
                    )}

                    <button
                      className="btn btn-sm btn-light text-danger"
                      onClick={() => onDeleteCondition(condIndex)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}

                <button className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1" onClick={onAddCondition}>
                  <Plus size={14} /> Add Condition
                </button>
              </div>
            )}
          </div>

          <div>
            <h6 className="fw-bold mb-2">Action</h6>
            <small className="text-muted d-block mb-2">Specify what action to take when the criteria is met.</small>
            
            <div className="d-flex align-items-center gap-2 p-2 bg-light rounded-2">
              <select
                className="form-select form-select-sm"
                style={{ width: '200px' }}
                value={rule.action?.actionType || ''}
                onChange={(e) => onUpdate({ 
                  action: { 
                    ...rule.action, 
                    actionType: e.target.value,
                    value: null,
                    value2: null
                  } 
                })}
              >
                <option value="">Select Action</option>
                {Object.entries(groupedActions).map(([group, acts]) => (
                  <optgroup key={group} label={group}>
                    {acts.map(act => (
                      <option key={act.value} value={act.value}>{act.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>

              {rule.action?.actionType && 
                actions.find(a => a.value === rule.action?.actionType)?.hasValue && (
                <>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    style={{ width: '100px' }}
                    placeholder="Value"
                    value={rule.action?.value ?? ''}
                    onChange={(e) => onUpdate({
                      action: { ...rule.action, value: e.target.value ? parseFloat(e.target.value) : null }
                    })}
                  />
                  <span className="text-muted small">
                    {actions.find(a => a.value === rule.action?.actionType)?.unit}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RulesetBuilderPage;