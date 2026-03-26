import React from 'react';

/**
 * Skeleton loading components for placeholders during data loading
 * 
 * @usage
 * import { SkeletonKpiCard, SkeletonTable } from '../common/Skeleton';
 * 
 * // In component:
 * {loading ? <SkeletonKpiCard /> : <NumberChart ... />}
 */

const shimmerKeyframes = `
  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }
`;

// Inject keyframes once
if (typeof document !== 'undefined' && !document.getElementById('skeleton-styles')) {
    const style = document.createElement('style');
    style.id = 'skeleton-styles';
    style.textContent = shimmerKeyframes;
    document.head.appendChild(style);
}

/**
 * Animated shimmer effect base class
 */
const shimmerClass = {
    background: 'linear-gradient(90deg, var(--color-surface-2) 25%, var(--color-border) 50%, var(--color-surface-2) 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
};

/**
 * SkeletonText - animated text placeholder
 * @param {number} lines - Number of text lines to show
 * @param {string} width - Width of the text (default "100%")
 */
export const SkeletonText = ({ lines = 1, width = '100%' }) => {
    return (
        <div style={{ width }}>
            {Array.from({ length: lines }).map((_, index) => (
                <div
                    key={index}
                    style={{
                        ...shimmerClass,
                        height: '14px',
                        width: index === lines - 1 && lines > 1 ? '70%' : '100%',
                        borderRadius: '4px',
                        marginBottom: index < lines - 1 ? '8px' : 0,
                    }}
                />
            ))}
        </div>
    );
};

/**
 * SkeletonCard - card-shaped skeleton
 * @param {string|number} height - Height of the card
 */
export const SkeletonCard = ({ height = 120 }) => {
    return (
        <div
            style={{
                ...shimmerClass,
                height: `${height}px`,
                borderRadius: 'var(--radius-lg, 12px)',
                border: '1px solid var(--color-border)',
            }}
        />
    );
};

/**
 * SkeletonKpiCard - matches NumberChart layout (icon square + label + value)
 */
export const SkeletonKpiCard = () => {
    return (
        <div
            style={{
                backgroundColor: 'var(--color-surface-0)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg, 12px)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
            }}
        >
            {/* Icon square */}
            <div
                style={{
                    ...shimmerClass,
                    width: '40px',
                    height: '40px',
                    borderRadius: 'var(--radius-md, 8px)',
                }}
            />
            {/* Label */}
            <div
                style={{
                    ...shimmerClass,
                    width: '60%',
                    height: '12px',
                    borderRadius: '4px',
                }}
            />
            {/* Value */}
            <div
                style={{
                    ...shimmerClass,
                    width: '80%',
                    height: '24px',
                    borderRadius: '4px',
                }}
            />
        </div>
    );
};

/**
 * SkeletonTable - table with header and rows
 * @param {number} rows - Number of data rows (default 5)
 * @param {number} columns - Number of columns (default 6)
 */
export const SkeletonTable = ({ rows = 5, columns = 6 }) => {
    const columnWidths = ['15%', '25%', '15%', '15%', '10%', '20%'];

    return (
        <div
            style={{
                backgroundColor: 'var(--color-surface-0)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg, 12px)',
                overflow: 'hidden',
            }}
        >
            {/* Table Header */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: columnWidths.slice(0, columns).join(' '),
                    gap: '16px',
                    padding: '14px 16px',
                    backgroundColor: 'var(--color-surface-1)',
                    borderBottom: '2px solid var(--color-border)',
                }}
            >
                {Array.from({ length: columns }).map((_, index) => (
                    <div
                        key={`header-${index}`}
                        style={{
                            ...shimmerClass,
                            height: '12px',
                            borderRadius: '4px',
                        }}
                    />
                ))}
            </div>

            {/* Table Rows */}
            {Array.from({ length: rows }).map((_, rowIndex) => (
                <div
                    key={`row-${rowIndex}`}
                    style={{
                        display: 'grid',
                        gridTemplateColumns: columnWidths.slice(0, columns).join(' '),
                        gap: '16px',
                        padding: '14px 16px',
                        borderBottom: '1px solid var(--color-border)',
                    }}
                >
                    {Array.from({ length: columns }).map((_, colIndex) => (
                        <div
                            key={`cell-${rowIndex}-${colIndex}`}
                            style={{
                                ...shimmerClass,
                                height: '14px',
                                borderRadius: '4px',
                            }}
                        />
                    ))}
                </div>
            ))}
        </div>
    );
};

/**
 * SkeletonChart - chart placeholder with pulsing bars
 * @param {string|number} height - Height of the chart (default 280)
 */
export const SkeletonChart = ({ height = 280 }) => {
    // Create pseudo-random bar heights for visual interest
    const barHeights = [60, 80, 45, 90, 70, 55, 85, 65, 75, 50, 95, 60];

    return (
        <div
            style={{
                ...shimmerClass,
                height: `${height}px`,
                borderRadius: 'var(--radius-lg, 12px)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface-0)',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-around',
                padding: '20px',
            }}
        >
            {barHeights.map((heightPercent, index) => (
                <div
                    key={index}
                    style={{
                        width: '8%',
                        height: `${heightPercent}%`,
                        borderRadius: '4px 4px 0 0',
                        backgroundColor: 'var(--color-border)',
                    }}
                />
            ))}
        </div>
    );
};

export default {
    SkeletonText,
    SkeletonCard,
    SkeletonKpiCard,
    SkeletonTable,
    SkeletonChart,
};
