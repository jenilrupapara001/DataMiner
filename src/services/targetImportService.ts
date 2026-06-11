import api, { fetchJson } from './api';
import type { ParsedRow } from '../utils/targetImportHelpers';

export interface ImportPayload {
    rows: Array<{
        sellerId: string;
        brandName: string;
        managerId?: string;
        managerName?: string;
        year: number;
        month: number;
        goalType: string;
        achievedValue: number;
        targetValue: number;
    }>;
}

export interface ImportResult {
    success: boolean;
    imported: number;
    updated: number;
    skipped: number;
    errors: Array<{ row: number; reason: string }>;
    message?: string;
}

export const targetImportApi = {
    async importAchievements(payload: ImportPayload): Promise<ImportResult> {
        try {
            const result = await api.post('/targets/import-achievements', payload);
            return result as ImportResult;
        } catch (err: any) {
            if (err.message?.includes('404')) {
                return await fallbackImport(payload);
            }
            throw new Error(err.message || 'Import failed');
        }
    },

    /**
     * Convert parsed rows to API payload
     */
    buildPayload(
        rows: ParsedRow[],
        sellerNameToId: Map<string, string>
    ): ImportPayload {
        const validRows = rows.filter(r => r.isValid);

        return {
            rows: validRows.map(r => ({
                sellerId: sellerNameToId.get(r.brandName.toLowerCase()) || '',
                brandName: r.brandName,
                managerId: r.managerId || undefined,
                managerName: r.managerName || undefined,
                year: r.year,
                month: r.month,
                goalType: r.goalType,
                achievedValue: r.achieved,
                targetValue: r.target,
            })),
        };
    },
};

/**
 * FALLBACK: If backend endpoint doesn't exist,
 * import row-by-row using existing targets API
 */
async function fallbackImport(payload: ImportPayload): Promise<ImportResult> {
    let imported = 0, updated = 0, skipped = 0;
    const errors: Array<{ row: number; reason: string }> = [];

    for (let i = 0; i < payload.rows.length; i++) {
        const row = payload.rows[i];
        try {
            const searchRes: any = await api.get('/targets', {
                sellerId: row.sellerId,
                year: row.year,
                month: row.month,
                goalType: row.goalType,
                targetType: 'MONTHLY',
            });

            const list: any[] = Array.isArray(searchRes)
                ? searchRes
                : (searchRes?.data?.targets || searchRes?.data?.targets || searchRes?.data || searchRes || []);

            const existing = list[0];

            if (existing && existing.Id) {
                await api.patch(`/targets/${existing.Id}`, {
                    overallAchieved: row.achievedValue,
                });
                updated++;
            } else {
                await api.post('/targets', {
                    SellerId: row.sellerId,
                    BrandManager: row.managerName || row.managerId || '',
                    Year: row.year,
                    Month: row.month,
                    GoalType: row.goalType,
                    TargetType: 'MONTHLY',
                    TotalTargetValue: 0,
                    overallAchieved: row.achievedValue,
                });
                imported++;
            }
        } catch (err: any) {
            errors.push({
                row: i + 2,
                reason: err.message || 'Unknown error',
            });
            skipped++;
        }
    }

    return {
        success: errors.length === 0,
        imported,
        updated,
        skipped,
        errors,
        message: `Processed ${payload.rows.length} records: ${imported} new, ${updated} updated, ${skipped} skipped`,
    };
}