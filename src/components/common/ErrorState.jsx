import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * ErrorState - displayed when an error occurs
 * 
 * @param {object} props
 * @param {string} props.title - Title text (default "Something went wrong")
 * @param {string} props.description - Description/error message
 * @param {function} props.onRetry - Retry callback function
 * 
 * @usage
 * <ErrorState 
 *   title="Failed to load data"
 *   description={error.message}
 *   onRetry={refetch}
 * />
 */
const ErrorState = ({
    title = 'Something went wrong',
    description = '',
    onRetry = null
}) => {
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '48px 24px',
                textAlign: 'center',
            }}
        >
            {/* Error Icon */}
            <div
                style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-danger-50, #FEF2F2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '16px',
                }}
            >
                <AlertTriangle
                    size={28}
                    style={{
                        color: 'var(--color-danger-500)'
                    }}
                />
            </div>

            {/* Title */}
            <h3
                style={{
                    fontSize: 'var(--text-lg, 18px)',
                    fontWeight: 'var(--font-semibold, 600)',
                    color: 'var(--color-text-primary)',
                    marginBottom: '8px',
                    margin: 0,
                }}
            >
                {title}
            </h3>

            {/* Description */}
            {description && (
                <p
                    style={{
                        fontSize: 'var(--text-sm, 14px)',
                        color: 'var(--color-text-secondary)',
                        marginBottom: onRetry ? '24px' : '0',
                        maxWidth: '400px',
                    }}
                >
                    {description}
                </p>
            )}

            {/* Retry Button */}
            {onRetry && (
                <button
                    onClick={onRetry}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 20px',
                        fontSize: 'var(--text-sm, 14px)',
                        fontWeight: 'var(--font-semibold, 600)',
                        color: 'var(--color-surface-0)',
                        backgroundColor: 'var(--color-brand-600)',
                        border: 'none',
                        borderRadius: 'var(--radius-md, 8px)',
                        cursor: 'pointer',
                        transition: 'background-color var(--transition-fast)',
                    }}
                    onMouseOver={(e) => {
                        e.target.style.backgroundColor = 'var(--color-brand-700)';
                    }}
                    onMouseOut={(e) => {
                        e.target.style.backgroundColor = 'var(--color-brand-600)';
                    }}
                >
                    <RefreshCw size={16} />
                    Try again
                </button>
            )}
        </div>
    );
};

export default ErrorState;
