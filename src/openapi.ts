/**
 * OpenAPI 3.0 document served at GET /openapi.json (Swagger UI at GET /docs).
 * Descriptions are English; keep in sync with server.ts, validators.ts, and services.ts.
 */

const addressSchema = {
    type: 'string',
    description: 'Checksummed or valid hex Ethereum address (0x…).',
    example: '0x0000000000000000000000000000000000000001'
} as const;

const relayerTxTypeSchema = {
    type: 'string',
    enum: ['SAFE', 'PROXY'],
    description:
        'Polymarket relayer transaction mode. SAFE deploys/uses a Safe where applicable; PROXY uses the proxy wallet flow.'
} as const;

const errorBody = {
    description: 'Validation or business-rule failure (HTTP 400).',
    content: {
        'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            examples: {
                invalidBody: { value: { ok: false, error: 'Invalid JSON body.' } },
                missingField: { value: { ok: false, error: 'Missing or empty: walletPrivateKey.' } }
            }
        }
    }
} as const;

export function buildOpenApiSpec() {
    return {
        openapi: '3.0.3',
        info: {
            title: 'Spike Polymarket API',
            version: '1.0.0',
            description: [
                'HTTP API for Polygon (chain id 137) wallet utilities and Polymarket-focused flows:',
                'claimable balance lookup, relayer-backed redeem/claim, relayer token withdraw,',
                'direct on-chain USDC transfer to an exchange deposit address, and balance queries.',
                '',
                '**Credentials:** There is no API-key header on the Node server itself. Secrets are sent in JSON bodies for signing and relayer authentication. When exposing this service through a gateway (e.g. RapidAPI), use that platform’s required headers in addition to these JSON fields.',
                '',
                '**Security:** Never call endpoints that accept private keys from untrusted front-ends. Prefer a secure backend and HTTPS.',
                '',
                '**Relayer hosts:** The server tries a primary Polymarket relayer URL, then a configurable fallback. Override order with environment variables `POLYMARKET_RELAYER_PRIMARY` and `POLYMARKET_RELAYER_FALLBACK` if needed.'
            ].join('\n')
        },
        servers: [
            { url: 'http://localhost:3000', description: 'Local development' },
            { url: 'https://{host}', description: 'Deployed or gateway host', variables: { host: { default: 'api.example.com' } } }
        ],
        tags: [
            { name: 'Health', description: 'Liveness and readiness style checks.' },
            { name: 'Wallet', description: 'Address derivation and token/MATIC balances.' },
            { name: 'Polymarket', description: 'Read-only integration with Polymarket data APIs.' },
            { name: 'Relayer', description: 'Signed operations executed via Polymarket relayer (gas sponsored by relayer).' },
            { name: 'On-chain', description: 'User-wallet pays MATIC gas (e.g. USDC.transfer to Binance).' }
        ],
        paths: {
            '/health': {
                get: {
                    tags: ['Health'],
                    summary: 'Health check',
                    description: 'Returns JSON confirming the process is accepting HTTP connections.',
                    operationId: 'healthCheck',
                    responses: {
                        '200': {
                            description: 'Service is up.',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/HealthOk' },
                                    example: { ok: true }
                                }
                            }
                        }
                    }
                }
            },
            '/wallet-address': {
                post: {
                    tags: ['Wallet'],
                    summary: 'Derive wallet address from private key',
                    description:
                        'Computes the public Ethereum address for the given `walletPrivateKey`. The key is not stored.',
                    operationId: 'walletAddress',
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/WalletAddressRequest' },
                                example: { walletPrivateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' }
                            }
                        }
                    },
                    responses: {
                        '200': {
                            description: 'Derived address.',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/WalletAddressResponse' },
                                    example: { walletAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' }
                                }
                            }
                        },
                        '400': errorBody
                    }
                }
            },
            '/claimable': {
                get: {
                    tags: ['Polymarket'],
                    summary: 'Polymarket claimable portfolio value',
                    description:
                        'Proxies Polymarket’s public data API (`/value`) for the wallet passed as `user`. Returns `null` for `value` when no row exists.',
                    operationId: 'getClaimable',
                    parameters: [
                        {
                            name: 'user',
                            in: 'query',
                            required: true,
                            schema: { type: 'string' },
                            description: 'Wallet address to query (same semantics as other `0x` addresses in this API).',
                            example: '0x0000000000000000000000000000000000000001'
                        }
                    ],
                    responses: {
                        '200': {
                            description: 'Claimable value (or null if none).',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/ClaimableResponse' },
                                    example: { ok: true, user: '0x0000000000000000000000000000000000000001', value: 12.34 }
                                }
                            }
                        },
                        '400': errorBody
                    }
                }
            },
            '/get_wallet_balance': {
                get: {
                    tags: ['Wallet'],
                    summary: 'Wallet balance (query string)',
                    description:
                        'Reads USDC (default: Polygon bridged USDC PoS `0x2791…4174` unless `usdcContract` is set) and native MATIC balance for `address`. Requires a working Polygon JSON-RPC URL (`alchemyUrl`).',
                    operationId: 'getWalletBalanceGet',
                    parameters: [
                        {
                            name: 'alchemyUrl',
                            in: 'query',
                            required: true,
                            schema: { type: 'string', format: 'uri' },
                            description: 'Polygon RPC URL (e.g. Alchemy HTTPS endpoint).',
                            example: 'https://polygon-mainnet.g.alchemy.com/v2/your-key'
                        },
                        {
                            name: 'address',
                            in: 'query',
                            required: true,
                            schema: { type: 'string' },
                            description: 'Wallet address whose balances are read.',
                            example: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
                        },
                        {
                            name: 'usdcContract',
                            in: 'query',
                            required: false,
                            schema: { type: 'string' },
                            description: 'ERC-20 contract for the “USDC” balance column (defaults to Polygon PoS USDC).',
                            example: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'
                        }
                    ],
                    responses: {
                        '200': {
                            description: 'Formatted and raw balances.',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/WalletBalanceResponse' }
                                }
                            }
                        },
                        '400': errorBody
                    }
                },
                post: {
                    tags: ['Wallet'],
                    summary: 'Wallet balance (JSON body)',
                    description:
                        'Same balances as the GET variant. Provide either `address` **or** `walletPrivateKey` (must start with `0x`); the server derives the address when only the private key is sent.',
                    operationId: 'getWalletBalancePost',
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/GetWalletBalanceBody' },
                                examples: {
                                    byAddress: {
                                        summary: 'By address',
                                        value: {
                                            alchemyUrl: 'https://polygon-mainnet.g.alchemy.com/v2/your-key',
                                            address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
                                        }
                                    },
                                    byPrivateKey: {
                                        summary: 'By private key',
                                        value: {
                                            alchemyUrl: 'https://polygon-mainnet.g.alchemy.com/v2/your-key',
                                            walletPrivateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
                                        }
                                    }
                                }
                            }
                        }
                    },
                    responses: {
                        '200': {
                            description: 'Formatted and raw balances.',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/WalletBalanceResponse' }
                                }
                            }
                        },
                        '400': errorBody
                    }
                }
            },
            '/claim': {
                post: {
                    tags: ['Relayer'],
                    summary: 'Redeem / claim via Polymarket relayer',
                    description: [
                        'End-to-end redeem: calls Polymarket redeem-create with `proxyWallet`, builds Conditional Tokens `redeemPositions` calls, and submits them through the relayer.',
                        '',
                        '**Authentication (choose one):**',
                        '- **Relayer API key:** `relayerApiKey` + `relayerApiKeyAddress` (must equal the address derived from `walletPrivateKey`).',
                        '- **Builder HMAC:** `builderApiKey` + `builderSecret` + `builderPassphrase` (validated by builder SDK).',
                        '',
                        'Optional `redeemCreateUrl` overrides the default Polymarket redeem-create endpoint. Optional `POLYMARKET_REDEEM_ORIGIN` env can set Origin/Referer for that HTTP call.'
                    ].join('\n'),
                    operationId: 'claim',
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ClaimRequest' }
                            }
                        }
                    },
                    responses: {
                        '200': {
                            description: 'Relayer transaction submitted and mined (or terminal state returned by client).',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/ClaimSuccess' }
                                }
                            }
                        },
                        '400': errorBody
                    }
                }
            },
            '/withdraw': {
                post: {
                    tags: ['Relayer'],
                    summary: 'ERC-20 transfer via relayer',
                    description:
                        'Executes `transfer(recipient, amount)` for the default Polygon USDC PoS token unless `tokenAddress` is provided. Gas is paid by the relayer. `relayerApiKeyAddress` must match the signer from `walletPrivateKey`.',
                    operationId: 'relayerWithdraw',
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/WithdrawRequest' },
                                example: {
                                    walletPrivateKey: '0x…',
                                    alchemyUrl: 'https://polygon-mainnet.g.alchemy.com/v2/your-key',
                                    relayerApiKey: 'your-relayer-key',
                                    relayerApiKeyAddress: '0x…',
                                    relayerTxType: 'SAFE',
                                    recipient: '0x…',
                                    amount: '0.05'
                                }
                            }
                        }
                    },
                    responses: {
                        '200': {
                            description: 'Relayer transfer result.',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/WithdrawSuccess' }
                                }
                            }
                        },
                        '400': errorBody
                    }
                }
            },
            '/withdraw_to_binance': {
                post: {
                    tags: ['On-chain'],
                    summary: 'Send USDC on-chain to a Binance deposit address',
                    description: [
                        'Signs and broadcasts an ERC-20 `transfer` from `walletPrivateKey` to `binanceAddress`. The wallet must hold enough MATIC for gas.',
                        '',
                        'If USDC balance is zero, or `amount` is not greater than `minAmountUsdc` (default 0), the server returns `{ ok: true, sent: false, reason: … }` without broadcasting.',
                        'Default token is Polygon PoS USDC (`0x2791…4174`); override with `usdcContract`.'
                    ].join('\n'),
                    operationId: 'withdrawToBinance',
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/WithdrawToBinanceRequest' }
                            }
                        }
                    },
                    responses: {
                        '200': {
                            description: 'Transfer broadcast or skipped with reason.',
                            content: {
                                'application/json': {
                                    schema: {
                                        oneOf: [
                                            { $ref: '#/components/schemas/WithdrawToBinanceSent' },
                                            { $ref: '#/components/schemas/WithdrawToBinanceSkipped' }
                                        ]
                                    }
                                }
                            }
                        },
                        '400': errorBody
                    }
                }
            }
        },
        components: {
            schemas: {
                ErrorResponse: {
                    type: 'object',
                    required: ['ok', 'error'],
                    properties: {
                        ok: { type: 'boolean', enum: [false] },
                        error: { type: 'string', description: 'Human-readable message (English).' }
                    }
                },
                HealthOk: {
                    type: 'object',
                    required: ['ok'],
                    properties: { ok: { type: 'boolean', enum: [true] } }
                },
                WalletAddressRequest: {
                    type: 'object',
                    required: ['walletPrivateKey'],
                    properties: {
                        walletPrivateKey: {
                            type: 'string',
                            description: 'Hex-encoded secp256k1 private key, typically 0x-prefixed 32-byte.',
                            example: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
                        }
                    }
                },
                WalletAddressResponse: {
                    type: 'object',
                    required: ['walletAddress'],
                    properties: {
                        walletAddress: {
                            ...addressSchema,
                            description: 'Checksummed address derived from the private key.'
                        }
                    }
                },
                ClaimableResponse: {
                    type: 'object',
                    required: ['ok', 'user'],
                    properties: {
                        ok: { type: 'boolean', enum: [true] },
                        user: { type: 'string', description: 'Normalized query address.' },
                        value: {
                            type: 'number',
                            nullable: true,
                            description: 'First Polymarket `/value` row for this user, or null when empty / missing.'
                        }
                    }
                },
                GetWalletBalanceBody: {
                    type: 'object',
                    required: ['alchemyUrl'],
                    properties: {
                        alchemyUrl: { type: 'string', format: 'uri', description: 'Polygon JSON-RPC URL.' },
                        address: { type: 'string', description: 'Owner address (omit if `walletPrivateKey` is provided).' },
                        walletPrivateKey: {
                            type: 'string',
                            description: 'If set without `address`, balance is read for the derived signer address. Must start with `0x`.'
                        },
                        usdcContract: { type: 'string', description: 'Optional ERC-20 used for the USDC balance field.' }
                    },
                    description: 'Exactly one of `address` or `walletPrivateKey` must be present.'
                },
                WalletBalanceResponse: {
                    type: 'object',
                    required: ['ok', 'address', 'usdcContract', 'usdcDisplayName', 'usdcBalance', 'usdcBalanceRaw', 'maticBalance', 'maticBalanceWei'],
                    properties: {
                        ok: { type: 'boolean', enum: [true] },
                        address: { type: 'string' },
                        usdcContract: { type: 'string' },
                        usdcDisplayName: { type: 'string', description: 'Human label for the token contract.' },
                        usdcBalance: { type: 'string', description: 'Decimal string, 6 fractional digits for standard USDC.' },
                        usdcBalanceRaw: { type: 'string', description: 'Integer string in base units (wei-like for 6 decimals).' },
                        maticBalance: { type: 'string', description: 'MATIC balance in ether decimal string.' },
                        maticBalanceWei: { type: 'string', description: 'MATIC balance in wei as integer string.' }
                    }
                },
                ClaimRequest: {
                    type: 'object',
                    required: ['walletPrivateKey', 'proxyWallet', 'alchemyUrl', 'relayerTxType'],
                    properties: {
                        walletPrivateKey: { type: 'string' },
                        proxyWallet: {
                            ...addressSchema,
                            description: 'Polymarket proxy wallet used in redeem-create.'
                        },
                        alchemyUrl: { type: 'string', format: 'uri' },
                        relayerTxType: relayerTxTypeSchema,
                        relayerApiKey: { type: 'string', description: 'Required with `relayerApiKeyAddress` when not using builder auth.' },
                        relayerApiKeyAddress: { type: 'string', description: 'Must match signer from `walletPrivateKey`.' },
                        builderApiKey: { type: 'string' },
                        builderSecret: { type: 'string' },
                        builderPassphrase: { type: 'string' },
                        redeemCreateUrl: { type: 'string', format: 'uri', description: 'Override default `https://polymarket.com/api/redeem/create`.' }
                    },
                    description:
                        'Either relayer key pair or full builder triplet must be supplied in addition to the required base fields.'
                },
                ClaimSuccess: {
                    type: 'object',
                    required: ['ok', 'mode', 'relayerUrlUsed', 'signerAddress', 'proxyWallet', 'relayerTxType', 'marketsCount'],
                    properties: {
                        ok: { type: 'boolean', enum: [true] },
                        mode: { type: 'string', enum: ['relayer-redeem', 'relayer-redeem-builder-auth'] },
                        relayerUrlUsed: { type: 'string', format: 'uri' },
                        signerAddress: { type: 'string' },
                        proxyWallet: { type: 'string' },
                        relayerTxType: { type: 'string' },
                        marketsCount: { type: 'integer', minimum: 1 },
                        totalRedeemableValue: {
                            nullable: true,
                            description: 'Polymarket redeem-create payload field when present.',
                            oneOf: [{ type: 'number' }, { type: 'string' }]
                        },
                        transactionId: { type: 'string' },
                        txHash: { type: 'string', nullable: true },
                        state: { type: 'string', description: 'Relayer / wait() terminal or in-progress state when available.' },
                        redeemUrl: { type: 'string', nullable: true },
                        shortLink: { type: 'string', nullable: true }
                    }
                },
                WithdrawRequest: {
                    type: 'object',
                    required: [
                        'walletPrivateKey',
                        'alchemyUrl',
                        'relayerApiKey',
                        'relayerApiKeyAddress',
                        'relayerTxType',
                        'recipient',
                        'amount'
                    ],
                    properties: {
                        walletPrivateKey: { type: 'string' },
                        alchemyUrl: { type: 'string', format: 'uri' },
                        relayerApiKey: { type: 'string' },
                        relayerApiKeyAddress: { type: 'string', description: 'Must match signer from `walletPrivateKey`.' },
                        relayerTxType: relayerTxTypeSchema,
                        recipient: { type: 'string' },
                        amount: { oneOf: [{ type: 'string' }, { type: 'number' }], description: 'USDC amount (6 decimals) unless `tokenAddress` points to another token.' },
                        tokenAddress: { type: 'string', description: 'Optional ERC-20 to transfer; defaults to Polygon PoS USDC.' }
                    }
                },
                WithdrawSuccess: {
                    type: 'object',
                    required: [
                        'ok',
                        'mode',
                        'gasPaidBy',
                        'relayerUrlUsed',
                        'signerAddress',
                        'recipient',
                        'tokenAddress',
                        'amountRaw',
                        'amount',
                        'relayerTxType'
                    ],
                    properties: {
                        ok: { type: 'boolean', enum: [true] },
                        mode: { type: 'string', enum: ['relayer-withdraw'] },
                        gasPaidBy: { type: 'string', enum: ['relayer'] },
                        relayerUrlUsed: { type: 'string', format: 'uri' },
                        signerAddress: { type: 'string' },
                        recipient: { type: 'string' },
                        tokenAddress: { type: 'string' },
                        amountRaw: { type: 'string' },
                        amount: { type: 'string' },
                        relayerTxType: { type: 'string' },
                        transactionId: { type: 'string' },
                        txHash: { type: 'string', nullable: true },
                        state: { type: 'string' }
                    }
                },
                WithdrawToBinanceRequest: {
                    type: 'object',
                    required: ['walletPrivateKey', 'alchemyUrl', 'binanceAddress', 'amount'],
                    properties: {
                        walletPrivateKey: { type: 'string' },
                        alchemyUrl: { type: 'string', format: 'uri' },
                        binanceAddress: { type: 'string', description: 'Destination `0x` address (e.g. Binance Polygon USDC deposit).' },
                        amount: { oneOf: [{ type: 'string' }, { type: 'number' }], description: 'USDC amount to send (human or parseable decimal string).' },
                        minAmountUsdc: {
                            oneOf: [{ type: 'string' }, { type: 'number' }],
                            description: 'If set, `amount` must be strictly greater than this threshold or the call returns `sent: false`.'
                        },
                        usdcContract: { type: 'string', description: 'Optional USDC (or USDC-like) contract; default Polygon PoS USDC.' }
                    }
                },
                WithdrawToBinanceSent: {
                    type: 'object',
                    required: [
                        'ok',
                        'sent',
                        'mode',
                        'sender',
                        'recipient',
                        'tokenAddress',
                        'usdcDisplayName',
                        'amountUsdc',
                        'amountRaw',
                        'balanceUsdcBefore',
                        'gasPaidBy',
                        'txHash',
                        'polygonscanUrl'
                    ],
                    properties: {
                        ok: { type: 'boolean', enum: [true] },
                        sent: { type: 'boolean', enum: [true] },
                        mode: { type: 'string', enum: ['onchain-usdc-to-binance'] },
                        sender: { type: 'string' },
                        recipient: { type: 'string' },
                        tokenAddress: { type: 'string' },
                        usdcDisplayName: { type: 'string' },
                        amountUsdc: { type: 'string' },
                        amountRaw: { type: 'string' },
                        balanceUsdcBefore: { type: 'string' },
                        gasPaidBy: { type: 'string', enum: ['wallet_matic'] },
                        txHash: { type: 'string' },
                        polygonscanUrl: { type: 'string', format: 'uri' },
                        blockNumber: { type: 'integer', nullable: true }
                    }
                },
                WithdrawToBinanceSkipped: {
                    type: 'object',
                    required: ['ok', 'sent', 'reason', 'sender', 'recipient', 'tokenAddress', 'usdcDisplayName'],
                    properties: {
                        ok: { type: 'boolean', enum: [true] },
                        sent: { type: 'boolean', enum: [false] },
                        reason: { type: 'string' },
                        sender: { type: 'string' },
                        recipient: { type: 'string' },
                        tokenAddress: { type: 'string' },
                        usdcDisplayName: { type: 'string' },
                        balanceUsdc: { type: 'string', description: 'Present when skipping due to zero balance or min-amount rule.' }
                    }
                }
            }
        }
    };
}
