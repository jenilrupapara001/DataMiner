import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Button, Input, Tag, Space, Typography, Progress, Empty, App, Spin, Checkbox, Badge, Tooltip } from 'antd';
import {
  ReloadOutlined, SearchOutlined, CheckCircleOutlined, CloseCircleOutlined, ThunderboltOutlined,
  EyeOutlined, WarningOutlined, ClockCircleOutlined, SafetyCertificateOutlined, CalendarOutlined,
  AuditOutlined, DownloadOutlined, RightOutlined, DownOutlined, MinusOutlined
} from '@ant-design/icons';
import pemsApi from '../services/pemsApi';
import { WORKFLOW_STATUSES, SLA_STATUSES, PRIORITIES, DEPARTMENTS } from '../constants';
import { calculateHealth, getDueDateLabel, isOverdue } from '../utils/taskHealth';
import { hasPermission } from '../utils/rbac';
import { useAuth } from '../../../contexts/AuthContext';
import { ReviewExecutiveKpis } from '../components/ReviewExecutiveKpis';
import ReviewWorkspace from '../components/ReviewWorkspace';
import { exportReviewQueueToExcel } from '../utils/exportUtils';
import dayjs from 'dayjs';

const { Text } = Typography;

export default function ReviewQueuePage() {
  const { message } = App.useApp();
  const { user: currentUser } = useAuth();
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0 });
  const [quickView, setQuickView] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [expandedRows, setExpandedRows] = useState(new Set());

  // Review workspace
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [workspaceTaskId, setWorkspaceTaskId] = useState(null);

  // KPI data
  const [kpiData, setKpiData] = useState({});

  const loadInstances = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: pagination.page, limit: pagination.limit };
      if (search) params.search = search;
      if (quickView === 'CRITICAL') params.priority = 'CRITICAL';
      else if (quickView === 'HIGH_PRIORITY') params.priority = 'HIGH';
      else if (quickView !== 'OVERDUE') { params.status = 'UNDER_REVIEW'; }

      const [instRes, sumRes] = await Promise.all([
        pemsApi.getInstances(params),
        pemsApi.getDashboardSummary(),
      ]);

      if (instRes.success) {
        let data = instRes.instances || [];
        if (quickView === 'OVERDUE') data = data.filter(t => isOverdue(t));
        setInstances(data);
        setPagination(instRes.pagination);
      }

      if (sumRes.success) {
        const kpi = sumRes.data?.kpi || {};
        const risk = sumRes.data?.risk || {};
        const now = new Date();
        setKpiData({
          pending: kpi.pendingReview || 0,
          critical: data?.filter(t => t.Priority === 'CRITICAL').length || 0,
          overdue: risk.overdue || 0,
          slaCompliance: kpi.slaCompliance || 100,
          today: data?.filter(t => t.DueDate && dayjs(t.DueDate).isSame(dayjs(), 'day') && !['APPROVED', 'CANCELLED'].includes(t.Status)).length || 0,
          pendingTrend: 12, reviewTimeTrend: -8, slaTrend: 2, reworkTrend: -15,
        });
      }
    } catch (err) { message.error('Failed to load review queue'); }
    finally { setLoading(false); }
  }, [quickView, search, pagination.page, pagination.limit]);

  useEffect(() => { loadInstances(); }, [quickView, pagination.page]);

  const openWorkspace = (task) => { setWorkspaceTaskId(task.Id); setWorkspaceOpen(true); };

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0 || !hasPermission(currentUser, 'review.approve')) return;
    try {
      for (const id of selectedIds) {
        await pemsApi.submitReview({ taskInstanceId: id, decision: 'APPROVE', feedback: 'Bulk approved' });
        await pemsApi.transitionStatus(id, 'APPROVED', 'Bulk approved');
      }
      message.success(`Approved ${selectedIds.size} tasks`);
      setSelectedIds(new Set()); loadInstances();
    } catch (err) { message.error('Bulk approve failed'); }
  };

  const toggleSelect = (id) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSelectAll = () => selectedIds.size === instances.length ? setSelectedIds(new Set()) : setSelectedIds(new Set(instances.map(i => i.Id)));
  const toggleExpand = (id, e) => {
    e.stopPropagation();
    setExpandedRows(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const quickViews = [
    { key: 'ALL', label: 'All', icon: <EyeOutlined /> },
    { key: 'CRITICAL', label: 'Critical', icon: <WarningOutlined /> },
    { key: 'OVERDUE', label: 'Overdue', icon: <ClockCircleOutlined /> },
    { key: 'HIGH_PRIORITY', label: 'High Priority', icon: <ThunderboltOutlined /> },
    { key: 'MY_REVIEWS', label: 'My Reviews', icon: <CheckCircleOutlined /> },
  ];

  const columns = [
    { title: <Checkbox checked={selectedIds.size === instances.length && instances.length > 0} onChange={toggleSelectAll} />, key: 'select', width: 40, align: 'center',
      render: (_, r) => <Checkbox checked={selectedIds.has(r.Id)} onChange={(e) => { e.stopPropagation(); toggleSelect(r.Id); }} /> },
    { title: 'Task', key: 'task', render: (_, r) => (
      <Space>
        <Button type="text" size="small" icon={expandedRows.has(r.Id) ? <DownOutlined /> : <RightOutlined />} onClick={(e) => toggleExpand(r.Id, e)} style={{ color: '#94a3b8' }} />
        <div>
          <Text strong style={{ fontSize: 13, color: '#2563eb', cursor: 'pointer' }} onClick={() => openWorkspace(r)}>{r.Title || 'Untitled'}</Text>
          <Text style={{ fontSize: 10, color: '#94a3b8', display: 'block' }}>{r.InstanceCode}</Text>
        </div>
      </Space>
    )},
    { title: 'Seller', dataIndex: 'SellerName', width: 100, render: (v) => <Text style={{ fontSize: 11 }}>{v || '-'}</Text> },
    { title: 'Category', dataIndex: 'Department', width: 90, render: (d) => <Tag style={{ fontSize: 9, borderRadius: 8, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>{d || '-'}</Tag> },
    { title: 'Priority', dataIndex: 'Priority', width: 70, render: (p) => {
      const c = PRIORITIES[p] || {};
      return p ? <Tag style={{ fontSize: 9, borderRadius: 8, background: c.bg, color: c.color, border: `1px solid ${c.color}25`, fontWeight: 600 }}>{p}</Tag> : '-';
    }},
    { title: 'Submitted By', dataIndex: 'AssigneeName', width: 100, render: (v) => v ? (
      <Space size={4}>
        <div style={{ width: 20, height: 20, borderRadius: 5, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb', fontSize: 9, fontWeight: 700 }}>{v?.charAt(0)}</div>
        <Text style={{ fontSize: 11 }}>{v.split(' ')[0]}</Text>
      </Space>
    ) : <Text style={{ fontSize: 11, color: '#d1d5db' }}>-</Text> },
    { title: 'Review Age', key: 'age', width: 80, render: (_, r) => {
      if (!r.SubmittedAt) return <Text style={{ fontSize: 10, color: '#d1d5db' }}>-</Text>;
      const hours = Math.floor(dayjs().diff(dayjs(r.SubmittedAt), 'hour'));
      const color = hours > 48 ? '#dc2626' : hours > 24 ? '#f59e0b' : '#64748b';
      const text = hours < 1 ? `${Math.floor(dayjs().diff(dayjs(r.SubmittedAt), 'minute'))}m` : hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
      return <Text style={{ fontSize: 11, fontWeight: 600, color }}>{text}</Text>;
    }},
    { title: 'Evidence', key: 'evidence', width: 80, align: 'center', render: (_, r) => {
      const count = r.evidence?.length || 0;
      return count > 0 ? <Badge count={count} style={{ backgroundColor: '#2563eb', fontSize: 9 }} /> : <Text style={{ fontSize: 10, color: '#d1d5db' }}>0</Text>;
    }},
    { title: 'Due', dataIndex: 'DueDate', width: 80, render: (d, r) => {
      const dd = getDueDateLabel(r);
      return dd ? <Text style={{ fontSize: 10, fontWeight: 600, color: dd.color }}>{dd.text}</Text> : <Text style={{ fontSize: 10, color: '#94a3b8' }}>-</Text>;
    }},
    { title: 'SLA', dataIndex: 'SLAStatus', width: 80, render: (s) => <Tag style={{ fontSize: 8, borderRadius: 6, background: SLA_STATUSES[s]?.bg || '#f1f5f9', color: SLA_STATUSES[s]?.color || '#64748b', border: 'none' }}>{s?.replace(/_/g, ' ')}</Tag> },
    { title: '', key: 'actions', width: 40, align: 'center',
      render: (_, r) => <Button type="text" icon={<EyeOutlined />} size="small" onClick={(e) => { e.stopPropagation(); openWorkspace(r); }} style={{ color: '#2563eb' }} /> },
  ];

  // Expandable row content
  const expandedRowRender = (record) => {
    const health = calculateHealth(record);
    const dueLabel = getDueDateLabel(record);
    const subTasks = record.subtasks || [];

    return (
      <div style={{ padding: '12px 20px', background: '#f8fafc', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        {/* Task Info */}
        <div>
          <Text style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>Task Info</Text>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            {[
              { label: 'Seller', value: record.SellerName || '-' },
              { label: 'Reviewer', value: record.ReviewerName || '-' },
              { label: 'Achievement', value: `${record.AchievementPct || 0}%` },
              { label: 'Due', value: dueLabel?.text || '-', color: dueLabel?.color },
            ].map(item => (
              <div key={item.label} style={{ padding: '4px 6px', background: '#fff', borderRadius: 4, border: '1px solid #f1f5f9' }}>
                <Text style={{ fontSize: 8, color: '#94a3b8', fontWeight: 600 }}>{item.label}</Text>
                <Text style={{ fontSize: 10, fontWeight: 600, color: item.color || '#334155', display: 'block' }}>{item.value}</Text>
              </div>
            ))}
          </div>
        </div>

        {/* Evidence */}
        <div>
          <Text style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>Evidence ({record.evidence?.length || 0})</Text>
          {(record.evidence || []).slice(0, 3).map(ev => (
            <div key={ev.Id} style={{ padding: '4px 6px', background: '#fff', borderRadius: 4, border: '1px solid #f1f5f9', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileTextOutlined style={{ fontSize: 11, color: '#2563eb' }} />
              <Text style={{ fontSize: 10 }}>{ev.FileName}</Text>
            </div>
          ))}
          {(!record.evidence || record.evidence.length === 0) && <Text style={{ fontSize: 10, color: '#94a3b8' }}>No evidence</Text>}
        </div>

        {/* Subtasks */}
        <div>
          <Text style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>Sub Tasks</Text>
          {(record.subtasks || []).slice(0, 4).map(st => {
            const done = st.activities?.filter(a => a.IsCompleted).length || 0;
            const total = st.activities?.length || 0;
            return (
              <div key={st.Id} style={{ padding: '4px 6px', background: '#fff', borderRadius: 4, border: '1px solid #f1f5f9', marginBottom: 3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 10, color: '#334155' }}>{st.Title}</Text>
                  {st.IsCompleted ? <CheckCircleOutlined style={{ color: '#16a34a', fontSize: 10 }} /> : <ClockCircleOutlined style={{ color: '#94a3b8', fontSize: 10 }} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '12px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Text strong style={{ fontSize: 18 }}>Review Queue</Text>
            <Text style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginTop: 2 }}>Pending Reviews: <Text strong style={{ color: '#7c3aed' }}>{kpiData.pending || 0}</Text></Text>
          </div>
          <Space>
            {selectedIds.size > 0 && (
              <Space>
                <Text style={{ fontSize: 11, fontWeight: 600, color: '#2563eb' }}>{selectedIds.size} selected</Text>
                {hasPermission(currentUser, 'review.approve') && (
                  <Button size="small" icon={<CheckCircleOutlined />} onClick={handleBulkApprove} style={{ borderRadius: 6, background: '#16a34a', color: '#fff', borderColor: '#16a34a' }}>Bulk Approve</Button>
                )}
                <Button size="small" onClick={() => setSelectedIds(new Set())}>Clear</Button>
              </Space>
            )}
            <Button icon={<ReloadOutlined />} onClick={loadInstances} loading={loading} size="small" style={{ borderRadius: 8 }}>Refresh</Button>
            <Button icon={<DownloadOutlined />} size="small" style={{ borderRadius: 8 }} onClick={() => { exportReviewQueueToExcel(instances); message.success('Exported review queue to Excel'); }}>Export</Button>
          </Space>
        </div>
      </div>

      <div style={{ padding: '16px 24px' }}>
        {/* Executive KPIs */}
        <ReviewExecutiveKpis data={kpiData} loading={loading} />

        {/* Quick Views */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 12, overflowX: 'auto', paddingBottom: 2 }}>
          {quickViews.map(qv => (
            <div key={qv.key} onClick={() => { setQuickView(qv.key); setPagination(p => ({ ...p, page: 1 })); }}
              style={{ padding: '5px 14px', borderRadius: 20, fontSize: 11, fontWeight: quickView === qv.key ? 700 : 500,
                background: quickView === qv.key ? '#7c3aed' : '#fff', color: quickView === qv.key ? '#fff' : '#475569',
                border: `1px solid ${quickView === qv.key ? '#7c3aed' : '#e5e7eb'}`,
                cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
              {qv.icon} {qv.label}
            </div>
          ))}
          <div style={{ flex: 1 }} />
          <Input prefix={<SearchOutlined />} placeholder="Search tasks, sellers..." value={search} onChange={e => setSearch(e.target.value)}
            onPressEnter={() => loadInstances()} style={{ width: 240, borderRadius: 8 }} size="small" />
        </div>

        {/* Table */}
        <Card size="small" style={{ borderRadius: 10 }} styles={{ body: { padding: 0 } }}>
          <Table
            dataSource={instances} columns={columns} rowKey="Id" loading={loading} size="small"
            expandable={{
              expandedRowRender,
              expandedRowKeys: Array.from(expandedRows),
              onExpand: (expanded, record) => toggleExpand(record.Id, { stopPropagation: () => {} }),
              expandIcon: () => null,
            }}
            pagination={{
              current: pagination.page, pageSize: pagination.limit, total: pagination.total,
              showSizeChanger: true, pageSizeOptions: ['10', '25', '50'],
              onChange: (page, size) => setPagination(p => ({ ...p, page, limit: size })),
              showTotal: (t) => <Text type="secondary" style={{ fontSize: 11 }}>{t} reviews</Text>,
            }}
            onRow={(r) => ({ onClick: () => openWorkspace(r), style: { cursor: 'pointer' } })}
          />
        </Card>
      </div>

      {/* Review Workspace */}
      <ReviewWorkspace open={workspaceOpen} onClose={() => setWorkspaceOpen(false)} taskId={workspaceTaskId} onRefresh={loadInstances} />
    </div>
  );
}
