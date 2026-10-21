import {
  Bar, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
  type TooltipProps,
} from 'recharts';
import type { DailyPoint } from '../api/types';
import { dayLabel, int, pct } from '../format';

interface Row extends DailyPoint {
  ratePct: number | null;
  label: string;
}

interface Props {
  points: DailyPoint[];
  avg: number | null;
  insight: string | null;
  selectedDay: string | null;
  lowestDay: string | null;
  onSelectDay: (day: string | null) => void;
}

function ChartTip({ active, payload, selected }: TooltipProps<number, string> & { selected: string | null }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as Row;
  return (
    <div className="tip">
      <b>{dayLabel(p.date)}</b>
      {p.total ? (
        <>
          {pct(p.rate)} positive
          <br />
          {int(p.positive)} up · {int(p.negative)} down · {int(p.total)} reviews
          {p.partial ? (
            <><br />Today so far, not counted in the average</>
          ) : (
            p.lowVolume && <><br />Too few reviews to count in the average</>
          )}
        </>
      ) : (
        'No reviews'
      )}
      {p.total > 0 && selected !== p.date && <span className="tip-hint">Click to read this day’s reviews</span>}
    </div>
  );
}

export function TrendChart({ points, avg, insight, selectedDay, lowestDay, onSelectDay }: Props) {
  const short = points.length <= 10;
  const rows: Row[] = points.map((p) => {
    const d = new Date(`${p.date}T00:00:00Z`);
    return {
      ...p,
      ratePct: p.rate === null ? null : Math.round(p.rate * 1000) / 10,
      // Short axis labels: 'Fri 16' for a week, '16 Oct' for longer ranges. The tooltip shows the full date.
      label: short
        ? d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', timeZone: 'UTC' })
        : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
    };
  });
  const rates = rows.map((r) => r.ratePct).filter((v): v is number => v !== null);
  const yMin = rates.length ? Math.max(0, Math.floor((Math.min(...rates) - 5) / 10) * 10) : 0;
  const yTicks: number[] = [];
  for (let v = yMin; v <= 100; v += yMin < 50 ? 20 : 10) yTicks.push(v);
  if (yTicks[yTicks.length - 1] !== 100) yTicks.push(100);
  const maxVol = Math.max(1, ...rows.map((r) => r.total));
  const dense = rows.length > 14;

  return (
    <section className="card panel" aria-labelledby="trend-h">
      <div className="panel-h">
        <h2 id="trend-h">Daily positive rate</h2>
        <small>Click a day to read its reviews</small>
      </div>
      {insight && <p className="insight">{insight}</p>}
      {rows.every((r) => r.total === 0) ? (
        <div className="empty">No reviews in this range yet.</div>
      ) : (
        <div className="chart">
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart
              data={rows}
              margin={{ top: 12, right: 8, bottom: 0, left: -12 }}
              onClick={(s) => {
                const i = s?.activeTooltipIndex;
                if (typeof i !== 'number' || !rows[i] || rows[i].total === 0) return;
                onSelectDay(rows[i].date === selectedDay ? null : rows[i].date);
              }}
              style={{ cursor: 'pointer' }}
            >
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis
                dataKey="label"
                tick={{ fill: 'var(--muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--line)' }}
                interval="preserveStartEnd"
                minTickGap={6}
              />
              <YAxis
                yAxisId="rate"
                domain={[yMin, 100]}
                ticks={yTicks}
                tickFormatter={(v) => `${v}%`}
                tick={{ fill: 'var(--muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                tickLine={false}
                axisLine={false}
                width={52}
              />
              {/* Volume axis is 4× the busiest day so bars stay in the bottom quarter. */}
              <YAxis yAxisId="vol" orientation="right" domain={[0, maxVol * 4]} hide />
              <Tooltip
                content={<ChartTip selected={selectedDay} />}
                cursor={{ fill: 'var(--accent)', fillOpacity: 0.07 }}
                isAnimationActive={false}
              />
              <Bar yAxisId="vol" dataKey="total" radius={[2, 2, 0, 0]} maxBarSize={36} isAnimationActive={false}>
                {rows.map((r) => (
                  <Cell
                    key={r.date}
                    fill={r.date === selectedDay ? 'var(--accent)' : r.date === lowestDay ? 'var(--neg)' : 'var(--line)'}
                    fillOpacity={r.date === selectedDay || r.date === lowestDay ? 0.7 : 1}
                  />
                ))}
              </Bar>
              {avg !== null && (
                <ReferenceLine
                  yAxisId="rate"
                  y={Math.round(avg * 1000) / 10}
                  stroke="var(--muted)"
                  strokeDasharray="4 4"
                  label={{
                    value: `avg ${pct(avg)}`, position: 'insideTopRight', fill: 'var(--muted)', fontSize: 11,
                  }}
                />
              )}
              <Line
                yAxisId="rate"
                type="linear"
                dataKey="ratePct"
                stroke="var(--accent)"
                strokeWidth={2.2}
                connectNulls
                isAnimationActive={false}
                dot={(props: { cx?: number; cy?: number; payload?: Row; index?: number }) => {
                  const { cx, cy, payload: p, index } = props;
                  if (cx === undefined || cy === undefined || !p || p.ratePct === null) return <g key={index} />;
                  const isSel = p.date === selectedDay;
                  const isLow = p.date === lowestDay;
                  const color = isLow ? 'var(--neg)' : 'var(--accent)';
                  const hollow = p.lowVolume || p.partial;
                  return (
                    <circle
                      key={index}
                      cx={cx}
                      cy={cy}
                      r={isSel ? 6 : dense ? 2.5 : 4}
                      fill={hollow ? 'var(--surface)' : color}
                      stroke={hollow ? color : 'var(--surface)'}
                      strokeWidth={2}
                    />
                  );
                }}
                activeDot={{ r: 6, stroke: 'var(--surface)', strokeWidth: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="legend">
        <span><i style={{ background: 'var(--accent)' }} />Positive % per day</span>
        <span><i className="dash" />Average of daily rates</span>
        <span><i style={{ background: 'var(--line)', height: 8 }} />Reviews per day</span>
        <span><i className="hollow" />Not in the average (today, or too few reviews)</span>
      </div>
    </section>
  );
}
