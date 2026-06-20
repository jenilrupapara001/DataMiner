import React from 'react';
import { Tooltip } from 'antd';
import { SyncOutlined } from '@ant-design/icons';
import { useHeader } from '../../contexts/HeaderContext';
import { formatRelativeTime } from './headerHooks';

const QuickActions = () => {
  const { isSyncing, triggerSync, lastSyncedAt } = useHeader();

  return (
    <Tooltip
      title={
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px' }}>
          <div style={{ fontWeight: 600, marginBottom: '2px' }}>
            {isSyncing ? 'Syncing...' : 'Sync data'}
          </div>
          <div style={{ opacity: 0.7 }}>
            Last synced{' '}
            {lastSyncedAt
              ? formatRelativeTime(lastSyncedAt.toDate())
              : 'never'}
          </div>
        </div>
      }
      placement="bottom"
    >
      <button
        className="header-icon-btn"
        onClick={triggerSync}
        disabled={isSyncing}
        aria-label="Sync data"
      >
        <SyncOutlined
          spin={isSyncing}
          style={{
            fontSize: '15px',
            color: isSyncing ? '#fb4f40' : undefined,
          }}
        />
      </button>
    </Tooltip>
  );
};

export default QuickActions;
