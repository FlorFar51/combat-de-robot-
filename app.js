import * as THREE from 'three';
import RAPIER from 'https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.20.0/+esm';
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
const DEFAULT_BINDINGS={forward:'KeyW',left:'KeyA',right:'KeyD',action:'KeyE'};let bindings={...DEFAULT_BINDINGS},waitingForBind=null,assigning=null,activeGamepad=null,lastSawKey=false,lastControllerSaw=false,sawEnabled=false;
const controllerMap={throttle:{axis:2,invert:1},steering:{axis:0,invert:1},saw:{button:0}};
let invertThrottle=false,invertSteering=false;
let mode='combat',player,enemy,puck,ended=true,countdown=0,remaining=120,testMode=false,aiLevel='normal',scoreBlue=0,scoreRed=0,roundBlue=0,roundRed=0,goalLock=0,hockeyFaceoff=null,tunedSpeed=2.7,tunedRotation=2.0,puckGlide=.1,puckBounce=10;
const net={ws:null,role:null,roomId:null,serverUrl:'',opponent:false,remote:{throttle:0,steering:0,action:false},lastInput:0,lastState:0,lastPing:0,ping:null,hz:60,guestStates:[]};

/* RAPIER_PHYSICS_LAB — prototype isolé pour valider la physique 3D avant intégration au gameplay */
const physicsLab=(()=>{
 const canvas=document.querySelector('#physics-canvas'),status=document.querySelector('#physics-state');
 if(!canvas)return null;
 let renderer,scene,camera,world,body,robotVisual,clock,last=0,accumulator=0,ready=false,failed=false;
 const fixedDt=1/60,keys=new Set(),wheels=[],tmpV=new THREE.Vector3();let inputDebugFrames=0,lastButtonStates=[],lastAxisSnapshot='',lastLabAction='Aucune';
  const inputDiag=()=>document.querySelector('#physics-input-diagnostic');
  function logLabInput(message){lastLabAction=message;const el=inputDiag();if(el)el.textContent='DERNIÈRE ACTION : '+message;}
 const settings={power:.65,turn:.55,grip:.85,brake:false};
 const mat=(color,metalness=.2,roughness=.55)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
 const mats={frame:mat(0x788b9c,.7,.3),top:mat(0x344b5e,.6,.32),rubber:mat(0x101317,.05,.95),fork:mat(0xb9c7d2,.8,.24),ground:mat(0x242a30,.25,.75)};
 const V=(x,y,z)=>new RAPIER.Vector3(x,y,z);
 function visualBox(parent,w,h,d,material,pos){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
 async function init(){
  try{
   status.textContent='CHARGEMENT RAPIER…';
   await RAPIER.init();
   scene=new THREE.Scene();scene.background=new THREE.Color(0x101820);
   camera=new THREE.PerspectiveCamera(43,1,.1,100);camera.position.set(5.7,5.2,7.4);camera.lookAt(0,.5,0);
   renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.shadowMap.enabled=true;renderer.outputColorSpace=THREE.SRGBColorSpace;
   scene.add(new THREE.HemisphereLight(0xc8ddf0,0x343a40,2));
   const sun=new THREE.DirectionalLight(0xffffff,2.2);sun.position.set(-4,8,5);sun.castShadow=true;scene.add(sun);
   const floor=new THREE.Mesh(new THREE.BoxGeometry(18,.4,18),mats.ground);floor.position.y=-.2;floor.receiveShadow=true;scene.add(floor);
   const grid=new THREE.GridHelper(18,36,0x65717c,0x38434d);grid.position.y=.008;scene.add(grid);
   world=new RAPIER.World(V(0,-9.81,0));world.timestep=fixedDt;
   const floorBody=world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,-.2,0));
   world.createCollider(RAPIER.ColliderDesc.cuboid(9,.2,9).setFriction(.9).setRestitution(.08),floorBody);
   body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0,.43,0).setCanSleep(false).setLinearDamping(.18).setAngularDamping(1.1));
   body.setAdditionalMass(3.2,true);
   world.createCollider(RAPIER.ColliderDesc.cuboid(.78,.2,.56).setFriction(.75).setRestitution(.08),body);
   // Two fixed drive wheels: their visual spin is separate, ground traction is calculated at each wheel contact.
   const wheelGeometry=new THREE.CylinderGeometry(.23,.23,.16,24);wheelGeometry.rotateZ(Math.PI/2);
   for(const x of [-.88,.88]){
    const col=world.createCollider(RAPIER.ColliderDesc.cylinder(.08,.23).setTranslation(x,-.20,0).setRotation({x:0,y:0,z:Math.SQRT1_2,w:Math.SQRT1_2}).setFriction(.95).setRestitution(.03),body);
    const mesh=new THREE.Mesh(wheelGeometry,mats.rubber);mesh.position.set(x,-.20,0);mesh.castShadow=true;
    wheels.push({x,collider:col,mesh,spin:0});
   }
   robotVisual=new THREE.Group();scene.add(robotVisual);
   visualBox(robotVisual,1.56,.4,1.12,mats.frame,[0,0,0]);
   visualBox(robotVisual,1.02,.12,.8,mats.top,[0,.255,-.03]);
   // Two fixed forks and low-friction skids.
   visualBox(robotVisual,.32,.09,.9,mats.fork,[0,-.13,-.91]);
   visualBox(robotVisual,.13,.075,.52,mats.fork,[-.52,-.15,.52]);
   visualBox(robotVisual,.13,.075,.52,mats.fork,[.52,-.15,.52]);
   world.createCollider(RAPIER.ColliderDesc.cuboid(.16,.045,.45).setTranslation(0,-.13,-.91).setFriction(.2).setRestitution(.04),body);
   for(const x of [-.52,.52])world.createCollider(RAPIER.ColliderDesc.cuboid(.065,.0375,.26).setTranslation(x,-.15,.52).setFriction(.16).setRestitution(.02),body);
   wheels.forEach(w=>robotVisual.add(w.mesh));
   clock=new THREE.Clock();ready=true;status.textContent='PHYSIQUE ACTIVE · 60 HZ';
   requestAnimationFrame(frame);
  }catch(err){failed=true;status.textContent='ERREUR PHYSIQUE';document.querySelector('#physics-message').textContent='Impossible de charger Rapier : '+(err?.message||String(err));console.error(err)}
 }
 function localToWorld(x,y,z){const q=body.rotation();const p=body.translation();const v=new RAPIER.Vector3(x,y,z);const r=q;const xx=v.x,yy=v.y,zz=v.z;v.x=(1-2*(r.y*r.y+r.z*r.z))*xx+2*(r.x*r.y-r.z*r.w)*yy+2*(r.x*r.z+r.y*r.w)*zz;v.y=2*(r.x*r.y+r.z*r.w)*xx+(1-2*(r.x*r.x+r.z*r.z))*yy+2*(r.y*r.z-r.x*r.w)*zz;v.z=2*(r.x*r.z-r.y*r.w)*xx+2*(r.y*r.z+r.x*r.w)*yy+(1-2*(r.x*r.x+r.y*r.y))*zz;return V(p.x+v.x,p.y+v.y,p.z+v.z)}
 function localDirection(x,y,z){const r=body.rotation(),xx=x,yy=y,zz=z;return V((1-2*(r.y*r.y+r.z*r.z))*xx+2*(r.x*r.y-r.z*r.w)*yy+2*(r.x*r.z+r.y*r.w)*zz,2*(r.x*r.y+r.z*r.w)*xx+(1-2*(r.x*r.x+r.z*r.z))*yy+2*(r.y*r.z-r.x*r.w)*zz,2*(r.x*r.z-r.y*r.w)*xx+2*(r.y*r.z+r.x*r.w)*yy+(1-2*(r.x*r.x+r.y*r.y))*zz)}
 function drive(){
  const forward=keys.has('KeyW')||keys.has('KeyZ')||keys.has('ArrowUp'),reverse=keys.has('KeyS')||keys.has('ArrowDown'),left=keys.has('KeyA')||keys.has('KeyQ')||keys.has('ArrowLeft'),right=keys.has('KeyD')||keys.has('ArrowRight'),keyboardBrake=keys.has('Space');
  // Laboratoire : A2 (axe Y du joystick gauche / axe 3 indiqué dans l'interface) = avance-recul, A0 (axe X) = direction.
  const pads=typeof navigator!=='undefined'&&navigator.getGamepads?[...navigator.getGamepads()]:[];
  const pad=pads.find(p=>p&&p.connected);
  const throttleAxis=2,axis3=pad?.axes?.[throttleAxis]??0;
  if(pad){const states=pad.buttons.map((b,i)=>!!b?.pressed);states.forEach((pressed,i)=>{if(pressed&&!lastButtonStates[i])logLabInput('Manette · bouton '+i+' appuyé');if(!pressed&&lastButtonStates[i])logLabInput('Manette · bouton '+i+' relâché')});lastButtonStates=states;const snap=pad.axes.map((v,i)=>'A'+i+'='+Number(v||0).toFixed(2)).join(' · ');if(snap!==lastAxisSnapshot){lastAxisSnapshot=snap;const el=inputDiag();if(el)el.textContent='AXES MANETTE : '+snap+' | '+lastLabAction;}}
  let gamepadThrottle=axis3*controllerMap.throttle.invert;
  if(Math.abs(gamepadThrottle)<.14)gamepadThrottle=0;
  const keyboardThrottle=(forward?1:0)-(reverse?1:0);
  const throttle=keyboardThrottle||gamepadThrottle;
  const keyboardSteer=(right?1:0)-(left?1:0);
  const rawPadSteer=pad?.axes?.[0]??0;
  const padSteer=Math.abs(rawPadSteer)<.14?0:rawPadSteer*controllerMap.steering.invert;
  var steer=keyboardSteer||padSteer;
  // Aucun bouton de manette n'est utilisé pour freiner ou propulser.
  const brake=keyboardBrake;
  if(Math.abs(throttle)>.01)lastLabAction=(throttle>0?'Avance':'Recul')+' active · '+Math.round(Math.abs(throttle)*100)+' %';
  else if(Math.abs(steer)>.01)lastLabAction='Direction active · '+Number(steer).toFixed(2);
  else if(brake)lastLabAction='Frein actif';
  const rot=body.rotation(),p=body.translation();
  const fwd=localDirection(0,0,-1),side=localDirection(1,0,0);
  const lv=body.linvel();
  // Per-wheel raycasts approximate adaptive support: only grounded wheels transmit motor force.
  let grounded=0,rayHits=0,appliedMotor=0,leftMotor=0,rightMotor=0,leftLateral=0,rightLateral=0,firstRay='—';
  for(const w of wheels){
   const origin=localToWorld(w.x,-.20,0),down=V(0,-1,0);
   const ray=new RAPIER.Ray(origin,down),hit=world.castRay(ray,.5,true,undefined,undefined,undefined,body);
   if(hit&&hit.collider&&hit.collider!==w.collider){
     rayHits++;grounded++;const toi=Number(hit.toi??hit.timeOfImpact??0);if(firstRay==='—')firstRay=(Number.isFinite(toi)?toi.toFixed(3):'n/a')+' m';
     const point=V(origin.x,origin.y-toi,origin.z);
    const wheelForward=localDirection(0,0,-1),wheelSide=localDirection(1,0,0);
    const pointVelocity=body.velocityAtPoint(point);
    const vForward=pointVelocity.x*wheelForward.x+pointVelocity.y*wheelForward.y+pointVelocity.z*wheelForward.z;
    const vSide=pointVelocity.x*wheelSide.x+pointVelocity.y*wheelSide.y+pointVelocity.z*wheelSide.z;
    const normalLoad=body.mass()*9.81/2;
    const traction=clamp(settings.grip*normalLoad*1.6,0,normalLoad*2.4);
    const differential=steer*settings.turn*1.6*(w.x<0?1:-1);
    const desired=(throttle*settings.power*7.5+differential-vForward*(brake?8:2.2));
    const motor=clamp(desired*body.mass()*.48,-traction,traction);appliedMotor+=motor;if(w.x<0)leftMotor=motor;else rightMotor=motor;
    const lateral=clamp(-vSide*body.mass()*5*settings.grip,-traction*.85,traction*.85);if(w.x<0)leftLateral=lateral;else rightLateral=lateral;
    body.addForceAtPoint(V(wheelForward.x*motor+wheelSide.x*lateral,wheelForward.y*motor+wheelSide.y*lateral,wheelForward.z*motor+wheelSide.z*lateral),point,true);
    w.spin+=vForward/fixedDt*.025;
   }else w.spin*=.995;
  }
   // Secours moteur direct si les raycasts de roues ne detectent aucun contact.
   if(Math.abs(throttle)>.01&&grounded===0){
    const fallback=throttle*settings.power*body.mass()*8;
    body.addForce(V(fwd.x*fallback,fwd.y*fallback,fwd.z*fallback),true);
    appliedMotor=fallback;
   }
   if(++inputDebugFrames%12===0){
    const msg=document.querySelector('#physics-message');
    if(msg){
     const mass=Number(body.mass())||0,pos=body.translation(),vel=body.linvel();
     const ang=body.angvel();msg.textContent='LABO DIAG v83 · Entrée '+Math.round(throttle*100)+' % · Direction '+Number(steer||0).toFixed(2)+' · Moteurs G/D '+leftMotor.toFixed(1)+'/'+rightMotor.toFixed(1)+' N · Latéraux G/D '+leftLateral.toFixed(1)+'/'+rightLateral.toFixed(1)+' N · Force totale '+Number(appliedMotor||0).toFixed(1)+' N · Rotation Y '+Number(ang.y||0).toFixed(2)+' rad/s · Contact '+grounded+'/2 · Rayons '+rayHits+'/2 ('+firstRay+') · Masse '+mass.toFixed(1)+' kg · Y '+Number(pos.y||0).toFixed(2)+' m · Vitesse '+Math.hypot(vel.x,vel.z).toFixed(2)+' m/s';
    }
   }
  // La direction est produite uniquement par le différentiel des roues, sans couple direct sur le châssis.
  if(brake){const velocity=body.linvel();body.setLinvel(V(velocity.x*.94,velocity.y,velocity.z*.94),true)}
  // Keep the demo in its test area; this is a soft arena boundary, not a robot movement clamp.
  if(Math.abs(p.x)>7.5||Math.abs(p.z)>7.5)body.applyImpulse(V(-Math.sign(p.x)*.08,0,-Math.sign(p.z)*.08),true);
 }
 function frame(now){
  if(!ready||failed)return;
  try{
   const rect=canvas.getBoundingClientRect();
   if(rect.width<2||rect.height<2){last=now;accumulator=0;requestAnimationFrame(frame);return}
   const dt=Math.min((now-last)/1000||0,0.05);last=now;accumulator=Math.min(accumulator+dt,.12);
   while(accumulator>=fixedDt){drive();world.step();accumulator-=fixedDt}
   const p=body.translation(),q=body.rotation();robotVisual.position.set(p.x,p.y,p.z);robotVisual.quaternion.set(q.x,q.y,q.z,q.w);
   wheels.forEach(w=>{w.mesh.rotation.x=w.spin});
   const target=new THREE.Vector3(p.x+5.7,p.y+4.2,p.z+6.8);camera.position.lerp(target,.055);camera.lookAt(p.x,p.y,p.z);
   renderer.render(scene,camera);requestAnimationFrame(frame);
  }catch(err){
   failed=true;status.textContent='ERREUR DE SIMULATION';
   const message='Erreur dans la boucle Rapier : '+(err?.message||String(err));
   document.querySelector('#physics-message').textContent=message;
   window.__showArenaDiagnostic?.(message,true);
   console.error('Physics lab frame failed:',err);
  }
 }
 function resize(){if(!renderer||!camera)return;const r=canvas.getBoundingClientRect();renderer.setSize(Math.max(1,r.width),Math.max(1,r.height),false);camera.aspect=Math.max(1,r.width)/Math.max(1,r.height);camera.updateProjectionMatrix()}
 const labKeys=['KeyW','KeyA','KeyS','KeyZ','KeyQ','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'];
 // Capture-phase listeners prevent other menu/game handlers from swallowing laboratory input.
 document.addEventListener('keydown',e=>{if(labKeys.includes(e.code)){keys.add(e.code);logLabInput('Clavier · '+e.code+' appuyée');e.preventDefault()}if(e.code==='KeyR'&&body){logLabInput('Clavier · R : remise à plat');body.setTranslation(V(0,.43,0),true);body.setRotation({x:0,y:0,z:0,w:1},true);body.setLinvel(V(0,0,0),true);body.setAngvel(V(0,0,0),true)}},{capture:true});
 document.addEventListener('keyup',e=>{if(keys.has(e.code))logLabInput('Clavier · '+e.code+' relâchée');keys.delete(e.code)},{capture:true});
 window.addEventListener('blur',()=>keys.clear());document.addEventListener('visibilitychange',()=>{if(document.hidden)keys.clear()});
 for(const [id,key] of [['physics-power','power'],['physics-turn','turn'],['physics-grip','grip']]){
  const input=document.getElementById(id),output=document.getElementById(id+'-value');
  input?.addEventListener('input',()=>{settings[key]=Number(input.value)/100;if(output)output.textContent=input.value+' %';logLabInput('Réglage '+key+' : '+input.value+' %')});
 }
 window.addEventListener('resize',resize);if(window.ResizeObserver)new ResizeObserver(resize).observe(canvas.parentElement);
 init().then(()=>resize());
 return {get ready(){return ready}};
})();

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
 const arenaWidth=mode==='hockey'?28.8:28,arenaDepth=mode==='hockey'?18:28,halfWidth=arenaWidth/2,halfDepth=arenaDepth/2;
 floorBox(arenaWidth,arenaDepth,mode==='hockey'?mat(0x666666):M.floor);
 if(mode==='combat'){
  for(const [x,z,w,d] of [[0,-halfDepth,arenaWidth,.35],[0,halfDepth,arenaWidth,.35],[-halfWidth,0,.35,arenaDepth],[halfWidth,0,.35,arenaDepth]])add(new THREE.BoxGeometry(w,1,d),M.black,world,x,.25,z);
  const grid=new THREE.GridHelper(arenaWidth-1,32,0x777777,0x444444);grid.position.y=-.03;world.add(grid);return;
 }
 // Patinoire rectangulaire : les cages sont placées à gauche et à droite.
 for(const z of [-halfDepth,halfDepth])add(new THREE.BoxGeometry(arenaWidth,.65,.3),M.black,world,0,.12,z);
 const goalWidth=4.88,extensionDepth=3,postThickness=.3;
 for(const x of [-halfWidth,halfWidth]){
  // Les bandes s'arrêtent exactement au bord de l'ouverture de 4.88 unités.
  const sideLength=halfDepth-goalWidth/2,sideCenter=goalWidth/2+sideLength/2;
  for(const z of [-sideCenter,sideCenter])add(new THREE.BoxGeometry(.3,.65,sideLength),M.black,world,x,.12,z);
  const extensionCenter=x+(x>0?extensionDepth/2:-extensionDepth/2);
  add(new THREE.BoxGeometry(extensionDepth,.45,goalWidth),M.floor,world,extensionCenter,-.28,0);
  // Poteaux latéraux et fond de cage, alignés avec les bandes de la patinoire.
  for(const z of [-(goalWidth/2+postThickness/2),goalWidth/2+postThickness/2])add(new THREE.BoxGeometry(extensionDepth,.65,postThickness),M.black,world,extensionCenter,.12,z);
  add(new THREE.BoxGeometry(postThickness,.65,goalWidth+postThickness),M.black,world,x+(x>0?extensionDepth:-extensionDepth),.12,0);
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
  for(const s of [-1,1]){const wheel=add(new THREE.CylinderGeometry(.34,.34,.22,18),M.rubber,root,s*1.02,-.12,-.58);wheel.rotation.z=Math.PI/2}
  add(new THREE.BoxGeometry(1.8,.08,.18),accent,root,0,-.05,-1.03);
 }else{
  // Châssis carré, deux roues latérales et deux longerons droits parallèles à l'avant.
  add(new THREE.BoxGeometry(2.05,.4,.9),body,root);
  add(new THREE.BoxGeometry(1.65,.12,.72),M.black,root,0,.23,.02);
  for(const side of [-1,1]){const wheel=add(new THREE.CylinderGeometry(.32,.32,.24,20),M.rubber,root,side*1.03,-.1,0);wheel.rotation.z=Math.PI/2}
  for(const side of [-1,1]){
   const rail=add(new THREE.BoxGeometry(.272,.272,1.528),accent,root,side*.72,.13,1.214);rail.userData.hockeyFork=true;
   
  }
 }
 if(mode==='combat')weapon.scale.setScalar(.5);
 return {root,weapon,hp:100,v:0,slideX:0,slideZ:0,alive:true,cooldown:0,contacts:0,contactCooldown:0,aiThink:0,aiOffsetX:0,aiOffsetZ:0,aiMode:'approach',aiThrottle:.8};
}
function resetPositions(){
 if(!player||!enemy)return;
 if(mode==='sumo'){player.root.position.set(-4.6,.12,0);player.root.rotation.y=Math.PI/2;enemy.root.position.set(4.6,.12,0);enemy.root.rotation.y=-Math.PI/2}
 else if(mode==='hockey'){player.root.position.set(-9,.12,0);player.root.rotation.y=Math.PI/2;enemy.root.position.set(9,.12,0);enemy.root.rotation.y=-Math.PI/2}
 else{player.root.position.set(-7.5,.12,0);player.root.rotation.y=Math.PI/2;enemy.root.position.set(7.5,.12,0);enemy.root.rotation.y=-Math.PI/2}
 for(const b of [player,enemy]){b.v=0;b.slideX=0;b.slideZ=0;b.hp=100;b.alive=true;b.cooldown=0;b.puckTouchCooldown=0;b.contacts=0;b.contactCooldown=0;b.prevX=b.root.position.x;b.prevZ=b.root.position.z}
 if(puck){puck.position.set(0,.12,0);puck.userData.vx=puck.userData.vz=0}
}
function buildMatch(){buildArena();player=makeRobot(net.role==='guest'?'red':'blue');enemy=makeRobot(net.role==='guest'?'blue':'red');if(mode==='hockey'){puck=add(new THREE.CylinderGeometry(.344,.344,.144,32),M.black,world,0,.12,0);puck.userData={vx:0,vz:0}}resetPositions()}
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
  const max=tunedSpeed*2,target=clamp(throttle,0,1)*max,accel=max*3.2,brake=max*12;
  if(target>bot.v)bot.v=Math.min(target,bot.v+accel*dt);else bot.v=Math.max(target,bot.v-brake*dt);bot.v=clamp(bot.v,0,max);
  const oldAngle=bot.root.rotation.y,pivotX=bot.root.position.x-Math.sin(oldAngle)*.58,pivotZ=bot.root.position.z-Math.cos(oldAngle)*.58;bot.root.rotation.y+=steer*tunedRotation*(.8+Math.min(Math.abs(bot.v)/max,.2))*dt;bot.root.position.x=pivotX+Math.sin(bot.root.rotation.y)*.58;bot.root.position.z=pivotZ+Math.cos(bot.root.rotation.y)*.58;
 }
 bot.root.position.x+=Math.sin(bot.root.rotation.y)*bot.v*dt+(bot.slideX||0)*dt;bot.root.position.z+=Math.cos(bot.root.rotation.y)*bot.v*dt+(bot.slideZ||0)*dt;const grip=Math.pow(mode==='sumo'?.72:.88,dt*60);bot.slideX=(bot.slideX||0)*grip;bot.slideZ=(bot.slideZ||0)*grip
 if(mode==='combat'&&(bot!==player||sawEnabled))bot.weapon.rotation.y+=dt*20;
 bot.cooldown=Math.max(0,bot.cooldown-dt);
}
function coastBot(bot,dt){
 const sx=bot.slideX||0,sz=bot.slideZ||0;
 bot.root.position.x+=sx*dt;bot.root.position.z+=sz*dt;
 const drag=Math.exp(-3.4*dt);bot.slideX=sx*drag;bot.slideZ=sz*drag;
 if(Math.hypot(bot.slideX,bot.slideZ)<.025)bot.slideX=bot.slideZ=0;
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
 if(mode!=='hockey'){
  const bounds=new THREE.Box3().setFromObject(bot.root);
  const minX=-13.72,maxX=13.72,minZ=-13.72,maxZ=13.72;
  if(bounds.min.x<minX)bot.root.position.x+=minX-bounds.min.x;
  if(bounds.max.x>maxX)bot.root.position.x-=bounds.max.x-maxX;
  if(bounds.min.z<minZ)bot.root.position.z+=minZ-bounds.min.z;
  if(bounds.max.z>maxZ)bot.root.position.z-=bounds.max.z-maxZ;
  return;
 }
 // Projection du contour orienté sur les parois : seule la composante normale
 // est corrigée, la composante tangentielle reste libre pour glisser le long du mur.
 const halfW=1.15,halfL=1.214,centerForward=.764;
 const angle=bot.root.rotation.y,s=Math.sin(angle),c=Math.cos(angle);
 const extentX=halfW*Math.abs(c)+halfL*Math.abs(s);
 const extentZ=halfW*Math.abs(s)+halfL*Math.abs(c);
 const walls=[
  {axis:'z',face:8.85,sign:1,min:-14.4,max:14.4},
  {axis:'z',face:-8.85,sign:-1,min:-14.4,max:14.4},
  {axis:'x',face:14.25,sign:1,min:2.44,max:9},
  {axis:'x',face:14.25,sign:1,min:-9,max:-2.44},
  {axis:'x',face:-14.25,sign:-1,min:2.44,max:9},
  {axis:'x',face:-14.25,sign:-1,min:-9,max:-2.44},
  {axis:'z',face:2.44,sign:1,min:14.4,max:17.4},
  {axis:'z',face:-2.44,sign:-1,min:14.4,max:17.4},
  {axis:'z',face:2.44,sign:1,min:-17.4,max:-14.4},
  {axis:'z',face:-2.44,sign:-1,min:-17.4,max:-14.4},
  {axis:'x',face:17.25,sign:1,min:-2.44,max:2.44},
  {axis:'x',face:-17.25,sign:-1,min:-2.44,max:2.44}
 ];
 for(let pass=0;pass<2;pass++){
  for(const wall of walls){
   const alongX=wall.axis==='z';
   const tangentCenter=alongX?bot.root.position.x+s*centerForward:bot.root.position.z+c*centerForward;
   const tangentExtent=alongX?extentX:extentZ;
   if(tangentCenter+tangentExtent<wall.min||tangentCenter-tangentExtent>wall.max)continue;
   const normalCenter=alongX?bot.root.position.z+c*centerForward:bot.root.position.x+s*centerForward;
   const normalExtent=alongX?extentZ:extentX;
   const penetration=wall.sign*(normalCenter-wall.face)+normalExtent;
   if(penetration>0){
    // Correction progressive aux angles des ouvertures de cage pour éviter
    // qu'un chevauchement de deux segments n'expulse brutalement le robot.
    const correction=Math.min(penetration+.001,.32);
    if(alongX){
     bot.root.position.z-=wall.sign*correction;
     const vn=(bot.slideZ||0)*wall.sign;
     if(vn>0)bot.slideZ-=vn;
    }else{
     bot.root.position.x-=wall.sign*correction;
     const vn=(bot.slideX||0)*wall.sign;
     if(vn>0)bot.slideX-=vn;
    }
   }
  }
 }
}
function collideBots(a,b,dt){
 const ah=robotHitboxes(a),bh=robotHitboxes(b);let weaponA=false,weaponB=false;
 for(const x of ah)for(const y of bh)if(x.box.intersectsBox(y.box)){if(x.mesh.parent===a.weapon)weaponA=true;if(y.mesh.parent===b.weapon)weaponB=true}
 a.contactCooldown=Math.max(0,(a.contactCooldown||0)-dt);b.contactCooldown=Math.max(0,(b.contactCooldown||0)-dt);
 const dx=b.root.position.x-a.root.position.x,dz=b.root.position.z-a.root.position.z,d=Math.hypot(dx,dz);
 const sx=(b.root.position.x-(b.prevX??b.root.position.x))-(a.root.position.x-(a.prevX??a.root.position.x));
 const sz=(b.root.position.z-(b.prevZ??b.root.position.z))-(a.root.position.z-(a.prevZ??a.root.position.z));
 const rx=(b.prevX??b.root.position.x)-(a.prevX??a.root.position.x),rz=(b.prevZ??b.root.position.z)-(a.prevZ??a.root.position.z);
 const travel2=sx*sx+sz*sz,t=travel2>.0001?clamp(-(rx*sx+rz*sz)/travel2,0,1):0;
 const closest=Math.hypot(rx+sx*t,rz+sz*t),minDistance=mode==='hockey'?2.65:mode==='combat'?2.35:2.1;
 let touching=false,nx=0,nz=0,overlap=0;
 if(mode==='hockey'){
  // OBB fidèle au contour extérieur du modèle : roues + châssis + fourches.
  const halfW=1.15,halfL=1.214,centerForward=.764;
  const makeRect=bot=>{const r=bot.root.rotation.y,c=Math.cos(r),s=Math.sin(r);return{cx:bot.root.position.x+s*centerForward,cz:bot.root.position.z+c*centerForward,ux:c,uz:-s,vx:s,vz:c}};
  const A=makeRect(a),B=makeRect(b),ddx=B.cx-A.cx,ddz=B.cz-A.cz;
  let best=Infinity,bestX=1,bestZ=0;
  const axes=[[A.ux,A.uz],[A.vx,A.vz],[B.ux,B.uz],[B.vx,B.vz]];
  for(const [ax,az] of axes){
   const ra=halfW*Math.abs(ax*A.ux+az*A.uz)+halfL*Math.abs(ax*A.vx+az*A.vz);
   const rb=halfW*Math.abs(ax*B.ux+az*B.uz)+halfL*Math.abs(ax*B.vx+az*B.vz);
   const signed=ddx*ax+ddz*az,ov=ra+rb-Math.abs(signed);
   if(ov<=0){best=-1;break}
   if(ov<best){best=ov;bestX=ax*(signed<0?-1:1);bestZ=az*(signed<0?-1:1)}
  }
  if(best>0){touching=true;nx=bestX;nz=bestZ;overlap=best}
 }else touching=d<minDistance||closest<minDistance;
 if(touching){
  if(mode!=='hockey'){
   nx=d>.001?dx/d:Math.hypot(rx+sx*t,rz+sz*t)>.001?(rx+sx*t)/closest:1;
   nz=d>.001?dz/d:Math.hypot(rx+sx*t,rz+sz*t)>.001?(rz+sz*t)/closest:0;
  }
  const avx=Math.sin(a.root.rotation.y)*a.v,avz=Math.cos(a.root.rotation.y)*a.v,bvx=Math.sin(b.root.rotation.y)*b.v,bvz=Math.cos(b.root.rotation.y)*b.v;
  const relativeSpeed=(bvx-avx)*nx+(bvz-avz)*nz;
  if(testMode&&relativeSpeed<-.05){
   const impulse=clamp(-relativeSpeed*.62,0,5);
   if(a===player&&b===enemy){b.slideX=(b.slideX||0)+nx*impulse;b.slideZ=(b.slideZ||0)+nz*impulse}
   else if(b===player&&a===enemy){a.slideX=(a.slideX||0)-nx*impulse;a.slideZ=(a.slideZ||0)-nz*impulse}
  }
  if(mode==='hockey'){
   const separation=overlap*.5+.012;
   a.root.position.x-=nx*separation;b.root.position.x+=nx*separation;a.root.position.z-=nz*separation;b.root.position.z+=nz*separation;
   if(relativeSpeed<-.6){
    const impactSpeed=-relativeSpeed,push=clamp((impactSpeed-.6)*.045,0,.42);
    a.root.position.x-=nx*push*.5;b.root.position.x+=nx*push*.5;
    a.root.position.z-=nz*push*.5;b.root.position.z+=nz*push*.5;
    const loss=clamp(impactSpeed*.012,0,.16);a.v=Math.max(0,a.v*(1-loss));b.v=Math.max(0,b.v*(1-loss));
   }
  }else if(d<minDistance){const penetration=minDistance-d+.025;a.root.position.x-=nx*penetration*.5;b.root.position.x+=nx*penetration*.5;a.root.position.z-=nz*penetration*.5;b.root.position.z+=nz*penetration*.5}
  else if(closest<minDistance){const midX=(a.root.position.x+b.root.position.x)*.5,midZ=(a.root.position.z+b.root.position.z)*.5;a.root.position.x=midX-nx*(minDistance*.51);b.root.position.x=midX+nx*(minDistance*.51);a.root.position.z=midZ-nz*(minDistance*.51);b.root.position.z=midZ+nz*(minDistance*.51)}
  if(relativeSpeed<0){const impact=Math.min(1,Math.abs(relativeSpeed)/8);if(mode!=='sumo'){a.v=Math.max(0,a.v*(1-.72*impact));b.v=Math.max(0,b.v*(1-.72*impact))}}
  if((a.contactCooldown<=0||b.contactCooldown<=0)&&Math.abs(relativeSpeed)>1.2){if(relativeSpeed< -1.2)a.contacts=(a.contacts||0)+1;else if(relativeSpeed>1.2)b.contacts=(b.contacts||0)+1;a.contactCooldown=b.contactCooldown=.45}
  if(mode==='combat'){if(weaponA&&a.cooldown<=0&&(a!==player||sawEnabled||(net.role==='host'&&net.remote.action))){b.hp=Math.max(0,b.hp-rand(8,14));a.cooldown=.35}if(weaponB&&b.cooldown<=0&&(b!==player||sawEnabled||(net.role==='host'&&net.remote.action))){a.hp=Math.max(0,a.hp-rand(8,14));b.cooldown=.35}}
  if(mode==='sumo'){const pushA=Math.max(0,avx*nx+avz*nz),pushB=Math.max(0,-(bvx*nx+bvz*nz));const transfer=(target,normalX,normalZ,amount)=>{const impulse=clamp(amount*.48,0,4),sideX=-Math.cos(target.root.rotation.y),sideZ=Math.sin(target.root.rotation.y),sideSign=Math.sign(normalX*sideX+normalZ*sideZ)||1,side=impulse*.22;target.slideX=(target.slideX||0)+normalX*impulse+sideX*side*sideSign;target.slideZ=(target.slideZ||0)+normalZ*impulse+sideZ*side*sideSign;target.v=Math.max(0,target.v-impulse*.24)};if(pushA>pushB+.10)transfer(b,nx,nz,pushA-pushB);else if(pushB>pushA+.10)transfer(a,-nx,-nz,pushB-pushA)}
 }
 a.prevX=a.root.position.x;a.prevZ=a.root.position.z;b.prevX=b.root.position.x;b.prevZ=b.root.position.z;
}
function collidePuckWithRobot(b){
 const radius=.344,u=puck.userData;
 const halfThickness=.072,puckBottom=puck.position.y-halfThickness,puckTop=puck.position.y+halfThickness;
 // Ne pas toucher le palet avec les parties hautes du robot.
 if(puckTop<-.02||puckBottom>.62)return;
 const c=Math.cos(b.root.rotation.y),s=Math.sin(b.root.rotation.y);
 const botVx=Math.sin(b.root.rotation.y)*b.v+(b.slideX||0);
 const botVz=Math.cos(b.root.rotation.y)*b.v+(b.slideZ||0);
 // Volumes 2D orientés du châssis et des deux fourches, dans le repère du robot.
 const shapes=[
  {x:0,z:0,hx:1.025,hz:.45},
  {x:-.72,z:1.214,hx:.136,hz:.764},
  {x:.72,z:1.214,hx:.136,hz:.764}
 ];
 let best=null;
 for(const shape of shapes){
  const dx=puck.position.x-b.root.position.x, dz=puck.position.z-b.root.position.z;
  const lx=dx*c-dz*s-shape.x, lz=dx*s+dz*c-shape.z;
  const qx=clamp(lx,-shape.hx,shape.hx),qz=clamp(lz,-shape.hz,shape.hz);
  const ox=lx-qx,oz=lz-qz,d2=ox*ox+oz*oz;
  if(d2>=radius*radius)continue;
  let nx,nz,depth;
  if(d2>.000001){
   const d=Math.sqrt(d2);nx=ox/d;nz=oz/d;depth=radius-d;
  }else{
   const px=shape.hx-Math.abs(lx),pz=shape.hz-Math.abs(lz);
   if(px<pz){nx=lx<0?-1:1;nz=0;depth=radius+px}
   else{nx=0;nz=lz<0?-1:1;depth=radius+pz}
  }
  if(!best||depth>best.depth)best={nx:nx*c+nz*s,nz:-nx*s+nz*c,depth};
 }
 // Roues : petits contacts circulaires, utiles lorsque le palet arrive de côté.
 for(const wx of [-1.03,1.03]){
  const dx=puck.position.x-(b.root.position.x+wx*c),dz=puck.position.z-(b.root.position.z-wx*s);
  const d=Math.hypot(dx,dz),combined=radius+.30;
  if(d>=combined)continue;
  const nx=d>.0001?dx/d:Math.sign(dx)||1,nz=d>.0001?dz/d:0,depth=combined-d;
  if(!best||depth>best.depth)best={nx,nz,depth};
 }
 if(!best)return;
 // Une seule résolution par frame : évite les expulsions successives entre plusieurs hitboxes.
 const correction=Math.min(best.depth+.002,.28);
 puck.position.x+=best.nx*correction;puck.position.z+=best.nz*correction;
 const relativeNormal=(u.vx-botVx)*best.nx+(u.vz-botVz)*best.nz;
 const beforeVx=u.vx,beforeVz=u.vz;
 if(relativeNormal<0){
  const restitution=.16;
  const impulse=-(1+restitution)*relativeNormal;
  u.vx+=impulse*best.nx;u.vz+=impulse*best.nz;
  // Un peu de friction tangentielle transmet le mouvement latéral du robot au palet.
  const tx=-best.nz,tz=best.nx;
  const tangent=(u.vx-botVx)*tx+(u.vz-botVz)*tz;
  u.vx-=tangent*.10*tx;u.vz-=tangent*.10*tz;
 }
 if(testMode&&b===enemy){
  b.slideX=(b.slideX||0)+(beforeVx-u.vx)*.28;
  b.slideZ=(b.slideZ||0)+(beforeVz-u.vz)*.28;
 }
 b.puckTouchCooldown=.08;
}
function updatePuck(dt){
 const radius=.344,u=puck.userData;
 const horizontalTravel=Math.hypot(u.vx,u.vz)*dt;
 const verticalTravel=Math.abs(Number(u.vy)||0)*dt+9*dt*dt;
 const steps=Math.max(1,Math.ceil(Math.max(horizontalTravel,verticalTravel)/.025));
 const step=dt/steps,goalHalfWidth=2.44,goalLine=16;
 const boardBounce=.05+puckBounce*.009;
 // Collision unilatérale contre la face intérieure de chaque bande.
 // Le palet reste toujours du côté terrain, même poussé fortement par un robot.
 const hitWall=(axis,face,sign,tangentMin,tangentMax)=>{
  const tangent=axis==='x'?puck.position.z:puck.position.x;
  if(tangent<tangentMin-radius||tangent>tangentMax+radius)return;
  const value=axis==='x'?puck.position.x:puck.position.z;
  const penetration=sign*(value-face)+radius;
  if(penetration<=0)return;
  if(axis==='x')puck.position.x-=sign*(penetration+.001);
  else puck.position.z-=sign*(penetration+.001);
  const vn=(axis==='x'?u.vx:u.vz)*sign;
  if(vn>0){if(axis==='x')u.vx-=(1+boardBounce)*vn*sign;else u.vz-=(1+boardBounce)*vn*sign}
 };
 for(let i=0;i<steps;i++){
  puck.position.x+=u.vx*step;puck.position.z+=u.vz*step;
  u.vy=Number(u.vy)||0;
  if(u.vy!==0||puck.position.y>.12){
   u.vy-=18*step;puck.position.y+=u.vy*step;
   if(puck.position.y<=.12){puck.position.y=.12;if(u.vy<-.8)u.vy=-u.vy*.24;else u.vy=0}
  }
  for(const b of [player,enemy])collidePuckWithRobot(b);
  const inGoalMouth=Math.abs(puck.position.z)<=goalHalfWidth-radius;
  if(inGoalMouth&&puck.position.x>goalLine){scoreGoal('blue');return}
  if(inGoalMouth&&puck.position.x< -goalLine){scoreGoal('red');return}
  // Bandes latérales du terrain : ouverture centrale conservée pour les cages.
  hitWall('x',14.25,1,2.44,9);
  hitWall('x',14.25,1,-9,-2.44);
  hitWall('x',-14.25,-1,2.44,9);
  hitWall('x',-14.25,-1,-9,-2.44);
  // Bandes de fond du terrain.
  hitWall('z',8.85,1,-14.4,14.4);
  hitWall('z',-8.85,-1,-14.4,14.4);
  // Parois latérales des cages.
  hitWall('z',2.44,1,14.4,17.4);
  hitWall('z',-2.44,-1,14.4,17.4);
  hitWall('z',2.44,1,-17.4,-14.4);
  hitWall('z',-2.44,-1,-17.4,-14.4);
  // Fonds des deux cages.
  hitWall('x',17.25,1,-2.44,2.44);
  hitWall('x',-17.25,-1,-2.44,2.44);
  const speed=Math.hypot(u.vx,u.vz);
  if(puckGlide<=0){u.vx=0;u.vz=0}
  else if(speed>0){
   const deceleration=8*(.12+speed*.008)*(1-puckGlide/100);
   const nextSpeed=Math.max(0,speed-deceleration*step),factor=nextSpeed/speed;
   u.vx*=factor;u.vz*=factor;
  }
 }
 const speed=Math.hypot(u.vx,u.vz);
 if(speed>19){u.vx*=19/speed;u.vz*=19/speed}
}
function showPointBanner(text){const banner=$('#round-banner');banner.textContent=text;banner.classList.remove('hidden','point-pop');void banner.offsetWidth;banner.classList.add('point-pop')}
 function scoreGoal(team){if(goalLock>0||hockeyFaceoff)return;goalLock=1.2;if(team==='blue')scoreBlue++;else scoreRed++;const label=team==='blue'?'BLEU':'ROUGE';$('#status').textContent='BUT '+label;showPointBanner('BUT '+label);if(mode==='hockey')startHockeyFaceoff();else resetPositions()}
function startHockeyFaceoff(){if(!puck)return;const start={x:puck.position.x,y:puck.position.y,z:puck.position.z};resetPositions();puck.position.set(start.x,.12,start.z);puck.rotation.set(0,0,0);puck.userData.vx=puck.userData.vz=0;puck.userData.vy=0;puck.userData.spinX=0;puck.userData.spinZ=0;hockeyFaceoff={phase:'return',elapsed:0,wait:1+Math.random()*4,start};ended=false;countdown=0;$('#countdown').classList.add('hidden');$('#status').textContent='REMISE EN JEU…'}
function advanceHockeyFaceoff(dt){if(!hockeyFaceoff||!puck||hockeyFaceoff.phase==='remote')return;const f=hockeyFaceoff;f.elapsed+=dt;if(f.phase==='return'){const t=clamp(f.elapsed/.8,0,1),e=t*t*(3-2*t);puck.position.set(f.start.x*(1-e),.12+(7.2-.12)*e,f.start.z*(1-e));if(t>=1){f.phase='wait';f.elapsed=0;ended=false;puck.rotation.set(.12,0,-.09)}}else if(f.phase==='wait'){puck.position.set(0,7.2,0);puck.rotation.x+=.42*dt;puck.rotation.z-=.28*dt;if(f.elapsed>=f.wait){f.phase='drop';f.elapsed=0;puck.userData.vy=0;puck.userData.spinX=.42;puck.userData.spinZ=-.28}}else if(f.phase==='drop'){const u=puck.userData;u.vy=(u.vy||0)-18*dt;puck.position.y+=u.vy*dt;for(const b of [player,enemy])collidePuckWithRobot(b);puck.rotation.x+=(u.spinX||0)*dt;puck.rotation.z+=(u.spinZ||0)*dt;u.spinX=(u.spinX||0)-puck.rotation.x*5*dt;u.spinZ=(u.spinZ||0)-puck.rotation.z*5*dt;const damping=Math.exp(-1.8*dt);u.spinX*=damping;u.spinZ*=damping;if(puck.position.y<=.12){puck.position.y=.12;if(u.vy<-.65){u.vy=-u.vy*.32;u.spinX+=(Math.random()-.5)*.22;u.spinZ+=(Math.random()-.5)*.22}else{u.vy=0}}if(Math.abs(u.vy)<.45&&Math.abs(puck.rotation.x)<.035&&Math.abs(puck.rotation.z)<.035&&Math.abs(u.spinX)<.08&&Math.abs(u.spinZ)<.08){puck.position.y=.12;puck.rotation.set(0,0,0);hockeyFaceoff=null;ended=false;$('#status').textContent='REPRISE !'}}}
function updateSumo(){for(const [b,t] of [[player,'blue'],[enemy,'red']])if(Math.hypot(b.root.position.x,b.root.position.z)>8.4){if(t==='blue')roundRed++;else roundBlue++;const winner=t==='blue'?'ROUGE':'BLEU';resetPositions();updateHud();showPointBanner('MANCHE '+winner);if(roundBlue>=2||roundRed>=2){finish(roundBlue>roundRed?'BLEU':'ROUGE','Deux manches gagnantes.');return}countdown=3;ended=true;$('#countdown').classList.remove('hidden');$('#countdown-number').textContent='3';$('#countdown .countdown-label').textContent='MANCHE '+(roundBlue+roundRed+1);$('#countdown .countdown-sub').textContent='PROCHAINE MANCHE DANS';$('#status').textContent='REPRISE DANS 3…';return}}
function updateHud(){
 const blueBot=net.role==='guest'?enemy:player,redBot=net.role==='guest'?player:enemy;const a=mode==='combat'?blueBot.contacts:mode==='sumo'?roundBlue:scoreBlue,b=mode==='combat'?redBot.contacts:mode==='sumo'?roundRed:scoreRed;
 $('#score-blue').textContent=Math.ceil(a);$('#score-red').textContent=Math.ceil(b);
 const top=Math.max(1,a,b);$('#bar-blue').style.width=(mode==='combat'||mode==='hockey'?a/top*100:a/3*100)+'%';$('#bar-red').style.width=(mode==='combat'||mode==='hockey'?b/top*100:b/3*100)+'%';
 $('#label-blue').textContent=$('#label-red').textContent=mode==='combat'?'CONTACTS':mode==='sumo'?'MANCHES':'BUTS';
 $('#contact-count').textContent='CONTACTS · BLEU '+(blueBot.contacts||0)+' / ROUGE '+(redBot.contacts||0);
}
function finish(winner,detail){if(ended)return;ended=true;if(net.role==='host')wsSend('end',{winner,detail});$('#end-title').textContent=winner==='NUL'?'ÉGALITÉ':winner==='BLEU'?'VICTOIRE':'DÉFAITE';$('#end-detail').textContent=detail;$('#end').classList.remove('hidden')}
function attackPuck(bot){if(!puck||bot.cooldown>0)return;const d=Math.hypot(puck.position.x-bot.root.position.x,puck.position.z-bot.root.position.z),dy=puck.position.y-.12;if(Math.hypot(d,dy)<3&&Math.abs(dy)<.9){puck.userData.vx+=Math.sin(bot.root.rotation.y)*16;puck.userData.vz+=Math.cos(bot.root.rotation.y)*16;bot.cooldown=.3}}
function setMode(m){
 mode=m;
 tunedSpeed=m==='hockey'?9.8:12;tunedRotation=14;
 const speedControl=$('#tune-speed'),rotationControl=$('#tune-rotation');
 if(speedControl&&rotationControl){const speedHalfRange=2;speedControl.min=(tunedSpeed-speedHalfRange).toFixed(1);speedControl.max=(tunedSpeed+speedHalfRange).toFixed(1);speedControl.value=tunedSpeed;rotationControl.min='9';rotationControl.max='19';rotationControl.value=tunedRotation;if($('#tune-speed-value'))$('#tune-speed-value').textContent=tunedSpeed.toFixed(1)+' m/s';if($('#tune-rotation-value'))$('#tune-rotation-value').textContent=tunedRotation.toFixed(1)+' rad/s'}
  if($('#puck-glide')){$('#puck-glide').value=String(puckGlide*100);$('#puck-glide-value').textContent=(puckGlide*100).toFixed(0)+' %'}if($('#puck-bounce')){$('#puck-bounce').value=String(puckBounce);$('#puck-bounce-value').textContent=puckBounce+' %'}
 document.querySelectorAll('.mode-card').forEach(c=>c.classList.toggle('selected',c.dataset.mode===m));
 const data={
 combat:{title:'RÈGLES · COMBAT',items:['Duel dans une arène fermée.','Chaque contact réussi avec l’adversaire rapporte un point.','Le match dure jusqu’à la fin du chronomètre.','Le robot ayant provoqué le plus de contacts gagne.'],help:'Combat : percute ton adversaire pour marquer des contacts. E active la scie.',labels:['CONTACTS','CONTACTS']},
 sumo:{title:'RÈGLES · SUMO',items:['Deux robots se font face sur un dohyo circulaire.','Pousse l’adversaire hors du cercle.','Sortir du dohyo fait perdre la manche.','Le premier à gagner deux manches remporte le match.'],help:'Sumo : pousse l’adversaire hors du dohyo.',labels:['MANCHES','MANCHES']},
 hockey:{title:'RÈGLES · HOCKEY',items:['Deux robots s’affrontent sur une patinoire avec un palet.','Les cages sont placées à gauche et à droite du terrain.','Un but est marqué lorsque le palet franchit la ligne dans la cage.','Le plus grand nombre de buts après 5 minutes gagne.'],help:'Hockey : E pour frapper le palet.',labels:['BUTS','BUTS']}
 }[m];
 $('#rules-title').textContent=data.title;$('#rules-list').innerHTML=data.items.map(x=>'<li>'+x+'</li>').join('');$('#mode-help').textContent=data.help;$('#label-blue').textContent=data.labels[0];$('#label-red').textContent=data.labels[1];$('#action-button').textContent=m==='hockey'?'TIR':'SCIE';$('#weight-setting').style.display=m==='combat'?'grid':'none';$('#puck-glide-setting').style.display=m==='hockey'?'grid':'none';$('#puck-bounce-setting').style.display=m==='hockey'?'grid':'none';$('#duration').value=m==='hockey'?'300':$('#duration').value;$('#duration').disabled=m==='hockey';$('#custom-duration-setting').style.display=m==='hockey'?'none':($('#duration').value==='custom'?'grid':'none');$('.settings-grid').style.gridTemplateColumns='repeat(2,minmax(0,1fr))';
}

function netStatus(message){const el=$('#network-status');if(el)el.textContent=message}
function normalizeServerUrl(value){let s=String(value||'').trim().replace(/\/$/,'');if(!s)return '';if(s.startsWith('https://'))return s;if(s.startsWith('http://'))return s;return 'https://'+s}
function wsSend(type,data={}){if(net.ws&&net.ws.readyState===WebSocket.OPEN)net.ws.send(JSON.stringify({type,...data}))}
function connectNetwork(serverUrl){
 return new Promise((resolve,reject)=>{
  const base=normalizeServerUrl(serverUrl);if(!base)return reject(new Error('Saisis l’adresse HTTPS Cloudflare.'));
  let endpoint;try{const u=new URL(base);endpoint=(u.protocol==='https:'?'wss:':'ws:')+'//'+u.host+'/ws'}catch{return reject(new Error('Adresse du serveur invalide.'))}
  if(net.ws&&net.ws.readyState===WebSocket.OPEN&&net.serverUrl===base)return resolve();
  if(net.ws){try{net.ws.close()}catch{}}
  net.serverUrl=base;netStatus('Connexion au serveur…');
  const ws=new WebSocket(endpoint);net.ws=ws;
  const timeout=setTimeout(()=>{if(ws.readyState!==WebSocket.OPEN){ws.close();reject(new Error('Serveur inaccessible. Vérifie le tunnel Cloudflare.'))}},10000);
  ws.onopen=()=>{clearTimeout(timeout);net.lastPing=0;resolve()};
  ws.onerror=()=>{clearTimeout(timeout);reject(new Error('Connexion impossible. Vérifie l’adresse du tunnel et le serveur.'))};
  ws.onclose=()=>{if(net.ws===ws){netStatus('Déconnecté du serveur');if(net.role)$('#online-state').textContent='Connexion interrompue';net.role=null;net.guestStates.length=0;net.ping=null;const p=$('#network-ping');if(p)p.textContent='PING —'}};
  ws.onmessage=event=>{let msg;try{msg=JSON.parse(event.data)}catch{return}
   if(msg.type==='net_pong'){net.ping=Math.max(0,performance.now()-Number(msg.sentAt||performance.now()));const p=$('#network-ping');if(p)p.textContent='PING '+Math.round(net.ping)+' ms';
   }else if(msg.type==='created'){
    net.role='host';net.roomId=msg.roomId;$('#room-code').textContent=msg.roomId;$('#room-password').textContent=msg.password;
    const invite=new URL(location.href);invite.searchParams.set('room',msg.roomId);invite.searchParams.set('server',net.serverUrl);
    $('#room-link').value=invite.toString();$('#invite-area').classList.remove('hidden');$('#online-state').textContent='Lobby créé · en attente du deuxième joueur';netStatus('Serveur connecté · lobby privé créé');
   }else if(msg.type==='joined'){
    net.role='guest';net.roomId=msg.roomId;net.guestStates.length=0;$('#online-state').textContent='Connecté au lobby · en attente de l’hôte';netStatus('Connecté au lobby '+msg.roomId);
   }else if(msg.type==='opponent_joined'){
    net.opponent=true;$('#online-state').textContent='2 joueurs connectés · prêt à jouer';netStatus('Ton ami a rejoint le lobby');
   }else if(msg.type==='opponent_left'){
    net.opponent=false;$('#online-state').textContent='Ton ami s’est déconnecté';netStatus('Deuxième joueur déconnecté');
   }else if(msg.type==='remote_input'){
    net.remote={throttle:msg.throttle||0,steering:msg.steering||0,action:!!msg.action};
   }else if(msg.type==='start'){
    if(net.role==='guest'){net.hz=Number(msg.networkHz)===30?30:60;$('#network-rate').value=String(net.hz);net.guestStates.length=0;setMode(msg.mode);$('#difficulty').value=msg.difficulty||'normal';puckGlide=clamp(Number(msg.puckGlide??.1),0,1);puckBounce=clamp(Number(msg.puckBounce??10),0,100);$('#puck-glide').value=String(puckGlide*100);$('#puck-glide-value').textContent=(puckGlide*100).toFixed(0)+' %';$('#puck-bounce').value=String(puckBounce);$('#puck-bounce-value').textContent=puckBounce+' %';const receivedDuration=msg.mode==='hockey'?300:clamp(Number(msg.duration)||120,30,7200);$('#duration').value=[60,120,180,300,600].includes(receivedDuration)?String(receivedDuration):'custom';$('#custom-duration').value=String(Math.round(receivedDuration/60));$('#custom-duration-setting').style.display=$('#duration').value==='custom'?'grid':'none';startMatch(msg.startAt,receivedDuration)}
   }else if(msg.type==='state'&&net.role==='guest'){
    if(msg.state){net.guestStates.push({time:performance.now(),state:msg.state});if(net.guestStates.length>16)net.guestStates.shift()}
   }else if(msg.type==='end'&&net.role==='guest'){
    finish(msg.winner||'NUL',msg.detail||'Fin du match');
   }else if(msg.type==='left'){
    net.role=null;net.roomId=null;$('#online-state').textContent='Hors du lobby';
   }else if(msg.type==='error'){netStatus(msg.message||'Erreur serveur')}
  };
 });
}
function applyBufferedNetworkState(){
 if(net.role!=='guest'||!net.guestStates.length)return;
 const buffer=net.guestStates,targetTime=performance.now()-80;
 while(buffer.length>2&&buffer[1].time<targetTime)buffer.shift();
 const a=buffer[0],b=buffer[Math.min(1,buffer.length-1)],span=b.time-a.time;
 const alpha=span>0?clamp((targetTime-a.time)/span,0,1):1;
 const mix=(x,y)=>Number.isFinite(x)&&Number.isFinite(y)?x+(y-x)*alpha:(Number.isFinite(y)?y:x);
 const angleMix=(x,y)=>{const d=((y-x+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;return x+d*alpha};
 const state={...b.state};
 for(const key of ['blue','red']){
  const av=a.state?.[key],bv=b.state?.[key];if(!av||!bv)continue;
  state[key]={...bv};
  for(const k of ['x','y','z','v'])state[key][k]=mix(av[k],bv[k]);
  state[key].r=angleMix(Number(av.r)||0,Number(bv.r)||0);
 }
 if(a.state?.puck&&b.state?.puck){
  state.puck={...b.state.puck};
  for(const k of ['x','y','z','vx','vz','rx','rz'])state.puck[k]=mix(a.state.puck[k],b.state.puck[k]);
 }
 applyNetworkState(state);
}
function applyNetworkState(s){
 if(!s||!player||!enemy)return;
 const apply=(bot,v)=>{if(!v)return;bot.root.position.set(Number(v.x)||0,Number(v.y)||.12,Number(v.z)||0);bot.root.rotation.y=Number(v.r)||0;bot.v=Number(v.v)||0;bot.hp=Number(v.hp)||0;bot.contacts=Number(v.contacts)||0};
 if(net.role==='guest'){apply(player,s.red);apply(enemy,s.blue)}else{apply(player,s.blue);apply(enemy,s.red)}
 if(puck&&s.puck){puck.position.set(Number(s.puck.x)||0,Number.isFinite(s.puck.y)?s.puck.y:.12,Number(s.puck.z)||0);puck.userData.vx=Number(s.puck.vx)||0;puck.userData.vz=Number(s.puck.vz)||0;if(Number.isFinite(s.puck.rx))puck.rotation.x=s.puck.rx;if(Number.isFinite(s.puck.rz))puck.rotation.z=s.puck.rz}
 if(mode==='hockey'&&(s.hockeyFaceoff===null||typeof s.hockeyFaceoff==='object')){const phase=s.hockeyFaceoff?.phase||null;hockeyFaceoff=phase?{phase:'remote',remotePhase:phase}:null;ended=false;if(ended){countdown=0;$('#countdown').classList.add('hidden')}}
 if(Number.isFinite(s.remaining)){remaining=s.remaining;$('#timer').textContent=fmt(remaining)}
 const oldBlue=scoreBlue,oldRed=scoreRed,oldRoundBlue=roundBlue,oldRoundRed=roundRed;if(Number.isFinite(s.scoreBlue))scoreBlue=s.scoreBlue;if(Number.isFinite(s.scoreRed))scoreRed=s.scoreRed;
 if(Number.isFinite(s.roundBlue))roundBlue=s.roundBlue;if(Number.isFinite(s.roundRed))roundRed=s.roundRed;
 if(mode==='hockey'&&scoreBlue+scoreRed>oldBlue+oldRed){showPointBanner(scoreBlue>oldBlue?'BUT BLEU':'BUT ROUGE');$('#status').textContent=scoreBlue>oldBlue?'BUT BLEU':'BUT ROUGE'}
 if(mode==='sumo'&&roundBlue+roundRed>oldRoundBlue+oldRoundRed){const winner=roundBlue>oldRoundBlue?'BLEU':'ROUGE';showPointBanner('MANCHE '+winner);if(roundBlue<2&&roundRed<2){countdown=3;ended=true;$('#countdown').classList.remove('hidden');$('#countdown-number').textContent='3';$('#countdown .countdown-label').textContent='PROCHAINE MANCHE';$('#countdown .countdown-sub').textContent='DÉCOMPTE AVANT REPRISE'}}
 updateHud();
}
async function createOnlineLobby(){
 try{const server=normalizeServerUrl($('#server-url').value);if(!server)throw new Error('Saisis d’abord l’adresse HTTPS trycloudflare.com.');localStorage.setItem('robotArenaServerUrl',server);await connectNetwork(server);wsSend('create')}
 catch(e){netStatus(e.message||String(e))}
}
async function joinOnlineLobby(){
 try{const params=new URLSearchParams(location.search),room=($('#join-room').value||params.get('room')||'').trim().toUpperCase(),password=$('#join-password').value.trim(),server=normalizeServerUrl($('#server-url').value||params.get('server')||'');if(!room)throw new Error('Identifiant du lobby manquant dans le lien.');if(!password)throw new Error('Saisis le mot de passe reçu de ton ami.');await connectNetwork(server);wsSend('join',{roomId:room,password})}
 catch(e){netStatus(e.message||String(e))}
}
$('#puck-glide').addEventListener('input',e=>{puckGlide=clamp((Number(e.target.value)||0)/100,0,1);$('#puck-glide-value').textContent=Number(e.target.value).toFixed(0)+' %'});$('#puck-bounce').addEventListener('input',e=>{puckBounce=clamp(Number(e.target.value)||0,0,100);$('#puck-bounce-value').textContent=puckBounce+' %'});$('#duration').addEventListener('change',()=>{$('#custom-duration-setting').style.display=$('#duration').value==='custom'?'grid':'none'});
$('#create-lobby').addEventListener('click',createOnlineLobby);
$('#join-lobby').addEventListener('click',joinOnlineLobby);
$('#copy-invite').addEventListener('click',()=>{const value=$('#room-link').value;if(navigator.clipboard?.writeText)navigator.clipboard.writeText(value).then(()=>netStatus('Lien copié')).catch(()=>{$('#room-link').select();netStatus('Copie le lien sélectionné')});else{$('#room-link').select();netStatus('Copie le lien sélectionné')}});
$('#copy-password').addEventListener('click',()=>{const value=$('#room-password').textContent;if(navigator.clipboard?.writeText)navigator.clipboard.writeText(value).then(()=>netStatus('Mot de passe copié'))});
function getMatchDuration(){if(mode==='hockey')return 300;const selected=$('#duration').value;return selected==='custom'?clamp(Number($('#custom-duration').value)||2,1,120)*60:Number(selected)||120}
 function launchOnlineMatch(){if(net.role!=='host')return netStatus('Seul l’hôte peut lancer la partie.');if(!net.opponent)return netStatus('Attends que ton ami rejoigne le lobby.');if(!net.ws||net.ws.readyState!==WebSocket.OPEN)return netStatus('Connexion au serveur perdue.');const startAt=Date.now()+3000,duration=getMatchDuration();net.hz=Number($('#network-rate').value)===30?30:60;wsSend('start',{mode,difficulty:$('#difficulty').value,puckGlide,puckBounce,startAt,duration,networkHz:net.hz});startMatch(startAt,duration)}
$('#start-online').addEventListener('click',launchOnlineMatch);
$('#leave-online').addEventListener('click',()=>{wsSend('leave');if(net.ws)net.ws.close();net.role=null;net.roomId=null;$('#online-state').textContent='Hors du lobby';netStatus('Lobby quitté')});
try{const savedHz=localStorage.getItem('robotArenaNetworkHz');$('#network-rate').value=savedHz==='30'?'30':'60';net.hz=Number($('#network-rate').value);$('#network-rate').addEventListener('change',()=>{net.hz=Number($('#network-rate').value)===30?30:60;localStorage.setItem('robotArenaNetworkHz',String(net.hz))});const params=new URLSearchParams(location.search);$('#server-url').value=params.get('server')||localStorage.getItem('robotArenaServerUrl')||'';if(params.get('room')){$('#join-room').value=params.get('room');$('#online-state').textContent='Invitation reçue · saisis le mot de passe'}}catch{}

document.querySelectorAll('.mode-card').forEach(c=>c.addEventListener('click',()=>setMode(c.dataset.mode)));setMode('combat');
function keyLabel(code){if(code==='Space')return 'ESPACE';const azerty={KeyW:'Z',KeyA:'Q',KeyD:'D',KeyE:'E'};if(azerty[code])return azerty[code];if(code.startsWith('Key'))return code.slice(3);if(code.startsWith('Digit'))return code.slice(5);return code}
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
function readController(){const pads=navigator.getGamepads?navigator.getGamepads():[];const p=activeGamepad&&pads[activeGamepad.index]?.connected?pads[activeGamepad.index]:[...pads].find(x=>x&&x.connected);if(!p){activeGamepad=null;$('#throttle-meter').style.width='0%';$('#throttle-meter').style.left='0%';$('#throttle-meter').style.transform='none';$('#steering-meter').style.width='0%';$('#throttle-value').textContent='0%';$('#steering-value').textContent='0%';$('#saw-indicator').textContent=sawEnabled?'ACTIVÉE':'ARRÊTÉE';$('#saw-indicator').classList.toggle('active',sawEnabled);return}activeGamepad=p;const axes=p.axes||[],buttons=p.buttons||[];
 if(assigning){if(assigning.dataset.assign==='saw'){const i=buttons.findIndex(x=>x&&x.pressed);if(i>=0){controllerMap.saw.button=i;assigning.textContent='BOUTON '+(i+1);assigning.classList.remove('waiting');assigning=null;$('#assign-hint').textContent='Bouton affecté. Teste-le en appuyant dessus.'}}else{let best=-1,bestVal=.55;for(let i=0;i<axes.length;i++){const v=Math.abs(axes[i]||0);if(v>bestVal){best=i;bestVal=v}}if(best>=0){const kind=assigning.dataset.assign;controllerMap[kind]={axis:best,invert:kind==='throttle'?-1:Math.sign(axes[best]||1)};assigning.textContent='AXE '+(best+1);assigning.classList.remove('waiting');assigning=null;$('#assign-hint').textContent='Axe affecté. Déplace-le pour vérifier la réponse en direct.'}}}
 const t=controllerMap.throttle,s=controllerMap.steering;let rawThrottle=t.axis<axes.length?(axes[t.axis]||0)*t.invert:0,throttle=invertThrottle?Math.max(0,-rawThrottle):Math.max(0,rawThrottle),steering=s.axis<axes.length?(axes[s.axis]||0)*s.invert:0;steering*=invertSteering?-1:1;throttle=Math.abs(throttle)<.12?0:throttle;steering=Math.abs(steering)<.12?0:steering;
 const sawIndex=controllerMap.saw.button,sawPressed=!!buttons[sawIndex]?.pressed;if(ended&&!$('#controls-panel').classList.contains('hidden')&&sawPressed&&!lastControllerSaw)sawEnabled=!sawEnabled;lastControllerSaw=sawPressed;
 $('#throttle-meter').style.width=throttle*100+'%';$('#throttle-meter').style.left='0%';$('#throttle-meter').style.transform='none';$('#steering-meter').style.width=Math.abs(steering)*50+'%';$('#steering-meter').style.left='50%';$('#steering-meter').style.transform='translateX('+(steering<0?'-100%':'0')+')';$('#throttle-value').textContent=Math.round(throttle*100)+'%';$('#steering-value').textContent=Math.round(steering*100)+'%';
 const indicator=$('#saw-indicator');indicator.textContent=sawEnabled?'ACTIVÉE':'ARRÊTÉE';indicator.classList.toggle('active',sawEnabled);
 return {throttle,steering,sawPressed};}
function actionDown(name){return !!keys[bindings[name]]}
function fmt(t){const n=Math.max(0,Math.ceil(t));return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')}
function startMatch(syncStartAt,matchDuration){
 net.guestStates.length=0;
 if(!renderer){window.__showArenaDiagnostic?.('MATCH IMPOSSIBLE : le moteur WebGL ne s’est pas initialisé.',true);return}
 sawEnabled=false;hockeyFaceoff=null;remaining=mode==='hockey'?300:(matchDuration?clamp(Number(matchDuration)||120,30,7200):getMatchDuration());countdown=syncStartAt?Math.max(.05,(syncStartAt-Date.now())/1000):3;aiLevel=$('#difficulty').value;scoreBlue=scoreRed=roundBlue=roundRed=0;goalLock=0;ended=true;
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
function backMenu(){ended=true;hockeyFaceoff=null;countdown=0;$('#countdown').classList.add('hidden');sawEnabled=false;arenaScreen.classList.add('hidden');menu.classList.remove('hidden')}
function requestMatchStart(){if(net.role==='guest')return netStatus('En attente du lancement par l’hôte.');if(net.role==='host'&&net.opponent)return launchOnlineMatch();startMatch()}
 function toggleTestMode(){if(net.role)return netStatus('Le mode test est disponible hors ligne.');testMode=!testMode;$('#test-mode').textContent='MODE TEST : '+(testMode?'ACTIVÉ':'DÉSACTIVÉ');$('#test-mode').classList.toggle('selected',testMode);netStatus(testMode?'Mode test : robot adverse sans IA, déplaçable par poussée.':'Mode normal : l’IA est activée.')}
 $('#test-mode').addEventListener('click',toggleTestMode);
$('#start').addEventListener('click',requestMatchStart);$('#back-menu').addEventListener('click',backMenu);$('#end-menu').addEventListener('click',backMenu);$('#rematch').addEventListener('click',requestMatchStart);
addEventListener('keydown',e=>{if(waitingForBind){e.preventDefault();bindings[waitingForBind.dataset.bind]=e.code;waitingForBind.classList.remove('waiting');waitingForBind=null;try{localStorage.setItem('robotArenaBindings',JSON.stringify(bindings))}catch{}renderBindings();return}if(!keys[e.code]&&ended&&!$('#controls-panel').classList.contains('hidden')&&e.code===bindings.action)sawEnabled=!sawEnabled;keys[e.code]=true;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault()});addEventListener('keyup',e=>keys[e.code]=false);
const touchActions={KeyW:'forward',KeyS:'backward',KeyA:'left',KeyD:'right',KeyE:'action'};document.querySelectorAll('[data-key]').forEach(b=>{const action=touchActions[b.dataset.key];let code=null;b.addEventListener('pointerdown',e=>{e.preventDefault();code=bindings[action]||b.dataset.key;keys[code]=true;b.setPointerCapture?.(e.pointerId)});const up=e=>{e.preventDefault();if(code)keys[code]=false;code=null};b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);b.addEventListener('lostpointercapture',up)});
function resize(){const rect=arenaScreen.getBoundingClientRect();const w=Math.max(1,Math.floor(rect.width||game.clientWidth)),h=Math.max(1,Math.floor(rect.height||game.clientHeight));camera.aspect=w/h;camera.updateProjectionMatrix();if(renderer)renderer.setSize(w,h,false)}new ResizeObserver(resize).observe(game);new ResizeObserver(resize).observe(arenaScreen);resize();
function loop(){
 requestAnimationFrame(loop);const dt=Math.min(clock.getDelta(),.04);const padInput=readController();document.querySelectorAll('[data-bind]').forEach(b=>b.classList.toggle('pressed',!!keys[bindings[b.dataset.bind]]));goalLock=Math.max(0,goalLock-dt);if(hockeyFaceoff&&net.role!=='guest')advanceHockeyFaceoff(dt);
 if(countdown>0){countdown-=dt;const n=Math.max(1,Math.ceil(countdown));$('#countdown-number').textContent=String(n);if(countdown<=0){countdown=0;ended=false;$('#countdown').classList.add('hidden');$('#round-banner').classList.add('hidden');$('#status').textContent='DÉPART !';if(player&&enemy){player.v=0;enemy.v=0;player.prevX=player.root.position.x;player.prevZ=player.root.position.z;enemy.prevX=enemy.root.position.x;enemy.prevZ=enemy.root.position.z}requestAnimationFrame(()=>{try{resize();if(renderer)renderer.render(scene,camera)}catch(error){window.__showArenaDiagnostic?.('ERREUR APRÈS LE DÉCOMPTE : '+(error?.message||String(error)),true)}})}}
 if(!ended&&player&&enemy){
  if(net.role!=='guest')remaining-=dt;if(net.role!=='guest'&&remaining<=0){remaining=0;const winner=mode==='combat'?(player.contacts===enemy.contacts?'NUL':player.contacts>enemy.contacts?'BLEU':'ROUGE'):mode==='sumo'?(roundBlue>=roundRed?'BLEU':'ROUGE'):(scoreBlue>=scoreRed?'BLEU':'ROUGE');const detail=mode==='combat'?'Temps écoulé · BLEU '+player.contacts+' contacts / ROUGE '+enemy.contacts+' contacts.':'Temps écoulé.';finish(winner,detail)}
  $('#timer').textContent=fmt(remaining);
  if($('#tune-speed-value'))$('#tune-speed-value').textContent=tunedSpeed.toFixed(1)+' m/s';if($('#tune-rotation-value'))$('#tune-rotation-value').textContent=tunedRotation.toFixed(1)+' rad/s';
  const keyboardThrottle=Number(actionDown('forward'));
  const keyboardSteer=Number(actionDown('right'))-Number(actionDown('left'));
  const f=padInput&&Math.abs(padInput.throttle)>.12?padInput.throttle:keyboardThrottle;
  const steering=(padInput&&Math.abs(padInput.steering)>.12?padInput.steering:keyboardSteer)*-1;
  if(net.role==='guest'){const now=performance.now();if(now-net.lastInput>=1000/net.hz){wsSend('input',{throttle:f,steering,action:actionDown('action')||!!padInput?.sawPressed});net.lastInput=now}}
  const sawKey=actionDown('action'),sawButton=!!padInput?.sawPressed,sawInput=sawKey||sawButton;
  if(mode==='combat'&&sawInput&&!lastSawKey)sawEnabled=!sawEnabled;
  lastSawKey=sawInput;
  player.prevX=player.root.position.x;player.prevZ=player.root.position.z;enemy.prevX=enemy.root.position.x;enemy.prevZ=enemy.root.position.z;
  const badBot=b=>!b||![b.root.position.x,b.root.position.y,b.root.position.z,b.root.rotation.x,b.root.rotation.y,b.root.rotation.z,b.v].every(Number.isFinite);
  const reportBad=stage=>{if(badBot(player)||badBot(enemy)){ended=true;window.__showArenaDiagnostic?.('V.23 — NaN détecté '+stage+' · BLEU pos '+[player.root.position.x,player.root.position.y,player.root.position.z].map(v=>Number.isFinite(v)?v.toFixed(2):'NaN').join(',')+' rot '+[player.root.rotation.x,player.root.rotation.y,player.root.rotation.z].map(v=>Number.isFinite(v)?v.toFixed(2):'NaN').join(',')+' · ROUGE pos '+[enemy.root.position.x,enemy.root.position.y,enemy.root.position.z].map(v=>Number.isFinite(v)?v.toFixed(2):'NaN').join(',')+' rot '+[enemy.root.rotation.x,enemy.root.rotation.y,enemy.root.rotation.z].map(v=>Number.isFinite(v)?v.toFixed(2):'NaN').join(',')+' · vitesses '+player.v.toFixed(2)+' / '+enemy.v.toFixed(2),true);return true}return false};
  if(net.role!=='guest'){
   drive(player,dt,f,steering);if(reportBad('après conduite joueur'))return;
   if(net.role==='host'&&net.opponent&&net.ws?.readyState===WebSocket.OPEN&&net.roomId){drive(enemy,dt,net.remote.throttle,net.remote.steering);if(mode==='hockey'&&net.remote.action)attackPuck(enemy)}else if(!testMode)updateAI(dt);else coastBot(enemy,dt)
   if(reportBad('après IA'))return;
  }
  confineRobot(player);confineRobot(enemy);if(reportBad('après limites'))return;
  if(net.role!=='guest'){
   if(mode==='hockey'){collideBots(player,enemy,dt);if(reportBad('après collision robots'))return;if(!hockeyFaceoff){updatePuck(dt);if(sawInput)attackPuck(player)}}
   else{collideBots(player,enemy,dt);if(reportBad('après collision robots'))return;if(mode==='sumo')updateSumo()}
   updateHud();
   const now=performance.now();if(net.role==='host'&&net.roomId&&now-net.lastState>=1000/net.hz){wsSend('state',{state:{blue:{x:player.root.position.x,y:player.root.position.y,z:player.root.position.z,r:player.root.rotation.y,v:player.v,hp:player.hp,contacts:player.contacts},red:{x:enemy.root.position.x,y:enemy.root.position.y,z:enemy.root.position.z,r:enemy.root.rotation.y,v:enemy.v,hp:enemy.hp,contacts:enemy.contacts},puck:puck?{x:puck.position.x,y:puck.position.y,z:puck.position.z,vx:puck.userData.vx,vz:puck.userData.vz,rx:puck.rotation.x,rz:puck.rotation.z}:null,hockeyFaceoff:hockeyFaceoff?{phase:hockeyFaceoff.phase}:null,remaining,scoreBlue,scoreRed,roundBlue,roundRed}});net.lastState=now}
  }
 }
 if(net.role==='host'&&net.roomId&&mode==='hockey'&&hockeyFaceoff&&player&&enemy){const now=performance.now();if(now-net.lastState>=1000/net.hz){wsSend('state',{state:{blue:{x:player.root.position.x,y:player.root.position.y,z:player.root.position.z,r:player.root.rotation.y,v:player.v,hp:player.hp,contacts:player.contacts},red:{x:enemy.root.position.x,y:enemy.root.position.y,z:enemy.root.position.z,r:enemy.root.rotation.y,v:enemy.v,hp:enemy.hp,contacts:enemy.contacts},puck:puck?{x:puck.position.x,y:puck.position.y,z:puck.position.z,vx:0,vz:0,rx:puck.rotation.x,rz:puck.rotation.z}:null,hockeyFaceoff:true,remaining,scoreBlue,scoreRed,roundBlue,roundRed}});net.lastState=now}}
 if(net.role==='guest'&&!ended)applyBufferedNetworkState();
 const nowPing=performance.now();if(net.ws&&net.ws.readyState===WebSocket.OPEN&&nowPing-net.lastPing>=1000){wsSend('net_ping',{sentAt:nowPing});net.lastPing=nowPing}
 const target=player?new THREE.Vector3((player.root.position.x+enemy.root.position.x)*.5,0,(player.root.position.z+enemy.root.position.z)*.5):new THREE.Vector3(0,0,0);
 camera.position.lerp(new THREE.Vector3(target.x,mode==='sumo'?19:mode==='combat'?27:20,target.z+(mode==='combat'?34:mode==='hockey'?27:19)),.045);camera.lookAt(target);if(renderer){try{renderer.render(scene,camera)}catch(error){ended=true;countdown=0;window.__showArenaDiagnostic?.('ERREUR WEBGL PENDANT LE MATCH : '+(error?.message||String(error)),true)}}
}
if(renderer){renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();window.__showArenaDiagnostic?.('ERREUR GRAPHIQUE : le contexte WebGL a été perdu.',true)});renderer.domElement.addEventListener('webglcontextrestored',()=>{renderer.setClearColor(0x080808,1);resize();renderer.render(scene,camera);window.__hideArenaDiagnostic?.()})}
window.addEventListener('error',e=>{const status=$('#status');if(status)status.textContent='ERREUR JEU : '+(e.message||'voir console')});
window.addEventListener('unhandledrejection',e=>{const status=$('#status');if(status)status.textContent='ERREUR CHARGEMENT : '+String(e.reason||'module indisponible');window.__showArenaDiagnostic?.('ERREUR DE CHARGEMENT : '+String(e.reason?.message||e.reason||'module indisponible'),true)});
loop();
