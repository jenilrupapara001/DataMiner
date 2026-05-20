import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PERMISSIONS } from '../constants/permissions';

export const useTargetPermissions = () => {
    const { user, hasPermission, isAdmin, isGlobalUser } = useAuth();

    return useMemo(() => {
        if (!user) {
            return {
                canView: false,
                canCreate: false,
                canEdit: false,
                canDelete: false,
                canExport: false,
                isBrandManager: false,
                isViewer: true,
                loading: false
            };
        }

        const roleName = (user.role?.name || user.role || '').toString().toLowerCase().trim();
        const isBrandManager = roleName === 'brand manager' || roleName === 'brand_manager';

        // Super Admin / Admin has full access
        if (isAdmin) {
            return {
                canView: true,
                canCreate: true,
                canEdit: true,
                canDelete: true,
                canExport: true,
                isBrandManager: false,
                isViewer: false,
                loading: false
            };
        }

        // Global User (e.g. Operational Manager) has full access
        if (isGlobalUser) {
            return {
                canView: true,
                canCreate: true,
                canEdit: true,
                canDelete: true,
                canExport: true,
                isBrandManager: false,
                isViewer: false,
                loading: false
            };
        }

        // Standard granular permissions fallback
        const canView = hasPermission(PERMISSIONS.TARGETS_VIEW) || isBrandManager;
        const canCreate = hasPermission(PERMISSIONS.TARGETS_CREATE);
        const canEdit = hasPermission(PERMISSIONS.TARGETS_EDIT);
        const canDelete = hasPermission(PERMISSIONS.TARGETS_DELETE);
        const canExport = hasPermission(PERMISSIONS.TARGETS_EXPORT);

        const isViewer = !canCreate && !canEdit && !canDelete;

        return {
            canView,
            canCreate,
            canEdit,
            canDelete,
            canExport,
            isBrandManager,
            isViewer,
            loading: false
        };
    }, [user, hasPermission, isAdmin, isGlobalUser]);
};
