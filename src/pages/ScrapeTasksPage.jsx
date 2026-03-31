import React, { useState, useEffect, useRef } from 'react';
import KPICard from '../components/KPICard';
import ProgressBar from '../components/common/ProgressBar';
import { marketSyncApi } from '../services/api';
import { PageLoader } from '@/components/application/loading-indicator/PageLoader';
import { LoadingIndicator } from '@/components/application/loading-indicator/loading-indicator';
import { 
  Store, 
  RefreshCcw, 
  Package, 
  Percent, 
  Play, 
  CloudDownload, 
  Clock, 
  CheckCircle, 
  PauseCircle, 
  AlertTriangle, 
  Info,
  Rocket,
  Plus
} from 'lucide-react';

const ScrapeTasksPage = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState({}); // sellerId -> boolean
  const [bulkSyncing, setBulkSyncing] = useState(false);
  const pollingInterval = useRef(null);

  const loadSyncTasks = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    else setRefreshing(true);
    
    try {
      const response = await marketSyncApi.getSyncTasks();
      setTasks(response.tasks || []);
    } catch (error) {
      console.error('Failed to load sync tasks:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadSyncTasks();
    pollingInterval.current = setInterval(() => {
      loadSyncTasks(false);
    }, 30000);

    return () => {
      if (pollingInterval.current) clearInterval(pollingInterval.current);
    };
  }, []);

  const handleBulkInject = async () => {
    if (!window.confirm('This will re-inject all active ASIN URLs into their respective Octoparse tasks. Continue?')) {
      return;
    }

    setBulkSyncing(true);
    try {
      const res = await marketSyncApi.bulkInjectAsins();
      alert(res.message || 'Bulk injection started');
      loadSyncTasks(false);
    } catch (err) {
      console.error('Bulk injection failed:', err);
      alert('Failed: ' + err.message);
    } finally {
      setBulkSyncing(false);
    }
  };

  const handleStartSync = async (sellerId) => {
    setSyncing(prev => ({ ...prev, [sellerId]: true }));
    try {
      const response = await marketSyncApi.startTask(sellerId);
      setTimeout(() => loadSyncTasks(false), 2000);
      alert(response.message || 'Extraction process started successfully in Octoparse Cloud.');
    } catch (error) {
      console.error('Failed to start extraction:', error);
      alert('Failed: ' + error.message);
    } finally {
      setSyncing(prev => ({ ...prev, [sellerId]: false }));
    }
  };

  const handleFetchResults = async (sellerId) => {
    setSyncing(prev => ({ ...prev, [sellerId]: true }));
    try {
      const response = await marketSyncApi.syncResults(sellerId);
      loadSyncTasks(false);
      alert(response.message || 'Data successfully pulled and mapped to dashboard.');
    } catch (error) {
      console.error('Failed to sync results:', error);
      alert('Failed: ' + error.message);
    } finally {
      setSyncing(prev => ({ ...prev, [sellerId]: false }));
    }
  };

  const handleBulkDuplicate = async () => {
    if (!window.confirm('This will create dedicated Octoparse tasks for all selected sellers using your master template. Continue?')) {
      return;
    }

    setBulkSyncing(true);
    try {
      const res = await marketSyncApi.bulkUpdateTasks();
      alert(res.message || 'Bulk task duplication completed.');
      loadSyncTasks(true);
    } catch (err) {
      alert('Failed: ' + err.message);
    } finally {
      setBulkSyncing(false);
    }
  };

  const getStatusBadge = (status) => {
    const map = {
      'IDLE': { className: 'badge-idle', icon: Clock, label: 'Idle' },
      'RUNNING': { className: 'badge-running', icon: RefreshCcw, label: 'Running', spin: true },
      'COMPLETED': { className: 'badge-success', icon: CheckCircle, label: 'Completed' },
      'STOPPED': { className: 'badge-warning', icon: PauseCircle, label: 'Stopped' },
      'PAUSED': { className: 'badge-warning', icon: PauseCircle, label: 'Paused' },
      'FAILED': { className: 'badge-danger', icon: AlertTriangle, label: 'Failed' },
    };
    const { className, icon: Icon, label, spin } = map[status] || { className: 'badge-idle', icon: Clock, label: status };
    return (
      <span className={`sync-status-badge ${className}`}>
        <Icon size={14} className={`me-1 ${spin ? 'spin' : ''}`} />
        {label}
      </span>
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const kpis = [
    { title: 'Enabled Sellers', value: tasks.length.toString(), icon: 'Store', trend: 0, trendType: 'neutral' },
    { title: 'Active Syncs', value: tasks.filter(t => t.status === 'RUNNING').length.toString(), icon: 'RefreshCcw', trend: 0, trendType: 'neutral' },
    { title: 'Total ASINs', value: tasks.reduce((acc, t) => acc + (t.asinCount || 0), 0).toLocaleString(), icon: 'Package', trend: 0, trendType: 'neutral' },
    { title: 'Latest Progress', value: tasks.length > 0 ? (tasks.find(t => t.status === 'RUNNING')?.progress || 0) + '%' : '0%', icon: 'Percent', trend: 0, trendType: 'neutral' },
  ];

  if (loading) return <PageLoader message="Initializing Real-time Pipeline..." />;

  return (
    <div className="scrape-tasks-container container-fluid p-4">
      <style>{`
        .scrape-tasks-container {
          background: #f9fafb;
          min-height: 100vh;
        }
        .page-header-v2 {
          margin-bottom: 2rem;
        }
        .page-title {
          font-weight: 700;
          letter-spacing: -0.02em;
          color: #111827;
        }
        .sync-status-badge {
          padding: 0.35rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          letter-spacing: 0.01em;
          text-transform: uppercase;
        }
        .badge-idle { background: #f3f4f6; color: #4b5563; }
        .badge-running { 
          background: rgba(59, 130, 246, 0.1); 
          color: #2563eb;
          box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.1);
        }
        .badge-success { background: rgba(16, 185, 129, 0.1); color: #059669; }
        .badge-warning { background: rgba(245, 158, 11, 0.1); color: #d97706; }
        .badge-danger { background: rgba(239, 68, 68, 0.1); color: #dc2626; }
        
        .spin {
          animation: bi-spin 2s linear infinite;
        }
        @keyframes bi-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .data-table-v2 {
          background: #fff;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        .data-table-v2 thead th {
          background: #fafafa;
          padding: 0.875rem 1.25rem;
          font-size: 0.65rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #6b7280;
          border-bottom: 1px solid #e5e7eb;
        }
        .data-table-v2 tbody td {
          padding: 1rem 1.25rem;
          border-bottom: 1px solid #f3f4f6;
          vertical-align: middle;
        }
        .data-table-v2 tbody tr:last-child td {
          border-bottom: none;
        }
        .data-table-v2 tbody tr:hover {
          background-color: #f9fafb;
        }
        
        .btn-action-group .btn {
          border-radius: 8px;
          font-weight: 500;
          padding: 0.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .hint-card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-left: 4px solid #3b82f6;
          border-radius: 12px;
          padding: 1.25rem;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
        }
        
        .avatar-glow {
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.05);
        }

        .font-monospace {
          font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace !important;
        }
      `}</style>

      <div className="page-header-v2">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-4">
          <div>
            <h1 className="page-title d-flex align-items-center h2 mb-1">
              Data Pipeline Status
            </h1>
            <p className="text-muted small mb-0">Live monitoring of Amazon marketplace extraction tasks.</p>
          </div>
          <div className="d-flex gap-2">
            <button className="btn btn-white shadow-sm border px-3 d-flex align-items-center gap-2" onClick={() => loadSyncTasks(true)} disabled={refreshing}>
              {refreshing ? <span className="spinner-border spinner-border-sm"></span> : <RefreshCcw size={16} />}
              Refresh Status
            </button>
            <button 
                className="btn btn-outline-info shadow-sm px-3 d-flex align-items-center gap-2" 
                onClick={handleBulkDuplicate} 
                disabled={bulkSyncing || loading}
            >
                {bulkSyncing ? <span className="spinner-border spinner-border-sm"></span> : <Plus size={16} />}
                {bulkSyncing ? 'Creating Tasks...' : 'Assign & Duplicate Tasks'}
            </button>
            <button 
                className="btn btn-outline-primary shadow-sm px-3 d-flex align-items-center gap-2" 
                onClick={handleBulkInject} 
                disabled={bulkSyncing || loading}
            >
                {bulkSyncing ? <span className="spinner-border spinner-border-sm"></span> : <CloudDownload size={16} />}
                {bulkSyncing ? 'Syncing ASINs...' : 'Sync ASINs to Cloud'}
            </button>
            <button className="btn btn-primary shadow-sm px-4 d-flex align-items-center gap-2" onClick={() => marketSyncApi.ingestAllResults().then(() => alert('Global ingestion started'))}>
              <Rocket size={16} />
              Ingest All Data
            </button>
          </div>
        </div>
      </div>

      <div className="row g-4 mb-5">
        {kpis.map((kpi, idx) => (
          <div key={idx} className="col-md-3">
            <KPICard 
              title={kpi.title} 
              value={kpi.value} 
              icon={kpi.icon} 
              trend={kpi.trend} 
              trendType={kpi.trendType} 
            />
          </div>
        ))}
      </div>

      <div className="data-table-v2 mb-5">
        <div className="px-4 py-3 border-bottom d-flex align-items-center justify-content-between bg-white sticky-top shadow-sm-bottom">
          <h6 className="mb-0 text-dark fw-bold">Active Seller Tasks</h6>
          <div className="small text-muted">{tasks.length} Configured Tasks</div>
        </div>
        <div className="table-responsive">
          <table className="table data-table mb-0">
            <thead>
              <tr>
                <th style={{ width: '25%' }}>Seller Details</th>
                <th style={{ width: '20%' }}>Task ID</th>
                <th style={{ width: '15%' }}>Sync Stats</th>
                <th style={{ width: '15%' }}>Current Status</th>
                <th style={{ width: '15%' }}>Progress</th>
                <th className="text-end" style={{ width: '10%' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-5">
                    <div className="text-muted opacity-50">
                      <div className="mb-3"><RefreshCcw size={48} /></div>
                      No sellers found with active Octoparse sync tasks.
                    </div>
                  </td>
                </tr>
              ) : (
                tasks.map(task => (
                  <tr key={task.sellerId}>
                    <td>
                      <div className="d-flex align-items-center">
                        <div className="avatar-sm bg-primary text-white rounded-3 d-flex align-items-center justify-content-center me-3 avatar-glow" style={{ width: '38px', height: '38px', fontSize: '1rem', fontWeight: '700' }}>
                          {task.sellerName.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="fw-bold text-dark" style={{ fontSize: '0.9rem' }}>{task.sellerName}</div>
                          <div className="text-muted small" style={{ fontSize: '0.75rem' }}>{task.marketplace}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="d-flex flex-column">
                        <div className="font-monospace text-primary fw-medium" style={{ fontSize: '0.75rem', letterSpacing: '-0.01em' }}>{task.taskId}</div>
                        <div className="text-muted x-small mt-0.5">Octoparse Cloud Task</div>
                      </div>
                    </td>
                    <td>
                      <div className="d-flex flex-column">
                        <span className="fw-bold text-dark" style={{ fontSize: '0.85rem' }}>{task.asinCount} ASINs</span>
                        <span className="text-muted x-small" style={{ fontSize: '0.7rem' }}>Last sync: {formatDate(task.lastSync)}</span>
                      </div>
                    </td>
                    <td>{getStatusBadge(task.status)}</td>
                    <td>
                      <div style={{ width: '120px' }}>
                        <ProgressBar 
                          value={task.progress} 
                          color={task.status === 'RUNNING' ? 'primary' : 'success'} 
                          size="sm" 
                        />
                        <div className="progress-hint x-small text-muted mt-1 fw-medium">{task.progress || 0}% Completed</div>
                      </div>
                    </td>
                    <td className="text-end">
                      <div className="btn-action-group d-flex gap-2 justify-content-end">
                        <button 
                          className="btn btn-outline-primary" 
                          onClick={() => handleStartSync(task.sellerId)}
                          disabled={task.status === 'RUNNING' || syncing[task.sellerId]}
                          title="Trigger extraction"
                        >
                          {syncing[task.sellerId] ? <span className="spinner-border spinner-border-sm"></span> : <Play size={18} />}
                        </button>
                        <button 
                          className="btn btn-outline-success" 
                          onClick={() => handleFetchResults(task.sellerId)}
                          disabled={syncing[task.sellerId]}
                          title="Import data"
                        >
                          <CloudDownload size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="hint-card d-flex align-items-start gap-3">
        <div className="icon-box bg-primary-subtle p-2 rounded-3 text-primary">
          <Info size={20} />
        </div>
        <div>
          <h6 className="fw-bold text-dark mb-1">Pipeline Optimization Engaged</h6>
          <p className="text-muted small mb-0">
            The platform automatically handles high-scale concurrent tasks. You can manually force an update by clicking 
            <strong> Start Sync</strong> to re-inject ASINs into the Octoparse cloud loop.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ScrapeTasksPage;
