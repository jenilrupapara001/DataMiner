const rawText = `Page_URL	:	https://www.ajio.com/p/701983589003
title	:	Women Embroidered Straight Kurta Suit Set | 3XL
ASP	:	MRP₹2,198
MRP	:	MRP₹2,198
off_percent	:	
Button_text	:	  OUT OF STOCK!
img_count	:	<div class="slick-arrow slick-prev slick-disabled" aria-label="scroll up" tabindex="0" style="display: none; text-align: center;"></div><div class="slick-list" style="height: 395px;"><div class="slick-track" style="opacity: 1; transform: translate3d(0px, 0px, 0px); height: 1185px;"><div data-index="0" class="slick-slide slick-active slick-current" tabindex="-1" aria-hidden="false" style="outline: none; width: 202px;"><div><div id="carousel-tab-1" type="button" role="tab" aria-label="Slide 1" aria-selected="true" aria-controls="carousel-item-1" tabindex="-1" style="width: 100%; display: inline-block;"><div class="img-container"><img class="img-highlight img-alignment" src="https://assets-jiocdn.ajio.com/medias/sys_master/root1/20250718/xbkR/687a4fdf6034bf77f0d6fde7/-78Wx98H-701983589-peach-MODEL.jpg"></div></div></div></div></div></div>
category_node	:	Home/
Women/
Ethnic Wear/
Kurta Suit Sets/
Women Embroidered Straight Kurta Suit Set
brand_name	:	BHARVITA
Rating	:	2.5  
Review_count	:	2 Ratings`;

function parseRawData(rawText) {
    const lines = rawText.split('\n').filter(line => line.trim() !== '');
    const data = {};
    let currentKey = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const kvMatch = line.match(/^([^:\t]+)\t:\t?(.+)$/);
        if (kvMatch) {
            currentKey = kvMatch[1].trim();
            let value = kvMatch[2] ? kvMatch[2].trim() : '';
            
            while (i + 1 < lines.length && !lines[i + 1].includes('\t:')) {
                i++;
                value += '\n' + lines[i].trim();
            }
            
            data[currentKey] = value;
        }
    }

    return data;
}

function extractAsin(url) {
    if (!url) return null;
    const match = url.match(/\/dp\/([A-Z0-9]{10})/i);
    if (match) return match[1];
    const ajioMatch = url.match(/\/p\/([A-Za-z0-9_]+)/i);
    if (ajioMatch) return ajioMatch[1];
    return null;
}

function parsePrice(priceStr) {
    if (!priceStr) return 0;
    const cleaned = priceStr.toString().replace(/[^\d.]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
}

function parseRating(ratingStr) {
    const val = parseFloat(ratingStr);
    return isNaN(val) ? 0 : Math.min(Math.max(val, 0), 5);
}

function parseReviewCount(str) {
    if (!str) return 0;
    const match = str.toString().match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
}

const parsed = parseRawData(rawText);
console.log('Parsed Raw Data:', parsed);

const url = parsed.Original_URL || parsed.Page_URL || parsed.page_url || parsed.url || '';
const asinCode = extractAsin(url);
console.log('Extracted ASIN Code:', asinCode);

const rating = parseRating(parsed.Rating || parsed.rating || parsed.avg_rating || 0);
const reviewCount = parseReviewCount(parsed.Review_count || parsed.review_count || parsed.ReviewCount || '');
console.log('Extracted Rating:', rating);
console.log('Extracted ReviewCount:', reviewCount);
