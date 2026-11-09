const clamp=(value,min,max)=>Math.max(min,Math.min(value,max));

export function createCamera(worldWidth,worldHeight) {
  const view={w:0,h:0,dpr:1,scale:1,x:0,y:0,zoom:1};
  const painted={x:0,y:0,scale:1,zoom:1};
  let base=1, panX=0, panY=0, ready=false;

  function limits() {
    const w=worldWidth*view.scale,h=worldHeight*view.scale;
    const bound=(position,viewport,map)=>map<=viewport?(viewport-map)/2:clamp(position,viewport-map,0);
    view.x=bound(view.x,view.w,w);
    view.y=bound(view.y,view.h,h);
  }

  function update(player,dt,reduced=false) {
    const ease=1-Math.exp(-dt*9);
    if (player.moving) {
      const drift=1-Math.exp(-dt*3);
      panX*=1-drift;
      panY*=1-drift;
    }
    const blend=!ready||reduced?1:ease;
    view.x+=(view.w*.48-player.x*view.scale+panX-view.x)*blend;
    view.y+=(view.h*.62-player.y*view.scale+panY-view.y)*blend;
    limits();
    ready=true;
  }

  function resize(width,height,dpr,player) {
    Object.assign(view,{w:width,h:height,dpr});
    base=width/height<1.18
      ? Math.max(width/worldWidth,height/worldHeight*.93)
      : Math.min(width/worldWidth,height/worldHeight);
    view.scale=base*view.zoom;
    panX=0;panY=0;ready=false;
    update(player,0);
  }

  function toWorld(point,projection=view) {
    return {x:(point.x-projection.x)/projection.scale,y:(point.y-projection.y)/projection.scale};
  }

  function presentedTarget(point) {
    return {point:toWorld(point,painted),zoom:painted.zoom};
  }

  function markPainted() {
    Object.assign(painted,{x:view.x,y:view.y,scale:view.scale,zoom:view.zoom});
  }

  function zoomAt(factor,point,previous,player) {
    const anchor=toWorld(previous);
    view.zoom=clamp(view.zoom*factor,1,2.6);
    view.scale=base*view.zoom;
    view.x=point.x-anchor.x*view.scale;
    view.y=point.y-anchor.y*view.scale;
    limits();
    panX=view.x-(view.w*.48-player.x*view.scale);
    panY=view.y-(view.h*.62-player.y*view.scale);
  }

  function reset(player) {
    view.zoom=1;view.scale=base;panX=0;panY=0;ready=false;
    update(player,0);
  }

  return {view,resize,update,presentedTarget,markPainted,zoomAt,reset};
}

export function bindCameraGestures(canvas,camera,player,canUse,walk) {
  const pointers=new Map();
  let gesture=false;
  let baseline;
  const pointFor=event=>{
    const rect=canvas.getBoundingClientRect();
    return {x:event.clientX-rect.left,y:event.clientY-rect.top};
  };
  function measure() {
    if(pointers.size!==2||[...pointers.values()].some(item=>item.type!=='touch')) return;
    const [a,b]=[...pointers.values()].map(item=>item.point);
    return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,gap:Math.hypot(b.x-a.x,b.y-a.y)};
  }
  function release(event) {
    const state=pointers.get(event.pointerId);
    if(!state) return;
    pointers.delete(event.pointerId);
    if(event.type==='pointerup'&&!gesture&&!state.dragged&&canUse()) {
      walk(camera.presentedTarget(pointFor(event)));
    }
    baseline=measure();
    if(!pointers.size) gesture=false;
  }
  canvas.addEventListener('pointerdown',event=>{
    if(event.button!==0||!canUse()) return;
    const point=pointFor(event);
    pointers.set(event.pointerId,{start:point,point,type:event.pointerType,dragged:false});
    canvas.setPointerCapture(event.pointerId);
    if(pointers.size>1) gesture=true;
    baseline=measure();
  });
  canvas.addEventListener('pointermove',event=>{
    const state=pointers.get(event.pointerId);
    if(!state) return;
    state.point=pointFor(event);
    state.dragged ||= Math.hypot(state.point.x-state.start.x,state.point.y-state.start.y)>9;
    const next=measure();
    if(canUse()&&baseline?.gap>=12&&next?.gap>=12) {
      camera.zoomAt(next.gap/baseline.gap,next,baseline,player);
    }
    baseline=next;
  });
  for(const name of ['pointerup','pointercancel','lostpointercapture']) canvas.addEventListener(name,release);
  canvas.addEventListener('wheel',event=>{
    if(!canUse()||!event.deltaY) return;
    event.preventDefault();
    const units=event.deltaMode===1?16:event.deltaMode===2?camera.view.h:1;
    const delta=clamp(event.deltaY*units,-160,160);
    const point=pointFor(event);
    camera.zoomAt(Math.exp(-delta*.0025),point,point,player);
  },{passive:false});
}
