export interface TextSelection {
  start: number;
  end: number;
}

export interface MarkdownEditResult {
  text: string;
  selection: TextSelection;
}

/**
 * Purpose: strip markdown markers so word counts and previews read as prose.
 * Inputs: markdown body.
 * Outputs: plain text.
 * Side effects: none.
 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Purpose: wrap the current selection with markdown markers (bold/italic).
 * Inputs: full text, selection range, opening and closing markers.
 * Outputs: next text and a selection inside the markers.
 * Side effects: none.
 * Design decisions: if there is no selection, insert a placeholder word so the writer can replace it.
 */
export function applyMarkdownWrap(
  text: string,
  selection: TextSelection,
  before: string,
  after: string,
): MarkdownEditResult {
  const start = Math.max(0, Math.min(selection.start, text.length));
  const end = Math.max(start, Math.min(selection.end, text.length));
  const selected = text.slice(start, end) || 'text';
  const next = `${text.slice(0, start)}${before}${selected}${after}${text.slice(end)}`;
  return {
    text: next,
    selection: {
      start: start + before.length,
      end: start + before.length + selected.length,
    },
  };
}

/**
 * Purpose: prefix selected lines with a markdown unordered-list marker.
 * Inputs: full text and selection.
 * Outputs: next text with `- ` on each touched line.
 * Side effects: none.
 */
export function applyMarkdownList(text: string, selection: TextSelection): MarkdownEditResult {
  const start = Math.max(0, Math.min(selection.start, text.length));
  const end = Math.max(start, Math.min(selection.end, text.length));
  const lineStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const block = text.slice(lineStart, end);
  const lines = (block.length ? block : '').split('\n');
  const listed = lines
    .map((line) => {
      if (!line.trim()) {
        return line;
      }
      return /^(\s*)[-*+]\s+/.test(line) ? line : `- ${line}`;
    })
    .join('\n');
  const next = `${text.slice(0, lineStart)}${listed}${text.slice(end)}`;
  const delta = listed.length - (end - lineStart);
  return {
    text: next,
    selection: { start: lineStart, end: end + delta },
  };
}
