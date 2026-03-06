import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import {
    Plus, Edit2, Trash2, Search, Clock, Check, Loader2, Tag, Zap, Sparkles, Target, Settings, LayoutTemplate
} from 'lucide-react';

const TemplateManagerPage = () => {
    // Shared State
    const [activeTab, setActiveTab] = useState('task'); // 'task' or 'goal'
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Task Templates State
    const [taskTemplates, setTaskTemplates] = useState([]);
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [currentTaskTemplate, setCurrentTaskTemplate] = useState(null);
    const [taskFormData, setTaskFormData] = useState({
        title: '', description: '', type: 'GENERAL', priority: 'MEDIUM', category: 'General', estimatedMinutes: 30
    });

    // Goal Templates State
    const [goalTemplates, setGoalTemplates] = useState([]);
    const [showGoalModal, setShowGoalModal] = useState(false);
    const [currentGoalTemplate, setCurrentGoalTemplate] = useState(null);
    const [goalFormData, setGoalFormData] = useState({
        name: '', description: '', goals: []
    });

    // Constants
    const categories = ['SEO & Content', 'Sales & Marketing', 'Operations & General', 'PPC & Advertising', 'Compliance & Legal'];
    const types = [
        { value: 'TITLE_OPTIMIZATION', label: 'Title SEO' },
        { value: 'A_PLUS_CONTENT', label: 'A+ Content' },
        { value: 'PRICING_STRATEGY', label: 'Pricing' },
        { value: 'INVENTORY_MANAGEMENT', label: 'Inventory' },
        { value: 'GENERAL_OPTIMIZATION', label: 'General' },
        { value: 'IMAGE_OPTIMIZATION', label: 'Images' },
        { value: 'DESCRIPTION_OPTIMIZATION', label: 'Description' }
    ];
    const priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
    const metrics = ['NONE', 'GMS', 'ACOS', 'ROI', 'PROFIT', 'CONVERSION_RATE', 'ORDER_COUNT'];

    // Data Fetching
    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const [taskRes, goalRes] = await Promise.all([
                db.getTaskTemplates(),
                db.getGoalTemplates()
            ]);
            if (taskRes?.success) setTaskTemplates(taskRes.data);
            if (goalRes?.success) setGoalTemplates(goalRes.data);
        } catch (error) {
            console.error('Failed to fetch templates:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchTemplates(); }, []);

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
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (currentTaskTemplate) await db.updateTemplate(currentTaskTemplate._id, taskFormData);
            else await db.createTemplate(taskFormData);
            await fetchTemplates();
            setShowTaskModal(false);
        } catch (error) {
            alert('Failed to save task template.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteTask = async (id) => {
        if (!window.confirm('Are you sure you want to delete this task template?')) return;
        try {
            await db.deleteTemplate(id);
            await fetchTemplates();
        } catch (error) {
            alert('Failed to delete task template.');
        }
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
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const cleanedGoals = goalFormData.goals.filter(g => g.title.trim() !== '');
            const payload = { ...goalFormData, goals: cleanedGoals };

            if (currentGoalTemplate) await db.updateGoalTemplate(currentGoalTemplate._id, payload);
            else await db.createGoalTemplate(payload);
            await fetchTemplates();
            setShowGoalModal(false);
        } catch (error) {
            alert('Failed to save goal template.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteGoal = async (id) => {
        if (!window.confirm('Are you sure you want to delete this goal template?')) return;
        try {
            await db.deleteGoalTemplate(id);
            await fetchTemplates();
        } catch (error) {
            alert('Failed to delete goal template.');
        }
    };

    // Sub-goal management
    const addSubGoal = () => {
        setGoalFormData(prev => ({ ...prev, goals: [...prev.goals, { title: '', metric: 'NONE', targetValue: '' }] }));
    };
    const updateSubGoal = (index, field, value) => {
        const newGoals = [...goalFormData.goals];
        newGoals[index][field] = value;
        setGoalFormData(prev => ({ ...prev, goals: newGoals }));
    };
    const removeSubGoal = (index) => {
        const newGoals = [...goalFormData.goals];
        newGoals.splice(index, 1);
        setGoalFormData(prev => ({ ...prev, goals: newGoals }));
    };

    // Search Filtering
    const filteredTasks = taskTemplates.filter(t => t.title?.toLowerCase().includes(searchTerm.toLowerCase()) || t.category?.toLowerCase().includes(searchTerm.toLowerCase()));
    const filteredGoals = goalTemplates.filter(t => t.name?.toLowerCase().includes(searchTerm.toLowerCase()));

    const getPriorityBadge = (p) => {
        switch (p) {
            case 'URGENT': return { bg: '#fee2e2', color: '#ef4444' };
            case 'HIGH': return { bg: '#fef3c7', color: '#f59e0b' };
            case 'MEDIUM': return { bg: '#dbeafe', color: '#3b82f6' };
            default: return { bg: '#f3f4f6', color: '#6b7280' };
        }
    };

    return (
        <div className="container-fluid py-4 min-vh-100" style={{ backgroundColor: '#f8fafc' }}>
            {/* Action Header */}
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div className="d-flex align-items-center gap-3">
                    <div className="p-2 rounded-3 shadow-sm" style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)', color: 'white' }}>
                        <LayoutTemplate size={24} />
                    </div>
                    <div>
                        <h4 className="fw-bold text-dark mb-0" style={{ letterSpacing: '-0.02em' }}>Template Manager</h4>
                        <p className="text-muted small mb-0 mt-1">Configure automated workflows, actions, and roadmaps.</p>
                    </div>
                </div>
                <button
                    className="btn btn-primary d-flex align-items-center gap-2 shadow-sm rounded-pill px-4 fw-bold"
                    onClick={() => activeTab === 'task' ? handleOpenTaskModal() : handleOpenGoalModal()}
                    style={{ background: '#4F46E5', border: 'none' }}
                >
                    <Plus size={16} />
                    {activeTab === 'task' ? 'Create Task Outline' : 'Create Roadmap'}
                </button>
            </div>

            {/* Quick Stats / Overview row */}
            <div className="row g-3 mb-4">
                <div className="col-md-3">
                    <div className="card border-0 shadow-sm h-100" style={{ borderRadius: '16px' }}>
                        <div className="card-body p-4 d-flex align-items-center gap-3">
                            <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: '48px', height: '48px', backgroundColor: '#eef2ff', color: '#4f46e5' }}>
                                <Zap size={20} />
                            </div>
                            <div>
                                <h3 className="fw-bold mb-0 text-dark">{taskTemplates.length}</h3>
                                <p className="text-muted small fw-medium mb-0 text-uppercase" style={{ letterSpacing: '0.05em', fontSize: '10px' }}>Task Templates</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="col-md-3">
                    <div className="card border-0 shadow-sm h-100" style={{ borderRadius: '16px' }}>
                        <div className="card-body p-4 d-flex align-items-center gap-3">
                            <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: '48px', height: '48px', backgroundColor: '#ecfdf5', color: '#10b981' }}>
                                <Target size={20} />
                            </div>
                            <div>
                                <h3 className="fw-bold mb-0 text-dark">{goalTemplates.length}</h3>
                                <p className="text-muted small fw-medium mb-0 text-uppercase" style={{ letterSpacing: '0.05em', fontSize: '10px' }}>Goal Roadmaps</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs & Search integration */}
                <div className="col-md-6">
                    <div className="card border-0 shadow-sm h-100" style={{ borderRadius: '16px' }}>
                        <div className="card-body p-3 d-flex flex-column justify-content-center">
                            <div className="d-flex align-items-center justify-content-between p-1 bg-light rounded-pill mb-3">
                                <button
                                    onClick={() => setActiveTab('task')}
                                    className={`btn rounded-pill flex-fill fw-bold border-0 ${activeTab === 'task' ? 'bg-white shadow-sm text-primary' : 'text-muted'}`}
                                    style={{ fontSize: '13px', padding: '8px 16px', transition: 'all 0.2s' }}
                                >
                                    Task Templates
                                </button>
                                <button
                                    onClick={() => setActiveTab('goal')}
                                    className={`btn rounded-pill flex-fill fw-bold border-0 ${activeTab === 'goal' ? 'bg-white shadow-sm text-primary' : 'text-muted'}`}
                                    style={{ fontSize: '13px', padding: '8px 16px', transition: 'all 0.2s' }}
                                >
                                    Goal Roadmaps
                                </button>
                            </div>

                            <div className="input-group input-group-sm">
                                <span className="input-group-text bg-white border-end-0 rounded-start-pill ps-3 text-muted"><Search size={14} /></span>
                                <input
                                    type="text"
                                    className="form-control border-start-0 rounded-end-pill ps-2"
                                    placeholder={`Search ${activeTab === 'task' ? 'task models' : 'presets'}...`}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    style={{ boxShadow: 'none', fontSize: '13px', backgroundColor: '#fff' }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Table */}
            <div className="card border-0 shadow-sm overflow-hidden" style={{ borderRadius: '16px' }}>
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0" style={{ minWidth: '800px' }}>
                        <thead style={{ backgroundColor: '#f9fafb' }}>
                            <tr>
                                {activeTab === 'task' ? (
                                    <>
                                        <th style={headerStyle}>Task Details</th>
                                        <th style={headerStyle}>Process Type</th>
                                        <th style={headerStyle}>Target Category</th>
                                        <th style={headerStyle}>Priority</th>
                                        <th style={headerStyle} className="text-end pe-4">Manage</th>
                                    </>
                                ) : (
                                    <>
                                        <th style={headerStyle}>Roadmap Details</th>
                                        <th style={headerStyle}>Metrics Tracked</th>
                                        <th style={headerStyle} className="text-end pe-4">Manage</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="bg-white border-top-0">
                            {loading ? (
                                <tr><td colSpan="5" className="text-center py-5"><Loader2 className="animate-spin text-primary" size={24} /></td></tr>
                            ) : activeTab === 'task' ? (
                                filteredTasks.length === 0 ? <tr><td colSpan="5" className="text-center py-5 text-muted small">No task configurations found.</td></tr> :
                                    filteredTasks.map(t => {
                                        const priorityRender = getPriorityBadge(t.priority);
                                        return (
                                            <tr key={t._id}>
                                                <td className="ps-4 py-3 border-light opacity-75">
                                                    <div className="fw-bold text-dark fs-6" style={{ letterSpacing: '-0.01em' }}>{t.title}</div>
                                                    <div className="small text-muted text-truncate mt-1" style={{ maxWidth: '350px' }}>{t.description || 'No description provided'}</div>
                                                </td>
                                                <td className="py-3 border-light">
                                                    <div className="d-flex align-items-center gap-2 small fw-medium" style={{ color: '#4b5563' }}>
                                                        <Settings size={14} />
                                                        {types.find(type => type.value === t.type)?.label || t.type}
                                                    </div>
                                                </td>
                                                <td className="py-3 border-light">
                                                    <span className="badge rounded-pill fw-medium" style={{ backgroundColor: '#f1f5f9', color: '#64748b', fontSize: '11px', border: '1px solid #e2e8f0' }}>
                                                        {t.category}
                                                    </span>
                                                </td>
                                                <td className="py-3 border-light">
                                                    <span className="badge rounded-pill" style={{ backgroundColor: priorityRender.bg, color: priorityRender.color, fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em' }}>
                                                        {t.priority}
                                                    </span>
                                                </td>
                                                <td className="py-3 text-end pe-4 border-light">
                                                    <div className="d-flex justify-content-end gap-2">
                                                        <button className="btn btn-sm btn-light rounded-circle shadow-sm" style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => handleOpenTaskModal(t)}>
                                                            <Edit2 size={14} className="text-primary" />
                                                        </button>
                                                        <button className="btn btn-sm btn-light rounded-circle shadow-sm text-danger" style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => handleDeleteTask(t._id)}>
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })
                            ) : (
                                filteredGoals.length === 0 ? <tr><td colSpan="3" className="text-center py-5 text-muted small">No roadmaps created yet.</td></tr> :
                                    filteredGoals.map(t => (
                                        <tr key={t._id}>
                                            <td className="ps-4 py-3 border-light">
                                                <div className="fw-bold text-dark fs-6" style={{ letterSpacing: '-0.01em' }}>{t.name}</div>
                                                <div className="small text-muted text-truncate mt-1" style={{ maxWidth: '450px' }}>{t.description || 'No description provided'}</div>
                                            </td>
                                            <td className="py-3 border-light">
                                                <div className="d-flex flex-wrap gap-1">
                                                    {t.goals?.slice(0, 3).map((g, i) => (
                                                        <span key={i} className="badge rounded-pill bg-light text-dark fw-medium border" style={{ fontSize: '11px' }}>
                                                            {g.metric.replace('_', ' ')}
                                                        </span>
                                                    ))}
                                                    {t.goals?.length > 3 && (
                                                        <span className="badge rounded-pill bg-light text-muted fw-bold border" style={{ fontSize: '11px' }}>
                                                            +{t.goals.length - 3} more
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-3 text-end pe-4 border-light">
                                                <div className="d-flex justify-content-end gap-2">
                                                    <button className="btn btn-sm btn-light rounded-circle shadow-sm" style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => handleOpenGoalModal(t)}>
                                                        <Edit2 size={14} className="text-primary" />
                                                    </button>
                                                    <button className="btn btn-sm btn-light rounded-circle shadow-sm text-danger" style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => handleDeleteGoal(t._id)}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Task Template Modal */}
            {showTaskModal && (
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(2px)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px', overflow: 'hidden' }}>
                            <div className="modal-header bg-light border-0 px-4 py-3">
                                <h5 className="modal-title fw-bold text-dark" style={{ fontSize: '1.1rem' }}>
                                    {currentTaskTemplate ? 'Edit Task Process' : 'New Task Process'}
                                </h5>
                                <button onClick={() => setShowTaskModal(false)} className="btn-close shadow-none"></button>
                            </div>
                            <form onSubmit={handleTaskSubmit}>
                                <div className="modal-body p-4 bg-white">
                                    <div className="mb-3">
                                        <label className="form-label small fw-bold text-uppercase text-muted" style={{ letterSpacing: '0.05em', fontSize: '11px' }}>Task Name</label>
                                        <input type="text" className="form-control" style={{ borderRadius: '10px' }} value={taskFormData.title} onChange={(e) => setTaskFormData({ ...taskFormData, title: e.target.value })} required />
                                    </div>
                                    <div className="mb-4">
                                        <label className="form-label small fw-bold text-uppercase text-muted" style={{ letterSpacing: '0.05em', fontSize: '11px' }}>Process Steps / Guidelines</label>
                                        <textarea className="form-control" rows="3" style={{ borderRadius: '10px' }} value={taskFormData.description} onChange={(e) => setTaskFormData({ ...taskFormData, description: e.target.value })} required></textarea>
                                    </div>
                                    <div className="row g-3 mb-3">
                                        <div className="col-md-6">
                                            <label className="form-label small fw-bold text-uppercase text-muted" style={{ letterSpacing: '0.05em', fontSize: '11px' }}>Department/Category</label>
                                            <select className="form-select" style={{ borderRadius: '10px' }} value={taskFormData.category} onChange={(e) => setTaskFormData({ ...taskFormData, category: e.target.value })}>
                                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label small fw-bold text-uppercase text-muted" style={{ letterSpacing: '0.05em', fontSize: '11px' }}>Action Type</label>
                                            <select className="form-select" style={{ borderRadius: '10px' }} value={taskFormData.type} onChange={(e) => setTaskFormData({ ...taskFormData, type: e.target.value })}>
                                                {types.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="row g-3">
                                        <div className="col-md-6">
                                            <label className="form-label small fw-bold text-uppercase text-muted" style={{ letterSpacing: '0.05em', fontSize: '11px' }}>Initial Priority</label>
                                            <select className="form-select" style={{ borderRadius: '10px' }} value={taskFormData.priority} onChange={(e) => setTaskFormData({ ...taskFormData, priority: e.target.value })}>
                                                {priorities.map(p => <option key={p} value={p}>{p}</option>)}
                                            </select>
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label small fw-bold text-uppercase text-muted" style={{ letterSpacing: '0.05em', fontSize: '11px' }}>Estimate (Minutes)</label>
                                            <div className="input-group">
                                                <input type="number" className="form-control" style={{ borderStartStartRadius: '10px', borderEndStartRadius: '10px' }} value={taskFormData.estimatedMinutes} onChange={(e) => setTaskFormData({ ...taskFormData, estimatedMinutes: parseInt(e.target.value) || 0 })} />
                                                <span className="input-group-text bg-light text-muted" style={{ borderStartEndRadius: '10px', borderEndEndRadius: '10px' }}><Clock size={16} /></span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer bg-light border-0 px-4 py-3">
                                    <button type="button" className="btn btn-outline-secondary rounded-pill px-4" onClick={() => setShowTaskModal(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary rounded-pill px-4 border-0 d-flex align-items-center gap-2" style={{ background: '#4F46E5' }} disabled={isSubmitting}>
                                        {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                                        {currentTaskTemplate ? 'Update Process' : 'Save Process'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Goal Template Modal */}
            {showGoalModal && (
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(2px)' }}>
                    <div className="modal-dialog modal-lg modal-dialog-centered">
                        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px', overflow: 'hidden' }}>
                            <div className="modal-header bg-light border-0 px-4 py-3">
                                <h5 className="modal-title fw-bold text-dark" style={{ fontSize: '1.1rem' }}>
                                    {currentGoalTemplate ? 'Edit Roadmap' : 'New Roadmap Settings'}
                                </h5>
                                <button onClick={() => setShowGoalModal(false)} className="btn-close shadow-none"></button>
                            </div>
                            <form onSubmit={handleGoalSubmit}>
                                <div className="modal-body p-4 bg-white">
                                    <div className="mb-3">
                                        <label className="form-label small fw-bold text-uppercase text-muted" style={{ letterSpacing: '0.05em', fontSize: '11px' }}>Roadmap Title</label>
                                        <input type="text" className="form-control" style={{ borderRadius: '10px' }} placeholder="e.g. Q4 Elite Growth Protocol" value={goalFormData.name} onChange={(e) => setGoalFormData({ ...goalFormData, name: e.target.value })} required />
                                    </div>
                                    <div className="mb-4">
                                        <label className="form-label small fw-bold text-uppercase text-muted" style={{ letterSpacing: '0.05em', fontSize: '11px' }}>Executive Summary</label>
                                        <textarea className="form-control" rows="2" style={{ borderRadius: '10px' }} placeholder="Outline the success criteria..." value={goalFormData.description} onChange={(e) => setGoalFormData({ ...goalFormData, description: e.target.value })}></textarea>
                                    </div>

                                    <div className="d-flex justify-content-between align-items-center mb-3">
                                        <h6 className="fw-bold mb-0 text-dark">Trackable Metrics & Goals</h6>
                                        <button type="button" className="btn btn-sm btn-light fw-medium d-flex align-items-center gap-1 rounded-pill px-3 shadow-sm border" onClick={addSubGoal}>
                                            <Plus size={14} /> Add Metric
                                        </button>
                                    </div>

                                    <div className="bg-light p-3 border" style={{ borderRadius: '12px' }}>
                                        {goalFormData.goals.map((g, idx) => (
                                            <div key={idx} className="row g-2 mb-2 align-items-center bg-white p-2 rounded border shadow-sm mx-0">
                                                <div className="col-md-5">
                                                    <input type="text" className="form-control form-control-sm border-0 bg-light" placeholder="Measurement Title" value={g.title} onChange={(e) => updateSubGoal(idx, 'title', e.target.value)} required />
                                                </div>
                                                <div className="col-md-3">
                                                    <select className="form-select form-select-sm border-0 bg-light fw-medium text-muted" value={g.metric} onChange={(e) => updateSubGoal(idx, 'metric', e.target.value)}>
                                                        {metrics.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                                                    </select>
                                                </div>
                                                <div className="col-md-3">
                                                    <input type="number" className="form-control form-control-sm border-0 bg-light" placeholder="Baseline Target" value={g.targetValue || ''} onChange={(e) => updateSubGoal(idx, 'targetValue', e.target.value)} />
                                                </div>
                                                <div className="col-md-1 text-center">
                                                    <button type="button" className="btn btn-icon btn-sm text-danger" onClick={() => removeSubGoal(idx)}><Trash2 size={16} /></button>
                                                </div>
                                            </div>
                                        ))}
                                        {goalFormData.goals.length === 0 && (
                                            <div className="text-center text-muted small py-4 fw-medium">
                                                Start adding focus areas to build out your roadmap.
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="modal-footer bg-light border-0 px-4 py-3">
                                    <button type="button" className="btn btn-outline-secondary rounded-pill px-4" onClick={() => setShowGoalModal(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary rounded-pill px-4 border-0 d-flex align-items-center gap-2" style={{ background: '#4F46E5' }} disabled={isSubmitting}>
                                        {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                                        {currentGoalTemplate ? 'Save Changes' : 'Publish Roadmap'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const headerStyle = {
    color: '#64748b',
    fontWeight: 700,
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: '12px 16px',
    borderBottom: '2px solid #e2e8f0',
    borderTop: 'none'
};

export default TemplateManagerPage;
