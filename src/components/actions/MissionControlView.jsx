import React, { useState, useEffect } from 'react';
import Chart from 'react-apexcharts';
import { motion } from 'framer-motion';
import { 
  Target, TrendingUp, AlertCircle, 
  ArrowUpRight, ArrowDownRight, Zap,
  Activity, Calendar, Briefcase, Globe,
  RefreshCw, Sparkles
} from 'lucide-react';
import { db } from '../../services/db';

/**
 * Mission Control - Strategic Command Center
 * 
 * High-fidelity dashboard for tracking Brandcentral Goals, 
 * performance projections, and AI-driven growth insights.
 */
const MissionControlView = ({ isEmbed = false }) => {
  const [goals, setGoals] = useState([]);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRecovering, setIsRecovering] = useState({});

  useEffect(() => {
    fetchGoals();
  }, []);

  const fetchGoals = async () => {
    setLoading(true);
    try {
      const response = await db.getObjectives(); // Using getObjectives as it contains KRs
      const allObjectives = response?.data || response || [];
      
      // Flatten KRs into goals for the Mission Control view
      const flattenedGoals = [];
      allObjectives.forEach(obj => {
        (obj.keyResults || []).forEach(kr => {
          flattenedGoals.push({
            ...kr,
            objectiveTitle: obj.title,
            objectiveId: obj._id || obj.id
          });
        });
      });

      setGoals(flattenedGoals);
      if (flattenedGoals.length > 0) setSelectedGoal(flattenedGoals[0]);
    } catch (error) {
      console.error('Failed to load goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerRecovery = async (goalId) => {
    if (!goalId) return;
    setIsRecovering(prev => ({ ...prev, [goalId]: true }));
    try {
      const response = await db.generateRecoveryTasks(goalId);
      if (response && (response.success || response.data)) {
        alert(`Successfully generated AI Recovery tasks. Check your Workbench or Board view to see the new tasks.`);
      } else {
        alert('AI was unable to generate tasks at this time. Please try again later.');
      }
    } catch (error) {
      console.error('Recovery failed:', error);
      alert('Failed to trigger AI recovery. Please check your connection.');
    } finally {
      setIsRecovering(prev => ({ ...prev, [goalId]: false }));
    }
  };

  // Chart configuration for ApexCharts
  const chartOptions = {
    chart: {
      type: 'area',
      toolbar: { show: false },
      zoom: { enabled: false },
      fontFamily: 'Inter, sans-serif'
    },
    stroke: { curve: 'smooth', width: 3 },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.45,
        opacityTo: 0.05,
        stops: [20, 100]
      }
    },
    colors: ['#4F46E5', '#10B981'],
    xaxis: {
      categories: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6', 'Week 7', 'Week 8'],
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: { show: false },
    grid: { borderColor: '#F1F5F9', strokeDashArray: 4 },
    dataLabels: { enabled: false },
    tooltip: { theme: 'light' }
  };

  const chartSeries = [
    {
      name: 'Actual Performance',
      data: [30, 40, 35, 50, 49, 60, 70, 91]
    },
    {
      name: 'Strategic Target',
      data: [35, 45, 55, 65, 75, 85, 95, 105]
    }
  ];

  if (loading) return <div className="p-10 text-slate-400 font-medium">Loading Mission Control...</div>;

  return (
    <div className={`${isEmbed ? '' : 'min-h-screen bg-[#F8FAFC] pb-20'}`}>
      {/* STRATEGIC HEADER */}
      {!isEmbed && (
        <div className="bg-white border-b border-slate-200 px-8 py-8">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-slate-900 rounded-xl text-white shadow-xl shadow-slate-200">
                  <Target size={24} />
                </div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Mission Control</h1>
              </div>
              <p className="text-slate-500 font-medium flex items-center gap-2">
                <Globe size={14} />
                <span>Global Growth OS • Strategic Perspective</span>
              </p>
            </div>

            <div className="flex items-center gap-3">
               <button onClick={fetchGoals} className="p-2.5 bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200 transition-all">
                  <RefreshCw size={20} />
               </button>
               <button className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-full font-bold shadow-xl shadow-slate-200 hover:shadow-slate-300 transition-all">
                 <Zap size={18} fill="currentColor" />
                 <span>New Opportunity</span>
               </button>
            </div>
          </div>
        </div>
      )}

      <div className={`${isEmbed ? '' : 'max-w-7xl mx-auto px-8 py-10'}`}>
        {/* SCORECARD GRID - Using Live Goal Data */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          {goals.slice(0, 4).map((goal, idx) => {
            const isBehind = goal.healthStatus === 'BEHIND';
            const statusColor = isBehind ? 'rose' : goal.healthStatus === 'ON_TRACK' ? 'emerald' : 'indigo';
            
            return (
              <motion.div 
                key={goal._id || goal.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden ${isBehind ? 'ring-2 ring-rose-100' : ''}`}
              >
                {isBehind && (
                    <div className="absolute top-0 right-0 p-3">
                        <span className="flex h-2 w-2 rounded-full bg-rose-500 animate-ping" />
                    </div>
                )}
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                    {goal.metric || 'Performance'} Target
                </p>
                <div className="flex items-baseline gap-2 mb-1">
                  <h3 className="text-2xl font-black text-slate-900">
                      {goal.metric === 'GMS' ? `₹${(goal.currentValue / 100000).toFixed(1)}L` : goal.currentValue}
                  </h3>
                  <span className={`text-xs font-bold text-${statusColor}-500 flex items-center`}>
                    {goal.achievementPercent}%
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium tracking-tight truncate">
                    {goal.title || 'Goal Achievement'}
                </p>
                
                {isBehind && (
                    <button 
                        onClick={() => handleTriggerRecovery(goal.objectiveId)}
                        disabled={isRecovering[goal.objectiveId]}
                        className={`mt-4 w-full py-2 ${isRecovering[goal.objectiveId] ? 'bg-slate-50 text-slate-400' : 'bg-rose-50 text-rose-600 hover:bg-rose-100'} rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all flex items-center justify-center gap-2`}
                    >
                        {isRecovering[goal.objectiveId] ? (
                            <><RefreshCw size={12} className="animate-spin" /> Analyzing Gaps...</>
                        ) : (
                            <><Sparkles size={12} /> Trigger AI Recovery</>
                        )}
                    </button>
                )}
              </motion.div>
            );
          })}
        </div>
        {/* MAIN ANALYSIS AREA */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* CHARTING ENGINE */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-sm h-full">
            <div className="flex justify-between items-center mb-10">
              <div>
                <h3 className="text-xl font-black text-slate-900 mb-1">Growth Projection</h3>
                <p className="text-sm font-medium text-slate-400">Comparing actual GMS velocity against strategic goals</p>
              </div>
              <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                 <div className="flex items-center gap-2 px-3 py-1 bg-white rounded-xl shadow-sm">
                   <div className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                   <span className="text-xs font-bold text-slate-600">Actual</span>
                 </div>
                 <div className="flex items-center gap-2 px-3 py-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-xs font-bold text-slate-600">Target</span>
                 </div>
              </div>
            </div>

            <div className="h-[350px]">
              <Chart 
                options={chartOptions}
                series={chartSeries}
                type="area"
                height="100%"
                width="100%"
              />
            </div>
          </div>

          {/* INSIGHTS PANEL */}
          <div className="space-y-6">
            <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-slate-200 h-full relative overflow-hidden">
               <div className="absolute top-0 right-0 p-8">
                 <Sparkles className="text-indigo-400 opacity-50" size={32} />
               </div>
               
               <h3 className="text-lg font-black mb-8 flex items-center gap-2">
                 Intelligence <span className="text-indigo-400">Pulse</span>
               </h3>

               <div className="space-y-8">
                 <div className="flex gap-4">
                   <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                     <AlertCircle className="text-amber-400" size={20} />
                   </div>
                   <div>
                     <h4 className="text-sm font-bold mb-1">Inventory Alert: High Velocity</h4>
                     <p className="text-xs text-slate-400 leading-relaxed">
                       "Electronics" category sales are up 40%. Stock in ASIN B0B123 will deplete in **4 days** at current RR.
                     </p>
                     <button className="mt-3 text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-300">
                       Generate Restock Task
                     </button>
                   </div>
                 </div>

                 <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                      <Activity className="text-emerald-400" size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold mb-1">Ad Spillage Detected</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Spend on non-converting secondary keywords has increased by ₹14,000. Recommend immediate negative optimization.
                      </p>
                      <button className="mt-3 text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-300">
                        View Ad Report
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                      <Zap className="text-indigo-400" size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold mb-1">Untapped Opportunity</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Competitor "Zephyr" is OOS on 3 major listings. Boost bidding on shared high-volume keys to capture demand.
                      </p>
                      <button className="mt-3 text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-300">
                        Launch Campaign
                      </button>
                    </div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MissionControlView;
