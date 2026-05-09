import React, { useState, useEffect } from 'react';
import { 
    Clock, 
    Play, 
    RefreshCw, 
    CheckCircle2, 
    XCircle, 
    Loader2, 
    Calendar, 
    Database, 
    ChevronDown, 
    ChevronUp, 
    FileText, 
    AlertCircle, 
    TrendingUp, 
    Zap,
    Search,
    Pause,
    PlayCircle
} from 'lucide-react';
import { scheduledRunsApi, settingsApi } from '../services/api';

// Premium Shimmering Loader Components
const RunListSkeleton = () => (
    <div className="p-3 d-flex flex-column gap-3">
        {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="border-0 p-3 rounded-3 bg-white shadow-sm d-flex align-items-center justify-content-between gap-3" style={{ animation: 'fadeIn 0.25s ease-out' }}>
                <div className="flex-grow-1">
                    <div className="skeleton-shimmer mb-2 rounded" style={{ height: '16px', width: '120px' }} />
                    <div className="skeleton-shimmer mb-1.5 rounded" style={{ height: '12px', width: '180px' }} />
                    <div className="skeleton-shimmer rounded" style={{ height: '12px', width: '140px' }} />
                </div>
                <div className="skeleton-shimmer rounded-circle" style={{ height: '16px', width: '16px' }} />
            </div>
        ))}
    </div>
);

const SellerTableSkeleton = () => (
    <div className="p-4 d-flex flex-column gap-3" style={{ animation: 'fadeIn 0.25s ease-out' }}>
        <div className="skeleton-shimmer rounded mb-3" style={{ height: '40px', width: '100%' }} />
        {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="d-flex gap-3 align-items-center justify-content-between border-bottom pb-3">
                <div className="skeleton-shimmer rounded" style={{ height: '14px', width: '150px' }} />
                <div className="skeleton-shimmer rounded" style={{ height: '20px', width: '60px' }} />
                <div className="skeleton-shimmer rounded" style={{ height: '14px', width: '80px' }} />
                <div className="skeleton-shimmer rounded" style={{ height: '14px', width: '100px' }} />
                <div className="skeleton-shimmer rounded" style={{ height: '22px', width: '90px' }} />
            </div>
        ))}
    </div>
);

const ScheduledRunsPage = () => {
    const [runs, setRuns] = useState([]);
    const [selectedRun, setSelectedRun] = useState(null);
    const [loading, setLoading] = useState(true);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [triggering, setTriggering] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [message, setMessage] = useState(null);
    const [scheduleConfig, setScheduleConfig] = useState({ scheduleTime: '11:20', ajioScheduleTime: '12:00', automationEnabled: false });

    // Premium UI states
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [secondsToRefresh, setSecondsToRefresh] = useState(15);
    const [isAutoSyncPaused, setIsAutoSyncPaused] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(new Date().toLocaleTimeString());

    // Fetch all runs
    const fetchRuns = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await scheduledRunsApi.getAll();
            if (res.success) {
                const fetchedRuns = res.data || [];
                setRuns(fetchedRuns);
                setLastUpdated(new Date().toLocaleTimeString());
                
                // Auto-select latest run on load to make details immediately useful
                if (fetchedRuns.length > 0 && !selectedRun) {
                    handleViewDetails(fetchedRuns[0].Id, silent);
                } else if (selectedRun) {
                    // Silent refresh details for selected run if it's currently running or silent is active
                    const updatedRun = fetchedRuns.find(r => r.Id === selectedRun.Id);
                    if (updatedRun && (updatedRun.Status === 'RUNNING' || silent)) {
                        handleViewDetails(selectedRun.Id, true);
                    }
                }
            }
        } catch (err) {
            console.error('Failed to fetch scheduled runs:', err);
            setMessage({ type: 'danger', text: err.message || 'Failed to fetch scheduled runs' });
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        fetchRuns();
        // Fetch schedule config from env via backend
        settingsApi.getScheduleConfig()
            .then(res => { if (res.success) setScheduleConfig(res.data); })
            .catch(() => {}); // silently fail, fallback stays '00:00'
    }, []);

    // Countdown and dynamic auto-refresh engine
    useEffect(() => {
        const hasActiveRun = runs.some(r => r.Status === 'RUNNING');
        const defaultInterval = hasActiveRun ? 5 : 15;

        // If the interval type changed, align the timer immediately
        if (secondsToRefresh > defaultInterval) {
            setSecondsToRefresh(defaultInterval);
        }

        const timer = setInterval(() => {
            if (isAutoSyncPaused) return;

            setSecondsToRefresh(prev => {
                if (prev <= 1) {
                    fetchRuns(true);
                    return defaultInterval;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [runs, isAutoSyncPaused, selectedRun]);

    // Fetch details for a specific run
    const handleViewDetails = async (id, silent = false) => {
        if (!silent) setDetailsLoading(true);
        try {
            const res = await scheduledRunsApi.getDetails(id);
            if (res.success) {
                setSelectedRun(res.data);
            }
        } catch (err) {
            console.error('Failed to fetch run details:', err);
            setMessage({ type: 'danger', text: err.message || 'Failed to fetch run details' });
        } finally {
            if (!silent) setDetailsLoading(false);
        }
    };

    // Trigger a manual run
    const handleManualTrigger = async () => {
        if (!window.confirm('Are you sure you want to stop all active tasks, clear exported data, and trigger the enterprise pipeline? This will process exactly 5 active sellers concurrently.')) {
            return;
        }

        setTriggering(true);
        setMessage(null);
        try {
            const res = await scheduledRunsApi.trigger();
            if (res.success) {
                setMessage({ 
                    type: 'success', 
                    text: res.message || 'Nightly pipeline manually triggered successfully in the background.' 
                });
                setTimeout(() => fetchRuns(), 1500);
            }
        } catch (err) {
            console.error('Failed to trigger run:', err);
            setMessage({ type: 'danger', text: err.message || 'Failed to trigger enterprise pipeline' });
        } finally {
            setTriggering(false);
        }
    };

    // Calculate overall stats
    const totalRunsCount = runs.length;
    const completedRunsCount = runs.filter(r => r.Status === 'COMPLETED').length;
    const runningRunsCount = runs.filter(r => r.Status === 'RUNNING').length;
    const failedRunsCount = runs.filter(r => r.Status === 'FAILED').length;
    const successRate = totalRunsCount > 0 ? Math.round((completedRunsCount / totalRunsCount) * 100) : 100;

    // Helper: format duration (in ms or seconds)
    const formatDuration = (start, end) => {
        if (!start) return '-';
        const startTime = new Date(start).getTime();
        const endTime = end ? new Date(end).getTime() : Date.now();
        const diffMs = endTime - startTime;
        
        const secs = Math.floor(diffMs / 1000);
        if (secs < 60) return `${secs}s`;
        const mins = Math.floor(secs / 60);
        const remSecs = secs % 60;
        return `${mins}m ${remSecs}s`;
    };

    // Format date beautifully
    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    // Filter runs based on search and selected metric-card status
    const filteredRuns = runs.filter(run => {
        const matchesStatus = statusFilter === 'ALL' || run.Status === statusFilter;
        if (!matchesStatus) return false;
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
            run.Id.toLowerCase().includes(term) ||
            run.Status.toLowerCase().includes(term) ||
            (run.StartTime && formatDate(run.StartTime).toLowerCase().includes(term))
        );
    });

    return (
        <div className="container-fluid py-4" style={{ background: '#f8fafc', minHeight: '100vh', animation: 'fadeIn 0.25s ease-out' }}>
            
            {/* Embedded styles for modern visual excellence */}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(12px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes shimmer {
                    0% { background-position: -200px 0; }
                    100% { background-position: 200px 0; }
                }
                @keyframes pulse-green {
                    0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
                    50% { opacity: 0.6; transform: scale(1.15); box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
                }
                .skeleton-shimmer {
                    background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
                    background-size: 200% 100%;
                    animation: shimmer 1.5s infinite linear;
                }
                .metric-card {
                    cursor: pointer;
                    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                    border: 2px solid transparent !important;
                    user-select: none;
                }
                .metric-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 12px 20px -8px rgba(15, 23, 42, 0.12) !important;
                }
                .metric-card.active-filter-ALL {
                    border-color: #3b82f6 !important;
                    background: linear-gradient(145deg, #ffffff 0%, #eff6ff 100%) !important;
                }
                .metric-card.active-filter-RUNNING {
                    border-color: #f59e0b !important;
                    background: linear-gradient(145deg, #ffffff 0%, #fffbeb 100%) !important;
                }
                .metric-card.active-filter-COMPLETED {
                    border-color: #10b981 !important;
                    background: linear-gradient(145deg, #ffffff 0%, #ecfdf5 100%) !important;
                }
                .metric-card.active-filter-FAILED {
                    border-color: #ef4444 !important;
                    background: linear-gradient(145deg, #ffffff 0%, #fff1f2 100%) !important;
                }
                .list-item-hover {
                    transition: all 0.2s ease-in-out;
                }
                .list-item-hover:hover {
                    background-color: #f8fafc !important;
                }
                .progress-bar-animated {
                    background-size: 40px 40px;
                    background-image: linear-gradient(
                        45deg,
                        rgba(255, 255, 255, 0.15) 25%,
                        transparent 25%,
                        transparent 50%,
                        rgba(255, 255, 255, 0.15) 50%,
                        rgba(255, 255, 255, 0.15) 75%,
                        transparent 75%,
                        transparent
                    );
                    animation: progress-bar-stripes 1.2s linear infinite;
                }
                @keyframes progress-bar-stripes {
                    from { background-position: 40px 0; }
                    to { background-position: 0 0; }
                }
                .spin-slow {
                    animation: spin 3s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
            
            {/* Header section with rich aesthetics */}
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4 p-4 rounded-3 text-white shadow-sm" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div>
                    <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
                        <div className="bg-primary bg-opacity-20 p-2 rounded-2">
                            <Clock size={24} className="text-primary-light" style={{ color: '#60a5fa' }} />
                        </div>
                        <h2 className="h4 font-bold mb-0">Scheduled Telemetry & Summary Reports</h2>
                        
                        {/* Live auto-refresh engine status badge */}
                        <div className="d-flex align-items-center gap-2 px-3 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 ms-md-3" style={{ fontSize: '11px', fontWeight: '500' }}>
                            <span 
                                className="d-inline-block rounded-circle" 
                                style={{ 
                                    width: '8px', 
                                    height: '8px', 
                                    backgroundColor: isAutoSyncPaused ? '#f59e0b' : '#10b981', 
                                    animation: isAutoSyncPaused ? 'none' : 'pulse-green 1.8s infinite ease-in-out' 
                                }} 
                            />
                            <span>{isAutoSyncPaused ? 'Auto-Sync Paused' : `Syncing in ${secondsToRefresh}s`}</span>
                        </div>
                    </div>
                    <p className="text-zinc-400 mb-0" style={{ fontSize: '13px' }}>
                        Monitor nightly Scheduled Runs (Amazon at <strong className="text-blue-300">{scheduleConfig.scheduleTime || '11:20'}</strong>, Ajio at <strong className="text-emerald-400">{scheduleConfig.ajioScheduleTime || '12:00'}</strong>): starts, completions, seller durations, and manual pipeline controls.
                    </p>
                </div>
                <div className="d-flex align-items-center gap-2.5 flex-wrap">
                    {/* Live Sync Pause/Resume Controller */}
                    <button 
                        className="btn btn-sm d-flex align-items-center gap-1.5 px-3 py-2 text-white border-0 transition-all"
                        onClick={() => setIsAutoSyncPaused(!isAutoSyncPaused)}
                        style={{ background: isAutoSyncPaused ? 'linear-gradient(90deg, #d97706 0%, #b45309 100%)' : '#334155', fontSize: '12px', borderRadius: '6px', fontWeight: '500' }}
                    >
                        {isAutoSyncPaused ? <PlayCircle size={14} /> : <Pause size={14} />}
                        {isAutoSyncPaused ? 'Resume Auto-Sync' : 'Pause Auto-Sync'}
                    </button>
                    <button 
                        className="btn btn-outline-light d-flex align-items-center gap-2 px-3 py-2 transition-all"
                        onClick={() => fetchRuns()}
                        disabled={loading}
                        style={{ border: '1px solid rgba(255,255,255,0.15)', fontSize: '12px', fontWeight: '500' }}
                    >
                        <RefreshCw size={14} className={loading ? 'spin' : ''} />
                        Refresh
                    </button>
                    <button 
                        className="btn d-flex align-items-center gap-2 px-3 py-2 text-white font-semibold shadow-sm transition-all"
                        onClick={handleManualTrigger}
                        disabled={triggering || runningRunsCount > 0}
                        style={{ background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)', border: 'none', fontSize: '12px' }}
                    >
                        {triggering ? <Loader2 size={14} className="spin" /> : <Play size={14} />}
                        Trigger Nightly Pipeline
                    </button>
                </div>
            </div>

            {/* Notification messages with premium styles */}
            {message && (
                <div 
                    className="alert d-flex align-items-center gap-3 border-0 rounded-3 shadow-sm text-white p-3 mb-4" 
                    style={{ 
                        background: message.type === 'success' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                        fontSize: '13px',
                        animation: 'fadeIn 0.25s ease-out'
                    }}
                >
                    {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                    <div className="flex-grow-1">{message.text}</div>
                    <button className="btn-close btn-close-white" onClick={() => setMessage(null)} />
                </div>
            )}

            {/* Premium interactive analytics summary widgets */}
            <div className="row g-3 mb-4">
                <div className="col-12 col-sm-6 col-lg-3">
                    <div 
                        onClick={() => setStatusFilter('ALL')}
                        className={`card shadow-sm p-3 rounded-3 metric-card ${statusFilter === 'ALL' ? 'active-filter-ALL' : ''}`} 
                        style={{ background: '#ffffff' }}
                    >
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="text-zinc-500 font-semibold" style={{ fontSize: '12px' }}>Total Pipeline Runs</span>
                            <div className="bg-blue-50 p-2 rounded-2 text-blue-600" style={{ background: '#eff6ff', color: '#2563eb' }}>
                                <Calendar size={16} />
                            </div>
                        </div>
                        <h3 className="h4 font-bold mb-1 text-zinc-800">{totalRunsCount}</h3>
                        <p className="text-zinc-400 mb-0" style={{ fontSize: '11px' }}>Click to view all historical runs</p>
                    </div>
                </div>
                <div className="col-12 col-sm-6 col-lg-3">
                    <div 
                        onClick={() => setStatusFilter('RUNNING')}
                        className={`card shadow-sm p-3 rounded-3 metric-card ${statusFilter === 'RUNNING' ? 'active-filter-RUNNING' : ''}`} 
                        style={{ background: '#ffffff' }}
                    >
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="text-zinc-500 font-semibold" style={{ fontSize: '12px' }}>Runs Running Now</span>
                            <div className="bg-amber-50 p-2 rounded-2 text-amber-600" style={{ background: '#fffbeb', color: '#d97706' }}>
                                <Loader2 size={16} className={runningRunsCount > 0 ? 'spin' : ''} />
                            </div>
                        </div>
                        <h3 className="h4 font-bold mb-1 text-zinc-800">{runningRunsCount}</h3>
                        <p className="text-zinc-400 mb-0" style={{ fontSize: '11px' }}>Click to filter active runs only</p>
                    </div>
                </div>
                <div className="col-12 col-sm-6 col-lg-3">
                    <div 
                        onClick={() => setStatusFilter('COMPLETED')}
                        className={`card shadow-sm p-3 rounded-3 metric-card ${statusFilter === 'COMPLETED' ? 'active-filter-COMPLETED' : ''}`} 
                        style={{ background: '#ffffff' }}
                    >
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="text-zinc-500 font-semibold" style={{ fontSize: '12px' }}>Success Rate</span>
                            <div className="bg-emerald-50 p-2 rounded-2 text-emerald-600" style={{ background: '#ecfdf5', color: '#059669' }}>
                                <TrendingUp size={16} />
                            </div>
                        </div>
                        <h3 className="h4 font-bold mb-1 text-zinc-800">{successRate}%</h3>
                        <p className="text-zinc-400 mb-0" style={{ fontSize: '11px' }}>Click to filter completed cycles</p>
                    </div>
                </div>
                <div className="col-12 col-sm-6 col-lg-3">
                    <div 
                        onClick={() => setStatusFilter('FAILED')}
                        className={`card shadow-sm p-3 rounded-3 metric-card ${statusFilter === 'FAILED' ? 'active-filter-FAILED' : ''}`} 
                        style={{ background: '#ffffff' }}
                    >
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="text-zinc-500 font-semibold" style={{ fontSize: '12px' }}>Failed Runs</span>
                            <div className="bg-rose-50 p-2 rounded-2 text-rose-600" style={{ background: '#fff1f2', color: '#e11d48' }}>
                                <XCircle size={16} />
                            </div>
                        </div>
                        <h3 className="h4 font-bold mb-1 text-zinc-800">{failedRunsCount}</h3>
                        <p className="text-zinc-400 mb-0" style={{ fontSize: '11px' }}>Click to filter failed cycles</p>
                    </div>
                </div>
            </div>

            {/* Main Telemetry section split */}
            <div className="row g-4">
                
                {/* Left side: Runs list */}
                <div className="col-12 col-lg-5">
                    <div className="card border-0 shadow-sm rounded-3 overflow-hidden" style={{ background: '#ffffff' }}>
                        <div className="p-3 border-bottom d-flex align-items-center justify-content-between flex-wrap gap-2">
                            <div className="d-flex align-items-center gap-2">
                                <span className="font-semibold text-zinc-800" style={{ fontSize: '14px' }}>Execution History Log</span>
                                {statusFilter !== 'ALL' && (
                                    <span 
                                        onClick={() => setStatusFilter('ALL')}
                                        className={`badge cursor-pointer rounded-pill d-flex align-items-center gap-1 ${
                                            statusFilter === 'RUNNING' ? 'text-warning bg-warning-subtle border border-warning-subtle' :
                                            statusFilter === 'COMPLETED' ? 'text-success bg-success-subtle border border-success-subtle' :
                                            'text-danger bg-danger-subtle border border-danger-subtle'
                                        }`}
                                        style={{ fontSize: '11px', padding: '4px 9px', transition: 'all 0.2s' }}
                                    >
                                        {statusFilter} &times;
                                    </span>
                                )}
                            </div>
                            <div className="position-relative" style={{ width: '180px' }}>
                                <Search size={14} className="position-absolute text-zinc-400" style={{ top: '50%', left: '10px', transform: 'translateY(-50%)' }} />
                                <input 
                                    type="text" 
                                    className="form-control form-control-sm ps-4 border-zinc-200"
                                    placeholder="Search history..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    style={{ fontSize: '12px', borderRadius: '6px' }}
                                />
                            </div>
                        </div>

                        {loading ? (
                            <RunListSkeleton />
                        ) : filteredRuns.length === 0 ? (
                            <div className="p-5 text-center text-zinc-400 d-flex flex-column align-items-center justify-content-center gap-2 animate-fadeIn">
                                <Clock size={32} className="text-zinc-300" />
                                <span style={{ fontSize: '13px' }}>No runs matching the criteria were found.</span>
                            </div>
                        ) : (
                            <div className="list-group list-group-flush" style={{ maxHeight: '550px', overflowY: 'auto' }}>
                                {filteredRuns.map((run) => {
                                    const isSelected = selectedRun && selectedRun.Id === run.Id;
                                    return (
                                        <button 
                                            key={run.Id}
                                            onClick={() => handleViewDetails(run.Id)}
                                            className="list-group-item list-group-item-action border-0 p-3 d-flex align-items-center justify-content-between gap-3 text-start list-item-hover"
                                            style={{ 
                                                borderLeft: isSelected ? '4px solid #3b82f6' : '4px solid transparent',
                                                background: isSelected ? '#f0fdf4' : 'transparent',
                                                transition: 'all 0.2s ease'
                                            }}
                                        >
                                            <div className="flex-grow-1">
                                                <div className="d-flex align-items-center gap-2 mb-1.5">
                                                    <span className="fw-bold text-zinc-700" style={{ fontSize: '13px' }}>
                                                        Run #{run.Id.substring(0, 8)}
                                                    </span>
                                                    {run.Status === 'RUNNING' && (
                                                        <span className="badge rounded-pill d-flex align-items-center gap-1 text-warning bg-warning-subtle" style={{ fontSize: '10px', padding: '3px 8px' }}>
                                                            <Loader2 size={10} className="spin" /> RUNNING
                                                        </span>
                                                    )}
                                                    {run.Status === 'COMPLETED' && (
                                                        <span className="badge rounded-pill d-flex align-items-center gap-1 text-success bg-success-subtle" style={{ fontSize: '10px', padding: '3px 8px' }}>
                                                            <CheckCircle2 size={10} /> COMPLETED
                                                        </span>
                                                    )}
                                                    {run.Status === 'FAILED' && (
                                                        <span className="badge rounded-pill d-flex align-items-center gap-1 text-danger bg-danger-subtle" style={{ fontSize: '10px', padding: '3px 8px' }}>
                                                            <XCircle size={10} /> FAILED
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-zinc-500 d-flex flex-column gap-1" style={{ fontSize: '11px' }}>
                                                    <span>📅 Start: {formatDate(run.StartTime)}</span>
                                                    <span>⏱️ Duration: {formatDuration(run.StartTime, run.EndTime)}</span>
                                                </div>
                                            </div>
                                            <div className="text-zinc-400">
                                                {isSelected ? <ChevronUp size={16} className="text-blue-500" /> : <ChevronDown size={16} />}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        <div className="p-3 border-top bg-light d-flex justify-content-between align-items-center">
                            <span className="text-zinc-500 font-medium" style={{ fontSize: '11px' }}>
                                Last Updated: {lastUpdated}
                            </span>
                            <span className="text-zinc-400 text-xxs" style={{ fontSize: '10px' }}>
                                Total Filtered: {filteredRuns.length}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Right side: Detailed telemetry breakdown */}
                <div className="col-12 col-lg-7">
                    <div className="card border-0 shadow-sm rounded-3 overflow-hidden" style={{ background: '#ffffff', minHeight: '400px' }}>
                        <div className="p-3 border-bottom d-flex align-items-center justify-content-between text-zinc-800" style={{ background: '#f8fafc' }}>
                            <span className="font-semibold" style={{ fontSize: '14px' }}>Seller Sync Breakdown metrics</span>
                            <span className="badge bg-zinc-200 text-zinc-700" style={{ fontSize: '11px' }}>
                                {selectedRun ? `ID: ${selectedRun.Id}` : 'Select a run'}
                            </span>
                        </div>

                        {detailsLoading ? (
                            <SellerTableSkeleton />
                        ) : !selectedRun ? (
                            <div className="p-5 text-center text-zinc-400 d-flex flex-column align-items-center justify-content-center gap-2 animate-fadeIn" style={{ minHeight: '350px' }}>
                                <FileText size={40} className="text-zinc-300" />
                                <span style={{ fontSize: '13px' }}>Click on a historical run from the left panel to review seller-by-seller ingested counts.</span>
                            </div>
                        ) : (
                            <div className="p-4 animate-fadeIn">
                                <div className="p-3 mb-4 rounded-3 text-white shadow-sm d-flex justify-content-between align-items-center flex-wrap gap-2" style={{ background: selectedRun.Status === 'RUNNING' ? 'linear-gradient(90deg, #d97706 0%, #b45309 100%)' : selectedRun.Status === 'COMPLETED' ? 'linear-gradient(90deg, #059669 0%, #047857 100%)' : 'linear-gradient(90deg, #dc2626 0%, #b91c1c 100%)' }}>
                                    <div className="d-flex align-items-center gap-2">
                                        {selectedRun.Status === 'RUNNING' && <Loader2 size={16} className="spin" />}
                                        {selectedRun.Status === 'COMPLETED' && <CheckCircle2 size={16} />}
                                        {selectedRun.Status === 'FAILED' && <XCircle size={16} />}
                                        <span className="fw-semibold" style={{ fontSize: '13px' }}>Pipeline Status: {selectedRun.Status}</span>
                                    </div>
                                    <div className="text-white-50" style={{ fontSize: '11px' }}>
                                        Duration: {formatDuration(selectedRun.StartTime, selectedRun.EndTime)}
                                    </div>
                                </div>

                                <h4 className="h6 font-bold text-zinc-700 mb-3 d-flex align-items-center gap-2">
                                    <Database size={15} className="text-zinc-500" />
                                    Seller Ingest Stats
                                </h4>
                                {(!selectedRun.Details || selectedRun.Details.length === 0) ? (
                                    <p className="text-zinc-400 text-center py-4" style={{ fontSize: '12px' }}>No individual seller details recorded for this run.</p>
                                ) : (
                                    <div className="table-responsive border border-zinc-100 rounded-3 shadow-xs">
                                        <table className="table align-middle mb-0" style={{ fontSize: '12px' }}>
                                            <thead style={{ background: '#f1f5f9', color: '#475569', fontWeight: '600' }}>
                                                <tr>
                                                    <th className="py-2.5 ps-3">Seller Name</th>
                                                    <th className="py-2.5">Injected ASINs</th>
                                                    <th className="py-2.5">Ingested Records</th>
                                                    <th className="py-2.5">Time Log</th>
                                                    <th className="py-2.5">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedRun.Details.map((seller, index) => {
                                                    const sDuration = formatDuration(seller.startTime, seller.endTime);
                                                    const progressPercent = seller.asinsCount > 0 ? Math.min(Math.round((seller.count / seller.asinsCount) * 100), 100) : 0;
                                                    const isRunning = seller.status === 'RUNNING';
                                                    
                                                    return (
                                                        <React.Fragment key={index}>
                                                            <tr className="border-bottom" style={{ transition: 'background-color 0.2s' }}>
                                                                <td className="py-3 ps-3 font-semibold text-zinc-700">
                                                                    {seller.name}
                                                                </td>
                                                                <td className="py-3">
                                                                    <span className="badge bg-zinc-100 text-zinc-700 font-bold px-2.5 py-1.5" style={{ borderRadius: '6px' }}>{seller.asinsCount || 0}</span>
                                                                </td>
                                                                <td className="py-3 font-bold">
                                                                    <div className="d-flex flex-column gap-1.5" style={{ minWidth: '120px' }}>
                                                                        <span className={seller.count > 0 ? 'text-emerald-600' : 'text-zinc-500'}>
                                                                            {seller.count || 0}
                                                                        </span>
                                                                        {seller.asinsCount > 0 && (
                                                                            <div className="progress rounded-pill bg-zinc-100" style={{ height: '6px', width: '120px', overflow: 'hidden' }}>
                                                                                <div 
                                                                                    className={`progress-bar rounded-pill ${isRunning ? 'bg-amber-500 progress-bar-animated' : 'bg-emerald-500'}`} 
                                                                                    role="progressbar" 
                                                                                    style={{ width: `${progressPercent}%`, transition: 'width 0.4s ease' }} 
                                                                                />
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="py-3 text-zinc-500" style={{ fontSize: '11px' }}>
                                                                    <div className="d-flex align-items-center gap-1 mb-0.5">⏱️ <span>{sDuration}</span></div>
                                                                    {seller.startTime && <div className="text-zinc-400 text-xxs mt-0.5" style={{ fontSize: '10px' }}>{new Date(seller.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>}
                                                                </td>
                                                                <td className="py-3">
                                                                    {seller.status === 'RUNNING' && (
                                                                        <span className="badge d-flex align-items-center gap-1 text-warning bg-warning-subtle" style={{ width: 'fit-content', padding: '4px 9px', borderRadius: '20px' }}>
                                                                            <Loader2 size={10} className="spin" /> RUNNING
                                                                        </span>
                                                                    )}
                                                                    {seller.status === 'COMPLETED' && (
                                                                        <span className="badge d-flex align-items-center gap-1 text-success bg-success-subtle" style={{ width: 'fit-content', padding: '4px 9px', borderRadius: '20px' }}>
                                                                            <CheckCircle2 size={10} /> COMPLETED
                                                                        </span>
                                                                    )}
                                                                    {seller.status === 'FAILED' && (
                                                                        <span className="badge d-flex align-items-center gap-1 text-danger bg-danger-subtle" style={{ width: 'fit-content', padding: '4px 9px', borderRadius: '20px' }}>
                                                                            <XCircle size={10} /> FAILED
                                                                        </span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                            {seller.error && (
                                                                <tr style={{ background: '#fef2f2' }}>
                                                                    <td colSpan="5" className="py-2.5 px-3 text-danger" style={{ fontSize: '11px', borderBottom: '1px solid #fee2e2' }}>
                                                                        <div className="d-flex align-items-center gap-1.5 font-medium">
                                                                            <AlertCircle size={13} />
                                                                            <span><strong>Error:</strong> {seller.error}</span>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

            </div>

        </div>
    );
};

export default ScheduledRunsPage;
