import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, ShoppingCart, BarChart3, Settings, Zap, ArrowRight, ArrowLeft, Check, X } from 'lucide-react';
import api, { sellerApi, asinApi } from '../../services/api';
import { useOnboarding } from '../../contexts/OnboardingContext';

const OnboardingWizard = () => {
    const navigate = useNavigate();
    const { skipOnboarding, completeOnboarding } = useOnboarding();
    const [currentStep, setCurrentStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    // Form data
    const [sellerData, setSellerData] = useState({
        name: '',
        marketplace: 'amazon.in',
        sellerId: ''
    });
    const [asinText, setAsinText] = useState('');
    const [createdSeller, setCreatedSeller] = useState(null);

    // Keyboard handling
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Enter' && currentStep !== 1) {
                e.preventDefault();
                // Don't advance on Enter for steps 2-4
            }
            if (e.key === 'Escape' && currentStep === 1) {
                skipOnboarding();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentStep, skipOnboarding]);

    // Step 2: Create seller
    const handleCreateSeller = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');

        try {
            const response = await sellerApi.create(sellerData);
            const seller = response.data || response;
            setCreatedSeller(seller);
            setCurrentStep(3);
        } catch (err) {
            setError(err.message || 'Failed to create seller');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Step 3: Add ASINs
    const handleAddAsins = async () => {
        if (!asinText.trim() || !createdSeller) {
            // Skip if no ASINs entered
            setCurrentStep(4);
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            // Parse ASINs
            const asinList = asinText
                .split(/[\n,]/)
                .map(a => a.trim().toUpperCase())
                .filter(a => a.length > 0);

            if (asinList.length > 0) {
                const asinsPayload = asinList.map(code => ({
                    asinCode: code,
                    seller: createdSeller._id,
                    status: 'Active'
                }));
                await asinApi.createBulk(asinsPayload);
            }
            setCurrentStep(4);
        } catch (err) {
            setError(err.message || 'Failed to add ASINs');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Step 4: Action card handlers
    const handleGoToDashboard = () => {
        completeOnboarding();
        navigate('/');
    };

    const handleGoToSettings = () => {
        completeOnboarding();
        navigate('/settings');
    };

    const handleGoToAnalytics = () => {
        completeOnboarding();
        navigate('/analytics');
    };

    // Progress percentage
    const progress = (currentStep / 4) * 100;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(17, 24, 39, 0.8)',
            backdropFilter: 'blur(8px)',
            zIndex: 'var(--z-modal, 500)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
        }}>
            <div style={{
                backgroundColor: 'var(--color-surface-0, #fff)',
                borderRadius: 'var(--radius-xl, 16px)',
                maxWidth: '580px',
                width: '100%',
                maxHeight: '90vh',
                overflow: 'auto',
                boxShadow: 'var(--shadow-xl)',
                padding: '32px'
            }}>
                {/* Step Indicator */}
                <div style={{ marginBottom: '24px' }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        gap: '8px',
                        marginBottom: '12px'
                    }}>
                        {[1, 2, 3, 4].map(step => (
                            <div
                                key={step}
                                style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    backgroundColor: step === currentStep
                                        ? 'var(--color-brand-600)'
                                        : step < currentStep
                                            ? 'var(--color-success-500)'
                                            : 'var(--color-surface-2)',
                                    color: step <= currentStep ? '#fff' : 'var(--color-text-muted)',
                                    transition: 'all 200ms'
                                }}
                            >
                                {step < currentStep ? <Check size={16} /> : step}
                            </div>
                        ))}
                    </div>
                    <div style={{
                        height: '4px',
                        backgroundColor: 'var(--color-surface-2)',
                        borderRadius: '2px',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            height: '100%',
                            width: `${progress}%`,
                            backgroundColor: 'var(--color-brand-600)',
                            transition: 'width 300ms ease'
                        }} />
                    </div>
                </div>

                {/* Step Content */}
                {currentStep === 1 && (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--color-brand-50)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 24px'
                        }}>
                            <Zap size={32} style={{ color: 'var(--color-brand-600)' }} />
                        </div>
                        <h2 style={{
                            fontSize: '24px',
                            fontWeight: 700,
                            color: 'var(--color-text-primary)',
                            marginBottom: '12px'
                        }}>
                            Welcome to RetailOps
                        </h2>
                        <h3 style={{
                            fontSize: '18px',
                            fontWeight: 600,
                            color: 'var(--color-text-primary)',
                            marginBottom: '16px'
                        }}>
                            Let's set up your first seller account
                        </h3>
                        <p style={{
                            fontSize: '14px',
                            color: 'var(--color-text-secondary)',
                            lineHeight: 1.6,
                            marginBottom: '32px'
                        }}>
                            RetailOps helps you manage your Amazon seller business efficiently.
                            Track inventory, monitor performance, and automate operations all in one place.
                        </p>
                        <button
                            onClick={() => setCurrentStep(2)}
                            className="btn btn-primary px-4 py-2 d-flex align-items-center gap-2"
                            style={{
                                fontWeight: 600,
                                margin: '0 auto',
                                fontSize: '15px'
                            }}
                        >
                            Get Started
                            <ArrowRight size={18} />
                        </button>
                    </div>
                )}

                {currentStep === 2 && (
                    <div>
                        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '50%',
                                backgroundColor: 'var(--color-brand-50)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 16px'
                            }}>
                                <Store size={24} style={{ color: 'var(--color-brand-600)' }} />
                            </div>
                            <h2 style={{
                                fontSize: '20px',
                                fontWeight: 700,
                                color: 'var(--color-text-primary)',
                                marginBottom: '8px'
                            }}>
                                Add Your First Seller
                            </h2>
                        </div>

                        <form onSubmit={handleCreateSeller}>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    color: 'var(--color-text-muted)',
                                    marginBottom: '8px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                }}>
                                    Seller Store Name
                                </label>
                                <input
                                    type="text"
                                    value={sellerData.name}
                                    onChange={(e) => setSellerData({ ...sellerData, name: e.target.value })}
                                    placeholder="e.g. Retail King"
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--color-border)',
                                        fontSize: '15px',
                                        backgroundColor: 'var(--color-surface-0)'
                                    }}
                                />
                            </div>

                            <div className="row">
                                <div className="col-md-6" style={{ marginBottom: '20px' }}>
                                    <label style={{
                                        display: 'block',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        color: 'var(--color-text-muted)',
                                        marginBottom: '8px',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em'
                                    }}>
                                        Marketplace
                                    </label>
                                    <select
                                        value={sellerData.marketplace}
                                        disabled={true}
                                        style={{
                                            width: '100%',
                                            padding: '12px 16px',
                                            borderRadius: 'var(--radius-md)',
                                            border: '1px solid var(--color-border)',
                                            fontSize: '14px',
                                            backgroundColor: 'var(--color-surface-1)',
                                            cursor: 'not-allowed'
                                        }}
                                    >
                                        <option value="amazon.in">Amazon India (IN)</option>
                                    </select>
                                </div>
                                <div className="col-md-6" style={{ marginBottom: '20px' }}>
                                    <label style={{
                                        display: 'block',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        color: 'var(--color-text-muted)',
                                        marginBottom: '8px',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em'
                                    }}>
                                        Seller ID
                                    </label>
                                    <input
                                        type="text"
                                        value={sellerData.sellerId}
                                        onChange={(e) => setSellerData({ ...sellerData, sellerId: e.target.value })}
                                        placeholder="AXXXXXXXXXXXXX"
                                        style={{
                                            width: '100%',
                                            padding: '12px 16px',
                                            borderRadius: 'var(--radius-md)',
                                            border: '1px solid var(--color-border)',
                                            fontSize: '14px',
                                            backgroundColor: 'var(--color-surface-0)'
                                        }}
                                    />
                                </div>
                            </div>

                            {error && (
                                <div style={{
                                    padding: '12px',
                                    backgroundColor: 'var(--color-danger-50)',
                                    borderRadius: 'var(--radius-md)',
                                    color: 'var(--color-danger-600)',
                                    fontSize: '13px',
                                    marginBottom: '16px'
                                }}>
                                    {error}
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <button
                                    type="button"
                                    onClick={skipOnboarding}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--color-text-muted)',
                                        fontSize: '14px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    I'll do this later
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="btn btn-primary px-4 py-2 d-flex align-items-center gap-2"
                                    style={{ fontWeight: 600 }}
                                >
                                    {isSubmitting ? 'Creating...' : 'Continue'}
                                    <ArrowRight size={18} />
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {currentStep === 3 && (
                    <div>
                        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '50%',
                                backgroundColor: 'var(--color-brand-50)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 16px'
                            }}>
                                <ShoppingCart size={24} style={{ color: 'var(--color-brand-600)' }} />
                            </div>
                            <h2 style={{
                                fontSize: '20px',
                                fontWeight: 700,
                                color: 'var(--color-text-primary)',
                                marginBottom: '8px'
                            }}>
                                Add Your First ASINs
                            </h2>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{
                                display: 'block',
                                fontSize: '13px',
                                fontWeight: 600,
                                color: 'var(--color-text-muted)',
                                marginBottom: '8px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                            }}>
                                Enter Amazon ASINs
                            </label>
                            <textarea
                                value={asinText}
                                onChange={(e) => setAsinText(e.target.value)}
                                placeholder="B08N5WRWNW&#10;B07YTF92SZ&#10;B08JH8CSHH"
                                rows={6}
                                style={{
                                    width: '100%',
                                    padding: '12px 16px',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--color-border)',
                                    fontSize: '14px',
                                    fontFamily: 'monospace',
                                    backgroundColor: 'var(--color-surface-0)',
                                    resize: 'vertical'
                                }}
                            />
                            <p style={{
                                fontSize: '12px',
                                color: 'var(--color-text-muted)',
                                marginTop: '8px'
                            }}>
                                Enter Amazon ASINs, one per line or comma-separated
                            </p>
                        </div>

                        {error && (
                            <div style={{
                                padding: '12px',
                                backgroundColor: 'var(--color-danger-50)',
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--color-danger-600)',
                                fontSize: '13px',
                                marginBottom: '16px'
                            }}>
                                {error}
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <button
                                type="button"
                                onClick={() => setCurrentStep(4)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--color-text-muted)',
                                    fontSize: '14px',
                                    cursor: 'pointer'
                                }}
                            >
                                Skip for now
                            </button>
                            <button
                                type="button"
                                onClick={handleAddAsins}
                                disabled={isSubmitting}
                                className="btn btn-primary px-4 py-2 d-flex align-items-center gap-2"
                                style={{ fontWeight: 600 }}
                            >
                                {isSubmitting ? 'Adding...' : 'Continue'}
                                <ArrowRight size={18} />
                            </button>
                        </div>
                    </div>
                )}

                {currentStep === 4 && (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--color-success-500)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 24px'
                        }}>
                            <Check size={32} style={{ color: '#fff' }} />
                        </div>
                        <h2 style={{
                            fontSize: '24px',
                            fontWeight: 700,
                            color: 'var(--color-text-primary)',
                            marginBottom: '8px'
                        }}>
                            You're all set!
                        </h2>
                        <p style={{
                            fontSize: '14px',
                            color: 'var(--color-text-secondary)',
                            marginBottom: '32px'
                        }}>
                            {createdSeller && `Created seller: ${createdSeller.name}`}
                            {asinText.trim() && asinText.split(/[\n,]/).filter(a => a.trim()).length > 0
                                && ` with ${asinText.split(/[\n,]/).filter(a => a.trim()).length} ASINs`}
                        </p>

                        <div className="row g-3">
                            <div className="col-4">
                                <button
                                    onClick={handleGoToDashboard}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '16px',
                                        width: '100%',
                                        borderRadius: 'var(--radius-lg)',
                                        border: '1px solid var(--color-border)',
                                        backgroundColor: 'var(--color-surface-0)',
                                        cursor: 'pointer',
                                        transition: 'all 150ms'
                                    }}
                                    onMouseOver={(e) => {
                                        e.currentTarget.style.borderColor = 'var(--color-brand-600)';
                                        e.currentTarget.style.backgroundColor = 'var(--color-brand-50)';
                                    }}
                                    onMouseOut={(e) => {
                                        e.currentTarget.style.borderColor = 'var(--color-border)';
                                        e.currentTarget.style.backgroundColor = 'var(--color-surface-0)';
                                    }}
                                >
                                    <BarChart3 size={24} style={{ color: 'var(--color-brand-600)' }} />
                                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                                        Dashboard
                                    </span>
                                </button>
                            </div>
                            <div className="col-4">
                                <button
                                    onClick={handleGoToSettings}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '16px',
                                        width: '100%',
                                        borderRadius: 'var(--radius-lg)',
                                        border: '1px solid var(--color-border)',
                                        backgroundColor: 'var(--color-surface-0)',
                                        cursor: 'pointer',
                                        transition: 'all 150ms'
                                    }}
                                    onMouseOver={(e) => {
                                        e.currentTarget.style.borderColor = 'var(--color-brand-600)';
                                        e.currentTarget.style.backgroundColor = 'var(--color-brand-50)';
                                    }}
                                    onMouseOut={(e) => {
                                        e.currentTarget.style.borderColor = 'var(--color-border)';
                                        e.currentTarget.style.backgroundColor = 'var(--color-surface-0)';
                                    }}
                                >
                                    <Settings size={24} style={{ color: 'var(--color-brand-600)' }} />
                                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                                        Configure
                                    </span>
                                </button>
                            </div>
                            <div className="col-4">
                                <button
                                    onClick={handleGoToAnalytics}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '16px',
                                        width: '100%',
                                        borderRadius: 'var(--radius-lg)',
                                        border: '1px solid var(--color-border)',
                                        backgroundColor: 'var(--color-surface-0)',
                                        cursor: 'pointer',
                                        transition: 'all 150ms'
                                    }}
                                    onMouseOver={(e) => {
                                        e.currentTarget.style.borderColor = 'var(--color-brand-600)';
                                        e.currentTarget.style.backgroundColor = 'var(--color-brand-50)';
                                    }}
                                    onMouseOut={(e) => {
                                        e.currentTarget.style.borderColor = 'var(--color-border)';
                                        e.currentTarget.style.backgroundColor = 'var(--color-surface-0)';
                                    }}
                                >
                                    <BarChart3 size={24} style={{ color: 'var(--color-brand-600)' }} />
                                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                                        Analytics
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OnboardingWizard;
