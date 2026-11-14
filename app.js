import * as THREE from 'three';

const viewport = document.querySelector('#viewport');
const loading = document.querySelector('#loading');
const resultPanel = document.querySelector('#result');
const resultTitle = document.querySelector('#resultTitle');
const resultSub = document.querySelector('#resultSub');
const hpBars = [document.querySelector('#hp1'), document.querySelector('#hp2')];
const hpTexts = [document.querySelector('#hp1Text'), document.querySelector('#hp2Text')];

const scene = new THREE.Scene();
scene.background = new THREE.Color('#17212c');
scene.fog = new THREE.Fog('#17212c', 19, 36);

const camera = new THREE.PerspectiveCamera(39, 1, 0.1, 100);
camera.position.set(0, 13.5, 16.8);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
viewport.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xaec9e5, 0x252b34, 2.0));
const keyLight = new THREE.DirectionalLight(0xffffff, 3.1);
keyLight.position.set(-5, 12, 7);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -10; keyLight.shadow.camera.right = 10;
keyLight.shadow.camera.top = 10; keyLight.shadow.camera.bottom = -10;
scene.add(keyLight);

const floor = new THREE.Mesh(new THREE.PlaneGeometry(13.2, 13.2), new THREE.MeshStandardMaterial({ color: '#343e48', roughness: .88, metalness: .18 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(13.2, 22, 0x657585, 0x485665);
grid.position.y = .012;
scene.add(grid);

const arena = new THREE.Group();
scene.add(arena);
const wallMat = new THREE.MeshStandardMaterial({ color: '#202d39', metalness: .65, roughness: .4 });
function wall(x,z,sx,sz) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, .55, sz), wallMat);
  mesh.position.set(x,.28,z); mesh.castShadow = true; mesh.receiveShadow = true; arena.add(mesh);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(sx,.07,sz), new THREE.MeshStandardMaterial({color:'#6b8296',metalness:.7,roughness:.28}));
  trim.position.set(x,.57,z); arena.add(trim);
}
wall(0,-6.72,13.6,.32); wall(0,6.72,13.6,.32); wall(-6.72,0,.32,13.6); wall(6.72,0,.32,13.6);

const stripeMat = new THREE.MeshStandardMaterial({color:'#e0a94c',emissive:'#39220a',roughness:.6});
for (const [x,z,rot] of [[-6.35,-6.35,0],[6.35,-6.35,0],[-6.35,6.35,0],[6.35,6.35,0]]) {
  const post = new THREE.Mesh(new THREE.BoxGeometry(.22,.7,.22),stripeMat);
  post.position.set(x,.45,z); post.castShadow=true; arena.add(post);
}
const centerRing = new THREE.Mesh(new THREE.TorusGeometry(1.45,.035,8,80), new THREE.MeshStandardMaterial({color:'#8294a5',metalness:.65,roughness:.4}));
centerRing.rotation.x=Math.PI/2; centerRing.position.y=.025; scene.add(centerRing);

function makeRobot(color, accent, isPlayerOne) {
  const root = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({color, metalness:.72, roughness:.3});
  const dark = new THREE.MeshStandardMaterial({color:'#171d24',metalness:.8,roughness:.28});
  const bright = new THREE.MeshStandardMaterial({color:accent,emissive:accent,emissiveIntensity:.28,metalness:.45,roughness:.28});
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.55,.48,1.35),paint);
  chassis.position.y=.48; chassis.castShadow=true; chassis.receiveShadow=true; root.add(chassis);
  const top = new THREE.Mesh(new THREE.BoxGeometry(.9,.16,.83),dark);
  top.position.set(0,.79,-.02); top.castShadow=true; root.add(top);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.12,.2,.28),bright);
  nose.position.set(0,.43,-.72); nose.castShadow=true; root.add(nose);
  for (const x of [-.82,.82]) for (const z of [-.38,.38]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.23,.23,.18,16),dark);
    wheel.rotation.z=Math.PI/2; wheel.position.set(x,.3,z); wheel.castShadow=true; root.add(wheel);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,.19,12),bright);
    hub.rotation.z=Math.PI/2; hub.position.set(x*1.01,.3,z); root.add(hub);
  }
  const weapon = new THREE.Group();
  weapon.position.set(0,.88,-.58);
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(.18,.12,.92),dark);
  shaft.position.z=-.18; weapon.add(shaft);
  for (const side of [-1,1]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(.18,.16,.56),bright);
    blade.position.set(side*.42,.02,-.45); blade.rotation.y=side*.25; blade.castShadow=true; weapon.add(blade);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,.2,16),bright);
  hub.rotation.x=Math.PI/2; hub.position.z=-.18; weapon.add(hub);
  root.add(weapon);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(.095,12,12),new THREE.MeshBasicMaterial({color:accent}));
  lamp.position.set(0,.84,.42); root.add(lamp);
  root.userData.weapon=weapon;
  root.userData.isPlayerOne=isPlayerOne;
  scene.add(root);
  return root;
}

const robots = [
  {mesh:makeRobot('#176da5','#61c8ff',true),x:-3.25,z:0,vx:0,vz:0,hp:100,angle:0,cooldown:0,attack:0,flash:0},
  {mesh:makeRobot('#a83b37','#ff8b62',false),x:3.25,z:0,vx:0,vz:0,hp:100,angle:Math.PI,cooldown:0,attack:0,flash:0}
];
const keys = new Set();
let running = true, last = 0, elapsed = 0;

function setKey(code, down) {
  if (down) keys.add(code); else keys.delete(code);
}
window.addEventListener('keydown',e=>{
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
  setKey(e.code,true);
});
window.addEventListener('keyup',e=>setKey(e.code,false));
window.addEventListener('blur',()=>keys.clear());
document.querySelectorAll('[data-key]').forEach(button=>{
  const code=button.dataset.key;
  button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);setKey(code,true);});
  const release=()=>setKey(code,false);
  button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
});

function attack(player, enemy) {
  if (player.cooldown>0 || !running) return;
  player.cooldown=.62; player.attack=.28;
  const dx=enemy.x-player.x,dz=enemy.z-player.z;
  const dist=Math.hypot(dx,dz);
  const facingX=-Math.sin(player.angle), facingZ=-Math.cos(player.angle);
  const dot=dist>0?(dx*facingX+dz*facingZ)/dist:1;
  if(dist<2.05 && dot>-.15) {
    const damage=10+Math.random()*5;
    enemy.hp=Math.max(0,enemy.hp-damage);
    const force=5.5;
    enemy.vx+=(dx/(dist||1))*force; enemy.vz+=(dz/(dist||1))*force;
    enemy.flash=.16;
    updateHud();
    if(enemy.hp<=0) endMatch(player===robots[0]?0:1);
  }
}

function updateHud(){
  robots.forEach((r,i)=>{
    const hp=Math.max(0,Math.round(r.hp));
    hpBars[i].style.width=hp+'%'; hpTexts[i].textContent=hp+'%';
  });
}
function endMatch(winner){
  running=false;
  resultTitle.textContent=winner===0?'IRON JACK GAGNE':'RUST FURY GAGNE';
  resultSub.textContent='K.-O. — Le robot adverse est hors combat';
  resultPanel.classList.remove('hidden');
}
function reset(){
  robots[0].x=-3.25;robots[0].z=0;robots[0].angle=0;
  robots[1].x=3.25;robots[1].z=0;robots[1].angle=Math.PI;
  robots.forEach(r=>{r.vx=0;r.vz=0;r.hp=100;r.cooldown=0;r.attack=0;r.flash=0;r.mesh.rotation.set(0,0,0);});
  keys.clear();running=true;elapsed=0;updateHud();resultPanel.classList.add('hidden');
}
document.querySelector('#reset').addEventListener('click',reset);
document.querySelector('#playAgain').addEventListener('click',reset);

function update(dt){
  elapsed+=dt;
  const controls=[
    {up:'KeyW',down:'KeyS',left:'KeyA',right:'KeyD',attack:'Space'},
    {up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight',attack:'Enter'}
  ];
  robots.forEach((r,i)=>{
    const c=controls[i];
    let ix=(keys.has(c.right)?1:0)-(keys.has(c.left)?1:0);
    let iz=(keys.has(c.down)?1:0)-(keys.has(c.up)?1:0);
    const len=Math.hypot(ix,iz)||1;ix/=len;iz/=len;
    const accel=18;
    r.vx+=ix*accel*dt;r.vz+=iz*accel*dt;
    const friction=Math.exp(-5.5*dt);
    r.vx*=friction;r.vz*=friction;
    const speed=Math.hypot(r.vx,r.vz),max=5.2;
    if(speed>max){r.vx=r.vx/speed*max;r.vz=r.vz/speed*max;}
    r.x+=r.vx*dt;r.z+=r.vz*dt;
    r.x=THREE.MathUtils.clamp(r.x,-5.55,5.55);r.z=THREE.MathUtils.clamp(r.z,-5.55,5.55);
    if(Math.hypot(ix,iz)>.1) r.angle=Math.atan2(-ix,-iz);
    r.cooldown=Math.max(0,r.cooldown-dt);r.attack=Math.max(0,r.attack-dt);r.flash=Math.max(0,r.flash-dt);
    if(keys.has(c.attack))attack(r,robots[1-i]);
    r.mesh.position.set(r.x,0,r.z);
    r.mesh.rotation.y=r.angle;
    r.mesh.userData.weapon.rotation.y+=dt*(r.attack>0?24:2.2);
    r.mesh.position.y=Math.sin(elapsed*7+i)*.018;
    r.mesh.traverse(o=>{if(o.isMesh && o.material===undefined)return;});
  });
  const a=robots[0],b=robots[1],dx=b.x-a.x,dz=b.z-a.z,dist=Math.hypot(dx,dz),min=1.28;
  if(dist<min && dist>0){
    const overlap=(min-dist)/2,nx=dx/dist,nz=dz/dist;
    a.x-=nx*overlap;b.x+=nx*overlap;a.z-=nz*overlap;b.z+=nz*overlap;
    const rel=(b.vx-a.vx)*nx+(b.vz-a.vz)*nz;
    if(rel<0){a.vx+=nx*rel*.8;b.vx-=nx*rel*.8;a.vz+=nz*rel*.8;b.vz-=nz*rel*.8;}
  }
  // Keep both machines inside the steel perimeter after collision resolution.
  robots.forEach(r=>{r.x=THREE.MathUtils.clamp(r.x,-5.55,5.55);r.z=THREE.MathUtils.clamp(r.z,-5.55,5.55);});
}

function resize(){
  const w=viewport.clientWidth,h=viewport.clientHeight;
  if(!w||!h)return;
  camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);
}
new ResizeObserver(resize).observe(viewport);resize();

function animate(now){
  requestAnimationFrame(animate);
  const dt=Math.min((now-last)/1000||0,.033);last=now;
  if(running)update(dt);
  renderer.render(scene,camera);
}
requestAnimationFrame(animate);
loading.remove();
