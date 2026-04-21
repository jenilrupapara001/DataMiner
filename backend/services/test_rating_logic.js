const service = {
    _cleanRating(str) {
        if (!str) return { value: 0, percentages: null };
        const s = str.toString().trim();
        
        const percentages = this._extractBreakdown(s);
        
        const outOfMatch = s.match(/([0-5](?:[.,]\d+)?)\s*out\s*of\s*5/i);
        if (outOfMatch) {
            const val = parseFloat(outOfMatch[1].replace(',', '.'));
            return { value: isNaN(val) ? 0 : val, percentages };
        }

        if (percentages) {
            const weighted = (5 * percentages['5'] + 4 * percentages['4'] + 3 * percentages['3'] + 2 * percentages['2'] + 1 * percentages['1']) / 100;
            return { value: Math.round(weighted * 10) / 10, percentages };
        }

        const specificMatch = s.match(/^([0-4](?:[.,]\d+)?)\s*star/i);
        if (specificMatch) return { value: parseFloat(specificMatch[1].replace(',', '.')), percentages };

        const matches = s.match(/([0-5](?:[.,]\d+)?)/);
        if (!matches) return { value: 0, percentages };

        let rating = parseFloat(matches[1].replace(',', '.'));
        if (isNaN(rating)) return { value: 0, percentages };
        rating = Math.min(5, Math.max(0, rating));
        return { value: Math.round(rating * 10) / 10, percentages };
    },

    _extractBreakdown(str) {
        if (!str) return null;
        const matches = str.match(/(\d+)%/g);
        if (matches && matches.length >= 5) {
            return {
                '5': parseFloat(matches[0]) || 0,
                '4': parseFloat(matches[1]) || 0,
                '3': parseFloat(matches[2]) || 0,
                '2': parseFloat(matches[3]) || 0,
                '1': parseFloat(matches[4]) || 0
            };
        }
        return null;
    },

    _cleanReviewCount(str) {
        if (!str) return 0;
        let s = str.toString().trim();
        
        // Remove common Amazon rating noise that often smashes into the review count
        s = s.replace(/out\s+of\s+[0-5](?:\.[0-9])?/gi, '');
        s = s.replace(/[0-5]\s*stars?/gi, '');

        const parenMatch = s.match(/\(([\d,]+)\)/);
        if (parenMatch) return parseInt(parenMatch[1].replace(/,/g, ''));
        
        const globalMatch = s.match(/([\d,]+)\s*(?:global\s*ratings?|reviews?)/i);
        if (globalMatch) return parseInt(globalMatch[1].replace(/,/g, '')) || 0;
        
        const allNumericMatches = s.match(/[\d,]+/g);
        if (allNumericMatches) {
            for (const m of allNumericMatches) {
                const val = parseInt(m.replace(/,/g, ''));
                const pos = s.indexOf(m);
                if (pos !== -1 && s[pos + m.length] === '%') continue;
                if (val > 10 && val < 50000000) return val;
                if (val > 0 && !s.toLowerCase().includes('star')) return val;
            }
        }
        return 0;
    }
};

const testCases = [
    {
        name: "Messy RT with 'out of 5' (smashed)",
        input: "3.8 out of 5 stars3.8 out of 5424 global ratings5 star45%4 star20%3 star14%2 star4%1 star16%",
        expectedRating: 3.8,
        expectedCount: 424
    },
    {
        name: "Only percentage stack",
        input: "5 star4 star3 star2 star1 star5 star53%23%12%5%7%",
        expectedRating: 4.1,
        expectedCount: 0
    }
];

testCases.forEach(tc => {
    const ratingResult = service._cleanRating(tc.input);
    const countResult = service._cleanReviewCount(tc.input);
    console.log(`--- Test: ${tc.name} ---`);
    console.log(`Input: ${tc.input.substring(0, 70)}...`);
    console.log(`Rating: ${ratingResult.value} (Expected: ${tc.expectedRating})`);
    console.log(`Count: ${countResult} (Expected: ${tc.expectedCount})`);
    console.log(`Breakdown: ${JSON.stringify(ratingResult.percentages)}`);
    console.log('');
});
