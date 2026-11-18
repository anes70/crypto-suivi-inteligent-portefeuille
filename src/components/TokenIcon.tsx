import { useState } from 'react';
import type { ActiveChainId } from '../types/chain';
import { getChainLabel } from '../utils/validators';

interface TokenIconProps {
  logoUrl?: string;
  symbol: string;
  chain: ActiveChainId;
  size?: 'sm' | 'md';
}

export function TokenIcon({ logoUrl, symbol, chain, size = 'md' }: TokenIconProps) {
  const [imgError, setImgError] = useState(false);
  const dim = size === 'sm' ? 'w-7 h-7 text-[11px]' : 'w-9 h-9 text-xs';
  const badgeDim = size === 'sm' ? 'w-3.5 h-3.5 text-[8px]' : 'w-4 h-4 text-[9px]';
  const initials = (symbol || '?').replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || '?';

  const badgeStyle =
    chain === 'base'
      ? 'bg-[#0052FF] text-white'
      : chain === 'robinhood'
        ? 'bg-[#00C805] text-slate-950'
        : 'bg-[#14F195] text-slate-950';

  const badgeLetter = chain === 'base' ? 'B' : chain === 'robinhood' ? 'R' : 'S';

  return (
    <div className={`relative shrink-0 ${dim}`}>
      {logoUrl && !imgError ? (
        <img
          src={logoUrl}
          alt={`${symbol} logo`}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="w-full h-full rounded-full object-cover bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/70"
        />
      ) : (
        <div className="w-full h-full rounded-full flex items-center justify-center font-mono font-semibold bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
          {initials}
        </div>
      )}
      <span
        title={getChainLabel(chain)}
        className={`absolute -bottom-0.5 -right-0.5 ${badgeDim} rounded-full flex items-center justify-center font-mono font-bold border border-white dark:border-[#12161F] ${badgeStyle}`}
      >
        {badgeLetter}
      </span>
    </div>
  );
}
