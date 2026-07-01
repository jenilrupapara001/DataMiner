import React from 'react';
import { Typography } from 'antd';
import { ClockCircleOutlined, AlertOutlined, WarningOutlined, SafetyCertificateOutlined, CalendarOutlined, BarChartOutlined, ArrowUpOutlined, ArrowDownOutlined, MinusOutlined, EyeOutlined } from '@ant-design/icons';

const { Text } = Typography;

function TrendArrow({ value }) {
  if (value === null || value === undefined) return null;
  const isUp = value > 0;
  const isDown = value < 0;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color: isUp ? '#16a34a' : isDown ? '#dc2626' : '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      {isUp ? <ArrowUpOutlined style={{ fontSize: 9 }} /> : isDown ? <ArrowDownOutlined style={{ fontSize: 9 }} /> : <MinusOutlined style={{ fontSize: 9 }} />}
      {Math.abs(value).toFixed(0)}%
      <span style={{ color: '#94a3b8', fontWeight: 500 }}>vs yesterday</span>
    </span>
  );
}

function GlassCard({ title, value, subtitle, color, icon: Icon, trend, onClick, active }) {
  return (
    <div onClick={onClick} style={{
      padding: '14px 16px', borderRadius: 12, background: active ? `linear-gradient(135deg, ${color}08, ${color}04)` : '#fff',
      border: `1px solid ${active ? color + '30' : '#e5e7eb'}`,
      cursor: onClick ? 'pointer' : 'default', transition: 'all 0.2s ease',
      position: 'relative', overflow: 'hidden', flex: '1 1 0', minWidth: 150,
      boxShadow: active ? `0 4px 12px ${color}10` : '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Text style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, display: 'block' }}>{title}</Text>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', lineHeight: 1.1, marginTop: 4, fontFamily: '-apple-system, system-ui, sans-serif' }}>{value}</div>
          {subtitle && <Text style={{ fontSize: 11, color: subtitle.color || '#64748b', display: 'block', marginTop: 4, fontWeight: subtitle.bold ? 600 : 400 }}>{subtitle.text}</Text>}
        </div>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${color}15, ${color}08)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
          <Icon size={18} />
        </div>
      </div>
      {trend !== null && trend !== undefined && (
        <div style={{ marginTop: 6 }}><TrendIndicator value={trend} /></div>
      )}
      {/* Subtle gradient bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${color}50, transparent)` }} />
    </div>
  );
}

export function ReviewExecutiveKpis({ data, loading }) {
  if (loading) return null;

  const kpis = [
    { title: 'Pending Reviews', value: data.pending || 0, color: '#7c3aed', icon: ClockCircleOutlined, subtitle: { text: `${data.pendingToday || 0} due today`, color: '#7c3aed' }, trend: data.pendingTrend },
    { title: 'Avg Review Time', value: `${data.avgReviewTime || 0}m`, color: '#2563eb', icon: EyeOutlined, subtitle: { text: 'Target: 15 min', color: '#64748b' }, trend: data.reviewTimeTrend },
    { title: 'SLA Compliance', value: `${data.slaCompliance || 0}%`, color: (data.slaCompliance || 0) >= 95 ? '#16a34a' : '#dc2626', icon: SafetyCertificateOutlined, subtitle: { text: 'Target: 95%', color: '#64748b' }, trend: data.slaTrend },
    { title: 'Rework Rate', value: `${data.reworkRate || 0}%`, color: (data.reworkRate || 0) <= 5 ? '#16a34a' : '#f59e0b', icon: WarningOutlined, subtitle: { text: 'Target: <5%', color: '#64748b' }, trend: data.reworkTrend },
    { title: 'Critical Reviews', value: data.critical || 0, color: data.critical > 0 ? '#dc2626' : '#16a34a', icon: AlertOutlined, subtitle: { text: data.critical > 0 ? 'Needs attention' : 'No escalations', color: data.critical > 0 ? '#dc2626' : '#16a34a' } },
    { title: 'Due Today', value: data.today || 0, color: (data.today || 0) > 0 ? '#f59e0b' : '#16a34a', icon: CalendarOutlined, subtitle: { text: (data.today || 0) > 0 ? 'Review now' : 'On track', color: '#64748b' } },
  ];

  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
      {kpis.map(kpi => <GlassCard key={kpi.title} {...kpi} />)}
    </div>
  );
}

function TrendIndicator({ value }) {
  if (value === undefined || value === null) return null;
  const isUp = value > 0;
  const isDown = value < 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: isUp ? '#16a34a' : isDown ? '#dc2626' : '#94a3b8' }}>
        {isUp ? '↑' : isDown ? '↓' : '—'} {Math.abs(value).toFixed(0)}%
      </span>
      <span style={{ fontSize: 10, color: '#94a3b8' }}>vs yesterday</span>
    </div>
  );
}
