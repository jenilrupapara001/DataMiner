const service = {
    _cleanReviewCount(str) {
        if (!str) return 0;
        let s = str.toString().trim();
        s = s.replace(/out\s+of\s+[0-5](?:\.[0-9])?/gi, '');
        s = s.replace(/[0-5]\s*stars?/gi, '');
        const allNumericMatches = s.match(/\b[\d,]+\b(?!\s*%)/g);
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

console.log('Result 1 (Count):', service._cleanReviewCount(input1));
console.log('Result 2 (Count):', service._cleanReviewCount(input2));
