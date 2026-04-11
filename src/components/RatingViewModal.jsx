import React, { useState, useMemo } from 'react';
import { X, TrendingUp, TrendingDown, Filter, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { createPortal } from 'react-dom';

const RatingViewModal = ({ asins, selectedAsin, isOpen, onClose }) => {
  const [dateFilter, setDateFilter] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [expandedWeeks, setExpandedWeeks] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const asinsToProcess = selectedAsin ? [selectedAsin] : (Array.isArray(asins) ? asins : []);

  const getFilteredDates = () => {
    const now = new Date();
    let startDate = null;
    let endDate = now;

    if (dateFilter === 'custom' && customStartDate && customEndDate) {
      startDate = new Date(customStartDate);
      endDate = new Date(customEndDate);
    } else if (dateFilter === '7days') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (dateFilter === '14days') {
      startDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    } else if (dateFilter === '30days') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return { startDate, endDate };
  };

  const handleCustomDateChange = (field, value) => {
    const selectedDate = new Date(value);
    const today = new Date();
    const diffDays = Math.ceil((today - selectedDate) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return;
    
    if (field === 'startDate') {
      setCustomStartDate(value);
      if (customEndDate) {
        const endDate = new Date(customEndDate);
        const daysDiff = Math.ceil((endDate - selectedDate) / (1000 * 60 * 60 * 24));
        if (daysDiff > 7) {
          const maxStartDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
          setCustomStartDate(maxStartDate.toISOString().split('T')[0]);
        }
      }
    } else {
      setCustomEndDate(value);
      if (customStartDate) {
        const startDate = new Date(customStartDate);
        const daysDiff = Math.ceil((selectedDate - startDate) / (1000 * 60 * 60 * 24));
        if (daysDiff > 7) {
          const minEndDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
          setCustomEndDate(minEndDate.toISOString().split('T')[0]);
        }
      }
    }
  };

  const maxDate = new Date().toISOString().split('T')[0];
  const minDate = new Date(new Date().getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const processRatingData = useMemo(() => {
    if (!asinsToProcess || asinsToProcess.length === 0) return { weeks: [], asins: [] };

    const { startDate, endDate } = getFilteredDates();

    const allDates = new Map();
    
    asinsToProcess.forEach(asin => {
      const history = asin.weekHistory || asin.history || [];
      history.forEach(h => {
        const date = new Date(h.date || h.week);
        if (startDate && date < startDate) return;
        if (endDate && date > endDate) return;
        const dateKey = date.toISOString().split('T')[0];
        if (!allDates.has(dateKey)) {
          allDates.set(dateKey, date);
        }
      });
    });

    const sortedDates = Array.from(allDates.keys()).sort();
    
    const weekMap = new Map();
    sortedDates.forEach(dateKey => {
      const date = new Date(dateKey);
      const weekNum = getWeekNumber(date);
      const weekKey = `W${weekNum}`;
      const year = date.getFullYear();
      const fullWeekKey = `${year}-${weekKey}`;
      
      if (!weekMap.has(fullWeekKey)) {
        weekMap.set(fullWeekKey, {
          weekKey: fullWeekKey,
          shortKey: weekKey,
          year,
          dates: []
        });
      }
      weekMap.get(fullWeekKey).dates.push({
        dateKey,
        date
      });
    });

    const weeks = Array.from(weekMap.values()).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return parseInt(a.shortKey.slice(1)) - parseInt(b.shortKey.slice(1));
    });

    const asinsData = asinsToProcess.map(asin => {
      const history = asin.weekHistory || asin.history || [];
      const historyMap = new Map();
      history.forEach(h => {
        const dateKey = new Date(h.date || h.week).toISOString().split('T')[0];
        historyMap.set(dateKey, { rating: h.rating, reviewCount: h.reviewCount });
      });

      const weekData = {};
      weeks.forEach(week => {
        week.dates.forEach(d => {
          const data = historyMap.get(d.dateKey);
          if (data && data.rating !== undefined) {
            if (!weekData[week.weekKey]) weekData[week.weekKey] = {};
            weekData[week.weekKey][d.dateKey] = data;
          }
        });
      });

      return {
        asinCode: asin.asinCode,
        title: asin.title,
        currentRating: asin.rating || 0,
        reviewCount: asin.reviewCount || 0,
        weekData
      };
    });

    return { weeks, asins: asinsData };
  }, [asins, selectedAsin, dateFilter]);

  function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  const toggleWeek = (weekKey) => {
    setExpandedWeeks(prev => ({
      ...prev,
      [weekKey]: !prev[weekKey]
    }));
  };

  if (!isOpen) return null;

  const { weeks, asins: asinsData } = processRatingData;

  // Pagination
  const totalItems = asinsData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedAsins = asinsData.slice(startIndex, endIndex);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  return createPortal(
    <div 
      className="position-fixed top-0 bottom-0 start-0 end-0 d-flex align-items-center justify-content-center p-2"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <style>{`
        .rating-modal-fade { animation: ratingModalFade 0.25s ease-out; }
        @keyframes rating-modal-fade { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .week-toggle { cursor: pointer; user-select: none; }
        .week-toggle:hover { background-color: #fffbeb; }
        .day-cell { font-size: 0.75rem; }
        .week-header { background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); }
        .day-header { background: #fffaf0; }
      `}</style>
      
      <div 
        className="bg-white rounded-3 shadow-lg overflow-hidden"
        style={{ 
          width: '100%', 
          maxWidth: '100vw', 
          maxHeight: '95vh',
          animation: 'rating-modal-fade 0.25s ease-out'
        }}
      >
        <div className="p-4 border-bottom bg-gradient-to-r from-amber-50 to-orange-50 d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Star size={24} className="text-amber-600" />
            </div>
            <div>
              <h4 className="mb-0 fw-bold text-slate-800">Rating History - Day Wise</h4>
              <p className="mb-0 text-muted small">Week-over-week rating tracking by day</p>
            </div>
          </div>
          <div className="d-flex align-items-center gap-3">
            <div className="d-flex align-items-center gap-2">
              <Filter size={16} className="text-muted" />
              <select 
                className="form-select form-select-sm"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                style={{ width: '150px' }}
              >
                <option value="all">All Time</option>
                <option value="7days">Last 7 Days</option>
                <option value="14days">Last 14 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="custom">Custom Range</option>
              </select>
              {dateFilter === 'custom' && (
                <div className="d-flex align-items-center gap-1 ms-2">
                  <input 
                    type="date" 
                    className="form-control form-control-sm"
                    value={customStartDate}
                    onChange={(e) => handleCustomDateChange('startDate', e.target.value)}
                    min={minDate}
                    max={maxDate}
                    style={{ width: '130px' }}
                  />
                  <span className="text-muted">to</span>
                  <input 
                    type="date" 
                    className="form-control form-control-sm"
                    value={customEndDate}
                    onChange={(e) => handleCustomDateChange('endDate', e.target.value)}
                    min={customStartDate || minDate}
                    max={maxDate}
                    style={{ width: '130px' }}
                  />
                  <span className="badge bg-info small">Max 7 days</span>
                </div>
              )}
            </div>
            <button onClick={onClose} className="btn btn-light rounded-circle p-2">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="overflow-auto" style={{ maxHeight: 'calc(95vh - 80px)' }}>
          <table className="table table-bordered table-hover mb-0" style={{ minWidth: '1200px' }}>
            <thead className="position-sticky top-0 bg-white z-index-1">
              <tr>
                <th rowSpan={2} className="px-3 py-3" style={{ minWidth: '120px', background: '#f8fafc' }}>
                  ASIN
                </th>
                <th rowSpan={2} className="px-3 py-3 text-center" style={{ minWidth: '80px', background: '#f8fafc' }}>
                  Rating
                </th>
                <th rowSpan={2} className="px-3 py-3 text-center" style={{ minWidth: '80px', background: '#f8fafc' }}>
                  Reviews
                </th>
                {weeks.map(week => (
                  <React.Fragment key={week.weekKey}>
                    <th 
                      colSpan={week.dates.length} 
                      className="px-2 py-2 text-center week-header week-toggle"
                      onClick={() => toggleWeek(week.weekKey)}
                      style={{ minWidth: `${week.dates.length * 80}px` }}
                    >
                      {week.shortKey} {expandedWeeks[week.weekKey] ? '▼' : '▶'}
                    </th>
                  </React.Fragment>
                ))}
              </tr>
              <tr>
                {weeks.map(week => (
                  week.dates.map(d => (
                    <th 
                      key={d.dateKey} 
                      className="px-1 py-1 text-center day-header day-cell"
                      style={{ minWidth: '70px', fontSize: '0.7rem' }}
                    >
                      {d.date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </th>
                  ))
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedAsins.map((item, idx) => (
                <tr key={idx} className="border-bottom">
                  <td className="px-3 py-2">
                    <div className="d-flex flex-column">
                      <span className="fw-medium font-monospace" style={{ fontSize: '0.85rem' }}>
                        {item.asinCode}
                      </span>
                      <span className="text-muted text-truncate" style={{ maxWidth: '120px', fontSize: '0.7rem' }}>
                        {item.title}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="d-flex align-items-center justify-content-center gap-1">
                      <Star size={12} className="text-warning fill-warning" />
                      <span className="fw-semibold text-warning">{item.currentRating.toFixed(1)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="text-muted">{item.reviewCount.toLocaleString()}</span>
                  </td>
                  {weeks.map(week => (
                    week.dates.map(d => {
                      const data = item.weekData?.[week.weekKey]?.[d.dateKey];
                      return (
                        <td 
                          key={`${week.weekKey}-${d.dateKey}`} 
                          className="px-1 py-2 text-center day-cell"
                          style={{ backgroundColor: '#f9fafb' }}
                        >
                          {data && data.rating !== undefined ? (
                            <div className="d-flex align-items-center justify-content-center gap-1">
                              <Star size={10} className="text-warning fill-warning" />
                              <span className="text-warning fw-medium">{data.rating.toFixed(1)}</span>
                            </div>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                      );
                    })
                  ))}
                </tr>
              ))}
              {asinsData.length === 0 && (
                <tr>
                  <td colSpan={3 + weeks.reduce((sum, w) => sum + w.dates.length, 0)} className="text-center py-5 text-muted">
                    No rating data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-top bg-light d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-2">
            <span className="text-muted small">Show</span>
            <select 
              className="form-select form-select-sm"
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              style={{ width: '70px' }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-muted small">entries</span>
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="text-muted small">
              Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems}
            </span>
            <div className="d-flex align-items-center gap-1">
              <button 
                className="btn btn-sm btn-outline-secondary"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={i}
                    className={`btn btn-sm ${currentPage === pageNum ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => handlePageChange(pageNum)}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button 
                className="btn btn-sm btn-outline-secondary"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-dark fw-medium px-4">
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default RatingViewModal;