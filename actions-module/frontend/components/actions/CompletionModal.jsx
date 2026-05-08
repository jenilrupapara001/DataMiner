import React, { useState, useEffect } from 'react';
import { X, Mic, Square, Play, Pause, Clock, Calendar, Repeat } from 'lucide-react';

const CompletionModal = ({ action, isOpen, onClose, onComplete }) => {
    const [formData, setFormData] = useState({
        remarks: '',
        stage: 'COMPLETED',
        recurring: {
            enabled: false,
            frequency: 'WEEKLY',
            daysOfWeek: []
        }
    });

    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState(null);
    const [transcript, setTranscript] = useState('');
    const [mediaRecorder, setMediaRecorder] = useState(null);
    const [recognition, setRecognition] = useState(null);

    useEffect(() => {
        // Initialize Web Speech API
        if ('webkitSpeechRecognition' in window) {
            const speechRecognition = new window.webkitSpeechRecognition();
            speechRecognition.continuous = true;
            speechRecognition.interimResults = true;
            speechRecognition.lang = 'en-US';

            speechRecognition.onresult = (event) => {
                let finalTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript + ' ';
                    }
                }
                if (finalTranscript) {
                    setTranscript(prev => prev + finalTranscript);
                    setFormData(prev => ({
                        ...prev,
                        remarks: prev.remarks + finalTranscript
                    }));
                }
            };

            setRecognition(speechRecognition);
        }
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const toggleRecurring = () => {
        setFormData(prev => ({
            ...prev,
            recurring: { ...prev.recurring, enabled: !prev.recurring.enabled }
        }));
    };

    const toggleDay = (day) => {
        setFormData(prev => {
            const days = prev.recurring.daysOfWeek.includes(day)
                ? prev.recurring.daysOfWeek.filter(d => d !== day)
                : [...prev.recurring.daysOfWeek, day];
            return {
                ...prev,
                recurring: { ...prev.recurring, daysOfWeek: days }
            };
        });
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            const chunks = [];

            recorder.ondataavailable = (e) => chunks.push(e.data);
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'audio/webm' });
                setAudioBlob(blob);
            };

            recorder.start();
            setMediaRecorder(recorder);
            setIsRecording(true);

            // Start speech recognition
            if (recognition) {
                recognition.start();
            }
        } catch (error) {
            console.error('Error accessing microphone:', error);
            alert('Could not access microphone. Please check permissions.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
        if (recognition) {
            recognition.stop();
        }
        setIsRecording(false);
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        const completionData = {
            ...formData,
            audioBlob,
            transcript,
            completedAt: new Date()
        };

        onComplete(action._id, completionData);
    };

    if (!isOpen) return null;

    const duration = action.timeTracking?.startedAt
        ? Math.floor((new Date() - new Date(action.timeTracking.startedAt)) / 1000 / 60)
        : 0;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-dialog modal-lg" onClick={(e) => e.stopPropagation()}>
                <div className="modal-content">
                    <div className="modal-header">
                        <h5 className="modal-title">Complete Task</h5>
                        <button type="button" className="btn-close" onClick={onClose} aria-label="Close">
                            <X style={{ width: '20px', height: '20px' }} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="modal-body">
                            {/* Task Summary */}
                            <div className="mb-3">
                                <h6 className="text-muted mb-2">Task: {action.title}</h6>
                                <div className="d-flex align-items-center gap-3 text-sm text-muted">
                                    <span>
                                        <Clock style={{ width: '14px', height: '14px' }} className="me-1" />
                                        Duration: {duration} minutes
                                    </span>
                                    {action.timeTracking?.timeLimit && (
                                        <span className={duration > action.timeTracking.timeLimit ? 'text-danger' : ''}>
                                            Limit: {action.timeTracking.timeLimit} minutes
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Completion Remarks */}
                            <div className="mb-3">
                                <label className="form-label">Completion Remarks *</label>
                                <div className="position-relative">
                                    <textarea
                                        name="remarks"
                                        value={formData.remarks}
                                        onChange={handleChange}
                                        required
                                        rows="5"
                                        className="form-control"
                                        placeholder="Describe what you did, challenges faced, and outcomes..."
                                    />
                                    <button
                                        type="button"
                                        className={`btn btn-sm position-absolute ${isRecording ? 'btn-danger' : 'btn-outline-primary'}`}
                                        style={{ top: '10px', right: '10px' }}
                                        onClick={isRecording ? stopRecording : startRecording}
                                        title={isRecording ? 'Stop Recording' : 'Start Voice Recording'}
                                    >
                                        {isRecording ? (
                                            <>
                                                <Square style={{ width: '14px', height: '14px' }} className="me-1" />
                                                Stop
                                            </>
                                        ) : (
                                            <>
                                                <Mic style={{ width: '14px', height: '14px' }} className="me-1" />
                                                Record
                                            </>
                                        )}
                                    </button>
                                </div>
                                {isRecording && (
                                    <small className="text-danger d-flex align-items-center mt-1">
                                        <span className="recording-indicator me-2"></span>
                                        Recording... Speak clearly into your microphone
                                    </small>
                                )}
                                {transcript && (
                                    <small className="text-success mt-1 d-block">
                                        ✓ Transcribed {transcript.split(' ').length} words
                                    </small>
                                )}
                            </div>

                            {/* Stage Selection */}
                            <div className="mb-3">
                                <label className="form-label">Final Stage</label>
                                <select
                                    name="stage"
                                    value={formData.stage}
                                    onChange={handleChange}
                                    className="form-select"
                                >
                                    <option value="REVIEW">Review Required</option>
                                    <option value="COMPLETED">Completed</option>
                                </select>
                            </div>

                            {/* Recurring Task Configuration */}
                            <div className="mb-3">
                                <div className="form-check mb-2">
                                    <input
                                        type="checkbox"
                                        className="form-check-input"
                                        id="recurringCheck"
                                        checked={formData.recurring.enabled}
                                        onChange={toggleRecurring}
                                    />
                                    <label className="form-check-label" htmlFor="recurringCheck">
                                        <Repeat style={{ width: '14px', height: '14px' }} className="me-1" />
                                        Repeat this task
                                    </label>
                                </div>

                                {formData.recurring.enabled && (
                                    <div className="recurring-config ps-4">
                                        <div className="mb-2">
                                            <label className="form-label">Frequency</label>
                                            <select
                                                value={formData.recurring.frequency}
                                                onChange={(e) => setFormData(prev => ({
                                                    ...prev,
                                                    recurring: { ...prev.recurring, frequency: e.target.value }
                                                }))}
                                                className="form-select form-select-sm"
                                            >
                                                <option value="DAILY">Daily</option>
                                                <option value="WEEKLY">Weekly</option>
                                                <option value="MONTHLY">Monthly</option>
                                            </select>
                                        </div>

                                        {formData.recurring.frequency === 'WEEKLY' && (
                                            <div>
                                                <label className="form-label">Repeat on</label>
                                                <div className="day-selector d-flex gap-2 flex-wrap">
                                                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
                                                        <div key={i} className="form-check">
                                                            <input
                                                                type="checkbox"
                                                                className="form-check-input"
                                                                id={`day-${i}`}
                                                                checked={formData.recurring.daysOfWeek.includes(i)}
                                                                onChange={() => toggleDay(i)}
                                                            />
                                                            <label className="form-check-label" htmlFor={`day-${i}`}>
                                                                {day}
                                                            </label>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button type="button" onClick={onClose} className="btn btn-secondary">
                                Cancel
                            </button>
                            <button type="submit" className="btn btn-success">
                                <i className="bi bi-check-circle me-2"></i>
                                Complete Task
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default CompletionModal;
