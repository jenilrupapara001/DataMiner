import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../services/api';
import { Button, Input, Checkbox, Card, Alert, Spin, Tag, Typography } from 'antd';
import { SafetyCertificateOutlined, CheckCircleOutlined, LockOutlined, RocketOutlined, ArrowRightOutlined, ArrowLeftOutlined, EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';

const { Title, Text } = Typography;
const fadeUp = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0, transition: { duration: 0.4 } }, exit: { opacity: 0, y: -20 } };

const steps = [
  { id: 'welcome', icon: <RocketOutlined />, title: 'Welcome to RetailOps', subtitle: "Let's get you started" },
  { id: 'security', icon: <SafetyCertificateOutlined />, title: 'Security Tips', subtitle: 'Keep your account safe' },
  { id: 'password', icon: <LockOutlined />, title: 'Set Your Password', subtitle: 'Create a strong password' },
  { id: 'policies', icon: <CheckCircleOutlined />, title: 'Terms & Policies', subtitle: 'Review and accept' },
  { id: 'complete', icon: <RocketOutlined />, title: 'All Done!', subtitle: 'You are ready' },
];

// Password strength checker (simple)
function getPasswordStrength(pw) {
  if (!pw) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pw.length >= 12) score++;
  if (pw.length >= 16) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[!@#$%^&*]/.test(pw)) score++;
  if (score <= 2) return { score: 25, label: 'Weak', color: '#dc2626' };
  if (score <= 3) return { score: 50, label: 'Fair', color: '#f59e0b' };
  if (score <= 4) return { score: 75, label: 'Good', color: '#2563eb' };
  return { score: 100, label: 'Strong', color: '#059669' };
}

const SetupWizardPage = () => {
  const navigate = useNavigate();
  const { user, completeLogin } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [passwordForm, setPasswordForm] = useState({ current: '', newPw: '', confirm: '' });
  const [showPw, setShowPw] = useState({ current: false, newPw: false, confirm: false });
  const [policies, setPolicies] = useState({ tos: false, privacy: false, responsibilities: false });
  const [showPwError, setShowPwError] = useState(false);

  const pwStrength = getPasswordStrength(passwordForm.newPw);
  const pwValid = passwordForm.newPw.length >= 12 && passwordForm.newPw === passwordForm.confirm &&
    /[A-Z]/.test(passwordForm.newPw) && /[a-z]/.test(passwordForm.newPw) && /[0-9]/.test(passwordForm.newPw) && /[!@#$%^&*]/.test(passwordForm.newPw);
  const policiesValid = policies.tos && policies.privacy && policies.responsibilities;

  const handleCompleteStep = async (stepId) => {
    setLoading(true); setError('');
    try {
      if (stepId === 'password') {
        if (!passwordForm.current || !passwordForm.newPw) { setError('Please fill all fields'); setLoading(false); return; }
        if (!pwValid) { setError('Password must be 12+ chars with uppercase, lowercase, number, and special character'); setShowPwError(true); setLoading(false); return; }
        await authApi.post('/setup-wizard/password', { currentPassword: passwordForm.current, newPassword: passwordForm.newPw });
      } else if (stepId === 'policies') {
        if (!policiesValid) { setError('Please accept all policies to continue'); setLoading(false); return; }
        await authApi.post('/setup-wizard/step/accept_policies/complete');
      } else {
        await authApi.post(`/setup-wizard/step/${stepId}/complete`);
      }
      setCurrentStep(prev => prev + 1);
    } catch (e) {
      setError(e.message || 'Failed to save');
    } finally { setLoading(false); }
  };

  const handleFinalComplete = async () => {
    setLoading(true);
    try {
      await authApi.post('/setup-wizard/complete');
      // Update user in context
      const meRes = await authApi.getMe?.() || await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` } }).then(r => r.json());
      if (meRes?.data) {
        const { normalizeUser } = await import('../contexts/AuthContext');
        // Force page reload to pick up updated user state
        window.location.href = '/';
      } else {
        window.location.href = '/';
      }
    } catch (e) {
      setError(e.message || 'Failed to complete setup');
      setLoading(false);
    }
  };

  const step = steps[currentStep];

  // Welcome Step
  const renderWelcome = () => (
    <div style={{ textAlign: 'center' }}>
      <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg, #667eea, #764ba2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
        <RocketOutlined style={{ fontSize: 32, color: '#fff' }} />
      </div>
      <Title level={3} style={{ margin: '0 0 8px' }}>Welcome, {user?.firstName || 'there'}!</Title>
      <Text style={{ fontSize: 14, color: '#64748b', display: 'block', marginBottom: 24, lineHeight: 1.6 }}>
        We'll set up your account in just a few steps. This will take about 2-3 minutes.
      </Text>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left', maxWidth: 360, margin: '0 auto' }}>
        {['Change your password to something secure', 'Review our security policies', 'Get started with your dashboard'].map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#f8fafc', borderRadius: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: '#18181b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
            <Text style={{ fontSize: 13, color: '#334155' }}>{item}</Text>
          </div>
        ))}
      </div>
    </div>
  );

  // Security Tips Step
  const renderSecurity = () => (
    <div>
      <Title level={4} style={{ textAlign: 'center', margin: '0 0 16px' }}>Keep Your Account Safe</Title>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {[
          { icon: '🔑', title: 'Strong Password', desc: 'Use 12+ characters with mix of letters, numbers, symbols' },
          { icon: '🔒', title: 'Trust Devices', desc: 'Only check "trust" on devices you own' },
          { icon: '⚠️', title: 'Never Share OTP', desc: 'RetailOps staff will never ask for your OTP code' },
          { icon: '📧', title: 'Watch for Phishing', desc: 'Verify sender before clicking links in emails' },
        ].map((tip, i) => (
          <Card key={i} size="small" style={{ borderRadius: 8, border: '1px solid #e4e4e7' }} styles={{ body: { padding: 12 } }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>{tip.icon}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#18181b', marginBottom: 4 }}>{tip.title}</div>
            <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.4 }}>{tip.desc}</div>
          </Card>
        ))}
      </div>
    </div>
  );

  // Password Step
  const renderPassword = () => (
    <div>
      <Title level={4} style={{ textAlign: 'center', margin: '0 0 8px' }}>Create Your Password</Title>
      <Text style={{ fontSize: 13, color: '#64748b', display: 'block', textAlign: 'center', marginBottom: 20 }}>
        Enter your current password, then set a new strong one.
      </Text>
      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 12 }} closable onClose={() => setError('')} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 380, margin: '0 auto' }}>
        <div>
          <Text style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4, display: 'block' }}>Current Password *</Text>
          <Input.Password value={passwordForm.current} onChange={e => setPasswordForm({ ...passwordForm, current: e.target.value })}
            placeholder="Enter current password" style={{ borderRadius: 8 }} iconRender={vis => vis ? <EyeOutlined /> : <EyeInvisibleOutlined />} />
        </div>
        <div>
          <Text style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4, display: 'block' }}>New Password *</Text>
          <Input.Password value={passwordForm.newPw} onChange={e => { setPasswordForm({ ...passwordForm, newPw: e.target.value }); setShowPwError(false); }}
            placeholder="Create a strong password" style={{ borderRadius: 8 }} iconRender={vis => vis ? <EyeOutlined /> : <EyeInvisibleOutlined />} />
          {passwordForm.newPw && (
            <div style={{ marginTop: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 11, color: pwStrength.color, fontWeight: 600 }}>{pwStrength.label}</Text>
                <Text style={{ fontSize: 10, color: '#a1a1aa' }}>12+ chars, upper, lower, number, symbol</Text>
              </div>
              <div style={{ height: 4, background: '#e4e4e7', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pwStrength.score}%`, background: pwStrength.color, borderRadius: 2, transition: 'width 0.3s' }} />
              </div>
            </div>
          )}
        </div>
        <div>
          <Text style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4, display: 'block' }}>Confirm Password *</Text>
          <Input.Password value={passwordForm.confirm} onChange={e => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
            placeholder="Confirm your new password" style={{ borderRadius: 8 }} iconRender={vis => vis ? <EyeOutlined /> : <EyeInvisibleOutlined />} />
          {passwordForm.confirm && passwordForm.newPw !== passwordForm.confirm && (
            <Text style={{ fontSize: 11, color: '#dc2626', marginTop: 4, display: 'block' }}>Passwords do not match</Text>
          )}
        </div>
      </div>
    </div>
  );

  // Policies Step
  const renderPolicies = () => (
    <div>
      <Title level={4} style={{ textAlign: 'center', margin: '0 0 16px' }}>Terms & Policies</Title>
      <Text style={{ fontSize: 13, color: '#64748b', display: 'block', textAlign: 'center', marginBottom: 20 }}>
        Please review and accept the following policies.
      </Text>
      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 12 }} closable onClose={() => setError('')} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 400, margin: '0 auto' }}>
        {[
          { key: 'tos', label: 'I agree to the Terms of Service', link: '/terms', required: true },
          { key: 'privacy', label: 'I agree to the Privacy Policy', link: '/privacy', required: true },
          { key: 'responsibilities', label: 'I understand my security responsibilities', link: null, required: true },
        ].map(item => (
          <Card key={item.key} size="small" style={{ borderRadius: 8, border: `1px solid ${policies[item.key] ? '#d1fae5' : '#e4e4e7'}`, background: policies[item.key] ? '#f0fdf4' : '#fff' }}
            styles={{ body: { padding: '10px 14px' } }}>
            <Checkbox checked={policies[item.key]} onChange={e => setPolicies({ ...policies, [item.key]: e.target.checked })}>
              <Text style={{ fontSize: 12, color: '#334155' }}>{item.label}</Text>
              {item.link && <a href={item.link} target="_blank" rel="noreferrer" style={{ fontSize: 11, marginLeft: 6 }}>Read</a>}
            </Checkbox>
          </Card>
        ))}
      </div>
    </div>
  );

  // Complete Step
  const renderComplete = () => (
    <div style={{ textAlign: 'center' }}>
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#ecfdf5', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <CheckCircleOutlined style={{ fontSize: 40, color: '#059669' }} />
        </div>
      </motion.div>
      <Title level={3} style={{ margin: '0 0 8px' }}>You're All Set!</Title>
      <Text style={{ fontSize: 14, color: '#64748b', display: 'block', marginBottom: 24 }}>
        Your account is secure and ready to go. Welcome aboard!
      </Text>
      <Tag color="success" style={{ fontSize: 11, padding: '4px 12px' }}>Setup Complete</Tag>
    </div>
  );

  const renderStep = () => {
    switch (step.id) {
      case 'welcome': return renderWelcome();
      case 'security': return renderSecurity();
      case 'password': return renderPassword();
      case 'policies': return renderPolicies();
      case 'complete': return renderComplete();
      default: return null;
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: 20, fontFamily: "'Inter', sans-serif" }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ width: '100%', maxWidth: 520 }}>
        {/* Progress */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 16 }}>
          {steps.map((s, i) => (
            <div key={s.id} style={{ width: i <= currentStep ? 32 : 8, height: 8, borderRadius: 4, background: i <= currentStep ? '#fff' : 'rgba(255,255,255,0.3)', transition: 'all 0.3s' }} />
          ))}
        </div>
        <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', display: 'block', textAlign: 'center', marginBottom: 12 }}>
          Step {currentStep + 1} of {steps.length}
        </Text>

        {/* Card */}
        <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '24px 28px 0', borderBottom: 'none' }}>
            <Text style={{ fontSize: 10, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{step.subtitle}</Text>
          </div>

          {/* Content */}
          <div style={{ padding: '20px 28px', minHeight: 320 }}>
            <AnimatePresence mode="wait">
              <motion.div key={currentStep} {...fadeUp}>
                {renderStep()}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div style={{ padding: '16px 28px', borderTop: '1px solid #f4f4f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {currentStep > 0 && currentStep < steps.length - 1 ? (
              <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => setCurrentStep(p => p - 1)} style={{ fontSize: 12, color: '#71717a' }}>Back</Button>
            ) : <div />}
            {currentStep < steps.length - 1 ? (
              <Button type="primary" icon={<ArrowRightOutlined />} loading={loading} onClick={() => handleCompleteStep(step.id)}
                disabled={step.id === 'password' ? !pwValid : step.id === 'policies' ? !policiesValid : false}
                style={{ borderRadius: 8, fontWeight: 600, fontSize: 12, height: 32 }}>
                {currentStep === steps.length - 2 ? 'Complete Setup' : 'Continue'}
              </Button>
            ) : (
              <Button type="primary" loading={loading} onClick={handleFinalComplete}
                style={{ borderRadius: 8, fontWeight: 600, fontSize: 12, height: 32, background: '#059669', borderColor: '#059669' }}>
                Go to Dashboard
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default SetupWizardPage;
