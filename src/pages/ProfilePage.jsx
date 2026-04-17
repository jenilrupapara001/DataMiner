import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import {
    User, Mail, Shield, Calendar, Camera, Edit2, Loader2,
    Smartphone, Briefcase, Clock, LogOut, Key, CheckCircle2,
    XCircle, Info, ChevronRight
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
                    setUser(response.data);
                    setFormData({
                        firstName: response.data.firstName || '',
                        lastName: response.data.lastName || '',
                        email: response.data.email || '',
                        phone: response.data.phone || ''
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
                alert('Profile updated successfully');
            }
        } catch (err) {
            console.error('Error updating profile:', err);
            alert('Failed to update profile: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handlePasswordChange = async () => {
        if (pwdData.new !== pwdData.confirm) {
            alert('New passwords do not match');
            return;
        }
        try {
            setSaving(true);
            const response = await api.authApi.changePassword(pwdData.current, pwdData.new);
            if (response.success) {
                alert('Password changed successfully');
                setShowPasswordModal(false);
                setPwdData({ current: '', new: '', confirm: '' });
            }
        } catch (err) {
            alert(err.message || 'Failed to change password');
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = () => {
        if (window.confirm('Are you sure you want to log out?')) {
            authLogout();
        }
    };

    if (loading && !user) {
        return <PageLoader message="Loading Profile..." />;
    }

    if (error) {
        return (
            <div className="container py-5 text-center">
                <div className="alert alert-danger p-4 shadow-sm" style={{ borderRadius: '16px' }}>
                    <h5 className="fw-bold">Error Loading Profile</h5>
                    <p className="mb-0">{error}</p>
                </div>
            </div>
        );
    }

    // Helper to format date
    const formatDate = (dateString) => {
        if (!dateString) return '—';
        return new Date(dateString).toLocaleDateString('en-GB', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
    };

    const roleDisplay = user?.role?.displayName || user?.role?.name || 'User';
    const lastLogin = user?.lastLogin ? formatDate(user.lastLogin) : '—';

    return (
        <div className="container-fluid py-4" style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
            {loading && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}>
                    <LoadingIndicator type="line-simple" size="md" />
                </div>
            )}
            <div className="row justify-content-center">
                <div className="col-lg-10 col-xl-8">
                    {/* Profile Header Card */}
                    <div className="card border-0 shadow-sm mb-4 overflow-hidden" style={{ borderRadius: '24px' }}>
                        <div 
                            className="profile-header-gradient" 
                            style={{ 
                                height: '100px', 
                                background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 50%, #7c3aed 100%)' 
                            }}
                        ></div>
                        <div className="card-body pt-0 px-4 pb-4">
                            <div className="d-flex justify-content-end mt-3">
                                {isEditing ? (
                                    <div className="d-flex gap-2">
                                        <button
                                            className="btn btn-light rounded-pill px-4 fw-semibold"
                                            onClick={() => setIsEditing(false)}
                                            disabled={saving}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            className="btn btn-primary rounded-pill px-4 fw-semibold"
                                            onClick={handleSave}
                                            disabled={saving}
                                        >
                                            {saving ? 'Saving...' : 'Save Changes'}
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        className="btn btn-light rounded-pill px-4 fw-semibold d-flex align-items-center gap-2 shadow-sm"
                                        onClick={() => setIsEditing(true)}
                                    >
                                        <Edit2 size={16} />
                                        Edit Profile
                                    </button>
                                )}
                            </div>
                            <div className="d-flex align-items-center gap-4" style={{ marginTop: '-50px' }}>
                                <div className="position-relative">
                                    <div className="rounded-circle border border-4 border-white shadow-lg overflow-hidden" style={{ width: '100px', height: '100px' }}>
                                        <img
                                            src={`https://ui-avatars.com/api/?name=${user?.firstName}+${user?.lastName}&background=4f46e5&color=fff&size=128&bold=true`}
                                            alt="Profile"
                                            className="w-100 h-100 object-fit-cover"
                                        />
                                    </div>
                                    <button className="btn btn-light btn-sm rounded-circle position-absolute bottom-0 end-0 p-1 shadow border" style={{ transform: 'translate(25%, 25%)' }}>
                                        <Camera size={12} />
                                    </button>
                                </div>
                                <div>
                                    <h2 className="fw-bold mb-1">{user?.firstName} {user?.lastName}</h2>
                                    <div className="d-flex align-items-center gap-2 text-muted">
                                        <Shield size={14} />
                                        <span className="small fw-medium">{roleDisplay}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="row g-4">
                        {/* Left Column: Personal Information */}
                        <div className="col-md-7">
                            <div className="card border-0 shadow-sm h-100" style={{ borderRadius: '20px' }}>
                                <div className="card-header bg-transparent border-0 pt-4 px-4">
                                    <h5 className="fw-bold mb-0">Personal Information</h5>
                                </div>
                                <div className="card-body p-4">
                                    <div className="row g-4">
                                        <div className="col-sm-6">
                                            <label className="text-muted small fw-semibold mb-1 text-uppercase">First Name</label>
                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    className="form-control form-control-lg rounded-3 bg-light border-0"
                                                    value={formData.firstName}
                                                    onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                                                />
                                            ) : (
                                                <div className="p-3 bg-light rounded-3 fw-medium">
                                                    {user?.firstName || '—'}
                                                </div>
                                            )}
                                        </div>
                                        <div className="col-sm-6">
                                            <label className="text-muted small fw-semibold mb-1 text-uppercase">Last Name</label>
                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    className="form-control form-control-lg rounded-3 bg-light border-0"
                                                    value={formData.lastName}
                                                    onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                                                />
                                            ) : (
                                                <div className="p-3 bg-light rounded-3 fw-medium">
                                                    {user?.lastName || '—'}
                                                </div>
                                            )}
                                        </div>
                                        <div className="col-12">
                                            <label className="text-muted small fw-semibold mb-1 text-uppercase">Email Address</label>
                                            <div className="p-3 bg-light rounded-3 d-flex align-items-center gap-3">
                                                <Mail size={18} className="text-muted" />
                                                <span className="fw-medium">{user?.email || '—'}</span>
                                            </div>
                                        </div>
                                        <div className="col-sm-6">
                                            <label className="text-muted small fw-semibold mb-1 text-uppercase">Account Created</label>
                                            <div className="p-3 bg-light rounded-3 d-flex align-items-center gap-3">
                                                <Calendar size={18} className="text-muted" />
                                                <span className="fw-medium">{formatDate(user?.createdAt)}</span>
                                            </div>
                                        </div>
                                        <div className="col-sm-6">
                                            <label className="text-muted small fw-semibold mb-1 text-uppercase">Contact Number</label>
                                            {isEditing ? (
                                                <input
                                                    type="tel"
                                                    className="form-control form-control-lg rounded-3 bg-light border-0"
                                                    value={formData.phone}
                                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                                />
                                            ) : (
                                                <div className="p-3 bg-light rounded-3 d-flex align-items-center gap-3">
                                                    <Smartphone size={18} className="text-muted" />
                                                    <span className="fw-medium">{user?.phone || '—'}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="col-12">
                                            <label className="text-muted small fw-semibold mb-1 text-uppercase">Role & Permissions</label>
                                            <div className="p-3 bg-primary bg-opacity-10 rounded-3 d-flex align-items-center gap-3">
                                                <Shield size={18} className="text-primary" />
                                                <span className="fw-semibold text-primary">{roleDisplay}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Security & Activity + Actions */}
                        <div className="col-md-5">
                            <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '20px' }}>
                                <div className="card-header bg-transparent border-0 pt-4 px-4">
                                    <div className="d-flex justify-content-between align-items-center">
                                        <h5 className="fw-bold mb-0">Security & Activity</h5>
                                        <Shield size={18} className="text-primary" />
                                    </div>
                                </div>
                                <div className="card-body p-4">
                                    {/* 2FA Status - Dynamic */}
                                    <div className="mb-4">
                                        <div className="d-flex justify-content-between align-items-center">
                                            <div className="d-flex align-items-center gap-3">
                                                <div 
                                                    className="p-2 rounded-circle"
                                                    style={{ backgroundColor: user?.twoFactorEnabled ? '#e6f7e6' : '#fef3c7' }}
                                                >
                                                    <Shield size={16} style={{ color: user?.twoFactorEnabled ? '#2e7d32' : '#d97706' }} />
                                                </div>
                                                <div>
                                                    <div className="small fw-bold">Two‑Factor Authentication</div>
                                                    <div className="extra-small text-muted">
                                                        {user?.twoFactorEnabled ? 'Secured via Authenticator' : 'Not enabled'}
                                                    </div>
                                                </div>
                                            </div>
                                            <span 
                                                className="badge rounded-pill px-3 py-1 fw-semibold" 
                                                style={{ 
                                                    backgroundColor: user?.twoFactorEnabled ? '#e6f7e6' : '#fef3c7', 
                                                    color: user?.twoFactorEnabled ? '#2e7d32' : '#d97706' 
                                                }}
                                            >
                                                {user?.twoFactorEnabled ? (
                                                    <><CheckCircle2 size={10} className="me-1" /> Active</>
                                                ) : (
                                                    <><XCircle size={10} className="me-1" /> Disabled</>
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                    {/* Last Login */}
                                    <div className="mb-0">
                                        <div className="d-flex justify-content-between align-items-center">
                                            <div className="d-flex align-items-center gap-3">
                                                <div className="p-2 rounded-circle" style={{ backgroundColor: '#e0e7ff' }}>
                                                    <Clock size={16} style={{ color: '#4f46e5' }} />
                                                </div>
                                                <div>
                                                    <div className="small fw-bold">Last Login</div>
                                                    <div className="extra-small text-muted">{lastLogin}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons Card */}
                            <div className="card border-0 shadow-sm" style={{ borderRadius: '20px' }}>
                                <div className="card-body p-4">
                                    <button
                                        className="btn w-100 rounded-3 py-2 fw-semibold mb-3 d-flex align-items-center justify-content-center gap-2"
                                        style={{ 
                                            backgroundColor: '#f3f4f6', 
                                            border: '1px solid #e5e7eb',
                                            color: '#374151'
                                        }}
                                        onClick={() => setShowPasswordModal(true)}
                                        onMouseOver={(e) => {
                                            e.currentTarget.style.backgroundColor = '#e5e7eb';
                                            e.currentTarget.style.borderColor = '#d1d5db';
                                        }}
                                        onMouseOut={(e) => {
                                            e.currentTarget.style.backgroundColor = '#f3f4f6';
                                            e.currentTarget.style.borderColor = '#e5e7eb';
                                        }}
                                    >
                                        <Key size={16} />
                                        Change Password
                                    </button>
                                    <button
                                        className="btn w-100 rounded-3 py-2 fw-semibold d-flex align-items-center justify-content-center gap-2"
                                        style={{ 
                                            backgroundColor: '#fef2f2', 
                                            border: '1px solid #fecaca',
                                            color: '#dc2626'
                                        }}
                                        onClick={handleLogout}
                                        onMouseOver={(e) => {
                                            e.currentTarget.style.backgroundColor = '#fee2e2';
                                            e.currentTarget.style.borderColor = '#fca5a5';
                                        }}
                                        onMouseOut={(e) => {
                                            e.currentTarget.style.backgroundColor = '#fef2f2';
                                            e.currentTarget.style.borderColor = '#fecaca';
                                        }}
                                    >
                                        <LogOut size={16} />
                                        Log Out Current Session
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Password Change Modal */}
            {showPasswordModal && (
                <div className="modal show d-block modal-backdrop-custom" style={{ zIndex: 1050 }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow-xl" style={{ borderRadius: '20px' }}>
                            <div className="modal-header border-0 px-4 pt-4">
                                <h5 className="fw-bold mb-0">Change Password</h5>
                                <button type="button" className="btn-close" onClick={() => setShowPasswordModal(false)}></button>
                            </div>
                            <div className="modal-body p-4">
                                <div className="mb-3">
                                    <label className="form-label small fw-semibold text-muted text-uppercase">Current Password</label>
                                    <input
                                        type="password"
                                        className="form-control form-control-lg rounded-3 bg-light border-0"
                                        value={pwdData.current}
                                        onChange={e => setPwdData({ ...pwdData, current: e.target.value })}
                                    />
                                </div>
                                <div className="mb-3">
                                    <label className="form-label small fw-semibold text-muted text-uppercase">New Password</label>
                                    <input
                                        type="password"
                                        className="form-control form-control-lg rounded-3 bg-light border-0"
                                        value={pwdData.new}
                                        onChange={e => setPwdData({ ...pwdData, new: e.target.value })}
                                    />
                                </div>
                                <div className="mb-0">
                                    <label className="form-label small fw-semibold text-muted text-uppercase">Confirm New Password</label>
                                    <input
                                        type="password"
                                        className="form-control form-control-lg rounded-3 bg-light border-0"
                                        value={pwdData.confirm}
                                        onChange={e => setPwdData({ ...pwdData, confirm: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="modal-footer border-0 p-4 pt-0 gap-2">
                                <button 
                                    className="btn px-4 fw-semibold" 
                                    onClick={() => setShowPasswordModal(false)}
                                    style={{ 
                                        backgroundColor: '#f3f4f6', 
                                        border: '1px solid #e5e7eb',
                                        color: '#374151',
                                        borderRadius: '8px'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="btn btn-primary px-4 fw-semibold"
                                    onClick={handlePasswordChange}
                                    disabled={saving}
                                    style={{ borderRadius: '8px' }}
                                >
                                    {saving ? 'Updating...' : 'Update Password'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
            .extra-small {
                font-size: 0.7rem;
            }
            .profile-header-gradient {
                background: linear-gradient(135deg, #2563eb 0%, #4f46e5 50%, #7c3aed 100%);
            }
            .shadow-xl {
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            }
            .modal-backdrop-custom {
                backgroundColor: rgba(17, 24, 39, 0.7);
                backdropFilter: blur(4px);
            }
        `}</style>
        </div>
    );
};

export default ProfilePage;