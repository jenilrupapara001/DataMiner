import React, { useEffect, useState, useRef } from 'react';
import { Tooltip } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { useHeader } from '../../contexts/HeaderContext';
import { exportApi } from '../../services/api';
import DownloadsDrawer from '../common/DownloadsDrawer';

const DownloadDrawer = () => {
  const { downloadOpen, setDownloadOpen } = useHeader();
  const [hasNew, setHasNew] = useState(false);
  const seenIds = useRef(new Set());

  useEffect(() => {
    const onExport = () => setDownloadOpen(true);
    window.addEventListener('export-started', onExport);
    return () => window.removeEventListener('export-started', onExport);
  }, [setDownloadOpen]);

  useEffect(() => {
    const checkNew = async () => {
      try {
        const res = await exportApi.getDownloads();
        if (res && res.success && res.data) {
          for (const d of res.data) {
            const id = d.Id || d.id || d._id;
            const status = (d.Status || d.status || '').toLowerCase();
            if (status === 'completed' && id && !seenIds.current.has(id)) {
              seenIds.current.add(id);
              setHasNew(true);
            }
          }
        }
      } catch {}
    };
    checkNew();
    const interval = setInterval(checkNew, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleOpen = () => {
    setHasNew(false);
    setDownloadOpen(true);
  };

  const handleClose = () => {
    setDownloadOpen(false);
    const refresh = async () => {
      try {
        const res = await exportApi.getDownloads();
        if (res && res.success && res.data) {
          for (const d of res.data) {
            const id = d.Id || d.id || d._id;
            if (id) seenIds.current.add(id);
          }
        }
      } catch {}
    };
    refresh();
  };

  return (
    <>
      <Tooltip title="Downloads" placement="bottom">
        <button
          className="header-icon-btn"
          onClick={handleOpen}
          aria-label="Downloads"
          style={{ position: 'relative' }}
        >
          <DownloadOutlined style={{ fontSize: '16px' }} />
          {hasNew && (
            <span
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#fb4f40',
              }}
            />
          )}
        </button>
      </Tooltip>

      <DownloadsDrawer
        isOpen={downloadOpen}
        onClose={handleClose}
      />
    </>
  );
};

export default DownloadDrawer;
