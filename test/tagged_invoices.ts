import * as assert from 'assert';
import {
  BigNumber, CompactXAddressObject, EVALS, ReserveTransfer, TransferDestination,
  VerusPayInvoice, VerusPayInvoiceDetails, fromBase58Check, toBase58Check
} from 'verus-typescript-primitives';
import {
  createUnfundedCurrencyTransfer, unpackOutput, validateCurrencyTransferIntent,
  validateFundedCurrencyTransfer
} from '../src/smart_transactions';
import networks = require('../src/networks');

const Transaction = require('../src/transaction');
const OptCCParams = require('../src/optccparams');
const TxDestination = require('../src/tx_destination');
const script = require('../src/script');
const templates = require('../src/templates');
const bs58check = require('bs58check');

describe('tagged VerusPay invoice payments', function () {
  const system = 'iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq';
  const token = 'iQP7TeWNDNsF7aaaCkQzNyS4jDjdKncNWf';
  const fractional = 'iECDGNNufPkSa9aHfbnQUjvhRN6YGR8eKM';
  const prelaunch = 'iMxcxy7b8B62UM8sumRpjSMJzo95ZKLE5R';
  const remote = 'iNC9NG5Jqk2tqVtqfjfiSpaqxrXaFU6RDu';
  const tagHash = Buffer.from('000102030405060708090a0b0c0d0e0f10111213', 'hex');
  const tag = toBase58Check(tagHash, 137);
  const otherTag = toBase58Check(Buffer.alloc(20, 7), 137);
  const recipient = TransferDestination.fromJson({ type: 2, address: 'R9hJiQ8Evh2ehU68GveFfXGDwdRcPKSbip' });
  const identity = TransferDestination.fromJson({ type: 4, address: 'iFZC7A1HnnJGwBmoPjX3mG37RKbjZZLPhm' });
  type Output = Parameters<typeof createUnfundedCurrencyTransfer>[1][number];
  const payment: Output = { currency: system, satoshis: '100000000', address: recipient };
  const conversion: Output = { ...payment, convertto: fractional, feecurrency: system, feesatoshis: '20010' };
  const build = (output: Output) => createUnfundedCurrencyTransfer(system, [output], networks.verustest);
  const parse = (hex: string) => Transaction.fromHex(hex, networks.verustest);
  const chunksOf = (hex: string) => script.decompile(parse(hex).outs[0].script);
  const context: Parameters<typeof validateCurrencyTransferIntent>[4] = {
    currencyDefinitions: {
      [system]: { systemid: system, options: 0 },
      [fractional]: { systemid: system, options: 1, currencies: [system, token] }
    },
    route: { importCurrency: fractional, system },
    fees: { currency: system, transferSatoshis: '20010', destinationSatoshis: '0' },
    auxiliaryDestinations: []
  };
  const validate = (hex: string, vdxftag: string = tag) => validateCurrencyTransferIntent(
    system, hex, { ...conversion, vdxftag }, networks.verustest, context
  );

  const payments: Array<[string, Output, number]> = [
    ['native PKH', payment, EVALS.EVAL_NONE],
    ['native identity', { ...payment, address: identity }, EVALS.EVAL_NONE],
    ['token', { ...payment, currency: token }, EVALS.EVAL_RESERVE_OUTPUT],
    ['conversion', conversion, EVALS.EVAL_RESERVE_TRANSFER],
    ['preconversion', { ...conversion, convertto: prelaunch, preconvert: true }, EVALS.EVAL_RESERVE_TRANSFER],
    ['export', { ...payment, exportto: remote, bridgeid: remote, feesatoshis: '20010' }, EVALS.EVAL_RESERVE_TRANSFER]
  ];

  for (const [name, output, evalCode] of payments) {
    it(`adds the invoice index to a ${name} payment without changing its recipient or amounts`, function () {
      const tagged = parse(build({ ...output, vdxftag: tag }));
      const untagged = parse(build(output));
      const chunks = script.decompile(tagged.outs[0].script);
      assert.strictEqual(templates.classifyOutput(tagged.outs[0].script), templates.types.SMART_TRANSACTION);
      // Independent wire expectation: v3, EVAL_NONE, 1-of-1, TYPE_INDEX + the 20-byte tag.
      assert.strictEqual(chunks[0].toString('hex'), '04030001011505' + tagHash.toString('hex'));
      const inner = OptCCParams.fromChunk(chunks[2]);
      assert.strictEqual(inner.evalCode, evalCode);
      assert.strictEqual(tagged.outs[0].value, untagged.outs[0].value);
      if (name === 'native PKH') {
        assert.strictEqual(templates.classifyOutput(untagged.outs[0].script), templates.types.P2PKH);
        assert.strictEqual(chunks[2].toString('hex'), '040300010114' + recipient.destinationBytes.toString('hex'));
      } else {
        assert.ok(chunks[2].equals(script.decompile(untagged.outs[0].script)[2]));
      }
      if (evalCode === EVALS.EVAL_RESERVE_TRANSFER) {
        const transfer = new ReserveTransfer();
        transfer.fromBuffer(inner.vData[0]);
        assert.ok(transfer.transferDestination.toBuffer().equals(output.address.toBuffer()));
        assert.strictEqual(transfer.firstValue().toString(), output.satoshis);
      } else {
        assert.strictEqual(inner.destinations[0].destType, output.address.type.toNumber());
        assert.ok(inner.destinations[0].destinationBytes.equals(output.address.destinationBytes));
      }
      const unpacked = unpackOutput(tagged.outs[0], system);
      const original = unpackOutput(untagged.outs[0], system);
      assert.ok(unpacked.destinations.includes(tag));
      assert.deepStrictEqual(unpacked.values, original.values);
      assert.deepStrictEqual(unpacked.fees, original.fees);
    });
  }

  it('uses the X-address resolved from a JSON-restored testnet invoice tag', function () {
    const details = new VerusPayInvoiceDetails({
      requestedcurrencyid: system, amount: new BigNumber(payment.satoshis), destination: recipient,
      tag: CompactXAddressObject.fromDataKey('vrsctest::invoice.payment', 'VRSCTEST')
    });
    details.setFlags({ isTagged: true, isTestnet: true });
    const invoice = new VerusPayInvoice({ details });
    const restored = VerusPayInvoice.fromJson(invoice.toJson());
    const resolvedTag = restored.details.tag.toAddress();
    assert.strictEqual(resolvedTag, details.tag.toAddress());
    const chunks = chunksOf(build({ ...payment, vdxftag: resolvedTag }));
    assert.strictEqual(chunks[0].toString('hex'), '04030001011505' + fromBase58Check(resolvedTag).hash.toString('hex'));
  });

  const malformedTags: Array<[string, string]> = [
    ['empty tag', ''],
    ['unresolved FQN', 'vrsctest::invoice.payment'],
    ['PKH prefix', toBase58Check(tagHash, 60)],
    ['identity prefix', toBase58Check(tagHash, 102)],
    ['bad checksum', tag.slice(0, -1) + (tag.endsWith('1') ? '2' : '1')],
    ['short hash', bs58check.encode(Buffer.concat([Buffer.from([137]), Buffer.alloc(19)]))],
    ['long hash', bs58check.encode(Buffer.concat([Buffer.from([137]), Buffer.alloc(21)]))],
    ['noncanonical version encoding', bs58check.encode(Buffer.concat([Buffer.from([0, 137]), tagHash]))]
  ];
  for (const [name, malformed] of malformedTags) {
    it(`rejects an invoice ${name} before building or accepting a payment`, function () {
      assert.throws(() => build({ ...payment, vdxftag: malformed }), /Invalid destination address/);
      assert.strictEqual(validate(build({ ...conversion, vdxftag: tag }), malformed).valid, false);
    });
  }

  it('validates a tagged conversion against the independently requested tag', function () {
    assert.deepStrictEqual(validate(build({ ...conversion, vdxftag: tag })), { valid: true });
  });

  const changes: Array<[string, (chunks: any[]) => void, string]> = [
    ['missing tag', chunks => { chunks[0] = chunksOf(build(conversion))[0]; }, tag],
    ['unexpected tag', () => {}, null],
    ['different tag', chunks => { chunks[0] = chunksOf(build({ ...conversion, vdxftag: otherTag }))[0]; }, tag],
    ['wrong tag destination type', chunks => {
      const master = OptCCParams.fromChunk(chunks[0]);
      master.destinations[0].destType = TxDestination.TYPE_ID;
      chunks[0] = master.toChunk();
    }, tag],
    ['tag substituted for the inner reserve condition', chunks => { chunks[2] = chunks[0]; }, tag],
    ['changed inner reserve condition', chunks => {
      const inner = OptCCParams.fromChunk(chunks[2]);
      inner.destinations[0].destinationBytes = recipient.destinationBytes;
      chunks[2] = inner.toChunk();
    }, tag]
  ];
  for (const [name, change, approvedTag] of changes) {
    it(`rejects a conversion with a ${name}`, function () {
      const tx = parse(build({ ...conversion, vdxftag: tag }));
      const chunks = script.decompile(tx.outs[0].script);
      change(chunks);
      tx.outs[0].script = script.compile(chunks);
      assert.strictEqual(validate(tx.toHex(), approvedTag).valid, false);
    });
  }

  for (const [name, resultingTag, valid] of [
    ['preserved', tag, true], ['changed', otherTag, false], ['removed', undefined, false]
  ] as Array<[string, string, boolean]>) {
    it(`${valid ? 'accepts' : 'rejects'} funding with the invoice tag ${name}`, function () {
      const unfunded = build({ ...payment, vdxftag: tag });
      const funded = parse(build({ ...payment, vdxftag: resultingTag }));
      const changeAddress = 'RTqQe58LSj2yr5CrwYFwcsAQ1edQwmrkUU';
      const changeScript = require('../src/address').toOutputScript(changeAddress, networks.verustest);
      const utxo = {
        txid: 'ab'.repeat(32), outputIndex: 0, satoshis: 200000000,
        script: changeScript.toString('hex'), isspendable: true, address: changeAddress, height: 1
      };
      funded.addInput(Buffer.from(utxo.txid, 'hex').reverse(), 0);
      funded.addOutput(changeScript, utxo.satoshis - funded.outs[0].value - 10000);
      const result = validateFundedCurrencyTransfer(
        system, funded.toHex(), unfunded, changeAddress, networks.verustest, [utxo]
      );
      assert.strictEqual(result.valid, valid);
      if (valid) {
        assert.deepStrictEqual(result.sent, { [system]: payment.satoshis });
        assert.deepStrictEqual(result.fees, { [system]: '10000' });
      } else {
        assert.strictEqual(result.message, 'Transaction hex does not match unfunded component.');
      }
    });
  }
});
