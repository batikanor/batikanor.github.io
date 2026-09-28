# Existing portfolio surfaces for Earth Engine

Historical inventory checked 27 September 2026 against the deployed site and the existing local Next.js repository. This document records the original routes and the initial link-only prototype. **Its link-only recommendation below has been superseded**: the Earth prototype now embeds the complete source project data, has an in-site CV view, and exports its own projects PDF. See [project-content integration](project-content-integration.md) and the current README.

| User need | Verified live entry | Local source of truth | Behaviour |
| --- | --- | --- | --- |
| CV page | <https://batikanor.com/cv/> | `batikanor.github.io/src/app/cv/page.js`, `src/components/CVContent.js`, `src/app/cv/config.js` | Embedded Google Docs CV, open-in-Drive, PDF control; live route returned HTTP 200 and web-readable controls. |
| Current CV PDF | <https://docs.google.com/document/d/1WJrlmn0cTgHiylnJaGbDYt_AX4li0fC8VFtORVIkh8w/export?format=pdf> | `src/app/cv/config.js` | Direct export of the latest document; HTTP 200, `application/pdf` verified. `/cv/en/` is a client-side redirect to this URL, but direct export is the better download action. |
| Complete projects/achievements list | <https://batikanor.com/projects/> | `src/app/projects/page.js`, `src/components/Projects.js`, `src/data/contestsAndActivities.js` | 32 current entries, category filters, per-item details, linked evidence, and a PDF export button; live route and content verified. |
| Download projects/achievements summary | <https://batikanor.com/projects/en/> | `src/app/projects/en/page.js`, `src/components/ExportPdfButton.js` | **Not a static PDF URL**: visiting starts a client-side jsPDF generation/download with default settings. The main Projects page also has a configurable PDF button. HTTP 200 page verified, generation behavior verified from local source. |
| Individual achievement | `https://batikanor.com/projects/#<slug>` | `src/components/Projects.js` hash-change handler | Existing page expands and scrolls to a matching item; Earth's 32 `slug` values correspond to the source list. Use `projectDetailUrl` from `src/portfolioData.js` rather than hand-building unchecked URLs. |

The deployed site's [Projects page](https://batikanor.com/projects/) was also opened via web retrieval: its heading, PDF export UI and 32 listed achievements are present. `curl -LIs` returned 200 for each route above. The source contains no static, bundled CV PDF or project PDF; link to live/export routes rather than shipping stale copies.

## Recommended integration

- Put a minimal, always discoverable **Portfolio** trigger in the Earth UI (not inside map-settings). Its small menu should contain **CV**, **Projects & achievements**, **Download CV PDF**, **Download projects PDF**.
- Open live pages/download route in a new tab/window (`target="_blank" rel="noopener noreferrer"`) so leaving the portfolio does not destroy the current map camera/achievement/drive state. Give explicit external-link/download labels.
- In each Earth achievement detail, offer **Full story ↗** using `projectDetailUrl(event.slug)`; validate that all 32 Earth slugs exist in the source list in an automated test or data-generation step.
- Retain the deployed site's existing Projects page as the full list for now; Earth navigation is by achievement, not a substitute for its complete text/evidence/filter/export UI. A future integrated page could import/generate from the same `contestsAndActivities.js` data, but avoid manually duplicating 32 stories.
- The CV is a live Google Doc. The PDF export URL can change only if `src/app/cv/config.js` changes, so centralize this link and review it when integrating into production.

`src/portfolioData.js` is the small, dependency-free integration manifest. It has no side effects or downloads at bundle load.
