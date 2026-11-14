import * as THREE from 'three';

const game = document.querySelector('#game');
const loading = document.querySelector('#loading');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101923);
scene.fog = new THREE.Fog(0x101923, 24, 48);

const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
camera.position.set(0, 17, 19);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
game.insertBefore(renderer.domElement, game.firstChild);

scene.add(new THREE.HemisphereLight(0xb9d7ff, 0x26313d, 2));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(-7, 15, 9); sun.castShadow = true; sun.shadow.mapSize.set(2048,2048); scene.add(sun);

const arena = new THREE.Group(); scene.add(arena);
const floor = new THREE.Mesh(new THREE.BoxGeometry(20, .5, 14), new THREE.MeshStandardMaterial({color:0x343e49, roughness:.85}));
floor.position.y=-.35; floor.receiveShadow=true; arena.add(floor);
const top = new THREE.Mesh(new THREE.PlaneGeometry(19.2,13.2), new THREE.MeshStandardMaterial({color:0x59636c,roughness:.92}));
top.rotation.x=-Math.PI/2; top.position.y=-.085; top.receiveShadow=true; arena.add(top);
const grid = new THREE.GridHelper(19.2,24,0x8995a1,0x687581); grid.position.y=-.07; arena.add(grid);
const wallMat = new THREE.MeshStandardMaterial({color:0x18232f,metalness:.55,roughness:.4});
for(const [x,z,w,d] of [[0,-7,20,.35],[0,7,20,.35],[-10,0,.35,14],[10,0,.35,14]]){
 const wall=new THREE.Mesh(new THREE.BoxGeometry(w,1.15,d),wallMat); wall.position.set(x,.3,z); wall.castShadow=true; arena.add(wall);
}
for(let i=0;i<4;i++){const lamp=new THREE.PointLight(0x4a9dff,18,9);lamp.position.set(i%2?8:-8,4,i<2?-5:5);scene.add(lamp)}

function makeRobot(color, accent, x, z, angle){
 const root=new THREE.Group(); root.position.set(x,.18,z); root.rotation.y=angle; scene.add(root);
 const bodyMat=new THREE.MeshStandardMaterial({color,metalness:.65,roughness:.32});
 const accentMat=new THREE.MeshStandardMaterial({color:accent,metalness:.7,roughness:.25});
 const body=new THREE.Mesh(new THREE.BoxGeometry(2.25,.62,1.55),bodyMat); body.castShadow=true; body.receiveShadow=true; root.add(body);
 const deck=new THREE.Mesh(new THREE.BoxGeometry(1.45,.16,1.1),accentMat); deck.position.y=.38; deck.castShadow=true; root.add(deck);
 for(const side of [-1,1]) for(const front of [-1,1]){
  const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.32,.32,.24,16),new THREE.MeshStandardMaterial({color:0x101318,roughness:.9}));
  wheel.rotation.z=Math.PI/2; wheel.position.set(side*1.08,-.12,front*.48); root.add(wheel);
 }
 const weapon=new THREE.Group(); weapon.position.set(0,.55,-.68); root.add(weapon);
 const disc=new THREE.Mesh(new THREE.CylinderGeometry(.72,.72,.16,32),accentMat); disc.rotation.x=Math.PI/2; disc.castShadow=true; weapon.add(disc);
 for(let i=0;i<4;i++){const tooth=new THREE.Mesh(new THREE.BoxGeometry(.25,.25,.22),accentMat);const a=i*Math.PI/2;tooth.position.set(Math.cos(a)*.72,Math.sin(a)*.72,0);weapon.add(tooth)}
 return {root,weapon,hp:100,v:0,turn:0,alive:true,hitCooldown:0};
}
const player=makeRobot(0x167ac0,0x54c9ff,-5,0,Math.PI/2);
const enemy=makeRobot(0xb82c32,0xff6a50,5,0,-Math.PI/2);
const keys={};
addEventListener('keydown',e=>{keys[e.code]=true;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault()});
addEventListener('keyup',e=>keys[e.code]=false);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const hpP=document.querySelector('#health-player'),hpE=document.querySelector('#health-enemy');
const txtP=document.querySelector('#hp-player'),txtE=document.querySelector('#hp-enemy');
const message=document.querySelector('#message');
let ended=false;
function damage(bot,n){if(!bot.alive)return;bot.hp=Math.max(0,bot.hp-n);if(bot.hp===0)bot.alive=false}
function updateRobot(bot,dt,throttle,steer,boost=false){
 if(!bot.alive)return;
 const accel=boost?10:6;
 bot.v+=throttle*accel*dt;bot.v*=Math.pow(.91,dt*60);bot.v=clamp(bot.v,-4.5,boost?8:5.5);
 bot.root.rotation.y+=steer*(1.9+Math.abs(bot.v)*.16)*dt;
 bot.root.position.x+=Math.sin(bot.root.rotation.y)*bot.v*dt;
 bot.root.position.z+=Math.cos(bot.root.rotation.y)*bot.v*dt;
 bot.root.position.x=clamp(bot.root.position.x,-8.8,8.8);
 bot.root.position.z=clamp(bot.root.position.z,-5.8,5.8);
 bot.weapon.rotation.z+=dt*18;
 bot.hitCooldown=Math.max(0,bot.hitCooldown-dt);
}
function combat(a,b){
 const dx=b.root.position.x-a.root.position.x,dz=b.root.position.z-a.root.position.z;
 const dist=Math.hypot(dx,dz);
 if(dist<1.8&&dist>.001){
  const overlap=1.8-dist, nx=dx/dist,nz=dz/dist;
  a.root.position.x-=nx*overlap*.5;b.root.position.x+=nx*overlap*.5;
  a.root.position.z-=nz*overlap*.5;b.root.position.z+=nz*overlap*.5;
  a.v*=.75;b.v*=.75;
 }
 if(dist<2.05&&a.hitCooldown===0&&b.hitCooldown===0){
  const facing=Math.sin(a.root.rotation.y)*dx+Math.cos(a.root.rotation.y)*dz;
  const otherFacing=-Math.sin(b.root.rotation.y)*dx-Math.cos(b.root.rotation.y)*dz;
  if(facing>0.2){damage(b,5+Math.random()*5);a.hitCooldown=.48}
  if(otherFacing>0.2){damage(a,5+Math.random()*5);b.hitCooldown=.48}
 }
}
function updateHud(){
 hpP.style.width=player.hp+'%';hpE.style.width=enemy.hp+'%';
 txtP.textContent=Math.ceil(player.hp)+'%';txtE.textContent=Math.ceil(enemy.hp)+'%';
 if(!ended&&(!player.alive||!enemy.alive)){
  ended=true;document.querySelector('#end-title').textContent=player.alive?'VICTOIRE':'DÉFAITE';
  document.querySelector('#end').classList.remove('hidden');
 }
}
function resize(){const w=game.clientWidth,h=game.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false)}
new ResizeObserver(resize).observe(game);resize();
document.querySelector('#restart').addEventListener('click',()=>location.reload());
loading.classList.add('done');

const clock=new THREE.Clock();
function loop(){
 requestAnimationFrame(loop);
 const dt=Math.min(clock.getDelta(),.04);
 if(!ended){
  const forward=(keys.KeyW||keys.KeyZ||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0);
  const steer=(keys.KeyA||keys.KeyQ||keys.ArrowLeft?1:0)-(keys.KeyD||keys.KeyD||keys.ArrowRight?1:0);
  updateRobot(player,dt,forward,steer,!!keys.Space);
  const dx=player.root.position.x-enemy.root.position.x,dz=player.root.position.z-enemy.root.position.z;
  const desired=Math.atan2(dx,dz);
  let delta=((desired-enemy.root.rotation.y+Math.PI*3)%(Math.PI*2))-Math.PI;
  updateRobot(enemy,dt,Math.abs(delta)>.7?.65:1,clamp(delta*1.8,-1,1),false);
  combat(player,enemy);updateHud();
  message.textContent='ENGAGE-TOI • RESTE EN MOUVEMENT';
 }
 const target=new THREE.Vector3((player.root.position.x+enemy.root.position.x)*.5,0,(player.root.position.z+enemy.root.position.z)*.5);
 camera.position.x+=(target.x-camera.position.x)*dt*1.5;
 camera.position.z+=(target.z+19-camera.position.z)*dt*1.5;
 camera.lookAt(target);
 renderer.render(scene,camera);
}
loop();