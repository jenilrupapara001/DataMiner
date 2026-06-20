import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Form, Input, Button, Typography } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const stagger = {
  animate: { transition: { staggerChildren: 0.08 } }
};

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }
  }
};

const LoginPage = () => {
  const { login } = useAuth();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (values) => {
    setLoading(true);
    setError('');
    try {
      const result = await login(values.email.trim(), values.password);
      if (!result.success) {
        throw new Error(result.error || 'Login failed');
      }
    } catch (err) {
      let msg = err.message || 'An unexpected error occurred';
      if (
        msg.includes('Unexpected end of JSON input') ||
        msg.includes('Failed to execute') ||
        msg.includes('Failed to fetch') ||
        msg.includes('Network Error')
      ) {
        msg = 'Unable to connect to the server. Please try again later.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.bgOrb1} />
      <div style={styles.bgOrb2} />

      <motion.div
        style={styles.container}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div style={styles.logoWrap}>
          <img
            src="https://brandcentral.in/wp-content/uploads/2024/09/logo.png"
            alt="BrandCentral"
            style={styles.logo}
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
          style={{ width: '100%' }}
        >
          <div style={styles.card}>
            <div style={styles.cardAccent} />

            <div style={styles.cardBody}>
              <motion.div variants={stagger} initial="initial" animate="animate">
                <motion.div variants={fadeUp} style={styles.header}>
                  <Title level={3} style={styles.title}>Welcome back</Title>
                  <Text style={styles.subtitle}>
                    Sign in to your account
                  </Text>
                </motion.div>

                <AnimatePresence mode="wait">
                  {error && (
                    <motion.div
                      key="error"
                      style={styles.errorBox}
                      initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                      animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      <motion.div
                        animate={{ x: [0, -6, 6, -4, 4, 0] }}
                        transition={{ duration: 0.4 }}
                        style={styles.errorInner}
                      >
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <span>{error}</span>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.div variants={fadeUp}>
                  <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                    autoComplete="off"
                    size="large"
                    requiredMark={false}
                  >
                    <Form.Item
                      name="email"
                      rules={[
                        { required: true, message: 'Please enter your email' },
                        { type: 'email', message: 'Please enter a valid email' }
                      ]}
                    >
                      <Input
                        prefix={<MailOutlined style={{ color: '#8c8e8f' }} />}
                        placeholder="Email address"
                        autoFocus
                      />
                    </Form.Item>

                    <Form.Item
                      name="password"
                      rules={[{ required: true, message: 'Please enter your password' }]}
                    >
                      <Input.Password
                        prefix={<LockOutlined style={{ color: '#8c8e8f' }} />}
                        placeholder="Password"
                        iconRender={(visible) =>
                          visible ? (
                            <span style={{ fontSize: 13, color: '#545657' }}>Hide</span>
                          ) : (
                            <span style={{ fontSize: 13, color: '#545657' }}>Show</span>
                          )
                        }
                      />
                    </Form.Item>

                    <Form.Item style={{ marginBottom: 0 }}>
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Button
                          type="primary"
                          htmlType="submit"
                          loading={loading}
                          block
                          size="large"
                          style={styles.submitBtn}
                        >
                          Sign in
                        </Button>
                      </motion.div>
                    </Form.Item>
                  </Form>
                </motion.div>
              </motion.div>

              <motion.div
                style={styles.footer}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.4 }}
              >
                <Text style={styles.footerText}>
                  &copy; {new Date().getFullYear()} BrandCentral. All rights reserved.
                </Text>
              </motion.div>
            </div>
          </div>
        </motion.div>

        <motion.div
          style={styles.brandBadge}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
        >
          <Text style={styles.brandBadgeText}>Enterprise Platform</Text>
        </motion.div>
      </motion.div>
    </div>
  );
};

const styles = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    background: '#f4f5f7',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  bgOrb1: {
    position: 'absolute',
    width: 600,
    height: 600,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(251,79,64,0.08) 0%, transparent 65%)',
    top: -250,
    right: -180,
    pointerEvents: 'none'
  },
  bgOrb2: {
    position: 'absolute',
    width: 500,
    height: 500,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(251,79,64,0.05) 0%, transparent 65%)',
    bottom: -200,
    left: -120,
    pointerEvents: 'none'
  },
  container: {
    width: '100%',
    maxWidth: 440,
    padding: '40px 24px',
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  logoWrap: {
    textAlign: 'center',
    marginBottom: 40
  },
  logo: {
    height: 42,
    width: 'auto',
    objectFit: 'contain'
  },
  card: {
    position: 'relative',
    background: '#ffffff',
    borderRadius: 16,
    padding: 0,
    overflow: 'hidden',
    border: '1px solid #d9e6e9',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 16px 48px -8px rgba(251,79,64,0.08)'
  },
  cardAccent: {
    height: 4,
    width: '100%',
    background: 'linear-gradient(90deg, #fb4f40 0%, #fc7a6e 50%, #fb4f40 100%)'
  },
  cardBody: {
    padding: '32px 32px 0'
  },
  header: {
    textAlign: 'center',
    marginBottom: 24
  },
  title: {
    margin: 0,
    fontWeight: 700,
    fontSize: 23,
    letterSpacing: '-0.4px',
    color: '#121b1e'
  },
  subtitle: {
    display: 'block',
    marginTop: 6,
    fontSize: 14,
    color: '#545657'
  },
  errorBox: {
    overflow: 'hidden'
  },
  errorInner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: '10px 14px',
    background: '#fff0f0',
    border: '1px solid #ffb3ae',
    borderRadius: 10,
    color: '#b7352a',
    fontSize: 13,
    fontWeight: 500,
    lineHeight: 1.4
  },
  submitBtn: {
    height: 50,
    fontSize: 15,
    fontWeight: 600,
    borderRadius: 12,
    border: 'none',
    background: 'linear-gradient(135deg, #fb4f40 0%, #d94033 100%)',
    boxShadow: '0 4px 16px rgba(251,79,64,0.30)'
  },
  footer: {
    textAlign: 'center',
    padding: '24px 0 32px'
  },
  footerText: {
    fontSize: 12,
    color: '#8c8e8f'
  },
  brandBadge: {
    marginTop: 32,
    textAlign: 'center'
  },
  brandBadgeText: {
    fontSize: 11,
    letterSpacing: '2px',
    textTransform: 'uppercase',
    color: '#cbd0d4',
    fontWeight: 600
  }
};

export default LoginPage;
