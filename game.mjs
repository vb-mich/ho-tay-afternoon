import {WIDTH,HEIGHT,SPAWN,STOPS,clearLine,distance,findRoute} from './world.mjs';
import {createCamera,bindCameraGestures} from './camera.mjs';
import {createSceneMotion} from './scene-motion.mjs';

const $=id=>document.getElementById(id);
const canvas=$('world'), ctx=canvas.getContext('2d',{alpha:false});
const mini=$('minimap');
const panel=$('panel');
const art=document.createElement('canvas');
art.width=WIDTH;
art.height=HEIGHT;
const landscape=new Image(), livingScene=new Image();
const actors=[
  {stop:STOPS.find(stop=>stop.id==='minh'),frame:0,height:96,phase:.2},
  {stop:STOPS.find(stop=>stop.id==='lan'),frame:1,height:93,phase:2.1},
].sort((a,b)=>a.stop.y-b.stop.y);
let drawSceneMotion;
const playerAtlas=new Image();
const spriteRows=[
  {top:0, centers:[226,667,1116,1566], ground:[414,411,414,412]},
  {top:443, centers:[224,667,1114,1561], ground:[404,404,389,406]},
];
const walkFrames=[1,2,3,2];
const spriteScale=.24;
const player={...SPAWN,side:1,back:false,phase:0,moving:false};
const keys=new Set(), touches=new Map();
const keyDirs={w:'up',a:'left',s:'down',d:'right',arrowup:'up',arrowleft:'left',arrowdown:'down',arrowright:'right'};
const speed=188;
const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
const camera=createCamera(WIDTH,HEIGHT);
const {view}=camera;
const saveKey='ho-tay-afternoon-v1';
const questStops=STOPS.filter(stop=>stop.id!=='board');
const markers=STOPS.map(stop=>{
  const button=document.createElement('button');
  button.className='marker';
  button.setAttribute('aria-label',stop.label);
  button.title=stop.label;
  button.addEventListener('click',()=>approach(stop));
  $('markers').append(button);
  return {stop,button};
});
let route=[], requestedStop=null, target=null, nearbyStop=null, toastTimer;
let last=0, elapsed=0, audio, isMuted=true, audioVolume;
let visited=loadVisited();

function loadVisited() {
  try {
    const list=JSON.parse(localStorage.getItem(saveKey)??'[]');
    return new Set(Array.isArray(list)?list.filter(id=>STOPS.some(stop=>stop.id===id)):[]);
  } catch {
    return new Set();
  }
}

function save() {
  try { localStorage.setItem(saveKey,JSON.stringify([...visited])); }
  catch { /* Keep progress for this visit when browser storage is unavailable. */ }
}

function announce(message) {
  const toast=$('toast');
  toast.textContent=message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>toast.classList.remove('show'),2800);
}

function updateQuest() {
  const done=questStops.filter(stop=>visited.has(stop.id)).length;
  $('count').textContent=done+' / '+questStops.length;
  document.querySelectorAll('.progress i').forEach((item,i)=>item.classList.toggle('filled',i<done));
  const hints=['Meet Minh on the promenade.','Find Lan under the trees.','Cross the causeway to Trấn Quốc.'];
  const next=questStops.findIndex(stop=>!visited.has(stop.id));
  $('objective').textContent=next<0?'Walk complete. Enjoy the lake.':hints[next];
}

function fitCanvas() {
  const {width,height}=canvas.getBoundingClientRect();
  const dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=Math.round(width*dpr);
  canvas.height=Math.round(height*dpr);
  camera.resize(width,height,dpr,player);
}

function setPosition(x,y) {
  const dx=x-player.x, dy=y-player.y;
  if (Math.abs(dx)>.08) player.side=Math.sign(dx);
  if (Math.abs(dy)>.08) player.back=dy<0;
  player.moving ||= Math.hypot(dx,dy)>.05;
  player.x=x;
  player.y=y;
}

function cancelRoute() {
  route=[];
  target=null;
  requestedStop=null;
}

function step(dt) {
  player.moving=false;
  if (panel.open) return;
  const held=new Set([...keys,...touches.values()]);
  const dx=Number(held.has('right'))-Number(held.has('left'));
  const dy=Number(held.has('down'))-Number(held.has('up'));
  if (dx||dy) {
    cancelRoute();
    const delta=speed*dt/Math.hypot(dx,dy);
    const x=player.x+dx*delta,y=player.y+dy*delta;
    if (clearLine(player,{x,y})) setPosition(x,y);
    else if (dx&&clearLine(player,{x,y:player.y})) setPosition(x,player.y);
    else if (dy&&clearLine(player,{x:player.x,y})) setPosition(player.x,y);
  } else if (route.length) {
    let remaining=speed*dt;
    while (route.length&&remaining>0) {
      const next=route[0], len=distance(player,next);
      if (len<=remaining) {
        setPosition(next.x,next.y);
        remaining-=len;
        route.shift();
      } else {
        const f=remaining/len;
        setPosition(player.x+(next.x-player.x)*f,player.y+(next.y-player.y)*f);
        remaining=0;
      }
    }
    if (!route.length) {
      const stop=requestedStop;
      cancelRoute();
      if (stop&&distance(player,stop)<=91) openStop(stop);
    }
  }
  player.phase=player.moving?(player.phase+dt*8)%walkFrames.length:0;
}

function walkTo(point,stop=null,snap) {
  if (panel.open) return;
  const result=findRoute(player,point,snap);
  if (!result) {
    announce('Stay on the promenade or the stone causeway.');
    return;
  }
  route=result;
  target=stop?null:result.at(-1);
  requestedStop=stop;
}

function oval(context,x,y,rx,ry,color) {
  context.fillStyle=color;
  context.beginPath();
  context.ellipse(x,y,rx,ry,0,0,Math.PI*2);
  context.fill();
}

function drawActor({stop,frame,height,phase}) {
  const breath=motionPreference.matches?0:Math.sin(elapsed*2+phase);
  const sway=motionPreference.matches?0:Math.sin(elapsed*1.14+phase);
  const scale=height/154;
  ctx.save();
  ctx.translate(stop.x+13,stop.y-2);
  ctx.rotate(-.28);
  oval(ctx,0,0,24,6,'#443e7153');
  ctx.restore();
  oval(ctx,stop.x,stop.y,10,3,'#4b394a69');

  ctx.save();
  ctx.translate(stop.x,stop.y);
  // The feet stay planted as the upper body shifts with the breathing cycle.
  ctx.transform(1,0,sway*.018,1+breath*.013,0,0);
  ctx.drawImage(livingScene,frame*96,132,96,160,
    -48*scale,-158*scale,96*scale,160*scale);
  ctx.restore();
}

function drawPlayer() {
  const row=spriteRows[Number(player.back)];
  const frame=player.moving&&!motionPreference.matches?walkFrames[Math.floor(player.phase)]:0;
  const width=224, height=426;
  const ground=row.ground[frame];
  ctx.save();
  ctx.translate(player.x+13,player.y-2);
  ctx.rotate(-.28);
  oval(ctx,0,0,23,6,'#443e7148');
  ctx.restore();
  oval(ctx,player.x,player.y,11,3,'#4b394a66');

  ctx.save();
  ctx.translate(player.x,player.y);
  ctx.scale(player.side*spriteScale,spriteScale);
  ctx.drawImage(playerAtlas,row.centers[frame]-width/2,row.top,width,height,
    -width/2,-ground,width,height);
  ctx.restore();
}

function updateMarkers() {
  for (const {stop,button} of markers) {
    const x=view.x+stop.x*view.scale;
    const y=view.y+(stop.markerY+(motionPreference.matches?0:Math.sin(elapsed*2+stop.x)*2))*view.scale;
    button.hidden=x<14||x>view.w-14||y<14||y>view.h-14;
    button.style.left=x+'px';
    button.style.top=y+'px';
    button.classList.toggle('active',stop===nearbyStop||stop===requestedStop);
    const symbol=visited.has(stop.id)?'✓':stop.id==='board'?'≡':'✦';
    if(button.textContent!==symbol) button.textContent=symbol;
  }
}

function drawMap(element,frame=false) {
  const m=element.getContext('2d');
  const sx=element.width/WIDTH,sy=element.height/HEIGHT;
  m.setTransform(sx,0,0,sy,0,0);
  m.drawImage(art,0,0,WIDTH,HEIGHT);
  m.fillStyle='#173f3150';m.fillRect(0,0,WIDTH,HEIGHT);
  if (frame&&(view.w<WIDTH*view.scale||view.h<HEIGHT*view.scale)) {
    m.strokeStyle='#fff4d89a';m.lineWidth=9;
    m.strokeRect(Math.max(0,-view.x/view.scale),Math.max(0,-view.y/view.scale),
      Math.min(WIDTH,view.w/view.scale),Math.min(HEIGHT,view.h/view.scale));
  }
  for (const stop of STOPS) oval(m,stop.x,stop.y,19,19,visited.has(stop.id)?'#86dbc1':'#ffd988');
  oval(m,player.x,player.y,27,27,'#1a443b');
  oval(m,player.x,player.y,17,17,'#fff6d6');
}

function updateNearby() {
  const previous=nearbyStop;
  nearbyStop=panel.open?null:STOPS.reduce((best,stop)=>{
    const d=distance(player,stop);
    return d<=91&&(!best||d<distance(player,best))?stop:best;
  },null);
  const button=$('nearby');
  const stop=nearbyStop;
  $('touch-action').disabled=!stop;
  if (previous!==stop&&stop) {
    const key=document.createElement('kbd');
    key.textContent='E';
    button.replaceChildren(key,document.createTextNode(stop.label));
  }
  if (stop) {
    const x=view.x+stop.x*view.scale,y=view.y+(stop.markerY-23)*view.scale;
    button.style.left=Math.min(view.w-78,Math.max(78,x))+'px';
    button.style.top=Math.min(view.h-25,Math.max(145,y))+'px';
  }
  button.hidden=!stop||view.x+stop.x*view.scale<0||view.x+stop.x*view.scale>view.w
    ||view.y+stop.y*view.scale<0||view.y+stop.y*view.scale>view.h;
}

function paint() {
  ctx.setTransform(view.dpr,0,0,view.dpr,0,0);
  ctx.fillStyle='#174640';ctx.fillRect(0,0,view.w,view.h);
  ctx.translate(view.x,view.y);
  ctx.scale(view.scale,view.scale);
  ctx.drawImage(art,0,0);
  if (!motionPreference.matches) drawSceneMotion(ctx,elapsed);
  if (target) {
    oval(ctx,target.x,target.y,8,4,'#fff0c8b8');
    ctx.strokeStyle='#386657';ctx.lineWidth=1;ctx.stroke();
  }
  let paintedPlayer=false;
  for (const actor of actors) {
    if (!paintedPlayer&&player.y<actor.stop.y) {
      drawPlayer();
      paintedPlayer=true;
    }
    drawActor(actor);
  }
  if (!paintedPlayer) drawPlayer();
  updateMarkers();
  drawMap(mini,true);
  camera.markPainted();
}

function tick(now) {
  const dt=Math.min((now-(last||now))/1000,route.length?.28:.08);
  last=now;
  elapsed+=dt;
  step(dt);
  camera.update(player,dt,motionPreference.matches);
  updateNearby();
  paint();
  requestAnimationFrame(tick);
}

const content=$('panel-content'),actions=$('panel-actions');
function showPanel(kind,tag,title) {
  cancelRoute();
  keys.clear();touches.clear();
  panel.dataset.kind=kind;
  $('panel-tag').textContent=tag;
  $('panel-title').textContent=title;
  content.replaceChildren();
  actions.replaceChildren();
  if (!panel.open) panel.showModal();
}

function paragraph(text,cls) {
  const p=document.createElement('p');
  p.textContent=text;
  if(cls) p.className=cls;
  content.append(p);
}

function action(text,fn,cls='secondary') {
  const button=document.createElement('button');
  button.className=cls;
  button.textContent=text;
  button.addEventListener('click',fn);
  actions.append(button);
  return button;
}

function openStop(stop) {
  showPanel('dialogue',stop.type,stop.name);
  const finish=()=>{
    const first=!visited.has(stop.id);
    visited.add(stop.id);
    save();
    updateQuest();
    panel.close();
    if (first) {
      const complete=stop.id!=='board'&&questStops.every(entry=>visited.has(entry.id));
      announce(complete?'Lakeside walk complete · All three journal entries found.':'Added to your journal · '+stop.name);
    }
  };
  let index=0;
  function line() {
    content.replaceChildren();
    actions.replaceChildren();
    paragraph(stop.lines[index]);
    action(index===stop.lines.length-1?'Back to the walk':'Continue',()=>{
      if (++index===stop.lines.length) finish();
      else line();
    },'primary').focus();
  }
  line();
}

function showJournal() {
  showPanel('journal','LAKESIDE WALK','Your journal');
  paragraph('Three stops on an afternoon walk by Hồ Tây.');
  const list=document.createElement('ul');
  list.className='journal-list';
  for (const stop of STOPS.filter(entry=>entry.id!=='board'||visited.has(entry.id))) {
    const row=document.createElement('li');
    const icon=document.createElement('span'),text=document.createElement('span');
    icon.textContent=visited.has(stop.id)?'✓':'◇';
    text.textContent=stop.name+' · '+(visited.has(stop.id)?stop.note:'Still to discover');
    row.append(icon,text);list.append(row);
  }
  content.append(list);
  action('Back to the walk',()=>panel.close(),'primary').focus();
}

function showMap() {
  showPanel('map','HÀ NỘI','West Lake');
  const mapLarge=document.createElement('canvas');
  mapLarge.width=850;mapLarge.height=478;mapLarge.className='map-large';
  mapLarge.setAttribute('aria-label','Map with player and discovery locations');
  content.append(mapLarge);
  drawMap(mapLarge);
  paragraph('Ivory marks your location. Gold marks places to visit. Jade marks discoveries. Choose a stop to walk there.','map-legend');
  action('Back to the walk',()=>panel.close(),'primary').focus();
  for (const stop of STOPS) action(stop.name,()=>{
    panel.close();
    approach(stop);
  });
}

function showHelp() {
  showPanel('help','FIELD GUIDE','How to play');
  paragraph('Move with WASD, the arrow keys, or the on-screen pad. You can also click or tap a path to walk there.');
  paragraph('Approach a person or landmark and press E, choose Interact, or tap its gold marker. Press J for your journal and M for the map.');
  paragraph('Scroll over the scene or pinch with two fingers to zoom. Use + and − for keyboard zoom, or 0 to reset the view.');
  paragraph('Journal progress stays on this device.');
  action('Resume walk',()=>panel.close(),'primary').focus();
  if (visited.size) action('Reset progress',confirmReset,'secondary danger');
}

function confirmReset() {
  showPanel('help','FIELD GUIDE','Start a new walk?');
  paragraph('This clears the journal and returns you to the promenade.');
  action('Keep exploring',showHelp,'primary').focus();
  action('Reset progress',()=>{
    visited.clear();save();updateQuest();Object.assign(player,SPAWN);camera.reset(player);
    panel.close();announce('A new walk begins.');
  },'secondary danger');
}

function interact() {
  if (nearbyStop&&!panel.open) openStop(nearbyStop);
  else if (!panel.open) announce('Move closer to a person or a landmark.');
}

async function toggleSound() {
  try {
    if (!audio) {
      audio=new (window.AudioContext||window.webkitAudioContext)();
      const length=audio.sampleRate*4, buffer=audio.createBuffer(1,length,audio.sampleRate);
      const data=buffer.getChannelData(0);
      let previous=0;
      for (let i=0;i<length;i++) {
        previous=previous*.86+(Math.random()*2-1)*.14;
        data[i]=previous;
      }
      const source=audio.createBufferSource(), filter=audio.createBiquadFilter();
      const ambient=audio.createGain();audioVolume=audio.createGain();
      source.buffer=buffer;source.loop=true;filter.type='lowpass';filter.frequency.value=580;
      ambient.gain.value=.23;audioVolume.gain.value=0;
      const wave=audio.createOscillator(), amount=audio.createGain();
      wave.frequency.value=.20;amount.gain.value=.1;
      wave.connect(amount).connect(ambient.gain);
      source.connect(filter).connect(ambient).connect(audioVolume).connect(audio.destination);
      source.start();wave.start();
    }
    if(audio.state==='suspended') await audio.resume();
    isMuted=!isMuted;
    audioVolume.gain.setTargetAtTime(isMuted?0:.34,audio.currentTime,.25);
    $('sound').setAttribute('aria-pressed',String(!isMuted));
    $('sound').setAttribute('aria-label',isMuted?'Enable lake ambience':'Mute lake ambience');
    $('speaker').setAttribute('d','M3 9h4l5-4v14l-5-4H3 '+(isMuted?'M16 9l5 6m0-6-5 6':'M16 9a4 4 0 0 1 0 6m2-9a8 8 0 0 1 0 12'));
    announce(isMuted?'Ambience off.':'Lake ambience on.');
  } catch { announce('Audio is unavailable in this browser.'); }
}

function keyDown(event) {
  if (event.altKey||event.ctrlKey||event.metaKey) return;
  const key=event.key.toLowerCase();
  if (panel.open) return;
  if (keyDirs[key]) {
    event.preventDefault();keys.add(keyDirs[key]);return;
  }
  if (event.repeat) return;
  if (key==='+'||key==='='||key==='-'||key==='0') {
    event.preventDefault();
    if (key==='0') camera.reset(player);
    else {
      const center={x:view.w/2,y:view.h/2};
      camera.zoomAt(key==='-'?1/1.2:1.2,center,center,player);
    }
    return;
  }
  if (key==='e') interact();
  if (key==='j') showJournal();
  if (key==='m') showMap();
  if (key==='escape'||key==='?') showHelp();
}

function approach(stop) {
  if (panel.open) return;
  if (distance(player,stop)<=91) openStop(stop);
  else walkTo(stop.approach,stop);
}

function walkPointer({point,zoom}) {
  // Keep the original on-screen hit and snap ranges as the camera zooms.
  const stop=STOPS.find(item=>distance(point,{x:item.x,y:item.markerY})<28/zoom
    ||distance(point,item)<26/zoom);
  if (stop) {
    approach(stop);
    return;
  }
  walkTo(point,null,40/zoom);
}

function start() {
  $('loading').hidden=true;
  updateQuest();fitCanvas();
  addEventListener('resize',fitCanvas);
  addEventListener('keydown',keyDown);
  addEventListener('keyup',event=>keys.delete(keyDirs[event.key.toLowerCase()]));
  addEventListener('blur',()=>{keys.clear();touches.clear();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();touches.clear();last=0;}});
  bindCameraGestures(canvas,camera,player,()=>!panel.open,walkPointer);
  for (const button of document.querySelectorAll('.dpad button')) {
    button.addEventListener('pointerdown',event=>{
      if(event.button!==0)return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      touches.set(event.pointerId,button.dataset.dir);
    });
    button.addEventListener('click',event=>{
      if (event.detail!==0||panel.open) return;
      const delta={up:[0,-38],down:[0,38],left:[-38,0],right:[38,0]}[button.dataset.dir];
      const next={x:player.x+delta[0],y:player.y+delta[1]};
      if (clearLine(player,next)) walkTo(next);
    });
    for (const name of ['pointerup','pointercancel','lostpointercapture']) {
      button.addEventListener(name,event=>touches.delete(event.pointerId));
    }
  }
  $('touch-action').addEventListener('click',interact);
  $('nearby').addEventListener('click',interact);
  $('journal').addEventListener('click',showJournal);
  $('map-button').addEventListener('click',showMap);
  $('help').addEventListener('click',showHelp);
  $('sound').addEventListener('click',toggleSound);
  $('close-panel').addEventListener('click',()=>panel.close());
  requestAnimationFrame(tick);
}

function loadImage(image,url) {
  image.src=url;
  return image.decode();
}

Promise.all([loadImage(landscape,'west-lake.webp'),loadImage(playerAtlas,'player-atlas.webp'),
  loadImage(livingScene,'living-scene.webp')])
  .then(()=>{
    const ground=art.getContext('2d',{alpha:false});
    ground.drawImage(landscape,0,0);
    // Cover the two figures baked into the original painting with aligned paving.
    ground.drawImage(livingScene,0,0,112,132,1011,647,112,132);
    ground.drawImage(livingScene,112,0,81,124,1338,458,81,124);
    drawSceneMotion=createSceneMotion(art);
    start();
  })
  .catch(()=>{
    $('loading').querySelector('p').textContent='The game art could not load. Refresh to try again.';
  });
