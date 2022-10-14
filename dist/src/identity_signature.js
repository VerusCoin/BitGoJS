var Buffer = require('safe-buffer').Buffer;
var varuint = require('varuint-bitcoin');
var bufferutils = require('./bufferutils');
var fromBase58Check = require('./address').fromBase58Check;
var sha256 = require('./crypto').sha256;
var createHash = require('create-hash');
var ECSignature = require('./ecsignature');
var ECPair = require('./ecpair');
var BigInteger = require('bigi');
var VERUS_DATA_SIGNATURE_PREFIX_STRING = "Verus signed data:\n";
var bufferWriter = new bufferutils.BufferWriter(Buffer.alloc(VERUS_DATA_SIGNATURE_PREFIX_STRING.length + 1));
bufferWriter.writeVarSlice(Buffer.from("Verus signed data:\n", "utf-8"));
var VERUS_DATA_SIGNATURE_PREFIX = bufferWriter.buffer;
var IdentitySignature = /** @class */ (function () {
    function IdentitySignature(network, version, hashType, blockHeight, signatures, chainId, iAddress) {
        if (version === void 0) { version = 1; }
        if (hashType === void 0) { hashType = 1; }
        if (blockHeight === void 0) { blockHeight = 0; }
        this.version = version;
        this.hashType = hashType;
        this.blockHeight = blockHeight;
        this.chainId = chainId == null ? null : fromBase58Check(chainId).hash;
        this.identity = iAddress == null ? null : fromBase58Check(iAddress).hash;
        this.network = network;
        if (signatures != null) {
            this.signatures = signatures;
        }
        else {
            this.signatures = [];
        }
    }
    IdentitySignature.prototype.hashMessage = function (msg) {
        var rawMsgBuffer = Buffer.from(msg.toLowerCase(), "utf-8");
        var msgBufferWriter = new bufferutils.BufferWriter(Buffer.alloc(varuint.encodingLength(rawMsgBuffer.length) + rawMsgBuffer.length));
        msgBufferWriter.writeVarSlice(rawMsgBuffer);
        var _msgHash = sha256(msgBufferWriter.buffer);
        var heightBufferWriter = new bufferutils.BufferWriter(Buffer.alloc(4));
        heightBufferWriter.writeUInt32(this.blockHeight);
        return createHash("sha256")
            .update(VERUS_DATA_SIGNATURE_PREFIX)
            .update(this.chainId)
            .update(heightBufferWriter.buffer)
            .update(this.identity)
            .update(_msgHash)
            .digest();
    };
    IdentitySignature.prototype.signMessageOffline = function (msg, keyPair) {
        return this.signHashOffline(this.hashMessage(msg), keyPair);
    };
    IdentitySignature.prototype.verifyMessageOffline = function (msg, signingAddress) {
        return this.verifyHashOffline(this.hashMessage(msg), signingAddress);
    };
    IdentitySignature.prototype.signHashOffline = function (buffer, keyPair) {
        if (this.version !== 1)
            throw new Error("Versions above 1 not supported");
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
        throw new Error("Failed to generate signature with valid recovery id");
    };
    // In this case keyPair refers to the ECPair containing at minimum
    // a pubkey. This function returns an array of booleans indicating which
    // signatures passed and failed
    IdentitySignature.prototype.verifyHashOffline = function (hash, signingAddress) {
        if (this.version !== 1)
            throw new Error("Versions above 1 not supported");
        if (this.signatures.length == 0)
            throw new Error("No signatures to verify");
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
        return 6 + varuint.encodingLength(this.signatures.length) + totalSigLength;
    };
    IdentitySignature.prototype.toBuffer = function (buffer, initialOffset) {
        var noBuffer = !buffer;
        if (noBuffer)
            buffer = Buffer.allocUnsafe(this.__byteLength());
        var bufferWriter = new bufferutils.BufferWriter(buffer, initialOffset || 0);
        //bufferWriter.writeUInt8(this.version);
        bufferWriter.writeUInt8(this.version);
        bufferWriter.writeUInt32(this.blockHeight);
        bufferWriter.writeUInt8(this.signatures.length); // num signatures
        for (var _i = 0, _a = this.signatures; _i < _a.length; _i++) {
            var sig = _a[_i];
            bufferWriter.writeVarSlice(sig);
        }
        // avoid slicing unless necessary
        if (initialOffset !== undefined)
            return noBuffer
                ? bufferWriter.buffer.slice(initialOffset, bufferWriter.offset)
                : bufferWriter.offset;
        // TODO (https://github.com/BitGo/bitgo-utxo-lib/issues/11): we shouldn't have to slice the final buffer
        return noBuffer ? bufferWriter.buffer.slice(0, bufferWriter.offset) : bufferWriter.offset;
    };
    return IdentitySignature;
}());
module.exports = IdentitySignature;
