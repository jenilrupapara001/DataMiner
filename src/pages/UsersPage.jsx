import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { userApi, roleApi } from '../services/api';
import { useSocket } from '../contexts/SocketContext';
import {
    Users, Shield, UserPlus, Search, Pencil, Trash2, Mail, Phone,
    Clock, CheckCircle2, XCircle, Info, UserCheck, RefreshCw, Store, Check,
    SlidersHorizontal, Lock, Plus, ArrowRight, User, AlertCircle, Target, Send,
    TrendingUp, TrendingDown, Eye, Crown, Briefcase, MoreHorizontal
} from 'lucide-react';
import { PageLoader } from '@/components/application/loading-indicator/PageLoader';
import {
    Space, Button, Segmented, Table, Modal, Card, Input, Row, Col,
    Typography, Tag, Tooltip, Form, Select, Switch, Avatar, Badge, Divider,
    notification, message as antdMessage, Popconfirm, Drawer, Empty
} from 'antd';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

// ============================================
// HELPER FUNCTIONS
// ============================================

// Generate consistent gradient based on initials
const getAvatarGradient = (firstName = '', lastName = '') => {
    const initials = (firstName[0] || '') + (lastName[0] || '');
    const gradients = [
        'linear-gradient(135deg, #4f46e5, #7c3aed)',
        'linear-gradient(135deg, #ec4899, #db2777)',
        'linear-gradient(135deg, #10b981, #059669)',
        'linear-gradient(135deg, #f59e0b, #d97706)',
        'linear-gradient(135deg, #06b6d4, #0891b2)',
        'linear-gradient(135deg, #8b5cf6, #6d28d9)',
        'linear-gradient(135deg, #ef4444, #dc2626)',
        'linear-gradient(135deg, #14b8a6, #0d9488)',
        'linear-gradient(135deg, #f97316, #ea580c)',
        'linear-gradient(135deg, #6366f1, #4f46e5)',
    ];

    const hash = initials.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return gradients[hash % gradients.length];
};

// Get role color
const getRoleColor = (roleName) => {
    const colors = {
        'super_admin': '#dc2626',
        'admin': '#ea580c',
        'operational_manager': '#7c3aed',
        'finance_manager': '#0891b2',
        'brand_manager': '#2563eb',
        'catalog_manager': '#db2777',
        'team_lead': '#9333ea',
        'listing_team': '#16a34a',
        'senior_executive': '#0d9488',
        'executive': '#64748b',
        'viewer': '#71717a'
    };
    return colors[roleName?.toLowerCase()] || '#64748b';
};

// Field Label Component
const FieldLabel = ({ children }) => (
    <div style={{
        fontSize: 11,
        fontWeight: 700,
        color: '#475569',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        marginBottom: 6
    }}>
        {children}
    </div>
);

// Enhanced Avatar Component
const EnhancedAvatar = ({ firstName, lastName, size = 40, showStatus = false, isOnline = false }) => {
    const initials = `${(firstName || '')[0]?.toUpperCase() || ''}${(lastName || '')[0]?.toUpperCase() || ''}` || 'U';
    const gradient = getAvatarGradient(firstName, lastName);

    return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
            <div style={{
                width: size,
                height: size,
                borderRadius: '50%',
                background: gradient,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: size * 0.4,
                fontWeight: 700,
                border: '2px solid white',
                boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
                letterSpacing: '0.02em',
                transition: 'transform 0.2s ease'
            }}>
                {initials}
            </div>
            {showStatus && (
                <div style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: size * 0.25,
                    height: size * 0.25,
                    borderRadius: '50%',
                    background: isOnline ? '#10b981' : '#94a3b8',
                    border: '2px solid white',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    animation: isOnline ? 'pulse 2s infinite' : 'none'
                }} />
            )}
        </div>
    );
};

// Enhanced Role Badge Component
const RoleBadge = ({ role }) => {
    if (!role) return null;

    const color = role.color || getRoleColor(role.name);

    return (
        <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            background: `${color}15`,
            border: `1px solid ${color}30`,
            borderRadius: 12,
            transition: 'all 0.2s ease',
            cursor: 'default'
        }}>
            <div style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: color,
                boxShadow: `0 0 0 2px ${color}20`
            }} />
            <span style={{
                fontSize: 11,
                fontWeight: 700,
                color: color,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                lineHeight: 1
            }}>
                {role.displayName || 'Standard'}
            </span>
        </div>
    );
};

// Enhanced Stat Card Component
const StatCard = ({ icon: Icon, label, value, subtitle, trend, gradient, onClick, isLive = false }) => (
    <div
        onClick={onClick}
        style={{
            flex: 1,
            background: 'white',
            border: '1px solid #f1f5f9',
            borderRadius: 12,
            padding: 20,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            position: 'relative',
            overflow: 'hidden'
        }}
        onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#cbd5e1';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
            e.currentTarget.style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#f1f5f9';
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.transform = 'translateY(0)';
        }}
    >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: gradient,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}>
                <Icon size={20} color="white" strokeWidth={2.2} />
            </div>

            {trend && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                    padding: '3px 8px',
                    background: trend.positive ? '#dcfce7' : '#fee2e2',
                    color: trend.positive ? '#15803d' : '#dc2626',
                    borderRadius: 6,
                    fontSize: 10,
                    fontWeight: 700
                }}>
                    {trend.positive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    {trend.value}
                </div>
            )}
        </div>

        <div style={{
            fontSize: 28,
            fontWeight: 800,
            color: '#0f172a',
            lineHeight: 1,
            marginBottom: 6,
            letterSpacing: '-0.02em'
        }}>
            {value}
        </div>

        <div style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 4
        }}>
            {label}
        </div>

        {subtitle && (
            <div style={{
                fontSize: 12,
                color: '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                gap: 4
            }}>
                {isLive && (
                    <span style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: '#10b981',
                        animation: 'pulse 2s infinite'
                    }} />
                )}
                {subtitle}
            </div>
        )}
    </div>
);

// Format Last Active Time
const formatLastActive = (timestamp) => {
    if (!timestamp) return { text: 'Never', color: '#94a3b8', isOnline: false };

    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return { text: 'Just now', color: '#059669', isOnline: true };
    if (diff < 300000) return { text: 'Online now', color: '#059669', isOnline: true };
    if (diff < 3600000) return { text: `${Math.floor(diff / 60000)}m ago`, color: '#0891b2', isOnline: false };
    if (diff < 86400000) return { text: `${Math.floor(diff / 3600000)}h ago`, color: '#f59e0b', isOnline: false };
    if (diff < 604800000) return { text: `${Math.floor(diff / 86400000)}d ago`, color: '#ea580c', isOnline: false };
    return {
        text: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        color: '#ef4444',
        isOnline: false
    };
};

const UsersPage = () => {
    const socket = useSocket();
    const [messageApi, messageContextHolder] = antdMessage.useMessage();
    const [notificationApi, notificationContextHolder] = notification.useNotification();

    const [activeTab, setActiveTab] = useState('users');
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [matrixRoles, setMatrixRoles] = useState([]);
    const [matrixSaving, setMatrixSaving] = useState(false);
    const [sellers, setSellers] = useState([]);
    const [managers, setManagers] = useState([]);
    const [groupedPermissions, setGroupedPermissions] = useState({});
    const [allPermissions, setAllPermissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [selectedRole, setSelectedRole] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalRecords, setTotalRecords] = useState(0);
    const [serverActiveCount, setServerActiveCount] = useState(0);
    const [serverInactiveCount, setServerInactiveCount] = useState(0);
    const [permissionSearch, setPermissionSearch] = useState('');
    const [showUserModal, setShowUserModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [userFormData, setUserFormData] = useState({
        email: '', password: '', firstName: '', lastName: '', phone: '',
        role: '', isActive: true, assignedSellers: [], brandManagers: [], supervisors: []
    });
    const [modalSearchSupervisor, setModalSearchSupervisor] = useState('');
    const [modalSearchBrandManager, setModalSearchBrandManager] = useState('');
    const [modalSearchSeller, setModalSearchSeller] = useState('');
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailUser, setEmailUser] = useState(null);
    const [emailForm, setEmailForm] = useState({ subject: '', message: '' });
    const [sendingEmail, setSendingEmail] = useState(false);
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [showProfileDrawer, setShowProfileDrawer] = useState(false);
    const [profileUser, setProfileUser] = useState(null);
    const [editingRole, setEditingRole] = useState(null);
    const [roleFormData, setRoleFormData] = useState({
        name: '', displayName: '', description: '', level: 30, color: '#1e293b'
    });

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchText);
            setCurrentPage(1);
        }, 300);
        return () => clearTimeout(handler);
    }, [searchText]);

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
                return (m.assignedSellers || []).includes(s._id || s.id);
            });
        });
    }, [sellers, managers, userFormData.brandManagers]);

    const activeCount = useMemo(() => serverActiveCount, [serverActiveCount]);
    const totalRecordCount = useMemo(() => totalRecords || users.length, [totalRecords, users]);
    const inactiveCount = useMemo(() => serverInactiveCount, [serverInactiveCount]);

    const loadUsers = useCallback(async () => {
        setLoading(true);
        try {
            const params = {
                page: currentPage, limit: pageSize,
                search: debouncedSearch, role: selectedRole, isActive: selectedStatus
            };
            const response = await userApi.getAll(params);
            if (response.success) {
                setUsers(response.data.users || []);
                setTotalRecords(response.data.pagination?.total || 0);
                setServerActiveCount(response.data.pagination?.activeCount || 0);
                setServerInactiveCount(response.data.pagination?.inactiveCount || 0);
            }
        } catch (error) {
            console.error('Failed to load users:', error);
            messageApi.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    }, [currentPage, pageSize, debouncedSearch, selectedRole, selectedStatus]);

    const loadRolesAndPerms = useCallback(async () => {
        try {
            const [rolesRes, permsRes] = await Promise.all([
                userApi.getRoles(), roleApi.getPermissions()
            ]);
            if (rolesRes.success) {
                const rolesData = rolesRes.data?.roles || rolesRes.data || [];
                const allRoles = Array.isArray(rolesData) ? rolesData : [];
                setRoles(allRoles);
                setMatrixRoles(JSON.parse(JSON.stringify(allRoles)));
            }
            if (permsRes.success) {
                setGroupedPermissions(permsRes.data?.groupedPermissions || {});
                setAllPermissions(permsRes.data?.permissions || []);
            }
        } catch (error) {
            console.error('Failed to load roles:', error);
        }
    }, []);

    const loadSellersAndManagers = useCallback(async () => {
        try {
            const [sellersRes, managersRes] = await Promise.all([
                userApi.getSellers(), userApi.getManagers()
            ]);
            const sellersData = sellersRes?.data?.sellers || sellersRes?.data || [];
            setSellers(Array.isArray(sellersData) ? sellersData : []);
            if (managersRes.success) setManagers(managersRes.data || []);
        } catch (error) {
            console.error('Failed to load sellers:', error);
        }
    }, []);

    useEffect(() => { loadUsers(); }, [loadUsers]);
    useEffect(() => { loadRolesAndPerms(); loadSellersAndManagers(); }, [loadRolesAndPerms, loadSellersAndManagers]);

    useEffect(() => {
        if (!socket) return;
        const handler = (updatedRole) => {
            setRoles(prev => prev.map(role =>
                (role._id === updatedRole._id || role.id === updatedRole.id) ? updatedRole : role
            ));
        };
        socket.on('role_permissions_updated', handler);
        return () => socket.off('role_permissions_updated', handler);
    }, [socket]);

    const handleToggleStatus = useCallback(async (userId) => {
        try {
            await userApi.toggleStatus(userId);
            messageApi.success('User status updated');
            setUsers(prev => prev.map(u =>
                (u._id === userId || u.id === userId) ? { ...u, isActive: !u.isActive } : u
            ));
        } catch (error) {
            messageApi.error(error.message || 'Failed to toggle status');
        }
    }, [messageApi]);

    const handleDeleteUser = useCallback(async (userId) => {
        try {
            await userApi.delete(userId);
            messageApi.success('User removed');
            setUsers(prev => prev.filter(u => u._id !== userId && u.id !== userId));
            setTotalRecords(prev => Math.max(0, prev - 1));
        } catch (error) {
            messageApi.error(error.message || 'Failed to remove user');
        }
    }, [messageApi]);

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
                    email: fullUser.email || '', password: '',
                    firstName: fullUser.firstName || '', lastName: fullUser.lastName || '',
                    phone: fullUser.phone || '',
                    role: fullUser.role?._id || fullUser.role?.id || fullUser.role || '',
                    isActive: fullUser.isActive !== undefined ? fullUser.isActive : true,
                    assignedSellers: fullUser.assignedSellers?.map(s => s._id || s.id || s) || [],
                    brandManagers: fullUser.brandManagers?.map(s => s._id || s.id || s) || [],
                    supervisors: fullUser.supervisors?.map(s => s._id || s.id || s) || []
                });
            } catch {
                setEditingUser(user);
                setUserFormData({
                    email: user.email || '', password: '',
                    firstName: user.firstName || '', lastName: user.lastName || '',
                    phone: user.phone || '',
                    role: user.role?._id || user.role?.id || user.role || '',
                    isActive: user.isActive !== undefined ? user.isActive : true,
                    assignedSellers: user.assignedSellers?.map(s => s._id || s.id || s) || [],
                    brandManagers: user.brandManagers?.map(s => s._id || s.id || s) || [],
                    supervisors: user.supervisors?.map(s => s._id || s.id || s) || []
                });
            }
        } else {
            setEditingUser(null);
            setUserFormData({
                email: '', password: '', firstName: '', lastName: '', phone: '',
                role: '', isActive: true, assignedSellers: [], brandManagers: [], supervisors: []
            });
        }
        setShowUserModal(true);
    };

    const handleUserRoleChange = (roleId) => {
        const sel = roles.find(r => r._id === roleId || r.id === roleId);
        const isBM = sel?.name === 'brand_manager' || sel?.displayName === 'Brand Manager';
        setUserFormData(prev => ({
            ...prev, role: roleId,
            assignedSellers: isBM ? sellers.map(s => s._id || s.id) : prev.assignedSellers
        }));
    };

    const handleSaveUser = async () => {
        if (!userFormData.firstName || !userFormData.lastName || !userFormData.email || !userFormData.role) {
            messageApi.warning('Please complete all required fields');
            return;
        }
        try {
            const sel = roles.find(r => r._id === userFormData.role || r.id === userFormData.role);
            const rn = sel?.name?.toLowerCase() || '';
            const rdn = sel?.displayName?.toLowerCase() || '';
            const isLT = rn === 'listing_team' || rdn === 'listing team';

            let finalSellers = userFormData.assignedSellers;
            if (isLT) {
                const ids = [];
                sellers.forEach(s => {
                    const inherited = managers.some(m => {
                        if (!userFormData.brandManagers.includes(m._id || m.id)) return false;
                        return (m.assignedSellers || []).includes(s._id || s.id);
                    });
                    if (inherited) ids.push(s._id || s.id);
                });
                finalSellers = ids;
            }

            const data = {
                ...userFormData, roleId: userFormData.role,
                assignedSellerIds: finalSellers,
                brandManagers: userFormData.brandManagers,
                supervisors: userFormData.supervisors
            };

            if (editingUser) {
                await userApi.update(editingUser._id || editingUser.id, data);
                messageApi.success('User updated successfully');
            } else {
                await userApi.create(data);
                messageApi.success('User created successfully');
            }
            setShowUserModal(false);
            loadUsers();
        } catch (error) {
            messageApi.error(error.message || 'Failed to save user');
        }
    };

    const handleSendEmail = (user) => {
        setEmailUser(user);
        setEmailForm({ subject: '', message: '' });
        setShowEmailModal(true);
    };

    const handleSendEmailSubmit = async () => {
        if (!emailForm.subject || !emailForm.message) {
            messageApi.error('Subject and message are required');
            return;
        }
        setSendingEmail(true);
        try {
            const result = await userApi.sendEmail({
                userId: emailUser._id || emailUser.id,
                subject: emailForm.subject, message: emailForm.message
            });
            if (result?.success) {
                messageApi.success('Email sent successfully');
                setShowEmailModal(false);
            } else {
                messageApi.error(result?.message || 'Failed to send email');
            }
        } catch (error) {
            messageApi.error(error.message || 'Failed to send email');
        } finally {
            setSendingEmail(false);
        }
    };

    const handleToggleCellPermission = (roleId, permId) => {
        setMatrixRoles(prev => prev.map(r => {
            if ((r._id || r.id) === roleId) {
                const ids = r.permissions?.map(p => p._id || p.id || p) || [];
                const isAssigned = ids.includes(permId);
                const updated = isAssigned ? ids.filter(id => id !== permId) : [...ids, permId];
                const permsObjects = updated.map(id => {
                    const found = allPermissions.find(p => p._id === id || p.id === id);
                    return found || { id, _id: id };
                });
                return { ...r, permissions: permsObjects };
            }
            return r;
        }));
    };

    const handleSaveMatrixPermissions = async () => {
        setMatrixSaving(true);
        try {
            for (const r of matrixRoles) {
                const ids = r.permissions?.map(p => p._id || p.id || p) || [];
                await roleApi.update(r._id || r.id, { permissions: ids });
                if (socket) socket.emit('update_role_permissions', { roleId: r._id || r.id, permissions: ids });
            }
            notificationApi.success({
                message: 'Permissions Saved',
                description: 'Access control matrix has been updated.',
                placement: 'topRight'
            });
            await loadRolesAndPerms();
        } catch (error) {
            messageApi.error(error.message || 'Failed to save permissions');
        } finally {
            setMatrixSaving(false);
        }
    };

    const handleOpenRoleModal = (role = null) => {
        if (role) {
            setEditingRole(role);
            setRoleFormData({
                name: role.name || '', displayName: role.displayName || '',
                description: role.description || '', level: role.level || 30,
                color: role.color || '#1e293b'
            });
        } else {
            setEditingRole(null);
            setRoleFormData({ name: '', displayName: '', description: '', level: 30, color: '#1e293b' });
        }
        setShowRoleModal(true);
    };

    const handleSaveRole = async () => {
        if (!roleFormData.displayName) {
            messageApi.warning('Display name is required');
            return;
        }
        try {
            const nameSlug = roleFormData.name || roleFormData.displayName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
            const data = { ...roleFormData, name: nameSlug };
            if (editingRole) {
                await roleApi.update(editingRole._id || editingRole.id, data);
                messageApi.success('Role updated');
            } else {
                await roleApi.create(data);
                messageApi.success('Role created');
            }
            setShowRoleModal(false);
            loadRolesAndPerms();
        } catch (error) {
            messageApi.error(error.message || 'Failed to save role');
        }
    };

    const handleDeleteRole = async (roleId) => {
        try {
            await roleApi.delete(roleId);
            messageApi.success('Role deleted');
            loadRolesAndPerms();
        } catch (error) {
            messageApi.error(error.message || 'Failed to delete role');
        }
    };

    const filteredGroupedPermissions = useMemo(() => {
        if (!permissionSearch) return groupedPermissions;
        const result = {};
        Object.entries(groupedPermissions).forEach(([cat, perms]) => {
            const filtered = perms.filter(p =>
                p.displayName?.toLowerCase().includes(permissionSearch.toLowerCase()) ||
                p.name?.toLowerCase().includes(permissionSearch.toLowerCase())
            );
            if (filtered.length > 0) result[cat] = filtered;
        });
        return result;
    }, [groupedPermissions, permissionSearch]);

    const filteredSupervisors = useMemo(() => {
        const q = modalSearchSupervisor.toLowerCase();
        return managers.filter(m =>
            `${m.firstName || ''} ${m.lastName || ''} ${m.email || ''}`.toLowerCase().includes(q)
        );
    }, [managers, modalSearchSupervisor]);

    const filteredBrandManagers = useMemo(() => {
        const q = modalSearchBrandManager.toLowerCase();
        return managers.filter(m =>
            m.role?.name?.toLowerCase() === 'brand_manager' || m.role?.displayName?.toLowerCase() === 'brand manager'
        ).filter(m =>
            `${m.firstName || ''} ${m.lastName || ''} ${m.email || ''}`.toLowerCase().includes(q)
        );
    }, [managers, modalSearchBrandManager]);

    const filteredSellers = useMemo(() => {
        const list = isListingTeam ? inheritedSellers : sellers;
        const q = modalSearchSeller.toLowerCase();
        return list.filter(s => `${s.name || ''} ${s.code || ''}`.toLowerCase().includes(q));
    }, [isListingTeam, inheritedSellers, sellers, modalSearchSeller]);

    // ============================================
    // ENHANCED TABLE COLUMNS
    // ============================================
    const columns = useMemo(() => [
        {
            title: 'Name',
            key: 'name',
            width: 320,
            render: (_, record) => {
                const lastActive = formatLastActive(record.lastSeen);
                return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <EnhancedAvatar
                            firstName={record.firstName}
                            lastName={record.lastName}
                            size={40}
                            showStatus={true}
                            isOnline={lastActive.isOnline}
                        />
                        <div>
                            <div style={{
                                fontSize: 14,
                                fontWeight: 600,
                                color: '#0f172a',
                                marginBottom: 2,
                                transition: 'color 0.2s'
                            }}>
                                {record.firstName} {record.lastName}
                            </div>
                            <div style={{
                                fontSize: 12,
                                color: '#64748b',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4
                            }}>
                                <Mail size={11} strokeWidth={2} style={{ color: '#94a3b8' }} />
                                {record.email}
                            </div>
                        </div>
                    </div>
                );
            }
        },
        {
            title: 'Role',
            key: 'role',
            width: 200,
            render: (_, record) => {
                const roleId = record.role?._id || record.role?.id || record.role;
                const resolved = roles.find(r => (r._id || r.id) === roleId) ||
                    (typeof record.role === 'object' ? record.role : null);
                return <RoleBadge role={resolved} />;
            }
        },
        {
            title: 'Supervisors',
            key: 'supervisors',
            width: 160,
            render: (_, record) => {
                const list = record.supervisors || [];
                if (list.length === 0) {
                    return (
                        <span style={{
                            fontSize: 11,
                            color: '#cbd5e1',
                            fontStyle: 'italic'
                        }}>—</span>
                    );
                }
                return (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        {list.slice(0, 3).map((s, i) => (
                            <Tooltip key={i} title={`${s.firstName} ${s.lastName}`}>
                                <div style={{
                                    marginLeft: i > 0 ? -8 : 0,
                                    transition: 'transform 0.2s',
                                    cursor: 'pointer'
                                }}
                                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                >
                                    <EnhancedAvatar
                                        firstName={s.firstName}
                                        lastName={s.lastName}
                                        size={28}
                                    />
                                </div>
                            </Tooltip>
                        ))}
                        {list.length > 3 && (
                            <Tooltip title={list.slice(3).map(s => `${s.firstName} ${s.lastName}`).join(', ')}>
                                <div style={{
                                    marginLeft: -8,
                                    width: 28,
                                    height: 28,
                                    borderRadius: '50%',
                                    background: '#f1f5f9',
                                    color: '#475569',
                                    border: '2px solid white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 10,
                                    fontWeight: 700,
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                }}>
                                    +{list.length - 3}
                                </div>
                            </Tooltip>
                        )}
                    </div>
                );
            }
        },
        {
            title: 'Status',
            dataIndex: 'isActive',
            key: 'isActive',
            width: 130,
            render: (isActive, record) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Switch
                        size="small"
                        checked={isActive}
                        onChange={() => handleToggleStatus(record._id || record.id)}
                        style={{
                            background: isActive ? '#10b981' : '#cbd5e1'
                        }}
                    />
                    <span style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: isActive ? '#047857' : '#64748b',
                        transition: 'color 0.2s'
                    }}>
                        {isActive ? 'Active' : 'Inactive'}
                    </span>
                </div>
            )
        },
        {
            title: 'Last Active',
            dataIndex: 'lastSeen',
            key: 'lastSeen',
            width: 140,
            render: (val) => {
                const lastActive = formatLastActive(val);
                return (
                    <Tooltip title={val ? new Date(val).toLocaleString() : 'Never logged in'}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Clock
                                size={11}
                                style={{ color: lastActive.color }}
                                strokeWidth={2.5}
                            />
                            <span style={{
                                fontSize: 12,
                                color: lastActive.color,
                                fontWeight: lastActive.isOnline ? 600 : 500
                            }}>
                                {lastActive.text}
                            </span>
                        </div>
                    </Tooltip>
                );
            }
        },
        {
            title: '',
            key: 'actions',
            fixed: 'right',
            width: 140,
            align: 'right',
            render: (_, record) => (
                <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                    <Tooltip title="View Profile">
                        <Button
                            type="text"
                            size="small"
                            onClick={() => { setProfileUser(record); setShowProfileDrawer(true); }}
                            icon={<Eye size={14} strokeWidth={2} />}
                            style={{
                                color: '#64748b',
                                width: 32,
                                height: 32,
                                borderRadius: 6
                            }}
                        />
                    </Tooltip>
                    <Tooltip title="Send Email">
                        <Button
                            type="text"
                            size="small"
                            onClick={() => handleSendEmail(record)}
                            icon={<Send size={14} strokeWidth={2} />}
                            style={{
                                color: '#64748b',
                                width: 32,
                                height: 32,
                                borderRadius: 6
                            }}
                        />
                    </Tooltip>
                    <Tooltip title="Edit User">
                        <Button
                            type="text"
                            size="small"
                            onClick={() => handleOpenUserModal(record)}
                            icon={<Pencil size={14} strokeWidth={2} />}
                            style={{
                                color: '#64748b',
                                width: 32,
                                height: 32,
                                borderRadius: 6
                            }}
                        />
                    </Tooltip>
                    <Popconfirm
                        title="Remove this user?"
                        description="This action cannot be undone."
                        onConfirm={() => handleDeleteUser(record._id || record.id)}
                        okButtonProps={{ danger: true }}
                        okText="Remove"
                        cancelText="Cancel"
                    >
                        <Tooltip title="Remove User">
                            <Button
                                type="text"
                                danger
                                size="small"
                                icon={<Trash2 size={14} strokeWidth={2} />}
                                style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 6
                                }}
                            />
                        </Tooltip>
                    </Popconfirm>
                </div>
            )
        }
    ], [roles, handleToggleStatus, handleDeleteUser]);

    if (loading && users.length === 0) {
        return <PageLoader message="Loading user directory..." />;
    }

    // Selection Card Component
    const SelectionCard = ({ isChecked, onClick, icon: ItemIcon, iconBg, name, subtitle, readOnly = false }) => (
        <div
            onClick={readOnly ? undefined : onClick}
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                background: isChecked ? '#eff6ff' : '#ffffff',
                border: `2px solid ${isChecked ? '#3b82f6' : '#e2e8f0'}`,
                borderRadius: 8,
                cursor: readOnly ? 'default' : 'pointer',
                transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
                if (!readOnly && !isChecked) {
                    e.currentTarget.style.borderColor = '#cbd5e1';
                    e.currentTarget.style.background = '#fafbfc';
                    e.currentTarget.style.transform = 'translateX(2px)';
                }
            }}
            onMouseLeave={(e) => {
                if (!readOnly && !isChecked) {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.background = '#ffffff';
                    e.currentTarget.style.transform = 'translateX(0)';
                }
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isChecked ? (iconBg || '#3b82f6') : '#f1f5f9',
                    color: isChecked ? '#ffffff' : '#64748b',
                    fontSize: 11, fontWeight: 700,
                    transition: 'all 0.2s'
                }}>
                    {ItemIcon ? <ItemIcon size={14} /> : name?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{name}</div>
                    {subtitle && <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{subtitle}</div>}
                </div>
            </div>
            <div style={{
                width: 20, height: 20, borderRadius: '50%',
                border: `2px solid ${isChecked ? '#3b82f6' : '#cbd5e1'}`,
                background: isChecked ? '#3b82f6' : '#ffffff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s'
            }}>
                {isChecked && <Check size={12} color="#ffffff" strokeWidth={3} />}
            </div>
        </div>
    );

    return (
        <>
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.6; }
                }
                
                @keyframes shimmer {
                    0% { background-position: -1000px 0; }
                    100% { background-position: 1000px 0; }
                }
                
                .users-table .ant-table-tbody > tr:hover > td {
                    background: #fafbfc !important;
                }
                
                .users-table .ant-table-thead > tr > th {
                    background: #fafbfc !important;
                    color: #475569 !important;
                    font-weight: 700 !important;
                    font-size: 11px !important;
                    text-transform: uppercase !important;
                    letter-spacing: 0.05em !important;
                    border-bottom: 2px solid #e2e8f0 !important;
                }
                
                .users-table .ant-table-tbody > tr > td {
                    padding: 14px 16px !important;
                }
                
                .stat-card-enter {
                    animation: slideUp 0.4s ease forwards;
                }
                
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>

            <div style={{ background: '#fff', minHeight: 'calc(100vh - 60px)' }}>
                {messageContextHolder}
                {notificationContextHolder}

                {/* Page Header */}
                {/* Page Header */}
                <div style={{
                    padding: '20px 28px',
                    borderBottom: '1px solid #f1f5f9',
                    background: 'white'
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 20
                    }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                marginBottom: 6
                            }}>
                                <h2 style={{
                                    fontSize: 20,
                                    fontWeight: 700,
                                    color: '#0f172a',
                                    margin: 0,
                                    letterSpacing: '-0.02em',
                                    lineHeight: 1.2
                                }}>
                                    Team Members
                                </h2>
                                <span style={{
                                    padding: '3px 10px',
                                    background: '#eef2ff',
                                    color: '#4f46e5',
                                    borderRadius: 12,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    letterSpacing: '0.02em',
                                    border: '1px solid #e0e7ff'
                                }}>
                                    {totalRecordCount} {totalRecordCount === 1 ? 'Member' : 'Members'}
                                </span>
                            </div>
                            <p style={{
                                fontSize: 13,
                                color: '#64748b',
                                margin: 0,
                                lineHeight: 1.5
                            }}>
                                Manage users, roles and permissions across your team
                            </p>
                        </div>

                        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
                            <Button
                                icon={<RefreshCw size={14} />}
                                onClick={loadUsers}
                                style={{
                                    borderRadius: 8,
                                    fontWeight: 600,
                                    fontSize: 13,
                                    height: 38,
                                    paddingInline: 16,
                                    border: '1px solid #e2e8f0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6
                                }}
                            >
                                Refresh
                            </Button>
                            {activeTab === 'users' ? (
                                <Button
                                    type="primary"
                                    icon={<UserPlus size={14} />}
                                    onClick={() => handleOpenUserModal()}
                                    style={{
                                        borderRadius: 8,
                                        fontWeight: 600,
                                        fontSize: 13,
                                        height: 38,
                                        paddingInline: 18,
                                        background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                                        border: 'none',
                                        boxShadow: '0 2px 4px rgba(79, 70, 229, 0.2)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6
                                    }}
                                >
                                    Add User
                                </Button>
                            ) : (
                                <Button
                                    type="primary"
                                    icon={<Plus size={14} />}
                                    onClick={() => handleOpenRoleModal()}
                                    style={{
                                        borderRadius: 8,
                                        fontWeight: 600,
                                        fontSize: 13,
                                        height: 38,
                                        paddingInline: 18,
                                        background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                                        border: 'none',
                                        boxShadow: '0 2px 4px rgba(79, 70, 229, 0.2)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6
                                    }}
                                >
                                    Create Role
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                <div style={{ padding: '20px 28px' }}>
                    {/* Tab Switcher + Filters */}
                    {/* Tab Switcher + Filters - FIXED ALIGNMENT */}
                    <div style={{
                        background: 'white',
                        borderRadius: 12,
                        border: '1px solid #e2e8f0',
                        padding: '14px 18px',
                        marginBottom: 20,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 16
                        }}>
                            <Segmented
                                value={activeTab}
                                onChange={setActiveTab}
                                options={[
                                    {
                                        label: (
                                            <span style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 6,
                                                fontSize: 13,
                                                fontWeight: 600,
                                                padding: '2px 4px'
                                            }}>
                                                <Users size={14} /> Members
                                            </span>
                                        ),
                                        value: 'users'
                                    },
                                    {
                                        label: (
                                            <span style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 6,
                                                fontSize: 13,
                                                fontWeight: 600,
                                                padding: '2px 4px'
                                            }}>
                                                <Lock size={14} /> Permissions
                                            </span>
                                        ),
                                        value: 'roles'
                                    }
                                ]}
                                style={{
                                    background: '#f1f5f9',
                                    padding: 4,
                                    borderRadius: 8
                                }}
                            />

                            {activeTab === 'users' ? (
                                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                                    <Input
                                        prefix={<Search size={14} style={{ color: '#94a3b8' }} />}
                                        placeholder="Search users..."
                                        allowClear
                                        value={searchText}
                                        onChange={e => setSearchText(e.target.value)}
                                        style={{
                                            width: 260,
                                            borderRadius: 8,
                                            height: 38
                                        }}
                                    />
                                    <Select
                                        placeholder="All Roles"
                                        allowClear
                                        value={selectedRole || undefined}
                                        onChange={v => { setSelectedRole(v || ''); setCurrentPage(1); }}
                                        style={{ width: 160 }}
                                        size="middle"
                                        suffixIcon={<SlidersHorizontal size={12} style={{ color: '#94a3b8' }} />}
                                    >
                                        {roles.map(r => (
                                            <Option key={r._id || r.id} value={r.name || r.id}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span style={{
                                                        width: 8,
                                                        height: 8,
                                                        borderRadius: '50%',
                                                        background: r.color || '#64748b',
                                                        flexShrink: 0
                                                    }} />
                                                    <span>{r.displayName}</span>
                                                </div>
                                            </Option>
                                        ))}
                                    </Select>
                                    <Select
                                        placeholder="All Status"
                                        allowClear
                                        value={selectedStatus || undefined}
                                        onChange={v => { setSelectedStatus(v !== undefined ? v : ''); setCurrentPage(1); }}
                                        style={{ width: 140 }}
                                        size="middle"
                                    >
                                        <Option value="true">
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
                                                Active
                                            </span>
                                        </Option>
                                        <Option value="false">
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#cbd5e1', flexShrink: 0 }} />
                                                Inactive
                                            </span>
                                        </Option>
                                    </Select>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                    <Input
                                        prefix={<Search size={14} style={{ color: '#94a3b8' }} />}
                                        placeholder="Search permissions..."
                                        allowClear
                                        value={permissionSearch}
                                        onChange={e => setPermissionSearch(e.target.value)}
                                        style={{ width: 260, borderRadius: 8, height: 38 }}
                                    />
                                    <Button
                                        type="primary"
                                        icon={<CheckCircle2 size={14} />}
                                        loading={matrixSaving}
                                        onClick={handleSaveMatrixPermissions}
                                        style={{
                                            borderRadius: 8,
                                            fontWeight: 600,
                                            fontSize: 13,
                                            height: 38,
                                            paddingInline: 16,
                                            background: 'linear-gradient(135deg, #10b981, #059669)',
                                            border: 'none',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 6
                                        }}
                                    >
                                        Save Changes
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                    {/* USERS TAB */}
                    {activeTab === 'users' && (
                        <>
                            {/* Enhanced Stats Cards */}
                            {/* Enhanced Stats Cards - PROPERLY ALIGNED */}
                            {/* Compact Stats Cards */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(3, 1fr)',
                                gap: 16,
                                marginBottom: 20
                            }}>
                                {/* Card 1: Total Users */}
                                <div
                                    style={{
                                        background: 'white',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: 12,
                                        padding: '16px 20px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 14
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor = '#cbd5e1';
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)';
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = '#e2e8f0';
                                        e.currentTarget.style.boxShadow = 'none';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                    }}
                                >
                                    {/* Icon */}
                                    <div style={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: 10,
                                        background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
                                        flexShrink: 0
                                    }}>
                                        <Users size={22} color="white" strokeWidth={2.2} />
                                    </div>

                                    {/* Content */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            fontSize: 11,
                                            fontWeight: 700,
                                            color: '#64748b',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            marginBottom: 4
                                        }}>
                                            Total Users
                                        </div>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'baseline',
                                            gap: 8
                                        }}>
                                            <div style={{
                                                fontSize: 26,
                                                fontWeight: 800,
                                                color: '#0f172a',
                                                lineHeight: 1,
                                                letterSpacing: '-0.02em'
                                            }}>
                                                {totalRecordCount}
                                            </div>
                                            <div style={{
                                                fontSize: 11,
                                                fontWeight: 600,
                                                color: '#15803d',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 2
                                            }}>
                                                <TrendingUp size={11} strokeWidth={2.5} />
                                                +2
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Card 2: Active Users */}
                                <div
                                    style={{
                                        background: 'white',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: 12,
                                        padding: '16px 20px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 14
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor = '#cbd5e1';
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)';
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = '#e2e8f0';
                                        e.currentTarget.style.boxShadow = 'none';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                    }}
                                >
                                    {/* Icon */}
                                    <div style={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: 10,
                                        background: 'linear-gradient(135deg, #10b981, #059669)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                                        flexShrink: 0,
                                        position: 'relative'
                                    }}>
                                        <UserCheck size={22} color="white" strokeWidth={2.2} />
                                        {activeCount > 0 && (
                                            <span style={{
                                                position: 'absolute',
                                                top: -2,
                                                right: -2,
                                                width: 10,
                                                height: 10,
                                                borderRadius: '50%',
                                                background: '#10b981',
                                                border: '2px solid white',
                                                animation: 'pulse 2s infinite'
                                            }} />
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            fontSize: 11,
                                            fontWeight: 700,
                                            color: '#64748b',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            marginBottom: 4
                                        }}>
                                            Active Users
                                        </div>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'baseline',
                                            gap: 8
                                        }}>
                                            <div style={{
                                                fontSize: 26,
                                                fontWeight: 800,
                                                color: '#0f172a',
                                                lineHeight: 1,
                                                letterSpacing: '-0.02em'
                                            }}>
                                                {activeCount}
                                            </div>
                                            <div style={{
                                                fontSize: 11,
                                                fontWeight: 600,
                                                color: '#64748b'
                                            }}>
                                                {totalRecordCount > 0 ? Math.round((activeCount / totalRecordCount) * 100) : 0}%
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Card 3: Inactive Users */}
                                <div
                                    style={{
                                        background: 'white',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: 12,
                                        padding: '16px 20px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 14
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor = '#cbd5e1';
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)';
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = '#e2e8f0';
                                        e.currentTarget.style.boxShadow = 'none';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                    }}
                                >
                                    {/* Icon */}
                                    <div style={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: 10,
                                        background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)',
                                        flexShrink: 0
                                    }}>
                                        <XCircle size={22} color="white" strokeWidth={2.2} />
                                    </div>

                                    {/* Content */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            fontSize: 11,
                                            fontWeight: 700,
                                            color: '#64748b',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            marginBottom: 4
                                        }}>
                                            Inactive Users
                                        </div>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'baseline',
                                            gap: 8
                                        }}>
                                            <div style={{
                                                fontSize: 26,
                                                fontWeight: 800,
                                                color: '#0f172a',
                                                lineHeight: 1,
                                                letterSpacing: '-0.02em'
                                            }}>
                                                {inactiveCount}
                                            </div>
                                            {inactiveCount > 0 && (
                                                <div style={{
                                                    fontSize: 11,
                                                    fontWeight: 600,
                                                    color: '#dc2626',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 2
                                                }}>
                                                    <AlertCircle size={11} strokeWidth={2.5} />
                                                    Review
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Enhanced Table */}
                            <div style={{
                                background: 'white',
                                border: '1px solid #e2e8f0',
                                borderRadius: 12,
                                overflow: 'hidden',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                            }}>
                                <Table
                                    className="users-table"
                                    columns={columns}
                                    dataSource={users.map(u => ({ ...u, key: u._id || u.id }))}
                                    loading={loading}
                                    pagination={{
                                        current: currentPage,
                                        pageSize,
                                        total: totalRecords,
                                        showSizeChanger: true,
                                        pageSizeOptions: ['10', '20', '50', '100'],
                                        showTotal: (total, range) => (
                                            <span style={{ fontSize: 13, color: '#64748b' }}>
                                                Showing <strong>{range[0]}-{range[1]}</strong> of <strong>{total}</strong> users
                                            </span>
                                        ),
                                        onChange: (page, size) => { setCurrentPage(page); if (size) setPageSize(size); },
                                        style: { padding: '16px 20px', margin: 0, borderTop: '1px solid #f1f5f9' }
                                    }}
                                    scroll={{ x: 1000 }}
                                    locale={{
                                        emptyText: (
                                            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                                                <div style={{
                                                    width: 80,
                                                    height: 80,
                                                    borderRadius: '50%',
                                                    background: '#f1f5f9',
                                                    margin: '0 auto 16px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                    <Users size={40} color="#cbd5e1" />
                                                </div>
                                                <div style={{
                                                    fontSize: 16,
                                                    fontWeight: 600,
                                                    color: '#475569',
                                                    marginBottom: 6
                                                }}>
                                                    No users found
                                                </div>
                                                <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>
                                                    Try adjusting your filters or add a new user
                                                </div>
                                                <Button
                                                    type="primary"
                                                    icon={<UserPlus size={14} />}
                                                    onClick={() => handleOpenUserModal()}
                                                    style={{ borderRadius: 8 }}
                                                >
                                                    Add User
                                                </Button>
                                            </div>
                                        )
                                    }}
                                />
                            </div>
                        </>
                    )}

                    {/* PERMISSIONS TAB */}
                    {activeTab === 'roles' && (
                        Object.entries(filteredGroupedPermissions).map(([category, perms]) => (
                            <div key={category} style={{
                                border: '1px solid #e2e8f0',
                                borderRadius: 12,
                                overflow: 'hidden',
                                marginBottom: 16,
                                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                background: 'white'
                            }}>
                                <div style={{
                                    padding: '14px 20px',
                                    borderBottom: '1px solid #f1f5f9',
                                    background: 'linear-gradient(135deg, #fafbfc, #f1f5f9)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10
                                }}>
                                    <div style={{
                                        width: 28,
                                        height: 28,
                                        borderRadius: 6,
                                        background: '#eef2ff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <Shield size={14} style={{ color: '#4f46e5' }} />
                                    </div>
                                    <span style={{
                                        fontWeight: 700,
                                        color: '#0f172a',
                                        fontSize: 13,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em'
                                    }}>
                                        {category}
                                    </span>
                                    <span style={{
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: '#64748b',
                                        background: 'white',
                                        padding: '2px 10px',
                                        borderRadius: 12,
                                        border: '1px solid #e2e8f0'
                                    }}>
                                        {perms.length} {perms.length === 1 ? 'permission' : 'permissions'}
                                    </span>
                                </div>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr>
                                                <th style={{
                                                    width: 240,
                                                    padding: '12px 20px',
                                                    fontSize: 11,
                                                    fontWeight: 700,
                                                    color: '#475569',
                                                    textAlign: 'left',
                                                    background: '#fafbfc',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.05em',
                                                    borderBottom: '1px solid #e2e8f0'
                                                }}>
                                                    Role
                                                </th>
                                                {perms.map(p => (
                                                    <th key={p._id || p.id} style={{
                                                        padding: '12px 14px',
                                                        fontSize: 11,
                                                        fontWeight: 700,
                                                        color: '#475569',
                                                        textAlign: 'center',
                                                        minWidth: 130,
                                                        borderLeft: '1px solid #f1f5f9',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.04em',
                                                        background: '#fafbfc',
                                                        borderBottom: '1px solid #e2e8f0'
                                                    }}>
                                                        <Tooltip title={p.name}>{p.displayName}</Tooltip>
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {matrixRoles.map(role => {
                                                const rolePermIds = role.permissions?.map(p => p._id || p.id || p) || [];
                                                const roleColor = role.color || getRoleColor(role.name);
                                                return (
                                                    <tr
                                                        key={role._id || role.id}
                                                        style={{
                                                            borderBottom: '1px solid #f1f5f9',
                                                            transition: 'background 0.15s'
                                                        }}
                                                        onMouseEnter={(e) => e.currentTarget.style.background = '#fafbfc'}
                                                        onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                                                    >
                                                        <td style={{
                                                            padding: '14px 20px',
                                                            fontSize: 13,
                                                            fontWeight: 600,
                                                            color: '#0f172a',
                                                            background: '#fafbfc',
                                                            borderRight: '2px solid #f1f5f9'
                                                        }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                    <span style={{
                                                                        width: 8,
                                                                        height: 8,
                                                                        borderRadius: '50%',
                                                                        background: roleColor,
                                                                        boxShadow: `0 0 0 3px ${roleColor}20`
                                                                    }} />
                                                                    {role.displayName}
                                                                </div>
                                                                <div style={{ display: 'flex', gap: 4 }}>
                                                                    <Button
                                                                        type="text"
                                                                        size="small"
                                                                        onClick={() => handleOpenRoleModal(role)}
                                                                        icon={<Pencil size={12} />}
                                                                        style={{ color: '#64748b' }}
                                                                    />
                                                                    {role.name !== 'super_admin' && (
                                                                        <Popconfirm
                                                                            title="Delete this role?"
                                                                            description="Users with this role will lose permissions."
                                                                            onConfirm={() => handleDeleteRole(role._id || role.id)}
                                                                            okButtonProps={{ danger: true }}
                                                                        >
                                                                            <Button
                                                                                type="text"
                                                                                danger
                                                                                size="small"
                                                                                icon={<Trash2 size={12} />}
                                                                            />
                                                                        </Popconfirm>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        {perms.map(perm => {
                                                            const isAssigned = rolePermIds.includes(perm._id || perm.id);
                                                            return (
                                                                <td key={perm._id || perm.id} style={{
                                                                    padding: '10px',
                                                                    textAlign: 'center',
                                                                    borderLeft: '1px solid #f4f4f5'
                                                                }}>
                                                                    <div
                                                                        onClick={() => handleToggleCellPermission(role._id || role.id, perm._id || perm.id)}
                                                                        style={{
                                                                            width: 22,
                                                                            height: 22,
                                                                            borderRadius: 6,
                                                                            border: `2px solid ${isAssigned ? '#059669' : '#d4d4d8'}`,
                                                                            background: isAssigned ? 'linear-gradient(135deg, #10b981, #059669)' : '#fff',
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            cursor: 'pointer',
                                                                            transition: 'all 0.2s ease',
                                                                            boxShadow: isAssigned ? '0 2px 4px rgba(16, 185, 129, 0.2)' : 'none'
                                                                        }}
                                                                        onMouseEnter={(e) => {
                                                                            if (!isAssigned) {
                                                                                e.currentTarget.style.borderColor = '#94a3b8';
                                                                                e.currentTarget.style.background = '#f8fafc';
                                                                            }
                                                                        }}
                                                                        onMouseLeave={(e) => {
                                                                            if (!isAssigned) {
                                                                                e.currentTarget.style.borderColor = '#d4d4d8';
                                                                                e.currentTarget.style.background = '#fff';
                                                                            }
                                                                        }}
                                                                    >
                                                                        {isAssigned && <Check size={12} strokeWidth={3} color="#fff" />}
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
                        ))
                    )}
                </div>

                {/* USER MODAL */}
                <Modal
                    title={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{
                                width: 36,
                                height: 36,
                                borderRadius: 8,
                                background: 'linear-gradient(135deg, #eef2ff, #e0e7ff)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#4f46e5'
                            }}>
                                <UserCheck size={18} strokeWidth={2} />
                            </div>
                            <div>
                                <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>
                                    {editingUser ? 'Edit User' : 'Add New User'}
                                </div>
                                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                                    {editingUser ? 'Update user information' : 'Create a new team member'}
                                </div>
                            </div>
                        </div>
                    }
                    open={showUserModal}
                    onCancel={() => setShowUserModal(false)}
                    centered
                    destroyOnHidden
                    width={720}
                    styles={{
                        body: { padding: '20px 24px' },
                        header: { padding: '16px 24px', borderBottom: '1px solid #f1f5f9' }
                    }}
                    footer={[
                        <Button
                            key="cancel"
                            onClick={() => setShowUserModal(false)}
                            style={{ borderRadius: 8, fontWeight: 600, fontSize: 13, height: 36 }}
                        >
                            Cancel
                        </Button>,
                        <Button
                            key="save"
                            type="primary"
                            onClick={handleSaveUser}
                            style={{
                                borderRadius: 8,
                                fontWeight: 600,
                                fontSize: 13,
                                height: 36,
                                background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                                border: 'none'
                            }}
                        >
                            {editingUser ? 'Save Changes' : 'Create User'}
                        </Button>
                    ]}
                >
                    <div style={{ maxHeight: '65vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 0' }}>
                        {/* Basic Info */}
                        <div style={{ background: '#fafbfc', borderRadius: 10, padding: 18, border: '1px solid #f1f5f9' }}>
                            <div style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: '#475569',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                marginBottom: 14,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6
                            }}>
                                <User size={12} />
                                Basic Information
                            </div>
                            <Row gutter={[12, 14]}>
                                <Col span={12}>
                                    <FieldLabel>First Name *</FieldLabel>
                                    <Input
                                        value={userFormData.firstName}
                                        onChange={e => setUserFormData({ ...userFormData, firstName: e.target.value })}
                                        placeholder="John"
                                        style={{ borderRadius: 8, height: 38 }}
                                    />
                                </Col>
                                <Col span={12}>
                                    <FieldLabel>Last Name *</FieldLabel>
                                    <Input
                                        value={userFormData.lastName}
                                        onChange={e => setUserFormData({ ...userFormData, lastName: e.target.value })}
                                        placeholder="Doe"
                                        style={{ borderRadius: 8, height: 38 }}
                                    />
                                </Col>
                                <Col span={12}>
                                    <FieldLabel>Email *</FieldLabel>
                                    <Input
                                        type="email"
                                        disabled={!!editingUser}
                                        value={userFormData.email}
                                        onChange={e => setUserFormData({ ...userFormData, email: e.target.value })}
                                        placeholder="user@example.com"
                                        prefix={<Mail size={14} style={{ color: '#94a3b8' }} />}
                                        style={{ borderRadius: 8, height: 38 }}
                                    />
                                </Col>
                                <Col span={12}>
                                    <FieldLabel>Phone</FieldLabel>
                                    <Input
                                        value={userFormData.phone}
                                        onChange={e => setUserFormData({ ...userFormData, phone: e.target.value })}
                                        placeholder="+91 12345 67890"
                                        prefix={<Phone size={14} style={{ color: '#94a3b8' }} />}
                                        style={{ borderRadius: 8, height: 38 }}
                                    />
                                </Col>
                                {!editingUser && (
                                    <Col span={24}>
                                        <FieldLabel>Password *</FieldLabel>
                                        <Input.Password
                                            value={userFormData.password}
                                            onChange={e => setUserFormData({ ...userFormData, password: e.target.value })}
                                            placeholder="Enter strong password"
                                            prefix={<Lock size={14} style={{ color: '#94a3b8' }} />}
                                            style={{ borderRadius: 8, height: 38 }}
                                        />
                                    </Col>
                                )}
                            </Row>
                        </div>

                        {/* Role */}
                        <div style={{ background: '#fafbfc', borderRadius: 10, padding: 18, border: '1px solid #f1f5f9' }}>
                            <div style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: '#475569',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                marginBottom: 12,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6
                            }}>
                                <Shield size={12} />
                                Role Assignment *
                            </div>
                            <Select
                                style={{ width: '100%', borderRadius: 8 }}
                                value={userFormData.role || undefined}
                                onChange={handleUserRoleChange}
                                placeholder="Select role"
                                size="large"
                            >
                                {roles.map(r => (
                                    <Option key={r._id || r.id} value={r._id || r.id}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{
                                                width: 8,
                                                height: 8,
                                                borderRadius: '50%',
                                                background: r.color || '#64748b'
                                            }} />
                                            {r.displayName}
                                        </div>
                                    </Option>
                                ))}
                            </Select>
                        </div>

                        {/* Supervisors */}
                        {!isBrandManager && (
                            <div style={{ background: '#fafbfc', borderRadius: 10, padding: 18, border: '1px solid #f1f5f9' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                    <div style={{
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: '#475569',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6
                                    }}>
                                        <Users size={12} />
                                        Supervisors
                                    </div>
                                    <span style={{
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: '#4f46e5',
                                        background: '#eef2ff',
                                        padding: '2px 10px',
                                        borderRadius: 12
                                    }}>
                                        {userFormData.supervisors.length} selected
                                    </span>
                                </div>
                                <Input
                                    prefix={<Search size={12} />}
                                    placeholder="Search supervisors..."
                                    value={modalSearchSupervisor}
                                    onChange={e => setModalSearchSupervisor(e.target.value)}
                                    style={{ borderRadius: 8, marginBottom: 10 }}
                                />
                                <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {filteredSupervisors.map(m => {
                                        const id = m._id || m.id;
                                        const checked = userFormData.supervisors.includes(id);
                                        return (
                                            <SelectionCard
                                                key={id}
                                                isChecked={checked}
                                                name={`${m.firstName} ${m.lastName}`}
                                                subtitle={m.role?.displayName || 'Manager'}
                                                onClick={() => setUserFormData({
                                                    ...userFormData,
                                                    supervisors: checked
                                                        ? userFormData.supervisors.filter(i => i !== id)
                                                        : [...userFormData.supervisors, id]
                                                })}
                                            />
                                        );
                                    })}
                                    {filteredSupervisors.length === 0 && (
                                        <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8', fontSize: 12 }}>
                                            No supervisors found
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Brand Managers (for Listing Team) */}
                        {isListingTeam && (
                            <div style={{ background: '#fafbfc', borderRadius: 10, padding: 18, border: '1px solid #f1f5f9' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                    <div style={{
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: '#475569',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6
                                    }}>
                                        <Briefcase size={12} />
                                        Brand Managers
                                    </div>
                                    <span style={{
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: '#4f46e5',
                                        background: '#eef2ff',
                                        padding: '2px 10px',
                                        borderRadius: 12
                                    }}>
                                        {userFormData.brandManagers.length} linked
                                    </span>
                                </div>
                                <Input
                                    prefix={<Search size={12} />}
                                    placeholder="Search brand managers..."
                                    value={modalSearchBrandManager}
                                    onChange={e => setModalSearchBrandManager(e.target.value)}
                                    style={{ borderRadius: 8, marginBottom: 10 }}
                                />
                                <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {filteredBrandManagers.map(m => {
                                        const id = m._id || m.id;
                                        const checked = userFormData.brandManagers.includes(id);
                                        return (
                                            <SelectionCard
                                                key={id}
                                                isChecked={checked}
                                                name={`${m.firstName} ${m.lastName}`}
                                                subtitle={m.email}
                                                onClick={() => setUserFormData({
                                                    ...userFormData,
                                                    brandManagers: checked
                                                        ? userFormData.brandManagers.filter(i => i !== id)
                                                        : [...userFormData.brandManagers, id]
                                                })}
                                            />
                                        );
                                    })}
                                    {filteredBrandManagers.length === 0 && (
                                        <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8', fontSize: 12 }}>
                                            No brand managers found
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Brands */}
                        <div style={{ background: '#fafbfc', borderRadius: 10, padding: 18, border: '1px solid #f1f5f9' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                <div style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: '#475569',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6
                                }}>
                                    <Store size={12} />
                                    Assigned Brands
                                </div>
                                <span style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: '#15803d',
                                    background: '#dcfce7',
                                    padding: '2px 10px',
                                    borderRadius: 12
                                }}>
                                    {(isListingTeam ? inheritedSellers : userFormData.assignedSellers).length} brands
                                </span>
                            </div>

                            {isListingTeam && (
                                <div style={{
                                    background: '#eff6ff',
                                    border: '1px solid #bfdbfe',
                                    borderRadius: 8,
                                    padding: '10px 14px',
                                    marginBottom: 12,
                                    fontSize: 12,
                                    color: '#1d4ed8',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8
                                }}>
                                    <Info size={14} />
                                    Brands are automatically inherited from assigned brand managers.
                                </div>
                            )}
                            {isCatalogManager && (
                                <div style={{
                                    background: '#fffbeb',
                                    border: '1px solid #fde68a',
                                    borderRadius: 8,
                                    padding: '10px 14px',
                                    marginBottom: 12,
                                    fontSize: 12,
                                    color: '#92400e',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8
                                }}>
                                    <AlertCircle size={14} />
                                    Read-only access. Brand associations cannot be modified for this role.
                                </div>
                            )}

                            {!isListingTeam && (
                                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                                    <Input
                                        prefix={<Search size={12} />}
                                        placeholder="Search brands..."
                                        value={modalSearchSeller}
                                        onChange={e => setModalSearchSeller(e.target.value)}
                                        style={{ borderRadius: 8, flex: 1 }}
                                    />
                                    <Button
                                        onClick={() => setUserFormData({ ...userFormData, assignedSellers: sellers.map(s => s._id || s.id) })}
                                        style={{ fontSize: 12, fontWeight: 600, borderRadius: 8 }}
                                    >
                                        Select All
                                    </Button>
                                    <Button
                                        onClick={() => setUserFormData({ ...userFormData, assignedSellers: [] })}
                                        style={{ fontSize: 12, fontWeight: 600, borderRadius: 8 }}
                                    >
                                        Clear
                                    </Button>
                                </div>
                            )}

                            <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {filteredSellers.map(s => {
                                    const id = s._id || s.id;
                                    const checked = isListingTeam ? true : userFormData.assignedSellers.includes(id);
                                    return (
                                        <SelectionCard
                                            key={id}
                                            isChecked={checked}
                                            readOnly={isListingTeam}
                                            icon={Store}
                                            iconBg="#15803d"
                                            name={s.name}
                                            subtitle={s.code || 'Brand'}
                                            onClick={() => {
                                                if (isListingTeam) return;
                                                setUserFormData({
                                                    ...userFormData,
                                                    assignedSellers: checked
                                                        ? userFormData.assignedSellers.filter(i => i !== id)
                                                        : [...userFormData.assignedSellers, id]
                                                });
                                            }}
                                        />
                                    );
                                })}
                                {filteredSellers.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8', fontSize: 12 }}>
                                        {isListingTeam ? 'Link brand managers to see brands' : 'No brands found'}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </Modal>

                {/* ROLE MODAL */}
                <Modal
                    title={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{
                                width: 36,
                                height: 36,
                                borderRadius: 8,
                                background: 'linear-gradient(135deg, #eef2ff, #e0e7ff)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#4f46e5'
                            }}>
                                <Shield size={18} strokeWidth={2} />
                            </div>
                            <div>
                                <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                                    {editingRole ? 'Edit Role' : 'Create New Role'}
                                </div>
                                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                                    {editingRole ? 'Modify role configuration' : 'Define a new role'}
                                </div>
                            </div>
                        </div>
                    }
                    open={showRoleModal}
                    onCancel={() => setShowRoleModal(false)}
                    centered
                    destroyOnHidden
                    width={500}
                    footer={[
                        <Button
                            key="cancel"
                            onClick={() => setShowRoleModal(false)}
                            style={{ borderRadius: 8, fontWeight: 600, fontSize: 13, height: 36 }}
                        >
                            Cancel
                        </Button>,
                        <Button
                            key="save"
                            type="primary"
                            onClick={handleSaveRole}
                            style={{
                                borderRadius: 8,
                                fontWeight: 600,
                                fontSize: 13,
                                height: 36,
                                background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                                border: 'none'
                            }}
                        >
                            {editingRole ? 'Save Changes' : 'Create Role'}
                        </Button>
                    ]}
                >
                    <div style={{ padding: '12px 0' }}>
                        <div style={{ marginBottom: 16 }}>
                            <FieldLabel>Role Identifier</FieldLabel>
                            <Input
                                disabled={!!editingRole}
                                placeholder="e.g. analyst_l2"
                                value={roleFormData.name}
                                onChange={e => setRoleFormData({ ...roleFormData, name: e.target.value })}
                                style={{ borderRadius: 8, height: 38 }}
                            />
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <FieldLabel>Display Name *</FieldLabel>
                            <Input
                                placeholder="e.g. Senior Analyst"
                                value={roleFormData.displayName}
                                onChange={e => setRoleFormData({ ...roleFormData, displayName: e.target.value })}
                                style={{ borderRadius: 8, height: 38 }}
                            />
                        </div>
                        <Row gutter={12} style={{ marginBottom: 16 }}>
                            <Col span={12}>
                                <FieldLabel>Access Level (0-100)</FieldLabel>
                                <Input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={roleFormData.level}
                                    onChange={e => setRoleFormData({ ...roleFormData, level: parseInt(e.target.value) || 0 })}
                                    style={{ borderRadius: 8, height: 38 }}
                                />
                            </Col>
                            <Col span={12}>
                                <FieldLabel>Color</FieldLabel>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Input
                                        type="color"
                                        value={roleFormData.color}
                                        onChange={e => setRoleFormData({ ...roleFormData, color: e.target.value })}
                                        style={{
                                            width: 50,
                                            height: 38,
                                            padding: 4,
                                            cursor: 'pointer',
                                            borderRadius: 8
                                        }}
                                    />
                                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>
                                        {roleFormData.color}
                                    </span>
                                </div>
                            </Col>
                        </Row>
                        <div>
                            <FieldLabel>Description</FieldLabel>
                            <TextArea
                                rows={3}
                                placeholder="Describe role responsibilities..."
                                value={roleFormData.description}
                                onChange={e => setRoleFormData({ ...roleFormData, description: e.target.value })}
                                style={{ borderRadius: 8 }}
                            />
                        </div>
                    </div>
                </Modal>

                {/* EMAIL MODAL */}
                <Modal
                    title={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{
                                width: 36,
                                height: 36,
                                borderRadius: 8,
                                background: 'linear-gradient(135deg, #dbeafe, #bfdbfe)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#2563eb'
                            }}>
                                <Mail size={18} strokeWidth={2} />
                            </div>
                            <div>
                                <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                                    Send Email
                                </div>
                                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                                    To: {emailUser?.firstName} {emailUser?.lastName}
                                </div>
                            </div>
                        </div>
                    }
                    open={showEmailModal}
                    onCancel={() => setShowEmailModal(false)}
                    centered
                    destroyOnHidden
                    width={540}
                    footer={[
                        <Button
                            key="cancel"
                            onClick={() => setShowEmailModal(false)}
                            style={{ borderRadius: 8, fontWeight: 600, fontSize: 13, height: 36 }}
                        >
                            Cancel
                        </Button>,
                        <Button
                            key="send"
                            type="primary"
                            loading={sendingEmail}
                            onClick={handleSendEmailSubmit}
                            icon={<Send size={14} strokeWidth={2} />}
                            style={{
                                borderRadius: 8,
                                fontWeight: 600,
                                fontSize: 13,
                                height: 36,
                                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                                border: 'none'
                            }}
                        >
                            Send Email
                        </Button>
                    ]}
                >
                    <div style={{ padding: '12px 0' }}>
                        <div style={{ marginBottom: 16 }}>
                            <FieldLabel>To</FieldLabel>
                            <Input
                                value={emailUser?.email}
                                disabled
                                prefix={<Mail size={14} style={{ color: '#94a3b8' }} />}
                                style={{ borderRadius: 8, height: 38, background: '#f8fafc' }}
                            />
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <FieldLabel>Subject *</FieldLabel>
                            <Input
                                placeholder="Enter subject"
                                value={emailForm.subject}
                                onChange={e => setEmailForm({ ...emailForm, subject: e.target.value })}
                                style={{ borderRadius: 8, height: 38 }}
                            />
                        </div>
                        <div>
                            <FieldLabel>Message *</FieldLabel>
                            <TextArea
                                rows={6}
                                placeholder="Write your message..."
                                value={emailForm.message}
                                onChange={e => setEmailForm({ ...emailForm, message: e.target.value })}
                                style={{ borderRadius: 8 }}
                            />
                        </div>
                    </div>
                </Modal>

                {/* USER PROFILE DRAWER */}
                <Drawer
                    title={null}
                    placement="right"
                    width={520}
                    open={showProfileDrawer}
                    onClose={() => setShowProfileDrawer(false)}
                    styles={{ body: { padding: 0 } }}
                >
                    {profileUser && (
                        <div>
                            {/* Profile Header */}
                            <div style={{
                                background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                                padding: '32px 24px',
                                color: 'white',
                                position: 'relative'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <EnhancedAvatar
                                        firstName={profileUser.firstName}
                                        lastName={profileUser.lastName}
                                        size={72}
                                        showStatus={true}
                                        isOnline={formatLastActive(profileUser.lastSeen).isOnline}
                                    />
                                    <div>
                                        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
                                            {profileUser.firstName} {profileUser.lastName}
                                        </div>
                                        <div style={{ fontSize: 13, opacity: 0.9, display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <Mail size={12} />
                                            {profileUser.email}
                                        </div>
                                        {profileUser.phone && (
                                            <div style={{ fontSize: 13, opacity: 0.9, display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                                <Phone size={12} />
                                                {profileUser.phone}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Profile Content */}
                            <div style={{ padding: 24 }}>
                                {/* Role Section */}
                                <div style={{ marginBottom: 24 }}>
                                    <div style={{
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: '#64748b',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        marginBottom: 10
                                    }}>
                                        Role
                                    </div>
                                    <RoleBadge role={
                                        roles.find(r => (r._id || r.id) === (profileUser.role?._id || profileUser.role?.id || profileUser.role))
                                        || (typeof profileUser.role === 'object' ? profileUser.role : null)
                                    } />
                                </div>

                                {/* Status */}
                                <div style={{ marginBottom: 24 }}>
                                    <div style={{
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: '#64748b',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        marginBottom: 10
                                    }}>
                                        Status
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <Switch
                                            checked={profileUser.isActive}
                                            onChange={() => {
                                                handleToggleStatus(profileUser._id || profileUser.id);
                                                setProfileUser({ ...profileUser, isActive: !profileUser.isActive });
                                            }}
                                        />
                                        <span style={{
                                            fontSize: 14,
                                            fontWeight: 600,
                                            color: profileUser.isActive ? '#047857' : '#64748b'
                                        }}>
                                            {profileUser.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                </div>

                                {/* Last Active */}
                                <div style={{ marginBottom: 24 }}>
                                    <div style={{
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: '#64748b',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        marginBottom: 10
                                    }}>
                                        Last Active
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Clock size={14} style={{ color: '#64748b' }} />
                                        <span style={{ fontSize: 14, color: '#0f172a' }}>
                                            {profileUser.lastSeen ? new Date(profileUser.lastSeen).toLocaleString() : 'Never logged in'}
                                        </span>
                                    </div>
                                </div>

                                {/* Supervisors */}
                                {profileUser.supervisors && profileUser.supervisors.length > 0 && (
                                    <div style={{ marginBottom: 24 }}>
                                        <div style={{
                                            fontSize: 11,
                                            fontWeight: 700,
                                            color: '#64748b',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            marginBottom: 10
                                        }}>
                                            Supervisors ({profileUser.supervisors.length})
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            {profileUser.supervisors.map((s, i) => (
                                                <div key={i} style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 10,
                                                    padding: 10,
                                                    background: '#fafbfc',
                                                    borderRadius: 8,
                                                    border: '1px solid #f1f5f9'
                                                }}>
                                                    <EnhancedAvatar firstName={s.firstName} lastName={s.lastName} size={32} />
                                                    <div>
                                                        <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                                                            {s.firstName} {s.lastName}
                                                        </div>
                                                        <div style={{ fontSize: 11, color: '#64748b' }}>
                                                            {s.email}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Actions */}
                                <div style={{
                                    display: 'flex',
                                    gap: 8,
                                    marginTop: 24,
                                    paddingTop: 20,
                                    borderTop: '1px solid #f1f5f9'
                                }}>
                                    <Button
                                        icon={<Send size={14} />}
                                        onClick={() => {
                                            setShowProfileDrawer(false);
                                            handleSendEmail(profileUser);
                                        }}
                                        style={{ flex: 1, borderRadius: 8, fontWeight: 600 }}
                                    >
                                        Send Email
                                    </Button>
                                    <Button
                                        type="primary"
                                        icon={<Pencil size={14} />}
                                        onClick={() => {
                                            setShowProfileDrawer(false);
                                            handleOpenUserModal(profileUser);
                                        }}
                                        style={{
                                            flex: 1,
                                            borderRadius: 8,
                                            fontWeight: 600,
                                            background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                                            border: 'none'
                                        }}
                                    >
                                        Edit User
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </Drawer>
            </div>
        </>
    );
};

export default UsersPage;