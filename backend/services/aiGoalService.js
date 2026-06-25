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
    console.log('[AI Goal Service] Generating Preview for intent:', intent);
    const prompt = `
      You are the Brandcentral growth engine.
      Analyze this user intent and provide a strategic goal roadmap preview.
      
      Intent: "${intent}"
      
      RETURN JSON ONLY with this exact structure:
      {
        "name": "Clear Roadmap Title",
        "strategy": "2-3 sentence summary of the strategy approach",
        "milestones": [
          { "objective": "Milestone 1 action item" },
          { "objective": "Milestone 2 action item" },
          { "objective": "Milestone 3 action item" }
        ]
      }
      
      Generate 4-6 actionable milestones based on the intent. Be specific and actionable.
    `;

    const response = await nimService.chat([
      { role: "system", content: "You are a professional E-commerce Growth Strategy system. Always return valid JSON." },
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
