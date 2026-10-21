import type { DailyPoint, Summary } from '../api/types';
import { dayLabel, int, pct } from '../format';

function Info({ tip }: { tip: string }) {
  return (
    <button type="button" className="info" aria-label={tip} data-tip={tip}>
      ?
    </button>
  );
}

function Sparkline({ points }: { points: DailyPoint[] }) {
  const rates = points.map((p) => (p.lowVolume || p.partial ? null : p.rate));
  const valid = rates.filter((r): r is number => r !== null);
  if (valid.length < 2) return null;
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const span = max - min || 0.01;
  const w = 120;
  const h = 26;
  const step = (w - 6) / Math.max(1, rates.length - 1);
  let d = '';
  rates.forEach((r, i) => {
    if (r === null) return;
    const x = 3 + i * step;
    const y = 3 + ((max - r) / span) * (h - 6);
    d += `${d ? ' L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function KpiTiles({ summary, points, rangeLabel }: { summary: Summary; points: DailyPoint[]; rangeLabel: string }) {
  const prev = summary.previous;
  const low = summary.lowestDay;
  return (
    <section className="kpis" aria-label="Key numbers">
      <div className="card kpi">
        <span className="l">Avg daily positive</span>
        <Info tip={`Each day's positive share, averaged across ${rangeLabel}. Today (still in progress) and days with fewer than ${summary.minDailyReviews} reviews are left out.`} />
        <span className="v">{pct(summary.avgDailyRate)}</span>
        <span className="s">
          {prev ? (
            <>
              <span className={prev.delta >= 0 ? 'up' : 'down'}>
                {prev.delta >= 0 ? '▲' : '▼'} {Math.abs(prev.delta * 100).toFixed(1)} pts
              </span>{' '}
              vs previous period
            </>
          ) : summary.avgDailyRate === null ? (
            `No day has ${summary.minDailyReviews}+ reviews yet`
          ) : (
            'Comparison appears once the previous period is stored'
          )}
        </span>
        <Sparkline points={points} />
      </div>
      <div className="card kpi">
        <span className="l">Reviews in range</span>
        <Info tip="All reviews posted in the range, in every language." />
        <span className="v">{int(summary.total)}</span>
        <span className="s">
          About {Math.round(summary.perDay)} a day · {int(summary.keywordLanguageReviews)} in Simplified Chinese
        </span>
      </div>
      <div className="card kpi">
        <span className="l">Overall positive</span>
        <Info tip="Positive reviews divided by all reviews in the range. Busy days count more here than in the daily average." />
        <span className="v">{pct(summary.pooledRate)}</span>
        <span className="s">
          {int(summary.positive)} positive · {int(summary.negative)} negative
        </span>
      </div>
      <div className="card kpi">
        <span className="l">Lowest day</span>
        <Info tip="The full day with the lowest positive share. Click it on the chart to read that day's reviews." />
        <span className="v" style={low ? { color: 'var(--neg)' } : undefined}>{low ? pct(low.rate) : '–'}</span>
        <span className="s">
          {low
            ? `${dayLabel(low.date)} · ${int(low.total)} reviews${
                low.volumeRatio && low.volumeRatio >= 1.3 ? `, ${low.volumeRatio.toFixed(1)}× the usual` : ''
              }`
            : 'Needs at least one day with enough reviews'}
        </span>
      </div>
    </section>
  );
}
