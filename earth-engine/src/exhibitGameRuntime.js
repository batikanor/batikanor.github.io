import {getExhibitGame} from './exhibitGameCatalog.js';
import {createExhibitGameState,stepExhibitGame,clickExhibitGame,getExhibitGameSnapshot} from './exhibitGameSimulation.js';
import {createExhibitGameObjects} from './exhibitGameObjects.js';

/** One physical game uses the venue's existing renderer and visit-local state. */
export function createExhibitGameRuntime(slug,{onRepaint=()=>{}}={}) {
  const config=getExhibitGame(slug);
  if(!config)throw new Error(`Unknown physical exhibit: ${slug}`);
  let state=createExhibitGameState(config),input={x:0,z:0,activate:false},lastTime=null,destroyed=false,hoveredId=null;
  const objects=createExhibitGameObjects(config);
  const snapshot=()=>{
    const value=getExhibitGameSnapshot(config,state);
    for(const item of [value.actor,...value.objects,...value.targets])if(item)item.hovered=item.id===hoveredId;
    return value;
  };
  const sync=()=>objects.sync(snapshot(),0);
  sync();
  return {
    root:objects.root,
    get pickable(){return objects.pickable;},
    click(id,point){if(destroyed)return false;const changed=clickExhibitGame(config,state,id,point);sync();onRepaint();return changed;},
    hover(id){if(destroyed||hoveredId===id)return;hoveredId=id;sync();onRepaint();},
    input(next){
      if(destroyed)return;
      const value={x:Math.max(-1,Math.min(1,Number(next.x)||0)),z:Math.max(-1,Math.min(1,Number(next.z)||0)),activate:!!next.activate};
      if(value.x===input.x&&value.z===input.z&&value.activate===input.activate)return;
      input=value;onRepaint();
    },
    reset(){if(destroyed)return;state=createExhibitGameState(config);lastTime=null;sync();onRepaint();},
    render(now){
      if(destroyed)return false;
      const dt=lastTime===null?0:Math.max(0,Math.min(.05,(now-lastTime)/1000));lastTime=now;
      const changed=stepExhibitGame(config,state,input,dt);
      const value=snapshot();
      const moving=objects.sync(value,dt);
      const activeInput=!state.completed&&(input.x!==0||input.z!==0||input.activate);
      const running=!state.completed&&!!value.actor?.running;
      if(changed||moving||activeInput||running)onRepaint();
      return !!(changed||moving||activeInput||running);
    },
    getSnapshot(){return snapshot();},
    getStats(){return {slug,mechanic:config.mechanic,completed:!!state.completed,progress:state.progress??0,...objects.getStats()};},
    destroy(){if(destroyed)return;destroyed=true;input={x:0,z:0,activate:false};objects.root.removeFromParent();objects.destroy();}
  };
}
