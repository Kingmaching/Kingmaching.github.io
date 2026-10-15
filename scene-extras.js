// Extra street life for the 3D scene: more buildings (with doors, driveways, car-park ramps and footpaths),
// a district by the water with a ferry pier and a glass-fenced promenade, boats, a double-decker and a tram,
// road signs, more street lights, birds. Adds to the scene building.js exposes as window.__og.
(function () {
  const og = window.__og;
  if (!og) return;

  const {scene,THREE,mat,toBack}=og;
  const INTRO_CAM=new THREE.Vector3(122.1,18,87.2);   // the opening shot; spacing and the birds are set out from here
  let seed=11;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
  const add=(o,back)=>{if(back)toBack(o);scene.add(o);return o;};
  // 1. more background buildings: copy the nearby blurred blocks into the gaps
  const blocks=[];const wp=new THREE.Vector3();scene.traverse(c=>{if(c.isMesh&&!c.isInstancedMesh&&c.geometry.type==='BoxGeometry'&&c.geometry.parameters.height>8){c.getWorldPosition(wp);const r=Math.hypot(wp.x,wp.z);if(r>40&&r<120){let top=c;while(top.parent&&top.parent!==scene)top=top.parent;if(!blocks.includes(top))blocks.push(top)}}});
  const extra=[], foot=[];   // foot: building footprints {x, z, r, soft, obj}; soft ones give way to real buildings
  const cxz=[INTRO_CAM.x,INTRO_CAM.z],seen=[];
  const fits=(x,z,w)=>{const b=Math.atan2(z-cxz[1],x-cxz[0]),d=Math.hypot(x-cxz[0],z-cxz[1]),h=w*0.75/d;
    if(seen.some(p=>{let dd=Math.abs(b-p.b);if(dd>Math.PI)dd=2*Math.PI-dd;return dd<h+p.h+0.012}))return false;seen.push({b,h});return true};
  const shade=(m,i)=>{const c=m.clone();c.color.multiplyScalar([1,.9,1.08,.95,1.04][i%5]);return c};
  const roofMat=new THREE.MeshStandardMaterial({color:mat.green.color.clone(),roughness:.9});
  for(let i=0,tries=0;i<12&&tries<400;tries++){const src=blocks[i%blocks.length];if(!src||!src.isMesh)break;const g=src.geometry.parameters;
    const a=(150+rnd()*140)*Math.PI/180, r=88+rnd()*45;          // behind the tower as seen from the camera
    const h=g.height*(0.7+rnd()*0.6), w=g.width*(0.8+rnd()*0.4);
    if(!fits(Math.cos(a)*r,Math.sin(a)*r,w))continue;i++;
    const grp=new THREE.Group();const body=new THREE.Mesh(new THREE.BoxGeometry(w,h,w),shade(src.material,i));body.position.y=h/2;
    const roof=new THREE.Mesh(new THREE.BoxGeometry(w*.92,.8,w*.92),roofMat);roof.position.y=h+.4;grp.add(body,roof);
    grp.position.set(Math.cos(a)*r,0,Math.sin(a)*r);grp.rotation.y=rnd()*Math.PI;add(grp,true);extra.push(grp);foot.push({x:grp.position.x,z:grp.position.z,r:w*.75,soft:true,obj:grp})}
  // 2. walkways through the near parks (camera side), each running from one pavement to another, with bushes
  //    along them: two diagonals between the +z and +x avenues' pavements, and a link from the ring's corner
  const walk=mat.walk;   // the scene's own pavement material, so new paving changes with the light like the rest
  const path=(x,z,w,d,rot)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),walk);m.rotation.set(-Math.PI/2,0,rot||0);m.position.set(x,0.045,z);m.receiveShadow=true;return add(m)};
  const pathSegs=[[7,70,70,7],[7,110,110,7],[38.5,38.5,58.5,58.5]];
  const paths=pathSegs.map(([ax,az,bx,bz])=>{const dx=bx-ax,dz=bz-az;return [(ax+bx)/2,(az+bz)/2,3,Math.hypot(dx,dz),Math.atan2(dx,dz)]});
  const segDist=([x,z],[ax,az,bx,bz])=>{const dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));return Math.hypot(x-ax-t*dx,z-az-t*dz)};
  const nearPath=(x,z,m)=>pathSegs.some(sg=>segDist([x,z],sg)<1.5+m);
  paths.forEach(a=>path(...a));
  const bushGeo=new THREE.IcosahedronGeometry(1,0);const bushMats=['#4f8a45','#5d9a4c','#3f7a3f','#6aa451'].map(c=>new THREE.MeshStandardMaterial({color:c,roughness:.9,flatShading:true}));
  let nb=0;paths.forEach(([x,z,w,d,rot])=>{const L=Math.max(w,d),along=d>w;for(let s=-L/2+3;s<L/2;s+=4.2+rnd()*3){for(const side of[-1,1]){if(rnd()<.35)continue;
    const off=(Math.min(w,d)/2+1.4)*side;let lx=along?off:s,lz=along?s:off;const c=Math.cos(-rot),sn=Math.sin(-rot);
    const bx=x+lx*c-lz*sn,bz=z+lx*sn+lz*c;const m=new THREE.Mesh(bushGeo,bushMats[nb++%4]);const k=.7+rnd()*.6;m.scale.set(1.3*k,.9*k,1.2*k);m.position.set(bx,.6*k,bz);m.castShadow=true;add(m)}}});
  // 3. people on the walkways and pavements
  const skin=['#e8c39e','#c99a6e','#8d5a3b','#f1d1b5'];const shirts=['#c8102e','#2b77a1','#f2b705','#46953d','#f5f0e6','#2b2f36','#e0703a','#8e6cc0'];
  const person=(x,z)=>{const g=new THREE.Group();const body=new THREE.Mesh(new THREE.CylinderGeometry(.32,.38,1.15,8),new THREE.MeshStandardMaterial({color:shirts[Math.floor(rnd()*8)]}));body.position.y=1.05;
    const legs=new THREE.Mesh(new THREE.CylinderGeometry(.3,.26,.6,8),new THREE.MeshStandardMaterial({color:'#2b2f36'}));legs.position.y=.3;
    const head=new THREE.Mesh(new THREE.SphereGeometry(.26,10,8),new THREE.MeshStandardMaterial({color:skin[Math.floor(rnd()*4)]}));head.position.y=1.9;
    g.add(body,legs,head);g.traverse(o=>o.castShadow=true);g.position.set(x,0,z);g.scale.setScalar(1.15);return add(g)};
  const walkers=[];   // set moving in section 18
  let np=0;paths.forEach(([x,z,w,d,rot])=>{for(let i=0;i<3;i++){const t=(rnd()-.5)*Math.max(w,d)*.8;const along=d>w;let lx=along?(rnd()-.5)*1.2:t,lz=along?t:(rnd()-.5)*1.2;const c=Math.cos(-rot),sn=Math.sin(-rot);const px=x+lx*c-lz*sn,pz=z+lx*sn+lz*c;walkers.push({g:person(px,pz),px,pz,path:{x,z,len:Math.max(w,d),u:along?[-sn,c]:[c,sn]}});np++}});
  for(let i=0;i<10;i++){const s=-30+rnd()*60;const sideP=rnd()<.5;const px=sideP?s:37.25+(rnd()-.5)*2,pz=sideP?37.25+(rnd()-.5)*2:s;walkers.push({g:person(px,pz),px,pz,pave:sideP?'z':'x'});np++}
  // 4. cars on the near avenues
  const carCols=['#c8102e','#c8102e','#1f8a4c','#f2f2ee','#2b2f36','#3c6fb0','#e9e1c8','#f2b705'];
  const car=(x,z,yaw)=>{const g=new THREE.Group();const col=carCols[Math.floor(rnd()*8)];const body=new THREE.Mesh(new THREE.BoxGeometry(4.2,1.1,1.9),new THREE.MeshStandardMaterial({color:col,roughness:.45,metalness:.3}));body.position.y=.75;
    const cab=new THREE.Mesh(new THREE.BoxGeometry(2.3,.8,1.7),new THREE.MeshStandardMaterial({color:'#9fc3d4',roughness:.2,metalness:.4}));cab.position.set(-.2,1.6,0);g.add(body,cab);g.traverse(o=>o.castShadow=true);g.position.set(x,0,z);g.rotation.y=yaw;return add(g)};
  // (they are created and set driving in section 18)
  // 5. clouds (soft, on the blurred layer) and 6. a few birds in the distance
  const cam=INTRO_CAM.clone();const fwd=new THREE.Vector3(-INTRO_CAM.x,0,-INTRO_CAM.z).normalize();
  const birds=[];const birdMat=new THREE.MeshBasicMaterial({color:0x2b3a40,side:THREE.DoubleSide,fog:false});
  const bird=(yaw,dist,y,s,flap)=>{const d=fwd.clone().applyAxisAngle(new THREE.Vector3(0,1,0),yaw*Math.PI/180);const c=cam.clone().addScaledVector(d,dist);
    const sh=new THREE.Shape();sh.moveTo(-1,0.35*flap);sh.quadraticCurveTo(-.45,.05,0,-.18);sh.quadraticCurveTo(.45,.05,1,.35*flap);sh.quadraticCurveTo(.45,-.05,0,-.32);sh.quadraticCurveTo(-.45,-.05,-1,.35*flap);
    const m=new THREE.Mesh(new THREE.ShapeGeometry(sh),birdMat);m.scale.setScalar(s);m.position.set(c.x,y,c.z);m.lookAt(cam);birds.push({m,s,p0:m.position.clone(),ph:rnd()*6});add(m)};
  [[3,170,62,1.0,1],[4.2,175,64.5,.9,.6],[2.2,168,65.5,.85,1.1],[5.1,180,61.5,.8,.8],[1.4,172,60.8,.75,.5],[-9,200,72,.8,1],[-8.2,205,73.8,.7,.7]].forEach(a=>bird(...a));

  // 7. thin out the trees (every instanced tree has a trunk and a canopy at the same index)
  const inst=[];scene.traverse(o=>{if(o.isInstancedMesh&&(o.geometry.type==='IcosahedronGeometry'||o.geometry.type==='CylinderGeometry')&&o.count>40)inst.push(o)});
  const n=Math.min(...inst.map(o=>o.count));const zero=new THREE.Matrix4().makeScale(0,0,0);let removed=0;
  for(let i=0;i<n;i++){if(rnd()<0.45){inst.forEach(o=>o.setMatrixAt(i,zero));removed++}}inst.forEach(o=>o.instanceMatrix.needsUpdate=true);
  // 8. the water carries on behind the name (world angles ~120°-190°), with a distant row of buildings across it
  const water=[];scene.traverse(o=>{if(o.isMesh&&o.geometry.type==='RingGeometry')water.push(o)});
  const wm=water[0];const a0=120*Math.PI/180,a1=190*Math.PI/180;
  const extMat=wm.material.clone();extMat.color.set('#86c3d9');extMat.metalness=0.1;extMat.roughness=0.35;const ext=new THREE.Mesh(new THREE.RingGeometry(120,330,48,1,-a1,a1-a0),extMat);ext.rotation.copy(wm.rotation);ext.position.copy(wm.position);ext.position.y=0.065;ext.receiveShadow=true;add(ext);
  const sky=new THREE.Color('#8fa9b6');
  const hazeList=[];const hazeMat=(base,k)=>{const m=base.clone();m.color.lerp(sky,k);m.emissive=sky.clone().multiplyScalar(k*0.45);m.emissiveMap=null;m.emissiveIntensity=1;m.needsUpdate=true;hazeList.push(m);return m};
  const farMat=hazeMat(blocks[0].material,0.7), farRoof=hazeMat(roofMat,0.7);
  for(let i=0,tries=0;i<14&&tries<400;tries++){const a=(122+rnd()*68)*Math.PI/180, r=345+rnd()*80;const w=10+rnd()*12,h=30+rnd()*70;
    if(!fits(Math.cos(a)*r,Math.sin(a)*r,w))continue;i++;
    const g=new THREE.Group();const body=new THREE.Mesh(new THREE.BoxGeometry(w,h,w),shade(farMat,i));body.position.y=h/2;
    const roof=new THREE.Mesh(new THREE.BoxGeometry(w*.92,1,w*.92),farRoof);roof.position.y=h+.5;g.add(body,roof);
    g.position.set(Math.cos(a)*r,0,Math.sin(a)*r);g.rotation.y=rnd()*Math.PI;add(g,true)}
  // 9. push the other blocks back into the haze so they don't merge with the tower
  const hazed=new Set();[...blocks,...extra].forEach(top=>top.traverse(o=>{if(o.isMesh&&!hazed.has(o)){o.material=hazeMat(o.material,0.45);hazed.add(o)}}));

  // window texture: a grid of panes, tinted by each material's colour
  const wc=document.createElement('canvas');wc.width=wc.height=64;const wx=wc.getContext('2d');wx.fillStyle='#ffffff';wx.fillRect(0,0,64,64);
  wx.fillStyle='#7c929c';for(const [x,y] of [[6,8],[36,8],[6,40],[36,40]])wx.fillRect(x,y,22,16);
  const winTex=(w,h)=>{const t=new THREE.CanvasTexture(wc);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(Math.max(1,Math.round(w/3.2)),Math.max(1,Math.round(h/3.4)));t.anisotropy=4;return t};
  const sc=document.createElement('canvas');sc.width=sc.height=64;const sx=sc.getContext('2d');sx.fillStyle='#ffffff';sx.fillRect(0,0,64,64);sx.fillStyle='#6f8590';sx.fillRect(4,10,56,48);sx.fillStyle='#ffffff';sx.fillRect(31,10,2,48);
  const shopMat=(color,w,k)=>{const m=hazeMat(new THREE.MeshStandardMaterial({color,roughness:.7}),k);const t=new THREE.CanvasTexture(sc);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(Math.max(2,Math.round(w/5)),1);t.anisotropy=4;m.map=t;m.needsUpdate=true;return m};
  const winMat=(color,w,h,k)=>{const m=hazeMat(new THREE.MeshStandardMaterial({color,roughness:.7}),k);m.map=winTex(w,h);m.needsUpdate=true;return m};
  // rooftop clutter: water tanks, AC units, a mast
  const tankMat=new THREE.MeshStandardMaterial({color:'#b9c2c4',roughness:.6}),acMat=new THREE.MeshStandardMaterial({color:'#d7dcdc',roughness:.6});
  const rooftop=(g,y,w)=>{const n=1+Math.floor(rnd()*3);for(let i=0;i<n;i++){const t=new THREE.Mesh(new THREE.CylinderGeometry(.9,.9,1.6,10),tankMat);t.position.set((rnd()-.5)*w*.6,y+.8,(rnd()-.5)*w*.6);g.add(t)}
    for(let i=0;i<3;i++){const ac=new THREE.Mesh(new THREE.BoxGeometry(1.4,.7,1),acMat);ac.position.set((rnd()-.5)*w*.7,y+.35,(rnd()-.5)*w*.7);g.add(ac)}
    if(rnd()<.4){const mast=new THREE.Mesh(new THREE.CylinderGeometry(.08,.12,4,6),tankMat);mast.position.set(w*.3,y+2,-w*.3);g.add(mast)}};
  // 10. buildings on both sides from one maker: mixed shapes, a front door facing the nearest road, a driveway
  //     to it, an underground car-park ramp beside the driveway, and a footpath down one side.
  const roadMat=mat.road;   // likewise the road material (where pieces meet or overlap, they never flicker)
  const flatOn=(w,d,m,x,z,y,rot)=>{const p=new THREE.Mesh(new THREE.PlaneGeometry(w,d),m);p.rotation.set(-Math.PI/2,0,rot||0);p.position.set(x,y,z);p.receiveShadow=true;return add(p)};
  // local streets through the district (so driveways have somewhere to go)
  flatOn(96,7,roadMat,-52,62,0.05);            // z = 62, from the avenue (x = 0) out to x = -100
  flatOn(7,54.5,roadMat,-60,31.25,0.05);       // x = -60, from the -x avenue's edge (z = 4) to the z = 62 street's (z = 58.5)
  flatOn(23,8,roadMat,-96.5,0,0.05);                    // the -x avenue carries on to the waterfront...
  for(const [cx,cz] of [[-106,0],[0,-79]]){const t=new THREE.Mesh(new THREE.CircleGeometry(7.5,32),roadMat);t.rotation.x=-Math.PI/2;t.position.set(cx,0.051,cz);t.receiveShadow=true;add(t)}   // ...and both harbour roads end in a turning circle
  for(const sd of[-1,1]){flatOn(2.5,215,walk,sd*5.75,142.5,0.046);flatOn(215,2.5,walk,142.5,sd*5.75,0.046)}   // pavements along the long avenues,
  for(const sd of[-1,1]){flatOn(71,2.5,walk,-70.5,sd*5.75,0.046);flatOn(2.5,44,walk,sd*5.75,-57,0.046)}            // the harbour roads,
  for(const sd of[-1,1]){flatOn(96,2.5,walk,-52,62+sd*4.75,0.046);flatOn(2.5,51,walk,-60+sd*4.75,32.5,0.046)}      // and the district streets
  const segs=[[[0,35],[0,250]],[[-31,-35],[-31,35]],[[31,-35],[31,35]],[[-35,31],[35,31]],[[-35,-31],[35,-31]],
              [[-106,0],[-35,0]],[[35,0],[250,0]],[[0,-79],[0,-35]],[[-100,62],[-4,62]],[[-60,0],[-60,62]]];
  // roads as rectangles [x0, x1, z0, z1] (with pavements and turning circles), for keeping buildings off them
  const roadRects=[[-7,7,35,250],[35,250,-7,7],[-113.5,-35,-5,5],[-5,5,-86.5,-35],[-102,-2,58.5,65.5],[-63.5,-56.5,-4,66]];
  const clearRoads=(x,z,h)=>{for(let it=0;it<3;it++)for(const [x0,x1,z0,z1] of roadRects){if(x+h<=x0||x-h>=x1||z+h<=z0||z-h>=z1)continue;
      const opts=[[x0-h-x,0],[x1+h-x,0],[0,z0-h-z],[0,z1+h-z]].sort((a,b)=>Math.hypot(...a)-Math.hypot(...b));x+=opts[0][0];z+=opts[0][1]}return [x,z]};
  const segHW=segs.map((_,i)=>i>=8?3.5:4);   // half-widths: the two district streets are narrower than the rest
  const nearestRoad=(x,z)=>{let best=null;segs.forEach(([[ax,az],[bx,bz]],i)=>{const dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));
      const px=ax+t*dx,pz=az+t*dz,d=Math.hypot(x-px,z-pz);if(!best||d<best.d)best={px,pz,d,hw:segHW[i]}});return best};
  const doorMat=new THREE.MeshStandardMaterial({color:'#2b3439',roughness:.25,metalness:.4}),slabMat=new THREE.MeshStandardMaterial({color:'#e6e8e6',roughness:.7});
  const rampMat=new THREE.MeshStandardMaterial({color:'#262b2e',roughness:.9}),kerbMat=new THREE.MeshStandardMaterial({color:'#c9cdcc',roughness:.8});
  const plots=[];
  // a plot's ground rectangles (building, driveway, door footpath) as world corners, and an overlap test
  const rectsOf=pl=>{const c=Math.cos(pl.rot),s=Math.sin(pl.rot),r=(lx0,lx1,lz0,lz1)=>[[lx0,lz0],[lx1,lz0],[lx1,lz1],[lx0,lz1]].map(([lx,lz])=>[pl.x+lx*c+lz*s,pl.z-lx*s+lz*c]);
    const h=pl.pw/2,dx=pl.sg*pl.pw*.2,fx=-pl.sg*pl.pw*.28;return [r(-h-1,h+1,-h-1,h+1),r(dx-2.2,dx+2.2,h,h+pl.L),r(fx-1.1,fx+1.1,h,h+pl.L)]};
  const sat=(A,B)=>{for(const P of [A,B])for(let i=0;i<4;i++){const [x1,z1]=P[i],[x2,z2]=P[(i+1)%4],nx=z2-z1,nz=x1-x2;const pa=A.map(([x,z])=>x*nx+z*nz),pb=B.map(([x,z])=>x*nx+z*nz);
      if(Math.max(...pa)<=Math.min(...pb)||Math.max(...pb)<=Math.min(...pa))return false}return true};
  const makeBuilding=(x,z,kind,col,haze,hHint)=>{
    const pw=kind==='box'?10+rnd()*6:10+rnd()*5;
    // never on a road (room for a driveway and ramp), never on another building: firm ones push this one
    // away, background fillers make way
    for(let it=0;it<8;it++){[x,z]=clearRoads(x,z,pw/2+9);const hit=foot.find(f=>Math.hypot(x-f.x,z-f.z)<f.r+pw*.75+3);if(!hit)break;
      if(hit.soft){hit.obj.visible=false;foot.splice(foot.indexOf(hit),1);continue}
      const d=Math.hypot(x-hit.x,z-hit.z)||1,need=hit.r+pw*.75+3.5-d;x+=(x-hit.x)/d*need;z+=(z-hit.z)/d*need}
    if(foot.some(f=>!f.soft&&Math.hypot(x-f.x,z-f.z)<f.r+pw*.75+3))return;   // no room: leave it out
    const road=nearestRoad(x,z);const rot=Math.atan2(road.px-x,road.pz-z);   // local +z faces the road
    // Lay out the plot: driveway on one side of the face, the door's footpath on the other. The driveway is
    // long enough to reach a road; the layout is mirrored if it would run into a neighbour, and the building
    // left out if neither way fits.
    const lay=sg=>{const c=Math.cos(rot),s=Math.sin(rot),dxw=sg*pw*.2;let L=Math.max(8,road.d-pw/2-3.4);
      let reached=false;for(let k=0;k<28&&!reached;k++){const ex=x+dxw*c+(pw/2+L)*s,ez=z-dxw*s+(pw/2+L)*c;const nr=nearestRoad(ex,ez);reached=nr.d<nr.hw-.5;if(!reached)L+=.5}   // the driveway ends on the road itself, not on the pavement
      if(!reached)return null;const pl={x,z,rot,pw,L,sg};return rectsOf(pl).some(A=>plots.some(o=>rectsOf(o).some(B=>sat(A,B))))?null:pl};
    const plot=lay(1)||lay(-1);if(!plot)return;
    foot.push({x,z,r:pw*.75});
    const g=new THREE.Group();let top=0,topW=0;
    const part=(geo,w,h,y)=>{const m=new THREE.Mesh(geo,winMat(col,w,h,haze));m.position.y=y;g.add(m)};
    if(kind==='box'){const h=hHint||14+rnd()*20;part(new THREE.BoxGeometry(pw,h,pw),pw,h,h/2);top=h;topW=pw}
    else{const ph=4+rnd()*2.5;const base=new THREE.Mesh(new THREE.BoxGeometry(pw,ph,pw),shopMat(col,pw,haze));base.position.y=ph/2;g.add(base);top=ph;
      if(kind==='podium'){const tw=pw*.6,th=(hHint||26)-ph+rnd()*8;part(new THREE.BoxGeometry(tw,th,tw),tw,th,top+th/2);top+=th;topW=tw}
      else if(kind==='slim'){const tw=pw*.42,th=26+rnd()*14;part(new THREE.BoxGeometry(tw,th,tw),tw,th,top+th/2);top+=th;topW=tw}
      else if(kind==='stepped'){const t1=pw*.7,h1=10+rnd()*6,t2=pw*.45,h2=8+rnd()*6;part(new THREE.BoxGeometry(t1,h1,t1),t1,h1,top+h1/2);part(new THREE.BoxGeometry(t2,h2,t2),t2,h2,top+h1+h2/2);top+=h1+h2;topW=t2}
      else{const rr=pw*.32,th=18+rnd()*12;part(new THREE.CylinderGeometry(rr,rr,th,24),2*Math.PI*rr,th,top+th/2);top+=th;topW=rr*1.4}}
    const roof=new THREE.Mesh(new THREE.BoxGeometry(topW*.9,.5,topW*.9),hazeMat(roofMat,haze));roof.position.y=top+.25;g.add(roof);rooftop(g,top+.5,topW);
    // front door with a canopy
    const doorX=-plot.sg*pw*.28;
    const door=new THREE.Mesh(new THREE.BoxGeometry(2.6,2.7,.15),doorMat);door.position.set(doorX,1.35,pw/2+.05);
    const can=new THREE.Mesh(new THREE.BoxGeometry(4.2,.25,1.8),slabMat);can.position.set(doorX,3,pw/2+.9);g.add(door,can);
    g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});
    g.position.set(x,0,z);g.rotation.y=rot;add(g);
    // ground pieces, laid out in the building's frame: the driveway runs from the road straight into the car-park
    // ramp at the building's face; the door has its own footpath out to the pavement
    const L=plot.L, c=Math.cos(rot), s=Math.sin(rot), dxw=plot.sg*pw*.2, rampL=Math.min(6,L-2);
    const at=(lx,lz)=>[x+lx*c+lz*s, z-lx*s+lz*c];
    let [dx,dz]=at(dxw,pw/2+L/2);flatOn(4.4,L,roadMat,dx,dz,0.048,rot);                               // driveway
    [dx,dz]=at(dxw,pw/2+rampL/2);flatOn(3.4,rampL,rampMat,dx,dz,0.07,rot);                           // ramp mouth, at the end of the driveway
    for(const side of[-1,1]){const k=new THREE.Mesh(new THREE.BoxGeometry(.3,.7,rampL),kerbMat);const [kx,kz]=at(dxw+side*1.85,pw/2+rampL/2);k.position.set(kx,.35,kz);k.rotation.y=rot;add(k)}
    [dx,dz]=at(doorX,pw/2+L/2);flatOn(2.2,L,walk,dx,dz,0.047,rot);                                     // the door's footpath to the pavement
    plots.push(plot);
  };
  // replace the plain blocks beside the tower (and their roof slabs) with the mixed ones
  const old=[];scene.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh&&o.geometry.type==='BoxGeometry'&&o.parent===scene){const g=o.geometry.parameters;const r=Math.hypot(o.position.x,o.position.z);if(r>45&&r<100&&(g.height>8||(g.height<1&&g.width>7)))old.push(o)}});
  const kinds=['box','podium','stepped','box','round','slim','podium','box','stepped'];let kk=0;
  old.filter(o=>o.geometry.parameters.height>8).forEach(o=>{makeBuilding(o.position.x,o.position.z,kinds[kk++%kinds.length],'#'+['c9d3d6','d3cfc8','c7d2d0','cfd2d8'][kk%4],.45,o.geometry.parameters.height)});
  old.forEach(o=>o.visible=false);
  // the district: an even grid between the avenue, the local streets and the water
  const tints=['#c9d3d6','#d8cfc4','#c4d2cc','#d6d0d8','#cfd8dd'];let nd=0;
  for(let gx=-104;gx<=-22;gx+=24)for(let gz=22;gz<=106;gz+=24){const x=gx+(rnd()-.5)*5,z=gz+(rnd()-.5)*5,r=Math.hypot(x,z);
    if(r>114||(Math.abs(x)<46&&Math.abs(z)<46)||Math.abs(z-62)<12||(Math.abs(x+60)<12&&z<70))continue;
    makeBuilding(x,z,kinds[(nd+2)%kinds.length],tints[nd%5],.2);nd++}
  // keep trees, bushes and people off the plots, driveways and footpaths
  const inPlot=(px,pz,m)=>plots.some(({x,z,rot,pw,L})=>{const dx=px-x,dz=pz-z,c=Math.cos(rot),s=Math.sin(rot);const lx=dx*c-dz*s,lz=dx*s+dz*c;
      return Math.abs(lx)<pw/2+m+3&&lz>-pw/2-m&&lz<pw/2+L+m});
  const zeroM=new THREE.Matrix4().makeScale(0,0,0),tm=new THREE.Matrix4(),tp=new THREE.Vector3();let cleared=0;
  for(let i=0;i<n;i++){inst[0].getMatrixAt(i,tm);tp.setFromMatrixPosition(tm);if(inPlot(tp.x,tp.z,4)){inst.forEach(o=>o.setMatrixAt(i,zeroM));cleared++}}
  inst.forEach(o=>o.instanceMatrix.needsUpdate=true);
  scene.children.forEach(o=>{if((o.isMesh&&!o.isInstancedMesh&&o.geometry.type==='IcosahedronGeometry'&&o.position.y<2)||(o.isGroup&&o.children.length===3&&o.children[2].geometry&&o.children[2].geometry.type==='SphereGeometry')){if(inPlot(o.position.x,o.position.z,1))o.visible=false}});
  // 11. boats on the harbour: a Star Ferry and a few small craft, each with a pale wake
  const hull=(len,wid,col)=>new THREE.Mesh(new THREE.BoxGeometry(len,1.1,wid),new THREE.MeshStandardMaterial({color:col,roughness:.6}));
  const wakeMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.45,depthWrite:false});
  const boat=(deg,r,yaw,kind)=>{const g=new THREE.Group();
    if(kind==='ferry'){const h=hull(14,4.2,'#2f6b3f');h.position.y=.55;const white=new THREE.MeshStandardMaterial({color:'#f2f2ee'});const d1=new THREE.Mesh(new THREE.BoxGeometry(12,1.6,3.8),white);d1.position.y=1.9;
      const d2=new THREE.Mesh(new THREE.BoxGeometry(8,1.2,3.4),white);d2.position.y=3.3;const band=new THREE.Mesh(new THREE.BoxGeometry(12.1,.35,3.9),new THREE.MeshStandardMaterial({color:'#2f6b3f'}));band.position.y=2.75;g.add(h,d1,d2,band)}
    else{const h=hull(5+rnd()*3,1.8,kind);h.position.y=.5;const cab=new THREE.Mesh(new THREE.BoxGeometry(2,1,1.4),new THREE.MeshStandardMaterial({color:'#f5f5f2'}));cab.position.set(-.6,1.5,0);g.add(h,cab)}
    const wake=new THREE.Mesh(new THREE.PlaneGeometry(kind==='ferry'?22:10,kind==='ferry'?5:2.4),wakeMat);wake.rotation.x=-Math.PI/2;wake.position.set(kind==='ferry'?-17:-7,.08,0);g.add(wake);
    g.traverse(o=>{if(o.isMesh&&o!==wake)o.castShadow=true});const a=deg*Math.PI/180;g.position.set(Math.cos(a)*r,.06,Math.sin(a)*r);g.rotation.y=yaw;return add(g)};
  const boats=[[215,170,10,'#f2f2ee'],[235,132,12,'#c8102e'],[190,205,-6,'#f2f2ee'],[160,190,14,'#2b77a1']].map(([r,a0,w,col])=>({g:boat(a0,r,0,col),r,a0,w,ph:rnd()*6}));
  // 12. a Hong Kong double-decker on the avenue to the tower, and a tram on the other avenue
  const deck=(col,len,wid,hgt)=>{const g=new THREE.Group();const b=new THREE.Mesh(new THREE.BoxGeometry(len,hgt,wid),new THREE.MeshStandardMaterial({color:col,roughness:.5}));b.position.y=hgt/2+.35;
    const glass=new THREE.MeshStandardMaterial({color:'#2e3a40',roughness:.2,metalness:.4});[hgt*.35,hgt*.8].forEach(y=>{const w=new THREE.Mesh(new THREE.BoxGeometry(len*.94,hgt*.2,wid*1.01),glass);w.position.y=y+.35;g.add(w)});g.add(b);g.traverse(o=>o.castShadow=true);return g};
  const bus=deck('#c8102e',11,2.5,4.2);const cream=new THREE.Mesh(new THREE.BoxGeometry(11.05,.6,2.55),new THREE.MeshStandardMaterial({color:'#f2ead6'}));cream.position.y=2.4;bus.add(cream);
  add(bus);
  const tram=deck('#1f7a4c',9,2.3,4);const pole=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,2.4,6),new THREE.MeshStandardMaterial({color:'#333'}));pole.position.y=5.4;pole.rotation.z=.5;tram.add(pole);
  add(tram);

  // 13. a ferry pier at the end of the street that runs to the water, with the Star Ferry alongside
  const deckMat=new THREE.MeshStandardMaterial({color:'#d9d6cc',roughness:.85}),pierWhite=new THREE.MeshStandardMaterial({color:'#f1efe8',roughness:.7}),pierRoof=new THREE.MeshStandardMaterial({color:'#2f6b3f',roughness:.7});
  const pierG=new THREE.Group();const pDeck=new THREE.Mesh(new THREE.BoxGeometry(30,1,10),deckMat);pDeck.position.set(-15,.5,0);pierG.add(pDeck);
  const hall=new THREE.Mesh(new THREE.BoxGeometry(12,5,8),pierWhite);hall.position.set(-12,3.5,0);
  const hroof=new THREE.Mesh(new THREE.CylinderGeometry(4.6,4.6,12.6,4,1,false,Math.PI/4),pierRoof);hroof.rotation.z=Math.PI/2;hroof.scale.set(1,1,.6);hroof.position.set(-12,6.4,0);
  const clock=new THREE.Mesh(new THREE.BoxGeometry(2.2,9,2.2),pierWhite);clock.position.set(-3,5.5,3);const face=new THREE.Mesh(new THREE.CylinderGeometry(.75,.75,.1,16),new THREE.MeshBasicMaterial({color:'#2b2f36'}));face.rotation.x=Math.PI/2;face.position.set(-3,8.6,4.12);
  pierG.add(hall,hroof,clock,face);pierG.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});pierG.position.set(-100,0,62);add(pierG);
  const ferry=boat(147.5,128,0,'ferry');
  // 14. a promenade with a glass fence along the water's edge
  const promMat=new THREE.MeshStandardMaterial({color:'#d8d6cd',roughness:.9,side:THREE.DoubleSide});
  const glass=new THREE.MeshStandardMaterial({color:'#bfe3ee',transparent:true,opacity:.38,roughness:.1,metalness:.2,side:THREE.DoubleSide,depthWrite:false});
  const rail=new THREE.MeshStandardMaterial({color:'#5d676b',roughness:.4,metalness:.6});
  const arcRing=(r0,r1,a0,a1,m,y)=>{const g=new THREE.RingGeometry(r0,r1,64,1,-a1,a1-a0);const me=new THREE.Mesh(g,m);me.rotation.x=-Math.PI/2;me.position.y=y;me.receiveShadow=true;return add(me)};
  const fence=(r,a0,a1)=>{const th0=Math.PI/2-a1,len=a1-a0;
    const pane=new THREE.Mesh(new THREE.CylinderGeometry(r,r,1.1,96,1,true,th0,len),glass);pane.position.y=.6;add(pane);
    const top=new THREE.Mesh(new THREE.CylinderGeometry(r+.05,r+.05,.1,96,1,true,th0,len),rail);top.position.y=1.18;add(top);
    for(let t=a0;t<=a1;t+=2.2/r){const post=new THREE.Mesh(new THREE.BoxGeometry(.12,1.2,.12),rail);post.position.set(Math.cos(t)*r,.6,Math.sin(t)*r);add(post)}};
  const d2r=Math.PI/180, pierA=Math.atan2(62,-100), gap=6/118;
  arcRing(114,120,120*d2r,186*d2r,promMat,.055);fence(119.6,120*d2r,pierA-gap);fence(119.6,pierA+gap,186*d2r);      // the district's waterfront
  arcRing(86,92,186*d2r,347*d2r,promMat,.055);fence(91.6,186*d2r,347*d2r);                                            // behind the tower

  // 15. street lights: thin out the ring road round the tower, add them along the other roads
  scene.traverse(o=>{if(!o.isInstancedMesh)return;const g=o.geometry.parameters||{};
    const isLamp=(o.geometry.type==='CylinderGeometry'&&g.radiusTop===0.1&&g.height===6)||(o.geometry.type==='BoxGeometry'&&g.width===1&&g.height===0.22)||(o.geometry.type==='PlaneGeometry'&&g.width===12);
    if(!isLamp)return;const z0=new THREE.Matrix4().makeScale(0,0,0);for(let i=0;i<o.count;i++)if(i%8>=4)o.setMatrixAt(i,z0);o.instanceMatrix.needsUpdate=true});
  const postMat=new THREE.MeshStandardMaterial({color:mat.mullion.color.clone(),roughness:.5,metalness:.4}),headMat=new THREE.MeshBasicMaterial({color:'#9aa3a8'});
  const lamp=(x,z,dx,dz)=>{const g=new THREE.Group();const post=new THREE.Mesh(new THREE.CylinderGeometry(.1,.14,6,6),postMat);post.position.y=3;
    const arm=new THREE.Mesh(new THREE.BoxGeometry(1.4,.08,.08),postMat);arm.position.set(.6,5.95,0);const head=new THREE.Mesh(new THREE.BoxGeometry(1,.22,.55),headMat);head.position.set(1.2,5.9,0);
    g.add(post,arm,head);g.traverse(o=>o.castShadow=true);g.position.set(x,0,z);g.rotation.y=Math.atan2(-dz,dx);add(g)};
  const lampRow=(ax,az,bx,bz,step)=>{const len=Math.hypot(bx-ax,bz-az),ux=(bx-ax)/len,uz=(bz-az)/len,nx=-uz,nz=ux;
    for(let t=4,k=0;t<len;t+=step,k++){const side=k%2?1:-1;const x=ax+ux*t+nx*5.4*side,z=az+uz*t+nz*5.4*side;if(!inPlot(x,z,0))lamp(x,z,-nx*side,-nz*side)}};
  lampRow(0,38,0,240,14);lampRow(38,0,240,0,14);lampRow(-4,62,-98,62,14);lampRow(-60,4,-60,56,14);lampRow(-38,0,-60,0,11);lampRow(0,-38,0,-60,11);
  // 16. road signs: green direction boards, no-entry and keep-left signs
  const signTex=(lines,bg)=>{const c=document.createElement('canvas');c.width=256;c.height=128;const x=c.getContext('2d');x.fillStyle=bg;x.fillRect(0,0,256,128);x.strokeStyle='#fff';x.lineWidth=5;x.strokeRect(6,6,244,116);
    x.fillStyle='#fff';x.font='bold 30px sans-serif';lines.forEach((l,i)=>x.fillText(l,20,48+i*44));const t=new THREE.CanvasTexture(c);t.anisotropy=4;return t};
  const board=(x,z,yaw,lines)=>{const g=new THREE.Group();const m=new THREE.MeshStandardMaterial({map:signTex(lines,'#1f6b3a'),roughness:.6});
    const pnl=new THREE.Mesh(new THREE.BoxGeometry(4.2,2.1,.12),[postMat,postMat,postMat,postMat,m,postMat]);pnl.position.y=4.6;g.add(pnl);
    for(const sx of[-1.6,1.6]){const p=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,5.6,6),postMat);p.position.set(sx,2.8,-.1);g.add(p)}
    g.traverse(o=>o.castShadow=true);g.position.set(x,0,z);g.rotation.y=yaw;add(g)};
  const disc=(x,z,yaw,kind)=>{const c=document.createElement('canvas');c.width=c.height=64;const q=c.getContext('2d');
    if(kind==='noentry'){q.fillStyle='#d21f26';q.beginPath();q.arc(32,32,30,0,7);q.fill();q.fillStyle='#fff';q.fillRect(12,27,40,10)}
    else{q.fillStyle='#1f5fb4';q.beginPath();q.arc(32,32,30,0,7);q.fill();q.strokeStyle='#fff';q.lineWidth=6;q.beginPath();q.moveTo(40,16);q.lineTo(24,40);q.stroke();q.beginPath();q.moveTo(20,30);q.lineTo(24,44);q.lineTo(36,40);q.stroke()}
    const t=new THREE.CanvasTexture(c);const g=new THREE.Group();const face=new THREE.Mesh(new THREE.CircleGeometry(.55,24),new THREE.MeshStandardMaterial({map:t,transparent:true,side:THREE.DoubleSide}));face.position.y=2.6;
    const p=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,2.6,6),postMat);p.position.y=1.3;g.add(face,p);g.position.set(x,0,z);g.rotation.y=yaw;add(g)};
  board(6.5,92,0,['Central  ->','Ferry Pier  <-']);board(92,6.5,Math.PI/2,['Kowloon  ->','Tower Plaza ^']);board(-8,68,0,['Pier Rd  ->']);
  disc(-6,40,0,'keepleft');disc(40,-6,Math.PI/2,'keepleft');disc(-55,58,Math.PI/2,'noentry');disc(6,40,0,'noentry');

  // 17. fewer bins (keep one in three), and no bushes standing on pavement or road
  let bi=0,binsHidden=0;scene.traverse(o=>{if(o.isMesh&&o.geometry.type==='CylinderGeometry'&&o.geometry.parameters.radiusTop===0.38){if(bi++%3!==0){o.visible=false;binsHidden++}}});
  const paved=(x,z)=>{const ax=Math.abs(x),az=Math.abs(z);
    if(ax<29&&az<29)return true;                                                     // apron round the tower
    if(ax<40.5&&az<40.5&&(ax>26||az>26))return true;                                 // ring road and its pavements
    if((ax<7.5&&az<250)||(az<7.5&&ax<250))return true;                               // avenues and their pavements
    if((x<-35&&x>-114&&az<7.5)||(z<-35&&z>-87&&ax<7.5))return true;                 // harbour roads and turning circles
    if(Math.abs(z-62)<6.5&&x<0&&x>-102)return true;if(Math.abs(x+60)<6.5&&z>0&&z<66)return true;   // district streets
    return false};
  for(let i=0;i<n;i++){inst[0].getMatrixAt(i,tm);tp.setFromMatrixPosition(tm);if(paved(tp.x,tp.z)||nearPath(tp.x,tp.z,1.5)){inst.forEach(o=>o.setMatrixAt(i,zeroM))}}inst.forEach(o=>o.instanceMatrix.needsUpdate=true);   // no trees on the new roads either
  let bushesHidden=0;scene.children.forEach(o=>{if(o.isMesh&&!o.isInstancedMesh&&o.geometry.type==='IcosahedronGeometry'&&o.position.y<2&&o.visible&&paved(o.position.x,o.position.z)){o.visible=false;bushesHidden++}});
  // 18. motion, driven by scroll progress like the rest of the street life (it waits when the page does):
  //     cars drive their routes and then off down the long avenues, people walk their paths and pavements and
  //     then away, boats cross the harbour, the ferry pulls away from the pier, the birds fly off. Each leaves
  //     at its own point in the story, so the streets empty as you scroll; anything gone is hidden.
  const FAR=245, Q0=-2;
  const route=(...pts)=>{const sg=[];let L=0;for(let i=1;i<pts.length;i++){const [ax,az]=pts[i-1],[bx,bz]=pts[i],len=Math.hypot(bx-ax,bz-az);sg.push({ax,az,bx,bz,len,at:L});L+=len}return {sg,L}};
  const along=(r,d)=>{if(d>=r.L)return null;d=Math.max(0,d);let k=0;while(k<r.sg.length-1&&d>r.sg[k].at+r.sg[k].len)k++;const g=r.sg[k],t=(d-g.at)/g.len;
    return {x:g.ax+(g.bx-g.ax)*t,z:g.az+(g.bz-g.az)*t,yaw:Math.atan2(-(g.bz-g.az),g.bx-g.ax)}};
  const movers=[];   // {obj, r, d0, v, q0, hold, bob, keep}: from scroll q0 it is d0 + v·(q − q0) along route r
  const drive=(obj,r,d0,v,o={})=>{movers.push({obj,r,d0,v,q0:o.q0??Q0,hold:!!o.hold,bob:!!o.bob,keep:obj.visible})};
  // routes (traffic keeps left, as in Hong Kong): out along an avenue, or in along one, round the ring and out the other
  const OUT_Z=route([1.8,33],[1.8,FAR]), OUT_X=route([33,-1.8],[FAR,-1.8]);
  const IN_Z=route([-1.8,FAR],[-1.8,32.8],[32.8,32.8],[32.8,-1.8],[FAR,-1.8]), IN_X=route([FAR,1.8],[29.2,1.8],[29.2,29.2],[1.8,29.2],[1.8,FAR]);
  // Speeds are metres per scroll step. Vehicles 40-80, people 14-18, so nobody walks faster than the traffic.
  // A few vehicles are about at the start and drive off, most of them before Project 2.1 (q = 0); the bus and
  // tram too. Each one's speed comes from when it should leave, kept between 40 and 80.
  const leaveBy=(obj,r,d0,ql)=>drive(obj,r,d0,Math.min(80,Math.max(40,(r.L-d0)/(ql-Q0))));
  [[OUT_Z,96-33,-1.0],[OUT_Z,62-33,-.6],[IN_Z,380,-.6],[OUT_X,50-33,-.8]].forEach(([r,d0,ql])=>leaveBy(car(0,0,0),r,d0,ql));   // the IN_Z car is already round the ring
  leaveBy(bus,OUT_Z,72-33,-.4); leaveBy(tram,OUT_X,78-33,-.6);
  // People. Half are about at the start and walk away, most of them gone by Project 2.1: along their park
  // path to its far end, across to the nearest avenue and down its pavement; or along the ring's pavement to
  // the avenue and down it. The other half arrive after Project 2.1 starts, walking in from down an avenue to
  // their spot, and stay there.
  const WALK_FAR=120, ARRIVE_FROM=100;
  const aveOf=(x,z)=>x<z?'z':'x';                       // the nearer long avenue (+z or +x) from the park quadrant
  const onAve=(ave,x,z)=>ave==='z'?[x<0?-5.6:5.6,z]:[x,z<0?-5.6:5.6];
  let turn=0;
  const walkOut=(w,far)=>{if(w.path){const {x,z,len,u}=w.path,e1=[x+u[0]*len/2,z+u[1]*len/2],e2=[x-u[0]*len/2,z-u[1]*len/2];const e=Math.hypot(...e1)>Math.hypot(...e2)?e1:e2;
      const pts=[[w.px,w.pz],e];let end=e;
      if(Math.min(Math.abs(e[0]),Math.abs(e[1]))>8){const sg=pathSegs.find(sg=>segDist(e,sg)<1&&Math.hypot(sg[0]-sg[2],sg[1]-sg[3])>len+1);   // a link path: carry on along the path it joins
        if(sg){end=turn++%2?[sg[0],sg[1]]:[sg[2],sg[3]];pts.push(end)}}
      const ave=aveOf(...end),a=onAve(ave,...end),out=ave==='z'?[a[0],far]:[far,a[1]];return [...pts,a,out]}
    const ave=w.pave,a=onAve(ave,w.px,w.pz),end=ave==='z'?[a[0],far]:[far,a[1]];return [[w.px,w.pz],a,end]};
  const outLeave=[-1.8,-1.7,-1.6,-1.5,-1.4,-1.3,-1.2,-1.0,-.8,-.6,1.5,3.0,4.5], inAt=[.4,.9,1.4,1.9,2.4,2.9,3.4,3.9,4.4,4.9,5.4,5.9];
  let no=0,ni=0;
  walkers.forEach((w,i)=>{const v=14+rnd()*4;
    if(i%2===0){const r=route(...walkOut(w,WALK_FAR)),ql=outLeave[no++%outLeave.length];drive(w.g,r,Math.max(0,r.L-v*(ql-Q0)),v,{bob:true})}
    else{const r=route(...walkOut(w,ARRIVE_FROM).reverse());drive(w.g,r,0,v,{q0:inAt[ni++%inAt.length],hold:true,bob:true})}});
  const move=(m,q)=>{if(q<m.q0){m.obj.visible=false;return}
    let d=m.d0+m.v*(q-m.q0),p=along(m.r,d);if(!p&&m.hold){d=m.r.L-1e-3;p=along(m.r,d);p.still=true}   // arrivals stop at their spot
    m.obj.visible=!!p&&m.keep;if(!p)return;
    m.obj.position.set(p.x,m.bob&&!p.still?Math.abs(Math.sin(d*2.4))*0.08:0,p.z);m.obj.rotation.y=p.yaw};
  const dockA=147.5*Math.PI/180;
  (function animate(){
    const q=og.state.q,t=performance.now()/1000;
    movers.forEach(m=>move(m,q));
    // boats: round the harbour on arcs that stay on the water, bobbing gently
    boats.forEach(b=>{const a=(b.a0+b.w*(q-Q0))*Math.PI/180,dir=Math.sign(b.w);b.g.position.set(Math.cos(a)*b.r,.06+Math.sin(t*1.4+b.ph)*.07,Math.sin(a)*b.r);
      b.g.rotation.y=Math.atan2(-Math.cos(a)*dir,-Math.sin(a)*dir);b.g.rotation.x=Math.sin(t*1.1+b.ph)*.03});
    // the ferry waits at the pier, backs out into the harbour, then crosses it
    {let a=dockA,r=128,yaw;if(q<-1.2){yaw=Math.atan2(-Math.cos(a),-Math.sin(a))}
      else if(q<-.2){r=128+47*(q+1.2);yaw=Math.atan2(-Math.sin(a),Math.cos(a))}
      else{r=175;a=dockA+22*(q+.2)*Math.PI/180;yaw=Math.atan2(-Math.cos(a),-Math.sin(a))}
      ferry.position.set(Math.cos(a)*r,.06+Math.sin(t*1.2)*.05,Math.sin(a)*r);ferry.rotation.y=yaw}
    // birds: fly off, away from the opening shot and upward, until they are gone
    birds.forEach(b=>{const k=Math.max(0,q-Q0);b.m.position.copy(b.p0).addScaledVector(fwd,k*90);b.m.position.y=b.p0.y+k*22;
      b.m.visible=k<3.2;b.m.scale.set(b.s,b.s*(.55+.45*Math.abs(Math.sin(t*7+b.ph))),b.s)});
    requestAnimationFrame(animate);
  })();
  // the haze is daylight: it fades through dusk and is gone at night
  let lastK = -1;
  (function dim() {
    const L = og.state, k = (1 - L.dusk * 0.7) * (1 - L.night * 0.95);
    if (Math.abs(k - lastK) > 0.01) { hazeList.forEach(m => { m.emissiveIntensity = k; }); lastK = k; }
    requestAnimationFrame(dim);
  })();
})();
