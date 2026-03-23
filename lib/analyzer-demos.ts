import type { AnalyzerDemo } from "@/lib/analyzer-types";

export const ANALYZER_DEMOS: AnalyzerDemo[] = [
  {
    id: "romance-reckoning",
    label: "Romance",
    genre: "Second-chance romance",
    outline: `Mina returns to the coastal town she swore off after her mother's funeral.\nShe agrees to restore the shuttered cinema with Eli, the ex she left behind.\nEach renovation milestone uncovers a memory they never finished living through.\nWhen the cinema wins a local preservation grant, Mina gets a career offer in Seoul.\nShe must decide whether love is a regression or the life she finally chooses on purpose.`,
    analysis: {
      title: "A reunion story about choosing a future, not reliving a past.",
      summary:
        "The outline carries the structural DNA of reconciliation stories where the external project becomes a safe container for emotional truth. The strongest current is not nostalgia, but whether Mina can reinterpret home as agency instead of surrender.",
      confidenceBand: "resonant",
      confidenceLabel: "Resonant foundation",
      coherenceScore: 84,
      currentArc: "Repair through shared labor",
      patternMatches: [
        {
          id: "great-mistake",
          label: "The Great Mistake",
          whyItFits:
            "The breakup is not just backstory. It is the engine that re-colors every present-tense choice.",
          confidence: 0.88,
          depthScore: 2,
        },
        {
          id: "moral-descent-in-reverse",
          label: "Guarded tenderness",
          whyItFits:
            "Both leads protect themselves by calling caution maturity, which creates quiet friction before intimacy can feel earned.",
          confidence: 0.76,
          depthScore: 4,
        },
      ],
      crossGenreComparisons: [
        {
          title: "Before Sunset",
          medium: "film",
          resonance:
            "Shared structure: compressed time forces emotional honesty before life can re-harden around the characters.",
          takeaway:
            "The clock should keep tightening the emotional aperture, not just the logistics.",
        },
        {
          title: "Station Eleven",
          medium: "novel/series",
          resonance:
            "Across genres, restoration becomes an argument that making something together can remake the self.",
          takeaway:
            "Let the cinema project visibly transform their emotional weather, not merely their setting.",
        },
      ],
      similarStories: [
        {
          title: "Persuasion",
          medium: "novel",
          resonance:
            "A prior refusal becomes the emotional hinge of the new chance.",
          takeaway:
            "Track whether Mina is rejecting Eli or rejecting the earlier version of herself.",
        },
      ],
      timelineWarnings: [
        {
          label: "Offer timing",
          detail:
            "The Seoul offer arrives at the right pressure point, but the outline does not yet show who learns about it first and how secrecy changes the last act.",
          severity: "medium",
        },
      ],
      gentleQuestions: [
        {
          id: "romance-q1",
          prompt: "What belief about home does Mina need to outgrow before love can feel like choice?",
        },
        {
          id: "romance-q2",
          prompt: "What does Eli misread about Mina's leaving, and how long can that false reading survive?",
        },
      ],
      retrievalNotes: [
        "Matched against reconciliation and restoration motifs in canonized concept nodes.",
        "Cross-genre comparisons favored stories where a shared project externalizes trust repair.",
      ],
    },
  },
  {
    id: "thriller-shadow",
    label: "Thriller",
    genre: "Conspiracy thriller",
    outline: `A public defender discovers her latest client worked inside a private detention network.\nThe client claims a teenage witness has been moved through a chain of shell facilities.\nEach clue exposes a different institution that benefits from silence.\nWhen the witness's older brother leaks evidence online, the system accelerates and turns the defender into the story.\nShe must decide whether to protect the boy's anonymity or publish everything before the network erases them both.`,
    analysis: {
      title: "A pressure-cooker thriller where truth spreads faster than safety.",
      summary:
        "The outline is structurally strongest when it behaves like a revelation ladder: every answer widens the scale of corruption and narrows the protagonist's personal safety. Its emotional signature resembles stories where institutional systems absorb and weaponize visibility.",
      confidenceBand: "steady",
      confidenceLabel: "Steady structural pull",
      coherenceScore: 78,
      currentArc: "Escalation through widening consequence",
      patternMatches: [
        {
          id: "web-of-complicity",
          label: "Complicity cascade",
          whyItFits:
            "The thriller keeps discovering that the villain is not a person but an interlocking incentive system.",
          confidence: 0.85,
          depthScore: 3,
        },
        {
          id: "great-mistake",
          label: "The Great Mistake",
          whyItFits:
            "Publishing evidence may save the truth and still endanger the human being at the center of the case.",
          confidence: 0.71,
          depthScore: 2,
        },
      ],
      crossGenreComparisons: [
        {
          title: "Breaking Bad",
          medium: "series",
          resonance:
            "The structural overlap is not crime but moral narrowing: each tactical win intensifies the cost of the next choice.",
          takeaway:
            "Make every exposure feel like it buys truth by spending innocence.",
        },
        {
          title: "All the President's Men",
          medium: "film",
          resonance:
            "The outline shares the rhythm of piecing together a machine that is bigger than any single witness.",
          takeaway:
            "The middle should keep revealing systems, not just new suspects.",
        },
      ],
      similarStories: [
        {
          title: "Spotlight",
          medium: "film",
          resonance:
            "The case becomes real when the institutional pattern matters more than any one headline.",
          takeaway:
            "Clarify when your defender realizes she is documenting a structure, not litigating an exception.",
        },
      ],
      timelineWarnings: [
        {
          label: "Knowledge chain",
          detail:
            "The older brother leaks evidence before the outline establishes exactly what the witness trusted him with and when.",
          severity: "high",
        },
      ],
      gentleQuestions: [
        {
          id: "thriller-q1",
          prompt: "When does the defender cross from advocate to participant, and what does that cost her professionally?",
        },
        {
          id: "thriller-q2",
          prompt: "What single fact would make the witness impossible for the system to disappear quietly?",
        },
      ],
      retrievalNotes: [
        "Retrieved institution-scale corruption motifs and witness-protection failure patterns.",
        "Timeline warning derived from unresolved knowledge transfer between siblings and counsel.",
      ],
    },
  },
  {
    id: "literary-transformation",
    label: "Literary",
    genre: "Literary family drama",
    outline: `After her father's stroke, Noor returns to run the family bookstore for a summer.\nShe discovers he has been secretly writing apology letters to customers he once failed.\nEach unfinished letter points to a moment Noor witnessed differently as a child.\nHer brother wants to sell the shop before the debts surface.\nNoor must choose whether preserving the store also means preserving a story about their father that is no longer true.`,
    analysis: {
      title: "A memory-revision story about inheriting a flawed legacy honestly.",
      summary:
        "This outline has a strong literary engine because the external plot keeps reopening emotional interpretation. The bookstore is less a business problem than an archive of contested memory, which gives the story a quiet but durable structural spine.",
      confidenceBand: "resonant",
      confidenceLabel: "Resonant interior arc",
      coherenceScore: 87,
      currentArc: "Revision of inherited memory",
      patternMatches: [
        {
          id: "buried-truth-ledger",
          label: "Buried ledger",
          whyItFits:
            "The apology letters function as a scene-by-scene device for revealing emotional debt through material evidence.",
          confidence: 0.9,
          depthScore: 4,
        },
        {
          id: "shadow-of-the-parent",
          label: "Parent in re-translation",
          whyItFits:
            "The protagonist must rewrite not just her father, but the child-self who once needed certainty about him.",
          confidence: 0.82,
          depthScore: 3,
        },
      ],
      crossGenreComparisons: [
        {
          title: "The Godfather",
          medium: "film",
          resonance:
            "Across genres, inheritance becomes a moral sorting problem: what do you carry forward, and what do you finally name honestly?",
          takeaway:
            "The brother's desire to sell should represent a value system, not just a practical obstacle.",
        },
        {
          title: "Atonement",
          medium: "novel",
          resonance:
            "The structure hinges on interpretation, guilt, and the instability of remembered events.",
          takeaway:
            "Keep the revelations changing Noor's understanding of herself, not just of her father.",
        },
      ],
      similarStories: [
        {
          title: "The Remains of the Day",
          medium: "novel",
          resonance:
            "Personal history is excavated through what was once considered duty.",
          takeaway:
            "Let routine shop tasks become the pressure points where repressed feeling leaks out.",
        },
      ],
      timelineWarnings: [
        {
          label: "Letter chronology",
          detail:
            "The outline should pin down whether the apology letters were written after Noor left or whether she unknowingly lived beside them.",
          severity: "low",
        },
      ],
      gentleQuestions: [
        {
          id: "literary-q1",
          prompt: "What version of her father is Noor still protecting because it also protects her younger self?",
        },
        {
          id: "literary-q2",
          prompt: "If the bookstore closes, what truth becomes impossible to keep pretending around?",
        },
      ],
      retrievalNotes: [
        "Weighted toward memory revision and inheritance patterns with material artifacts.",
        "Similar-story matches emphasize internal value shifts over genre adjacency.",
      ],
    },
  },
];

export function getAnalyzerDemo(id: string) {
  return ANALYZER_DEMOS.find((demo) => demo.id === id) ?? ANALYZER_DEMOS[0];
}
