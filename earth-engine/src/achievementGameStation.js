/** Canonical coordinates inside the glass globe; no text texture or new material. */
export const ACHIEVEMENT_GAME_STATION = Object.freeze([0,9.0,-6.7]);
export function buildAchievementGameStation(p) {
  p.box('dark',[0,8.08,-6.7],[1.65,1.76,.7],[.08,0,0]);
  p.box('metal',[0,8.95,-6.7],[1.9,.18,1.06],[-.16,0,0]);
  p.box('signal',[0,9.1,-6.7],[1.55,.05,.77],[-.16,0,0]);
  p.box('gold',[0,9.12,-6.23],[1.9,.16,.08]);
  p.box('paper',[-.69,9.16,-6.7],[.10,.10,.62],[-.16,0,0]);
  p.box('paper',[.69,9.16,-6.7],[.10,.10,.62],[-.16,0,0]);
  return {position:ACHIEVEMENT_GAME_STATION,illustrative:true,triangles:72};
}
