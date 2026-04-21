import { useState, useEffect } from 'react';
import { sellerApi, marketSyncApi } from '../services/api';
import '../App.css';

const UploadForm = () => {
  const [file, setFile] = useState(null);
  const [month, setMonth] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [errors, setErrors] = useState([]);
  const [uploadType, setUploadType] = useState('monthly'); // 'monthly' or 'octoparse'
  const [sellers, setSellers] = useState([]);
  const [selectedSeller, setSelectedSeller] = useState('');
  const [isFetchingSellers, setIsFetchingSellers] = useState(false);

  useEffect(() => {
    if (uploadType === 'octoparse') {
      fetchSellers();
    }
  }, [uploadType]);

  const fetchSellers = async () => {
    setIsFetchingSellers(true);
    try {
      const response = await sellerApi.getAll();
      setSellers(response.data || []);
    } catch (err) {
      console.error('Failed to fetch sellers:', err);
      setErrors(['Failed to load sellers. Please try again.']);
    } finally {
      setIsFetchingSellers(false);
    }
  };

  const validateFile = (selectedFile) => {
    const validExcelTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
    const isJson = selectedFile.type === 'application/json' || selectedFile.name.endsWith('.json');
    const isExcel = validExcelTypes.includes(selectedFile.type);

    if (uploadType === 'monthly' && !isExcel) {
      return 'Only Excel files (.xlsx, .xls) are accepted for monthly data';
    }
    
    if (uploadType === 'octoparse' && !isJson) {
      return 'Only JSON files are accepted for Octoparse sync';
    }

    const maxSize = 20 * 1024 * 1024; // 20MB
    if (selectedFile.size > maxSize) {
      return 'File size must be less than 20MB';
    }

    return null;
  };

  const validateMonth = (selectedMonth) => {
    if (!selectedMonth) {
      return 'Please select a month';
    }

    const selectedDate = new Date(selectedMonth + '-01');
    const currentDate = new Date();
    if (selectedDate > currentDate) {
      return 'Future dates are not allowed';
    }

    return null;
  };

  const handleUpload = async () => {
    setErrors([]);
    setUploadStatus(null);

    // Validate inputs
    const fileError = file ? validateFile(file) : 'Please select a file';
    let monthError = null;
    let sellerError = null;

    if (uploadType === 'monthly') {
      monthError = validateMonth(month);
    } else {
      if (!selectedSeller) sellerError = 'Please select a seller';
    }

    const validationErrors = [];
    if (fileError) validationErrors.push(fileError);
    if (monthError) validationErrors.push(monthError);
    if (sellerError) validationErrors.push(sellerError);

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsLoading(true);

    try {
      let res;
      if (uploadType === 'monthly') {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('month', month);
        res = await axios.post(`${import.meta.env.VITE_API_URL || '/api'}/upload/upload-monthly`, formData, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });
        setUploadStatus({
          type: 'success',
          message: `✅ Uploaded Successfully: ${res.data.inserted} records added.`,
          details: res.data
        });
      } else {
        // Octoparse manual sync
        const response = await marketSyncApi.uploadOctoparseJson(file, selectedSeller);
        setUploadStatus({
          type: 'success',
          message: `✅ Sync Completed: ${response.message}`,
          details: response.data
        });
      }
      
      setFile(null);
      setMonth('');
      // Keep selectedSeller for convenience if uploading multiple files for same seller
    } catch (err) {
      console.error("❌ Upload error:", err);
      setUploadStatus({
        type: 'error',
        message: err.message || "❌ Upload failed. Please try again.",
        details: err.response?.data
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    if (selectedFile) {
      const fileError = validateFile(selectedFile);
      if (fileError) {
        setErrors([fileError]);
      } else if (errors.length > 0) {
        setErrors([]);
      }
    }
  };

  const handleMonthChange = (e) => {
    setMonth(e.target.value);
    if (e.target.value) {
      const monthError = validateMonth(e.target.value);
      if (monthError) {
        setErrors([monthError]);
      } else if (errors.length > 0) {
        setErrors([]);
      }
    }
  };

  return (
    <div className="upload-form">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h6 className="card-title mb-0">
          <i className="bi bi-cloud-upload me-2" style={{ color: 'var(--color-primary-600)' }}></i>
          Upload Data
        </h6>
        <div className="btn-group btn-group-sm">
          <button 
            className={`btn ${uploadType === 'monthly' ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => {
              setUploadType('monthly');
              setFile(null);
              setErrors([]);
              setUploadStatus(null);
            }}
          >
            Monthly Sales
          </button>
          <button 
            className={`btn ${uploadType === 'octoparse' ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => {
              setUploadType('octoparse');
              setFile(null);
              setErrors([]);
              setUploadStatus(null);
            }}
          >
            Octoparse Sync
          </button>
        </div>
      </div>

      {/* Month Selection (Monthly only) */}
      {uploadType === 'monthly' && (
        <div className="form-group pb-3">
          <label className="form-label">📅 Select Month</label>
          <input
            type="month"
            className={`form-control ${errors.some(e => e.includes('month')) ? 'is-invalid' : ''}`}
            onChange={handleMonthChange}
            placeholder="Select Month"
            value={month}
          />
        </div>
      )}

      {/* Seller Selection (Octoparse only) */}
      {uploadType === 'octoparse' && (
        <div className="form-group pb-3">
          <label className="form-label">🏪 Select Seller</label>
          <select 
            className={`form-select ${errors.some(e => e.includes('seller')) ? 'is-invalid' : ''}`}
            value={selectedSeller}
            onChange={(e) => setSelectedSeller(e.target.value)}
            disabled={isFetchingSellers}
          >
            <option value="">Choose a seller for sync...</option>
            {sellers.map(s => (
              <option key={s._id} value={s._id}>{s.name} ({s.marketplace})</option>
            ))}
          </select>
          {isFetchingSellers && <small className="text-muted">Loading sellers...</small>}
        </div>
      )}

      {/* File Upload */}
      <div className="form-group">
        <label className="form-label">
          {uploadType === 'monthly' ? '📄 Select Excel File' : '📄 Select Octoparse JSON File'}
        </label>
        <div className="upload-area" onClick={() => document.getElementById('fileInput').click()}>
          <div className="upload-icon">
            <i className={`bi ${uploadType === 'monthly' ? 'bi-file-earmark-spreadsheet' : 'bi-filetype-json'}`} style={{ fontSize: '48px', color: uploadType === 'monthly' ? 'var(--color-success-500)' : 'var(--color-primary-500)' }}></i>
          </div>
          <p className="upload-text">
            {file ? file.name : 'Click to upload or drag and drop'}
          </p>
          <p className="upload-hint">
            {uploadType === 'monthly' ? 'Excel files only (.xlsx, .xls)' : 'JSON files only (.json)'}
          </p>
          <input
            id="fileInput"
            type="file"
            className="d-none"
            onChange={handleFileChange}
            accept={uploadType === 'monthly' ? ".xlsx,.xls" : ".json"}
          />
        </div>
        {file && (
          <div className="mt-2 d-flex align-items-center gap-2">
            <i className="bi bi-check-circle text-success"></i>
            <span className="text-sm text-muted">
              Selected: <strong>{file.name}</strong> ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </span>
          </div>
        )}
      </div>

      {/* Validation Errors */}
      {errors.length > 0 && (
        <div className="alert alert-danger">
          <ul className="mb-0">
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Upload Status */}
      {uploadStatus && (
        <div className={`alert alert-${uploadStatus.type === 'success' ? 'success' : 'danger'}`}>
          {uploadStatus.message}
        </div>
      )}

      {/* Upload Button */}
      <div className="d-flex gap-2 mt-4">
        <button
          className={`btn btn-primary ${isLoading ? 'disabled' : ''}`}
          onClick={handleUpload}
          disabled={isLoading || !file || (uploadType === 'monthly' && !month) || (uploadType === 'octoparse' && !selectedSeller)}
          style={{ flex: 1 }}
        >
          {isLoading ? (
            <>
              <span className="spinner-border spinner-border-sm me-2"></span>
              {uploadType === 'monthly' ? 'Uploading...' : 'Syncing...'}
            </>
          ) : (
            <>
              <i className={`bi ${uploadType === 'monthly' ? 'bi-cloud-arrow-up' : 'bi-arrow-repeat'} me-2`}></i>
              {uploadType === 'monthly' ? 'Upload Data' : 'Start Octoparse Sync'}
            </>
          )}
        </button>

        {/* Clear Button */}
        {(file || month) && (
          <button
            className="btn btn-secondary"
            onClick={() => {
              setFile(null);
              setMonth('');
              setErrors([]);
              setUploadStatus(null);
            }}
            disabled={isLoading}
          >
            <i className="bi bi-x-lg"></i>
          </button>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-4 p-4 bg-light rounded-lg" style={{ background: 'var(--color-gray-100)' }}>
        <p className="text-sm text-muted mb-2">
          <strong>📋 Instructions:</strong>
        </p>
        {uploadType === 'monthly' ? (
          <ul className="text-sm text-muted mb-0" style={{ paddingLeft: 'var(--space-4)' }}>
            <li>File format: Excel (.xlsx, .xls)</li>
            <li>Size limit: 20 MB</li>
            <li>Required columns: ASIN, Ordered Revenue, Ordered Units</li>
            <li>Ensure all ASINs exist in master product data</li>
          </ul>
        ) : (
          <ul className="text-sm text-muted mb-0" style={{ paddingLeft: 'var(--space-4)' }}>
            <li>File format: JSON (.json) exported from Octoparse</li>
            <li>Size limit: 20 MB</li>
            <li>Structure: Array of objects with field RT/Rating, ASIN, etc.</li>
            <li>Maps directly to ASIN metrics including Rating breakdown.</li>
          </ul>
        )}
      </div>
    </div>
  );
};

export default UploadForm;
