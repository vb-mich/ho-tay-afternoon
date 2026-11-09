export const WIDTH = 1672;
export const HEIGHT = 941;
export const SPAWN = { x: 1091, y: 818 };

const paths = [
  [[350,938],[500,868],[700,754],[818,685],[885,649],[1080,548],[1240,463],
   [1400,378],[1540,306],[1662,246],[1662,780],[1540,792],[1505,856],[1450,938]],
  [[550,518],[593,503],[831,645],[822,688],[782,689],[738,651],[652,591]],
  [[557,520],[571,488],[580,460],[611,443],[640,458],[647,475],[623,501],[610,524],[587,548]],
  [[566,477],[541,455],[517,447],[485,465],[479,445],[524,405],[558,404],[583,419],[617,443],[604,467],[584,490]]
];
const obstacles = [
  [[671,784],[720,754],[754,759],[749,783],[700,814],[672,813]],
  [[906,641],[960,608],[985,612],[989,632],[938,661],[907,658]],
  [[1030,513],[1117,469],[1193,488],[1197,505],[1107,552],[1030,539]],
  [[1190,511],[1233,484],[1254,490],[1250,503],[1207,528],[1190,522]],
  [[1256,445],[1318,420],[1370,432],[1359,451],[1296,485],[1256,472]],
  [[1385,404],[1439,371],[1490,380],[1495,396],[1430,434],[1385,429]],
  [[1349,681],[1399,662],[1445,697],[1457,747],[1428,751],[1362,722]],
  [[1422,670],[1478,638],[1611,705],[1596,768],[1567,778],[1437,714]],
  [[1524,682],[1610,632],[1672,652],[1672,762],[1581,760]],
  [[1060,590],[1070,577],[1090,580],[1095,592],[1081,601]],
  [[1008,755],[1031,739],[1054,741],[1062,759],[1036,773]],
  [[1352,558],[1367,545],[1383,550],[1388,568],[1367,576]]
];

function inside({x,y}, polygon) {
  let hit = false;
  for (let i=0, j=polygon.length-1; i<polygon.length; j=i++) {
    const [a,b]=polygon[i], [c,d]=polygon[j];
    if ((b>y)!==(d>y) && x<(c-a)*(y-b)/(d-b)+a) hit=!hit;
  }
  return hit;
}

function onGround(p) {
  return paths.some(poly=>inside(p,poly)) && !obstacles.some(poly=>inside(p,poly));
}

export function walkable({x,y}) {
  return onGround({x,y}) && onGround({x:x-5,y}) && onGround({x:x+5,y})
    && onGround({x,y:y-4}) && onGround({x,y:y+4});
}

export const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const cell = 13;
const cols = Math.ceil(WIDTH/cell);
const rows = Math.ceil(HEIGHT/cell);
const grid = Array.from({length:cols*rows},(_,i)=>{
  const x=(i%cols+.5)*cell, y=(Math.floor(i/cols)+.5)*cell;
  return walkable({x,y}) ? {x,y,i} : null;
});
const floorNodes = grid.filter(Boolean);
const offsets = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];

export function clearLine(a,b) {
  const steps=Math.ceil(distance(a,b)/4);
  for (let i=1;i<=steps;i++) {
    const t=i/steps;
    if (!walkable({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t})) return false;
  }
  return true;
}

function nearest(point, from, max) {
  let best, bestDistance=max;
  for (const node of floorNodes) {
    const d=distance(point,node);
    if (d<bestDistance && (!from || clearLine(from,node))) {
      best=node;
      bestDistance=d;
    }
  }
  return best;
}

export function findRoute(from, requested, snap=40) {
  const target=walkable(requested) ? requested : nearest(requested,null,snap);
  if (!target) return null;
  if (clearLine(from,target)) return [target];
  const start=nearest(from,from,cell*3);
  const end=nearest(target,target,cell*3);
  if (!start || !end) return null;
  const open=[{...start,score:distance(start,end)}];
  const cost=new Map([[start.i,0]]);
  const prev=new Map();
  const seen=new Set();
  while (open.length) {
    open.sort((a,b)=>b.score-a.score);
    const node=open.pop();
    if (seen.has(node.i)) continue;
    if (node.i===end.i) {
      const raw=[target];
      for(let i=end.i;i!==start.i;i=prev.get(i)) raw.push(grid[i]);
      raw.push(start);
      raw.reverse();
      const route=[];
      for (let i=0;i<raw.length;) {
        const source=route.at(-1)??from;
        let far=raw.length-1;
        while (far>i && !clearLine(source,raw[far])) far--;
        route.push(raw[far]);
        i=far+1;
      }
      return route;
    }
    seen.add(node.i);
    for (const [dx,dy] of offsets) {
      const x=node.i%cols+dx, y=Math.floor(node.i/cols)+dy;
      if (x<0 || x>=cols || y<0 || y>=rows) continue;
      const next=grid[y*cols+x];
      if (!next || seen.has(next.i) || !clearLine(node,next)) continue;
      const nextCost=cost.get(node.i)+distance(node,next);
      if (nextCost>=(cost.get(next.i)??Infinity)) continue;
      cost.set(next.i,nextCost);
      prev.set(next.i,node.i);
      open.push({...next,score:nextCost+distance(next,end)});
    }
  }
  return null;
}

export const STOPS = [
  {id:'minh',name:'Minh',type:'NEIGHBOR',label:'Talk to Minh',x:1033,y:755,markerY:649,approach:{x:1080,y:785},
    note:'A familiar face on the Thanh Niên promenade.',
    lines:['Chào bạn! I’m Minh. I take this walk most days. The city sounds different when you stop beside the water.',
      'Lan is farther up the promenade. If you have time, ask her what she looks for on the lake. Then follow the stone causeway to the pagoda.']},
  {id:'lan',name:'Lan',type:'LAKESIDE WALKER',label:'Talk to Lan',x:1367,y:567,markerY:459,approach:{x:1328,y:583},
    note:'A little ritual for slowing down by the lake.',
    lines:['I always look for one small thing I missed yesterday. Today it was the red roof in the water. One ripple, and it was gone.',
      'Take your time at Trấn Quốc. There’s a lovely moment on the causeway when the promenade goes quiet behind you.']},
  {id:'pagoda',name:'Trấn Quốc Pagoda',type:'LANDMARK',label:'Visit Trấn Quốc',x:589,y:514,markerY:388,approach:{x:590,y:520},
    note:'The stone causeway leads from the promenade to the temple gate.',
    lines:['The water laps against the stone below. Ahead, red tiles catch the sun and footsteps soften at the temple gate.',
      'You pause for a moment before turning back toward the bustle of Thanh Niên.']},
  {id:'board',name:'Bảng tin',type:'COMMUNITY NOTICEBOARD',label:'Read the noticeboard',x:1510,y:738,markerY:522,approach:{x:1483,y:781},
    note:'A neighborhood noticeboard beside the bicycle.',
    lines:['Between snapshots of Hồ Tây and a handwritten bicycle repair ad, someone has pinned a note.',
      '“If you have a moment, take a walk by the lake. There’s always something new to see.”']}
];
