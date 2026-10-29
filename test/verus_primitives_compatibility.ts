import * as assert from 'assert';
import { Identity, IdentityScript, fromBase58Check } from 'verus-typescript-primitives';
import { createUnfundedIdentityUpdate, unpackOutput } from '../src/smart_transactions';
import networks = require('../src/networks');

const Transaction = require('../src/transaction.js');
const rootContextFixture = require('./fixtures/forks/verus/identity_root_context.json');

describe('Verus primitives compatibility', function () {
  for (const count of [128, 253]) {
    it(`preserves an identity with ${count} content map entries through an update transaction`, function () {
      const contentmap: { [key: string]: string } = {};
      for (let i = count - 1; i >= 0; i--) {
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
      const originalKeyOrder = Array.from(identity.contentMap.keys());
      const identityHex = identity.toBuffer().toString('hex');
      assert.deepStrictEqual(Array.from(identity.contentMap.keys()), originalKeyOrder);

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
      const canonicalKeyOrder = originalKeyOrder.slice().sort((a, b) =>
        fromBase58Check(a).hash.compare(fromBase58Check(b).hash));
      assert.deepStrictEqual(Array.from(unpackedIdentity.contentMap.keys()), canonicalKeyOrder);
      assert.strictEqual(unpackedIdentity.toBuffer().toString('hex'), identityHex);

      const identityScript = new IdentityScript();
      assert.strictEqual(identityScript.fromBuffer(transaction.outs[0].script), transaction.outs[0].script.length);
      assert.strictEqual(identityScript.getIdentity().toBuffer().toString('hex'), identityHex);
    });
  }

  it('uses explicit root context for a null-parent identity without changing its serialized fields', function () {
    const fixture = rootContextFixture;
    const transactionHex = createUnfundedIdentityUpdate(
      fixture.payloadHex, networks.verustest, undefined, undefined, undefined, fixture.rootSystemName
    );
    const transaction = Transaction.fromHex(transactionHex, networks.verustest);
    assert.strictEqual(transaction.outs.length, 1);
    assert.strictEqual(transaction.outs[0].value, 0);
    assert.strictEqual(transaction.outs[0].script.toString('hex'), fixture.scriptHex);

    const identityScript = new IdentityScript();
    identityScript.fromBuffer(transaction.outs[0].script);
    const identity = identityScript.getIdentity();
    assert.strictEqual(identity.toBuffer().toString('hex'), fixture.payloadHex);
    assert.strictEqual(identity.getIdentityAddress(fixture.rootSystemName), fixture.identityAddress);
    assert.strictEqual(identity.systemId.toAddress(), fixture.systemId);
    assert.ok(identity.parent.hash.equals(Buffer.alloc(20)));
  });

  it('rejects an ambiguous null-parent identity when root context is omitted', function () {
    assert.throws(
      () => createUnfundedIdentityUpdate(rootContextFixture.payloadHex, networks.verustest),
      /Null-parent identity requires explicit root system context/
    );
  });

  it('derives a genesis root identity from its stored system ID without explicit context', function () {
    const identity = new Identity();
    identity.fromBuffer(Buffer.from(rootContextFixture.payloadHex, 'hex'));
    identity.name = rootContextFixture.rootSystemName;
    const identityHex = identity.toBuffer().toString('hex');
    const transaction = Transaction.fromHex(
      createUnfundedIdentityUpdate(identityHex, networks.verustest), networks.verustest
    );
    const output = unpackOutput(transaction.outs[0], rootContextFixture.systemId, false, true);
    assert.ok(output.destinations.includes(rootContextFixture.systemId));
    const unpackedIdentity = output.params![0].data as Identity;
    assert.strictEqual(unpackedIdentity.getIdentityAddress(), rootContextFixture.systemId);
    assert.strictEqual(unpackedIdentity.toBuffer().toString('hex'), identityHex);
  });
});
