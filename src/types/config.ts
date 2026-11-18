export interface ApiConfigStatus {
  alchemyConfigured: boolean;
  robinhoodAlchemyConfigured: boolean;
  heliusConfigured: boolean;
  groqConfigured: boolean;
  geminiConfigured: boolean;
  basePublicRpc: string;
  solanaPublicRpc: string;
  robinhoodRpcEndpoint: string;
  dexscreenerEnabled: boolean;
}

export type ThemeMode = 'dark' | 'light';

export interface AppPreferences {
  theme: ThemeMode;
  dustThresholdUsd: number;
  customBaseTokens: string[];
}
