import React from 'react';
import { Package, Zap, MoreHorizontal, CheckCircle2, AlertCircle, Store, ExternalLink } from 'lucide-react';

const AsinDetailsModal = ({ asin, onClose }) => {
  if (!asin) return null;

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(9, 9, 11, 0.8)', backdropFilter: 'blur(8px)', zIndex: 1100 }}>
      <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content border-0 shadow-2xl overflow-hidden" style={{ borderRadius: '24px', backgroundColor: '#fff' }}>

          {/* Header */}
          <div className="px-5 py-4 border-bottom border-zinc-100 d-flex justify-content-between align-items-center bg-white sticky-top">
            <div className="d-flex align-items-center gap-4">
              <div className="p-3 bg-zinc-900 rounded-4 shadow-xl border border-zinc-800 rotate-hover">
                <Package size={28} className="text-white" />
              </div>
              <div>
                <div className="d-flex align-items-center gap-3 mb-1">
                  <h3 className="fw-black text-zinc-900 mb-0 tracking-tight" style={{ fontSize: '24px' }}>{asin.asinCode}</h3>
                  <span className={`badge rounded-pill ${asin.status === 'Active' ? 'bg-success-subtle text-success' : 'bg-zinc-100 text-zinc-500'} px-2 py-1`}>
                    {asin.status}
                  </span>
                  {asin.priceType === 'Deal Price' && (
                    <span className="badge rounded-pill bg-danger-subtle text-danger border border-danger-subtle px-2 py-1">
                      <Zap size={10} className="me-1" /> DEAL
                    </span>
                  )}
                </div>
                <div className="text-muted smallest fw-semibold uppercase tracking-wider d-flex align-items-center gap-2">
                  <span>{asin.category || 'Uncategorized'}</span>
                  <span className="opacity-30">•</span>
                  <span>SKU: {asin.sku || 'N/A'}</span>
                </div>
              </div>
            </div>
            <button className="btn btn-icon btn-light rounded-circle" onClick={onClose}>
              <MoreHorizontal size={20} />
            </button>
          </div>

          <div className="modal-body p-0">
            <div className="row g-0">

              {/* Left Column: Visuals & Gallery */}
              <div className="col-lg-5 p-4 border-end border-zinc-100 bg-white">
                <div className="position-relative mb-4 bg-zinc-50 rounded-4 p-4 border border-zinc-100 overflow-hidden text-center">
                  <img
                    src={asin.mainImageUrl || asin.imageUrl || 'https://via.placeholder.com/400x400?text=No+Image'}
                    alt={asin.title}
                    className="img-fluid rounded-3"
                    style={{ maxHeight: '350px', objectFit: 'contain' }}
                  />
                  <div className="position-absolute top-0 end-0 p-3">
                    <div className="bg-white/80 backdrop-blur rounded-pill px-3 py-1 border border-zinc-200 shadow-sm smallest fw-bold">
                      {asin.images?.length || 0} Images
                    </div>
                  </div>
                </div>

                {/* Gallery Grid */}
                {asin.images?.length > 0 && (
                  <div className="row g-2">
                    {asin.images.slice(0, 8).map((img, idx) => (
                      <div key={idx} className="col-3">
                        <div className="ratio ratio-1x1 bg-zinc-50 rounded-3 border border-zinc-100 overflow-hidden cursor-pointer hover-scale transition-all">
                          <img src={img} alt={`Gallery ${idx}`} style={{ objectFit: 'cover' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Rating Summary */}
                <div className="mt-5 p-4 bg-zinc-900 rounded-4 text-white shadow-lg">
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <div className="smallest fw-bold uppercase opacity-60">Customer Sentiment</div>
                    <div className="d-flex align-items-center gap-1">
                      <div className="text-warning"><Zap size={14} fill="currentColor" /></div>
                      <span className="fw-black">
                        {typeof asin.rating === 'number' ? asin.rating.toFixed(1) : (asin.rating || '0.0')}
                      </span>
                    </div>
                  </div>
                  <div className="h4 fw-bold mb-1">{asin.reviewCount?.toLocaleString() || '0'} Reviews</div>
                  <div className="smallest opacity-80">Based on global marketplace feedback</div>
                </div>
              </div>

              {/* Right Column: Intelligence & Data */}
              <div className="col-lg-7 p-4 bg-zinc-50/30">

                {/* Title Section */}
                <div className="mb-5">
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <label className="smallest fw-bold uppercase text-muted tracking-widest">Product Title</label>
                    <span className={`badge rounded-pill ${asin.titleLength > 150 ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning'} px-2 fw-bold`}>
                      {asin.titleLength || 0} Chars
                    </span>
                  </div>
                  <h5 className="lh-base text-zinc-900 fw-bold">{asin.title || 'Product title not yet synced.'}</h5>
                </div>

                {/* KPI Grid */}
                <div className="row g-3 mb-5">
                  <div className="col-md-4">
                    <div className="bg-white p-4 rounded-4 shadow-sm border border-zinc-100 h-100">
                      <div className="smallest fw-bold uppercase text-muted mb-2">Pricing Intel</div>
                      <div className="d-flex align-items-end gap-2 mb-1">
                        <div className="h3 fw-black text-zinc-900 mb-0">₹{asin.currentPrice?.toLocaleString() || '0'}</div>
                        <div className="text-muted text-decoration-line-through mb-1">₹{asin.mrp?.toLocaleString() || '0'}</div>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <span className="smallest fw-bold text-success">
                          {asin.currentPrice && asin.mrp ? Math.round((1 - asin.currentPrice / asin.mrp) * 100) : 0}% Off
                        </span>
                        <span className="opacity-20">•</span>
                        <span className="smallest fw-medium text-muted">{asin.priceType || 'Standard'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="bg-white p-4 rounded-4 shadow-sm border border-zinc-100 h-100">
                      <div className="smallest fw-bold uppercase text-muted mb-2">Core Visibility</div>
                      <div className="h3 fw-black text-primary mb-0">#{asin.bsr?.toLocaleString() || '---'}</div>
                      <div className="smallest fw-medium text-muted mt-1">Main Category BSR</div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="bg-white p-4 rounded-4 shadow-sm border border-zinc-100 h-100">
                      <div className="smallest fw-bold uppercase text-muted mb-2">Stock Inventory</div>
                      <div className={`h3 fw-black mb-0 ${asin.stockLevel > 10 ? 'text-success' : 'text-danger'}`}>
                        {asin.stockLevel || 0}
                      </div>
                      <div className="smallest fw-medium text-muted mt-1">Units Available</div>
                    </div>
                  </div>
                </div>

                {/* Sub BSRs */}
                {asin.subBSRs?.length > 0 && (
                  <div className="mb-5">
                    <label className="smallest fw-bold uppercase text-muted tracking-widest mb-3 d-block">Sub-Category Ranks</label>
                    <div className="d-flex flex-wrap gap-2">
                      {asin.subBSRs.map((rank, idx) => (
                        <div key={idx} className="bg-white border border-zinc-200 rounded-pill px-3 py-1 smallest fw-bold shadow-sm d-flex align-items-center gap-2">
                          <div className="bg-primary rounded-circle" style={{ width: '6px', height: '6px' }}></div>
                          {rank}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bullet Points */}
                <div className="mb-5">
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <label className="smallest fw-bold uppercase text-muted tracking-widest">Enhanced bullet points</label>
                    <span className="smallest fw-black text-zinc-400">{asin.bulletPointsList?.length || 0} Points</span>
                  </div>
                  <div className="bg-white rounded-4 border border-zinc-100 p-4 shadow-sm">
                    {asin.bulletPointsList?.length > 0 ? (
                      <ul className="list-unstyled mb-0 d-flex flex-column gap-3">
                        {asin.bulletPointsList.map((point, idx) => (
                          <li key={idx} className="d-flex gap-3">
                            <div className="flex-shrink-0 mt-1">
                              <CheckCircle2 size={16} className="text-success" />
                            </div>
                            <span className="smallest fw-medium text-zinc-600 lh-sm">{point}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-center py-3">
                        <AlertCircle size={24} className="text-zinc-200 mb-2" />
                        <div className="smallest text-muted italic">No bullet points extracted yet.</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Secondary Intel */}
                <div className="row g-4">
                  <div className="col-md-6">
                    <div className="d-flex align-items-center gap-3">
                      <div className="p-2 bg-zinc-100 rounded-3"><Store size={18} className="text-zinc-600" /></div>
                      <div>
                        <div className="smallest fw-bold text-muted uppercase">Sold By</div>
                        <div className="fw-bold text-zinc-900">{asin.soldBy || 'Unknown Seller'}</div>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6 text-end">
                    <a href={asin.pageUrl || (asin.marketplace === 'ajio' ? `https://www.ajio.com/p/${asin.asinCode}` : asin.marketplace === 'myntra' ? `https://www.myntra.com` : `https://amazon.in/dp/${asin.asinCode}`)} target="_blank" rel="noreferrer" className="btn btn-white btn-sm rounded-pill border border-zinc-200 shadow-sm px-4 fw-bold text-zinc-700">
                      View Live <ExternalLink size={14} className="ms-1" />
                    </a>
                  </div>
                </div>

              </div>
            </div>
          </div>

          <div className="modal-footer border-0 p-4 bg-zinc-50/50">
            <button className="btn btn-zinc-900 rounded-pill px-5 py-2 fw-black shadow-xl" onClick={onClose} style={{ backgroundColor: '#18181B', color: '#fff' }}>
              Close Pipeline Intel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(AsinDetailsModal);
