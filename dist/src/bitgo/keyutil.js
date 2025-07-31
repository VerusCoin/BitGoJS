"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.privateKeyBufferToECPair = privateKeyBufferToECPair;
exports.privateKeyBufferFromECPair = privateKeyBufferFromECPair;
/**
 * @prettier
 */
var BigInteger = require('bigi');
var ECPair = require('../ecpair');
/**
 * Create an ECPair from the raw private key bytes
 * @param {Buffer} buffer - Private key for the ECPair. Must be exactly 32 bytes.
 * @param {Network} [network] - Network for the ECPair. Defaults to bitcoin.
 * @return {ECPair}
 */
function privateKeyBufferToECPair(buffer, network) {
    if (!Buffer.isBuffer(buffer) || buffer.length !== 32) {
        throw new Error('invalid private key buffer');
    }
    var d = BigInteger.fromBuffer(buffer);
    return new ECPair(d, null, { network: network });
}
/**
 * Get the private key as a 32 bytes buffer. If it is smaller than 32 bytes, pad it with zeros
 * @param {ECPair} ecPair
 * @return {Buffer} 32 bytes
 */
function privateKeyBufferFromECPair(ecPair) {
    if (!(ecPair instanceof ECPair)) {
        throw new TypeError("invalid argument ecpair");
    }
    if (!ecPair.d)
        throw new Error('Missing private key');
    return ecPair.d.toBuffer(32);
}
