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
            <div style={{ marginBottom: 32, textAlign: 'center' }}>
                <Title level={3} style={{ 
                    marginBottom: 8, 
                    fontWeight: 700, 
                    fontSize: '1.75rem', 
                    letterSpacing: '-0.03em',
                    color: '#09090B' 
                }}>
                    Create Account
                </Title>
                <Paragraph style={{ color: '#52525B', fontSize: 14, lineHeight: 1.5, marginBottom: 0 }}>
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
                        prefix={<Contact size={16} style={{ color: '#71717A', marginRight: 8 }} />} 
                        placeholder="e.g. John Doe"
                        style={{ height: 50, fontSize: 14 }}
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
                        prefix={<Mail size={16} style={{ color: '#71717A', marginRight: 8 }} />} 
                        placeholder="name@company.com"
                        style={{ height: 50, fontSize: 14 }}
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
                        prefix={<Lock size={16} style={{ color: '#71717A', marginRight: 8 }} />} 
                        placeholder="••••••••"
                        style={{ height: 50, fontSize: 14 }}
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
                        prefix={<Lock size={16} style={{ color: '#71717A', marginRight: 8 }} />} 
                        placeholder="••••••••"
                        style={{ height: 50, fontSize: 14 }}
                    />
                </Form.Item>

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
                        Create Account <ArrowRight size={16} />
                    </Button>
                </Form.Item>
            </Form>

            <div style={{ textAlign: 'center' }}>
                <Text style={{ fontSize: '13px', color: '#52525B', fontWeight: 500 }}>
                    Already have access? <Link to="/login" style={{ color: '#0145f2', fontWeight: 600, marginLeft: '6px', borderBottom: '1px solid #0145f2', paddingBottom: 2 }}>Sign In</Link>
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
                <span>SECURED BY ENTERPRISE ENCRYPTION</span>
            </div>
        </AuthLayout>
    );
};

export default RegisterPage;
