import { useMemo, useState } from 'react';
import { usePeriods, useKeywords, useReviews } from '../api/hooks';
import type { KeywordTerm, ReviewItem, SegmentId, Sentiment } from '../api/types';
import { SEGMENT_COLOR, SEGMENT_SHORT, dayLabel, int } from '../format';
import type { DashboardParams } from '../state/useDashboardParams';

interface Props {
  appid: number;
  params: DashboardParams;
  update: (p: Partial<DashboardParams>) => void;
  ready: boolean;
}

const PAGE = 12;

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function Highlight({ text, terms }: { text: string; terms: string[] }) {
  const parts = useMemo(() => {
    const list = terms.filter(Boolean).sort((a, b) => b.length - a.length);
    if (!list.length) return [text];
    return text.split(new RegExp(`(${list.map(escapeRe).join('|')})`, 'gi'));
  }, [text, terms]);
  const lower = terms.map((t) => t.toLowerCase());
  return (
    <>
      {parts.map((p, i) => (lower.includes(p.toLowerCase()) ? <mark key={i}>{p}</mark> : <span key={i}>{p}</span>))}
    </>
  );
}

function ReviewCard({ r, terms }: { r: ReviewItem; terms: string[] }) {
  const [full, setFull] = useState(false);
  const body = full || !r.excerpt ? r.text : r.excerpt;
  return (
    <li className="rv">
      <div className="rv-top">
        <span className={`sent ${r.votedUp ? 'p' : 'n'}`}>{r.votedUp ? 'Recommended' : 'Not recommended'}</span>
        <span className="pt">
          <i style={{ background: SEGMENT_COLOR[r.segment] }} />
          {r.playtimeAtReviewHours} h · {SEGMENT_SHORT[r.segment]}
        </span>
        <span className="when">{dayLabel(r.date, { weekday: false })}</span>
      </div>
      <p lang="zh-Hans">
        <Highlight text={body} terms={terms} />
      </p>
      <div className="rv-foot">
        <span>{int(r.votesUp)} found this helpful</span>
        <span className="rv-actions">
          {r.excerpt && (
            <button type="button" className="btn link" onClick={() => setFull((f) => !f)}>
              {full ? 'Show less' : 'Read full review'}
            </button>
          )}
          <a href={r.url} target="_blank" rel="noreferrer">Open on Steam</a>
        </span>
      </div>
    </li>
  );
}

function KeywordList({
  title, tone, terms, selected, dim, onPick, emptyText,
}: {
  title: string;
  tone: 'pos' | 'neg';
  terms: KeywordTerm[];
  selected: string | null;
  dim: boolean;
  onPick: (t: string | null) => void;
  emptyText: string;
}) {
  const max = terms[0]?.count ?? 1;
  return (
    <div>
      <h3 className={tone}>
        {title}
        <small>reviews mentioning</small>
      </h3>
      {terms.length === 0 ? (
        <p className="note">{emptyText}</p>
      ) : (
        <div className="kwlist">
          {terms.map((k) => (
            <button
              key={k.term}
              type="button"
              className={`kw${dim ? ' dim' : ''}`}
              aria-pressed={selected === k.term}
              onClick={() => onPick(selected === k.term ? null : k.term)}
              title={`${k.count} reviews (${Math.round(k.share * 100)}%) mention “${k.term}”`}
            >
              <span className="bar" style={{ width: `${Math.max(10, (k.count / max) * 100)}%`, background: `var(--${tone})` }} />
              <span className="t" lang="zh-Hans">{k.term}</span>
              <span className="c">{k.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TalkingPoints({ appid, params, update, ready }: Props) {
  const [pageSize, setPageSize] = useState(PAGE);
  const periods = usePeriods(appid, ready);
  const scope = { period: params.period, day: params.day, segment: params.segment };
  const kw = useKeywords(appid, scope, ready);
  const reviews = useReviews(appid, { ...scope, sentiment: params.sentiment, term: params.term }, pageSize, ready);

  const list = periods.data ?? [];
  const idx = Math.max(0, list.findIndex((p) => p.id === params.period));
  const current = list[idx];

  const set = (patch: Partial<DashboardParams>) => {
    setPageSize(PAGE);
    update(patch);
  };

  const chips: { key: keyof DashboardParams; label: string }[] = [];
  if (params.day) chips.push({ key: 'day', label: `Only ${dayLabel(params.day)}` });
  if (params.segment) chips.push({ key: 'segment', label: `${SEGMENT_SHORT[params.segment]} players` });
  if (params.sentiment) chips.push({ key: 'sentiment', label: params.sentiment === 'p' ? 'Positive only' : 'Negative only' });
  if (params.term) chips.push({ key: 'term', label: `Mentions “${params.term}”` });

  const k = kw.data;
  const highlightTerms = params.term
    ? [params.term]
    : [...(k?.positive ?? []).slice(0, 6), ...(k?.negative ?? []).slice(0, 6)].map((t) => t.term);
  const rv = reviews.data;

  const periodText = params.day
    ? dayLabel(params.day)
    : current
      ? current.id === 'last7'
        ? `Last 7 days · ${dayLabel(current.from, { weekday: false })} – ${dayLabel(current.to, { weekday: false })}`
        : `${current.id} · ${dayLabel(current.from, { weekday: false })} – ${dayLabel(current.to, { weekday: false })}`
      : 'Last 7 days';

  return (
    <section className="card tp" aria-labelledby="tp-h">
      <div className="tp-h">
        <h2 id="tp-h">Talking points</h2>
        <div className="weekstep">
          <button
            type="button"
            aria-label="Earlier period"
            disabled={!!params.day || idx >= list.length - 1}
            onClick={() => set({ period: list[idx + 1].id })}
          >
            ‹
          </button>
          <span>
            {periodText}
            {k && ` · ${int(k.reviews.total)} Chinese reviews`}
          </span>
          <button
            type="button"
            aria-label="Later period"
            disabled={!!params.day || idx <= 0}
            onClick={() => set({ period: list[idx - 1].id })}
          >
            ›
          </button>
        </div>
      </div>

      <div className="filters">
        <div className="grp">
          <span className="flabel">Sentiment</span>
          <div className="seg-ctl" role="group" aria-label="Sentiment">
            {([[null, 'All'], ['p', 'Positive'], ['n', 'Negative']] as [Sentiment | null, string][]).map(([v, label]) => (
              <button key={label} type="button" aria-pressed={params.sentiment === v} onClick={() => set({ sentiment: v })}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="grp">
          <span className="flabel">Player type</span>
          <div className="seg-ctl" role="group" aria-label="Player type">
            {([[null, 'All'], ['new', 'New'], ['normal', 'Normal'], ['hard', 'HardCore']] as [SegmentId | null, string][]).map(
              ([v, label]) => (
                <button key={label} type="button" aria-pressed={params.segment === v} onClick={() => set({ segment: v })}>
                  {label}
                </button>
              ),
            )}
          </div>
        </div>
      </div>

      <div className="active-filters">
        {chips.length === 0 ? (
          <span>Showing all Simplified Chinese reviews for this period. Pick a keyword, a day on the chart or a player type to narrow it down.</span>
        ) : (
          <>
            <span>Filtered by</span>
            {chips.map((c) => (
              <button key={c.key} type="button" className="fchip" onClick={() => set({ [c.key]: null })} aria-label={`Remove filter: ${c.label}`}>
                {c.label}
                <span aria-hidden="true">×</span>
              </button>
            ))}
            <button type="button" className="btn link" onClick={() => set({ day: null, segment: null, sentiment: null, term: null })}>
              Clear all
            </button>
          </>
        )}
      </div>

      <div className="tp-body">
        <div className="kwgroups">
          {kw.isError ? (
            <p className="note error">{(kw.error as Error).message}</p>
          ) : !k ? (
            <p className="note">Loading keywords…</p>
          ) : k.insufficient ? (
            <div className="empty">
              Only {k.reviews.total} Simplified Chinese reviews here. Keywords need at least {k.minReviews}. Try a longer
              period or remove filters.
            </div>
          ) : (
            <>
              <KeywordList
                title="Positive reviews"
                tone="pos"
                terms={k.positive}
                selected={params.term}
                dim={params.sentiment === 'n'}
                onPick={(t) => set({ term: t })}
                emptyText={`Not enough positive reviews (${k.reviews.positive}).`}
              />
              <KeywordList
                title="Negative reviews"
                tone="neg"
                terms={k.negative}
                selected={params.term}
                dim={params.sentiment === 'p'}
                onPick={(t) => set({ term: t })}
                emptyText={`Not enough negative reviews (${k.reviews.negative}) to find repeated topics.`}
              />
              {k.baseline === 'selection' && (
                <p className="note">
                  Ranked within this period only. Once earlier weeks are stored, words that come up every week sink and new
                  topics rise.
                </p>
              )}
            </>
          )}
        </div>

        <div className="rv-col">
          <div className="rv-h">
            <h3>{params.term ? `Reviews mentioning “${params.term}”` : 'Most helpful reviews'}</h3>
            {rv && rv.total > 0 && (
              <small>
                Showing {Math.min(rv.items.length, rv.total)} of {int(rv.total)}
              </small>
            )}
          </div>
          {reviews.isError ? (
            <p className="note error">{(reviews.error as Error).message}</p>
          ) : !rv ? (
            <p className="note">Loading reviews…</p>
          ) : rv.total === 0 ? (
            <div className="empty">
              No reviews match these filters.
              {chips.length > 0 && (
                <>
                  <br />
                  <button type="button" className="btn link" onClick={() => set({ day: null, segment: null, sentiment: null, term: null })}>
                    Clear filters
                  </button>
                </>
              )}
            </div>
          ) : (
            <>
              <ul className="reviews" style={{ opacity: reviews.isPlaceholderData ? 0.6 : 1 }}>
                {rv.items.map((r) => (
                  <ReviewCard key={r.id} r={r} terms={highlightTerms} />
                ))}
              </ul>
              {rv.total > rv.items.length && (
                <div className="more">
                  <button type="button" className="btn" onClick={() => setPageSize((n) => Math.min(50, n + 12))} disabled={pageSize >= 50}>
                    {pageSize >= 50 ? 'Narrow the filters to see others' : `Show more (${int(rv.total - rv.items.length)} left)`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
