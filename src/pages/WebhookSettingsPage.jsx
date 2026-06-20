import React, { useState, useEffect, useCallback } from 'react';
import {
  Webhook, Plus, Trash2, Edit3, CheckCircle2, XCircle, Send,
  RefreshCw, ChevronDown, ChevronUp, Copy, ExternalLink,
  Activity, Clock, AlertTriangle, Zap, ShieldCheck
} from 'lucide-react';
import { db } from '../services/db';
import './WebhookSettingsPage.css';

// ─── Category metadata ────────────────────────────────────────────────────────
const CATEGORIES = {
  task:   { label: 'Tasks',      color: '#6366f1', bg: '#eef2ff' },
  target: { label: 'Targets',    color: '#f59e0b', bg: '#fffbeb' },
  alert:  { label: 'Alerts',     color: '#ef4444', bg: '#fef2f2' },
  report: { label: 'Reports',    color: '#10b981', bg: '#ecfdf5' },
  okr:    { label: 'OKR',        color: '#8b5cf6', bg: '#f5f3ff' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toastTimeout = {};
function useToast() {
  const [toast, setToast] = useState(null);
  const show = useCallback((message, type = 'success') => {
    setToast({ message, type, id: Date.now() });
    clearTimeout(toastTimeout.t);
    toastTimeout.t = setTimeout(() => setToast(null), 3500);
  }, []);
  return { toast, show };
}

function StatusPill({ success }) {
  return success
    ? <span className="ws-pill ws-pill--ok"><CheckCircle2 size={11} /> Success</span>
    : <span className="ws-pill ws-pill--err"><XCircle size={11} /> Failed</span>;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function WebhookSettingsPage() {
  const { toast, show } = useToast();

  // ── state ──
  const [webhooks, setWebhooks]     = useState([]);
  const [events, setEvents]         = useState([]);
  const [logs, setLogs]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [testingId, setTestingId]   = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [activeTab, setActiveTab]   = useState('webhooks'); // 'webhooks' | 'logs' | 'guide'

  // form state
  const [showForm, setShowForm]     = useState(false);
  const [editingId, setEditingId]   = useState(null);
  const [form, setForm]             = useState({ name: '', url: '', description: '', events: ['*'] });
  const [saving, setSaving]         = useState(false);

  // ── load ──
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [wRes, eRes, lRes] = await Promise.all([
        db.request('/webhooks', { method: 'GET' }, null),
        db.request('/webhooks/events', { method: 'GET' }, null),
        db.request('/webhooks/logs', { method: 'GET' }, null),
      ]);
      setWebhooks(wRes?.data || []);
      setEvents(eRes?.data || []);
      setLogs(lRes?.data || []);
    } catch (e) {
      show('Failed to load webhook settings', 'error');
    } finally {
      setLoading(false);
    }
  }, [show]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── helpers ──
  const grouped = events.reduce((acc, ev) => {
    const cat = ev.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(ev);
    return acc;
  }, {});

  const toggleEvent = (key) => {
    setForm(prev => {
      const cur = prev.events.filter(e => e !== '*');
      if (cur.includes(key)) return { ...prev, events: cur.filter(e => e !== key) };
      return { ...prev, events: [...cur, key] };
    });
  };

  const allSelected = form.events.includes('*') || form.events.length === events.length;

  // ── CRUD ──
  const openCreate = () => {
    setEditingId(null);
    setForm({ name: '', url: '', description: '', events: ['*'] });
    setShowForm(true);
  };

  const openEdit = (wh) => {
    setEditingId(wh.id || wh.Id);
    setForm({
      name: wh.Name || wh.name || '',
      url: wh.Url || wh.url || '',
      description: wh.Description || wh.description || '',
      events: wh.events || ['*'],
    });
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.url || !form.url.startsWith('http')) {
      show('Please enter a valid HTTPS URL', 'error'); return;
    }
    if (form.events.length === 0) {
      show('Select at least one event (or "All Events")', 'error'); return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await db.request(`/webhooks/${editingId}`, { method: 'PUT', body: JSON.stringify(form) }, null);
        show('Webhook updated successfully');
      } else {
        await db.request('/webhooks', { method: 'POST', body: JSON.stringify(form) }, null);
        show('Webhook created successfully');
      }
      setShowForm(false);
      loadAll();
    } catch {
      show('Failed to save webhook', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this webhook? This cannot be undone.')) return;
    try {
      await db.request(`/webhooks/${id}`, { method: 'DELETE' }, null);
      show('Webhook deleted');
      loadAll();
    } catch { show('Failed to delete', 'error'); }
  };

  const handleToggle = async (wh) => {
    try {
      await db.request(`/webhooks/${wh.id || wh.Id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !wh.isActive }),
      }, null);
      show(wh.isActive ? 'Webhook disabled' : 'Webhook enabled');
      loadAll();
    } catch { show('Failed to update', 'error'); }
  };

  const handleTest = async (id) => {
    setTestingId(id);
    try {
      const res = await db.request(`/webhooks/${id}/test`, { method: 'POST', body: '{}' }, null);
      if (res?.success) show('✅ Test payload sent! Check your Pabbly Connect dashboard.');
      else show(`Test failed: ${res?.message || 'Unknown error'}`, 'error');
    } catch { show('Test request failed', 'error'); }
    finally { setTestingId(null); loadAll(); }
  };

  // ── render ──
  if (loading) return (
    <div className="ws-loading">
      <div className="ws-spinner" /><span>Loading webhook settings…</span>
    </div>
  );

  return (
    <div className="ws-root">
      {/* Toast */}
      {toast && (
        <div className={`ws-toast ws-toast--${toast.type}`} key={toast.id}>
          {toast.type === 'success' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="ws-header">
        <div className="ws-header-left">
          <div className="ws-header-icon"><Webhook size={20} /></div>
          <div>
            <p className="ws-subtitle">
              Connect RetailOps to Pabbly Connect to receive email &amp; automation alerts for any event
            </p>
          </div>
        </div>
        <button className="ws-btn ws-btn--primary" onClick={openCreate}>
          <Plus size={15} /> Add Webhook
        </button>
      </div>

      {/* Stats row */}
      <div className="ws-stats">
        {[
          { label: 'Total Webhooks', value: webhooks.length, icon: <Webhook size={16} /> },
          { label: 'Active',         value: webhooks.filter(w => w.isActive).length, icon: <ShieldCheck size={16} /> },
          { label: 'Events Tracked', value: events.length, icon: <Zap size={16} /> },
          { label: 'Deliveries (50)', value: logs.length, icon: <Activity size={16} /> },
          { label: 'Success Rate',   value: logs.length ? `${Math.round((logs.filter(l=>l.success).length/logs.length)*100)}%` : '—', icon: <CheckCircle2 size={16} /> },
        ].map((s, i) => (
          <div className="ws-stat" key={i}>
            <div className="ws-stat-icon">{s.icon}</div>
            <div className="ws-stat-val">{s.value}</div>
            <div className="ws-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="ws-tabs">
        {[['webhooks','Webhooks'],['logs','Delivery Logs'],['guide','Pabbly Guide']].map(([k, l]) => (
          <button key={k} className={`ws-tab ${activeTab===k?'ws-tab--active':''}`} onClick={() => setActiveTab(k)}>{l}</button>
        ))}
      </div>

      {/* ── WEBHOOKS tab ─────────────────────────────────────── */}
      {activeTab === 'webhooks' && (
        <div className="ws-content">
          {webhooks.length === 0 ? (
            <div className="ws-empty">
              <Webhook size={48} className="ws-empty-icon" />
              <h3>No webhooks configured yet</h3>
              <p>Add your first Pabbly Connect webhook URL to start receiving email notifications.</p>
              <button className="ws-btn ws-btn--primary" onClick={openCreate}><Plus size={14} /> Add First Webhook</button>
            </div>
          ) : (
            <div className="ws-list">
              {webhooks.map(wh => {
                const id = wh.id || wh.Id;
                const isExpanded = expandedId === id;
                const whEvents = wh.events || [];
                const isTesting = testingId === id;
                return (
                  <div key={id} className={`ws-card ${wh.isActive ? 'ws-card--active' : 'ws-card--inactive'}`}>
                    <div className="ws-card-header">
                      <div className="ws-card-info">
                        <div className="ws-card-row1">
                          <span className="ws-card-name">{wh.Name || wh.name}</span>
                          <span className={`ws-status ${wh.isActive ? 'ws-status--on' : 'ws-status--off'}`}>
                            {wh.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div className="ws-card-url">
                          <ExternalLink size={11} />
                          <span>{wh.Url || wh.url}</span>
                          <button className="ws-copy" onClick={() => { navigator.clipboard.writeText(wh.Url || wh.url); show('Copied!'); }}>
                            <Copy size={11} />
                          </button>
                        </div>
                        {(wh.Description || wh.description) && (
                          <div className="ws-card-desc">{wh.Description || wh.description}</div>
                        )}
                        <div className="ws-card-events">
                          {whEvents.includes('*')
                            ? <span className="ws-ev-badge ws-ev-badge--all">All Events</span>
                            : whEvents.slice(0, 5).map(e => {
                                const cat = e.split('.')[0];
                                const meta = CATEGORIES[cat] || { color: '#6b7280', bg: '#f3f4f6' };
                                return (
                                  <span key={e} className="ws-ev-badge" style={{ color: meta.color, background: meta.bg }}>
                                    {e}
                                  </span>
                                );
                              })
                          }
                          {!whEvents.includes('*') && whEvents.length > 5 && (
                            <span className="ws-ev-more">+{whEvents.length - 5} more</span>
                          )}
                        </div>
                      </div>
                      <div className="ws-card-actions">
                        <button
                          className={`ws-btn ws-btn--sm ws-btn--test ${isTesting ? 'ws-btn--loading' : ''}`}
                          onClick={() => handleTest(id)}
                          disabled={isTesting}
                          title="Send test event"
                        >
                          {isTesting ? <RefreshCw size={13} className="spin" /> : <Send size={13} />}
                          {isTesting ? 'Sending…' : 'Test'}
                        </button>
                        <button className="ws-btn ws-btn--sm" onClick={() => openEdit(wh)} title="Edit"><Edit3 size={13} /></button>
                        <button className="ws-btn ws-btn--sm ws-btn--toggle" onClick={() => handleToggle(wh)} title={wh.isActive ? 'Disable' : 'Enable'}>
                          {wh.isActive ? <XCircle size={13} /> : <CheckCircle2 size={13} />}
                        </button>
                        <button className="ws-btn ws-btn--sm ws-btn--danger" onClick={() => handleDelete(id)} title="Delete"><Trash2 size={13} /></button>
                        <button className="ws-btn ws-btn--sm" onClick={() => setExpandedId(isExpanded ? null : id)}>
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="ws-card-expand">
                        <h4>Recent Deliveries</h4>
                        <LogTable logs={logs.filter(l => l.WebhookId === id).slice(0,10)} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── LOGS tab ────────────────────────────────────────── */}
      {activeTab === 'logs' && (
        <div className="ws-content">
          <div className="ws-log-header">
            <h3>Delivery Logs <span className="ws-log-count">{logs.length} entries</span></h3>
            <button className="ws-btn ws-btn--sm" onClick={loadAll}><RefreshCw size={13} /> Refresh</button>
          </div>
          <LogTable logs={logs} showWebhook />
        </div>
      )}

      {/* ── GUIDE tab ───────────────────────────────────────── */}
      {activeTab === 'guide' && <PabblyGuide onAddWebhook={openCreate} />}

      {/* ── Form Modal ────────────────────────────────────────── */}
      {showForm && (
        <div className="ws-overlay" onClick={(e) => e.target===e.currentTarget && setShowForm(false)}>
          <form className="ws-modal" onSubmit={handleSave}>
            <div className="ws-modal-header">
              <h2>{editingId ? 'Edit Webhook' : 'Add Webhook'}</h2>
              <button type="button" className="ws-close" onClick={() => setShowForm(false)}>×</button>
            </div>

            <div className="ws-modal-body">
              <div className="ws-field">
                <label>Webhook Name <span className="ws-req">*</span></label>
                <input
                  className="ws-input"
                  placeholder="e.g. Pabbly Task Notifications"
                  value={form.name}
                  onChange={e => setForm(p => ({...p, name: e.target.value}))}
                  required
                />
              </div>

              <div className="ws-field">
                <label>Pabbly Connect URL <span className="ws-req">*</span></label>
                <input
                  className="ws-input"
                  type="url"
                  placeholder="https://connect.pabbly.com/workflow/sendwebhookdata/..."
                  value={form.url}
                  onChange={e => setForm(p => ({...p, url: e.target.value}))}
                  required
                />
                <span className="ws-hint">Paste your Pabbly Connect webhook trigger URL</span>
              </div>

              <div className="ws-field">
                <label>Description <span className="ws-opt">(optional)</span></label>
                <textarea
                  className="ws-input ws-textarea"
                  rows={2}
                  placeholder="What does this webhook do?"
                  value={form.description}
                  onChange={e => setForm(p => ({...p, description: e.target.value}))}
                />
              </div>

              {/* Events picker */}
              <div className="ws-field">
                <label>Subscribe to Events <span className="ws-req">*</span></label>
                <div className="ws-ev-toggle">
                  <label className="ws-ev-all">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => setForm(p => ({...p, events: allSelected ? [] : ['*']}))}
                    />
                    <span>All Events (recommended)</span>
                  </label>
                </div>

                {!allSelected && (
                  <div className="ws-ev-groups">
                    {Object.entries(grouped).map(([cat, evList]) => {
                      const meta = CATEGORIES[cat] || { label: cat, color: '#6b7280', bg: '#f3f4f6' };
                      return (
                        <div key={cat} className="ws-ev-group">
                          <div className="ws-ev-group-label" style={{ color: meta.color }}>
                            {meta.label}
                          </div>
                          {evList.map(ev => (
                            <label key={ev.key} className="ws-ev-row">
                              <input
                                type="checkbox"
                                checked={form.events.includes(ev.key)}
                                onChange={() => toggleEvent(ev.key)}
                              />
                              <span className="ws-ev-key">{ev.key}</span>
                              <span className="ws-ev-label">{ev.label}</span>
                            </label>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="ws-modal-footer">
              <button type="button" className="ws-btn ws-btn--ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="ws-btn ws-btn--primary" disabled={saving}>
                {saving ? <><RefreshCw size={13} className="spin" /> Saving…</> : editingId ? 'Update Webhook' : 'Create Webhook'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ─── Log table ────────────────────────────────────────────────────────────────
function LogTable({ logs, showWebhook = false }) {
  if (!logs || logs.length === 0) return (
    <div className="ws-empty-sm">No delivery logs yet. Send a test event to see results here.</div>
  );
  return (
    <div className="ws-log-table-wrap">
      <table className="ws-log-table">
        <thead>
          <tr>
            {showWebhook && <th>Webhook</th>}
            <th>Event</th>
            <th>Status</th>
            <th>HTTP</th>
            <th>Duration</th>
            <th>Attempt</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l, i) => (
            <tr key={i}>
              {showWebhook && <td className="ws-log-name">{l.WebhookName || '—'}</td>}
              <td><code className="ws-log-event">{l.Event}</code></td>
              <td><StatusPill success={l.success} /></td>
              <td><span className={`ws-http ${l.HttpStatus >= 200 && l.HttpStatus < 300 ? 'ws-http--ok' : 'ws-http--err'}`}>{l.HttpStatus || '—'}</span></td>
              <td className="ws-log-dur">{l.DurationMs ? `${l.DurationMs}ms` : '—'}</td>
              <td className="ws-log-att">{l.Attempt || 1}</td>
              <td className="ws-log-time">{l.CreatedAt ? new Date(l.CreatedAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Pabbly Guide panel ───────────────────────────────────────────────────────
function PabblyGuide({ onAddWebhook }) {
  return (
    <div className="ws-guide">
      <div className="ws-guide-hero">
        <Webhook size={40} />
        <h2>Connect Pabbly to RetailOps</h2>
        <p>Receive real-time email notifications for every task, alert, target, and ASIN sync event.</p>
      </div>

      <div className="ws-guide-steps">
        {[
          {
            n: 1,
            title: 'Create a Pabbly Connect Workflow',
            body: 'Go to connect.pabbly.com → New Workflow → Choose "Webhook" as your trigger. Copy the generated Webhook URL.',
          },
          {
            n: 2,
            title: 'Choose Email as the Action',
            body: 'In the workflow, add an action step: "Gmail" or "Email by Pabbly". Map the payload fields: {{event}}, {{data.title}}, {{data.priority}}, {{data.dashboardUrl}}.',
          },
          {
            n: 3,
            title: 'Add the Webhook URL here',
            body: 'Click "Add Webhook" → paste your Pabbly URL → select which events to subscribe to (or choose All Events) → click Create.',
          },
          {
            n: 4,
            title: 'Send a Test Event',
            body: 'Use the "Test" button on any webhook card. Switch to Pabbly and verify the payload arrived. Map the fields and you\'re done! 🎉',
          },
        ].map(s => (
          <div className="ws-step" key={s.n}>
            <div className="ws-step-n">{s.n}</div>
            <div>
              <div className="ws-step-title">{s.title}</div>
              <div className="ws-step-body">{s.body}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="ws-guide-payload">
        <h3>Sample Payload (task.assigned)</h3>
        <pre className="ws-code">{JSON.stringify({
  event: "task.assigned",
  eventLabel: "Task Assigned",
  timestamp: "2026-06-12T09:00:00.000Z",
  source: "RetailOps",
  data: {
    id: "abc123",
    title: "Nike India — Title Optimization",
    type: "TITLE_OPTIMIZATION",
    priority: "HIGH",
    asinCount: 40,
    assignedTo: { id: "user_456" },
    deadline: "2026-06-20",
    dashboardUrl: "https://data.brandcentral.in/tasks",
  }
}, null, 2)}</pre>
      </div>

      <div className="ws-guide-cta">
        <button className="ws-btn ws-btn--primary" onClick={onAddWebhook}>
          <Plus size={14} /> Add Your First Webhook
        </button>
        <a
          href="https://connect.pabbly.com"
          target="_blank"
          rel="noopener noreferrer"
          className="ws-btn ws-btn--ghost"
        >
          Open Pabbly Connect <ExternalLink size={13} />
        </a>
      </div>
    </div>
  );
}
