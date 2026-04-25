/* ================================================
   ASIN DATA MAPPING SPECIFICATION
   ================================================

   SOURCE (Octoparse Raw Format):
   ------------------------------------------------
   Field Name (exact from data)      => Target SQL Column
   
   Original_URL                       => Used to extract ASIN code
   Title                              => Title (nvarchar max)
   category (HTML breadcrumb)         => Category (nvarchar 255)
   BSR                                => BSR (int) - extract rank number from "#6 in Sarees"
   sub_BSR                            => SubBsr (nvarchar 255)
   avg_rating                         => Rating (decimal 3,2)
   review_count                       => ReviewCount (int) - extract from "(89)"
   mrp                               => CurrentPrice (decimal 18,2) - parse "₹1,599"
   asp                                => SecondAsp (decimal 18,2) - for comparison
   unavilable                        => BuyBoxStatus (bit) & AvailabilityStatus
   sold_by                            => SoldBy (nvarchar 255)
   A_plus (HTML)                      => HasAplus (bit), AplusPresentSince
   bp_all (HTML)                      => BulletPoints (JSON array), BulletPointsText
   image_count (HTML)                 => Images (HTML), ImagesCount (int)
   video_count                        => VideoCount (int)
   second_buybox                      => BuyBoxWin (bit), BuyBoxSellerId (extract from URL)
   deal_badge                        => Not used (can store in AllOffers)
   
   Additional computed fields:
   - LQS: Calculated using lqs utils
   - LqsDetails: JSON with components
   - CdqComponents: Will be null initially
   - FeePreview: Will be null initially
   - AspDifference: CurrentPrice - SecondAsp
   - StockLevel: 0 (not in source)
   - Weight: 0 (not in source)
   - LossPerReturn: 0 (not in source)
   - StapleLevel: 'Regular' (default)
   - Sku: '' (empty)
   - AllOffers: null
   - Status: 'Active' (default)
   - ScrapeStatus: 'SCRAPED' (default)

   ================================================ */