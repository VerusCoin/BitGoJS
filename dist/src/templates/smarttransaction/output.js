// m [pubKeys ...] n OP_CHECKMULTISIG
var bscript = require('../../script');
var types = require('../../types');
var typeforce = require('typeforce');
var OPS = require('bitcoin-ops');
const OptCCParams = require('../../optccparams');
var OP_INT_BASE = OPS.OP_RESERVED; // OP_1 - 1
function check(script) {
    var chunks = bscript.decompile(script);
    // chunks for a smart transaction should include a push of either a CC or empty/master COptCCParams, then an OP_CHECKCRYPTOCONDITION,
    // then a potentially nested COptCCParams
    // we always start by decoding the second COptCCParams first to determine if the first one should be an opaque CC, as it was
    // in earlier versions. if not, it is added to the end of the data objects of the first params
    if (chunks.length < 4 ||
        !(chunks[chunks.length - 1] === OPS.OP_DROP && chunks[1] === OPS.OP_CHECKCRYPTOCONDITION)) {
        return false;
    }
    const params = OptCCParams.fromChunk(chunks[2]);
    const master = OptCCParams.fromChunk(chunks[0]);
    if (!params.isValid() || !master.isValid()) {
        return false;
    }
    // now validate eval codes, object presence, currencies, types, etc.
    return true;
}
check.toJSON = function () { return 'smart transaction output'; };
function encode(m, pubKeys) {
    typeforce({
        m: types.Number,
        pubKeys: [bscript.isCanonicalPubKey]
    }, {
        m: m,
        pubKeys: pubKeys
    });
    var n = pubKeys.length;
    if (n < m)
        throw new TypeError('Not enough pubKeys provided');
    return bscript.compile([].concat(OP_INT_BASE + m, pubKeys, OP_INT_BASE + n, OPS.OP_CHECKMULTISIG));
}
function decode(buffer, allowIncomplete) {
    var chunks = bscript.decompile(buffer);
    typeforce(check, chunks, allowIncomplete);
    return {
        m: chunks[0] - OP_INT_BASE,
        pubKeys: chunks.slice(1, -2)
    };
}
module.exports = {
    check: check,
    decode: decode,
    encode: encode
};
