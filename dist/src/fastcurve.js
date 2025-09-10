var typeforce = require('typeforce');
var ECSignature = require('./ecsignature');
var types = require('./types');
// CommonJS import for v1.x (still works)
var secp256k1 = require('@noble/curves/secp256k1').secp256k1;
function ensureU8(input) {
    if (Buffer.isBuffer(input))
        return new Uint8Array(input);
    if (input instanceof Uint8Array)
        return input;
    throw new TypeError('Expected Uint8Array or Buffer');
}
var publicKeyCreate = function (buffer, compressed) {
    typeforce(types.tuple(types.Buffer256bit, types.Boolean), arguments);
    var privU8 = ensureU8(buffer);
    var pub = secp256k1.getPublicKey(privU8, compressed);
    return Buffer.from(pub); // Convert back to Buffer for compatibility
};
var sign = function (hash, d) {
    typeforce(types.tuple(types.Buffer256bit, types.BigInt), arguments);
    var hashU8 = ensureU8(hash);
    var privU8 = ensureU8(d.toBuffer(32));
    // Create Signature instance
    var signature = secp256k1.sign(hashU8, privU8);
    // DER-encode
    var derU8 = signature.toBytes('der');
    return ECSignature.fromDER(Buffer.from(derU8));
};
var verify = function (hash, sig, pubkey) {
    typeforce(types.tuple(types.Hash256bit, types.ECSignature, types.oneOf(types.BufferN(33), types.BufferN(65))), arguments);
    var hashU8 = ensureU8(hash);
    var pubU8 = ensureU8(pubkey);
    var der = new ECSignature(sig.r, sig.s).toDER();
    var s = secp256k1.Signature.fromBytes(der, 'der').normalizeS().toBytes('der');
    return secp256k1.verify(s, hashU8, pubU8);
};
module.exports = {
    available: true,
    publicKeyCreate: publicKeyCreate,
    sign: sign,
    verify: verify
};
