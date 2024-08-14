var Buffer = require('safe-buffer').Buffer;
var varuint = require('varuint-bitcoin');
var bufferutils = require('./bufferutils');
var fromBase58Check = require('./address').fromBase58Check;
var sha256 = require('./crypto').sha256;
var createHash = require('create-hash');
var ECSignature = require('./ecsignature');
var ECPair = require('./ecpair');
var VERUS_DATA_SIGNATURE_PREFIX_STRING = 'Verus signed data:\n';
var bufferWriter = new bufferutils.BufferWriter(Buffer.alloc(VERUS_DATA_SIGNATURE_PREFIX_STRING.length + 1));
bufferWriter.writeVarSlice(Buffer.from('Verus signed data:\n', 'utf-8'));
var VERUS_DATA_SIGNATURE_PREFIX = bufferWriter.buffer;
var HASH_INVALID = 0; // eslint-disable-line
var HASH_BLAKE2BMMR = 1; // eslint-disable-line
var HASH_BLAKE2BMMR2 = 2; // eslint-disable-line
var HASH_KECCAK = 3; // eslint-disable-line
var HASH_SHA256D = 4; // eslint-disable-line
var HASH_SHA256 = 5;
var HASH_LASTTYPE = 5; // eslint-disable-line
var IdentitySignature = /** @class */ (function () {
    function IdentitySignature(network, version, hashType, blockHeight, signatures, chainId, iAddress) {
        if (version === void 0) { version = 2; }
        if (hashType === void 0) { hashType = HASH_SHA256; }
        if (blockHeight === void 0) { blockHeight = 0; }
        this.version = version;
        this.hashType = hashType;
        this.blockHeight = blockHeight;
        this.chainId = chainId == null ? null : fromBase58Check(chainId).hash;
        this.identity = iAddress == null ? null : fromBase58Check(iAddress).hash;
        this.network = network;
        this.assertSupported();
        if (signatures != null) {
            this.signatures = signatures;
        }
        else {
            this.signatures = [];
        }
    }
    IdentitySignature.prototype.assertSupported = function () {
        if (this.version !== 1 && this.version !== 2)
            throw new Error('Unsupported version');
        if (this.version === 2 && this.hashType !== HASH_SHA256)
            throw new Error('Unsupported hashtype');
    };
    IdentitySignature.prototype.hashMessage = function (msg) {
        var rawMsgBuffer = Buffer.from(msg, 'utf-8');
        var msgBufferWriter = new bufferutils.BufferWriter(Buffer.alloc(varuint.encodingLength(rawMsgBuffer.length) + rawMsgBuffer.length));
        msgBufferWriter.writeVarSlice(rawMsgBuffer);
        var _msgHash = sha256(msgBufferWriter.buffer);
        var heightBufferWriter = new bufferutils.BufferWriter(Buffer.alloc(4));
        heightBufferWriter.writeUInt32(this.blockHeight);
        if (this.version === 1) {
            return createHash('sha256')
                .update(VERUS_DATA_SIGNATURE_PREFIX)
                .update(this.chainId)
                .update(heightBufferWriter.buffer)
                .update(this.identity)
                .update(_msgHash)
                .digest();
        }
        else {
            return createHash("sha256")
                .update(this.chainId)
                .update(heightBufferWriter.buffer)
                .update(this.identity)
                .update(VERUS_DATA_SIGNATURE_PREFIX)
                .update(_msgHash)
                .digest();
        }
    };
    IdentitySignature.prototype.signMessageOffline = function (msg, keyPair) {
        return this.signHashOffline(this.hashMessage(msg), keyPair);
    };
    IdentitySignature.prototype.verifyMessageOffline = function (msg, signingAddress) {
        return this.verifyHashOffline(this.hashMessage(msg), signingAddress);
    };
    IdentitySignature.prototype.signHashOffline = function (buffer, keyPair) {
        this.assertSupported();
        var signature = keyPair.sign(buffer);
        if (Buffer.isBuffer(signature))
            signature = ECSignature.fromRSBuffer(signature);
        var signingAddress = keyPair.getAddress();
        var recid;
        var compactSig;
        // Try all possible recovery ids until one that can recover the
        // correct pubkey is found. This is not the most efficient way to do this.
        for (recid = 0; recid < 4; recid++) {
            compactSig = signature.toCompact(recid, true);
            var recoveredKeyPair = ECPair.recoverFromSignature(buffer, compactSig, this.network);
            if (recoveredKeyPair.getAddress() === signingAddress) {
                this.signatures.push(compactSig);
                return compactSig;
            }
        }
        throw new Error('Failed to generate signature with valid recovery id');
    };
    // In this case keyPair refers to the ECPair containing at minimum
    // a pubkey. This function returns an array of booleans indicating which
    // signatures passed and failed
    IdentitySignature.prototype.verifyHashOffline = function (hash, signingAddress) {
        this.assertSupported();
        if (this.signatures.length === 0)
            throw new Error('No signatures to verify');
        var results = [];
        for (var i = 0; i < this.signatures.length; i++) {
            try {
                var sig = ECSignature.parseCompact(this.signatures[i]);
                var pubKeyPair = ECPair.recoverFromSignature(hash, sig.signature.toCompact(sig.i, true), this.network);
                if (pubKeyPair.getAddress() === signingAddress) {
                    var verification = pubKeyPair.verify(hash, sig.signature);
                    results.push(verification);
                }
                else {
                    results.push(false);
                }
            }
            catch (e) {
                console.log(e);
                results.push(false);
            }
        }
        return results;
    };
    IdentitySignature.prototype.fromBuffer = function (buffer, initialOffset, chainId, iAddress) {
        var bufferReader = new bufferutils.BufferReader(buffer, initialOffset || 0);
        this.version = bufferReader.readUInt8();
        if (this.version === 2)
            this.hashType = bufferReader.readUInt8();
        this.assertSupported();
        this.blockHeight = bufferReader.readUInt32();
        var numSigs = bufferReader.readUInt8();
        this.chainId = chainId == null ? null : fromBase58Check(chainId).hash;
        this.identity = iAddress == null ? null : fromBase58Check(iAddress).hash;
        for (var i = 0; i < numSigs; i++) {
            this.signatures.push(bufferReader.readVarSlice());
        }
        return bufferReader.offset;
    };
    IdentitySignature.prototype.__byteLength = function () {
        var totalSigLength = 0;
        this.signatures.forEach(function (sig) {
            totalSigLength += sig.length;
        });
        return ((this.version === 2 ? 7 : 6) +
            varuint.encodingLength(this.signatures.length) +
            totalSigLength);
    };
    IdentitySignature.prototype.toBuffer = function (buffer, initialOffset) {
        this.assertSupported();
        var noBuffer = !buffer;
        if (noBuffer)
            buffer = Buffer.allocUnsafe(this.__byteLength());
        var bufferWriter = new bufferutils.BufferWriter(buffer, initialOffset || 0);
        bufferWriter.writeUInt8(this.version);
        if (this.version === 2)
            bufferWriter.writeUInt8(this.hashType);
        bufferWriter.writeUInt32(this.blockHeight);
        bufferWriter.writeUInt8(this.signatures.length); // num signatures
        for (var _i = 0, _a = this.signatures; _i < _a.length; _i++) {
            var sig = _a[_i];
            bufferWriter.writeVarSlice(sig);
        }
        // avoid slicing unless necessary
        if (initialOffset !== undefined) {
            return noBuffer
                ? bufferWriter.buffer.slice(initialOffset, bufferWriter.offset)
                : bufferWriter.offset;
        }
        // TODO (https://github.com/BitGo/bitgo-utxo-lib/issues/11): we shouldn't have to slice the final buffer
        return noBuffer ? bufferWriter.buffer.slice(0, bufferWriter.offset) : bufferWriter.offset;
    };
    return IdentitySignature;
}());
module.exports = IdentitySignature;
