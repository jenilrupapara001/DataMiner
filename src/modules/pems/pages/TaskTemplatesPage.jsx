import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Button, Input, Select, Tag, Space, Modal, Form, Typography, Popconfirm, Row, Col, InputNumber, Switch, Tooltip, Empty, App, Drawer, Tabs, Divider, Progress } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CopyOutlined, SearchOutlined, ReloadOutlined, EyeOutlined, OrderedListOutlined, SaveOutlined, SettingOutlined, UserOutlined, ThunderboltOutlined, CheckSquareOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import pemsApi from '../services/pemsApi';
import { FREQUENCIES, CATEGORIES, PRIORITIES, TARGET_TYPES, DEPARTMENTS, COMPLEXITY_LEVELS, APPROVAL_LEVELS, AUTO_ASSIGN_STRATEGIES } from '../constants';

const { Text } = Typography;

function SopPhaseBuilder({ phases, setPhases }) {
  const addPhase = () => setPhases([...phases, { title: '', activities: [{ title: '', instructions: '', expectedOutput: '', validationRules: '', estimatedMinutes: 15 }] }]);
  const removePhase = (i) => setPhases(phases.filter((_, idx) => idx !== i));
  const updatePhase = (i, field, val) => { const u = [...phases]; u[i] = { ...u[i], [field]: val }; setPhases(u); };
  const addActivity = (pi) => { const u = [...phases]; u[pi].activities = [...(u[pi].activities || []), { title: '', instructions: '', expectedOutput: '', validationRules: '', estimatedMinutes: 15 }]; setPhases(u); };
  const removeActivity = (pi, ai) => { const u = [...phases]; u[pi].activities = u[pi].activities.filter((_, idx) => idx !== ai); setPhases(u); };
  const updateActivity = (pi, ai, field, val) => { const u = [...phases]; u[pi].activities[ai] = { ...u[pi].activities[ai], [field]: val }; setPhases(u); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {phases.map((phase, pi) => (
        <Card key={pi} size="small" style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
          title={<Space><Tag style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 10, borderRadius: 4, background: '#f0fdfa', color: '#0d9488', border: '1px solid #99f6e4' }}>Phase {pi + 1}</Tag>
            <Input size="small" value={phase.title} onChange={e => updatePhase(pi, 'title', e.target.value)} placeholder="Phase name (e.g. Campaign Analysis)" style={{ width: 300, fontWeight: 600 }} bordered={false} />
          </Space>}
          extra={phases.length > 1 && <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removePhase(pi)} />}>
          {(phase.activities || []).map((act, ai) => (
            <div key={ai} style={{ padding: '10px 12px', background: '#fafbfc', borderRadius: 6, marginBottom: 6, border: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Tag style={{ fontSize: 9, fontWeight: 700, fontFamily: 'monospace', background: '#eef2ff', color: '#1976D2', borderRadius: 4 }}>Activity {ai + 1}</Tag>
                <Input size="small" value={act.title} onChange={e => updateActivity(pi, ai, 'title', e.target.value)} placeholder="Activity name..." style={{ flex: 1, fontWeight: 500 }} bordered={false} />
                {phase.activities.length > 1 && <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeActivity(pi, ai)} />}
              </div>
              <Input.TextArea size="small" value={act.instructions} onChange={e => updateActivity(pi, ai, 'instructions', e.target.value)} placeholder="Instructions / SOP steps..." rows={2} bordered={false} style={{ marginBottom: 6 }} />
              <Row gutter={8}>
                <Col span={8}><Input size="small" value={act.expectedOutput} onChange={e => updateActivity(pi, ai, 'expectedOutput', e.target.value)} placeholder="Expected output" bordered={false} style={{ fontSize: 11 }} /></Col>
                <Col span={8}><Input size="small" value={act.validationRules} onChange={e => updateActivity(pi, ai, 'validationRules', e.target.value)} placeholder="Validation rules" bordered={false} style={{ fontSize: 11 }} /></Col>
                <Col span={8}><InputNumber size="small" value={act.estimatedMinutes} onChange={v => updateActivity(pi, ai, 'estimatedMinutes', v)} min={1} placeholder="Minutes" style={{ width: '100%', fontSize: 11 }} addonAfter="min" /></Col>
              </Row>
            </div>
          ))}
          <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => addActivity(pi)} block style={{ marginTop: 4 }}>Add Activity</Button>
        </Card>
      ))}
      <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addPhase} block>Add Phase</Button>
    </div>
  );
}

function SubTaskBuilder({ subTasks, setSubTasks }) {
  const totalWeight = subTasks.reduce((s, st) => s + (st.weightagePct || 0), 0);
  const addSubTask = () => setSubTasks([...subTasks, { title: '', description: '', ownerType: 'Brand Manager', weightagePct: 0, isMandatory: true, reviewRequired: false }]);
  const removeSubTask = (i) => setSubTasks(subTasks.filter((_, idx) => idx !== i));
  const update = (i, field, val) => { const u = [...subTasks]; u[i] = { ...u[i], [field]: val }; setSubTasks(u); };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Text style={{ fontSize: 11, color: '#64748b' }}>
          Total weight: <Text strong style={{ color: totalWeight === 100 ? '#16a34a' : totalWeight > 100 ? '#dc2626' : '#f59e0b' }}>{totalWeight}%</Text>
          {totalWeight < 100 && <Text type="secondary"> (should equal 100%)</Text>}
        </Text>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {subTasks.map((st, i) => (
          <Card key={i} size="small" style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
            title={<Space><Tag style={{ fontSize: 10, fontWeight: 700, fontFamily: 'monospace', background: '#f0fdfa', color: '#0d9488', borderRadius: 4 }}>ST-{i + 1}</Tag>
              <Input size="small" value={st.title} onChange={e => update(i, 'title', e.target.value)} placeholder="Sub Task name" style={{ width: 260, fontWeight: 600 }} bordered={false} />
            </Space>
            } extra={subTasks.length > 1 && <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeSubTask(i)} />}>
            <Input.TextArea size="small" value={st.description} onChange={e => update(i, 'description', e.target.value)} placeholder="Description..." rows={1} bordered={false} style={{ marginBottom: 6 }} />
            <Row gutter={8}>
              <Col span={6}>
                <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>Owner Type</div>
                <Select size="small" value={st.ownerType} onChange={v => update(i, 'ownerType', v)} style={{ width: '100%' }}
                  options={[{ value: 'Brand Manager', label: 'Brand Manager' }, { value: 'Catalog Team', label: 'Catalog Team' }, { value: 'Operations', label: 'Operations' }]} />
              </Col>
              <Col span={5}>
                <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>Weightage %</div>
                <InputNumber size="small" value={st.weightagePct} onChange={v => update(i, 'weightagePct', v)} min={0} max={100} style={{ width: '100%' }} addonAfter="%" />
              </Col>
              <Col span={5}>
                <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>Mandatory</div>
                <Switch size="small" checked={st.isMandatory} onChange={v => update(i, 'isMandatory', v)} />
              </Col>
              <Col span={5}>
                <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>Review Required</div>
                <Switch size="small" checked={st.reviewRequired} onChange={v => update(i, 'reviewRequired', v)} />
              </Col>
            </Row>
          </Card>
        ))}
        <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addSubTask} block>Add Sub Task</Button>
      </div>
    </div>
  );
}

export default function TaskTemplatesPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [frequencyFilter, setFrequencyFilter] = useState(null);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [form] = Form.useForm();

  // SOP & Sub Tasks
  const [phases, setPhases] = useState([{ title: '', activities: [{ title: '', instructions: '', expectedOutput: '', validationRules: '', estimatedMinutes: 15 }] }]);
  const [subTasks, setSubTasks] = useState([{ title: '', description: '', ownerType: 'Brand Manager', weightagePct: 0, isMandatory: true, reviewRequired: false }]);

  // Assignment & SLA
  const [assignmentMode, setAssignmentMode] = useState('manual');
  const [autoStrategy, setAutoStrategy] = useState('lowest_workload');
  const [approvalLevel, setApprovalLevel] = useState('single');
  const [escalationHours, setEscalationHours] = useState(24);
  const [qualityScoreRequired, setQualityScoreRequired] = useState(false);

  const loadTemplates = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: pagination.limit };
      if (search) params.search = search;
      if (categoryFilter) params.category = categoryFilter;
      if (frequencyFilter) params.frequency = frequencyFilter;
      const res = await pemsApi.getTemplates(params);
      if (res.success) { setTemplates(res.templates); setPagination(res.pagination); }
    } catch { message.error('Failed to load templates'); }
    finally { setLoading(false); }
  }, [search, categoryFilter, frequencyFilter, pagination.limit]);

  useEffect(() => { loadTemplates(); }, []);

  const resetDrawerState = () => {
    form.resetFields();
    setPhases([{ title: '', activities: [{ title: '', instructions: '', expectedOutput: '', validationRules: '', estimatedMinutes: 15 }] }]);
    setSubTasks([{ title: '', description: '', ownerType: 'Brand Manager', weightagePct: 0, isMandatory: true, reviewRequired: false }]);
    setAssignmentMode('manual');
    setAutoStrategy('lowest_workload');
    setApprovalLevel('single');
    setEscalationHours(24);
    setQualityScoreRequired(false);
    setActiveTab('overview');
  };

  const openCreateDrawer = () => {
    resetDrawerState();
    setEditingTemplate(null);
    form.setFieldsValue({ frequency: 'WEEKLY', priority: 'MEDIUM', category: 'GENERAL', targetType: 'NUMERIC', department: 'Operations', slaHours: 48, tatHours: 24, defaultTarget: 0, isActive: true, reviewRequired: true, criticalityScore: 5, estimatedExecutionMinutes: 60 });
    setDrawerOpen(true);
  };

  const openEditDrawer = async (record) => {
    setEditingTemplate(record);
    resetDrawerState();
    form.setFieldsValue({
      name: record.Name, description: record.Description, category: record.Category,
      department: record.Department, frequency: record.Frequency, slaHours: record.SLAHours,
      tatHours: record.TATHours, priority: record.Priority, targetType: record.TargetType,
      defaultTarget: record.DefaultTarget, expectedOutput: record.ExpectedOutput, isActive: record.IsActive,
      reviewRequired: record.ReviewRequired, criticalityScore: record.CriticalityScore || 5,
      estimatedExecutionMinutes: record.EstimatedExecutionMinutes || 60,
    });
    // Load SOP
    const existingSop = record.SubTaskDefinitions || record.subTaskDefinitions || [];
    if (existingSop.length > 0) {
      setPhases(existingSop.map(p => ({
        title: p.title || '',
        activities: (p.activities || []).map(a => ({
          title: a.title || '', instructions: a.instructions || '',
          expectedOutput: a.expectedOutput || '', validationRules: a.validationRules || '',
          estimatedMinutes: a.estimatedMinutes || 15,
        }))
      })));
    }
    // Load assignment rules
    try {
      const detailRes = await pemsApi.getTemplateDetail(record.Id);
      if (detailRes.success && detailRes.data.assignmentRules) {
        const r = detailRes.data.assignmentRules;
        setAssignmentMode(r.AssignmentMode || 'manual');
        setAutoStrategy(r.AutoAssignStrategy || 'lowest_workload');
        setApprovalLevel(r.ApprovalLevel || 'single');
        setEscalationHours(r.EscalationHours || 24);
        setQualityScoreRequired(r.QualityScoreRequired || false);
      }
    } catch { }
    setDrawerOpen(true);
  };

  const openDuplicateDrawer = (record) => {
    setEditingTemplate(null);
    resetDrawerState();
    form.setFieldsValues({
      name: `${record.Name} (Copy)`, description: record.Description, category: record.Category,
      department: record.Department, frequency: record.Frequency, slaHours: record.SLAHours,
      tatHours: record.TATHours, priority: record.Priority, targetType: record.TargetType,
      defaultTarget: record.DefaultTarget, expectedOutput: record.ExpectedOutput, isActive: true,
      reviewRequired: record.ReviewRequired, criticalityScore: record.CriticalityScore || 5,
      estimatedExecutionMinutes: record.EstimatedExecutionMinutes || 60,
    });
    const existingSop = record.SubTaskDefinitions || record.subTaskDefinitions || [];
    if (existingSop.length > 0) {
      setPhases(existingSop.map(p => ({
        title: p.title || '',
        activities: (p.activities || []).map(a => ({
          title: a.title || '', instructions: a.instructions || '',
          expectedOutput: a.expectedOutput || '', validationRules: a.validationRules || '',
          estimatedMinutes: a.estimatedMinutes || 15,
        }))
      })));
    }
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      let templateId;
      if (editingTemplate) {
        await pemsApi.updateTemplate(editingTemplate.Id, { ...values, subTaskDefinitions: phases });
        templateId = editingTemplate.Id;
        message.success('Template updated');
      } else {
        const res = await pemsApi.createTemplate({ ...values, subTaskDefinitions: phases });
        templateId = res.data?.id;
        message.success('Template created');
      }
      // Save sub tasks and assignment rules
      if (templateId) {
        if (subTasks.length > 0 && subTasks.some(st => st.title)) {
          await pemsApi.updateTemplate(templateId, { subTaskDefinitions: phases });
        }
        await pemsApi.upsertAssignmentRules(templateId, {
          assignmentMode, autoAssignStrategy: autoStrategy,
          approvalLevel, escalationHours, qualityScoreRequired,
        });
      }
      setDrawerOpen(false);
      loadTemplates(pagination.page);
    } catch (err) { if (err.errorFields) { setActiveTab('overview'); return; } message.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try { await pemsApi.deleteTemplate(id); message.success('Template deleted'); loadTemplates(pagination.page); }
    catch { message.error('Failed to delete'); }
  };

  const columns = [
    { title: 'Code', dataIndex: 'TaskCode', width: 90, render: (code) => <Text code style={{ fontSize: 10 }}>{code}</Text> },
    { title: 'Name', dataIndex: 'Name', render: (name) => <Text strong style={{ fontSize: 12 }}>{name}</Text> },
    { title: 'Department', dataIndex: 'Department', width: 110, render: (d) => <Tag style={{ borderRadius: 10, fontSize: 10, background: '#eff6ff', color: '#1d4ed8' }}>{d || '-'}</Tag> },
    { title: 'Category', dataIndex: 'Category', width: 90, render: (c) => <Tag style={{ borderRadius: 10, fontSize: 10 }}>{c}</Tag> },
    { title: 'Freq', dataIndex: 'Frequency', width: 80, render: (f) => <Tag color="blue" style={{ borderRadius: 10, fontSize: 9 }}>{FREQUENCIES.find(x => x.value === f)?.label || f}</Tag> },
    { title: 'Priority', dataIndex: 'Priority', width: 80, render: (p) => { const c = PRIORITIES[p] || PRIORITIES.MEDIUM; return <Tag style={{ background: c.bg, color: c.color, border: `1px solid ${c.color}30`, borderRadius: 10, fontSize: 10 }}>{c.label}</Tag>; } },
    { title: 'SLA', dataIndex: 'SLAHours', width: 55, align: 'center', render: (h) => <Text style={{ fontSize: 11 }}>{h}h</Text> },
    { title: 'Target', dataIndex: 'DefaultTarget', width: 60, align: 'center', render: (t) => t || '-' },
    {
      title: 'SOP', key: 'sop', width: 80, align: 'center', render: (_, r) => {
        const st = r.SubTaskDefinitions || r.subTaskDefinitions || [];
        const acts = st.reduce((sum, s) => sum + (s.activities?.length || 0), 0);
        return st.length > 0 ? <Tag color="success" style={{ fontSize: 9 }}>{st.length}P · {acts}A</Tag> : <Tag style={{ fontSize: 9, color: '#94a3b8' }}>No SOP</Tag>;
      }
    },
    { title: 'Status', dataIndex: 'IsActive', width: 70, align: 'center', render: (a) => a ? <Tag color="success" style={{ borderRadius: 10, fontSize: 9 }}>Active</Tag> : <Tag style={{ borderRadius: 10, fontSize: 9 }}>Inactive</Tag> },
    {
      title: 'Actions', key: 'actions', width: 140, align: 'right', render: (_, record) => (
        <Space size={2}>
          <Tooltip title="View"><Button type="text" icon={<EyeOutlined />} size="small" onClick={() => navigate(`/pems/templates/${record.Id}`)} style={{ color: '#2563eb' }} /></Tooltip>
          <Tooltip title="Edit"><Button type="text" icon={<EditOutlined />} size="small" onClick={() => openEditDrawer(record)} /></Tooltip>
          <Tooltip title="Clone"><Button type="text" icon={<CopyOutlined />} size="small" onClick={() => openDuplicateDrawer(record)} /></Tooltip>
          <Popconfirm title="Delete?" onConfirm={() => handleDelete(record.Id)}>
            <Tooltip title="Delete"><Button type="text" icon={<DeleteOutlined />} size="small" danger /></Tooltip>
          </Popconfirm>
        </Space>
      )
    },
  ];

  const drawerTabItems = [
    {
      key: 'overview', label: 'Overview',
      children: (
        <Form form={form} layout="vertical" size="small">
          <Row gutter={12}>
            <Col span={16}><Form.Item name="name" label="Template Name" rules={[{ required: true }]}><Input placeholder="e.g. Optimize Product Listings" /></Form.Item></Col>
            <Col span={8}><Form.Item name="isActive" label="Active" valuePropName="checked"><Switch /></Form.Item></Col>
          </Row>
          <Form.Item name="description" label="Description"><Input.TextArea rows={2} placeholder="Describe the task..." /></Form.Item>
          <Row gutter={12}>
            <Col span={8}><Form.Item name="department" label="Department" rules={[{ required: true }]}><Select options={DEPARTMENTS.map(d => ({ value: d.value, label: d.label }))} /></Form.Item></Col>
            <Col span={8}><Form.Item name="category" label="Category"><Select options={CATEGORIES.map(c => ({ value: c.value, label: c.label }))} /></Form.Item></Col>
            <Col span={8}><Form.Item name="frequency" label="Frequency"><Select options={FREQUENCIES.map(f => ({ value: f.value, label: f.label }))} /></Form.Item></Col>
          </Row>
          <Row gutter={12}>
            <Col span={6}><Form.Item name="priority" label="Priority"><Select options={Object.entries(PRIORITIES).map(([k, v]) => ({ value: k, label: v.label }))} /></Form.Item></Col>
            <Col span={6}><Form.Item name="targetType" label="Target Type"><Select options={TARGET_TYPES.map(t => ({ value: t.value, label: t.label }))} /></Form.Item></Col>
            <Col span={6}><Form.Item name="defaultTarget" label="Default Target"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={6}><Form.Item name="expectedOutput" label="Expected Output"><Input placeholder="e.g. Optimized Report" /></Form.Item></Col>
          </Row>
          <Row gutter={12}>
            <Col span={6}><Form.Item name="estimatedExecutionMinutes" label="Est. Time (min)"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={6}><Form.Item name="criticalityScore" label="Criticality (1-10)"><InputNumber min={1} max={10} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={6}><Form.Item name="reviewRequired" label="Review Required" valuePropName="checked"><Switch /></Form.Item></Col>
          </Row>
        </Form>
      ),
    },
    {
      key: 'sop', label: `SOP Builder (${phases.length} phases)`,
      children: <SopPhaseBuilder phases={phases} setPhases={setPhases} />,
    },
    {
      key: 'subtasks', label: `Sub Tasks (${subTasks.length})`,
      children: <SubTaskBuilder subTasks={subTasks} setSubTasks={setSubTasks} />,
    },
    {
      key: 'assignment', label: 'Assignment Rules',
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>Assignment Mode</Text>
            <Select value={assignmentMode} onChange={setAssignmentMode} style={{ width: 200 }} options={[
              { value: 'manual', label: 'Manual Assignment' },
              { value: 'auto', label: 'Auto Assignment' },
            ]} />
          </div>
          {assignmentMode === 'auto' && (
            <div>
              <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>Auto Assignment Strategy</Text>
              <Select value={autoStrategy} onChange={setAutoStrategy} style={{ width: 240 }}
                options={AUTO_ASSIGN_STRATEGIES.map(s => ({ value: s.value, label: s.label }))} />
            </div>
          )}
          <Divider style={{ margin: '4px 0' }} />
          <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>Escalation</Text>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Text style={{ fontSize: 11 }}>Escalate after</Text>
            <InputNumber size="small" value={escalationHours} onChange={setEscalationHours} min={1} max={168} style={{ width: 80 }} />
            <Text style={{ fontSize: 11 }}>hours</Text>
          </div>
          <Divider style={{ margin: '4px 0' }} />
          <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>Quality Control</Text>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Switch size="small" checked={qualityScoreRequired} onChange={setQualityScoreRequired} />
            <Text style={{ fontSize: 11 }}>Require quality score on review</Text>
          </div>
        </div>
      ),
    },
    {
      key: 'sla', label: 'SLA & Review',
      children: (
        <Form form={form} layout="vertical" size="small">
          <Row gutter={12}>
            <Col span={8}><Form.Item name="slaHours" label="SLA Hours"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="tatHours" label="TAT Hours"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
          <Divider style={{ margin: '4px 0' }} />
          <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>Approval Level</Text>
          <Select value={approvalLevel} onChange={setApprovalLevel} style={{ width: 220 }} options={APPROVAL_LEVELS.map(a => ({ value: a.value, label: a.label }))} />
          <div style={{ marginTop: 12, padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <Text style={{ fontSize: 11, color: '#64748b' }}>
              {approvalLevel === 'single' && 'Single approval: One reviewer approves to complete the task.'}
              {approvalLevel === 'dual' && 'Dual approval: Two independent reviewers must approve.'}
              {approvalLevel === 'multi' && 'Multi-level: Multiple approvals required at different stages.'}
            </Text>
          </div>
        </Form>
      ),
    },
  ];

  return (
    <div style={{ background: '#f8fafc', minHeight: '100%', padding: '0 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0' }}>
        <Space>
          <Text strong style={{ fontSize: 18 }}>Task Templates</Text>
          <Tag color="blue" style={{ borderRadius: 12 }}>{pagination.total}</Tag>
        </Space>
        <Space>
          <Input prefix={<SearchOutlined />} placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} onPressEnter={() => loadTemplates(1)} style={{ width: 200, borderRadius: 8 }} size="small" />
          <Select allowClear placeholder="Category" value={categoryFilter} onChange={v => { setCategoryFilter(v); setTimeout(() => loadTemplates(1), 0); }} style={{ width: 110 }} size="small" options={CATEGORIES.map(c => ({ value: c.value, label: c.label }))} />
          <Select allowClear placeholder="Freq" value={frequencyFilter} onChange={v => { setFrequencyFilter(v); setTimeout(() => loadTemplates(1), 0); }} style={{ width: 100 }} size="small" options={FREQUENCIES.map(f => ({ value: f.value, label: f.label }))} />
          <Button icon={<ReloadOutlined />} onClick={() => loadTemplates(1)} size="small" />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateDrawer} style={{ borderRadius: 6, fontWeight: 600 }} size="small">New Template</Button>
        </Space>
      </div>

      <Card size="small" style={{ borderRadius: 8 }}>
        <Table dataSource={templates} columns={columns} rowKey="Id" loading={loading} size="small"
          pagination={{
            current: pagination.page, pageSize: pagination.limit, total: pagination.total, showSizeChanger: true, onChange: (page) => loadTemplates(page),
            showTotal: (t) => <Text type="secondary" style={{ fontSize: 11 }}>{t} templates</Text>
          }} />
      </Card>

      {/* ═══ 5-TAB TEMPLATE CREATION/EDIT DRAWER ═══ */}
      <Drawer
        title={
          <Space>
            <ThunderboltOutlined style={{ color: '#2563eb' }} />
            <Text strong style={{ fontSize: 15 }}>{editingTemplate ? `Edit: ${editingTemplate.TaskCode}` : 'Create Task Template'}</Text>
          </Space>
        }
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={1200}
        destroyOnHidden
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)} style={{ borderRadius: 6 }}>Cancel</Button>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving} style={{ borderRadius: 6, fontWeight: 600, background: '#2563eb', borderColor: '#2563eb' }}>
              {editingTemplate ? 'Update Template' : 'Create Template'}
            </Button>
          </Space>
        }
      >
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={drawerTabItems} />
      </Drawer>
    </div>
  );
}
