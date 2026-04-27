/**
 * Description & A+ Content Quality Analyzer
 * 
 * Checks product descriptions and A+ content against Amazon's best practices.
 */

class DescriptionAnalyzer {
  
  /**
   * Main entry point - analyze description and A+ status
   * @param {object} params
   * @param {string} params.description - Raw description text or HTML
   * @param {boolean} params.hasAplus - Whether A+ content was detected
   * @param {object} params.metadata - Additional metadata
   * @returns {object} Analysis report
   */
  static analyze({ description = '', hasAplus = false, metadata = {} } = {}) {
    let score = 0;
    const issues = [];
    const recommendations = [];
    
    // Normalize description
    const cleanText = (description || '').trim();
    const length = cleanText.length;
    const wordCount = cleanText.split(/\s+/).filter(Boolean).length;
    
    const details = {
      length,
      wordCount,
      hasAplus,
      isHtml: /<[a-z][\s\S]*>/i.test(cleanText)
    };

    // 1. A+ Content (Weight: 45 points)
    // A+ content is the single most important factor for description quality on Amazon
    if (hasAplus) {
      score += 45;
    } else {
      issues.push('Missing A+ Content (Enhanced Brand Content)');
      recommendations.push('Create A+ Content to provide a premium shopping experience and improve conversion rates');
    }

    // 2. Length (Weight: 25 points)
    // Amazon descriptions should ideally be between 1000 and 2000 characters
    if (length >= 1000) {
      score += 25;
    } else if (length >= 500) {
      score += 15;
      issues.push('Description length is sub-optimal');
      recommendations.push('Expand the description to at least 1000 characters to provide more value and improve SEO');
    } else if (length >= 200) {
      score += 8;
      issues.push('Description is too short');
      recommendations.push('Add detailed information about the product\'s features, benefits, and use cases');
    } else if (length > 0) {
      score += 3;
      issues.push('Critical: Description is extremely short');
      recommendations.push('A short description looks unprofessional and fails to answer customer questions');
    } else {
      issues.push('Critical: Missing product description');
      recommendations.push('Add a product description as a fallback for customers who don\'t see A+ content');
    }

    // 3. Readability & Formatting (Weight: 20 points)
    // Check for paragraphs or breaks
    const hasBreaks = cleanText.includes('<br') || cleanText.includes('\n\n') || cleanText.includes('<p');
    if (hasBreaks) {
      score += 20;
    } else if (length > 300) {
      issues.push('Lack of formatting (Wall of text)');
      recommendations.push('Use line breaks or paragraphs to make the description easier to scan and read');
    } else {
      score += 10; // Small score for short descriptions that don't need much formatting
    }

    // 4. Prohibited Content & Policy Compliance (Weight: 10 points)
    const prohibitedTerms = [
      { term: 'http', label: 'URLs' },
      { term: 'www', label: 'URLs' },
      { term: '.com', label: 'URLs' },
      { term: 'phone', label: 'Contact Info' },
      { term: 'call', label: 'Contact Info' },
      { term: 'guarantee', label: 'Promotional Claims' },
      { term: 'warranty', label: 'Promotional Claims' },
      { term: 'best seller', label: 'Subjective Claims' },
      { term: 'free shipping', label: 'Shipping Info' }
    ];

    const foundProhibited = prohibitedTerms
      .filter(p => cleanText.toLowerCase().includes(p.term))
      .map(p => p.label);
    
    const uniqueProhibited = [...new Set(foundProhibited)];

    if (uniqueProhibited.length === 0) {
      score += 10;
    } else {
      issues.push(`Policy violation: Found prohibited content (${uniqueProhibited.join(', ')})`);
      recommendations.push('Remove URLs, contact information, and promotional/subjective claims to avoid listing suppression');
    }

    // Final Grade Calculation
    let grade = 'F';
    if (score >= 90) grade = 'A';
    else if (score >= 80) grade = 'B';
    else if (score >= 70) grade = 'C';
    else if (score >= 60) grade = 'D';

    return {
      score,
      grade,
      maxScore: 100,
      issues,
      recommendations,
      details
    };
  }
}

module.exports = DescriptionAnalyzer;
