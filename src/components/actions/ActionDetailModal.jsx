import React, { useState, useEffect } from 'react';
import { Modal, ModalBody, Spinner, Badge, Tooltip } from 'reactstrap';
import { 
    FileText, Target, TrendingUp, AlertTriangle, 
    Activity, ExternalLink, History, Sparkles, 
    X
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { db } from '../../services/db';

const ActionDetailModal = ({ isOpen, onClose, action: item }) => {
    const [instructions, setInstructions] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [tooltipOpen, setTooltipOpen] = useState(false);

    const itemType = item?.itemType || 'ACTION';

    useEffect(() => {
        if (isOpen && item && itemType === 'ACTION') {
            fetchInstructions();
        } else {
            setInstructions('');
            setError('');
        }
    }, [isOpen, item, itemType]);

    const fetchInstructions = async () => {
        if (item.instructions) {
            setInstructions(item.instructions);
            return;
        }
        setLoading(true);
        setError('');
        try {
            const res = await db.getActionInstructions(item._id || item.id);
            if (res && res.success) {
                setInstructions(res.data);
            } else {
                setError('Failed to load instructions. Please try again.');
            }
        } catch (err) {
            console.error('Error fetching instructions:', err);
            setError('Error connecting to AI service.');
        } finally {
            setLoading(false);
        }
    };

    if (!item) return null;

    const getPriorityDotColor = (priority) => {
        switch (priority) {
            case 'URGENT': return '#e05243';
            case 'HIGH': return '#e0a820';
            case 'MEDIUM': return '#4a90d9';
            case 'LOW': return '#9ca3af';
            default: return '#9ca3af';
        }
    };

    const getStatusStyles = (status) => {
        switch (status) {
            case 'PENDING': return { bg: '#fdf6e3', text: '#9a6700', border: '0.5px solid #f0d070' };
            case 'IN_PROGRESS': return { bg: '#e8f0fe', text: '#1a56a5', border: '0.5px solid #c2d7f9' };
            case 'REVIEW': return { bg: '#f0f4ff', text: '#5046e4', border: '0.5px solid #d1d9ff' };
            case 'COMPLETED': return { bg: '#e6f9f0', text: '#0f7a4a', border: '0.5px solid #b7ebcf' };
            case 'URGENT': return { bg: '#fdecea', text: '#a8230d', border: '0.5px solid #f5c0ba' };
            default: return { bg: '#f8fafc', text: '#64748b', border: '0.5px solid #e2e8f0' };
        }
    };

    const formatStat = (val) => {
        if (val === undefined || val === null) return '0';
        return Number(val).toLocaleString('en-IN');
    };

    const formatValue = (val) => (val !== undefined && val !== null ? val : '—');

    const completionPercent = Math.round(((item.currentValue || 0) / (item.targetValue || item.goalSettings?.targetValue || 1)) * 100);
    
    const getCompletionColor = (percent) => {
        if (percent >= 80) return '#0f7a4a';
        if (percent >= 40) return '#e0a820';
        return '#e05243';
    };

    const deadlinePast = item.timeTracking?.deadline && new Date(item.timeTracking.deadline) < new Date() && item.status !== 'COMPLETED';

    return (
        <Modal 
            isOpen={isOpen} 
            toggle={onClose} 
            centered 
            modalClassName="custom-action-modal-overlay"
            contentClassName="custom-action-modal-box"
        >
            {/* Modal Header */}
            <div className="modal-header-container sticky-top bg-white">
                <div className="d-flex align-items-start gap-3 w-100 p-header">
                    {/* Left - Icon box */}
                    <div className="icon-box-header">
                        {itemType === 'OBJECTIVE' ? (
                            <Target size={18} stroke="#1a56a5" />
                        ) : itemType === 'KR' ? (
                            <TrendingUp size={18} stroke="#1a56a5" />
                        ) : (
                            <FileText size={18} stroke="#1a56a5" />
                        )}
                    </div>

                    {/* Center - Title block */}
                    <div className="flex-grow-1">
                        <h4 className="task-title-header mb-1">{item.title}</h4>
                        <div className="d-flex align-items-center gap-2">
                            <span className="type-tag">{item.type?.replace(/_/g, ' ') || itemType}</span>
                            <div className="v-divider"></div>
                            <span className="id-prefix">id: </span>
                            <span 
                                id="item-id-hash"
                                className="id-hash" 
                                title={item._id || item.id}
                            >
                                {(item._id || item.id)?.substring(0, 16)}...
                            </span>
                        </div>
                    </div>

                    {/* Right - Meta block */}
                    <div className="d-flex flex-column align-items-end gap-1">
                        <button className="close-btn-minimal mb-2" onClick={onClose} aria-label="Close">
                            <X size={18} color="#9ca3af" />
                        </button>
                        <div 
                            className="status-pill"
                            style={{ 
                                backgroundColor: getStatusStyles(item.status).bg,
                                color: getStatusStyles(item.status).text,
                                border: getStatusStyles(item.status).border
                            }}
                        >
                            {item.status?.replace(/_/g, ' ') || 'PENDING'}
                        </div>
                        <div className="created-date mt-1">
                            + Created {new Date(item.createdAt).toLocaleDateString('en-GB')}
                        </div>
                    </div>
                </div>
            </div>

            <ModalBody className="p-body scrollbar-hidden">
                {/* Section 1: General Information */}
                <div className="section-container mt-0">
                    <div className="section-label">General Information</div>
                    
                    <div className="field-group">
                        <div className="field-label">Item title</div>
                        <div className="field-value-text">{item.title}</div>
                    </div>

                    <div className="field-group mt-3">
                        <div className="field-label">Description & instructions</div>
                        <div className="textarea-container">
                            <textarea 
                                className="custom-textarea" 
                                rows="3" 
                                readOnly 
                                value={item.description || ''}
                                placeholder="Add task instructions…"
                            />
                        </div>
                    </div>

                    <div className="grid-2-col mt-3">
                        <div>
                            <div className="section-label mb-2">Measurement metric</div>
                            <div className="value-card d-flex align-items-center justify-content-between">
                                <span className="card-value">{item.measurementMetric || item.metric || 'No metric'}</span>
                                <Activity size={14} color="#9ca3af" />
                            </div>
                        </div>
                        <div>
                            <div className="section-label mb-2">Priority level</div>
                            <div className="value-card d-flex align-items-center justify-content-between">
                                <div className="d-flex align-items-center gap-2">
                                    <div className="priority-dot" style={{ backgroundColor: getPriorityDotColor(item.priority) }}></div>
                                    <span className="card-value" style={{ color: getPriorityDotColor(item.priority) }}>
                                        {item.priority?.charAt(0) + item.priority?.slice(1).toLowerCase() || 'Medium'}
                                    </span>
                                </div>
                                {item.priority === 'URGENT' && <AlertTriangle size={14} color="#e05243" />}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section 2: Performance & Progress */}
                {(itemType === 'KR' || item.measurementMetric) && (
                    <div className="section-container">
                        <div className="section-label">Performance & Progress</div>
                        <div className="stat-grid mt-2">
                            <div className="stat-cell">
                                <div className="stat-label">Target value</div>
                                <div className="stat-value">
                                    {item.metric === 'GMS' ? `₹${formatStat(item.targetValue)}` : formatStat(item.targetValue || item.goalSettings?.targetValue)}
                                </div>
                            </div>
                            <div className="stat-cell">
                                <div className="stat-label">Current achievement</div>
                                <div className="stat-value">
                                    {item.metric === 'GMS' ? `₹${formatStat(item.currentValue)}` : formatStat(item.currentValue || 0)}
                                </div>
                            </div>
                            <div className="stat-cell border-0">
                                <div className="stat-label">Completion %</div>
                                <div className="stat-value" style={{ color: getCompletionColor(completionPercent) }}>
                                    {completionPercent}%
                                </div>
                            </div>
                        </div>
                        <div className="progress-container-thin mt-3">
                            <div 
                                className="progress-fill" 
                                style={{ 
                                    width: `${completionPercent}%`,
                                    backgroundColor: getCompletionColor(completionPercent)
                                }}
                            ></div>
                        </div>
                    </div>
                )}

                {/* Section 3: Related ASINs */}
                <div className="section-container">
                    <div className="section-label">Related ASINs / products ({item.asins?.length || 0})</div>
                    {item.asins?.length > 0 ? (
                        <div className="asin-scroll-row mt-2">
                            {item.asins.map((asin, idx) => (
                                <div key={idx} className="asin-chip">
                                    <div className="asin-badge">ASIN</div>
                                    <div className="asin-code">{asin.asinCode || asin.asin}</div>
                                    <div className="marketplace-str">amazon.in</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-text mt-2">No products linked</div>
                    )}
                </div>

                {/* Section 4: Time Management & Stakeholders */}
                <div className="section-container mb-4">
                    <div className="time-stakeholder-grid">
                        <div className="timeline-card">
                            <div className="timeline-grid">
                                <div>
                                    <div className="stat-label mb-1">Created</div>
                                    <div className="timeline-val">{new Date(item.createdAt).toLocaleDateString('en-GB')}</div>
                                </div>
                                <div>
                                    <div className="stat-label mb-1">Deadline</div>
                                    <div className="timeline-val" style={{ color: deadlinePast ? '#c0392b' : 'inherit' }}>
                                        {formatValue(item.timeTracking?.deadline ? new Date(item.timeTracking.deadline).toLocaleDateString('en-GB') : null)}
                                    </div>
                                </div>
                                <div>
                                    <div className="stat-label mb-1">Actual start</div>
                                    <div className="timeline-val">
                                        {formatValue(item.timeTracking?.startedAt ? new Date(item.timeTracking.startedAt).toLocaleDateString('en-GB') : null)}
                                    </div>
                                </div>
                                <div>
                                    <div className="stat-label mb-1">Actual end</div>
                                    <div className="timeline-val">
                                        {formatValue(item.timeTracking?.completedAt ? new Date(item.timeTracking.completedAt).toLocaleDateString('en-GB') : null)}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="stakeholder-card text-center">
                            <div className="stat-label mb-2">Assigned to</div>
                            <div className="d-flex justify-content-center">
                                <div className="avatar-circle">
                                    {(item.assignedTo?.firstName || 'U').charAt(0)}
                                </div>
                            </div>
                            <div className="stakeholder-name mt-2">
                                {item.assignedTo ? `${item.assignedTo.firstName} ${item.assignedTo.lastName || ''}` : 'Multiple owners'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* AI Guide Tab (Optional/Conditional) */}
                {itemType === 'ACTION' && (
                    <div className="section-container mb-4">
                        <div className="section-label">AI Strategy Guide</div>
                        <div className="ai-guide-box mt-2">
                            {loading ? (
                                <div className="text-center py-4">
                                    <Spinner size="sm" color="primary" />
                                    <div className="mt-2 smallest text-muted">Analyzing task data...</div>
                                </div>
                            ) : error ? (
                                <div className="text-center py-4 text-danger small">
                                    {error}
                                </div>
                            ) : (
                                <div className="markdown-body-minimal">
                                    <ReactMarkdown>{instructions || 'No instructions available.'}</ReactMarkdown>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </ModalBody>

            {/* Modal Footer */}
            <div className="modal-footer-container sticky-bottom bg-white">
                <div className="d-flex align-items-center justify-content-between p-footer">
                    <button className="dismiss-btn" onClick={onClose}>Dismiss</button>
                    <button className="primary-cta-dark">Collect task details</button>
                </div>
            </div>

            <style>{`
                .custom-action-modal-overlay {
                    background: rgba(0, 0, 0, 0.45) !important;
                    backdrop-filter: blur(3px);
                }
                .custom-action-modal-box {
                    background: white !important;
                    border-radius: 16px !important;
                    width: 560px !important;
                    max-width: 95vw !important;
                    max-height: 90vh !important;
                    border: none !important;
                    box-shadow: none !important;
                    display: flex;
                    flex-direction: column;
                }
                .p-header { padding: 16px 20px; }
                .p-body { padding: 0 20px; flex-grow: 1; overflow-y: auto; }
                .p-footer { padding: 14px 20px; }
                
                .sticky-top { border-bottom: 0.5px solid rgba(0,0,0,0.08); }
                .sticky-bottom { border-top: 0.5px solid rgba(0,0,0,0.08); }

                .icon-box-header {
                    width: 40px;
                    height: 40px;
                    border-radius: 10px;
                    background: #e8f0fe;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .task-title-header {
                    font-size: 17px;
                    font-weight: 500;
                    color: #1a1a1a;
                    line-height: 1.3;
                    margin: 0;
                }

                .type-tag {
                    font-size: 10px;
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                    color: #6b7280;
                    font-weight: 500;
                }

                .v-divider {
                    width: 1px;
                    height: 12px;
                    background: rgba(0,0,0,0.12);
                }

                .id-prefix { font-size: 10px; color: #9ca3af; }
                .id-hash { 
                    font-size: 10px; 
                    font-family: monospace; 
                    color: #9ca3af; 
                    cursor: help;
                }

                .status-pill {
                    font-size: 11px;
                    font-weight: 500;
                    padding: 3px 10px;
                    border-radius: 999px;
                    text-transform: capitalize;
                }

                .created-date {
                    font-size: 11px;
                    color: #9ca3af;
                }

                .close-btn-minimal {
                    background: none;
                    border: none;
                    padding: 0;
                    cursor: pointer;
                }

                .section-container { margin-top: 20px; }

                .section-label {
                    font-size: 11px;
                    text-transform: uppercase;
                    letter-spacing: 0.07em;
                    font-weight: 500;
                    color: #9ca3af;
                }

                .field-group { margin-top: 10px; }
                .field-label { font-size: 10px; font-weight: 500; text-transform: uppercase; color: #9ca3af; margin-bottom: 4px; }
                
                .field-value-text {
                    font-size: 14px;
                    font-weight: 400;
                    color: #1a1a1a;
                }

                .textarea-container { margin-top: 8px; }
                .custom-textarea {
                    width: 100%;
                    background: white;
                    border: 0.5px solid rgba(0,0,0,0.15);
                    border-radius: 8px;
                    padding: 9px 12px;
                    font-size: 13px;
                    line-height: 1.6;
                    color: #1a1a1a;
                    resize: none;
                }

                .grid-2-col {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 12px;
                }

                .value-card {
                    background: white;
                    border: 0.5px solid rgba(0,0,0,0.1);
                    border-radius: 8px;
                    padding: 10px 12px;
                }

                .card-value { font-size: 13px; font-weight: 500; color: #1a1a1a; }
                
                .priority-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                }

                .stat-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 1px;
                    background: rgba(0,0,0,0.06);
                    border-radius: 10px;
                    overflow: hidden;
                }

                .stat-cell {
                    background: white;
                    padding: 14px 16px;
                }

                .stat-label {
                    font-size: 10px;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: #9ca3af;
                    margin-bottom: 4px;
                }

                .stat-value {
                    font-size: 20px;
                    font-weight: 500;
                    color: #1a1a1a;
                    font-variant-numeric: tabular-nums;
                }

                .progress-container-thin {
                    width: 100%;
                    height: 5px;
                    background: rgba(0,0,0,0.06);
                    border-radius: 3px;
                    overflow: hidden;
                }

                .progress-fill {
                    height: 100%;
                    transition: width 0.5s ease;
                }

                .asin-scroll-row {
                    display: flex;
                    gap: 10px;
                    overflow-x: auto;
                    padding-bottom: 8px;
                }

                .asin-chip {
                    background: white;
                    border: 0.5px solid rgba(0,0,0,0.1);
                    border-radius: 8px;
                    padding: 8px 10px;
                    min-width: 120px;
                    flex-shrink: 0;
                }

                .asin-badge {
                    font-size: 10px;
                    text-transform: uppercase;
                    background: #f0f4ff;
                    color: #5046e4;
                    border-radius: 4px;
                    padding: 2px 6px;
                    display: inline-block;
                    margin-bottom: 4px;
                }

                .asin-code {
                    font-size: 12px;
                    font-family: monospace;
                    font-weight: 500;
                    color: #1a1a1a;
                }

                .marketplace-str { font-size: 11px; color: #9ca3af; }
                
                .empty-text { font-size: 13px; color: #9ca3af; }

                .time-stakeholder-grid {
                    display: grid;
                    grid-template-columns: 1fr auto;
                    gap: 12px;
                    align-items: start;
                }

                .timeline-card {
                    background: white;
                    border: 0.5px solid rgba(0,0,0,0.1);
                    border-radius: 8px;
                    padding: 12px 14px;
                }

                .timeline-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 8px;
                }

                .timeline-val {
                    font-size: 12px;
                    font-weight: 500;
                    color: #1a1a1a;
                }

                .stakeholder-card {
                    background: white;
                    border: 0.5px solid rgba(0,0,0,0.1);
                    border-radius: 8px;
                    padding: 12px 14px;
                    min-width: 130px;
                }

                .avatar-circle {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    background: #6366f1;
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    font-weight: 500;
                }

                .stakeholder-name {
                    font-size: 13px;
                    font-weight: 500;
                    color: #1a1a1a;
                }

                .ai-guide-box {
                    background: #f8fafc;
                    border-radius: 8px;
                    padding: 12px;
                    font-size: 13px;
                }

                .markdown-body-minimal p { margin-bottom: 8px; line-height: 1.5; color: #475569; }
                
                .dismiss-btn {
                    background: none;
                    border: none;
                    font-size: 13px;
                    color: #6b7280;
                    cursor: pointer;
                    padding: 0;
                }
                .dismiss-btn:hover { text-decoration: underline; }

                .primary-cta-dark {
                    background: #1a1a1a;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    padding: 10px 20px;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background 0.2s;
                }
                .primary-cta-dark:hover { background: #333; }

                .scrollbar-hidden::-webkit-scrollbar { display: none; }
                .scrollbar-hidden { -ms-overflow-style: none; scrollbar-width: none; }
                
                .hover-shadow:hover { box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
            `}</style>
        </Modal>
    );
};

export default ActionDetailModal;
