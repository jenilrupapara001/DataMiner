import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { userApi, roleApi, sellerApi } from '../services/api';
import {
    Users,
    Shield,
    UserPlus,
    Search,
    Pencil,
    Pause,
    Play,
    Trash2,
    Mail,
    Phone,
    Calendar,
    MoreVertical,
    CheckCircle2,
    XCircle,
    Clock,
    ChevronRight,
    UserCheck,
    UserX,
    Filter,
    Plus,
    Info
} from 'lucide-react';
import ListView from '../components/common/ListView';
import { PageLoader } from '@/components/application/loading-indicator/PageLoader';
import { LoadingIndicator } from '@/components/application/loading-indicator/loading-indicator';

const UsersPage = () => {
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [sellers, setSellers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [filters, setFilters] = useState({ search: '', role: '', isActive: '' });
    const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });

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

    const [allPermissions, setAllPermissions] = useState([]);

    const rolePermissionIds = useMemo(() => {
        const selectedRole = roles.find(r => r._id === formData.role);
        return selectedRole?.permissions?.map(p => p._id || p) || [];
    }, [formData.role, roles]);

    const loadUsers = useCallback(async () => {
        setLoading(true);
        try {
            const params = {
                page: pagination.page,
                limit: pagination.limit,
                ...filters,
            };
            if (!params.search) delete params.search;
            if (!params.role) delete params.role;
            if (params.isActive === '') delete params.isActive;

            const response = await userApi.getAll(params);
            if (response.success) {
                setUsers(response.data.users);
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
                roleApi.getAll(),
                roleApi.getPermissions()
            ]);
            if (rolesRes.success) {
                setRoles(rolesRes.data.roles);
            }
            if (permsRes.success) {
                // Flatten all permissions into a single array
                const grouped = permsRes.data.groupedPermissions || {};
                const flatPerms = Object.values(grouped).flat();
                setAllPermissions(flatPerms);
            }
        } catch (error) {
            console.error('Failed to load roles:', error);
        }
    }, []);

    const loadSellers = useCallback(async () => {
        try {
            const response = await sellerApi.getAll({ limit: 1000 });
            if (response.success) {
                setSellers(response.data.sellers);
            }
        } catch (error) {
            console.error('Failed to load sellers:', error);
        }
    }, []);

    useEffect(() => {
        loadUsers();
        loadRoles();
        loadSellers();
    }, [loadUsers, loadRoles, loadSellers]);

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const handlePageChange = (page) => {
        setPagination(prev => ({ ...prev, page }));
    };

    const handleOpenUserModal = (user = null) => {
        if (user) {
            setEditingUser(user);
            setFormData({
                email: user.email,
                password: '',
                firstName: user.firstName,
                lastName: user.lastName,
                phone: user.phone || '',
                role: user.role?._id || user.role || '',
                isActive: user.isActive,
                assignedSellers: user.assignedSellers?.map(s => s._id || s) || [],
                supervisors: user.supervisors?.map(s => s._id || s) || [],
                extraPermissions: user.extraPermissions?.map(p => p._id || p) || [],
                excludedPermissions: user.excludedPermissions?.map(p => p._id || p) || [],
            });
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

    const toggleSeller = (sellerId) => {
        setFormData(prev => ({
            ...prev,
            assignedSellers: prev.assignedSellers.includes(sellerId)
                ? prev.assignedSellers.filter(id => id !== sellerId)
                : [...prev.assignedSellers, sellerId]
        }));
    };

    const togglePermission = (permId) => {
        const isInherited = rolePermissionIds.includes(permId);

        setFormData(prev => {
            if (isInherited) {
                // Toggle exclusion for role-level permissions
                const isExcluded = prev.excludedPermissions.includes(permId);
                return {
                    ...prev,
                    excludedPermissions: isExcluded
                        ? prev.excludedPermissions.filter(id => id !== permId)
                        : [...prev.excludedPermissions, permId]
                };
            } else {
                // Toggle inclusion for extra permissions
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

    const handleSaveUser = async () => {
        try {
            if (editingUser) {
                await userApi.update(editingUser._id, formData);
            } else {
                await userApi.create(formData);
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
            console.error('Failed to delete user:', error);
            alert(error.message || 'Failed to delete user');
        }
    };

    const handleToggleUserStatus = async (userId) => {
        try {
            await userApi.toggleStatus(userId);
            loadUsers();
        } catch (error) {
            console.error('Failed to toggle user status:', error);
            alert(error.message || 'Failed to toggle user status');
        }
    };

    if (loading && users.length === 0) {
        return <PageLoader message="Loading Users..." />;
    }

    return (
        <>
            <div className="page-header">
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                    <div className="d-flex align-items-center gap-3">
                        <div className="p-2 bg-primary-subtle text-primary rounded-3">
                            <Users size={24} />
                        </div>
                        <div>
                            <h1 className="h4 fw-bold mb-0 text-dark">User Management</h1>
                            <p className="smallest text-muted mb-0">Manage platform access, roles, and permissions</p>
                        </div>
                    </div>
                    <div className="d-flex gap-2">
                        <Link to="/roles" className="btn btn-white fw-bold d-flex align-items-center gap-2 shadow-sm border">
                            <Shield size={16} />
                            Manage Roles
                        </Link>
                        <button className="btn btn-primary fw-bold d-flex align-items-center gap-2 shadow-sm" onClick={() => handleOpenUserModal()}>
                            <UserPlus size={16} />
                            Add New User
                        </button>
                    </div>
                </div>
            </div>

            <div className="page-content px-4 py-4" style={{ backgroundColor: '#f8fafc' }}>
                {/* Statistics or Quick Filters - Optional but good for Premium feel */}
                <div className="row g-3 mb-4">
                    <div className="col-md-3">
                        <div className="card border-0 shadow-sm p-3" style={{ borderRadius: '16px' }}>
                            <div className="d-flex align-items-center gap-3">
                                <div className="p-2 bg-blue-soft text-primary rounded-circle" style={{ backgroundColor: '#eff6ff' }}>
                                    <Users size={20} />
                                </div>
                                <div>
                                    <div className="smallest fw-bold text-muted text-uppercase">Total Users</div>
                                    <div className="h5 fw-bold mb-0">{pagination.total}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Add more metric cards if needed */}
                </div>

                {/* Filters Card */}
                <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '20px', overflow: 'hidden' }}>
                    <div className="card-body p-4">
                        <div className="row g-3 align-items-end">
                            <div className="col-md-5">
                                <label className="form-label smallest fw-bold text-muted text-uppercase mb-2">Search Directory</label>
                                <div className="input-group bg-light border-0 px-2 rounded-3" style={{ transition: 'all 0.2s' }}>
                                    <span className="input-group-text bg-transparent border-0 text-muted pe-1">
                                        <Search size={18} />
                                    </span>
                                    <input
                                        type="text"
                                        className="form-control bg-transparent border-0 shadow-none ps-1 fs-6"
                                        placeholder="Search by name, email or phone..."
                                        value={filters.search}
                                        onChange={(e) => handleFilterChange('search', e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="col-md-3">
                                <label className="form-label smallest fw-bold text-muted text-uppercase mb-2">Access Role</label>
                                <select
                                    className="form-select bg-light border-0 rounded-3 fs-6"
                                    value={filters.role}
                                    onChange={(e) => handleFilterChange('role', e.target.value)}
                                >
                                    <option value="">All Roles</option>
                                     {roles.map((role, idx) => (
                                         <option key={role._id || `role-filter-${idx}`} value={role._id}>{role.displayName}</option>
                                     ))}
                                </select>
                            </div>
                            <div className="col-md-3">
                                <label className="form-label smallest fw-bold text-muted text-uppercase mb-2">Status</label>
                                <select
                                    className="form-select bg-light border-0 rounded-3 fs-6"
                                    value={filters.isActive}
                                    onChange={(e) => handleFilterChange('isActive', e.target.value)}
                                >
                                    <option value="">All Accounts</option>
                                    <option value="true">Active Only</option>
                                    <option value="false">Inactive Only</option>
                                </select>
                            </div>
                            <div className="col-md-1">
                                <button
                                    className="btn btn-light w-100 border-0 rounded-3 d-flex align-items-center justify-content-center"
                                    style={{ height: '42px' }}
                                    onClick={() => setFilters({ search: '', role: '', isActive: '' })}
                                    title="Clear Filters"
                                >
                                    <XCircle size={20} className="text-muted" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Users List Card */}
                <div className="card border-0 shadow-sm" style={{ borderRadius: '20px', overflow: 'hidden' }}>
                    <div className="card-body p-0">
                        <ListView
                            columns={[
                                {
                                    label: 'Team Member',
                                    key: 'name',
                                    width: '30%',
                                    render: (_, user) => (
                                        <div className="d-flex align-items-center gap-3">
                                            <Link
                                                to={`/profile/${user._id}`}
                                                className="avatar d-flex align-items-center justify-content-center text-white fw-bold shadow-sm text-decoration-none"
                                                style={{
                                                    width: '36px',
                                                    height: '36px',
                                                    borderRadius: '10px',
                                                    background: user.role?.color ? `linear-gradient(135deg, ${user.role.color}, ${user.role.color}dd)` : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                                                    fontSize: '13px'
                                                }}
                                            >
                                                {user.firstName?.[0]}{user.lastName?.[0]}
                                            </Link>
                                            <div>
                                                <div className="fw-bold text-dark smallest">{user.firstName} {user.lastName}</div>
                                                <div className="smallest text-muted d-flex align-items-center gap-1" style={{ fontSize: '10px' }}>
                                                    <Phone size={10} />
                                                    {user.phone || 'No phone'}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                },
                                {
                                    label: 'Email Identity',
                                    key: 'email',
                                    width: '20%',
                                    render: (email) => (
                                        <div className="d-flex align-items-center gap-2 text-dark smallest">
                                            <Mail size={12} className="text-muted" />
                                            <span>{email}</span>
                                        </div>
                                    )
                                },
                                {
                                    label: 'Supervisors',
                                    key: 'supervisors',
                                    width: '15%',
                                    render: (supervisors) => (
                                        <div className="d-flex flex-wrap gap-1">
                                            {supervisors?.length > 0 ? (
                                                supervisors.map((s, idx) => (
                                                    <span key={s?._id || s?.id || `sup-${idx}`} className="smallest text-muted bg-light px-2 py-1 rounded" style={{ fontSize: '10px' }}>
                                                        {s?.firstName} {s?.lastName?.[0]}.
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="smallest text-muted opacity-50" style={{ fontSize: '10px' }}>None</span>
                                            )}
                                        </div>
                                    )
                                },
                                {
                                    label: 'Status',
                                    key: 'isActive',
                                    width: '12%',
                                    render: (isActive) => isActive ? (
                                        <span className="badge rounded-pill bg-success-subtle text-success px-2 py-1 d-inline-flex align-items-center gap-1 fw-bold" style={{ fontSize: '10px' }}>
                                            <CheckCircle2 size={10} /> Active
                                        </span>
                                    ) : (
                                        <span className="badge rounded-pill bg-danger-subtle text-danger px-2 py-1 d-inline-flex align-items-center gap-1 fw-bold" style={{ fontSize: '10px' }}>
                                            <XCircle size={10} /> Inactive
                                        </span>
                                    )
                                },
                                {
                                    label: 'Last Login',
                                    key: 'lastLogin',
                                    width: '13%',
                                    render: (val) => (
                                        <div className="text-muted smallest d-flex align-items-center gap-2" style={{ fontSize: '11px' }}>
                                            <Clock size={12} />
                                            {val ? new Date(val).toLocaleDateString() : 'Never'}
                                        </div>
                                    )
                                }
                            ]}
                            rows={users}
                            groupBy={(user) => user.role?.displayName || 'Standard User'}
                            rowKey="_id"
                            options={{ selectable: true }}
                            actions={(user) => (
                                <>
                                    <button className="btn btn-icon btn-white border shadow-sm btn-sm" onClick={() => handleOpenUserModal(user)} title="Edit">
                                        <Pencil size={12} />
                                    </button>
                                    <button
                                        className={`btn btn-icon border shadow-sm btn-sm ${user.isActive ? 'btn-white hover-warning' : 'btn-soft-success'}`}
                                        onClick={() => handleToggleUserStatus(user._id)}
                                        title={user.isActive ? 'Deactivate' : 'Restore'}
                                    >
                                        {user.isActive ? <Pause size={12} /> : <Play size={12} />}
                                    </button>
                                </>
                            )}
                            emptyMessage="No team members found"
                        />
                    </div>
                </div>

                {/* Pagination */}
                {pagination.pages > 1 && (
                    <div className="d-flex justify-content-center p-3 border-top">
                        <nav>
                            <ul className="pagination mb-0">
                                <li className={`page-item ${pagination.page === 1 ? 'disabled' : ''}`}>
                                    <button className="page-link" onClick={() => handlePageChange(pagination.page - 1)}>Previous</button>
                                </li>
                                {[...Array(pagination.pages)].map((_, idx) => (
                                    <li key={idx} className={`page-item ${pagination.page === idx + 1 ? 'active' : ''}`}>
                                        <button className="page-link" onClick={() => handlePageChange(idx + 1)}>{idx + 1}</button>
                                    </li>
                                ))}
                                <li className={`page-item ${pagination.page === pagination.pages ? 'disabled' : ''}`}>
                                    <button className="page-link" onClick={() => handlePageChange(pagination.page + 1)}>Next</button>
                                </li>
                            </ul>
                        </nav>
                    </div>
                )}
            </div>

            {/* User Modal */}
            {showModal && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(17, 24, 39, 0.7)', backdropFilter: 'blur(4px)' }}>
                    <div className="modal-dialog modal-dialog-centered modal-lg">
                        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '20px' }}>
                            <div className="modal-header border-0 px-4 pt-4 pb-0">
                                <h5 className="h5 fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                                    <div className="p-2 bg-primary-subtle text-primary rounded-3">
                                        {editingUser ? <Pencil size={20} /> : <UserPlus size={20} />}
                                    </div>
                                    {editingUser ? 'Edit Team Member' : 'Add New Member'}
                                </h5>
                                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
                            </div>
                            <div className="modal-body px-4 py-4">
                                <div className="row g-4">
                                    <div className="col-md-6">
                                        <label className="form-label smallest fw-bold text-muted text-uppercase mb-2">First Name</label>
                                        <input
                                            type="text"
                                            className="form-control form-control-lg bg-light border-0 px-3 fs-6"
                                            style={{ borderRadius: '12px' }}
                                            placeholder="e.g. John"
                                            value={formData.firstName}
                                            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label smallest fw-bold text-muted text-uppercase mb-2">Last Name</label>
                                        <input
                                            type="text"
                                            className="form-control form-control-lg bg-light border-0 px-3 fs-6"
                                            style={{ borderRadius: '12px' }}
                                            placeholder="e.g. Doe"
                                            value={formData.lastName}
                                            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label smallest fw-bold text-muted text-uppercase mb-2">Email Address</label>
                                        <div className="input-group bg-light border-0 rounded-3">
                                            <span className="input-group-text bg-transparent border-0 text-muted pe-1"><Mail size={16} /></span>
                                            <input
                                                type="email"
                                                className="form-control bg-transparent border-0 shadow-none ps-1 fs-6"
                                                placeholder="john.doe@example.com"
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                disabled={!!editingUser}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label smallest fw-bold text-muted text-uppercase mb-2">
                                            Access Password {!editingUser && <span className="text-primary">*</span>}
                                        </label>
                                        <input
                                            type="password"
                                            className="form-control form-control-lg bg-light border-0 px-3 fs-6"
                                            style={{ borderRadius: '12px' }}
                                            placeholder={editingUser ? "Leave blank to keep same" : "Secure password"}
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            required={!editingUser}
                                        />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label smallest fw-bold text-muted text-uppercase mb-2">Contact Number</label>
                                        <div className="input-group bg-light border-0 rounded-3">
                                            <span className="input-group-text bg-transparent border-0 text-muted pe-1"><Phone size={16} /></span>
                                            <input
                                                type="text"
                                                className="form-control bg-transparent border-0 shadow-none ps-1 fs-6"
                                                placeholder="+91 98765 43210"
                                                value={formData.phone}
                                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label smallest fw-bold text-muted text-uppercase mb-2">Assigned Role</label>
                                        <select
                                            className="form-select form-control-lg bg-light border-0 px-3 fs-6"
                                            style={{ borderRadius: '12px' }}
                                            value={formData.role}
                                            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                            required
                                        >
                                            <option value="">Select Level</option>
                                             {roles.map((role, idx) => (
                                                 <option key={role._id || `role-opt-${idx}`} value={role._id}>{role.displayName}</option>
                                             ))}
                                        </select>
                                    </div>

                                    {(() => {
                                        const selectedRoleObj = roles.find(r => r._id === formData.role);
                                        const isGlobalRole = selectedRoleObj && ['admin', 'operational_manager'].includes(selectedRoleObj.name);

                                        if (formData.role && !isGlobalRole) {
                                            return (
                                                <div className="col-12 mt-3">
                                                    <label className="form-label smallest fw-bold text-muted text-uppercase mb-3 d-flex align-items-center gap-2">
                                                        <Shield size={14} className="text-primary" />
                                                        Assigned Sellers (Data Access Control)
                                                    </label>
                                                    <div className="card shadow-none border-0 bg-light-subtle" style={{ borderRadius: '16px', backgroundColor: '#f9fafb' }}>
                                                        <div className="card-body p-3">
                                                            <div className="row g-2" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                                                {sellers.map((seller, idx) => (
                                                                    <div key={seller._id || `sell-opt-${idx}`} className="col-md-4 col-sm-6">
                                                                        <div
                                                                            className={`p-2 rounded-3 border transition-all cursor-pointer d-flex align-items-center gap-2 ${formData.assignedSellers.includes(seller._id) ? 'bg-primary-subtle border-primary-subtle' : 'bg-white border-light'}`}
                                                                            onClick={() => toggleSeller(seller._id)}
                                                                        >
                                                                            <input
                                                                                type="checkbox"
                                                                                className="form-check-input m-0 shadow-none border-0"
                                                                                checked={formData.assignedSellers.includes(seller._id)}
                                                                                onChange={(e) => {
                                                                                    e.stopPropagation();
                                                                                    toggleSeller(seller._id);
                                                                                }}
                                                                                style={{ width: '16px', height: '16px' }}
                                                                            />
                                                                            <span className="smallest fw-medium text-truncate" title={seller.name}>{seller.name}</span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <p className="smallest text-muted mt-2 mb-0">
                                                        <Info size={12} className="me-1" />
                                                        Non-admin users can only see data for their assigned sellers.
                                                    </p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}

                                    <div className="col-12 mt-3">
                                        <label className="form-label smallest fw-bold text-muted text-uppercase mb-3 d-flex align-items-center gap-2">
                                            <UserCheck size={14} className="text-primary" />
                                            Supervisors (Hierarchical Authorities)
                                        </label>
                                        <div className="card shadow-none border-0 bg-light-subtle" style={{ borderRadius: '16px', backgroundColor: '#f9fafb' }}>
                                            <div className="card-body p-3">
                                                <div className="row g-2" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                                    {users.filter(u => u._id !== editingUser?._id && (u.role?.level || 0) >= (formData.role ? roles.find(r => r._id === formData.role)?.level || 0 : 0)).map((u, idx) => (
                                                        <div key={u._id || `user-sup-${idx}`} className="col-md-4 col-sm-6">
                                                            <div
                                                                className={`p-2 rounded-3 border transition-all cursor-pointer d-flex align-items-center gap-2 ${formData.supervisors.includes(u._id) ? 'bg-primary-subtle border-primary-subtle' : 'bg-white border-light'}`}
                                                                onClick={() => {
                                                                    setFormData(prev => ({
                                                                        ...prev,
                                                                        supervisors: prev.supervisors.includes(u._id)
                                                                            ? prev.supervisors.filter(id => id !== u._id)
                                                                            : [...prev.supervisors, u._id]
                                                                    }));
                                                                }}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    className="form-check-input m-0 shadow-none border-0"
                                                                    checked={formData.supervisors.includes(u._id)}
                                                                    readOnly
                                                                    style={{ width: '16px', height: '16px' }}
                                                                />
                                                                <span className="smallest fw-medium text-truncate">{u.firstName} {u.lastName}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                {users.filter(u => u._id !== editingUser?._id && (u.role?.level || 0) >= (formData.role ? roles.find(r => r._id === formData.role)?.level || 0 : 0)).length === 0 && (
                                                    <div className="smallest text-muted py-2 text-center italic">No potential supervisors available for this role level.</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-12 mt-3">
                                        <label className="form-label smallest fw-bold text-muted text-uppercase mb-3 d-flex align-items-center gap-2">
                                            <Shield size={14} className="text-primary" />
                                            Extra Permissions (Beyond Role)
                                        </label>
                                        <div className="card shadow-none border-0 bg-light-subtle" style={{ borderRadius: '16px', backgroundColor: '#f9fafb' }}>
                                            <div className="card-body p-3">
                                                <div className="row g-2" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                                    {allPermissions.map((perm, idx) => {
                                                        const isInherited = rolePermissionIds.includes(perm._id);
                                                        const isExcluded = formData.excludedPermissions.includes(perm._id);
                                                        const isExtra = formData.extraPermissions.includes(perm._id);
                                                        const isActive = (isInherited && !isExcluded) || isExtra;

                                                        return (
                                                            <div key={perm._id || `perm-opt-${idx}`} className="col-md-4 col-sm-6">
                                                                <div
                                                                    className={`p-2 rounded-3 border transition-all d-flex align-items-center gap-2 cursor-pointer ${isActive ? 'bg-primary-subtle border-primary-subtle' : 'bg-white border-light'
                                                                        } ${isExcluded ? 'bg-danger-subtle border-danger-subtle opacity-75' : ''}`}
                                                                    onClick={() => togglePermission(perm._id)}
                                                                    title={isInherited ? (isExcluded ? 'Inherited but Excluded' : 'Granted by role') : 'Extra Permission'}
                                                                >
                                                                    <div className="position-relative d-flex align-items-center justify-content-center">
                                                                        <input
                                                                            type="checkbox"
                                                                            className="form-check-input m-0 shadow-none border-0"
                                                                            checked={isActive}
                                                                            readOnly
                                                                            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                                                        />
                                                                        {isInherited && !isExcluded && (
                                                                            <Shield size={8} className="text-primary position-absolute" style={{ pointerEvents: 'none' }} />
                                                                        )}
                                                                        {isExcluded && (
                                                                            <XCircle size={10} className="text-danger position-absolute" style={{ pointerEvents: 'none' }} />
                                                                        )}
                                                                    </div>
                                                                    <div className="d-flex flex-column overflow-hidden">
                                                                        <span className={`smallest fw-medium text-truncate ${isExcluded ? 'text-decoration-line-through text-danger' : ''}`}>
                                                                            {perm.displayName}
                                                                        </span>
                                                                        {isInherited && (
                                                                            <span className={`${isExcluded ? 'text-danger' : 'text-primary'} fw-bold`} style={{ fontSize: '8px', marginTop: '-2px', letterSpacing: '0.02em' }}>
                                                                                {isExcluded ? 'EXCLUDED' : 'ROLE LEVEL'}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                {allPermissions.length === 0 && (
                                                    <div className="smallest text-muted py-2 text-center">No extra permissions available.</div>
                                                )}
                                            </div>
                                        </div>
                                        <p className="smallest text-muted mt-2 mb-0">
                                            <Info size={12} className="me-1" />
                                            These permissions are added on top of the role permissions.
                                        </p>
                                    </div>
                                    <div className="col-12 mt-3">
                                        <label className="form-check-label smallest fw-bold text-muted text-uppercase order-0" htmlFor="isActive">Account Active</label>
                                        <input
                                            type="checkbox"
                                            className="form-check-input ms-auto shadow-none"
                                            id="isActive"
                                            style={{ width: '40px', height: '20px', cursor: 'pointer' }}
                                            checked={formData.isActive}
                                            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer border-0 px-4 pb-4 pt-0 gap-2">
                                <button type="button" className="btn btn-white fw-bold px-4" onClick={() => setShowModal(false)} style={{ borderRadius: '12px' }}>Discard</button>
                                <button type="button" className="btn btn-primary fw-bold px-4" onClick={handleSaveUser} style={{ borderRadius: '12px' }}>
                                    {editingUser ? 'Update Profile' : 'Create Account'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default UsersPage;