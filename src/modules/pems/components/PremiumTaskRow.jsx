import React, { useState } from 'react';
import { Typography, Tag, Progress, Button, Space, Tooltip } from 'antd';
import { EyeOutlined, CheckCircleOutlined, CloseCircleOutlined, EditOutlined, MessageOutlined } from '@ant-design/icons';
import { WORKFLOW_STATUSES, VALID_TRANSITIONS, PRIORITIES } from '../constants';
import { calculateHealth, getDueDateLabel } from '../utils/taskHealth';

const { Text } = Typography;

export default function PremiumTaskRow({ task, index, selected, onSelect, onView, onTransition, onReview }) {
  const [hovered, setHovered] = useState(false);
  const health = calculateHealth(task);
  const due = getDueDateLabel(task);
  const pct = task.WeightedProgressPct || task.ProgressPct || 0;
  const statusCfg = WORKFLOW_STATUSES[task.Status] || {};
  const prCfg = PRIORITIES[task.Priority] || {};
  const nextStatuses = VALID_TRANSITIONS[task.Status] || [];

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '36px minmax(0,2fr) 120px 90px 100px 130px 100px',
        alignItems: 'center',
        gap: 0,
        padding: '10px 14px',
        borderBottom: '1px solid #f1f5f9',
        background: selected ? '#eff6ff' : hovered ? '#f8fafc' : 'transparent',
        cursor: 'pointer',
        transition: 'all 0.1s ease',
        position: 'relative',
      }}
      onClick={() => onView(task)}
    >
      {/* Checkbox */}
      <div onClick={e => e.stopPropagation()}>
        <input type="checkbox" checked={selected} onChange={() => onSelect(task.Id)}
          style={{ width: 14, height: 14, cursor: 'pointer', accentColor: '#2563eb' }} />
      </div>

      {/* Task Name + ID + Seller */}
      <div style={{ minWidth: 0 }}>
        <Text strong style={{ fontSize: 13, color: '#0f172a', display: 'block', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {task.Title || 'Untitled'}
        </Text>
        <Text style={{ fontSize: 10, color: '#94a3b8' }}>{task.InstanceCode} · {task.SellerName || '-'}</Text>
      </div>

      {/* Assignee */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {task.AssigneeName ? (
          <Space size={4}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb', fontSize: 10, fontWeight: 700 }}>
              {task.AssigneeName.charAt(0)}
            </div>
            <Text style={{ fontSize: 11, color: '#334155' }}>{task.AssigneeName.split(' ')[0]}</Text>
          </Space>
        ) : <Text style={{ fontSize: 11, color: '#d1d5db' }}>—</Text>}
      </div>

      {/* Priority */}
      <div>
        {task.Priority && (
          <Tag style={{ fontSize: 9, borderRadius: 6, background: prCfg.bg, color: prCfg.color, border: `1px solid ${prCfg.color}20`, fontWeight: 600, padding: '1px 6px', margin: 0 }}>{task.Priority}</Tag>
        )}
      </div>

      {/* Status */}
      <div>
        <Tag style={{ fontSize: 9, borderRadius: 10, background: statusCfg.bg, color: statusCfg.color, border: `1px solid ${statusCfg.color}25`, fontWeight: 600, padding: '1px 8px', margin: 0 }}>
          {statusCfg.label}
        </Tag>
      </div>

      {/* Progress + Health */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Progress percent={pct} size="small" strokeColor={pct >= 80 ? '#16a34a' : pct >= 50 ? '#2563eb' : '#f59e0b'} style={{ width: 60, margin: 0 }} />
          <Text style={{ fontSize: 10, fontWeight: 600, color: '#64748b' }}>{pct}%</Text>
        </div>
      </div>

      {/* Due Date */}
      <div>
        {due ? (
          <Space size={4}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: due.color, flexShrink: 0 }} />
            <Text style={{ fontSize: 11, fontWeight: 600, color: due.color }}>{due.text}</Text>
          </Space>
        ) : <Text style={{ fontSize: 11, color: '#d1d5db' }}>—</Text>}
      </div>

      {/* Hover Quick Actions */}
      {hovered && (
        <div onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            display: 'flex', gap: 2, padding: '3px 6px', borderRadius: 8,
            background: '#fff', border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            zIndex: 10,
          }}>
          <Tooltip title="View"><Button type="text" size="small" icon={<EyeOutlined />} onClick={() => onView(task)} style={{ fontSize: 12, color: '#64748b' }} /></Tooltip>
          {nextStatuses.includes('SUBMITTED') && (
            <Tooltip title="Submit"><Button type="text" size="small" icon={<CheckCircleOutlined />} onClick={() => onTransition(task, 'SUBMITTED')} style={{ fontSize: 12, color: '#2563eb' }} /></Tooltip>
          )}
          {nextStatuses.includes('APPROVED') && (
            <Tooltip title="Approve"><Button type="text" size="small" icon={<CheckCircleOutlined />} onClick={() => onReview(task, 'APPROVE')} style={{ fontSize: 12, color: '#16a34a' }} /></Tooltip>
          )}
          {nextStatuses.includes('REJECTED') && (
            <Tooltip title="Reject"><Button type="text" size="small" icon={<CloseCircleOutlined />} onClick={() => onReview(task, 'REJECT')} style={{ fontSize: 12, color: '#dc2626' }} /></Tooltip>
          )}
          <Tooltip title="Edit"><Button type="text" size="small" icon={<EditOutlined />} style={{ fontSize: 12, color: '#94a3b8' }} /></Tooltip>
        </div>
      )}
    </div>
  );
}
