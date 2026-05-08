import React, { useState, useEffect } from 'react';
import { X, Save, Calendar, User, Tag, AlertCircle, CheckCircle, ThumbsUp, ThumbsDown } from 'lucide-react';
import ActionChat from './ActionChat';
import { db } from '../../services/db';
import './ActionModal.css';

const ActionModal = ({ action, isOpen, onClose, onSave, asins = [], users = [], sellers = [], actions = [], onNavigateToAction, initialKeyResultId = null }) => {
    const [messages, setMessages] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState('');
    const [activeTab, setActiveTab] = useState('details');

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
                startDate: (action.timeTracking?.startDate || action.startDate) ? new Date(action.timeTracking?.startDate || action.startDate).toISOString().split('T')[0] : '',
                deadline: (action.timeTracking?.deadline || action.deadline || action.dueDate) ? new Date(action.timeTracking?.deadline || action.deadline || action.dueDate).toISOString().split('T')[0] : '',
                recurring: action.recurring || { enabled: false, frequency: 'WEEKLY', daysOfWeek: [] },
                keyResultId: action.keyResultId || initialKeyResultId || ''
            });
        } else {
            setFormData({
                title: '',
                description: '',
                type: 'TITLE_OPTIMIZATION',
                priority: 'MEDIUM',
                status: 'PENDING',
                asins: [],
                assignedTo: '',
                startDate: '',
                deadline: '',
                recurring: { enabled: false, frequency: 'WEEKLY', daysOfWeek: [] },
                keyResultId: initialKeyResultId || ''
            });
        }
        setSelectedTemplate('');
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

                    {action && (
                        <div className="action-modal-tabs px-4">
                            <button
                                className={`action-tab-btn ${activeTab === 'details' ? 'active' : ''}`}
                                onClick={() => setActiveTab('details')}
                            >
                                Task Overview
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
                            <form onSubmit={handleSubmit} className="action-two-column-layout">
                                {/* Left Column: Core Content */}
                                <div className="action-main-content">
                                    <div className="action-card">
                                        <h3 className="action-card-title">General Information</h3>
                                        <div className="mb-4">
                                            <label className="form-label-clean">Task Title</label>
                                            <input
                                                type="text"
                                                name="title"
                                                value={formData.title}
                                                onChange={handleChange}
                                                required
                                                className="form-input-clean fw-bold text-dark"
                                                placeholder="What needs to be done?"
                                            />
                                        </div>
                                        <div className="mb-0">
                                            <label className="form-label-clean">Description & Instructions</label>
                                            <textarea
                                                name="description"
                                                value={formData.description}
                                                onChange={handleChange}
                                                rows="8"
                                                className="form-input-clean"
                                                placeholder="Provide detailed instructions or context for this task..."
                                            />
                                        </div>

                                        {/* Completion Info */}
                                        {action?.completion?.remarks && (
                                            <div className="mt-4 p-3 bg-soft-success rounded-3 border border-success border-opacity-10">
                                                <h4 className="small fw-bold text-success mb-2 d-flex align-items-center gap-2">
                                                    <CheckCircle size={14} /> COMPLETION REMARKS
                                                </h4>
                                                <p className="small text-dark mb-2" style={{ whiteSpace: 'pre-wrap' }}>
                                                    {action.completion.remarks}
                                                </p>
                                                {action.completion.completedBy && (
                                                    <div className="smallest text-muted">
                                                        By {action.completion.completedBy.firstName} {action.completion.completedBy.lastName} on {new Date(action.completion.completedAt).toLocaleString()}
                                                    </div>
                                                )}
                                                {action.completion.audioTranscript && (
                                                    <div className="mt-2 pt-2 border-top border-success border-opacity-10">
                                                        <div className="smallest fw-bold text-success text-uppercase mb-1">Audio Transcript</div>
                                                        <p className="smallest text-muted italic">"{action.completion.audioTranscript}"</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Review Info */}
                                        {action?.review?.comments && action.review.status !== 'PENDING' && (
                                            <div className={`mt-3 p-3 rounded-3 border ${action.review.status === 'APPROVED' ? 'bg-soft-info border-info' : 'bg-soft-danger border-danger'} border-opacity-10`}>
                                                <h4 className={`small fw-bold mb-2 d-flex align-items-center gap-2 ${action.review.status === 'APPROVED' ? 'text-info' : 'text-danger'}`}>
                                                    {action.review.status === 'APPROVED' ? <ThumbsUp size={14} /> : <ThumbsDown size={14} />}
                                                    REVIEWER FEEDBACK ({action.review.status})
                                                </h4>
                                                <p className="small text-dark mb-2" style={{ whiteSpace: 'pre-wrap' }}>
                                                    {action.review.comments}
                                                </p>
                                                {action.review.reviewedBy && (
                                                    <div className="smallest text-muted">
                                                        By {action.review.reviewedBy.firstName || 'Reviewer'} on {new Date(action.review.reviewedAt).toLocaleString()}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* ASIN Selection / Display */}
                                    <div className="action-card">
                                        <h3 className="action-card-title">Related ASINs / Products ({formData.asins?.length || 0})</h3>
                                        <div className="d-flex flex-column gap-2 mb-3">
                                            {formData.asins?.map(asinId => {
                                                const asinData = asins.find(a => (a.id || a._id) === asinId);
                                                if (!asinData) return null;
                                                return (
                                                    <div key={asinId} className="asin-info-card shadow-sm border">
                                                        <div className="asin-thumb bg-white fw-bold">
                                                            {asinData.asin || 'ASIN'}
                                                        </div>
                                                        <div className="flex-grow-1 overflow-hidden">
                                                            <div className="fw-bold text-dark text-truncate">
                                                                {asinData.title || asinData.productName || 'Unknown Product'}
                                                            </div>
                                                            <div className="small text-muted mt-1 d-flex gap-2">
                                                                <span>{asinData.asinCode}</span>
                                                                <span>• {asinData.marketplace || 'N/A'}</span>
                                                            </div>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-danger border-0 h-fit"
                                                            onClick={() => setFormData({ ...formData, asins: formData.asins.filter(id => id !== asinId) })}
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="mb-0">
                                            <select
                                                name="asin-adder"
                                                value=""
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val && formData.asins && !formData.asins.includes(val)) {
                                                        setFormData({ ...formData, asins: [...formData.asins, val] });
                                                    }
                                                }}
                                                className="form-input-clean"
                                            >
                                                <option value="">Add Product to Task...</option>
                                                {asins
                                                    .filter(a => formData.asins && !formData.asins.includes(a.id || a._id))
                                                    .map(a => (
                                                        <option key={a.id || a._id} value={a.id || a._id}>
                                                            {a.asin || a.asinCode} - {(a.title || a.productName || 'Unknown Product').substring(0, 50)}...
                                                        </option>
                                                    ))
                                                }
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Sidebar Metadata */}
                                <div className="action-sidebar">
                                    <div className="action-card p-3">
                                        <h3 className="action-card-title">Task Controls</h3>

                                        <div className="mb-4">
                                            <label className="form-label-clean">Current Status</label>
                                            <select name="status" value={formData.status} onChange={handleChange} className="form-input-clean bg-soft-primary border-primary border-opacity-25 fw-bold text-primary">
                                                <option value="PENDING">Pending</option>
                                                <option value="IN_PROGRESS">In Progress</option>
                                                <option value="REVIEW">Needs Review</option>
                                                <option value="COMPLETED">Completed</option>
                                                <option value="CANCELLED">Cancelled</option>
                                            </select>
                                        </div>

                                        <div className="mb-4">
                                            <label className="form-label-clean">Priority</label>
                                            <div className="d-flex gap-2">
                                                {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map(p => (
                                                    <button
                                                        key={p}
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, priority: p })}
                                                        className={`btn btn-sm flex-grow-1 border-2 py-1 px-0 small fw-bold ${formData.priority === p ? 'btn-primary' : 'btn-outline-light text-muted'}`}
                                                    >
                                                        {p[0]}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="mb-4">
                                            <label className="form-label-clean">Assigned To</label>
                                            <select name="assignedTo" value={formData.assignedTo} onChange={handleChange} className="form-input-clean">
                                                <option value="">Unassigned</option>
                                                {/* Group users by their assigned seller */}
                                                {(() => {
                                                    // Build a map: sellerId -> { seller, users[] }
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

                                        <hr className="my-4 opacity-50" />

                                        <div className="mb-3">
                                            <label className="form-label-clean"><Calendar size={14} className="me-2" /> Start Date</label>
                                            <input type="date" name="startDate" value={formData.startDate} onChange={handleChange} className="form-input-clean small" />
                                        </div>

                                        <div className="mb-4">
                                            <label className="form-label-clean"><Calendar size={14} className="me-2 text-danger" /> Deadline</label>
                                            <input type="date" name="deadline" value={formData.deadline} onChange={handleChange} className="form-input-clean small border-danger border-opacity-25" />
                                        </div>

                                        <button type="submit" className="btn btn-primary w-100 py-2 fw-bold d-flex align-items-center justify-content-center gap-2">
                                            <Save size={18} />
                                            {action ? 'Update Task' : 'Create Task'}
                                        </button>
                                    </div>

                                    {/* Task Type Summary */}
                                    <div className="action-card bg-soft-info border-0 p-3">
                                        <div className="d-flex align-items-center gap-2 text-info mb-2 fw-bold small">
                                            <AlertCircle size={14} />
                                            TASK CLASSIFICATION
                                        </div>
                                        <select name="type" value={formData.type} onChange={handleChange} className="form-select border-0 bg-transparent fw-bold text-dark p-0" style={{ boxShadow: 'none' }}>
                                            {/* (options remain as before but cleaner UI context) */}
                                            <option value="TITLE_OPTIMIZATION">Title Optimization</option>
                                            <option value="DESCRIPTION_OPTIMIZATION">Description Optimization</option>
                                            <option value="IMAGE_OPTIMIZATION">Image Optimization</option>
                                            <option value="BULLET_POINTS">Bullet Points</option>
                                            <option value="A_PLUS_CONTENT">A+ Content</option>
                                            <option value="GENERAL_OPTIMIZATION">General Optimization</option>
                                        </select>
                                    </div>
                                </div>
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
                .modal-xl { max-width: 1140px; }
                .bg-soft-primary { background-color: #eef2ff; }
                .bg-soft-danger { background-color: #fef2f2; }
                .bg-soft-info { background-color: #f0f9ff; }
                .text-primary { color: #4f46e5 !important; }
                .text-danger { color: #ef4444 !important; }
                .text-info { color: #0891b2 !important; }
                .h-fit { height: fit-content; }
            `}</style>
        </div>
    );
};

export default ActionModal;
