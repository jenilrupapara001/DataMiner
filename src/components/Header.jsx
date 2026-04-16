import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
    Bell,
    Search,
    ChevronDown,
    Menu
} from 'lucide-react';
import { useSidebar } from '../contexts/SidebarContext';
import { usePageTitle } from '../contexts/PageTitleContext';
import { useDateRange } from '../contexts/DateRangeContext';
import DateRangePicker from './common/DateRangePicker';
import { Dropdown } from './base/dropdown/dropdown';
import './Header.css';

const Header = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { toggleMobile } = useSidebar();
    const { pageTitle } = usePageTitle();
    const { startDate, endDate, updateDateRange } = useDateRange();
    
    const [searchQuery, setSearchQuery] = useState('');
    const searchInputRef = useRef(null);

    const getInitials = (name) => {
        if (!name) return 'JR';
        return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    };

    // Shortcut for search
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
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

                <div className="notification-wrapper">
                    <button className="icon-button">
                        <Bell size={16} />
                        <div className="notification-dot" />
                    </button>
                </div>

                <div className="user-avatar-top" onClick={() => navigate('/profile')}>
                    {getInitials(user?.fullName)}
                </div>
            </div>
        </header>
    );
};

export default Header;