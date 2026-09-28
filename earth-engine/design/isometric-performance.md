# Isometric chapter performance gate

Measured on 2026-09-28 for the public release. Physical-device performance
remains unverified; this document records asset budgets and emulator checks.

The regional layer loads **one selected chapter only**. Explicitly selecting
its achievement starts the bounded mesh and roof-atlas requests while the
camera is travelling; rendering still waits until the camera reaches its
250 m area at z15.5+. Nothing under `public/data/*lod2*` or
`public/data/*roof*` is requested on the whole-world view. A superseding
selection aborts unfinished requests, while up to three completed compressed
chapter payloads stay in a same-page cache for revisits. GPU geometry, material
and texture are released on departure. Transient network errors and 408/429/5xx
responses receive two short bounded retries; invalid or missing assets do not.
A low-memory or Save Data device (reported `navigator.deviceMemory <= 4`, a
slow/Save Data connection, or a coarse-pointer device without that API) selects a true-source 2× downsampled
roof atlas. Desktop/high-memory devices retain the original full-resolution
atlas. A device whose GPU cannot fit even the smaller atlas displays the
official LoD2 geometry without roof texture, over the normal satellite map.
The separate Rome venue chapter follows the same on-selection prefetch and
bounded-retry pattern, keeping at most one validated compressed chapter while
it remains focused. At the Rome venue, relief is paused while the authored
orthophoto/massing is shown: the external DEM has z13 tiles there but returned
404 for the z14–16 tiles requested by the global source in local browser QA.
Relief resumes at the next destination or World view, honoring the visitor's
terrain setting.

| Chapter | Mesh transfer | Full atlas | Half atlas | Roof GPU with mipmaps, full → half |
| --- | ---: | ---: | ---: | ---: |
| Siemens Munich | 579 kB | 2.08 MB | 776 kB | 54.5 → 13.6 MB |
| Google Munich | 912 kB | 2.27 MB | 849 kB | 59.1 → 14.8 MB |
| Berlin State Library | 376 kB | 3.10 MB | 906 kB | 68.5 → 17.1 MB |

The GPU estimate is `width × height × 4 RGBA bytes × 4/3 mipmaps`, excluding
mesh and the underlying MapLibre tile cache. It is a conservative allocation
estimate, not a device profiler result. The half-res assets are Lanczos
downsamples of the cited official source images, not AI-generated imagery;
their sidecar manifests include source SHA-256, attribution, license, derived
dimensions and output SHA-256. Rebuild with `python3
scripts/build-reduced-roof-atlases.py` (Pillow 11.x).

Browser QA: original Google 3328×3328 roof atlas rendered correctly; a forced
4 GB device-memory tier loaded the 1664×1664 atlas, retained the same roof
alignment, and displayed the full project detail on a 390×844 viewport. No
new console errors were observed. Local `npm run verify` passed 46 tests and
`npm run build` passed. The Vite initial JS chunk is 1.61 MB raw / 431 kB
gzip; this change adds no eager atlas to it. A Chrome CDP sample of a
Berlin-to-world camera flight showed hundreds of external imagery/DEM tile
requests, often cache hits. **Tile provider latency and long-flight tile churn
remain more likely performance limits than one local building mesh.**

Before production promotion, test at least one actual low-end Android phone
and one iPhone on 4G, including repeated achievement jumps, memory pressure,
browser back/forward, and WebGL context loss. Do not claim universally smooth
frame rates from desktop emulation alone. Large images embedded in project
details are a separate loading cost and should remain lazy.

## Direct-link camera startup

An explicit `?event=` link used to instantiate the map on the globe at z1.85
and fly through every intermediate level to a city. The local experiment now
constructs the map at the event itself; its three authored LoD2 links start at
the exact z16.8/pitch49/bearing42 chapter framing. The existing fly still
applies the popup offset, so content placement and user controls are unchanged.
Desktop visits to bare `/` retain the cinematic globe intro; constrained
devices start near the newest event instead. World and CV routes retain their
own starting view.

Three repeated headless SwiftShader checks (1440×900, local Vite) measured
navigation to textured chapter: Siemens **31.0→20.2 s**, Google **19.9→14.7 s**,
Berlin **24.9→20.2 s** after the earlier final-framing change. All three
textures rendered and no local asset returned 404. These are software-renderer
test times, not expected user device timings. The current increment additionally
overlaps selected-chapter fetching with the flight and keeps completed compressed
assets warm within the page. Chronology arrows now use a 1.4 s desktop
cross-city flight (0.9 s nearby); constrained devices jump directly between
distant achievements instead of streaming tiles along the whole route. Bare-home
intro and non-chronology world/city flights retain their existing pacing.
