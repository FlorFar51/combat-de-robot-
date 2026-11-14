import * as THREE from 'three';
const $=s=>document.querySelector(s), game=$('#game'), menu=$('#menu'), arenaScreen=$('#arena-screen');
const scene=new THREE.Scene();scene.background=new THREE.Color(0x080808);scene.fog=new THREE.Fog(0x080808,28,60);
const camera=new THREE.PerspectiveCamera(48,1,.1,100);camera.position.set(0,18,20);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.outputColorSpace=THREE.SRGBColorSpace;game.insertBefore(renderer.domElement,menu);
scene.add(new THREE.HemisphereLight(0xaaaaaa,0x333333,1.7));const sun=new THREE.DirectionalLight(0xffffff,2);sun.position.set(-8,16,9);sun.castShadow=true;scene.add(sun);
const world=new THREE.Group();scene.add(world);const keys={};
let mode='combat',player,enemy,puck,ended=true,remaining=180,aiLevel='normal',scoreBlue=0,scoreRed=0,roundBlue=0,roundRed=0,goalLock=0;
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
 floorBox(20,14,mode==='hockey'?mat(0x666666):M.floor);
 if(mode==='combat'){
  for(const [x,z,w,d] of [[0,-7,20,.35],[0,7,20,.35],[-10,0,.35,14],[10,0,.35,14]])add(new THREE.BoxGeometry(w,1,d),M.black,world,x,.25,z);
  const grid=new THREE.GridHelper(19,24,0x777777,0x444444);grid.position.y=-.03;world.add(grid);return;
 }
 // Rink: two goals centered on the short end walls, with open mouths facing the rink.
 for(const [x,z,w,d] of [[-10,0,.3,14],[10,0,.3,14],[-5.875,-7,8.25,.3],[5.875,-7,8.25,.3],[-5.875,7,8.25,.3],[5.875,7,8.25,.3]])add(new THREE.BoxGeometry(w,.65,d),M.black,world,x,.12,z);
 for(const z of [-7,7]){
  const back=z<0?-8.25:8.25;
  for(const x of [-1.7,1.7])add(new THREE.BoxGeometry(.12,1.15,1.25),M.steel,world,x,.52,z);
  add(new THREE.BoxGeometry(3.5,.12,1.25),M.steel,world,0,1.08,z);
  const net=add(new THREE.BoxGeometry(3.35,.8,.08),mat(0x222222),world,0,.48,back);net.material.transparent=true;net.material.opacity=.5;
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
  // Large open C-shaped hook guides the puck toward the robot's mouth without enclosing it.
  add(new THREE.BoxGeometry(1.9,.4,1.55),body,root);
  for(const s of [-1,1])for(const f of [-1,1]){const wheel=add(new THREE.CylinderGeometry(.29,.29,.2,18),M.rubber,root,s*.87,-.1,f*.48);wheel.rotation.z=Math.PI/2}
  const pts=[[-1,.12,-.48],[-1.22,.12,-.92],[-1.12,.12,-1.52],[-.72,.12,-1.92],[0,.12,-2.08],[.72,.12,-1.92],[1.12,.12,-1.52],[1.22,.12,-.92],[1,.12,-.48]].map(p=>new THREE.Vector3(...p));
  const curve=new THREE.CatmullRomCurve3(pts);const hook=new THREE.Mesh(new THREE.TubeGeometry(curve,40,.13,10,false),accent);root.add(hook);
  add(new THREE.BoxGeometry(.25,.12,.28),M.black,root,-1.05,.12,-1.5);add(new THREE.BoxGeometry(.25,.12,.28),M.black,root,1.05,.12,-1.5);
 }
 return {root,weapon,hp:100,v:0,alive:true,cooldown:0};
}
function resetPositions(){
 if(!player||!enemy)return;
 if(mode==='sumo'){player.root.position.set(-3,.12,0);player.root.rotation.y=Math.PI/2;enemy.root.position.set(3,.12,0);enemy.root.rotation.y=-Math.PI/2}
 else if(mode==='hockey'){player.root.position.set(0,.12,4.5);player.root.rotation.y=Math.PI;enemy.root.position.set(0,.12,-4.5);enemy.root.rotation.y=0}
 else{player.root.position.set(-5,.12,0);player.root.rotation.y=Math.PI/2;enemy.root.position.set(5,.12,0);enemy.root.rotation.y=-Math.PI/2}
 for(const b of [player,enemy]){b.v=0;b.hp=100;b.alive=true;b.cooldown=0}
 if(puck){puck.position.set(0,.12,0);puck.userData.vx=puck.userData.vz=0}
}
function buildMatch(){buildArena();player=makeRobot('blue');enemy=makeRobot('red');if(mode==='hockey'){puck=add(new THREE.CylinderGeometry(.43,.43,.18,32),M.black,world,0,.12,0);puck.userData={vx:0,vz:0}}resetPositions()}
function drive(bot,dt,throttle,steer,boost=false){
 if(!bot.alive)return;
 const max=mode==='sumo'?11:mode==='hockey'?13:12,accel=mode==='sumo'?25:mode==='hockey'?24:22;
 bot.v+=throttle*accel*(boost?1.35:1)*dt;bot.v*=Math.pow(mode==='sumo'?.94:.965,dt*60);bot.v=clamp(bot.v,-max*.72,max*(boost?1.35:1));
 const turn=mode==='sumo'?11:mode==='hockey'?12:11;
 bot.root.rotation.y+=steer*turn*(.8+Math.min(Math.abs(bot.v)/max,.2))*dt;
 bot.root.position.x+=Math.sin(bot.root.rotation.y)*bot.v*dt;bot.root.position.z+=Math.cos(bot.root.rotation.y)*bot.v*dt;
 if(mode==='combat')bot.weapon.rotation.y+=dt*20;
 bot.cooldown=Math.max(0,bot.cooldown-dt);
}
function aim(bot,x,z,aggression=1){const dx=x-bot.root.position.x,dz=z-bot.root.position.z,desired=Math.atan2(dx,dz);let d=((desired-bot.root.rotation.y+Math.PI*3)%(Math.PI*2))-Math.PI;return {throttle:Math.abs(d)>2.5?.15:aggression,steer:clamp(d*3.8,-1,1)}}
function updateAI(dt){
 const level=aiLevel==='easy'?.75:aiLevel==='hard'?1.25:1;
 const target=mode==='hockey'?puck:player.root;
 const t=aim(enemy,target.position.x,target.position.z,level);drive(enemy,dt,t.throttle,t.steer);
 if(mode==='hockey'&&Math.hypot(enemy.root.position.x-puck.position.x,enemy.root.position.z-puck.position.z)<2.5&&enemy.cooldown<=0){puck.userData.vx+=Math.sin(enemy.root.rotation.y)*13*level;puck.userData.vz+=Math.cos(enemy.root.rotation.y)*13*level;enemy.cooldown=.4}
}
function collideBots(a,b,dt){
 const dx=b.root.position.x-a.root.position.x,dz=b.root.position.z-a.root.position.z,d=Math.hypot(dx,dz);
 if(d<=0||d>2.1)return;
 const nx=dx/d,nz=dz/d,over=2.1-d;a.root.position.x-=nx*over*.5;b.root.position.x+=nx*over*.5;a.root.position.z-=nz*over*.5;b.root.position.z+=nz*over*.5;
 const fa=Math.sin(a.root.rotation.y)*dx+Math.cos(a.root.rotation.y)*dz,fb=-Math.sin(b.root.rotation.y)*dx-Math.cos(b.root.rotation.y)*dz;
 if(mode==='combat'){if(fa>0&&a.cooldown<=0){b.hp=Math.max(0,b.hp-rand(8,14));a.cooldown=.4}if(fb>0&&b.cooldown<=0){a.hp=Math.max(0,a.hp-rand(8,14));b.cooldown=.4}}
 if(mode==='sumo'){if(fa>0)b.v+=12*dt*10;if(fb>0)a.v+=12*dt*10}
}
function updatePuck(dt){
 puck.position.x+=puck.userData.vx*dt;puck.position.z+=puck.userData.vz*dt;
 const friction=Math.pow(.986,dt*60);puck.userData.vx*=friction;puck.userData.vz*=friction;
 if(Math.abs(puck.position.x)>9.3){puck.position.x=clamp(puck.position.x,-9.3,9.3);puck.userData.vx*=-.8}
 if(puck.position.z<-7.1&&Math.abs(puck.position.x)<1.65){scoreGoal('blue');return}
 if(puck.position.z>7.1&&Math.abs(puck.position.x)<1.65){scoreGoal('red');return}
 if(Math.abs(puck.position.z)>6.7){puck.position.z=clamp(puck.position.z,-6.7,6.7);puck.userData.vz*=-.75}
 for(const b of [player,enemy]){const dx=puck.position.x-b.root.position.x,dz=puck.position.z-b.root.position.z,d=Math.hypot(dx,dz);if(d<1.55&&d>.01){const nx=dx/d,nz=dz/d;puck.userData.vx+=nx*(Math.abs(b.v)*.6+2);puck.userData.vz+=nz*(Math.abs(b.v)*.6+2);puck.position.x=b.root.position.x+nx*1.55;puck.position.z=b.root.position.z+nz*1.55}}
 const s=Math.hypot(puck.userData.vx,puck.userData.vz);if(s>17){puck.userData.vx*=17/s;puck.userData.vz*=17/s}
}
function scoreGoal(team){if(goalLock>0)return;goalLock=.8;if(team==='blue')scoreBlue++;else scoreRed++;$('#status').textContent=team==='blue'?'BUT BLEU':'BUT ROUGE';resetPositions();if(scoreBlue>=3||scoreRed>=3)finish(scoreBlue>scoreRed?'BLEU':'ROUGE','Premier à trois buts.')}
function updateSumo(){for(const [b,t] of [[player,'blue'],[enemy,'red']])if(Math.hypot(b.root.position.x,b.root.position.z)>8.4){if(t==='blue')roundRed++;else roundBlue++;resetPositions();if(roundBlue>=2||roundRed>=2)finish(roundBlue>roundRed?'BLEU':'ROUGE','Deux manches gagnantes.')}}
function updateHud(){
 const a=mode==='combat'?player.hp:mode==='sumo'?roundBlue:scoreBlue,b=mode==='combat'?enemy.hp:mode==='sumo'?roundRed:scoreRed;
 $('#score-blue').textContent=Math.ceil(a);$('#score-red').textContent=Math.ceil(b);
 $('#bar-blue').style.width=(mode==='combat'?a:a/3*100)+'%';$('#bar-red').style.width=(mode==='combat'?b:b/3*100)+'%';
 $('#label-blue').textContent=$('#label-red').textContent=mode==='combat'?'INTÉGRITÉ':mode==='sumo'?'MANCHES':'BUTS';
}
function finish(winner,detail){if(ended)return;ended=true;$('#end-title').textContent=winner==='BLEU'?'VICTOIRE':'DÉFAITE';$('#end-detail').textContent=detail;$('#end').classList.remove('hidden')}
function attackPuck(bot){if(!puck||bot.cooldown>0)return;const d=Math.hypot(puck.position.x-bot.root.position.x,puck.position.z-bot.root.position.z);if(d<3){puck.userData.vx+=Math.sin(bot.root.rotation.y)*16;puck.userData.vz+=Math.cos(bot.root.rotation.y)*16;bot.cooldown=.3}}
function setMode(m){
 mode=m;document.querySelectorAll('.mode-card').forEach(c=>c.classList.toggle('selected',c.dataset.mode===m));
 const data={
 combat:{title:'RÈGLES · COMBAT',items:['Duel dans une arène fermée.','L’arme rotative inflige des dégâts sur les impacts.','Un robot neutralisé ou à 0 % est éliminé.','À la fin du temps, le plus d’intégrité gagne.'],help:'Combat : E pour une attaque supplémentaire.',labels:['INTÉGRITÉ','INTÉGRITÉ']},
 sumo:{title:'RÈGLES · SUMO',items:['Deux robots se font face sur un dohyo circulaire.','Pousse l’adversaire hors du cercle.','Sortir du dohyo fait perdre la manche.','Le premier à gagner deux manches remporte le match.'],help:'Sumo : pousse l’adversaire hors du dohyo.',labels:['MANCHES','MANCHES']},
 hockey:{title:'RÈGLES · HOCKEY',items:['Deux robots jouent sur une patinoire avec un palet et deux cages.','Le crochet ouvert guide le palet sans l’enfermer.','Un but est marqué lorsque le palet franchit la ligne dans la cage.','Le premier à marquer trois buts gagne.'],help:'Hockey : E pour frapper le palet.',labels:['BUTS','BUTS']}
 }[m];
 $('#rules-title').textContent=data.title;$('#rules-list').innerHTML=data.items.map(x=>'<li>'+x+'</li>').join('');$('#mode-help').textContent=data.help;$('#label-blue').textContent=data.labels[0];$('#label-red').textContent=data.labels[1];$('#action-button').textContent=m==='hockey'?'TIR':'ATTAQUE';$('#weight-setting').style.display=m==='combat'?'grid':'none';
}
document.querySelectorAll('.mode-card').forEach(c=>c.addEventListener('click',()=>setMode(c.dataset.mode)));setMode('combat');
function fmt(t){const n=Math.max(0,Math.ceil(t));return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')}
function startMatch(){remaining=Number($('#duration').value);aiLevel=$('#difficulty').value;scoreBlue=scoreRed=roundBlue=roundRed=0;goalLock=0;ended=false;$('#end').classList.add('hidden');$('#hud-mode').textContent=mode.toUpperCase();buildMatch();updateHud();menu.classList.add('hidden');arenaScreen.classList.remove('hidden');$('#timer').textContent=fmt(remaining)}
function backMenu(){ended=true;arenaScreen.classList.add('hidden');menu.classList.remove('hidden')}
$('#start').addEventListener('click',startMatch);$('#back-menu').addEventListener('click',backMenu);$('#end-menu').addEventListener('click',backMenu);$('#rematch').addEventListener('click',startMatch);
addEventListener('keydown',e=>{keys[e.code]=true;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault()});addEventListener('keyup',e=>keys[e.code]=false);
document.querySelectorAll('[data-key]').forEach(b=>{const k=b.dataset.key;b.addEventListener('pointerdown',e=>{e.preventDefault();keys[k]=true;b.setPointerCapture?.(e.pointerId)});const up=e=>{e.preventDefault();keys[k]=false};b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);b.addEventListener('lostpointercapture',()=>keys[k]=false)});
function resize(){const w=game.clientWidth,h=game.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false)}new ResizeObserver(resize).observe(game);resize();
function loop(){
 requestAnimationFrame(loop);const dt=Math.min(clock.getDelta(),.04);goalLock=Math.max(0,goalLock-dt);
 if(!ended&&player&&enemy){
  remaining-=dt;if(remaining<=0){remaining=0;finish(mode==='combat'?(player.hp>=enemy.hp?'BLEU':'ROUGE'):mode==='sumo'?(roundBlue>=roundRed?'BLEU':'ROUGE'):(scoreBlue>=scoreRed?'BLEU':'ROUGE'),'Temps écoulé.')}
  $('#timer').textContent=fmt(remaining);
  const f=(keys.KeyW||keys.KeyZ||keys.ArrowUp?1:0)-(keys.KeyS||keys.KeyX||keys.ArrowDown?1:0),s=(keys.KeyA||keys.KeyQ||keys.ArrowLeft?1:0)-(keys.KeyD||keys.ArrowRight?1:0);
  drive(player,dt,f,s,!!keys.Space);updateAI(dt);
  if(mode==='hockey'){updatePuck(dt);if(keys.KeyE)attackPuck(player)}
  else{collideBots(player,enemy,dt);if(mode==='sumo')updateSumo();else if(player.hp<=0||enemy.hp<=0)finish(player.hp>enemy.hp?'BLEU':'ROUGE','Robot neutralisé.')}
  updateHud();
 }
 const target=player?new THREE.Vector3((player.root.position.x+enemy.root.position.x)*.5,0,(player.root.position.z+enemy.root.position.z)*.5):new THREE.Vector3(0,0,0);
 camera.position.lerp(new THREE.Vector3(target.x,mode==='sumo'?19:17,target.z+19),.045);camera.lookAt(target);renderer.render(scene,camera);
}
loop();
