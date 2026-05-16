-- Comprehensive migration to ensure all required columns exist in the Asins table
-- This script is idempotent and can be run multiple times safely.

-- Basic Metrics (Check if they exist, add if missing)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'Title')
    ALTER TABLE Asins ADD Title NVARCHAR(MAX);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'Category')
    ALTER TABLE Asins ADD Category NVARCHAR(255);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'CurrentPrice')
    ALTER TABLE Asins ADD CurrentPrice DECIMAL(18, 2);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'Mrp')
    ALTER TABLE Asins ADD Mrp DECIMAL(18, 2);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'DealBadge')
    ALTER TABLE Asins ADD DealBadge NVARCHAR(100);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'PriceType')
    ALTER TABLE Asins ADD PriceType NVARCHAR(50);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'BSR')
    ALTER TABLE Asins ADD BSR INT;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'BsrTrend')
    ALTER TABLE Asins ADD BsrTrend NVARCHAR(20);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'Rating')
    ALTER TABLE Asins ADD Rating DECIMAL(3, 2);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'RatingTrend')
    ALTER TABLE Asins ADD RatingTrend NVARCHAR(20);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'ReviewCount')
    ALTER TABLE Asins ADD ReviewCount INT;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'RatingBreakdown')
    ALTER TABLE Asins ADD RatingBreakdown NVARCHAR(MAX);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'LQS')
    ALTER TABLE Asins ADD LQS DECIMAL(5, 2);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'LQSGrade')
    ALTER TABLE Asins ADD LQSGrade NVARCHAR(10);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'LqsDetails')
    ALTER TABLE Asins ADD LqsDetails NVARCHAR(MAX);

-- Detailed Quality Components
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'TitleScore')
    ALTER TABLE Asins ADD TitleScore INT;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'TitleGrade')
    ALTER TABLE Asins ADD TitleGrade NVARCHAR(10);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'TitleIssues')
    ALTER TABLE Asins ADD TitleIssues NVARCHAR(MAX);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'TitleRecommendations')
    ALTER TABLE Asins ADD TitleRecommendations NVARCHAR(MAX);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'TitleDetails')
    ALTER TABLE Asins ADD TitleDetails NVARCHAR(MAX);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'BulletScore')
    ALTER TABLE Asins ADD BulletScore INT;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'BulletGrade')
    ALTER TABLE Asins ADD BulletGrade NVARCHAR(10);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'BulletIssues')
    ALTER TABLE Asins ADD BulletIssues NVARCHAR(MAX);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'BulletRecommendations')
    ALTER TABLE Asins ADD BulletRecommendations NVARCHAR(MAX);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'BulletDetails')
    ALTER TABLE Asins ADD BulletDetails NVARCHAR(MAX);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'ImageScore')
    ALTER TABLE Asins ADD ImageScore INT;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'ImageGrade')
    ALTER TABLE Asins ADD ImageGrade NVARCHAR(10);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'ImageIssues')
    ALTER TABLE Asins ADD ImageIssues NVARCHAR(MAX);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'ImageRecommendations')
    ALTER TABLE Asins ADD ImageRecommendations NVARCHAR(MAX);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'ImageDetails')
    ALTER TABLE Asins ADD ImageDetails NVARCHAR(MAX);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'DescriptionScore')
    ALTER TABLE Asins ADD DescriptionScore INT;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'DescriptionGrade')
    ALTER TABLE Asins ADD DescriptionGrade NVARCHAR(10);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'DescriptionIssues')
    ALTER TABLE Asins ADD DescriptionIssues NVARCHAR(MAX);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'DescriptionRecommendations')
    ALTER TABLE Asins ADD DescriptionRecommendations NVARCHAR(MAX);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'DescriptionDetails')
    ALTER TABLE Asins ADD DescriptionDetails NVARCHAR(MAX);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'ProductDescription')
    ALTER TABLE Asins ADD ProductDescription NVARCHAR(MAX);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'BuyBoxStatus')
    ALTER TABLE Asins ADD BuyBoxStatus BIT;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'ImageUrl')
    ALTER TABLE Asins ADD ImageUrl NVARCHAR(MAX);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'SubBsr')
    ALTER TABLE Asins ADD SubBsr INT;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'SubBSRs')
    ALTER TABLE Asins ADD SubBSRs NVARCHAR(MAX);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'SubBsrCategories')
    ALTER TABLE Asins ADD SubBsrCategories NVARCHAR(MAX);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'Images')
    ALTER TABLE Asins ADD Images NVARCHAR(MAX);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'ImagesCount')
    ALTER TABLE Asins ADD ImagesCount INT;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'VideoCount')
    ALTER TABLE Asins ADD VideoCount INT;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'BulletPoints')
    ALTER TABLE Asins ADD BulletPoints INT;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'BulletPointsText')
    ALTER TABLE Asins ADD BulletPointsText NVARCHAR(MAX);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'StockLevel')
    ALTER TABLE Asins ADD StockLevel INT;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'SoldBy')
    ALTER TABLE Asins ADD SoldBy NVARCHAR(255);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'BuyBoxWin')
    ALTER TABLE Asins ADD BuyBoxWin BIT;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'BuyBoxSellerId')
    ALTER TABLE Asins ADD BuyBoxSellerId NVARCHAR(255);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'SecondAsp')
    ALTER TABLE Asins ADD SecondAsp DECIMAL(18, 2);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'SoldBySec')
    ALTER TABLE Asins ADD SoldBySec NVARCHAR(255);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'AspDifference')
    ALTER TABLE Asins ADD AspDifference DECIMAL(18, 2);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'DiscountPercentage')
    ALTER TABLE Asins ADD DiscountPercentage DECIMAL(18, 2);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'HasAplus')
    ALTER TABLE Asins ADD HasAplus BIT;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'AvailabilityStatus')
    ALTER TABLE Asins ADD AvailabilityStatus NVARCHAR(100);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'AplusAbsentSince')
    ALTER TABLE Asins ADD AplusAbsentSince DATETIME;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'AplusPresentSince')
    ALTER TABLE Asins ADD AplusPresentSince DATETIME;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'AllOffers')
    ALTER TABLE Asins ADD AllOffers NVARCHAR(MAX);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'Brand')
    ALTER TABLE Asins ADD Brand NVARCHAR(255);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'ParentAsin')
    ALTER TABLE Asins ADD ParentAsin NVARCHAR(50);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'ScrapeStatus')
    ALTER TABLE Asins ADD ScrapeStatus NVARCHAR(50);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'Status')
    ALTER TABLE Asins ADD Status NVARCHAR(50);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'History')
    ALTER TABLE Asins ADD History NVARCHAR(MAX);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'LastScrapedAt')
    ALTER TABLE Asins ADD LastScrapedAt DATETIME;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'PriceDispute')
    ALTER TABLE Asins ADD PriceDispute BIT;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'Tags')
    ALTER TABLE Asins ADD Tags NVARCHAR(MAX);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'UpdatedAt')
    ALTER TABLE Asins ADD UpdatedAt DATETIME;
