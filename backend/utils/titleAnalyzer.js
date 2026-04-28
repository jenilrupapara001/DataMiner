/**
 * Title Quality Analyzer
 * 
 * Checks Amazon product titles against Amazon's official requirements
 * and best practices, returning a detailed score and issue list.
 */

class TitleAnalyzer {
  
  /**
   * Main entry point - analyze a title and return full report
   * @param {string} title - The product title to analyze
   * @returns {object} Analysis report
   */
  static analyze(title) {
    if (!title || typeof title !== 'string') {
      return {
        score: 0,
        grade: 'F',
        maxScore: 100,
        issues: ['Missing title'],
        details: {},
        recommendations: ['Add a product title to this listing']
      };
    }

    const cleanTitle = title.trim();
    
    // Run all checks
    const checks = {
      characterLimit: this.checkCharacterLimit(cleanTitle),
      promotionalContent: this.checkPromotionalContent(cleanTitle),
      specialCharacters: this.checkSpecialCharacters(cleanTitle),
      minimumContent: this.checkMinimumContent(cleanTitle),
      wordRepetition: this.checkWordRepetition(cleanTitle),
      idealLength: this.checkIdealLength(cleanTitle),
      capitalization: this.checkCapitalization(cleanTitle),
      subjectiveContent: this.checkSubjectiveContent(cleanTitle),
      numeralsUsage: this.checkNumeralsUsage(cleanTitle),
      informationOrder: this.checkInformationOrder(cleanTitle),
      brandPresence: this.checkBrandPresence(cleanTitle),
    };

    // Calculate weighted score
    const weights = {
      characterLimit: 15,        // Hard requirement - 15 points
      promotionalContent: 10,    // Hard requirement - 10 points
      specialCharacters: 10,     // Hard requirement - 10 points
      minimumContent: 10,        // Hard requirement - 10 points
      wordRepetition: 5,         // Hard requirement - 5 points
      idealLength: 20,           // Best practice - 20 points
      capitalization: 10,        // Best practice - 10 points
      subjectiveContent: 5,      // Best practice - 5 points
      numeralsUsage: 5,          // Best practice - 5 points
      informationOrder: 5,       // Best practice - 5 points
      brandPresence: 5,          // Best practice - 5 points
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
        allIssues.push(...result.issues.map(i => `[Title] ${i}`));
      }
      if (result.recommendations) {
        allRecommendations.push(...result.recommendations);
      }
    }

    // Calculate final grade
    const grade = this.getGrade(totalScore);

    return {
      score: totalScore,
      grade,
      maxScore: 100,
      totalIssues: allIssues.length,
      issues: allIssues,
      recommendations: allRecommendations,
      details,
      summary: this.getSummary(totalScore, grade)
    };
  }

  // ==============================
  // 1. CHARACTER LIMIT (Max 200)
  // ==============================
  static checkCharacterLimit(title) {
    const charCount = title.length;
    
    if (charCount === 0) {
      return {
        score: 0,
        charCount,
        status: 'fail',
        issues: ['Title is empty'],
        recommendations: ['Add a title to this product']
      };
    }

    if (charCount > 200) {
      const excess = charCount - 200;
      return {
        score: 0,
        charCount,
        status: 'fail',
        issues: [`Title exceeds 200 character limit by ${excess} characters (${charCount}/200)`],
        recommendations: [`Remove ${excess} characters to comply with Amazon's 200 character limit`]
      };
    }

    if (charCount > 190) {
      return {
        score: 70,
        charCount,
        status: 'warning',
        issues: ['Title is approaching the 200 character limit'],
        recommendations: ['Consider shortening the title slightly to stay safely under 200 characters']
      };
    }

    return {
      score: 100,
      charCount,
      status: 'pass',
      issues: [],
      recommendations: []
    };
  }

  // ==============================
  // 2. PROMOTIONAL CONTENT CHECK
  // ==============================
  static checkPromotionalContent(title) {
    const promotionalPhrases = [
      'free shipping', 'free delivery', '100% quality', 'money back',
      'guaranteed', 'satisfaction guaranteed', 'best seller', 'hot item',
      'limited time', 'sale', 'discount', 'cheap', 'bargain',
      'lowest price', 'best price', 'affordable', 'buy now',
      'click here', 'shop now', 'order now', 'don\'t miss',
      'exclusive', 'premium quality', 'top rated', '#1',
      'best', 'amazing', 'excellent', 'wonderful', 'fantastic',
      'must have', 'perfect', 'outstanding', 'incredible',
      'new arrival', 'award winning', 'certified', 'authentic',
      'high quality', 'super', 'mega', 'ultra', 'extra', 'bonus'
    ];

    const titleLower = title.toLowerCase();
    const foundPhrases = [];

    for (const phrase of promotionalPhrases) {
      if (titleLower.includes(phrase)) {
        foundPhrases.push(phrase);
      }
    }

    if (foundPhrases.length > 0) {
      return {
        score: 0,
        status: 'fail',
        foundPhrases,
        issues: [`Title contains promotional content: "${foundPhrases.join('", "')}"`],
        recommendations: ['Remove all promotional phrases from the title']
      };
    }

    return {
      score: 100,
      status: 'pass',
      foundPhrases: [],
      issues: [],
      recommendations: []
    };
  }

  // ==============================
  // 3. SPECIAL CHARACTERS CHECK
  // ==============================
  static checkSpecialCharacters(title) {
    // Prohibited characters: !, $, ?, _, {, }, ^, ¬, ¦
    const prohibitedChars = ['!', '$', '?', '_', '{', '}', '^', '¬', '¦'];
    const foundChars = [];
    
    for (const char of prohibitedChars) {
      if (title.includes(char)) {
        foundChars.push(char);
      }
    }

    // Check for excessive decorative symbols
    const decorativePatterns = [
      /★+/g,      // Star symbols
      /◆+/g,      // Diamond
      /●+/g,      // Circle
      /■+/g,      // Square
      /▲+/g,      // Triangle
      /▼+/g,      // Inverted triangle
      /《/g,       // Angle brackets
      /》/g,
      /【/g,       // Black brackets
      /】/g,
      /〖/g,       // White brackets
      /〗/g,
    ];

    let decorativeCount = 0;
    for (const pattern of decorativePatterns) {
      const matches = title.match(pattern);
      if (matches) decorativeCount += matches.length;
    }

    // Allow ~, #, <, >, * only in specific contexts (measurements, identifiers)
    const allowedInContext = ['~', '#', '<', '>', '*'];
    const contextViolations = [];
    
    for (const char of allowedInContext) {
      if (title.includes(char)) {
        // Check if it's used in a valid context (measurement, identifier)
        const validContexts = [
          new RegExp(`\\d+\\s*${this.escapeRegex(char)}\\s*\\d+`),  // e.g., "10 < 20"
          new RegExp(`Style\\s*${this.escapeRegex(char)}\\s*\\d+`),   // e.g., "Style #4301"
          new RegExp(`#\\d+`),                                         // e.g., "#4301"
        ];
        
        let isValid = false;
        for (const context of validContexts) {
          if (context.test(title)) {
            isValid = true;
            break;
          }
        }
        
        if (!isValid) {
          // Remove all occurrences to check final count
          const occurrences = (title.match(new RegExp(this.escapeRegex(char), 'g')) || []).length;
          contextViolations.push({ char, occurrences });
        }
      }
    }

    const totalViolations = foundChars.length + (decorativeCount > 2 ? 1 : 0) + contextViolations.length;

    if (totalViolations > 3) {
      return {
        score: 0,
        status: 'fail',
        prohibitedFound: foundChars,
        decorativeCount,
        contextViolations,
        issues: [
          foundChars.length > 0 ? `Title contains prohibited characters: ${foundChars.join(' ')}` : null,
          decorativeCount > 2 ? `Excessive decorative symbols detected (${decorativeCount})` : null,
          contextViolations.length > 0 ? `Special characters used in invalid context: ${contextViolations.map(c => c.char).join(' ')}` : null,
        ].filter(Boolean),
        recommendations: ['Remove prohibited and decorative characters from the title']
      };
    }

    if (totalViolations > 0) {
      return {
        score: 50,
        status: 'warning',
        prohibitedFound: foundChars,
        decorativeCount,
        contextViolations,
        issues: [
          foundChars.length > 0 ? `Contains restricted characters: ${foundChars.join(' ')}` : null,
        ].filter(Boolean),
        recommendations: ['Review special character usage in the title']
      };
    }

    return {
      score: 100,
      status: 'pass',
      prohibitedFound: [],
      decorativeCount: 0,
      contextViolations: [],
      issues: [],
      recommendations: []
    };
  }

  // ==============================
  // 4. MINIMUM CONTENT CHECK
  // ==============================
  static checkMinimumContent(title) {
    const wordCount = title.split(/\s+/).filter(w => w.length > 0).length;
    const hasProductType = /shirt|dress|shoe|boot|headphone|camera|phone|laptop|tablet|watch|bag|toy|book|kit|tool|cream|oil|powder|spray|supplement|vitamin|snack|food|drink|coffee|tea|juice|water|cable|charger|adapter|case|cover|stand|mount|light|lamp|fan|cooler|heater|purifier|filter|vacuum|mop|broom|brush|comb|scissor|knife|spoon|plate|bowl|cup|glass|bottle|container|box|organizer|rack|shelf|hook|hanger|mat|rug|carpet|curtain|pillow|sheet|blanket|towel|soap|shampoo|conditioner|lotion|perfume|deodorant|makeup|nail|hair|beard|razor|trimmer|dryer|iron|steamer|scale|thermometer|monitor|speaker|microphone|keyboard|mouse|printer|scanner|projector|router|modem|switch|hub|dock|drive|memory|card|stick|disk|cable}/i;
    
    if (wordCount < 3) {
      return {
        score: 0,
        status: 'fail',
        wordCount,
        issues: [`Title has insufficient information (${wordCount} words)`],
        recommendations: ['Add more descriptive words to the title (brand, product type, key features)']
      };
    }

    if (!hasProductType.test(title) && wordCount < 5) {
      return {
        score: 30,
        status: 'warning',
        wordCount,
        issues: ['Title may be missing a clear product type identifier'],
        recommendations: ['Include the product type in the title (e.g., "Headphones", "Dress", "Coffee Maker")']
      };
    }

    if (wordCount >= 5) {
      return {
        score: 100,
        status: 'pass',
        wordCount,
        issues: [],
        recommendations: []
      };
    }

    return {
      score: 60,
      status: 'warning',
      wordCount,
      issues: ['Title could be more descriptive'],
      recommendations: ['Expand the title to at least 5 words for better searchability']
    };
  }

  // ==============================
  // 5. WORD REPETITION CHECK
  // ==============================
  static checkWordRepetition(title) {
    const words = title.toLowerCase().split(/\s+/).filter(w => w.length > 1);
    const wordCount = {};
    
    // Articles, prepositions, conjunctions that can repeat
    const allowedRepeats = ['the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'and', 'or', 'but', 'nor', 'so', 'yet'];
    
    for (const word of words) {
      // Remove punctuation for counting
      const cleanWord = word.replace(/[,.\-;:()]/g, '');
      if (allowedRepeats.includes(cleanWord)) continue;
      
      wordCount[cleanWord] = (wordCount[cleanWord] || 0) + 1;
    }

    const repeatedWords = Object.entries(wordCount)
      .filter(([word, count]) => count > 2)
      .map(([word, count]) => ({ word, count }));

    if (repeatedWords.length > 0) {
      return {
        score: 0,
        status: 'fail',
        repeatedWords,
        issues: [`Words repeated more than twice: ${repeatedWords.map(r => `"${r.word}" (${r.count}x)`).join(', ')}`],
        recommendations: ['Remove excessive word repetition to improve readability']
      };
    }

    const borderlineWords = Object.entries(wordCount)
      .filter(([word, count]) => count === 2 && !allowedRepeats.includes(word))
      .map(([word]) => word);

    if (borderlineWords.length > 3) {
      return {
        score: 50,
        status: 'warning',
        borderlineWords,
        issues: ['Multiple words used exactly twice, approaching repetition limits'],
        recommendations: ['Vary vocabulary to avoid repetitive wording']
      };
    }

    return {
      score: 100,
      status: 'pass',
      repeatedWords: [],
      issues: [],
      recommendations: []
    };
  }

  // ==============================
  // 6. IDEAL LENGTH (80 characters)
  // ==============================
  static checkIdealLength(title) {
    const charCount = title.length;
    
    if (charCount === 0) {
      return {
        score: 0,
        charCount: 0,
        status: 'fail',
        issues: [],
        recommendations: []
      };
    }

    // 60-80 characters is ideal
    if (charCount >= 60 && charCount <= 80) {
      return {
        score: 100,
        charCount,
        status: 'pass',
        issues: [],
        recommendations: []
      };
    }

    // 40-60 or 80-100 is good
    if ((charCount >= 40 && charCount < 60) || (charCount > 80 && charCount <= 100)) {
      return {
        score: 80,
        charCount,
        status: 'pass',
        issues: [],
        recommendations: charCount < 60 
          ? ['Consider adding more product details to reach the ideal 60-80 character range']
          : ['Consider shortening the title to the ideal 60-80 character range']
      };
    }

    // 25-40 or 100-150 is okay
    if ((charCount >= 25 && charCount < 40) || (charCount > 100 && charCount <= 150)) {
      return {
        score: 50,
        status: 'warning',
        issues: [
          charCount < 40 
            ? `Title is too short (${charCount} chars) - mobile users may not see enough info`
            : `Title is quite long (${charCount} chars) - may be truncated on mobile`
        ],
        recommendations: [
          charCount < 40 
            ? 'Add more descriptive information to help customers find this product'
            : 'Consider shortening the title to improve mobile readability'
        ]
      };
    }

    // Very short (< 25) or very long (> 150)
    if (charCount < 25) {
      return {
        score: 20,
        charCount,
        status: 'fail',
        issues: [`Title is too short (${charCount} chars) - lacks sufficient product information`],
        recommendations: ['Significantly expand the title to include brand, product type, and key features']
      };
    }

    if (charCount > 150) {
      return {
        score: 30,
        charCount,
        status: 'warning',
        issues: [`Title is very long (${charCount} chars) - will be truncated on most devices`],
        recommendations: ['Shorten the title to highlight the most important information first']
      };
    }

    return {
      score: 50,
      charCount,
      status: 'warning',
      issues: [],
      recommendations: ['Adjust title length for optimal visibility']
    };
  }

  // ==============================
  // 7. CAPITALIZATION CHECK
  // ==============================
  static checkCapitalization(title) {
    if (title.length === 0) return { score: 0, status: 'fail' };

    // Check for ALL CAPS
    const allCapsRatio = (title.match(/[A-Z]/g) || []).length / title.length;
    const lowerRatio = (title.match(/[a-z]/g) || []).length / title.length;
    
    if (allCapsRatio > 0.9) {
      return {
        score: 0,
        status: 'fail',
        capitalizationType: 'all_caps',
        issues: ['Title is in ALL CAPS - this violates Amazon guidelines'],
        recommendations: ['Use title case: capitalize the first letter of each word']
      };
    }

    if (lowerRatio > 0.95) {
      return {
        score: 40,
        status: 'warning',
        capitalizationType: 'all_lowercase',
        issues: ['Title is mostly lowercase - should use title case'],
        recommendations: ['Capitalize the first letter of each major word in the title']
      };
    }

    // Check if words follow title case pattern
    const words = title.split(/\s+/);
    const smallWords = ['a', 'an', 'the', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'and', 'or', 'but', 'nor'];
    let incorrectCap = 0;
    let totalCheckable = 0;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      if (word.length === 0) continue;
      
      // First and last words should always be capitalized
      if (i === 0 || i === words.length - 1) {
        if (word[0] !== word[0].toUpperCase()) incorrectCap++;
        totalCheckable++;
        continue;
      }

      // Small words in middle can be lowercase
      if (smallWords.includes(word.toLowerCase())) continue;

      // Regular words should have first letter capitalized
      if (word[0] !== word[0].toUpperCase() && word[0].match(/[a-z]/)) {
        incorrectCap++;
      }
      totalCheckable++;
    }

    const correctRatio = totalCheckable > 0 ? 1 - (incorrectCap / totalCheckable) : 1;

    if (correctRatio < 0.5) {
      return {
        score: 30,
        status: 'warning',
        capitalizationType: 'inconsistent',
        correctRatio,
        issues: ['Title capitalization is inconsistent'],
        recommendations: ['Use consistent title case: capitalize the first letter of each major word']
      };
    }

    if (correctRatio < 0.9) {
      return {
        score: 70,
        status: 'pass',
        capitalizationType: 'mostly_correct',
        correctRatio,
        issues: [],
        recommendations: ['Minor capitalization improvements could make the title more professional']
      };
    }

    return {
      score: 100,
      status: 'pass',
      capitalizationType: 'title_case',
      correctRatio,
      issues: [],
      recommendations: []
    };
  }

  // ==============================
  // 8. SUBJECTIVE CONTENT CHECK
  // ==============================
  static checkSubjectiveContent(title) {
    const subjectivePhrases = [
      'hot item', 'best seller', 'best selling', 'top rated', 'top selling',
      'amazing', 'excellent', 'wonderful', 'fantastic', 'incredible',
      'outstanding', 'superb', 'perfect', 'must have', 'must-have',
      'great', 'awesome', 'brilliant', 'exceptional', 'remarkable',
      'stunning', 'magnificent', 'premium', 'luxury', 'ultimate',
      '!!!', '!!', 'best!', 'great!'
    ];

    const titleLower = title.toLowerCase();
    const foundPhrases = [];

    for (const phrase of subjectivePhrases) {
      if (titleLower.includes(phrase)) {
        foundPhrases.push(phrase);
      }
    }

    // Also check for excessive exclamation marks
    const exclamationCount = (title.match(/!/g) || []).length;
    if (exclamationCount >= 1) {
      foundPhrases.push(`${exclamationCount} exclamation mark(s)`);
    }

    if (foundPhrases.length > 0) {
      return {
        score: 0,
        status: 'fail',
        foundPhrases,
        issues: [`Title contains subjective/promotional language: "${foundPhrases.join('", "')}"`],
        recommendations: ['Remove all subjective commentary from the title - stick to factual product descriptions']
      };
    }

    return {
      score: 100,
      status: 'pass',
      foundPhrases: [],
      issues: [],
      recommendations: []
    };
  }

  // ==============================
  // 9. NUMERALS USAGE CHECK
  // ==============================
  static checkNumeralsUsage(title) {
    const writtenNumbers = [
      'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
      'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
      'eighteen', 'nineteen', 'twenty', 'thirty', 'forty', 'fifty', 'sixty',
      'seventy', 'eighty', 'ninety', 'hundred', 'thousand'
    ];

    const titleLower = title.toLowerCase();
    const foundWritten = [];

    for (const num of writtenNumbers) {
      const regex = new RegExp(`\\b${num}\\b`, 'i');
      if (regex.test(titleLower)) {
        foundWritten.push(num);
      }
    }

    if (foundWritten.length > 0) {
      return {
        score: 40,
        status: 'warning',
        foundWritten,
        issues: [`Spelled-out numbers found: ${foundWritten.join(', ')} - should use numerals`],
        recommendations: ['Replace spelled-out numbers with numerals: "2" instead of "two"']
      };
    }

    // Check if the title has numerals (good thing)
    const hasNumerals = /\d+/.test(title);
    
    return {
      score: 100,
      status: 'pass',
      hasNumerals,
      issues: [],
      recommendations: hasNumerals ? [] : ['Consider including numeric measurements or pack counts if applicable']
    };
  }

  // ==============================
  // 10. INFORMATION ORDER CHECK
  // ==============================
  static checkInformationOrder(title) {
    // Ideal order: Brand → Product Type → Key Feature → Color → Size → Model
    const orderScore = { brand: 0, productType: 0, feature: 0, color: 0, size: 0, model: 0 };
    
    const words = title.split(/\s+/);
    const titleLower = title.toLowerCase();

    // Check if title starts with something that looks like a brand
    const brandIndicators = ['by', '®', '™'];
    
    // Common product type indicators
    const productTypePatterns = [
      'shirt', 'dress', 'shoe', 'boot', 'headphone', 'camera', 'phone',
      'laptop', 'tablet', 'watch', 'bag', 'toy', 'book', 'kit', 'tool',
      'case', 'cover', 'charger', 'cable', 'adapter', 'speaker', 'stand'
    ];

    // Common color words
    const colorWords = ['black', 'white', 'red', 'blue', 'green', 'yellow', 'purple', 'pink', 'grey', 'gray', 'brown', 'navy', 'beige', 'orange'];

    // Common size patterns
    const sizePattern = /\b(xs|s|m|l|xl|xxl|xxxl|small|medium|large|x-large)\b|\b\d+\s*(cm|mm|in|inch|inches|oz|kg|g|lb|lbs|ml|l)\b/i;

    // Check model number pattern
    const modelPattern = /\b[A-Z]{1,5}[- ]?\d{2,5}[A-Z]?\b/;

    const foundElements = {
      brand: title.length > 0,  // Assume first word(s) could be brand
      productType: productTypePatterns.some(p => titleLower.includes(p)),
      color: colorWords.some(c => titleLower.includes(c)),
      size: sizePattern.test(title),
      model: modelPattern.test(title),
    };

    const elementCount = Object.values(foundElements).filter(Boolean).length;

    if (elementCount >= 4) {
      return { score: 100, status: 'pass', foundElements, issues: [], recommendations: [] };
    }
    if (elementCount >= 2) {
      return {
        score: 60,
        status: 'warning',
        foundElements,
        issues: ['Title could benefit from better information structure'],
        recommendations: ['Include more structured information: Brand, Product Type, Key Feature, Color, Size']
      };
    }

    return {
      score: 30,
      status: 'warning',
      foundElements,
      issues: ['Title lacks structured information order'],
      recommendations: ['Structure your title as: Brand + Product Type + Key Feature + Color + Size/Count']
    };
  }

  // ==============================
  // 11. BRAND PRESENCE CHECK
  // ==============================
  static checkBrandPresence(title) {
    // Check if title starts with what looks like a brand name (1-3 words at start)
    const brandWords = title.split(/\s+/).slice(0, 2).join(' ');
    
    // If title is very short or has no clear brand
    if (title.length < 5) {
      return {
        score: 0,
        status: 'fail',
        issues: ['Title is too short to include a brand name'],
        recommendations: ['Include the brand name at the beginning of the title']
      };
    }

    // Check for common brand patterns
    const brandPatterns = [
      /^[A-Z][a-z]+(\s[A-Z][a-z]+)?\s/,  // Standard brand format
      /^[A-Z][a-z]+[']?[a-z]+\s/,        // Brand with apostrophe
      /^[A-Z]{2,}\s/,                     // Acronym brand
    ];

    const hasBrandAtStart = brandPatterns.some(p => p.test(title));

    if (!hasBrandAtStart) {
      return {
        score: 30,
        status: 'warning',
        issues: ['Brand name not clearly identified at the start of the title'],
        recommendations: ['Always start the title with the brand name']
      };
    }

    // Check if brand appears more than twice
    const potentialBrand = brandWords.toLowerCase();
    const brandOccurrences = (title.toLowerCase().match(new RegExp(this.escapeRegex(potentialBrand), 'g')) || []).length;

    if (brandOccurrences > 2) {
      return {
        score: 50,
        status: 'warning',
        issues: ['Brand name appears more than twice in the title'],
        recommendations: ['Reduce brand name repetition - only include at the beginning']
      };
    }

    return {
      score: 100,
      status: 'pass',
      issues: [],
      recommendations: []
    };
  }

  // ==============================
  // UTILITY METHODS
  // ==============================
  static escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  static getGrade(score) {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  }

  static getSummary(score, grade) {
    if (score >= 90) return 'Outstanding title that fully complies with Amazon requirements and best practices.';
    if (score >= 80) return 'Excellent title with minor optimization opportunities.';
    if (score >= 70) return 'Good title that could benefit from a few improvements.';
    if (score >= 60) return 'Adequate title but several areas need attention for better visibility.';
    if (score >= 50) return 'Title needs significant improvement to meet Amazon standards.';
    return 'Title requires immediate revision to comply with Amazon policies.';
  }

  /**
   * Quick check - returns only critical issues
   */
  static quickCheck(title) {
    const analysis = this.analyze(title);
    return {
      score: analysis.score,
      grade: analysis.grade,
      criticalIssues: analysis.issues.filter(i => 
        i.includes('character limit') ||
        i.includes('prohibited') ||
        i.includes('promotional') ||
        i.includes('empty') ||
        i.includes('safety')
      ),
      totalIssues: analysis.totalIssues
    };
  }
}

module.exports = TitleAnalyzer;
