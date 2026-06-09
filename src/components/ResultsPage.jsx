import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { calculateProfits, fetchKeepaData } from '../services/engine';
import {
  Download, Trash2, Edit2, RefreshCw,
  Calculator, Search, Eye, RotateCcw, ChevronRight,
  ChevronLeft
} from 'lucide-react';
import ProductDetailsModal from './ProductDetailsModal';
import ReturnPercentageModal from './ReturnPercentageModal';

const ResultsPage = ({ asins, onNavigate }) => {
  const [isFetching, setIsFetching] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedItem, setSelectedItem] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);

  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  useEffect(() => { setPage(1); }, [filterCategory, searchTerm]);

  const handleFetch = async (force) => {
    setIsFetching(true);
    try {
      await fetchKeepaData(asins, force);
      const updatedAsins = await db.getAsins();
      onNavigate('results');
    } catch (e) {
      console.error('Fetch error:', e);
      alert("Error occurred during data fetch. Please check your API key and try again.");
    } finally {
      setIsFetching(false);
    }
  };

  const handleCalculate = async () => {
    setIsCalculating(true);
    try {
      const currentAsins = await db.getAsins();
      await calculateProfits(currentAsins);
      const updatedAsins = await db.getAsins();
      onNavigate('results');
    } catch (e) {
      console.error('Calculation error:', e);
      alert("Error occurred during calculation. Please try again.");
    } finally {
      setIsCalculating(false);
    }
  };

  const handleExport = () => {
    try {
      const headers = ['ASIN', 'Title', 'Category', 'Price (INR)', 'Weight (g)', 'Referral Fee (INR)', 'Closing Fee (INR)', 'Shipping (INR)', 'Storage (INR)', 'GST (INR)', 'Total Fees (INR)', 'Net Profit (INR)', 'Margin (%)', 'Return %', 'STEP Level', 'Return Fee (INR)'];
      const rows = asins.map(a => [
        a.asin, `"${a.title?.replace(/"/g, '""')}"`, a.category, a.price || 0, a.weight || 0,
        a.referralFee || 0, a.closingFee || 0, (a.shippingFee || 0) + (a.pickAndPackFee || 0), a.storageFee || 0, a.tax || 0,
        a.totalFees || 0, a.netRevenue || 0, a.marginPercent || 0, a.returnPercent || 0, a.stepLevel || '-', a.returnFee || 0
      ]);
      const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
      const link = document.createElement("a");
      link.setAttribute("href", encodeURI(csvContent));
      link.setAttribute("download", `fba_profitability_export.csv`);
      document.body.appendChild(link);
      link.click();
    } catch (e) {
      console.error('Export error:', e);
      alert("Error occurred during export. Please try again.");
    }
  };

  const handleViewDetails = (item) => {
    setSelectedItem(item);
    setShowDetailsModal(true);
  };

  const handleDeleteItem = async (item) => {
    if (confirm(`Are you sure you want to delete ${item.asin}?`)) {
      try {
        await db.deleteAsin(item.id);
        const updatedAsins = await db.getAsins();
        onNavigate('results');
      } catch (error) {
        console.error('Error deleting item:', error);
        alert('Failed to delete item');
      }
    }
  };

  const handleEditReturnPercentage = (item) => {
    setSelectedItem(item);
    setShowReturnModal(true);
  };

  const handleSaveReturnPercentage = async (item, returnPercent, stepLevel) => {
    try {
      await db.updateAsin(item.id, { returnPercent, stepLevel });
      const updatedAsins = await db.getAsins();
      await calculateProfits(updatedAsins);
      onNavigate('results');
    } catch (error) {
      console.error('Error updating return percentage:', error);
      alert('Failed to update return percentage');
    }
  };

  const filtered = asins.filter(a =>
    (a.asin.toLowerCase().includes(searchTerm.toLowerCase()) || a.title?.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (filterCategory ? a.category === filterCategory : true)
  );

  const categories = Array.from(new Set(asins.map(a => a.category).filter(Boolean)));

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const displayedItems = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const getStatusBadge = (status) => {
    const statusMap = {
      'pending': { class: 'badge-secondary', label: 'Pending' },
      'calculated': { class: 'badge-success', label: 'Calculated' },
      'error': { class: 'badge-danger', label: 'Error' },
      'processing': { class: 'badge-primary', label: 'Processing' },
    };
    const { class: className, label } = statusMap[status] || { class: 'badge-secondary', label: status };
    return <span className={`badge ${className}`}>{label}</span>;
  };

  return (
    <div>
      {/* Filters */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="row g-3 align-items-end">
            <div className="col-lg-4">
              <label className="form-label">Search</label>
              <div className="input-group">
                <span className="input-group-text"><i className="bi bi-search"></i></span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search ASIN or title..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="col-lg-3">
              <label className="form-label">Category</label>
              <select
                className="form-select"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="col-lg-5 d-flex flex-wrap gap-2 justify-content-lg-end">
              <button
                className="btn btn-outline-secondary"
                onClick={() => handleFetch(false)}
                disabled={isFetching || isCalculating}
              >
                <i className="bi bi-arrow-repeat me-1"></i>
                Fetch
              </button>

              <button
                className="btn btn-outline-secondary"
                onClick={() => handleFetch(true)}
                disabled={isFetching || isCalculating}
                title="Force refresh"
              >
                <i className="bi bi-arrow-counterclockwise"></i>
              </button>

              <button
                className="btn btn-outline-success"
                onClick={handleExport}
              >
                <i className="bi bi-download me-1"></i>
                Export
              </button>

              <button
                className="btn btn-primary"
                onClick={handleCalculate}
                disabled={isFetching || isCalculating}
              >
                {isCalculating ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-1"></span>
                    Calculating...
                  </>
                ) : (
                  <>
                    <i className="bi bi-calculator me-1"></i>
                    Calculate
                  </>
                )}
              </button>

              <button
                className="btn btn-danger"
                onClick={() => confirm('Clear all?') && onNavigate('upload')}
              >
                <i className="bi bi-trash me-1"></i>
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="card">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover table-striped mb-0">
              <thead className="table-light">
                <tr>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2 text-end">Price (₹)</th>
                  <th className="px-3 py-2 text-end">Weight (g)</th>
                  <th className="px-3 py-2 text-end">Ref Fee</th>
                  <th className="px-3 py-2 text-end">Closing</th>
                  <th className="px-3 py-2 text-end">Fulfill</th>
                  <th className="px-3 py-2 text-end">Storage</th>
                  <th className="px-3 py-2 text-end">GST</th>
                  <th className="px-3 py-2 text-end">Total</th>
                  <th className="px-3 py-2 text-end">Net Profit</th>
                  <th className="px-3 py-2 text-end">Margin</th>
                  <th className="px-3 py-2 text-end">Return</th>
                  <th className="px-3 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2">
                      <div className="d-flex align-items-center">
                        <div className="flex-shrink-0 me-2 d-flex align-items-center justify-content-center rounded bg-light border" style={{ width: '40px', height: '40px', overflow: 'hidden' }}>
                          {item.image ? (
                            <img className="w-100 h-100 object-cover" src={item.image} alt="" />
                          ) : (
                            <span className="text-muted small">IMG</span>
                          )}
                        </div>
                        <div className="flex-grow-1">
                          <a href={`https://www.amazon.in/dp/${item.asin}`} target="_blank" rel="noopener noreferrer" className="text-decoration-none fw-medium">
                            {item.title || item.asin}
                          </a>
                          <div className="mt-1">
                            <span className="badge bg-secondary">{item.asin}</span>
                            {getStatusBadge(item.status)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">{item.categoryPath || item.category || '-'}</td>
                    <td className="px-3 py-2 text-end font-monospace">{item.price ? `₹ ${item.price} INR` : '-'}</td>
                    <td className="px-3 py-2 text-end font-monospace">{item.weight ? item.weight : '-'}</td>
                    <td className="px-3 py-2 text-end font-monospace">{item.referralFee || '-'}</td>
                    <td className="px-3 py-2 text-end font-monospace">{item.closingFee || '-'}</td>
                    <td className="px-3 py-2 text-end font-monospace">
                      {(item.shippingFee || 0) + (item.pickAndPackFee || 0) > 0 ? (item.shippingFee || 0) + (item.pickAndPackFee || 0) : '-'}
                    </td>
                    <td className="px-3 py-2 text-end font-monospace">{item.storageFee || '-'}</td>
                    <td className="px-3 py-2 text-end font-monospace">{item.tax || '-'}</td>
                    <td className="px-3 py-2 text-end fw-bold">{item.totalFees ? `₹ ${item.totalFees} INR` : '-'}</td>
                    <td className={`px-3 py-2 text-end fw-bold ${item.netRevenue && item.netRevenue > 0 ? 'text-success' : 'text-danger'}`}>
                      {item.netRevenue ? `₹ ${item.netRevenue} INR` : '-'}
                    </td>
                    <td className="px-3 py-2 text-end">
                      {item.marginPercent !== undefined ? (
                        <span className={`badge ${item.marginPercent > 15 ? 'bg-success' : item.marginPercent > 0 ? 'bg-warning' : 'bg-danger'}`}>
                          {Number(item.marginPercent).toFixed(1)}%
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-3 py-2 text-end">
                      {item.returnFee && item.stepLevel ? (
                        <div>
                          <div>₹ {item.returnFee} INR</div>
                          <small className="text-muted">{item.stepLevel}</small>
                        </div>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="d-flex justify-content-center gap-1">
                        <button
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => handleViewDetails(item)}
                          title="View Details"
                        >
                          <i className="bi bi-eye"></i>
                        </button>
                        <button
                          className="btn btn-outline-secondary btn-sm"
                          onClick={() => handleEditReturnPercentage(item)}
                          title="Edit Return %"
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => handleDeleteItem(item)}
                          title="Delete Product"
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {displayedItems.length === 0 && (
            <div className="p-4 text-center text-muted">
              <i className="bi bi-inbox fs-1"></i>
              <p className="mt-2">No items found matching your criteria.</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="card-footer d-flex justify-content-between align-items-center">
            <span className="text-muted">Showing {displayedItems.length} of {filtered.length} entries</span>
            <nav>
              <ul className="pagination mb-0">
                <li className={`page-item ${page === 1 ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={() => setPage(p => Math.max(1, p - 1))}>
                    <i className="bi bi-chevron-left"></i>
                  </button>
                </li>
                <li className="page-item disabled">
                  <span className="page-link">Page {page} of {totalPages}</span>
                </li>
                <li className={`page-item ${page === totalPages ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                    <i className="bi bi-chevron-right"></i>
                  </button>
                </li>
              </ul>
            </nav>
          </div>
        )}
      </div>

      {/* Modals */}
      <ProductDetailsModal
        item={selectedItem}
        isOpen={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedItem(null);
        }}
      />

      <ReturnPercentageModal
        item={selectedItem}
        isOpen={showReturnModal}
        onClose={() => {
          setShowReturnModal(false);
          setSelectedItem(null);
        }}
        onSave={handleSaveReturnPercentage}
      />
    </div>
  );
};

export default ResultsPage;
