import { Link } from 'react-router-dom';
import { useTrackedGames } from '../api/hooks';
import { GameSearch } from '../components/GameSearch';
import { int, relativeTime } from '../format';

export function HomePage() {
  const games = useTrackedGames();
  return (
    <div className="app home">
      <header className="hero">
        <span className="brand">Review Pulse</span>
        <h1>How are players feeling about your game this week?</h1>
        <p>
          Pick any Steam game. Review Pulse fetches its latest reviews, tracks the daily positive rate, shows which kind of
          player is writing, and pulls out what players are talking about in the languages you pick.
        </p>
        <GameSearch autoFocus />
      </header>

      <section aria-labelledby="tracked-h">
        <h2 id="tracked-h">Tracked games</h2>
        {games.isError && <p className="note error">{(games.error as Error).message}</p>}
        {games.data && games.data.length === 0 && (
          <div className="card empty">No games yet. Search above to add your first one. The first sync fetches 7 days of reviews.</div>
        )}
        <ul className="tracked">
          {games.data?.map((g) => (
            <li key={g.appid}>
              <Link to={`/game/${g.appid}`} className="card tracked-item">
                {g.headerImage ? <img src={g.headerImage} alt="" /> : <span className="cover placeholder" />}
                <span className="meta">
                  <b>{g.name}</b>
                  <span>
                    {int(g.storedReviews)} reviews stored · synced {relativeTime(g.lastSyncedAt)}
                  </span>
                  {g.reviewScoreDesc && <span className="pill rating">{g.reviewScoreDesc}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
