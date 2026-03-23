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
