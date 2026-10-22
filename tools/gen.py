#!/usr/bin/env python3
"""Generate 5 verified levels and inject them into index.html. Run: python3 tools/gen.py"""
import random, re, subprocess, sys, os
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROWS, COLS, GR = 11, 96, 9

def gen(seed, diff):
    rnd=random.Random(seed)
    g=[['.']*COLS for _ in range(ROWS)]
    # ground segments
    x=0; segs=[]; first=True
    while x<COLS:
        ln = 12 if first else rnd.randint(12,22)
        if x+ln>COLS-12: ln=COLS-x
        for c in range(x,x+ln):
            g[GR][c]='#'; g[GR+1][c]='#'
        segs.append((x,x+ln-1)); x+=ln; first=False
        if x>=COLS: break
        gap=rnd.randint(2,min(4,2+diff));
        if x+gap>=COLS-12:
            for c in range(x,COLS): g[GR][c]='#'; g[GR+1][c]='#'
            segs[-1]=(segs[-1][0],COLS-1); break
        x+=gap
    gaps=[];
    for i in range(1,len(segs)): gaps.append((segs[i-1][1]+1, segs[i][0]-1))
    forbidden=set()
    for a,b in gaps:
        for c in range(a-2,b+2): forbidden.add(c)
    def free(r,a,b):  # columns free of platforms in row r and neighbours
        return all(g[rr][c]=='.' for rr in range(max(0,r-2),min(GR,r+3)) for c in range(max(0,a-2),min(COLS,b+3)))
    def place(r,a,b,ch='='):
        for c in range(a,b+1): g[r][c]=ch
    # staircases
    nstairs = 4+diff
    tries=0
    while nstairs>0 and tries<400:
        tries+=1
        a=rnd.randint(13,COLS-18); ln=rnd.randint(3,5); b=a+ln-1
        if any(c in forbidden for c in range(a,b+1)): continue
        if not free(7,a,b): continue
        place(7,a,b); nstairs-=1
        # second step: beside the first (gap of 1-2 columns), two rows higher
        if rnd.random()<0.8:
            d=rnd.choice([-1,1]); ln2=rnd.randint(3,5); gap2=rnd.randint(1,2)
            a2 = b+1+gap2 if d>0 else a-gap2-ln2; b2=a2+ln2-1
            if 2<=a2 and b2<COLS-12 and not any(c in forbidden for c in range(a2,b2+1)) and free(5,a2,b2):
                place(5,a2,b2)
                if rnd.random()<0.6:
                    ln3=rnd.randint(3,5); gap3=rnd.randint(1,2)
                    a3 = b2+1+gap3 if d>0 else a2-gap3-ln3; b3=a3+ln3-1
                    if 2<=a3 and b3<COLS-12 and not any(c in forbidden for c in range(a3,b3+1)) and free(3,a3,b3):
                        place(3,a3,b3)
                        if rnd.random()<0.5 and g[2][a3+1]=='.': g[2][a3+1]='?'
    # ? boxes: on ground at row GR-3 (bumped from below), away from gaps and platforms
    for _ in range(3+diff):
        c=rnd.randint(14,COLS-16)
        if c in forbidden or not free(GR-3,c,c): continue
        if all(g[r][c]=='.' for r in range(GR-3,GR)): g[GR-3][c]='?'
    # coins
    for r in range(3,8):
        for c in range(2,COLS-12):
            if g[r][c] in '=' and g[r-1][c]=='.' and rnd.random()<0.5: g[r-1][c]='o'
    for a,b in gaps:  # arc over gaps
        for c in range(a,b+1):
            if g[GR-3][c]=='.': g[GR-3][c]='o'
    for _ in range(3+diff):
        c=rnd.randint(12,COLS-16)
        if all((cc not in forbidden and all(g[r][cc]=='.' for r in range(GR-4,GR))) for cc in range(c,c+3)):
            for cc in range(c,c+3): g[GR-3][cc]='o'
    # enemies on ground segments (not first) and on platforms
    kinds=['e','e','E'] if diff<2 else ['e','E','E','M'] if diff<4 else ['E','M','M']
    for (a,b) in segs[1:]:
        if b-a>=5:
            for _ in range(1 if diff<2 else 2):
                c=rnd.randint(a+1,b-1)
                if c>COLS-9: continue
                if g[GR-1][c]=='.' and g[GR-2][c]=='.': g[GR-1][c]=rnd.choice(kinds)
    for r in (7,5,3):
        c=0
        while c<COLS:
            if g[r][c]=='=':
                a=c
                while c<COLS and g[r][c]=='=': c+=1
                if c-a>=4 and rnd.random()<0.5+diff*0.1:
                    cc=rnd.randint(a+1,c-2)
                    if g[r-1][cc]=='.': g[r-1][cc]=rnd.choice(kinds)
            else: c+=1
    g[GR-1][1]='P'; g[GR-1][COLS-3]='F'
    for r in range(0,GR):
        for c in (0,1,COLS-1):
            if g[r][c] not in 'PF': g[r][c]='.'
    return '\n'.join(''.join(r) for r in g)

def check(levels):
    src=open(ROOT+'/index.html').read()
    new=re.sub(r'const LEVELS=\[([\s\S]*?)\n\];', 'const LEVELS=[\n'+',\n'.join('`'+l+'`' for l in levels)+',\n];', src, count=1)
    open(ROOT+'/index.html','w').write(new)
    out=subprocess.run(['node',ROOT+'/tools/check.js'],capture_output=True,text=True).stdout
    return out

seed0=int(sys.argv[1]) if len(sys.argv)>1 else 1
levels=[None]*5
for i in range(5):
    diff=i
    for s in range(seed0*100+i*1000, seed0*100+i*1000+800):
        cand=gen(s,diff); trial=[l if l else cand for l in levels]; trial[i]=cand
        out=check(trial); line=out.split('\n')[i]
        rws=cand.split('\n'); ok3 = rws[3].count('=')>=3 or rws[5].count('=')>=8 or i==0
        if line.endswith(')') and ': OK' in line and rws[5].count('=')>=4 and ok3:
            levels[i]=cand; print('level',i+1,'seed',s,'OK'); break
    else:
        print('level',i+1,'geen geldig level gevonden'); sys.exit(1)
print(check(levels))
