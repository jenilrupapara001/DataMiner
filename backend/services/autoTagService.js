const { sql, getPool } = require('../database/db');

/**
 * Auto-Tag Service
 * Automatically adds age-based tags to ASINs based on their release date
 * Also computes GMS Top 20 and New 20 performance tags
 */

class AutoTagService {

    /**
     * Calculate age tags based on release date
     * @param {Date} releaseDate - The release date of the ASIN
     * @param {Date} referenceDate - Reference date (defaults to now)
     * @returns {string[]} Array of tags to add
     */
    static calculateAgeTags(releaseDate, referenceDate = new Date()) {
        if (!releaseDate) return [];

        const release = new Date(releaseDate);
        const now = new Date(referenceDate);
        const diffDays = Math.floor((now - release) / (1000 * 60 * 60 * 24));

        const tags = [];

        // Age-based tags
        if (diffDays >= 0 && diffDays <= 30) {
            tags.push('30Days');
        } else if (diffDays > 30 && diffDays <= 60) {
            tags.push('60 Days');
        } else if (diffDays > 60 && diffDays <= 90) {
            tags.push('90Days');
        } else if (diffDays > 90 && diffDays <= 180) {
            tags.push('180 Days');
        } else if (diffDays > 180 && diffDays <= 365) {
            tags.push('365 Days');
        } else if (diffDays > 365) {
            tags.push('365 + Days');
        }

        // Less than 60 days old tag
        if (diffDays >= 0 && diffDays < 60) {
            tags.push('< 60 Days Old');
        }

        return tags;
    }

    /**
     * Calculate age-based priority
     * @param {Date} releaseDate 
     * @returns {object} { daysSinceRelease, priority, needsReview }
     */
    static calculateAgePriority(releaseDate) {
        if (!releaseDate) return null;

        const release = new Date(releaseDate);
        const now = new Date();
        const diffDays = Math.floor((now - release) / (1000 * 60 * 60 * 24));

        let priority = 'Low';
        let needsReview = false;

        if (diffDays > 90) {
            priority = 'High';
            needsReview = true;
        } else if (diffDays > 60) {
            priority = 'Medium';
            needsReview = true;
        } else if (diffDays > 30) {
            priority = 'Low';
            needsReview = false;
        }

        return {
            daysSinceRelease: diffDays,
            priority,
            needsReview,
            ageCategory: diffDays <= 30 ? '30Days' : diffDays <= 60 ? '60 Days' : diffDays <= 90 ? '90Days' : diffDays <= 180 ? '180 Days' : diffDays <= 365 ? '365 Days' : '365 + Days'
        };
    }

    /**
     * Merge auto-generated tags with existing tags
     * @param {string[]} existingTags - Current tags from database
     * @param {string[]} autoTags - Auto-generated tags
     * @param {boolean} replaceAgeTags - Replace existing age tags with new ones
     * @returns {string[]} Merged tags array
     */
    static mergeTags(existingTags = [], autoTags = [], replaceAgeTags = true) {
        // Age-related tag patterns to identify
        const ageTagPatterns = [
            '30Days', '60 Days', '90Days', '180 Days', '365 Days', '365 + Days',
            'New Launch', 'New 30D', '30-60 Days', '60-90 Days', '90-180 Days', '180-365 Days', '365+ Days',
            'Growth Phase', 'Established', 'Mature', 'Veteran', 'Legacy',
            '30+ Days Live', '60+ Days Live', '90+ Days Live',
            'New', 'Growing', 'Established'
        ];

        let merged = [...existingTags];

        // Remove old age tags if replacing
        if (replaceAgeTags) {
            merged = merged.filter(tag => {
                const isAgeTag = ageTagPatterns.some(pattern => 
                    tag.toLowerCase() === pattern.toLowerCase() ||
                    tag.toLowerCase().includes('days') ||
                    tag.toLowerCase().includes('phase') ||
                    tag.toLowerCase().includes('mature') ||
                    tag.toLowerCase().includes('veteran') ||
                    tag.toLowerCase().includes('legacy') ||
                    tag.toLowerCase().includes('growing') ||
                    tag.toLowerCase().includes('established')
                );
                return !isAgeTag;
            });
        }

        // Add new auto tags
        for (const tag of autoTags) {
            if (!merged.includes(tag)) {
                merged.push(tag);
            }
        }

        return merged;
    }

    /**
     * Compute GMS Top 20 tags per brand/seller from last N months of GMS data.
     * Tags the top 20 ASINs by OrderedRevenue within each seller with "GMS Top 20"
     * @param {object} pool - Database connection pool
     * @param {number} months - Lookback window (default 3)
     * @returns {Promise<object>} { updated, skipped, taggedAsins }
     */
    static async computeGmsTop20Tags(pool, months = 3) {
        const result = await pool.request()
            .input('months', sql.Int, months)
            .query(`
                WITH Ranked AS (
                    SELECT
                        a.Id,
                        a.AsinCode,
                        a.Tags,
                        a.SellerId,
                        SUM(ISNULL(g.OrderedRevenue, 0)) as TotalRevenue
                    FROM Asins a
                    INNER JOIN GmsDailyPerformance g
                        ON g.Asin = a.AsinCode
                        AND g.Date >= DATEADD(MONTH, -@months, CAST(dbo.GetEnvDate() AS DATE))
                    WHERE a.Status = 'Active'
                    GROUP BY a.Id, a.AsinCode, a.Tags, a.SellerId
                ),
                RankedWithRow AS (
                    SELECT *,
                        ROW_NUMBER() OVER (PARTITION BY SellerId ORDER BY TotalRevenue DESC) as rn
                    FROM Ranked
                    WHERE TotalRevenue > 0
                )
                SELECT Id, AsinCode, Tags, rn
                FROM RankedWithRow
                WHERE rn <= 20
            `);

        let updated = 0;
        for (const row of result.recordset) {
            let tags = [];
            try { tags = JSON.parse(row.Tags || '[]'); } catch { tags = []; }
            if (!tags.includes('GMS Top 20')) {
                tags.push('GMS Top 20');
                await pool.request()
                    .input('id', sql.VarChar, row.Id)
                    .input('tags', sql.NVarChar, JSON.stringify(tags))
                    .query('UPDATE Asins SET Tags = @tags, UpdatedAt = dbo.GetEnvDate() WHERE Id = @id');
                updated++;
            }
        }
        return { updated, total: result.recordset.length };
    }

    /**
     * Remove "GMS Top 20" tags from ASINs that are no longer in the top 20.
     * Must be called BEFORE computeGmsTop20Tags to clean stale tags.
     * @param {object} pool
     * @returns {Promise<number>} count of tags removed
     */
    static async clearStaleGmsTop20Tags(pool) {
        const result = await pool.request()
            .query(`
                SELECT Id, Tags FROM Asins
                WHERE Tags LIKE '%GMS Top 20%'
            `);
        let cleared = 0;
        for (const row of result.recordset) {
            let tags = [];
            try { tags = JSON.parse(row.Tags || '[]'); } catch { continue; }
            const filtered = tags.filter(t => t !== 'GMS Top 20');
            if (filtered.length !== tags.length) {
                await pool.request()
                    .input('id', sql.VarChar, row.Id)
                    .input('tags', sql.NVarChar, JSON.stringify(filtered))
                    .query('UPDATE Asins SET Tags = @tags, UpdatedAt = dbo.GetEnvDate() WHERE Id = @id');
                cleared++;
            }
        }
        return cleared;
    }

    /**
     * Compute "New 20" tags — the 20 most recently released ASINs by ReleaseDate.
     * @param {object} pool
     * @returns {Promise<object>} { updated, total }
     */
    static async computeNew20Tags(pool) {
        const result = await pool.request()
            .query(`
                WITH Ranked AS (
                    SELECT
                        Id, Tags, ReleaseDate,
                        ROW_NUMBER() OVER (ORDER BY ReleaseDate DESC) as rn
                    FROM Asins
                    WHERE ReleaseDate IS NOT NULL
                        AND Status = 'Active'
                )
                SELECT Id, Tags, rn FROM Ranked WHERE rn <= 20
            `);

        let updated = 0;
        for (const row of result.recordset) {
            let tags = [];
            try { tags = JSON.parse(row.Tags || '[]'); } catch { tags = []; }
            if (!tags.includes('New 20')) {
                tags.push('New 20');
                await pool.request()
                    .input('id', sql.VarChar, row.Id)
                    .input('tags', sql.NVarChar, JSON.stringify(tags))
                    .query('UPDATE Asins SET Tags = @tags, UpdatedAt = dbo.GetEnvDate() WHERE Id = @id');
                updated++;
            }
        }
        return { updated, total: result.recordset.length };
    }

    /**
     * Remove stale "New 20" tags (from ASINs no longer in top 20).
     */
    static async clearStaleNew20Tags(pool) {
        const result = await pool.request()
            .query(`SELECT Id, Tags FROM Asins WHERE Tags LIKE '%New 20%'`);
        let cleared = 0;
        for (const row of result.recordset) {
            let tags = [];
            try { tags = JSON.parse(row.Tags || '[]'); } catch { continue; }
            const filtered = tags.filter(t => t !== 'New 20');
            if (filtered.length !== tags.length) {
                await pool.request()
                    .input('id', sql.VarChar, row.Id)
                    .input('tags', sql.NVarChar, JSON.stringify(filtered))
                    .query('UPDATE Asins SET Tags = @tags, UpdatedAt = dbo.GetEnvDate() WHERE Id = @id');
                cleared++;
            }
        }
        return cleared;
    }

    /**
     * Run all auto-tag computations in sequence.
     * @param {object} pool
     * @returns {Promise<object>} summary
     */
    static async runAllAutoTags(pool) {
        console.log('[AutoTag] Starting full auto-tag run...');

        // Clear stale tags first
        const staleGms = await this.clearStaleGmsTop20Tags(pool);
        const staleNew = await this.clearStaleNew20Tags(pool);
        console.log(`[AutoTag] Cleared ${staleGms} stale GMS Top 20, ${staleNew} stale New 20 tags`);

        // Compute new tags
        const gms = await this.computeGmsTop20Tags(pool, 3);
        console.log(`[AutoTag] GMS Top 20: ${gms.updated} updated, ${gms.total} ASINs`);

        const new20 = await this.computeNew20Tags(pool);
        console.log(`[AutoTag] New 20: ${new20.updated} updated, ${new20.total} ASINs`);

        // Update age tags for all ASINs
        const ageResult = await this.batchUpdateAgeTags(pool);
        console.log(`[AutoTag] Age tags: ${ageResult.updated} updated, ${ageResult.skipped} skipped`);

        return {
            gmsTop20: gms,
            new20: new20,
            ageTags: ageResult,
            cleared: { gmsTop20: staleGms, new20: staleNew }
        };
    }

    /**
     * Get all ASINs that need age tag updates
     * @param {object} pool - Database connection pool
     * @returns {Promise<Array>} ASINs needing updates
     */
    static async getAsinsNeedingAgeUpdate(pool) {
        const result = await pool.request().query(`
            SELECT Id, AsinCode, ReleaseDate, Tags, CreatedAt
            FROM Asins 
            WHERE ReleaseDate IS NOT NULL
            ORDER BY ReleaseDate ASC
        `);
        return result.recordset;
    }

    /**
     * Batch update age tags for all ASINs
     * @param {object} pool - Database connection pool
     * @returns {Promise<object>} Update summary
     */
    static async batchUpdateAgeTags(pool) {
        const asins = await this.getAsinsNeedingAgeUpdate(pool);
        let updated = 0;
        let skipped = 0;

        for (const asin of asins) {
            try {
                const autoTags = this.calculateAgeTags(asin.ReleaseDate);
                if (autoTags.length === 0) {
                    skipped++;
                    continue;
                }

                let existingTags = [];
                try {
                    existingTags = JSON.parse(asin.Tags || '[]');
                } catch (e) {
                    existingTags = [];
                }

                const mergedTags = this.mergeTags(existingTags, autoTags, true);

                // Check if tags actually changed
                const currentTags = JSON.stringify(existingTags.sort());
                const newTags = JSON.stringify(mergedTags.sort());

                if (currentTags !== newTags) {
                    await pool.request()
                        .input('id', sql.VarChar, asin.Id)
                        .input('tags', sql.NVarChar, JSON.stringify(mergedTags))
                        .query('UPDATE Asins SET Tags = @tags, UpdatedAt = dbo.GetEnvDate() WHERE Id = @id');
                    updated++;
                } else {
                    skipped++;
                }
            } catch (e) {
                console.error(`Failed to update age tags for ${asin.AsinCode}:`, e.message);
                skipped++;
            }
        }

        console.log(`[AutoTag] Updated ${updated} ASINs, skipped ${skipped}`);
        return { updated, skipped, total: asins.length };
    }
}

module.exports = AutoTagService;
