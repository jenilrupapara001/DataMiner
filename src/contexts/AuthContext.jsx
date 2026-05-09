// contexts/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadingPermissions, setLoadingPermissions] = useState(false);   // ← NEW
    const [error, setError] = useState(null);

    // Helper to normalize user object
    const normalizeUser = (raw) => ({
        ...raw,
        firstName: raw.firstName || raw.FirstName,
        lastName: raw.lastName || raw.LastName,
        fullName: raw.fullName || `${raw.firstName || raw.FirstName || ''} ${raw.lastName || raw.LastName || ''}`.trim(),
        role: typeof raw.role === 'object'
            ? {
                ...raw.role,
                name: raw.role.name || raw.role.Name,
                displayName: raw.role.displayName || raw.role.DisplayName || raw.role.Name,
            }
            : { name: raw.role, displayName: raw.role },
    });

    // ----- Restore session on mount -----
    useEffect(() => {
        const initAuth = async () => {
            const token = localStorage.getItem('authToken');
            if (token) {
                try {
                    const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/auth/me`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    if (response.ok) {
                        const result = await response.json();
                        if (result.success && result.data) {
                            const normalized = normalizeUser(result.data);
                            setUser(normalized);
                            localStorage.setItem('user', JSON.stringify(normalized));
                        } else throw new Error('Invalid user data');
                    } else throw new Error('Session expired');
                } catch (err) {
                    console.warn('Auth initialization warning:', err.message);
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('user');
                    setUser(null);
                }
            } else {
                setUser(null);
            }
            setLoading(false);
        };
        initAuth();
    }, []);

    // ----- Login -----
    const login = async (email, password) => {
        try {
            setError(null);
            setLoading(true);

            const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message || 'Login failed');

            const { user: rawUser, accessToken } = result.data;
            let normalized = normalizeUser(rawUser);

            // If the login response already includes the permissions array, use it immediately.
            if (normalized.permissions && normalized.permissions.length > 0) {
                // Already have permissions – no extra loading
                setUser(normalized);
                localStorage.setItem('authToken', accessToken);
                localStorage.setItem('user', JSON.stringify(normalized));
            } else {
                // Permissions missing – fetch them now
                setUser(normalized);                // set user without permissions
                localStorage.setItem('authToken', accessToken);
                setLoadingPermissions(true);        // start permission loading
                try {
                    const meRes = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/auth/me`, {
                        headers: { Authorization: `Bearer ${accessToken}` },
                    });
                    if (meRes.ok) {
                        const meResult = await meRes.json();
                        if (meResult.success && meResult.data) {
                            const updated = normalizeUser({ ...normalized, permissions: meResult.data.permissions || [] });
                            setUser(updated);
                            localStorage.setItem('user', JSON.stringify(updated));
                        }
                    }
                } catch (permErr) {
                    console.warn('Permission fetch failed:', permErr.message);
                } finally {
                    setLoadingPermissions(false);   // done loading permissions
                }
            }

            setLoading(false);
            return { success: true };
        } catch (err) {
            setError(err.message);
            setLoading(false);
            return { success: false, error: err.message };
        }
    };

    // ----- Register (same permission loading logic) -----
    const register = async (userData) => {
        try {
            setError(null);
            const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData),
            });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message || 'Registration failed');

            const { user: rawUser, accessToken } = result.data;
            let normalized = normalizeUser(rawUser);
            if (normalized.permissions && normalized.permissions.length > 0) {
                setUser(normalized);
                localStorage.setItem('authToken', accessToken);
                localStorage.setItem('user', JSON.stringify(normalized));
            } else {
                setUser(normalized);
                localStorage.setItem('authToken', accessToken);
                setLoadingPermissions(true);
                try {
                    const meRes = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/auth/me`, {
                        headers: { Authorization: `Bearer ${accessToken}` },
                    });
                    if (meRes.ok) {
                        const meResult = await meRes.json();
                        if (meResult.success && meResult.data) {
                            const updated = normalizeUser({ ...normalized, permissions: meResult.data.permissions || [] });
                            setUser(updated);
                            localStorage.setItem('user', JSON.stringify(updated));
                        }
                    }
                } finally {
                    setLoadingPermissions(false);
                }
            }
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
        if (window.location.pathname !== '/login') {
            window.location.href = '/login';
        }
    };

    const refreshUser = (updatedUser) => {
        const normalized = normalizeUser(updatedUser);
        setUser(normalized);
        localStorage.setItem('user', JSON.stringify(normalized));
    };

    const hasPermission = (permissionName) => {
        if (!user) return false;
        const roleName = (user.role?.name || user.role || '').toString().toLowerCase();
        if (roleName === 'admin') return true;
        if (roleName === 'operational_manager') {
            const excludedPermissions = [
                'settings_manage',
                'users_view',
                'users_manage',
                'roles_view',
                'roles_manage',
                'apikeys_manage'
            ];
            if (excludedPermissions.includes(permissionName)) {
                return false;
            }
            return true;
        }
        if (user.permissions && Array.isArray(user.permissions)) {
            return user.permissions.includes(permissionName);
        }
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
        loadingPermissions,              // ← NEW
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
        isGlobalUser: ['admin', 'operational_manager'].includes((user?.role?.name || user?.role || '').toString().toLowerCase()),
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};