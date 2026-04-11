import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { RefreshCw, Package, Search, ChevronDown, ChevronUp, Zap, Activity, AlertTriangle, ExternalLink, BarChart2, Store, Plus, Filter, Database, Globe, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { PageLoader } from '@/components/application/loading-indicator/PageLoader';
import { LoadingIndicator } from '@/components/application/loading-indicator/loading-indicator';

/* ── Zinc Design Tokens (inline) ─────────────────────────── */
const Z = {
  white: '#FFFFFF',
  bg: '#F9FAFB',
  50: '#FAFAFA',
  100: '#F4F4F5',
  200: '#E4E4E7',
  300: '#D4D4D8',
  400: '#A1A1AA',
  500: '#71717A',
  600: '#52525B',
  700: '#3F3F46',
  800: '#27272A',
  900: '#18181B',
  brand: '#18181B',
  shadow: '0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.06)',
  shadowMd: '0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05)',
};

const MARKETPLACE_FLAGS = { 'amazon.in': '🇮🇳' };

/* ── Badge Helpers ─────────────────────────────────────── */
const getLqsBadge = (lqs) => {
  if (lqs == null) return <span style={{ color: Z[400] }}>—</span>;
  let colors;
  if (lqs >= 80) colors = { bg: '#ecfdf5', text: '#059669', border: '#d1fae5' };
  else if (lqs >= 60) colors = { bg: '#fffbeb', text: '#d97706', border: '#fef3c7' };
  else colors = { bg: '#fef2f2', text: '#dc2626', border: '#fee2e2' };

  return (
    <span style={{ backgroundColor: colors.bg, color: colors.text, border: `1px solid ${colors.border}`, fontWeight: 600, fontSize: '0.75rem', padding: '4px 10px', borderRadius: '6px', display: 'inline-block' }}>
      {lqs}
    </span>
  );
};

const getScrapeStatusBadge = (status) => {
  const map = {
    PENDING: { bg: '#fffbeb', text: '#d97706', border: '#fef3c7', label: 'Pending' },
    SCRAPED: { bg: '#ecfdf5', text: '#059669', border: '#d1fae5', label: 'Scraped' },
    FAILED: { bg: '#fef2f2', text: '#dc2626', border: '#fee2e2', label: 'Failed' },
    SCRAPING: { bg: '#eff6ff', text: '#2563eb', border: '#dbeafe', label: 'Scraping' },
    Active: { bg: '#ecfdf5', text: '#059669', border: '#d1fae5', label: 'Active' },
  };
  const s = map[status] || { bg: Z[100], text: Z[500], border: Z[200], label: status || 'Unknown' };
  return (
    <span style={{ backgroundColor: s.bg, color: s.text, border: `1px solid ${s.border}`, fontWeight: 600, fontSize: '0.7rem', padding: '4px 10px', borderRadius: '6px', display: 'inline-block' }}>
      {s.label}
    </span>
  );
};

/* ── Inline KPI Card ───────────────────────────────────── */
const TrackerKPI = ({ title, value, subtitle, Icon, accentColor }) => (
  <div style={{ background: Z.white, borderRadius: '16px', border: `1px solid ${Z[200]}`, boxShadow: Z.shadow, padding: '20px 24px', flex: 1, minWidth: 180 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
      <div style={{ width: 42, height: 42, borderRadius: 12, background: `${accentColor}12`, color: accentColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={20} strokeWidth={2.5} />
      </div>
    </div>
    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: Z[400], marginBottom: 4 }}>{title}</div>
    <div style={{ fontSize: 28, fontWeight: 800, color: Z[900], letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 4 }}>{value}</div>
    <div style={{ fontSize: 11, color: Z[400], fontWeight: 500 }}>{subtitle}</div>
  </div>
);

/* ── Seller ASIN Panel (expandable) ────────────────────── */
const SellerAsinPanel = ({ seller, onSync, syncing, refreshKey }) => {
  const { sellerId: urlSellerId } = useParams();
  const [asins, setAsins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(seller._id === urlSellerId);
  const [search, setSearch] = useState('');
  const [lqsFilter, setLqsFilter] = useState('');

  // Auto-open if URL matches
  useEffect(() => {
    if (seller._id === urlSellerId) {
      setIsOpen(true);
      // Scroll into view
      const el = document.getElementById(`seller-${seller._id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [urlSellerId, seller._id]);

  const load = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      const res = await api.sellerTrackerApi.getSellerAsins(seller._id);
      if (res.success) setAsins(res.data || []);
    } catch (e) {
      console.error('Failed to load ASINs for seller:', e.message);
    } finally {
      setLoading(false);
    }
  }, [isOpen, seller._id]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const filtered = useMemo(() => {
    let result = asins;
    if (search) {
      result = result.filter(a => 
        a.asinCode?.toLowerCase().includes(search.toLowerCase()) || 
        a.title?.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (lqsFilter) {
      if (lqsFilter === 'high') {
        result = result.filter(a => a.lqs >= 80);
      } else if (lqsFilter === 'medium') {
        result = result.filter(a => a.lqs >= 60 && a.lqs < 80);
      } else if (lqsFilter === 'low') {
        result = result.filter(a => a.lqs != null && a.lqs < 60);
      }
    }
    return result;
  }, [asins, search, lqsFilter]);

  const flag = MARKETPLACE_FLAGS[seller.marketplace] || '🌐';
  const lastSync = seller.lastKeepaSync ? new Date(seller.lastKeepaSync) : null;
  const isNew24h = (date) => date && new Date(date) > new Date(Date.now() - 86400000);

  return (
    <div 
        id={`seller-${seller._id}`}
        style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid ${Z[200]}`, background: Z.white, boxShadow: Z.shadow, marginBottom: 12, transition: 'box-shadow 0.2s ease' }}
    >
      {/* Seller header row */}
      <div
        style={{ cursor: 'pointer', backgroundColor: Z.white, borderBottom: isOpen ? `1px solid ${Z[200]}` : 'none', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background 0.15s' }}
        onClick={() => setIsOpen(o => !o)}
        onMouseEnter={e => e.currentTarget.style.background = Z[50]}
        onMouseLeave={e => e.currentTarget.style.background = Z.white}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: Z[50], border: `1px solid ${Z[200]}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            {flag}
          </div>
          <div>
            <div style={{ fontWeight: 700, color: Z[900], fontSize: '0.95rem' }}>{seller.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: Z[500], marginTop: 2 }}>
              <span style={{ background: Z[100], color: Z[600], border: `1px solid ${Z[200]}`, fontSize: 10, padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>{seller.sellerId}</span>
              <span style={{ color: Z[300] }}>·</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Globe size={10} /> {seller.marketplace}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          {/* KPI Summary (desktop) */}
          <div className="d-none d-lg-flex" style={{ alignItems: 'center', gap: 24, marginRight: 12 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: Z[400] }}>Inventory</div>
              <div style={{ fontWeight: 700, color: Z[900], fontSize: 14 }}>{seller.dbAsinCount ?? seller.totalAsins ?? 0}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: Z[400] }}>Keepa Catalog</div>
              <div style={{ fontWeight: 700, color: Z[900], fontSize: 14 }}>{seller.keepaAsinCount ?? 0}</div>
            </div>
          </div>

          {seller.newAsinCount > 0 && (
            <span style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #d1fae5', fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Plus size={10} /> {seller.newAsinCount} new today
            </span>
          )}

          <div className="d-none d-md-block" style={{ textAlign: 'right', minWidth: 100 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: Z[400] }}>Last Sync</div>
            <div style={{ fontSize: 12, color: Z[600], fontWeight: 500 }}>{lastSync ? lastSync.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Never'}</div>
          </div>

          <button
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: Z.white, border: `1px solid ${Z[200]}`, borderRadius: 20, padding: '6px 16px', fontSize: 12, fontWeight: 700, color: Z[900], cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', transition: 'all 0.15s' }}
            onClick={e => { e.stopPropagation(); onSync(seller._id); }}
            disabled={syncing}
            onMouseEnter={e => { e.currentTarget.style.background = Z[50]; e.currentTarget.style.boxShadow = Z.shadow; }}
            onMouseLeave={e => { e.currentTarget.style.background = Z.white; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)'; }}
          >
            <RefreshCw size={14} className={syncing ? 'spin' : ''} style={{ color: syncing ? Z[900] : Z[400] }} />
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>

          <div style={{ width: 32, height: 32, borderRadius: '50%', border: `1px solid ${Z[200]}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            {isOpen ? <ChevronUp size={16} style={{ color: Z[600] }} /> : <ChevronDown size={16} style={{ color: Z[600] }} />}
          </div>
        </div>
      </div>

      {/* ASIN table */}
      {isOpen && (
        <div style={{ background: Z.white }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '12px 20px', borderBottom: `1px solid ${Z[100]}`, background: Z[50] }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${Z[200]}`, borderRadius: 20, overflow: 'hidden', background: Z.white, boxShadow: '0 1px 2px rgba(0,0,0,0.04)', width: 280 }}>
                <span style={{ padding: '6px 0 6px 12px', color: Z[400] }}><Search size={14} /></span>
                <input
                  type="text"
                  placeholder="Filter by ASIN or Title..."
                  style={{ border: 'none', outline: 'none', padding: '6px 12px 6px 8px', fontSize: 13, width: '100%', background: 'transparent', color: Z[900] }}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <select
                value={lqsFilter}
                onChange={e => setLqsFilter(e.target.value)}
                style={{ border: `1px solid ${Z[200]}`, borderRadius: 20, padding: '6px 12px', fontSize: 13, background: Z.white, color: Z[700], cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
              >
                <option value="">All LQS</option>
                <option value="high">High (80+)</option>
                <option value="medium">Medium (60-79)</option>
                <option value="low">Low (&lt;60)</option>
              </select>
            </div>
            <span style={{ fontSize: 12, color: Z[500], fontWeight: 500 }}>{filtered.length} ASINs found</span>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '48px 0' }}>
              <RefreshCw className="spin" size={24} style={{ color: Z[900], marginBottom: 8 }} />
              <span style={{ color: Z[500], fontSize: 13, fontWeight: 500 }}>Retrieving Catalog Data...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', background: Z.white }}>
              <Package size={40} style={{ color: Z[200], marginBottom: 8 }} />
              <h6 style={{ color: Z[900], fontWeight: 700, marginBottom: 4 }}>No matches found</h6>
              <p style={{ color: Z[500], fontSize: 13, marginBottom: 0 }}>Try adjusting your search or sync with Keepa.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: '0.825rem', borderCollapse: 'collapse', minWidth: 900 }}>
                <thead>
                  <tr>
                    {['ASIN Code', 'Product Title', 'LQS', 'Images', 'Desc Len', 'Status', 'Date Added', 'Link'].map(h => (
                      <th key={h} style={{ borderBottom: `1px solid ${Z[200]}`, padding: '12px 16px', background: Z[50], fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, color: Z[500], textAlign: h === 'Product Title' ? 'left' : 'center' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((asin, i) => (
                    <tr
                      key={asin._id || i}
                      style={{ transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = Z[50]}
                      onMouseLeave={e => e.currentTarget.style.background = Z.white}
                    >
                      <td style={{ borderBottom: `1px solid ${Z[100]}`, padding: '12px 16px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 700, color: Z[900], fontFamily: 'monospace' }}>{asin.asinCode}</span>
                          {isNew24h(asin.createdAt) && (
                            <span style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #d1fae5', fontSize: '0.6rem', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>NEW</span>
                          )}
                        </div>
                      </td>
                      <td style={{ borderBottom: `1px solid ${Z[100]}`, padding: '12px 16px', verticalAlign: 'middle', maxWidth: 300 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {asin.imageUrl && <img src={asin.imageUrl} alt="" style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 6, border: `1px solid ${Z[200]}` }} />}
                          <span style={{ color: Z[700], fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260, display: 'inline-block' }} title={asin.title}>
                            {asin.title || <span style={{ color: Z[400], fontStyle: 'italic' }}>Not available</span>}
                          </span>
                        </div>
                      </td>
                      <td style={{ borderBottom: `1px solid ${Z[100]}`, padding: '12px 16px', verticalAlign: 'middle', textAlign: 'center' }}>{getLqsBadge(asin.lqs)}</td>
                      <td style={{ borderBottom: `1px solid ${Z[100]}`, padding: '12px 16px', verticalAlign: 'middle', textAlign: 'center' }}>
                        {asin.imagesCount != null ? (
                          <span style={{ background: Z[100], color: Z[700], fontWeight: 600, border: `1px solid ${Z[200]}`, padding: '3px 10px', borderRadius: 6, fontSize: '0.8rem' }}>{asin.imagesCount}</span>
                        ) : <span style={{ color: Z[300] }}>—</span>}
                      </td>
                      <td style={{ borderBottom: `1px solid ${Z[100]}`, padding: '12px 16px', verticalAlign: 'middle', textAlign: 'center', color: Z[500], fontSize: '0.8rem' }}>
                        {asin.descLength ?? <span style={{ color: Z[300] }}>—</span>}
                      </td>
                      <td style={{ borderBottom: `1px solid ${Z[100]}`, padding: '12px 16px', verticalAlign: 'middle', textAlign: 'center' }}>
                        {getScrapeStatusBadge(asin.scrapeStatus || asin.status)}
                      </td>
                      <td style={{ borderBottom: `1px solid ${Z[100]}`, padding: '12px 16px', verticalAlign: 'middle', color: Z[500], whiteSpace: 'nowrap', textAlign: 'center' }}>
                        {asin.createdAt ? new Date(asin.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td style={{ borderBottom: `1px solid ${Z[100]}`, padding: '12px 16px', verticalAlign: 'middle', textAlign: 'center' }}>
                        <a
                          href={`https://${seller.marketplace}/dp/${asin.asinCode}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '50%', border: `1px solid ${Z[200]}`, color: Z[600], background: Z.white, boxShadow: '0 1px 2px rgba(0,0,0,0.04)', textDecoration: 'none', transition: 'all 0.15s' }}
                          title="View on Amazon"
                          onClick={e => e.stopPropagation()}
                          onMouseEnter={e => { e.currentTarget.style.background = Z[900]; e.currentTarget.style.color = Z.white; e.currentTarget.style.borderColor = Z[900]; }}
                          onMouseLeave={e => { e.currentTarget.style.background = Z.white; e.currentTarget.style.color = Z[600]; e.currentTarget.style.borderColor = Z[200]; }}
                        >
                          <ExternalLink size={14} />
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

/* ── Main Page Component ───────────────────────────────── */
const SellerAsinTrackerPage = () => {
  const [sellers, setSellers] = useState([]);
  const [tokenStatus, setTokenStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingSeller, setSyncingSeller] = useState(null);
  const [alert, setAlert] = useState(null);
  const [keepaKeyMissing, setKeepaKeyMissing] = useState(false);
  const [showOverview, setShowOverview] = useState(true);
  const [refreshKeys, setRefreshKeys] = useState({});

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
        showAlert(`✅ ${res.seller}: +${res.added} new ASINs synced`);
        setRefreshKeys(prev => ({ ...prev, [sellerId]: Date.now() }));
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
        showAlert(`✅ Sync complete — ${res.totalAdded} new ASINs added`);
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

  const kpiData = useMemo(() => [
    { title: 'Tracked Sellers', value: sellers.length, Icon: Store, subtitle: 'Sellers in catalog', color: '#6366f1' },
    { title: 'System ASINs', value: sellers.reduce((s, x) => s + (x.dbAsinCount || 0), 0).toLocaleString(), Icon: Database, subtitle: 'Total in database', color: '#10b981' },
    { title: 'Keepa Catalog', value: sellers.reduce((s, x) => s + (x.keepaAsinCount || 0), 0).toLocaleString(), Icon: Activity, subtitle: 'Live on Amazon', color: '#2563eb' },
    { title: 'Growth (24h)', value: `+${sellers.reduce((s, x) => s + (x.newAsinCount || 0), 0)}`, Icon: Zap, subtitle: 'New discoveries', color: '#f59e0b' },
  ], [sellers]);

  /* ── Loading state ─── */
  if (loading && sellers.length === 0) {
    return <PageLoader message="Connecting to Keepa..." />;
  }

  return (
    <div style={{ backgroundColor: Z.bg, minHeight: '100vh' }}>
      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {loading && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}>
          <LoadingIndicator type="line-simple" size="md" />
        </div>
      )}

      {/* ── Professional Header ─── */}
      <div style={{ background: Z.white, borderBottom: `1px solid ${Z[200]}`, boxShadow: '0 1px 2px rgba(0,0,0,0.03)', padding: '20px 28px', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: Z[900], color: Z.white, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: Z.shadow }}>
                <Zap size={22} />
              </div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: Z[900], letterSpacing: '-0.02em' }}>
                ASIN Catalog <span style={{ color: Z[400], fontWeight: 500 }}>Discovery</span>
              </h1>
            </div>
            <p style={{ color: Z[400], fontSize: 13, margin: 0, fontWeight: 500, paddingLeft: 56 }}>
              Automated inventory monitoring via Keepa SDK • Auto-discovery active
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {tokenStatus && (
              <div className="d-none d-md-flex" style={{ flexDirection: 'column', alignItems: 'flex-end', marginRight: 8 }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: Z[400] }}>API Quota</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: Z[900] }}>
                  {tokenStatus.tokensLeft?.toLocaleString()} <span style={{ fontSize: 10, color: Z[400] }}>Left</span>
                </div>
              </div>
            )}
            <button
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: Z[900], color: Z.white, border: 'none', borderRadius: 22, padding: '10px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: Z.shadow, transition: 'all 0.15s', height: 44 }}
              onClick={handleSyncAll}
              disabled={syncingAll}
              onMouseEnter={e => e.currentTarget.style.background = Z[700]}
              onMouseLeave={e => e.currentTarget.style.background = Z[900]}
            >
              <RefreshCw size={16} className={syncingAll ? 'spin' : ''} />
              Sync All Sellers
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 28px' }}>
        {/* ── Alert banners ─── */}
        {alert && (
          <div style={{
            background: alert.type === 'danger' ? '#fef2f2' : '#ecfdf5',
            color: alert.type === 'danger' ? '#991b1b' : '#065f46',
            borderRadius: 14,
            padding: '14px 20px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontWeight: 600,
            fontSize: 14,
            boxShadow: Z.shadow,
            animation: 'fadeIn 0.3s ease'
          }}>
            <div style={{ background: 'rgba(255,255,255,0.5)', borderRadius: '50%', padding: 6, display: 'flex' }}>
              <AlertTriangle size={16} />
            </div>
            {alert.msg}
          </div>
        )}

        {keepaKeyMissing && (
          <div style={{ background: 'linear-gradient(135deg, #fffbeb, #fef3c7)', borderRadius: 16, padding: '20px 24px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16, boxShadow: Z.shadow }}>
            <div style={{ background: Z.white, borderRadius: '50%', padding: 14, boxShadow: Z.shadow }}>
              <AlertTriangle size={24} style={{ color: '#d97706' }} />
            </div>
            <div>
              <h6 style={{ fontWeight: 700, margin: '0 0 4px 0', color: '#92400e' }}>Keepa API Configuration Required</h6>
              <p style={{ fontSize: 13, margin: '0 0 8px 0', color: '#92400e' }}>Connect your Keepa account to enable automatic ASIN tracking across your seller accounts.</p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <a href="https://keepa.com/#!api" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', background: '#d97706', color: Z.white, borderRadius: 20, fontWeight: 700, padding: '6px 16px', fontSize: 12, textDecoration: 'none', boxShadow: Z.shadow }}>
                  Get API Access
                </a>
                <code style={{ background: Z.white, padding: '4px 12px', borderRadius: 8, border: `1px solid ${Z[200]}`, fontSize: 12 }}>KEEPA_API_KEY=•••</code>
              </div>
            </div>
          </div>
        )}

        {/* ── Intelligence Overview KPIs ─── */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, padding: '0 4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, background: Z[900], color: Z.white, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BarChart2 size={13} />
              </div>
              <h6 style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: Z[500] }}>Fleet Intelligence Overview</h6>
            </div>
            <button
              style={{ background: 'none', border: 'none', color: Z[400], fontWeight: 700, fontSize: 11, cursor: 'pointer', textDecoration: 'none', padding: 0, transition: 'color 0.15s' }}
              onClick={() => setShowOverview(!showOverview)}
              onMouseEnter={e => e.currentTarget.style.color = Z[900]}
              onMouseLeave={e => e.currentTarget.style.color = Z[400]}
            >
              {showOverview ? 'HIDE DETAILS' : 'SHOW DETAILS'}
            </button>
          </div>

          {showOverview && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              {kpiData.map((kpi, i) => (
                <TrackerKPI key={i} title={kpi.title} value={kpi.value} subtitle={kpi.subtitle} Icon={kpi.Icon} accentColor={kpi.color} />
              ))}
            </div>
          )}
        </div>

        {/* ── Seller Catalog List ─── */}
        <div style={{ borderRadius: 16, overflow: 'hidden', border: `1px solid ${Z[200]}`, background: Z.white, boxShadow: Z.shadow, marginBottom: 40 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: Z.white, borderBottom: `1px solid ${Z[200]}` }}>
            <div>
              <h5 style={{ margin: 0, fontWeight: 700, color: Z[900], display: 'flex', alignItems: 'center', gap: 10, fontSize: '1rem' }}>
                <Store size={18} style={{ color: '#6366f1' }} />
                Managed Sellers
                <span style={{ background: Z[100], color: Z[500], border: `1px solid ${Z[200]}`, fontSize: 11, padding: '3px 12px', borderRadius: 20, fontWeight: 600, marginLeft: 4 }}>
                  {sellers.length} active
                </span>
              </h5>
            </div>
            <button
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: Z.white, border: `1px solid ${Z[200]}`, borderRadius: 20, padding: '6px 16px', fontSize: 12, fontWeight: 600, color: Z[700], cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', transition: 'all 0.15s' }}
              onClick={loadData}
              onMouseEnter={e => { e.currentTarget.style.background = Z[50]; e.currentTarget.style.boxShadow = Z.shadow; }}
              onMouseLeave={e => { e.currentTarget.style.background = Z.white; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)'; }}
            >
              <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh Catalog
            </button>
          </div>

          <div style={{ padding: 16, background: Z[50] }}>
            {sellers.length === 0 && !loading ? (
              <div style={{ textAlign: 'center', padding: '48px 0', background: Z.white, borderRadius: 16, border: `2px dashed ${Z[200]}` }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 72, height: 72, borderRadius: '50%', background: Z[50], border: `1px solid ${Z[100]}`, marginBottom: 16 }}>
                  <Store size={32} style={{ color: Z[300] }} />
                </div>
                <h5 style={{ color: Z[900], fontWeight: 700, marginBottom: 4 }}>Connect your first seller</h5>
                <p style={{ color: Z[500], fontSize: 13, marginBottom: 20 }}>You haven't added any Amazon sellers to monitor yet.</p>
                <button style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#6366f1', color: Z.white, border: 'none', borderRadius: 22, padding: '10px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: Z.shadow }}>
                  <Plus size={16} /> Add New Seller
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
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
