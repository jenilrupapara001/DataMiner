import React from 'react';
import Card from '../common/Card';
import { Activity, AlertTriangle, ShoppingBag, TrendingUp, Info } from 'lucide-react';

const IntelligenceFeed = ({ insights, loading }) => {
  const getInsightIcon = (type) => {
    switch (type) {
      case 'STOCK': return <ShoppingBag size={14} className="text-danger" />;
      case 'ADS': return <TrendingUp size={14} className="text-primary" />;
      case 'OPPORTUNITY': return <AlertTriangle size={14} className="text-warning" />;
      default: return <Info size={14} className="text-muted" />;
    }
  };

  return (
    <Card title="Growth Operating System INTEL" icon={Activity}>
      <div className="d-flex flex-column gap-2" style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {loading ? (
          <div className="placeholder-glow">
            {[1, 2, 3].map((i) => (
              <div key={i} className="placeholder col-12 mb-2 rounded" style={{ height: '50px' }}></div>
            ))}
          </div>
        ) : insights && insights.length > 0 ? (
          insights.map((insight, idx) => (
            <div 
              key={idx} 
              className="live-alert-item p-2 rounded-2 border d-flex gap-3"
              style={{ backgroundColor: 'var(--color-surface-1)', borderColor: 'var(--color-border)' }}
            >
              <div 
                className="d-flex align-items-center justify-content-center mt-1"
                style={{ 
                  width: '24px', 
                  height: '24px', 
                  borderRadius: 'var(--radius-full)', 
                  backgroundColor: 'white',
                  border: '1px solid var(--color-border)'
                }}
              >
                {getInsightIcon(insight.type)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{insight.message}</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  {insight.type} • {new Date(insight.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-5 text-muted smaller">Intelligence feed is quiet for now.</div>
        )}
      </div>
    </Card>
  );
};

export default IntelligenceFeed;
