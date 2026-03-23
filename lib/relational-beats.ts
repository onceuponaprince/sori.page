import { GENRES, STORY_BEATS, type GenreId } from "@/lib/narrative-concepts";
import type { AnalyzerResult } from "@/lib/analyzer-types";

export interface RelationalBeatPlan {
  beatName: string;
  actLabel: string;
  engineType: string;
  userLabel: string;
  functionSummary: string;
  whyNow: string;
  payoffPath: string;
  beforeBeat: string | null;
  afterBeat: string | null;
  tensionQuestions: string[];
  crossGenreAngle: string;
  structuralSignals: string[];
}

const ENGINE_LABELS: Record<string, { engineType: string; userLabel: string }> = {
  ordinary_world: {
    engineType: "baselineCalibration",
    userLabel: "Normal life before the crack appears",
  },
  call_to_adventure: {
    engineType: "disruptionImpulse",
    userLabel: "The invitation or rupture",
  },
  refusal_of_call: {
    engineType: "resistanceExposure",
    userLabel: "The part that wants to stay the same",
  },
  meeting_the_mentor: {
    engineType: "orientationTransfer",
    userLabel: "A guide, model, or framing device arrives",
  },
  crossing_threshold: {
    engineType: "commitmentLock",
    userLabel: "No turning back",
  },
  tests_allies_enemies: {
    engineType: "worldFriction",
    userLabel: "The story learns what hurts",
  },
  approach_inmost_cave: {
    engineType: "pressureCompression",
    userLabel: "The breath before the risk",
  },
  the_ordeal: {
    engineType: "identityStressTest",
    userLabel: "The point where the old self stops working",
  },
  reward: {
    engineType: "temporaryGain",
    userLabel: "A win that changes the stakes",
  },
  the_road_back: {
    engineType: "consequenceReturn",
    userLabel: "The way home gets harder",
  },
  dark_night_of_soul: {
    engineType: "valueCollapse",
    userLabel: "Everything inside the story goes dim",
  },
  the_resurrection: {
    engineType: "integratedChoice",
    userLabel: "Transformation under maximum pressure",
  },
  return_with_elixir: {
    engineType: "changedWorldReturn",
    userLabel: "What the story brings back",
  },
};

export function buildRelationalBeatPlan(params: {
  beatId: string;
  genreId: GenreId;
  context?: string;
  analysis?: AnalyzerResult | null;
}): RelationalBeatPlan | null {
  const beat = STORY_BEATS.find((item) => item.id === params.beatId);
  const genre = GENRES.find((item) => item.id === params.genreId);

  if (!beat || !genre) {
    return null;
  }

  const relation = ENGINE_LABELS[beat.id] ?? {
    engineType: "structuralLink",
    userLabel: beat.name,
  };

  const beforeBeat =
    beat.follows.length > 0
      ? STORY_BEATS.find((candidate) => candidate.id === beat.follows[0])?.name ?? null
      : null;
  const afterBeat =
    STORY_BEATS.find((candidate) => candidate.follows.includes(beat.id))?.name ?? null;

  const analysisArc = params.analysis?.currentArc;
  const analysisStory =
    params.analysis?.crossGenreComparisons[0]?.title ||
    params.analysis?.similarStories[0]?.title ||
    null;

  return {
    beatName: beat.name,
    actLabel: beat.act.replaceAll("_", " "),
    engineType: relation.engineType,
    userLabel: relation.userLabel,
    functionSummary: beat.description,
    whyNow: beforeBeat
      ? `Because ${beforeBeat} has already changed the protagonist's world, ${beat.name} is where the story converts that pressure into a new decision, revelation, or irreversible cost.`
      : `${beat.name} matters because it calibrates what "normal" means before the story starts taking it away.`,
    payoffPath: afterBeat
      ? `${beat.name} should create the emotional or practical condition that makes ${afterBeat} feel inevitable rather than arbitrary.`
      : `${beat.name} is a payoff surface. It should prove what the story has been transforming all along.`,
    beforeBeat,
    afterBeat,
    tensionQuestions: buildTensionQuestions({
      beatName: beat.name,
      genreName: genre.name,
      nextBeat: afterBeat,
      analysisArc,
    }),
    crossGenreAngle:
      analysisStory && params.analysis
        ? `Your latest analyzer pass points toward ${analysisStory}. Use this beat to echo the same structural move without copying surface genre signals.`
        : `In ${genre.name}, this beat usually expresses ${genre.structural_tendency.replaceAll("_", " ")}. The trick is making that same engine feel native to your own premise.`,
    structuralSignals: [
      `Engine type: ${relation.engineType}`,
      `User-facing label: ${relation.userLabel}`,
      `Typical emotional band: ${beat.emotional_range[0]} to ${beat.emotional_range[1]}`,
      `Common motif anchors: ${beat.typical_tropes.slice(0, 3).join(", ").replaceAll("_", " ")}`,
    ],
  };
}

function buildTensionQuestions(params: {
  beatName: string;
  genreName: string;
  nextBeat: string | null;
  analysisArc?: string;
}) {
  const questions = [
    `What changes inside the protagonist during ${params.beatName}, not just around them?`,
    `Why is this beat happening in a ${params.genreName} story instead of another genre's version of the same function?`,
  ];

  if (params.nextBeat) {
    questions.push(
      `What must become newly true here so that ${params.nextBeat} feels earned?`,
    );
  }

  if (params.analysisArc) {
    questions.push(
      `How does this beat strengthen the arc the analyzer described as "${params.analysisArc}"?`,
    );
  }

  return questions;
}
