import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSearch } from '../api/hooks';

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function GameSearch({ autoFocus = false, placeholder }: { autoFocus?: boolean; placeholder?: string }) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const q = useDebounced(text, 300);
  const results = useSearch(q);
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const items = results.data ?? [];

  // "/" focuses search from anywhere on the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(t.tagName)) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => setActive(0), [q]);

  const go = (appid: number) => {
    setOpen(false);
    setText('');
    input.current?.blur();
    navigate(`/game/${appid}`);
  };

  const showList = open && q.trim().length >= 2;

  return (
    <div className="search-wrap">
      <label className="search" htmlFor="game-search">
        <span aria-hidden="true" className="search-icon">⌕</span>
        <input
          id="game-search"
          ref={input}
          type="text"
          autoComplete="off"
          autoFocus={autoFocus}
          value={text}
          placeholder={placeholder ?? 'Search a Steam game by name or App ID'}
          role="combobox"
          aria-expanded={showList}
          aria-controls="game-search-list"
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, items.length - 1));
            else if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0));
            else if (e.key === 'Enter' && items[active]) go(items[active].appid);
            else if (e.key === 'Escape') setOpen(false);
            else return;
            e.preventDefault();
          }}
        />
        <kbd aria-hidden="true">/</kbd>
      </label>
      {showList && (
        <ul className="search-list" id="game-search-list" role="listbox">
          {results.isFetching && !items.length && <li className="search-msg">Searching Steam…</li>}
          {results.isError && <li className="search-msg error">{(results.error as Error).message}</li>}
          {!results.isFetching && !results.isError && !items.length && (
            <li className="search-msg">No games found for “{q}”. Try the App ID from the store URL.</li>
          )}
          {items.map((r, i) => (
            <li
              key={r.appid}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : undefined}
              onMouseDown={(e) => {
                e.preventDefault();
                go(r.appid);
              }}
              onMouseEnter={() => setActive(i)}
            >
              {r.image ? <img src={r.image} alt="" /> : <span className="thumb" />}
              <span className="name">{r.name}</span>
              <span className="appid">{r.appid}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
