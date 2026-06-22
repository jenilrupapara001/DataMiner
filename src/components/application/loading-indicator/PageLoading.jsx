import React from 'react';
import { LoadingIndicator } from './loading-indicator';

const PageLoading = ({ message = 'Loading...', subMessage = '' }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flex: 1, background: '#f4f5f7', minHeight: 'calc(100vh - 60px)'
  }}>
    <div style={{
      background: '#ffffff', padding: '40px 48px', borderRadius: 12,
      border: '1px solid #e5e7eb', textAlign: 'center', maxWidth: 380,
      boxShadow: '0 4px 12px rgba(0,0,0,0.04)'
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 10,
        background: '#fb4f400D', display: 'inline-flex',
        alignItems: 'center', justifyContent: 'center', marginBottom: 16
      }}>
        <div style={{
          width: 24, height: 24, borderRadius: '50%',
          border: '3px solid #fb4f4020', borderTopColor: '#fb4f40',
          animation: 'pageLoadingSpin 0.8s linear infinite'
        }} />
      </div>
      <p style={{ fontSize: 14, fontWeight: 600, color: '#121b1e', marginBottom: 4 }}>
        {message}
      </p>
      {subMessage && (
        <p style={{ fontSize: 12, color: '#8c8e8f', fontWeight: 500, marginBottom: 16 }}>
          {subMessage}
        </p>
      )}
      {!subMessage && <div style={{ marginBottom: 16 }} />}
      <LoadingIndicator type="line-simple" size="md" />
    </div>
    <style>{`
      @keyframes pageLoadingSpin {
        to { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

export default PageLoading;
