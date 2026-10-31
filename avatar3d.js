/* JP Buddy v0.2 - Animated procedural THREE.js mascot. Mobile only.
 * Remote renderer loads lazily from a pinned, publicly served Three.js module.
 * On slow/offline clients, an accessible animated CSS/SVG fallback is retained.
 * No trading or data logic is modified by this module.
 */
(() => {
  'use strict';
  const COLORS = {
    happy: {body:0x8FCAB1,metal:0x468E76,shine:0xD7FFF0,face:0x1C3D37},
    neutral: {body:0xE0C18B,metal:0xAA8750,shine:0xFFF2CD,face:0x453D2F},
    sad: {body:0xD8A69B,metal:0xB37469,shine:0xFFEBE4,face:0x4A3835},
    unknown: {body:0xB7C3B9,metal:0x82998D,shine:0xE5FFF0,face:0x354840}
  };
  const LABELS = {happy:'Robot tiga dimensi dengan ekspresi senang', neutral:'Robot tiga dimensi dengan ekspresi netral', sad:'Robot tiga dimensi dengan ekspresi sedih', unknown:'Robot tiga dimensi menunggu data portofolio'};
  const instances = new WeakMap();
  let threePromise;
  function fallbackSVG(mood) {
    const fill={happy:'#8FCAB1',neutral:'#E0C18B',sad:'#D8A69B',unknown:'#B7C3B9'}[mood] || '#b5a9f4';
    const mouth=mood==='happy'?'<path d="M56 78 Q76 103 96 78"/>':mood==='sad'?'<path d="M56 91 Q76 71 96 91"/>':'<path d="M61 85 H91"/>';
    return `<svg aria-hidden="true" viewBox="0 0 165 185" class="jp3-fallback-svg"><defs><linearGradient id="jp3-fall-body" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff" stop-opacity=".38"/><stop offset=".32" stop-color="${fill}"/><stop offset="1" stop-color="#5c6482"/></linearGradient></defs><ellipse cx="83" cy="169" rx="56" ry="9" fill="#5a578d" opacity=".15"/><g class="jp3-floating-fallback"><rect x="27" y="29" width="110" height="112" rx="37" fill="url(#jp3-fall-body)"/><rect x="37" y="43" width="90" height="76" rx="29" fill="#27364b"/><path d="M38 54 Q62 37 95 46" fill="none" stroke="white" stroke-width="7" opacity=".18"/><rect x="67" y="8" width="16" height="25" rx="8" fill="${fill}"/><circle cx="75" cy="8" r="9" fill="${fill}"/><rect x="16" y="75" width="14" height="37" rx="7" fill="${fill}"/><rect x="134" y="75" width="14" height="37" rx="7" fill="${fill}"/><g stroke="#d8fff3" stroke-width="6" fill="none" stroke-linecap="round">${mouth}</g><ellipse cx="60" cy="70" rx="8" ry="5" fill="#d8fff3"/><ellipse cx="98" cy="70" rx="8" ry="5" fill="#d8fff3"/><rect x="50" y="133" width="19" height="18" rx="8" fill="${fill}"/><rect x="97" y="133" width="19" height="18" rx="8" fill="${fill}"/></g></svg>`;
  }
  function wantsMotion(){return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;}
  function makeFallback(host,mood){
    host.innerHTML=`<div class="jp3-fallback" aria-hidden="true">${fallbackSVG(mood)}</div>`;
    host.setAttribute('role','img');host.setAttribute('aria-label',LABELS[mood]||LABELS.unknown);
  }
  function loadThree(){
    if(!threePromise) threePromise=import('https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js');
    return threePromise;
  }
  function roundedBox(THREE,w,h,depth,r,material){
    const x=-w/2,y=-h/2;
    const s=new THREE.Shape();
    s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);
    s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);
    s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);
    const geom=new THREE.ExtrudeGeometry(s,{depth,steps:1,curveSegments:7,bevelEnabled:true,bevelThickness:.08,bevelSize:.08,bevelSegments:4});
    geom.translate(0,0,-depth/2);
    const mesh=new THREE.Mesh(geom,material);return mesh;
  }
  async function mount(host,mood='unknown'){
    if(!host) return null;
    mood=COLORS[mood]?mood:'unknown';
    const previous=instances.get(host);
    if(previous){previous.setMood(mood);return previous;}
    makeFallback(host,mood);
    const state={mood, alive:true, setMood(next){this.mood=COLORS[next]?next:'unknown';host.setAttribute('aria-label',LABELS[this.mood]);if(this.changeMood)this.changeMood(this.mood);else makeFallback(host,this.mood);}, destroy(){this.alive=false;if(this.cleanup)this.cleanup();instances.delete(host);}};
    instances.set(host,state);
    if(!window.matchMedia('(max-width: 820px)').matches && !host.dataset.force3d){return state;}
    try{
      const THREE=await loadThree();
      if(!state.alive||!host.isConnected)return state;
      let renderer;
      try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});}catch(err){return state;}
      renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));
      renderer.domElement.className='jp3-canvas';
      renderer.domElement.setAttribute('aria-hidden','true');
      const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(33,1,.1,100);camera.position.set(0,.12,7.2);camera.lookAt(0,.12,0);
      scene.add(new THREE.AmbientLight(0xffffff,1.4));
      const main=new THREE.DirectionalLight(0xffffff,2.4);main.position.set(-2.2,4,5);scene.add(main);
      const rim=new THREE.DirectionalLight(0xbbbbff,1.8);rim.position.set(3,1,-4);scene.add(rim);
      const bot=new THREE.Group();scene.add(bot);
      const pearl=(c,rough=.27)=>new THREE.MeshPhysicalMaterial({color:c,metalness:.16,roughness:rough,clearcoat:.85,clearcoatRoughness:.16});
      const bodyMat=pearl(COLORS[mood].body), metalMat=pearl(COLORS[mood].metal,.35), faceMat=pearl(COLORS[mood].face,.23);
      const eyeMat=new THREE.MeshBasicMaterial({color:COLORS[mood].shine});
      const blushMat=new THREE.MeshBasicMaterial({color:0xff93b2,transparent:true,opacity:.42});
      const head=roundedBox(THREE,2.22,2.02,.74,.47,bodyMat);head.position.set(0,.22,0);bot.add(head);
      const face=roundedBox(THREE,1.75,1.42,.07,.38,faceMat);face.position.set(0,.23,.51);bot.add(face);
      const glass=new THREE.Mesh(new THREE.PlaneGeometry(1.23,.11),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.13,depthWrite:false}));glass.position.set(-.14,.72,.64);glass.rotation.z=.15;bot.add(glass);
      const eyes=[];
      for(const x of [-.45,.45]){
        const eye=new THREE.Mesh(new THREE.SphereGeometry(.115,24,16),eyeMat);eye.scale.set(1.25,.68,.45);eye.position.set(x,.35,.66);bot.add(eye);eyes.push(eye);
        const blush=new THREE.Mesh(new THREE.SphereGeometry(.18,16,12),blushMat);blush.scale.set(1,.48,.15);blush.position.set(x*1.1,-.12,.64);bot.add(blush);
      }
      let mouth;
      function setMouth(type){
        if(mouth){bot.remove(mouth);mouth.geometry.dispose();}
        const ys=type==='happy'?[-.28,-.43,-.28]:type==='sad'?[-.43,-.26,-.43]:[-.33,-.33,-.33];
        const path=new THREE.CatmullRomCurve3([new THREE.Vector3(-.34,ys[0],.69),new THREE.Vector3(0,ys[1],.7),new THREE.Vector3(.34,ys[2],.69)]);
        mouth=new THREE.Mesh(new THREE.TubeGeometry(path,25,.039,10,false),eyeMat);bot.add(mouth);
      }
      const antenna=new THREE.Mesh(new THREE.CylinderGeometry(.07,.085,.36,18),metalMat);antenna.position.set(0,1.48,0);bot.add(antenna);
      const antennaDot=new THREE.Mesh(new THREE.SphereGeometry(.16,20,14),bodyMat);antennaDot.position.set(0,1.7,0);bot.add(antennaDot);
      const armL=roundedBox(THREE,.28,.62,.34,.11,metalMat);armL.position.set(-1.28,-.06,-.02);bot.add(armL);
      const armR=roundedBox(THREE,.28,.62,.34,.11,metalMat);armR.position.set(1.28,-.06,-.02);bot.add(armR);
      const footL=roundedBox(THREE,.36,.4,.5,.13,metalMat);footL.position.set(-.54,-1.04,.04);bot.add(footL);
      const footR=roundedBox(THREE,.36,.4,.5,.13,metalMat);footR.position.set(.54,-1.04,.04);bot.add(footR);
      const shadow=new THREE.Mesh(new THREE.CircleGeometry(.94,40),new THREE.MeshBasicMaterial({color:0x455477,transparent:true,opacity:.17,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.scale.set(1,.27,1);shadow.position.set(0,-1.53,0);scene.add(shadow);
      state.changeMood=(type)=>{
        const v=COLORS[type];bodyMat.color.setHex(v.body);metalMat.color.setHex(v.metal);faceMat.color.setHex(v.face);eyeMat.color.setHex(v.shine);setMouth(type);
        eyes.forEach(e=>e.scale.y=type==='happy'?.43:type==='sad'?.54:.72);
      };
      state.changeMood(state.mood);
      host.replaceChildren(renderer.domElement);
      const resize=()=>{const w=Math.max(host.clientWidth,100),h=Math.max(host.clientHeight,120);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};
      resize();const ro=new ResizeObserver(resize);ro.observe(host);
      let currentInView=true;
      const io=new IntersectionObserver(entries=>{currentInView=!!entries[0]?.isIntersecting;},{threshold:.02});io.observe(host);
      let raf=0,clock=0,blink=0,wave=0;
      const motionQuery=window.matchMedia('(prefers-reduced-motion: reduce)');
      const tick=(now)=>{
        if(!state.alive)return;
        if(!document.hidden && currentInView && host.getClientRects().length){
          clock=now*.001;
          const animate=wantsMotion();
          const bob=animate?Math.sin(clock*1.7)*.095:0;
          bot.position.y=bob;
          bot.rotation.y=animate?Math.sin(clock*.74)*.16:-.09;
          bot.rotation.z=animate?Math.sin(clock*.66)*.042:0;
          bot.rotation.x=animate?Math.sin(clock*.49)*.026:0;
          armR.rotation.z=animate?Math.sin(clock*2.1)*.09 + Math.sin(wave)*.13:0;
          shadow.material.opacity=animate?.13-bob*.12:.13;
          blink=animate?(Math.sin(clock*.84*2.0)> .997? .10:1):1;
          eyes.forEach(e=>{e.scale.y=(state.mood==='happy'?.43:state.mood==='sad'?.54:.72)*blink;});
          renderer.render(scene,camera);
        }
        raf=requestAnimationFrame(tick);
      };
      renderer.domElement.addEventListener('pointerdown',()=>{wave=clock*4;},{passive:true});
      raf=requestAnimationFrame(tick);
      state.cleanup=()=>{cancelAnimationFrame(raf);ro.disconnect();io.disconnect();renderer.dispose();scene.traverse(o=>{if(o.geometry)o.geometry.dispose();});};
    }catch(error){
      console.info('[JP Buddy] Renderer 3D tidak tersedia; menggunakan animasi ringan SVG.',error?.message||error);
    }
    return state;
  }
  window.JPBot3D={mount,setMood:(host,mood)=>{if(instances.has(host))instances.get(host).setMood(mood);else mount(host,mood);},destroy:(host)=>instances.get(host)?.destroy()};
})();
