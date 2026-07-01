import React, { useState, useEffect, useCallback } from 'react';
import { Drawer, Typography, Space, Tag, Button, Descriptions, Row, Col, Progress, Card, Timeline, Input, Badge, Spin, Rate, Empty, Tabs, Tooltip, Avatar, Divider, Switch, InputNumber, Modal } from 'antd';
import {
  CheckCircleOutlined, ClockCircleOutlined, EyeOutlined, ArrowRightOutlined,
  FileTextOutlined, UploadOutlined, CommentOutlined, EditOutlined,
  SendOutlined, ReloadOutlined, AimOutlined, TrophyOutlined, RiseOutlined,
  PlayCircleOutlined, PauseCircleOutlined, InfoCircleOutlined, UserOutlined,
  CalendarOutlined, SafetyCertificateOutlined, ThunderboltOutlined,
  CheckSquareOutlined, CloseCircleOutlined, MinusOutlined
} from '@ant-design/icons';
import pemsApi from '../services/pemsApi';
import { WORKFLOW_STATUSES, VALID_TRANSITIONS, SLA_STATUSES, FREQUENCIES, PRIORITIES } from '../constants';
import { calculateHealth, getDueDateLabel } from '../utils/taskHealth';
import { useAuth } from '../../../contexts/AuthContext';
import dayjs from 'dayjs';

const { Text } = Typography;

const STATUS_COLORS = {
  DRAFT: '#64748b', ASSIGNED: '#2563eb', ACCEPTED: '#9333ea', IN_PROGRESS: '#2563eb',
  SUBMITTED: '#f59e0b', UNDER_REVIEW: '#9333ea', APPROVED: '#16a34a',
  REJECTED: '#dc2626', REWORK: '#f59e0b', CANCELLED: '#94a3b8',
};

function SectionHeader({ title, icon: Icon, count, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
      <Space size={6}>
        {Icon && <Icon size={14} style={{ color: '#64748b' }} />}
        <Text style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>{title}</Text>
        {count !== undefined && <Badge count={count} size="small" style={{ backgroundColor: '#e2e8f0', color: '#64748b' }} />}
      </Space>
      {action}
    </div>
  );
}

function MetricCard({ label, value, color, subtext }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: 10, background: `${color}08`, border: `1px solid ${color}18`, flex: '1 1 0', minWidth: 100 }}>
      <Text style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block' }}>{label}</Text>
      <div style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1.2, marginTop: 2 }}>{value}</div>
      {subtext && <Text style={{ fontSize: 9, color: '#94a3b8' }}>{subtext}</Text>}
    </div>
  );
}

export default function TaskWorkspace({ open, onClose, taskId, onRefresh }) {
  const { user: currentUser } = useAuth();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [transModal, setTransModal] = useState({ toStatus: null, remarks: '' });

  // Review modal
  const [reviewDecision, setReviewDecision] = useState(null);
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [reviewScore, setReviewScore] = useState(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // Comment
  const [newComment, setNewComment] = useState('');

  const loadTask = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const res = await pemsApi.getInstanceById(taskId);
      if (res.success) setTask(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [taskId]);

  useEffect(() => { loadTask(); }, [loadTask]);

  const handleTransition = async (toStatus, remarks = '') => {
    if (toStatus === 'SUBMITTED' && !remarks.trim()) return false;
    try {
      await pemsApi.transitionStatus(taskId, toStatus, remarks);
      await loadTask();
      if (onRefresh) onRefresh();
      return true;
    } catch (err) { console.error(err); return false; }
  };

  const handleCompleteActivity = async (actId) => {
    try { await pemsApi.completeActivity(actId); await loadTask(); if (onRefresh) onRefresh(); } catch (err) { console.error(err); }
  };

  const handleCompleteSubTask = async (stId) => {
    try { await pemsApi.completeSubTask(stId); await loadTask(); if (onRefresh) onRefresh(); } catch (err) { console.error(err); }
  };

  const handleReview = async () => {
    if (!reviewFeedback.trim()) return;
    setReviewSubmitting(true);
    try {
      await pemsApi.submitReview({ taskInstanceId: taskId, decision: reviewDecision, feedback: reviewFeedback, qualityScore: reviewScore });
      await handleTransition(reviewDecision === 'APPROVE' ? 'APPROVED' : 'REJECTED', reviewFeedback);
      setReviewDecision(null); setReviewFeedback(''); setReviewScore(null);
      if (onRefresh) onRefresh();
    } catch (err) { console.error(err); }
    finally { setReviewSubmitting(false); }
  };

  if (!task && !loading) return null;

  const health = task ? calculateHealth(task) : { score: 0, label: 'Unknown', color: '#94a3b8' };
  const dueLabel = task ? getDueDateLabel(task) : null;
  const nextStatuses = task ? (VALID_TRANSITIONS[task.Status] || []) : [];
  const subTasks = task?.subTasks || [];
  const totalActivities = subTasks.reduce((s, st) => s + (st.activities?.length || 0), 0);
  const completedActivities = subTasks.reduce((s, st) => s + (st.activities?.filter(a => a.IsCompleted).length || 0), 0);

  const tabItems = [
    {
      key: 'overview',
      label: <Space size={4}><InfoCircleOutlined style={{ fontSize: 12 }} /><span>Overview</span></Space>,
      children: task && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* KPI Cards */}
          <SectionHeader title="Performance Metrics" icon={AimOutlined} />
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <MetricCard label="Target" value={task.Target || 0} color="#2563eb" />
            <MetricCard label="Achievement" value={task.Achievement || 0} color="#16a34a" />
            <MetricCard label="Achievement %" value={`${task.AchievementPct || 0}%`} color={task.AchievementPct >= 80 ? '#16a34a' : '#f59e0b'} />
            <MetricCard label="Variance" value={`${(task.Variance || 0) >= 0 ? '+' : ''}${task.Variance || 0}`} color={(task.Variance || 0) >= 0 ? '#16a34a' : '#dc2626'} />
            <MetricCard label="Progress" value={`${task.WeightedProgressPct || task.ProgressPct || 0}%`} color="#9333ea" />
          </div>

          {/* Task Info Grid */}
          <SectionHeader title="Task Details" icon={EditOutlined} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {[
              { label: 'Seller', value: task.SellerName || '-' },
              { label: 'Department', value: task.Department || '-', tag: true, tagColor: '#eff6ff', tagText: '#1d4ed8' },
              { label: 'Brand Manager', value: task.AssigneeName || '-' },
              { label: 'Reviewer', value: task.ReviewerName || '-' },
              { label: 'Priority', value: task.Priority, tag: true, tagColor: PRIORITIES[task.Priority]?.bg || '#f1f5f9', tagText: PRIORITIES[task.Priority]?.color || '#475569' },
              { label: 'Frequency', value: FREQUENCIES.find(f => f.value === task.Frequency)?.label || task.Frequency },
              { label: 'SLA', value: `${task.SLAHours}h` },
              { label: 'TAT', value: `${task.TATHours || '-'}h` },
              { label: 'Due Date', value: task.DueDate ? dayjs(task.DueDate).format('DD MMM YYYY') : '-', color: dueLabel?.color },
              { label: 'Created', value: task.CreatedAt ? dayjs(task.CreatedAt).format('DD MMM YYYY [at] h:mm A') : '-' },
              { label: 'Started', value: task.StartedAt ? dayjs(task.StartedAt).format('DD MMM YYYY [at] h:mm A') : '-', color: task.StartedAt ? '#2563eb' : undefined },
              { label: 'Submitted', value: task.SubmittedAt ? dayjs(task.SubmittedAt).format('DD MMM YYYY [at] h:mm A') : '-', color: task.SubmittedAt ? '#f59e0b' : undefined },
              { label: 'Reviewed', value: task.ReviewedAt ? dayjs(task.ReviewedAt).format('DD MMM YYYY [at] h:mm A') : '-' },
              { label: 'Completed', value: task.CompletedAt ? dayjs(task.CompletedAt).format('DD MMM YYYY [at] h:mm A') : '-', color: task.CompletedAt ? '#16a34a' : undefined },
            ].map(item => (
              <div key={item.label} style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                <Text style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.03em', fontWeight: 600, display: 'block', marginBottom: 2 }}>{item.label}</Text>
                {item.tag ? (
                  <Tag style={{ fontSize: 11, borderRadius: 6, background: item.tagColor, color: item.tagText, border: 'none' }}>{item.value || '-'}</Tag>
                ) : (
                  <Text strong style={{ fontSize: 13, color: item.color || '#0f172a' }}>{item.value || '-'}</Text>
                )}
              </div>
            ))}
          </div>

          {/* Sub Tasks Summary */}
          <SectionHeader title="Sub Tasks" icon={CheckSquareOutlined} count={subTasks.length} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {subTasks.map(st => {
              const done = st.activities?.filter(a => a.IsCompleted).length || 0;
              const total = st.activities?.length || 0;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              return (
                <div key={st.Id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, border: st.IsCompleted ? '1px solid #bbf7d0' : '1px solid #e5e7eb', background: st.IsCompleted ? '#f0fdf4' : '#fff' }}>
                  {st.IsCompleted ? <CheckCircleOutlined style={{ color: '#16a34a' }} /> : <ClockCircleOutlined style={{ color: '#94a3b8' }} />}
                  <Text style={{ fontSize: 12, fontWeight: 500, flex: 1 }}>{st.Title}</Text>
                  <Progress percent={pct} size="small" style={{ width: 60, margin: 0 }} />
                  <Text style={{ fontSize: 10, color: '#94a3b8' }}>{done}/{total}</Text>
                </div>
              );
            })}
          </div>
        </div>
      ),
    },
    {
      key: 'sop',
      label: <Space size={4}><CheckSquareOutlined style={{ fontSize: 12 }} /><span>SOP</span></Space>,
      children: task && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SectionHeader title={`SOP Execution — ${completedActivities}/${totalActivities} steps`} icon={ThunderboltOutlined} />
          {subTasks.length === 0 ? <Empty description="No SOP defined for this task" /> : subTasks.map((st, stIdx) => {
            const done = st.activities?.filter(a => a.IsCompleted).length || 0;
            const total = st.activities?.length || 0;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            return (
              <div key={st.Id} style={{ borderRadius: 10, border: st.IsCompleted ? '2px solid #16a34a' : '1px solid #e5e7eb', overflow: 'hidden' }}>
                {/* Stage Header */}
                <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: st.IsCompleted ? '#f0fdf4' : '#fafbfc', borderBottom: total > 0 ? '1px solid #f1f5f9' : 'none', cursor: !st.IsCompleted && done === total && total > 0 ? 'pointer' : 'default' }}
                  onClick={() => !st.IsCompleted && done === total && total > 0 && handleCompleteSubTask(st.Id)}>
                  <Space size={10}>
                    {st.IsCompleted ? <CheckCircleOutlined style={{ color: '#16a34a', fontSize: 18 }} /> : (
                      <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${done === total && total > 0 ? '#16a34a' : '#d1d5db'}`, background: done === total && total > 0 ? '#dcfce7' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {done === total && total > 0 && <CheckCircleOutlined style={{ color: '#16a34a', fontSize: 14 }} />}
                      </div>
                    )}
                    <div>
                      <Text strong style={{ fontSize: 13 }}>Phase {stIdx + 1}: {st.Title}</Text>
                      {st.ExpectedOutput && <Text style={{ fontSize: 10, color: '#94a3b8', display: 'block' }}>Expected: {st.ExpectedOutput}</Text>}
                    </div>
                  </Space>
                  <Space size={12}>
                    <Progress percent={pct} size="small" strokeColor={pct === 100 ? '#16a34a' : '#2563eb'} style={{ width: 80, margin: 0 }} />
                    <Text style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>{done}/{total}</Text>
                  </Space>
                </div>
                {/* Activities */}
                {st.activities?.length > 0 && (
                  <div style={{ padding: '4px 0' }}>
                    {st.activities.map((act, actIdx) => (
                      <div key={act.Id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 16px', borderBottom: actIdx < st.activities.length - 1 ? '1px solid #f1f5f9' : 'none', background: act.IsCompleted ? '#fafff5' : '#fff', cursor: act.IsCompleted ? 'default' : 'pointer' }}
                        onClick={() => !act.IsCompleted && handleCompleteActivity(act.Id)}>
                        {act.IsCompleted ? <CheckCircleOutlined style={{ color: '#16a34a', fontSize: 16, marginTop: 2 }} /> : <div style={{ width: 16, height: 16, borderRadius: 4, border: '2px solid #d1d5db', marginTop: 2, flexShrink: 0 }} />}
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Tag style={{ fontSize: 8, fontWeight: 700, fontFamily: 'monospace', background: '#eef2ff', color: '#2563eb', borderRadius: 4, margin: 0 }}>Step {act.StepNo}</Tag>
                            <Text strong style={{ fontSize: 12, textDecoration: act.IsCompleted ? 'line-through' : 'none', color: act.IsCompleted ? '#94a3b8' : '#0f172a' }}>{act.Title}</Text>
                          </div>
                          {act.Instructions && <Text style={{ fontSize: 11, color: '#64748b', display: 'block', marginTop: 3 }}>{act.Instructions}</Text>}
                          <Space size={6} style={{ marginTop: 4 }}>
                            {act.ExpectedOutput && <Tag style={{ fontSize: 9, borderRadius: 4, background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}>Output: {act.ExpectedOutput}</Tag>}
                            {act.ValidationRules && <Tag style={{ fontSize: 9, borderRadius: 4, background: '#fff7ed', color: '#E65100', border: '1px solid #fed7aa' }}>Validation: {act.ValidationRules}</Tag>}
                            {act.estimatedMinutes && <Tag style={{ fontSize: 9, borderRadius: 4, background: '#f8fafc', color: '#64748b' }}>{act.estimatedMinutes}m</Tag>}
                          </Space>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ),
    },
    {
      key: 'evidence',
      label: <Space size={4}><FileTextOutlined style={{ fontSize: 12 }} /><span>Evidence</span></Space>,
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SectionHeader title={`Evidence (${task?.evidence?.length || 0})`} icon={FileTextOutlined} />
          {!task?.evidence?.length ? <Empty description="No evidence uploaded yet" /> : task.evidence.map(ev => (
            <div key={ev.Id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff' }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileTextOutlined style={{ color: '#2563eb' }} />
              </div>
              <div style={{ flex: 1 }}>
                <Text strong style={{ fontSize: 12 }}>{ev.FileName}</Text>
                <Text style={{ fontSize: 10, color: '#94a3b8', display: 'block' }}>{ev.UploadedByName} · {dayjs(ev.UploadedAt).format('DD MMM YYYY [at] h:mm A')}</Text>
              </div>
              {ev.Remarks && <Text style={{ fontSize: 11, color: '#64748b', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.Remarks}</Text>}
            </div>
          ))}
        </div>
      ),
    },
    {
      key: 'comments',
      label: <Space size={4}><CommentOutlined style={{ fontSize: 12 }} /><span>Comments</span></Space>,
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SectionHeader title="Discussion" icon={CommentOutlined} />
          <div style={{ padding: '12px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#f8fafc' }}>
            <Input.TextArea rows={2} value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Add a comment... (@mention, attach files)" style={{ borderRadius: 8, background: '#fff' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <Button type="primary" size="small" icon={<SendOutlined />} disabled={!newComment.trim()} style={{ borderRadius: 6, background: '#2563eb' }}>Comment</Button>
            </div>
          </div>
          <div style={{ padding: '20px 0', textAlign: 'center' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Comments will appear here as team members collaborate.</Text>
          </div>
        </div>
      ),
    },
    {
      key: 'activity',
      label: <Space size={4}><ClockCircleOutlined style={{ fontSize: 12 }} /><span>Activity</span></Space>,
      children: task && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <SectionHeader title="Audit Timeline" icon={ClockCircleOutlined} count={task.auditLogs?.length} />
          {!task.auditLogs?.length ? <Empty description="No activity recorded" /> : task.auditLogs.map((log, i) => {
            const colors = { CREATED: '#2563eb', STATUS_CHANGED: '#16a34a', SUBTASK_COMPLETED: '#16a34a', EVIDENCE_UPLOADED: '#9333ea' };
            return (
              <div key={log.Id} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: i < task.auditLogs.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: colors[log.Action] || '#94a3b8', marginTop: 4, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>{log.Action.replace(/_/g, ' ')}</Text>
                    <Text style={{ fontSize: 10, color: '#94a3b8' }}>{dayjs(log.CreatedAt).format('DD MMM YYYY [at] h:mm A')}</Text>
                  </div>
                  <Text style={{ fontSize: 11, color: '#64748b' }}>{log.ActorName || 'System'}</Text>
                  {log.Details && <Text style={{ fontSize: 11, color: '#475569', display: 'block', marginTop: 2, padding: '6px 10px', background: '#f8fafc', borderRadius: 6 }}>{log.Details}</Text>}
                </div>
              </div>
            );
          })}
        </div>
      ),
    },
  ];

  return (
    <Drawer
      title={null}
      open={open}
      onClose={onClose}
      width="75vw"
      destroyOnHidden
      styles={{
        body: { padding: 0, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' },
        header: { display: 'none' },
      }}
    >
      {loading || !task ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><Spin size="large" /></div>
      ) : (
        <div style={{ display: 'flex', height: '100%' }}>
          {/* ═══ MAIN CONTENT ═══ */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
            {/* STICKY HEADER */}
            <div style={{ padding: '12px 24px', borderBottom: '1px solid #e5e7eb', background: '#fff', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              <Button type="text" onClick={onClose} style={{ fontSize: 18, color: '#64748b' }}>✕</Button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Text code style={{ fontSize: 11 }}>{task.InstanceCode}</Text>
                  <Tag style={{ fontSize: 9, borderRadius: 10, fontWeight: 600, background: STATUS_COLORS[task.Status] + '15', color: STATUS_COLORS[task.Status], border: `1px solid ${STATUS_COLORS[task.Status]}30` }}>{task.Status}</Tag>
                  <Tag style={{ fontSize: 9, borderRadius: 6, background: PRIORITIES[task.Priority]?.bg || '#f1f5f9', color: PRIORITIES[task.Priority]?.color || '#475569' }}>{task.Priority}</Tag>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: health.color }} title={`Health: ${health.score}/100`} />
                </div>
                <Text strong style={{ fontSize: 15, color: '#0f172a', display: 'block', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.Title || task.TemplateName}</Text>
              </div>
              {/* ACTION BUTTONS */}
              <Space>
                {nextStatuses.map(s => {
                  const isSubmit = s === 'SUBMITTED';
                  const isApprove = s === 'APPROVED';
                  const isReject = s === 'REJECTED';
                  if (isApprove) return <Button key={s} size="small" type="primary" icon={<CheckCircleOutlined />} style={{ borderRadius: 6, background: '#16a34a', borderColor: '#16a34a' }} onClick={() => setReviewDecision('APPROVE')}>Approve</Button>;
                  if (isReject) return <Button key={s} size="small" danger icon={<CloseCircleOutlined />} style={{ borderRadius: 6 }} onClick={() => setReviewDecision('REJECT')}>Reject</Button>;
                  return <Button key={s} size="small" type={isSubmit ? 'primary' : 'default'} icon={<ArrowRightOutlined />} style={{ borderRadius: 6, ...(isSubmit ? { background: '#2563eb', borderColor: '#2563eb' } : {}) }} onClick={() => setTransModal({ toStatus: s, remarks: '' })}>{WORKFLOW_STATUSES[s]?.label}</Button>;
                })}
              </Space>
            </div>

            {/* TABS + CONTENT */}
            <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
              <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
            </div>
          </div>

          {/* ═══ STICKY RIGHT RAIL ═══ */}
          <div style={{ width: 240, borderLeft: '1px solid #e5e7eb', background: '#fafbfc', padding: '16px', display: 'flex', flexDirection: 'column', gap: 16, flexShrink: 0, overflow: 'auto' }}>
            {/* SLA Status */}
            <div>
              <Text style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: 6 }}>SLA Status</Text>
              <Tag style={{ fontSize: 11, borderRadius: 8, padding: '4px 10px', background: (SLA_STATUSES[task.SLAStatus]?.bg || '#f1f5f9'), color: SLA_STATUSES[task.SLAStatus]?.color || '#64748b', border: `1px solid ${SLA_STATUSES[task.SLAStatus]?.color || '#d1d5db'}30` }}>
                {task.SLAStatus?.replace(/_/g, ' ') || 'WITHIN SLA'}
              </Tag>
            </div>

            {/* Due Date */}
            <div>
              <Text style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: 6 }}>Due Date</Text>
              {dueLabel ? (
                <div style={{ padding: '6px 10px', borderRadius: 8, background: dueLabel.color + '10', border: `1px solid ${dueLabel.color}20` }}>
                  <Text strong style={{ fontSize: 13, color: dueLabel.color }}>{dueLabel.text}</Text>
                  {task.DueDate && <Text style={{ fontSize: 10, color: '#94a3b8', display: 'block' }}>{dayjs(task.DueDate).format('DD MMM YYYY')}</Text>}
                </div>
              ) : <Text style={{ fontSize: 12, color: '#94a3b8' }}>No due date</Text>}
            </div>

            {/* Priority */}
            <div>
              <Text style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: 6 }}>Priority</Text>
              <Tag style={{ fontSize: 11, borderRadius: 8, padding: '4px 10px', background: PRIORITIES[task.Priority]?.bg || '#f1f5f9', color: PRIORITIES[task.Priority]?.color || '#475569' }}>{task.Priority}</Tag>
            </div>

            {/* Progress */}
            <div>
              <Text style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: 6 }}>Progress</Text>
              <Progress percent={task.WeightedProgressPct || task.ProgressPct || 0} strokeColor={task.WeightedProgressPct >= 80 ? '#16a34a' : '#2563eb'} />
              <Text style={{ fontSize: 10, color: '#64748b' }}>{task.CompletedSubTasks || 0}/{task.SubTaskCount || 0} subtasks</Text>
            </div>

            {/* Health */}
            <div>
              <Text style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: 6 }}>Health</Text>
              <div style={{ padding: '8px 10px', borderRadius: 8, background: health.bgColor, border: `1px solid ${health.color}20`, display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: health.color }} />
                <Text strong style={{ fontSize: 12, color: health.color }}>{health.label} ({health.score})</Text>
              </div>
            </div>

            <Divider style={{ margin: '4px 0' }} />

            {/* Quick Actions */}
            <div>
              <Text style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: 6 }}>Quick Actions</Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {nextStatuses.map(s => (
                  <Button key={s} size="small" block style={{ borderRadius: 6, justifyContent: 'flex-start' }} icon={<ArrowRightOutlined />}
                    onClick={() => s === 'SUBMITTED' ? setTransModal({ toStatus: s, remarks: '' }) : handleTransition(s)}>
                    {WORKFLOW_STATUSES[s]?.label}
                  </Button>
                ))}
              </div>
            </div>

            <Divider style={{ margin: '4px 0' }} />

            {/* Audit Log */}
            <div>
              <Text style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: 6 }}>Recent Activity</Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(task.auditLogs || []).slice(0, 5).map(log => (
                  <div key={log.Id}>
                    <Text style={{ fontSize: 11, fontWeight: 600, color: '#334155' }}>{log.Action.replace(/_/g, ' ').toLowerCase()}</Text>
                    <Text style={{ fontSize: 10, color: '#94a3b8', display: 'block' }}>{log.ActorName || 'System'}</Text>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ SUBMIT REMARKS MODAL ═══ */}
      <Modal title="Submit for Review" open={!!transModal.toStatus} onCancel={() => setTransModal({ toStatus: null, remarks: '' })}
        onOk={async () => { const ok = await handleTransition(transModal.toStatus, transModal.remarks); if (ok) { setTransModal({ toStatus: null, remarks: '' }); if (onRefresh) onRefresh(); } }}
        okText="Submit" destroyOnHidden width={480}>
        <div style={{ padding: '4px 0' }}>
          <div style={{ padding: '8px 12px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, marginBottom: 12 }}>
            <Text style={{ fontSize: 11, color: '#92400e', fontWeight: 600 }}>Describe what work was done before submitting.</Text>
          </div>
          <Text style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Work Summary <Text type="danger">*</Text></Text>
          <Input.TextArea rows={4} value={transModal.remarks} onChange={e => setTransModal(m => ({ ...m, remarks: e.target.value }))} placeholder={"• Optimized 25 listings\n• Updated product images\n• Fixed A+ content..."} style={{ borderRadius: 8 }} />
        </div>
      </Modal>

      {/* ═══ REVIEW MODAL ═══ */}
      <Modal title={`${reviewDecision === 'APPROVE' ? 'Approve' : 'Reject'} Task`} open={!!reviewDecision} onCancel={() => { setReviewDecision(null); setReviewFeedback(''); setReviewScore(null); }}
        onOk={handleReview} confirmLoading={reviewSubmitting} destroyOnHidden width={480}
        okText={reviewDecision === 'APPROVE' ? 'Approve' : 'Reject'}
        okButtonProps={{ danger: reviewDecision === 'REJECT', style: reviewDecision === 'APPROVE' ? { background: '#16a34a', borderColor: '#16a34a' } : {} }}>
        <div style={{ padding: '4px 0' }}>
          <div>
            <Text style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Quality Score</Text>
            <Rate value={reviewScore} onChange={setReviewScore} style={{ fontSize: 16 }} />
          </div>
          <div style={{ marginTop: 12 }}>
            <Text style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
              {reviewDecision === 'APPROVE' ? 'Remarks' : 'Rejection Reason'} <Text type="danger">*</Text>
            </Text>
            <Input.TextArea rows={3} value={reviewFeedback} onChange={e => setReviewFeedback(e.target.value)} placeholder="Provide feedback..." style={{ borderRadius: 8 }} />
          </div>
        </div>
      </Modal>
    </Drawer>
  );
}
