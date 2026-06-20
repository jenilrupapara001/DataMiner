import React from 'react';
import { Skeleton } from 'antd';
import {
  ShopOutlined, CheckCircleOutlined, PauseCircleOutlined,
  DatabaseOutlined, GlobalOutlined, ThunderboltOutlined
} from '@ant-design/icons';
import StatCard from './StatCard';

const defaultStats = {
  totalStores: 0, activeStores: 0, pausedStores: 0,
  totalAsins: 0, activeAsins: 0, marketplaces: 0, activeToday: 0
};

const SellerStatsStrip = ({ dbStats, statsLoading, onStatClick }) => {
  const s = dbStats || defaultStats;

  const stats = [
    {
      label: 'Total Stores', value: s.totalStores,
      icon: <ShopOutlined />, trend: null, onClick: null,
    },
    {
      label: 'Active', value: s.activeStores,
      icon: <CheckCircleOutlined />,
      trend: s.totalStores > 0
        ? { value: ((s.activeStores / s.totalStores) * 100).toFixed(1) + '%', direction: 'up', label: 'of total' }
        : null,
      onClick: () => onStatClick?.('status', 'Active'),
    },
    {
      label: 'Paused', value: s.pausedStores,
      icon: <PauseCircleOutlined />,
      trend: s.totalStores > 0
        ? { value: ((s.pausedStores / s.totalStores) * 100).toFixed(1) + '%', direction: 'down', label: 'of total' }
        : null,
      onClick: () => onStatClick?.('status', 'Paused'),
    },
    {
      label: 'Total ASINs', value: s.totalAsins,
      icon: <DatabaseOutlined />, trend: null, onClick: null,
    },
    {
      label: 'Marketplaces', value: s.marketplaces,
      icon: <GlobalOutlined />,
      trend: s.marketplaces > 0 ? { value: 'IN', direction: null, label: null } : null,
      onClick: null,
    },
    {
      label: 'Active Today', value: s.activeToday,
      icon: <ThunderboltOutlined />,
      trend: { value: 'Live', direction: 'live', label: null },
      onClick: null,
    },
  ];

  if (statsLoading && !dbStats) {
    return (
      <div style={{
        padding: '12px 28px', background: '#ffffff', borderBottom: '1px solid #d9e6e9',
        display: 'flex', gap: 10,
      }}>
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} style={{ flex: 1, minWidth: 140 }}>
            <Skeleton active paragraph={{ rows: 1 }} title={{ width: '60%' }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{
      padding: '12px 28px', background: '#ffffff', borderBottom: '1px solid #d9e6e9',
      display: 'flex', gap: 10, flexWrap: 'wrap',
    }}>
      {stats.map(stat => (
        <StatCard
          key={stat.label}
          label={stat.label}
          value={stat.value}
          icon={stat.icon}
          trend={stat.trend}
          onClick={stat.onClick}
        />
      ))}
    </div>
  );
};

export default SellerStatsStrip;
