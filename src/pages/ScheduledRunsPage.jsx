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
    Search
} from 'lucide-react';
import { scheduledRunsApi } from '../services/api';

const ScheduledRunsPage = () => {
    const [runs, setRuns] = useState([]);
    const [selectedRun, setSelectedRun] = useState(null);
    const [loading, setLoading] = useState(true);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [triggering, setTriggering] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [message, setMessage] = useState(null);

    // Fetch all runs
    const fetchRuns = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await scheduledRunsApi.getAll();
            if (res.success) {
                setRuns(res.data || []);
            }
        } catch (err) {
            console.error('Failed to fetch scheduled runs:', err);
            setMessage({ type: 'danger', text: err.message || 'Failed to fetch scheduled runs' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRuns();
        
        // Auto-refresh every 10 seconds if any run is running
        const interval = setInterval(() => {
            const activeRun = runs.some(r => r.Status === 'RUNNING');
            if (activeRun) {
                fetchRuns(true);
                if (selectedRun && selectedRun.Status === 'RUNNING') {
                    handleViewDetails(selectedRun.Id, true);
                }
            }
        }, 10000);

        return () => clearInterval(interval);
    }, [runs, selectedRun]);

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
            setDetailsLoading(false);
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

    // Filter runs based on search
    const filteredRuns = runs.filter(run => {
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
            
            {/* Header section with rich aesthetics */}
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4 p-4 rounded-3 text-white shadow-sm" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
                <div>
                    <div className="d-flex align-items-center gap-2 mb-1">
                        <div className="bg-primary bg-opacity-20 p-2 rounded-2">
                            <Clock size={24} className="text-primary-light" style={{ color: '#60a5fa' }} />
                        </div>
                        <h2 className="h4 font-bold mb-0">Scheduled Telemetry & Summary Reports</h2>
                    </div>
                    <p className="text-zinc-400 mb-0" style={{ fontSize: '13px' }}>Monitor nightly Scheduled Runs at 00:00: starts, completions, seller durations, and manual pipeline controls.</p>
                </div>
                <div className="d-flex align-items-center gap-2">
                    <button 
                        className="btn btn-outline-light d-flex align-items-center gap-2 px-3"
                        onClick={() => fetchRuns()}
                        disabled={loading}
                        style={{ border: '1px solid rgba(255,255,255,0.15)', fontSize: '13px' }}
                    >
                        <RefreshCw size={15} className={loading ? 'spin' : ''} />
                        Refresh
                    </button>
                    <button 
                        className="btn d-flex align-items-center gap-2 px-3 py-2 text-white font-semibold shadow-sm"
                        onClick={handleManualTrigger}
                        disabled={triggering || runningRunsCount > 0}
                        style={{ background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)', border: 'none', fontSize: '13px' }}
                    >
                        {triggering ? <Loader2 size={15} className="spin" /> : <Play size={15} />}
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
                        fontSize: '13px'
                    }}
                >
                    {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                    <div className="flex-grow-1">{message.text}</div>
                    <button className="btn-close btn-close-white" onClick={() => setMessage(null)} />
                </div>
            )}

            {/* Premium analytics summary widgets */}
            <div className="row g-3 mb-4">
                <div className="col-12 col-sm-6 col-lg-3">
                    <div className="card border-0 shadow-sm p-3 rounded-3" style={{ background: '#ffffff' }}>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="text-zinc-500 font-semibold" style={{ fontSize: '12px' }}>Total Pipeline Runs</span>
                            <div className="bg-blue-50 p-2 rounded-2 text-blue-600" style={{ background: '#eff6ff', color: '#2563eb' }}>
                                <Calendar size={16} />
                            </div>
                        </div>
                        <h3 className="h4 font-bold mb-1 text-zinc-800">{totalRunsCount}</h3>
                        <p className="text-zinc-400 mb-0" style={{ fontSize: '11px' }}>Total enterprise system cycles</p>
                    </div>
                </div>
                <div className="col-12 col-sm-6 col-lg-3">
                    <div className="card border-0 shadow-sm p-3 rounded-3" style={{ background: '#ffffff' }}>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="text-zinc-500 font-semibold" style={{ fontSize: '12px' }}>Runs Running Now</span>
                            <div className="bg-amber-50 p-2 rounded-2 text-amber-600" style={{ background: '#fffbeb', color: '#d97706' }}>
                                <Loader2 size={16} className={runningRunsCount > 0 ? 'spin' : ''} />
                            </div>
                        </div>
                        <h3 className="h4 font-bold mb-1 text-zinc-800">{runningRunsCount}</h3>
                        <p className="text-zinc-400 mb-0" style={{ fontSize: '11px' }}>Active synchronous scrape operations</p>
                    </div>
                </div>
                <div className="col-12 col-sm-6 col-lg-3">
                    <div className="card border-0 shadow-sm p-3 rounded-3" style={{ background: '#ffffff' }}>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="text-zinc-500 font-semibold" style={{ fontSize: '12px' }}>Success Rate</span>
                            <div className="bg-emerald-50 p-2 rounded-2 text-emerald-600" style={{ background: '#ecfdf5', color: '#059669' }}>
                                <TrendingUp size={16} />
                            </div>
                        </div>
                        <h3 className="h4 font-bold mb-1 text-zinc-800">{successRate}%</h3>
                        <p className="text-zinc-400 mb-0" style={{ fontSize: '11px' }}>{completedRunsCount} of {totalRunsCount} completed successfully</p>
                    </div>
                </div>
                <div className="col-12 col-sm-6 col-lg-3">
                    <div className="card border-0 shadow-sm p-3 rounded-3" style={{ background: '#ffffff' }}>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="text-zinc-500 font-semibold" style={{ fontSize: '12px' }}>Failed Runs</span>
                            <div className="bg-rose-50 p-2 rounded-2 text-rose-600" style={{ background: '#fff1f2', color: '#e11d48' }}>
                                <XCircle size={16} />
                            </div>
                        </div>
                        <h3 className="h4 font-bold mb-1 text-zinc-800">{failedRunsCount}</h3>
                        <p className="text-zinc-400 mb-0" style={{ fontSize: '11px' }}>Pipeline disruptions logged</p>
                    </div>
                </div>
            </div>

            {/* Main Telemetry section split */}
            <div className="row g-4">
                
                {/* Left side: Runs list */}
                <div className="col-12 col-lg-5">
                    <div className="card border-0 shadow-sm rounded-3 overflow-hidden" style={{ background: '#ffffff' }}>
                        <div className="p-3 border-bottom d-flex align-items-center justify-content-between">
                            <span className="font-semibold text-zinc-800" style={{ fontSize: '14px' }}>Execution History Log</span>
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
                            <div className="p-5 d-flex flex-column align-items-center justify-content-center text-zinc-400">
                                <Loader2 size={32} className="spin text-primary mb-2" />
                                <span style={{ fontSize: '13px' }}>Loading historical runs...</span>
                            </div>
                        ) : filteredRuns.length === 0 ? (
                            <div className="p-5 text-center text-zinc-400 d-flex flex-column align-items-center gap-2">
                                <Clock size={32} />
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
                                            className={`list-group-item list-group-item-action border-0 p-3 d-flex align-items-center justify-content-between gap-3 text-start transition-all`}
                                            style={{ 
                                                borderLeft: isSelected ? '4px solid #3b82f6' : '4px solid transparent',
                                                background: isSelected ? '#f0fdf4' : 'transparent',
                                            }}
                                        >
                                            <div className="flex-grow-1">
                                                <div className="d-flex align-items-center gap-2 mb-1">
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
                                                <div className="text-zinc-500 d-flex flex-column gap-0.5" style={{ fontSize: '11px' }}>
                                                    <span>📅 Start: {formatDate(run.StartTime)}</span>
                                                    <span>⏱️ Duration: {formatDuration(run.StartTime, run.EndTime)}</span>
                                                </div>
                                            </div>
                                            <div className="text-zinc-400">
                                                {isSelected ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
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
                            <div className="p-5 d-flex flex-column align-items-center justify-content-center text-zinc-400" style={{ minHeight: '300px' }}>
                                <Loader2 size={36} className="spin text-blue-500 mb-2" />
                                <span style={{ fontSize: '13px' }}>Retrieving detailed seller statistics...</span>
                            </div>
                        ) : !selectedRun ? (
                            <div className="p-5 text-center text-zinc-400 d-flex flex-column align-items-center justify-content-center gap-2" style={{ minHeight: '300px' }}>
                                <FileText size={40} className="text-zinc-300" />
                                <span style={{ fontSize: '13px' }}>Click on a historical run from the left panel to review seller-by-seller ingested counts.</span>
                            </div>
                        ) : (
                            <div className="p-4">
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

                                <h4 className="h6 font-bold text-zinc-700 mb-3">Seller Ingest Stats</h4>
                                {(!selectedRun.Details || selectedRun.Details.length === 0) ? (
                                    <p className="text-zinc-400 text-center py-4" style={{ fontSize: '12px' }}>No individual seller details recorded for this run.</p>
                                ) : (
                                    <div className="table-responsive border border-zinc-100 rounded-3">
                                        <table className="table align-middle mb-0" style={{ fontSize: '12px' }}>
                                            <thead style={{ background: '#f1f5f9', color: '#475569' }}>
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
                                                    return (
                                                        <React.Fragment key={index}>
                                                            <tr className="border-bottom">
                                                                <td className="py-3 ps-3 font-semibold text-zinc-700">
                                                                    {seller.name}
                                                                </td>
                                                                <td className="py-3">
                                                                    <span className="badge bg-zinc-100 text-zinc-700 font-bold px-2 py-1">{seller.asinsCount || 0}</span>
                                                                </td>
                                                                <td className="py-3 font-bold text-emerald-600">
                                                                    {seller.count || 0}
                                                                </td>
                                                                <td className="py-3 text-zinc-500" style={{ fontSize: '11px' }}>
                                                                    <div>⏱️ {sDuration}</div>
                                                                    {seller.startTime && <div className="text-zinc-400 text-xxs mt-0.5">{new Date(seller.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>}
                                                                </td>
                                                                <td className="py-3">
                                                                    {seller.status === 'RUNNING' && (
                                                                        <span className="badge d-flex align-items-center gap-1 text-warning bg-warning-subtle" style={{ width: 'fit-content', padding: '3px 8px' }}>
                                                                            <Loader2 size={10} className="spin" /> RUNNING
                                                                        </span>
                                                                    )}
                                                                    {seller.status === 'COMPLETED' && (
                                                                        <span className="badge d-flex align-items-center gap-1 text-success bg-success-subtle" style={{ width: 'fit-content', padding: '3px 8px' }}>
                                                                            <CheckCircle2 size={10} /> COMPLETED
                                                                        </span>
                                                                    )}
                                                                    {seller.status === 'FAILED' && (
                                                                        <span className="badge d-flex align-items-center gap-1 text-danger bg-danger-subtle" style={{ width: 'fit-content', padding: '3px 8px' }}>
                                                                            <XCircle size={10} /> FAILED
                                                                        </span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                            {seller.error && (
                                                                <tr style={{ background: '#fef2f2' }}>
                                                                    <td colSpan="5" className="py-2 px-3 text-danger" style={{ fontSize: '11px', borderBottom: '1px solid #fee2e2' }}>
                                                                        <strong>⚠️ Error:</strong> {seller.error}
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
