// Reachability check with the real game physics (run: node tools/check.js)
const fs=require('fs'); const src=fs.readFileSync(__dirname+'/../index.html','utf8');
const m=src.match(/const LEVELS=\[([\s\S]*?)\n\];/)[1]; const lv=[...m.matchAll(/`([\s\S]*?)`/g)].map(x=>x[1].split('\n'));
const T=12, HW=8, HH=14, MAXV=1.35, ACC=0.012*16, G=0.14, JV=-3.0, JB=0.08, JT=150;
function analyse(L,li){
  const rows=L.length, cols=Math.max(...L.map(r=>r.length)); const g=L.map(r=>r.padEnd(cols,'.').split(''));
  const solid=(x,y)=>{const cx=Math.floor(x/T),cy=Math.floor(y/T); if(cx<0||cx>=cols) return true; if(cy<0||cy>=rows) return false; return '#=?x'.includes(g[cy][cx]);};
  // standable tiles
  const stand=[]; for(let y=0;y<rows;y++) for(let x=0;x<cols;x++) if('#=?x'.includes(g[y][x]) && !(y>0&&'#=?x'.includes(g[y-1][x]))) stand.push({x,y});
  const key=(x,y)=>x+','+y; const standSet=new Set(stand.map(s=>key(s.x,s.y)));
  // simulate from a standing position (px = hero left x, feet at tile top)
  function sim(px,py,vx0,dir,jump,hold){
    let x=px,y=py,vx=vx0,vy=0,on=true,jt=0,frames=0,jumped=false;
    while(frames++<400){
      if(dir!==0){ vx+=dir*ACC; } else { vx*=0.82; if(Math.abs(vx)<0.02) vx=0; }
      vx=Math.max(-MAXV,Math.min(MAXV,vx));
      if(jump&&on&&!jumped){ vy=JV; on=false; jt=0; jumped=true; }
      if(!on&&hold&&jumped&&vy<0&&jt<JT){ vy-=JB; jt+=16; }
      vy=Math.min(3.2,vy+G);
      let nx=x+vx;
      if(vx>0){ if(solid(nx+HW,y+1)||solid(nx+HW,y+HH-1)){ nx=Math.floor((nx+HW)/T)*T-HW-0.01; vx=0; } }
      else if(vx<0){ if(solid(nx,y+1)||solid(nx,y+HH-1)){ nx=Math.floor(nx/T+1)*T+0.01; vx=0; } }
      x=Math.max(0,nx);
      let ny=y+vy; on=false;
      if(vy>0){ if(solid(x+1,ny+HH)||solid(x+HW-1,ny+HH)){ ny=Math.floor((ny+HH)/T)*T-HH; vy=0; on=true; } }
      else if(vy<0){ if(solid(x+1,ny)||solid(x+HW-1,ny)){ ny=Math.floor(ny/T+1)*T+0.01; vy=0; } }
      y=ny;
      if(y>rows*T+20) return null;
      if(on && jumped) return {x,y};
      if(on && !jumped && !jump && frames>2) return {x,y}; // walked off / stayed
    }
    return null;
  }
  // BFS over standable tiles
  const start=(()=>{ for(let y=0;y<rows;y++){ const x=g[y].indexOf('P'); if(x>=0){ let yy=y+1; while(yy<rows&&!'#=?x'.includes(g[yy][x])) yy++; return {x,y:yy}; } } })();
  const reach=new Set([key(start.x,start.y)]); const q=[start];
  const landTile=(p)=>{ const feet=p.y+HH; const cy=Math.round(feet/T); const cxs=[Math.floor((p.x+1)/T),Math.floor((p.x+HW-1)/T)]; for(const cx of cxs) if(standSet.has(key(cx,cy))) return {x:cx,y:cy}; return null; };
  while(q.length){ const s=q.shift();
    // walking along contiguous standable tiles at same row
    for(const d of [-1,1]){ let x=s.x+d; while(x>=0&&x<cols&&standSet.has(key(x,s.y))&&!'#=?x'.includes(g[s.y-1]?.[x]||'.')&&!'#=?x'.includes(g[s.y-2]?.[x]||'.')){ const k=key(x,s.y); if(!reach.has(k)){ reach.add(k); q.push({x,y:s.y}); } x+=d; } }
    // jumps and drops from several x offsets within tile
    for(const off of [0,2,4]) for(const vx0 of [0,-MAXV,MAXV]) for(const dir of [-1,0,1]) for(const [jump,hold] of [[true,true],[true,false],[false,false]]){
      if(!jump && dir===0) continue;
      const px=s.x*T+off, py=s.y*T-HH; if(solid(px+1,py+1)||solid(px+HW-1,py+1)) continue; // no headroom
      const r=sim(px,py,vx0,dir,jump,hold); if(!r) continue; const t=landTile(r); if(!t) continue; const k=key(t.x,t.y); if(!reach.has(k)){ reach.add(k); q.push(t); } }
  }
  const issues=[];
  const fin=(()=>{ for(let y=0;y<rows;y++){ const x=g[y].indexOf('F'); if(x>=0){ let yy=y+1; while(yy<rows&&!'#=?x'.includes(g[yy][x])) yy++; return {x,y:yy}; } } })();
  if(!reach.has(key(fin.x,fin.y))) issues.push('FINISH ONBEREIKBAAR');
  const unreachPlat=stand.filter(s=>!reach.has(key(s.x,s.y))&&s.y<rows-2);
  if(unreachPlat.length) issues.push('onbereikbare platformtegels: '+unreachPlat.map(s=>s.x+'/'+s.y).join(' '));
  // coins: reachable if some reachable standable tile within jump reach (<=3 rows below coin, dx<=5) or coin directly above a reachable tile
  const coins=[]; g.forEach((r,y)=>r.forEach((ch,x)=>{ if(ch==='o'||ch==='?') coins.push({x,y,ch}); }));
  const badCoins=coins.filter(c=>{ for(const s of stand){ if(!reach.has(key(s.x,s.y))) continue; const dy=s.y-c.y; if(dy>=0&&dy<=4&&Math.abs(s.x-c.x)<=4) return false; } return true; });
  if(badCoins.length) issues.push('onbereikbare munten/blokken: '+badCoins.map(c=>c.ch+c.x+'/'+c.y).join(' '));
  // ceiling traps: ground gap with solid within 3 rows above its edges
  const gr=rows-2; let x=0; while(x<cols){ if(!'#=?x'.includes(g[gr][x])){ let w=0; while(x+w<cols&&!'#=?x'.includes(g[gr][x+w])) w++; for(const ex of [x-1,x+w]){ for(let dy=1;dy<=3;dy++){ if(ex>=0&&ex<cols&&'#=?x'.includes(g[gr-dy][ex])) { issues.push('gat bij kolom '+x+' heeft een plafond boven de rand ('+ex+'/'+(gr-dy)+')'); break; } } } x+=w; } else x++; }
  console.log('Level '+(li+1)+': '+(issues.length?issues.join(' | '):'OK')+'  (bereikbaar '+reach.size+'/'+stand.length+' standtegels)');
}
lv.forEach(analyse);
