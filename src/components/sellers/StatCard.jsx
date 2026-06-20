import React from 'react';
import { Tooltip } from 'antd';

const StatCard = ({ label, value, icon, trend, color = '#121b1e', onClick }) => {
  const formatted = Intl.NumberFormat('en-IN').format(value);

  return (
    <div
      onClick={onClick}
      style={{
        flex: '1 1 0',
        minWidth: 140,
        background: '#ffffff',
        border: '1px solid #d9e6e9',
        borderRadius: 10,
        padding: '14px 16px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.18s ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = '#cbd0d4';
        if (onClick) e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = '#d9e6e9';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <span style={{
          fontSize: 10.5, fontWeight: 700, color: '#8c8e8f',
          textTransform: 'uppercase', letterSpacing: '0.06em'
        }}>
          {label}
        </span>
        {icon && (
          <span style={{ color: '#cbd0d4', fontSize: 16, lineHeight: 1 }}>{icon}</span>
        )}
      </div>
      <Tooltip title={formatted !== String(value) ? value.toLocaleString('en-IN') : undefined}>
        <div style={{
          fontSize: 24, fontWeight: 800, color: '#121b1e',
          letterSpacing: '-0.6px', lineHeight: 1, marginBottom: trend ? 6 : 0
        }}>
          {formatted}
        </div>
      </Tooltip>
      {trend && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
          {trend.direction === 'up' && (
            <span style={{ color: '#10b981', fontSize: 11, fontWeight: 700 }}>↑</span>
          )}
          {trend.direction === 'down' && (
            <span style={{ color: '#ef4444', fontSize: 11, fontWeight: 700 }}>↓</span>
          )}
          {trend.direction === 'live' && (
            <span style={{
              width: 6, height: 6, borderRadius: '50%', backgroundColor: '#10b981',
              display: 'inline-block', animation: 'pulse 1.5s infinite'
            }} />
          )}
          {trend.value && (
            <span style={{
              fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 100,
              border: '1px solid',
              borderColor: trend.direction === 'up' ? '#a7f3d0' : trend.direction === 'down' ? '#fecaca' : '#d9e6e9',
              color: trend.direction === 'up' ? '#059669' : trend.direction === 'down' ? '#dc2626' : '#8c8e8f',
              background: trend.direction === 'up' ? '#ecfdf5' : trend.direction === 'down' ? '#fef2f2' : '#f4f5f7',
            }}>
              {trend.value}
            </span>
          )}
          {trend.label && (
            <span style={{ fontSize: 10, color: '#8c8e8f', fontWeight: 500 }}>{trend.label}</span>
          )}
        </div>
      )}
    </div>
  );
};

export default StatCard;
