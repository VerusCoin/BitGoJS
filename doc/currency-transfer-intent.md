# Validating an RPC-created currency transfer

`smarttxs.validateCurrencyTransferIntent(systemId, unfundedHex, intent, network, context)`
returns `{ valid: true }` or `{ valid: false, message }`. Call it before accepting an
RPC-created template or funding it. Continue using `validateFundedCurrencyTransfer`
after funding; that helper still assumes its unfunded template is trusted.

The intent contains resolved currency IDs and an integer satoshi string, plus the
original `convertto`, `via`, `exportto`, `preconvert` and optional `importtosource`.
`address` is the terminal, plain PKH, ID or ETH `TransferDestination`.
`refundto`, when supplied, must match the first approved auxiliary destination.
Do not obtain these expected values by decoding the candidate.

The caller must independently supply:

- `currencyDefinitions`: definitions keyed by currency ID, containing `systemid`,
  `options`, and, where relevant, `currencies`, `launchsystemid` and `gatewayid`.
  Include the source, target, converter, fee and export currencies. The supported
  gateway definition defaults its gateway ID to its own currency ID when omitted.
- `route`: one approved `{ importCurrency, system, gateway? }`. `system` is the
  immediate processing system; optional `gateway: { system, code }` describes the
  later export. For conversions, the import currency is the fractional converter
  (the source for fractional-to-reserve). For exports without principal conversion,
  it is the independently resolved import currency or fee converter, which need
  not equal the sent currency. Ordinary gateway code is the zero-hash i-address.
- `fees`: `{ currency, transferSatoshis, destinationSatoshis }`, exact approved
  nonnegative integer strings. Both legs use `currency`; allocation is checked
  separately, so an unchanged total cannot conceal movement between legs. Use
  `"0"` for the destination fee without a gateway. If `intent.feesatoshis` is
  supplied, it authorizes the **total** of both legs, unlike the builder's immediate
  `feesatoshis` argument. Omitted `intent.feecurrency` means the current system.
- `auxiliaryDestinations`: the exact ordered list of plain destinations approved
  by the refund/notary policy, including duplicates when expected; `[]` permits
  none. A gateway requires a refund destination. Each destination is checked for
  type and bytes; additional flags, nesting and fee-bearing auxiliary routes fail.

This is agreement with trusted caller context, not authentication of RPC currency
definitions, notarizations, fee estimates or chain state. In particular, constructing
an approved route or fee allocation from the candidate defeats the check. The
caller must obtain and approve these before validation, using its own route and
fee policy. Exact fees do not estimate transaction funding fees or conversion
slippage; retain the consumer's funding/spend checks.

Supported scope is a single unfunded Sapling v4 reserve-transfer output with the
standard transfer condition: reserve-to-fractional, fractional-to-reserve,
reserve-to-reserve through `via`, direct exports, and a local converter followed
by one gateway export. The gateway path supports principal conversion and fee
conversion alone, with no initial `CROSS_SYSTEM` flag. `via` without `convertto`
selects the approved fee converter. Preconversion is limited to fractional targets
on their local launch system, with native fees and no export leg. As in the daemon,
`exportto` resolving to the current chain is treated as local, with no export leg.

Unsupported operations fail closed: burn, mint, mapping, identity/currency export,
refund operations, VDXF tags/index destinations, nonzero gateway code, nested or
multiple export legs, other output types, extra outputs, and funded templates.
Ordinary locally built payments continue to use the existing helpers. This helper
does not reproduce all `sendcurrency` routing or fee estimation.

## Minimal Mobile integration

Immediately after `getSendCurrencyTransaction` returns, before accepting its hex
or calling `fundRawTransaction`:

```js
const unfundedHex = sendCurrencyRes.result.hextx;
const validation = smarttxs.validateCurrencyTransferIntent(
  systemId,
  unfundedHex,
  output, // original resolved intent, including optional operation fields
  networks.verus,
  approvedContext
);
if (!validation.valid) throw new Error(validation.message);

// Existing fundRawTransaction(...) and validateFundedCurrencyTransfer(...) follow.
```

For example, an approved local converter followed by export uses:

```js
const approvedContext = {
  currencyDefinitions: currencyDefs,
  route: {
    importCurrency: resolvedLocalConverterId,
    system: systemId,
    gateway: { system: resolvedExportSystemId, code: zeroHashIAddress }
  },
  fees: {
    currency: output.feecurrency || systemId,
    transferSatoshis: approvedImmediateFee,
    destinationSatoshis: approvedExportFee
  },
  auxiliaryDestinations: approvedRefundAndNotaryDestinations
};
```

Mobile already resolves request IDs and keeps `currencyDefs`, but must also load
the selected converter definition and establish the exact route, auxiliary policy
and fee split. Its aggregate fee estimate alone does not supply that split.

`getSendCurrencyTransaction.js` currently forwards `currency`, `amount`, `address`,
`exportto`, `convertto`, `feecurrency`, `via` and `vdxftag`. It does **not** forward
`preconvert`, `refundto`, `feesatoshis`, `burn`, `burnweight`, `mintnew` or `mapto`.
Preserve the actual requested fields for validation: an omitted RPC `preconvert`
must cause a mismatch, not silently become ordinary conversion. Consumer follow-up
must forward supported optional intent such as `preconvert` and explicit `refundto`
or reject it before requesting a transaction. Daemon refund defaults can prefer its
configured identity over Mobile's source address; explicitly sending `refundto`
makes the requested refund policy deterministic. No Mobile changes are included here.
