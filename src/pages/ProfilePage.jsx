import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import {
    User, Mail, Shield, Calendar, Camera, Edit2, Loader2,
    Smartphone, Briefcase, Clock, LogOut, Key, CheckCircle2,
    XCircle, Info, ChevronRight, ArrowRight, ShieldCheck,
    Fingerprint, Settings, Bell, Lock, Activity, AlertCircle, X
} from 'lucide-react';
import { PageLoader } from '@/components/application/loading-indicator/PageLoader';
import { LoadingIndicator } from '@/components/application/loading-indicator/loading-indicator';

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

    useEffect(() => {
        const fetchUser = async () => {
            try {
                setLoading(true);
                const targetId = id || currentUser?._id;

                if (!targetId) {
                    setError('User not found');
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
                    setError('Failed to fetch user data');
                }
            } catch (err) {
                console.error('Error fetching profile:', err);
                setError(err.message || 'Error loading profile');
            } finally {
                setLoading(false);
            }
        };

        fetchUser();
    }, [id, currentUser?._id]);

    const handleSave = async () => {
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
                // Custom success notification would be better than alert
            }
        } catch (err) {
            console.error('Error updating profile:', err);
        } finally {
            setSaving(false);
        }
    };

    const handlePasswordChange = async () => {
        if (pwdData.new !== pwdData.confirm) return;
        try {
            setSaving(true);
            const response = await api.authApi.changePassword(pwdData.current, pwdData.new);
            if (response.success) {
                setShowPasswordModal(false);
                setPwdData({ current: '', new: '', confirm: '' });
            }
        } catch (err) {
            console.error('Error changing password:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = () => {
        if (window.confirm('Are you sure you want to log out?')) {
            authLogout();
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '—';
        return new Date(dateString).toLocaleDateString('en-US', {
            day: 'numeric', month: 'short', year: 'numeric'
        });
    };

    if (loading && !user) return <PageLoader message="Initializing Experience..." />;

    const roleDisplay = user?.role?.displayName || user?.role?.name || 'User Member';
    const lastLogin = user?.lastLogin ? formatDate(user.lastLogin) : 'Just now';

    return (
        <div className="profile-luxury-container pb-5">
            <div className="dynamic-mesh-bg"></div>

            <div className="container-fluid py-5 px-lg-5 position-relative">
                {/* Upper Navigation/Breadcrumb */}
                <div className="d-flex justify-content-between align-items-center mb-5 px-3">
                    <div>
                        <h4 className="fw-black mb-0 tracking-tight text-zinc-900">MY IDENTITY</h4>
                        <p className="text-zinc-500 smallest fw-medium opacity-75">MANAGE PERSONAL ECOSYSTEM & ACCESS</p>
                    </div>
                    <div>
                        <button
                            className="btn-logout-luxury d-flex align-items-center gap-2"
                            onClick={handleLogout}
                        >
                            <LogOut size={16} />
                            <span>SIGN OUT</span>
                        </button>
                    </div>
                </div>

                <div className="row g-5">
                    {/* LEFT PANEL: Identity Hub */}
                    <div className="col-xl-4">
                        <div className="luxury-glass-card identity-card sticky-top" style={{ top: '100px' }}>
                            <div className="card-header-aura"></div>
                            <div className="p-5 text-center">
                                <div className="avatar-composition mb-4 mx-auto">
                                    <div className="avatar-ring-outer"></div>
                                    <div className="avatar-ring-inner"></div>
                                    <div className="avatar-image-container shadow-2xl">
                                        <img
                                            src={`https://ui-avatars.com/api/?name=${user?.firstName}+${user?.lastName}&background=18181b&color=fff&size=200&bold=true`}
                                            alt="Profile"
                                        />
                                        <div className="avatar-badge">
                                            <ShieldCheck size={14} className="text-white" />
                                        </div>
                                    </div>
                                    <button className="avatar-upload-btn shadow-sm">
                                        <Camera size={16} />
                                    </button>
                                </div>

                                <div className="mb-4">
                                    <h2 className="fw-black text-zinc-900 mb-1">{user?.firstName} {user?.lastName}</h2>
                                    <div className="d-flex align-items-center justify-content-center gap-2">
                                        <div className="role-tag d-flex align-items-center gap-2">
                                            <div className="pulse-dot"></div>
                                            <span>{roleDisplay}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="identity-stats d-flex justify-content-center gap-4 py-4 border-y border-zinc-100/50">
                                    <div className="stat-item">
                                        <div className="stat-label">Member Since</div>
                                        <div className="stat-value">{formatDate(user?.createdAt).split(',')[0]}</div>
                                    </div>
                                    <div className="stat-item border-start border-zinc-100 ps-4">
                                        <div className="stat-label">Last Active</div>
                                        <div className="stat-value">{lastLogin}</div>
                                    </div>
                                </div>

                                <div className="mt-5 d-grid gap-3">
                                    <button
                                        className={`btn-luxury-action ${isEditing ? 'active' : ''}`}
                                        onClick={() => setIsEditing(!isEditing)}
                                    >
                                        <Edit2 size={18} />
                                        <span>{isEditing ? 'Discard Changes' : 'Refine Identity'}</span>
                                    </button>
                                    <button
                                        className="btn-luxury-outline"
                                        onClick={() => setShowPasswordModal(true)}
                                    >
                                        <Lock size={18} />
                                        <span>Security Keys</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT PANEL: Data Core */}
                    <div className="col-xl-8">
                        <div className="d-flex flex-column gap-5">
                            {/* Personal Nexus Card */}
                            <div className="luxury-glass-card overflow-hidden">
                                <div className="px-5 py-4 border-bottom border-zinc-100/50 d-flex justify-content-between align-items-center bg-white/20">
                                    <div className="d-flex align-items-center gap-3">
                                        <div className="icon-box-luxury">
                                            <User size={20} className="text-zinc-600" />
                                        </div>
                                        <h5 className="fw-black mb-0 text-zinc-900">Personal Nexus</h5>
                                    </div>
                                    {isEditing && (
                                        <button
                                            className="btn btn-dark rounded-pill px-5 py-2 fw-bold shadow-lg hover-up transition-all"
                                            onClick={handleSave}
                                            disabled={saving}
                                        >
                                            {saving ? <Loader2 size={18} className="animate-spin" /> : 'Sync Profile'}
                                        </button>
                                    )}
                                </div>
                                <div className="p-5">
                                    <div className="row g-4">
                                        <div className="col-md-6">
                                            <div className="data-tile-luxury">
                                                <label>First Name</label>
                                                {isEditing ? (
                                                    <input
                                                        type="text"
                                                        value={formData.firstName}
                                                        onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                                                    />
                                                ) : (
                                                    <div className="value-display">{user?.firstName || '—'}</div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="col-md-6">
                                            <div className="data-tile-luxury">
                                                <label>Last Name</label>
                                                {isEditing ? (
                                                    <input
                                                        type="text"
                                                        value={formData.lastName}
                                                        onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                                                    />
                                                ) : (
                                                    <div className="value-display">{user?.lastName || '—'}</div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="col-12">
                                            <div className="data-tile-luxury email-tile">
                                                <label>Restricted Email Address</label>
                                                <div className="d-flex align-items-center justify-content-between">
                                                    <div className="value-display text-zinc-400">
                                                        <Mail size={16} className="me-2 opacity-50" />
                                                        {user?.email || '—'}
                                                    </div>
                                                    <div className="security-tag">
                                                        <Fingerprint size={12} className="me-1" /> Verified
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="col-md-6">
                                            <div className="data-tile-luxury">
                                                <label>Mobile Comms</label>
                                                {isEditing ? (
                                                    <input
                                                        type="tel"
                                                        value={formData.phone}
                                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                                        placeholder="+1 000 000 0000"
                                                    />
                                                ) : (
                                                    <div className="value-display">
                                                        <Smartphone size={16} className="me-2 opacity-30" />
                                                        {user?.phone || 'Unlinked'}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="col-md-6">
                                            <div className="data-tile-luxury">
                                                <label>Role Clearance</label>
                                                <div className="value-display text-primary fw-black uppercase tracking-wider small">
                                                    {roleDisplay}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Security & Activity Stats */}
                            <div className="row g-4">
                                <div className="col-md-6">
                                    <div className="luxury-glass-card h-100 overflow-hidden">
                                        <div className="p-4 border-bottom border-zinc-100/50 bg-white/20 d-flex align-items-center gap-3">
                                            <div className="icon-box-luxury sm">
                                                <Lock size={16} className="text-zinc-600" />
                                            </div>
                                            <h6 className="fw-black mb-0 text-zinc-900 small uppercase tracking-widest">Multi-Factor Intel</h6>
                                        </div>
                                        <div className="p-4">
                                            <div className={`mfa-status-banner ${user?.twoFactorEnabled ? 'secure' : 'warning'} mb-4`}>
                                                <div className="d-flex justify-content-between align-items-center">
                                                    <div>
                                                        <div className="status-title">{user?.twoFactorEnabled ? 'SHIELD ACTIVE' : 'SHIELD DISABLED'}</div>
                                                        <div className="status-desc">
                                                            {user?.twoFactorEnabled ? 'Enforced system-wide' : 'Account is vulnerable'}
                                                        </div>
                                                    </div>
                                                    <div className="status-icon">
                                                        {user?.twoFactorEnabled ? <ShieldCheck size={24} /> : <AlertCircle size={24} />}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="small-info d-flex align-items-center gap-2 text-zinc-500">
                                                <Info size={14} />
                                                <span className="smallest fw-medium">Last pass rotation: 4 months ago</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-md-6">
                                    <div className="luxury-glass-card h-100 overflow-hidden">
                                        <div className="p-4 border-bottom border-zinc-100/50 bg-white/20 d-flex align-items-center gap-3">
                                            <div className="icon-box-luxury sm">
                                                <Activity size={16} className="text-zinc-600" />
                                            </div>
                                            <h6 className="fw-black mb-0 text-zinc-900 small uppercase tracking-widest">Recent Activity</h6>
                                        </div>
                                        <div className="p-4 d-flex flex-column gap-3">
                                            <div className="activity-item d-flex align-items-center gap-3">
                                                <div className="activity-dot"></div>
                                                <div className="flex-grow-1">
                                                    <div className="activity-text text-zinc-700 smallest fw-bold">Login from Chrome on MacOS</div>
                                                    <div className="activity-time text-zinc-400 smallest uppercase">Today, 2:45 PM</div>
                                                </div>
                                            </div>
                                            <div className="activity-item d-flex align-items-center gap-3 opacity-50">
                                                <div className="activity-dot"></div>
                                                <div className="flex-grow-1">
                                                    <div className="activity-text text-zinc-700 smallest fw-bold">Profile Update Sync</div>
                                                    <div className="activity-time text-zinc-400 smallest uppercase">Yesterday, 11:20 AM</div>
                                                </div>
                                            </div>
                                            <button className="btn-view-all text-primary small fw-black tracking-widest mt-2">
                                                VIEW AUDIT LOG <ArrowRight size={12} className="ms-1" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Premium Password Modal */}
            {showPasswordModal && (
                <div className="modal-luxury-overlay">
                    <div className="luxury-glass-card modal-container animate-slide-up shadow-2xl">
                        <div className="modal-inner p-5">
                            <div className="d-flex justify-content-between align-items-center mb-5">
                                <div>
                                    <h4 className="fw-black text-zinc-900 mb-1">Key Management</h4>
                                    <p className="text-zinc-500 small mb-0">Rotate your access credentials regularly</p>
                                </div>
                                <button className="btn-close-luxury" onClick={() => setShowPasswordModal(false)}>
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="d-flex flex-column gap-4 mb-5">
                                <div className="data-tile-luxury">
                                    <label>Current Credentials</label>
                                    <input
                                        type="password"
                                        value={pwdData.current}
                                        onChange={e => setPwdData({ ...pwdData, current: e.target.value })}
                                        placeholder="••••••••••••"
                                    />
                                </div>
                                <div className="row g-4">
                                    <div className="col-md-6">
                                        <div className="data-tile-luxury">
                                            <label>New Passkey</label>
                                            <input
                                                type="password"
                                                value={pwdData.new}
                                                onChange={e => setPwdData({ ...pwdData, new: e.target.value })}
                                                placeholder="••••••••••••"
                                            />
                                        </div>
                                    </div>
                                    <div className="col-md-6">
                                        <div className="data-tile-luxury">
                                            <label>Verify Rotation</label>
                                            <input
                                                type="password"
                                                value={pwdData.confirm}
                                                onChange={e => setPwdData({ ...pwdData, confirm: e.target.value })}
                                                placeholder="••••••••••••"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="d-flex gap-3">
                                <button
                                    className="btn btn-zinc-100 rounded-pill px-5 py-3 fw-bold flex-grow-1"
                                    onClick={() => setShowPasswordModal(false)}
                                >
                                    Cancel Rotation
                                </button>
                                <button
                                    className="btn btn-primary rounded-pill px-5 py-3 fw-black flex-grow-1 shadow-lg hover-up"
                                    onClick={handlePasswordChange}
                                    disabled={saving || !pwdData.current || !pwdData.new || (pwdData.new !== pwdData.confirm)}
                                >
                                    {saving ? <Loader2 className="animate-spin" /> : 'Confirm New Keys'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .profile-luxury-container {
                    min-height: 100vh;
                    background-color: #fafafa;
                    font-family: 'Inter', sans-serif;
                }

                .dynamic-mesh-bg {
                    position: fixed;
                    top: 0;
                    right: 0;
                    width: 70%;
                    height: 100%;
                    background: radial-gradient(circle at 100% 0%, rgba(79, 70, 229, 0.08) 0%, rgba(124, 58, 237, 0.05) 30%, transparent 60%);
                    z-index: 0;
                    pointer-events: none;
                }

                .tracking-tight { letter-spacing: -0.04em; }

                /* Glass Card System */
                .luxury-glass-card {
                    background: rgba(255, 255, 255, 0.7);
                    backdrop-filter: blur(12px) saturate(180%);
                    -webkit-backdrop-filter: blur(12px) saturate(180%);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    border-radius: 32px;
                    box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.05);
                    position: relative;
                }

                .card-header-aura {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 4px;
                    background: linear-gradient(90deg, #4f46e5, #7c3aed);
                    border-radius: 32px 32px 0 0;
                    opacity: 0.1;
                }

                /* Avatar Composition */
                .avatar-composition {
                    width: 140px;
                    height: 140px;
                    position: relative;
                }

                .avatar-ring-outer {
                    position: absolute;
                    top: -10px;
                    left: -10px;
                    right: -10px;
                    bottom: -10px;
                    border: 1px solid rgba(79, 70, 229, 0.1);
                    border-radius: 50%;
                }

                .avatar-ring-inner {
                    position: absolute;
                    top: -5px;
                    left: -5px;
                    right: -5px;
                    bottom: -5px;
                    border: 2px solid #fff;
                    border-radius: 50%;
                    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.05);
                }

                .avatar-image-container {
                    width: 100%;
                    height: 100%;
                    border-radius: 50%;
                    overflow: hidden;
                    position: relative;
                    z-index: 2;
                }

                .avatar-image-container img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .avatar-badge {
                    position: absolute;
                    bottom: 15px;
                    right: 0;
                    background: #4f46e5;
                    border: 3px solid #fff;
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 3;
                }

                .avatar-upload-btn {
                    position: absolute;
                    bottom: -5px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: #fff;
                    border: none;
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 4;
                    color: #666;
                    transition: all 0.3s ease;
                }

                .avatar-upload-btn:hover { background: #18181b; color: #fff; transform: translateX(-50%) translateY(-2px); }

                /* Role Tag & Info */
                .role-tag {
                    background: rgba(79, 70, 229, 0.05);
                    padding: 4px 12px;
                    border-radius: 100px;
                    font-size: 10px;
                    font-weight: 800;
                    text-transform: uppercase;
                    color: #4f46e5;
                    letter-spacing: 0.1em;
                }

                .pulse-dot {
                    width: 6px;
                    height: 6px;
                    background: #4f46e5;
                    border-radius: 50%;
                    box-shadow: 0 0 0 0 rgba(79, 70, 229, 0.4);
                    animation: pulse 2s infinite;
                }

                @keyframes pulse {
                    0% { box-shadow: 0 0 0 0 rgba(79, 70, 229, 0.4); }
                    70% { box-shadow: 0 0 0 10px rgba(79, 70, 229, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(79, 70, 229, 0); }
                }

                .identity-stats .stat-label { font-size: 9px; text-transform: uppercase; font-weight: 800; color: #999; margin-bottom: 2px; }
                .identity-stats .stat-value { font-size: 12px; font-weight: 800; color: #18181b; }

                /* Custom Buttons */
                .btn-logout-luxury {
                    background: transparent;
                    border: 1px solid rgba(0, 0, 0, 0.1);
                    color: #666;
                    padding: 8px 16px;
                    border-radius: 100px;
                    font-size: 10px;
                    font-weight: 800;
                    letter-spacing: 0.1em;
                    transition: all 0.3s ease;
                }
                .btn-logout-luxury:hover { background: #fef2f2; color: #dc2626; border-color: #fee2e2; }

                .btn-luxury-action {
                    background: #18181b;
                    color: #fff;
                    border: none;
                    padding: 14px;
                    border-radius: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    font-weight: 800;
                    font-size: 14px;
                    transition: all 0.3s ease;
                }
                .btn-luxury-action:hover { transform: translateY(-2px); box-shadow: 0 15px 30px -10px rgba(0, 0, 0, 0.3); }
                .btn-luxury-action.active { background: #ef4444; }

                .btn-luxury-outline {
                    background: transparent;
                    border: 1.5px solid rgba(0, 0, 0, 0.05);
                    color: #333;
                    padding: 14px;
                    border-radius: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    font-weight: 800;
                    font-size: 14px;
                    transition: all 0.3s ease;
                }
                .btn-luxury-outline:hover { background: #fafafa; border-color: rgba(0,0,0,0.1); }

                /* Data Core Tiles */
                .icon-box-luxury {
                    width: 40px;
                    height: 40px;
                    background: #fff;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.03);
                }
                .icon-box-luxury.sm { width: 32px; height: 32px; border-radius: 10px; }

                .data-tile-luxury {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .data-tile-luxury label {
                    font-size: 9px;
                    font-weight: 800;
                    color: #999;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    margin-left: 4px;
                }
                .data-tile-luxury .value-display {
                    background: rgba(255, 255, 255, 0.9);
                    padding: 16px 20px;
                    border-radius: 16px;
                    font-weight: 700;
                    color: #18181b;
                    font-size: 15px;
                    border: 1px solid rgba(0, 0, 0, 0.03);
                }
                .data-tile-luxury input {
                    background: #fff;
                    padding: 16px 20px;
                    border-radius: 16px;
                    font-weight: 700;
                    color: #18181b;
                    font-size: 15px;
                    border: 2px solid #4f46e5;
                    outline: none;
                }

                .email-tile .value-display { background: rgba(244, 244, 245, 0.5); border-style: dashed; }
                .security-tag {
                    font-size: 9px;
                    font-weight: 800;
                    background: #fff;
                    padding: 4px 10px;
                    border-radius: 100px;
                    color: #10b981;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.05);
                }

                .mfa-status-banner {
                    padding: 20px;
                    border-radius: 20px;
                    border: 1px solid transparent;
                }
                .mfa-status-banner.secure { background: #ecfdf5; border-color: #d1fae5; color: #065f46; }
                .mfa-status-banner.warning { background: #fff7ed; border-color: #ffedd5; color: #9a3412; }
                
                .mfa-status-banner .status-title { font-size: 10px; font-weight: 900; letter-spacing: 0.1em; margin-bottom: 2px; }
                .mfa-status-banner .status-desc { font-size: 12px; font-weight: 600; opacity: 0.7; }

                .activity-dot { width: 8px; height: 8px; border-radius: 50%; border: 2px solid #4f46e5; flex-shrink: 0; }
                .btn-view-all { background: none; border: none; padding: 0; }

                /* Modal Luxury Overlays */
                .modal-luxury-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(9, 9, 11, 0.8);
                    backdrop-filter: blur(20px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                    padding: 20px;
                }
                .modal-container { background: #fff; width: 100%; max-width: 600px; border-radius: 40px; overflow: hidden; }
                .btn-close-luxury { background: #f4f4f5; border: none; width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease; }
                .btn-close-luxury:hover { background: #ef4444; color: #fff; transform: rotate(90deg); }

                /* Hover States & Transitions */
                .hover-up:hover { transform: translateY(-4px); }
                .animate-slide-up { animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1); }
                @keyframes slideUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

                /* Responsive Adjustments */
                @media (max-width: 991.98px) {
                    .container-fluid { padding-left: 20px !important; padding-right: 20px !important; }
                    .identity-card { position: relative !important; top: 0 !important; margin-bottom: 30px; }
                    .px-5 { padding-left: 30px !important; padding-right: 30px !important; }
                }
            `}</style>
        </div>
    );
};

export default ProfilePage;