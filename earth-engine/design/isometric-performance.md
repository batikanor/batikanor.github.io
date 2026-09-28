# Isometric chapter performance gate

Measured on 2026-09-28 for the public release. Physical-device performance
remains unverified; this document records asset budgets and emulator checks.

The regional layer loads **one chapter only**, after a stopped camera reaches
its 250 m area at z15.5+. Nothing under `public/data/*lod2*` or
`public/data/*roof*` is requested on the whole-world view. A new chapter
aborts the prior mesh/image fetch and releases the old WebGL geometry, material
and texture. A low-memory device (reported `navigator.deviceMemory <= 4`, or a
coarse-pointer device without that API) selects a true-source 2× downsampled
roof atlas. Desktop/high-memory devices retain the original full-resolution
atlas. A device whose GPU cannot fit even the smaller atlas displays the
official LoD2 geometry without roof texture, over the normal satellite map.

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
Berlin **24.9→20.2 s** after the final-framing change. All three textures
rendered and no local asset returned 404. These are software-renderer test
times, not expected user device timings; they show that the asset load now
overlaps map startup rather than waiting for a long flight. A future increment
could skip very long chronology flights on constrained devices, but this is not
part of the current patch.
