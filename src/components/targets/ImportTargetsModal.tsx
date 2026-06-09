import React, { useState, useCallback, useMemo } from 'react';
import {
    Modal, Button, Upload, Table, Tag, Alert, Space, Typography,
    Progress, message, Card, Statistic, Row, Col, Tooltip
} from 'antd';
import {
    Upload as UploadIcon, Download, FileSpreadsheet,
    CheckCircle, XCircle, AlertTriangle, RefreshCw, Sparkles,
    FileText, Database, Zap
} from 'lucide-react';
import {
    downloadTemplate,
    readExcelFile,
    parseAndValidate,
    type ParsedRow,
} from '../../utils/targetImportHelpers';
import { targetImportApi } from '../../services/targetImportService';

const { Text, Title } = Typography;
const { Dragger } = Upload;

interface Props {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    sellers: any[];
    managers?: Array<{ id: string; name: string }>;
}

type Step = 'upload' | 'preview' | 'importing' | 'result';

const ImportTargetsModal: React.FC<Props> = ({
    open, onClose, onSuccess, sellers, managers = []
}) => {
    // ✅ Using static message import — works everywhere

    const [step, setStep] = useState<Step>('upload');
    const [file, setFile] = useState<File | null>(null);
    const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<any>(null);
    const [parseLoading, setParseLoading] = useState(false);

    // ─── Build lookup maps ────────────────────────────────
    const sellerNameToId = useMemo(() => {
        const map = new Map<string, string>();
        sellers.forEach(s => {
            const id = s._id || s.id;
            const name = (s.name || '').toLowerCase().trim();
            if (id && name) map.set(name, id);
        });
        return map;
    }, [sellers]);

    const sellerIdToName = useMemo(() => {
        const map = new Map<string, string>();
        sellers.forEach(s => {
            const id = s._id || s.id;
            const name = s.name || '';
            if (id) map.set(id, name);
        });
        return map;
    }, [sellers]);

    const managerSet = useMemo(() => {
        return new Set(managers.map(m => m.id));
    }, [managers]);

    // ─── Stats ────────────────────────────────────────────
    const stats = useMemo(() => {
        const valid = parsedRows.filter(r => r.isValid).length;
        const invalid = parsedRows.length - valid;
        return {
            total: parsedRows.length,
            valid,
            invalid,
            validPct: parsedRows.length > 0 ? (valid / parsedRows.length) * 100 : 0,
        };
    }, [parsedRows]);

    // ─── Reset state ──────────────────────────────────────
    const handleReset = useCallback(() => {
        setStep('upload');
        setFile(null);
        setParsedRows([]);
        setImporting(false);
        setImportResult(null);
    }, []);

    const handleClose = useCallback(() => {
        handleReset();
        onClose();
    }, [handleReset, onClose]);

    // ─── File processing ──────────────────────────────────
    const handleFileSelected = useCallback(async (selectedFile: File) => {
        setFile(selectedFile);
        setParseLoading(true);
        try {
            const rows = await readExcelFile(selectedFile);
            if (rows.length === 0) {
                message.warning('The file appears to be empty');
                setParseLoading(false);
                return;
            }
            const parsed = parseAndValidate(rows, sellerIdToName, sellerNameToId, managerSet);
            setParsedRows(parsed);
            setStep('preview');
            message.success(`Loaded ${parsed.length} rows`);
        } catch (err: any) {
            message.error(err.message || 'Failed to read file');
        } finally {
            setParseLoading(false);
        }
    }, [sellerIdToName, sellerNameToId, managerSet]);

    const uploadProps = {
        accept: '.xlsx,.xls',
        multiple: false,
        showUploadList: false,
        beforeUpload: (selectedFile: File) => {
            handleFileSelected(selectedFile);
            return false;
        },
    };

    // ─── Import handler ───────────────────────────────────
    const handleImport = useCallback(async () => {
        if (stats.valid === 0) {
            message.warning('No valid rows to import');
            return;
        }

        setImporting(true);
        setStep('importing');

        try {
            const payload = targetImportApi.buildPayload(parsedRows, sellerNameToId);
            const result = await targetImportApi.importAchievements(payload);
            setImportResult(result);
            setStep('result');
            if (result.success) {
                message.success(`Imported ${result.imported} records, updated ${result.updated}`);
            } else {
                message.warning(`Import completed with errors: ${result.errors?.length || 0} failed`);
            }
        } catch (err: any) {
            message.error(err.message || 'Import failed');
            setImportResult({
                success: false,
                imported: 0,
                updated: 0,
                skipped: 0,
                errors: [{ row: 0, reason: err.message || 'Backend endpoint not available' }],
            });
            setStep('result');
        } finally {
            setImporting(false);
        }
    }, [parsedRows, sellerNameToId, stats.valid]);

    const handleFinish = useCallback(() => {
        onSuccess();
        handleClose();
    }, [onSuccess, handleClose]);

    // ─── Preview Table Columns ────────────────────────────
    const previewColumns = [
        {
            title: 'Row',
            dataIndex: 'rowIndex',
            key: 'rowIndex',
            width: 60,
            align: 'center' as const,
            render: (val: number) => (
                <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>#{val}</Text>
            ),
        },
        {
            title: 'Status',
            key: 'status',
            width: 90,
            align: 'center' as const,
            render: (_: any, record: ParsedRow) => (
                record.isValid ? (
                    <Tag icon={<CheckCircle size={11} />} color="success" style={{ borderRadius: 12, fontSize: 10, fontWeight: 700 }}>
                        VALID
                    </Tag>
                ) : (
                    <Tooltip title={record.errors.join(' • ')} placement="top">
                        <Tag icon={<XCircle size={11} />} color="error" style={{ borderRadius: 12, fontSize: 10, fontWeight: 700, cursor: 'help' }}>
                            ERROR
                        </Tag>
                    </Tooltip>
                )
            ),
        },
        {
            title: 'Brand Name',
            dataIndex: 'brandName',
            key: 'brandName',
            width: 180,
            render: (val: string, rec: ParsedRow) => (
                <div>
                    <Text strong style={{ fontSize: 12 }}>{val || '—'}</Text>
                    {rec.errors.some(e => e.toLowerCase().includes('brand')) && (
                        <div style={{ fontSize: 10, color: '#ef4444', marginTop: 2 }}>
                            ⚠ Not in database
                        </div>
                    )}
                </div>
            ),
        },
        {
            title: 'Manager',
            key: 'manager',
            width: 130,
            render: (_: any, rec: ParsedRow) => (
                <Text style={{ fontSize: 11, color: '#475569' }}>
                    {rec.managerId || rec.managerName || <Text type="secondary" italic>Auto</Text>}
                </Text>
            ),
        },
        {
            title: 'Period',
            key: 'period',
            width: 110,
            render: (_: any, rec: ParsedRow) => {
                if (!rec.year || !rec.month) return <Text type="danger" style={{ fontSize: 11 }}>Invalid</Text>;
                const monthName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][rec.month - 1];
                return (
                    <Tag style={{ borderRadius: 12, background: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb', fontWeight: 600, fontSize: 11 }}>
                        {monthName} {rec.year}
                    </Tag>
                );
            },
        },
        {
            title: 'Type',
            dataIndex: 'goalType',
            key: 'goalType',
            width: 110,
            render: (val: string) => val ? (
                <Tag style={{ borderRadius: 12, background: '#ede9fe', border: '1px solid #c4b5fd', color: '#7c3aed', fontWeight: 700, fontSize: 11 }}>
                    {val}
                </Tag>
            ) : <Text type="danger" style={{ fontSize: 11 }}>Missing</Text>,
        },
        {
            title: 'Achieved',
            dataIndex: 'achieved',
            key: 'achieved',
            width: 130,
            align: 'right' as const,
            render: (val: number, rec: ParsedRow) => {
                if (rec.errors.some(e => e.toLowerCase().includes('achieved'))) {
                    return <Text type="danger" style={{ fontSize: 11 }}>Invalid</Text>;
                }
                return (
                    <Text strong style={{ fontSize: 12, color: '#059669' }}>
                        {Number(val).toLocaleString('en-IN')}
                    </Text>
                );
            },
        },
        {
            title: 'Errors',
            key: 'errors',
            render: (_: any, rec: ParsedRow) => {
                if (rec.isValid) return <Text type="secondary" style={{ fontSize: 11 }}>—</Text>;
                return (
                    <Tooltip title={rec.errors.join(' • ')}>
                        <Text type="danger" style={{ fontSize: 10, fontStyle: 'italic' }} ellipsis>
                            {rec.errors[0]}
                        </Text>
                    </Tooltip>
                );
            },
        },
    ];

    // ═══════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════
    return (
        <Modal
            open={open}
            onCancel={handleClose}
            footer={null}
            width={1100}
            centered
            destroyOnHidden
            title={
                <Space size={10}>
                    <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <FileSpreadsheet size={18} color="white" />
                    </div>
                    <div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                            Import Target Achievements
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
                            Bulk import previous months' data via Excel
                        </div>
                    </div>
                </Space>
            }
            styles={{
                body: { padding: 0 },
                header: { padding: '20px 24px', borderBottom: '1px solid #e2e8f0' }
            }}
        >
            {/* ── STEP INDICATOR ───────────────────────── */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '16px 24px', background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0', gap: 24,
            }}>
                {[
                    { key: 'upload', label: 'Upload File', icon: <UploadIcon size={14} /> },
                    { key: 'preview', label: 'Preview & Validate', icon: <FileText size={14} /> },
                    { key: 'result', label: 'Complete', icon: <CheckCircle size={14} /> },
                ].map((s, idx) => {
                    const isActive = step === s.key || (step === 'importing' && s.key === 'preview');
                    const isComplete = (step === 'preview' && s.key === 'upload') ||
                        (step === 'importing' && s.key !== 'result') ||
                        (step === 'result' && s.key !== 'result');
                    return (
                        <React.Fragment key={s.key}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{
                                    width: 28, height: 28, borderRadius: '50%',
                                    background: isActive ? '#4f46e5' : isComplete ? '#10b981' : '#e2e8f0',
                                    color: isActive || isComplete ? '#fff' : '#64748b',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontWeight: 700, fontSize: 11,
                                    transition: 'all 0.3s',
                                }}>
                                    {isComplete ? <CheckCircle size={14} /> : s.icon}
                                </div>
                                <Text strong style={{
                                    fontSize: 12,
                                    color: isActive ? '#4f46e5' : isComplete ? '#10b981' : '#94a3b8',
                                }}>
                                    {s.label}
                                </Text>
                            </div>
                            {idx < 2 && (
                                <div style={{
                                    width: 60, height: 2,
                                    background: isComplete ? '#10b981' : '#e2e8f0',
                                    transition: 'background 0.3s',
                                }} />
                            )}
                        </React.Fragment>
                    );
                })}
            </div>

            {/* ═══════════════════════════════════════════
          STEP 1: UPLOAD
      ═══════════════════════════════════════════ */}
            {step === 'upload' && (
                <div style={{ padding: 24 }}>
                    <Alert
                        type="info"
                        showIcon
                        icon={<Sparkles size={16} />}
                        message="Download the template first"
                        description={
                            <div style={{ fontSize: 12 }}>
                                Use our template to ensure correct format. Required columns:{' '}
                                <Text code>Brand Name</Text>, <Text code>Month</Text>,{' '}
                                <Text code>Achieved</Text>, <Text code>Type</Text>.
                                <br />
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                  💡 Brand Manager will be auto-fetched from brand assignments.
                                </Text>
                            </div>
                        }
                        action={
                            <Button
                                icon={<Download size={14} />}
                                onClick={downloadTemplate}
                                type="primary"
                                style={{ background: '#4f46e5', borderColor: '#4f46e5' }}
                            >
                                Download Template
                            </Button>
                        }
                        style={{ marginBottom: 20, borderRadius: 10 }}
                    />

                    <Dragger {...uploadProps} disabled={parseLoading}>
                        <div style={{ padding: '24px 0' }}>
                            <div style={{
                                width: 64, height: 64, borderRadius: 16,
                                background: 'linear-gradient(135deg, #eef2ff, #ede9fe)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto 16px',
                            }}>
                                <UploadIcon size={28} color="#4f46e5" />
                            </div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
                                {parseLoading ? 'Reading file...' : 'Click or drag Excel file here'}
                            </div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>
                                Supports <Text strong>.xlsx</Text> and <Text strong>.xls</Text> files up to 10MB
                            </div>
                        </div>
                    </Dragger>

                    <div style={{
                        marginTop: 20, padding: 16, background: '#f8fafc',
                        borderRadius: 10, border: '1px solid #e2e8f0',
                    }}>
                        <Text strong style={{ fontSize: 12, color: '#475569', display: 'block', marginBottom: 8 }}>
                            📋 Required Excel Headers (case-insensitive):
                        </Text>
                        <Space wrap size={6}>
                            {['Brand Name', 'Month', 'Achieved', 'Type'].map(h => (
                                <Tag key={h} style={{ fontFamily: 'monospace', fontSize: 11, padding: '2px 8px' }}>
                                    {h}
                                </Tag>
                            ))}
                        </Space>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════
          STEP 2: PREVIEW
      ═══════════════════════════════════════════ */}
            {step === 'preview' && (
                <div style={{ padding: 24 }}>
                    {/* Stats Row */}
                    <Row gutter={12} style={{ marginBottom: 16 }}>
                        <Col span={6}>
                            <Card size="small" style={{ borderRadius: 10, borderColor: '#e2e8f0' }}>
                                <Statistic
                                    title={<Text style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>TOTAL ROWS</Text>}
                                    value={stats.total}
                                    prefix={<Database size={14} style={{ color: '#4f46e5' }} />}
                                    valueStyle={{ fontSize: 22, color: '#0f172a', fontWeight: 800 }}
                                />
                            </Card>
                        </Col>
                        <Col span={6}>
                            <Card size="small" style={{ borderRadius: 10, borderColor: '#d1fae5', background: '#f0fdf4' }}>
                                <Statistic
                                    title={<Text style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>VALID</Text>}
                                    value={stats.valid}
                                    prefix={<CheckCircle size={14} style={{ color: '#10b981' }} />}
                                    valueStyle={{ fontSize: 22, color: '#059669', fontWeight: 800 }}
                                />
                            </Card>
                        </Col>
                        <Col span={6}>
                            <Card size="small" style={{ borderRadius: 10, borderColor: '#fecaca', background: '#fef2f2' }}>
                                <Statistic
                                    title={<Text style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>WITH ERRORS</Text>}
                                    value={stats.invalid}
                                    prefix={<XCircle size={14} style={{ color: '#ef4444' }} />}
                                    valueStyle={{ fontSize: 22, color: '#dc2626', fontWeight: 800 }}
                                />
                            </Card>
                        </Col>
                        <Col span={6}>
                            <Card size="small" style={{ borderRadius: 10, borderColor: '#e2e8f0' }}>
                                <Text style={{ fontSize: 11, color: '#64748b', fontWeight: 600, display: 'block' }}>SUCCESS RATE</Text>
                                <Progress
                                    percent={Math.round(stats.validPct)}
                                    status={stats.validPct === 100 ? 'success' : stats.validPct >= 80 ? 'active' : 'exception'}
                                    strokeColor={stats.validPct === 100 ? '#10b981' : stats.validPct >= 80 ? '#4f46e5' : '#ef4444'}
                                    style={{ marginTop: 8, marginBottom: 0 }}
                                />
                            </Card>
                        </Col>
                    </Row>

                    {stats.invalid > 0 && (
                        <Alert
                            type="warning"
                            showIcon
                            icon={<AlertTriangle size={16} />}
                            message={`${stats.invalid} row(s) have errors and will be skipped during import.`}
                            description="Review the table below. Hover over the ERROR tag to see the issue."
                            style={{ marginBottom: 16, borderRadius: 10 }}
                        />
                    )}

                    {/* Preview Table */}
                    <Table
                        dataSource={parsedRows.map((r, i) => ({ ...r, key: i }))}
                        columns={previewColumns}
                        pagination={{ pageSize: 8, size: 'small', showSizeChanger: false }}
                        size="small"
                        scroll={{ x: 'max-content', y: 280 }}
                        bordered
                        rowClassName={(rec) => rec.isValid ? 'valid-row' : 'invalid-row'}
                        style={{ borderRadius: 10, overflow: 'hidden' }}
                    />

                    {/* Action Buttons */}
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        marginTop: 16, paddingTop: 16, borderTop: '1px solid #e2e8f0',
                    }}>
                        <Button onClick={handleReset} icon={<RefreshCw size={13} />}>
                            Upload Different File
                        </Button>
                        <Space>
                            <Button onClick={handleClose}>Cancel</Button>
                            <Button
                                type="primary"
                                icon={<Zap size={14} />}
                                onClick={handleImport}
                                disabled={stats.valid === 0}
                                style={{
                                    background: stats.valid === 0 ? '#cbd5e1' : 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                                    borderColor: 'transparent',
                                    fontWeight: 700,
                                    height: 36,
                                    paddingInline: 20,
                                    boxShadow: stats.valid > 0 ? '0 4px 12px rgba(79,70,229,0.3)' : 'none',
                                }}
                            >
                                Import {stats.valid} Valid Records
                            </Button>
                        </Space>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════
          STEP 3: IMPORTING
      ═══════════════════════════════════════════ */}
            {step === 'importing' && (
                <div style={{ padding: 60, textAlign: 'center' }}>
                    <div style={{
                        width: 80, height: 80, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 20px',
                        animation: 'pulse 1.5s ease-in-out infinite',
                    }}>
                        <Database size={36} color="white" />
                    </div>
                    <Title level={4} style={{ margin: 0, color: '#0f172a' }}>
                        Importing your data...
                    </Title>
                    <Text style={{ color: '#64748b', fontSize: 13, display: 'block', marginTop: 6 }}>
                        Please wait while we process {stats.valid} records
                    </Text>
                    <Progress
                        percent={50}
                        status="active"
                        showInfo={false}
                        strokeColor={{ from: '#4f46e5', to: '#7c3aed' }}
                        style={{ maxWidth: 320, margin: '24px auto 0' }}
                    />
                </div>
            )}

            {/* ═══════════════════════════════════════════
          STEP 4: RESULT
      ═══════════════════════════════════════════ */}
            {step === 'result' && importResult && (
                <div style={{ padding: 32 }}>
                    <div style={{ textAlign: 'center', marginBottom: 24 }}>
                        <div style={{
                            width: 72, height: 72, borderRadius: '50%',
                            background: importResult.success
                                ? 'linear-gradient(135deg, #10b981, #059669)'
                                : 'linear-gradient(135deg, #ef4444, #dc2626)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 16px',
                            boxShadow: importResult.success
                                ? '0 10px 30px rgba(16,185,129,0.3)'
                                : '0 10px 30px rgba(239,68,68,0.3)',
                        }}>
                            {importResult.success
                                ? <CheckCircle size={36} color="white" />
                                : <XCircle size={36} color="white" />}
                        </div>
                        <Title level={3} style={{ margin: 0, color: '#0f172a' }}>
                            {importResult.success ? 'Import Successful!' : 'Import Failed'}
                        </Title>
                        <Text style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>
                            {importResult.message || (importResult.success
                                ? 'Your target achievement data has been imported successfully'
                                : 'Some errors occurred during import')}
                        </Text>
                    </div>

                    <Row gutter={12} style={{ marginBottom: 20 }}>
                        <Col span={8}>
                            <Card size="small" style={{ borderRadius: 10, textAlign: 'center', borderColor: '#d1fae5', background: '#f0fdf4' }}>
                                <div style={{ fontSize: 28, fontWeight: 800, color: '#059669' }}>
                                    {importResult.imported || 0}
                                </div>
                                <Text style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>NEW IMPORTED</Text>
                            </Card>
                        </Col>
                        <Col span={8}>
                            <Card size="small" style={{ borderRadius: 10, textAlign: 'center', borderColor: '#bfdbfe', background: '#eff6ff' }}>
                                <div style={{ fontSize: 28, fontWeight: 800, color: '#2563eb' }}>
                                    {importResult.updated || 0}
                                </div>
                                <Text style={{ fontSize: 11, color: '#2563eb', fontWeight: 600 }}>UPDATED</Text>
                            </Card>
                        </Col>
                        <Col span={8}>
                            <Card size="small" style={{ borderRadius: 10, textAlign: 'center', borderColor: '#fde68a', background: '#fffbeb' }}>
                                <div style={{ fontSize: 28, fontWeight: 800, color: '#d97706' }}>
                                    {importResult.skipped || 0}
                                </div>
                                <Text style={{ fontSize: 11, color: '#d97706', fontWeight: 600 }}>SKIPPED</Text>
                            </Card>
                        </Col>
                    </Row>

                    {importResult.errors?.length > 0 && (
                        <Alert
                            type="error"
                            message={`${importResult.errors.length} error(s) occurred`}
                            description={
                                <div style={{ maxHeight: 120, overflowY: 'auto' }}>
                                    {importResult.errors.slice(0, 10).map((e: any, i: number) => (
                                        <div key={i} style={{ fontSize: 12, marginBottom: 4 }}>
                                            <Text strong>Row {e.row}:</Text> {e.reason}
                                        </div>
                                    ))}
                                    {importResult.errors.length > 10 && (
                                        <Text type="secondary" style={{ fontSize: 11 }}>
                                            ...and {importResult.errors.length - 10} more
                                        </Text>
                                    )}
                                </div>
                            }
                            style={{ marginBottom: 20, borderRadius: 10 }}
                        />
                    )}

                    <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
                        <Button onClick={handleReset} icon={<UploadIcon size={13} />}>
                            Import More
                        </Button>
                        <Button
                            type="primary"
                            onClick={handleFinish}
                            style={{
                                background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                                borderColor: 'transparent',
                                fontWeight: 700,
                                paddingInline: 24,
                            }}
                        >
                            Done
                        </Button>
                    </div>
                </div>
            )}

            <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.9; }
        }
        .valid-row { background: #fefffe; }
        .invalid-row { background: #fef2f2 !important; }
        .invalid-row:hover td { background: #fee2e2 !important; }
      `}</style>
        </Modal>
    );
};

export default ImportTargetsModal;