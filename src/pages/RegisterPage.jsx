import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
    Form, 
    Input, 
    Button, 
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
    UserOutlined,
    UserAddOutlined,
    SafetyCertificateOutlined,
    ArrowRightOutlined,
    CheckCircleOutlined
} from '@ant-design/icons';
import { motion } from 'framer-motion';
import { RetailOpsWordmark } from '../components/common/BrandLogo';

const { Title, Text, Paragraph } = Typography;

const RegisterPage = () => {
    const navigate = useNavigate();
    const { register } = useAuth();
    const [loading, setLoading] = useState(false);

    const onFinish = async (values) => {
        if (values.password !== values.confirmPassword) {
            message.error('Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            const result = await register({
                name: values.name,
                email: values.email,
                password: values.password
            });

            if (result.success) {
                message.success('Account created successfully!');
                navigate('/');
            } else {
                message.error(result.error || 'Registration failed. Please try again.');
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
                        <Row align="stretch" style={{ minHeight: 720 }}>
                            {/* Left Panel: Branding & Onboarding */}
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
                                    bottom: '10%',
                                    right: '-5%',
                                    width: '280px',
                                    height: '280px',
                                    background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)',
                                    filter: 'blur(40px)',
                                    zIndex: 0
                                }} />

                                <div style={{ zIndex: 1 }}>
                                    {/* Logo visibility fix */}
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
                                                Start Your <br />
                                                Growth <br />
                                                <span style={{ 
                                                    background: 'linear-gradient(90deg, #93c5fd 0%, #60a5fa 100%)',
                                                    WebkitBackgroundClip: 'text',
                                                    WebkitTextFillColor: 'transparent'
                                                }}>Journey.</span>
                                            </Title>
                                        </motion.div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                                            {[
                                                { icon: <CheckCircleOutlined />, title: 'Free 14-day trial', desc: 'No credit card required to get started.' },
                                                { icon: <UserAddOutlined />, title: 'One-click Setup', desc: 'Connect your stores and start tracking in minutes.' },
                                                { icon: <SafetyCertificateOutlined />, title: 'Secure & Private', desc: 'Your data is encrypted and never shared.' }
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
                                                        color: '#93c5fd',
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
                                    &copy; 2026 RetailOps. Scale with Confidence.
                                </div>
                            </Col>

                            {/* Right Panel: Register Form */}
                            <Col xs={24} md={13} lg={12} style={{
                                padding: '80px 72px',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                background: '#ffffff'
                            }}>
                                <div style={{ maxWidth: 420, width: '100%', margin: '0 auto' }}>
                                    <div style={{ marginBottom: 48 }}>
                                        <Title level={2} style={{ marginBottom: 12, fontWeight: 800, fontSize: '2rem', letterSpacing: '-0.01em' }}>Create Account</Title>
                                        <Text style={{ fontSize: 16, color: '#64748b' }}>
                                            Join thousands of sellers scaling with RetailOps
                                        </Text>
                                    </div>

                                    <Form
                                        layout="vertical"
                                        onFinish={onFinish}
                                        requiredMark={false}
                                        size="large"
                                    >
                                        <Form.Item
                                            label={<Text style={{ fontWeight: 600, fontSize: 14, color: '#475569' }}>Full Name</Text>}
                                            name="name"
                                            rules={[{ required: true, message: 'Please enter your full name' }]}
                                            style={{ marginBottom: 20 }}
                                        >
                                            <Input 
                                                prefix={<UserOutlined style={{ color: '#94a3b8', marginRight: 8 }} />} 
                                                placeholder="John Doe"
                                                autoComplete="name"
                                                style={{ padding: '12px 16px' }}
                                            />
                                        </Form.Item>

                                        <Form.Item
                                            label={<Text style={{ fontWeight: 600, fontSize: 14, color: '#475569' }}>Email Address</Text>}
                                            name="email"
                                            rules={[
                                                { required: true, message: 'Please enter your email' },
                                                { type: 'email', message: 'Please enter a valid email' }
                                            ]}
                                            style={{ marginBottom: 20 }}
                                        >
                                            <Input 
                                                prefix={<MailOutlined style={{ color: '#94a3b8', marginRight: 8 }} />} 
                                                placeholder="name@company.com"
                                                autoComplete="email"
                                                style={{ padding: '12px 16px' }}
                                            />
                                        </Form.Item>

                                        <Form.Item
                                            label={<Text style={{ fontWeight: 600, fontSize: 14, color: '#475569' }}>Password</Text>}
                                            name="password"
                                            rules={[
                                                { required: true, message: 'Please enter your password' },
                                                { min: 6, message: 'Password must be at least 6 characters' }
                                            ]}
                                            style={{ marginBottom: 20 }}
                                        >
                                            <Input.Password 
                                                prefix={<LockOutlined style={{ color: '#94a3b8', marginRight: 8 }} />} 
                                                placeholder="••••••••"
                                                autoComplete="new-password"
                                                style={{ padding: '12px 16px' }}
                                            />
                                        </Form.Item>

                                        <Form.Item
                                            label={<Text style={{ fontWeight: 600, fontSize: 14, color: '#475569' }}>Confirm Password</Text>}
                                            name="confirmPassword"
                                            dependencies={['password']}
                                            rules={[
                                                { required: true, message: 'Please confirm your password' },
                                                ({ getFieldValue }) => ({
                                                    validator(_, value) {
                                                        if (!value || getFieldValue('password') === value) {
                                                            return Promise.resolve();
                                                        }
                                                        return Promise.reject(new Error('Passwords do not match'));
                                                    },
                                                }),
                                            ]}
                                            style={{ marginBottom: 32 }}
                                        >
                                            <Input.Password 
                                                prefix={<LockOutlined style={{ color: '#94a3b8', marginRight: 8 }} />} 
                                                placeholder="••••••••"
                                                autoComplete="new-password"
                                                style={{ padding: '12px 16px' }}
                                            />
                                        </Form.Item>

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
                                                Create My Account
                                            </Button>
                                        </Form.Item>
                                    </Form>

                                    <div style={{ textAlign: 'center' }}>
                                        <Text style={{ fontSize: 15, color: '#64748b', fontWeight: 500 }}>
                                            Already have an account? <Link to="/login" style={{ fontWeight: 700, color: '#2563eb' }}>Sign In</Link>
                                        </Text>
                                    </div>
                                    
                                    <Divider style={{ margin: '40px 0' }} />
                                    
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#94a3b8', fontSize: 13, fontWeight: 500 }}>
                                        <SafetyCertificateOutlined style={{ fontSize: 16, color: '#2563eb' }} />
                                        <span>Enterprise-grade security and encryption</span>
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

export default RegisterPage;
