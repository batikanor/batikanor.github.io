import { contestsAndActivities } from "../../data/contestsAndActivities";

export const PROJECT_SITES = contestsAndActivities.map((project, index) => {
  const laneWidth = 10 + (index % 4) * 2.4;
  return {
    project,
    index,
    x: Math.sin(index * 1.08) * laneWidth,
    z: -14 - index * 10.5,
  };
});

export const PROJECT_COUNT = PROJECT_SITES.length;
