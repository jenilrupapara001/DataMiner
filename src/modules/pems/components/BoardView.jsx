import React from 'react';
import { Typography, Tag, Progress, Button, Tooltip, Space } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { WORKFLOW_STATUSES, PRIORITIES } from '../constants';
import { calculateHealth, getDueDateLabel } from '../utils/taskHealth';

const { Text } = Typography;

const COLUMN_CONFIG = [
  { key: 'ASSIGNED', label: 'Assigned', color: '#2563eb', bg: '#eff6ff' },
  { key: 'ACCEPTED', label: 'Accepted', color: '#9333ea', bg: '#f5f3ff' },
  { key: 'IN_PROGRESS', label: 'In Progress', color: '#2563eb', bg: '#eff6ff' },
  { key: 'SUBMITTED', label: 'Submitted', color: '#f59e0b', bg: '#fffbeb' },
  { key: 'UNDER_REVIEW', label: 'Under Review', color: '#9333ea', bg: '#f5f3ff' },
  { key: 'APPROVED', label: 'Approved', color: '#16a34a', bg: '#f0fdf4' },
];

function TaskCard({ task, onView }) {
  const health = calculateHealth(task);
  const dueLabel = getDueDateLabel(task);
  const pct = task.WeightedProgressPct || task.ProgressPct || 0;
  const prCfg = PRIORITIES[task.Priority] || {};

  return (
    <div
      onClick={() => onView(task)}
      style={{
        padding: '10px 12px', borderRadius: 8, background: '#fff',
        border: '1px solid #e5e7eb', cursor: 'pointer', transition: 'all 0.15s',
        marginBottom: 6,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#2563eb40'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* Title + ID */}
      <div style={{ marginBottom: 6 }}>
        <Text strong style={{ fontSize: 12, color: '#0f172a', display: 'block', lineHeight: 1.3 }}>{task.Title || 'Untitled'}</Text>
        <Text style={{ fontSize: 10, color: '#94a3b8' }}>{task.InstanceCode} · {task.SellerName || '-'}</Text>
      </div>

      {/* Meta row */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
        {task.Priority && (
          <Tag style={{ fontSize: 8, borderRadius: 4, background: prCfg.bg, color: prCfg.color, border: 'none', padding: '1px 5px', margin: 0, lineHeight: '14px' }}>{task.Priority}</Tag>
        )}
        {task.AssigneeName && (
          <Tag style={{ fontSize: 8, borderRadius: 4, background: '#f1f5f9', color: '#475569', border: 'none', padding: '1px 5px', margin: 0, lineHeight: '14px' }}>
            {task.AssigneeName.split(' ')[0]}
          </Tag>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: health.color, flexShrink: 0 }} />
          <Text style={{ fontSize: 8, color: health.color, fontWeight: 600 }}>{health.label}</Text>
        </div>
      </div>

      {/* Progress */}
      <Progress percent={pct} size="small" strokeColor={pct >= 80 ? '#16a34a' : pct >= 50 ? '#2563eb' : '#f59e0b'}
        format={() => <Text style={{ fontSize: 9, color: '#64748b' }}>{pct}%</Text>}
        style={{ margin: 0, marginBottom: 4 }} />

      {/* Due date */}
      {dueLabel && (
        <div style={{ fontSize: 10, fontWeight: 600, color: dueLabel.color }}>{dueLabel.text}</div>
      )}
    </div>
  );
}

export default function BoardView({ instances, onView, loading }) {
  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><Text type="secondary">Loading...</Text></div>;

  // Group tasks by status
  const grouped = {};
  COLUMN_CONFIG.forEach(col => { grouped[col.key] = []; });
  instances.forEach(task => {
    if (grouped[task.Status]) {
      grouped[task.Status].push(task);
    } else {
      // Group other statuses into first column
      if (!grouped['ASSIGNED']) grouped['ASSIGNED'] = [];
      grouped['ASSIGNED'].push(task);
    }
  });

  return (
    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '4px 0', minHeight: 400 }}>
      {COLUMN_CONFIG.map(col => (
        <div key={col.key} style={{ minWidth: 260, flex: '1 1 0', display: 'flex', flexDirection: 'column' }}>
          {/* Column Header */}
          <div style={{ padding: '8px 12px', background: col.bg, borderRadius: '8px 8px 0 0', border: `1px solid ${col.color}20`, borderBottom: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space size={6}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: col.color }} />
              <Text strong style={{ fontSize: 11, color: col.color }}>{col.label}</Text>
            </Space>
            <Tag style={{ fontSize: 9, borderRadius: 10, background: col.color + '20', color: col.color, border: 'none' }}>{grouped[col.key]?.length || 0}</Tag>
          </div>

          {/* Column Body */}
          <div style={{ flex: 1, background: col.bg + '40', borderRadius: '0 0 8px 8px', border: `1px solid ${col.color}10`, borderTop: 'none', padding: 6, overflowY: 'auto', maxHeight: 500 }}>
            {(grouped[col.key] || []).map(task => (
              <TaskCard key={task.Id} task={task} onView={onView} />
            ))}
            {(grouped[col.key] || []).length === 0 && (
              <div style={{ padding: '20px 10px', textAlign: 'center' }}>
                <Text style={{ fontSize: 11, color: '#94a3b8' }}>No tasks</Text>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
