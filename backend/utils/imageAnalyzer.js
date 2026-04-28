/**
 * Image Quality Analyzer
 * 
 * Checks product images against Amazon's official image requirements
 * including technical specs, main image rules, and best practices.
 */

class ImageAnalyzer {

  /**
   * Main entry point - analyze images and return full report
   * @param {object} params - Image analysis parameters
   * @param {number} params.imageCount - Total number of images
   * @param {string[]} params.imageUrls - Array of image URLs (optional)
   * @param {object} params.metadata - Additional metadata (category, product type, etc.)
   * @returns {object} Analysis report
   */
  static analyze({ imageCount = 0, imageUrls = [], metadata = {} } = {}) {
    
    if (imageCount === 0 && imageUrls.length === 0) {
      return this.emptyResult();
    }

    const totalImages = Math.max(imageCount, imageUrls.length);

    // Run all checks
    const checks = {
      imageCount: this.checkImageCount(totalImages),
      mainImagePresent: this.checkMainImagePresent(totalImages),
      technicalQuality: this.checkTechnicalQuality(imageUrls),
      whiteBackground: this.checkWhiteBackground(imageUrls, metadata),
      productCoverage: this.checkProductCoverage(imageUrls),
      textWatermarks: this.checkTextWatermarks(imageUrls),
      prohibitedContent: this.checkProhibitedContent(imageUrls),
      variantImages: this.checkVariantImages(totalImages, metadata),
      resolution: this.checkResolution(imageUrls),
      lifestyleImages: this.checkLifestyleImages(totalImages, metadata),
      packagingDisplay: this.checkPackagingDisplay(imageUrls, metadata),
    };

    // Calculate weighted score
    const weights = {
      imageCount: 20,           // Minimum 6 recommended, 1 required
      mainImagePresent: 15,     // Required for listing
      technicalQuality: 15,     // Blurry/pixellated = fail
      whiteBackground: 10,      // Pure white required for main
      productCoverage: 10,      // 85% of frame
      textWatermarks: 10,       // No text/logos on main
      prohibitedContent: 10,    // No nudity, offensive content
      variantImages: 5,         // Different angles, in-use
      resolution: 3,            // 1000px+ for zoom
      lifestyleImages: 1,       // Nice to have
      packagingDisplay: 1,      // Category-specific
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
        allIssues.push(...result.issues.map(i => `[Images] ${i}`));
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
      imageCount: totalImages,
      totalIssues: allIssues.length,
      issues: allIssues,
      recommendations: allRecommendations,
      details,
      summary: this.getSummary(totalScore, grade, totalImages)
    };
  }

  // ==========================================
  // 1. IMAGE COUNT (Minimum 1 required, 6+ recommended)
  // ==========================================
  static checkImageCount(count) {
    if (count === 0) {
      return {
        score: 0,
        count: 0,
        status: 'fail',
        issues: ['No product images found - listing may be suppressed'],
        recommendations: ['Add at least 1 main product image immediately (6+ recommended)']
      };
    }

    if (count === 1) {
      return {
        score: 20,
        count,
        status: 'fail',
        issues: ['Only 1 image found - at least 6 images recommended for best customer experience'],
        recommendations: ['Add 5+ more images showing different angles, features, and lifestyle shots']
      };
    }

    if (count >= 2 && count < 4) {
      return {
        score: 40,
        count,
        status: 'warning',
        issues: [`Only ${count} images - Amazon recommends at least 6 for optimal listing quality`],
        recommendations: [`Add ${6 - count}+ more images: alternate angles, lifestyle, features, size reference`]
      };
    }

    if (count >= 4 && count < 6) {
      return {
        score: 65,
        count,
        status: 'warning',
        issues: [`${count} images - approaching minimum recommendation of 6`],
        recommendations: [`Add ${6 - count} more image(s) to reach the recommended minimum`]
      };
    }

    if (count >= 6 && count < 7) {
      return {
        score: 85,
        count,
        status: 'pass',
        issues: [],
        recommendations: ['Good image count. Amazon recommends at least 7 images for a complete listing experience.']
      };
    }

    if (count >= 7) {
      return {
        score: 100,
        count,
        status: 'pass',
        issues: [],
        recommendations: count > 9 ? ['Amazon shows a maximum of 9 images. Ensure the first 7 are your strongest.'] : []
      };
    }

    return {
      score: 50,
      count,
      status: 'warning',
      issues: [`Only ${count} images - at least 7 are recommended for high-quality listings`],
      recommendations: [`Add ${7 - count}+ more images to reach the recommended count of 7`]
    };
  }

  // ==========================================
  // 2. MAIN IMAGE PRESENT CHECK
  // ==========================================
  static checkMainImagePresent(count) {
    if (count === 0) {
      return {
        score: 0,
        status: 'fail',
        issues: ['No main image found - this is required for listing visibility'],
        recommendations: ['Upload a MAIN product image immediately to prevent listing suppression']
      };
    }

    return {
      score: 100,
      status: 'pass',
      issues: [],
      recommendations: []
    };
  }

  // ==========================================
  // 3. TECHNICAL QUALITY CHECK
  // ==========================================
  static checkTechnicalQuality(imageUrls) {
    if (!imageUrls || imageUrls.length === 0) {
      return {
        score: 0,
        status: 'warning',
        issues: ['Cannot verify image quality - no image URLs provided'],
        recommendations: ['Ensure images meet technical requirements: JPEG preferred, 500-10000px, clear resolution']
      };
    }

    const issues = [];
    const recommendations = [];

    // Check file formats
    const supportedFormats = ['.jpg', '.jpeg', '.png', '.tif', '.tiff', '.gif'];
    const badFormats = [];

    imageUrls.forEach((url, index) => {
      const lowerUrl = url.toLowerCase();
      const isSupported = supportedFormats.some(f => lowerUrl.includes(f));
      
      if (!isSupported && !lowerUrl.includes('amazon.com/images')) {
        // Skip Amazon CDN URLs (they handle format internally)
        if (lowerUrl.match(/\.(webp|bmp|svg)/)) {
          badFormats.push({ index: index + 1, url: url.substring(0, 50) });
        }
      }
    });

    if (badFormats.length > 0) {
      issues.push(`${badFormats.length} image(s) may have unsupported file formats`);
      recommendations.push('Use JPEG (.jpg) format for all product images');
    }

    // Check for placeholder patterns in URLs
    const placeholderPatterns = [
      'placeholder', 'no-image', 'noimage', 'default', 'coming-soon',
      'image-not-found', 'empty', 'blank', 'n-a'
    ];

    const placeholderUrls = imageUrls.filter(url => {
      const lower = url.toLowerCase();
      return placeholderPatterns.some(p => lower.includes(p));
    });

    if (placeholderUrls.length > 0) {
      issues.push(`${placeholderUrls.length} image(s) appear to be placeholders`);
      recommendations.push('Replace placeholder images with actual product photos');
      return {
        score: Math.max(0, 100 - (placeholderUrls.length * 50)),
        status: 'fail',
        issues,
        badFormats,
        placeholderCount: placeholderUrls.length,
        recommendations
      };
    }

    return {
      score: badFormats.length > 0 ? 70 : 100,
      status: badFormats.length > 0 ? 'warning' : 'pass',
      issues,
      badFormats,
      placeholderCount: 0,
      recommendations
    };
  }

  // ==========================================
  // 4. WHITE BACKGROUND (Main image)
  // ==========================================
  static checkWhiteBackground(imageUrls, metadata) {
    // This is a heuristic check since we can't analyze actual image pixels
    // In production, you'd use image processing libraries
    
    if (!imageUrls || imageUrls.length === 0) {
      return {
        score: 50,
        status: 'warning',
        issues: ['Cannot verify main image background color'],
        recommendations: ['Ensure main image has pure white background (RGB 255,255,255)']
      };
    }

    // Check URL patterns that might indicate non-white backgrounds
    const backgroundKeywords = [
      'lifestyle', 'model', 'outdoor', 'room', 'kitchen', 'bathroom',
      'background', 'studio', 'scene', 'environment'
    ];

    const mainImageUrl = imageUrls[0];
    const lowerMain = mainImageUrl.toLowerCase();
    const hasNonWhiteIndicator = backgroundKeywords.some(k => lowerMain.includes(k));

    // Some categories allow lifestyle main images
    const lifestyleAllowedCategories = [
      'furniture', 'home decor', 'rug', 'carpet', 'curtain',
      'wall art', 'lighting', 'plant', 'garden'
    ];

    const category = (metadata.category || '').toLowerCase();
    const lifestyleAllowed = lifestyleAllowedCategories.some(c => category.includes(c));

    if (hasNonWhiteIndicator && !lifestyleAllowed) {
      return {
        score: 30,
        status: 'warning',
        issues: ['Main image may not have a pure white background'],
        recommendations: [
          'Use a pure white background (RGB 255,255,255) for the main product image',
          'Shoot product on white seamless background or use professional editing'
        ]
      };
    }

    return {
      score: 100,
      status: 'pass',
      issues: [],
      recommendations: []
    };
  }

  // ==========================================
  // 5. PRODUCT COVERAGE (85% of frame)
  // ==========================================
  static checkProductCoverage(imageUrls) {
    // Heuristic check - in production, use image analysis
    // For now, check if there are enough images to assume good coverage
    
    if (!imageUrls || imageUrls.length === 0) {
      return {
        score: 0,
        status: 'fail',
        issues: ['No images to evaluate product coverage'],
        recommendations: ['Product should fill 85% of the image frame']
      };
    }

    // Check for common issues in URL patterns
    const issues = [];
    
    // Images named with "zoom" or "detail" are usually good coverage
    const goodCoverage = imageUrls.filter(url => {
      const lower = url.toLowerCase();
      return lower.includes('zoom') || lower.includes('detail') || lower.includes('close');
    }).length;

    if (imageUrls.length >= 3 && goodCoverage === 0) {
      issues.push('No close-up or detail images found');
      return {
        score: 60,
        status: 'warning',
        issues,
        recommendations: ['Add close-up images where the product fills at least 85% of the frame']
      };
    }

    return {
      score: 100,
      status: 'pass',
      issues: [],
      recommendations: goodCoverage === 0 ? ['Consider adding detail/close-up images'] : []
    };
  }

  // ==========================================
  // 6. TEXT, LOGOS, WATERMARKS CHECK
  // ==========================================
  static checkTextWatermarks(imageUrls) {
    // Check for common watermark/logo indicators in URLs
    const watermarkIndicators = [
      'watermark', 'logo', 'brand-mark', 'copyright',
      'stamp', 'overlay', 'badge'
    ];

    if (!imageUrls || imageUrls.length === 0) {
      return { score: 100, status: 'pass', issues: [], recommendations: [] };
    }

    const flaggedUrls = imageUrls.filter(url => {
      const lower = url.toLowerCase();
      return watermarkIndicators.some(w => lower.includes(w));
    });

    if (flaggedUrls.length > 0) {
      return {
        score: Math.max(20, 100 - flaggedUrls.length * 30),
        status: 'fail',
        flaggedCount: flaggedUrls.length,
        issues: [`${flaggedUrls.length} image(s) may contain watermarks or logos`],
        recommendations: [
          'Remove all text, logos, watermarks, and graphics from product images',
          'Do not add borders, color blocks, or inset images to the main product photo'
        ]
      };
    }

    return {
      score: 100,
      status: 'pass',
      issues: [],
      recommendations: []
    };
  }

  // ==========================================
  // 7. PROHIBITED CONTENT CHECK
  // ==========================================
  static checkProhibitedContent(imageUrls) {
    const prohibitedPatterns = [
      'amazon', 'prime', 'alexa', 'best-seller', 'top-seller',
      'amazons-choice', 'premium-choice', 'free-shipping',
      'five-star', '5-star', 'review', 'customer-image',
      'nude', 'naked', 'explicit', 'adult-content'
    ];

    if (!imageUrls || imageUrls.length === 0) {
      return { score: 100, status: 'pass', issues: [], recommendations: [] };
    }

    const violations = [];
    imageUrls.forEach((url, index) => {
      const lower = url.toLowerCase();
      for (const pattern of prohibitedPatterns) {
        if (lower.includes(pattern)) {
          violations.push({ index: index + 1, pattern, url: url.substring(0, 60) });
          break;
        }
      }
    });

    if (violations.length > 0) {
      return {
        score: 0,
        status: 'fail',
        violations,
        issues: [`${violations.length} image(s) may contain prohibited content (Amazon logos, badges, etc.)`],
        recommendations: [
          'Remove all Amazon trademarks, badges, and logos from images',
          'Remove customer review screenshots and star ratings',
          'Do not use "Amazon\'s Choice", "Best Seller", or similar badges'
        ]
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
  // 8. VARIANT IMAGES (Different angles/types)
  // ==========================================
  static checkVariantImages(count, metadata) {
    if (count < 2) {
      return {
        score: 0,
        status: 'warning',
        issues: ['No alternate images - only main image present'],
        recommendations: [
          'Add alternate angle images (FRNT, BACK, SIDE, TOPP)',
          'Add lifestyle/in-use images showing the product in context',
          'Add detail images showing material, texture, size'
        ]
      };
    }

    const recommendedVariants = [
      'Front view', 'Back view', 'Side view', 'Top view',
      'Detail/close-up', 'Lifestyle/in-use', 'Size reference',
      'Packaging (if important feature)'
    ];

    if (count < recommendedVariants.length) {
      const missing = recommendedVariants.length - count;
      return {
        score: Math.round(60 + (count / recommendedVariants.length) * 40),
        status: 'warning',
        issues: ['Missing recommended image variants for complete product presentation'],
        recommendations: [`Add at least ${missing} more variant image(s) showing different angles and uses`]
      };
    }

    return {
      score: 100,
      status: 'pass',
      issues: [],
      recommendations: []
    };
  }

  // ==========================================
  // 9. RESOLUTION CHECK (1000px+ for zoom)
  // ==========================================
  static checkResolution(imageUrls) {
    // Check for resolution indicators in image URLs
    if (!imageUrls || imageUrls.length === 0) {
      return {
        score: 0,
        status: 'warning',
        issues: ['Cannot verify image resolution'],
        recommendations: ['Use images with at least 1000px on the longest side for zoom functionality']
      };
    }

    // Amazon CDN URLs often contain size indicators
    // e.g., "SX569" = 569px, "SX1000" = 1000px
    const lowResPatterns = [
      /_SX([1-9]\d{0,2})_/i,    // SX followed by 1-999
      /_SY([1-9]\d{0,2})_/i,    // SY followed by 1-999
      /_CR\d+,\d+,(\d+),\d+/i,  // Crop dimensions
    ];

    let lowResCount = 0;
    imageUrls.forEach(url => {
      for (const pattern of lowResPatterns) {
        const match = url.match(pattern);
        if (match && parseInt(match[1]) < 500) {
          lowResCount++;
          break;
        }
      }
    });

    if (lowResCount > 0) {
      return {
        score: Math.max(20, 100 - lowResCount * 30),
        status: 'warning',
        lowResCount,
        issues: [`${lowResCount} image(s) may be below recommended resolution (500px minimum)`],
        recommendations: [
          'Upload images at 1000px or larger for zoom functionality',
          'Minimum 500px on longest side required for upload'
        ]
      };
    }

    return {
      score: 100,
      status: 'pass',
      issues: [],
      recommendations: []
    };
  }

  // ==========================================
  // 10. LIFESTYLE / IN-USE IMAGES
  // ==========================================
  static checkLifestyleImages(count, metadata) {
    // Lifestyle images show the product being used in context
    if (count >= 6) {
      return {
        score: 100,
        status: 'pass',
        issues: [],
        recommendations: []
      };
    }

    if (count >= 3 && count < 6) {
      return {
        score: 60,
        status: 'pass',
        issues: [],
        recommendations: ['Consider adding 1-2 lifestyle images showing the product in use']
      };
    }

    return {
      score: 30,
      status: 'warning',
      issues: ['No lifestyle or in-use images to help customers visualize the product'],
      recommendations: ['Add images showing the product in a real environment or being used']
    };
  }

  // ==========================================
  // 11. PACKAGING DISPLAY CHECK
  // ==========================================
  static checkPackagingDisplay(imageUrls, metadata) {
    const multipackCategories = [
      'grocery', 'supplement', 'vitamin', 'snack', 'food',
      'beverage', 'cleaning', 'tissue', 'paper towel', 'toilet paper'
    ];

    const category = (metadata.category || '').toLowerCase();
    const isMultipackLikely = multipackCategories.some(c => category.includes(c));

    if (!isMultipackLikely) {
      return { score: 100, status: 'pass', issues: [], recommendations: [] };
    }

    // For multipacks, packaging should be shown
    if (imageUrls && imageUrls.length > 0) {
      const hasPackaging = imageUrls.some(url => {
        const lower = url.toLowerCase();
        return ['pack', 'box', 'bundle', 'multipack'].some(k => lower.includes(k));
      });

      if (!hasPackaging) {
        return {
          score: 50,
          status: 'warning',
          issues: ['No packaging image found for what appears to be a multipack product'],
          recommendations: ['Show the product in its packaging as the main image for multipacks']
        };
      }
    }

    return { score: 100, status: 'pass', issues: [], recommendations: [] };
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================
  static emptyResult() {
    return {
      score: 0,
      grade: 'F',
      maxScore: 100,
      imageCount: 0,
      totalIssues: 1,
      issues: ['No product images found - listing may be suppressed'],
      recommendations: [
        'Add at least 1 MAIN product image (required)',
        'Use pure white background for the main image',
        'Add 6+ images total including alternate angles and lifestyle shots',
        'Use JPEG format with 1000px+ resolution for zoom functionality'
      ],
      details: {},
      summary: 'No images found. This is critical - listings without a main image will be suppressed from search.'
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
    if (score >= 90) return `Excellent image quality with ${count} images meeting Amazon's professional standards.`;
    if (score >= 80) return `Strong image set with minor optimization opportunities.`;
    if (score >= 70) return `Good images that could benefit from more variety and higher quality.`;
    if (score >= 60) return `Adequate images but significant improvements needed for better conversion.`;
    if (score >= 50) return `Image set needs improvement to meet Amazon's basic requirements.`;
    return `Images require immediate attention - risk of listing suppression without compliant main image.`;
  }

  static quickCheck({ imageCount = 0 } = {}) {
    const analysis = this.analyze({ imageCount });
    return {
      score: analysis.score,
      grade: analysis.grade,
      imageCount,
      criticalIssues: analysis.issues.filter(i =>
        i.includes('No product images') ||
        i.includes('suppressed') ||
        i.includes('placeholder') ||
        i.includes('prohibited')
      ),
      totalIssues: analysis.totalIssues
    };
  }

  /**
   * Get recommended image types based on product category
   */
  static getRecommendedVariants(category = '') {
    const base = [
      { code: 'MAIN', label: 'Main Image (White Background)' },
      { code: 'PT01', label: 'Front View' },
      { code: 'PT02', label: 'Back View' },
      { code: 'PT03', label: 'Side View' },
    ];

    const categorySpecific = {
      clothing: [
        { code: 'PT04', label: 'On Model - Front' },
        { code: 'PT05', label: 'On Model - Back' },
        { code: 'PT06', label: 'Fabric Detail' },
        { code: 'PT07', label: 'Size Tag/Chart' },
      ],
      electronics: [
        { code: 'PT04', label: 'Ports & Connections' },
        { code: 'PT05', label: 'In-Use / Lifestyle' },
        { code: 'PT06', label: 'Size Comparison' },
        { code: 'PT07', label: 'Box Contents' },
      ],
      grocery: [
        { code: 'PT04', label: 'Packaging Front' },
        { code: 'PT05', label: 'Nutrition Facts' },
        { code: 'PT06', label: 'Ingredients List' },
        { code: 'PT07', label: 'Serving Suggestion' },
      ],
      home: [
        { code: 'PT04', label: 'Room Setting' },
        { code: 'PT05', label: 'Dimensions Detail' },
        { code: 'PT06', label: 'Texture Detail' },
        { code: 'PT07', label: 'Assembly/Setup' },
      ],
    };

    for (const [cat, variants] of Object.entries(categorySpecific)) {
      if (category.toLowerCase().includes(cat)) {
        return [...base, ...variants];
      }
    }

    // Default
    return [
      ...base,
      { code: 'PT04', label: 'Detail/Close-up' },
      { code: 'PT05', label: 'Lifestyle/In-Use' },
      { code: 'PT06', label: 'Size/Dimensions Reference' },
      { code: 'PT07', label: 'Packaging/Contents' },
    ];
  }
}

module.exports = ImageAnalyzer;
