import { RelayerTxType } from '@polymarket/builder-relayer-client';
import { ethers } from 'ethers';
import { ClaimExecutionConfig, ClaimRequestBody, WithdrawRequestBody } from './types';
import { parseEthereumAddress, buildBuilderConfigFromBody, parsePositiveTokenAmount } from './utils';
import { USDC_POS } from './constants';

export function resolveClaimConfig(payload: ClaimRequestBody): ClaimExecutionConfig {
    const walletPrivateKey = payload.walletPrivateKey.trim();
    const signerAddress = parseEthereumAddress('walletPrivateKey', new ethers.Wallet(walletPrivateKey).address);
    const proxyWallet = parseEthereumAddress('proxyWallet', payload.proxyWallet.trim());
    const alchemyUrl = payload.alchemyUrl.trim();
    const relayerTxType = payload.relayerTxType === 'PROXY' ? RelayerTxType.PROXY : RelayerTxType.SAFE;
    const redeemCreateUrl = payload.redeemCreateUrl?.trim();

    const builderKey = payload.builderApiKey?.trim();
    const builderSecret = payload.builderSecret?.trim();
    const builderPassphrase = payload.builderPassphrase?.trim();
    const hasBuilder = Boolean(builderKey && builderSecret && builderPassphrase);
    const hasRelayerKeys = Boolean(payload.relayerApiKey?.trim() && payload.relayerApiKeyAddress?.trim());

    if (hasBuilder) {
        const builderConfig = buildBuilderConfigFromBody({
            key: builderKey as string,
            secret: builderSecret as string,
            passphrase: builderPassphrase as string
        });
        if (!builderConfig.isValid()) throw new Error('Invalid builder credentials.');
        return {
            proxyWallet,
            walletPrivateKey,
            alchemyUrl,
            relayerTxType,
            builderConfig,
            redeemCreateUrl: redeemCreateUrl || undefined
        };
    }

    if (!hasRelayerKeys) {
        throw new Error(
            'Provide relayerApiKey + relayerApiKeyAddress, or builderApiKey + builderSecret + builderPassphrase in the body.'
        );
    }
    const relayerApiKey = payload.relayerApiKey!.trim();
    const relayerApiKeyAddress = parseEthereumAddress('relayerApiKeyAddress', payload.relayerApiKeyAddress!.trim());
    if (signerAddress.toLowerCase() !== relayerApiKeyAddress.toLowerCase()) {
        throw new Error(
            `relayerApiKeyAddress (${relayerApiKeyAddress}) must match the address derived from walletPrivateKey (${signerAddress}).`
        );
    }
    return {
        proxyWallet,
        walletPrivateKey,
        alchemyUrl,
        relayerApiKey,
        relayerApiKeyAddress,
        relayerTxType,
        redeemCreateUrl: redeemCreateUrl || undefined
    };
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
        throw new Error(
            `relayerApiKeyAddress (${relayerKeyAddress}) must match the address derived from walletPrivateKey (${signerAddress}).`
        );
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
            relayerTxType: body.relayerTxType === 'PROXY' ? RelayerTxType.PROXY : RelayerTxType.SAFE
        },
        recipient,
        amountRaw,
        tokenAddress
    };
}
