import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { userApi, roleApi, sellerApi } from '../services/api';
import {
    Users, Shield, UserPlus, Search, Pencil, Pause, Play, Trash2, Mail, Phone,
    Clock, CheckCircle2, XCircle, Info, UserCheck, RefreshCw, X, Store, Check
} from 'lucide-react';
import ListView from '../components/common/ListView';
import { PageLoader } from '@/components/application/loading-indicator/PageLoader';

const UsersPage = () => {
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [sellers, setSellers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [filters, setFilters] = useState({ search: '', role: '', isActive: '' });
    const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0 });
    const [allPermissions, setAllPermissions] = useState([]);

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        phone: '',
        role: '',
        isActive: true,
        assignedSellers: [],
        supervisors: [],
        extraPermissions: [],
        excludedPermissions: [],
    });

    const rolePermissionIds = useMemo(() => {
        const selectedRole = roles.find(r => r._id === formData.role || r.id === formData.role);
        return selectedRole?.permissions?.map(p => p._id || p.id || p) || [];
    }, [formData.role, roles]);

    const loadUsers = useCallback(async () => {
        setLoading(true);
        try {
            const params = {
                page: pagination.page,
                limit: pagination.limit,
                ...filters,
            };
            const response = await userApi.getAll(params);
            if (response.success) {
                setUsers(response.data.users || []);
                setPagination(prev => ({ ...prev, ...response.data.pagination }));
            }
        } catch (error) {
            console.error('Failed to load users:', error);
        }
        setLoading(false);
    }, [pagination.page, pagination.limit, filters]);

    const loadRoles = useCallback(async () => {
        try {
            const [rolesRes, permsRes] = await Promise.all([
                userApi.getRoles(),
                roleApi.getPermissions()
            ]);
            
            if (rolesRes.success) {
                const rolesData = rolesRes.data?.roles || rolesRes.data || [];
                setRoles(Array.isArray(rolesData) ? rolesData : []);
            }
            
            if (permsRes.success) {
                const grouped = permsRes.data?.groupedPermissions || {};
                const flatPerms = Object.values(grouped).flat();
                setAllPermissions(flatPerms);
            }
        } catch (error) {
            console.error('Failed to load roles:', error);
            setRoles([]);
            setAllPermissions([]);
        }
    }, []);

    const loadSellers = useCallback(async () => {
        try {
            const response = await userApi.getSellers();
            const sellersData = response?.data?.sellers || response?.data || [];
            setSellers(Array.isArray(sellersData) ? sellersData : []);
        } catch (error) {
            console.error('Failed to load sellers:', error);
            setSellers([]);
        }
    }, []);

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    useEffect(() => {
        loadRoles();
        loadSellers();
    }, [loadRoles, loadSellers]);

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const handleOpenUserModal = async (user = null) => {
        if (user) {
            try {
                const response = await userApi.getById(user._id || user.id);
                const fullUser = response.data;
                setEditingUser(fullUser);
                setFormData({
                    email: fullUser.email,
                    password: '',
                    firstName: fullUser.firstName,
                    lastName: fullUser.lastName,
                    phone: fullUser.phone || '',
                    role: fullUser.role?._id || fullUser.role?.id || fullUser.role || '',
                    isActive: fullUser.isActive,
                    assignedSellers: fullUser.assignedSellers?.map(s => s._id || s.id || s) || [],
                    supervisors: fullUser.supervisors || [],
                    extraPermissions: fullUser.extraPermissions?.map(p => p._id || p.id || p) || [],
                    excludedPermissions: fullUser.excludedPermissions?.map(p => p._id || p.id || p) || [],
                });
            } catch (error) {
                console.error('Failed to load user details:', error);
                setEditingUser(user);
                setFormData({
                    email: user.email,
                    password: '',
                    firstName: user.firstName,
                    lastName: user.lastName,
                    phone: user.phone || '',
                    role: user.role?._id || user.role?.id || user.role || '',
                    isActive: user.isActive,
                    assignedSellers: user.assignedSellers?.map(s => s._id || s.id || s) || [],
                    supervisors: user.supervisors?.map(s => s._id || s.id || s) || [],
                    extraPermissions: user.extraPermissions?.map(p => p._id || p.id || p) || [],
                    excludedPermissions: user.excludedPermissions?.map(p => p._id || p.id || p) || [],
                });
            }
        } else {
            setEditingUser(null);
            setFormData({
                email: '',
                password: '',
                firstName: '',
                lastName: '',
                phone: '',
                role: '',
                isActive: true,
                assignedSellers: [],
                supervisors: [],
                extraPermissions: [],
                excludedPermissions: [],
            });
        }
        setShowModal(true);
    };

    const handleSaveUser = async () => {
        try {
            const data = {
                ...formData,
                roleId: formData.role,
                assignedSellerIds: formData.assignedSellers
            };
            
            if (editingUser) {
                await userApi.update(editingUser._id || editingUser.id, data);
            } else {
                await userApi.create(data);
            }
            setShowModal(false);
            loadUsers();
        } catch (error) {
            console.error('Failed to save user:', error);
            alert(error.message || 'Failed to save user');
        }
    };

    const handleDeleteUser = async (userId) => {
        if (!window.confirm('Are you sure you want to delete this user?')) return;
        try {
            await userApi.delete(userId);
            loadUsers();
        } catch (error) {
            alert(error.message || 'Failed to delete user');
        }
    };

    const handleToggleStatus = async (userId) => {
        try {
            await userApi.toggleStatus(userId);
            loadUsers();
        } catch (error) {
            alert(error.message || 'Failed to toggle status');
        }
    };

    const togglePermission = (permId) => {
        const isInherited = rolePermissionIds.includes(permId);
        setFormData(prev => {
            if (isInherited) {
                const isExcluded = prev.excludedPermissions.includes(permId);
                return {
                    ...prev,
                    excludedPermissions: isExcluded
                        ? prev.excludedPermissions.filter(id => id !== permId)
                        : [...prev.excludedPermissions, permId]
                };
            } else {
                const isExtra = prev.extraPermissions.includes(permId);
                return {
                    ...prev,
                    extraPermissions: isExtra
                        ? prev.extraPermissions.filter(id => id !== permId)
                        : [...prev.extraPermissions, permId]
                };
            }
        });
    };

    if (loading && users.length === 0) return <PageLoader message="Loading Users..." />;

    return (
        <div className="p-4" style={{ backgroundColor: '#f9fafb', minHeight: '100vh' }}>
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h4 className="fw-bold mb-1">User Management</h4>
                    <p className="text-muted mb-0 small">{pagination.total} total members in your organization</p>
                </div>
                <div className="d-flex gap-2">
                    <button className="btn btn-white border shadow-sm d-flex align-items-center gap-2" onClick={() => loadUsers()}>
                        <RefreshCw size={16} /> Refresh
                    </button>
                    <button className="btn btn-dark d-flex align-items-center gap-2" onClick={() => handleOpenUserModal()}>
                        <UserPlus size={16} /> Add Member
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="card border-0 shadow-sm mb-4 rounded-3">
                <div className="card-body p-3">
                    <div className="row g-3">
                        <div className="col-md-5">
                            <div className="position-relative">
                                <Search size={16} className="position-absolute top-50 start-0 translate-middle-y ms-3 text-muted" />
                                <input 
                                    type="text" 
                                    className="form-control ps-5 border-0 bg-light" 
                                    placeholder="Search by name, email..." 
                                    value={filters.search}
                                    onChange={(e) => handleFilterChange('search', e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="col-md-3">
                            <select 
                                className="form-select border-0 bg-light"
                                value={filters.role}
                                onChange={(e) => handleFilterChange('role', e.target.value)}
                            >
                                <option value="">All Roles</option>
                                {roles.map(r => <option key={r._id || r.id} value={r.name || r.id}>{r.displayName}</option>)}
                            </select>
                        </div>
                        <div className="col-md-3">
                            <select 
                                className="form-select border-0 bg-light"
                                value={filters.isActive}
                                onChange={(e) => handleFilterChange('isActive', e.target.value)}
                            >
                                <option value="">All Status</option>
                                <option value="true">Active</option>
                                <option value="false">Inactive</option>
                            </select>
                        </div>
                        <div className="col-md-1">
                            <button className="btn btn-light w-100" onClick={() => setFilters({ search: '', role: '', isActive: '' })}>
                                <X size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="card border-0 shadow-sm rounded-3 overflow-hidden">
                <ListView
                    columns={[
                        {
                            label: 'Member',
                            key: 'firstName',
                            render: (_, user) => (
                                <div className="d-flex align-items-center gap-3">
                                    <div className="avatar rounded-circle bg-primary-subtle text-primary d-flex align-items-center justify-content-center fw-bold" style={{ width: '38px', height: '38px' }}>
                                        {user.firstName?.[0]}{user.lastName?.[0]}
                                    </div>
                                    <div>
                                        <div className="fw-bold small">{user.firstName} {user.lastName}</div>
                                        <div className="text-muted smallest">{user.email}</div>
                                    </div>
                                </div>
                            )
                        },
                        {
                            label: 'Access Role',
                            key: 'role',
                            render: (role) => (
                                <span className="badge rounded-pill fw-bold" style={{ backgroundColor: (role?.color || '#6366f1') + '15', color: role?.color || '#6366f1', fontSize: '10px' }}>
                                    <Shield size={10} className="me-1" /> {role?.displayName || 'Standard'}
                                </span>
                            )
                        },
                        {
                            label: 'Supervisors',
                            key: 'supervisors',
                            render: (supervisors) => (
                                <div className="d-flex flex-wrap gap-1">
                                    {supervisors && supervisors.length > 0 ? (
                                        supervisors.map((s, idx) => (
                                            <div key={idx} className="d-flex align-items-center gap-1 bg-light border rounded-pill px-2 py-0.5" title={s.email} style={{ fontSize: '10px' }}>
                                                <div className="rounded-circle bg-secondary text-white d-flex align-items-center justify-content-center" style={{ width: '16px', height: '16px', fontSize: '8px' }}>
                                                    {s.firstName?.[0]}{s.lastName?.[0]}
                                                </div>
                                                <span className="text-secondary fw-medium">{s.firstName}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <span className="text-muted smallest">-</span>
                                    )}
                                </div>
                            )
                        },
                        {
                            label: 'Status',
                            key: 'isActive',
                            render: (isActive, user) => (
                                <button className="btn btn-link p-0 text-decoration-none border-0" onClick={() => handleToggleStatus(user._id)}>
                                    {isActive ? (
                                        <span className="text-success small d-flex align-items-center gap-1"><CheckCircle2 size={14} /> Active</span>
                                    ) : (
                                        <span className="text-danger small d-flex align-items-center gap-1"><XCircle size={14} /> Inactive</span>
                                    )}
                                </button>
                            )
                        },
                        {
                            label: 'Last Seen',
                            key: 'lastSeen',
                            render: (val) => (
                                <div className="text-muted smallest d-flex align-items-center gap-1">
                                    <Clock size={12} /> {val ? new Date(val).toLocaleDateString() : 'Never'}
                                </div>
                            )
                        }
                    ]}
                    rows={users}
                    rowKey="_id"
                    actions={(user) => (
                        <div className="d-flex gap-1">
                            <button className="btn btn-sm btn-light" onClick={() => handleOpenUserModal(user)}><Pencil size={14} /></button>
                            <button className="btn btn-sm btn-light text-danger" onClick={() => handleDeleteUser(user._id)}><Trash2 size={14} /></button>
                        </div>
                    )}
                />
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
                <div className="d-flex justify-content-between align-items-center mt-3">
                    <span className="text-muted small">Page {pagination.page} of {pagination.totalPages}</span>
                    <div className="btn-group shadow-sm">
                        <button className="btn btn-sm btn-white border" disabled={pagination.page === 1} onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}>Previous</button>
                        <button className="btn btn-sm btn-white border" disabled={pagination.page === pagination.totalPages} onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}>Next</button>
                    </div>
                </div>
            )}

            {/* ===== USER ADD/EDIT MODAL ===== */}
            {showModal && (
                <div 
                    className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" 
                    style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(6px)', zIndex: 1050 }}
                    onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
                >
                    <div 
                        className="bg-white shadow-2xl overflow-hidden"
                        style={{ width: '100%', maxWidth: '750px', maxHeight: '90vh', borderRadius: '24px', display: 'flex', flexDirection: 'column' }}
                    >
                        {/* Header */}
                        <div className="px-5 py-4 border-bottom d-flex justify-content-between align-items-center bg-white">
                            <div className="d-flex align-items-center gap-3">
                                <div className="p-2 rounded-3" style={{ background: editingUser ? '#eff6ff' : '#ecfdf5', color: editingUser ? '#2563eb' : '#059669' }}>
                                    {editingUser ? <Pencil size={22} /> : <UserPlus size={22} />}
                                </div>
                                <div>
                                    <h5 className="mb-0 fw-bold text-zinc-900">
                                        {editingUser ? `Edit ${editingUser.firstName} ${editingUser.lastName}` : 'Add New Team Member'}
                                    </h5>
                                    <p className="text-zinc-500 small mb-0" style={{ fontSize: '12px' }}>
                                        {editingUser ? 'Update profile details and access permissions' : 'Create account with role-based access control'}
                                    </p>
                                </div>
                            </div>
                            <button className="btn btn-ghost p-2 rounded-circle border-0" onClick={() => setShowModal(false)}>
                                <X size={22} className="text-zinc-400" />
                            </button>
                        </div>

                        {/* Scrollable Body */}
                        <div className="flex-grow-1 overflow-auto p-5" style={{ background: '#f9fafb' }}>
                            <div className="d-flex flex-column gap-4">
                                
                                {/* ===== SECTION 1: BASIC INFO ===== */}
                                <div className="bg-white rounded-3 border p-4">
                                    <div className="d-flex align-items-center gap-2 mb-3">
                                        <div className="p-1.5 rounded-2" style={{ background: '#eff6ff', color: '#2563eb' }}>
                                            <UserCheck size={14} />
                                        </div>
                                        <span className="fw-bold text-zinc-800" style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            Basic Information
                                        </span>
                                    </div>
                                    <div className="row g-3">
                                        <div className="col-sm-6">
                                            <label className="form-label fw-bold text-zinc-600 mb-1" style={{ fontSize: '11px' }}>FIRST NAME *</label>
                                            <input
                                                type="text"
                                                className="form-control rounded-3"
                                                placeholder="e.g. John"
                                                value={formData.firstName}
                                                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                                style={{ fontSize: '13px', height: '42px', border: '1.5px solid #e5e7eb' }}
                                                required
                                            />
                                        </div>
                                        <div className="col-sm-6">
                                            <label className="form-label fw-bold text-zinc-600 mb-1" style={{ fontSize: '11px' }}>LAST NAME *</label>
                                            <input
                                                type="text"
                                                className="form-control rounded-3"
                                                placeholder="e.g. Doe"
                                                value={formData.lastName}
                                                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                                style={{ fontSize: '13px', height: '42px', border: '1.5px solid #e5e7eb' }}
                                                required
                                            />
                                        </div>
                                        <div className="col-sm-6">
                                            <label className="form-label fw-bold text-zinc-600 mb-1" style={{ fontSize: '11px' }}>EMAIL ADDRESS *</label>
                                            <input
                                                type="email"
                                                className="form-control rounded-3"
                                                placeholder="john.doe@example.com"
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                disabled={!!editingUser}
                                                style={{ fontSize: '13px', height: '42px', border: '1.5px solid #e5e7eb', background: editingUser ? '#fafafa' : '#fff' }}
                                                required
                                            />
                                            {editingUser && <span className="text-zinc-400" style={{ fontSize: '10px' }}>Email cannot be changed</span>}
                                        </div>
                                        <div className="col-sm-6">
                                            <label className="form-label fw-bold text-zinc-600 mb-1" style={{ fontSize: '11px' }}>
                                                {editingUser ? 'NEW PASSWORD (leave blank to keep)' : 'PASSWORD *'}
                                            </label>
                                            <input
                                                type="password"
                                                className="form-control rounded-3"
                                                placeholder={editingUser ? "Leave blank to keep current" : "Minimum 6 characters"}
                                                value={formData.password}
                                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                                style={{ fontSize: '13px', height: '42px', border: '1.5px solid #e5e7eb' }}
                                                required={!editingUser}
                                            />
                                        </div>
                                        <div className="col-sm-6">
                                            <label className="form-label fw-bold text-zinc-600 mb-1" style={{ fontSize: '11px' }}>PHONE NUMBER</label>
                                            <input
                                                type="tel"
                                                className="form-control rounded-3"
                                                placeholder="+91 98765 43210"
                                                value={formData.phone}
                                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                                style={{ fontSize: '13px', height: '42px', border: '1.5px solid #e5e7eb' }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* ===== SECTION 2: ROLE & STATUS ===== */}
                                <div className="bg-white rounded-3 border p-4">
                                    <div className="d-flex align-items-center gap-2 mb-3">
                                        <div className="p-1.5 rounded-2" style={{ background: '#fef3c7', color: '#d97706' }}>
                                            <Shield size={14} />
                                        </div>
                                        <span className="fw-bold text-zinc-800" style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            Role & Access Level
                                        </span>
                                    </div>
                                    <div className="row g-3">
                                        <div className="col-sm-8">
                                            <label className="form-label fw-bold text-zinc-600 mb-1" style={{ fontSize: '11px' }}>ASSIGNED ROLE *</label>
                                            <select
                                                className="form-select rounded-3"
                                                value={formData.role}
                                                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                                style={{ fontSize: '13px', height: '42px', border: '1.5px solid #e5e7eb' }}
                                                required
                                            >
                                                <option value="">Select a role...</option>
                                                {roles.map((role) => (
                                                    <option key={role._id || role.id} value={role._id || role.id}>
                                                        {role.displayName} (Level {role.level})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="col-sm-4 d-flex flex-column justify-content-end">
                                            <label className="form-label fw-bold text-zinc-600 mb-1" style={{ fontSize: '11px' }}>ACCOUNT STATUS</label>
                                            <div className="form-check form-switch d-flex align-items-center" style={{ height: '42px' }}>
                                                <input
                                                    className="form-check-input me-2"
                                                    type="checkbox"
                                                    role="switch"
                                                    id="isActiveSwitch"
                                                    checked={formData.isActive}
                                                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                                    style={{ cursor: 'pointer', width: '40px', height: '22px' }}
                                                />
                                                <label className="form-check-label fw-bold" htmlFor="isActiveSwitch" style={{ fontSize: '12px', cursor: 'pointer' }}>
                                                    {formData.isActive ? (
                                                        <span className="text-success d-flex align-items-center gap-1"><CheckCircle2 size={14} /> Active</span>
                                                    ) : (
                                                        <span className="text-danger d-flex align-items-center gap-1"><XCircle size={14} /> Inactive</span>
                                                    )}
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* ===== SECTION 3: SUPERVISORS ===== */}
                                <div className="bg-white rounded-3 border p-4">
                                    <div className="d-flex align-items-center gap-2 mb-3">
                                        <div className="p-1.5 rounded-2" style={{ background: '#f3e8ff', color: '#7c3aed' }}>
                                            <Users size={14} />
                                        </div>
                                        <span className="fw-bold text-zinc-800" style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            Supervisors (Higher Role Level)
                                        </span>
                                    </div>
                                    <p className="text-zinc-500 mb-3" style={{ fontSize: '11px' }}>
                                        Select users with <strong>equal or higher role level</strong> who can supervise this team member.
                                    </p>
                                    
                                    {(() => {
                                        const selectedRoleLevel = roles.find(r => (r._id === formData.role || r.id === formData.role))?.level || 0;
                                        const eligibleSupervisors = users.filter(u => 
                                            (u._id !== editingUser?._id && u.id !== editingUser?._id) && 
                                            (u.role?.level || 0) >= selectedRoleLevel
                                        );

                                        if (eligibleSupervisors.length === 0) {
                                            return (
                                                <div className="text-center py-4 bg-zinc-50 rounded-3">
                                                    <Users size={24} className="text-zinc-300 mb-2" />
                                                    <p className="text-zinc-400 mb-0" style={{ fontSize: '12px' }}>
                                                        {!formData.role 
                                                            ? 'Select a role first to see eligible supervisors'
                                                            : 'No users found with equal or higher role level'}
                                                    </p>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                                <div className="row g-2">
                                                    {eligibleSupervisors.map((user) => (
                                                        <div key={user._id || user.id} className="col-md-6">
                                                            <div
                                                                className={`p-3 rounded-3 border cursor-pointer transition-all ${
                                                                    formData.supervisors.includes(user._id || user.id) 
                                                                        ? 'bg-violet-50 border-violet-300' 
                                                                        : 'bg-white border-zinc-200 hover-bg-zinc-50'
                                                                }`}
                                                                onClick={() => {
                                                                    const uid = user._id || user.id;
                                                                    setFormData(prev => ({
                                                                        ...prev,
                                                                        supervisors: prev.supervisors.includes(uid)
                                                                            ? prev.supervisors.filter(id => id !== uid)
                                                                            : [...prev.supervisors, uid]
                                                                    }));
                                                                }}
                                                            >
                                                                <div className="d-flex align-items-center gap-3">
                                                                    <div className="rounded-circle d-flex align-items-center justify-content-center fw-bold text-white flex-shrink-0"
                                                                        style={{ 
                                                                            width: '36px', 
                                                                            height: '36px', 
                                                                            fontSize: '12px',
                                                                            background: user.role?.color 
                                                                                ? `linear-gradient(135deg, ${user.role.color}, ${user.role.color}dd)` 
                                                                                : 'linear-gradient(135deg, #6366f1, #4f46e5)'
                                                                        }}
                                                                    >
                                                                        {user.firstName?.[0]}{user.lastName?.[0]}
                                                                    </div>
                                                                    <div className="flex-grow-1 min-w-0">
                                                                        <div className="fw-bold text-zinc-800 text-truncate" style={{ fontSize: '12px' }}>
                                                                            {user.firstName} {user.lastName}
                                                                            {formData.supervisors.includes(user._id || user.id) && (
                                                                                <span className="badge bg-violet-100 text-violet-700 ms-2" style={{ fontSize: '9px' }}>Selected</span>
                                                                            )}
                                                                        </div>
                                                                        <div className="d-flex align-items-center gap-2 mt-0.5">
                                                                            <span className="text-zinc-400 text-truncate" style={{ fontSize: '10px' }}>{user.email}</span>
                                                                            <span className="badge rounded-pill" style={{ 
                                                                                fontSize: '9px', 
                                                                                background: (user.role?.color || '#6B7280') + '20', 
                                                                                color: user.role?.color || '#6B7280' 
                                                                            }}>
                                                                                Lvl {user.role?.level || 0}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                    <div className={`checkbox-custom ${formData.supervisors.includes(user._id || user.id) ? 'checked' : ''}`}
                                                                        style={{ width: '20px', height: '20px', flexShrink: 0 }}>
                                                                        {formData.supervisors.includes(user._id || user.id) && <Check size={12} />}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>

                                {/* ===== SECTION 4: SELLER ACCESS ===== */}
                                {(() => {
                                    const selectedRoleObj = roles.find(r => (r._id === formData.role || r.id === formData.role));
                                    const isGlobalRole = selectedRoleObj && ['admin', 'operational_manager'].includes(selectedRoleObj.name);

                                    if (!formData.role || isGlobalRole) return null;

                                    return (
                                        <div className="bg-white rounded-3 border p-4">
                                            <div className="d-flex align-items-center gap-2 mb-3">
                                                <div className="p-1.5 rounded-2" style={{ background: '#ecfdf5', color: '#059669' }}>
                                                    <Store size={14} />
                                                </div>
                                                <span className="fw-bold text-zinc-800" style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    Seller Access ({formData.assignedSellers.length} selected)
                                                </span>
                                            </div>
                                            <p className="text-zinc-500 mb-3" style={{ fontSize: '11px' }}>
                                                Select which sellers this user can access. Non-admin users can only see data for assigned sellers.
                                            </p>
                                            
                                            {sellers.length === 0 ? (
                                                <div className="text-center py-3 bg-zinc-50 rounded-3">
                                                    <Store size={20} className="text-zinc-300 mb-1" />
                                                    <p className="text-zinc-400 mb-0" style={{ fontSize: '12px' }}>No sellers available</p>
                                                </div>
                                            ) : (
                                                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                                    <div className="row g-2">
                                                        {sellers.map((seller) => (
                                                            <div key={seller._id || seller.id} className="col-md-4 col-sm-6">
                                                                <div
                                                                    className={`p-2 rounded-3 border cursor-pointer transition-all ${
                                                                        formData.assignedSellers.includes(seller._id || seller.id) 
                                                                            ? 'bg-emerald-50 border-emerald-300' 
                                                                            : 'bg-white border-zinc-200 hover-bg-zinc-50'
                                                                    }`}
                                                                    onClick={() => {
                                                                        const sid = seller._id || seller.id;
                                                                        setFormData(prev => ({
                                                                            ...prev,
                                                                            assignedSellers: prev.assignedSellers.includes(sid)
                                                                                ? prev.assignedSellers.filter(id => id !== sid)
                                                                                : [...prev.assignedSellers, sid]
                                                                        }));
                                                                    }}
                                                                >
                                                                    <div className="d-flex align-items-center gap-2">
                                                                        <input
                                                                            type="checkbox"
                                                                            className="form-check-input m-0"
                                                                            checked={formData.assignedSellers.includes(seller._id || seller.id)}
                                                                            readOnly
                                                                            style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                                                                        />
                                                                        <div className="min-w-0">
                                                                            <div className="fw-bold text-zinc-700 text-truncate" style={{ fontSize: '11px' }}>
                                                                                {seller.name}
                                                                            </div>
                                                                            <div className="text-zinc-400" style={{ fontSize: '9px' }}>
                                                                                {seller.marketplace}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}

                                {/* ===== SECTION 5: EXTRA PERMISSIONS ===== */}
                                {formData.role && (
                                    <div className="bg-white rounded-3 border p-4">
                                        <div className="d-flex align-items-center gap-2 mb-3">
                                            <div className="p-1.5 rounded-2" style={{ background: '#fff7ed', color: '#ea580c' }}>
                                                <Shield size={14} />
                                            </div>
                                            <span className="fw-bold text-zinc-800" style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                Extra Permissions
                                            </span>
                                            <span className="badge bg-zinc-100 text-zinc-500" style={{ fontSize: '10px' }}>
                                                {formData.extraPermissions.length} extra / {formData.excludedPermissions.length} excluded
                                            </span>
                                        </div>
                                        
                                        {allPermissions.length === 0 ? (
                                            <div className="text-center py-3 bg-zinc-50 rounded-3">
                                                <Shield size={20} className="text-zinc-300 mb-1" />
                                                <p className="text-zinc-400 mb-0" style={{ fontSize: '12px' }}>No permissions available</p>
                                            </div>
                                        ) : (
                                            <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                                                <div className="row g-2">
                                                    {allPermissions.map((perm) => {
                                                        const pid = perm._id || perm.id;
                                                        const isInherited = rolePermissionIds.includes(pid);
                                                        const isExcluded = formData.excludedPermissions.includes(pid);
                                                        const isExtra = formData.extraPermissions.includes(pid);
                                                        const isActive = (isInherited && !isExcluded) || isExtra;

                                                        return (
                                                            <div key={pid} className="col-md-6">
                                                                <div
                                                                    className={`p-2 rounded-3 border cursor-pointer transition-all ${
                                                                        isActive ? 'bg-orange-50 border-orange-300' : 
                                                                        isExcluded ? 'bg-red-50 border-red-200 opacity-60' : 
                                                                        'bg-white border-zinc-200 hover-bg-zinc-50'
                                                                    }`}
                                                                    onClick={() => togglePermission(pid)}
                                                                    title={isInherited ? 'Granted by role' : 'Optional permission'}
                                                                >
                                                                    <div className="d-flex align-items-center gap-2">
                                                                        <input
                                                                            type="checkbox"
                                                                            className="form-check-input m-0"
                                                                            checked={isActive}
                                                                            readOnly
                                                                            style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                                                                        />
                                                                        <div className="min-w-0 flex-grow-1">
                                                                            <div className="fw-bold text-zinc-700 text-truncate" style={{ fontSize: '11px' }}>
                                                                                {perm.displayName || perm.name}
                                                                            </div>
                                                                        </div>
                                                                        {isInherited && !isExcluded && (
                                                                            <span className="badge bg-blue-50 text-blue-600 flex-shrink-0" style={{ fontSize: '8px' }}>ROLE</span>
                                                                        )}
                                                                        {isExtra && (
                                                                            <span className="badge bg-orange-50 text-orange-600 flex-shrink-0" style={{ fontSize: '8px' }}>EXTRA</span>
                                                                        )}
                                                                        {isExcluded && (
                                                                            <span className="badge bg-red-50 text-red-600 flex-shrink-0" style={{ fontSize: '8px' }}>BLOCKED</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-5 py-4 bg-white border-top d-flex justify-content-end gap-3">
                            <button 
                                type="button" 
                                className="btn btn-outline-secondary fw-bold px-4 rounded-3"
                                onClick={() => setShowModal(false)}
                                style={{ fontSize: '13px', height: '42px' }}
                            >
                                Cancel
                            </button>
                            <button 
                                type="button" 
                                className="btn btn-dark fw-bold px-5 rounded-3 d-flex align-items-center gap-2"
                                onClick={handleSaveUser}
                                style={{ fontSize: '13px', height: '42px', background: '#18181b' }}
                            >
                                {editingUser ? (
                                    <><Check size={16} /> Update Profile</>
                                ) : (
                                    <><UserPlus size={16} /> Create Account</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UsersPage;
/**
 * Styles for the UsersPage modal and interactive elements
 */
const style = document.createElement('style');
style.textContent = `
    .checkbox-custom {
        width: 18px;
        height: 18px;
        border-radius: 5px;
        border: 2px solid #d1d5db;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.15s;
        flex-shrink: 0;
    }
    .checkbox-custom.checked {
        background: #18181b;
        border-color: #18181b;
        color: white;
    }
    .checkbox-custom:hover {
        border-color: #18181b;
    }
    .hover-bg-zinc-50:hover {
        background-color: #f9fafb !important;
    }
    .cursor-pointer {
        cursor: pointer;
    }
    .bg-violet-50 { background-color: #f5f3ff; }
    .border-violet-300 { border-color: #c4b5fd; }
    .text-violet-700 { color: #6d28d9; }
    .bg-violet-100 { background-color: #ede9fe; }
    .bg-emerald-50 { background-color: #ecfdf5; }
    .border-emerald-300 { border-color: #6ee7b7; }
    .bg-orange-50 { background-color: #fff7ed; }
    .border-orange-300 { border-color: #fdba74; }
    .text-orange-600 { color: #ea580c; }
    .bg-blue-50 { background-color: #eff6ff; }
    .text-blue-600 { color: #2563eb; }
    .bg-red-50 { background-color: #fef2f2; }
    .text-red-600 { color: #dc2626; }
    .text-zinc-900 { color: #18181b; }
    .text-zinc-800 { color: #27272a; }
    .text-zinc-600 { color: #52525b; }
    .text-zinc-500 { color: #71717a; }
    .text-zinc-400 { color: #a1a1aa; }
    .text-zinc-300 { color: #d4d4d8; }
    .bg-zinc-50 { background-color: #f9fafb; }
    .border-zinc-200 { border-color: #e4e4e7; }
`;
document.head.appendChild(style);
