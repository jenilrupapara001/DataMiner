import React, { useState } from 'react';

const demoRules = [
  { id: 1, name: 'Revenue Drop Alert', metric: 'revenue', operator: 'decreased by', value: 20, period: '7 days', severity: 'warning', status: true, type: 'Revenue' },
  { id: 2, name: 'Low Inventory Warning', metric: 'inventory', operator: 'less than', value: 50, period: 'daily', severity: 'critical', status: true, type: 'Inventory' },
  { id: 3, name: 'ACoS Increase Alert', metric: 'acos', operator: 'increased by', value: 10, period: '7 days', severity: 'warning', status: true, type: 'Ads' },
  { id: 4, name: 'New Competitor Alert', metric: 'competitor', operator: 'detected', value: 1, period: 'daily', severity: 'info', status: true, type: 'Competitor' },
  { id: 5, name: 'Negative Review Alert', metric: 'reviews', operator: 'decreased by', value: 1, period: 'daily', severity: 'danger', status: false, type: 'Reviews' },
  { id: 6, name: 'Sales Target Alert', metric: 'sales', operator: 'less than', value: 1000, period: '7 days', severity: 'warning', status: true, type: 'Performance' },
  { id: 7, name: 'ROAS Drop Alert', metric: 'roas', operator: 'decreased by', value: 15, period: '7 days', severity: 'warning', status: true, type: 'Ads' },
  { id: 8, name: 'Price Change Alert', metric: 'price', operator: 'changed by', value: 5, period: 'daily', severity: 'info', status: false, type: 'Pricing' },
];

const AlertRulesPage = () => {
  const [rules, setRules] = useState(demoRules);
  const [showForm, setShowForm] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '',
    metric: 'revenue',
    operator: 'decreased by',
    value: '',
    period: '7 days',
    severity: 'warning',
    type: 'Revenue'
  });

  const toggleRule = (id) => {
    setRules(rules.map(rule =>
      rule.id === id ? { ...rule, status: !rule.status } : rule
    ));
  };

  const deleteRule = (id) => {
    setRules(rules.filter(rule => rule.id !== id));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const rule = {
      id: Date.now(),
      ...newRule,
      value: parseFloat(newRule.value),
      status: true
    };
    setRules([...rules, rule]);
    setNewRule({
      name: '',
      metric: 'revenue',
      operator: 'decreased by',
      value: '',
      period: '7 days',
      severity: 'warning',
      type: 'Revenue'
    });
    setShowForm(false);
  };

  const getSeverityClass = (severity) => {
    const classes = {
      critical: 'badge-danger',
      warning: 'badge-warning',
      success: 'badge-success',
      info: 'badge-primary'
    };
    return classes[severity] || 'badge-primary';
  };

  return (
    <>
      <div className="page-content">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <p className="text-muted mb-0">Configure automatic alerts based on your business metrics</p>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            <i className="bi bi-plus-lg me-2"></i>
            Create New Rule
          </button>
        </div>

        {showForm && (
          <div className="card mb-4">
            <div className="card-header">
              <h5 className="card-title mb-0">Create Alert Rule</h5>
            </div>
            <div className="card-body">
              <form onSubmit={handleSubmit}>
                <div className="row">
                  <div className="col-lg-6 mb-3">
                    <label className="filter-label">Rule Name</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g., Revenue Drop Alert"
                      value={newRule.name}
                      onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="col-lg-6 mb-3">
                    <label className="filter-label">Alert Type</label>
                    <select
                      className="form-select"
                      value={newRule.type}
                      onChange={(e) => setNewRule({ ...newRule, type: e.target.value, metric: e.target.value.toLowerCase() })}
                    >
                      <option value="Revenue">Revenue</option>
                      <option value="Inventory">Inventory</option>
                      <option value="Ads">Ads</option>
                      <option value="Competitor">Competitor</option>
                      <option value="Reviews">Reviews</option>
                      <option value="Performance">Performance</option>
                      <option value="Pricing">Pricing</option>
                    </select>
                  </div>
                  <div className="col-lg-3 mb-3">
                    <label className="filter-label">Metric</label>
                    <select
                      className="form-select"
                      value={newRule.metric}
                      onChange={(e) => setNewRule({ ...newRule, metric: e.target.value })}
                    >
                      <option value="revenue">Revenue</option>
                      <option value="units">Units Sold</option>
                      <option value="acos">ACoS</option>
                      <option value="roas">RoAS</option>
                      <option value="inventory">Inventory</option>
                      <option value="price">Price</option>
                      <option value="reviews">Reviews</option>
                    </select>
                  </div>
                  <div className="col-lg-3 mb-3">
                    <label className="filter-label">Condition</label>
                    <select
                      className="form-select"
                      value={newRule.operator}
                      onChange={(e) => setNewRule({ ...newRule, operator: e.target.value })}
                    >
                      <option value="decreased by">Decreased by %</option>
                      <option value="increased by">Increased by %</option>
                      <option value="less than">Less than</option>
                      <option value="greater than">Greater than</option>
                      <option value="equals">Equals</option>
                    </select>
                  </div>
                  <div className="col-lg-2 mb-3">
                    <label className="filter-label">Value</label>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="e.g., 20"
                      value={newRule.value}
                      onChange={(e) => setNewRule({ ...newRule, value: e.target.value })}
                      required
                    />
                  </div>
                  <div className="col-lg-2 mb-3">
                    <label className="filter-label">Period</label>
                    <select
                      className="form-select"
                      value={newRule.period}
                      onChange={(e) => setNewRule({ ...newRule, period: e.target.value })}
                    >
                      <option value="daily">Daily</option>
                      <option value="7 days">7 Days</option>
                      <option value="14 days">14 Days</option>
                      <option value="30 days">30 Days</option>
                    </select>
                  </div>
                  <div className="col-lg-2 mb-3">
                    <label className="filter-label">Severity</label>
                    <select
                      className="form-select"
                      value={newRule.severity}
                      onChange={(e) => setNewRule({ ...newRule, severity: e.target.value })}
                    >
                      <option value="info">Info</option>
                      <option value="warning">Warning</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                </div>
                <div className="d-flex gap-2">
                  <button type="submit" className="btn btn-primary">
                    <i className="bi bi-check-lg me-2"></i>
                    Save Rule
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                    <i className="bi bi-x-lg me-2"></i>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="data-table-container">
          <div className="data-table-header">
            <h3 className="data-table-title">Alert Rules</h3>
            <span className="text-muted">{rules.length} rules</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rule Name</th>
                  <th>Type</th>
                  <th>Condition</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules.map(rule => (
                  <tr key={rule.id}>
                    <td><strong>{rule.name}</strong></td>
                    <td><span className="badge badge-primary">{rule.type}</span></td>
                    <td>{rule.metric} {rule.operator} {rule.value}% ({rule.period})</td>
                    <td><span className={`badge ${getSeverityClass(rule.severity)}`}>{rule.severity}</span></td>
                    <td>
                      <div className="form-check form-switch">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={rule.status}
                          onChange={() => toggleRule(rule.id)}
                          style={{ cursor: 'pointer' }}
                        />
                      </div>
                    </td>
                    <td>
                      <button className="btn btn-sm btn-secondary me-2" onClick={() => deleteRule(rule.id)}>
                        <i className="bi bi-trash"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
};

export default AlertRulesPage;
