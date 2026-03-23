export const soriMotion = {
  inkSettle: {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },
  cardLift: {
    whileHover: { y: -2 },
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

export const multiverseMotion = {
  nodePopIn: {
    initial: { opacity: 0, scale: 0.92 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 22,
      mass: 0.8,
    },
  },

  inkFlow: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: 0.45,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },

  choiceHover: {
    whileHover: { y: -2 },
    whileTap: { scale: 0.98 },
    transition: {
      type: "spring" as const,
      stiffness: 260,
      damping: 20,
      mass: 0.85,
    },
  },

  branchDraw: {
    initial: { pathLength: 0, opacity: 0 },
    animate: { pathLength: 1, opacity: 1 },
    transition: {
      pathLength: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
      opacity: { duration: 0.15 },
    },
  },

  paradoxPulse: {
    animate: {
      boxShadow: [
        "0 0 0 0 rgba(200, 99, 90, 0)",
        "0 0 0 3px rgba(200, 99, 90, 0.2)",
        "0 0 0 0 rgba(200, 99, 90, 0)",
      ],
    },
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut" as const,
    },
  },

  canonCommit: {
    animate: {
      boxShadow: [
        "0 0 0 0 rgba(200, 99, 90, 0)",
        "0 0 12px 4px rgba(200, 99, 90, 0.25)",
        "0 0 0 0 rgba(200, 99, 90, 0)",
      ],
    },
    transition: {
      duration: 1.2,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },

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
