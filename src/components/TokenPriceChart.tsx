import { useEffect, useRef } from 'react';
import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  LineSeries,
  LineStyle,
  type IChartApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { ThemeMode } from '../types/config';
import type { OhlcvCandle, TechnicalAnalysisResult } from '../types/onchain';

export type ChartTimeframe = '15m' | '1H' | '4H' | '1D';

interface TokenPriceChartProps {
  candles: OhlcvCandle[];
  analysis: TechnicalAnalysisResult | null;
  theme: ThemeMode;
  showEma: boolean;
  showBollinger: boolean;
  showLevels: boolean;
  showOscillators?: boolean;
  height?: number;
}

function getPricePrecision(price: number): { precision: number; minMove: number } {
  if (!Number.isFinite(price) || price <= 0) return { precision: 4, minMove: 0.0001 };
  if (price >= 100) return { precision: 2, minMove: 0.01 };
  if (price >= 1) return { precision: 4, minMove: 0.0001 };
  if (price >= 0.01) return { precision: 5, minMove: 0.00001 };
  if (price >= 0.0001) return { precision: 7, minMove: 0.0000001 };
  return { precision: 9, minMove: 0.000000001 };
}

export function TokenPriceChart({
  candles,
  analysis,
  theme,
  showEma,
  showBollinger,
  showLevels,
  showOscillators = false,
  height = 340,
}: TokenPriceChartProps) {
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const oscContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = mainContainerRef.current;
    if (!el || candles.length === 0) return;

    const isDark = theme === 'dark';
    const lastPrice = candles[candles.length - 1]?.close || 1;
    const priceFmt = getPricePrecision(lastPrice);

    const chart: IChartApi = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: isDark ? '#94A3B8' : '#64748B',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: isDark ? 'rgba(148,163,184,0.07)' : 'rgba(15,23,42,0.06)' },
        horzLines: { color: isDark ? 'rgba(148,163,184,0.07)' : 'rgba(15,23,42,0.06)' },
      },
      rightPriceScale: {
        borderVisible: false,
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
      },
      width: el.clientWidth,
      height,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10B981',
      downColor: '#EF4444',
      borderVisible: false,
      wickUpColor: '#10B981',
      wickDownColor: '#EF4444',
      priceFormat: {
        type: 'price',
        precision: priceFmt.precision,
        minMove: priceFmt.minMove,
      },
    });

    // Deduplicate & ensure ascending timestamps
    const normalizedCandles: Array<OhlcvCandle & { utcTime: UTCTimestamp }> = [];
    let lastT = 0;
    for (const c of candles) {
      let t = Math.floor(c.time);
      if (t <= lastT) t = lastT + 1;
      lastT = t;
      normalizedCandles.push({ ...c, utcTime: t as UTCTimestamp });
    }

    candleSeries.setData(
      normalizedCandles.map((c) => ({
        time: c.utcTime,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );

    const mapLine = (arr: (number | null)[]) => {
      const pts: Array<{ time: UTCTimestamp; value: number }> = [];
      for (let i = 0; i < normalizedCandles.length; i++) {
        const val = arr[i];
        if (val !== null && Number.isFinite(val)) {
          pts.push({ time: normalizedCandles[i].utcTime, value: val });
        }
      }
      return pts;
    };

    if (analysis && showEma) {
      const ema20Data = mapLine(analysis.ema20);
      if (ema20Data.length > 0) {
        const s20 = chart.addSeries(LineSeries, {
          color: '#3B82F6',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        s20.setData(ema20Data);
      }
      const ema50Data = mapLine(analysis.ema50);
      if (ema50Data.length > 0) {
        const s50 = chart.addSeries(LineSeries, {
          color: '#F59E0B',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        s50.setData(ema50Data);
      }
      const ema200Data = mapLine(analysis.ema200);
      if (ema200Data.length > 0) {
        const s200 = chart.addSeries(LineSeries, {
          color: '#A855F7',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        s200.setData(ema200Data);
      }
    }

    if (analysis && showBollinger) {
      const upperData = mapLine(analysis.bollinger.upper);
      const lowerData = mapLine(analysis.bollinger.lower);
      if (upperData.length > 0) {
        const bu = chart.addSeries(LineSeries, {
          color: 'rgba(148, 163, 184, 0.55)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        bu.setData(upperData);
      }
      if (lowerData.length > 0) {
        const bl = chart.addSeries(LineSeries, {
          color: 'rgba(148, 163, 184, 0.55)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        bl.setData(lowerData);
      }
    }

    if (analysis && showLevels) {
      for (const sup of analysis.supports) {
        candleSeries.createPriceLine({
          price: sup.price,
          color: '#10B981',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: 'Support',
        });
      }
      for (const res of analysis.resistances) {
        candleSeries.createPriceLine({
          price: res.price,
          color: '#EF4444',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: 'Résistance',
        });
      }
    }

    chart.timeScale().fitContent();

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          chart.applyOptions({ width: entry.contentRect.width });
        }
      }
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [candles, analysis, theme, showEma, showBollinger, showLevels, height]);

  // Optional lower RSI(14) + MACD Histogram oscillator panel
  useEffect(() => {
    const el = oscContainerRef.current;
    if (!showOscillators || !el || !analysis || candles.length === 0) return;

    const isDark = theme === 'dark';
    const oscChart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: isDark ? '#94A3B8' : '#64748B',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: isDark ? 'rgba(148,163,184,0.06)' : 'rgba(15,23,42,0.05)' },
        horzLines: { color: isDark ? 'rgba(148,163,184,0.06)' : 'rgba(15,23,42,0.05)' },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true },
      width: el.clientWidth,
      height: 150,
    });

    let lastT = 0;
    const times: UTCTimestamp[] = candles.map((c) => {
      let t = Math.floor(c.time);
      if (t <= lastT) t = lastT + 1;
      lastT = t;
      return t as UTCTimestamp;
    });

    const rsiSeries = oscChart.addSeries(LineSeries, {
      color: '#3B82F6',
      lineWidth: 2,
      priceScaleId: 'right',
    });

    const rsiPts = times
      .map((time, idx) =>
        analysis.rsi14[idx] !== null ? { time, value: analysis.rsi14[idx]! } : null
      )
      .filter((x): x is { time: UTCTimestamp; value: number } => x !== null);

    if (rsiPts.length > 0) {
      rsiSeries.setData(rsiPts);
      rsiSeries.createPriceLine({
        price: 70,
        color: 'rgba(239, 68, 68, 0.5)',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: '70',
      });
      rsiSeries.createPriceLine({
        price: 30,
        color: 'rgba(16, 185, 129, 0.5)',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: '30',
      });
    }

    // MACD Histogram plotted on separate left invisible scale so RSI 0-100 stays crisp
    const histSeries = oscChart.addSeries(HistogramSeries, {
      priceScaleId: 'macd',
      priceLineVisible: false,
      lastValueVisible: false,
    });
    oscChart.priceScale('macd').applyOptions({
      scaleMargins: { top: 0.65, bottom: 0.05 },
      visible: false,
    });

    const histPts = times
      .map((time, idx) => {
        const val = analysis.macd.histogram[idx];
        if (val === null) return null;
        return {
          time,
          value: val,
          color: val >= 0 ? 'rgba(16, 185, 129, 0.45)' : 'rgba(239, 68, 68, 0.45)',
        };
      })
      .filter((x): x is { time: UTCTimestamp; value: number; color: string } => x !== null);

    if (histPts.length > 0) {
      histSeries.setData(histPts);
    }

    oscChart.timeScale().fitContent();

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          oscChart.applyOptions({ width: entry.contentRect.width });
        }
      }
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      oscChart.remove();
    };
  }, [showOscillators, analysis, candles, theme]);

  if (candles.length === 0) {
    return (
      <div
        style={{ height }}
        className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center px-4 text-center"
      >
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Aucune bougie OHLCV disponible pour cette pool sur GeckoTerminal.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div ref={mainContainerRef} className="w-full" style={{ height }} />
      {showOscillators && (
        <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800/80">
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
            <span>RSI (14) &amp; Histogramme MACD (12, 26, 9)</span>
            <span className="font-mono">
              RSI: {analysis?.latestRsi14 !== null && analysis?.latestRsi14 !== undefined ? analysis.latestRsi14.toFixed(1) : '—'}
            </span>
          </div>
          <div ref={oscContainerRef} className="w-full h-[150px]" />
        </div>
      )}
    </div>
  );
}
