const OpenAI = require('openai');

/**
 * NIM Service - Centralized Intelligence Broker
 * Standardizes access to NVIDIA NIM infrastructure for growth strategy generation.
 */
class NIMService {
  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.NVIDIA_NIM_API_KEY,
      baseURL: 'https://integrate.api.nvidia.com/v1',
    });
  }

  /**
   * Universal Chat Completion for Growth Strategies
   */
  async chat(messages, options = {}) {
    try {
      const completion = await this.client.chat.completions.create({
        model: options.model || "minimaxai/minimax-m2.1",
        messages,
        temperature: options.temperature || 0.6,
        max_tokens: options.max_tokens || 2048,
        response_format: options.json ? { type: "json_object" } : undefined
      });

      return completion.choices[0].message.content;
    } catch (error) {
      console.error('[NIM Service] Inference Error:', error);
      throw new Error(`AI Inference Failed: ${error.message}`);
    }
  }

  /**
   * Helper to clean AI JSON output
   */
  cleanJSON(content) {
    try {
      const cleaned = content.replace(/```json|```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (e) {
      console.error('[NIM Service] JSON Parse Error:', e, content);
      throw new Error('AI returned malformed JSON payload.');
    }
  }
}

module.exports = new NIMService();
