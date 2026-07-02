// Paragraph data for all Bible chapters
// Format: {"BOOK.CHAPTER": [{v: verse_number, s: paragraph_style}]}
// Styles: m, p, q1, q2, q3, d, sp, li, b

import paraData from "./para-data.json";

export type ParagraphEntry = { v: number; s: string };

/**
 * Get paragraph data for a specific book/chapter
 * Returns array of {verse, style} or empty array if not found
 */
export function getParagraphData(book: string, chapter: number): ParagraphEntry[] {
  const key = `${book}.${chapter}`;
  return (paraData as Record<string, ParagraphEntry[]>)[key] ?? [];
}

/**
 * Check if paragraph data exists for a book/chapter
 */
export function hasParagraphData(book: string, chapter: number): boolean {
  const key = `${book}.${chapter}`;
  return key in (paraData as Record<string, unknown>);
}
