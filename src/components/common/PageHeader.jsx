import React, { memo } from 'react';
import { ChevronRight, Sparkles } from 'lucide-react';

/**
 * Premium PageHeader Component
 * 
 * @param {object} props
 * @param {string} props.title - Main page title
 * @param {string} props.subtitle - Optional subtitle/description
 * @param {React.ReactNode} props.actions - Right-side slot for buttons/controls
 * @param {React.ComponentType} props.icon - Lucide icon component for badge
 * @param {string} props.iconColor - Custom icon color (default: indigo)
 * @param {string} props.iconGradient - Custom gradient (e.g., "linear-gradient(...)")
 * @param {Array} props.breadcrumbs - Array of {label, href} for breadcrumb trail
 * @param {string} props.badge - Optional badge text (e.g., "BETA", "NEW")
 * @param {string} props.badgeColor - Badge accent color
 * @param {boolean} props.divider - Show bottom divider (default: true)
 * @param {boolean} props.compact - Compact variant with less padding
 * @param {React.ReactNode} props.stats - Optional stats chips below header
 */
const PageHeader = ({
    title,
    subtitle,
    actions,
    icon: Icon,
    iconColor = '#6366f1',
    iconGradient,
    breadcrumbs = [],
    badge,
    badgeColor = '#6366f1',
    divider = true,
    compact = false,
    stats,
}) => {
    const defaultGradient = `linear-gradient(135deg, ${iconColor} 0%, ${iconColor}dd 100%)`;
    const finalGradient = iconGradient || defaultGradient;

    return (
        <>
            <div
                className="premium-page-header"
                style={{
                    marginBottom: compact ? 16 : 24,
                    paddingBottom: divider ? (compact ? 14 : 18) : 0,
                    borderBottom: divider ? '1px solid #e2e8f0' : 'none',
                    position: 'relative'
                }}
            >
                {/* ═══════════════════════════════════════════════════
                    BREADCRUMBS
                ═══════════════════════════════════════════════════ */}
                {breadcrumbs && breadcrumbs.length > 0 && (
                    <nav style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        marginBottom: 10,
                        flexWrap: 'wrap'
                    }}>
                        {breadcrumbs.map((crumb, idx) => {
                            const isLast = idx === breadcrumbs.length - 1;
                            return (
                                <React.Fragment key={idx}>
                                    {crumb.href && !isLast ? (
                                        <a
                                            href={crumb.href}
                                            className="breadcrumb-link"
                                            style={{
                                                fontSize: 11,
                                                fontWeight: 600,
                                                color: '#64748b',
                                                textDecoration: 'none',
                                                transition: 'color 0.15s',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 4
                                            }}
                                        >
                                            {crumb.icon && <crumb.icon size={11} strokeWidth={2.5} />}
                                            {crumb.label}
                                        </a>
                                    ) : (
                                        <span style={{
                                            fontSize: 11,
                                            fontWeight: isLast ? 700 : 600,
                                            color: isLast ? '#0f172a' : '#64748b',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 4
                                        }}>
                                            {crumb.icon && <crumb.icon size={11} strokeWidth={2.5} />}
                                            {crumb.label}
                                        </span>
                                    )}
                                    {!isLast && (
                                        <ChevronRight
                                            size={11}
                                            style={{ color: '#cbd5e1' }}
                                            strokeWidth={2.5}
                                        />
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </nav>
                )}

                {/* ═══════════════════════════════════════════════════
                    MAIN HEADER ROW
                ═══════════════════════════════════════════════════ */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 16
                }}>
                    {/* LEFT: Icon + Title */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        flex: 1,
                        minWidth: 0
                    }}>
                        {/* Icon Badge */}
                        {Icon && (
                            <div
                                className="page-header-icon-badge"
                                style={{
                                    width: compact ? 38 : 44,
                                    height: compact ? 38 : 44,
                                    borderRadius: compact ? 10 : 12,
                                    background: finalGradient,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#ffffff',
                                    boxShadow: `0 6px 16px -4px ${iconColor}50`,
                                    flexShrink: 0,
                                    position: 'relative'
                                }}
                            >
                                <Icon
                                    size={compact ? 18 : 22}
                                    strokeWidth={2.5}
                                />
                                {/* Live indicator dot */}
                                <span style={{
                                    position: 'absolute',
                                    bottom: -2,
                                    right: -2,
                                    width: 10,
                                    height: 10,
                                    background: '#10b981',
                                    border: '2px solid #ffffff',
                                    borderRadius: '50%',
                                    boxShadow: '0 0 0 0 rgba(16, 185, 129, 0.4)',
                                    animation: 'pulse-live-dot 2s ease-out infinite'
                                }} />
                            </div>
                        )}

                        {/* Title + Subtitle */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                flexWrap: 'wrap'
                            }}>
                                <h1 style={{
                                    fontSize: compact ? 18 : 22,
                                    fontWeight: 800,
                                    color: '#0f172a',
                                    margin: 0,
                                    letterSpacing: '-0.5px',
                                    lineHeight: 1.2
                                }}>
                                    {title}
                                </h1>

                                {/* Badge */}
                                {badge && (
                                    <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        padding: '3px 9px',
                                        background: `${badgeColor}12`,
                                        border: `1px solid ${badgeColor}30`,
                                        borderRadius: 20,
                                        fontSize: 9,
                                        fontWeight: 800,
                                        color: badgeColor,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.08em',
                                        flexShrink: 0
                                    }}>
                                        <Sparkles size={9} strokeWidth={2.5} />
                                        {badge}
                                    </span>
                                )}
                            </div>

                            {subtitle && (
                                <p style={{
                                    fontSize: compact ? 11 : 12,
                                    color: '#64748b',
                                    margin: 0,
                                    marginTop: 3,
                                    fontWeight: 500,
                                    lineHeight: 1.4
                                }}>
                                    {subtitle}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* RIGHT: Actions Slot */}
                    {actions && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            flexWrap: 'wrap',
                            flexShrink: 0
                        }}>
                            {actions}
                        </div>
                    )}
                </div>

                {/* ═══════════════════════════════════════════════════
                    STATS ROW (Optional)
                ═══════════════════════════════════════════════════ */}
                {stats && (
                    <div style={{
                        marginTop: 14,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap'
                    }}>
                        {stats}
                    </div>
                )}
            </div>

            <style>{`
                @keyframes pulse-live-dot {
                    0% {
                        transform: scale(1);
                        opacity: 1;
                        box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.6);
                    }
                    100% {
                        transform: scale(1.3);
                        opacity: 0;
                        box-shadow: 0 0 0 8px rgba(16, 185, 129, 0);
                    }
                }
                .breadcrumb-link:hover {
                    color: #4f46e5 !important;
                }
                .page-header-icon-badge {
                    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .page-header-icon-badge:hover {
                    transform: scale(1.05) rotate(3deg);
                }
            `}</style>
        </>
    );
};

export default memo(PageHeader);