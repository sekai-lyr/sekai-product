using UnityEngine;

// Geometry, not a colour/texture overlay. Both LODs retain the same main branches and crown.
public static class WorldNatureModels
{
    private static Color C(string hex,float wind=0){var c=OpenWorldBuilder.Hex(hex);c.a=wind;return c;}
    private static Vector3 Radial(float a,float r,float y){return new Vector3(Mathf.Cos(a)*r,y,Mathf.Sin(a)*r);}
    private static void Face(WorldMeshData d,Vector3 a,Vector3 b,Vector3 c,Color tint)
    {
        int n=d.Vertices.Count;d.Vertices.AddRange(new[]{a,b,c});d.Colors.Add(tint);d.Colors.Add(tint);d.Colors.Add(tint);d.Tri(n,n+1,n+2);
    }

    public static Mesh Tree(bool cedar,bool detailed)
    {
        var d=new WorldMeshData();var bark=C("75614B");
        var trunk=new[]{Vector3.zero,new Vector3(-.08f,1.1f,.04f),new Vector3(.08f,2.5f,.02f),new Vector3(.16f,4,.08f),new Vector3(.06f,5.5f,.13f),new Vector3(.22f,7.1f,.02f),new Vector3(.16f,8.6f,0)};
        Stem(d,trunk,new[]{.50f,.34f,.28f,.23f,.18f,.10f,.015f},bark,detailed?12:6);
        if(detailed)for(int i=0;i<7;i++)
        {
            float a=i*2.399f;
            Stem(d,new[]{Radial(a,.18f,.5f),Radial(a,.65f,.12f),Radial(a,1.15f,-.09f)},new[]{.22f,.14f,.01f},bark,6);
        }
        if(cedar)
        {
            for(int level=0;level<7;level++)for(int k=0;k<7;k++)
            {
                float a=k*Mathf.PI*2/7+level*.61f,r=2.85f-level*.35f;
                var start=new Vector3(.1f,2.35f+level*.94f,0);
                var tip=start+Radial(a,r,.55f);
                if(detailed)Stem(d,new[]{start,Vector3.Lerp(start,tip,.48f)-Vector3.up*.16f,tip},new[]{.085f,.045f,.008f},bark,5);
                var tint=Color.Lerp(C("315F50",.65f),C("779951",.85f),level/8f);
                Spray(d,start+Radial(a,.2f,.15f),tip+Vector3.up*.18f,r*(detailed?.38f:.44f),tint,detailed?5:3);
                if(detailed)for(int s=-1;s<=1;s+=2)
                    Spray(d,Vector3.Lerp(start,tip,.25f),start+Radial(a+s*.32f,r*.91f,.29f),r*.26f,tint*.94f,3);
            }
            Stem(d,new[]{new Vector3(.16f,8.35f,0),new Vector3(.16f,8.85f,0),new Vector3(.16f,9.65f,0)},new[]{.45f,.26f,.002f},C("8BA960",.8f),detailed?10:6);
        }
        else
        {
            for(int k=0;k<12;k++)
            {
                float a=k*2.399f,r=k<7?2.45f:1.28f,y=k<7?4.55f+(k%3)*.48f:6.7f+(k%2)*.35f;
                var start=new Vector3(.12f,2.7f+(k%4)*.48f,0);var end=Radial(a,r,y);
                var elbow=Vector3.Lerp(start,end,.55f)-Vector3.up*.22f;
                Stem(d,new[]{start,elbow,end},new[]{.19f,.12f,.018f},bark,detailed?8:5);
                for(int l=0;l<4;l++)
                {
                    float turn=a+l*2.399f;
                    var centre=end+Radial(turn,l==3?0:.70f,l==3?.65f:.12f+(l%2)*.27f);
                    if(detailed)Stem(d,new[]{elbow,centre-Vector3.up*.25f},new[]{.075f,.012f},bark,5);
                    var tint=Color.Lerp(C("376F4C",.45f),C("A4BD64",.85f),Mathf.InverseLerp(3.5f,8.8f,centre.y));
                    Crown(d,centre,new Vector3(l==3?1.18f:1.05f,.70f,.99f),tint,10,detailed?5:3,k+l*.61f);
                    if(detailed)for(int leaf=0;leaf<7;leaf++)
                    {
                        float b=leaf*2.399f+turn;var p=centre+Radial(b,.78f,.10f+Mathf.Sin(b*3)*.22f);
                        Leaf(d,p,Radial(b,.51f,.06f),.18f,tint);
                    }
                }
            }
            Crown(d,new Vector3(.1f,8.1f,0),new Vector3(1.4f,.8f,1.3f),C("A9BE68",.9f),12,detailed?5:3,1.7f);
        }
        return d.ToMesh((cedar?"Layered cedar":"Branched broadleaf")+(detailed?" LOD0":" LOD1"));
    }

    // Continuous rings: taper, bend, fluted bark and root flare share vertices.
    private static void Stem(WorldMeshData d,Vector3[] points,float[] radii,Color color,int sides)
    {
        int n=d.Vertices.Count;
        for(int j=0;j<points.Length;j++)
        {
            var tangent=points[Mathf.Min(j+1,points.Length-1)]-points[Mathf.Max(0,j-1)];
            var q=Quaternion.FromToRotation(Vector3.up,tangent);
            for(int i=0;i<sides;i++)
            {
                float a=i*Mathf.PI*2/sides;float flute=1+Mathf.Sin(a*5+.3f)*.10f;
                d.Vertices.Add(points[j]+q*Radial(a,radii[j]*flute,0));
                var c=color*Mathf.Lerp(.78f,1.09f,(Mathf.Sin(a*5)+1)*.5f);c.a=0;d.Colors.Add(c);
            }
        }
        for(int j=0;j<points.Length-1;j++)for(int i=0;i<sides;i++)
        {
            int a=n+j*sides+i,b=n+j*sides+(i+1)%sides;d.Tri(a,a+sides,b);d.Tri(b,a+sides,b+sides);
        }
    }
    private static void Crown(WorldMeshData d,Vector3 centre,Vector3 radii,Color tint,int sides,int rings,float seed)
    {
        int first=d.Vertices.Count;
        d.Oval(centre,radii,tint,sides,rings,seed);
        for(int i=first;i<d.Vertices.Count;i++)
        {
            var p=d.Vertices[i]-centre;float a=Mathf.Atan2(p.z,p.x);
            float lobes=1+Mathf.Sin(a*5+seed)*.14f;
            p.x*=lobes;p.z*=lobes;d.Vertices[i]=centre+p;
            float light=Mathf.InverseLerp(-radii.y,radii.y,p.y);
            var c=tint*Mathf.Lerp(.68f,1.05f,light);c.a=tint.a;d.Colors[i]=c;
        }
    }
    // A folded leaf with a raised centre vein, rather than a flat triangle.
    private static void Leaf(WorldMeshData d,Vector3 p,Vector3 direction,float width,Color tint)
    {
        var side=Vector3.Cross(direction.normalized,Vector3.up).normalized*width;
        if(side.sqrMagnitude<.0001f)side=Vector3.right*width;
        var end=p+direction;var middle=p+direction*.5f;var ridge=middle+Vector3.up*(width*.35f);
        int n=d.Vertices.Count;d.Vertices.AddRange(new[]{p,middle-side,ridge,end,middle+side});
        for(int i=0;i<5;i++)d.Colors.Add(tint);
        d.Tri(n,n+2,n+1);d.Tri(n+1,n+2,n+3);d.Tri(n,n+4,n+2);d.Tri(n+2,n+4,n+3);
    }
    private static void Spray(WorldMeshData d,Vector3 a,Vector3 b,float width,Color tint,int teeth)
    {
        var side=Vector3.Cross((b-a).normalized,Vector3.up).normalized;
        if(side.sqrMagnitude<.001f)side=Vector3.right;
        int steps=teeth*2;
        var section=new Vector3[steps+1,4];
        for(int i=0;i<=steps;i++)
        {
            float t=i/(float)steps;var p=Vector3.Lerp(a,b,t);
            float profile=Mathf.Sin(t*Mathf.PI),w=width*profile*(i%2==0?1:.63f);
            section[i,0]=p-side*w;section[i,1]=p+Vector3.up*(profile*(.20f+width*.26f));
            section[i,2]=p+side*w;section[i,3]=p-Vector3.up*(profile*.11f);
        }
        for(int i=0;i<steps;i++)for(int face=0;face<4;face++)
        {
            var c=tint*(face==0?1.06f:face==1?.97f:.69f);c.a=tint.a;
            d.Quad(section[i,face],section[i+1,face],section[i+1,(face+1)%4],section[i,(face+1)%4],c);
        }
    }

    public static Mesh Rock(bool detailed)
    {
        var d=new WorldMeshData();const int sides=9;
        var heights=new[]{-.28f,.12f,.65f,1.05f,1.31f};var radii=new[]{.76f,1.02f,.91f,.72f,.32f};
        var rings=new Vector3[5,sides];
        for(int j=0;j<5;j++)for(int i=0;i<sides;i++)
        {
            float a=i*Mathf.PI*2/sides;
            float r=radii[j]*(1+Mathf.Sin(a*3+.8f)*.16f+Mathf.Cos(a*2+j*.6f)*.12f);
            rings[j,i]=Radial(a,r,heights[j]+Mathf.Sin(a*2+j*.7f)*.13f)+new Vector3(j*.035f,0,-j*.045f);
        }
        for(int j=0;j<4;j++)for(int i=0;i<sides;i++)
        {
            int next=(i+1)%sides;var a=rings[j,i];var b=rings[j+1,i];var c=rings[j+1,next];var e=rings[j,next];
            var tint=Color.Lerp(C("717F7D"),C("B5BCAE"),j/4f+(i%3)*.045f);
            // Break broad faces around an offset ridge instead of making a lathed barrel.
            var centre=(a+b+c+e)*.25f;
            var normal=Vector3.Cross(b-a,e-a).normalized;
            var ridge=centre+normal*((i+j)%3==0?.08f:-.015f);
            if(detailed)
            {
                Face(d,a,b,ridge,tint*.97f);Face(d,b,c,ridge,tint*1.025f);
                Face(d,c,e,ridge,tint);Face(d,e,a,ridge,tint*.94f);
            }
            else d.Quad(a,b,c,e,tint);
            if(detailed&&j==2&&i%2==0)
            {
                // Thin mineral seams sit on the actual fracture planes, not a projected image.
                var x=Vector3.Lerp(a,b,.43f)+normal*.006f;var y=ridge+normal*.006f;
                d.Quad(x,y,y+(b-a)*.021f,x+(b-a)*.021f,C("C1C0A9"));
            }
            if(detailed&&j>=2&&(i+j)%3!=0)
            {
                // Irregular moss islands follow a triangle's plane, with broken organic edges.
                var m=(b+c+ridge)/3+normal*.008f;
                var u=(c-b)*.43f;var v=(ridge-(b+c)*.5f)*.64f;
                var moss=C(j==3?"819667":"6F835E");int n=d.Vertices.Count;
                d.Vertices.Add(m);d.Colors.Add(moss);
                for(int edge=0;edge<11;edge++)
                {
                    float angle=edge*Mathf.PI*2/11,scale=.72f+Mathf.Sin(edge*2.4f+i)*.23f;
                    d.Vertices.Add(m+(u*Mathf.Cos(angle)+v*Mathf.Sin(angle))*scale);
                    d.Colors.Add(Color.Lerp(moss,C("9AAA78"),(edge%3)*.10f));
                }
                for(int edge=0;edge<11;edge++)d.Tri(n,n+1+edge,n+1+(edge+1)%11);
            }
        }
        var top=new Vector3(.12f,1.37f,-.18f);
        for(int i=0;i<sides;i++)Face(d,rings[4,i],top,rings[4,(i+1)%sides],C("A7B09B"));
        if(detailed)for(int i=0;i<4;i++)
        {
            var p=Radial(i*2.399f,1.04f,-.14f);
            d.Oval(p,new Vector3(.16f,.17f,.23f),C("919C8B"),5,3,i);
        }
        return d.ToMesh(detailed?"Fractured moss stone LOD0":"Fractured stone LOD1");
    }

    public static Mesh Grass(bool detailed)
    {
        var d=new WorldMeshData();
        for(int i=0;i<(detailed?13:7);i++)
        {
            float angle=i*2.399f,h=.37f+(i%5)*.10f;
            var p=Radial(angle,(i%4)*.25f,0);var across=Radial(angle,.036f+(i%3)*.012f,0);var bend=Radial(angle+.8f,.24f,0);
            int n=d.Vertices.Count,steps=detailed?4:2;
            for(int k=0;k<=steps;k++)
            {
                float t=k/(float)steps;var centre=p+Vector3.up*(h*(t-.10f*t*t))+bend*t*t;
                var width=across*(1-t);var color=Color.Lerp(C("446642"),C("A9BC6C",1),t);color.a=t*t;
                d.Vertices.Add(centre-width);d.Vertices.Add(centre+width);d.Colors.Add(color);d.Colors.Add(color);
                if(k<steps){int v=n+k*2;d.Tri(v,v+2,v+1);d.Tri(v+1,v+2,v+3);}
            }
        }
        var flower=new Vector3(.08f,.57f,.09f);
        d.Tube(new Vector3(.08f,0,.09f),flower,.012f,.007f,C("69824B"),4,.6f);
        if(detailed)
        {
            Leaf(d,new Vector3(.08f,.26f,.09f),new Vector3(.18f,.10f,.09f),.055f,C("789752",.3f));
            for(int i=0;i<5;i++)Leaf(d,flower,Radial(i*Mathf.PI*2/5,.075f,-.01f),.034f,C("EDE6C1",.6f));
        }
        d.Oval(flower+Vector3.up*.009f,new Vector3(.027f,.02f,.027f),C("DABA68",.6f),5,3);
        return d.ToMesh(detailed?"Curved meadow blades LOD0":"Meadow blades LOD1");
    }
}
