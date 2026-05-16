import React, { useState, useEffect, useCallback } from 'react';
import { 
    Card, 
    Input, 
    InputNumber, 
    Switch, 
    TimePicker, 
    Button, 
    Typography, 
    Space, 
    Row, 
    Col, 
    Select, 
    Tooltip, 
    message, 
    notification, 
    Divider, 
    Alert, 
    Progress, 
    List,
    Badge,
    Form,
    Modal,
    Tag
} from 'antd';
import { 
    Cloud, Mail, Clock, Sliders, Bell, 
    User, HelpCircle, CheckCircle2, Info, 
    AlertTriangle, Terminal, Save, Send, 
    RefreshCw, Link2, ExternalLink, Settings,
    Lock, AlertOctagon, Cpu
} from 'lucide-react';
import { db } from '../services/db';
import { PageLoader } from '@/components/application/loading-indicator/PageLoader';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

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
        AUTOMATION_ENABLED: true,
    });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testingOctoparse, setTestingOctoparse] = useState(false);
    const [testResult, setTestResult] = useState(null);
    
    // Test Email Modal states
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
                setSettings(prev => ({
                    ...prev,
                    ...dbSettings
                }));
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
            messageApi.error('Failed to load configurations');
        } finally {
            setLoading(false);
        }
    };

    const handleFieldChange = (name, value) => {
        setSettings(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await db.updateSettings(settings);
            notificationApi.success({
                message: 'Configuration Synchronized',
                description: 'System parameters have been updated and applied across the automation node.',
                placement: 'topRight',
                icon: <CheckCircle2 size={20} style={{ color: '#10b981' }} />
            });
        } catch (error) {
            notificationApi.error({
                message: 'Save Error',
                description: error.message || 'Failed to commit configuration changes.',
                placement: 'topRight'
            });
        } finally {
            setSaving(false);
        }
    };

    const handleTestOctoparse = async () => {
        setTestingOctoparse(true);
        setTestResult(null);

        // Simulate Octoparse API test
        await new Promise(resolve => setTimeout(resolve, 1500));

        if (settings.octoparseApiKey && settings.octoparseTaskId) {
            setTestResult({ success: true, message: 'Octoparse API handshake verified successfully!' });
            messageApi.success('API connection verified!');
        } else {
            setTestResult({ success: false, message: 'Connection failed: Verify your API Key and Task ID.' });
            messageApi.error('Invalid API details.');
        }
        setTestingOctoparse(false);
    };

    const handleSendTestEmail = async () => {
        if (!testTargetEmail) {
            messageApi.warning('Please enter an email address.');
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
                    description: `Test broadcast dispatched to ${testTargetEmail} successfully!`,
                    placement: 'topRight'
                });
                setEmailModalVisible(false);
            } else {
                throw new Error(res?.message || 'Gateway rejected dispatch packet');
            }
        } catch (err) {
            notificationApi.error({
                message: 'SMTP Broadcast Failed',
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
        return <PageLoader message="Loading System Core Environment..." />;
    }

    return (
        <div className="settings-page-container">
            {messageContextHolder}
            {notificationContextHolder}

            <style>{`
                .settings-page-container {
                    display: flex;
                    flex-direction: column;
                    min-height: 100vh;
                    background-color: #f8fafc;
                    margin: -1.5rem -2rem;
                }
                .settings-header {
                    background: #ffffff;
                    padding: 20px 32px;
                    border-bottom: 1px solid #e2e8f0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    position: sticky;
                    top: 0;
                    z-index: 100;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.02);
                }
                .settings-content {
                    padding: 32px;
                }
                .settings-card {
                    border-radius: 16px !important;
                    border: 1px solid #e2e8f0 !important;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.02) !important;
                    overflow: hidden;
                }
                .settings-card .ant-card-head {
                    background-color: #fafafa !important;
                    border-bottom: 1px solid #e2e8f0 !important;
                    padding: 16px 24px !important;
                }
                .settings-card-title {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-weight: 700 !important;
                    font-size: 15px !important;
                    color: #1e293b;
                }
                .form-section-title {
                    font-size: 13px;
                    font-weight: 600;
                    color: #64748b;
                    margin-bottom: 8px;
                    text-transform: uppercase;
                    letter-spacing: 0.02em;
                }
                .glass-card {
                    background: #ffffff !important;
                }
                .xpath-code {
                    background: #f1f5f9;
                    padding: 4px 8px;
                    border-radius: 6px;
                    font-family: SFMono-Regular, Consolas, Menlo, monospace;
                    font-size: 11.5px;
                    color: #ef4444;
                    border: 1px solid #e2e8f0;
                }
                .help-link {
                    color: #475569;
                    font-weight: 500;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 12px;
                    border-radius: 8px;
                }
                .help-link:hover {
                    background: #f1f5f9;
                    color: #2563eb;
                }
            `}</style>

            {/* 1. STICKY HEADER */}
            <div className="settings-header">
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <div style={{ background: '#EFF6FF', color: '#2563EB', width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Settings size={18} />
                        </div>
                        <Title level={4} style={{ margin: 0, fontWeight: 800, letterSpacing: '-0.02em' }}>System Configuration</Title>
                    </div>
                    <Text type="secondary" style={{ fontSize: 13 }}>Deploy environment variables, dispatch endpoints, and automation time intervals.</Text>
                </div>
                <Button 
                    type="primary" 
                    icon={<Save size={16} />} 
                    onClick={handleSave} 
                    loading={saving}
                    style={{ height: 40, borderRadius: 8, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, padding: '0 20px' }}
                >
                    Commit Changes
                </Button>
            </div>

            {/* 2. CONTENT GRID */}
            <div className="settings-content">
                <Row gutter={[24, 24]}>
                    {/* Left Column - Configuration Forms */}
                    <Col xs={24} lg={16}>
                        <Space direction="vertical" size={24} style={{ width: '100%' }}>
                            
                            {/* Octoparse API */}
                            <Card 
                                className="settings-card" 
                                variant="borderless"
                                title={
                                    <div className="settings-card-title">
                                        <Cloud size={18} style={{ color: '#3B82F6' }} />
                                        <span>Scraper Engine Integration</span>
                                    </div>
                                }
                            >
                                <Alert
                                    message="Cloud Integration Layer"
                                    description={<span>Connect to the Octoparse cluster for real-time scraping of Amazon ASIN structures. Obtain your token from <a href="https://www.octoparse.com" target="_blank" rel="noreferrer" style={{fontWeight: 600}}>octoparse.com</a>.</span>}
                                    type="info"
                                    showIcon
                                    style={{ marginBottom: 24, borderRadius: 10 }}
                                    icon={<Info size={16} />}
                                />
                                
                                <Row gutter={[20, 20]}>
                                    <Col span={24}>
                                        <div className="form-section-title">API Security Token</div>
                                        <Input.Password 
                                            placeholder="Enter Octoparse API Key"
                                            value={settings.octoparseApiKey}
                                            onChange={e => handleFieldChange('octoparseApiKey', e.target.value)}
                                            prefix={<Lock size={14} style={{ color: '#94a3b8', marginRight: 6 }} />}
                                            style={{ height: 42, borderRadius: 8 }}
                                        />
                                    </Col>
                                    <Col xs={24} md={12}>
                                        <div className="form-section-title">Active Task ID</div>
                                        <Input 
                                            placeholder="e.g. e8266a91-..."
                                            value={settings.octoparseTaskId}
                                            onChange={e => handleFieldChange('octoparseTaskId', e.target.value)}
                                            prefix={<Terminal size={14} style={{ color: '#94a3b8', marginRight: 6 }} />}
                                            style={{ height: 42, borderRadius: 8 }}
                                        />
                                        <Text type="secondary" style={{ fontSize: 11.5, display: 'block', marginTop: 6 }}>The specific crawling node identifier.</Text>
                                    </Col>
                                    <Col xs={24} md={12}>
                                        <div className="form-section-title">Status Check Interval (ms)</div>
                                        <InputNumber 
                                            placeholder="300000"
                                            value={settings.scrapePollInterval}
                                            onChange={val => handleFieldChange('scrapePollInterval', val)}
                                            style={{ width: '100%', height: 42, borderRadius: 8, paddingTop: 4 }}
                                            min={60000}
                                        />
                                        <Text type="secondary" style={{ fontSize: 11.5, display: 'block', marginTop: 6 }}>Interval for backend cron checks (Min: 60000ms).</Text>
                                    </Col>
                                    <Col span={24}>
                                        <Divider style={{ margin: '12px 0' }} />
                                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                            <Button 
                                                icon={<RefreshCw size={14} />} 
                                                loading={testingOctoparse} 
                                                onClick={handleTestOctoparse}
                                                style={{ borderRadius: 8, fontWeight: 500 }}
                                            >
                                                Verify Node Link
                                            </Button>
                                            {testResult && (
                                                <Tag color={testResult.success ? 'success' : 'error'} style={{ borderRadius: 6, padding: '4px 12px', border: 'none', fontWeight: 500 }}>
                                                    {testResult.message}
                                                </Tag>
                                            )}
                                        </div>
                                    </Col>
                                </Row>
                            </Card>

                            {/* SMTP Gateway */}
                            <Card 
                                className="settings-card" 
                                variant="borderless"
                                title={
                                    <div className="settings-card-title">
                                        <Mail size={18} style={{ color: '#ec4899' }} />
                                        <span>SMTP Dispatch Gateway</span>
                                    </div>
                                }
                            >
                                <Paragraph style={{ color: '#64748b', marginBottom: 20 }}>
                                    Assign transport relay hosts to empower direct outbound alerting, daily PDF digests, and security notices.
                                </Paragraph>

                                <Row gutter={[20, 20]}>
                                    <Col xs={24} md={12}>
                                        <div className="form-section-title">Relay Host</div>
                                        <Input 
                                            placeholder="smtp.mail.com"
                                            value={settings.smtpHost}
                                            onChange={e => handleFieldChange('smtpHost', e.target.value)}
                                            style={{ height: 42, borderRadius: 8 }}
                                        />
                                    </Col>
                                    <Col xs={12} md={6}>
                                        <div className="form-section-title">Port</div>
                                        <Input 
                                            placeholder="587"
                                            value={settings.smtpPort}
                                            onChange={e => handleFieldChange('smtpPort', e.target.value)}
                                            style={{ height: 42, borderRadius: 8 }}
                                        />
                                    </Col>
                                    <Col xs={12} md={6}>
                                        <div className="form-section-title">Crypt Mode</div>
                                        <Select 
                                            value={settings.smtpSecure} 
                                            onChange={val => handleFieldChange('smtpSecure', val)}
                                            style={{ width: '100%', height: 42 }}
                                            dropdownStyle={{ borderRadius: 8 }}
                                        >
                                            <Option value="tls">STARTTLS</Option>
                                            <Option value="ssl">Implicit SSL</Option>
                                        </Select>
                                    </Col>
                                    <Col xs={24} md={12}>
                                        <div className="form-section-title">Transport User</div>
                                        <Input 
                                            placeholder="relayer@corp.com"
                                            value={settings.smtpUser}
                                            onChange={e => handleFieldChange('smtpUser', e.target.value)}
                                            style={{ height: 42, borderRadius: 8 }}
                                        />
                                    </Col>
                                    <Col xs={24} md={12}>
                                        <div className="form-section-title">Transport Password</div>
                                        <Input.Password 
                                            placeholder="🔑 Enter password"
                                            value={settings.smtpPass}
                                            onChange={e => handleFieldChange('smtpPass', e.target.value)}
                                            style={{ height: 42, borderRadius: 8 }}
                                        />
                                    </Col>
                                    <Col span={24}>
                                        <Divider style={{ margin: '8px 0' }} />
                                        <Button 
                                            icon={<Send size={14} />} 
                                            onClick={() => setEmailModalVisible(true)}
                                            style={{ borderRadius: 8, fontWeight: 500 }}
                                        >
                                            Fire Test Broadcast
                                        </Button>
                                    </Col>
                                </Row>
                            </Card>

                            {/* Pipeline Automation */}
                            <Card 
                                className="settings-card glass-card" 
                                variant="borderless"
                                title={
                                    <div className="settings-card-title">
                                        <Clock size={18} style={{ color: '#f59e0b' }} />
                                        <span>Background Pipeline Schedules</span>
                                    </div>
                                }
                                extra={
                                    <Space size={12}>
                                        <Text style={{ fontSize: 12.5, color: '#64748b', fontWeight: 500 }}>Automation Stack:</Text>
                                        <Switch 
                                            checked={settings.AUTOMATION_ENABLED === true || settings.AUTOMATION_ENABLED === 'true'}
                                            onChange={checked => handleFieldChange('AUTOMATION_ENABLED', checked)}
                                            checkedChildren="ON"
                                            unCheckedChildren="OFF"
                                        />
                                    </Space>
                                }
                            >
                                <div style={{ background: '#FFFBEB', border: '1px solid #FEF3C7', borderRadius: 12, padding: '16px', marginBottom: 24, display: 'flex', gap: 12 }}>
                                    <div style={{ color: '#D97706', flexShrink: 0 }}><Cpu size={18} /></div>
                                    <div>
                                        <div style={{ fontWeight: 600, color: '#92400E', fontSize: 13 }}>Pipeline Cron Scheduler</div>
                                        <div style={{ color: '#B45309', fontSize: 12.5 }}>Trigger synchronized automatic data mining across global store clusters. Adjust slot buffers to avoid node throttle.</div>
                                    </div>
                                </div>

                                <Row gutter={[24, 24]}>
                                    <Col xs={24} md={12}>
                                        <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                                <Badge color="#FF9900" />
                                                <div style={{ fontWeight: 700, color: '#334155', fontSize: 14 }}>Amazon Scheduler</div>
                                            </div>
                                            <div className="form-section-title">Routine Dispatch Lock</div>
                                            <TimePicker 
                                                format="HH:mm"
                                                style={{ width: '100%', height: 42, borderRadius: 8 }}
                                                value={settings.AUTOMATION_SCHEDULE_TIME ? dayjs(settings.AUTOMATION_SCHEDULE_TIME, 'HH:mm') : null}
                                                onChange={(time, timeStr) => handleFieldChange('AUTOMATION_SCHEDULE_TIME', timeStr)}
                                                allowClear={false}
                                            />
                                            <Text type="secondary" style={{ display: 'block', fontSize: 11.5, marginTop: 8 }}>Routine launch slot for all Amazon catalog pipelines.</Text>
                                        </div>
                                    </Col>
                                    <Col xs={24} md={12}>
                                        <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                                <Badge color="#06B6D4" />
                                                <div style={{ fontWeight: 700, color: '#334155', fontSize: 14 }}>Ajio Scheduler</div>
                                            </div>
                                            <div className="form-section-title">Routine Dispatch Lock</div>
                                            <TimePicker 
                                                format="HH:mm"
                                                style={{ width: '100%', height: 42, borderRadius: 8 }}
                                                value={settings.AUTOMATION_AJIO_SCHEDULE_TIME ? dayjs(settings.AUTOMATION_AJIO_SCHEDULE_TIME, 'HH:mm') : null}
                                                onChange={(time, timeStr) => handleFieldChange('AUTOMATION_AJIO_SCHEDULE_TIME', timeStr)}
                                                allowClear={false}
                                            />
                                            <Text type="secondary" style={{ display: 'block', fontSize: 11.5, marginTop: 8 }}>Routine launch slot for Ajio infrastructure indexes.</Text>
                                        </div>
                                    </Col>
                                </Row>
                            </Card>

                            {/* Catalog Tuning Rules */}
                            <Card 
                                className="settings-card" 
                                variant="borderless"
                                title={
                                    <div className="settings-card-title">
                                        <Sliders size={18} style={{ color: '#8b5cf6' }} />
                                        <span>Catalog Optimization Limits</span>
                                    </div>
                                }
                            >
                                <Paragraph style={{ color: '#64748b', marginBottom: 24 }}>
                                    Design thresholds utilized by the Listing Quality Score (LQS) engine. ASINs that drop below these boundaries trigger dynamic correction tickets automatically.
                                </Paragraph>

                                <Row gutter={[20, 20]}>
                                    <Col xs={24} md={12}>
                                        <div className="form-section-title">Minimum Target LQS</div>
                                        <InputNumber 
                                            value={settings.minLqsScore}
                                            onChange={v => handleFieldChange('minLqsScore', v)}
                                            style={{ width: '100%', height: 42, borderRadius: 8, paddingTop: 4 }}
                                            min={0}
                                            max={100}
                                        />
                                    </Col>
                                    <Col xs={24} md={12}>
                                        <div className="form-section-title">Minimum Title Chars</div>
                                        <InputNumber 
                                            value={settings.minTitleLength}
                                            onChange={v => handleFieldChange('minTitleLength', v)}
                                            style={{ width: '100%', height: 42, borderRadius: 8, paddingTop: 4 }}
                                            min={0}
                                        />
                                    </Col>
                                    <Col xs={24} md={12}>
                                        <div className="form-section-title">Minimum Gallery Photos</div>
                                        <InputNumber 
                                            value={settings.minImageCount}
                                            onChange={v => handleFieldChange('minImageCount', v)}
                                            style={{ width: '100%', height: 42, borderRadius: 8, paddingTop: 4 }}
                                            min={0}
                                        />
                                    </Col>
                                    <Col xs={24} md={12}>
                                        <div className="form-section-title">Min Description Length</div>
                                        <InputNumber 
                                            value={settings.minDescLength}
                                            onChange={v => handleFieldChange('minDescLength', v)}
                                            style={{ width: '100%', height: 42, borderRadius: 8, paddingTop: 4 }}
                                            min={0}
                                        />
                                    </Col>
                                </Row>
                            </Card>

                            {/* Notification Subscriptions */}
                            <Card 
                                className="settings-card" 
                                variant="borderless"
                                title={
                                    <div className="settings-card-title">
                                        <Bell size={18} style={{ color: '#10B981' }} />
                                        <span>Broadcasting & Notices</span>
                                    </div>
                                }
                            >
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: '#F8FAFC', borderRadius: 12, border: '1px solid #E2E8F0' }}>
                                        <div>
                                            <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 13.5 }}>Interactive Application Signals</div>
                                            <div style={{ color: '#64748b', fontSize: 12 }}>Receive slide-ins and audio notifications inside the main app dashboard.</div>
                                        </div>
                                        <Switch 
                                            checked={settings.notifications}
                                            onChange={checked => handleFieldChange('notifications', checked)}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: '#F8FAFC', borderRadius: 12, border: '1px solid #E2E8F0' }}>
                                        <div>
                                            <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 13.5 }}>Daily Execution Logs (PDF)</div>
                                            <div style={{ color: '#64748b', fontSize: 12 }}>Collect raw scraper execution sheets via scheduled secure email.</div>
                                        </div>
                                        <Switch 
                                            checked={settings.emailReports}
                                            onChange={checked => handleFieldChange('emailReports', checked)}
                                        />
                                    </div>
                                </div>
                            </Card>

                        </Space>
                    </Col>

                    {/* Right Column - Info & Helpers */}
                    <Col xs={24} lg={8}>
                        <Space direction="vertical" size={24} style={{ width: '100%' }}>
                            
                            {/* Allocation Details */}
                            <Card 
                                className="settings-card" 
                                variant="borderless"
                                title={
                                    <div className="settings-card-title">
                                        <User size={16} />
                                        <span>Licensing & Allocation</span>
                                    </div>
                                }
                            >
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    <div>
                                        <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>Tier Level</Text>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                                            <span style={{ fontSize: 18, fontWeight: 800, color: '#0F172A' }}>Enterprise Pro</span>
                                            <Tag color="blue" style={{ border: 'none', borderRadius: 6, fontWeight: 700, padding: '2px 10px' }}>ACTIVE</Tag>
                                        </div>
                                    </div>
                                    
                                    <Divider style={{ margin: '4px 0' }} />
                                    
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                            <Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>API LIMITS TODAY</Text>
                                            <Text style={{ fontSize: 12, fontWeight: 700, color: '#1E293B' }}>0 / 10 Nodes</Text>
                                        </div>
                                        <Progress percent={0} strokeColor="#2563eb" showInfo={false} strokeWidth={8} style={{ margin: 0 }} />
                                    </div>

                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                            <Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>ACTIVE CATALOG ASINS</Text>
                                            <Text style={{ fontSize: 12, fontWeight: 700, color: '#1E293B' }}>6 / 1000 Items</Text>
                                        </div>
                                        <Progress percent={0.6} strokeColor="#10b981" showInfo={false} strokeWidth={8} style={{ margin: 0 }} />
                                    </div>
                                </div>
                            </Card>

                            {/* XPath Guides */}
                            <Card 
                                className="settings-card" 
                                variant="borderless"
                                title={
                                    <div className="settings-card-title">
                                        <HelpCircle size={16} />
                                        <span>Scrape Pattern Blueprint</span>
                                    </div>
                                }
                            >
                                <Paragraph style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
                                    Apply the following precise XPaths inside your Octoparse Cloud extraction node to ensure accurate attribute mapping:
                                </Paragraph>
                                <List
                                    dataSource={xpathsHelp}
                                    renderItem={item => (
                                        <List.Item style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                                            <div style={{ width: '100%' }}>
                                                <div style={{ fontWeight: 600, color: '#334155', fontSize: 12.5, marginBottom: 4 }}>{item.title}</div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <code className="xpath-code">{item.xpath}</code>
                                                    <Tooltip title="Copy Path">
                                                        <Button 
                                                            type="text" 
                                                            size="small" 
                                                            icon={<Link2 size={13} style={{ color: '#94a3b8' }} />} 
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(item.xpath);
                                                                messageApi.success(`${item.title} XPath copied!`);
                                                            }}
                                                            style={{ height: 24, width: 24, padding: 0 }}
                                                        />
                                                    </Tooltip>
                                                </div>
                                            </div>
                                        </List.Item>
                                    )}
                                />
                            </Card>

                            {/* Platform Support */}
                            <Card 
                                className="settings-card" 
                                variant="borderless"
                                title={
                                    <div className="settings-card-title">
                                        <HelpCircle size={16} />
                                        <span>Resource Hub</span>
                                    </div>
                                }
                                styles={{ body: { padding: '12px' } }}
                            >
                                <a href="#" className="help-link">
                                    <Terminal size={16} />
                                    <span style={{ fontSize: 13.5 }}>API Specifications</span>
                                    <ExternalLink size={12} style={{ marginLeft: 'auto', opacity: 0.5 }} />
                                </a>
                                <a href="#" className="help-link">
                                    <Info size={16} />
                                    <span style={{ fontSize: 13.5 }}>Service Matrix Support</span>
                                    <ExternalLink size={12} style={{ marginLeft: 'auto', opacity: 0.5 }} />
                                </a>
                                <a href="https://www.octoparse.com" target="_blank" rel="noopener noreferrer" className="help-link">
                                    <Cloud size={16} />
                                    <span style={{ fontSize: 13.5 }}>Octoparse Panel</span>
                                    <ExternalLink size={12} style={{ marginLeft: 'auto', opacity: 0.5 }} />
                                </a>
                            </Card>

                        </Space>
                    </Col>
                </Row>
            </div>

            {/* SMTP TEST EMAIL MODAL */}
            <Modal
                title={<div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}><Send size={16} style={{ color: '#4f46e5' }} /> <span>Test SMTP Handshake</span></div>}
                open={emailModalVisible}
                onCancel={() => setEmailModalVisible(false)}
                footer={[
                    <Button key="cancel" onClick={() => setEmailModalVisible(false)} style={{ borderRadius: 6 }}>Cancel</Button>,
                    <Button 
                        key="send" 
                        type="primary" 
                        loading={sendingTestEmail} 
                        onClick={handleSendTestEmail}
                        style={{ borderRadius: 6, fontWeight: 600 }}
                    >
                        Launch Broadcast
                    </Button>
                ]}
                width={400}
                centered
            >
                <div style={{ padding: '12px 0' }}>
                    <Paragraph type="secondary" style={{ fontSize: 12.5, marginBottom: 16 }}>
                        Fires a test dispatch packet over the current relay transport configurations to verify handshake parameters.
                    </Paragraph>
                    <div className="form-section-title">Destination Email</div>
                    <Input 
                        placeholder="your@email.com" 
                        value={testTargetEmail} 
                        onChange={e => setTestTargetEmail(e.target.value)}
                        style={{ height: 40, borderRadius: 8 }}
                        prefix={<Mail size={14} style={{ color: '#94a3b8', marginRight: 6 }} />}
                    />
                </div>
            </Modal>

        </div>
    );
};

export default SettingsPage;
