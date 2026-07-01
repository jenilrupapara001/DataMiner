import React, { useState, useEffect } from 'react';
import { Typography, Tag, Button, Badge, Space, Progress, Divider } from 'antd';
import { ClockCircleOutlined, EyeOutlined, WarningOutlined, ThunderboltOutlined, ReloadOutlined, CheckCircleOutlined } from '@ant-design/icons';
import pemsApi from '../services/pemsApi';
import { WORKFLOW_STATUSES, SLA_STATUSES, PRIORITIES } from '../constants';
import { calculateHealth, getDueDateLabel, isOverdue } from '../utils/taskHealth';
import dayjs from 'dayjs';

const { Text } = Typography;

function InsightSection({ title, icon: Icon, count, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Space size={6}>
          <Icon size={12} style={{ color: '#64748b' }} />
          <Text style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>{title}</Text>
        </Space>
        {count !== undefined && <Badge count={count} size="small" style={{ backgroundColor: '#e5e7eb', color: '#475569' }} />}
      </div>
      {children}
    </div>
  );
}

function TaskRow({ task, onClick }) {
  const health = calculateHealth(task);
  const due = getDueDateLabel(task);
  const prCfg = PRIORITIES[task.Priority] || {};
  return (
    <div onClick={() => onClick?.(task)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #f1f5f9', background: '#fff', marginBottom: 4, cursor: 'pointer', transition: 'all 0.1s' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = '#2563eb30'}
      onMouseLeave={e => e.currentTarget.style.borderColor = '#f1f5f9'}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <Text style={{ fontSize: 11, fontWeight: 600, color: '#0f172a', lineHeight: 1.3, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.Title || 'Untitled'}</Text>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: health.color, flexShrink: 0, marginTop: 4 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space size={4}>
          <Text style={{ fontSize: 9, color: '#94a3b8' }}>{task.InstanceCode}</Text>
          {task.Priority && <Tag style={{ fontSize: 7, borderRadius: 3, background: prCfg.bg, color: prCfg.color, border: 'none', padding: '0 4px', margin: 0, lineHeight: '12px' }}>{task.Priority}</Tag>}
        </Space>
        {due && <Text style={{ fontSize: 9, fontWeight: 600, color: due.color }}>{due.text}</Text>}
      </div>
    </div>
  );
}

export default function RightInsightsPanel({ onTaskClick }) {
  const [upcoming, setUpcoming] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [liveRes, feedRes] = await Promise.all([
        pemsApi.getLiveTasks({ status: 'UNDER_REVIEW' }),
        pemsApi.getActivityFeed(),
      ]);
      if (liveRes.success) setReviews(liveRes.data?.slice(0, 5) || []);
      if (feedRes.success) setRecent(feedRes.data?.slice(0, 8) || []);
      // Get upcoming from live tasks filtered by due date
      const upcomingRes = await pemsApi.getLiveTasks({});
      if (upcomingRes.success) {
        const tasks = (upcomingRes.data || [])
          .filter(t => t.DueDate && !isOverdue(t))
          .sort((a, b) => new Date(a.DueDate) - new Date(b.DueDate))
          .slice(0, 5);
        setUpcoming(tasks);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const actionIcons = {
    CREATED: <ThunderboltOutlined style={{ fontSize: 9 }} />,
    STATUS_CHANGED: <CheckCircleOutlined style={{ fontSize: 9 }} />,
  };

  return (
    <div style={{ width: 240, background: '#fafbfc', borderRadius: 10, border: '1px solid #e5e7eb', padding: '14px', flexShrink: 0, overflowY: 'auto', maxHeight: 600 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>Insights</Text>
        <Button type="text" size="small" icon={<ReloadOutlined />} onClick={loadData} style={{ fontSize: 10 }} />
      </div>

      {/* Upcoming Deadlines */}
      <InsightSection title="Upcoming Deadlines" icon={ClockCircleOutlined} count={upcoming.length}>
        {upcoming.length === 0 ? (
          <Text style={{ fontSize: 11, color: '#94a3b8' }}>No upcoming tasks</Text>
        ) : upcoming.map(t => <TaskRow key={t.Id} task={t} onClick={onTaskClick} />)}
      </InsightSection>

      <Divider style={{ margin: '8px 0' }} />

      {/* Pending Reviews */}
      <InsightSection title="My Reviews" icon={EyeOutlined} count={reviews.length}>
        {reviews.length === 0 ? (
          <Text style={{ fontSize: 11, color: '#94a3b8' }}>No pending reviews</Text>
        ) : reviews.map(t => <TaskRow key={t.Id} task={t} onClick={onTaskClick} />)}
      </InsightSection>

      <Divider style={{ margin: '8px 0' }} />

      {/* Recent Activity */}
      <InsightSection title="Recent Activity" icon={WarningOutlined}>
        {recent.length === 0 ? (
          <Text style={{ fontSize: 11, color: '#94a3b8' }}>No recent activity</Text>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recent.slice(0, 5).map(a => (
              <div key={a.Id} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <div style={{ width: 16, height: 16, borderRadius: 4, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  {actionIcons[a.Action] || <ThunderboltOutlined style={{ fontSize: 8 }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 10, color: '#334155', lineHeight: 1.3 }}>
                    <Text strong>{a.ActorName || 'System'}</Text> {a.Action.replace(/_/g, ' ').toLowerCase()}
                  </Text>
                  <Text style={{ fontSize: 9, color: '#94a3b8' }}>
                    {a.InstanceCode && <>{a.InstanceCode} · </>}
                    {dayjs(a.CreatedAt).fromNow?.() || dayjs(a.CreatedAt).format('HH:mm')}
                  </Text>
                </div>
              </div>
            ))}
          </div>
        )}
      </InsightSection>
    </div>
  );
}
