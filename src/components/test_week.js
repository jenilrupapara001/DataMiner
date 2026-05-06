const dates = ['2023-11-15', '2023-11-14', '2023-11-08', '2023-11-01', '2023-10-31'];

const sorted = [...dates].sort();

const dateColumns = [];
let currentWeek = null;
let weekCounter = 0;

sorted.forEach(d => {
    const dateObj = new Date(d);
    const day = dateObj.getDay();
    const diff = dateObj.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(dateObj.setDate(diff)).toISOString().split('T')[0];
    
    if (monday !== currentWeek) {
        currentWeek = monday;
        weekCounter++;
    }
    dateColumns.push({
        date: d,
        weekName: `W${weekCounter}`
    });
});

console.log(dateColumns);
