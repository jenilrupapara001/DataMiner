import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/Auth.css';
import { 
    Mail, 
    Lock, 
    Eye, 
    EyeOff, 
    Shield, 
    BarChart3, 
    ShieldCheck,
    CheckCircle 
} from 'lucide-react';
import { RetailOpsWordmark } from '../components/common/BrandLogo';


const LoginPage = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        rememberMe: false
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = await login(formData.email.trim(), formData.password);

        if (result.success) {
            navigate('/');
        } else {
            setError(result.error || 'Login failed. Please try again.');
        }

        setLoading(false);
    };

    return (
        <div className="auth-container">
            {/* Left Panel - Branding & Features */}
            <div className="auth-left-panel">
                <div className="auth-left-content">
                    <div className="auth-branding-logo">
                        <RetailOpsWordmark size={36} />
                    </div>

                    <div className="auth-features">
                        <h1>Manage your<br />Empire with<br />Confidence.</h1>

                        <div className="feature-list">
                            <div className="feature-item">
                                <div className="feature-icon">
                                    <BarChart3 size={20} />
                                </div>
                                <div className="feature-text">
                                    <h3>Real-time Analytics</h3>
                                    <p>Track your sales and performance in real-time.</p>
                                </div>
                            </div>
                            <div className="feature-item">
                                <div className="feature-icon">
                                    <ShieldCheck size={20} />
                                </div>
                                <div className="feature-text">
                                    <h3>Secure Platform</h3>
                                    <p>Enterprise-grade security for your data.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="auth-left-footer">
                        &copy; 2026 RetailOps. All rights reserved.
                    </div>
                </div>
            </div>

            {/* Right Panel - Login Form */}
            <div className="auth-right-panel">
                <div className="auth-card">
                    <div className="auth-header">
                        <h1>Welcome Back</h1>
                        <p>Sign in to your dashboard</p>
                    </div>

                    {error && (
                        <div className="auth-error">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="12" y1="8" x2="12" y2="12"/>
                                <line x1="12" y1="16" x2="12.01" y2="16"/>
                            </svg>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="auth-form">
                        <div className="form-group">
                            <label htmlFor="email">Email Address</label>
                            <div className="input-wrapper">
                                <Mail />
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="admin@company.com"
                                    required
                                    autoComplete="email"
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="password">Password</label>
                            <div className="input-wrapper password-input">
                                <Lock />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    id="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder="Enter your password"
                                    required
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    className="password-toggle"
                                    onClick={() => setShowPassword(!showPassword)}
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <div className="form-options">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    name="rememberMe"
                                    checked={formData.rememberMe}
                                    onChange={handleChange}
                                />
                                <span>Remember me</span>
                            </label>
                            <a href="#" className="forgot-link">Forgot password?</a>
                        </div>

                        <button type="submit" className="auth-button" disabled={loading}>
                            {loading ? (
                                <>
                                    <span className="button-spinner"></span>
                                    Signing in...
                                </>
                            ) : (
                                'Sign in to dashboard'
                            )}
                        </button>
                    </form>

                    {/* Trust Signal */}
                    <div className="trust-signal">
                        <Shield size={14} />
                        <span>Secured by 256-bit SSL encryption</span>
                    </div>

                    <div className="auth-footer">
                        <p>Registration is currently disabled. Contact admin for credentials.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;