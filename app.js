import * as THREE from 'three';

const $=s=>document.querySelector(s);
const menu=$('#menu'), arenaScreen=$('#arena-screen'), loading=$('#loading');
const scene=new THREE.Scene();scene.background=new THREE.Color(0x101923);
scene.fog=new THREE.Fog(0x101923,25,55);
const camera=new THREE.PerspectiveCamera(48,1,.1,100);
camera.position.set(0,18,20);
const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;
$('#game').insertBefore(renderer.domElement,menu);
scene.add(new THREE.HemisphereLight(0xc5ddff,0x26313d,2));
const sun=new THREE.DirectionalLight(0xffffff,2.1);sun.position.set(-8,16,9);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);scene.add(sun);
const world=new THREE.Group();scene.add(world);
const keys={};let mode='combat',player,enemy,puck=null,ended=true,remaining=180,matchDuration=180,scoreBlue=0,scoreRed=0,roundBlue=0,roundRed=0,lastTime=0,aiLevel='normal',speedScale=1,goalFlash=0;
const clock=new THREE.Clock();
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rand=(a,b)=>a+Math.random()*(b-a);
const materials={wall:new THREE.MeshStandardMaterial({color:0x1b2a38,metalness:.5,roughness:.4}),floor:new THREE.MeshStandardMaterial({color:0x515d68,roughness:.9}),blue:new THREE.MeshStandardMaterial({color:0x147fc2,metalness:.65,roughness:.3}),blueA:new THREE.MeshStandardMaterial({color:0x58d0ff,metalness:.7,roughness:.25}),red:new THREE.MeshStandardMaterial({color:0xb92c35,metalness:.65,roughness:.3}),redA:new THREE.MeshStandardMaterial({color:0xff715f,metalness:.7,roughness:.25}),rubber:new THREE.MeshStandardMaterial({color:0x10151b,roughness:.95})};
function mesh(geo,mat,parent,x=0,y=0,z=0){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
function clearWorld(){while(world.children.length){const o=world.children.pop();o.traverse?.(n=>{if(n.geometry)n.geometry.dispose()})}puck=null}
function makeArena(){
 clearWorld();
 if(mode==='sumo'){
  const outer=mesh(new THREE.CylinderGeometry(10.1,10.1,.45,96),new THREE.MeshStandardMaterial({color:0x252f3a,metalness:.35}),world,0,-.48,0);
  mesh(new THREE.CylinderGeometry(9.1,9.1,.12,96),new THREE.MeshStandardMaterial({color:0x080d12,roughness:.85}),world,0,-.18,0);
  mesh(new THREE.CylinderGeometry(8.7,8.7,.08,96),new THREE.MeshStandardMaterial({color:0x303b45,roughness:.8}),world,0,-.09,0);
  const ring=mesh(new THREE.TorusGeometry(8.25,.09,8,100),new THREE.MeshStandardMaterial({color:0xf4f5ed,emissive:0x333333}),world,0,-.02,0);ring.rotation.x=Math.PI/2;
  for(let i=0;i<2;i++){const line=mesh(new THREE.BoxGeometry(.12,.025,1.1),new THREE.MeshStandardMaterial({color:0xb18a55}),world,i?-.8:.8,.01,0)}
  for(let i=0;i<12;i++){const a=i*Math.PI/6;const post=mesh(new THREE.CylinderGeometry(.07,.07,1.2,8),materials.wall,world,Math.cos(a)*10.05,.25,Math.sin(a)*10.05)}
  const ground=mesh(new THREE.CircleGeometry(17,96),new THREE.MeshStandardMaterial({color:0x111c25,roughness:1}),world,0,-.75,0);ground.rotation.x=-Math.PI/2;
  return;
 }
 const w=mode==='hockey'?19:20,d=mode==='hockey'?13:14;
 mesh(new THREE.BoxGeometry(w,.5,d),new THREE.MeshStandardMaterial({color:mode==='hockey'?0xb8d2df:0x343f49,roughness:.85}),world,0,-.35,0);
 const surface=mesh(new THREE.PlaneGeometry(w-.7,d-.7),new THREE.MeshStandardMaterial({color:mode==='hockey'?0xd8e7ec:0x58636d,roughness:.9}),world,0,-.085,0);surface.rotation.x=-Math.PI/2;
 if(mode==='combat'){
  const grid=new THREE.GridHelper(19.3,24,0x87939e,0x687581);grid.position.y=-.07;world.add(grid);
  for(const [x,z,bw,bd] of [[0,-7,20,.35],[0,7,20,.35],[-10,0,.35,14],[10,0,.35,14]])mesh(new THREE.BoxGeometry(bw,1.1,bd),materials.wall,world,x,.28,z);
  for(let i=0;i<4;i++){const l=new THREE.PointLight(0x4a9dff,18,10);l.position.set(i%2?8:-8,4,i<2?-5:5);world.add(l)}
 }else{
  for(const [x,z,bw,bd] of [[0,-6.5,19,.35],[0,6.5,19,.35],[-9.5,0,.35,13],[9.5,0,.35,13]])mesh(new THREE.BoxGeometry(bw,.8,bd),new THREE.MeshStandardMaterial({color:0x294355,metalness:.4,roughness:.45}),world,x,.08,z);
  // Openings and goal frames at the short ends.
  for(const z of [-6.25,6.25]){
   mesh(new THREE.BoxGeometry(3.5,.16,.35),new THREE.MeshStandardMaterial({color:0xe8f2f7}),world,0,.35,z);
   for(const x of [-1.75,1.75])mesh(new THREE.BoxGeometry(.16,1.15,.35),new THREE.MeshStandardMaterial({color:0xe8f2f7}),world,x,.9,z);
   mesh(new THREE.BoxGeometry(3.5,.12,1.15),new THREE.MeshStandardMaterial({color:0x253d4b}),world,0,.35,z+(z<0?-.45:.45));
  }
  const center=mesh(new THREE.TorusGeometry(1.15,.035,6,48),new THREE.MeshStandardMaterial({color:0x6c9db2}),world,0,-.035,0);center.rotation.x=Math.PI/2;
  for(const x of [-4.7,4.7]){const c=mesh(new THREE.TorusGeometry(1.2,.025,6,48),new THREE.MeshStandardMaterial({color:0x6c9db2}),world,x,-.035,0);c.rotation.x=Math.PI/2}
 }
}
function makeRobot(color,accent,x,z,angle){
 const root=new THREE.Group();root.position.set(x,.12,z);root.rotation.y=angle;world.add(root);
 mesh(new THREE.BoxGeometry(2.05,.58,1.48),color,root);
 const deck=mesh(new THREE.BoxGeometry(1.3,.13,1.05),accent,root,0,.34,0);
 for(const side of [-1,1])for(const front of [-1,1]){const wheel=mesh(new THREE.CylinderGeometry(.29,.29,.22,16),materials.rubber,root,side*.99,-.12,front*.48);wheel.rotation.z=Math.PI/2}
 const nose=mesh(new THREE.BoxGeometry(1.35,.2,.34),accent,root,0,-.08,-.83);
 const weapon=new THREE.Group();weapon.position.set(0,.48,-.4);root.add(weapon);
 if(mode==='combat'){
  const disc=mesh(new THREE.CylinderGeometry(.64,.64,.15,32),accent,weapon);disc.rotation.x=Math.PI/2;
  for(let i=0;i<4;i++){const a=i*Math.PI/2;mesh(new THREE.BoxGeometry(.24,.23,.2),accent,weapon,Math.cos(a)*.64,Math.sin(a)*.64,0)}
 }else{
  mesh(new THREE.BoxGeometry(.9,.13,.32),accent,weapon,0,0,-.38);
 }
 return {root,weapon,hp:100,v:0,alive:true,cooldown:0,score:0,stun:0};
}
function resetPositions(){
 if(!player||!enemy)return;
 if(mode==='sumo'){player.root.position.set(-3,.12,0);player.root.rotation.y=Math.PI/2;enemy.root.position.set(3,.12,0);enemy.root.rotation.y=-Math.PI/2}
 else if(mode==='hockey'){player.root.position.set(0,.12,3.9);player.root.rotation.y=Math.PI;enemy.root.position.set(0,.12,-3.9);enemy.root.rotation.y=0}
 else{player.root.position.set(-5,.12,0);player.root.rotation.y=Math.PI/2;enemy.root.position.set(5,.12,0);enemy.root.rotation.y=-Math.PI/2}
 player.v=enemy.v=0;player.hp=enemy.hp=100;player.alive=enemy.alive=true;player.cooldown=enemy.cooldown=0;
 if(puck){puck.position.set(0,.2,0);puck.userData.vx=0;puck.userData.vz=0}
}
function buildMatch(){
 makeArena();
 const colors=materials;
 player=makeRobot(colors.blue,colors.blueA,0,0,0);
 enemy=makeRobot(colors.red,colors.redA,0,0,Math.PI);
 if(mode==='hockey'){
  puck=mesh(new THREE.CylinderGeometry(.43,.43,.16,32),new THREE.MeshStandardMaterial({color:0x17202a,metalness:.15,roughness:.5}),world,0,.2,0);
  puck.userData={vx:0,vz:0};
 }
 resetPositions();
}
function drive(bot,dt,throttle,steer,boost=false){
 if(!bot.alive)return;
 const acceleration=(boost?11:7)*speedScale;
 bot.v+=throttle*acceleration*dt;bot.v*=Math.pow(.9,dt*60);
 bot.v=clamp(bot.v,-4.3*speedScale,(boost?7.5:5.4)*speedScale);
 bot.root.rotation.y+=steer*(2+Math.abs(bot.v)*.15)*dt;
 bot.root.position.x+=Math.sin(bot.root.rotation.y)*bot.v*dt;
 bot.root.position.z+=Math.cos(bot.root.rotation.y)*bot.v*dt;
 bot.weapon.rotation.z+=dt*(mode==='combat'?18:5);
 bot.cooldown=Math.max(0,bot.cooldown-dt);bot.stun=Math.max(0,bot.stun-dt);
}
function attack(a,b){
 const dx=b.root.position.x-a.root.position.x,dz=b.root.position.z-a.root.position.z,dist=Math.hypot(dx,dz);
 if(dist<1.95&&dist>.001){
  const nx=dx/dist,nz=dz/dist,overlap=1.95-dist;
  a.root.position.x-=nx*overlap*.5;b.root.position.x+=nx*overlap*.5;
  a.root.position.z-=nz*overlap*.5;b.root.position.z+=nz*overlap*.5;
  const fa=Math.sin(a.root.rotation.y)*dx+Math.cos(a.root.rotation.y)*dz;
  const fb=-Math.sin(b.root.rotation.y)*dx-Math.cos(b.root.rotation.y)*dz;
  if(mode==='combat'){
   if(fa>.1&&a.cooldown<=0){b.hp=Math.max(0,b.hp-rand(7,13));b.stun=.12;a.cooldown=.55}
   if(fb>.1&&b.cooldown<=0){a.hp=Math.max(0,a.hp-rand(7,13));a.stun=.12;b.cooldown=.55}
  }else{
   const force=mode==='sumo'?5:2.4;
   if(fa>.1)b.v+=force*dt*8;
   if(fb>.1)a.v+=force*dt*8;
  }
 }
}
function aimAt(bot,x,z,dt,aggression=1){
 const dx=x-bot.root.position.x,dz=z-bot.root.position.z;
 const desired=Math.atan2(dx,dz);
 let delta=((desired-bot.root.rotation.y+Math.PI*3)%(Math.PI*2))-Math.PI;
 const steer=clamp(delta*2.2,-1,1);
 const throttle=Math.abs(delta)>2.3?.25:aggression;
 return {throttle,steer};
}
function updateAI(dt){
 const level=aiLevel==='easy'?.72:aiLevel==='hard'?1.18:1;
 if(mode==='hockey'&&puck){
  const t=aimAt(enemy,puck.position.x,puck.position.z,dt,level);
  drive(enemy,dt,t.throttle,t.steer,false);
  const d=Math.hypot(enemy.root.position.x-puck.position.x,enemy.root.position.z-puck.position.z);
  if(d<2.1&&enemy.cooldown<=0){const dir=enemy.root.rotation.y; puck.userData.vx+=Math.sin(dir)*7*level;puck.userData.vz+=Math.cos(dir)*7*level;enemy.cooldown=.8}
  return;
 }
 const t=aimAt(enemy,player.root.position.x,player.root.position.z,dt,level);
 drive(enemy,dt,t.throttle,t.steer,false);
}
function updatePuck(dt){
 if(!puck)return;
 puck.position.x+=puck.userData.vx*dt;puck.position.z+=puck.userData.vz*dt;
 const friction=Math.pow(.985,dt*60);puck.userData.vx*=friction;puck.userData.vz*=friction;
 if(Math.abs(puck.position.x)>8.9){puck.position.x=clamp(puck.position.x,-8.9,8.9);puck.userData.vx*=-.8}
 if(Math.abs(puck.position.z)>5.9){
  if(Math.abs(puck.position.x)<1.75){goal(Math.sign(puck.position.z)>0?'red':'blue');return}
  puck.position.z=clamp(puck.position.z,-5.9,5.9);puck.userData.vz*=-.8;
 }
 for(const bot of [player,enemy]){
  const dx=puck.position.x-bot.root.position.x,dz=puck.position.z-bot.root.position.z,d=Math.hypot(dx,dz);
  if(d<1.45&&d>.001){const nx=dx/d,nz=dz/d;puck.userData.vx+=nx*(Math.abs(bot.v)*.8+1.8);puck.userData.vz+=nz*(Math.abs(bot.v)*.8+1.8);puck.position.x=bot.root.position.x+nx*1.45;puck.position.z=bot.root.position.z+nz*1.45}
 }
 const speed=Math.hypot(puck.userData.vx,puck.userData.vz);if(speed>11){puck.userData.vx*=11/speed;puck.userData.vz*=11/speed}
}
function goal(team){
 if(team==='blue')scoreBlue++;else scoreRed++;
 $('#status').textContent=team==='blue'?'BUT POUR BLEU !':'BUT POUR ROUGE !';
 resetPositions();
 if(scoreBlue>=3||scoreRed>=3)finish(scoreBlue>scoreRed?'BLEU':'ROUGE','Victoire par trois buts.');
}
function updateSumo(){
 for(const [bot,opponent,team] of [[player,enemy,'blue'],[enemy,player,'red']]){
  const r=Math.hypot(bot.root.position.x,bot.root.position.z);
  if(r>8.5){if(team==='blue')roundRed++;else roundBlue++;$('#status').textContent=team==='blue'?'BLEU EST SORTI DU DOHYO':'ROUGE EST SORTI DU DOHYO';resetPositions();if(roundBlue>=2||roundRed>=2)finish(roundBlue>roundRed?'BLEU':'ROUGE','Deux manches gagnantes.')}
 }
}
function updateCombat(){
 if(player.hp<=0)player.alive=false;if(enemy.hp<=0)enemy.alive=false;
 if(!player.alive||!enemy.alive)finish(player.alive?'BLEU':'ROUGE','Robot adverse neutralisé.');
}
function updateHud(){
 if(mode==='combat'){
  $('#score-blue').textContent=Math.ceil(player.hp);$('#score-red').textContent=Math.ceil(enemy.hp);
  $('#bar-blue').style.width=player.hp+'%';$('#bar-red').style.width=enemy.hp+'%';
 }else if(mode==='sumo'){
  $('#score-blue').textContent=roundBlue;$('#score-red').textContent=roundRed;
  $('#label-blue').textContent=$('#label-red').textContent='MANCHE GAGNÉE';
  $('#bar-blue').style.width=(roundBlue/2*100)+'%';$('#bar-red').style.width=(roundRed/2*100)+'%';
 }else{
  $('#score-blue').textContent=scoreBlue;$('#score-red').textContent=scoreRed;
  $('#label-blue').textContent=$('#label-red').textContent='BUTS · PREMIER À 3';
  $('#bar-blue').style.width=(scoreBlue/3*100)+'%';$('#bar-red').style.width=(scoreRed/3*100)+'%';
 }
}
function finish(winner,detail){
 if(ended)return;ended=true;
 $('#end-title').textContent=winner==='BLEU'?'VICTOIRE':'DÉFAITE';
 $('#end-detail').textContent=detail+' Score : '+(mode==='hockey'?scoreBlue+' - '+scoreRed:mode==='sumo'?roundBlue+' - '+roundRed:Math.ceil(player.hp)+' - '+Math.ceil(enemy.hp));
 $('#end').classList.remove('hidden');
}
function attackPuck(bot){
 if(!puck||bot.cooldown>0)return;
 const dx=puck.position.x-bot.root.position.x,dz=puck.position.z-bot.root.position.z;
 if(Math.hypot(dx,dz)<2.8){
  const dir=bot.root.rotation.y;puck.userData.vx+=Math.sin(dir)*9;puck.userData.vz+=Math.cos(dir)*9;bot.cooldown=.65;
 }
}
function setMode(m){
 mode=m;document.querySelectorAll('.mode-card').forEach(c=>c.classList.toggle('selected',c.dataset.mode===m));
 const data={
 combat:{title:'RÈGLES DU COMBAT',items:['Deux robots s’affrontent dans une arène fermée.','Les contacts frontaux avec l’arme infligent des dégâts.','Un robot à 0 % d’intégrité est éliminé.','Si le temps expire, le robot ayant le plus de vie gagne.'],help:'Combat : attaque avec E ou percute avec ton arme.',labels:['INTÉGRITÉ','INTÉGRITÉ']},
 sumo:{title:'RÈGLES DU SUMO',items:['Deux robots commencent face à face sur un dohyo circulaire.','Le but est de pousser entièrement l’adversaire hors du cercle.','Sortir du dohyo fait perdre la manche.','Le premier robot à gagner deux manches remporte le match.','Les armes et dégâts sont désactivés : seule la poussée compte.'],help:'Sumo : pousse l’adversaire hors du cercle.',labels:['MANCHES','MANCHES']},
 hockey:{title:'RÈGLES DU HOCKEY',items:['Deux robots jouent sur une patinoire avec un palet et deux cages.','Pousse ou frappe le palet pour l’envoyer dans la cage adverse.','Un but est validé quand le palet franchit la ligne dans l’ouverture.','Le premier à marquer trois buts gagne.','Les contacts servent à disputer le palet, pas à détruire le robot.'],help:'Hockey : E frappe le palet dans la direction du robot.',labels:['BUTS','BUTS']}
 };
 const d=data[m];$('#rules-title').textContent=d.title;
 $('#rules-list').innerHTML=d.items.map(x=>'<li>'+x+'</li>').join('');
 $('#mode-help').textContent=d.help;
 $('#label-blue').textContent=d.labels[0];$('#label-red').textContent=d.labels[1];
 $('#action-button').textContent=m==='hockey'?'TIR':'ATTAQUE';
}
document.querySelectorAll('.mode-card').forEach(c=>c.addEventListener('click',()=>setMode(c.dataset.mode)));
setMode('combat');
function startMatch(){
 matchDuration=Number($('#duration').value);remaining=matchDuration;
 aiLevel=$('#difficulty').value;speedScale=Number($('#speed').value);
 scoreBlue=scoreRed=roundBlue=roundRed=0;ended=false;
 $('#end').classList.add('hidden');$('#hud-mode').textContent=mode.toUpperCase();
 buildMatch();updateHud();menu.classList.add('hidden');arenaScreen.classList.remove('hidden');
 $('#timer').textContent=formatTime(remaining);$('#status').textContent='3… 2… 1… COMBAT !';
}
function formatTime(t){const n=Math.max(0,Math.ceil(t));return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')}
function backToMenu(){ended=true;arenaScreen.classList.add('hidden');menu.classList.remove('hidden');}
$('#start').addEventListener('click',startMatch);
$('#back-menu').addEventListener('click',backToMenu);
$('#end-menu').addEventListener('click',backToMenu);
$('#rematch').addEventListener('click',startMatch);
function keyDown(e){keys[e.code]=true;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault()}
function keyUp(e){keys[e.code]=false}
addEventListener('keydown',keyDown);addEventListener('keyup',keyUp);
document.querySelectorAll('[data-key]').forEach(b=>{
 const code=b.dataset.key;
 b.addEventListener('pointerdown',e=>{e.preventDefault();keys[code]=true;b.setPointerCapture?.(e.pointerId)});
 const release=e=>{e.preventDefault();keys[code]=false};
 b.addEventListener('pointerup',release);b.addEventListener('pointercancel',release);b.addEventListener('lostpointercapture',()=>keys[code]=false);
});
function resize(){const w=$('#game').clientWidth,h=$('#game').clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false)}
new ResizeObserver(resize).observe($('#game'));resize();
function loop(){
 requestAnimationFrame(loop);
 const dt=Math.min(clock.getDelta(),.04);
 if(!ended&&player&&enemy){
  remaining-=dt;
  if(remaining<=0){remaining=0;if(mode==='combat')finish(player.hp>=enemy.hp?'BLEU':'ROUGE','Temps écoulé : intégrité restante.');else if(mode==='sumo')finish(roundBlue>=roundRed?'BLEU':'ROUGE','Temps écoulé : manches remportées.');else finish(scoreBlue>=scoreRed?'BLEU':'ROUGE','Temps écoulé : buts marqués.')}
  $('#timer').textContent=formatTime(remaining);
  const forward=(keys.KeyW||keys.KeyZ||keys.ArrowUp?1:0)-(keys.KeyS||keys.KeyX||keys.ArrowDown?1:0);
  const steer=(keys.KeyA||keys.KeyQ||keys.ArrowLeft?1:0)-(keys.KeyD||keys.ArrowRight?1:0);
  drive(player,dt,forward,steer,!!keys.Space);
  updateAI(dt);
  if(mode==='combat'){attack(player,enemy);attack(enemy,player);updateCombat()}
  if(mode==='sumo'){attack(player,enemy);attack(enemy,player);updateSumo()}
  if(mode==='hockey'){updatePuck(dt);if(keys.KeyE)attackPuck(player);updatePuck(0)}
  updateHud();
  if(!ended&&goalFlash>0)goalFlash-=dt;
 }
 const target=player?new THREE.Vector3((player.root.position.x+enemy.root.position.x)*.5,0,(player.root.position.z+enemy.root.position.z)*.5):new THREE.Vector3(0,0,0);
 const desired=new THREE.Vector3(target.x,target.y+17,target.z+(mode==='sumo'?18:mode==='hockey'?19:19));
 camera.position.lerp(desired,.035);camera.lookAt(target);
 renderer.render(scene,camera);
}
loop();