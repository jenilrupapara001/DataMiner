const axios = require('axios');
const fs = require('fs');
const path = require('path');
const Asin = require('../models/Asin');
const Action = require('../models/Action');
const imageGenerationService = require('./imageGenerationService');

const INVOKE_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const MODEL_NAME = "meta/llama-3.2-90b-vision-instruct";

/**
 * Service to handle NVIDIA NIM AI interactions for listing quality auditing.
 */
class NvidiaAiService {
    constructor() {
        this.apiKey = process.env.NVIDIA_NIM_API_KEY;
    }

    /**
     * Standalone utility to analyze a listing image for quality standards.
     * Used by test suites and individual audits.
     */
    async analyzeListingImage(imageUrl) {
        if (!this.apiKey) throw new Error('NVIDIA_NIM_API_KEY not configured');

        const imageBase64 = await this._getImageAsBase64(imageUrl);
        if (!imageBase64) throw new Error('Failed to fetch image or convert to base64');

        const response = await axios.post(INVOKE_URL, {
            model: MODEL_NAME,
            messages: [
                {
                    role: "user",
                    content: [
                        { 
                            type: "text", 
                            text: "Analyze this Amazon product main image. \n1. Is the background pure white (#FFFFFF)? \n2. Does it look like high resolution (over 1000px)? \n3. Provide a detailed prompt to recreate this EXACT product with a pure white background and 4K quality if it fails these criteria. \nReturn JSON format: { \"hasWhiteBackground\": boolean, \"hasHighResolution\": boolean, \"description\": \"...\", \"recreationPrompt\": \"...\" }" 
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${imageBase64}`
                            }
                        }
                    ]
                }
            ],
            max_tokens: 1024,
            temperature: 0.2,
            response_format: { type: "json_object" }
        }, {
            headers: {
                "Authorization": `Bearer ${this.apiKey}`,
                "Content-Type": "application/json"
            }
        });

        const content = response.data.choices[0].message.content;
        return typeof content === 'string' ? JSON.parse(content) : content;
    }

    /**
     * Specifically generates just the reconstruction prompt for an image.
     */
    async generateReconstructionPrompt(imageUrl) {
        const analysis = await this.analyzeListingImage(imageUrl);
        return analysis.recreationPrompt || analysis.description;
    }

    /**
     * Interface for the test suite to trigger image generation.
     */
    async reconstructImage(prompt, asinCode) {
        console.log(`🎨 [AI-RECON] Reconstructing image for ${asinCode}...`);
        return await imageGenerationService.generateImage(prompt, asinCode);
    }

    /**
     * Audits an ASIN's main image for listing quality standards.
     * Checks for white background and high resolution.
     */
    async auditAsinImage(asinId) {
        if (!this.apiKey) {
            console.error('❌ NVIDIA_NIM_API_KEY not configured.');
            return null;
        }

        try {
            const asin = await Asin.findById(asinId);
            if (!asin || !asin.mainImageUrl) {
                console.warn(`⚠️ No image found for ASIN ${asin?.asinCode || asinId}`);
                return null;
            }

            console.log(`👁️ [AI-AUDIT] Auditing image for ASIN: ${asin.asinCode}...`);

            // Use the standalone analyzer
            const parsedResults = await this.analyzeListingImage(asin.mainImageUrl);

            console.log(`✅ [AI-AUDIT] Results for ${asin.asinCode}:`, parsedResults);

            // 3. Update ASIN LQS Details
            await Asin.findByIdAndUpdate(asinId, {
                'lqsDetails.hasWhiteBackground': parsedResults.hasWhiteBackground,
                'lqsDetails.hasHighResolution': parsedResults.hasHighResolution,
                'lqsDetails.imageAuditDate': new Date()
            });

            // 4. Act on results: Create Task or Auto-Generate
            if (!parsedResults.hasWhiteBackground || !parsedResults.hasHighResolution) {
                await this.handleAuditFailure(asin, parsedResults);
            }

            return parsedResults;
        } catch (error) {
            console.error('❌ NVIDIA AI Audit Error:', error.response?.data || error.message);
            return null;
        }
    }

    /**
     * Handles an audit failure by creating a task or auto-generating an image.
     */
    async handleAuditFailure(asin, results) {
        const title = `Optimize Main Image: ${asin.asinCode}`;
        const description = `AI Audit failed for the main image.\n\n` +
            `Reason: ${!results.hasWhiteBackground ? "Non-white background detected. " : ""}${!results.hasHighResolution ? "Low resolution detected. " : ""}\n\n` +
            `AI Vision Description: ${results.description}\n\n` +
            `Solution: Use the AI recreation prompt to generate a compliant image.`;

        // 1. Create the Action (Task)
        let action;
        const existingTask = await Action.findOne({ 
            resolvedAsins: asin.asinCode, 
            type: 'IMAGE_OPTIMIZATION',
            status: { $in: ['PENDING', 'IN_PROGRESS'] }
        });

        if (!existingTask) {
            console.log(`📝 [AI-ACTION] Creating optimization task for ${asin.asinCode}...`);
            action = await Action.create({
                title,
                description,
                type: 'IMAGE_OPTIMIZATION',
                priority: 'HIGH',
                resolvedAsins: [asin.asinCode],
                asins: [asin._id],
                isAIGenerated: true,
                aiReason: description,
                sellerId: asin.seller,
                createdBy: asin.seller
            });
        } else {
            action = existingTask;
        }

        // 2. AUTO-GENERATION (Requested "or creates image itself")
        if (results.recreationPrompt && action) {
            try {
                console.log(`🎨 [AI-GEN] Triggering auto-recreation for ${asin.asinCode}...`);
                const imageUrl = await this.reconstructImage(results.recreationPrompt, asin.asinCode);
                
                if (imageUrl) {
                    console.log(`✅ [AI-GEN] Image generated: ${imageUrl}`);
                    // Update task with the generated image
                    await Action.findByIdAndUpdate(action._id, {
                        $set: { 
                            description: action.description + `\n\n✅ AI GENERAED IMAGE READY: ${imageUrl}`,
                            data: { generatedImageUrl: imageUrl }
                        }
                    });
                }
            } catch (genError) {
                console.error(`❌ [AI-GEN] Auto-recreation failed for ${asin.asinCode}:`, genError.message);
            }
        }
    }

    /**
     * Helper to fetch image and convert to base64
     */
    async _getImageAsBase64(url) {
        try {
            const response = await axios.get(url, { responseType: 'arraybuffer' });
            return Buffer.from(response.data, 'binary').toString('base64');
        } catch (err) {
            console.error('❌ Failed to convert image to base64:', err.message);
            return null;
        }
    }
}

module.exports = new NvidiaAiService();
