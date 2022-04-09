const crypto = require('crypto');
const base32 = require('hi-base32');
const { secret } = require('../config.json');

class Auth {

    constructor() {}

    static verifyTOTP(token, scr = secret, window = 1) {
        if (Math.abs(+window) > 10) {
            console.error('Window size is too large');
            return false;
        }

        for (let errorWindow = -window; errorWindow <= +window; errorWindow++) {
            const totp = this.generateTOTP(scr, errorWindow);
            if (token === totp) {
                return true;
            }
        }

        return false;
    }

    static generateTOTP(secret, window = 0) {
        const counter = Math.floor(Date.now() / 30000);
        return this.generateHOTP(secret, counter + window);
    }

    static generateHOTP(secret, counter) {
        const decodedSecret = base32.decode.asBytes(secret);
        const buffer = Buffer.alloc(8);
        for (let i = 0; i < 8; i++) {
            buffer[7 - i] = counter & 0xff;
            counter = counter >> 8;
        }

        // Step 1: Generate an HMAC-SHA-1 value
        const hmac = crypto.createHmac('sha1', Buffer.from(decodedSecret));
        hmac.update(buffer);
        const hmacResult = hmac.digest();

        // Step 2: Generate a 4-byte string (Dynamic Truncation)
        const code = this.dynamicTruncationFn(hmacResult);

        // Step 3: Compute an HOTP value
        return code % 10 ** 6;
    }

    static dynamicTruncationFn(hmacValue) {
        const offset = hmacValue[hmacValue.length - 1] & 0xf;

        return (
            ((hmacValue[offset] & 0x7f) << 24) |
            ((hmacValue[offset + 1] & 0xff) << 16) |
            ((hmacValue[offset + 2] & 0xff) << 8) |
            (hmacValue[offset + 3] & 0xff)
        );
    }

    static generateSecret(length = 20) {
        const randomBuffer = crypto.randomBytes(length);
        return base32.encode(randomBuffer).replace(/=/g, '');
    }
}

module.exports = {
    Auth,
}

//CREDITS: https://hackernoon.com/how-to-implement-google-authenticator-two-factor-auth-in-javascript-091wy3vh3/