import React from 'react';
import { 
  Row, 
  Col, 
  Card, 
  Typography, 
  ConfigProvider, 
  theme 
} from 'antd';
import { motion } from 'framer-motion';
import { RetailOpsWordmark } from '../common/BrandLogo';

const { Title, Text, Paragraph } = Typography;

const AuthLayout = ({ 
  children, 
  heroTitle, 
  heroSubtitle, 
  features = [],
  footerText = "RetailOps. Enterprise Commerce Intelligence."
}) => {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#0145f2',
          colorInfo: '#0145f2',
          borderRadius: 12,
          fontFamily: "'Inter', sans-serif",
          colorBgContainer: '#ffffff',
          colorText: '#09090B',
          colorTextDescription: '#52525B',
          colorLink: '#0145f2',
          colorLinkHover: '#0070F3',
        },
        components: {
          Button: {
            controlHeight: 48,
            fontSize: 14,
            fontWeight: 600,
            borderRadius: 8,
            colorPrimary: '#0f172a',
            colorPrimaryHover: '#1e293b',
          },
          Input: {
            controlHeight: 48,
            borderRadius: 8,
            colorBgContainer: '#ffffff',
            activeBorderColor: '#0145f2',
            colorText: '#09090B',
            colorTextPlaceholder: '#A1A1AA',
          },
          Checkbox: {
            colorPrimary: '#0145f2',
            colorText: '#52525B',
          }
        }
      }}
    >
      <div style={{
        minHeight: '100vh',
        background: '#f9fafb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Subtle dot-grid lines background */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: 'radial-gradient(rgba(9, 9, 11, 0.02) 1.5px, transparent 0)',
          backgroundSize: '28px 28px',
          zIndex: 0,
          opacity: 0.8
        }} />

        {/* Floating Decorative Elements (Light/Lavender square outlines matching user image) */}
        <div style={{
          position: 'absolute',
          top: '15%',
          left: '18%',
          width: 200,
          height: 200,
          borderRadius: 24,
          background: 'rgba(99, 102, 241, 0.04)',
          border: '2px dashed rgba(99, 102, 241, 0.1)',
          transform: 'rotate(-15deg)',
          pointerEvents: 'none',
          zIndex: 0,
          animation: 'pulse-slow 8s ease-in-out infinite'
        }} />
        <div style={{
          position: 'absolute',
          bottom: '12%',
          right: '18%',
          width: 240,
          height: 240,
          borderRadius: 32,
          background: 'rgba(1, 69, 242, 0.03)',
          border: '2px dashed rgba(1, 69, 242, 0.08)',
          transform: 'rotate(20deg)',
          pointerEvents: 'none',
          zIndex: 0,
          animation: 'pulse-slow-reverse 10s ease-in-out infinite'
        }} />

        {/* Animated Noise/Grain Overlay */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0.015,
          backgroundImage: 'url("https://grainy-gradients.vercel.app/noise.svg")',
          pointerEvents: 'none',
          zIndex: 1
        }} />

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={{ zIndex: 2, width: '100%', maxWidth: 460 }}
        >
          <Card
            variant="borderless"
            styles={{ body: { padding: '40px 36px' } }}
            style={{
              borderRadius: 16,
              overflow: 'hidden',
              boxShadow: '0 20px 50px -12px rgba(9, 9, 11, 0.08), 0 0 0 1px rgba(9, 9, 11, 0.04)',
              background: '#ffffff',
              border: '1px solid #e4e4e7',
            }}
          >
            {/* Header Brand Logo */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
              <div style={{
                padding: '8px 12px',
                borderRadius: 10,
                background: '#f4f4f5',
                border: '1px solid #e4e4e7',
                display: 'inline-block'
              }}>
                <RetailOpsWordmark size={24} color="#09090B" />
              </div>
            </div>

            {children}

            <div style={{ 
              marginTop: 28, 
              textAlign: 'center', 
              color: '#a1a1aa', 
              fontSize: 12, 
              fontWeight: 500, 
              letterSpacing: '0.02em' 
            }}>
              &copy; 2026 {footerText}
            </div>
          </Card>
        </motion.div>
      </div>

      <style>{`
        @keyframes pulse-slow {
          0%, 100% { transform: rotate(-15deg) scale(1); opacity: 0.8; }
          50% { transform: rotate(-10deg) scale(1.03); opacity: 1; }
        }
        @keyframes pulse-slow-reverse {
          0%, 100% { transform: rotate(20deg) scale(1); opacity: 0.7; }
          50% { transform: rotate(25deg) scale(0.97); opacity: 0.9; }
        }

        .ant-btn-primary {
            background: #0f172a !important;
            border: none !important;
            box-shadow: 0 4px 12px 0 rgba(15, 23, 42, 0.12) !important;
            transition: all 0.2s ease !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
        }
        .ant-btn-primary:hover {
            background: #1e293b !important;
            transform: translateY(-1px);
            box-shadow: 0 6px 16px rgba(15, 23, 42, 0.2) !important;
        }
        .ant-input-affix-wrapper {
            padding-left: 14px !important;
            padding-right: 14px !important;
            transition: all 0.2s ease !important;
            border: 1px solid #e4e4e7 !important;
            background: #ffffff !important;
        }
        .ant-input-affix-wrapper-focused {
            border-color: #0145f2 !important;
            box-shadow: 0 0 0 3px rgba(1, 69, 242, 0.1) !important;
            background: #ffffff !important;
        }
        .ant-form-item-label label {
            color: #3f3f46 !important;
            font-weight: 600 !important;
            font-size: 13px !important;
            text-transform: none !important;
            letter-spacing: normal !important;
            margin-bottom: 2px !important;
        }
      `}</style>
    </ConfigProvider>
  );
};

export default AuthLayout;
