const asinController = require('./controllers/asinController');
require('dotenv').config();

const req = {
  user: {
    role: { name: 'admin' }, // admin bypasses seller filtering
  },
  query: {
    page: 1,
    limit: 25,
    subBsrCategory: "Baby Boys' Clothing Sets"
  }
};

const res = {
  json: function(data) {
    console.log(JSON.stringify(data, null, 2));
  },
  status: function(code) {
    console.log('Status code:', code);
    return this;
  }
};

asinController.getAsins(req, res);
