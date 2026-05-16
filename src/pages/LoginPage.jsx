import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
    Form, 
    Input, 
    Button, 
    Checkbox, 
    Typography, 
    message
} from 'antd';
import { 
    Mail, 
    Lock, 
    ArrowRight,
    LineChart,
    ShieldCheck,
    Zap
} from 'lucide-react';
import AuthLayout from '../components/auth/AuthLayout';

const { Title, Text } = Typography;

const LoginPage = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [loading, setLoading] = useState(false);

    const onFinish = async (values) => {
        setLoading(true);
        try {
            const result = await login(values.email.trim(), values.password);
            if (result.success) {
                message.success('Welcome back to RetailOps!');
                window.location.href = '/';
            } else {
                message.error(result.error || 'Invalid credentials');
            }
        } catch (error) {
            message.error('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout
            heroTitle="Maximize your Marketplace Impact."
            heroSubtitle="Harness deep analytics and automation to scale your e-commerce operations faster than ever."
            features={[
                { icon: <LineChart size={18} />, title: 'Real-time Intelligence', desc: 'Sync data across all channels' },
                { icon: <Zap size={18} />, title: 'Smart Automations', desc: 'Auto-adjust prices & inventory' },
                { icon: <ShieldCheck size={18} />, title: 'Secure Operations', desc: 'Bank-grade data protection' }
            ]}
        >
            <div style={{ marginBottom: 40 }}>
                <Title level={2} style={{ marginBottom: 8, fontWeight: 800, fontSize: '1.8rem', letterSpacing: '-0.01em' }}>
                    Sign In
                </Title>
                <Text type="secondary" style={{ fontSize: 14 }}>
                    Enter your credentials to manage your dashboard
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
                    label={<Text strong style={{ fontSize: '13px' }}>Email Address</Text>}
                    name="email"
                    rules={[
                        { required: true, message: 'Email is required' },
                        { type: 'email', message: 'Enter a valid email' }
                    ]}
                    style={{ marginBottom: 20 }}
                >
                    <Input 
                        prefix={<Mail size={16} className="text-zinc-400 me-2" />} 
                        placeholder="admin@retailops.com"
                        autoComplete="email"
                    />
                </Form.Item>

                <Form.Item
                    label={<Text strong style={{ fontSize: '13px' }}>Password</Text>}
                    name="password"
                    rules={[{ required: true, message: 'Password is required' }]}
                    style={{ marginBottom: 20 }}
                >
                    <Input.Password 
                        prefix={<Lock size={16} className="text-zinc-400 me-2" />} 
                        placeholder="••••••••"
                        autoComplete="current-password"
                    />
                </Form.Item>

                <div className="d-flex justify-content-between align-items-center mb-4">
                    <Form.Item name="remember" valuePropName="checked" noStyle>
                        <Checkbox style={{ fontSize: '13px' }}>Remember me</Checkbox>
                    </Form.Item>
                    <Link to="#" className="text-primary fw-semibold" style={{ fontSize: '13px' }}>Forgot password?</Link>
                </div>

                <Form.Item style={{ marginBottom: 24 }}>
                    <Button 
                        type="primary" 
                        htmlType="submit" 
                        loading={loading}
                        block
                        style={{ 
                            height: 48, 
                            background: '#18181b', 
                            borderColor: '#18181b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                        }}
                    >
                        Sign In <ArrowRight size={16} />
                    </Button>
                </Form.Item>
            </Form>

            <div className="text-center mt-5">
                <Text type="secondary" style={{ fontSize: '13px' }}>
                    New here? <Link to="/register" className="text-primary fw-bold ms-1">Create an account</Link>
                </Text>
            </div>
            
            <div className="mt-5 pt-4 border-top d-flex align-items-center justify-content-center gap-2 text-zinc-400" style={{ fontSize: '11px' }}>
                <ShieldCheck size={14} />
                <span>Protected by 256-bit SSL Encryption</span>
            </div>
        </AuthLayout>
    );
};

export default LoginPage;