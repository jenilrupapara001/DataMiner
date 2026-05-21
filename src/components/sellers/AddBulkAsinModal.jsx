// components/asins/AddBulkAsinModal.jsx

import React, {
  useState, useCallback, useMemo,
  useEffect, useRef, memo
} from 'react';
import {
  Modal, Button, Input, Tag, Space,
  Typography, Divider, Alert, Tooltip
} from 'antd';
import {
  Plus, Scan, RefreshCw,
  CheckCircle2, AlertCircle, X, Copy, Info
} from 'lucide-react';

const { Text, Title } = Typography;
const { TextArea } = Input;

// ─── ASIN validation ──────────────────────────────────────────────────────────
// Amazon ASINs are exactly 10 alphanumeric characters (B + 9 chars for products)

const ASIN_REGEX = /^[A-Z0-9]{10}$/i;

function parseAsins(raw) {
  const tokens = raw
    .split(/[\n,;\s]+/)
    .map(t => t.trim().toUpperCase())
    .filter(Boolean);

  const seen = new Set();
  const valid = [];
  const invalid = [];

  tokens.forEach(t => {
    if (seen.has(t)) return; // deduplicate
    seen.add(t);
    if (ASIN_REGEX.test(t)) valid.push(t);
    else invalid.push(t);
  });

  return { valid, invalid };
}

// ─── Component ────────────────────────────────────────────────────────────────

const AddBulkAsinModal = memo(({ seller, onClose, onAdd, isSubmitting = false }) => {
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const textAreaRef = useRef(null);

  // Auto-focus textarea on open
  useEffect(() => {
    const timer = setTimeout(() => textAreaRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  // Parse & validate ASINs in real time
  const { valid, invalid } = useMemo(() => parseAsins(text), [text]);

  const hasContent = text.trim().length > 0;
  const canSubmit = valid.length > 0 && !isSubmitting;
  const showValidation = hasContent;

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitted(true);
    try {
      await onAdd(valid);
      setText('');
    } finally {
      setSubmitted(false);
    }
  }, [canSubmit, valid, onAdd]);

  // Ctrl+Enter to submit
  const handleKeyDown = useCallback((e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      void handleSubmit();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  }, [handleSubmit, onClose]);

  // Paste + auto-clean
  const handlePaste = useCallback((e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    // Normalise separators on paste
    const normalised = pasted.replace(/[,;\t]+/g, '\n').trim();
    setText(prev => prev ? `${prev}\n${normalised}` : normalised);
  }, []);

  // Copy valid ASINs
  const handleCopyValid = useCallback(() => {
    navigator.clipboard.writeText(valid.join('\n'));
  }, [valid]);

  // Clear all
  const handleClear = useCallback(() => {
    setText('');
    textAreaRef.current?.focus();
  }, []);

  const sellerName = seller?.name || 'this seller';

  return (
    <Modal
      open={true}
      onCancel={onClose}
      width={520}
      footer={null}
      closable={false}
      destroyOnHidden
      styles={{
        content: { borderRadius: 16, overflow: 'hidden', padding: 0 },
        body: { padding: 0 }
      }}
    >
      {/* ── Header ──────────────────────────────────────────────── */}
      <div style={{
        padding: '20px 24px 16px',
        background: 'linear-gradient(135deg, #0f172a, #1e293b)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 11,
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0
          }}>
            <Plus size={20} color="#fff" />
          </div>
          <div>
            <div style={{ color: '#fff', fontSize: 16, fontWeight: 800, lineHeight: '20px' }}>
              Add ASINs
            </div>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 2 }}>
              → {sellerName}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close modal"
          style={{
            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 8, width: 30, height: 30, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff'
          }}
        >
          <X size={15} />
        </button>
      </div>

      {/* ── Body ────────────────────────────────────────────────── */}
      <div style={{ padding: '20px 24px', background: '#fff' }}>

        {/* Instruction */}
        <div style={{
          display: 'flex', gap: 10, padding: '10px 14px',
          background: '#f0f9ff', border: '1px solid #bae6fd',
          borderRadius: 9, marginBottom: 16
        }}>
          <Info size={15} color="#0284c7" style={{ flexShrink: 0, marginTop: 1 }} />
          <Text style={{ fontSize: 12, color: '#075985', lineHeight: '18px' }}>
            Enter ASINs separated by <strong>commas, spaces, or new lines</strong>.
            Duplicates are automatically removed.
            Press <kbd style={{ background: '#e0f2fe', padding: '1px 5px', borderRadius: 4, fontSize: 11, fontFamily: 'monospace' }}>Ctrl+Enter</kbd> to submit.
          </Text>
        </div>

        {/* Label row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <label style={{
            fontSize: 11, fontWeight: 700, color: '#475569',
            letterSpacing: '0.05em', textTransform: 'uppercase',
            display: 'flex', alignItems: 'center', gap: 5
          }}>
            <Scan size={13} color="#64748b" /> ASIN List
          </label>
          {hasContent && (
            <Button type="text" size="small" icon={<X size={11} />}
              onClick={handleClear}
              style={{ fontSize: 11, color: '#94a3b8', height: 'auto', padding: '2px 6px' }}>
              Clear
            </Button>
          )}
        </div>

        {/* Textarea */}
        <TextArea
          ref={textAreaRef}
          rows={7}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={`B07X6C9RMF\nB08N5WRWNW\nB08L5TNJHK\n\n...or paste a comma-separated list`}
          style={{
            fontFamily: 'monospace', fontSize: 12,
            borderRadius: 10, lineHeight: '20px',
            resize: 'vertical', border: '1.5px solid #e2e8f0'
          }}
          aria-label="ASIN input"
          aria-describedby="asin-hint"
        />
        <div id="asin-hint" style={{ fontSize: 10, color: '#94a3b8', marginTop: 5, fontStyle: 'italic' }}>
          Valid ASINs are exactly 10 alphanumeric characters (e.g. B07X6C9RMF)
        </div>

        {/* ── Live validation preview ──────────────────────── */}
        {showValidation && (
          <div style={{ marginTop: 14 }}>
            <Divider style={{ margin: '0 0 12px' }} />

            <div style={{ display: 'flex', gap: 10 }}>
              {/* Valid count */}
              <div style={{
                flex: 1, padding: '10px 14px', borderRadius: 9,
                background: valid.length > 0 ? '#f0fdf4' : '#f8fafc',
                border: `1.5px solid ${valid.length > 0 ? '#86efac' : '#e2e8f0'}`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <CheckCircle2 size={14} color={valid.length > 0 ? '#16a34a' : '#94a3b8'} />
                  <Text style={{ fontSize: 11, fontWeight: 700, color: valid.length > 0 ? '#15803d' : '#94a3b8' }}>
                    {valid.length} Valid ASIN{valid.length !== 1 ? 's' : ''}
                  </Text>
                  {valid.length > 0 && (
                    <Tooltip title="Copy valid ASINs">
                      <Button type="text" size="small"
                        icon={<Copy size={10} />}
                        onClick={handleCopyValid}
                        style={{ marginLeft: 'auto', padding: '0 4px', height: 'auto', color: '#16a34a' }}
                      />
                    </Tooltip>
                  )}
                </div>
                {/* Show first 5 valid ASINs */}
                {valid.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {valid.slice(0, 5).map(asin => (
                      <Tag key={asin} style={{
                        fontFamily: 'monospace', fontSize: 10, fontWeight: 700,
                        borderRadius: 4, margin: 0,
                        background: '#dcfce7', border: '1px solid #bbf7d0', color: '#15803d'
                      }}>
                        {asin}
                      </Tag>
                    ))}
                    {valid.length > 5 && (
                      <Tag style={{
                        fontSize: 10, borderRadius: 4, margin: 0,
                        background: '#dcfce7', border: '1px solid #bbf7d0', color: '#15803d'
                      }}>
                        +{valid.length - 5} more
                      </Tag>
                    )}
                  </div>
                )}
              </div>

              {/* Invalid count */}
              {invalid.length > 0 && (
                <div style={{
                  flex: 1, padding: '10px 14px', borderRadius: 9,
                  background: '#fef2f2', border: '1.5px solid #fca5a5'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <AlertCircle size={14} color="#dc2626" />
                    <Text style={{ fontSize: 11, fontWeight: 700, color: '#dc2626' }}>
                      {invalid.length} Invalid
                    </Text>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {invalid.slice(0, 4).map(val => (
                      <Tag key={val} style={{
                        fontFamily: 'monospace', fontSize: 10,
                        borderRadius: 4, margin: 0,
                        background: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626'
                      }}>
                        {val}
                      </Tag>
                    ))}
                    {invalid.length > 4 && (
                      <Tag style={{
                        fontSize: 10, borderRadius: 4, margin: 0,
                        background: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626'
                      }}>
                        +{invalid.length - 4} more
                      </Tag>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Only-invalid warning */}
            {hasContent && valid.length === 0 && invalid.length > 0 && (
              <Alert
                type="warning"
                showIcon
                message="No valid ASINs found"
                description="ASINs must be exactly 10 alphanumeric characters. Check your input."
                style={{ marginTop: 10, borderRadius: 9, fontSize: 12 }}
              />
            )}
          </div>
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <div style={{
        padding: '12px 24px 20px',
        background: '#fafafa',
        borderTop: '1px solid #f1f5f9',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <Text style={{ fontSize: 11, color: '#94a3b8' }}>
          {valid.length > 0
            ? `Ready to add ${valid.length} ASIN${valid.length !== 1 ? 's' : ''}`
            : 'Paste or type your ASINs above'
          }
        </Text>

        <Space size={8}>
          <Button
            onClick={onClose}
            style={{ borderRadius: 9, fontWeight: 600, height: 38, paddingInline: 18 }}
          >
            Cancel
          </Button>
          <Button
            type="primary"
            icon={
              isSubmitting
                ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                : <Plus size={14} />
            }
            onClick={handleSubmit}
            disabled={!canSubmit}
            loading={isSubmitting}
            style={{
              borderRadius: 9, fontWeight: 700, height: 38, paddingInline: 22,
              background: canSubmit ? '#0f172a' : undefined,
              borderColor: canSubmit ? '#0f172a' : undefined,
            }}
            aria-label={`Add ${valid.length} ASINs to inventory`}
          >
            {isSubmitting
              ? 'Adding...'
              : valid.length > 0
                ? `Add ${valid.length} ASIN${valid.length !== 1 ? 's' : ''}`
                : 'Add to Inventory'
            }
          </Button>
        </Space>
      </div>

      <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
    </Modal>
  );
});

export default AddBulkAsinModal;