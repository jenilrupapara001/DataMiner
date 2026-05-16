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
    ShieldCheck,
    Contact
} from 'lucide-react';
import AuthLayout from '../components/auth/AuthLayout';

const { Title, Text, Paragraph } = Typography;

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
                message.success('Account created! Welcome to the enterprise network.');
                navigate('/');
            } else {
                message.error(result.error || 'Registration failed. Access denied.');
            }
        } catch (error) {
            message.error('An unexpected error occurred during account creation.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout
            heroTitle="Build your Retail Legacy."
            heroSubtitle="Join thousands of top-tier sellers who trust RetailOps for their mission-critical marketplace operations."
            features={[
                { icon: <Sparkles size={20} />, title: 'Premium Intelligence', desc: 'Enterprise-grade sales tracking' },
                { icon: <Users size={20} />, title: 'Team Collaboration', desc: 'Multi-user role management' },
                { icon: <ShieldCheck size={20} />, title: 'Privacy First', desc: 'Secure data isolation' }
            ]}
            footerText="RetailOps. Start Scaling Today."
        >
            <div style={{ marginBottom: 40 }}>
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
                    Register Account
                </Title>
                <Paragraph style={{ color: '#78716C', fontSize: 16, lineHeight: 1.5 }}>
                    Enter your professional details to request access to the platform.
                </Paragraph>
            </div>

            <Form
                layout="vertical"
                onFinish={onFinish}
                requiredMark={false}
                size="large"
            >
                <Form.Item
                    label="Full Name"
                    name="name"
                    rules={[{ required: true, message: 'Name is required' }]}
                    style={{ marginBottom: 20 }}
                >
                    <Input 
                        prefix={<Contact size={18} style={{ color: '#A8A29E', marginRight: 10 }} />} 
                        placeholder="e.g. John Doe"
                        style={{ height: 54, fontSize: 15 }}
                    />
                </Form.Item>

                <Form.Item
                    label="Corporate Email"
                    name="email"
                    rules={[
                        { required: true, message: 'Corporate email is required' },
                        { type: 'email', message: 'Enter a valid corporate email' }
                    ]}
                    style={{ marginBottom: 20 }}
                >
                    <Input 
                        prefix={<Mail size={18} style={{ color: '#A8A29E', marginRight: 10 }} />} 
                        placeholder="name@company.com"
                        style={{ height: 54, fontSize: 15 }}
                    />
                </Form.Item>

                <Form.Item
                    label="Access Key"
                    name="password"
                    rules={[
                        { required: true, message: 'Password is required' },
                        { min: 6, message: 'Security requires at least 6 characters' }
                    ]}
                    style={{ marginBottom: 20 }}
                >
                    <Input.Password 
                        prefix={<Lock size={18} style={{ color: '#A8A29E', marginRight: 10 }} />} 
                        placeholder="••••••••"
                        style={{ height: 54, fontSize: 15 }}
                    />
                </Form.Item>

                <Form.Item
                    label="Verify Access Key"
                    name="confirmPassword"
                    dependencies={['password']}
                    rules={[
                        { required: true, message: 'Please confirm your password' },
                        ({ getFieldValue }) => ({
                            validator(_, value) {
                                if (!value || getFieldValue('password') === value) {
                                    return Promise.resolve();
                                }
                                return Promise.reject(new Error('Access keys do not match'));
                            },
                        }),
                    ]}
                    style={{ marginBottom: 32 }}
                >
                    <Input.Password 
                        prefix={<Lock size={18} style={{ color: '#A8A29E', marginRight: 10 }} />} 
                        placeholder="••••••••"
                        style={{ height: 54, fontSize: 15 }}
                    />
                </Form.Item>

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
                        CREATE ACCOUNT <ArrowRight size={18} />
                    </Button>
                </Form.Item>
            </Form>

            <div style={{ textAlign: 'center' }}>
                <Text style={{ fontSize: '14px', color: '#78716C', fontWeight: 500 }}>
                    Already have access? <Link to="/login" style={{ color: '#1C1917', fontWeight: 800, marginLeft: '6px', borderBottom: '2px solid #CA8A04' }}>Sign In</Link>
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
                <span>SECURED BY ENTERPRISE ENCRYPTION</span>
            </div>
        </AuthLayout>
    );
};

export default RegisterPage;
