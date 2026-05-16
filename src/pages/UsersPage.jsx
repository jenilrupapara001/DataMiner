import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { userApi, roleApi } from '../services/api';
import { useSocket } from '../contexts/SocketContext';
import {
    Users, Shield, UserPlus, Search, Pencil, Trash2, Mail, Phone,
    Clock, CheckCircle2, XCircle, Info, UserCheck, RefreshCw, Store, Check,
    SlidersHorizontal, Lock, Plus, ArrowRight, User, AlertCircle
} from 'lucide-react';
import { PageLoader } from '@/components/application/loading-indicator/PageLoader';
import { LoadingIndicator } from '@/components/application/loading-indicator/loading-indicator';
import { 
    Space, Button, Segmented, Table, Modal, Card, Statistic, Input, Row, Col, 
    Typography, Tag, Tooltip, Form, Select, Switch, Avatar, Badge, Divider, notification, message as antdMessage 
} from 'antd';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const UsersPage = () => {
    const socket = useSocket();
    const [messageApi, messageContextHolder] = antdMessage.useMessage();
    const [notificationApi, notificationContextHolder] = notification.useNotification();

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
    const selectedRoleObj = useMemo(() => roles.find(r => (r._id || r.id) === userFormData.role), [roles, userFormData.role]);
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

    // Derived Stats for KPI Header
    const activeCount = useMemo(() => users.filter(u => u.isActive).length, [users]);
    const totalRecordCount = useMemo(() => pagination.total || users.length, [pagination.total, users]);

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
            messageApi.error('Failed to load team roster.');
        }
        setLoading(false);
    }, [pagination.page, pagination.limit, filters, messageApi]);

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
            messageApi.success('User status updated successfully.');
            loadUsers();
        } catch (error) {
            console.error('Failed to toggle status:', error);
            messageApi.error(error.message || 'Failed to toggle status.');
        }
    };

    // Delete User
    const handleDeleteUser = (userId) => {
        Modal.confirm({
            title: 'Delete Team Member?',
            icon: <AlertCircle className="text-rose-500" size={20} />,
            content: 'Are you sure you want to delete this user? This operation is permanent and cannot be recovered.',
            okText: 'Permanently Delete',
            okType: 'danger',
            cancelText: 'Cancel',
            centered: true,
            maskClosable: true,
            onOk: async () => {
                try {
                    await userApi.delete(userId);
                    messageApi.success('Member successfully removed from organization.');
                    loadUsers();
                } catch (error) {
                    console.error('Failed to delete user:', error);
                    messageApi.error(error.message || 'Failed to delete user.');
                }
            }
        });
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

        setUserFormData(prev => ({
            ...prev,
            role: roleId,
            assignedSellers: isBM ? sellers.map(s => s._id || s.id) : prev.assignedSellers,
            brandManagers: prev.brandManagers
        }));
    };

    const handleSaveUser = async () => {
        if (!userFormData.firstName || !userFormData.lastName || !userFormData.email || !userFormData.role) {
            messageApi.warning('Please complete all required basic fields (First/Last Name, Email, and Role).');
            return;
        }
        try {
            const selectedRole = roles.find(r => r._id === userFormData.role || r.id === userFormData.role);
            const roleName = selectedRole?.name?.toLowerCase() || '';
            const roleDisplayName = selectedRole?.displayName?.toLowerCase() || '';
            const isListingTeam = roleName === 'listing_team' || roleDisplayName === 'listing team';

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
                messageApi.success('Member profile successfully updated.');
            } else {
                await userApi.create(data);
                messageApi.success('New team member registered and invitation pending.');
            }
            setShowUserModal(false);
            loadUsers();
        } catch (error) {
            console.error('Failed to save user:', error);
            messageApi.error(error.message || 'System failure while saving organization profile.');
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
            notificationApi.success({
                message: 'Permissions Matrix Synchronized',
                description: 'All configured access control levels and permission policies are now active and deployed system-wide.',
                placement: 'topRight'
            });
            setTimeout(() => setMatrixSuccess(false), 4000);
            await loadRolesAndPerms();
        } catch (error) {
            console.error('Failed to sync matrix permissions:', error);
            messageApi.error(error.message || 'Matrix synchronization failed.');
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
            messageApi.warning('Display Label is required.');
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
                messageApi.success('Role specifications configured successfully.');
            } else {
                await roleApi.create(data);
                messageApi.success('New custom workspace role initialized.');
            }
            setShowRoleModal(false);
            loadRolesAndPerms();
        } catch (error) {
            console.error('Failed to save role:', error);
            messageApi.error(error.message || 'Failed to deploy custom role.');
        }
    };

    const handleDeleteRole = (roleId) => {
        Modal.confirm({
            title: 'Retire Access Role?',
            icon: <AlertCircle className="text-rose-500" size={20} />,
            content: 'Caution: All members utilizing this role will immediate experience downgraded capabilities. This deletion cannot be reverted.',
            okText: 'Confirm Deletion',
            okType: 'danger',
            centered: true,
            maskClosable: true,
            onOk: async () => {
                try {
                    await roleApi.delete(roleId);
                    messageApi.success('Role retired and removed from active catalog.');
                    loadRolesAndPerms();
                } catch (error) {
                    console.error('Failed to delete role:', error);
                    messageApi.error(error.message || 'Role decommissioning failed.');
                }
            }
        });
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

    // Helper to render Initials
    const renderInitials = (firstName, lastName) => {
        const f = firstName ? firstName[0].toUpperCase() : '';
        const l = lastName ? lastName[0].toUpperCase() : '';
        return `${f}${l}` || 'U';
    };

    // AntD Table Columns - Members Tab
    const columns = [
        {
            title: 'Member Name',
            key: 'name',
            width: 300,
            render: (_, record) => {
                const initials = renderInitials(record.firstName, record.lastName);
                const roleId = record.role?._id || record.role?.id || record.role;
                const resolvedRole = roles.find(r => (r._id || r.id) === roleId) || (typeof record.role === 'object' ? record.role : null);
                const roleColor = resolvedRole?.color || '#6366f1';
                
                return (
                    <Space size={12}>
                        <Avatar 
                            style={{ 
                                backgroundColor: `${roleColor}15`, 
                                color: roleColor, 
                                fontWeight: 700, 
                                fontSize: 13,
                                border: `1px solid ${roleColor}25`
                            }}
                        >
                            {initials}
                        </Avatar>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <Text strong style={{ fontSize: 13, color: '#1e293b', letterSpacing: '-0.01em' }}>
                                {record.firstName} {record.lastName}
                            </Text>
                            <Space size={8} split={<Divider type="vertical" style={{ margin: 0 }} />}>
                                <span style={{ fontSize: 11, color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <Mail size={11} /> {record.email}
                                </span>
                                {record.phone && (
                                    <span style={{ fontSize: 11, color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                        <Phone size={11} /> {record.phone}
                                    </span>
                                )}
                            </Space>
                        </div>
                    </Space>
                );
            }
        },
        {
            title: 'Access Role',
            key: 'role',
            width: 220,
            render: (_, record) => {
                const roleId = record.role?._id || record.role?.id || record.role;
                const resolvedRole = roles.find(r => (r._id || r.id) === roleId) || (typeof record.role === 'object' ? record.role : null);
                
                const color = resolvedRole?.color || '#6366f1';
                const displayName = resolvedRole?.displayName || 'Standard Role';
                
                return (
                    <Tag 
                        variant="filled" 
                        style={{ 
                            backgroundColor: `${color}12`, 
                            color: color, 
                            borderRadius: '8px', 
                            fontWeight: '800', 
                            fontSize: '11px',
                            letterSpacing: '0.02em',
                            padding: '5px 14px',
                            textTransform: 'uppercase',
                            border: `1.5px solid ${color}25`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: `0 2px 4px ${color}08`
                        }}
                        icon={<Shield size={11} style={{ strokeWidth: 2.5 }} />}
                    >
                        {displayName}
                    </Tag>
                );
            }
        },
        {
            title: 'Supervisors',
            key: 'supervisors',
            width: 180,
            render: (_, record) => {
                const list = record.supervisors || [];
                if (list.length === 0) return <Text type="secondary" style={{ fontSize: 12 }}>-</Text>;
                return (
                    <Avatar.Group maxCount={3} size="small" maxStyle={{ color: '#f56a00', backgroundColor: '#fde3cf' }}>
                        {list.map((s, idx) => (
                            <Tooltip key={idx} title={`${s.firstName} ${s.lastName} (${s.email})`}>
                                <Avatar style={{ backgroundColor: '#4f46e5', fontSize: 9 }}>
                                    {renderInitials(s.firstName, s.lastName)}
                                </Avatar>
                            </Tooltip>
                        ))}
                    </Avatar.Group>
                );
            }
        },
        {
            title: 'Status',
            dataIndex: 'isActive',
            key: 'isActive',
            width: 130,
            render: (isActive, record) => (
                <Space size={8}>
                    <Switch 
                        size="small" 
                        checked={isActive} 
                        onChange={() => handleToggleStatus(record._id || record.id)} 
                        style={{ backgroundColor: isActive ? '#10b981' : '#cbd5e1' }}
                    />
                    <Text style={{ fontSize: 11.5, fontWeight: 600, color: isActive ? '#059669' : '#64748b' }}>
                        {isActive ? 'ACTIVE' : 'INACTIVE'}
                    </Text>
                </Space>
            )
        },
        {
            title: 'Actions',
            key: 'actions',
            fixed: 'right',
            width: 110,
            align: 'right',
            render: (_, record) => (
                <Space size={4}>
                    <Tooltip title="Configure Workspace Profile">
                        <Button 
                            type="text" 
                            shape="circle" 
                            size="small" 
                            onClick={() => handleOpenUserModal(record)}
                            icon={<Pencil size={13} className="text-indigo-600" />} 
                        />
                    </Tooltip>
                    <Tooltip title="Retire Member Profile">
                        <Button 
                            type="text" 
                            danger 
                            shape="circle" 
                            size="small" 
                            onClick={() => handleDeleteUser(record._id || record.id)}
                            icon={<Trash2 size={13} />} 
                        />
                    </Tooltip>
                </Space>
            )
        }
    ];

    return (
        <div className="users-page-container">
            {messageContextHolder}
            {notificationContextHolder}
            {loading && users.length === 0 && <PageLoader message="Fetching Access Configurations..." />}

            <style>{`
                .users-page-container {
                    display: flex;
                    flex-direction: column;
                    min-height: 100vh;
                    background-color: #f8fafc;
                    margin: -1.5rem -2rem;
                }
                .users-header {
                    flex-shrink: 0;
                    background: #ffffff;
                    padding: 16px 24px;
                    border-bottom: 1px solid #e2e8f0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    z-index: 10;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.01);
                }
                .users-scroll-content {
                    padding: 24px;
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }
                .kpi-stat-card {
                    border-radius: 16px !important;
                    border: 1px solid #e2e8f0 !important;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.01) !important;
                    transition: transform 0.2s ease, box-shadow 0.2s ease !important;
                }
                .kpi-stat-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 16px -4px rgba(0,0,0,0.04) !important;
                }
                .icon-wrapper {
                    width: 44px;
                    height: 44px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }
                .segmented-users .ant-segmented-item-selected {
                    background-color: #0f172a !important;
                    color: #ffffff !important;
                    font-weight: 650 !important;
                }
                .matrix-table-panel {
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 16px;
                    overflow: hidden;
                    margin-bottom: 24px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.02);
                }
                .matrix-table-panel .ant-table-thead > tr > th {
                    background: #fcfdfe !important;
                    font-weight: 700 !important;
                    color: #475569 !important;
                    font-size: 12.5px !important;
                    border-bottom: 1.5px solid #f1f5f9 !important;
                }
                .matrix-cell-check {
                    display: inline-flex;
                    width: 22px;
                    height: 22px;
                    border-radius: 7px;
                    border: 2px solid #cbd5e1;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .matrix-cell-check.assigned {
                    background-color: #10b981;
                    border-color: #10b981;
                    box-shadow: 0 3px 8px rgba(16, 185, 129, 0.25);
                }
                .matrix-cell-check.assigned:hover {
                    transform: scale(1.05);
                }
                .glass-modal .ant-modal-content {
                    border-radius: 20px !important;
                    overflow: hidden !important;
                }
                .glass-modal .ant-modal-header {
                    background: #f8fafc !important;
                    border-bottom: 1px solid #f1f5f9 !important;
                    padding: 16px 24px !important;
                }
                .glass-modal .ant-modal-footer {
                    background: #f8fafc !important;
                    border-top: 1px solid #f1f5f9 !important;
                    padding: 16px 24px !important;
                }
                .selection-item-card {
                    background: #ffffff;
                    border: 1.5px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 10px 12px;
                    transition: all 0.2s ease;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }
                .selection-item-card:hover {
                    border-color: #cbd5e1;
                    background: #f8fafc;
                }
                .selection-item-card.selected {
                    border-color: #4f46e5;
                    background: #f5f3ff;
                    box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.08);
                }
                .selection-item-card.selected-green {
                    border-color: #10b981;
                    background: #f0fdf4;
                    box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.08);
                }
                .selection-checkbox {
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    border: 2px solid #cbd5e1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.15s;
                }
                .selection-checkbox.active {
                    background-color: #4f46e5;
                    border-color: #4f46e5;
                }
                .selection-checkbox.active-green {
                    background-color: #10b981;
                    border-color: #10b981;
                }
                @media (max-width: 768px) {
                    .users-header {
                        flex-direction: column;
                        align-items: stretch;
                        gap: 12px;
                    }
                    .users-page-container {
                        margin: -0.75rem;
                        height: auto;
                        overflow: visible;
                    }
                }
            `}</style>

            {/* 1. TOP HEADER AREA */}
            <div className="users-header">
                <div>
                    <Space align="center" size={10}>
                        <div style={{ background: '#EEF2FF', color: '#4F46E5', padding: 8, borderRadius: 10, display: 'flex' }}>
                            <Users size={20} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontWeight: 800, color: '#0f172a', fontSize: 18, letterSpacing: '-0.02em' }}>Organization & Permissions</h3>
                            <Text type="secondary" style={{ fontSize: 12 }}>Deploy roles, manage access control lists, and audit members.</Text>
                        </div>
                    </Space>
                </div>
                <Space size={8}>
                    <Button 
                        icon={<RefreshCw size={14} />} 
                        shape="round"
                        style={{ fontWeight: 600, fontSize: 12.5, color: '#475569' }}
                        onClick={() => loadUsers()}
                    >
                        Sync Engine
                    </Button>
                    {activeTab === 'users' ? (
                        <Button 
                            type="primary" 
                            icon={<UserPlus size={14} />} 
                            shape="round"
                            style={{ background: '#0f172a', borderColor: '#0f172a', fontWeight: 700, fontSize: 12.5 }}
                            onClick={() => handleOpenUserModal()}
                        >
                            Register Member
                        </Button>
                    ) : (
                        <Button 
                            type="primary" 
                            icon={<Plus size={14} />} 
                            shape="round"
                            style={{ background: '#0f172a', borderColor: '#0f172a', fontWeight: 700, fontSize: 12.5 }}
                            onClick={() => handleOpenRoleModal()}
                        >
                            Deploy Role
                        </Button>
                    )}
                </Space>
            </div>

            {/* 2. SCROLLABLE WORKSPACE */}
            <div className="users-scroll-content">
                

                {/* Primary Controller Strip */}
                <Card variant="borderless" styles={{ body: { padding: '12px 16px' } }} style={{ borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.01)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                        <Segmented
                            className="segmented-users"
                            size="large"
                            value={activeTab}
                            onChange={v => setActiveTab(v)}
                            style={{ background: '#f1f5f9', borderRadius: 10, padding: 3 }}
                            options={[
                                { label: <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px' }}><Users size={13} /> <span>Members & Teams</span></div>, value: 'users' },
                                { label: <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px' }}><Lock size={13} /> <span>Access Matrix</span></div>, value: 'roles' }
                            ]}
                        />

                        {activeTab === 'users' ? (
                            <div style={{ flex: 1, display: 'flex', gap: 8, maxWidth: 650, justifyContent: 'flex-end' }}>
                                <Input 
                                    prefix={<Search size={13} style={{ color: '#94a3b8', marginRight: 4 }} />} 
                                    placeholder="Filter profile directory..." 
                                    allowClear
                                    value={filters.search}
                                    onChange={e => handleFilterChange('search', e.target.value)}
                                    style={{ width: 240, borderRadius: 8 }}
                                />
                                <Select 
                                    placeholder="Select Role" 
                                    allowClear 
                                    value={filters.role || undefined}
                                    onChange={v => handleFilterChange('role', v || '')}
                                    style={{ width: 160 }}
                                    dropdownStyle={{ borderRadius: 10 }}
                                >
                                    {roles.map(r => <Option key={r._id || r.id} value={r.name || r.id}>{r.displayName}</Option>)}
                                </Select>
                                <Select 
                                    placeholder="Status" 
                                    allowClear 
                                    value={filters.isActive || undefined}
                                    onChange={v => handleFilterChange('isActive', v !== undefined ? v : '')}
                                    style={{ width: 120 }}
                                >
                                    <Option value="true">Active</Option>
                                    <Option value="false">Inactive</Option>
                                </Select>
                                <Tooltip title="Wipe Query">
                                    <Button icon={<Trash2 size={13} />} onClick={resetFilters} style={{ borderRadius: 8 }} />
                                </Tooltip>
                            </div>
                        ) : (
                            <div style={{ flex: 1, display: 'flex', gap: 8, maxWidth: 650, justifyContent: 'flex-end', alignItems: 'center' }}>
                                <Input 
                                    prefix={<Search size={13} style={{ color: '#94a3b8', marginRight: 4 }} />} 
                                    placeholder="Filter system capabilities..." 
                                    allowClear
                                    value={permissionSearch}
                                    onChange={e => setPermissionSearch(e.target.value)}
                                    style={{ width: 240, borderRadius: 8 }}
                                />
                                <Button 
                                    type="primary"
                                    icon={<CheckCircle2 size={14} />}
                                    loading={matrixSaving}
                                    onClick={handleSaveMatrixPermissions}
                                    style={{ background: '#10b981', borderColor: '#10b981', fontWeight: 700, borderRadius: 8 }}
                                >
                                    Commit & Sync Matrix
                                </Button>
                            </div>
                        )}
                    </div>
                </Card>

                {/* 3. TAB CONTENT SWITCHING */}
                {activeTab === 'users' ? (
                    <Card variant="borderless" styles={{ body: { padding: 0 } }} style={{ borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                        <Table 
                            columns={columns}
                            dataSource={users.map(u => ({ ...u, key: u._id || u.id }))}
                            loading={loading}
                            pagination={{
                                current: pagination.page,
                                pageSize: pagination.limit,
                                total: pagination.total,
                                showSizeChanger: true,
                                pageSizeOptions: ['10', '20', '50', '100'],
                                showTotal: (total, range) => `Showing ${range[0]}-${range[1]} of ${total} team members`,
                                onChange: (page, pageSize) => setPagination(p => ({ ...p, page, limit: pageSize || p.limit }))
                            }}
                            scroll={{ x: 1000 }}
                            className="custom-table"
                        />
                    </Card>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {Object.entries(filteredGroupedPermissions).map(([category, perms]) => (
                            <div key={category} className="matrix-table-panel">
                                <div style={{ 
                                    background: '#fcfdfe', 
                                    padding: '12px 20px', 
                                    borderBottom: '1.5px solid #f1f5f9',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8
                                }}>
                                    <div style={{ background: '#e0e7ff', padding: 6, borderRadius: 8, display: 'flex', color: '#4f46e5' }}>
                                        <Shield size={14} />
                                    </div>
                                    <span style={{ fontWeight: 800, color: '#1e293b', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                                        {category} Rules Catalog
                                    </span>
                                    <Badge count={perms.length} showZero style={{ backgroundColor: '#f1f5f9', color: '#64748b', boxShadow: 'none', fontSize: 10, fontWeight: 700, marginLeft: 4 }} />
                                </div>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1.5px solid #f1f5f9' }}>
                                                <th style={{ width: '240px', padding: '14px 20px', fontSize: '12px', fontWeight: 700, color: '#475569', textAlign: 'left', background: '#f8fafc' }}>
                                                    Organizational Role
                                                </th>
                                                {perms.map((perm) => (
                                                    <th key={perm._id || perm.id} style={{ padding: '12px', fontSize: '11.5px', fontWeight: 700, color: '#475569', textAlign: 'center', minWidth: '130px', borderLeft: '1px solid #f1f5f9' }}>
                                                        <Tooltip title={perm.name}>
                                                            {perm.displayName}
                                                        </Tooltip>
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {matrixRoles.map((role) => {
                                                const roleColor = role.color || '#4F46E5';
                                                const rolePermIds = role.permissions?.map(p => p._id || p.id || p) || [];
                                                return (
                                                    <tr key={role._id || role.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'all 0.15s' }}>
                                                        <td style={{ padding: '12px 20px', fontWeight: 600, fontSize: '13px', color: '#334155', background: '#fcfdfe' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                                <Space size={8}>
                                                                    <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: roleColor }}></div>
                                                                    <span>{role.displayName}</span>
                                                                </Space>
                                                                <Space size={6}>
                                                                    <Button 
                                                                        type="text" 
                                                                        size="small" 
                                                                        shape="circle"
                                                                        onClick={() => handleOpenRoleModal(role)}
                                                                        icon={<Pencil size={11} style={{ color: '#64748b' }} />}
                                                                    />
                                                                    {role.name !== 'super_admin' && (
                                                                        <Button 
                                                                            type="text" 
                                                                            danger 
                                                                            size="small" 
                                                                            shape="circle"
                                                                            onClick={() => handleDeleteRole(role._id || role.id)}
                                                                            icon={<Trash2 size={11} />}
                                                                        />
                                                                    )}
                                                                </Space>
                                                            </div>
                                                        </td>
                                                        {perms.map((perm) => {
                                                            const isAssigned = rolePermIds.includes(perm._id || perm.id);
                                                            const isOperationalManager = (role.name || '').toLowerCase() === 'operational_manager' || (role.displayName || '').toLowerCase() === 'operational manager';
                                                            const isRestrictedForOpManager = isOperationalManager && [
                                                                'settings_manage', 'apikeys_manage', 'users_view', 'users_manage', 'roles_view', 'roles_manage'
                                                            ].includes(perm.name || perm.id || perm._id);

                                                            return (
                                                                <td key={perm._id || perm.id} style={{ padding: '12px', textAlign: 'center', borderLeft: '1px solid #f1f5f9' }}>
                                                                    {isRestrictedForOpManager ? (
                                                                        <Tag color="error" style={{ fontSize: 9, fontWeight: 700, margin: 0, borderRadius: 6, padding: '1px 6px' }}>
                                                                            LOCKED
                                                                        </Tag>
                                                                    ) : (
                                                                        <div 
                                                                            className={`matrix-cell-check ${isAssigned ? 'assigned' : ''}`}
                                                                            onClick={() => handleToggleCellPermission(role._id || role.id, perm._id || perm.id)}
                                                                        >
                                                                            {isAssigned && <Check size={12} strokeWidth={3} className="text-white" />}
                                                                        </div>
                                                                    )}
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
                )}
            </div>

            {/* 4. DYNAMIC CREATE / EDIT MEMBER MODAL */}
            <Modal
                title={
                    <Space align="center" size={10}>
                        <div style={{ background: '#EEF2FF', color: '#4F46E5', padding: 6, borderRadius: 8, display: 'flex' }}>
                            <UserCheck size={16} />
                        </div>
                        <span style={{ fontWeight: 800 }}>{editingUser ? 'Configure Member Protocol' : 'Initialize Workspace Pilot'}</span>
                    </Space>
                }
                open={showUserModal}
                onCancel={() => setShowUserModal(false)}
                centered
                destroyOnClose
                width={780}
                className="glass-modal"
                footer={[
                    <Button key="back" shape="round" onClick={() => setShowUserModal(false)}>
                        Discard
                    </Button>,
                    <Button 
                        key="submit" 
                        type="primary" 
                        shape="round" 
                        onClick={handleSaveUser}
                        style={{ background: '#0f172a', borderColor: '#0f172a', fontWeight: 700 }}
                    >
                        {editingUser ? 'Save Profile' : 'Register Member'}
                    </Button>
                ]}
            >
                <div style={{ padding: '8px 0', maxHeight: '65vh', overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: 20 }}>
                    
                    {/* Basic Details Block */}
                    <Card variant="borderless" style={{ background: '#f8fafc', borderRadius: 16, border: '1px solid #e2e8f0' }} styles={{ body: { padding: 16 } }}>
                        <div style={{ fontSize: 12, fontWeight: 750, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <User size={13} /> Basic Registry Information
                        </div>
                        <Row gutter={[12, 12]}>
                            <Col span={12}>
                                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 650, color: '#334155', marginBottom: 5 }}>FIRST NAME *</label>
                                <Input 
                                    placeholder="John" 
                                    value={userFormData.firstName}
                                    onChange={e => setUserFormData({ ...userFormData, firstName: e.target.value })}
                                    style={{ borderRadius: 8 }}
                                />
                            </Col>
                            <Col span={12}>
                                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 650, color: '#334155', marginBottom: 5 }}>LAST NAME *</label>
                                <Input 
                                    placeholder="Doe" 
                                    value={userFormData.lastName}
                                    onChange={e => setUserFormData({ ...userFormData, lastName: e.target.value })}
                                    style={{ borderRadius: 8 }}
                                />
                            </Col>
                            <Col span={12}>
                                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 650, color: '#334155', marginBottom: 5 }}>EMAIL ADDRESS *</label>
                                <Input 
                                    type="email"
                                    disabled={!!editingUser}
                                    placeholder="pilot@retailops.com" 
                                    value={userFormData.email}
                                    onChange={e => setUserFormData({ ...userFormData, email: e.target.value })}
                                    style={{ borderRadius: 8 }}
                                />
                            </Col>
                            <Col span={12}>
                                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 650, color: '#334155', marginBottom: 5 }}>PHONE NUMBER</label>
                                <Input 
                                    placeholder="+91 98765 43210" 
                                    value={userFormData.phone}
                                    onChange={e => setUserFormData({ ...userFormData, phone: e.target.value })}
                                    style={{ borderRadius: 8 }}
                                />
                            </Col>
                            {!editingUser && (
                                <Col span={24}>
                                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 650, color: '#334155', marginBottom: 5 }}>TEMPORARY GATEWAY PASSWORD *</label>
                                    <Input 
                                        type="password"
                                        placeholder="Minimum 6 alphanumeric characters..." 
                                        value={userFormData.password}
                                        onChange={e => setUserFormData({ ...userFormData, password: e.target.value })}
                                        style={{ borderRadius: 8 }}
                                    />
                                </Col>
                            )}
                        </Row>
                    </Card>

                    {/* Roles Block */}
                    <Card variant="borderless" style={{ background: '#f8fafc', borderRadius: 16, border: '1px solid #e2e8f0' }} styles={{ body: { padding: 16 } }}>
                        <div style={{ fontSize: 12, fontWeight: 750, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Shield size={13} /> Organization Security Protocol
                        </div>
                        <label style={{ display: 'block', fontSize: 11.5, fontWeight: 650, color: '#334155', marginBottom: 5 }}>ACCESS PRIVILEGE ROLE *</label>
                        <Select 
                            style={{ width: '100%' }}
                            placeholder="Configure Authorization Level"
                            value={userFormData.role || undefined}
                            onChange={handleUserRoleChange}
                            dropdownStyle={{ borderRadius: 10 }}
                        >
                            {roles.map(r => <Option key={r._id || r.id} value={r._id || r.id}>{r.displayName}</Option>)}
                        </Select>
                    </Card>

                    {/* Supervisors Selection Panel */}
                    {!isBrandManager && (
                        <Card variant="borderless" style={{ borderRadius: 16, border: '1px solid #e2e8f0' }} styles={{ body: { padding: 16 } }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <div style={{ fontSize: 12, fontWeight: 750, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <UserCheck size={13} className="text-indigo-500" /> Map Direct Supervisors
                                </div>
                                <Badge count={`${userFormData.supervisors.length} Selected`} style={{ backgroundColor: '#4f46e5', fontWeight: 700, fontSize: 10 }} />
                            </div>

                            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                                <Input 
                                    prefix={<Search size={12} />} 
                                    size="small"
                                    placeholder="Query supervisors catalogue..." 
                                    value={modalSearchSupervisor}
                                    onChange={e => setModalSearchSupervisor(e.target.value)}
                                    style={{ borderRadius: 6 }}
                                />
                                <Button size="small" onClick={() => setUserFormData({ ...userFormData, supervisors: managers.map(m => m._id || m.id) })} style={{ fontSize: 11, fontWeight: 600 }}>All</Button>
                                <Button size="small" onClick={() => setUserFormData({ ...userFormData, supervisors: [] })} style={{ fontSize: 11, fontWeight: 600 }}>Wipe</Button>
                            </div>

                            <div style={{ maxHeight: 180, overflowY: 'auto', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 10 }}>
                                <Row gutter={[8, 8]}>
                                    {(() => {
                                        const filtered = managers.filter(m => `${m.firstName} ${m.lastName} ${m.email}`.toLowerCase().includes(modalSearchSupervisor.toLowerCase()));
                                        if (filtered.length === 0) return <Col span={24}><div style={{ textAlign: 'center', padding: 12, color: '#94a3b8', fontSize: 11.5 }}>No active accounts found.</div></Col>;
                                        return filtered.map(m => {
                                            const isChecked = userFormData.supervisors.includes(m._id || m.id);
                                            return (
                                                <Col key={m._id || m.id} span={12}>
                                                    <div 
                                                        className={`selection-item-card ${isChecked ? 'selected' : ''}`}
                                                        onClick={() => {
                                                            const updated = isChecked 
                                                                ? userFormData.supervisors.filter(id => id !== (m._id || m.id))
                                                                : [...userFormData.supervisors, (m._id || m.id)];
                                                            setUserFormData({ ...userFormData, supervisors: updated });
                                                        }}
                                                    >
                                                        <Space size={8}>
                                                            <Avatar size="small" style={{ backgroundColor: isChecked ? '#4f46e5' : '#e2e8f0', fontSize: 10, fontWeight: 700 }}>
                                                                {renderInitials(m.firstName, m.lastName)}
                                                            </Avatar>
                                                            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                                                                <span style={{ fontWeight: 700, fontSize: 12, color: '#334155' }}>{m.firstName} {m.lastName}</span>
                                                                <span style={{ fontSize: 10, color: '#64748b' }}>{m.role?.displayName || 'SuperAdmin'}</span>
                                                            </div>
                                                        </Space>
                                                        <div className={`selection-checkbox ${isChecked ? 'active' : ''}`}>
                                                            {isChecked && <Check size={10} className="text-white" strokeWidth={3} />}
                                                        </div>
                                                    </div>
                                                </Col>
                                            );
                                        });
                                    })()}
                                </Row>
                            </div>
                        </Card>
                    )}

                    {/* Listing Team Manager Mapping Panel */}
                    {isListingTeam && (
                        <Card variant="borderless" style={{ borderRadius: 16, border: '1px solid #e2e8f0' }} styles={{ body: { padding: 16 } }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <div style={{ fontSize: 12, fontWeight: 750, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <UserCheck size={13} className="text-emerald-500" /> Assign Brand Managers
                                </div>
                                <Badge count={`${userFormData.brandManagers.length} Linked`} style={{ backgroundColor: '#10b981', fontWeight: 700, fontSize: 10 }} />
                            </div>

                            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                                <Input 
                                    prefix={<Search size={12} />} 
                                    size="small"
                                    placeholder="Query brand commanders..." 
                                    value={modalSearchBrandManager}
                                    onChange={e => setModalSearchBrandManager(e.target.value)}
                                    style={{ borderRadius: 6 }}
                                />
                                <Button size="small" onClick={() => {
                                    const bmUsers = managers.filter(m => m.role?.name?.toLowerCase() === 'brand_manager' || m.role?.displayName?.toLowerCase() === 'brand manager');
                                    setUserFormData({ ...userFormData, brandManagers: bmUsers.map(m => m._id || m.id) });
                                }} style={{ fontSize: 11, fontWeight: 600 }}>Select All</Button>
                            </div>

                            <div style={{ maxHeight: 180, overflowY: 'auto', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 10 }}>
                                <Row gutter={[8, 8]}>
                                    {(() => {
                                        const bmUsers = managers.filter(m => m.role?.name?.toLowerCase() === 'brand_manager' || m.role?.displayName?.toLowerCase() === 'brand manager');
                                        const filtered = bmUsers.filter(m => `${m.firstName} ${m.lastName} ${m.email}`.toLowerCase().includes(modalSearchBrandManager.toLowerCase()));
                                        if (filtered.length === 0) return <Col span={24}><div style={{ textAlign: 'center', padding: 12, color: '#94a3b8', fontSize: 11.5 }}>No matched brand managers available.</div></Col>;
                                        return filtered.map(m => {
                                            const isChecked = userFormData.brandManagers.includes(m._id || m.id);
                                            return (
                                                <Col key={m._id || m.id} span={12}>
                                                    <div 
                                                        className={`selection-item-card ${isChecked ? 'selected-green' : ''}`}
                                                        onClick={() => {
                                                            const updated = isChecked 
                                                                ? userFormData.brandManagers.filter(id => id !== (m._id || m.id))
                                                                : [...userFormData.brandManagers, (m._id || m.id)];
                                                            setUserFormData({ ...userFormData, brandManagers: updated });
                                                        }}
                                                    >
                                                        <Space size={8}>
                                                            <Avatar size="small" style={{ backgroundColor: isChecked ? '#10b981' : '#e2e8f0', fontSize: 10, fontWeight: 700 }}>
                                                                {renderInitials(m.firstName, m.lastName)}
                                                            </Avatar>
                                                            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                                                                <span style={{ fontWeight: 700, fontSize: 12, color: '#334155' }}>{m.firstName} {m.lastName}</span>
                                                                <span style={{ fontSize: 10, color: '#64748b' }}>{m.email}</span>
                                                            </div>
                                                        </Space>
                                                        <div className={`selection-checkbox ${isChecked ? 'active-green' : ''}`}>
                                                            {isChecked && <Check size={10} className="text-white" strokeWidth={3} />}
                                                        </div>
                                                    </div>
                                                </Col>
                                            );
                                        });
                                    })()}
                                </Row>
                            </div>
                        </Card>
                    )}

                    {/* Brands Association Grid */}
                    <Card variant="borderless" style={{ borderRadius: 16, border: '1px solid #e2e8f0' }} styles={{ body: { padding: 16 } }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <div style={{ fontSize: 12, fontWeight: 750, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Store size={13} className="text-emerald-500" /> Client Brands Association
                            </div>
                            <Badge count={`${isListingTeam ? inheritedSellers.length : userFormData.assignedSellers.length} Associated`} style={{ backgroundColor: '#059669', fontWeight: 700, fontSize: 10 }} />
                        </div>

                        {isListingTeam && (
                            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 12px', marginBottom: 12, display: 'flex', gap: 8 }}>
                                <Info size={14} className="text-blue-600" style={{ marginTop: 2, flexShrink: 0 }} />
                                <div style={{ fontSize: 11.5, color: '#1e40af', fontWeight: 500 }}>
                                    <strong>Brand Inheritance Protocol:</strong> Access rights are dynamic and derived automatically from assigned brand commanders.
                                </div>
                            </div>
                        )}

                        {isCatalogManager && (
                            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 12px', marginBottom: 12, display: 'flex', gap: 8 }}>
                                <AlertCircle size={14} className="text-amber-600" style={{ marginTop: 2, flexShrink: 0 }} />
                                <div style={{ fontSize: 11.5, color: '#92400e', fontWeight: 500 }}>
                                    <strong>Catalog Access Layer:</strong> Read-only access configured. Brand association parameters cannot be modified.
                                </div>
                            </div>
                        )}

                        {!isListingTeam && (
                            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                                <Input 
                                    prefix={<Search size={12} />} 
                                    size="small"
                                    placeholder="Search active storefronts..." 
                                    value={modalSearchSeller}
                                    onChange={e => setModalSearchSeller(e.target.value)}
                                    style={{ borderRadius: 6 }}
                                />
                                <Button size="small" onClick={() => setUserFormData({ ...userFormData, assignedSellers: sellers.map(s => s._id || s.id) })} style={{ fontSize: 11, fontWeight: 600 }}>Link All</Button>
                                <Button size="small" onClick={() => setUserFormData({ ...userFormData, assignedSellers: [] })} style={{ fontSize: 11, fontWeight: 600 }}>Wipe</Button>
                            </div>
                        )}

                        <div style={{ maxHeight: 180, overflowY: 'auto', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 10 }}>
                            <Row gutter={[8, 8]}>
                                {(() => {
                                    const listToRender = isListingTeam ? inheritedSellers : sellers;
                                    const filtered = listToRender.filter(s => `${s.name} ${s.code || ''}`.toLowerCase().includes(modalSearchSeller.toLowerCase()));
                                    if (filtered.length === 0) {
                                        return <Col span={24}><div style={{ textAlign: 'center', padding: 12, color: '#94a3b8', fontSize: 11.5 }}>
                                            {isListingTeam ? 'Link brand managers to fetch associations.' : 'No matched brands found.'}
                                        </div></Col>;
                                    }
                                    return filtered.map(s => {
                                        const isChecked = isListingTeam ? true : userFormData.assignedSellers.includes(s._id || s.id);
                                        const isReadOnly = isListingTeam;
                                        return (
                                            <Col key={s._id || s.id} span={12} style={isReadOnly ? { pointerEvents: 'none' } : {}}>
                                                <div 
                                                    className={`selection-item-card ${isChecked ? 'selected-green' : ''}`}
                                                    onClick={() => {
                                                        if (isReadOnly) return;
                                                        const updated = isChecked 
                                                            ? userFormData.assignedSellers.filter(id => id !== (s._id || s.id))
                                                            : [...userFormData.assignedSellers, (s._id || s.id)];
                                                        setUserFormData({ ...userFormData, assignedSellers: updated });
                                                    }}
                                                >
                                                    <Space size={8}>
                                                        <div style={{ width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: isChecked ? '#d1fae5' : '#e2e8f0', color: isChecked ? '#10b981' : '#64748b' }}>
                                                            <Store size={12} />
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                                                            <span style={{ fontWeight: 700, fontSize: 12, color: '#334155' }}>{s.name}</span>
                                                            <span style={{ fontSize: 10, color: '#64748b' }}>{s.code || 'Storefront'}</span>
                                                        </div>
                                                    </Space>
                                                    <div className={`selection-checkbox ${isChecked ? 'active-green' : ''}`}>
                                                        {isChecked && <Check size={10} className="text-white" strokeWidth={3} />}
                                                    </div>
                                                </div>
                                            </Col>
                                        );
                                    });
                                })()}
                            </Row>
                        </div>
                    </Card>
                </div>
            </Modal>

            {/* 5. ROLE SPECIFICATIONS MODAL */}
            <Modal
                title={
                    <Space align="center" size={10}>
                        <div style={{ background: '#F5F3FF', color: '#8B5CF6', padding: 6, borderRadius: 8, display: 'flex' }}>
                            <Shield size={16} />
                        </div>
                        <span style={{ fontWeight: 800 }}>{editingRole ? 'Configure Role Blueprint' : 'Construct Custom Role'}</span>
                    </Space>
                }
                open={showRoleModal}
                onCancel={() => setShowRoleModal(false)}
                centered
                destroyOnClose
                width={500}
                className="glass-modal"
                footer={[
                    <Button key="back" shape="round" onClick={() => setShowRoleModal(false)}>
                        Abort
                    </Button>,
                    <Button 
                        key="submit" 
                        type="primary" 
                        shape="round" 
                        onClick={handleSaveRole}
                        style={{ background: '#0f172a', borderColor: '#0f172a', fontWeight: 700 }}
                    >
                        {editingRole ? 'Update Access' : 'Deploy Role'}
                    </Button>
                ]}
            >
                <div style={{ padding: '8px 0' }}>
                    <Form layout="vertical">
                        <Form.Item label={<span style={{ fontSize: 12, fontWeight: 750, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#475569' }}>Technical Reference Name</span>}>
                            <Input 
                                disabled={!!editingRole}
                                placeholder="e.g. analyst_l2" 
                                value={roleFormData.name}
                                onChange={e => setRoleFormData({ ...roleFormData, name: e.target.value })}
                                style={{ borderRadius: 8 }}
                            />
                        </Form.Item>
                        <Form.Item label={<span style={{ fontSize: 12, fontWeight: 750, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#475569' }}>Display Interface Label *</span>} required>
                            <Input 
                                placeholder="e.g. Senior Operations Analyst" 
                                value={roleFormData.displayName}
                                onChange={e => setRoleFormData({ ...roleFormData, displayName: e.target.value })}
                                style={{ borderRadius: 8 }}
                            />
                        </Form.Item>
                        <Row gutter={12}>
                            <Col span={12}>
                                <Form.Item label={<span style={{ fontSize: 11.5, fontWeight: 750, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#475569' }}>Hierarchy Level (0-100)</span>}>
                                    <Input 
                                        type="number" 
                                        min={0} max={100}
                                        value={roleFormData.level}
                                        onChange={e => setRoleFormData({ ...roleFormData, level: parseInt(e.target.value) || 0 })}
                                        style={{ borderRadius: 8 }}
                                    />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item label={<span style={{ fontSize: 11.5, fontWeight: 750, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#475569' }}>Interface Theme Color</span>}>
                                    <Space size={8} style={{ width: '100%' }}>
                                        <Input 
                                            type="color" 
                                            value={roleFormData.color}
                                            onChange={e => setRoleFormData({ ...roleFormData, color: e.target.value })}
                                            style={{ width: 44, height: 36, padding: '4px 6px', cursor: 'pointer' }}
                                        />
                                        <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>{roleFormData.color}</span>
                                    </Space>
                                </Form.Item>
                            </Col>
                        </Row>
                        <Form.Item label={<span style={{ fontSize: 12, fontWeight: 750, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#475569' }}>Strategy Description</span>}>
                            <TextArea 
                                rows={3}
                                placeholder="Define access boundary scopes for this custom role..."
                                value={roleFormData.description}
                                onChange={e => setRoleFormData({ ...roleFormData, description: e.target.value })}
                                style={{ borderRadius: 8 }}
                            />
                        </Form.Item>
                    </Form>
                </div>
            </Modal>
        </div>
    );
};

export default UsersPage;
