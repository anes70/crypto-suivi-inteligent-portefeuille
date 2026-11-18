import type {
  GlobalTrend,
  OhlcvCandle,
  TechnicalAnalysisResult,
  TechnicalLevel,
} from '../types/onchain';

export function calculateSMA(values: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(values.length).fill(null);
  if (period <= 0 || values.length < period) return result;

  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) {
      sum -= values[i - period];
    }
    if (i >= period - 1) {
      result[i] = sum / period;
    }
  }
  return result;
}

export function calculateEMA(values: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(values.length).fill(null);
  if (period <= 0 || values.length < period) return result;

  const k = 2 / (period + 1);
  let seed = 0;
  for (let i = 0; i < period; i++) {
    seed += values[i];
  }
  let ema = seed / period;
  result[period - 1] = ema;

  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
    result[i] = ema;
  }
  return result;
}

export function calculateRSI(values: number[], period = 14): (number | null)[] {
  const result: (number | null)[] = new Array(values.length).fill(null);
  if (values.length <= period) return result;

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gainSum += diff;
    else lossSum += Math.abs(diff);
  }

  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;

  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return result;
}

export function calculateMACD(
  values: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
) {
  const emaFast = calculateEMA(values, fastPeriod);
  const emaSlow = calculateEMA(values, slowPeriod);
  const macdLine: (number | null)[] = values.map((_, idx) => {
    const f = emaFast[idx];
    const s = emaSlow[idx];
    return f !== null && s !== null ? f - s : null;
  });

  const validMacd: number[] = [];
  const validIndices: number[] = [];
  macdLine.forEach((val, idx) => {
    if (val !== null) {
      validMacd.push(val);
      validIndices.push(idx);
    }
  });

  const signalRaw = calculateEMA(validMacd, signalPeriod);
  const signalLine: (number | null)[] = new Array(values.length).fill(null);
  const histogram: (number | null)[] = new Array(values.length).fill(null);

  validIndices.forEach((origIdx, k) => {
    const sig = signalRaw[k];
    signalLine[origIdx] = sig;
    if (sig !== null && macdLine[origIdx] !== null) {
      histogram[origIdx] = macdLine[origIdx]! - sig;
    }
  });

  return { macdLine, signalLine, histogram };
}

export function calculateBollingerBands(
  values: number[],
  period = 20,
  stdMultiplier = 2
) {
  const middle = calculateSMA(values, period);
  const upper: (number | null)[] = new Array(values.length).fill(null);
  const lower: (number | null)[] = new Array(values.length).fill(null);

  for (let i = period - 1; i < values.length; i++) {
    const mean = middle[i];
    if (mean === null) continue;
    let variance = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = values[j] - mean;
      variance += diff * diff;
    }
    const std = Math.sqrt(variance / period);
    upper[i] = mean + stdMultiplier * std;
    lower[i] = mean - stdMultiplier * std;
  }

  return { upper, middle, lower };
}

export function calculateATR(candles: OhlcvCandle[], period = 14): (number | null)[] {
  const result: (number | null)[] = new Array(candles.length).fill(null);
  if (candles.length <= period) return result;

  const trueRanges: number[] = [candles[0].high - candles[0].low];
  for (let i = 1; i < candles.length; i++) {
    const curr = candles[i];
    const prevClose = candles[i - 1].close;
    const tr = Math.max(
      curr.high - curr.low,
      Math.abs(curr.high - prevClose),
      Math.abs(curr.low - prevClose)
    );
    trueRanges.push(tr);
  }

  let atr = 0;
  for (let i = 1; i <= period; i++) {
    atr += trueRanges[i];
  }
  atr /= period;
  result[period] = atr;

  for (let i = period + 1; i < candles.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
    result[i] = atr;
  }

  return result;
}

export function findSupportResistance(
  candles: OhlcvCandle[],
  lookback = 4
): { supports: TechnicalLevel[]; resistances: TechnicalLevel[] } {
  if (candles.length < lookback * 2 + 1) {
    return { supports: [], resistances: [] };
  }

  const latestClose = candles[candles.length - 1].close;
  const rawSwings: Array<{ price: number; type: 'support' | 'resistance' }> = [];

  for (let i = lookback; i < candles.length - lookback; i++) {
    const current = candles[i];
    let isSwingHigh = true;
    let isSwingLow = true;

    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (candles[j].high >= current.high) isSwingHigh = false;
      if (candles[j].low <= current.low) isSwingLow = false;
    }

    if (isSwingHigh) {
      rawSwings.push({ price: current.high, type: 'resistance' });
    }
    if (isSwingLow) {
      rawSwings.push({ price: current.low, type: 'support' });
    }
  }

  const clusterLevels = (
    items: Array<{ price: number; type: 'support' | 'resistance' }>,
    type: 'support' | 'resistance'
  ): TechnicalLevel[] => {
    const filtered = items.filter((item) =>
      type === 'support' ? item.price <= latestClose * 1.02 : item.price >= latestClose * 0.98
    );
    const clusters: Array<{ sum: number; count: number }> = [];
    const tolerance = 0.018; // 1.8% proximity band

    for (const item of filtered) {
      const match = clusters.find(
        (c) => Math.abs(c.sum / c.count - item.price) / item.price <= tolerance
      );
      if (match) {
        match.sum += item.price;
        match.count += 1;
      } else {
        clusters.push({ sum: item.price, count: 1 });
      }
    }

    return clusters
      .map((c) => ({
        price: c.sum / c.count,
        type,
        touches: c.count,
      }))
      .sort((a, b) =>
        type === 'support'
          ? Math.abs(latestClose - a.price) - Math.abs(latestClose - b.price)
          : Math.abs(a.price - latestClose) - Math.abs(b.price - latestClose)
      )
      .slice(0, 3);
  };

  return {
    supports: clusterLevels(
      rawSwings.filter((s) => s.type === 'support'),
      'support'
    ),
    resistances: clusterLevels(
      rawSwings.filter((s) => s.type === 'resistance'),
      'resistance'
    ),
  };
}

function getLatestValue(series: (number | null)[]): number | null {
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i] !== null && Number.isFinite(series[i]!)) {
      return series[i]!;
    }
  }
  return null;
}

export function analyzeTechnicalIndicators(
  candles: OhlcvCandle[]
): TechnicalAnalysisResult {
  const closes = candles.map((c) => c.close);
  const latestClose = closes.length > 0 ? closes[closes.length - 1] : 0;

  const sma20 = calculateSMA(closes, 20);
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);
  const ema200 = calculateEMA(closes, 200);
  const rsi14 = calculateRSI(closes, 14);
  const macdData = calculateMACD(closes, 12, 26, 9);
  const bollinger = calculateBollingerBands(closes, 20, 2);
  const atr14 = calculateATR(candles, 14);
  const { supports, resistances } = findSupportResistance(candles);

  const latestRsi14 = getLatestValue(rsi14);
  const latestEma20 = getLatestValue(ema20);
  const latestEma50 = getLatestValue(ema50);
  const latestEma200 = getLatestValue(ema200);
  const latestMacd = getLatestValue(macdData.macdLine);
  const latestSignal = getLatestValue(macdData.signalLine);
  const latestHistogram = getLatestValue(macdData.histogram);
  const latestAtr14 = getLatestValue(atr14);

  const latestBbUpper = getLatestValue(bollinger.upper);
  const latestBbLower = getLatestValue(bollinger.lower);
  const latestBbMid = getLatestValue(bollinger.middle);
  const bandwidthPercent =
    latestBbUpper !== null && latestBbLower !== null && latestBbMid
      ? ((latestBbUpper - latestBbLower) / latestBbMid) * 100
      : null;

  const atrPercent =
    latestAtr14 !== null && latestClose > 0 ? (latestAtr14 / latestClose) * 100 : null;

  let rsiSignal: TechnicalAnalysisResult['rsiSignal'] = 'Données insuffisantes';
  if (latestRsi14 !== null) {
    if (latestRsi14 >= 70) rsiSignal = 'Suracheté';
    else if (latestRsi14 <= 30) rsiSignal = 'Survendu';
    else rsiSignal = 'Neutre';
  }

  let macdBias: TechnicalAnalysisResult['macd']['bias'] = 'Neutre';
  if (latestMacd !== null && latestSignal !== null) {
    if (latestMacd > latestSignal && (latestHistogram ?? 0) > 0) macdBias = 'Haussier';
    else if (latestMacd < latestSignal && (latestHistogram ?? 0) < 0) macdBias = 'Baissier';
  }

  // Composite trend score based on transparent mathematical rules
  let score = 0;
  const trendReasons: string[] = [];

  if (latestEma20 !== null && latestClose > 0) {
    if (latestClose > latestEma20) {
      score += 1;
      trendReasons.push('Prix au-dessus de l’EMA 20');
    } else {
      score -= 1;
      trendReasons.push('Prix sous l’EMA 20');
    }
  }

  if (latestEma20 !== null && latestEma50 !== null) {
    if (latestEma20 > latestEma50) {
      score += 1;
      trendReasons.push('EMA 20 > EMA 50 (structure haussière)');
    } else {
      score -= 1;
      trendReasons.push('EMA 20 < EMA 50 (pression baissière)');
    }
  }

  if (latestEma200 !== null && latestClose > 0) {
    if (latestClose > latestEma200) {
      score += 1;
      trendReasons.push('Prix au-dessus de l’EMA 200 long terme');
    } else {
      score -= 1;
      trendReasons.push('Prix sous l’EMA 200 long terme');
    }
  }

  if (macdBias === 'Haussier') {
    score += 1;
    trendReasons.push('MACD au-dessus de sa ligne de signal');
  } else if (macdBias === 'Baissier') {
    score -= 1;
    trendReasons.push('MACD sous sa ligne de signal');
  }

  if (latestRsi14 !== null) {
    if (latestRsi14 > 55 && latestRsi14 < 70) {
      score += 1;
      trendReasons.push(`Momentum RSI positif (${latestRsi14.toFixed(1)})`);
    } else if (latestRsi14 < 45 && latestRsi14 > 30) {
      score -= 1;
      trendReasons.push(`Momentum RSI faible (${latestRsi14.toFixed(1)})`);
    }
  }

  let globalTrend: GlobalTrend = 'Neutre';
  if (score >= 2) globalTrend = 'Haussier';
  else if (score <= -2) globalTrend = 'Baissier';

  return {
    candleCount: candles.length,
    latestClose,
    sma20,
    ema20,
    ema50,
    ema200,
    rsi14,
    latestRsi14,
    rsiSignal,
    macd: {
      macdLine: macdData.macdLine,
      signalLine: macdData.signalLine,
      histogram: macdData.histogram,
      latestMacd,
      latestSignal,
      latestHistogram,
      bias: macdBias,
    },
    bollinger: {
      upper: bollinger.upper,
      middle: bollinger.middle,
      lower: bollinger.lower,
      bandwidthPercent,
    },
    atr14,
    latestAtr14,
    atrPercent,
    supports,
    resistances,
    globalTrend,
    trendReasons,
  };
}
