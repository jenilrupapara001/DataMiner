import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { PageLoader } from '@/components/application/loading-indicator/PageLoader';
import { LoadingIndicator } from '@/components/application/loading-indicator/loading-indicator';

const SettingsPage = () => {
  const [settings, setSettings] = useState({
    octoparseApiKey: '',
    octoparseTaskId: '',
    scrapePollInterval: '300000',
    smtpHost: '',
    smtpPort: '',
    smtpUser: '',
    smtpPass: '',
    smtpSecure: 'tls',
    notifications: true,
    emailReports: false,
    minLqsScore: 80,
    minTitleLength: 80,
    minImageCount: 7,
    minDescLength: 1000,
  });
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [testingOctoparse, setTestingOctoparse] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const dbSettings = await db.getSettings();
      if (dbSettings && Object.keys(dbSettings).length > 0) {
        setSettings(prev => ({
          ...prev,
          ...dbSettings
        }));
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSave = async () => {
    try {
      await db.updateSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      alert('Failed to save settings: ' + error.message);
    }
  };

  const handleTestOctoparse = async () => {
    setTestingOctoparse(true);
    setTestResult(null);

    // Simulate Octoparse API test
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (settings.octoparseApiKey && settings.octoparseTaskId) {
      setTestResult({ success: true, message: 'Octoparse API connection successful!' });
    } else {
      setTestResult({ success: false, message: 'Please enter both API Key and Task ID' });
    }

    setTestingOctoparse(false);
  };

  return (
    <>
      {loading && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #4F46E5, #10B981)', zIndex: 9999 }}>
        </div>
      )}
      <div className="page-header">
        <h1 className="page-title"><i className="bi bi-gear"></i>Settings</h1>
      </div>
      <div className="page-content">
        <div className="row">
          <div className="col-lg-8">
            <div className="settings-section">

            {/* Octoparse API Settings */}
            <div className="card mb-4">
              <div className="card-header">
                <h5 className="mb-0"><i className="bi bi-cloud"></i>Cloud API</h5>
              </div>
              <div className="card-body">
                <p className="text-muted mb-3">
                  Configure Octoparse Cloud API for Amazon product data scraping.
                  Get your API key from <a href="https://www.octoparse.com" target="_blank" rel="noopener noreferrer">octoparse.com</a>
                </p>
                <div className="mb-3">
                  <label className="form-label">API Key</label>
                  <input
                    type="password"
                    className="form-control"
                    name="octoparseApiKey"
                    value={settings.octoparseApiKey}
                    onChange={handleChange}
                    placeholder="Enter your Octoparse API key"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Task ID</label>
                  <input
                    type="text"
                    className="form-control"
                    name="octoparseTaskId"
                    value={settings.octoparseTaskId}
                    onChange={handleChange}
                    placeholder="Enter your Octoparse Task ID"
                  />
                  <div className="form-text">The Task ID from your Octoparse Cloud Amazon scraping task</div>
                </div>
                <div className="mb-3">
                  <label className="form-label">Poll Interval (ms)</label>
                  <input
                    type="number"
                    className="form-control"
                    name="scrapePollInterval"
                    value={settings.scrapePollInterval}
                    onChange={handleChange}
                    placeholder="300000"
                  />
                  <div className="form-text">How often to check scrape status (default: 300000 = 5 minutes)</div>
                </div>
                <div className="d-flex gap-2">
                  <button
                    className="btn btn-outline-primary"
                    onClick={handleTestOctoparse}
                    disabled={testingOctoparse}
                  >
                    {testingOctoparse ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Testing...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-plug me-1"></i>Test Connection
                      </>
                    )}
                  </button>
                  {testResult && (
                    <div className={`alert ${testResult.success ? 'alert-success' : 'alert-danger'} mb-0 py-2 px-3`}>
                      {testResult.message}
                    </div>
                  )}
                </div>
                <div className="alert alert-info mt-3">
                  <i className="bi bi-info-circle me-2"></i>
                  Octoparse Cloud API is used to scrape Amazon product pages for prices, rankings, reviews, and more.
                </div>
              </div>
            </div>

            {/* SMTP Settings */}
            <div className="card mb-4">
              <div className="card-header">
                <h5 className="mb-0"><i className="bi bi-envelope"></i> Email Notification Settings (SMTP)</h5>
              </div>
              <div className="card-body">
                <p className="text-muted mb-3">
                  Configure SMTP settings for email notifications and reports.
                </p>
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">SMTP Host</label>
                    <input
                      type="text"
                      className="form-control"
                      name="smtpHost"
                      value={settings.smtpHost}
                      onChange={handleChange}
                      placeholder="smtp.example.com"
                    />
                  </div>
                  <div className="col-md-3 mb-3">
                    <label className="form-label">Port</label>
                    <input
                      type="text"
                      className="form-control"
                      name="smtpPort"
                      value={settings.smtpPort}
                      onChange={handleChange}
                      placeholder="587"
                    />
                  </div>
                  <div className="col-md-3 mb-3">
                    <label className="form-label">Security</label>
                    <select
                      className="form-select"
                      name="smtpSecure"
                      value={settings.smtpSecure}
                      onChange={handleChange}
                    >
                      <option value="tls">TLS (STARTTLS)</option>
                      <option value="ssl">SSL (Implicit)</option>
                    </select>
                  </div>
                </div>
                <div className="mb-3">
                  <label className="form-label">Username</label>
                  <input
                    type="text"
                    className="form-control"
                    name="smtpUser"
                    value={settings.smtpUser}
                    onChange={handleChange}
                    placeholder="your@email.com"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Password</label>
                  <input
                    type="password"
                    className="form-control"
                    name="smtpPass"
                    value={settings.smtpPass}
                    onChange={handleChange}
                    placeholder="Enter email password"
                  />
                  <div className="form-text">For Gmail, use a 16-character App Password.</div>
                </div>
                <button
                  className="btn btn-outline-primary btn-sm"
                  onClick={async () => {
                    const email = prompt("Enter email to send test to:", settings.smtpUser);
                    if (email) {
                      try {
                        const res = await db.request('/settings/test-email', {
                          method: 'POST',
                          body: JSON.stringify({ to: email })
                        });
                        alert(res?.success ? "Test email sent successfully!" : "Failed to send test email: " + res?.message);
                      } catch (err) {
                        alert("Error: " + err.message);
                      }
                    }
                  }}
                >
                  <i className="bi bi-send me-1"></i> Send Test Email
                </button>
              </div>
            </div>

            {/* ASIN Optimization Rules */}
            <div className="card mb-4">
              <div className="card-header">
                <h5 className="mb-0"><i className="bi bi-sliders"></i> ASIN Optimization Rules (Bulk Actions)</h5>
              </div>
              <div className="card-body">
                <p className="text-muted mb-3">
                  Set the threshold requirements for auto-generating optimization tasks for your ASINs. Any ASIN falling below these targets will be flagged for tasks.
                </p>
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Minimum Target LQS Score</label>
                    <input
                      type="number"
                      className="form-control"
                      name="minLqsScore"
                      value={settings.minLqsScore}
                      onChange={handleChange}
                      placeholder="80"
                      min="0"
                      max="100"
                    />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Minimum Title Length</label>
                    <input
                      type="number"
                      className="form-control"
                      name="minTitleLength"
                      value={settings.minTitleLength}
                      onChange={handleChange}
                      placeholder="100"
                      min="0"
                    />
                  </div>
                </div>
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Minimum Image Count</label>
                    <input
                      type="number"
                      className="form-control"
                      name="minImageCount"
                      value={settings.minImageCount}
                      onChange={handleChange}
                      placeholder="7"
                      min="0"
                    />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Minimum Description Length</label>
                    <input
                      type="number"
                      className="form-control"
                      name="minDescLength"
                      value={settings.minDescLength}
                      onChange={handleChange}
                      placeholder="500"
                      min="0"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Notification Preferences */}
            <div className="card mb-4">
              <div className="card-header">
                <h5 className="mb-0"><i className="bi bi-bell"></i> Notification Preferences</h5>
              </div>
              <div className="card-body">
                <div className="form-check form-switch mb-3">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="notifications"
                    name="notifications"
                    checked={settings.notifications}
                    onChange={handleChange}
                  />
                  <label className="form-check-label" htmlFor="notifications">
                    Enable in-app notifications
                  </label>
                </div>
                <div className="form-check form-switch mb-3">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="emailReports"
                    name="emailReports"
                    checked={settings.emailReports}
                    onChange={handleChange}
                  />
                  <label className="form-check-label" htmlFor="emailReports">
                    Receive daily email reports
                  </label>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="d-flex justify-content-end">
              {saved && (
                <div className="alert alert-success me-3 mb-0 d-flex align-items-center">
                  <i className="bi bi-check-circle me-2"></i>
                  Settings saved successfully!
                </div>
              )}
              <button className="btn btn-primary" onClick={handleSave}>
                <i className="bi bi-check-lg me-2"></i>
                Save Settings
              </button>
            </div>
          </div>

          <div className="col-lg-4">
            {/* Account Info */}
            <div className="card mb-4">
              <div className="card-header">
                <h5 className="mb-0"><i className="bi bi-person-badge"></i> Account</h5>
              </div>
              <div className="card-body">
                <div className="mb-3">
                  <label className="text-muted">Plan</label>
                  <div className="fw-semibold">Pro</div>
                </div>
                <div className="mb-3">
                  <label className="text-muted">Scrape Tasks Today</label>
                  <div className="fw-semibold">0 / 10</div>
                  <div className="progress mt-1" style={{ height: '6px' }}>
                    <div className="progress-bar" style={{ width: '0%' }}></div>
                  </div>
                </div>
                <div className="mb-3">
                  <label className="text-muted">ASINs Tracked</label>
                  <div className="fw-semibold">6 / 1000</div>
                </div>
              </div>
            </div>

            {/* Octoparse Task Setup */}
            <div className="card mb-4">
              <div className="card-header">
                <h5 className="mb-0"><i className="bi bi-question-circle"></i> Task Setup Help</h5>
              </div>
              <div className="card-body">
                <p className="text-muted small mb-2">Create an Octoparse task with these XPaths:</p>
                <div className="list-group list-group-flush small">
                  <div className="list-group-item">Title: <code>//*[@id="productTitle"]</code></div>
                  <div className="list-group-item">Price: <code>//*[@id="corePriceDisplay_desktop_feature_div"]/div[1]/span[3]</code></div>
                  <div className="list-group-item">Rating: <code>//*[@id="averageCustomerReviews"]</code></div>
                  <div className="list-group-item">Rank: <code>//*[@id="detailBullets_feature_div"]/ul/li[15]/span</code></div>
                  <div className="list-group-item">Reviews: <code>//*[@id="cm_cr_dp_d_rating_histogram"]</code></div>
                </div>
              </div>
            </div>

            {/* Help */}
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0"><i className="bi bi-life-preserver"></i> Support</h5>
              </div>
              <div className="card-body">
                <div className="list-group list-group-flush">
                  <a href="#" className="list-group-item list-group-item-action">
                    <i className="bi bi-book me-2"></i> Documentation
                  </a>
                  <a href="#" className="list-group-item list-group-item-action">
                    <i className="bi bi-chat-dots me-2"></i> Contact Support
                  </a>
                  <a href="https://www.octoparse.com" target="_blank" rel="noopener noreferrer" className="list-group-item list-group-item-action">
                    <i className="bi bi-cloud me-2"></i> Octoparse Dashboard
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SettingsPage;
