/** Steam review language codes → names in their own language, plus a short English label. */
export const LANGUAGES: Record<string, { native: string; english: string; tag: string }> = {
  schinese: { native: '简体中文', english: 'Simplified Chinese', tag: 'zh-Hans' },
  tchinese: { native: '繁體中文', english: 'Traditional Chinese', tag: 'zh-Hant' },
  english: { native: 'English', english: 'English', tag: 'en' },
  japanese: { native: '日本語', english: 'Japanese', tag: 'ja' },
  koreana: { native: '한국어', english: 'Korean', tag: 'ko' },
  russian: { native: 'Русский', english: 'Russian', tag: 'ru' },
  ukrainian: { native: 'Українська', english: 'Ukrainian', tag: 'uk' },
  spanish: { native: 'Español (España)', english: 'Spanish (Spain)', tag: 'es' },
  latam: { native: 'Español (Latinoamérica)', english: 'Spanish (Latin America)', tag: 'es-419' },
  brazilian: { native: 'Português (Brasil)', english: 'Portuguese (Brazil)', tag: 'pt-BR' },
  portuguese: { native: 'Português', english: 'Portuguese', tag: 'pt' },
  german: { native: 'Deutsch', english: 'German', tag: 'de' },
  french: { native: 'Français', english: 'French', tag: 'fr' },
  italian: { native: 'Italiano', english: 'Italian', tag: 'it' },
  polish: { native: 'Polski', english: 'Polish', tag: 'pl' },
  turkish: { native: 'Türkçe', english: 'Turkish', tag: 'tr' },
  thai: { native: 'ไทย', english: 'Thai', tag: 'th' },
  vietnamese: { native: 'Tiếng Việt', english: 'Vietnamese', tag: 'vi' },
  indonesian: { native: 'Bahasa Indonesia', english: 'Indonesian', tag: 'id' },
  czech: { native: 'Čeština', english: 'Czech', tag: 'cs' },
  hungarian: { native: 'Magyar', english: 'Hungarian', tag: 'hu' },
  dutch: { native: 'Nederlands', english: 'Dutch', tag: 'nl' },
  swedish: { native: 'Svenska', english: 'Swedish', tag: 'sv' },
  danish: { native: 'Dansk', english: 'Danish', tag: 'da' },
  finnish: { native: 'Suomi', english: 'Finnish', tag: 'fi' },
  norwegian: { native: 'Norsk', english: 'Norwegian', tag: 'nb' },
  romanian: { native: 'Română', english: 'Romanian', tag: 'ro' },
  bulgarian: { native: 'Български', english: 'Bulgarian', tag: 'bg' },
  greek: { native: 'Ελληνικά', english: 'Greek', tag: 'el' },
  arabic: { native: 'العربية', english: 'Arabic', tag: 'ar' },
};

export const langName = (code: string) => LANGUAGES[code]?.native ?? code;
export const langTag = (code: string) => LANGUAGES[code]?.tag;

/** "All languages", "简体中文", "简体中文 + English", "简体中文 + 2 more". */
export function langSummary(langs: string[]): string {
  if (!langs.length) return 'All languages';
  if (langs.length === 1) return langName(langs[0]);
  if (langs.length === 2) return `${langName(langs[0])} + ${langName(langs[1])}`;
  return `${langName(langs[0])} + ${langs.length - 1} more`;
}
