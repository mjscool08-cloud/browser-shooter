import * as THREE from 'three';

// =====================
// RENDERER / SCENE
// =====================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 24, 64);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 120);
const renderer = new THREE.WebGLRenderer({antialias:false, powerPreference:'low-power'});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.0));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xffffff,0x71835c,2.0));
const sun = new THREE.DirectionalLight(0xffffff,2.3);
sun.position.set(25,40,15);
scene.add(sun);

// =====================
// ORIGINAL PIXEL TEXTURES
// =====================
function makeTexture(draw){
  const c=document.createElement('canvas');
  c.width=c.height=16;
  const ctx=c.getContext('2d');
  ctx.imageSmoothingEnabled=false;
  draw(ctx);
  const t=new THREE.CanvasTexture(c);
  t.magFilter=THREE.NearestFilter;
  t.minFilter=THREE.NearestFilter;
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  return t;
}
function speckle(base,dark,light){
  return makeTexture(ctx=>{
    ctx.fillStyle=base;ctx.fillRect(0,0,16,16);
    for(let i=0;i<42;i++){
      ctx.fillStyle=i%2?dark:light;
      ctx.fillRect((Math.random()*16)|0,(Math.random()*16)|0,1,1);
    }
  });
}
const grassTex=speckle('#62a842','#4b8d35','#78b957');
const dirtTex=speckle('#8b5a36','#684126','#a46d44');
const stoneTex=speckle('#777777','#5f5f5f','#929292');

const woodSide=makeTexture(ctx=>{
  ctx.fillStyle='#986338';ctx.fillRect(0,0,16,16);
  for(let x=1;x<16;x+=3){
    ctx.fillStyle=x%2?'#6c4325':'#b47743';
    ctx.fillRect(x,0,1,16);
  }
  ctx.fillStyle='#7a4c29';
  ctx.fillRect(5,3,2,1);ctx.fillRect(11,10,2,1);ctx.fillRect(2,13,2,1);
});
const woodTop=makeTexture(ctx=>{
  ctx.fillStyle='#bd8b52';ctx.fillRect(0,0,16,16);
  ctx.strokeStyle='#7b512d';
  ctx.strokeRect(1.5,1.5,13,13);
  ctx.strokeRect(4.5,4.5,7,7);
  ctx.fillStyle='#64401f';ctx.fillRect(7,7,2,2);
});
const brickTex=makeTexture(ctx=>{
  ctx.fillStyle='#a64e43';ctx.fillRect(0,0,16,16);
  ctx.fillStyle='#d0b1a3';
  for(let y=4;y<16;y+=5)ctx.fillRect(0,y,16,1);
  ctx.fillRect(7,0,1,4);ctx.fillRect(3,5,1,4);ctx.fillRect(12,5,1,4);ctx.fillRect(7,10,1,4);
});

// One material per block/face class. Chunk geometry is grouped by material.
const MATERIALS=[
  new THREE.MeshLambertMaterial({map:grassTex}),
  new THREE.MeshLambertMaterial({map:dirtTex}),
  new THREE.MeshLambertMaterial({map:stoneTex}),
  new THREE.MeshLambertMaterial({map:woodSide}),
  new THREE.MeshLambertMaterial({map:woodTop}),
  new THREE.MeshLambertMaterial({map:brickTex}),
];
const MAT_INDEX={
  grass:0,dirt:1,stone:2,woodSide:3,woodTop:4,bricks:5
};

const ITEMS=[
  {id:'grass',name:'Grass',kind:'block'},
  {id:'dirt',name:'Dirt',kind:'block'},
  {id:'stone',name:'Stone',kind:'block'},
  {id:'wood',name:'Wood',kind:'block'},
  {id:'bricks',name:'Bricks',kind:'block'},
  {id:'sword',name:'Sword',kind:'weapon'},
  {id:'pistol',name:'Pistol',kind:'weapon'},
  {id:'rifle',name:'Rifle',kind:'weapon'},
  {id:'shotgun',name:'Shotgun',kind:'weapon'},
  {id:'greatsword',name:'Greatsword',kind:'weapon'}
];
const cheatWeapons=[];
const storedItems=[];

// =====================
// CHUNKED VOXEL WORLD
// =====================
const CHUNK_SIZE=16;
const WORLD_RADIUS=20;
const blocks=new Map();          // x,y,z -> block type
const chunks=new Map();          // cx,cz -> THREE.Mesh
const dirtyChunks=new Set();

const bkey=(x,y,z)=>`${x},${y},${z}`;
const ckey=(cx,cz)=>`${cx},${cz}`;
const ccoord=v=>Math.floor(v/CHUNK_SIZE);

function terrainHeight(x,z){
  return Math.floor(2+Math.sin(x*.27)*1.5+Math.cos(z*.24)*1.15+Math.sin((x+z)*.12)*.8);
}
function getBlock(x,y,z){return blocks.get(bkey(x,y,z));}
function setBlockRaw(x,y,z,type){
  if(type) blocks.set(bkey(x,y,z),type);
  else blocks.delete(bkey(x,y,z));
}
function markChunkDirtyAt(x,z){
  const cx=ccoord(x),cz=ccoord(z);
  dirtyChunks.add(ckey(cx,cz));
  const lx=((x%CHUNK_SIZE)+CHUNK_SIZE)%CHUNK_SIZE;
  const lz=((z%CHUNK_SIZE)+CHUNK_SIZE)%CHUNK_SIZE;
  if(lx===0) dirtyChunks.add(ckey(cx-1,cz));
  if(lx===CHUNK_SIZE-1) dirtyChunks.add(ckey(cx+1,cz));
  if(lz===0) dirtyChunks.add(ckey(cx,cz-1));
  if(lz===CHUNK_SIZE-1) dirtyChunks.add(ckey(cx,cz+1));
}
function setBlock(x,y,z,type){
  if(type && getBlock(x,y,z)) return false;
  if(!type && !getBlock(x,y,z)) return false;
  setBlockRaw(x,y,z,type);
  markChunkDirtyAt(x,z);
  return true;
}

for(let x=-WORLD_RADIUS;x<=WORLD_RADIUS;x++){
  for(let z=-WORLD_RADIUS;z<=WORLD_RADIUS;z++){
    const top=terrainHeight(x,z);
    for(let y=-2;y<=top;y++){
      setBlockRaw(x,y,z,y===top?'grass':y>=top-2?'dirt':'stone');
    }
  }
}
for(let y=4;y<=7;y++)setBlockRaw(-5,y,1,'wood');
for(let x=4;x<=8;x++)setBlockRaw(x,4,-4,'bricks');

const FACES=[
  {n:[ 1,0,0], c:[[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5],[.5,-.5,.5]]},
  {n:[-1,0,0], c:[[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5],[-.5,-.5,-.5]]},
  {n:[0, 1,0], c:[[-.5,.5,-.5],[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5]]},
  {n:[0,-1,0], c:[[-.5,-.5,.5],[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5]]},
  {n:[0,0, 1], c:[[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5],[-.5,-.5,.5]]},
  {n:[0,0,-1], c:[[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5],[.5,-.5,-.5]]}
];
const UV=[[0,0],[0,1],[1,1],[1,0]];

function faceMaterial(type,faceIndex){
  if(type==='wood') return (faceIndex===2||faceIndex===3)?MAT_INDEX.woodTop:MAT_INDEX.woodSide;
  return MAT_INDEX[type];
}

function rebuildChunk(cx,cz){
  const old=chunks.get(ckey(cx,cz));
  if(old){
    scene.remove(old);
    old.geometry.dispose();
    chunks.delete(ckey(cx,cz));
  }

  const pos=[],norm=[],uv=[],index=[];
  const groups=Array.from({length:MATERIALS.length},()=>[]);
  let vertexBase=0;
  const startX=cx*CHUNK_SIZE,startZ=cz*CHUNK_SIZE;

  for(let x=startX;x<startX+CHUNK_SIZE;x++){
    for(let z=startZ;z<startZ+CHUNK_SIZE;z++){
      for(let y=-2;y<=20;y++){
        const type=getBlock(x,y,z);
        if(!type)continue;
        for(let fi=0;fi<6;fi++){
          const f=FACES[fi],nx=x+f.n[0],ny=y+f.n[1],nz=z+f.n[2];
          if(getBlock(nx,ny,nz))continue; // hidden face: never reaches GPU

          for(let i=0;i<4;i++){
            pos.push(x+f.c[i][0],y+f.c[i][1],z+f.c[i][2]);
            norm.push(...f.n);
            uv.push(...UV[i]);
          }
          groups[faceMaterial(type,fi)].push(vertexBase,vertexBase+1,vertexBase+2, vertexBase,vertexBase+2,vertexBase+3);
          vertexBase+=4;
        }
      }
    }
  }

  if(vertexBase===0)return;

  const geom=new THREE.BufferGeometry();
  geom.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geom.setAttribute('normal',new THREE.Float32BufferAttribute(norm,3));
  geom.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));

  // Concatenate per-material indices so BufferGeometry groups can use the right texture.
  let offset=0;
  for(let m=0;m<groups.length;m++){
    const arr=groups[m];
    index.push(...arr);
    if(arr.length){
      geom.addGroup(offset,arr.length,m);
      offset+=arr.length;
    }
  }
  geom.setIndex(index);
  geom.computeBoundingSphere();

  const mesh=new THREE.Mesh(geom,MATERIALS);
  mesh.userData.chunk={cx,cz};
  scene.add(mesh);
  chunks.set(ckey(cx,cz),mesh);
}

function rebuildDirtyChunks(limit=3){
  let n=0;
  for(const k of [...dirtyChunks]){
    const [cx,cz]=k.split(',').map(Number);
    rebuildChunk(cx,cz);
    dirtyChunks.delete(k);
    if(++n>=limit)break;
  }
}

// Initial chunk build.
for(let cx=ccoord(-WORLD_RADIUS);cx<=ccoord(WORLD_RADIUS);cx++){
  for(let cz=ccoord(-WORLD_RADIUS);cz<=ccoord(WORLD_RADIUS);cz++){
    dirtyChunks.add(ckey(cx,cz));
  }
}
while(dirtyChunks.size)rebuildDirtyChunks(999);

// =====================
// PLAYER
// =====================
const player={
  position:new THREE.Vector3(0,9,8),
  velocity:new THREE.Vector3(),
  yaw:0,pitch:0,height:1.75,grounded:false
};
camera.position.copy(player.position);
const keys=new Set();

addEventListener('keydown',e=>{
  keys.add(e.code);
  if(e.code==='Space')e.preventDefault();
  if(e.code.startsWith('Digit')){
    const n=Number(e.code.slice(5));
    if(n>=1&&n<=9)selectItem(n-1);
    if(n===0)selectItem(9);
    if(e.code==='Minus'){
      const idx=allItems().findIndex(it=>it.id==='python');
      if(idx>=0)selectItem(idx);
    }
    if(e.code==='Equal'){
      const idx=allItems().findIndex(it=>it.id==='67');
      if(idx>=0)selectItem(idx);
    }
  }
});
addEventListener('keyup',e=>keys.delete(e.code));

renderer.domElement.addEventListener('click',()=>{
  if(document.pointerLockElement!==renderer.domElement)renderer.domElement.requestPointerLock();
});
renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());

addEventListener('mousemove',e=>{
  if(inventoryOpen)return;
  if(document.pointerLockElement!==renderer.domElement)return;
  player.yaw-=e.movementX*.002;
  player.pitch-=e.movementY*.002;
  player.pitch=Math.max(-Math.PI/2+.01,Math.min(Math.PI/2-.01,player.pitch));
});

function floorHeightAt(x,z){
  const bx=Math.floor(x+.5),bz=Math.floor(z+.5);
  for(let y=25;y>=-8;y--)if(getBlock(bx,y,bz))return y+.5;
  return -100;
}
function blockWouldHitPlayer(x,y,z){
  const feet=player.position.y-player.height;
  return Math.abs(player.position.x-x)<.82 &&
         Math.abs(player.position.z-z)<.82 &&
         player.position.y>y-.5 && feet<y+.5;
}

// =====================
// HOTBAR / VIEWMODEL
// =====================
let selectedIndex=0;
const slots=[...document.querySelectorAll('.slot')];
const selectedText=document.getElementById('selected');
const weaponView=document.getElementById('weapon');
function allItems(){return [...ITEMS,...cheatWeapons];}
function currentItem(){return allItems()[selectedIndex];}

function selectItem(i){
  const all=allItems();
  if(i<0||i>=all.length)return;
  selectedIndex=i;
  slots.forEach((s,n)=>s.classList.toggle('selected',n===i));
  selectedText.textContent='Selected: '+all[i].name;
  weaponView.className='';
  const id=all[i].id;
  if(id==='sword')weaponView.className='sword';
  if(id==='pistol')weaponView.className='pistol';
  if(id==='rifle')weaponView.className='rifle';
  if(id==='shotgun')weaponView.className='shotgun';
  if(id==='greatsword')weaponView.className='greatsword';
  if(id==='python')weaponView.className='python';
  if(id==='67')weaponView.className='sixtyseven';
}

function addCheatWeapon(id,name){
  if(cheatWeapons.some(w=>w.id===id)){
    selectItem(ITEMS.length+cheatWeapons.findIndex(w=>w.id===id));
    return;
  }
  cheatWeapons.push({id,name,kind:'weapon'});
  rebuildHotbarDOM();
  selectItem(ITEMS.length+cheatWeapons.length-1);
}

function animateWeapon(){
  if(!weaponView.className)return;
  weaponView.animate(
    [{transform:'translate(0,0) rotate(0deg)'},
     {transform:'translate(-42px,-32px) rotate(-28deg)'},
     {transform:'translate(0,0) rotate(0deg)'}],
    {duration:180}
  );
}

// =====================
// VOXEL RAYCASTING
// =====================
// Grid stepping instead of raycasting against every block object.
function voxelRay(maxDistance=6){
  const dir=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion).normalize();
  const origin=camera.position.clone();
  const step=.08;
  let prev=null;
  for(let d=0;d<=maxDistance;d+=step){
    const p=origin.clone().addScaledVector(dir,d);
    const bx=Math.floor(p.x+.5),by=Math.floor(p.y+.5),bz=Math.floor(p.z+.5);
    const k=bkey(bx,by,bz);
    if(getBlock(bx,by,bz)){
      let normal=new THREE.Vector3(0,1,0);
      if(prev){
        normal.set(prev.x-bx,prev.y-by,prev.z-bz);
      }
      return {x:bx,y:by,z:bz,type:getBlock(bx,by,bz),normal};
    }
    prev={x:bx,y:by,z:bz};
  }
  return null;
}


// =====================
// PLAYER HP
// =====================
const hpText=document.getElementById('hp');
const deathScreen=document.getElementById('deathScreen');
let playerHP=100;
let dead=false;
let damageBonus=0;

function setHP(v){
  playerHP=Math.max(0,Math.min(100,v));
  hpText.textContent=Math.ceil(playerHP);
  if(playerHP<=0&&!dead)playerDeath();
}
function damagePlayer(amount){
  if(dead)return;
  setHP(playerHP-amount);
}
function playerDeath(){
  dead=true;
  deathScreen.style.display='flex';
  setTimeout(()=>{
    player.position.set(0,9,8);
    player.velocity.set(0,0,0);
    playerHP=100;
    hpText.textContent='100';
    dead=false;
    deathScreen.style.display='none';
  },1800);
}

// =====================
// MOBS + KNOCKBACK
// =====================
const mobs=[];
const mobCount=document.getElementById('mobCount');
const bossCount=document.getElementById('bossCount');
let bossTotal=0;
const mobBodyMat=new THREE.MeshLambertMaterial({color:0x4f9e4f});
const mobHeadMat=new THREE.MeshLambertMaterial({color:0x78bd68});
const mobDarkMat=new THREE.MeshLambertMaterial({color:0x355f35});

function spawnMob(x,z,type='grunt'){
  const group=new THREE.Group();
  const floor=floorHeightAt(x,z);

  let bodyColor=0x4f9e4f,headColor=0x78bd68,darkColor=0x355f35;
  let hp=24,speed=1.05,scale=1,contact=7,isBoss=false;

  if(type==='runner'){
    bodyColor=0xd5b531;headColor=0xf2d763;darkColor=0x8a7420;
    hp=16;speed=1.9;contact=6;
  }
  if(type==='brute'){
    bodyColor=0xaa4444;headColor=0xcc6666;darkColor=0x632525;
    hp=50;speed=.72;scale=1.18;contact=12;
  }
  if(type==='boss'){
    bodyColor=0x6b237d;headColor=0x9d46b2;darkColor=0x35103e;
    hp=220;speed=.62;scale=2.15;contact=22;isBoss=true;
  }

  const body=new THREE.Mesh(new THREE.BoxGeometry(.85,1.05,.48),new THREE.MeshLambertMaterial({color:bodyColor}));
  body.position.y=1.05;
  const head=new THREE.Mesh(new THREE.BoxGeometry(.72,.72,.72),new THREE.MeshLambertMaterial({color:headColor}));
  head.position.y=1.9;
  const leg1=new THREE.Mesh(new THREE.BoxGeometry(.3,.8,.32),new THREE.MeshLambertMaterial({color:darkColor}));
  leg1.position.set(-.22,.35,0);
  const leg2=leg1.clone();
  leg2.material=leg1.material.clone();
  leg2.position.x=.22;
  group.add(body,head,leg1,leg2);
  group.scale.setScalar(scale);

  const mob={
    type,health:hp,maxHealth:hp,speed,dead:false,group,
    velocity:new THREE.Vector3(),contactDamage:contact,isBoss,hitCooldown:0
  };
  group.userData.mob=mob;
  for(const child of group.children)child.userData.mobRef=mob;
  group.position.set(x,floor,z);

  scene.add(group);
  mobs.push(mob);
  if(isBoss)bossTotal++;
  mobCount.textContent=mobs.length;
  bossCount.textContent=bossTotal;
}

spawnMob(7,5,'grunt');
spawnMob(-8,-5,'brute');
spawnMob(10,-8,'runner');
spawnMob(-10,9,'grunt');
spawnMob(15,14,'boss');

function flashMob(mob){
  for(const child of mob.group.children){
    if(!child.material)continue;
    const old=child.material.color.getHex();
    child.material.color.setHex(0xff5555);
    setTimeout(()=>{if(!mob.dead)child.material.color.setHex(old)},90);
  }
}
function damageMob(mob,amount,knockback=null){
  if(!mob||mob.dead)return;
  mob.health-=amount;
  flashMob(mob);
  if(knockback)mob.velocity.add(knockback);

  if(mob.health<=0){
    mob.dead=true;
    scene.remove(mob.group);
    const i=mobs.indexOf(mob);if(i>=0)mobs.splice(i,1);
    if(mob.isBoss){
      bossTotal=Math.max(0,bossTotal-1);
      bossCount.textContent=bossTotal;
    }
    mobCount.textContent=mobs.length;
    setTimeout(()=>{
      const a=Math.random()*Math.PI*2,r=10+Math.random()*7;
      if(mob.isBoss){
        spawnMob(Math.round(Math.cos(a)*r),Math.round(Math.sin(a)*r),'boss');
      }else{
        const types=['grunt','grunt','runner','brute'];
        spawnMob(Math.round(Math.cos(a)*r),Math.round(Math.sin(a)*r),types[(Math.random()*types.length)|0]);
      }
    },mob.isBoss?9000:2200);
  }
}

function updateMobs(dt){
  for(const mob of mobs){
    if(mob.dead)continue;
    const g=mob.group;

    // Knockback velocity with friction/gravity.
    g.position.x+=mob.velocity.x*dt;
    g.position.z+=mob.velocity.z*dt;
    g.position.y+=mob.velocity.y*dt;
    mob.velocity.x*=Math.pow(.06,dt);
    mob.velocity.z*=Math.pow(.06,dt);
    mob.velocity.y-=9.5*dt;

    const floor=floorHeightAt(g.position.x,g.position.z);
    if(g.position.y<=floor){
      g.position.y=floor;
      if(mob.velocity.y<0)mob.velocity.y=0;
    }

    // Don't immediately walk back during strong knockback.
    const horizontalKB=Math.hypot(mob.velocity.x,mob.velocity.z);
    const dx=player.position.x-g.position.x,dz=player.position.z-g.position.z;
    const dist=Math.hypot(dx,dz);
    mob.hitCooldown=Math.max(0,mob.hitCooldown-dt);
    const hitRange=mob.isBoss?2.5:1.55;

    if(dist<hitRange && mob.hitCooldown<=0){
      damagePlayer(mob.contactDamage);
      mob.hitCooldown=1.0;
      const push=new THREE.Vector3(dx,0,dz).normalize().multiplyScalar(3.2);
      player.velocity.x+=push.x;
      player.velocity.z+=push.z;
      player.velocity.y+=2.0;
    }

    if(horizontalKB<1.0 && dist<16 && dist>hitRange){
      g.position.x+=(dx/dist)*mob.speed*dt;
      g.position.z+=(dz/dist)*mob.speed*dt;
      g.rotation.y=Math.atan2(dx,dz);
    }
  }
}

// =====================
// COMBAT
// =====================
const raycaster=new THREE.Raycaster();
const center=new THREE.Vector2(0,0);
const cooldowns={};
const projectiles=[];

function ready(name,ms){
  const now=performance.now();
  if((cooldowns[name]||0)>now)return false;
  cooldowns[name]=now+ms;
  return true;
}
function forwardHorizontal(){
  const f=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
  f.y=0;
  return f.normalize();
}
function meleeAttack(name,baseDamage,range,arcDeg,kbPower,cooldown,multi=true){
  if(!ready(name,cooldown))return;
  animateWeapon();
  const forward=forwardHorizontal();
  const origin=player.position.clone();
  const cosHalf=Math.cos((arcDeg/2)*Math.PI/180);
  const hits=[];

  for(const mob of [...mobs]){
    if(mob.dead)continue;
    const target=mob.group.position.clone();
    target.y+=1;
    const to=target.sub(origin);
    const h=new THREE.Vector3(to.x,0,to.z);
    const dist=h.length();
    if(dist>range||dist<.01)continue;
    h.normalize();
    if(forward.dot(h)<cosHalf)continue;
    hits.push({mob,dir:h.clone()});
    if(!multi)break;
  }

  for(const {mob,dir} of hits){
    const kb=dir.multiplyScalar(kbPower);
    kb.y=2.8+kbPower*.08;
    damageMob(mob,baseDamage+damageBonus,kb);
  }
}
function hitscan(name,damage,range,cooldown,kb=1){
  if(!ready(name,cooldown))return;
  animateWeapon();
  raycaster.far=range;
  raycaster.setFromCamera(center,camera);
  const groups=mobs.filter(m=>!m.dead).map(m=>m.group);
  const hit=raycaster.intersectObjects(groups,true)[0];
  if(hit){
    const mob=hit.object.userData.mobRef;
    const d=forwardHorizontal().multiplyScalar(kb);
    d.y=.35;
    damageMob(mob,damage+damageBonus,d);
  }
}
function shotgunAttack(){
  if(!ready('shotgun',720))return;
  animateWeapon();
  for(let i=0;i<5;i++){
    raycaster.far=18;
    raycaster.setFromCamera(new THREE.Vector2((Math.random()-.5)*.14,(Math.random()-.5)*.10),camera);
    const groups=mobs.filter(m=>!m.dead).map(m=>m.group);
    const hit=raycaster.intersectObjects(groups,true)[0];
    if(hit){
      const mob=hit.object.userData.mobRef;
      const d=forwardHorizontal().multiplyScalar(2.2);
      d.y=.55;
      damageMob(mob,5+damageBonus,d);
    }
  }
}
function projectileAttack(damage,size=.35,speed=18,label=''){
  const geo=new THREE.SphereGeometry(size,8,6);
  const mat=new THREE.MeshBasicMaterial({color:label==='67'?0xaa66ff:0x55aaff});
  const mesh=new THREE.Mesh(geo,mat);
  mesh.position.copy(camera.position);
  const dir=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion).normalize();
  scene.add(mesh);
  projectiles.push({mesh,dir,speed,damage:damage+damageBonus,life:3,label});
}
function updateProjectiles(dt){
  for(let i=projectiles.length-1;i>=0;i--){
    const p=projectiles[i];
    p.mesh.position.addScaledVector(p.dir,p.speed*dt);
    p.life-=dt;

    let hitMob=null;
    for(const mob of mobs){
      if(mob.dead)continue;
      const target=mob.group.position.clone();
      target.y+=mob.isBoss?2.2:1;
      const radius=mob.isBoss?1.8:.8;
      if(p.mesh.position.distanceTo(target)<radius){
        hitMob=mob;
        break;
      }
    }

    if(hitMob){
      const kb=p.dir.clone();
      kb.y=0;
      kb.normalize().multiplyScalar(3);
      kb.y=1;
      damageMob(hitMob,p.damage,kb);
      p.life=0;
    }

    if(p.life<=0){
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      projectiles.splice(i,1);
    }
  }
}
function pythonLoopAttack(){
  if(!ready('pythonQ',3000))return;
  const forward=forwardHorizontal();
  const origin=player.position.clone();
  const cosHalf=Math.cos(50*Math.PI/180);
  let target=null,best=999;

  for(const mob of mobs){
    if(mob.dead)continue;
    const to=mob.group.position.clone().sub(origin);
    const h=new THREE.Vector3(to.x,0,to.z);
    const dist=h.length();
    if(dist<=4.5&&dist<best){
      h.normalize();
      if(forward.dot(h)>=cosHalf){
        target=mob;
        best=dist;
      }
    }
  }
  if(!target)return;

  animateWeapon();
  for(let n=0;n<5;n++){
    setTimeout(()=>{
      if(target.dead)return;
      const d=target.group.position.clone().sub(player.position);
      d.y=0;
      d.normalize().multiplyScalar(2.5);
      d.y=.7;
      damageMob(target,10+damageBonus,d);
    },n*120);
  }
}
function useAbility(code){
  const item=currentItem();
  if(!item)return;

  if(item.id==='python'){
    if(code==='KeyE' && ready('pythonE',1800)){
      animateWeapon();
      projectileAttack(15,.7,13,'projectile');
    }
    if(code==='KeyQ'){
      pythonLoopAttack();
    }
  }

  if(item.id==='67' && code==='KeyE' && ready('67special',67000)){
    animateWeapon();
    projectileAttack(67,.65,22,'67');
  }
}

addEventListener('keydown',e=>{
  if(e.code==='KeyE'||e.code==='KeyQ')useAbility(e.code);
});

addEventListener('mousedown',e=>{
  if(inventoryOpen)return;
  if(document.pointerLockElement!==renderer.domElement)return;
  const item=currentItem();
  if(!item)return;

  if(e.button===2){
    const h=voxelRay(6);
    if(h)setBlock(h.x,h.y,h.z,null);
    return;
  }
  if(e.button!==0)return;

  if(item.id==='sword'){meleeAttack('sword',13,4.25,110,7.5,360,true);return;}
  if(item.id==='greatsword'){meleeAttack('greatsword',22,4.8,125,10.5,650,true);return;}
  if(item.id==='pistol'){hitscan('pistol',9,32,240,1.5);return;}
  if(item.id==='rifle'){hitscan('rifle',7,48,115,.7);return;}
  if(item.id==='shotgun'){shotgunAttack();return;}
  if(item.id==='python'){meleeAttack('python',10,5.0,135,6.0,300,true);return;}
  if(item.id==='67'){
    if(ready('67rapid',55)){
      animateWeapon();
      projectileAttack(Math.random()<.5?6:7,.26,28,'67');
    }
    return;
  }

  if(item.kind==='block'){
    const h=voxelRay(6);
    if(!h)return;
    const x=h.x+h.normal.x;
    const y=h.y+h.normal.y;
    const z=h.z+h.normal.z;
    if(!blockWouldHitPlayer(x,y,z))setBlock(x,y,z,item.id);
  }
});

// =====================
// PLAYER UPDATE
// =====================
function updatePlayer(dt){
  const speed=keys.has('ControlLeft')?8.5:5.2;
  const damping=18;
  const forward=new THREE.Vector3(-Math.sin(player.yaw),0,-Math.cos(player.yaw));
  const right=new THREE.Vector3(Math.cos(player.yaw),0,-Math.sin(player.yaw));
  const desired=new THREE.Vector3();
  if(keys.has('KeyW'))desired.add(forward);
  if(keys.has('KeyS'))desired.sub(forward);
  if(keys.has('KeyD'))desired.add(right);
  if(keys.has('KeyA'))desired.sub(right);
  if(desired.lengthSq())desired.normalize().multiplyScalar(speed);

  player.velocity.x=THREE.MathUtils.damp(player.velocity.x,desired.x,damping,dt);
  player.velocity.z=THREE.MathUtils.damp(player.velocity.z,desired.z,damping,dt);
  player.velocity.y-=20*dt;

  if(keys.has('Space')&&player.grounded){
    player.velocity.y=8;player.grounded=false;
  }
  player.position.addScaledVector(player.velocity,dt);

  const floor=floorHeightAt(player.position.x,player.position.z)+player.height;
  if(player.position.y<=floor){
    player.position.y=floor;player.velocity.y=0;player.grounded=true;
  }else player.grounded=false;

  camera.position.copy(player.position);
  camera.rotation.order='YXZ';
  camera.rotation.y=player.yaw;
  camera.rotation.x=player.pitch;
}



// =====================
// INVENTORY
// =====================
const inventoryMenu=document.getElementById('inventoryMenu');
const inventoryHotbarList=document.getElementById('inventoryHotbarList');
const inventoryStorageList=document.getElementById('inventoryStorageList');
const inventoryStatus=document.getElementById('inventoryStatus');

let inventoryOpen=false;
let inventoryColumn=0; // 0 hotbar, 1 storage
let inventoryCursor=0;

function inventoryItemsForColumn(){
  return inventoryColumn===0 ? allItems() : storedItems;
}
function inventoryRow(text,selected){
  return `<div style="padding:5px 7px;border:1px solid #555;margin:3px 0;background:${selected?'#ffffff22':'#00000022'}">${selected?'▶ ':''}${text}</div>`;
}
function renderInventory(){
  const hot=allItems();
  inventoryHotbarList.innerHTML=hot.length
    ? hot.map((it,i)=>inventoryRow(it.name,inventoryColumn===0&&inventoryCursor===i)).join('')
    : '<div style="opacity:.6">Empty</div>';

  inventoryStorageList.innerHTML=storedItems.length
    ? storedItems.map((it,i)=>inventoryRow(it.name,inventoryColumn===1&&inventoryCursor===i)).join('')
    : '<div style="opacity:.6">Empty</div>';
}
function setInventoryOpen(open){
  inventoryOpen=open;
  inventoryMenu.style.display=open?'block':'none';
  if(open){
    document.exitPointerLock();
    inventoryColumn=0;
    inventoryCursor=Math.min(selectedIndex,Math.max(0,allItems().length-1));
    inventoryStatus.textContent='';
    renderInventory();
  }else{
    renderer.domElement.requestPointerLock();
  }
}
function rebuildHotbarDOM(){
  const hb=document.getElementById('hotbar');
  hb.innerHTML='';
  const items=allItems();
  for(let i=0;i<items.length;i++){
    const slot=document.createElement('div');
    slot.className='slot';
    const key = i<5 ? String(i+1) :
                i===5 ? '6' :
                i===6 ? '7' :
                i===7 ? '8' :
                i===8 ? '9' :
                i===9 ? '0' :
                items[i].id==='python' ? '-' :
                items[i].id==='67' ? '=' : '★';
    slot.innerHTML=`${key}<br>${items[i].name}`;
    hb.appendChild(slot);
  }
  slots.length=0;
  slots.push(...hb.querySelectorAll('.slot'));
  slots.forEach((s,n)=>s.classList.toggle('selected',n===selectedIndex));
}
function moveInventoryItem(){
  const source=inventoryItemsForColumn();
  if(source.length===0)return;
  inventoryCursor=Math.max(0,Math.min(inventoryCursor,source.length-1));

  if(inventoryColumn===0){
    const all=allItems();
    const item=all[inventoryCursor];
    // Keep core block/weapon layout safe by only stashing cheat weapons and normal weapons, not blocks.
    if(!item || item.kind!=='weapon'){
      inventoryStatus.textContent='Blocks stay on the hotbar.';
      return;
    }
    // Remove from base ITEMS only for normal weapons, or cheatWeapons for cheat weapons.
    const baseIndex=ITEMS.findIndex(it=>it===item);
    if(baseIndex>=0){
      // protect first 5 block slots, allow weapons 6-0 to be stored.
      if(baseIndex<5)return;
      ITEMS.splice(baseIndex,1);
    }else{
      const ci=cheatWeapons.findIndex(it=>it===item);
      if(ci>=0)cheatWeapons.splice(ci,1);
    }
    storedItems.push(item);
    selectedIndex=Math.min(selectedIndex,Math.max(0,allItems().length-1));
    inventoryStatus.textContent=`Stored ${item.name}.`;
  }else{
    const item=storedItems.splice(inventoryCursor,1)[0];
    if(!item)return;
    if(item.id==='python'||item.id==='67')cheatWeapons.push(item);
    else ITEMS.push(item);
    inventoryStatus.textContent=`Moved ${item.name} to hotbar.`;
  }

  inventoryCursor=Math.max(0,Math.min(inventoryCursor,inventoryItemsForColumn().length-1));
  rebuildHotbarDOM();
  renderInventory();
  if(allItems().length)selectItem(Math.min(selectedIndex,allItems().length-1));
}

addEventListener('keydown',e=>{
  if(e.code==='KeyI'){
    e.preventDefault();
    setInventoryOpen(!inventoryOpen);
    return;
  }
  if(!inventoryOpen)return;

  e.preventDefault();

  if(e.code==='Escape'){
    setInventoryOpen(false);
    return;
  }
  if(e.code==='ArrowLeft'||e.code==='ArrowRight'){
    inventoryColumn=1-inventoryColumn;
    inventoryCursor=0;
    renderInventory();
    return;
  }
  if(e.code==='ArrowUp'){
    inventoryCursor=Math.max(0,inventoryCursor-1);
    renderInventory();
    return;
  }
  if(e.code==='ArrowDown'){
    inventoryCursor=Math.min(Math.max(0,inventoryItemsForColumn().length-1),inventoryCursor+1);
    renderInventory();
    return;
  }
  if(e.code==='Enter'){
    moveInventoryItem();
  }
}, true);

// =====================
// CHEATCODE MENU
// =====================
const cheatMenu=document.getElementById('cheatMenu');
const cheatInput=document.getElementById('cheatInput');
const cheatResult=document.getElementById('cheatResult');
const cheatSequence=['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight'];
let cheatProgress=0;

addEventListener('keydown',e=>{
  if(inventoryOpen)return;
  if(cheatMenu.style.display!=='none'){
    if(e.code==='Escape'){
      cheatMenu.style.display='none';
      cheatInput.blur();
      renderer.domElement.requestPointerLock();
    }
    return;
  }

  if(e.code===cheatSequence[cheatProgress]){
    cheatProgress++;
    if(cheatProgress===cheatSequence.length){
      cheatProgress=0;
      document.exitPointerLock();
      cheatMenu.style.display='block';
      cheatInput.value='';
      cheatResult.textContent='';
      setTimeout(()=>cheatInput.focus(),0);
    }
  }else{
    cheatProgress=(e.code===cheatSequence[0])?1:0;
  }
});

cheatInput.addEventListener('keydown',e=>{
  if(e.code!=='Enter')return;
  const code=cheatInput.value.trim();

  if(code==='Th3P71h0n'){
    addCheatWeapon('python','Python');
    cheatResult.textContent='Python unlocked!';
  }else if(code==='67'){
    addCheatWeapon('67','67');
    cheatResult.textContent='67 unlocked!';
  }else if(code==='Damage1ncr3a23'){
    damageBonus+=20;
    cheatResult.textContent=`Damage bonus: +${damageBonus}`;
  }else{
    cheatResult.textContent='Unknown cheat code.';
  }
  cheatInput.select();
});

// =====================
// CAPPED LOOP
// =====================
const clock=new THREE.Clock();
let lastRender=0;
const FRAME_MS=1000/60;
let paused=false;

document.addEventListener('visibilitychange',()=>{
  paused=document.hidden;
  if(!paused)clock.getDelta();
});

function frame(now){
  requestAnimationFrame(frame);
  if(paused)return;
  if(now-lastRender<FRAME_MS)return;
  const dt=Math.min(clock.getDelta(),.05);
  lastRender=now-(now-lastRender)%FRAME_MS;

  // Spread chunk rebuild cost across frames while placing lots of blocks.
  rebuildDirtyChunks(2);
  if(!dead){
    updatePlayer(dt);
    updateMobs(dt);
    updateProjectiles(dt);
  }
  renderer.render(scene,camera);
}
requestAnimationFrame(frame);

addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});
