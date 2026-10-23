import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAutoSync, useDaily, useLanguages, useSegments, useSummary } from '../api/hooks';
import { GameHeader } from '../components/GameHeader';
import { KpiTiles } from '../components/KpiTiles';
import { LanguagePicker } from '../components/LanguagePicker';
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
  const langList = useLanguages(appid, params.range, ready);
  const summary = useSummary(appid, params.range, params.langs, ready);
  const daily = useDaily(appid, params.range, params.langs, ready);
  const segs = useSegments(appid, params.range, params.langs, ready);

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
      >
        {ready && (
          <LanguagePicker
            available={langList.data?.languages}
            selected={params.langs}
            // A new language set changes the keywords, so a picked keyword no longer applies.
            onChange={(langs) => update({ langs, term: null })}
          />
        )}
      </TopBar>

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
        <KpiTiles
          summary={summary.data}
          points={daily.data.points}
          rangeLabel={RANGE_LABEL[params.range]}
          languageCount={langList.data?.languages.length ?? 0}
        />
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

      {ready && g && (
        <TalkingPoints appid={appid} params={params} update={update} ready={ready} firstDay={g.firstDay} today={g.today} />
      )}
    </div>
  );
}
