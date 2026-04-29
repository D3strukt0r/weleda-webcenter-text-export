import {XMLParser} from 'fast-xml-parser';

// Pure XML → readable plain text converter for Weleda's GS1
// `artwork_content:artworkContentMessage` documents.
//
// Behaviour (deliberate):
//
// 1. Only `<textContent>` subtrees are read. The
//    `<sh:StandardBusinessDocumentHeader>`, `<artworkContentLocale>`,
//    `<sourceReference>`, etc. are ignored — their values would be metadata
//    noise (timestamps, IDs) in the rendered text.
//
// 2. Within a `<textContent>`, every `<p>` and `<li>` becomes its own
//    output paragraph. Inline elements (`<b>`, `<i>`, `<span>`, `<a>` and
//    similar) bubble their text up. `<br/>` becomes a soft newline inside
//    the same paragraph.
//
// 3. Whitespace inside a paragraph is collapsed to single spaces and
//    trimmed. Empty paragraphs are dropped.
//
// 4. Document order is preserved — we do NOT sort by `<instanceSequence>`.
//    The source XMLs are authored in display order; resequencing them
//    would surprise the operator without giving any benefit.
//
// 5. The function is server-safe: it parses with fast-xml-parser instead
//    of `DOMParser`, so the same code path runs in Vitest (Node), in SSR,
//    and in the browser without environment branching.

type Node = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: true,
  preserveOrder: true,
  trimValues: false,
  parseTagValue: false,
});

const PARAGRAPH_TAGS = new Set(['p', 'li']);
const LINE_BREAK_TAG = 'br';
const TEXT_CONTENT_TAG = 'textContent';

function localName(tag: string): string {
  const i = tag.indexOf(':');
  return i === -1 ? tag : tag.slice(i + 1);
}

function isTextNode(node: Node): node is {'#text': unknown} {
  return Object.prototype.hasOwnProperty.call(node, '#text');
}

// Collect inline text inside a paragraph block. `<br/>` emits a newline.
function collectInlineText(children: Node[], buf: string[]): void {
  for (const child of children) {
    if (isTextNode(child)) {
      buf.push(String(child['#text']));
      continue;
    }
    for (const key of Object.keys(child)) {
      if (key === ':@') {
        continue;
      }
      const local = localName(key);
      if (local === LINE_BREAK_TAG) {
        buf.push('\n');
        continue;
      }
      const sub = child[key];
      if (Array.isArray(sub)) {
        collectInlineText(sub as Node[], buf);
      }
    }
  }
}

function renderParagraph(children: Node[]): string {
  const buf: string[] = [];
  collectInlineText(children, buf);
  // Collapse runs of inline whitespace per line, drop empty lines from <br/>
  // at the edges, then re-join with explicit \n soft breaks.
  return buf
    .join('')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

// Walk recursively. When we hit a <p>/<li>, render it as one paragraph and
// stop descending; for everything else, keep recursing through children.
function emitParagraphs(children: Node[], out: string[]): void {
  for (const child of children) {
    if (isTextNode(child)) {
      continue;
    }
    for (const key of Object.keys(child)) {
      if (key === ':@') {
        continue;
      }
      const sub = child[key];
      if (!Array.isArray(sub)) {
        continue;
      }
      const local = localName(key);
      if (PARAGRAPH_TAGS.has(local)) {
        const para = renderParagraph(sub as Node[]);
        if (para) {
          out.push(para);
        }
      } else {
        emitParagraphs(sub as Node[], out);
      }
    }
  }
}

function findTextContent(children: Node[], out: Node[][]): void {
  for (const child of children) {
    if (isTextNode(child)) {
      continue;
    }
    for (const key of Object.keys(child)) {
      if (key === ':@') {
        continue;
      }
      const sub = child[key];
      if (!Array.isArray(sub)) {
        continue;
      }
      const local = localName(key);
      if (local === TEXT_CONTENT_TAG) {
        out.push(sub as Node[]);
      } else {
        findTextContent(sub as Node[], out);
      }
    }
  }
}

export interface ConvertResult {
  paragraphs: string[];
  text: string;
}

export function xmlToText(xml: string): ConvertResult {
  if (!xml || !xml.trim()) {
    return {paragraphs: [], text: ''};
  }

  let parsed: Node[];
  try {
    parsed = parser.parse(xml) as Node[];
  } catch {
    return {paragraphs: [], text: ''};
  }

  const textContents: Node[][] = [];
  findTextContent(parsed, textContents);

  const paragraphs: string[] = [];
  for (const tc of textContents) {
    const before = paragraphs.length;
    emitParagraphs(tc, paragraphs);
    if (paragraphs.length === before) {
      // No <p>/<li> children — fall back to whatever text the textContent
      // does carry, so we don't silently drop content from oddly-shaped XML.
      const fallback = renderParagraph(tc);
      if (fallback) {
        paragraphs.push(fallback);
      }
    }
  }

  return {paragraphs, text: paragraphs.join('\n\n')};
}
