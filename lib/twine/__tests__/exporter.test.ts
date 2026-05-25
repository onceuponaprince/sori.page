import { describe, it, expect } from "vitest";
import { buildTwineHtml } from "@/lib/twine/exporter";
import { parseTwineHtml, type TwinePassage } from "@/lib/twine/parser";

const passages: TwinePassage[] = [
  {
    name: "Start",
    tags: ["canon"],
    content: "She opens the letter.",
    links: [{ label: "Tell truth", target: "Truth" }],
  },
  {
    name: "Truth",
    tags: ["canon"],
    content: "She confronts him.",
    links: [],
  },
  {
    name: "Silence",
    tags: ["paradox"],
    content: "She hides it.",
    links: [],
  },
];

describe("buildTwineHtml", () => {
  it("produces a tw-storydata wrapper with the supplied story name", () => {
    const html = buildTwineHtml("My Story", passages);
    expect(html).toContain("<tw-storydata");
    expect(html).toContain('name="My Story"');
    expect(html).toContain("</tw-storydata>");
  });

  it("includes one tw-passagedata per passage", () => {
    const html = buildTwineHtml("My Story", passages);
    const matches = html.match(/<tw-passagedata/g);
    expect(matches).not.toBeNull();
    expect(matches!).toHaveLength(3);
  });

  it("encodes special characters in passage bodies", () => {
    const html = buildTwineHtml("T", [
      { name: "Test", tags: [], content: "A & B < C > D", links: [] },
    ]);
    expect(html).toContain("A &amp; B &lt; C &gt; D");
  });

  it("encodes quotes inside passage names", () => {
    const html = buildTwineHtml("T", [
      { name: 'Sh"e', tags: [], content: "", links: [] },
    ]);
    expect(html).toContain('name="Sh&quot;e"');
  });

  it("emits links as [[Label|Target]] inside the body", () => {
    const html = buildTwineHtml("My Story", passages);
    expect(html).toContain("[[Tell truth|Truth]]");
  });

  it("sets startnode to the 1-based index of the first canon passage", () => {
    const reordered: TwinePassage[] = [
      { name: "Intro", tags: [], content: "Intro body", links: [] },
      { name: "First", tags: ["canon"], content: "Canon body", links: [] },
      { name: "Alt", tags: ["paradox"], content: "Alt body", links: [] },
    ];
    const html = buildTwineHtml("Reordered", reordered);
    expect(html).toContain('startnode="2"');
  });

  it("falls back to startnode=1 when no canon passage exists", () => {
    const noCanon: TwinePassage[] = [
      { name: "Solo", tags: [], content: "Alone", links: [] },
    ];
    const html = buildTwineHtml("No Canon", noCanon);
    expect(html).toContain('startnode="1"');
  });

  it("round-trips through parseTwineHtml without losing data", () => {
    const html = buildTwineHtml("My Story", passages);
    const recovered = parseTwineHtml(html);
    expect(recovered).toHaveLength(3);
    expect(recovered[0].name).toBe("Start");
    expect(recovered[0].tags).toContain("canon");
    expect(recovered[0].links).toEqual([
      { label: "Tell truth", target: "Truth" },
    ]);
    expect(recovered[2].tags).toContain("paradox");
  });

  it("round-trip preserves entity-encoded content", () => {
    const tricky: TwinePassage[] = [
      {
        name: "T",
        tags: [],
        content: "A & B < C > D",
        links: [],
      },
    ];
    const html = buildTwineHtml("T", tricky);
    const recovered = parseTwineHtml(html);
    expect(recovered[0].content).toBe("A & B < C > D");
  });
});
