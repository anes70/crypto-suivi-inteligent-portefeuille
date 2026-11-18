import type { ActiveChainId } from './chain';

export type AlertType =
  | 'price_target'
  | 'volume_spike'
  | 'rsi_threshold'
  | 'liquidity_drop'
  | 'take_profit'
  | 'stop_loss';

export type AlertConditionDirection = 'above' | 'below' | 'drop_pct' | 'spike_pct';

export interface TokenAlert {
  id: string;
  chain: ActiveChainId;
  tokenAddress: string;
  symbol: string;
  name: string;
  type: AlertType;
  direction: AlertConditionDirection;
  /** Target price ($), RSI threshold (0-100), or percentage delta (%) */
  thresholdValue: number;
  /** Baseline observed value at alert creation (e.g. liquidityUsd or volume24h) */
  baselineValue: number | null;
  enabled: boolean;
  triggered: boolean;
  triggeredAt: number | null;
  triggeredMessage: string | null;
  acknowledged: boolean;
  createdAt: number;
}

export interface CreateAlertInput {
  chain: ActiveChainId;
  tokenAddress: string;
  symbol: string;
  name: string;
  type: AlertType;
  direction: AlertConditionDirection;
  thresholdValue: number;
  baselineValue: number | null;
}

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  price_target: 'Prix cible',
  take_profit: 'Take Profit',
  stop_loss: 'Stop Loss',
  volume_spike: 'Variation brutale de volume',
  rsi_threshold: 'Seuil RSI (14)',
  liquidity_drop: 'Chute de liquidité (Rug Pull)',
};
