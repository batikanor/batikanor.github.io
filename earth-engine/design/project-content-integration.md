# Existing portfolio content in the Earth prototype

The project sheet uses the author's existing `batikanor.github.io/src/data/contestsAndActivities.js`, copied **verbatim** to `src/data/contestsAndActivities.js`. It currently contains all 32 map achievements and their original titles, dates, short/long descriptions, venue names, links, technologies and media references. `src/projectContent.js` renders those records rather than any `landmark` copy from the map prototype.

The source contains 66 `gdrive_embed` items and no `images` items. All referenced inline and unplaced embeds are rendered in the source's order, including captions and credits. Five same-origin photos referenced by the original data have been copied under `public/photos/`; other Drive, Google Slides/Docs and YouTube media continue to use the original author-provided URLs and are lazy-loaded only for the active story. An “Open original” link remains available beside each external embed, because third-party iframe access can vary by browser or the original owner's sharing settings.

The original `/projects/#slug` cross-reference to the 2025 Decarbon Days story resolves to `?event=slug` in the replacement map. `renderProjectContent` also accepts `onProjectLink` for in-app navigation without reloading.

CV and project source links also reference four certificate PDFs and the Bata Kozmetik sample PDF on the current domain. Copies now live under the same `public/certificates/...` and `public/other/...` paths so those references remain valid if this prototype eventually replaces the domain. The linked `/sui` dApp is a separate Next.js route in the old site; migrating that application is still a production-release task, not handled by this map-content copy.

Run `node --test scripts/projectContent.test.mjs` from the Earth project to check snapshot/source equality when the sibling repo is present, exact map-slug coverage, every inline media reference, and local asset presence. Whenever the deployed portfolio source changes, copy the updated source file and any newly referenced local assets before publishing the replacement site. This is a static snapshot, not a live data sync.
