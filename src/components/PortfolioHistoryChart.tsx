import { useEffect, useRef } from 'react';
import {
  AreaSeries,
  ColorType,
  createChart,
  type IChartApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { ThemeMode } from '../types/config';
import type { PortfolioSnapshot } from '../types/portfolio';
import { formatUsd } from '../utils/format';

interface PortfolioHistoryChartProps {
  snapshots: PortfolioSnapshot[];
  theme: ThemeMode;
}

export function PortfolioHistoryChart({
  snapshots,
  theme,
}: PortfolioHistoryChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || snapshots.length < 2) return;

    const isDark = theme === 'dark';

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: isDark ? '#94A3B8' : '#64748B',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: isDark ? 'rgba(148,163,184,0.08)' : 'rgba(15,23,42,0.06)' },
        horzLines: { color: isDark ? 'rgba(148,163,184,0.08)' : 'rgba(15,23,42,0.06)' },
      },
      rightPriceScale: {
        borderVisible: false,
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        horzLine: {
          color: isDark ? 'rgba(59,130,246,0.45)' : 'rgba(37,99,235,0.35)',
        },
        vertLine: {
          color: isDark ? 'rgba(59,130,246,0.45)' : 'rgba(37,99,235,0.35)',
        },
      },
      height: 170,
      width: el.clientWidth,
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: '#3B82F6',
      topColor: isDark ? 'rgba(59, 130, 246, 0.28)' : 'rgba(37, 99, 235, 0.2)',
      bottomColor: 'rgba(59, 130, 246, 0.0)',
      lineWidth: 2,
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01,
      },
    });

    // Lightweight Charts requires strictly ascending timestamps in seconds
    const points: Array<{ time: UTCTimestamp; value: number }> = [];
    let lastSec = 0;
    for (const snap of snapshots) {
      let sec = Math.floor(snap.timestamp / 1000);
      if (sec <= lastSec) {
        sec = lastSec + 1;
      }
      lastSec = sec;
      points.push({
        time: sec as UTCTimestamp,
        value: Number(snap.totalValueUsd.toFixed(2)),
      });
    }

    series.setData(points);
    chart.timeScale().fitContent();
    chartRef.current = chart;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          chart.applyOptions({ width: entry.contentRect.width });
        }
      }
    });
    resizeObserver.observe(el);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [snapshots, theme]);

  if (snapshots.length === 0) {
    return (
      <div className="h-[170px] rounded-lg border border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center px-4 text-center">
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
          Historique réel IndexedDB vide. Ajoutez une adresse publique et cliquez sur Actualiser pour enregistrer votre premier point de valeur.
        </p>
      </div>
    );
  }

  if (snapshots.length === 1) {
    const only = snapshots[0];
    return (
      <div className="h-[170px] rounded-lg border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 flex flex-col items-center justify-center px-4 text-center">
        <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
          Point initial enregistré : {formatUsd(only.totalValueUsd)}
        </span>
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 max-w-md">
          Chaque actualisation enregistre un instantané réel en base locale (IndexedDB) pour tracer la courbe d&apos;évolution sans aucune donnée simulée.
        </p>
      </div>
    );
  }

  return <div ref={containerRef} className="w-full h-[170px]" />;
}
