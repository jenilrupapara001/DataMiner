import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    X, Target, TrendingUp, FileText, Activity, 
    AlertTriangle, Clock, ShieldCheck, Sparkles,
    ChevronDown, MoreHorizontal, User, Calendar,
    ExternalLink, CheckCircle2, Layout, Play
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { db } from '../../services/db';

/**
 * ActionPane - Modern Side Drawer Task Detail
 * 
 * Replaces ActionDetailModal with a fluid, side-aligned experience.
 * Features Brandcentral glassmorphism and integrated AI insights.
 */
const ActionPane = ({ 
    isOpen, onClose, actionId, initialAction, 
    onStart, onSubmit, onEdit, onDelete 
}) => {
    const [action, setAction] = useState(initialAction);
    const [loading, setLoading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [instructions, setInstructions] = useState('');
    const [activeTab, setActiveTab] = useState('DETAILS'); // DETAILS, ACTIVITY, ASINS

    useEffect(() => {
        if (isOpen && actionId && !initialAction) {
            fetchActionDetails();
        } else if (initialAction) {
            setAction(initialAction);
            if (initialAction.itemType === 'ACTION' || !initialAction.itemType) fetchInstructions(initialAction);
        }
    }, [isOpen, actionId, initialAction]);

    const fetchActionDetails = async () => {
        setLoading(true);
        try {
            const res = await db.request(`/actions/${actionId}`);
            const data = res?.data || res;
            setAction(data);
            if (data) fetchInstructions(data);
        } catch (err) {
            console.error('Failed to fetch action details:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchInstructions = async (item) => {
        if (item.instructions && !analyzing) {
            setInstructions(item.instructions);
            return;
        }
        setAnalyzing(true);
        try {
            const res = await db.getActionInstructions(item._id || item.id);
            if (res && res.success) {
                setInstructions(res.data);
            }
        } catch (err) {
            console.error('Error fetching instructions:', err);
        } finally {
            setAnalyzing(false);
        }
    };

    const handleStart = () => {
        if (onStart && action) onStart(action);
    };

    const handleSubmit = () => {
        if (onSubmit && action) onSubmit(action);
    };

    const handleEdit = () => {
        if (onEdit && action) onEdit(action);
    };

    const handleDelete = () => {
        if (onDelete && action) {
            onDelete(action._id || action.id);
            onClose();
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'COMPLETED': return 'bg-emerald-50 text-emerald-600 border-emerald-200';
            case 'REVIEW': return 'bg-indigo-50 text-indigo-600 border-indigo-200';
            case 'IN_PROGRESS': return 'bg-blue-50 text-blue-600 border-blue-200';
            case 'REJECTED': return 'bg-rose-50 text-rose-600 border-rose-200';
            default: return 'bg-slate-50 text-slate-600 border-slate-200';
        }
    };

    const getPriorityColor = (p) => {
        switch (p) {
            case 'URGENT': return 'text-rose-600 bg-rose-50 border-rose-100';
            case 'HIGH': return 'text-amber-600 bg-amber-50 border-amber-100';
            case 'MEDIUM': return 'text-blue-600 bg-blue-50 border-blue-100';
            default: return 'text-slate-500 bg-slate-50 border-slate-100';
        }
    };

    if (!isOpen && !initialAction) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-slate-900/20 backdrop-blur-[2px] z-[1050]"
                    />

                    {/* Pane */}
                    <motion.div 
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed top-0 right-0 h-full w-full max-w-xl bg-white shadow-2xl z-[1060] flex flex-col border-l border-slate-200 overflow-hidden text-slate-900"
                    >
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-50 rounded-lg text-slate-400">
                                    {action?.itemType === 'OBJECTIVE' ? <Target size={18} /> : 
                                     action?.itemType === 'KR' ? <TrendingUp size={18} /> : <FileText size={18} />}
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5 block">
                                        {action?.itemType || 'ACTION'} • ID: {(action?._id || action?.id)?.substring(0, 8)}
                                    </span>
                                    <h2 className="text-base font-bold text-slate-900 truncate" title={action?.title}>{action?.title}</h2>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-full transition-all">
                                    <ExternalLink size={18} />
                                </button>
                                <button 
                                    onClick={onClose}
                                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-all"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Sticky Action Bar */}
                        <div className="px-6 py-2 bg-slate-50/50 border-b border-slate-100 flex items-center gap-4">
                            <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider flex items-center gap-1.5 ${getStatusColor(action?.status)}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${
                                    action?.status === 'COMPLETED' ? 'bg-emerald-500' : 
                                    action?.status === 'IN_PROGRESS' ? 'bg-blue-500' : 
                                    action?.status === 'REVIEW' ? 'bg-indigo-500' : 'bg-slate-400'
                                }`} />
                                {action?.status?.replace('_', ' ') || 'PENDING'}
                            </div>

                            <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${getPriorityColor(action?.priority)} border`}>
                                {action?.priority || 'MEDIUM'}
                            </div>

                            <div className="ml-auto flex items-center gap-2">
                                <span className="text-[11px] font-medium text-slate-400">Assigned to:</span>
                                <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-full pl-1 pr-2.5 py-0.5 shadow-sm">
                                    <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold uppercase">
                                        {(action?.assignedTo?.firstName || 'U').charAt(0)}
                                    </div>
                                    <span className="text-[11px] font-bold text-slate-700">{action?.assignedTo?.firstName || 'User'}</span>
                                    <ChevronDown size={12} className="text-slate-400" />
                                </div>
                            </div>
                        </div>

                        {/* Content Scrollable */}
                        <div className="flex-1 overflow-y-auto px-6 py-8 custom-scrollbar">
                            {/* Tabs */}
                            <div className="flex items-center gap-6 border-b border-slate-100 mb-8">
                                {['DETAILS', 'ACTIVITY', 'ASINS'].map(tab => (
                                    <button 
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={`pb-3 text-xs font-black uppercase tracking-widest transition-all relative ${
                                            activeTab === tab ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                                        }`}
                                    >
                                        {tab}
                                        {activeTab === tab && (
                                            <motion.div 
                                                layoutId="activeTab"
                                                className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" 
                                            />
                                        )}
                                    </button>
                                ))}
                            </div>

                            {activeTab === 'DETAILS' && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="space-y-8"
                                >
                                    {/* Description */}
                                    <section>
                                        <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <FileText size={14} />
                                            <span>Context & Intent</span>
                                        </h3>
                                        <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100">
                                            <p className="text-sm text-slate-600 leading-relaxed italic">
                                                "{action?.description || 'No description provided.'}"
                                            </p>
                                        </div>
                                    </section>

                                    {/* AI Insight Section */}
                                    <section>
                                        <div className="bg-slate-900 rounded-3xl p-6 text-white relative overflow-hidden group">
                                            <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500 rounded-full blur-3xl opacity-20 transition-all group-hover:scale-110" />
                                            
                                            <div className="flex items-center gap-2 mb-4 relative z-10">
                                                <Sparkles className="text-indigo-400" size={18} />
                                                <h4 className="text-[11px] font-black uppercase tracking-widest text-indigo-200">AI Strategy Insight</h4>
                                            </div>

                                            <div className="relative z-10 text-sm text-slate-300 leading-relaxed markdown-content prose prose-invert prose-sm max-w-none">
                                                {analyzing ? (
                                                    <div className="flex items-center gap-2 py-4 text-indigo-400">
                                                        <Activity className="animate-spin" size={16} />
                                                        <span className="font-bold tracking-tight">Synthesizing listing optimization flow...</span>
                                                    </div>
                                                ) : (
                                                    <div className="animate-in fade-in duration-700">
                                                        <ReactMarkdown>
                                                            {instructions || "AI is currently analyzing the GMS trajectory for this task. Recommendations will appear here shortly."}
                                                        </ReactMarkdown>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            <button 
                                                onClick={() => fetchInstructions(action)}
                                                disabled={analyzing}
                                                className="mt-6 w-full py-3 bg-white/10 hover:bg-white/20 border border-white/10 backdrop-blur-md rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                            >
                                                {analyzing ? <Activity className="animate-spin" size={14} /> : <Sparkles size={14} />}
                                                {analyzing ? 'Analyzing...' : 'Analyze Action Viability'}
                                            </button>
                                        </div>
                                    </section>

                                    {/* Progress & Metadata Grid */}
                                    <section className="grid grid-cols-2 gap-4">
                                        <div className="bg-white border border-slate-200 rounded-2xl p-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Activity size={14} className="text-indigo-500" />
                                                <span className="text-[10px] font-black text-slate-400 uppercase">Impact Metric</span>
                                            </div>
                                            <div className="text-lg font-bold text-slate-900">{action?.metric || 'Revenue'}</div>
                                            <div className="flex items-center gap-1 mt-1">
                                                <div className="h-1 flex-1 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className="h-full bg-indigo-500 w-[65%]" />
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-400">65% Target</span>
                                            </div>
                                        </div>

                                        <div className="bg-white border border-slate-200 rounded-2xl p-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Clock size={14} className="text-rose-500" />
                                                <span className="text-[10px] font-black text-slate-400 uppercase">Deadline</span>
                                            </div>
                                            <div className="text-sm font-bold text-slate-900">
                                                {action?.timeTracking?.deadline ? new Date(action.timeTracking.deadline).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'No Date Set'}
                                            </div>
                                            <span className="text-[10px] text-rose-500 font-bold mt-1 block">Ends in 2 days</span>
                                        </div>
                                    </section>
                                </motion.div>
                            )}

                            {activeTab === 'ASINS' && (
                                <motion.div 
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="space-y-4"
                                >
                                    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">Linked Products ({action?.asins?.length || 0})</h3>
                                    <div className="grid grid-cols-1 gap-3">
                                        {action?.asins?.length > 0 ? action.asins.map((asin, i) => (
                                            <div key={i} className="flex items-center gap-4 bg-white border border-slate-200 p-4 rounded-2xl group hover:border-indigo-200 transition-all cursor-pointer">
                                                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                                                    <Layout size={20} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="text-sm font-bold text-slate-900 truncate">{asin.title || 'Product Title...'}</h4>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="px-1.5 py-0.5 bg-slate-100 text-[10px] font-bold text-slate-500 rounded uppercase">ASIN: {asin.asinCode || asin.asin || asin}</span>
                                                        <span className="text-[10px] text-slate-400">BSR: #2,450</span>
                                                    </div>
                                                </div>
                                                <ChevronDown size={16} className="text-slate-300 group-hover:text-indigo-500 -rotate-90" />
                                            </div>
                                        )) : (
                                            <div className="text-center py-20 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                                                <Layout className="mx-auto text-slate-300 mb-3" size={32} />
                                                <p className="text-xs text-slate-400 font-medium">No ASINs linked to this action.</p>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </div>

                        {/* Footer Actions */}
                        <div className="px-6 py-6 border-t border-slate-100 bg-white/80 backdrop-blur-md">
                            <div className="flex items-center justify-between gap-4">
                                <button 
                                    onClick={handleDelete}
                                    className="px-6 py-3 border border-slate-200 rounded-2xl text-[11px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-50 hover:border-rose-100 transition-all"
                                >
                                    Delete
                                </button>
                                <div className="flex items-center gap-3">
                                    <button 
                                        onClick={handleEdit}
                                        className="px-6 py-3 border border-slate-200 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-900 hover:bg-slate-50 transition-all"
                                    >
                                        Edit
                                    </button>
                                    
                                    {action?.status === 'PENDING' || action?.status === 'REJECTED' ? (
                                        <button 
                                            onClick={handleStart}
                                            className="px-8 py-3 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 shadow-xl shadow-slate-200 transition-all flex items-center gap-2"
                                        >
                                            <Play size={14} fill="currentColor" />
                                            Start Task
                                        </button>
                                    ) : action?.status === 'IN_PROGRESS' ? (
                                        <button 
                                            onClick={handleSubmit}
                                            className="px-8 py-3 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all flex items-center gap-2"
                                        >
                                            <CheckCircle2 size={14} />
                                            Submit Review
                                        </button>
                                    ) : (
                                        <button 
                                            disabled
                                            className="px-8 py-3 bg-slate-100 text-slate-400 rounded-2xl text-[11px] font-black uppercase tracking-widest cursor-not-allowed"
                                        >
                                            {action?.status?.replace('_', ' ')}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <style>{`
                            .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                            .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
                            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #CBD5E1; }
                            
                            .markdown-content p { margin-bottom: 1rem; }
                            .markdown-content ul { margin-left: 1.5rem; margin-bottom: 1rem; list-style-type: disc; }
                            .markdown-content li { margin-bottom: 0.5rem; }
                            .markdown-content strong { color: #fff; font-weight: 700; }
                        `}</style>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default ActionPane;
