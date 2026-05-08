import React, { useState, useEffect } from 'react';
import { Plus, X, Check, Calendar, Sparkles, Loader2 } from 'lucide-react';
import { db } from '../../services/db';


const ObjectiveManager = ({ onObjectiveCreated, onClose, objective, users = [] }) => {
    const [step, setStep] = useState(1); // 1: Info, 2: Template, 3: Tasks/Asins
    const [title, setTitle] = useState(objective?.title || '');
    const [goal, setGoal] = useState(objective?.goal || '');
    const [measurementMetrics, setMeasurementMetrics] = useState(objective?.measurementMetrics || '');
    const [owners, setOwners] = useState(
        objective?.owners?.map(o => o._id || o) ||
        (objective?.owner ? [objective.owner._id || objective.owner] : [])
    );
    const [defaultAssignee, setDefaultAssignee] = useState('');
    const [baseTitle, setBaseTitle] = useState(objective?.title || '');
    const [type, setType] = useState(objective?.type || 'MONTHLY');
    const [startDate, setStartDate] = useState(objective?.startDate ? new Date(objective.startDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(objective?.endDate ? new Date(objective.endDate).toISOString().split('T')[0] : '');
    const [sellers, setSellers] = useState([]);
    const [selectedSeller, setSelectedSeller] = useState(objective?.sellerId || '');
    const [loading, setLoading] = useState(false);
    const [createdObjective, setCreatedObjective] = useState(objective || null);
    const [templates, setTemplates] = useState([]);
    const [selectedTemplates, setSelectedTemplates] = useState([]);
    const [availableAsins, setAvailableAsins] = useState([]);
    const [selectedAsins, setSelectedAsins] = useState([]);
    const [ownerSearchQuery, setOwnerSearchQuery] = useState('');
    const [optimizationRules, setOptimizationRules] = useState({
        minLqsScore: 80,
        minTitleLength: 100,
        minImageCount: 7,
        minDescLength: 500
    });

    // Auto-calculate end date based on type
    useEffect(() => {
        if (!startDate) return;
        const start = new Date(startDate);
        const end = new Date(start);

        if (type === 'MONTHLY') {
            end.setMonth(end.getMonth() + 1);
        } else if (type === 'WEEKLY') {
            end.setDate(end.getDate() + 7);
        } else if (type === 'QUARTERLY') {
            end.setMonth(end.getMonth() + 3);
        }

        setEndDate(end.toISOString().split('T')[0]);
    }, [startDate, type]);

    const handleAddKR = () => {
        setManualKRs([...manualKRs, { title: '', metric: 'Tasks Completed', targetValue: 100, unit: '%' }]);
    };

    const handleRemoveKR = (index) => {
        const newKRs = [...manualKRs];
        newKRs.splice(index, 1);
        setManualKRs(newKRs);
    };

    const handleKRChange = (index, field, value) => {
        const newKRs = [...manualKRs];
        newKRs[index][field] = value;
        setManualKRs(newKRs);
    };

    // Fetch sellers and templates
    useEffect(() => {
        const fetchData = async () => {
            try {
                const sRes = await db.getSellers();
                if (sRes && sRes.data && Array.isArray(sRes.data.sellers)) setSellers(sRes.data.sellers);
                else if (sRes && Array.isArray(sRes.sellers)) setSellers(sRes.sellers);
                else if (Array.isArray(sRes)) setSellers(sRes);

                const tRes = await db.getTaskTemplates();
                if (tRes && Array.isArray(tRes.data)) setTemplates(tRes.data);
                else if (Array.isArray(tRes)) setTemplates(tRes);

                const settingsRes = await db.getSettings();
                if (settingsRes && settingsRes.data) {
                    const rules = {};
                    settingsRes.data.forEach(s => {
                        if (['minLqsScore', 'minTitleLength', 'minImageCount', 'minDescLength'].includes(s.key)) {
                            rules[s.key] = Number(s.value);
                        }
                    });
                    setOptimizationRules(prev => ({ ...prev, ...rules }));
                }
            } catch (err) {
                console.error("Failed to fetch initial data:", err);
            }
        };
        fetchData();
    }, []);

    // Fetch ASINs when seller is selected or in step 3
    useEffect(() => {
        if (!selectedSeller) return;
        const fetchAsins = async () => {
            try {
                const res = await db.getAsins({ sellerId: selectedSeller });
                if (res && Array.isArray(res.asins)) setAvailableAsins(res.asins);
            } catch (err) {
                console.error("Failed to fetch ASINs:", err);
            }
        };
        fetchAsins();
    }, [selectedSeller]);

    // Fetch sellers on load
    useEffect(() => {
        const fetchSellers = async () => {
            try {
                const res = await db.getSellers();
                // Check if response has data object containing sellers
                if (res && res.data && Array.isArray(res.data.sellers)) {
                    setSellers(res.data.sellers);
                } else if (res && Array.isArray(res.sellers)) {
                    setSellers(res.sellers);
                } else if (res && res.success && Array.isArray(res.data)) {
                    // Fallback if data is the array
                    setSellers(res.data);
                } else if (Array.isArray(res)) {
                    // Check if response is directly [...]
                    setSellers(res);
                } else {
                    console.error("Invalid sellers data format:", res);
                    setSellers([]);
                }
            } catch (err) {
                console.error("Failed to fetch sellers:", err);
                setSellers([]);
            }
        };
        fetchSellers();
    }, []);

    // Auto-prefix title when seller or base title changes
    useEffect(() => {
        if (!selectedSeller) {
            setTitle(baseTitle);
            return;
        }

        const seller = sellers.find(s => (s._id || s.id) === selectedSeller);
        if (seller) {
            const prefix = `[${seller.name}] `;
            // Only update if it doesn't already have the correct prefix or is just the base
            if (!baseTitle.startsWith(prefix)) {
                setTitle(`${prefix}${baseTitle}`);
            } else {
                setTitle(baseTitle);
            }
        }
    }, [selectedSeller, baseTitle, sellers]);

    const handleStep1Submit = async (e) => {
        if (e) e.preventDefault();
        setLoading(true);
        try {
            const objectiveData = {
                title,
                goal,
                measurementMetrics,
                type,
                startDate,
                endDate,
                sellerId: selectedSeller?._id || selectedSeller,
                owners,
                status: 'NOT_STARTED'
            };

            let res;
            if (createdObjective) {
                res = await db.updateObjective(createdObjective._id || createdObjective.id, objectiveData);
            } else {
                res = await db.createObjective(objectiveData);
            }

            if (!res) {
                throw new Error('No response from server');
            }

            if (!res || (!res.data && !res._id && !res.id)) {
                throw new Error('Invalid response from server');
            }

            const obj = res.data || res;
            setCreatedObjective(obj);
            setStep(2); // Move to Template Selection
        } catch (error) {
            console.error('Failed to save project', error);
            alert('Failed to save project. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleStep2Submit = () => {
        if (selectedTemplates.length === 0) {
            alert('Please select at least one task template');
            return;
        }
        setStep(3); // Move to Task Config
    };

    const handleFinalSubmit = async () => {
        if (selectedTemplates.length === 0) return;
        setLoading(true);
        try {
            for (const template of selectedTemplates) {
                // Create a Key Result for each template
                const krRes = await db.createKeyResult({
                    title: template.title,
                    objectiveId: createdObjective._id || createdObjective.id,
                    metric: 'Completion',
                    targetValue: 100,
                    unit: '%',
                    status: 'NOT_STARTED'
                });

                const kr = krRes.data || krRes;
                const krId = kr._id || kr.id;

                // Generate 1 Task for ALL selected ASINs (or one generic task)
                const sellerObj = sellers.find(s => (s._id || s.id) === (createdObjective.sellerId || selectedSeller));
                const fallbackManager = sellerObj?.managers?.[0]?._id || sellerObj?.managers?.[0];

                await db.createAction({
                    title: template.title,
                    description: template.description,
                    type: template.type,
                    priority: template.priority,
                    keyResultId: krId,
                    sellerId: createdObjective.sellerId || selectedSeller,
                    asins: selectedAsins, // Pass the array of IDs
                    assignedTo: defaultAssignee || owners[0] || fallbackManager || '',
                    status: 'PENDING'
                });
            }

            if (onObjectiveCreated) onObjectiveCreated();
            if (onClose) onClose();
        } catch (error) {
            console.error('Failed to create tasks', error);
            alert('Failed to create tasks. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const toggleTemplate = (template) => {
        const isSelected = selectedTemplates.some(t => t._id === template._id);
        if (isSelected) {
            setSelectedTemplates(selectedTemplates.filter(t => t._id !== template._id));
        } else {
            setSelectedTemplates([...selectedTemplates, template]);
        }
    };

    const toggleCategory = (category, categoryTemplates) => {
        const allSelected = categoryTemplates.every(ct =>
            selectedTemplates.some(st => st._id === ct._id)
        );

        if (allSelected) {
            // Unselect all in this category
            setSelectedTemplates(selectedTemplates.filter(st =>
                !categoryTemplates.some(ct => ct._id === st._id)
            ));
        } else {
            // Select all in this category (avoid duplicates)
            const remaining = categoryTemplates.filter(ct =>
                !selectedTemplates.some(st => st._id === ct._id)
            );
            setSelectedTemplates([...selectedTemplates, ...remaining]);
        }
    };

    const toggleAsin = (asinId) => {
        if (selectedAsins.includes(asinId)) {
            setSelectedAsins(selectedAsins.filter(id => id !== asinId));
        } else {
            setSelectedAsins([...selectedAsins, asinId]);
        }
    };

    const autoSelectNeedingOptimization = () => {
        const needing = availableAsins.filter(asin => {
            const isTitleShort = !asin.title || (asin.title.length < optimizationRules.minTitleLength);
            const isImageCountLow = (asin.imagesCount || 0) < optimizationRules.minImageCount;
            const isDescShort = (asin.descLength || 0) < optimizationRules.minDescLength;
            const isLqsLow = (asin.lqs || 0) < optimizationRules.minLqsScore;
            const noAplus = !asin.hasAplus;

            return isTitleShort || isImageCountLow || isDescShort || isLqsLow || noAplus;
        }).map(asin => asin._id);

        if (needing.length === 0) {
            alert("No ASINs found needing optimization based on current rules.");
        } else {
            setSelectedAsins([...new Set([...selectedAsins, ...needing])]);
        }
    };

    return (
        <div className="d-flex flex-column" style={{ maxHeight: '90vh', minWidth: '600px' }}>
            <div className="modal-header bg-white border-bottom p-4 d-flex justify-content-between align-items-center">
                <div>
                    <h5 className="fw-bold mb-0">{objective ? 'Edit Project' : 'Create New Project'}</h5>
                    <div className="small text-muted mt-1">
                        Step {step} of 3: {step === 1 ? 'Project Details' : step === 2 ? 'Select Template' : 'Configure Tasks'}
                    </div>
                </div>
                <button onClick={onClose} className="btn btn-icon btn-sm text-muted">
                    <X size={20} />
                </button>
            </div>

            <div className="modal-body p-4" style={{ overflowY: 'auto' }}>
                {step === 1 && (
                    <form id="step1Form" onSubmit={handleStep1Submit}>
                        <div className="row g-4">
                            <div className="col-12">
                                <label className="form-label small fw-bold text-muted text-uppercase">Seller / Account</label>
                                <select
                                    className="form-select form-select-lg"
                                    value={selectedSeller}
                                    onChange={(e) => setSelectedSeller(e.target.value)}
                                    required
                                >
                                    <option value="">Select Seller</option>
                                    {sellers.map(s => {
                                        const managerNames = s.managers && s.managers.length > 0
                                            ? s.managers.map(m => `${m.firstName} ${m.lastName}`).join(', ')
                                            : null;
                                        return (
                                            <option key={s._id || s.id} value={s._id || s.id}>
                                                {s.name} ({s.marketplace}){managerNames ? ` — Manager: ${managerNames}` : ''}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>

                            <div className="col-12">
                                <label className="form-label small fw-bold text-muted text-uppercase">Project Title</label>
                                <input
                                    type="text"
                                    className="form-control form-control-lg"
                                    placeholder="e.g., Growth Strategy"
                                    value={baseTitle}
                                    onChange={(e) => setBaseTitle(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="col-12">
                                <label className="form-label small fw-bold text-muted text-uppercase">Goal</label>
                                <textarea
                                    className="form-control"
                                    rows="2"
                                    placeholder="What is the primary goal of this project?"
                                    value={goal}
                                    onChange={(e) => setGoal(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="col-12">
                                <label className="form-label small fw-bold text-muted text-uppercase">Measurement Metrics</label>
                                <textarea
                                    className="form-control"
                                    rows="2"
                                    placeholder="How will success be measured? (e.g., Increase sales by 20%)"
                                    value={measurementMetrics}
                                    onChange={(e) => setMeasurementMetrics(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="col-12">
                                <label className="form-label small fw-bold text-muted text-uppercase">Project Owners (Optional)</label>
                                {/* Selected owners as badges */}
                                {owners.length > 0 && (
                                    <div className="d-flex flex-wrap gap-2 mb-2">
                                        {owners.map(ownerId => {
                                            const u = users.find(u => (u._id || u.id) === ownerId);
                                            if (!u) return null;
                                            return (
                                                <span key={ownerId} className="badge bg-primary d-flex align-items-center gap-1 px-2 py-1" style={{ fontSize: '0.8rem' }}>
                                                    {u.firstName} {u.lastName}
                                                    <button
                                                        type="button"
                                                        className="btn-close btn-close-white ms-1"
                                                        style={{ fontSize: '0.5rem' }}
                                                        onClick={() => setOwners(owners.filter(id => id !== ownerId))}
                                                    />
                                                </span>
                                            );
                                        })}
                                    </div>
                                )}
                                {/* Search + checkbox list */}
                                <input
                                    type="text"
                                    className="form-control form-control-sm mb-2"
                                    placeholder="Search users..."
                                    value={ownerSearchQuery}
                                    onChange={e => setOwnerSearchQuery(e.target.value)}
                                />
                                <div className="border rounded-3 bg-light" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                                    {users
                                        .filter(u => {
                                            const name = u.firstName ? `${u.firstName} ${u.lastName}` : (u.name || u.email);
                                            return name.toLowerCase().includes(ownerSearchQuery.toLowerCase());
                                        })
                                        .map(u => {
                                            const uid = u._id || u.id;
                                            const isSelected = owners.includes(uid);
                                            const name = u.firstName ? `${u.firstName} ${u.lastName}` : (u.name || u.email);
                                            return (
                                                <label
                                                    key={uid}
                                                    className={`d-flex align-items-center gap-2 px-3 py-2 cursor-pointer ${isSelected ? 'bg-primary bg-opacity-10' : 'hover-bg-light'}`}
                                                    style={{ cursor: 'pointer' }}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        className="form-check-input m-0"
                                                        checked={isSelected}
                                                        onChange={() => {
                                                            if (isSelected) {
                                                                setOwners(owners.filter(id => id !== uid));
                                                            } else {
                                                                setOwners([...owners, uid]);
                                                            }
                                                        }}
                                                    />
                                                    <span className="small fw-semibold">{name}</span>
                                                    <span className="small text-muted ms-auto">{u.email}</span>
                                                </label>
                                            );
                                        })
                                    }
                                </div>
                            </div>

                            <div className="col-12">
                                <label className="form-label small fw-bold text-muted text-uppercase">Final Name (Auto-Prefixed)</label>
                                <div className="p-3 bg-light rounded-3 border fw-bold text-primary">
                                    {title || 'Select seller and title...'}
                                </div>
                            </div>

                            <div className="col-md-4">
                                <label className="form-label small fw-bold text-muted text-uppercase">Type</label>
                                <select className="form-select" value={type} onChange={(e) => setType(e.target.value)}>
                                    <option value="WEEKLY">Weekly</option>
                                    <option value="MONTHLY">Monthly</option>
                                    <option value="QUARTERLY">Quarterly</option>
                                </select>
                            </div>
                            <div className="col-md-4">
                                <label className="form-label small fw-bold text-muted text-uppercase">Start</label>
                                <input type="date" className="form-control" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                            </div>
                            <div className="col-md-4">
                                <label className="form-label small fw-bold text-muted text-uppercase">End</label>
                                <input type="date" className="form-control" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
                            </div>
                        </div>
                    </form>
                )}

                {step === 2 && (
                    <div className="template-selection">
                        {/* Group templates by category */}
                        {Object.entries(
                            templates.reduce((acc, t) => {
                                acc[t.category] = acc[t.category] || [];
                                acc[t.category].push(t);
                                return acc;
                            }, {})
                        ).map(([category, categoryTemplates]) => {
                            const allSelected = categoryTemplates.every(ct =>
                                selectedTemplates.some(st => st._id === ct._id)
                            );

                            return (
                                <div key={category} className="mb-4">
                                    <div className="d-flex justify-content-between align-items-center mb-3">
                                        <h6 className="fw-bold text-uppercase small text-muted mb-0">{category}</h6>
                                        <button
                                            className={`btn btn-sm ${allSelected ? 'btn-primary' : 'btn-outline-primary'} py-1 px-3 rounded-pill`}
                                            onClick={() => toggleCategory(category, categoryTemplates)}
                                        >
                                            {allSelected ? 'Deselect All' : 'Select Category'}
                                        </button>
                                    </div>
                                    <div className="row g-3">
                                        {categoryTemplates.map(t => {
                                            const isSelected = selectedTemplates.some(st => st._id === t._id);
                                            return (
                                                <div key={t._id || t.id} className="col-md-6">
                                                    <div
                                                        className={`card h-100 cursor-pointer border-2 transition-all ${isSelected ? 'border-primary bg-soft-primary' : 'border-light hov-border-primary'}`}
                                                        onClick={() => toggleTemplate(t)}
                                                    >
                                                        <div className="card-body p-3">
                                                            <div className="d-flex justify-content-between align-items-start mb-2">
                                                                <span className="badge bg-soft-primary text-primary small">{t.type}</span>
                                                                {isSelected && <div className="bg-primary text-white rounded-pill p-1"><Check size={14} /></div>}
                                                            </div>
                                                            <h6 className="fw-bold mb-1">{t.title}</h6>
                                                            <p className="text-muted small mb-0 text-truncate-2">{t.description}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {step === 3 && (
                    <div className="task-customization">
                        <div className="mb-4">
                            <h6 className="fw-bold text-uppercase small text-muted mb-3">Assign Tasks To</h6>
                            <select
                                className="form-select"
                                value={defaultAssignee}
                                onChange={(e) => setDefaultAssignee(e.target.value)}
                            >
                                <option value="">Auto-assign to Project Owner</option>
                                {users.map(u => (
                                    <option key={u.id || u._id} value={u.id || u._id}>
                                        {u.firstName ? `${u.firstName} ${u.lastName}` : (u.name || u.email)}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="mb-4">
                            <div className="d-flex justify-content-between align-items-center mb-3">
                                <h6 className="fw-bold text-uppercase small text-muted mb-0">Targeted ASINs (Optional)</h6>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-primary rounded-pill d-flex align-items-center gap-1 px-3"
                                    onClick={autoSelectNeedingOptimization}
                                >
                                    <Sparkles size={14} />
                                    Suggest ASINs Needing Attention
                                </button>
                            </div>
                            <div className="asin-selector bg-light rounded-3 border p-3" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                {availableAsins.length > 0 ? (
                                    <div className="row g-2">
                                        {availableAsins.map(asin => (
                                            <div key={asin._id} className="col-12">
                                                <div
                                                    className={`d-flex align-items-center p-2 rounded-2 cursor-pointer transition-all ${selectedAsins.includes(asin._id) ? 'bg-primary text-white' : 'bg-white hover-bg-light'}`}
                                                    onClick={() => toggleAsin(asin._id)}
                                                >
                                                    <div className={`me-3 border rounded-pill d-flex align-items-center justify-content-center ${selectedAsins.includes(asin._id) ? 'bg-white text-primary border-white' : 'border-secondary'}`} style={{ width: '20px', height: '20px' }}>
                                                        {selectedAsins.includes(asin._id) && <Check size={12} />}
                                                    </div>
                                                    <div className="small fw-bold me-2">{asin.asinCode}</div>
                                                    <div className="small text-truncate opacity-75">{asin.title}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-4 text-muted">No ASINs found for this seller.</div>
                                )}
                            </div>
                            <div className="form-text mt-2 small text-muted">
                                {selectedAsins.length > 0
                                    ? `Linking ${selectedAsins.length} ASINs to each created task.`
                                    : "No ASINs selected. A single generic task will be created."}
                            </div>
                        </div>

                        <div className="p-3 bg-soft-info text-info rounded-3 border border-info border-opacity-25 small d-flex gap-3">
                            <Sparkles className="flex-shrink-0" size={20} />
                            <div>
                                <strong>Multi-Template Summary:</strong>
                                <br />
                                <ul>
                                    <li>Templates Selected: {selectedTemplates.length}</li>
                                    <li>ASINs Selected: {selectedAsins.length || 'Base (1)'}</li>
                                    <li>Total Tasks to Generate: <strong>{selectedTemplates.length}</strong></li>
                                </ul>
                                Each task will include all {selectedAsins.length || 1} selected ASINs.
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="modal-footer bg-white border-top p-4 d-flex justify-content-between align-items-center">
                <button
                    type="button"
                    onClick={() => step > 1 ? setStep(step - 1) : onClose()}
                    className="btn btn-light"
                    disabled={loading}
                >
                    {step === 1 ? 'Cancel' : 'Back'}
                </button>

                <div className="d-flex gap-2">
                    {step === 1 ? (
                        <button
                            form="step1Form"
                            type="submit"
                            className="btn btn-primary px-4 d-flex align-items-center gap-2"
                            disabled={loading || !selectedSeller || !baseTitle}
                        >
                            {loading ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                            {loading ? 'Creating...' : 'Continue'}
                        </button>
                    ) : step === 2 ? (
                        <button
                            onClick={handleStep2Submit}
                            className="btn btn-primary px-4"
                            disabled={selectedTemplates.length === 0}
                        >
                            Configure Tasks ({selectedTemplates.length} Selected)
                        </button>
                    ) : (
                        <button
                            onClick={handleFinalSubmit}
                            className="btn btn-success px-4 d-flex align-items-center gap-2"
                            disabled={loading}
                        >
                            {loading ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                            {loading ? 'Finalize & Create Tasks' : 'Finalize Project'}
                        </button>
                    )}
                </div>
            </div>

            <style>{`
                .bg-soft-primary { background-color: #e7f1ff; }
                .bg-soft-info { background-color: #e1f5fe; }
                .cursor-pointer { cursor: pointer; }
                .hov-border-primary:hover { border-color: #0d6efd !important; }
                .hover-bg-light:hover { background-color: #f8f9fa !important; }
                .transition-all { transition: all 0.2s ease; }
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default ObjectiveManager;
