// DM Sans advances extracted with FreeType FT_Get_Advance(FT_LOAD_NO_SCALE)
// from the shipped variable WOFF2 files at their real 400 and 500 weights.
// Captions use weight 500; credits use 400. The font artifacts use 1000 units/em.
// Keep the artifact hashes and tables together when changing the body font.
export const GALLERY_PHOTO_CAPTION_FONT_METRICS = Object.freeze({
  family: 'DM Sans', unitsPerEm: 1000, titleWeight: 500, creditWeight: 400,
  files: Object.freeze({
    'DM-Sans-Latin-wght.woff2': '9fea608a947e67020c33cad9a6fe3d60c54119dfb8cff87768a8117a15ed7543',
    'DM-Sans-LatinExt-wght.woff2': 'a5d38fe99f930275684999b462c7123faa063d9e44e73b4b241723d884aa0f49',
  }),
});

// ASCII 32–126, followed by authored and common non-ASCII caption characters.
const ADVANCES_400 = [266,250,291,804,580,786,734,159,373,373,480,550,182,541,198,392,
  684,312,576,591,607,610,628,534,608,628,202,227,550,550,550,524,1005,664,603,717,688,565,
  535,758,681,234,501,584,527,841,691,774,580,774,594,580,561,655,669,968,603,580,541,314,
  392,314,622,660,213,544,626,572,627,568,340,558,575,240,243,504,223,891,574,593,626,627,
  370,502,392,573,527,763,496,556,458,427,234,427,550];
const ADVANCES_500 = [256,269,315,820,588,822,749,171,383,383,490,559,202,552,215,403,
  690,328,576,595,621,613,630,535,616,630,219,243,559,559,559,529,1018,678,614,723,694,571,
  542,764,691,246,514,606,537,855,703,777,591,777,605,588,572,664,681,984,624,597,553,334,
  403,334,639,680,220,557,635,583,636,579,350,570,589,251,253,527,237,907,588,598,635,636,
  382,511,405,587,539,781,520,571,468,441,246,441,559];
const UNICODE_400 = {'ß':659,'ä':544,'é':568,'ü':573,'ğ':558,'ı':223,'ş':502,
  '—':873,'–':669,'‘':210,'’':210,'“':367,'”':367,'…':566,'•':360,'·':198,
  '€':771,'™':772,'©':794,'®':504,'×':550,'−':550,'ø':597,'æ':914,'œ':979,
  'Ö':774,'Ü':655,'Ä':664,'É':565,'ç':572,'ö':593,'Ç':717,'Ğ':758,'İ':234,'Ş':580,
  'ñ':574,'Ñ':691,'á':544,'Á':664,'í':223,'Í':234,'ó':593,'Ó':774,'ú':573,'Ú':655,
  'â':544,'ê':568,'î':223,'ô':593,'û':573,'à':544,'è':568,'ì':223,'ò':593,'ù':573,
  'å':544,'Å':664,'Ø':776,'Æ':912,'Œ':1114,'\u00a0':266};
const UNICODE_500 = {'ß':675,'ä':557,'é':579,'ü':587,'ğ':570,'ı':237,'ş':511,
  '—':887,'–':677,'‘':224,'’':224,'“':394,'”':394,'…':604,'•':368,'·':215,
  '€':777,'™':792,'©':791,'®':506,'×':559,'−':559,'ø':596,'æ':924,'œ':978,
  'Ö':777,'Ü':664,'Ä':678,'É':571,'ç':583,'ö':598,'Ç':723,'Ğ':764,'İ':246,'Ş':588,
  'ñ':588,'Ñ':703,'á':557,'Á':678,'í':237,'Í':246,'ó':598,'Ó':777,'ú':587,'Ú':664,
  'â':557,'ê':579,'î':237,'ô':598,'û':587,'à':557,'è':579,'ì':237,'ò':598,'ù':587,
  'å':557,'Å':678,'Ø':776,'Æ':922,'Œ':1109,'\u00a0':256};

function glyphAdvance(character, weight) {
  if (/\p{Mark}/u.test(character)) return 0;
  const ascii = weight === 500 ? ADVANCES_500 : ADVANCES_400;
  const unicode = weight === 500 ? UNICODE_500 : UNICODE_400;
  const known = ascii[character.codePointAt(0) - 32] ?? unicode[character];
  if (known !== undefined) return known;
  const decomposed = character.normalize('NFD');
  if (decomposed !== character) {
    return [...decomposed].reduce((sum, part) => sum + glyphAdvance(part, weight), 0);
  }
  // Unknown fallback glyphs can be wider than a Latin em. Reserve two ems
  // rather than underestimate future CJK, symbol or emoji caption material.
  return 2000;
}

function wrappedLines(value, width, fontSize, weight) {
  // Normal CSS whitespace collapses; non-breaking spaces remain in their word.
  const text = String(value ?? '').replace(/[ \t\r\n\f]+/gu, ' ').trim();
  if (!text) return 0;
  // Unkerned advance sums plus .03em leave room for fractional rasterization.
  const available = Math.max(1, width / fontSize * 1000 - 30);
  const space = glyphAdvance(' ', weight);
  let lines = 1, current = 0;
  for (const word of text.split(' ')) {
    const advances = [...word].map(character => glyphAdvance(character, weight));
    const wordWidth = advances.reduce((sum, advance) => sum + advance, 0);
    if (current && current + space + wordWidth <= available) {
      current += space + wordWidth;
      continue;
    }
    if (current) { lines++; current = 0; }
    // overflow-wrap:anywhere retains every character of a long source label.
    for (const advance of advances) {
      if (current && current + advance > available) { lines++; current = 0; }
      current += advance;
    }
  }
  return lines;
}

/** Full native photo caption and credit, outside the proportional image row. */
export function galleryPhotoCaptionMetrics(media, width, {uiScale = .8, phone = false} = {}) {
  uiScale = Number.isFinite(uiScale) && uiScale > 0 ? uiScale : .8;
  const paddingX = 9 * uiScale, paddingY = 6 * uiScale;
  const contentWidth = Math.max(1, (Number.isFinite(width) ? width : 0) - paddingX * 2 - 1);
  const titleFontSize = (phone ? 12 : 16) * uiScale;
  const creditFontSize = (phone ? 11 : 13) * uiScale;
  const titleLineHeight = titleFontSize * 1.3, creditLineHeight = creditFontSize * 1.2;
  const titleLines = wrappedLines(media?.abovePhotoCaption, contentWidth, titleFontSize, 500);
  const creditLines = wrappedLines(media?.credit, contentWidth, creditFontSize, 400);
  const creditMargin = creditLines ? 3 * uiScale : 0;
  const contentHeight = titleLines * titleLineHeight + creditMargin + creditLines * creditLineHeight;
  const roundingAllowance = 1;
  return {requiredHeight: Math.ceil(paddingY * 2 + contentHeight + roundingAllowance),
    titleLines, creditLines, uiScale, phone, contentWidth, contentHeight, paddingX, paddingY,
    titleFontSize, titleLineHeight, creditFontSize, creditLineHeight, creditMargin,
    titleFontWeight: 500, creditFontWeight: 400, roundingAllowance};
}
