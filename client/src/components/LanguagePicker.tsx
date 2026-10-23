import { useEffect, useRef, useState } from 'react';
import type { LanguageCount } from '../api/types';
import { int, pct } from '../format';
import { LANGUAGES, langName, langSummary, langTag } from '../languages';

interface Props {
  available: LanguageCount[] | undefined;
  selected: string[];
  onChange: (langs: string[]) => void;
}

export function LanguagePicker({ available, selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const list = available ?? [];
  const total = list.reduce((s, l) => s + l.count, 0);
  // Selected languages stay listed even when they have no reviews in this range.
  const rows: LanguageCount[] = [
    ...list,
    ...selected.filter((c) => !list.some((l) => l.code === c)).map((code) => ({ code, count: 0, positive: 0 })),
  ];
  const selectedCount = selected.length
    ? list.filter((l) => selected.includes(l.code)).reduce((s, l) => s + l.count, 0)
    : total;

  const toggle = (code: string) =>
    onChange(selected.includes(code) ? selected.filter((c) => c !== code) : [...selected, code]);

  return (
    <div className="lang-picker" ref={root}>
      <button
        type="button"
        className={`btn lang-btn${selected.length ? ' active' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="lang-icon" aria-hidden="true">文A</span>
        <span className="lang-label">{langSummary(selected)}</span>
        {available && <span className="lang-count">{int(selectedCount)}</span>}
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="lang-pop" role="dialog" aria-label="Review languages">
          <div className="lang-pop-h">
            <b>Review languages</b>
            <small>Every number on the page uses the languages you pick.</small>
          </div>
          <label className="lang-row all">
            <input type="checkbox" checked={selected.length === 0} onChange={() => onChange([])} />
            <span className="lang-name">All languages</span>
            <span className="lang-n">{int(total)}</span>
          </label>
          <div className="lang-list">
            {rows.length === 0 && <p className="note">No reviews stored for this range yet.</p>}
            {rows.map((l) => {
              const known = LANGUAGES[l.code];
              const share = total ? l.count / total : 0;
              return (
                <div key={l.code} className="lang-row">
                  <label>
                    <input type="checkbox" checked={selected.includes(l.code)} onChange={() => toggle(l.code)} />
                    <span className="lang-name" lang={langTag(l.code)}>
                      {langName(l.code)}
                      {known && known.english !== known.native && <small>{known.english}</small>}
                    </span>
                  </label>
                  <span className="lang-bar" aria-hidden="true"><i style={{ width: `${share * 100}%` }} /></span>
                  <span className="lang-n" title={l.count ? `${pct(l.positive / l.count, 0)} positive` : undefined}>
                    {int(l.count)}
                  </span>
                  <button type="button" className="btn link lang-only" onClick={() => { onChange([l.code]); setOpen(false); }}>
                    Only
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
