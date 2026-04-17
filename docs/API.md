# Spike Polymarket API

This document describes the HTTP API implemented by **spike-polymarket**: Polygon (chain ID **137**) utilities and Polymarket-oriented redeem and transfer flows.

For an interactive schema, run the server and open **`GET /docs`** (Swagger UI). The machine-readable OpenAPI document is served at **`GET /openapi.json`** (built from `src/openapi.ts`).

---

## Conventions

- **Content-Type:** `application/json` for every **POST** body.
- **Addresses:** Expect valid `0x`-prefixed Ethereum addresses where noted. Invalid or mismatched addresses return **400** with `{ "ok": false, "error": "…" }` (error strings are in English).
- **Success for mutating POSTs:** Most operational endpoints return **`{ "ok": true, … }`**. The exception is **`POST /wallet-address`**, which returns only `{ "walletAddress": "0x…" }` without an `ok` field.
- **Client errors:** **400** with `{ "ok": false, "error": "<message>" }` for validation and business-rule failures.
- **Not found:** **404** with `{ "error": "Not Found" }` for unknown paths or unsupported methods.

---

## Security and credentials

- **No API key is required by the Node server itself.** Authentication for Polymarket relayer calls is carried **inside JSON bodies** (`relayerApiKey` / `relayerApiKeyAddress`, or builder HMAC fields). Private keys are also sent in the body for signing.
- **Threat model:** Treat this API like a **signing backend**. Do not expose it to browsers or untrusted clients. Use HTTPS in production. If you publish behind RapidAPI or another gateway, follow that platform’s header requirements **in addition** to the JSON fields documented here.

---

## Chain defaults

| Constant | Typical value |
|----------|----------------|
| Polygon USDC (PoS, bridged) | `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174` |
| Default redeem-create URL | `https://polymarket.com/api/redeem/create` |
| Relayer URLs | Primary `https://relayer-v2.polymarket.com`, fallback `https://relayer.polymarket.com/api/v1` (overridable via `POLYMARKET_RELAYER_PRIMARY` / `POLYMARKET_RELAYER_FALLBACK`) |

---

## Endpoints

### `GET /health`

Liveness check.

**200 response**

```json
{ "ok": true }
```

---

### `POST /wallet-address`

Derives the checksummed public address from `walletPrivateKey`. The key is not persisted.

**Request body**

| Field | Type | Required |
|-------|------|----------|
| `walletPrivateKey` | string | Yes |

**200 response**

```json
{ "walletAddress": "0x…" }
```

---

### `GET /claimable`

Reads Polymarket’s public portfolio value for a wallet (backed by Polymarket’s data API).

**Query parameters**

| Name | Required | Description |
|------|----------|-------------|
| `user` | Yes | Wallet address (`0x…`) |

**200 response**

```json
{
  "ok": true,
  "user": "0x…",
  "value": 12.34
}
```

`value` may be **`null`** when no row is returned for that user.

---

### `GET /get_wallet_balance`

Reads **USDC** (default contract above, or `usdcContract`) and **native MATIC** for an address using your Polygon RPC URL.

**Query parameters**

| Name | Required | Description |
|------|----------|-------------|
| `alchemyUrl` | Yes | Polygon JSON-RPC URL (e.g. Alchemy). |
| `address` | Yes | Wallet to inspect. |
| `usdcContract` | No | ERC-20 used for the USDC balance column. |

**200 response (shape)**

```json
{
  "ok": true,
  "address": "0x…",
  "usdcContract": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  "usdcDisplayName": "…",
  "usdcBalance": "25.100000",
  "usdcBalanceRaw": "25100000",
  "maticBalance": "0.0312",
  "maticBalanceWei": "31200000000000000"
}
```

---

### `POST /get_wallet_balance`

Same balances as the GET variant. **`alchemyUrl` is required.** Provide **either** `address` **or** `walletPrivateKey` (must start with `0x`).

**200 response:** Same object as `GET /get_wallet_balance`.

---

### `POST /claim`

Executes Polymarket **redeem / claim** through the relayer: redeem-create → build `redeemPositions` calls → `relayerClient.execute` → wait for confirmation when available.

**Required body fields**

| Field | Description |
|-------|-------------|
| `walletPrivateKey` | Signs relayer transactions. |
| `proxyWallet` | Polymarket proxy wallet passed to redeem-create. |
| `alchemyUrl` | Polygon RPC for the signer. |
| `relayerTxType` | `SAFE` or `PROXY`. |

**Authentication (exactly one mode)**

1. **Relayer API key:** `relayerApiKey` and `relayerApiKeyAddress`. The address **must** match the signer derived from `walletPrivateKey`.
2. **Builder HMAC:** `builderApiKey`, `builderSecret`, and `builderPassphrase` (validated by the builder SDK).

**Optional**

| Field | Description |
|-------|-------------|
| `redeemCreateUrl` | Override default redeem-create URL. |

Optional environment variable **`POLYMARKET_REDEEM_ORIGIN`**: if set to a valid URL, its origin is sent as `Origin` / `Referer` on the redeem-create HTTP request.

**200 response (representative)**

```json
{
  "ok": true,
  "mode": "relayer-redeem",
  "relayerUrlUsed": "https://relayer-v2.polymarket.com",
  "signerAddress": "0x…",
  "proxyWallet": "0x…",
  "relayerTxType": "SAFE",
  "marketsCount": 3,
  "totalRedeemableValue": 8.42,
  "transactionId": "…",
  "txHash": "0x…",
  "state": "STATE_CONFIRMED",
  "redeemUrl": "https://…",
  "shortLink": "https://…"
}
```

`mode` is `relayer-redeem-builder-auth` when builder credentials are used.

---

### `POST /withdraw`

Relayer-sponsored **ERC-20 `transfer`** to `recipient`. Default token is Polygon PoS **USDC** unless `tokenAddress` is set.

**Required body fields**

`walletPrivateKey`, `alchemyUrl`, `relayerApiKey`, `relayerApiKeyAddress`, `relayerTxType` (`SAFE` | `PROXY`), `recipient`, `amount` (string or number).

`relayerApiKeyAddress` must match the signer from `walletPrivateKey`.

**200 response (representative)**

```json
{
  "ok": true,
  "mode": "relayer-withdraw",
  "gasPaidBy": "relayer",
  "relayerUrlUsed": "https://relayer-v2.polymarket.com",
  "signerAddress": "0x…",
  "recipient": "0x…",
  "tokenAddress": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  "amountRaw": "50000",
  "amount": "0.05",
  "relayerTxType": "SAFE",
  "transactionId": "…",
  "txHash": "0x…",
  "state": "STATE_CONFIRMED"
}
```

---

### `POST /withdraw_to_binance`

On-chain **`transfer`** of USDC (or `usdcContract`) from `walletPrivateKey` to `binanceAddress`. **Gas is paid in MATIC** from the same wallet.

**Required:** `walletPrivateKey`, `alchemyUrl`, `binanceAddress`, `amount`.

**Optional:** `minAmountUsdc` (default `0`), `usdcContract`.

**Behavior**

- If USDC balance is **zero**, the API returns **`{ "ok": true, "sent": false, "reason": "…" }`** without broadcasting.
- If `amount` is **not greater than** `minAmountUsdc`, returns **`sent: false`** with a reason (no broadcast).
- If `amount` exceeds balance, or MATIC is insufficient for gas, returns **400**.

**200 response when a transaction is sent**

```json
{
  "ok": true,
  "sent": true,
  "mode": "onchain-usdc-to-binance",
  "sender": "0x…",
  "recipient": "0x…",
  "tokenAddress": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  "usdcDisplayName": "…",
  "amountUsdc": "1.25",
  "amountRaw": "1250000",
  "balanceUsdcBefore": "10.0",
  "gasPaidBy": "wallet_matic",
  "txHash": "0x…",
  "polygonscanUrl": "https://polygonscan.com/tx/0x…",
  "blockNumber": 12345678
}
```

**Compatibility alias:** `POST /widraw_to_binance` is accepted as a **typo alias** for the same handler.

---

## Operational notes

- **Relayer fallback:** On certain transport or HTTP errors, the implementation retries against the configured fallback relayer host before failing.
- **Redeem empty set:** If redeem-create returns no markets, **claim** fails with a clear error (no on-chain batch is submitted).
- **Language of errors:** Validator and service errors are emitted in **English**; clients should still treat `error` as an opaque human-readable string.

---

## OpenAPI

The served specification is the single source of truth for field-level schemas and examples: **`GET /openapi.json`**. Regenerate or edit the in-repo spec in **`src/openapi.ts`** if you add endpoints or change response shapes.
