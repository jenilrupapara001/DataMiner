/**
 * Bullet Points Quality Analyzer
 * 
 * Checks Amazon product bullet points against Amazon's official requirements
 * and best practices, returning a detailed score and issue list.
 */

class BulletPointsAnalyzer {

  /**
   * Main entry point - analyze bullet points and return full report
   * @param {string[]|string} bullets - Array of bullet point strings, or JSON string
   * @returns {object} Analysis report
   */
  static analyze(bullets) {
    // Normalize input
    let bulletArray = [];
    
    if (!bullets) {
      return this.emptyResult('No bullet points provided');
    }

    if (typeof bullets === 'string') {
      // Try parsing as JSON first
      try {
        const parsed = JSON.parse(bullets);
        if (Array.isArray(parsed)) {
          bulletArray = parsed.filter(b => typeof b === 'string' && b.trim().length > 0);
        } else {
          // Single string - split by newlines or common delimiters
          bulletArray = bullets
            .split(/\n|•|-|\*|\.\s+(?=[A-Z])/)
            .map(b => b.trim())
            .filter(b => b.length > 0);
        }
      } catch (e) {
        // Plain text - try to split into bullet points
        bulletArray = bullets
          .split(/\n|•|-|\*|\.\s+(?=[A-Z])/)
          .map(b => b.trim())
          .filter(b => b.length > 0);
      }
    } else if (Array.isArray(bullets)) {
      bulletArray = bullets.filter(b => typeof b === 'string' && b.trim().length > 0);
    }

    if (bulletArray.length === 0) {
      return this.emptyResult('No bullet points found');
    }

    // Run all checks
    const checks = {
      bulletCount: this.checkBulletCount(bulletArray),
      characterLength: this.checkCharacterLength(bulletArray),
      capitalization: this.checkCapitalization(bulletArray),
      sentenceFragment: this.checkSentenceFragment(bulletArray),
      specialCharacters: this.checkSpecialCharacters(bulletArray),
      emojis: this.checkEmojis(bulletArray),
      placeholderText: this.checkPlaceholderText(bulletArray),
      prohibitedClaims: this.checkProhibitedClaims(bulletArray),
      guaranteeInfo: this.checkGuaranteeInfo(bulletArray),
      externalInfo: this.checkExternalInfo(bulletArray),
      repetitiveContent: this.checkRepetitiveContent(bulletArray),
      contentStructure: this.checkContentStructure(bulletArray),
      contentFocus: this.checkContentFocus(bulletArray),
      numbering: this.checkNumbering(bulletArray),
      measurements: this.checkMeasurements(bulletArray),
      asinReferences: this.checkAsinReferences(bulletArray),
    };

    // Calculate weighted score
    const weights = {
      bulletCount: 15,          // Hard requirement - at least 3 bullets
      characterLength: 10,      // Hard requirement - 10-255 chars each
      capitalization: 5,        // Best practice
      sentenceFragment: 5,      // Best practice
      specialCharacters: 10,    // Prohibited
      emojis: 10,              // Prohibited
      placeholderText: 10,     // Prohibited
      prohibitedClaims: 10,    // Prohibited
      guaranteeInfo: 5,        // Prohibited
      externalInfo: 5,         // Prohibited
      repetitiveContent: 10,   // Prohibited
      contentStructure: 5,     // Best practice
      contentFocus: 5,         // Best practice
      numbering: 2,            // Best practice
      measurements: 2,         // Best practice
      asinReferences: 1,       // Best practice
    };

    let totalScore = 0;
    const allIssues = [];
    const allRecommendations = [];
    const details = {};

    for (const [checkName, result] of Object.entries(checks)) {
      const weight = weights[checkName] || 0;
      const earnedScore = Math.round((result.score / 100) * weight);
      totalScore += earnedScore;

      details[checkName] = {
        ...result,
        weight,
        earnedScore,
        maxScore: weight
      };

      if (result.issues) {
        allIssues.push(...result.issues.map(i => `[Bullets] ${i}`));
      }
      if (result.recommendations) {
        allRecommendations.push(...result.recommendations);
      }
    }

    const grade = this.getGrade(totalScore);

    return {
      score: totalScore,
      grade,
      maxScore: 100,
      bulletCount: bulletArray.length,
      bullets: bulletArray,
      totalIssues: allIssues.length,
      issues: allIssues,
      recommendations: allRecommendations,
      details,
      summary: this.getSummary(totalScore, grade, bulletArray.length)
    };
  }

  // ==========================================
  // 1. BULLET COUNT (Minimum 3)
  // ==========================================
  static checkBulletCount(bulletArray) {
    const count = bulletArray.length;

    if (count === 0) {
      return {
        score: 0,
        count: 0,
        status: 'fail',
        issues: ['No bullet points found'],
        recommendations: ['Add at least 3 bullet points highlighting key product features']
      };
    }

    if (count < 3) {
      return {
        score: 20,
        count,
        status: 'fail',
        issues: [`Only ${count} bullet point(s) found - minimum 3 required`],
        recommendations: [`Add ${3 - count} more bullet point(s) to meet Amazon's minimum requirement`]
      };
    }

    if (count === 3) {
      return {
        score: 70,
        count,
        status: 'pass',
        issues: [],
        recommendations: ['Consider adding 2-3 more bullet points for better product communication']
      };
    }

    if (count >= 5) {
      return {
        score: 100,
        count,
        status: 'pass',
        issues: [],
        recommendations: count > 7 ? ['Having many bullet points is good, but ensure each is unique and valuable'] : []
      };
    }

    return {
      score: 85,
      count,
      status: 'pass',
      issues: [],
      recommendations: ['Good number of bullet points']
    };
  }

  // ==========================================
  // 2. CHARACTER LENGTH (10-255 per bullet)
  // ==========================================
  static checkCharacterLength(bulletArray) {
    const tooShort = [];
    const tooLong = [];
    const goodLength = [];

    bulletArray.forEach((bullet, index) => {
      const len = bullet.length;
      if (len < 10) {
        tooShort.push({ index: index + 1, text: bullet, length: len });
      } else if (len > 255) {
        tooLong.push({ index: index + 1, text: bullet.substring(0, 50) + '...', length: len });
      } else {
        goodLength.push({ index: index + 1, length: len });
      }
    });

    const issues = [];
    const recommendations = [];

    if (tooShort.length > 0) {
      issues.push(`${tooShort.length} bullet point(s) are too short (under 10 characters)`);
      recommendations.push(`Expand bullet points #${tooShort.map(b => b.index).join(', ')} to at least 10 characters`);
    }

    if (tooLong.length > 0) {
      issues.push(`${tooLong.length} bullet point(s) exceed 255 character limit`);
      recommendations.push(`Shorten bullet points #${tooLong.map(b => b.index).join(', ')} to under 255 characters`);
    }

    if (tooShort.length === 0 && tooLong.length === 0) {
      return {
        score: 100,
        status: 'pass',
        tooShort: [],
        tooLong: [],
        avgLength: Math.round(bulletArray.reduce((sum, b) => sum + b.length, 0) / bulletArray.length),
        issues: [],
        recommendations: []
      };
    }

    const failCount = tooShort.length + tooLong.length;
    const ratio = 1 - (failCount / bulletArray.length);

    return {
      score: Math.round(ratio * 100),
      status: ratio > 0.5 ? 'warning' : 'fail',
      tooShort,
      tooLong,
      avgLength: Math.round(bulletArray.reduce((sum, b) => sum + b.length, 0) / bulletArray.length),
      issues,
      recommendations
    };
  }

  // ==========================================
  // 3. CAPITALIZATION (Start with capital)
  // ==========================================
  static checkCapitalization(bulletArray) {
    const notCapitalized = [];

    bulletArray.forEach((bullet, index) => {
      const trimmed = bullet.trim();
      if (trimmed.length > 0 && trimmed[0] !== trimmed[0].toUpperCase()) {
        notCapitalized.push({ index: index + 1, text: trimmed.substring(0, 40) });
      }
    });

    if (notCapitalized.length > 0) {
      return {
        score: Math.round((1 - notCapitalized.length / bulletArray.length) * 100),
        status: notCapitalized.length > bulletArray.length / 2 ? 'fail' : 'warning',
        notCapitalized,
        issues: [`${notCapitalized.length} bullet point(s) do not start with a capital letter`],
        recommendations: ['Begin each bullet point with a capital letter']
      };
    }

    return {
      score: 100,
      status: 'pass',
      notCapitalized: [],
      issues: [],
      recommendations: []
    };
  }

  // ==========================================
  // 4. SENTENCE FRAGMENT (No end punctuation)
  // ==========================================
  static checkSentenceFragment(bulletArray) {
    const endPunctuation = ['.', '!', '?'];
    const hasEndPunctuation = [];

    bulletArray.forEach((bullet, index) => {
      const trimmed = bullet.trim();
      const lastChar = trimmed[trimmed.length - 1];
      if (endPunctuation.includes(lastChar)) {
        hasEndPunctuation.push({ index: index + 1, text: trimmed.substring(0, 40), endsWith: lastChar });
      }
    });

    if (hasEndPunctuation.length > 0) {
      return {
        score: Math.round((1 - hasEndPunctuation.length / bulletArray.length) * 100),
        status: hasEndPunctuation.length > bulletArray.length / 2 ? 'warning' : 'pass',
        hasEndPunctuation,
        issues: [`${hasEndPunctuation.length} bullet point(s) end with punctuation`],
        recommendations: ['Remove end punctuation from bullet points - use sentence fragments']
      };
    }

    return {
      score: 100,
      status: 'pass',
      hasEndPunctuation: [],
      issues: [],
      recommendations: []
    };
  }

  // ==========================================
  // 5. SPECIAL CHARACTERS (™, ®, €, …, †, ‡, etc.)
  // ==========================================
  static checkSpecialCharacters(bulletArray) {
    const prohibitedChars = ['™', '®', '€', '…', '†', '‡', '¢', '£', '¥', '©', '±', '~', 'â', 'º'];
    const violations = [];

    bulletArray.forEach((bullet, index) => {
      for (const char of prohibitedChars) {
        if (bullet.includes(char)) {
          violations.push({ index: index + 1, char, text: bullet.substring(0, 50) });
        }
      }
    });

    if (violations.length > 0) {
      const uniqueChars = [...new Set(violations.map(v => v.char))];
      return {
        score: violations.length > 3 ? 0 : 30,
        status: 'fail',
        violations,
        issues: [`${violations.length} instances of prohibited special characters found: ${uniqueChars.join(', ')}`],
        recommendations: ['Remove all prohibited special characters (™, ®, €, ©, etc.) from bullet points']
      };
    }

    return {
      score: 100,
      status: 'pass',
      violations: [],
      issues: [],
      recommendations: []
    };
  }

  // ==========================================
  // 6. EMOJIS CHECK
  // ==========================================
  static checkEmojis(bulletArray) {
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}]/u;
    const violators = [];

    bulletArray.forEach((bullet, index) => {
      if (emojiRegex.test(bullet)) {
        violators.push({ index: index + 1, text: bullet.substring(0, 50) });
      }
    });

    if (violators.length > 0) {
      return {
        score: 0,
        status: 'fail',
        violators,
        issues: [`${violators.length} bullet point(s) contain emojis - this is prohibited`],
        recommendations: ['Remove all emojis from bullet points']
      };
    }

    return {
      score: 100,
      status: 'pass',
      violators: [],
      issues: [],
      recommendations: []
    };
  }

  // ==========================================
  // 7. PLACEHOLDER TEXT CHECK
  // ==========================================
  static checkPlaceholderText(bulletArray) {
    const placeholders = [
      'not applicable', 'na', 'n/a', 'not eligible',
      'yet to decide', 'to be decided', 'tbd', 'copy pending',
      'placeholder', 'text here', 'lorem ipsum', 'todo',
      'add later', 'coming soon', 'xxx', 'test', 'temp'
    ];

    const violations = [];

    bulletArray.forEach((bullet, index) => {
      const lower = bullet.toLowerCase();
      for (const ph of placeholders) {
        if (lower.includes(ph)) {
          violations.push({ index: index + 1, placeholder: ph, text: bullet.substring(0, 60) });
          break;
        }
      }
    });

    if (violations.length > 0) {
      return {
        score: 0,
        status: 'fail',
        violations,
        issues: [`${violations.length} bullet point(s) contain placeholder text`],
        recommendations: ['Replace all placeholder text with actual product features']
      };
    }

    return {
      score: 100,
      status: 'pass',
      violations: [],
      issues: [],
      recommendations: []
    };
  }

  // ==========================================
  // 8. PROHIBITED CLAIMS CHECK
  // ==========================================
  static checkProhibitedClaims(bulletArray) {
    const prohibitedClaims = [
      'eco-friendly', 'eco friendly', 'environmentally friendly',
      'ecologically friendly', 'anti-microbial', 'anti microbial',
      'antibacterial', 'anti-bacterial', 'made from bamboo',
      'contains bamboo', 'made from soy', 'contains soy',
      'hypoallergenic', 'non-toxic', 'chemical-free', 'chemical free',
      'organic', 'natural', 'sustainable', 'biodegradable',
      'recyclable', 'recycled', 'renewable', 'compostable'
    ];

    const violations = [];

    bulletArray.forEach((bullet, index) => {
      const lower = bullet.toLowerCase();
      for (const claim of prohibitedClaims) {
        if (lower.includes(claim)) {
          violations.push({ index: index + 1, claim, text: bullet.substring(0, 60) });
          break;
        }
      }
    });

    if (violations.length > 0) {
      const uniqueClaims = [...new Set(violations.map(v => v.claim))];
      return {
        score: 0,
        status: 'fail',
        violations,
        issues: [`${violations.length} bullet point(s) contain prohibited claims: ${uniqueClaims.join(', ')}`],
        recommendations: ['Remove prohibited claims unless verifiable on product packaging. Review Amazon\'s general listing restrictions.']
      };
    }

    return {
      score: 100,
      status: 'pass',
      violations: [],
      issues: [],
      recommendations: []
    };
  }

  // ==========================================
  // 9. GUARANTEE / RETURN INFO CHECK
  // ==========================================
  static checkGuaranteeInfo(bulletArray) {
    const guaranteePhrases = [
      'full refund', 'money back', 'satisfaction guaranteed',
      'unconditional guarantee', '100% satisfaction', 'no questions asked',
      'send it back', 'return for full refund', 'lifetime guarantee',
      'lifetime warranty', 'free returns', 'hassle-free returns',
      'no risk', 'risk-free', 'try it risk free'
    ];

    const violations = [];

    bulletArray.forEach((bullet, index) => {
      const lower = bullet.toLowerCase();
      for (const phrase of guaranteePhrases) {
        if (lower.includes(phrase)) {
          violations.push({ index: index + 1, phrase, text: bullet.substring(0, 60) });
          break;
        }
      }
    });

    if (violations.length > 0) {
      return {
        score: 0,
        status: 'fail',
        violations,
        issues: [`${violations.length} bullet point(s) contain guarantee/return information`],
        recommendations: ['Remove guarantee and return policy information from bullet points']
      };
    }

    return {
      score: 100,
      status: 'pass',
      violations: [],
      issues: [],
      recommendations: []
    };
  }

  // ==========================================
  // 10. EXTERNAL INFO CHECK
  // ==========================================
  static checkExternalInfo(bulletArray) {
    const urlRegex = /https?:\/\/[^\s]+/gi;
    const emailRegex = /[\w.-]+@[\w.-]+\.\w+/gi;
    const phoneRegex = /(\+?\d{1,3}[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}/g;
    
    const violations = [];

    bulletArray.forEach((bullet, index) => {
      if (urlRegex.test(bullet)) {
        const urls = bullet.match(urlRegex);
        violations.push({ index: index + 1, type: 'URL', found: urls });
      }
      if (emailRegex.test(bullet)) {
        const emails = bullet.match(emailRegex);
        violations.push({ index: index + 1, type: 'Email', found: emails });
      }
      if (phoneRegex.test(bullet)) {
        const phones = bullet.match(phoneRegex);
        violations.push({ index: index + 1, type: 'Phone', found: phones });
      }
    });

    if (violations.length > 0) {
      return {
        score: 0,
        status: 'fail',
        violations,
        issues: [`${violations.length} bullet point(s) contain external links or contact information`],
        recommendations: ['Remove all URLs, emails, phone numbers, and company information from bullet points']
      };
    }

    return {
      score: 100,
      status: 'pass',
      violations: [],
      issues: [],
      recommendations: []
    };
  }

  // ==========================================
  // 11. REPETITIVE CONTENT CHECK
  // ==========================================
  static checkRepetitiveContent(bulletArray) {
    // Check for similar bullet points using Jaccard similarity
    const duplicates = [];
    const pairs = [];

    for (let i = 0; i < bulletArray.length; i++) {
      for (let j = i + 1; j < bulletArray.length; j++) {
        const similarity = this.calculateSimilarity(
          bulletArray[i].toLowerCase(),
          bulletArray[j].toLowerCase()
        );
        if (similarity > 0.6) {
          pairs.push({ 
            bullet1: i + 1, 
            bullet2: j + 1, 
            similarity: Math.round(similarity * 100),
            text1: bulletArray[i].substring(0, 40),
            text2: bulletArray[j].substring(0, 40)
          });
        }
      }
    }

    if (pairs.length > 0) {
      return {
        score: Math.max(0, 100 - (pairs.length * 25)),
        status: pairs.length > 2 ? 'fail' : 'warning',
        similarPairs: pairs,
        issues: [`${pairs.length} pair(s) of bullet points are very similar (60%+ overlap)`],
        recommendations: ['Ensure each bullet point covers unique product information']
      };
    }

    // Also check for word repetition across bullets
    const allWords = bulletArray.join(' ').toLowerCase().split(/\s+/);
    const wordFreq = {};
    allWords.forEach(w => {
      const clean = w.replace(/[^a-z0-9]/g, '');
      if (clean.length > 3) {
        wordFreq[clean] = (wordFreq[clean] || 0) + 1;
      }
    });

    const highFreqWords = Object.entries(wordFreq)
      .filter(([word, count]) => count > bulletArray.length * 2)
      .map(([word, count]) => ({ word, count }));

    if (highFreqWords.length > 5) {
      return {
        score: 50,
        status: 'warning',
        highFreqWords,
        issues: ['Excessive word repetition across bullet points detected'],
        recommendations: ['Vary vocabulary across bullet points to provide unique information']
      };
    }

    return {
      score: 100,
      status: 'pass',
      similarPairs: [],
      issues: [],
      recommendations: []
    };
  }

  // ==========================================
  // 12. CONTENT STRUCTURE (Header: Description)
  // ==========================================
  static checkContentStructure(bulletArray) {
    const structuredCount = bulletArray.filter(bullet => {
      // Check for "Header: Description" pattern
      return /^[A-Z][a-z]+(?:\s[a-z]+){0,3}:\s/.test(bullet.trim());
    }).length;

    const ratio = structuredCount / bulletArray.length;

    if (ratio >= 0.8) {
      return {
        score: 100,
        status: 'pass',
        structuredCount,
        ratio,
        issues: [],
        recommendations: []
      };
    }

    if (ratio >= 0.5) {
      return {
        score: 70,
        status: 'warning',
        structuredCount,
        ratio,
        issues: ['Some bullet points could benefit from the "Header: Description" format'],
        recommendations: ['Structure bullet points as: Feature name: Brief description of the benefit']
      };
    }

    return {
      score: ratio >= 0.3 ? 40 : 20,
      status: 'warning',
      structuredCount,
      ratio,
      issues: ['Most bullet points lack the recommended "Header: Description" structure'],
      recommendations: ['Use the format: "Material: Made from 100% cotton for breathability"']
    };
  }

  // ==========================================
  // 13. CONTENT FOCUS CHECK
  // ==========================================
  static checkContentFocus(bulletArray) {
    // Keywords that indicate good product feature focus
    const featureKeywords = [
      'made', 'material', 'fabric', 'design', 'feature',
      'includes', 'comes with', 'perfect for', 'great for',
      'ideal for', 'suitable for', 'designed', 'built',
      'constructed', 'crafted', 'dimensions', 'size',
      'weight', 'capacity', 'battery', 'compatible',
      'works with', 'easy to', 'adjustable', 'removable',
      'washable', 'durable', 'lightweight', 'portable',
      'waterproof', 'water resistant', 'breathable', 'comfortable'
    ];

    const featureFocusedCount = bulletArray.filter(bullet => {
      const lower = bullet.toLowerCase();
      return featureKeywords.some(kw => lower.includes(kw));
    }).length;

    const ratio = featureFocusedCount / bulletArray.length;

    if (ratio >= 0.7) {
      return {
        score: 100,
        status: 'pass',
        featureFocusedCount,
        ratio,
        issues: [],
        recommendations: []
      };
    }

    return {
      score: Math.round(ratio * 100),
      status: ratio >= 0.5 ? 'warning' : 'fail',
      featureFocusedCount,
      ratio,
      issues: ['Bullet points should focus more on product features and benefits'],
      recommendations: ['Describe specific product features: materials, dimensions, use cases, benefits']
    };
  }

  // ==========================================
  // 14. NUMBERING (1-9 written out)
  // ==========================================
  static checkNumbering(bulletArray) {
    const digitsToWrite = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
    const violations = [];

    bulletArray.forEach((bullet, index) => {
      // Check for digits 1-9 that should be written out
      // Exclude: measurements (followed by units), model numbers
      const regex = /(?<!\d)([1-9])(?!\d|\s*(cm|mm|in|inch|ft|oz|kg|g|lb|ml|l|hr|min|sec|w|v|a|hz|gb|tb|mb|kb)\b)/gi;
      let match;
      while ((match = regex.exec(bullet)) !== null) {
        // Skip if part of a measurement or model number
        if (!/\d/.test(bullet.substring(Math.max(0, match.index - 1), match.index)) &&
            !/\d/.test(bullet.substring(match.index + 1, match.index + 2))) {
          violations.push({ index: index + 1, digit: match[0], text: bullet.substring(0, 50) });
        }
      }
    });

    if (violations.length > 0) {
      const uniqueDigits = [...new Set(violations.map(v => v.digit))];
      return {
        score: Math.max(30, 100 - violations.length * 15),
        status: violations.length > 3 ? 'warning' : 'pass',
        violations,
        issues: [`${violations.length} instances of digits 1-9 should be written out as words`],
        recommendations: ['Write numbers one through nine as words, unless they are measurements or model numbers']
      };
    }

    return {
      score: 100,
      status: 'pass',
      violations: [],
      issues: [],
      recommendations: []
    };
  }

  // ==========================================
  // 15. MEASUREMENTS FORMAT CHECK
  // ==========================================
  static checkMeasurements(bulletArray) {
    const measurementRegex = /(\d+)(cm|mm|in|inch|ft|oz|kg|g|lb|ml|l)/gi;
    const issues = [];

    bulletArray.forEach((bullet, index) => {
      let match;
      while ((match = measurementRegex.exec(bullet)) !== null) {
        // Check there's a space before the measurement
        const fullMatch = match[0];
        const startIdx = match.index;
        if (startIdx > 0 && bullet[startIdx - 1] !== ' ') {
          issues.push({ 
            index: index + 1, 
            measurement: fullMatch, 
            text: bullet.substring(Math.max(0, startIdx - 5), startIdx + fullMatch.length + 5) 
          });
        }
      }
    });

    if (issues.length > 0) {
      return {
        score: Math.max(40, 100 - issues.length * 20),
        status: issues.length > 2 ? 'warning' : 'pass',
        issues,
        bulletIssues: [`${issues.length} measurement(s) missing space between number and unit`],
        recommendations: ['Add a space between numbers and units: "60 ml" not "60ml"']
      };
    }

    return {
      score: 100,
      status: 'pass',
      measurementIssues: [],
      issues: [],
      recommendations: []
    };
  }

  // ==========================================
  // 16. ASIN REFERENCES CHECK
  // ==========================================
  static checkAsinReferences(bulletArray) {
    const asinRegex = /B0[A-Z0-9]{8}/gi;
    const violations = [];

    bulletArray.forEach((bullet, index) => {
      const asins = bullet.match(asinRegex);
      if (asins) {
        violations.push({ index: index + 1, asins, text: bullet.substring(0, 60) });
      }
    });

    if (violations.length > 0) {
      return {
        score: 0,
        status: 'fail',
        violations,
        issues: [`${violations.length} bullet point(s) reference other ASINs`],
        recommendations: ['Remove references to other ASINs from bullet points']
      };
    }

    return {
      score: 100,
      status: 'pass',
      violations: [],
      issues: [],
      recommendations: []
    };
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================
  static calculateSimilarity(text1, text2) {
    const words1 = new Set(text1.split(/\s+/).filter(w => w.length > 3));
    const words2 = new Set(text2.split(/\s+/).filter(w => w.length > 3));
    
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  static emptyResult(reason) {
    return {
      score: 0,
      grade: 'F',
      maxScore: 100,
      bulletCount: 0,
      bullets: [],
      totalIssues: 1,
      issues: [reason],
      recommendations: ['Add at least 3 high-quality bullet points highlighting key product features'],
      details: {},
      summary: 'No bullet points found. This severely impacts listing quality and discoverability.'
    };
  }

  static getGrade(score) {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  }

  static getSummary(score, grade, count) {
    if (score >= 90) return `Excellent bullet points (${count} total) that comply with Amazon requirements and best practices.`;
    if (score >= 80) return `Strong bullet points with minor optimization opportunities.`;
    if (score >= 70) return `Good bullet points that could benefit from improved structure and content.`;
    if (score >= 60) return `Adequate bullet points but several areas need attention for better conversion.`;
    if (score >= 50) return `Bullet points need significant improvement to meet Amazon standards.`;
    return `Bullet points require immediate revision to comply with Amazon policies.`;
  }

  static quickCheck(bullets) {
    const analysis = this.analyze(bullets);
    return {
      score: analysis.score,
      grade: analysis.grade,
      bulletCount: analysis.bulletCount,
      criticalIssues: analysis.issues.filter(i =>
        i.includes('prohibited') ||
        i.includes('emoji') ||
        i.includes('placeholder') ||
        i.includes('guarantee') ||
        i.includes('external') ||
        i.includes('ASIN')
      ),
      totalIssues: analysis.totalIssues
    };
  }
}

module.exports = BulletPointsAnalyzer;
