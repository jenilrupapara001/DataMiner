import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
    Bell,
    Search,
    ChevronDown,
    Menu,
    Download
} from 'lucide-react';
import { useSidebar } from '../contexts/SidebarContext';
import { usePageTitle } from '../contexts/PageTitleContext';
import { useDateRange } from '../contexts/DateRangeContext';
import DateRangePicker from './common/DateRangePicker';
import { Dropdown } from './base/dropdown/dropdown';
import DownloadsDrawer from './common/DownloadsDrawer';
import './Header.css';

const Header = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { toggleMobile } = useSidebar();
    const { pageTitle } = usePageTitle();
    const { startDate, endDate, updateDateRange } = useDateRange();
    
    const [searchQuery, setSearchQuery] = useState('');
    const [isDownloadsOpen, setIsDownloadsOpen] = useState(false);
    const searchInputRef = useRef(null);

    const getInitials = (user) => {
        if (!user) return '??';
        if (user.fullName) return user.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
        const fallback = (user.firstName?.[0] || '') + (user.lastName?.[0] || user.firstName?.[1] || '');
        return fallback.toUpperCase() || (user.email?.[0] || 'U').toUpperCase();
    };

    // Shortcut for search and export event listener
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        };
        const handleExportStart = () => {
            setIsDownloadsOpen(true);
        };
        
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('export-started', handleExportStart);
        
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('export-started', handleExportStart);
        };
    }, []);

    return (
        <header className="topbar-redesign">
            {/* Left: Breadcrumb */}
            <div className="topbar-left">
                <span className="breadcrumb-workspace">Workspace</span>
                <span className="breadcrumb-separator">›</span>
                <span className="breadcrumb-page">{pageTitle || 'Dashboard'}</span>
            </div>

            {/* Center: Search Bar */}
            <div className="topbar-center">
                <div className="search-bar-wrapper">
                    <Search size={14} className="search-icon" />
                    <input
                        ref={searchInputRef}
                        type="text"
                        className="search-input"
                        placeholder="Search workspace..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <div className="command-badge">⌘K</div>
                </div>
            </div>

            {/* Right Side */}
            <div className="topbar-right">
                <DateRangePicker
                    startDate={startDate}
                    endDate={endDate}
                    onDateChange={(type, s, e) => updateDateRange({ startDate: s, endDate: e, rangeType: type })}
                />

                <div className="notification-wrapper d-flex align-items-center gap-2">
                    <button className="icon-button" onClick={() => setIsDownloadsOpen(true)} title="Downloads">
                        <Download size={16} />
                    </button>
                    <button className="icon-button">
                        <Bell size={16} />
                        <div className="notification-dot" />
                    </button>
                </div>

                <div className="header-user-profile" onClick={() => navigate('/profile')}>
                    <div className="header-user-details text-end me-3 d-none d-md-block">
                        <div className="header-user-name fw-semibold" style={{ fontSize: '13px', color: '#1f2937' }}>
                            {user?.fullName || 'User'}
                        </div>
                        <div className="header-user-role" style={{ fontSize: '11px', color: '#6b7280', textTransform: 'capitalize' }}>
                            {user?.role?.displayName || user?.role?.name || 'User'}
                        </div>
                    </div>
                    <div className="user-avatar-top">
                        {getInitials(user)}
                        <div className="user-status-indicator" />
                    </div>
                </div>
            </div>
            
            <DownloadsDrawer isOpen={isDownloadsOpen} onClose={() => setIsDownloadsOpen(false)} />
        </header>
    );
};

export default Header;