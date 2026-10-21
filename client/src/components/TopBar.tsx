import { Link } from 'react-router-dom';
import type { Game, RangeId } from '../api/types';
import { GameSearch } from './GameSearch';

const RANGES: { id: RangeId; label: string; days: number }[] = [
  { id: '7d', label: 'Last 7 days', days: 7 },
  { id: '30d', label: '30 days', days: 30 },
  { id: 'all', label: 'All stored', days: 0 },
];

interface Props {
  game?: Game;
  range?: RangeId;
  onRange?: (r: RangeId) => void;
  onSync?: () => void;
  syncPending?: boolean;
}

export function TopBar({ game, range, onRange, onSync, syncPending }: Props) {
  return (
    <header className="topbar">
      <Link to="/" className="brand">Review Pulse</Link>
      <GameSearch />
      {game && range && onRange && (
        <div className="seg-ctl" role="group" aria-label="Date range">
          {RANGES.map((r) => {
            const locked = r.days > 0 && game.storedDays < r.days;
            return (
              <button
                key={r.id}
                type="button"
                aria-pressed={range === r.id}
                disabled={locked}
                title={locked ? `Available once ${r.days} days of reviews are stored (${game.storedDays} so far)` : undefined}
                onClick={() => onRange(r.id)}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      )}
      {game && onSync && (
        <button type="button" className="btn primary" onClick={onSync} disabled={game.syncing || syncPending}>
          {game.syncing ? 'Syncing…' : 'Sync now'}
        </button>
      )}
    </header>
  );
}
