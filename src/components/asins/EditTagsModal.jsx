import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Tag, Plus, Check, RefreshCw } from 'lucide-react';
import { asinApi } from '../../services/api';

const EditTagsModal = ({ isOpen, onClose, asin, onUpdate }) => {
    const [tags, setTags] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen && asin) {
            try {
                const parsed = typeof asin.tags === 'string' ? JSON.parse(asin.tags) : (asin.tags || []);
                setTags(Array.isArray(parsed) ? parsed : []);
            } catch (e) {
                setTags([]);
            }
        }
    }, [isOpen, asin]);

    const handleAddTag = (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const val = inputValue.trim().replace(/,/g, '');
            if (val && !tags.includes(val)) {
                setTags([...tags, val]);
                setInputValue('');
            }
        }
    };

    const removeTag = (tagToRemove) => {
        setTags(tags.filter(t => t !== tagToRemove));
    };

    const handleSave = async () => {
        if (!asin?._id || saving) return;
        setSaving(true);
        try {
            const response = await asinApi.updateTags(asin._id, tags);
            if (response.success) {
                onUpdate?.(asin._id, tags);
                onClose();
            }
        } catch (err) {
            console.error('Failed to update tags:', err);
            alert('Failed to update tags');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div
            className="position-fixed top-0 bottom-0 start-0 end-0 d-flex align-items-center justify-content-center p-4"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', zIndex: 10000 }}
            onClick={(e) => e.target === e.currentTarget && !saving && onClose()}
        >
            <div 
                className="bg-white shadow-2xl border"
                style={{ width: '400px', borderRadius: '16px', overflow: 'hidden', animation: 'modalAppear 0.2s ease-out' }}
            >
                <style>{`
                    @keyframes modalAppear {
                        from { opacity: 0; transform: scale(0.95); }
                        to { opacity: 1; transform: scale(1); }
                    }
                    .tag-input-container:focus-within {
                        border-color: #6366f1 !important;
                        box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
                    }
                    .tag-badge {
                        display: flex;
                        align-items: center;
                        gap: 4px;
                        background: #f5f3ff;
                        color: #5b21b6;
                        border: 1px solid #ddd6fe;
                        padding: 2px 8px;
                        border-radius: 6px;
                        font-size: 11px;
                        font-weight: 600;
                    }
                    .tag-remove:hover {
                        color: #dc2626;
                    }
                `}</style>

                {/* Header */}
                <div className="px-4 py-3 border-bottom d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center gap-2">
                        <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                            <Tag size={16} />
                        </div>
                        <div>
                            <h6 className="mb-0 fw-bold text-slate-900" style={{ fontSize: '14px' }}>Edit Tags</h6>
                            <p className="smallest text-slate-400 mb-0">{asin?.asinCode || 'ASIN'}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="btn btn-ghost p-1 rounded-circle border-0">
                        <X size={18} className="text-slate-400" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4">
                    <div className="mb-3">
                        <label className="fw-bold text-slate-600 mb-2" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Current Tags
                        </label>
                        <div 
                            className="tag-input-container d-flex flex-wrap gap-2 p-2 border rounded-xl bg-slate-50/50"
                            style={{ minHeight: '100px', alignContent: 'flex-start', transition: 'all 0.2s', borderColor: '#e2e8f0' }}
                        >
                            {tags.map(tag => (
                                <span key={tag} className="tag-badge">
                                    {tag}
                                    <X size={12} className="tag-remove cursor-pointer" onClick={() => removeTag(tag)} />
                                </span>
                            ))}
                            <input
                                type="text"
                                className="border-0 bg-transparent flex-grow-1 p-1"
                                placeholder={tags.length === 0 ? "Type and press Enter..." : ""}
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={handleAddTag}
                                style={{ outline: 'none', fontSize: '12px', minWidth: '100px' }}
                            />
                        </div>
                        <p className="smallest text-slate-400 mt-2">
                            Press <strong>Enter</strong> or <strong>comma</strong> to add a tag
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-4 py-3 bg-slate-50 border-top d-flex justify-content-end gap-2">
                    <button 
                        className="btn btn-ghost px-4 py-2 fw-semibold text-slate-600" 
                        onClick={onClose}
                        style={{ fontSize: '13px' }}
                        disabled={saving}
                    >
                        Cancel
                    </button>
                    <button 
                        className="btn bg-indigo-600 text-white px-4 py-2 rounded-lg fw-bold d-flex align-items-center gap-2 hover-shadow-indigo"
                        onClick={handleSave}
                        style={{ fontSize: '13px', border: 'none' }}
                        disabled={saving}
                    >
                        {saving ? (
                            <>
                                <RefreshCw size={14} className="spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Check size={14} />
                                Save Changes
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default EditTagsModal;
