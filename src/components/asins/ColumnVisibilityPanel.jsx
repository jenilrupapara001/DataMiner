import React, { useState, useEffect, useMemo } from 'react';
import { 
  Drawer, 
  Button, 
  Input, 
  Checkbox, 
  Tag, 
  Space, 
  Typography, 
  Tooltip, 
  Divider,
  Badge,
  Empty
} from 'antd';
import { 
  X, 
  Columns, 
  Search, 
  RotateCcw, 
  CheckSquare, 
  Square,
  Layout,
  Filter,
  ArrowRight
} from 'lucide-react';

const { Text, Title } = Typography;

const ColumnVisibilityPanel = ({ 
  isOpen, 
  onClose, 
  visibleColumns: externalVisibleColumns, 
  onApply,
  allColumns = [],
  columnCategories = []
}) => {
  const [localVisibleColumns, setLocalVisibleColumns] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [search, setSearch] = useState('');

  // Sync with external state when drawer opens
  useEffect(() => {
    if (isOpen) {
      setLocalVisibleColumns([...externalVisibleColumns]);
    }
  }, [isOpen, externalVisibleColumns]);

  const filteredColumns = useMemo(() => {
    return allColumns.filter(c => {
      const matchesCategory = categoryFilter === 'All' || c.category === categoryFilter;
      const matchesSearch = !search || c.label.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [allColumns, categoryFilter, search]);

  const handleToggle = (key) => {
    const col = allColumns.find(c => c.key === key);
    if (col?.required) return;

    setLocalVisibleColumns(prev => 
      prev.includes(key) 
        ? prev.filter(k => k !== key) 
        : [...prev, key]
    );
  };

  const handleSelectAllFiltered = () => {
    const filteredKeys = filteredColumns.map(c => c.key);
    setLocalVisibleColumns(prev => [...new Set([...prev, ...filteredKeys])]);
  };

  const handleDeselectAllFiltered = () => {
    const filteredKeys = filteredColumns.filter(c => !c.required).map(c => c.key);
    setLocalVisibleColumns(prev => prev.filter(k => !filteredKeys.includes(k)));
  };

  const handleReset = () => {
    const defaults = allColumns.filter(c => c.defaultVisible).map(c => c.key);
    setLocalVisibleColumns(defaults);
  };

  const isCategoryFullyVisible = (category) => {
    const catCols = allColumns.filter(c => c.category === category && !c.required);
    return catCols.every(c => localVisibleColumns.includes(c.key));
  };

  const handleToggleCategory = (category) => {
    const makeVisible = !isCategoryFullyVisible(category);
    const catKeys = allColumns.filter(c => c.category === category && !c.required).map(c => c.key);
    
    if (makeVisible) {
      setLocalVisibleColumns(prev => [...new Set([...prev, ...catKeys])]);
    } else {
      setLocalVisibleColumns(prev => prev.filter(k => !catKeys.includes(k)));
    }
  };

  return (
    <Drawer
      title={
        <div className="d-flex align-items-center gap-2">
          <div className="p-2 rounded-3 bg-zinc-100 d-flex align-items-center justify-content-center">
            <Layout size={18} className="text-zinc-600" />
          </div>
          <div>
            <Title level={5} style={{ margin: 0, fontSize: '16px' }}>Column Visibility</Title>
            <Text type="secondary" style={{ fontSize: '12px' }}>Configure your dashboard workspace</Text>
          </div>
        </div>
      }
      placement="right"
      onClose={onClose}
      open={isOpen}
      size={420}
      extra={
        <Space>
          <Tooltip title="Reset to default columns">
            <Button 
              type="text" 
              icon={<RotateCcw size={14} />} 
              onClick={handleReset}
              className="text-zinc-500 hover-text-primary"
            />
          </Tooltip>
          <Button 
            type="text" 
            icon={<X size={18} />} 
            onClick={onClose} 
            className="text-zinc-400"
          />
        </Space>
      }
      closable={false}
      footer={
        <div className="px-3 py-3 d-flex align-items-center justify-content-between bg-zinc-50 rounded-top-4 border-top">
          <div className="d-flex flex-column">
            <Text strong style={{ fontSize: '13px' }}>
              {localVisibleColumns.length} Columns
            </Text>
            <Text type="secondary" style={{ fontSize: '11px' }}>selected for display</Text>
          </div>
          <Space>
            <Button onClick={onClose}>Cancel</Button>
            <Button 
              type="primary" 
              icon={<ArrowRight size={14} />} 
              onClick={() => {
                onApply(localVisibleColumns);
                onClose();
              }}
              style={{
                background: '#18181b',
                borderColor: '#18181b',
                display: 'flex',
                alignItems: 'center',
                flexDirection: 'row-reverse',
                gap: '8px'
              }}
            >
              Apply Changes
            </Button>
          </Space>
        </div>
      }
      styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column' } }}
    >
      <style>{`
        .col-list-item {
          padding: 10px 20px;
          transition: all 0.2s;
          cursor: pointer;
          border-left: 3px solid transparent;
        }
        .col-list-item:hover {
          background: #f8fafc;
          border-left-color: #3b82f6;
        }
        .col-list-item.selected {
          background: #eff6ff;
        }
        .category-pill {
          cursor: pointer;
          transition: all 0.2s;
          border-radius: 100px;
          padding: 4px 12px;
          border: 1px solid #e2e8f0;
          background: white;
          color: #64748b;
          font-size: 11px;
          font-weight: 500;
        }
        .category-pill:hover {
          border-color: #3b82f6;
          color: #3b82f6;
        }
        .category-pill.active {
          background: #18181b;
          border-color: #18181b;
          color: white;
        }
        .search-container {
          padding: 16px 20px;
          background: white;
          position: sticky;
          top: 0;
          z-index: 10;
        }
      `}</style>

      {/* Toolbar */}
      <div className="search-container border-bottom">
        <Input
          prefix={<Search size={14} className="text-zinc-400 me-1" />}
          placeholder="Search for data fields..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          allowClear
          className="rounded-3"
          style={{ height: '40px' }}
        />
        
        <div className="mt-3 d-flex gap-2 overflow-auto pb-1 custom-scrollbar">
          <div 
            className={`category-pill ${categoryFilter === 'All' ? 'active' : ''}`}
            onClick={() => setCategoryFilter('All')}
          >
            All Fields
          </div>
          {columnCategories.map(cat => (
            <div
              key={cat}
              className={`category-pill ${categoryFilter === cat ? 'active' : ''}`}
              onClick={() => setCategoryFilter(cat)}
            >
              {cat}
            </div>
          ))}
        </div>
      </div>

      {/* Action Header */}
      <div className="px-4 py-2 bg-zinc-50 border-bottom d-flex align-items-center justify-content-between">
        <Text type="secondary" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {categoryFilter} Fields ({filteredColumns.length})
        </Text>
        <Space size={16}>
          <Button 
            type="link" 
            size="small" 
            onClick={handleSelectAllFiltered}
            className="p-0 text-primary"
            style={{ fontSize: '11px' }}
          >
            Select All
          </Button>
          <Button 
            type="link" 
            size="small" 
            danger
            onClick={handleDeselectAllFiltered}
            className="p-0"
            style={{ fontSize: '11px' }}
          >
            Clear All
          </Button>
        </Space>
      </div>

      {/* Column List */}
      <div className="flex-grow-1 overflow-auto">
        {filteredColumns.length > 0 ? (
          filteredColumns.map((col, idx) => {
            const isVisible = localVisibleColumns.includes(col.key);
            const isRequired = col.required;
            
            return (
              <div 
                key={col.key}
                className={`col-list-item d-flex align-items-center justify-content-between ${isVisible ? 'selected' : ''}`}
                onClick={() => handleToggle(col.key)}
              >
                <div className="d-flex align-items-center gap-3">
                  <Checkbox 
                    checked={isVisible} 
                    disabled={isRequired}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => handleToggle(col.key)}
                  />
                  <div className="d-flex flex-column">
                    <Text strong={isVisible} style={{ fontSize: '13px', color: isVisible ? '#1e293b' : '#64748b' }}>
                      {col.label}
                    </Text>
                    <Text type="secondary" style={{ fontSize: '10px' }}>
                      {col.category}
                    </Text>
                  </div>
                </div>
                
                {isRequired ? (
                  <Tag color="default" className="m-0 border-0 bg-zinc-200 text-zinc-500" style={{ fontSize: '9px' }}>REQUIRED</Tag>
                ) : (
                  <div className="d-flex align-items-center gap-2">
                    <div style={{ 
                      width: '8px', 
                      height: '8px', 
                      borderRadius: '50%', 
                      background: isVisible ? '#10b981' : '#e2e8f0' 
                    }} />
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="py-5 px-4 text-center">
            <Empty 
              image={Empty.PRESENTED_IMAGE_SIMPLE} 
              description={
                <div className="d-flex flex-column gap-1">
                  <Text type="secondary">No columns matching "{search}"</Text>
                  <Button type="link" size="small" onClick={() => setSearch('')}>Clear search</Button>
                </div>
              }
            />
          </div>
        )}
      </div>
    </Drawer>
  );
};

export default ColumnVisibilityPanel;
