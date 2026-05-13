import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../services/db';
import {
    Plus, Edit2, Trash2, Search, Clock, Check, Loader2, Zap, Sparkles, Target, Settings, LayoutTemplate, BarChart2
} from 'lucide-react';
import { PageLoader } from '@/components/application/loading-indicator/PageLoader';
import { LoadingIndicator } from '@/components/application/loading-indicator/loading-indicator';
import { 
    Space, Button, Segmented, Table, Modal, Card, Statistic, Input, Row, Col, 
    Typography, Tag, Tooltip, Form, InputNumber, Select, Divider, message as antdMessage 
} from 'antd';

const { Title, Text } = Typography;
const { Option, OptGroup } = Select;
const { TextArea } = Input;

const TemplateManagerPage = () => {
    const [messageApi, contextHolder] = antdMessage.useMessage();

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
                        {record.description || 'No workflow guidelines configured.'}
                    </Text>
                </div>
            ),
            sorter: (a, b) => a.title.localeCompare(b.title),
        },
        {
            title: 'Process Type',
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
            title: 'Target Category',
            dataIndex: 'category',
            key: 'category',
            width: 180,
            render: (category) => (
                <Tag color="purple" bordered={false} style={{ borderRadius: 6, fontWeight: 600, fontSize: 10.5, padding: '1px 8px' }}>
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
            title: 'Roadmap Blueprint',
            dataIndex: 'name',
            key: 'name',
            render: (name, record) => (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <Text strong style={{ fontSize: '13px', color: '#1e293b', letterSpacing: '-0.01em' }}>{name}</Text>
                    <Text type="secondary" ellipsis={{ tooltip: record.description }} style={{ fontSize: '11.5px', maxWidth: 450, marginTop: 2 }}>
                        {record.description || 'No blueprint roadmap overview defined.'}
                    </Text>
                </div>
            ),
            sorter: (a, b) => a.name.localeCompare(b.name),
        },
        {
            title: 'Metrics Pipeline',
            dataIndex: 'goals',
            key: 'goals',
            render: (goals = []) => {
                if (!goals?.length) return <Text type="secondary" italic style={{ fontSize: 11 }}>No metrics mapped</Text>;
                return (
                    <Space wrap size={4}>
                        {goals.slice(0, 3).map((g, idx) => (
                            <Tag key={idx} bordered={false} color="blue" style={{ borderRadius: 6, fontWeight: 600, fontSize: 10 }}>
                                {String(g.metric || 'GMS').replace('_', ' ')}
                            </Tag>
                        ))}
                        {goals.length > 3 && (
                            <Tag bordered={false} style={{ borderRadius: 6, fontWeight: 700, fontSize: 10, color: '#64748b', background: '#f1f5f9' }}>
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
                    <Title level={4} style={{ color: '#ef4444' }}>Configuration Error</Title>
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
                    height: calc(100vh - 60px);
                    overflow: hidden;
                    background-color: #f8fafc;
                    margin: -1.5rem -2rem;
                }
                .templates-header {
                    flex-shrink: 0;
                    background: #ffffff;
                    padding: 16px 24px;
                    border-bottom: 1px solid #e2e8f0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    z-index: 10;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.01);
                }
                .templates-scroll-content {
                    flex: 1;
                    overflow-y: auto;
                    padding: 24px;
                    display: flex;
                    flex-direction: column;
                    gap: 24px;
                }
                .metric-stat-card {
                    border-radius: 16px !important;
                    border: 1px solid #e2e8f0 !important;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.01) !important;
                    transition: transform 0.2s ease, box-shadow 0.2s ease !important;
                }
                .metric-stat-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05) !important;
                }
                .card-accent-icon {
                    width: 48px;
                    height: 48px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }
                .segmented-templates .ant-segmented-item-selected {
                    background-color: #4f46e5 !important;
                    color: #ffffff !important;
                    font-weight: 650 !important;
                }
                .custom-glass-modal .ant-modal-content {
                    border-radius: 20px !important;
                    overflow: hidden !important;
                }
                .custom-glass-modal .ant-modal-header {
                    background: #f8fafc !important;
                    border-bottom: 1px solid #f1f5f9 !important;
                    padding: 16px 24px !important;
                    margin: 0 !important;
                }
                .custom-glass-modal .ant-modal-footer {
                    background: #f8fafc !important;
                    border-top: 1px solid #f1f5f9 !important;
                    padding: 16px 24px !important;
                    margin: 0 !important;
                }
                
                .metric-form-row {
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 12px;
                    margin-bottom: 10px;
                    display: flex;
                    gap: 12px;
                    align-items: center;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.02);
                    transition: all 0.2s ease;
                }
                .metric-form-row:hover {
                    border-color: #cbd5e1;
                    box-shadow: 0 3px 6px rgba(0,0,0,0.03);
                }

                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-up {
                    animation: fadeInUp 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
                }
                
                @media (max-width: 768px) {
                    .templates-header {
                        flex-direction: column;
                        align-items: stretch;
                        gap: 12px;
                    }
                    .templates-page-container {
                        margin: -0.75rem;
                        height: auto;
                        overflow: visible;
                    }
                }
            `}</style>

            {/* Dynamic Header Area */}
            <div className="templates-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ padding: '8px', background: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)', borderRadius: '10px', color: '#fff', display: 'flex' }}>
                        <LayoutTemplate size={22} />
                    </div>
                    <div>
                        <Title level={4} style={{ margin: 0, fontWeight: 800, letterSpacing: '-0.02em' }}>
                            Template <span style={{ color: '#4F46E5' }}>Manager</span>
                        </Title>
                        <Text type="secondary" style={{ fontSize: '13px' }}>Configure automated workflows, actions, and roadmaps.</Text>
                    </div>
                </div>

                <Space size={8} wrap>
                    <Button 
                        onClick={() => setShowAiModal(true)}
                        icon={<Sparkles size={14} />}
                        shape="round"
                        style={{ 
                            borderColor: '#6366F1', 
                            color: '#4F46E5', 
                            backgroundColor: '#EEF2FF', 
                            fontWeight: 700,
                            height: 38,
                            display: 'flex',
                            alignItems: 'center'
                        }}
                    >
                        AI Builder
                    </Button>
                    <Button 
                        type="primary" 
                        onClick={() => activeTab === 'task' ? handleOpenTaskModal() : handleOpenGoalModal()} 
                        icon={<Plus size={15} />}
                        shape="round"
                        style={{ 
                            height: 38, 
                            backgroundColor: '#4F46E5', 
                            borderColor: '#4F46E5', 
                            fontWeight: 700,
                            boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)',
                            display: 'flex',
                            alignItems: 'center'
                        }}
                    >
                        {activeTab === 'task' ? 'New Task Outline' : 'New Roadmap'}
                    </Button>
                </Space>
            </div>

            {/* Scrollable Body */}
            <div className="templates-scroll-content animate-fade-up">
                
                {/* KPI Banner Section */}
                <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12} md={6}>
                        <Card className="metric-stat-card" styles={{ body: { padding: '20px 24px' } }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div className="card-accent-icon" style={{ backgroundColor: '#EEF2FF', color: '#4F46E5' }}>
                                    <Zap size={22} />
                                </div>
                                <Statistic 
                                    title={<Text strong style={{ fontSize: '11.5px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Task Templates</Text>}
                                    value={taskTemplates.length}
                                    styles={{ content: { fontSize: 28, fontWeight: 800, color: '#1e293b', letterSpacing: '-0.02em' } }}
                                />
                            </div>
                        </Card>
                    </Col>
                    
                    <Col xs={24} sm={12} md={6}>
                        <Card className="metric-stat-card" styles={{ body: { padding: '20px 24px' } }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div className="card-accent-icon" style={{ backgroundColor: '#ECFDF5', color: '#10B981' }}>
                                    <Target size={22} />
                                </div>
                                <Statistic 
                                    title={<Text strong style={{ fontSize: '11.5px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Goal Roadmaps</Text>}
                                    value={goalTemplates.length}
                                    styles={{ content: { fontSize: 28, fontWeight: 800, color: '#1e293b', letterSpacing: '-0.02em' } }}
                                />
                            </div>
                        </Card>
                    </Col>

                    {/* Unified Controller Card */}
                    <Col xs={24} md={12}>
                        <Card className="metric-stat-card" styles={{ body: { padding: '12px 16px' } }} style={{ height: '100%' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', height: '100%' }}>
                                <Segmented 
                                    className="segmented-templates"
                                    size="large"
                                    value={activeTab}
                                    onChange={setActiveTab}
                                    style={{ padding: 4, fontWeight: 600 }}
                                    options={[
                                        { label: <Space size={6}><Zap size={13} /><span>Tasks</span></Space>, value: 'task' },
                                        { label: <Space size={6}><Target size={13} /><span>Roadmaps</span></Space>, value: 'goal' }
                                    ]}
                                />
                                <div style={{ flex: 1, minWidth: 180 }}>
                                    <Input 
                                        size="large"
                                        placeholder={`Search ${activeTab === 'task' ? 'models' : 'roadmaps'}...`}
                                        prefix={<Search size={14} style={{ color: '#94a3b8', marginRight: 4 }} />}
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        allowClear
                                        style={{ borderRadius: 30, backgroundColor: '#f8fafc' }}
                                    />
                                </div>
                            </div>
                        </Card>
                    </Col>
                </Row>

                {/* Content Table Grid */}
                <Card 
                    styles={{ body: { padding: 0 } }}
                    style={{ borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}
                >
                    <Table 
                        dataSource={activeTab === 'task' ? filteredTasks : filteredGoals}
                        columns={activeTab === 'task' ? taskColumns : goalColumns}
                        rowKey="_id"
                        pagination={{
                            pageSize: 12,
                            showTotal: (total, range) => <span style={{ fontSize: 11, color: '#64748b' }}>Viewing {range[0]}-{range[1]} of {total} templates</span>,
                            position: ['bottomRight']
                        }}
                        scroll={{ x: 900, y: 'calc(100vh - 370px)' }}
                        size="middle"
                        className="custom-table-ant"
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
                        <span style={{ fontWeight: 700 }}>{currentTaskTemplate ? 'Edit Task Protocol' : 'New Task Protocol'}</span>
                    </div>
                }
                open={showTaskModal}
                onCancel={() => setShowTaskModal(false)}
                centered
                destroyOnHidden
                width={580}
                className="custom-glass-modal"
                footer={[
                    <Button key="back" shape="round" onClick={() => setShowTaskModal(false)}>
                        Cancel
                    </Button>,
                    <Button 
                        key="submit" 
                        type="primary" 
                        shape="round" 
                        loading={isSubmitting}
                        onClick={handleTaskSubmit}
                        style={{ background: '#4F46E5', borderColor: '#4F46E5', fontWeight: 600 }}
                    >
                        {currentTaskTemplate ? 'Save Protocol' : 'Create Protocol'}
                    </Button>
                ]}
            >
                <Form layout="vertical" style={{ padding: '12px 0' }} onFinish={handleTaskSubmit}>
                    <Form.Item label={<span style={{ fontWeight: 700, color: '#334155', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Protocol Title</span>} required>
                        <Input 
                            size="large"
                            placeholder="e.g. Frontpage SEO Content Alignment" 
                            value={taskFormData.title}
                            onChange={e => setTaskFormData({ ...taskFormData, title: e.target.value })}
                            style={{ borderRadius: 10 }}
                        />
                    </Form.Item>

                    <Form.Item label={<span style={{ fontWeight: 700, color: '#334155', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Workflow Guidelines</span>} required>
                        <TextArea 
                            rows={4}
                            placeholder="Outline the execution instructions and acceptance criteria..."
                            value={taskFormData.description}
                            onChange={e => setTaskFormData({ ...taskFormData, description: e.target.value })}
                            style={{ borderRadius: 10 }}
                        />
                    </Form.Item>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item label={<span style={{ fontWeight: 700, color: '#334155', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Operational Area</span>}>
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
                            <Form.Item label={<span style={{ fontWeight: 700, color: '#334155', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Process Type</span>}>
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
                            <Form.Item label={<span style={{ fontWeight: 700, color: '#334155', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Static Priority</span>}>
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
                            <Form.Item label={<span style={{ fontWeight: 700, color: '#334155', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Estimated Depth</span>}>
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
                        <span style={{ fontWeight: 700 }}>{currentGoalTemplate ? 'Configure Roadmap Blueprint' : 'New Roadmap Blueprint'}</span>
                    </div>
                }
                open={showGoalModal}
                onCancel={() => setShowGoalModal(false)}
                centered
                destroyOnHidden
                width={760}
                className="custom-glass-modal"
                footer={[
                    <Button key="back" shape="round" onClick={() => setShowGoalModal(false)}>
                        Cancel
                    </Button>,
                    <Button 
                        key="submit" 
                        type="primary" 
                        shape="round" 
                        loading={isSubmitting}
                        onClick={handleGoalSubmit}
                        style={{ background: '#4F46E5', borderColor: '#4F46E5', fontWeight: 600 }}
                    >
                        {currentGoalTemplate ? 'Save Blueprint' : 'Deploy Blueprint'}
                    </Button>
                ]}
            >
                <div style={{ padding: '12px 0' }}>
                    <Form layout="vertical">
                        <Form.Item label={<span style={{ fontWeight: 700, color: '#334155', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Roadmap Blueprint Name</span>} required>
                            <Input 
                                size="large"
                                placeholder="e.g. High Velocity Q3 Acceleration Roadmap" 
                                value={goalFormData.name}
                                onChange={e => setGoalFormData({ ...goalFormData, name: e.target.value })}
                                style={{ borderRadius: 10 }}
                            />
                        </Form.Item>

                        <Form.Item label={<span style={{ fontWeight: 700, color: '#334155', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Strategy Synopsis</span>}>
                            <TextArea 
                                rows={2}
                                placeholder="Document executive strategy objectives..."
                                value={goalFormData.description}
                                onChange={e => setGoalFormData({ ...goalFormData, description: e.target.value })}
                                style={{ borderRadius: 10 }}
                            />
                        </Form.Item>
                    </Form>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 4 }}>
                        <Text strong style={{ fontSize: 13, color: '#334155', letterSpacing: '-0.01em' }}>Pipeline Performance Triggers</Text>
                        <Button 
                            size="small" 
                            shape="round" 
                            icon={<Plus size={13} />} 
                            onClick={addSubGoal}
                            style={{ fontSize: 11, fontWeight: 600 }}
                        >
                            Add Metric Trigger
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
                                        placeholder="Measurement Objective" 
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
                                        <Option value="NONE">Metric Pipeline</Option>
                                        <OptGroup label="Revenue Hub">
                                            <Option value="GMS">GMS (₹)</Option>
                                            <Option value="ORDER_COUNT">Order Volume</Option>
                                            <Option value="CONVERSION_RATE">Conv. Rate %</Option>
                                        </OptGroup>
                                        <OptGroup label="Paid Acquisition">
                                            <Option value="ACOS">ACOS %</Option>
                                            <Option value="ADS_SPEND">Ads Spend (₹)</Option>
                                            <Option value="ROI">ROI Multipier</Option>
                                        </OptGroup>
                                        <OptGroup label="Catalog Index">
                                            <Option value="LISTING">Listing Opt. %</Option>
                                            <Option value="PRODUCTS_TO_LIST">Products Scale</Option>
                                            <Option value="LQS">Quality Index</Option>
                                        </OptGroup>
                                        <OptGroup label="Fulfillment & Margin">
                                            <Option value="PROFIT">Margin (₹)</Option>
                                            <Option value="PO_FULFILLMENT">PO Velocity %</Option>
                                        </OptGroup>
                                    </Select>
                                </div>
                                <div style={{ flex: 2 }}>
                                    <Input 
                                        type="number"
                                        placeholder="Baseline Goal" 
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
                                <div style={{ fontSize: 12, fontWeight: 500 }}>Establish roadmap metrics to evaluate execution baseline.</div>
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
                        <span style={{ fontWeight: 700 }}>AI Strategy Workbench</span>
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
                            Formulate automated blueprint pipelines instantly. Input your desired scaling intent (e.g., "Aggressive electronics expansion for festive quarter") and watch Antigravity draft the roadmap.
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
                            placeholder="Define operational blueprint parameters..."
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
                                Draft Pipeline
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
                                    <Tag color="indigo" style={{ borderRadius: 6, fontWeight: 700, fontSize: 9, marginBottom: 8 }}>STRATEGIC BLUEPRINT</Tag>
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
                                    Adopt Blueprint
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
                                        <Tag color="emerald" bordered={false} style={{ borderRadius: 6, fontWeight: 800, fontSize: 9 }}>AUTOMATED</Tag>
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
