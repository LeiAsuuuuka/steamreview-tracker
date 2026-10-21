import type { SegmentId, SegmentRow } from '../api/types';
import { SEGMENT_COLOR, int, pct } from '../format';

interface Props {
  rows: SegmentRow[];
  insight: string | null;
  selected: SegmentId | null;
  onSelect: (id: SegmentId | null) => void;
}

export function SegmentPanel({ rows, insight, selected, onSelect }: Props) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  const rates = rows.filter((r) => r.count >= 10 && r.rate !== null).map((r) => r.rate as number);
  const best = rates.length > 1 ? Math.max(...rates) : null;
  const worst = rates.length > 1 ? Math.min(...rates) : null;

  return (
    <section className="card panel" aria-labelledby="seg-h">
      <div className="panel-h">
        <h2 id="seg-h">Who is reviewing</h2>
        <small>Playtime when the review was written</small>
      </div>
      {insight && <p className="insight">{insight}</p>}
      {total === 0 ? (
        <div className="empty">No reviews in this range yet.</div>
      ) : (
        <>
          <div className="stack" aria-hidden="true">
            {rows.filter((r) => r.count > 0).map((r) => (
              <div key={r.id} style={{ width: `${r.share * 100}%`, background: SEGMENT_COLOR[r.id] }} />
            ))}
          </div>
          <div className="segrows">
            <div className="seghead">
              <span />
              <span>Player type</span>
              <span>Reviews</span>
              <span>Positive</span>
            </div>
            {rows.map((r) => (
              <button
                key={r.id}
                type="button"
                className="segrow"
                aria-pressed={selected === r.id}
                onClick={() => onSelect(selected === r.id ? null : r.id)}
                disabled={r.count === 0}
              >
                <i style={{ background: SEGMENT_COLOR[r.id] }} />
                <span>
                  {r.name}
                  <small>{r.label}</small>
                </span>
                <span className="n">
                  {int(r.count)} · {pct(r.share, 0)}
                </span>
                <span
                  className="r"
                  style={{
                    color:
                      r.rate !== null && r.rate === worst && worst !== best
                        ? 'var(--neg)'
                        : r.rate !== null && r.rate === best && worst !== best
                          ? 'var(--pos)'
                          : undefined,
                  }}
                >
                  {pct(r.rate)}
                </span>
              </button>
            ))}
          </div>
          <p className="note">Click a player type to filter the talking points below.</p>
        </>
      )}
    </section>
  );
}
