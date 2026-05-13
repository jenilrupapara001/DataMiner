// SellerAsinsModal.jsx - Modern Ant Design Implementation
import React, { useState, useMemo } from 'react';
import {
  Table, Button, Input, Space, Tag, Typography, Tooltip, Modal,
  Badge, Row, Col, Progress, Segmented, Empty, Dropdown, Divider
} from 'antd';
import {
  Package, X, RefreshCw, FileJson, Plus, Database,
  CheckCircle2, PauseCircle, Eye, Edit3, Trash2,
  CheckSquare, Square, Trash, AlertCircle, Loader2,
  FileUp, FileSpreadsheet, Search, Filter, Upload,
  MoreVertical, ArrowUpDown, Download, Zap, Info
} from 'lucide-react';
import { asinApi, marketSyncApi } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import ProgressBar from '../common/ProgressBar';
import { Suspense, lazy } from 'react';

const AddBulkAsinModal = lazy(() => import('./AddBulkAsinModal'));
const EditAsinModal = lazy(() => import('./EditAsinModal'));
const AsinDetailsModal = lazy(() => import('./AsinDetailsModal'));

const { Text, Title } = Typography;

const SellerAsinsModal = ({
  seller,
  asins,
  onClose,
  onAddAsin,
  onDeleteAsin,
  onToggleStatus,
  onUpdateAsin,
  onSyncAsin,
  isAdmin,
  isGlobalUser,
  onRefresh,
  pagination = { page: 1, limit: 50, total: 0, totalPages: 0 },
  onLoadMore,
  loading
}) => {
  const { addToast } = useToast();
  const [showAddAsinModal, setShowAddAsinModal] = useState(false);
  const [showEditAsinModal, setShowEditAsinModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [editingAsin, setEditingAsin] = useState(null);
  const [detailedAsin, setDetailedAsin] = useState(null);
  const [newAsinsText, setNewAsinsText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(0);

  const totalAsins = seller?.totalAsins ?? pagination?.total ?? 0;

  // Selection Logic
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [matchInputText, setMatchInputText] = useState('');

  const handleSelectPastedAsins = () => {
    if (!matchInputText.trim()) return;
    const pastedCodes = matchInputText
      .split(/[,\s\n\t]+/)
      .map(a => a.trim().toUpperCase())
      .filter(a => a.length > 0);

    const matchedIds = asins
      .filter(asin => pastedCodes.includes((asin.asinCode || '').toUpperCase()))
      .map(asin => asin._id);

    if (matchedIds.length > 0) {
      const next = new Set(selectedIds);
      matchedIds.forEach(id => next.add(id));
      setSelectedIds(next);
      addToast({
        title: 'ASIN Selection Match',
        message: `Successfully matched and selected ${matchedIds.length} ASIN(s).`,
        type: 'success'
      });
    } else {
      addToast({
        title: 'No Matches Found',
        message: 'None of the pasted ASINs matched current loaded items.',
        type: 'warning'
      });
    }
    setMatchInputText('');
  };

  const handleSelectAllFromDatabase = async () => {
    setIsSubmitting(true);
    setSubmitProgress(20);
    try {
      const result = await asinApi.getBySeller(seller._id, { page: 1, limit: 10000 });
      if (result && result.asins) {
        const allIds = result.asins.map(a => a._id);
        setSelectedIds(new Set(allIds));
        addToast({
          title: 'ASIN Bulk Selection',
          message: `Successfully matched and selected all ${allIds.length} ASINs from database.`,
          type: 'success'
        });
      }
    } catch (error) {
      addToast({
        title: 'Selection Failed',
        message: error.message || 'Failed to fetch all ASINs',
        type: 'error'
      });
    } finally {
      setIsSubmitting(false);
      setSubmitProgress(0);
    }
  };

  const handleBulkStatusUpdate = async (newStatus) => {
    if (selectedIds.size === 0) return;

    setIsSubmitting(true);
    setSubmitProgress(10);

    try {
      const idsArray = Array.from(selectedIds);
      const step = 90 / idsArray.length;

      await Promise.all(idsArray.map(async (id) => {
        await asinApi.update(id, { status: newStatus });
        setSubmitProgress(prev => Math.min(prev + step, 95));
      }));

      setSubmitProgress(100);
      addToast({
        title: 'Bulk Action Success',
        message: `Successfully updated status to ${newStatus} for ${selectedIds.size} items.`,
        type: 'success'
      });

      setSelectedIds(new Set());
      if (onRefresh) await onRefresh();
    } catch (error) {
      addToast({
        title: 'Bulk Action Failed',
        message: error.message || 'Failed to update status',
        type: 'error'
      });
    } finally {
      setIsSubmitting(false);
      setSubmitProgress(0);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === asins.length && asins.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(asins.map(a => a._id)));
    }
  };

  const toggleSelectOne = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    Modal.confirm({
      title: 'Confirm Bulk Delete',
      content: `Are you sure you want to delete ${selectedIds.size} selected ASINs? This action will permanently remove all associated historical data.`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        setIsBulkDeleting(true);
        setIsSubmitting(true);
        setSubmitProgress(30);

        try {
          const result = await asinApi.bulkDelete(Array.from(selectedIds));
          setSubmitProgress(100);

          addToast({
            title: 'Bulk Action Success',
            message: result.message || `Successfully deleted ${selectedIds.size} selected items.`,
            type: 'success'
          });

          setSelectedIds(new Set());
          if (onRefresh) await onRefresh();
        } catch (error) {
          addToast({
            title: 'Bulk Action Failed',
            message: error.message,
            type: 'error'
          });
        } finally {
          setIsBulkDeleting(false);
          setIsSubmitting(false);
          setSubmitProgress(0);
        }
      }
    });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedExtensions = ['.csv', '.xlsx', '.xls'];
    const fileName = file.name.toLowerCase();
    const isValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));

    if (!isValidExtension) {
      addToast({
        title: 'Invalid File',
        message: 'Please upload a CSV or Excel file (.csv, .xlsx, .xls)',
        type: 'error'
      });
      return;
    }

    let pInterval;
    setIsSubmitting(true);
    setSubmitProgress(10);

    pInterval = setInterval(() => {
      setSubmitProgress(prev => Math.min(prev + 5, 90));
    }, 400);

    try {
      const result = await asinApi.importCsv(file, seller._id);
      setSubmitProgress(100);

      addToast({
        title: 'Catalog Sync Success',
        message: result.message || 'Catalog processed successfully.',
        type: 'success'
      });

      if (onRefresh) await onRefresh();
    } catch (error) {
      addToast({
        title: 'Import Failed',
        message: error.message || 'Failed to process file',
        type: 'error'
      });
    } finally {
      if (pInterval) clearInterval(pInterval);
      setIsSubmitting(false);
      setSubmitProgress(0);
      e.target.value = '';
    }
  };

  const handleOctoparseUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.json')) {
      addToast({
        title: 'Invalid File',
        message: 'Please upload a JSON file.',
        type: 'error'
      });
      return;
    }

    let pInterval;
    setIsSubmitting(true);
    setSubmitProgress(10);

    pInterval = setInterval(() => {
      setSubmitProgress(prev => Math.min(prev + 5, 90));
    }, 400);

    try {
      const result = await marketSyncApi.uploadOctoparseJson(file, seller._id);
      setSubmitProgress(100);

      addToast({
        title: 'Octoparse Data Ingested',
        message: result.message || 'JSON data processed successfully.',
        type: 'success'
      });

      if (onRefresh) await onRefresh();
    } catch (error) {
      addToast({
        title: 'Upload Failed',
        message: error.message || 'Failed to process JSON file',
        type: 'error'
      });
    } finally {
      if (pInterval) clearInterval(pInterval);
      setIsSubmitting(false);
      setSubmitProgress(0);
      e.target.value = '';
    }
  };

  const handleEditAsin = (asin) => {
    setEditingAsin(asin);
    setShowEditAsinModal(true);
  };

  const handleViewDetails = (asin) => {
    setDetailedAsin(asin);
    setShowDetailsModal(true);
  };

  const handleBulkAddAsins = async () => {
    if (!newAsinsText.trim()) return;

    let sInterval;
    setIsSubmitting(true);
    setSubmitProgress(10);

    try {
      const asinList = newAsinsText.split(/[,\s\n]+/).map(a => a.trim().toUpperCase()).filter(a => a.length > 0);
      const asinsPayload = asinList.map(code => ({
        asinCode: code,
        seller: seller._id,
        status: 'Active'
      }));

      setSubmitProgress(20);
      sInterval = setInterval(() => {
        setSubmitProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const result = await asinApi.createBulk(asinsPayload);
      setSubmitProgress(100);

      if (onRefresh) await onRefresh();

      if (result.duplicatesCount > 0) {
        addToast({
          title: 'Partial Success',
          message: `${result.insertedCount} added. ${result.duplicatesCount} skipped.`,
          type: 'warning',
          duration: 10000
        });
      } else {
        addToast({
          title: 'Success',
          message: `Successfully added ${result.insertedCount} ASIN(s).`,
          type: 'success'
        });
      }

      setNewAsinsText('');
      setShowAddAsinModal(false);
    } catch (error) {
      addToast({
        title: 'Bulk Add Failed',
        message: error.message || 'Failed to process ASINs',
        type: 'error'
      });
    } finally {
      if (sInterval) clearInterval(sInterval);
      setIsSubmitting(false);
      setSubmitProgress(0);
    }
  };

  // Table Columns Configuration
  const columns = useMemo(() => [
    {
      title: 'IDENTIFIER',
      dataIndex: 'asinCode',
      key: 'asinCode',
      width: 140,
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
      sorter: (a, b) => (a.asinCode || '').localeCompare(b.asinCode || ''),
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
      sorter: (a, b) => (a.currentPrice || 0) - (b.currentPrice || 0),
    },
    {
      title: 'INVENTORY',
      dataIndex: 'stockLevel',
      key: 'stockLevel',
      width: 100,
      align: 'center',
      render: (value) => {
        if (!value || value === 0) {
          return <Tag color="error" style={{ margin: 0 }}>0</Tag>;
        }
        if (value <= 20) {
          return <Tag color="warning" style={{ margin: 0 }}>{value}</Tag>;
        }
        return <Tag color="default" style={{ margin: 0 }}>{value}</Tag>;
      },
      sorter: (a, b) => (a.stockLevel || 0) - (b.stockLevel || 0),
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
          icon={status === 'Active' ? <CheckCircle2 size={14} color="#10b981" /> : <PauseCircle size={14} color="#a1a1aa" />}
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
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="View Details">
            <Button
              type="text"
              size="small"
              icon={<Eye size={14} />}
              onClick={() => handleViewDetails(record)}
            />
          </Tooltip>
          <Tooltip title="Sync Now">
            <Button
              type="text"
              size="small"
              icon={<RefreshCw size={14} />}
              onClick={() => onSyncAsin(record._id)}
            />
          </Tooltip>
          <Tooltip title="Edit ASIN">
            <Button
              type="text"
              size="small"
              icon={<Edit3 size={14} />}
              onClick={() => handleEditAsin(record)}
            />
          </Tooltip>
          {isAdmin && (
            <Tooltip title="Delete ASIN">
              <Button
                type="text"
                size="small"
                danger
                icon={<Trash2 size={14} />}
                onClick={() => onDeleteAsin(record._id)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ], [onToggleStatus, onSyncAsin, onDeleteAsin, handleViewDetails, handleEditAsin, isAdmin]);

  // Row selection configuration
  const rowSelection = {
    selectedRowKeys: Array.from(selectedIds),
    onChange: (selectedRowKeys) => {
      setSelectedIds(new Set(selectedRowKeys));
    },
    selections: [
      Table.SELECTION_ALL,
      Table.SELECTION_INVERT,
      Table.SELECTION_NONE,
    ],
  };

  return (
    <Modal
      open={true}
      onCancel={onClose}
      width={1300}
      footer={null}
      closable={false}
      style={{ top: 20 }}
      styles={{
        body: {
          padding: 0,
          maxHeight: '85vh',
          overflow: 'hidden',
        },
        content: {
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        },
      }}
    >
      <div style={{ height: '85vh', display: 'flex', flexDirection: 'column' }}>
        {/* Premium Header */}
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
                  background: 'linear-gradient(135deg, #18181b 0%, #27272a 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                }}>
                  <Package size={22} color="#fff" strokeWidth={2.5} />
                </div>
                <div>
                  <Title level={4} style={{ margin: 0, fontWeight: 800, letterSpacing: '-0.02em' }}>
                    ASIN Inventory — {seller.name}
                  </Title>
                  <Space size={8} style={{ marginTop: 4 }}>
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
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      <Badge status="processing" />
                      {totalAsins.toLocaleString()} Total ASINs Tracked
                    </Text>
                  </Space>
                </div>
              </Space>
            </Col>
            <Col>
              <Space>
                <Tooltip title="Refresh List">
                  <Button
                    icon={<RefreshCw size={16} />}
                    onClick={onRefresh}
                    loading={loading}
                  />
                </Tooltip>
                <Tooltip title="Close">
                  <Button
                    type="text"
                    icon={<X size={18} />}
                    onClick={onClose}
                  />
                </Tooltip>
              </Space>
            </Col>
          </Row>
        </div>

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <div style={{
            padding: '12px 24px',
            background: '#18181b',
            color: '#fff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'sticky',
            top: 93,
            zIndex: 9,
          }}>
            <Space>
              <Tag color="blue" style={{ fontSize: 11, fontWeight: 700 }}>
                {selectedIds.size} Selected
              </Tag>
              <Text style={{ color: '#a1a1aa', fontSize: 12 }}>
                Perform bulk actions on the selected ASIN records
              </Text>
            </Space>
            <Space>
              <Button
                size="small"
                type="primary"
                style={{ background: '#10b981', borderColor: '#10b981', fontWeight: 600 }}
                icon={<CheckCircle2 size={14} />}
                onClick={() => handleBulkStatusUpdate('Active')}
                loading={isSubmitting}
              >
                Mark Active
              </Button>
              <Button
                size="small"
                style={{
                  background: '#d97706',
                  borderColor: '#d97706',
                  color: '#fff',
                  fontWeight: 600,
                }}
                icon={<PauseCircle size={14} />}
                onClick={() => handleBulkStatusUpdate('Paused')}
                loading={isSubmitting}
              >
                Mark Inactive
              </Button>
              <Button
                size="small"
                danger
                icon={isBulkDeleting ? <Loader2 size={14} /> : <Trash2 size={14} />}
                onClick={handleBulkDelete}
                loading={isSubmitting}
              >
                Delete Selected
              </Button>
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

        {/* Progress Bar */}
        {isSubmitting && (
          <div style={{ padding: '8px 24px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
            <Progress percent={submitProgress} size="small" status="active" />
          </div>
        )}

        {/* Toolbar */}
        <div style={{
          padding: '12px 24px',
          borderBottom: '1px solid #f0f0f0',
          background: '#fff',
        }}>
          <Row justify="space-between" align="middle" gutter={[12, 12]}>
            <Col>
              <Space wrap>
                <Tag color="blue" style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 10 }}>
                  Catalog View
                </Tag>
                {/* ASIN Search Input */}
                <Input.Search
                  size="small"
                  placeholder="Paste ASINs to select (Enter to match)"
                  value={matchInputText}
                  onChange={(e) => setMatchInputText(e.target.value)}
                  onSearch={handleSelectPastedAsins}
                  style={{ width: 320 }}
                  enterButton="Select"
                />
              </Space>
            </Col>
            <Col>
              <Space wrap>
                {/* File Uploads */}
                <input type="file" id="catalogUpload" hidden accept=".csv,.xlsx,.xls" onChange={handleFileUpload} />
                <Button
                  size="small"
                  icon={<FileSpreadsheet size={14} />}
                  onClick={() => document.getElementById('catalogUpload').click()}
                  disabled={isSubmitting}
                >
                  Bulk ASIN/SKU Sync
                </Button>
                <input type="file" id="octoparseUpload" hidden accept=".json" onChange={handleOctoparseUpload} />
                <Button
                  size="small"
                  icon={<FileJson size={14} />}
                  onClick={() => document.getElementById('octoparseUpload').click()}
                  disabled={isSubmitting}
                >
                  Data Ingest
                </Button>
                <Divider type="vertical" />
                <Button
                  size="small"
                  icon={<Database size={14} />}
                  onClick={handleSelectAllFromDatabase}
                  disabled={isSubmitting}
                >
                  Select All ASINs ({totalAsins.toLocaleString()})
                </Button>
                <Button
                  size="small"
                  type="primary"
                  icon={<Plus size={14} />}
                  onClick={() => setShowAddAsinModal(true)}
                  style={{
                    background: '#18181b',
                    borderColor: '#18181b',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    fontSize: 10,
                  }}
                >
                  Add ASIN(s)
                </Button>
              </Space>
            </Col>
          </Row>
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflow: 'auto', padding: '4px 24px' }}>
          <Table
            columns={columns}
            dataSource={asins}
            rowKey="_id"
            loading={loading}
            rowSelection={rowSelection}
            scroll={{ x: 900 }}
            size="small"
            locale={{
              emptyText: (
                <Empty
                  image={<Database size={48} style={{ color: '#d4d4d8' }} />}
                  description={
                    <div>
                      <Text strong style={{ color: '#71717a', display: 'block', fontSize: 13, marginBottom: 8 }}>
                        No ASINs tracked for this store yet
                      </Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        Start by adding your product catalog manually or via JSON.
                      </Text>
                    </div>
                  }
                />
              ),
            }}
            pagination={false}
            style={{ marginTop: 8 }}
          />
        </div>

        {/* Load More */}
        {pagination.page < pagination.totalPages && (
          <div style={{
            padding: '16px',
            textAlign: 'center',
            borderTop: '1px solid #f0f0f0',
            background: '#fff',
          }}>
            <Button
              size="large"
              onClick={onLoadMore}
              loading={loading}
              style={{
                fontWeight: 700,
                fontSize: 11,
                textTransform: 'uppercase',
                borderRadius: 8,
              }}
            >
              {loading ? 'Fetching Data...' : `Load More (${totalAsins - asins.length} remaining)`}
            </Button>
          </div>
        )}

        {/* Footer */}
        <div style={{
          padding: '12px 24px',
          borderTop: '1px solid #f0f0f0',
          background: '#fafafa',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <Text type="secondary" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertCircle size={14} />
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
              textTransform: 'uppercase',
              fontSize: 11,
              borderRadius: 8,
            }}
          >
            Close Panel
          </Button>
        </div>
      </div>

      {/* Sub-Modals */}
      <Suspense fallback={null}>
        {showAddAsinModal && (
          <AddBulkAsinModal
            seller={seller}
            onClose={() => setShowAddAsinModal(false)}
            onAdd={handleBulkAddAsins}
            isSubmitting={isSubmitting}
            text={newAsinsText}
            setText={setNewAsinsText}
          />
        )}

        {showEditAsinModal && editingAsin && (
          <EditAsinModal
            asin={editingAsin}
            onClose={() => { setShowEditAsinModal(false); setEditingAsin(null); }}
            onSave={(data) => {
              onUpdateAsin(editingAsin._id, data);
              setShowEditAsinModal(false);
            }}
          />
        )}

        {showDetailsModal && detailedAsin && (
          <AsinDetailsModal
            asin={detailedAsin}
            onClose={() => { setShowDetailsModal(false); setDetailedAsin(null); }}
          />
        )}
      </Suspense>
    </Modal>
  );
};

export default React.memo(SellerAsinsModal);