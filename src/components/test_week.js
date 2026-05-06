const dates = ['2023-11-15', '2023-11-14', '2023-11-08', '2023-11-01', '2023-10-31'];

const sorted = [...dates].sort((a, b) => new Date(b) - new Date(a));

const weekMap = new Map();
sorted.forEach(d => {
    const dateObj = new Date(d);
    const day = dateObj.getDay();
    const diff = dateObj.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(dateObj.setDate(diff));
    const weekKey = monday.toISOString().split('T')[0];
    
    if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, d);
    }
});

console.log(Array.from(weekMap.values()).sort());
