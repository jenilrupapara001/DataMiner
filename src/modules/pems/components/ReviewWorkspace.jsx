import React, { useState, useEffect } from 'react';
import { Drawer, Typography, Space, Tag, Button, Progress, Card, Timeline, Rate, Input, Divider, Badge, Spin, Empty, Collapse, Tooltip, Avatar } from 'antd';
import {
  CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined, EyeOutlined, ArrowRightOutlined,
  FileTextOutlined, CommentOutlined, EditOutlined, SendOutlined,
  SafetyCertificateOutlined, CalendarOutlined, ThunderboltOutlined, TrophyOutlined,
  AimOutlined, UserOutlined, StarOutlined, DownloadOutlined, PlayCircleOutlined
} from '@ant-design/icons';
import pemsApi from '../services/pemsApi';
import { WORKFLOW_STATUSES, SLA_STATUSES, FREQUENCIES, PRIORITIES } from '../constants';
import { calculateHealth, getDueDateLabel } from '../utils/taskHealth';
import { hasPermission } from '../utils/rbac';
import { useAuth } from '../../../contexts/AuthContext';
import dayjs from 'dayjs';

const { Text } = Typography;

const STATUS_COLORS = {
  DRAFT: '#64748b', ASSIGNED: '#2563eb', ACCEPTED: '#9333ea', IN_PROGRESS: '#2563eb',
  SUBMITTED: '#f59e0b', UNDER_REVIEW: '#9333ea', APPROVED: '#16a34a',
  REJECTED: '#dc2626', REWORK: '#f59e0b', ESCALATED: '#dc2626', CANCELLED: '#94a3b8',
};

function ReviewInsights({ task, subTasks }) {
  const totalActs = subTasks.reduce((s, st) => s + (st.activities?.length || 0), 0);
  const doneActs = subTasks.reduce((s, st) => s + (st.activities?.filter(a => a.IsCompleted).length || 0), 0);
  const allComplete = totalActs > 0 && doneActs === totalActs;
  const hasEvidence = (task.evidence?.length || 0) > 0;
  const targetMet = task.Target > 0 && (task.AchievementPct || 0) >= 80;
  const noRework = (task.ReworkCount || 0) === 0;

  const checks = [
    { label: 'Target Met', done: targetMet, value: targetMet ? `${task.AchievementPct}%` : `${task.AchievementPct || 0}%` },
    { label: 'Evidence Attached', done: hasEvidence, value: `${task.evidence?.length || 0} files` },
    { label: 'All Steps Complete', done: allComplete, value: `${doneActs}/${totalActs}` },
    { label: 'No Rework History', done: noRework, value: noRework ? 'Clean' : `${task.ReworkCount}x rework` },
  ];

  const score = checks.filter(c => c.done).length;
  const recommendation = score >= 3 ? 'APPROVE' : score >= 2 ? 'REVIEW CAREFULLY' : 'REJECT';

  return (
    <Card size="small" title="Review Insights" style={{ borderRadius: 8, border: '1px solid #e2e8f0' }} styles={{ body: { padding: '12px 14px' } }}>
      {checks.map(c => (
        <div key={c.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
          <Space size={6}>
            {c.done ? <CheckCircleOutlined style={{ color: '#16a34a', fontSize: 14 }} /> : <CloseCircleOutlined style={{ color: '#dc2626', fontSize: 14 }} />}
            <Text style={{ fontSize: 11, color: '#334155' }}>{c.label}</Text>
          </Space>
          <Text style={{ fontSize: 11, fontWeight: 600, color: c.done ? '#16a34a' : '#64748b' }}>{c.value}</Text>
        </div>
      ))}
      <Divider style={{ margin: '8px 0' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>Recommendation</Text>
        <Tag style={{ fontSize: 11, borderRadius: 8, fontWeight: 700, background: recommendation === 'APPROVE' ? '#f0fdf4' : recommendation === 'REJECT' ? '#fef2f2' : '#fffbeb', color: recommendation === 'APPROVE' ? '#16a34a' : recommendation === 'REJECT' ? '#dc2626' : '#f59e0b', border: 'none' }}>
          {recommendation}
        </Tag>
      </div>
    </Card>
  );
}

function ReviewerAnalytics({ task }) {
  // Placeholder for reviewer performance data
  return (
    <Card size="small" title="Reviewer Performance" style={{ borderRadius: 8, border: '1px solid #e2e8f0' }} styles={{ body: { padding: '12px 14px' } }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[
          { label: 'Reviews Today', value: '18', color: '#2563eb' },
          { label: 'Avg Time', value: '11m', color: '#16a34a' },
          { label: 'Approval Rate', value: '92%', color: '#16a34a' },
          { label: 'Rework Rate', value: '3%', color: '#f59e0b' },
        ].map(item => (
          <div key={item.label} style={{ padding: '8px', background: '#f8fafc', borderRadius: 6, textAlign: 'center' }}>
            <Text style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>{item.label}</Text>
            <div style={{ fontSize: 16, fontWeight: 800, color: item.color, marginTop: 2 }}>{item.value}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function EvidenceCard({ evidence }) {
  const iconMap = {
    pdf: <FileTextOutlined style={{ color: '#dc2626', fontSize: 16 }} />,
    xlsx: <FileTextOutlined style={{ color: '#16a34a', fontSize: 16 }} />,
    xls: <FileTextOutlined style={{ color: '#16a34a', fontSize: 16 }} />,
    csv: <FileTextOutlined style={{ color: '#2563eb', fontSize: 16 }} />,
    png: <FileTextOutlined style={{ color: '#9333ea', fontSize: 16 }} />,
    jpg: <FileTextOutlined style={{ color: '#9333ea', fontSize: 16 }} />,
  };
  const ext = evidence.FileName?.split('.').pop()?.toLowerCase() || '';
  return (
    <Card size="small" style={{ borderRadius: 8, border: '1px solid #e5e7eb' }} styles={{ body: { padding: '10px 14px' } }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {iconMap[ext] || <FileTextOutlined style={{ color: '#64748b', fontSize: 16 }} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text strong style={{ fontSize: 12 }}>{evidence.FileName}</Text>
          <Text style={{ fontSize: 10, color: '#94a3b8', display: 'block' }}>Uploaded by {evidence.UploadedByName}</Text>
          <Text style={{ fontSize: 10, color: '#94a3b8' }}>{dayjs(evidence.UploadedAt).format('DD MMM YYYY [at] h:mm A')}</Text>
          {evidence.Remarks && (
            <div style={{ marginTop: 4, padding: '6px 8px', background: '#f8fafc', borderRadius: 4, border: '1px solid #f1f5f9' }}>
              <Text style={{ fontSize: 11, color: '#475569' }}>{evidence.Remarks}</Text>
            </div>
          )}
        </div>
        <Space size={4}>
          <Tooltip title="Preview"><Button type="text" size="small" icon={<EyeOutlined />} style={{ color: '#2563eb' }} /></Tooltip>
          <Tooltip title="Download"><Button type="text" size="small" icon={<DownloadOutlined />} style={{ color: '#64748b' }} /></Tooltip>
        </Space>
      </div>
    </Card>
  );
}

function CommentThread() {
  const [comments] = useState([
    { id: 1, user: 'Vrushabh Shah', role: 'Brand Manager', text: 'Please recheck campaign B — numbers seem off', time: '2h ago', avatar: 'V' },
    { id: 2, user: 'Jenil Rupapara', role: 'Reviewer', text: 'Updated with corrected data. Ready for review.', time: '1h ago', avatar: 'J' },
    { id: 3, user: 'Vrushabh Shah', role: 'Brand Manager', text: 'Approved. Great work on this batch.', time: '30m ago', avatar: 'V' },
  ]);
  const [newComment, setNewComment] = useState('');

  const roleColors = { 'Brand Manager': '#2563eb', 'Reviewer': '#16a34a', 'Admin': '#dc2626' };

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
        {comments.map(c => (
          <div key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <Avatar size={28} style={{ background: roleColors[c.role] || '#64748b', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{c.avatar}</Avatar>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <Text strong style={{ fontSize: 11 }}>{c.user}</Text>
                <Tag style={{ fontSize: 8, borderRadius: 4, padding: '0 4px', margin: 0 }}>{c.role}</Tag>
                <Text style={{ fontSize: 9, color: '#94a3b8' }}>{c.time}</Text>
              </div>
              <Text style={{ fontSize: 12, color: '#334155' }}>{c.text}</Text>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Input value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Add a comment... (@mention, attach files)" style={{ borderRadius: 8, flex: 1 }} />
        <Button type="primary" icon={<SendOutlined />} style={{ borderRadius: 8, background: '#2563eb' }} disabled={!newComment.trim()}>Send</Button>
      </div>
    </div>
  );
}

export default function ReviewWorkspace({ open, onClose, taskId, onRefresh }) {
  const { user: currentUser } = useAuth();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);

  // Structured review scoring
  const [scores, setScores] = useState({ accuracy: 0, completeness: 0, evidence: 0, compliance: 0 });
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // Escalate
  const [showEscalate, setShowEscalate] = useState(false);
  const [escalateReason, setEscalateReason] = useState('');

  const loadTask = async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const res = await pemsApi.getInstanceById(taskId);
      if (res.success) setTask(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadTask(); setScores({ accuracy: 0, completeness: 0, evidence: 0, compliance: 0 }); setReviewFeedback(''); }, [taskId]);

  const totalScore = Math.round((scores.accuracy + scores.completeness + scores.evidence + scores.compliance) / 4 * 20);

  const canApprove = hasPermission(currentUser, 'review.approve');
  const canReject = hasPermission(currentUser, 'review.reject');
  const canEscalate = hasPermission(currentUser, 'task.escalate');

  const handleApprove = async () => {
    if (!reviewFeedback.trim()) return;
    setReviewSubmitting(true);
    try {
      const feedback = `[Accuracy: ${scores.accuracy}/5 | Completeness: ${scores.completeness}/5 | Evidence: ${scores.evidence}/5 | Compliance: ${scores.compliance}/5 | Score: ${totalScore}/100]\n\n${reviewFeedback}`;
      await pemsApi.submitReview({ taskInstanceId: taskId, decision: 'APPROVE', feedback, qualityScore: totalScore });
      await pemsApi.transitionStatus(taskId, 'APPROVED', feedback);
      setReviewFeedback(''); setScores({ accuracy: 0, completeness: 0, evidence: 0, compliance: 0 });
      await loadTask(); if (onRefresh) onRefresh(); onClose();
    } catch (err) { console.error(err); }
    finally { setReviewSubmitting(false); }
  };

  const handleReject = async () => {
    if (!reviewFeedback.trim()) return;
    setReviewSubmitting(true);
    try {
      const feedback = `[Score: ${totalScore}/100]\n\n${reviewFeedback}`;
      await pemsApi.submitReview({ taskInstanceId: taskId, decision: 'REJECT', feedback, qualityScore: totalScore });
      await pemsApi.transitionStatus(taskId, 'REJECTED', feedback);
      setReviewFeedback(''); setScores({ accuracy: 0, completeness: 0, evidence: 0, compliance: 0 });
      await loadTask(); if (onRefresh) onRefresh(); onClose();
    } catch (err) { console.error(err); }
    finally { setReviewSubmitting(false); }
  };

  const handleEscalate = async () => {
    setReviewSubmitting(true);
    try {
      await pemsApi.transitionStatus(taskId, 'ESCALATED', escalateReason);
      setEscalateReason(''); setShowEscalate(false);
      await loadTask(); if (onRefresh) onRefresh();
    } catch (err) { console.error(err); }
    finally { setReviewSubmitting(false); }
  };

  const subTasks = task?.subTasks || [];
  const totalActs = subTasks.reduce((s, st) => s + (st.activities?.length || 0), 0);
  const doneActs = subTasks.reduce((s, st) => s + (st.activities?.filter(a => a.IsCompleted).length || 0), 0);
  const evidenceCount = task?.evidence?.length || 0;
  const health = task ? calculateHealth(task) : { score: 0, label: 'Unknown', color: '#94a3b8' };

  return (
    <Drawer
      open={open} onClose={onClose} width="90vw" destroyOnHidden
      styles={{ body: { padding: 0 }, header: { display: 'none' } }}
    >
      {loading || !task ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><Spin size="large" /></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'auto 1fr', height: '100%' }}>

          {/* ═══ HEADER (spans both columns) ═══ */}
          <div style={{ gridColumn: '1 / -1', padding: '12px 20px', borderBottom: '1px solid #e5e7eb', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Space size={12}>
              <Button type="text" onClick={onClose} style={{ fontSize: 16, color: '#64748b' }}>✕</Button>
              <Text code style={{ fontSize: 11 }}>{task.InstanceCode}</Text>
              <Tag style={{ fontSize: 9, borderRadius: 10, background: STATUS_COLORS[task.Status] + '15', color: STATUS_COLORS[task.Status], border: `1px solid ${STATUS_COLORS[task.Status]}30`, fontWeight: 600 }}>{task.Status}</Tag>
              <Tag style={{ fontSize: 9, borderRadius: 6, background: PRIORITIES[task.Priority]?.bg, color: PRIORITIES[task.Priority]?.color }}>{task.Priority}</Tag>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: health.color }} />
              <Text strong style={{ fontSize: 15, color: '#0f172a' }}>{task.Title || task.TemplateName}</Text>
            </Space>
            <Space>
              {canEscalate && (
                <Button icon={<ThunderboltOutlined />} size="small" onClick={() => setShowEscalate(!showEscalate)} style={{ borderRadius: 6 }}>Escalate</Button>
              )}
            </Space>
          </div>

          {/* ═══ TOP ROW: Overview + Evidence ═══ */}
          <div style={{ overflow: 'auto', padding: '16px 20px', borderRight: '1px solid #e5e7eb' }}>
            {/* Task Details */}
            <Text style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', marginBottom: 8, display: 'block' }}>Task Details</Text>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, marginBottom: 16 }}>
              {[
                { label: 'Seller', value: task.SellerName || '-' },
                { label: 'Department', value: task.Department || '-' },
                { label: 'Brand Manager', value: task.AssigneeName || '-' },
                { label: 'Reviewer', value: task.ReviewerName || '-' },
                { label: 'Frequency', value: FREQUENCIES.find(f => f.value === task.Frequency)?.label || '-' },
                { label: 'Due Date', value: task.DueDate ? dayjs(task.DueDate).format('DD MMM YYYY') : '-', color: getDueDateLabel(task)?.color },
                { label: 'SLA', value: `${task.SLAHours}h` },
                { label: 'Created', value: task.CreatedAt ? dayjs(task.CreatedAt).format('DD MMM') : '-' },
              ].map(item => (
                <div key={item.label} style={{ padding: '6px 8px', background: '#f8fafc', borderRadius: 6 }}>
                  <Text style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>{item.label}</Text>
                  <Text strong style={{ fontSize: 11, color: item.color || '#0f172a', display: 'block' }}>{item.value}</Text>
                </div>
              ))}
            </div>

            {/* Performance Metrics */}
            <Text style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', marginBottom: 8, display: 'block' }}>Performance</Text>
            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              {[
                { label: 'Target', value: task.Target || 0, color: '#2563eb' },
                { label: 'Achievement', value: task.Achievement || 0, color: '#16a34a' },
                { label: 'Achiev %', value: `${task.AchievementPct || 0}%`, color: (task.AchievementPct || 0) >= 80 ? '#16a34a' : '#f59e0b' },
                { label: 'Variance', value: `${(task.Variance || 0) >= 0 ? '+' : ''}${task.Variance || 0}`, color: (task.Variance || 0) >= 0 ? '#16a34a' : '#dc2626' },
                { label: 'Progress', value: `${task.WeightedProgressPct || task.ProgressPct || 0}%`, color: '#9333ea' },
              ].map(m => (
                <div key={m.label} style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: `${m.color}08`, border: `1px solid ${m.color}15`, textAlign: 'center' }}>
                  <Text style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>{m.label}</Text>
                  <div style={{ fontSize: 16, fontWeight: 800, color: m.color, marginTop: 1 }}>{m.value}</div>
                </div>
              ))}
            </div>

            {/* Sub Tasks */}
            <Text style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', marginBottom: 8, display: 'block' }}>Sub Tasks ({doneActs}/{totalActs})</Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
              {subTasks.map(st => {
                const stDone = st.activities?.filter(a => a.IsCompleted).length || 0;
                const stTotal = st.activities?.length || 0;
                const stPct = stTotal > 0 ? Math.round((stDone / stTotal) * 100) : 0;
                return (
                  <div key={st.Id} style={{ padding: '6px 8px', borderRadius: 6, background: st.IsCompleted ? '#f0fdf4' : '#fafbfc', border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {st.IsCompleted ? <CheckCircleOutlined style={{ color: '#16a34a', fontSize: 12 }} /> : <ClockCircleOutlined style={{ color: '#94a3b8', fontSize: 12 }} />}
                    <Text style={{ fontSize: 11, flex: 1 }}>{st.Title}</Text>
                    <Progress percent={stPct} size="small" style={{ width: 50, margin: 0 }} />
                  </div>
                );
              })}
            </div>

            {/* Timeline */}
            <Text style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', marginBottom: 8, display: 'block' }}>Timeline</Text>
            {task.auditLogs?.length > 0 ? (
              <Timeline items={task.auditLogs.slice(0, 6).map(log => ({
                color: log.Action === 'CREATED' ? '#2563eb' : '#16a34a',
                children: (
                  <div>
                    <Text style={{ fontSize: 11, fontWeight: 600 }}>{log.Action.replace(/_/g, ' ')}</Text>
                    <Text style={{ fontSize: 10, color: '#94a3b8', display: 'block' }}>{log.ActorName || 'System'} · {dayjs(log.CreatedAt).format('HH:mm')}</Text>
                  </div>
                ),
              }))} />
            ) : <Text style={{ fontSize: 11, color: '#94a3b8' }}>No events</Text>}
          </div>

          {/* ═══ BOTTOM-LEFT: Evidence + Comments ═══ */}
          <div style={{ overflow: 'auto', padding: '16px 20px' }}>
            {/* Evidence */}
            <Text style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', marginBottom: 8, display: 'block' }}>Evidence ({evidenceCount})</Text>
            {evidenceCount === 0 ? (
              <Empty description="No evidence submitted" style={{ padding: '20px 0' }} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                {task.evidence.map(ev => <EvidenceCard key={ev.Id} evidence={ev} />)}
              </div>
            )}

            {/* Submission Remarks */}
            {task.SubmissionRemarks && (
              <div style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', marginBottom: 6, display: 'block' }}>Submission Notes</Text>
                <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 8, borderLeft: '3px solid #2563eb' }}>
                  <Text style={{ fontSize: 11, color: '#94a3b8' }}>{task.AssigneeName} · {task.SubmittedAt ? dayjs(task.SubmittedAt).format('DD MMM HH:mm') : ''}</Text>
                  <Text style={{ fontSize: 12, color: '#334155', display: 'block', marginTop: 4, whiteSpace: 'pre-wrap' }}>{task.SubmissionRemarks}</Text>
                </div>
              </div>
            )}

            {/* Comments */}
            <Text style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', marginBottom: 8, display: 'block' }}>Comments</Text>
            <CommentThread />
          </div>

          {/* ═══ RIGHT: Review Panel ═══ */}
          <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #e5e7eb', display: 'grid', gridTemplateColumns: '300px 1fr', background: '#fafbfc' }}>
            {/* Left: Insights + Score */}
            <div style={{ padding: '16px 20px', borderRight: '1px solid #e5e7eb', overflow: 'auto' }}>
              <ReviewInsights task={task} subTasks={subTasks} />
              <Divider style={{ margin: '10px 0' }} />

              {/* Structured Scoring */}
              <Text style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', marginBottom: 8, display: 'block' }}>Quality Assessment</Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { key: 'accuracy', label: 'Accuracy' },
                  { key: 'completeness', label: 'Completeness' },
                  { key: 'evidence', label: 'Evidence Quality' },
                  { key: 'compliance', label: 'Process Compliance' },
                ].map(item => (
                  <div key={item.key}>
                    <Text style={{ fontSize: 11, color: '#334155' }}>{item.label}</Text>
                    <Rate value={scores[item.key]} onChange={v => setScores(s => ({ ...s, [item.key]: v }))} style={{ fontSize: 14 }} />
                  </div>
                ))}
                <div style={{ padding: '8px 10px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', textAlign: 'center' }}>
                  <Text style={{ fontSize: 9, color: '#16a34a', fontWeight: 600, textTransform: 'uppercase' }}>Overall Score</Text>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#16a34a' }}>{totalScore}/100</div>
                </div>
              </div>
            </div>

            {/* Right: Review Actions */}
            <div style={{ padding: '16px 20px', overflow: 'auto' }}>
              <Text style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', marginBottom: 8, display: 'block' }}>Review Decision</Text>

              <Text style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Comments <Text type="danger">*</Text></Text>
              <Text style={{ fontSize: 10, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Describe your review decision, what was done well, and what needs improvement.</Text>
              <Input.TextArea rows={4} value={reviewFeedback} onChange={e => setReviewFeedback(e.target.value)}
                placeholder={"Describe your review decision...\n\n• What was done well\n• What needs improvement\n• Action items..."}
                style={{ borderRadius: 8, fontSize: 12, marginBottom: 12 }} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                {canApprove && (
                  <Button type="primary" block onClick={handleApprove} loading={reviewSubmitting} disabled={!reviewFeedback.trim()}
                    style={{ borderRadius: 8, fontWeight: 600, background: '#16a34a', borderColor: '#16a34a', height: 40 }}>
                    <CheckCircleOutlined /> Approve
                  </Button>
                )}
                {canReject && (
                  <Button danger block onClick={handleReject} loading={reviewSubmitting} disabled={!reviewFeedback.trim()}
                    style={{ borderRadius: 8, fontWeight: 600, height: 40 }}>
                    <CloseCircleOutlined /> Reject
                  </Button>
                )}
              </div>

              {showEscalate && (
                <div style={{ padding: '10px 12px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecdd3', marginBottom: 12 }}>
                  <Text style={{ fontSize: 11, fontWeight: 600, color: '#dc2626', display: 'block', marginBottom: 6 }}>Escalation Reason *</Text>
                  <Input.TextArea rows={3} value={escalateReason} onChange={e => setEscalateReason(e.target.value)}
                    placeholder="Describe the issue..." style={{ borderRadius: 8, fontSize: 12 }} />
                  <Button type="primary" danger block onClick={handleEscalate} loading={reviewSubmitting} disabled={!escalateReason.trim()}
                    style={{ borderRadius: 8, marginTop: 8, fontWeight: 600 }}>Confirm Escalation</Button>
                </div>
              )}

              {/* Reviewer Analytics */}
              <ReviewerAnalytics task={task} />

              {/* Previous Review */}
              {task.ReviewRemarks && (
                <div style={{ marginTop: 12, padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                  <Text style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Previous Review</Text>
                  <Text style={{ fontSize: 11, color: '#64748b', whiteSpace: 'pre-wrap' }}>{task.ReviewRemarks}</Text>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
}
