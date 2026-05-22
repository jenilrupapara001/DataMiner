import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info, MessageSquare } from 'lucide-react';

const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

// Custom helper to select icon based on toast type
const getToastIcon = (type) => {
    switch (type) {
        case 'success':
            return <CheckCircle2 size={20} />;
        case 'error':
        case 'danger':
            return <AlertCircle size={20} />;
        case 'warning':
            return <AlertTriangle size={20} />;
        case 'message':
            return <MessageSquare size={20} />;
        case 'info':
        default:
            return <Info size={20} />;
    }
};

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    const addToast = useCallback((param, typeParam = 'info', durationParam = 5000) => {
        let title = '';
        let message = '';
        let type = typeParam;
        let duration = durationParam;
        let onClick = undefined;

        if (typeof param === 'object' && param !== null && !Array.isArray(param)) {
            title = param.title || '';
            message = param.message || '';
            type = param.type || 'info';
            duration = param.duration !== undefined ? param.duration : 5000;
            onClick = param.onClick;
        } else {
            // Support positional arguments: addToast(message, type, duration)
            message = String(param);
            type = typeParam;
            duration = durationParam;
        }

        // Auto-generate title from type if none is provided
        if (!title && message) {
            title = type.charAt(0).toUpperCase() + type.slice(1);
        }

        const id = Math.random().toString(36).substr(2, 9);
        setToasts(prev => [...prev, { id, title, message, type, onClick, duration }]);

        if (duration) {
            setTimeout(() => {
                removeToast(id);
            }, duration);
        }
    }, [removeToast]);

    return (
        <ToastContext.Provider value={{ addToast }}>
            {children}
            <div className="toast-container-teams">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`teams-toast ${toast.type}`}
                        onClick={() => {
                            if (toast.onClick) toast.onClick();
                            removeToast(toast.id);
                        }}
                    >
                        <div className="teams-toast-icon-wrapper">
                            {getToastIcon(toast.type)}
                        </div>
                        <div className="teams-toast-content">
                            <div className="teams-toast-title">{toast.title}</div>
                            <div className="teams-toast-message">{toast.message}</div>
                        </div>
                        <button
                            className="teams-toast-close"
                            onClick={(e) => {
                                e.stopPropagation();
                                removeToast(toast.id);
                            }}
                        >
                            <X size={14} />
                        </button>
                        {toast.duration ? (
                            <div 
                                className="teams-toast-progress" 
                                style={{ animationDuration: `${toast.duration}ms` }}
                            />
                        ) : null}
                    </div>
                ))}
            </div>
            <style>{`
                .toast-container-teams {
                    position: fixed;
                    bottom: 24px;
                    right: 24px;
                    z-index: 99999;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    pointer-events: none;
                }
                .teams-toast {
                    pointer-events: auto;
                    position: relative;
                    width: 360px;
                    padding: 16px;
                    border-radius: 12px;
                    display: flex;
                    align-items: flex-start;
                    gap: 14px;
                    background: rgba(255, 255, 255, 0.92);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.02);
                    border: 1px solid rgba(255, 255, 255, 0.6);
                    border-left: 5px solid #6366F1; /* Default Purple */
                    animation: slideIn 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
                    cursor: pointer;
                    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                    overflow: hidden;
                }
                .teams-toast:hover {
                    transform: translateY(-4px) scale(1.02);
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.12);
                }
                
                /* Border color and background tint mapping based on type */
                .teams-toast.success {
                    border-left-color: #10B981;
                    background: rgba(240, 253, 244, 0.92);
                }
                .teams-toast.error, .teams-toast.danger {
                    border-left-color: #EF4444;
                    background: rgba(254, 242, 242, 0.92);
                }
                .teams-toast.warning {
                    border-left-color: #F59E0B;
                    background: rgba(255, 251, 235, 0.92);
                }
                .teams-toast.info {
                    border-left-color: #3B82F6;
                    background: rgba(239, 246, 255, 0.92);
                }
                .teams-toast.message {
                    border-left-color: #4F46E5;
                    background: rgba(245, 243, 255, 0.92);
                }
                
                .teams-toast-icon-wrapper {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 36px;
                    height: 36px;
                    border-radius: 10px;
                    flex-shrink: 0;
                    transition: transform 0.2s;
                }
                .teams-toast:hover .teams-toast-icon-wrapper {
                    transform: scale(1.1);
                }
                
                /* Icon color & bg mapping based on type */
                .teams-toast.success .teams-toast-icon-wrapper {
                    color: #10B981;
                    background: rgba(16, 185, 129, 0.12);
                }
                .teams-toast.error .teams-toast-icon-wrapper, .teams-toast.danger .teams-toast-icon-wrapper {
                    color: #EF4444;
                    background: rgba(239, 68, 68, 0.12);
                }
                .teams-toast.warning .teams-toast-icon-wrapper {
                    color: #F59E0B;
                    background: rgba(245, 158, 11, 0.12);
                }
                .teams-toast.info .teams-toast-icon-wrapper {
                    color: #3B82F6;
                    background: rgba(59, 130, 246, 0.12);
                }
                .teams-toast.message .teams-toast-icon-wrapper {
                    color: #4F46E5;
                    background: rgba(79, 70, 229, 0.12);
                }
                
                .teams-toast-content {
                    flex: 1;
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                }
                .teams-toast-title {
                    font-weight: 750;
                    font-size: 0.95rem;
                    color: #1E293B;
                    line-height: 1.3;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .teams-toast-message {
                    font-size: 0.85rem;
                    color: #475569;
                    line-height: 1.4;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }
                .teams-toast-close {
                    background: none;
                    border: none;
                    color: #94A3B8;
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 6px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                    margin-top: -2px;
                }
                .teams-toast-close:hover {
                    background: rgba(0, 0, 0, 0.06);
                    color: #475569;
                }
                
                .teams-toast-progress {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    height: 3px;
                    width: 100%;
                    transform-origin: left;
                    animation: shrink linear forwards;
                }
                
                /* Progress bar background based on type */
                .teams-toast.success .teams-toast-progress {
                    background: #10B981;
                }
                .teams-toast.error .teams-toast-progress, .teams-toast.danger .teams-toast-progress {
                    background: #EF4444;
                }
                .teams-toast.warning .teams-toast-progress {
                    background: #F59E0B;
                }
                .teams-toast.info .teams-toast-progress {
                    background: #3B82F6;
                }
                .teams-toast.message .teams-toast-progress {
                    background: #4F46E5;
                }
                
                @keyframes slideIn {
                    from { 
                        opacity: 0; 
                        transform: translateX(50px) scale(0.9); 
                    }
                    to { 
                        opacity: 1; 
                        transform: translateX(0) scale(1); 
                    }
                }
                @keyframes shrink {
                    from { transform: scaleX(1); }
                    to { transform: scaleX(0); }
                }
            `}</style>
        </ToastContext.Provider>
    );
};
