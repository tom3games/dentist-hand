# 緑背景を抜いて webp(透過) にし、3列のシートを1枚ずつに切る。python key.py（numpy と Pillow が要る）
import numpy as np, os, sys
from PIL import Image, ImageFilter
D=os.path.dirname(os.path.abspath(__file__)); OUT=D+'/../img/'
def key(src):
    im=Image.open(src).convert('RGB'); a=np.asarray(im).astype(np.float32)
    r,g,b=a[...,0],a[...,1],a[...,2]
    k=g-np.maximum(r,b)
    al=1-np.clip((k-18)/(70-18),0,1)
    lim=np.maximum(r,b); g=np.where(g>lim, lim, g)   # 縁の緑かぶりを取る
    out=np.dstack([r,g,b,al*255]).clip(0,255).astype(np.uint8)
    o=Image.fromarray(out,'RGBA'); A=o.split()[3].filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7)); o.putalpha(A)
    return o
def cols(im, n=3):
    A=np.asarray(im.split()[3]).astype(np.float32)/255; W=im.width; prof=A.mean(axis=0); cuts=[0]
    for i in range(1,n):
        c=int(W*i/n); lo,hi=c-90,c+90; cuts.append(lo+int(np.argmin(prof[lo:hi])))
    cuts.append(W); return [im.crop((cuts[i],0,cuts[i+1],im.height)) for i in range(n)]
def save(im,name,maxw,maxh):
    bb=im.getbbox(); im=im.crop(bb); im.thumbnail((maxw,maxh),Image.LANCZOS)
    im.save(OUT+name+'.webp',quality=82,method=6); print(name,im.size,os.path.getsize(OUT+name+'.webp')//1024,'KB')
if __name__=='__main__':
    for who in ['dentist','director']:
        for part,pose in zip(cols(key(D+f'/raw/{who}.png')),['down','look','away']): save(part,f'{who}_{pose}',460,620)
    for part,pose in zip(cols(key(D+'/raw/assistant.png')),['look','glare','away']): save(part,f'assistant_{pose}',460,620)
    for part,st in zip(cols(key(D+'/raw/hand.png')),['rest','fist','up']): save(part,f'hand_{st}',360,560)
    for part,st in zip(cols(key(D+'/raw/feet.png')),['feet_rest','feet_curl','drill']): save(part,st,420,420)
    bg=Image.open(D+'/raw/bg.png').convert('RGB'); bg.thumbnail((900,1350)); bg.save(OUT+'bg.webp',quality=78,method=6); print('bg',bg.size,os.path.getsize(OUT+'bg.webp')//1024)
