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
            <div style={{ marginBottom: 32, textAlign: 'center' }}>
                <Title level={3} style={{ 
                    marginBottom: 8, 
                    fontWeight: 700, 
                    fontSize: '1.75rem', 
                    letterSpacing: '-0.03em',
                    color: '#09090B' 
                }}>
                    Sign in to RetailOps
                </Title>
                <Paragraph style={{ color: '#52525B', fontSize: 14, lineHeight: 1.5, marginBottom: 0 }}>
                    Enter your administrative credentials to initialize access.
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
                    style={{ marginBottom: 24 }}
                >
                    <Input 
                        prefix={<Mail size={16} style={{ color: '#71717A', marginRight: 8 }} />} 
                        placeholder="e.g. director@company.com"
                        autoComplete="email"
                        style={{ height: 50, fontSize: 14 }}
                    />
                </Form.Item>

                <Form.Item
                    label="Access Key"
                    name="password"
                    rules={[{ required: true, message: 'Your access key is required' }]}
                    style={{ marginBottom: 12 }}
                >
                    <Input.Password 
                        prefix={<KeyRound size={16} style={{ color: '#71717A', marginRight: 8 }} />} 
                        placeholder="••••••••••••"
                        autoComplete="current-password"
                        style={{ height: 50, fontSize: 14 }}
                    />
                </Form.Item>

                <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    marginBottom: 32 
                }}>
                    <Form.Item name="remember" valuePropName="checked" noStyle>
                        <Checkbox style={{ fontSize: '13px', fontWeight: 500, color: '#52525B' }}>
                            Stay authenticated
                        </Checkbox>
                    </Form.Item>
                    <Link to="#" style={{ fontSize: '13px', fontWeight: 600, color: '#0145f2' }}>
                        Forgot Access Key?
                    </Link>
                </div>

                <Form.Item style={{ marginBottom: 24 }}>
                    <Button 
                        type="primary" 
                        htmlType="submit" 
                        loading={loading}
                        block
                        style={{ 
                            height: 50, 
                            fontSize: '15px',
                            fontWeight: 700,
                            letterSpacing: '0.01em',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                        }}
                    >
                        Initialize Access <ArrowRight size={16} />
                    </Button>
                </Form.Item>
            </Form>

            <div style={{ textAlign: 'center' }}>
                <Text style={{ fontSize: '13px', color: '#52525B', fontWeight: 500 }}>
                    New to the network? <Link to="/register" style={{ color: '#0145f2', fontWeight: 600, marginLeft: '6px', borderBottom: '1px solid #0145f2', paddingBottom: 2 }}>Request Access</Link>
                </Text>
            </div>
            
            <div style={{ 
                marginTop: 32, 
                paddingTop: 24, 
                borderTop: '1px solid #e4e4e7', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '8px', 
                color: '#a1a1aa',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.05em'
            }}>
                <ShieldCheck size={14} style={{ color: '#10B981' }} />
                <span>ENCRYPTED END-TO-END VIA AES-256</span>
            </div>
        </AuthLayout>
    );
};

export default LoginPage;