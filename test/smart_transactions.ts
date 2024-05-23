/**
 * @prettier
 */
/* global describe, it */
import * as assert from 'assert';
import { validateFundedCurrencyTransfer, createUnfundedCurrencyTransfer, unpackOutput, completeFundedIdentityUpdate, createUnfundedIdentityUpdate } from '../src/smart_transactions';
import networks = require('../src/networks');
import { DEST_ID, DEST_PKH, FLAG_DEST_AUX, Identity, OptCCParams, ReserveTransfer, TransferDestination, compile, decompile, fromBase58Check } from 'verus-typescript-primitives';

const Transaction = require('../src/transaction.js');
const TransactionBuilder = require('../src/transaction_builder.js');

describe('smarttxs', function () {
  it('creates basic PKH tx when able', function () {
    const addr = TransferDestination.fromJson({ 
      "aux_dests": [], 
      "destination_bytes": "aaac5e5078ff347462fa72d16ddb88a7eb50a3b2", 
      "fees": "0", 
      "gateway_code": null, 
      "gateway_id": null, 
      "type": "2" 
    })

    const transfer = createUnfundedCurrencyTransfer(
      "i5w5MuNik5NtLcYmNzcvaoixooEebB6MGV",
      [{ 
        "address": addr, 
        "bridgeid": undefined, 
        "convertto": undefined, 
        "currency": "i5w5MuNik5NtLcYmNzcvaoixooEebB6MGV", 
        "exportto": undefined, 
        "feecurrency": undefined, 
        "feesatoshis": undefined, 
        "importtosource": false, 
        "satoshis": "239960000", 
        "via": undefined 
      }],
      networks.verus,
      1000000,
      4,
      0x892f2085,
    )

    assert.equal(transfer, "0400008085202f890001c07f4d0e000000001976a914aaac5e5078ff347462fa72d16ddb88a7eb50a3b288ac0000000040420f000000000000000000000000");
  });
  
  it('validates successful token output to p2pkh', function () {
    const unfundedtx = "0400008085202f89000100e1f505000000001976a91487bcb238974658d8bda6a19f9d3f2dd04339b8f788ac00000000f2aa00000000000000000000000000"
    const fundedtx = "0400008085202f89016b0611ccc9f1f3e4572c02f984de1999726625b1c482ace67581def10253e9050100000000feffffff02d066e20b00000000781a040300010114402f01e78edb0f5c8251658dde07f0d52b12e972cc4c59040309010114402f01e78edb0f5c8251658dde07f0d52b12e9723e86fefeff010275939018c507ed9cf366d309d4614b2e43ca3c0090603008db080000848374dd2a47335f0252c8caa066b94de4bf800f804a5d05000000007500e1f505000000001976a91487bcb238974658d8bda6a19f9d3f2dd04339b8f788ac00000000f2aa00000000000000000000000000"
    const changeaddr = "RF8ZdvjvGMNdtu3jNwcmaTDeU8hFJ28ajN"
    const system = "iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq"
    const utxos = [
      {
        "address": "RF8ZdvjvGMNdtu3jNwcmaTDeU8hFJ28ajN",
        "txid": "05e95302f1de8175e6ac82c4b12566729919de84f9022c57e4f3f1c9cc11066b",
        "outputIndex": 1,
        "isspendable": 1,
        "script": "1a040300010114402f01e78edb0f5c8251658dde07f0d52b12e972cc4c59040309010114402f01e78edb0f5c8251658dde07f0d52b12e9723e86fefeff010275939018c507ed9cf366d309d4614b2e43ca3c0090603008db080000848374dd2a47335f0252c8caa066b94de4bf800f804a5d050000000075",
        "currencyvalues": {
          "iECDGNNufPkSa9aHfbnQUjvhRN6YGR8eKM": 97368.28248208,
          "iFZC7A1HnnJGwBmoPjX3mG37RKbjZZLPhm": 0.90000000,
          "iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq": 2.99396832
        },
        "currencynames": {},
        "satoshis": 299396832,
        "height": 39405,
        "blocktime": 1684580377
      }
    ]

    const validation = validateFundedCurrencyTransfer(
      system, 
      fundedtx, 
      unfundedtx, 
      changeaddr, 
      networks.verustest, 
      utxos
    )

    assert.deepStrictEqual(validation, {
      valid: true,
      in: {
        iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq: '299396832',
        iECDGNNufPkSa9aHfbnQUjvhRN6YGR8eKM: '9736828248208',
        iFZC7A1HnnJGwBmoPjX3mG37RKbjZZLPhm: '90000000'
      },
      out: {
        iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq: '299386832',
        iECDGNNufPkSa9aHfbnQUjvhRN6YGR8eKM: '9736828248208',
        iFZC7A1HnnJGwBmoPjX3mG37RKbjZZLPhm: '90000000'
      },
      change: {
        iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq: '199386832',
        iECDGNNufPkSa9aHfbnQUjvhRN6YGR8eKM: '9736828248208',
        iFZC7A1HnnJGwBmoPjX3mG37RKbjZZLPhm: '90000000'
      },
      fees: {
        iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq: '10000',
        iECDGNNufPkSa9aHfbnQUjvhRN6YGR8eKM: '0',
        iFZC7A1HnnJGwBmoPjX3mG37RKbjZZLPhm: '0'
      },
      sent: {
        iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq: '100000000',
        iECDGNNufPkSa9aHfbnQUjvhRN6YGR8eKM: '0',
        iFZC7A1HnnJGwBmoPjX3mG37RKbjZZLPhm: '0'
      }
    })
  });

  it('validates exportto from chain with bridge converter', function () {
    const unfundedtx = "0400008085202f8900015512bc0100000000de1a040300010114cb8a0f7f651b484a81e2312c3438deb601e27368cc4cbf040308010114cb8a0f7f651b484a81e2312c3438deb601e273684ca301a6ef9ea235635e328124ff3429db9f9e91b64e2daed6c10001cd51509db53e822df7eed11cac11e7b729e22400809b2ac214002d3311c38bfd219092d2aef449804be8b3befea6ef9ea235635e328124ff3429db9f9e91b64e2d00000000000000000000000000000000000000002bc4bb010000000001160214002d3311c38bfd219092d2aef449804be8b3befe65ffba3d69510d6f31845e60b9ee0c275389f84f75000000004b6a01000000000000000000000000"
    const fundedtx = "0400008085202f89025c9a994a55caf97f48ef16b66a5a7125e2d26944a2d85a8775dca09b7131500b0500000000fffffffffb1497f51b15c4520e0b8bcd86123101c8e22253e460b50d89aa21a0aeac014a0500000000ffffffff0272976b46000000001976a914002d3311c38bfd219092d2aef449804be8b3befe88ac5512bc0100000000de1a040300010114cb8a0f7f651b484a81e2312c3438deb601e27368cc4cbf040308010114cb8a0f7f651b484a81e2312c3438deb601e273684ca301a6ef9ea235635e328124ff3429db9f9e91b64e2daed6c10001cd51509db53e822df7eed11cac11e7b729e22400809b2ac214002d3311c38bfd219092d2aef449804be8b3befea6ef9ea235635e328124ff3429db9f9e91b64e2d00000000000000000000000000000000000000002bc4bb010000000001160214002d3311c38bfd219092d2aef449804be8b3befe65ffba3d69510d6f31845e60b9ee0c275389f84f75000000004b6a01000000000000000000000000"
    const changeaddr = "R9J8E2no2HVjQmzX6Ntes2ShSGcn7WiRcx"
    const system = "iNC9NG5Jqk2tqVtqfjfiSpaqxrXaFU6RDu"
    const utxos = [
      {
        "address": "R9J8E2no2HVjQmzX6Ntes2ShSGcn7WiRcx",
        "blocktime": 1688044160,
        "currencyvalues": {
            "iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq": 1.0
        },
        "height": 92481,
        "isspendable": 1,
        "outputIndex": 5,
        "satoshis": 0,
        "script": "1a040300010114002d3311c38bfd219092d2aef449804be8b3befecc34040309010114002d3311c38bfd219092d2aef449804be8b3befe1901a6ef9ea235635e328124ff3429db9f9e91b64e2daed6c10075",
        "txid": "0b5031719ba0dc75875ad8a24469d2e225715a6ab616ef487ff9ca554a999a5c",
        "currencynames": {}
      },
      {
        "address": "R9J8E2no2HVjQmzX6Ntes2ShSGcn7WiRcx",
        "blocktime": 1688045030,
        "height": 92501,
        "isspendable": 1,
        "outputIndex": 5,
        "satoshis": 1210568919,
        "script": "76a914002d3311c38bfd219092d2aef449804be8b3befe88ac",
        "txid": "4a01acaea021aa890db560e45322e2c801311286cd8b0b0e52c4151bf59714fb",
        "currencynames": {},
        "currencyvalues": {},
      }
    ]

    const validation = validateFundedCurrencyTransfer(
      system, 
      fundedtx, 
      unfundedtx, 
      changeaddr, 
      networks.verustest, 
      utxos
    )

    const unfundedTxObj = Transaction.fromHex(unfundedtx, networks.verus);

    const outputInfo = unpackOutput(unfundedTxObj.outs[0], system);

    const transDest = (outputInfo.params[0].data as ReserveTransfer)

    assert.strictEqual(transDest.transfer_destination.isGateway(), true);
    assert.strictEqual(transDest.transfer_destination.hasAuxDests(), true);
    assert.strictEqual(transDest.transfer_destination.getAddressString(), "R9J8E2no2HVjQmzX6Ntes2ShSGcn7WiRcx");
    assert.strictEqual(transDest.transfer_destination.gateway_id, "iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq");
    assert.strictEqual(transDest.transfer_destination.gateway_code, "i3UXS5QPRQGNRDDqVnyWTnmFCTHDbzmsYk");

    assert.strictEqual(transDest.transfer_destination.aux_dests[0].isGateway(), false);
    assert.strictEqual(transDest.transfer_destination.aux_dests[0].getAddressString(), "R9J8E2no2HVjQmzX6Ntes2ShSGcn7WiRcx");

    assert.deepStrictEqual(validation, {
      valid: true,
      in: {
        iNC9NG5Jqk2tqVtqfjfiSpaqxrXaFU6RDu: '1210568919',
        iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq: '100000000'
      },
      out: {
        iNC9NG5Jqk2tqVtqfjfiSpaqxrXaFU6RDu: '1210558919',
        iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq: '100000000'
      },
      change: { iNC9NG5Jqk2tqVtqfjfiSpaqxrXaFU6RDu: '1181456242' },
      fees: {
        iNC9NG5Jqk2tqVtqfjfiSpaqxrXaFU6RDu: '29112677',
        iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq: '0'
      },
      sent: {
        iNC9NG5Jqk2tqVtqfjfiSpaqxrXaFU6RDu: '0',
        iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq: '100000000'
      }
    })
  });

  it('validates tx with 0 m and 0 n on master optccparams on change', function () {
    const unfundedtx = "0400008085202f8900010000000000000000531a040300010114dceb28eb662cdb099d5abe534c2a2bef41779a3acc35040309010114dceb28eb662cdb099d5abe534c2a2bef41779a3a1a016cf4bfcba175992d92f445d154cc0e7fe16b9e8e82dbea93007500000000462801000000000000000000000000"
    const fundedtx = "0400008085202f89021bf610a2b1c6ed4542519c7498bb1bc5fb59a8d13866de55360b611a0dc548d00000000000ffffffff8cfecee126bdd1f66aad742edfa47d77b6bf5a76129288bd70a3d5aa2b4164cc0000000000ffffffff02f0a29a3b0000000024050403000000cc1b04030001011504cac28788c8b70db738fc3ee9e28923004ffbc71f750000000000000000531a040300010114dceb28eb662cdb099d5abe534c2a2bef41779a3acc35040309010114dceb28eb662cdb099d5abe534c2a2bef41779a3a1a016cf4bfcba175992d92f445d154cc0e7fe16b9e8e82dbea93007500000000462801000000000000000000000000"
    const changeaddr = "iMxcxy7b8B62UM8sumRpjSMJzo95ZKLE5R"
    const system = "iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq"
    const utxos = [
      {
        address: 'iMxcxy7b8B62UM8sumRpjSMJzo95ZKLE5R',
        blocktime: 1684173528,
        height: 32869,
        isspendable: 0,
        outputIndex: 1,
        satoshis: 0,
        script:
          '1b04030001011504cac28788c8b70db738fc3ee9e28923004ffbc71fcc4c7904030a01011504cac28788c8b70db738fc3ee9e28923004ffbc71f4c5c010000000f6c6f6e675f707265636f6e76657274a6ef9ea235635e328124ff3429db9f9e91b64e2d00000000000000000000000000000000000000006be9f5843e2b30306dcd0d19bf6c2067462b3771adc76f217c1f5686f44ecfd075',
        txid: '47e3038477735d70c4e83a1d966841edae6017717139694aa7dc84416412afe6',
        currencyvalues: {},
        currencynames: {}
      },
      {
        address: 'iMxcxy7b8B62UM8sumRpjSMJzo95ZKLE5R',
        addresses: [
          'iMxcxy7b8B62UM8sumRpjSMJzo95ZKLE5R',
          'iMxcxy7b8B62UM8sumRpjSMJzo95ZKLE5R',
          'iMxcxy7b8B62UM8sumRpjSMJzo95ZKLE5R',
        ],
        blocktime: 1686747776,
        height: 74363,
        isspendable: 0,
        outputIndex: 0,
        satoshis: 0,
        script:
          '4704030001031504cac28788c8b70db738fc3ee9e28923004ffbc71f1504cac28788c8b70db738fc3ee9e28923004ffbc71f1504cac28788c8b70db738fc3ee9e28923004ffbc71fcc4cde04030e01011504cac28788c8b70db738fc3ee9e28923004ffbc71f4c8903000000010000000114dceb28eb662cdb099d5abe534c2a2bef41779a3a01000000a6ef9ea235635e328124ff3429db9f9e91b64e2d0f6c6f6e675f707265636f6e766572740000cac28788c8b70db738fc3ee9e28923004ffbc71fcac28788c8b70db738fc3ee9e28923004ffbc71f00a6ef9ea235635e328124ff3429db9f9e91b64e2d000000001b04030f01011504cac28788c8b70db738fc3ee9e28923004ffbc71f1b04031001011504cac28788c8b70db738fc3ee9e28923004ffbc71f75',
        txid: '12bbfd6c25f2e84821176670f8d5a0c7db7faa2cf5a0bbcf468213905cf1fefa',
        currencyvalues: {},
        currencynames: {}
      },
      {
        address: 'iMxcxy7b8B62UM8sumRpjSMJzo95ZKLE5R',
        blocktime: 1686751804,
        currencyvalues: {iDQdcGSXMXzo8zURyCr6K3HoPYtsKxP9ns: 10},
        height: 74424,
        isspendable: 1,
        outputIndex: 0,
        satoshis: 0,
        script:
          '1b04030001011504cac28788c8b70db738fc3ee9e28923004ffbc71fcc3604030901011504cac28788c8b70db738fc3ee9e28923004ffbc71f1a016cf4bfcba175992d92f445d154cc0e7fe16b9e8e82dbea930075',
        txid: 'cc64412baad5a370bd889212765abfb6777da4df2e74ad6af6d1bd26e1cefe8c',
        currencynames: {}
      },
      {
        address: 'iMxcxy7b8B62UM8sumRpjSMJzo95ZKLE5R',
        blocktime: 1686754497,
        currencyvalues: {iDQdcGSXMXzo8zURyCr6K3HoPYtsKxP9ns: 20},
        height: 74464,
        isspendable: 1,
        outputIndex: 0,
        satoshis: 0,
        script:
          '1b04030001011504cac28788c8b70db738fc3ee9e28923004ffbc71fcc3604030901011504cac28788c8b70db738fc3ee9e28923004ffbc71f1a016cf4bfcba175992d92f445d154cc0e7fe16b9e8e86b8d5a70075',
        txid: '0c41b4d7fc0ca06e8da536f64340a1db39b92eb7c3d4d85ee01071e79ecd23e0',
        currencynames: {}
      },
      {
        address: 'iMxcxy7b8B62UM8sumRpjSMJzo95ZKLE5R',
        blocktime: 1686754896,
        currencyvalues: {iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq: 10},
        height: 74466,
        isspendable: 1,
        outputIndex: 0,
        satoshis: 1000000000,
        script:
          '050403000000cc1b04030001011504cac28788c8b70db738fc3ee9e28923004ffbc71f75',
        txid: 'd048c50d1a610b3655de6638d1a859fbc51bbb98749c514245edc6b1a210f61b',
        currencynames: {}
      },
    ];

    const validation = validateFundedCurrencyTransfer(
      system, 
      fundedtx, 
      unfundedtx, 
      changeaddr, 
      networks.verustest, 
      utxos
    )

    assert.deepStrictEqual(validation, {
      valid: true,
      in: {
        iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq: '1000000000',
        iDQdcGSXMXzo8zURyCr6K3HoPYtsKxP9ns: '1000000000'
      },
      out: {
        iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq: '999990000',
        iDQdcGSXMXzo8zURyCr6K3HoPYtsKxP9ns: '1000000000'
      },
      change: { iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq: '999990000' },
      fees: {
        iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq: '10000',
        iDQdcGSXMXzo8zURyCr6K3HoPYtsKxP9ns: '0'
      },
      sent: {
        iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq: '0',
        iDQdcGSXMXzo8zURyCr6K3HoPYtsKxP9ns: '1000000000'
      }
    })
  });

  it('fails on tx with no inputs', function () {
    const unfundedtx = "0400008085202f89000100e1f505000000001976a91487bcb238974658d8bda6a19f9d3f2dd04339b8f788ac00000000f2aa00000000000000000000000000"
    const fundedtx = '0400008085202f890002d066e20b00000000781a040300010114f9ff43bb7debfcb57a19eeb6b67e68733edbba55cc4c59040309010114f9ff43bb7debfcb57a19eeb6b67e68733edbba553e86fefeff010275939018c507ed9cf366d309d4614b2e43ca3c0090603008db080000848374dd2a47335f0252c8caa066b94de4bf800f804a5d05000000007500e1f505000000001976a91487bcb238974658d8bda6a19f9d3f2dd04339b8f788ac00000000f2aa00000000000000000000000000'
    const changeaddr = "RY548NkKzkWFPQpteeoaZ4FEnex8Rt8eoH"
    const system = "iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq"
    const utxos = [
      {
        "address": "RF8ZdvjvGMNdtu3jNwcmaTDeU8hFJ28ajN",
        "txid": "05e95302f1de8175e6ac82c4b12566729919de84f9022c57e4f3f1c9cc11066b",
        "outputIndex": 1,
        "isspendable": 1,
        "script": "1a040300010114402f01e78edb0f5c8251658dde07f0d52b12e972cc4c59040309010114402f01e78edb0f5c8251658dde07f0d52b12e9723e86fefeff010275939018c507ed9cf366d309d4614b2e43ca3c0090603008db080000848374dd2a47335f0252c8caa066b94de4bf800f804a5d050000000075",
        "currencyvalues": {
          "iECDGNNufPkSa9aHfbnQUjvhRN6YGR8eKM": 97368.28248208,
          "iFZC7A1HnnJGwBmoPjX3mG37RKbjZZLPhm": 0.90000000,
          "iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq": 2.99396832
        },
        "currencynames": {},
        "satoshis": 299396832,
        "height": 39405,
        "blocktime": 1684580377
      }
    ]

    const validation = validateFundedCurrencyTransfer(
      system, 
      fundedtx, 
      unfundedtx, 
      changeaddr, 
      networks.verustest, 
      utxos
    )

    assert.deepStrictEqual(validation, { valid: false, message: 'Transaction has 0 inputs.' })
  })

  it('can validate spend with coinbase input (mined)', function () {
    const unfundedtx = "0400008085202f890001a842f60500000000ab1a040300010114cb8a0f7f651b484a81e2312c3438deb601e27368cc4c8c040308010114cb8a0f7f651b484a81e2312c3438deb601e273684c7001a6ef9ea235635e328124ff3429db9f9e91b64e2daed6c1008703a6ef9ea235635e328124ff3429db9f9e91b64e2d80c2280214002d3311c38bfd219092d2aef449804be8b3befe630692b119fd01e8da230698fad9bb65a3d2a8ec84d881e355c1c87dd84baa2e068dc3829e140d3c7500000000474201000000000000000000000000"
    const fundedtx = '0400008085202f8901e566b94c6996d050404b9181a7679f5592fa662073a6c4465c04bfcc27028ff10000000000ffffffff024ec1e426000000001976a914002d3311c38bfd219092d2aef449804be8b3befe88aca842f60500000000ab1a040300010114cb8a0f7f651b484a81e2312c3438deb601e27368cc4c8c040308010114cb8a0f7f651b484a81e2312c3438deb601e273684c7001a6ef9ea235635e328124ff3429db9f9e91b64e2daed6c1008703a6ef9ea235635e328124ff3429db9f9e91b64e2d80c2280214002d3311c38bfd219092d2aef449804be8b3befe630692b119fd01e8da230698fad9bb65a3d2a8ec84d881e355c1c87dd84baa2e068dc3829e140d3c7500000000474201000000000000000000000000'
    const changeaddr = "R9J8E2no2HVjQmzX6Ntes2ShSGcn7WiRcx"
    const system = "iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq"
    const utxos = [{
      "address":"R9J8E2no2HVjQmzX6Ntes2ShSGcn7WiRcx",
      "blocktime":1687190901,
      "height":81508,
      "isspendable":1,
      "outputIndex":0,
      "satoshis":752560902,
      "script":"210351c5d0d09554ecc25667259af393a723136e90782be07a6caea202fd22a35227ac",
      "txid":"f18f0227ccbf045c46c4a6732066fa92559f67a781914b4050d096694cb966e5",
      "currencyvalues": {},
      "currencynames": {}
    }]

    const validation = validateFundedCurrencyTransfer(
      system, 
      fundedtx, 
      unfundedtx, 
      changeaddr, 
      networks.verustest, 
      utxos
    )

    assert.deepStrictEqual(validation, {    
      change: {
        iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq: '652525902'
      },
      fees: {
        iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq: '35000'
      },
      in: {
        iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq: '752560902'
      },
      out: {
        iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq: '752550902'
      },
      sent: {
        iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq: '100000000'
      },
      valid: true 
    })
  })

  it('can validate spend to dest eth', function () {
    const unfundedtx = "0400008085202f8900014aa6205000000000f51a040300010114cb8a0f7f651b484a81e2312c3438deb601e27368cc4cd6040308010114cb8a0f7f651b484a81e2312c3438deb601e273684cba01a6ef9ea235635e328124ff3429db9f9e91b64e2d83e1ac0001a6ef9ea235635e328124ff3429db9f9e91b64e2d809b2ac9141f9090aae28b8a3dceadf281b0f12828e676c32667460c2f56774ed27eeb8685f29f6cec0b090b000000000000000000000000000000000000000000a0c1874f0000000002160214002d3311c38bfd219092d2aef449804be8b3befe160214002d3311c38bfd219092d2aef449804be8b3befeffece948b8a38bbcc813411d2597f7f8485a0689750000000058b501000000000000000000000000"
    const fundedtx = '0400008085202f89016a8baf6ec051fa6dd8913bbec4d4ab5b161b6f7a28bcec7bcbc13b77719c3aa50000000000ffffffff02a616eb03020000001976a914002d3311c38bfd219092d2aef449804be8b3befe88ac4aa6205000000000f51a040300010114cb8a0f7f651b484a81e2312c3438deb601e27368cc4cd6040308010114cb8a0f7f651b484a81e2312c3438deb601e273684cba01a6ef9ea235635e328124ff3429db9f9e91b64e2d83e1ac0001a6ef9ea235635e328124ff3429db9f9e91b64e2d809b2ac9141f9090aae28b8a3dceadf281b0f12828e676c32667460c2f56774ed27eeb8685f29f6cec0b090b000000000000000000000000000000000000000000a0c1874f0000000002160214002d3311c38bfd219092d2aef449804be8b3befe160214002d3311c38bfd219092d2aef449804be8b3befeffece948b8a38bbcc813411d2597f7f8485a0689750000000058b501000000000000000000000000'
    const changeaddr = "R9J8E2no2HVjQmzX6Ntes2ShSGcn7WiRcx"
    const system = "iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq"
    const utxos = [{
      "address": "R9J8E2no2HVjQmzX6Ntes2ShSGcn7WiRcx",
      "blocktime": 1689094547,
      "height": 112187,
      "isspendable": 1,
      "outputIndex": 0,
      "satoshis": 10000000000,
      "script": "76a914002d3311c38bfd219092d2aef449804be8b3befe88ac",
      "txid": "a53a9c71773bc1cb7becbc287a6f1b165babd4c4be3b91d86dfa51c06eaf8b6a",
      "currencyvalues": {},
      "currencynames": {}
    }]

    const validation = validateFundedCurrencyTransfer(
      system, 
      fundedtx, 
      unfundedtx, 
      changeaddr, 
      networks.verustest, 
      utxos
    )

    assert.deepStrictEqual(validation, {
      valid: true,
      in: { iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq: '10000000000' },
      out: { iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq: '9999990000' },
      change: { iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq: '8655672998' },
      fees: { iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq: '1334327002' },
      sent: { iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq: '10000000' }
    })
  })

  it('can validate spend with coinbase input (minted)', function () {
    const unfundedtx = "0400008085202f89000100e1f5050000000024050403000000cc1b040300010115045653dfafa45298e7ffdbdbf8efeb3ab3b77f0a7175000000005c4201000000000000000000000000"
    const fundedtx = '0400008085202f8901d91f59345c5b57d9bcfb1710ae2fadb6d18dcc71703960e36042786997a3e91a0000000000ffffffff020065cd1d0000000024050403000000cc1b040300010115045653dfafa45298e7ffdbdbf8efeb3ab3b77f0a717500e1f5050000000024050403000000cc1b040300010115045653dfafa45298e7ffdbdbf8efeb3ab3b77f0a7175000000005c4201000000000000000000000000'
    const changeaddr = "iBLz2E4vjFh2TfjKvuHMS238uh5ZGoofWX"
    const system = "iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq"
    const utxos = [{
      "addresses": [
        "RCG8KwJNDVwpUBcdoa6AoHqHVJsA1uMYMR",
        "iBLz2E4vjFh2TfjKvuHMS238uh5ZGoofWX"
      ],
      "address": "iBLz2E4vjFh2TfjKvuHMS238uh5ZGoofWX",
      "txid": "1ae9a39769784260e360397071cc8dd1b6ad2fae1017fbbcd9575b5c34591fd9",
      "outputIndex": 0,
      "isspendable": 1,
      "script": "3d040300010215045653dfafa45298e7ffdbdbf8efeb3ab3b77f0a712103166b7813a4855a88e9ef7340a692ef3c2decedfdc2c7563ec79537e89667d935cc4c87040301010115045653dfafa45298e7ffdbdbf8efeb3ab3b77f0a714301000017cb4abd8ac73ef13b936a2e00f15f60030d7d25b08b8120798e30bb67a2a3446b7cfdf7782a9bf1ba208554618ee40bfebb7b538482a71b26361e5bc6141dee2704030101012103166b7813a4855a88e9ef7340a692ef3c2decedfdc2c7563ec79537e89667d93575",
      "currencyvalues": {
        "iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq": 6.00010000
      },
      "satoshis": 600010000,
      "height": 82501,
      "blocktime": 1687251984,
      currencynames: {}
    }]

    const validation = validateFundedCurrencyTransfer(
      system, 
      fundedtx, 
      unfundedtx, 
      changeaddr, 
      networks.verustest, 
      utxos
    )

    assert.deepStrictEqual(validation, {    
      change: {
        iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq: '500000000'
      },
      fees: {
        iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq: '10000'
      },
      in: {
        iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq: '600010000'
      },
      out: {
        iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq: '600000000'
      },
      sent: {
        iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq: '100000000'
      },
      valid: true 
    })
  })

  it('fails on tx with too many outputs', function () {
    const unfundedtx = "0400008085202f89000100e1f505000000001976a91487bcb238974658d8bda6a19f9d3f2dd04339b8f788ac00000000f2aa00000000000000000000000000"
    const fundedtx = '0400008085202f89016b0611ccc9f1f3e4572c02f984de1999726625b1c482ace67581def10253e9050100000000feffffff04d066e20b00000000781a040300010114f9ff43bb7debfcb57a19eeb6b67e68733edbba55cc4c59040309010114f9ff43bb7debfcb57a19eeb6b67e68733edbba553e86fefeff010275939018c507ed9cf366d309d4614b2e43ca3c0090603008db080000848374dd2a47335f0252c8caa066b94de4bf800f804a5d05000000007500e1f505000000001976a91487bcb238974658d8bda6a19f9d3f2dd04339b8f788acd066e20b00000000781a040300010114f9ff43bb7debfcb57a19eeb6b67e68733edbba55cc4c59040309010114f9ff43bb7debfcb57a19eeb6b67e68733edbba553e86fefeff010275939018c507ed9cf366d309d4614b2e43ca3c0090603008db080000848374dd2a47335f0252c8caa066b94de4bf800f804a5d05000000007500e1f505000000001976a91487bcb238974658d8bda6a19f9d3f2dd04339b8f788ac00000000f2aa00000000000000000000000000'
    const changeaddr = "RY548NkKzkWFPQpteeoaZ4FEnex8Rt8eoH"
    const system = "iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq"
    const utxos = [
      {
        "address": "RF8ZdvjvGMNdtu3jNwcmaTDeU8hFJ28ajN",
        "txid": "05e95302f1de8175e6ac82c4b12566729919de84f9022c57e4f3f1c9cc11066b",
        "outputIndex": 1,
        "isspendable": 1,
        "script": "1a040300010114402f01e78edb0f5c8251658dde07f0d52b12e972cc4c59040309010114402f01e78edb0f5c8251658dde07f0d52b12e9723e86fefeff010275939018c507ed9cf366d309d4614b2e43ca3c0090603008db080000848374dd2a47335f0252c8caa066b94de4bf800f804a5d050000000075",
        "currencyvalues": {
          "iECDGNNufPkSa9aHfbnQUjvhRN6YGR8eKM": 97368.28248208,
          "iFZC7A1HnnJGwBmoPjX3mG37RKbjZZLPhm": 0.90000000,
          "iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq": 2.99396832
        },
        "currencynames": {},
        "satoshis": 299396832,
        "height": 39405,
        "blocktime": 1684580377
      }
    ]

    const validation = validateFundedCurrencyTransfer(
      system, 
      fundedtx, 
      unfundedtx, 
      changeaddr, 
      networks.verustest, 
      utxos
    )

    assert.deepStrictEqual(validation, { valid: false, message: "Some change destinations are not RY548NkKzkWFPQpteeoaZ4FEnex8Rt8eoH." })
  })

  it('fails on tx with different locktime than unfunded tx', function () {
    const unfundedtx = "0400008085202f89000100e1f505000000001976a91487bcb238974658d8bda6a19f9d3f2dd04339b8f788ac00000000f2aa00000000000000000000000000"
    const fundedtx = '0400008085202f89016b0611ccc9f1f3e4572c02f984de1999726625b1c482ace67581def10253e9050100000000feffffff02d066e20b00000000781a040300010114f9ff43bb7debfcb57a19eeb6b67e68733edbba55cc4c59040309010114f9ff43bb7debfcb57a19eeb6b67e68733edbba553e86fefeff010275939018c507ed9cf366d309d4614b2e43ca3c0090603008db080000848374dd2a47335f0252c8caa066b94de4bf800f804a5d05000000007500e1f505000000001976a91487bcb238974658d8bda6a19f9d3f2dd04339b8f788ac39300000f2aa00000000000000000000000000'
    const changeaddr = "RY548NkKzkWFPQpteeoaZ4FEnex8Rt8eoH"
    const system = "iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq"
    const utxos = [
      {
        "address": "RF8ZdvjvGMNdtu3jNwcmaTDeU8hFJ28ajN",
        "txid": "05e95302f1de8175e6ac82c4b12566729919de84f9022c57e4f3f1c9cc11066b",
        "outputIndex": 1,
        "isspendable": 1,
        "script": "1a040300010114402f01e78edb0f5c8251658dde07f0d52b12e972cc4c59040309010114402f01e78edb0f5c8251658dde07f0d52b12e9723e86fefeff010275939018c507ed9cf366d309d4614b2e43ca3c0090603008db080000848374dd2a47335f0252c8caa066b94de4bf800f804a5d050000000075",
        "currencyvalues": {
          "iECDGNNufPkSa9aHfbnQUjvhRN6YGR8eKM": 97368.28248208,
          "iFZC7A1HnnJGwBmoPjX3mG37RKbjZZLPhm": 0.90000000,
          "iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq": 2.99396832
        },
        "currencynames": {},
        "satoshis": 299396832,
        "height": 39405,
        "blocktime": 1684580377
      }
    ]

    const validation = validateFundedCurrencyTransfer(
      system, 
      fundedtx, 
      unfundedtx, 
      changeaddr, 
      networks.verustest, 
      utxos
    )

    assert.deepStrictEqual(validation, { valid: false, message: "Transaction hex does not match unfunded component." })
  })

  it('fails on tx with input not in input list', function () {
    const unfundedtx = "0400008085202f89000100e1f505000000001976a91487bcb238974658d8bda6a19f9d3f2dd04339b8f788ac00000000f2aa00000000000000000000000000"
    const fundedtx = '0400008085202f89026b0611ccc9f1f3e4572c02f984de1999726625b1c482ace67581def10253e9050100000000feffffff03060104010103040704020104060101020605010402040605010601020301050100000000feffffff02d066e20b00000000781a040300010114f9ff43bb7debfcb57a19eeb6b67e68733edbba55cc4c59040309010114f9ff43bb7debfcb57a19eeb6b67e68733edbba553e86fefeff010275939018c507ed9cf366d309d4614b2e43ca3c0090603008db080000848374dd2a47335f0252c8caa066b94de4bf800f804a5d05000000007500e1f505000000001976a91487bcb238974658d8bda6a19f9d3f2dd04339b8f788ac00000000f2aa00000000000000000000000000'
    const changeaddr = "RY548NkKzkWFPQpteeoaZ4FEnex8Rt8eoH"
    const system = "iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq"
    const utxos = [
      {
        "address": "RF8ZdvjvGMNdtu3jNwcmaTDeU8hFJ28ajN",
        "txid": "05e95302f1de8175e6ac82c4b12566729919de84f9022c57e4f3f1c9cc11066b",
        "outputIndex": 1,
        "isspendable": 1,
        "script": "1a040300010114402f01e78edb0f5c8251658dde07f0d52b12e972cc4c59040309010114402f01e78edb0f5c8251658dde07f0d52b12e9723e86fefeff010275939018c507ed9cf366d309d4614b2e43ca3c0090603008db080000848374dd2a47335f0252c8caa066b94de4bf800f804a5d050000000075",
        "currencyvalues": {
          "iECDGNNufPkSa9aHfbnQUjvhRN6YGR8eKM": 97368.28248208,
          "iFZC7A1HnnJGwBmoPjX3mG37RKbjZZLPhm": 0.90000000,
          "iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq": 2.99396832
        },
        "currencynames": {},
        "satoshis": 299396832,
        "height": 39405,
        "blocktime": 1684580377
      }
    ]

    const validation = validateFundedCurrencyTransfer(
      system, 
      fundedtx, 
      unfundedtx, 
      changeaddr, 
      networks.verustest, 
      utxos
    )

    assert.deepStrictEqual(validation, { valid: false, message: "Cannot find corresponding input for 0501030201060105060402040105060201010604010204070403010104010603 index 1." })
  })

  it('fails on tx with unsupported master eval code', function () {
    const unfundedtx = "0400008085202f89000100e1f505000000001976a91487bcb238974658d8bda6a19f9d3f2dd04339b8f788ac00000000f2aa00000000000000000000000000"
    const fundedtx = '0400008085202f89016b0611ccc9f1f3e4572c02f984de1999726625b1c482ace67581def10253e9050100000000feffffff02d066e20b00000000781a040300010114402f01e78edb0f5c8251658dde07f0d52b12e972cc4c59040309010114402f01e78edb0f5c8251658dde07f0d52b12e9723e86fefeff010275939018c507ed9cf366d309d4614b2e43ca3c0090603008db080000848374dd2a47335f0252c8caa066b94de4bf800f804a5d05000000007500e1f505000000001976a91487bcb238974658d8bda6a19f9d3f2dd04339b8f788ac00000000f2aa00000000000000000000000000'
    const changeaddr = "RF8ZdvjvGMNdtu3jNwcmaTDeU8hFJ28ajN"
    const system = "iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq"
    const utxos = [
      {
        address: 'RF8ZdvjvGMNdtu3jNwcmaTDeU8hFJ28ajN',
        txid: '05e95302f1de8175e6ac82c4b12566729919de84f9022c57e4f3f1c9cc11066b',
        outputIndex: 1,
        isspendable: 1,
        script: '4c59040304010114402f01e78edb0f5c8251658dde07f0d52b12e9723e86fefeff010275939018c507ed9cf366d309d4614b2e43ca3c0090603008db080000848374dd2a47335f0252c8caa066b94de4bf800f804a5d0500000000cc4c59040309010114402f01e78edb0f5c8251658dde07f0d52b12e9723e86fefeff010275939018c507ed9cf366d309d4614b2e43ca3c0090603008db080000848374dd2a47335f0252c8caa066b94de4bf800f804a5d050000000075',
        currencyvalues: {
          iECDGNNufPkSa9aHfbnQUjvhRN6YGR8eKM: 97368.28248208,
          iFZC7A1HnnJGwBmoPjX3mG37RKbjZZLPhm: 0.9,
          iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq: 2.99396832
        },
        currencynames: {},
        satoshis: 299396832,
        height: 39405,
        blocktime: 1684580377
      }
    ]

    const validation = validateFundedCurrencyTransfer(
      system, 
      fundedtx, 
      unfundedtx, 
      changeaddr, 
      networks.verustest, 
      utxos
    )

    assert.deepStrictEqual(validation, { valid: false, message: "Unsupported eval code 4" })
  })

  it('fails on tx with multisig master on change', function () {
    const unfundedtx = "0400008085202f89000100e1f505000000001976a91487bcb238974658d8bda6a19f9d3f2dd04339b8f788ac00000000f2aa00000000000000000000000000"
    const fundedtx = '0400008085202f89016b0611ccc9f1f3e4572c02f984de1999726625b1c482ace67581def10253e9050100000000feffffff02d066e20b00000000781a040300010214f9ff43bb7debfcb57a19eeb6b67e68733edbba55cc4c59040309010114f9ff43bb7debfcb57a19eeb6b67e68733edbba553e86fefeff010275939018c507ed9cf366d309d4614b2e43ca3c0090603008db080000848374dd2a47335f0252c8caa066b94de4bf800f804a5d05000000007500e1f505000000001976a91487bcb238974658d8bda6a19f9d3f2dd04339b8f788ac00000000f2aa00000000000000000000000000'
    const changeaddr = "RY548NkKzkWFPQpteeoaZ4FEnex8Rt8eoH"
    const system = "iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq"
    const utxos = [
      {
        address: 'RF8ZdvjvGMNdtu3jNwcmaTDeU8hFJ28ajN',
        txid: '05e95302f1de8175e6ac82c4b12566729919de84f9022c57e4f3f1c9cc11066b',
        outputIndex: 1,
        isspendable: 1,
        script: '1a040300010214402f01e78edb0f5c8251658dde07f0d52b12e972cc4c59040309010114402f01e78edb0f5c8251658dde07f0d52b12e9723e86fefeff010275939018c507ed9cf366d309d4614b2e43ca3c0090603008db080000848374dd2a47335f0252c8caa066b94de4bf800f804a5d050000000075',
        currencyvalues: {
          iECDGNNufPkSa9aHfbnQUjvhRN6YGR8eKM: 97368.28248208,
          iFZC7A1HnnJGwBmoPjX3mG37RKbjZZLPhm: 0.9,
          iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq: 2.99396832
        },
        currencynames: {},
        satoshis: 299396832,
        height: 39405,
        blocktime: 1684580377
      }
    ]

    const validation = validateFundedCurrencyTransfer(
      system, 
      fundedtx, 
      unfundedtx, 
      changeaddr, 
      networks.verustest, 
      utxos
    )

    assert.deepStrictEqual(validation, { valid: false, message: "Multisig change unsupported" })
  })

  it('fails on tx with multisig params on change', function () {
    const unfundedtx = "0400008085202f89000100e1f505000000001976a91487bcb238974658d8bda6a19f9d3f2dd04339b8f788ac00000000f2aa00000000000000000000000000"
    const fundedtx = '0400008085202f89016b0611ccc9f1f3e4572c02f984de1999726625b1c482ace67581def10253e9050100000000feffffff02d066e20b000000008d1a040300010114f9ff43bb7debfcb57a19eeb6b67e68733edbba55cc4c6e040309010214f9ff43bb7debfcb57a19eeb6b67e68733edbba5514f9ff43bb7debfcb57a19eeb6b67e68733edbba553e86fefeff010275939018c507ed9cf366d309d4614b2e43ca3c0090603008db080000848374dd2a47335f0252c8caa066b94de4bf800f804a5d05000000007500e1f505000000001976a91487bcb238974658d8bda6a19f9d3f2dd04339b8f788ac00000000f2aa00000000000000000000000000'
    const changeaddr = "RY548NkKzkWFPQpteeoaZ4FEnex8Rt8eoH"
    const system = "iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq"
    const utxos = [
      {
        address: 'RF8ZdvjvGMNdtu3jNwcmaTDeU8hFJ28ajN',
        txid: '05e95302f1de8175e6ac82c4b12566729919de84f9022c57e4f3f1c9cc11066b',
        outputIndex: 1,
        isspendable: 1,
        script: '1a040300010214402f01e78edb0f5c8251658dde07f0d52b12e972cc4c59040309010114402f01e78edb0f5c8251658dde07f0d52b12e9723e86fefeff010275939018c507ed9cf366d309d4614b2e43ca3c0090603008db080000848374dd2a47335f0252c8caa066b94de4bf800f804a5d050000000075',
        currencyvalues: {
          iECDGNNufPkSa9aHfbnQUjvhRN6YGR8eKM: 97368.28248208,
          iFZC7A1HnnJGwBmoPjX3mG37RKbjZZLPhm: 0.9,
          iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq: 2.99396832
        },
        currencynames: {},
        satoshis: 299396832,
        height: 39405,
        blocktime: 1684580377
      }
    ]

    const validation = validateFundedCurrencyTransfer(
      system, 
      fundedtx, 
      unfundedtx, 
      changeaddr, 
      networks.verustest, 
      utxos
    )

    assert.deepStrictEqual(validation, { valid: false, message: "Multisig change unsupported" })
  })

  it('calculates fee in reserve transfer correctly', function () {
    const unfundedtx = "0400008085202f8900019d91377700000000ab1a040300010114cb8a0f7f651b484a81e2312c3438deb601e27368cc4c8c040308010114cb8a0f7f651b484a81e2312c3438deb601e273684c7001a6ef9ea235635e328124ff3429db9f9e91b64e2d86b8d5a70043a6ef9ea235635e328124ff3429db9f9e91b64e2d86fa1d0214dceb28eb662cdb099d5abe534c2a2bef41779a3a13c8f913588b735491348ec5ac521ec1e1074df28180b9d2700f118cf9dfbb515b3113457a27abfb7500000000711c01000000000000000000000000"
    const fundedtx = '0400008085202f8901a06e98c3be88bea873bd58fa0a2c9429091b8f04c858df8d868735fd5adbce5f0000000000ffffffff02535fd517000000001976a914dceb28eb662cdb099d5abe534c2a2bef41779a3a88ac9d91377700000000ab1a040300010114cb8a0f7f651b484a81e2312c3438deb601e27368cc4c8c040308010114cb8a0f7f651b484a81e2312c3438deb601e273684c7001a6ef9ea235635e328124ff3429db9f9e91b64e2d86b8d5a70043a6ef9ea235635e328124ff3429db9f9e91b64e2d86fa1d0214dceb28eb662cdb099d5abe534c2a2bef41779a3a13c8f913588b735491348ec5ac521ec1e1074df28180b9d2700f118cf9dfbb515b3113457a27abfb7500000000711c01000000000000000000000000'
    const changeaddr = "RVRJSunui8AqYD7kb868eeKW5h8dvMu2YP"
    const system = "iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq"
    const utxos = [
        {
            "address": "RVRJSunui8AqYD7kb868eeKW5h8dvMu2YP",
            "blocktime": 1683034145,
            "height": 14494,
            "isspendable": 0,
            "outputIndex": 0,
            "satoshis": 0,
            "script": "1a040300010114dceb28eb662cdb099d5abe534c2a2bef41779a3acc3b040311010114dceb28eb662cdb099d5abe534c2a2bef41779a3a20ee2efcc72aab0ffecccb62cd08fce149353f287f959deeacfa9876284e63d7be75",
            "txid": "aab8df735bca2ee24add3e7812bcd43b86f2eb8bb68c4693890e6b3960df8e89",
            "currencyvalues": {},
            "currencynames": {}
        },
        {
            "address": "RVRJSunui8AqYD7kb868eeKW5h8dvMu2YP",
            "blocktime": 1683034938,
            "height": 14516,
            "isspendable": 0,
            "outputIndex": 0,
            "satoshis": 0,
            "script": "1a040300010114dceb28eb662cdb099d5abe534c2a2bef41779a3acc3b040311010114dceb28eb662cdb099d5abe534c2a2bef41779a3a20b444c1c80b409254fb914e738920fd92e26dd2eb1d5f056987edeab958652c7575",
            "txid": "dc87854518464b4f02b14aba00c680fea3b826338b403034a2cb081f2731460c",
            "currencyvalues": {},
            "currencynames": {}
        },
        {
            "address": "RVRJSunui8AqYD7kb868eeKW5h8dvMu2YP",
            "blocktime": 1683034938,
            "height": 14516,
            "isspendable": 0,
            "outputIndex": 0,
            "satoshis": 0,
            "script": "1a040300010114dceb28eb662cdb099d5abe534c2a2bef41779a3acc3b040311010114dceb28eb662cdb099d5abe534c2a2bef41779a3a209cd356f40472325236b3c32e48e01d129085063867d9678ce478b9bc6319f86675",
            "txid": "ddcc4299e870f91ab3b940b4d10be012011df90d8e445318fec0c32443839f48",
            "currencyvalues": {},
            "currencynames": {}
        },
        {
            "address": "RVRJSunui8AqYD7kb868eeKW5h8dvMu2YP",
            "blocktime": 1683037254,
            "height": 14540,
            "isspendable": 0,
            "outputIndex": 0,
            "satoshis": 0,
            "script": "1a040300010114dceb28eb662cdb099d5abe534c2a2bef41779a3acc3b040311010114dceb28eb662cdb099d5abe534c2a2bef41779a3a20cfcdce09921ea3e7201db60f7eac0fbc7454912ff1f3ba9fd9019d9b7322b9ab75",
            "txid": "d778b5be869a95887671fbe661b77aa29a437dd670bdc581a7f1ed13222c88a4",
            "currencyvalues": {},
            "currencynames": {}
        },
        {
            "address": "RVRJSunui8AqYD7kb868eeKW5h8dvMu2YP",
            "blocktime": 1683038255,
            "height": 14545,
            "isspendable": 0,
            "outputIndex": 0,
            "satoshis": 0,
            "script": "1a040300010114dceb28eb662cdb099d5abe534c2a2bef41779a3acc3b040311010114dceb28eb662cdb099d5abe534c2a2bef41779a3a2081ebe2fe091bb37cdb7052410504c87ec8e6154c9741aa64280b4addee964b4d75",
            "txid": "676ccef766d808a3e7ab60a32226273a15bbce300db6ebea3b944b65043655cf",
            "currencyvalues": {},
            "currencynames": {}
        },
        {
            "address": "RVRJSunui8AqYD7kb868eeKW5h8dvMu2YP",
            "blocktime": 1684316342,
            "currencyvalues": {
                "iECDGNNufPkSa9aHfbnQUjvhRN6YGR8eKM": 10.428845
            },
            "height": 35127,
            "isspendable": 1,
            "outputIndex": 0,
            "satoshis": 0,
            "script": "1a040300010114dceb28eb662cdb099d5abe534c2a2bef41779a3acc35040309010114dceb28eb662cdb099d5abe534c2a2bef41779a3a1a0175939018c507ed9cf366d309d4614b2e43ca3c0082f0a3ce1475",
            "txid": "1f522e9a0264aa79e74ad7e7d864d85a9b078bf94e9eb33f1f787ec53216a82c",
            "currencynames": {}
        },
        {
            "address": "RVRJSunui8AqYD7kb868eeKW5h8dvMu2YP",
            "blocktime": 1684316342,
            "currencyvalues": {
                "iFZC7A1HnnJGwBmoPjX3mG37RKbjZZLPhm": 0.1
            },
            "height": 35127,
            "isspendable": 1,
            "outputIndex": 0,
            "satoshis": 0,
            "script": "1a040300010114dceb28eb662cdb099d5abe534c2a2bef41779a3acc34040309010114dceb28eb662cdb099d5abe534c2a2bef41779a3a1901848374dd2a47335f0252c8caa066b94de4bf800f83e1ac0075",
            "txid": "c7a605350d7d28acc819cb7d5e994a944f510657531ab900b3261b29b5003676",
            "currencynames": {}
        },
        {
            "address": "RVRJSunui8AqYD7kb868eeKW5h8dvMu2YP",
            "blocktime": 1685649962,
            "height": 56654,
            "isspendable": 1,
            "outputIndex": 0,
            "satoshis": 2499990000,
            "script": "76a914dceb28eb662cdb099d5abe534c2a2bef41779a3a88ac",
            "txid": "f1425fbfced0e4f02189e827ee6d23cb7b7654dcb4ca38dcbe6b1eb813723a6b",
            "currencyvalues": {},
            "currencynames": {}
        },
        {
            "address": "RVRJSunui8AqYD7kb868eeKW5h8dvMu2YP",
            "blocktime": 1686350002,
            "height": 67936,
            "isspendable": 1,
            "outputIndex": 0,
            "satoshis": 2399990000,
            "script": "76a914dceb28eb662cdb099d5abe534c2a2bef41779a3a88ac",
            "txid": "5fcedb5afd3587868ddf58c8048f1b0929942c0afa58bd73a8be88bec3986ea0",
            "currencyvalues": {},
            "currencynames": {}
        },
        {
            "address": "RVRJSunui8AqYD7kb868eeKW5h8dvMu2YP",
            "blocktime": 1686350002,
            "height": 67936,
            "isspendable": 1,
            "outputIndex": 1,
            "satoshis": 100000000,
            "script": "76a914dceb28eb662cdb099d5abe534c2a2bef41779a3a88ac",
            "txid": "5fcedb5afd3587868ddf58c8048f1b0929942c0afa58bd73a8be88bec3986ea0",
            "currencyvalues": {},
            "currencynames": {}
        }
    ]

    const validation = validateFundedCurrencyTransfer(
      system, 
      fundedtx, 
      unfundedtx, 
      changeaddr, 
      networks.verustest, 
      utxos
    )

    assert.deepStrictEqual(validation, {
      valid: true,
      in: { iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq: '2399990000' },
      out: { iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq: '2399990000' },
      change: { iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq: '399859539' },
      fees: { iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq: '130461' },
      sent: { iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq: '2000000000' }
    })
  })

  it('creates an unfunded off-chain conversion', function () {
    const system = "iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq"
    const destbytes = fromBase58Check("RF8ZdvjvGMNdtu3jNwcmaTDeU8hFJ28ajN").hash

    const unfundedTransfer = createUnfundedCurrencyTransfer(
      system,
      [{
        currency: system,
        satoshis: "100000000",
        convertto: "iNC9NG5Jqk2tqVtqfjfiSpaqxrXaFU6RDu",
        exportto: "iNC9NG5Jqk2tqVtqfjfiSpaqxrXaFU6RDu",
        feecurrency: system,
        via: "iCmr2i7wECJzuGisQeUFQJJCASW66Jp7QG",
        address: new TransferDestination({
          type: DEST_PKH.xor(FLAG_DEST_AUX),
          destination_bytes: destbytes,
          aux_dests: [
            new TransferDestination({
              type: DEST_PKH,
              destination_bytes: destbytes
            })
          ]
        }),
        preconvert: false,
        burn: false,
        burnweight: false,
        mintnew: false
      }],
      networks.verustest,
      67000,
      4,
      0x892f2085
    )

    assert.equal(unfundedTransfer, "0400008085202f890001e074fa0500000000d71a040300010114cb8a0f7f651b484a81e2312c3438deb601e27368cc4cb8040308010114cb8a0f7f651b484a81e2312c3438deb601e273684c9c01a6ef9ea235635e328124ff3429db9f9e91b64e2daed6c1008743a6ef9ea235635e328124ff3429db9f9e91b64e2d91a6604214402f01e78edb0f5c8251658dde07f0d52b12e97201160214402f01e78edb0f5c8251658dde07f0d52b12e97265ffba3d69510d6f31845e60b9ee0c275389f84fcd51509db53e822df7eed11cac11e7b729e22400cd51509db53e822df7eed11cac11e7b729e224007500000000b80501000000000000000000000000")
  })

  it('creates unfunded same chain conversion', function () {
    const system = "iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq"
    const destbytes = fromBase58Check("RF8ZdvjvGMNdtu3jNwcmaTDeU8hFJ28ajN").hash

    const unfundedTransfer = createUnfundedCurrencyTransfer(
      system,
      [{
        currency: system,
        satoshis: "100000000",
        convertto: "iBBRjDbPf3wdFpghLotJQ3ESjtPBxn6NS3",
        feecurrency: system,
        via: "i84mndBk2Znydpgm9T9pTjVvBnHkhErzLt",
        address: new TransferDestination({
          type: DEST_PKH.xor(FLAG_DEST_AUX),
          destination_bytes: destbytes,
          aux_dests: [
            new TransferDestination({
              type: DEST_PKH,
              destination_bytes: destbytes
            })
          ]
        }),
        preconvert: false,
        burn: false,
        burnweight: false,
        mintnew: false
      }],
      networks.verustest,
      67000,
      4,
      0x892f2085
    )

    assert.equal(unfundedTransfer, "0400008085202f890001e074fa0500000000c31a040300010114cb8a0f7f651b484a81e2312c3438deb601e27368cc4ca4040308010114cb8a0f7f651b484a81e2312c3438deb601e273684c8801a6ef9ea235635e328124ff3429db9f9e91b64e2daed6c1008703a6ef9ea235635e328124ff3429db9f9e91b64e2d91a6604214402f01e78edb0f5c8251658dde07f0d52b12e97201160214402f01e78edb0f5c8251658dde07f0d52b12e972325aa0d080ddfdef2d50028cfeb07a834d42bf5554852c4e9fb1d4c4291fc093e41ce2c7befa40767500000000b80501000000000000000000000000")
  })

  it('creates unfunded conversion with import to source', function () {
    const system = "iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq"
    const destbytes = fromBase58Check("RF8ZdvjvGMNdtu3jNwcmaTDeU8hFJ28ajN").hash

    const unfundedTransfer = createUnfundedCurrencyTransfer(
      system,
      [{
        currency: "iBBRjDbPf3wdFpghLotJQ3ESjtPBxn6NS3",
        satoshis: "100000000",
        convertto: system,
        feecurrency: system,
        via: "i84mndBk2Znydpgm9T9pTjVvBnHkhErzLt",
        address: new TransferDestination({
          type: DEST_PKH.xor(FLAG_DEST_AUX),
          destination_bytes: destbytes,
          aux_dests: [
            new TransferDestination({
              type: DEST_PKH,
              destination_bytes: destbytes
            })
          ]
        }),
        preconvert: false,
        burn: false,
        burnweight: false,
        mintnew: false,
        importtosource: true
      }],
      networks.verustest,
      70000,
      4,
      0x892f2085
    )

    assert.equal(unfundedTransfer, "0400008085202f890001e093040000000000c31a040300010114cb8a0f7f651b484a81e2312c3438deb601e27368cc4ca4040308010114cb8a0f7f651b484a81e2312c3438deb601e273684c880154852c4e9fb1d4c4291fc093e41ce2c7befa4076aed6c1008b03a6ef9ea235635e328124ff3429db9f9e91b64e2d91a6604214402f01e78edb0f5c8251658dde07f0d52b12e97201160214402f01e78edb0f5c8251658dde07f0d52b12e972325aa0d080ddfdef2d50028cfeb07a834d42bf55a6ef9ea235635e328124ff3429db9f9e91b64e2d7500000000701101000000000000000000000000")
  })

  it('creates unfunded eval_none', function () {
    const system = "iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq"
    const destbytes = fromBase58Check("i6gN8cLxYpFyquahzBco6cNNuNacj9c8SR").hash

    const unfundedTransfer = createUnfundedCurrencyTransfer(
      system,
      [{
        currency: "iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq",
        satoshis: "100000000",
        address: new TransferDestination({
          type: DEST_ID,
          destination_bytes: destbytes,
        }),
        preconvert: false,
        burn: false,
        burnweight: false,
        mintnew: false,
        importtosource: false
      }],
      networks.verustest,
      111759,
      4,
      0x892f2085
    )

    assert.equal(unfundedTransfer, "0400008085202f89000100e1f5050000000024050403000000cc1b0403000101150423259accb5fb1ab856e539e76eccbacc2452b41875000000008fb401000000000000000000000000")
  })

  it('can validate spend with coinbase input (mined)', function () {
    const unfundedtx = "0400008085202f89000100e1f5050000000024050403000000cc1b0403000101150423259accb5fb1ab856e539e76eccbacc2452b41875000000008fb401000000000000000000000000"
    const fundedtx = '0400008085202f8901b55c45e85efeb615ed84235740a96739ff9b9703df1ee8f3b972237a314b59e30000000000ffffffff02b0f20a0900000000531a040300010114002d3311c38bfd219092d2aef449804be8b3befecc35040309010114002d3311c38bfd219092d2aef449804be8b3befe1a01cd51509db53e822df7eed11cac11e7b729e2240080bdd6f9607500e1f5050000000024050403000000cc1b0403000101150423259accb5fb1ab856e539e76eccbacc2452b41875000000008fb401000000000000000000000000'
    const changeaddr = "R9J8E2no2HVjQmzX6Ntes2ShSGcn7WiRcx"
    const system = "iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq"
    const utxos = [{
      "address": "R9J8E2no2HVjQmzX6Ntes2ShSGcn7WiRcx",
      "blocktime": 1688908700,
      "currencyvalues": {
          "iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq": 2.51722432,
          "iNC9NG5Jqk2tqVtqfjfiSpaqxrXaFU6RDu": 3.999
      },
      "height": 109217,
      "isspendable": 1,
      "outputIndex": 0,
      "satoshis": 251722432,
      "script": "1a040300010114002d3311c38bfd219092d2aef449804be8b3befecc35040309010114002d3311c38bfd219092d2aef449804be8b3befe1a01cd51509db53e822df7eed11cac11e7b729e2240080bdd6f96075",
      "txid": "e3594b317a2372b9f3e81edf03979bff3967a940572384ed15b6fe5ee8455cb5",
      "currencynames": {}
    }]

    const validation = validateFundedCurrencyTransfer(
      system, 
      fundedtx, 
      unfundedtx, 
      changeaddr, 
      networks.verustest, 
      utxos
    )

    assert.deepStrictEqual(validation, {
      valid: true,
      in: {
        iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq: '251722432',
        iNC9NG5Jqk2tqVtqfjfiSpaqxrXaFU6RDu: '399900000'
      },
      out: {
        iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq: '251712432',
        iNC9NG5Jqk2tqVtqfjfiSpaqxrXaFU6RDu: '399900000'
      },
      change: {
        iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq: '151712432',
        iNC9NG5Jqk2tqVtqfjfiSpaqxrXaFU6RDu: '399900000'
      },
      fees: {
        iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq: '10000',
        iNC9NG5Jqk2tqVtqfjfiSpaqxrXaFU6RDu: '0'
      },
      sent: {
        iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq: '100000000',
        iNC9NG5Jqk2tqVtqfjfiSpaqxrXaFU6RDu: '0'
      }
    })
  })

  it('creates unfunded export with no conversion', function () {
    const system = "iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq"
    const destbytes = fromBase58Check("RF8ZdvjvGMNdtu3jNwcmaTDeU8hFJ28ajN").hash

    const unfundedTransfer = createUnfundedCurrencyTransfer(
      system,
      [{
        currency: "iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq",
        satoshis: "100000000",
        feecurrency: system,
        address: new TransferDestination({
          type: DEST_PKH.xor(FLAG_DEST_AUX),
          destination_bytes: destbytes,
          aux_dests: [
            new TransferDestination({
              type: DEST_PKH,
              destination_bytes: destbytes
            })
          ]
        }),
        exportto: "iNC9NG5Jqk2tqVtqfjfiSpaqxrXaFU6RDu",
        preconvert: false,
        burn: false,
        burnweight: false,
        mintnew: false,
        bridgeid: "iCmr2i7wECJzuGisQeUFQJJCASW66Jp7QG"
      }],
      networks.verustest,
      70000,
      4,
      0x892f2085
    )

    assert.equal(unfundedTransfer, "0400008085202f890001e074fa0500000000c21a040300010114cb8a0f7f651b484a81e2312c3438deb601e27368cc4ca3040308010114cb8a0f7f651b484a81e2312c3438deb601e273684c8701a6ef9ea235635e328124ff3429db9f9e91b64e2daed6c10041a6ef9ea235635e328124ff3429db9f9e91b64e2d91a6604214402f01e78edb0f5c8251658dde07f0d52b12e97201160214402f01e78edb0f5c8251658dde07f0d52b12e97265ffba3d69510d6f31845e60b9ee0c275389f84fcd51509db53e822df7eed11cac11e7b729e224007500000000701101000000000000000000000000")
  })

  it('creates unfunded PKH tx', function () {
    const system = "iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq"
    const destbytes = fromBase58Check("RVRJSunui8AqYD7kb868eeKW5h8dvMu2YP").hash

    const unfundedTransfer = createUnfundedCurrencyTransfer(
      system,
      [{
        currency: system,
        satoshis: "2499980000",
        address: new TransferDestination({
          type: DEST_PKH,
          destination_bytes: destbytes
        }),
        preconvert: false,
        burn: false,
        burnweight: false,
        mintnew: false
      }],
      networks.verustest,
      77379,
      4,
      0x892f2085
    )

    assert.equal(unfundedTransfer, "0400008085202f890001e0aa0295000000001976a914dceb28eb662cdb099d5abe534c2a2bef41779a3a88ac00000000432e01000000000000000000000000")
  })

  it('creates unfunded PKH', function () {
    const system = "iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq"
    const destbytes = fromBase58Check("RF8ZdvjvGMNdtu3jNwcmaTDeU8hFJ28ajN").hash

    const unfundedTransfer = createUnfundedCurrencyTransfer(
      system,
      [{
        currency: "i5GQFGvDunSHk417JhRZRYxrJRKoS9SH1p",
        satoshis: "100000000",
        address: new TransferDestination({
          type: DEST_PKH,
          destination_bytes: destbytes
        })
      }],
      networks.verustest,
      67500,
      4,
      0x892f2085
    )

    assert.equal(unfundedTransfer, "0400008085202f8900010000000000000000521a040300010114402f01e78edb0f5c8251658dde07f0d52b12e972cc34040309010114402f01e78edb0f5c8251658dde07f0d52b12e972190113a542e2075696772ee9861c9b2a4d55c86cf353aed6c1007500000000ac0701000000000000000000000000")
  })

  it('creates and validates updateidentity tx', function () {
    const txb = new TransactionBuilder(networks.verustest);
    const script = "470403000103150438411ff17100e15b6df8dd72fecbe4fa4964dfea150438411ff17100e15b6df8dd72fecbe4fa4964dfea150438411ff17100e15b6df8dd72fecbe4fa4964dfeacc4d020104030e0101150438411ff17100e15b6df8dd72fecbe4fa4964dfea4cad03000000000000000114c165bce63e47698278f859ee75c35c78eb23e8df01000000a6ef9ea235635e328124ff3429db9f9e91b64e2d085665727573506179000038411ff17100e15b6df8dd72fecbe4fa4964dfea38411ff17100e15b6df8dd72fecbe4fa4964dfea0176041f9ab6ca1d155ce87a7c677e9e0d16c9846e6ee62db670751f8be3ead27cb740aa7595d0be24b741a9a6ef9ea235635e328124ff3429db9f9e91b64e2d000000001b04030f0101150438411ff17100e15b6df8dd72fecbe4fa4964dfea1b0403100101150438411ff17100e15b6df8dd72fecbe4fa4964dfea75"

    txb.setVersion(4);
    txb.setExpiryHeight(600000);
    txb.setVersionGroupId(0x892f2085);

    const [master, checkcc, params, drop] = decompile(Buffer.from(script, 'hex')) as [Buffer, number, Buffer, number];
    const paramsOptCC = OptCCParams.fromChunk(params);

    const identity = new Identity();
    identity.fromBuffer(paramsOptCC.getParamObject()!);

    const contentmap = new Map();
    contentmap.set("i5GQFGvDunSHk417JhRZRYxrJRKoS9SH1p", Buffer.from("c45c3e2987f09e8c48d9e2681288bd455a18ebc73ef977750724a7fc51bd3263", 'hex'));

    identity.content_map = contentmap;

    paramsOptCC.vdata[0] = identity.toBuffer();

    const newParamsOut = paramsOptCC.toChunk();

    const newScript = compile([
      master,
      checkcc,
      newParamsOut,
      drop
    ])

    txb.addOutput(newScript, 0);

    const txunfunded = txb.buildIncomplete().toHex()
    const txfunded = "0400008085202f8901daf7ffe9770aa4e2b85ef1add1430d9bce3559b5828211e86e69cdd4ba20fbbe0100000000feffffff021ebca70500000000531a040300010114188246cf1dfc01ef01164a57319eaac36c861d95cc35040309010114188246cf1dfc01ef01164a57319eaac36c861d951a01c0bfd996f3716d9d397db9b1070756b4d8ac9a5abda2ff876b750000000000000000fd8301470403000103150438411ff17100e15b6df8dd72fecbe4fa4964dfea150438411ff17100e15b6df8dd72fecbe4fa4964dfea150438411ff17100e15b6df8dd72fecbe4fa4964dfeacc4d360104030e0101150438411ff17100e15b6df8dd72fecbe4fa4964dfea4ce103000000000000000114c165bce63e47698278f859ee75c35c78eb23e8df01000000a6ef9ea235635e328124ff3429db9f9e91b64e2d085665727573506179000113a542e2075696772ee9861c9b2a4d55c86cf353c45c3e2987f09e8c48d9e2681288bd455a18ebc73ef977750724a7fc51bd326338411ff17100e15b6df8dd72fecbe4fa4964dfea38411ff17100e15b6df8dd72fecbe4fa4964dfea0176041f9ab6ca1d155ce87a7c677e9e0d16c9846e6ee62db670751f8be3ead27cb740aa7595d0be24b741a9a6ef9ea235635e328124ff3429db9f9e91b64e2d000000001b04030f0101150438411ff17100e15b6df8dd72fecbe4fa4964dfea1b0403100101150438411ff17100e15b6df8dd72fecbe4fa4964dfea7500000000c02709000000000000000000000000";
    
    const validation = validateFundedCurrencyTransfer("iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq", txfunded, txunfunded, "RBWnMtxkXztx1J89EEeZ21P1Z74My2SnuM", networks.verustest, [{
      address: "RR84cAEnJVsUbkCqJuDqRNEz3MwXQsx1ZY",
      txid: "befb20bad4cd696ee8118282b55935ce9b0d43d1adf15eb8e2a40a77e9fff7da",
      outputIndex: 1,
      script: "1a040300010114adc808280b6b5251a5924c9a658798f72197c1bbcc35040309010114adc808280b6b5251a5924c9a658798f72197c1bb1a01c0bfd996f3716d9d397db9b1070756b4d8ac9a5abda2ff876b75",
      currencyvalues: {},
      currencynames: {},
      satoshis: 94888750,
      height: 455475,
      isspendable: 1,
      blocktime: 1710344447
    }]);
    
    const prevouts = [Buffer.from("1a040300010114adc808280b6b5251a5924c9a658798f72197c1bbcc35040309010114adc808280b6b5251a5924c9a658798f72197c1bb1a01c0bfd996f3716d9d397db9b1070756b4d8ac9a5abda2ff876b75", 'hex')]
    
    const lastVerusIdOutputHash = Buffer.from("befb20bad4cd696ee8118282b55935ce9b0d43d1adf15eb8e2a40a77e9fff7da", 'hex').reverse();
    const lastVerusIdOutputScript = "470403000103150438411ff17100e15b6df8dd72fecbe4fa4964dfea150438411ff17100e15b6df8dd72fecbe4fa4964dfea150438411ff17100e15b6df8dd72fecbe4fa4964dfeacc4d020104030e0101150438411ff17100e15b6df8dd72fecbe4fa4964dfea4cad03000000000000000114c165bce63e47698278f859ee75c35c78eb23e8df01000000a6ef9ea235635e328124ff3429db9f9e91b64e2d085665727573506179000038411ff17100e15b6df8dd72fecbe4fa4964dfea38411ff17100e15b6df8dd72fecbe4fa4964dfea0176041f9ab6ca1d155ce87a7c677e9e0d16c9846e6ee62db670751f8be3ead27cb740aa7595d0be24b741a9a6ef9ea235635e328124ff3429db9f9e91b64e2d000000001b04030f0101150438411ff17100e15b6df8dd72fecbe4fa4964dfea1b0403100101150438411ff17100e15b6df8dd72fecbe4fa4964dfea75";

    assert.equal(completeFundedIdentityUpdate(txfunded, networks.verustest, prevouts, { 
      hash: lastVerusIdOutputHash,
      index: 0,
      script: Buffer.from(lastVerusIdOutputScript, "hex"),
      sequence: 4294967294
    }), "0400008085202f8902daf7ffe9770aa4e2b85ef1add1430d9bce3559b5828211e86e69cdd4ba20fbbe0100000000feffffffdaf7ffe9770aa4e2b85ef1add1430d9bce3559b5828211e86e69cdd4ba20fbbe0000000000feffffff021ebca70500000000531a040300010114188246cf1dfc01ef01164a57319eaac36c861d95cc35040309010114188246cf1dfc01ef01164a57319eaac36c861d951a01c0bfd996f3716d9d397db9b1070756b4d8ac9a5abda2ff876b750000000000000000fd8301470403000103150438411ff17100e15b6df8dd72fecbe4fa4964dfea150438411ff17100e15b6df8dd72fecbe4fa4964dfea150438411ff17100e15b6df8dd72fecbe4fa4964dfeacc4d360104030e0101150438411ff17100e15b6df8dd72fecbe4fa4964dfea4ce103000000000000000114c165bce63e47698278f859ee75c35c78eb23e8df01000000a6ef9ea235635e328124ff3429db9f9e91b64e2d085665727573506179000113a542e2075696772ee9861c9b2a4d55c86cf353c45c3e2987f09e8c48d9e2681288bd455a18ebc73ef977750724a7fc51bd326338411ff17100e15b6df8dd72fecbe4fa4964dfea38411ff17100e15b6df8dd72fecbe4fa4964dfea0176041f9ab6ca1d155ce87a7c677e9e0d16c9846e6ee62db670751f8be3ead27cb740aa7595d0be24b741a9a6ef9ea235635e328124ff3429db9f9e91b64e2d000000001b04030f0101150438411ff17100e15b6df8dd72fecbe4fa4964dfea1b0403100101150438411ff17100e15b6df8dd72fecbe4fa4964dfea7500000000c02709000000000000000000000000")
    assert.equal(validation.valid, true);
  })

  it('creates and validates updateidentity tx from identity json', function () {
    const unfundedtx = createUnfundedIdentityUpdate(
      Identity.fromJson({
        "contentmap": {
          "53f36cc8554d2a9b1c86e92e77965607e242a513": "6332bd51fca724077577f93ec7eb185a45bd881268e2d9488c9ef087293e5cc4"
        },
        "contentmultimap": {},
        "flags": 0,
        "identityaddress": "i8byHmWFAeFMajYdgrXiQ9qZ1Y9FqxJUx1",
        "minimumsignatures": 1,
        "name": "VerusPay",
        "parent": "iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq",
        "primaryaddresses": [
          "RSunNQqKnSwpNBRd6kcenScuQEFUWgL3bZ"
        ],
        "privateaddress": "zs1wczplx4kegw32h8g0f7xwl57p5tvnprwdmnzmdnsw50chcl26f7tws92wk2ap03ykaq6jyyztfa",
        "recoveryauthority": "i9ps1xDcr7eM66Fko6aTkeuvvBPZFLEXRN",
        "revocationauthority": "i98Mnj1YugaRzoURXt4aRhdqQDu7rML9J5",
        "systemid": "iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq",
        "timelock": 0,
        "version": 3
      }), networks.verustest, 473428, 4, 0x892f2085)
    
    const fundedtx = "0400008085202f8901b94a8a311c9f7c5c15ae0f1e147559e7292c36702c34a43d1ed98fdaab6f861c0100000000feffffff02f513050000000000b11a04030001011462b5647143c0e64366a6b6cb56e8799934359ee4cc4c9204030901011462b5647143c0e64366a6b6cb56e8799934359ee44c7686fefeff01043c28dd25a7127ce1b1e9a8dd9fa550a1b805dc10c0f613700000000084d881e355c1c87dd84baa2e068dc3829e140d3c002375ee14000000c0bfd996f3716d9d397db9b1070756b4d8ac9a5a6b3f7e8a01000000ca1753f4d2f16990d8db6e7972525daf6036096480539a0500000000750000000000000000fd8301470403000103150438411ff17100e15b6df8dd72fecbe4fa4964dfea15043e006293b9e3341262eed040048d3a2260367f47150445a96c0179cbb19221c0e8625a2ed691d762fd37cc4d360104030e0101150438411ff17100e15b6df8dd72fecbe4fa4964dfea4ce103000000000000000114c165bce63e47698278f859ee75c35c78eb23e8df01000000a6ef9ea235635e328124ff3429db9f9e91b64e2d085665727573506179000113a542e2075696772ee9861c9b2a4d55c86cf353c45c3e2987f09e8c48d9e2681288bd455a18ebc73ef977750724a7fc51bd32633e006293b9e3341262eed040048d3a2260367f4745a96c0179cbb19221c0e8625a2ed691d762fd370176041f9ab6ca1d155ce87a7c677e9e0d16c9846e6ee62db670751f8be3ead27cb740aa7595d0be24b741a9a6ef9ea235635e328124ff3429db9f9e91b64e2d000000001b04030f010115043e006293b9e3341262eed040048d3a2260367f471b0403100101150445a96c0179cbb19221c0e8625a2ed691d762fd377500000000543907000000000000000000000000"

    const validation = validateFundedCurrencyTransfer("iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq", fundedtx, unfundedtx, "RJH7bgE2DuShYJbEBjwBSES8na3kSPJRGY", networks.verustest, [{
      address: "RVT9cWmnnzSeAUyE2pJduh1HWDjpYe4YPH",
      txid: "1c866fabda8fd91e3da4342c70362c29e75975141e0fae155c7c9f1c318a4ab9",
      outputIndex: 1,
      script: "1a040300010114dd449dfde72c1cc9b0e94c32cf4ee1a543b1836ccc4c92040309010114dd449dfde72c1cc9b0e94c32cf4ee1a543b1836c4c7686fefeff01043c28dd25a7127ce1b1e9a8dd9fa550a1b805dc10c0f613700000000084d881e355c1c87dd84baa2e068dc3829e140d3c002375ee14000000c0bfd996f3716d9d397db9b1070756b4d8ac9a5a6b3f7e8a01000000ca1753f4d2f16990d8db6e7972525daf6036096480539a050000000075",
      currencyvalues: {
        "i8xcvrfKTw8eEiTMjt1dAQxpWcbZeaVMFV": 18.80356544,
        "iFawzbS99RqGs7J2TNxME1TmmayBGuRkA2": 899,
        "iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq": 0.00342789,
        "iM3gzspfspD8SqsNpHSaVJA2BZQrbTc7TL": 66.18496875,
        "iMu5sgTiGcaWryiwGwNTWcHxQo589xMXK8": 0.94
      },
      currencynames: {},
      satoshis: 342789,
      height: 473408,
      isspendable: 1,
      blocktime: 1711457183
    }]);

    assert.equal(validation.valid, true);

    for (const key in validation.sent) {
      assert.equal(validation.sent[key], "0");
    }

    const idscript = "470403000103150438411ff17100e15b6df8dd72fecbe4fa4964dfea15043e006293b9e3341262eed040048d3a2260367f47150445a96c0179cbb19221c0e8625a2ed691d762fd37cc4d360104030e0101150438411ff17100e15b6df8dd72fecbe4fa4964dfea4ce103000000000000000114c165bce63e47698278f859ee75c35c78eb23e8df01000000a6ef9ea235635e328124ff3429db9f9e91b64e2d085665727573506179000113a542e2075696772ee9861c9b2a4d55c86cf353c45c3e2987f09e8c48d9e2681288bd455a18ebc73ef977750724a7fc51bd32633e006293b9e3341262eed040048d3a2260367f4745a96c0179cbb19221c0e8625a2ed691d762fd370176041f9ab6ca1d155ce87a7c677e9e0d16c9846e6ee62db670751f8be3ead27cb740aa7595d0be24b741a9a6ef9ea235635e328124ff3429db9f9e91b64e2d000000001b04030f010115043e006293b9e3341262eed040048d3a2260367f471b0403100101150445a96c0179cbb19221c0e8625a2ed691d762fd3775"

    const completetx = completeFundedIdentityUpdate(fundedtx, networks.verustest, [Buffer.from("1a040300010114dd449dfde72c1cc9b0e94c32cf4ee1a543b1836ccc4c92040309010114dd449dfde72c1cc9b0e94c32cf4ee1a543b1836c4c7686fefeff01043c28dd25a7127ce1b1e9a8dd9fa550a1b805dc10c0f613700000000084d881e355c1c87dd84baa2e068dc3829e140d3c002375ee14000000c0bfd996f3716d9d397db9b1070756b4d8ac9a5a6b3f7e8a01000000ca1753f4d2f16990d8db6e7972525daf6036096480539a050000000075")],
    {
      script: Buffer.from("470403000103150438411ff17100e15b6df8dd72fecbe4fa4964dfea15043e006293b9e3341262eed040048d3a2260367f47150445a96c0179cbb19221c0e8625a2ed691d762fd37cc4d360104030e0101150438411ff17100e15b6df8dd72fecbe4fa4964dfea4ce103000000000000000114c165bce63e47698278f859ee75c35c78eb23e8df01000000a6ef9ea235635e328124ff3429db9f9e91b64e2d085665727573506179000113a542e2075696772ee9861c9b2a4d55c86cf353c45c3e2987f09e8c48d9e2681288bd455a18ebc73ef977750724a7fc51bd32633e006293b9e3341262eed040048d3a2260367f4745a96c0179cbb19221c0e8625a2ed691d762fd370176041f9ab6ca1d155ce87a7c677e9e0d16c9846e6ee62db670751f8be3ead27cb740aa7595d0be24b741a9a6ef9ea235635e328124ff3429db9f9e91b64e2d000000001b04030f010115043e006293b9e3341262eed040048d3a2260367f471b0403100101150445a96c0179cbb19221c0e8625a2ed691d762fd3775", 'hex'),
      hash: Buffer.from("1c866fabda8fd91e3da4342c70362c29e75975141e0fae155c7c9f1c318a4ab9", 'hex').reverse(),
      sequence: 4294967294,
      index: 0
    })

    assert.equal(completetx.includes(idscript), true);
  })
});