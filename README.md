# Polymarket Spike

![Polymarket toast](https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExZDFoeWEzdjdjc2FyaGlkZ3djdmkxNWU0M2ZwZ3FxZzVjbW1kYmwzNiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/Z4Z8dylyQfR3BzBAu1/giphy.gif)

If this project saves you time, donations on **Polygon** (chain ID **137**) are welcome — USDC, POL, or any ERC-20:

`0x360b2fAc8A122C0957b1d290a41751D6EaA5FA5C`

---

**Spike Polymarket** (`spike-polymarket`) is a small, focused HTTP service for [Polymarket](https://polymarket.com) workflows on **Polygon (chain ID 137)**. It wraps redeem creation, relayer-backed transactions, and wallet utilities so you can **claim redeemable positions without using the website’s Claim button**, move USDC, and integrate with exchange payouts from your own backend.

Built with **TypeScript** and **Node.js**, it ships with **OpenAPI** and **Swagger UI** out of the box.

---

## Why this exists

The main motivation is **programmatic claim**: settle or redeem winning positions **from your own script or server**, instead of opening [polymarket.com](https://polymarket.com) and clicking **Claim** for each batch. Polymarket still expects the same on-chain and relayer flow; this service wires **redeem-create → `redeemPositions` → relayer** in one HTTP API, plus balance and withdrawal helpers so you are not re-implementing the same Polymarket SDK steps every time.

---

## Features

- **Claim / redeem** — Calls Polymarket’s redeem-create endpoint, builds CTF `redeemPositions` transactions, and submits them through the Polymarket relayer (with primary/fallback relayer URLs).
- **Withdraw** — Relayer USDC (or custom ERC-20) transfers from your proxy context to a recipient.
- **Withdraw to Binance** — Dedicated flow for exchange deposit addresses where applicable.
- **Wallet helpers** — Derive address from a private key, query **claimable** portfolio value via Polymarket’s public data API, and read **MATIC + USDC** balances via your Polygon JSON-RPC URL.
- **Live docs** — `GET /docs` serves Swagger UI; `GET /openapi.json` is the machine-readable spec.

---

## Requirements

- **Node.js** 18+ (recommended: current LTS)
- A **Polygon RPC** URL (e.g. Alchemy) for balance and signing paths that need a provider
- Polymarket **relayer** or **builder** credentials in request bodies (see [docs/API.md](docs/API.md))

---

## Quick start

```bash
git clone git@github.com:Chyper00/spike.git
cd spike
npm install
npm run dev
```

The server listens on **`http://localhost:3000`** by default.

| Command   | Description                    |
| --------- | ------------------------------ |
| `npm run dev` | Development with file watcher (`tsx watch`) |
| `npm start`   | Run once                       |
| `npm run build` | Typecheck / emit with `tsc` |

---

## Configuration

Environment variables are optional unless you need overrides:

| Variable | Purpose |
| -------- | ------- |
| `PORT` | HTTP port (default `3000`) |
| `POLYMARKET_RELAYER_PRIMARY` | Override primary relayer base URL |
| `POLYMARKET_RELAYER_FALLBACK` | Override fallback relayer URL |
| `POLYMARKET_REDEEM_ORIGIN` | Optional `Origin` / `Referer` for redeem-create HTTP calls |

Credentials (private keys, relayer API keys, builder HMAC fields) are **not** read from the environment by this service; they are passed in **JSON bodies** per endpoint. Treat the API as a **signing backend**: do not expose it to browsers or untrusted networks without proper gateway auth and HTTPS.

---

## API reference

| Resource | URL |
| -------- | --- |
| Interactive docs | `GET /docs` |
| OpenAPI JSON | `GET /openapi.json` |
| Human-readable reference | [docs/API.md](docs/API.md) |

### HTTP routes

| Method | Route | Description |
| ------ | ----- | ----------- |
| `GET` | `/health` | Liveness check (`{ "ok": true }`). |
| `GET` | `/docs` | Swagger UI (loads `/openapi.json`). |
| `GET` | `/openapi.json` | Machine-readable OpenAPI document. |
| `POST` | `/wallet-address` | Derive checksummed address from `walletPrivateKey` in JSON body. |
| `GET` | `/claimable` | Polymarket claimable portfolio value; query `?user=0x…`. |
| `GET` | `/get_wallet_balance` | USDC + MATIC via RPC; query `?alchemyUrl=…&address=0x…` (optional `usdcContract`). |
| `POST` | `/get_wallet_balance` | Same balances as GET; JSON body with `alchemyUrl` and `address` **or** `walletPrivateKey`. |
| `POST` | `/claim` | Redeem / claim flow (redeem-create → relayer). |
| `POST` | `/withdraw` | Relayer-sponsored ERC-20 transfer (default USDC). |
| `POST` | `/withdraw_to_binance` | On-chain USDC transfer to a Binance deposit address (gas in MATIC). |

Unknown paths or unsupported methods return **404** `{ "error": "Not Found" }`. Full schemas: [docs/API.md](docs/API.md) and **`GET /openapi.json`**.

### Where each value comes from

| Field | Where to get it |
| ----- | ---------------- |
| `walletPrivateKey` | Your Polygon **EOA** private key (e.g. exported from your wallet). **Never** share it or send it to random websites—only to backends you control. Must match `relayerApiKeyAddress` for relayer auth. |
| `proxyWallet` | The Polymarket **proxy / trading** address tied to your account (the wallet Polymarket uses for positions and redeem-create). While logged in, check [Polymarket](https://polymarket.com) profile/wallet UI or the same value you see when claiming in the browser; it may differ from your EOA. |
| `alchemyUrl` | A **Polygon (chain 137) JSON-RPC HTTPS URL**. Common source: [Alchemy](https://www.alchemy.com/) → create an app on **Polygon PoS** → copy the HTTPS endpoint. Any Polygon RPC provider works. |
| `relayerApiKey` + `relayerApiKeyAddress` | Polymarket **Relayer API key** for your address: create/manage under Polymarket account **Settings → API Keys** (see [Relayer client — Authentication](https://docs.polymarket.com/developers/builders/relayer-client)). `relayerApiKeyAddress` **must** be the same address as `new Wallet(walletPrivateKey).address`. |
| `relayerTxType` | Either `SAFE` or `PROXY`—must match how your Polymarket account is set up for relayer transactions. |
| `builderApiKey`, `builderSecret`, `builderPassphrase` | **Alternative to** relayer keys on **`POST /claim` only**: create at [polymarket.com/settings?tab=builder](https://polymarket.com/settings?tab=builder) (see [Builder API keys](https://docs.polymarket.com/builders/api-keys)). |
| `recipient` (`/withdraw`) | Any valid Polygon `0x` address you want to receive USDC. |
| `binanceAddress` | In the **Binance** app or site: **Deposit** → **USDC** → network **Polygon** → copy the deposit address shown. |
| `amount` | Human amount (e.g. USDC to send); see [docs/API.md](docs/API.md) for precision rules. |

**Relayer host (not in JSON):** requests do **not** include `relayerUrl`. The running server calls Polymarket’s relayer in order: primary then fallback (defaults in [src/constants.ts](src/constants.ts)). Override with **`POLYMARKET_RELAYER_PRIMARY`** / **`POLYMARKET_RELAYER_FALLBACK`** (see [Configuration](#configuration)). Typical primary URL: `https://relayer-v2.polymarket.com`.

### Example: `POST /claim`

Relayer API key mode (replace placeholders; keep keys server-side only):

```json
{
  "proxyWallet": "0xYourPolymarketProxyWallet",
  "walletPrivateKey": "0xYourEoaPrivateKey",
  "alchemyUrl": "https://polygon-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY",
  "relayerApiKey": "YOUR_RELAYER_API_KEY",
  "relayerApiKeyAddress": "0xSameAddressAsEoaFromPrivateKey",
  "relayerTxType": "SAFE"
}
```

Builder HMAC mode instead of relayer keys (same required base fields, swap auth):

```json
{
  "proxyWallet": "0xYourPolymarketProxyWallet",
  "walletPrivateKey": "0xYourEoaPrivateKey",
  "alchemyUrl": "https://polygon-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY",
  "relayerTxType": "SAFE",
  "builderApiKey": "…",
  "builderSecret": "…",
  "builderPassphrase": "…"
}
```

Optional: `redeemCreateUrl` to override the default redeem-create HTTP URL.

### Example: `POST /withdraw`

```json
{
  "walletPrivateKey": "0x…",
  "alchemyUrl": "https://polygon-mainnet.g.alchemy.com/v2/…",
  "relayerApiKey": "…",
  "relayerApiKeyAddress": "0x…",
  "relayerTxType": "SAFE",
  "recipient": "0x…",
  "amount": "10.5",
  "tokenAddress": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"
}
```

`tokenAddress` is optional (defaults to Polygon PoS USDC). Keys: same relayer + RPC sources as `/claim`.

### Example: `POST /withdraw_to_binance`

```json
{
  "walletPrivateKey": "0x…",
  "alchemyUrl": "https://polygon-mainnet.g.alchemy.com/v2/…",
  "binanceAddress": "0x…",
  "amount": "25",
  "minAmountUsdc": "0",
  "usdcContract": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"
}
```

`minAmountUsdc` and `usdcContract` are optional. **Gas is paid in MATIC** from the same `walletPrivateKey` wallet.

### Example: `POST /wallet-address`

```json
{
  "walletPrivateKey": "0x…"
}
```

### Example: `POST /get_wallet_balance`

Either `address` or `walletPrivateKey` (must start with `0x`):

```json
{
  "alchemyUrl": "https://polygon-mainnet.g.alchemy.com/v2/…",
  "address": "0x…",
  "usdcContract": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"
}
```

### Quick `GET` examples

- **Claimable (Polymarket data API):** `GET /claimable?user=0x…`
- **Balances over RPC:** `GET /get_wallet_balance?alchemyUrl=https%3A%2F%2F…&address=0x…` (optional `&usdcContract=0x…`)

---

## Stack

- [ethers v5](https://docs.ethers.org/v5/) — Wallets and contract encoding  
- [@polymarket/builder-relayer-client](https://www.npmjs.com/package/@polymarket/builder-relayer-client) & related Polymarket packages — Relayer and signing integration  
- [tsx](https://github.com/privatenumber/tsx) — Run TypeScript without a separate compile step in dev  

---

## Project layout

```
main.ts          # Entry (re-exports src/main)
src/
  main.ts        # Server bootstrap (port, listen)
  server.ts      # HTTP routing and handlers
  services.ts    # Claim, withdraw, redeem-create, balances
  config.ts      # Request → execution config resolution
  openapi.ts     # OpenAPI document
  validators.ts  # JSON body validation
  types.ts       # Shared types
  constants.ts   # Chain IDs, default URLs, token addresses
  utils.ts       # Helpers (RPC, addresses, errors)
docs/
  API.md         # Detailed endpoint reference (English)
```

---

## Disclaimer

This software interacts with **real assets** on Polygon. You are responsible for key management, compliance, and operational security. The authors do not provide financial or legal advice; use at your own risk.


