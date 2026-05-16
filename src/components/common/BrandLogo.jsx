import React from 'react';

/**
 * RetailOps Brand Logo Mark (SVG icon only)
 * Updated with Enterprise Gold and Rich Black theme
 * Usage: <RetailOpsIcon size={32} />
 */
export const RetailOpsIcon = ({ size = 32, className = '', color = '#CA8A04' }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        <defs>
            <linearGradient id="ro-bg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#1C1917" />
                <stop offset="100%" stopColor="#0C0A09" />
            </linearGradient>
            <linearGradient id="ro-accent" x1="0" y1="1" x2="1" y2="0">
                <stop offset="0%" stopColor={color} />
                <stop offset="100%" stopColor="#EAB308" />
            </linearGradient>
        </defs>

        {/* Background */}
        <rect width="200" height="200" rx="44" fill="url(#ro-bg)" />
        <rect x="1" y="1" width="198" height="198" rx="43" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />

        {/* R — vertical stem */}
        <rect x="52" y="46" width="22" height="108" rx="4" fill="white" opacity="0.95" />
        {/* R — top horizontal bar */}
        <rect x="52" y="46" width="68" height="22" rx="4" fill="white" opacity="0.95" />
        {/* R — middle bar */}
        <rect x="52" y="89" width="60" height="20" rx="4" fill="white" opacity="0.95" />
        {/* R — right post */}
        <rect x="100" y="46" width="20" height="63" rx="4" fill="white" opacity="0.95" />
        {/* R — diagonal leg */}
        <polygon points="74,109 120,154 96,154 52,109" fill="white" opacity="0.85" />

        {/* Trending arrow overlay */}
        <polyline
            points="60,148 82,128 100,138 130,100 148,100"
            stroke="url(#ro-accent)"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
        />
        <polyline
            points="132,88 148,100 136,112"
            stroke="url(#ro-accent)"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
        />

        {/* Package accent */}
        <g transform="translate(116,128)">
            <polygon points="18,0 36,9 18,18 0,9" fill={color} opacity="0.9" />
            <polygon points="0,9 18,18 18,36 0,27" fill={color} opacity="0.7" />
            <polygon points="36,9 18,18 18,36 36,27" fill={color} opacity="0.5" />
        </g>
    </svg>
);

/**
 * RetailOps Full Wordmark (icon + text side by side)
 * Usage: <RetailOpsWordmark size={28} />
 */
export const RetailOpsWordmark = ({ size = 28, className = '', color = '#1C1917' }) => (
    <div className={`d-flex align-items-center gap-3 ${className}`} style={{ userSelect: 'none' }}>
        <RetailOpsIcon size={size} />
        <span style={{
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 800,
            fontSize: Math.round(size * 0.55),
            letterSpacing: '-0.04em',
            color: color,
            lineHeight: 1,
            whiteSpace: 'nowrap',
        }}>
            Retail<span style={{ color: '#CA8A04' }}>Ops</span>
        </span>
    </div>
);

/**
 * Minimal icon-only mark for collapsed sidebar / favicon use
 */
export const RetailOpsMark = ({ size = 28, color = '#CA8A04' }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <defs>
            <linearGradient id="rom-bg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#1C1917" />
                <stop offset="100%" stopColor="#0C0A09" />
            </linearGradient>
        </defs>
        <rect width="32" height="32" rx="8" fill="url(#rom-bg)" />
        {/* R */}
        <rect x="8" y="7" width="4" height="18" rx="1" fill="white" opacity="0.95" />
        <rect x="8" y="7" width="12" height="4" rx="1" fill="white" opacity="0.95" />
        <rect x="8" y="14.5" width="10" height="3.5" rx="1" fill="white" opacity="0.95" />
        <rect x="17" y="7" width="3" height="11" rx="1" fill="white" opacity="0.95" />
        <polygon points="12,18 20,25 16.5,25 8.5,18" fill="white" opacity="0.85" />
        {/* Arrow */}
        <polyline points="9,24 13,20 16,22 22,16 24,16" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <polyline points="21.5,13.5 24,16 21.5,18.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
);

export default RetailOpsIcon;
