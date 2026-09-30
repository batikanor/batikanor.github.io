import * as maplibregl from 'maplibre-gl';
import {distanceMetres} from './geo.js';

/** Framing of the exhibit, not a claim of finer ground-image sampling. */
export function exhibitInspectionCamera(center,width) {
  const usableWidth=Math.max(220,Math.min(width-64,780));
  return {center,zoom:Math.min(20.8,Math.log2(156543.03392*Math.cos(center[1]*Math.PI/180)*usableWidth/55)),
    pitch:54,bearing:42,offset:[0,-32]};
}

/** One pair of accessible touch targets, allocated only close to one exhibit. */
export function createExhibitReader({map,getScene,getEvent,canRead,onOpenProject}) {
  let markers=[],popup=null,key=null;
  function clear(){markers.forEach(marker=>marker.remove());markers=[];popup?.remove();popup=null;key=null;}
  function showPanel(index,content,coordinate) {
    if(!canRead()||getEvent()?.slug!==content.slug)return;
    popup?.remove();
    const root=document.createElement('article');root.className='exhibit-excerpt';
    const title=document.createElement('h2');title.textContent=content.title;root.append(title);
    const excerpt=document.createElement('p');excerpt.textContent=(index===0?content.summary:content.detail)+((index===0?content.summaryTruncated:content.detailTruncated)?'…':'');root.append(excerpt);
    const open=document.createElement('button');open.type='button';open.textContent='Open full project';
    open.addEventListener('click',()=>{if(getEvent()?.slug!==content.slug||!canRead()){clear();return;}popup?.remove();popup=null;onOpenProject(content.slug);});root.append(open);
    popup=new maplibregl.Popup({className:'exhibit-excerpt-popup',closeButton:true,closeOnClick:false,
      maxWidth:'340px',offset:22,focusAfterOpen:true}).setLngLat(coordinate).setDOMContent(root).addTo(map);
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
