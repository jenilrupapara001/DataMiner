import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const NumberChart = ({
    label,
    value,
    icon: Icon,
    color = '#1976D2',
    delta,
    deltaType = 'neutral',
    subtitle
}) => {
    const getDeltaStyles = () => {
        if (deltaType === 'positive') return { color: '#2E7D32', bg: '#ecfdf5', icon: TrendingUp };
        if (deltaType === 'negative') return { color: '#D32F2F', bg: '#fef2f2', icon: TrendingDown };
        return { color: '#64748b', bg: '#f8fafc', icon: Minus };
    };

    const deltaConfig = getDeltaStyles();
    const DeltaIcon = deltaConfig.icon;

    return (
        <div className="glass-card hover-lift p-2 px-3 h-100" style={{ borderRadius: '16px' }}>
            <div className="d-flex justify-content-between align-items-start mb-1">
                <div
                    className="d-flex align-items-center justify-content-center"
                    style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '10px',
                        backgroundColor: `${color}15`,
                        color: color
                    }}
                >
                    {Icon && <Icon size={16} strokeWidth={2.5} />}
                </div>
                {delta !== undefined && (
                    <div
                        className="d-flex align-items-center gap-1 px-2 py-0.5 rounded-pill fw-700"
                        style={{
                            backgroundColor: deltaConfig.bg,
                            color: deltaConfig.color,
                            fontSize: '10px'
                        }}
                    >
                        <DeltaIcon size={10} strokeWidth={3} />
                        {delta}%
                    </div>
                )}
            </div>

            <div className="mt-2">
                <div className="text-muted smallest fw-700 text-uppercase tracking-wider mb-1" style={{ fontSize: '9px' }}>
                    {label}
                </div>
                <div className="h5 fw-800 mb-0" style={{ letterSpacing: '-0.02em', color: '#111827' }}>
                    {value}
                </div>
                {subtitle && (
                    <div className="text-muted smallest mt-1" style={{ fontSize: '10px' }}>
                        {subtitle}
                    </div>
                )}
            </div>
        </div>
    );
};

export default NumberChart;
