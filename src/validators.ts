import { ethers } from 'ethers';
import { ClaimRequestBody, GetWalletBalanceBody, WithdrawRequestBody, WithdrawToBinanceBody } from './types';

export function validateClaimBody(body: unknown): ClaimRequestBody {
    if (!body || typeof body !== 'object') return {};
    const parsed = body as Partial<ClaimRequestBody>;
    return {
        proxyWallet: typeof parsed.proxyWallet === 'string' ? parsed.proxyWallet.trim() : undefined,
        walletPrivateKey: typeof parsed.walletPrivateKey === 'string' ? parsed.walletPrivateKey.trim() : undefined,
        alchemyUrl: typeof parsed.alchemyUrl === 'string' ? parsed.alchemyUrl.trim() : undefined,
        relayerApiKey: typeof parsed.relayerApiKey === 'string' ? parsed.relayerApiKey.trim() : undefined,
        relayerApiKeyAddress: typeof parsed.relayerApiKeyAddress === 'string' ? parsed.relayerApiKeyAddress.trim() : undefined,
        relayerUrl: typeof parsed.relayerUrl === 'string' ? parsed.relayerUrl.trim() : undefined,
        relayerTxType: parsed.relayerTxType === 'PROXY' ? 'PROXY' : parsed.relayerTxType === 'SAFE' ? 'SAFE' : undefined
    };
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
