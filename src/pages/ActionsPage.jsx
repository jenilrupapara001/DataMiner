import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  RefreshCw, 
  Play, 
  LayoutGrid, 
  TrendingUp, 
  Search, 
  Filter, 
  Plus,
  PlusCircle,
  MoreVertical,
  ArrowRight,
  Target
} from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import GoalControlCenter from '../components/actions/GoalControlCenter.jsx';
import AIActionPanel from '../components/actions/AIActionPanel.jsx';
import PerformanceChart from '../components/actions/PerformanceChart.jsx';
import TaskBoard from '../components/actions/TaskBoard.jsx';
import IntelligenceFeed from '../components/actions/IntelligenceFeed.jsx';
import { db } from '../services/db';

const ActionsPage = () => {
  const [activeView, setActiveView] = useState('strategic'); // 'strategic' | 'operations'
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Fetch Current Goal Progress
  const { data: goalData, isLoading: goalLoading, refetch: refetchGoal } = useQuery({
    queryKey: ['growth-goal'],
    queryFn: async () => {
      return await db.request('/goals/current');
    }
  });

  // Fetch Performance History
  const { data: chartData, isLoading: chartLoading } = useQuery({
    queryKey: ['performance-analytics', goalData?.id],
    queryFn: async () => {
      return await db.request(`/analytics/performance?goalId=${goalData.id}`);
    },
    enabled: !!goalData?.id
  });

  // Fetch Tasks (Tactical)
  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['growth-tasks'],
    queryFn: async () => {
      return await db.request('/tasks');
    }
  });

  // Fetch Insights
  const { data: insights, isLoading: insightsLoading } = useQuery({
    queryKey: ['growth-insights'],
    queryFn: async () => {
      return await db.request('/insights');
    }
  });

  const getStatusCount = (status) => {
    if (!tasks) return 0;
    if (status === 'ALL') return tasks.length;
    return tasks.filter(t => t.status === status).length;
  };

  const filteredTasks = tasks?.filter(task => {
    const matchesSearch = searchQuery 
      ? task.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        task.description?.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    const matchesStatus = filterStatus ? task.status === filterStatus : true;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="dashboard-container p-3" style={{ backgroundColor: 'var(--color-surface-1)', minHeight: '100vh' }}>
      <header className="mb-4">
        <div className="d-flex justify-content-between align-items-center mb-1">
          <h1 className="fw-bold h3 mb-0">Action <span style={{ color: 'var(--color-brand-600)' }}>Operations</span> Hub</h1>
          <div className="d-flex gap-2 align-items-center">
            <div className="btn-group bg-light p-1 rounded-pill border" style={{ height: '40px' }}>
              <button 
                className={`btn btn-sm rounded-pill px-3 d-flex align-items-center gap-2 border-0 ${activeView === 'strategic' ? 'bg-white shadow-sm fw-bold text-primary' : 'text-muted'}`}
                onClick={() => setActiveView('strategic')}
              >
                <TrendingUp size={14} /> Strategic
              </button>
              <button 
                className={`btn btn-sm rounded-pill px-3 d-flex align-items-center gap-2 border-0 ${activeView === 'operations' ? 'bg-white shadow-sm fw-bold text-primary' : 'text-muted'}`}
                onClick={() => setActiveView('operations')}
              >
                <LayoutGrid size={14} /> Operations
              </button>
            </div>
            <div className="vr mx-2" style={{ height: '24px' }}></div>
            <button className="btn btn-sm btn-white border rounded-pill px-3 d-flex align-items-center gap-2 h-100" style={{ height: '40px' }}>
              <Plus size={16} /> Quick Task
            </button>
            <button className="btn btn-sm btn-zinc-900 text-white rounded-pill px-4 border-0 shadow-sm" style={{ backgroundColor: '#18181B', height: '40px' }}>
              <PlusCircle size={16} className="me-2" /> New Project
            </button>
          </div>
        </div>
        <p className="text-muted small mb-0">Strategic Performance & Tactical Oversight</p>
      </header>

      {activeView === 'strategic' ? (
        <div className="container-fluid p-0">
          <GoalControlCenter goalData={goalData} loading={goalLoading} />
          
          <div className="row g-3 mb-3">
            <div className="col-lg-8">
              <PerformanceChart chartData={chartData} loading={chartLoading} />
            </div>
            <div className="col-lg-4">
              <AIActionPanel suggestions={insights?.filter(i => i.isStrategic) || []} loading={insightsLoading} />
            </div>
          </div>

          <div className="row g-3">
            <div className="col-lg-8">
              <TaskBoard tasks={tasks?.slice(0, 5)} loading={tasksLoading} />
            </div>
            <div className="col-lg-4">
              <IntelligenceFeed insights={insights} loading={insightsLoading} />
            </div>
          </div>
        </div>
      ) : (
        <div className="container-fluid p-0 animate-fade-in">
          {/* Status Pill Bar */}
          <div className="d-flex flex-wrap gap-2 mb-4">
            {[
              { label: 'ALL', count: getStatusCount('ALL'), color: '#6366f1' },
              { label: 'TO DO', count: getStatusCount('PENDING'), color: '#3b82f6' },
              { label: 'OVERDUE', count: 0, color: '#ef4444' },
              { label: 'TOMORROW', count: 0, color: '#f59e0b' },
              { label: 'PENDING', count: getStatusCount('PENDING'), color: '#f59e0b' },
              { label: 'IN PROGRESS', count: getStatusCount('IN_PROGRESS'), color: '#8b5cf6' },
              { label: 'REVIEW', count: getStatusCount('REVIEW'), color: '#ec4899' },
              { label: 'COMPLETED', count: getStatusCount('COMPLETED'), color: '#10b981' }
            ].map((pill, i) => (
              <div 
                key={i} 
                className="btn btn-white border px-3 py-1.5 rounded-pill d-flex align-items-center gap-2 shadow-sm pointer"
                style={{ fontSize: '11px', fontWeight: 700 }}
                onClick={() => setFilterStatus(pill.label === 'ALL' ? '' : pill.label)}
              >
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: pill.color }}></div>
                <span className="text-muted">{pill.label}</span>
                <span className="badge bg-light text-dark border-0">{pill.count}</span>
              </div>
            ))}
          </div>

          {/* Filters & Search */}
          <div className="card border-0 shadow-sm mb-3" style={{ borderRadius: '12px' }}>
            <div className="card-body p-2">
              <div className="row g-2 align-items-center">
                <div className="col-md-6">
                  <div className="position-relative">
                    <Search className="position-absolute" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#94a3b8' }} />
                    <input 
                      type="text" 
                      placeholder="Search initiatives & tasks..." 
                      className="form-control border-0 bg-transparent ps-5 shadow-none"
                      style={{ height: '40px', fontSize: '13px' }}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col-md-3">
                  <select 
                    className="form-select border-0 bg-light shadow-none" 
                    style={{ height: '40px', fontSize: '12px', fontWeight: 600, color: '#64748b' }}
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
                    <option value="">All Statuses</option>
                    <option value="PENDING">Pending</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                </div>
                <div className="col-md-3">
                  <select className="form-select border-0 bg-light shadow-none" style={{ height: '40px', fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
                    <option>All Priorities</option>
                    <option>High</option>
                    <option>Medium</option>
                    <option>Low</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Task Table */}
          <div className="card border-0 shadow-sm" style={{ borderRadius: '12px', overflow: 'hidden' }}>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0" style={{ fontSize: '12px' }}>
                <thead className="table-light text-muted fw-bold" style={{ fontSize: '10px', letterSpacing: '0.05em' }}>
                  <tr>
                    <th className="ps-4 border-0">#</th>
                    <th className="border-0">Task / Objective Name</th>
                    <th className="border-0">Details</th>
                    <th className="border-0">Type</th>
                    <th className="border-0">Seller</th>
                    <th className="border-0">ASINs</th>
                    <th className="border-0">Progress</th>
                    <th className="border-0">Priority</th>
                    <th className="text-end pe-4 border-0">Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {tasksLoading ? (
                    [1, 2, 3, 4, 5].map(i => (
                      <tr key={i} className="placeholder-glow"><td colSpan="9" className="px-4 py-3"><div className="placeholder col-12 rounded" style={{ height: '30px' }}></div></td></tr>
                    ))
                  ) : filteredTasks && filteredTasks.length > 0 ? (
                    filteredTasks.map((task, idx) => (
                      <tr key={task.id || task._id}>
                        <td className="ps-4 text-muted smallest">{idx + 1}</td>
                        <td className="py-3">
                          <div className="fw-bold text-dark d-flex align-items-center gap-2">
                            {task.title}
                          </div>
                        </td>
                        <td><div className="text-muted text-truncate" style={{ maxWidth: '200px' }}>{task.description}</div></td>
                        <td><span className="badge bg-light text-dark border smallest">{task.type}</span></td>
                        <td>{task.sellerName || '--'}</td>
                        <td>
                          <div className="d-flex gap-1">
                            {task.resolvedAsins?.slice(0, 1).map(asin => (
                              <span key={asin} className="badge bg-light text-dark border-0 smallest fw-normal">{asin}</span>
                            ))}
                            {task.resolvedAsins?.length > 1 && <span className="text-muted smallest">+{task.resolvedAsins.length - 1}</span>}
                          </div>
                        </td>
                        <td>
                          <div className="d-flex align-items-center gap-2" style={{ width: '100px' }}>
                            <div className="progress flex-grow-1" style={{ height: '4px' }}>
                              <div className="progress-bar bg-primary" style={{ width: `${task.status === 'COMPLETED' ? 100 : task.status === 'IN_PROGRESS' ? 50 : 0}%` }}></div>
                            </div>
                            <span className="smallest fw-bold">{task.status === 'COMPLETED' ? '100%' : task.status === 'IN_PROGRESS' ? '50%' : '0%'}</span>
                          </div>
                        </td>
                        <td>
                          <div className="d-flex align-items-center gap-1">
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: task.priority === 'HIGH' ? '#ef4444' : '#3b82f6' }}></div>
                            <span className="smallest fw-bold">{task.priority}</span>
                          </div>
                        </td>
                        <td className="text-end pe-4">
                          <button className="btn btn-sm btn-icon btn-light rounded-circle"><MoreVertical size={14} /></button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="9" className="text-center py-5">
                        <div className="d-flex flex-column align-items-center opacity-50">
                          <Target size={32} className="mb-2" />
                          <p className="smallest mb-0">No items found matching the current filters.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActionsPage;
