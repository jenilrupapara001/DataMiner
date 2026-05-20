import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import {
    Table, Button, Modal, Select, InputNumber, Tabs, Input,
    Space, Card, Row, Col, Typography, Progress, Badge, Alert,
    Tag, Tooltip, notification, Popconfirm, Divider, Segmented
} from 'antd';
import {
    Plus, Target, DollarSign, Percent, Save, CheckCircle,
    AlertTriangle, Edit3, Trash2, Calendar, LayoutGrid, Check,
    TrendingUp, Layers, ChevronLeft, ChevronRight, Minimize2
} from 'lucide-react';
import { usePageTitle } from '../contexts/PageTitleContext';
import { sellerApi, targetsApi } from '../services/api';

const { Text, Title } = Typography;
const { Option } = Select;

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

// ─── FIX 7: Move pure utility function outside component ─────────────────────
// Previously inside the component body — was recreated on every render.
// Pure function with no closure dependencies — safe to hoist permanently.
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

// ─── FIX 6a: Extract Add-Target Brand Tab into its own memoized component ────
// Previously the entire configuredBrands.map() was re-evaluated on every
// keystroke in any input field, causing ALL tabs to re-render simultaneously.
// With memo(), only the tab whose props change will re-render.
const BrandConfigTab = memo(({
    brand,
    sellers,
    onUpdate,
    onDistributionChange,
    onDistributeUniformly,
    onSave,
}) => {
    const sumPercentage = useMemo(
        () => brand.breakdowns.reduce((sum, item) => sum + (item.percentageContribution || 0), 0),
        [brand.breakdowns]
    );
    const sumValue = useMemo(
        () => brand.breakdowns.reduce((sum, item) => sum + (item.targetValue || 0), 0),
        [brand.breakdowns]
    );
    const isPercentageValid = Math.abs(sumPercentage - 100) < 0.5;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
            <Row gutter={16}>
                <Col span={8}>
                    <label style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>Select Seller / Brand</label>
                    <Select
                        style={{ width: '100%' }}
                        value={brand.sellerId || undefined}
                        placeholder="Choose Brand"
                        onChange={(val) => {
                            const selectedSeller = sellers.find(
                                (s) => (s.sellerId || s.SellerId || s.Id || s._id) === val
                            );
                            const managerName = selectedSeller?.managers
                                ?.map((m) => `${m.firstName || m.FirstName || ''} ${m.lastName || m.LastName || ''}`.trim())
                                .filter(Boolean)
                                .join(', ') || '';
                            onUpdate({ sellerId: val, brandManager: managerName });
                        }}
                    >
                        {sellers.map((s) => {
                            const sellerValue = s.sellerId || s.SellerId || s.Id || s._id;
                            const sellerLabel = s.name || s.Name || sellerValue;
                            return <Option key={sellerValue} value={sellerValue}>{sellerLabel}</Option>;
                        })}
                    </Select>
                </Col>
                <Col span={8}>
                    <label style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>Brand Manager</label>
                    <Input
                        placeholder="Manager Name"
                        value={brand.brandManager}
                        onChange={(e) => onUpdate({ brandManager: e.target.value })}
                    />
                </Col>
                <Col span={8}>
                    <label style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>Target Type</label>
                    <Select
                        style={{ width: '100%' }}
                        value={brand.targetType}
                        onChange={(val) => onUpdate({ targetType: val })}
                    >
                        <Option value="YEARLY">Yearly GMS</Option>
                        <Option value="MONTHLY">Monthly GMS</Option>
                    </Select>
                </Col>
            </Row>

            <Row gutter={16}>
                <Col span={8}>
                    <label style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>Plan Year</label>
                    <InputNumber
                        style={{ width: '100%' }}
                        value={brand.year}
                        onChange={(val) => onUpdate({ year: val })}
                    />
                </Col>
                {brand.targetType === 'MONTHLY' && (
                    <Col span={8}>
                        <label style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>Plan Month</label>
                        <Select
                            style={{ width: '100%' }}
                            value={brand.month}
                            onChange={(val) => onUpdate({ month: val })}
                        >
                            {MONTH_NAMES.map((m, idx) => (
                                <Option key={idx + 1} value={idx + 1}>{m}</Option>
                            ))}
                        </Select>
                    </Col>
                )}
                <Col span={brand.targetType === 'MONTHLY' ? 8 : 16}>
                    <label style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>GMS Target Value (₹)</label>
                    <InputNumber
                        style={{ width: '100%' }}
                        formatter={(value) => `₹ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        parser={(value) => value.replace(/₹\s?|(,*)/g, '')}
                        value={brand.totalTargetValue}
                        onChange={(val) => onUpdate({ totalTargetValue: val })}
                    />
                </Col>
            </Row>

            <Divider style={{ margin: '8px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Title level={5} style={{ margin: 0 }}>Allocation Breakdown</Title>
                <Button size="small" type="dashed" onClick={onDistributeUniformly}>
                    Distribute Uniformly
                </Button>
            </div>

            <div style={{ maxHeight: 250, overflowY: 'auto', paddingRight: 8 }}>
                <Row gutter={[16, 12]} style={{ fontWeight: 600, borderBottom: '1px solid #e2e8f0', paddingBottom: 4 }}>
                    <Col span={8}>Period</Col>
                    <Col span={8}>Weight Percentage (%)</Col>
                    <Col span={8}>Allocated Target (₹)</Col>
                </Row>
                {brand.breakdowns.map((b, idx) => (
                    <Row key={idx} gutter={[16, 12]} style={{ alignItems: 'center', marginTop: 8 }}>
                        <Col span={8}>
                            {brand.targetType === 'YEARLY' ? MONTH_NAMES[idx] : `Week ${idx + 1}`}
                        </Col>
                        <Col span={8}>
                            <InputNumber
                                style={{ width: '100%' }}
                                min={0}
                                max={100}
                                addonAfter="%"
                                value={b.percentageContribution}
                                onChange={(val) => onDistributionChange(idx, 'percentageContribution', val)}
                            />
                        </Col>
                        <Col span={8}>
                            <InputNumber
                                style={{ width: '100%' }}
                                formatter={(value) => `₹ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                parser={(value) => value.replace(/₹\s?|(,*)/g, '')}
                                value={b.targetValue}
                                onChange={(val) => onDistributionChange(idx, 'targetValue', val)}
                            />
                        </Col>
                    </Row>
                ))}
            </div>

            <Alert
                type={isPercentageValid ? 'success' : 'warning'}
                showIcon
                message={
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Allocated: <strong>{sumPercentage.toFixed(2)}%</strong> (Remaining: {(100 - sumPercentage).toFixed(2)}%)</span>
                        <span>Sum Allocated: <strong>₹{sumValue.toLocaleString('en-IN')}</strong> of ₹{(brand.totalTargetValue || 0).toLocaleString('en-IN')}</span>
                    </div>
                }
            />

            <Button
                type="primary"
                icon={<Save size={16} />}
                onClick={() => onSave(brand.key)}
                style={{ alignSelf: 'flex-end', background: '#10b981', borderColor: '#10b981' }}
            >
                Lock & Save Brand Config
            </Button>
        </div>
    );
});

// ─── FIX 6b: Extract Edit Brand Tab into its own memoized component ───────────
const EditBrandTab = memo(({
    brand,
    onBreakdownChange,
    onTotalTargetChange,
}) => {
    const sumValue = useMemo(
        () => brand.breakdowns.reduce((sum, item) => sum + (item.TargetValue || 0), 0),
        [brand.breakdowns]
    );
    const isValueMatching = Math.abs(sumValue - brand.totalTargetValue) < 1.0;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingTop: 8 }}>
            <Row gutter={16} align="middle">
                <Col span={12}>
                    <Card size="small" style={{ background: '#f8fafc', borderRadius: 8 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>Seller ID</Text>
                        <Title level={4} style={{ margin: 0, color: '#1e293b' }}>{brand.sellerId}</Title>
                    </Card>
                </Col>
                <Col span={12}>
                    <label style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>Total Target Value (₹)</label>
                    <InputNumber
                        style={{ width: '100%' }}
                        value={brand.totalTargetValue}
                        formatter={(value) => `₹ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        parser={(value) => value.replace(/₹\s?|(,*)/g, '')}
                        onChange={(val) => onTotalTargetChange(brand.key, parseFloat(String(val)) || 0)}
                    />
                </Col>
            </Row>

            <Card
                size="small"
                title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <span style={{ fontWeight: 700 }}>Breakdown Allocation Grid</span>
                        {isValueMatching
                            ? <Tag color="success">₹ Value Matches perfectly</Tag>
                            : <Tag color="error">₹ Sum does not match Total (Diff: ₹{Math.round(brand.totalTargetValue - sumValue).toLocaleString()})</Tag>
                        }
                    </div>
                }
                style={{ borderRadius: 8 }}
            >
                <Row gutter={[16, 16]}>
                    {brand.breakdowns.map((bk, bkIndex) => (
                        <Col span={brand.targetType === 'YEARLY' ? 6 : 8} key={bkIndex}>
                            <div style={{ background: '#f8fafc', padding: 8, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                                <Text strong style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>{bk.label}</Text>
                                <label style={{ fontSize: 10, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 2 }}>Target (₹)</label>
                                <InputNumber
                                    size="small"
                                    style={{ width: '100%' }}
                                    value={bk.TargetValue}
                                    formatter={(value) => `₹ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                    parser={(value) => value.replace(/₹\s?|(,*)/g, '')}
                                    onChange={(val) => onBreakdownChange(brand.key, bkIndex, 'TargetValue', parseFloat(String(val)) || 0)}
                                />
                                <label style={{ fontSize: 10, fontWeight: 600, color: '#10b981', display: 'block', marginBottom: 2, marginTop: 6 }}>Achieved (₹)</label>
                                <InputNumber
                                    size="small"
                                    style={{ width: '100%' }}
                                    value={bk.AchievedValue}
                                    formatter={(value) => `₹ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                    parser={(value) => value.replace(/₹\s?|(,*)/g, '')}
                                    onChange={(val) => onBreakdownChange(brand.key, bkIndex, 'AchievedValue', parseFloat(String(val)) || 0)}
                                />
                                <Text type="secondary" style={{ fontSize: 10, display: 'block', marginTop: 4, textAlign: 'right' }}>
                                    {((bk.TargetValue / (brand.totalTargetValue || 1)) * 100).toFixed(1)}% Contribution
                                </Text>
                            </div>
                        </Col>
                    ))}
                </Row>
            </Card>
        </div>
    );
});

// ─── Main Component ───────────────────────────────────────────────────────────

const TargetVsAchievement = () => {
    const { setPageTitle } = usePageTitle();
    const [notificationApi, notificationContextHolder] = notification.useNotification();

    // ── FIX 2: Stabilize notificationApi in a ref ─────────────────────────────
    // notification.useNotification() returns a new `notificationApi` object on
    // every render. Using it directly in the dep array of `fetchData` caused
    // fetchData to be recreated every render → useEffect re-ran endlessly.
    // Storing in a ref gives us a stable pointer with always-current value.
    const notifRef = useRef(notificationApi);
    useEffect(() => { notifRef.current = notificationApi; });

    const [loading, setLoading]                   = useState(true);
    const [targets, setTargets]                   = useState([]);
    const [sellers, setSellers]                   = useState([]);
    const [selectedPlanType, setSelectedPlanType] = useState('YEARLY');
    const [selectedRowKeys, setSelectedRowKeys]   = useState([]);
    const [modalVisible, setModalVisible]         = useState(false);
    const [configuredBrands, setConfiguredBrands] = useState([]);
    const [activeTabKey, setActiveTabKey]         = useState('0');
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingBrands, setEditingBrands]       = useState([]);
    const [activeEditTabKey, setActiveEditTabKey] = useState('0');
    const [expandedMonths, setExpandedMonths]     = useState([]);
    const [expandedWeeks, setExpandedWeeks]       = useState([]);

    // ── FIX 2 (continued): fetchData now parallelizes all initial requests ─────
    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            // Parallel loading using Promise.all to eliminate sequential waterfall
            const [targetsRes, sellersRes] = await Promise.all([
                targetsApi.getAll(),
                sellerApi.getAll()
            ]);

            if (targetsRes?.success) {
                setTargets(targetsRes.data);
            }

            if (sellersRes?.success) {
                const list = sellersRes.data?.sellers || sellersRes.data || sellersRes.sellers || [];
                setSellers(Array.isArray(list) ? list : []);
            }
        } catch (e) {
            notifRef.current.error({
                message: 'Failed to fetch dashboard data',
                description: e.message || 'Error occurred while connecting to backend.'
            });
        } finally {
            setLoading(false);
        }
    }, []); // ← stable forever

    useEffect(() => {
        setPageTitle('Target v/s Achievements');
        fetchData();
    }, [setPageTitle, fetchData]);

    // Already memoized — good ✅
    const filteredTargets = useMemo(
        () => targets.filter((t) => t.TargetType === selectedPlanType),
        [targets, selectedPlanType]
    );

    const handleCollapseAll = useCallback(() => {
        setExpandedMonths([]);
        setExpandedWeeks([]);
    }, []);

    const hasExpandedColumns = expandedMonths.length > 0 || expandedWeeks.length > 0;

    // ── FIX 4: Wrap all action handlers in useCallback ────────────────────────
    const handleDeleteSingle = useCallback(async (id) => {
        try {
            setLoading(true);
            const res = await targetsApi.delete(id);
            if (res?.success) {
                notifRef.current.success({ message: 'Target deleted successfully!' });
                fetchData();
            }
        } catch (e) {
            notifRef.current.error({ message: 'Deletion Failed', description: e.message });
        } finally {
            setLoading(false);
        }
    }, [fetchData]);

    const handleDeleteBulk = useCallback(async () => {
        try {
            setLoading(true);
            const res = await targetsApi.deleteBulk(selectedRowKeys);
            if (res?.success) {
                notifRef.current.success({ message: 'Selected targets deleted successfully!' });
                setSelectedRowKeys([]);
                fetchData();
            }
        } catch (e) {
            notifRef.current.error({ message: 'Bulk Deletion Failed', description: e.message });
        } finally {
            setLoading(false);
        }
    }, [selectedRowKeys, fetchData]);

    const handleOpenModal = useCallback(() => {
        const initialBrand = {
            key: '0', sellerId: '', brandManager: '',
            targetType: 'YEARLY',
            year: new Date().getFullYear(),
            month: new Date().getMonth() + 1,
            totalTargetValue: 0,
            breakdowns: Array.from({ length: 12 }, (_, i) => ({
                periodValue: i + 1, percentageContribution: 0, targetValue: 0
            })),
            saved: false
        };
        setConfiguredBrands([initialBrand]);
        setActiveTabKey('0');
        setModalVisible(true);
    }, []);

    const handleAddBrandTab = useCallback(() => {
        setConfiguredBrands((prev) => {
            const newKey = String(prev.length);
            return [...prev, {
                key: newKey, sellerId: '', brandManager: '',
                targetType: 'YEARLY',
                year: new Date().getFullYear(),
                month: new Date().getMonth() + 1,
                totalTargetValue: 0,
                breakdowns: Array.from({ length: 12 }, (_, i) => ({
                    periodValue: i + 1, percentageContribution: 0, targetValue: 0
                })),
                saved: false
            }];
        });
        setActiveTabKey((prev) => String(parseInt(prev) + 1));
    }, []);

    // ── FIX 11: Memoize modal update helpers ─────────────────────────────────
    const updateActiveBrand = useCallback((updates) => {
        setConfiguredBrands((prev) =>
            prev.map((item) => {
                if (item.key !== activeTabKey) return item;
                const merged = { ...item, ...updates, saved: false };
                if (updates.targetType) {
                    merged.breakdowns = updates.targetType === 'YEARLY'
                        ? Array.from({ length: 12 }, (_, i) => ({ periodValue: i + 1, percentageContribution: 0, targetValue: 0 }))
                        : Array.from({ length: 5 },  (_, i) => ({ periodValue: i + 1, percentageContribution: 0, targetValue: 0 }));
                }
                return merged;
            })
        );
    }, [activeTabKey]);

    const handleDistributionChange = useCallback((index, field, value) => {
        setConfiguredBrands((prev) =>
            prev.map((item) => {
                if (item.key !== activeTabKey) return item;
                const newBreakdowns = [...item.breakdowns];
                const totalTarget = item.totalTargetValue || 0;
                if (field === 'percentageContribution') {
                    const pct = value || 0;
                    newBreakdowns[index] = {
                        ...newBreakdowns[index],
                        percentageContribution: pct,
                        targetValue: Math.round((pct / 100) * totalTarget * 100) / 100
                    };
                } else {
                    const val = value || 0;
                    newBreakdowns[index] = {
                        ...newBreakdowns[index],
                        targetValue: val,
                        percentageContribution: totalTarget > 0 ? Math.round((val / totalTarget) * 100 * 100) / 100 : 0
                    };
                }
                return { ...item, breakdowns: newBreakdowns, saved: false };
            })
        );
    }, [activeTabKey]);

    const distributeUniformly = useCallback(() => {
        setConfiguredBrands((prev) =>
            prev.map((item) => {
                if (item.key !== activeTabKey) return item;
                const len = item.breakdowns.length;
                const uniformPct = Math.round((100 / len) * 100) / 100;
                const uniformVal = Math.round((item.totalTargetValue / len) * 100) / 100;
                const newBreakdowns = item.breakdowns.map((b, idx) => ({
                    ...b,
                    percentageContribution: idx === len - 1 ? 100 - uniformPct * (len - 1) : uniformPct,
                    targetValue:            idx === len - 1 ? item.totalTargetValue - uniformVal * (len - 1) : uniformVal
                }));
                return { ...item, breakdowns: newBreakdowns, saved: false };
            })
        );
    }, [activeTabKey]);

    const handleSaveBrandConfig = useCallback((key) => {
        setConfiguredBrands((prev) => {
            const brand = prev.find((b) => b.key === key);
            if (!brand) return prev;

            if (!brand.sellerId) {
                notifRef.current.warning({ message: 'Seller Required', description: 'Please select a seller/brand.' });
                return prev;
            }
            if (!brand.totalTargetValue || brand.totalTargetValue <= 0) {
                notifRef.current.warning({ message: 'Invalid Target', description: 'Please enter a valid target value.' });
                return prev;
            }
            const sumPct = brand.breakdowns.reduce((sum, b) => sum + (b.percentageContribution || 0), 0);
            if (Math.abs(sumPct - 100) > 0.5) {
                notifRef.current.error({
                    message: 'Breakdown Error',
                    description: `Percentages must sum to 100%. Current: ${sumPct.toFixed(2)}%`
                });
                return prev;
            }
            notifRef.current.success({ message: `Config for ${brand.sellerId} saved locally!` });
            // ── FIX 9: Immutable update — never mutate original objects ────────
            return prev.map((item) => item.key === key ? { ...item, saved: true } : item);
        });
    }, []);

    // ── FIX 9 (continued): handleSaveAllBrands no longer mutates brand objects
    const handleSaveAllBrands = useCallback(() => {
        let allValid = true;
        setConfiguredBrands((prev) => {
            return prev.map((brand) => {
                const sumPct = brand.breakdowns.reduce((sum, b) => sum + (b.percentageContribution || 0), 0);
                if (!brand.sellerId || !brand.totalTargetValue || Math.abs(sumPct - 100) > 0.5) {
                    allValid = false;
                    return brand;
                }
                return { ...brand, saved: true }; // ← immutable update
            });
        });
        if (allValid) {
            notifRef.current.success({ message: 'All brand configurations validated & saved!' });
        }
    }, []);

    const handleSubmitTargets = useCallback(async () => {
        const unsaved = configuredBrands.filter((b) => !b.saved);
        if (unsaved.length > 0) {
            notifRef.current.warning({
                message: 'Unsaved Configurations',
                description: 'All configured brands must be saved before submitting.'
            });
            return;
        }
        try {
            setLoading(true);
            const payload = configuredBrands.map((b) => ({
                sellerId: b.sellerId, brandManager: b.brandManager,
                targetType: b.targetType, year: b.year,
                month: b.targetType === 'MONTHLY' ? b.month : null,
                totalTargetValue: b.totalTargetValue, breakdowns: b.breakdowns
            }));
            const res = await targetsApi.create(payload);
            if (res?.success) {
                notifRef.current.success({ message: 'Targets established & auto-distributed successfully!' });
                setModalVisible(false);
                fetchData();
            }
        } catch (e) {
            notifRef.current.error({ message: 'Submission Failed', description: e.message });
        } finally {
            setLoading(false);
        }
    }, [configuredBrands, fetchData]);

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
        setActiveEditTabKey('0');
        setEditModalVisible(true);
    }, []);

    const handleStartEdit = useCallback((record) => {
        handleStartEditBulk([record]);
    }, [handleStartEditBulk]);

    // ── FIX 6b: Lifted edit handlers out of JSX into stable callbacks ─────────
    const handleEditBreakdownChange = useCallback((brandKey, bkIndex, field, val) => {
        setEditingBrands((prev) =>
            prev.map((b) => {
                if (b.key !== brandKey) return b;
                const updatedBreakdowns = b.breakdowns.map((item, i) => {
                    if (i !== bkIndex) return item;
                    return field === 'TargetValue'
                        ? { ...item, TargetValue: val, PercentageContribution: b.totalTargetValue > 0 ? (val / b.totalTargetValue) * 100 : 0 }
                        : { ...item, AchievedValue: val };
                });
                return { ...b, breakdowns: updatedBreakdowns };
            })
        );
    }, []);

    const handleEditTotalTargetChange = useCallback((brandKey, val) => {
        setEditingBrands((prev) =>
            prev.map((b) => {
                if (b.key !== brandKey) return b;
                const updatedBreakdowns = b.breakdowns.map((item) => ({
                    ...item,
                    TargetValue: (val * (item.PercentageContribution || (100 / b.breakdowns.length))) / 100
                }));
                return { ...b, totalTargetValue: val, breakdowns: updatedBreakdowns };
            })
        );
    }, []);

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
        try {
            setLoading(true);
            for (const brand of editingBrands) {
                const payloadBreakdowns = brand.breakdowns.map((bk) => ({
                    periodValue: bk.PeriodValue,
                    targetValue: bk.TargetValue,
                    achievedValue: bk.AchievedValue || 0
                }));
                await targetsApi.update(brand.id, brand.totalTargetValue, payloadBreakdowns);
            }
            notifRef.current.success({ message: 'Target configuration changes saved successfully!' });
            setEditModalVisible(false);
            setSelectedRowKeys([]);
            fetchData();
        } catch (e) {
            notifRef.current.error({ message: 'Failed to update target config', description: e.message });
        } finally {
            setLoading(false);
        }
    }, [editingBrands, fetchData]);

    // ── FIX 1: Memoize columns — the single biggest performance fix ───────────
    // Previously getDynamicColumns() was called inline in JSX on every render.
    // It creates 100+ column definitions including JSX nodes, render functions,
    // and onClick handlers — forcing Ant Design Table to fully diff and re-render
    // every time ANY state changed (e.g., typing in modal input fields).
    // Now it only recomputes when expandedMonths, expandedWeeks, or selectedPlanType change.
    const columns = useMemo(() => {
        const baseCols = [
            {
                title: 'Brand Name', key: 'sellerId', dataIndex: 'SellerId',
                render: (text) => (
                    <Space>
                        <Target size={16} style={{ color: '#4f46e5' }} />
                        <Text strong style={{ color: '#0f172a', fontSize: 13 }}>{text}</Text>
                    </Space>
                ),
                width: 160, fixed: 'left'
            },
            {
                title: 'Manager', key: 'brandManager', dataIndex: 'BrandManager',
                render: (text) => (
                    <Tag color="blue" style={{ borderRadius: 6, fontWeight: 600, fontSize: 11 }}>{text || 'Unassigned'}</Tag>
                ),
                width: 120, fixed: 'left'
            },
            {
                title: 'Type', key: 'targetType', dataIndex: 'TargetType',
                render: (text) => (
                    <Tag color={text === 'YEARLY' ? 'purple' : 'success'} style={{ borderRadius: 6, fontSize: 11 }}>
                        {text === 'YEARLY' ? 'Yearly' : 'Monthly'}
                    </Tag>
                ),
                width: 90
            },
            {
                title: 'Target (₹)', key: 'gmsTarget', dataIndex: 'TotalTargetValue',
                render: (val) => (
                    <Text strong style={{ color: '#4f46e5', fontSize: 12 }}>₹{Math.round(val || 0).toLocaleString('en-IN')}</Text>
                ),
                width: 110
            },
            {
                title: 'Achieved (₹)', key: 'gmsAchieved', dataIndex: 'overallAchieved',
                render: (val) => (
                    <Text style={{ color: '#10b981', fontWeight: 600, fontSize: 12 }}>₹{Math.round(val || 0).toLocaleString('en-IN')}</Text>
                ),
                width: 110
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
                            if (!mRecord) return <Text type="secondary" style={{ fontSize: 11 }}>-</Text>;
                            return (
                                <div style={{ padding: '4px 8px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                                    <div style={{ fontSize: 10, color: '#64748b', textAlign: 'left' }}>T: <span style={{ fontWeight: 650, color: '#0f172a' }}>₹{Math.round(mRecord.TargetValue || 0).toLocaleString('en-IN')}</span></div>
                                    <div style={{ fontSize: 10, color: '#64748b', textAlign: 'left' }}>A: <span style={{ fontWeight: 650, color: mRecord.AchievedValue >= mRecord.TargetValue ? '#10b981' : '#f59e0b' }}>₹{Math.round(mRecord.AchievedValue || 0).toLocaleString('en-IN')}</span></div>
                                </div>
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
                            if (!mRecord) return <Text type="secondary" style={{ fontSize: 11 }}>-</Text>;
                            return (
                                <div style={{ padding: '4px 8px', background: '#e0e7ff', borderRadius: 6, border: '1px solid #c7d2fe' }}>
                                    <div style={{ fontSize: 10, color: '#4f46e5', textAlign: 'left', fontWeight: 600 }}>T: <span>₹{Math.round(mRecord.TargetValue || 0).toLocaleString('en-IN')}</span></div>
                                    <div style={{ fontSize: 10, color: '#4f46e5', textAlign: 'left', fontWeight: 600 }}>A: <span>₹{Math.round(mRecord.AchievedValue || 0).toLocaleString('en-IN')}</span></div>
                                </div>
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
                                    if (!wRecord && autoTarget === 0) return <Text type="secondary" style={{ fontSize: 11 }}>-</Text>;
                                    return (
                                        <div style={{ padding: '3px 6px', background: '#fffbeb', borderRadius: 6, border: '1px solid #fef3c7' }}>
                                            <div style={{ fontSize: 9, color: '#b45309', textAlign: 'left' }}>T: <span style={{ fontWeight: 600, color: '#0f172a' }}>₹{displayTarget.toLocaleString('en-IN')}</span></div>
                                            <div style={{ fontSize: 9, color: '#b45309', textAlign: 'left' }}>A: <span style={{ fontWeight: 600, color: displayAchieved >= displayTarget ? '#10b981' : '#f59e0b' }}>₹{displayAchieved.toLocaleString('en-IN')}</span></div>
                                        </div>
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
                                    if (!wRecord) return <Text type="secondary" style={{ fontSize: 11 }}>-</Text>;
                                    return (
                                        <div style={{ padding: '3px 6px', background: '#fef3c7', borderRadius: 6, border: '1px solid #fcd34d' }}>
                                            <div style={{ fontSize: 9, color: '#b45309', textAlign: 'left', fontWeight: 600 }}>T: <span>₹{Math.round(wRecord.TargetValue || 0).toLocaleString('en-IN')}</span></div>
                                            <div style={{ fontSize: 9, color: '#b45309', textAlign: 'left', fontWeight: 600 }}>A: <span>₹{Math.round(wRecord.AchievedValue || 0).toLocaleString('en-IN')}</span></div>
                                        </div>
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
                                        if (!dRecord && autoTarget === 0) return <span style={{ color: '#cbd5e1', fontSize: 10 }}>-</span>;
                                        return (
                                            <div style={{ padding: '2px 4px', background: dRecord ? '#f8fafc' : '#fefce8', borderRadius: 4, border: `1px solid ${dRecord ? '#e2e8f0' : '#fef08a'}` }}>
                                                <div style={{ fontSize: 8, color: '#64748b', textAlign: 'left' }}>T: <span style={{ fontWeight: 600, color: '#0f172a' }}>₹{displayTarget.toLocaleString('en-IN')}</span></div>
                                                <div style={{ fontSize: 8, color: '#64748b', textAlign: 'left' }}>A: <span style={{ fontWeight: 600, color: displayAchieved >= displayTarget ? '#10b981' : '#f59e0b' }}>₹{displayAchieved.toLocaleString('en-IN')}</span></div>
                                            </div>
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
                            if (!wRecord && autoTarget === 0) return <Text type="secondary" style={{ fontSize: 11 }}>-</Text>;
                            return (
                                <div style={{ padding: '4px 8px', background: '#fffbeb', borderRadius: 6, border: '1px solid #fef3c7' }}>
                                    <div style={{ fontSize: 10, color: '#b45309', textAlign: 'left' }}>T: <span style={{ fontWeight: 650, color: '#0f172a' }}>₹{displayTarget.toLocaleString('en-IN')}</span></div>
                                    <div style={{ fontSize: 10, color: '#b45309', textAlign: 'left' }}>A: <span style={{ fontWeight: 650, color: displayAchieved >= displayTarget ? '#10b981' : '#f59e0b' }}>₹{displayAchieved.toLocaleString('en-IN')}</span></div>
                                </div>
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
                            if (!wRecord) return <Text type="secondary" style={{ fontSize: 11 }}>-</Text>;
                            return (
                                <div style={{ padding: '4px 8px', background: '#fef3c7', borderRadius: 6, border: '1px solid #fcd34d' }}>
                                    <div style={{ fontSize: 10, color: '#b45309', textAlign: 'left', fontWeight: 600 }}>T: <span>₹{Math.round(wRecord.TargetValue || 0).toLocaleString('en-IN')}</span></div>
                                    <div style={{ fontSize: 10, color: '#b45309', textAlign: 'left', fontWeight: 600 }}>A: <span>₹{Math.round(wRecord.AchievedValue || 0).toLocaleString('en-IN')}</span></div>
                                </div>
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
                                if (!dRecord && autoTarget === 0) return <span style={{ color: '#cbd5e1', fontSize: 10 }}>-</span>;
                                return (
                                    <div style={{ padding: '2px 4px', background: dRecord ? '#f8fafc' : '#fefce8', borderRadius: 4, border: `1px solid ${dRecord ? '#e2e8f0' : '#fef08a'}` }}>
                                        <div style={{ fontSize: 8, color: '#64748b', textAlign: 'left' }}>T: <span style={{ fontWeight: 600, color: '#0f172a' }}>₹{displayTarget.toLocaleString('en-IN')}</span></div>
                                        <div style={{ fontSize: 8, color: '#64748b', textAlign: 'left' }}>A: <span style={{ fontWeight: 600, color: displayAchieved >= displayTarget ? '#10b981' : '#f59e0b' }}>₹{displayAchieved.toLocaleString('en-IN')}</span></div>
                                    </div>
                                );
                            }
                        });
                    }
                }
            }
        }

        const endCols = [
            {
                title: 'Progress', key: 'progress',
                render: (_, record) => {
                    const pct = record.TotalTargetValue > 0
                        ? Math.round((record.overallAchieved / record.TotalTargetValue) * 100)
                        : 0;
                    return (
                        <div style={{ width: 140, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Progress
                                percent={Math.min(pct, 100)}
                                strokeColor={pct >= 100 ? '#10b981' : pct >= 75 ? '#3b82f6' : '#f59e0b'}
                                size={[70, 6]} showInfo={false}
                            />
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', minWidth: 30 }}>{pct}%</span>
                        </div>
                    );
                },
                width: 150
            },
            {
                title: 'Achieved or Not', key: 'status',
                render: (_, record) => {
                    const target = record.TotalTargetValue;
                    const achieved = record.overallAchieved;
                    if (!target || target <= 0) return <Tag color="default">N/A</Tag>;
                    const pct = (achieved / target) * 100;
                    if (pct >= 100) return <Tag color="success" style={{ fontWeight: 700, borderRadius: 6 }}>🚀 Over Achieved</Tag>;
                    if (pct >= 80)  return <Tag color="processing" style={{ fontWeight: 700, borderRadius: 6 }}>🎯 Achieved</Tag>;
                    if (pct >= 50)  return <Tag color="warning" style={{ fontWeight: 700, borderRadius: 6 }}>On Track</Tag>;
                    return <Tag color="error" style={{ fontWeight: 700, borderRadius: 6 }}>⚠️ Under Target</Tag>;
                },
                width: 140
            },
            {
                title: 'Actions', key: 'actions', width: 150, align: 'right',
                render: (_, record) => (
                    <Space size={8}>
                        <Button type="primary" shape="round" size="small" icon={<Edit3 size={12} />}
                            onClick={() => handleStartEdit(record)}
                            style={{ background: '#4f46e5', borderColor: '#4f46e5' }}
                        >
                            Edit
                        </Button>
                        <Popconfirm
                            title="Delete target record?"
                            description="This will permanently delete this target and all its breakdowns."
                            onConfirm={() => handleDeleteSingle(record.Id)}
                            okText="Yes, Delete" cancelText="No" okButtonProps={{ danger: true }}
                        >
                            <Button danger shape="circle" size="small" icon={<Trash2 size={12} />} />
                        </Popconfirm>
                    </Space>
                ),
                fixed: 'right'
            }
        ];

        return [...baseCols, ...periodCols, ...endCols];
    // ── Only recompute when visual structure changes — not on modal input changes
    }, [expandedMonths, expandedWeeks, selectedPlanType, handleStartEdit, handleDeleteSingle]);

    // ── FIX 5: Memoize Table props that are objects ───────────────────────────
    // Ant Design Table does a shallow comparison on rowSelection and pagination.
    // New object literals every render bypass this check and force full re-renders.
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

    // ── FIX 6a: Memoize tab items for Add Modal ───────────────────────────────
    const addModalTabItems = useMemo(() =>
        configuredBrands.map((brand) => ({
            key: brand.key,
            closable: configuredBrands.length > 1,
            label: (
                <span style={{ fontWeight: 650 }}>
                    {brand.sellerId || `Config ${parseInt(brand.key) + 1}`}
                    {brand.saved
                        ? <Tag color="success" style={{ marginLeft: 6, borderRadius: 4 }}>Saved</Tag>
                        : <Tag color="warning" style={{ marginLeft: 6, borderRadius: 4 }}>Draft</Tag>
                    }
                </span>
            ),
            // BrandConfigTab is memoized — only re-renders when its own brand prop changes
            children: (
                <BrandConfigTab
                    brand={brand}
                    sellers={sellers}
                    onUpdate={updateActiveBrand}
                    onDistributionChange={handleDistributionChange}
                    onDistributeUniformly={distributeUniformly}
                    onSave={handleSaveBrandConfig}
                />
            )
        })),
    [configuredBrands, sellers, updateActiveBrand, handleDistributionChange, distributeUniformly, handleSaveBrandConfig]
    );

    // ── FIX 6b: Memoize tab items for Edit Modal ──────────────────────────────
    const editModalTabItems = useMemo(() =>
        editingBrands.map((brand) => ({
            key: brand.key,
            label: (
                <span style={{ fontWeight: 650 }}>
                    {brand.sellerId} ({brand.targetType === 'YEARLY' ? 'Yearly' : 'Monthly'})
                </span>
            ),
            // EditBrandTab is memoized — only re-renders when its own brand prop changes
            children: (
                <EditBrandTab
                    brand={brand}
                    onBreakdownChange={handleEditBreakdownChange}
                    onTotalTargetChange={handleEditTotalTargetChange}
                />
            )
        })),
    [editingBrands, handleEditBreakdownChange, handleEditTotalTargetChange]
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* 1. Page Header */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12,
                padding: '16px 24px', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
            }}>
                <Space size={16}>
                    <div style={{ background: '#e0e7ff', color: '#4f46e5', padding: 12, borderRadius: 10, display: 'flex' }}>
                        <Target size={24} />
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontWeight: 800, color: '#0f172a', fontSize: 20 }}>Target v/s Achievements</h2>
                        <Text type="secondary">Map goals, distribute values to months/weeks/days, and trace sales pacing.</Text>
                    </div>
                </Space>
                <Space size={12}>
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
                        style={{ background: '#f1f5f9', padding: 3, borderRadius: 8, fontWeight: 600 }}
                    />
                    {hasExpandedColumns && (
                        <Button shape="round" icon={<Minimize2 size={14} />} onClick={handleCollapseAll}
                            style={{ fontWeight: 600, height: 36, borderColor: '#cbd5e1', color: '#64748b' }}
                        >
                            Collapse All
                        </Button>
                    )}
                    <Button type="primary" shape="round" icon={<Plus size={16} />} onClick={handleOpenModal}
                        style={{ background: '#4f46e5', borderColor: '#4f46e5', fontWeight: 650, height: 40 }}
                    >
                        Add Targets
                    </Button>
                </Space>
            </div>

            {/* Bulk Selection Bar */}
            {selectedRowKeys.length > 0 && (
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 12,
                    padding: '12px 24px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
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

            {/* 2. Main Table */}
            <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }} styles={{ body: { padding: 0 } }}>
                <Table
                    dataSource={filteredTargets}
                    columns={columns}              // ← now memoized ✅
                    rowKey="Id"
                    loading={loading}
                    rowSelection={rowSelection}    // ← now memoized ✅
                    pagination={pagination}        // ← now memoized ✅
                    scroll={{ x: 1200, y: 520 }}
                    virtual
                    size="small"
                />
            </Card>

            {/* 3. Add Targets Modal */}
            <Modal
                title={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Target size={20} style={{ color: '#4f46e5' }} /><span style={{ fontWeight: 800 }}>Establish Targets & Allocations</span></div>}
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                width={850}
                footer={[
                    <Button key="cancel" onClick={() => setModalVisible(false)}>Cancel</Button>,
                    <Button key="save-all" onClick={handleSaveAllBrands} type="dashed">Save All Configs</Button>,
                    <Button key="submit" type="primary" onClick={handleSubmitTargets} style={{ background: '#4f46e5', borderColor: '#4f46e5' }}>Publish Targets</Button>
                ]}
            >
                <Tabs
                    activeKey={activeTabKey}
                    onChange={setActiveTabKey}
                    type="editable-card"
                    onEdit={(_, action) => { if (action === 'add') handleAddBrandTab(); }}
                    items={addModalTabItems}  // ← now memoized ✅
                />
            </Modal>

            {/* 4. Edit Targets Modal */}
            <Modal
                title={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Edit3 size={20} style={{ color: '#4f46e5' }} /><span style={{ fontWeight: 800 }}>Adjust Configured Target Metrics</span></div>}
                open={editModalVisible}
                onCancel={() => setEditModalVisible(false)}
                width={850}
                footer={[
                    <Button key="back" onClick={() => setEditModalVisible(false)}>Cancel</Button>,
                    <Button key="submit" type="primary" loading={loading} onClick={handleSubmitEditPayload} style={{ background: '#4f46e5', borderColor: '#4f46e5' }}>Commit Changes</Button>
                ]}
            >
                <Tabs
                    activeKey={activeEditTabKey}
                    onChange={setActiveEditTabKey}
                    type="card"
                    items={editModalTabItems}  // ← now memoized ✅
                />
            </Modal>

            {notificationContextHolder}
        </div>
    );
};

export default TargetVsAchievement;
