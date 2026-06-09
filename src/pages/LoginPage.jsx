import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Check } from 'lucide-react';
import { message } from 'antd';

const LoginPage = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    
    const [form, setForm] = useState({ email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [shake, setShake] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
        if (error) setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        
        try {
            const result = await login(form.email.trim(), form.password);
            if (result.success) {
                setSuccess(true);
                message.success('Welcome back!');
                setTimeout(() => window.location.href = '/', 800);
            } else {
                throw new Error(result.error || 'Login failed');
            }
        } catch (err) {
            let errorMsg = err.message || 'An unexpected error occurred';
            
            // Translate technical API errors into human-readable messages
            if (
                errorMsg.includes('Unexpected end of JSON input') || 
                errorMsg.includes('Failed to execute \'json\'') ||
                errorMsg.includes('Failed to fetch') ||
                errorMsg.includes('Network Error')
            ) {
                errorMsg = 'Unable to connect to the server. Please try again later.';
            }
            
            setError(errorMsg);
            setShake(true);
            setTimeout(() => setShake(false), 600);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ 
            minHeight: '100vh', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: '20px',
            backgroundColor: '#f8f9fa',
            fontFamily: "'Inter', sans-serif"
        }}>
            <style>{`
                .premium-input {
                    width: 100%;
                    padding: 12px 14px;
                    border-radius: 8px;
                    outline: none;
                    transition: all 0.2s ease;
                    background: #ffffff;
                    border: 1px solid #e5e5e5;
                    font-size: 14px;
                    color: #171717;
                    box-sizing: border-box;
                }
                .premium-input:focus {
                    border-color: #10b981;
                    box-shadow: 0 0 0 3px rgba(16,185,129,0.1);
                }
                .premium-input.error {
                    border-color: #ef4444;
                }
                .premium-input.error:focus {
                    box-shadow: 0 0 0 3px rgba(239,68,68,0.1);
                }
                .premium-input:-webkit-autofill {
                    -webkit-box-shadow: 0 0 0 30px white inset !important;
                }
                .premium-btn {
                    width: 100%;
                    padding: 12px 24px;
                    border-radius: 8px;
                    border: none;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    font-size: 14px;
                    font-weight: 500;
                    background: #171717;
                    color: #ffffff;
                    transition: opacity 0.2s ease;
                    position: relative;
                    overflow: hidden;
                }
                .premium-btn::after {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: -100%;
                    width: 50%;
                    height: 100%;
                    background: linear-gradient(to right, rgba(255,255,255,0), rgba(255,255,255,0.12), rgba(255,255,255,0));
                    transform: skewX(-20deg);
                    animation: shimmer 3s infinite;
                }
                @keyframes shimmer {
                    0% { left: -100%; }
                    20% { left: 200%; }
                    100% { left: 200%; }
                }
                .premium-btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
                .premium-btn.loading {
                    background: linear-gradient(90deg, #171717, #333333, #171717);
                    background-size: 200% 100%;
                    animation: gradient-shift 1.5s infinite linear;
                }
                .premium-btn.loading::after {
                    display: none;
                }
                @keyframes gradient-shift {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
                .premium-btn:hover:not(:disabled) {
                    opacity: 0.85;
                }
                .google-btn {
                    width: 100%;
                    padding: 12px 16px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    background: #ffffff;
                    border: 1px solid #e5e5e5;
                    color: #171717;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background 0.2s ease;
                }
                .google-btn:hover {
                    background: #f8f9fa;
                }
            `}</style>

            <div style={{ width: '100%', maxWidth: '400px', marginBottom: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <div style={{ padding: '10px', background: '#ffffff', borderRadius: '12px', border: '1px solid #e5e5e5', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#171717" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="3" y1="9" x2="21" y2="9"></line>
                        <line x1="9" y1="21" x2="9" y2="9"></line>
                    </svg>
                </div>
                <span style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '-0.5px', color: '#171717' }}>
                    RetailOps
                </span>
            </div>

            <motion.div
                style={{
                    width: '100%',
                    maxWidth: '400px',
                    padding: '32px',
                    background: '#ffffff',
                    border: '1px solid #e5e5e5',
                    borderRadius: '16px',
                    boxShadow: '0 8px 32px -8px rgba(0,0,0,0.06)',
                    boxSizing: 'border-box'
                }}
                initial={{ opacity: 0, y: 12 }}
                animate={shake 
                    ? { x: [0, -10, 10, -8, 8, -4, 4, 0], opacity: 1, y: 0 } 
                    : { opacity: 1, y: 0 }
                }
                transition={shake 
                    ? { duration: 0.5, ease: 'easeInOut' } 
                    : { duration: 0.4, ease: 'easeOut' }
                }
            >
                <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                    <h2 style={{ fontSize: '24px', fontWeight: 600, letterSpacing: '-0.6px', color: '#171717', margin: '0 0 6px 0' }}>
                        Welcome back
                    </h2>
                    <p style={{ fontSize: '14px', color: '#525252', margin: 0 }}>
                        Log in to your account
                    </p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                                animate={{ opacity: 1, height: 'auto', marginBottom: 4 }}
                                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                                style={{ overflow: 'hidden' }}
                            >
                                <div style={{ 
                                    padding: '10px 12px', 
                                    background: '#fef2f2', 
                                    border: '1px solid #fecaca', 
                                    borderRadius: '8px', 
                                    color: '#dc2626', 
                                    fontSize: '13px', 
                                    display: 'flex', 
                                    alignItems: 'flex-start', 
                                    gap: '8px',
                                    lineHeight: '1.4'
                                }}>
                                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '1px' }}>
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <line x1="12" y1="8" x2="12" y2="12"></line>
                                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                    </svg>
                                    <span style={{ fontWeight: 500 }}>{error}</span>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#171717', marginBottom: '6px' }}>
                            Email
                        </label>
                        <input
                            type="email"
                            name="email"
                            value={form.email}
                            onChange={handleChange}
                            placeholder="you@company.com"
                            required
                            className="premium-input"
                        />
                    </div>

                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <label style={{ fontSize: '13px', fontWeight: 500, color: '#171717', margin: 0 }}>
                                Password
                            </label>
                            <Link to="#" style={{ fontSize: '13px', color: '#a3a3a3', textDecoration: 'none' }} onMouseOver={e => e.target.style.color='#171717'} onMouseOut={e => e.target.style.color='#a3a3a3'}>
                                Forgot?
                            </Link>
                        </div>
                        <input
                            type="password"
                            name="password"
                            value={form.password}
                            onChange={handleChange}
                            placeholder="••••••••"
                            required
                            className={`premium-input ${error ? 'error' : ''}`}
                        />
                    </div>

                    <motion.button
                        type="submit"
                        disabled={loading}
                        className={`premium-btn ${loading ? 'loading' : ''}`}
                        style={{ marginTop: '8px' }}
                        whileTap={!loading ? { scale: 0.98 } : {}}
                    >
                        <AnimatePresence mode="wait">
                            {success ? (
                                <motion.span key="success" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
                                    <Check size={18} strokeWidth={3} />
                                </motion.span>
                            ) : loading ? (
                                <motion.span key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                    <Loader2 size={18} className="animate-spin" />
                                </motion.span>
                            ) : (
                                <motion.span key="text" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                    Log in
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </motion.button>
                </form>

                <div style={{ display: 'flex', alignItems: 'center', margin: '24px 0' }}>
                    <div style={{ flex: 1, height: '1px', background: '#e5e5e5' }}></div>
                    <span style={{ padding: '0 12px', fontSize: '12px', color: '#a3a3a3', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500 }}>or</span>
                    <div style={{ flex: 1, height: '1px', background: '#e5e5e5' }}></div>
                </div>

                <div>
                    <button type="button" className="google-btn">
                        <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
                            <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                                <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/>
                                <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/>
                                <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/>
                                <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/>
                            </g>
                        </svg>
                        Continue with Google
                    </button>
                </div>

                <p style={{ textAlign: 'center', marginTop: '28px', fontSize: '14px', color: '#525252', margin: '28px 0 0 0' }}>
                    Don't have an account?{' '}
                    <Link to="/register" style={{ color: '#10b981', fontWeight: 500, textDecoration: 'none' }} onMouseOver={e => e.target.style.opacity=0.8} onMouseOut={e => e.target.style.opacity=1}>
                        Sign up
                    </Link>
                </p>
            </motion.div>
        </div>
    );
};

export default LoginPage;