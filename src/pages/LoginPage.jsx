import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Form, Input, Button, Typography, Checkbox, Alert, Spin } from 'antd';
import { MailOutlined, LockOutlined, SafetyCertificateOutlined, ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const fadeUp = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } } };

// ─── OTP Verification Step ─────────────────────────────────
const OtpStep = ({ tempToken, destination, expiresIn, onBack }) => {
  const { completeLogin } = useAuth();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(expiresIn || 300);
  const [trustDevice, setTrustDevice] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);
  const inputRefs = useRef([]);

  useEffect(() => { inputRefs.current[0]?.focus(); }, []);
  useEffect(() => { if (timeLeft <= 0) return; const t = setInterval(() => setTimeLeft(p => Math.max(0, p - 1)), 1000); return () => clearInterval(t); }, [timeLeft]);
  useEffect(() => { if (resendCooldown <= 0) return; const t = setInterval(() => setResendCooldown(p => Math.max(0, p - 1)), 1000); return () => clearInterval(t); }, [resendCooldown]);

  const handleChange = (index, val) => {
    if (val && !/^\d$/.test(val)) return;
    const next = [...otp]; next[index] = val; setOtp(next);
    if (val && index < 5) inputRefs.current[index + 1]?.focus();
    if (next.every(d => d)) verify(next.join(''));
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) inputRefs.current[index - 1]?.focus();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (p.length === 6) { setOtp(p.split('')); verify(p); }
  };

  const verify = async (code) => {
    setLoading(true); setError('');
    try {
      const res = await authApi.verifyOtp(tempToken, code, trustDevice);
      if (res.success) {
        await completeLogin(res);
      }
    } catch (e) {
      setError(e.message || 'Verification failed');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      if (e.message?.includes('expired')) setTimeout(onBack, 2000);
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setResending(true); setError('');
    try {
      const res = await authApi.resendOtp(tempToken);
      setTimeLeft(res.expiresIn);
      setResendCooldown(60);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (e) { setError(e.message || 'Failed to resend'); }
    finally { setResending(false); }
  };

  const fmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div style={styles.card}>
      <div style={styles.cardAccent} />
      <div style={styles.cardBody}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#f0f5ff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <SafetyCertificateOutlined style={{ fontSize: 22, color: '#4f46e5' }} />
          </div>
          <Title level={4} style={{ margin: 0 }}>Verify Your Identity</Title>
          <Text style={{ fontSize: 13, color: '#64748b', display: 'block', marginTop: 6 }}>
            We sent a 6-digit code to <strong>{destination}</strong>
          </Text>
        </div>

        {error && <Alert message={error} type="error" showIcon closable onClose={() => setError('')} style={{ marginBottom: 16 }} />}

        {/* OTP Inputs */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
          {otp.map((d, i) => (
            <input key={i} ref={el => inputRefs.current[i] = el} type="text" inputMode="numeric" maxLength={1}
              value={d} onChange={e => handleChange(i, e.target.value)} onKeyDown={e => handleKeyDown(i, e)}
              onPaste={i === 0 ? handlePaste : undefined} disabled={loading}
              style={{ width: 44, height: 52, fontSize: 22, fontWeight: 600, textAlign: 'center', border: `2px solid ${d ? '#4f46e5' : '#e2e8f0'}`, borderRadius: 8, outline: 'none', fontFamily: 'monospace', background: d ? '#f5f3ff' : '#fff', transition: 'all 0.15s' }} />
          ))}
        </div>

        {timeLeft > 0 ? (
          <Text style={{ display: 'block', textAlign: 'center', fontSize: 13, color: timeLeft < 60 ? '#dc2626' : '#64748b', marginBottom: 16 }}>
            Expires in {fmt(timeLeft)}
          </Text>
        ) : (
          <Alert type="warning" message="Code expired. Please request a new one." showIcon style={{ marginBottom: 16 }} />
        )}

        <div style={{ marginBottom: 16 }}>
          <Checkbox checked={trustDevice} onChange={e => setTrustDevice(e.target.checked)}>
            <span style={{ fontSize: 13 }}>Trust this device for 30 days</span>
          </Checkbox>
        </div>

        <Button type="primary" block size="large" loading={loading} disabled={otp.some(d => !d)}
          onClick={() => verify(otp.join(''))} style={styles.submitBtn}>
          Verify & Sign In
        </Button>

        <div style={{ textAlign: 'center', marginTop: 16, display: 'flex', justifyContent: 'center', gap: 16 }}>
          <Button type="link" size="small" icon={<ReloadOutlined />} onClick={handleResend} loading={resending} disabled={resendCooldown > 0} style={{ fontSize: 12, color: '#4f46e5' }}>
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
          </Button>
          <Button type="link" size="small" icon={<ArrowLeftOutlined />} onClick={onBack} style={{ fontSize: 12 }}>Back to Login</Button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Login Page ────────────────────────────────────────
const LoginPage = () => {
  const { login } = useAuth();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState('login');
  const [otpData, setOtpData] = useState(null);

  const handleSubmit = async (values) => {
    setLoading(true); setError('');
    try {
      const result = await login(values.email.trim(), values.password);
      if (!result.success) throw new Error(result.error || 'Login failed');

      // Check if OTP is required (login returns requiresOtp)
      if (result.requiresOtp) {
        setOtpData({ tempToken: result.tempToken, destination: result.destination, expiresIn: result.expiresIn });
        setStep('otp');
        return;
      }

      // Force password reset
      if (result.forcePasswordReset) {
        setError('Password reset required. Please contact administrator.');
        return;
      }

      // Trusted device — direct login already handled by AuthContext
    } catch (err) {
      let msg = err.message || 'An unexpected error occurred';
      if (msg.includes('fetch') || msg.includes('network')) msg = 'Unable to connect to the server.';
      setError(msg);
    } finally { setLoading(false); }
  };

  // OTP step
  if (step === 'otp' && otpData) {
    return (
      <div style={styles.wrapper}>
        <div style={styles.bgOrb1} /><div style={styles.bgOrb2} />
        <motion.div style={styles.container} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
          <div style={styles.logoWrap}>
            <img src="https://brandcentral.in/wp-content/uploads/2024/09/logo.png" alt="BrandCentral" style={styles.logo} />
          </div>
          <OtpStep {...otpData} onBack={() => { setStep('login'); setOtpData(null); setError(''); }} />
        </motion.div>
      </div>
    );
  }

  // Login step
  return (
    <div style={styles.wrapper}>
      <div style={styles.bgOrb1} /><div style={styles.bgOrb2} />
      <motion.div style={styles.container} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
        <div style={styles.logoWrap}>
          <img src="https://brandcentral.in/wp-content/uploads/2024/09/logo.png" alt="BrandCentral" style={styles.logo} />
        </div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} style={{ width: '100%' }}>
          <div style={styles.card}>
            <div style={styles.cardAccent} />
            <div style={styles.cardBody}>
              <motion.div style={styles.header}>
                <Title level={3} style={styles.title}>Welcome back</Title>
                <Text style={styles.subtitle}>Sign in to your account</Text>
              </motion.div>

              <AnimatePresence mode="wait">
                {error && (
                  <motion.div key="err" style={styles.errorBox} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
                    <div style={styles.errorInner}><span>{error}</span></div>
                  </motion.div>
                )}
              </AnimatePresence>

              <Form form={form} layout="vertical" onFinish={handleSubmit} autoComplete="off" size="large" requiredMark={false}>
                <Form.Item name="email" rules={[{ required: true, message: 'Email required' }, { type: 'email', message: 'Invalid email' }]}>
                  <Input prefix={<MailOutlined style={{ color: '#8c8e8f' }} />} placeholder="Email address" autoFocus />
                </Form.Item>
                <Form.Item name="password" rules={[{ required: true, message: 'Password required' }]}>
                  <Input.Password prefix={<LockOutlined style={{ color: '#8c8e8f' }} />} placeholder="Password" />
                </Form.Item>
                <Form.Item style={{ marginBottom: 0 }}>
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button type="primary" htmlType="submit" loading={loading} block size="large" style={styles.submitBtn}>
                      {loading ? 'Verifying...' : 'Continue →'}
                    </Button>
                  </motion.div>
                </Form.Item>
              </Form>

              {/* <div style={{ textAlign: 'center', marginTop: 20, padding: '12px', background: '#f5f3ff', borderRadius: 8, fontSize: 12, color: '#7c3aed' }}>
                🔐 Two-step verification required on every login
              </div> */}

              <div style={styles.footer}>
                <Text style={styles.footerText}>&copy; {new Date().getFullYear()} BrandCentral. All rights reserved.</Text>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

const styles = {
  wrapper: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', background: '#f4f5f7', fontFamily: "'Inter', sans-serif" },
  bgOrb1: { position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(251,79,64,0.08) 0%, transparent 65%)', top: '-200px', left: '-200px' },
  bgOrb2: { position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,70,229,0.06) 0%, transparent 65%)', bottom: '-150px', right: '-100px' },
  container: { width: '100%', maxWidth: 420, padding: '0 20px', zIndex: 1 },
  logoWrap: { textAlign: 'center', marginBottom: 24 },
  logo: { height: 36, width: 'auto' },
  card: { background: '#fff', borderRadius: 16, boxShadow: '0 8px 30px rgba(0,0,0,0.06)', overflow: 'hidden', position: 'relative' },
  cardAccent: { height: 3, background: 'linear-gradient(90deg, #fb4f40, #f97316, #fb4f40)' },
  cardBody: { padding: '32px 28px 24px' },
  header: { textAlign: 'center', marginBottom: 24 },
  title: { fontSize: 20, fontWeight: 700, margin: 0, color: '#18181b' },
  subtitle: { fontSize: 13, color: '#71717a', display: 'block', marginTop: 4 },
  errorBox: { overflow: 'hidden' },
  errorInner: { display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: 12, lineHeight: 1.5 },
  submitBtn: { height: 44, fontWeight: 600, fontSize: 14, borderRadius: 10, background: '#18181b', borderColor: '#18181b' },
  footer: { textAlign: 'center', marginTop: 20, paddingTop: 16, borderTop: '1px solid #f4f4f5' },
  footerText: { fontSize: 11, color: '#a1a1aa' },
};

export default LoginPage;
