const express = require('express');
const router = express.Router();
const Target = require('../models/Target'); // your model
const authMiddleware = require('../middleware/auth'); // your auth

router.post('/import-achievements', authMiddleware, async (req, res) => {
    const { rows } = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'No rows provided'
        });
    }

    let imported = 0, updated = 0, skipped = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
            const {
                sellerId, year, month, goalType,
                achievedValue, managerId, managerName
            } = row;

            if (!sellerId || !year || !month || !goalType) {
                skipped++;
                errors.push({ row: i + 2, reason: 'Missing required fields' });
                continue;
            }

            // Try to find existing MONTHLY target
            let existingTarget = await Target.findOne({
                SellerId: sellerId,
                Year: year,
                Month: month,
                GoalType: goalType,
                TargetType: 'MONTHLY'
            });

            if (existingTarget) {
                existingTarget.overallAchieved = achievedValue;
                await existingTarget.save();
                updated++;
            } else {
                // Check yearly target with monthly breakdown
                const yearlyTarget = await Target.findOne({
                    SellerId: sellerId,
                    Year: year,
                    GoalType: goalType,
                    TargetType: 'YEARLY'
                });

                if (yearlyTarget && yearlyTarget.monthlyBreakdown) {
                    const breakdown = yearlyTarget.monthlyBreakdown.find(
                        b => b.PeriodValue === month
                    );
                    if (breakdown) {
                        breakdown.AchievedValue = achievedValue;
                        yearlyTarget.overallAchieved = yearlyTarget.monthlyBreakdown
                            .reduce((sum, b) => sum + (b.AchievedValue || 0), 0);
                        await yearlyTarget.save();
                        updated++;
                    } else {
                        skipped++;
                    }
                } else {
                    // Create new monthly target
                    await Target.create({
                        SellerId: sellerId,
                        BrandManager: managerName || managerId || '',
                        Year: year,
                        Month: month,
                        GoalType: goalType,
                        TargetType: 'MONTHLY',
                        TotalTargetValue: 0,
                        overallAchieved: achievedValue,
                    });
                    imported++;
                }
            }
        } catch (err) {
            errors.push({
                row: i + 2,
                reason: err.message
            });
            skipped++;
        }
    }

    res.json({
        success: errors.length === 0,
        imported,
        updated,
        skipped,
        errors,
        message: `Processed ${rows.length} records: ${imported} new, ${updated} updated, ${skipped} skipped`,
    });
});

module.exports = router;