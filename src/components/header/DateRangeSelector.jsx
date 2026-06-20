import React, { useState } from 'react';
import { Popover, DatePicker } from 'antd';
import { CalendarOutlined, DownOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useDateRange } from '../../contexts/DateRangeContext';

const { RangePicker } = DatePicker;

const PRESETS = [
  { key: 'today', label: 'Today', getRange: () => [dayjs(), dayjs()] },
  { key: 'yesterday', label: 'Yesterday', getRange: () => [dayjs().subtract(1, 'day'), dayjs().subtract(1, 'day')] },
  { key: 'last7', label: 'Last 7 days', getRange: () => [dayjs().subtract(6, 'day'), dayjs()] },
  { key: 'last30', label: 'Last 30 days', getRange: () => [dayjs().subtract(29, 'day'), dayjs()] },
  { key: 'mtd', label: 'Month to date', getRange: () => [dayjs().startOf('month'), dayjs()] },
  { key: 'lastMonth', label: 'Last month', getRange: () => [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
  { key: 'qtd', label: 'Quarter to date', getRange: () => [dayjs().startOf('quarter'), dayjs()] },
  { key: 'ytd', label: 'Year to date', getRange: () => [dayjs().startOf('year'), dayjs()] },
];

const DateRangeSelector = () => {
  const { startDate, endDate, updateDateRange } = useDateRange();
  const [open, setOpen] = useState(false);


  const currentPreset = PRESETS.find((p) => {
    const [s, e] = p.getRange();
    return dayjs(startDate).isSame(s, 'day') && dayjs(endDate).isSame(e, 'day');
  });

  const formatRange = () => {
    const s = dayjs(startDate);
    const e = dayjs(endDate);
    if (s.isSame(e, 'day')) return s.format('DD MMM YYYY');
    if (s.year() === e.year()) {
      return `${s.format('DD MMM')} – ${e.format('DD MMM YYYY')}`;
    }
    return `${s.format('DD MMM YY')} – ${e.format('DD MMM YY')}`;
  };

  const handlePreset = (preset) => {
    const [s, e] = preset.getRange();
    updateDateRange({ startDate: s.toDate(), endDate: e.toDate(), rangeType: preset.key });
    setOpen(false);
  };

  const content = (
    <div style={{ width: 340, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ padding: '12px 14px 8px', borderBottom: '1px solid #f4f5f7' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#8c8e8f', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
          Quick ranges
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {PRESETS.map((preset) => {
            const [s, e] = preset.getRange();
            const isActive = dayjs(startDate).isSame(s, 'day') && dayjs(endDate).isSame(e, 'day');
            return (
              <button
                key={preset.key}
                onClick={() => handlePreset(preset)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid',
                  borderColor: isActive ? '#fb4f40' : 'transparent',
                  background: isActive ? '#fff0f0' : 'transparent',
                  color: isActive ? '#d94033' : '#545657',
                  fontSize: 12,
                  fontWeight: isActive ? 600 : 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'Inter, sans-serif',
                  transition: 'all 0.12s',
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = '#f4f5f7'; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ padding: '12px 14px' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#8c8e8f', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
          Custom range
        </div>
          <RangePicker
            value={[dayjs(startDate), dayjs(endDate)]}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                updateDateRange({
                  startDate: dates[0].toDate(),
                  endDate: dates[1].toDate(),
                  rangeType: 'custom',
                });
                setOpen(false);
              }
            }}
            getPopupContainer={() => document.body}
            style={{ width: '100%' }}
            size="small"
            separator={<span style={{ color: '#8c8e8f', padding: '0 2px' }}>–</span>}
          />
      </div>
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement="bottomRight"
      arrow={false}
      overlayClassName="date-range-popover"
      overlayInnerStyle={{
        padding: 0,
        borderRadius: 12,
        boxShadow: '0 12px 40px -8px rgba(18,27,30,0.18)',
      }}
    >
      <button className="date-range-trigger">
        <CalendarOutlined className="date-range-icon" />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0 }}>
          <span className="date-range-preset-label">{currentPreset ? currentPreset.label : 'Custom'}</span>
          <span style={{ lineHeight: 1.2, fontSize: 11.5 }}>{formatRange()}</span>
        </div>
        <DownOutlined style={{ fontSize: 9, color: '#8c8e8f' }} />
      </button>
    </Popover>
  );
};

export default DateRangeSelector;
