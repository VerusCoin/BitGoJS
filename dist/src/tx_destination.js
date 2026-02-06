var varuint = require('varuint-bitcoin');
var TxDestination = /** @class */ (function () {
    function TxDestination(destType, destinationBytes) {
        if (destType === void 0) { destType = this.typePKH; }
        if (destinationBytes === void 0) { destinationBytes = []; }
        this.destType = destType;
        this.destinationBytes = destinationBytes;
    }
    Object.defineProperty(TxDestination.prototype, "typeInvalid", {
        get: function () {
            return TxDestination.TYPE_INVALID;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TxDestination.prototype, "typePK", {
        get: function () {
            return TxDestination.TYPE_PK;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TxDestination.prototype, "isPK", {
        get: function () {
            return this.destType === this.typePK;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TxDestination.prototype, "typePKH", {
        get: function () {
            return TxDestination.TYPE_PKH;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TxDestination.prototype, "isPKH", {
        get: function () {
            return this.destType === this.typePKH;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TxDestination.prototype, "typeSH", {
        get: function () {
            return TxDestination.TYPE_SH;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TxDestination.prototype, "isSH", {
        get: function () {
            return this.destType === this.typeSH;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TxDestination.prototype, "typeID", {
        get: function () {
            return TxDestination.TYPE_ID;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TxDestination.prototype, "isID", {
        get: function () {
            return this.destType === this.typeID;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TxDestination.prototype, "typeIndex", {
        get: function () {
            return TxDestination.TYPE_INDEX;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TxDestination.prototype, "isIndex", {
        get: function () {
            return this.destType === this.typeIndex;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TxDestination.prototype, "typeQuantum", {
        get: function () {
            return TxDestination.TYPE_QUANTUM;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TxDestination.prototype, "isQuantum", {
        get: function () {
            return this.destType === this.typeQuantum;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TxDestination.prototype, "typeLast", {
        get: function () {
            return TxDestination.TYPE_QUANTUM;
        },
        enumerable: false,
        configurable: true
    });
    TxDestination.prototype.isValid = function () {
        return this.destType > this.typeInvalid && this.destType <= this.typeLast && this.destinationBytes && this.destinationBytes.length;
    };
    TxDestination.fromChunk = function (chunk) {
        var prefix = Buffer.alloc(1);
        prefix.writeUInt8(chunk.length, 0);
        var dest = new TxDestination();
        dest.fromBuffer(Buffer.concat([prefix, chunk]));
        return dest;
    };
    TxDestination.prototype.fromBuffer = function (buffer, initialOffset) {
        if (initialOffset === void 0) { initialOffset = 0; }
        var offset = initialOffset;
        function readSlice(n) {
            offset += n;
            return buffer.slice(offset - n, offset);
        }
        function readVarInt() {
            var vi = varuint.decode(buffer, offset);
            offset += varuint.decode.bytes;
            return vi;
        }
        function readVarSlice() {
            return readSlice(readVarInt());
        }
        var destByteVector = readVarSlice();
        if (destByteVector.length === 20) {
            this.destType = this.typePKH;
            this.destinationBytes = destByteVector;
        }
        else if (destByteVector.length === 33) {
            this.destType = this.typePK;
            this.destinationBytes = destByteVector;
        }
        else {
            this.destType = destByteVector.slice(0, 1).readUInt8(0);
            this.destinationBytes = destByteVector.slice(1);
        }
        return offset;
    };
    TxDestination.prototype.__byteLength = function () {
        if (this.destType === this.typePKH) {
            return 21;
        }
        else if (this.destType === this.typePK) {
            return 34;
        }
        else {
            return varuint.encodingLength(this.destinationBytes.length + 1) + this.destinationBytes.length + 1;
        }
    };
    TxDestination.prototype.toChunk = function () {
        return this.toBuffer().slice(1);
    };
    TxDestination.prototype.toBuffer = function (buffer, initialOffset) {
        if (!buffer)
            buffer = Buffer.allocUnsafe(this.__byteLength());
        var offset = initialOffset || 0;
        function writeSlice(slice) { offset += slice.copy(buffer, offset); }
        function writeVarInt(i) {
            varuint.encode(i, buffer, offset);
            offset += varuint.encode.bytes;
        }
        function writeVarSlice(slice) { writeVarInt(slice.length); writeSlice(slice); }
        if (this.destType === this.typePKH) {
            if (this.destinationBytes.length !== 20) {
                throw new TypeError('invalid length for typePKH destination bytes');
            }
            writeVarSlice(this.destinationBytes);
        }
        else if (this.destType === this.typePK) {
            if (this.destinationBytes.length !== 33) {
                throw new TypeError('invalid length for typePK destination bytes');
            }
            writeVarSlice(this.destinationBytes);
        }
        else {
            var combinedVector_1 = Buffer.alloc(1 + this.destinationBytes.length);
            combinedVector_1.writeUInt8(this.destType, 0);
            this.destinationBytes.forEach(function (x, index) {
                combinedVector_1.writeUInt8(x, index + 1);
            });
            writeVarSlice(combinedVector_1);
        }
        // avoid slicing unless necessary
        if (initialOffset !== undefined)
            return buffer.slice(initialOffset, offset);
        // TODO (https://github.com/BitGo/bitgo-utxo-lib/issues/11): we shouldn't have to slice the final buffer
        return buffer.slice(0, offset);
    };
    TxDestination.TYPE_INVALID = 0;
    TxDestination.TYPE_PK = 1;
    TxDestination.TYPE_PKH = 2;
    TxDestination.TYPE_SH = 3;
    TxDestination.TYPE_ID = 4;
    TxDestination.TYPE_INDEX = 5;
    TxDestination.TYPE_QUANTUM = 6;
    return TxDestination;
}());
module.exports = TxDestination;
