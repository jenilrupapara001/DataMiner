// components/sellers/SellerAsinsModal.jsx

import React, {
  useState, useMemo, useCallback,
  useRef, Suspense, lazy, memo
} from 'react';
import {
  Table, Button, Input, Space, Tag, Typography,
  Tooltip, Modal, Badge, Row, Col, Progress,
  Empty, Divider, Popconfirm
} from 'antd';
import {
  Package, X, RefreshCw, FileJson, Plus, Database,
  CheckCircle2, PauseCircle, Eye, Edit3, Trash2,
  AlertCircle, FileSpreadsheet
} from 'lucide-react';
import { asinApi, marketSyncApi } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

// ─── Lazy sub-modals ──────────────────────────────────────────────────────────
const AddBulkAsinModal = lazy(() => import('./AddBulkAsinModal'));
const EditAsinModal = lazy(() => import('./EditAsinModal'));
const AsinDetailsModal = lazy(() => import('./AsinDetailsModal'));

const { Text, Title } = Typography;

// ─── Component ────────────────────────────────────────────────────────────────

const SellerAsinsModal = memo(({
  seller,
  asins,
  onClose,
  onDeleteAsin,
  onToggleStatus,
  onUpdateAsin,
  onSyncAsin,
  isAdmin,
  isGlobalUser,
  onRefresh,
  pagination = { page: 1, limit: 50, total: 0, totalPages: 0 },
  onLoadMore,
  loading = false,
}) => {
  const { addToast } = useToast();

  // ── Submodal state ─────────────────────────────────────────────────────
  const [showAddAsinModal, setShowAddAsinModal] = useState(false);
  const [showEditAsinModal, setShowEditAsinModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [editingAsin, setEditingAsin] = useState(null);
  const [detailedAsin, setDetailedAsin] = useState(null);

  // ── Progress / submitting ──────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(0);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // ── Selection ─────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [matchText, setMatchText] = useState('');

  // Refs for file inputs — avoids document.getElementById
  const catalogInputRef = useRef(null);
  const octoparseInputRef = useRef(null);

  const totalAsins = seller?.totalAsins ?? pagination?.total ?? 0;

  // ─── Progress helpers ─────────────────────────────────────────────────

  const progressIntervalRef = useRef(null);

  const startProgress = useCallback((startAt = 10) => {
    setIsSubmitting(true);
    setSubmitProgress(startAt);
    progressIntervalRef.current = setInterval(() => {
      setSubmitProgress(prev => Math.min(prev + 5, 90));
    }, 400);
  }, []);

  const stopProgress = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setSubmitProgress(100);
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitProgress(0);
    }, 400);
  }, []);

  // ─── Selection handlers ────────────────────────────────────────────────

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(prev =>
      prev.size === asins.length && asins.length > 0
        ? new Set()
        : new Set(asins.map(a => a._id))
    );
  }, [asins]);

  const handleMatchPastedAsins = useCallback(() => {
    if (!matchText.trim()) return;

    const codes = matchText
      .split(/[,\s\n\t]+/)
      .map(a => a.trim().toUpperCase())
      .filter(Boolean);

    const matchedIds = asins
      .filter(a => codes.includes((a.asinCode || '').toUpperCase()))
      .map(a => a._id);

    if (matchedIds.length > 0) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        matchedIds.forEach(id => next.add(id));
        return next;
      });
      addToast(`Matched and selected ${matchedIds.length} ASIN(s).`, 'success');
    } else {
      addToast('None of the pasted ASINs matched current items.', 'warning');
    }
    setMatchText('');
  }, [matchText, asins, addToast]);

  const handleSelectAllFromDatabase = useCallback(async () => {
    startProgress(20);
    try {
      const result = await asinApi.getBySeller(seller._id, { page: 1, limit: 5000 });
      if (result?.asins) {
        setSelectedIds(new Set(result.asins.map(a => a._id)));
        addToast(`Selected all ${result.asins.length} ASINs.`, 'success');
      }
    } catch (error) {
      addToast(error.message || 'Failed to fetch all ASINs', 'error');
    } finally {
      stopProgress();
    }
  }, [seller._id, addToast, startProgress, stopProgress]);

  // ── Bulk status update ─────────────────────────────────────────────────

  const handleBulkStatusUpdate = useCallback(async (newStatus) => {
    if (selectedIds.size === 0) return;
    setIsSubmitting(true);
    setSubmitProgress(10);

    const ids = Array.from(selectedIds);
    let completed = 0;

    try {
      await Promise.all(ids.map(async (id) => {
        await asinApi.update(id, { status: newStatus });
        completed++;
        setSubmitProgress(Math.round(10 + (completed / ids.length) * 85));
      }));

      setSubmitProgress(100);
      addToast(`Updated ${selectedIds.size} item(s) to ${newStatus}.`, 'success');
      setSelectedIds(new Set());
      await onRefresh?.();
    } catch (error) {
      addToast(error.message || 'Failed to update status', 'error');
    } finally {
      setIsSubmitting(false);
      setSubmitProgress(0);
    }
  }, [selectedIds, onRefresh, addToast]);

  // ── Bulk delete ────────────────────────────────────────────────────────

  const executeBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    setIsSubmitting(true);
    setSubmitProgress(30);
    try {
      const result = await asinApi.bulkDelete(Array.from(selectedIds));
      setSubmitProgress(100);
      addToast(result?.message || `Deleted ${selectedIds.size} items.`, 'success');
      setSelectedIds(new Set());
      await onRefresh?.();
    } catch (error) {
      addToast(error.message || 'Bulk delete failed', 'error');
    } finally {
      setIsBulkDeleting(false);
      setIsSubmitting(false);
      setSubmitProgress(0);
    }
  }, [selectedIds, onRefresh, addToast]);

  // ── File upload handlers ───────────────────────────────────────────────

  const handleFileUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const name = file.name.toLowerCase();
    if (!['.csv', '.xlsx', '.xls'].some(ext => name.endsWith(ext))) {
      addToast('Please upload a CSV or Excel file.', 'error');
      e.target.value = '';
      return;
    }

    startProgress(10);
    try {
      const result = await asinApi.importCsv(file, seller._id);
      addToast(result?.message || 'Catalog processed successfully.', 'success');
      await onRefresh?.();
    } catch (error) {
      addToast(error.message || 'Failed to process file', 'error');
    } finally {
      stopProgress();
      e.target.value = '';
    }
  }, [seller._id, addToast, onRefresh, startProgress, stopProgress]);

  const handleOctoparseUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.json')) {
      addToast('Please upload a JSON file.', 'error');
      e.target.value = '';
      return;
    }

    startProgress(10);
    try {
      const result = await marketSyncApi.uploadOctoparseJson(file, seller._id);
      addToast(result?.message || 'JSON data processed successfully.', 'success');
      await onRefresh?.();
    } catch (error) {
      addToast(error.message || 'Failed to process JSON', 'error');
    } finally {
      stopProgress();
      e.target.value = '';
    }
  }, [seller._id, addToast, onRefresh, startProgress, stopProgress]);

  // ── ASIN sub-modal handlers ────────────────────────────────────────────

  const handleEditAsin = useCallback((asin) => {
    setEditingAsin(asin);
    setShowEditAsinModal(true);
  }, []);

  const handleViewDetails = useCallback((asin) => {
    setDetailedAsin(asin);
    setShowDetailsModal(true);
  }, []);

  // Receives pre-validated string[] from AddBulkAsinModal
  const handleBulkAddAsins = useCallback(async (validAsins) => {
    if (!validAsins.length) return;

    startProgress(20);
    try {
      const payload = validAsins.map(code => ({
        asinCode: code,
        seller: seller._id,
        status: 'Active',
      }));

      const result = await asinApi.createBulk(payload);
      setSubmitProgress(100);
      await onRefresh?.();

      if (result?.duplicatesCount > 0) {
        addToast(
          `${result.insertedCount} added · ${result.duplicatesCount} skipped (duplicates).`,
          'warning'
        );
      } else {
        addToast(
          `Added ${result?.insertedCount ?? validAsins.length} ASIN(s) successfully.`,
          'success'
        );
      }

      setShowAddAsinModal(false);
    } catch (error) {
      addToast(error.message || 'Failed to add ASINs', 'error');
    } finally {
      stopProgress();
    }
  }, [seller._id, onRefresh, addToast, startProgress, stopProgress]);

  // ── Table columns ──────────────────────────────────────────────────────

  const columns = useMemo(() => [
    {
      title: 'IDENTIFIER',
      dataIndex: 'asinCode',
      key: 'asinCode',
      width: 140,
      sorter: (a, b) => (a.asinCode || '').localeCompare(b.asinCode || ''),
      render: (text, record) => (
        <div>
          <Text strong code style={{ fontSize: 12, color: '#18181b' }}>{text}</Text>
          {record.lastScraped && (
            <div style={{ fontSize: 9, color: '#a1a1aa', marginTop: 2 }}>
              Synced {new Date(record.lastScraped).toLocaleDateString()}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'IDENTITY & SPECS',
      key: 'identity',
      width: 250,
      render: (_, record) => (
        <div>
          <Text strong style={{ fontSize: 11, color: '#27272a' }}>
            {record.sku || 'UNASSIGNED-SKU'}
          </Text>
          <div style={{ maxWidth: 280, marginTop: 2 }}>
            <Text
              type="secondary"
              style={{ fontSize: 10 }}
              ellipsis={{ tooltip: record.title || 'Loading title...' }}
            >
              {record.title || 'Loading title from marketplace...'}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: 'COMMERCIALS',
      key: 'commercials',
      width: 150,
      sorter: (a, b) => (a.currentPrice || 0) - (b.currentPrice || 0),
      render: (_, record) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Text strong style={{ fontSize: 12, color: '#18181b' }}>
              ₹{record.currentPrice?.toLocaleString() || '0'}
            </Text>
            {record.buyBoxWin && (
              <Tag color="gold" style={{ fontSize: 8, padding: '0 4px', margin: 0, lineHeight: '16px' }}>
                WINNER
              </Tag>
            )}
          </div>
          <Text type="secondary" style={{ fontSize: 10 }}>
            Rank: #{record.bsr || 'N/A'}
          </Text>
        </div>
      ),
    },
    {
      title: 'INVENTORY',
      dataIndex: 'stockLevel',
      key: 'stockLevel',
      width: 100,
      align: 'center',
      sorter: (a, b) => (a.stockLevel || 0) - (b.stockLevel || 0),
      render: (value) => {
        if (!value || value === 0) return <Tag color="error" style={{ margin: 0 }}>0</Tag>;
        if (value <= 20) return <Tag color="warning" style={{ margin: 0 }}>{value}</Tag>;
        return <Tag color="default" style={{ margin: 0 }}>{value}</Tag>;
      },
    },
    {
      title: 'STATUS',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      align: 'center',
      render: (status, record) => (
        <Button
          type="text"
          size="small"
          icon={
            status === 'Active'
              ? <CheckCircle2 size={14} color="#10b981" />
              : <PauseCircle size={14} color="#a1a1aa" />
          }
          onClick={() => onToggleStatus(record._id, status)}
          style={{
            fontWeight: 700,
            fontSize: 10,
            textTransform: 'uppercase',
            color: status === 'Active' ? '#10b981' : '#a1a1aa',
          }}
        >
          {status}
        </Button>
      ),
    },
    {
      title: 'ACTIONS',
      key: 'actions',
      width: 130,
      fixed: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="View Details">
            <Button
              type="text" size="small"
              icon={<Eye size={14} />}
              onClick={() => handleViewDetails(record)}
            />
          </Tooltip>
          <Tooltip title="Sync Now">
            <Button
              type="text" size="small"
              icon={<RefreshCw size={14} />}
              onClick={() => onSyncAsin(record._id)}
            />
          </Tooltip>
          <Tooltip title="Edit ASIN">
            <Button
              type="text" size="small"
              icon={<Edit3 size={14} />}
              onClick={() => handleEditAsin(record)}
            />
          </Tooltip>
          {isAdmin && (
            <Popconfirm
              title="Delete this ASIN?"
              description="This will permanently remove all associated data."
              onConfirm={() => onDeleteAsin(record._id)}
              okText="Delete"
              cancelText="Cancel"
              okButtonProps={{ danger: true }}
              placement="left"
            >
              <Tooltip title="Delete ASIN">
                <Button type="text" size="small" danger icon={<Trash2 size={14} />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ], [onToggleStatus, onSyncAsin, onDeleteAsin, handleViewDetails, handleEditAsin, isAdmin]);

  // ── Row selection ──────────────────────────────────────────────────────

  const rowSelection = useMemo(() => ({
    selectedRowKeys: Array.from(selectedIds),
    onChange: (keys) => setSelectedIds(new Set(keys)),
    selections: [
      Table.SELECTION_ALL,
      Table.SELECTION_INVERT,
      Table.SELECTION_NONE,
    ],
  }), [selectedIds]);

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <Modal
      open={true}
      onCancel={onClose}
      width={1300}
      footer={null}
      closable={false}
      destroyOnHidden
      style={{ top: 20 }}
      styles={{
        body: {
          padding: 0,
          maxHeight: '85vh',
          overflow: 'hidden',
          borderRadius: 20,
        },
      }}
    >
      <div style={{ height: '85vh', display: 'flex', flexDirection: 'column' }}>

        {/* ── Header ─────────────────────────────────────────────── */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #f0f0f0',
          background: '#fff',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}>
          <Row justify="space-between" align="middle">
            <Col>
              <Space size={16} align="start">
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  flexShrink: 0,
                  background: 'linear-gradient(135deg, #18181b, #27272a)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                }}>
                  <Package size={22} color="#fff" strokeWidth={2.5} />
                </div>
                <div>
                  <Title level={4} style={{ margin: 0, fontWeight: 800, letterSpacing: '-0.02em' }}>
                    ASIN Inventory — {seller?.name ?? 'Unknown Store'}
                  </Title>
                  <Space size={8} style={{ marginTop: 4 }}>
                    {seller?.marketplace && (
                      <Tag style={{
                        background: '#f4f4f5',
                        border: '1px solid #e4e4e7',
                        borderRadius: 6,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        fontSize: 10,
                      }}>
                        {seller.marketplace}
                      </Tag>
                    )}
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      <Badge status="processing" />
                      {' '}{totalAsins.toLocaleString()} ASINs Tracked
                    </Text>
                  </Space>
                </div>
              </Space>
            </Col>
            <Col>
              <Space>
                <Tooltip title="Refresh">
                  <Button icon={<RefreshCw size={15} />} onClick={onRefresh} loading={loading} />
                </Tooltip>
                <Tooltip title="Close">
                  <Button type="text" icon={<X size={18} />} onClick={onClose} />
                </Tooltip>
              </Space>
            </Col>
          </Row>
        </div>

        {/* ── Bulk Action Bar ────────────────────────────────────── */}
        {selectedIds.size > 0 && (
          <div style={{
            padding: '10px 24px',
            background: '#18181b',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'sticky',
            top: 85,
            zIndex: 9,
          }}>
            <Space>
              <Tag color="blue" style={{ fontSize: 11, fontWeight: 700 }}>
                {selectedIds.size} Selected
              </Tag>
              <Text style={{ color: '#a1a1aa', fontSize: 12 }}>
                Bulk actions for selected ASINs
              </Text>
            </Space>
            <Space size={8}>
              <Button
                size="small"
                type="primary"
                icon={<CheckCircle2 size={13} />}
                onClick={() => handleBulkStatusUpdate('Active')}
                loading={isSubmitting}
                style={{ background: '#10b981', borderColor: '#10b981', fontWeight: 600 }}
              >
                Mark Active
              </Button>
              <Button
                size="small"
                icon={<PauseCircle size={13} />}
                onClick={() => handleBulkStatusUpdate('Paused')}
                loading={isSubmitting}
                style={{ background: '#d97706', borderColor: '#d97706', color: '#fff', fontWeight: 600 }}
              >
                Mark Paused
              </Button>
              <Popconfirm
                title={`Delete ${selectedIds.size} selected ASIN(s)?`}
                description="This permanently removes all associated historical data."
                onConfirm={executeBulkDelete}
                okText="Delete All"
                cancelText="Cancel"
                okButtonProps={{ danger: true }}
              >
                <Button
                  size="small"
                  danger
                  icon={<Trash2 size={13} />}
                  loading={isBulkDeleting}
                >
                  Delete Selected
                </Button>
              </Popconfirm>
              <Button
                size="small"
                onClick={() => setSelectedIds(new Set())}
                style={{ color: '#a1a1aa' }}
              >
                Clear
              </Button>
            </Space>
          </div>
        )}

        {/* ── Progress ───────────────────────────────────────────── */}
        {isSubmitting && (
          <div style={{
            padding: '6px 24px',
            borderBottom: '1px solid #f0f0f0',
            background: '#fafafa',
          }}>
            <Progress percent={submitProgress} size="small" status="active" showInfo={false} />
          </div>
        )}

        {/* ── Toolbar ────────────────────────────────────────────── */}
        <div style={{
          padding: '10px 24px',
          borderBottom: '1px solid #f0f0f0',
          background: '#fff',
        }}>
          <Row justify="space-between" align="middle" gutter={[12, 8]}>
            <Col>
              <Input.Search
                size="small"
                placeholder="Paste ASINs to select matches…"
                value={matchText}
                onChange={e => setMatchText(e.target.value)}
                onSearch={handleMatchPastedAsins}
                style={{ width: 300 }}
                enterButton="Select"
              />
            </Col>
            <Col>
              <Space wrap size={6}>
                {/* Hidden file inputs using refs */}
                <input
                  ref={catalogInputRef}
                  type="file"
                  style={{ display: 'none' }}
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileUpload}
                />
                <Button
                  size="small"
                  icon={<FileSpreadsheet size={13} />}
                  onClick={() => catalogInputRef.current?.click()}
                  disabled={isSubmitting}
                >
                  Bulk ASIN/SKU Sync
                </Button>

                <input
                  ref={octoparseInputRef}
                  type="file"
                  style={{ display: 'none' }}
                  accept=".json"
                  onChange={handleOctoparseUpload}
                />
                <Button
                  size="small"
                  icon={<FileJson size={13} />}
                  onClick={() => octoparseInputRef.current?.click()}
                  disabled={isSubmitting}
                >
                  Data Ingest
                </Button>

                <Divider type="vertical" />

                <Button
                  size="small"
                  icon={<Database size={13} />}
                  onClick={handleSelectAllFromDatabase}
                  disabled={isSubmitting}
                >
                  Select All ({totalAsins.toLocaleString()})
                </Button>

                <Button
                  size="small"
                  type="primary"
                  icon={<Plus size={13} />}
                  onClick={() => setShowAddAsinModal(true)}
                  style={{ background: '#18181b', borderColor: '#18181b', fontWeight: 700 }}
                >
                  Add ASIN(s)
                </Button>
              </Space>
            </Col>
          </Row>
        </div>

        {/* ── Table ─────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflow: 'auto', padding: '4px 24px' }}>
          <Table
            columns={columns}
            dataSource={asins}
            rowKey="_id"
            loading={loading}
            rowSelection={rowSelection}
            scroll={{ x: 900 }}
            size="small"
            pagination={false}
            style={{ marginTop: 8 }}
            locale={{
              emptyText: (
                <Empty
                  image={<Database size={48} style={{ color: '#d4d4d8' }} />}
                  description={
                    <div>
                      <Text strong style={{ color: '#71717a', display: 'block', fontSize: 13, marginBottom: 6 }}>
                        No ASINs tracked for this store
                      </Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        Add your product catalog manually or via CSV/JSON.
                      </Text>
                    </div>
                  }
                />
              ),
            }}
          />
        </div>

        {/* ── Load More ─────────────────────────────────────────── */}
        {pagination.page < pagination.totalPages && (
          <div style={{
            padding: 16,
            textAlign: 'center',
            borderTop: '1px solid #f0f0f0',
            background: '#fff',
          }}>
            <Button
              size="large"
              onClick={onLoadMore}
              loading={loading}
              style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', borderRadius: 8 }}
            >
              {loading
                ? 'Loading…'
                : `Load More (${Math.max(0, totalAsins - asins.length).toLocaleString()} remaining)`
              }
            </Button>
          </div>
        )}

        {/* ── Footer ────────────────────────────────────────────── */}
        <div style={{
          padding: '12px 24px',
          borderTop: '1px solid #f0f0f0',
          background: '#fafafa',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <Text type="secondary" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertCircle size={13} />
            Select multiple records to perform batch operations
          </Text>
          <Button
            type="primary"
            size="large"
            onClick={onClose}
            style={{
              background: '#18181b',
              borderColor: '#18181b',
              fontWeight: 700,
              fontSize: 11,
              textTransform: 'uppercase',
              borderRadius: 8,
            }}
          >
            Close Panel
          </Button>
        </div>
      </div>

      {/* ── Sub-modals ─────────────────────────────────────────────── */}
      <Suspense fallback={null}>
        {showAddAsinModal && (
          <AddBulkAsinModal
            seller={seller}
            onClose={() => setShowAddAsinModal(false)}
            onAdd={handleBulkAddAsins}
            isSubmitting={isSubmitting}
          />
        )}

        {showEditAsinModal && editingAsin && (
          <EditAsinModal
            asin={editingAsin}
            onClose={() => {
              setShowEditAsinModal(false);
              setEditingAsin(null);
            }}
            onSave={(data) => {
              onUpdateAsin(editingAsin._id, data);
              setShowEditAsinModal(false);
              setEditingAsin(null);
            }}
          />
        )}

        {showDetailsModal && detailedAsin && (
          <AsinDetailsModal
            asin={detailedAsin}
            onClose={() => {
              setShowDetailsModal(false);
              setDetailedAsin(null);
            }}
          />
        )}
      </Suspense>
    </Modal>
  );
});

export default SellerAsinsModal;