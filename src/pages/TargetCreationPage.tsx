import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Layout, Button, Select, InputNumber, Space, Card, Row, Col,
    Typography, Tooltip, Tag, notification, message, Form, Empty,
    Divider, Badge, Breadcrumb, Statistic
} from 'antd';
import {
    Plus, Trash2, Save, Zap, ArrowLeft, Target,
    TrendingUp, AlertCircle, CheckCircle2, Building2
} from 'lucide-react';
import { useTargetsData } from '../hooks/useTargetsData';
import { sellerApi } from '../services/api';

const { Content, Header } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;

export const GOAL_TYPES = [
    { key: 'GMS', label: 'GMS', unit: '₹', color: '#10b981', bg: '#ecfdf5' },
    { key: 'ADS', label: 'ADS Spend', unit: '₹', color: '#ef4444', bg: '#fef2f2' },
    { key: 'ACOS', label: 'ACOS', unit: '%', color: '#8b5cf6', bg: '#f5f3ff' },
    { key: 'NEW_RC', label: 'New RC', unit: '#', color: '#f59e0b', bg: '#fffbeb' },
    { key: 'REVIEW', label: 'Reviews', unit: '#', color: '#3b82f6', bg: '#eff6ff' },
    { key: 'RATING', label: 'Rating', unit: '★', color: '#eab308', bg: '#fefce8' },
    { key: 'PO_FULFILMENT', label: 'PO Fulfilment', unit: '%', color: '#06b6d4', bg: '#ecfeff' },
    { key: 'PO_DAYS', label: 'PO Days', unit: 'd', color: '#ec4899', bg: '#fdf2f8' },
    { key: 'SELLER_CENTRAL_BUSINESS', label: 'SC Business', unit: '₹', color: '#14b8a6', bg: '#f0fdfa' },
];

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

function getGoal(key: string) {
    return GOAL_TYPES.find(g => g.key === key);
}

function periodLabels(t: 'YEARLY' | 'MONTHLY') {
    return t === 'YEARLY' ? MONTH_SHORT : Array.from({ length: 5 }, (_, i) => `W${i + 1}`);
}

type GoalRow = {
    id: string;
    targetId?: string;
    goalType: string;
    totalTarget: number;
    cells: { value: number; pct: number; achievedValue?: number; breakdownId?: string }[];
};

type BrandSection = {
    key: string;
    sellerId: string;
    brandManager: string;
    targetType: 'YEARLY' | 'MONTHLY';
    year: number;
    month: number;
    rows: GoalRow[];
    collapsed: boolean;
};

// ─── GoalRowComponent ─────────────────────────────────────────────────────────
const GoalRowComponent = memo(({
    row, periodType, usedTypes,
    onChange, onDelete, showAchieved, sectionRows
}: {
    row: GoalRow;
    periodType: 'YEARLY' | 'MONTHLY';
    isFirst: boolean;
    usedTypes: Set<string>;
    onChange: (updates: Partial<GoalRow>) => void;
    onDelete: () => void;
    showAchieved: boolean;
    sectionRows?: GoalRow[];
}) => {
    const goal = getGoal(row.goalType);
    const periods = periodLabels(periodType);
    const isCellLocked = !row.goalType || !row.totalTarget || row.totalTarget <= 0;

    const handleTotalChange = useCallback((total: number) => {
        if (row.goalType === 'ACOS') {
            onChange({
                totalTarget: total,
                cells: row.cells.map(c => ({ ...c, value: total, pct: 0 }))
            });
            return;
        }

        if (row.goalType === 'ADS') {
            const gmsRow = sectionRows?.find(r => r.goalType === 'GMS');
            const gmsTotal = gmsRow?.totalTarget || 0;
            const globalPct = gmsTotal > 0 ? (total / gmsTotal) * 100 : 0;

            onChange({
                totalTarget: total,
                cells: row.cells.map((c, i) => {
                    const gmsCellVal = gmsRow?.cells[i]?.value || 0;
                    return {
                        ...c,
                        value: gmsCellVal > 0 ? +(gmsCellVal * (globalPct / 100)).toFixed(2) : 0,
                        pct: +(globalPct).toFixed(2)
                    };
                })
            });
            return;
        }

        onChange({
            totalTarget: total,
            cells: row.cells.map(c => ({
                ...c,
                value: c.pct > 0 ? Math.round((c.pct / 100) * total * 100) / 100 : 0
            }))
        });
    }, [row.cells, row.goalType, sectionRows, onChange]);

    const updateCell = useCallback((
        idx: number,
        field: 'pct' | 'value' | 'achievedValue',
        v: number
    ) => {
        const gmsRow = sectionRows?.find(r => r.goalType === 'GMS');
        const gmsCellVal = gmsRow?.cells[idx]?.value || 0;

        const newCells = row.cells.map((c: any, i: number) => {
            if (i !== idx) return c;

            if (row.goalType === 'ADS' && gmsRow) {
                if (field === 'pct') {
                    return {
                        ...c, pct: v,
                        value: gmsCellVal > 0 ? Math.round((v / 100) * gmsCellVal * 100) / 100 : 0
                    };
                }
                if (field === 'value') {
                    return {
                        ...c, value: v,
                        pct: gmsCellVal > 0 ? Math.round((v / gmsCellVal) * 100 * 100) / 100 : 0
                    };
                }
            }

            const total = row.totalTarget || 0;
            if (field === 'pct') {
                return { ...c, pct: v, value: total > 0 ? Math.round((v / 100) * total * 100) / 100 : 0 };
            }
            if (field === 'value') {
                return { ...c, value: v, pct: total > 0 ? Math.round((v / total) * 100 * 100) / 100 : 0 };
            }
            return { ...c, achievedValue: v };
        });

        let newTotalTarget = row.totalTarget;
        if (row.goalType === 'ADS' && field !== 'achievedValue') {
            newTotalTarget = Math.round(newCells.reduce((sum, cell) => sum + (cell.value || 0), 0) * 100) / 100;
        }

        onChange({
            cells: newCells,
            ...(row.goalType === 'ADS' ? { totalTarget: newTotalTarget } : {})
        });
    }, [row.cells, row.totalTarget, row.goalType, sectionRows, onChange]);

    const splitEvenly = useCallback(() => {
        if (isCellLocked) return;
        const len = periods.length;
        const pct = Math.round((100 / len) * 100) / 100;
        const val = Math.round((row.totalTarget / len) * 100) / 100;
        onChange({
            cells: row.cells.map((c, i) => {
                const finalVal = i === len - 1 ? +(row.totalTarget - val * (len - 1)).toFixed(2) : val;

                if (row.goalType === 'ADS') {
                    const gmsRow = sectionRows?.find(r => r.goalType === 'GMS');
                    const gmsCellVal = gmsRow?.cells[i]?.value || 0;
                    return { ...c, value: finalVal, pct: gmsCellVal > 0 ? +(finalVal / gmsCellVal * 100).toFixed(2) : 0 };
                }

                return { ...c, pct: i === len - 1 ? +(100 - pct * (len - 1)).toFixed(2) : pct, value: finalVal };
            })
        });
    }, [row, periods.length, isCellLocked, sectionRows, onChange]);

    const totalPct = row.cells.reduce((s, c) => s + (c.pct || 0), 0);
    const pctOk = row.totalTarget > 0 && Math.abs(totalPct - 100) < 0.5;

    return (
        <tr style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#fafbfc'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}>
            {/* Metric Name */}
            <td style={{
                position: 'sticky', left: 0, zIndex: 3, padding: '12px 16px',
                background: 'inherit', borderRight: '1px solid #e2e8f0',
                minWidth: 160, verticalAlign: 'middle',
                boxShadow: '2px 0 4px -2px rgba(0,0,0,0.04)'
            }}>
                {row.goalType ? (
                    <Tag color={goal?.color} style={{
                        padding: '4px 10px', fontSize: 12, fontWeight: 700,
                        borderRadius: 6, margin: 0, border: 'none',
                        background: goal?.bg, color: goal?.color
                    }}>
                        {goal?.label}
                    </Tag>
                ) : (
                    <Select
                        placeholder="Select Metric"
                        value={row.goalType || undefined}
                        onChange={(v) => onChange({ goalType: v, totalTarget: 0, cells: row.cells.map(c => ({ ...c, value: 0, pct: 0 })) })}
                        style={{ width: '100%' }}
                        size="small"
                    >
                        {GOAL_TYPES.map((g) => (
                            <Option key={g.key} value={g.key} disabled={usedTypes.has(g.key)}>
                                <Tag color={g.color} style={{ margin: 0, border: 'none', background: g.bg, color: g.color, fontWeight: 600 }}>
                                    {g.label}
                                </Tag>
                            </Option>
                        ))}
                    </Select>
                )}
            </td>

            {/* Unit */}
            <td style={{
                padding: '12px 8px', borderRight: '1px solid #f1f5f9',
                textAlign: 'center', background: '#fafbfc'
            }}>
                <Tag style={{
                    margin: 0, fontSize: 11, fontWeight: 700,
                    background: '#fff', borderColor: '#e2e8f0', color: '#475569'
                }}>
                    {goal?.unit || '—'}
                </Tag>
            </td>

            {/* Period Cells */}
            {periods.map((_, i) => (
                <td key={i} style={{
                    padding: '8px 6px', borderRight: '1px solid #f1f5f9',
                    verticalAlign: 'top', minWidth: showAchieved ? 130 : 95
                }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <InputNumber
                                value={row.cells[i].value}
                                onChange={(v) => updateCell(i, 'value', v || 0)}
                                disabled={isCellLocked}
                                controls={false}
                                size="small"
                                placeholder="Val"
                                style={{
                                    width: '100%', fontSize: 12, fontWeight: 600,
                                    color: '#0f172a', borderRadius: 4
                                }}
                            />
                            <InputNumber
                                value={row.cells[i].pct}
                                onChange={(v) => updateCell(i, 'pct', v || 0)}
                                disabled={isCellLocked}
                                controls={false}
                                size="small"
                                placeholder="%"
                                suffix="%"
                                style={{
                                    width: '100%', fontSize: 10, color: '#64748b',
                                    background: '#f8fafc', borderRadius: 4
                                }}
                            />
                        </div>
                        {showAchieved && (
                            <div style={{ width: 50 }}>
                                <Tooltip title="Achieved Value">
                                    <InputNumber
                                        value={row.cells[i].achievedValue}
                                        onChange={(v) => updateCell(i, 'achievedValue', v || 0)}
                                        disabled={isCellLocked}
                                        controls={false}
                                        size="small"
                                        placeholder="Ach"
                                        style={{
                                            width: '100%', fontSize: 11, color: '#059669',
                                            borderColor: '#a7f3d0', background: '#f0fdf4', borderRadius: 4
                                        }}
                                    />
                                </Tooltip>
                            </div>
                        )}
                    </div>
                </td>
            ))}

            {/* Total Goal */}
            <td style={{
                padding: '8px 10px', position: 'sticky', right: 50, zIndex: 4,
                background: '#fafbff', borderLeft: '2px solid #e2e8f0', minWidth: 130,
                boxShadow: '-2px 0 4px -2px rgba(0,0,0,0.04)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <InputNumber
                        value={row.totalTarget}
                        onChange={(v) => handleTotalChange(v || 0)}
                        disabled={!row.goalType}
                        size="small"
                        controls={false}
                        style={{
                            width: '100%', fontSize: 13, fontWeight: 700,
                            color: '#1e293b', borderColor: '#cbd5e1'
                        }}
                    />
                    {row.goalType !== 'ACOS' && (
                        <Tooltip title="Split evenly across periods">
                            <Button
                                type="text" size="small"
                                icon={<Zap size={14} />}
                                onClick={splitEvenly}
                                disabled={isCellLocked}
                                style={{ color: '#8b5cf6', padding: '0 4px' }}
                            />
                        </Tooltip>
                    )}
                </div>
                {row.goalType !== 'ACOS' && row.totalTarget > 0 && (
                    <div style={{
                        fontSize: 10, textAlign: 'center', marginTop: 4,
                        fontWeight: 700, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', gap: 4,
                        color: pctOk ? '#10b981' : '#ef4444'
                    }}>
                        {pctOk ? <CheckCircle2 size={10} /> : <AlertCircle size={10} />}
                        {totalPct.toFixed(1)}% / 100%
                    </div>
                )}
            </td>

            {/* Delete */}
            <td style={{
                padding: '8px', textAlign: 'center', position: 'sticky', right: 0, zIndex: 4,
                background: '#fafbff', width: 50, borderLeft: '1px solid #f1f5f9'
            }}>
                <Tooltip title="Delete metric">
                    <Button type="text" danger icon={<Trash2 size={14} />} size="small" onClick={onDelete} />
                </Tooltip>
            </td>
        </tr>
    );
});

// ─── TargetCreationPage Main Component ──────────────────────────────────────────
export default function TargetCreationPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const [msgApi, msgCtx] = message.useMessage();

    const { createTargets, updateTarget } = useTargetsData();
    const [sellers, setSellers] = useState<any[]>([]);
    const [sections, setSections] = useState<BrandSection[]>([]);
    const [submitting, setSubmitting] = useState(false);

    const isEditMode = location.state?.mode === 'edit';
    const initialData = location.state?.initialData || [];

    const managerOptions = useMemo(() => {
        const set = new Set<string>();
        ['John Doe', 'Jane Smith', 'Alex Wong'].forEach(m => set.add(m));
        sellers.forEach(s => {
            (s.managers || []).forEach((m: any) => {
                if (m.firstName || m.lastName) {
                    set.add(`${m.firstName || ''} ${m.lastName || ''}`.trim());
                }
            });
        });
        return Array.from(set).map(name => ({ label: name, value: name }));
    }, [sellers]);

    useEffect(() => {
        sellerApi.getAll({ limit: 500 })
            .then((res: any) => {
                const list = res?.data?.sellers || res?.data || res?.sellers || [];
                setSellers(Array.isArray(list) ? list : []);
            })
            .catch(err => console.error('[Sellers] load error:', err));
    }, []);

    useEffect(() => {
        if (initialData && initialData.length > 0) {
            setSections(initialData.map((s: any) => ({
                key: s.sectionId || `sec_${Math.random()}`,
                sellerId: s.sellerId,
                brandManager: s.brandManager || s.manager || '',
                targetType: s.periodType || 'YEARLY',
                year: s.year || new Date().getFullYear(),
                month: s.month || 1,
                collapsed: false,
                rows: s.goalRows || []
            })));
        } else {
            handleAddSection();
        }
    }, []);

    const createEmptyRow = (periodType: 'YEARLY' | 'MONTHLY', gt?: string): GoalRow => {
        const len = periodType === 'YEARLY' ? 12 : 5;
        return {
            id: `row_${Math.random()}`,
            goalType: gt || '',
            totalTarget: 0,
            cells: Array.from({ length: len }, () => ({ value: 0, pct: 0 }))
        };
    };

    const handleAddSection = () => {
        setSections(prev => [
            {
                key: `sec_${Math.random()}`,
                sellerId: '',
                brandManager: '',
                targetType: 'YEARLY',
                year: new Date().getFullYear(),
                month: new Date().getMonth() + 1,
                collapsed: false,
                rows: [
                    createEmptyRow('YEARLY', 'GMS'),
                    createEmptyRow('YEARLY', 'ADS'),
                    createEmptyRow('YEARLY', 'ACOS')
                ]
            },
            ...prev
        ]);
    };

    const removeSection = (key: string) => {
        setSections(prev => prev.filter(s => s.key !== key));
    };

    const updateSectionConfig = (key: string, updates: Partial<BrandSection>) => {
        setSections(prev => prev.map(s => {
            if (s.key !== key) return s;
            const updated = { ...s, ...updates };
            if (updates.targetType && updates.targetType !== s.targetType) {
                updated.rows = updated.rows.map(r => createEmptyRow(updates.targetType as any, r.goalType));
            }
            return updated;
        }));
    };

    const handleRowChange = (sectionKey: string, rowId: string, updates: Partial<GoalRow>) => {
        setSections(prev => prev.map(s => {
            if (s.key !== sectionKey) return s;
            let newRows = s.rows.map(r => (r.id === rowId ? { ...r, ...updates } : r));

            const updatedRow = newRows.find(r => r.id === rowId);
            if (updatedRow && updatedRow.goalType === 'GMS') {
                const adsRowIdx = newRows.findIndex(r => r.goalType === 'ADS');
                if (adsRowIdx !== -1) {
                    const adsRow = newRows[adsRowIdx];
                    const newAdsCells = updatedRow.cells.map((c, i) => {
                        const currentAdsPct = adsRow.cells[i]?.pct || 5;
                        return {
                            ...adsRow.cells[i],
                            value: +(c.value * (currentAdsPct / 100)).toFixed(2),
                            pct: currentAdsPct
                        };
                    });
                    const newAdsTotal = +(newAdsCells.reduce((sum, cell) => sum + (cell.value || 0), 0)).toFixed(2);
                    newRows[adsRowIdx] = { ...adsRow, totalTarget: newAdsTotal, cells: newAdsCells };
                }
            }
            return { ...s, rows: newRows };
        }));
    };

    const addGoalTypeRow = (sectionKey: string, goalType: string) => {
        setSections(prev => prev.map(s => {
            if (s.key !== sectionKey) return s;
            return { ...s, rows: [...s.rows, createEmptyRow(s.targetType, goalType)] };
        }));
    };

    const removeGoalTypeRow = (sectionKey: string, rowId: string) => {
        setSections(prev => prev.map(s => {
            if (s.key !== sectionKey) return s;
            return { ...s, rows: s.rows.filter(r => r.id !== rowId) };
        }));
    };

    const handleSave = async () => {
        const invalidSection = sections.find(s => !s.sellerId);
        if (invalidSection) {
            notification.error({ message: 'Validation Error', description: 'Please select a brand/seller for all sections.' });
            return;
        }

        const sellerIds = sections.map(s => s.sellerId);
        if (sellerIds.some((id, index) => sellerIds.indexOf(id) !== index)) {
            notification.error({ message: 'Validation Error', description: 'Duplicate brands detected. Each brand must be in a single section.' });
            return;
        }

        setSubmitting(true);
        try {
            if (isEditMode) {
                for (const section of sections) {
                    for (const r of (section.rows || [])) {
                        const targetId = r.targetId;
                        if (!targetId || String(targetId).startsWith('gr_')) continue;
                        await updateTarget(targetId, r.totalTarget || 0, r.cells.map((c: any, i: number) => ({
                            periodValue: i + 1,
                            targetValue: c?.value ?? 0,
                            achievedValue: c?.achievedValue ?? 0,
                            percentageContribution: c?.pct ?? 0,
                            breakdownId: c?.breakdownId
                        })));
                    }
                }
                msgApi.success('Targets updated successfully!');
            } else {
                for (const section of sections) {
                    const valid = section.rows.filter(r => r.goalType && r.totalTarget > 0);
                    if (!valid.length) continue;
                    const payload = valid.map(r => ({
                        sellerId: section.sellerId, brandManager: section.brandManager || '',
                        goalType: r.goalType, targetType: section.targetType,
                        year: section.year, month: section.targetType === 'MONTHLY' ? section.month : null,
                        totalTargetValue: r.totalTarget,
                        breakdowns: r.cells.map((c: any, i: number) => ({
                            periodValue: i + 1,
                            percentageContribution: c.pct,
                            targetValue: c.value,
                            achievedValue: c.achievedValue || 0
                        }))
                    }));
                    if (payload.length) await createTargets(payload);
                }
                msgApi.success('Targets created successfully!');
            }
            navigate('/target-achievement');
        } catch (error: any) {
            console.error(error);
            notification.error({ message: 'Error Saving Targets', description: error.message || 'Failed to save targets.' });
        } finally {
            setSubmitting(false);
        }
    };

    const totalMetrics = sections.reduce((sum, s) => sum + s.rows.filter(r => r.goalType).length, 0);

    return (
        <Layout style={{ minHeight: '100vh', background: '#f1f5f9' }}>
            {msgCtx}

            {/* Header */}
            <Header style={{
                background: '#fff',
                borderBottom: '1px solid #e2e8f0',
                padding: '0 32px',
                height: 'auto',
                lineHeight: 'normal',
                paddingTop: 16,
                paddingBottom: 16,
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}>
                <Row justify="space-between" align="middle">
                    <Col>
                        <Space size={16} align="center">
                            <Button
                                icon={<ArrowLeft size={18} />}
                                type="text"
                                onClick={() => navigate('/target-achievement')}
                                style={{ height: 40, width: 40, borderRadius: 8 }}
                            />
                            <div>
                                <Breadcrumb
                                    items={[
                                        { title: 'Target Achievement' },
                                        { title: <Text strong>{isEditMode ? 'Edit' : 'Create'} Goals</Text> }
                                    ]}
                                    style={{ fontSize: 12, marginBottom: 4 }}
                                />
                                <Space align="center" size={12}>
                                    <Title level={4} style={{ margin: 0, color: '#0f172a' }}>
                                        <Target size={20} style={{ display: 'inline', marginRight: 8, color: '#3b82f6' }} />
                                        {isEditMode ? 'Edit Target Goals' : 'Create Target Goals'}
                                    </Title>
                                    <Badge
                                        count={`${sections.length} Brand${sections.length !== 1 ? 's' : ''}`}
                                        style={{ background: '#eff6ff', color: '#3b82f6', fontWeight: 600 }}
                                    />
                                    <Badge
                                        count={`${totalMetrics} Metric${totalMetrics !== 1 ? 's' : ''}`}
                                        style={{ background: '#f0fdf4', color: '#10b981', fontWeight: 600 }}
                                    />
                                </Space>
                            </div>
                        </Space>
                    </Col>
                    <Col>
                        <Space>
                            <Button
                                onClick={() => navigate('/target-achievement')}
                                size="large"
                                style={{ borderRadius: 8 }}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="primary"
                                icon={<Save size={16} />}
                                onClick={handleSave}
                                loading={submitting}
                                size="large"
                                style={{
                                    borderRadius: 8,
                                    background: '#3b82f6',
                                    boxShadow: '0 2px 8px rgba(59,130,246,0.3)'
                                }}
                            >
                                Save Targets
                            </Button>
                        </Space>
                    </Col>
                </Row>
            </Header>

            <Content style={{ padding: '24px 32px', maxWidth: 1600, margin: '0 auto', width: '100%' }}>
                <Space direction="vertical" size={20} style={{ width: '100%' }}>

                    {/* Add Section Button */}
                    {!isEditMode && (
                        <Button
                            type="dashed"
                            icon={<Plus size={18} />}
                            onClick={handleAddSection}
                            block
                            style={{
                                height: 56, borderRadius: 12, borderWidth: 2,
                                borderColor: '#cbd5e1', color: '#475569',
                                fontSize: 14, fontWeight: 600,
                                background: '#fff'
                            }}
                        >
                            Add Another Brand Target
                        </Button>
                    )}

                    {sections.length === 0 ? (
                        <Card style={{ borderRadius: 12 }}>
                            <Empty description="No targets configured. Click 'Add Another Brand Target' to begin." />
                        </Card>
                    ) : (
                        sections.map((section, sIdx) => {
                            const selectedSeller = sellers.find(s => (s._id || s.id) === section.sellerId);

                            return (
                                <Card
                                    key={section.key}
                                    style={{
                                        borderRadius: 12,
                                        boxShadow: '0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)',
                                        border: '1px solid #e2e8f0',
                                        overflow: 'hidden'
                                    }}
                                    styles={{ body: { padding: 0 } }}
                                >
                                    {/* Section Header */}
                                    <div style={{
                                        padding: '20px 24px',
                                        background: 'linear-gradient(to right, #f8fafc, #fff)',
                                        borderBottom: '1px solid #e2e8f0'
                                    }}>
                                        <Row justify="space-between" align="middle" gutter={[16, 16]}>
                                            <Col flex="auto">
                                                <Space size={16} align="center" wrap>
                                                    <div style={{
                                                        width: 40, height: 40, borderRadius: 10,
                                                        background: '#eff6ff', display: 'flex',
                                                        alignItems: 'center', justifyContent: 'center'
                                                    }}>
                                                        <Building2 size={20} color="#3b82f6" />
                                                    </div>
                                                    <div>
                                                        <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                                            Brand Section #{sIdx + 1}
                                                        </Text>
                                                        <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                                                            {selectedSeller?.name || 'Unnamed Brand'}
                                                        </div>
                                                    </div>
                                                </Space>
                                            </Col>
                                            <Col>
                                                {!isEditMode && (
                                                    <Tooltip title="Remove section">
                                                        <Button
                                                            type="text" danger
                                                            icon={<Trash2 size={16} />}
                                                            onClick={() => removeSection(section.key)}
                                                        />
                                                    </Tooltip>
                                                )}
                                            </Col>
                                        </Row>

                                        <Divider style={{ margin: '16px 0' }} />

                                        <Row gutter={[16, 12]}>
                                            <Col xs={24} sm={12} md={6}>
                                                <Form.Item label={<Text strong style={{ fontSize: 12 }}>Brand</Text>} style={{ margin: 0 }}>
                                                    <Select
                                                        showSearch
                                                        placeholder="Select Brand"
                                                        value={section.sellerId || undefined}
                                                        onChange={v => {
                                                            const sel = sellers.find(s => (s._id || s.id) === v);
                                                            const mgr = sel?.managers?.[0] ? `${sel.managers[0].firstName || ''} ${sel.managers[0].lastName || ''}`.trim() : '';
                                                            updateSectionConfig(section.key, { sellerId: v, brandManager: mgr });
                                                        }}
                                                        style={{ width: '100%' }}
                                                        disabled={isEditMode}
                                                        optionFilterProp="children"
                                                    >
                                                        {sellers.map(s => {
                                                            const sellerId = s._id || s.id;
                                                            return (
                                                                <Option key={sellerId} value={sellerId}>
                                                                    {s.name || sellerId}
                                                                </Option>
                                                            );
                                                        })}
                                                    </Select>
                                                </Form.Item>
                                            </Col>
                                            <Col xs={24} sm={12} md={5}>
                                                <Form.Item label={<Text strong style={{ fontSize: 12 }}>Manager</Text>} style={{ margin: 0 }}>
                                                    <Select
                                                        showSearch
                                                        placeholder="Brand Manager"
                                                        value={section.brandManager || undefined}
                                                        onChange={v => updateSectionConfig(section.key, { brandManager: v })}
                                                        style={{ width: '100%' }}
                                                        options={managerOptions}
                                                    />
                                                </Form.Item>
                                            </Col>
                                            <Col xs={24} sm={12} md={5}>
                                                <Form.Item label={<Text strong style={{ fontSize: 12 }}>Interval</Text>} style={{ margin: 0 }}>
                                                    <Select
                                                        value={section.targetType}
                                                        onChange={v => updateSectionConfig(section.key, { targetType: v })}
                                                        style={{ width: '100%' }}
                                                        disabled={isEditMode}
                                                    >
                                                        <Option value="YEARLY">Full Year (12 months)</Option>
                                                        <Option value="MONTHLY">Monthly (5 weeks)</Option>
                                                    </Select>
                                                </Form.Item>
                                            </Col>
                                            <Col xs={12} sm={6} md={3}>
                                                <Form.Item label={<Text strong style={{ fontSize: 12 }}>Year</Text>} style={{ margin: 0 }}>
                                                    <Select
                                                        value={section.year}
                                                        onChange={v => updateSectionConfig(section.key, { year: v })}
                                                        style={{ width: '100%' }}
                                                        disabled={isEditMode}
                                                    >
                                                        {[2024, 2025, 2026, 2027].map(y => <Option key={y} value={y}>{y}</Option>)}
                                                    </Select>
                                                </Form.Item>
                                            </Col>
                                            {section.targetType === 'MONTHLY' && (
                                                <Col xs={12} sm={6} md={5}>
                                                    <Form.Item label={<Text strong style={{ fontSize: 12 }}>Month</Text>} style={{ margin: 0 }}>
                                                        <Select
                                                            value={section.month}
                                                            onChange={v => updateSectionConfig(section.key, { month: v })}
                                                            style={{ width: '100%' }}
                                                            disabled={isEditMode}
                                                        >
                                                            {MONTH_NAMES.map((m, i) => <Option key={i + 1} value={i + 1}>{m}</Option>)}
                                                        </Select>
                                                    </Form.Item>
                                                </Col>
                                            )}
                                        </Row>
                                    </div>

                                    {/* Goals Table */}
                                    <div style={{ overflowX: 'auto', background: '#fff' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1200 }}>
                                            <thead>
                                                <tr style={{ background: '#f8fafc' }}>
                                                    <th style={{
                                                        padding: '14px 16px', borderBottom: '2px solid #e2e8f0',
                                                        textAlign: 'left', position: 'sticky', left: 0,
                                                        background: '#f8fafc', zIndex: 5, fontSize: 11,
                                                        fontWeight: 700, color: '#475569', letterSpacing: 0.5,
                                                        boxShadow: '2px 0 4px -2px rgba(0,0,0,0.04)'
                                                    }}>
                                                        GOAL METRIC
                                                    </th>
                                                    <th style={{
                                                        padding: '14px 8px', borderBottom: '2px solid #e2e8f0',
                                                        textAlign: 'center', fontSize: 11, fontWeight: 700,
                                                        color: '#475569', letterSpacing: 0.5
                                                    }}>
                                                        UNIT
                                                    </th>
                                                    {periodLabels(section.targetType).map((p, i) => (
                                                        <th key={i} style={{
                                                            padding: '10px 6px', borderBottom: '2px solid #e2e8f0',
                                                            textAlign: 'center', fontSize: 11, fontWeight: 700,
                                                            color: '#475569', letterSpacing: 0.5
                                                        }}>
                                                            <div style={{ fontWeight: 700, fontSize: 12, color: '#1e293b' }}>{p}</div>
                                                            <div style={{
                                                                display: 'flex', justifyContent: 'space-around',
                                                                fontSize: 9, color: '#94a3b8', marginTop: 4,
                                                                fontWeight: 600
                                                            }}>
                                                                <span>VAL</span><span>%</span>
                                                            </div>
                                                        </th>
                                                    ))}
                                                    <th style={{
                                                        padding: '14px 10px', borderBottom: '2px solid #e2e8f0',
                                                        textAlign: 'center', position: 'sticky', right: 50,
                                                        background: '#f8fafc', zIndex: 5, fontSize: 11,
                                                        fontWeight: 700, color: '#475569', letterSpacing: 0.5,
                                                        boxShadow: '-2px 0 4px -2px rgba(0,0,0,0.04)'
                                                    }}>
                                                        TOTAL GOAL
                                                    </th>
                                                    <th style={{
                                                        padding: '14px 8px', borderBottom: '2px solid #e2e8f0',
                                                        position: 'sticky', right: 0, background: '#f8fafc',
                                                        zIndex: 5, width: 50
                                                    }}></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {section.rows.map((row, rowIdx) => (
                                                    <GoalRowComponent
                                                        key={row.id}
                                                        row={row}
                                                        periodType={section.targetType}
                                                        isFirst={rowIdx === 0}
                                                        usedTypes={new Set(section.rows.map(r => r.goalType))}
                                                        onChange={updates => handleRowChange(section.key, row.id, updates)}
                                                        onDelete={() => removeGoalTypeRow(section.key, row.id)}
                                                        showAchieved={isEditMode}
                                                        sectionRows={section.rows}
                                                    />
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Footer - Add Metric */}
                                    <div style={{
                                        padding: '16px 24px', background: '#fafbfc',
                                        borderTop: '1px solid #e2e8f0',
                                        display: 'flex', alignItems: 'center', gap: 12
                                    }}>
                                        <TrendingUp size={16} color="#64748b" />
                                        <Text strong style={{ fontSize: 13, color: '#475569' }}>
                                            Add Goal Metric:
                                        </Text>
                                        <Select
                                            placeholder="Choose metric to add"
                                            style={{ width: 240 }}
                                            onChange={(v) => addGoalTypeRow(section.key, v)}
                                            value={undefined}
                                        >
                                            {GOAL_TYPES.map(g => (
                                                <Option key={g.key} value={g.key} disabled={section.rows.some(r => r.goalType === g.key)}>
                                                    <Tag color={g.color} style={{ margin: 0, border: 'none', background: g.bg, color: g.color, fontWeight: 600 }}>
                                                        {g.label}
                                                    </Tag>
                                                </Option>
                                            ))}
                                        </Select>
                                        <Text type="secondary" style={{ fontSize: 12, marginLeft: 'auto' }}>
                                            {section.rows.filter(r => r.goalType).length} of {GOAL_TYPES.length} metrics added
                                        </Text>
                                    </div>
                                </Card>
                            );
                        })
                    )}
                </Space>
            </Content>
        </Layout>
    );
}