import React from 'react';
import { Result, Button, Card } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

/**
 * PermissionGuard Component
 * 
 * Props:
 * - allowed: boolean indicating if access is allowed (e.g. from useTargetPermissions)
 * - mode: 'hide' | 'lock' | 'disable' (default: 'hide')
 * - fallback: custom fallback element when hidden
 * - children: the component/elements to render if permitted
 */
export const PermissionGuard = ({
    allowed,
    mode = 'hide',
    fallback = null,
    children
}) => {
    const navigate = useNavigate();

    if (allowed) {
        return <>{children}</>;
    }

    if (mode === 'hide') {
        return fallback;
    }

    if (mode === 'disable') {
        // If it's a single React element, clone it and add disabled prop
        if (React.isValidElement(children)) {
            return React.cloneElement(children, { disabled: true });
        }
        return <span style={{ opacity: 0.5, cursor: 'not-allowed' }} className="disabled-interactive">{children}</span>;
    }

    if (mode === 'lock') {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '70vh',
                padding: '24px',
                background: 'rgba(255, 255, 255, 0.02)',
                backdropFilter: 'blur(8px)',
                borderRadius: '16px',
            }}>
                <Card style={{
                    maxWidth: 500,
                    width: '100%',
                    textAlign: 'center',
                    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.08)',
                    border: '1px solid rgba(0, 0, 0, 0.06)',
                    borderRadius: '16px',
                }}>
                    <Result
                        icon={<LockOutlined style={{ fontSize: 50, color: '#FF4D4F' }} />}
                        title="Access Restricted"
                        subTitle="You do not have the required permissions to view this module. Please contact your administrator if you believe this is an error."
                        extra={[
                            <Button 
                                type="primary" 
                                key="home" 
                                size="large" 
                                onClick={() => navigate('/dashboard')}
                                style={{ borderRadius: '8px' }}
                            >
                                Back to Dashboard
                            </Button>
                        ]}
                    />
                </Card>
            </div>
        );
    }

    return null;
};

export default PermissionGuard;
