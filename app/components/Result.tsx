import type {ChangeEvent} from 'react';
import {useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {escapeRegex, formatNumber, formatSize} from '~/lib/format';

interface Props {
  paragraphs: string[];
  text: string;
  fileName: string;
  fileSize: number;
  words: number;
  chars: number;
  visible: boolean;
  onClear: () => void;
  onCopyFailed: () => void;
}

const COPIED_RESET_MS = 1600;
const SEARCH_DEBOUNCE_MS = 80;

export function Result({
  paragraphs,
  text,
  fileName,
  fileSize,
  words,
  chars,
  visible,
  onClear,
  onCopyFailed,
}: Props) {
  const {t, i18n} = useTranslation();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [copied, setCopied] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copiedRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQuery('');
    setDebounced('');
  }, [text]);

  useEffect(() => () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (copiedRef.current) {
      clearTimeout(copiedRef.current);
    }
  }, []);

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => setDebounced(value), SEARCH_DEBOUNCE_MS);
  };

  const handleCopy = async () => {
    if (!text) {
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (copiedRef.current) {
        clearTimeout(copiedRef.current);
      }
      copiedRef.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
    } catch {
      onCopyFailed();
    }
  };

  const handleDownload = () => {
    if (!text) {
      return;
    }
    const base = (fileName || t('download.fallback_basename')).replace(/\.[^.]+$/, '');
    const blob = new Blob([text], {type: 'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${base}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const lang = i18n.resolvedLanguage ?? 'de-CH';

  const {renderedParagraphs, matchCount} = useMemo(() => {
    const q = debounced.trim();
    if (!q) {
      return {
        renderedParagraphs: paragraphs.map((p) => [{text: p, mark: false}]),
        matchCount: 0,
      };
    }
    const re = new RegExp(escapeRegex(q), 'gi');
    let total = 0;
    const out = paragraphs.map((para) => {
      const segments: Array<{text: string; mark: boolean}> = [];
      let lastIndex = 0;
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(para)) !== null) {
        if (m.index > lastIndex) {
          segments.push({text: para.slice(lastIndex, m.index), mark: false});
        }
        segments.push({text: m[0], mark: true});
        lastIndex = m.index + m[0].length;
        total += 1;
        if (m[0].length === 0) {
          re.lastIndex += 1;
        }
      }
      if (lastIndex < para.length) {
        segments.push({text: para.slice(lastIndex), mark: false});
      }
      if (segments.length === 0) {
        segments.push({text: para, mark: false});
      }
      return segments;
    });
    return {renderedParagraphs: out, matchCount: total};
  }, [paragraphs, debounced]);

  const className = `result${visible ? ' is-visible' : ''}`;

  return (
    <article className={className} aria-live="polite">
      <header className="result-head">
        <div className="file-meta">
          <div className="file-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
              <path d="M14 3v5h5" />
            </svg>
          </div>
          <div className="file-meta-text">
            <div className="file-name">{fileName || t('result.empty_dash')}</div>
            <div className="file-stats">
              <span>{fileSize > 0 ? formatSize(fileSize) : t('result.size_initial')}</span>
              <span>{formatNumber(words, lang)} {t('result.words_suffix')}</span>
              <span>{formatNumber(chars, lang)} {t('result.chars_suffix')}</span>
            </div>
          </div>
        </div>
        <div className="actions">
          <button className={`btn${copied ? ' is-copied' : ''}`} type="button" onClick={handleCopy}>
            <svg className="copy-i" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            <svg className="check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            <span>{copied ? t('actions.copied') : t('actions.copy')}</span>
          </button>
          <button className="btn" type="button" onClick={handleDownload}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 4v12" />
              <path d="m7 11 5 5 5-5" />
              <path d="M5 20h14" />
            </svg>
            <span>{t('actions.download')}</span>
          </button>
          <button
            className="icon-btn"
            type="button"
            onClick={onClear}
            title={t('actions.reset')}
            aria-label={t('actions.reset')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      </header>

      <div className="search">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          placeholder={t('search.placeholder')}
          value={query}
          onChange={handleSearchChange}
        />
        <span className="count">
          {debounced.trim()
            ? matchCount > 0
              ? t('search.matches_other', {count: matchCount})
              : t('search.no_matches')
            : ''}
        </span>
      </div>

      <div className="output">
        {renderedParagraphs.map((segments, paraIdx) => (
          <p key={paraIdx}>
            {segments.map((seg, segIdx) =>
              seg.mark
                ? <mark key={segIdx}>{seg.text}</mark>
                : <span key={segIdx}>{seg.text}</span>,
            )}
          </p>
        ))}
      </div>
    </article>
  );
}
