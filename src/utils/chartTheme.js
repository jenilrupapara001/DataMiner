/**
 * Shared ApexCharts configuration for RetailOps
 * Provides consistent theming across all charts
 */

// 8-color palette in order
export const CHART_COLORS = [
    '#1B4FD8', // Blue - primary brand
    '#059669', // Green - success/positive
    '#D97706', // Amber - warning/neutral
    '#7C3AED', // Purple - accent
    '#0891B2', // Cyan - accent
    '#DC2626', // Red - danger/negative
    '#0284C7', // Sky blue - accent
    '#65A30D'  // Lime - accent
];

// Base configuration applied to all charts
export const defaultApexOptions = {
    fontFamily: 'Calibri, system-ui, sans-serif',
    foreColor: '#475569', // var(--color-text-secondary) equivalent
    toolbar: {
        show: false // Remove ApexCharts toolbar from all charts
    },
    grid: {
        borderColor: '#E2E8F0',
        strokeDashArray: 3
    },
    tooltip: {
        theme: 'light',
        style: {
            fontSize: '13px'
        }
    },
    animations: {
        enabled: true,
        speed: 400,
        easing: 'easeout'
    }
};

/**
 * Shallow merge helper for ApexCharts options
 * @param {Object} overrides - Options to override defaults
 * @returns {Object} - Merged options
 */
export const mergeApexOptions = (overrides = {}) => {
    return {
        ...defaultApexOptions,
        ...overrides,
        grid: {
            ...defaultApexOptions.grid,
            ...(overrides.grid || {})
        },
        tooltip: {
            ...defaultApexOptions.tooltip,
            ...(overrides.tooltip || {})
        },
        animations: {
            ...defaultApexOptions.animations,
            ...(overrides.animations || {})
        }
    };
};

/**
 * Preset config for all pie/donut charts
 * @param {Object} labels - Labels for the pie/donut segments
 * @returns {Object} - Configured options
 */
export const pieDonutOptions = (labels = {}) => {
    return mergeApexOptions({
        chart: {
            type: 'donut'
        },
        labels: Object.values(labels),
        colors: CHART_COLORS.slice(0, Object.keys(labels).length || 6),
        legend: {
            position: 'bottom',
            fontSize: '13px',
            markers: {
                radius: 3
            }
        },
        plotOptions: {
            pie: {
                donut: {
                    labels: {
                        show: true,
                        name: {
                            fontSize: '14px',
                            fontWeight: 600
                        },
                        value: {
                            fontSize: '16px',
                            fontWeight: 700,
                            formatter: (val) => val
                        },
                        total: {
                            show: true,
                            label: 'Total',
                            fontSize: '13px',
                            fontWeight: 500,
                            formatter: (w) => {
                                return w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                            }
                        }
                    }
                }
            }
        },
        dataLabels: {
            enabled: false
        },
        stroke: {
            width: 2
        }
    });
};

/**
 * Preset config for area/line charts with gradient fill
 * @param {Function} yFormatter - Optional formatter for Y-axis values
 * @returns {Object} - Configured options
 */
export const areaChartOptions = (yFormatter = null) => {
    return mergeApexOptions({
        chart: {
            type: 'area',
            toolbar: {
                show: false
            }
        },
        colors: CHART_COLORS,
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.4,
                opacityTo: 0.1,
                stops: [0, 90, 100]
            }
        },
        stroke: {
            curve: 'smooth',
            width: 2
        },
        xaxis: {
            labels: {
                style: {
                    fontSize: '12px'
                }
            },
            axisBorder: {
                show: false
            },
            axisTicks: {
                show: false
            }
        },
        yaxis: {
            labels: {
                style: {
                    fontSize: '12px'
                },
                formatter: yFormatter || ((val) => val)
            }
        },
        legend: {
            position: 'top',
            horizontalAlign: 'right',
            floating: true,
            offsetY: -10,
            fontSize: '12px',
            markers: {
                radius: 3
            }
        },
        dataLabels: {
            enabled: false
        }
    });
};

export default {
    CHART_COLORS,
    defaultApexOptions,
    mergeApexOptions,
    pieDonutOptions,
    areaChartOptions
};
