import React, { useState, useEffect } from 'react';
import { settingsApi } from '../../services/api';
import {
  ToggleLeft, ToggleRight, Zap, RefreshCw, AlertCircle, Check
} from 'lucide-react';

const OctoparseAutomationToggle = () => {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await settingsApi.getOctoparseAutomation();
      if (res.success) {
        setEnabled(res.data.enabled);
      }
    } catch (err) {
      console.error('Failed to fetch automation status:', err);
    }
    setLoading(false);
  };

  const handleToggle = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const newState = !enabled;
      const res = await settingsApi.toggleOctoparseAutomation(newState);

      if (res.success) {
        setEnabled(newState);
        setMessage({ type: 'success', text: res.message });
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.error || 'Failed to toggle automation'
      });
    }
    setSaving(false);

    // Clear message after 3 seconds
    setTimeout(() => setMessage(null), 3000);
  };

  if (loading) {
    return (
      <div className="card border-zinc-200 shadow-sm mb-3">
        <div className="card-body p-4">
          <div className="placeholder-glow">
            <span className="placeholder col-6"></span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card border-zinc-200 shadow-sm mb-3 overflow-hidden">
      <div className="card-body p-0">
        <div className="d-flex align-items-center justify-content-between p-4">
          <div className="d-flex align-items-center gap-3">
            <div
              className="d-flex align-items-center justify-content-center rounded-3"
              style={{
                width: '44px',
                height: '44px',
                background: enabled ? '#ecfdf5' : '#fef2f2',
                color: enabled ? '#059669' : '#ef4444'
              }}
            >
              {enabled ? <Zap size={22} /> : <Zap size={22} className="opacity-50" />}
            </div>
            <div>
              <h6 className="mb-1 fw-bold text-zinc-900">Automation</h6>
              <p className="mb-0 text-zinc-500" style={{ fontSize: '13px' }}>
                {enabled
                  ? 'Auto-scraping is active — new ASINs will be synced automatically'
                  : 'Auto-scraping is paused — manual sync required for all ASINs'}
              </p>
            </div>
          </div>

          <button
            onClick={handleToggle}
            disabled={saving}
            className="btn p-0 border-0 bg-transparent"
            style={{ cursor: 'pointer' }}
            aria-label={enabled ? 'Disable automation' : 'Enable automation'}
          >
            {enabled ? (
              <ToggleRight size={48} className="text-success" />
            ) : (
              <ToggleLeft size={48} className="text-zinc-300" />
            )}
          </button>
        </div>

        {/* Status Message */}
        {message && (
          <div
            className={`px-4 py-2 d-flex align-items-center gap-2 smallest fw-bold ${message.type === 'success'
                ? 'bg-success-subtle text-success'
                : 'bg-danger-subtle text-danger'
              }`}
            style={{ fontSize: '12px' }}
          >
            {message.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
            {message.text}
          </div>
        )}

        {/* Additional Info */}
        <div className="px-4 pb-4 pt-2 border-top bg-zinc-50">
          <div className="d-flex align-items-center gap-2 mt-3">
            <RefreshCw size={12} className="text-zinc-400" />
            <span className="text-zinc-500" style={{ fontSize: '11px' }}>
              {enabled
                ? 'Octoparse will automatically inject URLs and start scraping when new ASINs are added'
                : 'You can still manually trigger syncs from the ASIN Manager page'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OctoparseAutomationToggle;
