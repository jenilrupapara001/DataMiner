import React from 'react';
import Chart from 'react-apexcharts';
import { X, Package, TrendingUp, TrendingDown, IndianRupee, Star, MessageSquare, Award, Store, Tag } from 'lucide-react';

const AsinDetailModal = ({ asin, isOpen, onClose }) => {
  if (!isOpen || !asin) return null;

  // Prepare data for Price Chart
  const history = asin.history || asin.weekHistory || [];
  const priceSeries = [{
    name: 'Price',
    data: history.map(h => h.price || null)
  }];

  const priceOptions = {
    chart: {
      id: 'price-chart',
      toolbar: { show: false },
      zoom: { enabled: false }
    },
    colors: ['#2563eb'],
    stroke: { curve: 'smooth', width: 3 },
    xaxis: {
      categories: history.map(h => h.date || h.week || ''),
      labels: { style: { fontSize: '10px' } }
    },
    yaxis: {
      title: { text: 'Price (₹)', style: { fontWeight: 600 } },
      labels: { formatter: (val) => val ? `₹${val.toLocaleString()}` : '' }
    },
    markers: { size: 4 },
    tooltip: { y: { formatter: (val) => val ? `₹${val.toLocaleString()}` : 'N/A' } }
  };

  // Prepare data for BSR Chart
  const bsrSeries = [{
    name: 'Main BSR',
    data: history.map(h => h.bsr || null)
  }];

  // Handle Sub-BSRs if they exist in a chartable format
  // For demo/simplicity, we'll just show the main BSR for now, 
  // but let's check if we can extract sub-BSR values
  const hasSubBsrHistory = history.some(h => h.subBSRs && h.subBSRs.length > 0);
  
  if (hasSubBsrHistory) {
    // Assuming we want to track the FIRST sub-BSR category over time
    // Extracting numeric value from strings like "8,078 in Men's Shirts"
    const extractRank = (str) => {
      if (typeof str !== 'string') return typeof str === 'number' ? str : 0;
      const match = str.match(/#?([0-9,]+)/);
      return match ? parseInt(match[1].replace(/,/g, '')) : 0;
    };

    // We'll group sub-BSRs by category name if possible, 
    // but for a single chart, let's just take the first sub-BSR of each record
    bsrSeries.push({
      name: 'Sub BSR',
      data: history.map(h => h.subBSRs && h.subBSRs.length > 0 ? extractRank(h.subBSRs[0]) : 0)
    });
  }

  const bsrOptions = {
    chart: {
      id: 'bsr-chart',
      toolbar: { show: false },
      zoom: { enabled: false }
    },
    colors: ['#10b981', '#f59e0b'],
    stroke: { curve: 'smooth', width: 3 },
    xaxis: {
      categories: history.map(h => h.date || h.week || ''),
      labels: { style: { fontSize: '10px' } }
    },
    yaxis: {
      reversed: true, // Lower BSR is better
      title: { text: 'Rank (BSR)', style: { fontWeight: 600 } },
      labels: { formatter: (val) => `#${val}` }
    },
    markers: { size: 4 },
    tooltip: { y: { formatter: (val) => `#${val.toLocaleString()}` } }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 border-b d-flex justify-content-between align-items-center bg-zinc-50">
          <div className="d-flex align-items-center gap-3">
            <div className="p-2 bg-primary-subtle text-primary rounded-lg">
              <Package size={20} />
            </div>
            <div>
              <h5 className="mb-0 fw-bold">{asin.asinCode || asin.asin}</h5>
              <p className="text-muted smallest mb-0">{asin.category || 'ASIN Analysis'}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="btn btn-link text-zinc-400 p-0 hover:text-zinc-900 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto">
          <div className="row g-4 mb-4">
            {/* Left Col: Info */}
            <div className="col-lg-4">
              <div className="p-4 border rounded-xl h-100 bg-zinc-50/50">
                <div className="mb-4 text-center">
                  <div className="asin-image-container mx-auto mb-3" style={{ width: '120px', height: '120px', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden', backgroundColor: '#fff' }}>
                    {asin.imageUrl ? (
                      <img src={asin.imageUrl} alt={asin.asinCode} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    ) : (
                      <div className="d-flex align-items-center justify-content-center h-100 text-zinc-300">
                        <Package size={48} />
                      </div>
                    )}
                  </div>
                  <h6 className="fw-bold mb-1 text-truncate-2 px-2" style={{ fontSize: '0.9rem', lineHeight: '1.4' }}>{asin.title}</h6>
                  <span className="badge bg-zinc-100 text-zinc-500 rounded-pill font-mono">{asin.asinCode}</span>
                </div>

                <div className="d-grid gap-2">
                  <div className="d-flex justify-content-between p-2 border-bottom">
                    <span className="text-zinc-500 small">Current Price</span>
                    <div className="text-end">
                      <span className="fw-bold text-zinc-900 d-block">₹{asin.currentPrice?.toLocaleString()}</span>
                      {asin.mrp > asin.currentPrice && (
                        <span className="text-muted smallest text-decoration-line-through">₹{asin.mrp.toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  {asin.mrp > asin.currentPrice && (
                    <div className="d-flex justify-content-between p-2 border-bottom bg-danger-subtle/20 rounded">
                      <span className="text-danger small fw-bold">Discount</span>
                      <span className="badge bg-danger rounded-pill">-{Math.round(((asin.mrp - asin.currentPrice) / asin.mrp) * 100)}% OFF</span>
                    </div>
                  )}
                  <div className="d-flex justify-content-between p-2 border-bottom">
                    <span className="text-zinc-500 small">Buy Box Seller</span>
                    <span className="fw-bold text-primary d-flex align-items-center gap-1">
                      <Store size={14} />
                      {asin.soldBy || 'Amazon.in'}
                    </span>
                  </div>
                  <div className="d-flex justify-content-between p-2 border-bottom">
                    <span className="text-zinc-500 small">Main BSR</span>
                    <span className="fw-bold text-primary">#{asin.bsr?.toLocaleString()}</span>
                  </div>
                  <div className="d-flex justify-content-between p-2 border-bottom">
                    <span className="text-zinc-500 small">Rating</span>
                    <span className="d-flex align-items-center gap-1 fw-bold">
                      <Star size={14} className="text-warning fill-warning" />
                      {asin.rating || 0}
                    </span>
                  </div>
                  <div className="d-flex justify-content-between p-2 border-bottom">
                    <span className="text-zinc-500 small">Reviews</span>
                    <span className="fw-bold">{asin.reviewCount?.toLocaleString() || 0}</span>
                  </div>
                </div>

                {asin.subBSRs && asin.subBSRs.length > 0 && (
                  <div className="mt-4">
                    <h6 className="small fw-bold text-zinc-900 mb-2">Category Rankings</h6>
                    <div className="d-flex flex-column gap-2">
                      {asin.subBSRs.map((sub, idx) => (
                        <div key={idx} className="p-2 border rounded bg-white smallest text-muted">
                          {sub}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Col: Charts */}
            <div className="col-lg-8">
              <div className="row g-4">
                <div className="col-12">
                  <div className="p-4 border rounded-xl bg-white shadow-sm">
                    <div className="d-flex justify-content-between align-items-center mb-4">
                      <h6 className="fw-bold mb-0 d-flex align-items-center gap-2">
                        <IndianRupee size={16} className="text-primary" />
                        Price History
                      </h6>
                      <div className="text-zinc-500 smallest">Last {history.length} snapshots</div>
                    </div>
                    <div style={{ height: '240px' }}>
                      <Chart options={priceOptions} series={priceSeries} type="area" height="100%" />
                    </div>
                  </div>
                </div>
                <div className="col-12">
                  <div className="p-4 border rounded-xl bg-white shadow-sm">
                    <div className="d-flex justify-content-between align-items-center mb-4">
                      <h6 className="fw-bold mb-0 d-flex align-items-center gap-2">
                        <Award size={16} className="text-success" />
                        Best Sellers Rank Trend
                      </h6>
                      <div className="text-zinc-500 smallest">Interactive View</div>
                    </div>
                    <div style={{ height: '240px' }}>
                      <Chart options={bsrOptions} series={bsrSeries} type="line" height="100%" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-3 border-top bg-zinc-50 d-flex justify-content-end">
          <button onClick={onClose} className="btn btn-zinc-900 fw-bold px-4" style={{ backgroundColor: '#18181B', color: '#fff' }}>
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};

export default AsinDetailModal;
