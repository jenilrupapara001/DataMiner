import React from 'react';
import { Typography, Tag, Progress, Button, Space } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { WORKFLOW_STATUSES, PRIORITIES } from '../constants';
import { calculateHealth, getDueDateLabel } from '../utils/taskHealth';

const { Text } = Typography;

export default function MobileTaskCard({ task, onView }) {
  const health = calculateHealth(task);
  const due = getDueDateLabel(task);
  const pct = task.WeightedProgressPct || task.ProgressPct || 0;
  const statusCfg = WORKFLOW_STATUSES[task.Status] || {};
  const prCfg = PRIORITIES[task.Priority] || {};

  return (
    <div style={{
      padding: '14px 16px', borderRadius: 12, background: '#fff',
      border: '1px solid #e5e7eb', marginBottom: 8,
    }}>
      {/* Top row: Title + Status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text strong style={{ fontSize: 14, color: '#0f172a', display: 'block', lineHeight: 1.3 }}>{task.Title || 'Untitled'}</Text>
          <Text style={{ fontSize: 11, color: '#94a3b8' }}>{task.InstanceCode} · {task.SellerName || '-'}</Text>
        </div>
        <Tag style={{ fontSize: 10, borderRadius: 8, background: statusCfg.bg, color: statusCfg.color, border: 'none', fontWeight: 600 }}>{statusCfg.label}</Tag>
      </div>

      {/* Meta tags */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {task.Priority && <Tag style={{ fontSize: 10, borderRadius: 6, background: prCfg.bg, color: prCfg.color, border: 'none' }}>{task.Priority}</Tag>}
        {task.AssigneeName && <Tag style={{ fontSize: 10, borderRadius: 6, background: '#f1f5f9', color: '#475569', border: 'none' }}>{task.AssigneeName.split(' ')[0]}</Tag>}
        <Tag style={{ fontSize: 10, borderRadius: 6, background: health.bgColor, color: health.color, border: 'none' }}>{health.label}</Tag>
      </div>

      {/* Progress */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={{ fontSize: 11, color: '#64748b' }}>Progress</Text>
          <Text style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>{pct}%</Text>
        </div>
        <Progress percent={pct} size="small" strokeColor={pct >= 80 ? '#16a34a' : pct >= 50 ? '#2563eb' : '#f59e0b'} showInfo={false} />
      </div>

      {/* Due date + Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {due ? (
          <Text style={{ fontSize: 12, fontWeight: 600, color: due.color }}>{due.text}</Text>
        ) : <Text style={{ fontSize: 12, color: '#94a3b8' }}>No due date</Text>}
        <Button type="primary" size="small" icon={<EyeOutlined />} onClick={() => onView(task)} style={{ borderRadius: 8, fontSize: 11, fontWeight: 600 }}>View</Button>
      </div>
    </div>
  );
}
