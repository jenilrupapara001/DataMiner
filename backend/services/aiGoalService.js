const nimService = require('./nimService');

/**
 * AI Goal Service - Intent-to-Strategy Engine
 * 
 * Handles Step 2 (Preview) and Step 5 (Generation) of the Brandcentral Goal Flow.
 */
class AIGoalService {
  /**
   * Generates a strategic preview from a raw user intent string.
   * Input: "Reach 1Cr GMS in 90 days"
   */
  async generatePreview(intent) {
    const prompt = `
      You are the Brandcentral growth engine.
      Analyze this user intent and provide a strategic goal preview.
      
      Intent: "${intent}"
      
      RETURN JSON ONLY:
      {
        "title": "Clear Goal Title",
        "metricType": "GMS|ACOS|ROI|PROFIT|CONVERSION_RATE|ORDER_COUNT",
        "targetValue": Number,
        "currentValue": Number (suggest realistic fallback if not known),
        "drivers": ["Driver 1", "Driver 2"],
        "projectedAchievement": Number (estimate based on intent),
        "runRateRequired": Number (Target / 90 days or timeframe)
      }
    `;

    const response = await nimService.chat([
      { role: "system", content: "You are a professional E-commerce Growth Audit system." },
      { role: "user", content: prompt }
    ], { json: true });

    return nimService.cleanJSON(response);
  }

  /**
   * Generates a 4-week execution roadmap based on a confirmed goal.
   */
  async generatePlan(goal) {
    const prompt = `
      Generate a 4-week actionable execution plan for this goal.
      Goal: ${goal.title} (${goal.metricType})
      Target: ${goal.targetValue}
      Scope: ${goal.scopeType} (${goal.scopeIds.join(', ')})
      
      RETURN JSON ARRAY:
      [
        {
          "week": Number,
          "tasks": [
            {
              "title": "Task Title",
              "description": "High-impact description",
              "type": "SEO|ADS|OPS|CREATIVE",
              "priority": "HIGH|MEDIUM|LOW",
              "impactArea": "revenue|conversion|traffic",
              "expectedImpact": "e.g. +5% CTR",
              "impactWeight": 1-10
            }
          ]
        }
      ]
    `;

    const response = await nimService.chat([
      { role: "system", content: "You are a World-Class E-commerce Strategy Consultant." },
      { role: "user", content: prompt }
    ], { json: true });

    return nimService.cleanJSON(response);
  }
}

module.exports = new AIGoalService();
