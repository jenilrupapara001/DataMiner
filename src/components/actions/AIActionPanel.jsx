import React from 'react';
import Card from '../common/Card';
import { Sparkles, ArrowRight, TrendingUp, AlertTriangle, Zap } from 'lucide-react';

const AIActionPanel = ({ suggestions, loading }) => {
  return (
    <Card 
      title="Strategic Growth Intelligence" 
      icon={Sparkles}
      extra={<span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-0.5 rounded-pill smallest">AI POWERED</span>}
    >
      <div className="d-flex flex-column gap-2" style={{ minHeight: '300px' }}>
        {loading ? (
          <div className="placeholder-glow">
            {[1, 2, 3].map((i) => (
              <div key={i} className="placeholder col-12 mb-3 rounded" style={{ height: '60px' }}></div>
            ))}
          </div>
        ) : suggestions && suggestions.length > 0 ? (
          suggestions.map((suggestion, idx) => (
            <div 
              key={idx} 
              className="live-alert-item p-3 rounded-2 border"
              style={{ 
                backgroundColor: 'var(--color-surface-1)', 
                borderColor: 'var(--color-border)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)'
              }}
            >
              <div className="d-flex justify-content-between align-items-start mb-2">
                <div className="d-flex align-items-center gap-2">
                  <div 
                    className="p-1.5 rounded-circle d-flex align-items-center justify-content-center"
                    style={{ 
                      backgroundColor: suggestion.type === 'STOCK' ? '#fef2f2' : suggestion.type === 'ADS' ? '#eff6ff' : '#f0fdf4',
                      color: suggestion.type === 'STOCK' ? '#ef4444' : suggestion.type === 'ADS' ? '#3b82f6' : '#10b981'
                    }}
                  >
                    {suggestion.type === 'STOCK' ? <AlertTriangle size={14} /> : suggestion.type === 'ADS' ? <TrendingUp size={14} /> : <Zap size={14} />}
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{suggestion.title}</span>
                </div>
                <span className="badge rounded-pill bg-light text-dark border smallest">+{suggestion.impactWeight}% IMPACT</span>
              </div>
              <p className="text-muted smallest mb-2">{suggestion.reasoning}</p>
              <div className="d-flex justify-content-between align-items-center">
                <span className="smallest text-uppercase fw-bold tracking-wider" style={{ color: 'var(--color-brand-600)' }}>{suggestion.actionType}</span>
                <button className="btn btn-link p-0 smallest text-decoration-none d-flex align-items-center gap-1 fw-semibold">
                  Execute Action <ArrowRight size={12} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="d-flex flex-column align-items-center justify-content-center h-100 py-5 text-muted">
            <Sparkles size={32} className="mb-3 opacity-20" />
            <p className="small">No strategic suggestions found. Sync data to trigger AI.</p>
          </div>
        )}
      </div>
    </Card>
  );
};

export default AIActionPanel;
