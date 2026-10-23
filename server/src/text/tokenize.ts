import { Jieba } from '@node-rs/jieba';
import { dict } from '@node-rs/jieba/dict.js';
import { ALLOWED_SINGLE, GAME_DICT, STOPWORDS } from './lexicon.js';
import { normalizeForTerms } from './normalize.js';

let jieba: Jieba | null = null;

function jiebaCut(text: string): string[] {
  if (!jieba) {
    jieba = Jieba.withDict(dict);
    // High frequency so these win over the default split (掉帧, not 掉 / 帧).
    jieba.loadDict(Buffer.from(GAME_DICT.map((w) => `${w} 100000 n`).join('\n')));
  }
  return jieba.cut(text, true);
}

/** Steam language code → BCP 47 locale for Intl.Segmenter. */
const LOCALE: Record<string, string> = {
  english: 'en', japanese: 'ja', koreana: 'ko', thai: 'th', russian: 'ru', ukrainian: 'uk', bulgarian: 'bg',
  spanish: 'es', latam: 'es', portuguese: 'pt', brazilian: 'pt', german: 'de', french: 'fr', italian: 'it',
  polish: 'pl', turkish: 'tr', czech: 'cs', hungarian: 'hu', dutch: 'nl', swedish: 'sv', danish: 'da',
  finnish: 'fi', norwegian: 'nb', romanian: 'ro', greek: 'el', arabic: 'ar', vietnamese: 'vi', indonesian: 'id',
};

const segmenters = new Map<string, Intl.Segmenter>();
function segmenterFor(locale: string): Intl.Segmenter {
  let s = segmenters.get(locale);
  if (!s) {
    s = new Intl.Segmenter(locale, { granularity: 'word' });
    segmenters.set(locale, s);
  }
  return s;
}

const isChinese = (lang: string) => lang === 'schinese' || lang === 'tchinese';
/** Languages written without spaces between words: phrases join directly. */
const UNSPACED = new Set(['schinese', 'tchinese', 'japanese', 'thai']);

const HAN = /\p{Script=Han}/u;
const CJK_ONLY = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}ー]+$/u;
const WORDLIKE = /^[\p{L}\p{N}][\p{L}\p{N}\p{M}+#.\-'’]*$/u;

function keep(token: string): boolean {
  if (!WORDLIKE.test(token)) return false;
  if (STOPWORDS.has(token)) return false;
  if (/^[\d.]+$/.test(token)) return false;
  const length = [...token].length;
  if (length === 1) return ALLOWED_SINGLE.has(token);
  // Short alphabetic tokens ("ok", "xd") are noise; two CJK / Hangul / Thai characters already make a word.
  if (length < 3 && !CJK_ONLY.test(token) && token !== 'ui' && token !== 'ai') return false;
  return true;
}

function tokens(text: string, language: string): string[] {
  if (isChinese(language)) return jiebaCut(text);
  const locale = LOCALE[language] ?? 'en';
  const out: string[] = [];
  for (const seg of segmenterFor(locale).segment(text)) {
    // Keep non-word segments that break phrases (punctuation), drop plain spaces.
    if (seg.isWordLike) out.push(seg.segment);
    else if (seg.segment.trim()) out.push(seg.segment.trim());
  }
  return out;
}

/**
 * Terms for one review: kept words plus two-word phrases from adjacent kept words.
 * Phrases join directly in Chinese, Japanese and Thai ("剧情 不错" → "剧情不错"),
 * and with a space elsewhere ("steam deck"). Mixed Chinese + Latin joins directly ("存档bug").
 */
export function extractTerms(text: string, language = 'schinese'): string[] {
  const terms = new Set<string>();
  let prev: string | null = null;
  const unspaced = UNSPACED.has(language);
  for (const raw of tokens(normalizeForTerms(text), language)) {
    const tok = raw.trim();
    if (tok === '') continue; // spaces between Latin words do not break a phrase
    if (!keep(tok)) {
      prev = null;
      continue;
    }
    terms.add(tok);
    if (prev) {
      const direct = unspaced && (HAN.test(prev) || HAN.test(tok) || CJK_ONLY.test(prev) || CJK_ONLY.test(tok));
      terms.add(direct ? `${prev}${tok}` : `${prev} ${tok}`);
    }
    prev = tok;
  }
  return [...terms];
}
