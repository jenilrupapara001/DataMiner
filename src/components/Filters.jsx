import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Calendar, Search, Filter, X, RotateCcw } from 'lucide-react';

const Filters = ({
  filters,
  onFilterChange,
  showDateRange = true,
  showCategory = true,
  showSearch = true,
  showCampaignType = false,
  showStatus = false
}) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [customStart, setCustomStart] = useState(null);
  const [customEnd, setCustomEnd] = useState(null);
  const [dateRangeMode, setDateRangeMode] = useState('month');

  const handleMonthChange = (e) => {
    const month = parseInt(e.target.value);
    setSelectedMonth(month);
    setDateRangeMode('month');
    const firstDay = new Date(selectedYear, month, 1);
    const lastDay = new Date(selectedYear, month + 1, 0);
    onFilterChange({ 
      dateRange: 'month', 
      startDate: firstDay.toISOString().split('T')[0], 
      endDate: lastDay.toISOString().split('T')[0] 
    });
  };

  const handleYearChange = (e) => {
    const year = parseInt(e.target.value);
    setSelectedYear(year);
    setDateRangeMode('month');
    const firstDay = new Date(year, selectedMonth, 1);
    const lastDay = new Date(year, selectedMonth + 1, 0);
    onFilterChange({ 
      dateRange: 'month', 
      startDate: firstDay.toISOString().split('T')[0], 
      endDate: lastDay.toISOString().split('T')[0] 
    });
  };

  const handleCustomRange = (update) => {
    const [start, end] = update;
    setCustomStart(start);
    setCustomEnd(end);
    if (start && end) {
      setDateRangeMode('custom');
      onFilterChange({ 
        dateRange: 'custom', 
        startDate: start.toISOString().split('T')[0], 
        endDate: end.toISOString().split('T')[0] 
      });
    }
  };

  const clearCustom = () => {
    setDateRangeMode('month');
    setCustomStart(null);
    setCustomEnd(null);
    const firstDay = new Date(selectedYear, selectedMonth, 1);
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0);
    onFilterChange({ 
      dateRange: 'month', 
      startDate: firstDay.toISOString().split('T')[0], 
      endDate: lastDay.toISOString().split('T')[0] 
    });
  };

  const handleReset = () => {
    setSelectedMonth(new Date().getMonth());
    setSelectedYear(new Date().getFullYear());
    setCustomStart(null);
    setCustomEnd(null);
    setDateRangeMode('month');
    const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const lastDay = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
    onFilterChange({
      dateRange: 'month',
      startDate: firstDay.toISOString().split('T')[0],
      endDate: lastDay.toISOString().split('T')[0],
      category: 'all',
      searchTerm: '',
      campaignType: 'all',
      status: 'all'
    });
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-4 p-4 shadow-sm mb-4">
      <div className="row g-3 align-items-end">
        {showSearch && (
          <div className="col-lg-4">
            <label className="smallest fw-bolder text-zinc-500 mb-2 d-flex align-items-center gap-1.5 text-uppercase letter-spacing-05">
              <Search size={12} /> Search Records
            </label>
            <div className="bg-zinc-50 border border-zinc-200 rounded-3 px-3 py-2 d-flex align-items-center focus-within-ring transition-base">
              <input
                type="text"
                className="border-0 bg-transparent flex-grow-1 smallest fw-600 text-zinc-700 outline-none"
                placeholder="SKU, ASIN, or Title..."
                value={filters.searchTerm || ''}
                onChange={(e) => onFilterChange({ searchTerm: e.target.value })}
              />
            </div>
          </div>
        )}

        {showDateRange && (
          <div className="col-lg-5">
            <label className="smallest fw-bolder text-zinc-500 mb-2 d-flex align-items-center gap-1.5 text-uppercase letter-spacing-05">
              <Calendar size={12} /> Date Filtering
            </label>
            <div className="bg-white border border-zinc-200 p-1 rounded-3 d-flex align-items-center gap-1 shadow-xs">
              <select 
                className="form-select form-select-sm border-0 smallest fw-700 text-zinc-700 focus-none bg-transparent shadow-none"
                style={{ width: '120px' }}
                value={selectedMonth}
                onChange={handleMonthChange}
              >
                {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m, i) => (
                  <option key={i} value={i}>{m}</option>
                ))}
              </select>
              <select 
                className="form-select form-select-sm border-0 smallest fw-700 text-zinc-700 focus-none bg-transparent shadow-none"
                style={{ width: '80px' }}
                value={selectedYear}
                onChange={handleYearChange}
              >
                {[new Date().getFullYear(), new Date().getFullYear() - 1].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <div className="vr bg-zinc-200 mx-1" style={{ height: '20px' }}></div>
              <div className="px-1 d-flex align-items-center">
                <DatePicker
                  selectsRange
                  startDate={customStart}
                  endDate={customEnd}
                  onChange={handleCustomRange}
                  placeholderText="Custom Range"
                  className="bg-transparent border-0 smallest text-zinc-600 fw-bold"
                  style={{ width: '130px', outline: 'none' }}
                />
                {dateRangeMode === 'custom' && (
                  <X 
                    size={14} 
                    className="text-muted cursor-pointer ms-1" 
                    onClick={clearCustom} 
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {(showCategory || showCampaignType || showStatus) && (
          <div className="col-lg-3 d-flex gap-2">
            {showCategory && (
              <div className="flex-grow-1">
                <label className="smallest fw-bolder text-zinc-500 mb-2 d-block text-uppercase shadow-none">Category</label>
                <select
                  name="category"
                  className="form-select border border-zinc-200 bg-zinc-50 rounded-3 smallest fw-600 py-2 shadow-none"
                  value={filters.category || 'all'}
                  onChange={(e) => onFilterChange({ category: e.target.value })}
                >
                  <option value="all">All Categories</option>
                  {['Electronics', 'Home & Kitchen', 'Sports', 'Books', 'Clothing', 'Toys', 'Beauty', 'Automotive'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            )}
            {showStatus && (
              <div className="flex-grow-1">
                <label className="smallest fw-bolder text-zinc-500 mb-2 d-block text-uppercase shadow-none">Status</label>
                <select
                  name="status"
                  className="form-select border border-zinc-200 bg-zinc-50 rounded-3 smallest fw-600 py-2 shadow-none"
                  value={filters.status || 'all'}
                  onChange={(e) => onFilterChange({ status: e.target.value })}
                >
                  <option value="all">All Status</option>
                  {['Active', 'Paused', 'Ended', 'Draft'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        <div className="col-lg-auto ms-auto d-flex gap-2">
           <button
              className="btn btn-white btn-sm border border-zinc-200 rounded-3 px-3 py-2 d-flex align-items-center gap-2 fw-700 smallest text-zinc-600 transition-base"
              onClick={handleReset}
            >
              <RotateCcw size={14} /> Reset
            </button>
        </div>
      </div>
    </div>
  );
};

export default Filters;
