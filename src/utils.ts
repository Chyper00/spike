import { BuilderConfig } from '@polymarket/builder-signing-sdk';
import { ethers } from 'ethers';
import { ERC20_DECIMALS, POLYGON_NETWORK, USDC_NATIVE, USDC_POS } from './constants';

export function createPolygonProvider(rpcUrl: string): ethers.providers.StaticJsonRpcProvider {
    return new ethers.providers.StaticJsonRpcProvider(rpcUrl.trim(), POLYGON_NETWORK);
}

export function parseEthereumAddress(label: string, raw: string): string {
    const s = raw.trim();
    if (!/^0x[a-fA-F0-9]{40}$/u.test(s)) {
        const hexDigits = s.startsWith('0x') ? s.length - 2 : s.length;
        throw new Error(
            `${label} inválido: precisa ser 0x + 40 caracteres hex (42 no total). ` +
                `Recebido: ${s.length} caracteres (${hexDigits} hex).`
        );
    }
    try {
        return ethers.utils.getAddress(s);
    } catch {
        throw new Error(`${label} inválido (checksum).`);
    }
}

export function parsePositiveTokenAmount(amount: string | number, decimals = ERC20_DECIMALS): ethers.BigNumber {
    const raw = typeof amount === 'number' ? String(amount) : amount.trim();
    if (!/^\d+(\.\d+)?$/u.test(raw)) {
        throw new Error('amount inválido. Use número positivo, ex: "10.5".');
    }
    const parsed = ethers.utils.parseUnits(raw, decimals);
    if (parsed.lte(0)) {
        throw new Error('amount deve ser maior que zero.');
    }
    return parsed;
}

export function normalizePathname(pathname: string): string {
    return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

export function describeUsdcToken(tokenChecksummed: string): string {
    const a = tokenChecksummed.toLowerCase();
    if (a === USDC_POS.toLowerCase()) return 'USD Coin (PoS) (USDC.e)';
    if (a === USDC_NATIVE.toLowerCase()) return 'USDC (native Circle)';
    return 'ERC-20 (usdcContract customizado)';
}

export function buildBuilderConfigFromBody(creds: { key: string; secret: string; passphrase: string }): BuilderConfig {
    return new BuilderConfig({ localBuilderCreds: { key: creds.key, secret: creds.secret, passphrase: creds.passphrase } });
}

export function formatRelayerError(err: unknown): string {
    if (!(err instanceof Error)) return String(err);
    const msg = err.message;
    try {
        const parsed = JSON.parse(msg) as { status?: number; data?: { error?: string } };
        if (parsed.status === 401 && parsed.data?.error === 'invalid authorization') {
            return (
                'Relayer 401 invalid authorization. Verifique RELAYER_API_KEY e RELAYER_API_KEY_ADDRESS. ' +
                `Detalhe: ${msg}`
            );
        }
    } catch {
        // no-op
    }
    return msg;
}

export function rethrowIfRpcAuthFailed(err: unknown, context: string): never {
    const msg = err instanceof Error ? err.message : String(err);
    const lower = msg.toLowerCase();
    if (msg.includes('Must be authenticated') || (lower.includes('server_error') && msg.includes('401')) || msg.includes('"status":401')) {
        throw new Error(
            `${context}: RPC respondeu 401 (Alchemy). Verifique se alchemyUrl está completa e com API key válida.`
        );
    }
    throw err instanceof Error ? err : new Error(String(err));
}
