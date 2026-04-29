// Pretty-printers used by the result panel and toolbox.
//
// Locale-aware number grouping is applied via Intl.NumberFormat so the
// French-Swiss apostrophe / German period grouping is taken from the
// active i18n language. Pass the resolved language from `useTranslation`.

export function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}

const REGEX_SPECIAL = /[.*+?^${}()|[\]\\]/g;
export function escapeRegex(s: string): string {
  return s.replace(REGEX_SPECIAL, '\\$&');
}
