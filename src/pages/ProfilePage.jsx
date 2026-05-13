import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { 
    Card, 
    Input, 
    Button, 
    Row, 
    Col, 
    Typography, 
    Avatar, 
    Badge, 
    Tag, 
    Divider, 
    Modal, 
    Timeline, 
    Tooltip, 
    Space, 
    message, 
    notification,
    Descriptions
} from 'antd';
import {
    User, Mail, Shield, Calendar, Camera, Edit2, Loader2,
    Smartphone, Briefcase, Clock, LogOut, Key, CheckCircle2,
    XCircle, Info, ChevronRight, ArrowRight, ShieldCheck,
    Fingerprint, Settings, Bell, Lock, Activity, AlertCircle, X,
    ShieldAlert
} from 'lucide-react';
import { PageLoader } from '@/components/application/loading-indicator/PageLoader';

const { Title, Text, Paragraph } = Typography;

const ProfilePage = () => {
    const { id } = useParams();
    const { user: currentUser, refreshUser, logout: authLogout } = useAuth();
    
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [saving, setSaving] = useState(false);
    
    const [pwdData, setPwdData] = useState({ current: '', new: '', confirm: '' });
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: ''
    });

    const [messageApi, messageContextHolder] = message.useMessage();
    const [notificationApi, notificationContextHolder] = notification.useNotification();

    useEffect(() => {
        const fetchUser = async () => {
            try {
                setLoading(true);
                const targetId = id || currentUser?._id;

                if (!targetId) {
                    setError('User identifier could not be parsed.');
                    return;
                }

                const response = await api.userApi.getById(targetId);
                if (response.success) {
                    const userData = response.data;
                    const normalizedUser = {
                        ...userData,
                        firstName: userData.firstName || userData.FirstName || '',
                        lastName: userData.lastName || userData.LastName || '',
                        email: userData.email || userData.Email || '',
                        phone: userData.phone || userData.Phone || ''
                    };
                    setUser(normalizedUser);
                    setFormData({
                        firstName: normalizedUser.firstName,
                        lastName: normalizedUser.lastName,
                        email: normalizedUser.email,
                        phone: normalizedUser.phone
                    });
                } else {
                    setError('Critical: User dataset not located on active cluster.');
                }
            } catch (err) {
                console.error('Error fetching profile:', err);
                setError(err.message || 'Network cluster retrieval failed.');
            } finally {
                setLoading(false);
            }
        };

        fetchUser();
    }, [id, currentUser?._id]);

    const handleSave = async () => {
        if (!formData.firstName || !formData.lastName) {
            messageApi.warning('Profile metadata cannot be empty.');
            return;
        }
        try {
            setSaving(true);
            const response = await api.userApi.update(user._id, formData);
            if (response.success) {
                const updatedUser = response.data;
                setUser(updatedUser);
                setIsEditing(false);
                if (currentUser?._id === user._id) {
                    refreshUser(updatedUser);
                }
                notificationApi.success({
                    message: 'Identity Synced',
                    description: 'Standard profile attributes updated across core databases.',
                    placement: 'topRight'
                });
            }
        } catch (err) {
            notificationApi.error({
                message: 'Sync Rejected',
                description: err.message || 'Data rejected during pipeline transmission.',
                placement: 'topRight'
            });
        } finally {
            setSaving(false);
        }
    };

    const handlePasswordChange = async () => {
        if (pwdData.new !== pwdData.confirm) {
            messageApi.error('Rotation error: Confirm credentials match rejected.');
            return;
        }
        try {
            setSaving(true);
            const response = await api.authApi.changePassword(pwdData.current, pwdData.new);
            if (response.success) {
                setShowPasswordModal(false);
                setPwdData({ current: '', new: '', confirm: '' });
                notificationApi.success({
                    message: 'Security Keys Rotated',
                    description: 'Your cryptographic login sequence is now active. Previous keys invalidated.',
                    placement: 'topRight'
                });
            } else {
                throw new Error(response.message || 'Access control verification failed.');
            }
        } catch (err) {
            notificationApi.error({
                message: 'Key Rotation Failed',
                description: err.message || 'Core systems rejected rotation payload.',
                placement: 'topRight'
            });
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = () => {
        Modal.confirm({
            title: 'Sign Out Confirmation',
            content: 'Are you sure you want to terminate the active operational session?',
            okText: 'Sign Out',
            okType: 'danger',
            cancelText: 'Cancel',
            centered: true,
            onOk: () => {
                authLogout();
            }
        });
    };

    const formatDate = (dateString) => {
        if (!dateString) return '—';
        return new Date(dateString).toLocaleDateString('en-US', {
            day: 'numeric', month: 'short', year: 'numeric'
        });
    };

    if (loading && !user) return <PageLoader message="Initializing Identity Vault..." />;

    const roleDisplay = user?.role?.displayName || user?.role?.name || 'Operator Member';
    const lastLogin = user?.lastLogin ? formatDate(user.lastLogin) : 'Online Now';

    return (
        <div className="luxury-profile-wrapper">
            {messageContextHolder}
            {notificationContextHolder}

            <style>{`
                .luxury-profile-wrapper {
                    min-height: 100vh;
                    background-color: #f8fafc;
                    margin: -1.5rem -2rem;
                    padding: 32px;
                    position: relative;
                    overflow: hidden;
                }
                .luxury-profile-bg-flare {
                    position: absolute;
                    top: -200px;
                    right: -200px;
                    width: 600px;
                    height: 600px;
                    background: radial-gradient(circle, rgba(37, 99, 235, 0.05) 0%, rgba(255,255,255,0) 70%);
                    z-index: 0;
                    pointer-events: none;
                }
                .profile-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 32px;
                    position: relative;
                    z-index: 1;
                }
                .profile-grid {
                    position: relative;
                    z-index: 1;
                }
                .profile-master-card {
                    border-radius: 20px !important;
                    border: 1px solid #e2e8f0 !important;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.02) !important;
                    overflow: hidden;
                }
                .avatar-ring-base {
                    position: relative;
                    display: inline-block;
                    padding: 8px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #eff6ff 0%, #e0f2fe 100%);
                    margin-bottom: 16px;
                }
                .avatar-edit-overlay {
                    position: absolute;
                    bottom: 10px;
                    right: 10px;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
                    transition: all 0.2s ease;
                    color: #64748b;
                }
                .avatar-edit-overlay:hover {
                    background: #1e293b;
                    color: #ffffff;
                    transform: translateY(-1px);
                }
                .form-block-label {
                    font-size: 12px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.03em;
                    color: #94a3b8;
                    margin-bottom: 6px;
                    display: block;
                }
                .read-only-pane {
                    background: #f1f5f9;
                    padding: 14px 16px;
                    border-radius: 10px;
                    font-weight: 600;
                    color: #1e293b;
                    font-size: 14.5px;
                    border: 1px solid #e2e8f0;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .read-only-pane-email {
                    background: #ffffff;
                    border-style: dashed;
                }
                .security-banner {
                    border-radius: 14px;
                    padding: 16px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                }
                .security-banner.active {
                    background: #f0fdf4;
                    border: 1px solid #dcfce7;
                    color: #15803d;
                }
                .security-banner.inactive {
                    background: #fef2f2;
                    border: 1px solid #fee2e2;
                    color: #b91c1c;
                }
            `}</style>

            <div className="luxury-profile-bg-flare" />

            {/* 1. HEADER NAVIGATION */}
            <div className="profile-header">
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <Tag color="blue" style={{ textTransform: 'uppercase', borderRadius: 6, fontWeight: 700 }}>ACTIVE SESSION</Tag>
                    </div>
                    <Title level={3} style={{ margin: 0, fontWeight: 850, letterSpacing: '-0.03em' }}>My Digital Identity</Title>
                    <Text type="secondary" style={{ fontSize: 13.5 }}>Analyze personal infrastructure allocation and cryptographic keys.</Text>
                </div>
                <Button 
                    danger 
                    icon={<LogOut size={15} />} 
                    onClick={handleLogout}
                    style={{ borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
                >
                    Sign Out
                </Button>
            </div>

            {/* 2. RESPONSIVE GRID */}
            <Row gutter={[24, 24]} className="profile-grid">
                
                {/* Left Profile Dashboard Card */}
                <Col xs={24} lg={8}>
                    <Card className="profile-master-card" style={{ textAlign: 'center', padding: '24px 0 12px' }}>
                        <div className="avatar-ring-base">
                            <Avatar 
                                size={120} 
                                src={`https://ui-avatars.com/api/?name=${user?.firstName}+${user?.lastName}&background=1e293b&color=fff&size=240&bold=true`}
                                style={{ border: '4px solid #ffffff', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}
                            />
                            <div className="avatar-edit-overlay">
                                <Camera size={14} />
                            </div>
                        </div>

                        <div style={{ marginBottom: 12 }}>
                            <Title level={4} style={{ margin: 0, fontWeight: 800 }}>{user?.firstName} {user?.lastName}</Title>
                            <div style={{ marginTop: 6 }}>
                                <Tag color="processing" style={{ borderRadius: 20, padding: '2px 12px', fontWeight: 700, border: 'none' }}>
                                    {roleDisplay.toUpperCase()}
                                </Tag>
                            </div>
                        </div>

                        <Divider style={{ margin: '20px 0' }} />

                        <div style={{ display: 'flex', justifyContent: 'space-around', padding: '0 16px' }}>
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Enlisted</div>
                                <div style={{ fontWeight: 700, fontSize: 13.5, color: '#334155', marginTop: 2 }}>{formatDate(user?.createdAt)}</div>
                            </div>
                            <div style={{ width: 1, backgroundColor: '#f1f5f9' }} />
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Presence</div>
                                <div style={{ fontWeight: 700, fontSize: 13.5, color: '#334155', marginTop: 2 }}>{lastLogin}</div>
                            </div>
                        </div>

                        <Divider style={{ margin: '20px 0' }} />

                        <div style={{ padding: '0 24px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <Button 
                                type={isEditing ? "dashed" : "primary"} 
                                danger={isEditing}
                                block
                                size="large"
                                icon={isEditing ? <X size={16} /> : <Edit2 size={15} />}
                                onClick={() => setIsEditing(!isEditing)}
                                style={{ borderRadius: 10, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                            >
                                {isEditing ? 'Discard Edits' : 'Modify Identity Parameters'}
                            </Button>
                            <Button 
                                block 
                                size="large"
                                icon={<Lock size={15} />} 
                                onClick={() => setShowPasswordModal(true)}
                                style={{ borderRadius: 10, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                            >
                                Rotate Passkeys
                            </Button>
                        </div>
                    </Card>
                </Col>

                {/* Right Configuration and Log Panes */}
                <Col xs={24} lg={16}>
                    <Space direction="vertical" size={24} style={{ width: '100%' }}>
                        
                        {/* Central Attribute Vault */}
                        <Card 
                            className="profile-master-card"
                            title={
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, fontSize: 15, color: '#1e293b' }}>
                                    <User size={18} style={{ color: '#3b82f6' }} />
                                    <span>Personal Attribute Vault</span>
                                </div>
                            }
                            extra={isEditing && (
                                <Button 
                                    type="primary" 
                                    loading={saving} 
                                    onClick={handleSave} 
                                    icon={<CheckCircle2 size={15} />}
                                    style={{ borderRadius: 6, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
                                >
                                    Sync Changes
                                </Button>
                            )}
                        >
                            <Row gutter={[20, 20]}>
                                <Col xs={24} md={12}>
                                    <span className="form-block-label">Legal First Name</span>
                                    {isEditing ? (
                                        <Input 
                                            size="large"
                                            value={formData.firstName} 
                                            onChange={e => setFormData({...formData, firstName: e.target.value})}
                                            style={{ borderRadius: 10 }}
                                        />
                                    ) : (
                                        <div className="read-only-pane">{user?.firstName || '—'}</div>
                                    )}
                                </Col>
                                <Col xs={24} md={12}>
                                    <span className="form-block-label">Legal Last Name</span>
                                    {isEditing ? (
                                        <Input 
                                            size="large"
                                            value={formData.lastName} 
                                            onChange={e => setFormData({...formData, lastName: e.target.value})}
                                            style={{ borderRadius: 10 }}
                                        />
                                    ) : (
                                        <div className="read-only-pane">{user?.lastName || '—'}</div>
                                    )}
                                </Col>
                                <Col span={24}>
                                    <span className="form-block-label">Registered Node Mailbox</span>
                                    <div className="read-only-pane read-only-pane-email" style={{ justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <Mail size={15} style={{ color: '#94a3b8' }} />
                                            <span style={{ color: '#64748b' }}>{user?.email || '—'}</span>
                                        </div>
                                        <Tag color="success" icon={<Fingerprint size={11} style={{ marginBottom: -2, marginRight: 2 }} />} style={{ margin: 0, borderRadius: 6, fontWeight: 650 }}>VERIFIED</Tag>
                                    </div>
                                </Col>
                                <Col xs={24} md={12}>
                                    <span className="form-block-label">Mobile Relay Connection</span>
                                    {isEditing ? (
                                        <Input 
                                            size="large"
                                            placeholder="+1 000 000 0000"
                                            prefix={<Smartphone size={14} style={{ color: '#94a3b8', marginRight: 6 }} />}
                                            value={formData.phone} 
                                            onChange={e => setFormData({...formData, phone: e.target.value})}
                                            style={{ borderRadius: 10 }}
                                        />
                                    ) : (
                                        <div className="read-only-pane">
                                            <Smartphone size={15} style={{ color: '#94a3b8' }} />
                                            <span>{user?.phone || 'Unlinked'}</span>
                                        </div>
                                    )}
                                </Col>
                                <Col xs={24} md={12}>
                                    <span className="form-block-label">System Clearance Scope</span>
                                    <div className="read-only-pane" style={{ background: '#eff6ff', border: '1px solid #dbeafe', color: '#2563eb' }}>
                                        <Shield size={15} />
                                        <span style={{ textTransform: 'uppercase', fontSize: 13, letterSpacing: 0.5 }}>{roleDisplay}</span>
                                    </div>
                                </Col>
                            </Row>
                        </Card>

                        <Row gutter={[24, 24]}>
                            {/* Security Metrics Panel */}
                            <Col xs={24} md={12}>
                                <Card 
                                    className="profile-master-card"
                                    title={
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 800, color: '#334155' }}>
                                            <ShieldCheck size={16} style={{ color: '#10b981' }} />
                                            <span>Multi-Factor Shield</span>
                                        </div>
                                    }
                                >
                                    <div className={`security-banner ${user?.twoFactorEnabled ? 'active' : 'inactive'}`}>
                                        <div>
                                            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>{user?.twoFactorEnabled ? 'Shield Synced' : 'Shield Disabled'}</div>
                                            <div style={{ fontSize: 12.5, marginTop: 2, opacity: 0.9 }}>{user?.twoFactorEnabled ? 'Encrypted Session Enforced' : 'Vulnerable To Infiltration'}</div>
                                        </div>
                                        {user?.twoFactorEnabled ? <ShieldCheck size={24} /> : <ShieldAlert size={24} />}
                                    </div>

                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#64748b', fontSize: 12.5 }}>
                                        <Info size={14} />
                                        <span>Last security sweep: Today, automatic.</span>
                                    </div>
                                </Card>
                            </Col>

                            {/* Activity Stream Card */}
                            <Col xs={24} md={12}>
                                <Card 
                                    className="profile-master-card"
                                    title={
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 800, color: '#334155' }}>
                                            <Activity size={16} style={{ color: '#f59e0b' }} />
                                            <span>Deployment Stream</span>
                                        </div>
                                    }
                                >
                                    <Timeline 
                                        mode="left"
                                        style={{ marginTop: 8, marginBottom: -12 }}
                                        items={[
                                            {
                                                color: 'blue',
                                                children: (
                                                    <div>
                                                        <div style={{ fontWeight: 700, fontSize: 12.5, color: '#1e293b' }}>Session Established</div>
                                                        <div style={{ fontSize: 11, color: '#64748b' }}>Today, 2:45 PM (Chrome / Mac)</div>
                                                    </div>
                                                ),
                                            },
                                            {
                                                color: 'gray',
                                                children: (
                                                    <div>
                                                        <div style={{ fontWeight: 600, fontSize: 12.5, color: '#64748b' }}>Pipeline Context Refreshed</div>
                                                        <div style={{ fontSize: 11, color: '#94a3b8' }}>Yesterday, 11:20 AM</div>
                                                    </div>
                                                ),
                                            },
                                        ]}
                                    />
                                </Card>
                            </Col>
                        </Row>
                    </Space>
                </Col>
            </Row>

            {/* DYNAMIC KEY ROTATION MODAL */}
            <Modal
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, color: '#0f172a' }}>
                        <Key size={18} style={{ color: '#4f46e5' }} />
                        <span>Access Key Rotation</span>
                    </div>
                }
                open={showPasswordModal}
                onCancel={() => {
                    setShowPasswordModal(false);
                    setPwdData({ current: '', new: '', confirm: '' });
                }}
                footer={[
                    <Button 
                        key="cancel" 
                        onClick={() => setShowPasswordModal(false)}
                        style={{ borderRadius: 6 }}
                    >
                        Abort Rotation
                    </Button>,
                    <Button 
                        key="confirm" 
                        type="primary" 
                        loading={saving}
                        disabled={!pwdData.current || !pwdData.new || (pwdData.new !== pwdData.confirm)}
                        onClick={handlePasswordChange}
                        style={{ borderRadius: 6, fontWeight: 600 }}
                    >
                        Commit New Keys
                    </Button>
                ]}
                centered
                width={450}
            >
                <div style={{ padding: '12px 0' }}>
                    <Paragraph type="secondary" style={{ fontSize: 12.5, marginBottom: 20 }}>
                        Cycle your administrative passkeys. Ensure the confirmation vector matches to commit encryption nodes.
                    </Paragraph>

                    <Space direction="vertical" size={16} style={{ width: '100%' }}>
                        <div>
                            <span className="form-block-label">Current Vector Token</span>
                            <Input.Password 
                                size="large"
                                placeholder="••••••••"
                                value={pwdData.current}
                                onChange={e => setPwdData({...pwdData, current: e.target.value})}
                                style={{ borderRadius: 8 }}
                                prefix={<Lock size={14} style={{ color: '#94a3b8', marginRight: 6 }} />}
                            />
                        </div>
                        <Divider style={{ margin: '4px 0' }} />
                        <div>
                            <span className="form-block-label">Target Rotation Passkey</span>
                            <Input.Password 
                                size="large"
                                placeholder="••••••••"
                                value={pwdData.new}
                                onChange={e => setPwdData({...pwdData, new: e.target.value})}
                                style={{ borderRadius: 8 }}
                                prefix={<Key size={14} style={{ color: '#94a3b8', marginRight: 6 }} />}
                            />
                        </div>
                        <div>
                            <span className="form-block-label">Confirm Verification Payload</span>
                            <Input.Password 
                                size="large"
                                placeholder="••••••••"
                                value={pwdData.confirm}
                                onChange={e => setPwdData({...pwdData, confirm: e.target.value})}
                                style={{ borderRadius: 8 }}
                                status={pwdData.confirm && pwdData.new !== pwdData.confirm ? "error" : ""}
                                prefix={<ShieldCheck size={14} style={{ color: '#94a3b8', marginRight: 6 }} />}
                            />
                        </div>
                    </Space>
                </div>
            </Modal>

        </div>
    );
};

export default ProfilePage;