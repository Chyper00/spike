import { ethers } from 'ethers';
import { ClaimRequestBody, GetWalletBalanceBody, WithdrawRequestBody, WithdrawToBinanceBody } from './types';

function nonEmptyString(v: unknown): string | undefined {
    if (typeof v !== 'string') return undefined;
    const t = v.trim();
    return t.length > 0 ? t : undefined;
}

export function validateClaimBody(body: unknown): ClaimRequestBody {
    if (!body || typeof body !== 'object') throw new Error('Invalid JSON body.');
    const p = body as Partial<ClaimRequestBody>;
    const missing: string[] = [];
    if (!nonEmptyString(p.walletPrivateKey)) missing.push('walletPrivateKey');
    if (!nonEmptyString(p.proxyWallet)) missing.push('proxyWallet');
    if (!nonEmptyString(p.alchemyUrl)) missing.push('alchemyUrl');
    if (p.relayerTxType !== 'SAFE' && p.relayerTxType !== 'PROXY') missing.push('relayerTxType (SAFE or PROXY)');
    if (missing.length) {
        throw new Error(`Missing or empty: ${missing.join(', ')}.`);
    }
    const relayerTxType = p.relayerTxType;
    return {
        walletPrivateKey: String(p.walletPrivateKey).trim(),
        proxyWallet: String(p.proxyWallet).trim(),
        alchemyUrl: String(p.alchemyUrl).trim(),
        relayerTxType: relayerTxType as 'SAFE' | 'PROXY',
        relayerApiKey: typeof p.relayerApiKey === 'string' ? p.relayerApiKey.trim() : undefined,
        relayerApiKeyAddress: typeof p.relayerApiKeyAddress === 'string' ? p.relayerApiKeyAddress.trim() : undefined,
        builderApiKey: typeof p.builderApiKey === 'string' ? p.builderApiKey.trim() : undefined,
        builderSecret: typeof p.builderSecret === 'string' ? p.builderSecret.trim() : undefined,
        builderPassphrase: typeof p.builderPassphrase === 'string' ? p.builderPassphrase.trim() : undefined,
        redeemCreateUrl: typeof p.redeemCreateUrl === 'string' ? p.redeemCreateUrl.trim() : undefined
    };
}

export function validateWalletAddressBody(body: unknown): { walletPrivateKey: string } {
    if (!body || typeof body !== 'object') throw new Error('Invalid JSON body.');
    const pk = (body as { walletPrivateKey?: unknown }).walletPrivateKey;
    if (typeof pk !== 'string' || !pk.trim()) throw new Error('walletPrivateKey is required.');
    return { walletPrivateKey: pk.trim() };
}

export function validateWithdrawBody(body: unknown): WithdrawRequestBody {
    if (!body || typeof body !== 'object') throw new Error('Invalid JSON body.');
    const p = body as Partial<WithdrawRequestBody>;
    if (!p.walletPrivateKey || !p.alchemyUrl || !p.relayerApiKey || !p.relayerApiKeyAddress || !p.recipient) {
        throw new Error('Required fields: walletPrivateKey, alchemyUrl, relayerApiKey, relayerApiKeyAddress, recipient.');
    }
    if (p.relayerTxType !== 'SAFE' && p.relayerTxType !== 'PROXY') {
        throw new Error("relayerTxType must be 'SAFE' or 'PROXY'.");
    }
    if (p.amount === undefined || (typeof p.amount !== 'string' && typeof p.amount !== 'number')) {
        throw new Error('amount is required.');
    }
    return {
        walletPrivateKey: p.walletPrivateKey.trim(),
        alchemyUrl: p.alchemyUrl.trim(),
        relayerApiKey: p.relayerApiKey.trim(),
        relayerApiKeyAddress: p.relayerApiKeyAddress.trim(),
        relayerTxType: p.relayerTxType,
        recipient: p.recipient.trim(),
        amount: p.amount,
        tokenAddress: typeof p.tokenAddress === 'string' ? p.tokenAddress.trim() : undefined
    };
}

export function validateWithdrawToBinanceBody(body: unknown): WithdrawToBinanceBody {
    if (!body || typeof body !== 'object') throw new Error('Invalid JSON body.');
    const o = body as Record<string, unknown>;
    if (!o.walletPrivateKey || !o.alchemyUrl || !o.binanceAddress) {
        throw new Error('Required fields: walletPrivateKey, alchemyUrl, binanceAddress, amount.');
    }
    if (o.amount === undefined || o.amount === null || (typeof o.amount !== 'string' && typeof o.amount !== 'number')) {
        throw new Error('amount is required.');
    }
    return {
        walletPrivateKey: String(o.walletPrivateKey).trim(),
        alchemyUrl: String(o.alchemyUrl).trim(),
        binanceAddress: String(o.binanceAddress).trim(),
        amount: o.amount as string | number,
        minAmountUsdc: o.minAmountUsdc as string | number | undefined,
        usdcContract: typeof o.usdcContract === 'string' ? o.usdcContract.trim() : undefined
    };
}

export function validateGetWalletBalanceBody(body: unknown): GetWalletBalanceBody {
    if (!body || typeof body !== 'object') throw new Error('Invalid JSON body.');
    const o = body as Record<string, unknown>;
    if (!o.alchemyUrl || typeof o.alchemyUrl !== 'string') throw new Error('alchemyUrl is required.');
    const walletPrivateKey = typeof o.walletPrivateKey === 'string' ? o.walletPrivateKey.trim() : undefined;
    const address = typeof o.address === 'string' ? o.address.trim() : undefined;
    if (!walletPrivateKey && !address) throw new Error('Provide address or walletPrivateKey.');
    if (walletPrivateKey && !walletPrivateKey.startsWith('0x')) {
        // lightweight sanity guard
        throw new Error('Invalid walletPrivateKey.');
    }
    return {
        alchemyUrl: o.alchemyUrl.trim(),
        walletPrivateKey,
        address,
        usdcContract: typeof o.usdcContract === 'string' ? o.usdcContract.trim() : undefined
    };
}

export async function readJsonBody(req: import('http').IncomingMessage): Promise<unknown> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const raw = Buffer.concat(chunks).toString('utf8');
    if (!raw) return {};
    try {
        return JSON.parse(raw);
    } catch {
        throw new Error('Invalid JSON.');
    }
}

export function deriveAddressFromPrivateKey(privateKey: string): string {
    return new ethers.Wallet(privateKey).address;
}
