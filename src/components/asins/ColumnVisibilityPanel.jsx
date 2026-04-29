import React, { useState, useRef, useEffect } from 'react';
import { X, Columns, Check, Eye, EyeOff, RotateCcw, CheckSquare, Square } from 'lucide-react';
import { ALL_COLUMNS, COLUMN_CATEGORIES } from '../../hooks/useColumnVisibility';

const ColumnVisibilityPanel = ({ 
  isOpen, 
  onClose, 
  visibleColumns, 
  onToggle, 
  onToggleCategory,
  onReset,
  onSelectAll,
  visibleCount,
  totalCount
}) => {
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [search, setSearch] = useState('');
  const panelRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose();
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredColumns = ALL_COLUMNS.filter(c => {
    if (categoryFilter !== 'All' && c.category !== categoryFilter) return false;
    if (search && !c.label.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const isCategoryFullyVisible = (category) => {
    const categoryColumns = ALL_COLUMNS.filter(c => c.category === category && !c.required);
    return categoryColumns.every(c => visibleColumns.includes(c.key));
  };

  return (
    <div 
      ref={panelRef}
      className="position-absolute bg-white border rounded-3 shadow-xl d-flex flex-column"
      style={{ 
        top: '100%', 
        right: 0, 
        zIndex: 1050, 
        width: '320px',
        maxHeight: '500px',
        marginTop: '8px',
        animation: 'slideDown 0.15s ease-out'
      }}
    >
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .col-item {
          padding: 6px 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          transition: background 0.1s;
          border-radius: 6px;
          margin: 1px 4px;
        }
        .col-item:hover { background: #f4f4f5; }
        .col-item.required { opacity: 0.6; cursor: not-allowed; }
        .col-item.required:hover { background: transparent; }
        .cat-btn {
          padding: 4px 10px;
          font-size: 10px;
          font-weight: 600;
          border-radius: 20px;
          border: 1.5px solid #e5e7eb;
          background: white;
          color: #71717a;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .cat-btn:hover { border-color: #18181b; color: #18181b; }
        .cat-btn.active { background: #18181b; color: white; border-color: #18181b; }
      `}</style>

      {/* Header */}
      <div className="px-4 py-3 border-bottom d-flex justify-content-between align-items-center">
        <div className="d-flex align-items-center gap-2">
          <Columns size={16} className="text-zinc-500" />
          <span className="fw-bold text-zinc-800" style={{ fontSize: '13px' }}>Columns</span>
          <span className="badge bg-zinc-100 text-zinc-500" style={{ fontSize: '10px' }}>
            {visibleCount}/{totalCount}
          </span>
        </div>
        <button className="btn btn-ghost p-1 rounded-circle border-0" onClick={onClose}>
          <X size={16} className="text-zinc-400" />
        </button>
      </div>

      {/* Quick Actions */}
      <div className="px-4 py-2 border-bottom d-flex gap-2">
        <button 
          className="btn btn-sm btn-outline-secondary rounded-pill d-flex align-items-center gap-1"
          onClick={onSelectAll}
          style={{ fontSize: '10px', padding: '4px 12px' }}
        >
          <CheckSquare size={12} /> Select All
        </button>
        <button 
          className="btn btn-sm btn-outline-secondary rounded-pill d-flex align-items-center gap-1"
          onClick={onReset}
          style={{ fontSize: '10px', padding: '4px 12px' }}
        >
          <RotateCcw size={12} /> Reset
        </button>
      </div>

      {/* Category Pills */}
      <div className="px-3 py-2 d-flex gap-1 flex-wrap" style={{ overflowX: 'auto' }}>
        <button 
          className={`cat-btn ${categoryFilter === 'All' ? 'active' : ''}`}
          onClick={() => setCategoryFilter('All')}
        >
          All
        </button>
        {COLUMN_CATEGORIES.map(cat => (
          <button
            key={cat}
            className={`cat-btn ${categoryFilter === cat ? 'active' : ''}`}
            onClick={() => setCategoryFilter(cat)}
            onDoubleClick={() => onToggleCategory(cat, !isCategoryFullyVisible(cat))}
            title={`Double-click to ${isCategoryFullyVisible(cat) ? 'hide' : 'show'} all ${cat} columns`}
          >
            {cat}
            <span className="ms-1 text-zinc-400" style={{ fontSize: '9px' }}>
              ({ALL_COLUMNS.filter(c => c.category === cat && visibleColumns.includes(c.key)).length}/{ALL_COLUMNS.filter(c => c.category === cat).length})
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-3 py-1">
        <input
          type="text"
          className="form-control form-control-sm rounded-2"
          placeholder="Search columns..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ fontSize: '11px', height: '30px', border: '1.5px solid #e5e7eb' }}
        />
      </div>

      {/* Column List */}
      <div className="flex-grow-1 overflow-auto px-1 py-2" style={{ maxHeight: '300px' }}>
        {filteredColumns.map(col => {
          const isVisible = visibleColumns.includes(col.key);
          const isRequired = col.required;
          
          return (
            <div
              key={col.key}
              className={`col-item ${isRequired ? 'required' : ''}`}
              onClick={() => !isRequired && onToggle(col.key)}
              title={isRequired ? 'This column is required and cannot be hidden' : `Click to ${isVisible ? 'hide' : 'show'}`}
            >
              {/* Checkbox */}
              <div 
                style={{
                  width: '18px', height: '18px', borderRadius: '5px',
                  border: `2px solid ${isVisible ? '#18181b' : '#d1d5db'}`,
                  background: isVisible ? '#18181b' : 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, opacity: isRequired ? 0.5 : 1
                }}
              >
                {isVisible && <Check size={11} color="white" />}
              </div>
              
              {/* Label */}
              <span className={`flex-grow-1 ${isVisible ? 'text-zinc-800 fw-medium' : 'text-zinc-400'}`}>
                {col.label}
              </span>
              
              {/* Visibility Icon */}
              {!isRequired && (
                isVisible ? 
                  <Eye size={12} className="text-zinc-400" /> : 
                  <EyeOff size={12} className="text-zinc-300" />
              )}
              
              {/* Required Badge */}
              {isRequired && (
                <span className="badge bg-zinc-100 text-zinc-400" style={{ fontSize: '8px' }}>Required</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ColumnVisibilityPanel;
