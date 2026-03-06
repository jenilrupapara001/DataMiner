import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../services/db';
import {
    BarChart2,
    CheckCircle,
    Clock,
    AlertTriangle,
    ArrowLeft,
    Download,
    Calendar,
    User,
    TrendingUp,
    Target
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const GoalAchievementReport = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [timeframe, setTimeframe] = useState('30'); // Default to 30 days
    const navigate = useNavigate();

    const fetchReport = useCallback(async () => {
        try {
            setLoading(true);
            const response = await db.getGoalAchievementReport(timeframe);
            if (response && response.success) {
                setData(response.data);
            }
        } catch (error) {
            console.error("Failed to fetch achievement report:", error);
        } finally {
            setLoading(false);
        }
    }, [timeframe]);

    useEffect(() => {
        fetchReport();
    }, [fetchReport]);

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
                <div className="text-center">
                    <div className="spinner-border text-primary mb-3" role="status"></div>
                    <div className="text-muted small fw-medium">Analyzing Performance...</div>
                </div>
            </div>
        );
    }

    const { metrics = [], summary = {} } = data || {};

    return (
        <div className="p-4 bg-light min-vh-100">
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <button
                        onClick={() => navigate('/actions')}
                        className="btn btn-link p-0 text-muted mb-2 d-flex align-items-center gap-1 text-decoration-none small"
                    >
                        <ArrowLeft size={14} /> Back to Actions
                    </button>
                    <h1 className="h3 fw-bold mb-0">Goal vs Achievement Analysis</h1>
                    <p className="text-muted small">Task performance and timing metrics overview</p>
                </div>
                <button className="btn btn-outline-primary btn-sm d-flex align-items-center gap-2">
                    <Download size={16} /> Export Report
                </button>
            </div>

            {/* Stats Overview */}
            <div className="row g-3 mb-4">
                <div className="col-md-3">
                    <div className="card border-0 shadow-sm h-100 overflow-hidden">
                        <div className="card-body p-3">
                            <div className="d-flex justify-content-between align-items-start mb-2">
                                <div className="p-2 bg-primary-subtle text-primary rounded-3">
                                    <Target size={20} />
                                </div>
                                <span className="badge bg-success-subtle text-success border-success-subtle">Success Rate</span>
                            </div>
                            <h3 className="fw-bold mb-1">{summary.totalCompleted > 0 ? Math.round((summary.onTime / summary.totalCompleted) * 100) : 0}%</h3>
                            <p className="text-muted small mb-0">Completed On Time</p>
                        </div>
                        <div className="bg-primary opacity-10 position-absolute" style={{ bottom: '-10px', right: '-10px', width: '60px', height: '60px', borderRadius: '50%' }}></div>
                    </div>
                </div>
                <div className="col-md-3">
                    <div className="card border-0 shadow-sm h-100 overflow-hidden">
                        <div className="card-body p-3">
                            <div className="d-flex justify-content-between align-items-start mb-2">
                                <div className="p-2 bg-success-subtle text-success rounded-3">
                                    <CheckCircle size={20} />
                                </div>
                            </div>
                            <h3 className="fw-bold mb-1">{summary.totalCompleted}</h3>
                            <p className="text-muted small mb-0">Total Completed Actions</p>
                        </div>
                    </div>
                </div>
                <div className="col-md-3">
                    <div className="card border-0 shadow-sm h-100 overflow-hidden">
                        <div className="card-body p-3">
                            <div className="d-flex justify-content-between align-items-start mb-2">
                                <div className="p-2 bg-warning-subtle text-warning rounded-3">
                                    <Clock size={20} />
                                </div>
                            </div>
                            <h3 className="fw-bold mb-1">{summary.avgDuration}h</h3>
                            <p className="text-muted small mb-0">Average Completion Time</p>
                        </div>
                    </div>
                </div>
                <div className="col-md-3">
                    <div className="card border-0 shadow-sm h-100 overflow-hidden">
                        <div className="card-body p-3">
                            <div className="d-flex justify-content-between align-items-start mb-2">
                                <div className="p-2 bg-danger-subtle text-danger rounded-3">
                                    <AlertTriangle size={20} />
                                </div>
                            </div>
                            <h3 className="fw-bold mb-1">{summary.overdue}</h3>
                            <p className="text-muted small mb-0">Overdue completions</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Table */}
            <div className="card border-0 shadow-sm overflow-hidden">
                <div className="card-header bg-white py-3">
                    <div className="d-flex justify-content-between align-items-center">
                        <h5 className="mb-0 fw-bold">Task Performance Metrics</h5>
                        <div className="d-flex gap-2">
                            <select
                                className="form-select form-select-sm border-0 bg-light fw-bold"
                                value={timeframe}
                                onChange={(e) => setTimeframe(e.target.value)}
                            >
                                <option value="30">Last 30 Days</option>
                                <option value="7">Last 7 Days</option>
                                <option value="90">Last 90 Days</option>
                                <option value="all">All Time</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div className="card-body p-0">
                    <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0" style={{ fontSize: '13px' }}>
                            <thead className="table-light">
                                <tr>
                                    <th className="ps-4">Action Details</th>
                                    <th>Assignee</th>
                                    <th>Plan vs Actual</th>
                                    <th>Duration</th>
                                    <th>Variance</th>
                                    <th className="pe-4 text-end">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {metrics.map((m, idx) => (
                                    <tr key={m.id || idx}>
                                        <td className="ps-4">
                                            <div className="fw-bold text-dark">{m.title}</div>
                                            <div className="text-muted small d-flex align-items-center gap-1 mt-1">
                                                <Calendar size={12} />
                                                Started: {new Date(m.startedAt).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="d-flex align-items-center gap-2">
                                                <div className="avatar-initial bg-primary-subtle text-primary rounded-circle small" style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>
                                                    {m.assignee.charAt(0)}
                                                </div>
                                                <span>{m.assignee}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="d-flex flex-column gap-1" style={{ maxWidth: '120px' }}>
                                                <div className="text-muted smallest" style={{ fontSize: '10px' }}>
                                                    Plan: {m.plannedDuration || '--'}h
                                                </div>
                                                <div className="progress" style={{ height: '4px' }}>
                                                    <div
                                                        className={`progress-bar ${m.isOverdue ? 'bg-danger' : 'bg-success'}`}
                                                        style={{ width: m.plannedDuration ? `${Math.min((m.actualDuration / m.plannedDuration) * 100, 100)}%` : '100%' }}
                                                    ></div>
                                                </div>
                                                <div className="smallest fw-bold" style={{ fontSize: '10px' }}>
                                                    Actual: {m.actualDuration}h
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="fw-medium">{m.actualDuration}h</div>
                                        </td>
                                        <td>
                                            <span className={`fw-bold ${m.variance > 0 ? 'text-danger' : m.variance < 0 ? 'text-success' : 'text-muted'}`}>
                                                {m.variance > 0 ? `+${m.variance}` : m.variance || 0}h
                                            </span>
                                        </td>
                                        <td className="pe-4 text-end">
                                            {m.isOverdue ? (
                                                <span className="badge bg-danger-subtle text-danger border-danger-subtle">
                                                    Overdue
                                                </span>
                                            ) : (
                                                <span className="badge bg-success-subtle text-success border-success-subtle">
                                                    On Time
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {metrics.length === 0 && (
                                    <tr>
                                        <td colSpan="6" className="text-center py-5 text-muted">
                                            <TrendingUp className="mb-2 opacity-25" size={32} />
                                            <div>No performance data available yet</div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GoalAchievementReport;
