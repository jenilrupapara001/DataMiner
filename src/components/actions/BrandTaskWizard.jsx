import React, { useState, useMemo, useEffect } from 'react';
import {
  X, ChevronRight, ChevronLeft, Building2, Package,
  Check, Search, Calendar, Users, Tag, Star, Image,
  List, FileText, Zap, AlertCircle, Plus, Trash2
} from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { OPT_TYPES } from './BrandTaskCard';

// ═══════════════════════════════════════════════════════════════
// STEP INDICATOR
// ═══════════════════════════════════════════════════════════════
const STEPS = [
  { id: 1, label: 'Brand', icon: Building2 },
  { id: 2, label: 'ASINs', icon: Package },
  { id: 3, label: 'Tasks', icon: Tag },
  { id: 4, label: 'Assign', icon: Users },
  { id: 5, label: 'Review', icon: Check },
];

const StepIndicator = ({ current }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, padding: '20px 24px 0' }}>
    {STEPS.map((step, idx) => {
      const done = current > step.id;
      const active = current === step.id;
      const StepIcon = step.icon;
      return (
        <React.Fragment key={step.id}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: done ? '#10b981' : active ? '#6366f1' : '#f1f5f9',
              color: done || active ? '#ffffff' : '#94a3b8',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 13,
              border: `2px solid ${done ? '#10b981' : active ? '#6366f1' : '#e2e8f0'}`,
              transition: 'all 0.3s',
              boxShadow: active ? '0 4px 12px -2px rgba(99,102,241,0.4)' : 'none'
            }}>
              {done ? <Check size={16} strokeWidth={2.5} /> : <StepIcon size={15} strokeWidth={2.5} />}
            </div>
            <span style={{
              fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
              color: done ? '#10b981' : active ? '#6366f1' : '#94a3b8'
            }}>{step.label}</span>
          </div>
          {idx < STEPS.length - 1 && (
            <div style={{
              height: 2, flex: 1, marginBottom: 20,
              background: done ? '#10b981' : '#e2e8f0',
              transition: 'background 0.3s', maxWidth: 60
            }} />
          )}
        </React.Fragment>
      );
    })}
  </div>
);

// ═══════════════════════════════════════════════════════════════
// STEP 1: SELECT BRAND
// ═══════════════════════════════════════════════════════════════
const Step1Brand = ({ sellers, selectedSeller, onSelect }) => {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() =>
    sellers.filter(s =>
      (s.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.marketplace || '').toLowerCase().includes(search.toLowerCase())
    ),
    [sellers, search]
  );

  return (
    <div>
      <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Select Brand / Seller</h3>
      <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>Choose the seller account to create brand-level optimization tasks for.</p>

      <div style={{ position: 'relative', marginBottom: 12 }}>
        <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search brands..."
          style={{ width: '100%', padding: '8px 10px 8px 30px', fontSize: 12, fontWeight: 600, borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#ffffff', outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px', color: '#94a3b8', fontSize: 12 }}>No brands found</div>
        )}
        {filtered.map(seller => {
          const sid = seller._id || seller.id;
          const isSelected = (selectedSeller?._id || selectedSeller?.id) === sid;
          return (
            <div
              key={sid}
              onClick={() => onSelect(seller)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
                border: `2px solid ${isSelected ? '#6366f1' : '#e2e8f0'}`,
                background: isSelected ? '#f5f3ff' : '#ffffff',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = '#c7d2fe'; }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = '#e2e8f0'; }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: isSelected ? '#ede9fe' : '#f8fafc',
                border: `1px solid ${isSelected ? '#c4b5fd' : '#e2e8f0'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: isSelected ? '#6366f1' : '#94a3b8', flexShrink: 0
              }}>
                <Building2 size={18} strokeWidth={2.5} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{seller.name || 'Unknown'}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  {seller.marketplace && <span>{seller.marketplace}</span>}
                  {seller.managers?.length > 0 && (
                    <span style={{ marginLeft: 8 }}>• {seller.managers.map(m => `${m.firstName || ''} ${m.lastName || ''}`.trim()).filter(Boolean).join(', ')}</span>
                  )}
                </div>
              </div>
              {isSelected && (
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Check size={13} color="#ffffff" strokeWidth={2.5} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// STEP 2: SELECT ASINs
// ═══════════════════════════════════════════════════════════════
const Step2Asins = ({ asins, selectedAsins, onToggle, onSelectAll, seller }) => {
  const [search, setSearch] = useState('');
  const sellerAsins = useMemo(() => {
    const sid = seller?._id || seller?.id;
    if (!sid) return asins;
    return asins.filter(a => {
      const asinSellerId = a.sellerId?._id || a.sellerId?.id || a.sellerId;
      return !asinSellerId || asinSellerId.toString() === sid.toString();
    });
  }, [asins, seller]);

  const filtered = useMemo(() =>
    sellerAsins.filter(a => {
      const code = (a.asinCode || a.asin || '').toLowerCase();
      const title = (a.title || a.productTitle || '').toLowerCase();
      const q = search.toLowerCase();
      return !q || code.includes(q) || title.includes(q);
    }),
    [sellerAsins, search]
  );

  const allSelected = filtered.length > 0 && filtered.every(a => selectedAsins.includes(a._id || a.id));

  return (
    <div>
      <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Select ASINs</h3>
      <p style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
        Choose which ASINs from <strong>{seller?.name}</strong> need optimization. ({selectedAsins.length} selected)
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search ASIN or title..."
            style={{ width: '100%', padding: '7px 10px 7px 30px', fontSize: 12, fontWeight: 600, borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#ffffff', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <button
          onClick={() => onSelectAll(filtered, !allSelected)}
          style={{
            padding: '7px 14px', fontSize: 11, fontWeight: 700, borderRadius: 10, cursor: 'pointer',
            border: `1.5px solid ${allSelected ? '#ef4444' : '#6366f1'}`,
            background: allSelected ? '#fef2f2' : '#f5f3ff',
            color: allSelected ? '#ef4444' : '#6366f1'
          }}
        >
          {allSelected ? 'Deselect All' : `Select All (${filtered.length})`}
        </button>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px', color: '#94a3b8', fontSize: 12 }}>
          {sellerAsins.length === 0 ? `No ASINs found for ${seller?.name}` : 'No ASINs match search'}
        </div>
      ) : (
        <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '8px 12px', width: 40, textAlign: 'center' }}></th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#475569' }}>ASIN</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#475569' }}>Title</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((asin, i) => {
                const id = asin._id || asin.id;
                const isSelected = selectedAsins.includes(id);
                return (
                  <tr
                    key={id || i}
                    onClick={() => onToggle(id)}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      background: isSelected ? '#f5f3ff' : i % 2 === 0 ? '#ffffff' : '#fafbfc',
                      cursor: 'pointer', transition: 'background 0.15s'
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f8fafc'; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = i % 2 === 0 ? '#ffffff' : '#fafbfc'; }}
                  >
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: 5,
                        border: `2px solid ${isSelected ? '#6366f1' : '#e2e8f0'}`,
                        background: isSelected ? '#6366f1' : '#ffffff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 'auto'
                      }}>
                        {isSelected && <Check size={11} color="#ffffff" strokeWidth={3} />}
                      </div>
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <code style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', background: '#f0f0ff', padding: '2px 7px', borderRadius: 5 }}>
                        {asin.asinCode || asin.asin || id}
                      </code>
                    </td>
                    <td style={{ padding: '8px 12px', color: '#475569', maxWidth: 240 }}>
                      <span style={{ display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {asin.title || asin.productTitle || '—'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// STEP 3: SELECT OPTIMIZATION CATEGORIES
// ═══════════════════════════════════════════════════════════════
const Step3Tasks = ({ selectedTypes, onToggle }) => {
  const types = Object.entries(OPT_TYPES).map(([key, val]) => ({ key, ...val }));
  return (
    <div>
      <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Optimization Categories</h3>
      <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
        Select which types of optimization this brand needs. One task will be created per selected category.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {types.map(type => {
          const isSelected = selectedTypes.includes(type.key);
          const TypeIcon = type.icon;
          return (
            <div
              key={type.key}
              onClick={() => onToggle(type.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                border: `2px solid ${isSelected ? type.color : '#e2e8f0'}`,
                background: isSelected ? type.bg : '#ffffff',
                transition: 'all 0.2s', userSelect: 'none'
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 9,
                background: isSelected ? `${type.color}20` : '#f8fafc',
                border: `1px solid ${isSelected ? type.border : '#e2e8f0'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: isSelected ? type.color : '#94a3b8', flexShrink: 0
              }}>
                <TypeIcon size={17} strokeWidth={2} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: isSelected ? type.color : '#1e293b' }}>
                  {type.label}
                </div>
                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                  {type.key === 'TITLE_OPTIMIZATION' && 'Enhance title length & keywords'}
                  {type.key === 'A_PLUS_CONTENT' && 'Rich A+ content & EBC modules'}
                  {type.key === 'IMAGE_OPTIMIZATION' && 'High-quality images & infographics'}
                  {type.key === 'BULLET_POINTS' && 'Compelling bullet points'}
                  {type.key === 'DESCRIPTION_OPTIMIZATION' && 'Expand product description'}
                  {type.key === 'GENERAL_OPTIMIZATION' && 'Overall listing quality score'}
                </div>
              </div>
              {isSelected && (
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: type.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Check size={12} color="#ffffff" strokeWidth={2.5} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// STEP 4: ASSIGN & SCHEDULE
// ═══════════════════════════════════════════════════════════════
const Step4Assign = ({ users, sellers, formData, onChange }) => (
  <div>
    <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Assignment & Schedule</h3>
    <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>Assign tasks and set deadlines. These settings apply to all created tasks.</p>

    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Task title template */}
      <div>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Task Title Prefix
        </label>
        <input
          value={formData.titlePrefix}
          onChange={e => onChange('titlePrefix', e.target.value)}
          placeholder="e.g. Q3 Optimization —"
          style={{ width: '100%', padding: '10px 12px', fontSize: 13, fontWeight: 600, borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#ffffff', outline: 'none', boxSizing: 'border-box' }}
        />
        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>
          Tasks will be named: "{formData.titlePrefix || '[Prefix]'} — Title Optimization" etc.
        </div>
      </div>

      {/* Priority */}
      <div>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Priority
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { key: 'LOW', color: '#64748b', bg: '#f8fafc' },
            { key: 'MEDIUM', color: '#3b82f6', bg: '#eff6ff' },
            { key: 'HIGH', color: '#f59e0b', bg: '#fffbeb' },
            { key: 'URGENT', color: '#ef4444', bg: '#fef2f2' },
          ].map(p => (
            <button
              key={p.key}
              onClick={() => onChange('priority', p.key)}
              style={{
                flex: 1, padding: '8px 0', fontSize: 11, fontWeight: 700, borderRadius: 10, cursor: 'pointer',
                border: `2px solid ${formData.priority === p.key ? p.color : '#e2e8f0'}`,
                background: formData.priority === p.key ? p.bg : '#ffffff',
                color: formData.priority === p.key ? p.color : '#64748b', transition: 'all 0.2s'
              }}
            >
              {p.key}
            </button>
          ))}
        </div>
      </div>

      {/* Assigned To */}
      <div>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Assign To
        </label>
        <select
          value={formData.assignedTo}
          onChange={e => onChange('assignedTo', e.target.value)}
          style={{ width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#ffffff', outline: 'none' }}
        >
          <option value="">Unassigned</option>
          {users.map(u => (
            <option key={u._id || u.id} value={u._id || u.id}>
              {u.firstName ? `${u.firstName} ${u.lastName || ''}`.trim() : (u.name || u.email)}
            </option>
          ))}
        </select>
      </div>

      {/* Deadline */}
      <div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <Calendar size={11} /> Deadline
        </label>
        <DatePicker
          selected={formData.deadline}
          onChange={date => onChange('deadline', date)}
          dateFormat="MMM d, yyyy"
          placeholderText="Select deadline..."
          minDate={new Date()}
          className="brand-wizard-datepicker"
          wrapperClassName="brand-wizard-datepicker-wrapper"
        />
      </div>

      {/* Description */}
      <div>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Notes / Instructions
        </label>
        <textarea
          value={formData.description}
          onChange={e => onChange('description', e.target.value)}
          placeholder="Add detailed instructions for the assignee..."
          rows={3}
          style={{ width: '100%', padding: '10px 12px', fontSize: 12, borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#ffffff', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
        />
      </div>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════
// STEP 5: REVIEW & CREATE
// ═══════════════════════════════════════════════════════════════
const Step5Review = ({ seller, selectedAsins, selectedTypes, formData, asins }) => {
  const types = Object.entries(OPT_TYPES).filter(([k]) => selectedTypes.includes(k));
  const asinDatas = asins.filter(a => selectedAsins.includes(a._id || a.id));

  return (
    <div>
      <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Review & Create Tasks</h3>
      <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
        <strong>{selectedTypes.length} tasks</strong> will be created for <strong>{seller?.name}</strong> with <strong>{selectedAsins.length} ASINs</strong> each.
      </p>

      {/* Summary card */}
      <div style={{ background: '#f5f3ff', border: '1.5px solid #ddd6fe', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Brand</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{seller?.name}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Priority</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{formData.priority}</div>
          </div>
          {formData.deadline && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Deadline</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{formData.deadline.toLocaleDateString()}</div>
            </div>
          )}
          {formData.assignedTo && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Assigned To</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>User selected</div>
            </div>
          )}
        </div>
      </div>

      {/* Tasks to be created */}
      <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
        Tasks to be created ({types.length})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {types.map(([key, cfg]) => (
          <div key={key} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: 10,
            background: cfg.bg, border: `1px solid ${cfg.border}`
          }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: `${cfg.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cfg.color, flexShrink: 0 }}>
              <cfg.icon size={14} strokeWidth={2} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>
                {formData.titlePrefix ? `${formData.titlePrefix} — ` : ''}{cfg.label}
              </div>
              <div style={{ fontSize: 10, color: '#64748b' }}>{selectedAsins.length} ASINs attached</div>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, background: '#f1f5f9', color: '#64748b', padding: '3px 8px', borderRadius: 8 }}>
              PENDING
            </span>
          </div>
        ))}
      </div>

      {/* ASIN preview */}
      <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
        ASINs Included ({asinDatas.length})
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 100, overflowY: 'auto' }}>
        {asinDatas.map((asin, i) => (
          <code key={i} style={{
            fontSize: 11, fontWeight: 700, color: '#6366f1',
            background: '#f0f0ff', border: '1px solid #c7d2fe',
            padding: '3px 8px', borderRadius: 6
          }}>
            {asin.asinCode || asin.asin || asin._id || asin.id}
          </code>
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MAIN WIZARD
// ═══════════════════════════════════════════════════════════════
const BrandTaskWizard = ({ isOpen, onClose, sellers = [], asins = [], users = [], onSaveMultiple }) => {
  const [step, setStep] = useState(1);
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [selectedAsinIds, setSelectedAsinIds] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [formData, setFormData] = useState({
    titlePrefix: '',
    priority: 'MEDIUM',
    assignedTo: '',
    deadline: null,
    description: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setSelectedSeller(null);
      setSelectedAsinIds([]);
      setSelectedTypes([]);
      setFormData({ titlePrefix: '', priority: 'MEDIUM', assignedTo: '', deadline: null, description: '' });
      setError('');
    }
  }, [isOpen]);

  const toggleAsin = (id) => setSelectedAsinIds(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  const selectAllAsins = (list, select) => {
    if (select) {
      const ids = list.map(a => a._id || a.id);
      setSelectedAsinIds(prev => [...new Set([...prev, ...ids])]);
    } else {
      const ids = list.map(a => a._id || a.id);
      setSelectedAsinIds(prev => prev.filter(id => !ids.includes(id)));
    }
  };

  const toggleType = (key) => setSelectedTypes(prev =>
    prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key]
  );

  const canNext = () => {
    if (step === 1) return !!selectedSeller;
    if (step === 2) return selectedAsinIds.length > 0;
    if (step === 3) return selectedTypes.length > 0;
    if (step === 4) return true;
    return true;
  };

  const handleCreate = async () => {
    if (!selectedSeller || selectedAsinIds.length === 0 || selectedTypes.length === 0) {
      setError('Please complete all required steps.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const sellerId = selectedSeller._id || selectedSeller.id;
      const tasks = selectedTypes.map(type => ({
        title: formData.titlePrefix
          ? `${formData.titlePrefix} — ${OPT_TYPES[type]?.label || type}`
          : `${selectedSeller.name} — ${OPT_TYPES[type]?.label || type}`,
        type,
        priority: formData.priority,
        status: 'PENDING',
        sellerId,
        asins: selectedAsinIds,
        assignedTo: formData.assignedTo || undefined,
        description: formData.description || undefined,
        timeTracking: formData.deadline ? { deadline: formData.deadline } : undefined,
        scopeType: 'ASIN',
        aiGenerated: false
      }));
      await onSaveMultiple(tasks);
      onClose();
    } catch (err) {
      setError('Failed to create tasks. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(15,23,42,0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px'
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#ffffff', borderRadius: 20, width: '100%', maxWidth: 640,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 60px -15px rgba(0,0,0,0.3)',
        overflow: 'hidden', animation: 'wizardIn 0.3s cubic-bezier(0.34,1.56,0.64,1)'
      }}>

        {/* Header */}
        <div style={{
          padding: '20px 24px 0',
          background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
          borderBottom: '1px solid #e8e4fd'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 11,
                background: 'linear-gradient(135deg, #6366f1, #7c3aed)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#ffffff', boxShadow: '0 6px 16px -4px rgba(99,102,241,0.5)'
              }}>
                <Building2 size={20} strokeWidth={2.5} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Brand Task Wizard</h2>
                <p style={{ margin: 0, fontSize: 11, color: '#7c3aed' }}>Create optimization tasks grouped by brand</p>
              </div>
            </div>
            <button onClick={onClose} style={{ padding: 8, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, cursor: 'pointer', color: '#64748b', display: 'flex' }}>
              <X size={16} />
            </button>
          </div>
          <StepIndicator current={step} />
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, marginBottom: 16, fontSize: 12, color: '#ef4444' }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {step === 1 && <Step1Brand sellers={sellers} selectedSeller={selectedSeller} onSelect={setSelectedSeller} />}
          {step === 2 && <Step2Asins asins={asins} selectedAsins={selectedAsinIds} onToggle={toggleAsin} onSelectAll={selectAllAsins} seller={selectedSeller} />}
          {step === 3 && <Step3Tasks selectedTypes={selectedTypes} onToggle={toggleType} />}
          {step === 4 && <Step4Assign users={users} sellers={sellers} formData={formData} onChange={(k, v) => setFormData(prev => ({ ...prev, [k]: v }))} />}
          {step === 5 && <Step5Review seller={selectedSeller} selectedAsins={selectedAsinIds} selectedTypes={selectedTypes} formData={formData} asins={asins} />}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid #f1f5f9',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: '#fafbfc'
        }}>
          <button
            onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '9px 16px', background: '#ffffff', color: '#64748b',
              border: '1.5px solid #e2e8f0', borderRadius: 10,
              fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            <ChevronLeft size={14} /> {step > 1 ? 'Back' : 'Cancel'}
          </button>

          <div style={{ display: 'flex', gap: 6 }}>
            {STEPS.map(s => (
              <div key={s.id} style={{
                width: 8, height: 8, borderRadius: '50%',
                background: step === s.id ? '#6366f1' : step > s.id ? '#10b981' : '#e2e8f0',
                transition: 'all 0.3s'
              }} />
            ))}
          </div>

          {step < 5 ? (
            <button
              onClick={() => canNext() && setStep(s => s + 1)}
              disabled={!canNext()}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '9px 20px',
                background: canNext() ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : '#f1f5f9',
                color: canNext() ? '#ffffff' : '#94a3b8',
                border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700,
                cursor: canNext() ? 'pointer' : 'not-allowed',
                boxShadow: canNext() ? '0 4px 12px -2px rgba(99,102,241,0.4)' : 'none',
                transition: 'all 0.2s'
              }}
            >
              Continue <ChevronRight size={14} />
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={saving}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '9px 20px',
                background: saving ? '#f1f5f9' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: saving ? '#94a3b8' : '#ffffff',
                border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer',
                boxShadow: saving ? 'none' : '0 4px 12px -2px rgba(16,185,129,0.4)',
                transition: 'all 0.2s'
              }}
            >
              {saving ? 'Creating...' : (
                <><Check size={14} strokeWidth={2.5} /> Create {selectedTypes.length} Task{selectedTypes.length !== 1 ? 's' : ''}</>
              )}
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes wizardIn {
          from { opacity: 0; transform: scale(0.92) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .brand-wizard-datepicker-wrapper { width: 100%; }
        .brand-wizard-datepicker {
          width: 100% !important;
          padding: 10px 12px;
          font-size: 13px;
          font-weight: 600;
          border-radius: 10px;
          border: 1.5px solid #e2e8f0;
          background: #ffffff;
          outline: none;
          box-sizing: border-box;
        }
      `}</style>
    </div>
  );
};

export default BrandTaskWizard;
