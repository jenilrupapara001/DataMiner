import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import {
    Table, Button, Modal, Select, InputNumber, Tabs, Input,
    Space, Card, Row, Col, Typography, Progress, Badge, Alert,
    Tag, Tooltip, notification, Popconfirm, Divider, Segmented,
    Steps, Slider
} from 'antd';
import {
    Plus, Target, DollarSign, Percent, Save, CheckCircle,
    AlertTriangle, Edit3, Trash2, Calendar, LayoutGrid, Check,
    TrendingUp, Layers, ChevronLeft, ChevronRight, Minimize2,
    Award, BarChart3, Search, RefreshCw, CheckCircle2, Zap,
    ArrowUpRight, ArrowDownRight, User, ArrowRight, Sparkles, PieChart, Info
} from 'lucide-react';
import { usePageTitle } from '../contexts/PageTitleContext';
import { sellerApi, targetsApi } from '../services/api';
import { useTargetsData } from '../hooks/useTargetsData';
import { SavingIndicator } from '../components/common/SavingIndicator';

const { Text, Title } = Typography;
const { Option } = Select;

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const COLOR = {
    primary:   '#4f46e5',
    success:   '#10b981',
    warning:   '#f59e0b',
    danger:    '#ef4444',
    muted:     '#94a3b8',
    surface:   '#f8faff',
    border:    '#e2e8f0',
};

// Utility function to get date ranges of a week
function getWeekRangeDates(year, month, weekNumber) {
    const lastDay = new Date(year, month, 0).getDate();
    let startDay, endDay;
    if      (weekNumber === 1) { startDay = 1;  endDay = 7; }
    else if (weekNumber === 2) { startDay = 8;  endDay = 14; }
    else if (weekNumber === 3) { startDay = 15; endDay = 21; }
    else if (weekNumber === 4) { startDay = 22; endDay = 28; }
    else                       { startDay = 29; endDay = lastDay; }
    const pad = (n) => String(n).padStart(2, '0');
    return {
        startDate: `${year}-${pad(month)}-${pad(startDay)}`,
        endDate:   `${year}-${pad(month)}-${pad(endDay)}`
    };
}

// ─── Custom Self-Contained Eased Counter Animation ─────────────────────────────
const AnimatedCounter = memo(({ end, duration = 1.0, isCurrency = false, suffix = "", prefix = "" }) => {
    const [count, setCount] = useState(0);
    
    useEffect(() => {
        let startTimestamp = null;
        const endVal = parseFloat(end) || 0;
        if (endVal === 0) {
            setCount(0);
            return;
        }
        
        let active = true;
        const step = (timestamp) => {
            if (!active) return;
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / (duration * 1000), 1);
            
            // Quad ease-out
            const easeOutQuad = progress * (2 - progress);
            setCount(easeOutQuad * endVal);
            
            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                setCount(endVal);
            }
        };
        
        window.requestAnimationFrame(step);
        return () => {
            active = false;
        };
    }, [end, duration]);
    
    const formatted = useMemo(() => {
        const val = Math.round(count);
        if (isCurrency) {
            return `₹${val.toLocaleString('en-IN')}`;
        }
        return val.toLocaleString('en-IN');
    }, [count, isCurrency]);
    
    return <span>{prefix}{formatted}{suffix}</span>;
});

// ─── Eased KPI Card Component ────────────────────────────────────────────────
const KpiCard = memo(({ title, value, subtext, icon, color = '#4f46e5', isCurrency = false, trend = null, suffix = "" }) => {
    return (
        <Card className="kpi-card" style={{ borderRadius: 16, border: '1px solid #e2e8f0', height: '100%' }} styles={{ body: { padding: 20 } }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ color: '#64748b', fontSize: 13, fontWeight: 600 }}>{title}</span>
                <div style={{
                    background: `${color}15`,
                    color: color,
                    padding: 8,
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    {icon}
                </div>
            </div>
            
            <div style={{ marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
                    <AnimatedCounter end={value} isCurrency={isCurrency} suffix={suffix} />
                </h3>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {trend !== null && (
                    <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        fontSize: 11,
                        fontWeight: 700,
                        color: trend >= 80 ? '#10b981' : trend >= 50 ? '#f59e0b' : '#ef4444',
                        background: trend >= 80 ? '#ecfdf5' : trend >= 50 ? '#fffbeb' : '#fef2f2',
                        padding: '2px 6px',
                        borderRadius: 6
                    }}>
                        {trend >= 80 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                        {trend.toFixed(1)}%
                    </span>
                )}
                <span style={{ color: '#64748b', fontSize: 12 }}>{subtext}</span>
            </div>
        </Card>
    );
});

// ─── Heatmap Period Cell Component ───────────────────────────────────────────
const PeriodCell = memo(({ target, achieved, periodName, compact = false }) => {
    const displayTarget = Math.round(target || 0);
    const displayAchieved = Math.round(achieved || 0);
    
    if (displayTarget === 0 && displayAchieved === 0) {
        return <Text type="secondary" style={{ fontSize: compact ? 10 : 11 }}>-</Text>;
    }
    
    const pct = displayTarget > 0 ? Math.round((displayAchieved / displayTarget) * 100) : 0;
    
    let cellStyle = {
        padding: compact ? '4px 6px' : '6px 10px',
        borderRadius: 8,
        border: '1px solid #e2e8f0',
        background: '#f8fafc',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        gap: 2
    };
    
    let textColor = '#1e293b';
    let progressColor = '#94a3b8';
    
    if (pct >= 100) {
        cellStyle.background = '#ecfdf5';
        cellStyle.borderColor = '#a7f3d0';
        textColor = '#065f46';
        progressColor = '#10b981';
    } else if (pct >= 80) {
        cellStyle.background = '#f5f3ff';
        cellStyle.borderColor = '#ddd6fe';
        textColor = '#4338ca';
        progressColor = '#6366f1';
    } else if (pct >= 50) {
        cellStyle.background = '#fffbeb';
        cellStyle.borderColor = '#fef3c7';
        textColor = '#b45309';
        progressColor = '#f59e0b';
    } else if (pct > 0) {
        cellStyle.background = '#fff7ed';
        cellStyle.borderColor = '#ffedd5';
        textColor = '#c2410c';
        progressColor = '#ea580c';
    } else {
        cellStyle.background = '#fef2f2';
        cellStyle.borderColor = '#fee2e2';
        textColor = '#991b1b';
        progressColor = '#ef4444';
    }
    
    const tooltipTitle = (
        <div style={{ padding: '6px' }}>
            <div style={{ fontWeight: 700, marginBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: 4 }}>
                {periodName}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                <span>Target:</span>
                <span style={{ fontWeight: 600 }}>₹{displayTarget.toLocaleString('en-IN')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginTop: 2 }}>
                <span>Achieved:</span>
                <span style={{ fontWeight: 600 }}>₹{displayAchieved.toLocaleString('en-IN')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginTop: 2 }}>
                <span>Pacing Rate:</span>
                <span style={{ fontWeight: 700, color: progressColor }}>{pct}%</span>
            </div>
            <div style={{ marginTop: 6 }}>
                <Progress percent={Math.min(pct, 100)} size="small" strokeColor={progressColor} showInfo={false} />
            </div>
        </div>
    );
    
    return (
        <Tooltip title={tooltipTitle} placement="top" mouseEnterDelay={0.15}>
            <div style={cellStyle} className="hover-lift">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: compact ? 9 : 10, color: '#64748b' }}>T:</span>
                    <span style={{ fontSize: compact ? 9 : 10, fontWeight: 700, color: '#0f172a' }}>
                        ₹{displayTarget >= 100000 ? `${(displayTarget / 100000).toFixed(1)}L` : displayTarget.toLocaleString('en-IN')}
                    </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: compact ? 9 : 10, color: '#64748b' }}>A:</span>
                    <span style={{ fontSize: compact ? 9 : 10, fontWeight: 700, color: textColor }}>
                        ₹{displayAchieved >= 100000 ? `${(displayAchieved / 100000).toFixed(1)}L` : displayAchieved.toLocaleString('en-IN')}
                    </span>
                </div>
                <div style={{ marginTop: 2 }}>
                    <Progress percent={Math.min(pct, 100)} size={[undefined, 2]} strokeColor={progressColor} showInfo={false} />
                </div>
            </div>
        </Tooltip>
    );
});

// Helper function to extract performance tier
const getAchievementTier = (pct) => {
    if (pct >= 100) return { label: 'Elite', color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0' };
    if (pct >= 80) return { label: 'High Performer', color: '#4f46e5', bg: '#f5f3ff', border: '#ddd6fe' };
    if (pct >= 50) return { label: 'Active', color: '#f59e0b', bg: '#fffbeb', border: '#fef3c7' };
    return { label: 'Developing', color: '#ef4444', bg: '#fef2f2', border: '#fee2e2' };
};

// ─── Brand Config Tab Component (Unchanged) ──────────────────────────────────
// ─── Mini month allocation card ───────────────────────────────────────────────
const MonthAllocationCard = memo(({ month, shortMonth, pct, value, totalTarget, index, onChange }) => {
    const filledColor = pct >= 99.5 ? COLOR.success : pct > 0 ? COLOR.primary : COLOR.border;

    return (
        <div style={{
            padding: '14px 14px 12px',
            background: pct > 0 ? `${COLOR.primary}08` : '#fff',
            borderRadius: 10,
            border: `1.5px solid ${pct > 0 ? `${COLOR.primary}30` : COLOR.border}`,
            transition: 'all 0.2s',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Top accent line */}
            <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                background: pct > 0 ? `${COLOR.primary}` : 'transparent',
                borderRadius: '10px 10px 0 0',
                width: `${Math.min(pct, 100)}%`,
                transition: 'width 0.4s ease'
            }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                    <Text style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', display: 'block' }}>{month}</Text>
                    <Text style={{ fontSize: 10, color: COLOR.muted }}>{shortMonth}</Text>
                </div>
                <div style={{
                    fontSize: 11, fontWeight: 800,
                    color: pct > 0 ? COLOR.primary : COLOR.muted,
                    background: pct > 0 ? `${COLOR.primary}15` : '#f1f5f9',
                    padding: '2px 7px', borderRadius: 20
                }}>
                    {pct.toFixed(1)}%
                </div>
            </div>

            {/* Share slider */}
            <div style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 10, color: COLOR.muted, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                    Share of total
                </Text>
                <Slider
                    min={0} max={100} step={0.5}
                    value={pct}
                    onChange={(v) => onChange(index, 'percentageContribution', v)}
                    tooltip={{ formatter: (v) => `${v}%` }}
                    trackStyle={{ background: COLOR.primary }}
                    handleStyle={{ borderColor: COLOR.primary, width: 14, height: 14, marginTop: -5 }}
                    railStyle={{ background: '#e2e8f0' }}
                    style={{ margin: 0 }}
                />
            </div>

            {/* Value input */}
            <InputNumber
                size="small"
                style={{ width: '100%', borderRadius: 7 }}
                prefix="₹"
                value={Math.round(value)}
                formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={(v) => v.replace(/[₹,\s]/g, '')}
                onChange={(v) => onChange(index, 'targetValue', v || 0)}
                controls={false}
                variant="filled"
            />
        </div>
    );
});

// ─── Step 1: Brand Setup ──────────────────────────────────────────────────────
const StepBrandSetup = memo(({ brand, sellers, onUpdate }) => {
    const currentYear = new Date().getFullYear();
    const years = [currentYear - 1, currentYear, currentYear + 1];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Illustration header */}
            <div style={{
                background: `linear-gradient(135deg, ${COLOR.primary}10, ${COLOR.primary}05)`,
                borderRadius: 12, padding: '20px 24px',
                border: `1px solid ${COLOR.primary}20`,
                display: 'flex', alignItems: 'center', gap: 16
            }}>
                <div style={{
                    width: 52, height: 52, borderRadius: 14,
                    background: COLOR.primary, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, boxShadow: `0 8px 20px ${COLOR.primary}40`
                }}>
                    <Target size={24} color="#fff" />
                </div>
                <div>
                    <Title level={5} style={{ margin: 0, color: '#0f172a' }}>
                        Which brand are you setting a goal for?
                    </Title>
                    <Text style={{ fontSize: 13, color: COLOR.muted }}>
                        Pick a brand and tell us the big number — we'll help you break it down.
                    </Text>
                </div>
            </div>

            <Row gutter={[16, 16]}>
                {/* Brand selector */}
                <Col span={12}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: COLOR.primary }} />
                            Brand
                        </label>
                        <Select
                            style={{ width: '100%' }}
                            value={brand.sellerId || undefined}
                            placeholder="Choose a brand"
                            size="large"
                            onChange={(val) => {
                                const s = sellers.find((x) => (x.sellerId || x.SellerId || x.Id || x._id) === val);
                                const mgr = s?.managers
                                    ?.map((m) => `${m.firstName || ''} ${m.lastName || ''}`.trim())
                                    .filter(Boolean).join(', ') || '';
                                onUpdate({ sellerId: val, brandManager: mgr });
                            }}
                        >
                            {sellers.map((s) => {
                                const v = s.sellerId || s.SellerId || s.Id || s._id;
                                const l = s.name || s.Name || v;
                                return (
                                    <Option key={v} value={v}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <div style={{
                                                width: 24, height: 24, borderRadius: 6, background: `${COLOR.primary}20`,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: 11, fontWeight: 800, color: COLOR.primary
                                            }}>
                                                {(l || '?')[0].toUpperCase()}
                                            </div>
                                            {l}
                                        </div>
                                    </Option>
                                );
                            })}
                        </Select>
                    </div>
                </Col>

                {/* Manager */}
                <Col span={12}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1' }} />
                            Who's responsible?
                        </label>
                        <Input
                            size="large"
                            placeholder="Manager name"
                            prefix={<User size={15} color={COLOR.muted} />}
                            value={brand.brandManager}
                            onChange={(e) => onUpdate({ brandManager: e.target.value })}
                        />
                    </div>
                </Col>

                {/* Plan Period */}
                <Col span={8}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: COLOR.warning }} />
                            Plan Period
                        </label>
                        <Select
                            size="large"
                            style={{ width: '100%' }}
                            value={brand.targetType}
                            onChange={(val) => onUpdate({ targetType: val })}
                        >
                            <Option value="YEARLY">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Calendar size={14} />
                                    Full Year
                                </div>
                            </Option>
                            <Option value="MONTHLY">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Calendar size={14} />
                                    Single Month
                                </div>
                            </Option>
                        </Select>
                    </div>
                </Col>

                {/* Year */}
                <Col span={brand.targetType === 'MONTHLY' ? 8 : 16}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#8b5cf6' }} />
                            Year
                        </label>
                        <Select size="large" style={{ width: '100%' }} value={brand.year} onChange={(v) => onUpdate({ year: v })}>
                            {years.map((y) => <Option key={y} value={y}>{y}</Option>)}
                        </Select>
                    </div>
                </Col>

                {brand.targetType === 'MONTHLY' && (
                    <Col span={8}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#06b6d4' }} />
                                Month
                            </label>
                            <Select size="large" style={{ width: '100%' }} value={brand.month} onChange={(v) => onUpdate({ month: v })}>
                                {MONTH_NAMES.map((m, i) => <Option key={i + 1} value={i + 1}>{m}</Option>)}
                            </Select>
                        </div>
                    </Col>
                )}

                {/* Annual Sales Goal */}
                <Col span={24}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: COLOR.success }} />
                            Annual Sales Goal
                        </label>
                        <InputNumber
                            size="large"
                            style={{ width: '100%' }}
                            value={brand.totalTargetValue || undefined}
                            placeholder="e.g. ₹ 12,00,000"
                            prefix={<TrendingUp size={16} color={COLOR.success} />}
                            formatter={(v) => v ? `₹ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''}
                            parser={(v) => v.replace(/[₹,\s]/g, '')}
                            onChange={(v) => onUpdate({ totalTargetValue: v || 0 })}
                            controls={false}
                        />
                        {brand.totalTargetValue > 0 && (
                            <Text style={{ fontSize: 12, color: COLOR.success, fontWeight: 600 }}>
                                ✓ That's ₹{Math.round(brand.totalTargetValue / (brand.targetType === 'YEARLY' ? 12 : 5)).toLocaleString('en-IN')} / {brand.targetType === 'YEARLY' ? 'month' : 'week'} evenly
                            </Text>
                        )}
                    </div>
                </Col>
            </Row>
        </div>
    );
});

// ─── Step 2: Monthly Split ────────────────────────────────────────────────────
const StepMonthlySplit = memo(({ brand, onDistributionChange, onDistributeEvenly }) => {
    const totalTarget = brand.totalTargetValue || 0;
    const sumPct = brand.breakdowns.reduce((s, b) => s + (b.percentageContribution || 0), 0);
    const sumVal = brand.breakdowns.reduce((s, b) => s + (b.targetValue || 0), 0);
    const remaining = 100 - sumPct;
    const isValid = Math.abs(sumPct - 100) < 0.5;
    const periodLabel = brand.targetType === 'YEARLY' ? 'month' : 'week';
    const labels = brand.targetType === 'YEARLY' ? MONTH_NAMES : ['Week 1','Week 2','Week 3','Week 4','Week 5'];
    const shorts = brand.targetType === 'YEARLY' ? MONTH_SHORT : ['W1','W2','W3','W4','W5'];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <Title level={5} style={{ margin: 0, color: '#0f172a' }}>
                        How should ₹{Math.round(totalTarget).toLocaleString('en-IN')} be split?
                    </Title>
                    <Text style={{ fontSize: 13, color: COLOR.muted }}>
                        Drag the sliders or type values for each {periodLabel}.
                    </Text>
                </div>
                <Button
                    icon={<Zap size={14} />}
                    onClick={onDistributeEvenly}
                    style={{
                        borderRadius: 8, fontWeight: 600, fontSize: 12,
                        borderColor: COLOR.primary, color: COLOR.primary,
                        background: `${COLOR.primary}08`
                    }}
                >
                    Split Evenly
                </Button>
            </div>

            {/* Progress summary */}
            <div style={{
                background: isValid ? '#f0fdf4' : remaining > 0 ? '#fffbeb' : '#fef2f2',
                border: `1.5px solid ${isValid ? '#86efac' : remaining > 0 ? '#fcd34d' : '#fca5a5'}`,
                borderRadius: 10, padding: '12px 16px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {isValid
                        ? <CheckCircle2 size={18} color={COLOR.success} />
                        : <Info size={18} color={remaining > 0 ? COLOR.warning : COLOR.danger} />
                    }
                    <div>
                        <Text style={{ fontSize: 13, fontWeight: 700, color: isValid ? '#065f46' : remaining > 0 ? '#92400e' : '#991b1b' }}>
                            {isValid ? 'All 100% allocated — ready to go!' : remaining > 0 ? `${remaining.toFixed(1)}% still to allocate` : `Over by ${Math.abs(remaining).toFixed(1)}% — please reduce`}
                        </Text>
                        <div style={{ marginTop: 4 }}>
                            <Progress
                                percent={Math.min(sumPct, 100)}
                                strokeColor={isValid ? COLOR.success : remaining > 0 ? COLOR.warning : COLOR.danger}
                                railColor="#e2e8f0"
                                size={['200px', 6]}
                                showInfo={false}
                                strokeLinecap="round"
                            />
                        </div>
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <Text style={{ fontSize: 13, fontWeight: 800, color: isValid ? COLOR.success : '#0f172a' }}>
                        ₹{Math.round(sumVal).toLocaleString('en-IN')}
                    </Text>
                    <Text style={{ fontSize: 11, color: COLOR.muted, display: 'block' }}>
                        of ₹{Math.round(totalTarget).toLocaleString('en-IN')}
                    </Text>
                </div>
            </div>

            {/* Month/week cards grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: brand.targetType === 'YEARLY' ? 'repeat(4, 1fr)' : 'repeat(5, 1fr)',
                gap: 10,
                maxHeight: 380, overflowY: 'auto', paddingRight: 4
            }}>
                {brand.breakdowns.map((b, idx) => (
                    <MonthAllocationCard
                        key={idx}
                        index={idx}
                        month={labels[idx]}
                        shortMonth={shorts[idx]}
                        pct={b.percentageContribution || 0}
                        value={b.targetValue || 0}
                        totalTarget={totalTarget}
                        onChange={onDistributionChange}
                    />
                ))}
            </div>
        </div>
    );
});

// ─── Step 3: Review & Confirm ─────────────────────────────────────────────────
const StepReview = memo(({ brands }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
            <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: `${COLOR.primary}15`, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 12px'
            }}>
                <PieChart size={28} color={COLOR.primary} />
            </div>
            <Title level={4} style={{ margin: 0 }}>Looking good! Here's your summary</Title>
            <Text style={{ color: COLOR.muted, fontSize: 13 }}>Review before going live.</Text>
        </div>

        {brands.map((brand, i) => {
            const sumPct = brand.breakdowns.reduce((s, b) => s + (b.percentageContribution || 0), 0);
            const isValid = Math.abs(sumPct - 100) < 0.5 && brand.sellerId && brand.totalTargetValue > 0;
            return (
                <div key={i} style={{
                    border: `1.5px solid ${isValid ? '#86efac' : '#fca5a5'}`,
                    borderRadius: 12, padding: '16px 20px',
                    background: isValid ? '#f0fdf4' : '#fef2f2'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                                width: 36, height: 36, borderRadius: 10,
                                background: COLOR.primary, display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                                fontSize: 14, fontWeight: 800, color: '#fff'
                            }}>
                                {(brand.sellerId || '?')[0].toUpperCase()}
                            </div>
                            <div>
                                <Text strong style={{ fontSize: 15 }}>{brand.sellerId || 'No brand selected'}</Text>
                                <Text style={{ fontSize: 12, color: COLOR.muted, display: 'block' }}>{brand.brandManager || 'No manager'}</Text>
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <Text strong style={{ fontSize: 16, color: COLOR.primary }}>
                                ₹{Math.round(brand.totalTargetValue || 0).toLocaleString('en-IN')}
                            </Text>
                            <Text style={{ fontSize: 11, color: COLOR.muted, display: 'block' }}>
                                {brand.targetType === 'YEARLY' ? 'Yearly' : 'Monthly'} · {brand.year}
                            </Text>
                        </div>
                    </div>
                    {/* Mini bar chart */}
                    <div style={{ display: 'flex', gap: 2, height: 24, alignItems: 'flex-end' }}>
                        {brand.breakdowns.map((b, j) => (
                            <Tooltip key={j} title={`${(b.percentageContribution || 0).toFixed(1)}%`}>
                                <div style={{
                                    flex: 1, borderRadius: '3px 3px 0 0',
                                    background: COLOR.primary,
                                    opacity: 0.2 + ((b.percentageContribution || 0) / 100) * 0.8,
                                    height: `${Math.max((b.percentageContribution || 0) / 100 * 100, 8)}%`,
                                    transition: 'height 0.3s',
                                    cursor: 'default'
                                }} />
                            </Tooltip>
                        ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                        {brand.breakdowns.map((_, j) => (
                            <div key={j} style={{ fontSize: 8, color: COLOR.muted, flex: 1, textAlign: 'center' }}>
                                {brand.targetType === 'YEARLY' ? MONTH_SHORT[j] : `W${j + 1}`}
                            </div>
                        ))}
                    </div>
                    {!isValid && (
                        <Alert
                            type="error" showIcon
                            message={!brand.sellerId ? 'Please choose a brand' : !brand.totalTargetValue ? 'Please enter a sales goal' : 'Monthly split must total 100%'}
                            style={{ marginTop: 10, borderRadius: 8 }}
                        />
                    )}
                </div>
            );
        })}
    </div>
));

// ═══════════════════════════════════════════════════════════════════════════════
// ADD TARGETS MODAL — 3-step wizard
// ═══════════════════════════════════════════════════════════════════════════════
export const AddTargetModal = ({
    visible, onClose, sellers, onSubmit
}) => {
    const [step, setStep] = useState(0);
    const [brands, setBrands] = useState([createDefaultBrand('0')]);
    const [activeBrand, setActiveBrand] = useState('0');
    const [submitting, setSubmitting] = useState(false);

    function createDefaultBrand(key) {
        return {
            key, sellerId: '', brandManager: '',
            targetType: 'YEARLY',
            year: new Date().getFullYear(),
            month: new Date().getMonth() + 1,
            totalTargetValue: 0,
            breakdowns: Array.from({ length: 12 }, (_, i) => ({
                periodValue: i + 1, percentageContribution: 0, targetValue: 0
            }))
        };
    }

    const addBrand = useCallback(() => {
        const key = String(brands.length);
        setBrands((p) => [...p, createDefaultBrand(key)]);
        setActiveBrand(key);
    }, [brands.length]);

    const removeBrand = useCallback((key) => {
        setBrands((p) => p.filter((b) => b.key !== key));
        setActiveBrand('0');
    }, []);

    const updateBrand = useCallback((key, updates) => {
        setBrands((prev) => prev.map((b) => {
            if (b.key !== key) return b;
            const merged = { ...b, ...updates };
            if (updates.targetType) {
                merged.breakdowns = updates.targetType === 'YEARLY'
                    ? Array.from({ length: 12 }, (_, i) => ({ periodValue: i + 1, percentageContribution: 0, targetValue: 0 }))
                    : Array.from({ length: 5  }, (_, i) => ({ periodValue: i + 1, percentageContribution: 0, targetValue: 0 }));
            }
            return merged;
        }));
    }, []);

    const handleDistributionChange = useCallback((brandKey, index, field, value) => {
        setBrands((prev) => prev.map((b) => {
            if (b.key !== brandKey) return b;
            const bds = [...b.breakdowns];
            const total = b.totalTargetValue || 0;
            if (field === 'percentageContribution') {
                bds[index] = { ...bds[index], percentageContribution: value, targetValue: Math.round((value / 100) * total * 100) / 100 };
            } else {
                bds[index] = { ...bds[index], targetValue: value, percentageContribution: total > 0 ? Math.round((value / total) * 100 * 100) / 100 : 0 };
            }
            return { ...b, breakdowns: bds };
        }));
    }, []);

    const distributeEvenly = useCallback((brandKey) => {
        setBrands((prev) => prev.map((b) => {
            if (b.key !== brandKey) return b;
            const len = b.breakdowns.length;
            const pct = Math.round((100 / len) * 100) / 100;
            const val = Math.round((b.totalTargetValue / len) * 100) / 100;
            return {
                ...b,
                breakdowns: b.breakdowns.map((bd, i) => ({
                    ...bd,
                    percentageContribution: i === len - 1 ? 100 - pct * (len - 1) : pct,
                    targetValue:            i === len - 1 ? b.totalTargetValue - val * (len - 1) : val
                }))
            };
        }));
    }, []);

    const allValid = useMemo(() => brands.every((b) => {
        const sumPct = b.breakdowns.reduce((s, x) => s + (x.percentageContribution || 0), 0);
        return b.sellerId && b.totalTargetValue > 0 && Math.abs(sumPct - 100) < 0.5;
    }), [brands]);

    const activeBrandData = brands.find((b) => b.key === activeBrand) || brands[0];

    const STEPS = [
        { title: 'Brand & Goal',   icon: <Target size={14} /> },
        { title: 'Monthly Split',  icon: <PieChart size={14} /> },
        { title: 'Review',         icon: <CheckCircle2 size={14} /> },
    ];

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            await onSubmit(brands);
            setStep(0);
            setBrands([createDefaultBrand('0')]);
            setActiveBrand('0');
        } catch (e) {
            // Error notification already handled in onSubmit
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            open={visible}
            onCancel={onClose}
            width={820}
            footer={null}
            styles={{ body: { padding: 0 } }}
            style={{ borderRadius: 16, overflow: 'hidden' }}
            closable={false}
        >
            {/* Header */}
            <div style={{
                background: `linear-gradient(135deg, #1e1b4b, #4338ca)`,
                padding: '20px 28px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
                <div>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600 }}>
                        NEW TARGET
                    </Text>
                    <div style={{ color: '#fff', fontSize: 18, fontWeight: 800, marginTop: 2 }}>
                        Set Up a New Target
                    </div>
                </div>
                <button onClick={onClose} style={{
                    background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 8, width: 32, height: 32, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
                }}>✕</button>
            </div>

            {/* Step indicator */}
            <div style={{ padding: '16px 28px 0', background: '#fafbff', borderBottom: `1px solid ${COLOR.border}` }}>
                <Steps
                    current={step}
                    size="small"
                    items={STEPS.map((s) => ({ title: s.title, icon: s.icon }))}
                    style={{ maxWidth: 400 }}
                />
                {/* Brand tabs */}
                {step < 2 && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 14, paddingBottom: 0 }}>
                        {brands.map((b, i) => (
                            <button
                                key={b.key}
                                onClick={() => setActiveBrand(b.key)}
                                style={{
                                    padding: '6px 14px', borderRadius: '8px 8px 0 0',
                                    border: `1.5px solid ${activeBrand === b.key ? COLOR.primary : COLOR.border}`,
                                    borderBottom: activeBrand === b.key ? '2px solid #fff' : `1.5px solid ${COLOR.border}`,
                                    background: activeBrand === b.key ? '#fff' : '#f8faff',
                                    cursor: 'pointer', fontSize: 12, fontWeight: 700,
                                    color: activeBrand === b.key ? COLOR.primary : '#64748b',
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    marginBottom: -2
                                }}
                            >
                                <div style={{
                                    width: 18, height: 18, borderRadius: 5,
                                    background: activeBrand === b.key ? COLOR.primary : '#e2e8f0',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 10, fontWeight: 800,
                                    color: activeBrand === b.key ? '#fff' : '#64748b'
                                }}>{i + 1}</div>
                                {b.sellerId || `Brand ${i + 1}`}
                                {brands.length > 1 && (
                                    <span
                                        onClick={(e) => { e.stopPropagation(); removeBrand(b.key); }}
                                        style={{ marginLeft: 4, color: '#94a3b8', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}
                                    >×</span>
                                )}
                            </button>
                        ))}
                        <button
                            onClick={addBrand}
                            style={{
                                padding: '6px 12px', borderRadius: '8px 8px 0 0',
                                border: `1.5px dashed ${COLOR.border}`,
                                background: 'transparent', cursor: 'pointer',
                                fontSize: 12, color: COLOR.muted,
                                display: 'flex', alignItems: 'center', gap: 4,
                                marginBottom: -2
                            }}
                        >
                            <Plus size={12} /> Add brand
                        </button>
                    </div>
                )}
            </div>

            {/* Step content */}
            <div style={{ padding: '24px 28px', minHeight: 380, background: '#fff' }}>
                {step === 0 && (
                    <StepBrandSetup
                        brand={activeBrandData}
                        sellers={sellers}
                        onUpdate={(updates) => updateBrand(activeBrand, updates)}
                    />
                )}
                {step === 1 && (
                    <StepMonthlySplit
                        brand={activeBrandData}
                        onDistributionChange={(idx, field, val) => handleDistributionChange(activeBrand, idx, field, val)}
                        onDistributeEvenly={() => distributeEvenly(activeBrand)}
                    />
                )}
                {step === 2 && <StepReview brands={brands} />}
            </div>

            {/* Footer nav */}
            <div style={{
                padding: '16px 28px', background: '#fafbff',
                borderTop: `1px solid ${COLOR.border}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
                <Button
                    onClick={() => step === 0 ? onClose() : setStep(step - 1)}
                    icon={step > 0 ? <ChevronLeft size={15} /> : null}
                    style={{ borderRadius: 9, fontWeight: 600, height: 40, paddingInline: 20 }}
                >
                    {step === 0 ? 'Cancel' : 'Back'}
                </Button>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {/* Dot progress */}
                    {STEPS.map((_, i) => (
                        <div key={i} style={{
                            width: i === step ? 20 : 7, height: 7, borderRadius: 99,
                            background: i === step ? COLOR.primary : i < step ? `${COLOR.primary}50` : COLOR.border,
                            transition: 'all 0.3s'
                        }} />
                    ))}
                </div>

                {step < 2 ? (
                    <Button
                        type="primary"
                        icon={<ChevronRight size={15} />}
                        iconPlacement="end"
                        onClick={() => setStep(step + 1)}
                        disabled={step === 0 && (!activeBrandData.sellerId || !activeBrandData.totalTargetValue)}
                        style={{
                            borderRadius: 9, fontWeight: 700, height: 40,
                            paddingInline: 24, background: COLOR.primary,
                            borderColor: COLOR.primary
                        }}
                    >
                        {step === 0 ? 'Set the split' : 'Review & confirm'}
                    </Button>
                ) : (
                    <Button
                        type="primary"
                        icon={<Sparkles size={15} />}
                        loading={submitting}
                        disabled={!allValid}
                        onClick={handleSubmit}
                        style={{
                            borderRadius: 9, fontWeight: 700, height: 40,
                            paddingInline: 24, background: COLOR.success,
                            borderColor: COLOR.success,
                            boxShadow: `0 4px 16px ${COLOR.success}40`
                        }}
                    >
                        Go Live
                    </Button>
                )}
            </div>
        </Modal>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// EDIT TARGET MODAL — clean card-per-month grid
// ═══════════════════════════════════════════════════════════════════════════════
const EditMonthCard = memo(({ bk, bkIndex, totalTarget, brandKey, onBreakdownChange }) => {
    const pct   = totalTarget > 0 ? (bk.TargetValue / totalTarget) * 100 : 0;
    const achPct = bk.TargetValue > 0 ? Math.round((bk.AchievedValue / bk.TargetValue) * 100) : 0;

    const tierColor = achPct >= 100 ? COLOR.success
        : achPct >= 80 ? '#2563eb'
        : achPct >= 50 ? COLOR.warning
        : achPct > 0   ? COLOR.danger
        : COLOR.muted;

    return (
        <div style={{
            border: `1.5px solid ${COLOR.border}`,
            borderRadius: 11, overflow: 'hidden',
            transition: 'box-shadow 0.2s',
        }}
            onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 16px rgba(79,70,229,0.12)'}
            onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
        >
            {/* Card header */}
            <div style={{
                padding: '9px 12px',
                background: '#f8faff',
                borderBottom: `1px solid ${COLOR.border}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
                <Text style={{ fontSize: 11, fontWeight: 800, color: '#0f172a' }}>{bk.label}</Text>
                <span style={{
                    fontSize: 10, fontWeight: 700,
                    color: COLOR.primary, background: `${COLOR.primary}12`,
                    padding: '2px 6px', borderRadius: 4
                }}>
                    {pct.toFixed(1)}% share
                </span>
            </div>

            {/* Achievement bar */}
            {bk.AchievedValue > 0 && (
                <div style={{ height: 3, background: '#f1f5f9' }}>
                    <div style={{
                        height: '100%',
                        width: `${Math.min(achPct, 100)}%`,
                        background: tierColor,
                        transition: 'width 0.4s ease'
                    }} />
                </div>
            )}

            <div style={{ padding: '12px 12px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Target */}
                <div>
                    <Text style={{ fontSize: 10, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                        Goal (₹)
                    </Text>
                    <InputNumber
                        size="small"
                        style={{ width: '100%', borderRadius: 7 }}
                        value={Math.round(bk.TargetValue || 0)}
                        formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        parser={(v) => v.replace(/[,\s]/g, '')}
                        onChange={(v) => onBreakdownChange(brandKey, bkIndex, 'TargetValue', parseFloat(v) || 0)}
                        controls={false}
                        variant="filled"
                        prefix={<span style={{ fontSize: 11, color: '#64748b' }}>₹</span>}
                    />
                </div>

                {/* Achieved */}
                <div>
                    <Text style={{ fontSize: 10, fontWeight: 700, color: COLOR.success, display: 'block', marginBottom: 4 }}>
                        Actual sales (₹)
                    </Text>
                    <InputNumber
                        size="small"
                        style={{ width: '100%', borderRadius: 7 }}
                        value={Math.round(bk.AchievedValue || 0)}
                        formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        parser={(v) => v.replace(/[,\s]/g, '')}
                        onChange={(v) => onBreakdownChange(brandKey, bkIndex, 'AchievedValue', parseFloat(v) || 0)}
                        controls={false}
                        variant="filled"
                        prefix={<span style={{ fontSize: 11, color: COLOR.success }}>₹</span>}
                    />
                </div>

                {/* Achievement badge */}
                {bk.AchievedValue > 0 && (
                    <div style={{ textAlign: 'center' }}>
                        <span style={{
                            fontSize: 10, fontWeight: 700,
                            color: tierColor, background: `${tierColor}15`,
                            padding: '2px 8px', borderRadius: 20,
                            border: `1px solid ${tierColor}30`
                        }}>
                            {achPct}% reached
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
});

export const EditTargetModal = ({
    visible, onClose, editingBrands, setEditingBrands, onSubmit, loading
}) => {
    const [activeKey, setActiveKey] = useState('0');

    const handleBreakdownChange = useCallback((brandKey, bkIndex, field, val) => {
        setEditingBrands((prev) => prev.map((b) => {
            if (b.key !== brandKey) return b;
            const bds = b.breakdowns.map((item, i) => {
                if (i !== bkIndex) return item;
                return field === 'TargetValue'
                    ? { ...item, TargetValue: val, PercentageContribution: b.totalTargetValue > 0 ? (val / b.totalTargetValue) * 100 : 0 }
                    : { ...item, AchievedValue: val };
            });
            return { ...b, breakdowns: bds };
        }));
    }, [setEditingBrands]);

    const handleTotalChange = useCallback((brandKey, val) => {
        setEditingBrands((prev) => prev.map((b) => {
            if (b.key !== brandKey) return b;
            const bds = b.breakdowns.map((item) => ({
                ...item,
                TargetValue: (val * (item.PercentageContribution || (100 / b.breakdowns.length))) / 100
            }));
            return { ...b, totalTargetValue: val, breakdowns: bds };
        }));
    }, [setEditingBrands]);

    const activeBrand = editingBrands.find((b) => b.key === activeKey) || editingBrands[0];

    if (!activeBrand) return null;

    const sumVal      = activeBrand.breakdowns.reduce((s, item) => s + (item.TargetValue || 0), 0);
    const sumAchieved = activeBrand.breakdowns.reduce((s, item) => s + (item.AchievedValue || 0), 0);
    const isMatching  = Math.abs(sumVal - activeBrand.totalTargetValue) < 1.0;
    const overallPct  = activeBrand.totalTargetValue > 0
        ? Math.round((sumAchieved / activeBrand.totalTargetValue) * 100) : 0;

    return (
        <Modal
            open={visible}
            onCancel={onClose}
            width={860}
            footer={null}
            styles={{ body: { padding: 0 } }}
            style={{ borderRadius: 16, overflow: 'hidden' }}
            closable={false}
        >
            {/* Header */}
            <div style={{
                background: 'linear-gradient(135deg, #064e3b, #065f46)',
                padding: '20px 28px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                        width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '1px solid rgba(255,255,255,0.2)'
                    }}>
                        <Edit3 size={20} color="#fff" />
                    </div>
                    <div>
                        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600 }}>
                            UPDATING TARGETS
                        </Text>
                        <div style={{ color: '#fff', fontSize: 18, fontWeight: 800, marginTop: 1 }}>
                            Update Sales Targets
                        </div>
                    </div>
                </div>
                <button onClick={onClose} style={{
                    background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 8, width: 32, height: 32, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
                }}>✕</button>
            </div>

            {/* Brand tabs (if multiple) */}
            {editingBrands.length > 1 && (
                <div style={{
                    display: 'flex', gap: 0, background: '#f8faff',
                    borderBottom: `1px solid ${COLOR.border}`, paddingInline: 28, paddingTop: 12
                }}>
                    {editingBrands.map((b, i) => (
                        <button
                            key={b.key}
                            onClick={() => setActiveKey(b.key)}
                            style={{
                                padding: '8px 18px', border: 'none', cursor: 'pointer',
                                borderBottom: activeKey === b.key ? `2px solid ${COLOR.success}` : '2px solid transparent',
                                background: 'transparent', fontSize: 13, fontWeight: 700,
                                color: activeKey === b.key ? COLOR.success : '#64748b'
                            }}
                        >
                            {b.sellerId}
                        </button>
                    ))}
                </div>
            )}

            {/* Brand summary bar */}
            <div style={{
                padding: '16px 28px', background: '#fff',
                borderBottom: `1px solid ${COLOR.border}`,
                display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap'
            }}>
                {/* Brand identity */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                    <div style={{
                        width: 42, height: 42, borderRadius: 11,
                        background: `${COLOR.success}20`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 16, fontWeight: 800, color: COLOR.success,
                        border: `1.5px solid ${COLOR.success}40`
                    }}>
                        {(activeBrand.sellerId || '?')[0].toUpperCase()}
                    </div>
                    <div>
                        <Text strong style={{ fontSize: 16, color: '#0f172a' }}>{activeBrand.sellerId}</Text>
                        <Text style={{ fontSize: 12, color: COLOR.muted, display: 'block' }}>
                            {activeBrand.targetType === 'YEARLY' ? 'Yearly' : 'Monthly'} Plan · {activeBrand.year}
                            {activeBrand.month ? ` · ${MONTH_SHORT[activeBrand.month - 1]}` : ''}
                        </Text>
                    </div>
                </div>

                {/* Overall progress */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ textAlign: 'right' }}>
                        <Text style={{ fontSize: 12, color: COLOR.muted }}>Overall progress</Text>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                            <Progress
                                type="circle"
                                percent={Math.min(overallPct, 100)}
                                size={44}
                                strokeColor={overallPct >= 100 ? COLOR.success : overallPct >= 80 ? '#2563eb' : COLOR.warning}
                                strokeWidth={8}
                                format={(p) => <span style={{ fontSize: 10, fontWeight: 800 }}>{p}%</span>}
                            />
                            <div>
                                <Text strong style={{ fontSize: 15, color: '#0f172a', display: 'block' }}>
                                    ₹{Math.round(sumAchieved).toLocaleString('en-IN')}
                                </Text>
                                <Text style={{ fontSize: 11, color: COLOR.muted }}>
                                    of ₹{Math.round(activeBrand.totalTargetValue).toLocaleString('en-IN')}
                                </Text>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Total target editor */}
                <div style={{ minWidth: 180 }}>
                    <Text style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                        Change overall goal
                    </Text>
                    <InputNumber
                        size="middle"
                        style={{ width: '100%', borderRadius: 9 }}
                        value={activeBrand.totalTargetValue}
                        formatter={(v) => `₹ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        parser={(v) => v.replace(/[₹,\s]/g, '')}
                        onChange={(v) => handleTotalChange(activeBrand.key, parseFloat(v) || 0)}
                        controls={false}
                    />
                </div>
            </div>

            {/* Validation banner */}
            {!isMatching && (
                <div style={{
                    padding: '10px 28px',
                    background: '#fef2f2', borderBottom: `1px solid #fecaca`,
                    display: 'flex', alignItems: 'center', gap: 8
                }}>
                    <Info size={15} color={COLOR.danger} />
                    <Text style={{ fontSize: 12, color: '#991b1b', fontWeight: 600 }}>
                        Monthly totals don't add up to the overall goal yet.
                        Difference: ₹{Math.abs(Math.round(activeBrand.totalTargetValue - sumVal)).toLocaleString('en-IN')}
                    </Text>
                </div>
            )}
            {isMatching && (
                <div style={{
                    padding: '8px 28px',
                    background: '#f0fdf4', borderBottom: `1px solid #86efac`,
                    display: 'flex', alignItems: 'center', gap: 8
                }}>
                    <CheckCircle2 size={15} color={COLOR.success} />
                    <Text style={{ fontSize: 12, color: '#065f46', fontWeight: 600 }}>
                        All monthly values add up correctly — ready to save.
                    </Text>
                </div>
            )}

            {/* Month grid */}
            <div style={{
                padding: '20px 28px',
                display: 'grid',
                gridTemplateColumns: activeBrand.targetType === 'YEARLY' ? 'repeat(4, 1fr)' : 'repeat(5, 1fr)',
                gap: 12,
                maxHeight: 400, overflowY: 'auto'
            }}>
                {activeBrand.breakdowns.map((bk, idx) => (
                    <EditMonthCard
                        key={idx}
                        bk={bk}
                        bkIndex={idx}
                        totalTarget={activeBrand.totalTargetValue}
                        brandKey={activeBrand.key}
                        onBreakdownChange={handleBreakdownChange}
                    />
                ))}
            </div>

            {/* Footer */}
            <div style={{
                padding: '16px 28px',
                background: '#fafbff', borderTop: `1px solid ${COLOR.border}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
                <Button onClick={onClose} style={{ borderRadius: 9, fontWeight: 600, height: 40, paddingInline: 20 }}>
                    Discard changes
                </Button>
                <Button
                    type="primary"
                    loading={loading}
                    disabled={!isMatching}
                    icon={<Check size={16} />}
                    onClick={onSubmit}
                    style={{
                        borderRadius: 9, fontWeight: 700, height: 40,
                        paddingInline: 28,
                        background: isMatching ? COLOR.success : '#94a3b8',
                        borderColor: isMatching ? COLOR.success : '#94a3b8',
                        boxShadow: isMatching ? `0 4px 16px ${COLOR.success}40` : 'none'
                    }}
                >
                    Save Changes
                </Button>
            </div>
        </Modal>
    );
};

// ─── ConnectionSync Banner ──────────────────────────────────────────────────
const ConnectionBanner = memo(({ targets }) => {
    const optimisticCount = (targets || []).filter((t) => t._optimistic).length;

    if (optimisticCount === 0) return null;

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: '#fefce8',
            border: '1.5px solid #fcd34d',
            borderRadius: 10,
            padding: '12px 16px',
            fontSize: 13,
            fontWeight: 600,
            color: '#92400e',
            marginBottom: 16
        }}>
            <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#f59e0b',
                animation: 'pulse 1.5s infinite'
            }} />
            <span>{optimisticCount} change{optimisticCount > 1 ? 's' : ''} syncing in the background...</span>
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50%       { opacity: 0.5; transform: scale(1.4); }
                }
            `}</style>
        </div>
    );
});
ConnectionBanner.displayName = 'ConnectionBanner';

// ─── Main Component ───────────────────────────────────────────────────────────
const TargetVsAchievement = () => {
    const { setPageTitle } = usePageTitle();
    const [notificationApi, notificationContextHolder] = notification.useNotification();

    const notifRef = useRef(notificationApi);
    useEffect(() => { notifRef.current = notificationApi; });

    const {
        targets,
        loading: targetsLoading,
        savingIds,
        errorIds,
        createTargets,
        updateTarget,
        deleteTargets,
        refresh,
        contextHolder: targetsContextHolder,
    } = useTargetsData(notificationApi);

    const [sellers, setSellers]                   = useState([]);
    const [sellersLoading, setSellersLoading]     = useState(true);
    const [selectedPlanType, setSelectedPlanType] = useState('YEARLY');
    const [selectedRowKeys, setSelectedRowKeys]   = useState([]);
    const [modalVisible, setModalVisible]         = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingBrands, setEditingBrands]       = useState([]);
    const [expandedMonths, setExpandedMonths]     = useState([]);
    const [expandedWeeks, setExpandedWeeks]       = useState([]);

    // Filters state
    const [searchText, setSearchText]             = useState('');
    const [selectedYear, setSelectedYear]         = useState(new Date().getFullYear());

    // Fetch sellers
    const fetchSellers = useCallback(async () => {
        try {
            setSellersLoading(true);
            const sellersRes = await sellerApi.getAll();
            if (sellersRes?.success) {
                const list = sellersRes.data?.sellers || sellersRes.data || sellersRes.sellers || [];
                setSellers(Array.isArray(list) ? list : []);
            }
        } catch (e) {
            notifRef.current.error({
                message: 'Failed to fetch sellers',
                description: e.message
            });
        } finally {
            setSellersLoading(false);
        }
    }, []);

    // Deduplicated background refetch compatibility handler
    const fetchData = useCallback(async () => {
        await Promise.all([
            refresh(),
            fetchSellers()
        ]);
    }, [refresh, fetchSellers]);

    useEffect(() => {
        setPageTitle('Target v/s Achievements');
        fetchSellers();
    }, [setPageTitle, fetchSellers]);

    const loading = targetsLoading || sellersLoading;

    // Extract unique available years dynamically
    const availableYears = useMemo(() => {
        const years = [...new Set(targets.map(t => t.Year).filter(Boolean))];
        if (years.length === 0) {
            years.push(new Date().getFullYear());
        }
        return years.sort((a, b) => b - a);
    }, [targets]);

    // Smart initial year selection
    useEffect(() => {
        if (targets.length > 0) {
            const years = [...new Set(targets.map(t => t.Year).filter(Boolean))];
            if (years.length > 0 && !years.includes(selectedYear)) {
                setSelectedYear(years[0]);
            }
        }
    }, [targets]);

    // Filter targets by plan type, selected year, and search query
    const filteredTargets = useMemo(() => {
        return targets.filter((t) => {
            const matchesPlan = t.TargetType === selectedPlanType;
            const matchesYear = t.Year === selectedYear;
            const matchesSearch = !searchText
                ? true
                : (t.SellerId?.toLowerCase().includes(searchText.toLowerCase()) ||
                   t.BrandManager?.toLowerCase().includes(searchText.toLowerCase()));
            return matchesPlan && matchesYear && matchesSearch;
        });
    }, [targets, selectedPlanType, selectedYear, searchText]);

    // Calculate aggregated statistics for the KPI metrics
    const kpiStats = useMemo(() => {
        let totalTarget = 0;
        let totalAchieved = 0;
        let premiumCount = 0; // >= 80% achievement count
        
        filteredTargets.forEach((t) => {
            totalTarget += t.TotalTargetValue || 0;
            totalAchieved += t.overallAchieved || 0;
            
            const pct = t.TotalTargetValue > 0 ? (t.overallAchieved / t.TotalTargetValue) * 100 : 0;
            if (pct >= 80) {
                premiumCount++;
            }
        });
        
        const achievementRate = totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0;
        
        return {
            totalTarget,
            totalAchieved,
            achievementRate,
            premiumCount,
            brandCount: filteredTargets.length
        };
    }, [filteredTargets]);

    const handleCollapseAll = useCallback(() => {
        setExpandedMonths([]);
        setExpandedWeeks([]);
    }, []);

    const hasExpandedColumns = expandedMonths.length > 0 || expandedWeeks.length > 0;

    // handlers wrapping
    const handleDeleteSingle = useCallback(async (id) => {
        await deleteTargets([id]);
    }, [deleteTargets]);

    const handleDeleteBulk = useCallback(async () => {
        const ok = await deleteTargets(selectedRowKeys);
        if (ok) {
            setSelectedRowKeys([]);
        }
    }, [selectedRowKeys, deleteTargets]);

    const handleOpenModal = useCallback(() => {
        setModalVisible(true);
    }, []);

    const handleSubmitTargets = useCallback(async (brandsToSubmit) => {
        const payload = brandsToSubmit.map((b) => ({
            sellerId: b.sellerId, brandManager: b.brandManager,
            targetType: b.targetType, year: b.year,
            month: b.targetType === 'MONTHLY' ? b.month : null,
            totalTargetValue: b.totalTargetValue, breakdowns: b.breakdowns.map((bk) => ({
                periodValue: bk.periodValue,
                targetValue: bk.targetValue
            }))
        }));
        const ok = await createTargets(payload);
        if (ok) {
            setModalVisible(false);
        }
    }, [createTargets]);

    const handleStartEditBulk = useCallback((records) => {
        const brandsToEdit = records.map((record, index) => {
            const isYearly = record.TargetType === 'YEARLY';
            const breakdowns = isYearly
                ? (record.monthlyBreakdown?.length > 0
                    ? record.monthlyBreakdown.map((m) => ({
                        Id: m.Id, PeriodValue: m.PeriodValue,
                        label: MONTH_NAMES[m.PeriodValue - 1],
                        TargetValue: m.TargetValue,
                        AchievedValue: m.AchievedValue || 0,
                        PercentageContribution: m.PercentageContribution
                      }))
                    : Array.from({ length: 12 }, (_, i) => ({
                        PeriodValue: i + 1, label: MONTH_NAMES[i],
                        TargetValue: record.TotalTargetValue / 12,
                        AchievedValue: 0, PercentageContribution: 100 / 12
                      })))
                : (record.weeklyBreakdown?.length > 0
                    ? record.weeklyBreakdown.map((w) => ({
                        Id: w.Id, PeriodValue: w.PeriodValue,
                        label: `Week ${w.PeriodValue}`,
                        TargetValue: w.TargetValue,
                        AchievedValue: w.AchievedValue || 0,
                        PercentageContribution: w.PercentageContribution
                      }))
                    : Array.from({ length: 5 }, (_, i) => ({
                        PeriodValue: i + 1, label: `Week ${i + 1}`,
                        TargetValue: record.TotalTargetValue / 5,
                        AchievedValue: 0, PercentageContribution: 100 / 5
                      })));
            return {
                key: String(index), id: record.Id, sellerId: record.SellerId,
                brandManager: record.BrandManager, targetType: record.TargetType,
                year: record.Year, month: record.Month,
                totalTargetValue: record.TotalTargetValue, breakdowns
            };
        });
        setEditingBrands(brandsToEdit);
        setEditModalVisible(true);
    }, []);

    const handleStartEdit = useCallback((record) => {
        handleStartEditBulk([record]);
    }, [handleStartEditBulk]);

    const handleSubmitEditPayload = useCallback(async () => {
        let allValid = true;
        for (const brand of editingBrands) {
            const sumValue = brand.breakdowns.reduce((sum, item) => sum + (item.TargetValue || 0), 0);
            if (Math.abs(sumValue - brand.totalTargetValue) > 1.0) {
                notifRef.current.warning({
                    message: 'Validation Mismatch',
                    description: `For ${brand.sellerId}, breakdown sum (₹${Math.round(sumValue).toLocaleString()}) must match total (₹${Math.round(brand.totalTargetValue).toLocaleString()}).`
                });
                allValid = false;
            }
        }
        if (!allValid) return;

        for (const brand of editingBrands) {
            const payloadBreakdowns = brand.breakdowns.map((bk) => ({
                periodValue: bk.PeriodValue,
                targetValue: bk.TargetValue,
                achievedValue: bk.AchievedValue || 0,
                percentageContribution: bk.PercentageContribution || 0
            }));
            updateTarget(brand.id, brand.totalTargetValue, payloadBreakdowns);
        }

        setEditModalVisible(false);
        setSelectedRowKeys([]);
    }, [editingBrands, updateTarget]);

    // Redesigned Columns Setup using useMemo for maximum performance
    const columns = useMemo(() => {
        const baseCols = [
            {
                title: 'Brand Name', key: 'sellerId', dataIndex: 'SellerId',
                render: (text, record) => {
                    const pct = record.TotalTargetValue > 0 ? (record.overallAchieved / record.TotalTargetValue) * 100 : 0;
                    const tier = getAchievementTier(pct);
                    const initial = text ? text.charAt(0).toUpperCase() : 'B';
                    return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#ffffff',
                                fontWeight: 800,
                                fontSize: 13,
                                boxShadow: '0 2px 4px rgba(79, 70, 229, 0.2)'
                            }}>
                                {initial}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <Text strong style={{ color: '#0f172a', fontSize: 13, lineHeight: '1.2' }}>{text}</Text>
                                <span style={{
                                    fontSize: 9,
                                    fontWeight: 700,
                                    color: tier.color,
                                    background: tier.bg,
                                    border: `1px solid ${tier.border}`,
                                    padding: '1px 5px',
                                    borderRadius: 4,
                                    marginTop: 4,
                                    width: 'fit-content'
                                }}>
                                    {tier.label}
                                </span>
                            </div>
                        </div>
                    );
                },
                width: 180, fixed: 'left'
            },
            {
                title: 'Manager', key: 'brandManager', dataIndex: 'BrandManager',
                render: (text) => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: text ? '#3b82f6' : '#94a3b8' }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: text ? '#334155' : '#94a3b8' }}>
                            {text || 'Unassigned'}
                        </span>
                    </div>
                ),
                width: 130, fixed: 'left'
            },
            {
                title: 'Plan Type', key: 'targetType', dataIndex: 'TargetType',
                render: (text) => {
                    const isYearly = text === 'YEARLY';
                    return (
                        <span style={{
                            fontSize: 10,
                            fontWeight: 750,
                            color: isYearly ? '#6366f1' : '#10b981',
                            background: isYearly ? '#f5f3ff' : '#ecfdf5',
                            border: `1px solid ${isYearly ? '#ddd6fe' : '#a7f3d0'}`,
                            padding: '2px 6px',
                            borderRadius: 6,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                        }}>
                            {isYearly ? 'Yearly' : 'Monthly'}
                        </span>
                    );
                },
                width: 100
            },
            {
                title: 'Target Goal', key: 'gmsTarget', dataIndex: 'TotalTargetValue',
                render: (val) => (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ color: '#4f46e5', fontWeight: 800, fontSize: 13 }}>
                            ₹{Math.round(val || 0).toLocaleString('en-IN')}
                        </span>
                        <span style={{ fontSize: 9, color: '#64748b' }}>Revenue Goal</span>
                    </div>
                ),
                width: 130
            },
            {
                title: 'Sales Achieved', key: 'gmsAchieved', dataIndex: 'overallAchieved',
                render: (val) => (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ color: '#10b981', fontWeight: 800, fontSize: 13 }}>
                            ₹{Math.round(val || 0).toLocaleString('en-IN')}
                        </span>
                        <span style={{ fontSize: 9, color: '#64748b' }}>Paced Sales</span>
                    </div>
                ),
                width: 130
            }
        ];

        const periodCols = [];

        if (selectedPlanType === 'YEARLY') {
            MONTH_NAMES.forEach((monthLabel, idx) => {
                const monthNum = idx + 1;
                const isMonthExpanded = expandedMonths.includes(monthNum);

                if (!isMonthExpanded) {
                    periodCols.push({
                        title: (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, minWidth: 90 }}>
                                <span style={{ fontWeight: 700, fontSize: 12 }}>{monthLabel}</span>
                                <Button size="small" type="text"
                                    icon={<ChevronRight size={13} />}
                                    onClick={(e) => { e.stopPropagation(); setExpandedMonths((prev) => [...prev, monthNum]); }}
                                    style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                                />
                            </div>
                        ),
                        key: `month-${monthNum}`, align: 'center', width: 120,
                        render: (_, record) => {
                            const mRecord = record.monthlyBreakdown?.find((m) => m.PeriodValue === monthNum);
                            return (
                                <PeriodCell
                                    target={mRecord?.TargetValue}
                                    achieved={mRecord?.AchievedValue}
                                    periodName={`${monthLabel} (Month Plan)`}
                                />
                            );
                        }
                    });
                } else {
                    periodCols.push({
                        title: (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, minWidth: 100 }}>
                                <span style={{ fontWeight: 700, color: '#4f46e5', fontSize: 12 }}>{monthLabel}</span>
                                <Button size="small" type="text" icon={<ChevronLeft size={13} />}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setExpandedMonths((prev) => prev.filter((m) => m !== monthNum));
                                        setExpandedWeeks((prev) => prev.filter((w) => !w.startsWith(`${monthNum}-`)));
                                    }}
                                    style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, color: '#4f46e5' }}
                                />
                            </div>
                        ),
                        key: `month-${monthNum}-summary`, align: 'center', width: 130,
                        render: (_, record) => {
                            const mRecord = record.monthlyBreakdown?.find((m) => m.PeriodValue === monthNum);
                            return (
                                <PeriodCell
                                    target={mRecord?.TargetValue}
                                    achieved={mRecord?.AchievedValue}
                                    periodName={`${monthLabel} Summary`}
                                />
                            );
                        }
                    });

                    for (let weekNum = 1; weekNum <= 5; weekNum++) {
                        const weekKey    = `${monthNum}-${weekNum}`;
                        const isWeekExp  = expandedWeeks.includes(weekKey);
                        const dbPeriodValue = monthNum * 10 + weekNum;

                        if (!isWeekExp) {
                            periodCols.push({
                                title: (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, minWidth: 80 }}>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: '#b45309' }}>W{weekNum}</span>
                                        <Button size="small" type="text" icon={<ChevronRight size={11} />}
                                            onClick={(e) => { e.stopPropagation(); setExpandedWeeks((prev) => [...prev, weekKey]); }}
                                            style={{ width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                                        />
                                    </div>
                                ),
                                key: `week-${dbPeriodValue}`, align: 'center', width: 105,
                                render: (_, record) => {
                                    const wRecord    = record.weeklyBreakdown?.find((w) => w.PeriodValue === dbPeriodValue);
                                    const mRecord    = record.monthlyBreakdown?.find((m) => m.PeriodValue === monthNum);
                                    const autoTarget = mRecord ? Math.round((mRecord.TargetValue || 0) / 4) : 0;
                                    const displayTarget   = wRecord ? Math.round(wRecord.TargetValue || 0) : autoTarget;
                                    const displayAchieved = wRecord ? Math.round(wRecord.AchievedValue || 0) : 0;
                                    return (
                                        <PeriodCell
                                            target={displayTarget}
                                            achieved={displayAchieved}
                                            periodName={`${monthLabel} - Week ${weekNum}`}
                                            compact={true}
                                        />
                                    );
                                }
                            });
                        } else {
                            periodCols.push({
                                title: (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 3, minWidth: 80 }}>
                                        <span style={{ fontSize: 11, color: '#d97706', fontWeight: 700 }}>W{weekNum}</span>
                                        <Button size="small" type="text" icon={<ChevronLeft size={11} />}
                                            onClick={(e) => { e.stopPropagation(); setExpandedWeeks((prev) => prev.filter((w) => w !== weekKey)); }}
                                            style={{ width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, color: '#d97706' }}
                                        />
                                    </div>
                                ),
                                key: `week-${dbPeriodValue}-summary`, align: 'center', width: 110,
                                render: (_, record) => {
                                    const wRecord = record.weeklyBreakdown?.find((w) => w.PeriodValue === dbPeriodValue);
                                    return (
                                        <PeriodCell
                                            target={wRecord?.TargetValue}
                                            achieved={wRecord?.AchievedValue}
                                            periodName={`${monthLabel} - Week ${weekNum} Summary`}
                                            compact={true}
                                        />
                                    );
                                }
                            });

                            for (let d = 0; d < 7; d++) {
                                const dayIndex = d;
                                periodCols.push({
                                    title: (() => {
                                        const { startDate } = getWeekRangeDates(new Date().getFullYear(), monthNum, weekNum);
                                        const hDay = new Date(startDate);
                                        hDay.setDate(hDay.getDate() + dayIndex);
                                        return <span style={{ fontSize: 10, fontWeight: 600, color: '#64748b' }}>{hDay.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span>;
                                    })(),
                                    key: `day-${dbPeriodValue}-d${dayIndex}`, align: 'center', width: 100,
                                    render: (_, record) => {
                                        const { startDate } = getWeekRangeDates(record.Year || new Date().getFullYear(), monthNum, weekNum);
                                        const start = new Date(startDate);
                                        const curr  = new Date(start);
                                        curr.setDate(start.getDate() + dayIndex);
                                        const dayStr      = curr.toISOString().substring(0, 10);
                                        const dRecord     = record.dailyBreakdown?.find((day) => day.SpecificDate?.substring(0, 10) === dayStr);
                                        const wRecord     = record.weeklyBreakdown?.find((w) => w.PeriodValue === dbPeriodValue);
                                        const autoTarget  = wRecord ? Math.round((wRecord.TargetValue || 0) / 7) : 0;
                                        const displayTarget   = dRecord ? Math.round(dRecord.TargetValue || 0) : autoTarget;
                                        const displayAchieved = dRecord ? Math.round(dRecord.AchievedValue || 0) : 0;
                                        const readableDate = curr.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
                                        return (
                                            <PeriodCell
                                                target={displayTarget}
                                                achieved={displayAchieved}
                                                periodName={`${readableDate} (Daily Plan)`}
                                                compact={true}
                                            />
                                        );
                                    }
                                });
                            }
                        }
                    }
                }
            });
        } else {
            for (let weekNum = 1; weekNum <= 5; weekNum++) {
                const weekKey   = `m-${weekNum}`;
                const isWeekExp = expandedWeeks.includes(weekKey);

                if (!isWeekExp) {
                    periodCols.push({
                        title: (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, minWidth: 90 }}>
                                <span style={{ fontWeight: 700, fontSize: 12 }}>Week {weekNum}</span>
                                <Button size="small" type="text" icon={<ChevronRight size={13} />}
                                    onClick={(e) => { e.stopPropagation(); setExpandedWeeks((prev) => [...prev, weekKey]); }}
                                    style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                                />
                            </div>
                        ),
                        key: `week-${weekNum}`, align: 'center', width: 120,
                        render: (_, record) => {
                            const wRecord = record.weeklyBreakdown?.find((w) => w.PeriodValue === weekNum);
                            const autoTarget = record.TotalTargetValue ? Math.round(record.TotalTargetValue / 4) : 0;
                            const displayTarget   = wRecord ? Math.round(wRecord.TargetValue || 0) : autoTarget;
                            const displayAchieved = wRecord ? Math.round(wRecord.AchievedValue || 0) : 0;
                            return (
                                <PeriodCell
                                    target={displayTarget}
                                    achieved={displayAchieved}
                                    periodName={`Week ${weekNum} (Monthly Plan)`}
                                />
                            );
                        }
                    });
                } else {
                    periodCols.push({
                        title: (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, minWidth: 90 }}>
                                <span style={{ fontWeight: 700, color: '#d97706', fontSize: 12 }}>Week {weekNum}</span>
                                <Button size="small" type="text" icon={<ChevronLeft size={13} />}
                                    onClick={(e) => { e.stopPropagation(); setExpandedWeeks((prev) => prev.filter((w) => w !== weekKey)); }}
                                    style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, color: '#d97706' }}
                                />
                            </div>
                        ),
                        key: `week-${weekNum}-summary`, align: 'center', width: 130,
                        render: (_, record) => {
                            const wRecord = record.weeklyBreakdown?.find((w) => w.PeriodValue === weekNum);
                            return (
                                <PeriodCell
                                    target={wRecord?.TargetValue}
                                    achieved={wRecord?.AchievedValue}
                                    periodName={`Week ${weekNum} Summary`}
                                />
                            );
                        }
                    });

                    for (let d = 0; d < 7; d++) {
                        const dayIndex = d;
                        periodCols.push({
                            title: (() => {
                                const { startDate } = getWeekRangeDates(new Date().getFullYear(), new Date().getMonth() + 1, weekNum);
                                const hDay = new Date(startDate);
                                hDay.setDate(hDay.getDate() + dayIndex);
                                return <span style={{ fontSize: 10, fontWeight: 600, color: '#64748b' }}>{hDay.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span>;
                            })(),
                            key: `mday-${weekNum}-d${dayIndex}`, align: 'center', width: 100,
                            render: (_, record) => {
                                const recYear  = record.Year  || new Date().getFullYear();
                                const recMonth = record.Month || (new Date().getMonth() + 1);
                                const { startDate } = getWeekRangeDates(recYear, recMonth, weekNum);
                                const start = new Date(startDate);
                                const curr  = new Date(start);
                                curr.setDate(start.getDate() + dayIndex);
                                const dayStr      = curr.toISOString().substring(0, 10);
                                const dRecord     = record.dailyBreakdown?.find((day) => day.SpecificDate?.substring(0, 10) === dayStr);
                                const wRecord     = record.weeklyBreakdown?.find((w) => w.PeriodValue === weekNum);
                                const autoTarget  = wRecord ? Math.round((wRecord.TargetValue || 0) / 7) : 0;
                                const displayTarget   = dRecord ? Math.round(dRecord.TargetValue || 0) : autoTarget;
                                const displayAchieved = dRecord ? Math.round(dRecord.AchievedValue || 0) : 0;
                                const readableDate = curr.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
                                return (
                                    <PeriodCell
                                        target={displayTarget}
                                        achieved={displayAchieved}
                                        periodName={`${readableDate} (Daily Plan)`}
                                        compact={true}
                                    />
                                );
                            }
                        });
                    }
                }
            }
        }

        const endCols = [
            {
                title: 'Completion Progress', key: 'progress',
                render: (_, record) => {
                    const pct = record.TotalTargetValue > 0
                        ? Math.round((record.overallAchieved / record.TotalTargetValue) * 100)
                        : 0;
                    return (
                        <div style={{ width: 170, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 11, fontWeight: 850, color: pct >= 100 ? '#10b981' : pct >= 80 ? '#6366f1' : pct >= 50 ? '#f59e0b' : '#ef4444' }}>
                                    {pct}%
                                </span>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                    <SavingIndicator
                                        id={record.Id}
                                        savingIds={savingIds}
                                        errorIds={errorIds}
                                        isOptimistic={record._optimistic}
                                    />
                                    <span style={{ fontSize: 9, color: '#94a3b8' }}>
                                        {pct >= 100 ? 'Completed' : 'Remaining'}
                                    </span>
                                </div>
                            </div>
                            <Progress
                                percent={Math.min(pct, 100)}
                                strokeColor={pct >= 100 ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)' : pct >= 80 ? 'linear-gradient(90deg, #6366f1 0%, #4f46e5 100%)' : 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)'}
                                size={[140, 6]} showInfo={false}
                                style={{ margin: 0 }}
                            />
                        </div>
                    );
                },
                width: 195
            },
            {
                title: 'Pacing Status', key: 'status',
                render: (_, record) => {
                    const target = record.TotalTargetValue;
                    const achieved = record.overallAchieved;
                    if (!target || target <= 0) return <Tag color="default">N/A</Tag>;
                    const pct = (achieved / target) * 100;
                    if (pct >= 100) {
                        return (
                            <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                fontSize: 11, fontWeight: 700, color: '#065f46',
                                background: '#d1fae5', border: '1px solid #a7f3d0',
                                padding: '3px 8px', borderRadius: 20
                            }}>
                                <CheckCircle2 size={12} /> Elite Pacing
                            </span>
                        );
                    }
                    if (pct >= 80) {
                        return (
                            <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                fontSize: 11, fontWeight: 700, color: '#1e3a8a',
                                background: '#dbeafe', border: '1px solid #bfdbfe',
                                padding: '3px 8px', borderRadius: 20
                            }}>
                                <TrendingUp size={12} /> Strong Pacing
                            </span>
                        );
                    }
                    if (pct >= 50) {
                        return (
                            <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                fontSize: 11, fontWeight: 700, color: '#92400e',
                                background: '#fef3c7', border: '1px solid #fde68a',
                                padding: '3px 8px', borderRadius: 20
                            }}>
                                <Zap size={12} /> Moderate Pacing
                            </span>
                        );
                    }
                    return (
                        <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            fontSize: 11, fontWeight: 700, color: '#991b1b',
                            background: '#fee2e2', border: '1px solid #fca5a5',
                            padding: '3px 8px', borderRadius: 20
                        }}>
                            <AlertTriangle size={12} /> Under Pacing
                        </span>
                    );
                },
                width: 140
            },
            {
                title: 'Actions', key: 'actions', width: 140, align: 'right',
                render: (_, record) => (
                    <div className="action-buttons-container" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <Tooltip title="Edit Target Allocation">
                            <Button type="text" shape="circle" size="middle" icon={<Edit3 size={15} style={{ color: '#4f46e5' }} />}
                                onClick={() => handleStartEdit(record)}
                                style={{ background: '#f5f3ff', border: '1px solid #ddd6fe' }}
                            />
                        </Tooltip>
                        <Popconfirm
                            title="Delete target record?"
                            description="This will permanently delete this target and all its breakdowns."
                            onConfirm={() => handleDeleteSingle(record.Id)}
                            okText="Yes, Delete" cancelText="No" okButtonProps={{ danger: true }}
                        >
                            <Tooltip title="Delete Target Record">
                                <Button type="text" danger shape="circle" size="middle" icon={<Trash2 size={15} />}
                                    style={{ background: '#fef2f2', border: '1px solid #fee2e2' }}
                                />
                            </Tooltip>
                        </Popconfirm>
                    </div>
                ),
                fixed: 'right'
            }
        ];

        return [...baseCols, ...periodCols, ...endCols];
    }, [expandedMonths, expandedWeeks, selectedPlanType, handleStartEdit, handleDeleteSingle, savingIds, errorIds]);

    // Memoize Table configurations
    const rowSelection = useMemo(() => ({
        selectedRowKeys,
        onChange: setSelectedRowKeys
    }), [selectedRowKeys]);

    const pagination = useMemo(() => ({
        pageSize: 15,
        showSizeChanger: true,
        pageSizeOptions: ['10', '15', '25', '50'],
        showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} targets`
    }), []);



    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <style>{`
                .hover-lift {
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .hover-lift:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
                }
                .kpi-card {
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .kpi-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 12px 24px -6px rgba(0, 0, 0, 0.08);
                    border-color: #cbd5e1;
                }
                .premium-header {
                    background: linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #1e3a8a 100%);
                    position: relative;
                    overflow: hidden;
                    border-radius: 16px;
                    padding: 24px 32px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    box-shadow: 0 10px 30px -10px rgba(30, 27, 75, 0.5);
                }
                .premium-header::before {
                    content: '';
                    position: absolute;
                    top: -50%;
                    left: -50%;
                    width: 200%;
                    height: 200%;
                    background: radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 60%);
                    pointer-events: none;
                }
                .row-exceeded {
                    background-color: rgba(240, 253, 244, 0.4) !important;
                }
                .row-at-risk {
                    background-color: rgba(254, 242, 242, 0.4) !important;
                }
                /* Custom Scrollbars */
                .ant-table-body::-webkit-scrollbar {
                    width: 6px;
                    height: 6px;
                }
                .ant-table-body::-webkit-scrollbar-track {
                    background: #f1f5f9;
                }
                .ant-table-body::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 3px;
                }
                .ant-table-body::-webkit-scrollbar-thumb:hover {
                    background: #94a3b8;
                }
            `}</style>

            <ConnectionBanner targets={targets} />

            {/* 1. Page Header (Premium Redesigned) */}
            <div className="premium-header" style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16
            }}>
                <Space size={16}>
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(8px)',
                        color: '#a5b4fc', padding: 14, borderRadius: 12, display: 'flex',
                        boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2)'
                    }}>
                        <Target size={28} />
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontWeight: 900, color: '#ffffff', fontSize: 24, letterSpacing: '-0.5px' }}>
                            Target v/s Achievements
                        </h2>
                        <Text style={{ color: '#c7d2fe', fontSize: 13, fontWeight: 500 }}>
                            Map revenue goals, distribute values to months/weeks/days, and trace real-time sales pacing.
                        </Text>
                    </div>
                </Space>
                
                <Space size={12} style={{ flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255, 255, 255, 0.08)', borderRadius: 10, padding: 4, border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                        <Segmented
                            value={selectedPlanType}
                            onChange={(value) => {
                                setSelectedPlanType(value);
                                setSelectedRowKeys([]);
                                handleCollapseAll();
                            }}
                            options={[
                                { label: 'Yearly Plans',  value: 'YEARLY' },
                                { label: 'Monthly Plans', value: 'MONTHLY' }
                            ]}
                            style={{ background: 'transparent', fontWeight: 650, color: '#ffffff' }}
                        />
                    </div>

                    <Select
                        value={selectedYear}
                        onChange={setSelectedYear}
                        style={{ width: 100, height: 40 }}
                        className="glass-select"
                        styles={{ popup: { root: { borderRadius: '8px' } } }}
                    >
                        {availableYears.map(year => (
                            <Option key={year} value={year}>{year}</Option>
                        ))}
                    </Select>

                    <Button
                        shape="round"
                        icon={<RefreshCw size={15} />}
                        onClick={fetchData}
                        loading={loading}
                        style={{
                            height: 40,
                            fontWeight: 600,
                            background: 'rgba(255, 255, 255, 0.08)',
                            borderColor: 'rgba(255, 255, 255, 0.15)',
                            color: '#ffffff'
                        }}
                    >
                        Refresh
                    </Button>
                    
                    {hasExpandedColumns && (
                        <Button shape="round" icon={<Minimize2 size={15} />} onClick={handleCollapseAll}
                            style={{
                                fontWeight: 600, height: 40,
                                background: 'rgba(255, 255, 255, 0.08)',
                                borderColor: 'rgba(255, 255, 255, 0.15)',
                                color: '#a5b4fc'
                            }}
                        >
                            Collapse All
                        </Button>
                    )}
                    
                    <Button type="primary" shape="round" icon={<Plus size={16} />} onClick={handleOpenModal}
                        style={{
                            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                            borderColor: '#4f46e5',
                            fontWeight: 700,
                            height: 40,
                            boxShadow: '0 4px 14px rgba(79, 70, 229, 0.4)'
                        }}
                    >
                        Establish Targets
                    </Button>
                </Space>
            </div>

            {/* 2. Redesigned KPI Metric Panel */}
            <Row gutter={[20, 20]}>
                <Col xs={24} sm={12} lg={6}>
                    <KpiCard
                        title="TOTAL PLAN TARGET"
                        value={kpiStats.totalTarget}
                        isCurrency={true}
                        icon={<Target size={20} />}
                        color="#4f46e5"
                        subtext={`Across ${kpiStats.brandCount} active revenue plans`}
                    />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <KpiCard
                        title="SALES ACHIEVED"
                        value={kpiStats.totalAchieved}
                        isCurrency={true}
                        icon={<BarChart3 size={20} />}
                        color="#10b981"
                        subtext="Real-time sales tracking & pacing"
                    />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <KpiCard
                        title="GLOBAL ACHIEVEMENT RATE"
                        value={kpiStats.achievementRate}
                        trend={kpiStats.achievementRate}
                        suffix="%"
                        icon={<TrendingUp size={20} />}
                        color={kpiStats.achievementRate >= 80 ? '#10b981' : kpiStats.achievementRate >= 50 ? '#f59e0b' : '#ef4444'}
                        subtext="Target accomplishment pacing"
                    />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <KpiCard
                        title="PREMIUM BRANDS"
                        value={kpiStats.premiumCount}
                        icon={<Award size={20} />}
                        color="#f59e0b"
                        subtext={`${kpiStats.premiumCount} brands achieved >= 80%`}
                    />
                </Col>
            </Row>

            {/* 3. Search and Quick Filters bar */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12,
                padding: '12px 16px', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                gap: 16, flexWrap: 'wrap'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 260 }}>
                    <Input
                        placeholder="Search by brand name or manager..."
                        prefix={<Search size={16} style={{ color: '#94a3b8' }} />}
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        allowClear
                        style={{ borderRadius: 8, height: 38 }}
                    />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>
                        Showing {filteredTargets.length} brand target records
                    </span>
                    <Divider orientation="vertical" style={{ height: 20 }} />
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>
                        Color indicators: <Tag color="success" style={{ margin: '0 2px' }}>Elite (100%+)</Tag> <Tag color="processing" style={{ margin: '0 2px' }}>High (80%+)</Tag> <Tag color="warning" style={{ margin: '0 2px' }}>Track (50%+)</Tag>
                    </span>
                </div>
            </div>

            {/* Bulk Selection Bar */}
            {selectedRowKeys.length > 0 && (
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 12,
                    padding: '12px 24px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                    animation: 'slideIn 0.2s ease-out'
                }}>
                    <Space>
                        <AlertTriangle style={{ color: '#4f46e5' }} size={20} />
                        <Text strong style={{ color: '#334155' }}>{selectedRowKeys.length} Target records selected</Text>
                    </Space>
                    <Space size={12}>
                        <Button type="primary" icon={<Edit3 size={16} />} shape="round"
                            onClick={() => {
                                const selectedRecords = targets.filter((t) => selectedRowKeys.includes(t.Id));
                                handleStartEditBulk(selectedRecords);
                            }}
                            style={{ background: '#4f46e5', borderColor: '#4f46e5', fontWeight: 600 }}
                        >
                            Bulk Edit Selected ({selectedRowKeys.length})
                        </Button>
                        <Popconfirm
                            title="Delete Selected Targets?"
                            description="This will permanently delete all selected targets and their breakdowns."
                            onConfirm={handleDeleteBulk}
                            okText="Yes, Delete All" cancelText="No, Keep" okButtonProps={{ danger: true }}
                        >
                            <Button type="primary" danger icon={<Trash2 size={16} />} shape="round">
                                Delete Selected ({selectedRowKeys.length})
                            </Button>
                        </Popconfirm>
                    </Space>
                </div>
            )}

            {/* 4. Main Table */}
            <Card style={{ borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }} styles={{ body: { padding: 0 } }}>
                <Table
                    dataSource={filteredTargets}
                    columns={columns}
                    rowKey="Id"
                    loading={loading}
                    rowSelection={rowSelection}
                    pagination={pagination}
                    scroll={{ x: 1200, y: 520 }}
                    virtual
                    size="small"
                    rowClassName={(record) => {
                        const pct = record.TotalTargetValue > 0 ? (record.overallAchieved / record.TotalTargetValue) * 100 : 0;
                        if (pct >= 100) return 'row-exceeded';
                        if (pct < 50) return 'row-at-risk';
                        return '';
                    }}
                />
            </Card>

            {/* 5. Add Targets Modal */}
            <AddTargetModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                sellers={sellers}
                onSubmit={handleSubmitTargets}
            />

            {/* 6. Edit Targets Modal */}
            <EditTargetModal
                visible={editModalVisible}
                onClose={() => setEditModalVisible(false)}
                editingBrands={editingBrands}
                setEditingBrands={setEditingBrands}
                onSubmit={handleSubmitEditPayload}
                loading={loading}
            />

            {notificationContextHolder}
            {targetsContextHolder}
        </div>
    );
};

export default TargetVsAchievement;
