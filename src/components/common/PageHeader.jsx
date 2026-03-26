import React from 'react';

/**
 * PageHeader - displays page title, subtitle, and optional actions
 * 
 * @param {object} props
 * @param {string} props.title - Page title
 * @param {string} props.subtitle - Optional subtitle
 * @param {React.ReactNode} props.actions - Optional right-side slot for buttons
 */
const PageHeader = ({ title, subtitle, actions }) => {
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '24px',
                flexWrap: 'wrap',
                gap: '16px',
            }}
        >
            <div>
                <h1
                    style={{
                        fontSize: 'var(--text-2xl, 24px)',
                        fontWeight: 'var(--font-bold, 700)',
                        color: 'var(--color-text-primary)',
                        margin: 0,
                        marginBottom: subtitle ? '4px' : 0,
                    }}
                >
                    {title}
                </h1>
                {subtitle && (
                    <p
                        style={{
                            fontSize: 'var(--text-sm, 14px)',
                            color: 'var(--color-text-secondary)',
                            margin: 0,
                        }}
                    >
                        {subtitle}
                    </p>
                )}
            </div>
            {actions && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                    }}
                >
                    {actions}
                </div>
            )}
        </div>
    );
};

export default PageHeader;
