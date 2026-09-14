var Buffer = require('safe-buffer').Buffer;
var bscript = require('./script');
var varuint = require('varuint-bitcoin');
const SmartTransactionSignature = require('./smart_transaction_signature');
class SmartTransactionSignatures {
    constructor(version = 1, sigHashType = 1, signatures) {
        this.version = version;
        this.sigHashType = sigHashType;
        this.signatures = signatures || [];
        this.error = null;
    }
    isValid() {
        return this.version > 0 && this.version < 2 && bscript.isDefinedHashType(this.sigHashType) && this.signatures.length > 0;
    }
    __byteLength() {
        return this.signatures.reduce(function (a, x) { return a + x.__byteLength(); }, 2 + varuint.encodingLength(this.signatures.length));
    }
    minLength() {
        const checkSigs = new SmartTransactionSignatures();
        return checkSigs.__byteLength();
    }
    toBuffer(buffer, initialOffset) {
        var noBuffer = !buffer;
        if (noBuffer)
            buffer = Buffer.allocUnsafe(this.__byteLength());
        var offset = initialOffset || 0;
        function writeUInt8(i) { offset = buffer.writeUInt8(i, offset); }
        function writeVarInt(i) {
            varuint.encode(i, buffer, offset);
            offset += varuint.encode.bytes;
        }
        writeUInt8(this.version);
        writeUInt8(this.sigHashType);
        writeVarInt(this.signatures ? this.signatures.length : 0);
        this.signatures.forEach(x => {
            offset = x.toBuffer(buffer, offset);
        });
        // avoid slicing unless necessary
        if (initialOffset !== undefined)
            return noBuffer ? buffer.slice(initialOffset, offset) : offset;
        // TODO (https://github.com/BitGo/bitgo-utxo-lib/issues/11): we shouldn't have to slice the final buffer
        return noBuffer ? buffer.slice(0, offset) : offset;
    }
    static fromChunk(chunk) {
        const sigs = new SmartTransactionSignatures();
        sigs.fromBuffer(chunk);
        return sigs;
    }
    toChunk() {
        return this.toBuffer();
    }
    fromBuffer(buffer, initialOffset = 0) {
        var offset = initialOffset;
        function readUInt8() {
            var i = buffer.readUInt8(offset);
            offset += 1;
            return i;
        }
        function readVarInt() {
            var vi = varuint.decode(buffer, offset);
            offset += varuint.decode.bytes;
            return vi;
        }
        function readOneSig() {
            var oneSig = new SmartTransactionSignature();
            offset = oneSig.fromBuffer(buffer, offset);
            return oneSig;
        }
        try {
            if (buffer.length < this.minLength()) {
                this.error = new Error('buffer length too short');
                return initialOffset;
            }
            this.version = readUInt8();
            this.sigHashType = readUInt8();
            if (!(this.version > 0 && this.version < 2 && bscript.isDefinedHashType(this.sigHashType))) {
                return initialOffset;
            }
            this.signatures = this.signatures ? this.signatures : [];
            for (let numSignatures = readVarInt(); numSignatures > 0; numSignatures--) {
                this.signatures[this.signatures.length] = readOneSig();
            }
        }
        catch (error) {
            this.error = error;
            this.version = 0;
            return initialOffset;
        }
        return offset;
    }
}
module.exports = SmartTransactionSignatures;
