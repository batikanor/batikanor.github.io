const platform = (x, y, z, width, depth, extra = {}) => ({
  position: [x, y, z],
  size: [width, 0.6, depth],
  ...extra,
});

const pad = (x, y, z) => [x, y, z];

export const COURSE_BLUEPRINTS = [
  {
    instruction: "Walk onto the cyan signal",
    spawn: [0, 0.78, 4.5],
    platforms: [platform(0, -0.3, 0, 10, 14)],
    goals: [pad(0, 0.08, -4)],
  },
  {
    instruction: "Wake every signal",
    spawn: [0, 0.78, 5],
    platforms: [platform(0, -0.3, 0, 12, 15)],
    goals: [pad(-3.4, 0.08, -3.6), pad(0, 0.08, -5), pad(3.4, 0.08, -3.6)],
    finish: pad(0, 0.08, 1.8),
  },
  {
    instruction: "Red light means reset",
    spawn: [0, 0.78, 5],
    platforms: [platform(0, -0.3, 0, 12, 15)],
    goals: [pad(0, 0.08, -5.2)],
    hazards: [pad(-2.1, 0.08, 0.2), pad(0, 0.08, -1.2), pad(2.1, 0.08, -2.5)],
  },
  {
    instruction: "SPACE / JUMP clears the gaps",
    spawn: [0, 0.78, 4.4],
    platforms: [
      platform(0, -0.3, 3.4, 6, 5),
      platform(-1.7, 0.25, -0.4, 3.2, 2.4),
      platform(1.5, 0.9, -3.2, 3, 2.2),
      platform(0, 1.55, -6.2, 4, 2.7),
    ],
    goals: [pad(0, 1.93, -6.2)],
  },
  {
    instruction: "Momentum breaks resistance",
    spawn: [0, 0.78, 5],
    platforms: [platform(0, -0.3, 0, 12, 16)],
    goals: [pad(0, 0.08, -5.8)],
    crates: Array.from({ length: 15 }, (_, index) => [
      (index % 5 - 2) * 0.92,
      0.5 + Math.floor(index / 5) * 0.92,
      -1.8,
    ]),
  },
  {
    instruction: "Follow the thin line",
    spawn: [0, 0.78, 4.8],
    platforms: [
      platform(0, -0.3, 4, 5, 4),
      platform(-2.8, 0.1, 0.8, 1.5, 4),
      platform(1.8, 0.55, -2.2, 1.5, 4),
      platform(-1.5, 1.05, -5.2, 1.5, 3.4),
      platform(0, 1.45, -7.7, 3, 2),
    ],
    goals: [pad(0, 1.83, -7.7)],
  },
  {
    instruction: "Hold SHIFT / SPRINT and commit",
    spawn: [0, 0.78, 5],
    platforms: [
      platform(0, -0.3, 4, 6, 4),
      platform(0, 0.2, -1.2, 2.2, 2.2),
      platform(0, 0.7, -6.6, 4, 3),
    ],
    goals: [pad(0, 1.08, -6.6)],
  },
  {
    instruction: "The course is moving now",
    spawn: [0, 0.78, 4.4],
    platforms: [
      platform(0, -0.3, 3.8, 6, 4),
      platform(-2.8, 0.2, 0, 2.4, 2.4, { motion: { axis: "x", range: 2.2, speed: 0.9 } }),
      platform(2.5, 0.75, -3.6, 2.4, 2.4, { motion: { axis: "z", range: 2, speed: 0.72, phase: 1.4 } }),
      platform(0, 1.35, -7, 4, 2.6),
    ],
    goals: [pad(0, 1.73, -7)],
  },
  {
    instruction: "Choose clean landings",
    spawn: [0, 0.78, 4.8],
    platforms: [platform(0, -0.3, 0, 11, 16)],
    goals: [pad(-3.6, 0.08, -5.6), pad(3.6, 0.08, -5.6)],
    hazards: [
      pad(-3.6, 0.08, 0), pad(0, 0.08, -1.8), pad(3.6, 0.08, -3.5),
      pad(0, 0.08, -5.2),
    ],
    finish: pad(0, 0.08, 3.4),
  },
  {
    instruction: "Order emerges through exploration",
    spawn: [0, 0.78, 4],
    platforms: [
      platform(0, -0.3, 3.5, 5, 4),
      platform(-5, 0.3, -0.5, 4, 4),
      platform(5, 0.7, -2.5, 4, 4),
      platform(0, 1.2, -7, 4, 4),
      platform(0, 0.15, -2.2, 1.4, 7),
    ],
    goals: [pad(-5, 0.68, -0.5), pad(5, 1.08, -2.5), pad(0, 1.58, -7)],
    finish: pad(0, 0.08, 2.8),
  },
  {
    instruction: "Say PARKOUR if it helps",
    spawn: [0, 0.78, 4.5],
    platforms: [
      platform(0, -0.3, 4, 5, 4),
      ...Array.from({ length: 7 }, (_, index) =>
        platform(
          (index % 2 ? 1 : -1) * 2.2,
          0.3 + index * 0.58,
          0.8 - index * 1.65,
          2.1,
          1.65,
        ),
      ),
      platform(0, 4.25, -10.2, 4, 2.5),
    ],
    goals: [pad(0, 4.63, -10.2)],
  },
  {
    instruction: "Precision beats speed",
    spawn: [0, 0.78, 4.6],
    platforms: [
      platform(0, -0.3, 4, 5, 4),
      platform(-2.7, 0.5, 0.5, 1.5, 1.5, { motion: { axis: "x", range: 1.5, speed: 0.55 } }),
      platform(2.4, 1.05, -2.6, 1.35, 1.35, { motion: { axis: "z", range: 1.4, speed: 0.62 } }),
      platform(-1.8, 1.7, -5.5, 1.2, 1.2, { motion: { axis: "x", range: 1.2, speed: 0.48, phase: 2 } }),
      platform(0, 2.35, -8, 3.2, 2),
    ],
    goals: [pad(0, 2.73, -8)],
    finish: pad(0, 0.08, 3.2),
  },
];

const quizStage = (question, answers) => ({
  instruction: question,
  spawn: [0, 0.78, 5.2],
  platforms: [platform(0, -0.3, 0, 13, 15)],
  goals: answers.map((answer) => pad(answer.x, 0.08, -4.2)),
  answers,
});

export const BATIKAN_QUIZ_BLUEPRINTS = [
  quizStage("What did Batikan's Hong Kong-winning project estimate?", [
    { label: "HEMOGLOBIN", x: -3.7, correct: true },
    { label: "HEART RATE", x: 0, correct: false },
    { label: "BLOOD PRESSURE", x: 3.7, correct: false },
  ]),
  quizStage("Which signal powered Batikan's tourism recommender?", [
    { label: "GPS", x: -3.7, correct: false },
    { label: "EEG", x: 0, correct: true },
    { label: "LIDAR", x: 3.7, correct: false },
  ]),
  quizStage("Which city awarded Batikan 7000 CHF?", [
    { label: "BERLIN", x: -3.7, correct: false },
    { label: "ZURICH", x: 0, correct: true },
    { label: "MUNICH", x: 3.7, correct: false },
  ]),
  quizStage("Where did Batikan win an Open Source distinction?", [
    { label: "OSAKA", x: -3.7, correct: true },
    { label: "ROME", x: 0, correct: false },
    { label: "HELSINKI", x: 3.7, correct: false },
  ]),
  {
    ...quizStage("What does Batikan's Gralobe transition between?", [
      { label: "2D AND 3D MAPS", x: -3.7, correct: true },
      { label: "AUDIO TRACKS", x: 0, correct: false },
      { label: "DATABASES", x: 3.7, correct: false },
    ]),
    finish: pad(0, 0.08, 1.8),
  },
];

export const GAME_MODES = {
  course: {
    label: "Signal Course",
    shortLabel: "Course",
    description: "Twelve movement and activation challenges.",
    stages: COURSE_BLUEPRINTS,
  },
  batikan: {
    label: "Batikan Quiz",
    shortLabel: "Batikan Quiz",
    description: "Run through Batikan's projects and achievements.",
    stages: BATIKAN_QUIZ_BLUEPRINTS,
  },
};
