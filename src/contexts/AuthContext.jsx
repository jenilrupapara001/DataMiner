import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Check for existing token on mount
    useEffect(() => {
        const initAuth = async () => {
            const token = localStorage.getItem('authToken');
            if (token) {
                try {
                    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/auth/me`, {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });

                    if (response.ok) {
                        const result = await response.json();
                        if (result.success && result.data) {
                            setUser(result.data);
                            localStorage.setItem('user', JSON.stringify(result.data));
                        } else {
                            throw new Error('Invalid user data');
                        }
                    } else {
                        throw new Error('Session expired');
                    }
                } catch (err) {
                    console.warn('Auth initialization warning:', err.message);
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('user');
                    setUser(null);
                }
            } else {
                setUser(null);
            }
            // Ensure loading is only set to false AFTER we've attempted re-hydration
            setLoading(false);
        };

        initAuth();
    }, []);

    const login = async (email, password) => {
        try {
            setError(null);
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Login failed');
            }

            const { user, accessToken } = result.data;
            localStorage.setItem('authToken', accessToken);
            localStorage.setItem('user', JSON.stringify(user));
            setUser(user);
            return { success: true };
        } catch (err) {
            setError(err.message);
            return { success: false, error: err.message };
        }
    };

    const register = async (userData) => {
        try {
            setError(null);
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Registration failed');
            }

            const { user, accessToken } = result.data;
            localStorage.setItem('authToken', accessToken);
            localStorage.setItem('user', JSON.stringify(user));
            setUser(user);
            return { success: true };
        } catch (err) {
            setError(err.message);
            return { success: false, error: err.message };
        }
    };

    const logout = () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        setUser(null);
        setError(null);
        // Navigate to login page
        if (window.location.pathname !== '/login') {
            window.location.href = '/login';
        }
    };

    const refreshUser = (updatedUser) => {
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
    };

    const hasPermission = (permissionName) => {
        if (!user || !user.role) return false;
        
        // Super Admin always has full access
        if (user.role.name === 'admin') return true;

        // Operational Manager has global access EXCEPT delete
        if (user.role.name === 'operational_manager') {
            if (permissionName.toLowerCase().includes('delete')) return false;
            return true;
        }

        // Standard dynamic permission check
        if (!user.role.permissions) return false;
        return user.role.permissions.some(p => p.name === permissionName);
    };

    const hasAnyPermission = (permissionNames) => {
        if (!user || !user.role) return false;
        if (user.role.name === 'admin') return true;
        
        return permissionNames.some(name => hasPermission(name));
    };

    const value = {
        user,
        loading,
        error,
        login,
        register,
        logout,
        refreshUser,
        hasPermission,
        hasAnyPermission,
        isAuthenticated: !!user,
        isAdmin: user?.role?.name === 'admin',
        isOperationalManager: user?.role?.name === 'operational_manager',
        isGlobalUser: user?.role?.name === 'admin' || user?.role?.name === 'operational_manager'
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
