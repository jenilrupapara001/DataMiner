import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { sellerApi, asinApi } from '../services/api';

const OnboardingContext = createContext(null);

const STORAGE_KEY = 'retailops_onboarding_complete';

export const OnboardingProvider = ({ children }) => {
    const [isComplete, setIsComplete] = useState(false);
    const [showWizard, setShowWizard] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Check if onboarding should be shown
    useEffect(() => {
        const checkOnboarding = async () => {
            try {
                // Check localStorage first
                const stored = localStorage.getItem(STORAGE_KEY);
                if (stored === 'true') {
                    setIsComplete(true);
                    setIsLoading(false);
                    return;
                }

                // Check if user is admin
                const userResponse = await api.authApi.getCurrentUser();
                const user = userResponse?.data || userResponse;

                if (!user || user.role !== 'admin') {
                    setIsComplete(true); // Non-admins don't need onboarding
                    setIsLoading(false);
                    return;
                }

                // Check if there are any sellers and ASINs
                const sellersResponse = await sellerApi.getAll();
                const sellers = sellersResponse.data || sellersResponse || [];

                let asinCount = 0;
                if (sellers.length > 0) {
                    const asinsResponse = await asinApi.getAll();
                    const asins = asinsResponse.data || asinsResponse || [];
                    asinCount = asins.length;
                }

                // Show wizard if admin with 0 sellers AND 0 ASINs
                if (sellers.length === 0 && asinCount === 0) {
                    setShowWizard(true);
                } else {
                    setIsComplete(true);
                    localStorage.setItem(STORAGE_KEY, 'true');
                }
            } catch (error) {
                console.error('Error checking onboarding status:', error);
                setIsComplete(true); // Skip on error
            } finally {
                setIsLoading(false);
            }
        };

        checkOnboarding();
    }, []);

    const completeOnboarding = useCallback(() => {
        setIsComplete(true);
        setShowWizard(false);
        localStorage.setItem(STORAGE_KEY, 'true');
    }, []);

    const skipOnboarding = useCallback(() => {
        setIsComplete(true);
        setShowWizard(false);
        localStorage.setItem(STORAGE_KEY, 'true');
    }, []);

    const resetOnboarding = useCallback(() => {
        localStorage.removeItem(STORAGE_KEY);
        setIsComplete(false);
        setShowWizard(true);
    }, []);

    return (
        <OnboardingContext.Provider value={{
            isComplete,
            showWizard,
            isLoading,
            completeOnboarding,
            skipOnboarding,
            resetOnboarding
        }}>
            {children}
        </OnboardingContext.Provider>
    );
};

export const useOnboarding = () => {
    const context = useContext(OnboardingContext);
    if (!context) {
        throw new Error('useOnboarding must be used within an OnboardingProvider');
    }
    return context;
};

export default OnboardingContext;
