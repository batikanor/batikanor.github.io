/** These describe the illustrative game, never the source project's work. */
export const EXHIBIT_GAME_AI_DISCLAIMER='This is just an AI-generated game. It does not represent anything Batıkan did at this event.';

const controls='WASD move, R reset';
const rules=(action,method,goal)=>Object.freeze([action,method,goal,controls]);
const gameRules={
  'tesla-gigathon-2026':rules('Click each pallet.','Then its color bay','Deliver all three.'),
  'hong-kong-talent-engage-eurotech-healthtech-2026':rules('Click each optic.','Align both arrows','Light the receiver'),
  'decarbon-days-climathon-2026':rules('Click a gold orb.','Then a tree.','Match ring counts'),
  'pdm-kill-the-search-bar-2026':rules('Click a record.','Then matching mark','Match all six.'),
  'zero-one-hack-supercompute-industrial-2026':rules('Click a chip part.','Then glowing slot','Build all six.'),
  'huawei-tech-arena-finland-2025':rules('Click a map tile.','Click again: turn','Then matching slot'),
  'real-coin-map-2025':rules('Click a coin.','Then its mint mark','Match all six.'),
  'ethrome-2025':rules('Click a gift.','Then glowing slot','Place all three.'),
  'nasa-space-apps-zurich-2025':rules('Click rail arrows','Route Earth data.','Visit all 5 nodes'),
  'sui-hackathon-poland-2025':rules('Click a block.','Then glowing slot','Join all six.'),
  'decarbon-days-climathon-2025':rules('Click a machine.','Cycle its charge.','Match load rings.'),
  'music-ai-osaka-2025':rules('Click lit rings.','Trace every ring.','Stay in order.'),
  'european-defense-tech-2025-munich':rules('Click each optic.','Align both arrows','Light the receiver'),
  'tech-berlin-ai-hackathon-2':rules('Click rail arrows','Route the context','Visit all 5 nodes'),
  'huawei-agorize-2024':rules('Click each camera','Align both arrows','Light the receiver'),
  'masters-thesis':rules('Click lit gates.','Dodge the blocks.','Cross all four.'),
  'lauzhack-2024':rules('Click lit rings.','Write their path.','Visit all seven.'),
  'salzburg-tourism-2024':rules('Click rail arrows','Route the signal.','Visit all 5 nodes'),
  'zurich-climathon-2024':rules('Click a droplet.','Then a tree.','Match ring counts'),
  'bayer-ai-2024':rules('Click a lab piece','Then matching mark','Sort all six.'),
  'dsag-ideathon-2024':rules('Click rail arrows','Link the records.','Visit all 5 nodes'),
  'circular-bsh-2024':rules('Click a loose part','Then glowing slot','Rebuild all six.'),
  'thuega-2024':rules('Click power parts','Cycle their charge','Match load rings.'),
  'solana-ideathon-2024':rules('Click a crystal.','Then a pan.','Match ring counts'),
  'six-swisshacks-2024':rules('Click report parts','Then glowing slot','Build all six.'),
  'hackupc-2024':rules('Click lit rings.','Fly through six.','Stay in order.'),
  'mdsi-bundesliga-2024':rules('Click lit gates.','Dodge the players','Cross all five.'),
  'draeger-2023':rules('Click lit rings.','Guide the signal','Cross all three.'),
  'ethmunich-2023':rules('Click a sculpture','Then matching mark','Match all six.'),
  'msg-karlsruhe-2023':rules('Click each tree.','Then its color bay','Deliver all three.'),
  'bachelors-thesis':rules('Click a cat.','Then matching mark','Match all six cats'),
  'tgu-perfect-gpa':rules('Click a book.','Then a study bay','Match ring counts'),
};

const notice=Object.freeze({kind:'notice',title:'',lines:Object.freeze([
  'This is just an','AI-generated game.','It does not','represent anything','Batıkan did at','this event.',
]),text:EXHIBIT_GAME_AI_DISCLAIMER});

export const EXHIBIT_GAME_SIGN_CONTENT=Object.freeze(Object.fromEntries(Object.entries(gameRules).map(([slug,lines])=>{
  return [slug,Object.freeze({slug,panels:Object.freeze([
    Object.freeze({kind:'rules',title:'Game rules',lines,text:lines.join(' ')}),notice,
  ])})];
})));

/** Two passive physical signs; unknown slugs do not inherit object properties. */
export function getExhibitGameSignContent(slug){
  return typeof slug==='string'&&Object.hasOwn(EXHIBIT_GAME_SIGN_CONTENT,slug)?EXHIBIT_GAME_SIGN_CONTENT[slug]:null;
}
