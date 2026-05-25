import { describe, it, expect } from "vitest";
import { buildDefaultCharacterMd, parseCharacterMd } from "@/lib/character-md";

describe("parseCharacterMd", () => {
  it("extracts id, name, tags, body", () => {
    const src = buildDefaultCharacterMd("Maya Chen", "maya-chen");
    const parsed = parseCharacterMd(src);
    expect(parsed.frontmatter.id).toBe("maya-chen");
    expect(parsed.frontmatter.name).toBe("Maya Chen");
    expect(parsed.body.length).toBeGreaterThan(0);
  });
});
