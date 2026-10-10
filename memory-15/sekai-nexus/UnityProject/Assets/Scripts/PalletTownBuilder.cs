using System.Collections.Generic;
using UnityEngine;

// All dimensions are in metres. North is +Z; building doors face south.
public sealed class PalletTownBuilder
{
    private readonly Transform root;
    private readonly Dictionary<string, Material> materials = new Dictionary<string, Material>();
    private readonly System.Random random = new System.Random(151);
    private bool connectedWorld;
    private static Font labelFont;
    private static Material labelMaterial;
    private const string Cream = "F3E7C9", Timber = "987355", White = "FFF6DF";
    private const string Grass = "8CB966", DarkLeaf = "40754D", Leaf = "5B9857", LightLeaf = "80AC61";

    public PalletTownBuilder(Transform parent) { root = parent; }

    public void Build(bool connected = false)
    {
        connectedWorld = connected;
        Ground();
        House(new Vector3(-9, 0, 9), "玩家的家", "CE6550", "RED'S HOME");
        House(new Vector3(9, 0, 9), "劲敌的家", "518CA4", "RIVAL'S HOME");
        Laboratory(new Vector3(9, 0, -5));
        Garden();
        Shore();
        Boundary();
        Sign(root, new Vector3(-3.8f, 0, -.2f), "PALLET TOWN", "真新镇 · 梦想启程的地方", "426A60", 4.2f);
        Sign(root, new Vector3(3.4f, 0, 18.3f), "ROUTE 01", "1号道路", "426A60", 2.5f);
        Lamp(new Vector3(-3.5f, 0, 4));
        Lamp(new Vector3(3.5f, 0, -10.3f));
        Lamp(new Vector3(-3.4f, 0, 14.5f));
        Bench(root, new Vector3(-5.8f, 0, -8.6f), 0);
        Bench(root, new Vector3(15, 0, -11), -90);
        for (var i = 0; i < 180; i++)
        {
            var x = Range(-18, 18); var z = Range(-13.5f, 17);
            if (Mathf.Abs(x) < 3.5f || z > 3 && z < 13.5f || x > 3 && z < 0 || x < -5 && z < 1) continue;
            GrassTuft(root, new Vector3(x, .04f, z), .5f);
        }
        // Static batching retains individual colliders and leaves water/labels animated.
        StaticBatchingUtility.Combine(root.gameObject);
    }

    private void Ground()
    {
        Box(root, "草地基座", new Vector3(0, -.65f, 1), new Vector3(43, 1.3f, 42), Grass, true);
        Box(root, "北侧1号道路", new Vector3(0, -.08f, 24), new Vector3(8, .16f, 12), Grass, true);
        Path(new Vector3(0, .025f, 4), new Vector3(4.5f, .05f, 39));
        Path(new Vector3(0, .031f, 3.4f), new Vector3(25, .06f, 3.2f));
        Path(new Vector3(7, .035f, -10), new Vector3(16, .07f, 3.2f));
        Path(new Vector3(-7, .035f, -3.5f), new Vector3(12, .07f, 2.4f));
        for (var side = -1; side <= 1; side += 2)
        {
            Path(new Vector3(side * 9, .05f, 5), new Vector3(2.3f, .08f, 4));
            for (var i = 0; i < 9; i++)
                Box(root, "路边石", new Vector3(side * 2.43f, .06f, -11 + i * 3.4f), new Vector3(.3f, .12f, .75f), "D7D6AF");
        }
        // Small patches have closely related colours, giving lawns a soft tiled rhythm.
        for (var x = -19; x < 20; x += 2)
            for (var z = -13; z < 19; z += 2)
            {
                if (Mathf.Abs(x) < 4 || z > 2 && z < 6 || x > 3 && z < 1 || x < -4 && z < 1) continue;
                Box(root, "草坪色块", new Vector3(x, .006f, z), new Vector3(1.85f, .012f, 1.85f), random.Next(2) == 0 ? "90BC69" : "89B663");
            }
        for (var i = 0; i < 90; i++)
        {
            var z = Range(-14, 21); var x = Range(-1.7f, 1.7f);
            Box(root, "砂路碎石", new Vector3(x, .059f, z), new Vector3(Range(.08f,.23f), .022f, Range(.07f,.18f)), "E9D5A4");
        }
        for (var x = -3; x <= 3; x++)
            for (var z = 22; z < 26; z++)
                if (Mathf.Abs(x) > 1) GrassTuft(root, new Vector3(x, 0, z), 1.5f);
    }

    private void Path(Vector3 p, Vector3 size) { Box(root, "暖砂小径", p, size, "DCC293"); }

    private void House(Vector3 p, string name, string roof, string label)
    {
        var h = Group(root, name, p);
        Box(h, "石砌基脚", new Vector3(0,.18f,0), new Vector3(6.9f,.36f,5.7f), "B3AC96", true);
        Box(h, "奶油墙面", new Vector3(0,2.2f,0), new Vector3(6.5f,4.05f,5.3f), Cream, true);
        Box(h, "腰线", new Vector3(0,2.3f,0), new Vector3(6.66f,.2f,5.42f), Timber);
        Box(h, "檐口", new Vector3(0,4.23f,0), new Vector3(7,.24f,5.65f), White);
        for (var x = -1; x <= 1; x += 2)
        {
            Box(h, "立柱", new Vector3(x*3.2f,2.24f,-2.71f), new Vector3(.23f,4.1f,.16f), Timber);
            Window(h, new Vector3(x*1.9f,1.48f,-2.72f), 1.25f, 1.2f, roof);
            Window(h, new Vector3(x*1.55f,3.22f,-2.72f), 1.1f, 1.13f, roof);
            var sideWindow = Group(h, "侧窗", new Vector3(x*3.29f,2.9f,.2f));
            sideWindow.localRotation = Quaternion.Euler(0, -x*90, 0);
            Window(sideWindow, Vector3.zero, 1.15f,1.18f,roof);
        }
        Door(h, new Vector3(0, .2f, -2.73f), "5F6653");
        Box(h, "门廊台阶", new Vector3(0,.1f,-3.1f), new Vector3(1.85f,.2f,.85f), "CCC4A5", true);
        Roof(h, 7.5f, 6.3f, 4.4f, 2.1f, roof);
        Box(h, "烟囱", new Vector3(2.2f,5.9f,1.4f), new Vector3(.75f,2.1f,.75f), "BC987C");
        Box(h, "烟囱帽", new Vector3(2.2f,7.01f,1.4f), new Vector3(.96f,.2f,.96f), "E6D3B2");
        Box(h, "烟囱开口", new Vector3(2.2f,7.12f,1.4f), new Vector3(.55f,.025f,.55f), "665A50");
        Label(h, label, new Vector3(0,2.25f,-2.85f), .06f, "554E43");
        Mailbox(h, new Vector3(3.9f,0,-3.7f), roof);
        Fence(h, new Vector3(-4.6f,0,-4.5f), new Vector3(-1.3f,0,-4.5f));
        Fence(h, new Vector3(1.3f,0,-4.5f), new Vector3(4.7f,0,-4.5f));
        Fence(h, new Vector3(-4.6f,0,-4.5f), new Vector3(-4.6f,0,3.7f));
        Flowerbed(h, new Vector3(-2.8f,0,-3.5f), new Vector2(2.7f,.75f), "FFF4C9");
        Flowerbed(h, new Vector3(2.8f,0,-3.5f), new Vector2(1.8f,.75f), "F0A6A0");
    }

    private void Laboratory(Vector3 p)
    {
        var h = Group(root, "大木博士研究所", p);
        Box(h, "研究所基台", new Vector3(0,.17f,0), new Vector3(10.2f,.34f,6.8f), "A4ADA2", true);
        Box(h, "研究所白墙", new Vector3(0,2.05f,0), new Vector3(9.8f,3.8f,6.4f), "F0EDD9", true);
        Box(h, "蓝绿腰线", new Vector3(0,.68f,0), new Vector3(9.96f,.38f,6.55f), "70A399");
        Roof(h, 10.7f,7.2f,4,2,"608E86");
        for(var s=-1;s<=1;s+=2)
        {
            Window(h,new Vector3(s*3.1f,2,-3.26f),2.2f,1.55f,"78ABA6");
            Box(h,"正门立柱",new Vector3(s*1.25f,1.8f,-3.48f),new Vector3(.28f,3.3f,.38f),White);
        }
        Door(h,new Vector3(0,.18f,-3.3f),"4A7982");
        Box(h,"正门雨棚",new Vector3(0,3.32f,-3.65f),new Vector3(3.15f,.24f,1.05f),"779E85");
        Box(h,"标识底板",new Vector3(0,3.74f,-3.68f),new Vector3(3.2f,.6f,.12f),"FAF2D7");
        Label(h,"OAK'S LAB",new Vector3(0,3.75f,-3.76f),.10f,"416C65");
        Box(h,"入口踏步",new Vector3(0,.1f,-3.98f),new Vector3(3.1f,.2f,1.25f),"D4CFB7",true);
        // Red/white crest is a real, separate mesh, so the landmark reads at a distance.
        Pokeball(h,new Vector3(0,5.05f,-3.67f),.55f);
        Cylinder(h,"研究所通风塔",new Vector3(3.1f,5.4f,1.2f),new Vector3(1.4f,1.4f,1.4f),"D7DFD0");
        Orb(h,"通风塔帽",new Vector3(3.1f,6.77f,1.2f),new Vector3(1.65f,.6f,1.65f),"60958C");
        Beam(h,"天线",new Vector3(-2.7f,5.8f,1),new Vector3(-2.7f,7.8f,1),.09f,"77878B");
        Beam(h,"天线横杆",new Vector3(-3.4f,7.3f,1),new Vector3(-2,7.3f,1),.075f,"77878B");
        Flowerbed(h,new Vector3(-3.4f,0,-3.9f),new Vector2(2.3f,.9f),"F3DA86");
        Flowerbed(h,new Vector3(3.5f,0,-3.9f),new Vector2(2.3f,.9f),"FFF4C9");
        Sign(root,new Vector3(4.3f,0,-10),"PROF. OAK", "大木博士研究所", "507A70",2.4f);
        Fence(root,new Vector3(15.5f,0,-8.5f),new Vector3(15.5f,0,.2f));
    }

    private void Roof(Transform h,float width,float depth,float eave,float rise,string color)
    {
        // Filled gables remove the open holes left by two intersecting roof slabs.
        var v = new [] {
            new Vector3(-width/2,eave,-depth/2),new Vector3(width/2,eave,-depth/2),new Vector3(0,eave+rise,-depth/2),
            new Vector3(-width/2,eave,depth/2),new Vector3(width/2,eave,depth/2),new Vector3(0,eave+rise,depth/2)};
        MeshObject(h,"山墙",v,new[]{0,2,1,3,4,5},"E9D7B5");
        var length = Mathf.Sqrt(width*width/4+rise*rise);
        for(var side=-1;side<=1;side+=2)
        {
            var panel=Box(h,"屋面",new Vector3(side*width/4,eave+rise/2,0),new Vector3(length,.18f,depth),color);
            panel.transform.localRotation=Quaternion.Euler(0,0,-side*Mathf.Atan2(rise,width/2)*Mathf.Rad2Deg);
            for(var row=0;row<8;row++)
            {
                float t=(row+.5f)/8;
                var a=new Vector3(side*width/2*(1-t),eave+rise*t+.13f,-depth/2-.04f);
                var b=new Vector3(a.x,a.y,depth/2+.04f);
                Beam(h,"瓦片横垄",a,b,.075f,color);
                for(var col=0;col<9;col++)
                {
                    var seam=Box(h,"瓦片拼缝",new Vector3(a.x,a.y+.018f,-depth/2+(col+.5f+(row%2)*.25f)*depth/9),new Vector3(length/8,.03f,.035f),color);
                    seam.transform.localRotation=panel.transform.localRotation;
                }
            }
            for(var face=-1;face<=1;face+=2)
                Beam(h,"山墙封边",new Vector3(0,eave+rise+.07f,face*(depth/2+.08f)),new Vector3(side*width/2,eave,face*(depth/2+.08f)),.17f,"F9EBD0");
        }
        Beam(h,"屋脊",new Vector3(0,eave+rise+.09f,-depth/2-.12f),new Vector3(0,eave+rise+.09f,depth/2+.12f),.26f,color);
    }

    private void Window(Transform h,Vector3 p,float w,float height,string shutter)
    {
        Box(h,"窗框",p,new Vector3(w+.2f,height+.2f,.12f),White);
        Box(h,"蓝色玻璃",p+new Vector3(0,0,-.075f),new Vector3(w,height,.07f),"74B9CD");
        Box(h,"玻璃反光",p+new Vector3(-w*.22f,.08f,-.115f),new Vector3(w*.14f,height*.8f,.014f),"BEE3DF");
        Box(h,"窗竖框",p+new Vector3(0,0,-.13f),new Vector3(.07f,height,.045f),White);
        Box(h,"窗横框",p+new Vector3(0,0,-.13f),new Vector3(w,.07f,.045f),White);
        Box(h,"窗台",p+new Vector3(0,-height/2-.12f,-.08f),new Vector3(w+.4f,.15f,.4f),White);
        for(var side=-1;side<=1;side+=2)
        {
            Box(h,"百叶窗",p+new Vector3(side*(w/2+.25f),0,0),new Vector3(.27f,height,.1f),shutter);
            for(var k=0;k<4;k++) Box(h,"百叶窗横条",p+new Vector3(side*(w/2+.25f),-.4f+k*.26f,-.07f),new Vector3(.3f,.035f,.03f),White);
        }
    }

    private void Door(Transform h,Vector3 p,string color)
    {
        Box(h,"门框",p+Vector3.up,new Vector3(1.45f,2.2f,.19f),White);
        Box(h,"门板",p+new Vector3(0,1,-.12f),new Vector3(1.15f,2,.13f),color);
        Box(h,"门玻璃",p+new Vector3(0,1.52f,-.2f),new Vector3(.78f,.65f,.04f),"ACD6D7");
        Box(h,"门下镶板",p+new Vector3(0,.48f,-.2f),new Vector3(.82f,.58f,.025f),color);
        Orb(h,"黄铜门把",p+new Vector3(.4f,.95f,-.24f),Vector3.one*.12f,"EBC875");
    }

    private void Garden()
    {
        Box(root,"西侧花园",new Vector3(-10,.02f,-5),new Vector3(10,.04f,10),"7BA95D");
        Path(new Vector3(-10,.049f,-5),new Vector3(1.5f,.08f,9));
        Flowerbed(root,new Vector3(-12.5f,0,-3),new Vector2(3.2f,2),"FFF4C9");
        Flowerbed(root,new Vector3(-7.5f,0,-3),new Vector2(2.6f,2),"EBA3A2");
        Flowerbed(root,new Vector3(-12.5f,0,-6.7f),new Vector2(3.2f,2),"F3D675");
        Flowerbed(root,new Vector3(-7.5f,0,-6.7f),new Vector2(2.6f,2),"B9B7DF");
        Fence(root,new Vector3(-15.3f,0,-10),new Vector3(-10.7f,0,-10));
        Fence(root,new Vector3(-9.3f,0,-10),new Vector3(-5,0,-10));
        Fence(root,new Vector3(-15.3f,0,-10),new Vector3(-15.3f,0,0));
        Tree(new Vector3(-17,0,-6),1.05f);
    }

    private void Shore()
    {
        Box(root,"沙岸",new Vector3(0,-.04f,-17.2f),new Vector3(43,.12f,5.5f),"E4D9B5",true);
        var water=Box(root,"21号水路",new Vector3(0,-.22f,-28),new Vector3(70,.08f,20),"4AADB4");
        var waterMat=new Material(Resources.Load<Shader>("PalletWater"));
        waterMat.color=Hex("4AADB4");water.GetComponent<Renderer>().sharedMaterial=waterMat;
        for(var i=0;i<26;i++)
        {
            float x=-22+i*1.75f;
            Orb(root,"河岸卵石",new Vector3(x,-.02f,-18.4f+Mathf.Sin(i*.8f)*.4f),new Vector3(2.1f,.55f,1.2f),i%2==0?"BCC5AD":"D1CFB5");
        }
        for(var i=0;i<13;i++) Box(root,"码头木板",new Vector3(-1.5f,.06f,-16.8f-i*.42f),new Vector3(3,.16f,.38f),i%2==0?"B79468":"C3A175",true);
        for(var side=-1;side<=1;side+=2)
            for(var i=0;i<3;i++) Cylinder(root,"码头木桩",new Vector3(-1.5f+side*1.6f,.25f,-17-i*2),new Vector3(.28f,.8f,.28f),"947955",true);
        Fence(root,new Vector3(-19,0,-15),new Vector3(-4.4f,0,-15));
        Fence(root,new Vector3(1.4f,0,-15),new Vector3(19,0,-15));
        Sign(root,new Vector3(3.3f,0,-14.5f),"ROUTE 21", "南方的海 · 21号水路", "557F82",2.8f);
        for(var i=0;i<5;i++)
        {
            var rock=Orb(root,"岸边岩石",new Vector3(-17+i*.8f,.15f,-16.6f+Range(-.4f,.4f)),new Vector3(1.2f,.7f,1),"ACB6A2");
            rock.transform.localRotation=Quaternion.Euler(0,i*27,12);
        }
    }

    private void Boundary()
    {
        for(var z=-12;z<=20;z+=4)
        {
            Tree(new Vector3(-20,0,z),Range(.9f,1.18f));
            Tree(new Vector3(20,0,z+.7f),Range(.9f,1.18f));
        }
        for(var x=-19;x<=19;x+=4)
        {
            if(Mathf.Abs(x)<4)continue;
            Tree(new Vector3(x,0,19),Range(1,1.25f));
            Tree(new Vector3(x+1,0,23),Range(1.15f,1.4f));
        }
        Tree(new Vector3(-16,0,13),.95f);
        Tree(new Vector3(16,0,14),1.1f);
        if (connectedWorld) return;
        // Invisible edge colliders stop falls without blocking the northern path.
        BoundaryCollider(new Vector3(-21,2,2),new Vector3(1,5,45));
        BoundaryCollider(new Vector3(21,2,2),new Vector3(1,5,45));
        BoundaryCollider(new Vector3(0,2,-22),new Vector3(44,5,1));
        BoundaryCollider(new Vector3(-13,2,22),new Vector3(18,5,1));
        BoundaryCollider(new Vector3(13,2,22),new Vector3(18,5,1));
    }

    private void Tree(Vector3 p,float scale)
    {
        var t=Group(root,"蓬松阔叶树",p);t.localScale=Vector3.one*scale;
        Cylinder(t,"树干",new Vector3(0,1.35f,0),new Vector3(.55f,1.35f,.55f),"886C48",true);
        Beam(t,"树枝",new Vector3(0,1.4f,0),new Vector3(.75f,2.6f,0),.2f,"886C48");
        Orb(t,"树冠暗部",new Vector3(0,2.75f,0),new Vector3(3.7f,2.2f,3.5f),DarkLeaf);
        Orb(t,"树冠左簇",new Vector3(-.85f,3.4f,-.1f),new Vector3(2.5f,2.5f,2.6f),Leaf);
        Orb(t,"树冠右簇",new Vector3(.9f,3.35f,.1f),new Vector3(2.65f,2.6f,2.5f),Leaf);
        Orb(t,"树冠顶簇",new Vector3(-.15f,4.2f,.25f),new Vector3(2.7f,2.2f,2.7f),LightLeaf);
        for(var i=0;i<3;i++) Orb(t,"灌木",new Vector3(-.7f+i*.65f,.4f,-.4f),new Vector3(1,.8f,.9f),i%2==0?Leaf:LightLeaf);
    }

    private void Flowerbed(Transform parent,Vector3 p,Vector2 size,string petals)
    {
        Box(parent,"花圃土壤",p+Vector3.up*.055f,new Vector3(size.x,.11f,size.y),"728950");
        for(float x=-size.x/2+.25f;x<size.x/2;x+=.52f)
            for(float z=-size.y/2+.2f;z<size.y/2;z+=.49f)
            {
                var f=p+new Vector3(x+Range(-.08f,.08f),.27f,z+Range(-.05f,.05f));
                Orb(parent,"花叶",f+new Vector3(0,-.1f,0),new Vector3(.43f,.24f,.4f),"52844C");
                for(var k=0;k<5;k++)
                {
                    float a=k*Mathf.PI*2/5;
                    Orb(parent,"花瓣",f+new Vector3(Mathf.Cos(a)*.12f,.09f,Mathf.Sin(a)*.12f),new Vector3(.19f,.09f,.19f),petals);
                }
                Orb(parent,"花蕊",f+Vector3.up*.13f,new Vector3(.1f,.08f,.1f),"DBB655");
            }
    }

    private void GrassTuft(Transform parent,Vector3 p,float scale)
    {
        for(var i=0;i<3;i++)
        {
            var blade=Box(parent,"草叶",p+new Vector3((i-1)*.12f,.18f*scale,0),new Vector3(.08f,.38f*scale,.045f),i==1?"658E4B":"729F52");
            blade.transform.localRotation=Quaternion.Euler(0,i*60,(i-1)*25);
        }
    }

    private void Fence(Transform parent,Vector3 a,Vector3 b)
    {
        int count=Mathf.CeilToInt(Vector3.Distance(a,b)/.52f);
        for(var i=0;i<=count;i++)
        {
            var p=Vector3.Lerp(a,b,(float)i/count);
            Box(parent,"白色栅栏",p+Vector3.up*.55f,new Vector3(.19f,1.1f,.19f),White);
            var cap=Box(parent,"栅栏尖顶",p+Vector3.up*1.1f,new Vector3(.15f,.15f,.15f),White);
            cap.transform.localRotation=Quaternion.Euler(0,0,45);
        }
        Beam(parent,"栅栏上横木",a+Vector3.up*.8f,b+Vector3.up*.8f,.14f,White);
        Beam(parent,"栅栏下横木",a+Vector3.up*.32f,b+Vector3.up*.32f,.13f,White);
        var centre=(a+b)/2+Vector3.up*.5f;
        var go=new GameObject("栅栏碰撞");go.transform.SetParent(parent,false);go.transform.localPosition=centre;
        go.transform.localRotation=Quaternion.LookRotation(b-a);
        go.AddComponent<BoxCollider>().size=new Vector3(.2f,1.1f,Vector3.Distance(a,b));
    }

    private void Mailbox(Transform parent,Vector3 p,string color)
    {
        Box(parent,"信箱立柱",p+Vector3.up*.5f,new Vector3(.16f,1,.16f),Timber);
        Box(parent,"信箱",p+Vector3.up*1.15f,new Vector3(.55f,.45f,.55f),color);
        Box(parent,"信口",p+new Vector3(0,1.17f,-.29f),new Vector3(.32f,.045f,.02f),"344F53");
        Box(parent,"信箱小旗",p+new Vector3(.34f,1.5f,0),new Vector3(.05f,.25f,.19f),"CF7351");
    }

    private void Sign(Transform parent,Vector3 p,string title,string subtitle,string color,float width)
    {
        var s=Group(parent,title,p);
        for(var side=-1;side<=1;side+=2) Box(s,"牌柱",new Vector3(side*(width/2-.3f),.77f,0),new Vector3(.16f,1.54f,.18f),Timber);
        Box(s,"指示牌框",new Vector3(0,1.5f,0),new Vector3(width+.15f,.95f,.2f),White);
        Box(s,"指示牌",new Vector3(0,1.5f,-.115f),new Vector3(width,.8f,.08f),color);
        Label(s,title,new Vector3(0,1.64f,-.17f),.088f,White);
        Label(s,subtitle,new Vector3(0,1.32f,-.17f),.046f,"F0E1BA");
    }

    private void Bench(Transform parent,Vector3 p,float yaw)
    {
        var b=Group(parent,"长椅",p);b.localRotation=Quaternion.Euler(0,yaw,0);
        for(var i=0;i<3;i++) Box(b,"长椅座板",new Vector3(0,.53f,i*.21f),new Vector3(2.2f,.12f,.18f),"B4966A");
        for(var i=0;i<2;i++) Box(b,"长椅靠背",new Vector3(0,.88f+i*.25f,.5f),new Vector3(2.2f,.2f,.12f),"B4966A");
        for(var side=-1;side<=1;side+=2) Box(b,"长椅脚",new Vector3(side*.8f,.27f,.2f),new Vector3(.16f,.54f,.6f),"537063",true);
    }

    private void Lamp(Vector3 p)
    {
        Cylinder(root,"路灯底座",p+Vector3.up*.15f,new Vector3(.55f,.15f,.55f),"557365");
        Cylinder(root,"路灯杆",p+Vector3.up*1.65f,new Vector3(.12f,1.65f,.12f),"557365");
        Box(root,"灯室",p+Vector3.up*3.35f,new Vector3(.48f,.65f,.48f),"FCE9B0");
        Box(root,"灯帽",p+Vector3.up*3.72f,new Vector3(.66f,.15f,.66f),"557365");
        for(var side=-1;side<=1;side+=2) Box(root,"灯框",p+new Vector3(side*.22f,3.35f,-.23f),new Vector3(.045f,.67f,.045f),"557365");
    }

    public static void Pokeball(Transform parent,Vector3 p,float radius)
    {
        var b=new PalletTownBuilder(parent);
        for(var half=0;half<2;half++)
        {
            var vertices=new List<Vector3>();var triangles=new List<int>();
            for(var lat=0;lat<=8;lat++)
                for(var lon=0;lon<=24;lon++)
                {
                    float phi=(lat/8f+half)*Mathf.PI/2;float theta=lon/24f*Mathf.PI*2;
                    vertices.Add(p+new Vector3(Mathf.Sin(phi)*Mathf.Cos(theta),Mathf.Cos(phi),Mathf.Sin(phi)*Mathf.Sin(theta))*radius);
                    if(lat<8&&lon<24){int n=lat*25+lon;triangles.AddRange(new[]{n,n+1,n+25,n+1,n+26,n+25});}
                }
            b.MeshObject(parent,"精灵球半球",vertices.ToArray(),triangles.ToArray(),half==0?"D95145":"F8EDCF");
        }
        b.Cylinder(parent,"精灵球黑带",p,new Vector3(radius*2.02f,radius*.075f,radius*2.02f),"354C50");
        b.Orb(parent,"精灵球按钮边",p+Vector3.back*radius,new Vector3(radius*.6f,radius*.6f,radius*.17f),"354C50");
        b.Orb(parent,"精灵球按钮",p+Vector3.back*radius*1.09f,new Vector3(radius*.4f,radius*.4f,radius*.09f),"FFF8DF");
    }

    public static void Trainer(Transform parent,string role,Color clothes)
    {
        var b=new PalletTownBuilder(parent);
        string coat=ColorUtility.ToHtmlStringRGB(clothes);
        b.Orb(parent,"躯干",new Vector3(0,1.05f,0),new Vector3(.73f,.98f,.5f),coat);
        b.Orb(parent,"脸",new Vector3(0,1.82f,0),new Vector3(.63f,.7f,.57f),"EDC59A");
        b.Orb(parent,"头发",new Vector3(0,2.06f,.06f),new Vector3(.67f,.4f,.56f),role=="orin"?"DDD8C7":"615443");
        for(var side=-1;side<=1;side+=2)
        {
            b.Box(parent,"裤腿",new Vector3(side*.2f,.47f,0),new Vector3(.27f,.58f,.3f),"4D6070");
            b.Orb(parent,"鞋",new Vector3(side*.2f,.14f,-.1f),new Vector3(.32f,.25f,.5f),"6A594D");
            var arm=b.Orb(parent,"袖子",new Vector3(side*.44f,1.04f,0),new Vector3(.27f,.67f,.3f),coat);
            arm.transform.localRotation=Quaternion.Euler(0,0,side*12);
            b.Orb(parent,"手",new Vector3(side*.5f,.72f,-.02f),Vector3.one*.23f,"EDC59A");
            b.Orb(parent,"眼睛",new Vector3(side*.14f,1.86f,-.272f),new Vector3(.064f,.11f,.035f),"354C50");
        }
        if(role=="player")
        {
            b.Orb(parent,"训练师红帽",new Vector3(0,2.13f,.02f),new Vector3(.72f,.37f,.66f),"CE594B");
            b.Box(parent,"白色帽檐",new Vector3(0,2.07f,-.34f),new Vector3(.67f,.09f,.36f),White);
            b.Orb(parent,"背包",new Vector3(0,1.17f,.34f),new Vector3(.56f,.67f,.26f),"C9AD6C");
        }
        if(role=="orin")
        {
            b.Box(parent,"博士衬衣",new Vector3(0,1.22f,-.26f),new Vector3(.25f,.59f,.04f),"A25857");
            b.Box(parent,"白大褂下摆",new Vector3(0,.77f,0),new Vector3(.75f,.27f,.46f),"F7F1DD");
        }
    }

    private void Label(Transform parent,string value,Vector3 p,float size,string color)
    {
        if(labelFont==null)
        {
            labelFont=Font.CreateDynamicFontFromOSFont(new[]{"Microsoft YaHei","Arial"},48);
            labelMaterial=new Material(Resources.Load<Shader>("PalletText"));
            Font.textureRebuilt += RefreshFontTexture;
        }
        labelFont.RequestCharactersInTexture(value,48,FontStyle.Normal);
        RefreshFontTexture(labelFont);
        var t=Group(parent,"标牌文字",p).gameObject.AddComponent<TextMesh>();
        t.text=value;t.font=labelFont;t.fontSize=48;t.characterSize=size;
        t.anchor=TextAnchor.MiddleCenter;t.alignment=TextAlignment.Center;t.color=Hex(color);
        t.GetComponent<MeshRenderer>().sharedMaterial=labelMaterial;
    }

    private static void RefreshFontTexture(Font font)
    {
        if(font==labelFont && labelMaterial!=null) labelMaterial.mainTexture=font.material.mainTexture;
    }

    private void BoundaryCollider(Vector3 p,Vector3 size)
    {
        var c=Group(root,"小镇边界",p).gameObject.AddComponent<BoxCollider>();c.size=size;
    }
    private Transform Group(Transform parent,string name,Vector3 p)
    {
        var g=new GameObject(name).transform;g.SetParent(parent,false);g.localPosition=p;return g;
    }
    private GameObject Box(Transform p,string n,Vector3 pos,Vector3 size,string color,bool solid=false) { return Primitive(p,n,PrimitiveType.Cube,pos,size,color,solid); }
    private GameObject Orb(Transform p,string n,Vector3 pos,Vector3 size,string color) { return Primitive(p,n,PrimitiveType.Sphere,pos,size,color,false); }
    private GameObject Cylinder(Transform p,string n,Vector3 pos,Vector3 size,string color,bool solid=false) { return Primitive(p,n,PrimitiveType.Cylinder,pos,size,color,solid); }
    private GameObject Primitive(Transform parent,string name,PrimitiveType type,Vector3 p,Vector3 scale,string color,bool solid)
    {
        var g=GameObject.CreatePrimitive(type);g.name=name;g.transform.SetParent(parent,false);g.transform.localPosition=p;g.transform.localScale=scale;
        g.GetComponent<Renderer>().sharedMaterial=Material(color);
        if(!solid){var collider=g.GetComponent<Collider>();collider.enabled=false;Object.Destroy(collider);}
        return g;
    }
    private void Beam(Transform parent,string name,Vector3 a,Vector3 b,float width,string color)
    {
        var g=Box(parent,name,(a+b)/2,new Vector3(width,width,Vector3.Distance(a,b)),color);
        g.transform.localRotation=Quaternion.LookRotation(b-a);
    }
    private GameObject MeshObject(Transform parent,string name,Vector3[] vertices,int[] triangles,string color)
    {
        var g=Group(parent,name,Vector3.zero).gameObject;
        var m=new Mesh{name=name};m.vertices=vertices;m.triangles=triangles;m.RecalculateNormals();m.RecalculateBounds();
        g.AddComponent<MeshFilter>().sharedMesh=m;g.AddComponent<MeshRenderer>().sharedMaterial=Material(color);return g;
    }
    private Material Material(string color)
    {
        if(materials.TryGetValue(color,out var m))return m;
        m=new Material(Resources.Load<Shader>("PalletMatte")){color=Hex(color),name="Pallet #"+color};materials.Add(color,m);return m;
    }
    private static Color Hex(string color) { ColorUtility.TryParseHtmlString("#"+color,out var result);return result; }
    private float Range(float min,float max) { return min+(float)random.NextDouble()*(max-min); }
}
