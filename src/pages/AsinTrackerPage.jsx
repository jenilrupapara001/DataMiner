import React, { useState, useEffect, useCallback } from 'react';
import DataTable from '../components/DataTable';
import KPICard from '../components/KPICard';
import { asinApi, marketSyncApi } from '../services/api';

import { PageLoader } from '@/components/application/loading-indicator/PageLoader';
import { LoadingIndicator } from '@/components/application/loading-indicator/loading-indicator';

// Generate 12-week history data
const generateHistoryData = (basePrice, baseBSR, baseRating, baseReviews) => {
  const history = [];
  const today = new Date();
  for (let i = 11; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - (i * 7));
    history.push({
      week: `W${52 - Math.floor((today - date) / (7 * 24 * 60 * 60 * 1000))}`,
      date: date.toISOString().split('T')[0],
      price: Math.round(basePrice * (1 + (Math.random() - 0.5) * 0.1)),
      bsr: Math.round(baseBSR * (1 + (Math.random() - 0.5) * 0.2)),
      rating: (baseRating + (Math.random() - 0.5) * 0.3).toFixed(1),
      reviews: Math.round(baseReviews + (11 - i) * Math.round(Math.random() * 20)),
    });
  }
  return history;
};

// Demo ASIN data with new fields
const demoAsinData = [
  {
    asin: 'B07XYZ123',
    sku: 'SKU-WE-001',
    title: 'Wireless Earbuds Pro with Active Noise Cancellation',
    category: 'Electronics',
    currentPrice: 2499,
    mrp: 3499,
    bsr: 1250,
    rating: 4.5,
    reviewCount: 1250,
    lqs: 85,
    buyBoxWin: true,
    soldBy: 'Cocoblu Retail',
    hasAplus: true,
    descLength: 520,
    imageCount: 8,
    discountPercentage: 28,
    availabilityStatus: 'In Stock',
    history: generateHistoryData(2499, 1250, 4.5, 1250)
  },
  {
    asin: 'B07ABC456',
    sku: 'SKU-SW-002',
    title: 'Smart Watch Elite Series 5 GPS',
    category: 'Electronics',
    currentPrice: 8999,
    mrp: 12999,
    bsr: 890,
    rating: 4.2,
    reviewCount: 890,
    lqs: 72,
    buyBoxWin: true,
    soldBy: 'Cocoblu Retail',
    hasAplus: true,
    descLength: 480,
    imageCount: 12,
    discountPercentage: 30,
    availabilityStatus: 'In Stock',
    history: generateHistoryData(8999, 890, 4.2, 890)
  },
  {
    asin: 'B07DEF789',
    sku: 'SKU-YM-003',
    title: 'Premium Yoga Mat Extra Wide Non-Slip',
    category: 'Sports',
    currentPrice: 1299,
    mrp: 1999,
    bsr: 3200,
    rating: 4.8,
    reviewCount: 2100,
    lqs: 92,
    buyBoxWin: false,
    soldBy: 'Fitness World India',
    hasAplus: true,
    descLength: 350,
    imageCount: 6,
    discountPercentage: 35,
    availabilityStatus: 'In Stock',
    history: generateHistoryData(1299, 3200, 4.8, 2100)
  },
  {
    asin: 'B07GHI012',
    sku: 'SKU-CM-004',
    title: 'Automatic Coffee Maker Deluxe 12-Cup',
    category: 'Home & Kitchen',
    currentPrice: 4599,
    mrp: 5999,
    bsr: 1560,
    rating: 4.3,
    reviewCount: 650,
    lqs: 68,
    buyBoxWin: true,
    soldBy: 'Cocoblu Retail',
    hasAplus: false,
    descLength: 620,
    imageCount: 10,
    discountPercentage: 23,
    availabilityStatus: 'In Stock',
    history: generateHistoryData(4599, 1560, 4.3, 650)
  },
  {
    asin: 'B07JKL345',
    sku: 'SKU-BS-005',
    title: 'Bluetooth Speaker Waterproof 360° Sound',
    category: 'Electronics',
    currentPrice: 1999,
    mrp: 2999,
    bsr: 2100,
    rating: 4.1,
    reviewCount: 1800,
    lqs: 75,
    buyBoxWin: true,
    soldBy: 'Cocoblu Retail',
    hasAplus: true,
    descLength: 410,
    imageCount: 9,
    discountPercentage: 33,
    availabilityStatus: 'In Stock',
    history: generateHistoryData(1999, 2100, 4.1, 1800)
  }
];

const AsinTrackerPage = () => {
  const [asins, setAsins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAsin, setSelectedAsin] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  // Single collapsible state for all dashboard content
  const [showDashboard, setShowDashboard] = useState(true);
  const [showTable, setShowTable] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Try to fetch from API
      let apiAsins = [];
      try {
        const response = await asinApi.getAll({ limit: 500 });
        apiAsins = response.asins || [];
      } catch (err) {
        console.warn('ASIN API not available, using demo data');
      }

      // Use demo data if API not available
      const data = apiAsins.length > 0 ? apiAsins : demoAsinData;
      setAsins(data);
    } catch (err) {
      console.error('Failed to load ASIN data:', err);
      setAsins(demoAsinData);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const kpis = [
    { title: 'Total ASINs', value: asins.length.toString(), icon: 'bi-box', trend: 5, trendType: 'positive' },
    { title: 'Avg LQS Score', value: Math.round(asins.reduce((sum, a) => sum + (a.lqs || 0), 0) / asins.length || 0), icon: 'bi-graph-up', trend: 3, trendType: 'positive' },
    { title: 'Buy Box Win Rate', value: Math.round((asins.filter(a => a.buyBoxWin).length / asins.length) * 100 || 0) + '%', icon: 'bi-trophy', trend: 2, trendType: 'positive' },
    { title: 'A+ Content', value: asins.filter(a => a.hasAplus).length.toString(), icon: 'bi-file-text', trend: 1, trendType: 'neutral' },
    { title: 'Avg Price', value: '₹' + Math.round(asins.reduce((sum, a) => sum + (a.currentPrice || 0), 0) / asins.length || 0).toLocaleString(), icon: 'bi-currency-rupee', trend: 0, trendType: 'neutral' },
    { title: 'Avg BSR', value: Math.round(asins.reduce((sum, a) => sum + (a.bsr || 0), 0) / asins.length || 0).toLocaleString(), icon: 'bi-bar-chart', trend: 0, trendType: 'neutral' },
  ];

  const handleViewDetails = (asin) => {
    setSelectedAsin(asin);
    setShowDetails(true);
  };

  const handleSync = async (asin) => {
    try {
      const response = await marketSyncApi.syncAsin(asin._id);
      alert(response.message || 'Sync initiated successfully');
      loadData();
    } catch (err) {
      console.error('Sync failed:', err);
      alert(err.message || 'Failed to initiate sync');
    }
  };

  const handleFetchResults = async () => {
    if (asins.length === 0) return;
    const sellerId = asins[0].seller?._id || asins[0].seller;
    if (!sellerId) return;

    try {
      const response = await marketSyncApi.fetchResults(sellerId);
      alert(response.message || 'Results fetched successfully');
      loadData();
    } catch (err) {
      console.error('Fetch results failed:', err);
      alert(err.message || 'Failed to fetch results');
    }
  };

  const getLqsBadge = (lqs) => {
    let className = 'bg-success';
    if (lqs < 60) className = 'bg-danger';
    else if (lqs < 80) className = 'bg-warning';
    return <span className={`badge ${className}`}>{lqs}</span>;
  };

  const getBuyBoxBadge = (buyBox) => {
    return buyBox
      ? <span className="badge bg-success"><i className="bi bi-check"></i> Yes</span>
      : <span className="badge bg-secondary"><i className="bi bi-x"></i> No</span>;
  };

  const getAplusBadge = (hasAplus) => {
    return hasAplus
      ? <span className="badge bg-success"><i className="bi bi-check"></i> Yes</span>
      : <span className="badge bg-secondary"><i className="bi bi-x"></i> No</span>;
  };

  const getRatingStars = (rating) => {
    const fullStars = Math.floor(rating);
    const hasHalf = rating % 1 >= 0.5;
    const stars = [];
    for (let i = 0; i < 5; i++) {
      if (i < fullStars) stars.push(<i key={i} className="bi bi-star-fill text-warning"></i>);
      else if (i === fullStars && hasHalf) stars.push(<i key={i} className="bi bi-star-half text-warning"></i>);
      else stars.push(<i key={i} className="bi bi-star text-muted"></i>);
    }
    return <span className="small">{stars} {rating}</span>;
  };

  const getPriceTrend = (history) => {
    if (!history || history.length < 2) return '-';
    const first = history[0].price;
    const last = history[history.length - 1].price;
    const diff = last - first;
    const percent = ((diff / first) * 100).toFixed(1);
    if (diff > 0) return <span className="text-success"><i className="bi bi-arrow-up"></i> {percent}%</span>;
    if (diff < 0) return <span className="text-danger"><i className="bi bi-arrow-down"></i> {Math.abs(percent)}%</span>;
    return <span className="text-muted"><i className="bi bi-dash"></i> 0%</span>;
  };

  const getBsrTrend = (history) => {
    if (!history || history.length < 2) return '-';
    const first = history[0].bsr;
    const last = history[history.length - 1].bsr;
    const diff = last - first;
    const percent = ((diff / first) * 100).toFixed(1);
    // Lower BSR is better, so opposite logic
    if (diff < 0) return <span className="text-success"><i className="bi bi-arrow-down"></i> {Math.abs(percent)}%</span>;
    if (diff > 0) return <span className="text-danger"><i className="bi bi-arrow-up"></i> {percent}%</span>;
    return <span className="text-muted"><i className="bi bi-dash"></i> 0%</span>;
  };

  // Collapsible section component
  const CollapsibleSection = ({ title, icon, isOpen, onToggle, badge, children }) => (
    <div className="card mb-4">
      <div
        className="card-header d-flex justify-content-between align-items-center"
        onClick={onToggle}
        style={{ cursor: 'pointer' }}
      >
        <h5 className="card-title mb-0">
          <i className={`${icon} me-2`}></i>
          {title}
          {badge !== undefined && badge !== null && <span className="badge bg-primary ms-2">{badge}</span>}
        </h5>
        <button className="btn btn-sm btn-outline-secondary">
          <i className={`bi ${isOpen ? 'bi-chevron-up' : 'bi-chevron-down'}`}></i>
        </button>
      </div>
      {isOpen && <div className="card-body">{children}</div>}
    </div>
  );

   if (loading && asins.length === 0) { return <PageLoader message="Loading Asin Tracker..." />; }

  return (
    <>
      <div className="page-header">
        <div className="d-flex justify-content-between align-items-center w-100">
          <h1 className="page-title"><i className="bi bi-upc-scan"></i>ASIN Tracker</h1>
          <button className="btn btn-outline-primary" onClick={handleFetchResults}>
            <i className="bi bi-cloud-download me-2"></i>Fetch Results
          </button>
        </div>
      </div>

       <div className="page-content">
         {loading && (
           <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}>
             <LoadingIndicator type="line-simple" size="md" />
           </div>
         )}
         {/* Single Collapsible Section containing KPIs and Performance Overview */}
        <CollapsibleSection
          title="ASIN Performance Overview"
          icon="bi bi-graph-up"
          isOpen={showDashboard}
          onToggle={() => setShowDashboard(!showDashboard)}
        >
          {/* KPI Cards */}
          <div className="kpi-grid mb-4">
            {kpis.map((kpi, idx) => (
              <KPICard key={idx} title={kpi.title} value={kpi.value} icon={kpi.icon} trend={kpi.trend} trendType={kpi.trendType} />
            ))}
          </div>

          {/* Performance Summary */}
          <div className="row mb-4">
            <div className="col-lg-6">
              <div className="card h-100">
                <div className="card-header">
                  <h6 className="mb-0"><i className="bi bi-currency-rupee me-2"></i>Price Summary</h6>
                </div>
                 <div className="card-body">
                   <p className="mb-2"><strong>Average Price:</strong> ₹{Math.round(asins.reduce((sum, a) => sum + (a.currentPrice || 0), 0) / asins.length).toLocaleString()}</p>
                   <p className="mb-2"><strong>Highest Price:</strong> ₹{Math.max(...asins.map(a => a.currentPrice || 0)).toLocaleString()}</p>
                   <p className="mb-0"><strong>Lowest Price:</strong> ₹{Math.min(...asins.map(a => a.currentPrice || 0)).toLocaleString()}</p>
                 </div>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="card h-100">
                <div className="card-header">
                  <h6 className="mb-0"><i className="bi bi-bar-chart me-2"></i>BSR Summary</h6>
                </div>
                <div className="card-body">
                  <p className="mb-2"><strong>Average BSR:</strong> #{Math.round(asins.reduce((sum, a) => sum + (a.bsr || 0), 0) / asins.length).toLocaleString()}</p>
                  <p className="mb-2"><strong>Best BSR:</strong> #{Math.min(...asins.map(a => a.bsr || 0)).toLocaleString()}</p>
                  <p className="mb-0"><strong>Lowest BSR:</strong> #{Math.max(...asins.map(a => a.bsr || 0)).toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        </CollapsibleSection>

        {/* Collapsible ASIN Table */}
        <CollapsibleSection
          title="ASIN Performance"
          icon="bi bi-table"
          isOpen={showTable}
          onToggle={() => setShowTable(!showTable)}
          badge={asins.length}
        >
           <DataTable
             data={asins}
             columns={['asin', 'sku', 'title', 'price', 'mrp', 'discountPercentage', 'soldBy', 'buyBoxWin', 'bsr', 'rating', 'reviewCount', 'lqs', 'hasAplus', 'availabilityStatus', 'priceTrend', 'bsrTrend']}
             searchable={true}
             sortable={true}
             pagination={true}
             pageSize={10}
             customRenderers={{
                 asin: (asin) => <span className="fw-bold text-primary">{asin.asin || asin.asinCode}</span>,
                 price: (asin) => <span className="fw-medium text-dark">{asin.currentPrice ? `₹${asin.currentPrice.toLocaleString()}` : '-'}</span>,
                 mrp: (asin) => <span className="text-muted text-decoration-line-through">{asin.mrp ? `₹${asin.mrp.toLocaleString()}` : '-'}</span>,
                 discountPercentage: (asin) => <span className="badge bg-danger bg-opacity-10 text-danger">{asin.discountPercentage ? `${asin.discountPercentage}% OFF` : '-'}</span>,
                 soldBy: (asin) => <span className="text-truncate d-inline-block" style={{ maxWidth: '120px' }}>{asin.soldBy || '-'}</span>,
                 buyBoxWin: (asin) => typeof asin.buyBoxWin !== 'undefined' ? getBuyBoxBadge(asin.buyBoxWin) : '-',
                 bsr: (asin) => <span className="fw-500">#{asin.bsr ? asin.bsr.toLocaleString() : '-'}</span>,
                 rating: (asin) => asin.rating ? getRatingStars(asin.rating) : '-',
                 reviewCount: (asin) => <span className="text-muted">{asin.reviewCount ? asin.reviewCount.toLocaleString() : '-'}</span>,
                 lqs: (asin) => asin.lqs ? getLqsBadge(asin.lqs) : '-',
                 hasAplus: (asin) => typeof asin.hasAplus !== 'undefined' ? getAplusBadge(asin.hasAplus) : '-',
                 availabilityStatus: (asin) => <span className={`badge ${asin.availabilityStatus?.toLowerCase().includes('in stock') ? 'bg-success' : 'bg-warning'} bg-opacity-10 text-dark`}>{asin.availabilityStatus || 'Available'}</span>,
                 priceTrend: (asin) => getPriceTrend(asin.history),
                 bsrTrend: (asin) => getBsrTrend(asin.history),
             }}
            actions={[
              { label: 'View', icon: 'bi-eye', className: 'btn-sm', onClick: handleViewDetails },
              { label: 'Sync', icon: 'bi-arrow-repeat', className: 'btn-sm btn-outline-primary', onClick: handleSync },
            ]}
          />
        </CollapsibleSection>

        {/* ASIN Details Modal */}
        {showDetails && selectedAsin && (
          <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-xl">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">ASIN Details: {selectedAsin.asin}</h5>
                  <button type="button" className="btn-close" onClick={() => setShowDetails(false)}></button>
                </div>
                <div className="modal-body">
                  <div className="row">
                    {/* Product Info */}
                    <div className="col-md-8">
                      <h6 className="fw-semibold">{selectedAsin.title}</h6>
                       <p className="text-muted mb-3">
                         <span className="badge bg-secondary me-2">{selectedAsin.category}</span>
                         <span className="badge bg-info me-2">SKU: {selectedAsin.sku}</span>
                         {getBuyBoxBadge(selectedAsin.buyBoxWin)}
                       </p>

                       <div className="row mb-3">
                         <div className="col-sm-6">
                           <small className="text-muted">Current Price</small>
                           <div className="fw-bold fs-5">₹{selectedAsin.currentPrice?.toLocaleString()}</div>
                         </div>
                         <div className="col-sm-6">
                           <small className="text-muted">Best Seller Rank</small>
                           <div className="fw-bold fs-5">#{selectedAsin.bsr?.toLocaleString()}</div>
                         </div>
                       </div>

                       <div className="row mb-3">
                         <div className="col-sm-6">
                           <small className="text-muted">Rating</small>
                           <div>{getRatingStars(selectedAsin.rating)}</div>
                         </div>
                         <div className="col-sm-6">
                           <small className="text-muted">Reviews</small>
                           <div className="fw-bold">{selectedAsin.reviewCount?.toLocaleString()}</div>
                         </div>
                       </div>

                      <div className="mb-3">
                        <small className="text-muted">LQS Score</small>
                        <div className="mt-1">{getLqsBadge(selectedAsin.lqs)}</div>
                      </div>
                    </div>

                    {/* Product Optimization */}
                    <div className="col-md-4">
                      <div className="card">
                        <div className="card-header">
                          <h6 className="mb-0">Product Optimization</h6>
                        </div>
                        <div className="card-body">
                          <div className="mb-3">
                            <small className="text-muted">A+ Content</small>
                            <div className="mt-1">{getAplusBadge(selectedAsin.hasAplus)}</div>
                          </div>
                          <div className="mb-3">
                            <small className="text-muted">Description Length</small>
                            <div className="fw-medium">{selectedAsin.descLength} characters</div>
                          </div>
                          <div className="mb-3">
                            <small className="text-muted">Image Count</small>
                            <div className="fw-medium">{selectedAsin.imageCount} images</div>
                          </div>
                           <div className="mb-3">
                             <small className="text-muted">Buy Box Status</small>
                             <div className="mt-1">{getBuyBoxBadge(selectedAsin.buyBoxWin)}</div>
                           </div>
                           <div className="mb-3">
                             <small className="text-muted">Buy Box Seller</small>
                             <div className="fw-medium text-primary">{selectedAsin.soldBy || 'Unknown'}</div>
                           </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Weekly History */}
                  <div className="mt-4">
                    <h6>Weekly History</h6>
                    <div className="table-responsive">
                      <table className="table table-sm table-bordered">
                        <thead>
                          <tr>
                            <th>Week</th>
                            <th>Date</th>
                            <th>Price</th>
                            <th>BSR</th>
                            <th>Rating</th>
                            <th>Reviews</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedAsin.history?.map((h, idx) => (
                            <tr key={idx}>
                              <td>{h.week}</td>
                              <td>{h.date}</td>
                              <td>₹{h.price?.toLocaleString()}</td>
                              <td>#{h.bsr?.toLocaleString()}</td>
                              <td>{h.rating}</td>
                              <td>{h.reviews?.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowDetails(false)}>Close</button>
                  <button type="button" className="btn btn-primary">Sync Data</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default AsinTrackerPage;
