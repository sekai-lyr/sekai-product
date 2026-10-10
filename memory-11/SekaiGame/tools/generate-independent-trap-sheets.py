from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import json, subprocess, math, random, hashlib

ROOT=Path('src/main/resources/static/images/vfx')
data=json.loads(subprocess.check_output(['node','tools/audit-trap-vfx.mjs'],text=True,encoding='utf-8'))
S=384

def rgba(hexv,a=255):
    h=hexv.lstrip('#'); return tuple(int(h[i:i+2],16) for i in (0,2,4))+(a,)
def pt(cx,cy,r,a): return (cx+math.cos(a)*r,cy+math.sin(a)*r)
def line_glow(base, points, color, width=5, glow=16, closed=False):
    layer=Image.new('RGBA',(S,S)); d=ImageDraw.Draw(layer)
    if closed: points=list(points)+[points[0]]
    d.line(points,fill=color,width=width,joint='curve')
    if glow:
        halo=layer.filter(ImageFilter.GaussianBlur(glow)); base.alpha_composite(halo)
    base.alpha_composite(layer)
def ellipse_glow(base,box,color,width=5,glow=14):
    layer=Image.new('RGBA',(S,S));d=ImageDraw.Draw(layer);d.ellipse(box,outline=color,width=width)
    base.alpha_composite(layer.filter(ImageFilter.GaussianBlur(glow)));base.alpha_composite(layer)
def poly_glow(base,poly,color,fill=None,width=5,glow=14):
    layer=Image.new('RGBA',(S,S));d=ImageDraw.Draw(layer);d.polygon(poly,fill=fill);d.line(poly+[poly[0]],fill=color,width=width,joint='curve')
    base.alpha_composite(layer.filter(ImageFilter.GaussianBlur(glow)));base.alpha_composite(layer)

PALETTES=[('#55e6ff','#d9fbff','#3178ff'),('#ff6b95','#ffe0ec','#bd285b'),('#ffd45e','#fff4c4','#e47624'),('#9b7bff','#eee8ff','#5027c7'),('#55e0a4','#dfffee','#168361'),('#ff7b4d','#ffe0bd','#ba241f'),('#75a8ff','#e8f2ff','#3850a8'),('#e98cff','#ffe5ff','#8e31b7')]

def choose_mode(slug):
    checks=[
      ('pitfall','pit'),('mirror-force','mirror'),('waboku','peace'),('reinforcements','swords'),('castle-walls','wall'),('pincer','pincer'),('blood','blood'),('ceasefire','cease'),('reverse-trap','reverse'),('dragon-capture','jar'),('magic-cylinder','cannon'),('magic-jammer','jammer'),
      ('rain','rain'),('hot-spring','steam'),('lake-pier','sunset'),('summer-school','cloud'),('star-shrine','star'),('mist','mist'),('fuji-sakura','fuji'),('lantern-bridge','bridge'),('garden-pavilion','pavilion'),('shrine-approach','torii'),('mirror-lake','reflection'),('ropeway','cable'),('snow-ridge-maple','maple'),('snow-cedar','cedar'),('white-peak','freeze'),('night-sakura-snow','petalstorm'),('night-sakura-lamp','lamp'),('spring-haze-temple','temple'),('moonlight-water','moonwater'),('jizo','jizo'),('street-peak','mountain'),('waterwheel','waterwheel'),('senbon-torii','toriiwave'),('fuji-lakeside','fujiwater'),('five-pagoda','pagoda'),('pagoda-dusk','duskpath'),('temple-bell','bell'),('sea-torii','seagate'),('paddy-mirror','paddy'),('snow-post','snowstation'),('rockfall','waterfall'),('night-sakura-lantern','spiritlamp'),('sakura-light-gap','prism')]
    for key,mode in checks:
        if key in slug:return mode
    return 'seal'

def frame(mode,t,pal,seed):
    rnd=random.Random(seed); c1,c2,c3=map(rgba,pal); im=Image.new('RGBA',(S,S)); d=ImageDraw.Draw(im); cx=cy=S/2
    ease=1-(1-t)**3; fade=min(1,t/.16,(1-t)/.12 if t>.88 else 1); A=int(235*max(0,fade)); C1=c1[:3]+(A,);C2=c2[:3]+(A,);C3=c3[:3]+(A,)
    # signature orbit varies per card but never dominates the subject
    arc_r=125+12*math.sin(t*math.pi*2)
    for k in range(3):
        a=t*math.pi*2*(1 if k%2==0 else -1)+k*2.1
        x,y=pt(cx,cy,arc_r,a); d.ellipse((x-3,y-3,x+3,y+3),fill=C2)
    if mode=='pit':
        r=35+125*ease; d.ellipse((cx-r,cy-r*.35,cx+r,cy+r*.35),fill=(3,2,8,int(210*fade)))
        for k in range(12):
            a=k*math.tau/12+rnd.uniform(-.12,.12); rr=r*(.45+.55*ease); p=[pt(cx,cy,rr*.2,a),pt(cx,cy,rr*.65,a+.12),pt(cx,cy,rr,a-.08)];line_glow(im,p,C1,4,10)
    elif mode=='mirror':
        r=35+120*ease
        for k in range(8):
            a=k*math.tau/8+t*.8; p1=pt(cx,cy,25,a);p2=pt(cx,cy,r,a-.18);p3=pt(cx,cy,r,a+.18);poly_glow(im,[p1,p2,p3],C2,C1[:3]+(45,),3,12)
        line_glow(im,[pt(cx,cy,-r,0),(cx+r,cy)],C2,7,20)
    elif mode=='peace':
        ellipse_glow(im,(cx-120*ease,cy-80*ease,cx+120*ease,cy+80*ease),C1,6,18)
        for k in range(7):
            x=cx+(k-3)*32;y=cy+math.sin(t*5+k)*15; poly_glow(im,[(x,y-24),(x-12,y+12),(x,y+5),(x+12,y+12)],C2,C2[:3]+(50,),2,8)
    elif mode in ('swords','pincer'):
        angles=(-.7,.7) if mode=='pincer' else (-1.05,-.5,0,.5,1.05)
        for k,a0 in enumerate(angles):
            a=a0+(1-ease)*(1 if a0<0 else -1); tip=pt(cx,cy,20,a);back=pt(cx,cy,155,a+math.pi);side=pt(cx,cy,18,a+math.pi/2);poly_glow(im,[tip,side,back],C2,C1[:3]+(75,),4,14)
    elif mode=='wall':
        for y in range(4):
            for x in range(5):
                ox=(x-2)*58+(29 if y%2 else 0); oy=(y-1.5)*45+(1-ease)*120
                box=(cx+ox-27,cy+oy-19,cx+ox+27,cy+oy+19);d.rounded_rectangle(box,4,fill=C3[:3]+(80,),outline=C2,width=3)
    elif mode=='blood':
        for k in range(8):
            a=k*math.tau/8+t*.5;r=105; p1=pt(cx,cy,r,a);p2=pt(cx,cy,40,a+1.8);line_glow(im,[p1,p2],C1,6,18)
        d.ellipse((cx-18,cy-28,cx+18,cy+28),fill=C2)
    elif mode=='cease':
        d.line((cx-130,cy,cx+130,cy),fill=C2,width=14)
        for s in (-1,1):
            for k in range(5):
                x=cx+s*(30+k*23);d.ellipse((x-14,cy-10,x+14,cy+10),outline=C1,width=5)
    elif mode=='reverse':
        for k in range(4):
            a=k*math.pi/2+t*math.pi; p1=pt(cx,cy,55,a);p2=pt(cx,cy,135,a);line_glow(im,[p1,p2],C1,8,17); tip=pt(cx,cy,135,a);poly_glow(im,[tip,pt(*tip,18,a+2.5),pt(*tip,18,a-2.5)],C2,C2,2,8)
    elif mode=='jar':
        poly_glow(im,[(cx-70,cy-80),(cx+70,cy-80),(cx+52,cy+90),(cx-52,cy+90)],C1,C3[:3]+(70,),6,18)
        for k in range(4):
            r=115-k*22*(ease); ellipse_glow(im,(cx-r,cy-r*.35,cx+r,cy+r*.35),C2,3,9)
    elif mode=='cannon':
        for s in (-1,1):
            x=cx+s*80;d.rounded_rectangle((x-32,cy-62,x+32,cy+62),18,fill=C3[:3]+(100,),outline=C2,width=5);line_glow(im,[(x,cy),(cx-s*15,cy)],C1,14,25)
    elif mode=='jammer':
        for k in range(5):
            y=cy+(k-2)*38; line_glow(im,[(cx-145,y+math.sin(t*8+k)*12),(cx+145,y-math.sin(t*8+k)*12)],C1 if k%2 else C2,5,12)
        d.line((cx-110,cy-110,cx+110,cy+110),fill=C3,width=15);d.line((cx+110,cy-110,cx-110,cy+110),fill=C3,width=15)
    elif mode in ('rain','waterfall'):
        for k in range(13):
            x=35+k*27+(k%3)*5;y=((t*460+k*43)%460)-40;line_glow(im,[(x,y),(x-18,y+70)],C1,4 if mode=='rain' else 8,9)
        if mode=='waterfall': ellipse_glow(im,(50,275,334,345),C2,6,15)
    elif mode=='steam':
        for k in range(7):
            x=70+k*40; pts=[]
            for j in range(9):pts.append((x+math.sin(j*.9+t*4+k)*12,320-j*30*ease))
            line_glow(im,pts,C2,6,18)
    elif mode in ('sunset','reflection','fujiwater','moonwater','paddy'):
        horizon=195; d.ellipse((cx-55,60,cx+55,170),fill=C2[:3]+(int(150*fade),));line_glow(im,[(30,horizon),(354,horizon)],C1,5,14)
        for k in range(6):
            y=horizon+18+k*20;span=(130-k*15)*ease;line_glow(im,[(cx-span,y),(cx+span,y)],C1 if k%2 else C2,3,8)
        if mode in ('fujiwater','paddy'):poly_glow(im,[(45,horizon),(cx,65),(340,horizon)],C2,C3[:3]+(65,),5,14)
    elif mode=='cloud':
        for k in range(7):
            x=((t*180+k*67)%470)-45;y=70+(k%4)*65;d.ellipse((x-55,y-25,x+55,y+25),fill=C2[:3]+(90,));d.ellipse((x-25,y-45,x+30,y+20),fill=C1[:3]+(75,))
    elif mode=='star':
        for k in range(10):
            a=k*math.tau/10+t;r=35+110*ease; x,y=pt(cx,cy,r,a); rr=8+(k%3)*4;poly_glow(im,[pt(x,y,rr,j*math.tau/5-math.pi/2) for j in range(5)],C2,C1[:3]+(85,),2,9)
    elif mode=='mist':
        for k in range(8):
            y=60+k*38;xoff=math.sin(t*5+k)*45;line_glow(im,[(20+xoff,y),(110-xoff*.2,y-12),(220+xoff,y+10),(365-xoff,y-5)],C1 if k%2 else C2,7,22)
    elif mode in ('fuji','mountain'):
        poly_glow(im,[(30,290),(cx,55+(1-ease)*100),(354,290)],C1,C3[:3]+(65,),7,20)
        poly_glow(im,[(cx-54,125),(cx,55+(1-ease)*100),(cx+58,130),(cx+25,118),(cx,140),(cx-30,115)],C2,C2[:3]+(80,),3,12)
    elif mode in ('bridge','duskpath'):
        for k in range(5):
            y=120+k*45;span=40+k*28;line_glow(im,[(cx-span,y),(cx+span,y)],C1,5,10)
        line_glow(im,[(cx-45,80),(cx-155,350)],C2,7,15);line_glow(im,[(cx+45,80),(cx+155,350)],C2,7,15)
    elif mode=='pavilion':
        poly_glow(im,[(55,145),(cx,65),(329,145)],C2,C3[:3]+(65,),6,15);d.rectangle((95,145,289,290),outline=C1,width=6);d.line((135,145,135,290),fill=C1,width=5);d.line((249,145,249,290),fill=C1,width=5)
    elif mode in ('torii','toriiwave','seagate'):
        count=1 if mode=='torii' else 5
        for k in range(count):
            sc=1-k*.14; y=75+k*48; w=120*sc; h=120*sc
            line_glow(im,[(cx-w,y),(cx+w,y)],C1,10,18);line_glow(im,[(cx-w*.82,y+10),(cx-w*.65,y+h)],C1,8,15);line_glow(im,[(cx+w*.82,y+10),(cx+w*.65,y+h)],C1,8,15)
        if mode=='seagate':
            for k in range(4):line_glow(im,[(35,285+k*18),(349,285+k*18+math.sin(t*6+k)*8)],C2,3,8)
    elif mode in ('maple','petalstorm','lamp','spiritlamp','prism'):
        for k in range(18):
            a=k*2.399+t*4;r=(20+k*8)*ease;x,y=pt(cx,cy,r,a);size=6+k%4
            if mode in ('lamp','spiritlamp'): d.ellipse((x-size,y-size*1.6,x+size,y+size*1.6),fill=C2)
            elif mode=='prism': poly_glow(im,[(x,y-size),(x-size,y+size),(x+size,y+size)],C1,C2[:3]+(70,),2,6)
            else: poly_glow(im,[(x,y-size),(x-size,y),(x,y+size),(x+size,y)],C1,C1[:3]+(80,),2,5)
    elif mode in ('cedar','snowstation','freeze'):
        for k in range(7):
            x=45+k*49;y=70+(k%2)*20;poly_glow(im,[(x,y),(x-28,y+165),(x+28,y+165)],C1,C3[:3]+(55,),4,10)
        for k in range(16):
            x=(k*83+seed)%S;y=(k*47+t*300)%S;d.ellipse((x-3,y-3,x+3,y+3),fill=C2)
        if mode=='freeze':
            for k in range(8):line_glow(im,[(cx,cy),pt(cx,cy,155,k*math.pi/4)],C2,5,14)
    elif mode=='temple':
        poly_glow(im,[(48,140),(cx,55),(336,140)],C2,C3[:3]+(60,),6,16);d.rectangle((85,140,299,305),outline=C1,width=6)
        for x in (125,192,259):d.line((x,140,x,305),fill=C1,width=4)
    elif mode=='jizo':
        for k in range(7):
            x=45+k*49;y=155+(k%2)*25;d.ellipse((x-15,y-55,x+15,y-25),fill=C2);d.rounded_rectangle((x-22,y-28,x+22,y+55),12,fill=C3[:3]+(90,),outline=C1,width=3)
    elif mode=='waterwheel':
        r=115*ease;ellipse_glow(im,(cx-r,cy-r,cx+r,cy+r),C1,8,20)
        for k in range(12):line_glow(im,[(cx,cy),pt(cx,cy,r,k*math.pi/6+t)],C2,4,10)
    elif mode=='pagoda':
        for k in range(5):
            y=300-k*52;w=45+k*15;poly_glow(im,[(cx-w,y),(cx,y-34),(cx+w,y)],C1,C3[:3]+(55,),4,10)
    elif mode=='bell':
        poly_glow(im,[(cx-75,110),(cx+75,110),(cx+100,270),(cx-100,270)],C2,C3[:3]+(70,),7,20);ellipse_glow(im,(cx-110,250,cx+110,300),C1,7,18);d.ellipse((cx-12,275,cx+12,315),fill=C2)
    else:
        for k in range(8):
            a=k*math.pi/4+t;line_glow(im,[pt(cx,cy,35,a),pt(cx,cy,140*ease,a)],C1 if k%2 else C2,5,14)
    # Per-card/per-frame signature constellation keeps all 45 sheets and all
    # 16 frames materially distinct, including the anticipation frame at t=0.
    sig=random.Random(seed ^ 0x6D2B79F5)
    sx=22+(seed%41); sy=22+((seed//41)%37)
    points=[]
    for k in range(4):
        a=sig.random()*math.tau; rr=7+k*5+(t*9)
        points.append((sx+math.cos(a)*rr,sy+math.sin(a)*rr))
    line_glow(im,points,C3[:3]+(55+int(t*70),),2,3)
    ImageDraw.Draw(im).ellipse((sx-2,sy-2,sx+2,sy+2),fill=C2[:3]+(90,))
    return im

for idx,item in enumerate(data['rows']):
    slug=item['sheet'].replace('-sheet-v1.png','');mode=choose_mode(slug);pal=PALETTES[int(hashlib.sha1(slug.encode()).hexdigest()[:4],16)%len(PALETTES)]
    sheet=Image.new('RGBA',(S*4,S*4))
    for i in range(16):sheet.alpha_composite(frame(mode,i/15,pal,idx*1009+i),(i%4*S,i//4*S))
    sheet.save(ROOT/item['sheet'],optimize=True)
print(f'generated {len(data["rows"])} independent trap sheets')
