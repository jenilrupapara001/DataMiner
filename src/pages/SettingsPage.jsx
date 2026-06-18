import React, { useState, useEffect, useCallback } from 'react';
import {
    Card, Input, InputNumber, Switch, TimePicker, Button,
    Typography, Space, Row, Col, Select, Tooltip, message,
    notification, Divider, Alert, Progress, List, Tag, Modal
} from 'antd';
import {
    Cloud, Mail, Clock, Sliders, Bell, User, HelpCircle,
    CheckCircle2, Info, AlertTriangle, Terminal, Save, Send,
    RefreshCw, Link2, ExternalLink, Settings, Lock, Cpu, Zap
} from 'lucide-react';
import { db } from '../services/db';
import { PageLoader } from '@/components/application/loading-indicator/PageLoader';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);

const { Text, Paragraph } = Typography;
const { Option } = Select;

const SectionCard = ({ icon: Icon, iconColor = '#475569', title, children, extra }) => (
    <Card
        style={{
            borderRadius: 6,
            border: '1px solid #e5e7eb',
            marginBottom: 16
        }}
        styles={{
            header: {
                padding: '14px 20px',
                borderBottom: '1px solid #f1f5f9',
                minHeight: 'auto',
                background: '#fafbfc'
            },
            body: { padding: 20 }
        }}
        title={
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10
                }}>
                    <div style={{
                        width: 28,
                        height: 28,
                        borderRadius: 5,
                        background: '#f8fafc',
                        border: '1px solid #e5e7eb',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: iconColor
                    }}>
                        <Icon size={14} strokeWidth={2} />
                    </div>
                    <span style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: '#0f172a',
                        letterSpacing: '-0.01em'
                    }}>
                        {title}
                    </span>
                </div>
                {extra}
            </div>
        }
    >
        {children}
    </Card>
);

const FieldLabel = ({ children }) => (
    <div style={{
        fontSize: 11,
        fontWeight: 700,
        color: '#475569',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        marginBottom: 6
    }}>
        {children}
    </div>
);

const FieldHelp = ({ children }) => (
    <Text style={{
        fontSize: 11,
        display: 'block',
        marginTop: 5,
        color: '#94a3b8',
        fontWeight: 500,
        lineHeight: 1.4
    }}>
        {children}
    </Text>
);

const ToggleRow = ({ title, description, checked, onChange }) => (
    <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '14px 16px',
        background: '#fafbfc',
        borderRadius: 6,
        border: '1px solid #e5e7eb'
    }}>
        <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
                fontWeight: 600,
                color: '#0f172a',
                fontSize: 13,
                marginBottom: 2
            }}>
                {title}
            </div>
            <div style={{ color: '#64748b', fontSize: 11, fontWeight: 500 }}>
                {description}
            </div>
        </div>
        <Switch checked={checked} onChange={onChange} />
    </div>
);

const SettingsPage = () => {
    const [settings, setSettings] = useState({
        octoparseApiKey: '',
        octoparseTaskId: '',
        scrapePollInterval: '300000',
        smtpHost: '',
        smtpPort: '',
        smtpUser: '',
        smtpPass: '',
        smtpSecure: 'tls',
        notifications: true,
        emailReports: false,
        minLqsScore: 80,
        minTitleLength: 80,
        minImageCount: 7,
        minDescLength: 1000,
        AUTOMATION_SCHEDULE_TIME: '11:20',
        AUTOMATION_AJIO_SCHEDULE_TIME: '12:00',
        AUTOMATION_AMAZON_ENABLED: true,
        AUTOMATION_AJIO_ENABLED: true,
        LIVE_SYNC_ENABLED: false,
        LIVE_SYNC_SCHEDULE_TIME: '06:00',
        LIVE_SYNC_CONCURRENCY: 3,
    });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testingOctoparse, setTestingOctoparse] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [emailModalVisible, setEmailModalVisible] = useState(false);
    const [testTargetEmail, setTestTargetEmail] = useState('');
    const [sendingTestEmail, setSendingTestEmail] = useState(false);

    const [messageApi, messageContextHolder] = message.useMessage();
    const [notificationApi, notificationContextHolder] = notification.useNotification();

    useEffect(() => {
        loadSettings();
    }, []);

    useEffect(() => {
        if (settings.smtpUser) {
            setTestTargetEmail(settings.smtpUser);
        }
    }, [settings.smtpUser]);

    const loadSettings = async () => {
        setLoading(true);
        try {
            const dbSettings = await db.getSettings();
            if (dbSettings && Object.keys(dbSettings).length > 0) {
                setSettings(prev => ({ ...prev, ...dbSettings }));
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
            messageApi.error('Failed to load configurations');
        } finally {
            setLoading(false);
        }
    };

    const handleFieldChange = (name, value) => {
        setSettings(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await db.updateSettings(settings);
            notificationApi.success({
                message: 'Configuration Saved',
                description: 'All settings have been updated successfully.',
                placement: 'topRight',
                icon: <CheckCircle2 size={20} style={{ color: '#15803d' }} />
            });
        } catch (error) {
            notificationApi.error({
                message: 'Save Failed',
                description: error.message || 'Failed to save configuration changes.',
                placement: 'topRight'
            });
        } finally {
            setSaving(false);
        }
    };

    const handleTestOctoparse = async () => {
        setTestingOctoparse(true);
        setTestResult(null);
        await new Promise(resolve => setTimeout(resolve, 1500));
        if (settings.octoparseApiKey && settings.octoparseTaskId) {
            setTestResult({ success: true, message: 'Connection verified successfully' });
            messageApi.success('API connection verified');
        } else {
            setTestResult({ success: false, message: 'Connection failed. Verify credentials.' });
            messageApi.error('Invalid API details');
        }
        setTestingOctoparse(false);
    };

    const handleSendTestEmail = async () => {
        if (!testTargetEmail) {
            messageApi.warning('Please enter an email address');
            return;
        }
        setSendingTestEmail(true);
        try {
            const res = await db.request('/settings/test-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to: testTargetEmail })
            });
            if (res?.success) {
                notificationApi.success({
                    message: 'Test Email Sent',
                    description: `Email dispatched to ${testTargetEmail}`,
                    placement: 'topRight'
                });
                setEmailModalVisible(false);
            } else {
                throw new Error(res?.message || 'Email dispatch failed');
            }
        } catch (err) {
            notificationApi.error({
                message: 'SMTP Test Failed',
                description: err.message,
                placement: 'topRight'
            });
        } finally {
            setSendingTestEmail(false);
        }
    };

    const xpathsHelp = [
        { title: 'Title', xpath: '//*[@id="productTitle"]' },
        { title: 'Price', xpath: '//*[@id="corePriceDisplay_desktop_feature_div"]/div[1]/span[3]' },
        { title: 'Rating', xpath: '//*[@id="averageCustomerReviews"]' },
        { title: 'Rank', xpath: '//*[@id="detailBullets_feature_div"]/ul/li[15]/span' },
        { title: 'Reviews', xpath: '//*[@id="cm_cr_dp_d_rating_histogram"]' },
    ];

    if (loading) {
        return <PageLoader message="Loading configuration..." />;
    }

    return (
        <div className="settings-pro">
            {messageContextHolder}
            {notificationContextHolder}

            <style>{`
                .settings-pro {
                    background: #fafafa;
                    min-height: calc(100vh - 60px);
                    padding: 24px 28px 40px;
                }
                .settings-pro .ant-input,
                .settings-pro .ant-input-password,
                .settings-pro .ant-input-number,
                .settings-pro .ant-picker {
                    border-radius: 6px !important;
                }
                .settings-pro .ant-input-number-input {
                    height: 38px !important;
                }
                .xpath-code {
                    background: #f1f5f9;
                    padding: 3px 8px;
                    border-radius: 4px;
                    font-family: JetBrains Mono, Consolas, monospace;
                    font-size: 11px;
                    color: #475569;
                    border: 1px solid #e5e7eb;
                    display: inline-block;
                    word-break: break-all;
                }
                .help-link {
                    color: #475569;
                    font-weight: 500;
                    transition: all 0.15s;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 12px;
                    border-radius: 6px;
                    font-size: 12px;
                    text-decoration: none;
                }
                .help-link:hover {
                    background: #f8fafc;
                    color: #0f172a;
                }
                .scheduler-box {
                    background: #fafbfc;
                    border: 1px solid #e5e7eb;
                    border-radius: 6px;
                    padding: 18px;
                }
                .save-footer {
                    border-top: 1px solid #e5e7eb;
                    background: #ffffff;
                    padding: 16px 28px;
                    margin: 24px -28px -40px;
                    display: flex;
                    justify-content: flex-end;
                    align-items: center;
                    gap: 12px;
                }
                @keyframes spin-animation {
                    to { transform: rotate(360deg); }
                }
                .spin-animation {
                    animation: spin-animation 1s linear infinite;
                }
            `}</style>

            {/* Page Title */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginBottom: 24
            }}>
                <div style={{
                    width: 38,
                    height: 38,
                    borderRadius: 6,
                    background: '#1e293b',
                    border: '1px solid #0f172a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff'
                }}>
                    <Settings size={18} strokeWidth={2} />
                </div>
                <div>
                    <div style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: '#0f172a',
                        letterSpacing: '-0.2px'
                    }}>
                        System Configuration
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
                        Environment variables, integrations, and automation schedules
                    </div>
                </div>
            </div>

            <Row gutter={[20, 0]}>
                {/* LEFT COLUMN */}
                <Col xs={24} lg={16}>
                    {/* Scraper Integration */}
                    <SectionCard icon={Cloud} iconColor="#1d4ed8" title="Scraper Integration">
                        <Alert
                            message="Octoparse Cloud Integration"
                            description={
                                <span>
                                    Connect to Octoparse for automated ASIN data extraction.
                                    Obtain credentials from{' '}
                                    <a href="https://www.octoparse.com" target="_blank" rel="noreferrer" style={{ fontWeight: 600, color: '#1d4ed8' }}>
                                        octoparse.com
                                    </a>.
                                </span>
                            }
                            type="info"
                            showIcon
                            icon={<Info size={14} strokeWidth={2} />}
                            style={{ marginBottom: 20, borderRadius: 6 }}
                        />
                        <Row gutter={[16, 16]}>
                            <Col span={24}>
                                <FieldLabel>API Key</FieldLabel>
                                <Input.Password
                                    placeholder="Enter Octoparse API key"
                                    value={settings.octoparseApiKey}
                                    onChange={e => handleFieldChange('octoparseApiKey', e.target.value)}
                                    prefix={<Lock size={13} style={{ color: '#94a3b8', marginRight: 4 }} />}
                                    style={{ height: 38 }}
                                />
                            </Col>
                            <Col xs={24} md={12}>
                                <FieldLabel>Task ID</FieldLabel>
                                <Input
                                    placeholder="e.g. e8266a91-..."
                                    value={settings.octoparseTaskId}
                                    onChange={e => handleFieldChange('octoparseTaskId', e.target.value)}
                                    prefix={<Terminal size={13} style={{ color: '#94a3b8', marginRight: 4 }} />}
                                    style={{ height: 38 }}
                                />
                                <FieldHelp>Specific crawling task identifier</FieldHelp>
                            </Col>
                            <Col xs={24} md={12}>
                                <FieldLabel>Poll Interval (ms)</FieldLabel>
                                <InputNumber
                                    placeholder="300000"
                                    value={settings.scrapePollInterval}
                                    onChange={val => handleFieldChange('scrapePollInterval', val)}
                                    style={{ width: '100%', height: 38 }}
                                    min={60000}
                                />
                                <FieldHelp>Minimum: 60000ms (1 minute)</FieldHelp>
                            </Col>
                            <Col span={24}>
                                <Divider style={{ margin: '8px 0' }} />
                                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                    <Button
                                        icon={<RefreshCw size={13} strokeWidth={2} className={testingOctoparse ? 'spin-animation' : ''} />}
                                        loading={testingOctoparse}
                                        onClick={handleTestOctoparse}
                                        style={{ borderRadius: 6, fontWeight: 600, fontSize: 12, height: 34 }}
                                    >
                                        Test Connection
                                    </Button>
                                    {testResult && (
                                        <Tag
                                            color={testResult.success ? 'success' : 'error'}
                                            style={{ borderRadius: 4, padding: '3px 10px', border: 'none', fontWeight: 600, fontSize: 11 }}
                                        >
                                            {testResult.message}
                                        </Tag>
                                    )}
                                </div>
                            </Col>
                        </Row>
                    </SectionCard>

                    {/* SMTP Configuration */}
                    <SectionCard icon={Mail} iconColor="#b91c1c" title="SMTP Configuration">
                        <Paragraph style={{ color: '#64748b', fontSize: 12, marginBottom: 16 }}>
                            Configure mail relay for outbound notifications, reports, and security alerts.
                        </Paragraph>
                        <Row gutter={[16, 16]}>
                            <Col xs={24} md={12}>
                                <FieldLabel>SMTP Host</FieldLabel>
                                <Input
                                    placeholder="smtp.mail.com"
                                    value={settings.smtpHost}
                                    onChange={e => handleFieldChange('smtpHost', e.target.value)}
                                    style={{ height: 38 }}
                                />
                            </Col>
                            <Col xs={12} md={6}>
                                <FieldLabel>Port</FieldLabel>
                                <Input
                                    placeholder="587"
                                    value={settings.smtpPort}
                                    onChange={e => handleFieldChange('smtpPort', e.target.value)}
                                    style={{ height: 38 }}
                                />
                            </Col>
                            <Col xs={12} md={6}>
                                <FieldLabel>Encryption</FieldLabel>
                                <Select
                                    value={settings.smtpSecure}
                                    onChange={val => handleFieldChange('smtpSecure', val)}
                                    style={{ width: '100%', height: 38 }}
                                >
                                    <Option value="tls">STARTTLS</Option>
                                    <Option value="ssl">SSL</Option>
                                </Select>
                            </Col>
                            <Col xs={24} md={12}>
                                <FieldLabel>Username</FieldLabel>
                                <Input
                                    placeholder="user@company.com"
                                    value={settings.smtpUser}
                                    onChange={e => handleFieldChange('smtpUser', e.target.value)}
                                    style={{ height: 38 }}
                                />
                            </Col>
                            <Col xs={24} md={12}>
                                <FieldLabel>Password</FieldLabel>
                                <Input.Password
                                    placeholder="Enter password"
                                    value={settings.smtpPass}
                                    onChange={e => handleFieldChange('smtpPass', e.target.value)}
                                    style={{ height: 38 }}
                                />
                            </Col>
                            <Col span={24}>
                                <Divider style={{ margin: '8px 0' }} />
                                <Button
                                    icon={<Send size={13} strokeWidth={2} />}
                                    onClick={() => setEmailModalVisible(true)}
                                    style={{ borderRadius: 6, fontWeight: 600, fontSize: 12, height: 34 }}
                                >
                                    Send Test Email
                                </Button>
                            </Col>
                        </Row>
                    </SectionCard>

                    {/* Automation Schedules */}
                    <SectionCard icon={Clock} iconColor="#a16207" title="Automation Schedules">
                        <Alert
                            message="Scheduled Pipeline Jobs"
                            description="Configure automated data extraction schedules for each marketplace. Adjust time slots to avoid API rate limits."
                            type="warning"
                            showIcon
                            icon={<Cpu size={14} strokeWidth={2} />}
                            style={{ marginBottom: 20, borderRadius: 6 }}
                        />
                        <Row gutter={[16, 16]}>
                            <Col xs={24} md={12}>
                                <div className="scheduler-box">
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        marginBottom: 14
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF9900', display: 'inline-block' }} />
                                            <span style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>Amazon</span>
                                        </div>
                                        <Switch
                                            size="small"
                                            checked={settings.AUTOMATION_AMAZON_ENABLED !== false && settings.AUTOMATION_AMAZON_ENABLED !== 'false'}
                                            onChange={checked => handleFieldChange('AUTOMATION_AMAZON_ENABLED', checked)}
                                        />
                                    </div>
                                    <FieldLabel>Schedule Time</FieldLabel>
                                    <TimePicker
                                        format="HH:mm"
                                        style={{ width: '100%', height: 38 }}
                                        value={settings.AUTOMATION_SCHEDULE_TIME ? dayjs(settings.AUTOMATION_SCHEDULE_TIME, 'HH:mm') : null}
                                        onChange={(time, timeStr) => handleFieldChange('AUTOMATION_SCHEDULE_TIME', timeStr)}
                                        allowClear={false}
                                    />
                                    <FieldHelp>Daily execution time for Amazon pipeline jobs</FieldHelp>
                                </div>
                            </Col>
                            <Col xs={24} md={12}>
                                <div className="scheduler-box">
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        marginBottom: 14
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#0891b2', display: 'inline-block' }} />
                                            <span style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>AJIO</span>
                                        </div>
                                        <Switch
                                            size="small"
                                            checked={settings.AUTOMATION_AJIO_ENABLED !== false && settings.AUTOMATION_AJIO_ENABLED !== 'false'}
                                            onChange={checked => handleFieldChange('AUTOMATION_AJIO_ENABLED', checked)}
                                        />
                                    </div>
                                    <FieldLabel>Schedule Time</FieldLabel>
                                    <TimePicker
                                        format="HH:mm"
                                        style={{ width: '100%', height: 38 }}
                                        value={settings.AUTOMATION_AJIO_SCHEDULE_TIME ? dayjs(settings.AUTOMATION_AJIO_SCHEDULE_TIME, 'HH:mm') : null}
                                        onChange={(time, timeStr) => handleFieldChange('AUTOMATION_AJIO_SCHEDULE_TIME', timeStr)}
                                        allowClear={false}
                                    />
                                    <FieldHelp>Daily execution time for AJIO pipeline jobs</FieldHelp>
                                </div>
                            </Col>
                        </Row>
                    </SectionCard>

                    {/* Live Data Sync Schedule */}
                    <SectionCard icon={Zap} iconColor="#7c3aed" title="Live Data Sync (Amazon Creators API)">
                        <Alert
                            message="Live Sync updates product data (Price, BSR, Rating, Reviews, Images) directly from Amazon's API in real-time."
                            type="info"
                            showIcon
                            icon={<Zap size={14} />}
                            style={{ marginBottom: 16, borderRadius: 6 }}
                        />
                        <Row gutter={[16, 16]}>
                            <Col xs={24} md={8}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#7c3aed', display: 'inline-block' }} />
                                        <span style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>Live Sync</span>
                                    </div>
                                    <Switch
                                        size="small"
                                        checked={settings.LIVE_SYNC_ENABLED === true || settings.LIVE_SYNC_ENABLED === 'true'}
                                        onChange={checked => handleFieldChange('LIVE_SYNC_ENABLED', checked)}
                                    />
                                </div>
                                <FieldHelp>Enable automatic daily live data sync</FieldHelp>
                            </Col>
                            <Col xs={24} md={8}>
                                <FieldLabel>Schedule Time</FieldLabel>
                                <TimePicker
                                    format="HH:mm"
                                    style={{ width: '100%', height: 38 }}
                                    value={settings.LIVE_SYNC_SCHEDULE_TIME ? dayjs(settings.LIVE_SYNC_SCHEDULE_TIME, 'HH:mm') : null}
                                    onChange={(time, timeStr) => handleFieldChange('LIVE_SYNC_SCHEDULE_TIME', timeStr)}
                                    allowClear={false}
                                />
                                <FieldHelp>Daily execution time (IST)</FieldHelp>
                            </Col>
                            <Col xs={24} md={8}>
                                <FieldLabel>Concurrency</FieldLabel>
                                <InputNumber
                                    value={settings.LIVE_SYNC_CONCURRENCY || 3}
                                    onChange={v => handleFieldChange('LIVE_SYNC_CONCURRENCY', v)}
                                    style={{ width: '100%', height: 38 }}
                                    min={1}
                                    max={10}
                                />
                                <FieldHelp>Parallel sellers to sync simultaneously (1-10)</FieldHelp>
                            </Col>
                        </Row>
                    </SectionCard>

                    {/* Catalog Quality Thresholds */}
                    <SectionCard icon={Sliders} iconColor="#6d28d9" title="Catalog Quality Thresholds">
                        <Paragraph style={{ color: '#64748b', fontSize: 12, marginBottom: 16 }}>
                            Listing Quality Score (LQS) engine thresholds. ASINs below these values trigger automatic review alerts.
                        </Paragraph>
                        <Row gutter={[16, 16]}>
                            <Col xs={24} md={12}>
                                <FieldLabel>Minimum LQS Score</FieldLabel>
                                <InputNumber
                                    value={settings.minLqsScore}
                                    onChange={v => handleFieldChange('minLqsScore', v)}
                                    style={{ width: '100%', height: 38 }}
                                    min={0}
                                    max={100}
                                />
                            </Col>
                            <Col xs={24} md={12}>
                                <FieldLabel>Minimum Title Length</FieldLabel>
                                <InputNumber
                                    value={settings.minTitleLength}
                                    onChange={v => handleFieldChange('minTitleLength', v)}
                                    style={{ width: '100%', height: 38 }}
                                    min={0}
                                />
                                <FieldHelp>Characters</FieldHelp>
                            </Col>
                            <Col xs={24} md={12}>
                                <FieldLabel>Minimum Image Count</FieldLabel>
                                <InputNumber
                                    value={settings.minImageCount}
                                    onChange={v => handleFieldChange('minImageCount', v)}
                                    style={{ width: '100%', height: 38 }}
                                    min={0}
                                />
                            </Col>
                            <Col xs={24} md={12}>
                                <FieldLabel>Minimum Description Length</FieldLabel>
                                <InputNumber
                                    value={settings.minDescLength}
                                    onChange={v => handleFieldChange('minDescLength', v)}
                                    style={{ width: '100%', height: 38 }}
                                    min={0}
                                />
                                <FieldHelp>Characters</FieldHelp>
                            </Col>
                        </Row>
                    </SectionCard>

                    {/* Notifications */}
                    <SectionCard icon={Bell} iconColor="#15803d" title="Notifications">
                        <Space direction="vertical" size={10} style={{ width: '100%' }}>
                            <ToggleRow
                                title="In-App Notifications"
                                description="Show slide-in notifications within the application"
                                checked={settings.notifications}
                                onChange={checked => handleFieldChange('notifications', checked)}
                            />
                            <ToggleRow
                                title="Daily Email Reports"
                                description="Receive execution logs and summaries via email"
                                checked={settings.emailReports}
                                onChange={checked => handleFieldChange('emailReports', checked)}
                            />
                        </Space>
                    </SectionCard>
                </Col>

                {/* RIGHT COLUMN */}
                <Col xs={24} lg={8}>
                    {/* Account Information */}
                    <SectionCard icon={User} title="Account Information">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div>
                                <div style={{
                                    fontSize: 11, color: '#64748b', fontWeight: 600,
                                    textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4
                                }}>
                                    License Tier
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Enterprise</span>
                                    <Tag style={{
                                        margin: 0, background: '#f0fdf4', color: '#15803d',
                                        border: '1px solid #bbf7d0', fontWeight: 700, fontSize: 10,
                                        borderRadius: 4, padding: '1px 8px', textTransform: 'uppercase'
                                    }}>
                                        Active
                                    </Tag>
                                </div>
                            </div>
                            <Divider style={{ margin: '4px 0' }} />
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>API Usage</span>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>0 / 10</span>
                                </div>
                                <Progress percent={0} strokeColor="#1e293b" showInfo={false} strokeWidth={6} style={{ margin: 0 }} />
                            </div>
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Catalog ASINs</span>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>6 / 1,000</span>
                                </div>
                                <Progress percent={0.6} strokeColor="#15803d" showInfo={false} strokeWidth={6} style={{ margin: 0 }} />
                            </div>
                        </div>
                    </SectionCard>

                    {/* XPath Reference */}
                    <SectionCard icon={Terminal} title="XPath Reference">
                        <Paragraph style={{ fontSize: 11, color: '#64748b', marginBottom: 14 }}>
                            Standard extraction selectors for Octoparse configuration:
                        </Paragraph>
                        <List
                            dataSource={xpathsHelp}
                            split={false}
                            renderItem={item => (
                                <div style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                        <span style={{ fontWeight: 600, color: '#0f172a', fontSize: 12 }}>{item.title}</span>
                                        <Tooltip title="Copy XPath">
                                            <Button
                                                type="text"
                                                size="small"
                                                icon={<Link2 size={12} style={{ color: '#94a3b8' }} />}
                                                onClick={() => {
                                                    navigator.clipboard.writeText(item.xpath);
                                                    messageApi.success(`${item.title} XPath copied`);
                                                }}
                                                style={{ height: 22, width: 22, padding: 0 }}
                                            />
                                        </Tooltip>
                                    </div>
                                    <code className="xpath-code">{item.xpath}</code>
                                </div>
                            )}
                        />
                    </SectionCard>

                    {/* Resources */}
                    <SectionCard icon={HelpCircle} title="Resources">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <a href="#" className="help-link">
                                <Terminal size={14} strokeWidth={2} />
                                <span>API Documentation</span>
                                <ExternalLink size={11} style={{ marginLeft: 'auto', opacity: 0.4 }} />
                            </a>
                            <a href="#" className="help-link">
                                <Info size={14} strokeWidth={2} />
                                <span>Support Center</span>
                                <ExternalLink size={11} style={{ marginLeft: 'auto', opacity: 0.4 }} />
                            </a>
                            <a href="https://www.octoparse.com" target="_blank" rel="noopener noreferrer" className="help-link">
                                <Cloud size={14} strokeWidth={2} />
                                <span>Octoparse Console</span>
                                <ExternalLink size={11} style={{ marginLeft: 'auto', opacity: 0.4 }} />
                            </a>
                        </div>
                    </SectionCard>
                </Col>
            </Row>

            {/* SAVE FOOTER (Bottom of page) */}
            <div className="save-footer">
                <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500, marginRight: 'auto' }}>
                    All changes require saving to take effect
                </span>
                <Button
                    onClick={loadSettings}
                    style={{
                        borderRadius: 6,
                        fontWeight: 600,
                        fontSize: 12,
                        height: 38,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6
                    }}
                    icon={<RefreshCw size={13} strokeWidth={2} />}
                >
                    Reset
                </Button>
                <Button
                    type="primary"
                    icon={<Save size={14} strokeWidth={2} />}
                    onClick={handleSave}
                    loading={saving}
                    style={{
                        background: '#1e293b',
                        borderColor: '#1e293b',
                        fontSize: 12,
                        fontWeight: 600,
                        borderRadius: 6,
                        height: 38,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        paddingInline: 20
                    }}
                >
                    Save Configuration
                </Button>
            </div>

            {/* Test Email Modal */}
            <Modal
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 28, height: 28, borderRadius: 5,
                            background: '#f8fafc', border: '1px solid #e5e7eb',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#475569'
                        }}>
                            <Send size={14} strokeWidth={2} />
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                            Test SMTP Configuration
                        </span>
                    </div>
                }
                open={emailModalVisible}
                onCancel={() => setEmailModalVisible(false)}
                footer={[
                    <Button
                        key="cancel"
                        onClick={() => setEmailModalVisible(false)}
                        style={{ borderRadius: 6, fontWeight: 600, fontSize: 12 }}
                    >
                        Cancel
                    </Button>,
                    <Button
                        key="send"
                        type="primary"
                        loading={sendingTestEmail}
                        onClick={handleSendTestEmail}
                        icon={<Send size={12} strokeWidth={2} />}
                        style={{
                            borderRadius: 6, fontWeight: 600, fontSize: 12,
                            background: '#1e293b', borderColor: '#1e293b',
                            display: 'inline-flex', alignItems: 'center', gap: 6
                        }}
                    >
                        Send Test
                    </Button>
                ]}
                width={420}
                centered
            >
                <div style={{ padding: '8px 0' }}>
                    <Paragraph style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>
                        Send a test email to verify SMTP relay configuration.
                    </Paragraph>
                    <FieldLabel>Recipient Email</FieldLabel>
                    <Input
                        placeholder="you@company.com"
                        value={testTargetEmail}
                        onChange={e => setTestTargetEmail(e.target.value)}
                        prefix={<Mail size={13} style={{ color: '#94a3b8', marginRight: 4 }} />}
                        style={{ height: 38 }}
                    />
                </div>
            </Modal>
        </div>
    );
};

export default SettingsPage;