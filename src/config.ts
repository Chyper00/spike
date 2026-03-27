import { RelayerTxType } from '@polymarket/builder-relayer-client';
import { ethers } from 'ethers';
import { ClaimExecutionConfig, ClaimRequestBody, WithdrawRequestBody } from './types';
import { DEFAULT_RELAYER_URL, DEFAULT_RPC_URL, USDC_POS } from './constants';
import { parseEthereumAddress, tryLoadBuilderConfig, parsePositiveTokenAmount } from './utils';

export function resolveClaimConfig(payload: ClaimRequestBody): ClaimExecutionConfig {
    const walletPrivateKey = (payload.walletPrivateKey || process.env.WALLET_PRIVATE_KEY)?.trim();
    if (!walletPrivateKey) throw new Error('Falta walletPrivateKey (body) ou WALLET_PRIVATE_KEY (.env).');
    const signerAddress = parseEthereumAddress('Endereço derivado da WALLET_PRIVATE_KEY', new ethers.Wallet(walletPrivateKey).address);
    const proxyWallet = parseEthereumAddress('POLYMARKET_USER / proxyWallet', (payload.proxyWallet || process.env.POLYMARKET_USER || signerAddress).trim());
    const alchemyUrl = (payload.alchemyUrl || process.env.ALCHEMY_URL || DEFAULT_RPC_URL).trim();
    const relayerUrl = (payload.relayerUrl || process.env.RELAYER_URL || DEFAULT_RELAYER_URL).trim();
    const relayerTxType = (payload.relayerTxType || process.env.RELAYER_TX_TYPE || 'SAFE') === 'PROXY' ? RelayerTxType.PROXY : RelayerTxType.SAFE;

    const builderConfig = tryLoadBuilderConfig();
    if (builderConfig?.isValid()) return { proxyWallet, walletPrivateKey, alchemyUrl, relayerUrl, relayerTxType, builderConfig };

    const relayerApiKey = (payload.relayerApiKey || process.env.RELAYER_API_KEY)?.trim();
    const relayerApiKeyAddressRaw = (payload.relayerApiKeyAddress || process.env.RELAYER_API_KEY_ADDRESS)?.trim();
    if (!relayerApiKey || !relayerApiKeyAddressRaw) throw new Error('Faltam RELAYER_API_KEY e/ou RELAYER_API_KEY_ADDRESS.');
    const relayerApiKeyAddress = parseEthereumAddress('RELAYER_API_KEY_ADDRESS', relayerApiKeyAddressRaw);
    if (signerAddress.toLowerCase() !== relayerApiKeyAddress.toLowerCase()) {
        throw new Error(`RELAYER_API_KEY_ADDRESS (${relayerApiKeyAddress}) precisa ser o mesmo da WALLET_PRIVATE_KEY (${signerAddress}).`);
    }
    return { proxyWallet, walletPrivateKey, alchemyUrl, relayerApiKey, relayerApiKeyAddress, relayerUrl, relayerTxType };
}

export function resolveWithdrawConfigFromBody(body: WithdrawRequestBody): {
    config: ClaimExecutionConfig;
    recipient: string;
    amountRaw: ethers.BigNumber;
    tokenAddress: string;
} {
    const signerAddress = parseEthereumAddress('walletPrivateKey', new ethers.Wallet(body.walletPrivateKey).address);
    const relayerKeyAddress = parseEthereumAddress('relayerApiKeyAddress', body.relayerApiKeyAddress);
    if (signerAddress.toLowerCase() !== relayerKeyAddress.toLowerCase()) {
        throw new Error(`relayerApiKeyAddress (${relayerKeyAddress}) precisa ser o mesmo da walletPrivateKey (${signerAddress}).`);
    }
    const recipient = parseEthereumAddress('recipient', body.recipient);
    const tokenAddress = body.tokenAddress ? parseEthereumAddress('tokenAddress', body.tokenAddress) : USDC_POS;
    const amountRaw = parsePositiveTokenAmount(body.amount, 6);
    return {
        config: {
            proxyWallet: signerAddress,
            walletPrivateKey: body.walletPrivateKey,
            alchemyUrl: body.alchemyUrl,
            relayerApiKey: body.relayerApiKey,
            relayerApiKeyAddress: relayerKeyAddress,
            relayerUrl: body.relayerUrl,
            relayerTxType: body.relayerTxType === 'PROXY' ? RelayerTxType.PROXY : RelayerTxType.SAFE
        },
        recipient,
        amountRaw,
        tokenAddress
    };
}
