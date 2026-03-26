import React from 'react';
import NumberChart from '../common/NumberChart';
import { TrendingUp, Target, ShoppingBag, Zap } from 'lucide-react';

const GoalControlCenter = ({ goalData, loading }) => {
  if (loading) {
    return (
      <div className="row g-3 mb-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="col-md-4">
            <div className="glass-card p-3 h-100 placeholder-glow" style={{ borderRadius: '16px', minHeight: '120px' }}>
              <div className="placeholder col-6 mb-2"></div>
              <div className="placeholder col-8"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const gmsValue = goalData ? `₹${(goalData.actual / 1000).toFixed(1)}K / ₹${(goalData.target / 1000).toFixed(1)}K` : '₹0 / ₹0';
  const gmsProgress = goalData ? Math.round((goalData.actual / goalData.target) * 100) : 0;

  return (
    <div className="row g-3 mb-4">
      <div className="col-md-4">
        <NumberChart
          label="GMS Achievement"
          value={gmsValue}
          icon={TrendingUp}
          delta={gmsProgress}
          deltaType={gmsProgress >= 100 ? 'positive' : 'neutral'}
          subtitle={goalData?.status || 'ON TRACK'}
          color="var(--color-brand-600)"
        />
      </div>
      <div className="col-md-4">
        <NumberChart
          label="Daily RR Required"
          value={`₹${goalData?.dailyRequiredRR?.toLocaleString() || '0'}`}
          icon={Zap}
          subtitle="Target to stay on track"
          color="#f59e0b"
        />
      </div>
      <div className="col-md-4">
        <NumberChart
          label="Gap to Target"
          value={`₹${(goalData?.gapToTarget / 1000).toFixed(1)}K`}
          icon={Target}
          subtitle={`By ${new Date(goalData?.targetDate).toLocaleDateString()}`}
          color="#ef4444"
        />
      </div>
    </div>
  );
};

export default GoalControlCenter;
