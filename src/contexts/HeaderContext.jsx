import React, { createContext, useContext, useState, useCallback } from 'react';
import dayjs from 'dayjs';

const HeaderContext = createContext(null);

export const HeaderProvider = ({ children }) => {
  const [pageMeta, setPageMeta] = useState({
    title: 'Unified Operations Dashboard',
    subtitle: 'Real-time performance across all your sellers',
    breadcrumbs: [
      { label: 'Workspace' },
      { label: 'Dashboard' },
    ],
  });

  const [dateRange, setDateRange] = useState([dayjs().subtract(30, 'day'), dayjs()]);
  const [datePreset, setDatePreset] = useState('last30');
  const [cmdOpen, setCmdOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(dayjs());

  const triggerSync = useCallback(async () => {
    setIsSyncing(true);
    await new Promise((resolve) => setTimeout(resolve, 2200));
    setIsSyncing(false);
    setLastSyncedAt(dayjs());
  }, []);

  return (
    <HeaderContext.Provider
      value={{
        pageMeta, setPageMeta,
        dateRange, setDateRange,
        datePreset, setDatePreset,
        cmdOpen, setCmdOpen,
        notifOpen, setNotifOpen,
        downloadOpen, setDownloadOpen,
        isSyncing, triggerSync,
        lastSyncedAt,
      }}
    >
      {children}
    </HeaderContext.Provider>
  );
};

export const useHeader = () => {
  const ctx = useContext(HeaderContext);
  if (!ctx) throw new Error('useHeader must be used within HeaderProvider');
  return ctx;
};
