import React from 'react';

const Card = ({ 
  title, 
  subtitle, 
  icon: Icon, 
  extra, 
  children, 
  className = '', 
  padding = 'var(--spacing-lg)',
  height = '100%',
  noHeader = false
}) => {
  return (
    <div 
      className={`card-base ${className}`} 
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height,
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--border-radius)',
        overflow: 'hidden'
      }}
    >
      {!noHeader && (title || Icon || extra) && (
        <div 
          className="card-header" 
          style={{ 
            padding: 'var(--spacing-md) var(--spacing-lg)',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            minHeight: '48px'
          }}
        >
          <div className="d-flex align-items-center gap-2">
            {Icon && <Icon size={16} className="text-secondary" style={{ color: 'var(--text-secondary)' }} />}
            <div>
              {title && (
                <h6 
                  className="mb-0" 
                  style={{ 
                    fontSize: 'var(--font-size-sm)', 
                    fontWeight: 600, 
                    color: 'var(--text-primary)',
                    textTransform: 'none',
                    letterSpacing: 'normal'
                  }}
                >
                  {title}
                </h6>
              )}
              {subtitle && (
                <p 
                  className="mb-0 text-muted" 
                  style={{ 
                    fontSize: 'var(--font-size-xs)', 
                    marginTop: '2px' 
                  }}
                >
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {extra && <div className="card-extra">{extra}</div>}
        </div>
      )}
      <div 
        className="card-body" 
        style={{ 
          padding, 
          flex: 1,
          overflow: 'auto'
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default Card;
