import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, Package, Search, ChevronDown, ChevronUp, Zap, AlertTriangle, ExternalLink, BarChart2, Store } from 'lucide-react';
import api from '../services/api';

const MARKETPLACE_FLAGS = {
    'amazon.in': '🇮🇳',
    'amazon.com': '🇺🇸',
    'amazon.co.uk': '🇬🇧',
    'amazon.de': '🇩🇪',
    'amazon.fr': '🇫🇷',
    'amazon.ca': '🇨🇦',
};

const getLqsBadge = (lqs) => {
    if (lqs == null) return <span style={{ color: '#9ca3af' }}>—</span>;
    let bgColor = '#059669';
    if (lqs < 60) bgColor = '#dc2626';
    else if (lqs < 80) bgColor = '#d97706';
    return <span className="badge" style={{ backgroundColor: bgColor, color: '#fff', fontWeight: 600, fontSize: '0.75rem' }}>{lqs}</span>;
};

const getScrapeStatusBadge = (status) => {
    const map = {
        PENDING: { bg: '#d97706', label: 'Pending' },
        SCRAPED: { bg: '#059669', label: 'Scraped' },
        FAILED: { bg: '#dc2626', label: 'Failed' },
        SCRAPING: { bg: '#2563eb', label: 'Scraping' },
        Active: { bg: '#059669', label: 'Active' },
    };
    const s = map[status] || { bg: '#6b7280', label: status || 'Unknown' };
    return <span className="badge" style={{ backgroundColor: s.bg, color: '#fff', fontWeight: 600, fontSize: '0.75rem' }}>{s.label}</span>;
};

// Per-seller ASIN table panel
const SellerAsinPanel = ({ seller, onSync, syncing, refreshKey }) => {
    const [asins, setAsins] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');

    const load = useCallback(async () => {
        if (!isOpen) return;
        setLoading(true);
        try {
            const res = await api.sellerTrackerApi.getSellerAsins(seller._id);
            if (res.success) {
                setAsins(res.data || []);
            }
        } catch (e) {
            console.error('Failed to load ASINs for seller:', e.message);
        } finally {
            setLoading(false);
        }
    }, [isOpen, seller._id]); // refreshKey is not strictly needed here if we trigger load() from parent or if we use effect on refreshKey

    useEffect(() => { load(); }, [load, refreshKey]);

    const filtered = useMemo(() =>
        asins.filter(a => !search || a.asinCode?.toLowerCase().includes(search.toLowerCase()) || a.title?.toLowerCase().includes(search.toLowerCase())),
        [asins, search]
    );

    const flag = MARKETPLACE_FLAGS[seller.marketplace] || '🌐';
    const lastSync = seller.lastKeepaSync ? new Date(seller.lastKeepaSync) : null;
    const isNew24h = (date) => date && new Date(date) > new Date(Date.now() - 86400000);

    return (
        <div className="card mb-3 border-0 shadow-sm" style={{ borderRadius: '16px', overflow: 'hidden' }}>
            {/* Seller header row */}
            <div
                className="card-header d-flex justify-content-between align-items-center px-4 py-3"
                style={{ cursor: 'pointer', backgroundColor: '#fff', borderBottom: '1px solid rgba(0,0,0,0.05)' }}
                onClick={() => setIsOpen(o => !o)}
            >
                <div className="d-flex align-items-center gap-3">
                    <div className="p-2 bg-primary-subtle text-primary rounded-3" style={{ fontSize: '1.2rem' }}>{flag}</div>
                    <div>
                        <div className="fw-bold text-dark" style={{ fontSize: '1rem' }}>{seller.name}</div>
                        <div className="text-muted small">{seller.sellerId} · {seller.marketplace}</div>
                    </div>
                </div>

                <div className="d-flex align-items-center gap-3 flex-wrap">
                    {/* KPI pills */}
                    <div className="d-flex align-items-center gap-2 px-3 py-2 rounded-pill border bg-white border-light-subtle shadow-sm" style={{ fontSize: '13px', fontWeight: 500 }}>
                        <div className="d-flex align-items-center justify-content-center rounded-circle" style={{ width: 24, height: 24, backgroundColor: '#6366f120', color: '#6366f1' }}>
                            <Package size={12} />
                        </div>
                        <div className="d-flex flex-column" style={{ lineHeight: '1.1' }}>
                            <span className="text-muted text-uppercase" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.05em' }}>In System</span>
                            <span className="fw-bold text-dark" style={{ fontSize: 14 }}>{seller.dbAsinCount ?? seller.totalAsins ?? 0}</span>
                        </div>
                    </div>
                    <div className="d-flex align-items-center gap-2 px-3 py-2 rounded-pill border bg-white border-light-subtle shadow-sm" style={{ fontSize: '13px', fontWeight: 500 }}>
                        <div className="d-flex align-items-center justify-content-center rounded-circle" style={{ width: 24, height: 24, backgroundColor: '#10b98120', color: '#10b981' }}>
                            <Zap size={12} />
                        </div>
                        <div className="d-flex flex-column" style={{ lineHeight: '1.1' }}>
                            <span className="text-muted text-uppercase" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.05em' }}>Keepa</span>
                            <span className="fw-bold text-dark" style={{ fontSize: 14 }}>{seller.keepaAsinCount ?? 0}</span>
                        </div>
                    </div>
                    {seller.newAsinCount > 0 && (
                        <span className="badge rounded-pill bg-success-subtle text-success border border-success-subtle px-3">
                            +{seller.newAsinCount} new today
                        </span>
                    )}
                    <span className="text-muted small text-end" style={{ whiteSpace: 'nowrap', minWidth: 90 }}>
                        {lastSync ? `Synced ${lastSync.toLocaleDateString()}` : 'Never synced'}
                    </span>
                    <button
                        className="btn btn-outline-primary btn-sm fw-bold d-flex align-items-center gap-2 shadow-sm rounded-pill px-3"
                        onClick={e => { e.stopPropagation(); onSync(seller._id); }}
                        disabled={syncing}
                    >
                        <RefreshCw size={13} className={syncing ? 'spin' : ''} />
                        {syncing ? 'Syncing...' : 'Sync Now'}
                    </button>
                    <button className="btn btn-sm btn-light rounded-circle shadow-sm p-1">
                        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                </div>
            </div>

            {/* ASIN table */}
            {isOpen && (
                <div className="card-body p-0" style={{ backgroundColor: '#fff' }}>
                    <div className="d-flex justify-content-between align-items-center gap-2 p-3 border-bottom bg-light-subtle">
                        <div className="input-group input-group-sm rounded-pill overflow-hidden border shadow-sm" style={{ width: 280 }}>
                            <span className="input-group-text bg-white border-0 text-muted ps-3"><Search size={13} /></span>
                            <input
                                type="text"
                                className="form-control border-0 ps-0"
                                placeholder="Search ASIN or title..."
                                style={{ fontSize: '13px' }}
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <span className="text-muted small">{filtered.length} ASINs</span>
                    </div>

                    {loading ? (
                        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: 120 }}>
                            <RefreshCw className="text-primary spin me-2" size={20} />
                            <span className="text-muted">Loading ASINs...</span>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center text-muted py-4 small">
                            No ASINs found. Click <strong>Sync Now</strong> to pull from Keepa.
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="table table-bordered table-hover mb-0 w-100" style={{ fontSize: '0.8rem', minWidth: 900 }}>
                                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f9fafb', zIndex: 10 }}>
                                    <tr>
                                        {['ASIN', 'Title', 'LQS', 'Images', 'Desc Length', 'Scrape Status', 'Added On', 'Amazon Link'].map(h => (
                                            <th key={h} style={{ backgroundColor: '#f3f4f6', color: '#111827', fontWeight: 600, borderBottom: '2px solid #d1d5db', padding: '0.65rem 0.75rem', whiteSpace: 'nowrap' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((asin, i) => (
                                        <tr key={asin._id || i} style={{ backgroundColor: '#fff' }}>
                                            <td style={{ fontWeight: 600, color: '#111827', padding: '0.65rem 0.75rem', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                                                {asin.asinCode}
                                                {isNew24h(asin.createdAt) && (
                                                    <span className="badge ms-1 bg-success-subtle text-success border border-success-subtle" style={{ fontSize: '0.65rem' }}>NEW</span>
                                                )}
                                            </td>
                                            <td style={{ color: '#4b5563', padding: '0.65rem 0.75rem', borderBottom: '1px solid #e5e7eb', maxWidth: 260 }}>
                                                <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {asin.title || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Not scraped yet</span>}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.65rem 0.75rem', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>{getLqsBadge(asin.lqs)}</td>
                                            <td style={{ padding: '0.65rem 0.75rem', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                                                {asin.imagesCount != null ? (
                                                    <span className="badge" style={{ backgroundColor: '#f3f4f6', color: '#374151', fontWeight: 500 }}>{asin.imagesCount}</span>
                                                ) : <span style={{ color: '#9ca3af' }}>—</span>}
                                            </td>
                                            <td style={{ padding: '0.65rem 0.75rem', borderBottom: '1px solid #e5e7eb', textAlign: 'center', color: '#6b7280', fontSize: '0.75rem' }}>
                                                {asin.descLength ?? <span style={{ color: '#9ca3af' }}>—</span>}
                                            </td>
                                            <td style={{ padding: '0.65rem 0.75rem', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                                                {getScrapeStatusBadge(asin.scrapeStatus || asin.status)}
                                            </td>
                                            <td style={{ padding: '0.65rem 0.75rem', borderBottom: '1px solid #e5e7eb', fontSize: '0.75rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                                                {asin.createdAt ? new Date(asin.createdAt).toLocaleDateString() : '—'}
                                            </td>
                                            <td style={{ padding: '0.65rem 0.75rem', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                                                <a
                                                    href={`https://${seller.marketplace}/dp/${asin.asinCode}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="btn btn-sm btn-outline-primary rounded-pill d-inline-flex align-items-center gap-1"
                                                    style={{ fontSize: '0.7rem', padding: '0.2rem 0.6rem' }}
                                                    onClick={e => e.stopPropagation()}
                                                >
                                                    View <ExternalLink size={10} />
                                                </a>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const SellerAsinTrackerPage = () => {
    const [sellers, setSellers] = useState([]);
    const [tokenStatus, setTokenStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [syncingAll, setSyncingAll] = useState(false);
    const [syncingSeller, setSyncingSeller] = useState(null);
    const [alert, setAlert] = useState(null); // { msg, type: 'success'|'warning'|'danger' }
    const [keepaKeyMissing, setKeepaKeyMissing] = useState(false);
    const [showOverview, setShowOverview] = useState(true);
    const [refreshKeys, setRefreshKeys] = useState({}); // sellerId -> timestamp

    const showAlert = (msg, type = 'success') => {
        setAlert({ msg, type });
        setTimeout(() => setAlert(null), 6000);
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await api.sellerTrackerApi.getTrackers();
            if (res.success) {
                setSellers(res.data || []);
                setTokenStatus(res.tokenStatus);
                setKeepaKeyMissing(false);
            }
        } catch (e) {
            if (e.message && e.message.includes('KEEPA_API_KEY')) setKeepaKeyMissing(true);
            else showAlert(e.message, 'danger');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const handleSyncSeller = async (sellerId) => {
        setSyncingSeller(sellerId);
        try {
            const res = await api.sellerTrackerApi.syncSeller(sellerId);
            if (res.success) {
                showAlert(`✅ ${res.seller}: +${res.added} new ASINs synced (${res.total} total on Keepa)`);
                // Trigger refresh for this specific panel
                setRefreshKeys(prev => ({ ...prev, [sellerId]: Date.now() }));
                // Also update the seller info in the overview
                await loadData();
            }
        } catch (e) {
            showAlert(`Failed to sync: ${e.message}`, 'danger');
        } finally {
            setSyncingSeller(null);
        }
    };

    const handleSyncAll = async () => {
        setSyncingAll(true);
        try {
            const res = await api.sellerTrackerApi.syncAll();
            if (res.success) {
                showAlert(`✅ Sync complete — ${res.totalAdded} new ASINs added across ${res.results.length} sellers`);
                // Refresh all open panels by updating all refresh keys
                const newKeys = {};
                sellers.forEach(s => { newKeys[s._id] = Date.now(); });
                setRefreshKeys(newKeys);
                await loadData();
            }
        } catch (e) {
            showAlert(`Sync all failed: ${e.message}`, 'danger');
        } finally {
            setSyncingAll(false);
        }
    };

    const kpis = useMemo(() => [
        { label: 'Total Sellers', value: sellers.length, color: '#6366f1', icon: <Store size={14} /> },
        { label: 'ASINs in System', value: sellers.reduce((s, x) => s + (x.dbAsinCount || 0), 0).toLocaleString(), color: '#10b981', icon: <Package size={14} /> },
        { label: 'Keepa Catalog', value: sellers.reduce((s, x) => s + (x.keepaAsinCount || 0), 0).toLocaleString(), color: '#2563eb', icon: <BarChart2 size={14} /> },
        { label: 'New (24h)', value: `+${sellers.reduce((s, x) => s + (x.newAsinCount || 0), 0)}`, color: '#f59e0b', icon: <Zap size={14} /> },
    ], [sellers]);

    if (loading && sellers.length === 0) {
        return (
            <div className="container-fluid p-0">
                <div className="page-content py-5">
                    <div className="d-flex flex-column justify-content-center align-items-center" style={{ minHeight: 400 }}>
                        <RefreshCw className="text-primary spin mb-3" size={40} />
                        <p className="text-muted fw-500">Loading seller data from Keepa...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh' }}>
            <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>

            {/* Page Header Area */}
            <div className="p-4 bg-white border-bottom shadow-xs mb-4">
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                    <div>
                        <div className="d-flex align-items-center gap-2 mb-1">
                            <div className="bg-primary text-white p-2 rounded-3 shadow-sm"><Zap size={20} /></div>
                            <h1 className="h4 fw-bold mb-0 text-dark" style={{ letterSpacing: '-0.01em' }}>
                                Seller ASIN <span className="text-primary">Tracker</span>
                            </h1>
                        </div>
                        <p className="text-muted small mb-0">Auto-discover new ASINs via Keepa API · Syncs every 12 hours automatically</p>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                        {tokenStatus && (
                            <div className="px-3 py-2 rounded-pill bg-light border d-flex align-items-center gap-2 shadow-xs" style={{ fontSize: '12px', fontWeight: 600 }}>
                                <span className="text-primary">🪙</span>
                                <span className="text-dark">{tokenStatus.tokensLeft?.toLocaleString()} tokens left</span>
                            </div>
                        )}
                        <button
                            className="btn btn-primary d-flex align-items-center gap-2 rounded-pill px-4 shadow-sm fw-bold"
                            onClick={handleSyncAll}
                            disabled={syncingAll}
                            style={{ height: '42px' }}
                        >
                            <RefreshCw size={16} className={syncingAll ? 'spin' : ''} />
                            {syncingAll ? 'Syncing All...' : 'Sync All Sellers'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="container-fluid px-4 pb-5">
                {/* Alert banner */}
                {alert && (
                    <div className={`alert alert-${alert.type} d-flex align-items-center mb-4 border-0 shadow-sm rounded-4`} role="alert" style={{ padding: '0.75rem 1.25rem' }}>
                        <AlertTriangle className="me-2" size={18} />
                        <span className="small fw-500">{alert.msg}</span>
                    </div>
                )}

                {/* Missing API key warning */}
                {keepaKeyMissing && (
                    <div className="alert alert-warning d-flex align-items-start mb-4 border-0 shadow-sm rounded-4" role="alert">
                        <AlertTriangle className="me-2 mt-1 text-warning flex-shrink-0" size={18} />
                        <div>
                            <div className="fw-bold mb-1">Keepa API Key Not Set</div>
                            <div className="small">Add your key to <code>backend/.env</code>: <code>KEEPA_API_KEY=your_key_here</code></div>
                            <a href="https://keepa.com/#!api" target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-warning rounded-pill mt-2 d-inline-flex align-items-center gap-1">
                                Get Keepa API Key <ExternalLink size={11} />
                            </a>
                        </div>
                    </div>
                )}

                {/* Overview KPIs */}
                <div className="mb-4">
                    <div className="d-flex align-items-center gap-2 mb-3 cursor-pointer" onClick={() => setShowOverview(!showOverview)}>
                        <div className="p-1.5 bg-primary-subtle text-primary rounded-2"><BarChart2 size={16} /></div>
                        <h6 className="mb-0 fw-bold text-dark">Seller Intelligence Overview</h6>
                        <div className="ms-auto text-muted">{showOverview ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
                    </div>

                    {showOverview && (
                        <div className="row g-3">
                            {kpis.map((kpi, i) => (
                                <div key={i} className="col-md-3">
                                    <div className="glass-card p-3 d-flex align-items-center gap-3" style={{ borderRadius: '16px' }}>
                                        <div className="d-flex align-items-center justify-content-center rounded-circle shadow-sm" style={{ width: 40, height: 40, backgroundColor: kpi.color + '15', color: kpi.color }}>
                                            {kpi.icon}
                                        </div>
                                        <div>
                                            <div className="text-muted text-uppercase fw-700" style={{ fontSize: '10px', letterSpacing: '0.05em' }}>{kpi.label}</div>
                                            <div className="h5 fw-bold mb-0 text-dark">{kpi.value}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Seller list */}
                <div className="card border-0 shadow-sm mb-5" style={{ borderRadius: '16px', overflow: 'hidden' }}>
                    <div className="card-header d-flex justify-content-between align-items-center px-4 py-3" style={{ backgroundColor: '#fff', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                        <h5 className="card-title mb-0 d-flex align-items-center gap-2 text-dark fw-bold" style={{ fontSize: '1.1rem' }}>
                            <Store size={18} className="text-primary" />
                            Active Sellers & Inventory
                            <span className="badge rounded-pill bg-primary-subtle text-primary border border-primary-subtle px-3 ms-2" style={{ fontSize: '11px' }}>
                                {sellers.length} Sellers Tracking
                            </span>
                        </h5>
                        <button className="btn btn-white btn-sm shadow-sm rounded-pill px-3 border" onClick={loadData}>
                            <RefreshCw size={13} className={loading ? 'spin me-1' : 'me-1'} /> Refresh Data
                        </button>
                    </div>

                    <div className="card-body p-4" style={{ backgroundColor: '#f9fafb' }}>
                        {sellers.length === 0 && !loading ? (
                            <div className="text-center text-muted py-5 bg-white rounded-4 border border-dashed">
                                <Package size={48} className="mb-3 text-muted opacity-25" />
                                <h6 className="fw-bold">No Sellers Found</h6>
                                <p className="small mb-0">Add sellers first from the <strong>Sellers</strong> page.</p>
                            </div>
                        ) : (
                            <div className="d-grid gap-3">
                                {sellers.map(seller => (
                                    <SellerAsinPanel
                                        key={seller._id}
                                        seller={seller}
                                        onSync={handleSyncSeller}
                                        syncing={syncingSeller === seller._id}
                                        refreshKey={refreshKeys[seller._id]}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SellerAsinTrackerPage;
