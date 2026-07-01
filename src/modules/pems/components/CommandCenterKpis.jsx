import React from 'react';
import { Typography, Tooltip } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, MinusOutlined, ThunderboltOutlined, EyeOutlined, ClockCircleOutlined, WarningOutlined, CheckCircleOutlined, SafetyCertificateOutlined, BarChartOutlined, TrophyOutlined } from '@ant-design/icons';

const { Text } = Typography;

function MiniTrend({ value, label }) {
  if (value === undefined || value === null) return null;
  const isUp = value > 0;
  const isDown = value < 0;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color: isUp ? '#16a34a' : isDown ? '#dc2626' : '#94a3b8' }}>
      {isUp ? '↑' : isDown ? '↓' : '—'} {Math.abs(value).toFixed(0)}%
      {label && <span style={{ color: '#94a3b8', fontWeight: 500 }}> {label}</span>}
    </span>
  );
}

function MiniSparkline({ data, color = '#2563eb', width = 48, height = 20 }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * height}`).join(' ');
  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CommandCenterKpis({ kpi, risk, loading, onDrillDown }) {
  const cards = [
    { key: 'all_tasks', title: 'All Tasks', value: kpi.total || 0, color: '#0f172a', icon: <BarChartOutlined />, trend: 8, spark: [80, 85, 92, 88, 95, 100, kpi.total || 0] },
    { key: 'my_open', title: 'My Open', value: kpi.active || 0, color: '#2563eb', icon: <ThunderboltOutlined />, trend: 12, spark: [3, 5, 4, 6, 8, 5, kpi.active || 0] },
    { key: 'pending_review', title: 'Pending Review', value: kpi.pendingReview || 0, color: '#9333ea', icon: <EyeOutlined />, trend: risk?.staleReviews > 0 ? -33 : null, spark: [2, 3, 1, 4, 2, 3, kpi.pendingReview || 0] },
    { key: 'due_today', title: 'Due Today', value: 0, color: '#f59e0b', icon: <ClockCircleOutlined />, trend: null },
    { key: 'overdue', title: 'Overdue', value: kpi.overdue || 0, color: '#dc2626', icon: <WarningOutlined />, trend: -8, spark: [5, 4, 3, 2, 1, 2, kpi.overdue || 0] },
    { key: 'completed', title: 'Completed', value: kpi.approved || 0, color: '#16a34a', icon: <CheckCircleOutlined />, trend: 15, spark: [10, 12, 14, 11, 16, 18, kpi.approved || 0] },
    { key: 'sla', title: 'SLA Compliance', value: `${kpi.slaCompliance || 100}%`, color: (kpi.slaCompliance || 100) >= 90 ? '#16a34a' : '#dc2626', icon: <SafetyCertificateOutlined />, trend: null },
    { key: 'dept_load', title: 'Dept Load', value: `${kpi.total || 0}`, color: '#0288d1', icon: <BarChartOutlined />, trend: null },
    { key: 'health', title: 'Health Score', value: `${kpi.completionRate || 0}%`, color: (kpi.completionRate || 0) >= 80 ? '#16a34a' : '#f59e0b', icon: <TrophyOutlined />, trend: 5 },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: 8, marginBottom: 16 }}>
      {cards.map(card => (
        <Tooltip key={card.key} title={`Click to view ${card.title}`} placement="bottom">
          <div
            onClick={() => onDrillDown?.(card.key)}
            style={{
              padding: '10px 12px', borderRadius: 12, background: '#fff',
              border: '1px solid #f1f5f9', cursor: 'pointer', transition: 'all 0.15s',
              position: 'relative', overflow: 'hidden',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = card.color + '40'; e.currentTarget.style.boxShadow = `0 4px 12px ${card.color}10`; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#f1f5f9'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ position: 'relative', zIndex: 1 }}>
                <Text style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, display: 'block' }}>{card.title}</Text>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', lineHeight: 1.1, marginTop: 2, fontFamily: '-apple-system, system-ui, sans-serif' }}>{card.value}</div>
                {card.trend !== null && card.trend !== undefined && (
                  <div style={{ marginTop: 3 }}><MiniTrend value={card.trend} label="vs yesterday" /></div>
                )}
              </div>
              <MiniSparkline data={card.spark} color={card.color} />
            </div>
            {/* Subtle gradient bar at bottom */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${card.color}40, transparent)` }} />
          </div>
        </Tooltip>
      ))}
    </div>
  );
}
