import { Jieba } from '@node-rs/jieba';
import { dict } from '@node-rs/jieba/dict.js';
import { ALLOWED_SINGLE, GAME_DICT, STOPWORDS } from './lexicon.js';
import { normalizeForTerms } from './normalize.js';

let jieba: Jieba | null = null;

function segmenter(): Jieba {
  if (!jieba) {
    jieba = Jieba.withDict(dict);
    // High frequency so these win over the default split (掉帧, not 掉 / 帧).
    jieba.loadDict(Buffer.from(GAME_DICT.map((w) => `${w} 100000 n`).join('\n')));
  }
  return jieba;
}

const HAN = /\p{Script=Han}/u;
const WORDLIKE = /^[\p{Script=Han}a-z0-9][\p{Script=Han}a-z0-9+#.\-']*$/u;

function keep(token: string): boolean {
  if (!WORDLIKE.test(token)) return false;
  if (STOPWORDS.has(token)) return false;
  if (/^[\d.]+$/.test(token)) return false;
  const chars = [...token];
  if (chars.length === 1) return ALLOWED_SINGLE.has(token);
  if (!HAN.test(token) && token.length < 3 && token !== 'ui' && token !== 'ai') return false;
  return true;
}

/**
 * Terms for one review: kept words plus two-word phrases from adjacent kept words.
 * Latin words are joined by a space ("steam deck"), Chinese words directly ("剧情 不错" → "剧情不错").
 */
export function extractTerms(text: string): string[] {
  const tokens = segmenter().cut(normalizeForTerms(text), true);
  const terms = new Set<string>();
  let prev: string | null = null;
  for (const raw of tokens) {
    const tok = raw.trim();
    if (tok === '') continue; // spaces between Latin words do not break a phrase
    if (!keep(tok)) {
      prev = null;
      continue;
    }
    terms.add(tok);
    if (prev) {
      const latinPair = !HAN.test(prev) && !HAN.test(tok);
      terms.add(latinPair ? `${prev} ${tok}` : `${prev}${tok}`);
    }
    prev = tok;
  }
  return [...terms];
}
