/** Export the existing map-free, new-design CV at both public CV URLs. */
import {mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {portfolioLinks} from '../earth-engine/src/portfolioData.js';

const CV_TITLE='CV | Batıkan Bora Ormancı';
const CV_DESCRIPTION='Professional experience, education and CV of Batıkan Bora Ormancı.';
const preview=new URL(portfolioLinks.cvPdf);
preview.pathname=preview.pathname.replace(/\/export$/, '/preview');
preview.search='?rm=minimal';
const CV_PREVIEW_URL=preview.href;
const assert=(condition,message)=>{if(!condition)throw new Error(message);};

function renderCvNoScript() {
  return `<noscript>
  <style>
    #app,#intro-screen{display:none!important}html,body{height:auto!important;overflow:auto!important;background:var(--portfolio-bg);color:var(--portfolio-text)}
    .cv-static{height:100svh;min-height:440px;padding:0;font:16px/1.6 var(--portfolio-font-body);box-sizing:border-box}
    .cv-static-shell{display:flex;flex-direction:column;gap:8px;height:100%;min-height:0;width:100%;margin:0;padding:clamp(12px,2vw,24px);background:var(--portfolio-surface);box-sizing:border-box}
    .cv-static-brand{display:flex;flex-direction:column;color:var(--portfolio-text-strong)}.cv-static-brand strong{font-family:var(--portfolio-font-display);font-size:24px;font-weight:600;letter-spacing:-.04em}.cv-static-brand small{color:var(--portfolio-muted);font-size:12px}
    .cv-static h1{margin:0;font:500 clamp(24px,3vw,36px)/1.2 var(--portfolio-font-display);color:var(--portfolio-text-strong)}.cv-static nav{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}
    .cv-static a{display:inline-flex;align-items:center;min-height:36px;padding:7px 12px;border:1px solid var(--portfolio-border-soft);border-radius:var(--portfolio-radius);background:var(--portfolio-surface-deep);color:var(--portfolio-text-secondary);font-size:12px;font-weight:500;line-height:1.2;text-decoration:none;box-sizing:border-box}
    .cv-static a:hover{background:var(--portfolio-surface-hover);color:var(--portfolio-text-strong)}.cv-static a:focus-visible{outline:2px solid var(--portfolio-focus);outline-offset:3px}.cv-static iframe{display:block;flex:1;width:100%;height:auto;min-height:240px;border:0;background:#fff}
  </style>
  <main class="cv-static"><section class="cv-static-shell" aria-labelledby="cv-static-title">
    <div class="cv-static-brand"><strong>Batıkan</strong><small>Hacker · Developer · Entrepreneur</small></div>
    <h1 id="cv-static-title">${CV_TITLE}</h1>
    <nav aria-label="CV actions"><a href="/">Home</a><a href="${CV_PREVIEW_URL}" target="_blank" rel="noopener noreferrer">Open in Drive ↗</a><a href="${portfolioLinks.cvPdf}" target="_blank" rel="noopener noreferrer">Download PDF ↓</a></nav>
    <iframe title="Batıkan Bora Ormancı’s current CV" src="${CV_PREVIEW_URL}"></iframe>
  </section></main>
</noscript>`;
}

/** Both language aliases use the same authored English CV and canonical URL. */
export function renderCvPage(shellHtml,{staging=false,alias=false}={}) {
  const origin=staging?'https://staging.batikanor.com':'https://batikanor.com';
  assert(typeof alias==='boolean','CV alias must be explicit');
  assert(shellHtml.includes('id="cv-view-root"')&&shellHtml.includes('/assets/earth-current.json'),
    'CV pages require the new Earth shell and release bootstrap');
  assert(shellHtml.includes(`rel="canonical" href="${origin}/"`),'CV shell has the wrong deployment origin');
  assert(/<noscript>[\s\S]*?<\/noscript>/.test(shellHtml),'CV shell has no no-JavaScript fallback to replace');
  let html=shellHtml
    .replace(/<title>[^<]*<\/title>/,`<title>${CV_TITLE}</title>`)
    // Keep map-only controls hidden even before the CV JavaScript arrives.
    .replace('</head>','<style id="cv-route-style">#intro-screen,#app>:not(#cv-view-root){display:none!important}</style>\n</head>')
    .replace(/<meta name="description" content="[^"]*"\s*\/>/,`<meta name="description" content="${CV_DESCRIPTION}" />`)
    .replace(`rel="canonical" href="${origin}/"`,`rel="canonical" href="${origin}/cv/"`)
    .replace(/<meta property="og:url" content="[^"]*"\s*\/>/,`<meta property="og:url" content="${origin}/cv/" />`)
    .replace(/<meta property="og:title" content="[^"]*"\s*\/>/,`<meta property="og:title" content="${CV_TITLE}" />`)
    .replace(/<meta property="og:description" content="[^"]*"\s*\/>/,`<meta property="og:description" content="${CV_DESCRIPTION}" />`)
    // A CV document should not even connect to tile servers before loading.
    .replace(/^\s*<link rel="(?:preconnect|dns-prefetch)"[^>]+>\s*$/gm,'')
    .replace(/<noscript>[\s\S]*?<\/noscript>/,renderCvNoScript());
  html=html.replace(/<script type="application\/ld\+json">([^<]+)<\/script>/,(_,json)=>{
    const schema=JSON.parse(json),profile=schema['@graph']?.find(item=>item['@type']==='ProfilePage');
    assert(profile,'CV shell has no authored profile metadata');
    profile['@id']=`${origin}/cv/#profile`;profile.url=`${origin}/cv/`;profile.name=CV_TITLE;
    return `<script type="application/ld+json">${JSON.stringify(schema).replace(/</g,'\\u003c')}</script>`;
  });
  assert(!html.includes('self.__next_f')&&!html.includes('/_next/'),'Old Next CV layout survived the new CV export');
  return html;
}

export async function writeCvPages(directory,shellHtml,{staging=false}={}) {
  for(const [path,alias] of [['cv',false],['cv/en',true]]) {
    const folder=join(directory,path);await mkdir(folder,{recursive:true});
    await writeFile(join(folder,'index.html'),renderCvPage(shellHtml,{staging,alias}));
  }
}
