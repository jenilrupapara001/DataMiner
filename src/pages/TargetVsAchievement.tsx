// pages/TargetVsAchievement.tsx

import React, {
    useState, useEffect, useMemo, useCallback, memo
} from 'react';
import {
    Layout, Button, Input, Select, Space, Typography,
    Tag, Tooltip, Popconfirm, Progress, message,
    Divider, Pagination, Checkbox
} from 'antd';
import {
    Plus, Search, RefreshCw, Edit3, Trash2,
    BarChart3, TrendingUp, X, Upload as UploadIcon
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTargetsData } from '../hooks/useTargetsData';
import { useTargetPermissions } from '../hooks/useTargetPermissions';
import { useAuth } from '../contexts/AuthContext';

import { getAchievementTier } from '../utils/targets';
import { sellerApi } from '../services/api';
import ImportTargetsModal from '../components/targets/ImportTargetsModal';

const { Content } = Layout;
const { Text, Title } = Typography;
const { Option } = Select;

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKS_SHORT = ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4', 'Wk 5'];

const GOAL_META: Record<string, { label: string; unit: string; color: string; bg: string }> = {
    GMS: { label: 'GMS', unit: '₹', color: '#4f46e5', bg: '#ede9fe' },
    ADS: { label: 'ADS', unit: '₹', color: '#2563eb', bg: '#dbeafe' },
    ACOS: { label: 'ACOS', unit: '%', color: '#dc2626', bg: '#fee2e2' },
    NEW_RC: { label: 'New RC', unit: '#', color: '#059669', bg: '#d1fae5' },
    RNR: { label: 'RNR', unit: '#', color: '#3b82f6', bg: '#eff6ff' },
    PO_FULFILMENT: { label: 'PO Fulfilment', unit: '%', color: '#0891b2', bg: '#cffafe' },
    PO_DAYS: { label: 'PO Days', unit: 'd', color: '#be185d', bg: '#fce7f3' },
    SELLER_CENTRAL_BUSINESS: { label: 'SC Business', unit: '₹', color: '#b45309', bg: '#fef3c7' },
};

const ALL_GOAL_TYPES = Object.keys(GOAL_META);

function getMeta(key: string) {
    return GOAL_META[key] ?? { label: key || 'GMS', unit: '₹', color: '#4f46e5', bg: '#ede9fe' };
}

function resolveGoalType(row: any): string {
    return (row?.GoalType || row?.goalType || row?.goal_type || 'GMS')
        .toString().toUpperCase().trim();
}

function fmtVal(v: number, unit: string): string {
    if (!v && v !== 0) return '—';
    if (unit === '₹') {
        if (v >= 10_000_000) return `₹${(v / 10_000_000).toFixed(1)}Cr`;
        if (v >= 100_000) return `₹${(v / 100_000).toFixed(1)}L`;
        if (v >= 1_000) return `₹${(v / 1_000).toFixed(1)}K`;
        return `₹${Math.round(v).toLocaleString('en-IN')}`;
    }
    if (unit === '%') return `${Number(v).toFixed(1)}%`;
    if (unit === 'd') return `${Math.round(v)}d`;
    return `${Math.round(v)}`;
}
const PeriodCell = memo(({
    target, achieved, unit, color, isAcos = false
}: {
    target: number; achieved: number; unit: string; color: string; isAcos?: boolean;
}) => {
    const hasData = target > 0;
    const pct = hasData ? Math.round((achieved / target) * 100) : 0;
    const tier = getAchievementTier(pct, isAcos);
    const achColor = !hasData ? '#d1d5db' : isAcos ? (achieved <= target ? '#059669' : '#ef4444') : (achieved > 0 ? tier.color : '#ef4444');

    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, padding: '8px 12px', fontSize: 12 }}>
            <span style={{ flex: 1, textAlign: 'left', fontWeight: 600, color: hasData ? '#1e293b' : '#cbd5e1' }}>
                {hasData ? fmtVal(target, unit) : '—'}
            </span>
            <span style={{ flex: 1, textAlign: 'center', fontWeight: 600, color: achColor }}>
                {hasData ? fmtVal(achieved, unit) : '—'}
            </span>
            <span style={{
                flex: 1, textAlign: 'right',
                fontSize: 10, fontWeight: 800, color: hasData ? tier.color : '#cbd5e1',
                background: hasData ? `${tier.color}12` : 'transparent',
                border: hasData ? `1px solid ${tier.color}20` : 'none',
                borderRadius: 4, padding: '1px 4px',
                minWidth: 36, display: 'inline-block'
            }}>
                {hasData ? `${pct}%` : '—'}
            </span>
        </div>
    );
});

// ─── Single goal row ──────────────────────────────────────────────────────────

const GoalDataRow = memo(({
    record, goalRow, periods, isFirst, isLast,
    isSelected, onSelectChange, onEdit, onDelete, perms, sellerName, rowKey
}: {
    record: any; goalRow: any; periods: string[];
    isFirst: boolean; isLast: boolean;
    isSelected: boolean; onSelectChange: (key: string, checked: boolean) => void;
    onEdit: (r: any) => void; onDelete: (g: any) => void; perms: any;
    sellerName?: string; rowKey: string;
}) => {
    const displayName = sellerName || record.SellerId || '?';
    const goalType = resolveGoalType(goalRow);
    const meta = getMeta(goalType);
    const total = goalRow.totalTarget || goalRow.TotalTargetValue || 0;
    const overallAch = goalRow.overallAchieved || 0;
    const overallPct = total > 0 ? Math.round((overallAch / total) * 100) : 0;
    const tier = getAchievementTier(overallPct, goalType === 'ACOS');

    const breakdowns: any[] = (() => {
        const monthly = goalRow.monthlyBreakdown;
        const weekly = goalRow.weeklyBreakdown;
        const generic = goalRow.breakdowns;
        if (record.TargetType === 'MONTHLY') {
            if (Array.isArray(weekly) && weekly.length > 0) return weekly;
            if (Array.isArray(generic) && generic.length > 0) return generic;
            return [];
        }
        if (Array.isArray(monthly) && monthly.length > 0) return monthly;
        if (Array.isArray(generic) && generic.length > 0) return generic;
        return [];
    })();

    const cellBg = '#fff';
    const rowBorder = '1px solid #e2e8f0';

    return (
        <tr style={{ borderBottom: rowBorder }}>

            {/* Checkbox */}
            <td style={{
                padding: '12px 12px', verticalAlign: 'middle', textAlign: 'center',
                background: '#fff', borderRight: '1px solid #f1f5f9',
                borderBottom: '1px solid #e2e8f0',
                position: 'sticky', left: 0, zIndex: 2, width: 46, minWidth: 46
            }}>
                <Checkbox
                    checked={isSelected}
                    onChange={e => onSelectChange(rowKey, e.target.checked)}
                />
            </td>

            {/* Brand Name */}
            <td style={{
                padding: '12px 16px', verticalAlign: 'middle',
                background: '#fff', borderRight: '1px solid #f1f5f9',
                borderBottom: '1px solid #e2e8f0',
                position: 'sticky', left: 46, zIndex: 2, minWidth: 180
            }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>
                    {displayName}
                </div>
            </td>

            {/* Brand Manager */}
            <td style={{
                padding: '12px 16px', verticalAlign: 'middle',
                background: '#fff', borderRight: '1px solid #f1f5f9',
                borderBottom: '1px solid #e2e8f0',
                minWidth: 150
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {record.BrandManager ? (
                        <>
                            <div style={{
                                width: 18, height: 18, borderRadius: '50%',
                                background: '#e0e7ff', flexShrink: 0,
                                fontSize: 9, fontWeight: 700, color: '#4f46e5',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                border: '1px solid #c7d2fe'
                            }}>
                                {record.BrandManager[0].toUpperCase()}
                            </div>
                            <Text style={{
                                fontSize: 12, color: '#475569', fontWeight: 500,
                                whiteSpace: 'nowrap', overflow: 'hidden',
                                textOverflow: 'ellipsis', maxWidth: 130
                            }}>
                                {record.BrandManager}
                            </Text>
                        </>
                    ) : (
                        <Text style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>
                            Unassigned
                        </Text>
                    )}
                </div>
            </td>

            {/* Plan Type (Yearly/Monthly) */}
            <td style={{
                padding: '12px 16px', verticalAlign: 'middle',
                background: '#fff', borderRight: '1px solid #f1f5f9',
                borderBottom: '1px solid #e2e8f0',
                minWidth: 120
            }}>
                <div style={{ fontSize: 12, color: '#475569', fontWeight: 500 }}>
                    {record.TargetType === 'YEARLY' ? 'Yearly' : 'Monthly'}
                    <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 4 }}>
                        ({record.Year}{record.Month ? ` · ${MONTHS_SHORT[record.Month - 1]}` : ''})
                    </span>
                </div>
            </td>

            {/* Goal Type */}
            <td style={{
                padding: '10px 14px', verticalAlign: 'middle',
                background: cellBg, borderRight: '1px solid #f1f5f9', width: 130
            }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: meta.color }}>
                    {meta.label} ({meta.unit})
                </div>
            </td>

            {/* Target Goal */}
            <td style={{
                padding: '10px 16px', verticalAlign: 'middle', textAlign: 'right',
                background: cellBg, borderRight: '1px solid #f1f5f9', width: 130
            }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                    {fmtVal(total, meta.unit)}
                </div>
            </td>

            {/* Sales Achieved */}
            <td style={{
                padding: '10px 16px', verticalAlign: 'middle', textAlign: 'right',
                background: cellBg, borderRight: '1px solid #f1f5f9', width: 150
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: overallAch > 0 ? (goalType === 'ACOS' ? (overallAch <= total ? '#059669' : '#ef4444') : tier.color) : '#ef4444' }}>
                        {fmtVal(overallAch, meta.unit)}
                    </span>
                    <span style={{
                        fontSize: 10, fontWeight: 800, color: tier.color,
                        background: `${tier.color}12`,
                        border: `1px solid ${tier.color}25`,
                        borderRadius: 20, padding: '1px 6px',
                        lineHeight: '14px', display: 'inline-block'
                    }}>
                        {overallPct}%
                    </span>
                </div>
            </td>

            {/* Period cells */}
            {periods.map((_, idx) => {
                const pv = idx + 1;
                const bd = breakdowns.find((b: any) => (b.PeriodValue ?? b.periodValue) === pv);
                const tgt = bd?.TargetValue ?? bd?.targetValue ?? 0;
                const ach = bd?.AchievedValue ?? bd?.achievedValue ?? 0;

                const hasData = tgt > 0;
                const pct = hasData ? Math.round((ach / tgt) * 100) : 0;
                const tier = getAchievementTier(pct, goalType === 'ACOS');
                const achColor = !hasData ? '#d1d5db' : (goalType === 'ACOS' ? (ach <= tgt ? '#059669' : '#ef4444') : (ach > 0 ? tier.color : '#ef4444'));

                return (
                    <React.Fragment key={idx}>
                        {/* TGT Cell */}
                        <td style={{
                            padding: '8px 12px', borderRight: '1px solid #f1f5f9',
                            verticalAlign: 'middle', background: cellBg, minWidth: 60, textAlign: 'right',
                            fontWeight: 600, color: hasData ? '#1e293b' : '#cbd5e1', fontSize: 12
                        }}>
                            {hasData ? fmtVal(tgt, meta.unit) : '—'}
                        </td>
                        {/* ACH Cell */}
                        <td style={{
                            padding: '8px 12px', borderRight: '1px solid #f1f5f9',
                            verticalAlign: 'middle', background: cellBg, minWidth: 60, textAlign: 'right',
                            fontWeight: 600, color: achColor, fontSize: 12
                        }}>
                            {hasData ? fmtVal(ach, meta.unit) : '—'}
                        </td>
                        {/* % Cell */}
                        <td style={{
                            padding: '8px 12px', borderRight: '1px solid #f1f5f9',
                            verticalAlign: 'middle', background: cellBg, minWidth: 60, textAlign: 'right',
                            fontSize: 10, fontWeight: 800, color: hasData ? tier.color : '#cbd5e1'
                        }}>
                            {hasData && (
                                <span style={{
                                    background: `${tier.color}12`,
                                    border: `1px solid ${tier.color}20`,
                                    borderRadius: 4, padding: '2px 6px',
                                    display: 'inline-block'
                                }}>
                                    {pct}%
                                </span>
                            )}
                            {!hasData && '—'}
                        </td>
                    </React.Fragment>
                );
            })}

            {/* Actions */}
            <td style={{
                padding: '0 12px', verticalAlign: 'middle', textAlign: 'center',
                background: '#fff', borderLeft: '1px solid #f1f5f9',
                borderBottom: '1px solid #e2e8f0',
                position: 'sticky', right: 0, zIndex: 2, width: 80
            }}>
                <Space size={6} align="center">
                    {perms.canEdit && (
                        <Tooltip title="Edit targets" placement="left">
                            <Button
                                type="primary" shape="circle" size="small"
                                icon={<Edit3 size={13} />}
                                onClick={() => onEdit(record)}
                                style={{
                                    background: '#4f46e5', borderColor: '#4f46e5',
                                    width: 30, height: 30,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: '0 2px 8px rgba(79,70,229,0.15)'
                                }}
                            />
                        </Tooltip>
                    )}
                    {perms.canDelete && (
                        <Popconfirm
                            title="Delete all targets for this brand?"
                            description={`This permanently deletes all targets for ${displayName}.`}
                            onConfirm={() => onDelete(record)}
                            okText="Delete" cancelText="Cancel"
                            okButtonProps={{ danger: true }} placement="left"
                        >
                            <Tooltip title="Delete" placement="left">
                                <Button danger shape="circle" size="small"
                                    icon={<Trash2 size={13} />}
                                    style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                />
                            </Tooltip>
                        </Popconfirm>
                    )}
                </Space>
            </td>
        </tr>
    );
});

// ─── Grouped table ────────────────────────────────────────────────────────────

const GroupedTable = memo(({
    groups, planType, perms, selectedRowKeys, onSelectChange, onEdit, onDelete, sellerMap
}: {
    groups: any[]; planType: 'YEARLY' | 'MONTHLY';
    perms: any; selectedRowKeys: string[];
    onSelectChange: (key: string, checked: boolean) => void;
    onEdit: (r: any) => void; onDelete: (g: any) => void;
    sellerMap: Map<string, string>;
}) => {
    const periods = planType === 'YEARLY' ? MONTHS_SHORT : WEEKS_SHORT;

    if (groups.length === 0) {
        return (
            <tr>
                <td colSpan={7 + (periods.length * 3) + 1}
                    style={{ padding: '64px 24px', textAlign: 'center', background: '#fff' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                        <div style={{
                            width: 56, height: 56, borderRadius: '50%', background: '#f1f5f9',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <TrendingUp size={24} color="#94a3b8" />
                        </div>
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                                No targets found
                            </div>
                            <div style={{ fontSize: 12, color: '#94a3b8' }}>
                                Add your first target to start tracking performance
                            </div>
                        </div>
                    </div>
                </td>
            </tr>
        );
    }

    return (
        <>
            {groups.map(group => {
                const rows: any[] = group.goalRows?.length
                    ? group.goalRows
                    : [{
                        goalType: resolveGoalType(group),
                        totalTarget: group.TotalTargetValue || 0,
                        overallAchieved: group.overallAchieved || 0,
                        monthlyBreakdown: group.monthlyBreakdown || [],
                        weeklyBreakdown: group.weeklyBreakdown || [],
                        targetRecordId: group._groupId
                    }];

                return rows.map((goalRow: any, rowIdx: number) => {
                    const rowKey = goalRow.targetRecordId || `${group._groupId}__${resolveGoalType(goalRow)}`;
                    return (
                        <GoalDataRow
                            key={rowKey}
                            rowKey={rowKey}
                            record={group}
                            goalRow={goalRow}
                            periods={periods}
                            isFirst={rowIdx === 0}
                            isLast={rowIdx === rows.length - 1}
                            isSelected={selectedRowKeys.includes(rowKey)}
                            onSelectChange={onSelectChange}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            perms={perms}
                            sellerName={sellerMap.get(group.SellerId) || group.SellerId}
                        />
                    );
                });
            })}
        </>
    );
});

// ─── Main Page ────────────────────────────────────────────────────────────────

const TargetVsAchievement = () => {
    const navigate = useNavigate();
    const perms = useTargetPermissions();
    const { user } = useAuth();
    const [msgApi, msgCtx] = message.useMessage();

    const {
        targets, loading, savingIds,
        createTargets, updateTarget, deleteTargets,
        refresh, contextHolder
    } = useTargetsData();

    const [sellers, setSellers] = useState<any[]>([]);

    // ── NEW: Import modal state ────────────────────────────────────────
    const [showImportModal, setShowImportModal] = useState(false);

    useEffect(() => {
        sellerApi.getAll({ limit: 500 })
            .then((res: any) => {
                const list = res?.data?.sellers || res?.data || res?.sellers || [];
                setSellers(Array.isArray(list) ? list : []);
            })
            .catch(err => console.error('[Sellers] load error:', err));
    }, []);

    const sellerMap = useMemo(() => {
        const map = new Map<string, string>();
        sellers.forEach(s => {
            map.set(s._id || s.id, s.name || '');
        });
        return map;
    }, [sellers]);

    const filteredSellers = useMemo(() => {
        if (!user) return [];
        const roleName = (user.role?.name || user.role || '').toString().toLowerCase().trim();
        const isMgr = roleName === 'brand manager' || roleName === 'brand_manager';

        if (isMgr) {
            const userSellers = user.assignedSellers || [];
            return userSellers.map((s: any) => {
                const sid = s.sellerId || s.SellerId || s._id || s.Id || s;
                return {
                    sellerId: sid,
                    name: s.name || s.SellerName || sid,
                    marketplace: s.marketplace || 'Amazon'
                };
            });
        }

        return sellers.map(s => ({
            sellerId: s._id || s.id,
            name: s.name || s._id || s.id,
            marketplace: s.marketplace || 'Amazon'
        }));
    }, [user, sellers]);

    // ── NEW: Build managers list for import modal ──────────────────────
    const managersForImport = useMemo(() => {
        const set = new Set<string>();
        targets.forEach(t => { if (t.BrandManager) set.add(t.BrandManager); });
        return Array.from(set).map(name => ({ id: name, name }));
    }, [targets]);

    const [planType, setPlanType] = useState<'YEARLY' | 'MONTHLY'>('YEARLY');
    const [filterYear, setFilterYear] = useState(new Date().getFullYear());
    const [searchText, setSearchText] = useState('');

    // ── Filter states ──────────────────────────────────────────────────
    const [filterSeller, setFilterSeller] = useState<string>('');
    const [filterManager, setFilterManager] = useState<string>('');
    const [filterGoalType, setFilterGoalType] = useState<string>('');

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);

    const handleSelectChange = useCallback((key: string, checked: boolean) => {
        setSelectedRowKeys(prev => checked ? [...prev, key] : prev.filter(k => k !== key));
    }, []);

    // Clear selection + filters reset page
    useEffect(() => {
        setSelectedRowKeys([]);
        setPage(1);
    }, [planType, filterYear, searchText, filterSeller, filterManager, filterGoalType]);

    // ── Derived filter options from actual data ────────────────────────

    const availableSellers = useMemo(() => {
        const ids = [...new Set(targets.map(t => t.SellerId as string).filter(Boolean))];
        return ids.map(id => {
            const labelStr = (sellerMap.get(id as string) || id || '') as string;
            return {
                value: id,
                label: labelStr
            };
        }).sort((a, b) => a.label.localeCompare(b.label));
    }, [targets, sellerMap]);

    const availableManagers = useMemo(() => {
        const names = [...new Set(targets.map(t => t.BrandManager).filter(Boolean))].sort();
        return names;
    }, [targets]);

    const availableGoalTypes = useMemo(() => {
        const types = [...new Set(targets.map(t => resolveGoalType(t)).filter(Boolean))].sort();
        return types;
    }, [targets]);

    const hasActiveFilters = !!(filterSeller || filterManager || filterGoalType || searchText);

    const clearAllFilters = useCallback(() => {
        setFilterSeller('');
        setFilterManager('');
        setFilterGoalType('');
        setSearchText('');
        setPage(1);
    }, []);

    // ── Group + filter targets ─────────────────────────────────────────

    const grouped = useMemo(() => {
        const filtered = targets
            .filter(t => t.TargetType === planType)
            .filter(t => !filterYear || Number(t.Year || 0) === filterYear)
            // RBAC Filter
            .filter(t => {
                if (perms.isBrandManager) {
                    const sellerIdLower = (t.SellerId || '').toString().toLowerCase();
                    const matchesSeller = filteredSellers.some(s => {
                        const code = (s.sellerId || '').toString().toLowerCase();
                        return code === sellerIdLower;
                    });

                    const targetManagerLower = (t.BrandManager || '').toString().toLowerCase().trim();
                    const currentUserName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim().toLowerCase();
                    const matchesManagerName = targetManagerLower === currentUserName;

                    if (!matchesSeller && !matchesManagerName) {
                        return false;
                    }
                }
                return true;
            })
            // Seller filter
            .filter(t => !filterSeller || t.SellerId === filterSeller)
            // Manager filter
            .filter(t => !filterManager || t.BrandManager === filterManager)
            // Search
            .filter(t => {
                if (!searchText) return true;
                const q = searchText.toLowerCase();
                const sellerName = (sellerMap.get(t.SellerId) || t.SellerId || '').toLowerCase();
                return (
                    sellerName.includes(q) ||
                    (t.BrandManager || '').toLowerCase().includes(q)
                );
            });

        const map = new Map<string, any>();
        filtered.forEach(t => {
            const key = `${t.SellerId}__${t.Year}__${t.Month || 0}`;
            if (!map.has(key)) {
                map.set(key, {
                    _groupId: key,
                    SellerId: t.SellerId,
                    BrandManager: t.BrandManager,
                    TargetType: t.TargetType,
                    Year: t.Year,
                    Month: t.Month,
                    _allTargetIds: [] as string[],
                    goalRows: [] as any[]
                });
            }
            const g = map.get(key)!;
            g._allTargetIds.push(t.Id);

            const gt = resolveGoalType(t);
            // Goal type filter — applied at goalRow level
            if (!filterGoalType || gt === filterGoalType) {
                g.goalRows.push({
                    goalType: gt,
                    totalTarget: t.TotalTargetValue || t.totalTargetValue || 0,
                    overallAchieved: t.overallAchieved || 0,
                    monthlyBreakdown: t.monthlyBreakdown || [],
                    weeklyBreakdown: t.weeklyBreakdown || [],
                    breakdowns: t.breakdowns || [],
                    targetRecordId: t.Id
                });
            }
        });

        // Remove groups that ended up with no goal rows after goal type filter
        return Array.from(map.values()).filter(g => g.goalRows.length > 0);
    }, [targets, planType, filterYear, filterSeller, filterManager, filterGoalType, searchText, perms.isBrandManager, filteredSellers, user, sellerMap]);

    const totalGroups = grouped.length;
    const totalGoalRows = useMemo(() => grouped.reduce((s, g) => s + g.goalRows.length, 0), [grouped]);
    const paginatedGroups = useMemo(() => grouped.slice((page - 1) * pageSize, page * pageSize), [grouped, page, pageSize]);

    const availableYears = useMemo<number[]>(() => {
        const yrs = [...new Set<number>(targets.map(t => Number(t.Year || 0)))].sort((a, b) => b - a);
        return yrs.length ? yrs : [new Date().getFullYear()];
    }, [targets]);

    const handleEdit = useCallback((r: any) => {
        if (perms.canEdit) {
            const records = Array.isArray(r) ? r : [r];
            const initialData = records.map(rec => {
                const periodKeys = rec.TargetType === 'YEARLY' ? MONTHS_SHORT : WEEKS_SHORT;
                return {
                    sectionId: rec._groupId,
                    sellerId: rec.SellerId || '',
                    brandManager: rec.BrandManager || '',
                    manager: rec.BrandManager || '',
                    periodType: (rec.TargetType || 'YEARLY') as 'YEARLY' | 'MONTHLY',
                    year: rec.Year || new Date().getFullYear(),
                    month: rec.Month || 1,
                    collapsed: false,
                    goalRows: (rec.goalRows || []).map((gr: any) => {
                        const bds: any[] = gr.monthlyBreakdown || gr.weeklyBreakdown || gr.breakdowns || [];
                        return {
                            id: gr.targetRecordId || `gr_${Math.random()}`,
                            goalRowId: gr.targetRecordId || `gr_${Math.random()}`,
                            goalType: resolveGoalType(gr),
                            totalTarget: gr.totalTarget || 0,
                            targetId: gr.targetRecordId,
                            cells: periodKeys.map((_: string, i: number) => {
                                const pv = i + 1;
                                const bd = bds.find((b: any) => (b.PeriodValue ?? b.periodValue) === pv);
                                return {
                                    value: bd?.TargetValue ?? bd?.targetValue ?? 0,
                                    pct: bd?.PercentageContribution ?? bd?.percentageContribution ?? 0,
                                    achievedValue: bd?.AchievedValue ?? bd?.achievedValue ?? 0,
                                    breakdownId: bd?.Id ?? bd?.id
                                };
                            })
                        };
                    })
                };
            });
            navigate('/target-achievement/create', { state: { mode: 'edit', initialData } });
        }
    }, [perms.canEdit, navigate]);

    const handleDelete = useCallback(async (g: any) => { const ids = g._allTargetIds || []; if (ids.length) await deleteTargets(ids); }, [deleteTargets]);

    const periods = planType === 'YEARLY' ? MONTHS_SHORT : WEEKS_SHORT;

    const headerCols = [
        { label: '', w: 46, sticky: true, left: 0, isCheckbox: true },
        { label: 'Brand Name', w: 180, sticky: true, left: 46 },
        { label: 'Manager', w: 150, sticky: false },
        { label: 'Yearly/Monthly', w: 120, sticky: false },
        { label: 'Goal Type', w: 130, sticky: false },
        { label: 'Target Goal', w: 130, sticky: false },
        { label: 'Achieved Goal', w: 150, sticky: false },
    ];

    return (
        <Layout
            className="target-achievement-container"
            style={{
                minHeight: 'calc(100vh - 72px)', background: '#f8fafc',
                margin: '-1.5rem -2rem -1.5rem -2rem',
                flex: 1, display: 'flex', flexDirection: 'column'
            }}
        >
            {contextHolder}
            {msgCtx}

            {/* ── Page Header ──────────────────────────────────────── */}
            <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '20px 32px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <Title level={4} style={{ margin: 0, fontWeight: 700, color: '#0f172a', fontSize: 20 }}>
                            Target v/s Achievements
                        </Title>
                        <Text style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginTop: 2 }}>
                            Manage revenue targets, distribution splits, and sales achievements.
                        </Text>
                    </div>

                    <Space size={8} wrap>
                        <Space.Compact>
                            <Button style={{ fontWeight: 600, fontSize: 12, background: '#f5f3ff', borderColor: '#c084fc', color: '#7c3aed' }}>
                                Table View
                            </Button>
                            <Button icon={<BarChart3 size={13} />}
                                onClick={() => navigate('/target-achievement/dashboard')}
                                style={{ fontWeight: 600, fontSize: 12 }}>
                                Analytics Dashboard
                            </Button>
                        </Space.Compact>

                        <Space.Compact>
                            <Button type={planType === 'YEARLY' ? 'primary' : 'default'}
                                onClick={() => { setPlanType('YEARLY'); setPage(1); }}
                                style={{
                                    fontWeight: 600, fontSize: 12,
                                    ...(planType === 'YEARLY'
                                        ? { background: '#6366f1', borderColor: '#6366f1', color: '#fff' }
                                        : { background: '#fff', borderColor: '#e2e8f0', color: '#64748b' })
                                }}>
                                Yearly Plans
                            </Button>
                            <Button type={planType === 'MONTHLY' ? 'primary' : 'default'}
                                onClick={() => { setPlanType('MONTHLY'); setPage(1); }}
                                style={{
                                    fontWeight: 600, fontSize: 12,
                                    ...(planType === 'MONTHLY'
                                        ? { background: '#6366f1', borderColor: '#6366f1', color: '#fff' }
                                        : { background: '#fff', borderColor: '#e2e8f0', color: '#64748b' })
                                }}>
                                Monthly Plans
                            </Button>
                        </Space.Compact>

                        <Select value={filterYear} onChange={v => { setFilterYear(v); setPage(1); }} style={{ width: 100 }}>
                            {availableYears.map(y => <Option key={y} value={y}>{y}</Option>)}
                        </Select>

                        <Tooltip title="Refresh data">
                            <Button icon={<RefreshCw size={14} />} onClick={refresh} loading={loading}>
                                Refresh
                            </Button>
                        </Tooltip>

                        {/* ── NEW: Import Excel Button ──────────────── */}
                        {perms.canCreate && (
                            <Tooltip title="Import target achievements from Excel">
                                <Button
                                    icon={<UploadIcon size={14} />}
                                    onClick={() => setShowImportModal(true)}
                                    style={{
                                        background: '#fff',
                                        borderColor: '#10b981',
                                        color: '#059669',
                                        fontWeight: 600,
                                        fontSize: 12,
                                        boxShadow: '0 2px 6px rgba(16,185,129,0.15)'
                                    }}>
                                    Import Excel
                                </Button>
                            </Tooltip>
                        )}

                        {perms.canCreate && (
                            <Button type="primary" icon={<Plus size={14} />}
                                onClick={() => navigate('/target-achievement/create')}
                                style={{ background: '#4f46e5', borderColor: '#4f46e5', fontWeight: 600, boxShadow: '0 4px 12px rgba(79,70,229,0.25)' }}>
                                Establish Targets
                            </Button>
                        )}
                    </Space>
                </div>
            </div>

            {/* ── Toolbar with search + filters ───────────────────── */}
            <div style={{
                background: '#fff', padding: '12px 32px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex', flexDirection: 'column', gap: 10
            }}>
                {/* Row 1: Search + stats + legend */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                    <Input
                        prefix={<Search size={14} style={{ color: '#94a3b8' }} />}
                        placeholder="Search by brand name or manager..."
                        value={searchText}
                        onChange={e => { setSearchText(e.target.value); setPage(1); }}
                        allowClear
                        style={{ width: 280, borderRadius: 6 }}
                    />

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <Text style={{ fontSize: 12, color: '#64748b' }}>
                            <Text strong>{totalGroups}</Text> brands
                            {' · '}
                            <Text strong>{totalGoalRows}</Text> goal rows
                        </Text>
                        <Divider orientation="vertical" style={{ margin: 0 }} />
                        <Space size={6}>
                            {[
                                { label: 'Elite (100%+)', color: '#059669', bg: '#d1fae5' },
                                { label: 'High (80%+)', color: '#2563eb', bg: '#dbeafe' },
                                { label: 'Track (50%+)', color: '#d97706', bg: '#fef3c7' },
                            ].map(item => (
                                <Tag key={item.label} style={{
                                    borderRadius: 20, fontWeight: 600, fontSize: 10,
                                    border: 'none', margin: 0, background: item.bg,
                                    color: item.color, padding: '2px 10px'
                                }}>
                                    {item.label}
                                </Tag>
                            ))}
                        </Space>
                    </div>
                </div>

                {/* Row 2: Filter dropdowns */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, flexShrink: 0 }}>
                        Filters:
                    </Text>

                    {/* Seller filter */}
                    <Select
                        placeholder="All Brands"
                        allowClear
                        value={filterSeller || undefined}
                        onChange={v => { setFilterSeller(v || ''); setPage(1); }}
                        style={{ minWidth: 160 }}
                        size="small"
                        showSearch
                        filterOption={(input, opt) =>
                            (opt?.label as string || '').toLowerCase().includes(input.toLowerCase())
                        }
                        options={availableSellers}
                    />

                    {/* Manager filter */}
                    <Select
                        placeholder="All Managers"
                        allowClear
                        value={filterManager || undefined}
                        onChange={v => { setFilterManager(v || ''); setPage(1); }}
                        style={{ minWidth: 160 }}
                        size="small"
                        showSearch
                        filterOption={(input, opt) =>
                            (opt?.label as string || '').toLowerCase().includes(input.toLowerCase())
                        }
                        options={availableManagers.map(m => ({ label: m, value: m }))}
                    />

                    {/* Goal type filter */}
                    <Select
                        placeholder="All Goal Types"
                        allowClear
                        value={filterGoalType || undefined}
                        onChange={v => { setFilterGoalType(v || ''); setPage(1); }}
                        style={{ minWidth: 160 }}
                        size="small"
                        options={availableGoalTypes.map(gt => {
                            const m = getMeta(gt as string);
                            return {
                                label: (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{
                                            width: 8, height: 8, borderRadius: '50%',
                                            background: m.color, display: 'inline-block', flexShrink: 0
                                        }} />
                                        <span style={{ fontWeight: 600, color: m.color }}>{m.label}</span>
                                        <span style={{ fontSize: 10, color: '#94a3b8' }}>({m.unit})</span>
                                    </div>
                                ),
                                value: gt
                            };
                        })}
                    />

                    {/* Active filter chips + clear */}
                    {hasActiveFilters && (
                        <>
                            <Divider type="vertical" style={{ margin: '0 2px' }} />

                            {/* Show active filter chips */}
                            {filterSeller && (
                                <Tag
                                    closable
                                    onClose={() => setFilterSeller('')}
                                    style={{
                                        borderRadius: 20, fontSize: 11, fontWeight: 600,
                                        background: '#ede9fe', border: '1px solid #c4b5fd',
                                        color: '#7c3aed', margin: 0, padding: '1px 8px'
                                    }}
                                >
                                    Brand: {sellerMap.get(filterSeller) || filterSeller}
                                </Tag>
                            )}
                            {filterManager && (
                                <Tag
                                    closable
                                    onClose={() => setFilterManager('')}
                                    style={{
                                        borderRadius: 20, fontSize: 11, fontWeight: 600,
                                        background: '#e0e7ff', border: '1px solid #a5b4fc',
                                        color: '#4f46e5', margin: 0, padding: '1px 8px'
                                    }}
                                >
                                    Manager: {filterManager}
                                </Tag>
                            )}
                            {filterGoalType && (
                                <Tag
                                    closable
                                    onClose={() => setFilterGoalType('')}
                                    style={{
                                        borderRadius: 20, fontSize: 11, fontWeight: 600,
                                        background: getMeta(filterGoalType).bg,
                                        border: `1px solid ${getMeta(filterGoalType).color}30`,
                                        color: getMeta(filterGoalType).color, margin: 0, padding: '1px 8px'
                                    }}
                                >
                                    Goal: {getMeta(filterGoalType).label}
                                </Tag>
                            )}
                            {searchText && (
                                <Tag
                                    closable
                                    onClose={() => setSearchText('')}
                                    style={{
                                        borderRadius: 20, fontSize: 11, fontWeight: 600,
                                        background: '#f1f5f9', border: '1px solid #e2e8f0',
                                        color: '#64748b', margin: 0, padding: '1px 8px'
                                    }}
                                >
                                    Search: "{searchText}"
                                </Tag>
                            )}

                            <Button
                                type="link" size="small"
                                icon={<X size={11} />}
                                onClick={clearAllFilters}
                                style={{
                                    fontSize: 11, color: '#ef4444', fontWeight: 600,
                                    padding: '0 4px', height: 'auto'
                                }}
                            >
                                Clear all
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* ── Table Content ─────────────────────────────────────── */}
            <Content style={{ padding: '24px 32px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <div style={{
                    background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 18px -4px rgba(15,23,42,0.05), 0 1px 3px rgba(15,23,42,0.02)',
                    overflow: 'hidden', display: 'flex', flexDirection: 'column',
                    height: '100%', position: 'relative'
                }}>
                    <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto' }}>
                        <table style={{
                            borderCollapse: 'collapse', width: '100%',
                            minWidth: periods.length * 85 + 560
                        }}>
                            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                    {headerCols.map((col, i) => (
                                        <th key={i} rowSpan={2} style={{
                                            padding: col.isCheckbox ? '12px 12px' : '12px 16px',
                                            textAlign: i >= 3 ? 'right' : col.isCheckbox ? 'center' : 'left',
                                            fontSize: 11, fontWeight: 600, color: '#475569',
                                            letterSpacing: '0.06em', textTransform: 'uppercase',
                                            background: '#f8fafc',
                                            borderRight: '1px solid #f1f5f9',
                                            borderBottom: '1px solid #e2e8f0',
                                            whiteSpace: 'nowrap',
                                            ...(col.sticky ? { position: 'sticky', left: col.left, zIndex: 6 } : {}),
                                            width: col.w, minWidth: col.w
                                        }}>
                                            {col.isCheckbox ? (
                                                <Checkbox
                                                    checked={
                                                        paginatedGroups.length > 0 &&
                                                        paginatedGroups.every(g => {
                                                            const rws = g.goalRows || [];
                                                            return rws.every((r: any) => {
                                                                const rKey = r.targetRecordId || `${g._groupId}__${resolveGoalType(r)}`;
                                                                return selectedRowKeys.includes(rKey);
                                                            });
                                                        })
                                                    }
                                                    indeterminate={
                                                        paginatedGroups.some(g => {
                                                            const rws = g.goalRows || [];
                                                            return rws.some((r: any) => {
                                                                const rKey = r.targetRecordId || `${g._groupId}__${resolveGoalType(r)}`;
                                                                return selectedRowKeys.includes(rKey);
                                                            });
                                                        }) && !(
                                                            paginatedGroups.every(g => {
                                                                const rws = g.goalRows || [];
                                                                return rws.every((r: any) => {
                                                                    const rKey = r.targetRecordId || `${g._groupId}__${resolveGoalType(r)}`;
                                                                    return selectedRowKeys.includes(rKey);
                                                                });
                                                            })
                                                        )
                                                    }
                                                    onChange={e => {
                                                        if (e.target.checked) {
                                                            const nk = [...selectedRowKeys];
                                                            paginatedGroups.forEach(g => {
                                                                const rws = g.goalRows || [];
                                                                rws.forEach((r: any) => {
                                                                    const rKey = r.targetRecordId || `${g._groupId}__${resolveGoalType(r)}`;
                                                                    if (!nk.includes(rKey)) nk.push(rKey);
                                                                });
                                                            });
                                                            setSelectedRowKeys(nk);
                                                        } else {
                                                            const pk: string[] = [];
                                                            paginatedGroups.forEach(g => {
                                                                const rws = g.goalRows || [];
                                                                rws.forEach((r: any) => {
                                                                    const rKey = r.targetRecordId || `${g._groupId}__${resolveGoalType(r)}`;
                                                                    pk.push(rKey);
                                                                });
                                                            });
                                                            setSelectedRowKeys(selectedRowKeys.filter(k => !pk.includes(k)));
                                                        }
                                                    }}
                                                />
                                            ) : col.label}
                                        </th>
                                    ))}
                                    {periods.map((p, i) => (
                                        <th key={i} colSpan={3} style={{
                                            padding: '8px 12px', textAlign: 'center',
                                            fontSize: 11, fontWeight: 600, color: '#475569',
                                            background: '#f8fafc',
                                            borderRight: '1px solid #f1f5f9',
                                            borderBottom: '1px solid #e2e8f0',
                                            minWidth: 180, whiteSpace: 'nowrap'
                                        }}>
                                            <div style={{ fontWeight: 600, fontSize: 12 }}>{p}</div>
                                        </th>
                                    ))}
                                    <th rowSpan={2} style={{
                                        padding: '12px 12px', textAlign: 'center',
                                        fontSize: 11, fontWeight: 600, color: '#475569',
                                        letterSpacing: '0.06em', textTransform: 'uppercase',
                                        background: '#f8fafc',
                                        borderLeft: '1px solid #f1f5f9',
                                        borderBottom: '1px solid #e2e8f0',
                                        position: 'sticky', right: 0, zIndex: 6, width: 80
                                    }}>
                                        Actions
                                    </th>
                                </tr>
                                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                    {periods.map((p, i) => (
                                        <React.Fragment key={i}>
                                            <th style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textAlign: 'right', borderRight: '1px solid #f1f5f9', padding: '4px 8px' }}>TGT</th>
                                            <th style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textAlign: 'right', borderRight: '1px solid #f1f5f9', padding: '4px 8px' }}>ACH</th>
                                            <th style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textAlign: 'right', borderRight: '1px solid #f1f5f9', padding: '4px 8px' }}>%</th>
                                        </React.Fragment>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading && grouped.length === 0 ? (
                                    <tr>
                                        <td colSpan={7 + (periods.length * 3) + 1}
                                            style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
                                            Loading targets...
                                        </td>
                                    </tr>
                                ) : (
                                    <GroupedTable
                                        groups={paginatedGroups}
                                        planType={planType}
                                        perms={perms}
                                        selectedRowKeys={selectedRowKeys}
                                        onSelectChange={handleSelectChange}
                                        onEdit={handleEdit}
                                        onDelete={handleDelete}
                                        sellerMap={sellerMap}
                                    />
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Floating Bulk Actions Bar */}
                    {selectedRowKeys.length > 0 && (
                        <div style={{
                            position: 'absolute', bottom: 76, left: '50%',
                            transform: 'translateX(-50%)', zIndex: 50,
                            background: '#0f172a', borderRadius: 12, padding: '10px 20px',
                            display: 'flex', alignItems: 'center', gap: 16,
                            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
                            border: '1px solid #1e293b',
                            animation: 'slideUp 0.3s cubic-bezier(0.16,1,0.3,1)'
                        }}>
                            <Text style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>
                                {selectedRowKeys.length} {selectedRowKeys.length === 1 ? 'row' : 'rows'} selected
                            </Text>
                            <Divider type="vertical" style={{ background: '#334155', margin: 0, height: 20 }} />
                            <Button type="primary" size="small" icon={<Edit3 size={12} />}
                                onClick={() => {
                                    const recs = grouped.filter(g => {
                                        const rws = g.goalRows || [];
                                        return rws.some((r: any) => {
                                            const rKey = r.targetRecordId || `${g._groupId}__${resolveGoalType(r)}`;
                                            return selectedRowKeys.includes(rKey);
                                        });
                                    }).map(g => {
                                        const selectedRows = (g.goalRows || []).filter((r: any) => {
                                            const rKey = r.targetRecordId || `${g._groupId}__${resolveGoalType(r)}`;
                                            return selectedRowKeys.includes(rKey);
                                        });
                                        return { ...g, goalRows: selectedRows };
                                    });
                                    handleEdit(recs);
                                }}
                                style={{ background: '#6366f1', borderColor: '#6366f1', fontSize: 12, fontWeight: 600 }}>
                                Edit Selected
                            </Button>
                            {perms.canDelete && (
                                <Popconfirm
                                    title="Delete all selected targets?"
                                    description={`Permanently deletes all targets for the ${selectedRowKeys.length} selected row(s).`}
                                    onConfirm={async () => {
                                        const recs = grouped.filter(g => {
                                            const rws = g.goalRows || [];
                                            return rws.some((r: any) => {
                                                const rKey = r.targetRecordId || `${g._groupId}__${resolveGoalType(r)}`;
                                                return selectedRowKeys.includes(rKey);
                                            });
                                        });
                                        const allIds: string[] = [];
                                        recs.forEach(g => {
                                            const rws = g.goalRows || [];
                                            rws.forEach((r: any) => {
                                                const rKey = r.targetRecordId || `${g._groupId}__${resolveGoalType(r)}`;
                                                if (selectedRowKeys.includes(rKey) && r.targetRecordId) {
                                                    allIds.push(r.targetRecordId);
                                                }
                                            });
                                        });
                                        if (allIds.length) { await deleteTargets(allIds); setSelectedRowKeys([]); }
                                    }}
                                    okText="Delete All" cancelText="Cancel"
                                    okButtonProps={{ danger: true }} placement="top"
                                >
                                    <Button danger type="primary" size="small" icon={<Trash2 size={12} />}
                                        style={{ fontSize: 12, fontWeight: 600 }}>
                                        Delete Selected
                                    </Button>
                                </Popconfirm>
                            )}
                            <Button type="text" size="small" onClick={() => setSelectedRowKeys([])}
                                style={{ color: '#94a3b8', fontSize: 12 }}>
                                Cancel
                            </Button>
                        </div>
                    )}

                    {/* Pagination */}
                    {totalGroups > 0 && (
                        <div style={{
                            padding: '12px 24px', borderTop: '1px solid #f0f0f0',
                            background: '#fff', display: 'flex', alignItems: 'center',
                            justifyContent: 'space-between', flexShrink: 0
                        }}>
                            <Text style={{ fontSize: 12, color: '#64748b' }}>
                                {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalGroups)} of{' '}
                                <Text strong>{totalGroups}</Text> brands
                                {' · '}
                                <Text strong>{totalGoalRows}</Text> goal rows
                                {hasActiveFilters && (
                                    <Tag style={{
                                        marginLeft: 8, borderRadius: 20, fontSize: 10,
                                        background: '#ede9fe', border: '1px solid #c4b5fd',
                                        color: '#7c3aed', fontWeight: 600
                                    }}>
                                        Filtered
                                    </Tag>
                                )}
                            </Text>
                            <Pagination
                                current={page} pageSize={pageSize} total={totalGroups}
                                showSizeChanger pageSizeOptions={['10', '20', '50']}
                                showQuickJumper={totalGroups > 50}
                                onChange={(p, ps) => { setPage(p); if (ps !== pageSize) { setPageSize(ps); setPage(1); } }}
                                size="small" style={{ margin: 0 }}
                            />
                        </div>
                    )}
                </div>
            </Content>

            {/* ── NEW: Import Targets Modal ─────────────────────────── */}
            <ImportTargetsModal
                open={showImportModal}
                onClose={() => setShowImportModal(false)}
                onSuccess={() => {
                    refresh();
                    msgApi.success({
                        content: 'Targets refreshed successfully',
                        duration: 3
                    });
                }}
                sellers={sellers}
                managers={managersForImport}
            />

            <style>{`
                .target-achievement-container ::-webkit-scrollbar { width: 6px; height: 6px; }
                .target-achievement-container ::-webkit-scrollbar-track { background: #f8fafc; }
                .target-achievement-container ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
                .target-achievement-container ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
                thead th { user-select: none; }
                tbody tr:hover td { background: #f8fafc !important; }
                tbody tr:hover td[rowspan] { background: #ffffff !important; }
                tbody td { transition: background 0.12s ease; }
                .ant-btn { transition: all 0.2s cubic-bezier(0.4,0,0.2,1); }
                .ant-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(79,70,229,0.25) !important; }
                @keyframes slideUp {
                    from { transform: translate(-50%, 20px); opacity: 0; }
                    to   { transform: translate(-50%, 0);    opacity: 1; }
                }
            `}</style>

        </Layout>
    );
};

export const ConnectionBanner = memo(({ targets }: { targets: any[] }) => {
    if (!targets || targets.length > 0) return null;
    return (
        <div style={{
            padding: '10px 16px', background: '#fffbeb',
            border: '1px solid #fde68a', borderRadius: 8,
            marginBottom: 12, fontSize: 12, fontWeight: 500, color: '#92400e'
        }}>
            ⚠ No target data loaded. Create targets or check your connection.
        </div>
    );
});

export default React.memo(TargetVsAchievement);