import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Input, Select, Space, Tag, Tooltip, Popconfirm, Card,
  Switch, Badge, Pagination, Empty, Spin, Typography
} from 'antd';
const { Text } = Typography;
import {
  Plus, Search, Play, Trash2, Copy, SlidersHorizontal, Zap,
  Settings, Activity, RefreshCw, Clock, CheckCircle2, PauseCircle,
  Package, PlayCircle
} from 'lucide-react';
import { rulesetApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const RULE_TYPE_OPTIONS = [
  { value: 'ASIN', label: 'ASIN Operations', icon: <Activity size={13} /> },
];

const typeColors = {
  ASIN: { bg: '#ecfdf5', color: '#2E7D32', border: '#a7f3d0' },
};

const TypeBadge = ({ type }) => {
  const c = typeColors[type] || typeColors.ASIN;
  return (
    <span className="badge" style={{
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
      fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
      textTransform: 'uppercase', letterSpacing: '0.03em'
    }}>
      {type || 'ASIN'}
    </span>
  );
};

const RuleSetsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rulesets, setRulesets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [executing, setExecuting] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  useEffect(() => { loadRulesets(); }, [page, filterStatus]);

  const loadRulesets = async () => {
    try {
      setLoading(true);
      const params = { page, limit: pageSize };
      const res = await rulesetApi.getAll(params);
      setRulesets(res.data || []);
      setTotal(res.pagination?.total || (res.data || []).length);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let list = rulesets;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(r => (r.name || '').toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q));
    }
    if (filterStatus === 'active') list = list.filter(r => r.isActive);
    if (filterStatus === 'paused') list = list.filter(r => !r.isActive);
    return list;
  }, [rulesets, searchQuery, filterStatus]);

  const activeCount = useMemo(() => rulesets.filter(r => r.isActive).length, [rulesets]);
  const autoCount = useMemo(() => rulesets.filter(r => r.isAutomated).length, [rulesets]);

  const handleToggle = async (id) => {
    try {
      await rulesetApi.toggle(id);
      setRulesets(prev => prev.map(r => (r._id === id || r.id === id) ? { ...r, isActive: !r.isActive } : r));
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id) => {
    try {
      await rulesetApi.delete(id);
      setRulesets(prev => prev.filter(r => (r._id !== id && r.id !== id)));
      setTotal(prev => Math.max(0, prev - 1));
    } catch (e) { console.error(e); }
  };

  const handleExecute = async (id) => {
    try {
      setExecuting(id);
      await rulesetApi.execute(id);
      loadRulesets();
    } catch (e) { console.error(e); }
    finally { setExecuting(null); }
  };

  const handleDuplicate = async (id) => {
    try {
      const res = await rulesetApi.duplicate(id);
      const newId = res.data?._id || res.data?.id;
      if (newId) navigate(`/rule-sets/${newId}`);
    } catch (e) { console.error(e); }
  };

  const formatTime = (date) => {
    if (!date) return 'Never';
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  return (
    <div style={{ background: '#fff', minHeight: 'calc(100vh - 60px)' }}>
      {/* Page Header */}
      <div style={{ padding: '20px 28px 16px', borderBottom: '1px solid #f4f4f7' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#18181b', margin: 0 }}>Automation Rules</h2>
            <p style={{ fontSize: 12, color: '#71717a', margin: 0, marginTop: 4 }}>Automated rules for listing quality, pricing, inventory alerts & task creation</p>
          </div>
          <Button type="primary" icon={<Plus size={13} />} onClick={() => navigate('/rule-sets/new')}
            style={{ borderRadius: 8, fontWeight: 600, fontSize: 11, height: 32 }}>
            Create Ruleset
          </Button>
        </div>
      </div>

      <div style={{ padding: '16px 28px' }}>
        {/* KPI Strip */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: '#f4f4f5', borderRadius: 8, border: '1px solid #e4e4e7' }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: '#18181b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={13} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#18181b' }}>{total}</div>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: '#ecfdf5', borderRadius: 8, border: '1px solid #d1fae5' }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: '#2E7D32', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={13} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#2E7D32', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#065f46' }}>{activeCount}</div>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe' }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: '#0288D1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={13} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#0288D1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Auto-run</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#1e40af' }}>{autoCount}</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Input prefix={<Search size={12} style={{ color: '#a1a1aa' }} />}
            placeholder="Search rulesets..." allowClear value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            size="small" style={{ width: 240, borderRadius: 8 }} />
          <Select size="small" value={filterStatus} style={{ width: 120, borderRadius: 8 }}
            onChange={v => { setFilterStatus(v); setPage(1); }}
            options={[
              { value: 'all', label: 'All' },
              { value: 'active', label: 'Active' },
              { value: 'paused', label: 'Paused' },
            ]} />
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}><Spin /></div>
        ) : filtered.length === 0 ? (
          <div style={{ border: '1px solid #e4e4e7', borderRadius: 12, padding: '60px 24px', textAlign: 'center' }}>
            <Empty description={
              <span style={{ color: '#a1a1aa', fontSize: 12 }}>
                {searchQuery ? 'No rulesets match your search' : 'No rulesets yet — create your first automation rule'}
              </span>
            } />
            {!searchQuery && (
              <Button type="primary" icon={<Plus size={13} />} onClick={() => navigate('/rule-sets/new')}
                style={{ borderRadius: 8, fontWeight: 600, fontSize: 11, height: 32, marginTop: 8 }}>
                Create First Ruleset
              </Button>
            )}
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
              {filtered.map(rs => {
                const rules = (() => { try { return JSON.parse(rs.rules || '[]'); } catch { return []; } })();
                let summary = {};
                try { summary = JSON.parse(rs.lastRunSummary || '{}'); } catch {}

                return (
                  <div key={rs._id || rs.id} style={{
                    border: '1px solid #e4e4e7', borderRadius: 12, overflow: 'hidden',
                    background: rs.isActive ? '#fff' : '#fafafa',
                    opacity: rs.isActive ? 1 : 0.7, transition: 'all 0.15s'
                  }}>
                    {/* Card Header */}
                    <div style={{ padding: '12px 16px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#18181b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {rs.name}
                          </span>
                          <TypeBadge type={rs.type} />
                        </div>
                        {rs.description && (
                          <p style={{ fontSize: 11, color: '#71717a', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {rs.description}
                          </p>
                        )}
                      </div>
                      <Switch size="small" checked={rs.isActive} onChange={() => handleToggle(rs._id || rs.id)} />
                    </div>

                    {/* Stats */}
                    <div style={{ padding: '10px 16px', display: 'flex', gap: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 10, color: '#a1a1aa' }}>Rules</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#18181b' }}>{rules.length}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 10, color: '#a1a1aa' }}>Runs</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#18181b' }}>{rs.totalRunCount || 0}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 10, color: '#a1a1aa' }}>Matched</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#2E7D32' }}>{summary.totalMatched || 0}</span>
                      </div>
                      <div style={{ flex: 1 }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {rs.isAutomated && (
                          <Tag style={{ fontSize: 9, fontWeight: 700, borderRadius: 4, padding: '1px 5px', margin: 0, background: '#eff6ff', color: '#0288D1', border: '1px solid #bfdbfe' }}>
                            <Clock size={9} style={{ marginRight: 2 }} />
                            {rs.runFrequency || 'Daily'}
                          </Tag>
                        )}
                        <span style={{ fontSize: 10, color: '#a1a1aa' }}>
                          {rs.lastRunAt ? formatTime(rs.lastRunAt) : 'Never run'}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ padding: '8px 16px 12px', borderTop: '1px solid #f4f4f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Space size={4}>
                        <Tooltip title="Run Now">
                          <Button type="text" size="small" icon={<PlayCircle size={13} />}
                            loading={executing === (rs._id || rs.id)}
                            onClick={() => handleExecute(rs._id || rs.id)}
                            style={{ color: '#2E7D32' }} />
                        </Tooltip>
                        <Tooltip title="Duplicate">
                          <Button type="text" size="small" icon={<Copy size={13} />}
                            onClick={() => handleDuplicate(rs._id || rs.id)} />
                        </Tooltip>
                        <Tooltip title="Edit">
                          <Button type="text" size="small" icon={<SlidersHorizontal size={13} />}
                            onClick={() => navigate(`/rule-sets/${rs._id || rs.id}`)} />
                        </Tooltip>
                        <Popconfirm title="Delete this ruleset?" onConfirm={() => handleDelete(rs._id || rs.id)} okText="Delete" okButtonProps={{ danger: true }}>
                          <Button type="text" danger size="small" icon={<Trash2 size={13} />} />
                        </Popconfirm>
                      </Space>
                    </div>
                  </div>
                );
              })}
            </div>

            {total > pageSize && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
                <Pagination size="small" current={page} pageSize={pageSize} total={total}
                  onChange={p => setPage(p)} showSizeChanger={false} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default RuleSetsPage;
