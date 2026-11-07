"""Кадры атласа игры (dist/assets/atlas0) как картинки PIL — для макетов."""
import json, os, sys
from PIL import Image
A=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','..','dist','assets')+os.sep
def load(name='atlas0'):
    d=json.load(open(A+name+'.json')); im=Image.open(A+name+'.png').convert('RGBA')
    fr=d['frames']
    if isinstance(fr,list): fr={f['filename']:f for f in fr}
    return d,im,fr
_d,_im,_fr=load()
def frame(name):
    f=_fr[name]; x,y,w,h=f['frame']['x'],f['frame']['y'],f['frame']['w'],f['frame']['h']
    sub=_im.crop((x,y,x+w,y+h))
    if f.get('rotated'): sub=sub.rotate(90,expand=True)
    sw,sh=(f['sourceSize']['w'],f['sourceSize']['h']) if 'sourceSize' in f else (w,h)
    out=Image.new('RGBA',(sw,sh),(0,0,0,0))
    ss=f.get('spriteSourceSize',{'x':0,'y':0})
    out.paste(sub,(ss['x'],ss['y']))
    return out
def names(prefix=''):
    return sorted(k for k in _fr if k.startswith(prefix))
def sheet(prefixes,out,scale=2,maxw=1400):
    ims=[(n,frame(n)) for p in prefixes for n in names(p)]
    from PIL import ImageDraw
    x=y=0;rowh=0;pos=[]
    for n,i in ims:
        w,h=i.size[0]*scale,i.size[1]*scale+12
        if x+w>maxw: x=0;y+=rowh+4;rowh=0
        pos.append((n,i,x,y));x+=max(w,60)+6;rowh=max(rowh,h)
    S=Image.new('RGBA',(maxw,y+rowh+4),(60,70,60,255));dr=ImageDraw.Draw(S)
    for n,i,x,y in pos:
        S.paste(i.resize((i.size[0]*scale,i.size[1]*scale),Image.NEAREST),(x,y+12),i.resize((i.size[0]*scale,i.size[1]*scale),Image.NEAREST))
        dr.text((x,y),n[:14],fill=(255,255,255,255))
    S.save(out)
if __name__=='__main__':
    sheet(sys.argv[2].split(','),sys.argv[1],int(sys.argv[3]) if len(sys.argv)>3 else 2)
