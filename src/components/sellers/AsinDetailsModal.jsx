import React from 'react';
import { Package, Zap, Store, ExternalLink, CheckCircle2, AlertCircle, Tag as TagIcon, BarChart } from 'lucide-react';
import { Modal, Row, Col, Typography, Tag, Image, Space, Divider, Button, Statistic, Badge } from 'antd';

const { Title, Text } = Typography;

const AsinDetailsModal = ({ asin, onClose }) => {
  if (!asin) return null;

  // Calculate discount safely
  const discountPct = asin.currentPrice && asin.mrp ? Math.round((1 - asin.currentPrice / asin.mrp) * 100) : 0;

  return (
    <Modal
      open={!!asin}
      onCancel={onClose}
      footer={[
        <Button 
          key="close" 
          type="primary" 
          onClick={onClose}
          style={{ 
            backgroundColor: '#0f172a', 
            borderColor: '#0f172a', 
            borderRadius: '10px', 
            fontWeight: 700,
            padding: '0 24px',
            height: '40px',
            boxShadow: '0 4px 12px rgba(15, 23, 42, 0.2)'
          }}
        >
          Close Pipeline Intel
        </Button>
      ]}
      width={940}
      centered
      destroyOnHidden
      styles={{
        body: { padding: '20px 24px', backgroundColor: '#ffffff' },
        footer: { padding: '12px 24px', borderTop: '1px solid #f1f5f9', background: '#fff', margin: 0 }
      }}
      maskStyle={{
        backdropFilter: 'blur(6px)',
        backgroundColor: 'rgba(15, 23, 42, 0.3)'
      }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ padding: '8px', background: 'linear-gradient(135deg, #1e293b, #0f172a)', borderRadius: '10px', color: '#fff', display: 'flex' }}>
            <Package size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Text strong style={{ fontSize: '16px', color: '#0f172a', fontFamily: 'monospace', letterSpacing: '-0.02em' }}>
                {asin.asinCode}
              </Text>
              <Tag color={asin.status === 'Active' ? 'success' : 'default'} variant="filled" style={{ borderRadius: '6px', fontWeight: 700, fontSize: '10px', padding: '0 6px' }}>
                {asin.status?.toUpperCase() || 'INACTIVE'}
              </Tag>
              {asin.priceType === 'Deal Price' && (
                <Tag color="error" variant="filled" style={{ borderRadius: '6px', fontWeight: 700, fontSize: '10px', padding: '0 6px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                  <Zap size={10} fill="currentColor" /> DEAL
                </Tag>
              )}
            </div>
          </div>
        </div>
      }
    >
      <style>{`
        .ant-modal-content {
          border-radius: 20px !important;
          overflow: hidden !important;
          box-shadow: 0 20px 40px -8px rgba(0,0,0,0.12) !important;
        }
        .ant-modal-header {
          padding: 14px 24px !important;
          border-bottom: 1px solid #f1f5f9 !important;
          margin-bottom: 0 !important;
        }
        .dense-scrollbox::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .dense-scrollbox::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .dense-scrollbox::-webkit-scrollbar-track {
          background: transparent;
        }
        .sub-img-grid {
          width: 46px;
          height: 46px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
          background: #fff;
        }
        .sub-img-grid:hover {
          border-color: #4f46e5;
          transform: translateY(-2px);
        }
        .compact-kpi-container {
          display: flex;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 1px 2px rgba(0,0,0,0.02);
        }
        .compact-kpi-item {
          flex: 1;
          padding: 12px 16px;
          border-right: 1px solid #e2e8f0;
          transition: background 0.2s;
        }
        .compact-kpi-item:last-child {
          border-right: none;
        }
        .compact-kpi-item:hover {
          background: #fafafa;
        }
      `}</style>

      <Row gutter={[24, 24]}>
        {/* Sidebar Column (Left) */}
        <Col xs={24} md={8}>
          <div style={{ 
            background: '#f8fafc', 
            borderRadius: '16px', 
            padding: '16px', 
            border: '1px solid #f1f5f9',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            height: '100%'
          }}>
            {/* Main Image Box */}
            <div style={{ 
              padding: '12px', 
              background: '#fff', 
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '220px'
            }}>
              <Image.PreviewGroup>
                <Image
                  src={asin.mainImageUrl || asin.imageUrl || 'https://via.placeholder.com/400x400?text=No+Image'}
                  alt={asin.title}
                  style={{ maxHeight: '180px', objectFit: 'contain' }}
                  fallback="https://via.placeholder.com/400x400?text=No+Image"
                />
                
                {/* Dense Gallery Row */}
                {asin.images?.length > 0 && (
                  <div style={{ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: '6px', 
                    marginTop: '12px', 
                    justifyContent: 'center',
                    maxHeight: '60px',
                    overflowY: 'auto'
                  }} className="dense-scrollbox">
                    {asin.images.slice(0, 6).map((img, idx) => (
                      <div key={idx} className="sub-img-grid">
                        <Image src={img} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ))}
                  </div>
                )}
              </Image.PreviewGroup>
            </div>

            {/* Tech Specs Directory */}
            <div style={{ background: '#fff', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <Text type="secondary" style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '10px' }}>
                Catalog Directory
              </Text>
              <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text type="secondary" style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}><Store size={12} /> Sold By</Text>
                  <Text strong style={{ fontSize: '11px', color: '#334155', maxWidth: '130px' }} ellipsis>{asin.soldBy || 'N/A'}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text type="secondary" style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}><TagIcon size={12} /> Category</Text>
                  <Text strong style={{ fontSize: '11px', color: '#334155', maxWidth: '130px' }} ellipsis title={asin.category}>{asin.category || 'N/A'}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text type="secondary" style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}><Package size={12} /> Local SKU</Text>
                  <Text strong style={{ fontSize: '11px', color: '#334155', fontFamily: 'monospace' }}>{asin.sku || 'N/A'}</Text>
                </div>
              </Space>
            </div>

            {/* Dense Sentiment Block */}
            <div style={{ 
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', 
              borderRadius: '12px', 
              padding: '14px',
              color: '#fff'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <Text style={{ color: '#94a3b8', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Customer Feedback</Text>
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', background: 'rgba(250, 204, 21, 0.15)', color: '#facc15', padding: '2px 6px', borderRadius: '6px', fontSize: '11px', fontWeight: 800 }}>
                  <Zap size={10} fill="currentColor" /> {typeof asin.rating === 'number' ? asin.rating.toFixed(1) : (asin.rating || '0.0')}
                </div>
              </div>
              <Text strong style={{ color: '#ffffff', fontSize: '16px', display: 'block', lineHeight: 1 }}>
                {asin.reviewCount?.toLocaleString() || '0'} Reviews
              </Text>
            </div>
          </div>
        </Col>

        {/* Content Column (Right) */}
        <Col xs={24} md={16}>
          <Space orientation="vertical" size={18} style={{ width: '100%' }}>
            
            {/* Title Block */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <Tag color={asin.titleLength > 150 ? 'success' : 'warning'} variant="filled" style={{ fontWeight: 700, fontSize: '10px', borderRadius: '4px' }}>
                  {asin.titleLength || 0} CHARS
                </Tag>
                <Button 
                  type="link" 
                  size="small" 
                  icon={<ExternalLink size={12} />}
                  href={asin.pageUrl || (asin.marketplace === 'ajio' ? `https://www.ajio.com/p/${asin.asinCode}` : asin.marketplace === 'myntra' ? `https://www.myntra.com` : `https://amazon.in/dp/${asin.asinCode}`)}
                  target="_blank"
                  style={{ padding: 0, fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', height: 'auto' }}
                >
                  Open Marketplace
                </Button>
              </div>
              <Title level={5} style={{ margin: 0, fontWeight: 700, color: '#1e293b', fontSize: '14px', lineHeight: 1.4 }}>
                {asin.title || 'Listing title pending ingestion...'}
              </Title>
            </div>

            {/* Integrated Segmented KPI Container */}
            <div className="compact-kpi-container">
              <div className="compact-kpi-item">
                <Statistic
                  title={<Text type="secondary" style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pricing</Text>}
                  value={asin.currentPrice || 0}
                  prefix="₹"
                  styles={{ content: { color: '#0f172a', fontWeight: 800, fontSize: '16px', lineHeight: 1.2 } }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                  {discountPct > 0 && (
                    <>
                      <Text type="secondary" delete style={{ fontSize: '10px' }}>₹{asin.mrp || 0}</Text>
                      <span style={{ color: '#10b981', fontWeight: 700, fontSize: '10px' }}>-{discountPct}%</span>
                    </>
                  )}
                </div>
              </div>
              
              <div className="compact-kpi-item">
                <Statistic
                  title={<Text type="secondary" style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>BSR Rank</Text>}
                  value={asin.bsr || 0}
                  formatter={(val) => `#${val?.toLocaleString() || '—'}`}
                  styles={{ content: { color: '#4f46e5', fontWeight: 800, fontSize: '16px', lineHeight: 1.2 } }}
                />
                <Text type="secondary" style={{ fontSize: '10px', display: 'block', marginTop: '2px' }}>Category Tier</Text>
              </div>

              <div className="compact-kpi-item">
                <Statistic
                  title={<Text type="secondary" style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Stock Levels</Text>}
                  value={asin.stockLevel || 0}
                  styles={{ content: { color: (asin.stockLevel || 0) > 10 ? '#10b981' : '#ef4444', fontWeight: 800, fontSize: '16px', lineHeight: 1.2 } }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                  <Badge status={(asin.stockLevel || 0) > 10 ? 'success' : 'error'} />
                  <Text type="secondary" style={{ fontSize: '10px' }}>Units</Text>
                </div>
              </div>
            </div>

            {/* Compact Sub BSR Layout */}
            {asin.subBSRs?.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px' }}>
                  <BarChart size={11} style={{ color: '#64748b' }} />
                  <Text type="secondary" style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sub-Category Segments</Text>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {asin.subBSRs.map((rank, idx) => (
                    <Tag key={idx} variant="filled" style={{ 
                      background: '#f1f5f9', 
                      padding: '2px 8px', 
                      borderRadius: '6px',
                      fontWeight: 600,
                      fontSize: '10px',
                      color: '#475569',
                      margin: 0
                    }}>
                      {rank}
                    </Tag>
                  ))}
                </div>
              </div>
            )}

            {/* Highly Compact Feature Bullet Points Box */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <Text type="secondary" style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Enhanced Bullets</Text>
                <Text type="secondary" style={{ fontSize: '10px', fontWeight: 600, color: '#94a3b8' }}>{asin.bulletPointsList?.length || 0} Total</Text>
              </div>
              <div 
                style={{ 
                  maxHeight: '180px', 
                  overflowY: 'auto', 
                  background: '#f8fafc', 
                  border: '1px solid #e2e8f0', 
                  borderRadius: '12px', 
                  padding: '12px' 
                }} 
                className="dense-scrollbox"
              >
                {asin.bulletPointsList?.length > 0 ? (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {asin.bulletPointsList.map((point, idx) => (
                      <li key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <CheckCircle2 size={12} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
                        <Text style={{ color: '#475569', fontSize: '11px', lineHeight: 1.4 }}>{point}</Text>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div style={{ textAlign: 'center', padding: '16px 0', color: '#94a3b8' }}>
                    <AlertCircle size={16} style={{ marginBottom: '4px' }} />
                    <Text type="secondary" style={{ display: 'block', fontSize: '11px', fontStyle: 'italic' }}>No structured bullet descriptions available.</Text>
                  </div>
                )}
              </div>
            </div>

          </Space>
        </Col>
      </Row>

    </Modal>
  );
};

export default React.memo(AsinDetailsModal);
