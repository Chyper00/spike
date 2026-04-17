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

Unknown paths or unsupported methods return **404** `{ "error": "Not Found" }`. Request/response schemas and examples: [docs/API.md](docs/API.md) and **`GET /openapi.json`**.

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


