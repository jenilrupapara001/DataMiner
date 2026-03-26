import React, { useState, useEffect } from 'react';
import { X, Save, Calendar, User, Tag, AlertCircle, CheckCircle, ThumbsUp, ThumbsDown, ChevronRight, ChevronLeft, Check, Search } from 'lucide-react';
import ActionChat from './ActionChat';
import { db } from '../../services/db';
import './ActionModal.css';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const ActionModal = ({ action, isOpen, onClose, onSave, asins = [], users = [], sellers = [], actions = [], onNavigateToAction, initialKeyResultId = null }) => {
    const [messages, setMessages] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState('');
    const [activeTab, setActiveTab] = useState('details');
    const [currentStep, setCurrentStep] = useState(1);
    const [showGoalSettings, setShowGoalSettings] = useState(false);
    const [asinSearch, setAsinSearch] = useState('');

    // ... (rest of the state and handlers remain the same) ...
    // RESTORED FORM STATE
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        type: 'TITLE_OPTIMIZATION',
        priority: 'MEDIUM',
        status: 'PENDING',
        asins: [],
        assignedTo: '',
        startDate: '',
        deadline: '',
        keyResultId: initialKeyResultId || '',
        measurementMetric: 'NONE',
        scopeType: 'ASIN', // 'BRAND' | 'ASIN'
        scopeIds: [],
        impactWeight: 5,
        expectedImpact: { metric: 'GMS', value: 0 },
        aiReason: '',
        aiGenerated: false,
        goalSettings: {
            targetValue: '',
            timeframe: 1,
            frequency: 'MONTHLY',
            isGoalPrimary: false
        }
    });

    // Fetch templates
    useEffect(() => {
        const fetchTemplates = async () => {
            try {
                const res = await db.getTaskTemplates();
                if (res && res.success && Array.isArray(res.data)) {
                    setTemplates(res.data);
                } else if (Array.isArray(res)) {
                    setTemplates(res);
                } else {
                    console.error("Invalid templates data format:", res);
                    setTemplates([]);
                }
            } catch (err) {
                console.error("Failed to fetch templates:", err);
                setTemplates([]);
            }
        };
        if (isOpen) fetchTemplates();
    }, [isOpen]);

    // RESTORED EFFECT FOR FORM DATA SYNC
    useEffect(() => {
        if (action) {
            setFormData({
                title: action.title || '',
                description: action.description || '',
                type: action.type || 'TITLE_OPTIMIZATION',
                priority: action.priority || 'MEDIUM',
                status: action.status || 'PENDING',
                asins: action.asins?.map(a => a._id || a) || [],
                assignedTo: action.assignedTo?._id || action.assignedTo || action.assignee || '',
                startDate: (action.timeTracking?.startDate || action.startDate) ? new Date(action.timeTracking?.startDate || action.startDate) : null,
                deadline: (action.timeTracking?.deadline || action.deadline || action.dueDate) ? new Date(action.timeTracking?.deadline || action.deadline || action.dueDate) : null,
                recurring: action.recurring || { enabled: false, frequency: 'WEEKLY', daysOfWeek: [] },
                keyResultId: action.keyResultId || initialKeyResultId || '',
                measurementMetric: action.expectedImpact?.metric || 'NONE',
                scopeType: action.scopeType || 'ASIN',
                scopeIds: action.scopeIds || [],
                impactWeight: action.impactWeight || 5,
                expectedImpact: action.expectedImpact || { metric: 'GMS', value: 0 },
                aiReason: action.aiReason || action.aiReasoning || '',
                aiGenerated: action.aiGenerated || action.isAIGenerated || false,
                goalSettings: {
                    targetValue: action.goalSettings?.targetValue || '',
                    timeframe: action.goalSettings?.timeframe || 1,
                    frequency: action.goalSettings?.frequency || 'MONTHLY',
                    isGoalPrimary: action.goalSettings?.isGoalPrimary || false
                }
            });
        }
        setSelectedTemplate('');
        setCurrentStep(1);
        setShowGoalSettings(false);
    }, [action, isOpen, initialKeyResultId]);

    // Handle Template Change
    const handleTemplateChange = (templateId) => {
        setSelectedTemplate(templateId);
        if (!templateId) return;

        const template = templates.find(t => (t._id || t.id) === templateId);
        if (template) {
            setFormData(prev => ({
                ...prev,
                title: template.title,
                description: template.description,
                type: template.type,
                priority: template.priority || prev.priority
            }));
        }
    };

    // RESTORED HANDLERS
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const submissionData = {
            ...formData,
            _id: action?._id,
            timeTracking: {
                ...action?.timeTracking,
                startDate: formData.startDate,
                deadline: formData.deadline
            }
        };
        onSave(submissionData);
    };

    useEffect(() => {
        if (action?.messages) {
            setMessages(action.messages);
        } else {
            setMessages([]);
        }
    }, [action]);

    const handleSendMessage = async (content) => {
        try {
            const result = await db.addMessage(action._id || action.id, content);

            if (result.success) {
                const newMessage = result.data;
                setMessages(prev => [...prev, newMessage]);
            }
        } catch (error) {
            console.error("Failed to send message", error);
        }
    };

    // Step indicator component
    const StepIndicator = () => (
        <div className="d-flex align-items-center justify-content-center mb-4">
            <div className="d-flex align-items-center">
                {/* Step 1 */}
                <div className="d-flex align-items-center">
                    <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: currentStep >= 1 ? 'var(--color-brand-600)' : 'var(--color-surface-2)',
                        color: currentStep >= 1 ? '#fff' : 'var(--color-text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 600,
                        fontSize: '14px',
                        transition: 'all 200ms'
                    }}>
                        {currentStep > 1 ? <Check size={16} /> : '1'}
                    </div>
                    <span style={{
                        marginLeft: '8px',
                        fontWeight: currentStep === 1 ? 600 : 400,
                        color: currentStep === 1 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                        fontSize: '14px'
                    }}>
                        Task Details
                    </span>
                </div>

                {/* Connector */}
                <div style={{
                    width: '80px',
                    height: '2px',
                    backgroundColor: currentStep > 1 ? 'var(--color-brand-600)' : 'var(--color-border)',
                    margin: '0 12px'
                }} />

                {/* Step 2 */}
                <div className="d-flex align-items-center">
                    <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: currentStep >= 2 ? 'var(--color-brand-600)' : 'var(--color-surface-2)',
                        color: currentStep >= 2 ? '#fff' : 'var(--color-text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 600,
                        fontSize: '14px',
                        transition: 'all 200ms'
                    }}>
                        {currentStep > 2 ? <Check size={16} /> : '2'}
                    </div>
                    <span style={{
                        marginLeft: '8px',
                        fontWeight: currentStep === 2 ? 600 : 400,
                        color: currentStep === 2 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                        fontSize: '14px'
                    }}>
                        Assignment
                    </span>
                </div>
            </div>
        </div>
    );

    // Priority pill buttons
    const PriorityPills = () => (
        <div className="d-flex gap-2">
            {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map(p => (
                <button
                    key={p}
                    type="button"
                    onClick={() => setFormData({ ...formData, priority: p })}
                    style={{
                        padding: '8px 16px',
                        borderRadius: '20px',
                        border: formData.priority === p ? 'none' : '1px solid var(--color-border)',
                        backgroundColor: formData.priority === p
                            ? p === 'LOW' ? 'var(--color-neutral-500)'
                                : p === 'MEDIUM' ? 'var(--color-brand-500)'
                                    : p === 'HIGH' ? 'var(--color-warning-500)'
                                        : 'var(--color-danger-500)'
                            : 'transparent',
                        color: formData.priority === p ? '#fff' : 'var(--color-text-secondary)',
                        fontWeight: 600,
                        fontSize: '12px',
                        cursor: 'pointer',
                        transition: 'all 150ms'
                    }}
                >
                    {p}
                </button>
            ))}
        </div>
    );

    // Status dropdown with colored dots
    const StatusDropdown = () => {
        const statusColors = {
            'PENDING': 'var(--color-neutral-500)',
            'IN_PROGRESS': 'var(--color-brand-500)',
            'REVIEW': 'var(--color-warning-500)',
            'COMPLETED': 'var(--color-success-500)',
            'CANCELLED': 'var(--color-neutral-400)'
        };

        return (
            <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-surface-0)',
                    fontWeight: 500,
                    fontSize: '14px',
                    color: 'var(--color-text-primary)'
                }}
            >
                <option value="PENDING">
                    <span style={{ color: statusColors.PENDING }}>●</span> Pending
                </option>
                <option value="IN_PROGRESS">● In Progress</option>
                <option value="REVIEW">● Needs Review</option>
                <option value="COMPLETED">● Completed</option>
                <option value="CANCELLED">● Cancelled</option>
            </select>
        );
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-dialog modal-xl" onClick={(e) => e.stopPropagation()}>
                <div className="modal-content action-modal-content border-0">
                    <div className="action-modal-header py-3 px-4 bg-white border-bottom">
                        <div className="action-header-info">
                            <div className={`p-2 rounded-3 bg-soft-${formData.priority === 'HIGH' || formData.priority === 'URGENT' ? 'danger' : 'primary'}`}>
                                <Tag size={24} className={formData.priority === 'HIGH' || formData.priority === 'URGENT' ? 'text-danger' : 'text-primary'} />
                            </div>
                            <div>
                                <h1 className="action-modal-title">{action ? formData.title : 'New Task'}</h1>
                                <div className="d-flex align-items-center gap-2 mt-1">
                                    <span className={`badge ${formData.status === 'COMPLETED' ? 'bg-success' : 'bg-primary'} rounded-pill px-3`}>
                                        {formData.status.replace('_', ' ')}
                                    </span>
                                    <span className="text-muted small">• Created {action ? new Date(action.createdAt).toLocaleDateString() : 'Just now'}</span>
                                </div>
                            </div>
                        </div>
                        <button type="button" className="btn btn-icon btn-light rounded-circle shadow-sm" onClick={onClose}>
                            <X size={20} />
                        </button>
                    </div>

                    {/* Tabs - only show Discussion tab when editing */}
                    {action && (
                        <div className="action-modal-tabs px-4">
                            <button
                                className={`action-tab-btn ${activeTab === 'details' ? 'active' : ''}`}
                                onClick={() => setActiveTab('details')}
                            >
                                {action ? 'Task Overview' : 'New Task'}
                            </button>
                            <button
                                className={`action-tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
                                onClick={() => setActiveTab('chat')}
                            >
                                Discussion & Activity
                                {messages.length > 0 && <span className="ms-2 badge bg-soft-primary text-primary rounded-pill">{messages.length}</span>}
                            </button>
                        </div>
                    )}

                    <div className="action-modal-body bg-light">
                        {activeTab === 'details' ? (
                            <form onSubmit={handleSubmit} className="p-4">
                                {/* Step Indicator */}
                                <StepIndicator />

                                {/* Step 1: Task Details */}
                                {currentStep === 1 && (
                                    <div className="animate-fadeIn">
                                        <div className="row g-4">
                                            {/* Task Title - Full Width */}
                                            <div className="col-12">
                                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px', color: 'var(--color-text-primary)' }}>
                                                    Task Title
                                                </label>
                                                <input
                                                    type="text"
                                                    name="title"
                                                    value={formData.title}
                                                    onChange={handleChange}
                                                    required
                                                    style={{
                                                        width: '100%',
                                                        padding: '12px 16px',
                                                        borderRadius: 'var(--radius-md)',
                                                        border: '1px solid var(--color-border)',
                                                        fontSize: '16px',
                                                        fontWeight: 600,
                                                        color: 'var(--color-text-primary)',
                                                        backgroundColor: 'var(--color-surface-0)'
                                                    }}
                                                    placeholder="What needs to be done?"
                                                />
                                            </div>

                                            {/* Description */}
                                            <div className="col-12">
                                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px', color: 'var(--color-text-primary)' }}>
                                                    Description / Instructions
                                                </label>
                                                <textarea
                                                    name="description"
                                                    value={formData.description}
                                                    onChange={handleChange}
                                                    rows="4"
                                                    style={{
                                                        width: '100%',
                                                        padding: '12px 16px',
                                                        borderRadius: 'var(--radius-md)',
                                                        border: '1px solid var(--color-border)',
                                                        fontSize: '14px',
                                                        color: 'var(--color-text-primary)',
                                                        backgroundColor: 'var(--color-surface-0)',
                                                        resize: 'vertical'
                                                    }}
                                                    placeholder="Provide detailed instructions or context for this task..."
                                                />
                                            </div>

                                            {/* Task Classification - Side by Side */}
                                            <div className="col-md-6">
                                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px', color: 'var(--color-text-primary)' }}>
                                                    Task Type
                                                </label>
                                                <select
                                                    name="type"
                                                    value={formData.type}
                                                    onChange={handleChange}
                                                    style={{
                                                        width: '100%',
                                                        padding: '10px 12px',
                                                        borderRadius: 'var(--radius-md)',
                                                        border: '1px solid var(--color-border)',
                                                        fontSize: '14px',
                                                        fontWeight: 500,
                                                        color: 'var(--color-text-primary)',
                                                        backgroundColor: 'var(--color-surface-0)'
                                                    }}
                                                >
                                                    <option value="TITLE_OPTIMIZATION">Title Optimization</option>
                                                    <option value="DESCRIPTION_OPTIMIZATION">Description Optimization</option>
                                                    <option value="IMAGE_OPTIMIZATION">Image Optimization</option>
                                                    <option value="BULLET_POINTS">Bullet Points</option>
                                                    <option value="A_PLUS_CONTENT">A+ Content</option>
                                                    <option value="GENERAL_OPTIMIZATION">General Optimization</option>
                                                </select>
                                            </div>

                                            <div className="col-md-6">
                                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px', color: 'var(--color-text-primary)' }}>
                                                    Measurement Metric
                                                </label>
                                                <select
                                                    name="measurementMetric"
                                                    value={formData.measurementMetric}
                                                    onChange={handleChange}
                                                    style={{
                                                        width: '100%',
                                                        padding: '10px 12px',
                                                        borderRadius: 'var(--radius-md)',
                                                        border: '1px solid var(--color-border)',
                                                        fontSize: '14px',
                                                        color: 'var(--color-text-primary)',
                                                        backgroundColor: 'var(--color-surface-0)'
                                                    }}
                                                >
                                                    <option value="NONE">No Specific Metric</option>
                                                    <option value="GMS">GMS (Gross Merchandise Sales)</option>
                                                    <option value="ACOS">ACOS (Advertising Cost of Sales)</option>
                                                    <option value="ROI">ROI (Return on Investment)</option>
                                                    <option value="PROFIT">Profit</option>
                                                    <option value="CONVERSION_RATE">Conversion Rate</option>
                                                    <option value="ORDER_COUNT">Order Count</option>
                                                </select>
                                            </div>

                                            {/* Priority Selector */}
                                            <div className="col-12">
                                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px', color: 'var(--color-text-primary)' }}>
                                                    Priority
                                                </label>
                                                <PriorityPills />
                                            </div>

                                            {/* Status Selector */}
                                            <div className="col-12">
                                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px', color: 'var(--color-text-primary)' }}>
                                                    Status
                                                </label>
                                                <StatusDropdown />
                                            </div>

                                            {/* [GROWTH ENGINE] AI REASONING & IMPACT */}
                                            {formData.aiGenerated && (
                                                <div className="col-12">
                                                    <div className="p-3 rounded-3" style={{ backgroundColor: '#F0F9FF', border: '1px solid #BAE6FD' }}>
                                                        <div className="d-flex align-items-center gap-2 mb-2">
                                                            <AlertCircle size={16} className="text-info" />
                                                            <span className="fw-700 text-info small uppercase" style={{ letterSpacing: '0.05em' }}>AI STRATEGIC REASONING</span>
                                                        </div>
                                                        <p className="mb-0 text-zinc-700 small italic">"{formData.aiReason}"</p>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="col-md-6">
                                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px', color: 'var(--color-text-primary)' }}>
                                                    Expected Impact Value (%)
                                                </label>
                                                <div className="d-flex align-items-center gap-2">
                                                    <input
                                                        type="number"
                                                        value={formData.expectedImpact?.value || 0}
                                                        onChange={(e) => setFormData({ 
                                                            ...formData, 
                                                            expectedImpact: { ...formData.expectedImpact, value: parseFloat(e.target.value) } 
                                                        })}
                                                        className="form-control"
                                                        style={{ borderRadius: '12px' }}
                                                    />
                                                    <span className="text-muted fw-bold">%</span>
                                                </div>
                                            </div>

                                            <div className="col-md-6">
                                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px', color: 'var(--color-text-primary)' }}>
                                                    Impact Weight (1-10)
                                                </label>
                                                <input
                                                    type="range"
                                                    min="1"
                                                    max="10"
                                                    value={formData.impactWeight || 5}
                                                    onChange={(e) => setFormData({ ...formData, impactWeight: parseInt(e.target.value) })}
                                                    className="form-range"
                                                />
                                                <div className="d-flex justify-content-between text-muted x-small">
                                                    <span>Low Impact</span>
                                                    <span className="fw-bold text-primary">{formData.impactWeight}</span>
                                                    <span>Critical</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Step 1 CTA */}
                                        <div className="d-flex justify-content-end mt-4 pt-3 border-top">
                                            <button
                                                type="button"
                                                onClick={() => setCurrentStep(2)}
                                                className="btn btn-primary px-4 py-2 d-flex align-items-center gap-2"
                                                style={{ fontWeight: 600 }}
                                            >
                                                Continue to Assignment
                                                <ChevronRight size={18} />
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Step 2: Assignment & Schedule */}
                                {currentStep === 2 && (
                                    <div className="animate-fadeIn">
                                        <div className="row g-4">
                                            {/* Assigned To */}
                                            <div className="col-12">
                                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px', color: 'var(--color-text-primary)' }}>
                                                    Assigned To
                                                </label>
                                                <select
                                                    name="assignedTo"
                                                    value={formData.assignedTo}
                                                    onChange={handleChange}
                                                    style={{
                                                        width: '100%',
                                                        padding: '10px 12px',
                                                        borderRadius: 'var(--radius-md)',
                                                        border: '1px solid var(--color-border)',
                                                        fontSize: '14px',
                                                        color: 'var(--color-text-primary)',
                                                        backgroundColor: 'var(--color-surface-0)'
                                                    }}
                                                >
                                                    <option value="">Unassigned</option>
                                                    {/* Group users by their assigned seller */}
                                                    {(() => {
                                                        const sellerMap = {};
                                                        const noSeller = [];

                                                        users.forEach(u => {
                                                            const userSellerId = u.sellerId?._id || u.sellerId;
                                                            if (userSellerId) {
                                                                if (!sellerMap[userSellerId]) {
                                                                    const sellerData = sellers.find(s => (s._id || s.id) === userSellerId || (s._id || s.id)?.toString() === userSellerId?.toString());
                                                                    sellerMap[userSellerId] = { seller: sellerData, users: [] };
                                                                }
                                                                sellerMap[userSellerId].users.push(u);
                                                            } else {
                                                                noSeller.push(u);
                                                            }
                                                        });

                                                        const groups = Object.values(sellerMap);

                                                        return (
                                                            <>
                                                                {groups.map((group, idx) => {
                                                                    const managerNames = group.seller?.managers && group.seller.managers.length > 0
                                                                        ? group.seller.managers.map(m => `${m.firstName} ${m.lastName}`).join(', ')
                                                                        : null;
                                                                    return (
                                                                        <optgroup key={idx} label={group.seller ? `${group.seller.name} (${group.seller.marketplace})${managerNames ? ` — Mgr: ${managerNames}` : ''}` : 'Seller Account'}>
                                                                            {group.users.map(u => (
                                                                                <option key={u.id || u._id} value={u.id || u._id}>
                                                                                    {u.firstName ? `${u.firstName} ${u.lastName}` : (u.name || u.email)}
                                                                                </option>
                                                                            ))}
                                                                        </optgroup>
                                                                    );
                                                                })}
                                                                {noSeller.length > 0 && (
                                                                    <optgroup label="General / Admin">
                                                                        {noSeller.map(u => (
                                                                            <option key={u.id || u._id} value={u.id || u._id}>
                                                                                {u.firstName ? `${u.firstName} ${u.lastName}` : (u.name || u.email)}
                                                                            </option>
                                                                        ))}
                                                                    </optgroup>
                                                                )}
                                                            </>
                                                        );
                                                    })()}
                                                </select>
                                            </div>

                                            {/* Date Range Picker */}
                                            <div className="col-12">
                                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px', color: 'var(--color-text-primary)' }}>
                                                    <Calendar size={14} className="me-2" />
                                                    Task Duration (Start → Deadline)
                                                </label>
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    backgroundColor: 'var(--color-surface-0)',
                                                    border: '1px solid var(--color-border)',
                                                    borderRadius: 'var(--radius-md)',
                                                    padding: '4px 12px'
                                                }}>
                                                    <DatePicker
                                                        selectsRange={true}
                                                        startDate={formData.startDate}
                                                        endDate={formData.deadline}
                                                        onChange={(update) => {
                                                            const [start, end] = update;
                                                            setFormData({ ...formData, startDate: start, deadline: end });
                                                        }}
                                                        className="form-control border-0 bg-transparent"
                                                        style={{ flex: 1 }}
                                                        dateFormat="MMM d, yyyy"
                                                        placeholderText="Select duration range"
                                                    />
                                                </div>
                                            </div>

                                            {/* [GROWTH ENGINE] SCOPE SELECTOR */}
                                            <div className="col-12">
                                                <label style={{ display: 'block', marginBottom: '12px', fontWeight: 600, fontSize: '14px', color: 'var(--color-text-primary)' }}>
                                                    Execution Scope
                                                </label>
                                                <div className="d-flex gap-3 mb-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, scopeType: 'BRAND' })}
                                                        className={`btn btn-sm px-4 rounded-pill transition-all ${formData.scopeType === 'BRAND' ? 'btn-primary' : 'btn-outline-zinc text-zinc-500'}`}
                                                        style={{ fontSize: '12px' }}
                                                    >
                                                        Brand Level
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, scopeType: 'ASIN' })}
                                                        className={`btn btn-sm px-4 rounded-pill transition-all ${formData.scopeType === 'ASIN' ? 'btn-primary' : 'btn-outline-zinc text-zinc-500'}`}
                                                        style={{ fontSize: '12px' }}
                                                    >
                                                        ASIN Level
                                                    </button>
                                                </div>

                                                {formData.scopeType === 'BRAND' ? (
                                                    <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-3 mb-3">
                                                        <p className="small text-zinc-600 mb-0">
                                                            <AlertCircle size={14} className="me-2 text-primary" />
                                                            This task will affect <strong>all ASINs</strong> owned by the selected Brand.
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div className="mb-3">
                                                        <p className="small text-zinc-500 mb-2">Select the specific products that this task focuses on.</p>
                                                    </div>
                                                 )}
                                            </div>

                                            {/* Related ASINs - Only show if scope is ASIN or for reference */}
                                            <div className="col-12">
                                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px', color: 'var(--color-text-primary)' }}>
                                                    Related ASINs ({formData.asins?.length || 0})
                                                </label>

                                                {/* Search Input */}
                                                <div style={{ position: 'relative', marginBottom: '12px' }}>
                                                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                                                    <input
                                                        type="text"
                                                        placeholder="Search ASINs..."
                                                        value={asinSearch}
                                                        onChange={(e) => setAsinSearch(e.target.value)}
                                                        style={{
                                                            width: '100%',
                                                            padding: '10px 12px 10px 36px',
                                                            borderRadius: 'var(--radius-md)',
                                                            border: '1px solid var(--color-border)',
                                                            fontSize: '14px',
                                                            backgroundColor: 'var(--color-surface-0)'
                                                        }}
                                                    />
                                                </div>

                                                {/* Selected Chips */}
                                                {formData.asins?.length > 0 && (
                                                    <div className="d-flex flex-wrap gap-2 mb-3">
                                                        {formData.asins.map(asinId => {
                                                            const asinData = asins.find(a => (a.id || a._id) === asinId);
                                                            if (!asinData) return null;
                                                            return (
                                                                <div
                                                                    key={asinId}
                                                                    style={{
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: '6px',
                                                                        padding: '6px 12px',
                                                                        backgroundColor: 'var(--color-brand-50)',
                                                                        border: '1px solid var(--color-brand-200)',
                                                                        borderRadius: '20px',
                                                                        fontSize: '13px',
                                                                        color: 'var(--color-brand-700)'
                                                                    }}
                                                                >
                                                                    <span>{asinData.asin || asinData.asinCode}</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setFormData({ ...formData, asins: formData.asins.filter(id => id !== asinId) })}
                                                                        style={{
                                                                            background: 'none',
                                                                            border: 'none',
                                                                            padding: 0,
                                                                            cursor: 'pointer',
                                                                            color: 'var(--color-brand-500)',
                                                                            display: 'flex'
                                                                        }}
                                                                    >
                                                                        <X size={14} />
                                                                    </button>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                                {/* ASIN Dropdown */}
                                                <select
                                                    value=""
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (val && formData.asins && !formData.asins.includes(val)) {
                                                            setFormData({ ...formData, asins: [...formData.asins, val] });
                                                        }
                                                    }}
                                                    style={{
                                                        width: '100%',
                                                        padding: '10px 12px',
                                                        borderRadius: 'var(--radius-md)',
                                                        border: '1px solid var(--color-border)',
                                                        fontSize: '14px',
                                                        backgroundColor: 'var(--color-surface-0)'
                                                    }}
                                                >
                                                    <option value="">Add Product to Task...</option>
                                                    {asins
                                                        .filter(a =>
                                                            formData.asins && !formData.asins.includes(a.id || a._id) &&
                                                            (!asinSearch || (a.asin || a.asinCode || '').toLowerCase().includes(asinSearch.toLowerCase()))
                                                        )
                                                        .slice(0, 10)
                                                        .map(a => (
                                                            <option key={a.id || a._id} value={a.id || a._id}>
                                                                {a.asin || a.asinCode} - {(a.title || a.productName || 'Unknown Product').substring(0, 40)}...
                                                            </option>
                                                        ))
                                                    }
                                                </select>
                                            </div>

                                            {/* Goal Settings - Collapsible */}
                                            <div className="col-12">
                                                <div
                                                    onClick={() => setShowGoalSettings(!showGoalSettings)}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        padding: '12px 16px',
                                                        backgroundColor: showGoalSettings ? 'var(--color-brand-50)' : 'var(--color-surface-1)',
                                                        border: '1px solid var(--color-border)',
                                                        borderRadius: 'var(--radius-md)',
                                                        cursor: 'pointer',
                                                        marginBottom: showGoalSettings ? '16px' : '0'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <AlertCircle size={16} style={{ color: 'var(--color-brand-600)' }} />
                                                        <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-text-primary)' }}>
                                                            Goal Settings
                                                        </span>
                                                        {formData.goalSettings?.isGoalPrimary && (
                                                            <span className="badge bg-success" style={{ fontSize: '10px' }}>Enabled</span>
                                                        )}
                                                    </div>
                                                    <div style={{
                                                        transform: showGoalSettings ? 'rotate(180deg)' : 'rotate(0deg)',
                                                        transition: 'transform 200ms'
                                                    }}>
                                                        <ChevronRight size={20} />
                                                    </div>
                                                </div>

                                                {showGoalSettings && (
                                                    <div className="p-3 bg-light border border-top-0 rounded-bottom" style={{ borderColor: 'var(--color-border)' }}>
                                                        {/* Enable Goal Toggle */}
                                                        <div className="d-flex align-items-center justify-content-between mb-3">
                                                            <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                                                                Enable Goal-Based Generation
                                                            </label>
                                                            <div className="form-check form-switch m-0">
                                                                <input
                                                                    className="form-check-input"
                                                                    type="checkbox"
                                                                    checked={formData.goalSettings?.isGoalPrimary}
                                                                    onChange={(e) => setFormData({
                                                                        ...formData,
                                                                        goalSettings: { ...formData.goalSettings, isGoalPrimary: e.target.checked }
                                                                    })}
                                                                    style={{ cursor: 'pointer' }}
                                                                />
                                                            </div>
                                                        </div>

                                                        {formData.goalSettings?.isGoalPrimary && (
                                                            <div className="row g-3">
                                                                <div className="col-md-4">
                                                                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                                                                        Target Value ({formData.measurementMetric})
                                                                    </label>
                                                                    <input
                                                                        type="number"
                                                                        className="form-control"
                                                                        placeholder="e.g. 10000000"
                                                                        value={formData.goalSettings.targetValue}
                                                                        onChange={(e) => setFormData({
                                                                            ...formData,
                                                                            goalSettings: { ...formData.goalSettings, targetValue: e.target.value }
                                                                        })}
                                                                    />
                                                                </div>
                                                                <div className="col-md-4">
                                                                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                                                                        Frequency
                                                                    </label>
                                                                    <select
                                                                        className="form-control"
                                                                        value={formData.goalSettings.frequency || 'MONTHLY'}
                                                                        onChange={(e) => setFormData({
                                                                            ...formData,
                                                                            goalSettings: { ...formData.goalSettings, frequency: e.target.value }
                                                                        })}
                                                                    >
                                                                        <option value="DAILY">Daily</option>
                                                                        <option value="WEEKLY">Weekly</option>
                                                                        <option value="MONTHLY">Monthly</option>
                                                                    </select>
                                                                </div>
                                                                <div className="col-md-4">
                                                                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                                                                        Duration
                                                                    </label>
                                                                    <input
                                                                        type="number"
                                                                        className="form-control"
                                                                        min="1"
                                                                        max="24"
                                                                        value={formData.goalSettings.timeframe}
                                                                        onChange={(e) => setFormData({
                                                                            ...formData,
                                                                            goalSettings: { ...formData.goalSettings, timeframe: e.target.value }
                                                                        })}
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Step 2 CTAs */}
                                        <div className="d-flex justify-content-between mt-4 pt-3 border-top">
                                            <button
                                                type="button"
                                                onClick={() => setCurrentStep(1)}
                                                className="btn btn-outline-secondary px-4 py-2 d-flex align-items-center gap-2"
                                                style={{ fontWeight: 600 }}
                                            >
                                                <ChevronLeft size={18} />
                                                Back
                                            </button>
                                            <button
                                                type="submit"
                                                className="btn btn-primary px-4 py-2 d-flex align-items-center gap-2"
                                                style={{ fontWeight: 600 }}
                                            >
                                                <Save size={18} />
                                                {action ? 'Update Task' : 'Save Task'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </form>
                        ) : (
                            <div className="h-100 bg-white shadow-inner">
                                <ActionChat
                                    actionId={action._id || action.id}
                                    messages={messages}
                                    onSendMessage={handleSendMessage}
                                    users={users}
                                    tasks={actions}
                                    onNavigateToAction={onNavigateToAction}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <style>{`
                .modal-xl { max-width: 800px; }
                .bg-soft-primary { background-color: #eef2ff; }
                .bg-soft-danger { background-color: #fef2f0; }
                .bg-soft-info { background-color: #f0f9ff; }
                .text-primary { color: #4f46e5 !important; }
                .text-danger { color: #ef4444 !important; }
                .text-info { color: #0891b2 !important; }
                .h-fit { height: fit-content; }
                .animate-fadeIn {
                    animation: fadeIn 200ms ease-out;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default ActionModal;
