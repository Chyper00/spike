export function buildOpenApiSpec() {
    return {
        openapi: '3.0.3',
        info: {
            title: 'Spike Wallet API',
            version: '1.0.0',
            description: 'API para claim/redeem Polymarket, withdraw via relayer e operações de saldo/withdraw para Binance na Polygon.'
        },
        servers: [{ url: 'http://localhost:3000' }],
        paths: {
            '/health': {
                get: {
                    summary: 'Healthcheck',
                    responses: { '200': { description: 'OK' } }
                }
            },
            '/wallet-address': {
                post: {
                    summary: 'Endereço público a partir da chave privada (body)',
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['walletPrivateKey'],
                                    properties: { walletPrivateKey: { type: 'string' } }
                                }
                            }
                        }
                    },
                    responses: { '200': { description: 'Wallet address' } }
                }
            },
            '/claimable': {
                get: {
                    summary: 'Valor claimable da Polymarket',
                    parameters: [
                        {
                            name: 'user',
                            in: 'query',
                            required: true,
                            schema: { type: 'string' },
                            description: 'Endereço da carteira (0x...)'
                        }
                    ],
                    responses: { '200': { description: 'Claimable value' } }
                }
            },
            '/get_wallet_balance': {
                get: {
                    summary: 'Saldo de wallet (query)',
                    parameters: [
                        { name: 'alchemyUrl', in: 'query', required: true, schema: { type: 'string' } },
                        { name: 'address', in: 'query', required: true, schema: { type: 'string' } },
                        { name: 'usdcContract', in: 'query', required: false, schema: { type: 'string' } }
                    ],
                    responses: { '200': { description: 'Balances' } }
                },
                post: {
                    summary: 'Saldo de wallet (JSON)',
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['alchemyUrl'],
                                    properties: {
                                        alchemyUrl: { type: 'string' },
                                        walletPrivateKey: { type: 'string' },
                                        address: { type: 'string' },
                                        usdcContract: { type: 'string' }
                                    }
                                }
                            }
                        }
                    },
                    responses: { '200': { description: 'Balances' } }
                }
            },
            '/claim': {
                post: {
                    summary: 'Claim/redeem via relayer (todos os segredos no body)',
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['walletPrivateKey', 'proxyWallet', 'alchemyUrl', 'relayerUrl', 'relayerTxType'],
                                    properties: {
                                        walletPrivateKey: { type: 'string' },
                                        proxyWallet: { type: 'string' },
                                        alchemyUrl: { type: 'string' },
                                        relayerUrl: { type: 'string' },
                                        relayerTxType: { type: 'string', enum: ['SAFE', 'PROXY'] },
                                        relayerApiKey: { type: 'string' },
                                        relayerApiKeyAddress: { type: 'string' },
                                        builderApiKey: { type: 'string' },
                                        builderSecret: { type: 'string' },
                                        builderPassphrase: { type: 'string' },
                                        redeemCreateUrl: { type: 'string' }
                                    },
                                    description:
                                        'Autenticação: ou relayerApiKey + relayerApiKeyAddress, ou builderApiKey + builderSecret + builderPassphrase. redeemCreateUrl opcional (default interno).'
                                }
                            }
                        }
                    },
                    responses: { '200': { description: 'Claim result' } }
                }
            },
            '/withdraw': {
                post: {
                    summary: 'Withdraw via relayer (token transfer)',
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: [
                                        'walletPrivateKey',
                                        'alchemyUrl',
                                        'relayerApiKey',
                                        'relayerApiKeyAddress',
                                        'relayerUrl',
                                        'relayerTxType',
                                        'recipient',
                                        'amount'
                                    ],
                                    properties: {
                                        walletPrivateKey: { type: 'string' },
                                        alchemyUrl: { type: 'string' },
                                        relayerApiKey: { type: 'string' },
                                        relayerApiKeyAddress: { type: 'string' },
                                        relayerUrl: { type: 'string' },
                                        relayerTxType: { type: 'string', enum: ['SAFE', 'PROXY'] },
                                        recipient: { type: 'string' },
                                        amount: { oneOf: [{ type: 'string' }, { type: 'number' }] },
                                        tokenAddress: { type: 'string' }
                                    }
                                }
                            }
                        }
                    },
                    responses: { '200': { description: 'Withdraw result' } }
                }
            },
            '/withdraw_to_binance': {
                post: {
                    summary: 'Withdraw USDC para Binance (on-chain)',
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['walletPrivateKey', 'alchemyUrl', 'binanceAddress', 'amount'],
                                    properties: {
                                        walletPrivateKey: { type: 'string' },
                                        alchemyUrl: { type: 'string' },
                                        binanceAddress: { type: 'string' },
                                        amount: { oneOf: [{ type: 'string' }, { type: 'number' }] },
                                        minAmountUsdc: { oneOf: [{ type: 'string' }, { type: 'number' }] },
                                        usdcContract: { type: 'string' }
                                    }
                                }
                            }
                        }
                    },
                    responses: { '200': { description: 'Withdraw to Binance result' } }
                }
            }
        }
    };
}
