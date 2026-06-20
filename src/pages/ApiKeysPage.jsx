import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Check, ChevronRight, Eye, EyeOff, RefreshCw, Plus, Trash2, Edit, AlertCircle, Loader2, X } from 'lucide-react';
import api from '../services/api';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Form, FormGroup, Label, Input, Alert } from 'reactstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import { PageLoader } from '@/components/application/loading-indicator/PageLoader';
import { LoadingIndicator } from '@/components/application/loading-indicator/loading-indicator';

const CATEGORY_COLORS = {
    'Scraping': '#6366F1',
    'Amazon Data': '#F59E0B',
    'AI': '#10B981',
    'Communication': '#EC4899',
    'Other': '#64748B'
};

/* ─── Sub-components ───────────────────────────────────────────── */
const Toggle = ({ enabled }) => (
    <div style={{
        width: 44, height: 24, borderRadius: 12,
        background: enabled ? '#4F46E5' : '#CBD5E1',
        position: 'relative', flexShrink: 0,
    }}>
        <span style={{
            position: 'absolute',
            top: 2, left: enabled ? 20 : 2,
            width: 20, height: 20, borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            transition: 'left 200ms',
        }} />
    </div>
);

const CategoryPill = ({ label, color }) => (
    <span style={{
        fontSize: 11, fontWeight: 700, padding: '3px 8px',
        borderRadius: 6,
        background: color + '18',
        color,
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
    }}>
        {label}
    </span>
);

/* ─── Main Page ────────────────────────────────────────────────── */
const ApiKeysPage = () => {
    const [apiKeys, setApiKeys] = useState([]);
    const [loading, setLoading] = useState(true);
    const [revealedKeys, setRevealedKeys] = useState({});
    const [copiedId, setCopiedId] = useState(null);

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [editingKey, setEditingKey] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        serviceId: '',
        value: '',
        category: 'Other',
        description: ''
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

useEffect(() => { fetchKeys(); }, []);

    const fetchKeys = async () => {
        setLoading(true);
        try {
            const res = await api.get('/keys');
            if (res.success) {
                setApiKeys(res.data);
            }
        } catch (err) {
            console.error('Fetch keys error:', err);
            setError('Failed to load API keys');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        try {
            if (editingKey) {
                await api.put(`/keys/${editingKey._id}`, formData);
            } else {
                await api.post('/keys', formData);
            }
            setModalOpen(false);
            fetchKeys();
        } catch (err) {
            setError(err.message || 'Error saving key');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this key?')) return;
        try {
            await api.delete(`/keys/${id}`);
            fetchKeys();
        } catch (err) {
            alert('Delete failed: ' + err.message);
        }
    };

    const toggleActive = async (key) => {
        try {
            await api.put(`/keys/${key._id}`, { isActive: !key.isActive });
            fetchKeys();
        } catch (err) {
            alert('Update failed: ' + err.message);
        }
    };

    const handleReveal = async (id) => {
        if (revealedKeys[id]) {
            setRevealedKeys(prev => {
                const updated = { ...prev };
                delete updated[id];
                return updated;
            });
            return;
        }
        try {
            const res = await api.get(`/keys/${id}/reveal`);
            if (res.success) {
                setRevealedKeys(prev => ({ ...prev, [id]: res.value }));
            }
        } catch (err) {
            alert('Reveal failed: ' + err.message);
        }
    };

    const openEditModal = (key) => {
        setEditingKey(key);
        setFormData({
            name: key.name,
            serviceId: key.serviceId,
            value: '', // Don't pre-fill masked value
            category: key.category,
            description: key.description || ''
        });
        setModalOpen(true);
    };

    const openAddModal = () => {
        setEditingKey(null);
        setFormData({
            name: '',
            serviceId: '',
            value: '',
            category: 'Other',
            description: ''
        });
        setModalOpen(true);
    };

    const handleCopy = (id, val) => {
        if (!val) return;
        navigator.clipboard.writeText(val).catch(() => { });
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

return (
    <div className="container-fluid py-4">
        {loading && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}>
                <LoadingIndicator type="line-simple" size="md" />
            </div>
        )}
        {/* Breadcrumb & Header */}
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <p className="text-muted small mb-0">Manage all your secure API integrations from one place</p>
                </div>
                <div className="d-flex align-items-center gap-3">
                    <button
                        onClick={openAddModal}
                        className="btn btn-primary d-flex align-items-center gap-2 px-3 fw-semibold shadow-sm"
                        style={{ borderRadius: '10px' }}
                    >
                        <Plus size={18} /> Add New Key
                    </button>
                    <div className="d-flex align-items-center gap-2 fs-13 text-muted">
                        <Link to="/settings" className="text-decoration-none text-muted">Settings</Link>
                        <ChevronRight size={14} />
                        <span className="fw-semibold text-dark">API Keys</span>
                    </div>
                </div>
            </div>

            {/* Security notice */}
            <Alert color="primary" className="d-flex align-items-center gap-3 border-0 shadow-sm" style={{ borderRadius: '12px', backgroundColor: '#EEF2FF', color: '#3730A3' }}>
                <span className="fs-4">🔒</span>
                <span className="small">
                    <strong>Secure Storage:</strong> All keys are stored in the backend database.
                    Values are masked by default and only revealed upon secure request.
                    Anonymized provider names are used to maintain abstraction and security.
                </span>
            </Alert>

            {/* Main Content Card */}
            <div className="card border-0 shadow-sm overflow-hidden" style={{ borderRadius: '16px' }}>
                <div className="card-header bg-white border-bottom py-3 px-4 d-flex justify-content-between align-items-center">
                    <div>
                        <h5 className="mb-1 fw-bold text-dark">Configured Integrations</h5>
                        <p className="mb-0 text-muted smallest">{apiKeys.length} active configurations</p>
                    </div>
                    <button
                        onClick={fetchKeys}
                        className="btn btn-link text-decoration-none text-muted p-0 d-flex align-items-center gap-1 smallest fw-semibold"
                        disabled={loading}
                    >
                        <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh List
                    </button>
                </div>

                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                        <thead className="bg-light">
                            <tr>
                                <th className="ps-4 py-3 text-uppercase text-muted smallest fw-bold tracking-wider">Service Provider</th>
                                <th className="py-3 text-uppercase text-muted smallest fw-bold tracking-wider">Category</th>
                                <th className="py-3 text-uppercase text-muted smallest fw-bold tracking-wider">API Key (Masked)</th>
                                <th className="py-3 text-uppercase text-muted smallest fw-bold tracking-wider text-center">Status</th>
                                <th className="pe-4 py-3 text-uppercase text-muted smallest fw-bold tracking-wider text-end">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
{apiKeys.length === 0 ? (
    <tr>
        <td colSpan={5} className="text-center py-5 text-muted">
            No API keys configured. Click "Add New Key" to get started.
        </td>
    </tr>
) : apiKeys.map((key) => {
                                const isRevealed = !!revealedKeys[key._id];
                                const displayValue = isRevealed ? revealedKeys[key._id] : key.value;

                                return (
                                    <tr key={key._id}>
                                        <td className="ps-4 py-3">
                                            <div className="fw-bold text-dark">{key.name}</div>
                                            <div className="smallest text-muted">{key.description || 'No description provided'}</div>
                                            <div className="smallest text-muted-opacity fw-mono mt-1" style={{ fontSize: '10px' }}>ID: {key.serviceId}</div>
                                        </td>
                                        <td className="py-3">
                                            <CategoryPill label={key.category} color={CATEGORY_COLORS[key.category] || CATEGORY_COLORS['Other']} />
                                        </td>
                                        <td className="py-3">
                                            <div className="d-inline-flex align-items-center bg-light border px-2 py-1 rounded" style={{ minWidth: '180px' }}>
                                                <code className="smallest fw-mono text-secondary me-2">
                                                    {displayValue}
                                                </code>
                                                <div className="ms-auto d-flex gap-1">
                                                    <button
                                                        onClick={() => handleReveal(key._id)}
                                                        className="btn btn-link p-0 text-muted hover-primary transition-all"
                                                        title={isRevealed ? "Mask" : "Reveal"}
                                                    >
                                                        {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                                                    </button>
                                                    <button
                                                        onClick={() => handleCopy(key._id, displayValue)}
                                                        className="btn btn-link p-0 text-muted hover-success transition-all"
                                                        title="Copy"
                                                    >
                                                        {copiedId === key._id ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                                                    </button>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-3 text-center">
                                            <div
                                                className="d-inline-block cursor-pointer transition-all"
                                                onClick={() => toggleActive(key)}
                                                style={{ opacity: key.isActive ? 1 : 0.6 }}
                                            >
                                                <Toggle enabled={key.isActive} />
                                                <div className={`smallest fw-bold mt-1 ${key.isActive ? 'text-success' : 'text-danger'}`}>
                                                    {key.isActive ? 'Active' : 'Disabled'}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="pe-4 py-3 text-end">
                                            <div className="d-flex justify-content-end gap-2">
                                                <button
                                                    onClick={() => openEditModal(key)}
                                                    className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1 border-0 hover-bg-light"
                                                    title="Edit Configuration"
                                                >
                                                    <Edit size={14} /> Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(key._id)}
                                                    className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1 border-0 hover-bg-danger-light"
                                                    title="Delete Configuration"
                                                >
                                                    <Trash2 size={14} /> Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add / Edit Modal */}
            <Modal isOpen={modalOpen} toggle={() => setModalOpen(false)} centered size="md" contentClassName="border-0 shadow-lg" style={{ borderRadius: '16px' }}>
                <ModalHeader toggle={() => setModalOpen(false)} className="border-0 pb-0 pt-4 px-4">
                    <span className="fw-bold h5 mb-0 text-dark">
                        {editingKey ? 'Edit API Integration' : 'Add New Integration'}
                    </span>
                </ModalHeader>
                <Form onSubmit={handleSave}>
                    <ModalBody className="p-4">
                        {error && (
                            <Alert color="danger" className="py-2 small border-0 d-flex align-items-center gap-2 mb-3">
                                <AlertCircle size={14} /> {error}
                            </Alert>
                        )}
                        <FormGroup className="mb-3">
                            <Label className="smallest fw-bold text-muted text-uppercase mb-2">Internal Alias Name</Label>
                            <Input
                                type="text"
                                placeholder="e.g. Data Provider Alpha"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                required
                                className="border-0 bg-light px-3 py-2"
                                style={{ borderRadius: '8px' }}
                            />
                        </FormGroup>
                        <FormGroup className="mb-3">
                            <Label className="smallest fw-bold text-muted text-uppercase mb-2">Service ID (Unique)</Label>
                            <Input
                                type="text"
                                placeholder="e.g. scraper_primary"
                                value={formData.serviceId}
                                onChange={e => setFormData({ ...formData, serviceId: e.target.value })}
                                required
                                disabled={!!editingKey}
                                className="border-0 bg-light px-3 py-2"
                                style={{ borderRadius: '8px' }}
                            />
                        </FormGroup>
                        <FormGroup className="mb-3">
                            <Label className="smallest fw-bold text-muted text-uppercase mb-2">Category</Label>
                            <Input
                                type="select"
                                value={formData.category}
                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                                className="border-0 bg-light px-3 py-2"
                                style={{ borderRadius: '8px' }}
                            >
                                <option>Scraping</option>
                                <option>Amazon Data</option>
                                <option>AI</option>
                                <option>Communication</option>
                                <option>Other</option>
                            </Input>
                        </FormGroup>
                        <FormGroup className="mb-3">
                            <Label className="smallest fw-bold text-muted text-uppercase mb-2">API Key Value</Label>
                            <Input
                                type="password"
                                placeholder={editingKey ? "•••••••••••• (leave blank to keep current)" : "Paste your API key here"}
                                value={formData.value}
                                onChange={e => setFormData({ ...formData, value: e.target.value })}
                                required={!editingKey}
                                className="border-0 bg-light px-3 py-2"
                                style={{ borderRadius: '8px' }}
                            />
                        </FormGroup>
                        <FormGroup className="mb-0">
                            <Label className="smallest fw-bold text-muted text-uppercase mb-2">Description (Optional)</Label>
                            <Input
                                type="textarea"
                                rows="2"
                                placeholder="Briefly describe what this key is used for..."
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                className="border-0 bg-light px-3 py-2"
                                style={{ borderRadius: '8px' }}
                            />
                        </FormGroup>
                    </ModalBody>
                    <ModalFooter className="border-0 pt-0 px-4 pb-4">
                        <Button color="link" onClick={() => setModalOpen(false)} className="text-decoration-none text-muted smallest fw-bold me-2">
                            Cancel
                        </Button>
                        <Button color="primary" type="submit" disabled={saving} className="px-4 fw-bold shadow-sm" style={{ borderRadius: '10px' }}>
                            {saving ? <Loader2 className="spin" size={16} /> : (editingKey ? 'Update Configuration' : 'Save Integration')}
                        </Button>
                    </ModalFooter>
                </Form>
            </Modal>

            <style>{`
                .smallest { font-size: 11px; }
                .fs-13 { font-size: 13px; }
                .fw-mono { font-family: 'JetBrains Mono', 'Fira Code', monospace; }
                .tracking-wider { letter-spacing: 0.05em; }
                .text-muted-opacity { color: rgba(100, 116, 139, 0.7); }
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .hover-primary:hover { color: #4F46E5 !important; }
                .hover-success:hover { color: #16A34A !important; }
                .hover-bg-light:hover { background-color: #F8FAFC !important; }
                .hover-bg-danger-light:hover { background-color: #FEF2F2 !important; color: #DC2626 !important; }
                .cursor-pointer { cursor: pointer; }
                .transition-all { transition: all 0.2s ease; }
            `}</style>
        </div>
    );
};

export default ApiKeysPage;
