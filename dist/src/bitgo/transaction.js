"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTransactionFromBuffer = createTransactionFromBuffer;
exports.createTransactionFromHex = createTransactionFromHex;
exports.createTransactionBuilderForNetwork = createTransactionBuilderForNetwork;
exports.createTransactionBuilderFromTransaction = createTransactionBuilderFromTransaction;
exports.createTransactionForNetwork = createTransactionForNetwork;
/**
 * @prettier
 */
var networks = require("../networks");
var coins_1 = require("../coins");
var Transaction = require('../transaction');
var TransactionBuilder = require('../transaction_builder');
function createTransactionFromBuffer(buf, network) {
    switch ((0, coins_1.getMainnet)(network)) {
        case networks.bitcoin:
        case networks.bitcoincash:
        case networks.bitcoinsv:
        case networks.bitcoingold:
        case networks.dash:
        case networks.litecoin:
        case networks.zcash:
            return Transaction.fromBuffer(buf, network);
    }
    /* istanbul ignore next */
    throw new Error("invalid network");
}
function createTransactionFromHex(hex, network) {
    return createTransactionFromBuffer(Buffer.from(hex, 'hex'), network);
}
function createTransactionBuilderForNetwork(network) {
    switch ((0, coins_1.getMainnet)(network)) {
        case networks.bitcoin:
        case networks.bitcoincash:
        case networks.bitcoinsv:
        case networks.bitcoingold:
        case networks.dash:
        case networks.litecoin: {
            var txb = new TransactionBuilder(network);
            switch ((0, coins_1.getMainnet)(network)) {
                case networks.bitcoincash:
                case networks.bitcoinsv:
                    txb.setVersion(2);
            }
            return txb;
        }
        case networks.zcash: {
            var txb = new TransactionBuilder(network);
            txb.setVersion(4);
            txb.setVersionGroupId(0x892f2085);
            // Use "Canopy" consensus branch ID https://zips.z.cash/zip-0251
            txb.setConsensusBranchId(0xc2d6d0b4);
            return txb;
        }
    }
    /* istanbul ignore next */
    throw new Error("invalid network");
}
function createTransactionBuilderFromTransaction(tx) {
    switch ((0, coins_1.getMainnet)(tx.network)) {
        case networks.bitcoin:
        case networks.bitcoincash:
        case networks.bitcoinsv:
        case networks.bitcoingold:
        case networks.dash:
        case networks.litecoin:
        case networks.zcash:
            return TransactionBuilder.fromTransaction(tx, tx.network);
    }
    /* istanbul ignore next */
    throw new Error("invalid network");
}
function createTransactionForNetwork(network) {
    switch ((0, coins_1.getMainnet)(network)) {
        case networks.bitcoin:
        case networks.bitcoincash:
        case networks.bitcoinsv:
        case networks.bitcoingold:
        case networks.dash:
        case networks.litecoin:
        case networks.zcash:
            return new Transaction(network);
    }
    /* istanbul ignore next */
    throw new Error("invalid network");
}
