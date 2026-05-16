import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
    Form, 
    Input, 
    Button, 
    Typography, 
    message
} from 'antd';
import { 
    Mail, 
    Lock, 
    User,
    ArrowRight,
    Sparkles,
    Users,
    ShieldCheck
} from 'lucide-react';
import AuthLayout from '../components/auth/AuthLayout';

const { Title, Text } = Typography;

const RegisterPage = () => {
    const navigate = useNavigate();
    const { register } = useAuth();
    const [loading, setLoading] = useState(false);

    const onFinish = async (values) => {
        setLoading(true);
        try {
            const result = await register({
                name: values.name,
                email: values.email,
                password: values.password
            });

            if (result.success) {
                message.success('Account created! Welcome to the team.');
                navigate('/');
            } else {
                message.error(result.error || 'Registration failed');
            }
        } catch (error) {
            message.error('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout
            heroTitle="Build your Retail Legacy."
            heroSubtitle="Join thousands of top-tier sellers who trust RetailOps for their mission-critical marketplace operations."
            features={[
                { icon: <Sparkles size={18} />, title: 'Premium Analytics', desc: 'Enterprise-grade sales tracking' },
                { icon: <Users size={18} />, title: 'Team Collaboration', desc: 'Multi-user role management' },
                { icon: <ShieldCheck size={18} />, title: 'Privacy First', desc: 'Secure data isolation' }
            ]}
            footerText="RetailOps. Start Scaling Today."
        >
            <div style={{ marginBottom: 32 }}>
                <Title level={2} style={{ marginBottom: 8, fontWeight: 800, fontSize: '1.8rem', letterSpacing: '-0.01em' }}>
                    Create Account
                </Title>
                <Text type="secondary" style={{ fontSize: 14 }}>
                    Fill in your details to get started with RetailOps
                </Text>
            </div>

            <Form
                layout="vertical"
                onFinish={onFinish}
                requiredMark={false}
                size="large"
            >
                <Form.Item
                    label={<Text strong style={{ fontSize: '13px' }}>Full Name</Text>}
                    name="name"
                    rules={[{ required: true, message: 'Name is required' }]}
                    style={{ marginBottom: 16 }}
                >
                    <Input 
                        prefix={<User size={16} className="text-zinc-400 me-2" />} 
                        placeholder="John Doe"
                    />
                </Form.Item>

                <Form.Item
                    label={<Text strong style={{ fontSize: '13px' }}>Email Address</Text>}
                    name="email"
                    rules={[
                        { required: true, message: 'Email is required' },
                        { type: 'email', message: 'Enter a valid email' }
                    ]}
                    style={{ marginBottom: 16 }}
                >
                    <Input 
                        prefix={<Mail size={16} className="text-zinc-400 me-2" />} 
                        placeholder="name@company.com"
                    />
                </Form.Item>

                <Form.Item
                    label={<Text strong style={{ fontSize: '13px' }}>Password</Text>}
                    name="password"
                    rules={[
                        { required: true, message: 'Password is required' },
                        { min: 6, message: 'Minimum 6 characters' }
                    ]}
                    style={{ marginBottom: 16 }}
                >
                    <Input.Password 
                        prefix={<Lock size={16} className="text-zinc-400 me-2" />} 
                        placeholder="••••••••"
                    />
                </Form.Item>

                <Form.Item
                    label={<Text strong style={{ fontSize: '13px' }}>Confirm Password</Text>}
                    name="confirmPassword"
                    dependencies={['password']}
                    rules={[
                        { required: true, message: 'Please confirm password' },
                        ({ getFieldValue }) => ({
                            validator(_, value) {
                                if (!value || getFieldValue('password') === value) {
                                    return Promise.resolve();
                                }
                                return Promise.reject(new Error('Passwords do not match'));
                            },
                        }),
                    ]}
                    style={{ marginBottom: 24 }}
                >
                    <Input.Password 
                        prefix={<Lock size={16} className="text-zinc-400 me-2" />} 
                        placeholder="••••••••"
                    />
                </Form.Item>

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
                        Create Account <ArrowRight size={16} />
                    </Button>
                </Form.Item>
            </Form>

            <div className="text-center mt-5">
                <Text type="secondary" style={{ fontSize: '13px' }}>
                    Already have an account? <Link to="/login" className="text-primary fw-bold ms-1">Sign In</Link>
                </Text>
            </div>

            <div className="mt-5 pt-4 border-top d-flex align-items-center justify-content-center gap-2 text-zinc-400" style={{ fontSize: '11px' }}>
                <ShieldCheck size={14} />
                <span>Verified Secure Enterprise Platform</span>
            </div>
        </AuthLayout>
    );
};

export default RegisterPage;
