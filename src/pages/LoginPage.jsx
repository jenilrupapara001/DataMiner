import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
    Form, 
    Input, 
    Button, 
    Checkbox, 
    Typography, 
    message,
    Space
} from 'antd';
import { 
    Mail, 
    Lock, 
    ArrowRight,
    BarChart3,
    ShieldCheck,
    Zap,
    KeyRound
} from 'lucide-react';
import AuthLayout from '../components/auth/AuthLayout';

const { Title, Text, Paragraph } = Typography;

const LoginPage = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [loading, setLoading] = useState(false);

    const onFinish = async (values) => {
        setLoading(true);
        try {
            const result = await login(values.email.trim(), values.password);
            if (result.success) {
                message.success('Authentication successful. Welcome back.');
                window.location.href = '/';
            } else {
                message.error(result.error || 'Invalid credentials. Please verify your access.');
            }
        } catch (error) {
            message.error('An unexpected error occurred during authentication.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout
            heroTitle="Scale your Commerce Intelligence."
            heroSubtitle="Harness the power of deep analytics and automated market sync to dominate your category on Amazon India."
            features={[
                { icon: <BarChart3 size={20} />, title: 'Predictive Analytics', desc: 'Identify trends before they happen' },
                { icon: <Zap size={20} />, title: 'Hyper-Sync Technology', desc: 'Real-time catalog & price automation' },
                { icon: <ShieldCheck size={20} />, title: 'Enterprise Security', desc: 'SaaS-grade data protection & isolation' }
            ]}
        >
            <div style={{ marginBottom: 48 }}>
                <div style={{ 
                    width: 48, 
                    height: 4, 
                    background: '#CA8A04', 
                    borderRadius: 2, 
                    marginBottom: 24 
                }} />
                <Title level={2} style={{ 
                    marginBottom: 12, 
                    fontWeight: 800, 
                    fontSize: '2.4rem', 
                    letterSpacing: '-0.04em',
                    color: '#1C1917' 
                }}>
                    Login to Gateway
                </Title>
                <Paragraph style={{ color: '#78716C', fontSize: 16, lineHeight: 1.5 }}>
                    Enter your administrative credentials to access the RetailOps command center.
                </Paragraph>
            </div>

            <Form
                layout="vertical"
                onFinish={onFinish}
                requiredMark={false}
                initialValues={{ remember: true }}
                size="large"
            >
                <Form.Item
                    label="Corporate Email"
                    name="email"
                    rules={[
                        { required: true, message: 'Please provide your corporate email' },
                        { type: 'email', message: 'The format must be a valid email' }
                    ]}
                    style={{ marginBottom: 28 }}
                >
                    <Input 
                        prefix={<Mail size={18} style={{ color: '#A8A29E', marginRight: 10 }} />} 
                        placeholder="e.g. director@company.com"
                        autoComplete="email"
                        style={{ height: 54, fontSize: 15 }}
                    />
                </Form.Item>

                <Form.Item
                    label="Access Key"
                    name="password"
                    rules={[{ required: true, message: 'Your access key is required' }]}
                    style={{ marginBottom: 12 }}
                >
                    <Input.Password 
                        prefix={<KeyRound size={18} style={{ color: '#A8A29E', marginRight: 10 }} />} 
                        placeholder="••••••••••••"
                        autoComplete="current-password"
                        style={{ height: 54, fontSize: 15 }}
                    />
                </Form.Item>

                <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    marginBottom: 40 
                }}>
                    <Form.Item name="remember" valuePropName="checked" noStyle>
                        <Checkbox style={{ fontSize: '14px', fontWeight: 500, color: '#44403C' }}>
                            Stay authenticated
                        </Checkbox>
                    </Form.Item>
                    <Link to="#" style={{ fontSize: '14px', fontWeight: 700, color: '#CA8A04' }}>
                        Forgot Access Key?
                    </Link>
                </div>

                <Form.Item style={{ marginBottom: 32 }}>
                    <Button 
                        type="primary" 
                        htmlType="submit" 
                        loading={loading}
                        block
                        style={{ 
                            height: 56, 
                            background: '#1C1917', 
                            borderColor: '#1C1917',
                            fontSize: '16px',
                            fontWeight: 800,
                            letterSpacing: '0.02em',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '12px'
                        }}
                    >
                        INITIALIZE ACCESS <ArrowRight size={18} />
                    </Button>
                </Form.Item>
            </Form>

            <div style={{ textAlign: 'center' }}>
                <Text style={{ fontSize: '14px', color: '#78716C', fontWeight: 500 }}>
                    New to the network? <Link to="/register" style={{ color: '#1C1917', fontWeight: 800, marginLeft: '6px', borderBottom: '2px solid #CA8A04' }}>Request Access</Link>
                </Text>
            </div>
            
            <div style={{ 
                marginTop: 60, 
                paddingTop: 32, 
                borderTop: '1px solid #E7E5E4', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '10px', 
                color: '#A8A29E',
                fontSize: '12px',
                fontWeight: 600
            }}>
                <ShieldCheck size={16} style={{ color: '#10B981' }} />
                <span>ENCRYPTED END-TO-END VIA AES-256</span>
            </div>
        </AuthLayout>
    );
};

export default LoginPage;