import React, { useState, useEffect } from 'react';
import { Store, X, LayoutGrid, Globe, Key, Users } from 'lucide-react';
import { userApi } from '../../services/api';
import { TagPicker } from 'rsuite';

const AddSellerModal = ({ onClose, onSave, isAdmin, isGlobalUser, initialData }) => {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    marketplace: initialData?.marketplace || 'amazon.in',
    sellerId: initialData?.sellerId || '',
    apiKey: initialData?.apiKey || 'Default',
    plan: initialData?.plan || 'Starter',
    scrapeLimit: initialData?.scrapeLimit || 100,
    assignedUserIds: initialData?.managers?.map(m => m._id) || [],
  });
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    userApi.getManagers()
      .then(data => setManagers(data))
      .catch(() => setManagers([]));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await onSave(formData);
    } finally {
      setLoading(false);
    }
  };

  const managerOptions = managers.map(m => ({
    label: `${m.firstName} ${m.lastName} (${m.email})`,
    value: m._id
  }));

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(9, 9, 11, 0.6)', backdropFilter: 'blur(12px)', zIndex: 1070 }}>
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '520px' }}>
        <div className="modal-content border border-zinc-200 shadow-2xl" style={{ borderRadius: '16px', background: '#fff' }}>
          <div className="modal-header border-0 px-4 pt-4 pb-0 d-flex align-items-center justify-content-between">
            <h5 className="modal-title d-flex align-items-center gap-2 text-zinc-900 fw-bold" style={{ fontSize: '15px' }}>
              <div className="p-1.5 bg-zinc-900 text-white rounded-2 shadow-sm">
                <Store size={18} strokeWidth={2.5} />
              </div>
              {initialData ? 'Edit Seller Details' : 'Configure New Store'}
            </h5>
            <button type="button" className="btn-white-icon border-0 shadow-none" onClick={onClose}>
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-body px-4 py-4" style={{ position: 'relative' }}>
              <div className="mb-4">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <div className="p-1 bg-zinc-100 rounded text-zinc-500"><LayoutGrid size={12} /></div>
                  <label className="form-label smallest fw-bold text-zinc-400 text-uppercase tracking-widest mb-0">Brand Name</label>
                </div>
                <input
                  type="text"
                  className="form-control bg-zinc-50 border-zinc-200 px-3 fw-bold text-zinc-900 shadow-sm focus-border-primary"
                  placeholder="e.g. RetailOps Storefront"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  style={{ borderRadius: '10px', fontSize: '13px', height: '42px' }}
                />
              </div>

              <div className="row g-3">
                <div className="col-md-6 mb-3">
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <div className="p-1 bg-zinc-100 rounded text-zinc-500"><Globe size={12} /></div>
                    <label className="form-label smallest fw-bold text-zinc-400 text-uppercase tracking-widest mb-0">Marketplace</label>
                  </div>
                  <select
                    className="form-select bg-zinc-50 border-zinc-200 px-3 fw-semibold text-zinc-700 shadow-sm"
                    value={formData.marketplace}
                    onChange={(e) => setFormData({ ...formData, marketplace: e.target.value })}
                    style={{ borderRadius: '10px', fontSize: '13px', height: '42px' }}
                  >
                    <option value="amazon.in">Amazon.in</option>
                  </select>
                </div>
                <div className="col-md-6 mb-3">
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <div className="p-1 bg-zinc-100 rounded text-zinc-500"><Key size={12} /></div>
                    <label className="form-label smallest fw-bold text-zinc-400 text-uppercase tracking-widest mb-0">SELLER ID</label>
                  </div>
                  <input
                    type="text"
                    className="form-control bg-zinc-50 border-zinc-200 px-3 font-monospace fw-bold text-primary shadow-sm"
                    value={formData.sellerId}
                    onChange={(e) => setFormData({ ...formData, sellerId: e.target.value })}
                    placeholder="Merchant ID"
                    required
                    style={{ borderRadius: '10px', fontSize: '12px', height: '42px' }}
                  />
                </div>
              </div>

              <div className="mb-4">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <div className="p-1 bg-zinc-100 rounded text-zinc-500"><Users size={12} /></div>
                  <label className="form-label smallest fw-bold text-zinc-400 text-uppercase tracking-widest mb-0">BRAND MANAGER</label>
                </div>
                <TagPicker
                  data={managerOptions}
                  value={formData.assignedUserIds}
                  onChange={(val) => setFormData({ ...formData, assignedUserIds: val })}
                  placeholder="— Unassigned (Public Pool) —"
                  block
                  className="fw-bold"
                  placement="bottomStart"
                  style={{ 
                    borderRadius: '10px', 
                    fontSize: '13px',
                    border: '1px solid #e4e4e7',
                    backgroundColor: '#fff'
                  }}
                />
              </div>
            </div>

            <div className="modal-footer border-0 px-4 pb-4 pt-1 gap-2">
              <button type="button" className="btn-prism shadow-none border-0 text-zinc-500" onClick={onClose} disabled={loading}>
                Dismiss
              </button>
              <button
                type="submit"
                className="btn-prism btn-prism-primary"
                disabled={loading}
              >
                {loading ? 'Saving...' : initialData ? 'Save Changes' : 'Launch Store'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default React.memo(AddSellerModal);
