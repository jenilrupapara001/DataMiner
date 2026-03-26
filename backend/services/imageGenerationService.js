const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const Asin = require('../models/Asin');
const Action = require('../models/Action');

const INVOKE_URL = "https://ai.api.nvidia.com/v1/genai/stabilityai/stable-diffusion-3-medium";

/**
 * Generates an image using Nvidia NIM (Stable Diffusion 3)
 * @param {string} prompt - The prompt for image generation
 * @param {string} asinCode - The ASIN code for directory naming
 * @returns {Promise<string>} - The path to the saved image
 */
async function generateImage(prompt, asinCode) {
    const apiKey = process.env.NVIDIA_NIM_API_KEY;
    if (!apiKey) {
        throw new Error("NVIDIA_NIM_API_KEY is not defined in environment variables");
    }

    const headers = {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json",
        "Content-Type": "application/json"
    };

    const payload = {
        "prompt": prompt,
        "cfg_scale": 5,
        "aspect_ratio": "16:9",
        "seed": 0,
        "steps": 30, // Reduced from 50 for faster response in dashboard
        "negative_prompt": "blurry, low quality, distorted, watermark, text, signature"
    };

    console.log(`[AI-IMAGE] Generating image for ASIN ${asinCode} with prompt: ${prompt}`);

    const response = await fetch(INVOKE_URL, {
        method: "POST",
        body: JSON.stringify(payload),
        headers: headers
    });

    if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Nvidia NIM invocation failed: ${response.status} ${errBody}`);
    }

    const responseBody = await response.json();
    
    // Check if artifacts exist (Stable Diffusion 3 Medium response structure)
    if (!responseBody.artifacts || responseBody.artifacts.length === 0) {
        // Some versions return { image: "base64..." } or similar
        // Let's handle the expected structure from user snippet
        if (responseBody.image) {
            return saveImage(responseBody.image, asinCode);
        }
        throw new Error("No image data found in Nvidia response");
    }

    const b64 = responseBody.artifacts[0].base64;
    return saveImage(b64, asinCode);
}

/**
 * Saves a base64 image to the local filesystem
 */
function saveImage(b64, asinCode) {
    const uploadDir = path.join(__dirname, '../uploads/asin_images', asinCode);
    
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    const fileName = `gen_${Date.now()}.png`;
    const filePath = path.join(uploadDir, fileName);
    const buffer = Buffer.from(b64, 'base64');
    
    fs.writeFileSync(filePath, buffer);
    
    // Return relative path for frontend access
    return `/uploads/asin_images/${asinCode}/${fileName}`;
}

/**
 * Triggers image generation for an ASIN if it has low image count
 */
async function triggerAiImageTask(asinId) {
    try {
        const asin = await Asin.findById(asinId);
        if (!asin) return;

        // Construct a descriptive prompt based on product title and category
        const prompt = `Professional product photography of ${asin.title}, ${asin.category || ''}, studio lighting, high resolution, 8k, pristine white background, commercial quality.`;

        const imageUrl = await generateImage(prompt, asin.asinCode);

        // Optional: Update ASIN or create an action item to review this image
        // For now, we'll just log it. In a real scenario, we might add it to a "Generated Content" gallery.
        console.log(`[AI-IMAGE] Successfully generated image for ${asin.asinCode}: ${imageUrl}`);
        
        return imageUrl;
    } catch (error) {
        console.error(`[AI-IMAGE] Error in triggerAiImageTask:`, error);
        throw error;
    }
}

module.exports = {
    generateImage,
    triggerAiImageTask
};
