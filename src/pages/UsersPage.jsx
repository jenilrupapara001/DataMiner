import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { userApi, roleApi } from '../services/api';
import { useSocket } from '../contexts/SocketContext';
import {
    Users, Shield, UserPlus, Search, Pencil, Trash2, Mail, Phone,
    Clock, CheckCircle2, XCircle, Info, UserCheck, RefreshCw, Store, Check,
    SlidersHorizontal, Lock, Plus, ArrowRight, User, AlertCircle, Target, Send
} from 'lucide-react';
import { PageLoader } from '@/components/application/loading-indicator/PageLoader';
import {
    Space, Button, Segmented, Table, Modal, Card, Input, Row, Col,
    Typography, Tag, Tooltip, Form, Select, Switch, Avatar, Badge, Divider,
    notification, message as antdMessage
} from 'antd';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

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

const StatCard = ({ icon: Icon, label, value, color = '#1e293b' }) => (
    <Card
        style={{ borderRadius: 6, border: '1px solid #e5e7eb' }}
        styles={{ body: { padding: '16px 18px' } }}
    >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
                width: 36, height: 36, borderRadius: 6,
                background: '#f8fafc', border: '1px solid #e5e7eb',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color
            }}>
                <Icon size={16} strokeWidth={2} />
            </div>
            <div>
                <div style={{
                    fontSize: 11, fontWeight: 600, color: '#64748b',
                    textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3
                }}>
                    {label}
                </div>
                <div style={{
                    fontSize: 20, fontWeight: 700, color: '#0f172a',
                    letterSpacing: '-0.3px', lineHeight: 1
                }}>
                    {value}
                </div>
            </div>
        </div>
    </Card>
);

const UsersPage = () => {
    const socket = useSocket();
    const [messageApi, messageContextHolder] = antdMessage.useMessage();
    const [notificationApi, notificationContextHolder] = notification.useNotification();

    const [activeTab, setActiveTab] = useState('users');
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [matrixRoles, setMatrixRoles] = useState([]);
    const [matrixSaving, setMatrixSaving] = useState(false);
    const [matrixSuccess, setMatrixSuccess] = useState(false);
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

    const activeCount = useMemo(() => users.filter(u => u.isActive).length, [users]);
    const totalRecordCount = useMemo(() => totalRecords || users.length, [totalRecords, users]);
    const inactiveCount = useMemo(() => Math.max(0, totalRecordCount - activeCount), [totalRecordCount, activeCount]);

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

    const handleDeleteUser = useCallback((userId) => {
        Modal.confirm({
            title: 'Remove User',
            content: 'This will permanently remove the user from the system. Continue?',
            okText: 'Remove',
            okType: 'danger',
            cancelText: 'Cancel',
            centered: true,
            onOk: async () => {
                try {
                    await userApi.delete(userId);
                    messageApi.success('User removed');
                    setUsers(prev => prev.filter(u => u._id !== userId && u.id !== userId));
                    setTotalRecords(prev => Math.max(0, prev - 1));
                } catch (error) {
                    messageApi.error(error.message || 'Failed to remove user');
                }
            }
        });
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

    const handleDeleteRole = (roleId) => {
        Modal.confirm({
            title: 'Delete Role',
            content: 'All users with this role will lose their permissions. This cannot be undone.',
            okText: 'Delete',
            okType: 'danger',
            centered: true,
            onOk: async () => {
                try {
                    await roleApi.delete(roleId);
                    messageApi.success('Role deleted');
                    loadRolesAndPerms();
                } catch (error) {
                    messageApi.error(error.message || 'Failed to delete role');
                }
            }
        });
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

    const renderInitials = (firstName, lastName) => {
        return `${(firstName || '')[0]?.toUpperCase() || ''}${(lastName || '')[0]?.toUpperCase() || ''}` || 'U';
    };

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

    const columns = useMemo(() => [
        {
            title: 'Name',
            key: 'name',
            width: 300,
            render: (_, record) => {
                const initials = renderInitials(record.firstName, record.lastName);
                return (
                    <Space size={10}>
                        <Avatar
                            style={{
                                backgroundColor: '#f1f5f9', color: '#475569',
                                fontWeight: 700, fontSize: 12, border: '1px solid #e5e7eb'
                            }}
                        >
                            {initials}
                        </Avatar>
                        <div>
                            <Text strong style={{ fontSize: 13, color: '#0f172a' }}>
                                {record.firstName} {record.lastName}
                            </Text>
                            <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Mail size={10} strokeWidth={2} /> {record.email}
                            </div>
                        </div>
                    </Space>
                );
            }
        },
        {
            title: 'Role',
            key: 'role',
            width: 180,
            render: (_, record) => {
                const roleId = record.role?._id || record.role?.id || record.role;
                const resolved = roles.find(r => (r._id || r.id) === roleId) || (typeof record.role === 'object' ? record.role : null);
                const color = resolved?.color || '#475569';
                return (
                    <Tag style={{
                        backgroundColor: `${color}12`, color, borderRadius: 4,
                        fontWeight: 700, fontSize: 10, padding: '2px 10px',
                        textTransform: 'uppercase', letterSpacing: '0.04em',
                        border: `1px solid ${color}25`, margin: 0
                    }}>
                        {resolved?.displayName || 'Standard'}
                    </Tag>
                );
            }
        },
        {
            title: 'Supervisors',
            key: 'supervisors',
            width: 160,
            render: (_, record) => {
                const list = record.supervisors || [];
                if (list.length === 0) return <Text style={{ fontSize: 11, color: '#94a3b8' }}>None</Text>;
                return (
                    <Avatar.Group max={{ count: 3 }} size="small">
                        {list.map((s, i) => (
                            <Tooltip key={i} title={`${s.firstName} ${s.lastName}`}>
                                <Avatar style={{ backgroundColor: '#1e293b', fontSize: 9 }}>
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
            width: 120,
            render: (isActive, record) => (
                <Space size={8}>
                    <Switch
                        size="small"
                        checked={isActive}
                        onChange={() => handleToggleStatus(record._id || record.id)}
                    />
                    <Text style={{
                        fontSize: 11, fontWeight: 600,
                        color: isActive ? '#15803d' : '#64748b'
                    }}>
                        {isActive ? 'Active' : 'Inactive'}
                    </Text>
                </Space>
            )
        },
        {
            title: '',
            key: 'actions',
            fixed: 'right',
            width: 120,
            align: 'right',
            render: (_, record) => (
                <Space size={4}>
                    <Tooltip title="Send Email">
                        <Button type="text" size="small" onClick={() => handleSendEmail(record)}
                            icon={<Send size={12} strokeWidth={2} />} />
                    </Tooltip>
                    <Tooltip title="Edit">
                        <Button type="text" size="small" onClick={() => handleOpenUserModal(record)}
                            icon={<Pencil size={12} strokeWidth={2} />} />
                    </Tooltip>
                    <Tooltip title="Remove">
                        <Button type="text" danger size="small"
                            onClick={() => handleDeleteUser(record._id || record.id)}
                            icon={<Trash2 size={12} strokeWidth={2} />} />
                    </Tooltip>
                </Space>
            )
        }
    ], [roles, handleToggleStatus, handleDeleteUser]);

    if (loading && users.length === 0) {
        return <PageLoader message="Loading user directory..." />;
    }

    const SelectionCard = ({ isChecked, onClick, icon: ItemIcon, iconBg, name, subtitle, readOnly = false }) => (
        <div
            onClick={readOnly ? undefined : onClick}
            style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 12px', background: isChecked ? '#f8fafc' : '#ffffff',
                border: `1px solid ${isChecked ? '#1e293b' : '#e5e7eb'}`,
                borderRadius: 6, cursor: readOnly ? 'default' : 'pointer', transition: 'all 0.15s'
            }}
        >
            <Space size={8}>
                <div style={{
                    width: 26, height: 26, borderRadius: 5, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: isChecked ? (iconBg || '#1e293b') : '#f1f5f9',
                    color: isChecked ? '#ffffff' : '#64748b', fontSize: 10, fontWeight: 700
                }}>
                    {ItemIcon ? <ItemIcon size={12} /> : name?.charAt(0)?.toUpperCase()}
                </div>
                <div style={{ lineHeight: 1.3 }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: '#0f172a' }}>{name}</div>
                    {subtitle && <div style={{ fontSize: 10, color: '#64748b' }}>{subtitle}</div>}
                </div>
            </Space>
            <div style={{
                width: 16, height: 16, borderRadius: '50%',
                border: `2px solid ${isChecked ? '#1e293b' : '#cbd5e1'}`,
                background: isChecked ? '#1e293b' : '#ffffff',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
                {isChecked && <Check size={9} color="#ffffff" strokeWidth={3} />}
            </div>
        </div>
    );

    return (
        <div className="users-pro">
            {messageContextHolder}
            {notificationContextHolder}

            <style>{`
                .users-pro {
                    background: #fafafa;
                    min-height: calc(100vh - 60px);
                    padding: 24px 28px;
                }
                .pro-table .ant-table-thead > tr > th {
                    background: #f8fafc !important;
                    font-size: 11px !important;
                    font-weight: 700 !important;
                    color: #475569 !important;
                    text-transform: uppercase !important;
                    letter-spacing: 0.04em !important;
                    border-bottom: 1px solid #e5e7eb !important;
                }
                .pro-table .ant-table-tbody > tr > td {
                    border-bottom: 1px solid #f1f5f9 !important;
                    padding: 12px 16px !important;
                }
                .pro-table .ant-table-tbody > tr:hover > td {
                    background: #fafbfc !important;
                }
                .matrix-panel {
                    background: #ffffff;
                    border: 1px solid #e5e7eb;
                    border-radius: 6px;
                    overflow: hidden;
                    margin-bottom: 16px;
                }
                .matrix-check {
                    display: inline-flex;
                    width: 20px; height: 20px;
                    border-radius: 4px;
                    border: 2px solid #cbd5e1;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .matrix-check.on {
                    background-color: #15803d;
                    border-color: #15803d;
                }
            `}</style>

            {/* Page Title */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                        width: 38, height: 38, borderRadius: 6, background: '#1e293b',
                        border: '1px solid #0f172a', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', color: '#ffffff'
                    }}>
                        <Users size={18} strokeWidth={2} />
                    </div>
                    <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.2px' }}>
                            Users & Permissions
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
                            Manage team members, roles, and access control policies
                        </div>
                    </div>
                </div>
                <Space size={8}>
                    <Button icon={<RefreshCw size={13} strokeWidth={2} />} onClick={loadUsers}
                        style={{ borderRadius: 6, fontWeight: 600, fontSize: 12, height: 34 }}>
                        Refresh
                    </Button>
                    {activeTab === 'users' ? (
                        <Button type="primary" icon={<UserPlus size={13} strokeWidth={2} />}
                            onClick={() => handleOpenUserModal()}
                            style={{ background: '#1e293b', borderColor: '#1e293b', borderRadius: 6, fontWeight: 600, fontSize: 12, height: 34 }}>
                            Add User
                        </Button>
                    ) : (
                        <Button type="primary" icon={<Plus size={13} strokeWidth={2} />}
                            onClick={() => handleOpenRoleModal()}
                            style={{ background: '#1e293b', borderColor: '#1e293b', borderRadius: 6, fontWeight: 600, fontSize: 12, height: 34 }}>
                            Create Role
                        </Button>
                    )}
                </Space>
            </div>

            {/* Tab Switcher + Filters */}
            <Card style={{ borderRadius: 6, border: '1px solid #e5e7eb', marginBottom: 16 }}
                styles={{ body: { padding: '12px 16px' } }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <Segmented
                        value={activeTab}
                        onChange={setActiveTab}
                        options={[
                            { label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600 }}><Users size={12} /> Members</span>, value: 'users' },
                            { label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600 }}><Lock size={12} /> Permissions</span>, value: 'roles' }
                        ]}
                    />

                    {activeTab === 'users' ? (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <Input prefix={<Search size={12} style={{ color: '#94a3b8' }} />}
                                placeholder="Search users..." allowClear value={searchText}
                                onChange={e => setSearchText(e.target.value)}
                                style={{ width: 220, borderRadius: 6, height: 34 }} />
                            <Select placeholder="Role" allowClear value={selectedRole || undefined}
                                onChange={v => { setSelectedRole(v || ''); setCurrentPage(1); }}
                                style={{ width: 150 }}>
                                {roles.map(r => <Option key={r._id || r.id} value={r.name || r.id}>{r.displayName}</Option>)}
                            </Select>
                            <Select placeholder="Status" allowClear value={selectedStatus || undefined}
                                onChange={v => { setSelectedStatus(v !== undefined ? v : ''); setCurrentPage(1); }}
                                style={{ width: 110 }}>
                                <Option value="true">Active</Option>
                                <Option value="false">Inactive</Option>
                            </Select>
                            <Button icon={<Trash2 size={12} />} onClick={() => { setSearchText(''); setSelectedRole(''); setSelectedStatus(''); setCurrentPage(1); }}
                                style={{ borderRadius: 6, height: 34 }} />
                        </div>
                    ) : (
                        <div style={{ display: 'flex', gap: 8 }}>
                            <Input prefix={<Search size={12} style={{ color: '#94a3b8' }} />}
                                placeholder="Search permissions..." allowClear value={permissionSearch}
                                onChange={e => setPermissionSearch(e.target.value)}
                                style={{ width: 220, borderRadius: 6, height: 34 }} />
                            <Button type="primary" icon={<CheckCircle2 size={13} />}
                                loading={matrixSaving} onClick={handleSaveMatrixPermissions}
                                style={{ background: '#15803d', borderColor: '#15803d', fontWeight: 600, borderRadius: 6, fontSize: 12, height: 34 }}>
                                Save Permissions
                            </Button>
                        </div>
                    )}
                </div>
            </Card>

            {/* USERS TAB */}
            {activeTab === 'users' && (
                <>
                    <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                        <Col xs={24} sm={8}><StatCard icon={Users} label="Total Users" value={totalRecordCount} /></Col>
                        <Col xs={24} sm={8}><StatCard icon={UserCheck} label="Active" value={activeCount} color="#15803d" /></Col>
                        <Col xs={24} sm={8}><StatCard icon={XCircle} label="Inactive" value={inactiveCount} color="#b91c1c" /></Col>
                    </Row>

                    <Card style={{ borderRadius: 6, border: '1px solid #e5e7eb' }} styles={{ body: { padding: 0 } }}>
                        <Table
                            columns={columns}
                            dataSource={users.map(u => ({ ...u, key: u._id || u.id }))}
                            loading={loading}
                            className="pro-table"
                            pagination={{
                                current: currentPage, pageSize, total: totalRecords,
                                showSizeChanger: true, pageSizeOptions: ['10', '20', '50'],
                                showTotal: (total, range) => (
                                    <span style={{ fontSize: 11, color: '#64748b' }}>
                                        {range[0]}-{range[1]} of {total} users
                                    </span>
                                ),
                                onChange: (page, size) => { setCurrentPage(page); if (size) setPageSize(size); },
                                style: { padding: '12px 16px', margin: 0 }
                            }}
                            scroll={{ x: 900 }}
                            size="middle"
                        />
                    </Card>
                </>
            )}

            {/* PERMISSIONS TAB */}
            {activeTab === 'roles' && (
                Object.entries(filteredGroupedPermissions).map(([category, perms]) => (
                    <div key={category} className="matrix-panel">
                        <div style={{
                            padding: '12px 18px', borderBottom: '1px solid #f1f5f9',
                            background: '#fafbfc', display: 'flex', alignItems: 'center', gap: 8
                        }}>
                            <Shield size={13} strokeWidth={2} style={{ color: '#475569' }} />
                            <span style={{ fontWeight: 700, color: '#0f172a', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                {category}
                            </span>
                            <span style={{
                                fontSize: 10, fontWeight: 600, color: '#64748b', background: '#f1f5f9',
                                padding: '1px 7px', borderRadius: 4
                            }}>
                                {perms.length}
                            </span>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        <th style={{ width: 220, padding: '10px 18px', fontSize: 11, fontWeight: 700, color: '#475569', textAlign: 'left', background: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Role</th>
                                        {perms.map(p => (
                                            <th key={p._id || p.id} style={{
                                                padding: '10px 12px', fontSize: 11, fontWeight: 700, color: '#475569',
                                                textAlign: 'center', minWidth: 120, borderLeft: '1px solid #f1f5f9',
                                                textTransform: 'uppercase', letterSpacing: '0.03em'
                                            }}>
                                                <Tooltip title={p.name}>{p.displayName}</Tooltip>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {matrixRoles.map(role => {
                                        const rolePermIds = role.permissions?.map(p => p._id || p.id || p) || [];
                                        return (
                                            <tr key={role._id || role.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '10px 18px', fontSize: 12, fontWeight: 600, color: '#0f172a', background: '#fafbfc' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: role.color || '#475569' }} />
                                                            {role.displayName}
                                                        </div>
                                                        <Space size={4}>
                                                            <Button type="text" size="small" onClick={() => handleOpenRoleModal(role)} icon={<Pencil size={11} />} />
                                                            {role.name !== 'super_admin' && (
                                                                <Button type="text" danger size="small" onClick={() => handleDeleteRole(role._id || role.id)} icon={<Trash2 size={11} />} />
                                                            )}
                                                        </Space>
                                                    </div>
                                                </td>
                                                {perms.map(perm => {
                                                    const isAssigned = rolePermIds.includes(perm._id || perm.id);
                                                    const isOpMgr = (role.name || '').toLowerCase() === 'operational_manager';
                                                    const locked = isOpMgr && ['settings_manage', 'apikeys_manage', 'users_view', 'users_manage', 'roles_view', 'roles_manage'].includes(perm.name);
                                                    return (
                                                        <td key={perm._id || perm.id} style={{ padding: '10px', textAlign: 'center', borderLeft: '1px solid #f1f5f9' }}>
                                                            {locked ? (
                                                                <Tag style={{ fontSize: 9, fontWeight: 700, margin: 0, borderRadius: 4, padding: '1px 6px', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>Locked</Tag>
                                                            ) : (
                                                                <div className={`matrix-check ${isAssigned ? 'on' : ''}`}
                                                                    onClick={() => handleToggleCellPermission(role._id || role.id, perm._id || perm.id)}>
                                                                    {isAssigned && <Check size={11} strokeWidth={3} color="#ffffff" />}
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
                ))
            )}

            {/* USER MODAL */}
            <Modal
                title={<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 5, background: '#f8fafc', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
                        <UserCheck size={14} strokeWidth={2} />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                        {editingUser ? 'Edit User' : 'Add User'}
                    </span>
                </div>}
                open={showUserModal} onCancel={() => setShowUserModal(false)} centered destroyOnHidden width={720}
                footer={[
                    <Button key="cancel" onClick={() => setShowUserModal(false)} style={{ borderRadius: 6, fontWeight: 600, fontSize: 12 }}>Cancel</Button>,
                    <Button key="save" type="primary" onClick={handleSaveUser}
                        style={{ background: '#1e293b', borderColor: '#1e293b', borderRadius: 6, fontWeight: 600, fontSize: 12 }}>
                        {editingUser ? 'Save Changes' : 'Create User'}
                    </Button>
                ]}
            >
                <div style={{ maxHeight: '65vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 0' }}>
                    {/* Basic Info */}
                    <Card style={{ borderRadius: 6, border: '1px solid #e5e7eb' }} styles={{ body: { padding: 16 } }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
                            Basic Information
                        </div>
                        <Row gutter={[12, 12]}>
                            <Col span={12}><FieldLabel>First Name *</FieldLabel><Input value={userFormData.firstName} onChange={e => setUserFormData({ ...userFormData, firstName: e.target.value })} style={{ borderRadius: 6 }} /></Col>
                            <Col span={12}><FieldLabel>Last Name *</FieldLabel><Input value={userFormData.lastName} onChange={e => setUserFormData({ ...userFormData, lastName: e.target.value })} style={{ borderRadius: 6 }} /></Col>
                            <Col span={12}><FieldLabel>Email *</FieldLabel><Input type="email" disabled={!!editingUser} value={userFormData.email} onChange={e => setUserFormData({ ...userFormData, email: e.target.value })} style={{ borderRadius: 6 }} /></Col>
                            <Col span={12}><FieldLabel>Phone</FieldLabel><Input value={userFormData.phone} onChange={e => setUserFormData({ ...userFormData, phone: e.target.value })} style={{ borderRadius: 6 }} /></Col>
                            {!editingUser && <Col span={24}><FieldLabel>Password *</FieldLabel><Input type="password" value={userFormData.password} onChange={e => setUserFormData({ ...userFormData, password: e.target.value })} style={{ borderRadius: 6 }} /></Col>}
                        </Row>
                    </Card>

                    {/* Role */}
                    <Card style={{ borderRadius: 6, border: '1px solid #e5e7eb' }} styles={{ body: { padding: 16 } }}>
                        <FieldLabel>Role *</FieldLabel>
                        <Select style={{ width: '100%' }} value={userFormData.role || undefined} onChange={handleUserRoleChange} placeholder="Select role">
                            {roles.map(r => <Option key={r._id || r.id} value={r._id || r.id}>{r.displayName}</Option>)}
                        </Select>
                    </Card>

                    {/* Supervisors */}
                    {!isBrandManager && (
                        <Card style={{ borderRadius: 6, border: '1px solid #e5e7eb' }} styles={{ body: { padding: 16 } }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Supervisors</div>
                                <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', background: '#f1f5f9', padding: '1px 8px', borderRadius: 4 }}>
                                    {userFormData.supervisors.length} selected
                                </span>
                            </div>
                            <Input prefix={<Search size={12} />} size="small" placeholder="Search..." value={modalSearchSupervisor} onChange={e => setModalSearchSupervisor(e.target.value)} style={{ borderRadius: 6, marginBottom: 10 }} />
                            <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {filteredSupervisors.map(m => {
                                    const id = m._id || m.id;
                                    const checked = userFormData.supervisors.includes(id);
                                    return <SelectionCard key={id} isChecked={checked} name={`${m.firstName} ${m.lastName}`} subtitle={m.role?.displayName || 'Manager'}
                                        onClick={() => setUserFormData({ ...userFormData, supervisors: checked ? userFormData.supervisors.filter(i => i !== id) : [...userFormData.supervisors, id] })} />;
                                })}
                                {filteredSupervisors.length === 0 && <div style={{ textAlign: 'center', padding: 12, color: '#94a3b8', fontSize: 11 }}>No supervisors found</div>}
                            </div>
                        </Card>
                    )}

                    {/* Brand Managers (for Listing Team) */}
                    {isListingTeam && (
                        <Card style={{ borderRadius: 6, border: '1px solid #e5e7eb' }} styles={{ body: { padding: 16 } }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Brand Managers</div>
                                <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', background: '#f1f5f9', padding: '1px 8px', borderRadius: 4 }}>
                                    {userFormData.brandManagers.length} linked
                                </span>
                            </div>
                            <Input prefix={<Search size={12} />} size="small" placeholder="Search..." value={modalSearchBrandManager} onChange={e => setModalSearchBrandManager(e.target.value)} style={{ borderRadius: 6, marginBottom: 10 }} />
                            <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {filteredBrandManagers.map(m => {
                                    const id = m._id || m.id;
                                    const checked = userFormData.brandManagers.includes(id);
                                    return <SelectionCard key={id} isChecked={checked} name={`${m.firstName} ${m.lastName}`} subtitle={m.email}
                                        onClick={() => setUserFormData({ ...userFormData, brandManagers: checked ? userFormData.brandManagers.filter(i => i !== id) : [...userFormData.brandManagers, id] })} />;
                                })}
                                {filteredBrandManagers.length === 0 && <div style={{ textAlign: 'center', padding: 12, color: '#94a3b8', fontSize: 11 }}>No brand managers found</div>}
                            </div>
                        </Card>
                    )}

                    {/* Brands */}
                    <Card style={{ borderRadius: 6, border: '1px solid #e5e7eb' }} styles={{ body: { padding: 16 } }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Assigned Brands</div>
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', background: '#f1f5f9', padding: '1px 8px', borderRadius: 4 }}>
                                {(isListingTeam ? inheritedSellers : userFormData.assignedSellers).length} brands
                            </span>
                        </div>

                        {isListingTeam && (
                            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '8px 12px', marginBottom: 10, fontSize: 11, color: '#1d4ed8' }}>
                                Brands are automatically inherited from assigned brand managers.
                            </div>
                        )}
                        {isCatalogManager && (
                            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '8px 12px', marginBottom: 10, fontSize: 11, color: '#92400e' }}>
                                Read-only access. Brand associations cannot be modified for this role.
                            </div>
                        )}

                        {!isListingTeam && (
                            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                                <Input prefix={<Search size={12} />} size="small" placeholder="Search brands..." value={modalSearchSeller} onChange={e => setModalSearchSeller(e.target.value)} style={{ borderRadius: 6, flex: 1 }} />
                                <Button size="small" onClick={() => setUserFormData({ ...userFormData, assignedSellers: sellers.map(s => s._id || s.id) })} style={{ fontSize: 11, fontWeight: 600 }}>All</Button>
                                <Button size="small" onClick={() => setUserFormData({ ...userFormData, assignedSellers: [] })} style={{ fontSize: 11, fontWeight: 600 }}>Clear</Button>
                            </div>
                        )}

                        <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {filteredSellers.map(s => {
                                const id = s._id || s.id;
                                const checked = isListingTeam ? true : userFormData.assignedSellers.includes(id);
                                return <SelectionCard key={id} isChecked={checked} readOnly={isListingTeam} icon={Store} iconBg="#15803d"
                                    name={s.name} subtitle={s.code || 'Brand'}
                                    onClick={() => {
                                        if (isListingTeam) return;
                                        setUserFormData({ ...userFormData, assignedSellers: checked ? userFormData.assignedSellers.filter(i => i !== id) : [...userFormData.assignedSellers, id] });
                                    }} />;
                            })}
                            {filteredSellers.length === 0 && <div style={{ textAlign: 'center', padding: 12, color: '#94a3b8', fontSize: 11 }}>
                                {isListingTeam ? 'Link brand managers to see brands' : 'No brands found'}
                            </div>}
                        </div>
                    </Card>
                </div>
            </Modal>

            {/* ROLE MODAL */}
            <Modal
                title={<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 5, background: '#f8fafc', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
                        <Shield size={14} strokeWidth={2} />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                        {editingRole ? 'Edit Role' : 'Create Role'}
                    </span>
                </div>}
                open={showRoleModal} onCancel={() => setShowRoleModal(false)} centered destroyOnHidden width={480}
                footer={[
                    <Button key="cancel" onClick={() => setShowRoleModal(false)} style={{ borderRadius: 6, fontWeight: 600, fontSize: 12 }}>Cancel</Button>,
                    <Button key="save" type="primary" onClick={handleSaveRole}
                        style={{ background: '#1e293b', borderColor: '#1e293b', borderRadius: 6, fontWeight: 600, fontSize: 12 }}>
                        {editingRole ? 'Save Changes' : 'Create Role'}
                    </Button>
                ]}
            >
                <div style={{ padding: '8px 0' }}>
                    <div style={{ marginBottom: 14 }}><FieldLabel>Role Identifier</FieldLabel><Input disabled={!!editingRole} placeholder="e.g. analyst_l2" value={roleFormData.name} onChange={e => setRoleFormData({ ...roleFormData, name: e.target.value })} style={{ borderRadius: 6 }} /></div>
                    <div style={{ marginBottom: 14 }}><FieldLabel>Display Name *</FieldLabel><Input placeholder="e.g. Senior Analyst" value={roleFormData.displayName} onChange={e => setRoleFormData({ ...roleFormData, displayName: e.target.value })} style={{ borderRadius: 6 }} /></div>
                    <Row gutter={12} style={{ marginBottom: 14 }}>
                        <Col span={12}><FieldLabel>Access Level (0-100)</FieldLabel><Input type="number" min={0} max={100} value={roleFormData.level} onChange={e => setRoleFormData({ ...roleFormData, level: parseInt(e.target.value) || 0 })} style={{ borderRadius: 6 }} /></Col>
                        <Col span={12}><FieldLabel>Color</FieldLabel><Space size={8}><Input type="color" value={roleFormData.color} onChange={e => setRoleFormData({ ...roleFormData, color: e.target.value })} style={{ width: 40, height: 34, padding: '3px 4px', cursor: 'pointer' }} /><span style={{ fontFamily: 'monospace', fontSize: 11, color: '#64748b' }}>{roleFormData.color}</span></Space></Col>
                    </Row>
                    <div><FieldLabel>Description</FieldLabel><TextArea rows={3} placeholder="Describe role responsibilities..." value={roleFormData.description} onChange={e => setRoleFormData({ ...roleFormData, description: e.target.value })} style={{ borderRadius: 6 }} /></div>
                </div>
            </Modal>

            {/* EMAIL MODAL */}
            <Modal
                title={<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 5, background: '#f8fafc', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
                        <Mail size={14} strokeWidth={2} />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                        Send Email to {emailUser?.firstName} {emailUser?.lastName}
                    </span>
                </div>}
                open={showEmailModal} onCancel={() => setShowEmailModal(false)} centered destroyOnHidden width={520}
                footer={[
                    <Button key="cancel" onClick={() => setShowEmailModal(false)} style={{ borderRadius: 6, fontWeight: 600, fontSize: 12 }}>Cancel</Button>,
                    <Button key="send" type="primary" loading={sendingEmail} onClick={handleSendEmailSubmit}
                        icon={<Send size={12} strokeWidth={2} />}
                        style={{ background: '#1e293b', borderColor: '#1e293b', borderRadius: 6, fontWeight: 600, fontSize: 12 }}>
                        Send Email
                    </Button>
                ]}
            >
                <div style={{ padding: '8px 0' }}>
                    <div style={{ marginBottom: 14 }}><FieldLabel>To</FieldLabel><Input value={emailUser?.email} disabled style={{ borderRadius: 6, background: '#f8fafc' }} /></div>
                    <div style={{ marginBottom: 14 }}><FieldLabel>Subject *</FieldLabel><Input placeholder="Enter subject" value={emailForm.subject} onChange={e => setEmailForm({ ...emailForm, subject: e.target.value })} style={{ borderRadius: 6 }} /></div>
                    <div><FieldLabel>Message *</FieldLabel><TextArea rows={6} placeholder="Write your message..." value={emailForm.message} onChange={e => setEmailForm({ ...emailForm, message: e.target.value })} style={{ borderRadius: 6 }} /></div>
                </div>
            </Modal>
        </div>
    );
};

export default UsersPage;