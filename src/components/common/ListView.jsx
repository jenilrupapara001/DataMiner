import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, LayoutGrid, CheckSquare, Square } from 'lucide-react';

const ListView = ({
    columns = [],
    rows = [],
    groupBy = null,
    rowKey = '_id',
    options = {},
    renderGroupHeader = null,
    renderCell = null,
    onRowClick = null,
    actions = null,
    actionWidth = '120px',
    emptyMessage = "No records found"
}) => {
    const [collapsedGroups, setCollapsedGroups] = useState(new Set());
    const [selectedRows, setSelectedRows] = useState(new Set());

    // Grouping logic
    const groupedRows = useMemo(() => {
        if (!groupBy) return [{ group: null, rows }];

        const groups = rows.reduce((acc, row) => {
            const key = typeof groupBy === 'function' ? groupBy(row) : row[groupBy];
            const groupKey = key || 'Unassigned';
            if (!acc[groupKey]) acc[groupKey] = [];
            acc[groupKey].push(row);
            return acc;
        }, {});

        return Object.entries(groups).map(([group, rows]) => ({
            group,
            rows
        }));
    }, [rows, groupBy]);

    const toggleGroup = (group) => {
        const newCollapsed = new Set(collapsedGroups);
        if (newCollapsed.has(group)) {
            newCollapsed.delete(group);
        } else {
            newCollapsed.add(group);
        }
        setCollapsedGroups(newCollapsed);
    };

    const toggleRowSelection = (e, id) => {
        e.stopPropagation();
        const newSelected = new Set(selectedRows);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedRows(newSelected);
    };

    const toggleAllInGroup = (e, groupRows) => {
        e.stopPropagation();
        const groupIds = groupRows.map(r => r[rowKey]);
        const allSelected = groupIds.every(id => selectedRows.has(id));

        const newSelected = new Set(selectedRows);
        if (allSelected) {
            groupIds.forEach(id => newSelected.delete(id));
        } else {
            groupIds.forEach(id => newSelected.add(id));
        }
        setSelectedRows(newSelected);
    };

    return (
        <div className="list-view-container w-100" style={{ borderRadius: '12px', overflow: 'visible' }}>
            {/* Header */}
            <div className="list-view-header d-flex align-items-center bg-white border-bottom px-4 py-3 sticky-top" style={{ zIndex: 10 }}>
                {options.selectable && <div style={{ width: '40px' }} />}
                {columns.map((col, idx) => (
                    <div
                        key={idx}
                        className="smallest fw-bold text-muted text-uppercase tracking-wider"
                        style={{ width: col.width || 'auto', flex: col.width ? 'none' : 1, fontSize: '10px' }}
                    >
                        {col.label}
                    </div>
                ))}
                {actions && <div style={{ width: actionWidth }} />}
            </div>

            {/* Content */}
            <div className="list-view-body bg-white" style={{ overflow: 'visible' }}>
                {groupedRows.length === 0 ? (
                    <div className="p-5 text-center text-muted">
                        <div className="mb-2"><LayoutGrid size={32} className="opacity-25" /></div>
                        <div className="small fw-bold">{emptyMessage}</div>
                    </div>
                ) : (
                    groupedRows.map(({ group, rows: groupRows }, gIdx) => (
                        <div key={gIdx} className="list-group-section">
                            {group !== null && (
                                <div
                                    className="list-group-header d-flex align-items-center px-4 py-2 bg-slate-50 bg-opacity-50 cursor-pointer border-bottom"
                                    onClick={() => toggleGroup(group)}
                                >
                                    <div className="me-2 text-muted">
                                        {collapsedGroups.has(group) ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                                    </div>
                                    {options.selectable && (
                                        <div
                                            className="me-3 text-primary cursor-pointer"
                                            onClick={(e) => toggleAllInGroup(e, groupRows)}
                                        >
                                            {groupRows.every(r => selectedRows.has(r[rowKey])) ? <CheckSquare size={16} /> : <Square size={16} />}
                                        </div>
                                    )}
                                    <div className="flex-grow-1">
                                        {renderGroupHeader ? renderGroupHeader({ group, rows: groupRows }) : (
                                            <span className="text-sm font-semibold text-slate-900">
                                                {group} <span className="text-slate-400 font-normal">({groupRows.length})</span>
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {!collapsedGroups.has(group) && groupRows.map((row, rIdx) => (
                                <div
                                    key={row[rowKey] || rIdx}
                                    className={`list-row d-flex align-items-center px-4 py-3 border-bottom hover-bg-slate transition-all cursor-pointer ${selectedRows.has(row[rowKey]) ? 'bg-blue-50 bg-opacity-30' : ''}`}
                                    onClick={(e) => {
                                        if (e.target.closest('.list-actions')) return;
                                        onRowClick && onRowClick(row);
                                    }}
                                >
                                    {options.selectable && (
                                        <div
                                            className="me-3 text-primary"
                                            onClick={(e) => toggleRowSelection(e, row[rowKey])}
                                        >
                                            {selectedRows.has(row[rowKey]) ? <CheckSquare size={16} /> : <Square size={16} className="opacity-20" />}
                                        </div>
                                    )}

                                    {columns.map((col, cIdx) => (
                                        <div
                                            key={cIdx}
                                            className="list-cell overflow-hidden text-truncate pe-3"
                                            style={{ width: col.width || 'auto', flex: col.width ? 'none' : 1 }}
                                        >
                                            {renderCell ? renderCell(row, col) : (
                                                col.render ? col.render(row[col.key], row) : row[col.key]
                                            )}
                                        </div>
                                    ))}

                                    {actions && (
                                        <div className="list-actions d-flex justify-content-end align-items-center gap-1" style={{ width: actionWidth }}>
                                            {actions(row)}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ))
                )}
            </div>

            <style>{`
                .list-view-container { 
                    border: 1px solid #e2e8f0; 
                    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05); 
                    background: #fff;
                }
                .list-view-header {
                    background-color: #f8fafc !important;
                    border-bottom: 2px solid #f1f5f9 !important;
                    height: 44px;
                }
                .list-group-header {
                    background-color: #f1f5f9 !important;
                    height: 38px;
                }
                .list-row {
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    border-bottom: 1px solid #f1f5f9;
                }
                .list-row:hover {
                    background-color: #f8fafc;
                    transform: translateX(4px);
                    box-shadow: inset 4px 0 0 0 #0070F3;
                }
                .list-row:last-child {
                    border-bottom: none;
                }
                .list-actions {
                    opacity: 0.8;
                    transition: opacity 0.2s ease;
                }
                .list-row:hover .list-actions {
                    opacity: 1;
                }
                .tracking-wider { letter-spacing: 0.05em; }
            `}</style>
        </div>
    );
};

export default ListView;
