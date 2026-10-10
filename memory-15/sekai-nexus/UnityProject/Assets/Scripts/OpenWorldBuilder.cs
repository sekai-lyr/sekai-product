using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

// Deterministic, continuous terrain. World metres, north = +Z.
public sealed class OpenWorldBuilder : MonoBehaviour
{
    public const float MinX=-384, MinZ=-160, Size=768, WaterY=-1.6f;
    public static readonly Vector2[] Landmarks = { new Vector2(0,4),new Vector2(0,96),new Vector2(-112,268),new Vector2(159,163),new Vector2(64,424),new Vector2(-93,-70) };
    public static readonly string[] Names = { "真新镇", "启程原野", "常青森林", "澄蓝湖畔", "风见山脊", "南风海岸" };
    public static readonly string[] EnglishNames = { "PALLET TOWN", "THE OPEN MEADOWS", "VIRIDIAN WOODLAND", "AZURE LAKE", "WINDWARD RIDGE", "SOUTHWIND COAST" };
    public static readonly Vector2[][] Routes = {
        new[]{new Vector2(0,20),new Vector2(0,38),new Vector2(10,65),new Vector2(0,96),new Vector2(-15,130),new Vector2(-50,170),new Vector2(-82,215),new Vector2(-112,268),new Vector2(-105,310),new Vector2(-45,348),new Vector2(25,372),new Vector2(64,424)},
        new[]{new Vector2(0,96),new Vector2(35,116),new Vector2(66,138),new Vector2(118,138),new Vector2(159,163)},
        new[]{new Vector2(0,38),new Vector2(-32,26),new Vector2(-54,-8),new Vector2(-74,-40),new Vector2(-93,-70)}
    };
    private sealed class Batch { public Mesh Mesh,FarMesh; public Material Material; public Matrix4x4[] Matrices; public Vector3 Centre; public float Range,DetailRange; public bool Shadows; }
    private readonly List<Batch> batches=new List<Batch>();
    private readonly List<UnityEngine.Object> owned=new List<UnityEngine.Object>();
    private Material terrainMat, treeMat, grassMat;
    private readonly Mesh[] natureMeshes=new Mesh[4],natureFarMeshes=new Mesh[4];
    private readonly Matrix4x4[] nearInstances=new Matrix4x4[1023],farInstances=new Matrix4x4[1023];
    private Font signFont;
    private Material signMaterial;
    private readonly System.Random random=new System.Random(19970401);
    public int TreeCount { get; private set; }
    public int GrassCount { get; private set; }
    public int TerrainTiles { get; private set; }
    public int VisibleBatches { get; private set; }
    public int TerrainTriangles { get; private set; }
    public int DetailedInstances { get; private set; }
    public int SimplifiedInstances { get; private set; }
    public long VegetationTriangles { get; private set; }
    public Texture2D MapTexture { get; private set; }

    public static Vector3 Surface(Vector2 p,float offset=0) { return new Vector3(p.x,Height(p.x,p.y)+offset,p.y); }
    private static float Smooth(float a,float b,float x) { float t=Mathf.InverseLerp(a,b,x);return t*t*(3-2*t); }
    public static float LakeDistance(float x,float z)
    {
        var p=new Vector2((x-225)/84,(z-248)/106);float a=Mathf.Atan2(p.y,p.x);
        return p.magnitude*(1+Mathf.Sin(a*3)*.07f+Mathf.Sin(a*5+.7f)*.05f);
    }
    public static float RiverX(float z) { return 91+Mathf.Sin((z-138)*.012f)*20+Smooth(220,316,z)*65; }
    public static float Height(float x,float z)
    {
        float h=NaturalHeight(x,z);
        for(int i=2;i<=4;i++)
        {
            float distance=Vector2.Distance(new Vector2(x,z),Landmarks[i]);
            float inner=i==4?18:7,outer=i==4?28:17;
            if(distance<outer)h=Mathf.Lerp(h,NaturalHeight(Landmarks[i].x,Landmarks[i].y),1-Smooth(inner,outer,distance));
        }
        return h;
    }
    private static float NaturalHeight(float x,float z)
    {
        float n=Mathf.PerlinNoise(x*.006f+29,z*.006f+47);
        float detail=Mathf.PerlinNoise(x*.028f+68,z*.028f+17);
        float h=1+n*7+detail*1.2f;
        h+=25*Mathf.Exp(-((x+200)*(x+200)/16000+(z-210)*(z-210)/28000));
        h+=48*Mathf.Exp(-((x-60)*(x-60)/23000+(z-430)*(z-430)/19000));
        float edge=Mathf.Max(Mathf.Abs(x)/384,Mathf.Max(0,(z-385)/210));
        h+=Smooth(.60f,1,edge)*(35+90*Mathf.PerlinNoise(x*.013f+81,z*.013f+26));
        float town=1-Smooth(21,78,Mathf.Max(Mathf.Abs(x),Mathf.Abs(z-3)));
        h=Mathf.Lerp(h,-.06f,town);
        // Actual underwater bed, not a blue rectangle on top of walkable grass.
        float lake=1-Smooth(.78f,1.15f,LakeDistance(x,z));
        h=Mathf.Lerp(h,-7,lake);
        float river=(1-Smooth(5,17,Mathf.Abs(x-RiverX(z))))*Smooth(37,78,z)*(1-Smooth(273,316,z));
        h=Mathf.Lerp(h,-5,river);
        float coast=1-Smooth(-110,-45,z);
        if(Mathf.Abs(x)<28)coast*=1-Smooth(-30,-18,z);
        h=Mathf.Lerp(h,-9,coast);
        return h;
    }

    public static float PathDistance(float x,float z)
    {
        Vector2 p=new Vector2(x,z);float distance=9999;
        foreach(var route in Routes)for(int i=1;i<route.Length;i++)
        {
            Vector2 a=route[i-1],d=route[i]-a;
            distance=Mathf.Min(distance,Vector2.Distance(p,a+d*Mathf.Clamp01(Vector2.Dot(p-a,d)/d.sqrMagnitude)));
        }
        return distance;
    }

    public static int Region(Vector3 p)
    {
        if(p.z<30 && Mathf.Abs(p.x)<32)return 0;
        if(p.z<-35)return 5;
        if(p.z>345)return 4;
        if(p.x>75)return 3;
        if(p.z>170 && p.x<30)return 2;
        return 1;
    }

    public static Color GroundColor(float x,float z,float h)
    {
        float noise=Mathf.PerlinNoise(x*.035f+12,z*.035f+75);
        Color c=Color.Lerp(Hex("668D45"),Hex("A3B76A"),noise);
        float forest=(1-Smooth(5,65,x))*Smooth(140,210,z)*(1-Smooth(315,385,z));
        c=Color.Lerp(c,Color.Lerp(Hex("3D694A"),Hex("789859"),noise),forest);
        c=Color.Lerp(c,Hex("A6AA8D"),Smooth(48,105,h));
        if(h<2)c=Color.Lerp(Hex("C5C29B"),c,Smooth(-2,2,h));
        float path=1-Smooth(2.5f,4.4f,PathDistance(x,z));
        if(h>WaterY+.2f)c=Color.Lerp(c,Hex("CFBC8F"),path);
        return c;
    }

    public void Build()
    {
        terrainMat=Own(new Material(Resources.Load<Shader>("WorldNature")){name="Meadow terrain"});terrainMat.SetFloat("_Detail",1);
        treeMat=Own(new Material(Resources.Load<Shader>("WorldNature")){name="Windblown tree canopy",enableInstancing=true});treeMat.SetFloat("_Wind",.14f);
        grassMat=Own(new Material(Resources.Load<Shader>("WorldNature")){name="Windblown meadow",enableInstancing=true});grassMat.SetFloat("_Wind",.20f);
        natureMeshes[0]=Own(WorldNatureModels.Tree(false,true));natureFarMeshes[0]=Own(WorldNatureModels.Tree(false,false));
        natureMeshes[1]=Own(WorldNatureModels.Tree(true,true));natureFarMeshes[1]=Own(WorldNatureModels.Tree(true,false));
        natureMeshes[2]=Own(WorldNatureModels.Rock(true));natureFarMeshes[2]=Own(WorldNatureModels.Rock(false));
        natureMeshes[3]=Own(WorldNatureModels.Grass(true));natureFarMeshes[3]=Own(WorldNatureModels.Grass(false));
        const int tiles=8;const float tileSize=96;
        for(int iz=0;iz<tiles;iz++)for(int ix=0;ix<tiles;ix++)
        {
            float ox=MinX+ix*tileSize,oz=MinZ+iz*tileSize;
            BuildTerrainTile(ox,oz,tileSize);
            var trees=new List<Matrix4x4>();var pines=new List<Matrix4x4>();var rocks=new List<Matrix4x4>();var tufts=new List<Matrix4x4>();
            for(int i=0;i<120;i++)
            {
                float x=Range(ox,ox+tileSize),z=Range(oz,oz+tileSize),h=Height(x,z),path=PathDistance(x,z);
                if(h<.6f || InTown(x,z) || path<7 || NearLandmark(x,z,12))continue;
                float forestDensity=(1-Smooth(0,65,x))*Smooth(-260,-210,x)*Smooth(145,195,z)*(1-Smooth(305,360,z));
                bool forest=forestDensity>.5f;
                if(random.NextDouble()>Mathf.Lerp(.28f,.98f,forestDensity) || h>95)continue;
                float scale=forest?Range(1.1f,1.9f):Range(.8f,1.35f);
                var matrix=Matrix4x4.TRS(new Vector3(x,h,z),Quaternion.Euler(0,Range(0,360),0),new Vector3(scale,scale*Range(.9f,1.15f),scale));
                (forest && random.NextDouble()<.45?pines:trees).Add(matrix);TreeCount++;
                var trunk=new GameObject("Tree trunk collider");trunk.transform.SetParent(transform,false);trunk.transform.position=new Vector3(x,h+2*scale,z);
                var col=trunk.AddComponent<CapsuleCollider>();col.radius=.38f*scale;col.height=4*scale;
            }
            for(int i=0;i<24;i++)
            {
                float x=Range(ox,ox+tileSize),z=Range(oz,oz+tileSize),h=Height(x,z);
                if(h<WaterY || InTown(x,z) || PathDistance(x,z)<6 || NearLandmark(x,z,12))continue;
                float s=Range(.8f,3.3f);rocks.Add(Matrix4x4.TRS(new Vector3(x,h-.2f,z),Quaternion.Euler(0,Range(0,360),0),new Vector3(s,s*.7f,s*1.2f)));
                if(s>1.8f){var g=new GameObject("Rock collider");g.transform.SetParent(transform,false);g.transform.position=new Vector3(x,h,z);g.AddComponent<SphereCollider>().radius=s*.65f;}
            }
            for(int i=0;i<750;i++)
            {
                float x=Range(ox,ox+tileSize),z=Range(oz,oz+tileSize),h=Height(x,z);
                if(h<0 || h>82 || InTown(x,z) || PathDistance(x,z)<3.8f)continue;
                float s=Range(.65f,1.45f);tufts.Add(Matrix4x4.TRS(new Vector3(x,h+.025f,z),Quaternion.Euler(0,Range(0,360),0),new Vector3(s,s,s)));GrassCount++;
            }
            var centre=new Vector3(ox+48,0,oz+48);
            AddBatch(0,treeMat,trees,centre,700,85,true);AddBatch(1,treeMat,pines,centre,700,85,true);AddBatch(2,treeMat,rocks,centre,600,65,true);AddBatch(3,grassMat,tufts,centre,155,38,false);
        }
        Water();Bridge();Camp(Landmarks[2],"FOREST CAMP");Camp(Landmarks[3],"LAKESIDE CAMP");Tower();RouteSigns();
        MapTexture=Own(new Texture2D(384,384,TextureFormat.RGB24,false){name="Kanto field map",wrapMode=TextureWrapMode.Clamp});
        var pixels=new Color[384*384];
        for(int y=0;y<384;y++)for(int x=0;x<384;x++)
        {
            float wx=MinX+x*2,wz=MinZ+y*2,h=Height(wx,wz);
            var color=h<WaterY?Hex("4D97A1"):GroundColor(wx,wz,h);
            float shade=Mathf.Clamp(1+(Height(wx-2,wz+2)-h)*.09f,.65f,1.18f);
            pixels[y*384+x]=color*shade;
        }
        MapTexture.SetPixels(pixels);MapTexture.Apply();
        Camera.onPreCull+=RenderVegetation;
        Debug.Log("WORLD_BUILD_OK: "+TerrainTiles+" terrain tiles, "+TerrainTriangles+" terrain triangles, "+TreeCount+" trees, "+GrassCount+" grass clusters.");
    }

    private static bool InTown(float x,float z) { return Mathf.Abs(x)<24 && z>-38 && z<29; }
    private static bool NearLandmark(float x,float z,float radius)
    {
        for(int i=0;i<Landmarks.Length;i++)if(Vector2.Distance(new Vector2(x,z),Landmarks[i])<(i==4?70:radius))return true;
        return false;
    }
    private void BuildTerrainTile(float ox,float oz,float size)
    {
        const int res=48;var data=new WorldMeshData();
        for(int z=0;z<=res;z++)for(int x=0;x<=res;x++)
        {
            float wx=ox+x*size/res,wz=oz+z*size/res,h=Height(wx,wz);
            data.Vertices.Add(new Vector3(wx,h,wz));data.Colors.Add(GroundColor(wx,wz,h));
        }
        for(int z=0;z<res;z++)for(int x=0;x<res;x++){int i=z*(res+1)+x;data.Tri(i,i+res+1,i+1);data.Tri(i+1,i+res+1,i+res+2);}
        Mesh m=Own(data.ToMesh("Continuous terrain tile"));
        var normals=new Vector3[m.vertexCount];var verts=m.vertices;
        for(int i=0;i<normals.Length;i++){var p=verts[i];normals[i]=new Vector3(Height(p.x-.5f,p.z)-Height(p.x+.5f,p.z),1,Height(p.x,p.z-.5f)-Height(p.x,p.z+.5f)).normalized;}
        m.normals=normals;MeshObject("Landscape "+ox+","+oz,m,terrainMat,true);TerrainTiles++;TerrainTriangles+=res*res*2;
    }

    private void AddBatch(int model,Material material,List<Matrix4x4> list,Vector3 centre,float range,float detailRange,bool shadows)
    {
        if(list.Count>0)batches.Add(new Batch{Mesh=natureMeshes[model],FarMesh=natureFarMeshes[model],Material=material,Matrices=list.ToArray(),Centre=centre,Range=range,DetailRange=detailRange,Shadows=shadows});
    }
    private void RenderVegetation(Camera cam)
    {
        if(cam.cameraType!=CameraType.Game)return;
        var p=cam.transform.position;p.y=0;VisibleBatches=0;DetailedInstances=0;SimplifiedInstances=0;VegetationTriangles=0;
        foreach(var b in batches)
        {
            // A 96m cell's corners can be 68m closer than its centre.
            if((p-b.Centre).sqrMagnitude>(b.Range+68)*(b.Range+68))continue;
            int near=0,far=0;
            foreach(var matrix in b.Matrices)
            {
                var delta=new Vector3(matrix.m03-p.x,0,matrix.m23-p.z);float distance=delta.sqrMagnitude;
                if(distance>b.Range*b.Range)continue;
                if(distance<b.DetailRange*b.DetailRange)nearInstances[near++]=matrix;else farInstances[far++]=matrix;
            }
            if(near>0){Graphics.DrawMeshInstanced(b.Mesh,0,b.Material,nearInstances,near,null,b.Shadows?ShadowCastingMode.On:ShadowCastingMode.Off,true,0,cam,LightProbeUsage.Off);VisibleBatches++;}
            if(far>0){Graphics.DrawMeshInstanced(b.FarMesh,0,b.Material,farInstances,far,null,b.Shadows?ShadowCastingMode.On:ShadowCastingMode.Off,true,0,cam,LightProbeUsage.Off);VisibleBatches++;}
            DetailedInstances+=near;SimplifiedInstances+=far;VegetationTriangles+=(long)b.Mesh.GetIndexCount(0)/3*near+(long)b.FarMesh.GetIndexCount(0)/3*far;
        }
    }

    public void ValidateNatureModels()
    {
        for(int model=0;model<4;model++)
        {
            var near=natureMeshes[model];var far=natureFarMeshes[model];
            foreach(var mesh in new[]{near,far})
            {
                if(mesh.vertexCount==0||mesh.colors.Length!=mesh.vertexCount||mesh.normals.Length!=mesh.vertexCount)throw new InvalidOperationException("Invalid model channels: "+mesh.name);
                foreach(var p in mesh.vertices)if(float.IsNaN(p.sqrMagnitude)||float.IsInfinity(p.sqrMagnitude))throw new InvalidOperationException("Non-finite geometry: "+mesh.name);
                foreach(var index in mesh.triangles)if(index<0||index>=mesh.vertexCount)throw new InvalidOperationException("Invalid model index: "+mesh.name);
            }
            if(far.GetIndexCount(0)>=near.GetIndexCount(0)||near.GetIndexCount(0)/3>12000)throw new InvalidOperationException("Nature LOD budget failed: "+near.name);
            if(Vector3.Distance(near.bounds.size,far.bounds.size)>(model<2?1.1f:.8f))throw new InvalidOperationException("Nature LOD silhouette changed: "+near.name+" near="+near.bounds.size+" far="+far.bounds.size);
            Debug.Log("NATURE_MODEL_OK: "+near.name+" "+near.GetIndexCount(0)/3+" triangles; far="+far.GetIndexCount(0)/3+"; bounds="+near.bounds.size);
        }
    }

    // Review-only closeups use the exact shared gameplay meshes, not separate showcase assets.
    public GameObject CreateNatureStudy(Vector3 origin,int model,bool detailed)
    {
        var mesh=detailed?natureMeshes[model]:natureFarMeshes[model];
        var g=MeshObject("Study: "+mesh.name,mesh,model==3?grassMat:treeMat,false);g.transform.position=origin;return g;
    }

    private void Water()
    {
        var d=new WorldMeshData();d.Vertices.AddRange(new[]{new Vector3(MinX,WaterY,MinZ),new Vector3(MinX,WaterY,MinZ+Size),new Vector3(MinX+Size,WaterY,MinZ+Size),new Vector3(MinX+Size,WaterY,MinZ)});
        for(int i=0;i<4;i++)d.Colors.Add(Color.white);d.Tri(0,1,2);d.Tri(0,2,3);
        MeshObject("Lake, river and coast",Own(d.ToMesh("Water surface")),Own(new Material(Resources.Load<Shader>("WorldWater"))),false);
    }

    private void Bridge()
    {
        float y=Mathf.Max(Height(67,138),Height(116,138))+.15f;
        for(int i=0;i<50;i++)
        {
            float x=67+i;float t=i/49f;float by=Mathf.Lerp(Height(67,138),Height(116,138),t)+Mathf.Sin(t*Mathf.PI)*1.8f+.15f;
            Box("Timber bridge deck",new Vector3(x,by-.14f,138),new Vector3(1.05f,.28f,5),Hex("AE9064"),true);
            if(i%5==0)for(int side=-1;side<=1;side+=2)Box("Bridge post",new Vector3(x,by+.65f,138+side*2.45f),new Vector3(.22f,1.4f,.22f),Hex("74664B"),true);
            if(i<49)for(int side=-1;side<=1;side+=2)
                Box("Bridge rail",new Vector3(x,by+1.1f,138+side*2.45f),new Vector3(1.1f,.12f,.13f),Hex("9A805A"),false);
        }
        // Two masonry piers anchor the long crossing to the riverbed.
        foreach(float x in new[]{81f,102f})Box("River pier",new Vector3(x,y/2-2,138),new Vector3(2.5f,y+5,6),Hex("78847A"),true);
    }
    private void Camp(Vector2 p,string label)
    {
        var centre=Surface(p);float y=centre.y;
        Box("Camp platform",centre-new Vector3(0,.1f,0),new Vector3(11,.25f,10),Hex("BBA77B"),true);
        var d=new WorldMeshData();
        Vector3 a=centre+new Vector3(-3,0,-2),b=centre+new Vector3(3,0,-2),c=centre+new Vector3(0,3.6f,-2),a2=a+Vector3.forward*4,b2=b+Vector3.forward*4,c2=c+Vector3.forward*4;
        d.Quad(a,c,c2,a2,Hex("BF6550"));d.Quad(c,b,b2,c2,Hex("DE976C"));d.Quad(a2,c2,b2,b2,Hex("AA5E4B"));
        MeshObject(label+" expedition tent",Own(d.ToMesh("Canvas tent")),terrainMat,false);
        for(int side=-1;side<=1;side+=2)Box("Tent pole",centre+new Vector3(side*3,1.6f,-2),new Vector3(.1f,3.2f,.1f),Hex("D8C6A2"),false);
        Box("Field supply crate",centre+new Vector3(4,.5f,2),new Vector3(1.3f,1,1),Hex("718A67"),true);
        PalletTownBuilder.Pokeball(transform,centre+new Vector3(4,1.2f,2),.26f);
        Sign(p+new Vector2(5,-5),label,"调查营地 · F5 保存");
    }
    private void Tower()
    {
        var p=Surface(Landmarks[4]);
        Box("Lookout foundation",p-new Vector3(0,.15f,0),new Vector3(12,.3f,12),Hex("B9B59C"),true);
        for(int side=-1;side<=1;side+=2)for(int z=-1;z<=1;z+=2)Box("Lookout timber",p+new Vector3(side*3,4,z*3),new Vector3(.5f,8,.5f),Hex("7C725A"),true);
        Box("Walkable lookout deck",p+Vector3.up*3.9f,new Vector3(7,.2f,7),Hex("B49A70"),true);
        for(int i=0;i<16;i++)
        {
            float height=(i+1)*.25f;
            Box("Lookout stair "+i,p+new Vector3(0,height/2,-14+i*.7f),new Vector3(2.6f,height,.75f),Hex("B49A70"),true);
        }
        for(int side=-1;side<=1;side+=2)
        {
            Box("Lookout side rail",p+new Vector3(side*3.45f,4.8f,0),new Vector3(.15f,.16f,7),Hex("786B53"),true);
            for(int k=-1;k<=1;k++)Box("Lookout rail post",p+new Vector3(side*3.45f,4.5f,k*3.4f),new Vector3(.17f,1.1f,.17f),Hex("786B53"),true);
        }
        Box("Lookout rear rail",p+new Vector3(0,4.8f,3.45f),new Vector3(7,.16f,.15f),Hex("786B53"),true);
        Box("Lookout canopy",p+Vector3.up*8,new Vector3(8,.35f,8),Hex("506E60"),false);
        for(int i=0;i<5;i++)Box("Lookout roof ridge",p+new Vector3(0,8.25f+i*.3f,0),new Vector3(8-i*1.5f,.3f,8-i*1.5f),Hex("527767"),false);
        Sign(Landmarks[4]+new Vector2(5,-7),"WINDWARD RIDGE","关都南部 · 全景观测站");
    }
    private void RouteSigns()
    {
        Sign(new Vector2(4,38),"ROUTE 01","启程原野  ↑    澄蓝湖畔  →");
        Sign(new Vector2(-4,98),"KANTO FIELD ROUTES","常青森林  ↖    澄蓝湖畔  →");
        Sign(new Vector2(-48,163),"VIRIDIAN WOODLAND","常青森林 · 野生宝可梦栖息地");
        Sign(new Vector2(-88,-67),"SOUTHWIND COAST","南风海岸 · 潮汐观测点");
    }
    private void Sign(Vector2 pos,string title,string subtitle)
    {
        var p=Surface(pos);Box(title+" sign post",p+Vector3.up*1.1f,new Vector3(.18f,2.2f,.18f),Hex("8B795B"),true);
        Box(title+" signboard",p+Vector3.up*2,new Vector3(3.8f,.95f,.16f),Hex("365F54"),true);
        Label(title,p+new Vector3(0,2.13f,-.10f),.065f);Label(subtitle,p+new Vector3(0,1.78f,-.10f),.040f);
    }
    private void Label(string label,Vector3 p,float scale)
    {
        if(signFont==null)
        {
            signFont=Font.CreateDynamicFontFromOSFont(new[]{"Microsoft YaHei","Arial"},48);
            signMaterial=Own(new Material(Resources.Load<Shader>("PalletText")));Font.textureRebuilt+=RefreshSignFont;
        }
        signFont.RequestCharactersInTexture(label,48,FontStyle.Normal);RefreshSignFont(signFont);
        var g=new GameObject(label);g.transform.SetParent(transform,false);g.transform.position=p;
        var t=g.AddComponent<TextMesh>();t.text=label;t.fontSize=48;t.characterSize=scale;t.anchor=TextAnchor.MiddleCenter;t.color=Hex("F5ECD0");
        t.font=signFont;g.GetComponent<Renderer>().sharedMaterial=signMaterial;
    }
    private void RefreshSignFont(Font font){if(font==signFont && signMaterial!=null)signMaterial.mainTexture=font.material.mainTexture;}
    private void Box(string name,Vector3 p,Vector3 size,Color color,bool collision)
    {
        var d=new WorldMeshData();d.Box(p,size,color);MeshObject(name,Own(d.ToMesh(name)),terrainMat,collision);
    }
    private GameObject MeshObject(string name,Mesh mesh,Material mat,bool collision)
    {
        var g=new GameObject(name);g.transform.SetParent(transform,false);g.AddComponent<MeshFilter>().sharedMesh=mesh;g.AddComponent<MeshRenderer>().sharedMaterial=mat;
        if(collision)g.AddComponent<MeshCollider>().sharedMesh=mesh;return g;
    }
    private T Own<T>(T obj) where T:UnityEngine.Object { owned.Add(obj);return obj; }
    private float Range(float a,float b){return Mathf.Lerp(a,b,(float)random.NextDouble());}
    public static Color Hex(string s){ColorUtility.TryParseHtmlString("#"+s,out var c);return c;}
    private void OnDestroy(){Camera.onPreCull-=RenderVegetation;Font.textureRebuilt-=RefreshSignFont;foreach(var obj in owned)if(obj!=null)Destroy(obj);}
}

// Small mesh authoring helper: coloured geometry shared by landscape props and wildlife.
public sealed class WorldMeshData
{
    public readonly List<Vector3> Vertices=new List<Vector3>();
    public readonly List<Color> Colors=new List<Color>();
    public readonly List<int> Triangles=new List<int>();
    public void Tri(int a,int b,int c){Triangles.Add(a);Triangles.Add(b);Triangles.Add(c);}
    public void Quad(Vector3 a,Vector3 b,Vector3 c,Vector3 d,Color color)
    {
        int n=Vertices.Count;Vertices.AddRange(new[]{a,b,c,d});for(int i=0;i<4;i++)Colors.Add(color);Tri(n,n+1,n+2);Tri(n,n+2,n+3);
    }
    public void Box(Vector3 p,Vector3 s,Color c)
    {
        Vector3 a=p-s/2,b=p+s/2;
        Quad(new Vector3(a.x,a.y,a.z),new Vector3(a.x,b.y,a.z),new Vector3(b.x,b.y,a.z),new Vector3(b.x,a.y,a.z),c);
        Quad(new Vector3(b.x,a.y,b.z),new Vector3(b.x,b.y,b.z),new Vector3(a.x,b.y,b.z),new Vector3(a.x,a.y,b.z),c);
        Quad(new Vector3(a.x,b.y,a.z),new Vector3(a.x,b.y,b.z),new Vector3(b.x,b.y,b.z),new Vector3(b.x,b.y,a.z),c);
        Quad(new Vector3(a.x,a.y,b.z),new Vector3(a.x,a.y,a.z),new Vector3(b.x,a.y,a.z),new Vector3(b.x,a.y,b.z),c);
        Quad(new Vector3(a.x,a.y,b.z),new Vector3(a.x,b.y,b.z),new Vector3(a.x,b.y,a.z),new Vector3(a.x,a.y,a.z),c);
        Quad(new Vector3(b.x,a.y,a.z),new Vector3(b.x,b.y,a.z),new Vector3(b.x,b.y,b.z),new Vector3(b.x,a.y,b.z),c);
    }
    public void Oval(Vector3 p,Vector3 radii,Color c,int segments=12,int rings=8,float variation=0)
    {
        int n=Vertices.Count;
        for(int y=0;y<=rings;y++)for(int x=0;x<=segments;x++)
        {
            float lat=Mathf.PI*y/rings,lon=2*Mathf.PI*x/segments;
            float wobble=1+Mathf.Sin(lon*3+variation)*Mathf.Sin(lat*4+variation)*.085f;
            var v=new Vector3(Mathf.Sin(lat)*Mathf.Cos(lon),Mathf.Cos(lat),Mathf.Sin(lat)*Mathf.Sin(lon));
            Vertices.Add(p+Vector3.Scale(v,radii)*wobble);Colors.Add(c);
        }
        for(int y=0;y<rings;y++)for(int x=0;x<segments;x++){int i=n+y*(segments+1)+x;Tri(i,i+1,i+segments+1);Tri(i+1,i+segments+2,i+segments+1);}
    }
    public void Tube(Vector3 a,Vector3 b,float r0,float r1,Color c,int segments=8,float wind=0)
    {
        int n=Vertices.Count;Quaternion q=Quaternion.FromToRotation(Vector3.up,b-a);
        for(int ring=0;ring<2;ring++)for(int i=0;i<=segments;i++)
        {
            float angle=i*Mathf.PI*2/segments;Vertices.Add((ring==0?a:b)+q*new Vector3(Mathf.Cos(angle)*(ring==0?r0:r1),0,Mathf.Sin(angle)*(ring==0?r0:r1)));
            c.a=ring==0?0:wind;Colors.Add(c);
        }
        for(int i=0;i<segments;i++){Tri(n+i,n+i+segments+1,n+i+1);Tri(n+i+1,n+i+segments+1,n+i+segments+2);}
    }
    public Mesh ToMesh(string name)
    {
        var mesh=new Mesh{name=name,indexFormat=Vertices.Count>65535?IndexFormat.UInt32:IndexFormat.UInt16};mesh.SetVertices(Vertices);mesh.SetColors(Colors);mesh.SetTriangles(Triangles,0);mesh.RecalculateNormals();mesh.RecalculateBounds();return mesh;
    }
}
