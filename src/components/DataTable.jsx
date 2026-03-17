import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
  Download,
  MoreVertical,
  Inbox,
  LayoutGrid,
  Activity
} from 'lucide-react';

const DataTable = ({
  data = [],
  columns = [],
  title = 'Data Table',
  searchable = false,
  sortable = false,
  pagination = false,
  pageSize = 10,
  compact = false,
  actions = null,
  customRenderers = {},
  onRowClick = null
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Reset page when data or search changes
  useEffect(() => {
    setCurrentPage(1);
    setIsLoading(false);
  }, [data, searchTerm]);

  const filteredAndSortedData = useMemo(() => {
    let result = [...data];

    // Search logic
    if (searchTerm) {
      result = result.filter(item =>
        Object.values(item).some(val =>
          String(val).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Sort logic
    if (sortConfig.key && sortable) {
      result.sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];

        // Custom numeric handling
        const numA = parseFloat(String(valA).replace(/[₹,%x]/g, ''));
        const numB = parseFloat(String(valB).replace(/[₹,%x]/g, ''));

        if (!isNaN(numA) && !isNaN(numB)) {
          return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
        }

        const strA = String(valA || '').toLowerCase();
        const strB = String(valB || '').toLowerCase();

        if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [data, searchTerm, sortConfig, sortable]);

  const totalPages = Math.ceil(filteredAndSortedData.length / pageSize);

  const displayData = useMemo(() => {
    if (!pagination) return filteredAndSortedData;
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedData.slice(start, start + pageSize);
  }, [filteredAndSortedData, pagination, currentPage, pageSize]);

  const headers = useMemo(() => {
    if (columns.length > 0) return columns;
    if (data.length > 0) return Object.keys(data[0]).filter(k => k !== 'id');
    return [];
  }, [columns, data]);

  const handleSort = (key) => {
    if (!sortable) return;
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const isNumeric = (val) => {
    if (typeof val === 'number') return true;
    if (typeof val !== 'string') return false;
    return /^₹?[\d,]+(\.\d+)?%?x?$/.test(val.trim());
  };

  const formatHeader = (column) => {
    return column
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^./, str => str.toUpperCase());
  };

  const getSortIcon = (col) => {
    if (sortConfig.key !== col) return <ArrowUpDown size={12} className="ms-2 opacity-30 text-muted" />;
    return sortConfig.direction === 'asc'
      ? <ArrowUp size={12} className="ms-2 text-primary scale-up" />
      : <ArrowDown size={12} className="ms-2 text-primary scale-up" />;
  };

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center p-5" style={{ minHeight: '200px' }}>
        <div className="pulse-loader"></div>
      </div>
    );
  }

  return (
    <div className={`enhanced-datatable glass-card overflow-hidden ${compact ? 'compact-mode' : ''}`} style={{ borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
      {!compact && (
        <div className="d-flex justify-content-between align-items-center px-4 py-3 bg-white bg-opacity-10 border-bottom border-light">
          <h6 className="mb-0 fw-800 text-dark d-flex align-items-center gap-2">
            <LayoutGrid size={16} className="text-secondary" />
            {title}
          </h6>
          <div className="d-flex align-items-center gap-3">
            {searchable && (
              <div className="search-input-wrapper glass-element d-flex align-items-center px-3 py-1 rounded-pill" style={{ backgroundColor: 'rgba(0,0,0,0.03)' }}>
                <Search size={14} className="text-muted me-2" />
                <input
                  type="text"
                  className="border-0 bg-transparent smallest fw-600 outline-none mt-1"
                  placeholder="Universal Filter..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ width: '150px' }}
                />
              </div>
            )}
            {Array.isArray(actions) ? (
              <div className="d-flex align-items-center gap-2">
                {actions.map((action, idx) => (
                  <button
                    key={idx}
                    className={`btn ${action.className || 'btn-sm btn-light'} d-flex align-items-center gap-2`}
                    onClick={() => action.onClick && action.onClick()}
                    title={action.label}
                  >
                    {action.icon && (
                      action.icon.startsWith('bi-') ? (
                        <i className={`bi ${action.icon}`}></i>
                      ) : (
                        action.icon // Assume it's a React component if not a string starting with bi-
                      )
                    )}
                    <span className="d-none d-md-inline">{action.label}</span>
                  </button>
                ))}
              </div>
            ) : (
              actions
            )}
          </div>
        </div>
      )}

      <div className="table-responsive">
        <table className="table table-hover mb-0">
          <thead>
            <tr className="bg-light bg-opacity-50">
              {headers.map((col, idx) => (
                <th
                  key={idx}
                  onClick={() => handleSort(col)}
                  className={`px-4 py-3 border-0 text-muted smallest fw-800 text-uppercase tracking-wider ${isNumeric(data[0]?.[col]) ? 'text-end' : 'text-start'}`}
                  style={{ cursor: sortable ? 'pointer' : 'default', whiteSpace: 'nowrap' }}
                >
                  <div className={`d-flex align-items-center ${isNumeric(data[0]?.[col]) ? 'justify-content-end' : 'justify-content-start'}`}>
                    {formatHeader(col)}
                    {sortable && getSortIcon(col)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="border-top-0">
            {displayData.length > 0 ? (
              displayData.map((item, rowIdx) => (
                <tr 
                  key={rowIdx} 
                  className={`transition-base hover-table-row ${onRowClick ? 'cursor-pointer' : ''}`}
                  onClick={() => onRowClick && onRowClick(item)}
                >
                  {headers.map((col, colIdx) => (
                    <td
                      key={colIdx}
                      className={`px-4 py-3 border-0 border-bottom border-light align-middle fw-600 ${isNumeric(item[col]) ? 'text-end tabular-nums' : 'text-start'}`}
                      style={{ fontSize: '12px', color: '#1e293b' }}
                    >
                      {customRenderers[col]
                        ? customRenderers[col](item)
                        : (typeof item[col] === 'object' && item[col] !== null && !React.isValidElement(item[col])
                          ? JSON.stringify(item[col])
                          : item[col])
                      }
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={headers.length} className="text-center py-5">
                  <div className="d-flex flex-column align-items-center text-muted opacity-50">
                    <Inbox size={48} strokeWidth={1} className="mb-3" />
                    <span className="smallest fw-700">NO RECORDS CAPTURED</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pagination && filteredAndSortedData.length > 0 && (
        <div className="px-4 py-3 d-flex justify-content-between align-items-center bg-white bg-opacity-5 border-top border-light">
          <div className="smallest fw-700 text-muted d-flex align-items-center gap-2">
            <Activity size={14} className="opacity-50" />
            SHOWING {displayData.length} OF {filteredAndSortedData.length} NODES
          </div>

          {totalPages > 1 && (
            <div className="d-flex align-items-center gap-3">
              <span className="smallest fw-800 text-secondary">
                PAGE <span className="text-dark bg-light px-2 py-1 rounded-2">{currentPage}</span> / {totalPages}
              </span>
              <div className="d-flex gap-1">
                <button
                  className="btn btn-icon-sm glass-element rounded-3 p-1 transition-base"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  style={{ opacity: currentPage === 1 ? 0.3 : 1 }}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  className="btn btn-icon-sm glass-element rounded-3 p-1 transition-base"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  style={{ opacity: currentPage === totalPages ? 0.3 : 1 }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DataTable;
