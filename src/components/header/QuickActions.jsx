import React from 'react';
import { Tooltip, Dropdown } from 'antd';
import {
  SyncOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useHeader } from '../../contexts/HeaderContext';
import { formatRelativeTime } from './headerHooks';
import { message } from 'antd';

const QuickActions = () => {
  const { isSyncing, triggerSync, lastSyncedAt } = useHeader();

  const exportItems = [
    {
      key: 'csv',
      label: 'Export as CSV',
      icon: <FileExcelOutlined />,
      onClick: () => message.success('Exporting CSV...'),
    },
    {
      key: 'pdf',
      label: 'Export as PDF',
      icon: <FilePdfOutlined />,
      onClick: () => message.success('Generating PDF...'),
    },
    {
      key: 'json',
      label: 'Export raw JSON',
      icon: <FileTextOutlined />,
      onClick: () => message.success('Downloading JSON...'),
    },
  ];

  return (
    <>
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

      <Dropdown
        menu={{ items: exportItems }}
        placement="bottomRight"
        trigger={['click']}
      >
        <Tooltip title="Export" placement="bottom">
          <button className="header-icon-btn" aria-label="Export">
            <DownloadOutlined style={{ fontSize: '15px' }} />
          </button>
        </Tooltip>
      </Dropdown>
    </>
  );
};

export default QuickActions;
