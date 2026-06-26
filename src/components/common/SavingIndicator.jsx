import React, { memo } from 'react';
import { Spin, Tooltip } from 'antd';
import { CheckCircle2, AlertCircle, Clock } from 'lucide-react';

export const SavingIndicator = memo(({
    id,
    savingIds,
    errorIds,
    isOptimistic
}) => {
    if (savingIds && savingIds.has(id)) {
        return (
            <Tooltip title="Saving...">
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Spin size="small" />
                    <span style={{ fontSize: 10, color: '#94a3b8' }}>Saving</span>
                </div>
            </Tooltip>
        );
    }

    if (errorIds && errorIds.has(id)) {
        return (
            <Tooltip title={`Save failed: ${errorIds.get(id)}`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                    <AlertCircle size={14} color="#D32F2F" />
                    <span style={{ fontSize: 10, color: '#D32F2F' }}>Failed</span>
                </div>
            </Tooltip>
        );
    }

    if (isOptimistic) {
        return (
            <Tooltip title="Syncing with server...">
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={12} color="#ED6C02" />
                    <span style={{ fontSize: 10, color: '#ED6C02' }}>Syncing</span>
                </div>
            </Tooltip>
        );
    }

    return (
        <Tooltip title="Saved">
            <CheckCircle2 size={14} color="#2E7D32" />
        </Tooltip>
    );
});

SavingIndicator.displayName = 'SavingIndicator';
