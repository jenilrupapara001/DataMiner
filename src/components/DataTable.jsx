import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  ChevronLeft,
  ChevronRight,
  Download,
  Inbox,
  LayoutGrid,
  Activity,
  Eye,
  EyeOff,
  Check,
  X
} from 'lucide-react';
import EmptyState from './common/EmptyState';

/**
 * Export data to CSV file
 * @param {Array} data - Array of objects to export
 * @param {string} filename - Name of the file (without extension)
 */
export const exportToCsv = (data, filename = 'export') => {
  if (!data || data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        // Escape quotes and wrap in quotes if contains comma
        const stringValue = String(value ?? '');
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};

const DataTable = ({
  data = [],
  columns = [],
  title = 'Data Table',
  searchable = false,
  sortable = false,
  pagination = false,
  pageSize = 10,
  compact = false,
  showSearch = null, // Override: true to show search even in compact, false to hide
  actions = null,
  customRenderers = {},
  onRowClick = null,
  onSelectionChange = null,
  emptyState = null // { icon, title, description, action }
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  // Determine if search should be shown
  const showSearchBar = compact ? (showSearch === true) : (searchable && showSearch !== false);

  // Column visibility - load from sessionStorage
  const storageKey = `datatable_columns_${title}`;
  const [columnVisibility, setColumnVisibility] = useState(() => {
    try {
      const stored = sessionStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Initialize column visibility from columns prop or data
  const headers = useMemo(() => {
    if (columns.length > 0) return columns;
    if (data.length > 0) return Object.keys(data[0]).filter(k => k !== 'id');
    return [];
  }, [columns, data]);

  // Apply column visibility
  const visibleHeaders = useMemo(() => {
    if (columnVisibility === null) return headers;
    return headers.filter(col => columnVisibility[col] !== false);
  }, [headers, columnVisibility]);

  // Save column visibility to sessionStorage
  const saveColumnVisibility = useCallback((visibility) => {
    setColumnVisibility(visibility);
    sessionStorage.setItem(storageKey, JSON.stringify(visibility));
  }, [storageKey]);

  // Toggle column visibility
  const toggleColumn = useCallback((column) => {
    const newVisibility = { ...(columnVisibility || {}), [column]: !columnVisibility?.[column] };
    saveColumnVisibility(newVisibility);
  }, [columnVisibility, saveColumnVisibility]);

  // Reset column visibility
  const resetColumns = useCallback(() => {
    sessionStorage.removeItem(storageKey);
    setColumnVisibility(null);
  }, [storageKey]);

  // Reset page when data or search changes
  useEffect(() => {
    setCurrentPage(1);
    setIsLoading(false);
  }, [data, searchTerm]);

  // Clear selection when data changes
  useEffect(() => {
    setSelectedRows(new Set());
    onSelectionChange?.([]);
  }, [data]);

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

    // Filter by visible columns
    if (columnVisibility !== null) {
      result = result.map(item => {
        const filtered = {};
        Object.keys(item).forEach(key => {
          if (columnVisibility[key] !== false) {
            filtered[key] = item[key];
          }
        });
        return filtered;
      });
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
  }, [data, searchTerm, sortConfig, sortable, columnVisibility]);

  const totalPages = Math.ceil(filteredAndSortedData.length / pageSize);

  const displayData = useMemo(() => {
    if (!pagination) return filteredAndSortedData;
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedData.slice(start, start + pageSize);
  }, [filteredAndSortedData, pagination, currentPage, pageSize]);

  const handleSort = (key) => {
    if (!sortable) return;
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Fixed numeric detection - only true if entire cell is a number or currency
  const isNumeric = (val) => {
    if (val === null || val === undefined || val === '') return false;
    if (typeof val === 'number') return true;
    if (typeof val !== 'string') return false;
    const cleaned = String(val).replace(/[₹,%]/g, '');
    return val !== null && val !== '' && !isNaN(parseFloat(cleaned)) && /^[₹d,. %x]+$/.test(String(val).trim());
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

  // Row selection handlers
  const handleSelectAll = useCallback(() => {
    if (selectedRows.size === displayData.length) {
      setSelectedRows(new Set());
      onSelectionChange?.([]);
    } else {
      const allIds = new Set(displayData.map((_, idx) => idx));
      setSelectedRows(allIds);
      onSelectionChange?.(displayData);
    }
  }, [displayData, selectedRows.size, onSelectionChange]);

  const handleSelectRow = useCallback((rowIndex) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(rowIndex)) {
      newSelected.delete(rowIndex);
    } else {
      newSelected.add(rowIndex);
    }
    setSelectedRows(newSelected);
    onSelectionChange?.(displayData.filter((_, idx) => newSelected.has(idx)));
  }, [displayData, selectedRows, onSelectionChange]);

  // Get unique row ID for selection
  const getRowId = useCallback((item, index) => {
    return item.id ?? item._id ?? item.uuid ?? item.key ?? index;
  }, []);

  const isAllSelected = displayData.length > 0 && selectedRows.size === displayData.length;

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center p-5" style={{ minHeight: '200px' }}>
        <div className="pulse-loader"></div>
      </div>
    );
  }

  // Check if search filtered to 0 results
  const isSearchEmpty = searchTerm && filteredAndSortedData.length === 0;

  return (
    <div className={`enhanced-datatable border border-gray-100 bg-white overflow-hidden shadow-sm ${compact ? 'compact-mode' : ''}`} style={{ borderRadius: '8px', position: 'relative' }}>
      {/* Header */}
      {(!compact || showSearchBar) && (
        <div className="d-flex justify-content-between align-items-center px-4 py-3 border-bottom border-gray-100">
          <div className="d-flex align-items-center gap-2">
            <LayoutGrid size={16} className="text-muted" />
            <h6 className="mb-0 smallest fw-600 text-dark text-uppercase tracking-wider">
              {title}
            </h6>
          </div>
          <div className="d-flex align-items-center gap-3">
            {showSearchBar && (
              <div className="ads-search-box border-gray-100">
                <Search size={14} className="text-muted" />
                <input
                  type="text"
                  className="form-input border-0 p-0 shadow-none bg-transparent"
                  placeholder="Filter data..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ width: '180px' }}
                />
                {searchTerm && (
                  <X
                    size={12}
                    className="text-muted cursor-pointer"
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSearchTerm('')}
                  />
                )}
              </div>
            )}

            {/* Column visibility toggle */}
            <div style={{ position: 'relative' }}>
              <button
                className="btn btn-sm btn-secondary d-flex align-items-center gap-2"
                onClick={() => setShowColumnMenu(!showColumnMenu)}
                title="Toggle columns"
              >
                <Eye size={14} className="text-muted" />
                <span className="d-none d-md-inline">COLUMNS</span>
              </button>

              {showColumnMenu && (
                <div className="border border-gray-200 shadow-lg bg-white" style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '6px',
                  borderRadius: '6px',
                  minWidth: '200px',
                  zIndex: 100,
                  maxHeight: '320px',
                  overflowY: 'auto'
                }}>
                  <div style={{
                    padding: '10px 14px',
                    borderBottom: '1px solid #f1f5f9',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span className="smallest fw-600 text-muted">VISIBLE COLUMNS</span>
                    <button
                      onClick={resetColumns}
                      className="border-0 bg-transparent text-primary smallest fw-600"
                    >
                      Reset
                    </button>
                  </div>
                  <div className="p-1">
                    {headers.map((col) => (
                      <label
                        key={col}
                        className="d-flex align-items-center gap-2 px-3 py-2 rounded-1 cursor-pointer transition-base"
                        style={{ fontSize: '12px' }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <input
                          type="checkbox"
                          checked={columnVisibility?.[col] !== false}
                          onChange={() => toggleColumn(col)}
                          className="form-check-input mt-0"
                          style={{ width: '14px', height: '14px' }}
                        />
                        <span className="fw-500 text-dark">{formatHeader(col)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {Array.isArray(actions) ? (
              <div className="d-flex align-items-center gap-2">
                {actions.map((action, idx) => (
                  <button
                    key={idx}
                    className={`btn btn-sm btn-secondary ${action.className || ''}`}
                    onClick={() => action.onClick && action.onClick()}
                    title={action.label}
                  >
                    {action.icon && (
                      typeof action.icon === 'string' && action.icon.startsWith('bi-') ? (
                        <i className={`bi ${action.icon}`}></i>
                      ) : (
                        action.icon
                      )
                    )}
                    <span className="d-none d-md-inline text-uppercase">{action.label}</span>
                  </button>
                ))}
              </div>
            ) : (
              actions
            )}
          </div>
        </div>
      )}

      {/* Floating action bar for selected rows */}
      {onSelectionChange && selectedRows.size > 0 && (
        <div className="bg-primary text-white shadow-lg" style={{
          position: 'absolute',
          bottom: pagination ? '70px' : '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '8px 16px',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          zIndex: 40
        }}>
          <span className="smallest fw-600">
            {selectedRows.size} ITEMS SELECTED
          </span>
          <div className="d-flex gap-2">
            <button
              className="btn btn-sm btn-link text-white text-decoration-none p-0 smallest fw-600"
              onClick={() => {
                const selectedData = displayData.filter((_, idx) => selectedRows.has(idx));
                exportToCsv(selectedData, title);
              }}
            >
              <Download size={14} className="me-1" /> EXPORT
            </button>
            <div className="bg-white opacity-20" style={{ width: '1px' }}></div>
            <button
              className="btn btn-sm btn-link text-white text-decoration-none p-0 smallest fw-600"
              onClick={() => {
                const selectedData = displayData.filter((_, idx) => selectedRows.has(idx));
                actions?.find(a => a.label === 'Delete')?.onClick?.(selectedData);
              }}
            >
              <X size={14} className="me-1" /> DELETE
            </button>
          </div>
        </div>
      )}

      <div className="table-responsive">
        <table className="table table-hover mb-0">
          <thead>
            <tr className="bg-gray-50 border-bottom border-gray-100">
              {/* Checkbox column for selection */}
              {onSelectionChange && (
                <th className="px-4 py-2 border-bottom border-gray-100" style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleSelectAll}
                    className="form-check-input mt-0"
                    style={{ width: '14px', height: '14px' }}
                  />
                </th>
              )}
              {visibleHeaders.map((col, idx) => (
                <th
                  key={idx}
                  onClick={() => handleSort(col)}
                  className={`px-4 py-2 border-bottom border-gray-100 text-muted smallest fw-600 text-uppercase tracking-wider ${isNumeric(data[0]?.[col]) ? 'text-end' : 'text-start'}`}
                  style={{ cursor: sortable ? 'pointer' : 'default', whiteSpace: 'nowrap' }}
                >
                  <div className={`d-flex align-items-center gap-1 ${isNumeric(data[0]?.[col]) ? 'justify-content-end' : 'justify-content-start'}`}>
                    {formatHeader(col)}
                    {sortable && getSortIcon(col)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="border-top-0">
            {isSearchEmpty ? (
              <tr>
                <td colSpan={visibleHeaders.length + (onSelectionChange ? 1 : 0)}>
                  <EmptyState
                    title="No results found"
                    description={`No records match your search for "${searchTerm}"`}
                    icon={Search}
                  />
                </td>
              </tr>
            ) : displayData.length > 0 ? (
              displayData.map((item, rowIdx) => {
                const rowId = getRowId(item, rowIdx);
                const isSelected = selectedRows.has(rowIdx);
                return (
                  <tr
                    key={rowId}
                    className={`transition-base hover-table-row ${onRowClick ? 'cursor-pointer' : ''} ${isSelected ? 'bg-primary bg-opacity-10' : ''}`}
                    onClick={() => onRowClick && onRowClick(item)}
                    style={isSelected ? { backgroundColor: 'var(--color-brand-50, #eff6ff)' } : {}}
                  >
                    {/* Checkbox for row selection */}
                    {onSelectionChange && (
                      <td className="px-4 py-3 border-0 border-bottom" style={{ width: '40px' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectRow(rowIdx)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ accentColor: 'var(--color-brand-500)' }}
                        />
                      </td>
                    )}
                    {visibleHeaders.map((col, colIdx) => (
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
                );
              })
            ) : (
              <tr>
                <td colSpan={visibleHeaders.length + (onSelectionChange ? 1 : 0)} className="text-center py-5">
                  {emptyState ? (
                    <EmptyState
                      icon={emptyState.icon}
                      title={emptyState.title}
                      description={emptyState.description}
                      action={emptyState.action}
                    />
                  ) : (
                    <div className="d-flex flex-column align-items-center text-muted opacity-50">
                      <Inbox size={48} strokeWidth={1} className="mb-3" />
                      <span className="smallest fw-700">NO RECORDS CAPTURED</span>
                    </div>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pagination && filteredAndSortedData.length > 0 && (
        <div className="px-4 py-3 d-flex justify-content-between align-items-center bg-gray-50 border-top border-gray-100">
          <div className="smallest fw-600 text-muted d-flex align-items-center gap-2">
            <Activity size={14} className="opacity-50" />
            SHOWING {displayData.length} OF {filteredAndSortedData.length} NODES
          </div>

          {totalPages > 1 && (
            <div className="d-flex align-items-center gap-3">
              <span className="smallest fw-600 text-muted">
                PAGE <span className="text-dark fw-700">{currentPage}</span> / {totalPages}
              </span>
              <div className="d-flex gap-1">
                <button
                  className="btn btn-sm btn-secondary p-1"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  style={{ opacity: currentPage === 1 ? 0.4 : 1 }}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  className="btn btn-sm btn-secondary p-1"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  style={{ opacity: currentPage === totalPages ? 0.4 : 1 }}
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
