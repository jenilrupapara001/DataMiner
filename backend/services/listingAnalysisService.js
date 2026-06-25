const nimService = require('./nimService');

class ListingAnalysisService {
    async analyze(asinData) {
        const title = asinData.Title || '';
        const bullets = asinData.BulletPointsText || '';
        const description = asinData.ProductDescription || '';
        const brand = asinData.Brand || '';
        const asinCode = asinData.AsinCode || '';
        const hasAplus = asinData.HasAplus;
        const imagesCount = asinData.ImagesCount || 0;
        const currentLQS = asinData.LQS || 0;

        const prompt = `You are an Amazon listing optimization expert. Analyze this product listing against Amazon's Content Policy guidelines and provide actionable optimization tasks.

ASIN: ${asinCode}
Brand: ${brand}
Current LQS: ${currentLQS}/10
Images: ${imagesCount}
A+ Content: ${hasAplus ? 'Yes' : 'No'}

TITLE (${title.length} chars):
${title || 'MISSING'}

BULLET POINTS:
${bullets || 'MISSING'}

PRODUCT DESCRIPTION:
${description || 'MISSING'}

Analyze each field against Amazon's policies and return JSON ONLY:
{
  "overallScore": Number (0-100),
  "summary": "One-line overall assessment",
  "issues": [
    {
      "field": "title|bullets|description|images|overall",
      "severity": "critical|high|medium|low",
      "issue": "What's wrong",
      "amazonPolicy": "Which Amazon policy this violates",
      "recommendation": "How to fix it",
      "priority": "HIGH|MEDIUM|LOW"
    }
  ],
  "tasks": [
    {
      "title": "Specific optimization task title",
      "description": "Detailed action with Amazon policy reference",
      "type": "TITLE_OPTIMIZATION|A_PLUS_CONTENT|DESCRIPTION_OPTIMIZATION|IMAGE_OPTIMIZATION|GENERAL_OPTIMIZATION",
      "priority": "HIGH|MEDIUM|LOW",
      "estimatedMinutes": Number,
      "reasoning": "Why this task is needed"
    }
  ]
}

Focus on:
- Title: 150-200 chars, brand first, key features, no keyword stuffing, proper capitalization
- Bullets: 5 bullets, 150-250 chars each, start with caps, highlight benefits not just features
- Description: 1000+ chars, HTML formatting, keyword-rich, unique selling points
- Images: Min 7 images, lifestyle shots, infographics, size charts`;

        const response = await nimService.chat([
            { role: "system", content: "You are an Amazon Seller Central content policy expert. Always return valid JSON." },
            { role: "user", content: prompt }
        ], { json: true, max_tokens: 3000 });

        return nimService.cleanJSON(response);
    }
}

module.exports = new ListingAnalysisService();
