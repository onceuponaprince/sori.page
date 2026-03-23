export const soriMotion = {
  inkSettle: {
    initial: { opacity: 0, y: 14, filter: "blur(10px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    transition: {
      duration: 0.7,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },
  cardLift: {
    whileHover: { y: -4, rotate: -0.35, scale: 1.01 },
    transition: {
      type: "spring" as const,
      stiffness: 240,
      damping: 24,
      mass: 0.9,
    },
  },
  stagger: {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.06,
      },
    },
  },
};


// ============================================================
// MULTIVERSE SCENE TESTER — Animation presets
// ============================================================
//
// These presets are tuned for the Multiverse Sidebar. The aesthetic
// goal is "branching paths materializing" — nodes pop in from nothing
// with a slight scale overshoot, and connecting lines draw themselves.

/**
 * Node pop-in animation for the multiverse tree.
 *
 * Each tree node scales up from 0 with a spring overshoot,
 * creating a "materializing" feel. The blur starts heavy and
 * clears quickly so the node feels like it's coming into focus.
 *
 * Usage: <motion.div {...multiverseMotion.nodePopIn}>
 */
export const multiverseMotion = {
  nodePopIn: {
    initial: { opacity: 0, scale: 0.6, filter: "blur(8px)" },
    animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
    exit: { opacity: 0, scale: 0.85, filter: "blur(4px)" },
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 22,
      mass: 0.8,
    },
  },

  /**
   * Dialogue line reveal — the "ink flow" effect for Oracle chat.
   *
   * Each line of dialogue slides up from below with a slight blur,
   * mimicking ink appearing on parchment. The transition is slower
   * than nodePopIn to give the writer time to read each turn.
   *
   * Usage: <motion.div {...multiverseMotion.inkFlow}>
   */
  inkFlow: {
    initial: { opacity: 0, y: 12, filter: "blur(6px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    transition: {
      duration: 0.55,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },

  /**
   * Choice card hover — lifts and rotates slightly to invite clicking.
   *
   * More dramatic than the standard cardLift because these choices
   * are the primary interaction point in the multiverse sidebar.
   */
  choiceHover: {
    whileHover: { y: -6, rotate: -0.5, scale: 1.03 },
    whileTap: { scale: 0.97 },
    transition: {
      type: "spring" as const,
      stiffness: 260,
      damping: 20,
      mass: 0.85,
    },
  },

  /**
   * Branch line draw — animates the connecting line between nodes.
   *
   * Uses pathLength for SVG line animation. The line "draws itself"
   * from parent to child over 0.4 seconds.
   *
   * Usage: <motion.path {...multiverseMotion.branchDraw} d="M..." />
   */
  branchDraw: {
    initial: { pathLength: 0, opacity: 0 },
    animate: { pathLength: 1, opacity: 1 },
    transition: {
      pathLength: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
      opacity: { duration: 0.15 },
    },
  },

  /**
   * Paradox pulse — red glow animation for knowledge violations.
   *
   * When the Truth Guard detects a paradox, the affected dialogue
   * turn pulses with a red border to draw the writer's attention.
   */
  paradoxPulse: {
    animate: {
      boxShadow: [
        "0 0 0 0 rgba(220, 38, 38, 0)",
        "0 0 0 4px rgba(220, 38, 38, 0.25)",
        "0 0 0 0 rgba(220, 38, 38, 0)",
      ],
    },
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut" as const,
    },
  },

  /**
   * Canon commit celebration — the node glows gold briefly.
   *
   * Played once when the writer clicks "Commit to Story" and the
   * branch becomes part of the canonical narrative.
   */
  canonCommit: {
    animate: {
      boxShadow: [
        "0 0 0 0 rgba(217, 175, 87, 0)",
        "0 0 20px 8px rgba(217, 175, 87, 0.35)",
        "0 0 0 0 rgba(217, 175, 87, 0)",
      ],
      scale: [1, 1.04, 1],
    },
    transition: {
      duration: 1.2,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },

  /**
   * Staggered children — container variant for the tree node list.
   *
   * Wraps the tree nodes so each one appears slightly after the
   * previous one, creating a cascading reveal effect.
   */
  treeStagger: {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
        delayChildren: 0.1,
      },
    },
  },

  /**
   * Sidebar panel slide-in from the right edge.
   *
   * The multiverse sidebar slides in from off-screen when opened
   * and slides back out when closed.
   */
  sidebarSlide: {
    initial: { x: "100%", opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: "100%", opacity: 0 },
    transition: {
      type: "spring" as const,
      stiffness: 200,
      damping: 28,
      mass: 1,
    },
  },
};
