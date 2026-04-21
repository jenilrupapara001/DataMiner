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
        const matches = s.match(/([0-5](?:[.,]\d+)?)/);
        if (!matches) return { value: 0, percentages };
        let rating = parseFloat(matches[1].replace(',', '.'));
        return { value: Math.round(rating * 10) / 10, percentages };
    },
    _extractBreakdown(str) {
        if (!str) return null;
        const matches = str.match(/(\d+)%/g);
        if (matches && matches.length >= 5) {
            return { '5': parseFloat(matches[0]), '4': parseFloat(matches[1]), '3': parseFloat(matches[2]), '2': parseFloat(matches[3]), '1': parseFloat(matches[4]) };
        }
        return null;
    },
    _cleanReviewCount(str) {
        if (!str) return 0;
        let s = str.toString().trim();
        s = s.replace(/out\s+of\s+[0-5](?:\.[0-9])?/gi, '');
        s = s.replace(/[0-5]\s*stars?/gi, '');
        const parenMatch = s.match(/\(([\d,]+)\)/);
        if (parenMatch) return parseInt(parenMatch[1].replace(/,/g, ''));
        const globalMatch = s.match(/([\d,]+)\s*(?:global\s*ratings?|reviews?)/i);
        if (globalMatch) return parseInt(globalMatch[1].replace(/,/g, '')) || 0;
        const allNumericMatches = s.match(/[\d,]+(?!\s*%)/g);
        if (allNumericMatches) {
            for (const m of allNumericMatches) {
                const val = parseInt(m.replace(/,/g, ''));
                if (val > 10) return val;
                if (val > 0 && !s.toLowerCase().includes('star')) return val;
            }
        }
        return 0;
    }
};

const input1 = "3.8 out of 5 stars3.8 out of 5424 global ratings5 star45%4 star20%3 star14%2 star4%1 star16%";
const input2 = "5 star4 star3 star2 star1 star5 star53%23%12%5%7%";

console.log('Result 1 (Rating):', service._cleanRating(input1).value);
console.log('Result 1 (Count):', service._cleanReviewCount(input1));
console.log('Result 2 (Rating):', service._cleanRating(input2).value);
console.log('Result 2 (Count):', service._cleanReviewCount(input2));
