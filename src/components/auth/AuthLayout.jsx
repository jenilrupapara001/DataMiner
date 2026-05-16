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
  footerText = "RetailOps. Built for Scale."
}) => {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#18181b',
          borderRadius: 12,
          fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
          colorBgContainer: '#ffffff',
        },
        components: {
          Button: {
            controlHeight: 48,
            fontSize: 15,
            fontWeight: 600,
            borderRadius: 10,
          },
          Input: {
            controlHeight: 45,
            borderRadius: 10,
            colorBgContainer: '#f8fafc',
          },
          Checkbox: {
            colorPrimary: '#18181b',
          }
        }
      }}
    >
      <div style={{
        minHeight: '100vh',
        background: '#0a0a0a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Dynamic Background */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at 20% 20%, rgba(59, 130, 246, 0.15) 0%, transparent 40%), radial-gradient(circle at 80% 80%, rgba(147, 51, 234, 0.15) 0%, transparent 40%)',
          zIndex: 0
        }} />
        
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          zIndex: 0
        }} />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          style={{ zIndex: 1, width: '100%', maxWidth: 1100 }}
        >
          <Card
            bordered={false}
            styles={{ body: { padding: 0 } }}
            style={{
              borderRadius: 24,
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)'
            }}
          >
            <Row align="stretch" style={{ minHeight: 680 }}>
              {/* Left Panel: Hero */}
              <Col xs={0} md={11} lg={12} style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #020617 100%)',
                padding: '60px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
                color: '#fff',
                borderRight: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <div style={{ zIndex: 1 }}>
                  <div style={{ filter: 'brightness(0) invert(1)', opacity: 0.9 }}>
                    <RetailOpsWordmark size={36} />
                  </div>
                  
                  <div style={{ marginTop: 60 }}>
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      <Title level={1} style={{ 
                        color: '#fff', 
                        fontSize: '2.8rem', 
                        fontWeight: 800, 
                        lineHeight: 1.1, 
                        marginBottom: 16,
                        letterSpacing: '-0.02em'
                      }}>
                        {heroTitle}
                      </Title>
                      <Text style={{ 
                        color: 'rgba(255, 255, 255, 0.5)', 
                        fontSize: '1.1rem', 
                        display: 'block', 
                        marginBottom: 48,
                        maxWidth: '90%'
                      }}>
                        {heroSubtitle}
                      </Text>
                    </motion.div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                      {features.map((feature, index) => (
                        <motion.div 
                          key={index}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 + (index * 0.1) }}
                          style={{ display: 'flex', gap: 16, alignItems: 'center' }}
                        >
                          <div style={{
                            width: 40,
                            height: 40,
                            borderRadius: 12,
                            background: 'rgba(255, 255, 255, 0.05)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 18,
                            color: '#3b82f6',
                            border: '1px solid rgba(255, 255, 255, 0.1)'
                          }}>
                            {feature.icon}
                          </div>
                          <div>
                            <Text strong style={{ color: '#fff', fontSize: 15, display: 'block' }}>{feature.title}</Text>
                            <Text style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: 13 }}>{feature.desc}</Text>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ zIndex: 1, color: 'rgba(255, 255, 255, 0.3)', fontSize: 12, fontWeight: 500 }}>
                  &copy; 2026 {footerText}
                </div>
              </Col>

              {/* Right Panel: Content */}
              <Col xs={24} md={13} lg={12} style={{
                padding: '60px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                background: '#ffffff'
              }}>
                <div style={{ maxWidth: 380, width: '100%', margin: '0 auto' }}>
                  {children}
                </div>
              </Col>
            </Row>
          </Card>
        </motion.div>
      </div>
    </ConfigProvider>
  );
};

export default AuthLayout;
