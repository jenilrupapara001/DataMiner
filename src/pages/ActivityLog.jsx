import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import EmptyState from '../components/common/EmptyState';
import { Clock, Filter, Search, ArrowRight, User, CheckCircle, PlusCircle, Trash2, Edit3, ClipboardList, Activity } from 'lucide-react';

const ActivityLog = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('ALL');

    useEffect(() => {
        loadLogs();
    }, []);

    const loadLogs = async () => {
        setLoading(true);
        try {
            const data = await db.getSystemLogs();
            setLogs(data || []);
        } catch (error) {
            console.error('Failed to load logs', error);
        } finally {
            setLoading(false);
        }
    };

    const getTypeIcon = (type) => {
        switch (type) {
            case 'CREATE': return <PlusCircle size={16} className="text-success" />;
            case 'UPDATE': return <Edit3 size={16} className="text-primary" />;
            case 'DELETE': return <Trash2 size={16} className="text-danger" />;
            case 'STATUS_CHANGE': return <CheckCircle size={16} className="text-info" />;
            default: return <ClipboardList size={16} className="text-muted" />;
        }
    };

    const getEntityBadge = (type) => {
        const styles = {
            OBJECTIVE: 'bg-primary-subtle text-primary border-primary-subtle',
            KR: 'bg-info-subtle text-info border-info-subtle',
            ACTION: 'bg-warning-subtle text-warning border-warning-subtle',
            SYSTEM: 'bg-secondary-subtle text-secondary border-secondary-subtle'
        };
        return (
            <span className={`badge border ${styles[type] || styles.SYSTEM}`} style={{ fontSize: '10px' }}>
                {type}
            </span>
        );
    };

    const formatTime = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const filteredLogs = logs.filter(log => {
        const matchesSearch = searchQuery
            ? log.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            log.entityTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            log.user?.email?.toLowerCase().includes(searchQuery.toLowerCase())
            : true;
        const matchesType = filterType === 'ALL' || log.type === filterType;
        return matchesSearch && matchesType;
    });

    return (
        <div className="container-fluid py-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h4 className="fw-bold mb-1">Activity Log</h4>
                    <p className="text-muted small mb-0">Monitor all strategy and execution changes across the organization</p>
                </div>
                <button onClick={loadLogs} className="btn btn-sm btn-outline-primary rounded-pill px-3">
                    Refresh Logs
                </button>
            </div>

            <div className="card border-0 shadow-sm" style={{ borderRadius: '16px' }}>
                <div className="card-header bg-white border-0 pt-4 px-4">
                    <div className="row g-3">
                        <div className="col-md-8">
                            <div className="position-relative">
                                <Search className="position-absolute" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#6b7280' }} />
                                <input
                                    type="text"
                                    placeholder="Search by description, title, or user..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="form-control ps-5 border-0 bg-light"
                                    style={{ borderRadius: '10px' }}
                                />
                            </div>
                        </div>
                        <div className="col-md-4">
                            <select
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value)}
                                className="form-select border-0 bg-light"
                                style={{ borderRadius: '10px' }}
                            >
                                <option value="ALL">All Event Types</option>
                                <option value="CREATE">Creation</option>
                                <option value="UPDATE">Updates</option>
                                <option value="DELETE">Deletions</option>
                                <option value="STATUS_CHANGE">Status Changes</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="card-body p-0 mt-3">
                    <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0">
                            <thead className="bg-light text-muted small text-uppercase">
                                <tr>
                                    <th className="ps-4" style={{ width: '180px' }}>Timestamp</th>
                                    <th style={{ width: '100px' }}>Event</th>
                                    <th style={{ width: '120px' }}>Entity</th>
                                    <th>Activity Description</th>
                                    <th style={{ width: '200px' }}>Initiated By</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="5" className="text-center py-5">
                                            <div className="spinner-border spinner-border-sm text-primary me-2"></div>
                                            Loading activities...
                                        </td>
                                    </tr>
                                ) : filteredLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan="5">
                                            <EmptyState
                                                icon={Activity}
                                                title="No activity yet"
                                                description="Actions performed on projects, ASINs, and settings will be logged here."
                                                action={null}
                                            />
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLogs.map((log) => (
                                        <tr key={log._id}>
                                            <td className="ps-4">
                                                <div className="d-flex align-items-center text-muted small">
                                                    <Clock size={12} className="me-2" />
                                                    {formatTime(log.createdAt)}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="d-flex align-items-center gap-2 small">
                                                    {getTypeIcon(log.type)}
                                                    <span>{log.type.replace('_', ' ')}</span>
                                                </div>
                                            </td>
                                            <td>
                                                {getEntityBadge(log.entityType)}
                                            </td>
                                            <td>
                                                <div className="fw-semibold small">{log.entityTitle}</div>
                                                <div className="text-muted small text-truncate" style={{ maxWidth: '400px' }}>
                                                    {log.description}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="d-flex align-items-center gap-2">
                                                    <div className="avatar-initial bg-light text-dark border rounded-circle" style={{ width: '24px', height: '24px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        {(log.user?.firstName || 'U').charAt(0)}
                                                    </div>
                                                    <div className="small">
                                                        <div className="fw-bold lh-1">{log.user?.firstName || 'System'}</div>
                                                        <div className="text-muted" style={{ fontSize: '10px' }}>{log.user?.email || ''}</div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="card-footer bg-white border-0 py-3 text-center">
                    <button className="btn btn-sm btn-link text-muted text-decoration-none small">
                        View Full History (Max 100)
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ActivityLog;
