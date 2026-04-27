import React, { useState, useEffect, useCallback } from 'react';
import { 
    CheckCircle2, Clock, AlertCircle, ListTodo, 
    BarChart3, Zap, Play, Eye, Trash2, User, Calendar,
    Filter, ChevronDown, Search, X, RefreshCw, Store
} from 'lucide-react';
import { taskApi, userApi } from '../services/api';

const STATUS_CONFIG = {
    'To-Do': { color: '#6b7280', bg: '#f3f4f6', icon: ListTodo, label: 'To Do' },
    'In Progress': { color: '#2563eb', bg: '#eff6ff', icon: Play, label: 'In Progress' },
    'In Review': { color: '#d97706', bg: '#fffbeb', icon: Eye, label: 'In Review' },
    'Completed': { color: '#059669', bg: '#ecfdf5', icon: CheckCircle2, label: 'Completed' }
};

const PRIORITY_CONFIG = {
    'High': { color: '#dc2626', bg: '#fef2f2' },
    'Medium': { color: '#d97706', bg: '#fffbeb' },
    'Low': { color: '#059669', bg: '#ecfdf5' }
};

const TasksPage = () => {
    const [tasks, setTasks] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [counts, setCounts] = useState({ todo: 0, inProgress: 0, inReview: 0, completed: 0 });
    const [activeStatus, setActiveStatus] = useState('all');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);

    const loadTasks = useCallback(async () => {
        setLoading(true);
        try {
            const params = { page, limit: 50 };
            if (activeStatus !== 'all') params.status = activeStatus;
            if (search) params.search = search;
            
            const response = await taskApi.getAll(params);
            if (response.success) {
                setTasks(response.data.tasks || []);
                setCounts(response.data.counts || { todo: 0, inProgress: 0, inReview: 0, completed: 0 });
            }
        } catch (err) {
            console.error('Failed to load tasks:', err);
        }
        setLoading(false);
    }, [page, activeStatus, search]);

    const loadUsers = async () => {
        try {
            const response = await userApi.getAll();
            if (response.success) {
                setUsers(response.data.users || []);
            }
        } catch (err) {
            console.error('Failed to load users:', err);
        }
    };

    useEffect(() => { loadTasks(); loadUsers(); }, [loadTasks]);

    const handleStatusChange = async (taskId, newStatus) => {
        let remarks = '';
        if (newStatus === 'Completed') {
            remarks = prompt('Add completion remarks (optional):') || '';
        }
        try {
            await taskApi.updateStatus(taskId, newStatus, remarks);
            loadTasks();
        } catch (err) {
            alert('Failed to update status: ' + err.message);
        }
    };

    const handleAssign = async (taskId, userId) => {
        try {
            await taskApi.assign(taskId, userId);
            loadTasks();
        } catch (err) {
            alert('Failed to assign task: ' + err.message);
        }
    };

    const handleDelete = async (taskId) => {
        if (!confirm('Delete this task?')) return;
        try {
            await taskApi.delete(taskId);
            loadTasks();
        } catch (err) {
            alert('Failed to delete task');
        }
    };

    const statusPills = [
        { key: 'all', label: 'All', count: counts.todo + counts.inProgress + counts.inReview + counts.completed, color: '#18181b' },
        { key: 'To-Do', label: 'To Do', count: counts.todo, color: '#6b7280' },
        { key: 'In Progress', label: 'In Progress', count: counts.inProgress, color: '#2563eb' },
        { key: 'In Review', label: 'In Review', count: counts.inReview, color: '#d97706' },
        { key: 'Completed', label: 'Completed', count: counts.completed, color: '#059669' },
    ];

    return (
        <div style={{ padding: '1.5rem', background: '#f9fafb', minHeight: '100vh' }}>
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h4 className="fw-bold mb-1">Optimization Tasks</h4>
                    <p className="text-zinc-500 mb-0" style={{ fontSize: '13px' }}>
                        AI-generated tasks from ASIN analysis
                    </p>
                </div>
                <button className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-2 rounded-3" onClick={loadTasks}>
                    <RefreshCw size={14} /> Refresh
                </button>
            </div>

            {/* Status Pills */}
            <div className="d-flex gap-2 mb-4 flex-wrap">
                {statusPills.map(pill => (
                    <button
                        key={pill.key}
                        className={`btn btn-sm rounded-pill px-3 py-2 fw-bold d-flex align-items-center gap-2 ${
                            activeStatus === pill.key 
                                ? 'text-white' 
                                : 'bg-white border text-zinc-600'
                        }`}
                        style={{ 
                            fontSize: '12px',
                            backgroundColor: activeStatus === pill.key ? pill.color : undefined,
                            borderColor: activeStatus === pill.key ? pill.color : '#e5e7eb'
                        }}
                        onClick={() => { setActiveStatus(pill.key); setPage(1); }}
                    >
                        {pill.label}
                        <span className="badge rounded-pill bg-white bg-opacity-25" style={{ fontSize: '10px' }}>
                            {pill.count}
                        </span>
                    </button>
                ))}
            </div>

            {/* Search */}
            <div className="position-relative mb-4" style={{ maxWidth: '300px' }}>
                <Search size={14} className="position-absolute top-50 start-0 translate-middle-y ms-3 text-zinc-400" />
                <input
                    className="form-control form-control-sm ps-5 rounded-3"
                    placeholder="Search tasks..."
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(1); }}
                    style={{ fontSize: '12px', height: '36px' }}
                />
            </div>

            {/* Task Cards */}
            <div className="d-flex flex-column gap-3">
                {tasks.map(task => {
                    const status = STATUS_CONFIG[task.status] || STATUS_CONFIG['To-Do'];
                    const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG['Medium'];
                    
                    return (
                        <div key={task.id} className="bg-white border rounded-4 p-4 shadow-sm hover-shadow transition-all">
                            <div className="d-flex justify-content-between align-items-start mb-3">
                                <div className="d-flex align-items-center gap-3">
                                    <span className="badge rounded-pill px-3 py-1 fw-bold" style={{ 
                                        backgroundColor: priority.bg, 
                                        color: priority.color, 
                                        fontSize: '10px' 
                                    }}>
                                        {task.priority}
                                    </span>
                                    <span className="badge rounded-pill px-3 py-1 fw-bold" style={{ 
                                        backgroundColor: status.bg, 
                                        color: status.color, 
                                        fontSize: '10px' 
                                    }}>
                                        <status.icon size={12} className="me-1" />
                                        {status.label}
                                    </span>
                                    <span className="text-zinc-400" style={{ fontSize: '10px' }}>
                                        {task.category}
                                    </span>
                                </div>
                                <div className="d-flex gap-2">
                                    <select
                                        className="form-select form-select-sm"
                                        value={task.assignedTo || ''}
                                        onChange={e => handleAssign(task.id, e.target.value)}
                                        style={{ fontSize: '10px', width: '120px' }}
                                    >
                                        <option value="">Unassigned</option>
                                        {users.map(u => (
                                            <option key={u.id} value={u.id}>
                                                {u.fullName || `${u.firstName} ${u.lastName}`}
                                            </option>
                                        ))}
                                    </select>
                                    <select
                                        className="form-select form-select-sm"
                                        value={task.status}
                                        onChange={e => handleStatusChange(task.id, e.target.value)}
                                        style={{ fontSize: '10px', width: '110px' }}
                                    >
                                        <option value="To-Do">To Do</option>
                                        <option value="In Progress">In Progress</option>
                                        <option value="In Review">In Review</option>
                                        <option value="Completed">Completed</option>
                                    </select>
                                    <button className="btn btn-sm btn-ghost text-zinc-400" onClick={() => handleDelete(task.id)}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>

                            <h6 className="fw-bold mb-2">{task.title}</h6>
                            <p className="text-zinc-500 mb-3" style={{ fontSize: '12px' }}>{task.description}</p>

                            <div className="d-flex align-items-center gap-4 flex-wrap">
                                <span className="d-flex align-items-center gap-1 text-zinc-500" style={{ fontSize: '11px' }}>
                                    <span className="fw-bold text-primary">{task.asinCode}</span>
                                </span>
                                <span className="d-flex align-items-center gap-1 text-zinc-500" style={{ fontSize: '11px' }}>
                                    <Store size={12} /> {task.sellerName}
                                </span>
                                {task.assignedToName && (
                                    <span className="d-flex align-items-center gap-1 text-zinc-500" style={{ fontSize: '11px' }}>
                                        <User size={12} className="text-zinc-400" /> {task.assignedToName}
                                    </span>
                                )}
                                {task.impactScore > 0 && (
                                    <span className="d-flex align-items-center gap-1 text-zinc-500" style={{ fontSize: '11px' }}>
                                        <Zap size={12} className="text-amber-500" /> Impact: {task.impactScore}%
                                    </span>
                                )}
                                {task.effortEstimate && (
                                    <span className="d-flex align-items-center gap-1 text-zinc-500" style={{ fontSize: '11px' }}>
                                        <Clock size={12} /> {task.effortEstimate}
                                    </span>
                                )}
                                <div className="ms-auto d-flex align-items-center gap-3">
                                    {task.createdByName && (
                                        <span className="text-zinc-400" style={{ fontSize: '10px' }}>
                                            Created by {task.createdByName}
                                        </span>
                                    )}
                                    {task.createdAt && (
                                        <span className="d-flex align-items-center gap-1 text-zinc-400" style={{ fontSize: '10px' }}>
                                            <Calendar size={11} /> {new Date(task.createdAt).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>
                            </div>
                            
                            {task.completionRemarks && (
                                <div className="mt-2 p-2 bg-success-subtle rounded-2" style={{ fontSize: '11px' }}>
                                    💬 {task.completionRemarks}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {tasks.length === 0 && !loading && (
                <div className="text-center py-5">
                    <ListTodo size={48} className="text-zinc-300 mb-3" />
                    <h6 className="text-zinc-500">No tasks found</h6>
                    <p className="text-zinc-400" style={{ fontSize: '13px' }}>
                        Generate tasks from the ASIN Manager by selecting ASINs and clicking "Create Tasks"
                    </p>
                </div>
            )}
        </div>
    );
};

export default TasksPage;
