import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
    Bell,
    Search,
    MessageSquare,
    Info,
    Check,
    Menu,
    Package,
    Clock,
    ChevronDown
} from 'lucide-react';
import api from '../services/api';
import { useSocket } from '../contexts/SocketContext';
import { useSidebar } from '../contexts/SidebarContext';
import { usePageTitle } from '../contexts/PageTitleContext';
import { useDateRange } from '../contexts/DateRangeContext';
import DateRangePicker from './common/DateRangePicker';
import { DropdownButton } from './DropdownButton';
import { Dropdown } from './base/dropdown/dropdown';
import './Header.css';

const Header = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState(null);
    const [showResults, setShowResults] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());

    const searchRef = useRef(null);
    const searchInputRef = useRef(null);

    const socket = useSocket();
    const { toggleMobile, isMobile } = useSidebar();
    const { pageTitle } = usePageTitle();
    const { startDate, endDate, updateDateRange } = useDateRange();

    /* ---------------- TIME ---------------- */
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    /* ---------------- SCROLL EFFECT ---------------- */
    useEffect(() => {
        const handleScroll = () => {
            document.querySelector('.header-container-premium')
                ?.classList.toggle('scrolled', window.scrollY > 10);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    /* ---------------- SEARCH ---------------- */
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (searchRef.current && !searchRef.current.contains(e.target)) {
                setShowResults(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const delay = setTimeout(async () => {
            if (searchQuery.length >= 2) {
                try {
                    const res = await api.get(`/search?q=${searchQuery}`);
                    setSearchResults(res.data);
                    setShowResults(true);
                } catch (err) {
                    console.error(err);
                }
            } else {
                setShowResults(false);
            }
        }, 300);

        return () => clearTimeout(delay);
    }, [searchQuery]);

    /* ---------------- SHORTCUT ---------------- */
    useEffect(() => {
        const handleKey = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, []);

    /* ---------------- SOCKET ---------------- */
    useEffect(() => {
        if (!socket) return;
        socket.on('new-notification', ({ notification, unreadCount }) => {
            setNotifications(prev => [notification, ...prev].slice(0, 10));
            setUnreadCount(unreadCount);
        });
        return () => socket.off('new-notification');
    }, [socket]);

    const formatTime = (date) =>
        date.toLocaleString('en-US', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        }).replace(',', '');

    const getInitials = (name) => {
        if (!name) return 'U';
        return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    };

    const getIcon = (type) => {
        if (type === 'ALERT') return <Bell size={14} />;
        if (type === 'ACTION_ASSIGNED') return <Check size={14} />;
        if (type.includes('CHAT')) return <MessageSquare size={14} />;
        return <Info size={14} />;
    };

    return (
        <header className="main-header">
            <div className="header-container-premium">

                {/* LEFT */}
                <div className="header-left-group">
                    {isMobile && (
                        <button className="header-hamburger-mini" onClick={toggleMobile}>
                            <Menu size={15} />
                        </button>
                    )}
                    <h1 className="header-title-premium">{pageTitle}</h1>
                </div>

                {/* CENTER SEARCH */}
                <div className="header-search-container-premium" ref={searchRef}>
                    <div className="header-search-wrapper-mini">
                        <Search size={12} className="text-muted" />
                        <input
                            ref={searchInputRef}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search anything..."
                            className="header-search-input-mini"
                        />
                        <span className="search-shortcut-mini">⌘K</span>
                    </div>

                    {showResults && searchResults && (
                        <div className="search-results-dropdown-premium">
                            {searchResults.asins?.length > 0 && (
                                <div className="search-section">
                                    <div className="search-section-title">ASINs</div>
                                    {searchResults.asins.map(item => (
                                        <div
                                            key={item.id}
                                            className="search-item-premium"
                                            onClick={() => navigate(`/sku-report?asin=${item.code}`)}
                                        >
                                            <Package size={14} />
                                            <div className="search-item-content">
                                                <span className="search-item-title">{item.title}</span>
                                                <span className="search-item-subtitle">{item.code}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {searchResults.sellers?.length > 0 && (
                                <div className="search-section">
                                    <div className="search-section-title">Sellers</div>
                                    {searchResults.sellers.map(item => (
                                        <div
                                            key={item.id}
                                            className="search-item-premium"
                                            onClick={() => navigate(`/sellers/${item.id}`)}
                                        >
                                            <Search size={14} />
                                            <div className="search-item-content">
                                                <span className="search-item-title">{item.title}</span>
                                                <span className="search-item-subtitle">{item.subtitle}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {searchResults.actions?.length > 0 && (
                                <div className="search-section">
                                    <div className="search-section-title">Actions</div>
                                    {searchResults.actions.map(item => (
                                        <div
                                            key={item.id}
                                            className="search-item-premium"
                                            onClick={() => navigate(`/actions/${item.id}`)}
                                        >
                                            <Check size={14} />
                                            <div className="search-item-content">
                                                <span className="search-item-title">{item.title}</span>
                                                <span className="search-item-subtitle">{item.subtitle}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {searchResults.asins?.length === 0 && searchResults.sellers?.length === 0 && searchResults.actions?.length === 0 && (
                                <div className="search-no-results">No results found</div>
                            )}
                        </div>
                    )}
                </div>

                {/* RIGHT */}
                <div className="header-right-group">

                    <div className="sync-info-group">
                        <span className="sync-time-text" style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {formatTime(currentTime)}
                        </span>
                    </div>

                    <DateRangePicker
                        startDate={startDate}
                        endDate={endDate}
                        onDateChange={(t, s, e) => updateDateRange(t, s, e)}
                        compact={true}
                    />

                    <div className="context-pill">
                        <div className="user-avatar-mini">{getInitials(user?.fullName)}</div>
                        <span>{user?.fullName?.split(' ')[0]}</span>
                        <ChevronDown size={10} />
                    </div>

                    <div className="header-divider" />

                    <Dropdown.Root>
                        <Dropdown.Trigger>
                            <button className="header-icon-btn">
                                <Bell size={15} />
                                {unreadCount > 0 && <span className="notif-dot" />}
                            </button>
                        </Dropdown.Trigger>

                        <Dropdown.Popover>
                            <div className="notification-dropdown-premium">
                                {notifications.map(n => (
                                    <Dropdown.Item key={n._id}>
                                        <div className="notif-row">
                                            {getIcon(n.type)}
                                            {n.message}
                                        </div>
                                    </Dropdown.Item>
                                ))}
                            </div>
                        </Dropdown.Popover>
                    </Dropdown.Root>

                    <DropdownButton />
                </div>
            </div>
        </header>
    );
};

export default Header;