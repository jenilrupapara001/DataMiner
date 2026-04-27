import React, { useState, useRef, useEffect } from 'react';
import { X, Plus, Check, Search } from 'lucide-react';
import { asinApi } from '../../services/api';

const DEFAULT_TAGS = [
    'Best Seller', 'Low Margin', 'High Margin', 'Needs Optimization',
    'A+ Content Missing', 'Low LQS', 'BuyBox Lost', 'Price Drop',
    'New Launch', 'Seasonal', 'Clearance', 'Replenishment',
    'Ad Active', 'No Ads', 'Review Alert', 'Competitor Alert',
    'MAP Violation', 'Hijacker Alert', 'Inventory Low', 'Out of Stock'
];

const TagsCell = ({ asin, onUpdate }) => {
    const [isOpen, setIsOpen] = useState(false);
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
        if (t.includes('best') || t.includes('high margin')) return { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' };
        if (t.includes('low') || t.includes('lost') || t.includes('alert') || t.includes('missing') || t.includes('hijacker')) return { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' };
        if (t.includes('optim') || t.includes('drop') || t.includes('map') || t.includes('inventory')) return { bg: '#fffbeb', text: '#d97706', border: '#fde68a' };
        if (t.includes('new') || t.includes('ad active') || t.includes('seasonal')) return { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' };
        if (t.includes('clearance') || t.includes('replenishment') || t.includes('no ads')) return { bg: '#f5f3ff', text: '#7c3aed', border: '#ddd6fe' };
        return { bg: '#f8fafc', text: '#475569', border: '#e2e8f0' };
    };

    return (
        <div ref={ref} className="position-relative" style={{ minWidth: '60px' }}>
            {/* TAGS DISPLAY - Click to open */}
            <div
                className="d-flex align-items-center gap-1 flex-wrap cursor-pointer"
                onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
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
                                    className="badge d-flex align-items-center gap-1"
                                    style={{
                                        backgroundColor: color.bg,
                                        color: color.text,
                                        border: `1px solid ${color.border}`,
                                        fontSize: '9px',
                                        fontWeight: 600,
                                        padding: '2px 7px',
                                        borderRadius: '4px',
                                        whiteSpace: 'nowrap',
                                        cursor: 'pointer'
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeTag(tag, e);
                                    }}
                                >
                                    {tag.length > 14 ? tag.substring(0, 13) + '…' : tag}
                                    <X size={9} style={{ cursor: 'pointer', opacity: 0.6 }} />
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
            </div>

            {/* DROPDOWN */}
            {isOpen && (
                <div
                    className="position-absolute bg-white border rounded-3 shadow-xl"
                    style={{
                        zIndex: 1050,
                        minWidth: '220px',
                        maxWidth: '280px',
                        top: '100%',
                        left: 0,
                        marginTop: '4px',
                        overflow: 'hidden'
                    }}
                    onClick={e => e.stopPropagation()}
                >
                    {/* Search Input */}
                    <div className="p-2 border-bottom bg-white">
                        <div className="d-flex align-items-center gap-2 bg-zinc-50 rounded-2 px-2" style={{ border: '1px solid #e5e7eb' }}>
                            <Search size={12} className="text-zinc-400 flex-shrink-0" />
                            <input
                                ref={inputRef}
                                type="text"
                                className="form-control border-0 bg-transparent p-0 shadow-none"
                                placeholder="Search or add tag..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                onKeyDown={handleKeyDown}
                                style={{ fontSize: '11px', height: '28px' }}
                            />
                            {search && (
                                <button 
                                    className="btn btn-ghost p-0 border-0" 
                                    onClick={(e) => { e.stopPropagation(); setSearch(''); }}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <X size={12} className="text-zinc-400" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Custom Tag Add Button */}
                    {search.trim() && !DEFAULT_TAGS.some(t => t.toLowerCase() === search.toLowerCase()) && !tags.includes(search.trim()) && (
                        <div
                            className="d-flex align-items-center gap-2 px-3 py-2 cursor-pointer hover-bg-indigo-50 border-bottom"
                            onClick={(e) => { e.stopPropagation(); addCustomTag(); }}
                            style={{ fontSize: '11px', color: '#4f46e5', fontWeight: 600 }}
                        >
                            <Plus size={12} />
                            <span>Add "{search.trim()}"</span>
                        </div>
                    )}

                    {/* Tags List */}
                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        {filteredTags.map(tag => {
                            const isSelected = tags.includes(tag);
                            const color = getTagColor(tag);
                            return (
                                <div
                                    key={tag}
                                    className={`d-flex align-items-center justify-content-between px-3 py-2 cursor-pointer ${
                                        isSelected ? 'bg-zinc-50' : 'hover:bg-zinc-50'
                                    }`}
                                    onClick={(e) => { e.stopPropagation(); toggleTag(tag); }}
                                    style={{ fontSize: '11px', transition: 'background 0.1s' }}
                                >
                                    <div className="d-flex align-items-center gap-2">
                                        <span 
                                            style={{ 
                                                width: '8px', 
                                                height: '8px', 
                                                borderRadius: '2px', 
                                                backgroundColor: color.text,
                                                flexShrink: 0
                                            }} 
                                        />
                                        <span className={`${isSelected ? 'fw-bold' : ''}`} style={{ color: isSelected ? '#18181b' : '#52525b' }}>
                                            {tag}
                                        </span>
                                    </div>
                                    {isSelected && <Check size={12} className="text-indigo-500" />}
                                </div>
                            );
                        })}
                    </div>

                    {/* Footer */}
                    {tags.length > 0 && (
                        <div className="border-top px-3 py-2 bg-zinc-50 d-flex justify-content-between align-items-center">
                            <span className="text-zinc-400" style={{ fontSize: '10px' }}>
                                {tags.length} tag{tags.length !== 1 ? 's' : ''} selected
                            </span>
                            <button
                                className="btn btn-ghost p-0 border-0 text-zinc-400 hover-text-danger"
                                onClick={(e) => { e.stopPropagation(); setTags([]); }}
                                style={{ fontSize: '10px', fontWeight: 600 }}
                            >
                                Clear all
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default React.memo(TagsCell);
