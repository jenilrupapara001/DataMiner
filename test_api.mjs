import fs from 'fs';
import API from './src/services/api.js';

// We need to simulate local storage for getAuthHeader
global.localStorage = {
  getItem: () => 'fake-token' // since auth is mocked or we can generate a real one
};

console.log("Looking in db for sellers...");
