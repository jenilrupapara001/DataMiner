process.env.PORT = 3002;
require('dotenv').config();

// Override console.error to capture the stack trace
const originalConsoleError = console.error;
let capturedErrorStack = null;

console.error = function(...args) {
    originalConsoleError.apply(console, args);
    const err = args.find(arg => arg instanceof Error || (arg && arg.stack));
    if (err) {
        capturedErrorStack = err.stack || err;
    } else {
        const str = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
        if (str.includes('Error')) {
            capturedErrorStack = str;
        }
    }
};

// Import and start server
const http = require('http');
const express = require('express');

console.log('Starting test server on port 3002...');
// Load the server file
require('../server.js');

// Give it 2 seconds to initialize SQL Server
setTimeout(async () => {
    console.log('Sending test request to POST http://localhost:3002/api/actions/3ded7bada5b24e01ab05fa0d/start ...');
    
    const jwt = require('jsonwebtoken');
    const config = require('../config/env');
    const token = jwt.sign(
        { userId: '53948eb7838845f59107ee67', email: 'admin@gms.com' },
        config.jwtSecret,
        { expiresIn: '1h' }
    );
    
    try {
        const res = await fetch('http://localhost:3002/api/actions/3ded7bada5b24e01ab05fa0d/start', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Response status:', res.status);
        const body = await res.json();
        console.log('Response body:', body);
        
        if (capturedErrorStack) {
            console.log('\n🚨 CAPTURED BACKEND STACK TRACE:\n', capturedErrorStack);
        } else {
            console.log('\nNo console.error captured.');
        }
    } catch (e) {
        console.error('Request failed:', e.message);
    }
    
    process.exit(0);
}, 2000);
