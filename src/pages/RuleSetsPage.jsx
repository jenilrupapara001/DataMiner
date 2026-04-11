import React, { useState, useEffect, useMemo } from 'react';
import { 
  Zap, Plus, Search, Play, Pause, Trash2, Edit, Eye, Copy, 
  X, RefreshCw, Target, TrendingUp, DollarSign, Package, Star,
  BarChart2, Activity, Settings, ToggleLeft, ToggleRight, ChevronRight,
  FileText, Clock, BarChart, Link2, Sliders, Lightbulb
} from 'lucide-react';
import { rulesetApi } from '../services/api';

const RULE_TYPE_INFO = [
  { value: 'Bid', label: 'Bid Rules', icon: Target, color: '#3b82f6', desc: 'Control keyword and product target bids' },
  { value: 'Campaign', label: 'Campaign', icon: BarChart2, color: '#8b5cf6', desc: 'Modify campaign-level properties' },
  { value: 'ASIN', label: 'ASIN/Product', icon: Package, color: '#f59e0b', desc: 'Evaluate ASIN data and take actions' },
  { value: 'Inventory', label: 'Inventory', icon: Package, color: '#06b6d4', desc: 'Monitor stock and trigger reorder alerts' },
  { value: 'Pricing', label: 'Pricing', icon: DollarSign, color: '#10b981', desc: 'Adjust prices based on competitors' },
  { value: 'Product', label: 'Product', icon: Star, color: '#ec4899', desc: 'Product-level rules and actions' },
  { value: 'SOV', label: 'Share of Voice', icon: TrendingUp, color: '#6366f1', desc: 'Manage impression share' }
];

const RuleSetsPage = () => {
  const [rulesets, setRulesets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [executing, setExecuting] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  useEffect(() => {
    loadRulesets();
  }, [filterType, pagination.page]);

  const loadRulesets = async () => {
    try {
      setLoading(true);
      const params = { page: pagination.page, limit: pagination.limit };
      if (filterType !== 'all') params.type = filterType;
      
      const response = await rulesetApi.getAll(params);
      setRulesets(response.rulesets || []);
      if (response.pagination) {
        setPagination(prev => ({ ...prev, ...response.pagination }));
      }
    } catch (error) {
      console.error('Error loading rulesets:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredRulesets = useMemo(() => {
    if (!searchQuery.trim()) return rulesets;
    const query = searchQuery.toLowerCase();
    return rulesets.filter(rs => 
      rs.name?.toLowerCase().includes(query) ||
      rs.type?.toLowerCase().includes(query)
    );
  }, [rulesets, searchQuery]);

  const handleToggle = async (ruleset) => {
    try {
      await rulesetApi.toggle(ruleset._id);
      loadRulesets();
    } catch (error) {
      console.error('Error toggling ruleset:', error);
    }
  };

  const handleDelete = async (ruleset) => {
    if (!confirm(`Delete ruleset "${ruleset.name}"?`)) return;
    try {
      await rulesetApi.delete(ruleset._id);
      loadRulesets();
    } catch (error) {
      console.error('Error deleting ruleset:', error);
    }
  };

  const handleExecute = async (ruleset) => {
    try {
      setExecuting(ruleset._id);
      const result = await rulesetApi.execute(ruleset._id);
      alert(`Executed!\nEvaluated: ${result.summary?.totalEvaluated}\nMatched: ${result.summary?.totalMatched}\nActioned: ${result.summary?.totalActioned}`);
    } catch (error) {
      console.error('Error executing ruleset:', error);
      alert('Failed to execute ruleset');
    } finally {
      setExecuting(null);
    }
  };

  const handleDuplicate = async (ruleset) => {
    try {
      const result = await rulesetApi.duplicate(ruleset._id);
      alert(`Duplicated! New ruleset: ${result.name}`);
      loadRulesets();
    } catch (error) {
      console.error('Error duplicating ruleset:', error);
    }
  };

  const navigateToBuilder = (rulesetId = null) => {
    window.location.href = rulesetId ? `/rule-sets/${rulesetId}/edit` : '/rule-sets/new';
  };

  const getTypeInfo = (type) => RULE_TYPE_INFO.find(t => t.value === type) || RULE_TYPE_INFO[2];

  const formatDate = (date) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', { 
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="page-container pb-5">
      <div className="page-header mb-4">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <div className="p-2 bg-primary-subtle text-primary rounded-3">
                <Zap size={20} />
              </div>
              <h1 className="page-title mb-0">Rule Sets</h1>
            </div>
            <p className="text-muted small mb-0">Automated rules for bid management, pricing, inventory & more</p>
          </div>
          <button 
            className="btn btn-primary d-flex align-items-center gap-2 rounded-pill px-4 py-2 shadow-sm border-0"
            onClick={() => navigateToBuilder()}
          >
            <Plus size={18} /> New Ruleset
          </button>
        </div>
      </div>

      <div className="page-content">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div className="input-group input-group-sm rounded-pill overflow-hidden border border-zinc-200 shadow-sm" style={{ width: '320px' }}>
            <span className="input-group-text bg-white border-0 text-muted ps-3"><Search size={14} /></span>
            <input 
              type="text" 
              className="form-control border-0 ps-0" 
              placeholder="Search rulesets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="d-flex gap-2">
            <select 
              className="form-select form-select-sm rounded-pill"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{ width: '160px' }}
            >
              <option value="all">All Types</option>
              {RULE_TYPE_INFO.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <span className="badge bg-secondary rounded-pill px-3 py-2">
              {pagination.total} Rulesets
            </span>
            <span className="badge bg-success rounded-pill px-3 py-2">
              {rulesets.filter(r => r.isActive).length} Active
            </span>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        ) : filteredRulesets.length === 0 ? (
          <div className="text-center py-5">
            <Zap size={48} className="text-muted mb-3" />
            <h5 className="text-muted">No rulesets configured</h5>
            <p className="text-muted">Create your first ruleset to automate your operations</p>
            <button className="btn btn-primary" onClick={() => navigateToBuilder()}>
              <Plus size={16} className="me-2" /> New Ruleset
            </button>
          </div>
        ) : (
          <div className="row g-3">
            {filteredRulesets.map(ruleset => {
              const typeInfo = getTypeInfo(ruleset.type);
              const TypeIcon = typeInfo.icon || Settings;
              
              return (
                <div key={ruleset._id} className="col-lg-6 col-xl-4">
                  <div className="card border-0 shadow-sm h-100" style={{ borderRadius: '16px' }}>
                    <div className="card-body p-4">
                      <div className="d-flex justify-content-between align-items-start mb-3">
                        <div className="d-flex align-items-center gap-3">
                          <div 
                            className="p-2 rounded-lg"
                            style={{ backgroundColor: (typeInfo.color || '#6366f1') + '20' }}
                          >
                            <TypeIcon size={20} style={{ color: typeInfo.color || '#6366f1' }} />
                          </div>
                          <div>
                            <h6 className="mb-0 fw-bold">{ruleset.name}</h6>
                            <span className="badge bg-light text-dark border" style={{ fontSize: '10px' }}>
                              {typeInfo.label}
                            </span>
                          </div>
                        </div>
                        <button 
                          className="btn btn-sm btn-link p-0"
                          onClick={() => handleToggle(ruleset)}
                          title={ruleset.isActive ? 'Disable' : 'Enable'}
                        >
                          {ruleset.isActive ? 
                            <ToggleRight size={24} className="text-success" /> : 
                            <ToggleLeft size={24} className="text-muted" />
                          }
                        </button>
                      </div>

                      <div className="mb-3">
                        <p className="text-muted small mb-2 line-clamp-2">
                          {ruleset.description || typeInfo.desc}
                        </p>
                        <div className="d-flex flex-wrap gap-1">
                          <span className="badge bg-light text-dark border">
                            {ruleset.rules?.length || 0} Rules
                          </span>
                          <span className="badge bg-light text-dark border">
                            {ruleset.runFrequency || 'Manual'}
                          </span>
                        </div>
                      </div>

                      <div className="p-3 bg-light rounded-3 mb-3">
                        <div className="row text-center">
                          <div className="col-4">
                            <div className="fw-bold text-primary">{ruleset.totalRunCount || 0}</div>
                            <div className="text-muted small">Runs</div>
                          </div>
                          <div className="col-4">
                            <div className="fw-bold text-success">{ruleset.lastRunAt ? '✓' : '—'}</div>
                            <div className="text-muted small">Last Run</div>
                          </div>
                          <div className="col-4">
                            <div className="fw-bold">{ruleset.isAutomated ? 'Auto' : 'Manual'}</div>
                            <div className="text-muted small">Mode</div>
                          </div>
                        </div>
                      </div>

                      <div className="d-flex justify-content-between align-items-center">
                        <div className="d-flex gap-1">
                          <button 
                            className="btn btn-sm btn-light rounded-pill px-2"
                            onClick={() => handleExecute(ruleset)}
                            disabled={executing === ruleset._id}
                            title="Execute"
                          >
                            <Play size={14} className={executing === ruleset._id ? 'spin' : ''} />
                          </button>
                          <button 
                            className="btn btn-sm btn-light rounded-pill px-2"
                            onClick={() => handleDuplicate(ruleset)}
                            title="Duplicate"
                          >
                            <Copy size={14} />
                          </button>
                          <button 
                            className="btn btn-sm btn-light rounded-pill px-2"
                            onClick={() => navigateToBuilder(ruleset._id)}
                            title="Edit"
                          >
                            <Sliders size={14} />
                          </button>
                          <button 
                            className="btn btn-sm btn-light rounded-pill px-2 text-danger"
                            onClick={() => handleDelete(ruleset)}
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <span className="text-muted small">
                          {formatDate(ruleset.lastRunAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && filteredRulesets.length > 0 && pagination.totalPages > 1 && (
          <div className="d-flex justify-content-center gap-2 mt-4">
            <button 
              className="btn btn-sm btn-light"
              disabled={pagination.page === 1}
              onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
            >
              Previous
            </button>
            <span className="btn btn-sm btn-light disabled">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button 
              className="btn btn-sm btn-light"
              disabled={pagination.page === pagination.totalPages}
              onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RuleSetsPage;