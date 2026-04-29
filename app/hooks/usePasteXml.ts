import {useEffect} from 'react';

// Loose: any '<' followed by a character that isn't '>'. Matches both
// `<?xml ...?>` declarations and any tag opener.
const LOOKS_LIKE_XML = /<[^>]/;
const PASTE_MIME = 'application/xml';
// How long a successful paste-event response shadows the keydown-fallback,
// so the two paths don't both produce a toast for the same Ctrl+V.
const PASTE_HANDLED_WINDOW_MS = 500;

export function usePasteXml(
  onPasted: (file: File) => void,
  pastedFileName: string,
  onShortcutClipboardNotUsable?: () => void,
) {
  useEffect(() => {
    const log = (...args: unknown[]) => {
      if (import.meta.env.DEV) {
        console.debug('[usePasteXml]', ...args);
      }
    };

    let lastPasteHandledAt = 0;

    const ingestText = (text: string, source: string): 'ok' | 'empty' | 'not-xml' => {
      if (!text) {
        log(source, 'empty text');
        return 'empty';
      }
      if (!LOOKS_LIKE_XML.test(text)) {
        log(source, 'does not look like XML', {preview: text.slice(0, 80)});
        return 'not-xml';
      }
      log(source, 'ingesting text', {chars: text.length});
      const blob = new Blob([text], {type: PASTE_MIME});
      const file = new File([blob], pastedFileName, {type: PASTE_MIME});
      onPasted(file);
      return 'ok';
    };

    // Standard path: fires when the user pastes while an element is focused.
    // Handles both file pastes (clipboardData.files) and text pastes.
    // No toast on plain-text non-XML — the user might be pasting into the
    // search box, not trying to load XML.
    const onPaste = (e: ClipboardEvent) => {
      const cd = e.clipboardData;
      if (!cd) {
        log('paste event without clipboardData');
        return;
      }
      // 1. File pastes (Ctrl+C on a file in Explorer / Finder, then Ctrl+V).
      if (cd.files && cd.files.length > 0) {
        const file = cd.files[0];
        if (file) {
          log('paste-event', 'file detected', {name: file.name, type: file.type, size: file.size});
          onPasted(file);
          lastPasteHandledAt = Date.now();
          e.preventDefault();
          return;
        }
      }
      // 2. Text pastes containing raw XML.
      const text
        = cd.getData('text/xml')
          || cd.getData('application/xml')
          || cd.getData('text/plain')
          || cd.getData('text');
      if (ingestText(text, 'paste-event') === 'ok') {
        lastPasteHandledAt = Date.now();
        e.preventDefault();
      }
    };

    // Fallback: when nothing on the page has focus, Chromium does not fire a
    // `paste` event for plain Ctrl+V. Catch the keydown ourselves and read
    // the clipboard via the async API. The standard path takes precedence
    // — if it ran successfully within the last PASTE_HANDLED_WINDOW_MS,
    // we skip both ingestion AND the toast here.
    const onKeydown = async (e: KeyboardEvent) => {
      const isPasteShortcut = (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey
        && (e.key === 'v' || e.key === 'V');
      if (!isPasteShortcut) {
        return;
      }
      const active = document.activeElement;
      const bodyHasFocus = !active || active === document.body || active === document.documentElement;
      if (!bodyHasFocus) {
        return;
      }
      try {
        const text = await navigator.clipboard.readText();
        if (Date.now() - lastPasteHandledAt < PASTE_HANDLED_WINDOW_MS) {
          // Standard `paste` event already took this Ctrl+V (likely a file
          // paste). Stay quiet.
          return;
        }
        const outcome = ingestText(text, 'keydown-fallback');
        if (outcome !== 'ok') {
          onShortcutClipboardNotUsable?.();
        }
      } catch (err) {
        if (Date.now() - lastPasteHandledAt < PASTE_HANDLED_WINDOW_MS) {
          return;
        }
        log('clipboard.readText failed', err);
        onShortcutClipboardNotUsable?.();
      }
    };

    document.addEventListener('paste', onPaste);
    window.addEventListener('keydown', onKeydown);
    return () => {
      document.removeEventListener('paste', onPaste);
      window.removeEventListener('keydown', onKeydown);
    };
  }, [onPasted, pastedFileName, onShortcutClipboardNotUsable]);
}
