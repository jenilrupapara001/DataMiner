import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Tag, Plus, Minus, Search, Check, RefreshCw, 
  Layers, AlertCircle, Save, ArrowRight, Package
} from 'lucide-react';
import { asinApi } from '../../services/api';

const DEFAULT_TAGS = [
  'Best Seller', 'Low Margin', 'High Margin', 'Needs Optimization',
  'A+ Content Missing', 'Low LQS', 'BuyBox Lost', 'Price Drop',
  'New Launch', 'New 30D', '30-60 Days', '60-90 Days',
  'Seasonal', 'Clearance', 'Replenishment',
  'Ad Active', 'No Ads', 'Review Alert', 'Competitor Alert',
  'MAP Violation', 'Hijacker Alert', 'Inventory Low', 'Out of Stock'
];

const BulkTagsModal = ({ isOpen, onClose, selectedAsins = [], onComplete }) => {
  const [action, setAction] = useState('replace'); // 'replace' | 'add' | 'remove'
  const [selectedTags, setSelectedTags] = useState([]);
  const [search, setSearch] = useState('');
  const [customInput, setCustomInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [step, setStep] = useState(1); // 1=select, 2=review, 3=result

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedTags([]);
      setSearch('');
      setCustomInput('');
      setResult(null);
      setError(null);
      setStep(1);
      setAction('replace');
    }
  }, [isOpen]);

  const filteredTags = search.trim()
    ? DEFAULT_TAGS.filter(t => t.toLowerCase().includes(search.toLowerCase()))
    : DEFAULT_TAGS;

  const toggleTag = (tag) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const addCustomTag = () => {
    const custom = customInput.trim();
    if (!custom) return;
    if (!selectedTags.includes(custom)) {
      setSelectedTags(prev => [...prev, custom]);
    }
    setCustomInput('');
  };

  const handleApply = async () => {
    if (selectedTags.length === 0) {
      setError('Please select at least one tag');
      return;
    }

    setProcessing(true);
    setError(null);
    
    try {
      const asinIds = selectedAsins.map(a => a._id || a.id);
      const response = await asinApi.bulkUpdateTags(asinIds, selectedTags, action);
      
      if (response.success) {
        setResult(response);
        setStep(3);
        if (onComplete) onComplete();
      }
    } catch (err) {
      setError(err.message || 'Failed to update tags');
    }
    setProcessing(false);
  };

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

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1050 }}
      onClick={(e) => { if (e.target === e.currentTarget && !processing) onClose(); }}
    >
      <style>{`
        .bulk-tag-item {
          padding: 7px 14px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          border: 1.5px solid #e5e7eb;
          background: white;
        }
        .bulk-tag-item:hover { transform: translateY(-1px); box-shadow: 0 2px 6px rgba(0,0,0,0.06); }
        .bulk-tag-item.selected { border-color: currentColor; }
        
        .action-btn {
          padding: 10px 20px;
          border: 2px solid #e5e7eb;
          border-radius: 12px;
          background: white;
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
          flex: 1;
        }
        .action-btn:hover { border-color: #18181b; }
        .action-btn.active { border-color: #18181b; background: #18181b; color: white; }
        .action-btn.active .action-icon { color: white !important; }
        .action-btn.active .action-desc { color: #d1d5db !important; }
      `}</style>

      <div className="bg-white shadow-2xl d-flex flex-column" style={{ width: '100%', maxWidth: '580px', maxHeight: '90vh', borderRadius: '20px', overflow: 'hidden' }}>
        
        {/* Header */}
        <div className="px-5 py-4 border-bottom d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-2">
              <Layers size={22} />
            </div>
            <div>
              <h5 className="mb-0 fw-bold text-zinc-900">Bulk Tags Update</h5>
              <span className="text-zinc-500" style={{ fontSize: '12px' }}>
                <Package size={12} className="me-1" />
                {selectedAsins.length} ASIN{selectedAsins.length !== 1 ? 's' : ''} selected
              </span>
            </div>
          </div>
          <button className="btn btn-ghost p-2 rounded-circle" onClick={onClose} disabled={processing}>
            <X size={20} className="text-zinc-400" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-5 py-3 bg-zinc-50 border-bottom d-flex align-items-center gap-2">
          {[
            { num: 1, label: 'Select Action & Tags' },
            { num: 2, label: 'Review' },
            { num: 3, label: 'Done' }
          ].map((s, idx) => (
            <React.Fragment key={s.num}>
              <div className="d-flex align-items-center gap-2">
                <div className={`rounded-circle d-flex align-items-center justify-content-center fw-bold`}
                  style={{ 
                    width: '28px', height: '28px', fontSize: '12px',
                    background: step === s.num ? '#18181b' : step > s.num ? '#059669' : '#f3f4f6',
                    color: step === s.num ? 'white' : step > s.num ? 'white' : '#9ca3af'
                  }}>
                  {step > s.num ? '✓' : s.num}
                </div>
                <span className={`fw-bold ${step >= s.num ? 'text-zinc-800' : 'text-zinc-400'}`} style={{ fontSize: '11px' }}>
                  {s.label}
                </span>
              </div>
              {idx < 2 && <div className="flex-grow-1" style={{ height: '2px', background: step > s.num ? '#059669' : '#e5e7eb' }} />}
            </React.Fragment>
          ))}
        </div>

        {/* Content */}
        <div className="flex-grow-1 overflow-auto">
          {step === 1 && (
            <div className="p-5">
              {/* Action Selection */}
              <label className="fw-bold text-zinc-800 mb-3 d-block" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Choose Action
              </label>
              <div className="d-flex gap-3 mb-4">
                {[
                  { value: 'replace', icon: <RefreshCw size={18} className="action-icon text-zinc-400" />, title: 'Replace All', desc: 'Replace existing tags with selected ones' },
                  { value: 'add', icon: <Plus size={18} className="action-icon text-green-500" />, title: 'Add Tags', desc: 'Add selected tags, keep existing ones' },
                  { value: 'remove', icon: <Minus size={18} className="action-icon text-red-500" />, title: 'Remove Tags', desc: 'Remove selected tags from all ASINs' }
                ].map(opt => (
                  <button
                    key={opt.value}
                    className={`action-btn ${action === opt.value ? 'active' : ''}`}
                    onClick={() => { setAction(opt.value); setError(null); }}
                  >
                    <div className="mb-1">{opt.icon}</div>
                    <div className="fw-bold" style={{ fontSize: '12px' }}>{opt.title}</div>
                    <div className="action-desc text-zinc-400" style={{ fontSize: '10px', marginTop: '2px' }}>{opt.desc}</div>
                  </button>
                ))}
              </div>

              {/* Custom Tag Input */}
              <label className="fw-bold text-zinc-800 mb-2 d-block" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Create Custom Tag
              </label>
              <div className="d-flex gap-2 mb-3">
                <input
                  type="text"
                  className="form-control rounded-3"
                  placeholder="Type custom tag and press Enter..."
                  value={customInput}
                  onChange={e => setCustomInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomTag(); } }}
                  style={{ fontSize: '12px', height: '40px', border: '1.5px solid #e5e7eb' }}
                />
                <button className="btn btn-dark d-flex align-items-center gap-1 rounded-3 px-4" onClick={addCustomTag}
                  style={{ fontSize: '12px', background: '#18181b', whiteSpace: 'nowrap' }}>
                  <Plus size={14} /> Add
                </button>
              </div>

              {/* Search */}
              <div className="position-relative mb-3">
                <Search size={14} className="position-absolute top-50 start-0 translate-middle-y ms-3 text-zinc-400" />
                <input
                  type="text"
                  className="form-control ps-5 rounded-3"
                  placeholder="Search predefined tags..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ fontSize: '12px', height: '40px', border: '1.5px solid #e5e7eb' }}
                />
              </div>

              {/* Selected Tags */}
              {selectedTags.length > 0 && (
                <div className="mb-3 p-3 bg-zinc-50 rounded-3">
                  <div className="d-flex justify-content-between mb-2">
                    <span className="fw-bold text-zinc-600" style={{ fontSize: '10px', textTransform: 'uppercase' }}>
                      Selected ({selectedTags.length})
                    </span>
                    <button className="btn btn-ghost p-0 text-zinc-400 hover-text-danger" onClick={() => setSelectedTags([])}
                      style={{ fontSize: '10px', fontWeight: 600 }}>
                      Clear All
                    </button>
                  </div>
                  <div className="d-flex flex-wrap gap-1">
                    {selectedTags.map((tag, idx) => {
                      const color = getTagColor(tag);
                      return (
                        <span key={idx} className="badge d-flex align-items-center gap-1.5 shadow-sm"
                          style={{ backgroundColor: color.bg, color: color.text, border: 'none', fontSize: '10px', padding: '5px 12px', borderRadius: '8px', fontWeight: 700 }}>
                          <Tag size={10} className="opacity-70" />
                          {tag}
                          <X size={12} className="ms-1" style={{ cursor: 'pointer', opacity: 0.7 }} onClick={() => setSelectedTags(prev => prev.filter(t => t !== tag))} />
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tags Grid */}
              <div className="d-flex flex-wrap gap-2" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {filteredTags.map((tag, idx) => {
                  const color = getTagColor(tag);
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button key={idx} className={`bulk-tag-item ${isSelected ? 'selected' : ''}`}
                      style={{ 
                        backgroundColor: isSelected ? color.bg : '#f8fafc', 
                        color: isSelected ? color.text : '#475569', 
                        borderColor: isSelected ? 'transparent' : '#e2e8f0',
                        boxShadow: isSelected ? `0 4px 12px ${color.bg}33` : 'none'
                      }}
                      onClick={() => toggleTag(tag)}>
                      {isSelected ? <Check size={12} className="me-1" /> : <Plus size={12} className="me-1 opacity-40" />}
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Review */}
          {step === 2 && (
            <div className="p-5 text-center">
              <div className="p-4 bg-indigo-50 rounded-circle d-inline-flex mb-4">
                <Layers size={40} className="text-indigo-600" />
              </div>
              <h5 className="fw-bold mb-2">Ready to Apply</h5>
              <p className="text-zinc-500 mb-4" style={{ fontSize: '13px' }}>
                This will <strong>{action}</strong> the following tags {action === 'add' ? 'to' : action === 'remove' ? 'from' : 'on'} <strong>{selectedAsins.length} ASINs</strong>
              </p>
              <div className="d-flex flex-wrap gap-2 justify-content-center mb-4">
                {selectedTags.map((tag, idx) => {
                  const color = getTagColor(tag);
                  return (
                    <span key={idx} className="badge shadow-sm" style={{ backgroundColor: color.bg, color: color.text, border: 'none', fontSize: '12px', padding: '8px 16px', borderRadius: '10px', fontWeight: 700 }}>
                      {tag}
                    </span>
                  );
                })}
              </div>
              {action === 'replace' && (
                <div className="alert alert-warning rounded-3 text-start" style={{ fontSize: '12px' }}>
                  <AlertCircle size={14} className="me-1" />
                  <strong>Replace</strong> will remove all existing tags and set only the selected ones.
                </div>
              )}
            </div>
          )}

          {/* Step 3: Result */}
          {step === 3 && result && (
            <div className="p-5 text-center">
              <div className="p-4 bg-success-subtle rounded-circle d-inline-flex mb-4">
                <Check size={40} className="text-success" />
              </div>
              <h5 className="fw-bold mb-2">Tags Updated!</h5>
              <div className="d-flex gap-4 justify-content-center mt-3">
                <div className="text-center">
                  <div className="fw-bold text-success" style={{ fontSize: '24px' }}>{result.updated}</div>
                  <div className="text-zinc-400" style={{ fontSize: '11px' }}>Updated</div>
                </div>
                <div className="text-center">
                  <div className="fw-bold text-zinc-400" style={{ fontSize: '24px' }}>{result.skipped || 0}</div>
                  <div className="text-zinc-400" style={{ fontSize: '11px' }}>Unchanged</div>
                </div>
                <div className="text-center">
                  <div className="fw-bold text-zinc-900" style={{ fontSize: '24px' }}>{result.total}</div>
                  <div className="text-zinc-400" style={{ fontSize: '11px' }}>Total</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="px-5 py-2 bg-danger-subtle text-danger d-flex align-items-center gap-2" style={{ fontSize: '12px' }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-4 border-top bg-white d-flex justify-content-between align-items-center">
          <span className="text-zinc-400" style={{ fontSize: '11px' }}>
            {selectedAsins.length} ASINs selected
          </span>
          <div className="d-flex gap-3">
            {step === 1 && (
              <>
                <button className="btn btn-outline-secondary fw-bold rounded-3 px-4" onClick={onClose} style={{ fontSize: '13px', height: '42px' }}>
                  Cancel
                </button>
                <button 
                  className="btn btn-dark fw-bold rounded-3 px-5 d-flex align-items-center gap-2"
                  onClick={() => setStep(2)}
                  disabled={selectedTags.length === 0}
                  style={{ fontSize: '13px', height: '42px', background: '#18181b' }}>
                  Review <ArrowRight size={14} />
                </button>
              </>
            )}
            {step === 2 && (
              <>
                <button className="btn btn-outline-secondary fw-bold rounded-3 px-4" onClick={() => setStep(1)} style={{ fontSize: '13px', height: '42px' }}>
                  Back
                </button>
                <button 
                  className="btn btn-dark fw-bold rounded-3 px-5 d-flex align-items-center gap-2"
                  onClick={handleApply}
                  disabled={processing}
                  style={{ fontSize: '13px', height: '42px', background: '#18181b' }}>
                  {processing ? <RefreshCw size={14} className="spin" /> : <Save size={14} />}
                  {processing ? 'Applying...' : 'Apply Tags'}
                </button>
              </>
            )}
            {step === 3 && (
              <button className="btn btn-dark fw-bold rounded-3 px-4" onClick={onClose} style={{ fontSize: '13px', height: '42px', background: '#18181b' }}>
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default BulkTagsModal;
