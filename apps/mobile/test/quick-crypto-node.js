/**
 * Jest stand-in: react-native-quick-crypto exposes a node:crypto-compatible
 * API, so tests run the SAME AES-256-GCM calls against Node's OpenSSL.
 */
module.exports = require('node:crypto');
module.exports.default = require('node:crypto');
