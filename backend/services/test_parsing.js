const rawData = {
    "deal_badge": "\n            Limited time deal NO_OF_HOURS hours NO_OF_MINUTES minutes Limited time deal NO_OF_MINUTES minutes Limited time deal NO_OF_MINUTES minutes NO_OF_SECONDS seconds Limited time deal NO_OF_SECONDS seconds  Limited time deal  ",
    "Rating": "5 star4 star3 star2 star1 star5 star53%23%12%5%7%53%5 star4 star3 star2 star1 star4 star53%23%12%5%7%23%5 star4 star3 star2 star1 star3 star53%23%12%5%7%12%5 star4 star3 star2 star1 star2 star53%23%12%5%7%5%5 star4 star3 star2 star1 star1 star53%23%12%5%7%7%",
    "review_count": "(2,441)",
    "5_star": "53%",
    "4_star": "23%",
    "3_star": "12%",
    "2_star": "5%",
    "1_star": "7%"
};

function cleanRating(str) {
    if (!str) return 0;
    const s = str.toString().trim();
    // Improved regex to handle Amazon's messy concatenated strings
    // Look for "4.5 out of 5" or just a decimal number at the start
    const outOfMatch = s.match(/([0-5](?:[.,]\d+)?)\s*out\s*of\s*5/i);
    if (outOfMatch) return parseFloat(outOfMatch[1].replace(',', '.'));

    const matches = s.match(/^([0-5](?:[.,]\d+)?)/);
    if (matches) return parseFloat(matches[1].replace(',', '.'));

    return 0;
}

function cleanReviewCount(str) {
    if (!str) return 0;
    const s = str.toString().trim();
    return parseInt(s.replace(/[^0-9]/g, '')) || 0;
}

function cleanDealBadge(str) {
  if (!str || str === 'null') return 'No deal found';
  const s = str.toLowerCase();
  if (s.includes('limited time deal')) return 'Limited Time Deal';
  if (s.includes('deal of the day')) return 'Deal of the Day';
  if (s.includes('lightning deal')) return 'Lightning Deal';
  if (s.includes('prime deal')) return 'Prime Deal';
  return str.trim() || 'No deal found';
}

console.log('--- TEST RESULTS ---');
console.log('Cleaned Rating:', cleanRating(rawData.Rating));
console.log('Cleaned Review Count:', cleanReviewCount(rawData.review_count));
console.log('Cleaned Deal Badge:', cleanDealBadge(rawData.deal_badge));
