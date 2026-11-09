// Small feathered pieces of the painted canopy move around their branch roots.
const canopyZones=[
  [647,33,183,95,-.9], [1025,81,189,87,1.4], [1147,223,172,103,2.8],
  [1262,284,105,59,4.2], [1502,129,140,83,5.5],
];
const lakeZones=[
  [41,577,129,119],[375,541,151,126],[453,692,87,65],
  [395,40,184,117],[654,286,83,92],[806,389,109,91],[946,112,95,77],
];
const leafOrigins=[[811,111],[1090,276],[1189,243],[1322,287],[1527,185],[1350,203]];
const leafColors=['#a8b64c','#d6c152','#73924a','#c4a64b','#97a23c','#bb9741'];
const turn=Math.PI*2;
const rand=seed=>((Math.sin(seed*127.1+311.7)*43758.5453)%1+1)%1;

export function createSceneMotion(art) {
  const crowns=canopyZones.map(([x,y,rx,ry,phase])=>{
    const image=document.createElement('canvas');
    image.width=rx*2;image.height=ry*2;
    const context=image.getContext('2d');
    context.drawImage(art,rx-x,ry-y);
    const mask=context.createRadialGradient(0,0,.37,0,0,1);
    mask.addColorStop(0,'#fff');
    mask.addColorStop(.68,'#ffffffdc');
    mask.addColorStop(1,'#fff0');
    context.setTransform(rx,0,0,ry,rx,ry);
    context.globalCompositeOperation='destination-in';
    context.fillStyle=mask;
    context.fillRect(-1,-1,2,2);
    return {image,x,y,rx,ry,phase};
  });
  const glimmers=lakeZones.flatMap(([x,y,w,h],zone)=>Array.from({length:4},(_,i)=>{
    const seed=zone*13+i;
    return {x:x+rand(seed)*w,y:y+rand(seed+20)*h,width:4+rand(seed+31)*14,
      offset:rand(seed+40),period:3+rand(seed+70)*4};
  }));

  return function draw(context,time) {
    for(const {image,x,y,rx,ry,phase} of crowns) {
      const gust=Math.sin(time*.91+phase)+Math.sin(time*1.58+phase*.4)*.36;
      context.save();
      context.translate(x+gust*2.8,y+gust*1.3);
      context.rotate(gust*.012);
      context.drawImage(image,-rx,-ry);
      context.restore();
    }
    context.lineCap='round';
    for(const glint of glimmers) {
      const phase=(time/glint.period+glint.offset)%1;
      const pulse=Math.sin(phase*Math.PI)**5;
      const x=glint.x+Math.sin(phase*turn)*3;
      const width=glint.width*(.55+pulse*.45);
      context.lineWidth=.7+pulse;
      context.strokeStyle='rgba(211,255,230,'+(pulse*.48)+')';
      context.beginPath();
      context.moveTo(x-width/2,glint.y);
      context.lineTo(x+width/2,glint.y);
      context.stroke();
    }
    leafOrigins.forEach(([originX,originY],i)=>{
      const clock=time*.9+i*2.46;
      const period=11+i%3*1.25;
      const cycle=Math.floor(clock/period);
      const age=clock%period;
      const life=5.4+rand(cycle*23+i)*2.5;
      if(age>=life) return;
      const seed=cycle*19+i;
      const x=originX+age*(10+rand(seed)*10)+Math.sin(age*1.7+i)*14;
      const y=originY+age*(23+rand(seed+3)*17)+Math.sin(age*2+i)*5;
      const flutter=Math.cos(age*5+i);
      context.save();
      context.translate(x,y);
      context.rotate(age*1.6+i);
      context.scale(1,.23+Math.abs(flutter)*.77);
      context.globalAlpha=Math.min(1,age*1.7,(life-age)*.82)*.88;
      context.fillStyle=leafColors[(i+cycle)%leafColors.length];
      context.beginPath();
      context.moveTo(-4,0);
      context.quadraticCurveTo(0,-3.5,5,0);
      context.quadraticCurveTo(1,3.1,-4,0);
      context.fill();
      context.strokeStyle='#f5dfa06b';
      context.lineWidth=.55;
      context.beginPath();
      context.moveTo(-3,0);
      context.lineTo(3.6,0);
      context.stroke();
      context.restore();
    });
  };
}
