import React from 'react';
import { Tooltip } from 'antd';

const StatCard = ({ label, value, icon, trend, color = '#1976D2', onClick }) => {
  const formatted = Intl.NumberFormat('en-IN').format(value);

  return (
    <div
      onClick={onClick}
      style={{
        flex: '1 1 0',
        minWidth: 140,
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: 12,
        padding: '14px 16px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.18s ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = '#CBD5E1';
        if (onClick) e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = '#E5E7EB';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <span style={{
          fontSize: 10.5, fontWeight: 700, color: '#64748B',
          textTransform: 'uppercase', letterSpacing: '0.06em'
        }}>
          {label}
        </span>
        {icon && (
          <span style={{ color: '#94A3B8', fontSize: 16, lineHeight: 1 }}>{icon}</span>
        )}
      </div>
      <Tooltip title={formatted !== String(value) ? value.toLocaleString('en-IN') : undefined}>
        <div style={{
          fontSize: 24, fontWeight: 800, color: '#111827',
          letterSpacing: '-0.02em', lineHeight: 1, marginBottom: trend ? 6 : 0
        }}>
          {formatted}
        </div>
      </Tooltip>
      {trend && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
          {trend.direction === 'up' && (
            <span style={{ color: '#2E7D32', fontSize: 11, fontWeight: 700 }}>↑</span>
          )}
          {trend.direction === 'down' && (
            <span style={{ color: '#D32F2F', fontSize: 11, fontWeight: 700 }}>↓</span>
          )}
          {trend.direction === 'live' && (
            <span style={{
              width: 6, height: 6, borderRadius: '50%', backgroundColor: '#2E7D32',
              display: 'inline-block',
            }} />
          )}
          {trend.value && (
            <span style={{
              fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 100,
              border: '1px solid',
              borderColor: trend.direction === 'up' ? '#A5D6A7' : trend.direction === 'down' ? '#EF9A9A' : '#E5E7EB',
              color: trend.direction === 'up' ? '#2E7D32' : trend.direction === 'down' ? '#D32F2F' : '#64748B',
              background: trend.direction === 'up' ? '#E8F5E9' : trend.direction === 'down' ? '#FFEBEE' : '#F1F5F9',
            }}>
              {trend.value}
            </span>
          )}
          {trend.label && (
            <span style={{ fontSize: 10, color: '#64748B', fontWeight: 500 }}>{trend.label}</span>
          )}
        </div>
      )}
    </div>
  );
};

export default StatCard;
