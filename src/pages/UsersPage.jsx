import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, Search, Plus, Edit3, Trash2, Shield, CheckCircle2, 
  XCircle, Mail, Phone, Calendar, Key, ToggleLeft, ToggleRight,
  RefreshCw, X, Store, BadgeCheck, BadgeX, Filter
} from 'lucide-react';
import { userApi } from '../services/api';
import { PageLoader } from '@/components/application/loading-indicator/PageLoader';

const UsersPage = () => {
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });
  const [roles, setRoles] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [sellers, setSellers] = useState([]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await userApi.getAll({
        page,
        limit: 25,
        search: search || undefined,
        role: roleFilter !== 'all' ? roleFilter : undefined,
        isActive: statusFilter !== 'all' ? statusFilter : undefined
      });
      
      if (res.success) {
        setUsersList(res.data.users || []);
        setPagination(res.data.pagination || { total: 0, totalPages: 0 });
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    }
    setLoading(false);
  }, [page, search, roleFilter, statusFilter]);

  const loadRoles = async () => {
    try {
      const res = await userApi.getRoles();
      if (res.success) setRoles(res.data || []);
    } catch (err) {}
  };

  const loadSellers = async () => {
    try {
      const res = await userApi.getSellers();
      if (res.success) setSellers(res.data || []);
    } catch (err) {}
  };

  useEffect(() => { loadUsers(); }, [loadUsers]);
  useEffect(() => { loadRoles(); loadSellers(); }, []);

  const handleToggleStatus = async (userId) => {
    try {
      await userApi.toggleStatus(userId);
      loadUsers();
    } catch (err) {
      alert('Failed to toggle status');
    }
  };

  const handleDelete = async (userId) => {
    if (!confirm('Delete this user?')) return;
    try {
      await userApi.delete(userId);
      loadUsers();
    } catch (err) {
      alert('Failed to delete user');
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setShowModal(true);
  };

  const getRoleBadge = (role) => (
    <span className="badge rounded-pill px-3 py-1 fw-bold d-flex align-items-center gap-1"
      style={{ backgroundColor: (role?.color || '#6B7280') + '20', color: role?.color || '#6B7280', fontSize: '11px' }}>
      <Shield size={12} />
      {role?.displayName || role?.name || 'Viewer'}
    </span>
  );

  if (loading && usersList.length === 0) return <PageLoader message="Loading Users..." />;

  return (
    <div style={{ padding: '1.5rem', background: '#f9fafb', minHeight: '100vh' }}>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="fw-bold mb-1">User Management</h4>
          <p className="text-zinc-500 mb-0" style={{ fontSize: '13px' }}>
            {pagination.total} total users
          </p>
        </div>
        <button className="btn btn-dark d-flex align-items-center gap-2 rounded-3 px-4" onClick={() => { setEditingUser(null); setShowModal(true); }}>
          <Plus size={16} /> Add User
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-4 border p-3 mb-4 d-flex align-items-center gap-3 flex-wrap">
        <div className="position-relative" style={{ width: '250px' }}>
          <Search size={14} className="position-absolute top-50 start-0 translate-middle-y ms-3 text-zinc-400" />
          <input className="form-control form-control-sm ps-5 rounded-3" placeholder="Search by name or email..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ fontSize: '12px', height: '38px' }} />
        </div>
        
        <select className="form-select form-select-sm rounded-3" value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }} style={{ width: '180px', fontSize: '12px', height: '38px' }}>
          <option value="all">All Roles</option>
          {roles.map(r => <option key={r._id} value={r.Name}>{r.DisplayName}</option>)}
        </select>

        <select className="form-select form-select-sm rounded-3" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} style={{ width: '150px', fontSize: '12px', height: '38px' }}>
          <option value="all">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>

        <button className="btn btn-sm btn-outline-secondary rounded-3" onClick={loadUsers}>
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-4 border overflow-hidden">
        <table className="table table-hover mb-0">
          <thead className="bg-zinc-50">
            <tr style={{ fontSize: '11px', fontWeight: 700, color: '#71717a', textTransform: 'uppercase' }}>
              <th className="ps-4">User</th>
              <th>Role</th>
              <th>Sellers</th>
              <th>Status</th>
              <th>Last Seen</th>
              <th className="text-end pe-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {usersList.map(user => (
              <tr key={user._id} style={{ fontSize: '13px' }}>
                <td className="ps-4">
                  <div className="d-flex align-items-center gap-3">
                    <div className="rounded-circle bg-zinc-100 d-flex align-items-center justify-content-center fw-bold text-zinc-600" 
                      style={{ width: '40px', height: '40px', fontSize: '14px' }}>
                      {(user.firstName?.[0] || '') + (user.lastName?.[0] || '') || user.email[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="fw-bold">{user.firstName} {user.lastName}</div>
                      <div className="text-zinc-400" style={{ fontSize: '11px' }}>
                        <Mail size={10} className="me-1" />{user.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td>{getRoleBadge(user.role)}</td>
                <td>
                  <span className="badge bg-zinc-100 text-zinc-600 rounded-pill" style={{ fontSize: '11px' }}>
                    <Store size={10} className="me-1" />
                    {user.assignedSellers?.length || 0} seller(s)
                  </span>
                </td>
                <td>
                  <button className="btn btn-ghost p-0 border-0" onClick={() => handleToggleStatus(user._id)}>
                    {user.isActive ? (
                      <span className="d-flex align-items-center gap-1 text-success"><CheckCircle2 size={14} /> Active</span>
                    ) : (
                      <span className="d-flex align-items-center gap-1 text-danger"><XCircle size={14} /> Inactive</span>
                    )}
                  </button>
                </td>
                <td style={{ fontSize: '11px', color: '#9ca3af' }}>
                  {user.lastSeen ? new Date(user.lastSeen).toLocaleDateString() : 'Never'}
                </td>
                <td className="text-end pe-4">
                  <div className="d-flex gap-1 justify-content-end">
                    <button className="btn btn-sm btn-ghost" onClick={() => handleEdit(user)}><Edit3 size={14} /></button>
                    <button className="btn btn-sm btn-ghost text-danger" onClick={() => handleDelete(user._id)}><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {usersList.length === 0 && (
          <div className="text-center py-5">
            <Users size={48} className="text-zinc-300 mb-3" />
            <h6 className="text-zinc-500">No users found</h6>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="d-flex justify-content-between align-items-center mt-3">
        <span className="text-zinc-500" style={{ fontSize: '12px' }}>
          Page {page} of {pagination.totalPages} ({pagination.total} users)
        </span>
        <div className="d-flex gap-2">
          <button className="btn btn-sm btn-outline-secondary rounded-3" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
          <button className="btn btn-sm btn-outline-secondary rounded-3" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
      </div>

      {/* Add/Edit User Modal */}
      {showModal && <UserModal user={editingUser} roles={roles} sellers={sellers} onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); loadUsers(); }} />}
    </div>
  );
};

// User Modal Component
const UserModal = ({ user, roles, sellers, onClose, onSave }) => {
  const [form, setForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
    password: '',
    roleId: user?.role?._id || '',
    isActive: user?.isActive !== false,
    assignedSellerIds: user?.assignedSellers?.map(s => s._id) || []
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (user) {
        await userApi.update(user._id, form);
      } else {
        await userApi.create(form);
      }
      onSave();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save user');
    }
    setSaving(false);
  };

  return (
    <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ background: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
      <div className="bg-white rounded-4 p-4" style={{ width: '500px', maxHeight: '90vh', overflow: 'auto' }}>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h5 className="fw-bold">{user ? 'Edit User' : 'Add User'}</h5>
          <button className="btn btn-ghost p-1" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="row g-3">
            <div className="col-6">
              <label className="form-label small fw-bold">First Name</label>
              <input className="form-control form-control-sm rounded-3" value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} required />
            </div>
            <div className="col-6">
              <label className="form-label small fw-bold">Last Name</label>
              <input className="form-control form-control-sm rounded-3" value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})} required />
            </div>
            <div className="col-12">
              <label className="form-label small fw-bold">Email</label>
              <input type="email" className="form-control form-control-sm rounded-3" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
            </div>
            <div className="col-6">
              <label className="form-label small fw-bold">Phone</label>
              <input className="form-control form-control-sm rounded-3" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
            </div>
            <div className="col-6">
              <label className="form-label small fw-bold">{user ? 'New Password (optional)' : 'Password'}</label>
              <input type="password" className="form-control form-control-sm rounded-3" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required={!user} />
            </div>
            <div className="col-12">
              <label className="form-label small fw-bold">Role</label>
              <select className="form-select form-select-sm rounded-3" value={form.roleId} onChange={e => setForm({...form, roleId: e.target.value})} required>
                <option value="">Select role...</option>
                {roles.map(r => <option key={r._id} value={r.Id}>{r.DisplayName}</option>)}
              </select>
            </div>
            <div className="col-12">
              <label className="form-label small fw-bold">Assigned Sellers</label>
              <div style={{ maxHeight: '150px', overflow: 'auto' }}>
                {sellers.map(seller => (
                  <label key={seller._id} className="d-flex align-items-center gap-2 py-1" style={{ fontSize: '12px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.assignedSellerIds.includes(seller._id)} onChange={e => {
                      const updated = e.target.checked 
                        ? [...form.assignedSellerIds, seller._id] 
                        : form.assignedSellerIds.filter(id => id !== seller._id);
                      setForm({...form, assignedSellerIds: updated});
                    }} />
                    {seller.Name} ({seller.Marketplace})
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="d-flex gap-2 justify-content-end mt-4">
            <button type="button" className="btn btn-outline-secondary rounded-3" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-dark rounded-3 px-4" disabled={saving}>
              {saving ? 'Saving...' : user ? 'Update User' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UsersPage;