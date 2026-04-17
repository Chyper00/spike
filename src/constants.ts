import { ethers } from 'ethers';

export const CHAIN_ID = 137;
export const POLYGON_NETWORK: ethers.providers.Networkish = { chainId: CHAIN_ID, name: 'matic' };

export const DEFAULT_RPC_URL = 'https://polygon-rpc.com';
/** Default: v2 first (fewer DNS/network issues than relayer.polymarket.com in some environments). */
export const RELAYER_URL_PRIMARY = 'https://relayer-v2.polymarket.com';
/** Second host when the primary fails with a retryable network/5xx/404 error. */
export const RELAYER_URL_FALLBACK = 'https://relayer.polymarket.com/api/v1';

/** Order [primary, fallback], with optional env override (deduped if equal). */
export function resolveRelayerUrlChain(): string[] {
    const first = process.env.POLYMARKET_RELAYER_PRIMARY?.trim() || RELAYER_URL_PRIMARY;
    const second = process.env.POLYMARKET_RELAYER_FALLBACK?.trim() || RELAYER_URL_FALLBACK;
    if (first === second) return [first];
    return [first, second];
}
export const DEFAULT_REDEEM_CREATE_URL = 'https://polymarket.com/api/redeem/create';

export const CTF_ADDRESS = '0x4d97dcd97ec945f40cf65f87097ace5ea0476045';
export const USDC_POS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
export const USDC_NATIVE = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
export const ERC20_DECIMALS = 6;

export const ERC20_MIN_ABI = [
    'function balanceOf(address owner) view returns (uint256)',
    'function transfer(address to, uint256 value) returns (bool)'
];
