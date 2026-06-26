/**
 * MultiMetricOverview - Top KPI cards showing all e-commerce metrics
 * Supports: GMS, Ads Spend, ACoS, PO Fulfillment, Listing Score, CVR, Returns, Inventory Health
 */

import React from 'react';
import {
    TrendingUp,
    TrendingDown,
    Minus,
    DollarSign,
    Target,
    Package,
    Star,
    Percent,
    RotateCcw,
    Warehouse,
    AlertCircle
} from 'lucide-react';
import Card from '../common/Card';
import { SkeletonKpiCard } from '../common/Skeleton';
import EmptyState from '../common/EmptyState';
import ErrorState from '../common/ErrorState';
import { METRIC_CONFIG, MetricType, MetricOverview } from '../../models/growth.types';

// Map metric types to icons
const getMetricIcon = (metricType: MetricType) => {
    const icons = {
        GMS: TrendingUp,
        ADS_SPEND: DollarSign,
        AD_REVENUE: DollarSign,
        ACOS: Target,
        PO_FULFILLMENT: Package,
        LISTING_SCORE: Star,
        CVR: Percent,
        RETURNS: RotateCcw,
        INVENTORY_HEALTH: Warehouse,
    };
    return icons[metricType] || TrendingUp;
};

// Format value based on unit type
const formatValue = (value: number, unit: string): string => {
    if (!value && value !== 0) return '--';

    if (unit === '%') {
        return `${value.toFixed(1)}%`;
    }

    if (unit === '₹') {
        if (value >= 10000000) {
            return `₹${(value / 10000000).toFixed(2)}Cr`;
        } else if (value >= 100000) {
            return `₹${(value / 100000).toFixed(1)}L`;
        } else if (value >= 1000) {
            return `₹${(value / 1000).toFixed(1)}K`;
        }
        return `₹${value.toFixed(0)}`;
    }

    return value.toLocaleString();
};

// Get trend icon and color
const getTrendInfo = (changePercent: number, metricType: MetricType) => {
    // For metrics where lower is better
    const invertedMetrics: MetricType[] = ['ACOS', 'RETURNS'];
    const isInverted = invertedMetrics.includes(metricType);

    if (changePercent > 0) {
        return {
            icon: isInverted ? TrendingDown : TrendingUp,
            color: isInverted ? '#D32F2F' : '#2E7D32', // Red for bad increase, Green for good increase
            label: `+${changePercent.toFixed(1)}%`
        };
    } else if (changePercent < 0) {
        return {
            icon: isInverted ? TrendingUp : TrendingDown,
            color: isInverted ? '#2E7D32' : '#D32F2F', // Green for good decrease, Red for bad decrease
            label: `${changePercent.toFixed(1)}%`
        };
    }

    return {
        icon: Minus,
        color: '#94a3b8',
        label: '0%'
    };
};

// Status badge color
const getStatusColor = (status?: string) => {
    switch (status) {
        case 'AHEAD': return '#2E7D32';
        case 'ON_TRACK': return '#0288D1';
        case 'BEHIND': return '#ED6C02';
        default: return '#94a3b8';
    }
};

// Single metric card
const MetricCard = ({
    metricType,
    overview,
    onClick
}: {
    metricType: MetricType;
    overview?: MetricOverview;
    onClick?: () => void;
}) => {
    const config = METRIC_CONFIG[metricType];
    const Icon = getMetricIcon(metricType);
    const trendInfo = overview ? getTrendInfo(overview.changePercent, metricType) : null;
    const TrendIcon = trendInfo?.icon || Minus;

    return (
        <div
            className="metric-card p-3 rounded-3 border transition-all cursor-pointer"
            style={{
                backgroundColor: 'var(--color-surface-0)',
                borderColor: 'var(--color-border)',
                cursor: onClick ? 'pointer' : 'default',
                transition: 'all var(--transition-fast)',
            }}
            onClick={onClick}
            onMouseEnter={(e) => {
                if (onClick) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                }
            }}
            onMouseLeave={(e) => {
                if (onClick) {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = 'none';
                }
            }}
        >
            <div className="d-flex justify-content-between align-items-start mb-2">
                <div
                    className="d-flex align-items-center justify-content-center rounded-2"
                    style={{
                        width: '36px',
                        height: '36px',
                        backgroundColor: `${config.color}15`,
                        color: config.color
                    }}
                >
                    <Icon size={18} />
                </div>
                {overview?.status && (
                    <span
                        className="badge rounded-pill border-0 smallest"
                        style={{
                            backgroundColor: `${getStatusColor(overview.status)}20`,
                            color: getStatusColor(overview.status),
                            fontWeight: 600
                        }}
                    >
                        {overview.status.replace('_', ' ')}
                    </span>
                )}
            </div>

            <div className="mb-1" style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                {config.label}
            </div>

            <div className="d-flex align-items-end justify-content-between">
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    {formatValue(overview?.currentValue || 0, config.unit.symbol)}
                </div>
                {trendInfo && (
                    <div
                        className="d-flex align-items-center gap-1 smallest"
                        style={{ color: trendInfo.color, fontWeight: 600 }}
                    >
                        <TrendIcon size={12} />
                        {trendInfo.label}
                    </div>
                )}
            </div>

            {overview?.targetValue && (
                <div className="mt-2" style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    Target: {formatValue(overview.targetValue, config.unit.symbol)}
                </div>
            )}
        </div>
    );
};

// Loading skeleton
const MetricCardSkeleton = () => <SkeletonKpiCard />;

// Empty state
const EmptyMetricState = ({ onCreateGoal }: { onCreateGoal?: () => void }) => (
    <EmptyState
        icon={Target}
        title="No goals set"
        description="Set your first growth goal to start tracking metrics"
        action={onCreateGoal ? { label: 'Create Goal', onClick: onCreateGoal } : null}
    />
);

// Main component
const MultiMetricOverview = ({
    metrics,
    loading,
    error,
    onRetry,
    onMetricClick,
    onCreateGoal
}: {
    metrics?: MetricOverview[];
    loading?: boolean;
    error?: Error | null;
    onRetry?: () => void;
    onMetricClick?: (metricType: MetricType) => void;
    onCreateGoal?: () => void;
}) => {
    // All metric types to display
    const metricTypes: MetricType[] = [
        'GMS',
        'ADS_SPEND',
        'AD_REVENUE',
        'ACOS',
        'PO_FULFILLMENT',
        'LISTING_SCORE',
        'CVR',
        'RETURNS',
        'INVENTORY_HEALTH'
    ];

    // Get metric overview by type
    const getMetricOverview = (type: MetricType): MetricOverview | undefined => {
        return metrics?.find(m => m.metricType === type);
    };

    // Render loading state
    if (loading) {
        return (
            <div className="row g-3 mb-4">
                {metricTypes.map((type) => (
                    <div key={type} className="col-6 col-md-4 col-lg">
                        <MetricCardSkeleton />
                    </div>
                ))}
            </div>
        );
    }

    // Render error state
    if (error) {
        return (
            <Card title="Performance Overview">
                <ErrorState
                    title="Failed to load metrics"
                    description={error.message}
                    onRetry={onRetry}
                />
            </Card>
        );
    }

    // Render empty state
    if (!metrics || metrics.length === 0) {
        return (
            <Card title="Performance Overview">
                <EmptyMetricState onCreateGoal={onCreateGoal} />
            </Card>
        );
    }

    return (
        <div className="row g-3 mb-4">
            {metricTypes.map((type) => (
                <div key={type} className="col-6 col-md-4 col-lg">
                    <MetricCard
                        metricType={type}
                        overview={getMetricOverview(type)}
                        onClick={onMetricClick ? () => onMetricClick(type) : undefined}
                    />
                </div>
            ))}
        </div>
    );
};

export default MultiMetricOverview;
