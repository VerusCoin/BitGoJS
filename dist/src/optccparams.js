var bscript = require('./script');
var EVALS = require('bitcoin-ops/evals.json');
var varuint = require('varuint-bitcoin');
var TxDestination = require('./tx_destination');
var bufferutils = require('./bufferutils');
function varSliceSize(varSlice) {
    var length = varSlice.length;
    return varuint.encodingLength(length) + length;
}
var OptCCParams = /** @class */ (function () {
    function OptCCParams(version, evalCode, m, n, destinations, serializedObjects) {
        if (version === void 0) { version = 3; }
        if (evalCode === void 0) { evalCode = 0; }
        if (m === void 0) { m = 1; }
        if (n === void 0) { n = 1; }
        if (destinations === void 0) { destinations = []; }
        if (serializedObjects === void 0) { serializedObjects = []; }
        this.version = version;
        this.evalCode = evalCode;
        this.m = m;
        this.n = n;
        this.destinations = destinations;
        this.vData = serializedObjects;
        // Error variable for reporting, does not get serialized
        this.error = null;
    }
    OptCCParams.prototype.getParamObject = function () {
        switch (this.evalCode) {
            case EVALS.EVAL_NONE:
                {
                    return null;
                }
            case EVALS.EVAL_STAKEGUARD:
            case EVALS.EVAL_CURRENCY_DEFINITION:
            case EVALS.EVAL_NOTARY_EVIDENCE:
            case EVALS.EVAL_EARNEDNOTARIZATION:
            case EVALS.EVAL_ACCEPTEDNOTARIZATION:
            case EVALS.EVAL_FINALIZE_NOTARIZATION:
            case EVALS.EVAL_CURRENCYSTATE:
            case EVALS.EVAL_RESERVE_TRANSFER:
            case EVALS.EVAL_RESERVE_OUTPUT:
            case EVALS.EVAL_RESERVE_DEPOSIT:
            case EVALS.EVAL_CROSSCHAIN_EXPORT:
            case EVALS.EVAL_CROSSCHAIN_IMPORT:
            case EVALS.EVAL_IDENTITY_PRIMARY:
            case EVALS.EVAL_IDENTITY_COMMITMENT:
            case EVALS.EVAL_IDENTITY_RESERVATION:
            case EVALS.EVAL_FINALIZE_EXPORT:
            case EVALS.EVAL_FEE_POOL:
            case EVALS.EVAL_NOTARY_SIGNATURE:
                {
                    if (this.vData.length) {
                        return this.vData[0];
                    }
                    else {
                        return null;
                    }
                }
            default:
                {
                    return null;
                }
        }
    };
    OptCCParams.prototype.isValid = function () {
        var validEval = false;
        switch (this.evalCode) {
            case EVALS.EVAL_NONE:
                {
                    validEval = true;
                    break;
                }
            case EVALS.EVAL_STAKEGUARD:
            case EVALS.EVAL_CURRENCY_DEFINITION:
            case EVALS.EVAL_NOTARY_EVIDENCE:
            case EVALS.EVAL_EARNEDNOTARIZATION:
            case EVALS.EVAL_ACCEPTEDNOTARIZATION:
            case EVALS.EVAL_FINALIZE_NOTARIZATION:
            case EVALS.EVAL_CURRENCYSTATE:
            case EVALS.EVAL_RESERVE_TRANSFER:
            case EVALS.EVAL_RESERVE_OUTPUT:
            case EVALS.EVAL_RESERVE_DEPOSIT:
            case EVALS.EVAL_CROSSCHAIN_EXPORT:
            case EVALS.EVAL_CROSSCHAIN_IMPORT:
            case EVALS.EVAL_IDENTITY_PRIMARY:
            case EVALS.EVAL_IDENTITY_COMMITMENT:
            case EVALS.EVAL_IDENTITY_RESERVATION:
            case EVALS.EVAL_FINALIZE_EXPORT:
            case EVALS.EVAL_FEE_POOL:
            case EVALS.EVAL_NOTARY_SIGNATURE:
                {
                    validEval = this.vData && this.vData.length > 0;
                }
        }
        return (validEval &&
            this.version > 0 &&
            this.version < 4 &&
            ((this.version < 3 && this.evalCode < 2) || (this.evalCode <= 26 && this.m <= this.n)));
    };
    OptCCParams.fromChunk = function (chunk) {
        var writer = new bufferutils.BufferWriter(Buffer.alloc(varuint.encodingLength(chunk.length)), 0);
        writer.writeVarInt(chunk.length);
        var params = new OptCCParams();
        params.fromBuffer(Buffer.concat([writer.buffer, chunk]));
        return params;
    };
    OptCCParams.prototype.toChunk = function () {
        return this.toBuffer(undefined, undefined, true);
    };
    OptCCParams.prototype.fromBuffer = function (buffer, initialOffset) {
        if (initialOffset === void 0) { initialOffset = 0; }
        // the first element in this buffer will be a script to decompile and get pushed data from
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
        var scriptInVector = readVarSlice();
        var chunks = bscript.decompile(scriptInVector);
        if (chunks[0].length !== 4) {
            // invalid optional parameters header
            this.version = 0;
            this.error = new Error('invalid optional parameters header');
            return initialOffset;
        }
        this.version = chunks[0].readUInt8(0);
        this.evalCode = chunks[0].readUInt8(1);
        this.m = chunks[0].readUInt8(2);
        this.n = chunks[0].readUInt8(3);
        // now, we should have n keys followed by data objects for later versions, otherwise all keys and one data object
        if (this.version <= 0 ||
            this.version > 3 ||
            this.evalCode < 0 ||
            this.evalCode > 0x1a || // this is the last valid eval code as of version 3
            (this.version < 3 && this.n < 1) ||
            this.n > 4 ||
            (this.version < 3 && this.n >= chunks.length) ||
            this.n > chunks.length) {
            // invalid header values
            this.version = 0;
            this.error = new Error('invalid header values');
            return initialOffset;
        }
        // now, we have chunks left that are either destinations or data vectors
        var limit = this.n === chunks.length ? this.n : this.n + 1;
        this.destinations = [];
        var loop;
        for (loop = 1; this.version && loop < limit; loop++) {
            var oneDest = TxDestination.fromChunk(chunks[loop]);
            if (oneDest.isValid()) {
                this.destinations.push(oneDest);
            }
            else {
                this.version = 0;
                this.error = new Error('invalid destination');
                return initialOffset;
            }
        }
        for (; this.version && loop < chunks.length; loop++) {
            this.vData.push(chunks[loop]); // is this an issue to just store as is for the data?
        }
        return offset;
    };
    OptCCParams.prototype.__byteLength = function () {
        var chunks = [Buffer.allocUnsafe(4)];
        chunks[0][0] = this.version;
        chunks[0][1] = this.evalCode;
        chunks[0][2] = this.m;
        chunks[0][3] = this.n;
        this.destinations.forEach(function (x) {
            chunks.push(Buffer.allocUnsafe(x.__byteLength()));
            x.toBuffer(chunks[chunks.length - 1]);
        });
        this.vData.forEach(function (x) {
            chunks.push(x);
        });
        return varSliceSize(bscript.compile(chunks));
    };
    OptCCParams.prototype.toBuffer = function (buffer, initialOffset, asChunk) {
        if (asChunk === void 0) { asChunk = false; }
        var offset = initialOffset || 0;
        function writeSlice(slice) { offset += slice.copy(buffer, offset); }
        function writeVarInt(i) {
            varuint.encode(i, buffer, offset);
            offset += varuint.encode.bytes;
        }
        function writeVarSlice(slice) { writeVarInt(slice.length); writeSlice(slice); }
        var chunks = [Buffer.allocUnsafe(4)];
        chunks[0][0] = this.version;
        chunks[0][1] = this.evalCode;
        chunks[0][2] = this.m;
        chunks[0][3] = this.n;
        this.destinations.forEach(function (x) {
            chunks.push(x.toChunk());
        });
        this.vData.forEach(function (x) {
            chunks.push(x);
        });
        var scriptStore = bscript.compile(chunks);
        if (!buffer)
            buffer = Buffer.allocUnsafe(asChunk ? scriptStore.length : varSliceSize(scriptStore));
        if (asChunk) {
            writeSlice(scriptStore);
        }
        else {
            writeVarSlice(scriptStore);
        }
        // avoid slicing unless necessary
        if (initialOffset !== undefined)
            return buffer.slice(initialOffset, offset);
        // TODO (https://github.com/BitGo/bitgo-utxo-lib/issues/11): we shouldn't have to slice the final buffer
        return buffer.slice(0, offset);
    };
    return OptCCParams;
}());
module.exports = OptCCParams;
