"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSignatureScript = exports.verifySignature = exports.getDefaultSigHash = exports.outputScripts = exports.keyutil = void 0;
exports.keyutil = require("./keyutil");
exports.outputScripts = require("./outputScripts");
var signature_1 = require("./signature");
Object.defineProperty(exports, "getDefaultSigHash", { enumerable: true, get: function () { return signature_1.getDefaultSigHash; } });
Object.defineProperty(exports, "verifySignature", { enumerable: true, get: function () { return signature_1.verifySignature; } });
Object.defineProperty(exports, "parseSignatureScript", { enumerable: true, get: function () { return signature_1.parseSignatureScript; } });
__exportStar(require("./transaction"), exports);
