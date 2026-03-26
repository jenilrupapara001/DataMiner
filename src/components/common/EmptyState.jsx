import React from 'react';

/**
 * EmptyState - displayed when there's no data
 * 
 * @param {object} props
 * @param {React.ComponentType} props.icon - Lucide icon component
 * @param {string} props.title - Title text
 * @param {string} props.description - Description text
 * @param {object} props.action - Action button config { label, onClick }
 * 
 * @usage
 * <EmptyState 
 *   icon={Inbox} 
 *   title="No data yet" 
 *   description="Get started by adding your first item"
 *   action={{ label: 'Add first item', onClick: handleAdd }}
 * />
 */
const EmptyState = ({
    icon: Icon,
    title = 'No data',
    description = '',
    action = null
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
            {/* Icon */}
            {Icon && (
                <div
                    style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--color-surface-2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '16px',
                    }}
                >
                    <Icon
                        size={28}
                        style={{
                            color: 'var(--color-text-muted)'
                        }}
                    />
                </div>
            )}

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
                        marginBottom: action ? '24px' : '0',
                        maxWidth: '320px',
                    }}
                >
                    {description}
                </p>
            )}

            {/* Action Button */}
            {action && action.label && (
                <button
                    onClick={action.onClick}
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
                    {action.label}
                </button>
            )}
        </div>
    );
};

export default EmptyState;
