import React, { useState, useRef, useEffect } from 'react';
import { X, Plus, Check, Search, Eye, Tag as TagIcon } from 'lucide-react';
import { asinApi } from '../../services/api';
import TagsHistoryModal from '../TagsHistoryModal';
import EditTagsModal from './EditTagsModal';

const DEFAULT_TAGS = [
    'Best Seller', 'Low Margin', 'High Margin', 'Needs Optimization',
    'A+ Content Missing', 'Low LQS', 'BuyBox Lost', 'Price Drop',
    'New Launch', 'Seasonal', 'Clearance', 'Replenishment',
    'Ad Active', 'No Ads', 'Review Alert', 'Competitor Alert',
    'MAP Violation', 'Hijacker Alert', 'Inventory Low', 'Out of Stock'
];

const TagsCell = ({ asin, onUpdate }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [historyVisible, setHistoryVisible] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [tags, setTags] = useState([]);
    const [search, setSearch] = useState('');
    const [saving, setSaving] = useState(false);
    const ref = useRef(null);
    const inputRef = useRef(null);

    // Parse tags from ASIN data
    useEffect(() => {
        try {
            const rawTags = asin.tags || asin.Tags;
            if (rawTags) {
                if (Array.isArray(rawTags)) {
                    setTags(rawTags);
                } else if (typeof rawTags === 'string') {
                    const parsed = JSON.parse(rawTags);
                    setTags(Array.isArray(parsed) ? parsed : []);
                } else {
                    setTags([]);
                }
            } else {
                setTags([]);
            }
        } catch (e) {
            setTags([]);
        }
    }, [asin.tags, asin.Tags, asin._id, asin.Id]);

    // Focus input when dropdown opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    // Close on outside click
    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (e) => {
            if (ref.current && !ref.current.contains(e.target)) {
                setIsOpen(false);
                saveTags();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, tags]);

    const saveTags = async () => {
        if (saving) return;
        const currentTags = JSON.stringify(tags);
        const originalTags = JSON.stringify(
            Array.isArray(asin.tags) ? asin.tags : 
            (typeof asin.Tags === 'string' ? JSON.parse(asin.Tags || '[]') : (asin.Tags || []))
        );
        
        if (currentTags === originalTags) return;
        
        setSaving(true);
        try {
            await asinApi.updateTags(asin._id || asin.Id, tags);
            onUpdate?.(asin._id || asin.Id, tags);
        } catch (err) {
            console.error('Failed to save tags:', err);
        }
        setSaving(false);
    };

    const toggleTag = (tag) => {
        setTags(prev => 
            prev.includes(tag) 
                ? prev.filter(t => t !== tag) 
                : [...prev, tag]
        );
    };

    const removeTag = (tag, e) => {
        e.stopPropagation();
        setTags(prev => prev.filter(t => t !== tag));
    };

    const addCustomTag = (e) => {
        if (e) e.preventDefault();
        const custom = search.trim();
        if (custom && custom.length > 1 && !tags.includes(custom)) {
            setTags(prev => [...prev, custom]);
        }
        setSearch('');
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addCustomTag();
        }
        if (e.key === 'Escape') {
            setIsOpen(false);
            saveTags();
        }
        if (e.key === 'Backspace' && search === '' && tags.length > 0) {
            setTags(prev => prev.slice(0, -1));
        }
    };

    const filteredTags = search.trim()
        ? DEFAULT_TAGS.filter(t => t.toLowerCase().includes(search.toLowerCase()))
        : DEFAULT_TAGS;

    // Determine display colors based on tag type
    const getTagColor = (tag) => {
        const t = tag.toLowerCase();
        // Green
        if (t.includes('best') || t.includes('high margin') || t.includes('won') || t.includes('high potential')) 
            return { bg: '#10b981', text: '#ffffff' };
        // Red
        if (t.includes('low') || t.includes('lost') || t.includes('alert') || t.includes('missing') || t.includes('hijacker') || t.includes('violation'))
            return { bg: '#ef4444', text: '#ffffff' };
        // Amber/Orange
        if (t.includes('optim') || t.includes('drop') || t.includes('map') || t.includes('inventory') || t.includes('out of stock'))
            return { bg: '#f59e0b', text: '#ffffff' };
        // Blue
        if (t.includes('new') || t.includes('ad active') || t.includes('seasonal') || t.includes('growth') || t.includes('trending'))
            return { bg: '#3b82f6', text: '#ffffff' };
        // Indigo/Purple
        if (t.includes('days') || t.includes('phase') || t.includes('mature') || t.includes('veteran') || t.includes('legacy') || t.includes('established'))
            return { bg: '#6366f1', text: '#ffffff' };
        // Orange-Red
        if (t.includes('clearance') || t.includes('replenishment') || t.includes('discontinued'))
            return { bg: '#f97316', text: '#ffffff' };
        // Default Gray
        return { bg: '#71717a', text: '#ffffff' };
    };

    return (
        <div ref={ref} className="position-relative" style={{ minWidth: '60px' }}>
            {/* TAGS DISPLAY - Click to open */}
            <div
                className="d-flex align-items-center gap-1 flex-wrap cursor-pointer"
                onClick={(e) => { 
                    e.stopPropagation(); 
                    setShowEditModal(true); 
                }}
                style={{ 
                    minHeight: '26px', 
                    padding: '2px 4px',
                    borderRadius: '6px',
                    transition: 'background 0.15s'
                }}
            >
                {tags.length === 0 ? (
                    <span 
                        className="d-flex align-items-center gap-1 text-zinc-400"
                        style={{ fontSize: '10px', cursor: 'pointer' }}
                    >
                        <Plus size={10} />
                        <span>Tags</span>
                    </span>
                ) : (
                    <>
                        {tags.slice(0, 2).map((tag, idx) => {
                            const color = getTagColor(tag);
                            return (
                                <span
                                    key={idx}
                                    className="badge d-flex align-items-center gap-1 shadow-sm"
                                    style={{
                                        backgroundColor: color.bg,
                                        color: color.text,
                                        border: 'none',
                                        fontSize: '9px',
                                        fontWeight: 700,
                                        padding: '3px 8px',
                                        borderRadius: '5px',
                                        whiteSpace: 'nowrap',
                                        cursor: 'pointer'
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeTag(tag, e);
                                    }}
                                >
                                    {tag.length > 14 ? tag.substring(0, 13) + '…' : tag}
                                    <X size={10} style={{ cursor: 'pointer', opacity: 0.8 }} />
                                </span>
                            );
                        })}
                        {tags.length > 2 && (
                            <span 
                                className="badge bg-zinc-100 text-zinc-500 border border-zinc-200"
                                style={{ fontSize: '9px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px' }}
                                title={tags.slice(2).join(', ')}
                            >
                                +{tags.length - 2}
                            </span>
                        )}
                        {saving && (
                            <span className="text-zinc-400" style={{ fontSize: '8px' }}>saving...</span>
                        )}
                    </>
                )}

                {/* History Button - Only show if tags exist or on hover potentially, but let's keep it visible for easy audit */}
                <button
                    className="btn btn-ghost p-0 border-0 ms-auto text-zinc-300 hover-text-zinc-500 transition-colors"
                    onClick={(e) => {
                        e.stopPropagation();
                        setHistoryVisible(true);
                    }}
                    title="View Tags History"
                    style={{ opacity: tags.length > 0 ? 1 : 0, transition: 'opacity 0.2s' }}
                >
                    <Eye size={12} />
                </button>
            </div>

            {showEditModal && (
                <EditTagsModal
                    isOpen={showEditModal}
                    onClose={() => setShowEditModal(false)}
                    asin={asin}
                    onUpdate={(asinId, newTags) => {
                        setTags(newTags);
                        onUpdate?.(asinId, newTags);
                    }}
                />
            )}
        </div>
    );
};

export default React.memo(TagsCell);
