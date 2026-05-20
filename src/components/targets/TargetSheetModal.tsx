import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
    Modal, Button, Select, InputNumber, Space, Card, Row, Col,
    Typography, Tooltip, Popconfirm, Tag, notification
} from 'antd';
import {
    Plus, Trash2, Save, Sparkles, ChevronDown, ChevronUp, Zap, Info
} from 'lucide-react';

const { Text } = Typography;
const { Option } = Select;

// Supported Goal Types Definition with premium branding colors
export const GOAL_TYPES = [
    { key: 'GMS', label: 'GMS', unit: '₹', color: '#10b981' },
    { key: 'ADS', label: 'ADS Spend', unit: '₹', color: '#ef4444' },
    { key: 'ACOS', label: 'ACOS', unit: '%', color: '#8b5cf6' },
    { key: 'NEW_RC', label: 'New RC', unit: '#', color: '#f59e0b' },
    { key: 'REVIEW', label: 'Reviews', unit: '#', color: '#3b82f6' },
    { key: 'RATING', label: 'Rating', unit: '★', color: '#eab308' },
    { key: 'PO_FULFILMENT', label: 'PO Fulfilment', unit: '%', color: '#06b6d4' },
    { key: 'PO_DAYS', label: 'PO Days', unit: 'd', color: '#ec4899' },
    { key: 'SELLER_CENTRAL_BUSINESS', label: 'SC Business', unit: '₹', color: '#14b8a6' },
];

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

// Aesthetic Premium Colors matching the Application UI theme
const COLOR = {
    primary: '#4f46e5',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    muted: '#94a3b8',
    surface: '#f8faff',
    border: '#e2e8f0',
};

interface GoalCell {
    value: number;
    pct: number;
    achievedValue?: number;
}

interface GoalRow {
    id: string;
    goalType: string;
    unit: string;
    totalTarget: number;
    cells: GoalCell[];
}

const getGoal = (goalType: string) => {
    return GOAL_TYPES.find(g => g.key === goalType);
};

const periodLabels = (periodType: 'YEARLY' | 'MONTHLY') => {
    return periodType === 'YEARLY' ? MONTH_SHORT : Array.from({ length: 5 }, (_, i) => `Week ${i + 1}`);
};

const makeCells = (periodType: 'YEARLY' | 'MONTHLY'): GoalCell[] => {
    const count = periodType === 'YEARLY' ? 12 : 5;
    return Array.from({ length: count }, () => ({ value: 0, pct: 0, achievedValue: 0 }));
};

const BreakdownCell = memo(({
    b, total, goal, showAchieved,
    onPct, onVal, onAch
}: {
    b:            { value: number; pct: number; achievedValue?: number };
    total:        number;
    goal?:        { label: string; unit: string; color: string };
    showAchieved: boolean;
    onPct:        (v: number) => void;
    onVal:        (v: number) => void;
    onAch?:       (v: number) => void;
}) => {
    const pct      = b.pct            || 0;
    const val      = b.value          || 0;
    const ach      = b.achievedValue  || 0;
    const achPct   = val > 0 ? Math.round((ach / val) * 100) : 0;
    const color    = goal?.color || '#4f46e5';
    const unit     = goal?.unit || '';
    const achColor = achPct >= 100
        ? '#059669'
        : achPct >= 80
            ? '#2563eb'
            : achPct >= 50
                ? '#d97706'
                : ach > 0 ? '#dc2626' : '#94a3b8';

    const isLocked = total <= 0;

    return (
        <td style={{
            padding: '3px 2px',
            borderRight: '1px solid #f1f5f9',
            verticalAlign: 'top',
            minWidth: showAchieved ? 92 : 76,
            background: isLocked
                ? '#f8fafc'
                : val > 0
                    ? `${color}07`
                    : '#fff',
            transition: 'background 0.15s'
        }}>
            {isLocked ? (
                // ── Locked: total not set yet ─────────────────────────
                <div style={{
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', padding: '6px 2px', gap: 3
                }}>
                    <span style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 700 }}>0</span>
                    <span style={{ fontSize: 10, color: '#e2e8f0', fontWeight: 600 }}>0%</span>
                    {showAchieved && (
                        <span style={{ fontSize: 10, color: '#e2e8f0', fontWeight: 600 }}>—</span>
                    )}
                </div>
            ) : (
                <>
                    {/* ── Target value input ────────────────────────── */}
                    <InputNumber
                        size="small"
                        min={0}
                        value={val || undefined}
                        placeholder="0"
                        onChange={v => onVal(parseFloat(String(v)) || 0)}
                        controls={false}
                        variant="borderless"
                        style={{ width: '100%' }}
                        styles={{
                            input: {
                                fontSize: 11, fontWeight: 700,
                                color: '#0f172a', textAlign: 'center',
                                padding: '1px 2px'
                            }
                        }}
                        formatter={unit === '₹'
                            ? v => v ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''
                            : undefined
                        }
                        parser={unit === '₹'
                            ? v => v?.replace(/,/g, '') as any
                            : undefined
                        }
                    />

                    {/* ── Percentage input ──────────────────────────── */}
                    <InputNumber
                        size="small"
                        min={0} max={100} step={0.1}
                        value={pct || undefined}
                        placeholder="0%"
                        onChange={v => onPct(parseFloat(String(v)) || 0)}
                        controls={false}
                        variant="borderless"
                        style={{ width: '100%' }}
                        styles={{
                            input: {
                                fontSize: 10, fontWeight: 600,
                                color: pct > 0 ? color : '#c4c4c4',
                                textAlign: 'center', padding: '0 2px'
                            }
                        }}
                        suffix={<span style={{ fontSize: 9, color: '#d1d5db' }}>%</span>}
                    />

                    {/* ── Achieved input — EDIT MODE ONLY ──────────── */}
                    {showAchieved && (
                        <>
                            {/* Divider line between target and achieved */}
                            <div style={{
                                height: 1,
                                background: '#e2e8f0',
                                margin: '3px 4px'
                            }} />

                            <InputNumber
                                size="small"
                                min={0}
                                value={ach || undefined}
                                placeholder="Actual"
                                onChange={v => onAch && onAch(parseFloat(String(v)) || 0)}
                                controls={false}
                                variant="borderless"
                                style={{ width: '100%' }}
                                styles={{
                                    input: {
                                        fontSize: 11, fontWeight: 700,
                                        color: ach > 0 ? achColor : '#94a3b8',
                                        textAlign: 'center', padding: '1px 2px'
                                    }
                                }}
                                formatter={unit === '₹'
                                    ? v => v ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''
                                    : undefined
                                }
                                parser={unit === '₹'
                                    ? v => v?.replace(/,/g, '') as any
                                    : undefined
                                }
                            />

                            {/* Achievement % badge */}
                            {ach > 0 && (
                                <div style={{
                                    textAlign: 'center', fontSize: 9,
                                    fontWeight: 700, color: achColor, marginTop: 1
                                }}>
                                    {achPct}% ach
                                </div>
                            )}
                        </>
                    )}

                    {/* Mini progress bar */}
                    {pct > 0 && (
                        <div style={{
                            height: 2, marginInline: 4,
                            marginTop: showAchieved ? 2 : 1,
                            background: '#f1f5f9', borderRadius: 99, overflow: 'hidden'
                        }}>
                            <div style={{
                                height: '100%',
                                width: `${Math.min(pct, 100)}%`,
                                background: color, borderRadius: 99
                            }} />
                        </div>
                    )}
                </>
            )}
        </td>
    );
});

// ─── GoalRowComponent ─────────────────────────────────────────────────────────
const GoalRowComponent = memo(({
    row, periodType, isFirst, usedTypes,
    onChange, onDelete, showAchieved
}: {
    row:          GoalRow;
    periodType:   'YEARLY' | 'MONTHLY';
    isFirst:      boolean;
    usedTypes:    Set<string>;
    onChange:     (updates: Partial<GoalRow>) => void;
    onDelete:     () => void;
    showAchieved: boolean;
}) => {
    const goal    = getGoal(row.goalType);
    const periods = periodLabels(periodType);

    // cells are locked until goal type AND total are both set
    const isCellLocked = !row.goalType || !row.totalTarget || row.totalTarget <= 0;

    // ── Total changes → keep % ratios, recalc values ──────────────────
    const handleTotalChange = useCallback((total: number) => {
        onChange({
            totalTarget: total,
            cells: row.cells.map(c => ({
                ...c,
                value: c.pct > 0
                    ? Math.round((c.pct / 100) * total * 100) / 100
                    : 0
            }))
        });
    }, [row.cells, onChange]);

    const updateCell = useCallback((
        idx:   number,
        field: 'pct' | 'value' | 'achievedValue',
        v:     number
    ) => {
        const total = row.totalTarget || 0;
        onChange({
            cells: row.cells.map((c: any, i: number) => {
                if (i !== idx) return c;
                if (field === 'pct') {
                    return {
                        ...c,
                        pct:   v,
                        value: total > 0 ? Math.round((v / 100) * total * 100) / 100 : 0
                    };
                }
                if (field === 'value') {
                    return {
                        ...c,
                        value: v,
                        pct:   total > 0 ? Math.round((v / total) * 100 * 100) / 100 : 0
                    };
                }
                // achievedValue — just update, no recalculation needed
                return { ...c, achievedValue: v };
            })
        });
    }, [row.cells, row.totalTarget, onChange]);

    // ── Split evenly ──────────────────────────────────────────────────
    const splitEvenly = useCallback(() => {
        if (isCellLocked) return;
        const len = periods.length;
        const pct = Math.round((100 / len) * 100) / 100;
        const val = Math.round((row.totalTarget / len) * 100) / 100;
        onChange({
            cells: row.cells.map((c, i) => ({
                pct:   i === len - 1 ? +(100 - pct * (len - 1)).toFixed(2) : pct,
                value: i === len - 1 ? +(row.totalTarget - val * (len - 1)).toFixed(2) : val
            }))
        });
    }, [row, periods.length, isCellLocked, onChange]);

    const totalPct = row.cells.reduce((s, c) => s + (c.pct || 0), 0);
    const pctOk    = row.totalTarget > 0 && Math.abs(totalPct - 100) < 0.5;

    return (
        <tr style={{
            borderBottom: '1px solid #f1f5f9',
        }}>

            {/* ── 1. Goal metric label (sticky left) ───────────────── */}
            <td style={{
                position: 'sticky', left: 0, zIndex: 3,
                padding: '8px 10px',
                background: '#fff',
                borderRight: '1px solid #e2e8f0',
                minWidth: 130, verticalAlign: 'middle'
            }}>
                {row.goalType ? (
                    <span style={{
                        fontSize: 12, fontWeight: 800,
                        color: goal?.color || '#0f172a',
                        letterSpacing: '0.02em'
                    }}>
                        {goal?.label}
                    </span>
                ) : (
                    // Empty row — show metric selector
                    <Select
                        placeholder="Choose metric"
                        size="small"
                        style={{ width: '100%' }}
                        onChange={v => onChange({
                            goalType: v,
                            cells: makeCells(periodType)
                        })}
                    >
                        {GOAL_TYPES.map(g => (
                            <Option
                                key={g.key} value={g.key}
                                disabled={usedTypes.has(g.key)}
                            >
                                <span style={{
                                    color: g.color, fontWeight: 700, fontSize: 11
                                }}>
                                    {g.label}
                                </span>
                                <span style={{ color: '#94a3b8', fontSize: 10, marginLeft: 5 }}>
                                    ({g.unit})
                                </span>
                            </Option>
                        ))}
                    </Select>
                )}
            </td>

            {/* ── 2. Unit ──────────────────────────────────────────── */}
            <td style={{
                padding: '8px 6px', textAlign: 'center',
                borderRight: '1px solid #e2e8f0',
                fontSize: 12, color: '#94a3b8', fontWeight: 700,
                verticalAlign: 'middle', width: 36
            }}>
                {goal?.unit || '—'}
            </td>

            {/* ── 3. Period cells (value + pct both editable) ───────── */}
            {row.cells.map((cell, idx) => (
                <BreakdownCell
                    key={idx}
                    b={cell}
                    total={row.totalTarget || 0}
                    goal={goal}
                    showAchieved={showAchieved}
                    onPct={v  => updateCell(idx, 'pct',           v)}
                    onVal={v  => updateCell(idx, 'value',         v)}
                    onAch={showAchieved ? v => updateCell(idx, 'achievedValue', v) : undefined}
                />
            ))}

            {/* ── 4. Total Goal input + split button (sticky right) ─── */}
            <td style={{
                position: 'sticky',
                right: !isFirst ? 38 : 0,
                zIndex: 3,
                padding: '6px 8px',
                background: '#fafbff',
                borderLeft: '2px solid #e2e8f0',
                minWidth: 130,
                verticalAlign: 'middle'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <InputNumber
                        size="small"
                        min={0}
                        value={row.totalTarget || undefined}
                        placeholder={row.goalType ? 'Set total first' : '—'}
                        disabled={!row.goalType}
                        onChange={v => handleTotalChange(parseFloat(String(v)) || 0)}
                        controls={false}
                        style={{ flex: 1 }}
                        styles={{
                            input: {
                                fontSize: 13, fontWeight: 800,
                                color: goal?.color || '#0f172a',
                                textAlign: 'right'
                            }
                        }}
                        prefix={
                            goal?.unit === '₹'
                                ? <span style={{ fontSize: 10, color: goal.color, fontWeight: 700 }}>₹</span>
                                : undefined
                        }
                        formatter={goal?.unit === '₹'
                            ? v => v ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''
                            : undefined
                        }
                        parser={goal?.unit === '₹'
                            ? v => v?.replace(/,/g, '') as any
                            : undefined
                        }
                    />

                    {/* Split evenly */}
                    <Tooltip title={isCellLocked ? 'Enter total first' : 'Split evenly'}>
                        <Button
                            size="small" type="text"
                            icon={<Zap size={13} />}
                            onClick={splitEvenly}
                            disabled={isCellLocked}
                            style={{
                                width: 26, height: 26, padding: 0, flexShrink: 0,
                                color: isCellLocked ? '#d1d5db' : (goal?.color || '#4f46e5')
                            }}
                        />
                    </Tooltip>
                </div>

                {/* Step hint */}
                {row.goalType && !row.totalTarget && (
                    <div style={{
                        marginTop: 4, fontSize: 9, fontWeight: 600,
                        color: '#f59e0b', textAlign: 'center'
                    }}>
                        ↑ Set total to unlock
                    </div>
                )}

                {/* Pct validation */}
                {row.totalTarget > 0 && (
                    <div style={{ marginTop: 3, textAlign: 'center' }}>
                        <span style={{
                            fontSize: 9, fontWeight: 800,
                            color: pctOk ? '#059669' : '#b45309'
                        }}>
                            {pctOk ? '✓ 100%' : `${totalPct.toFixed(1)}% / 100`}
                        </span>
                    </div>
                )}
            </td>

            {/* ── 5. DELETE BUTTON — shown on every non-first row ────── */}
            {!isFirst ? (
                <td style={{
                    position: 'sticky', right: 0, zIndex: 3,
                    width: 38, textAlign: 'center', verticalAlign: 'middle',
                    background: '#fafbff',
                    borderLeft: '1px solid #f1f5f9',
                    padding: '6px 5px'
                }}>
                    <Popconfirm
                        title="Remove this goal?"
                        description="This goal row and its values will be deleted."
                        onConfirm={onDelete}
                        okText="Remove"
                        cancelText="Keep"
                        okButtonProps={{ danger: true, size: 'small' }}
                        placement="left"
                    >
                        <Tooltip title="Remove goal row">
                            <Button
                                size="small"
                                type="text"
                                danger
                                icon={<Trash2 size={13} />}
                                style={{ width: 28, height: 28, padding: 0 }}
                            />
                        </Tooltip>
                    </Popconfirm>
                </td>
            ) : (
                <td style={{
                    position: 'sticky', right: 0, zIndex: 3,
                    width: 38, background: '#fafbff',
                    borderLeft: '1px solid #f1f5f9'
                }} />
            )}
        </tr>
    );
});

const EMPTY_ARRAY: any[] = [];

interface TargetSheetModalProps {
    visible: boolean;
    onClose: () => void;
    sellers?: any[];
    managers?: any[];
    mode?: 'add' | 'edit';
    submitting?: boolean;
    initialData?: any[];
    onSubmit: (sections: any[]) => Promise<void>;
}

// ─── TargetSheetModal Main Component ──────────────────────────────────────────
export const TargetSheetModal = ({
    visible,
    onClose,
    sellers = EMPTY_ARRAY,
    managers = EMPTY_ARRAY,
    mode = 'add',
    submitting: parentSubmitting = false,
    initialData = EMPTY_ARRAY,
    onSubmit
}: TargetSheetModalProps) => {
    const [sections, setSections] = useState<any[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
    const showAch = mode === 'edit';

    const generateId = () => Math.random().toString(36).substring(2, 11);

    // Initial default rows for GMS, ADS, and ACOS
    const createDefaultRows = (targetType: 'YEARLY' | 'MONTHLY'): GoalRow[] => {
        const periodCount = targetType === 'YEARLY' ? 12 : 5;
        return [
            {
                id: generateId(),
                goalType: 'GMS',
                unit: '₹',
                totalTarget: 0,
                cells: Array.from({ length: periodCount }, () => ({
                    value: 0,
                    pct: 0
                }))
            },
            {
                id: generateId(),
                goalType: 'ADS',
                unit: '₹',
                totalTarget: 0,
                cells: Array.from({ length: periodCount }, () => ({
                    value: 0,
                    pct: 0
                }))
            },
            {
                id: generateId(),
                goalType: 'ACOS',
                unit: '%',
                totalTarget: 0,
                cells: Array.from({ length: periodCount }, () => ({
                    value: 0,
                    pct: 0
                }))
            }
        ];
    };

    const addNewSection = () => {
        const newKey = generateId();
        const defaultTargetType = 'YEARLY';
        const newSection = {
            key: newKey,
            sellerId: '',
            brandManager: '',
            targetType: defaultTargetType,
            year: new Date().getFullYear(),
            month: new Date().getMonth() + 1,
            rows: createDefaultRows(defaultTargetType),
        };
        setSections((prev) => [...prev, newSection]);
        setExpandedKeys((prev) => [...prev, newKey]);
    };

    useEffect(() => {
        if (!visible) {
            setSections([]);
            setExpandedKeys([]);
            return;
        }

        if (mode === 'edit' && initialData && initialData.length > 0) {
            const editSections = initialData.map((sec: any) => ({
                key: sec.sectionId || sec.key || generateId(),
                sellerId: sec.sellerId || '',
                brandManager: sec.brandManager || sec.manager || '',
                targetType: sec.targetType || sec.periodType || 'YEARLY',
                year: sec.year || new Date().getFullYear(),
                month: sec.month || new Date().getMonth() + 1,
                rows: (sec.goalRows || sec.rows || []).map((row: any) => ({
                    id: row.goalRowId || row.targetId || row.id || generateId(),
                    targetId: row.targetId || row.goalRowId || row.id,
                    goalType: row.goalType,
                    unit: GOAL_TYPES.find(g => g.key === row.goalType)?.unit || '#',
                    totalTarget: row.totalTarget || 0,
                    cells: (row.cells || []).map((c: any) => ({
                        value: c.value || 0,
                        pct: c.pct || 0,
                        achievedValue: c.achievedValue || 0,
                        breakdownId: c.breakdownId || c.id
                    }))
                }))
            }));
            setSections(editSections);
            setExpandedKeys(editSections.map((s: any) => s.key));
        } else {
            if (sections.length === 0) {
                addNewSection();
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    const removeSection = (key: string) => {
        setSections((prev) => prev.filter((s) => s.key !== key));
        setExpandedKeys((prev) => prev.filter((k) => k !== key));
    };

    const updateSectionConfig = (key: string, field: string, value: any) => {
        setSections((prev) =>
            prev.map((s) => {
                if (s.key !== key) return s;
                const updated = { ...s, [field]: value };
                if (field === 'targetType') {
                    const periodCount = value === 'YEARLY' ? 12 : 5;
                    updated.rows = s.rows.map((row) => {
                        const evenVal = Math.round((row.totalTarget / periodCount) * 100) / 100;
                        const evenPct = Math.round((100 / periodCount) * 100) / 100;
                        return {
                            ...row,
                            cells: Array.from({ length: periodCount }, (_, i) => ({
                                value: i === periodCount - 1 ? +(row.totalTarget - evenVal * (periodCount - 1)).toFixed(2) : evenVal,
                                pct: i === periodCount - 1 ? +(100 - evenPct * (periodCount - 1)).toFixed(2) : evenPct
                            }))
                        };
                    });
                }
                return updated;
            })
        );
    };

    const addGoalTypeRow = (sectionKey: string, goalTypeKey: string) => {
        const goalDef = GOAL_TYPES.find((g) => g.key === goalTypeKey) || { label: goalTypeKey, unit: '#', color: '#4f46e5' };
        setSections((prev) =>
            prev.map((s) => {
                if (s.key !== sectionKey) return s;
                if (s.rows.some((r) => r.goalType === goalTypeKey)) {
                    notification.warning({ message: 'Warning', description: `${goalDef.label} row already exists for this brand.` });
                    return s;
                }
                const periodCount = s.targetType === 'YEARLY' ? 12 : 5;
                const newRow: GoalRow = {
                    id: generateId(),
                    goalType: goalTypeKey,
                    unit: goalDef.unit,
                    totalTarget: 0,
                    cells: Array.from({ length: periodCount }, () => ({
                        value: 0,
                        pct: 0
                    }))
                };
                return { ...s, rows: [...s.rows, newRow] };
            })
        );
    };

    const removeGoalTypeRow = (sectionKey: string, rowId: string) => {
        setSections((prev) =>
            prev.map((s) => {
                if (s.key !== sectionKey) return s;
                return { ...s, rows: s.rows.filter((r) => r.id !== rowId) };
            })
        );
    };

    const handleRowChange = (sectionKey: string, rowId: string, updates: Partial<GoalRow>) => {
        setSections((prev) =>
            prev.map((s) => {
                if (s.key !== sectionKey) return s;
                return {
                    ...s,
                    rows: s.rows.map((r) => (r.id === rowId ? { ...r, ...updates } : r))
                };
            })
        );
    };

    const handleSave = async () => {
        const invalidSection = sections.find((s) => !s.sellerId);
        if (invalidSection) {
            notification.error({ message: 'Validation Error', description: 'Please select a brand/seller for all sections.' });
            return;
        }

        const sellerIds = sections.map((s) => s.sellerId);
        const hasDuplicates = sellerIds.some((id, index) => sellerIds.indexOf(id) !== index);
        if (hasDuplicates) {
            notification.error({ message: 'Validation Error', description: 'Duplicate brands detected. Each brand must be in a single section.' });
            return;
        }

        setSubmitting(true);

        try {
            const mappedSections = sections.map((sec) => ({
                sectionId: sec.key,
                sellerId: sec.sellerId,
                manager: sec.brandManager,
                periodType: sec.targetType,
                year: sec.year,
                month: sec.month,
                goalRows: sec.rows.map((row) => ({
                    targetId: row.targetId || row.id,
                    goalRowId: row.id,
                    goalType: row.goalType,
                    totalTarget: row.totalTarget,
                    cells: row.cells.map((c) => ({
                        value: c.value,
                        pct: c.pct,
                        achievedValue: c.achievedValue || 0,
                        breakdownId: c.breakdownId
                    }))
                }))
            }));

            await onSubmit(mappedSections);
            onClose();
        } catch (error: any) {
            console.error(error);
            notification.error({ message: 'Error Saving Targets', description: error.message || 'Failed to save target sheet.' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleAccordionToggle = (key: string) => {
        setExpandedKeys((prev) =>
            prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
        );
    };

    return (
        <Modal
            title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Sparkles color={COLOR.primary} size={20} />
                    <div>
                        <span style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Excel Grouped Brand Target Entry</span>
                        <span style={{ fontSize: 12, fontWeight: 500, color: COLOR.muted, display: 'block', marginTop: 2 }}>
                            Define multiple metrics/goal targets dynamically per brand
                        </span>
                    </div>
                </div>
            }
            open={visible}
            onCancel={onClose}
            width="96%"
            style={{ maxWidth: 1400, top: 40 }}
            styles={{ body: { padding: '24px 16px', maxHeight: '72vh', overflowY: 'auto', background: '#f8fafc' } }}
            footer={[
                <Button key="cancel" onClick={onClose} style={{ borderRadius: 8, height: 40 }}>
                    Cancel
                </Button>,
                <Button
                    key="save"
                    type="primary"
                    icon={<Save size={16} />}
                    loading={submitting || parentSubmitting}
                    onClick={handleSave}
                    style={{
                        borderRadius: 8,
                        height: 40,
                        background: `linear-gradient(135deg, ${COLOR.primary}, #6366f1)`,
                        border: 'none',
                        boxShadow: `0 4px 12px ${COLOR.primary}30`
                    }}
                >
                    Save All Targets
                </Button>
            ]}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {sections.map((section, sectionIdx) => {
                    const isExpanded = expandedKeys.includes(section.key);
                    const selectedSeller = sellers.find((x) => (x.sellerId || x.SellerId || x.Id || x._id) === section.sellerId);
                    const sellerName = selectedSeller?.name || selectedSeller?.Name || section.sellerId || 'Select Brand';
                    const gmsRow = section.rows.find((r) => r.goalType === 'GMS');
                    const totalGmsGoal = gmsRow?.totalTarget || 0;
                    const periods = periodLabels(section.targetType);

                    return (
                        <Card
                            key={section.key}
                            className="hover-lift"
                            style={{
                                borderRadius: 16,
                                border: `1.5px solid ${isExpanded ? `${COLOR.primary}40` : COLOR.border}`,
                                overflow: 'hidden',
                                boxShadow: isExpanded ? '0 10px 25px -5px rgba(79, 70, 229, 0.08)' : '0 4px 6px -1px rgba(0, 0, 0, 0.02)',
                                transition: 'all 0.3s ease'
                            }}
                            styles={{ body: { padding: 0 } }}
                        >
                            {/* COLLAPSIBLE HEADER BAR */}
                            <div
                                style={{
                                    padding: '16px 24px',
                                    background: isExpanded ? `linear-gradient(90deg, #f8faff, #fff)` : '#fff',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    cursor: 'pointer',
                                    borderBottom: isExpanded ? `1px solid ${COLOR.border}` : 'none'
                                }}
                                onClick={() => handleAccordionToggle(section.key)}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <div style={{
                                        width: 40, height: 40, borderRadius: 12,
                                        background: section.sellerId ? `${COLOR.primary}15` : '#f1f5f9',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 14, fontWeight: 800, color: section.sellerId ? COLOR.primary : COLOR.muted,
                                        transition: 'all 0.3s'
                                    }}>
                                        {section.sellerId ? sellerName[0].toUpperCase() : '?'}
                                    </div>
                                    <div>
                                        <Text strong style={{ fontSize: 16, color: '#0f172a' }}>{sellerName}</Text>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 2 }}>
                                            <Tag color={section.targetType === 'YEARLY' ? 'blue' : 'orange'} style={{ borderRadius: 6 }}>
                                                {section.targetType} {section.year}
                                            </Tag>
                                            {section.brandManager && (
                                                <span style={{ fontSize: 12, color: COLOR.muted, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                    👤 Manager: {section.brandManager}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }} onClick={(e) => e.stopPropagation()}>
                                    {/* Quick Summary Totals */}
                                    <div style={{ textAlign: 'right' }}>
                                        <span style={{ fontSize: 11, color: COLOR.muted, display: 'block' }}>GMS Goal Total</span>
                                        <Text strong style={{ fontSize: 15, color: COLOR.success }}>
                                            ₹{totalGmsGoal.toLocaleString('en-IN')}
                                        </Text>
                                    </div>

                                    {/* Action Buttons */}
                                    <Space size={8}>
                                        <Popconfirm
                                            title="Delete this brand section?"
                                            onConfirm={() => removeSection(section.key)}
                                            okText="Yes" cancelText="No"
                                        >
                                            <Button
                                                type="text"
                                                danger
                                                icon={<Trash2 size={16} />}
                                                style={{ borderRadius: 8 }}
                                            />
                                        </Popconfirm>
                                        <Button
                                            type="text"
                                            onClick={() => handleAccordionToggle(section.key)}
                                            icon={isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                            style={{ borderRadius: 8 }}
                                        />
                                    </Space>
                                </div>
                            </div>

                            {/* COLLAPSED EXPANSION CONTENT */}
                            {isExpanded && (
                                <div style={{ padding: '24px 28px', background: '#fff' }}>
                                    {/* CONFIG CONFIGURATION ROW */}
                                    <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
                                        <Col xs={24} md={6}>
                                            <Text strong style={{ fontSize: 12, color: '#475569', display: 'block', marginBottom: 6 }}>Select Brand</Text>
                                            <Select
                                                style={{ width: '100%', borderRadius: 8 }}
                                                value={section.sellerId || undefined}
                                                placeholder="Choose seller brand"
                                                onChange={(val) => {
                                                    const s = sellers.find((x: any) => (x.sellerId || x.SellerId || x.Id || x._id) === val);
                                                    const firstMgr = s?.managers?.[0];
                                                    const mgrName = firstMgr ? `${firstMgr.firstName || ''} ${firstMgr.lastName || ''}`.trim() : '';
                                                    updateSectionConfig(section.key, 'sellerId', val);
                                                    if (mgrName) {
                                                        updateSectionConfig(section.key, 'brandManager', mgrName);
                                                    }
                                                }}
                                            >
                                                {sellers.map((s: any) => {
                                                    const v = s.sellerId || s.SellerId || s.Id || s._id;
                                                    const l = s.name || s.Name || v;
                                                    return (
                                                        <Option key={v} value={v}>
                                                            {l} ({v})
                                                        </Option>
                                                    );
                                                })}
                                            </Select>
                                        </Col>

                                        <Col xs={24} md={6}>
                                            <Text strong style={{ fontSize: 12, color: '#475569', display: 'block', marginBottom: 6 }}>Brand Manager</Text>
                                            <Select
                                                showSearch
                                                placeholder="Assign manager"
                                                value={section.brandManager || undefined}
                                                onChange={(val) => updateSectionConfig(section.key, 'brandManager', val)}
                                                optionFilterProp="children"
                                                style={{ width: '100%' }}
                                            >
                                                {managers.map((m: any) => {
                                                    const fullName = `${m.firstName || ''} ${m.lastName || ''}`.trim();
                                                    return <Option key={m.id || m._id} value={fullName}>{fullName}</Option>;
                                                })}
                                            </Select>
                                        </Col>

                                        <Col xs={12} md={4}>
                                            <Text strong style={{ fontSize: 12, color: '#475569', display: 'block', marginBottom: 6 }}>Planning Interval</Text>
                                            <Select
                                                style={{ width: '100%' }}
                                                value={section.targetType}
                                                onChange={(val) => updateSectionConfig(section.key, 'targetType', val)}
                                            >
                                                <Option value="YEARLY">Full Year (12m)</Option>
                                                <Option value="MONTHLY">Month-to-Weeks</Option>
                                            </Select>
                                        </Col>

                                        <Col xs={12} md={4}>
                                            <Text strong style={{ fontSize: 12, color: '#475569', display: 'block', marginBottom: 6 }}>Year</Text>
                                            <Select
                                                style={{ width: '100%' }}
                                                value={section.year}
                                                onChange={(val) => updateSectionConfig(section.key, 'year', val)}
                                            >
                                                {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map((y) => (
                                                    <Option key={y} value={y}>{y}</Option>
                                                ))}
                                            </Select>
                                        </Col>

                                        {section.targetType === 'MONTHLY' && (
                                            <Col xs={12} md={4}>
                                                <Text strong style={{ fontSize: 12, color: '#475569', display: 'block', marginBottom: 6 }}>Planning Month</Text>
                                                <Select
                                                    style={{ width: '100%' }}
                                                    value={section.month}
                                                    onChange={(val) => updateSectionConfig(section.key, 'month', val)}
                                                >
                                                    {MONTH_NAMES.map((m, i) => (
                                                        <Option key={i + 1} value={i + 1}>{m}</Option>
                                                    ))}
                                                </Select>
                                            </Col>
                                        )}
                                    </Row>

                                    {/* EXCEL SHEET SPREADSHEET ELEMENT */}
                                    <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 12, background: '#f8fafc', padding: 1 }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 1000 }}>
                                            <thead>
                                                <tr style={{ background: '#f8faff', borderBottom: '2px solid #e2e8f0' }}>
                                                    {/* Goal Metric */}
                                                    <th style={{
                                                        position: 'sticky', left: 0, zIndex: 4,
                                                        padding: '8px 10px', textAlign: 'left',
                                                        fontSize: 10, fontWeight: 800, color: '#475569',
                                                        textTransform: 'uppercase', letterSpacing: '0.05em',
                                                        background: '#f8faff',
                                                        borderRight: '1px solid #e2e8f0', minWidth: 130
                                                    }}>
                                                        Goal Metric
                                                    </th>

                                                    {/* Unit */}
                                                    <th style={{
                                                        padding: '8px 6px', textAlign: 'center',
                                                        fontSize: 10, fontWeight: 800, color: '#475569',
                                                        textTransform: 'uppercase', letterSpacing: '0.05em',
                                                        borderRight: '1px solid #e2e8f0', width: 36
                                                    }}>
                                                        Unit
                                                    </th>

                                                    {/* Period columns */}
                                                    {periods.map((p, i) => (
                                                        <th key={i} style={{
                                                            padding: '8px 4px', textAlign: 'center',
                                                            fontSize: 10, fontWeight: 700, color: '#475569',
                                                            borderRight: '1px solid #f1f5f9',
                                                            minWidth: 76, letterSpacing: '0.03em'
                                                        }}>
                                                            {p}
                                                        </th>
                                                    ))}

                                                    {/* Total Goal */}
                                                    <th style={{
                                                        position: 'sticky', right: 38, zIndex: 4,
                                                        padding: '8px 10px', textAlign: 'center',
                                                        fontSize: 10, fontWeight: 800, color: '#475569',
                                                        textTransform: 'uppercase', letterSpacing: '0.05em',
                                                        background: '#f8faff',
                                                        borderLeft: '2px solid #e2e8f0', minWidth: 130
                                                    }}>
                                                        Total Goal
                                                    </th>

                                                    {/* Delete column header — empty */}
                                                    <th style={{
                                                        position: 'sticky', right: 0, zIndex: 4,
                                                        width: 38, background: '#f8faff',
                                                        borderLeft: '1px solid #f1f5f9'
                                                    }} />
                                                </tr>

                                                {/* Sub-label row: value / % */}
                                                <tr style={{ background: '#fafbff', borderBottom: '1px solid #e2e8f0' }}>
                                                    <td style={{
                                                        position: 'sticky', left: 0, zIndex: 4,
                                                        padding: '3px 10px', background: '#fafbff',
                                                        borderRight: '1px solid #e2e8f0'
                                                    }} />
                                                    <td style={{ borderRight: '1px solid #e2e8f0' }} />
                                                    {periods.map((_, i) => (
                                                        <td key={i} style={{
                                                            padding: '2px 4px',
                                                            borderRight: '1px solid #f1f5f9',
                                                            textAlign: 'center'
                                                        }}>
                                                            <div style={{
                                                                display: 'flex', justifyContent: 'space-around',
                                                                fontSize: 8, color: '#c4c4c4', fontWeight: 700
                                                            }}>
                                                                <span>VAL</span>
                                                                <span>%</span>
                                                                {showAch && (
                                                                    <span style={{ fontSize: 8, color: '#10b981', fontWeight: 700 }}>ACH</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                    ))}
                                                    <td style={{
                                                        position: 'sticky', right: 38, zIndex: 4,
                                                        background: '#fafbff',
                                                        borderLeft: '2px solid #e2e8f0'
                                                    }} />
                                                    <td style={{
                                                        position: 'sticky', right: 0, zIndex: 4,
                                                        width: 38, background: '#fafbff',
                                                        borderLeft: '1px solid #f1f5f9'
                                                    }} />
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {section.rows.map((row, rowIdx) => (
                                                    <GoalRowComponent
                                                        key={row.id}
                                                        row={row}
                                                        periodType={section.targetType}
                                                        isFirst={rowIdx === 0}
                                                        usedTypes={new Set<string>(section.rows.map((r: any) => r.goalType))}
                                                        onChange={(updates) => handleRowChange(section.key, row.id, updates)}
                                                        onDelete={() => removeGoalTypeRow(section.key, row.id)}
                                                        showAchieved={showAch}
                                                    />
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* BOTTOM ACTIONS AND ROW ADDITION */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Add Goal metric:</span>
                                            <Select
                                                size="small"
                                                style={{ width: 160 }}
                                                placeholder="Choose metric"
                                                onChange={(val) => addGoalTypeRow(section.key, val)}
                                                value={undefined}
                                            >
                                                {GOAL_TYPES.filter(g => !section.rows.some((r: any) => r.goalType === g.key)).map((g) => (
                                                    <Option key={g.key} value={g.key}>{g.label}</Option>
                                                ))}
                                            </Select>
                                        </div>

                                        <div style={{ color: COLOR.muted, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <Info size={14} />
                                            <span>Values are auto-saved locally before final submit</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </Card>
                    );
                })}

                {/* ADD BRAND SECTION BUTTON */}
                <Button
                    type="dashed"
                    onClick={addNewSection}
                    icon={<Plus size={16} />}
                    style={{
                        height: 52,
                        borderRadius: 14,
                        fontSize: 14,
                        fontWeight: 700,
                        color: COLOR.primary,
                        borderColor: COLOR.primary,
                        background: `${COLOR.primary}05`,
                        boxShadow: 'none',
                        transition: 'all 0.2s'
                    }}
                    className="add-brand-button"
                >
                    Add Brand Section Goal Setup
                </Button>
            </div>
        </Modal>
    );
};
