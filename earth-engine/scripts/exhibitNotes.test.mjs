import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {contestsAndActivities} from '../src/data/contestsAndActivities.js';

// Test-only provenance: exact original source fragments supporting every curated
// bullet, plus immutable pre-note hashes. It is never bundled into the website.
const evidence=JSON.parse(readFileSync(new URL('./fixtures/exhibitNotesEvidence.json',import.meta.url),'utf8'));
const source=readFileSync(new URL('../../src/data/contestsAndActivities.js',import.meta.url),'utf8');
const mirror=readFileSync(new URL('../src/data/contestsAndActivities.js',import.meta.url),'utf8');
const sha256=value=>createHash('sha256').update(value).digest('hex');
const plain=value=>value.replace(/[^\p{L}\p{N}]+/gu,' ').trim().toLowerCase();
const fields=new Set(['shortDescription','longDescription','technologies']);

test('all 32 portfolio projects have short, explicit itemized exhibit notes',()=>{
  assert.equal(contestsAndActivities.length,32);
  assert.deepEqual(Object.keys(evidence.projects),contestsAndActivities.map(project=>project.slug));
  let total=0;
  for(const project of contestsAndActivities){
    const {exhibitNotes}=project;
    assert.ok(exhibitNotes&&typeof exhibitNotes==='object',`${project.slug}: missing notes`);
    assert.deepEqual(Object.keys(exhibitNotes),['overview','details']);
    for(const [panel,items] of Object.entries(exhibitNotes)){
      assert.ok(Array.isArray(items),`${project.slug}: ${panel} must be a list`);
      assert.ok(items.length>=2&&items.length<=12,`${project.slug}: ${panel} needs 2–12 items`);
      for(const item of items){
        assert.equal(typeof item,'string');
        assert.equal(item,item.trim(),`${project.slug}: stray whitespace`);
        assert.ok(item.length>=20&&item.length<=120,`${project.slug}: item must remain concise: ${item}`);
        assert.ok(!/[\r\n\t<>]|https?:\/\/|\{\{|gdrive_embed|\]\(|^[•*-]\s/.test(item),`${project.slug}: plain text only`);
        total++;
      }
    }
  }
  assert.equal(total,346,'every curated note must remain covered by its evidence fixture');
});

test('every monitor bullet has exact evidence in its own unchanged source account',()=>{
  for(const project of contestsAndActivities){
    for(const panel of ['overview','details']){
      const audited=evidence.projects[project.slug][panel];
      assert.deepEqual(project.exhibitNotes[panel],audited.map(item=>item.text),`${project.slug}: ${panel} evidence must follow live notes`);
      for(const item of audited){
        assert.ok(item.evidence.length>=1,`${project.slug}: unsupported item ${item.text}`);
        for(const {field,quote} of item.evidence){
          assert.ok(fields.has(field),`${project.slug}: evidence must be original prose or technologies`);
          assert.ok(typeof quote==='string'&&quote.length>=(field==='technologies'?2:3),`${project.slug}: meaningful exact source quote required`);
          const original=project[field];
          assert.ok(Array.isArray(original)?original.includes(quote):original.includes(quote),`${project.slug}: source no longer supports ${item.text}: ${quote}`);
        }
      }
    }
  }
});

test('notes are complementary facts rather than repeated titles, awards or summary paragraphs',()=>{
  for(const project of contestsAndActivities){
    const items=[...project.exhibitNotes.overview,...project.exhibitNotes.details];
    const normalized=items.map(plain);
    assert.equal(new Set(normalized).size,normalized.length,`${project.slug}: duplicate facts on both monitors`);
    for(const item of items){
      assert.ok(!plain(item).includes(plain(project.title)),`${project.slug}: monitor repeats project title`);
      assert.notEqual(plain(item),plain(project.shortDescription),`${project.slug}: copied summary sentence`);
      assert.ok(!/\b(?:1st|2nd|3rd|first place|second place|third place|honorable mention|audience award)\b/i.test(item),`${project.slug}: award already appears in navigator and popup`);
      assert.ok(!/\b(?:20\d{2})\b/.test(item),`${project.slug}: event year already appears in navigator`);
    }
    assert.notEqual(items.join(' '),project.shortDescription,`${project.slug}: summary paragraph simply split into a list`);
  }
});

test('new source notes preserve every original project field and both data mirrors byte for byte',()=>{
  assert.equal(source,mirror,'portfolio and earth-engine must share byte-identical source data');
  assert.deepEqual(Object.keys(evidence.originalProjectHashes),contestsAndActivities.map(project=>project.slug));
  for(const project of contestsAndActivities){
    const {exhibitNotes,...original}=project;
    assert.equal(sha256(JSON.stringify(original)),evidence.originalProjectHashes[project.slug],`${project.slug}: an original title, explanation, media, link or map field changed`);
  }
  const addedBlocks=/    \/\/ Concise monitor notes, grounded in the full account below\.\n    exhibitNotes: \{\n      overview: \[\n(?:        .*\n)+      \],\n      details: \[\n(?:        .*\n)+      \],\n    \},\n/g;
  assert.equal([...source.matchAll(addedBlocks)].length,32,'only explicit new field insertions are expected');
  assert.equal(sha256(source.replace(addedBlocks,'')),evidence.sourceBytesSha256,'all pre-existing source text must remain byte-identical');
});

test('Tesla notes disclose public logistics, teamwork and NDA facts without inventing a factory solution',()=>{
  const tesla=contestsAndActivities.find(project=>project.slug==='tesla-gigathon-2026');
  assert.deepEqual({overview:tesla.exhibitNotes.overview.slice(0,3),details:tesla.exhibitNotes.details.slice(0,3)},{
    overview:[
      'Supply-chain and logistics challenge',
      'Real Tesla data supplied for the competition',
      'Data analytics in a manufacturing context',
    ],
    details:[
      'Newly formed team; first-time collaborators',
      'Technical details protected by comprehensive NDAs',
      'Factory photography was not permitted',
    ],
  });
  assert.ok(!/forklift|conveyor|scanner|algorithm|deployed|factory layout/i.test([...tesla.exhibitNotes.overview,...tesla.exhibitNotes.details].join(' ')),'the illustrative model is not evidence of a confidential implemented process');
});

test('mentor, clinical and prototype notes retain attribution and limitations',()=>{
  const find=slug=>contestsAndActivities.find(project=>project.slug===slug).exhibitNotes;
  const nasa=[...find('nasa-space-apps-zurich-2025').overview,...find('nasa-space-apps-zurich-2025').details].join(' ');
  assert.ok(/Helped teams/.test(nasa)&&/Advised participants/.test(nasa));
  assert.ok(!/built (?:a )?satellite|launched|spacecraft/i.test(nasa),'API mentoring is not a spacecraft construction claim');
  const jury=find('decarbon-days-climathon-2025').details.join(' ');
  assert.ok(jury.includes("Winning team's proposal"),'winning team owns the displayed energy-management solution');
  assert.ok(jury.includes('proposed balancing'),'the demonstration is not an actual factory deployment claim');
  const health=find('hong-kong-talent-engage-eurotech-healthtech-2026').overview.join(' ');
  assert.ok(/Arranged online calls/.test(health),'booked consultations must not become claims of completed consultations');
  assert.ok(!/diagnos|clinical validation|accuracy|approved|certified/i.test(health),'no unprovided medical validation claim');
  const draeger=find('draeger-2023').details.join(' ');
  assert.ok(draeger.includes('without GPU access')&&draeger.includes('not completed'));
  assert.ok(find('ethrome-2025').details.includes('Proof of concept; not a mainnet deployment'));
  assert.ok(find('solana-ideathon-2024').details.every(item=>/Proposed|could/.test(item)),'conceptual liquidity and oracle features stay explicitly proposed');
});


test('expanded notes retain the previous 183 facts without filling brief accounts to an arbitrary quota',()=>{
  let oldItems=0,oldChars=0,currentItems=0,currentChars=0;
  for(const project of contestsAndActivities){
    const counts=evidence.previousNoteCounts[project.slug];
    const previous={overview:project.exhibitNotes.overview.slice(0,counts.overview),details:project.exhibitNotes.details.slice(0,counts.details)};
    assert.equal(sha256(JSON.stringify(previous)),evidence.previousNoteHashes[project.slug],`${project.slug}: previous concise facts must not be lost`);
    const old=[...previous.overview,...previous.details],current=[...project.exhibitNotes.overview,...project.exhibitNotes.details];
    oldItems+=old.length;oldChars+=old.join('').length;currentItems+=current.length;currentChars+=current.join('').length;
  }
  assert.deepEqual({items:oldItems,characters:oldChars},evidence.previousNoteTotals);
  assert.equal(oldItems,183);assert.equal(oldChars,9307);
  assert.equal(currentItems,346);assert.ok(currentChars>oldChars*2,'supported explanatory content must more than double');
  for(const slug of ['hong-kong-talent-engage-eurotech-healthtech-2026','music-ai-osaka-2025','draeger-2023']){
    const notes=contestsAndActivities.find(project=>project.slug===slug).exhibitNotes;
    assert.equal(notes.overview.length,9);assert.equal(notes.details.length,9,'source-rich accounts have three times their prior notes');
  }
  const nasa=contestsAndActivities.find(project=>project.slug==='nasa-space-apps-zurich-2025').exhibitNotes;
  assert.equal(nasa.overview.length,2);assert.equal(nasa.details.length,2,'four specific mentor contributions are enough for the short original account');
});

test('deeper medical, deployment and algorithm notes keep source limitations explicit',()=>{
  const find=slug=>contestsAndActivities.find(project=>project.slug===slug).exhibitNotes;
  const draeger=[...find('draeger-2023').overview,...find('draeger-2023').details].join(' ');
  assert.ok(draeger.includes('Hackathon tests reported accuracies of 70–90%'));
  assert.ok(draeger.includes('partly corrected near the deadline')&&draeger.includes('did not finish all required'));
  assert.ok(!/clinical validation|diagnostic approval|certified|guaranteed accuracy/i.test(draeger));
  const mx=find('lauzhack-2024').details.join(' ');
  assert.ok(mx.includes('a goal, not a claimed longitudinal result'),'training intent must not become a measured learning outcome');
  const grid=find('thuega-2024').details.join(' ');
  assert.ok(grid.includes('Azure containers'),'authored Azure deployment is used rather than conflicting AWS technology metadata');
  assert.ok(grid.includes('ADMM was considered, not implemented'));
  const music=find('music-ai-osaka-2025').details.join(' ');
  assert.ok(music.includes('recalibration was not completed'));
});
