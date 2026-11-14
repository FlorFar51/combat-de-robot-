import * as THREE from 'three';
const $=s=>document.querySelector(s), game=$('#game'), menu=$('#menu'), arenaScreen=$('#arena-screen'), renderCanvas=$('#arena-canvas');
window.__arenaModuleStarted=true;
window.__showArenaDiagnostic?.('Module chargé : initialisation du moteur 3D…');
const scene=new THREE.Scene();scene.background=new THREE.Color(0x080808);scene.fog=null;
const camera=new THREE.PerspectiveCamera(48,1,.1,200);camera.position.set(0,18,20);
let renderer=null;
try {
 renderer=new THREE.WebGLRenderer({canvas:renderCanvas,antialias:true,alpha:false});
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));
 renderer.shadowMap.enabled=true;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor(0x080808,1);
 window.__arenaRendererReady=true;window.__hideArenaDiagnostic?.();
} catch(error) {
 window.__showArenaDiagnostic?.('WEBGL INDISPONIBLE : '+(error?.message||String(error)),true);
}
scene.add(new THREE.HemisphereLight(0xaaaaaa,0x333333,1.7));const sun=new THREE.DirectionalLight(0xffffff,2);sun.position.set(-8,16,9);sun.castShadow=true;scene.add(sun);
const world=new THREE.Group();scene.add(world);const keys={};
const DEFAULT_BINDINGS={forward:'KeyZ',left:'KeyQ',right:'KeyD',action:'KeyE'};let bindings={...DEFAULT_BINDINGS},waitingForBind=null,assigning=null,activeGamepad=null,lastSawKey=false,lastControllerSaw=false,sawEnabled=false;
const controllerMap={throttle:{axis:1,invert:-1},steering:{axis:0,invert:1},saw:{button:0}};
let invertThrottle=false,invertSteering=false;
let mode='combat',player,enemy,puck,ended=true,countdown=0,remaining=120,aiLevel='normal',scoreBlue=0,scoreRed=0,roundBlue=0,roundRed=0,goalLock=0,tunedSpeed=2.7,tunedRotation=2.0;
const clock=new THREE.Clock(),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),rand=(a,b)=>a+Math.random()*(b-a);
const mat=(color,metalness=.25,roughness=.55)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
const M={floor:mat(0x333333),black:mat(0x111111,.65,.35),steel:mat(0x888888,.8,.25),blue:mat(0x59636c,.7,.32),red:mat(0xaaaaaa,.7,.32),rubber:mat(0x090909,.1,.9),line:mat(0xeeeeee)};
function add(geo,material,parent,x=0,y=0,z=0){const o=new THREE.Mesh(geo,material);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
function clearWorld(){while(world.children.length){const o=world.children[0];world.remove(o);o.traverse(n=>{if(n.geometry)n.geometry.dispose()})}puck=null}
function floorBox(w,d,material){add(new THREE.BoxGeometry(w,.45,d),material,world,0,-.28,0)}
function buildArena(){
 clearWorld();
 if(mode==='sumo'){
  add(new THREE.CylinderGeometry(9.1,9.1,.5,96),M.black,world,0,-.45,0);
  add(new THREE.CylinderGeometry(8.65,8.65,.08,96),M.floor,world,0,-.15,0);
  const ring=add(new THREE.TorusGeometry(8.3,.075,8,96),M.line,world,0,-.095,0);ring.rotation.x=Math.PI/2;
  for(const x of [-.8,.8])add(new THREE.BoxGeometry(.1,.02,1),M.line,world,x,-.09,0);
  return;
 }
 const arenaWidth=mode==='hockey'?32:28,arenaDepth=mode==='hockey'?18:28,halfWidth=arenaWidth/2,halfDepth=arenaDepth/2;
 floorBox(arenaWidth,arenaDepth,mode==='hockey'?mat(0x666666):M.floor);
 if(mode==='combat'){
  for(const [x,z,w,d] of [[0,-halfDepth,arenaWidth,.35],[0,halfDepth,arenaWidth,.35],[-halfWidth,0,.35,arenaDepth],[halfWidth,0,.35,arenaDepth]])add(new THREE.BoxGeometry(w,1,d),M.black,world,x,.25,z);
  const grid=new THREE.GridHelper(arenaWidth-1,32,0x777777,0x444444);grid.position.y=-.03;world.add(grid);return;
 }
 // Patinoire rectangulaire : les cages sont placées à gauche et à droite.
 for(const z of [-halfDepth,halfDepth])add(new THREE.BoxGeometry(arenaWidth,.65,.3),M.black,world,0,.12,z);
 for(const x of [-halfWidth,halfWidth]){
  for(const z of [-5.3,5.3])add(new THREE.BoxGeometry(.3,.65,7.4),M.black,world,x,.12,z);
  for(const z of [-2.3,2.3])add(new THREE.BoxGeometry(.12,1.25,.12),M.steel,world,x,.57,z);
  add(new THREE.BoxGeometry(.12,.12,4.6),M.steel,world,x,1.2,0);
  const net=add(new THREE.BoxGeometry(.9,.9,4.5),mat(0x222222),world,x+(x>0?.5:-.5),.52,0);net.material.transparent=true;net.material.opacity=.5;
 }
 const circle=add(new THREE.TorusGeometry(1.1,.025,6,48),M.line,world,0,-.025,0);circle.rotation.x=Math.PI/2;
}
function makeRobot(team){
 const root=new THREE.Group();world.add(root);const body=team==='blue'?M.blue:M.red,accent=team==='blue'?M.steel:M.line;
 const weapon=new THREE.Group();root.add(weapon);
 if(mode==='combat'){
  // Low, flat rectangular chassis; wide horizontal steel bar mounted at the front.
  add(new THREE.BoxGeometry(2.5,.36,1.75),body,root);
  add(new THREE.BoxGeometry(1.8,.12,1.25),M.black,root,0,.22,.05);
  for(const side of [-1,1])for(const front of [-1,1]){const wheel=add(new THREE.CylinderGeometry(.3,.3,.2,18),M.rubber,root,side*1.1,-.08,front*.55);wheel.rotation.z=Math.PI/2}
  const hub=add(new THREE.CylinderGeometry(.2,.2,.3,20),M.steel,weapon,0,.1,-.96);hub.rotation.x=Math.PI/2;
  add(new THREE.BoxGeometry(4.15,.17,.36),accent,weapon,0,.12,-1.04);
  for(const s of [-1,1])add(new THREE.BoxGeometry(.25,.22,.4),M.black,weapon,s*1.96,.12,-1.04);
 }else if(mode==='sumo'){
  // Square base, tapered four-sided shell, narrowing to a ridge where opposite edges meet.
  add(new THREE.BoxGeometry(2.1,.32,2.1),body,root,0,-.02,0);
  const v=new Float32Array([
   -1,0,-1, 1,0,-1, .48,1.35,0, -.48,1.35,0,
   1,0,-1, 1,0,1, .48,1.35,0,
   1,0,1, -1,0,1, -.48,1.35,0,
   -1,0,1, -1,0,-1, -.48,1.35,0
  ]);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(v,3));g.computeVertexNormals();
  const shell=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:team==='blue'?0x68737d:0xb0b0b0,metalness:.6,roughness:.4,side:THREE.DoubleSide}));root.add(shell);
  for(const s of [-1,1]){const wheel=add(new THREE.CylinderGeometry(.34,.34,.22,18),M.rubber,root,s*1.02,-.12,0);wheel.rotation.z=Math.PI/2}
  add(new THREE.BoxGeometry(1.8,.08,.18),accent,root,0,-.05,-1.03);
 }else{
  // Châssis carré, deux roues latérales et deux longerons droits parallèles à l'avant.
  add(new THREE.BoxGeometry(2.05,.4,.9),body,root);
  add(new THREE.BoxGeometry(1.65,.12,.72),M.black,root,0,.23,.02);
  for(const side of [-1,1]){const wheel=add(new THREE.CylinderGeometry(.32,.32,.24,20),M.rubber,root,side*1.03,-.1,0);wheel.rotation.z=Math.PI/2}
  for(const side of [-1,1]){
   const rail=add(new THREE.BoxGeometry(.272,.272,.382),accent,root,side*.72,.13,.70);rail.userData.hockeyFork=true;
   
  }
 }
 if(mode==='combat')weapon.scale.setScalar(.5);
 return {root,weapon,hp:100,v:0,alive:true,cooldown:0,contacts:0,contactCooldown:0,aiThink:0,aiOffsetX:0,aiOffsetZ:0,aiMode:'approach',aiThrottle:.8};
}
function resetPositions(){
 if(!player||!enemy)return;
 if(mode==='sumo'){player.root.position.set(-4.6,.12,0);player.root.rotation.y=Math.PI/2;enemy.root.position.set(4.6,.12,0);enemy.root.rotation.y=-Math.PI/2}
 else if(mode==='hockey'){player.root.position.set(-10,.12,0);player.root.rotation.y=Math.PI/2;enemy.root.position.set(10,.12,0);enemy.root.rotation.y=-Math.PI/2}
 else{player.root.position.set(-7.5,.12,0);player.root.rotation.y=Math.PI/2;enemy.root.position.set(7.5,.12,0);enemy.root.rotation.y=-Math.PI/2}
 for(const b of [player,enemy]){b.v=0;b.hp=100;b.alive=true;b.cooldown=0;b.puckTouchCooldown=0;b.contacts=0;b.contactCooldown=0;b.prevX=b.root.position.x;b.prevZ=b.root.position.z}
 if(puck){puck.position.set(0,.12,0);puck.userData.vx=puck.userData.vz=0}
}
function buildMatch(){buildArena();player=makeRobot('blue');enemy=makeRobot('red');if(mode==='hockey'){puck=add(new THREE.CylinderGeometry(.43,.43,.18,32),M.black,world,0,.12,0);puck.userData={vx:0,vz:0}}resetPositions()}
function drive(bot,dt,throttle,steer){
 if(!bot.alive)return;
 if(mode==='combat'||mode==='hockey'){
  // 1 unité 3D = 0,5 m : convertir la consigne physique en vitesse du terrain.
  const maxSpeed=tunedSpeed*2,targetSpeed=clamp(throttle,0,1)*maxSpeed;
  const response=mode==='hockey'?7.5:6.8;
  bot.v+=(targetSpeed-bot.v)*(1-Math.exp(-response*dt));
  bot.v=clamp(bot.v,0,maxSpeed);
  bot.root.rotation.y+=steer*tunedRotation*dt;
 }else{
  // Même échelle physique : le réglage sumo agit sur la translation et la rotation séparément.
  const max=tunedSpeed*2,accel=max*2.2;
  bot.v+=clamp(throttle,0,1)*accel*dt;bot.v*=Math.pow(.992,dt*60);bot.v=clamp(bot.v,0,max);
  bot.root.rotation.y+=steer*tunedRotation*(.8+Math.min(Math.abs(bot.v)/max,.2))*dt;
 }
 bot.root.position.x+=Math.sin(bot.root.rotation.y)*bot.v*dt;bot.root.position.z+=Math.cos(bot.root.rotation.y)*bot.v*dt;
 if(mode==='combat'&&(bot!==player||sawEnabled))bot.weapon.rotation.y+=dt*20;
 bot.cooldown=Math.max(0,bot.cooldown-dt);
}
function aim(bot,x,z,aggression=1){const dx=x-bot.root.position.x,dz=z-bot.root.position.z,desired=Math.atan2(dx,dz);let d=((desired-bot.root.rotation.y+Math.PI*3)%(Math.PI*2))-Math.PI;return {throttle:Math.abs(d)>2.5?.15:aggression,steer:clamp(d*3.8,-1,1)}}
function updateAI(dt){
 const level=aiLevel==='easy'?.72:aiLevel==='hard'?1.18:1;
 enemy.aiThink=(enemy.aiThink??rand(.2,.8))-dt;
 // L'IA change régulièrement de stratégie et ne verrouille pas constamment sa cible.
 if(enemy.aiThink<=0){
  enemy.aiThink=rand(.55,1.35);
  enemy.aiOffsetX=rand(-3.2,3.2);enemy.aiOffsetZ=rand(-3.2,3.2);
  const roll=Math.random();
  enemy.aiMode=mode==='hockey'?(roll<.48?'chase':roll<.78?'intercept':'defend'):roll<.68?'approach':roll<.86?'flank':'reposition';
  enemy.aiThrottle=rand(.58,1);
 }
 let tx=player.root.position.x,tz=player.root.position.z;
 if(mode==='hockey'){
  const px=puck.position.x,pz=puck.position.z;
  if(enemy.aiMode==='chase'){tx=px;tz=pz}
  else if(enemy.aiMode==='intercept'){tx=px+clamp(puck.userData.vx*.35,-2.5,2.5);tz=pz+clamp(puck.userData.vz*.35,-2,2)}
  else{tx=enemy.root.position.x>0?11:-11;tz=clamp(pz*.55,-4.8,4.8)}
 }else if(enemy.aiMode==='flank'){
  const dx=player.root.position.x-enemy.root.position.x,dz=player.root.position.z-enemy.root.position.z,len=Math.hypot(dx,dz)||1;
  tx=player.root.position.x-dz/len*3;tz=player.root.position.z+dx/len*3;
 }else if(enemy.aiMode==='reposition'){
  tx=player.root.position.x+enemy.aiOffsetX*1.8;tz=player.root.position.z+enemy.aiOffsetZ*1.8;
 }
 tx+=enemy.aiOffsetX*.45;tz+=enemy.aiOffsetZ*.45;
 const t=aim(enemy,tx,tz,level*(enemy.aiThrottle??.8));
 const steer=clamp(t.steer+rand(-.22,.22),-1,1),throttle=clamp(t.throttle+rand(-.12,.12),0,1);
 drive(enemy,dt,throttle,steer);
 if(mode==='hockey'&&Math.hypot(enemy.root.position.x-puck.position.x,enemy.root.position.z-puck.position.z)<2.5&&enemy.cooldown<=0&&Math.random()<.72){
  puck.userData.vx+=Math.sin(enemy.root.rotation.y)*13*level;puck.userData.vz+=Math.cos(enemy.root.rotation.y)*13*level;enemy.cooldown=rand(.35,.65);
 }
}
function robotHitboxes(bot){
 bot.root.updateMatrixWorld(true);const parts=[];
 bot.root.traverse(o=>{if(o.isMesh&&o.geometry){const box=new THREE.Box3().setFromObject(o);if(!box.isEmpty())parts.push({mesh:o,box})}});
 return parts;
}
function confineRobot(bot){
 if(mode==='sumo')return;
 const bounds=new THREE.Box3().setFromObject(bot.root),minX=mode==='hockey'?-15.72:-13.72,maxX=mode==='hockey'?15.72:13.72,minZ=mode==='hockey'?-8.72:-13.72,maxZ=mode==='hockey'?8.72:13.72;
 if(bounds.min.x<minX)bot.root.position.x+=minX-bounds.min.x;
 if(bounds.max.x>maxX)bot.root.position.x-=bounds.max.x-maxX;
 if(bounds.min.z<minZ)bot.root.position.z+=minZ-bounds.min.z;
 if(bounds.max.z>maxZ)bot.root.position.z-=bounds.max.z-maxZ;
}
function collideBots(a,b,dt){
 const ah=robotHitboxes(a),bh=robotHitboxes(b);let weaponA=false,weaponB=false;
 for(const x of ah)for(const y of bh)if(x.box.intersectsBox(y.box)){if(x.mesh.parent===a.weapon)weaponA=true;if(y.mesh.parent===b.weapon)weaponB=true}
 a.contactCooldown=Math.max(0,(a.contactCooldown||0)-dt);b.contactCooldown=Math.max(0,(b.contactCooldown||0)-dt);
 const dx=b.root.position.x-a.root.position.x,dz=b.root.position.z-a.root.position.z,d=Math.hypot(dx,dz);
 const sx=(b.root.position.x-(b.prevX??b.root.position.x))-(a.root.position.x-(a.prevX??a.root.position.x));
 const sz=(b.root.position.z-(b.prevZ??b.root.position.z))-(a.root.position.z-(a.prevZ??a.root.position.z));
 const px=(a.prevX??a.root.position.x),pz=(a.prevZ??a.root.position.z),rx=(b.prevX??b.root.position.x)-px,rz=(b.prevZ??b.root.position.z)-pz;
 const travel2=sx*sx+sz*sz,t=travel2>.0001?clamp(-(rx*sx+rz*sz)/travel2,0,1):0;
 const closest=Math.hypot(rx+sx*t,rz+sz*t),minDistance=mode==='hockey'?2.65:mode==='combat'?2.35:2.1;
 const touching=d<minDistance||closest<minDistance;
 if(touching){
  let nx=d>.001?dx/d:Math.hypot(rx+sx*t,rz+sz*t)>.001?(rx+sx*t)/closest:1;
  let nz=d>.001?dz/d:Math.hypot(rx+sx*t,rz+sz*t)>.001?(rz+sz*t)/closest:0;
  if(d<minDistance){
   const overlap=minDistance-d+.025;
   a.root.position.x-=nx*overlap*.5;b.root.position.x+=nx*overlap*.5;
   a.root.position.z-=nz*overlap*.5;b.root.position.z+=nz*overlap*.5;
  }else if(closest<minDistance){
   const midX=(a.root.position.x+b.root.position.x)*.5,midZ=(a.root.position.z+b.root.position.z)*.5;
   a.root.position.x=midX-nx*(minDistance*.51);b.root.position.x=midX+nx*(minDistance*.51);
   a.root.position.z=midZ-nz*(minDistance*.51);b.root.position.z=midZ+nz*(minDistance*.51);
  }
  const avx=Math.sin(a.root.rotation.y)*a.v,avz=Math.cos(a.root.rotation.y)*a.v;
  const bvx=Math.sin(b.root.rotation.y)*b.v,bvz=Math.cos(b.root.rotation.y)*b.v;
  const closing=(bvx-avx)*nx+(bvz-avz)*nz;
  if(closing<0){
   const impact=Math.min(1,Math.abs(closing)/8);
   a.v=Math.max(0,a.v*(1-.72*impact));b.v=Math.max(0,b.v*(1-.72*impact));
  }
  if((a.contactCooldown<=0||b.contactCooldown<=0)&&Math.abs(closing)>1.2){
   if(closing< -1.2)a.contacts=(a.contacts||0)+1;
   else if(closing>1.2)b.contacts=(b.contacts||0)+1;
   a.contactCooldown=b.contactCooldown=.45;
  }
  const fa=Math.sin(a.root.rotation.y)*dx+Math.cos(a.root.rotation.y)*dz,fb=-Math.sin(b.root.rotation.y)*dx-Math.cos(b.root.rotation.y)*dz;
  if(mode==='combat'){
   if(weaponA&&a.cooldown<=0&&(a!==player||sawEnabled)){b.hp=Math.max(0,b.hp-rand(8,14));a.cooldown=.35}
   if(weaponB&&b.cooldown<=0&&(b!==player||sawEnabled)){a.hp=Math.max(0,a.hp-rand(8,14));b.cooldown=.35}
  }
  if(mode==='sumo'){if(fa>0)b.v+=12*dt*10;if(fb>0)a.v+=12*dt*10}
 }
 a.prevX=a.root.position.x;a.prevZ=a.root.position.z;b.prevX=b.root.position.x;b.prevZ=b.root.position.z;
}
function updatePuck(dt){
 const radius=.43;
 // Collision cercle (palet) / rectangle orienté (châssis et fourches) dans le repère local de chaque robot.
 const hitRobot=b=>{
  const cs=Math.cos(b.root.rotation.y),sn=Math.sin(b.root.rotation.y);
  const dx=puck.position.x-b.root.position.x,dz=puck.position.z-b.root.position.z;
  let x=cs*dx-sn*dz,z=sn*dx+cs*dz;
  let vx=cs*puck.userData.vx-sn*puck.userData.vz,vz=sn*puck.userData.vx+cs*puck.userData.vz;
  let collided=false;
  const rect=(cx,cz,hx,hz)=>{
   const qx=clamp(x,cx-hx,cx+hx),qz=clamp(z,cz-hz,cz+hz);
   let ox=x-qx,oz=z-qz,d2=ox*ox+oz*oz;
   if(d2>=radius*radius)return;
   let nx,nz,depth;
   if(d2>.000001){const d=Math.sqrt(d2);nx=ox/d;nz=oz/d;depth=radius-d}
   else{const px=hx-Math.abs(x-cx),pz=hz-Math.abs(z-cz);if(px<pz){nx=x<cx?-1:1;nz=0;depth=radius+px}else{nx=0;nz=z<cz?-1:1;depth=radius+pz}}
   x+=nx*(depth+.003);z+=nz*(depth+.003);
   const vn=vx*nx+vz*nz;if(vn<0){vx-=1.35*vn*nx;vz-=1.35*vn*nz}
   collided=true;
  };
  // Coque, puis les deux fourches physiques : aucune zone de passage fictive.
  rect(0,0,1.025,.45);
  for(const side of [-1,1]){
   // Roue vue de dessus.
   const wx=x-side*1.03,wz=z,d=Math.hypot(wx,wz),sum=radius+.32;
   if(d<sum){const nx=d>.0001?wx/d:side,nz=d>.0001?wz/d:0,depth=sum-d;x+=nx*(depth+.003);z+=nz*(depth+.003);const vn=vx*nx+vz*nz;if(vn<0){vx-=1.35*vn*nx;vz-=1.35*vn*nz}collided=true}
   // Longerons raccourcis, épaissis (dimensions réelles du modèle).
   rect(side*.72,.70,.136,.191);
  }
  if(collided){
   puck.position.x=b.root.position.x+cs*x+sn*z;
   puck.position.z=b.root.position.z-sn*x+cs*z;
   puck.userData.vx=cs*vx+sn*vz;
   puck.userData.vz=-sn*vx+cs*vz;
   b.puckTouchCooldown=.08;
  }
 };
 // Sous-pas de 0,08 unité maximum : évite le tunneling du palet à grande vitesse.
 const travel=Math.hypot(puck.userData.vx,puck.userData.vz)*dt;
 const steps=Math.max(1,Math.ceil(travel/.08)),step=dt/steps;
 for(let i=0;i<steps;i++){
  puck.position.x+=puck.userData.vx*step;puck.position.z+=puck.userData.vz*step;
  for(const b of [player,enemy])hitRobot(b);
  const friction=Math.pow(.986,step*60);puck.userData.vx*=friction;puck.userData.vz*=friction;
  if(puck.position.x>16.15&&Math.abs(puck.position.z)<2.05){scoreGoal('blue');return}
  if(puck.position.x<-16.15&&Math.abs(puck.position.z)<1.35){scoreGoal('red');return}
  if(Math.abs(puck.position.x)>15.7){puck.position.x=clamp(puck.position.x,-15.7,15.7);puck.userData.vx*=-.8}
  if(Math.abs(puck.position.z)>8.7){puck.position.z=clamp(puck.position.z,-8.7,8.7);puck.userData.vz*=-.75}
 }
 const speed=Math.hypot(puck.userData.vx,puck.userData.vz);if(speed>19){puck.userData.vx*=17/speed;puck.userData.vz*=17/speed}
}
function scoreGoal(team){if(goalLock>0)return;goalLock=.8;if(team==='blue')scoreBlue++;else scoreRed++;$('#status').textContent=team==='blue'?'BUT BLEU':'BUT ROUGE';resetPositions();if(scoreBlue>=3||scoreRed>=3)finish(scoreBlue>scoreRed?'BLEU':'ROUGE','Premier à trois buts.')}
function updateSumo(){for(const [b,t] of [[player,'blue'],[enemy,'red']])if(Math.hypot(b.root.position.x,b.root.position.z)>8.4){if(t==='blue')roundRed++;else roundBlue++;resetPositions();if(roundBlue>=2||roundRed>=2)finish(roundBlue>roundRed?'BLEU':'ROUGE','Deux manches gagnantes.')}}
function updateHud(){
 const a=mode==='combat'?player.contacts:mode==='sumo'?roundBlue:scoreBlue,b=mode==='combat'?enemy.contacts:mode==='sumo'?roundRed:scoreRed;
 $('#score-blue').textContent=Math.ceil(a);$('#score-red').textContent=Math.ceil(b);
 const top=Math.max(1,a,b);$('#bar-blue').style.width=(mode==='combat'?a/top*100:a/3*100)+'%';$('#bar-red').style.width=(mode==='combat'?b/top*100:b/3*100)+'%';
 $('#label-blue').textContent=$('#label-red').textContent=mode==='combat'?'CONTACTS':mode==='sumo'?'MANCHES':'BUTS';
 $('#contact-count').textContent='CONTACTS · BLEU '+(player.contacts||0)+' / ROUGE '+(enemy.contacts||0);
}
function finish(winner,detail){if(ended)return;ended=true;$('#end-title').textContent=winner==='NUL'?'ÉGALITÉ':winner==='BLEU'?'VICTOIRE':'DÉFAITE';$('#end-detail').textContent=detail;$('#end').classList.remove('hidden')}
function attackPuck(bot){if(!puck||bot.cooldown>0)return;const d=Math.hypot(puck.position.x-bot.root.position.x,puck.position.z-bot.root.position.z);if(d<3){puck.userData.vx+=Math.sin(bot.root.rotation.y)*16;puck.userData.vz+=Math.cos(bot.root.rotation.y)*16;bot.cooldown=.3}}
function setMode(m){
 mode=m;
 tunedSpeed=m==='hockey'?9.8:12;tunedRotation=14;
 const speedControl=$('#tune-speed'),rotationControl=$('#tune-rotation');
 if(speedControl&&rotationControl){const speedHalfRange=2;speedControl.min=(tunedSpeed-speedHalfRange).toFixed(1);speedControl.max=(tunedSpeed+speedHalfRange).toFixed(1);speedControl.value=tunedSpeed;rotationControl.min='9';rotationControl.max='19';rotationControl.value=tunedRotation;if($('#tune-speed-value'))$('#tune-speed-value').textContent=tunedSpeed.toFixed(1)+' m/s';if($('#tune-rotation-value'))$('#tune-rotation-value').textContent=tunedRotation.toFixed(1)+' rad/s'}
 document.querySelectorAll('.mode-card').forEach(c=>c.classList.toggle('selected',c.dataset.mode===m));
 const data={
 combat:{title:'RÈGLES · COMBAT',items:['Duel dans une arène fermée.','Chaque contact réussi avec l’adversaire rapporte un point.','Le match dure jusqu’à la fin du chronomètre.','Le robot ayant provoqué le plus de contacts gagne.'],help:'Combat : percute ton adversaire pour marquer des contacts. E active la scie.',labels:['CONTACTS','CONTACTS']},
 sumo:{title:'RÈGLES · SUMO',items:['Deux robots se font face sur un dohyo circulaire.','Pousse l’adversaire hors du cercle.','Sortir du dohyo fait perdre la manche.','Le premier à gagner deux manches remporte le match.'],help:'Sumo : pousse l’adversaire hors du dohyo.',labels:['MANCHES','MANCHES']},
 hockey:{title:'RÈGLES · HOCKEY',items:['Deux robots s’affrontent sur une patinoire avec un palet.','Les cages sont placées à gauche et à droite du terrain.','Un but est marqué lorsque le palet franchit la ligne dans la cage.','Le premier à marquer trois buts gagne.'],help:'Hockey : E pour frapper le palet.',labels:['BUTS','BUTS']}
 }[m];
 $('#rules-title').textContent=data.title;$('#rules-list').innerHTML=data.items.map(x=>'<li>'+x+'</li>').join('');$('#mode-help').textContent=data.help;$('#label-blue').textContent=data.labels[0];$('#label-red').textContent=data.labels[1];$('#action-button').textContent=m==='hockey'?'TIR':'SCIE';$('#weight-setting').style.display=m==='combat'?'grid':'none';$('.settings-grid').style.gridTemplateColumns=m==='combat'?'repeat(3,1fr)':'repeat(2,1fr)';
}
document.querySelectorAll('.mode-card').forEach(c=>c.addEventListener('click',()=>setMode(c.dataset.mode)));setMode('combat');
function keyLabel(code){if(code==='Space')return 'ESPACE';if(code.startsWith('Key'))return code.slice(3);if(code.startsWith('Digit'))return code.slice(5);return code}
function renderBindings(){document.querySelectorAll('[data-bind]').forEach(b=>b.textContent=keyLabel(bindings[b.dataset.bind]))}
function openControls(){$('.menu-content').classList.add('hidden');$('#controls-panel').classList.remove('hidden');renderBindings();scanGamepads();$('#invert-throttle').checked=invertThrottle;$('#invert-steering').checked=invertSteering}
function closeControls(){$('#controls-panel').classList.add('hidden');$('.menu-content').classList.remove('hidden')}
$('#controls-tab').addEventListener('click',openControls);$('#controls-back').addEventListener('click',closeControls);
document.querySelectorAll('[data-bind]').forEach(b=>b.addEventListener('click',()=>{if(waitingForBind)waitingForBind.classList.remove('waiting');waitingForBind=b;b.classList.add('waiting');b.textContent='APPUIE…'}));
const tuneSpeedInput=$('#tune-speed'),tuneRotationInput=$('#tune-rotation');
if(tuneSpeedInput)tuneSpeedInput.addEventListener('input',e=>{tunedSpeed=Number(e.target.value);$('#tune-speed-value').textContent=tunedSpeed.toFixed(1)+' m/s'});
if(tuneRotationInput)tuneRotationInput.addEventListener('input',e=>{tunedRotation=Number(e.target.value);$('#tune-rotation-value').textContent=tunedRotation.toFixed(1)+' rad/s'});
$('#invert-throttle').addEventListener('change',e=>{invertThrottle=e.target.checked});$('#invert-steering').addEventListener('change',e=>{invertSteering=e.target.checked});
$('#reset-bindings').addEventListener('click',()=>{bindings={...DEFAULT_BINDINGS};try{localStorage.setItem('robotArenaBindings',JSON.stringify(bindings))}catch{}waitingForBind=null;renderBindings()});
try{const saved=JSON.parse(localStorage.getItem('robotArenaBindings')||'null');if(saved)for(const k of Object.keys(DEFAULT_BINDINGS))if(typeof saved[k]==='string')bindings[k]=saved[k]}catch{}renderBindings();
function scanGamepads(){const pads=navigator.getGamepads?navigator.getGamepads():[];activeGamepad=[...pads].find(p=>p&&p.connected)||null;const box=$('#gamepad-status');if(activeGamepad){box.classList.add('connected');box.querySelector('b').textContent='CONTRÔLEUR CONNECTÉ';box.querySelector('small').textContent=activeGamepad.id+' · '+activeGamepad.axes.length+' axes · '+activeGamepad.buttons.length+' boutons';$('#live-device').textContent='CONNECTÉ'}else{box.classList.remove('connected');box.querySelector('b').textContent='AUCUN CONTRÔLEUR DÉTECTÉ';box.querySelector('small').textContent='Connecte une manette ou un contrôleur FPV, puis appuie sur un bouton.';$('#live-device').textContent='EN ATTENTE'}}
addEventListener('gamepadconnected',scanGamepads);addEventListener('gamepaddisconnected',()=>{activeGamepad=null;scanGamepads()});
document.querySelectorAll('[data-assign]').forEach(b=>b.addEventListener('click',()=>{if(assigning)assigning.classList.remove('waiting');assigning=b;b.classList.add('waiting');$('#assign-hint').textContent=b.dataset.assign==='saw'?'Appuie sur le bouton que tu veux affecter à la scie.':'Déplace uniquement le stick ou l’axe souhaité jusqu’en butée.';b.textContent='EN ATTENTE…'}));
function readController(){const pads=navigator.getGamepads?navigator.getGamepads():[];const p=activeGamepad&&pads[activeGamepad.index]?.connected?pads[activeGamepad.index]:[...pads].find(x=>x&&x.connected);if(!p){activeGamepad=null;$('#throttle-meter').style.width='0%';$('#steering-meter').style.width='0%';$('#throttle-value').textContent='0%';$('#steering-value').textContent='0%';$('#saw-indicator').textContent=sawEnabled?'ACTIVÉE':'ARRÊTÉE';$('#saw-indicator').classList.toggle('active',sawEnabled);return}activeGamepad=p;const axes=p.axes||[],buttons=p.buttons||[];
 if(assigning){if(assigning.dataset.assign==='saw'){const i=buttons.findIndex(x=>x&&x.pressed);if(i>=0){controllerMap.saw.button=i;assigning.textContent='BOUTON '+(i+1);assigning.classList.remove('waiting');assigning=null;$('#assign-hint').textContent='Bouton affecté. Teste-le en appuyant dessus.'}}else{let best=-1,bestVal=.55;for(let i=0;i<axes.length;i++){const v=Math.abs(axes[i]||0);if(v>bestVal){best=i;bestVal=v}}if(best>=0){const kind=assigning.dataset.assign;controllerMap[kind]={axis:best,invert:(axes[best]||0)<0?1:-1};assigning.textContent='AXE '+(best+1);assigning.classList.remove('waiting');assigning=null;$('#assign-hint').textContent='Axe affecté. Déplace-le pour vérifier la réponse en direct.'}}}
 const t=controllerMap.throttle,s=controllerMap.steering;let rawThrottle=t.axis<axes.length?(axes[t.axis]||0)*t.invert:0,throttle=invertThrottle?Math.max(0,-rawThrottle):Math.max(0,rawThrottle),steering=s.axis<axes.length?(axes[s.axis]||0)*s.invert:0;steering*=invertSteering?-1:1;throttle=Math.abs(throttle)<.12?0:throttle;steering=Math.abs(steering)<.12?0:steering;
 const sawIndex=controllerMap.saw.button,sawPressed=!!buttons[sawIndex]?.pressed;if(ended&&!$('#controls-panel').classList.contains('hidden')&&sawPressed&&!lastControllerSaw)sawEnabled=!sawEnabled;lastControllerSaw=sawPressed;
 $('#throttle-meter').style.width=Math.abs(throttle)*50+'%';$('#throttle-meter').style.left='50%';$('#throttle-meter').style.transform='translateX('+(throttle<0?'-100%':'0')+')';$('#steering-meter').style.width=Math.abs(steering)*50+'%';$('#steering-meter').style.left='50%';$('#steering-meter').style.transform='translateX('+(steering<0?'-100%':'0')+')';$('#throttle-value').textContent=Math.round(throttle*100)+'%';$('#steering-value').textContent=Math.round(steering*100)+'%';
 const indicator=$('#saw-indicator');indicator.textContent=sawEnabled?'ACTIVÉE':'ARRÊTÉE';indicator.classList.toggle('active',sawEnabled);
 return {throttle,steering,sawPressed};}
function actionDown(name){return !!keys[bindings[name]]}
function fmt(t){const n=Math.max(0,Math.ceil(t));return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')}
function startMatch(){
 if(!renderer){window.__showArenaDiagnostic?.('MATCH IMPOSSIBLE : le moteur WebGL ne s’est pas initialisé.',true);return}
 sawEnabled=false;remaining=120;countdown=3;aiLevel=$('#difficulty').value;scoreBlue=scoreRed=roundBlue=roundRed=0;goalLock=0;ended=true;
 $('#end').classList.add('hidden');$('#countdown').classList.remove('hidden');$('#countdown-number').textContent='3';$('#hud-mode').textContent=mode.toUpperCase();
 buildMatch();updateHud();menu.classList.add('hidden');arenaScreen.classList.remove('hidden');$('#timer').textContent=fmt(remaining);
 // V.14 : supprimer la sonde temporaire V.12 qui masquait le diagnostic après 9 s.
 // Attendre que l'écran de match soit réellement affiché avant de dimensionner le canvas.
 const showAndRender=()=>{
  const rect=arenaScreen.getBoundingClientRect(),w=Math.max(1,Math.floor(rect.width)),h=Math.max(1,Math.floor(rect.height));
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
  camera.position.set(0,mode==='sumo'?19:mode==='combat'?27:20,mode==='combat'?34:mode==='hockey'?27:19);camera.lookAt(0,0,0);
  renderer.setClearColor(0x080808,1);renderer.clear(true,true,true);renderer.render(scene,camera);
 };
 try{showAndRender();requestAnimationFrame(()=>{try{showAndRender()}catch(error){window.__showArenaDiagnostic?.('ERREUR AU PREMIER RENDU : '+(error?.message||String(error)),true)}})}
 catch(error){window.__showArenaDiagnostic?.('ERREUR AU DÉMARRAGE DU RENDU : '+(error?.message||String(error)),true)}
}
function backMenu(){ended=true;countdown=0;$('#countdown').classList.add('hidden');sawEnabled=false;arenaScreen.classList.add('hidden');menu.classList.remove('hidden')}
$('#start').addEventListener('click',startMatch);$('#back-menu').addEventListener('click',backMenu);$('#end-menu').addEventListener('click',backMenu);$('#rematch').addEventListener('click',startMatch);
addEventListener('keydown',e=>{if(waitingForBind){e.preventDefault();bindings[waitingForBind.dataset.bind]=e.code;waitingForBind.classList.remove('waiting');waitingForBind=null;try{localStorage.setItem('robotArenaBindings',JSON.stringify(bindings))}catch{}renderBindings();return}if(!keys[e.code]&&ended&&!$('#controls-panel').classList.contains('hidden')&&e.code===bindings.action)sawEnabled=!sawEnabled;keys[e.code]=true;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault()});addEventListener('keyup',e=>keys[e.code]=false);
const touchActions={KeyW:'forward',KeyS:'backward',KeyA:'left',KeyD:'right',KeyE:'action'};document.querySelectorAll('[data-key]').forEach(b=>{const action=touchActions[b.dataset.key];let code=null;b.addEventListener('pointerdown',e=>{e.preventDefault();code=bindings[action]||b.dataset.key;keys[code]=true;b.setPointerCapture?.(e.pointerId)});const up=e=>{e.preventDefault();if(code)keys[code]=false;code=null};b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);b.addEventListener('lostpointercapture',up)});
function resize(){const rect=arenaScreen.getBoundingClientRect();const w=Math.max(1,Math.floor(rect.width||game.clientWidth)),h=Math.max(1,Math.floor(rect.height||game.clientHeight));camera.aspect=w/h;camera.updateProjectionMatrix();if(renderer)renderer.setSize(w,h,false)}new ResizeObserver(resize).observe(game);new ResizeObserver(resize).observe(arenaScreen);resize();
function loop(){
 requestAnimationFrame(loop);const dt=Math.min(clock.getDelta(),.04);const padInput=readController();document.querySelectorAll('[data-bind]').forEach(b=>b.classList.toggle('pressed',!!keys[bindings[b.dataset.bind]]));goalLock=Math.max(0,goalLock-dt);
 if(countdown>0){countdown-=dt;const n=Math.max(1,Math.ceil(countdown));$('#countdown-number').textContent=String(n);if(countdown<=0){countdown=0;ended=false;$('#countdown').classList.add('hidden');$('#status').textContent='DÉPART !';if(player&&enemy){player.v=0;enemy.v=0;player.prevX=player.root.position.x;player.prevZ=player.root.position.z;enemy.prevX=enemy.root.position.x;enemy.prevZ=enemy.root.position.z}requestAnimationFrame(()=>{try{resize();if(renderer)renderer.render(scene,camera)}catch(error){window.__showArenaDiagnostic?.('ERREUR APRÈS LE DÉCOMPTE : '+(error?.message||String(error)),true)}})}}
 if(!ended&&player&&enemy){
  remaining-=dt;if(remaining<=0){remaining=0;const winner=mode==='combat'?(player.contacts===enemy.contacts?'NUL':player.contacts>enemy.contacts?'BLEU':'ROUGE'):mode==='sumo'?(roundBlue>=roundRed?'BLEU':'ROUGE'):(scoreBlue>=scoreRed?'BLEU':'ROUGE');const detail=mode==='combat'?'Temps écoulé · BLEU '+player.contacts+' contacts / ROUGE '+enemy.contacts+' contacts.':'Temps écoulé.';finish(winner,detail)}
  $('#timer').textContent=fmt(remaining);
  if($('#tune-speed-value'))$('#tune-speed-value').textContent=tunedSpeed.toFixed(1)+' m/s';if($('#tune-rotation-value'))$('#tune-rotation-value').textContent=tunedRotation.toFixed(1)+' rad/s';
  const keyboardThrottle=Number(actionDown('forward'));
  const keyboardSteer=Number(actionDown('right'))-Number(actionDown('left'));
  const f=padInput&&Math.abs(padInput.throttle)>.12?padInput.throttle:keyboardThrottle;
  const steering=(padInput&&Math.abs(padInput.steering)>.12?padInput.steering:keyboardSteer)*-1;
  const sawKey=actionDown('action'),sawButton=!!padInput?.sawPressed,sawInput=sawKey||sawButton;
  if(mode==='combat'&&sawInput&&!lastSawKey)sawEnabled=!sawEnabled;
  lastSawKey=sawInput;
  player.prevX=player.root.position.x;player.prevZ=player.root.position.z;enemy.prevX=enemy.root.position.x;enemy.prevZ=enemy.root.position.z;
  const badBot=b=>!b||![b.root.position.x,b.root.position.y,b.root.position.z,b.root.rotation.x,b.root.rotation.y,b.root.rotation.z,b.v].every(Number.isFinite);
  const reportBad=stage=>{if(badBot(player)||badBot(enemy)){ended=true;window.__showArenaDiagnostic?.('V.23 — NaN détecté '+stage+' · BLEU pos '+[player.root.position.x,player.root.position.y,player.root.position.z].map(v=>Number.isFinite(v)?v.toFixed(2):'NaN').join(',')+' rot '+[player.root.rotation.x,player.root.rotation.y,player.root.rotation.z].map(v=>Number.isFinite(v)?v.toFixed(2):'NaN').join(',')+' · ROUGE pos '+[enemy.root.position.x,enemy.root.position.y,enemy.root.position.z].map(v=>Number.isFinite(v)?v.toFixed(2):'NaN').join(',')+' rot '+[enemy.root.rotation.x,enemy.root.rotation.y,enemy.root.rotation.z].map(v=>Number.isFinite(v)?v.toFixed(2):'NaN').join(',')+' · vitesses '+player.v.toFixed(2)+' / '+enemy.v.toFixed(2),true);return true}return false};
  drive(player,dt,f,steering);if(reportBad('après conduite joueur'))return;
  updateAI(dt);if(reportBad('après IA'))return;
  confineRobot(player);confineRobot(enemy);if(reportBad('après limites'))return;
  if(mode==='hockey'){collideBots(player,enemy,dt);if(reportBad('après collision robots'))return;updatePuck(dt);if(sawInput)attackPuck(player)}
  else{collideBots(player,enemy,dt);if(reportBad('après collision robots'))return;if(mode==='sumo')updateSumo()}
  updateHud();
 }
 const target=player?new THREE.Vector3((player.root.position.x+enemy.root.position.x)*.5,0,(player.root.position.z+enemy.root.position.z)*.5):new THREE.Vector3(0,0,0);
 camera.position.lerp(new THREE.Vector3(target.x,mode==='sumo'?19:mode==='combat'?27:20,target.z+(mode==='combat'?34:mode==='hockey'?27:19)),.045);camera.lookAt(target);if(renderer){try{renderer.render(scene,camera)}catch(error){ended=true;countdown=0;window.__showArenaDiagnostic?.('ERREUR WEBGL PENDANT LE MATCH : '+(error?.message||String(error)),true)}}
}
if(renderer){renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();window.__showArenaDiagnostic?.('ERREUR GRAPHIQUE : le contexte WebGL a été perdu.',true)});renderer.domElement.addEventListener('webglcontextrestored',()=>{renderer.setClearColor(0x080808,1);resize();renderer.render(scene,camera);window.__hideArenaDiagnostic?.()})}
window.addEventListener('error',e=>{const status=$('#status');if(status)status.textContent='ERREUR JEU : '+(e.message||'voir console')});
window.addEventListener('unhandledrejection',e=>{const status=$('#status');if(status)status.textContent='ERREUR CHARGEMENT : '+String(e.reason||'module indisponible');window.__showArenaDiagnostic?.('ERREUR DE CHARGEMENT : '+String(e.reason?.message||e.reason||'module indisponible'),true)});
loop();
