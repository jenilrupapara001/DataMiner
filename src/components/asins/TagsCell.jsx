import React, { useState, useRef, useEffect } from 'react';
import { X, Plus, Check, Search, Eye, Tag as TagIcon } from 'lucide-react';
import { Tooltip } from 'antd';
import { asinApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import TagsHistoryModal from '../TagsHistoryModal';

const DEFAULT_TAGS = [
    'Best Seller', 'Low Margin', 'High Margin', 'Needs Optimization',
    'A+ Content Missing', 'Low LQS', 'BuyBox Lost', 'Price Drop',
    'New Launch', 'Seasonal', 'Clearance', 'Replenishment',
    'Ad Active', 'No Ads', 'Review Alert', 'Competitor Alert',
    'MAP Violation', 'Hijacker Alert', 'Inventory Low', 'Out of Stock'
];

const TagsCell = ({ asin, onUpdate, onRefresh }) => {
    const { hasPermission } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [historyVisible, setHistoryVisible] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [tags, setTags] = useState([]);
    const [search, setSearch] = useState('');
    const [saving, setSaving] = useState(false);
    const ref = useRef(null);
    const inputRef = useRef(null);

    const [EditTagsModal, setEditTagsModal] = useState(null);

    useEffect(() => {
        if (showEditModal && !EditTagsModal) {
            import('./EditTagsModal').then(mod => setEditTagsModal(() => mod.default));
        }
    }, [showEditModal]);

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
            onRefresh?.();
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

    // Determine display colors based on tag type — light bg + colored text + border
    const getTagColor = (tag) => {
        const t = tag.toLowerCase();
        if (t.includes('best') || t.includes('high margin') || t.includes('won') || t.includes('high potential'))
            return { bg: '#ecfdf5', color: '#059669', border: '#a7f3d0' };
        if (t.includes('low') || t.includes('lost') || t.includes('alert') || t.includes('missing') || t.includes('hijacker') || t.includes('violation'))
            return { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' };
        if (t.includes('optim') || t.includes('drop') || t.includes('map') || t.includes('inventory') || t.includes('out of stock'))
            return { bg: '#fffbeb', color: '#d97706', border: '#fde68a' };
        if (t.includes('new') || t.includes('ad active') || t.includes('seasonal') || t.includes('growth') || t.includes('trending'))
            return { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' };
        if (t.includes('days') || t.includes('phase') || t.includes('mature') || t.includes('veteran') || t.includes('legacy') || t.includes('established'))
            return { bg: '#f5f3ff', color: '#7c3aed', border: '#ddd6fe' };
        if (t.includes('clearance') || t.includes('replenishment') || t.includes('discontinued'))
            return { bg: '#fff7ed', color: '#ea580c', border: '#fed7aa' };
        return { bg: '#f4f4f5', color: '#52525b', border: '#e4e4e7' };
    };

    const tooltipContent = (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '4px', maxWidth: '250px' }}>
            {tags.map((tag, idx) => {
                const color = getTagColor(tag);
                return (
                    <span
                        key={idx}
                        className="badge"
                        style={{
                            backgroundColor: color.bg,
                            color: color.color,
                            border: `1px solid ${color.border}`,
                            fontSize: '9px',
                            fontWeight: 600,
                            padding: '2px 7px',
                            borderRadius: '4px',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {tag}
                    </span>
                );
            })}
        </div>
    );

    return (
        <div ref={ref} className="position-relative" style={{ minWidth: '60px' }}>
            {/* TAGS DISPLAY - Click to open */}
            <Tooltip
                title={tags.length > 0 ? tooltipContent : null}
                color="#ffffff"
                styles={{ padding: '8px' }}
                mouseEnterDelay={0.3}
            >
                <div
                    className="d-flex align-items-center gap-1 overflow-hidden cursor-pointer"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (hasPermission('asinmanager_manage')) {
                            setShowEditModal(true);
                        }
                    }}
                    style={{
                        minHeight: '24px',
                        padding: '1px 2px',
                        borderRadius: '6px',
                        transition: 'background 0.15s',
                        whiteSpace: 'nowrap'
                    }}
                >
                    {tags.length === 0 ? (
                        <span
                            style={{ fontSize: '10px', cursor: 'pointer', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 4 }}
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
                                        className="badge"
                                        style={{
                                            backgroundColor: color.bg,
                                            color: color.color,
                                            border: `1px solid ${color.border}`,
                                            fontSize: '9px',
                                            fontWeight: 600,
                                            padding: '2px 7px',
                                            borderRadius: '4px',
                                            whiteSpace: 'nowrap',
                                            cursor: 'pointer',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 3
                                        }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (hasPermission('asinmanager_manage')) {
                                                removeTag(tag, e);
                                            }
                                        }}
                                    >
                                        {tag.length > 14 ? tag.substring(0, 13) + '…' : tag}
                                        <X size={9} style={{ cursor: 'pointer', opacity: 0.6 }} />
                                    </span>
                                );
                            })}
                            {tags.length > 2 && (
                                <span
                                    className="badge"
                                    style={{
                                        backgroundColor: '#f4f4f5',
                                        color: '#71717a',
                                        border: '1px solid #e4e4e7',
                                        fontSize: '9px',
                                        fontWeight: 600,
                                        padding: '2px 6px',
                                        borderRadius: '4px'
                                    }}
                                >
                                    +{tags.length - 2}
                                </span>
                            )}
                            {saving && (
                                <span style={{ fontSize: '8px', color: '#9ca3af' }}>saving...</span>
                            )}
                        </>
                    )}

                    {/* History Button */}
                    <button
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', marginLeft: 'auto', color: '#cbd5e1', opacity: tags.length > 0 ? 1 : 0, transition: 'opacity 0.2s' }}
                        onClick={(e) => {
                            e.stopPropagation();
                            setHistoryVisible(true);
                        }}
                        title="View Tags History"
                    >
                        <Eye size={11} />
                    </button>
                </div>
            </Tooltip>

            {showEditModal && EditTagsModal && (
                <EditTagsModal
                    isOpen={showEditModal}
                    onClose={() => setShowEditModal(false)}
                    asin={asin}
                    onUpdate={(asinId, newTags) => {
                        setTags(newTags);
                        onUpdate?.(asinId, newTags);
                        onRefresh?.();
                    }}
                />
            )}
        </div>
    );
};

export default React.memo(TagsCell);
