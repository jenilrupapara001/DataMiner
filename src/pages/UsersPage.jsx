import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { userApi, roleApi } from '../services/api';
import { useSocket } from '../contexts/SocketContext';
import {
    Users, Shield, UserPlus, Search, Pencil, Trash2, Mail, Phone,
    Clock, CheckCircle2, XCircle, Info, UserCheck, RefreshCw, X, Store, Check,
    ChevronDown, ChevronRight, SlidersHorizontal, Lock, Plus, ArrowRight, User, AlertCircle
} from 'lucide-react';
import { PageLoader } from '@/components/application/loading-indicator/PageLoader';

const UsersPage = () => {
    const socket = useSocket();

    // Tab Management
    const [activeTab, setActiveTab] = useState('users'); // 'users' or 'roles'

    // Core Data State
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [matrixRoles, setMatrixRoles] = useState([]);
    const [matrixSaving, setMatrixSaving] = useState(false);
    const [matrixSuccess, setMatrixSuccess] = useState(false);
    const [sellers, setSellers] = useState([]);
    const [managers, setManagers] = useState([]);
    const [groupedPermissions, setGroupedPermissions] = useState({});
    const [allPermissions, setAllPermissions] = useState([]);

    // Loading State
    const [loading, setLoading] = useState(true);

    // Filters and Pagination
    const [filters, setFilters] = useState({ search: '', role: '', isActive: '' });
    const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

    // Collapsible Categories in Matrix
    const [collapsedCategories, setCollapsedCategories] = useState({});

    // Search inside Permissions Matrix
    const [permissionSearch, setPermissionSearch] = useState('');

    // --- USER MODAL STATE ---
    const [showUserModal, setShowUserModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [userFormData, setUserFormData] = useState({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        phone: '',
        role: '',
        isActive: true,
        assignedSellers: [],
        brandManagers: [],
        supervisors: [],
    });
    const [modalSearchSupervisor, setModalSearchSupervisor] = useState('');
    const [modalSearchBrandManager, setModalSearchBrandManager] = useState('');
    const [modalSearchSeller, setModalSearchSeller] = useState('');

    // --- ROLE MODAL STATE ---
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [editingRole, setEditingRole] = useState(null);
    const [roleFormData, setRoleFormData] = useState({
        name: '',
        displayName: '',
        description: '',
        level: 30,
        color: '#4F46E5'
    });

    // --- CONDITIONALS FOR MEMBER MANAGEMENT ---
    const selectedRoleObj = roles.find(r => (r._id || r.id) === userFormData.role);
    const roleName = selectedRoleObj?.name?.toLowerCase() || '';
    const roleDisplayName = selectedRoleObj?.displayName?.toLowerCase() || '';
    const isListingTeam = roleName === 'listing_team' || roleDisplayName === 'listing team';
    const isCatalogManager = roleName === 'catalog_manager' || roleDisplayName === 'catalog manager' || roleName === 'catalogue_manager' || roleDisplayName === 'catalogue manager';
    const isBrandManager = roleName === 'brand_manager' || roleDisplayName === 'brand manager';

    const inheritedSellers = useMemo(() => {
        return sellers.filter(s => {
            return managers.some(m => {
                const isSelectedBM = userFormData.brandManagers.includes(m._id || m.id);
                if (!isSelectedBM) return false;
                const assignedSellersList = m.assignedSellers || [];
                return assignedSellersList.includes(s._id || s.id);
            });
        });
    }, [sellers, managers, userFormData.brandManagers]);

    // --- REFRESH / DATA FETCH ---
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
                 setPagination(prev => ({
                     ...prev,
                     total: response.data.pagination?.total || 0,
                     totalPages: response.data.pagination?.totalPages || response.data.pagination?.pages || 1
                 }));
             }
        } catch (error) {
            console.error('Failed to load users:', error);
        }
        setLoading(false);
    }, [pagination.page, pagination.limit, filters]);

    const loadRolesAndPerms = useCallback(async () => {
        try {
            const [rolesRes, permsRes] = await Promise.all([
                userApi.getRoles(),
                roleApi.getPermissions()
            ]);
            if (rolesRes.success) {
                const rolesData = rolesRes.data?.roles || rolesRes.data || [];
                const allowedRoleNames = ['admin', 'operational_manager', 'brand manager', 'catalog_manager', 'listing_team'];
                const filteredRoles = (Array.isArray(rolesData) ? rolesData : []).filter(r => 
                    allowedRoleNames.includes((r.name || r.displayName || '').toString().toLowerCase())
                );
                setRoles(filteredRoles);
                setMatrixRoles(JSON.parse(JSON.stringify(filteredRoles)));
            }
            if (permsRes.success) {
                setGroupedPermissions(permsRes.data?.groupedPermissions || {});
                setAllPermissions(permsRes.data?.permissions || []);
            }
        } catch (error) {
            console.error('Failed to load roles and permissions:', error);
        }
    }, []);

    const loadSellersAndManagers = useCallback(async () => {
        try {
            const [sellersRes, managersRes] = await Promise.all([
                userApi.getSellers(),
                userApi.getManagers()
            ]);
            const sellersData = sellersRes?.data?.sellers || sellersRes?.data || [];
            setSellers(Array.isArray(sellersData) ? sellersData : []);
            if (managersRes.success) {
                setManagers(managersRes.data || []);
            }
        } catch (error) {
            console.error('Failed to load sellers and managers:', error);
        }
    }, []);

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    useEffect(() => {
        loadRolesAndPerms();
        loadSellersAndManagers();
    }, [loadRolesAndPerms, loadSellersAndManagers]);

    useEffect(() => {
        if (!socket) return;
        socket.on('role_permissions_updated', (updatedRole) => {
            setRoles(prevRoles => prevRoles.map(role => 
                (role._id === updatedRole._id || role.id === updatedRole.id) ? updatedRole : role
            ));
        });
        return () => {
            socket.off('role_permissions_updated');
        };
    }, [socket]);

    // Filters Toggle
    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const resetFilters = () => {
        setFilters({ search: '', role: '', isActive: '' });
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    // Toggle User Status
    const handleToggleStatus = async (userId) => {
        try {
            await userApi.toggleStatus(userId);
            loadUsers();
        } catch (error) {
            console.error('Failed to toggle status:', error);
            alert(error.message || 'Failed to toggle status');
        }
    };

    // Delete User
    const handleDeleteUser = async (userId) => {
        if (!window.confirm('Are you sure you want to delete this user? This cannot be undone.')) return;
        try {
            await userApi.delete(userId);
            loadUsers();
        } catch (error) {
            console.error('Failed to delete user:', error);
            alert(error.message || 'Failed to delete user');
        }
    };

    // --- DYNAMIC USER MODAL ACTIONS ---
    const handleOpenUserModal = async (user = null) => {
        setModalSearchSupervisor('');
        setModalSearchBrandManager('');
        setModalSearchSeller('');
        if (user) {
            try {
                const response = await userApi.getById(user._id || user.id);
                const fullUser = response.data;
                setEditingUser(fullUser);
                setUserFormData({
                    email: fullUser.email || '',
                    password: '',
                    firstName: fullUser.firstName || '',
                    lastName: fullUser.lastName || '',
                    phone: fullUser.phone || '',
                    role: fullUser.role?._id || fullUser.role?.id || fullUser.role || '',
                    isActive: fullUser.isActive !== undefined ? fullUser.isActive : true,
                    assignedSellers: fullUser.assignedSellers?.map(s => s._id || s.id || s) || [],
                    brandManagers: fullUser.brandManagers?.map(s => s._id || s.id || s) || [],
                    supervisors: fullUser.supervisors?.map(s => s._id || s.id || s) || [],
                });
            } catch (error) {
                console.error('Failed to load full user details:', error);
                setEditingUser(user);
                setUserFormData({
                    email: user.email || '',
                    password: '',
                    firstName: user.firstName || '',
                    lastName: user.lastName || '',
                    phone: user.phone || '',
                    role: user.role?._id || user.role?.id || user.role || '',
                    isActive: user.isActive !== undefined ? user.isActive : true,
                    assignedSellers: user.assignedSellers?.map(s => s._id || s.id || s) || [],
                    brandManagers: user.brandManagers?.map(s => s._id || s.id || s) || [],
                    supervisors: user.supervisors?.map(s => s._id || s.id || s) || [],
                });
            }
        } else {
            setEditingUser(null);
            setUserFormData({
                email: '',
                password: '',
                firstName: '',
                lastName: '',
                phone: '',
                role: '',
                isActive: true,
                assignedSellers: [],
                brandManagers: [],
                supervisors: [],
            });
        }
        setShowUserModal(true);
    };

    // Reactive role selection handler in User Creation Modal
    const handleUserRoleChange = (roleId) => {
        const selectedRole = roles.find(r => r._id === roleId || r.id === roleId);
        const isBM = selectedRole?.name === 'brand_manager' || selectedRole?.displayName === 'Brand Manager';
        const isLT = selectedRole?.name === 'listing_team' || selectedRole?.displayName === 'Listing Team';

        setUserFormData(prev => ({
            ...prev,
            role: roleId,
            assignedSellers: isBM ? sellers.map(s => s._id || s.id) : prev.assignedSellers,
            brandManagers: prev.brandManagers
        }));
    };

    const handleSaveUser = async () => {
        if (!userFormData.firstName || !userFormData.lastName || !userFormData.email || !userFormData.role) {
            alert('Please fill in all required fields (First Name, Last Name, Email, and Access Role).');
            return;
        }
        try {
            const selectedRole = roles.find(r => r._id === userFormData.role || r.id === userFormData.role);
            const roleName = selectedRole?.name?.toLowerCase() || '';
            const roleDisplayName = selectedRole?.displayName?.toLowerCase() || '';
            const isListingTeam = roleName === 'listing_team' || roleDisplayName === 'listing team';
            const isCatalogManager = roleName === 'catalog_manager' || roleDisplayName === 'catalog manager' || roleName === 'catalogue_manager' || roleDisplayName === 'catalogue manager';

            let finalSellers = userFormData.assignedSellers;
            if (isListingTeam) {
                const inheritedIds = [];
                sellers.forEach(s => {
                    const isInherited = managers.some(m => {
                        const isSelectedBM = userFormData.brandManagers.includes(m._id || m.id);
                        if (!isSelectedBM) return false;
                        const assignedSellersList = m.assignedSellers || [];
                        return assignedSellersList.includes(s._id || s.id);
                    });
                    if (isInherited) {
                        inheritedIds.push(s._id || s.id);
                    }
                });
                finalSellers = inheritedIds;
            }

            const data = {
                ...userFormData,
                roleId: userFormData.role,
                assignedSellerIds: finalSellers,
                brandManagers: userFormData.brandManagers,
                supervisors: userFormData.supervisors
            };

            if (editingUser) {
                await userApi.update(editingUser._id || editingUser.id, data);
            } else {
                await userApi.create(data);
            }
            setShowUserModal(false);
            loadUsers();
        } catch (error) {
            console.error('Failed to save user:', error);
            alert(error.message || 'Failed to save user');
        }
    };

    // --- DYNAMIC ROLES & PERMISSIONS GRID ACTIONS ---
    const handleToggleCellPermission = (roleId, permId) => {
        setMatrixRoles(prevRoles => prevRoles.map(r => {
            if ((r._id || r.id) === roleId) {
                const rolePermIds = r.permissions?.map(p => p._id || p.id || p) || [];
                const isAssigned = rolePermIds.includes(permId);
                const updatedPermIds = isAssigned
                    ? rolePermIds.filter(id => id !== permId)
                    : [...rolePermIds, permId];
                
                const updatedPermsObjects = updatedPermIds.map(id => {
                    const found = allPermissions.find(p => p._id === id || p.id === id);
                    return found || { id, _id: id };
                });
                return { ...r, permissions: updatedPermsObjects };
            }
            return r;
        }));
    };

    const handleSaveMatrixPermissions = async () => {
        setMatrixSaving(true);
        setMatrixSuccess(false);
        try {
            for (const r of matrixRoles) {
                const updatedPermIds = r.permissions?.map(p => p._id || p.id || p) || [];
                await roleApi.update(r._id || r.id, { permissions: updatedPermIds });
                if (socket) {
                    socket.emit('update_role_permissions', { roleId: r._id || r.id, permissions: updatedPermIds });
                }
            }
            setMatrixSuccess(true);
            setTimeout(() => setMatrixSuccess(false), 4000);
            await loadRolesAndPerms();
        } catch (error) {
            console.error('Failed to sync matrix permissions:', error);
            alert(error.message || 'Failed to sync permissions');
        } finally {
            setMatrixSaving(false);
        }
    };

    const handleOpenRoleModal = (role = null) => {
        if (role) {
            setEditingRole(role);
            setRoleFormData({
                name: role.name || '',
                displayName: role.displayName || '',
                description: role.description || '',
                level: role.level || 30,
                color: role.color || '#4F46E5'
            });
        } else {
            setEditingRole(null);
            setRoleFormData({
                name: '',
                displayName: '',
                description: '',
                level: 30,
                color: '#4F46E5'
            });
        }
        setShowRoleModal(true);
    };

    const handleSaveRole = async () => {
        if (!roleFormData.displayName) {
            alert('Please specify a Display Name for this role.');
            return;
        }
        try {
            const nameSlug = roleFormData.name || roleFormData.displayName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
            const data = {
                ...roleFormData,
                name: nameSlug
            };

            if (editingRole) {
                await roleApi.update(editingRole._id || editingRole.id, data);
            } else {
                await roleApi.create(data);
            }
            setShowRoleModal(false);
            loadRolesAndPerms();
        } catch (error) {
            console.error('Failed to save role:', error);
            alert(error.message || 'Failed to save role');
        }
    };

    const handleDeleteRole = async (roleId) => {
        if (!window.confirm('Are you sure you want to delete this role? Users assigned to this role will lose access.')) return;
        try {
            await roleApi.delete(roleId);
            setShowRoleModal(false);
            loadRolesAndPerms();
        } catch (error) {
            console.error('Failed to delete role:', error);
            alert(error.message || 'Failed to delete role');
        }
    };

    const toggleCategoryCollapse = (category) => {
        setCollapsedCategories(prev => ({
            ...prev,
            [category]: !prev[category]
        }));
    };

    // Filter permissions by search query
    const filteredGroupedPermissions = useMemo(() => {
        if (!permissionSearch) return groupedPermissions;
        const result = {};
        Object.entries(groupedPermissions).forEach(([category, perms]) => {
            const filtered = perms.filter(p => 
                p.displayName?.toLowerCase().includes(permissionSearch.toLowerCase()) ||
                p.name?.toLowerCase().includes(permissionSearch.toLowerCase())
            );
            if (filtered.length > 0) {
                result[category] = filtered;
            }
        });
        return result;
    }, [groupedPermissions, permissionSearch]);

    // Helpers to render Initials for Avatars
    const renderInitials = (firstName, lastName) => {
        const f = firstName ? firstName[0].toUpperCase() : '';
        const l = lastName ? lastName[0].toUpperCase() : '';
        return `${f}${l}` || 'U';
    };

    return (
        <div className="users-container p-4 min-vh-100" style={{ backgroundColor: '#f8fafc', fontFamily: "'Inter', sans-serif" }}>
            <style>{`
                /* Beautiful glassmorphism effects and modern styling */
                .glass-card {
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 16px;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.025);
                    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .glass-card:hover {
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.02);
                }
                .nav-tab-btn {
                    border: none;
                    background: transparent;
                    padding: 10px 20px;
                    font-size: 14px;
                    font-weight: 600;
                    color: #64748b;
                    position: relative;
                    transition: all 0.2s;
                }
                .nav-tab-btn.active {
                    color: #1e293b;
                }
                .nav-tab-btn.active::after {
                    content: '';
                    position: absolute;
                    bottom: 0;
                    left: 20px;
                    right: 20px;
                    height: 3px;
                    background: #0f172a;
                    border-radius: 10px;
                }
                .table-modern th {
                    font-weight: 600;
                    font-size: 12px;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: #64748b;
                    background-color: #f8fafc;
                    border-bottom: 1px solid #e2e8f0;
                    padding: 16px 20px;
                }
                .table-modern td {
                    padding: 16px 20px;
                    vertical-align: middle;
                    border-bottom: 1px solid #f1f5f9;
                    font-size: 14px;
                    color: #334155;
                }
                .table-modern tr:hover td {
                    background-color: #f8fafc;
                }
                .badge-role {
                    font-size: 11px;
                    font-weight: 600;
                    padding: 4px 10px;
                    border-radius: 9999px;
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                }
                .avatar-circle {
                    width: 38px;
                    height: 38px;
                    border-radius: 9999px;
                    font-weight: 700;
                    font-size: 13px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .btn-icon-modern {
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 1px solid #e2e8f0;
                    background: #ffffff;
                    color: #64748b;
                    transition: all 0.15s;
                }
                .btn-icon-modern:hover {
                    background: #f1f5f9;
                    color: #0f172a;
                    border-color: #cbd5e1;
                }
                .btn-icon-modern.text-danger:hover {
                    background: #fef2f2;
                    color: #ef4444;
                    border-color: #fca5a5;
                }
                .status-toggle {
                    width: 36px;
                    height: 20px;
                    border-radius: 10px;
                    background: #cbd5e1;
                    position: relative;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .status-toggle.active {
                    background: #10b981;
                }
                .status-toggle-circle {
                    width: 14px;
                    height: 14px;
                    border-radius: 50%;
                    background: white;
                    position: absolute;
                    top: 3px;
                    left: 3px;
                    transition: all 0.2s;
                }
                .status-toggle.active .status-toggle-circle {
                    left: 19px;
                }
                .matrix-cell-cb {
                    width: 18px;
                    height: 18px;
                    border-radius: 4px;
                    cursor: pointer;
                    accent-color: #0f172a;
                }
                .perm-cat-header {
                    background-color: #f1f5f9 !important;
                    cursor: pointer;
                    user-select: none;
                }
                .perm-cat-header:hover {
                    background-color: #e2e8f0 !important;
                }
                .pill-btn {
                    border: 1px solid #e2e8f0;
                    background: white;
                    padding: 6px 12px;
                    border-radius: 8px;
                    font-size: 13px;
                    font-weight: 500;
                    color: #475569;
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .pill-btn:hover {
                    background: #f8fafc;
                    border-color: #cbd5e1;
                }
                .pill-btn.active {
                    background: #0f172a;
                    color: white;
                    border-color: #0f172a;
                }
                .role-row-name:hover .role-actions-hover {
                    opacity: 1 !important;
                }
            `}</style>

            {/* Header Section */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4 gap-3">
                <div>
                    <h3 className="fw-bold text-slate-900 mb-1 d-flex align-items-center gap-2">
                        <Users size={24} className="text-slate-700" /> Team & Permissions
                    </h3>
                    <p className="text-muted mb-0 small">Control access levels and assign roles to your team.</p>
                </div>
                <div className="d-flex gap-2">
                    <button className="btn btn-white border glass-card d-flex align-items-center gap-2 px-3 py-2 fw-semibold" style={{ fontSize: '13px' }} onClick={() => loadUsers()}>
                        <RefreshCw size={14} /> Refresh Data
                    </button>
                    {activeTab === 'users' ? (
                        <button className="btn btn-dark d-flex align-items-center gap-2 px-4 py-2 fw-bold rounded-3 shadow" onClick={() => handleOpenUserModal()}>
                            <UserPlus size={16} /> Add Member
                        </button>
                    ) : (
                        <button className="btn btn-dark d-flex align-items-center gap-2 px-4 py-2 fw-bold rounded-3 shadow" onClick={() => handleOpenRoleModal()}>
                            <Plus size={16} /> Create Role
                        </button>
                    )}
                </div>
            </div>

            {/* Tabbed Navigation */}
            <div className="border-bottom mb-4 d-flex align-items-center justify-content-between">
                <div className="d-flex">
                    <button className={`nav-tab-btn ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
                        👥 Members & Teams
                    </button>
                    <button className={`nav-tab-btn ${activeTab === 'roles' ? 'active' : ''}`} onClick={() => setActiveTab('roles')}>
                        🔒 Roles & Permissions Grid
                    </button>
                </div>
            </div>

            {/* Loading Indicator */}
            {loading && users.length === 0 && <PageLoader message="Loading workspace components..." />}

            {/* TAB 1: MEMBERS */}
            {activeTab === 'users' && (
                <>
                    {/* Filters Header */}
                    <div className="glass-card bg-white p-3 mb-4 border-0">
                        <div className="row g-3 align-items-center">
                            <div className="col-md-5">
                                <div className="position-relative">
                                    <Search size={16} className="position-absolute top-50 start-0 translate-middle-y ms-3 text-muted" />
                                    <input 
                                        type="text" 
                                        className="form-control ps-5 border-0 bg-light" 
                                        style={{ height: '42px', borderRadius: '10px', fontSize: '14px' }}
                                        placeholder="Search by name, email..." 
                                        value={filters.search}
                                        onChange={(e) => handleFilterChange('search', e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="col-md-3">
                                <select 
                                    className="form-select border-0 bg-light"
                                    style={{ height: '42px', borderRadius: '10px', fontSize: '14px', cursor: 'pointer' }}
                                    value={filters.role}
                                    onChange={(e) => handleFilterChange('role', e.target.value)}
                                >
                                    <option value="">All Access Roles</option>
                                    {roles.map(r => <option key={r._id || r.id} value={r.name || r.id}>{r.displayName}</option>)}
                                </select>
                            </div>
                            <div className="col-md-3">
                                <select 
                                    className="form-select border-0 bg-light"
                                    style={{ height: '42px', borderRadius: '10px', fontSize: '14px', cursor: 'pointer' }}
                                    value={filters.isActive}
                                    onChange={(e) => handleFilterChange('isActive', e.target.value)}
                                >
                                    <option value="">All Statuses</option>
                                    <option value="true">Active</option>
                                    <option value="false">Inactive</option>
                                </select>
                            </div>
                            <div className="col-md-1">
                                <button className="btn btn-light w-100 d-flex align-items-center justify-content-center" style={{ height: '42px', borderRadius: '10px' }} onClick={resetFilters} title="Clear Filters">
                                    <X size={18} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Table View */}
                    <div className="glass-card bg-white border-0 overflow-hidden">
                        <div className="table-responsive">
                            <table className="table table-modern mb-0 align-middle">
                                <thead>
                                    <tr>
                                        <th style={{ width: '40px' }}><input type="checkbox" className="form-check-input" /></th>
                                        <th>Member Name</th>
                                        <th>Access Role</th>
                                        <th>Supervisors (Managers)</th>
                                        <th>Status</th>
                                        <th className="text-end">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.length > 0 ? (
                                        users.map((user) => {
                                            const roleColor = user.role?.color || '#64748b';
                                            const initials = renderInitials(user.firstName, user.lastName);
                                            return (
                                                <tr key={user._id || user.id}>
                                                    <td><input type="checkbox" className="form-check-input" /></td>
                                                    <td>
                                                        <div className="d-flex align-items-center gap-3">
                                                            <div className="avatar-circle" style={{ backgroundColor: `${roleColor}15`, color: roleColor }}>
                                                                {initials}
                                                            </div>
                                                            <div>
                                                                <div className="fw-bold text-slate-800" style={{ fontSize: '14px' }}>
                                                                    {user.firstName} {user.lastName}
                                                                </div>
                                                                <div className="text-muted d-flex align-items-center gap-3 mt-0.5" style={{ fontSize: '12px' }}>
                                                                    <span className="d-flex align-items-center gap-1"><Mail size={12} /> {user.email}</span>
                                                                    {user.phone && <span className="d-flex align-items-center gap-1"><Phone size={12} /> {user.phone}</span>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className="badge rounded-pill px-2.5 py-1 text-white fw-bold d-inline-flex align-items-center gap-1.5 shadow-sm" style={{ backgroundColor: roleColor, fontSize: '11px' }}>
                                                            <Shield size={11} /> {user.role?.displayName || 'Custom Role'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div className="d-flex flex-wrap gap-1 align-items-center">
                                                            {user.supervisors && user.supervisors.length > 0 ? (
                                                                user.supervisors.map((s, idx) => (
                                                                    <span key={idx} className="badge bg-light text-slate-700 border px-2 py-1 rounded-pill d-flex align-items-center gap-1.5" style={{ fontSize: '11px', fontWeight: '500' }}>
                                                                        <div className="avatar-circle" style={{ width: '16px', height: '16px', fontSize: '8px', backgroundColor: '#e2e8f0', color: '#475569' }}>
                                                                            {renderInitials(s.firstName, s.lastName)}
                                                                        </div>
                                                                        {s.firstName} {s.lastName ? s.lastName.charAt(0) + '.' : ''}
                                                                    </span>
                                                                ))
                                                            ) : (
                                                                <span className="text-muted" style={{ fontSize: '12px' }}>-</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="d-flex align-items-center gap-2">
                                                            <div className={`status-toggle ${user.isActive ? 'active' : ''}`} onClick={() => handleToggleStatus(user._id || user.id)}>
                                                                <div className="status-toggle-circle"></div>
                                                            </div>
                                                            <span className="small fw-semibold" style={{ color: user.isActive ? '#10b981' : '#64748b', fontSize: '12px' }}>
                                                                {user.isActive ? 'Active' : 'Inactive'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="d-flex gap-1 justify-content-end">
                                                            <button className="btn-icon-modern" onClick={() => handleOpenUserModal(user)} title="Edit Member">
                                                                <Pencil size={14} />
                                                            </button>
                                                            <button className="btn-icon-modern text-danger" onClick={() => handleDeleteUser(user._id || user.id)} title="Delete Member">
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan="6" className="text-center py-5">
                                                <Users size={32} className="text-muted mb-2 mx-auto" />
                                                <p className="mb-0 text-muted small">No organization members found matching criteria.</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Footer */}
                        {pagination.total > 0 && (
                            <div className="d-flex justify-content-between align-items-center px-4 py-3 border-top bg-light">
                                <span className="text-muted small">Showing {users.length} of {pagination.total} users (Page {pagination.page} of {pagination.totalPages})</span>
                                <div className="btn-group">
                                    <button className="btn btn-sm btn-white border px-3" disabled={pagination.page === 1} onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}>
                                        Previous
                                    </button>
                                    <button className="btn btn-sm btn-white border px-3" disabled={pagination.page === pagination.totalPages} onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}>
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* TAB 2: ROLES & PERMISSIONS MATRIX */}
            {activeTab === 'roles' && (
                <>
                    {/* Matrix Actions */}
                    <div className="glass-card bg-white p-3 mb-4 border-0 d-flex flex-column flex-md-row justify-content-between align-items-stretch align-items-md-center gap-3">
                        <div className="position-relative flex-grow-1" style={{ maxWidth: '400px' }}>
                            <Search size={16} className="position-absolute top-50 start-0 translate-middle-y ms-3 text-muted" />
                            <input 
                                type="text" 
                                className="form-control ps-5 border-0 bg-light" 
                                style={{ height: '40px', borderRadius: '10px', fontSize: '13px' }}
                                placeholder="Filter permissions by name..." 
                                value={permissionSearch}
                                onChange={(e) => setPermissionSearch(e.target.value)}
                            />
                        </div>
                        <div className="d-flex flex-wrap align-items-center gap-3 justify-content-end">
                            <span className="small text-slate-500 font-monospace">{matrixRoles.length} Active Roles Configured</span>
                            
                            <button 
                                className="btn btn-sm d-flex align-items-center gap-2 fw-bold text-white px-4 py-2" 
                                style={{ 
                                    backgroundColor: '#10b981', 
                                    border: 'none', 
                                    borderRadius: '10px', 
                                    boxShadow: '0 4px 12px rgba(16,185,129,0.2)',
                                    transition: 'all 0.2s' 
                                }}
                                onClick={handleSaveMatrixPermissions}
                                disabled={matrixSaving}
                            >
                                <RefreshCw size={14} className={matrixSaving ? 'spin' : ''} /> 
                                {matrixSaving ? 'Saving & Direct Applying...' : 'Apply & Sync to Database'}
                            </button>

                            <button className="btn btn-dark btn-sm rounded-3 px-3 py-2 d-flex align-items-center gap-1.5 fw-bold" onClick={() => handleOpenRoleModal()}>
                                <Plus size={14} /> Add Custom Role
                            </button>
                        </div>
                    </div>

                    {matrixSuccess && (
                        <div className="alert alert-success d-flex align-items-center gap-3 p-3.5 mb-4 shadow-sm" style={{ borderRadius: 12, background: '#ecfdf5', border: '1px solid #10b981' }}>
                            <CheckCircle2 size={20} style={{ color: '#059669' }} />
                            <div>
                                <h6 className="fw-bold mb-0.5" style={{ color: '#065f46', fontSize: '13.5px' }}>Direct Matrix Applied Successfully!</h6>
                                <p className="mb-0 small" style={{ color: '#047857', fontSize: '12px' }}>All permissions have been directly saved in the database and instantly applied across all system components.</p>
                            </div>
                        </div>
                    )}

                    {/* Permission Category Blocks (Taskora UI Grid) */}
                    <div className="d-flex flex-column gap-4">
                        {Object.entries(filteredGroupedPermissions).map(([category, perms]) => (
                            <div key={category} className="glass-card bg-white border-0 overflow-hidden shadow-sm" style={{ borderRadius: '14px' }}>
                                <div className="table-responsive">
                                    <table className="table mb-0 align-middle">
                                        <thead>
                                            <tr style={{ backgroundColor: '#fcfdfe', borderBottom: '1.5px solid #f1f5f9' }}>
                                                <th style={{ width: '280px', padding: '16px 24px', fontSize: '14px', fontWeight: '700', color: '#1e293b', textTransform: 'capitalize' }}>
                                                    {category}
                                                </th>
                                                {perms.map((perm) => (
                                                    <th key={perm._id || perm.id} className="text-center" style={{ padding: '16px', fontSize: '12.5px', fontWeight: '600', color: '#475569', minWidth: '130px' }}>
                                                        {perm.displayName}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {matrixRoles.map((role) => {
                                                const roleColor = role.color || '#4F46E5';
                                                const rolePermIds = role.permissions?.map(p => p._id || p.id || p) || [];
                                                return (
                                                    <tr key={role._id || role.id} className="role-matrix-row" style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                        <td style={{ padding: '16px 24px', fontWeight: '600', fontSize: '13.5px', color: '#334155' }} className="position-relative role-row-name">
                                                            <div className="d-flex align-items-center justify-content-between">
                                                                <div className="d-flex align-items-center gap-2">
                                                                    <div className="avatar-circle" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: roleColor }}></div>
                                                                    <span>{role.displayName}</span>
                                                                </div>
                                                                <div className="role-actions-hover d-flex gap-2 opacity-0 transition-all">
                                                                    <button className="btn btn-link p-0 text-decoration-none text-slate-400 hover-dark" onClick={() => handleOpenRoleModal(role)} title="Edit Role">
                                                                        <Pencil size={12} />
                                                                    </button>
                                                                    {role.name !== 'super_admin' && (
                                                                        <button className="btn btn-link p-0 text-decoration-none text-danger" onClick={() => handleDeleteRole(role._id || role.id)} title="Delete Role">
                                                                            <Trash2 size={12} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        {perms.map((perm) => {
                                                            const isAssigned = rolePermIds.includes(perm._id || perm.id);
                                                            const isOperationalManager = (role.name || '').toLowerCase() === 'operational_manager' || (role.displayName || '').toLowerCase() === 'operational manager';
                                                            const isRestrictedForOpManager = isOperationalManager && [
                                                                'settings_manage', 'apikeys_manage', 'users_view', 'users_manage', 'roles_view', 'roles_manage'
                                                            ].includes(perm.name || perm.id || perm._id);

                                                            return (
                                                                <td key={perm._id || perm.id} className="text-center" style={{ padding: '16px' }}>
                                                                    <div className="d-flex justify-content-center">
                                                                        {isRestrictedForOpManager ? (
                                                                            <span 
                                                                                className="badge text-uppercase fw-bold bg-danger" 
                                                                                style={{ fontSize: 10, padding: '4px 8px', borderRadius: 6, cursor: 'not-allowed', backgroundColor: '#ef4444' }}
                                                                                title="System/User settings restricted for Operational Manager"
                                                                            >
                                                                                Restricted
                                                                            </span>
                                                                        ) : (
                                                                            <div 
                                                                                className="d-inline-flex align-items-center justify-content-center cursor-pointer transition-all"
                                                                                style={{ 
                                                                                    width: '20px', 
                                                                                    height: '20px', 
                                                                                    borderRadius: '6px', 
                                                                                    border: isAssigned ? '1.5px solid #10b981' : '1.5px solid #cbd5e1', 
                                                                                    backgroundColor: isAssigned ? '#10b981' : 'transparent',
                                                                                    boxShadow: isAssigned ? '0 2px 4px rgba(16, 185, 129, 0.2)' : 'none',
                                                                                    transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)'
                                                                                }}
                                                                                onClick={() => handleToggleCellPermission(role._id || role.id, perm._id || perm.id)}
                                                                            >
                                                                                {isAssigned && <Check size={12} strokeWidth={3} className="text-white" />}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* ===== DYNAMIC CREATE / EDIT MEMBER MODAL ===== */}
            {showUserModal && (
                    <div 
                        className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" 
                        style={{ backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)', zIndex: 1050 }}
                        onClick={(e) => { if (e.target === e.currentTarget) setShowUserModal(false); }}
                    >
                        <div 
                            className="bg-white shadow-2xl overflow-hidden"
                            style={{ width: '95%', maxWidth: '780px', maxHeight: '90vh', borderRadius: '24px', display: 'flex', flexDirection: 'column', border: '1px solid #e2e8f0' }}
                        >
                            {/* Header */}
                            <div className="px-4 py-3.5 border-bottom d-flex justify-content-between align-items-center bg-light">
                                <div className="d-flex align-items-center gap-3">
                                <div className="p-2 bg-white text-primary rounded-3 shadow-sm border">
                                    <UserCheck size={20} className="text-indigo-600" />
                                </div>
                                <div>
                                    <h5 className="mb-0 fw-bold text-slate-900" style={{ letterSpacing: '-0.02em' }}>
                                        {editingUser ? 'Edit Organization Member' : 'Add New Member'}
                                    </h5>
                                    <p className="text-muted small mb-0" style={{ fontSize: '11.5px' }}>
                                        {editingUser ? 'Modify member profile, assigned supervisors, and brand associations' : 'Register a new member, select access roles, and assign permissions'}
                                    </p>
                                </div>
                            </div>
                            <button className="btn btn-link p-1 text-slate-400 border-0 hover-dark" onClick={() => setShowUserModal(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Scrollable Form Body */}
                        <div className="flex-grow-1 overflow-auto p-4 bg-slate-50/50">
                            <div className="d-flex flex-column gap-4">
                                
                                {/* BASIC DETAILS */}
                                <div className="bg-white p-4 rounded-4 border shadow-sm">
                                    <div className="d-flex align-items-center gap-2 fw-bold text-slate-800 mb-3 small text-uppercase" style={{ letterSpacing: '0.05em' }}>
                                        <User size={14} className="text-muted" /> Basic Information
                                    </div>
                                    <div className="row g-3">
                                        <div className="col-md-6">
                                            <label className="form-label text-slate-600 small fw-semibold">First Name *</label>
                                            <input 
                                                type="text" 
                                                className="form-control rounded-3 border-slate-200" 
                                                placeholder="John" 
                                                value={userFormData.firstName}
                                                onChange={(e) => setUserFormData(prev => ({ ...prev, firstName: e.target.value }))}
                                            />
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label text-slate-600 small fw-semibold">Last Name *</label>
                                            <input 
                                                type="text" 
                                                className="form-control rounded-3 border-slate-200" 
                                                placeholder="Doe" 
                                                value={userFormData.lastName}
                                                onChange={(e) => setUserFormData(prev => ({ ...prev, lastName: e.target.value }))}
                                            />
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label text-slate-600 small fw-semibold">Email Address *</label>
                                            <input 
                                                type="email" 
                                                className="form-control rounded-3 border-slate-200" 
                                                placeholder="john@retailops.com" 
                                                value={userFormData.email}
                                                onChange={(e) => setUserFormData(prev => ({ ...prev, email: e.target.value }))}
                                                disabled={!!editingUser}
                                            />
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label text-slate-600 small fw-semibold">Phone Number</label>
                                            <input 
                                                type="text" 
                                                className="form-control rounded-3 border-slate-200" 
                                                placeholder="+1 (555) 123-4567" 
                                                value={userFormData.phone}
                                                onChange={(e) => setUserFormData(prev => ({ ...prev, phone: e.target.value }))}
                                            />
                                        </div>
                                        {!editingUser && (
                                            <div className="col-md-12">
                                                <label className="form-label text-slate-600 small fw-semibold">Temporary Password *</label>
                                                <input 
                                                    type="password" 
                                                    className="form-control rounded-3 border-slate-200" 
                                                    placeholder="Must be at least 6 characters" 
                                                    value={userFormData.password}
                                                    onChange={(e) => setUserFormData(prev => ({ ...prev, password: e.target.value }))}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* ROLE AND SCHEMES */}
                                <div className="bg-white p-4 rounded-4 border shadow-sm">
                                    <div className="d-flex align-items-center gap-2 fw-bold text-slate-800 mb-3 small text-uppercase" style={{ letterSpacing: '0.05em' }}>
                                        <Shield size={14} className="text-muted" /> Access & Permission Level
                                    </div>
                                    <div className="row g-3">
                                        <div className="col-md-12">
                                            <label className="form-label text-slate-600 small fw-semibold">Access Role *</label>
                                            <select 
                                                className="form-select rounded-3 border-slate-200" 
                                                value={userFormData.role}
                                                onChange={(e) => handleUserRoleChange(e.target.value)}
                                            >
                                                <option value="">Select Role</option>
                                                {roles.map(r => <option key={r._id || r.id} value={r._id || r.id}>{r.displayName}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/***** SUPERVISORS SELECTION PANEL *****/}
                                {!isBrandManager && (
                                    <div className="bg-white p-4 rounded-4 border shadow-sm">
                                        <div className="d-flex align-items-center justify-content-between mb-3">
                                            <div className="d-flex align-items-center gap-2 fw-bold text-slate-800 small text-uppercase" style={{ letterSpacing: '0.05em' }}>
                                                <UserCheck size={14} className="text-indigo-500" /> Supervisors (Super Admins, Operational Managers, etc.)
                                            </div>
                                            <span className="badge rounded-pill px-2.5 py-1 fw-bold text-white shadow-sm" style={{ fontSize: '11px', backgroundColor: '#4f46e5' }}>
                                                {userFormData.supervisors.length} Selected
                                            </span>
                                        </div>

                                        {/* Panel Actions */}
                                        <div className="d-flex gap-2 mb-3">
                                            <div className="position-relative flex-grow-1">
                                                <Search size={14} className="position-absolute top-50 start-0 translate-middle-y ms-2.5 text-muted" />
                                                <input 
                                                    type="text" 
                                                    className="form-control form-control-sm ps-5 rounded-3 border-slate-200" 
                                                    style={{ fontSize: '12px' }}
                                                    placeholder="Search supervisors..." 
                                                    value={modalSearchSupervisor}
                                                    onChange={(e) => setModalSearchSupervisor(e.target.value)}
                                                />
                                            </div>
                                            <button 
                                                type="button" 
                                                className="btn btn-sm btn-light border rounded-3 text-slate-600 px-3 hover-slate-100 smallest fw-bold"
                                                onClick={() => {
                                                    const allIds = managers.map(m => m._id || m.id);
                                                    setUserFormData(prev => ({ ...prev, supervisors: allIds }));
                                                }}
                                            >
                                                Select All
                                            </button>
                                            <button 
                                                type="button" 
                                                className="btn btn-sm btn-light border rounded-3 text-slate-600 px-3 hover-slate-100 smallest fw-bold"
                                                onClick={() => setUserFormData(prev => ({ ...prev, supervisors: [] }))}
                                            >
                                                Clear
                                            </button>
                                        </div>

                                        {/* Supervisors List Grid */}
                                        <div className="border rounded-3 bg-slate-50/50 p-2.5" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                                            <div className="row g-2">
                                                {(() => {
                                                    const filtered = managers.filter(m => 
                                                        `${m.firstName} ${m.lastName} ${m.email}`.toLowerCase().includes(modalSearchSupervisor.toLowerCase())
                                                    );
                                                    if (filtered.length === 0) {
                                                        return (
                                                            <div className="col-12 py-4 text-center text-muted small">
                                                                No supervisors found matching "{modalSearchSupervisor}"
                                                            </div>
                                                        );
                                                    }
                                                    return filtered.map((m) => {
                                                        const isChecked = userFormData.supervisors.includes(m._id || m.id);
                                                        return (
                                                            <div key={m._id || m.id} className="col-md-6">
                                                                <div 
                                                                    className={`p-2.5 rounded-3 border cursor-pointer transition-all d-flex align-items-center justify-content-between gap-2.5 bg-white ${isChecked ? 'border-primary shadow-sm' : 'border-slate-200 hover-slate-50'}`}
                                                                    style={{ 
                                                                        borderWidth: isChecked ? '2px' : '1px',
                                                                        borderColor: isChecked ? '#4f46e5' : '#e2e8f0'
                                                                    }}
                                                                    onClick={() => {
                                                                        setUserFormData(prev => {
                                                                            const isSel = prev.supervisors.includes(m._id || m.id);
                                                                            return {
                                                                                ...prev,
                                                                                supervisors: isSel
                                                                                    ? prev.supervisors.filter(id => id !== (m._id || m.id))
                                                                                    : [...prev.supervisors, (m._id || m.id)]
                                                                            };
                                                                        });
                                                                    }}
                                                                >
                                                                    <div className="d-flex align-items-center gap-2">
                                                                        <div className="avatar-circle" style={{ width: '28px', height: '28px', fontSize: '11px', backgroundColor: isChecked ? '#e0e7ff' : '#f1f5f9', color: isChecked ? '#4f46e5' : '#475569', fontWeight: '600' }}>
                                                                            {renderInitials(m.firstName, m.lastName)}
                                                                        </div>
                                                                        <div style={{ minWidth: 0 }}>
                                                                            <div className="fw-bold text-slate-800 small text-truncate">{m.firstName} {m.lastName}</div>
                                                                            <div className="text-muted smallest text-truncate">{m.email} <span className="text-indigo-500 fw-semibold text-uppercase font-monospace" style={{ fontSize: '9px' }}>({m.role?.displayName || m.role?.name || 'User'})</span></div>
                                                                        </div>
                                                                    </div>
                                                                    <div className={`d-flex align-items-center justify-content-center border rounded-pill`} style={{ width: '18px', height: '18px', backgroundColor: isChecked ? '#4f46e5' : 'transparent', borderColor: isChecked ? '#4f46e5' : '#cbd5e1' }}>
                                                                        {isChecked && <Check size={11} strokeWidth={3} className="text-white" />}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    });
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/***** BRAND MANAGERS SELECTION PANEL *****/}
                                {isListingTeam && (
                                    <div className="bg-white p-4 rounded-4 border shadow-sm">
                                        <div className="d-flex align-items-center justify-content-between mb-3">
                                            <div className="d-flex align-items-center gap-2 fw-bold text-slate-800 small text-uppercase" style={{ letterSpacing: '0.05em' }}>
                                                <UserCheck size={14} className="text-emerald-500" /> Assigned Brand Managers (For Brand Inheritance)
                                            </div>
                                            <span className="badge rounded-pill px-2.5 py-1 fw-bold text-white shadow-sm" style={{ fontSize: '11px', backgroundColor: '#10b981' }}>
                                                {userFormData.brandManagers.length} Selected
                                            </span>
                                        </div>

                                        {/* Panel Actions */}
                                        <div className="d-flex gap-2 mb-3">
                                            <div className="position-relative flex-grow-1">
                                                <Search size={14} className="position-absolute top-50 start-0 translate-middle-y ms-2.5 text-muted" />
                                                <input 
                                                    type="text" 
                                                    className="form-control form-control-sm ps-5 rounded-3 border-slate-200" 
                                                    style={{ fontSize: '12px' }}
                                                    placeholder="Search brand managers..." 
                                                    value={modalSearchBrandManager}
                                                    onChange={(e) => setModalSearchBrandManager(e.target.value)}
                                                />
                                            </div>
                                            <button 
                                                type="button" 
                                                className="btn btn-sm btn-light border rounded-3 text-slate-600 px-3 hover-slate-100 smallest fw-bold"
                                                onClick={() => {
                                                    const bmUsers = managers.filter(m => 
                                                        m.role?.name?.toLowerCase() === 'brand_manager' || 
                                                        m.role?.displayName?.toLowerCase() === 'brand manager'
                                                    );
                                                    const allIds = bmUsers.map(m => m._id || m.id);
                                                    setUserFormData(prev => ({ ...prev, brandManagers: allIds }));
                                                }}
                                            >
                                                Select All
                                            </button>
                                            <button 
                                                type="button" 
                                                className="btn btn-sm btn-light border rounded-3 text-slate-600 px-3 hover-slate-100 smallest fw-bold"
                                                onClick={() => setUserFormData(prev => ({ ...prev, brandManagers: [] }))}
                                            >
                                                Clear
                                            </button>
                                        </div>

                                        {/* Brand Managers List Grid */}
                                        <div className="border rounded-3 bg-slate-50/50 p-2.5" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                                            <div className="row g-2">
                                                {(() => {
                                                    const bmUsers = managers.filter(m => 
                                                        m.role?.name?.toLowerCase() === 'brand_manager' || 
                                                        m.role?.displayName?.toLowerCase() === 'brand manager'
                                                    );
                                                    const filtered = bmUsers.filter(m => 
                                                        `${m.firstName} ${m.lastName} ${m.email}`.toLowerCase().includes(modalSearchBrandManager.toLowerCase())
                                                    );
                                                    if (filtered.length === 0) {
                                                        return (
                                                            <div className="col-12 py-4 text-center text-muted small">
                                                                No brand managers found matching "{modalSearchBrandManager}"
                                                            </div>
                                                        );
                                                    }
                                                    return filtered.map((m) => {
                                                        const isChecked = userFormData.brandManagers.includes(m._id || m.id);
                                                        return (
                                                            <div key={m._id || m.id} className="col-md-6">
                                                                <div 
                                                                    className={`p-2.5 rounded-3 border cursor-pointer transition-all d-flex align-items-center justify-content-between gap-2.5 bg-white ${isChecked ? 'border-primary shadow-sm' : 'border-slate-200 hover-slate-50'}`}
                                                                    style={{ 
                                                                        borderWidth: isChecked ? '2px' : '1px',
                                                                        borderColor: isChecked ? '#10b981' : '#e2e8f0'
                                                                    }}
                                                                    onClick={() => {
                                                                        setUserFormData(prev => {
                                                                            const isSel = prev.brandManagers.includes(m._id || m.id);
                                                                            return {
                                                                                ...prev,
                                                                                brandManagers: isSel
                                                                                    ? prev.brandManagers.filter(id => id !== (m._id || m.id))
                                                                                    : [...prev.brandManagers, (m._id || m.id)]
                                                                            };
                                                                        });
                                                                    }}
                                                                >
                                                                    <div className="d-flex align-items-center gap-2">
                                                                        <div className="avatar-circle" style={{ width: '28px', height: '28px', fontSize: '11px', backgroundColor: isChecked ? '#d1fae5' : '#f1f5f9', color: isChecked ? '#059669' : '#475569', fontWeight: '600' }}>
                                                                            {renderInitials(m.firstName, m.lastName)}
                                                                        </div>
                                                                        <div style={{ minWidth: 0 }}>
                                                                            <div className="fw-bold text-slate-800 small text-truncate">{m.firstName} {m.lastName}</div>
                                                                            <div className="text-muted smallest text-truncate">{m.email}</div>
                                                                        </div>
                                                                    </div>
                                                                    <div className={`d-flex align-items-center justify-content-center border rounded-pill`} style={{ width: '18px', height: '18px', backgroundColor: isChecked ? '#10b981' : 'transparent', borderColor: isChecked ? '#10b981' : '#cbd5e1' }}>
                                                                        {isChecked && <Check size={11} strokeWidth={3} className="text-white" />}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    });
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="bg-white p-4 rounded-4 border shadow-sm">
                                    <div className="d-flex align-items-center justify-content-between mb-3">
                                        <div className="d-flex align-items-center gap-2 fw-bold text-slate-800 small text-uppercase" style={{ letterSpacing: '0.05em' }}>
                                            <Store size={14} className="text-emerald-500" /> Brands & Sellers Association
                                        </div>
                                        <span className="badge rounded-pill px-2.5 py-1 fw-bold text-white shadow-sm" style={{ fontSize: '11px', backgroundColor: '#10b981' }}>
                                            {isListingTeam ? inheritedSellers.length : userFormData.assignedSellers.length} Selected
                                        </span>
                                    </div>

                                    {/* Info Alert Banner */}
                                    {isListingTeam && (
                                        <div className="alert alert-info border-info/20 bg-info/5 rounded-3 p-3 mb-3 d-flex align-items-start gap-2.5">
                                            <div style={{ flexShrink: 0 }} className="text-info-600 mt-0.5">
                                                <Store size={16} />
                                            </div>
                                            <div style={{ fontSize: '12px', lineHeight: '1.5' }} className="text-info-800">
                                                <strong>Listing Team Inheritance:</strong> Sellers are automatically inherited from the selected Brand Managers (Supervisors). Direct selection is locked.
                                            </div>
                                        </div>
                                    )}

                                    {isCatalogManager && (
                                        <div className="alert alert-warning border-warning/25 bg-warning/5 rounded-3 p-3 mb-3 d-flex align-items-start gap-2.5">
                                            <div style={{ flexShrink: 0 }} className="text-warning-600 mt-0.5">
                                                <Store size={16} />
                                            </div>
                                            <div style={{ fontSize: '12px', lineHeight: '1.5' }} className="text-warning-800">
                                                <strong>Catalog Manager Access:</strong> View-only sellers access enabled. No brand assignments can be modified for this role.
                                            </div>
                                        </div>
                                    )}

                                    {/***** Panel Actions *****/}
                                    {!isListingTeam && (
                                        <div className="d-flex gap-2 mb-3">
                                            <div className="position-relative flex-grow-1">
                                                <Search size={14} className="position-absolute top-50 start-0 translate-middle-y ms-2.5 text-muted" />
                                                <input 
                                                    type="text" 
                                                    className="form-control form-control-sm ps-5 rounded-3 border-slate-200" 
                                                    style={{ fontSize: '12px' }}
                                                    placeholder="Search brands..." 
                                                    value={modalSearchSeller}
                                                    onChange={(e) => setModalSearchSeller(e.target.value)}
                                                />
                                            </div>
                                            <button 
                                                type="button" 
                                                className="btn btn-sm btn-light border rounded-3 text-slate-600 px-3 hover-slate-100 smallest fw-bold"
                                                onClick={() => {
                                                    const allIds = sellers.map(s => s._id || s.id);
                                                    setUserFormData(prev => ({ ...prev, assignedSellers: allIds }));
                                                }}
                                            >
                                                Select All
                                            </button>
                                            <button 
                                                type="button" 
                                                className="btn btn-sm btn-light border rounded-3 text-slate-600 px-3 hover-slate-100 smallest fw-bold"
                                                onClick={() => setUserFormData(prev => ({ ...prev, assignedSellers: [] }))}
                                            >
                                                Clear
                                            </button>
                                        </div>
                                    )}

                                    {/* Sellers List Grid */}
                                    <div className="border rounded-3 bg-slate-50/50 p-2.5" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                                        <div className="row g-2">
                                            {(() => {
                                                const listToRender = isListingTeam ? inheritedSellers : sellers;
                                                const filtered = listToRender.filter(s => 
                                                    `${s.name} ${s.code || ''}`.toLowerCase().includes(modalSearchSeller.toLowerCase())
                                                );
                                                if (filtered.length === 0) {
                                                    return (
                                                        <div className="col-12 py-4 text-center text-muted small">
                                                            {isListingTeam 
                                                                ? "No inherited sellers found. Try selecting different Supervisors."
                                                                : `No brands found matching "${modalSearchSeller}"`
                                                            }
                                                        </div>
                                                    );
                                                }
                                                return filtered.map((s) => {
                                                    const isChecked = isListingTeam ? true : userFormData.assignedSellers.includes(s._id || s.id);
                                                    const isReadOnly = isListingTeam;
                                                    return (
                                                        <div key={s._id || s.id} className="col-md-6" style={isReadOnly ? { pointerEvents: 'none' } : {}}>
                                                            <div 
                                                                className={`p-2.5 rounded-3 border transition-all d-flex align-items-center justify-content-between gap-2.5 bg-white ${isChecked ? 'border-success shadow-sm' : 'border-slate-200 hover-slate-50'}`}
                                                                style={{ 
                                                                    borderWidth: isChecked ? '2px' : '1px',
                                                                    borderColor: isChecked ? '#10b981' : '#e2e8f0',
                                                                    opacity: 1
                                                                }}
                                                                onClick={() => {
                                                                    if (isReadOnly) return;
                                                                    setUserFormData(prev => {
                                                                        const isSel = prev.assignedSellers.includes(s._id || s.id);
                                                                        return {
                                                                            ...prev,
                                                                            assignedSellers: isSel
                                                                                ? prev.assignedSellers.filter(id => id !== (s._id || s.id))
                                                                                : [...prev.assignedSellers, (s._id || s.id)]
                                                                        };
                                                                    });
                                                                }}
                                                            >
                                                                <div className="d-flex align-items-center gap-2">
                                                                    <div className="avatar-circle" style={{ width: '28px', height: '28px', fontSize: '11px', backgroundColor: isChecked ? '#d1fae5' : '#f1f5f9', color: isChecked ? '#10b981' : '#475569', fontWeight: '600' }}>
                                                                        <Store size={14} />
                                                                    </div>
                                                                    <div style={{ minWidth: 0 }}>
                                                                        <div className="fw-bold text-slate-800 small text-truncate">{s.name}</div>
                                                                        <div className="text-muted smallest text-truncate">{s.code || s.id || 'Active Store'}</div>
                                                                    </div>
                                                                </div>
                                                                <div className={`d-flex align-items-center justify-content-center border rounded-pill`} style={{ width: '18px', height: '18px', backgroundColor: isChecked ? '#10b981' : 'transparent', borderColor: isChecked ? '#10b981' : '#cbd5e1' }}>
                                                                    {isChecked && <Check size={11} strokeWidth={3} className="text-white" />}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-4 py-3 border-top d-flex justify-content-end gap-2 bg-light">
                            <button className="btn btn-light border px-4 fw-semibold rounded-3" style={{ fontSize: '13px' }} onClick={() => setShowUserModal(false)}>
                                Discard
                            </button>
                            <button className="btn btn-dark px-4 fw-bold rounded-3 shadow-sm" style={{ fontSize: '13px' }} onClick={handleSaveUser}>
                                {editingUser ? 'Save Updates' : 'Register Member'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== ROLE DETAILS MODAL ===== */}
            {showRoleModal && (
                <div 
                    className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" 
                    style={{ backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)', zIndex: 1050 }}
                    onClick={(e) => { if (e.target === e.currentTarget) setShowRoleModal(false); }}
                >
                    <div 
                        className="bg-white shadow-2xl overflow-hidden"
                        style={{ width: '100%', maxWidth: '500px', borderRadius: '24px' }}
                    >
                        {/* Header */}
                        <div className="px-4 py-3 border-bottom d-flex justify-content-between align-items-center">
                            <div className="d-flex align-items-center gap-3">
                                <div className="p-2 bg-light text-indigo-700 rounded-3" style={{ color: '#4f46e5' }}>
                                    <Shield size={20} />
                                </div>
                                <div>
                                    <h5 className="mb-0 fw-bold text-slate-900">{editingRole ? 'Edit Role Details' : 'Create Custom Role'}</h5>
                                    <p className="text-muted small mb-0" style={{ fontSize: '11px' }}>Configure role specifications and aesthetic tags</p>
                                </div>
                            </div>
                            <button className="btn btn-link p-1 text-slate-400 border-0" onClick={() => setShowRoleModal(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-4 bg-light">
                            <div className="d-flex flex-column gap-3">
                                <div className="bg-white p-3.5 rounded-3 border-0 shadow-sm">
                                    <div className="row g-3">
                                        <div className="col-12">
                                            <label className="form-label text-slate-600 small fw-semibold">Display Label *</label>
                                            <input 
                                                type="text" 
                                                className="form-control" 
                                                placeholder="e.g. Listing Team" 
                                                value={roleFormData.displayName}
                                                onChange={(e) => setRoleFormData(prev => ({ ...prev, displayName: e.target.value }))}
                                            />
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label text-slate-600 small fw-semibold">Priority Level (0-100)</label>
                                            <input 
                                                type="number" 
                                                className="form-control" 
                                                min="0" max="100"
                                                value={roleFormData.level}
                                                onChange={(e) => setRoleFormData(prev => ({ ...prev, level: parseInt(e.target.value) || 0 }))}
                                            />
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label text-slate-600 small fw-semibold">Theme Color</label>
                                            <div className="d-flex align-items-center gap-2">
                                                <input 
                                                    type="color" 
                                                    className="form-control form-control-color border" 
                                                    style={{ width: '42px', height: '38px', padding: '4px', cursor: 'pointer' }}
                                                    value={roleFormData.color}
                                                    onChange={(e) => setRoleFormData(prev => ({ ...prev, color: e.target.value }))}
                                                />
                                                <span className="font-monospace text-slate-500 small">{roleFormData.color}</span>
                                            </div>
                                        </div>
                                        <div className="col-12">
                                            <label className="form-label text-slate-600 small fw-semibold">Description</label>
                                            <textarea 
                                                className="form-control" 
                                                rows="3"
                                                placeholder="Briefly summarize duties assigned to this role..."
                                                value={roleFormData.description}
                                                onChange={(e) => setRoleFormData(prev => ({ ...prev, description: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-4 py-3 border-top d-flex justify-content-end gap-2 bg-white">
                            <button className="btn btn-light px-4 fw-semibold" style={{ fontSize: '13px' }} onClick={() => setShowRoleModal(false)}>
                                Cancel
                            </button>
                            <button className="btn btn-dark px-4 fw-bold" style={{ fontSize: '13px' }} onClick={handleSaveRole}>
                                {editingRole ? 'Save Changes' : 'Create Role'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UsersPage;
