/**
 * Seeded narrative concepts for the MVP.
 *
 * In v2, these come from the Neo4j knowledge graph.
 * For now, this curated dataset gives the generators enough
 * structural awareness to produce meaningfully different output
 * from generic AI writing tools.
 */

export interface NarrativeConcept {
  name: string;
  description: string;
  depth_score: number; // 1-5, how grounded this is
  confidence: number; // 0-1
  category: "structure" | "archetype" | "trope" | "technique";
}

export interface StoryBeat {
  id: string;
  name: string;
  act: string;
  description: string;
  emotional_range: [number, number]; // min, max (-1 to 1)
  typical_tropes: string[];
  follows: string[]; // ids of beats that typically precede
}

export interface CharacterArchetype {
  id: string;
  name: string;
  description: string;
  typical_traits: string[];
  narrative_function: string;
  common_in_genres: string[];
  relationships: { archetype: string; dynamic: string }[];
}

// ============================================================
// Story Beats — the structural skeleton
// ============================================================
export const STORY_BEATS: StoryBeat[] = [
  {
    id: "ordinary_world",
    name: "The Ordinary World",
    act: "act_1",
    description:
      "Establishes the protagonist's normal life before the story disrupts it. Shows what they stand to lose and what's missing.",
    emotional_range: [-0.2, 0.3],
    typical_tropes: ["fish_out_of_water_setup", "save_the_cat", "establishing_character_moment"],
    follows: [],
  },
  {
    id: "call_to_adventure",
    name: "Call to Adventure",
    act: "act_1",
    description:
      "An inciting incident disrupts the ordinary world and presents the protagonist with a challenge or opportunity they can't ignore.",
    emotional_range: [0.0, 0.6],
    typical_tropes: ["the_call", "mysterious_stranger", "inciting_incident"],
    follows: ["ordinary_world"],
  },
  {
    id: "refusal_of_call",
    name: "Refusal of the Call",
    act: "act_1",
    description:
      "The protagonist hesitates, doubts, or outright refuses the adventure. Reveals their fear and establishes the internal conflict.",
    emotional_range: [-0.4, 0.0],
    typical_tropes: ["reluctant_hero", "i_just_want_to_be_normal", "refusal_of_the_call"],
    follows: ["call_to_adventure"],
  },
  {
    id: "meeting_the_mentor",
    name: "Meeting the Mentor",
    act: "act_1",
    description:
      "A wiser figure provides guidance, tools, or confidence the protagonist needs. May be a person, an object, or an inner realization.",
    emotional_range: [0.1, 0.5],
    typical_tropes: ["mentor_archetype", "the_obi_wan", "supernatural_aid"],
    follows: ["refusal_of_call"],
  },
  {
    id: "crossing_threshold",
    name: "Crossing the Threshold",
    act: "act_1",
    description:
      "The protagonist commits to the adventure and enters the unfamiliar world. No turning back. Act 1 ends here.",
    emotional_range: [0.2, 0.7],
    typical_tropes: ["point_of_no_return", "threshold_guardians", "leaving_home"],
    follows: ["meeting_the_mentor"],
  },
  {
    id: "tests_allies_enemies",
    name: "Tests, Allies, and Enemies",
    act: "act_2a",
    description:
      "The protagonist navigates the new world, making allies and enemies, learning the rules, and facing early challenges.",
    emotional_range: [-0.3, 0.5],
    typical_tropes: ["ragtag_bunch_of_misfits", "the_team", "training_montage"],
    follows: ["crossing_threshold"],
  },
  {
    id: "approach_inmost_cave",
    name: "Approach to the Inmost Cave",
    act: "act_2a",
    description:
      "The protagonist prepares for the central ordeal. Tension builds as they approach the source of their greatest fear.",
    emotional_range: [-0.2, 0.3],
    typical_tropes: ["darkest_hour_approach", "calm_before_storm", "planning_sequence"],
    follows: ["tests_allies_enemies"],
  },
  {
    id: "the_ordeal",
    name: "The Ordeal (Midpoint)",
    act: "midpoint",
    description:
      "The central crisis. The protagonist faces their greatest fear, experiences a death-and-rebirth moment. Everything changes here.",
    emotional_range: [-0.8, 0.2],
    typical_tropes: ["midpoint_reversal", "all_is_lost", "death_rebirth"],
    follows: ["approach_inmost_cave"],
  },
  {
    id: "reward",
    name: "The Reward",
    act: "act_2b",
    description:
      "After surviving the ordeal, the protagonist gains something — knowledge, power, an ally, or a literal prize.",
    emotional_range: [0.2, 0.7],
    typical_tropes: ["earned_power_up", "seizing_the_sword", "celebration"],
    follows: ["the_ordeal"],
  },
  {
    id: "the_road_back",
    name: "The Road Back",
    act: "act_2b",
    description:
      "The protagonist begins the journey home but faces consequences of the ordeal. New complications arise.",
    emotional_range: [-0.3, 0.4],
    typical_tropes: ["chase_scene", "ticking_clock", "complications"],
    follows: ["reward"],
  },
  {
    id: "dark_night_of_soul",
    name: "Dark Night of the Soul",
    act: "act_2b",
    description:
      "The protagonist's lowest point. All seems lost. The internal wound is fully exposed. This is where transformation begins.",
    emotional_range: [-0.9, -0.3],
    typical_tropes: ["all_is_lost_moment", "mentor_death", "betrayal"],
    follows: ["the_road_back"],
  },
  {
    id: "the_resurrection",
    name: "The Resurrection (Climax)",
    act: "act_3",
    description:
      "The final test where the protagonist must use everything they've learned. They are transformed by the experience.",
    emotional_range: [-0.3, 0.9],
    typical_tropes: ["final_battle", "climactic_choice", "transformation"],
    follows: ["dark_night_of_soul"],
  },
  {
    id: "return_with_elixir",
    name: "Return with the Elixir",
    act: "act_3",
    description:
      "The protagonist returns to the ordinary world, changed. They bring back something that benefits their world — wisdom, peace, or literal treasure.",
    emotional_range: [0.3, 1.0],
    typical_tropes: ["full_circle", "the_resolution", "earned_ending"],
    follows: ["the_resurrection"],
  },
];

// ============================================================
// Character Archetypes
// ============================================================
export const CHARACTER_ARCHETYPES: CharacterArchetype[] = [
  {
    id: "hero",
    name: "The Hero / Protagonist",
    description:
      "The central character who undergoes transformation. Drives the story forward through choices and actions.",
    typical_traits: ["determined", "flawed", "growth-oriented", "courageous"],
    narrative_function: "Carries the thematic argument. Their arc IS the story.",
    common_in_genres: ["fantasy", "sci-fi", "thriller", "romance", "literary"],
    relationships: [
      { archetype: "mentor", dynamic: "receives guidance, eventually surpasses" },
      { archetype: "shadow", dynamic: "mirrors and opposes" },
      { archetype: "ally", dynamic: "complementary strengths" },
    ],
  },
  {
    id: "mentor",
    name: "The Mentor",
    description:
      "A guide who provides wisdom, tools, or motivation. Often represents what the hero could become — or a cautionary tale.",
    typical_traits: ["wise", "experienced", "cryptic", "sacrificial"],
    narrative_function: "Accelerates the hero's growth. Their death or departure forces independence.",
    common_in_genres: ["fantasy", "sci-fi", "coming-of-age", "sports"],
    relationships: [
      { archetype: "hero", dynamic: "guides toward potential" },
      { archetype: "shadow", dynamic: "former ally or mirror" },
    ],
  },
  {
    id: "shadow",
    name: "The Shadow / Antagonist",
    description:
      "The primary opposition. At their best, they represent the dark mirror of the hero — what the hero could become if they fail.",
    typical_traits: ["driven", "intelligent", "wounded", "compelling"],
    narrative_function: "Forces the hero to confront their flaws. The stronger the shadow, the stronger the story.",
    common_in_genres: ["fantasy", "thriller", "horror", "literary"],
    relationships: [
      { archetype: "hero", dynamic: "dark mirror, philosophical opposition" },
      { archetype: "mentor", dynamic: "corrupted version of guidance" },
    ],
  },
  {
    id: "ally",
    name: "The Ally / Sidekick",
    description:
      "A companion who supports the hero. Provides contrast, comic relief, or emotional grounding.",
    typical_traits: ["loyal", "complementary skills", "grounding", "honest"],
    narrative_function: "Humanizes the hero through relationship. Often the audience surrogate.",
    common_in_genres: ["fantasy", "adventure", "comedy", "romance"],
    relationships: [
      { archetype: "hero", dynamic: "loyal support, emotional anchor" },
      { archetype: "trickster", dynamic: "tension and humor" },
    ],
  },
  {
    id: "trickster",
    name: "The Trickster",
    description:
      "A disruptive force that challenges the status quo through humor, chaos, or unconventional thinking.",
    typical_traits: ["witty", "unpredictable", "perceptive", "morally ambiguous"],
    narrative_function: "Breaks tension, reveals truth through humor, catalyzes change.",
    common_in_genres: ["comedy", "fantasy", "adventure", "heist"],
    relationships: [
      { archetype: "hero", dynamic: "challenges assumptions" },
      { archetype: "shadow", dynamic: "wild card allegiance" },
    ],
  },
  {
    id: "herald",
    name: "The Herald",
    description:
      "Announces the coming of change. May be a character, an event, or a message that disrupts the ordinary world.",
    typical_traits: ["mysterious", "catalytic", "brief appearance", "memorable"],
    narrative_function: "Triggers the call to adventure. Sets the plot in motion.",
    common_in_genres: ["fantasy", "mystery", "thriller", "horror"],
    relationships: [
      { archetype: "hero", dynamic: "delivers the call" },
    ],
  },
  {
    id: "shapeshifter",
    name: "The Shapeshifter",
    description:
      "A character whose loyalty or nature is uncertain. Keeps the hero (and audience) guessing.",
    typical_traits: ["ambiguous", "alluring", "deceptive", "complex"],
    narrative_function: "Creates suspense and doubt. Often a love interest or unreliable ally.",
    common_in_genres: ["thriller", "romance", "mystery", "noir"],
    relationships: [
      { archetype: "hero", dynamic: "attraction and suspicion" },
      { archetype: "shadow", dynamic: "potential double agent" },
    ],
  },
  {
    id: "guardian",
    name: "The Threshold Guardian",
    description:
      "A figure who tests the hero's commitment at key transition points. Not necessarily an enemy — often a test of worthiness.",
    typical_traits: ["imposing", "rule-bound", "testing", "respectable"],
    narrative_function: "Gates progress. Forces the hero to prove readiness before advancing.",
    common_in_genres: ["fantasy", "adventure", "sports", "coming-of-age"],
    relationships: [
      { archetype: "hero", dynamic: "obstacle that becomes respect" },
      { archetype: "mentor", dynamic: "sometimes serves the mentor" },
    ],
  },
];

// ============================================================
// Genres with structural tendencies
// ============================================================
export const GENRES = [
  { id: "fantasy", name: "Fantasy", structural_tendency: "hero_journey", tone: "epic" },
  { id: "sci_fi", name: "Science Fiction", structural_tendency: "exploration", tone: "speculative" },
  { id: "thriller", name: "Thriller", structural_tendency: "escalating_tension", tone: "tense" },
  { id: "romance", name: "Romance", structural_tendency: "relationship_arc", tone: "emotional" },
  { id: "horror", name: "Horror", structural_tendency: "dread_escalation", tone: "unsettling" },
  { id: "mystery", name: "Mystery", structural_tendency: "revelation_chain", tone: "suspicious" },
  { id: "literary", name: "Literary Fiction", structural_tendency: "character_study", tone: "introspective" },
  { id: "comedy", name: "Comedy", structural_tendency: "escalating_absurdity", tone: "humorous" },
  { id: "coming_of_age", name: "Coming of Age", structural_tendency: "maturation_arc", tone: "nostalgic" },
  { id: "action", name: "Action/Adventure", structural_tendency: "setpiece_chain", tone: "exciting" },
] as const;

export type GenreId = (typeof GENRES)[number]["id"];

// ============================================================
// Template scenes from known works (for character insertion)
// ============================================================
export interface TemplateScene {
  id: string;
  work: string;
  scene_name: string;
  beat_id: string;
  genre: GenreId;
  description: string;
  character_slots: { role: string; archetype: string; description: string }[];
}

export const TEMPLATE_SCENES: TemplateScene[] = [
  {
    id: "anh_cantina",
    work: "Star Wars: A New Hope",
    scene_name: "The Cantina Meeting",
    beat_id: "tests_allies_enemies",
    genre: "fantasy",
    description:
      "The protagonist enters an unfamiliar, dangerous social space and must find an ally among strangers. Tests their ability to navigate the new world.",
    character_slots: [
      { role: "Protagonist", archetype: "hero", description: "Fish out of water, seeking help" },
      { role: "Roguish Ally", archetype: "trickster", description: "Skilled but self-interested, needs convincing" },
      { role: "Mentor", archetype: "mentor", description: "Guides the protagonist through the encounter" },
    ],
  },
  {
    id: "lotr_council",
    work: "Lord of the Rings",
    scene_name: "The Council Scene",
    beat_id: "crossing_threshold",
    genre: "fantasy",
    description:
      "A gathering of powerful figures debates the course of action. The protagonist makes the choice that commits them to the adventure.",
    character_slots: [
      { role: "Unlikely Hero", archetype: "hero", description: "Underestimated but steps up" },
      { role: "Wise Leader", archetype: "mentor", description: "Orchestrates the moment of commitment" },
      { role: "Reluctant Ally", archetype: "ally", description: "Skeptical but ultimately joins the cause" },
    ],
  },
  {
    id: "pride_ball",
    work: "Pride and Prejudice",
    scene_name: "The First Ball",
    beat_id: "call_to_adventure",
    genre: "romance",
    description:
      "A social gathering where the protagonist first encounters their love interest under circumstances that create immediate tension and misunderstanding.",
    character_slots: [
      { role: "Protagonist", archetype: "hero", description: "Observant, quick to judge, socially aware" },
      { role: "Love Interest", archetype: "shapeshifter", description: "Initially off-putting, hides depth" },
      { role: "Confidant", archetype: "ally", description: "The protagonist's emotional sounding board" },
    ],
  },
  {
    id: "breaking_bad_diagnosis",
    work: "Breaking Bad",
    scene_name: "The Diagnosis",
    beat_id: "call_to_adventure",
    genre: "thriller",
    description:
      "The protagonist receives news that fundamentally alters their relationship with their own mortality and triggers a radical reevaluation of their life.",
    character_slots: [
      { role: "Protagonist", archetype: "hero", description: "Ordinary person facing extraordinary circumstance" },
      { role: "Authority Figure", archetype: "herald", description: "Delivers the life-changing information" },
      { role: "Family Member", archetype: "ally", description: "Represents what's at stake" },
    ],
  },
  {
    id: "dark_knight_interrogation",
    work: "The Dark Knight",
    scene_name: "The Interrogation",
    beat_id: "the_ordeal",
    genre: "thriller",
    description:
      "The protagonist confronts the antagonist directly and realizes the conflict is philosophical, not physical. The villain reveals the real game.",
    character_slots: [
      { role: "Protagonist", archetype: "hero", description: "Powerful but facing a problem power can't solve" },
      { role: "Antagonist", archetype: "shadow", description: "Calm, philosophical, in control despite captivity" },
    ],
  },
  {
    id: "gatsby_party",
    work: "The Great Gatsby",
    scene_name: "The Grand Party",
    beat_id: "tests_allies_enemies",
    genre: "literary",
    description:
      "The protagonist observes an extravagant world that hides emptiness. Surface beauty masks deeper corruption or longing.",
    character_slots: [
      { role: "Observer", archetype: "hero", description: "Outsider granted access, narrates" },
      { role: "Enigmatic Host", archetype: "shapeshifter", description: "Larger than life, hiding vulnerability" },
      { role: "Cynical Insider", archetype: "trickster", description: "Knows the truth, shares it obliquely" },
    ],
  },
  {
    id: "silence_lambs_first_meeting",
    work: "The Silence of the Lambs",
    scene_name: "Clarice Meets Hannibal",
    beat_id: "meeting_the_mentor",
    genre: "thriller",
    description:
      "The protagonist descends into a literal underworld to seek guidance from a brilliant but dangerous figure. The mentor demands vulnerability in exchange for knowledge.",
    character_slots: [
      { role: "Protagonist", archetype: "hero", description: "Capable but inexperienced, concealing personal wounds" },
      { role: "Imprisoned Mentor", archetype: "mentor", description: "Genius predator who offers insight at a psychological price" },
      { role: "Obstructive Gatekeeper", archetype: "guardian", description: "Authority figure who controls access and sets conditions" },
    ],
  },
  {
    id: "se7en_box",
    work: "Se7en",
    scene_name: "What's in the Box",
    beat_id: "the_ordeal",
    genre: "thriller",
    description:
      "The antagonist orchestrates a final trap that forces the protagonist into an impossible moral choice. The villain wins by making the hero confront their own capacity for darkness.",
    character_slots: [
      { role: "Protagonist", archetype: "hero", description: "Idealistic detective pushed to the breaking point" },
      { role: "Antagonist", archetype: "shadow", description: "Methodical villain who has planned every step, including his own end" },
      { role: "Veteran Partner", archetype: "mentor", description: "Experienced figure who sees the trap but cannot prevent it" },
    ],
  },
  {
    id: "no_country_coin_toss",
    work: "No Country for Old Men",
    scene_name: "The Coin Toss",
    beat_id: "approach_inmost_cave",
    genre: "thriller",
    description:
      "An ordinary person encounters an unstoppable force of violence and is subjected to a test they don't fully understand. Fate and free will collide in a mundane setting.",
    character_slots: [
      { role: "Innocent Bystander", archetype: "hero", description: "Ordinary person suddenly facing existential danger" },
      { role: "Agent of Fate", archetype: "shadow", description: "Remorseless figure who operates by an alien moral code" },
    ],
  },
  {
    id: "when_harry_met_sally_deli",
    work: "When Harry Met Sally",
    scene_name: "The Deli Scene",
    beat_id: "tests_allies_enemies",
    genre: "romance",
    description:
      "A comedic confrontation about desire and authenticity in a public space. One character challenges the other's assumptions, flipping the power dynamic through performance.",
    character_slots: [
      { role: "Protagonist", archetype: "hero", description: "Confident in their worldview, about to be proven wrong" },
      { role: "Love Interest", archetype: "shapeshifter", description: "Challenges the protagonist's certainties through bold demonstration" },
      { role: "Bystander Commentator", archetype: "trickster", description: "Punctuates the moment with an audience-surrogate reaction" },
    ],
  },
  {
    id: "titanic_bow",
    work: "Titanic",
    scene_name: "Flying on the Bow",
    beat_id: "reward",
    genre: "romance",
    description:
      "After overcoming social barriers, the lovers share a transcendent moment of freedom and trust. The reward is emotional liberation, but the setting foreshadows impending catastrophe.",
    character_slots: [
      { role: "Sheltered Protagonist", archetype: "hero", description: "Breaking free from a constrained life, learning to trust" },
      { role: "Free-Spirited Guide", archetype: "mentor", description: "Shows the protagonist a new way of being in the world" },
    ],
  },
  {
    id: "shining_all_work",
    work: "The Shining",
    scene_name: "All Work and No Play",
    beat_id: "dark_night_of_soul",
    genre: "horror",
    description:
      "A character discovers undeniable proof that someone they love has been consumed by madness. Isolation and supernatural influence have completed a terrifying transformation.",
    character_slots: [
      { role: "Discoverer", archetype: "hero", description: "Finally confronts the truth they have been denying" },
      { role: "Corrupted Figure", archetype: "shadow", description: "Once trusted protector, now fully surrendered to destructive forces" },
    ],
  },
  {
    id: "alien_dinner_scene",
    work: "Alien",
    scene_name: "The Chestburster",
    beat_id: "call_to_adventure",
    genre: "horror",
    description:
      "A moment of false calm is shattered by a violent eruption from within. The real threat reveals itself in the most intimate and horrifying way possible, and survival becomes the only goal.",
    character_slots: [
      { role: "Survivor Protagonist", archetype: "hero", description: "Resourceful crew member who will be forced to lead" },
      { role: "Victim", archetype: "herald", description: "Their fate announces the true nature of the threat" },
      { role: "Authority Figure", archetype: "guardian", description: "Tries to maintain order as everything falls apart" },
    ],
  },
  {
    id: "get_out_sunken_place",
    work: "Get Out",
    scene_name: "The Sunken Place",
    beat_id: "the_ordeal",
    genre: "horror",
    description:
      "The protagonist is psychologically trapped by a figure they trusted. What appeared to be hospitality is revealed as predation, and the hero loses control of their own consciousness.",
    character_slots: [
      { role: "Protagonist", archetype: "hero", description: "Outsider who ignored warning signs out of politeness and hope" },
      { role: "Manipulator", archetype: "shadow", description: "Uses intimacy and trust as weapons of control" },
    ],
  },
  {
    id: "princess_bride_inigo",
    work: "The Princess Bride",
    scene_name: "Inigo's Revenge",
    beat_id: "the_resurrection",
    genre: "comedy",
    description:
      "A supporting character completes their lifelong quest by confronting the villain who wronged them. A repeated phrase transforms from rehearsal into catharsis, blending humor with genuine emotion.",
    character_slots: [
      { role: "Avenging Hero", archetype: "hero", description: "Driven by a single promise, finally facing their moment" },
      { role: "Villain", archetype: "shadow", description: "Cowardly antagonist who underestimates the hero's resolve" },
      { role: "Loyal Companion", archetype: "ally", description: "Provides crucial support to make the confrontation possible" },
    ],
  },
  {
    id: "groundhog_day_final_loop",
    work: "Groundhog Day",
    scene_name: "The Final Day",
    beat_id: "return_with_elixir",
    genre: "comedy",
    description:
      "After countless failed attempts, the protagonist has transformed into the best version of themselves. They use accumulated wisdom selflessly, and the cycle finally breaks.",
    character_slots: [
      { role: "Transformed Protagonist", archetype: "hero", description: "Once cynical and selfish, now genuinely compassionate" },
      { role: "Love Interest", archetype: "shapeshifter", description: "Has been the moral compass all along; finally sees the real person" },
    ],
  },
  {
    id: "stand_by_me_bridge",
    work: "Stand By Me",
    scene_name: "The Train Bridge",
    beat_id: "crossing_threshold",
    genre: "coming_of_age",
    description:
      "The group of young protagonists faces a physical danger that forces them past the point of no return. Childhood safety is left behind as they commit to their quest.",
    character_slots: [
      { role: "Sensitive Protagonist", archetype: "hero", description: "Thoughtful kid processing grief, finding courage through friendship" },
      { role: "Bold Friend", archetype: "ally", description: "Brave on the outside, hiding a troubled home life" },
      { role: "Troubled Leader", archetype: "trickster", description: "Charismatic but reckless, pushes the group forward" },
    ],
  },
  {
    id: "breakfast_club_confession",
    work: "The Breakfast Club",
    scene_name: "The Group Confession",
    beat_id: "approach_inmost_cave",
    genre: "coming_of_age",
    description:
      "Forced into proximity, a group of strangers drop their social masks and reveal the pain behind their archetypes. Vulnerability becomes the path to genuine connection.",
    character_slots: [
      { role: "Outcast Protagonist", archetype: "hero", description: "Has the least social armor, speaks truth first" },
      { role: "Popular Facade", archetype: "shapeshifter", description: "Reveals that privilege is its own kind of prison" },
      { role: "Authority Antagonist", archetype: "guardian", description: "Absent but ever-present force that created the crucible" },
    ],
  },
  {
    id: "matrix_red_pill",
    work: "The Matrix",
    scene_name: "The Red Pill Choice",
    beat_id: "crossing_threshold",
    genre: "sci_fi",
    description:
      "The protagonist is offered a binary choice between comfortable ignorance and painful truth. Choosing truth means abandoning their entire understanding of reality.",
    character_slots: [
      { role: "Chosen Protagonist", archetype: "hero", description: "Senses something is wrong with the world, seeks answers" },
      { role: "Rebel Mentor", archetype: "mentor", description: "Offers the choice but cannot make it for the hero" },
      { role: "Agent of the System", archetype: "shadow", description: "Represents the force that will pursue the hero once they choose" },
    ],
  },
  {
    id: "interstellar_departure",
    work: "Interstellar",
    scene_name: "Leaving the Children Behind",
    beat_id: "refusal_of_call",
    genre: "sci_fi",
    description:
      "The protagonist must choose between personal love and universal duty. The emotional cost of answering the call is made devastatingly concrete through a parent-child separation.",
    character_slots: [
      { role: "Protagonist Parent", archetype: "hero", description: "Torn between saving the world and being present for their child" },
      { role: "Child Left Behind", archetype: "ally", description: "Represents the personal stakes and emotional cost of the mission" },
      { role: "Mission Commander", archetype: "herald", description: "Embodies the call that cannot be refused despite its price" },
    ],
  },
  {
    id: "knives_out_reveal",
    work: "Knives Out",
    scene_name: "The Will Reading",
    beat_id: "call_to_adventure",
    genre: "mystery",
    description:
      "A gathering of suspects reacts to shocking news that upends their expectations. Hidden motives surface instantly, and the real investigation begins.",
    character_slots: [
      { role: "Outsider Suspect", archetype: "hero", description: "An unlikely central figure suddenly thrust into the spotlight" },
      { role: "Eccentric Detective", archetype: "mentor", description: "Observes the reactions, already piecing together the truth" },
      { role: "Entitled Family Member", archetype: "shadow", description: "Masks hostility behind a veneer of civility" },
    ],
  },
  {
    id: "mockingbird_courthouse",
    work: "To Kill a Mockingbird",
    scene_name: "The Courthouse Defense",
    beat_id: "the_ordeal",
    genre: "literary",
    description:
      "A principled figure stands against the prejudice of an entire community to defend an innocent person. The moral argument is won but the social battle is lost, exposing systemic injustice.",
    character_slots: [
      { role: "Moral Authority", archetype: "mentor", description: "Fights for justice knowing the system is rigged against them" },
      { role: "Young Observer", archetype: "hero", description: "Watches innocence collide with injustice, permanently changed" },
      { role: "Wrongly Accused", archetype: "ally", description: "Dignified in the face of dehumanization, embodies the stakes" },
    ],
  },
  {
    id: "lady_bird_car_argument",
    work: "Lady Bird",
    scene_name: "The Car Argument",
    beat_id: "ordinary_world",
    genre: "coming_of_age",
    description:
      "A parent and child clash over identity and ambition in a confined space. Love and resentment are inseparable, establishing the central tension of growing apart to grow up.",
    character_slots: [
      { role: "Restless Teenager", archetype: "hero", description: "Desperate to become someone new, rejecting where they come from" },
      { role: "Practical Parent", archetype: "guardian", description: "Expresses love through criticism, fears losing their child" },
    ],
  },
];
