"use strict";
exports.__esModule = true;
exports.getFundedTxBuilder = exports.completeFundedIdentityUpdate = exports.createUnfundedIdentityUpdate = exports.createUnfundedCurrencyTransfer = exports.validateFundedCurrencyTransfer = exports.unpackOutput = void 0;
var verus_typescript_primitives_1 = require("verus-typescript-primitives");
var bn_js_1 = require("bn.js");
var Transaction = require('./transaction.js');
var TransactionBuilder = require('./transaction_builder.js');
var TxDestination = require('./tx_destination.js');
var script = require('./script.js');
var opcodes = require('bitcoin-ops');
var OptCCParams = require('./optccparams');
var templates = require('./templates');
// Hack to force BigNumber to get typeof class instead of BN namespace
var BNClass = new bn_js_1.BN(0);
var unpackOutput = function (output, systemId, isInput, allowNonTransferEvals) {
    var _a, _b;
    if (isInput === void 0) { isInput = false; }
    if (allowNonTransferEvals === void 0) { allowNonTransferEvals = false; }
    // Verify change output
    var outputScript = output.script;
    var outputType = templates.classifyOutput(outputScript);
    var values = (_a = {}, _a[systemId] = new bn_js_1.BN(0), _a);
    var fees = (_b = {}, _b[systemId] = new bn_js_1.BN(0), _b);
    var destinations = [];
    var master;
    var params = [];
    if (outputType === templates.types.P2PK && isInput) {
        values[systemId] = values[systemId].add(new bn_js_1.BN(output.value));
    }
    else if (outputType === templates.types.P2PKH) {
        var destAddr = verus_typescript_primitives_1.toBase58Check(templates.pubKeyHash.output.decode(outputScript), 60);
        values[systemId] = values[systemId].add(new bn_js_1.BN(output.value));
        destinations.push(destAddr);
    }
    else if (outputType === templates.types.SMART_TRANSACTION) {
        var masterOptCC = void 0;
        var paramsOptCC = [];
        var decompiledScript = script.decompile(outputScript);
        for (var i = 0; i < decompiledScript.length; i += 2) {
            if (i === 0)
                masterOptCC = OptCCParams.fromChunk(decompiledScript[i]);
            else
                paramsOptCC.push(OptCCParams.fromChunk(decompiledScript[i]));
        }
        if (paramsOptCC.length > 1)
            throw new Error(">1 OptCCParam objects not currently supported for smart transaction params.");
        var processDestination_1 = function (destination) {
            if (!(destination.destType === 1 && isInput) &&
                destination.destType !== 2 &&
                destination.destType !== 4) {
                throw new Error("Unsupported destination type");
            }
            var destAddr = verus_typescript_primitives_1.toBase58Check(destination.destinationBytes, destination.destType === 2 ? 60 : 102);
            if (!destinations.includes(destAddr)) {
                destinations.push(destAddr);
            }
        };
        var processOptCCParam = function (ccparam) {
            var _a, _b;
            var data;
            var ccvalues = (_a = {}, _a[systemId] = new bn_js_1.BN(0), _a);
            var ccfees = (_b = {}, _b[systemId] = new bn_js_1.BN(0), _b);
            switch (ccparam.evalCode) {
                case verus_typescript_primitives_1.EVALS.EVAL_NONE:
                    if (ccparam.vData.length !== 0) {
                        throw new Error("Unexpected length of vdata array for eval code " + ccparam.evalCode);
                    }
                    ccvalues[systemId] = ccvalues[systemId].add(new bn_js_1.BN(output.value));
                    break;
                case verus_typescript_primitives_1.EVALS.EVAL_STAKEGUARD:
                    if (!isInput) {
                        throw new Error("Cannot create stakeguard output.");
                    }
                    ccvalues[systemId] = ccvalues[systemId].add(new bn_js_1.BN(output.value));
                    break;
                case verus_typescript_primitives_1.EVALS.EVAL_RESERVE_TRANSFER:
                    if (ccparam.vData.length !== 1) {
                        throw new Error("Unexpected length of vdata array for eval code " + ccparam.evalCode);
                    }
                    var resTransfer = new verus_typescript_primitives_1.ReserveTransfer();
                    resTransfer.fromBuffer(ccparam.vData[0]);
                    ccvalues[systemId] = ccvalues[systemId].add(new bn_js_1.BN(output.value));
                    resTransfer.reserve_values.value_map.forEach(function (value, key) {
                        if (key !== systemId) {
                            if (!ccvalues[key])
                                ccvalues[key] = value;
                            else
                                ccvalues[key] = ccvalues[key].add(value);
                        }
                    });
                    data = resTransfer;
                    var fee = resTransfer.fee_amount;
                    var feecurrency = resTransfer.fee_currency_id;
                    ccfees[feecurrency] = fee;
                    if (resTransfer.transfer_destination.fees != null) {
                        ccfees[feecurrency] = ccfees[feecurrency].add(resTransfer.transfer_destination.fees);
                    }
                    for (var _i = 0, _c = resTransfer.transfer_destination.aux_dests; _i < _c.length; _i++) {
                        var aux_dest = _c[_i];
                        if (aux_dest.hasAuxDests()) {
                            throw new Error("Nested aux destinations not supported");
                        }
                        if (aux_dest.fees != null) {
                            ccfees[feecurrency] = ccfees[feecurrency].add(aux_dest.fees);
                        }
                        processDestination_1({
                            destType: aux_dest.typeNoFlags().toNumber(),
                            destinationBytes: aux_dest.destination_bytes
                        });
                    }
                    break;
                case verus_typescript_primitives_1.EVALS.EVAL_RESERVE_OUTPUT:
                    if (ccparam.vData.length !== 1) {
                        throw new Error("Unexpected length of vdata array for eval code " + ccparam.evalCode);
                    }
                    var resOutput = new verus_typescript_primitives_1.TokenOutput();
                    resOutput.fromBuffer(ccparam.vData[0]);
                    ccvalues[systemId] = ccvalues[systemId].add(new bn_js_1.BN(output.value));
                    resOutput.reserve_values.value_map.forEach(function (value, key) {
                        if (key !== systemId) {
                            if (!ccvalues[key])
                                ccvalues[key] = value;
                            else
                                ccvalues[key] = ccvalues[key].add(value);
                        }
                    });
                    data = resOutput;
                    break;
                case verus_typescript_primitives_1.EVALS.EVAL_IDENTITY_PRIMARY:
                    if (allowNonTransferEvals) {
                        ccvalues[systemId] = ccvalues[systemId].add(new bn_js_1.BN(output.value));
                        var id = new verus_typescript_primitives_1.Identity();
                        id.fromBuffer(ccparam.vData[0]);
                        data = id;
                    }
                    else {
                        throw new Error('EVAL_IDENTITY_PRIMARY not permitted in this context.');
                    }
                    break;
                default:
                    throw new Error("Unsupported eval code " + ccparam.evalCode);
            }
            return {
                version: ccparam.version,
                eval: ccparam.evalCode,
                m: ccparam.m,
                n: ccparam.n,
                data: data,
                values: ccvalues,
                fees: ccfees
            };
        };
        master = processOptCCParam(masterOptCC);
        for (var _i = 0, _c = masterOptCC.destinations; _i < _c.length; _i++) {
            var destination = _c[_i];
            processDestination_1(destination);
        }
        for (var _d = 0, paramsOptCC_1 = paramsOptCC; _d < paramsOptCC_1.length; _d++) {
            var paramsCc = paramsOptCC_1[_d];
            var processedParams = processOptCCParam(paramsCc);
            params.push(processedParams);
            for (var key in processedParams.values) {
                var value = processedParams.values[key];
                if (!values[key])
                    values[key] = value;
                else
                    values[key] = values[key].add(value);
            }
            for (var key in processedParams.fees) {
                var fee = processedParams.fees[key];
                if (!fees[key])
                    fees[key] = fee;
                else
                    fees[key] = fees[key].add(fee);
            }
            for (var _e = 0, _f = paramsCc.destinations; _e < _f.length; _e++) {
                var destination = _f[_e];
                processDestination_1(destination);
            }
        }
    }
    else {
        throw new Error("Unsupported output type " + outputType);
    }
    return {
        destinations: destinations,
        values: values,
        fees: fees,
        type: outputType,
        master: master,
        params: params.length > 0 ? params : undefined
    };
};
exports.unpackOutput = unpackOutput;
var validateFundedCurrencyTransfer = function (systemId, fundedTxHex, unfundedTxHex, changeAddr, network, utxoList) {
    var _a, _b, _c, _d;
    var amountsIn = (_a = {}, _a[systemId] = new bn_js_1.BN(0), _a);
    var amountsOut = (_b = {}, _b[systemId] = new bn_js_1.BN(0), _b);
    var amountChange = (_c = {}, _c[systemId] = new bn_js_1.BN(0), _c);
    var amountsFee = (_d = {}, _d[systemId] = new bn_js_1.BN(0), _d);
    var fundedTx = Transaction.fromHex(fundedTxHex, network);
    var unfundedTx = Transaction.fromHex(unfundedTxHex, network);
    var fundedTxComparison = Transaction.fromHex(fundedTxHex, network);
    if (!fundedTxComparison.ins.length) {
        return {
            valid: false,
            message: "Transaction has " + fundedTxComparison.ins.length + " inputs."
        };
    }
    fundedTxComparison.ins = [];
    fundedTx.outs = fundedTx.outs;
    unfundedTx.outs = unfundedTx.outs;
    fundedTxComparison.outs = fundedTxComparison.outs;
    fundedTx.ins = fundedTx.ins;
    unfundedTx.ins = unfundedTx.ins;
    fundedTxComparison.ins = fundedTxComparison.ins;
    var changeOutputs = [];
    var changeIndices = [];
    if (!fundedTxComparison.outs.length) {
        return {
            valid: false,
            message: "Transaction has " + fundedTxComparison.outs.length + " outputs."
        };
    }
    // Find all change outputs
    for (var i = 0, j = 0; i < fundedTxComparison.outs.length; i++, j++) {
        var out = fundedTxComparison.outs[i];
        var outScript = out.script.toString('hex');
        if (unfundedTx.outs[j] != null &&
            outScript === unfundedTx.outs[j].script.toString('hex') &&
            out.value === unfundedTx.outs[j].value) {
            continue;
        }
        else {
            changeOutputs.push(out);
            changeIndices.push(i);
            j--;
        }
    }
    // Filter change outputs from tx comparison
    fundedTxComparison.outs = fundedTxComparison.outs.filter(function (x, i) {
        return !changeIndices.includes(i);
    });
    // Verify funded tx and unfunded tx are the same where 
    // they should be the same
    if (fundedTxComparison.toHex() !== unfundedTx.toHex()) {
        return {
            valid: false,
            message: "Transaction hex does not match unfunded component."
        };
    }
    var _loop_1 = function (input) {
        var inputHash = Buffer.from(input.hash).reverse().toString('hex');
        var inputUtxoIndex = utxoList.findIndex(function (x) { return ((x.txid === inputHash) && x.outputIndex === input.index); });
        if (inputUtxoIndex < 0) {
            return { value: {
                    valid: false,
                    message: "Cannot find corresponding input for " + inputHash + " index " + input.index + "."
                } };
        }
        var inputUtxo = utxoList[inputUtxoIndex];
        var _script = Buffer.from(inputUtxo.script, 'hex');
        var _value = inputUtxo.satoshis;
        try {
            var inputInfo = exports.unpackOutput({ value: _value, script: _script }, systemId, true);
            for (var key in inputInfo.values) {
                if (amountsIn[key] == null) {
                    amountsIn[key] = new bn_js_1.BN(inputInfo.values[key] != null ? inputInfo.values[key] : 0);
                }
                else
                    amountsIn[key] = amountsIn[key].add(inputInfo.values[key]);
            }
        }
        catch (e) {
            return { value: {
                    valid: false,
                    message: e.message
                } };
        }
    };
    // Verify all inputs are correct and count their amounts
    for (var _i = 0, _e = fundedTx.ins; _i < _e.length; _i++) {
        var input = _e[_i];
        var state_1 = _loop_1(input);
        if (typeof state_1 === "object")
            return state_1.value;
    }
    // Count output amounts (trusted more than input because we verify that they match
    // the outputs submitted in the unfunded transaction)
    for (var i = 0; i < unfundedTx.outs.length; i++) {
        var output = unfundedTx.outs[i];
        try {
            var outputInfo = exports.unpackOutput(output, systemId, false, true);
            for (var key in outputInfo.values) {
                if (amountsOut[key] == null) {
                    amountsOut[key] = new bn_js_1.BN(outputInfo.values[key] != null ? outputInfo.values[key] : 0);
                }
                else
                    amountsOut[key] = amountsOut[key].add(outputInfo.values[key]);
            }
            for (var key in outputInfo.fees) {
                if (amountsFee[key] == null) {
                    amountsFee[key] = new bn_js_1.BN(outputInfo.fees[key] != null ? outputInfo.fees[key] : 0);
                }
                else
                    amountsFee[key] = amountsFee[key].add(outputInfo.fees[key]);
            }
        }
        catch (e) {
            return {
                valid: false,
                message: e.message
            };
        }
    }
    // Ensure change amounts go to correct destination
    for (var i = 0; i < changeOutputs.length; i++) {
        var output = changeOutputs[i];
        try {
            var outputInfo = exports.unpackOutput(output, systemId);
            if (outputInfo.type !== templates.types.P2PKH && outputInfo.type !== templates.types.SMART_TRANSACTION) {
                throw new Error("Cannot use non p2pkh/smarttx utxo type as change.");
            }
            if (outputInfo.destinations.filter(function (x) { return x !== changeAddr; }).length !== 0) {
                throw new Error("Some change destinations are not " + changeAddr + ".");
            }
            if (outputInfo.type === templates.types.SMART_TRANSACTION) {
                if (outputInfo.params.length !== 1)
                    throw new Error("Invalid param length for change smarttx");
                var master = outputInfo.master;
                var param = outputInfo.params[0];
                if (master.eval !== verus_typescript_primitives_1.EVALS.EVAL_NONE) {
                    throw new Error("Change smartx master must be EVAL_NONE");
                }
                if (!((master.m === 0 && master.n === 0 || master.m === 1 && master.n === 1) &&
                    param.m === 1 && param.n === 1)) {
                    throw new Error("Multisig change unsupported");
                }
                switch (param.eval) {
                    case verus_typescript_primitives_1.EVALS.EVAL_NONE:
                    case verus_typescript_primitives_1.EVALS.EVAL_RESERVE_OUTPUT:
                        break;
                    default:
                        throw new Error("Change only supports EVAL_NONE and EVAL_RESERVE_OUTPUT smarttxs");
                }
            }
            for (var key in outputInfo.values) {
                if (amountsOut[key] == null)
                    amountsOut[key] = new bn_js_1.BN(outputInfo.values[key] != null ? outputInfo.values[key] : 0);
                else
                    amountsOut[key] = amountsOut[key].add(outputInfo.values[key]);
                if (amountChange[key] == null)
                    amountChange[key] = new bn_js_1.BN(outputInfo.values[key] != null ? outputInfo.values[key] : 0);
                else
                    amountChange[key] = amountChange[key].add(outputInfo.values[key]);
            }
        }
        catch (e) {
            return {
                valid: false,
                message: e.message
            };
        }
    }
    var _in = {};
    var _out = {};
    var _change = {};
    var _fees = {};
    var _sent = {};
    for (var key in amountsIn) {
        _in[key] = amountsIn[key].toString();
    }
    for (var key in amountsOut) {
        _out[key] = amountsOut[key].toString();
    }
    for (var key in amountsFee) {
        _fees[key] = amountsFee[key].toString();
    }
    for (var key in amountChange) {
        _change[key] = amountChange[key].toString();
    }
    for (var key in amountsIn) {
        var outVal = amountsOut[key] != null ? amountsOut[key] : new bn_js_1.BN(0);
        var feeVal = _fees[key] ? new bn_js_1.BN(_fees[key]) : new bn_js_1.BN(0);
        _fees[key] = (feeVal.add((amountsIn[key].sub(outVal)))).toString();
    }
    for (var key in amountsIn) {
        var changeVal = amountChange[key] != null ? amountChange[key] : new bn_js_1.BN(0);
        var feeVal = _fees[key] ? new bn_js_1.BN(_fees[key]) : new bn_js_1.BN(0);
        _sent[key] = (amountsIn[key].sub(changeVal).sub(feeVal)).toString();
    }
    return { valid: true, "in": _in, out: _out, change: _change, fees: _fees, sent: _sent };
};
exports.validateFundedCurrencyTransfer = validateFundedCurrencyTransfer;
var createUnfundedCurrencyTransfer = function (systemId, outputs, network, expiryHeight, version, versionGroupId) {
    if (expiryHeight === void 0) { expiryHeight = 0; }
    if (version === void 0) { version = 4; }
    if (versionGroupId === void 0) { versionGroupId = 0x892f2085; }
    var txb = new TransactionBuilder(network);
    txb.setVersion(version);
    txb.setExpiryHeight(expiryHeight);
    txb.setVersionGroupId(versionGroupId);
    for (var _i = 0, outputs_1 = outputs; _i < outputs_1.length; _i++) {
        var output = outputs_1[_i];
        if (!output.currency)
            throw new Error("Must specify currency i-address for all outputs");
        if (output.satoshis == null)
            throw new Error("Must specify satoshis for all outputs");
        if (output.address == null)
            throw new Error("Must specify address for all outputs");
        var params = {
            currency: output.currency,
            satoshis: output.satoshis,
            convertto: output.convertto ? output.convertto : output.currency,
            exportto: output.exportto,
            feecurrency: output.feecurrency ? output.feecurrency : systemId,
            feesatoshis: output.feesatoshis ? output.feesatoshis : "300000",
            via: output.via,
            address: output.address,
            refundto: output.refundto,
            preconvert: !!(output.preconvert),
            burnweight: !!(output.burnweight),
            burn: !!(output.burn),
            mintnew: !!(output.mintnew),
            importtosource: !!(output.importtosource),
            bridgeid: output.bridgeid
        };
        // fee_currency_id?: string;
        // fee_amount?: BigNumber;
        // transfer_destination?: TransferDestination;
        // dest_currency_id?: string;
        // second_reserve_id?: string;
        // dest_system_id?: string;
        var isReserveTransfer = output.feecurrency != null ||
            output.feesatoshis != null ||
            output.convertto != null ||
            output.exportto != null ||
            output.via != null;
        var satoshis = new bn_js_1.BN(params.satoshis, 10);
        var values = new verus_typescript_primitives_1.CurrencyValueMap({
            value_map: new Map([[params.currency, satoshis]]),
            multivalue: false
        });
        var nativeFeeValue = params.feecurrency === systemId && isReserveTransfer ? new bn_js_1.BN(params.feesatoshis) : new bn_js_1.BN(0);
        var nativeValue = params.currency === systemId ? satoshis.add(nativeFeeValue) : nativeFeeValue;
        var isPKH = !isReserveTransfer && params.currency === systemId && params.address.type.eq(verus_typescript_primitives_1.DEST_PKH);
        if (isPKH) {
            txb.addOutput(params.address.getAddressString(), nativeValue.toNumber());
        }
        else {
            var outMaster = void 0;
            var outParams = void 0;
            if (isReserveTransfer) {
                var destination = new TxDestination(verus_typescript_primitives_1.RESERVE_TRANSFER_DESTINATION.type.toNumber(), verus_typescript_primitives_1.RESERVE_TRANSFER_DESTINATION.destination_bytes);
                outMaster = new OptCCParams(3, verus_typescript_primitives_1.EVALS.EVAL_NONE, 1, 1, [destination]);
                var flags = new bn_js_1.BN(1);
                var version_1 = new bn_js_1.BN(1, 10);
                var isConversion = params.convertto != null && params.convertto !== params.currency;
                if (params.importtosource)
                    flags = flags.xor(verus_typescript_primitives_1.RESERVE_TRANSFER_IMPORT_TO_SOURCE);
                if (params.via != null)
                    flags = flags.xor(verus_typescript_primitives_1.RESERVE_TRANSFER_RESERVE_TO_RESERVE);
                if (params.exportto != null)
                    flags = flags.xor(verus_typescript_primitives_1.RESERVE_TRANSFER_CROSS_SYSTEM);
                if (isConversion)
                    flags = flags.xor(verus_typescript_primitives_1.RESERVE_TRANSFER_CONVERT);
                if (params.preconvert)
                    flags = flags.xor(verus_typescript_primitives_1.RESERVE_TRANSFER_PRECONVERT);
                if (params.mintnew)
                    flags = flags.xor(verus_typescript_primitives_1.RESERVE_TRANSFER_MINT_CURRENCY);
                if (params.burn)
                    flags = flags.xor(verus_typescript_primitives_1.RESERVE_TRANSFER_BURN_CHANGE_PRICE);
                if (params.burnweight)
                    flags = flags.xor(verus_typescript_primitives_1.RESERVE_TRANSFER_BURN_CHANGE_WEIGHT);
                var ignoreBridgeId = (isConversion || params.exportto == null);
                if (!ignoreBridgeId && params.bridgeid == null) {
                    throw new Error("Bridge ID required");
                }
                var resTransfer = new verus_typescript_primitives_1.ReserveTransfer({
                    values: values,
                    version: version_1,
                    flags: flags,
                    fee_currency_id: params.feecurrency,
                    fee_amount: new bn_js_1.BN(params.feesatoshis, 10),
                    transfer_destination: params.address,
                    dest_currency_id: output.via ? output.via
                        :
                            (isConversion || params.exportto == null) ? params.convertto : params.bridgeid,
                    second_reserve_id: params.convertto,
                    dest_system_id: params.exportto
                });
                outParams = new OptCCParams(3, verus_typescript_primitives_1.EVALS.EVAL_RESERVE_TRANSFER, 1, 1, [destination], [resTransfer.toBuffer()]);
            }
            else {
                values.value_map["delete"](systemId);
                if (values.value_map.size == 0) {
                    var destination = new TxDestination(params.address.type.toNumber(), params.address.destination_bytes);
                    // Assume token output
                    outMaster = new OptCCParams(3, verus_typescript_primitives_1.EVALS.EVAL_NONE, 0, 0, []);
                    outParams = new OptCCParams(3, verus_typescript_primitives_1.EVALS.EVAL_NONE, 1, 1, [destination], []);
                }
                else {
                    var destination = new TxDestination(params.address.type.toNumber(), params.address.destination_bytes);
                    // Assume token output
                    outMaster = new OptCCParams(3, verus_typescript_primitives_1.EVALS.EVAL_NONE, 1, 1, [destination]);
                    var version_2 = new bn_js_1.BN(1, 10);
                    var tokenOutput = new verus_typescript_primitives_1.TokenOutput({
                        values: values,
                        version: version_2
                    });
                    outParams = new OptCCParams(3, verus_typescript_primitives_1.EVALS.EVAL_RESERVE_OUTPUT, 1, 1, [destination], [tokenOutput.toBuffer()]);
                }
            }
            var outputScript = script.compile([
                outMaster.toChunk(),
                opcodes.OP_CHECKCRYPTOCONDITION,
                outParams.toChunk(),
                opcodes.OP_DROP,
            ]);
            txb.addOutput(outputScript, nativeValue.toNumber());
        }
    }
    return txb.buildIncomplete().toHex();
};
exports.createUnfundedCurrencyTransfer = createUnfundedCurrencyTransfer;
var createUnfundedIdentityUpdate = function (identity, network, expiryHeight, version, versionGroupId) {
    if (expiryHeight === void 0) { expiryHeight = 0; }
    if (version === void 0) { version = 4; }
    if (versionGroupId === void 0) { versionGroupId = 0x892f2085; }
    var txb = new TransactionBuilder(network);
    txb.setVersion(version);
    txb.setExpiryHeight(expiryHeight);
    txb.setVersionGroupId(versionGroupId);
    var outputScript = verus_typescript_primitives_1.IdentityScript.fromIdentity(identity).toBuffer();
    txb.addOutput(outputScript, 0);
    return txb.buildIncomplete().toHex();
};
exports.createUnfundedIdentityUpdate = createUnfundedIdentityUpdate;
var completeFundedIdentityUpdate = function (fundedTxHex, network, prevOutScripts, prevIdentityOutput) {
    var txb = exports.getFundedTxBuilder(fundedTxHex, network, prevOutScripts);
    txb.addInput(prevIdentityOutput.hash, prevIdentityOutput.index, prevIdentityOutput.sequence, prevIdentityOutput.script);
    return txb.buildIncomplete().toHex();
};
exports.completeFundedIdentityUpdate = completeFundedIdentityUpdate;
var getFundedTxBuilder = function (fundedTxHex, network, prevOutScripts) {
    var tx = Transaction.fromHex(fundedTxHex, network);
    var inputs = tx.ins;
    var txb = TransactionBuilder.fromTransaction(tx, network);
    txb.inputs = [];
    txb.tx.ins = [];
    for (var i = 0; i < inputs.length; i++) {
        var input = inputs[i];
        var prevoutscript = prevOutScripts[i];
        delete txb.prevTxMap[input.hash.toString('hex') + ':' + input.index];
        txb.addInput(input.hash, input.index, input.sequence, prevoutscript);
    }
    return txb;
};
exports.getFundedTxBuilder = getFundedTxBuilder;
