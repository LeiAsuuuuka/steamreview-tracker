import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAutoSync, useDaily, useSegments, useSummary } from '../api/hooks';
import { GameHeader } from '../components/GameHeader';
import { KpiTiles } from '../components/KpiTiles';
import { SegmentPanel } from '../components/SegmentPanel';
import { TalkingPoints } from '../components/TalkingPoints';
import { TopBar } from '../components/TopBar';
import { TrendChart } from '../components/TrendChart';
import { useDashboardParams } from '../state/useDashboardParams';

const RANGE_LABEL = { '7d': 'the last 7 days', '30d': 'the last 30 days', all: 'all stored days' } as const;

export function DashboardPage() {
  const appid = Number(useParams().appid);
  const [params, update] = useDashboardParams();
  const { game, sync } = useAutoSync(appid);
  const g = game.data;

  // Charts wait for the first sync so they don't flash an empty state.
  const ready = !!g && g.lastSyncedAt !== null;
  const summary = useSummary(appid, params.range, ready);
  const daily = useDaily(appid, params.range, ready);
  const segs = useSegments(appid, params.range, ready);

  useEffect(() => {
    if (g) document.title = `${g.name} · Review Pulse`;
  }, [g]);

  if (!Number.isInteger(appid) || appid <= 0) {
    return (
      <div className="app">
        <TopBar />
        <div className="card empty big">That isn’t a valid Steam App ID.</div>
      </div>
    );
  }

  return (
    <div className="app">
      <TopBar
        game={g}
        range={params.range}
        onRange={(range) => update({ range })}
        onSync={() => sync.mutate()}
        syncPending={sync.isPending}
      />

      {game.isError && <div className="card empty big error">{(game.error as Error).message}</div>}
      {sync.isError && <div className="banner error">Sync could not start: {(sync.error as Error).message}</div>}
      {g && <GameHeader game={g} />}

      {g && !ready && (
        <div className="card empty big">
          <b>Fetching the first week of reviews from Steam…</b>
          <br />
          This usually takes a few seconds, or a couple of minutes for very popular games.
        </div>
      )}

      {ready && summary.data && daily.data && (
        <KpiTiles summary={summary.data} points={daily.data.points} rangeLabel={RANGE_LABEL[params.range]} />
      )}

      {ready && (
        <div className="row2">
          {daily.data && summary.data ? (
            <TrendChart
              points={daily.data.points}
              avg={summary.data.avgDailyRate}
              insight={summary.data.insights.trend}
              selectedDay={params.day}
              lowestDay={summary.data.lowestDay?.date ?? null}
              onSelectDay={(day) => update({ day })}
            />
          ) : (
            <div className="card panel skeleton" />
          )}
          {segs.data && summary.data ? (
            <SegmentPanel
              rows={segs.data.segments}
              insight={summary.data.insights.segments}
              selected={params.segment}
              onSelect={(segment) => update({ segment })}
            />
          ) : (
            <div className="card panel skeleton" />
          )}
        </div>
      )}

      {ready && <TalkingPoints appid={appid} params={params} update={update} ready={ready} />}
    </div>
  );
}
