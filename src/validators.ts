import { ethers } from 'ethers';
import { ClaimRequestBody, GetWalletBalanceBody, WithdrawRequestBody, WithdrawToBinanceBody } from './types';

function nonEmptyString(v: unknown): string | undefined {
    if (typeof v !== 'string') return undefined;
    const t = v.trim();
    return t.length > 0 ? t : undefined;
}

export function validateClaimBody(body: unknown): ClaimRequestBody {
    if (!body || typeof body !== 'object') throw new Error('Body inválido.');
    const p = body as Partial<ClaimRequestBody>;
    const missing: string[] = [];
    if (!nonEmptyString(p.walletPrivateKey)) missing.push('walletPrivateKey');
    if (!nonEmptyString(p.proxyWallet)) missing.push('proxyWallet');
    if (!nonEmptyString(p.alchemyUrl)) missing.push('alchemyUrl');
    if (!nonEmptyString(p.relayerUrl)) missing.push('relayerUrl');
    if (p.relayerTxType !== 'SAFE' && p.relayerTxType !== 'PROXY') missing.push('relayerTxType (SAFE ou PROXY)');
    if (missing.length) {
        throw new Error(`Faltam ou estão vazios: ${missing.join(', ')}.`);
    }
    const relayerTxType = p.relayerTxType;
    return {
        walletPrivateKey: String(p.walletPrivateKey).trim(),
        proxyWallet: String(p.proxyWallet).trim(),
        alchemyUrl: String(p.alchemyUrl).trim(),
        relayerUrl: String(p.relayerUrl).trim(),
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
    if (!body || typeof body !== 'object') throw new Error('Body inválido.');
    const pk = (body as { walletPrivateKey?: unknown }).walletPrivateKey;
    if (typeof pk !== 'string' || !pk.trim()) throw new Error('walletPrivateKey é obrigatório.');
    return { walletPrivateKey: pk.trim() };
}

export function validateWithdrawBody(body: unknown): WithdrawRequestBody {
    if (!body || typeof body !== 'object') throw new Error('Body inválido.');
    const p = body as Partial<WithdrawRequestBody>;
    if (!p.walletPrivateKey || !p.alchemyUrl || !p.relayerApiKey || !p.relayerApiKeyAddress || !p.relayerUrl || !p.recipient) {
        throw new Error('Campos obrigatórios: walletPrivateKey, alchemyUrl, relayerApiKey, relayerApiKeyAddress, relayerUrl, recipient.');
    }
    if (p.relayerTxType !== 'SAFE' && p.relayerTxType !== 'PROXY') {
        throw new Error("relayerTxType deve ser 'SAFE' ou 'PROXY'.");
    }
    if (p.amount === undefined || (typeof p.amount !== 'string' && typeof p.amount !== 'number')) {
        throw new Error('amount é obrigatório.');
    }
    return {
        walletPrivateKey: p.walletPrivateKey.trim(),
        alchemyUrl: p.alchemyUrl.trim(),
        relayerApiKey: p.relayerApiKey.trim(),
        relayerApiKeyAddress: p.relayerApiKeyAddress.trim(),
        relayerUrl: p.relayerUrl.trim(),
        relayerTxType: p.relayerTxType,
        recipient: p.recipient.trim(),
        amount: p.amount,
        tokenAddress: typeof p.tokenAddress === 'string' ? p.tokenAddress.trim() : undefined
    };
}

export function validateWithdrawToBinanceBody(body: unknown): WithdrawToBinanceBody {
    if (!body || typeof body !== 'object') throw new Error('Body inválido.');
    const o = body as Record<string, unknown>;
    if (!o.walletPrivateKey || !o.alchemyUrl || !o.binanceAddress) {
        throw new Error('Campos obrigatórios: walletPrivateKey, alchemyUrl, binanceAddress, amount.');
    }
    if (o.amount === undefined || o.amount === null || (typeof o.amount !== 'string' && typeof o.amount !== 'number')) {
        throw new Error('amount é obrigatório.');
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
    if (!body || typeof body !== 'object') throw new Error('Body inválido.');
    const o = body as Record<string, unknown>;
    if (!o.alchemyUrl || typeof o.alchemyUrl !== 'string') throw new Error('alchemyUrl é obrigatório.');
    const walletPrivateKey = typeof o.walletPrivateKey === 'string' ? o.walletPrivateKey.trim() : undefined;
    const address = typeof o.address === 'string' ? o.address.trim() : undefined;
    if (!walletPrivateKey && !address) throw new Error('Informe address ou walletPrivateKey.');
    if (walletPrivateKey && !walletPrivateKey.startsWith('0x')) {
        // lightweight sanity guard
        throw new Error('walletPrivateKey inválida.');
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
        throw new Error('JSON inválido.');
    }
}

export function deriveAddressFromPrivateKey(privateKey: string): string {
    return new ethers.Wallet(privateKey).address;
}
