import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Zap, CheckCircle2, Clock, AlertCircle, 
  TrendingUp, Search, Filter, Plus, 
  ChevronRight, MoreVertical, Sparkles,
  Layers, Target, ShieldCheck
} from 'lucide-react';
import { db } from '../../services/db';

/**
 * Action Hub - Execution Workbench
 * 
 * A high-fidelity task management interface focusing on 
 * AI-driven prioritization and impact.
 */
const ActionWorkbenchView = ({ isEmbed = false, tasks: initialTasks = null }) => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState(initialTasks || []);
  const [loading, setLoading] = useState(!initialTasks);
  const [filter, setFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchTasks();
  }, [filter]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const response = await db.getActions();
      const allTasks = response?.data || response || [];
      setTasks(allTasks);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (p) => {
    switch (p) {
      case 'HIGH': return 'bg-rose-50 text-rose-600 border-rose-100';
      case 'MEDIUM': return 'bg-amber-50 text-amber-600 border-amber-100';
      default: return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  return (
    <div className={`${isEmbed ? '' : 'min-h-screen bg-[#F8FAFC] pb-20'}`}>
      {/* HEADER SECTION */}
      {!isEmbed && (
        <div className="bg-white border-b border-slate-200 px-8 py-6 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 bg-indigo-600 rounded-lg text-white shadow-lg shadow-indigo-200">
                  <Zap size={18} fill="currentColor" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Action Hub</h1>
              </div>
              <p className="text-slate-500 text-sm font-medium">Execution Workbench • Growth Operating System</p>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Find tasks..." 
                  className="pl-10 pr-4 py-2 bg-slate-100 border-transparent rounded-full text-sm focus:bg-white focus:border-indigo-500 transition-all outline-none w-64 shadow-inner"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-full text-sm font-bold shadow-lg shadow-indigo-100 hover:shadow-indigo-200 transition-all">
                <Plus size={18} />
                <span>Create Task</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`${isEmbed ? '' : 'max-w-7xl mx-auto px-8 py-10'}`}>
        {/* TODAY'S FOCUS (HERO) */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Sparkles size={20} className="text-indigo-500" />
              <span>Today's Strategy Focus</span>
            </h2>
            <button className="text-xs font-bold text-indigo-600 hover:underline">View Roadmap</button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* FOCUS CARDS SCROLLABLE OR GRID */}
            {[1, 2, 3].map((i) => (
              <motion.div 
                key={i}
                whileHover={{ y: -4 }}
                className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group cursor-pointer"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-bl-full -mr-12 -mt-12 transition-all group-hover:scale-110" />
                
                <div className="flex items-start justify-between mb-4 relative">
                  <div className="px-2 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black tracking-widest uppercase rounded">SEO Strategy</div>
                  <div className="text-slate-400"><TrendingUp size={16} /></div>
                </div>
                
                <h3 className="text-base font-bold text-slate-900 mb-2 leading-tight">Optimize Top 10 ASIN Listing Titles for 'Electronics'</h3>
                <p className="text-xs text-slate-500 mb-6 line-clamp-2">AI identified title improvements that could lead to a 15% increase in conversion based on current trends.</p>
                
                <div className="flex items-center justify-between border-t border-slate-50 pt-4">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">High Impact</span>
                  </div>
                  <button className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center transition-transform hover:scale-110">
                    <ChevronRight size={16} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* WORKBENCH TOOLS */}
        <div className="flex flex-col md:flex-row gap-8">
          {/* MAIN TASK LIST */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <button className="text-sm font-bold text-slate-900 border-b-2 border-indigo-600 pb-1">All Tasks</button>
                <button className="text-sm font-medium text-slate-400 hover:text-slate-600">InProgress</button>
                <button className="text-sm font-medium text-slate-400 hover:text-slate-600">Review</button>
              </div>
              <button className="p-2 border border-slate-200 rounded-lg text-slate-400 hover:bg-white hover:text-slate-600 transition-all">
                <Filter size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <AnimatePresence>
                {loading ? (
                   [1,2,3,4].map(i => (
                     <div key={i} className="h-20 bg-slate-200 animate-pulse rounded-xl bg-opacity-50" />
                   ))
                ) : tasks.length > 0 ? (
                  tasks.map((task) => (
                    <motion.div 
                      key={task._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white border border-slate-200 p-5 rounded-xl flex items-center gap-4 group hover:shadow-md transition-all cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-full border-2 border-slate-200 flex items-center justify-center text-slate-300 group-hover:border-indigo-500 group-hover:text-indigo-500 transition-all">
                        <CheckCircle2 size={20} />
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-bold text-slate-900">{task.title}</h4>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider ${getPriorityColor(task.priority)}`}>
                            {task.priority}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1 text-[11px] text-slate-400">
                             <Clock size={12} />
                             <span>Due in 2 days</span>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-slate-400">
                             <Target size={12} />
                             <span>{task.metricType || 'Revenue'} Impact</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex -space-x-2 mr-4">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-indigo-600 shadow-sm">
                          {user?.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??'}
                        </div>
                      </div>

                      <button className="p-2 text-slate-400 opacity-0 group-hover:opacity-100 transition-all">
                        <MoreVertical size={18} />
                      </button>
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
                    <Layers className="mx-auto text-slate-300 mb-4" size={48} />
                    <p className="text-slate-500 font-medium">No tasks found. Give some intent to the AI!</p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* SIDEBAR INTELLIGENCE */}
          <div className="w-full md:w-80 space-y-6">
             <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl shadow-slate-200 overflow-hidden relative">
               <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500 rounded-full blur-3xl opacity-20" />
               
               <div className="flex items-center gap-2 mb-6 relative">
                 <Sparkles className="text-indigo-400" size={20} />
                 <h3 className="text-sm font-bold tracking-tight">AI Strategy Insight</h3>
               </div>
               
               <p className="text-sm text-slate-300 leading-relaxed mb-6 relative">
                 "Our analysis shows a **22% gap** in your Weekly Run Rate for the 'Electronics' category. Recommended: Increase bidding on **top 5 high-converting keywords** by 15%."
               </p>
               
               <button className="w-full bg-white text-slate-900 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all relative">
                 Auto-Apply Strategy
               </button>
             </div>

             <div className="bg-white border border-slate-200 rounded-3xl p-6">
               <h3 className="text-sm font-bold text-slate-900 mb-6 flex items-center gap-2">
                 <ShieldCheck size={18} className="text-emerald-500" />
                 <span>Goal Integrity</span>
               </h3>
               
               <div className="space-y-6">
                 <div>
                   <div className="flex justify-between items-center mb-2">
                     <span className="text-xs font-bold text-slate-500 uppercase tracking-tighter">GMS Target Achievement</span>
                     <span className="text-xs font-black text-slate-900">72%</span>
                   </div>
                   <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                     <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: '72%' }}
                        className="h-full bg-indigo-600 rounded-full" 
                      />
                   </div>
                 </div>

                 <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-tighter">Action Efficiency</span>
                      <span className="text-xs font-black text-slate-900">94%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: '94%' }}
                        className="h-full bg-emerald-500 rounded-full" 
                      />
                    </div>
                  </div>
               </div>
             </div>
          </div>
        </div>
      </div>
      
      {/* COMMAND BAR OVERLAY (OPTIONAL) */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-white/80 backdrop-blur-md border border-white/20 shadow-2xl rounded-full px-6 py-3 border border-slate-200">
        <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest">
           <span className="p-1 bg-slate-100 rounded">⌘</span>
           <span className="p-1 bg-slate-100 rounded">K</span>
           <span className="ml-2">Quick Intent</span>
        </div>
        <div className="w-[1px] h-4 bg-slate-200" />
        <button className="text-indigo-600 text-[10px] font-black uppercase tracking-widest">Talk to NIM</button>
      </div>
    </div>
  );
};

export default ActionWorkbenchView;
