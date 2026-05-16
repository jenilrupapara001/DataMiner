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
          colorPrimary: '#1C1917',
          colorInfo: '#CA8A04',
          borderRadius: 16,
          fontFamily: "'DM Sans', sans-serif",
          colorBgContainer: '#ffffff',
          colorLink: '#CA8A04',
          colorLinkHover: '#A16207',
        },
        components: {
          Button: {
            controlHeight: 52,
            fontSize: 16,
            fontWeight: 700,
            borderRadius: 12,
            colorPrimary: '#1C1917',
            colorPrimaryHover: '#2d2a28',
          },
          Input: {
            controlHeight: 48,
            borderRadius: 12,
            colorBgContainer: '#FAFAF9',
            activeBorderColor: '#CA8A04',
          },
          Checkbox: {
            colorPrimary: '#CA8A04',
          }
        }
      }}
    >
      <div style={{
        minHeight: '100vh',
        background: '#0c0a09',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Advanced Mesh Background */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `
            radial-gradient(circle at 10% 10%, rgba(202, 138, 4, 0.08) 0%, transparent 40%),
            radial-gradient(circle at 90% 10%, rgba(28, 25, 23, 0.4) 0%, transparent 50%),
            radial-gradient(circle at 50% 90%, rgba(202, 138, 4, 0.05) 0%, transparent 40%),
            radial-gradient(circle at 80% 80%, rgba(68, 64, 60, 0.2) 0%, transparent 50%)
          `,
          zIndex: 0
        }} />
        
        {/* Animated Noise/Grain Overlay */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0.03,
          backgroundImage: 'url("https://grainy-gradients.vercel.app/noise.svg")',
          pointerEvents: 'none',
          zIndex: 1
        }} />

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          style={{ zIndex: 2, width: '100%', maxWidth: 1200 }}
        >
          <Card
            variant="borderless"
            styles={{ body: { padding: 0 } }}
            style={{
              borderRadius: 32,
              overflow: 'hidden',
              boxShadow: '0 40px 100px -20px rgba(0, 0, 0, 0.8)',
              background: 'rgba(255, 255, 255, 0.01)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(24px)'
            }}
          >
            <Row align="stretch" style={{ minHeight: 720 }}>
              {/* Left Panel: High-Impact Visuals */}
              <Col xs={0} md={11} lg={12} style={{
                background: '#0c0a09',
                padding: '80px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
                color: '#FAFAF9',
                borderRight: '1px solid rgba(255, 255, 255, 0.05)',
                overflow: 'hidden'
              }}>
                {/* Visual Accent */}
                <div style={{
                    position: 'absolute',
                    top: '-10%',
                    right: '-10%',
                    width: '60%',
                    height: '60%',
                    background: 'radial-gradient(circle, rgba(202, 138, 4, 0.15) 0%, transparent 70%)',
                    filter: 'blur(60px)',
                    zIndex: 0
                }} />

                <div style={{ zIndex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ 
                        width: 40, 
                        height: 40, 
                        background: '#CA8A04', 
                        borderRadius: 10, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        boxShadow: '0 0 20px rgba(202, 138, 4, 0.3)'
                    }}>
                        <RetailOpsWordmark size={24} color="#0c0a09" style={{ filter: 'brightness(0)' }} />
                    </div>
                    <Text style={{ color: '#fff', fontSize: 18, fontWeight: 800, letterSpacing: '-0.03em' }}>RetailOps<span style={{ color: '#CA8A04' }}>.</span></Text>
                  </div>
                  
                  <div style={{ marginTop: 80 }}>
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      <Title level={1} style={{ 
                        color: '#FAFAF9', 
                        fontSize: '3.2rem', 
                        fontWeight: 800, 
                        lineHeight: 1, 
                        marginBottom: 24,
                        letterSpacing: '-0.04em'
                      }}>
                        {heroTitle.split(' ').map((word, i) => (
                            <span key={i} style={{ display: 'inline-block', marginRight: '0.3em' }}>{word}</span>
                        ))}
                      </Title>
                      <Paragraph style={{ 
                        color: '#A8A29E', 
                        fontSize: '1.2rem', 
                        lineHeight: 1.6,
                        marginBottom: 60,
                        maxWidth: '90%',
                        fontWeight: 400
                      }}>
                        {heroSubtitle}
                      </Paragraph>
                    </motion.div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                      {features.map((feature, index) => (
                        <motion.div 
                          key={index}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.5 + (index * 0.1) }}
                          style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}
                        >
                          <div style={{
                            width: 44,
                            height: 44,
                            borderRadius: 14,
                            background: 'rgba(255, 255, 255, 0.03)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 20,
                            color: '#CA8A04',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.05)'
                          }}>
                            {feature.icon}
                          </div>
                          <div style={{ paddingTop: 4 }}>
                            <Text strong style={{ color: '#FAFAF9', fontSize: 16, display: 'block', marginBottom: 2 }}>{feature.title}</Text>
                            <Text style={{ color: '#78716C', fontSize: 14 }}>{feature.desc}</Text>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ zIndex: 1, color: '#57534E', fontSize: 13, fontWeight: 600, letterSpacing: '0.02em' }}>
                  &copy; 2026 {footerText}
                </div>
              </Col>

              {/* Right Panel: The Gateway */}
              <Col xs={24} md={13} lg={12} style={{
                padding: '80px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                background: '#FAFAF9',
                position: 'relative'
              }}>
                <div style={{ maxWidth: 420, width: '100%', margin: '0 auto' }}>
                  {children}
                </div>
              </Col>
            </Row>
          </Card>
        </motion.div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;800&display=swap');
        
        .ant-btn-primary {
            box-shadow: 0 4px 14px 0 rgba(28, 25, 23, 0.3) !important;
            transition: all 0.3s ease !important;
        }
        .ant-btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(28, 25, 23, 0.4) !important;
        }
        .ant-input-affix-wrapper {
            padding-left: 16px !important;
            padding-right: 16px !important;
            transition: all 0.3s ease !important;
            border: 1.5px solid #E7E5E4 !important;
        }
        .ant-input-affix-wrapper-focused {
            border-color: #CA8A04 !important;
            box-shadow: 0 0 0 4px rgba(202, 138, 4, 0.1) !important;
            background: #fff !important;
        }
        .ant-form-item-label label {
            color: #44403C !important;
            font-weight: 700 !important;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 4px !important;
        }
      `}</style>
    </ConfigProvider>
  );
};

export default AuthLayout;
