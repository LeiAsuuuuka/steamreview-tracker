import type { Game } from '../api/types';
import { dayLabel, int, relativeTime } from '../format';

function SyncState({ game }: { game: Game }) {
  const run = game.lastSync;
  if (game.syncing && run) {
    const reached = run.oldestReached
      ? new Date(run.oldestReached * 1000).toISOString().slice(0, 10)
      : null;
    return (
      <>
        <span className="pill busy">Syncing</span>
        <span>
          {int(run.fetched)} reviews fetched{reached ? `, back to ${dayLabel(reached, { weekday: false })}` : ''}
        </span>
      </>
    );
  }
  if (run?.status === 'error') {
    return (
      <>
        <span className="pill bad">Last sync failed</span>
        <span title={run.error ?? undefined}>{run.error ?? 'Unknown error'}. Press Sync now to retry.</span>
      </>
    );
  }
  if (!game.lastSyncedAt) {
    return (
      <>
        <span className="pill">Not synced yet</span>
        <span>Fetching starts automatically.</span>
      </>
    );
  }
  const since = game.coveredFrom ? new Date(game.coveredFrom * 1000).toISOString().slice(0, 10) : null;
  return (
    <>
      <span className={game.stale ? 'pill warn' : 'pill ok'}>{game.stale ? 'Out of date' : 'Up to date'}</span>
      <span>
        Synced {relativeTime(game.lastSyncedAt)} · {int(game.storedReviews)} reviews stored
        {since ? ` since ${dayLabel(since, { weekday: false })}` : ''}
      </span>
    </>
  );
}

export function GameHeader({ game }: { game: Game }) {
  return (
    <section className="card gamebar" aria-label="Game">
      {game.headerImage ? <img className="cover" src={game.headerImage} alt="" /> : <div className="cover placeholder" />}
      <div className="meta">
        <h1>{game.name}</h1>
        <div>
          <a href={`https://store.steampowered.com/app/${game.appid}/`} target="_blank" rel="noreferrer">
            App {game.appid}
          </a>
          {game.reviewScoreDesc && (
            <>
              {' · '}
              <span className="pill rating">
                {game.reviewScoreDesc} on Steam ({int(game.steamTotalReviews)} reviews)
              </span>
            </>
          )}
        </div>
      </div>
      <div className="sync" aria-live="polite">
        <SyncState game={game} />
      </div>
    </section>
  );
}
