"""Pulls each rank's painted sand out of its full art (full minus empty), for Home's live glass.
usage: python extract_sand.py <repo> <preview-dir> rank [rank…]"""
import sys, json
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
repo, sp, ranks = sys.argv[1], sys.argv[2], sys.argv[3:]
K=840/1413
CX,NECK=556,776
TOP=[(345,205),(380,215),(420,215),(460,212),(500,210),(540,198),(580,192),(620,158),(660,112),(700,68),(740,34),(NECK,22)]
BOT=[(NECK,22),(820,30),(860,58),(900,100),(940,134),(980,158),(1020,187),(1060,234),(1100,240),(1140,236),(1170,222),(1210,190)]
poly=lambda e:[((CX+h)*K,y*K) for y,h in e]+[((CX-h)*K,y*K) for y,h in reversed(e)]
meta={}
for k in ranks:
    full=Image.open(f'{repo}/assets/images/hourglasses/{k}.png').convert('RGBA')
    empty=Image.open(f'{repo}/assets/images/hourglasses/empty/{k}.png').convert('RGBA')
    f=np.asarray(full).astype(float); e=np.asarray(empty).astype(float)
    diff=np.abs(f[...,:3]-e[...,:3]).sum(-1)
    region=Image.new('L',full.size,0); dr=ImageDraw.Draw(region); dr.polygon(poly(TOP),fill=255); dr.polygon(poly(BOT),fill=255)
    region=np.asarray(region.filter(ImageFilter.GaussianBlur(1.5))).astype(float)/255
    # Unmix: full = a * sand + (1 - a) * empty glass. The sand's colour is the typical
    # colour of what changed most; a is how far each pixel moved towards it.
    strong=(diff>np.percentile(diff[region>0.5],92))&(region>0.5)
    C=np.median(f[strong][:,:3],axis=0)
    d=f[...,:3]-e[...,:3]; t=C[None,None,:]-e[...,:3]
    a=np.clip((d*t).sum(-1)/np.maximum((t*t).sum(-1),1),0,1)
    a=np.clip((a-0.06)/0.34,0,1); a=np.clip((a-0.3)/0.35,0,1)*region
    S=np.clip(e[...,:3]+d/np.maximum(a,0.08)[...,None],0,255)
    out=np.zeros_like(f); out[...,:3]=np.where(a[...,None]>0.01,S,0); out[...,3]=a*255
    Image.fromarray(out.astype(np.uint8)).save(f'{repo}/assets/images/hourglasses/sand/{k}.png', optimize=True)
    width=(a>0.5).mean(1)
    top=[r for r in np.where(width>0.12)[0] if r<NECK*K-6]
    bot=[r for r in np.where(width>0.08)[0] if r>NECK*K+6]
    meta[k]={'topSand':round(min(top)/K) if top else 600,'pile':round(min(bot)/K) if bot else 1060}
    tiles=[]
    for ran in (0.0,0.5,0.95):
        t0=meta[k]['topSand']; level=t0+(NECK-t0)*ran
        pileTop=1210-(1210-meta[k]['pile'])*ran
        m=Image.new('L',full.size,0); md=ImageDraw.Draw(m)
        md.rectangle([0,level*K,full.size[0],NECK*K],fill=255)
        md.rectangle([0,pileTop*K,full.size[0],full.size[1]],fill=255)
        if 0<ran<1: md.rectangle([(CX-10)*K,NECK*K,(CX+10)*K,pileTop*K],fill=255)
        s2=Image.fromarray(out.astype(np.uint8)); s2.putalpha(Image.fromarray((out[...,3]*np.asarray(m)/255).astype(np.uint8)))
        bg=Image.new('RGBA',full.size,(10,12,20,255)); bg.alpha_composite(empty); bg.alpha_composite(s2)
        tiles.append(bg.resize((330,420)))
    sheet=Image.new('RGBA',(990,420)); [sheet.paste(t,(i*330,0)) for i,t in enumerate(tiles)]
    sheet.save(f'{sp}/reveal_{k}.png')
print(json.dumps(meta))
