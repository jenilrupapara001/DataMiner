import React from 'react';
import { SearchOutlined } from '@ant-design/icons';
import { useHeader } from '../../contexts/HeaderContext';
import { useKeyboardShortcut, usePlatform } from './headerHooks';

const SearchTrigger = () => {
  const { setCmdOpen } = useHeader();
  const { modKey } = usePlatform();

  useKeyboardShortcut(
    ['k'],
    () => setCmdOpen(true),
    { metaKey: true, preventDefault: true }
  );

  return (
    <button
      type="button"
      className="search-trigger"
      onClick={() => setCmdOpen(true)}
      aria-label="Open command palette"
    >
      <SearchOutlined className="search-trigger-icon" />
      <span className="search-trigger-label">
        Search ASINs, sellers, reports, commands...
      </span>
      <span className="kbd-pill">
        {modKey} K
      </span>
    </button>
  );
};

export default SearchTrigger;
