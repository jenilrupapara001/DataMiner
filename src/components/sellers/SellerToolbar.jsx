import React from 'react';
import { Input, Select, Button, Tooltip, Space, Badge, Popover } from 'antd';
import {
  SearchOutlined, ReloadOutlined, UploadOutlined,
  FilterOutlined,
} from '@ant-design/icons';

const SellerToolbar = ({
  searchQuery, onSearchChange,
  activeTab, onTabChange,
  marketplaceFilter, onMarketplaceChange,
  managerFilter, onManagerChange,
  statusFilter, onStatusChange,
  canAccessAmazon, canAccessAjio, canAccessMyntra,
  managersList,
  onRefresh, loading,
  isGlobalUser, isBrandManager,
  poolStats, onOpenPool,
  onOpenBulkImport,
  onIngestAll,
  sellersLength, totalItems,
  onReset,
  hasActiveFilters,
}) => {
  const filterCount = [activeTab !== 'all', marketplaceFilter !== 'all', managerFilter !== 'all', searchQuery].filter(Boolean).length;

  const marketplaceOptions = [
    { label: 'All Markets', value: 'all' },
    ...(canAccessAmazon ? [{ label: 'Amazon.in', value: 'amazon.in' }] : []),
    ...(canAccessAjio ? [{ label: 'Ajio', value: 'ajio' }] : []),
    ...(canAccessMyntra ? [{ label: 'Myntra', value: 'myntra' }] : []),
  ];

  const managerOptions = [
    { label: 'All Managers', value: 'all' },
    ...managersList
      .filter(m => m.role?.name === 'manager' || m.role?.name === 'Brand Manager' || m.role?.name === 'listing_team')
      .map(m => ({ label: `${m.firstName} ${m.lastName}`, value: m._id })),
  ];

  const moreFiltersContent = (
    <div style={{ width: 260, padding: 4 }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#8c8e8f', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Status</div>
        <Select
          value={statusFilter}
          onChange={onStatusChange}
          style={{ width: '100%' }}
          size="small"
          options={[
            { label: 'All Statuses', value: 'all' },
            { label: 'Active', value: 'Active' },
            { label: 'Paused', value: 'Paused' },
          ]}
        />
      </div>
      {isGlobalUser && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#8c8e8f', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Octoparse Pool</div>
          <Button size="small" icon={<FilterOutlined />} onClick={onOpenPool} block style={{ borderRadius: 6, fontWeight: 600, fontSize: 11 }}>
            Pool ({poolStats.available})
          </Button>
        </div>
      )}
      {isGlobalUser && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#8c8e8f', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Batch Sync</div>
          <Button size="small" onClick={onIngestAll} block style={{ borderRadius: 6, fontWeight: 600, fontSize: 11 }}>
            Fetch Latest from Octoparse
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div style={{
      padding: '8px 28px', background: '#fcfcfd', borderBottom: '1px solid #d9e6e9',
    }}>
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between'
      }}>
        <Space wrap size={6}>
          <Input
            placeholder="Search storefronts..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            prefix={<SearchOutlined style={{ color: '#8c8e8f', fontSize: 12 }} />}
            style={{ width: 220, borderRadius: 6 }}
            allowClear
            size="small"
          />

          <Select
            value={activeTab}
            onChange={v => { onTabChange(v); onStatusChange('all'); }}
            style={{ width: 130 }}
            size="small"
            options={[
              { label: 'All Statuses', value: 'all' },
              { label: 'Active', value: 'Active' },
              { label: 'Paused', value: 'Paused' },
            ]}
          />

          <Select value={marketplaceFilter} onChange={onMarketplaceChange} style={{ width: 140 }} size="small"
            options={marketplaceOptions}
          />

          <Select value={managerFilter} onChange={onManagerChange} style={{ width: 160 }} size="small"
            options={managerOptions}
          />

          <Popover content={moreFiltersContent} title={null} trigger="click" placement="bottom">
            <Badge count={filterCount} size="small" offset={[-4, 4]} style={{ background: '#fb4f40' }}>
              <Button icon={<FilterOutlined />} size="small" style={{ borderRadius: 6, color: '#8c8e8f' }} />
            </Badge>
          </Popover>
        </Space>

        <Space size={6}>
          {hasActiveFilters && (
            <Button type="link" size="small"
              onClick={onReset}
              style={{ fontSize: 10.5, color: '#fb4f40', fontWeight: 600, padding: '0 4px' }}>
              Clear filters
            </Button>
          )}

          {!isBrandManager && (
            <Tooltip title="Bulk Import">
              <Button icon={<UploadOutlined />} onClick={onOpenBulkImport}
                size="small"
                style={{ borderRadius: 6, fontWeight: 600, fontSize: 11, borderColor: '#d9e6e9', height: 28 }}>
                Import
              </Button>
            </Tooltip>
          )}

          <Tooltip title="Refresh list">
            <Button
              icon={<ReloadOutlined spin={loading} />}
              onClick={onRefresh}
              size="small"
              style={{ borderRadius: 6, borderColor: '#d9e6e9', height: 28 }}
            />
          </Tooltip>
        </Space>
      </div>

      <div style={{
        display: 'flex', justifyContent: 'flex-end', marginTop: 4,
        fontSize: 10.5, color: '#8c8e8f', fontWeight: 500,
      }}>
        Showing {sellersLength} of {totalItems} storefronts
      </div>
    </div>
  );
};

export default SellerToolbar;
