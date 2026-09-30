import * as maplibregl from 'maplibre-gl';
import {distanceMetres} from './geo.js';

/** Framing of the exhibit, not a claim of finer ground-image sampling. */
export function exhibitInspectionCamera(center,width) {
  const usableWidth=Math.max(220,Math.min(width-64,780));
  return {center,zoom:Math.min(20.8,Math.log2(156543.03392*Math.cos(center[1]*Math.PI/180)*usableWidth/55)),
    pitch:54,bearing:42,offset:[0,-32]};
}

/** Include the actual header/credits/navigation geometry, measured once on open. */
export function exhibitPopupInsets({width,height},{headerBottom=0,footerTop=height}={}) {
  return {top:Math.max(72,headerBottom+8),
    bottom:Math.max(width<=600?156:(height<=500?132:112),height-footerTop+8)};
}

/** Fit either sign's reader within the canvas, clear of header and chronology. */
export function exhibitPopupOffset(point,card,{width,height,...chrome}) {
  const {top,bottom}=exhibitPopupInsets({width,height},chrome),inset=16;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const x=clamp(point.x,inset+card.width/2,width-inset-card.width/2);
  const y=clamp(point.y-22,top+card.height/2,height-bottom-card.height/2);
  return [x-point.x,y-point.y];
}

/** One pair of accessible touch targets, allocated only close to one exhibit. */
export function createExhibitReader({map,getScene,getEvent,canRead,onOpenProject}) {
  let markers=[],popup=null,key=null;
  function clear(){markers.forEach(marker=>marker.remove());markers=[];popup?.remove();popup=null;key=null;}
  function showPanel(index,content,coordinate) {
    if(!canRead()||getEvent()?.slug!==content.slug)return;
    map.stop(); // A quick tap during inspection must not dismiss the reader on the next animation frame.
    popup?.remove();
    const root=document.createElement('article');root.className='exhibit-excerpt';root.setAttribute('aria-label',content.title);
    const excerpt=document.createElement('p');excerpt.tabIndex=-1;excerpt.textContent=(index===0?content.summary:content.detail)+((index===0?content.summaryTruncated:content.detailTruncated)?'…':'');root.append(excerpt);
    const open=document.createElement('button');open.type='button';open.textContent='Open full project';
    open.addEventListener('click',()=>{if(getEvent()?.slug!==content.slug||!canRead()){clear();return;}popup?.remove();popup=null;onOpenProject(content.slug);});root.append(open);
    const canvas=map.getContainer(),width=canvas.clientWidth,height=canvas.clientHeight;
    const canvasRect=canvas.getBoundingClientRect(),header=document.querySelector('.topbar')?.getBoundingClientRect();
    const footerRects=[...document.querySelectorAll('#journey,#journey-explore,.context-actions,.sources')]
      .map(element=>element.getBoundingClientRect()).filter(rect=>rect.width>0&&rect.height>0);
    const viewport={width,height,headerBottom:header?header.bottom-canvasRect.top:0,
      footerTop:Math.min(height,...footerRects.map(rect=>rect.top-canvasRect.top))};
    const {top,bottom}=exhibitPopupInsets(viewport,viewport);
    popup=new maplibregl.Popup({className:'exhibit-excerpt-popup',closeButton:true,closeOnClick:false,closeOnMove:true,
      anchor:'center',maxWidth:`${Math.min(340,width-32)}px`,offset:[0,-22],focusAfterOpen:false})
      .setLngLat(coordinate).setDOMContent(root).addTo(map);
    const element=popup.getElement(),body=element.querySelector('.maplibregl-popup-content');
    body.style.maxHeight=`${Math.max(1,height-top-bottom)}px`;
    body.style.overflowY='hidden';
    const bodyStyle=getComputedStyle(body),bodyInsets=['paddingTop','paddingBottom','borderTopWidth','borderBottomWidth']
      .reduce((sum,key)=>sum+(Number.parseFloat(bodyStyle[key])||0),0);
    root.style.maxHeight=`${Math.max(1,height-top-bottom-bodyInsets)}px`;
    root.style.overflowY='auto'; // Scroll prose, never the close button.
    // Public APIs, measured once on opening. No per-frame DOM readback.
    popup.setOffset(exhibitPopupOffset(map.project(coordinate),element.getBoundingClientRect(),viewport));
    // Keep initial keyboard focus visible even when a landscape reader scrolls.
    excerpt.focus({preventScroll:true});
  }
  function sync(){
    const scene=getScene(),event=getEvent();
    const focus=scene?.getExhibitFocus?.(),content=scene?.getSignContent?.(),positions=scene?.getSignPositions?.()??[];
    const centre=map.getCenter();
    if(!canRead()||!focus||!content||!event||positions.length!==2||map.getZoom()<18.4
      ||distanceMetres([centre.lng,centre.lat],focus)>150){clear();return;}
    const nextKey=`${event.slug}:${positions.flat().join(',')}`;
    if(key===nextKey)return;
    clear();key=nextKey;
    markers=positions.map((coordinate,index)=>{
      const button=document.createElement('button');button.type='button';button.className='exhibit-sign-reader';
      const wide=document.createElement('span');wide.className='reader-label-wide';wide.textContent=index===0?'Read excerpt':'Read more';
      const compact=document.createElement('span');compact.className='reader-label-compact';compact.textContent='Read';button.append(wide,compact);
      button.setAttribute('aria-label',`${index===0?'Read excerpt':'Read more'}: ${content.title}`);
      button.addEventListener('click',event=>{event.stopPropagation();showPanel(index,content,coordinate);});
      return new maplibregl.Marker({element:button,anchor:'top',offset:[0,10]}).setLngLat(coordinate).addTo(map);
    });
  }
  return {sync,clear};
}
