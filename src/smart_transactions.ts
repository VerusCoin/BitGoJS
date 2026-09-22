import { CurrencyValueMap, 
  GetAddressUtxosResponse, 
  RESERVE_TRANSFER_BURN_CHANGE_PRICE, 
  RESERVE_TRANSFER_BURN_CHANGE_WEIGHT, 
  RESERVE_TRANSFER_CONVERT, 
  RESERVE_TRANSFER_CROSS_SYSTEM, 
  RESERVE_TRANSFER_MINT_CURRENCY, 
  RESERVE_TRANSFER_PRECONVERT, 
  RESERVE_TRANSFER_RESERVE_TO_RESERVE,
  RESERVE_TRANSFER_IMPORT_TO_SOURCE,
  ReserveTransfer, 
  TokenOutput, 
  TransferDestination, 
  toBase58Check, 
  RESERVE_TRANSFER_DESTINATION, 
  DEST_PKH,
  DEST_ID,
  DEST_ETH,
  FLAG_DEST_AUX,
  FLAG_DEST_GATEWAY,
  RESERVE_TRANSFER_VALID,
  Identity,
  EVALS,
  IdentityScript
} from "verus-typescript-primitives";
import { BN } from "bn.js";
import { Network } from "./networkTypes";

const Transaction = require('./transaction.js');
const TransactionBuilder = require('./transaction_builder.js');
const TxDestination = require('./tx_destination.js');
const script = require('./script.js');
const opcodes = require('bitcoin-ops');
const OptCCParams = require('./optccparams');
const templates = require('./templates');

// Hack to force BigNumber to get typeof class instead of BN namespace
const BNClass = new BN(0);
type BigNumber = typeof BNClass;

type Output = { value: number, script: Buffer }

// Keep accepting the numeric spendability field used by earlier RPC responses.
type AddressUtxo = Omit<Extract<GetAddressUtxosResponse['result'], Array<unknown>>[number], 'isspendable'> & {
  isspendable: boolean | number
}

type Input = {
  hash: Buffer,
  index: number,
  script: Buffer,
  sequence: BigNumber,
  witness: Array<any>
}

type SmartTxParams = {
  eval: number,
  version: number,
  m: number,
  n: number,
  data?: TokenOutput|ReserveTransfer|Identity,
  values: { [currency: string]: BigNumber },
  fees: { [currency: string]: BigNumber }
}

type OutputParams = {
  currency: string, // sending currency i-address
  satoshis: string, // Satoshi satoshis
  convertto?: string, // i-address of currency to convert to
  exportto?: string, // i-address of system to export to
  feecurrency?: string, // i-address of fee currency
  via?: string, // i-address of currency to convert via,
  feesatoshis?: string, // satoshis of output fee
  address: TransferDestination,
  refundto?: TransferDestination,
  preconvert?: boolean,
  burn?: boolean,
  burnweight?: boolean,
  mintnew?: boolean,
  importtosource?: boolean,
  bridgeid?: string // if currency is exportto without conversion, destination currency needs to be the bridge,
  vdxftag?: string
}

// Unlike the builder's immediate fee, intent.feesatoshis authorizes the TOTAL of both legs.
export type CurrencyTransferIntent = OutputParams & { mapto?: string }

export type CurrencyTransferIntentContext = {
  currencyDefinitions: { [currency: string]: {
    systemid: string,
    gatewayid?: string,
    launchsystemid?: string,
    options: number,
    currencies?: string[]
  } },
  // One independently resolved and approved route, never copied from the candidate.
  route: {
    importCurrency: string,
    system: string,
    gateway?: { system: string, code: string }
  },
  // Both allocations are denominated in currency, including the destination leg.
  fees: { currency: string, transferSatoshis: string, destinationSatoshis: string },
  // Exact ordered refund/notary policy. Use [] when none are authorized.
  auxiliaryDestinations: TransferDestination[]
}

/**
 * Bind one RPC-created, unfunded reserve-transfer output to independently supplied
 * intent, definitions, route and exact fee allocations. Supports conversions,
 * local fractional preconversions, direct exports and a local converter followed
 * by a gateway export (including fee conversion without principal conversion).
 * Primary and auxiliary addresses must be plain PKH, ID or ETH destinations.
 * This does not authenticate definitions/chain state or replace funding validation.
 */
export const validateCurrencyTransferIntent = (
  systemId: string,
  unfundedTxHex: string,
  intent: CurrencyTransferIntent,
  network: Network,
  context: CurrencyTransferIntentContext
): { valid: boolean, message?: string } => {
  const check = (condition: boolean, message: string) => {
    if (!condition) throw new Error(message);
  };
  const amount = (value: string, name: string): BigNumber => {
    check(typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value), `${name} must be an integer satoshi string.`);
    const result = new BN(value, 10);
    check(result.bitLength() <= 63, `${name} exceeds the supported amount range.`);
    return result;
  };
  const plainDestination = (destination: TransferDestination): boolean => (
    destination instanceof TransferDestination &&
    [DEST_PKH, DEST_ID, DEST_ETH].some(type => destination.type.eq(type)) &&
    Buffer.isBuffer(destination.destinationBytes) && destination.destinationBytes.length === 20 &&
    !destination.gatewayID && !destination.gatewayCode && destination.fees.isZero() &&
    destination.auxDests.length === 0
  );
  const sameDestination = (a: TransferDestination, b: TransferDestination): boolean => (
    a.type.eq(b.type) && a.destinationBytes.equals(b.destinationBytes)
  );

  try {
    check(!!intent && !!context && !!context.route && !!context.fees &&
      !!context.currencyDefinitions && Array.isArray(context.auxiliaryDestinations),
      'Missing approved routing, currency, fee or refund context.');
    check(!intent.burn && !intent.burnweight && !intent.mintnew && intent.mapto == null && intent.vdxftag == null,
      'Unsupported requested operation.');
    check(plainDestination(intent.address), 'Intent recipient must be a plain PKH, ID or ETH destination.');
    check(context.auxiliaryDestinations.every(plainDestination), 'Unsupported auxiliary destination policy.');
    if (intent.refundto != null) {
      check(plainDestination(intent.refundto) && context.auxiliaryDestinations.length > 0 &&
        sameDestination(intent.refundto, context.auxiliaryDestinations[0]),
        'Approved refund policy does not match refundto.');
    }
    const principal = amount(intent.satoshis, 'Principal');
    check(!principal.isZero(), 'Principal must be positive.');
    const { route, fees } = context;
    const immediateFee = amount(fees.transferSatoshis, 'Immediate fee');
    const destinationFee = amount(fees.destinationSatoshis, 'Destination fee');
    const totalFee = immediateFee.add(destinationFee);
    check(totalFee.bitLength() <= 63 && (intent.currency !== fees.currency || principal.add(totalFee).bitLength() <= 63),
      'Principal and fees exceed the supported amount range.');
    if (intent.feesatoshis != null) {
      check(amount(intent.feesatoshis, 'Requested fee').eq(totalFee),
        'Approved fee allocation does not match requested fee.');
    }
    check(fees.currency === (intent.feecurrency || systemId), 'Fee currency does not match intent.');
    const definition = (id: string) => {
      const def = context.currencyDefinitions[id];
      check(!!id && !!def && !!def.systemid && Number.isInteger(def.options), `Missing currency definition for ${id}.`);
      return def;
    };
    const isFractional = (id: string) => (definition(id).options & 1) !== 0;
    const isReserve = (converter: string, reserve: string) => {
      const def = definition(converter);
      return isFractional(converter) && Array.isArray(def.currencies) && def.currencies.includes(reserve);
    };
    const systemOf = (id: string) => {
      const def = definition(id);
      return (def.options & 128) !== 0 ? (def.gatewayid || id) : def.systemid;
    };
    const exportSystem = intent.exportto ? systemOf(intent.exportto) : systemId;
    // sendcurrency clears exportto when its resolved system is the current chain.
    const exporting = exportSystem !== systemId;
    definition(intent.currency);
    definition(fees.currency);
    const importer = definition(route.importCurrency);
    const converting = intent.convertto != null && intent.convertto !== intent.currency;
    let importToSource = false;
    let destinationCurrency = route.importCurrency;
    if (converting) {
      definition(intent.convertto);
      if (intent.via != null) {
        check(!intent.preconvert && intent.via !== intent.currency && intent.via !== intent.convertto &&
          isReserve(intent.via, intent.currency) && isReserve(intent.via, intent.convertto),
          'Invalid reserve-to-reserve conversion relationship.');
        destinationCurrency = intent.via;
      } else {
        const toFractional = isReserve(intent.convertto, intent.currency);
        importToSource = !toFractional && isReserve(intent.currency, intent.convertto);
        check(toFractional || importToSource, 'Invalid reserve/fractional conversion relationship.');
        destinationCurrency = intent.convertto;
      }
      check(route.importCurrency === (importToSource ? intent.currency : destinationCurrency),
        'Approved import currency does not match conversion intent.');
    } else {
      check(!intent.preconvert, 'Preconversion requires a conversion target.');
      check(intent.via == null || intent.via === route.importCurrency, 'Approved fee converter does not match via.');
      check(exporting, 'A non-converting reserve transfer requires an export route.');
    }
    if (intent.importtosource != null) {
      check(intent.importtosource === importToSource, 'Requested IMPORT_TO_SOURCE contradicts the conversion relationship.');
    }
    check(intent.bridgeid == null || intent.bridgeid === route.importCurrency, 'Approved import currency does not match bridgeid.');
    if (intent.preconvert) {
      check(!importToSource && !exporting && !route.gateway &&
        importer.launchsystemid === systemId && route.system === systemId,
        'Only local fractional preconversion on the launch system is supported.');
      check(!intent.exportto || systemOf(route.importCurrency) === systemId,
        'Approved import currency is on a different system.');
    } else {
      check(systemOf(route.importCurrency) === route.system, 'Approved import currency is on a different system.');
    }
    if (intent.preconvert) {
      check(fees.currency === systemId, 'Unsupported preconversion fee currency.');
    } else if (isFractional(route.importCurrency)) {
      check(fees.currency === route.system || fees.currency === route.importCurrency ||
        isReserve(route.importCurrency, fees.currency), 'Fee currency is not supported by the approved converter.');
    } else {
      const processingSystem = definition(route.system);
      check(fees.currency === route.system || ((processingSystem.options & 256) !== 0 &&
        processingSystem.launchsystemid === systemId && fees.currency === systemId),
        'Unsupported direct-export fee currency.');
    }
    if (intent.address.type.eq(DEST_ETH)) {
      check(exporting && (definition(exportSystem).options & 128) !== 0,
        'ETH recipient requires an external gateway export.');
    }
    check((route.gateway ? route.gateway.system : route.system) === exportSystem &&
      (!route.gateway || exporting), 'Approved export route does not match intent.');
    if (route.gateway) {
      check(route.system === systemId && isReserve(route.importCurrency, systemId) &&
        isReserve(route.importCurrency, route.gateway.system) &&
        (fees.currency === route.importCurrency || isReserve(route.importCurrency, fees.currency)),
        'Unsupported local gateway converter relationship.');
      check(route.gateway.code === toBase58Check(Buffer.alloc(20), 102), 'Unsupported gateway code.');
      check(context.auxiliaryDestinations.length > 0, 'Gateway route requires an approved refund destination.');
    } else {
      check(destinationFee.isZero(), 'Destination fee requires a gateway route.');
    }

    let tx;
    let transfer: ReserveTransfer;
    try {
      check(typeof unfundedTxHex === 'string' && /^(?:[0-9a-fA-F]{2})+$/.test(unfundedTxHex), 'Invalid hex');
      tx = Transaction.fromHex(unfundedTxHex, network);
    } catch (_) {
      throw new Error('Malformed transaction or reserve-transfer output.');
    }
    check(tx.version === 4 && tx.overwintered === 1 && tx.versionGroupId === 0x892f2085 &&
      tx.ins.length === 0 && tx.outs.length === 1,
      'Expected exactly one unfunded reserve-transfer output.');
    try {
      const chunks = script.decompile(tx.outs[0].script);
      check(chunks.length === 4 && Buffer.isBuffer(chunks[0]) && Buffer.isBuffer(chunks[2]) &&
        chunks[1] === opcodes.OP_CHECKCRYPTOCONDITION && chunks[3] === opcodes.OP_DROP, 'Invalid script');
      const master = OptCCParams.fromChunk(chunks[0]);
      const params = OptCCParams.fromChunk(chunks[2]);
      for (const cc of [master, params]) {
        check(cc.version === 3 && cc.m === 1 && cc.n === 1 && cc.destinations.length === 1 &&
          cc.destinations[0].destType === TxDestination.TYPE_PKH &&
          cc.destinations[0].destinationBytes.equals(RESERVE_TRANSFER_DESTINATION.destinationBytes), 'Invalid condition');
      }
      check(master.evalCode === EVALS.EVAL_NONE && master.vData.length === 0 &&
        params.evalCode === EVALS.EVAL_RESERVE_TRANSFER && params.vData.length === 1 &&
        master.toChunk().equals(chunks[0]) && params.toChunk().equals(chunks[2]), 'Invalid parameters');
      transfer = new ReserveTransfer();
      check(transfer.fromBuffer(params.vData[0]) === params.vData[0].length &&
        transfer.toBuffer().equals(params.vData[0]) && transfer.version.eqn(1) &&
        transfer.reserveValues.valueMap.size === 1, 'Invalid transfer');
    } catch (_) {
      throw new Error('Malformed transaction or reserve-transfer output.');
    }
    check(transfer.firstCurrency() === intent.currency, 'Source currency does not match intent.');
    check(transfer.firstValue().eq(principal), 'Principal amount does not match intent.');
    const allowedFlags = RESERVE_TRANSFER_VALID.or(RESERVE_TRANSFER_CONVERT).or(RESERVE_TRANSFER_PRECONVERT)
      .or(RESERVE_TRANSFER_IMPORT_TO_SOURCE).or(RESERVE_TRANSFER_RESERVE_TO_RESERVE).or(RESERVE_TRANSFER_CROSS_SYSTEM);
    check(transfer.flags.and(allowedFlags).eq(transfer.flags) && !transfer.flags.and(RESERVE_TRANSFER_VALID).isZero(),
      'Unauthorized reserve transfer flags.');
    check(transfer.isConversion() === converting && transfer.isPreConversion() === !!intent.preconvert &&
      transfer.isReserveToReserve() === (converting && intent.via != null), 'Conversion flags do not match intent.');
    check(transfer.isImportToSource() === importToSource, 'IMPORT_TO_SOURCE does not match the conversion relationship.');
    if (converting && intent.via != null) {
      check(transfer.destCurrencyID === intent.via, 'Via converter does not match intent.');
      check(transfer.secondReserveID === intent.convertto, 'Conversion target does not match intent.');
    } else {
      check(transfer.destCurrencyID === destinationCurrency,
        converting ? 'Conversion target does not match intent.' : 'Import currency does not match approved route.');
    }
    check(transfer.isCrossSystem() === (route.system !== systemId) &&
      (!transfer.isCrossSystem() || transfer.destSystemID === route.system), 'Export system does not match approved route.');
    const destination = transfer.transferDestination;
    check(destination.isGateway() === !!route.gateway && (!route.gateway ||
      (destination.gatewayID === route.gateway.system && destination.gatewayCode === route.gateway.code)),
      'Gateway route does not match approved route.');
    const expectedType = intent.address.type
      .or(route.gateway ? FLAG_DEST_GATEWAY : new BN(0))
      .or(destination.hasAuxDests() ? FLAG_DEST_AUX : new BN(0));
    check(destination.type.eq(expectedType) && destination.destinationBytes.equals(intent.address.destinationBytes),
      'Recipient does not match intent.');
    check(destination.hasAuxDests() === (context.auxiliaryDestinations.length > 0) &&
      destination.auxDests.length === context.auxiliaryDestinations.length &&
      destination.auxDests.every((dest, i) => plainDestination(dest) && sameDestination(dest, context.auxiliaryDestinations[i])),
      'Auxiliary destinations do not match approved refund policy.');
    check(transfer.feeCurrencyID === fees.currency, 'Fee currency does not match intent.');
    check(transfer.feeAmount.eq(immediateFee), 'Immediate transfer fee does not match approved allocation.');
    check(destination.fees.eq(destinationFee), 'Destination fee does not match approved allocation.');
    const nativeValue = (intent.currency === systemId ? principal : new BN(0))
      .add(fees.currency === systemId ? totalFee : new BN(0));
    check(Number.isSafeInteger(tx.outs[0].value) && new BN(tx.outs[0].value).eq(nativeValue),
      'Native output value does not match principal and fees.');
    return { valid: true };
  } catch (e) {
    return { valid: false, message: e.message };
  }
}

export const unpackOutput = (output: Output, systemId: string, isInput: boolean = false, allowNonTransferEvals: boolean = false): { 
  destinations: Array<string>, 
  values: { [currency: string]: BigNumber },
  fees: { [currency: string]: BigNumber },
  type: string,
  master?: SmartTxParams,
  params?: Array<SmartTxParams>
} => {
  // Verify change output
  const outputScript = output.script
  const outputType = templates.classifyOutput(outputScript);
  const values: { [currency: string]: BigNumber } = { [systemId]: new BN(0) };
  const fees: { [currency: string]: BigNumber } = { [systemId]: new BN(0) };
  const destinations: Array<string> = [];
  let master: typeof OptCCParams;
  const params: Array<typeof OptCCParams> = [];

  if (outputType === templates.types.P2PK && isInput) {
    values[systemId] = values[systemId].add(new BN(output.value));
  } else if (outputType === templates.types.P2PKH) {
    const destAddr = toBase58Check(templates.pubKeyHash.output.decode(outputScript), 60)

    values[systemId] = values[systemId].add(new BN(output.value));
    destinations.push(destAddr)
  } else if (outputType === templates.types.SMART_TRANSACTION) {
    let masterOptCC;
    const paramsOptCC = [];
    const decompiledScript = script.decompile(outputScript) as Array<Buffer|number>;

    for (let i = 0; i < decompiledScript.length; i+=2) {
      if (i === 0) masterOptCC = OptCCParams.fromChunk(decompiledScript[i]);
      else paramsOptCC.push(OptCCParams.fromChunk(decompiledScript[i]));
    }

    if (paramsOptCC.length > 1) throw new Error(">1 OptCCParam objects not currently supported for smart transaction params.")

    const processDestination = (destination: { destType: number, destinationBytes: Buffer }) => {
      if (destination.destType === 1) {
        // ADDRTYPE_PK (1)
        const destStr = destination.destinationBytes.toString();
  
        if (!destinations.includes(destStr)) {
          destinations.push(destStr)
        }
      } else if (destination.destType === 2 || destination.destType === 4 || destination.destType === 5) {
        // ADDRTYPE_PKH (2) and ADDRTYPE_ID (4) and ADDRTYPE_INDEX (5)
        const destAddr = toBase58Check(
          destination.destinationBytes, 
          destination.destType === 2 ? 60 : destination.destType === 5 ? 137 : 102
        )
  
        if (!destinations.includes(destAddr)) {
          destinations.push(destAddr)
        }
      } else throw new Error("Unsupported destination type")
    }

    const processOptCCParam = (ccparam): SmartTxParams => {
      let data: TokenOutput|ReserveTransfer|Identity;
      const ccvalues: { [currency: string]: BigNumber } = { [systemId]: new BN(0) };
      const ccfees: { [currency: string]: BigNumber } = { [systemId]: new BN(0) };

      switch (ccparam.evalCode) {
        case EVALS.EVAL_NONE:
          if (ccparam.vData.length !== 0) {
            throw new Error(`Unexpected length of vdata array for eval code ${ccparam.evalCode}`)
          }

          ccvalues[systemId] = ccvalues[systemId].add(new BN(output.value));
          break;
        case EVALS.EVAL_STAKEGUARD:
          if (!isInput) {
            throw new Error(`Cannot create stakeguard output.`)
          }

          ccvalues[systemId] = ccvalues[systemId].add(new BN(output.value));
          break;
        case EVALS.EVAL_RESERVE_TRANSFER:
          if (ccparam.vData.length !== 1) {
            throw new Error(`Unexpected length of vdata array for eval code ${ccparam.evalCode}`);
          }

          const resTransfer = new ReserveTransfer();
          resTransfer.fromBuffer(ccparam.vData[0]);

          ccvalues[systemId] = ccvalues[systemId].add(new BN(output.value));
          resTransfer.reserveValues.valueMap.forEach((value, key) => {
            if (key !== systemId) {
              if (!ccvalues[key]) ccvalues[key] = value;
              else ccvalues[key] = ccvalues[key].add(value);
            }
          })
          data = resTransfer;

          const fee = resTransfer.feeAmount;
          const feecurrency = resTransfer.feeCurrencyID;

          ccfees[feecurrency] = fee;

          if (resTransfer.transferDestination.fees != null) {
            ccfees[feecurrency] = ccfees[feecurrency].add(resTransfer.transferDestination.fees)
          }

          for (const aux_dest of resTransfer.transferDestination.auxDests) {
            if (aux_dest.hasAuxDests()) {
              throw new Error("Nested aux destinations not supported");
            }

            if (aux_dest.fees != null) {
              ccfees[feecurrency] = ccfees[feecurrency].add(aux_dest.fees);
            }

            processDestination({
              destType: aux_dest.typeNoFlags().toNumber(),
              destinationBytes: aux_dest.destinationBytes
            })
          }

          break;
        case EVALS.EVAL_RESERVE_OUTPUT:
          if (ccparam.vData.length !== 1) {
            throw new Error(`Unexpected length of vdata array for eval code ${ccparam.evalCode}`)
          }

          const resOutput = new TokenOutput()
          resOutput.fromBuffer(ccparam.vData[0])

          ccvalues[systemId] = ccvalues[systemId].add(new BN(output.value));
          resOutput.reserveValues.valueMap.forEach((value, key) => {
            if (key !== systemId) {
              if (!ccvalues[key]) ccvalues[key] = value;
              else ccvalues[key] = ccvalues[key].add(value);
            }
          })
          data = resOutput;
          break;
        case EVALS.EVAL_IDENTITY_PRIMARY:
          if (allowNonTransferEvals) {
            ccvalues[systemId] = ccvalues[systemId].add(new BN(output.value));

            const id = new Identity();
            id.fromBuffer(ccparam.vData[0]);

            data = id;
          } else {
            throw new Error('EVAL_IDENTITY_PRIMARY not permitted in this context.')
          }

          break;
        case EVALS.EVAL_NOTARY_EVIDENCE:
          if (!allowNonTransferEvals) {
            throw new Error('EVAL_NOTARY_EVIDENCE not permitted in this context.')
          } else {
            data = ccparam.vData[0]
          }

          break;
        default:
          throw new Error(`Unsupported eval code ${ccparam.evalCode}`)
      }

      return {
        version: ccparam.version,
        eval: ccparam.evalCode,
        m: ccparam.m,
        n: ccparam.n,
        data: data,
        values: ccvalues,
        fees: ccfees
      }
    }

    master = processOptCCParam(masterOptCC)
    for (const destination of masterOptCC.destinations) {
      processDestination(destination)
    }

    for (const paramsCc of paramsOptCC) {
      const processedParams = processOptCCParam(paramsCc)
      params.push(processedParams)

      for (const key in processedParams.values) {
        const value = processedParams.values[key]

        if (!values[key]) values[key] = value;
        else values[key] = values[key].add(value)
      }

      for (const key in processedParams.fees) {
        const fee = processedParams.fees[key]

        if (!fees[key]) fees[key] = fee;
        else fees[key] = fees[key].add(fee)
      }

      for (const destination of paramsCc.destinations) {
        processDestination(destination)
      }
    }
  } else {
    throw new Error("Unsupported output type " + outputType)
  }

  return {
    destinations, 
    values, 
    fees,
    type: outputType,
    master: master,
    params: params.length > 0 ? params : undefined
  }
}

export const validateFundedCurrencyTransfer = (
  systemId: string,
  fundedTxHex: string, 
  unfundedTxHex: string,
  changeAddr: string,
  network: Network,
  utxoList: GetAddressUtxosResponse['result'] | Array<AddressUtxo>): {
    valid: boolean, 
    message?: string, 
    in?: { [currency: string]: string }, 
    out?: { [currency: string]: string }, 
    change?: { [currency: string]: string },
    fees?: { [currency: string]: string },
    sent?: { [currency: string]: string }
  } => {

  const utxos = Array.isArray(utxoList) ? utxoList : utxoList.utxos;

  const amountsIn: { [currency: string]: BigNumber } = { [systemId]: new BN(0) };
  const amountsOut: { [currency: string]: BigNumber } = { [systemId]: new BN(0) };
  const amountChange: { [currency: string]: BigNumber } = { [systemId]: new BN(0) };
  const amountsFee: { [currency: string]: BigNumber } = { [systemId]: new BN(0) };

  const fundedTx = Transaction.fromHex(fundedTxHex, network);
  const unfundedTx = Transaction.fromHex(unfundedTxHex, network);

  const fundedTxComparison = Transaction.fromHex(fundedTxHex, network);

  if (!fundedTxComparison.ins.length) {
    return { 
      valid: false, 
      message: `Transaction has ${fundedTxComparison.ins.length} inputs.`
    }
  }

  fundedTxComparison.ins = []

  fundedTx.outs = fundedTx.outs as Array<Output>;
  unfundedTx.outs = unfundedTx.outs as Array<Output>;
  fundedTxComparison.outs = fundedTxComparison.outs as Array<Output>;

  fundedTx.ins = fundedTx.ins as Array<Input>;
  unfundedTx.ins = unfundedTx.ins as Array<Input>;
  fundedTxComparison.ins = fundedTxComparison.ins as Array<Input>;

  const changeOutputs: Array<Output> = [];
  const changeIndices: Array<number> = [];

  if (!fundedTxComparison.outs.length) {
    return { 
      valid: false, 
      message: `Transaction has ${fundedTxComparison.outs.length} outputs.`
    }
  }

  // Find all change outputs
  for (let i = 0, j = 0; i < fundedTxComparison.outs.length; i++, j++) {
    const out = fundedTxComparison.outs[i];

    const outScript = out.script.toString('hex')

    if (unfundedTx.outs[j] != null && 
        outScript === unfundedTx.outs[j].script.toString('hex') && 
        out.value === unfundedTx.outs[j].value) {
      continue;
    } else {
      changeOutputs.push(out)
      changeIndices.push(i)
      j--;
    }
  }

  // Filter change outputs from tx comparison
  fundedTxComparison.outs = (fundedTxComparison.outs as Array<Output>).filter((x: Output, i: number) => {
    return !changeIndices.includes(i)
  })

  // Verify funded tx and unfunded tx are the same where 
  // they should be the same
  if (fundedTxComparison.toHex() !== unfundedTx.toHex()) {
    return { 
      valid: false, 
      message: `Transaction hex does not match unfunded component.`
    }
  }
  
  // Verify all inputs are correct and count their amounts
  for (const input of (fundedTx.ins as Array<Input>)) {
    const inputHash = Buffer.from(input.hash).reverse().toString('hex')

    const inputUtxoIndex = utxos.findIndex(x => (
      (x.txid === inputHash) && x.outputIndex === input.index)
    )

    if (inputUtxoIndex < 0) {
      return { 
        valid: false, 
        message: `Cannot find corresponding input for ${inputHash} index ${input.index}.`
      }
    }

    const inputUtxo = utxos[inputUtxoIndex];
    const _script = Buffer.from(inputUtxo.script, 'hex')
    const _value = inputUtxo.satoshis

    try {
      const inputInfo = unpackOutput({ value: _value, script: _script }, systemId, true)

      for (const key in inputInfo.values) {
        if (amountsIn[key] == null) {
          amountsIn[key] = new BN(
            inputInfo.values[key] != null ? inputInfo.values[key] : 0
          )
        } else amountsIn[key] = amountsIn[key].add(inputInfo.values[key])
      }
    } catch(e) {
      return {
        valid: false,
        message: e.message
      }
    }
  }

  // Count output amounts (trusted more than input because we verify that they match
  // the outputs submitted in the unfunded transaction)
  for (let i = 0; i < unfundedTx.outs.length; i++) {
    const output = unfundedTx.outs[i];

    try {
      const outputInfo = unpackOutput(output, systemId, false, true);

      for (const key in outputInfo.values) {
        if (amountsOut[key] == null) {
          amountsOut[key] = new BN(outputInfo.values[key] != null ? outputInfo.values[key] : 0)
        } else amountsOut[key] = amountsOut[key].add(outputInfo.values[key])
      }

      for (const key in outputInfo.fees) {
        if (amountsFee[key] == null) {
          amountsFee[key] = new BN(outputInfo.fees[key] != null ? outputInfo.fees[key] : 0)
        } else amountsFee[key] = amountsFee[key].add(outputInfo.fees[key])
      }
    } catch(e) {
      return {
        valid: false,
        message: e.message
      }
    }
  }

  // Ensure change amounts go to correct destination
  for (let i = 0; i < changeOutputs.length; i++) {
    const output = changeOutputs[i];

    try {
      const outputInfo = unpackOutput(output, systemId);

      if (outputInfo.type !== templates.types.P2PKH && outputInfo.type !== templates.types.SMART_TRANSACTION) {
        throw new Error("Cannot use non p2pkh/smarttx utxo type as change.")
      }

      if (outputInfo.destinations.filter(x => x !== changeAddr).length !== 0) {
        throw new Error(`Some change destinations are not ${changeAddr}.`)
      }

      if (outputInfo.type === templates.types.SMART_TRANSACTION) {
        if (outputInfo.params.length !== 1) throw new Error("Invalid param length for change smarttx");

        const master = outputInfo.master!;
        const param = outputInfo.params[0]!;

        if (master.eval !== EVALS.EVAL_NONE) {
          throw new Error("Change smartx master must be EVAL_NONE")
        }

        if (!((master.m === 0 && master.n === 0 || master.m === 1 && master.n === 1) && 
              param.m === 1 && param.n === 1)) {
          throw new Error("Multisig change unsupported")
        }

        switch (param.eval) {
          case EVALS.EVAL_NONE:
          case EVALS.EVAL_RESERVE_OUTPUT:
            break;
          default:
            throw new Error("Change only supports EVAL_NONE and EVAL_RESERVE_OUTPUT smarttxs")
        }
      }
  
      for (const key in outputInfo.values) {
        if (amountsOut[key] == null) amountsOut[key] = new BN(outputInfo.values[key] != null ? outputInfo.values[key] : 0)
        else amountsOut[key] = amountsOut[key].add(outputInfo.values[key])

        if (amountChange[key] == null) amountChange[key] = new BN(outputInfo.values[key] != null ? outputInfo.values[key] : 0)
        else amountChange[key] = amountChange[key].add(outputInfo.values[key])
      }
    } catch(e) {
      return {
        valid: false,
        message: e.message
      }
    }
  }

  const _in = {};
  const _out = {};
  const _change = {};
  const _fees = {};
  const _sent = {};

  for (const key in amountsIn) {
    _in[key] = amountsIn[key].toString()
  }

  for (const key in amountsOut) {
    _out[key] = amountsOut[key].toString()
  }

  for (const key in amountsFee) {
    _fees[key] = amountsFee[key].toString()
  }

  for (const key in amountChange) {
    _change[key] = amountChange[key].toString()
  }

  for (const key in amountsIn) {
    const outVal = amountsOut[key] != null ? amountsOut[key] : new BN(0);
    const feeVal = _fees[key] ? new BN(_fees[key]) : new BN(0);

    _fees[key] = (feeVal.add((amountsIn[key].sub(outVal)))).toString()
  }

  for (const key in amountsIn) {
    const changeVal = amountChange[key] != null ? amountChange[key] : new BN(0);
    const feeVal = _fees[key] ? new BN(_fees[key]) : new BN(0)

    _sent[key] = (amountsIn[key].sub(changeVal).sub(feeVal)).toString()
  }

  return { valid: true, in: _in, out: _out, change: _change, fees: _fees, sent: _sent };
}

export const createUnfundedCurrencyTransfer = (
  systemId: string,
  outputs: Array<OutputParams>,
  network: Network,
  expiryHeight: number = 0,
  version: number = 4,
  versionGroupId: number = 0x892f2085
): string => {
  const txb = new TransactionBuilder(network);

  txb.setVersion(version);
  txb.setExpiryHeight(expiryHeight);
  txb.setVersionGroupId(versionGroupId);

  for (const output of outputs) {
    if (!output.currency) throw new Error("Must specify currency i-address for all outputs");
    if (output.satoshis == null) throw new Error("Must specify satoshis for all outputs");
    if (output.address == null) throw new Error("Must specify address for all outputs");

    //TODO: Implement VDXF tags by adding destination to master optccparams
    if (output.vdxftag != null) throw new Error("VDXF tags not fully implemented")
    
    const params: OutputParams = {
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
      bridgeid: output.bridgeid,
      vdxftag: output.vdxftag
    }

    const isReserveTransfer = output.feecurrency != null || 
                              output.feesatoshis != null || 
                              output.convertto != null || 
                              output.exportto != null ||
                              output.via != null;
    
    const satoshis = new BN(params.satoshis, 10);

    const values = new CurrencyValueMap({
      valueMap: new Map([[params.currency, satoshis]]),
      multivalue: false
    });

    const nativeFeeValue = params.feecurrency === systemId && isReserveTransfer ? new BN(params.feesatoshis) : new BN(0);
    const nativeValue = params.currency === systemId ? satoshis.add(nativeFeeValue) : nativeFeeValue;
    const isPKH = !isReserveTransfer && !output.vdxftag && params.currency === systemId && params.address.type.eq(DEST_PKH);

    if (isPKH) {
      txb.addOutput(params.address.getAddressString(), nativeValue.toNumber());
    } else {
      let outMaster: typeof OptCCParams;
      let outParams: typeof OptCCParams;
      
      if (isReserveTransfer) {
        const destination = new TxDestination(TxDestination.TYPE_PKH, RESERVE_TRANSFER_DESTINATION.destinationBytes);
        outMaster = new OptCCParams(3, EVALS.EVAL_NONE, 1, 1, [destination]);
        let flags = new BN(1);
        const version = new BN(1, 10);
        const isConversion = params.convertto != null && params.convertto !== params.currency;
  
        if (params.importtosource) flags = flags.xor(RESERVE_TRANSFER_IMPORT_TO_SOURCE);
        if (params.via != null) flags = flags.xor(RESERVE_TRANSFER_RESERVE_TO_RESERVE);
        if (params.exportto != null) flags = flags.xor(RESERVE_TRANSFER_CROSS_SYSTEM);
        if (isConversion) flags = flags.xor(RESERVE_TRANSFER_CONVERT);
        if (params.preconvert) flags = flags.xor(RESERVE_TRANSFER_PRECONVERT);
        if (params.mintnew) flags = flags.xor(RESERVE_TRANSFER_MINT_CURRENCY);
        if (params.burn) flags = flags.xor(RESERVE_TRANSFER_BURN_CHANGE_PRICE);
        if (params.burnweight) flags = flags.xor(RESERVE_TRANSFER_BURN_CHANGE_WEIGHT);

        const ignoreBridgeId = (isConversion || params.exportto == null);

        if (!ignoreBridgeId && params.bridgeid == null) {
          throw new Error("Bridge ID required")
        }
  
        const resTransfer = new ReserveTransfer({
          values,
          version,
          flags,
          feeCurrencyID: params.feecurrency,
          feeAmount: new BN(params.feesatoshis, 10),
          transferDestination: params.address,
          destCurrencyID: output.via ? output.via
                                         :
                                        (isConversion || params.exportto == null) ? params.convertto : params.bridgeid,
          secondReserveID: params.convertto,
          destSystemID: params.exportto
        })
  
        outParams = new OptCCParams(3, EVALS.EVAL_RESERVE_TRANSFER, 1, 1, [destination], [resTransfer.toBuffer()]);
      } else {
        values.valueMap.delete(systemId);

        if (values.valueMap.size == 0) {
          const destination = new TxDestination(params.address.type.toNumber(), params.address.destinationBytes)

          outMaster = new OptCCParams(3, EVALS.EVAL_NONE, 0, 0, []);
          outParams = new OptCCParams(3, EVALS.EVAL_NONE, 1, 1, [destination], []);
        } else {
          const destination = new TxDestination(params.address.type.toNumber(), params.address.destinationBytes)
  
          // Assume token output
          outMaster = new OptCCParams(3, EVALS.EVAL_NONE, 1, 1, [destination]);
          const version = new BN(1, 10);
    
          const tokenOutput = new TokenOutput({
            values,
            version
          })
    
          outParams = new OptCCParams(3, EVALS.EVAL_RESERVE_OUTPUT, 1, 1, [destination], [tokenOutput.toBuffer()]);
        }
      }
  
      const outputScript = script.compile([
        outMaster.toChunk(),
        opcodes.OP_CHECKCRYPTOCONDITION,
        outParams.toChunk(),
        opcodes.OP_DROP,
      ]);
  
      txb.addOutput(outputScript, nativeValue.toNumber());
    }
  }

  return txb.buildIncomplete().toHex();
}

export const createUnfundedIdentityUpdate = (
  identityHex: string,
  network: Network,
  expiryHeight: number = 0,
  version: number = 4,
  versionGroupId: number = 0x892f2085
): string => {
  const txb = new TransactionBuilder(network);

  txb.setVersion(version);
  txb.setExpiryHeight(expiryHeight);
  txb.setVersionGroupId(versionGroupId);

  const identity = new Identity();
  identity.fromBuffer(Buffer.from(identityHex, 'hex'));

  const outputScript = IdentityScript.fromIdentity(identity).toBuffer();

  txb.addOutput(outputScript, 0);

  return txb.buildIncomplete().toHex();
}

export const completeFundedIdentityUpdate = (
  fundedTxHex: string,
  network: Network,
  prevOutScripts: Array<Buffer>,
  prevIdentityOutput: { hash: Buffer, index: number, sequence: number, script: Buffer },
): string => {
  const txb = getFundedTxBuilder(fundedTxHex, network, prevOutScripts);
  txb.addInput(prevIdentityOutput.hash, prevIdentityOutput.index, prevIdentityOutput.sequence, prevIdentityOutput.script);

  return txb.buildIncomplete().toHex();
}

export const getFundedTxBuilder = (
  fundedTxHex: string,
  network: Network,
  prevOutScripts: Array<Buffer>
) => {
  const tx = Transaction.fromHex(fundedTxHex, network);
  const inputs = tx.ins;
  var txb = TransactionBuilder.fromTransaction(tx, network);
  txb.inputs = [];
  txb.tx.ins = [];

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    const prevoutscript = prevOutScripts[i];
    delete txb.prevTxMap[input.hash.toString('hex') + ':' + input.index];

    txb.addInput(input.hash, input.index, input.sequence, prevoutscript);
  }

  return txb;
}
