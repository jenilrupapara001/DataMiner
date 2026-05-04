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
                    const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/auth/me`, {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });

                    if (response.ok) {
                        const result = await response.json();
                        if (result.success && result.data) {
                            const normalizedUser = {
                                ...result.data,
                                firstName: result.data.firstName || result.data.FirstName,
                                lastName: result.data.lastName || result.data.LastName,
                                fullName: result.data.fullName || `${result.data.firstName || result.data.FirstName || ''} ${result.data.lastName || result.data.LastName || ''}`.trim(),
                                role: typeof result.data.role === 'object' ? {
                                    ...result.data.role,
                                    name: result.data.role.name || result.data.role.Name,
                                    displayName: result.data.role.displayName || result.data.role.DisplayName || result.data.role.Name
                                } : { name: result.data.role, displayName: result.data.role }
                            };
                            setUser(normalizedUser);
                            localStorage.setItem('user', JSON.stringify(normalizedUser));
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
            const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/auth/login`, {
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
            const normalizedUser = {
                ...user,
                firstName: user.firstName || user.FirstName,
                lastName: user.lastName || user.LastName,
                fullName: user.fullName || `${user.firstName || user.FirstName || ''} ${user.lastName || user.LastName || ''}`.trim(),
                role: typeof user.role === 'object' ? {
                    ...user.role,
                    name: user.role.name || user.role.Name,
                    displayName: user.role.displayName || user.role.DisplayName || user.role.Name
                } : { name: user.role, displayName: user.role }
            };
            localStorage.setItem('authToken', accessToken);
            localStorage.setItem('user', JSON.stringify(normalizedUser));
            setUser(normalizedUser);
            return { success: true };
        } catch (err) {
            setError(err.message);
            return { success: false, error: err.message };
        }
    };

    const register = async (userData) => {
        try {
            setError(null);
            const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/auth/register`, {
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
            const normalizedUser = {
                ...user,
                firstName: user.firstName || user.FirstName,
                lastName: user.lastName || user.LastName,
                fullName: user.fullName || `${user.firstName || user.FirstName || ''} ${user.lastName || user.LastName || ''}`.trim()
            };
            localStorage.setItem('authToken', accessToken);
            localStorage.setItem('user', JSON.stringify(normalizedUser));
            setUser(normalizedUser);
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
        const normalizedUser = {
            ...updatedUser,
            firstName: updatedUser.firstName || updatedUser.FirstName,
            lastName: updatedUser.lastName || updatedUser.LastName,
            fullName: updatedUser.fullName || `${updatedUser.firstName || updatedUser.FirstName || ''} ${updatedUser.lastName || updatedUser.LastName || ''}`.trim(),
            role: typeof updatedUser.role === 'object' ? {
                ...updatedUser.role,
                name: updatedUser.role.name || updatedUser.role.Name,
                displayName: updatedUser.role.displayName || updatedUser.role.DisplayName || updatedUser.role.Name
            } : { name: updatedUser.role, displayName: updatedUser.role }
        };
        setUser(normalizedUser);
        localStorage.setItem('user', JSON.stringify(normalizedUser));
    };

    const hasPermission = (permissionName) => {
        if (!user) return false;
        
        // 1. Super Admin always has full access
        const roleName = (user.role?.name || user.role || '').toString().toLowerCase();
        if (roleName === 'admin') return true;

        // 2. Operational Manager has global access EXCEPT delete
        if (roleName === 'operational_manager') {
            if (permissionName.toLowerCase().includes('delete')) return false;
            return true;
        }

        // 3. Resolved Dynamic Permissions (Role + Extra - Excluded)
        // This is provided by the backend as a flat list of names
        if (user.permissions && Array.isArray(user.permissions)) {
            return user.permissions.includes(permissionName);
        }

        // 4. Fallback to Role-only permissions (if resolved list is missing)
        if (!user.role?.permissions) return false;
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
        isAdmin: (user?.role?.name || user?.role || '').toString().toLowerCase() === 'admin',
        isOperationalManager: (user?.role?.name || user?.role || '').toString().toLowerCase() === 'operational_manager',
        isGlobalUser: ['admin', 'operational_manager'].includes((user?.role?.name || user?.role || '').toString().toLowerCase())
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
