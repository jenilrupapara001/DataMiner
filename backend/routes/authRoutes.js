const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const rateLimit = require('express-rate-limit');
const { ipRateLimiter, accountLockoutCheck } = require('../middleware/loginRateLimiter');

const otpLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 5, message: { success: false, message: 'Too many OTP requests, try again later' } });
const requestOtpLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 3, message: { success: false, message: 'Too many OTP requests, try again later' } });

router.post('/register', (req, res) => res.status(403).json({ message: 'Registration is currently disabled' }));
router.post('/login',
    ipRateLimiter,           // Layer 1: IP rate limit — 10 req/min per IP
    validate('login'),       // Validate email + password format
    accountLockoutCheck,     // Layer 2+3: Check lockout + progressive delay
    authController.login
);
router.post('/request-otp', requestOtpLimiter, authController.requestOtp);
router.post('/verify-otp', otpLimiter, validate('verifyOtp'), authController.verifyOtp);
router.post('/resend-otp', otpLimiter, validate('resendOtp'), authController.resendOtp);
router.post('/refresh-token', authController.refreshToken);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getMe);
router.put('/profile', authenticate, authController.updateProfile);
router.put('/change-password', authenticate, validate('changePassword'), authController.changePassword);

module.exports = router;
