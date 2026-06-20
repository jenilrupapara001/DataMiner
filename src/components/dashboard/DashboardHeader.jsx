import React, { useMemo, memo } from 'react';
import { Select, DatePicker } from 'antd';
import { RefreshCw } from 'lucide-react';
import { useDateRange } from '../../contexts/DateRangeContext';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const DashboardHeader = ({
  filters,
  setFilters,
  userSellers = [],
  managers = [],
  onSync,
  loading
}) => {
  const { startDate, endDate, updateDateRange } = useDateRange();

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters?.sellerId && filters.sellerId !== 'all') count++;
    if (filters?.managerId && filters.managerId !== 'all') count++;
    if (filters?.goalType && filters.goalType !== 'all') count++;
    return count;
  }, [filters]);

  return (
    <>
      <style>{`
        .dash-header-filter .ant-select-selector {
          border-radius: 6px !important;
          border-color: #d9e6e9 !important;
          background: #ffffff !important;
        }
        .dash-header-filter .ant-select:hover .ant-select-selector,
        .dash-header-filter .ant-select-focused .ant-select-selector {
          border-color: #fb4f40 !important;
          box-shadow: 0 0 0 2px rgba(251,79,64,0.08) !important;
        }
        .dash-header-filter .ant-picker {
          border-radius: 6px;
          border-color: #d9e6e9;
          background: #ffffff;
        }
        .dash-header-filter .ant-picker:hover,
        .dash-header-filter .ant-picker-focused {
          border-color: #fb4f40;
          box-shadow: 0 0 0 2px rgba(251,79,64,0.08);
        }
        @keyframes dash-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '12px 0px',
        flexWrap: 'wrap',
      }}>
        <h1 style={{
          margin: 0,
          fontSize: 20,
          fontWeight: 700,
          color: '#121b1e',
          letterSpacing: '-0.3px',
          whiteSpace: 'nowrap',
        }}>
          Dashboard
        </h1>

        <div className="dash-header-filter" style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}>
          <RangePicker
            value={[dayjs(startDate), dayjs(endDate)]}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                updateDateRange({
                  startDate: dates[0].toDate(),
                  endDate: dates[1].toDate(),
                  rangeType: 'custom',
                });
                setFilters(prev => ({
                  ...prev,
                  dateRange: { start: dates[0].toDate(), end: dates[1].toDate() }
                }));
              }
            }}
            size="middle"
            style={{ minWidth: 240 }}
            separator={<span style={{ color: '#8c8e8f' }}>—</span>}
          />

          <Select
            value={filters?.sellerId || 'all'}
            onChange={(val) => setFilters(prev => ({ ...prev, sellerId: val }))}
            style={{ minWidth: 140 }}
            placeholder="All Brands"
            options={[
              { value: 'all', label: 'All Brands' },
              ...userSellers.map(s => ({ value: s.id, label: s.name }))
            ]}
          />

          <Select
            value={filters?.managerId || 'all'}
            onChange={(val) => setFilters(prev => ({ ...prev, managerId: val }))}
            style={{ minWidth: 140 }}
            placeholder="All Managers"
            options={[
              { value: 'all', label: 'All Managers' },
              ...managers.map(m => ({ value: m.id, label: m.name }))
            ]}
          />

          <Select
            value={filters?.goalType || 'all'}
            onChange={(val) => setFilters(prev => ({ ...prev, goalType: val }))}
            style={{ minWidth: 120 }}
            placeholder="All Goals"
            options={[
              { value: 'all', label: 'All Goals' },
              { value: 'GMS', label: 'GMS' },
              { value: 'ADS', label: 'ADS' },
              { value: 'ACOS', label: 'ACoS' },
            ]}
          />

          <button
            onClick={onSync}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 32,
              padding: '0 14px',
              background: loading ? '#94a3b8' : '#fb4f40',
              color: '#ffffff',
              border: 'none',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: loading ? 'wait' : 'pointer',
              whiteSpace: 'nowrap',
              transition: 'background 0.15s',
            }}
          >
            <RefreshCw
              size={13}
              style={{ animation: loading ? 'dash-spin 1s linear infinite' : 'none' }}
            />
            {loading ? 'Syncing...' : 'Sync'}
          </button>

          {activeFiltersCount > 0 && (
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#8c8e8f',
              background: '#f4f5f7',
              padding: '2px 8px',
              borderRadius: 4,
            }}>
              {activeFiltersCount} filter{activeFiltersCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    </>
  );
};

export default memo(DashboardHeader);
