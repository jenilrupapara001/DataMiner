import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
    Users, UserPlus, Mail, Shield, Settings, Activity,
    MoreHorizontal, Check, X, ShieldAlert, Award, ChevronRight,
    ExternalLink, Globe, Info, Search, Filter, Plus, Trash2, Edit2,
    Crown, Sparkles, ArrowUpRight, Building2, CheckCircle2, AlertCircle,
    Layers, Calendar, Briefcase, Zap, Star, UserCheck, Lock, Eye,
    Database, TrendingUp, Hash, Loader2
} from 'lucide-react';
import {
    Modal, Button, Input, Select, Form, Checkbox, Tabs, Avatar,
    Tooltip, Badge, Tag, Empty, Spin, message as antdMessage,
    Typography, ConfigProvider, Drawer, Divider, Space, Card
} from 'antd';
import api, { userApi } from '../services/api';

const { Text, Title } = Typography;
const { TextArea } = Input;

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
const getAvatarColor = (name) => {
    if (!name) return { bg: '#f1f5f9', text: '#64748b', gradient: 'linear-gradient(135deg, #cbd5e1, #94a3b8)' };
    const colors = [
        { bg: '#dbeafe', text: '#2563eb', gradient: 'linear-gradient(135deg, #60a5fa, #2563eb)' },
        { bg: '#fce7f3', text: '#db2777', gradient: 'linear-gradient(135deg, #f472b6, #db2777)' },
        { bg: '#d1fae5', text: '#059669', gradient: 'linear-gradient(135deg, #34d399, #059669)' },
        { bg: '#fef3c7', text: '#d97706', gradient: 'linear-gradient(135deg, #fbbf24, #d97706)' },
        { bg: '#e0e7ff', text: '#4f46e5', gradient: 'linear-gradient(135deg, #818cf8, #4f46e5)' },
        { bg: '#fee2e2', text: '#dc2626', gradient: 'linear-gradient(135deg, #f87171, #dc2626)' },
        { bg: '#cffafe', text: '#0891b2', gradient: 'linear-gradient(135deg, #22d3ee, #0891b2)' },
        { bg: '#f3e8ff', text: '#9333ea', gradient: 'linear-gradient(135deg, #a855f7, #9333ea)' }
    ];
    const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return colors[hash % colors.length];
};

const getInitials = (firstName, lastName) => {
    const f = (firstName || '').charAt(0).toUpperCase();
    const l = (lastName || '').charAt(0).toUpperCase();
    return f + l || '?';
};

// ═══════════════════════════════════════════════════════════════
// TEAM CARD (Sidebar)
// ═══════════════════════════════════════════════════════════════
const TeamCard = memo(({ team, isActive, onClick, memberCount }) => {
    const color = getAvatarColor(team.name);

    return (
        <div
            onClick={onClick}
            className={`team-card-item ${isActive ? 'active' : ''}`}
            style={{
                padding: '12px 14px',
                background: isActive
                    ? 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)'
                    : '#ffffff',
                border: `1px solid ${isActive ? '#a5b4fc' : '#e2e8f0'}`,
                borderRadius: 12,
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                marginBottom: 8,
                position: 'relative',
                overflow: 'hidden'
            }}
        >
            {/* Active indicator */}
            {isActive && (
                <div style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 3,
                    background: 'linear-gradient(180deg, #6366f1 0%, #4f46e5 100%)'
                }} />
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                {/* Team Avatar */}
                <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: color.gradient,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: 14,
                    flexShrink: 0,
                    boxShadow: isActive ? `0 4px 12px -2px ${color.text}40` : 'none',
                    transition: 'box-shadow 0.2s'
                }}>
                    {team.name?.charAt(0)?.toUpperCase() || '?'}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: isActive ? '#0f172a' : '#1e293b',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        marginBottom: 2
                    }}>
                        {team.name}
                    </div>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 10,
                        color: '#94a3b8',
                        fontWeight: 600
                    }}>
                        <Users size={10} strokeWidth={2.5} />
                        {memberCount || 0} members
                    </div>
                </div>

                {isActive && (
                    <ChevronRight size={14} style={{ color: '#6366f1' }} strokeWidth={2.5} />
                )}
            </div>
        </div>
    );
});

// ═══════════════════════════════════════════════════════════════
// STAT CARD
// ═══════════════════════════════════════════════════════════════
const StatCard = memo(({ icon: Icon, label, value, color, sublabel }) => (
    <div style={{
        padding: '14px 16px',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        position: 'relative',
        overflow: 'hidden'
    }}>
        {/* Top accent */}
        <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: `linear-gradient(90deg, ${color} 0%, ${color}80 100%)`
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: `${color}12`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color,
                flexShrink: 0
            }}>
                <Icon size={18} strokeWidth={2.5} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: '#0f172a',
                    letterSpacing: '-0.5px',
                    lineHeight: 1
                }}>
                    {value}
                </div>
                <div style={{
                    fontSize: 10,
                    color: '#94a3b8',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginTop: 3
                }}>
                    {label}
                </div>
                {sublabel && (
                    <div style={{
                        fontSize: 9,
                        color: '#64748b',
                        fontWeight: 600,
                        marginTop: 2
                    }}>
                        {sublabel}
                    </div>
                )}
            </div>
        </div>
    </div>
));

// ═══════════════════════════════════════════════════════════════
// MEMBER ROW
// ═══════════════════════════════════════════════════════════════
const MemberRow = memo(({ member, onRemove, onEdit }) => {
    const user = member.user || {};
    const avatarColor = getAvatarColor(`${user.firstName || ''} ${user.lastName || ''}`);
    const isLead = member.role === 'lead';

    return (
        <div
            className="member-row-premium"
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px 18px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderLeft: isLead ? '3px solid #f59e0b' : '3px solid transparent',
                borderRadius: 12,
                marginBottom: 10,
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
        >
            {/* Avatar */}
            <div style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: avatarColor.gradient,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: 14,
                flexShrink: 0,
                boxShadow: `0 4px 12px -2px ${avatarColor.text}40`,
                border: '2px solid #ffffff',
                position: 'relative'
            }}>
                {getInitials(user.firstName, user.lastName)}
                {isLead && (
                    <div style={{
                        position: 'absolute',
                        bottom: -2,
                        right: -2,
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px solid #ffffff'
                    }}>
                        <Crown size={9} color="#ffffff" strokeWidth={3} />
                    </div>
                )}
            </div>

            {/* User Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 3
                }}>
                    <div style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: '#0f172a',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    }}>
                        {user.firstName} {user.lastName}
                    </div>
                    {isLead ? (
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            padding: '2px 8px',
                            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                            border: '1px solid #fbbf24',
                            borderRadius: 12,
                            fontSize: 9,
                            fontWeight: 800,
                            color: '#92400e',
                            letterSpacing: '0.04em'
                        }}>
                            <Crown size={9} strokeWidth={2.5} />
                            LEAD
                        </span>
                    ) : (
                        <span style={{
                            padding: '2px 8px',
                            background: '#f1f5f9',
                            border: '1px solid #e2e8f0',
                            borderRadius: 12,
                            fontSize: 9,
                            fontWeight: 800,
                            color: '#64748b',
                            letterSpacing: '0.04em'
                        }}>
                            MEMBER
                        </span>
                    )}
                </div>

                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 12,
                    color: '#64748b',
                    fontWeight: 500
                }}>
                    <Mail size={11} strokeWidth={2.5} />
                    <span style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    }}>
                        {user.email}
                    </span>
                </div>
            </div>

            {/* Access Scope */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                flexShrink: 0,
                maxWidth: '40%'
            }}>
                {member.resourceAccess?.length > 0 ? (
                    <Tooltip title={member.resourceAccess.map(r => r?.name).join(', ')}>
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '4px 10px',
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            borderRadius: 12,
                            fontSize: 10,
                            fontWeight: 700,
                            color: '#2563eb',
                            cursor: 'help'
                        }}>
                            <Lock size={10} strokeWidth={2.5} />
                            {member.resourceAccess.length} resources
                        </div>
                    </Tooltip>
                ) : (
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '4px 10px',
                        background: '#ecfdf5',
                        border: '1px solid #a7f3d0',
                        borderRadius: 12,
                        fontSize: 10,
                        fontWeight: 700,
                        color: '#059669'
                    }}>
                        <Eye size={10} strokeWidth={2.5} />
                        Full Access
                    </div>
                )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <Tooltip title="Edit Access">
                    <button
                        onClick={() => onEdit && onEdit(member)}
                        className="member-action-btn"
                        style={{
                            width: 30,
                            height: 30,
                            borderRadius: 8,
                            border: '1px solid #e2e8f0',
                            background: '#ffffff',
                            color: '#64748b',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s'
                        }}
                    >
                        <Edit2 size={12} strokeWidth={2.5} />
                    </button>
                </Tooltip>
                <Tooltip title="Remove Member">
                    <button
                        onClick={() => onRemove(user._id)}
                        className="member-action-btn danger"
                        style={{
                            width: 30,
                            height: 30,
                            borderRadius: 8,
                            border: '1px solid #e2e8f0',
                            background: '#ffffff',
                            color: '#ef4444',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s'
                        }}
                    >
                        <Trash2 size={12} strokeWidth={2.5} />
                    </button>
                </Tooltip>
            </div>
        </div>
    );
});

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
const TeamManagementPage = () => {
    const [messageApi, contextHolder] = antdMessage.useMessage();

    const [teams, setTeams] = useState([]);
    const [activeTeam, setActiveTeam] = useState(null);
    const [members, setMembers] = useState([]);
    const [sellers, setSellers] = useState([]);
    const [availableUsers, setAvailableUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('members');
    const [searchText, setSearchText] = useState('');

    // Modals
    const [createTeamModal, setCreateTeamModal] = useState(false);
    const [addMemberModal, setAddMemberModal] = useState(false);
    const [editTeamModal, setEditTeamModal] = useState(false);

    // Forms
    const [teamForm, setTeamForm] = useState({ name: '', description: '' });
    const [memberForm, setMemberForm] = useState({ userId: '', role: 'member', resourceAccess: [] });

    const [saving, setSaving] = useState(false);

    // ═══════════════════════════════════════════════════════════════
    // DATA FETCHING (Same as before)
    // ═══════════════════════════════════════════════════════════════
    const fetchSellers = useCallback(async () => {
        try {
            const res = await api.get('/sellers');
            const sellersData = res.data?.sellers || res.data || [];
            setSellers(Array.isArray(sellersData) ? sellersData : []);
        } catch (err) {
            console.error('Failed to fetch sellers:', err);
        }
    }, []);

    const fetchUsers = useCallback(async () => {
        try {
            const res = await userApi.getAll({ limit: 100 });
            const userData = res.data?.users || res.data || res || [];
            setAvailableUsers(Array.isArray(userData) ? userData : []);
        } catch (err) {
            console.error('Failed to fetch users:', err);
        }
    }, []);

    const fetchTeams = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get('/teams');
            const teamData = res.data || [];
            setTeams(teamData);
            if (teamData.length > 0 && !activeTeam) {
                setActiveTeam(teamData[0]);
            }
            setLoading(false);
        } catch (err) {
            messageApi.error('Failed to fetch teams');
            setLoading(false);
        }
    }, [activeTeam, messageApi]);

    const fetchMembers = useCallback(async (teamId) => {
        try {
            const res = await api.get(`/teams/${teamId}/members`);
            setMembers(res.data || []);
        } catch (err) {
            messageApi.error('Failed to fetch members');
        }
    }, [messageApi]);

    useEffect(() => {
        fetchTeams();
        fetchSellers();
        fetchUsers();
    }, [fetchTeams, fetchSellers, fetchUsers]);

    useEffect(() => {
        if (activeTeam) {
            fetchMembers(activeTeam._id);
        }
    }, [activeTeam, fetchMembers]);

    // ═══════════════════════════════════════════════════════════════
    // HANDLERS
    // ═══════════════════════════════════════════════════════════════
    const handleCreateTeam = async () => {
        if (!teamForm.name.trim()) {
            messageApi.warning('Team name is required');
            return;
        }
        setSaving(true);
        try {
            const res = await api.post('/teams', teamForm);
            setTeams([...teams, res.data]);
            setActiveTeam(res.data);
            setCreateTeamModal(false);
            setTeamForm({ name: '', description: '' });
            messageApi.success('Team created successfully');
        } catch (err) {
            messageApi.error(err.response?.data?.message || 'Failed to create team');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateTeam = async () => {
        if (!teamForm.name.trim()) {
            messageApi.warning('Team name is required');
            return;
        }
        setSaving(true);
        try {
            const res = await api.put(`/teams/${activeTeam._id}`, {
                name: teamForm.name,
                description: teamForm.description
            });
            setTeams(teams.map(t => t._id === res.data._id ? res.data : t));
            setActiveTeam(res.data);
            setEditTeamModal(false);
            messageApi.success('Team updated successfully');
        } catch (err) {
            messageApi.error(err.response?.data?.message || 'Failed to update team');
        } finally {
            setSaving(false);
        }
    };

    const handleAddMember = async () => {
        if (!memberForm.userId) {
            messageApi.warning('Please select a user');
            return;
        }
        setSaving(true);
        try {
            await api.post(`/teams/${activeTeam._id}/members`, memberForm);
            fetchMembers(activeTeam._id);
            setAddMemberModal(false);
            setMemberForm({ userId: '', role: 'member', resourceAccess: [] });
            messageApi.success('Member added successfully');
        } catch (err) {
            messageApi.error(err.response?.data?.message || 'Failed to add member');
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveMember = async (userId) => {
        Modal.confirm({
            title: 'Remove Member',
            content: 'Are you sure you want to remove this member from the team?',
            okText: 'Remove',
            okType: 'danger',
            cancelText: 'Cancel',
            centered: true,
            onOk: async () => {
                try {
                    await api.delete(`/teams/${activeTeam._id}/members/${userId}`);
                    setMembers(members.filter(m => m.user?._id !== userId));
                    messageApi.success('Member removed successfully');
                } catch (err) {
                    messageApi.error('Failed to remove member');
                }
            }
        });
    };

    // ═══════════════════════════════════════════════════════════════
    // FILTERED MEMBERS
    // ═══════════════════════════════════════════════════════════════
    const filteredMembers = useMemo(() => {
        if (!searchText) return members;
        const q = searchText.toLowerCase();
        return members.filter(m => {
            const u = m.user || {};
            return (
                (u.firstName || '').toLowerCase().includes(q) ||
                (u.lastName || '').toLowerCase().includes(q) ||
                (u.email || '').toLowerCase().includes(q)
            );
        });
    }, [members, searchText]);

    // ═══════════════════════════════════════════════════════════════
    // LOADING STATE
    // ═══════════════════════════════════════════════════════════════
    if (loading && teams.length === 0) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 'calc(100vh - 60px)',
                background: '#f8fafc'
            }}>
                <div style={{
                    background: '#ffffff',
                    padding: 40,
                    borderRadius: 16,
                    boxShadow: '0 8px 32px -4px rgba(0, 0, 0, 0.08)',
                    border: '1px solid #e2e8f0',
                    textAlign: 'center',
                    minWidth: 280
                }}>
                    <div style={{
                        width: 64,
                        height: 64,
                        borderRadius: 16,
                        background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 16,
                        boxShadow: '0 8px 24px -8px rgba(99, 102, 241, 0.5)'
                    }}>
                        <Users size={28} color="#ffffff" strokeWidth={2.5} />
                    </div>
                    <Spin size="large" />
                    <div style={{
                        marginTop: 16,
                        fontSize: 13,
                        color: '#64748b',
                        fontWeight: 600
                    }}>
                        Loading Team Hub...
                    </div>
                </div>
            </div>
        );
    }

    return (
        <ConfigProvider
            theme={{
                token: {
                    colorPrimary: '#6366f1',
                    borderRadius: 10
                }
            }}
        >
            <div className="team-hub-container">
                {contextHolder}

                {/* ═══════════════════════════════════════════════════
                    LAYOUT: Sidebar + Main Content
                ═══════════════════════════════════════════════════ */}
                <div style={{
                    display: 'flex',
                    height: 'calc(100vh - 60px)',
                    background: '#fafbfc'
                }}>
                    {/* ═══════════════════════════════════════════════════
                        SIDEBAR (Teams List)
                    ═══════════════════════════════════════════════════ */}
                    <div style={{
                        width: 280,
                        background: '#ffffff',
                        borderRight: '1px solid #e2e8f0',
                        display: 'flex',
                        flexDirection: 'column',
                        flexShrink: 0
                    }}>
                        {/* Sidebar Header */}
                        <div style={{
                            padding: '20px 18px 16px',
                            borderBottom: '1px solid #f1f5f9',
                            background: 'linear-gradient(135deg, #fafbff 0%, #ffffff 100%)'
                        }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 11,
                                marginBottom: 14
                            }}>
                                <div style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 11,
                                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#ffffff',
                                    boxShadow: '0 4px 12px -2px rgba(99, 102, 241, 0.5)'
                                }}>
                                    <Users size={20} strokeWidth={2.5} />
                                </div>
                                <div>
                                    <div style={{
                                        fontSize: 14,
                                        fontWeight: 800,
                                        color: '#0f172a',
                                        letterSpacing: '-0.01em',
                                        lineHeight: 1.2
                                    }}>
                                        Team Hub
                                    </div>
                                    <div style={{
                                        fontSize: 10,
                                        color: '#94a3b8',
                                        fontWeight: 600,
                                        marginTop: 2
                                    }}>
                                        {teams.length} {teams.length === 1 ? 'team' : 'teams'}
                                    </div>
                                </div>
                            </div>

                            {/* Create Team Button */}
                            <button
                                onClick={() => {
                                    setTeamForm({ name: '', description: '' });
                                    setCreateTeamModal(true);
                                }}
                                className="create-team-btn"
                                style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: 10,
                                    fontSize: 12,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 6,
                                    transition: 'all 0.2s',
                                    boxShadow: '0 4px 12px -2px rgba(99, 102, 241, 0.4)'
                                }}
                            >
                                <Plus size={14} strokeWidth={2.5} />
                                Create New Team
                            </button>
                        </div>

                        {/* Teams List */}
                        <div style={{
                            flex: 1,
                            overflowY: 'auto',
                            padding: '14px 12px'
                        }}>
                            {teams.length === 0 ? (
                                <div style={{
                                    padding: 24,
                                    textAlign: 'center',
                                    color: '#94a3b8',
                                    fontSize: 12
                                }}>
                                    <Users size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                                    <div>No teams yet</div>
                                </div>
                            ) : (
                                teams.map(team => (
                                    <TeamCard
                                        key={team._id}
                                        team={team}
                                        isActive={activeTeam?._id === team._id}
                                        onClick={() => setActiveTeam(team)}
                                        memberCount={activeTeam?._id === team._id ? members.length : (team.memberCount || 0)}
                                    />
                                ))
                            )}
                        </div>
                    </div>

                    {/* ═══════════════════════════════════════════════════
                        MAIN CONTENT
                    ═══════════════════════════════════════════════════ */}
                    <div style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden'
                    }}>
                        {!activeTeam ? (
                            /* Empty State */
                            <div style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: 40
                            }}>
                                <div style={{
                                    background: '#ffffff',
                                    padding: 48,
                                    borderRadius: 16,
                                    border: '1px solid #e2e8f0',
                                    textAlign: 'center',
                                    maxWidth: 480,
                                    boxShadow: '0 4px 16px -4px rgba(0, 0, 0, 0.04)'
                                }}>
                                    <div style={{
                                        width: 80,
                                        height: 80,
                                        borderRadius: 20,
                                        background: 'linear-gradient(135deg, #eef2ff 0%, #ddd6fe 100%)',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginBottom: 20,
                                        border: '2px solid #c7d2fe'
                                    }}>
                                        <Users size={36} color="#6366f1" strokeWidth={2} />
                                    </div>
                                    <div style={{
                                        fontSize: 18,
                                        fontWeight: 800,
                                        color: '#0f172a',
                                        marginBottom: 8
                                    }}>
                                        Welcome to Team Hub
                                    </div>
                                    <div style={{
                                        fontSize: 13,
                                        color: '#64748b',
                                        marginBottom: 24,
                                        lineHeight: 1.6
                                    }}>
                                        Create your first team to start managing members, roles, and access permissions in one premium workspace.
                                    </div>
                                    <button
                                        onClick={() => {
                                            setTeamForm({ name: '', description: '' });
                                            setCreateTeamModal(true);
                                        }}
                                        style={{
                                            padding: '10px 20px',
                                            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                            color: '#ffffff',
                                            border: 'none',
                                            borderRadius: 10,
                                            fontSize: 13,
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 7,
                                            boxShadow: '0 6px 16px -2px rgba(99, 102, 241, 0.4)'
                                        }}
                                    >
                                        <Sparkles size={14} strokeWidth={2.5} />
                                        Create Your First Team
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* ═══════════════════════════════════════════════════
                                    TEAM HEADER
                                ═══════════════════════════════════════════════════ */}
                                <div style={{
                                    padding: '20px 28px',
                                    background: '#ffffff',
                                    borderBottom: '1px solid #e2e8f0',
                                    flexShrink: 0
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        gap: 16,
                                        flexWrap: 'wrap',
                                        marginBottom: 18
                                    }}>
                                        {/* Team Info */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                            <div style={{
                                                width: 56,
                                                height: 56,
                                                borderRadius: 14,
                                                background: getAvatarColor(activeTeam.name).gradient,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: '#ffffff',
                                                fontWeight: 800,
                                                fontSize: 22,
                                                boxShadow: `0 8px 20px -4px ${getAvatarColor(activeTeam.name).text}50`
                                            }}>
                                                {activeTeam.name?.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 8,
                                                    marginBottom: 4
                                                }}>
                                                    <h1 style={{
                                                        margin: 0,
                                                        fontSize: 20,
                                                        fontWeight: 800,
                                                        color: '#0f172a',
                                                        letterSpacing: '-0.5px'
                                                    }}>
                                                        {activeTeam.name}
                                                    </h1>
                                                    <span style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: 3,
                                                        padding: '2px 8px',
                                                        background: '#ecfdf5',
                                                        border: '1px solid #a7f3d0',
                                                        borderRadius: 10,
                                                        fontSize: 9,
                                                        fontWeight: 800,
                                                        color: '#059669'
                                                    }}>
                                                        <CheckCircle2 size={9} strokeWidth={2.5} />
                                                        ACTIVE
                                                    </span>
                                                </div>
                                                <div style={{
                                                    fontSize: 12,
                                                    color: '#64748b',
                                                    fontWeight: 500
                                                }}>
                                                    {activeTeam.description || 'No description provided'}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button
                                                onClick={() => {
                                                    setTeamForm({
                                                        name: activeTeam.name,
                                                        description: activeTeam.description || ''
                                                    });
                                                    setEditTeamModal(true);
                                                }}
                                                className="header-btn-default"
                                                style={{
                                                    padding: '8px 14px',
                                                    background: '#ffffff',
                                                    color: '#475569',
                                                    border: '1px solid #e2e8f0',
                                                    borderRadius: 10,
                                                    fontSize: 12,
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 6,
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                <Settings size={13} strokeWidth={2.5} />
                                                Settings
                                            </button>
                                            <button
                                                onClick={() => setAddMemberModal(true)}
                                                className="header-btn-primary"
                                                style={{
                                                    padding: '8px 16px',
                                                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                                    color: '#ffffff',
                                                    border: 'none',
                                                    borderRadius: 10,
                                                    fontSize: 12,
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 6,
                                                    transition: 'all 0.2s',
                                                    boxShadow: '0 4px 12px -2px rgba(99, 102, 241, 0.4)'
                                                }}
                                            >
                                                <UserPlus size={13} strokeWidth={2.5} />
                                                Add Member
                                            </button>
                                        </div>
                                    </div>

                                    {/* Stat Cards Row */}
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                        gap: 12
                                    }}>
                                        <StatCard
                                            icon={Users}
                                            label="Total Members"
                                            value={members.length}
                                            color="#6366f1"
                                            sublabel="In this team"
                                        />
                                        <StatCard
                                            icon={Crown}
                                            label="Team Leads"
                                            value={members.filter(m => m.role === 'lead').length}
                                            color="#f59e0b"
                                            sublabel="With elevated access"
                                        />
                                        <StatCard
                                            icon={UserCheck}
                                            label="Members"
                                            value={members.filter(m => m.role !== 'lead').length}
                                            color="#10b981"
                                            sublabel="Standard members"
                                        />
                                        <StatCard
                                            icon={Database}
                                            label="Resources"
                                            value={activeTeam.resourceAccess?.length || 0}
                                            color="#06b6d4"
                                            sublabel="Connected sellers"
                                        />
                                    </div>
                                </div>

                                {/* ═══════════════════════════════════════════════════
                                    TABS
                                ═══════════════════════════════════════════════════ */}
                                <div style={{
                                    background: '#ffffff',
                                    borderBottom: '1px solid #e2e8f0',
                                    padding: '0 28px',
                                    flexShrink: 0
                                }}>
                                    <Tabs
                                        activeKey={activeTab}
                                        onChange={setActiveTab}
                                        className="premium-tabs"
                                        items={[
                                            {
                                                key: 'members',
                                                label: (
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                        <Users size={13} strokeWidth={2.5} />
                                                        Members
                                                        <span style={{
                                                            padding: '1px 7px',
                                                            background: activeTab === 'members' ? '#eef2ff' : '#f1f5f9',
                                                            color: activeTab === 'members' ? '#4f46e5' : '#64748b',
                                                            borderRadius: 10,
                                                            fontSize: 10,
                                                            fontWeight: 800
                                                        }}>
                                                            {members.length}
                                                        </span>
                                                    </span>
                                                )
                                            },
                                            {
                                                key: 'roles',
                                                label: (
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                        <Shield size={13} strokeWidth={2.5} />
                                                        Roles & Access
                                                    </span>
                                                )
                                            },
                                            {
                                                key: 'activity',
                                                label: (
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                        <Activity size={13} strokeWidth={2.5} />
                                                        Activity
                                                    </span>
                                                )
                                            },
                                            {
                                                key: 'overview',
                                                label: (
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                        <Info size={13} strokeWidth={2.5} />
                                                        Overview
                                                    </span>
                                                )
                                            }
                                        ]}
                                    />
                                </div>

                                {/* ═══════════════════════════════════════════════════
                                    TAB CONTENT
                                ═══════════════════════════════════════════════════ */}
                                <div style={{
                                    flex: 1,
                                    overflowY: 'auto',
                                    padding: '20px 28px'
                                }}>
                                    {/* MEMBERS TAB */}
                                    {activeTab === 'members' && (
                                        <div>
                                            {/* Search Bar */}
                                            <div style={{
                                                position: 'relative',
                                                marginBottom: 16,
                                                maxWidth: 360
                                            }}>
                                                <Search
                                                    size={13}
                                                    style={{
                                                        position: 'absolute',
                                                        left: 12,
                                                        top: '50%',
                                                        transform: 'translateY(-50%)',
                                                        color: '#94a3b8'
                                                    }}
                                                    strokeWidth={2.5}
                                                />
                                                <input
                                                    type="text"
                                                    placeholder="Search members by name or email..."
                                                    value={searchText}
                                                    onChange={(e) => setSearchText(e.target.value)}
                                                    style={{
                                                        width: '100%',
                                                        padding: '8px 12px 8px 32px',
                                                        fontSize: 12,
                                                        fontWeight: 600,
                                                        borderRadius: 10,
                                                        border: '1.5px solid #e2e8f0',
                                                        background: '#ffffff',
                                                        outline: 'none',
                                                        transition: 'all 0.2s',
                                                        color: '#0f172a'
                                                    }}
                                                    className="member-search-input"
                                                />
                                            </div>

                                            {/* Members List */}
                                            {filteredMembers.length === 0 ? (
                                                <div style={{
                                                    background: '#ffffff',
                                                    padding: 60,
                                                    textAlign: 'center',
                                                    borderRadius: 12,
                                                    border: '1px dashed #cbd5e1'
                                                }}>
                                                    <Users size={36} style={{ color: '#cbd5e1', marginBottom: 12 }} />
                                                    <div style={{ fontSize: 14, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                                                        {searchText ? 'No members found' : 'No members yet'}
                                                    </div>
                                                    <div style={{ fontSize: 12, color: '#94a3b8' }}>
                                                        {searchText ? 'Try different search terms' : 'Click "Add Member" to get started'}
                                                    </div>
                                                </div>
                                            ) : (
                                                filteredMembers.map(member => (
                                                    <MemberRow
                                                        key={member._id}
                                                        member={member}
                                                        onRemove={handleRemoveMember}
                                                    />
                                                ))
                                            )}
                                        </div>
                                    )}

                                    {/* ROLES TAB */}
                                    {activeTab === 'roles' && (
                                        <div style={{
                                            background: '#ffffff',
                                            padding: 60,
                                            textAlign: 'center',
                                            borderRadius: 12,
                                            border: '1px solid #e2e8f0'
                                        }}>
                                            <ShieldAlert size={48} style={{ color: '#cbd5e1', marginBottom: 16 }} />
                                            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
                                                Role Management
                                            </h3>
                                            <p style={{ fontSize: 12, color: '#64748b', maxWidth: 400, margin: '0 auto' }}>
                                                Define team-specific permissions and management hierarchies.
                                                Coming soon with global roles integration.
                                            </p>
                                        </div>
                                    )}

                                    {/* ACTIVITY TAB */}
                                    {activeTab === 'activity' && (
                                        <div style={{
                                            background: '#ffffff',
                                            padding: 60,
                                            textAlign: 'center',
                                            borderRadius: 12,
                                            border: '1px solid #e2e8f0'
                                        }}>
                                            <Activity size={48} style={{ color: '#cbd5e1', marginBottom: 16 }} />
                                            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
                                                Team Activity Audit
                                            </h3>
                                            <p style={{ fontSize: 12, color: '#64748b', maxWidth: 400, margin: '0 auto' }}>
                                                Track all changes made to this team and its membership.
                                            </p>
                                        </div>
                                    )}

                                    {/* OVERVIEW TAB */}
                                    {activeTab === 'overview' && (
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: '2fr 1fr',
                                            gap: 16
                                        }}>
                                            {/* Description Card */}
                                            <div style={{
                                                background: '#ffffff',
                                                padding: 20,
                                                borderRadius: 12,
                                                border: '1px solid #e2e8f0'
                                            }}>
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 8,
                                                    marginBottom: 12
                                                }}>
                                                    <Info size={16} style={{ color: '#6366f1' }} strokeWidth={2.5} />
                                                    <h3 style={{
                                                        margin: 0,
                                                        fontSize: 14,
                                                        fontWeight: 800,
                                                        color: '#0f172a'
                                                    }}>
                                                        About {activeTeam.name}
                                                    </h3>
                                                </div>
                                                <p style={{
                                                    fontSize: 13,
                                                    color: '#475569',
                                                    lineHeight: 1.6,
                                                    margin: 0
                                                }}>
                                                    {activeTeam.description || 'No description provided for this team. Add one in Team Settings to help members understand their objectives.'}
                                                </p>
                                            </div>

                                            {/* Stats Card */}
                                            <div style={{
                                                background: 'linear-gradient(135deg, #fafbff 0%, #ffffff 100%)',
                                                padding: 20,
                                                borderRadius: 12,
                                                border: '1px solid #e2e8f0'
                                            }}>
                                                <h3 style={{
                                                    margin: '0 0 14px 0',
                                                    fontSize: 11,
                                                    fontWeight: 800,
                                                    color: '#64748b',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.06em'
                                                }}>
                                                    Quick Stats
                                                </h3>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                                    {[
                                                        { label: 'Total Members', value: members.length, color: '#6366f1' },
                                                        { label: 'Team Leads', value: members.filter(m => m.role === 'lead').length, color: '#f59e0b' },
                                                        { label: 'Resources', value: activeTeam.resourceAccess?.length || 0, color: '#10b981' }
                                                    ].map((stat, i) => (
                                                        <div key={i} style={{
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center',
                                                            padding: '8px 0',
                                                            borderBottom: i < 2 ? '1px solid #f1f5f9' : 'none'
                                                        }}>
                                                            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                                                                {stat.label}
                                                            </span>
                                                            <span style={{
                                                                fontSize: 14,
                                                                fontWeight: 800,
                                                                color: stat.color
                                                            }}>
                                                                {stat.value}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════
                    CREATE TEAM MODAL
                ═══════════════════════════════════════════════════ */}
                <Modal
                    open={createTeamModal}
                    onCancel={() => setCreateTeamModal(false)}
                    footer={null}
                    width={500}
                    centered
                    destroyOnHidden
                    title={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                                width: 36,
                                height: 36,
                                borderRadius: 10,
                                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#ffffff'
                            }}>
                                <Sparkles size={18} strokeWidth={2.5} />
                            </div>
                            <div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
                                    Create New Team
                                </div>
                                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
                                    Set up a new team for collaboration
                                </div>
                            </div>
                        </div>
                    }
                >
                    <div style={{ padding: '8px 0' }}>
                        <div style={{ marginBottom: 16 }}>
                            <label style={{
                                display: 'block',
                                fontSize: 11,
                                fontWeight: 800,
                                color: '#64748b',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                marginBottom: 6
                            }}>
                                Team Name *
                            </label>
                            <Input
                                value={teamForm.name}
                                onChange={e => setTeamForm({ ...teamForm, name: e.target.value })}
                                placeholder="e.g., Amazon SEO Operations"
                                size="large"
                                style={{ borderRadius: 10 }}
                                prefix={<Briefcase size={14} style={{ color: '#94a3b8' }} />}
                            />
                        </div>
                        <div style={{ marginBottom: 20 }}>
                            <label style={{
                                display: 'block',
                                fontSize: 11,
                                fontWeight: 800,
                                color: '#64748b',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                marginBottom: 6
                            }}>
                                Description
                            </label>
                            <TextArea
                                value={teamForm.description}
                                onChange={e => setTeamForm({ ...teamForm, description: e.target.value })}
                                placeholder="Briefly describe the team's purpose and goals..."
                                rows={3}
                                style={{ borderRadius: 10 }}
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <Button
                                onClick={() => setCreateTeamModal(false)}
                                style={{ borderRadius: 10, fontWeight: 600 }}
                            >
                                Cancel
                            </Button>
                            <button
                                onClick={handleCreateTeam}
                                disabled={saving}
                                style={{
                                    padding: '6px 18px',
                                    background: saving ? '#cbd5e1' : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: 10,
                                    fontSize: 13,
                                    fontWeight: 700,
                                    cursor: saving ? 'wait' : 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    transition: 'all 0.2s',
                                    boxShadow: saving ? 'none' : '0 4px 12px -2px rgba(99, 102, 241, 0.4)'
                                }}
                            >
                                {saving ? <Loader2 size={14} className="spin-animation" /> : <Sparkles size={14} strokeWidth={2.5} />}
                                {saving ? 'Creating...' : 'Create Team'}
                            </button>
                        </div>
                    </div>
                </Modal>

                {/* ═══════════════════════════════════════════════════
                    EDIT TEAM MODAL
                ═══════════════════════════════════════════════════ */}
                <Modal
                    open={editTeamModal}
                    onCancel={() => setEditTeamModal(false)}
                    footer={null}
                    width={500}
                    centered
                    destroyOnHidden
                    title={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                                width: 36,
                                height: 36,
                                borderRadius: 10,
                                background: 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#ffffff'
                            }}>
                                <Settings size={18} strokeWidth={2.5} />
                            </div>
                            <div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
                                    Team Settings
                                </div>
                                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
                                    Update team information
                                </div>
                            </div>
                        </div>
                    }
                >
                    <div style={{ padding: '8px 0' }}>
                        <div style={{ marginBottom: 16 }}>
                            <label style={{
                                display: 'block',
                                fontSize: 11,
                                fontWeight: 800,
                                color: '#64748b',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                marginBottom: 6
                            }}>
                                Team Name *
                            </label>
                            <Input
                                value={teamForm.name}
                                onChange={e => setTeamForm({ ...teamForm, name: e.target.value })}
                                size="large"
                                style={{ borderRadius: 10 }}
                            />
                        </div>
                        <div style={{ marginBottom: 20 }}>
                            <label style={{
                                display: 'block',
                                fontSize: 11,
                                fontWeight: 800,
                                color: '#64748b',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                marginBottom: 6
                            }}>
                                Description
                            </label>
                            <TextArea
                                value={teamForm.description}
                                onChange={e => setTeamForm({ ...teamForm, description: e.target.value })}
                                rows={3}
                                style={{ borderRadius: 10 }}
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <Button
                                onClick={() => setEditTeamModal(false)}
                                style={{ borderRadius: 10, fontWeight: 600 }}
                            >
                                Cancel
                            </Button>
                            <button
                                onClick={handleUpdateTeam}
                                disabled={saving}
                                style={{
                                    padding: '6px 18px',
                                    background: saving ? '#cbd5e1' : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: 10,
                                    fontSize: 13,
                                    fontWeight: 700,
                                    cursor: saving ? 'wait' : 'pointer',
                                    boxShadow: saving ? 'none' : '0 4px 12px -2px rgba(99, 102, 241, 0.4)'
                                }}
                            >
                                {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </Modal>

                {/* ═══════════════════════════════════════════════════
                    ADD MEMBER MODAL
                ═══════════════════════════════════════════════════ */}
                <Modal
                    open={addMemberModal}
                    onCancel={() => setAddMemberModal(false)}
                    footer={null}
                    width={580}
                    centered
                    destroyOnHidden
                    title={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                                width: 36,
                                height: 36,
                                borderRadius: 10,
                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#ffffff'
                            }}>
                                <UserPlus size={18} strokeWidth={2.5} />
                            </div>
                            <div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
                                    Add Team Member
                                </div>
                                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
                                    Invite a user to join {activeTeam?.name}
                                </div>
                            </div>
                        </div>
                    }
                >
                    <div style={{ padding: '8px 0' }}>
                        <div style={{ marginBottom: 16 }}>
                            <label style={{
                                display: 'block',
                                fontSize: 11,
                                fontWeight: 800,
                                color: '#64748b',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                marginBottom: 6
                            }}>
                                Select User *
                            </label>
                            <Select
                                value={memberForm.userId || undefined}
                                onChange={value => setMemberForm({ ...memberForm, userId: value })}
                                placeholder="Choose a user to add..."
                                size="large"
                                style={{ width: '100%', borderRadius: 10 }}
                                showSearch
                                optionFilterProp="children"
                                filterOption={(input, option) =>
                                    String(option?.label || '').toLowerCase().includes(input.toLowerCase())
                                }
                                options={availableUsers.map(u => ({
                                    value: u._id,
                                    label: `${u.firstName} ${u.lastName} (${u.email})`
                                }))}
                            />
                        </div>

                        <div style={{ marginBottom: 16 }}>
                            <label style={{
                                display: 'block',
                                fontSize: 11,
                                fontWeight: 800,
                                color: '#64748b',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                marginBottom: 6
                            }}>
                                Role
                            </label>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {[
                                    { value: 'member', label: 'Member', icon: Users, color: '#64748b' },
                                    { value: 'lead', label: 'Team Lead', icon: Crown, color: '#f59e0b' }
                                ].map(opt => {
                                    const isSelected = memberForm.role === opt.value;
                                    const OptIcon = opt.icon;
                                    return (
                                        <button
                                            key={opt.value}
                                            onClick={() => setMemberForm({ ...memberForm, role: opt.value })}
                                            style={{
                                                flex: 1,
                                                padding: '10px 14px',
                                                background: isSelected ? `${opt.color}10` : '#ffffff',
                                                border: `2px solid ${isSelected ? opt.color : '#e2e8f0'}`,
                                                borderRadius: 10,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 8,
                                                transition: 'all 0.2s',
                                                fontWeight: 700,
                                                fontSize: 12,
                                                color: isSelected ? opt.color : '#475569'
                                            }}
                                        >
                                            <OptIcon size={15} strokeWidth={2.5} />
                                            {opt.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div style={{ marginBottom: 20 }}>
                            <label style={{
                                display: 'block',
                                fontSize: 11,
                                fontWeight: 800,
                                color: '#64748b',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                marginBottom: 6
                            }}>
                                Data Access (Sellers)
                            </label>
                            <div style={{
                                background: '#fafbfc',
                                border: '1px solid #e2e8f0',
                                borderRadius: 10,
                                padding: 12,
                                maxHeight: 180,
                                overflowY: 'auto'
                            }}>
                                {sellers.length === 0 ? (
                                    <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12, padding: 20 }}>
                                        No sellers available
                                    </div>
                                ) : (
                                    sellers.map(seller => (
                                        <div key={seller._id} style={{ marginBottom: 8 }}>
                                            <Checkbox
                                                checked={memberForm.resourceAccess.includes(seller._id)}
                                                onChange={e => {
                                                    const checked = e.target.checked;
                                                    setMemberForm(prev => ({
                                                        ...prev,
                                                        resourceAccess: checked
                                                            ? [...prev.resourceAccess, seller._id]
                                                            : prev.resourceAccess.filter(id => id !== seller._id)
                                                    }));
                                                }}
                                            >
                                                <span style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>
                                                    {seller.name}
                                                </span>
                                            </Checkbox>
                                        </div>
                                    ))
                                )}
                            </div>
                            <div style={{
                                marginTop: 6,
                                fontSize: 10,
                                color: '#64748b',
                                fontWeight: 500,
                                fontStyle: 'italic'
                            }}>
                                💡 Leave empty to grant access to all team resources
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <Button
                                onClick={() => setAddMemberModal(false)}
                                style={{ borderRadius: 10, fontWeight: 600 }}
                            >
                                Cancel
                            </Button>
                            <button
                                onClick={handleAddMember}
                                disabled={saving}
                                style={{
                                    padding: '6px 18px',
                                    background: saving ? '#cbd5e1' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: 10,
                                    fontSize: 13,
                                    fontWeight: 700,
                                    cursor: saving ? 'wait' : 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    boxShadow: saving ? 'none' : '0 4px 12px -2px rgba(16, 185, 129, 0.4)'
                                }}
                            >
                                {saving ? <Loader2 size={14} className="spin-animation" /> : <UserPlus size={14} strokeWidth={2.5} />}
                                {saving ? 'Adding...' : 'Add Member'}
                            </button>
                        </div>
                    </div>
                </Modal>

                {/* ═══════════════════════════════════════════════════
                    STYLES
                ═══════════════════════════════════════════════════ */}
                <style>{`
                    .team-hub-container {
                        background: #fafbfc;
                        height: calc(100vh - 60px);
                        overflow: hidden;
                    }
                    .team-card-item:hover {
                        background: #f8fafc !important;
                        border-color: #cbd5e1 !important;
                        transform: translateX(2px);
                    }
                    .team-card-item.active:hover {
                        background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%) !important;
                    }
                    .member-row-premium:hover {
                        transform: translateY(-1px);
                        box-shadow: 0 8px 16px -4px rgba(0, 0, 0, 0.06);
                        border-color: #cbd5e1 !important;
                    }
                    .member-action-btn:hover {
                        background: #f8fafc !important;
                        border-color: #cbd5e1 !important;
                        transform: scale(1.05);
                    }
                    .member-action-btn.danger:hover {
                        background: #fef2f2 !important;
                        border-color: #fecaca !important;
                    }
                    .header-btn-default:hover {
                        background: #f8fafc !important;
                        border-color: #cbd5e1 !important;
                    }
                    .header-btn-primary:hover,
                    .create-team-btn:hover {
                        transform: translateY(-1px);
                        box-shadow: 0 6px 16px -2px rgba(99, 102, 241, 0.5) !important;
                    }
                    .member-search-input:focus {
                        border-color: #6366f1 !important;
                        box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1) !important;
                    }
                    .member-search-input:hover {
                        border-color: #cbd5e1 !important;
                    }
                    .premium-tabs .ant-tabs-tab {
                        font-weight: 700 !important;
                        font-size: 12px !important;
                        padding: 12px 0 !important;
                    }
                    .premium-tabs .ant-tabs-tab-active {
                        color: #4f46e5 !important;
                    }
                    .premium-tabs .ant-tabs-ink-bar {
                        background: linear-gradient(90deg, #6366f1, #4f46e5) !important;
                        height: 3px !important;
                    }
                    @keyframes spin-animation {
                        to { transform: rotate(360deg); }
                    }
                    .spin-animation {
                        animation: spin-animation 1s linear infinite;
                    }
                    ::-webkit-scrollbar {
                        width: 6px;
                        height: 6px;
                    }
                    ::-webkit-scrollbar-track {
                        background: transparent;
                    }
                    ::-webkit-scrollbar-thumb {
                        background: #cbd5e1;
                        border-radius: 3px;
                    }
                    ::-webkit-scrollbar-thumb:hover {
                        background: #94a3b8;
                    }
                `}</style>
            </div>
        </ConfigProvider>
    );
};

export default TeamManagementPage;