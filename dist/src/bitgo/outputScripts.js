"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scriptTypes2Of3 = void 0;
exports.isScriptType2Of3 = isScriptType2Of3;
exports.createOutputScript2of3 = createOutputScript2of3;
/**
 * @prettier
 */
var script = require("../script");
var crypto = require("../crypto");
exports.scriptTypes2Of3 = ['p2sh', 'p2shP2wsh', 'p2wsh'];
function isScriptType2Of3(t) {
    return exports.scriptTypes2Of3.includes(t);
}
/**
 * Return scripts for 2-of-3 multisig output
 * @param pubkeys - the key array for multisig
 * @param scriptType
 * @returns {{redeemScript, witnessScript, address}}
 */
function createOutputScript2of3(pubkeys, scriptType) {
    if (pubkeys.length !== 3) {
        throw new Error("must provide 3 pubkeys");
    }
    pubkeys.forEach(function (key) {
        if (key.length !== 33) {
            throw new Error("Unexpected key length ".concat(key.length, ". Must use compressed keys."));
        }
    });
    var script2of3 = script.multisig.output.encode(2, pubkeys);
    var p2wshOutputScript = script.witnessScriptHash.output.encode(crypto.sha256(script2of3));
    var redeemScript;
    var witnessScript;
    switch (scriptType) {
        case 'p2sh':
            redeemScript = script2of3;
            break;
        case 'p2shP2wsh':
            witnessScript = script2of3;
            redeemScript = p2wshOutputScript;
            break;
        case 'p2wsh':
            witnessScript = script2of3;
            break;
        default:
            throw new Error("unknown multisig script type ".concat(scriptType));
    }
    var scriptPubKey;
    if (scriptType === 'p2wsh') {
        scriptPubKey = p2wshOutputScript;
    }
    else {
        var redeemScriptHash = crypto.hash160(redeemScript);
        scriptPubKey = script.scriptHash.output.encode(redeemScriptHash);
    }
    return { redeemScript: redeemScript, witnessScript: witnessScript, scriptPubKey: scriptPubKey };
}
