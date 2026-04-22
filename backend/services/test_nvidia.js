const nvidiaAiService = require('./nvidiaAiService');
require('dotenv').config();

async function testNvidiaIntegration() {
    console.log('🚀 Starting NVIDIA NIM Integration Test...');
    
    // 1. Test Image Analysis
    const testImageUrl = 'https://m.media-amazon.com/images/I/71u-S9K-D1L._SL1500_.jpg'; // Example Amazon image
    console.log('\n--- 1. Testing Vision Analysis (nvidia/vila-1.5-3b) ---');
    try {
        const analysis = await nvidiaAiService.analyzeListingImage(testImageUrl);
        console.log('✅ Analysis Result:', JSON.stringify(analysis, null, 2));
    } catch (error) {
        console.error('❌ Analysis Failed:', error.message);
    }

    // 2. Test Prompt Generation
    console.log('\n--- 2. Testing Prompt Engineering ---');
    try {
        const prompt = await nvidiaAiService.generateReconstructionPrompt(testImageUrl);
        console.log('✅ Generated Prompt:', prompt.substring(0, 100) + '...');
    } catch (error) {
        console.error('❌ Prompt Gen Failed:', error.message);
    }

    // 3. Test Image Generation (FLUX.1)
    // Note: I'll only test if prompt exists to avoid unnecessary credit usage if previous step failed
    console.log('\n--- 3. Testing Image Reconstruction (FLUX.1-dev) ---');
    try {
        const testPrompt = "A professional espresso machine with sleek stainless steel finish, steam wand visible, on a pure white background.";
        const localPath = await nvidiaAiService.reconstructImage(testPrompt, 'TEST_ASIN');
        console.log('✅ Reconstructed Image Path:', localPath);
    } catch (error) {
        console.error('❌ Reconstruction Failed:', error.message);
    }

    console.log('\n🏁 Test Suite Complete.');
}

// Check if running directly
if (require.main === module) {
    testNvidiaIntegration();
}

module.exports = testNvidiaIntegration;
