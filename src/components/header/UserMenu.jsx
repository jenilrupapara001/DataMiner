import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Dropdown, Avatar } from 'antd';
import {
  UserOutlined,
  SettingOutlined,
  LogoutOutlined,
  TeamOutlined,
  QuestionCircleOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import { useAuth } from '../../contexts/AuthContext';

const getInitials = (user) => {
  if (!user) return 'U';
  if (user.fullName?.trim()) {
    return user.fullName
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }
  const first = user.firstName?.[0] || '';
  const second = user.lastName?.[0] || user.firstName?.[1] || '';
  return (first + second).toUpperCase() || (user.email?.[0] || 'U').toUpperCase();
};

const UserMenu = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const initials = getInitials(user);
  const displayName = user?.fullName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'User';
  const roleName = user?.role?.displayName || user?.role?.name || 'User';
  const email = user?.email || '';

  const menuItems = [
    {
      key: 'user-info',
      label: (
        <div
          style={{
            padding: '8px 4px 12px',
            borderBottom: '1px solid #F1F5F9',
            marginBottom: '4px',
            minWidth: '240px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Avatar
              size={40}
              style={{
                background: 'linear-gradient(135deg, #1565C0, #1976D2)',
                fontSize: '14px',
                fontWeight: 700,
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {initials}
            </Avatar>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#0F172A',
                  fontFamily: 'Inter, sans-serif',
                  letterSpacing: '-0.2px',
                }}
              >
                {displayName}
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: '#94A3B8',
                  fontFamily: 'Inter, sans-serif',
                  marginTop: '1px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {email}
              </div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  marginTop: '4px',
                  padding: '1px 6px',
                  background: '#E3F2FD',
                  border: '1px solid #90CAF9',
                  borderRadius: '100px',
                  fontSize: '9.5px',
                  fontWeight: 700,
                  color: '#1565C0',
                  fontFamily: 'Inter, sans-serif',
                  letterSpacing: '0.02em',
                }}
              >
                <div
                  style={{
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    background: '#1976D2',
                  }}
                />
                {roleName}
              </div>
            </div>
          </div>
        </div>
      ),
      disabled: true,
    },
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'My Profile',
      onClick: () => navigate('/profile'),
    },
    {
      key: 'team',
      icon: <TeamOutlined />,
      label: 'Team & Workspace',
      onClick: () => navigate('/team-management'),
    },
    { type: 'divider' },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Settings',
      onClick: () => navigate('/settings'),
    },
    {
      key: 'shortcuts',
      icon: <KeyOutlined />,
      label: (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <span>Keyboard shortcuts</span>
          <span className="kbd-pill" style={{ fontSize: '9px' }}>
            ?
          </span>
        </div>
      ),
      onClick: () => {},
    },
    {
      key: 'help',
      icon: <QuestionCircleOutlined />,
      label: 'Help & Support',
      onClick: () => window.open('https://opencode.ai', '_blank'),
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Sign out',
      danger: true,
      onClick: () => logout && logout(),
    },
  ];

  return (
    <Dropdown
      menu={{ items: menuItems }}
      placement="bottomRight"
      trigger={['click']}
      styles={{ root: { minWidth: '260px' } }}
    >
      <button className="user-avatar-trigger" aria-label="User menu">
        <Avatar
          size={28}
          style={{
            background: 'linear-gradient(135deg, #1565C0, #1976D2)',
            fontSize: '11px',
            fontWeight: 700,
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {initials}
        </Avatar>
        <div className="user-avatar-info">
          <span className="user-avatar-name">{displayName.split(' ')[0]}</span>
          <span className="user-avatar-role">{roleName}</span>
        </div>
      </button>
    </Dropdown>
  );
};

export default UserMenu;
