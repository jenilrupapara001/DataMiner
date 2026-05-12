import React from 'react';
import { motion } from 'framer-motion';

export const DashboardMotionWrapper = ({ children }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {children}
    </motion.div>
  );
};

export const StatCard = ({ label, value, trend, trendType, icon: Icon, index }) => {
  const isPositive = trendType === 'positive';
  const isNegative = trendType === 'negative';
  const accentColor = isPositive ? '#10b981' : isNegative ? '#ef4444' : '#4f46e5';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, type: 'spring', stiffness: 100 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      style={{
        backgroundColor: '#fff',
        borderRadius: '20px',
        padding: '24px',
        border: '1px solid #f3f4f6',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.01)',
        position: 'relative',
        overflow: 'hidden',
        height: '100%'
      }}
    >
      {/* Subtle decorative blob */}
      <div style={{
        position: 'absolute',
        top: '-20px',
        right: '-20px',
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        background: `radial-gradient(circle, ${accentColor}10 0%, transparent 70%)`,
        zIndex: 0
      }} />

      <div className="d-flex justify-content-between align-items-start relative z-10">
        <div style={{
          backgroundColor: `${accentColor}12`,
          color: accentColor,
          padding: '10px',
          borderRadius: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Icon size={22} strokeWidth={2} />
        </div>

        {trend && (
          <div style={{
            backgroundColor: isPositive ? '#ecfdf5' : isNegative ? '#fef2f2' : '#f3f4f6',
            color: isPositive ? '#059669' : isNegative ? '#dc2626' : '#4b5563',
            padding: '4px 8px',
            borderRadius: '100px',
            fontSize: '11px',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            {isPositive ? '↑' : isNegative ? '↓' : '→'} {trend}%
          </div>
        )}
      </div>

      <div className="mt-3 pt-1 relative z-10">
        <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '600', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
          {label}
        </div>
        <div style={{ fontSize: '28px', fontWeight: '800', color: '#111827', letterSpacing: '-0.02em', marginTop: '4px' }}>
          {value}
        </div>
      </div>
    </motion.div>
  );
};
