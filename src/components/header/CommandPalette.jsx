import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from 'antd';
import {
  SearchOutlined,
  DashboardOutlined,
  LineChartOutlined,
  ShoppingOutlined,
  UserOutlined,
  SettingOutlined,
  FileTextOutlined,
  BellOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { useHeader } from '../../contexts/HeaderContext';
import { useKeyboardShortcut } from './headerHooks';

const CommandPalette = () => {
  const { cmdOpen, setCmdOpen } = useHeader();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  const commands = useMemo(() => [
    {
      id: 'nav-dashboard',
      title: 'Go to Dashboard',
      hint: 'View main operations overview',
      icon: <DashboardOutlined />,
      section: 'Navigation',
      keywords: ['dashboard', 'home', 'main'],
      action: () => navigate('/dashboard'),
    },
    {
      id: 'nav-asins',
      title: 'ASIN Manager',
      hint: 'Browse all tracked products',
      icon: <ShoppingOutlined />,
      section: 'Navigation',
      keywords: ['asin', 'product', 'catalog'],
      action: () => navigate('/asin-tracker'),
    },
    {
      id: 'nav-analytics',
      title: 'Open Analytics',
      hint: 'GMS, revenue, and performance reports',
      icon: <LineChartOutlined />,
      section: 'Navigation',
      keywords: ['analytics', 'gms', 'report'],
      action: () => navigate('/gms-tracker'),
    },
    {
      id: 'nav-tasks',
      title: 'View Tasks',
      hint: 'Check pending actions and workflows',
      icon: <BellOutlined />,
      section: 'Navigation',
      keywords: ['tasks', 'actions', 'workflow'],
      action: () => navigate('/tasks'),
    },
    {
      id: 'action-sync',
      title: 'Sync data now',
      hint: 'Pull latest data from all sources',
      icon: <BellOutlined />,
      section: 'Actions',
      keywords: ['sync', 'refresh', 'update'],
      action: () => console.log('Trigger sync'),
    },
    {
      id: 'action-export',
      title: 'Export report',
      hint: 'Download current view as CSV/PDF',
      icon: <FileTextOutlined />,
      section: 'Actions',
      keywords: ['export', 'download', 'csv', 'pdf'],
      action: () => console.log('Export'),
    },
    {
      id: 'settings-profile',
      title: 'Profile settings',
      hint: 'Edit account & preferences',
      icon: <UserOutlined />,
      section: 'Settings',
      keywords: ['profile', 'account', 'settings'],
      action: () => navigate('/profile'),
    },
    {
      id: 'settings-workspace',
      title: 'Workspace settings',
      hint: 'Manage team & integrations',
      icon: <SettingOutlined />,
      section: 'Settings',
      keywords: ['workspace', 'team', 'integrations'],
      action: () => navigate('/settings'),
    },
  ], [navigate]);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase().trim();
    return commands.filter((cmd) =>
      [cmd.title, ...cmd.keywords].some((k) => k.toLowerCase().includes(q))
    );
  }, [commands, query]);

  const grouped = useMemo(() => {
    const map = new Map();
    filtered.forEach((cmd) => {
      const arr = map.get(cmd.section) || [];
      arr.push(cmd);
      map.set(cmd.section, arr);
    });
    return Array.from(map.entries());
  }, [filtered]);

  useEffect(() => {
    if (cmdOpen) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [cmdOpen]);

  useKeyboardShortcut(['arrowdown'], (e) => {
    if (!cmdOpen) return;
    e.preventDefault();
    setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
  });

  useKeyboardShortcut(['arrowup'], (e) => {
    if (!cmdOpen) return;
    e.preventDefault();
    setActiveIndex((i) => Math.max(i - 1, 0));
  });

  useKeyboardShortcut(['enter'], () => {
    if (!cmdOpen || !filtered[activeIndex]) return;
    filtered[activeIndex].action();
    setCmdOpen(false);
  });

  useKeyboardShortcut(['escape'], () => {
    if (cmdOpen) setCmdOpen(false);
  });

  const handleSelect = (cmd) => {
    cmd.action();
    setCmdOpen(false);
  };

  let runningIndex = 0;

  return (
    <Modal
      open={cmdOpen}
      onCancel={() => setCmdOpen(false)}
      footer={null}
      closable={false}
      width={620}
      centered
      destroyOnClose
      className="cmd-palette-modal"
      maskStyle={{
        background: 'rgba(18,27,30,0.45)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div className="cmd-palette-input-wrap">
        <SearchOutlined style={{ fontSize: '17px', color: '#8c8e8f' }} />
        <input
          ref={inputRef}
          className="cmd-palette-input"
          placeholder="Type a command, search ASIN, or navigate..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
          }}
        />
        <button
          onClick={() => setCmdOpen(false)}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: '#8c8e8f',
            padding: '4px',
          }}
        >
          <CloseOutlined style={{ fontSize: '14px' }} />
        </button>
      </div>

      <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
        {grouped.length === 0 ? (
          <div
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: '#8c8e8f',
              fontSize: '13px',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            No results found for <strong>"{query}"</strong>
          </div>
        ) : (
          grouped.map(([section, items]) => (
            <div key={section}>
              <div className="cmd-palette-section-label">{section}</div>
              {items.map((cmd) => {
                const isActive = runningIndex === activeIndex;
                const myIndex = runningIndex++;
                return (
                  <div
                    key={cmd.id}
                    className={`cmd-palette-item ${isActive ? 'active' : ''}`}
                    onClick={() => handleSelect(cmd)}
                    onMouseEnter={() => setActiveIndex(myIndex)}
                  >
                    <div className="cmd-palette-item-icon">{cmd.icon}</div>
                    <div className="cmd-palette-item-content">
                      <div className="cmd-palette-item-title">{cmd.title}</div>
                      {cmd.hint && (
                        <div className="cmd-palette-item-hint">{cmd.hint}</div>
                      )}
                    </div>
                    {isActive && (
                      <span className="kbd-pill" style={{ fontSize: '9px' }}>
                        ↵
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      <div className="cmd-palette-footer">
        <span>
          {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
        </span>
        <div className="cmd-palette-footer-keys">
          <div className="cmd-palette-footer-key">
            <span className="kbd-pill">↑</span>
            <span className="kbd-pill">↓</span>
            <span>navigate</span>
          </div>
          <div className="cmd-palette-footer-key">
            <span className="kbd-pill">↵</span>
            <span>select</span>
          </div>
          <div className="cmd-palette-footer-key">
            <span className="kbd-pill">esc</span>
            <span>close</span>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default CommandPalette;
