import React, { useState, useEffect, useMemo } from 'react';
import { roleApi } from '../services/api';
import {
    Shield, Plus, Pencil, Trash2, CheckCircle2, AlertTriangle, Check, X,
    Settings, Users, Layout, FileText, BarChart3, Package, ShoppingCart,
    Settings2, Database, Key, Bell, Search, DollarSign, TrendingUp, Warehouse,
    MessageSquare, Zap, Info, AlertCircle, Lock
} from 'lucide-react';
import { PageLoader } from '@/components/application/loading-indicator/PageLoader';
import {
    Space, Button, Segmented, Table, Modal, Card, Statistic, Input, Row, Col,
    Typography, Tag, Tooltip, Form, Select, Switch, Badge, Divider, notification, message as antdMessage
} from 'antd';

const { Text, Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const getPriorityDescription = (level) => {
    if (level >= 90) return 'Full Administrative Access';
    if (level >= 70) return 'High Administrative Access';
    if (level >= 50) return 'Team Management Access';
    if (level >= 30) return 'Standard Access';
    if (level >= 10) return 'Limited Access';
    return 'Basic Access';
};

const getCategoryIcon = (category) => {
    const icons = {
        'Dashboard': BarChart3,
        'Reports': FileText,
        'SKU': Package,
        'Seller': ShoppingCart,
        'Scraping': Search,
        'Settings': Settings2,
        'Users': Users,
        'Roles': Key,
        'Inventory': Warehouse,
        'Messaging': MessageSquare,
        'Profit': DollarSign,
        'Advertising': TrendingUp,
        'Actions': Zap,
        'Alerts': Bell,
        'Default': Settings
    };
    const Icon = icons[category] || icons['Default'];
    return Icon;
};

const RolesPage = () => {
    const [messageApi, messageContextHolder] = antdMessage.useMessage();
    const [notificationApi, notificationContextHolder] = notification.useNotification();

    const [roles, setRoles] = useState([]);
    const [permissions, setPermissions] = useState([]);
    const [permissionsGrouped, setPermissionsGrouped] = useState({});
    const [loading, setLoading] = useState(true);
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [editingRole, setEditingRole] = useState(null);
    const [selectedPermissions, setSelectedPermissions] = useState([]);
    const [activeTab, setActiveTab] = useState('overview'); // 'overview' or 'matrix'
    const [matrixRoles, setMatrixRoles] = useState([]);
    const [savingMatrix, setSavingMatrix] = useState(false);
    const [matrixSearch, setMatrixSearch] = useState('');

    const [roleFormData, setRoleFormData] = useState({
        name: '',
        displayName: '',
        description: '',
        level: 10,
        color: '#4F46E5',
        permissions: [],
    });

    // Group roles by priority
    const groupedRoles = useMemo(() => {
        const sorted = [...roles].sort((a, b) => {
            if (b.level !== a.level) return b.level - a.level;
            return (a.displayName || '').localeCompare(b.displayName || '');
        });
        
        const groups = {};
        sorted.forEach(role => {
            const level = role.level;
            if (!groups[level]) {
                groups[level] = [];
            }
            groups[level].push(role);
        });
        return groups;
    }, [roles]);

    const loadRoles = async () => {
        setLoading(true);
        try {
            const response = await roleApi.getAll();
            if (response.success) {
                const rolesData = response.data?.roles || response.data || [];
                const allowedRoleNames = ['admin', 'operational_manager', 'brand manager', 'catalog_manager', 'listing_team'];
                const filteredRoles = (Array.isArray(rolesData) ? rolesData : []).filter(r => 
                    allowedRoleNames.includes((r.name || r.displayName || '').toString().toLowerCase())
                );
                setRoles(filteredRoles);
                setMatrixRoles(JSON.parse(JSON.stringify(filteredRoles)));
            }
        } catch (error) {
            console.error('Failed to load roles:', error);
            messageApi.error('Unable to fetch application roles registry.');
        }
        setLoading(false);
    };

    const loadPermissions = async () => {
        try {
            const response = await roleApi.getPermissions();
            if (response.success) {
                setPermissions(response.data.permissions || []);
                setPermissionsGrouped(response.data.groupedPermissions || {});
            }
        } catch (error) {
            console.error('Failed to load permissions:', error);
        }
    };

    useEffect(() => {
        loadRoles();
        loadPermissions();
    }, []);

    const handleOpenRoleModal = (role = null) => {
        if (role) {
            setEditingRole(role);
            setRoleFormData({
                name: role.name || '',
                displayName: role.displayName || '',
                description: role.description || '',
                level: role.level || 10,
                color: role.color || '#4F46E5',
                permissions: role.permissions?.map(p => p._id || p.id) || [],
            });
            setSelectedPermissions(role.permissions?.map(p => p._id || p.id) || []);
        } else {
            setEditingRole(null);
            setRoleFormData({
                name: '',
                displayName: '',
                description: '',
                level: 10,
                color: '#4F46E5',
                permissions: [],
            });
            setSelectedPermissions([]);
        }
        setShowRoleModal(true);
    };

    const handleSaveRole = async () => {
        if (!roleFormData.displayName) {
            messageApi.warning('Role Display Label is required.');
            return;
        }
        try {
            const data = { ...roleFormData, permissions: selectedPermissions };
            if (editingRole) {
                await roleApi.update(editingRole._id || editingRole.id, data);
                messageApi.success('Organization access capabilities configuration saved.');
            } else {
                await roleApi.create(data);
                messageApi.success('Strategic organization role deployed successfully.');
            }
            setShowRoleModal(false);
            loadRoles();
        } catch (error) {
            console.error('Failed to save role:', error);
            messageApi.error(error.message || 'Strategic role configuration failure.');
        }
    };

    const handleDeleteRole = (roleId) => {
        Modal.confirm({
            title: 'Retire Access Role?',
            icon: <AlertCircle className="text-rose-500" size={20} />,
            content: 'Decommissioning a configured access level cannot be undone. All attached entities will automatically assume default profiles.',
            okText: 'Confirm Termination',
            okType: 'danger',
            centered: true,
            maskClosable: true,
            onOk: async () => {
                try {
                    await roleApi.delete(roleId);
                    messageApi.success('Security framework profile retired.');
                    loadRoles();
                } catch (error) {
                    console.error('Failed to delete role:', error);
                    messageApi.error(error.message || 'System error decommissioning role.');
                }
            }
        });
    };

    const togglePermission = (permissionId) => {
        setSelectedPermissions(prev =>
            prev.includes(permissionId)
                ? prev.filter(id => id !== permissionId)
                : [...prev, permissionId]
        );
    };

    const toggleAllPermissions = (category) => {
        const categoryPerms = permissionsGrouped[category] || [];
        const categoryIds = categoryPerms.map(p => p._id || p.id);
        const allSelected = categoryIds.every(id => selectedPermissions.includes(id));

        if (allSelected) {
            setSelectedPermissions(prev => prev.filter(id => !categoryIds.includes(id)));
        } else {
            setSelectedPermissions(prev => [...new Set([...prev, ...categoryIds])]);
        }
    };

    const getCategorySelectionCount = (category) => {
        const categoryPerms = permissionsGrouped[category] || [];
        const categoryIds = categoryPerms.map(p => p._id || p.id);
        return categoryIds.filter(id => selectedPermissions.includes(id)).length;
    };

    const handleDisplayNameChange = (e) => {
        const value = e.target.value;
        setRoleFormData(prev => {
            const newData = { ...prev, displayName: value };
            if (!editingRole) {
                newData.name = value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
            }
            return newData;
        });
    };

    const handleToggleMatrixPermission = (roleId, permissionId) => {
        setMatrixRoles(prevRoles => {
            return prevRoles.map(role => {
                if ((role._id || role.id) === roleId) {
                    const permissionsList = role.permissions || [];
                    const hasPerm = permissionsList.some(p => (p._id || p.id) === permissionId);
                    let newPermissions = [];
                    if (hasPerm) {
                        newPermissions = permissionsList.filter(p => (p._id || p.id) !== permissionId);
                    } else {
                        const permDetails = permissions.find(p => (p._id || p.id) === permissionId);
                        newPermissions = [...permissionsList, permDetails || { _id: permissionId, id: permissionId }];
                    }
                    return { ...role, permissions: newPermissions };
                }
                return role;
            });
        });
    };

    const handleSaveMatrixPermissions = async () => {
        setSavingMatrix(true);
        try {
            for (const role of matrixRoles) {
                const payload = {
                    displayName: role.displayName,
                    description: role.description,
                    level: role.level,
                    color: role.color,
                    permissions: role.permissions?.map(p => p._id || p.id) || []
                };
                await roleApi.update(role._id || role.id, payload);
            }
            notificationApi.success({
                message: 'Matrix Deployment Synchronized',
                description: 'Direct permission overrides successfully written to cloud and propagated instantly to operational profiles.',
                placement: 'topRight'
            });
            await loadRoles();
        } catch (error) {
            console.error('Failed to save matrix permissions:', error);
            messageApi.error('Interactive matrix synchronization failure.');
        } finally {
            setSavingMatrix(false);
        }
    };

    // Filter interactive permissions
    const filteredPermissionsGrouped = useMemo(() => {
        if (!matrixSearch) return permissionsGrouped;
        const filtered = {};
        Object.entries(permissionsGrouped).forEach(([cat, list]) => {
            const matched = list.filter(p => 
                p.displayName?.toLowerCase().includes(matrixSearch.toLowerCase()) ||
                p.name?.toLowerCase().includes(matrixSearch.toLowerCase())
            );
            if (matched.length > 0) {
                filtered[cat] = matched;
            }
        });
        return filtered;
    }, [permissionsGrouped, matrixSearch]);

    if (loading && roles.length === 0) {
        return <PageLoader message="Synthesizing Security Policies..." />;
    }

    const priorityLevels = Object.keys(groupedRoles).sort((a, b) => Number(b) - Number(a));

    return (
        <div className="roles-page-container">
            {messageContextHolder}
            {notificationContextHolder}

            <style>{`
                .roles-page-container {
                    display: flex;
                    flex-direction: column;
                    height: calc(100vh - 60px);
                    overflow: hidden;
                    background-color: #f8fafc;
                    margin: -1.5rem -2rem;
                }
                .roles-header {
                    flex-shrink: 0;
                    background: #ffffff;
                    padding: 16px 24px;
                    border-bottom: 1px solid #e2e8f0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    z-index: 10;
                }
                .roles-scroll-content {
                    flex: 1;
                    overflow-y: auto;
                    padding: 24px;
                    display: flex;
                    flex-direction: column;
                    gap: 24px;
                }
                .kpi-stat-card {
                    border-radius: 16px !important;
                    border: 1px solid #e2e8f0 !important;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.01) !important;
                    transition: all 0.2s ease !important;
                }
                .kpi-stat-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 16px -4px rgba(0,0,0,0.04) !important;
                }
                .segmented-roles .ant-segmented-item-selected {
                    background-color: #0f172a !important;
                    color: #ffffff !important;
                    font-weight: 650 !important;
                }
                .group-header-strip {
                    display: flex;
                    align-items: center;
                    background: #f1f5f9;
                    padding: 12px 20px;
                    border-radius: 12px;
                    border: 1px solid #e2e8f0;
                    margin-bottom: 16px;
                }
                .role-blueprint-card {
                    border-radius: 20px !important;
                    border: 1.5px solid #e2e8f0 !important;
                    transition: all 0.25s ease !important;
                }
                .role-blueprint-card:hover {
                    border-color: #cbd5e1 !important;
                    transform: translateY(-3px);
                    box-shadow: 0 12px 24px -6px rgba(0,0,0,0.06) !important;
                }
                .matrix-card-wrapper {
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 20px;
                    overflow: hidden;
                    box-shadow: 0 1px 4px rgba(0,0,0,0.02);
                }
                .matrix-primary-table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .matrix-primary-table th {
                    background: #f8fafc;
                    color: #475569;
                    font-size: 12px;
                    font-weight: 750;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    padding: 14px 16px;
                    border-bottom: 1.5px solid #e2e8f0;
                }
                .matrix-primary-table td {
                    padding: 12px 16px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .matrix-cell-check {
                    display: inline-flex;
                    width: 20px;
                    height: 20px;
                    border-radius: 6px;
                    border: 2px solid #cbd5e1;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .matrix-cell-check.active {
                    background: #10b981;
                    border-color: #10b981;
                    box-shadow: 0 2px 6px rgba(16, 185, 129, 0.2);
                }
                .glass-modal .ant-modal-content {
                    border-radius: 24px !important;
                    overflow: hidden !important;
                }
                .glass-modal .ant-modal-header {
                    background: #f8fafc !important;
                    border-bottom: 1px solid #f1f5f9 !important;
                    padding: 20px 24px !important;
                }
                .glass-modal .ant-modal-footer {
                    border-top: 1px solid #f1f5f9 !important;
                    padding: 16px 24px !important;
                }
                .perm-picker-panel {
                    border-radius: 16px;
                    border: 1px solid #e2e8f0;
                    overflow: hidden;
                    background: #ffffff;
                    height: 100%;
                }
                .perm-picker-panel .header {
                    background: #fcfdfe;
                    border-bottom: 1px solid #f1f5f9;
                    padding: 10px 16px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .perm-item-row {
                    display: flex;
                    align-items: center;
                    padding: 8px 14px;
                    margin: 4px 8px;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.1s;
                }
                .perm-item-row:hover {
                    background: #f1f5f9;
                }
                .perm-item-row.selected {
                    background: #f5f3ff;
                }
                @media (max-width: 768px) {
                    .roles-header { flex-direction: column; align-items: stretch; gap: 12px; }
                    .roles-page-container { height: auto; overflow: visible; margin: -0.75rem; }
                }
            `}</style>

            {/* HEADER */}
            <div className="roles-header">
                <Space align="center" size={12}>
                    <div style={{ background: '#F5F3FF', color: '#8B5CF6', padding: 8, borderRadius: 10, display: 'flex' }}>
                        <Shield size={20} />
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontWeight: 800, color: '#0f172a', fontSize: 18, letterSpacing: '-0.02em' }}>Roles & Matrix Catalog</h3>
                        <Text type="secondary" style={{ fontSize: 12 }}>Fine-tune permission logic across hierarchical enterprise access tiers.</Text>
                    </div>
                </Space>
                <Button 
                    type="primary" 
                    icon={<Plus size={14} />} 
                    shape="round"
                    onClick={() => handleOpenRoleModal()}
                    style={{ background: '#0f172a', borderColor: '#0f172a', fontWeight: 700, fontSize: 12.5 }}
                >
                    Deploy Custom Role
                </Button>
            </div>

            {/* CONTENT SCROLLPAD */}
            <div className="roles-scroll-content">
                
                {/* Stats Summary Cards */}
                <Row gutter={[16, 16]}>
                    <Col xs={12} sm={8}>
                        <Card className="kpi-stat-card" bordered={false}>
                            <Space align="start" size={16} style={{ width: '100%', justifyContent: 'space-between' }}>
                                <Statistic title={<span style={{ color: '#64748b', fontSize: 11, fontWeight: 750, textTransform: 'uppercase' }}>Strategic Roles</span>} value={roles.length} valueStyle={{ color: '#0f172a', fontWeight: 800, fontSize: 22 }} />
                                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#EEF2FF', color: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Shield size={18} /></div>
                            </Space>
                        </Card>
                    </Col>
                    <Col xs={12} sm={8}>
                        <Card className="kpi-stat-card" bordered={false}>
                            <Space align="start" size={16} style={{ width: '100%', justifyContent: 'space-between' }}>
                                <Statistic title={<span style={{ color: '#64748b', fontSize: 11, fontWeight: 750, textTransform: 'uppercase' }}>Secured Modules</span>} value={Object.keys(permissionsGrouped).length} valueStyle={{ color: '#8b5cf6', fontWeight: 800, fontSize: 22 }} />
                                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#F5F3FF', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Key size={18} /></div>
                            </Space>
                        </Card>
                    </Col>
                    <Col xs={24} sm={8}>
                        <Card className="kpi-stat-card" bordered={false}>
                            <Space align="start" size={16} style={{ width: '100%', justifyContent: 'space-between' }}>
                                <Statistic title={<span style={{ color: '#64748b', fontSize: 11, fontWeight: 750, textTransform: 'uppercase' }}>Mapped Capabilities</span>} value={permissions.length} valueStyle={{ color: '#d97706', fontWeight: 800, fontSize: 22 }} />
                                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#FEF3C7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Lock size={18} /></div>
                            </Space>
                        </Card>
                    </Col>
                </Row>

                {/* Secondary Nav and Sync Strip */}
                <Card bordered={false} styles={{ body: { padding: '12px 16px' } }} style={{ borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.01)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                        <Segmented
                            className="segmented-roles"
                            size="large"
                            value={activeTab}
                            onChange={v => setActiveTab(v)}
                            style={{ background: '#f1f5f9', borderRadius: 10, padding: 3 }}
                            options={[
                                { label: <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px' }}><Layout size={13} /> <span>Blueprint Cards</span></div>, value: 'overview' },
                                { label: <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px' }}><Lock size={13} /> <span>Direct Matrix</span></div>, value: 'matrix' }
                            ]}
                        />

                        {activeTab === 'matrix' && (
                            <div style={{ flex: 1, display: 'flex', gap: 8, maxWidth: 650, justifyContent: 'flex-end', alignItems: 'center' }}>
                                <Input 
                                    prefix={<Search size={13} style={{ color: '#94a3b8', marginRight: 4 }} />} 
                                    placeholder="Query permissions matrix..." 
                                    allowClear
                                    value={matrixSearch}
                                    onChange={e => setMatrixSearch(e.target.value)}
                                    style={{ width: 240, borderRadius: 8 }}
                                />
                                <Button 
                                    type="primary"
                                    icon={<CheckCircle2 size={14} />}
                                    loading={savingMatrix}
                                    onClick={handleSaveMatrixPermissions}
                                    style={{ background: '#10b981', borderColor: '#10b981', fontWeight: 700, borderRadius: 8 }}
                                >
                                    Commit & Sync Database
                                </Button>
                            </div>
                        )}
                    </div>
                </Card>

                {/* VIEWPORT: BLUEPRINT CARDS */}
                {activeTab === 'overview' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                        
                        {/* Info Disclaimer */}
                        <div style={{ display: 'flex', gap: 12, background: '#eff6ff', border: '1px solid #bfdbfe', padding: 16, borderRadius: 16 }}>
                            <Info size={18} className="text-blue-600" style={{ marginTop: 2, flexShrink: 0 }} />
                            <div>
                                <strong style={{ display: 'block', color: '#1e40af', fontSize: 13, marginBottom: 2 }}>Hierarchical Priority Architecture</strong>
                                <p style={{ color: '#1e3a8a', margin: 0, fontSize: 12, lineHeight: 1.5 }}>
                                    Access scopes are regulated by technical priority thresholds. Highest priority (100) delegates administrative governance over core settings. Default configuration models operate under strict immutability protection.
                                </p>
                            </div>
                        </div>

                        {/* Loop Groups */}
                        {priorityLevels.map(level => {
                            const levelNum = Number(level);
                            const rolesInGroup = groupedRoles[level] || [];
                            const PriorityIcon = levelNum >= 70 ? Shield : levelNum >= 50 ? Users : Settings;
                            
                            return (
                                <div key={level}>
                                    <div className="group-header-strip">
                                        <PriorityIcon size={16} style={{ color: '#4f46e5', marginRight: 10 }} />
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ fontWeight: 800, color: '#0f172a', fontSize: 13.5 }}>Priority Index {level}</span>
                                            <Divider type="vertical" style={{ borderColor: '#cbd5e1', margin: 0 }} />
                                            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{getPriorityDescription(levelNum)}</span>
                                        </div>
                                        <Badge count={`${rolesInGroup.length} Roles`} style={{ backgroundColor: '#e0e7ff', color: '#4f46e5', boxShadow: 'none', marginLeft: 'auto', fontWeight: 700, fontSize: 11 }} />
                                    </div>

                                    <Row gutter={[16, 16]}>
                                        {rolesInGroup.map(role => {
                                            const roleColor = role.color || '#6b7280';
                                            
                                            return (
                                                <Col key={role._id || role.id} xs={24} md={12} lg={8}>
                                                    <Card className="role-blueprint-card" styles={{ body: { padding: 20 } }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                                                            <Tag 
                                                                bordered={false} 
                                                                style={{ 
                                                                    backgroundColor: `${roleColor}15`, 
                                                                    color: roleColor, 
                                                                    borderRadius: 20, 
                                                                    fontWeight: 800, 
                                                                    fontSize: 10, 
                                                                    padding: '2px 12px', 
                                                                    border: `1px solid ${roleColor}20`
                                                                }}
                                                            >
                                                                LEVEL {role.level}
                                                            </Tag>
                                                            <Space size={4}>
                                                                <Tooltip title="Modify Definition">
                                                                    <Button 
                                                                        type="text" 
                                                                        shape="circle" 
                                                                        size="small" 
                                                                        onClick={() => handleOpenRoleModal(role)}
                                                                        icon={<Pencil size={13} className="text-slate-500" />} 
                                                                    />
                                                                </Tooltip>
                                                                {!role.isSystem && (
                                                                    <Tooltip title="Retire Definition">
                                                                        <Button 
                                                                            type="text" 
                                                                            danger 
                                                                            shape="circle" 
                                                                            size="small" 
                                                                            onClick={() => handleDeleteRole(role._id || role.id)}
                                                                            icon={<Trash2 size={13} />} 
                                                                        />
                                                                    </Tooltip>
                                                                )}
                                                            </Space>
                                                        </div>

                                                        <div style={{ marginBottom: 12 }}>
                                                            <h4 style={{ margin: '0 0 4px 0', fontWeight: 800, color: '#0f172a', fontSize: 15 }}>{role.displayName}</h4>
                                                            <code style={{ fontSize: 10, color: '#64748b', backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                                                                {role.name}
                                                            </code>
                                                        </div>

                                                        <p style={{ color: '#64748b', fontSize: 12, lineHeight: 1.5, height: 36, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', margin: '0 0 20px 0' }}>
                                                            {role.description || 'Platform capabilities profile mapped to enterprise governance and operations access logs.'}
                                                        </p>

                                                        <Divider style={{ margin: '0 0 14px 0' }} />

                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <Space size={6} style={{ color: '#4f46e5', fontWeight: 700, fontSize: 12 }}>
                                                                <Key size={12} />
                                                                <span>{role.permissions?.length || 0} Rules Enabled</span>
                                                            </Space>
                                                            {role.isSystem && (
                                                                <Tag color="success" icon={<CheckCircle2 size={9} style={{ verticalAlign: '-1px' }} />} style={{ fontSize: 9.5, fontWeight: 750, borderRadius: 6, margin: 0 }}>
                                                                    SYSTEM
                                                                </Tag>
                                                            )}
                                                        </div>
                                                    </Card>
                                                </Col>
                                            );
                                        })}
                                    </Row>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* VIEWPORT: DIRECT MATRIX GRID */}
                {activeTab === 'matrix' && (
                    <div className="matrix-card-wrapper">
                        <div style={{ overflowX: 'auto' }}>
                            <table className="matrix-primary-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '32%', textAlign: 'left', background: '#f8fafc' }}>System Module / Permission Key</th>
                                        <th style={{ textAlign: 'center' }}>Super Admin</th>
                                        <th style={{ textAlign: 'center' }}>Operational Mgr</th>
                                        <th style={{ textAlign: 'center' }}>Brand Mgr</th>
                                        <th style={{ textAlign: 'center' }}>Catalog Mgr</th>
                                        <th style={{ textAlign: 'center' }}>Listing Team</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(filteredPermissionsGrouped).map(([category, permsInCategory]) => {
                                        const superAdminRole = matrixRoles.find(r => (r.name || '').toLowerCase() === 'admin');
                                        const operationalManagerRole = matrixRoles.find(r => (r.name || '').toLowerCase() === 'operational_manager');
                                        const brandManagerRole = matrixRoles.find(r => (r.name || '').toLowerCase() === 'brand manager');
                                        const catalogManagerRole = matrixRoles.find(r => (r.name || '').toLowerCase() === 'catalog_manager');
                                        const listingTeamRole = matrixRoles.find(r => (r.name || '').toLowerCase() === 'listing_team');

                                        return (
                                            <React.Fragment key={category}>
                                                <tr style={{ background: '#f8fafc' }}>
                                                    <td colSpan={6} style={{ padding: '14px 16px', borderTop: '1px solid #e2e8f0' }}>
                                                        <Space size={8}>
                                                            <div style={{ display: 'flex', background: '#e0e7ff', padding: 5, borderRadius: 6, color: '#4f46e5' }}><Shield size={12} /></div>
                                                            <span style={{ fontWeight: 800, fontSize: 12.5, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#1e293b' }}>{category} Module Policies</span>
                                                        </Space>
                                                    </td>
                                                </tr>
                                                {permsInCategory.map(perm => {
                                                    return (
                                                        <tr key={perm._id || perm.id}>
                                                            <td>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                                                    <span style={{ fontWeight: 700, fontSize: 12.5, color: '#334155' }}>{perm.displayName}</span>
                                                                    <span style={{ color: '#64748b', fontSize: 11 }}>{perm.description || `Grants capability to execute '${perm.displayName}' triggers.`}</span>
                                                                    <code style={{ alignSelf: 'flex-start', fontSize: 9.5, color: '#94a3b8', background: '#f8fafc', padding: '1px 4px', borderRadius: 4, border: '1px solid #f1f5f9', marginTop: 2 }}>
                                                                        {perm.name}
                                                                    </code>
                                                                </div>
                                                            </td>
                                                            {[
                                                                { key: 'admin', role: superAdminRole },
                                                                { key: 'operational_manager', role: operationalManagerRole },
                                                                { key: 'brand manager', role: brandManagerRole },
                                                                { key: 'catalog_manager', role: catalogManagerRole },
                                                                { key: 'listing_team', role: listingTeamRole },
                                                            ].map(col => {
                                                                const rolePermIds = col.role?.permissions?.map(p => p._id || p.id || p) || [];
                                                                const hasPerm = rolePermIds.includes(perm._id || perm.id);
                                                                
                                                                const isOperationalManager = col.key === 'operational_manager';
                                                                const isRestrictedForOpManager = isOperationalManager && [
                                                                    'settings_manage', 'apikeys_manage', 'users_view', 'users_manage', 'roles_view', 'roles_manage'
                                                                ].includes(perm.name);

                                                                return (
                                                                    <td key={col.key} style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                                                        {isRestrictedForOpManager ? (
                                                                            <Tag color="error" style={{ fontSize: 9, fontWeight: 750, borderRadius: 6, margin: 0 }}>LOCKED</Tag>
                                                                        ) : (
                                                                            <div 
                                                                                className={`matrix-cell-check ${hasPerm ? 'active' : ''}`}
                                                                                onClick={() => col.role && handleToggleMatrixPermission(col.role._id || col.role.id, perm._id || perm.id)}
                                                                            >
                                                                                {hasPerm && <Check size={11} strokeWidth={3} className="text-white" />}
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    );
                                                })}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* DYNAMIC ROLE DESIGNER MODAL */}
            <Modal
                title={
                    <Space align="center" size={12}>
                        <div style={{ background: '#EEF2FF', color: '#4F46E5', padding: 6, borderRadius: 8, display: 'flex' }}>
                            <Shield size={16} />
                        </div>
                        <span style={{ fontWeight: 800 }}>{editingRole ? 'Modify Role Specifications' : 'Initialize Policy Blueprint'}</span>
                    </Space>
                }
                open={showRoleModal}
                onCancel={() => setShowRoleModal(false)}
                centered
                destroyOnClose
                width={950}
                className="glass-modal"
                footer={[
                    <Button key="back" shape="round" onClick={() => setShowRoleModal(false)}>Discard</Button>,
                    <Button 
                        key="submit" 
                        type="primary" 
                        shape="round" 
                        onClick={handleSaveRole}
                        style={{ background: '#0f172a', borderColor: '#0f172a', fontWeight: 700 }}
                    >
                        {editingRole ? 'Save Definition' : 'Deploy Role'}
                    </Button>
                ]}
            >
                <div style={{ padding: '8px 0', maxHeight: '68vh', overflowY: 'auto', overflowX: 'hidden' }}>
                    
                    {/* Row 1: Core Attributes */}
                    <Card bordered={false} style={{ background: '#f8fafc', borderRadius: 16, border: '1px solid #e2e8f0', marginBottom: 24 }} styles={{ body: { padding: 16 } }}>
                        <Row gutter={[16, 16]}>
                            <Col span={8}>
                                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>Technical Unique Key</label>
                                <Input 
                                    placeholder="e.g. support_tier_1" 
                                    disabled={editingRole?.isSystem}
                                    value={roleFormData.name}
                                    onChange={e => setRoleFormData({ ...roleFormData, name: e.target.value })}
                                    style={{ borderRadius: 8 }}
                                />
                            </Col>
                            <Col span={8}>
                                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>Display Label *</label>
                                <Input 
                                    placeholder="e.g. Support Technician" 
                                    value={roleFormData.displayName}
                                    onChange={handleDisplayNameChange}
                                    style={{ borderRadius: 8 }}
                                />
                            </Col>
                            <Col span={4}>
                                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>Priority Index</label>
                                <Input 
                                    type="number" min={0} max={100}
                                    value={roleFormData.level}
                                    onChange={e => setRoleFormData({ ...roleFormData, level: parseInt(e.target.value) || 0 })}
                                    style={{ borderRadius: 8 }}
                                />
                            </Col>
                            <Col span={4}>
                                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>Color Scope</label>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#ffffff', border: '1px solid #d9d9d9', padding: '4px 8px', borderRadius: 8, height: 36 }}>
                                    <input 
                                        type="color" 
                                        value={roleFormData.color} 
                                        onChange={e => setRoleFormData({ ...roleFormData, color: e.target.value })} 
                                        style={{ width: 24, height: 24, border: 'none', cursor: 'pointer', padding: 0, background: 'transparent' }} 
                                    />
                                    <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#64748b' }}>{roleFormData.color}</span>
                                </div>
                            </Col>
                            <Col span={24}>
                                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>Strategic Description</label>
                                <TextArea 
                                    rows={2} 
                                    placeholder="Describe the scope of responsibilities assumed by entities of this role profile..."
                                    value={roleFormData.description}
                                    onChange={e => setRoleFormData({ ...roleFormData, description: e.target.value })}
                                    style={{ borderRadius: 8 }}
                                />
                            </Col>
                        </Row>
                    </Card>

                    {/* Row 2: Permissions Selector Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                        <span style={{ fontWeight: 800, fontSize: 13.5, color: '#0f172a' }}>Access Control Boundary Scopes</span>
                        <Divider style={{ flex: 1, margin: 0 }} />
                        <Badge count={`${selectedPermissions.length} Active Rules`} style={{ backgroundColor: '#4f46e5', fontWeight: 750, fontSize: 11 }} />
                    </div>

                    {/* Row 3: Two-Column Grid of Modules */}
                    <Row gutter={[16, 16]}>
                        {Object.entries(permissionsGrouped).map(([cat, perms]) => {
                            const CatIcon = getCategoryIcon(cat);
                            const allSelected = perms.every(p => selectedPermissions.includes(p._id || p.id));
                            const countSel = getCategorySelectionCount(cat);
                            
                            return (
                                <Col key={cat} xs={24} lg={12}>
                                    <div className="perm-picker-panel">
                                        <div className="header">
                                            <Space size={8}>
                                                <div style={{ display: 'flex', background: '#e0e7ff', color: '#4f46e5', padding: 5, borderRadius: 6 }}><CatIcon size={12} /></div>
                                                <span style={{ fontWeight: 800, fontSize: 11.5, textTransform: 'uppercase', color: '#334155' }}>{cat} MODULE</span>
                                            </Space>
                                            <Button 
                                                size="small" 
                                                shape="round"
                                                onClick={() => toggleAllPermissions(cat)}
                                                style={{ fontSize: 10.5, fontWeight: 700 }}
                                                icon={allSelected ? <X size={10} /> : <Check size={10} />}
                                            >
                                                {allSelected ? 'De-Select' : 'All'} ({countSel})
                                            </Button>
                                        </div>
                                        <div style={{ maxHeight: 220, overflowY: 'auto', padding: '8px 0' }}>
                                            {perms.map(p => {
                                                const isSel = selectedPermissions.includes(p._id || p.id);
                                                return (
                                                    <div 
                                                        key={p._id || p.id} 
                                                        className={`perm-item-row ${isSel ? 'selected' : ''}`}
                                                        onClick={() => togglePermission(p._id || p.id)}
                                                    >
                                                        <div 
                                                            style={{ 
                                                                width: 16, height: 16, borderRadius: 4, 
                                                                border: `1.5px solid ${isSel ? '#4f46e5' : '#cbd5e1'}`,
                                                                background: isSel ? '#4f46e5' : 'transparent',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                marginRight: 10, transition: 'all 0.1s'
                                                            }}
                                                        >
                                                            {isSel && <Check size={10} strokeWidth={3} className="text-white" />}
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                            <span style={{ fontSize: 12, fontWeight: 650, color: isSel ? '#312e81' : '#334155' }}>{p.displayName}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </Col>
                            );
                        })}
                    </Row>

                </div>
            </Modal>

        </div>
    );
};

export default RolesPage;
