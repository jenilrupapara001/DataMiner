import React, { useState, useEffect } from 'react';
import { Typography, Tag, Space } from 'antd';
import { ThunderboltOutlined, CheckCircleOutlined, ClockCircleOutlined, EyeOutlined, EditOutlined } from '@ant-design/icons';
import pemsApi from '../services/pemsApi';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Text } = Typography;

const ACTION_CONFIG = {
  CREATED: { icon: <ThunderboltOutlined style={{ fontSize: 9 }} />, color: '#2563eb', bg: '#eff6ff' },
  STATUS_CHANGED: { icon: <CheckCircleOutlined style={{ fontSize: 9 }} />, color: '#16a34a', bg: '#f0fdf4' },
  SUBTASK_COMPLETED: { icon: <CheckCircleOutlined style={{ fontSize: 9 }} />, color: '#16a34a', bg: '#f0fdf4' },
  EVIDENCE_UPLOADED: { icon: <EditOutlined style={{ fontSize: 9 }} />, color: '#9333ea', bg: '#f5f3ff' },
};

export default function LiveActivityFeed({ compact = false }) {
  const [activities, setActivities] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await pemsApi.getActivityFeed();
        if (res.success) setActivities(res.data || []);
      } catch {}
    };
    load();
    const interval = setInterval(load, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  // Auto-rotate through activities
  useEffect(() => {
    if (activities.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIdx(prev => (prev + 1) % activities.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [activities.length]);

  if (activities.length === 0) return null;

  const current = activities[currentIdx] || activities[0];
  const cfg = ACTION_CONFIG[current.Action] || ACTION_CONFIG.CREATED;

  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: '#f8fafc', border: '1px solid #f1f5f9', maxWidth: 300, overflow: 'hidden' }}>
        <div style={{ width: 18, height: 18, borderRadius: 5, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cfg.color, flexShrink: 0 }}>
          {cfg.icon}
        </div>
        <Text style={{ fontSize: 10, color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <Text strong>{current.ActorName || 'System'}</Text> {current.Action.replace(/_/g, ' ').toLowerCase()}
          {current.InstanceCode && <> <Text style={{ color: '#2563eb' }}>{current.InstanceCode}</Text></>}
        </Text>
        <Text style={{ fontSize: 9, color: '#94a3b8', whiteSpace: 'nowrap', flexShrink: 0 }}>{dayjs(current.CreatedAt).fromNow()}</Text>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: '#f8fafc', border: '1px solid #f1f5f9' }}>
      <div style={{ width: 20, height: 20, borderRadius: 5, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cfg.color, flexShrink: 0 }}>
        {cfg.icon}
      </div>
      <Text style={{ fontSize: 11, color: '#334155', flex: 1 }}>
        <Text strong>{current.ActorName || 'System'}</Text>{' '}
        {current.Action.replace(/_/g, ' ').toLowerCase()}
        {current.InstanceCode && <> <Text strong style={{ color: '#2563eb' }}>{current.InstanceCode}</Text></>}
        {current.Title && <> — {current.Title}</>}
      </Text>
      <Text style={{ fontSize: 10, color: '#94a3b8', whiteSpace: 'nowrap' }}>{dayjs(current.CreatedAt).fromNow()}</Text>
      {/* Dots indicator */}
      <div style={{ display: 'flex', gap: 3 }}>
        {activities.slice(0, 5).map((_, i) => (
          <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: i === currentIdx ? '#2563eb' : '#d1d5db' }} />
        ))}
      </div>
    </div>
  );
}
