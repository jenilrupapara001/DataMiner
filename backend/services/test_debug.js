const service = {
    _cleanReviewCount(str) {
        if (!str) return 0;
        let s = str.toString().trim();
        s = s.replace(/out\s+of\s+[0-5](?:\.[0-9])?/gi, '');
        s = s.replace(/[0-5]\s*stars?/gi, '');
        console.log('Cleaned String:', s);
        const allNumericMatches = s.match(/[\d,]+/g);
        if (allNumericMatches) {
            for (const m of allNumericMatches) {
                const val = parseInt(m.replace(/,/g, ''));
                const pos = s.indexOf(m);
                if (pos !== -1 && s[pos + m.length] === '%') continue;
                if (val > 10) return val;
                if (val > 0 && !s.toLowerCase().includes('star')) return val;
            }
        }
        return 0;
    }
};
const input = "5 star4 star3 star2 star1 star5 star53%23%12%5%7%";
service._cleanReviewCount(input);
