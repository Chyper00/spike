import { RelayClient, RelayerTxType, Transaction } from '@polymarket/builder-relayer-client';
import { ethers } from 'ethers';
import { CHAIN_ID, CTF_ADDRESS, DEFAULT_REDEEM_CREATE_URL, ERC20_DECIMALS, ERC20_MIN_ABI, USDC_POS } from './constants';
import { ClaimExecutionConfig, RedeemCreateResponse, WithdrawToBinanceBody, GetWalletBalanceBody } from './types';
import {
    createPolygonProvider,
    describeUsdcToken,
    formatRelayerError,
    parseEthereumAddress,
    parsePositiveTokenAmount,
    rethrowIfRpcAuthFailed
} from './utils';

export async function fetchRedeemCreate(proxyWallet: string, redeemCreateUrl?: string): Promise<RedeemCreateResponse> {
    const url = (redeemCreateUrl || DEFAULT_REDEEM_CREATE_URL).trim();
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ proxyWallet })
    });
    if (!response.ok) throw new Error(`Falha no redeem/create: HTTP ${response.status}`);
    return (await response.json()) as RedeemCreateResponse;
}

function decodeRedeemPayloadFromUrl(redeemUrl?: string): { markets?: { conditionId: string }[] } | null {
    if (!redeemUrl) return null;
    try {
        const url = new URL(redeemUrl);
        const encoded = url.pathname.split('/').filter(Boolean).pop();
        if (!encoded) return null;
        const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
        return JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as { markets?: { conditionId: string }[] };
    } catch {
        return null;
    }
}

function getRedeemMarkets(redeem: RedeemCreateResponse): { conditionId: string }[] {
    if (Array.isArray(redeem.markets) && redeem.markets.length > 0) return redeem.markets;
    const decoded = decodeRedeemPayloadFromUrl(redeem.redeemUrl || redeem.shortLink);
    return decoded?.markets ?? [];
}

function buildRedeemTransactions(markets: { conditionId: string }[]): Transaction[] {
    const iface = new ethers.utils.Interface([
        'function redeemPositions(address collateralToken, bytes32 parentCollectionId, bytes32 conditionId, uint256[] indexSets)'
    ]);
    return markets.map((market) => ({
        to: CTF_ADDRESS,
        data: iface.encodeFunctionData('redeemPositions', [USDC_POS, ethers.constants.HashZero, market.conditionId, [1, 2]]),
        value: '0'
    }));
}

async function ensureSafeIfNeeded(relayerClient: RelayClient, relayerTxType: RelayerTxType): Promise<void> {
    if (relayerTxType !== RelayerTxType.SAFE) return;
    try {
        await relayerClient.deploy();
    } catch (error) {
        const msg = error instanceof Error ? error.message.toLowerCase() : '';
        const already = msg.includes('safe deployed') || msg.includes('safe already deployed') || msg.includes('safe_deployed');
        if (!already) throw error;
    }
}

function buildRelayClient(config: ClaimExecutionConfig, wallet: ethers.Wallet): RelayClient {
    const client = new RelayClient(config.relayerUrl, CHAIN_ID, wallet, config.builderConfig, config.relayerTxType);
    if (!config.builderConfig?.isValid()) {
        client.httpClient.instance.defaults.headers.common.RELAYER_API_KEY = config.relayerApiKey as string;
        client.httpClient.instance.defaults.headers.common.RELAYER_API_KEY_ADDRESS = config.relayerApiKeyAddress as string;
    }
    return client;
}

export async function executeClaim(config: ClaimExecutionConfig) {
    const provider = createPolygonProvider(config.alchemyUrl);
    const wallet = new ethers.Wallet(config.walletPrivateKey, provider);
    const redeem = await fetchRedeemCreate(config.proxyWallet, config.redeemCreateUrl);
    const markets = getRedeemMarkets(redeem);
    if (markets.length === 0) throw new Error('Nenhum market resgatável retornado por /api/redeem/create.');
    const relayerClient = buildRelayClient(config, wallet);
    try {
        await ensureSafeIfNeeded(relayerClient, config.relayerTxType);
        const response = await relayerClient.execute(buildRedeemTransactions(markets), 'polymarket portfolio redeem');
        const mined = await response.wait();
        return {
            ok: true,
            mode: config.builderConfig?.isValid() ? 'relayer-redeem-builder-auth' : 'relayer-redeem',
            signerAddress: wallet.address,
            proxyWallet: config.proxyWallet,
            relayerTxType: config.relayerTxType,
            marketsCount: markets.length,
            totalRedeemableValue: redeem.totalRedeemableValue ?? null,
            transactionId: response.transactionID,
            txHash: mined?.transactionHash ?? response.transactionHash ?? response.hash ?? null,
            state: mined?.state ?? response.state,
            redeemUrl: redeem.redeemUrl ?? null,
            shortLink: redeem.shortLink ?? null
        };
    } catch (err) {
        throw new Error(formatRelayerError(err));
    }
}

export async function executeRelayerWithdraw(config: ClaimExecutionConfig, recipient: string, amountRaw: ethers.BigNumber, tokenAddress: string) {
    const provider = createPolygonProvider(config.alchemyUrl);
    const wallet = new ethers.Wallet(config.walletPrivateKey, provider);
    const relayerClient = buildRelayClient(config, wallet);
    const erc20 = new ethers.utils.Interface(['function transfer(address to, uint256 value) returns (bool)']);
    const tx: Transaction = { to: tokenAddress, data: erc20.encodeFunctionData('transfer', [recipient, amountRaw]), value: '0' };
    try {
        await ensureSafeIfNeeded(relayerClient, config.relayerTxType);
        const response = await relayerClient.execute([tx], 'polymarket withdraw via relayer');
        const mined = await response.wait();
        return {
            ok: true,
            mode: 'relayer-withdraw',
            gasPaidBy: 'relayer',
            signerAddress: wallet.address,
            recipient,
            tokenAddress,
            amountRaw: amountRaw.toString(),
            amount: ethers.utils.formatUnits(amountRaw, ERC20_DECIMALS),
            relayerTxType: config.relayerTxType,
            transactionId: response.transactionID,
            txHash: mined?.transactionHash ?? response.transactionHash ?? response.hash ?? null,
            state: mined?.state ?? response.state
        };
    } catch (err) {
        throw new Error(formatRelayerError(err));
    }
}

async function readUsdcBalance(provider: ethers.providers.Provider, tokenAddress: string, owner: string) {
    const c = new ethers.Contract(tokenAddress, ERC20_MIN_ABI, provider);
    try {
        const raw: ethers.BigNumber = await c.balanceOf(owner);
        return { raw, formatted: ethers.utils.formatUnits(raw, ERC20_DECIMALS) };
    } catch (e) {
        rethrowIfRpcAuthFailed(e, 'balanceOf (USDC)');
    }
}

export async function executeWithdrawToBinance(input: WithdrawToBinanceBody) {
    const provider = createPolygonProvider(input.alchemyUrl);
    const wallet = new ethers.Wallet(input.walletPrivateKey, provider);
    const sender = parseEthereumAddress('sender', wallet.address);
    const recipient = parseEthereumAddress('binanceAddress', input.binanceAddress);
    const tokenAddress = parseEthereumAddress('usdcContract', input.usdcContract || USDC_POS);
    const minRaw = ethers.utils.parseUnits(String(input.minAmountUsdc ?? '0'), ERC20_DECIMALS);
    const { raw: balanceRaw, formatted: balanceFormatted } = await readUsdcBalance(provider, tokenAddress, sender);
    if (balanceRaw.lte(0)) {
        return { ok: true, sent: false, reason: 'Saldo USDC é zero; nada a enviar.', sender, recipient, tokenAddress, usdcDisplayName: describeUsdcToken(tokenAddress), balanceUsdc: balanceFormatted };
    }
    const amountRaw = parsePositiveTokenAmount(input.amount, ERC20_DECIMALS);
    const amountFormatted = ethers.utils.formatUnits(amountRaw, ERC20_DECIMALS);
    if (amountRaw.lte(minRaw)) {
        return { ok: true, sent: false, reason: `amount (${amountFormatted}) precisa ser maior que minAmountUsdc.`, sender, recipient, tokenAddress, usdcDisplayName: describeUsdcToken(tokenAddress), balanceUsdc: balanceFormatted };
    }
    if (amountRaw.gt(balanceRaw)) throw new Error(`Saldo insuficiente: tem ${balanceFormatted}, pediu ${amountFormatted}.`);
    const contract = new ethers.Contract(tokenAddress, ERC20_MIN_ABI, wallet);
    const gasEstimate = await contract.estimateGas.transfer(recipient, amountRaw);
    const gasLimit = gasEstimate.mul(110).div(100);
    const gasPrice = await provider.getGasPrice();
    const gasCostWei = gasLimit.mul(gasPrice);
    const maticBal = await provider.getBalance(sender);
    if (maticBal.lt(gasCostWei)) throw new Error('MATIC insuficiente para gás.');
    const tx = await contract.transfer(recipient, amountRaw, { gasLimit, gasPrice });
    const receipt = await tx.wait();
    return {
        ok: true,
        sent: true,
        mode: 'onchain-usdc-to-binance',
        sender,
        recipient,
        tokenAddress,
        usdcDisplayName: describeUsdcToken(tokenAddress),
        amountUsdc: amountFormatted,
        amountRaw: amountRaw.toString(),
        balanceUsdcBefore: balanceFormatted,
        gasPaidBy: 'wallet_matic',
        txHash: receipt.transactionHash,
        polygonscanUrl: `https://polygonscan.com/tx/${receipt.transactionHash}`,
        blockNumber: receipt.blockNumber ?? null
    };
}

export async function executeGetWalletBalance(input: GetWalletBalanceBody) {
    const provider = createPolygonProvider(input.alchemyUrl);
    const owner = input.address
        ? parseEthereumAddress('address', input.address)
        : parseEthereumAddress('walletPrivateKey', new ethers.Wallet(input.walletPrivateKey as string).address);
    const tokenAddress = parseEthereumAddress('usdcContract', input.usdcContract || USDC_POS);
    const { raw: usdcRaw, formatted: usdcFormatted } = await readUsdcBalance(provider, tokenAddress, owner);
    const maticWei = await provider.getBalance(owner);
    return {
        ok: true,
        address: owner,
        usdcContract: tokenAddress,
        usdcDisplayName: describeUsdcToken(tokenAddress),
        usdcBalance: usdcFormatted,
        usdcBalanceRaw: usdcRaw.toString(),
        maticBalance: ethers.utils.formatEther(maticWei),
        maticBalanceWei: maticWei.toString()
    };
}
