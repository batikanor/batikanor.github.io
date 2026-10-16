import {getProject, projectHref, projectMedia} from './projectContent.js';
import {galleryPhotoSource} from './galleryRoomMediaDimensions.js';
import {roomDockRectangle, roomSafeArea, roomCameraFov, surfaceCameraPlan} from './galleryRoomCamera.js';

const placeholder = /\{\{(image|embed|gdrive_embed)\[(\d+)\]\}\}/g;
const markdownLink = /(?<!!)\[([^\]]+)\]\(([^)]+)\)/g;
const portfolioOrigin = 'https://batikanor.com/';

function normalizedLink(rawHref) {
  const href = projectHref(rawHref, portfolioOrigin);
  if (!href) return null;
  try { return new URL(href, portfolioOrigin).href; } catch { return null; }
}

/** Original sources keep their authored order, captions and credits. */
export function galleryStationMedia(project) {
  const source = getProject(project?.slug) || project;
  const groups = projectMedia(source), records = [], used = new Set();
  const add = (kind, index) => {
    const entry = (kind === 'image' ? groups.images : groups.embeds)[index];
    const media = typeof entry === 'string' ? {url: entry} : entry;
    const key = `${kind}:${index}`;
    if (!media?.url || used.has(key)) return;
    used.add(key);
    records.push({...media, kind, index, key});
  };
  for (const match of (source?.longDescription || '').matchAll(placeholder)) {
    add(match[1] === 'image' ? 'image' : 'embed', Number(match[2]));
  }
  groups.images.forEach((_, index) => add('image', index));
  groups.embeds.forEach((_, index) => add('embed', index));
  return records;
}

/** Preserve the complete authored References collection, including repository actions. */
export function galleryStationLinks(project) {
  const source = getProject(project?.slug) || project;
  const links = (source?.links || []).map(link => ({...link}));
  if (source?.githubRepo) {
    const repository = `https://github.com/${source.githubRepo}`;
    links.push({label: 'Star on GitHub ↗', url: repository},
      {label: 'Watch on GitHub ↗', url: `${repository}/watchers`});
  }
  const used = new Set(links.map(link => normalizedLink(link.url)).filter(Boolean));
  for (const match of (source?.longDescription || '').matchAll(markdownLink)) {
    const href = normalizedLink(match[2]);
    if (!href || used.has(href)) continue;
    used.add(href);
    const label = match[1].replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1');
    links.push({label, url: match[2]});
  }
  return links;
}

// DM Sans Regular (weight 400), extracted with FreeType FT_Get_Advance and
// FT_LOAD_NO_SCALE from the shipped Latin/LatinExt WOFF2 files. Their head table
// uses 1000 units/em. These are the same fonts used by --portfolio-font-body;
// changing that font requires regenerating this table, not reusing Arial widths.
// The artifact hashes are checked by the layout tests to make upgrades explicit.
export const GALLERY_REFERENCE_FONT_METRICS = Object.freeze({
  family: 'DM Sans', weight: 400, unitsPerEm: 1000,
  files: Object.freeze({
    'DM-Sans-Latin-wght.woff2': '9fea608a947e67020c33cad9a6fe3d60c54119dfb8cff87768a8117a15ed7543',
    'DM-Sans-LatinExt-wght.woff2': 'a5d38fe99f930275684999b462c7123faa063d9e44e73b4b241723d884aa0f49',
  }),
});
// ASCII 32–126, followed by authored non-ASCII letters and common punctuation.
const REFERENCE_ADVANCES = [266,250,291,804,580,786,734,159,373,373,480,550,182,541,198,392,
  684,312,576,591,607,610,628,534,608,628,202,227,550,550,550,524,1005,664,603,717,688,565,
  535,758,681,234,501,584,527,841,691,774,580,774,594,580,561,655,669,968,603,580,541,314,
  392,314,622,660,213,544,626,572,627,568,340,558,575,240,243,504,223,891,574,593,626,627,
  370,502,392,573,527,763,496,556,458,427,234,427,550];
const REFERENCE_UNICODE_ADVANCES = {'ß':659,'ä':544,'é':568,'ü':573,'ğ':558,'ı':223,'ş':502,
  '—':873,'–':669,'‘':210,'’':210,'“':367,'”':367,'…':566,'•':360,'·':198,
  '€':771,'™':772,'©':794,'®':504,
  // ↗ is supplied by the system fallback, rather than either DM Sans subset.
  // Retain its existing .75em allocation and the separately measured .4em gap.
  '↗':750};
const referenceWidthCache=new Map();
function referenceTextWidth(text,fontSize) {
  text=String(text);
  if(referenceWidthCache.has(text))return fontSize*(referenceWidthCache.get(text)/1000+.03);
  let advance=0;
  for(const character of text){
    if(/\p{Mark}/u.test(character))continue;
    const code=character.codePointAt(0);
    advance+=REFERENCE_ADVANCES[code-32]??REFERENCE_UNICODE_ADVANCES[character]??
      [...character.normalize('NFD')].reduce((sum,part)=>sum+(/\p{Mark}/u.test(part)?0:
        REFERENCE_ADVANCES[part.codePointAt(0)-32]??1000),0);
  }
  if(referenceWidthCache.size>=4096)referenceWidthCache.delete(referenceWidthCache.keys().next().value);
  referenceWidthCache.set(text,advance);
  // Advance sums omit negative kerning; the small rounding cushion also keeps
  // fractional browser rasterization from gaining a clipped final line.
  return fontSize*(advance/1000+.03);
}

/** The real References grid, including wrapped labels, arrow and fixed chrome. */
export function galleryReferencesMetrics(links,width,{focused=false,phone=false,measureText=referenceTextWidth}={}) {
  const fontSize=phone?focused?9:8.5:focused?16:14,lineHeight=fontSize*1.35;
  const innerWidth=Math.max(1,width-(phone?14:22)),columnGap=phone?8:16;
  const possibleColumns=Math.max(1,Math.floor((innerWidth+columnGap+1e-8)/(180+columnGap)));
  const columns=Math.min(possibleColumns,Math.max(1,links.length));
  const columnWidth=Math.max(1,(innerWidth-columnGap*(columns-1))/columns);
  const measure=text=>measureText(String(text),fontSize);
  const lineCounts=links.map(link=>{
    let lines=1,current='';
    for(const word of String(link?.label??'').trim().split(/\s+/u).filter(Boolean)){
      const candidate=current?`${current} ${word}`:word;
      if(measure(candidate)<=columnWidth){current=candidate;continue;}
      if(current){lines++;current='';}
      for(const character of word){
        if(current&&measure(current+character)>columnWidth){lines++;current='';}
        current+=character;
      }
    }
    if(measure(current)+measure('↗')+fontSize*.4>columnWidth)lines++;
    return lines;
  });
  const rowLines=[];
  for(let index=0;index<lineCounts.length;index+=columns)
    rowLines.push(Math.max(...lineCounts.slice(index,index+columns)));
  const rowHeights=rowLines.map(lines=>lines*lineHeight+(phone?4:8));
  const contentHeight=rowHeights.reduce((sum,value)=>sum+value,0)+Math.max(0,rowHeights.length-1)*(phone?2:3);
  const headerHeight=phone?19:focused?36.6:30.2,controlsHeight=phone?27:37;
  const chromeHeight=2+headerHeight+controlsHeight+(phone?8:14);
  return {columns,columnWidth,fontSize,lineHeight,lineCounts,rowLines,rowHeights,contentHeight,
    headerHeight,controlsHeight,chromeHeight,requiredHeight:Math.ceil(chromeHeight+contentHeight)};
}

const WALL_HEIGHT = 10.8;
const WALL_Z = -2.72;
const rectangle = (x, y, width, height) => ({x, y, width, height});
const area = rect => Math.max(0, rect.width) * Math.max(0, rect.height);
const right = rect => rect.x + rect.width;
const bottom = rect => rect.y + rect.height;
const intersects = (a, b) => a.x < right(b) - .01 && right(a) > b.x + .01 &&
  a.y < bottom(b) - .01 && bottom(a) > b.y + .01;

function viewportSize(viewport = {}) {
  return {width: Math.max(280, Number(viewport.width) || 1280),
    height: Math.max(240, Number(viewport.height) || 900), dockBounds: viewport.dockBounds, headerBounds: viewport.headerBounds};
}

function mediaInCells(media, region, columns, gap, phone) {
  if (!media.length) return [];
  const rows = Math.ceil(media.length / columns);
  const cellWidth = (region.width - gap * (columns - 1)) / columns;
  const cellHeight = (region.height - gap * (rows - 1)) / rows;
  if (cellWidth < 24 || cellHeight < 40) return null;
  return media.map((record, index) => {
    const cell = rectangle(region.x + (index % columns) * (cellWidth + gap),
      region.y + Math.floor(index / columns) * (cellHeight + gap), cellWidth, cellHeight);
    const source = galleryPhotoSource(record);
    if (!source) return {id: index ? `media-${index + 1}` : 'media', kind: 'media', media: record, rect: cell};
    const minimumImageHeight = Math.max(24,24*source.height/source.width);
    let chromeScale = Math.min(1, Math.max(.12, (cellHeight - minimumImageHeight) / (phone ? 64 : 80)), cellWidth / 150);
    let caption = (phone ? 36 : 48) * chromeScale, controls = (phone ? 28 : 32) * chromeScale;
    const width = Math.min(cellWidth, Math.max(12, cellHeight - caption - controls) * source.width / source.height);
    const imageHeight = width * source.height / source.width;
    if(imageHeight+caption+controls<40){
      chromeScale=Math.min(1,(40-imageHeight)/(phone?64:80));
      caption=(phone?36:48)*chromeScale;controls=(phone?28:32)*chromeScale;
    }
    const height = imageHeight + caption + controls;
    return {id: index ? `media-${index + 1}` : 'media', kind: 'media', media: record,
      photo: {...source, captionPixels: caption, controlsPixels: controls},
      rect: rectangle(cell.x + (cell.width - width) / 2, cell.y + (cell.height - height) / 2, width, height)};
  });
}

/** Choose the most useful native-aspect media grid for a given wall region. */
function mediaGrid(media, region, gap, phone) {
  let best = null, bestScore = -Infinity;
  if (!media.length) return [];
  for (let columns = 1; columns <= media.length; columns++) {
    const entries = mediaInCells(media, region, columns, gap, phone);
    if (!entries) continue;
    if(entries.some(entry=>entry.rect.width<24-1e-7||entry.rect.height<40-1e-7))continue;
    const score = entries.reduce((sum, entry) => {
      const imageHeight = entry.rect.height - (entry.photo?.captionPixels || 0) - (entry.photo?.controlsPixels || 0);
      const legibility = Math.min(1, entry.rect.width / (phone ? 100 : 150)) ** 2;
      return sum + entry.rect.width * imageHeight * legibility * (entry.id === 'media' ? 1.25 : 1);
    }, 0);
    if (score > bestScore) {best = entries; bestScore = score;}
  }
  return best;
}

/**
 * A pixel composition is mapped directly onto one front wall. Candidate layouts
 * use both the space above the globe and the taller space to its right; the
 * selected story/media balance varies with source count and intrinsic ratios.
 */
export function galleryStationPlan(project, viewport = {}) {
  project = getProject(project?.slug) || project;
  const {width, height, dockBounds, headerBounds} = viewportSize(viewport), phone = width < 700;
  const tablet = width <= 900;
  const short = height < 480;
  const headerInset = Math.max(Number(headerBounds?.left) || 0, width - (Number(headerBounds?.right) || width));
  const ordinaryHeaderInset = width < 360 ? 14 : phone ? 19 : width <= 900 ? 24 : 32;
  const margin = Math.max(phone ? 12 : width <= 900 ? 18 : 24, headerInset > ordinaryHeaderInset ? headerInset + 2 : 0);
  const gap = phone ? 10 : 14, scale = WALL_HEIGHT / height;
  const dock = roomDockRectangle(width, height, dockBounds);
  const focusedSafe = roomSafeArea(width, height, true, dockBounds, headerBounds);
  const header = phone ? Math.max(68, Number.isFinite(headerBounds?.bottom) ? headerBounds.bottom + 12 : 0) : focusedSafe.top;
  // The phone room has no footer actions or walking hint. Use the released
  // wall space instead of reserving an invisible lower-right rectangle.
  const hintHeight = phone ? 0 : short ? 42 : 104;
  const hintWidth = phone ? 0 : 180;
  const hint = rectangle(width - margin - hintWidth, height - margin - hintHeight, hintWidth, hintHeight);
  const titleX = dock.top < header + 85 ? Math.max(margin, dock.right + gap) : margin;
  const titleWidth = width - margin - titleX;
  const titleFont = phone ? project.title?.length > 90 ? 14 : 16 : tablet ? project.title?.length > 90 ? 22 : 26 : project.title?.length > 90 ? 24 : 30;
  const technologies = project.technologies || [], technologyFont = phone ? 9 : 13;
  const titleInnerWidth = Math.max(80, titleWidth - (phone ? 18 : 26));
  const technologyWidth = technologies.length ? phone ? titleInnerWidth : Math.min(280, titleWidth * .28) : 0;
  const titleTextWidth = Math.max(80, titleInnerWidth - (!phone && technologyWidth ? technologyWidth + 16 : 0));
  const titleLines = Math.max(1, Math.ceil((project.title?.length || 30) * titleFont * .53 / titleTextWidth));
  let technologyRows = 0, technologyRowWidth = 0;
  const technologyInnerWidth = Math.max(50, technologyWidth - (phone ? 12 : 22));
  const technologyColumnGap=phone?4:10,technologyRowGap=phone?2:4;
  for (const technology of technologies) {
    const tagWidth = [...technology].length * technologyFont * .56;
    if (!technologyRows || technologyRowWidth && technologyRowWidth + technologyColumnGap + tagWidth > technologyInnerWidth) {
      technologyRows++;technologyRowWidth = 0;
    }
    technologyRows += Math.max(0, Math.ceil(tagWidth / technologyInnerWidth) - 1);
    technologyRowWidth += (technologyRowWidth ? technologyColumnGap : 0) + Math.min(tagWidth, technologyInnerWidth);
  }
  const technologyHeight = technologyRows ? technologyRows * technologyFont * 1.35 + (technologyRows - 1) * technologyRowGap + (phone ? 8 : 18) : 0;
  // Word boundaries leave more unused line ends in the narrower column beside
  // technologies. Keep one line in reserve at those desktop/tablet widths.
  const wordWrapAllowance = !phone && titleTextWidth < 600 ? titleFont * 1.1 : 0;
  const copyHeight = titleLines * titleFont * 1.1 + (phone ? 3 : 4) + wordWrapAllowance;
  const titleContentHeight = phone ? copyHeight + (technologyHeight ? technologyHeight + 4 : 0)
    : Math.max(copyHeight, technologyHeight);
  const titleLayout = {technologiesStacked: phone, technologiesWidth: technologyWidth,
    technologyFont, technologyRows, titleTextWidth, requiredHeight: titleContentHeight + (phone ? 8 : 20)};
  const defaultTitleCap = phone&&height<=620?56:short ? Math.max(38, (height - header - margin) * .24) : height * .24;
  const narrowDesktop = width > 900 && width < 1100 && height >= 600;
  // Taller narrow-desktop copy can use the actual pre-dock space instead of a
  // 24% cap. Every title sharing the dock's horizontal lane stays above it.
  const preferredTitleCap = narrowDesktop ? titleX < dock.right
    ? Math.max(58, dock.top - gap - (header + 8)) : height * .3 : defaultTitleCap;
  const titleCap = titleX < dock.right
    ? Math.min(preferredTitleCap, Math.max(1, dock.top - gap - (header + 8))) : preferredTitleCap;
  const titleHeight = Math.min(titleCap, Math.max(phone ? 56 : 62, titleLayout.requiredHeight));
  const title = rectangle(titleX, header + 8, titleWidth, titleHeight);
  const startY = bottom(title) + gap, floor = height - margin;
  const upperBottom = Math.min(floor, dock.top - gap);
  const upper = rectangle(margin, startY, width - margin * 2, upperBottom - startY);
  const rightX = Math.max(margin, dock.right + gap);
  const rightRegion = rectangle(rightX, startY, width - margin - rightX, hint.y - gap - startY);
  const lower = rectangle(rightX, Math.max(startY, dock.top + gap), width - margin - rightX,
    hint.y - gap - Math.max(startY, dock.top + gap));
  const media = galleryStationMedia(project), links = galleryStationLinks(project), candidates = [];
  const readingWidth = Math.max(120,width-focusedSafe.left-focusedSafe.right)/1.09;
  const referenceReadingHeight = phone ? 100 : 130;
  const referencesMinRatio = (referenceReadingHeight+2)/readingWidth;
  const fitReadingPanel=(rect,minHeight,minWidth)=>{
    rect={...rect};
    if(rect.width<=0||rect.height<=0)return null;
    for(let attempt=0;attempt<6;attempt++){
      const worldWidth=rect.width*scale,worldHeight=rect.height*scale;
      const plan=surfaceCameraPlan({worldWidth,worldHeight,position:[0,5,-2.72],rotation:[0,0,0],framePadding:(phone?1.5:2)*scale},
        {width,height,dockBounds,headerBounds},roomCameraFov(width));
      const pixels=height/(2*Math.tan(roomCameraFov(width)*Math.PI/360)*plan.distance);
      const displayedWidth=worldWidth*pixels,displayedHeight=worldHeight*pixels;
      if(displayedHeight<minHeight){const nextWidth=rect.width*displayedHeight/minHeight*.995;rect.x+=(rect.width-nextWidth)/2;rect.width=nextWidth;continue;}
      if(displayedWidth<minWidth){rect.height*=displayedWidth/minWidth*.995;continue;}
      return rect;
    }
    return null;
  };
  const obstructions = [rectangle(0, 0, width, header),
    rectangle(dock.left, dock.top, dock.right - dock.left, dock.bottom - dock.top), ...(phone ? [] : [hint])];
  const add = (storyRect, mediaRect, referencesRect, providedScreens=null, compactReading=false) => {
    storyRect=fitReadingPanel(storyRect,100,140);
    if(!storyRect)return;
    if (storyRect.width < 35 || storyRect.height < (compactReading?54:84) ||
      (links.length && (!referencesRect || referencesRect.width < 40 || referencesRect.height < 42))) return;
    const screens = providedScreens??mediaGrid(media, mediaRect || rectangle(0, 0, 0, 0), gap, phone);
    if (!screens) return;
    if(screens.some(entry=>entry.rect.width<24-1e-7||entry.rect.height<40-1e-7))return;
    if(links.length){
      const available={...referencesRect};
      // A reading fit may narrow the board. Reflow its real grid at that width
      // and grow back into the available height instead of keeping the old cap.
      for(let attempt=0;attempt<8;attempt++){
        const required=galleryReferencesMetrics(links,referencesRect.width,{phone}).requiredHeight;
        referencesRect.height=Math.min(available.height,Math.max(referencesRect.width*referencesMinRatio,required));
        const fitted=fitReadingPanel(referencesRect,referenceReadingHeight,100);
        if(!fitted){referencesRect=null;break;}
        const narrowed=fitted.width<referencesRect.width-.001;
        referencesRect=fitted;
        if(!narrowed)break;
      }
      if(!referencesRect)return;
      if(referencesRect.height<(compactReading?60:72)||referencesRect.width<40)return;
    }
    const entries = [{id: 'title', kind: 'title', rect: title}, {id: 'story', kind: 'story', rect: storyRect}, ...screens];
    if (links.length) entries.push({id: 'references', kind: 'references', links, rect: referencesRect});
    if (entries.some(entry => entry.rect.x < margin - .01 || right(entry.rect) > width - margin + .01 ||
      entry.rect.y < header || bottom(entry.rect) > floor + .01 || obstructions.some(block => intersects(phone
        ? rectangle(entry.rect.x-3,entry.rect.y-3,entry.rect.width+6,entry.rect.height+6) : entry.rect, block)))) return;
    for (let i = 0; i < entries.length; i++) for (let j = i + 1; j < entries.length; j++) if (intersects(entries[i].rect, entries[j].rect)) return;
    const storyReadability = Math.min(1, storyRect.width / (phone ? 175 : 310)) ** 2;
    const storyScore = area(storyRect) * storyReadability * (phone ? 4 : 1.4);
    const mediaScore = screens.reduce((sum, entry) => {
      const imageHeight = entry.rect.height - (entry.photo?.captionPixels || 0) - (entry.photo?.controlsPixels || 0);
      return sum + entry.rect.width * imageHeight * Math.min(1, entry.rect.width / (phone ? 90 : 130)) ** 2;
    }, 0);
    const referenceScore = links.length ? Math.min(area(referencesRect), 260 * Math.max(120, referencesRect.width)) * .18 : 0;
    const weakestMedia=screens.length?Math.min(...screens.map(entry=>Math.min(1,entry.rect.width/(phone?32:64))*Math.min(1,entry.rect.height/(phone?44:80)))):1;
    // Phone descriptions must earn useful reading space before larger media
    // previews do. The compact board uses 41px of chrome; 125px of content
    // accommodates the Summary heading and several actual paragraph lines.
    const visibleCopy = phone ? Math.min(1,Math.max(0,storyRect.height-41)/125) ** 2 : 1;
    candidates.push({entries, score: (storyScore + mediaScore * (phone ? 1.8 : 3) + referenceScore)*weakestMedia*visibleCopy});
  };
  if (!media.length) {
    add(rightRegion, null, upper.width > 0 ? rectangle(margin, startY, rightX - margin - gap, upper.height) : null);
    add(upper, null, lower);
  }
  // Hero story above the globe, large photo/gallery to the right, references in
  // the useful lower-middle area rather than a wasted full-height left strip.
  for (const fraction of [.42, .5, .58, .64]) {
    const cut = width * fraction, leftWidth = cut - margin - gap / 2;
    const mediaRegion = rectangle(cut + gap / 2, startY, width - margin - cut - gap / 2, hint.y - gap - startY);
    const storyRect = rectangle(margin, startY, leftWidth, upper.height);
    const referencesRect = rectangle(rightX, Math.max(startY, dock.top + gap), cut - gap / 2 - rightX,
      floor - Math.max(startY, dock.top + gap));
    if (!links.length || (referencesRect.width >= 105 && referencesRect.height >= 80)) add(storyRect, mediaRegion, referencesRect);
  }
  // At shorter heights the right-hand wall becomes the reading surface; the
  // compact references list uses the otherwise empty area above the globe.
  for (const fraction of [.38, .48, .58, .68]) {
    const storyHeight = (rightRegion.height - gap) * fraction;
    add(rectangle(rightRegion.x, rightRegion.y, rightRegion.width, storyHeight),
      rectangle(rightRegion.x, rightRegion.y + storyHeight + gap, rightRegion.width, rightRegion.height - storyHeight - gap),
      rectangle(margin, startY, rightX - margin - gap, upper.height));
    if (!links.length) add(rectangle(rightRegion.x, startY, rightRegion.width, rightRegion.height),
      rectangle(margin, startY, rightX - margin - gap, upper.height), null);
  }
  // Portrait phones spread dense collections across the full upper wall and
  // place the one references list alongside the globe below it.
  for (const fraction of [.34, .44, .54]) {
    const storyHeight = (upper.height - gap) * fraction;
    add(rectangle(upper.x, upper.y, upper.width, storyHeight),
      rectangle(upper.x, upper.y + storyHeight + gap, upper.width, upper.height - storyHeight - gap), lower);
    for (const share of [.48, .56]) add(rectangle(upper.x, upper.y, (upper.width - gap) * share, upper.height),
      rectangle(upper.x + (upper.width - gap) * share + gap, upper.y, (upper.width - gap) * (1 - share), upper.height), lower);
  }
  // Short landscape has no useful space above the globe. Everything still
  // occupies this same wall, with thumbnails that can each be approached.
  if (!candidates.length) {
    const available = rectangle(Math.max(titleX, rightX), startY,
      width - margin - Math.max(titleX, rightX), Math.max(60, hint.y - gap - startY));
    const refHeight = links.length ? Math.max(42, Math.min(80, available.height * .26)) : 0;
    const bodyHeight = available.height - (refHeight ? refHeight + gap : 0);
    const storyWidth = (available.width - gap) * .48;
    add(rectangle(available.x, available.y, storyWidth, bodyHeight),
      rectangle(available.x + storyWidth + gap, available.y, available.width - storyWidth - gap, bodyHeight),
      rectangle(available.x, available.y + bodyHeight + gap, available.width, refHeight));
    const referenceWidth = links.length ? Math.max(48, available.width * .23) : 0;
    const mainWidth = available.width - (referenceWidth ? referenceWidth + gap : 0);
    const mainStoryWidth = media.length ? (mainWidth - gap) * .51 : mainWidth;
    add(rectangle(available.x, available.y, mainStoryWidth, available.height),
      rectangle(available.x + mainStoryWidth + gap, available.y, mainWidth - mainStoryWidth - gap, available.height),
      rectangle(right(available) - referenceWidth, available.y, referenceWidth, available.height));
    // A narrow landscape can keep useful reading approaches by sharing its
    // right-hand region among slimmer reading boards and a complete media grid.
    for(const storyShare of [.22,.24,.28])for(const referenceShare of [.19,.22,.25]){
      const storyWidth=available.width*storyShare,referenceWidth=links.length?Math.max(40,available.width*referenceShare):0;
      const mediaWidth=available.width-storyWidth-(referenceWidth?referenceWidth+gap:0)-gap;
      add(rectangle(available.x,available.y,storyWidth,available.height),
        rectangle(available.x+storyWidth+gap,available.y,mediaWidth,available.height),
        rectangle(right(available)-referenceWidth,available.y,referenceWidth,available.height),null,true);
    }
    // Dense portrait collections can use one preview beside the reading
    // boards above the globe, leaving the remaining previews in the tall lane.
    const left=rectangle(margin,startY,rightX-margin-gap,upper.height);
    if(media.length>1&&left.height>=84){
      for(const storyShare of [.36,.4,.44])for(const referenceShare of [.28,.34]){
        const storyWidth=left.width*storyShare,referenceWidth=links.length?left.width*referenceShare:0;
        const previewX=left.x+storyWidth+gap+(referenceWidth?referenceWidth+gap:0);
        const first=mediaGrid(media.slice(0,1),rectangle(previewX,left.y,right(left)-previewX,left.height),gap,phone);
        const rest=mediaGrid(media.slice(1),available,gap,phone);
        if(!first||!rest)continue;
        const screens=[...first,...rest].map(entry=>{
          const originalIndex=media.findIndex(record=>record.key===entry.media.key);
          return {...entry,id:originalIndex?`media-${originalIndex+1}`:'media'};
        });
        add(rectangle(left.x,left.y,storyWidth,left.height),null,
          rectangle(left.x+storyWidth+gap,left.y,referenceWidth,left.height),screens);
      }
    }
  }
  let constrained=false;
  if (!candidates.length) {
    // Persistent navigation makes the reading minimums physically impossible
    // in very small windows. Preserve every object and native image ratio,
    // record the limitation, and recover normally on the next resize.
    constrained=true;
    const available=[upper,rightRegion,lower].filter(rect=>rect.width>0&&rect.height>0).sort((a,b)=>area(b)-area(a))[0];
    const items=[{id:'story',kind:'story'},...media.map((record,index)=>({id:index?`media-${index+1}`:'media',kind:'media',media:record})),
      ...(links.length?[{id:'references',kind:'references',links}]:[])];
    const smallGap=Math.min(6,gap),columns=Math.max(1,Math.min(items.length,Math.ceil(Math.sqrt(items.length*available.width/available.height))));
    const rows=Math.ceil(items.length/columns),cellWidth=(available.width-smallGap*(columns-1))/columns,cellHeight=(available.height-smallGap*(rows-1))/rows;
    const entries=[{id:'title',kind:'title',rect:title},...items.map((entry,index)=>{
      const cell=rectangle(available.x+index%columns*(cellWidth+smallGap),available.y+Math.floor(index/columns)*(cellHeight+smallGap),cellWidth,cellHeight);
      const source=entry.media&&galleryPhotoSource(entry.media);
      if(!source)return {...entry,rect:cell};
      const caption=cellHeight*.2,controls=cellHeight*.2,imageWidth=Math.min(cellWidth,cellHeight*.6*source.width/source.height),imageHeight=imageWidth*source.height/source.width;
      return {...entry,photo:{...source,captionPixels:caption,controlsPixels:controls},
        rect:rectangle(cell.x+(cell.width-imageWidth)/2,cell.y,imageWidth,imageHeight+caption+controls)};
    })];
    candidates.push({entries,score:0});
  }
  const selected = candidates.sort((a, b) => b.score - a.score)[0];
  const components = selected.entries.map(entry => {
    const {rect, photo: source, ...fields} = entry;
    const photo = source ? {...source, worldWidth: rect.width * scale,
      worldHeight: (rect.height - source.captionPixels - source.controlsPixels) * scale,
      captionWorldHeight: source.captionPixels * scale, controlsWorldHeight: source.controlsPixels * scale} : undefined;
    return {...fields, position: [(rect.x + rect.width / 2 - width / 2) * scale,
      (height - rect.y - rect.height / 2) * scale, WALL_Z], rotation: [0, 0, 0],
      width: rect.width, height: rect.height, worldWidth: rect.width * scale, worldHeight: rect.height * scale,
      framePadding: (phone ? 1.5 : 2) * scale, pixelRect: {...rect}, ...(entry.kind === 'title' ? {titleLayout} : {}), ...(photo ? {photo} : {})};
  });
  const wallLayout = {width, height, worldWidth: width * scale, worldHeight: WALL_HEIGHT, wallZ: WALL_Z,
    rects: components.map(pose => ({id: pose.id, ...pose.pixelRect})), obstructions, dock, short,constrained};
  return {components, wallLayout};
}

export function galleryStationComponents(project, viewport) {return galleryStationPlan(project, viewport).components;}
export function galleryStationWallLayout(project, viewport) {return galleryStationPlan(project, viewport).wallLayout;}
export function galleryStationDepth() {return 25.2;}
