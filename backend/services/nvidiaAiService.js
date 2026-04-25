const axios = require('axios');
const { sql, getPool, generateId } = require('../database/db');
const imageGenerationService = require('./imageGenerationService');

const INVOKE_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const MODEL_NAME = "meta/llama-3.2-90b-vision-instruct";

/**
 * Service to handle NVIDIA NIM AI interactions (SQL Version)
 */
class NvidiaAiService {
    constructor() {
        this.apiKey = process.env.NVIDIA_NIM_API_KEY;
    }

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

    async generateReconstructionPrompt(imageUrl) {
        const analysis = await this.analyzeListingImage(imageUrl);
        return analysis.recreationPrompt || analysis.description;
    }

    async reconstructImage(prompt, asinCode) {
        console.log(`🎨 [AI-RECON] Reconstructing image for ${asinCode}...`);
        return await imageGenerationService.generateImage(prompt, asinCode);
    }

    async auditAsinImage(asinId) {
        if (!this.apiKey) return null;

        try {
            const pool = await getPool();
            const result = await pool.request()
                .input('id', sql.VarChar, asinId)
                .query("SELECT * FROM Asins WHERE Id = @id");
            
            const asin = result.recordset[0];
            if (!asin || !asin.ImageUrl) return null;

            console.log(`👁️ [AI-AUDIT] Auditing image for ASIN: ${asin.AsinCode}...`);
            const parsedResults = await this.analyzeListingImage(asin.ImageUrl);

            // Update ASIN LQS Details
            let lqsDetails = {};
            try {
                lqsDetails = JSON.parse(asin.LqsDetails || '{}');
            } catch (e) { lqsDetails = {}; }

            lqsDetails.hasWhiteBackground = parsedResults.hasWhiteBackground;
            lqsDetails.hasHighResolution = parsedResults.hasHighResolution;
            lqsDetails.imageAuditDate = new Date();

            await pool.request()
                .input('id', sql.VarChar, asinId)
                .input('lqsDetails', sql.NVarChar, JSON.stringify(lqsDetails))
                .query("UPDATE Asins SET LqsDetails = @lqsDetails, UpdatedAt = GETDATE() WHERE Id = @id");

            if (!parsedResults.hasWhiteBackground || !parsedResults.hasHighResolution) {
                await this.handleAuditFailure(asin, parsedResults);
            }

            return parsedResults;
        } catch (error) {
            console.error('❌ NVIDIA AI Audit Error:', error.message);
            return null;
        }
    }

    async handleAuditFailure(asin, results) {
        try {
            const pool = await getPool();
            const title = `Optimize Main Image: ${asin.AsinCode}`;
            const description = `AI Audit failed for the main image.\n\n` +
                `Reason: ${!results.hasWhiteBackground ? "Non-white background detected. " : ""}${!results.hasHighResolution ? "Low resolution detected. " : ""}\n\n` +
                `AI Vision Description: ${results.description}\n\n` +
                `Solution: Use the AI recreation prompt to generate a compliant image.`;

            // Check for existing task
            const existingRes = await pool.request()
                .input('asinId', sql.VarChar, asin.Id)
                .input('type', sql.NVarChar, 'IMAGE_OPTIMIZATION')
                .query("SELECT Id FROM Actions WHERE AsinId = @asinId AND Type = @type AND Status IN ('PENDING', 'IN_PROGRESS')");

            let actionId;
            if (existingRes.recordset.length === 0) {
                actionId = generateId();
                await pool.request()
                    .input('Id', sql.VarChar, actionId)
                    .input('Title', sql.NVarChar, title)
                    .input('Description', sql.NVarChar, description)
                    .input('Type', sql.NVarChar, 'IMAGE_OPTIMIZATION')
                    .input('Priority', sql.NVarChar, 'HIGH')
                    .input('Status', sql.NVarChar, 'PENDING')
                    .input('AsinId', sql.VarChar, asin.Id)
                    .input('IsAIGenerated', sql.Bit, 1)
                    .input('AiReasoning', sql.NVarChar, description)
                    .input('SellerId', sql.VarChar, asin.SellerId)
                    .input('CreatedBy', sql.VarChar, asin.SellerId)
                    .query(`
                        INSERT INTO Actions (Id, Title, Description, Type, Priority, Status, AsinId, IsAIGenerated, AiReasoning, SellerId, CreatedBy, CreatedAt, UpdatedAt)
                        VALUES (@Id, @Title, @Description, @Type, @Priority, @Status, @AsinId, @IdAIGenerated, @AiReasoning, @SellerId, @CreatedBy, GETDATE(), GETDATE())
                    `);
            } else {
                actionId = existingRes.recordset[0].Id;
            }

            if (results.recreationPrompt && actionId) {
                const imageUrl = await this.reconstructImage(results.recreationPrompt, asin.AsinCode);
                if (imageUrl) {
                    await pool.request()
                        .input('id', sql.VarChar, actionId)
                        .input('desc', sql.NVarChar, description + `\n\n✅ AI GENERATED IMAGE READY: ${imageUrl}`)
                        .query("UPDATE Actions SET Description = @desc, UpdatedAt = GETDATE() WHERE Id = @id");
                }
            }
        } catch (err) {
            console.error('[NvidiaAiService] handleAuditFailure error:', err);
        }
    }

    async _getImageAsBase64(url) {
        try {
            const response = await axios.get(url, { responseType: 'arraybuffer' });
            return Buffer.from(response.data, 'binary').toString('base64');
        } catch (err) {
            return null;
        }
    }
}

module.exports = new NvidiaAiService();
