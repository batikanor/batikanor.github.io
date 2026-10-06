import * as THREE from 'three';

/** Linear size multiplier; share the original geometry rather than duplicate it. */
export const CAPSULE_SCALE = 4;
export const CAPSULE_SIGN_POSITIONS = Object.freeze([
  Object.freeze([-8.55,10.6,.6]),Object.freeze([8.55,10.6,.6])
]);

/**
 * An illustrative, elevated exhibition capsule — not a reconstruction of a
 * venue. Its glass has no transmission render target, image, animation or load.
 * The authored demonstrations remain full-sized inside the lower hemisphere.
 */
export const CAPSULE_LAYOUT = Object.freeze({
  floorY:7.2, demonstrationLift:6.4, centerY:11, radius:10, floorRadius:8.86,
  doorwayWidth:3.2, doorwaySpringY:9.9, doorwayTopY:11.5, doorwayZ:-10.12,
  doorOpenDegrees:65,
  ladderBottom:Object.freeze([0,.35,-14.4]),
  ladderTop:Object.freeze([0,7.2,-10.45]),
  footprintHalfWidth:19, footprintHalfDepth:15
});

const TAU=Math.PI*2, RAD=Math.PI/180;
const assert=(condition,message)=>{if(!condition)throw new TypeError(message);};
const STYLES=Object.freeze({
  orbital:new Set(['satellite','globe']),
  bio:new Set(['health-imaging','bioinformatics','noseprints','focus']),
  energy:new Set(['energy-forum','energy-grid','circular-appliances','neural-route']),
  audio:new Set(['spatial-audio']),
  ledger:new Set(['finance-graph','linked-ledger','coins','academia','gifting'])
});

function styleForSubject(subject) {
  assert(typeof subject==='string'&&subject.length>0,'Capsule needs an authored subject');
  return Object.entries(STYLES).find(([,subjects])=>subjects.has(subject))?.[0]??'engineering';
}

function spherePoint(latitude,azimuth,radius=CAPSULE_LAYOUT.radius) {
  return [radius*Math.cos(latitude)*Math.cos(azimuth),
    CAPSULE_LAYOUT.centerY+radius*Math.sin(latitude),
    radius*Math.cos(latitude)*Math.sin(azimuth)];
}

/** A sparse segmented great-circle rib; this remains in the opaque batch. */
function globeRib(p,{azimuth,start=-.37,end=Math.PI+.37,segments=24,material='metal',radius=.052}={}) {
  let previous=spherePoint(start,azimuth,CAPSULE_LAYOUT.radius+.045);
  for(let i=1;i<=segments;i++) {
    const next=spherePoint(start+(end-start)*i/segments,azimuth,CAPSULE_LAYOUT.radius+.045);
    p.rod(material,previous,next,radius);previous=next;
  }
}

function collarAccent(p,style) {
  const y=CAPSULE_LAYOUT.floorY-.16;
  // Each family expresses a real exhibition-system idea in its load-bearing
  // collar, not unrelated ornaments or a generated project title.
  if(style==='orbital') {
    // A diagonal orbital cradle passes behind the viewing face.
    const points=[];
    for(let i=0;i<=12;i++) {
      const a=.16+i*Math.PI/12;
      points.push([Math.cos(a)*9.02,y+Math.sin(a)*1.1,Math.sin(a)*9.02]);
    }
    points.forEach((point,i)=>{if(i)p.rod('gold',points[i-1],point,.045);});
  } else if(style==='bio') {
    // Clean white instrument clips, asymmetrically on the rear collar.
    for(const x of [-5.5,0,5.5])p.box('paper',[x,y,Math.sqrt(8.8**2-x*x)],[.7,.55,.22]);
  } else if(style==='energy') {
    // Three structural bracing fins suggest an energy/infrastructure station.
    for(const angle of [.3,1.4,2.55]) {
      const x=Math.cos(angle)*8.6,z=Math.sin(angle)*8.6;
      p.rod('gold',[x*.82,y-.8,z*.82],[x,y+.18,z],.065);
    }
  } else if(style==='audio') {
    // A real acoustic-baffle rhythm, kept behind the demonstration.
    for(let i=0;i<5;i++) {
      const x=(i-2)*1.1,z=Math.sqrt(8.85**2-x*x),h=.35+Math.abs(i-2)*.22;
      p.box('gold',[x,y+h/2,z],[.17,h,.24]);
    }
  } else if(style==='ledger') {
    // Fine bookend-like index ribs, not fabricated currency/data labels.
    for(const angle of [.2,.6,1.0,1.4,1.8,2.2,2.6]) {
      p.box('gold',[Math.cos(angle)*8.91,y,Math.sin(angle)*8.91],[.18,.33,.28],[0,-angle,0]);
    }
  } else {
    // Engineering collar: four honest locking blocks on the rear arc.
    for(const angle of [.2,1.0,2.15,2.9]) {
      p.box('metal',[Math.cos(angle)*8.89,y,Math.sin(angle)*8.89],[.48,.45,.34],[0,-angle,0]);
    }
  }
}

/**
 * Submit the support, floor and portal to the host's material-keyed batch.
 * The legacy roof-relative ladder is optional: production uses a separately
 * bounded, terrain-grounded access assembly, because a roof is not the ground.
 * There is no surrounding court or authored tree.
 */
export function buildCapsuleFrame(p,{subject,compact=false,includeLadder=true}={}) {
  for(const name of ['box','cylinder','ring','rod'])assert(typeof p?.[name]==='function',`Capsule frame needs primitive ${name}`);
  assert(typeof compact==='boolean','Capsule compact mode must be explicit');
  assert(typeof includeLadder==='boolean','Capsule ladder inclusion must be explicit');
  const style=styleForSubject(subject),floor=CAPSULE_LAYOUT.floorY;

  // A tapered three-foot stance and forked mast visibly carry the capsule.
  // Small individual footings preserve the real aerial image below the object.
  p.rod('dark',[0,.28,0],[0,4.85,0],.42);
  for(const angle of [.22,2.31,4.40]) {
    const x=Math.cos(angle)*3.7,z=Math.sin(angle)*3.7;
    p.box('edge',[x,.10,z],[.95,.20,.95],[0,-angle,0]);
    p.rod('metal',[x,.20,z],[0,2.65,0],.19);
    p.rod('metal',[0,4.72,0],[Math.cos(angle)*6.35,floor-.30,Math.sin(angle)*6.35],.16);
  }
  // The floor belongs INSIDE the glass sphere; no outdoor square platform.
  p.cylinder('dark',[0,floor-.19,0],CAPSULE_LAYOUT.floorRadius,.26);
  p.cylinder(style==='bio'?'paper':'edge',[0,floor-.035,0],CAPSULE_LAYOUT.floorRadius-.10,.045);
  p.ring('gold',[0,floor-.13,0],CAPSULE_LAYOUT.floorRadius+.025,.055);

  // The front door has an actual curved portal and a short entry landing.
  const half=CAPSULE_LAYOUT.doorwayWidth/2,z=CAPSULE_LAYOUT.doorwayZ,spring=CAPSULE_LAYOUT.doorwaySpringY;
  p.box('dark',[0,floor-.08,z],[2.65,.16,2.55]);
  p.box('metal',[0,floor+.035,z],[2.50,.04,2.4]);
  for(const x of [-half,half]) {
    p.rod('metal',[x,floor,z],[x,spring,z],.08);
    // Portal ties connect the planar door frame to the curved glass body.
    p.rod('metal',[x,floor,z],[x,floor,-Math.sqrt(CAPSULE_LAYOUT.radius**2-x*x-(floor-CAPSULE_LAYOUT.centerY)**2)],.055);
  }
  for(let i=0;i<10;i++) {
    const a=Math.PI*i/10,b=Math.PI*(i+1)/10;
    p.rod('metal',[half*Math.cos(a),spring+half*Math.sin(a),z],
      [half*Math.cos(b),spring+half*Math.sin(b),z],.08);
  }
  // Visible hinges and the handle follow the 65-degree open door leaf.
  for(const y of [floor+.65,spring-.40])p.box('gold',[-half,y,z],[.16,.23,.17]);
  const swing=CAPSULE_LAYOUT.doorOpenDegrees*RAD;
  const leaf=(x,y)=>[-half+(x+half)*Math.cos(swing),y,z-(x+half)*Math.sin(swing)];
  for(const x of [-half,half])p.rod('metal',leaf(x,floor),leaf(x,spring),.035);
  p.rod('metal',leaf(-half,floor),leaf(half,floor),.035);
  for(let i=0;i<6;i++) {
    const a=Math.PI*i/6,b=Math.PI*(i+1)/6;
    p.rod('gold',leaf(half*Math.cos(a),spring+half*Math.sin(a)),
      leaf(half*Math.cos(b),spring+half*Math.sin(b)),.035);
  }
  const handleX=-half+(CAPSULE_LAYOUT.doorwayWidth-.3)*Math.cos(swing);
  const handleZ=z-(CAPSULE_LAYOUT.doorwayWidth-.3)*Math.sin(swing);
  p.rod('gold',[handleX,floor+1.1,handleZ-.045],[handleX,floor+1.8,handleZ-.045],.055);

  // The original compact ladder remains available for standalone legacy callers.
  // A roof-anchored host must omit it and attach adaptive ground-reaching access.
  const bottom=CAPSULE_LAYOUT.ladderBottom,top=CAPSULE_LAYOUT.ladderTop,rungs=includeLadder?22:0;
  if(includeLadder) {
    for(const x of [-.66,.66]) {
      p.rod('metal',[x,bottom[1],bottom[2]],[x,top[1]+.88,top[2]+.51],.075);
      p.rod('gold',[x,top[1]+.88,top[2]+.51],[x,top[1]+.88,z+.90],.045);
    }
    for(let i=1;i<=rungs;i++) {
      const t=i/(rungs+1),y=bottom[1]+(top[1]-bottom[1])*t,depth=bottom[2]+(top[2]-bottom[2])*t;
      p.rod('paper',[-.64,y,depth],[.64,y,depth],.055);
    }
  }
  // Two discrete rails protect the landing without closing the doorway.
  for(const x of [-1.20,1.20]) {
    p.rod('metal',[x,floor,z-.65],[x,floor+.92,z-.65],.04);
    p.rod('metal',[x,floor+.92,z-.65],[x,floor+.92,z+.90],.04);
  }

  // Families vary the actual glazing suspension, not only a color/label.
  const ribAngles=style==='orbital'?[.38,2.42]
    :style==='bio'?[.72,2.26]
    :style==='audio'?[.32,1.55]
    :style==='ledger'?[.18,2.86]
    :style==='energy'?[.55,2.59]
    :[.3,2.84];
  const ribs=compact?1:2;
  // Continuous cradle-to-cradle meridians meet across the crown. The earlier
  // half ribs read as disconnected poles when the glass face was very clear.
  ribAngles.slice(0,ribs).forEach((azimuth,i)=>globeRib(p,{azimuth,material:i?'metal':'gold',segments:24,
    start:-.37,end:Math.PI+.37,radius:style==='engineering'?.065:.052}));
  // A thin upper latitude halo supplies one clean curved silhouette, not a
  // dense cage; the full demonstrations sit entirely below this collar.
  const haloOffset=style==='orbital'?5.9:style==='audio'?5.1:5.5;
  p.ring('metal',[0,CAPSULE_LAYOUT.centerY+haloOffset,0],
    Math.sqrt(CAPSULE_LAYOUT.radius**2-haloOffset**2)+.025,.035);
  if(!compact)collarAccent(p,style);

  return Object.freeze({style,compact,decorativeTrees:0,ribs,
    entrance:Object.freeze({width:CAPSULE_LAYOUT.doorwayWidth,floorY:floor,topY:CAPSULE_LAYOUT.doorwayTopY,
      doorOpenDegrees:CAPSULE_LAYOUT.doorOpenDegrees}),
    ladder:Object.freeze({enabled:includeLadder,rungs,handrails:includeLadder?2:0,from:bottom,to:top})});
}

function makeGlazingGeometry() {
  const {radius,centerY,floorY,doorwaySpringY:spring,doorwayTopY:top}=CAPSULE_LAYOUT;
  const half=CAPSULE_LAYOUT.doorwayWidth/2,segments=36,positions=[],normals=[];
  const front=-Math.PI/2;
  const point=(y,angle)=>{
    const r=Math.sqrt(Math.max(0,radius*radius-(y-centerY)**2));
    return [r*Math.cos(angle),y,r*Math.sin(angle)];
  };
  const normal=position=>[position[0]/radius,(position[1]-centerY)/radius,position[2]/radius];
  const triangle=(a,b,c,normalOverride=null)=>{
    // Pole triangles with coincident vertices are omitted, not uploaded.
    const ab=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],ac=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
    const cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
    if(Math.hypot(...cross)<1e-8)return;
    for(const v of [a,b,c]){positions.push(...v);normals.push(...(normalOverride??normal(v)));}
  };
  const quad=(a,b,c,d)=>{triangle(a,c,b);triangle(a,d,c);};
  const ys=Array.from({length:23},(_,i)=>centerY+radius*Math.cos(i*Math.PI/22));
  // Exact arch/floor samples make a genuine trimmed opening, not a painted door
  // over a complete sphere, nor a coarse staircase cut out of regular facets.
  ys.push(floorY,top,spring,spring+.4,spring+.8,spring+1.2,spring+1.48);
  const rows=[...new Set(ys)].sort((a,b)=>b-a);
  const angles=Array.from({length:segments+1},(_,i)=>front+i*TAU/segments);
  function connect(rowYs,rowAngles,{cyclic=false}={}) {
    for(let row=0;row<rowYs.length-1;row++) {
      const upper=rowAngles(rowYs[row]),lower=rowAngles(rowYs[row+1]);
      const length=cyclic?upper.length:upper.length-1;
      for(let i=0;i<length;i++) {
        const next=(i+1)%upper.length;
        // Reverse the north-to-south/azimuth lattice for outward-facing glass.
        quad(point(rowYs[row],upper[i]),point(rowYs[row+1],lower[i]),
          point(rowYs[row+1],lower[next]),point(rowYs[row],upper[next]));
      }
    }
  }
  connect(rows.filter(y=>y>=top),()=>angles);
  const gap=y=>{
    const width=y>spring?Math.sqrt(Math.max(0,half*half-(y-spring)**2)):half;
    const r=Math.sqrt(radius*radius-(y-centerY)**2);
    return Math.asin(Math.min(1,width/r));
  };
  const bandAngles=y=>{
    const trim=gap(y);
    return Array.from({length:segments+1},(_,i)=>front+trim+i*(TAU-2*trim)/segments);
  };
  connect(rows.filter(y=>y<=top&&y>=floorY),bandAngles);
  // The lower hemisphere's ring matches every boundary vertex at the opening's
  // sill; four additional segments fill the short arc beneath the doorway.
  const sillAngles=bandAngles(floorY),sillGap=gap(floorY),last=sillAngles.at(-1);
  const lowerAngles=[...sillAngles,...[1,2,3].map(i=>last+i*2*sillGap/4)];
  connect(rows.filter(y=>y<=floorY),()=>lowerAngles,{cyclic:true});

  // A single, visibly swung arch-shaped door leaf shares the glazing material.
  // The shell's opening remains empty: there is no hidden glass across it.
  const angle=CAPSULE_LAYOUT.doorOpenDegrees*RAD,hinge=[-half,floorY,CAPSULE_LAYOUT.doorwayZ];
  const doorPoint=(x,y)=>[hinge[0]+(x+half)*Math.cos(angle),y,hinge[2]-(x+half)*Math.sin(angle)];
  const outward=[-Math.sin(angle),0,-Math.cos(angle)];
  const outline=[[-half,floorY],[half,floorY],[half,spring]];
  for(let i=1;i<=10;i++) {
    const a=Math.PI*i/10;outline.push([half*Math.cos(a),spring+half*Math.sin(a)]);
  }
  const pivot=doorPoint(0,spring-.6);
  for(let i=0;i<outline.length;i++) {
    const a=outline[i],b=outline[(i+1)%outline.length];
    // The leaf's forward face points out through the open entrance.
    triangle(pivot,doorPoint(b[0],b[1]),doorPoint(a[0],a[1]),outward);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  return geometry;
}

/** Exactly one transparent draw, including the opened door; no transmission. */
export function createCapsuleGlazing({subject,compact=false}={}) {
  assert(typeof compact==='boolean','Capsule compact mode must be explicit');
  const style=styleForSubject(subject),geometry=makeGlazingGeometry();
  const material=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,depthTest:true,side:THREE.FrontSide,
    forceSinglePass:true,toneMapped:false,
    uniforms:{uViewDirection:{value:new THREE.Vector3()},
      uTint:{value:new THREE.Color(style==='bio'?0x406360:style==='ledger'?0x555a4f:0x31555d)},
      uFaceOpacity:{value:.045},uRimOpacity:{value:.65}},
    vertexShader:`varying vec3 vCapsuleNormal;
      void main(){vCapsuleNormal=normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`uniform vec3 uViewDirection;uniform vec3 uTint;
      uniform float uFaceOpacity;uniform float uRimOpacity;varying vec3 vCapsuleNormal;
      void main(){vec3 n=normalize(vCapsuleNormal);
        float facing=clamp(abs(dot(n,uViewDirection)),0.0,1.0);
        float rim=pow(1.0-facing,2.0);
        // The rim is dark enough to remain legible over pale roofs and water.
        // A bounded analytic sky glint reads as curved glass without sampling
        // the map framebuffer or hiding the explanatory objects behind it.
        vec3 skyHalf=normalize(uViewDirection+vec3(-.50,.82,-.25));
        float glint=pow(max(dot(n,skyHalf),0.0),90.0);
        float skySheen=.035*smoothstep(.28,.85,n.y)*pow(facing,3.0);
        float alpha=min(.82,mix(uFaceOpacity,uRimOpacity,rim)+glint*.50+skySheen);
        vec3 tint=mix(uTint,vec3(.83,.94,.92),min(1.0,glint*.94+skySheen*5.0));
        gl_FragColor=vec4(tint,alpha);
        #include <colorspace_fragment>
      }`
  });
  const mesh=new THREE.Mesh(geometry,material);mesh.name='Elevated glass exhibition capsule · open door';
  mesh.frustumCulled=false;mesh.renderOrder=3;
  mesh.userData.style=style;mesh.userData.compact=compact;
  mesh.userData.triangles=geometry.getAttribute('position').count/3;
  mesh.userData.aperture=Object.freeze({width:CAPSULE_LAYOUT.doorwayWidth,bottomY:CAPSULE_LAYOUT.floorY,
    springY:CAPSULE_LAYOUT.doorwaySpringY,topY:CAPSULE_LAYOUT.doorwayTopY,cut:true});
  mesh.userData.door=Object.freeze({openDegrees:CAPSULE_LAYOUT.doorOpenDegrees,
    hinge:Object.freeze([-CAPSULE_LAYOUT.doorwayWidth/2,CAPSULE_LAYOUT.floorY,CAPSULE_LAYOUT.doorwayZ])});
  updateCapsuleGlazing(mesh,{bearing:42,pitch:54});return mesh;
}

/** Reuse the uniform vector. The map supplies the real local viewing direction. */
export function updateCapsuleGlazing(mesh,{bearing=42,pitch=54}={}) {
  assert(Number.isFinite(bearing)&&Number.isFinite(pitch),'Capsule glazing needs finite public camera angles');
  const direction=mesh?.material?.uniforms?.uViewDirection?.value;
  assert(direction?.isVector3,'Capsule glazing needs its reusable view-direction uniform');
  const b=bearing*RAD,p=Math.max(0,Math.min(89.5,pitch))*RAD,s=Math.sin(p);
  direction.set(-Math.sin(b)*s,Math.cos(p),-Math.cos(b)*s).normalize();
  return mesh;
}
