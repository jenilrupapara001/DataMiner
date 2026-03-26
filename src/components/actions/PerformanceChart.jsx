import React from 'react';
import Card from '../common/Card';
import Chart from 'react-apexcharts';
import { TrendingUp } from 'lucide-react';
import { CHART_COLORS } from '../../utils/chartTheme';

const PerformanceChart = ({ chartData, loading }) => {
  const options = {
    chart: {
      type: 'area',
      toolbar: { show: false },
      sparkline: { enabled: false },
    },
    stroke: { curve: 'smooth', width: 2 },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.4,
        opacityTo: 0.05,
        stops: [0, 90, 100]
      }
    },
    xaxis: {
      categories: chartData?.labels || [],
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { style: { colors: '#64748b', fontSize: '10px' } }
    },
    yaxis: {
      labels: {
        style: { colors: '#64748b', fontSize: '10px' },
        formatter: (val) => val >= 1000 ? `₹${(val / 1000).toFixed(1)}K` : `₹${val}`
      }
    },
    grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
    legend: {
      show: true,
      position: 'top',
      horizontalAlign: 'right',
      fontSize: '11px',
      fontWeight: 600,
    },
    colors: [CHART_COLORS[0], CHART_COLORS[1]], // Plan (Blue), Actual (Purple/Orange)
    tooltip: {
      theme: 'light',
      y: {
        formatter: (val) => `₹${val.toLocaleString()}`
      }
    }
  };

  const series = [
    { name: 'Target Baseline', data: chartData?.targetData || [] },
    { name: 'Actual Performance', data: chartData?.actualData || [] }
  ];

  return (
    <Card 
      title="Performance Trajectory" 
      icon={TrendingUp}
      subtitle="Actual Sales vs Strategic Growth Target"
    >
      <div style={{ minHeight: '300px' }}>
        {loading ? (
          <div className="d-flex align-items-center justify-content-center h-100 py-5">
            <div className="spinner-border spinner-border-sm text-primary"></div>
          </div>
        ) : (
          <Chart options={options} series={series} type="area" height={300} />
        )}
      </div>
    </Card>
  );
};

export default PerformanceChart;
