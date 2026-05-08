import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children, permission, requiredRole }) => {
    const {
        isAuthenticated,
        loading,             // general auth loading (user still being fetched)
        loadingPermissions,  // true while permissions are loaded after login
        hasPermission,
        user,
    } = useAuth();

    // Still verifying the user’s session OR loading permissions
    if (loading || loadingPermissions) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
            }}>
                <div style={{ textAlign: 'center', color: 'white' }}>
                    <div style={{
                        width: '50px', height: '50px',
                        border: '4px solid rgba(255,255,255,0.3)',
                        borderTop: '4px solid white',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto 20px'
                    }}></div>
                    <p>Verifying access…</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // Role check
    if (requiredRole && user?.role?.name !== requiredRole) {
        return <Navigate to="/unauthorized" replace />;
    }

    // Permission check – only runs when permissions are fully loaded
    if (permission && !hasPermission(permission)) {
        return <Navigate to="/unauthorized" replace />;
    }

    return children;
};

export default ProtectedRoute;