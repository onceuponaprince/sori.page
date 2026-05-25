/**
 * Twine 2 HTML exporter.
 *
 * Produces a single-file HTML document compatible with the Twine
 * editor. Round-trip fidelity (export → parse → identical TwinePassage
 * list) is covered by the exporter test suite.
 *
 * The startnode attribute is set to the 1-based index of the first
 * canon passage; if no canon passage exists, it defaults to 1.
 */

import type { TwinePassage } from "./parser";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildTwineHtml(
  storyName: string,
  passages: TwinePassage[],
): string {
  const firstCanonIdx = passages.findIndex((p) => p.tags.includes("canon"));
  const startnode = firstCanonIdx >= 0 ? firstCanonIdx + 1 : 1;

  const passageHtml = passages
    .map((p, idx) => {
      const linkStr = p.links
        .map((l) => `[[${l.label}|${l.target}]]`)
        .join("\n");
      const body = escapeHtml([p.content, linkStr].filter(Boolean).join("\n"));
      const tags = p.tags.join(" ");
      const pid = idx + 1;
      return `<tw-passagedata pid="${pid}" name="${escapeHtml(p.name)}" tags="${escapeHtml(tags)}">${body}</tw-passagedata>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>${escapeHtml(storyName)}</title></head>
<body>
<tw-storydata name="${escapeHtml(storyName)}" startnode="${startnode}" creator="sori.page" creator-version="1.0" ifid="">
${passageHtml}
</tw-storydata>
</body>
</html>`;
}
