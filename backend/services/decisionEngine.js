/**
 * Decision Engine - Strategic Rule-Based Analysis for E-commerce
 * 
 * DESIGN PRINCIPLE: Open-Closed Principle
 * The engine is open for extension (adding rules) but closed for modification (core logic).
 * This structure allows for a future ML layer to override or weight these rules.
 */

class DecisionEngine {
  constructor() {
    this.rules = [];
    this._initializeDefaultRules();
  }

  /**
   * Registers default heuristic rules defined by the user
   */
  _initializeDefaultRules() {
    // Rule 1: Low Revenue + Low Traffic -> SEO Suggestion
    this.addRule({
      id: 'SEO_SUGGESTION',
      name: 'SEO Opportunity',
      condition: (data) => data.revenueTrend === 'down' && data.traffic === 'low',
      execute: () => ({
        type: 'seo',
        action: 'optimize_keywords',
        priority: 'high',
        reason: 'Revenue is declining while traffic is low. Organic visibility bottleneck.'
      })
    });

    // Rule 2: High Traffic + Low Conversion -> Listing Optimization
    this.addRule({
      id: 'LISTING_OPTIMIZATION',
      name: 'Conversion Bottleneck',
      condition: (data) => data.traffic === 'high' && data.conversionRate < 5, // 5% threshold
      execute: () => ({
        type: 'content',
        action: 'optimize_listing',
        priority: 'high',
        reason: 'High traffic volume but low conversion rate. Images/Description need improvement.'
      })
    });

    // Rule 3: High ACoS -> Reduce Bids
    this.addRule({
      id: 'REDUCE_BIDS',
      name: 'Ad Spend Efficiency',
      condition: (data) => data.acos > 35,
      execute: () => ({
        type: 'ads',
        action: 'reduce_bid',
        priority: 'high',
        reason: 'ACoS is above the 35% profitability threshold.'
      })
    });

    // Rule 4: Low Stock -> Reorder
    this.addRule({
      id: 'REORDER_STOCK',
      name: 'Inventory Health',
      condition: (data) => data.stockLevel < (data.reorderThreshold || 10),
      execute: () => ({
        type: 'inventory',
        action: 'reorder',
        priority: 'critical',
        reason: 'Current stock is below the safety threshold. High risk of OOS.'
      })
    });
  }

  /**
   * Adds a new custom rule to the engine
   * @param {Object} rule { id, name, condition: (data) => boolean, execute: (data) => recommendation }
   */
  addRule(rule) {
    if (this.rules.find(r => r.id === rule.id)) return;
    this.rules.push(rule);
  }

  /**
   * Analyzes a dataset and returns actionable recommendations
   * @param {Object} input { revenue, revenueTrend, acos, conversionRate, stockLevel, traffic }
   * @returns {Array} Recommendations
   */
  analyze(input) {
    const recommendations = [];

    // Future ML Integration Point: 
    // This part could be preceded by an ML model that predicts 'input' refinements
    // or weights certain rules higher based on historical success (CTR of recommendations).

    for (const rule of this.rules) {
      if (rule.condition(input)) {
        const result = rule.execute(input);
        recommendations.push({
          ruleId: rule.id,
          timestamp: new Date().toISOString(),
          ...result
        });
      }
    }

    return recommendations;
  }
}

// Singleton instances are often easier to manage in SaaS backends
module.exports = new DecisionEngine();
