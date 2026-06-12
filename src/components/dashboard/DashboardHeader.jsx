import React, { useMemo, memo } from 'react';
import { Select, Tooltip } from 'antd';
import {
    RefreshCw, Activity, Calendar, Building2, Users,
    Target, Sparkles, ChevronRight, Filter, Zap,
    BarChart3, Globe, Clock, TrendingUp
} from 'lucide-react';
import { useDateRange } from '../../contexts/DateRangeContext';
import DateRangePicker from '../common/DateRangePicker';

// ═══════════════════════════════════════════════════════════════
// FILTER PILL WRAPPER
// ═══════════════════════════════════════════════════════════════
const FilterPill = memo(({ icon: Icon, label, color, children, hasValue }) => (
    <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0,
        background: hasValue ? `${color}08` : '#ffffff',
        border: `1px solid ${hasValue ? `${color}30` : '#e2e8f0'}`,
        borderRadius: 10,
        overflow: 'hidden',
        transition: 'all 0.2s',
        position: 'relative'
    }}>
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '0 10px',
            borderRight: `1px solid ${hasValue ? `${color}25` : '#e2e8f0'}`,
            height: 36,
            background: hasValue ? `${color}10` : '#fafbfc'
        }}>
            <Icon size={12} style={{ color: hasValue ? color : '#94a3b8' }} strokeWidth={2.5} />
            <span style={{
                fontSize: 10,
                fontWeight: 800,
                color: hasValue ? color : '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                whiteSpace: 'nowrap'
            }}>
                {label}
            </span>
        </div>
        <div>{children}</div>
    </div>
));

// ═══════════════════════════════════════════════════════════════
// LIVE INDICATOR
// ═══════════════════════════════════════════════════════════════
const LiveIndicator = memo(() => (
    <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        background: '#ecfdf5',
        border: '1px solid #a7f3d0',
        borderRadius: 20,
        fontSize: 10,
        fontWeight: 800,
        color: '#059669',
        whiteSpace: 'nowrap'
    }}>
        <span style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: '#10b981',
            display: 'inline-block',
            position: 'relative'
        }}>
            <span style={{
                position: 'absolute',
                inset: -3,
                borderRadius: '50%',
                border: '2px solid #10b981',
                opacity: 0.5,
                animation: 'live-ripple 2s ease-out infinite'
            }} />
        </span>
        LIVE
    </div>
));

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
const DashboardHeader = ({
    filters,
    setFilters,
    userSellers = [],
    managers = [],
    onSync,
    loading
}) => {
    const { startDate, endDate, updateDateRange } = useDateRange();

    React.useEffect(() => {
        console.log("DIAGNOSTIC - system Date in browser:", new Date().toString());
        console.log("DIAGNOSTIC - context startDate:", startDate, typeof startDate);
        console.log("DIAGNOSTIC - context endDate:", endDate, typeof endDate);
    }, [startDate, endDate]);

    const handleSellerChange = (value) => {
        setFilters(prev => ({ ...prev, sellerId: value }));
    };

    const handleManagerChange = (value) => {
        setFilters(prev => ({ ...prev, managerId: value }));
    };

    const handleGoalTypeChange = (value) => {
        setFilters(prev => ({ ...prev, goalType: value }));
    };

    // Count active filters
    const activeFiltersCount = useMemo(() => {
        let count = 0;
        if (filters?.sellerId && filters.sellerId !== 'all') count++;
        if (filters?.managerId && filters.managerId !== 'all') count++;
        if (filters?.goalType && filters.goalType !== 'all') count++;
        return count;
    }, [filters]);

    // Current time formatted
    const currentTime = useMemo(() => {
        return new Date().toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    }, []);

    const todayDate = useMemo(() => {
        return new Date().toLocaleDateString('en-IN', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    }, []);

    return (
        <>
            <style>{`
                @keyframes live-ripple {
                    0% { transform: scale(1); opacity: 0.6; }
                    100% { transform: scale(2.5); opacity: 0; }
                }
                @keyframes shimmer-logo {
                    0%, 100% { transform: scale(1) rotate(0deg); }
                    50% { transform: scale(1.05) rotate(3deg); }
                }
                .logo-badge {
                    animation: shimmer-logo 3s ease-in-out infinite;
                }
                @keyframes spin-loader {
                    to { transform: rotate(360deg); }
                }
                .sync-button-premium {
                    position: relative;
                    overflow: hidden;
                    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .sync-button-premium::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: -100%;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
                    transition: left 0.5s;
                }
                .sync-button-premium:hover::before {
                    left: 100%;
                }
                .sync-button-premium:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 8px 16px -4px rgba(37,99,235,0.4) !important;
                }
                .sync-button-premium .spin {
                    animation: spin-loader 1s linear infinite;
                }
                .dashboard-header-card {
                    transition: all 0.3s;
                }
                .filter-select-premium .ant-select-selector {
                    border: none !important;
                    background: transparent !important;
                    box-shadow: none !important;
                    padding: 0 8px 0 8px !important;
                    height: 36px !important;
                    display: flex !important;
                    align-items: center !important;
                }
                .filter-select-premium .ant-select-selection-item {
                    line-height: 36px !important;
                    font-size: 12px !important;
                    font-weight: 700 !important;
                    color: #0f172a !important;
                }
                .filter-select-premium .ant-select-arrow {
                    color: #94a3b8 !important;
                }
            `}</style>

            <div
                className="dashboard-header-card"
                style={{
                    background: 'linear-gradient(135deg, #ffffff 0%, #fafbff 100%)',
                    borderRadius: 10,
                    border: '1px solid #e2e8f0',
                    padding: '18px 22px',
                    marginBottom: 24,
                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.02)',
                    position: 'relative',
                    overflow: 'hidden'
                }}
            >
                {/* Decorative background gradient */}
                <div style={{
                    position: 'absolute',
                    top: -50,
                    right: -50,
                    width: 200,
                    height: 200,
                    background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)',
                    borderRadius: '50%',
                    pointerEvents: 'none'
                }} />

                {/* ═══════════════════════════════════════════════════
                    TOP ROW: Title + Actions
                ═══════════════════════════════════════════════════ */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 16,
                    marginBottom: 16,
                    flexWrap: 'wrap',
                    position: 'relative'
                }}>
                    {/* LEFT: Logo + Title */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14
                    }}>
                        {/* <div className="logo-badge" style={{
                            width: 50,
                            height: 50,
                            borderRadius: 14,
                            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 50%, #7c3aed 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            boxShadow: '0 8px 20px -6px rgba(99, 102, 241, 0.5)',
                            position: 'relative',
                            flexShrink: 0
                        }}>
                           
                        <div style={{
                            position: 'absolute',
                            bottom: -2,
                            right: -2,
                            width: 14,
                            height: 14,
                            background: '#10b981',
                            border: '2px solid #ffffff',
                            borderRadius: '50%',
                            boxShadow: '0 0 0 0 rgba(16, 185, 129, 0.4)',
                            animation: 'live-ripple 2s ease-out infinite'
                        }} />
                    </div> */}

                        <div>
                            {/* Breadcrumb */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                marginBottom: 2
                            }}>
                                <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    fontSize: 9,
                                    fontWeight: 800,
                                    color: '#7c3aed',
                                    background: '#f5f3ff',
                                    border: '1px solid #ddd6fe',
                                    padding: '2px 8px',
                                    borderRadius: 10,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.08em'
                                }}>
                                    <Sparkles size={9} strokeWidth={2.5} />
                                    Mission Control
                                </span>
                                <ChevronRight size={10} style={{ color: '#cbd5e1' }} strokeWidth={2.5} />
                                <span style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: '#64748b',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em'
                                }}>
                                    Operations
                                </span>
                            </div>

                            {/* Title */}
                            <h1 style={{
                                margin: 0,
                                fontSize: 22,
                                fontWeight: 800,
                                color: '#0f172a',
                                letterSpacing: '-0.5px',
                                lineHeight: 1.1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10
                            }}>
                                Unified Operations Dashboard
                            </h1>
                        </div>
                    </div>

                    {/* RIGHT: Time + Live + Sync */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        flexWrap: 'wrap'
                    }}>
                        {/* Today's date + time */}
                        <Tooltip title="Current date and time">
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '6px 12px',
                                background: '#ffffff',
                                border: '1px solid #e2e8f0',
                                borderRadius: 10,
                                cursor: 'default'
                            }}>
                                <Clock size={12} style={{ color: '#64748b' }} strokeWidth={2.5} />
                                <span style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: '#0f172a'
                                }}>
                                    {todayDate}
                                </span>
                                <span style={{
                                    fontSize: 10,
                                    color: '#94a3b8',
                                    fontWeight: 600
                                }}>
                                    {currentTime}
                                </span>
                            </div>
                        </Tooltip>

                        {/* Live indicator */}
                        <LiveIndicator />

                        {/* Sync button */}
                        <button
                            onClick={onSync}
                            disabled={loading}
                            className="sync-button-premium"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 7,
                                padding: '8px 16px',
                                background: loading
                                    ? 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)'
                                    : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: 10,
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: loading ? 'wait' : 'pointer',
                                boxShadow: loading
                                    ? 'none'
                                    : '0 4px 12px -2px rgba(37, 99, 235, 0.4)',
                                letterSpacing: '0.02em',
                                height: 36
                            }}
                        >
                            <RefreshCw
                                size={14}
                                strokeWidth={2.5}
                                className={loading ? 'spin' : ''}
                            />
                            {loading ? 'Syncing...' : 'Run Sync'}
                            {!loading && <Zap size={12} strokeWidth={2.5} />}
                        </button>
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════
                    BOTTOM ROW: Filters
                ═══════════════════════════════════════════════════ */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    flexWrap: 'wrap',
                    paddingTop: 14,
                    borderTop: '1px solid #f1f5f9',
                    position: 'relative'
                }}>
                    {/* Filter Label */}
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        paddingRight: 4
                    }}>
                        <Filter size={12} style={{ color: '#64748b' }} strokeWidth={2.5} />
                        <span style={{
                            fontSize: 10,
                            fontWeight: 800,
                            color: '#64748b',
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em'
                        }}>
                            Filters
                        </span>
                        {activeFiltersCount > 0 && (
                            <span style={{
                                fontSize: 9,
                                fontWeight: 800,
                                color: '#ffffff',
                                background: '#2563eb',
                                padding: '1px 6px',
                                borderRadius: 8,
                                marginLeft: 2
                            }}>
                                {activeFiltersCount}
                            </span>
                        )}
                    </div>

                    {/* Date Range Picker */}
                    <FilterPill
                        icon={Calendar}
                        label="Date"
                        color="#2563eb"
                        hasValue={!!(startDate && endDate)}
                    >
                        <div style={{
                            padding: '0 4px',
                            display: 'flex',
                            alignItems: 'center'
                        }}>
                            <DateRangePicker
                                startDate={startDate}
                                endDate={endDate}
                                onDateChange={(type, s, e) => {
                                    updateDateRange({ startDate: s, endDate: e, rangeType: type });
                                    setFilters(prev => ({
                                        ...prev,
                                        dateRange: { start: s, end: e }
                                    }));
                                }}
                            />
                        </div>
                    </FilterPill>

                    {/* Seller/Brand Dropdown */}
                    <FilterPill
                        icon={Building2}
                        label="Brand"
                        color="#7c3aed"
                        hasValue={filters?.sellerId && filters.sellerId !== 'all'}
                    >
                        <Select
                            value={filters?.sellerId || 'all'}
                            onChange={handleSellerChange}
                            style={{ minWidth: 130, height: 36 }}
                            popupClassName="filter-dropdown-premium"
                            className="filter-select-premium"
                            bordered={false}
                            placeholder="All Brands"
                        >
                            <Select.Option value="all">
                                <span style={{ fontWeight: 600, color: '#64748b' }}>All Brands</span>
                            </Select.Option>
                            {userSellers.map(s => (
                                <Select.Option key={s.id} value={s.id}>
                                    {s.name}
                                </Select.Option>
                            ))}
                        </Select>
                    </FilterPill>

                    {/* Manager Dropdown */}
                    <FilterPill
                        icon={Users}
                        label="Manager"
                        color="#0891b2"
                        hasValue={filters?.managerId && filters.managerId !== 'all'}
                    >
                        <Select
                            value={filters?.managerId || 'all'}
                            onChange={handleManagerChange}
                            style={{ minWidth: 130, height: 36 }}
                            popupClassName="filter-dropdown-premium"
                            className="filter-select-premium"
                            bordered={false}
                            placeholder="All Managers"
                        >
                            <Select.Option value="all">
                                <span style={{ fontWeight: 600, color: '#64748b' }}>All Managers</span>
                            </Select.Option>
                            {managers.map(m => (
                                <Select.Option key={m.id} value={m.id}>
                                    {m.name}
                                </Select.Option>
                            ))}
                        </Select>
                    </FilterPill>

                    {/* Goal Type Dropdown */}
                    <FilterPill
                        icon={Target}
                        label="Goal"
                        color="#f59e0b"
                        hasValue={filters?.goalType && filters.goalType !== 'all'}
                    >
                        <Select
                            value={filters?.goalType || 'all'}
                            onChange={handleGoalTypeChange}
                            style={{ minWidth: 110, height: 36 }}
                            popupClassName="filter-dropdown-premium"
                            className="filter-select-premium"
                            bordered={false}
                            placeholder="All Goals"
                        >
                            <Select.Option value="all">
                                <span style={{ fontWeight: 600, color: '#64748b' }}>All Goals</span>
                            </Select.Option>
                            <Select.Option value="GMS">
                                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ width: 7, height: 7, background: '#10b981', borderRadius: '50%' }} />
                                    GMS
                                </span>
                            </Select.Option>
                            <Select.Option value="ADS">
                                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ width: 7, height: 7, background: '#2563eb', borderRadius: '50%' }} />
                                    ADS
                                </span>
                            </Select.Option>
                            <Select.Option value="ACOS">
                                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ width: 7, height: 7, background: '#ef4444', borderRadius: '50%' }} />
                                    ACoS
                                </span>
                            </Select.Option>
                        </Select>
                    </FilterPill>

                    {/* Stats Counter (right side) */}
                    <div style={{
                        marginLeft: 'auto',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8
                    }}>
                        {userSellers.length > 0 && (
                            <Tooltip title={`${userSellers.length} brand${userSellers.length > 1 ? 's' : ''} in scope`}>
                                <div style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    padding: '5px 10px',
                                    background: '#f0fdf4',
                                    border: '1px solid #a7f3d0',
                                    borderRadius: 10,
                                    cursor: 'default'
                                }}>
                                    <Globe size={11} style={{ color: '#059669' }} strokeWidth={2.5} />
                                    <span style={{
                                        fontSize: 11,
                                        fontWeight: 800,
                                        color: '#059669'
                                    }}>
                                        {userSellers.length}
                                    </span>
                                    <span style={{
                                        fontSize: 9,
                                        fontWeight: 700,
                                        color: '#64748b',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.04em'
                                    }}>
                                        Brands
                                    </span>
                                </div>
                            </Tooltip>
                        )}

                        {managers.length > 0 && (
                            <Tooltip title={`${managers.length} manager${managers.length > 1 ? 's' : ''} active`}>
                                <div style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    padding: '5px 10px',
                                    background: '#eff6ff',
                                    border: '1px solid #bfdbfe',
                                    borderRadius: 10,
                                    cursor: 'default'
                                }}>
                                    <Users size={11} style={{ color: '#2563eb' }} strokeWidth={2.5} />
                                    <span style={{
                                        fontSize: 11,
                                        fontWeight: 800,
                                        color: '#2563eb'
                                    }}>
                                        {managers.length}
                                    </span>
                                    <span style={{
                                        fontSize: 9,
                                        fontWeight: 700,
                                        color: '#64748b',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.04em'
                                    }}>
                                        Mgrs
                                    </span>
                                </div>
                            </Tooltip>
                        )}
                    </div>
                </div>
            </div >
        </>
    );
};

export default memo(DashboardHeader);