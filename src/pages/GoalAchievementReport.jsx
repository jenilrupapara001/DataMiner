import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../services/db';
import {
    CheckCircle,
    Clock,
    AlertTriangle,
    ArrowLeft,
    Download,
    Calendar,
    TrendingUp,
    RotateCcw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageLoader } from '@/components/application/loading-indicator/PageLoader';
import { LoadingIndicator } from '@/components/application/loading-indicator/loading-indicator';
import { 
    Space, Button, Table, Card, Statistic, Progress, Row, Col, Tag, 
    Typography, Avatar 
} from 'antd';
import { usePageTitle } from '../contexts/PageTitleContext';
import DateRangePicker from '../components/common/DateRangePicker';

const { Text } = Typography;

const GoalAchievementReport = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        dateRange: 'month',
        startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]
    });
    const navigate = useNavigate();
    const { setPageTitle } = usePageTitle();

    useEffect(() => {
        setPageTitle('Task Performance Report');
    }, [setPageTitle]);

    const fetchReport = useCallback(async () => {
        try {
            setLoading(true);
            const response = await db.getGoalAchievementReport(null, filters.startDate, filters.endDate);
            if (response && response.success) {
                setData(response.data);
            }
        } catch (error) {
            console.error("Failed to fetch achievement report:", error);
        } finally {
            setLoading(false);
        }
    }, [filters.startDate, filters.endDate]);

    useEffect(() => {
        fetchReport();
    }, [fetchReport]);

    const handleReset = () => {
        setFilters({
            dateRange: 'month',
            startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
            endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]
        });
    };

    if (loading && !data) {
        return <PageLoader message="Analyzing Performance..." />;
    }

    const { metrics = [], summary = {} } = data || {};

    const columns = [
        {
            title: 'Task Details',
            dataIndex: 'title',
            key: 'title',
            sorter: (a, b) => a.title.localeCompare(b.title),
            render: (title, record) => (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <Text strong style={{ fontSize: '13px', color: '#0f172a', letterSpacing: '-0.01em' }}>{title}</Text>
                    <Text type="secondary" style={{ fontSize: '11px', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Calendar size={11} /> Started: {new Date(record.startedAt).toLocaleDateString()}
                    </Text>
                </div>
            )
        },
        {
            title: 'Assignee',
            dataIndex: 'assignee',
            key: 'assignee',
            sorter: (a, b) => a.assignee.localeCompare(b.assignee),
            render: (assignee) => (
                <Space size={8}>
                    <Avatar 
                        style={{ backgroundColor: '#e0e7ff', color: '#1976D2', fontWeight: 700, fontSize: '11px' }} 
                        size="small"
                    >
                        {assignee ? assignee.charAt(0).toUpperCase() : '?'}
                    </Avatar>
                    <Text style={{ fontSize: '12.5px', color: '#334155', fontWeight: 500 }}>{assignee}</Text>
                </Space>
            )
        },
        {
            title: 'Estimated vs Actual Time',
            key: 'planVsActual',
            render: (_, record) => {
                const percent = record.plannedDuration 
                    ? Math.min((record.actualDuration / record.plannedDuration) * 100, 100) 
                    : 100;
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', width: 140 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b', marginBottom: 2 }}>
                            <span>Est: {record.plannedDuration || '--'}h</span>
                            <span>Act: {record.actualDuration}h</span>
                        </div>
                        <Progress 
                            percent={percent} 
                            strokeColor={record.isOverdue ? '#D32F2F' : '#2E7D32'} 
                            size={[140, 4]} 
                            showInfo={false} 
                        />
                    </div>
                );
            }
        },
        {
            title: 'Duration',
            dataIndex: 'actualDuration',
            key: 'actualDuration',
            sorter: (a, b) => a.actualDuration - b.actualDuration,
            render: (duration) => <Text style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>{duration}h</Text>
        },
        {
            title: 'Difference',
            dataIndex: 'variance',
            key: 'variance',
            sorter: (a, b) => a.variance - b.variance,
            render: (variance) => {
                const isDelay = variance > 0;
                const isSaving = variance < 0;
                return (
                    <Tag 
                        color={isDelay ? 'error' : isSaving ? 'success' : 'default'} 
                        style={{ borderRadius: 6, fontWeight: 700, fontSize: '11px', padding: '1px 6px' }}
                    >
                        {isDelay ? `+${variance}h delayed` : isSaving ? `${Math.abs(variance)}h early` : 'On track'}
                    </Tag>
                );
            }
        },
        {
            title: 'Status',
            dataIndex: 'isOverdue',
            key: 'status',
            align: 'right',
            sorter: (a, b) => (a.isOverdue === b.isOverdue ? 0 : a.isOverdue ? 1 : -1),
            render: (isOverdue) => (
                <Tag 
                    color={isOverdue ? 'red' : 'green'} 
                    variant="filled"
                    style={{ borderRadius: 8, fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', padding: '2px 8px' }}
                >
                    {isOverdue ? 'Overdue' : 'On Time'}
                </Tag>
            )
        }
    ];

    const successRate = summary.totalCompleted > 0 ? Math.round((summary.onTime / summary.totalCompleted) * 100) : 0;

    return (
        <>
            {loading && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}>
                    <LoadingIndicator type="line-simple" size="md" />
                </div>
            )}
            
            <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: 16 
            }}>
                
                {/* 1. TOP HEADER & INTEGRATED ACTION WORKBENCH */}
                <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 12,
                    padding: '10px 16px',
                    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                    flexWrap: 'wrap',
                    gap: 12
                }}>
                    <Space size={12}>
                        <Button
                            type="text"
                            onClick={() => navigate('/tasks')}
                            icon={<ArrowLeft size={14} />}
                            style={{ 
                                padding: '4px 8px', 
                                color: '#475569', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 4,
                                fontWeight: 700,
                                fontSize: 12,
                                height: 32,
                                borderRadius: 8
                            }}
                        >
                            Back to Actions
                        </Button>
                        <div style={{ width: 1, height: 16, background: '#cbd5e1' }} />
                        <Space size={4}>
                            <Text type="secondary" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reports</Text>
                            <span style={{ color: '#cbd5e1', fontSize: 11 }}>/</span>
                            <Text strong style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#0f172a' }}>Fulfillment Efficiency</Text>
                        </Space>
                    </Space>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                        <Text style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginRight: 4 }}>Date Range:</Text>
                        <DateRangePicker
                            startDate={filters.startDate ? new Date(filters.startDate) : null}
                            endDate={filters.endDate ? new Date(filters.endDate) : null}
                            onDateChange={(mode, start, end) => {
                                setFilters(prev => ({
                                    ...prev,
                                    dateRange: mode,
                                    startDate: start ? start.toISOString().split('T')[0] : null,
                                    endDate: end ? end.toISOString().split('T')[0] : null
                                }));
                            }}
                            placeholder="Select date range"
                            compact={true}
                        />
                        <Button 
                            icon={<RotateCcw size={13} style={{ color: '#64748b' }} />} 
                            onClick={handleReset}
                            shape="circle" 
                            style={{ 
                                width: 32, 
                                height: 32, 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                borderColor: '#cbd5e1' 
                            }} 
                            title="Reset Dates"
                        />
                        <Button 
                            type="primary" 
                            shape="round"
                            icon={<Download size={13} />}
                            style={{ 
                                background: '#1976D2', 
                                borderColor: '#1976D2', 
                                fontWeight: 700,
                                fontSize: 12,
                                height: 32,
                                display: 'flex',
                                alignItems: 'center'
                            }}
                        >
                            Export
                        </Button>
                    </div>
                </div>

                {/* 2. PERFORMANCE STATS GRID */}
                <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12} md={6}>
                        <Card 
                            style={{ borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}
                            styles={{ body: { padding: '16px 20px' } }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontSize: 10, fontWeight: 750, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>On-Time Rate</div>
                                    <h2 style={{ margin: 0, fontWeight: 800, color: '#0f172a', fontSize: 22, letterSpacing: '-0.02em' }}>{successRate}%</h2>
                                    <Text type="secondary" style={{ fontSize: 11 }}>Flipped before deadline</Text>
                                </div>
                                <Progress 
                                    type="circle" 
                                    percent={successRate} 
                                    size={45} 
                                    strokeColor="#1976D2"
                                    strokeWidth={11}
                                />
                            </div>
                        </Card>
                    </Col>
                    
                    <Col xs={24} sm={12} md={6}>
                        <Card 
                            style={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}
                            styles={{ body: { padding: '16px 20px' } }}
                        >
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                <div style={{ background: '#ecfdf5', color: '#2E7D32', padding: 10, borderRadius: 10, display: 'flex' }}>
                                    <CheckCircle size={18} />
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, fontWeight: 750, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Tasks Completed</div>
                                    <h2 style={{ margin: 0, fontWeight: 800, color: '#0f172a', fontSize: 22, letterSpacing: '-0.02em' }}>{summary.totalCompleted}</h2>
                                    <Text type="secondary" style={{ fontSize: 11 }}>Successfully finished</Text>
                                </div>
                            </div>
                        </Card>
                    </Col>
                    
                    <Col xs={24} sm={12} md={6}>
                        <Card 
                            style={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}
                            styles={{ body: { padding: '16px 20px' } }}
                        >
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                <div style={{ background: '#fffbeb', color: '#ED6C02', padding: 10, borderRadius: 10, display: 'flex' }}>
                                    <Clock size={18} />
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, fontWeight: 750, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Avg. Task Duration</div>
                                    <h2 style={{ margin: 0, fontWeight: 800, color: '#0f172a', fontSize: 22, letterSpacing: '-0.02em' }}>{summary.avgDuration}h</h2>
                                    <Text type="secondary" style={{ fontSize: 11 }}>Fulfillment speed average</Text>
                                </div>
                            </div>
                        </Card>
                    </Col>
                    
                    <Col xs={24} sm={12} md={6}>
                        <Card 
                            style={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}
                            styles={{ body: { padding: '16px 20px' } }}
                        >
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                <div style={{ 
                                    background: summary.overdue > 0 ? '#fef2f2' : '#f8fafc', 
                                    color: summary.overdue > 0 ? '#D32F2F' : '#64748b', 
                                    padding: 10, 
                                    borderRadius: 10, 
                                    display: 'flex' 
                                }}>
                                    <AlertTriangle size={18} />
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, fontWeight: 750, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Late Completions</div>
                                    <h2 style={{ margin: 0, fontWeight: 800, color: summary.overdue > 0 ? '#D32F2F' : '#0f172a', fontSize: 22, letterSpacing: '-0.02em' }}>{summary.overdue}</h2>
                                    <Text type="secondary" style={{ fontSize: 11 }}>Exceeded estimated window</Text>
                                </div>
                            </div>
                        </Card>
                    </Col>
                </Row>

                {/* 3. PERFORMANCE RECORD MATRIX */}
                <Card 
                    title={<span style={{ fontWeight: 800, color: '#0f172a', fontSize: 14, letterSpacing: '-0.01em' }}>Fulfillment Task Performance</span>}
                    styles={{ header: { borderBottom: '1px solid #f1f5f9', padding: '12px 20px' }, body: { padding: 0 } }}
                    style={{ borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}
                >
                    <Table 
                        dataSource={metrics}
                        columns={columns}
                        rowKey={record => record.id || record._id || record.title}
                        pagination={{
                            pageSize: 10,
                            showTotal: (total, range) => <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Viewing {range[0]}-{range[1]} of {total} records</span>,
                            position: ['bottomRight']
                        }}
                        scroll={{ x: 900, y: 'calc(100vh - 270px)' }}
                        size="small"
                        className="custom-table-ant"
                        locale={{
                            emptyText: (
                                <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
                                    <TrendingUp className="mb-2 opacity-25" size={32} />
                                    <div style={{ fontSize: 12, fontWeight: 600 }}>No performance data available yet</div>
                                </div>
                            )
                        }}
                    />
                </Card>

            </div>
        </>
    );
};

export default GoalAchievementReport;
