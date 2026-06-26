import React from 'react';
import * as LucideIcons from 'lucide-react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const KPICard = ({ title, value, icon, trend, trendType = 'neutral', subtitle = 'vs last month', color }) => {
  const IconComponent = LucideIcons[icon] || LucideIcons.Activity;

  // Use design system colors: primary #1976D2, success #2E7D32, error #D32F2F
  const cardColor = color || '#1976D2';

  const getTrendConfig = () => {
    if (trendType === 'positive') return { icon: TrendingUp, bg: '#E8F5E9', textColor: '#2E7D32', borderColor: '#A5D6A7' };
    if (trendType === 'negative') return { icon: TrendingDown, bg: '#FFEBEE', textColor: '#D32F2F', borderColor: '#EF9A9A' };
    return { icon: Minus, bg: '#F1F5F9', textColor: '#64748B', borderColor: '#CBD5E1' };
  };

  const trendConfig = getTrendConfig();
  const TrendIcon = trendConfig.icon;

  return (
    <div className="kpi-card" style={{
      borderRadius: 12,
      background: '#FFFFFF',
      border: '1px solid #E5E7EB',
      overflow: 'hidden',
      transition: 'all 0.2s ease',
    }}>
      <div style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: `${cardColor}12`, color: cardColor,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <IconComponent size={20} strokeWidth={2} />
          </div>
          {trend !== undefined && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 3,
              padding: '3px 8px', borderRadius: 6,
              background: trendConfig.bg, color: trendConfig.textColor,
              border: `1px solid ${trendConfig.borderColor}`,
              fontSize: 11, fontWeight: 700,
            }}>
              <TrendIcon size={12} strokeWidth={3} />
              {trend}%
            </div>
          )}
        </div>

        <div>
          <div style={{
            fontSize: 10, fontWeight: 700, color: '#64748B',
            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4,
          }}>{title}</div>
          <div style={{
            fontSize: 24, fontWeight: 800, color: '#111827',
            letterSpacing: '-0.02em', lineHeight: 1.1,
          }}>{value}</div>
          {subtitle && (
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{subtitle}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KPICard;
