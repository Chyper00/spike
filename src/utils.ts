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
            `${label} is invalid: expected 0x + 40 hex characters (42 total). ` +
                `Got ${s.length} characters (${hexDigits} hex).`
        );
    }
    try {
        return ethers.utils.getAddress(s);
    } catch {
        throw new Error(`${label} is invalid (checksum).`);
    }
}

export function parsePositiveTokenAmount(amount: string | number, decimals = ERC20_DECIMALS): ethers.BigNumber {
    const raw = typeof amount === 'number' ? String(amount) : amount.trim();
    if (!/^\d+(\.\d+)?$/u.test(raw)) {
        throw new Error('amount is invalid. Use a positive number, e.g. "10.5".');
    }
    const parsed = ethers.utils.parseUnits(raw, decimals);
    if (parsed.lte(0)) {
        throw new Error('amount must be greater than zero.');
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
    return 'ERC-20 (custom usdcContract)';
}

export function buildBuilderConfigFromBody(creds: { key: string; secret: string; passphrase: string }): BuilderConfig {
    return new BuilderConfig({ localBuilderCreds: { key: creds.key, secret: creds.secret, passphrase: creds.passphrase } });
}

type RelayerJsonError = {
    status?: number;
    statusText?: string;
    data?: unknown;
    error?: string;
    axiosMessage?: string;
    code?: string;
    errno?: string | number;
    syscall?: string;
    hostname?: string;
    address?: string;
    port?: string | number;
};

function formatParsedRelayerPayload(parsed: RelayerJsonError): string {
    if (parsed.status === 401 && parsed.data && typeof parsed.data === 'object' && parsed.data !== null && 'error' in parsed.data) {
        const d = parsed.data as { error?: string };
        if (d.error === 'invalid authorization') {
            return (
                'Relayer 401 invalid authorization. Check relayerApiKey and relayerApiKeyAddress. ' +
                `Detail: ${JSON.stringify(parsed)}`
            );
        }
    }
    if (parsed.error === 'connection error') {
        const parts = [
            'Relayer: network failure (no HTTP response).',
            parsed.axiosMessage && `axios: ${parsed.axiosMessage}`,
            parsed.code && `code: ${parsed.code}`,
            parsed.errno !== undefined && `errno: ${parsed.errno}`,
            parsed.syscall && `syscall: ${parsed.syscall}`,
            parsed.hostname && `host: ${parsed.hostname}`,
            parsed.address && `address: ${parsed.address}`,
            parsed.port !== undefined && `port: ${parsed.port}`
        ].filter(Boolean) as string[];
        return parts.join(' | ');
    }
    if (parsed.error === 'request error') {
        return `Relayer HTTP ${parsed.status ?? '?'} ${parsed.statusText ?? ''}: ${JSON.stringify(parsed.data)}`.trim();
    }
    try {
        return JSON.stringify(parsed);
    } catch {
        return String(parsed);
    }
}

export function formatRelayerError(err: unknown): string {
    if (!(err instanceof Error)) return String(err);
    const msg = err.message;
    try {
        const parsed = JSON.parse(msg) as RelayerJsonError;
        if (typeof parsed === 'object' && parsed !== null && 'error' in parsed) {
            return formatParsedRelayerPayload(parsed);
        }
    } catch {
        // no-op
    }
    return msg;
}

/** Whether to retry with the fallback relayer URL (network errors, some 5xx/404). */
export function shouldRetryRelayerWithFallback(err: unknown): boolean {
    const text = formatRelayerError(err);
    const lower = text.toLowerCase();
    if (lower.includes('401') && (lower.includes('invalid authorization') || lower.includes('relayer 401'))) return false;
    if (lower.includes('403')) return false;
    if (/\b(econnrefused|enotfound|etimedout|econnreset|eai_again|enetunreach|ehostunreach|ecanceled)\b/i.test(text)) return true;
    if (lower.includes('network failure') || lower.includes('no http response')) return true;
    const m = /relayer http (\d+)/i.exec(text);
    if (m) {
        const code = parseInt(m[1], 10);
        if (code === 404 || code === 502 || code === 503 || code === 504) return true;
    }
    return false;
}

/** Hostname for logs (avoids logging path/query that may contain secrets). */
export function urlHostForLog(url: string): string {
    try {
        return new URL(url.trim()).host;
    } catch {
        return '(invalid url)';
    }
}

const REDEEM_CREATE_BODY_LOG_MAX = 2048;

/** Format HTTP error body for messages (truncated). Pulls `error`/`message` when JSON. */
export function formatRedeemCreateErrorResponse(status: number, bodyText: string): string {
    const trimmed = bodyText.trim();
    const truncated =
        trimmed.length > REDEEM_CREATE_BODY_LOG_MAX
            ? `${trimmed.slice(0, REDEEM_CREATE_BODY_LOG_MAX)}…`
            : trimmed;
    if (!truncated) {
        return `redeem/create failed: HTTP ${status} (empty response body)`;
    }
    try {
        const j = JSON.parse(truncated) as { error?: unknown; message?: unknown };
        const detail =
            (typeof j.error === 'string' && j.error) ||
            (typeof j.message === 'string' && j.message) ||
            truncated;
        return `redeem/create failed: HTTP ${status} — ${detail}`;
    } catch {
        return `redeem/create failed: HTTP ${status} — ${truncated}`;
    }
}

export function rethrowIfRpcAuthFailed(err: unknown, context: string): never {
    const msg = err instanceof Error ? err.message : String(err);
    const lower = msg.toLowerCase();
    if (msg.includes('Must be authenticated') || (lower.includes('server_error') && msg.includes('401')) || msg.includes('"status":401')) {
        throw new Error(
            `${context}: RPC returned 401 (Alchemy). Ensure alchemyUrl is complete and includes a valid API key.`
        );
    }
    throw err instanceof Error ? err : new Error(String(err));
}
