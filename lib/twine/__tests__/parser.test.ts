import { describe, it, expect } from "vitest";
import { parseTwee, parseTwineHtml } from "@/lib/twine/parser";

const tweeSample = `:: Start [canon]
She opens the letter and reads it carefully.
[[Tell the truth|Truth]]
[[Stay silent|Silence]]

:: Truth [canon]
She confronts her brother directly.

:: Silence [paradox]
She hides the letter under the floorboards.
`;

const twineHtmlSample = `<!DOCTYPE html><html><body>
<tw-storydata name="Test" startnode="1">
<tw-passagedata pid="1" name="Start" tags="canon">She opens the letter [[Tell the truth|Truth]] [[Stay silent|Silence]]</tw-passagedata>
<tw-passagedata pid="2" name="Truth" tags="canon">She confronts her brother.</tw-passagedata>
<tw-passagedata pid="3" name="Silence" tags="paradox">She hides it.</tw-passagedata>
</tw-storydata></body></html>`;

describe("parseTwee", () => {
  it("parses passage names in order", () => {
    const passages = parseTwee(tweeSample);
    expect(passages.map((p) => p.name)).toEqual(["Start", "Truth", "Silence"]);
  });

  it("parses tags from the header bracket", () => {
    const passages = parseTwee(tweeSample);
    expect(passages[0].tags).toContain("canon");
    expect(passages[2].tags).toContain("paradox");
  });

  it("parses links with label and target", () => {
    const passages = parseTwee(tweeSample);
    expect(passages[0].links).toEqual([
      { label: "Tell the truth", target: "Truth" },
      { label: "Stay silent", target: "Silence" },
    ]);
  });

  it("returns empty links array for passages with no links", () => {
    const passages = parseTwee(tweeSample);
    expect(passages[1].links).toHaveLength(0);
    expect(passages[2].links).toHaveLength(0);
  });

  it("treats [[Single]] as link with label === target", () => {
    const single = `:: Hub
Go [[onward]] without a separator.
`;
    const passages = parseTwee(single);
    expect(passages[0].links).toEqual([{ label: "onward", target: "onward" }]);
  });

  it("ignores content before the first passage header", () => {
    const withPreamble = `# Author note
Some prose.
:: Start
Hello.
`;
    const passages = parseTwee(withPreamble);
    expect(passages).toHaveLength(1);
    expect(passages[0].name).toBe("Start");
  });

  it("returns empty array on input with no headers", () => {
    expect(parseTwee("just prose, no passages")).toEqual([]);
  });
});

describe("parseTwineHtml", () => {
  it("parses all passages in the document", () => {
    const passages = parseTwineHtml(twineHtmlSample);
    expect(passages).toHaveLength(3);
    expect(passages.map((p) => p.name)).toEqual(["Start", "Truth", "Silence"]);
  });

  it("extracts tags from tw-passagedata attributes", () => {
    const passages = parseTwineHtml(twineHtmlSample);
    expect(passages[0].tags).toContain("canon");
    expect(passages[2].tags).toContain("paradox");
  });

  it("parses links from passage body", () => {
    const passages = parseTwineHtml(twineHtmlSample);
    expect(passages[0].links).toHaveLength(2);
    expect(passages[0].links[0]).toEqual({
      label: "Tell the truth",
      target: "Truth",
    });
  });

  it("decodes HTML entities in passage bodies", () => {
    const html = `<tw-passagedata name="Q" tags="canon">A &amp; B &lt; C &gt; D</tw-passagedata>`;
    const passages = parseTwineHtml(html);
    expect(passages[0].content).toBe("A & B < C > D");
  });

  it("tolerates attribute order: tags before name", () => {
    const html = `<tw-passagedata tags="canon" name="Reordered">body</tw-passagedata>`;
    const passages = parseTwineHtml(html);
    expect(passages).toHaveLength(1);
    expect(passages[0].name).toBe("Reordered");
    expect(passages[0].tags).toContain("canon");
  });

  it("returns empty array on input with no tw-passagedata tags", () => {
    expect(parseTwineHtml("<html><body>nothing</body></html>")).toEqual([]);
  });
});
