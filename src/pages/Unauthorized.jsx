import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';

const Unauthorized = () => {
    const navigate = useNavigate();

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height: 'calc(100vh - 64px)',
            textAlign: 'center',
            padding: '20px',
            backgroundColor: '#f9fafb'
        }}>
            <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                backgroundColor: '#fee2e2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '24px'
            }}>
                <ShieldAlert size={40} color="#ef4444" />
            </div>
            
            <h1 style={{ 
                fontSize: '30px', 
                fontWeight: '800',
                color: '#111827',
                marginBottom: '12px' 
            }}>
                Access Denied
            </h1>
            
            <p style={{ 
                fontSize: '16px', 
                color: '#6b7280', 
                marginBottom: '32px', 
                maxWidth: '420px',
                lineHeight: '1.5'
            }}>
                Your current role does not have the required permissions to view this section. 
                Please contact your supervisor if you believe this is a mistake.
            </p>
            
            <div style={{ display: 'flex', gap: '12px' }}>
                <button
                    onClick={() => navigate(-1)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 20px',
                        backgroundColor: 'white',
                        color: '#374151',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '14px',
                        transition: 'all 0.2s'
                    }}
                >
                    <ArrowLeft size={16} />
                    Go Back
                </button>
                
                <button
                    onClick={() => navigate('/')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 20px',
                        backgroundColor: '#6366f1',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '14px',
                        transition: 'all 0.2s'
                    }}
                >
                    <Home size={16} />
                    Dashboard
                </button>
            </div>
        </div>
    );
};

export default Unauthorized;
