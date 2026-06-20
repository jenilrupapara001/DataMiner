import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import api, { marketSyncApi } from '../services/api';
import { apiClient } from '../lib/api-client';
import { db } from '../services/db';
import { format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { useDateRange } from '../contexts/DateRangeContext';
import { useDashboardOrchestration } from './useDashboardOrchestration';
import { useTargetPermissions } from './useTargetPermissions';
import { useSocket } from '../contexts/SocketContext';

export interface DashboardFilters {
    sellerId: string;
    managerId: string;
    goalType: string;
    dateRange: { start: Date | null; end: Date | null };
}

export interface ModuleStats {
    targets: {
        total: number;
        onTrack: number;
        atRisk: number;
        completed: number;
        rate: number;
    };
    asins: {
        total: number;
        active: number;
        outOfStock: number;
        newThisMonth: number;
    };
    ads: {
        totalSpend: number;
        totalSales: number;
        acos: number;
        roas: number;
        campaigns: number;
    };
    tasks: {
        total: number;
        completed: number;
        pending: number;
        overdue: number;
        inProgress: number;
        todo: number;
    };
    alerts: {
        total: number;
        critical: number;
        warning: number;
        info: number;
        unread: number;
    };
    pipeline: {
        total: number;
        running: number;
        completed: number;
        failed: number;
        idle: number;
    };
}

export function useDashboardData(filters: DashboardFilters) {
    const { user } = useAuth();
    const { isBrandManager } = useTargetPermissions();
    const socket = useSocket();
    const [sellers, setSellers] = useState<any[]>([]);
    const [managers, setManagers] = useState<any[]>([]);
    const [activityLogs, setActivityLogs] = useState<any[]>([]);
    const [scrapeTasks, setScrapeTasks] = useState<any[]>([]);

    // Use existing orchestration hook
    const orch = useDashboardOrchestration({
        sellerId: filters.sellerId === 'all' ? undefined : filters.sellerId,
        managerId: filters.managerId === 'all' ? undefined : filters.managerId,
        startDate: filters.dateRange.start 
            ? format(filters.dateRange.start, 'yyyy-MM-dd') 
            : undefined,
        endDate: filters.dateRange.end 
            ? format(filters.dateRange.end, 'yyyy-MM-dd') 
            : undefined,
    });

    // Load sellers
    useEffect(() => {
        api.sellerApi.getAll({ page: 1, limit: 500 })
            .then((res: any) => {
                const list = res?.data?.sellers || res?.sellers || [];
                setSellers(Array.isArray(list) ? list : []);
            })
            .catch(console.error);
    }, []);

    // Filter sellers list based on user role (RBAC)
    const userSellers = useMemo(() => {
        if (!user) return [];
        const roleName = (user.role?.name || user.role || '').toString().toLowerCase().trim();
        const isMgr = roleName === 'brand manager' || roleName === 'brand_manager' || isBrandManager;

        if (isMgr) {
            const assigned = user.assignedSellers || [];
            return assigned.map((s: any) => {
                const sid = s.sellerId || s.SellerId || s._id || s.Id || s;
                const match = sellers.find(x => (x._id || x.id) === sid);
                return {
                    id: sid,
                    name: match?.name || s.name || s.SellerName || sid
                };
            });
        }

        return sellers.map(s => ({
            id: s._id || s.id,
            name: s.name || s.SellerName || s._id || s.id
        }));
    }, [user, sellers, isBrandManager]);

    // Extract unique managers from targets
    useEffect(() => {
        const targetsList = orch.targets || [];
        const mgrSet = new Set<string>();
        targetsList.forEach((t: any) => {
            if (t.BrandManager) mgrSet.add(t.BrandManager);
        });
        setManagers(Array.from(mgrSet).map(name => ({ id: name, name })));
    }, [orch.targets]);

    // Load optimization tasks with React Query caching
    const tasksQuery = useQuery({
        queryKey: ['tasks', 'optimization', filters.sellerId],
        queryFn: async () => {
            const params: any = {};
            if (filters.sellerId && filters.sellerId !== 'all') {
                params.sellerId = filters.sellerId;
            }
            const r = await apiClient.get('/tasks', { params });
            const tasks = (r as any).data?.data?.tasks || (r as any).data?.tasks || (r as any).data?.data || [];
            return Array.isArray(tasks) ? tasks : [];
        },
        staleTime: 2 * 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
    });

    const optimizationTasks = tasksQuery.data ?? [];

    // Load activity logs
    const loadLogs = useCallback(async () => {
        try {
            const data = await db.getSystemLogs();
            if (Array.isArray(data)) {
                setActivityLogs(data.slice(0, 10));
            }
        } catch (err) {
            console.error('Failed to load logs:', err);
        }
    }, []);

    // Load pipeline tasks
    const loadPipeline = useCallback(async () => {
        try {
            const res = await marketSyncApi.getSyncTasks();
            setScrapeTasks(res?.tasks || []);
        } catch (err) {
            console.error('Failed to load pipeline:', err);
        }
    }, []);

    // Real-time socket sync for activity logs
    useEffect(() => {
        if (!socket) return;

        const handleNewLog = (data: any) => {
            if (!data) return;
            const normalized = {
                ...data,
                _id: data._id || data.id || data.Id,
                createdAt: data.createdAt || data.CreatedAt,
                type: data.type || data.Type || '',
                entityType: data.entityType || data.EntityType || '',
                entityTitle: data.entityTitle || data.EntityTitle || '',
                description: data.description || data.Description || '',
                metadata: data.metadata || data.Metadata || null,
                user: data.user || null,
            };
            setActivityLogs(prev => {
                const next = [normalized, ...prev];
                return next.slice(0, 10);
            });
        };

        socket.on('new_system_log', handleNewLog);
        return () => socket.off('new_system_log', handleNewLog);
    }, [socket]);

    useEffect(() => {
        loadLogs();
        loadPipeline();
        const interval = setInterval(() => {
            loadPipeline();
        }, 30000);
        return () => clearInterval(interval);
    }, [loadLogs, loadPipeline]);

    // Compute module stats
    const moduleStats: ModuleStats = useMemo(() => {
        const targetsList = orch.targets || [];

        // Filter by selected seller/manager
        let filteredTargets = targetsList;
        if (filters.sellerId && filters.sellerId !== 'all') {
            filteredTargets = filteredTargets.filter((t: any) => 
                t.SellerId === filters.sellerId
            );
        }
        if (filters.managerId && filters.managerId !== 'all') {
            filteredTargets = filteredTargets.filter((t: any) => 
                t.BrandManager === filters.managerId
            );
        }
        if (filters.goalType && filters.goalType !== 'all') {
            filteredTargets = filteredTargets.filter((t: any) => 
                (t.GoalType || 'GMS').toUpperCase() === filters.goalType
            );
        }

        // Targets stats
        let totalTarget = 0;
        let totalAchieved = 0;
        let onTrack = 0;
        let atRisk = 0;
        let completed = 0;

        filteredTargets.forEach((t: any) => {
            totalTarget += (t.TotalTargetValue || 0);
            totalAchieved += (t.overallAchieved || 0);
            const pct = t.TotalTargetValue > 0 
                ? (t.overallAchieved / t.TotalTargetValue) * 100 
                : 0;
            if (pct >= 100) completed++;
            else if (pct >= 50) onTrack++;
            else atRisk++;
        });

        // Ads stats from dashboard raw
        const adsPerf = orch.dashboardRaw?.adsPerformanceSeries || [];
        const adSalesData = adsPerf[0]?.data || [];
        const adSpendData = adsPerf[1]?.data || [];
        const totalAdSales = adSalesData.reduce((a: number, b: number) => a + b, 0);
        const totalAdSpend = adSpendData.reduce((a: number, b: number) => a + b, 0);

        // Get sellerIds for selected manager
        const managerSellers = new Set(
            targetsList
                .filter((t: any) => t.BrandManager === filters.managerId)
                .map((t: any) => t.SellerId)
        );

        // Tasks stats
        let tasks = optimizationTasks;
        if (filters.managerId && filters.managerId !== 'all') {
            tasks = tasks.filter((t: any) => managerSellers.has(t.sellerId));
        }
        const taskCompleted = tasks.filter((t: any) => 
            t.status === 'COMPLETED' || t.status === 'completed'
        ).length;
        const taskPending = tasks.filter((t: any) => 
            t.status === 'PENDING' || t.status === 'pending'
        ).length;
        const taskOverdue = tasks.filter((t: any) => {
            if (t.status === 'COMPLETED' || t.status === 'completed') return false;
            if (t.dueDate) return new Date(t.dueDate) < new Date();
            return false;
        }).length;
        const taskInProgress = tasks.filter((t: any) => 
            t.status === 'IN_PROGRESS' || t.status === 'in_progress'
        ).length;
        const taskTodo = tasks.filter((t: any) => 
            t.status === 'TODO' || t.status === 'todo'
        ).length;

        // Pipeline stats
        let finalScrapeTasks = scrapeTasks;
        if (filters.sellerId && filters.sellerId !== 'all') {
            finalScrapeTasks = finalScrapeTasks.filter((t: any) => t.sellerId === filters.sellerId);
        }
        if (filters.managerId && filters.managerId !== 'all') {
            finalScrapeTasks = finalScrapeTasks.filter((t: any) => managerSellers.has(t.sellerId));
        }
        const running = finalScrapeTasks.filter((t: any) => t.status === 'RUNNING').length;
        const pipeCompleted = finalScrapeTasks.filter((t: any) => t.status === 'COMPLETED').length;
        const failed = finalScrapeTasks.filter((t: any) => t.status === 'FAILED').length;
        const idle = finalScrapeTasks.filter((t: any) => 
            t.status === 'IDLE' || !t.status
        ).length;

        // Alerts stats (Filter by manager and seller if mapping exists)
        let finalLogs = activityLogs;
        // Search logs for matches
        if (filters.sellerId && filters.sellerId !== 'all') {
            finalLogs = finalLogs.filter((l: any) => {
                const sId = l.SellerId || l.sellerId;
                return !sId || sId === filters.sellerId;
            });
        }
        if (filters.managerId && filters.managerId !== 'all') {
            finalLogs = finalLogs.filter((l: any) => {
                const sId = l.SellerId || l.sellerId;
                return !sId || managerSellers.has(sId);
            });
        }
        const criticalLogs = finalLogs.filter((l: any) => {
            const t = (l.Type || l.type || '').toUpperCase();
            return t.includes('ERROR') || t.includes('FAILURE');
        }).length;
        const warningLogs = finalLogs.filter((l: any) => {
            const t = (l.Type || l.type || '').toUpperCase();
            return t.includes('DELETE') || t === 'UPDATE';
        }).length;

        return {
            targets: {
                total: filteredTargets.length,
                onTrack,
                atRisk,
                completed,
                rate: totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0,
            },
            asins: {
                total: orch.dashboardRaw?.stats?.totalAsins || 0,
                active: orch.dashboardRaw?.stats?.activeAsins || 0,
                outOfStock: orch.dashboardRaw?.stats?.outOfStockAsins || 0,
                newThisMonth: orch.dashboardRaw?.stats?.newThisMonthAsins || 0,
            },
            ads: {
                totalSpend: totalAdSpend,
                totalSales: totalAdSales,
                acos: totalAdSales > 0 ? (totalAdSpend / totalAdSales) * 100 : 0,
                roas: totalAdSpend > 0 ? totalAdSales / totalAdSpend : 0,
                campaigns: 0,
            },
            tasks: {
                total: tasks.length,
                completed: taskCompleted,
                pending: taskPending,
                overdue: taskOverdue,
                inProgress: taskInProgress,
                todo: taskTodo,
            },
            alerts: {
                total: finalLogs.length,
                critical: criticalLogs,
                warning: warningLogs,
                info: finalLogs.length - criticalLogs - warningLogs,
                unread: 0,
            },
            pipeline: {
                total: finalScrapeTasks.length,
                running,
                completed: pipeCompleted,
                failed,
                idle,
            },
        };
    }, [orch.targets, orch.dashboardRaw, optimizationTasks, 
        activityLogs, scrapeTasks, filters]);

    const managerSellers = useMemo(() => {
        const targetsList = orch.targets || [];
        return new Set(
            targetsList
                .filter((t: any) => t.BrandManager === filters.managerId)
                .map((t: any) => t.SellerId)
        );
    }, [orch.targets, filters.managerId]);

    const filteredTasks = useMemo(() => {
        let tasks = optimizationTasks;
        if (filters.managerId && filters.managerId !== 'all') {
            tasks = tasks.filter((t: any) => managerSellers.has(t.sellerId));
        }
        return tasks;
    }, [optimizationTasks, managerSellers, filters.managerId]);

    const filteredScrapeTasks = useMemo(() => {
        let tasks = scrapeTasks;
        if (filters.sellerId && filters.sellerId !== 'all') {
            tasks = tasks.filter((t: any) => t.sellerId === filters.sellerId);
        }
        if (filters.managerId && filters.managerId !== 'all') {
            tasks = tasks.filter((t: any) => managerSellers.has(t.sellerId));
        }
        return tasks;
    }, [scrapeTasks, managerSellers, filters.sellerId, filters.managerId]);

    const filteredActivityLogs = useMemo(() => {
        let logs = activityLogs;
        if (filters.sellerId && filters.sellerId !== 'all') {
            logs = logs.filter((l: any) => {
                const sId = l.SellerId || l.sellerId;
                return !sId || sId === filters.sellerId;
            });
        }
        if (filters.managerId && filters.managerId !== 'all') {
            logs = logs.filter((l: any) => {
                const sId = l.SellerId || l.sellerId;
                return !sId || managerSellers.has(sId);
            });
        }
        return logs;
    }, [activityLogs, managerSellers, filters.sellerId, filters.managerId]);

    const filteredTopProducts = useMemo(() => {
        let list = orch.topProducts || [];
        if (filters.managerId && filters.managerId !== 'all') {
            list = list.filter((p: any) => managerSellers.has(p.sellerId || p.SellerId || p.brand));
        }
        return list;
    }, [orch.topProducts, managerSellers, filters.managerId]);

    return {
        // Raw & Filtered data
        sellers,
        userSellers,
        managers,
        activityLogs: filteredActivityLogs,
        scrapeTasks: filteredScrapeTasks,
        optimizationTasks: filteredTasks,
        topProducts: filteredTopProducts,
        
        // Orchestration data
        orch,
        
        // Computed
        moduleStats,
        
        // Loading
        loading: orch.isLoadingKpis,
        isHydrated: orch.isHydrated,
        
        // Actions
        refresh: () => {
            orch.forceRefresh?.();
            loadLogs();
            loadPipeline();
        },
        loadPipeline,
    };
}
