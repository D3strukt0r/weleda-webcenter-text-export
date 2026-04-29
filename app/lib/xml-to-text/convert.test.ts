import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';
import {xmlToText} from './convert';

const here = dirname(fileURLToPath(import.meta.url));
const sampleXml = readFileSync(join(here, '__fixtures__/sample.xml'), 'utf-8');
const expectedTxt = readFileSync(join(here, '__fixtures__/expected.txt'), 'utf-8')
  .replace(/\r\n/g, '\n')
  .trimEnd();

describe('xmlToText', () => {
  it('renders the Weleda fixture as readable plain text', () => {
    const {text, paragraphs} = xmlToText(sampleXml);
    expect(text).toBe(expectedTxt);
    expect(paragraphs).toHaveLength(6);
  });

  it('preserves document order, ignoring instanceSequence', () => {
    const {paragraphs} = xmlToText(sampleXml);
    // INDICATIONS_HEADER (seq=3) appears before INDICATIONS_LONG (seq=2) in
    // document order; the output must mirror that.
    const headerIdx = paragraphs.findIndex((p) => p.startsWith('Wann wird'));
    const longIdx = paragraphs.findIndex((p) => p.startsWith('Hilft'));
    expect(headerIdx).toBeGreaterThan(-1);
    expect(longIdx).toBeGreaterThan(-1);
    expect(headerIdx).toBeLessThan(longIdx);
  });

  it('skips the GS1 standard business document header', () => {
    const {text} = xmlToText(sampleXml);
    expect(text).not.toContain('GS1');
    expect(text).not.toContain('FixtureMessage');
    expect(text).not.toContain('de-CH');
  });

  it('honours <br/> as a soft line break inside the same paragraph', () => {
    const {paragraphs} = xmlToText(sampleXml);
    const brParagraph = paragraphs.find((p) => p.includes('Tropfen einnehmen'));
    expect(brParagraph).toBe('Tropfen einnehmen\ndanach Wasser trinken');
  });

  it('returns an empty result for empty / whitespace-only input', () => {
    expect(xmlToText('')).toEqual({paragraphs: [], text: ''});
    expect(xmlToText('   \n  ')).toEqual({paragraphs: [], text: ''});
  });

  it('returns an empty result for input without any <textContent>', () => {
    const xml = '<?xml version="1.0"?><root><other>ignored</other></root>';
    expect(xmlToText(xml)).toEqual({paragraphs: [], text: ''});
  });
});
