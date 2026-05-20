import React from 'react';
import { Alert } from 'antd';
import { EyeOutlined } from '@ant-design/icons';

export const ReadOnlyBanner = ({ isBrandManager }) => {
    return (
        <Alert
            message={
                <span style={{ fontWeight: 600, color: '#D97706' }}>
                    {isBrandManager ? 'Assigned Brands View' : 'Read-Only Mode'}
                </span>
            }
            description={
                <span style={{ color: '#4B5563' }}>
                    {isBrandManager 
                        ? 'You are viewing targets for your assigned brands only. Target creation, editing, and deletion are disabled.'
                        : 'You do not have write/edit permissions for targets. The dashboard is loaded in read-only mode.'}
                </span>
            }
            type="warning"
            showIcon
            icon={<EyeOutlined style={{ color: '#D97706', fontSize: '18px' }} />}
            style={{
                marginBottom: '20px',
                borderRadius: '12px',
                border: '1px solid rgba(217, 119, 6, 0.15)',
                background: 'linear-gradient(135deg, #FEF3C7 0%, #FFFBEB 100%)',
                boxShadow: '0 4px 12px rgba(217, 119, 6, 0.04)'
            }}
        />
    );
};

export default ReadOnlyBanner;
