import * as assert from 'assert';
import { Identity, IdentityScript } from 'verus-typescript-primitives';
import { createUnfundedIdentityUpdate, unpackOutput } from '../src/smart_transactions';
import networks = require('../src/networks');

const Transaction = require('../src/transaction.js');

describe('Verus primitives compatibility', function () {
  for (const count of [128, 253]) {
    it(`preserves an identity with ${count} content map entries through an update transaction`, function () {
      const contentmap: { [key: string]: string } = {};
      for (let i = 0; i < count; i++) {
        const key = Buffer.alloc(20);
        key.writeUInt32LE(i, 0);
        contentmap[key.toString('hex')] = Buffer.alloc(32, i).toString('hex');
      }

      const systemId = 'iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq';
      const identity = Identity.fromJson({
        version: 3,
        flags: 0,
        minimumsignatures: 1,
        name: 'Compatibility',
        parent: systemId,
        systemid: systemId,
        primaryaddresses: ['RKjVHqM4VF2pCfVcwGzKH7CxvfMUE4H6o8'],
        revocationauthority: 'iPsFBfFoCcxtuZNzE8yxPQhXVn4dmytf8j',
        recoveryauthority: 'iPsFBfFoCcxtuZNzE8yxPQhXVn4dmytf8j',
        timelock: 0,
        contentmap,
      });
      const identityHex = identity.toBuffer().toString('hex');

      // 128 differs between VARINT and CompactSize; 253 needs extended CompactSize.
      const transactionHex = createUnfundedIdentityUpdate(identityHex, networks.verustest);
      const transaction = Transaction.fromHex(transactionHex, networks.verustest);
      assert.strictEqual(transaction.outs.length, 1);
      assert.strictEqual(transaction.outs[0].value, 0);

      const output = unpackOutput(transaction.outs[0], systemId, false, true);
      const unpackedIdentity = output.params![0].data as Identity;
      assert.ok(unpackedIdentity instanceof Identity);
      assert.strictEqual(unpackedIdentity.contentMap.size, count);
      assert.deepStrictEqual(unpackedIdentity.contentMap, identity.contentMap);
      assert.strictEqual(unpackedIdentity.toBuffer().toString('hex'), identityHex);

      const identityScript = new IdentityScript();
      assert.strictEqual(identityScript.fromBuffer(transaction.outs[0].script), transaction.outs[0].script.length);
      assert.strictEqual(identityScript.getIdentity().toBuffer().toString('hex'), identityHex);
    });
  }
});
