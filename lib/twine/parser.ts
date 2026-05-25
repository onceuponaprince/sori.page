/**
 * Twee + Twine 2 HTML passage parser.
 *
 * Both inputs reduce to the same `TwinePassage` shape so downstream
 * code (the import route, the multiverse tree builder) does not need
 * to branch on source format. The exporter (./exporter.ts) produces
 * Twine 2 HTML; the round-trip is covered by the exporter test
 * suite.
 *
 * INPUT FORMATS
 * ─────────────
 * Twee 3 (plain text):
 *   :: PassageName [tag1 tag2]
 *   Body text.
 *   [[Link label|Target]]
 *
 * Twine 2 HTML (output of the Twine editor):
 *   <tw-storydata ...>
 *     <tw-passagedata pid="1" name="..." tags="tag1 tag2">body</tw-passagedata>
 *     ...
 *   </tw-storydata>
 *
 * Both formats use `[[Label|Target]]` or `[[TargetOrLabel]]` for
 * branching links. When only one side is present, both `label` and
 * `target` resolve to the same value.
 */

export interface TwineLink {
  label: string;
  target: string;
}

export interface TwinePassage {
  name: string;
  tags: string[];
  content: string;
  links: TwineLink[];
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function extractLinks(body: string): TwineLink[] {
  const links: TwineLink[] = [];
  const re = /\[\[(.+?)(?:\|(.+?))?\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const [, first, second] = m;
    if (second !== undefined) {
      links.push({ label: first.trim(), target: second.trim() });
    } else {
      const v = first.trim();
      links.push({ label: v, target: v });
    }
  }
  return links;
}

export function parseTwee(content: string): TwinePassage[] {
  const passages: TwinePassage[] = [];
  // Split on lines starting with "::" — slice(1) drops the preamble
  // (anything before the first passage header).
  const blocks = content.split(/^:: /m).slice(1);

  for (const block of blocks) {
    const nl = block.indexOf("\n");
    if (nl === -1) continue;
    const header = block.slice(0, nl).trim();
    const body = block.slice(nl + 1).trim();
    // Header format: NAME [tag1 tag2]
    const headerMatch = header.match(/^(.+?)(?:\s+\[(.+?)\])?\s*$/);
    if (!headerMatch) continue;
    const name = headerMatch[1].trim();
    const tags = headerMatch[2]
      ? headerMatch[2].split(/\s+/).filter(Boolean)
      : [];
    passages.push({
      name,
      tags,
      content: body,
      links: extractLinks(body),
    });
  }
  return passages;
}

export function parseTwineHtml(content: string): TwinePassage[] {
  const passages: TwinePassage[] = [];
  // Loose attribute matcher — tw-passagedata attributes may appear in
  // any order. We extract name + tags + body via three named groups.
  const passageRe =
    /<tw-passagedata\b([^>]*)>([\s\S]*?)<\/tw-passagedata>/g;
  let m: RegExpExecArray | null;
  while ((m = passageRe.exec(content)) !== null) {
    const [, attrs, rawBody] = m;
    const nameMatch = attrs.match(/\bname="([^"]*)"/);
    const tagsMatch = attrs.match(/\btags="([^"]*)"/);
    if (!nameMatch) continue;
    const name = decodeEntities(nameMatch[1]);
    const tags = tagsMatch
      ? tagsMatch[1].split(/\s+/).filter(Boolean)
      : [];
    const body = decodeEntities(rawBody).trim();
    passages.push({
      name,
      tags,
      content: body,
      links: extractLinks(body),
    });
  }
  return passages;
}
