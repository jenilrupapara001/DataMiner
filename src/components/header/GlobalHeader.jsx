import React from 'react';
import HeaderBrand from './HeaderBrand';
import SearchTrigger from './SearchTrigger';
import CommandPalette from './CommandPalette';
import DateRangeSelector from './DateRangeSelector';
import NotificationCenter from './NotificationCenter';
import QuickActions from './QuickActions';
import UserMenu from './UserMenu';
import '../../styles/header.css';

const GlobalHeader = () => {
  return (
    <>
      <header className="global-header">
        <HeaderBrand />

        <SearchTrigger />

        <div className="header-actions">
          <div className="live-status">
            <span className="live-dot" />
            <span>Live</span>
          </div>

          <div className="header-divider" />

          <DateRangeSelector />

          <div className="header-divider" />

          <QuickActions />
          <NotificationCenter />

          <div className="header-divider" />

          <UserMenu />
        </div>
      </header>

      <CommandPalette />
    </>
  );
};

export default GlobalHeader;
