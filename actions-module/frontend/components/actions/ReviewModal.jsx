import React, { useState } from 'react';
import { X, ThumbsUp, ThumbsDown, AlertCircle } from 'lucide-react';

const ReviewModal = ({ action, isOpen, onClose, onReview }) => {
    const [decision, setDecision] = useState('APPROVE');
    const [comments, setComments] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen || !action) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await onReview(action, decision, comments);
            onClose();
        } catch (error) {
            console.error('Review submission failed:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose} style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100
        }}>
            <div className="modal-dialog modal-md shadow-lg" onClick={(e) => e.stopPropagation()} style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '500px',
                overflow: 'hidden'
            }}>
                <div className="modal-content border-0">
                    <div className="modal-header border-bottom p-4 d-flex justify-content-between align-items-center">
                        <h5 className="modal-title fw-bold m-0 d-flex align-items-center gap-2">
                            <AlertCircle className="text-primary" size={20} />
                            Task Review
                        </h5>
                        <button type="button" className="btn-close border-0 bg-transparent" onClick={onClose} aria-label="Close">
                            <X size={20} className="text-muted" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="modal-body p-4">
                            <div className="mb-4">
                                <label className="form-label small fw-bold text-muted text-uppercase mb-2">Task Title</label>
                                <div className="p-3 bg-light rounded-3 fw-bold text-dark border">
                                    {action.title}
                                </div>
                            </div>

                            <div className="mb-4">
                                <label className="form-label small fw-bold text-muted text-uppercase mb-2">Assignee</label>
                                <div className="d-flex align-items-center gap-3 p-3 bg-light rounded-3 border">
                                    <div className="avatar-initial bg-primary text-white border rounded-circle shadow-sm" style={{ width: '32px', height: '32px', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                        {(action.assignedTo?.firstName || 'U').charAt(0)}
                                    </div>
                                    <div className="fw-bold text-dark">
                                        {action.assignedTo ? `${action.assignedTo.firstName} ${action.assignedTo.lastName}` : 'Unassigned'}
                                    </div>
                                </div>
                            </div>

                            <div className="mb-4">
                                <label className="form-label small fw-bold text-muted text-uppercase mb-3">Your Decision</label>
                                <div className="row g-3">
                                    <div className="col-6">
                                        <button
                                            type="button"
                                            onClick={() => setDecision('APPROVE')}
                                            className={`btn w-100 py-3 rounded-3 d-flex flex-column align-items-center gap-2 border-2 transition-all ${decision === 'APPROVE'
                                                ? 'btn-success border-success'
                                                : 'btn-outline-light text-muted border-light text-opacity-50'
                                                }`}
                                        >
                                            <ThumbsUp size={24} />
                                            <span className="fw-bold">Approve</span>
                                        </button>
                                    </div>
                                    <div className="col-6">
                                        <button
                                            type="button"
                                            onClick={() => setDecision('REJECT')}
                                            className={`btn w-100 py-3 rounded-3 d-flex flex-column align-items-center gap-2 border-2 transition-all ${decision === 'REJECT'
                                                ? 'btn-danger border-danger'
                                                : 'btn-outline-light text-muted border-light text-opacity-50'
                                                }`}
                                        >
                                            <ThumbsDown size={24} />
                                            <span className="fw-bold">Reject</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="mb-0">
                                <label className="form-label small fw-bold text-muted text-uppercase mb-2">Review Feedback</label>
                                <textarea
                                    className="form-control rounded-3 border-light bg-light"
                                    rows="4"
                                    placeholder={decision === 'APPROVE' ? "Well done! Any minor feedback?" : "Explain why the task was rejected and what needs to be fixed..."}
                                    value={comments}
                                    onChange={(e) => setComments(e.target.value)}
                                    required={decision === 'REJECT'}
                                />
                            </div>
                        </div>

                        <div className="modal-footer p-4 border-top bg-light d-flex gap-3">
                            <button type="button" onClick={onClose} className="btn btn-light px-4 py-2 fw-bold text-muted border flex-grow-1" disabled={isSubmitting}>
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className={`btn px-4 py-2 fw-bold flex-grow-1 ${decision === 'APPROVE' ? 'btn-success' : 'btn-danger'}`}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'Submitting...' : `Submit ${decision === 'APPROVE' ? 'Approval' : 'Rejection'}`}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ReviewModal;
