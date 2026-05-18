const { getAdsManagerData } = require('../controllers/dataController');

async function main() {
    const req = {
        query: {
            groupBy: 'asin',
            startDate: '2026-04-18',
            endDate: '2026-05-18'
        }
    };
    
    let responseData = null;
    let statusCode = 200;
    
    const res = {
        status: function(code) {
            statusCode = code;
            return this;
        },
        json: function(data) {
            responseData = data;
            return this;
        }
    };
    
    await getAdsManagerData(req, res);
    
    console.log('Status Code:', statusCode);
    console.log('API Response Success:', responseData.success);
    if (!responseData.success) {
        console.log('Error Message:', responseData.message);
    } else {
        console.log('API Response Total Items:', responseData.total);
        if (responseData.data && responseData.data.length > 0) {
            console.log('Sample Item:', {
                id: responseData.data[0].id,
                asin: responseData.data[0].asin,
                title: responseData.data[0].title,
                spend: responseData.data[0].spend,
                sales: responseData.data[0].sales,
                historyDays: responseData.data[0].weekHistory ? responseData.data[0].weekHistory.length : 0
            });
        }
    }
}

main().catch(console.error);
