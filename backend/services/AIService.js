const OpenAI = require('openai');

class AIService {
    constructor() {
        // DEBUG: Log API key presence
        const apiKey = process.env.PERPLEXITY_API_KEY;
        console.log('[DEBUG] AIService initializing...', {
            hasApiKey: !!apiKey,
            keyLength: apiKey?.length || 0,
            keyPrefix: apiKey?.substring(0, 10) || 'undefined'
        });

        this.openai = new OpenAI({
            apiKey: process.env.PERPLEXITY_API_KEY,
            baseURL: 'https://api.perplexity.ai'
        });
    }

    /**
     * Clean and parse JSON from LLM response which might contain markdown blocks
     */
    _cleanJSON(text) {
        try {
            // Remove markdown code blocks if present
            const cleaned = text.replace(/```json\n?|```/g, '').trim();
            return JSON.parse(cleaned);
        } catch (error) {
            console.error('Failed to parse JSON from AI:', text);
            throw new Error('Invalid JSON format from AI');
        }
    }

    /**
     * Generate structured OKRs from a high-level prompt
     * @param {string} prompt - User's goal description
     * @param {string} type - 'MONTHLY' | 'QUARTERLY' | 'YEARLY'
     * @param {string} industry - Optional context
     */
    async generateOKR(prompt, type = 'MONTHLY', industry = 'E-commerce') {
        try {
            const completion = await this.openai.chat.completions.create({
                model: "sonar",
                messages: [
                    {
                        role: "system",
                        content: `You are an expert OKR consultant for an ${industry} business. 
                        Generate a structured Objective with 3-5 Key Results and 2-3 Actions per Key Result based on the user's goal.
                        
                        Return ONLY a valid JSON object. DO NOT include any explanatory text or markdown outside the JSON.
                        Structure:
                        {
                            "title": "Objective Title",
                            "type": "${type}",
                            "keyResults": [
                                {
                                    "title": "KR Title",
                                    "metric": "Metric Name",
                                    "targetValue": 100,
                                    "unit": "%",
                                    "actions": [
                                        { "title": "Action Title", "type": "GENERAL_OPTIMIZATION", "priority": "HIGH", "description": "Short description" }
                                    ]
                                }
                            ]
                        }
                        
                        IMPORTANT: 
                        1. Use ONLY the keys specified above.
                        2. "actions" must be an array inside each key result.
                        3. Action Types: DESCRIPTION_OPTIMIZATION, TITLE_OPTIMIZATION, IMAGE_OPTIMIZATION, PRICING_STRATEGY, INVENTORY_MANAGEMENT, REVIEW_MANAGEMENT, COMPETITOR_ANALYSIS, GENERAL_OPTIMIZATION.
                        4. Priorities: LOW, MEDIUM, HIGH, URGENT.`
                    },
                    {
                        role: "user",
                        content: `Goal: ${prompt}`
                    }
                ]
            });

            return this._cleanJSON(completion.choices[0].message.content);
        } catch (error) {
            console.error('AI Generation Error:', error);
            throw new Error('Failed to generate OKR from AI');
        }
    }

    /**
     * Suggest tasks for a specific Objective or Context
     * @param {string} context - Title of Objective or KR
     */
    async suggestTasks(context) {
        try {
            const completion = await this.openai.chat.completions.create({
                model: "sonar",
                messages: [
                    {
                        role: "system",
                        content: `Suggest 5 actionable tasks for the following context. 
                        Return ONLY JSON: { "tasks": [{ "title": "Task", "type": "GENERAL_OPTIMIZATION", "priority": "MEDIUM", "description": "Short description" }] }
                        Use these types: DESCRIPTION_OPTIMIZATION, TITLE_OPTIMIZATION, IMAGE_OPTIMIZATION, PRICING_STRATEGY, INVENTORY_MANAGEMENT, REVIEW_MANAGEMENT, COMPETITOR_ANALYSIS, GENERAL_OPTIMIZATION.`
                    },
                    {
                        role: "user",
                        content: `Context: ${context}`
                    }
                ]
            });

            return this._cleanJSON(completion.choices[0].message.content).tasks;
        } catch (error) {
            console.error('AI Suggestion Error:', error);
            throw new Error('Failed to suggest tasks');
        }
    }
}

module.exports = new AIService();
