import type { CharacterFrontmatter } from "@/types/character";

const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;

function parseSimpleYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let currentListKey: string | null = null;

  for (const line of yaml.split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;

    const listMatch = line.match(/^\s+-\s+(.+)$/);
    if (listMatch && currentListKey) {
      const arr = (result[currentListKey] as string[]) || [];
      arr.push(listMatch[1].trim());
      result[currentListKey] = arr;
      continue;
    }

    const kvMatch = line.match(/^(\w+):\s*(.*)$/);
    if (!kvMatch) continue;

    const [, key, rawValue] = kvMatch;
    currentListKey = null;

    if (rawValue === "") {
      result[key] = [];
      currentListKey = key;
      continue;
    }

    if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
      result[key] = rawValue
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      continue;
    }

    result[key] = rawValue.replace(/^["']|["']$/g, "");
  }

  return result;
}

export function buildDefaultCharacterMd(name: string, idSlug: string): string {
  return `---
id: ${idSlug}
name: ${name}
tags: []
knowledge: []
---

${name} — describe voice, boundaries, and backstory here.

## Speech patterns
-

## Boundaries
-
`;
}

export function parseCharacterMd(source: string): {
  frontmatter: CharacterFrontmatter;
  body: string;
} {
  const match = FRONTMATTER_RE.exec(source.trim());
  if (!match) {
    throw new Error("Character MD must start with YAML frontmatter delimited by ---");
  }

  const raw = parseSimpleYaml(match[1]);
  const id = String(raw.id || "");
  const name = String(raw.name || "");
  if (!id) throw new Error("Frontmatter field 'id' is required");
  if (!name) throw new Error("Frontmatter field 'name' is required");

  const tags = Array.isArray(raw.tags)
    ? raw.tags.map(String)
    : raw.tags
      ? [String(raw.tags)]
      : [];

  const knowledge = Array.isArray(raw.knowledge)
    ? raw.knowledge.map(String)
    : raw.knowledge
      ? [String(raw.knowledge)]
      : [];

  return {
    frontmatter: {
      id,
      name,
      tags,
      role_hint: raw.role_hint ? String(raw.role_hint) : undefined,
      voice: raw.voice ? String(raw.voice) : undefined,
      knowledge,
    },
    body: match[2].trim(),
  };
}

/** Body text after YAML frontmatter — used for client-side search. */
export function extractCharacterBio(source: string): string {
  try {
    return parseCharacterMd(source).body;
  } catch {
    const trimmed = source.trim();
    const match = FRONTMATTER_RE.exec(trimmed);
    return match ? match[2].trim() : trimmed;
  }
}

export function slugifyCharacterName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "character"
  );
}
