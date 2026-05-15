import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
    Form, 
    Input, 
    Button, 
    Checkbox, 
    Typography, 
    Card, 
    Row, 
    Col, 
    Divider, 
    ConfigProvider,
    theme,
    message
} from 'antd';
import { 
    MailOutlined, 
    LockOutlined, 
    ArrowRightOutlined,
    SafetyCertificateOutlined,
    BarChartOutlined,
    RocketOutlined
} from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { RetailOpsWordmark } from '../components/common/BrandLogo';

const { Title, Text, Paragraph } = Typography;

const LoginPage = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [loading, setLoading] = useState(false);
    const { token } = theme.useToken();

    const onFinish = async (values) => {
        setLoading(true);
        try {
            const result = await login(values.email.trim(), values.password);
            if (result.success) {
                message.success('Login successful! Redirecting...');
                window.location.href = '/';
            } else {
                message.error(result.error || 'Login failed. Please try again.');
            }
        } catch (error) {
            message.error('An unexpected error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ConfigProvider
            theme={{
                token: {
                    colorPrimary: '#2563eb',
                    borderRadius: 12,
                    fontFamily: "'Inter', sans-serif",
                    colorBgContainer: '#ffffff',
                    colorTextPlaceholder: '#94a3b8',
                },
                components: {
                    Button: {
                        controlHeight: 48,
                        fontSize: 16,
                        fontWeight: 600,
                        colorPrimary: '#2563eb',
                        colorPrimaryHover: '#1d4ed8',
                    },
                    Input: {
                        controlHeight: 48,
                        colorBgContainer: '#ffffff',
                        activeBorderColor: '#2563eb',
                        hoverBorderColor: '#2563eb',
                    },
                    Checkbox: {
                        colorPrimary: '#2563eb',
                    }
                }
            }}
        >
            <div style={{
                minHeight: '100vh',
                background: '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px',
                position: 'relative',
                overflow: 'hidden'
            }}>
                {/* Refined decorative background elements */}
                <div style={{
                    position: 'absolute',
                    top: '-15%',
                    right: '-10%',
                    width: '60%',
                    height: '60%',
                    background: 'radial-gradient(circle, rgba(37, 99, 235, 0.08) 0%, transparent 70%)',
                    zIndex: 0
                }} />
                <div style={{
                    position: 'absolute',
                    bottom: '-15%',
                    left: '-10%',
                    width: '60%',
                    height: '60%',
                    background: 'radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, transparent 70%)',
                    zIndex: 0
                }} />

                <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    style={{ zIndex: 1, width: '100%', maxWidth: 1100 }}
                >
                    <Card
                        bordered={false}
                        styles={{ body: { padding: 0 } }}
                        style={{
                            borderRadius: 32,
                            overflow: 'hidden',
                            boxShadow: '0 40px 80px -20px rgba(0, 0, 0, 0.12)',
                            background: '#ffffff',
                            border: '1px solid #e2e8f0'
                        }}
                    >
                        <Row align="stretch" style={{ minHeight: 680 }}>
                            {/* Left Panel: Branding & Features */}
                            <Col xs={0} md={11} lg={12} style={{
                                background: '#0f172a',
                                padding: '80px 64px',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                position: 'relative',
                                color: '#fff',
                                overflow: 'hidden'
                            }}>
                                {/* Enhanced animated background pattern */}
                                <div style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    opacity: 0.05,
                                    backgroundImage: `radial-gradient(#fff 1px, transparent 1px)`,
                                    backgroundSize: '32px 32px',
                                    zIndex: 0
                                }} />
                                
                                <div style={{
                                    position: 'absolute',
                                    top: '20%',
                                    right: '-10%',
                                    width: '300px',
                                    height: '300px',
                                    background: 'radial-gradient(circle, rgba(37, 99, 235, 0.15) 0%, transparent 70%)',
                                    filter: 'blur(40px)',
                                    zIndex: 0
                                }} />

                                <div style={{ zIndex: 1 }}>
                                    {/* FIX: Ensure logo text is white on dark background */}
                                    <div style={{ filter: 'brightness(0) invert(1)', opacity: 0.95 }}>
                                        <RetailOpsWordmark size={44} />
                                    </div>
                                    
                                    <div style={{ marginTop: 80 }}>
                                        <motion.div
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.3, duration: 0.6 }}
                                        >
                                            <Title level={1} style={{ 
                                                color: '#fff', 
                                                fontSize: '3.5rem', 
                                                fontWeight: 800, 
                                                lineHeight: 1.1, 
                                                marginBottom: 40,
                                                letterSpacing: '-0.02em'
                                            }}>
                                                Empower Your <br />
                                                <span style={{ 
                                                    background: 'linear-gradient(90deg, #60a5fa 0%, #3b82f6 100%)',
                                                    WebkitBackgroundClip: 'text',
                                                    WebkitTextFillColor: 'transparent'
                                                }}>E-commerce</span> <br />
                                                Vision.
                                            </Title>
                                        </motion.div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                                            {[
                                                { icon: <BarChartOutlined />, title: 'Real-time Analytics', desc: 'Monitor your sales velocity and inventory health.' },
                                                { icon: <RocketOutlined />, title: 'Smart Automation', desc: 'Let AI-driven rules handle the heavy lifting.' },
                                                { icon: <SafetyCertificateOutlined />, title: 'Enterprise Security', desc: 'Your data is protected by bank-grade encryption.' }
                                            ].map((feature, index) => (
                                                <motion.div 
                                                    key={index}
                                                    initial={{ opacity: 0, x: -20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: 0.5 + (index * 0.1) }}
                                                    style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}
                                                >
                                                    <div style={{
                                                        width: 52,
                                                        height: 52,
                                                        borderRadius: 16,
                                                        background: 'rgba(255, 255, 255, 0.08)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: 22,
                                                        color: '#60a5fa',
                                                        flexShrink: 0,
                                                        border: '1px solid rgba(255, 255, 255, 0.1)'
                                                    }}>
                                                        {feature.icon}
                                                    </div>
                                                    <div>
                                                        <Text strong style={{ color: '#fff', fontSize: 17, display: 'block', marginBottom: 4 }}>{feature.title}</Text>
                                                        <Paragraph style={{ color: 'rgba(255, 255, 255, 0.5)', margin: 0, fontSize: 14, lineHeight: 1.5 }}>{feature.desc}</Paragraph>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ zIndex: 1, color: 'rgba(255, 255, 255, 0.3)', fontSize: 13, fontWeight: 500 }}>
                                    &copy; 2026 RetailOps. Built for Scale.
                                </div>
                            </Col>

                            {/* Right Panel: Login Form */}
                            <Col xs={24} md={13} lg={12} style={{
                                padding: '80px 72px',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                background: '#ffffff'
                            }}>
                                <div style={{ maxWidth: 420, width: '100%', margin: '0 auto' }}>
                                    <div style={{ marginBottom: 48 }}>
                                        <Title level={2} style={{ marginBottom: 12, fontWeight: 800, fontSize: '2rem', letterSpacing: '-0.01em' }}>Welcome Back</Title>
                                        <Text style={{ fontSize: 16, color: '#64748b' }}>
                                            Enter your credentials to access your dashboard
                                        </Text>
                                    </div>

                                    <Form
                                        layout="vertical"
                                        onFinish={onFinish}
                                        requiredMark={false}
                                        initialValues={{ remember: true }}
                                        size="large"
                                    >
                                        <Form.Item
                                            label={<Text style={{ fontWeight: 600, fontSize: 14, color: '#475569' }}>Email Address</Text>}
                                            name="email"
                                            rules={[
                                                { required: true, message: 'Please enter your email' },
                                                { type: 'email', message: 'Please enter a valid email' }
                                            ]}
                                            style={{ marginBottom: 24 }}
                                        >
                                            <Input 
                                                prefix={<MailOutlined style={{ color: '#94a3b8', marginRight: 8 }} />} 
                                                placeholder="admin@retailops.com"
                                                autoComplete="email"
                                                style={{ padding: '12px 16px' }}
                                            />
                                        </Form.Item>

                                        <Form.Item
                                            label={<Text style={{ fontWeight: 600, fontSize: 14, color: '#475569' }}>Password</Text>}
                                            name="password"
                                            rules={[{ required: true, message: 'Please enter your password' }]}
                                            style={{ marginBottom: 24 }}
                                        >
                                            <Input.Password 
                                                prefix={<LockOutlined style={{ color: '#94a3b8', marginRight: 8 }} />} 
                                                placeholder="••••••••"
                                                autoComplete="current-password"
                                                style={{ padding: '12px 16px' }}
                                            />
                                        </Form.Item>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                                            <Form.Item name="remember" valuePropName="checked" noStyle>
                                                <Checkbox style={{ fontWeight: 500, color: '#475569' }}>Remember me</Checkbox>
                                            </Form.Item>
                                            <Link to="#" style={{ fontSize: 14, fontWeight: 600, color: '#2563eb' }}>Forgot password?</Link>
                                        </div>

                                        <Form.Item style={{ marginBottom: 32 }}>
                                            <Button 
                                                type="primary" 
                                                htmlType="submit" 
                                                loading={loading}
                                                block
                                                icon={<ArrowRightOutlined />}
                                                style={{ 
                                                    height: 56, 
                                                    borderRadius: 14,
                                                    fontSize: 16,
                                                    fontWeight: 700,
                                                    boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.2)'
                                                }}
                                            >
                                                Sign In to Dashboard
                                            </Button>
                                        </Form.Item>
                                    </Form>

                                    <div style={{ textAlign: 'center', padding: '16px 0', background: '#f8fafc', borderRadius: 16, marginBottom: 40 }}>
                                        <Text style={{ fontSize: 14, color: '#64748b', fontWeight: 500 }}>
                                            Registration is restricted. Contact admin for access.
                                        </Text>
                                    </div>
                                    
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#94a3b8', fontSize: 13, fontWeight: 500 }}>
                                        <SafetyCertificateOutlined style={{ fontSize: 16, color: '#2563eb' }} />
                                        <span>Secured by Enterprise-grade 256-bit SSL</span>
                                    </div>
                                </div>
                            </Col>
                        </Row>
                    </Card>
                </motion.div>
            </div>
        </ConfigProvider>
    );
};

export default LoginPage;