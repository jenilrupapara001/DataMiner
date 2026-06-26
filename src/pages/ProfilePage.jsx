import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import {
    Card, Input, Button, Row, Col, Typography, Avatar,
    Tag, Divider, Modal, Space, message, notification, Switch, Tooltip
} from 'antd';
import {
    User, Mail, Shield, Calendar, Camera, Edit2,
    Smartphone, Lock, LogOut, Key, CheckCircle2,
    ChevronRight, Activity, X, Eye
} from 'lucide-react';
import { PageLoader } from '@/components/application/loading-indicator/PageLoader';

const { Text } = Typography;

const ProfilePage = () => {
    const { id } = useParams();
    const { user: currentUser, refreshUser, logout: authLogout } = useAuth();

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [saving, setSaving] = useState(false);

    const [pwdData, setPwdData] = useState({ current: '', newPw: '', confirm: '' });
    const [formData, setFormData] = useState({ firstName: '', lastName: '', email: '', phone: '' });

    const [messageApi, msgCtx] = message.useMessage();

    useEffect(() => {
        const fetchUser = async () => {
            try {
                setLoading(true);
                const targetId = id || currentUser?._id;
                if (!targetId) return;
                const response = await api.userApi.getById(targetId);
                if (response.success) {
                    const d = response.data;
                    const u = { ...d, firstName: d.firstName || d.FirstName || '', lastName: d.lastName || d.LastName || '', email: d.email || d.Email || '', phone: d.phone || d.Phone || '' };
                    setUser(u);
                    setFormData({ firstName: u.firstName, lastName: u.lastName, email: u.email, phone: u.phone });
                }
            } catch (e) { console.error(e); } finally { setLoading(false); }
        };
        fetchUser();
    }, [id, currentUser?._id]);

    const handleSave = async () => {
        if (!formData.firstName || !formData.lastName) { messageApi.warning('Name fields are required'); return; }
        try {
            setSaving(true);
            const res = await api.userApi.update(user._id, formData);
            if (res.success) {
                setUser(res.data);
                setIsEditing(false);
                if (currentUser?._id === user._id) refreshUser(res.data);
                messageApi.success('Profile updated');
            }
        } catch (e) { messageApi.error(e.message || 'Failed to update'); }
        finally { setSaving(false); }
    };

    const handlePasswordChange = async () => {
        if (pwdData.newPw !== pwdData.confirm) { messageApi.error('Passwords do not match'); return; }
        try {
            setSaving(true);
            const res = await api.authApi.changePassword(pwdData.current, pwdData.newPw);
            if (res.success) {
                setShowPasswordModal(false);
                setPwdData({ current: '', newPw: '', confirm: '' });
                messageApi.success('Password changed. Please login again.');
                setTimeout(() => authLogout(), 1500);
            } else { messageApi.error(res.message || 'Failed'); }
        } catch (e) { messageApi.error(e.message || 'Failed'); }
        finally { setSaving(false); }
    };

    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

    if (loading && !user) return <PageLoader message="Loading profile..." />;

    const roleDisplay = user?.role?.displayName || user?.role?.name || 'Member';
    const isOwnProfile = currentUser?._id === user?._id || currentUser?.id === user?._id;

    return (
        <div style={{ background: '#fff', minHeight: 'calc(100vh - 60px)' }}>
            {msgCtx}

            {/* Page Header */}
            <div style={{ padding: '20px 28px 16px', borderBottom: '1px solid #f4f4f7' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#18181b', margin: 0 }}>
                            {isOwnProfile ? 'My Profile' : `${user?.firstName || ''} ${user?.lastName || ''}`}
                        </h2>
                        <p style={{ fontSize: 12, color: '#71717a', margin: 0, marginTop: 4 }}>
                            {isOwnProfile ? 'Manage your account settings and security' : `Viewing ${user?.firstName}'s profile`}
                        </p>
                    </div>
                    {isOwnProfile && (
                        <Space size={8}>
                            <Button size="small" icon={<Key size={13} />} onClick={() => setShowPasswordModal(true)}
                                style={{ borderRadius: 8, fontWeight: 600, fontSize: 11, height: 32 }}>Change Password</Button>
                            <Button size="small" danger icon={<LogOut size={13} />} onClick={() => Modal.confirm({
                                title: 'Sign Out', content: 'Are you sure you want to sign out?', okText: 'Sign Out', okType: 'danger', centered: true,
                                onOk: () => authLogout()
                            })} style={{ borderRadius: 8, fontWeight: 600, fontSize: 11, height: 32 }}>Sign Out</Button>
                        </Space>
                    )}
                </div>
            </div>

            <div style={{ padding: '16px 28px' }}>
                <Row gutter={[16, 16]}>
                    {/* Left: Profile Card */}
                    <Col xs={24} lg={8}>
                        <div style={{ border: '1px solid #e4e4e7', borderRadius: 12, padding: '24px 20px', textAlign: 'center' }}>
                            <div style={{ position: 'relative', display: 'inline-block', marginBottom: 12 }}>
                                <Avatar size={80} src={`https://ui-avatars.com/api/?name=${user?.firstName}+${user?.lastName}&background=18181b&color=fff&size=160&bold=true`}
                                    style={{ border: '3px solid #f4f4f5' }} />
                                {isOwnProfile && (
                                    <Tooltip title="Change photo">
                                        <div style={{ position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: '50%', background: '#fff', border: '1px solid #e4e4e7', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                            <Camera size={11} style={{ color: '#71717a' }} />
                                        </div>
                                    </Tooltip>
                                )}
                            </div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: '#18181b', marginBottom: 4 }}>
                                {user?.firstName} {user?.lastName}
                            </div>
                            <Tag style={{ fontSize: 10, borderRadius: 4, padding: '2px 8px', fontWeight: 600, background: '#eff6ff', color: '#0288D1', border: '1px solid #bfdbfe' }}>
                                {roleDisplay}
                            </Tag>

                            <Divider style={{ margin: '16px 0' }} />

                            <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: 9, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase' }}>Joined</div>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: '#18181b', marginTop: 2 }}>{formatDate(user?.createdAt)}</div>
                                </div>
                                <div style={{ width: 1, background: '#f4f4f5' }} />
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: 9, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase' }}>Status</div>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: user?.isActive ? '#2E7D32' : '#C62828', marginTop: 2 }}>
                                        {user?.isActive ? 'Active' : 'Inactive'}
                                    </div>
                                </div>
                            </div>

                            <Divider style={{ margin: '16px 0' }} />

                            {isOwnProfile ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <Button block size="small" icon={isEditing ? <X size={13} /> : <Edit2 size={13} />}
                                        type={isEditing ? 'default' : 'primary'}
                                        onClick={() => setIsEditing(!isEditing)}
                                        style={{ borderRadius: 8, fontWeight: 600, fontSize: 11, height: 30 }}>
                                        {isEditing ? 'Cancel' : 'Edit Profile'}
                                    </Button>
                                    <Button block size="small" icon={<Lock size={13} />}
                                        onClick={() => setShowPasswordModal(true)}
                                        style={{ borderRadius: 8, fontWeight: 600, fontSize: 11, height: 30 }}>
                                        Change Password
                                    </Button>
                                </div>
                            ) : (
                                <div style={{ fontSize: 11, color: '#a1a1aa', textAlign: 'center' }}>
                                    <Eye size={12} style={{ marginRight: 4 }} /> View Only
                                </div>
                            )}
                        </div>
                    </Col>

                    {/* Right: Details */}
                    <Col xs={24} lg={16}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {/* Personal Info */}
                            <div style={{ border: '1px solid #e4e4e7', borderRadius: 12, padding: '16px 20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                                    <div style={{ width: 28, height: 28, borderRadius: 8, background: '#f4f4f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <User size={13} style={{ color: '#71717a' }} />
                                    </div>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: '#18181b' }}>Personal Information</div>
                                    {isEditing && isOwnProfile && (
                                        <Button size="small" type="primary" loading={saving} onClick={handleSave}
                                            style={{ marginLeft: 'auto', borderRadius: 8, fontWeight: 600, fontSize: 11, height: 28 }}>Save</Button>
                                    )}
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 600, color: '#71717a', marginBottom: 4 }}>First Name</div>
                                        {isEditing && isOwnProfile ? (
                                            <Input size="small" value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} style={{ borderRadius: 8 }} />
                                        ) : (
                                            <div style={{ padding: '6px 10px', background: '#f4f4f5', borderRadius: 8, fontSize: 13, color: '#18181b', border: '1px solid #e4e4e7' }}>{user?.firstName || '—'}</div>
                                        )}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 600, color: '#71717a', marginBottom: 4 }}>Last Name</div>
                                        {isEditing && isOwnProfile ? (
                                            <Input size="small" value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })} style={{ borderRadius: 8 }} />
                                        ) : (
                                            <div style={{ padding: '6px 10px', background: '#f4f4f5', borderRadius: 8, fontSize: 13, color: '#18181b', border: '1px solid #e4e4e7' }}>{user?.lastName || '—'}</div>
                                        )}
                                    </div>
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <div style={{ fontSize: 11, fontWeight: 600, color: '#71717a', marginBottom: 4 }}>Email</div>
                                        <div style={{ padding: '6px 10px', background: '#f8fafc', borderRadius: 8, fontSize: 13, color: '#71717a', border: '1px dashed #e4e4e7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <span><Mail size={12} style={{ marginRight: 6 }} />{user?.email || '—'}</span>
                                            <Tag style={{ fontSize: 9, borderRadius: 4, padding: '1px 6px', background: '#ecfdf5', color: '#2E7D32', border: '1px solid #a7f3d0', fontWeight: 600 }}>Verified</Tag>
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 600, color: '#71717a', marginBottom: 4 }}>Phone</div>
                                        {isEditing && isOwnProfile ? (
                                            <Input size="small" prefix={<Smartphone size={11} />} placeholder="+91 000 000 0000" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} style={{ borderRadius: 8 }} />
                                        ) : (
                                            <div style={{ padding: '6px 10px', background: '#f4f4f5', borderRadius: 8, fontSize: 13, color: '#18181b', border: '1px solid #e4e4e7' }}>
                                                <Smartphone size={12} style={{ marginRight: 6, color: '#71717a' }} />{user?.phone || 'Not set'}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 600, color: '#71717a', marginBottom: 4 }}>Role</div>
                                        <div style={{ padding: '6px 10px', background: '#f4f4f5', borderRadius: 8, fontSize: 13, color: '#18181b', border: '1px solid #e4e4e7' }}>
                                            <Shield size={12} style={{ marginRight: 6, color: '#71717a' }} />{roleDisplay}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Security */}
                            <div style={{ border: '1px solid #e4e4e7', borderRadius: 12, padding: '16px 20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                    <div style={{ width: 28, height: 28, borderRadius: 8, background: '#f4f4f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Shield size={13} style={{ color: '#71717a' }} />
                                    </div>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: '#18181b' }}>Security</div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div style={{ padding: '10px 12px', background: user?.isFirstLogin ? '#fef2f2' : '#ecfdf5', borderRadius: 8, border: `1px solid ${user?.isFirstLogin ? '#fecaca' : '#d1fae5'}` }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: user?.isFirstLogin ? '#C62828' : '#2E7D32', textTransform: 'uppercase' }}>Setup Status</div>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: '#18181b', marginTop: 2 }}>{user?.setupCompletedAt ? 'Complete' : 'Pending Setup'}</div>
                                    </div>
                                    <div style={{ padding: '10px 12px', background: '#f4f4f5', borderRadius: 8, border: '1px solid #e4e4e7' }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: '#71717a', textTransform: 'uppercase' }}>Password Changed</div>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: '#18181b', marginTop: 2 }}>{formatDate(user?.passwordChangedAt)}</div>
                                    </div>
                                    <div style={{ padding: '10px 12px', background: '#f4f4f5', borderRadius: 8, border: '1px solid #e4e4e7' }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: '#71717a', textTransform: 'uppercase' }}>Account Created</div>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: '#18181b', marginTop: 2 }}>{formatDate(user?.createdAt)}</div>
                                    </div>
                                    <div style={{ padding: '10px 12px', background: '#f4f4f5', borderRadius: 8, border: '1px solid #e4e4e7' }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: '#71717a', textTransform: 'uppercase' }}>Last Seen</div>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: '#18181b', marginTop: 2 }}>{user?.lastSeen ? formatDate(user.lastSeen) : 'Now'}</div>
                                    </div>
                                </div>
                                <div style={{ marginTop: 12, padding: '10px 12px', background: '#f4f4f5', borderRadius: 8, border: '1px solid #e4e4e7' }}>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', marginBottom: 4 }}>Role Permissions</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                        {(user?.role?.permissions || []).slice(0, 8).map(p => (
                                            <Tag key={p._id || p.id || p} style={{ fontSize: 9, borderRadius: 4, padding: '1px 6px', margin: 0, background: '#eff6ff', color: '#0288D1', border: '1px solid #bfdbfe', fontWeight: 600 }}>
                                                {p.displayName || p.name || p}
                                            </Tag>
                                        ))}
                                        {(user?.role?.permissions || []).length > 8 && (
                                            <Tag style={{ fontSize: 9, borderRadius: 4, padding: '1px 6px', margin: 0, background: '#f4f4f5', color: '#71717a', border: '1px solid #e4e4e7', fontWeight: 600 }}>
                                                +{(user?.role?.permissions || []).length - 8} more
                                            </Tag>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Col>
                </Row>
            </div>

            {/* Password Modal */}
            <Modal open={showPasswordModal} onCancel={() => { setShowPasswordModal(false); setPwdData({ current: '', newPw: '', confirm: '' }); }}
                title={<span style={{ fontSize: 14, fontWeight: 700, color: '#18181b' }}>Change Password</span>}
                centered width={420}
                footer={[
                    <Button key="cancel" onClick={() => setShowPasswordModal(false)} style={{ borderRadius: 8, fontSize: 11 }}>Cancel</Button>,
                    <Button key="save" type="primary" loading={saving} disabled={!pwdData.current || !pwdData.newPw || pwdData.newPw !== pwdData.confirm}
                        onClick={handlePasswordChange} style={{ borderRadius: 8, fontWeight: 600, fontSize: 11 }}>Change Password</Button>
                ]}
                styles={{ body: { padding: '16px 20px' } }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Current Password *</div>
                        <Input.Password size="small" value={pwdData.current} onChange={e => setPwdData({ ...pwdData, current: e.target.value })} placeholder="Enter current password" style={{ borderRadius: 8 }} />
                    </div>
                    <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>New Password *</div>
                        <Input.Password size="small" value={pwdData.newPw} onChange={e => setPwdData({ ...pwdData, newPw: e.target.value })} placeholder="Enter new password" style={{ borderRadius: 8 }} />
                    </div>
                    <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Confirm Password *</div>
                        <Input.Password size="small" value={pwdData.confirm} onChange={e => setPwdData({ ...pwdData, confirm: e.target.value })} placeholder="Confirm new password" style={{ borderRadius: 8 }}
                            status={pwdData.confirm && pwdData.newPw !== pwdData.confirm ? 'error' : ''} />
                        {pwdData.confirm && pwdData.newPw !== pwdData.confirm && (
                            <div style={{ fontSize: 10, color: '#C62828', marginTop: 2 }}>Passwords do not match</div>
                        )}
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default ProfilePage;
