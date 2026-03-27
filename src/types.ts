import { BuilderConfig } from '@polymarket/builder-signing-sdk';
import { RelayerTxType } from '@polymarket/builder-relayer-client';

export type RedeemCreateMarket = { conditionId: string };

export type RedeemCreateResponse = {
    markets?: RedeemCreateMarket[];
    marketsCount?: number;
    totalRedeemableValue?: number;
    redeemUrl?: string;
    shortLink?: string;
};

export type EncodedRedeemPayload = { markets?: RedeemCreateMarket[] };

export type ClaimRequestBody = {
    proxyWallet: string;
    walletPrivateKey: string;
    alchemyUrl: string;
    relayerTxType: 'SAFE' | 'PROXY';
    relayerApiKey?: string;
    relayerApiKeyAddress?: string;
    builderApiKey?: string;
    builderSecret?: string;
    builderPassphrase?: string;
    redeemCreateUrl?: string;
};

export type ClaimExecutionConfig = {
    proxyWallet: string;
    walletPrivateKey: string;
    alchemyUrl: string;
    relayerApiKey?: string;
    relayerApiKeyAddress?: string;
    relayerTxType: RelayerTxType;
    builderConfig?: BuilderConfig;
    redeemCreateUrl?: string;
};

export type WithdrawRequestBody = {
    walletPrivateKey: string;
    alchemyUrl: string;
    relayerApiKey: string;
    relayerApiKeyAddress: string;
    relayerTxType: 'SAFE' | 'PROXY';
    recipient: string;
    amount: string | number;
    tokenAddress?: string;
};

export type WithdrawToBinanceBody = {
    walletPrivateKey: string;
    alchemyUrl: string;
    binanceAddress: string;
    amount: string | number;
    minAmountUsdc?: string | number;
    usdcContract?: string;
};

export type GetWalletBalanceBody = {
    alchemyUrl: string;
    walletPrivateKey?: string;
    address?: string;
    usdcContract?: string;
};
