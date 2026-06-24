// frontend/src/pages/SetupWizardPage.jsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../services/api';
import { Input, Alert, Typography, Progress } from 'antd';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Rocket,
  Shield,
  Lock,
  FileCheck,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  Check,
  Key,
  Smartphone,
  AlertTriangle,
  UserCheck,
  Sparkles,
  Loader2,
  ChevronRight,
  Info,
  ExternalLink,
  LayoutDashboard
} from 'lucide-react';

const { Title, Text } = Typography;

// Animation variants
const slideVariants = {
  initial: { opacity: 0, x: 20 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] }
  },
  exit: {
    opacity: 0,
    x: -20,
    transition: { duration: 0.2 }
  }
};

// Wizard steps configuration
const steps = [
  { id: 'welcome', icon: Rocket, title: 'Welcome', subtitle: 'Get started' },
  { id: 'security', icon: Shield, title: 'Security Tips', subtitle: 'Best practices' },
  { id: 'password', icon: Lock, title: 'Set Password', subtitle: 'Secure credentials' },
  { id: 'policies', icon: FileCheck, title: 'Policies', subtitle: 'Review & accept' },
  { id: 'complete', icon: CheckCircle2, title: 'Complete', subtitle: 'All ready' }
];

// Password strength calculator
function getPasswordStrength(pw) {
  if (!pw) return { score: 0, label: '', color: '#e4e4e7', percent: 0 };

  let score = 0;
  if (pw.length >= 12) score++;
  if (pw.length >= 16) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(pw)) score++;

  if (score <= 2) return { score, label: 'Weak', color: '#ef4444', percent: 25 };
  if (score <= 3) return { score, label: 'Fair', color: '#f59e0b', percent: 50 };
  if (score <= 4) return { score, label: 'Good', color: '#3b82f6', percent: 75 };
  return { score, label: 'Strong', color: '#10b981', percent: 100 };
}

// Get user's full name
const getUserFullName = (user) => {
  if (!user) return 'there';
  const firstName = user.firstName || user.FirstName || '';
  const lastName = user.lastName || user.LastName || '';
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || user.email?.split('@')[0] || 'there';
};

const SetupWizardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [passwordForm, setPasswordForm] = useState({
    current: '',
    newPw: '',
    confirm: ''
  });
  const [policies, setPolicies] = useState({
    tos: false,
    privacy: false,
    responsibilities: false
  });

  const fullName = getUserFullName(user);
  const pwStrength = getPasswordStrength(passwordForm.newPw);

  const pwRequirements = [
    { met: passwordForm.newPw.length >= 12, text: 'At least 12 characters' },
    { met: /[A-Z]/.test(passwordForm.newPw), text: 'One uppercase letter' },
    { met: /[a-z]/.test(passwordForm.newPw), text: 'One lowercase letter' },
    { met: /[0-9]/.test(passwordForm.newPw), text: 'One number' },
    { met: /[!@#$%^&*(),.?":{}|<>]/.test(passwordForm.newPw), text: 'One special character' }
  ];

  const pwValid = pwRequirements.every(r => r.met) &&
    passwordForm.newPw === passwordForm.confirm &&
    passwordForm.confirm.length > 0;

  const policiesValid = policies.tos && policies.privacy && policies.responsibilities;

  const handleNextStep = async () => {
    const step = steps[currentStep];
    setError('');
    setLoading(true);

    try {
      if (step.id === 'password') {
        if (!passwordForm.current || !passwordForm.newPw) {
          setError('Please fill in all password fields');
          setLoading(false);
          return;
        }
        if (!pwValid) {
          setError('Password does not meet all requirements');
          setLoading(false);
          return;
        }
        await authApi.post('/setup-wizard/password', {
          currentPassword: passwordForm.current,
          newPassword: passwordForm.newPw
        });
      } else if (step.id === 'policies') {
        if (!policiesValid) {
          setError('Please accept all policies to continue');
          setLoading(false);
          return;
        }
        await authApi.post('/setup-wizard/step/accept_policies/complete');
      } else {
        await authApi.post(`/setup-wizard/step/${step.id}/complete`);
      }

      setCurrentStep(prev => prev + 1);
    } catch (e) {
      setError(e.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFinalComplete = async () => {
    setLoading(true);
    try {
      await authApi.post('/setup-wizard/complete');
      window.location.href = '/';
    } catch (e) {
      setError(e.message || 'Failed to complete setup');
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      setError('');
    }
  };

  // ============================================
  // STEP COMPONENTS
  // ============================================

  const renderWelcome = () => (
    <div className="step-content welcome-step">
      <div className="step-icon-wrapper">
        <div className="step-icon-bg welcome-icon-bg">
          <Rocket size={32} strokeWidth={2} color="#4f46e5" />
        </div>
      </div>

      <Title level={2} className="step-title">
        Welcome to RetailOps, {fullName}
      </Title>

      <Text className="step-description">
        Let's set up your account in just a few steps. This will take about 2-3 minutes.
      </Text>

      <div className="welcome-features">
        {[
          {
            icon: Lock,
            title: 'Secure your account',
            desc: 'Create a strong password to protect your data'
          },
          {
            icon: Shield,
            title: 'Review security guidelines',
            desc: 'Learn how to keep your account safe'
          },
          {
            icon: FileCheck,
            title: 'Accept our policies',
            desc: 'Understand terms and your responsibilities'
          }
        ].map((feature, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 + 0.2 }}
            className="welcome-feature-item"
          >
            <div className="feature-icon">
              <feature.icon size={18} strokeWidth={2} color="#4f46e5" />
            </div>
            <div className="feature-text">
              <div className="feature-title">{feature.title}</div>
              <div className="feature-desc">{feature.desc}</div>
            </div>
            <ChevronRight size={16} color="#94a3b8" />
          </motion.div>
        ))}
      </div>
    </div>
  );

  const renderSecurity = () => (
    <div className="step-content security-step">
      <div className="step-header">
        <div className="step-icon-bg security-icon-bg">
          <Shield size={28} strokeWidth={2} color="#4f46e5" />
        </div>
        <Title level={3} className="step-title">Security Guidelines</Title>
        <Text className="step-description">
          Follow these best practices to keep your account secure
        </Text>
      </div>

      <div className="security-grid">
        {[
          {
            icon: Key,
            title: 'Strong Password',
            desc: 'Use at least 12 characters with mixed case, numbers, and symbols',
            color: '#4f46e5',
            bg: '#eef2ff'
          },
          {
            icon: Smartphone,
            title: 'Trusted Devices',
            desc: 'Only mark personal devices you control as trusted',
            color: '#06b6d4',
            bg: '#ecfeff'
          },
          {
            icon: AlertTriangle,
            title: 'Protect OTPs',
            desc: 'Our team will never ask for verification codes',
            color: '#f59e0b',
            bg: '#fffbeb'
          },
          {
            icon: UserCheck,
            title: 'Account Privacy',
            desc: 'Never share your credentials with anyone',
            color: '#10b981',
            bg: '#f0fdf4'
          }
        ].map((tip, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="security-tip-card"
          >
            <div className="tip-icon" style={{ background: tip.bg }}>
              <tip.icon size={20} strokeWidth={2} color={tip.color} />
            </div>
            <div className="tip-content">
              <div className="tip-title">{tip.title}</div>
              <div className="tip-desc">{tip.desc}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );

  const renderPassword = () => (
    <div className="step-content password-step">
      <div className="step-header">
        <div className="step-icon-bg password-icon-bg">
          <Lock size={28} strokeWidth={2} color="#4f46e5" />
        </div>
        <Title level={3} className="step-title">Create Your Password</Title>
        <Text className="step-description">
          Set a strong password to secure your account
        </Text>
      </div>

      {error && (
        <Alert
          message={error}
          type="error"
          showIcon
          closable
          onClose={() => setError('')}
          style={{ marginBottom: 16, borderRadius: 10 }}
        />
      )}

      <div className="form-container">
        {/* Current Password */}
        <div className="form-group">
          <label className="form-label">Current Temporary Password</label>
          <Input.Password
            value={passwordForm.current}
            onChange={e => setPasswordForm({ ...passwordForm, current: e.target.value })}
            placeholder="Enter your temporary password"
            size="large"
            prefix={<Lock size={16} color="#94a3b8" />}
            iconRender={visible => visible ? <Eye size={16} /> : <EyeOff size={16} />}
            className="form-input"
          />
        </div>

        {/* New Password */}
        <div className="form-group">
          <label className="form-label">New Password</label>
          <Input.Password
            value={passwordForm.newPw}
            onChange={e => setPasswordForm({ ...passwordForm, newPw: e.target.value })}
            placeholder="Create a strong password"
            size="large"
            prefix={<Lock size={16} color="#94a3b8" />}
            iconRender={visible => visible ? <Eye size={16} /> : <EyeOff size={16} />}
            className="form-input"
          />

          {passwordForm.newPw && (
            <div className="strength-meter">
              <div className="strength-header">
                <Text style={{ fontSize: 12, color: '#64748b' }}>
                  Password Strength
                </Text>
                <Text style={{ fontSize: 12, fontWeight: 600, color: pwStrength.color }}>
                  {pwStrength.label}
                </Text>
              </div>
              <Progress
                percent={pwStrength.percent}
                strokeColor={pwStrength.color}
                showInfo={false}
                size="small"
                strokeWidth={6}
              />
            </div>
          )}
        </div>

        {/* Confirm Password */}
        <div className="form-group">
          <label className="form-label">Confirm Password</label>
          <Input.Password
            value={passwordForm.confirm}
            onChange={e => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
            placeholder="Re-enter your password"
            size="large"
            prefix={<Lock size={16} color="#94a3b8" />}
            iconRender={visible => visible ? <Eye size={16} /> : <EyeOff size={16} />}
            className="form-input"
          />
          {passwordForm.confirm && passwordForm.newPw !== passwordForm.confirm && (
            <div className="form-error">
              <AlertTriangle size={12} />
              <span>Passwords do not match</span>
            </div>
          )}
        </div>

        {/* Password Requirements */}
        <div className="requirements-box">
          <div className="requirements-header">
            <Info size={14} color="#64748b" />
            <Text style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
              Password Requirements
            </Text>
          </div>
          <div className="requirements-list">
            {pwRequirements.map((req, i) => (
              <div
                key={i}
                className={`requirement-item ${req.met ? 'met' : ''}`}
              >
                {req.met ? (
                  <Check size={12} color="#10b981" strokeWidth={3} />
                ) : (
                  <div className="requirement-dot" />
                )}
                <span>{req.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderPolicies = () => (
    <div className="step-content policies-step">
      <div className="step-header">
        <div className="step-icon-bg policies-icon-bg">
          <FileCheck size={28} strokeWidth={2} color="#4f46e5" />
        </div>
        <Title level={3} className="step-title">Terms & Policies</Title>
        <Text className="step-description">
          Please review and accept our policies to continue
        </Text>
      </div>

      {error && (
        <Alert
          message={error}
          type="error"
          showIcon
          closable
          onClose={() => setError('')}
          style={{ marginBottom: 16, borderRadius: 10 }}
        />
      )}

      <div className="policies-list">
        {[
          {
            key: 'tos',
            title: 'Terms of Service',
            desc: 'I have read and agree to the Terms of Service',
            link: '/terms'
          },
          {
            key: 'privacy',
            title: 'Privacy Policy',
            desc: 'I accept the Privacy Policy and data handling practices',
            link: '/privacy'
          },
          {
            key: 'responsibilities',
            title: 'User Responsibilities',
            desc: 'I understand my responsibilities as an authorized user',
            link: null
          }
        ].map((policy, i) => (
          <motion.div
            key={policy.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`policy-card ${policies[policy.key] ? 'accepted' : ''}`}
            onClick={() => setPolicies({ ...policies, [policy.key]: !policies[policy.key] })}
          >
            <div className="policy-checkbox">
              {policies[policy.key] ? (
                <div className="check-icon">
                  <Check size={14} color="white" strokeWidth={3} />
                </div>
              ) : (
                <div className="empty-check" />
              )}
            </div>
            <div className="policy-content">
              <div className="policy-title">{policy.title}</div>
              <div className="policy-desc">{policy.desc}</div>
              {policy.link && (
                <a
                  href={policy.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="policy-link"
                >
                  Read full document
                  <ExternalLink size={11} />
                </a>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );

  const renderComplete = () => (
    <div className="step-content complete-step">
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="complete-icon-wrapper"
      >
        <div className="complete-icon-bg">
          <Check size={48} strokeWidth={3} color="white" />
        </div>
        <motion.div
          className="sparkle-1"
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Sparkles size={20} color="#fbbf24" />
        </motion.div>
        <motion.div
          className="sparkle-2"
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
        >
          <Sparkles size={16} color="#a78bfa" />
        </motion.div>
      </motion.div>

      <Title level={2} className="step-title">
        You're All Set, {fullName}!
      </Title>

      <Text className="step-description">
        Your account has been successfully configured. You can now access all features of RetailOps.
      </Text>

      <div className="completion-stats">
        {[
          { icon: Lock, label: 'Password Created' },
          { icon: Shield, label: 'Security Set' },
          { icon: FileCheck, label: 'Policies Accepted' }
        ].map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 + i * 0.1 }}
            className="stat-item"
          >
            <div className="stat-icon">
              <item.icon size={16} color="#10b981" />
            </div>
            <span>{item.label}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );

  const renderCurrentStep = () => {
    switch (steps[currentStep].id) {
      case 'welcome': return renderWelcome();
      case 'security': return renderSecurity();
      case 'password': return renderPassword();
      case 'policies': return renderPolicies();
      case 'complete': return renderComplete();
      default: return null;
    }
  };

  const isNextDisabled = () => {
    if (loading) return true;
    if (steps[currentStep].id === 'password') return !pwValid;
    if (steps[currentStep].id === 'policies') return !policiesValid;
    return false;
  };

  return (
    <>
      <style>{wizardStyles}</style>

      <div className="wizard-wrapper">
        {/* Header with Logo */}
        <div className="wizard-header">
          <div className="brand-logo">
            <img
              src="https://brandcentral.in/wp-content/uploads/2024/09/logo.png"
              alt="BrandCentral"
              className="logo-img"
            />
          </div>
          <div className="wizard-progress-text">
            Step {currentStep + 1} of {steps.length}
          </div>
        </div>

        {/* Full Page Content Panels */}
        <div className="wizard-card">
          {/* Sidebar - Steps */}
          <div className="wizard-sidebar">
            <div className="sidebar-header">
              <Title level={4} style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                Account Setup
              </Title>
              <Text style={{ fontSize: 12, color: '#64748b', display: 'block', marginTop: 4 }}>
                Complete all steps to continue
              </Text>
            </div>

            <div className="steps-list">
              {steps.map((step, idx) => {
                const StepIcon = step.icon;
                const isActive = idx === currentStep;
                const isCompleted = idx < currentStep;
                const isLast = idx === steps.length - 1;

                return (
                  <div key={step.id} className="step-item">
                    <div className="step-indicator">
                      <div
                        className={`step-circle ${isCompleted ? 'completed' :
                          isActive ? 'active' : 'pending'
                          }`}
                      >
                        {isCompleted ? (
                          <Check size={14} color="white" strokeWidth={3} />
                        ) : (
                          <StepIcon
                            size={14}
                            color={isActive ? 'white' : '#94a3b8'}
                          />
                        )}
                      </div>
                      {!isLast && (
                        <div
                          className={`step-line ${isCompleted ? 'completed' : ''
                            }`}
                        />
                      )}
                    </div>
                    <div className="step-info">
                      <div
                        className={`step-label ${isActive ? 'active' :
                          isCompleted ? 'completed' : ''
                          }`}
                      >
                        {step.title}
                      </div>
                      <div className="step-sublabel">
                        {step.subtitle}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="sidebar-footer">
              <div className="help-card">
                <Info size={14} color="#4f46e5" />
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#0f172a' }}>
                    Need help?
                  </div>
                  <a
                    href="mailto:support@brandcentral.in"
                    style={{ fontSize: 11, color: '#4f46e5' }}
                  >
                    Contact support
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="wizard-content">
            <div className="content-body">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  {...slideVariants}
                  className="step-wrapper"
                >
                  {renderCurrentStep()}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer with Actions */}
            <div className="content-footer">
              <div>
                {currentStep > 0 && currentStep < steps.length - 1 && (
                  <button
                    onClick={handleBack}
                    className="btn-back"
                    disabled={loading}
                  >
                    <ArrowLeft size={16} />
                    Back
                  </button>
                )}
              </div>

              <div className="footer-actions">
                {currentStep < steps.length - 1 ? (
                  <button
                    onClick={handleNextStep}
                    disabled={isNextDisabled()}
                    className={`btn-primary ${isNextDisabled() ? 'disabled' : ''}`}
                  >
                    {loading ? (
                      <>
                        <Loader2 size={16} className="spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        {currentStep === steps.length - 2 ? 'Complete Setup' : 'Continue'}
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleFinalComplete}
                    disabled={loading}
                    className="btn-success"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={16} className="spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <LayoutDashboard size={16} />
                        Go to Dashboard
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ============================================
// STYLES (CSS-in-JS) - FULL SCREEN WIZARD
// ============================================
const wizardStyles = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    
    * {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        box-sizing: border-box;
    }
    
    /* ===== FULL VIEWPORT WRAPPER ===== */
    .wizard-wrapper {
        width: 100vw;
        height: 100vh;
        min-height: 100vh;
        background: #ffffff;
        position: relative;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        padding: 0;
        margin: 0;
    }
    
    /* ===== TOP HEADER ===== */
    .wizard-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        height: 64px;
        min-height: 64px;
        max-height: 64px;
        border-bottom: 1px solid #e2e8f0;
        background: #ffffff;
        padding: 0 32px;
        z-index: 10;
    }
    
    .brand-logo {
        display: flex;
        align-items: center;
    }
    
    .logo-img {
        height: 32px;
        width: auto;
    }
    
    .wizard-progress-text {
        font-size: 12.5px;
        font-weight: 600;
        color: #64748b;
        background: #f1f5f9;
        padding: 6px 14px;
        border-radius: 20px;
    }
    
    /* ===== FULL VIEWPORT CONTENT CARD ===== */
    .wizard-card {
        background: white;
        display: flex;
        overflow: hidden;
        width: 100%;
        height: calc(100vh - 64px);
        min-height: 0;
        max-height: none;
        border-radius: 0;
        box-shadow: none;
    }
    
    /* ===== SIDEBAR ===== */
    .wizard-sidebar {
        width: 290px;
        min-width: 290px;
        background: linear-gradient(180deg, #fafbfc 0%, #f8fafc 100%);
        border-right: 1px solid #e2e8f0;
        padding: 40px 32px;
        display: flex;
        flex-direction: column;
        flex-shrink: 0;
        overflow-y: auto;
    }
    
    .sidebar-header {
        margin-bottom: 32px;
        padding-bottom: 20px;
        border-bottom: 1px solid #e2e8f0;
    }
    
    .steps-list {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
    }
    
    .step-item {
        display: flex;
        gap: 14px;
        position: relative;
    }
    
    .step-indicator {
        display: flex;
        flex-direction: column;
        align-items: center;
    }
    
    .step-circle {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        flex-shrink: 0;
        position: relative;
        z-index: 1;
    }
    
    .step-circle.pending {
        background: white;
        border: 2px solid #e2e8f0;
    }
    
    .step-circle.active {
        background: #4f46e5;
        border: 2px solid #4f46e5;
        box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.12);
    }
    
    .step-circle.completed {
        background: #10b981;
        border: 2px solid #10b981;
    }
    
    .step-line {
        width: 2px;
        flex-grow: 1;
        background: #e2e8f0;
        margin: 4px 0;
        min-height: 36px;
        transition: background 0.3s;
    }
    
    .step-line.completed {
        background: #10b981;
    }
    
    .step-info {
        padding-bottom: 24px;
        flex-grow: 1;
    }
    
    .step-label {
        font-size: 14px;
        font-weight: 600;
        color: #94a3b8;
        margin-bottom: 2px;
        transition: color 0.3s;
    }
    
    .step-label.active {
        color: #0f172a;
        font-weight: 700;
    }
    
    .step-label.completed {
        color: #475569;
    }
    
    .step-sublabel {
        font-size: 12px;
        color: #94a3b8;
    }
    
    .sidebar-footer {
        margin-top: auto;
        padding-top: 20px;
        border-top: 1px solid #e2e8f0;
    }
    
    .help-card {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px;
        background: white;
        border-radius: 10px;
        border: 1px solid #e0e7ff;
    }
    
    /* ===== CONTENT AREA ===== */
    .wizard-content {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
        background: #ffffff;
    }
    
    .content-body {
        flex-grow: 1;
        padding: 64px 80px;
        overflow-y: auto;
        display: flex;
        align-items: center;
        scrollbar-width: thin;
        scrollbar-color: #cbd5e1 transparent;
    }
    
    .content-body::-webkit-scrollbar {
        width: 6px;
    }
    
    .content-body::-webkit-scrollbar-track {
        background: transparent;
    }
    
    .content-body::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 3px;
    }
    
    .content-body::-webkit-scrollbar-thumb:hover {
        background: #94a3b8;
    }
    
    .step-wrapper {
        width: 100%;
    }
    
    .content-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 24px 80px;
        border-top: 1px solid #f1f5f9;
        background: #fafbfc;
        flex-shrink: 0;
        height: 88px;
    }
    
    /* ===== STEP CONTENT ===== */
    .step-content {
        max-width: 580px;
        margin: 0 auto;
        width: 100%;
        padding: 10px 0;
    }
    
    .step-icon-wrapper {
        text-align: center;
        margin-bottom: 24px;
    }
    
    .step-icon-bg {
        width: 64px;
        height: 64px;
        border-radius: 20px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }
    
    .welcome-icon-bg, .security-icon-bg, .password-icon-bg, .policies-icon-bg {
        background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
        box-shadow: 0 4px 12px rgba(79, 70, 229, 0.12);
    }
    
    .step-header {
        text-align: center;
        margin-bottom: 28px;
    }
    
    .step-title {
        margin: 0 0 8px !important;
        color: #0f172a !important;
        font-size: 26px !important;
        font-weight: 800 !important;
        letter-spacing: -0.025em !important;
        line-height: 1.25 !important;
    }
    
    .step-description {
        font-size: 14.5px;
        color: #64748b;
        line-height: 1.5;
        display: block;
        text-align: center;
    }
    
    /* ===== WELCOME STEP ===== */
    .welcome-step {
        text-align: center;
    }
    
    .welcome-features {
        margin-top: 32px;
        display: flex;
        flex-direction: column;
        gap: 12px;
    }
    
    .welcome-feature-item {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px 20px;
        background: #f8fafc;
        border: 1px solid #f1f5f9;
        border-radius: 12px;
        transition: all 0.2s;
        text-align: left;
    }
    
    .welcome-feature-item:hover {
        background: #f1f5f9;
        border-color: #e2e8f0;
        transform: translateX(2px);
    }
    
    .feature-icon {
        width: 40px;
        height: 40px;
        border-radius: 10px;
        background: white;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        box-shadow: 0 2px 4px rgba(0,0,0,0.04);
    }
    
    .feature-text {
        flex-grow: 1;
    }
    
    .feature-title {
        font-size: 14px;
        font-weight: 600;
        color: #0f172a;
        margin-bottom: 2px;
    }
    
    .feature-desc {
        font-size: 12.5px;
        color: #64748b;
        line-height: 1.4;
    }
    
    /* ===== SECURITY STEP ===== */
    .security-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin-top: 8px;
    }
    
    .security-tip-card {
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 18px;
        transition: all 0.2s;
        cursor: default;
    }
    
    .security-tip-card:hover {
        border-color: #c7d2fe;
        box-shadow: 0 4px 12px rgba(79, 70, 229, 0.08);
        transform: translateY(-2px);
    }
    
    .tip-icon {
        width: 40px;
        height: 40px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 12px;
    }
    
    .tip-content {
        flex-grow: 1;
    }
    
    .tip-title {
        font-size: 14px;
        font-weight: 600;
        color: #0f172a;
        margin-bottom: 4px;
    }
    
    .tip-desc {
        font-size: 12px;
        color: #64748b;
        line-height: 1.4;
    }
    
    /* ===== PASSWORD STEP ===== */
    .form-container {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }
    
    .form-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    
    .form-label {
        font-size: 13px;
        font-weight: 600;
        color: #334155;
    }
    
    .form-input {
        border-radius: 10px !important;
    }
    
    .form-input input {
        font-size: 14px !important;
    }
    
    .form-error {
        display: flex;
        align-items: center;
        gap: 6px;
        color: #ef4444;
        font-size: 12px;
        margin-top: 4px;
        font-weight: 500;
    }
    
    .strength-meter {
        margin-top: 8px;
        padding: 12px;
        background: #f8fafc;
        border-radius: 10px;
        border: 1px solid #f1f5f9;
    }
    
    .strength-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 6px;
    }
    
    .requirements-box {
        margin-top: 16px;
        padding: 16px;
        background: #f8fafc;
        border-radius: 12px;
        border: 1px solid #e2e8f0;
    }
    
    .requirements-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid #e2e8f0;
    }
    
    .requirements-list {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
    }
    
    .requirement-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: #94a3b8;
        transition: color 0.2s;
    }
    
    .requirement-item.met {
        color: #10b981;
        font-weight: 500;
    }
    
    .requirement-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #cbd5e1;
    }
    
    /* ===== POLICIES STEP ===== */
    .policies-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }
    
    .policy-card {
        display: flex;
        gap: 16px;
        padding: 18px 20px;
        border: 1px solid #e2e8f0;
        border-radius: 14px;
        cursor: pointer;
        transition: all 0.2s;
        background: white;
    }
    
    .policy-card:hover {
        border-color: #cbd5e1;
        transform: translateY(-1px);
    }
    
    .policy-card.accepted {
        border-color: #a7f3d0;
        background: #f0fdf4;
    }
    
    .policy-checkbox {
        flex-shrink: 0;
        margin-top: 2px;
    }
    
    .empty-check {
        width: 20px;
        height: 20px;
        border-radius: 6px;
        border: 2px solid #cbd5e1;
        background: white;
        transition: all 0.2s;
    }
    
    .policy-card:hover .empty-check {
        border-color: #94a3b8;
    }
    
    .check-icon {
        width: 20px;
        height: 20px;
        border-radius: 6px;
        background: #10b981;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
    }
    
    .policy-content {
        flex-grow: 1;
    }
    
    .policy-title {
        font-size: 14px;
        font-weight: 600;
        color: #0f172a;
        margin-bottom: 2px;
    }
    
    .policy-desc {
        font-size: 12.5px;
        color: #64748b;
        line-height: 1.4;
        margin-bottom: 8px;
    }
    
    .policy-link {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        color: #4f46e5;
        font-weight: 600;
        text-decoration: none;
    }
    
    .policy-link:hover {
        color: #4338ca;
        text-decoration: underline;
    }
    
    /* ===== COMPLETE STEP ===== */
    .complete-step {
        text-align: center;
    }
    
    .complete-icon-wrapper {
        position: relative;
        display: inline-block;
        margin-bottom: 24px;
    }
    
    .complete-icon-bg {
        width: 80px;
        height: 80px;
        border-radius: 28px;
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 10px 20px rgba(16, 185, 129, 0.25);
    }
    
    .sparkle-1 {
        position: absolute;
        top: -8px;
        right: -8px;
    }
    
    .sparkle-2 {
        position: absolute;
        bottom: 0;
        left: -16px;
    }
    
    .completion-stats {
        display: flex;
        justify-content: center;
        gap: 12px;
        margin-top: 28px;
        flex-wrap: wrap;
    }
    
    .stat-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 16px;
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        border-radius: 24px;
        font-size: 13px;
        font-weight: 500;
        color: #047857;
    }
    
    .stat-icon {
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    /* ===== BUTTONS ===== */
    .btn-back {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 18px;
        background: transparent;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 550;
        color: #64748b;
        cursor: pointer;
        transition: all 0.2s;
    }
    
    .btn-back:hover:not(:disabled) {
        background: #f8fafc;
        border-color: #cbd5e1;
        color: #334155;
    }
    
    .btn-back:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    
    .footer-actions {
        display: flex;
        gap: 12px;
    }
    
    .btn-primary {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 26px;
        background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
        color: white;
        border: none;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        box-shadow: 0 2px 4px rgba(79, 70, 229, 0.2);
    }
    
    .btn-primary:hover:not(.disabled) {
        background: linear-gradient(135deg, #4338ca 0%, #3730a3 100%);
        box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
        transform: translateY(-1px);
    }
    
    .btn-primary.disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    
    .btn-success {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 28px;
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
        border: none;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
    }
    
    .btn-success:hover:not(:disabled) {
        background: linear-gradient(135deg, #059669 0%, #047857 100%);
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        transform: translateY(-1px);
    }
    
    .spin {
        animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
    
    /* ===== RESPONSIVE ===== */
    @media (max-width: 768px) {
        .wizard-wrapper {
            height: auto;
            min-height: 100vh;
            overflow-y: auto;
        }
        
        .wizard-card {
            flex-direction: column;
            height: auto;
            min-height: calc(100vh - 64px);
        }
        
        .wizard-sidebar {
            width: 100%;
            min-width: 100%;
            border-right: none;
            border-bottom: 1px solid #e2e8f0;
            padding: 24px;
            gap: 20px;
        }
        
        .sidebar-header {
            text-align: center;
            margin-bottom: 16px;
            padding-bottom: 12px;
        }
        
        .steps-list {
            flex-direction: row;
            justify-content: space-between;
            overflow-x: auto;
            padding-bottom: 8px;
            gap: 8px;
        }
        
        .step-item {
            flex-direction: column;
            align-items: center;
            min-width: 75px;
        }
        
        .step-info {
            text-align: center;
            padding-bottom: 0;
        }
        
        .step-line {
            display: none;
        }
        
        .step-label {
            font-size: 11.5px;
        }
        
        .step-sublabel {
            font-size: 10px;
            display: none;
        }
        
        .sidebar-footer {
            display: none;
        }
        
        .content-body {
            padding: 32px 24px;
            overflow-y: visible;
        }
        
        .content-footer {
            padding: 20px 24px;
            position: sticky;
            bottom: 0;
            z-index: 10;
        }
        
        .security-grid {
            grid-template-columns: 1fr;
        }
        
        .requirements-list {
            grid-template-columns: 1fr;
        }
        
        .completion-stats {
            flex-direction: column;
            align-items: center;
        }
    }
    
    @media (max-width: 480px) {
        .step-title {
            font-size: 21px !important;
        }
        
        .step-description {
            font-size: 13px;
        }
    }
`;

export default SetupWizardPage;