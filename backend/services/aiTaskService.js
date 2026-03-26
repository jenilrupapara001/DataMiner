const nimService = require('./nimService');

/**
 * AI Task Service - Intelligence Enrichment Engine
 */
class AITaskService {
  /**
   * Transforms a low-friction intent into a production-grade enriched task.
   * Now context-aware with Goal/KR metrics.
   */
  async generateEnrichedTask(intent, goalContext = {}) {
    const { title: goalTitle, currentValue, targetValue, gap, metricType, healthStatus } = goalContext;
    
    const contextPrompt = goalTitle ? `
      CONTEXT:
      Goal: "${goalTitle}"
      Current: ${currentValue} | Target: ${targetValue}
      Gap: ${gap} | Health: ${healthStatus}
      Metric: ${metricType}
    ` : '';

    const prompt = `
      ${contextPrompt}
      Convert this user intention into a professional e-commerce task for Amazon Seller Central.
      Intent: "${intent}"
      
      RETURN JSON OBJECT:
      {
        "title": "Professional Task Title",
        "description": "Detailed actionable description",
        "type": "listing.optimization|ads.bidding|inventory.restock|analytics",
        "priority": "LOW|MEDIUM|HIGH|URGENT",
        "impactWeight": 1-10 (Numeric),
        "expectedImpact": {
          "metric": "${metricType || 'GMS'}",
          "value": 5.0
        },
        "aiReason": "Specific reason why this task helps bridge the ${gap || 'performance'} gap"
      }
    `;

    const response = await nimService.chat([
      { role: "system", content: "You are the Brandcentral Strategic Execution Architect. You always return valid JSON." },
      { role: "user", content: prompt }
    ], { json: true });

    const task = nimService.cleanJSON(response);
    return { ...task, aiGenerated: true };
  }

  /**
   * Generates recovery tasks specifically for a goal that is BEHIND.
   */
  async generateRecoveryTasks(goalContext) {
    const prompt = `
      GOAL BEHIND SCHEDULE: "${goalContext.title}"
      Target: ${goalContext.targetValue} | Current: ${goalContext.currentValue}
      Gap: ${goalContext.gap} | Metric: ${goalContext.metricType}

      Generate 3 AGGRESSIVE recovery tasks to get this goal back on track.
      Focus on high-impact levers like bidding aggressive on top converters, listing cleanup, or deal creation.

      RETURN JSON ARRAY OF TASKS:
      [
        {
          "title": "...",
          "description": "...",
          "priority": "HIGH|URGENT",
          "impactWeight": 8-10,
          "expectedImpact": { "metric": "${goalContext.metricType}", "value": 15.0 },
          "aiReason": "Recovery specific reason"
        }
      ]
    `;

    const response = await nimService.chat([
      { role: "system", content: "You are the Brandcentral Recovery Engine. Focus on short-term high-impact actions." },
      { role: "user", content: prompt }
    ], { json: true });

    const tasks = nimService.cleanJSON(response);
    return Array.isArray(tasks) ? tasks.map(t => ({ ...t, aiGenerated: true })) : [];
  }
}

module.exports = new AITaskService();
