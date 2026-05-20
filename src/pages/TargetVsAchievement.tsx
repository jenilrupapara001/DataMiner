// pages/TargetVsAchievement.tsx — complete rewrite with proper Ant Design layout

import React, {
    useState, useEffect, useMemo, useCallback, memo
} from 'react';
import {
    Layout, Button, Input, Select, Space, Typography,
    Tag, Tooltip, Popconfirm, Progress, message,
    Breadcrumb, Divider, Pagination
} from 'antd';
import {
    Plus, Search, RefreshCw, Edit3, Trash2,
    BarChart3, TrendingUp
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTargetsData }       from '../hooks/useTargetsData';
import { useTargetPermissions } from '../hooks/useTargetPermissions';
import { TargetSheetModal }     from '../components/targets/TargetSheetModal';
import { getAchievementTier }   from '../utils/targets';
import { sellerApi }            from '../services/api';

const { Content }       = Layout;
const { Text, Title }             = Typography;
const { Option }                  = Select;

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WEEKS_SHORT  = ['Wk 1','Wk 2','Wk 3','Wk 4','Wk 5'];

const GOAL_META: Record<string, { label: string; unit: string; color: string; bg: string }> = {
    GMS:                     { label: 'GMS',           unit: '₹', color: '#4f46e5', bg: '#ede9fe' },
    ADS:                     { label: 'ADS',           unit: '₹', color: '#2563eb', bg: '#dbeafe' },
    ACOS:                    { label: 'ACOS',          unit: '%', color: '#dc2626', bg: '#fee2e2' },
    NEW_RC:                  { label: 'New RC',        unit: '#', color: '#059669', bg: '#d1fae5' },
    REVIEW:                  { label: 'Reviews',       unit: '#', color: '#7c3aed', bg: '#ede9fe' },
    RATING:                  { label: 'Rating',        unit: '★', color: '#f59e0b', bg: '#fef3c7' },
    PO_FULFILMENT:           { label: 'PO Fulfilment', unit: '%', color: '#0891b2', bg: '#cffafe' },
    PO_DAYS:                 { label: 'PO Days',       unit: 'd', color: '#be185d', bg: '#fce7f3' },
    SELLER_CENTRAL_BUSINESS: { label: 'SC Business',   unit: '₹', color: '#b45309', bg: '#fef3c7' },
};

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
        if (v >= 100_000)    return `₹${(v / 100_000).toFixed(1)}L`;
        if (v >= 1_000)      return `₹${(v / 1_000).toFixed(1)}K`;
        return `₹${Math.round(v).toLocaleString('en-IN')}`;
    }
    if (unit === '%') return `${Number(v).toFixed(1)}%`;
    if (unit === 'd') return `${Math.round(v)}d`;
    return `${Math.round(v)}`;
}

// ─── Period cell ──────────────────────────────────────────────────────────────

const PeriodCell = memo(({
    target, achieved, unit, color
}: {
    target: number; achieved: number; unit: string; color: string;
}) => {
    const hasData  = target > 0;
    const pct      = hasData ? Math.round((achieved / target) * 100) : 0;
    const tier     = getAchievementTier(pct);
    const achColor = !hasData ? '#d1d5db' : achieved > 0 ? tier.color : '#ef4444';

    return (
        <div style={{ padding: '4px 8px', minWidth: 76 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', minWidth: 12, lineHeight: 1 }}>T:</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: hasData ? '#1e293b' : '#e2e8f0' }}>
                    {hasData ? fmtVal(target, unit) : '—'}
                </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', minWidth: 12, lineHeight: 1 }}>A:</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: achColor }}>
                    {hasData ? fmtVal(achieved, unit) : '—'}
                </span>
            </div>
            {hasData && (
                <div style={{ marginTop: 3, height: 2, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{
                        height: '100%', width: `${Math.min(pct, 100)}%`,
                        background: tier.color, borderRadius: 99
                    }} />
                </div>
            )}
        </div>
    );
});

// ─── Single goal row ──────────────────────────────────────────────────────────

const GoalDataRow = memo(({
    record, goalRow, periods, isFirst, isLast,
    brandRowSpan, onEdit, onDelete, perms
}: {
    record: any; goalRow: any; periods: string[];
    isFirst: boolean; isLast: boolean; brandRowSpan: number;
    onEdit: (r: any) => void; onDelete: (g: any) => void; perms: any;
}) => {
    const goalType   = resolveGoalType(goalRow);
    const meta       = getMeta(goalType);
    const total      = goalRow.totalTarget || goalRow.TotalTargetValue || 0;
    const overallAch = goalRow.overallAchieved || 0;
    const overallPct = total > 0 ? Math.round((overallAch / total) * 100) : 0;
    const tier       = getAchievementTier(overallPct);

    const breakdowns: any[] = (() => {
        const monthly = goalRow.monthlyBreakdown;
        const weekly  = goalRow.weeklyBreakdown;
        const generic = goalRow.breakdowns;

        // For MONTHLY plans, always prefer weekly breakdowns
        if (record.TargetType === 'MONTHLY') {
            if (Array.isArray(weekly)  && weekly.length  > 0) return weekly;
            if (Array.isArray(generic) && generic.length > 0) return generic;
            return [];
        }

        // For YEARLY plans, prefer monthly breakdowns
        if (Array.isArray(monthly)  && monthly.length  > 0) return monthly;
        if (Array.isArray(generic)  && generic.length  > 0) return generic;
        return [];
    })();

    const cellBg    = isFirst ? '#fff' : '#fafbff';
    const rowBorder = isLast
        ? '2px solid #e8e8e8'
        : '1px solid #f0f0f0';

    return (
        <tr style={{ borderBottom: rowBorder }}>

            {/* Brand Name — rowSpan */}
            {isFirst && (
                <td rowSpan={brandRowSpan} style={{
                    padding: '12px 16px',
                    verticalAlign: 'middle',
                    background: '#fff',
                    borderRight: '1px solid #f0f0f0',
                    borderBottom: '2px solid #e8e8e8',
                    position: 'sticky', left: 0, zIndex: 2,
                    minWidth: 200
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {/* Brand avatar with rank number */}
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                            <div style={{
                                width: 36, height: 36, borderRadius: 10,
                                background: `linear-gradient(135deg, ${meta.color}22, ${meta.color}44)`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 12, fontWeight: 800, color: meta.color,
                                border: `1.5px solid ${meta.color}30`
                            }}>
                                {(record.SellerId || '?')[0].toUpperCase()}
                            </div>
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <div style={{
                                fontWeight: 700, fontSize: 13, color: '#1e293b',
                                lineHeight: '16px', whiteSpace: 'nowrap',
                                overflow: 'hidden', textOverflow: 'ellipsis'
                            }}>
                                {record.SellerId}
                            </div>
                            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                                {record.Year}
                                {record.Month ? ` · ${MONTHS_SHORT[record.Month - 1]}` : ''}
                            </div>
                        </div>
                    </div>
                </td>
            )}

            {/* Manager — rowSpan */}
            {isFirst && (
                <td rowSpan={brandRowSpan} style={{
                    padding: '12px 16px',
                    verticalAlign: 'middle',
                    background: '#fff',
                    borderRight: '1px solid #f0f0f0',
                    borderBottom: '2px solid #e8e8e8',
                    minWidth: 150
                }}>
                    {record.BrandManager ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{
                                width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                                background: '#ede9fe', fontSize: 10,
                                fontWeight: 700, color: '#7c3aed',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                {record.BrandManager[0].toUpperCase()}
                            </div>
                            <Text style={{ fontSize: 12, color: '#334155', fontWeight: 500 }}>
                                {record.BrandManager}
                            </Text>
                        </div>
                    ) : (
                        <Text style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
                            Unassigned
                        </Text>
                    )}
                </td>
            )}

            {/* Plan Type — rowSpan */}
            {isFirst && (
                <td rowSpan={brandRowSpan} style={{
                    padding: '12px 12px',
                    verticalAlign: 'middle', textAlign: 'center',
                    background: '#fff',
                    borderRight: '1px solid #f0f0f0',
                    borderBottom: '2px solid #e8e8e8',
                    width: 90
                }}>
                    <Tag style={{
                        borderRadius: 20, fontWeight: 600, fontSize: 11, border: 'none',
                        background: record.TargetType === 'YEARLY' ? '#ede9fe' : '#d1fae5',
                        color:      record.TargetType === 'YEARLY' ? '#6d28d9' : '#059669',
                        padding: '2px 10px'
                    }}>
                        {record.TargetType === 'YEARLY' ? 'Yearly' : 'Monthly'}
                    </Tag>
                </td>
            )}

            {/* Goal Type */}
            <td style={{
                padding: '10px 14px',
                verticalAlign: 'middle',
                background: cellBg,
                borderRight: '1px solid #f0f0f0',
                width: 130
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                        width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                        background: meta.bg,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 800, color: meta.color
                    }}>
                        {meta.unit}
                    </div>
                    <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: meta.color }}>
                            {meta.label}
                        </div>
                    </div>
                </div>
            </td>

            {/* Target Goal */}
            <td style={{
                padding: '10px 16px',
                verticalAlign: 'middle', textAlign: 'right',
                background: cellBg,
                borderRight: '1px solid #f0f0f0',
                width: 130
            }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: meta.color }}>
                    {fmtVal(total, meta.unit)}
                </div>
                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>
                    {meta.label} Goal
                </div>
            </td>

            {/* Sales Achieved */}
            <td style={{
                padding: '10px 16px',
                verticalAlign: 'middle', textAlign: 'right',
                background: cellBg,
                borderRight: '1px solid #f0f0f0',
                width: 140
            }}>
                <div style={{
                    fontSize: 14, fontWeight: 700,
                    color: overallAch > 0 ? tier.color : '#ef4444'
                }}>
                    {fmtVal(overallAch, meta.unit)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, justifyContent: 'flex-end' }}>
                    <Progress
                        percent={Math.min(overallPct, 100)}
                        strokeColor={tier.color}
                        trailColor="#f1f5f9"
                        size={[52, 3]}
                        showInfo={false}
                        strokeLinecap="round"
                    />
                    <Text style={{ fontSize: 10, fontWeight: 700, color: tier.color, minWidth: 28, textAlign: 'right' }}>
                        {overallPct}%
                    </Text>
                </div>
            </td>

            {/* Period cells */}
            {periods.map((_, idx) => {
                const pv  = idx + 1;
                const bd  = breakdowns.find((b: any) => (b.PeriodValue ?? b.periodValue) === pv);
                const tgt = bd?.TargetValue   ?? bd?.targetValue   ?? 0;
                const ach = bd?.AchievedValue ?? bd?.achievedValue ?? 0;
                return (
                    <td key={idx} style={{
                        padding: 0,
                        borderRight: '1px solid #f5f5f5',
                        verticalAlign: 'middle',
                        background: cellBg,
                        minWidth: 82
                    }}>
                        <PeriodCell target={tgt} achieved={ach} unit={meta.unit} color={meta.color} />
                    </td>
                );
            })}

            {/* Actions — rowSpan */}
            {isFirst && (
                <td rowSpan={brandRowSpan} style={{
                    padding: '0 12px',
                    verticalAlign: 'middle', textAlign: 'center',
                    background: '#fff',
                    borderLeft: '1px solid #f0f0f0',
                    borderBottom: '2px solid #e8e8e8',
                    position: 'sticky', right: 0, zIndex: 2,
                    width: 80
                }}>
                    <Space direction="vertical" size={6} align="center">
                        {perms.canEdit && (
                            <Tooltip title="Edit targets" placement="left">
                                <Button
                                    type="primary" shape="circle" size="small"
                                    icon={<Edit3 size={13} />}
                                    onClick={() => onEdit(record)}
                                    style={{
                                        background: '#4f46e5', borderColor: '#4f46e5',
                                        width: 30, height: 30,
                                        boxShadow: '0 2px 8px rgba(79,70,229,0.25)'
                                    }}
                                />
                            </Tooltip>
                        )}
                        {perms.canDelete && (
                            <Popconfirm
                                title="Delete all targets for this brand?"
                                description={`This permanently deletes all ${brandRowSpan} goal row(s) for ${record.SellerId}.`}
                                onConfirm={() => onDelete(record)}
                                okText="Delete All"
                                cancelText="Cancel"
                                okButtonProps={{ danger: true }}
                                placement="left"
                            >
                                <Tooltip title="Delete" placement="left">
                                    <Button
                                        danger shape="circle" size="small"
                                        icon={<Trash2 size={13} />}
                                        style={{ width: 30, height: 30 }}
                                    />
                                </Tooltip>
                            </Popconfirm>
                        )}
                    </Space>
                </td>
            )}
        </tr>
    );
});

// ─── Grouped table ────────────────────────────────────────────────────────────

const GroupedTable = memo(({
    groups, planType, perms, onEdit, onDelete
}: {
    groups: any[]; planType: 'YEARLY'|'MONTHLY';
    perms: any; onEdit: (r: any) => void; onDelete: (g: any) => void;
}) => {
    const periods = planType === 'YEARLY' ? MONTHS_SHORT : WEEKS_SHORT;

    if (groups.length === 0) {
        return (
            <tr>
                <td
                    colSpan={6 + periods.length + 1}
                    style={{ padding: '64px 24px', textAlign: 'center', background: '#fff' }}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                        <div style={{
                            width: 56, height: 56, borderRadius: '50%',
                            background: '#f1f5f9', display: 'flex',
                            alignItems: 'center', justifyContent: 'center'
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
                        goalType:        resolveGoalType(group),
                        totalTarget:     group.TotalTargetValue || 0,
                        overallAchieved: group.overallAchieved  || 0,
                        monthlyBreakdown: group.monthlyBreakdown || [],
                        weeklyBreakdown:  group.weeklyBreakdown  || [],
                        targetRecordId:  group._groupId
                    }];

                return rows.map((goalRow: any, rowIdx: number) => (
                    <GoalDataRow
                        key={`${group._groupId}_${rowIdx}`}
                        record={group}
                        goalRow={goalRow}
                        periods={periods}
                        isFirst={rowIdx === 0}
                        isLast={rowIdx === rows.length - 1}
                        brandRowSpan={rows.length}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        perms={perms}
                    />
                ));
            })}
        </>
    );
});

// ─── Main Page ────────────────────────────────────────────────────────────────

const TargetVsAchievement = () => {
    const navigate           = useNavigate();
    const perms              = useTargetPermissions();
    const [msgApi, msgCtx]   = message.useMessage();

    const {
        targets, loading, savingIds,
        createTargets, updateTarget, deleteTargets,
        refresh, contextHolder
    } = useTargetsData();

    const [planType,      setPlanType]      = useState<'YEARLY'|'MONTHLY'>('YEARLY');
    const [filterYear,    setFilterYear]    = useState(new Date().getFullYear());
    const [searchText,    setSearchText]    = useState('');
    const [addVisible,    setAddVisible]    = useState(false);
    const [editVisible,   setEditVisible]   = useState(false);
    const [editingRecord, setEditingRecord] = useState<any>(null);
    const [sellers,       setSellers]       = useState<any[]>([]);
    const [page,          setPage]          = useState(1);
    const [pageSize,      setPageSize]      = useState(20);

    // Load sellers
    useEffect(() => {
        sellerApi.getAll({ limit: 500 })
            .then((res: any) => {
                const list = res?.data?.sellers || res?.data || res?.sellers || [];
                setSellers(Array.isArray(list) ? list : []);
            })
            .catch((err: any) => console.error('[Sellers] load error:', err));
    }, []);

    // Group targets
    const grouped = useMemo(() => {
        const filtered = targets
            .filter(t => t.TargetType === planType)
            .filter(t => !filterYear || Number(t.Year || 0) === filterYear)
            .filter(t => {
                if (!searchText) return true;
                const q = searchText.toLowerCase();
                return (
                    (t.SellerId     || '').toLowerCase().includes(q) ||
                    (t.BrandManager || '').toLowerCase().includes(q)
                );
            });

        const map = new Map<string, any>();
        filtered.forEach(t => {
            const key = `${t.SellerId}__${t.Year}__${t.Month || 0}`;
            if (!map.has(key)) {
                map.set(key, {
                    _groupId:      key,
                    SellerId:      t.SellerId,
                    BrandManager:  t.BrandManager,
                    TargetType:    t.TargetType,
                    Year:          t.Year,
                    Month:         t.Month,
                    _allTargetIds: [] as string[],
                    goalRows:      [] as any[]
                });
            }
            const g = map.get(key)!;
            g._allTargetIds.push(t.Id);
            g.goalRows.push({
                goalType:         resolveGoalType(t),
                totalTarget:      t.TotalTargetValue || t.totalTargetValue || 0,
                overallAchieved:  t.overallAchieved  || 0,
                monthlyBreakdown: t.monthlyBreakdown  || [],
                weeklyBreakdown:  t.weeklyBreakdown   || [],
                breakdowns:       t.breakdowns        || [],
                targetRecordId:   t.Id
            });
        });
        return Array.from(map.values());
    }, [targets, planType, filterYear, searchText]);

    const totalGroups     = grouped.length;
    const totalGoalRows   = useMemo(() => grouped.reduce((s, g) => s + g.goalRows.length, 0), [grouped]);
    const paginatedGroups = useMemo(() => grouped.slice((page - 1) * pageSize, page * pageSize), [grouped, page, pageSize]);

    const availableYears = useMemo<number[]>(() => {
        const yrs = [...new Set<number>(targets.map(t => Number(t.Year || 0)))].sort((a: number, b: number) => b - a);
        return yrs.length ? yrs : [new Date().getFullYear()];
    }, [targets]);

    const editInitialData = useMemo(() => {
        if (!editingRecord) return [];
        const periodKeys = editingRecord.TargetType === 'YEARLY' ? MONTHS_SHORT : WEEKS_SHORT;
        return [{
            sectionId:  editingRecord._groupId,
            sellerId:   editingRecord.SellerId  || '',
            manager:    editingRecord.BrandManager || '',
            periodType: (editingRecord.TargetType || 'YEARLY') as 'YEARLY'|'MONTHLY',
            year:       editingRecord.Year  || new Date().getFullYear(),
            month:      editingRecord.Month || 1,
            collapsed:  false,
            goalRows: (editingRecord.goalRows || []).map((gr: any) => {
                const bds: any[] = gr.monthlyBreakdown || gr.weeklyBreakdown || gr.breakdowns || [];
                return {
                    goalRowId:   gr.targetRecordId || `gr_${Math.random()}`,
                    goalType:    resolveGoalType(gr),
                    totalTarget: gr.totalTarget || 0,
                    targetId:    gr.targetRecordId,
                    cells: periodKeys.map((_: string, i: number) => {
                        const pv = i + 1;
                        const bd = bds.find((b: any) => (b.PeriodValue ?? b.periodValue) === pv);
                        return {
                            value:         bd?.TargetValue            ?? bd?.targetValue            ?? 0,
                            pct:           bd?.PercentageContribution ?? bd?.percentageContribution ?? 0,
                            achievedValue: bd?.AchievedValue          ?? bd?.achievedValue          ?? 0,
                            breakdownId:   bd?.Id ?? bd?.id
                        };
                    })
                };
            })
        }];
    }, [editingRecord]);

    const handleEdit   = useCallback((r: any) => { if (perms.canEdit) { setEditingRecord(r); setEditVisible(true); } }, [perms.canEdit]);
    const handleDelete = useCallback(async (g: any) => { const ids = g._allTargetIds || []; if (ids.length) await deleteTargets(ids); }, [deleteTargets]);

    const handleAddSubmit = useCallback(async (sections: any[]) => {
        try {
            for (const section of sections) {
                if (!section.sellerId) continue;
                const valid = (section.goalRows || []).filter((r: any) => r.goalType && r.totalTarget > 0);
                if (!valid.length) continue;
                const payload = valid.map((r: any) => {
                    const cells = r.cells || r.breakdowns || [];
                    return {
                        sellerId: section.sellerId, brandManager: section.manager || '',
                        goalType: r.goalType, targetType: section.periodType,
                        year: section.year, month: section.periodType === 'MONTHLY' ? section.month : null,
                        totalTargetValue: r.totalTarget,
                        breakdowns: cells.map((c: any, i: number) => ({
                            periodValue: i + 1,
                            percentageContribution: c?.pct   ?? c?.percentageContribution ?? 0,
                            targetValue:            c?.value ?? c?.targetValue            ?? 0,
                            achievedValue:          c?.achievedValue ?? 0
                        }))
                    };
                });
                if (payload.length) await createTargets(payload);
            }
            setAddVisible(false);
            msgApi.success('Targets saved successfully!');
        } catch (err: any) {
            msgApi.error(err?.message || 'Error saving targets.');
        }
    }, [createTargets, msgApi]);

    const handleEditSubmit = useCallback(async (sections: any[]) => {
        try {
            for (const section of sections) {
                for (const r of (section.goalRows || [])) {
                    const targetId = r.targetId || r.targetRecordId;
                    if (!targetId || String(targetId).startsWith('gr_')) continue;
                    const cells = r.cells || r.breakdowns || [];
                    await updateTarget(targetId, r.totalTarget || 0, cells.map((c: any, i: number) => ({
                        periodValue: i + 1,
                        targetValue:            c?.value         ?? 0,
                        achievedValue:          c?.achievedValue ?? 0,
                        percentageContribution: c?.pct           ?? 0,
                        breakdownId:            c?.breakdownId
                    })));
                }
            }
            setEditVisible(false);
            setEditingRecord(null);
            msgApi.success('Targets updated successfully!');
        } catch (err: any) {
            msgApi.error(err?.message || 'Error updating targets.');
        }
    }, [updateTarget, msgApi]);

    const periods = planType === 'YEARLY' ? MONTHS_SHORT : WEEKS_SHORT;

    return (
        <Layout style={{ minHeight: '100%', background: '#f5f6fa' }}>
            {contextHolder}
            {msgCtx}

            {/* ── Page Header ──────────────────────────────────────── */}
            <div style={{ background: '#fff', borderBottom: '1px solid #e8e8e8', padding: '0 24px' }}>
                {/* Breadcrumb */}
                <div style={{ padding: '12px 0 0' }}>
                    <Breadcrumb
                        items={[
                            { title: <span style={{ color: '#94a3b8', fontSize: 12 }}>Intelligence</span> },
                            {
                                title: (
                                    <span
                                        style={{ color: '#64748b', fontSize: 12, cursor: 'pointer' }}
                                        onClick={() => navigate('/target-achievement')}
                                    >
                                        Target vs Achievement
                                    </span>
                                )
                            }
                        ]}
                    />
                </div>

                {/* Title row */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', padding: '10px 0 14px',
                    flexWrap: 'wrap', gap: 12
                }}>
                    <div>
                        <Title level={4} style={{ margin: 0, fontWeight: 700, color: '#0f172a', fontSize: 20 }}>
                            Target v/s Achievements
                        </Title>
                        <Text style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginTop: 2 }}>
                            Manage revenue targets, distribution splits, and sales achievements.
                        </Text>
                    </div>

                    <Space size={8} wrap>
                        {/* View toggle */}
                        <Space.Compact>
                            <Button
                                style={{
                                    fontWeight: 600, fontSize: 12,
                                    background: '#f5f3ff', borderColor: '#d8b4fe', color: '#7c3aed'
                                }}
                            >
                                Table View
                            </Button>
                            <Button
                                icon={<BarChart3 size={13} />}
                                onClick={() => navigate('/target-achievement/dashboard')}
                                style={{ fontWeight: 600, fontSize: 12 }}
                            >
                                Analytics Dashboard
                            </Button>
                        </Space.Compact>

                        {/* Plan type */}
                        <Space.Compact>
                            <Button
                                type={planType === 'YEARLY' ? 'primary' : 'default'}
                                onClick={() => { setPlanType('YEARLY'); setPage(1); }}
                                style={{
                                    fontWeight: 600, fontSize: 12,
                                    ...(planType === 'YEARLY'
                                        ? { background: '#1e293b', borderColor: '#1e293b' }
                                        : {})
                                }}
                            >
                                Yearly Plans
                            </Button>
                            <Button
                                type={planType === 'MONTHLY' ? 'primary' : 'default'}
                                onClick={() => { setPlanType('MONTHLY'); setPage(1); }}
                                style={{
                                    fontWeight: 600, fontSize: 12,
                                    ...(planType === 'MONTHLY'
                                        ? { background: '#1e293b', borderColor: '#1e293b' }
                                        : {})
                                }}
                            >
                                Monthly Plans
                            </Button>
                        </Space.Compact>

                        {/* Year */}
                        <Select
                            value={filterYear}
                            onChange={v => { setFilterYear(v); setPage(1); }}
                            style={{ width: 100 }}
                            suffixIcon={<span style={{ fontSize: 11, color: '#64748b' }}>▼</span>}
                        >
                            {availableYears.map(y => <Option key={y} value={y}>{y}</Option>)}
                        </Select>

                        {/* Refresh */}
                        <Tooltip title="Refresh data">
                            <Button
                                icon={<RefreshCw size={14} />}
                                onClick={refresh}
                                loading={loading}
                            >
                                Refresh
                            </Button>
                        </Tooltip>

                        {/* Add */}
                        {perms.canCreate && (
                            <Button
                                type="primary" icon={<Plus size={14} />}
                                onClick={() => setAddVisible(true)}
                                style={{ background: '#4f46e5', borderColor: '#4f46e5', fontWeight: 600 }}
                            >
                                Establish Targets
                            </Button>
                        )}
                    </Space>
                </div>
            </div>

            {/* ── Toolbar ──────────────────────────────────────────── */}
            <div style={{
                background: '#fff',
                padding: '10px 24px',
                borderBottom: '1px solid #e8e8e8',
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', gap: 16,
                flexWrap: 'wrap'
            }}>
                <Input
                    prefix={<Search size={14} style={{ color: '#94a3b8' }} />}
                    placeholder="Search by brand name or manager..."
                    value={searchText}
                    onChange={e => { setSearchText(e.target.value); setPage(1); }}
                    allowClear
                    style={{ width: 300, borderRadius: 6 }}
                />

                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    <Text style={{ fontSize: 12, color: '#64748b' }}>
                        Showing <Text strong>{totalGroups}</Text> brand records
                        {' · '}
                        <Text strong>{totalGoalRows}</Text> goal rows
                    </Text>

                    <Divider type="vertical" style={{ margin: 0 }} />

                    {/* Legend */}
                    <Space size={8}>
                        {[
                            { label: 'Elite (100%+)', color: '#059669', bg: '#d1fae5' },
                            { label: 'High (80%+)',   color: '#2563eb', bg: '#dbeafe' },
                            { label: 'Track (50%+)',  color: '#d97706', bg: '#fef3c7' },
                        ].map(item => (
                            <Tag
                                key={item.label}
                                style={{
                                    borderRadius: 20, fontWeight: 600, fontSize: 10,
                                    border: 'none', margin: 0,
                                    background: item.bg, color: item.color,
                                    padding: '2px 10px'
                                }}
                            >
                                {item.label}
                            </Tag>
                        ))}
                    </Space>
                </div>
            </div>

            {/* ── Table Content ─────────────────────────────────────── */}
            <Content style={{ padding: '16px 24px', flex: 1, minHeight: 0 }}>
                <div style={{
                    background: '#fff',
                    borderRadius: 8,
                    border: '1px solid #e8e8e8',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%'
                }}>
                    {/* Scrollable table area */}
                    <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto' }}>
                        <table style={{
                            borderCollapse: 'collapse',
                            width: '100%',
                            minWidth: periods.length * 85 + 730
                        }}>
                            {/* Head */}
                            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                                <tr style={{ background: '#fafafa', borderBottom: '2px solid #e8e8e8' }}>
                                    {[
                                        { label: 'Brand Name',    w: 200, sticky: true },
                                        { label: 'Manager',       w: 150, sticky: false },
                                        { label: 'Plan Type',     w: 90,  sticky: false },
                                        { label: 'Goal Type',     w: 130, sticky: false },
                                        { label: 'Target Goal',   w: 130, sticky: false },
                                        { label: 'Sales Achieved',w: 140, sticky: false },
                                    ].map((col, i) => (
                                        <th key={i} style={{
                                            padding: '11px 16px',
                                            textAlign: i >= 4 ? 'right' : 'left',
                                            fontSize: 11, fontWeight: 700,
                                            color: '#6b7280',
                                            letterSpacing: '0.05em',
                                            textTransform: 'uppercase',
                                            background: '#fafafa',
                                            borderRight: '1px solid #f0f0f0',
                                            borderBottom: '2px solid #e8e8e8',
                                            whiteSpace: 'nowrap',
                                            ...(col.sticky
                                                ? { position: 'sticky', left: 0, zIndex: 6 }
                                                : {}),
                                            width: col.w, minWidth: col.w
                                        }}>
                                            {col.label}
                                        </th>
                                    ))}

                                    {/* Period columns */}
                                    {periods.map((p, i) => (
                                        <th key={i} style={{
                                            padding: '8px 6px',
                                            textAlign: 'center',
                                            fontSize: 11, fontWeight: 700,
                                            color: '#6b7280',
                                            background: '#fafafa',
                                            borderRight: '1px solid #f0f0f0',
                                            borderBottom: '2px solid #e8e8e8',
                                            minWidth: 82, whiteSpace: 'nowrap'
                                        }}>
                                            <div>{p}</div>
                                            <div style={{
                                                display: 'flex', justifyContent: 'space-around',
                                                marginTop: 2, fontSize: 8,
                                                color: '#c4c4c4', fontWeight: 700
                                            }}>
                                                <span>T</span><span>A</span>
                                            </div>
                                        </th>
                                    ))}

                                    {/* Actions */}
                                    <th style={{
                                        padding: '11px 12px', textAlign: 'center',
                                        fontSize: 11, fontWeight: 700, color: '#6b7280',
                                        letterSpacing: '0.05em', textTransform: 'uppercase',
                                        background: '#fafafa',
                                        borderLeft: '1px solid #f0f0f0',
                                        borderBottom: '2px solid #e8e8e8',
                                        position: 'sticky', right: 0, zIndex: 6, width: 80
                                    }}>
                                        Actions
                                    </th>
                                </tr>
                            </thead>

                            <tbody>
                                {loading && grouped.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={6 + periods.length + 1}
                                            style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}
                                        >
                                            Loading targets...
                                        </td>
                                    </tr>
                                ) : (
                                    <GroupedTable
                                        groups={paginatedGroups}
                                        planType={planType}
                                        perms={perms}
                                        onEdit={handleEdit}
                                        onDelete={handleDelete}
                                    />
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* ── Pagination — fixed at bottom of table ─────── */}
                    {totalGroups > 0 && (
                        <div style={{
                            padding: '12px 24px',
                            borderTop: '1px solid #f0f0f0',
                            background: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexShrink: 0
                        }}>
                            <Text style={{ fontSize: 12, color: '#64748b' }}>
                                {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalGroups)} of{' '}
                                <Text strong>{totalGroups}</Text> brands
                                {' · '}
                                <Text strong>{totalGoalRows}</Text> goal rows
                            </Text>

                            <Pagination
                                current={page}
                                pageSize={pageSize}
                                total={totalGroups}
                                showSizeChanger
                                pageSizeOptions={['10', '20', '50']}
                                showQuickJumper={totalGroups > 50}
                                onChange={(p, ps) => {
                                    setPage(p);
                                    if (ps !== pageSize) { setPageSize(ps); setPage(1); }
                                }}
                                size="small"
                                style={{ margin: 0 }}
                            />
                        </div>
                    )}
                </div>
            </Content>

            {/* Row hover styles */}
            <style>{`
                thead th { user-select: none; }
                tbody tr:hover td { background: #f8f9ff !important; }
                tbody td { transition: background 0.12s ease; }
            `}</style>

            {/* ── Modals ────────────────────────────────────────────── */}
            {perms.canCreate && (
                <TargetSheetModal
                    visible={addVisible}
                    onClose={() => setAddVisible(false)}
                    sellers={sellers}
                    mode="add"
                    submitting={savingIds.size > 0}
                    onSubmit={handleAddSubmit}
                />
            )}

            {perms.canEdit && editVisible && editingRecord && (
                <TargetSheetModal
                    visible={editVisible}
                    onClose={() => { setEditVisible(false); setEditingRecord(null); }}
                    sellers={sellers}
                    mode="edit"
                    submitting={savingIds.size > 0}
                    initialData={editInitialData}
                    onSubmit={handleEditSubmit}
                />
            )}
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