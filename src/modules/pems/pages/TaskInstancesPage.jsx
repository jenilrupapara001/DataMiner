import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Button, Input, Select, Tag, Space, Typography, Tooltip, Progress, Modal, Segmented, Checkbox, Empty, App, Spin, Drawer, Row, Col } from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined, EyeOutlined, CheckCircleOutlined,
  ClockCircleOutlined, FileTextOutlined, UploadOutlined, CommentOutlined,
  CheckSquareOutlined, WarningOutlined, EditOutlined, DeleteOutlined,
  ExportOutlined, UserOutlined, SettingOutlined, ThunderboltOutlined,
  SafetyCertificateOutlined, TeamOutlined, RightOutlined, LeftOutlined, TrophyOutlined,
  ArrowRightOutlined, FilterOutlined, DownloadOutlined, BarChartOutlined
} from '@ant-design/icons';
import pemsApi from '../services/pemsApi';
import { WORKFLOW_STATUSES, VALID_TRANSITIONS, SLA_STATUSES, FREQUENCIES, PRIORITIES, DEPARTMENTS, CATEGORIES, COMPLEXITY_LEVELS, TARGET_TYPES } from '../constants';
import { calculateHealth, isOverdue, isDueToday, getDueDateLabel, formatNumber } from '../utils/taskHealth';
import { useAuth } from '../../../contexts/AuthContext';
import { CommandCenterKpis } from '../components/CommandCenterKpis';
import BoardView from '../components/BoardView';
import RightInsightsPanel from '../components/RightInsightsPanel';
import MobileTaskCard from '../components/MobileTaskCard';
import LiveActivityFeed from '../components/LiveActivityFeed';
import PremiumTaskRow from '../components/PremiumTaskRow';
import CalendarView from '../components/CalendarView';
import TaskWorkspace from '../components/TaskWorkspace';
import { exportTasksToExcel } from '../utils/exportUtils';
import dayjs from 'dayjs';

const { Text } = Typography;

const QUICK_VIEWS = [
  { key: 'ALL', label: 'All Tasks' },
  { key: 'MY_TASKS', label: 'My Tasks' },
  { key: 'PENDING_REVIEW', label: 'Pending Review' },
  { key: 'OVERDUE', label: 'Overdue' },
  { key: 'CRITICAL', label: 'Critical' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'Operations', label: 'Operations' },
  { key: 'Brand Managers', label: 'Brand Managers' },
  { key: 'Catalog Team', label: 'Catalog Team' },
];

export default function TaskInstancesPage() {
  const { message } = App.useApp();
  const { user: currentUser } = useAuth();
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0 });
  const [summary, setSummary] = useState(null);
  const [quickView, setQuickView] = useState('ALL');
  const [viewMode, setViewMode] = useState('list');
  const [search, setSearch] = useState('');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filters, setFilters] = useState({ department: null, seller: null, manager: null, reviewer: null, priority: null, status: null, health: null, frequency: null });
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Workspace
  const [workspaceTaskId, setWorkspaceTaskId] = useState(null);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);

  // Wizard
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardData, setWizardData] = useState({});
  const [creating, setCreating] = useState(false);

  // Dynamic data
  const [sellers, setSellers] = useState([]);
  const [managers, setManagers] = useState([]);
  const [reviewers, setReviewers] = useState([]);
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    pemsApi.getSellers().then(r => { if (r.success) setSellers(r.data); }).catch(() => {});
    pemsApi.getBrandManagers().then(r => { if (r.success) setManagers(r.data); }).catch(() => {});
    pemsApi.getReviewers().then(r => { if (r.success) setReviewers(r.data); }).catch(() => {});
    pemsApi.getTemplates({ limit: 100, isActive: true }).then(r => { if (r.success) setTemplates(r.templates || []); }).catch(() => {});
  }, []);

  const buildParams = useCallback(() => {
    const p = { page: pagination.page, limit: pagination.limit };
    if (search) p.search = search;
    if (quickView === 'MY_TASKS') p.assignedTo = currentUser?.id;
    else if (quickView === 'PENDING_REVIEW') p.status = 'UNDER_REVIEW';
    else if (quickView === 'CRITICAL') p.priority = 'CRITICAL';
    else if (quickView === 'APPROVED') p.status = 'APPROVED';
    else if (quickView === 'Operations') p.department = 'Operations';
    else if (quickView === 'Brand Managers') p.department = 'Brand Managers';
    else if (quickView === 'Catalog Team') p.department = 'Catalog Team';
    if (filters.department) p.department = filters.department;
    if (filters.seller) p.sellerId = filters.seller;
    if (filters.manager) p.assignedTo = filters.manager;
    if (filters.reviewer) p.reviewerId = filters.reviewer;
    if (filters.priority) p.priority = filters.priority;
    if (filters.status) p.status = filters.status;
    if (filters.frequency) p.frequency = filters.frequency;
    return p;
  }, [quickView, filters, search, pagination.page, pagination.limit, currentUser]);

  const loadInstances = useCallback(async () => {
    setLoading(true);
    try {
      const [instRes, sumRes] = await Promise.all([
        pemsApi.getInstances(buildParams()),
        pemsApi.getDashboardSummary(),
      ]);
      if (instRes.success) {
        let data = instRes.instances || [];
        if (quickView === 'OVERDUE') data = data.filter(t => isOverdue(t));
        if (filters.health === 'critical') data = data.filter(t => calculateHealth(t).score < 50);
        else if (filters.health === 'attention') data = data.filter(t => { const h = calculateHealth(t).score; return h >= 50 && h < 80; });
        else if (filters.health === 'healthy') data = data.filter(t => calculateHealth(t).score >= 80);
        setInstances(data);
        setPagination(instRes.pagination);
      }
      if (sumRes.success) setSummary(sumRes.data);
    } catch { message.error('Failed to load tasks'); }
    finally { setLoading(false); }
  }, [buildParams, quickView, filters]);

  useEffect(() => { loadInstances(); }, [quickView, filters, search, pagination.page]);

  const openWorkspace = (task) => { setWorkspaceTaskId(task.Id); setWorkspaceOpen(true); };

  const openWizard = () => { setWizardStep(0); setWizardData({}); setWizardOpen(true); };
  const handleWizardNext = () => {
    if (wizardStep === 0 && !wizardData.templateId) { message.warning('Select a template'); return; }
    if (wizardStep === 0 && !wizardData.title) { message.warning('Enter a task name'); return; }
    setWizardStep(Math.min(wizardStep + 1, 4));
  };
  const handleCreateTask = async () => {
    setCreating(true);
    try {
      await pemsApi.createInstance({
        templateId: wizardData.templateId, title: wizardData.title,
        sellerId: wizardData.sellerId, sellerName: wizardData.sellerName,
        assignedTo: wizardData.assignedTo, assigneeName: wizardData.assigneeName,
        reviewerId: wizardData.reviewerId, reviewerName: wizardData.reviewerName,
        department: wizardData.department, priority: wizardData.priority,
        target: wizardData.target, dueDate: wizardData.dueDate?.toISOString(),
        frequency: wizardData.frequency,
      });
      message.success('Task created'); setWizardOpen(false); loadInstances();
    } catch { message.error('Failed to create task'); }
    finally { setCreating(false); }
  };

  const toggleSelectAll = () => selectedIds.size === instances.length ? setSelectedIds(new Set()) : setSelectedIds(new Set(instances.map(i => i.Id)));
  const toggleSelect = (id) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const kpi = summary?.kpi || {};

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh' }}>
      {/* ═══ HEADER ═══ */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Text strong style={{ fontSize: 18, color: '#0f172a' }}>Task Execution Center</Text>
          <LiveActivityFeed compact />
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadInstances} loading={loading} size="small" style={{ borderRadius: 8 }}>Refresh</Button>
          <Button icon={<DownloadOutlined />} size="small" style={{ borderRadius: 8 }}>Export</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openWizard} style={{ borderRadius: 8, fontWeight: 600, background: '#2563eb', borderColor: '#2563eb' }}>New Task</Button>
        </Space>
      </div>

      <div style={{ padding: '16px 24px' }}>
        {/* ═══ KPI STRIP ═══ */}
        <CommandCenterKpis kpi={kpi} risk={summary?.risk} />

        {/* ═══ QUICK VIEWS + CONTROLS ═══ */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 2, flex: 1 }}>
            {QUICK_VIEWS.map(qv => (
              <div key={qv.key} onClick={() => { setQuickView(qv.key); setPagination(p => ({ ...p, page: 1 })); }}
                style={{ padding: '5px 14px', borderRadius: 20, fontSize: 11, fontWeight: quickView === qv.key ? 700 : 500,
                  background: quickView === qv.key ? '#2563eb' : '#fff', color: quickView === qv.key ? '#fff' : '#475569',
                  border: `1px solid ${quickView === qv.key ? '#2563eb' : '#e5e7eb'}`,
                  cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s', userSelect: 'none' }}>
                {qv.label}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <Segmented size="small" value={viewMode} onChange={setViewMode} options={[
              { label: 'List', value: 'list' }, { label: 'Board', value: 'board' }, { label: 'Calendar', value: 'calendar' },
            ]} />
            <Input prefix={<SearchOutlined style={{ fontSize: 12 }} />} placeholder="Search tasks, sellers, ASINs..." value={search} onChange={e => setSearch(e.target.value)} onPressEnter={() => loadInstances()} style={{ width: 240, borderRadius: 8 }} size="small" />
            <Button icon={<FilterOutlined />} onClick={() => setShowFilterPanel(!showFilterPanel)} size="small" type={Object.values(filters).some(v => v) ? 'primary' : 'default'} style={{ borderRadius: 8 }}>
              Filters {Object.values(filters).filter(v => v).length > 0 && <Badge count={Object.values(filters).filter(v => v).length} size="small" style={{ marginLeft: 4 }} />}
            </Button>
          </div>
        </div>

        {/* ═══ ADVANCED FILTER PANEL ═══ */}
        {showFilterPanel && (
          <Card size="small" style={{ borderRadius: 10, marginBottom: 12 }} styles={{ body: { padding: '12px 16px' } }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              {[
                { key: 'department', label: 'Department', options: DEPARTMENTS.map(d => ({ value: d.value, label: d.label })) },
                { key: 'seller', label: 'Seller', options: sellers.map(s => ({ value: s.Id, label: s.Name })) },
                { key: 'manager', label: 'Manager', options: managers.map(m => ({ value: m.Id, label: m.FullName })) },
                { key: 'reviewer', label: 'Reviewer', options: reviewers.map(r => ({ value: r.Id, label: r.FullName })) },
                { key: 'priority', label: 'Priority', options: Object.entries(PRIORITIES).map(([k, v]) => ({ value: k, label: v.label })) },
                { key: 'status', label: 'Status', options: Object.entries(WORKFLOW_STATUSES).map(([k, v]) => ({ value: k, label: v.label })) },
                { key: 'health', label: 'Health', options: [{ value: 'critical', label: 'Critical' }, { value: 'attention', label: 'Attention' }, { value: 'healthy', label: 'Healthy' }] },
              ].map(f => (
                <div key={f.key}>
                  <Text style={{ fontSize: 9, color: '#94a3b8', display: 'block', marginBottom: 3, fontWeight: 600 }}>{f.label}</Text>
                  <Select allowClear placeholder={f.label} value={filters[f.key]} onChange={v => setFilters(p => ({ ...p, [f.key]: v }))} size="small" style={{ width: 120 }} showSearch optionFilterProp="label" options={f.options} />
                </div>
              ))}
              <Button size="small" onClick={() => { setFilters({ department: null, seller: null, manager: null, reviewer: null, priority: null, status: null, health: null, frequency: null }); }}>Clear</Button>
            </div>
          </Card>
        )}

        {/* ═══ BULK ACTIONS ═══ */}
        {selectedIds.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', background: '#eff6ff', borderRadius: 10, marginBottom: 12, border: '1px solid #bfdbfe' }}>
            <Checkbox checked={selectedIds.size === instances.length} onChange={toggleSelectAll}>
              <Text strong style={{ fontSize: 11, color: '#1e40af' }}>{selectedIds.size} selected</Text>
            </Checkbox>
            <div style={{ flex: 1 }} />
            <Space size={4}>
              <Button size="small" style={{ borderRadius: 6 }}>Assign</Button>
              <Button size="small" style={{ borderRadius: 6 }} icon={<CheckCircleOutlined />}>Approve</Button>
              <Button size="small" danger style={{ borderRadius: 6 }}>Reject</Button>
              <Button size="small" style={{ borderRadius: 6 }} icon={<DownloadOutlined />}>Export</Button>
            </Space>
            <Button size="small" type="text" onClick={() => setSelectedIds(new Set())} style={{ color: '#dc2626' }}>Clear</Button>
          </div>
        )}

        {/* ═══ MAIN CONTENT ═══ */}
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {viewMode === 'board' ? (
              <BoardView instances={instances} loading={loading} onView={openWorkspace} />
            ) : (
              /* LIST VIEW */
              <Card size="small" style={{ borderRadius: 10 }} styles={{ body: { padding: 0 } }}>
                {/* Table Header */}
                <div style={{ display: 'grid', gridTemplateColumns: '36px minmax(0,2fr) 120px 90px 100px 130px 100px', alignItems: 'center', padding: '8px 14px', borderBottom: '2px solid #e5e7eb', background: '#f8fafc' }}>
                  <div><Checkbox checked={selectedIds.size === instances.length && instances.length > 0} onChange={toggleSelectAll} /></div>
                  <Text style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Task</Text>
                  <Text style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Assignee</Text>
                  <Text style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Priority</Text>
                  <Text style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Status</Text>
                  <Text style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Progress</Text>
                  <Text style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Due</Text>
                </div>

                {/* Mobile cards for small screens */}
                <div style={{ display: 'none' }} className="pems-mobile-only">
                  {loading ? <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div> :
                    instances.length === 0 ? <Empty description="No tasks found" style={{ padding: 40 }} /> :
                    instances.map(t => <MobileTaskCard key={t.Id} task={t} onView={openWorkspace} />)}
                </div>

                {/* Desktop list */}
                {loading ? (
                  <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
                ) : instances.length === 0 ? (
                  <Empty description={
                    <Space direction="vertical" size={4}>
                      <Text style={{ fontSize: 14, fontWeight: 600 }}>No tasks found</Text>
                      <Text style={{ fontSize: 12, color: '#94a3b8' }}>{quickView !== 'ALL' ? 'Try a different view' : 'Create your first task to get started'}</Text>
                    </Space>
                  } style={{ padding: 60 }} />
                ) : (
                  <div>
                    {instances.map((task, i) => (
                      <PremiumTaskRow
                        key={task.Id}
                        task={task}
                        index={i}
                        selected={selectedIds.has(task.Id)}
                        onSelect={toggleSelect}
                        onView={openWorkspace}
                        onTransition={(t, s) => setWorkspaceTaskId(t.Id) || setWorkspaceOpen(true)}
                        onReview={(t, d) => setWorkspaceTaskId(t.Id) || setWorkspaceOpen(true)}
                      />
                    ))}
                  </div>
                )}

                {/* Pagination */}
                {instances.length > 0 && (
                  <div style={{ padding: '8px 14px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>{pagination.total} tasks</Text>
                    <Space>
                      <Button size="small" disabled={pagination.page <= 1} onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))} icon={<LeftOutlined />} />
                      <Text style={{ fontSize: 11, fontWeight: 600 }}>Page {pagination.page} of {Math.ceil(pagination.total / pagination.limit) || 1}</Text>
                      <Button size="small" disabled={pagination.page >= Math.ceil(pagination.total / pagination.limit)} onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))} icon={<RightOutlined />} />
                    </Space>
                  </div>
                )}
              </Card>
            )}
          </div>

          {/* ═══ RIGHT INSIGHTS PANEL ═══ */}
          <RightInsightsPanel onTaskClick={openWorkspace} />
        </div>
      </div>

      {/* ═══ ENTERPRISE TASK WORKSPACE ═══ */}
      <TaskWorkspace open={workspaceOpen} onClose={() => setWorkspaceOpen(false)} taskId={workspaceTaskId} onRefresh={loadInstances} />

      {/* ═══ CREATE TASK WIZARD ═══ */}
      <Drawer title="Create Task" open={wizardOpen} onClose={() => setWizardOpen(false)} width={600} destroyOnHidden
        footer={<div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button onClick={() => setWizardStep(Math.max(0, wizardStep - 1))} disabled={wizardStep === 0}>Back</Button>
          <Space>
            {wizardStep < 4 ? <Button type="primary" onClick={handleWizardNext} style={{ background: '#2563eb' }}>Next</Button> :
              <Button type="primary" onClick={handleCreateTask} loading={creating} style={{ background: '#16a34a' }}>Create</Button>}
          </Space>
        </div>}
      >
        <div style={{ marginBottom: 20 }}>
          {['Basic Info', 'Assignments', 'Performance', 'Timeline', 'Preview'].map((s, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 16, fontSize: 11, fontWeight: wizardStep === i ? 700 : 400, color: wizardStep === i ? '#2563eb' : '#94a3b8' }}>
              <span style={{ width: 20, height: 20, borderRadius: '50%', background: wizardStep >= i ? '#2563eb' : '#e5e7eb', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>{i + 1}</span>
              {s}
            </span>
          ))}
        </div>
        {wizardStep === 0 && (
          <Space direction="vertical" size={14} style={{ width: '100%' }}>
            <div><Text style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Template *</Text><Select placeholder="Select template" value={wizardData.templateId} onChange={v => { const t = templates.find(x => x.Id === v); setWizardData(d => ({ ...d, templateId: v, department: t?.Department, priority: t?.Priority, frequency: t?.Frequency, target: t?.DefaultTarget })); }} showSearch optionFilterProp="label" style={{ width: '100%' }} options={templates.map(t => ({ value: t.Id, label: `${t.TaskCode} — ${t.Name}` }))} /></div>
            <div><Text style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Task Name *</Text><Input value={wizardData.title} onChange={e => setWizardData(d => ({ ...d, title: e.target.value }))} placeholder="Enter task name" style={{ borderRadius: 8 }} /></div>
            <Row gutter={12}><Col span={12}><Text style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Department</Text><Select value={wizardData.department} onChange={v => setWizardData(d => ({ ...d, department: v }))} style={{ width: '100%' }} options={DEPARTMENTS.map(d => ({ value: d.value, label: d.label }))} /></Col><Col span={12}><Text style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Priority</Text><Select value={wizardData.priority} onChange={v => setWizardData(d => ({ ...d, priority: v }))} style={{ width: '100%' }} options={Object.entries(PRIORITIES).map(([k, v]) => ({ value: k, label: v.label }))} /></Col></Row>
          </Space>
        )}
        {wizardStep === 1 && (
          <Space direction="vertical" size={14} style={{ width: '100%' }}>
            <div><Text style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Seller</Text><Select placeholder="Select seller" value={wizardData.sellerId} onChange={v => { const s = sellers.find(x => x.Id === v); setWizardData(d => ({ ...d, sellerId: v, sellerName: s?.Name })); }} showSearch optionFilterProp="label" allowClear style={{ width: '100%' }} options={sellers.map(s => ({ value: s.Id, label: s.Name }))} /></div>
            <div><Text style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Brand Manager</Text><Select placeholder="Select assignee" value={wizardData.assignedTo} onChange={v => { const m = managers.find(x => x.Id === v); setWizardData(d => ({ ...d, assignedTo: v, assigneeName: m?.FullName })); }} showSearch optionFilterProp="label" allowClear style={{ width: '100%' }} options={managers.map(m => ({ value: m.Id, label: m.FullName }))} /></div>
            <div><Text style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Reviewer</Text><Select placeholder="Select reviewer" value={wizardData.reviewerId} onChange={v => { const r = reviewers.find(x => x.Id === v); setWizardData(d => ({ ...d, reviewerId: v, reviewerName: r?.FullName })); }} showSearch optionFilterProp="label" allowClear style={{ width: '100%' }} options={reviewers.map(r => ({ value: r.Id, label: r.FullName }))} /></div>
          </Space>
        )}
        {wizardStep === 2 && (
          <Space direction="vertical" size={14} style={{ width: '100%' }}>
            <div><Text style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Target</Text><Input value={wizardData.target} onChange={e => setWizardData(d => ({ ...d, target: Number(e.target.value) }))} placeholder="Enter numeric target" style={{ borderRadius: 8 }} /></div>
            <div><Text style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Frequency</Text><Select value={wizardData.frequency} onChange={v => setWizardData(d => ({ ...d, frequency: v }))} style={{ width: '100%' }} options={FREQUENCIES.map(f => ({ value: f.value, label: f.label }))} /></div>
          </Space>
        )}
        {wizardStep === 3 && (
          <Space direction="vertical" size={14} style={{ width: '100%' }}>
            <div><Text style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Due Date</Text><DatePicker value={wizardData.dueDate} onChange={v => setWizardData(d => ({ ...d, dueDate: v }))} style={{ width: '100%' }} /></div>
          </Space>
        )}
        {wizardStep === 4 && (
          <Card size="small" style={{ borderRadius: 8 }}><Descriptions size="small" column={2} bordered>
            <Descriptions.Item label="Template" span={2}>{templates.find(t => t.Id === wizardData.templateId)?.Name || '-'}</Descriptions.Item>
            <Descriptions.Item label="Name" span={2}>{wizardData.title || '-'}</Descriptions.Item>
            <Descriptions.Item label="Department">{wizardData.department || '-'}</Descriptions.Item>
            <Descriptions.Item label="Seller">{wizardData.sellerName || '-'}</Descriptions.Item>
            <Descriptions.Item label="Brand Manager">{wizardData.assigneeName || '-'}</Descriptions.Item>
            <Descriptions.Item label="Reviewer">{wizardData.reviewerName || '-'}</Descriptions.Item>
            <Descriptions.Item label="Priority">{wizardData.priority || '-'}</Descriptions.Item>
            <Descriptions.Item label="Target">{wizardData.target || 0}</Descriptions.Item>
            <Descriptions.Item label="Due Date">{wizardData.dueDate ? dayjs(wizardData.dueDate).format('DD MMM YYYY') : '-'}</Descriptions.Item>
          </Descriptions></Card>
        )}
      </Drawer>
    </div>
  );
}
