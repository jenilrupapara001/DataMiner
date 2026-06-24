const zxcvbn = require('zxcvbn');
const crypto = require('crypto');

class PasswordPolicy {
  static MIN_LENGTH = 12;
  static MIN_STRENGTH_SCORE = 3;
  static FORBIDDEN_PATTERNS = [
    'password', 'admin', 'welcome', 'retailops', '123456', 'qwerty', 'letmein'
  ];

  static validate(password, userInfo = {}) {
    const errors = [];
    if (!password || password.length < this.MIN_LENGTH) {
      errors.push(`Password must be at least ${this.MIN_LENGTH} characters`);
    }
    if (!/[A-Z]/.test(password)) errors.push('Must contain uppercase letter');
    if (!/[a-z]/.test(password)) errors.push('Must contain lowercase letter');
    if (!/[0-9]/.test(password)) errors.push('Must contain number');
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) errors.push('Must contain special character');

    const lower = password.toLowerCase();
    for (const p of this.FORBIDDEN_PATTERNS) {
      if (lower.includes(p)) errors.push(`Cannot contain "${p}"`);
    }
    if (userInfo.email && lower.includes(userInfo.email.split('@')[0].toLowerCase())) {
      errors.push('Cannot contain your email');
    }
    if (userInfo.firstName && lower.includes(userInfo.firstName.toLowerCase())) {
      errors.push('Cannot contain your first name');
    }

    const strength = zxcvbn(password, [userInfo.email, userInfo.firstName].filter(Boolean));
    if (strength.score < this.MIN_STRENGTH_SCORE) {
      errors.push(`Password too weak: ${strength.feedback?.warning || 'Add more variety'}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      strength: {
        score: strength.score,
        label: ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'][strength.score],
        crackTime: strength.crack_times_display?.offline_slow_hashing_1e4_per_second,
        suggestions: strength.feedback?.suggestions || []
      }
    };
  }

  static generateStrong(length = 16) {
    const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
    const lower = 'abcdefghjkmnpqrstuvwxyz';
    const numbers = '23456789';
    const symbols = '!@#$%^&*()_+-=';
    const all = upper + lower + numbers + symbols;
    let pw = '';
    pw += upper[crypto.randomInt(0, upper.length)];
    pw += lower[crypto.randomInt(0, lower.length)];
    pw += numbers[crypto.randomInt(0, numbers.length)];
    pw += symbols[crypto.randomInt(0, symbols.length)];
    for (let i = 4; i < length; i++) pw += all[crypto.randomInt(0, all.length)];
    return pw.split('').sort(() => crypto.randomInt(0, 2) - 0.5).join('');
  }
}

module.exports = PasswordPolicy;
