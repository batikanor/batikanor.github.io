# All-destination 3D feasibility — 28 September 2026

**Status:** research only, local and undeployed. The portfolio has 32 achievements
across 18 labelled cities. Three new 250 m LoD2/orthophoto chapters exist
locally (two Munich, one Berlin); Garching has a separate older 3D scene.
None of the other destinations has been built or QA'd as a city chapter.

## Answer, without confusing possibility with completion

Every destination can have a designed, isometric-style experience. The same
*factual* building/roof/ground fidelity as the Munich and Berlin pilots cannot
yet be promised everywhere. Fifteen of the 18 labelled cities have a credible
official data route to a venue chapter, subject to exact-pin and license QA.
Rome, the temple labelled Nara, and Beykoz need a different data-acquisition
or original-modeling strategy. No site has been proven technically impossible.

The unit of work is **an achievement venue**, not merely a city name. Munich
has nine achievements, Zurich three, Berlin three, and some labelled venues
lie outside their nominal city-model footprint. A citywide 3D toggle alone
does not verify the building at each event.

| Destination(s) | Feasibility for an authentic chapter | Official data route and material caveat |
|---|---|---|
| Grünheide, Cottbus | High, exact pin still to inspect | [Brandenburg LoD2](https://geoportal.brandenburg.de/detailansichtdienst/render?url=https%3A%2F%2Fgeoportal.brandenburg.de%2Fgs-json%2Fxml%3Ffileid%3D0414a37a-a749-4ee6-9f59-a41226919c58) and [DOP imagery](https://data.geobasis-bb.de/geobasis/daten/dop/rgb_jpg/); verify model currency for the newer Tesla site. |
| Berlin | Proven at State Library, other pins pending | [LoD2](https://daten.berlin.de/datensaetze/3d-gebaudemodelle-im-level-of-detail-2-lod-2-3c7c49af) and [TrueDOP 2026](https://daten.berlin.de/datensaetze/digitale-farbige-trueorthophotos-2026-dop20rgbi-wms-3801a94c). The separately viewable photoreal mesh is not assumed reusable. |
| Munich/Garching | Proven at two Munich venues and Garching; other pins pending | [Bavarian open geodata](https://www.geodaten.bayern.de/opengeodata/) provides LoD2 and DOP20; individual venue crops still need alignment review. |
| Leipzig | High | [Saxony LoD2](https://www.geodaten.sachsen.de/downloadbereich-digitale-3d-stadtmodelle-4875.html), [DOP20](https://www.geodaten.sachsen.de/downloadbereich-dop-4826.html), [reuse terms](https://www.geodaten.sachsen.de/rechtsgrundlagen-und-nutzungsbedingungen-4509.html). |
| Lübeck | High | [Schleswig-Holstein LoD2](https://geodaten.schleswig-holstein.de/gaialight-sh/_apps/dladownload/dl-lod2.html) and [DOP20](https://geodaten.schleswig-holstein.de/gaialight-sh/_apps/dladownload/dl-dop20.html). |
| Karlsruhe | Workable, but inspect geometry first | [Baden-Württemberg open LoD2 and TrueDOP](https://opengeodata.lgl-bw.de/). [LGL warns](https://www.lgl-bw.de/Produkte/3D-Produkte/3D-Gebaeudemodelle/LoD2/index.html) about roof classification and height accuracy; manual refinement may be required. |
| Vienna | High, with model-age check | [Vienna LoD2.1](https://www.wien.gv.at/stadtplanung/generalisiertes-dachmodell), [orthophoto data](https://www.wien.gv.at/stadtplanung/geodatenviewer-produktinformation), [CC BY 4.0 terms](https://www.wien.gv.at/stadtplanung/geodatenviewer-ogd-daten-herunterladen). Some roofs derive from older source imagery. |
| Salzburg | High; **fix the pin first** | [CityGML 3D model](https://www.stadt-salzburg.at/bauen-und-verkehr/das-3d-stadtmodell-von-salzburg) and [2024 6 cm TrueDOP metadata](https://maps.stadt-salzburg.at/anhaenge/orthofoto/2024/Orthofoto_2024_Metadaten.pdf). The 2024 achievement's current coordinates in `achievements.json` are about 2.9 km from the [Messezentrum venue](https://www.tourism-technology.com/en) and its [published GPS location](https://webserver.salzburg.info/de/reiseinfos/salzburg-a-z/p-r-messe-parkhaus-parkplatz-messezentrum-salzburg_az_13568). Confirm exact hall/entrance before generating a 3D crop. |
| Zurich | High | [City roof model](https://data.stadt-zuerich.ch/dataset/geo_bauten___dachmodell) and [swisstopo national LoD2.3](https://www.swisstopo.admin.ch/en/landscape-model-swissbuildings3d-2-0) plus [10 cm imagery](https://www.swisstopo.admin.ch/en/orthoimage-swissimage-10). The airport achievement is outside the city model: use national coverage. |
| Lausanne/EPFL | High via national data | [swisstopo LoD2.3](https://www.swisstopo.admin.ch/en/landscape-model-swissbuildings3d-2-0) and [10 cm imagery](https://www.swisstopo.admin.ch/en/orthoimage-swissimage-10). EPFL is in Ecublens; a Lausanne municipal-only model would miss it. |
| Helsinki | High | [Official LoD2 and textured reality mesh](https://www.hel.fi/en/decision-making/information-on-helsinki/maps-and-geospatial-data/helsinki-3d), [orthophotos](https://hri.fi/data/en/dataset/helsingin-ortoilmakuvat). Evaluate the authored venue crop and mesh loading budget. |
| Wrocław | Medium–high | [City model](https://geoportal.wroclaw.pl/en/maps/3d/) has LoD2 mainly in the centre; [national 3D buildings](https://www.geoportal.gov.pl/en/data/other-data/3d-models-of-building/) provide a lower-detail fallback, plus [national orthophotos](https://www.geoportal.gov.pl/en/data/orthophotomap-orto/). Check the specific triQube venue coverage. |
| Barcelona | High for a rich model; roofs simplified | [AMB textured model](https://geoportalcartografia.amb.cat/) with [CC BY 4.0 conditions](https://geoportalcartografia.amb.cat/AppGeoportalCartografia2/DadesAplicacio/CondicionsUsAMB/es/default.html), plus [ICGC orthophoto](https://www.icgc.cat/en/Geoinformation-and-Maps/Data-and-products/Image/Territorial-Orthophoto). Its published city mesh is LoD1/flat-roof, not Munich-equivalent roof geometry. |
| Hong Kong | High, reuse form to clarify | LandsD [individualized textured 3D models](https://data.gov.hk/en-data/dataset/hk-landsd-openmap-3d-visualisation-map-individualised-models), [3D Tiles mesh](https://data.gov.hk/en-data/dataset/hk-landsd-openmap-3d-visualisation-map-tile-based-models), and [0.25 m TrueDOP](https://portal.csdi.gov.hk/csdi-webpage/dataset/landsd_rcd_1701762716904_4826). [Terms](https://data.gov.hk/en/terms-and-conditions) permit commercial distribution with attribution; clarify modification/repacking rights with LandsD before hosting a derived mesh. |
| Rome | Viable view, no verified open LoD2 | [Lazio open orthophoto](https://geoportale.regione.lazio.it/catalogue/csw_to_extra_format/r_lazio%3A92b0f7e3-3b75-4feb-ac5e-2382/ortofoto-agea-v-2020.html) and [Rome imagery services](https://geoportale.comune.roma.it/aerofototeca/). Obtain licensed 3D geometry, perform original reconstruction, or accept a visibly lower-detail chapter. |
| “Nara” / Gyokuzoin | Ground imagery yes; temple mesh unresolved | The [temple is in Heguri Town](https://gyokuzo.com/en/), outside the published [Nara City PLATEAU project](https://www.mlit.go.jp/page/content/001906595.pdf). [GSI aerial tiles](https://maps.gsi.go.jp/development/ichiran.html) resolve at the venue, but no verified open detailed temple model. Needs permitted capture/licensed asset or carefully evidenced bespoke modeling. |
| Beykoz / Turkish-German University | Licensing/data access unresolved | Istanbul [operates 3D mapping](https://cbsakademi.ibb.gov.tr/proje/3b-istanbul-uygulamasi), but the [public viewer](https://sehirharitasiapi.ibb.gov.tr/) does not grant asset extraction/rehosting. Seek municipal permission, a licensed supplier, or original lawful site capture. |

## Production approach

1. **Venue audit before art.** Verify all 32 achievement coordinates against
   the author's actual event location and original event/venue sources. The
   Salzburg offset and the Heguri-vs-Nara-City distinction show why.
2. **Keep the globe lean.** Stream only one local mesh/roof atlas when the
   camera approaches a venue; retain the geographic basemap elsewhere.
   Combine adjacent achievement pockets only when their geography warrants it.
3. **Use honest fidelity tiers.** Prefer open official building geometry plus
   ortho imagery; use permitted textured city meshes where better; hand-model
   difficult venues from lawful reference material and label generalized art.
   Never silently copy a restricted map viewer or claim speculative roofs as
   surveyed.
4. **Ship per-venue gates.** Check visual registration, currentness, roof
   quality, license/attribution, mobile GPU memory, URLs, and fallback before
   enabling each chapter. A single universal renderer is not a universal
   source-data license.

A paid live service such as [Google Photorealistic 3D Tiles](https://developers.google.com/maps/documentation/tile/3d-tiles-overview)
may fill some gaps, but coverage must be checked at each venue. It requires
billing and onscreen attribution, and its [policies](https://developers.google.com/maps/documentation/tile/policies)
do not authorize baking/rehosting its tiles into this static asset pipeline.
