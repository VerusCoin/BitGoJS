var baddress = require('./address');
var bcrypto = require('./crypto');
var ecdsa = require('./ecdsa');
var randomBytes = require('randombytes');
var typeforce = require('typeforce');
var types = require('./types');
var wif = require('wif');
var secp256k1 = require('@noble/curves/secp256k1').secp256k1;
var NETWORKS = require('./networks');
var BigInteger = require('bigi');
var sig = require('./ecsignature');
var ecurve = require('ecurve');
var curve = ecurve.getCurveByName('secp256k1');
var secp256k1Ecurve = ecdsa.__curve;
var fastcurve = require('./fastcurve');
function ECPair(d, Q, options) {
    if (options) {
        typeforce({
            compressed: types.maybe(types.Boolean),
            network: types.maybe(types.Network)
        }, options);
    }
    options = options || {};
    if (d) {
        if (d.signum() <= 0)
            throw new Error('Private key must be greater than 0');
        if (d.compareTo(secp256k1Ecurve.n) >= 0)
            throw new Error('Private key must be less than the curve order');
        if (Q)
            throw new TypeError('Unexpected publicKey parameter');
        this.d = d;
    }
    else {
        typeforce(types.ECPoint, Q);
        this.__Q = Q;
    }
    this.compressed = options.compressed === undefined ? true : options.compressed;
    this.network = options.network || NETWORKS.bitcoin;
}
Object.defineProperty(ECPair.prototype, 'Q', {
    get: function () {
        if (!this.__Q && this.d) {
            var qBuf = fastcurve.publicKeyCreate(this.d.toBuffer(32), false);
            if (qBuf) {
                this.__Q = ecurve.Point.decodeFrom(curve, qBuf);
            }
            else {
                // Use noble to derive public key
                var pubBytes = secp256k1.getPublicKey(this.d.toBuffer(32), this.compressed);
                this.__Q = ecurve.Point.decodeFrom(curve, Buffer.from(pubBytes));
            }
        }
        return this.__Q;
    }
});
ECPair.recoverFromSignature = function (hashBuffer, compactSigBuffer, network) {
    var compactParsed = sig.parseCompact(compactSigBuffer); // { signature: ECSignature, i }
    var der = compactParsed.signature.toDER();
    // 1) Build noble Signature from DER
    // 2) Attach recovery bit (0..3). Some libs encode higher; mask to be safe.
    var recovery = compactParsed.i & 3;
    var nobleSig = secp256k1.Signature.fromDER(der).addRecoveryBit(recovery);
    // 3) Recover pubkey from the message hash
    var pubBytes = nobleSig.recoverPublicKey(hashBuffer).toRawBytes(true); // compressed
    return ECPair.fromPublicKeyBuffer(Buffer.from(pubBytes), network);
};
ECPair.fromPublicKeyBuffer = function (buffer, network) {
    var Q = ecurve.Point.decodeFrom(secp256k1Ecurve, buffer);
    return new ECPair(null, Q, {
        compressed: Q.compressed,
        network: network
    });
};
ECPair.fromWIF = function (string, network, skipVersionCheck) {
    if (skipVersionCheck === void 0) { skipVersionCheck = false; }
    var decoded = wif.decode(string);
    var version = decoded.version;
    // list of networks?
    if (types.Array(network)) {
        network = network.filter(function (x) {
            return version === x.wif;
        }).pop();
        if (!network)
            throw new Error('Unknown network version');
        // otherwise, assume a network object (or default to bitcoin)
    }
    else {
        network = network || NETWORKS.bitcoin;
        if (!skipVersionCheck && version !== network.wif)
            throw new Error('Invalid network version');
    }
    var d = BigInteger.fromBuffer(decoded.privateKey);
    return new ECPair(d, null, {
        compressed: decoded.compressed,
        network: network
    });
};
ECPair.makeRandom = function (options) {
    options = options || {};
    var rng = options.rng || randomBytes;
    var d;
    do {
        var buffer = rng(32);
        typeforce(types.Buffer256bit, buffer);
        d = BigInteger.fromBuffer(buffer);
    } while (d.signum() <= 0 || d.compareTo(secp256k1Ecurve.n) >= 0);
    return new ECPair(d, null, options);
};
ECPair.prototype.getAddress = function () {
    return baddress.toBase58Check(bcrypto.hash160(this.getPublicKeyBuffer()), this.getNetwork().pubKeyHash);
};
ECPair.prototype.getNetwork = function () {
    return this.network;
};
ECPair.prototype.getPublicKeyBuffer = function () {
    return this.Q.getEncoded(this.compressed);
};
ECPair.prototype.sign = function (hash) {
    if (!this.d)
        throw new Error('Missing private key');
    var sig = fastcurve.sign(hash, this.d);
    if (sig !== undefined)
        return sig;
    return ecdsa.sign(hash, this.d);
};
ECPair.prototype.toWIF = function () {
    if (!this.d)
        throw new Error('Missing private key');
    return wif.encode(this.network.wif, this.d.toBuffer(32), this.compressed);
};
ECPair.prototype.verify = function (hash, signature) {
    var fastsig = fastcurve.verify(hash, signature, this.getPublicKeyBuffer());
    if (fastsig !== undefined)
        return fastsig;
    return ecdsa.verify(hash, signature, this.Q);
};
/**
 * @deprecated
 * Use {@see keyutil.privateKeyBufferToECPair} instead
 * Will be removed in next major version (BLOCK-267)
 */
ECPair.fromPrivateKeyBuffer = function (buffer, network) {
    // toplevel import unavailable due to circular dependency
    var keyutil = require('./bitgo/keyutil');
    return keyutil.privateKeyBufferToECPair(buffer, network);
};
/**
 * @deprecated
 * Use {@see keyutil.privateKeyBufferFromECPair} instead
 * Will be removed in next major version (BLOCK-267)
 */
ECPair.prototype.getPrivateKeyBuffer = function () {
    // toplevel import unavailable due to circular dependency
    var keyutil = require('./bitgo/keyutil');
    return keyutil.privateKeyBufferFromECPair(this);
};
module.exports = ECPair;
