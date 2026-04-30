import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Tag, Plus, Search, Check, Trash2, Eye, Clock, 
  RefreshCw, Save, AlertCircle, History, Sparkles,
  ArrowRight
} from 'lucide-react';
import { asinApi } from '../../services/api';
import TagsHistoryModal from '../TagsHistoryModal';

const DEFAULT_TAGS = [
  // Performance Tags
  'Best Seller', 'Low Margin', 'High Margin', 'Needs Optimization',
  // Content Tags
  'A+ Content Missing', 'Low LQS', 'Title Needs Work', 'Bullet Points Missing',
  'Images Low', 'Description Short',
  // BuyBox Tags
  'BuyBox Lost', 'BuyBox Won', 'Price Drop', 'Price Increase',
  // Lifecycle Tags
  'New Launch', 'New 30D', '30-60 Days', '60-90 Days', '90-180 Days',
  '180-365 Days', '365+ Days', 'Growth Phase', 'Established', 'Mature', 'Veteran', 'Legacy',
  // Action Tags
  'Seasonal', 'Clearance', 'Replenishment', 'Discontinued',
  // Ad Tags
  'Ad Active', 'No Ads', 'Review Alert', 'Competitor Alert',
  // Risk Tags
  'MAP Violation', 'Hijacker Alert', 'Inventory Low', 'Out of Stock',
  // Opportunity Tags
  'High Potential', 'Trending Up', 'Trending Down'
];

const EditTagsModal = ({ isOpen, onClose, asin, onUpdate }) => {
  const [tags, setTags] = useState([]);
  const [originalTags, setOriginalTags] = useState([]);
  const [search, setSearch] = useState('');
  const [customInput, setCustomInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [recentlyUsed, setRecentlyUsed] = useState([]);

  // Load current tags
  useEffect(() => {
    if (asin) {
      let currentTags = [];
      try {
        if (asin.tags && Array.isArray(asin.tags)) {
          currentTags = asin.tags;
        } else if (asin.Tags && typeof asin.Tags === 'string') {
          currentTags = JSON.parse(asin.Tags);
        } else if (asin.Tags && Array.isArray(asin.Tags)) {
          currentTags = asin.Tags;
        }
      } catch (e) {
        currentTags = [];
      }
      setTags(currentTags);
      setOriginalTags([...currentTags]);
    }
  }, [asin]);

  // Load recently used tags from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('recently-used-tags');
      if (saved) setRecentlyUsed(JSON.parse(saved).slice(0, 8));
    } catch {}
  }, []);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Categorize tags
  const tagCategories = {
    'All': DEFAULT_TAGS,
    'Performance': ['Best Seller', 'Low Margin', 'High Margin', 'Needs Optimization'],
    'Content': ['A+ Content Missing', 'Low LQS', 'Title Needs Work', 'Bullet Points Missing', 'Images Low', 'Description Short'],
    'BuyBox': ['BuyBox Lost', 'BuyBox Won', 'Price Drop', 'Price Increase'],
    'Lifecycle': ['New Launch', 'New 30D', '30-60 Days', '60-90 Days', '90-180 Days', '180-365 Days', '365+ Days', 'Growth Phase', 'Established', 'Mature'],
    'Risk': ['MAP Violation', 'Hijacker Alert', 'Inventory Low', 'Out of Stock', 'Review Alert', 'Competitor Alert'],
    'Ads': ['Ad Active', 'No Ads'],
    'Opportunity': ['High Potential', 'Trending Up', 'Trending Down', 'Seasonal', 'Clearance', 'Replenishment'],
  };

  // Filter tags by search and category
  const filteredTags = (() => {
    let pool = activeCategory === 'All' ? DEFAULT_TAGS : (tagCategories[activeCategory] || []);
    if (search.trim()) {
      pool = pool.filter(t => t.toLowerCase().includes(search.toLowerCase()));
    }
    return pool;
  })();

  // Get tag color (SOLID COLORS)
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

  // Toggle a tag
  const toggleTag = (tag) => {
    setTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag) 
        : [...prev, tag]
    );
    setError(null);
    setSuccessMessage(null);
  };

  // Add custom tag
  const addCustomTag = () => {
    const custom = customInput.trim();
    if (!custom) return;
    if (custom.length > 80) {
      setError('Tag name too long (max 80 characters)');
      return;
    }
    if (tags.includes(custom)) {
      setError('This tag already exists');
      return;
    }
    setTags(prev => [...prev, custom]);
    setCustomInput('');
    setError(null);
    
    // Add to recently used
    setRecentlyUsed(prev => {
      const updated = [custom, ...prev.filter(t => t !== custom)].slice(0, 10);
      localStorage.setItem('recently-used-tags', JSON.stringify(updated));
      return updated;
    });
  };

  // Remove a tag
  const removeTag = (tag) => {
    setTags(prev => prev.filter(t => t !== tag));
    setError(null);
    setSuccessMessage(null);
  };

  // Save tags
  const handleSave = async () => {
    const currentSorted = [...tags].sort().join(',');
    const originalSorted = [...originalTags].sort().join(',');
    
    if (currentSorted === originalSorted) {
      setError('No changes made');
      return;
    }

    setSaving(true);
    setError(null);
    
    try {
      const response = await asinApi.updateTags(asin._id || asin.id, tags);
      if (response.success) {
        setOriginalTags([...tags]);
        setSuccessMessage('Tags saved successfully!');
        
        // Update parent component
        if (onUpdate) onUpdate(asin._id || asin.id, tags);
        
        // Auto-close after 1.5 seconds
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (err) {
      setError(err.message || 'Failed to save tags');
    }
    setSaving(false);
  };

  // Check if there are unsaved changes
  const hasChanges = [...tags].sort().join(',') !== [...originalTags].sort().join(',');

  if (!isOpen || !asin) return null;

  return createPortal(
    <div 
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', zIndex: 1050 }}
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}
    >
      <style>{`
        .tag-item {
          padding: 8px 14px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          display: flex;
          align-items: center;
          gap: 8px;
          border: 1.5px solid transparent;
        }
        .tag-item:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .tag-item.selected {
          border-color: #18181b;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .cat-pill {
          padding: 5px 12px;
          font-size: 10px;
          font-weight: 700;
          border-radius: 20px;
          cursor: pointer;
          border: 1.5px solid #e5e7eb;
          background: white;
          color: #71717a;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .cat-pill:hover { border-color: #18181b; color: #18181b; }
        .cat-pill.active { background: #18181b; color: white; border-color: #18181b; }
        
        .custom-tag-input {
          border: 1.5px solid #e5e7eb;
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 13px;
          width: 100%;
          transition: border-color 0.2s;
        }
        .custom-tag-input:focus {
          outline: none;
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
        }
      `}</style>

      <div 
        className="bg-white shadow-2xl d-flex flex-column"
        style={{ 
          width: '100%', maxWidth: '650px', maxHeight: '90vh',
          borderRadius: '20px', overflow: 'hidden',
          animation: 'modalSlideIn 0.2s ease-out'
        }}
      >
        {/* === HEADER === */}
        <div className="px-5 py-4 border-bottom bg-white d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-2">
              <Tag size={22} />
            </div>
            <div>
              <h5 className="mb-0 fw-bold text-zinc-900">Edit Tags</h5>
              <span className="text-zinc-500" style={{ fontSize: '12px' }}>
                {asin.asinCode} · {tags.length} tag{tags.length !== 1 ? 's' : ''} selected
              </span>
            </div>
          </div>
          <div className="d-flex align-items-center gap-2">
            {/* History Button */}
            <button
              className="btn btn-ghost p-2 rounded-circle"
              onClick={() => setShowHistory(true)}
              title="View tags history"
            >
              <History size={18} className="text-zinc-400" />
            </button>
            <button className="btn btn-ghost p-2 rounded-circle" onClick={onClose} disabled={saving}>
              <X size={20} className="text-zinc-400" />
            </button>
          </div>
        </div>

        {/* === SELECTED TAGS === */}
        <div className="px-5 py-3 bg-zinc-50 border-bottom">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <span className="text-zinc-500 fw-bold" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Selected Tags
            </span>
            {tags.length > 0 && (
              <button 
                className="btn btn-ghost p-0 text-zinc-400 hover-text-danger"
                onClick={() => { setTags([]); setError(null); }}
                style={{ fontSize: '10px', fontWeight: 600 }}
              >
                <Trash2 size={12} className="me-1" /> Clear All
              </button>
            )}
          </div>
          <div className="d-flex flex-wrap gap-2" style={{ minHeight: tags.length > 0 ? 'auto' : '40px' }}>
            {tags.length === 0 ? (
              <span className="text-zinc-400 d-flex align-items-center" style={{ fontSize: '12px', fontStyle: 'italic' }}>
                <Plus size={14} className="me-1" /> Select tags from the list below or create custom tags
              </span>
            ) : (
              tags.map((tag, idx) => {
                const color = getTagColor(tag);
                return (
                  <span
                    key={idx}
                    className="badge d-flex align-items-center gap-2 shadow-sm transition-all hover-translate-y-px"
                    style={{
                      backgroundColor: color.bg,
                      color: color.text,
                      border: 'none',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '8px 14px',
                      borderRadius: '10px',
                      cursor: 'default'
                    }}
                  >
                    <Tag size={10} className="opacity-70" />
                    {tag}
                    <X 
                      size={14} 
                      className="ms-1"
                      style={{ cursor: 'pointer', opacity: 0.7, transition: 'opacity 0.15s' }}
                      onMouseOver={e => e.currentTarget.style.opacity = '1'}
                      onMouseOut={e => e.currentTarget.style.opacity = '0.7'}
                      onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
                    />
                  </span>
                );
              })
            )}
          </div>
        </div>

        {/* === CONTENT AREA === */}
        <div className="flex-grow-1 overflow-auto">
          {/* Custom Tag Input */}
          <div className="px-5 pt-4 pb-2">
            <label className="text-zinc-500 fw-bold mb-2 d-block" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Create Custom Tag
            </label>
            <div className="d-flex gap-2">
              <input
                type="text"
                className="custom-tag-input"
                placeholder="Type a custom tag and press Enter..."
                value={customInput}
                onChange={e => setCustomInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomTag();
                  }
                }}
                maxLength={80}
              />
              <button
                className="btn btn-dark d-flex align-items-center gap-1 rounded-3 px-4"
                onClick={addCustomTag}
                disabled={!customInput.trim()}
                style={{ fontSize: '12px', fontWeight: 700, background: '#18181b', whiteSpace: 'nowrap' }}
              >
                <Plus size={14} /> Add
              </button>
            </div>
            <span className="text-zinc-400" style={{ fontSize: '10px' }}>
              Press Enter or click Add. Max 80 characters per tag.
            </span>
          </div>

          {/* Recently Used Tags */}
          {recentlyUsed.length > 0 && (
            <div className="px-5 py-3">
              <span className="text-zinc-500 fw-bold d-block mb-2" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <Clock size={11} className="me-1" /> Recently Used
              </span>
              <div className="d-flex flex-wrap gap-2">
                {recentlyUsed.map((tag, idx) => {
                  const color = getTagColor(tag);
                  const isSelected = tags.includes(tag);
                  return (
                    <button
                      key={idx}
                      className={`tag-item ${isSelected ? 'selected' : ''}`}
                      style={{
                        backgroundColor: isSelected ? color.bg : '#f8fafc',
                        color: isSelected ? color.text : '#475569',
                        borderColor: isSelected ? 'transparent' : '#e2e8f0',
                        boxShadow: isSelected ? `0 4px 12px ${color.bg}33` : 'none'
                      }}
                      onClick={() => toggleTag(tag)}
                    >
                      {isSelected ? <Check size={13} /> : <Plus size={13} className="opacity-40" />}
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Category Pills */}
          <div className="px-5 pt-3 pb-2">
            <span className="text-zinc-500 fw-bold d-block mb-2" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Predefined Tags
            </span>
            <div className="d-flex gap-1 flex-wrap">
              {Object.keys(tagCategories).map(cat => (
                <button
                  key={cat}
                  className={`cat-pill ${activeCategory === cat ? 'active' : ''}`}
                  onClick={() => setActiveCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="px-5 py-2">
            <div className="position-relative">
              <Search size={14} className="position-absolute top-50 start-0 translate-middle-y ms-3 text-zinc-400" />
              <input
                type="text"
                className="form-control ps-5 rounded-3"
                placeholder="Search tags..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ fontSize: '13px', height: '40px', border: '1.5px solid #e5e7eb' }}
              />
            </div>
          </div>

          {/* Tags Grid */}
          <div className="px-5 pb-3">
            <div className="d-flex flex-wrap gap-2" style={{ maxHeight: '250px', overflowY: 'auto' }}>
              {filteredTags.map((tag, idx) => {
                const color = getTagColor(tag);
                const isSelected = tags.includes(tag);
                return (
                  <button
                    key={idx}
                    className={`tag-item ${isSelected ? 'selected' : ''}`}
                    style={{
                      backgroundColor: isSelected ? color.bg : '#f8fafc',
                      color: isSelected ? color.text : '#475569',
                      borderColor: isSelected ? 'transparent' : '#e2e8f0',
                      boxShadow: isSelected ? `0 4px 12px ${color.bg}33` : 'none'
                    }}
                    onClick={() => toggleTag(tag)}
                  >
                    {isSelected ? <Check size={13} /> : <Plus size={13} className="opacity-40" />}
                    {tag}
                  </button>
                );
              })}
              {filteredTags.length === 0 && (
                <div className="text-center w-100 py-4">
                  <Tag size={24} className="text-zinc-300 mb-1" />
                  <p className="text-zinc-400 mb-0" style={{ fontSize: '12px' }}>
                    No tags match your search
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* === MESSAGES === */}
        {error && (
          <div className="px-5 py-2 bg-danger-subtle text-danger d-flex align-items-center gap-2" style={{ fontSize: '12px' }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}
        {successMessage && (
          <div className="px-5 py-2 bg-success-subtle text-success d-flex align-items-center gap-2" style={{ fontSize: '12px' }}>
            <Check size={14} /> {successMessage}
          </div>
        )}

        {/* === FOOTER === */}
        <div className="px-5 py-4 border-top bg-white d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-2">
            <span className="text-zinc-400" style={{ fontSize: '11px' }}>
              {hasChanges ? (
                <span className="text-amber-600 d-flex align-items-center gap-1">
                  <AlertCircle size={12} /> Unsaved changes
                </span>
              ) : (
                'No changes'
              )}
            </span>
          </div>
          <div className="d-flex gap-3">
            <button 
              className="btn btn-outline-secondary fw-bold rounded-3 px-4"
              onClick={onClose}
              disabled={saving}
              style={{ fontSize: '13px', height: '42px' }}
            >
              Cancel
            </button>
            <button 
              className="btn btn-dark fw-bold rounded-3 px-5 d-flex align-items-center gap-2"
              onClick={handleSave}
              disabled={!hasChanges || saving}
              style={{ fontSize: '13px', height: '42px', background: '#18181b' }}
            >
              {saving ? (
                <><RefreshCw size={14} className="spin" /> Saving...</>
              ) : (
                <><Save size={14} /> Save Tags</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Tags History Modal */}
      <TagsHistoryModal 
        isOpen={showHistory} 
        onClose={() => setShowHistory(false)} 
        asinId={asin._id || asin.id}
        asinCode={asin.asinCode} 
      />
    </div>,
    document.body
  );
};

export default EditTagsModal;
