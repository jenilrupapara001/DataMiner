import React, { useState, useEffect, useCallback } from 'react';
import {
  Layout, Menu, Button, Typography, Avatar, Tag, Table, Space,
  Modal, Form, Input, Select, Checkbox, Tooltip, Badge, Popconfirm,
  Spin, Empty, Divider, Card, Statistic, Row, Col, message as antdMessage,
  Tabs, Drawer, Result
} from 'antd';
import {
  TeamOutlined, UserAddOutlined, SettingOutlined, PlusOutlined,
  DeleteOutlined, EditOutlined, LockOutlined, EyeOutlined,
  CrownOutlined, UserOutlined, MailOutlined, BankOutlined,
  AppstoreOutlined, ThunderboltOutlined, SafetyOutlined,
  CheckCircleOutlined, SearchOutlined
} from '@ant-design/icons';
import api, { userApi } from '../services/api';

const { Sider, Content } = Layout;
const { Text, Paragraph } = Typography;
const { TextArea } = Input;

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  '#4f46e5', '#0891b2', '#059669', '#d97706',
  '#dc2626', '#9333ea', '#db2777', '#0284c7'
];
function avatarColor(str = '') {
  const hash = str.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
function initials(name = '') {
  const parts = name.trim().split(' ');
  return (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
}

// ─────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────
const TeamManagementPage = () => {
  const [messageApi, contextHolder] = antdMessage.useMessage();

  // ── State ──────────────────────────────────────────────────────
  const [teams, setTeams] = useState([]);
  const [activeTeam, setActiveTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [searchText, setSearchText] = useState('');

  // ── Modals ─────────────────────────────────────────────────────
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [editTeamOpen, setEditTeamOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [editMemberOpen, setEditMemberOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null); // holds member being edited

  // ── Forms ──────────────────────────────────────────────────────
  const [teamForm] = Form.useForm();
  const [memberForm] = Form.useForm();
  const [editMemberForm] = Form.useForm();

  // ── Data Fetching ──────────────────────────────────────────────
  const fetchSellers = useCallback(async () => {
    try {
      const res = await api.get('/sellers');
      const d = res.data?.sellers || res.data || [];
      setSellers(Array.isArray(d) ? d : []);
    } catch { /* silent */ }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await userApi.getAll({ limit: 100 });
      const d = res.data?.users || res.data || res || [];
      setAvailableUsers(Array.isArray(d) ? d : []);
    } catch { /* silent */ }
  }, []);

  const fetchTeams = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/teams');
      // Backend returns { success, count, data: [...] } with SQL PascalCase fields
      const raw = res.data?.data || res.data || [];
      const data = raw.map(t => ({ ...t, _id: t.Id || t._id, name: t.Name || t.name, description: t.Description || t.description }));
      setTeams(data);
      if (data.length > 0) setActiveTeam(prev => prev ? (data.find(t => t._id === prev._id) || data[0]) : data[0]);
    } catch {
      messageApi.error('Failed to load teams');
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  const fetchMembers = useCallback(async (teamId) => {
    try {
      setMembersLoading(true);
      const res = await api.get(`/teams/${teamId}/members`);
      // Backend returns { success, count, data: [...] } with flat member objects
      const raw = res.data?.data || res.data || [];
      const data = raw.map(m => ({
        ...m,
        _id: m._id || m.Id || m.UserId,
        firstName: m.firstName || m.FirstName,
        lastName: m.lastName || m.LastName,
        email: m.email || m.Email,
        teamRole: m.teamRole || m.Role,
        resourceAccess: m.resourceAccess || []
      }));
      setMembers(data);
    } catch {
      messageApi.error('Failed to load members');
    } finally {
      setMembersLoading(false);
    }
  }, [messageApi]);

  useEffect(() => {
    fetchTeams();
    fetchSellers();
    fetchUsers();
  }, [fetchTeams, fetchSellers, fetchUsers]);

  useEffect(() => {
    if (activeTeam?._id) fetchMembers(activeTeam._id);
  }, [activeTeam, fetchMembers]);

  // ── Handlers ───────────────────────────────────────────────────
  const handleCreateTeam = async () => {
    try {
      const values = await teamForm.validateFields();
      setSaving(true);
      const res = await api.post('/teams', values);
      const raw = res.data?.data || res.data;
      const newTeam = { ...raw, _id: raw.Id || raw._id, name: raw.Name || raw.name, description: raw.Description || raw.description };
      setTeams(prev => [...prev, newTeam]);
      setActiveTeam(newTeam);
      setCreateTeamOpen(false);
      teamForm.resetFields();
      messageApi.success('Team created successfully');
    } catch (err) {
      if (err?.errorFields) return;
      messageApi.error(err?.response?.data?.message || 'Failed to create team');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateTeam = async () => {
    try {
      const values = await teamForm.validateFields();
      setSaving(true);
      const res = await api.put(`/teams/${activeTeam._id}`, values);
      const raw = res.data?.data || res.data;
      const updated = { ...raw, _id: raw.Id || raw._id, name: raw.Name || raw.name, description: raw.Description || raw.description };
      setTeams(prev => prev.map(t => t._id === updated._id ? updated : t));
      setActiveTeam(updated);
      setEditTeamOpen(false);
      messageApi.success('Team updated successfully');
    } catch (err) {
      if (err?.errorFields) return;
      messageApi.error(err?.response?.data?.message || 'Failed to update team');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTeam = async () => {
    try {
      setDeleting(true);
      await api.delete(`/teams/${activeTeam._id}`);
      const updated = teams.filter(t => t._id !== activeTeam._id);
      setTeams(updated);
      setActiveTeam(updated[0] || null);
      setMembers([]);
      setEditTeamOpen(false);
      messageApi.success('Team deleted successfully');
    } catch (err) {
      messageApi.error(err?.response?.data?.message || 'Failed to delete team');
    } finally {
      setDeleting(false);
    }
  };

  const handleAddMember = async () => {
    try {
      const values = await memberForm.validateFields();
      setSaving(true);
      await api.post(`/teams/${activeTeam._id}/members`, {
        userId: values.userId,
        role: values.role || 'member',
        resourceAccess: values.resourceAccess || []
      });
      fetchMembers(activeTeam._id);
      setAddMemberOpen(false);
      memberForm.resetFields();
      messageApi.success('Member added successfully');
    } catch (err) {
      if (err?.errorFields) return;
      messageApi.error(err?.response?.data?.message || 'Failed to add member');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEditMember = (member) => {
    setSelectedMember(member);
    setEditMemberOpen(true);
  };

  const handleSaveMember = async () => {
    try {
      const values = await editMemberForm.validateFields();
      setSaving(true);
      const memberId = selectedMember?._id || selectedMember?.Id || selectedMember?.UserId;
      await api.put(`/teams/${activeTeam._id}/members/${memberId}`, {
        role: values.role,
        resourceAccess: values.resourceAccess || []
      });
      fetchMembers(activeTeam._id);
      setEditMemberOpen(false);
      setSelectedMember(null);
      messageApi.success('Member updated');
    } catch (err) {
      if (err?.errorFields) return;
      messageApi.error(err?.response?.data?.message || 'Failed to update member');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    try {
      await api.delete(`/teams/${activeTeam._id}/members/${userId}`);
      fetchMembers(activeTeam._id);
      messageApi.success('Member removed');
    } catch (err) {
      messageApi.error(err?.response?.data?.message || 'Failed to remove member');
    }
  };

  // ── Derived Data ───────────────────────────────────────────────
  const filteredMembers = members.filter(m => {
    const firstName = m.firstName || m.FirstName || m.user?.firstName || '';
    const lastName = m.lastName || m.LastName || m.user?.lastName || '';
    const email = m.email || m.Email || m.user?.email || '';
    const name = `${firstName} ${lastName}`.toLowerCase();
    return name.includes(searchText.toLowerCase()) || email.toLowerCase().includes(searchText.toLowerCase());
  });

  const teamLeads = members.filter(m => (m.teamRole || m.role) === 'lead').length;
  const sellersCount = sellers.length;

  // ── Table Columns ──────────────────────────────────────────────
  const memberColumns = [
    {
      title: 'Member',
      dataIndex: 'user',
      key: 'name',
      render: (_, record) => {
        const u = record.user || record;
        const firstName = u.firstName || u.FirstName || '';
        const lastName = u.lastName || u.LastName || '';
        const fullName = `${firstName} ${lastName}`.trim() || 'Unknown';
        const email = u.email || u.Email || record.email || record.Email || '—';
        return (
          <Space>
            <Avatar
              size={36}
              style={{ background: avatarColor(fullName), fontWeight: 700, fontSize: 13 }}
            >
              {initials(fullName).toUpperCase() || '?'}
            </Avatar>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>{fullName}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                <MailOutlined style={{ marginRight: 4 }} />{email}
              </div>
            </div>
          </Space>
        );
      }
    },
    {
      title: 'Role',
      key: 'role',
      width: 130,
      render: (_, record) => {
        const role = record.teamRole || record.role || 'member';
        return role === 'lead'
          ? <Tag icon={<CrownOutlined />} color="gold">Team Lead</Tag>
          : <Tag icon={<UserOutlined />} color="blue">Member</Tag>;
      }
    },
    {
      title: 'Resource Access',
      key: 'access',
      width: 160,
      render: (_, record) => {
        const access = record.resourceAccess || [];
        return access.length === 0
          ? <Tag icon={<EyeOutlined />} color="green">Full Access</Tag>
          : (
            <Tooltip title={access.map(r => r?.name || r).join(', ')}>
              <Tag icon={<LockOutlined />} color="orange">{access.length} Sellers</Tag>
            </Tooltip>
          );
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      align: 'right',
      render: (_, record) => {
        const memberId = record._id || record.Id || record.UserId;
        return (
          <Space>
            <Tooltip title="Edit Access">
              <Button
                type="text"
                icon={<EditOutlined />}
                size="small"
                style={{ color: '#4f46e5' }}
                onClick={() => handleOpenEditMember(record)}
              />
            </Tooltip>
            <Popconfirm
              title="Remove this member?"
              okText="Remove"
              okButtonProps={{ danger: true }}
              onConfirm={() => handleRemoveMember(memberId)}
            >
              <Tooltip title="Remove">
                <Button type="text" icon={<DeleteOutlined />} size="small" danger />
              </Tooltip>
            </Popconfirm>
          </Space>
        );
      }
    }
  ];

  // ── Sidebar Team Menu ──────────────────────────────────────────
  const sidebarItems = teams.map(team => ({
    key: team._id,
    label: (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Avatar
          size={28}
          style={{ background: avatarColor(team.name || team._id), fontWeight: 700, fontSize: 11, flexShrink: 0 }}
        >
          {initials(team.name || 'T').toUpperCase() || 'T'}
        </Avatar>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 12, color: activeTeam?._id === team._id ? '#4f46e5' : '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
            {team.name || 'Unnamed Team'}
          </div>
          <div style={{ fontSize: 10, color: '#94a3b8' }}>{team._memberCount || 0} members</div>
        </div>
      </div>
    )
  }));

  // ─── Render ───────────────────────────────────────────────────
  return (
    <div style={{ height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
      {contextHolder}
      <Layout style={{ height: '100%', background: 'transparent' }}>

        {/* ── Sidebar ── */}
        <Sider
          width={230}
          style={{
            background: '#ffffff',
            borderRight: '1px solid #e2e8f0',
            overflowY: 'auto',
            height: '100%'
          }}
        >
          <div style={{ padding: '16px 14px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ fontWeight: 700, fontSize: 11, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Teams
              </Text>
              <Tooltip title="Create Team">
                <Button
                  type="primary"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => { teamForm.resetFields(); setCreateTeamOpen(true); }}
                  style={{ borderRadius: 6, background: '#4f46e5', borderColor: '#4f46e5', padding: '0 8px' }}
                />
              </Tooltip>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', paddingTop: 32 }}><Spin /></div>
            ) : teams.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={<span style={{ fontSize: 11 }}>No teams yet</span>}
                style={{ paddingTop: 20 }}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {teams.map(team => (
                  <div
                    key={team._id}
                    onClick={() => setActiveTeam(team)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 10px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      background: activeTeam?._id === team._id ? '#eef2ff' : 'transparent',
                      border: activeTeam?._id === team._id ? '1px solid #c7d2fe' : '1px solid transparent',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Avatar
                      size={32}
                      style={{ background: avatarColor(team.name || team._id), fontWeight: 700, fontSize: 12, flexShrink: 0 }}
                    >
                      {(initials(team.name || 'T').toUpperCase() || 'T')[0]}
                    </Avatar>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 12.5, color: activeTeam?._id === team._id ? '#4f46e5' : '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {team.name || 'Unnamed Team'}
                      </div>
                      <div style={{ fontSize: 10.5, color: '#94a3b8' }}>
                        <TeamOutlined style={{ marginRight: 3 }} />
                        {team._memberCount !== undefined ? team._memberCount : '—'} members
                      </div>
                    </div>
                    {activeTeam?._id === team._id && (
                      <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#4f46e5', flexShrink: 0 }} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Sider>

        {/* ── Main Content ── */}
        <Content style={{ overflowY: 'auto', padding: '24px 28px', background: '#f8fafc' }}>
          {!activeTeam ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <Result
                icon={<TeamOutlined style={{ color: '#4f46e5' }} />}
                title="Select or Create a Team"
                subTitle="Choose a team from the sidebar or create a new one to get started."
                extra={
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => { teamForm.resetFields(); setCreateTeamOpen(true); }}
                    style={{ background: '#4f46e5', borderColor: '#4f46e5', borderRadius: 8, fontWeight: 600 }}
                  >
                    Create Team
                  </Button>
                }
              />
            </div>
          ) : (
            <>
              {/* ── Team Header ── */}
              <Card
                bordered={false}
                style={{ borderRadius: 12, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' }}
                styles={{ body: { padding: '20px 24px' } }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                  <Space size={16} align="start">
                    <Avatar
                      size={52}
                      style={{
                        background: avatarColor(activeTeam.name || activeTeam._id),
                        fontWeight: 800,
                        fontSize: 20,
                        flexShrink: 0
                      }}
                    >
                      {(initials(activeTeam.name || 'T').toUpperCase() || 'T')}
                    </Avatar>
                    <div>
                      <Space align="center">
                        <Tag color="success" icon={<CheckCircleOutlined />}>Active</Tag>
                      </Space>
                      <Paragraph type="secondary" style={{ margin: '4px 0 0 0', fontSize: 13 }}>
                        {activeTeam.description || 'No description provided.'}
                      </Paragraph>
                    </div>
                  </Space>

                  <Space>
                    <Button
                      icon={<SettingOutlined />}
                      onClick={() => {
                        teamForm.setFieldsValue({
                          name: activeTeam.name || '',
                          description: activeTeam.description || ''
                        });
                        setEditTeamOpen(true);
                      }}
                      style={{ borderRadius: 8, fontWeight: 600 }}
                    >
                      Team Settings
                    </Button>
                    <Button
                      type="primary"
                      icon={<UserAddOutlined />}
                      onClick={() => { memberForm.resetFields(); setAddMemberOpen(true); }}
                      style={{ borderRadius: 8, fontWeight: 700, background: '#4f46e5', borderColor: '#4f46e5' }}
                    >
                      Add Member
                    </Button>
                  </Space>
                </div>

                {/* Stats Row */}
                <Divider style={{ margin: '16px 0' }} />
                <Row gutter={16}>
                  <Col span={6}>
                    <Statistic
                      title={<span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Members</span>}
                      value={members.length}
                      prefix={<TeamOutlined style={{ color: '#4f46e5', marginRight: 4 }} />}
                      valueStyle={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title={<span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Team Leads</span>}
                      value={teamLeads}
                      prefix={<CrownOutlined style={{ color: '#f59e0b', marginRight: 4 }} />}
                      valueStyle={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title={<span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Operators</span>}
                      value={members.length - teamLeads}
                      prefix={<UserOutlined style={{ color: '#10b981', marginRight: 4 }} />}
                      valueStyle={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title={<span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sellers Mapped</span>}
                      value={sellersCount}
                      prefix={<BankOutlined style={{ color: '#0891b2', marginRight: 4 }} />}
                      valueStyle={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}
                    />
                  </Col>
                </Row>
              </Card>

              {/* ── Members Table ── */}
              <Card
                bordered={false}
                style={{ borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' }}
                styles={{ body: { padding: 0 } }}
              >
                {/* Table Header */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text strong style={{ fontSize: 14, color: '#0f172a' }}>
                    <TeamOutlined style={{ marginRight: 8, color: '#4f46e5' }} />
                    Members ({members.length})
                  </Text>
                  <Input
                    prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                    placeholder="Search by name or email..."
                    value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                    allowClear
                    style={{ width: 240, borderRadius: 8 }}
                  />
                </div>

                <Table
                  columns={memberColumns}
                  dataSource={filteredMembers}
                  rowKey={r => r._id || r.user?._id || Math.random()}
                  loading={membersLoading}
                  pagination={false}
                  locale={{ emptyText: <Empty description="No members in this team" style={{ padding: 32 }} /> }}
                  style={{ borderRadius: 12 }}
                />
              </Card>
            </>
          )}
        </Content>
      </Layout>

      {/* ════════════════════════════════════════════════════════
          CREATE TEAM MODAL
      ════════════════════════════════════════════════════════ */}
      <Modal
        open={createTeamOpen}
        onCancel={() => { setCreateTeamOpen(false); teamForm.resetFields(); }}
        onOk={handleCreateTeam}
        okText="Create Team"
        confirmLoading={saving}
        okButtonProps={{ style: { background: '#4f46e5', borderColor: '#4f46e5', borderRadius: 8, fontWeight: 700 } }}
        cancelButtonProps={{ style: { borderRadius: 8 } }}
        title={
          <Space>
            <Avatar size={32} style={{ background: '#4f46e5' }} icon={<TeamOutlined />} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 14 }}>Create New Team</div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 400 }}>Set up a new operational workspace team</div>
            </div>
          </Space>
        }
        width={480}
        centered
        destroyOnHidden
      >
        <Form form={teamForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label={<span style={{ fontWeight: 600, color: '#374151' }}>Team Name</span>}
            rules={[{ required: true, message: 'Team name is required' }]}
          >
            <Input
              prefix={<TeamOutlined style={{ color: '#94a3b8' }} />}
              placeholder="e.g. Amazon SEO Ops"
              style={{ borderRadius: 8, height: 40 }}
            />
          </Form.Item>
          <Form.Item
            name="description"
            label={<span style={{ fontWeight: 600, color: '#374151' }}>Description</span>}
          >
            <TextArea
              placeholder="Describe team responsibilities..."
              rows={3}
              style={{ borderRadius: 8 }}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* ════════════════════════════════════════════════════════
          EDIT TEAM MODAL (Settings + Delete)
      ════════════════════════════════════════════════════════ */}
      <Modal
        open={editTeamOpen}
        onCancel={() => { setEditTeamOpen(false); }}
        footer={null}
        title={
          <Space>
            <Avatar size={32} style={{ background: '#0891b2' }} icon={<SettingOutlined />} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 14 }}>Team Settings</div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 400 }}>Modify team name, description, or delete</div>
            </div>
          </Space>
        }
        width={480}
        centered
        destroyOnHidden
      >
        <Form form={teamForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label={<span style={{ fontWeight: 600, color: '#374151' }}>Team Name</span>}
            rules={[{ required: true, message: 'Team name is required' }]}
          >
            <Input
              prefix={<TeamOutlined style={{ color: '#94a3b8' }} />}
              placeholder="Team name"
              style={{ borderRadius: 8, height: 40 }}
            />
          </Form.Item>
          <Form.Item
            name="description"
            label={<span style={{ fontWeight: 600, color: '#374151' }}>Description</span>}
          >
            <TextArea
              placeholder="Describe team responsibilities..."
              rows={3}
              style={{ borderRadius: 8 }}
            />
          </Form.Item>
        </Form>

        <Divider style={{ margin: '12px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Popconfirm
            title="Delete this team?"
            description="This will permanently remove the team and all its members."
            okText="Delete"
            cancelText="Cancel"
            okButtonProps={{ danger: true, loading: deleting }}
            onConfirm={handleDeleteTeam}
          >
            <Button danger icon={<DeleteOutlined />} loading={deleting} style={{ borderRadius: 8 }}>
              Delete Team
            </Button>
          </Popconfirm>

          <Space>
            <Button onClick={() => setEditTeamOpen(false)} style={{ borderRadius: 8 }}>Cancel</Button>
            <Button
              type="primary"
              loading={saving}
              onClick={handleUpdateTeam}
              style={{ borderRadius: 8, fontWeight: 700, background: '#4f46e5', borderColor: '#4f46e5' }}
            >
              Save Changes
            </Button>
          </Space>
        </div>
      </Modal>

      {/* ════════════════════════════════════════════════════════
          ADD MEMBER MODAL
      ════════════════════════════════════════════════════════ */}
      <Modal
        open={addMemberOpen}
        onCancel={() => { setAddMemberOpen(false); memberForm.resetFields(); }}
        onOk={handleAddMember}
        okText="Add Member"
        confirmLoading={saving}
        okButtonProps={{ style: { background: '#059669', borderColor: '#059669', borderRadius: 8, fontWeight: 700 } }}
        cancelButtonProps={{ style: { borderRadius: 8 } }}
        title={
          <Space>
            <Avatar size={32} style={{ background: '#059669' }} icon={<UserAddOutlined />} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 14 }}>Add Team Member</div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 400 }}>Add a platform user to this team</div>
            </div>
          </Space>
        }
        width={500}
        centered
        destroyOnHidden
      >
        <Form form={memberForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="userId"
            label={<span style={{ fontWeight: 600, color: '#374151' }}>Select User</span>}
            rules={[{ required: true, message: 'Please select a user' }]}
          >
            <Select
              showSearch
              placeholder="Search users..."
              optionFilterProp="label"
              style={{ borderRadius: 8 }}
              options={availableUsers.map(u => ({
                value: u._id,
                label: `${u.firstName || ''} ${u.lastName || ''} (${u.email})`,
                key: u._id
              }))}
              suffixIcon={<SearchOutlined />}
            />
          </Form.Item>

          <Form.Item
            name="role"
            label={<span style={{ fontWeight: 600, color: '#374151' }}>Team Role</span>}
            initialValue="member"
          >
            <Select style={{ borderRadius: 8 }}>
              <Select.Option value="member">
                <Space><UserOutlined style={{ color: '#4f46e5' }} />Member</Space>
              </Select.Option>
              <Select.Option value="lead">
                <Space><CrownOutlined style={{ color: '#f59e0b' }} />Team Lead</Space>
              </Select.Option>
            </Select>
          </Form.Item>

          {sellers.length > 0 && (
            <Form.Item
              name="resourceAccess"
              label={
                <div>
                  <span style={{ fontWeight: 600, color: '#374151' }}>Seller Access</span>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>Leave empty to grant full access to all sellers</div>
                </div>
              }
            >
              <Checkbox.Group style={{ width: '100%' }}>
                <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {sellers.map(s => (
                    <Checkbox key={s._id} value={s._id}>
                      <span style={{ fontSize: 12, fontWeight: 500 }}>{s.name}</span>
                    </Checkbox>
                  ))}
                </div>
              </Checkbox.Group>
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* ════════════════════════════════════════════════════════
          EDIT MEMBER MODAL
      ════════════════════════════════════════════════════════ */}
      <Modal
        open={editMemberOpen}
        onCancel={() => { setEditMemberOpen(false); setSelectedMember(null); editMemberForm.resetFields(); }}
        onOk={handleSaveMember}
        okText="Save Changes"
        confirmLoading={saving}
        okButtonProps={{ style: { background: '#4f46e5', borderColor: '#4f46e5', borderRadius: 8, fontWeight: 700 } }}
        cancelButtonProps={{ style: { borderRadius: 8 } }}
        title={
          <Space>
            <Avatar size={32} style={{ background: '#4f46e5' }} icon={<EditOutlined />} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 14 }}>Edit Member Access</div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 400 }}>
                {selectedMember ? `${selectedMember.firstName || selectedMember.FirstName || ''} ${selectedMember.lastName || selectedMember.LastName || ''}`.trim() || 'Member' : 'Member'}
              </div>
            </div>
          </Space>
        }
        width={500}
        centered
        destroyOnHidden={false}
      >
        <Form
          form={editMemberForm}
          layout="vertical"
          style={{ marginTop: 16 }}
          key={selectedMember?._id || selectedMember?.Id}
          initialValues={{
            role: selectedMember?.teamRole || selectedMember?.Role || selectedMember?.role || 'member',
            resourceAccess: (selectedMember?.resourceAccess || []).map(r => (typeof r === 'object' ? r._id : r))
          }}
        >
          <Form.Item
            name="role"
            label={<span style={{ fontWeight: 600, color: '#374151' }}>Team Role</span>}
          >
            <Select style={{ borderRadius: 8 }}>
              <Select.Option value="member">
                <Space><UserOutlined style={{ color: '#4f46e5' }} />Member</Space>
              </Select.Option>
              <Select.Option value="lead">
                <Space><CrownOutlined style={{ color: '#f59e0b' }} />Team Lead</Space>
              </Select.Option>
            </Select>
          </Form.Item>

          {sellers.length > 0 && (
            <Form.Item
              name="resourceAccess"
              label={
                <div>
                  <span style={{ fontWeight: 600, color: '#374151' }}>Seller Access</span>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>Leave empty for full access</div>
                </div>
              }
            >
              <Checkbox.Group style={{ width: '100%' }}>
                <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {sellers.map(s => (
                    <Checkbox key={s._id} value={s._id}>
                      <span style={{ fontSize: 12, fontWeight: 500 }}>{s.name}</span>
                    </Checkbox>
                  ))}
                </div>
              </Checkbox.Group>
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default TeamManagementPage;