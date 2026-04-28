const { sql } = require('../database/db');

/**
 * Auto-Tag Service
 * Automatically adds age-based tags to ASINs based on their release date
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
            tags.push('New Launch');
            tags.push('New 30D');
        }
        if (diffDays > 30 && diffDays <= 60) {
            tags.push('30-60 Days');
            tags.push('Growth Phase');
        }
        if (diffDays > 60 && diffDays <= 90) {
            tags.push('60-90 Days');
            tags.push('Established');
        }
        if (diffDays > 90 && diffDays <= 180) {
            tags.push('90-180 Days');
            tags.push('Mature');
        }
        if (diffDays > 180 && diffDays <= 365) {
            tags.push('180-365 Days');
            tags.push('Veteran');
        }
        if (diffDays > 365) {
            tags.push('365+ Days');
            tags.push('Legacy');
        }

        // Performance markers
        if (diffDays > 30) {
            tags.push('30+ Days Live');
        }
        if (diffDays > 60) {
            tags.push('60+ Days Live');
        }
        if (diffDays > 90) {
            tags.push('90+ Days Live');
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
            ageCategory: diffDays <= 30 ? 'New' : diffDays <= 60 ? 'Growing' : diffDays <= 90 ? 'Established' : 'Mature'
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
                        .query('UPDATE Asins SET Tags = @tags, UpdatedAt = GETDATE() WHERE Id = @id');
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
