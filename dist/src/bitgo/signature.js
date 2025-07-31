"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultSigHash = getDefaultSigHash;
exports.parseSignatureScript = parseSignatureScript;
exports.verifySignature = verifySignature;
/**
 * @prettier
 */
var opcodes = require('bitcoin-ops');
var script = require("../script");
var crypto = require("../crypto");
var ECPair = require("../ecpair");
var Transaction = require("../transaction");
var ECSignature = require("../ecsignature");
var networks = require("../networks");
var coins_1 = require("../coins");
var inputTypes = [
    'multisig',
    'nonstandard',
    'nulldata',
    'pubkey',
    'pubkeyhash',
    'scripthash',
    'witnesspubkeyhash',
    'witnessscripthash',
    'witnesscommitment',
];
function getDefaultSigHash(network) {
    switch ((0, coins_1.getMainnet)(network)) {
        case networks.bitcoincash:
        case networks.bitcoinsv:
        case networks.bitcoingold:
            return Transaction.SIGHASH_ALL | Transaction.SIGHASH_BITCOINCASHBIP143;
        default:
            return Transaction.SIGHASH_ALL;
    }
}
/**
 * Parse a transaction's signature script to obtain public keys, signatures, the sig script,
 * and other properties.
 *
 * Only supports script types used in BitGo transactions.
 *
 * @param input
 * @returns ParsedSignatureScript
 */
function parseSignatureScript(input) {
    var isSegwitInput = input.witness.length > 0;
    var isNativeSegwitInput = input.script.length === 0;
    var decompiledSigScript, inputClassification;
    if (isSegwitInput) {
        // The decompiledSigScript is the script containing the signatures, public keys, and the script that was committed
        // to (pubScript). If this is a segwit input the decompiledSigScript is in the witness, regardless of whether it
        // is native or not. The inputClassification is determined based on whether or not the input is native to give an
        // accurate classification. Note that p2shP2wsh inputs will be classified as p2sh and not p2wsh.
        decompiledSigScript = input.witness;
        if (isNativeSegwitInput) {
            inputClassification = script.classifyWitness(script.compile(decompiledSigScript), true);
        }
        else {
            inputClassification = script.classifyInput(input.script, true);
        }
    }
    else {
        inputClassification = script.classifyInput(input.script, true);
        decompiledSigScript = script.decompile(input.script);
    }
    if (inputClassification === script.types.P2PKH) {
        var signature = decompiledSigScript[0], publicKey = decompiledSigScript[1];
        var publicKeys_1 = [publicKey];
        var signatures_1 = [signature];
        var pubScript_1 = script.pubKeyHash.output.encode(crypto.hash160(publicKey));
        return { isSegwitInput: isSegwitInput, inputClassification: inputClassification, signatures: signatures_1, publicKeys: publicKeys_1, pubScript: pubScript_1 };
    }
    // Note the assumption here that if we have a p2sh or p2wsh input it will be multisig (appropriate because the
    // BitGo platform only supports multisig within these types of inputs). Signatures are all but the last entry in
    // the decompiledSigScript. The redeemScript/witnessScript (depending on which type of input this is) is the last
    // entry in the decompiledSigScript (denoted here as the pubScript). The public keys are the second through
    // antepenultimate entries in the decompiledPubScript. See below for a visual representation of the typical 2-of-3
    // multisig setup:
    //
    // decompiledSigScript = 0 <sig1> [<sig2>] <pubScript>
    // decompiledPubScript = 2 <pub1> <pub2> <pub3> 3 OP_CHECKMULTISIG
    var expectedScriptType = inputClassification === script.types.P2SH || inputClassification === script.types.P2WSH;
    var expectedScriptLength = decompiledSigScript.length === 4 || // single signature
        decompiledSigScript.length === 5; // double signature
    if (!expectedScriptType || !expectedScriptLength) {
        return { isSegwitInput: isSegwitInput, inputClassification: inputClassification };
    }
    var signatures = decompiledSigScript.slice(0, -1);
    var pubScript = decompiledSigScript[decompiledSigScript.length - 1];
    var decompiledPubScript = script.decompile(pubScript);
    if (decompiledPubScript.length !== 6) {
        throw new Error("unexpected decompiledPubScript length");
    }
    var publicKeys = decompiledPubScript.slice(1, -2);
    // Op codes 81 through 96 represent numbers 1 through 16 (see https://en.bitcoin.it/wiki/Script#Opcodes), which is
    // why we subtract by 80 to get the number of signatures (n) and the number of public keys (m) in an n-of-m setup.
    var len = decompiledPubScript.length;
    var nSignatures = decompiledPubScript[0] - 80;
    var nPubKeys = decompiledPubScript[len - 2] - 80;
    // Due to a bug in the implementation of multisignature in the bitcoin protocol, a 0 is added to the signature
    // script, so we add 1 when asserting the number of signatures matches the number of signatures expected by the
    // pub script. Also, note that we consider a signature script with the the same number of signatures as public
    // keys (+1 as noted above) valid because we use placeholder signatures when parsing a half-signed signature
    // script.
    if (signatures.length !== nSignatures + 1 && signatures.length !== nPubKeys + 1) {
        throw new Error("expected ".concat(nSignatures, " or ").concat(nPubKeys, " signatures, got ").concat(signatures.length - 1));
    }
    if (publicKeys.length !== nPubKeys) {
        throw new Error("expected ".concat(nPubKeys, " public keys, got ").concat(publicKeys.length));
    }
    var lastOpCode = decompiledPubScript[len - 1];
    if (lastOpCode !== opcodes.OP_CHECKMULTISIG) {
        throw new Error("expected opcode #".concat(opcodes.OP_CHECKMULTISIG, ", got opcode #").concat(lastOpCode));
    }
    return { isSegwitInput: isSegwitInput, inputClassification: inputClassification, signatures: signatures, publicKeys: publicKeys, pubScript: pubScript };
}
/**
 * Verify the signature on a (half-signed) transaction
 * @param transaction bitcoinjs-lib tx object
 * @param inputIndex The input whererfore to check the signature
 * @param amount For segwit and BCH, the input amount needs to be known for signature verification
 * @param verificationSettings
 * @param verificationSettings.signatureIndex The index of the signature to verify (only iterates over non-empty signatures)
 * @param verificationSettings.publicKey The hex of the public key to verify (will verify all signatures)
 * @returns {boolean}
 */
function verifySignature(transaction, inputIndex, amount, verificationSettings) {
    if (verificationSettings === void 0) { verificationSettings = {}; }
    if (typeof verificationSettings.publicKey === 'string') {
        return verifySignature(transaction, inputIndex, amount, {
            signatureIndex: verificationSettings.signatureIndex,
            publicKey: Buffer.from(verificationSettings.publicKey, 'hex'),
        });
    }
    /* istanbul ignore next */
    if (!transaction.ins) {
        throw new Error("invalid transaction");
    }
    var input = transaction.ins[inputIndex];
    /* istanbul ignore next */
    if (!input) {
        throw new Error("no input at index ".concat(inputIndex));
    }
    var _a = parseSignatureScript(input), signatures = _a.signatures, publicKeys = _a.publicKeys, isSegwitInput = _a.isSegwitInput, inputClassification = _a.inputClassification, pubScript = _a.pubScript;
    if (![script.types.P2WSH, script.types.P2SH, script.types.P2PKH].includes(inputClassification)) {
        return false;
    }
    if (!publicKeys || publicKeys.length === 0) {
        return false;
    }
    if (isSegwitInput && !amount) {
        return false;
    }
    if (!signatures) {
        return false;
    }
    // get the first non-empty signature and verify it against all public keys
    var nonEmptySignatures = signatures.filter(function (s) { return s.length > 0; });
    /*
    We either want to verify all signature/pubkey combinations, or do an explicit combination
  
    If a signature index is specified, only that signature is checked. It's verified against all public keys.
    If a single public key is found to be valid, the function returns true.
  
    If a public key is specified, we iterate over all signatures. If a single one matches the public key, the function
    returns true.
  
    If neither is specified, all signatures are checked against all public keys. Each signature must have its own distinct
    public key that it matches for the function to return true.
     */
    var signaturesToCheck = nonEmptySignatures;
    if (verificationSettings.signatureIndex !== undefined) {
        signaturesToCheck = [nonEmptySignatures[verificationSettings.signatureIndex]];
    }
    var areAllSignaturesValid = true;
    // go over all signatures
    for (var _i = 0, signaturesToCheck_1 = signaturesToCheck; _i < signaturesToCheck_1.length; _i++) {
        var signatureBuffer = signaturesToCheck_1[_i];
        var isSignatureValid = false;
        var hasSignatureBuffer = Buffer.isBuffer(signatureBuffer) && signatureBuffer.length > 0;
        if (hasSignatureBuffer && Buffer.isBuffer(pubScript) && pubScript.length > 0) {
            // slice the last byte from the signature hash input because it's the hash type
            var signature = ECSignature.fromDER(signatureBuffer.slice(0, -1));
            var hashType = signatureBuffer[signatureBuffer.length - 1];
            if (!hashType) {
                // missing hashType byte - signature cannot be validated
                return false;
            }
            var signatureHash = transaction.hashForSignatureByNetwork(inputIndex, pubScript, amount, hashType, isSegwitInput);
            var matchedPublicKeyIndices = (new Array(publicKeys.length)).fill(false);
            for (var publicKeyIndex = 0; publicKeyIndex < publicKeys.length; publicKeyIndex++) {
                var publicKeyBuffer = publicKeys[publicKeyIndex];
                if (verificationSettings.publicKey !== undefined && !publicKeyBuffer.equals(verificationSettings.publicKey)) {
                    // we are only looking to verify one specific public key's signature (publicKeyHex)
                    // this particular public key is not the one whose signature we're trying to verify
                    continue;
                }
                if (matchedPublicKeyIndices[publicKeyIndex]) {
                    continue;
                }
                var publicKey = ECPair.fromPublicKeyBuffer(publicKeyBuffer);
                if (publicKey.verify(signatureHash, signature)) {
                    isSignatureValid = true;
                    matchedPublicKeyIndices[publicKeyIndex] = true;
                    break;
                }
            }
        }
        if (verificationSettings.publicKey !== undefined && isSignatureValid) {
            // We were trying to see if any of the signatures was valid for the given public key. Evidently yes.
            return true;
        }
        if (!isSignatureValid && verificationSettings.publicKey === undefined) {
            return false;
        }
        areAllSignaturesValid = isSignatureValid && areAllSignaturesValid;
    }
    return areAllSignaturesValid;
}
