import React, { useMemo, useState, memo } from 'react';
import { Card, Tooltip, Segmented } from 'antd';
import { Link } from 'react-router-dom';
import {
    Trophy, Medal, Award, Crown, TrendingUp, TrendingDown,
    Package, ArrowUpRight, BarChart3, Star, Sparkles,
    ChevronRight, Search, Filter, Eye, ShoppingBag
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
const formatNumber = (val) => {
    if (val === undefined || val === null || isNaN(val)) return '0';
    const num = Math.round(val);
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString('en-IN');
};

const formatCurrency = (val) => {
    if (val === undefined || val === null || isNaN(val)) return '₹0';
    const num = Math.round(val);
    if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)}Cr`;
    if (num >= 100000) return `₹${(num / 100000).toFixed(1)}L`;
    if (num >= 1000) return `₹${(num / 1000).toFixed(1)}K`;
    return `₹${num.toLocaleString('en-IN')}`;
};

const getBrandColor = (brand) => {
    if (!brand) return { bg: '#f1f5f9', text: '#64748b' };
    const colors = [
        { bg: '#dbeafe', text: '#2563eb' },
        { bg: '#fce7f3', text: '#db2777' },
        { bg: '#d1fae5', text: '#059669' },
        { bg: '#fef3c7', text: '#d97706' },
        { bg: '#e0e7ff', text: '#4f46e5' },
        { bg: '#fee2e2', text: '#dc2626' },
        { bg: '#cffafe', text: '#0891b2' },
        { bg: '#f3e8ff', text: '#9333ea' },
        { bg: '#fde2e8', text: '#e11d48' },
        { bg: '#ccfbf1', text: '#0d9488' }
    ];
    const hash = brand.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return colors[hash % colors.length];
};

// ═══════════════════════════════════════════════════════════════
// RANK BADGE COMPONENT
// ═══════════════════════════════════════════════════════════════
const RankBadge = memo(({ rank }) => {
    if (rank === 1) {
        return (
            <div style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 12px -2px rgba(251, 191, 36, 0.5)',
                position: 'relative',
                flexShrink: 0
            }}>
                <Crown size={16} strokeWidth={2.5} fill="#ffffff" />
            </div>
        );
    }
    if (rank === 2) {
        return (
            <div style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #cbd5e1 0%, #64748b 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 12px -2px rgba(100, 116, 139, 0.4)',
                flexShrink: 0
            }}>
                <Medal size={16} strokeWidth={2.5} />
            </div>
        );
    }
    if (rank === 3) {
        return (
            <div style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #fb923c 0%, #ea580c 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 12px -2px rgba(251, 146, 60, 0.4)',
                flexShrink: 0
            }}>
                <Award size={16} strokeWidth={2.5} />
            </div>
        );
    }
    return (
        <div style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: '#f1f5f9',
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#64748b',
            fontSize: 12,
            fontWeight: 800,
            flexShrink: 0
        }}>
            #{rank}
        </div>
    );
});

// ═══════════════════════════════════════════════════════════════
// ASIN ROW COMPONENT
// ═══════════════════════════════════════════════════════════════
const AsinRow = memo(({ product, rank, maxValue, sortBy }) => {
    const brandColor = getBrandColor(product.brand);
    const value = sortBy === 'units' ? product.units : sortBy === 'revenue' ? product.revenue : product.units;
    const pctOfMax = maxValue > 0 ? (value / maxValue) * 100 : 0;
    const isTop3 = rank <= 3;

    // Mock trend (replace with real data if available)
    const trend = product.trend || ((rank * 7) % 30 - 10); // Random-ish trend for demo
    const isPositive = trend >= 0;

    return (
        <div
            className="asin-row-hover"
            style={{
                position: 'relative',
                padding: '12px 14px',
                background: isTop3
                    ? `linear-gradient(135deg, ${brandColor.bg}40 0%, #ffffff 100%)`
                    : '#ffffff',
                border: '1px solid #d9e6e9',
                borderRadius: 10,
                marginBottom: 8,
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'pointer',
                overflow: 'hidden'
            }}
        >
            {/* Background performance bar (subtle) */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                bottom: 0,
                width: `${pctOfMax}%`,
                background: `linear-gradient(90deg, ${brandColor.text}06 0%, transparent 100%)`,
                pointerEvents: 'none'
            }} />

            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Rank Badge */}
                <RankBadge rank={rank} />

                {/* Product Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        marginBottom: 3
                    }}>
                        <span
                            title={product.title}
                            style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: '#121b1e',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                flex: 1,
                                minWidth: 0,
                                lineHeight: 1.3
                            }}
                        >
                            {product.title}
                        </span>
                        {isTop3 && (
                            <Sparkles size={11} style={{ color: '#fbbf24', flexShrink: 0 }} fill="#fbbf24" />
                        )}
                    </div>

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        flexWrap: 'nowrap',
                        overflow: 'hidden'
                    }}>
                        {/* ASIN */}
                        <span style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: '#8c8e8f',
                            background: '#f1f5f9',
                            padding: '1px 6px',
                            borderRadius: 4,
                            fontFamily: 'JetBrains Mono, monospace',
                            whiteSpace: 'nowrap',
                            flexShrink: 0
                        }}>
                            {product.asin}
                        </span>

                        {/* Brand tag */}
                        {product.brand && product.brand !== 'N/A' && (
                            <span style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: brandColor.text,
                                background: brandColor.bg,
                                padding: '1px 6px',
                                borderRadius: 4,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: 100,
                                flexShrink: 1
                            }}>
                                {product.brand}
                            </span>
                        )}

                        {/* Performance share */}
                        {pctOfMax > 0 && (
                            <span style={{
                                fontSize: 9,
                                color: '#8c8e8f',
                                fontWeight: 600,
                                marginLeft: 'auto',
                                whiteSpace: 'nowrap'
                            }}>
                                {pctOfMax.toFixed(0)}% of top
                            </span>
                        )}
                    </div>
                </div>

                {/* Value + Trend */}
                <div style={{
                    textAlign: 'right',
                    flexShrink: 0,
                    minWidth: 65
                }}>
                    <div style={{
                        fontSize: 16,
                        fontWeight: 800,
                        color: '#121b1e',
                        lineHeight: 1,
                        letterSpacing: '-0.3px'
                    }}>
                        {sortBy === 'revenue' ? formatCurrency(value) : formatNumber(value)}
                    </div>
                    <div style={{
                        fontSize: 9,
                        color: '#8c8e8f',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        marginTop: 1,
                        marginBottom: 4
                    }}>
                        {sortBy === 'revenue' ? 'revenue' : 'units'}
                    </div>
                    {trend !== 0 && (
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 2,
                            fontSize: 9,
                            fontWeight: 800,
                            color: isPositive ? '#059669' : '#dc2626',
                            background: isPositive ? '#d1fae5' : '#fee2e2',
                            padding: '1px 5px',
                            borderRadius: 8
                        }}>
                            {isPositive ? <TrendingUp size={9} strokeWidth={2.5} /> : <TrendingDown size={9} strokeWidth={2.5} />}
                            {Math.abs(trend).toFixed(0)}%
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
const TopAsinsCard = ({ products = [] }) => {
    const [sortBy, setSortBy] = useState('units');
    const [searchText, setSearchText] = useState('');

    // Process products
    const processedProducts = useMemo(() => {
        return products.map(p => ({
            title: p.title || 'Unknown Product',
            asin: p.asin || 'N/A',
            brand: p.brand || p.sku || 'N/A',
            units: Number(p.units || p.orders || 0),
            revenue: Number(p.revenue || p.sales || 0),
            trend: p.trend
        }));
    }, [products]);

    // Filter + sort
    const sortedProducts = useMemo(() => {
        let filtered = processedProducts;

        if (searchText.trim()) {
            const q = searchText.toLowerCase();
            filtered = filtered.filter(p =>
                p.title.toLowerCase().includes(q) ||
                p.asin.toLowerCase().includes(q) ||
                p.brand.toLowerCase().includes(q)
            );
        }

        return filtered
            .sort((a, b) => {
                if (sortBy === 'revenue') return b.revenue - a.revenue;
                return b.units - a.units;
            })
            .slice(0, 200);
    }, [processedProducts, sortBy, searchText]);

    // Stats
    const stats = useMemo(() => {
        const total = sortedProducts.length;
        const totalUnits = sortedProducts.reduce((sum, p) => sum + p.units, 0);
        const totalRevenue = sortedProducts.reduce((sum, p) => sum + p.revenue, 0);
        const topProduct = sortedProducts[0];
        return { total, totalUnits, totalRevenue, topProduct };
    }, [sortedProducts]);

    const maxValue = useMemo(() => {
        if (sortedProducts.length === 0) return 0;
        return sortBy === 'revenue' ? sortedProducts[0].revenue : sortedProducts[0].units;
    }, [sortedProducts, sortBy]);

    return (
        <>
            <style>{`
                .asin-row-hover:hover {
                    transform: translateX(2px) translateY(-1px);
                    box-shadow: 0 8px 16px -4px rgba(0, 0, 0, 0.08);
                    border-color: #cbd0d4 !important;
                }
                .top-asins-scroll::-webkit-scrollbar {
                    width: 6px;
                }
                .top-asins-scroll::-webkit-scrollbar-track {
                    background: transparent;
                }
                .top-asins-scroll::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 4px;
                }
                .top-asins-scroll::-webkit-scrollbar-thumb:hover {
                    background: #94a3b8;
                }
                .section-link-asins:hover {
                    color: #fb4f40 !important;
                    transform: translateX(2px);
                }
                @keyframes shimmer-crown {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.1); }
                }
                .crown-animate {
                    animation: shimmer-crown 2s ease-in-out infinite;
                }
                .asin-search-input {
                    border: 1px solid #d9e6e9 !important;
                    border-radius: 8px !important;
                    transition: all 0.2s;
                }
                .asin-search-input:focus,
                .asin-search-input:hover {
                    border-color: #fb4f40 !important;
                    box-shadow: 0 0 0 3px rgba(251, 79, 64, 0.08) !important;
                }
            `}</style>

            <Card
                styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column', height: '100%' } }}
                style={{
                    borderRadius: 16,
                    border: '1px solid #d9e6e9',
                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.02)',
                    background: '#ffffff',
                    height: 850,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                {/* ═══════════════════════════════════════════════════
                    HEADER
                ═══════════════════════════════════════════════════ */}
                <div style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid #d9e6e9',
                    background: 'linear-gradient(135deg, #fef2f2 0%, #ffffff 100%)'
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 12,
                        marginBottom: 12
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 11, flex: 1, minWidth: 0 }}>
                            <div style={{
                                width: 38,
                                height: 38,
                                borderRadius: 11,
                                background: 'linear-gradient(135deg, #fb4f40 0%, #d94033 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#ffffff',
                                boxShadow: '0 4px 12px -2px rgba(251, 79, 64, 0.5)',
                                flexShrink: 0
                            }}>
                                <Trophy size={20} strokeWidth={2.5} className="crown-animate" />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                    fontSize: 15,
                                    fontWeight: 800,
                                    color: '#121b1e',
                                    letterSpacing: '-0.01em',
                                    lineHeight: 1.2,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8
                                }}>
                                    Top Performing ASINs
                                </div>
                                <div style={{
                                    fontSize: 11,
                                    color: '#8c8e8f',
                                    fontWeight: 500,
                                    marginTop: 1
                                }}>
                                    Best products ranked by performance
                                </div>
                            </div>
                        </div>

                        <Link
                            to="/asin-tracker"
                            className="section-link-asins"
                            style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: '#fb4f40',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                transition: 'all 0.2s',
                                textDecoration: 'none',
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                            }}
                        >
                            View All
                            <ArrowUpRight size={11} strokeWidth={2.5} />
                        </Link>
                    </div>

                    {/* Quick Stats Row */}
                    {stats.total > 0 && (
                        <div style={{
                            display: 'flex',
                            gap: 8,
                            flexWrap: 'wrap'
                        }}>
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                padding: '4px 10px',
                                background: '#ffffff',
                                border: '1px solid #d9e6e9',
                                borderRadius: 12
                            }}>
                                <Package size={11} style={{ color: '#2563eb' }} strokeWidth={2.5} />
                                <span style={{ fontSize: 11, fontWeight: 800, color: '#2563eb' }}>
                                    {stats.total}
                                </span>
                                <span style={{ fontSize: 9, color: '#64748b', fontWeight: 600 }}>
                                    Products
                                </span>
                            </div>
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                padding: '4px 10px',
                                background: '#ffffff',
                                border: '1px solid #e2e8f0',
                                borderRadius: 12
                            }}>
                                <ShoppingBag size={11} style={{ color: '#10b981' }} strokeWidth={2.5} />
                                <span style={{ fontSize: 11, fontWeight: 800, color: '#10b981' }}>
                                    {formatNumber(stats.totalUnits)}
                                </span>
                                <span style={{ fontSize: 9, color: '#64748b', fontWeight: 600 }}>
                                    Units
                                </span>
                            </div>
                            {stats.totalRevenue > 0 && (
                                <div style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    padding: '4px 10px',
                                    background: '#ffffff',
                                    border: '1px solid #d9e6e9',
                                    borderRadius: 12
                                }}>
                                    <BarChart3 size={11} style={{ color: '#8b5cf6' }} strokeWidth={2.5} />
                                    <span style={{ fontSize: 11, fontWeight: 800, color: '#8b5cf6' }}>
                                        {formatCurrency(stats.totalRevenue)}
                                    </span>
                                    <span style={{ fontSize: 9, color: '#64748b', fontWeight: 600 }}>
                                        Revenue
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ═══════════════════════════════════════════════════
                    CONTROLS BAR (Search + Sort)
                ═══════════════════════════════════════════════════ */}
                {stats.total > 0 && (
                    <div style={{
                        padding: '10px 20px',
                        background: '#fafbfc',
                        borderBottom: '1px solid #d9e6e9',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap'
                    }}>
                        {/* Search */}
                        <div style={{
                            position: 'relative',
                            flex: 1,
                            minWidth: 140
                        }}>
                            <Search
                                size={12}
                                style={{
                                    position: 'absolute',
                                    left: 10,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: '#8c8e8f',
                                    pointerEvents: 'none'
                                }}
                            />
                            <input
                                type="text"
                                placeholder="Search ASIN, brand..."
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                className="asin-search-input"
                                style={{
                                    width: '100%',
                                    padding: '6px 10px 6px 30px',
                                    fontSize: 11,
                                    fontWeight: 500,
                                    color: '#0f172a',
                                    background: '#ffffff',
                                    outline: 'none'
                                }}
                            />
                        </div>

                        {/* Sort Toggle */}
                        <Segmented
                            value={sortBy}
                            onChange={setSortBy}
                            size="small"
                            options={[
                                {
                                    label: <Tooltip title="Sort by Units"><span style={{ fontSize: 10, fontWeight: 700 }}>Units</span></Tooltip>,
                                    value: 'units'
                                },
                                {
                                    label: <Tooltip title="Sort by Revenue"><span style={{ fontSize: 10, fontWeight: 700 }}>Revenue</span></Tooltip>,
                                    value: 'revenue'
                                }
                            ]}
                            style={{
                                background: '#f1f5f9'
                            }}
                        />
                    </div>
                )}

                {/* ═══════════════════════════════════════════════════
                    PRODUCT LIST
                ═══════════════════════════════════════════════════ */}
                <div
                    className="top-asins-scroll"
                    style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '14px 20px',
                        minHeight: 200
                    }}
                >
                    {sortedProducts.length === 0 ? (
                        <div style={{
                            padding: '40px 12px',
                            textAlign: 'center',
                            background: '#fafbfc',
                            border: '1px dashed #e2e8f0',
                            borderRadius: 12,
                            margin: 'auto'
                        }}>
                            <div style={{
                                width: 56,
                                height: 56,
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: 12,
                                border: '2px solid #fbbf24'
                            }}>
                                <Trophy size={24} style={{ color: '#d97706' }} strokeWidth={2.5} />
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                                {searchText ? 'No Products Found' : 'No Performance Data'}
                            </div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>
                                {searchText
                                    ? `Try different search keywords`
                                    : 'Top selling ASINs will appear here'}
                            </div>
                        </div>
                    ) : (
                        sortedProducts.map((product, idx) => (
                            <AsinRow
                                key={product.asin + idx}
                                product={product}
                                rank={idx + 1}
                                maxValue={maxValue}
                                sortBy={sortBy}
                            />
                        ))
                    )}
                </div>

                {/* ═══════════════════════════════════════════════════
                    FOOTER
                ═══════════════════════════════════════════════════ */}
                {stats.total > 0 && (
                    <div style={{
                        padding: '10px 20px',
                        background: '#fafbfc',
                        borderTop: '1px solid #d9e6e9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 8
                    }}>
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 10,
                            color: '#8c8e8f',
                            fontWeight: 600
                        }}>
                            <Eye size={10} strokeWidth={2.5} />
                            Showing {sortedProducts.length} {sortedProducts.length === 1 ? 'product' : 'products'}
                        </div>

                        {stats.topProduct && (
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                fontSize: 10,
                                fontWeight: 700,
                                color: '#d97706',
                                background: '#fffbeb',
                                padding: '3px 9px',
                                borderRadius: 12,
                                border: '1px solid #fde68a',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: 200
                            }}>
                                <Star size={10} strokeWidth={2.5} fill="#d97706" />
                                <span style={{
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }}>
                                    Top: {stats.topProduct.brand}
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </Card>
        </>
    );
};

export default memo(TopAsinsCard);