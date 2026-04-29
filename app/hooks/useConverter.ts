import {useCallback, useMemo, useState} from 'react';
import {xmlToText} from '~/lib/xml-to-text/convert';

export interface ConverterState {
  paragraphs: string[];
  text: string;
  fileName: string;
  fileSize: number;
}

export type LoadOutcome
  = {ok: true; nonEmpty: boolean}
    | {ok: false; reason: 'not-xml' | 'read-failed'};

const EMPTY: ConverterState = {paragraphs: [], text: '', fileName: '', fileSize: 0};

export function useConverter() {
  const [state, setState] = useState<ConverterState>(EMPTY);

  const loadXml = useCallback((rawXml: string, fileName: string, fileSize: number): boolean => {
    const {paragraphs, text} = xmlToText(rawXml);
    setState({paragraphs, text, fileName, fileSize});
    return paragraphs.length > 0;
  }, []);

  const loadFile = useCallback(
    (file: File): Promise<LoadOutcome> =>
      new Promise((resolve) => {
        const isXml = /\.xml$/i.test(file.name) || /xml/i.test(file.type);
        if (!isXml) {
          resolve({ok: false, reason: 'not-xml'});
          return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = typeof e.target?.result === 'string' ? e.target.result : '';
          const nonEmpty = loadXml(result, file.name, file.size);
          resolve({ok: true, nonEmpty});
        };
        reader.onerror = () => resolve({ok: false, reason: 'read-failed'});
        reader.readAsText(file);
      }),
    [loadXml],
  );

  const clear = useCallback(() => {
    setState(EMPTY);
  }, []);

  const stats = useMemo(() => {
    const wordCount = (state.text.match(/\S+/g) ?? []).length;
    return {
      words: wordCount,
      chars: state.text.length,
    };
  }, [state.text]);

  const hasResult = state.paragraphs.length > 0;

  return {state, stats, hasResult, loadFile, loadXml, clear};
}
