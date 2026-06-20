import React, { useState, useEffect, useMemo, Suspense, lazy, useCallback } from 'react';
import {
    PlayCircle,
    RefreshCw,
    Loader2,
    Search,
    ChevronDown,
    List,
    Sliders,
    Activity,
    Database,
    Clock,
    TrendingUp,
    ArrowUpRight,
    ArrowDownRight,
    Zap,
    Server,
    Shield,
    Eye,
    BarChart3,
    CircleDot,
    Timer,
    Layers,
    GitBranch,
    Terminal,
    ExternalLink,
    Filter,
    CheckCircle2
} from 'lucide-react';
import {
    Card,
    Row,
    Col,
    Button,
    Space,
    Table,
    Input,
    Tag,
    Progress,
    Typography,
    Dropdown,
    Modal,
    Alert,
    Tooltip,
    Drawer,
    Timeline,
    Tabs,
    Switch,
    Badge,
    Segmented,
    Divider,
    Empty,
    Flex
} from 'antd';
import { scheduledRunsApi, settingsApi } from '../services/api';
import { formatDistanceToNow, format, differenceInMinutes, differenceInSeconds } from 'date-fns';
import { SkeletonChart } from '../components/common/Skeleton';

const Chart = lazy(() => import('react-apexcharts'));
const { Title, Text } = Typography;

// ─── Design Tokens ───────────────────────────────────────────────
const tokens = {
    bg: '#f8fafc',
    surface: '#ffffff',
    surfaceElevated: '#fafbfc',
    border: '#e8ecf1',
    borderLight: '#f1f5f9',
    text: {
        primary: '#0f172a',
        secondary: '#475569',
        tertiary: '#94a3b8',
        inverse: '#ffffff'
    },
    brand: {
        primary: '#1e40af',
        primaryLight: '#dbeafe',
        accent: '#0ea5e9'
    },
    semantic: {
        success: '#059669',
        successLight: '#d1fae5',
        warning: '#d97706',
        warningLight: '#fef3c7',
        error: '#dc2626',
        errorLight: '#fee2e2',
        info: '#2563eb',
        infoLight: '#dbeafe'
    },
    radius: { sm: '6px', md: '10px', lg: '14px' },
    shadow: {
        sm: '0 1px 2px rgba(0,0,0,0.04)',
        md: '0 2px 8px rgba(0,0,0,0.06)',
        lg: '0 4px 16px rgba(0,0,0,0.08)'
    }
};

const cardBase = {
    borderRadius: tokens.radius.lg,
    border: `1px solid ${tokens.border}`,
    background: tokens.surface,
    boxShadow: tokens.shadow.sm,
    overflow: 'hidden'
};

// ─── Micro Components ────────────────────────────────────────────
const MetricCard = ({ label, value, suffix, icon: Icon, trend, trendLabel, color, loading }) => (
    <Card style={cardBase} styles={{ body: { padding: '20px 22px' } }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: tokens.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                    {label}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <span style={{ fontSize: '30px', fontWeight: 800, color: color || tokens.text.primary, lineHeight: 1, letterSpacing: '-0.03em' }}>
                        {loading ? '—' : value}
                    </span>
                    {suffix && <span style={{ fontSize: '13px', fontWeight: 600, color: tokens.text.tertiary }}>{suffix}</span>}
                </div>
                {trend !== undefined && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px' }}>
                        {trend >= 0 ?
                            <ArrowUpRight size={13} style={{ color: tokens.semantic.success }} /> :
                            <ArrowDownRight size={13} style={{ color: tokens.semantic.error }} />
                        }
                        <span style={{ fontSize: '12px', fontWeight: 600, color: trend >= 0 ? tokens.semantic.success : tokens.semantic.error }}>
                            {Math.abs(trend)}%
                        </span>
                        {trendLabel && <span style={{ fontSize: '11px', color: tokens.text.tertiary, marginLeft: '2px' }}>{trendLabel}</span>}
                    </div>
                )}
            </div>
            {Icon && (
                <div style={{
                    width: '42px', height: '42px', borderRadius: tokens.radius.md,
                    background: color ? `${color}12` : tokens.brand.primaryLight,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                    <Icon size={20} style={{ color: color || tokens.brand.primary }} />
                </div>
            )}
        </div>
    </Card>
);

const StatusDot = ({ status }) => {
    const colors = { RUNNING: '#f59e0b', COMPLETED: '#059669', FAILED: '#dc2626' };
    const isRunning = status === 'RUNNING';
    return (
        <span style={{
            display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
            backgroundColor: colors[status] || '#94a3b8',
            boxShadow: isRunning ? `0 0 0 3px ${colors.RUNNING}30` : 'none',
            animation: isRunning ? 'pulse-dot 1.5s ease-in-out infinite' : 'none'
        }} />
    );
};

const SectionHeader = ({ title, subtitle, actions }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: tokens.text.primary, letterSpacing: '-0.01em' }}>{title}</div>
            {subtitle && <div style={{ fontSize: '12px', color: tokens.text.tertiary, marginTop: '2px' }}>{subtitle}</div>}
        </div>
        {actions && <Space size="small">{actions}</Space>}
    </div>
);

// ─── Main Component ──────────────────────────────────────────────
const ScheduledRunsPage = () => {
    const [runs, setRuns] = useState([]);
    const [metrics, setMetrics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [triggering, setTriggering] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [message, setMessage] = useState(null);
    const [activeTab, setActiveTab] = useState('overview');
    const [scheduleConfig, setScheduleConfig] = useState({
        scheduleTime: '00:01', ajioScheduleTime: '12:00', automationEnabled: false
    });
    const [logsDrawerVisible, setLogsDrawerVisible] = useState(false);
    const [selectedSeller, setSelectedSeller] = useState(null);
    const [sellerLogs, setSellerLogs] = useState([]);
    const [logsLoading, setLogsLoading] = useState(false);

    const fetchData = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const [runsRes, metricsRes, configRes] = await Promise.all([
                scheduledRunsApi.getAll().catch(() => ({ success: false, data: [] })),
                scheduledRunsApi.getSellerMetrics().catch(() => ({ success: false, data: [] })),
                settingsApi.getScheduleConfig().catch(() => ({
                    success: false,
                    data: { scheduleTime: '00:01', ajioScheduleTime: '12:00', automationEnabled: false }
                }))
            ]);
            if (runsRes.success) setRuns(runsRes.data || []);
            if (metricsRes.success) setMetrics(metricsRes.data || []);
            if (configRes.success) setScheduleConfig(configRes.data);
        } catch (err) {
            setMessage({ type: 'error', text: err.message || 'Telemetry sync failed' });
        } finally {
            if (!silent) setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleViewLogs = async (seller) => {
        setSelectedSeller(seller);
        setLogsDrawerVisible(true);
        setLogsLoading(true);
        try {
            const res = await scheduledRunsApi.getSellerLogs(seller.sellerId);
            if (res.success) setSellerLogs(res.data || []);
        } catch { /* handled */ } finally { setLogsLoading(false); }
    };

    const handleManualTrigger = async (marketplace = 'amazon') => {
        setTriggering(true);
        setMessage(null);
        try {
            const res = await scheduledRunsApi.trigger(marketplace);
            if (res.success) {
                setMessage({ type: 'success', text: `${marketplace.toUpperCase()} pipeline triggered. Execution in progress.` });
                setTimeout(() => fetchData(true), 3000);
            }
        } catch (err) {
            setMessage({ type: 'error', text: err.message || `${marketplace.toUpperCase()} trigger failed` });
        } finally { setTriggering(false); }
    };

    // ─── Computed Stats ──────────────────────────────────────────
    const stats = useMemo(() => {
        let totalActive = 0, totalCompleted = 0, totalFailed = 0, inserted = 0, expected = 0;
        metrics.forEach(m => {
            inserted += m.totalInserted || 0;
            expected += m.totalExpected || 0;
            totalActive += m.runningRuns;
            totalCompleted += m.completedRuns;
            totalFailed += m.failedRuns;
        });
        const totalRuns = totalActive + totalCompleted + totalFailed;
        const successRate = totalRuns > 0 ? Math.round((totalCompleted / totalRuns) * 100) : 100;
        const yieldRate = expected > 0 ? Math.min(Math.round((inserted / expected) * 100), 100) : 0;

        // Avg duration from completed runs
        const completedRuns = runs.filter(r => r.Status === 'COMPLETED' && r.StartTime && r.EndTime);
        const avgDuration = completedRuns.length > 0
            ? Math.round(completedRuns.reduce((sum, r) => sum + differenceInMinutes(new Date(r.EndTime), new Date(r.StartTime)), 0) / completedRuns.length)
            : 0;

        return { totalActive, totalCompleted, totalFailed, inserted, expected, totalRuns, successRate, yieldRate, avgDuration, sellerCount: metrics.length };
    }, [metrics, runs]);

    // ─── Chart Data ──────────────────────────────────────────────
    const ingestionChart = useMemo(() => {
        const recent = [...runs].slice(0, 20).reverse();
        return {
            categories: recent.map(r => r.StartTime ? format(new Date(r.StartTime), 'dd MMM HH:mm') : '—'),
            inserted: recent.map(r => r.totalInserted || 0),
            expected: recent.map(r => r.totalExpected || 0),
            durations: recent.map(r => {
                if (r.StartTime && r.EndTime) return Math.round(differenceInSeconds(new Date(r.EndTime), new Date(r.StartTime)) / 60);
                return 0;
            })
        };
    }, [runs]);

    const ingestionChartOptions = {
        chart: { fontFamily: 'Inter, system-ui, sans-serif', toolbar: { show: false }, zoom: { enabled: false }, background: 'transparent' },
        stroke: { width: [0, 2.5, 2.5], curve: 'smooth', dashArray: [0, 0, 4] },
        plotOptions: { bar: { columnWidth: '45%', borderRadius: 4 } },
        colors: [tokens.brand.primary, tokens.semantic.success, tokens.semantic.warning],
        fill: { opacity: [0.9, 1, 1] },
        dataLabels: { enabled: false },
        labels: ingestionChart.categories,
        xaxis: { labels: { style: { colors: tokens.text.tertiary, fontSize: '10px' }, rotate: -45, rotateAlways: ingestionChart.categories.length > 10 } },
        yaxis: [
            { title: { text: 'Records', style: { color: tokens.text.tertiary, fontSize: '11px', fontWeight: 600 } }, labels: { style: { colors: tokens.text.tertiary, fontSize: '10px' }, formatter: (v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v } },
            { opposite: true, title: { text: 'Duration (min)', style: { color: tokens.text.tertiary, fontSize: '11px', fontWeight: 600 } }, labels: { style: { colors: tokens.text.tertiary, fontSize: '10px' } } }
        ],
        grid: { borderColor: tokens.borderLight, strokeDashArray: 3 },
        tooltip: { shared: true, intersect: false, theme: 'light', style: { fontSize: '12px' } },
        legend: { position: 'top', horizontalAlign: 'right', fontSize: '12px', fontWeight: 600, markers: { radius: 3 } }
    };

    const ingestionChartSeries = [
        { name: 'Ingested', type: 'column', data: ingestionChart.inserted },
        { name: 'Expected', type: 'line', data: ingestionChart.expected },
        { name: 'Duration', type: 'line', data: ingestionChart.durations }
    ];

    const statusDonut = useMemo(() => {
        const c = runs.filter(r => r.Status === 'COMPLETED').length;
        const f = runs.filter(r => r.Status === 'FAILED').length;
        const r = runs.filter(r => r.Status === 'RUNNING').length;
        return [c, f, r];
    }, [runs]);

    const donutOptions = {
        chart: { type: 'donut', fontFamily: 'Inter, system-ui, sans-serif' },
        labels: ['Completed', 'Failed', 'Running'],
        colors: [tokens.semantic.success, tokens.semantic.error, tokens.semantic.warning],
        legend: { position: 'bottom', fontSize: '12px', fontWeight: 600 },
        dataLabels: { enabled: false },
        plotOptions: {
            pie: {
                donut: {
                    size: '74%',
                    labels: {
                        show: true,
                        name: { fontSize: '12px', color: tokens.text.secondary },
                        value: { fontSize: '22px', fontWeight: 700, color: tokens.text.primary },
                        total: { show: true, label: 'Total', fontSize: '11px', fontWeight: 600, color: tokens.text.tertiary, formatter: () => runs.length }
                    }
                }
            }
        },
        stroke: { width: 2, colors: [tokens.surface] }
    };

    // Seller success distribution (mini heatmap-like bar chart)
    const sellerHealthChart = useMemo(() => {
        const sorted = [...metrics].sort((a, b) => {
            const rA = (a.completedRuns + a.failedRuns) > 0 ? a.completedRuns / (a.completedRuns + a.failedRuns) : 1;
            const rB = (b.completedRuns + b.failedRuns) > 0 ? b.completedRuns / (b.completedRuns + b.failedRuns) : 1;
            return rA - rB;
        }).slice(0, 12);
        return {
            categories: sorted.map(m => (m.name || '').substring(0, 15)),
            completed: sorted.map(m => m.completedRuns || 0),
            failed: sorted.map(m => m.failedRuns || 0)
        };
    }, [metrics]);

    const sellerHealthOptions = {
        chart: { type: 'bar', stacked: true, fontFamily: 'Inter, system-ui, sans-serif', toolbar: { show: false } },
        plotOptions: { bar: { horizontal: true, barHeight: '60%', borderRadius: 3 } },
        colors: [tokens.semantic.success, tokens.semantic.error],
        dataLabels: { enabled: false },
        xaxis: { categories: sellerHealthChart.categories, labels: { style: { fontSize: '10px', colors: tokens.text.tertiary } } },
        yaxis: { labels: { style: { fontSize: '10px', colors: tokens.text.secondary, fontWeight: 500 } } },
        grid: { borderColor: tokens.borderLight, strokeDashArray: 3 },
        legend: { position: 'top', horizontalAlign: 'right', fontSize: '11px', fontWeight: 600 }
    };

    const sellerHealthSeries = [
        { name: 'Completed', data: sellerHealthChart.completed },
        { name: 'Failed', data: sellerHealthChart.failed }
    ];

    // ─── Filter ──────────────────────────────────────────────────
    const filteredMetrics = metrics.filter(m => {
        if (!searchTerm) return true;
        return (m.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    });

    // ─── Table Columns ───────────────────────────────────────────
    const runColumns = [
        {
            title: 'RUN',
            dataIndex: 'Id',
            key: 'Id',
            width: 130,
            render: (id) => (
                <div>
                    <Text code style={{ fontSize: '11px', background: tokens.surfaceElevated, border: `1px solid ${tokens.borderLight}`, borderRadius: '4px', padding: '1px 6px' }}>
                        {id?.substring(0, 10)}
                    </Text>
                </div>
            )
        },
        {
            title: 'STARTED',
            dataIndex: 'StartTime',
            key: 'StartTime',
            width: 170,
            render: (t) => t ? (
                <div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: tokens.text.primary }}>{format(new Date(t), 'dd MMM yyyy')}</div>
                    <div style={{ fontSize: '11px', color: tokens.text.tertiary }}>{format(new Date(t), 'HH:mm:ss')}</div>
                </div>
            ) : <Text type="secondary">—</Text>,
            sorter: (a, b) => new Date(a.StartTime || 0) - new Date(b.StartTime || 0),
            defaultSortOrder: 'descend'
        },
        {
            title: 'DURATION',
            key: 'duration',
            width: 110,
            render: (_, r) => {
                if (!r.StartTime) return '—';
                const end = r.EndTime ? new Date(r.EndTime) : new Date();
                const secs = Math.floor((end - new Date(r.StartTime)) / 1000);
                const isRunning = r.Status === 'RUNNING';
                return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Timer size={12} style={{ color: isRunning ? tokens.semantic.warning : tokens.text.tertiary }} />
                        <Text style={{ fontSize: '13px', fontWeight: 500, color: isRunning ? tokens.semantic.warning : tokens.text.primary }}>
                            {secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m ${secs % 60}s`}
                        </Text>
                    </div>
                );
            }
        },
        {
            title: 'RECORDS',
            key: 'records',
            width: 200,
            render: (_, r) => {
                const pct = r.totalExpected > 0 ? Math.min(Math.round((r.totalInserted / r.totalExpected) * 100), 100) : 0;
                return (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                            <Text style={{ fontSize: '12px', fontWeight: 600, color: tokens.semantic.success }}>{(r.totalInserted || 0).toLocaleString()}</Text>
                            <Text style={{ fontSize: '11px', color: tokens.text.tertiary }}>/ {(r.totalExpected || 0).toLocaleString()}</Text>
                        </div>
                        <Progress percent={pct} size="small" showInfo={false} strokeColor={pct === 100 ? tokens.semantic.success : tokens.brand.primary} trailColor={tokens.borderLight} />
                    </div>
                );
            }
        },
        {
            title: 'STATUS',
            dataIndex: 'Status',
            key: 'Status',
            width: 130,
            render: (status) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <StatusDot status={status} />
                    <Tag
                        style={{
                            margin: 0, fontWeight: 600, fontSize: '11px', borderRadius: '6px', border: 'none',
                            background: status === 'COMPLETED' ? tokens.semantic.successLight : status === 'FAILED' ? tokens.semantic.errorLight : tokens.semantic.warningLight,
                            color: status === 'COMPLETED' ? tokens.semantic.success : status === 'FAILED' ? tokens.semantic.error : tokens.semantic.warning
                        }}
                    >
                        {status}
                    </Tag>
                </div>
            ),
            filters: [
                { text: 'Completed', value: 'COMPLETED' },
                { text: 'Failed', value: 'FAILED' },
                { text: 'Running', value: 'RUNNING' }
            ],
            onFilter: (value, record) => record.Status === value
        }
    ];

    const sellerColumns = [
        {
            title: 'SELLER',
            dataIndex: 'name',
            key: 'name',
            render: (text) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        width: 32, height: 32, borderRadius: tokens.radius.sm,
                        background: `linear-gradient(135deg, ${tokens.brand.primaryLight}, ${tokens.brand.primary}20)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '12px', fontWeight: 700, color: tokens.brand.primary
                    }}>
                        {(text || '?')[0].toUpperCase()}
                    </div>
                    <Text strong style={{ fontSize: '13px', color: tokens.text.primary }}>{text}</Text>
                </div>
            ),
            sorter: (a, b) => (a.name || '').localeCompare(b.name || '')
        },
        {
            title: 'RUNS',
            key: 'runs',
            width: 100,
            align: 'center',
            render: (_, r) => (
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: tokens.text.primary }}>{r.totalRuns || 0}</div>
                    <div style={{ fontSize: '10px', color: tokens.text.tertiary }}>{r.completedRuns}✓ {r.failedRuns}✗</div>
                </div>
            ),
            sorter: (a, b) => (a.totalRuns || 0) - (b.totalRuns || 0)
        },
        {
            title: 'INGESTION',
            key: 'ingestion',
            width: 220,
            render: (_, r) => {
                const pct = r.totalExpected > 0 ? Math.min(Math.round((r.totalInserted / r.totalExpected) * 100), 100) : 0;
                return (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <Text style={{ fontSize: '12px', fontWeight: 600, color: tokens.text.primary }}>{(r.totalInserted || 0).toLocaleString()}</Text>
                            <Text style={{ fontSize: '11px', color: tokens.text.tertiary }}>{pct}%</Text>
                        </div>
                        <Progress percent={pct} size="small" showInfo={false}
                            strokeColor={{ '0%': tokens.brand.primary, '100%': tokens.semantic.success }}
                            trailColor={tokens.borderLight}
                        />
                        <div style={{ fontSize: '10px', color: tokens.text.tertiary, marginTop: '2px' }}>
                            of {(r.totalExpected || 0).toLocaleString()} expected
                        </div>
                    </div>
                );
            },
            sorter: (a, b) => (a.totalInserted || 0) - (b.totalInserted || 0)
        },
        {
            title: 'HEALTH',
            key: 'health',
            width: 80,
            align: 'center',
            render: (_, r) => {
                const total = r.completedRuns + r.failedRuns;
                const rate = total > 0 ? Math.round((r.completedRuns / total) * 100) : 100;
                const color = rate >= 90 ? tokens.semantic.success : rate >= 70 ? tokens.semantic.warning : tokens.semantic.error;
                return (
                    <Tooltip title={`${rate}% success rate`}>
                        <Progress type="circle" size={38} percent={rate} strokeWidth={8}
                            strokeColor={color}
                            format={() => <span style={{ fontSize: '10px', fontWeight: 700, color }}>{rate}%</span>}
                        />
                    </Tooltip>
                );
            }
        },
        {
            title: 'LAST RUN',
            key: 'lastRun',
            width: 160,
            render: (_, r) => {
                if (!r.lastRunDate) return <Text type="secondary" style={{ fontSize: '12px' }}>No runs</Text>;
                return (
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                            <StatusDot status={r.lastRunStatus} />
                            <Tag style={{
                                margin: 0, fontWeight: 600, fontSize: '10px', borderRadius: '4px', border: 'none', padding: '0 6px', lineHeight: '18px',
                                background: r.lastRunStatus === 'COMPLETED' ? tokens.semantic.successLight : r.lastRunStatus === 'FAILED' ? tokens.semantic.errorLight : tokens.semantic.warningLight,
                                color: r.lastRunStatus === 'COMPLETED' ? tokens.semantic.success : r.lastRunStatus === 'FAILED' ? tokens.semantic.error : tokens.semantic.warning
                            }}>
                                {r.lastRunStatus}
                            </Tag>
                        </div>
                        <Text style={{ fontSize: '11px', color: tokens.text.tertiary }}>
                            {formatDistanceToNow(new Date(r.lastRunDate), { addSuffix: true })}
                        </Text>
                    </div>
                );
            },
            sorter: (a, b) => new Date(a.lastRunDate || 0) - new Date(b.lastRunDate || 0)
        },
        {
            title: '',
            key: 'actions',
            width: 100,
            align: 'center',
            render: (_, r) => (
                <Button type="text" size="small" onClick={() => handleViewLogs(r)}
                    style={{ fontSize: '12px', fontWeight: 600, color: tokens.brand.primary, borderRadius: tokens.radius.sm }}
                    icon={<Eye size={13} />}
                >
                    Logs
                </Button>
            )
        }
    ];

    // ─── Pipeline trigger items ──────────────────────────────────
    const triggerItems = [
        {
            key: 'amazon',
            label: (
                <div style={{ padding: '4px 0' }}>
                    <div style={{ fontWeight: 600, fontSize: '13px' }}>Amazon Pipeline</div>
                    <div style={{ fontSize: '11px', color: tokens.text.tertiary }}>Scrape + clean all Amazon sellers</div>
                </div>
            ),
            onClick: () => Modal.confirm({
                title: 'Trigger Amazon Pipeline',
                content: 'This will start a synchronous scraping and data processing pipeline for all Amazon seller accounts.',
                okText: 'Execute',
                okButtonProps: { style: { background: tokens.brand.primary, borderColor: tokens.brand.primary, borderRadius: tokens.radius.sm } },
                cancelButtonProps: { style: { borderRadius: tokens.radius.sm } },
                onOk: () => handleManualTrigger('amazon')
            })
        },
        {
            key: 'ajio',
            label: (
                <div style={{ padding: '4px 0' }}>
                    <div style={{ fontWeight: 600, fontSize: '13px' }}>Ajio Pipeline</div>
                    <div style={{ fontSize: '11px', color: tokens.text.tertiary }}>Scrape + clean all Ajio sellers</div>
                </div>
            ),
            onClick: () => Modal.confirm({
                title: 'Trigger Ajio Pipeline',
                content: 'This will start a synchronous scraping and data processing pipeline for all Ajio seller accounts.',
                okText: 'Execute',
                okButtonProps: { style: { background: tokens.brand.primary, borderColor: tokens.brand.primary, borderRadius: tokens.radius.sm } },
                cancelButtonProps: { style: { borderRadius: tokens.radius.sm } },
                onOk: () => handleManualTrigger('ajio')
            })
        }
    ];

    // ─── Tab items config ────────────────────────────────────────
    const tabItems = [
        {
            key: 'overview',
            label: (
                <span style={{ display: 'flex', alignItems: 'center', gap: '7px', fontWeight: 600, fontSize: '13px' }}>
                    <BarChart3 size={15} /> Overview
                </span>
            ),
            children: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Analytics Row */}
                    <Row gutter={[16, 16]}>
                        <Col xs={24} lg={16}>
                            <Card style={cardBase} styles={{ body: { padding: '20px' } }}>
                                <SectionHeader title="Ingestion Volume & Run Duration" subtitle="Last 20 pipeline executions" />
                                <Suspense fallback={<SkeletonChart height={320} />}>
                                    {ingestionChart.categories.length > 0 ? (
                                        <Chart options={ingestionChartOptions} series={ingestionChartSeries} type="line" height={320} />
                                    ) : (
                                        <Empty description="No run data available" style={{ padding: '80px 0' }} />
                                    )}
                                </Suspense>
                            </Card>
                        </Col>
                        <Col xs={24} lg={8}>
                            <Card style={{ ...cardBase, height: '100%' }} styles={{ body: { padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' } }}>
                                <SectionHeader title="Status Distribution" subtitle="All-time breakdown" />
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Suspense fallback={<SkeletonChart height={260} />}>
                                        {statusDonut.some(v => v > 0) ? (
                                            <Chart options={donutOptions} series={statusDonut} type="donut" width="100%" height={280} />
                                        ) : (
                                            <Empty description="No runs yet" />
                                        )}
                                    </Suspense>
                                </div>
                            </Card>
                        </Col>
                    </Row>

                    {/* Seller Health + Recent Runs */}
                    <Row gutter={[16, 16]}>
                        <Col xs={24} lg={10}>
                            <Card style={cardBase} styles={{ body: { padding: '20px' } }}>
                                <SectionHeader title="Seller Health Matrix" subtitle="Run outcomes per seller" />
                                <Suspense fallback={<SkeletonChart height={300} />}>
                                    {sellerHealthChart.categories.length > 0 ? (
                                        <Chart options={sellerHealthOptions} series={sellerHealthSeries} type="bar" height={300} />
                                    ) : (
                                        <Empty description="No seller data" style={{ padding: '60px 0' }} />
                                    )}
                                </Suspense>
                            </Card>
                        </Col>
                        <Col xs={24} lg={14}>
                            <Card style={cardBase} styles={{ body: { padding: '0' } }}>
                                <div style={{ padding: '16px 20px', borderBottom: `1px solid ${tokens.borderLight}` }}>
                                    <SectionHeader title="Recent Pipeline Runs" subtitle="Latest 5 executions" />
                                </div>
                                <Table
                                    columns={runColumns}
                                    dataSource={runs.slice(0, 5)}
                                    rowKey="Id"
                                    loading={loading}
                                    pagination={false}
                                    size="small"
                                    style={{ fontSize: '13px' }}
                                />
                            </Card>
                        </Col>
                    </Row>
                </div>
            )
        },
        {
            key: 'runs',
            label: (
                <span style={{ display: 'flex', alignItems: 'center', gap: '7px', fontWeight: 600, fontSize: '13px' }}>
                    <GitBranch size={15} /> Pipeline Runs
                    <Badge count={runs.filter(r => r.Status === 'RUNNING').length} size="small" style={{ backgroundColor: tokens.semantic.warning }} />
                </span>
            ),
            children: (
                <Card style={cardBase} styles={{ body: { padding: 0 } }}>
                    <div style={{ padding: '16px 20px', borderBottom: `1px solid ${tokens.borderLight}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <Text strong style={{ fontSize: '15px', color: tokens.text.primary }}>Execution History</Text>
                            <Text style={{ fontSize: '12px', color: tokens.text.tertiary, marginLeft: '12px' }}>{runs.length} total runs</Text>
                        </div>
                        <Space size="small">
                            <Input
                                placeholder="Filter by ID..."
                                prefix={<Search size={13} style={{ color: tokens.text.tertiary }} />}
                                style={{ width: 200, borderRadius: tokens.radius.sm }}
                                allowClear
                                size="small"
                            />
                        </Space>
                    </div>
                    <Table
                        columns={runColumns}
                        dataSource={runs}
                        rowKey="Id"
                        loading={loading}
                        pagination={{ defaultPageSize: 15, showSizeChanger: true, showTotal: (total) => `${total} runs`, size: 'small' }}
                        size="middle"
                    />
                </Card>
            )
        },
        {
            key: 'sellers',
            label: (
                <span style={{ display: 'flex', alignItems: 'center', gap: '7px', fontWeight: 600, fontSize: '13px' }}>
                    <Layers size={15} /> Sellers
                    <Badge count={metrics.length} size="small" style={{ backgroundColor: tokens.brand.primary }} />
                </span>
            ),
            children: (
                <Card style={cardBase} styles={{ body: { padding: 0 } }}>
                    <div style={{ padding: '16px 20px', borderBottom: `1px solid ${tokens.borderLight}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <Text strong style={{ fontSize: '15px', color: tokens.text.primary }}>Seller Telemetry</Text>
                            <Text style={{ fontSize: '12px', color: tokens.text.tertiary, marginLeft: '12px' }}>{filteredMetrics.length} accounts</Text>
                        </div>
                        <Input
                            placeholder="Search seller..."
                            prefix={<Search size={13} style={{ color: tokens.text.tertiary }} />}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{ width: 220, borderRadius: tokens.radius.sm }}
                            allowClear
                            size="small"
                        />
                    </div>
                    <Table
                        columns={sellerColumns}
                        dataSource={filteredMetrics}
                        rowKey="sellerId"
                        loading={loading}
                        pagination={{ defaultPageSize: 12, showSizeChanger: true, showTotal: (total) => `${total} sellers`, size: 'small' }}
                        size="middle"
                    />
                </Card>
            )
        },
        {
            key: 'config',
            label: (
                <span style={{ display: 'flex', alignItems: 'center', gap: '7px', fontWeight: 600, fontSize: '13px' }}>
                    <Sliders size={15} /> Configuration
                </span>
            ),
            children: (
                <Row gutter={[16, 16]}>
                    <Col xs={24} md={12}>
                        <Card style={cardBase} styles={{ body: { padding: '24px' } }}>
                            <SectionHeader title="Schedule Configuration" subtitle="Automated pipeline triggers" />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                                {/* Automation toggle */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: `1px solid ${tokens.borderLight}` }}>
                                    <div>
                                        <Text strong style={{ fontSize: '13px', display: 'block', color: tokens.text.primary }}>Global Automation</Text>
                                        <Text style={{ fontSize: '11px', color: tokens.text.tertiary }}>Master switch for all scheduled pipelines</Text>
                                    </div>
                                    <Switch
                                        checked={scheduleConfig.automationEnabled}
                                        disabled
                                        checkedChildren="ON"
                                        unCheckedChildren="OFF"
                                    />
                                </div>
                                {/* Amazon */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: `1px solid ${tokens.borderLight}` }}>
                                    <div>
                                        <Text strong style={{ fontSize: '13px', display: 'block', color: tokens.text.primary }}>Amazon Pipeline</Text>
                                        <Text style={{ fontSize: '11px', color: tokens.text.tertiary }}>Daily scheduled ingestion</Text>
                                    </div>
                                    <Tag style={{ margin: 0, fontWeight: 600, fontSize: '12px', borderRadius: tokens.radius.sm, background: tokens.semantic.infoLight, color: tokens.semantic.info, border: 'none' }}>
                                        <Clock size={11} style={{ marginRight: 4 }} />
                                        {scheduleConfig.scheduleTime || '00:01'} IST
                                    </Tag>
                                </div>
                                {/* Ajio */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0' }}>
                                    <div>
                                        <Text strong style={{ fontSize: '13px', display: 'block', color: tokens.text.primary }}>Ajio Pipeline</Text>
                                        <Text style={{ fontSize: '11px', color: tokens.text.tertiary }}>Currently disabled</Text>
                                    </div>
                                    <Tag style={{ margin: 0, fontWeight: 600, fontSize: '12px', borderRadius: tokens.radius.sm, background: tokens.borderLight, color: tokens.text.tertiary, border: 'none' }}>
                                        <Clock size={11} style={{ marginRight: 4 }} />
                                        {scheduleConfig.ajioScheduleTime || '12:00'} IST
                                    </Tag>
                                </div>
                            </div>
                        </Card>
                    </Col>
                    <Col xs={24} md={12}>
                        <Card style={cardBase} styles={{ body: { padding: '24px' } }}>
                            <SectionHeader title="System Health" subtitle="Infrastructure diagnostics" />
                            <Alert
                                message="System Operational"
                                description="All ingestion pipelines are healthy. Scheduled runs execute sequentially to prevent resource contention."
                                type="success"
                                showIcon
                                style={{ borderRadius: tokens.radius.md, marginBottom: '20px' }}
                            />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                                {[
                                    { label: 'Database', value: 'SQL Server — Connected', icon: Database },
                                    { label: 'Task Scheduler', value: 'Active', icon: Zap },
                                    { label: 'Timezone', value: 'Asia/Kolkata (GMT+05:30)', icon: Clock },
                                    { label: 'Pipeline Mode', value: 'Sequential Execution', icon: GitBranch }
                                ].map((item, i) => (
                                    <div key={item.label} style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '12px 0',
                                        borderBottom: i < 3 ? `1px solid ${tokens.borderLight}` : 'none'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <item.icon size={14} style={{ color: tokens.text.tertiary }} />
                                            <Text style={{ fontSize: '13px', color: tokens.text.secondary }}>{item.label}</Text>
                                        </div>
                                        <Text strong style={{ fontSize: '13px', color: tokens.text.primary }}>{item.value}</Text>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </Col>
                </Row>
            )
        }
    ];

    return (
        <div style={{ backgroundColor: tokens.bg, padding: '28px 32px', minHeight: '100vh' }}>
            <style>{`
                @keyframes pulse-dot {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.4; }
                }
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { 100% { transform: rotate(360deg); } }
                
                .ant-table-wrapper .ant-table-thead > tr > th {
                    background: ${tokens.surfaceElevated} !important;
                    color: ${tokens.text.tertiary} !important;
                    font-weight: 700 !important;
                    font-size: 11px !important;
                    text-transform: uppercase !important;
                    letter-spacing: 0.05em !important;
                    border-bottom: 1px solid ${tokens.border} !important;
                    padding: 10px 16px !important;
                }
                .ant-table-wrapper .ant-table-tbody > tr > td {
                    border-bottom: 1px solid ${tokens.borderLight} !important;
                    padding: 12px 16px !important;
                }
                .ant-table-wrapper .ant-table-tbody > tr:hover > td {
                    background: ${tokens.surfaceElevated} !important;
                }
                .ant-tabs-nav::before {
                    border-bottom: 1px solid ${tokens.border} !important;
                }
                .ant-tabs-tab {
                    padding: 10px 4px !important;
                }
                .ant-tabs-tab-active .ant-tabs-tab-btn {
                    color: ${tokens.brand.primary} !important;
                }
                .ant-tabs-ink-bar {
                    background: ${tokens.brand.primary} !important;
                    height: 2.5px !important;
                    border-radius: 2px !important;
                }
            `}</style>

            {/* ─── Header ─────────────────────────────────────────── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div>
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                        color: tokens.brand.primary, background: tokens.brand.primaryLight,
                        padding: '3px 10px', borderRadius: '20px', marginBottom: '8px'
                    }}>
                        <Activity size={11} /> Automation Hub
                    </div>
                    <Text style={{ fontSize: '13px', color: tokens.text.tertiary }}>
                        Monitor ingestion pipelines, analyze seller performance, and manage automation schedules.
                    </Text>
                </div>

                <Space size="small">
                    <Tooltip title="Refresh telemetry data">
                        <Button
                            onClick={() => fetchData()}
                            icon={<RefreshCw size={14} className={loading ? 'spin' : ''} />}
                            style={{ height: '36px', fontWeight: 600, borderRadius: tokens.radius.sm, borderColor: tokens.border }}
                        >
                            Sync
                        </Button>
                    </Tooltip>
                    <Dropdown menu={{ items: triggerItems }} trigger={['click']} placement="bottomRight">
                        <Button
                            type="primary"
                            loading={triggering}
                            icon={<PlayCircle size={14} />}
                            style={{
                                height: '36px', fontWeight: 600, borderRadius: tokens.radius.sm,
                                background: tokens.brand.primary, borderColor: tokens.brand.primary,
                                boxShadow: `0 2px 8px ${tokens.brand.primary}30`
                            }}
                        >
                            Run Pipeline <ChevronDown size={13} style={{ marginLeft: 2 }} />
                        </Button>
                    </Dropdown>
                </Space>
            </div>

            {/* ─── Alert ──────────────────────────────────────────── */}
            {message && (
                <Alert
                    message={message.text}
                    type={message.type}
                    showIcon
                    closable
                    onClose={() => setMessage(null)}
                    style={{ marginBottom: 20, borderRadius: tokens.radius.md }}
                />
            )}

            {/* ─── KPI Cards ─────────────────────────────────────── */}
            <Row gutter={[14, 14]} style={{ marginBottom: '22px' }}>
                <Col xs={12} sm={12} md={6}>
                    <MetricCard
                        label="Active Pipelines"
                        value={stats.totalActive}
                        icon={Zap}
                        color={stats.totalActive > 0 ? tokens.semantic.warning : null}
                        loading={loading}
                    />
                </Col>
                <Col xs={12} sm={12} md={6}>
                    <MetricCard
                        label="Ingested Records"
                        value={stats.inserted.toLocaleString()}
                        suffix={`/ ${stats.expected.toLocaleString()}`}
                        icon={Database}
                        trend={stats.yieldRate}
                        trendLabel="overall yield"
                        loading={loading}
                    />
                </Col>
                <Col xs={12} sm={12} md={6}>
                    <MetricCard
                        label="Success Rate"
                        value={`${stats.successRate}`}
                        suffix="%"
                        icon={CheckCircle2}
                        color={tokens.semantic.success}
                        loading={loading}
                    />
                </Col>
                <Col xs={12} sm={12} md={6}>
                    <MetricCard
                        label="Avg Run Duration"
                        value={stats.avgDuration}
                        suffix="min"
                        icon={Clock}
                        loading={loading}
                    />
                </Col>
            </Row>

            {/* ─── Main Tabs ──────────────────────────────────────── */}
            <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} style={{ marginBottom: '20px' }} />

            {/* ─── Timeline Drawer ────────────────────────────────── */}
            <Drawer
                title={
                    <div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: tokens.text.primary }}>Execution logs & Ingestion Yield</div>
                        {selectedSeller && <div style={{ fontSize: '12px', color: tokens.text.tertiary, fontWeight: 500, marginTop: '2px' }}>{selectedSeller.name}</div>}
                    </div>
                }
                placement="right"
                width={500}
                onClose={() => setLogsDrawerVisible(false)}
                open={logsDrawerVisible}
                styles={{ body: { padding: '24px', backgroundColor: tokens.bg } }}
            >
                {logsLoading ? (
                    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                        <Loader2 size={32} className="spin" style={{ color: tokens.brand.primary }} />
                    </div>
                ) : sellerLogs.length === 0 ? (
                    <Empty description="No logs found for this seller" style={{ marginTop: '80px' }} />
                ) : (
                    <Timeline
                        items={sellerLogs.map((log) => {
                            const isRunning = log.status === 'RUNNING';
                            return {
                                color: isRunning ? 'orange' : log.status === 'COMPLETED' ? 'green' : 'red',
                                children: (
                                    <div style={{
                                        background: tokens.surface, padding: '16px', borderRadius: tokens.radius.md,
                                        border: `1px solid ${tokens.borderLight}`, boxShadow: tokens.shadow.sm, marginBottom: '16px'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                            <Tag style={{
                                                margin: 0, fontWeight: 700, fontSize: '10px', borderRadius: '4px', border: 'none',
                                                background: isRunning ? tokens.semantic.warningLight : log.status === 'COMPLETED' ? tokens.semantic.successLight : tokens.semantic.errorLight,
                                                color: isRunning ? tokens.semantic.warning : log.status === 'COMPLETED' ? tokens.semantic.success : tokens.semantic.error
                                            }}>
                                                {log.status}
                                            </Tag>
                                            <span style={{ fontSize: '11px', color: tokens.text.tertiary }}>
                                                {formatDistanceToNow(new Date(log.startTime || log.createdAt), { addSuffix: true })}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '12px', color: tokens.text.secondary, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <div><strong>Run ID:</strong> <Text code style={{ fontSize: '10.5px' }}>{log.runId?.substring(0, 12)}</Text></div>
                                            <div><strong>Started:</strong> {new Date(log.startTime || log.createdAt).toLocaleString()}</div>
                                            {log.endTime && <div><strong>Completed:</strong> {new Date(log.endTime).toLocaleString()}</div>}
                                            <Divider style={{ margin: '8px 0' }} />
                                            <div style={{ fontSize: '13px' }}>
                                                <Text strong style={{ color: tokens.semantic.success }}>{(log.count || 0).toLocaleString()}</Text> records ingested out of <Text strong>{(log.asinsCount || 0).toLocaleString()}</Text> expected.
                                            </div>
                                            {log.error && (
                                                <div style={{ marginTop: '8px', padding: '8px 12px', background: tokens.semantic.errorLight, color: tokens.semantic.error, borderRadius: tokens.radius.sm, fontWeight: 500 }}>
                                                    <strong>Error:</strong> {log.error}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            };
                        })}
                    />
                )}
            </Drawer>
        </div>
    );
};

export default ScheduledRunsPage;
