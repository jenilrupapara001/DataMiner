import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../services/db';
import {
    Plus, Edit2, Trash2, Search, Clock, Check, Loader2, Zap, Sparkles, Target, Settings, LayoutTemplate, BarChart2
} from 'lucide-react';
import { PageLoader } from '@/components/application/loading-indicator/PageLoader';
import { LoadingIndicator } from '@/components/application/loading-indicator/loading-indicator';
import { 
    Space, Button, Segmented, Table, Modal, Card, Statistic, Input, Row, Col, 
    Typography, Tag, Tooltip, Form, InputNumber, Select, Divider, message as antdMessage, Badge 
} from 'antd';
import { usePageTitle } from '../contexts/PageTitleContext';

const { Title, Text } = Typography;
const { Option, OptGroup } = Select;
const { TextArea } = Input;

const TemplateManagerPage = () => {
    const [messageApi, contextHolder] = antdMessage.useMessage();
    const { setPageTitle } = usePageTitle();

    useEffect(() => {
        setPageTitle('Workflow Templates');
    }, [setPageTitle]);

    // Shared State
    const [activeTab, setActiveTab] = useState('task'); // 'task' or 'goal'
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Configuration State (with hardcoded defaults)
    const [categories, setCategories] = useState(['SEO & Content', 'Sales & Marketing', 'Operations & General', 'PPC & Advertising', 'Compliance & Legal']);
    const [taskTypes, setTaskTypes] = useState([
        { value: 'TITLE_OPTIMIZATION', label: 'Title SEO' },
        { value: 'A_PLUS_CONTENT', label: 'A+ Content' },
        { value: 'PRICING_STRATEGY', label: 'Pricing' },
        { value: 'INVENTORY_MANAGEMENT', label: 'Inventory' },
        { value: 'GENERAL_OPTIMIZATION', label: 'General' },
        { value: 'IMAGE_OPTIMIZATION', label: 'Images' },
        { value: 'DESCRIPTION_OPTIMIZATION', label: 'Description' }
    ]);
    const [priorities, setPriorities] = useState(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
    const [metrics, setMetrics] = useState(['NONE', 'GMS', 'ACOS', 'ROI', 'PROFIT', 'CONVERSION_RATE', 'ORDER_COUNT', 'LISTING', 'PO_FULFILLMENT', 'LQS', 'ADS_SPEND', 'PRODUCTS_TO_LIST']);

    // Task Templates State
    const [taskTemplates, setTaskTemplates] = useState([]);
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [currentTaskTemplate, setCurrentTaskTemplate] = useState(null);
    const [taskFormData, setTaskFormData] = useState({
        title: '', description: '', 
        type: taskTypes.length > 0 ? taskTypes[0].value : 'GENERAL_OPTIMIZATION', 
        priority: priorities.length > 0 ? priorities[1] : 'MEDIUM', 
        category: categories.length > 0 ? categories[2] : 'Operations & General', 
        estimatedMinutes: 30
    });

    // Goal Templates State
    const [goalTemplates, setGoalTemplates] = useState([]);
    const [showGoalModal, setShowGoalModal] = useState(false);
    const [currentGoalTemplate, setCurrentGoalTemplate] = useState(null);
    const [goalFormData, setGoalFormData] = useState({
        name: '', description: '', goals: []
    });

    // AI Generation State
    const [showAiModal, setShowAiModal] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiGenerating, setAiGenerating] = useState(false);
    const [aiSuggestions, setAiSuggestions] = useState(null);
    const [error, setError] = useState(null);

    // Data Fetching - defined at component scope to fix scoping runtime error
    const fetchTemplates = useCallback(async (showIndicator = true) => {
        if (showIndicator) setLoading(true);
        setError(null);
        try {
            const [taskRes, goalRes] = await Promise.all([
                db.getTaskTemplates(),
                db.getGoalTemplates()
            ]);
            
            // Handle both direct array or wrapped {success, data} response
            const taskData = Array.isArray(taskRes) ? taskRes : (taskRes?.data || []);
            const goalData = Array.isArray(goalRes) ? goalRes : (goalRes?.data || []);
            
            setTaskTemplates(taskData);
            setGoalTemplates(goalData);
        } catch (err) {
            console.error('Failed to fetch templates:', err);
            setError('Failed to load templates. Please refresh.');
        } finally {
            if (showIndicator) setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTemplates(true);
    }, [fetchTemplates]);

    // Task Modal Handlers
    const handleOpenTaskModal = (template = null) => {
        setCurrentTaskTemplate(template);
        if (template) {
            setTaskFormData({ ...template });
        } else {
            setTaskFormData({ title: '', description: '', type: 'GENERAL_OPTIMIZATION', priority: 'MEDIUM', category: 'Operations & General', estimatedMinutes: 30 });
        }
        setShowTaskModal(true);
    };

    const handleTaskSubmit = async (e) => {
        if (e) e.preventDefault();
        if (!taskFormData.title?.trim()) {
            messageApi.warning('Please enter a protocol title.');
            return;
        }
        if (!taskFormData.description?.trim()) {
            messageApi.warning('Please enter workflow guidelines.');
            return;
        }
        setIsSubmitting(true);
        try {
            if (currentTaskTemplate) await db.updateTemplate(currentTaskTemplate._id, taskFormData);
            else await db.createTemplate(taskFormData);
            await fetchTemplates(false);
            setShowTaskModal(false);
            messageApi.success(`Task template ${currentTaskTemplate ? 'updated' : 'created'} successfully`);
        } catch (error) {
            messageApi.error('Failed to save task template.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteTask = (id) => {
        Modal.confirm({
            title: 'Delete Task Template',
            content: 'Are you sure you want to delete this task template? This action cannot be undone.',
            okText: 'Delete',
            okType: 'danger',
            cancelText: 'Cancel',
            centered: true,
            onOk: async () => {
                try {
                    await db.deleteTemplate(id);
                    await fetchTemplates(false);
                    messageApi.success('Task template deleted successfully');
                } catch (error) {
                    messageApi.error('Failed to delete task template.');
                }
            }
        });
    };

    // Goal Modal Handlers
    const handleOpenGoalModal = (template = null) => {
        setCurrentGoalTemplate(template);
        if (template) {
            setGoalFormData({ name: template.name, description: template.description || '', goals: template.goals || [] });
        } else {
            setGoalFormData({ name: '', description: '', goals: [{ title: '', metric: 'NONE', targetValue: '' }] });
        }
        setShowGoalModal(true);
    };

    const handleGoalSubmit = async (e) => {
        if (e) e.preventDefault();
        if (!goalFormData.name?.trim()) {
            messageApi.warning('Please enter a roadmap blueprint name.');
            return;
        }
        setIsSubmitting(true);
        try {
            const cleanedGoals = goalFormData.goals.filter(g => g.title.trim() !== '');
            const payload = { ...goalFormData, goals: cleanedGoals };

            if (currentGoalTemplate) await db.updateGoalTemplate(currentGoalTemplate._id, payload);
            else await db.createGoalTemplate(payload);
            await fetchTemplates(false);
            setShowGoalModal(false);
            messageApi.success(`Goal roadmap ${currentGoalTemplate ? 'updated' : 'published'} successfully`);
        } catch (error) {
            messageApi.error('Failed to save goal template.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteGoal = (id) => {
        Modal.confirm({
            title: 'Delete Goal Template',
            content: 'Are you sure you want to delete this goal roadmap template? This action cannot be undone.',
            okText: 'Delete',
            okType: 'danger',
            cancelText: 'Cancel',
            centered: true,
            onOk: async () => {
                try {
                    await db.deleteGoalTemplate(id);
                    await fetchTemplates(false);
                    messageApi.success('Goal template deleted successfully');
                } catch (error) {
                    messageApi.error('Failed to delete goal template.');
                }
            }
        });
    };

    // AI Generation Handlers
    const handleAiGenerate = async () => {
        if (!aiPrompt.trim()) return;
        setAiGenerating(true);
        try {
            // Re-using the strategy/goals/ai-preview endpoint 
            const data = await db.request('/strategy/goals/ai-preview', {
                method: 'POST',
                body: JSON.stringify({ intent: aiPrompt })
            });
            if (data.success) {
                setAiSuggestions(data.data);
                messageApi.success('AI Strategy generated successfully!');
            } else {
                messageApi.error(data.message || 'AI failed to generate suggestions.');
            }
        } catch (error) {
            console.error('AI Generation Error:', error);
            messageApi.error('Failed to connect to AI engine.');
        } finally {
            setAiGenerating(false);
        }
    };

    const handleAcceptSuggestion = async (suggestion) => {
        setIsSubmitting(true);
        try {
            if (activeTab === 'goal') {
                const payload = {
                    name: suggestion.name || `AI: ${aiPrompt}`,
                    description: suggestion.strategy || '',
                    goals: (suggestion.milestones || []).map(m => ({
                        title: m.objective || 'Objective',
                        metric: 'GMS', // Default for now
                        targetValue: ''
                    }))
                };
                await db.createGoalTemplate(payload);
            } else {
                // If task tab, creates tasks from milestones
                for (const m of (suggestion.milestones || [])) {
                    await db.createTemplate({
                        title: m.objective,
                        description: `Strategy: ${suggestion.strategy}\nFocus: ${activeTab === 'goal' ? 'Strategic Goal' : 'Action Item'}`,
                        category: 'Operations & General',
                        type: 'GENERAL_OPTIMIZATION',
                        priority: 'MEDIUM'
                    });
                }
            }
            await fetchTemplates(false);
            setShowAiModal(false);
            setAiSuggestions(null);
            setAiPrompt('');
            messageApi.success('AI Generated templates adopted successfully');
        } catch (error) {
            messageApi.error('Failed to adopt AI suggestions.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Sub-goal management
    const addSubGoal = () => {
        setGoalFormData(prev => ({ ...prev, goals: [...prev.goals, { title: '', metric: 'NONE', targetValue: '' }] }));
    };
    const updateSubGoal = (index, field, value) => {
        const newGoals = [...goalFormData.goals];
        const oldMetric = newGoals[index].metric;
        newGoals[index][field] = value;

        // Auto-suggest title based on metric if title is empty or was the default for previous metric
        if (field === 'metric' && value !== 'NONE' && (!newGoals[index].title || newGoals[index].title === oldMetric.replace('_', ' '))) {
            const suggestions = {
                'GMS': 'Monthly GMS Target',
                'ACOS': 'ACOS Efficiency Goal',
                'ROI': 'Return on Investment',
                'PROFIT': 'Net Profit Margin',
                'CONVERSION_RATE': 'Listing Conversion Rate',
                'ORDER_COUNT': 'Daily Order Volume',
                'LISTING': 'Listing Optimization Score',
                'PO_FULFILLMENT': 'PO Fulfilment Rate',
                'LQS': 'Listing Quality Score (LQS)',
                'ADS_SPEND': 'Ads Budget / Spend',
                'PRODUCTS_TO_LIST': 'New Products to List'
            };
            newGoals[index].title = suggestions[value] || value.replace('_', ' ');
        }
        
        setGoalFormData(prev => ({ ...prev, goals: newGoals }));
    };
    const removeSubGoal = (index) => {
        const newGoals = [...goalFormData.goals];
        newGoals.splice(index, 1);
        setGoalFormData(prev => ({ ...prev, goals: newGoals }));
    };

    // Search Filtering
    const filteredTasks = useMemo(() => 
        taskTemplates.filter(t => 
            t.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
            t.category?.toLowerCase().includes(searchTerm.toLowerCase())
        ), [taskTemplates, searchTerm]
    );

    const filteredGoals = useMemo(() => 
        goalTemplates.filter(t => 
            t.name?.toLowerCase().includes(searchTerm.toLowerCase())
        ), [goalTemplates, searchTerm]
    );

    const getPriorityColor = (p) => {
        switch (String(p).toUpperCase()) {
            case 'URGENT': return 'red';
            case 'HIGH': return 'orange';
            case 'MEDIUM': return 'blue';
            case 'LOW': return 'default';
            default: return 'default';
        }
    };

    // Table columns for Task mode
    const taskColumns = [
        {
            title: 'Task Details',
            dataIndex: 'title',
            key: 'title',
            render: (title, record) => (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <Text strong style={{ fontSize: '13px', color: '#1e293b', letterSpacing: '-0.01em' }}>{title}</Text>
                    <Text type="secondary" ellipsis={{ tooltip: record.description }} style={{ fontSize: '11.5px', maxWidth: 400, marginTop: 2 }}>
                        {record.description || 'No guidelines configured.'}
                    </Text>
                </div>
            ),
            sorter: (a, b) => a.title.localeCompare(b.title),
        },
        {
            title: 'Task Type',
            dataIndex: 'type',
            key: 'type',
            width: 180,
            render: (type) => {
                const label = taskTypes.find(t => t.value === type)?.label || type;
                return (
                    <Space size={6} style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                        <Settings size={13} className="text-slate-400" />
                        <span>{label}</span>
                    </Space>
                );
            }
        },
        {
            title: 'Category',
            dataIndex: 'category',
            key: 'category',
            width: 180,
            render: (category) => (
                <Tag color="purple" variant="filled" style={{ borderRadius: 6, fontWeight: 600, fontSize: 10.5, padding: '1px 8px' }}>
                    {category}
                </Tag>
            )
        },
        {
            title: 'Priority',
            dataIndex: 'priority',
            key: 'priority',
            width: 120,
            render: (priority) => (
                <Tag color={getPriorityColor(priority)} style={{ borderRadius: 10, fontWeight: 700, fontSize: 9.5, padding: '0 8px', textTransform: 'uppercase' }}>
                    {priority}
                </Tag>
            )
        },
        {
            title: 'Actions',
            key: 'actions',
            fixed: 'right',
            align: 'right',
            width: 110,
            render: (_, record) => (
                <Space size={4}>
                    <Tooltip title="Edit Template">
                        <Button 
                            type="text" 
                            shape="circle" 
                            size="small" 
                            onClick={() => handleOpenTaskModal(record)} 
                            icon={<Edit2 size={13} className="text-indigo-600" />} 
                        />
                    </Tooltip>
                    <Tooltip title="Delete Template">
                        <Button 
                            type="text" 
                            danger 
                            shape="circle" 
                            size="small" 
                            onClick={() => handleDeleteTask(record._id)} 
                            icon={<Trash2 size={13} />} 
                        />
                    </Tooltip>
                </Space>
            )
        }
    ];

    // Table columns for Goal mode
    const goalColumns = [
        {
            title: 'Roadmap Template',
            dataIndex: 'name',
            key: 'name',
            render: (name, record) => (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <Text strong style={{ fontSize: '13px', color: '#1e293b', letterSpacing: '-0.01em' }}>{name}</Text>
                    <Text type="secondary" ellipsis={{ tooltip: record.description }} style={{ fontSize: '11.5px', maxWidth: 450, marginTop: 2 }}>
                        {record.description || 'No description defined.'}
                    </Text>
                </div>
            ),
            sorter: (a, b) => a.name.localeCompare(b.name),
        },
        {
            title: 'Target Metrics',
            dataIndex: 'goals',
            key: 'goals',
            render: (goals = []) => {
                if (!goals?.length) return <Text type="secondary" italic style={{ fontSize: 11 }}>No metrics mapped</Text>;
                return (
                    <Space wrap size={4}>
                        {goals.slice(0, 3).map((g, idx) => (
                            <Tag key={idx} variant="filled" color="blue" style={{ borderRadius: 6, fontWeight: 600, fontSize: 10 }}>
                                {String(g.metric || 'GMS').replace('_', ' ')}
                            </Tag>
                        ))}
                        {goals.length > 3 && (
                            <Tag variant="filled" style={{ borderRadius: 6, fontWeight: 700, fontSize: 10, color: '#64748b', background: '#f1f5f9' }}>
                                +{goals.length - 3}
                            </Tag>
                        )}
                    </Space>
                );
            }
        },
        {
            title: 'Actions',
            key: 'actions',
            fixed: 'right',
            align: 'right',
            width: 110,
            render: (_, record) => (
                <Space size={4}>
                    <Tooltip title="Edit Roadmap">
                        <Button 
                            type="text" 
                            shape="circle" 
                            size="small" 
                            onClick={() => handleOpenGoalModal(record)} 
                            icon={<Edit2 size={13} className="text-indigo-600" />} 
                        />
                    </Tooltip>
                    <Tooltip title="Delete Roadmap">
                        <Button 
                            type="text" 
                            danger 
                            shape="circle" 
                            size="small" 
                            onClick={() => handleDeleteGoal(record._id)} 
                            icon={<Trash2 size={13} />} 
                        />
                    </Tooltip>
                </Space>
            )
        }
    ];

    // Show page loader when loading
    if (loading && taskTemplates.length === 0 && goalTemplates.length === 0) {
        return <PageLoader message="Loading Automation Templates..." />;
    }

    // Show error state
    if (error) {
        return (
            <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
                {contextHolder}
                <div style={{ textAlign: 'center', padding: 32, background: '#fff', borderRadius: 16, boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
                    <Title level={4} style={{ color: '#D32F2F' }}>Configuration Error</Title>
                    <Text type="secondary" style={{ display: 'block', marginBottom: 20 }}>{error}</Text>
                    <Button type="primary" size="large" shape="round" onClick={() => fetchTemplates(true)}>Refresh Interface</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="templates-page-container">
            {contextHolder}
            {loading && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}>
                    <LoadingIndicator type="line-simple" size="md" />
                </div>
            )}
            <style>{`
                .templates-page-container {
                    display: flex;
                    flex-direction: column;
                    min-height: calc(100vh - 60px);
                    background-color: #fafbfc;
                }
                .templates-header {
                    flex-shrink: 0;
                    background: #ffffff;
                    padding: 18px 28px;
                    border-bottom: 1px solid #e2e8f0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    z-index: 10;
                }
                .templates-scroll-content {
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px 28px;
                    display: flex;
                    flex-direction: column;
                }
                .segmented-templates .ant-segmented-item-selected {
                    background-color: #1976D2 !important;
                    color: #ffffff !important;
                    font-weight: 700 !important;
                }
                .segmented-templates .ant-segmented-item {
                    font-weight: 600;
                    font-size: 11.5px;
                    color: #475569;
                }
                .templates-table .ant-table-thead > tr > th {
                    background: #fafbfc !important;
                    font-size: 11px !important;
                    font-weight: 700 !important;
                    color: #475569 !important;
                    text-transform: uppercase !important;
                    letter-spacing: 0.04em !important;
                    border-bottom: 2px solid #e2e8f0 !important;
                }
                .templates-table .ant-table-tbody > tr > td {
                    border-bottom: 1px solid #f1f5f9 !important;
                }
                .templates-table .ant-table-tbody > tr:hover > td {
                    background: #f8fafc !important;
                }
                @media (max-width: 768px) {
                    .templates-header {
                        flex-direction: column;
                        align-items: stretch;
                        gap: 12px;
                    }
                }
            `}</style>

            {/* 1. DYNAMIC WORKSPACE CONTROL STRIP */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 24px',
                background: '#ffffff',
                borderBottom: '1px solid #e2e8f0',
                flexWrap: 'wrap',
                gap: 16
            }}>
                {/* Left Side: Switcher with Badges */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 750, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Template Type:</span>
                    <Segmented 
                        className="segmented-templates"
                        value={activeTab}
                        onChange={setActiveTab}
                        style={{ padding: 3 }}
                        options={[
                            { label: <Space size={6}><Zap size={13} /><span>Tasks</span><Badge count={taskTemplates.length} overflowCount={99} style={{ backgroundColor: '#1976D2', fontSize: 10, height: 16, minWidth: 16, lineHeight: '16px' }} /></Space>, value: 'task' },
                            { label: <Space size={6}><Target size={13} /><span>Roadmaps</span><Badge count={goalTemplates.length} overflowCount={99} style={{ backgroundColor: '#2E7D32', fontSize: 10, height: 16, minWidth: 16, lineHeight: '16px' }} /></Space>, value: 'goal' }
                        ]}
                    />
                </div>

                {/* Right Side: Search + Action Buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                        <Input
                            prefix={<Search size={12} style={{ color: '#94a3b8' }} />}
                            size="small"
                            placeholder="Search templates..."
                            allowClear
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{ width: 220, borderRadius: 8 }}
                        />

                    <Button 
                        onClick={() => setShowAiModal(true)}
                        icon={<Sparkles size={13} />}
                        style={{ 
                            fontWeight: 600,
                            fontSize: 11,
                            borderRadius: 8,
                            height: 32,
                            borderColor: '#1976D2', 
                            color: '#1976D2', 
                            background: '#eef2ff'
                        }}
                    >
                        AI Generate
                    </Button>

                    <Divider orientation="vertical" style={{ height: 16, borderColor: '#e2e8f0', margin: '0 2px' }} />

                    <Button 
                        type="primary" 
                        onClick={() => activeTab === 'task' ? handleOpenTaskModal() : handleOpenGoalModal()} 
                        icon={<Plus size={13} />}
                        style={{ 
                            borderRadius: 8,
                            fontSize: 11,
                            fontWeight: 600,
                            height: 32
                        }}
                    >
                        {activeTab === 'task' ? 'New Task' : 'New Roadmap'}
                    </Button>
                </div>
            </div>

            {/* 2. SCROLLABLE CONTENT BODY */}
            <div className="templates-scroll-content animate-fade-up">
                {/* Content Table Grid */}
                <Card 
                    styles={{ body: { padding: 0 } }}
                    style={{ borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}
                >
                    <Table 
                        dataSource={activeTab === 'task' ? filteredTasks : filteredGoals}
                        columns={activeTab === 'task' ? taskColumns : goalColumns}
                        rowKey={record => record._id || record.id}
                        pagination={{
                            pageSize: 10,
                            showTotal: (total, range) => <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Viewing {range[0]}-{range[1]} of {total} templates</span>,
                            position: ['bottomRight']
                        }}
                        scroll={{ x: 900, y: 'calc(100vh - 190px)' }}
                        size="small"
                        className="templates-table"
                    />
                </Card>
            </div>

            {/* ==================== MODAL CONTEXTS ==================== */}

            {/* 1. Task Creation / Edit Modal */}
            <Modal
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ background: '#EEF2FF', color: '#4F46E5', padding: 6, borderRadius: 8, display: 'flex' }}>
                            <Zap size={16} />
                        </div>
                        <span style={{ fontWeight: 700 }}>{currentTaskTemplate ? 'Edit Task Template' : 'New Task Template'}</span>
                    </div>
                }
                open={showTaskModal}
                onCancel={() => setShowTaskModal(false)}
                centered
                destroyOnHidden
                width={580}
                className="custom-glass-modal"
                footer={[
                    <Button key="back" onClick={() => setShowTaskModal(false)} style={{ borderRadius: 8, fontWeight: 600, fontSize: 11, height: 32 }}>
                        Cancel
                    </Button>,
                    <Button 
                        key="submit" 
                        type="primary" 
                        loading={isSubmitting}
                        onClick={handleTaskSubmit}
                        style={{ borderRadius: 8, fontWeight: 600, fontSize: 11, height: 32 }}
                    >
                        {currentTaskTemplate ? 'Save' : 'Create'}
                    </Button>
                ]}
            >
                <Form layout="vertical" style={{ padding: '12px 0' }} onFinish={handleTaskSubmit}>
                    <Form.Item label={<span style={{ fontWeight: 700, color: '#334155', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Task Template Title</span>} required>
                        <Input 
                            size="large"
                            placeholder="e.g. Optimize Amazon Product Title for SEO" 
                            value={taskFormData.title}
                            onChange={e => setTaskFormData({ ...taskFormData, title: e.target.value })}
                            style={{ borderRadius: 10 }}
                        />
                    </Form.Item>

                    <Form.Item label={<span style={{ fontWeight: 700, color: '#334155', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Action Guidelines</span>} required>
                        <TextArea 
                            rows={4}
                            placeholder="Outline the execution instructions and step-by-step guidelines..."
                            value={taskFormData.description}
                            onChange={e => setTaskFormData({ ...taskFormData, description: e.target.value })}
                            style={{ borderRadius: 10 }}
                        />
                    </Form.Item>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item label={<span style={{ fontWeight: 700, color: '#334155', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Category</span>}>
                                <Select 
                                    size="large"
                                    value={taskFormData.category}
                                    onChange={v => setTaskFormData({ ...taskFormData, category: v })}
                                    style={{ width: '100%' }}
                                >
                                    {categories.map(c => <Option key={c} value={c}>{c}</Option>)}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label={<span style={{ fontWeight: 700, color: '#334155', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Task Type</span>}>
                                <Select 
                                    size="large"
                                    value={taskFormData.type}
                                    onChange={v => setTaskFormData({ ...taskFormData, type: v })}
                                    style={{ width: '100%' }}
                                >
                                    {taskTypes.map(t => <Option key={t.value} value={t.value}>{t.label}</Option>)}
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item label={<span style={{ fontWeight: 700, color: '#334155', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Priority</span>}>
                                <Select 
                                    size="large"
                                    value={taskFormData.priority}
                                    onChange={v => setTaskFormData({ ...taskFormData, priority: v })}
                                    style={{ width: '100%' }}
                                >
                                    {priorities.map(p => <Option key={p} value={p}>{p}</Option>)}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label={<span style={{ fontWeight: 700, color: '#334155', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Estimated Time</span>}>
                                <InputNumber 
                                    size="large"
                                    min={1}
                                    addonAfter={<span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} /> min</span>}
                                    value={taskFormData.estimatedMinutes}
                                    onChange={v => setTaskFormData({ ...taskFormData, estimatedMinutes: v || 0 })}
                                    style={{ width: '100%' }}
                                />
                            </Form.Item>
                        </Col>
                    </Row>
                </Form>
            </Modal>

            {/* 2. Goal Roadmap Creation / Edit Modal */}
            <Modal
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ background: '#ECFDF5', color: '#10B981', padding: 6, borderRadius: 8, display: 'flex' }}>
                            <Target size={16} />
                        </div>
                        <span style={{ fontWeight: 700 }}>{currentGoalTemplate ? 'Configure Roadmap Template' : 'New Roadmap Template'}</span>
                    </div>
                }
                open={showGoalModal}
                onCancel={() => setShowGoalModal(false)}
                centered
                destroyOnHidden
                width={760}
                className="custom-glass-modal"
                footer={[
                    <Button key="back" onClick={() => setShowGoalModal(false)} style={{ borderRadius: 8, fontWeight: 600, fontSize: 11, height: 32 }}>
                        Cancel
                    </Button>,
                    <Button 
                        key="submit" 
                        type="primary" 
                        loading={isSubmitting}
                        onClick={handleGoalSubmit}
                        style={{ borderRadius: 8, fontWeight: 600, fontSize: 11, height: 32 }}
                    >
                        {currentGoalTemplate ? 'Save' : 'Deploy'}
                    </Button>
                ]}
            >
                <div style={{ padding: '12px 0' }}>
                    <Form layout="vertical">
                        <Form.Item label={<span style={{ fontWeight: 700, color: '#334155', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Roadmap Name</span>} required>
                            <Input 
                                size="large"
                                placeholder="e.g. Q3 Sales Booster Roadmap" 
                                value={goalFormData.name}
                                onChange={e => setGoalFormData({ ...goalFormData, name: e.target.value })}
                                style={{ borderRadius: 10 }}
                            />
                        </Form.Item>

                        <Form.Item label={<span style={{ fontWeight: 700, color: '#334155', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Roadmap Description</span>}>
                            <TextArea 
                                rows={2}
                                placeholder="Describe the target goals for this e-commerce roadmap..."
                                value={goalFormData.description}
                                onChange={e => setGoalFormData({ ...goalFormData, description: e.target.value })}
                                style={{ borderRadius: 10 }}
                            />
                        </Form.Item>
                    </Form>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 4 }}>
                        <Text strong style={{ fontSize: 13, color: '#334155', letterSpacing: '-0.01em' }}>Target Performance Metrics</Text>
                        <Button 
                            size="small" 
                            shape="round" 
                            icon={<Plus size={13} />} 
                            onClick={addSubGoal}
                            style={{ fontSize: 11, fontWeight: 600 }}
                        >
                            Add Target Metric
                        </Button>
                    </div>

                    <div style={{ 
                        maxHeight: 300, 
                        overflowY: 'auto', 
                        padding: 12, 
                        background: '#f8fafc', 
                        borderRadius: 16, 
                        border: '1px solid #e2e8f0'
                    }}>
                        {goalFormData.goals.map((g, idx) => (
                            <div key={idx} className="metric-form-row">
                                <div style={{ flex: 3 }}>
                                    <Input 
                                        placeholder="e.g. Hit ₹5,00,000 monthly sales" 
                                        value={g.title} 
                                        onChange={e => updateSubGoal(idx, 'title', e.target.value)}
                                        style={{ border: 'none', background: '#f1f5f9', borderRadius: 8 }}
                                    />
                                </div>
                                <div style={{ flex: 2 }}>
                                    <Select 
                                        style={{ width: '100%' }} 
                                        value={g.metric} 
                                        onChange={v => updateSubGoal(idx, 'metric', v)}
                                        popupClassName="custom-dropdown-render"
                                    >
                                        <Option value="NONE">Select Metric Type</Option>
                                        <OptGroup label="Sales & Revenue">
                                            <Option value="GMS">Sales (₹)</Option>
                                            <Option value="ORDER_COUNT">Orders</Option>
                                            <Option value="CONVERSION_RATE">Conversion Rate %</Option>
                                        </OptGroup>
                                        <OptGroup label="Advertising & ROI">
                                            <Option value="ACOS">ACOS %</Option>
                                            <Option value="ADS_SPEND">Ad Spend (₹)</Option>
                                            <Option value="ROI">ROI Multiplier</Option>
                                        </OptGroup>
                                        <OptGroup label="Product Listing Quality">
                                            <Option value="LISTING">Listing Optimization Score %</Option>
                                            <Option value="PRODUCTS_TO_LIST">Products Listed</Option>
                                            <Option value="LQS">Listing Quality Score</Option>
                                        </OptGroup>
                                        <OptGroup label="Fulfillment & Profit">
                                            <Option value="PROFIT">Net Profit Margin (₹)</Option>
                                            <Option value="PO_FULFILLMENT">Fulfillment Rate %</Option>
                                        </OptGroup>
                                    </Select>
                                </div>
                                <div style={{ flex: 2 }}>
                                    <Input 
                                        type="number"
                                        placeholder="Target Value" 
                                        value={g.targetValue || ''} 
                                        onChange={e => updateSubGoal(idx, 'targetValue', e.target.value)}
                                        style={{ border: 'none', background: '#f1f5f9', borderRadius: 8 }}
                                    />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                    <Button 
                                        type="text" 
                                        danger 
                                        icon={<Trash2 size={15} />} 
                                        onClick={() => removeSubGoal(idx)} 
                                    />
                                </div>
                            </div>
                        ))}

                        {goalFormData.goals.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8' }}>
                                <BarChart2 size={24} style={{ opacity: 0.5, marginBottom: 8 }} />
                                <div style={{ fontSize: 12, fontWeight: 500 }}>Add some performance metrics to track this roadmap.</div>
                            </div>
                        )}
                    </div>
                </div>
            </Modal>

            {/* 3. AI Generation Workbench Modal */}
            <Modal
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ background: '#EEF2FF', color: '#4F46E5', padding: 6, borderRadius: 8, display: 'flex' }}>
                            <Sparkles size={16} fill="currentColor" />
                        </div>
                        <span style={{ fontWeight: 700 }}>AI Template Generator</span>
                    </div>
                }
                open={showAiModal}
                onCancel={() => {
                    setShowAiModal(false);
                    setAiSuggestions(null);
                    setAiPrompt('');
                }}
                centered
                destroyOnHidden
                width={700}
                className="custom-glass-modal"
                footer={null}
            >
                <div style={{ padding: '12px 0' }}>
                    <div style={{ marginBottom: 20 }}>
                        <Text type="secondary" style={{ display: 'block', fontSize: '12.5px' }}>
                            Generate custom task and roadmap templates instantly using AI. Enter your goal (e.g., 'Increase sales for the holiday season') and let AI build the roadmap.
                        </Text>
                    </div>

                    <div style={{ 
                        background: '#f8fafc', 
                        border: '1px solid #e2e8f0', 
                        borderRadius: 20, 
                        padding: 8, 
                        display: 'flex', 
                        flexDirection: 'column',
                        transition: 'all 0.3s',
                        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.01)'
                    }}>
                        <TextArea 
                            rows={3} 
                            placeholder="Describe your business goal..."
                            value={aiPrompt}
                            onChange={e => setAiPrompt(e.target.value)}
                            style={{ border: 'none', background: 'transparent', boxShadow: 'none', resize: 'none' }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 4 }}>
                            <Button 
                                type="primary" 
                                icon={aiGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} 
                                disabled={aiGenerating || !aiPrompt.trim()} 
                                onClick={handleAiGenerate}
                                shape="round"
                                style={{ 
                                    background: '#4F46E5', 
                                    borderColor: '#4F46E5', 
                                    fontWeight: 700,
                                    fontSize: 12,
                                    letterSpacing: '0.02em'
                                }}
                            >
                                Generate Strategy
                            </Button>
                        </div>
                    </div>

                    {aiSuggestions && (
                        <div style={{ 
                            marginTop: 24, 
                            background: '#ffffff', 
                            border: '1px solid #e2e8f0', 
                            borderRadius: 20, 
                            padding: 20,
                            boxShadow: '0 10px 30px rgba(0,0,0,0.03)',
                            animation: 'fadeInUp 0.4s ease-out forwards'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                                <div style={{ flex: 1, paddingRight: 16 }}>
                                    <Tag color="indigo" style={{ borderRadius: 6, fontWeight: 700, fontSize: 9, marginBottom: 8 }}>SUGGESTED STRATEGY</Tag>
                                    <h4 style={{ fontWeight: 800, fontSize: 15, color: '#0f172a', margin: '0 0 4px 0' }}>{aiSuggestions.name}</h4>
                                    <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>{aiSuggestions.strategy}</p>
                                </div>
                                <Button 
                                    type="primary" 
                                    shape="round" 
                                    loading={isSubmitting} 
                                    onClick={() => handleAcceptSuggestion(aiSuggestions)}
                                    style={{ background: '#0f172a', borderColor: '#0f172a', fontWeight: 700, fontSize: 12 }}
                                >
                                    Apply AI Template
                                </Button>
                            </div>

                            <Divider style={{ margin: '16px 0' }} />

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {(aiSuggestions.milestones || []).map((m, idx) => (
                                    <div key={idx} style={{ 
                                        background: '#f8fafc', 
                                        border: '1px solid #f1f5f9', 
                                        borderRadius: 12, 
                                        padding: '12px 16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 12
                                    }}>
                                        <div style={{ 
                                            width: 24, 
                                            height: 24, 
                                            background: '#e2e8f0', 
                                            borderRadius: '50%', 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            justifyContent: 'center',
                                            fontSize: 10,
                                            fontWeight: 800,
                                            color: '#475569'
                                        }}>
                                            {idx + 1}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <h6 style={{ margin: 0, fontWeight: 700, color: '#1e293b', fontSize: 12.5 }}>{m.objective}</h6>
                                        </div>
                                        <Tag color="emerald" variant="filled" style={{ borderRadius: 6, fontWeight: 800, fontSize: 9 }}>AI GENERATED</Tag>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </Modal>

        </div>
    );
};

export default TemplateManagerPage;
