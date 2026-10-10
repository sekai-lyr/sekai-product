using System.Collections.Generic;
using UnityEngine;

public sealed class PokemonWildlife : MonoBehaviour
{
    public sealed class Actor
    {
        public CreatureDefinition Definition;
        public GameObject Object;
        public Vector3 Home;
        public Transform Model;
        public float Phase;
    }
    public readonly List<Actor> Actors=new List<Actor>();
    private readonly List<Mesh> meshes=new List<Mesh>();
    private Material material;
    private static readonly string[] ids={"pikachu","oddish","caterpie","psyduck"};
    private static readonly string[] names={"皮卡丘","走路草","绿毛虫","可达鸭"};
    private static readonly string[] english={"Pikachu","Oddish","Caterpie","Psyduck"};
    private static readonly string[] elements={"电","草 / 毒","虫","水"};
    private static readonly string[] descriptions={"会用脸颊上的电气袋储存电力。喜欢在树林边缘活动。","扎根于土壤的小宝可梦，头上的叶片会随风摆动。","以树叶为食。红色触角让它在草丛中也容易辨认。","总是抱着脑袋的水属性宝可梦，经常出现在水岸。"};
    public static CreatureDefinition Find(string id)
    {
        if(string.IsNullOrEmpty(id)||!id.StartsWith("kanto-"))return null;
        for(int i=0;i<ids.Length;i++)if(id.StartsWith("kanto-"+ids[i]+"-"))
            return new CreatureDefinition(id,names[i],english[i],descriptions[i],elements[i],i==3?CreatureElement.Water:i==0?CreatureElement.Glow:CreatureElement.Wind,4+i,30+i*6,6+i,Color.white,Color.white,true);
        return null;
    }
    public void Build(HashSet<string> caught,HashSet<string> defeated,Dictionary<string,GameObject> objects)
    {
        material=new Material(Resources.Load<Shader>("WorldNature")){name="Pokemon flat-colour study"};
        for(int i=0;i<4;i++)meshes.Add(BuildMesh(i));
        var spots=new[]{new Vector2(6,54),new Vector2(-8,90),new Vector2(18,73),new Vector2(-22,138),new Vector2(-42,165),new Vector2(-70,196),new Vector2(-85,228),new Vector2(-122,246),new Vector2(-95,289),new Vector2(-111,303),new Vector2(-49,339),new Vector2(18,358),new Vector2(132,146),new Vector2(151,174),new Vector2(168,158),new Vector2(146,183),new Vector2(-66,-31),new Vector2(-83,-51),new Vector2(40,111),new Vector2(51,127)};
        for(int i=0;i<spots.Length;i++)
        {
            int species=i>=12&&i<=15?3:i%3;
            string id="kanto-"+ids[species]+"-"+i.ToString("00");var definition=Find(id);
            var home=OpenWorldBuilder.Surface(spots[i]);
            // Spawn on dry banks, never beneath the lake surface.
            if(home.y<OpenWorldBuilder.WaterY+.3f){home=OpenWorldBuilder.Surface(spots[i]+Vector2.left*12);}
            var g=new GameObject(definition.Name+" / "+id);g.transform.SetParent(transform,false);g.transform.position=home;
            var hit=g.AddComponent<SphereCollider>();hit.radius=.7f;hit.center=Vector3.up*.6f;hit.isTrigger=true;
            g.AddComponent<WorldInteractable>().CreatureId=id;
            var model=new GameObject("Pokemon visual");model.transform.SetParent(g.transform,false);model.AddComponent<MeshFilter>().sharedMesh=meshes[species];model.AddComponent<MeshRenderer>().sharedMaterial=material;
            Actors.Add(new Actor{Definition=definition,Object=g,Home=home,Model=model.transform,Phase=i*1.73f});objects.Add(id,g);
            g.SetActive(!caught.Contains(id)&&!defeated.Contains(id));
        }
    }
    public void Animate(Vector3 player,float time,float dt,bool paused)
    {
        foreach(var a in Actors)
        {
            if(!a.Object.activeSelf)continue;
            var t=a.Object.transform;float distance=Vector3.Distance(t.position,player);
            if(distance>125)continue;
            float stride=0;
            if(!paused && distance>4)
            {
                Vector3 target=a.Home+new Vector3(Mathf.Sin(time*.095f+a.Phase)*3.4f,0,Mathf.Cos(time*.12f+a.Phase)*2.8f);
                var direction=target-t.position;direction.y=0;
                if(direction.magnitude>.4f)
                {
                    Vector3 next=t.position+direction.normalized*Mathf.Min(direction.magnitude,dt*.7f);
                    float y=OpenWorldBuilder.Height(next.x,next.z);
                    if(y>OpenWorldBuilder.WaterY+.25f && Mathf.Abs(y-t.position.y)<.4f){next.y=y;t.position=next;stride=1;}
                    t.rotation=Quaternion.Slerp(t.rotation,Quaternion.LookRotation(direction),dt*2);
                }
            }
            else if(!paused && distance<6)
            {
                var look=player-t.position;look.y=0;if(look.sqrMagnitude>.1f)t.rotation=Quaternion.Slerp(t.rotation,Quaternion.LookRotation(look),dt*2);
            }
            a.Model.localPosition=Vector3.up*(.012f+Mathf.Abs(Mathf.Sin(time*(stride>0?7:1.5f)+a.Phase))*(stride>0?.055f:.015f));
            a.Model.localRotation=Quaternion.Euler(0,0,Mathf.Sin(time*6+a.Phase)*stride*3);
        }
    }
    private static Color C(string s){return OpenWorldBuilder.Hex(s);}
    private static void Eyes(WorldMeshData d,float y,float z,float spread,float size)
    {
        for(int s=-1;s<=1;s+=2){d.Oval(new Vector3(s*spread,y,z),new Vector3(size,size*1.2f,size*.38f),C("202A32"));d.Oval(new Vector3(s*spread-size*.22f,y+size*.35f,z+size*.34f),Vector3.one*size*.30f,Color.white,8,5);}
    }
    public static Mesh BuildMesh(int species)
    {
        var d=new WorldMeshData();
        if(species==0)
        {
            var yellow=C("F2CB3B");var dark=C("292F33");
            d.Oval(new Vector3(0,.43f,0),new Vector3(.32f,.40f,.26f),yellow);d.Oval(new Vector3(0,.89f,.05f),new Vector3(.36f,.29f,.30f),yellow);
            for(int s=-1;s<=1;s+=2)
            {
                var ear=new Vector3(s*.22f,1.05f,.015f);var mid=ear+new Vector3(s*.14f,.38f,-.05f);var tip=mid+new Vector3(s*.065f,.17f,-.03f);
                d.Tube(ear,mid,.092f,.07f,yellow,10);d.Tube(mid,tip,.072f,.004f,dark,10);
                d.Oval(new Vector3(s*.22f,.095f,.10f),new Vector3(.13f,.08f,.21f),yellow);
                d.Oval(new Vector3(s*.29f,.5f,.11f),new Vector3(.10f,.18f,.10f),yellow);
                d.Oval(new Vector3(s*.29f,.83f,.25f),new Vector3(.092f,.07f,.027f),C("CD493F"));
            }
            Eyes(d,.93f,.329f,.145f,.056f);d.Oval(new Vector3(0,.858f,.351f),new Vector3(.025f,.017f,.016f),dark,8,5);
            d.Tube(new Vector3(-.055f,.795f,.317f),new Vector3(0,.777f,.33f),.009f,.009f,dark,6);d.Tube(new Vector3(0,.777f,.33f),new Vector3(.055f,.795f,.317f),.009f,.009f,dark,6);
            var outline=new[]{new Vector3(.12f,.27f,-.20f),new Vector3(.30f,.38f,-.39f),new Vector3(.25f,.55f,-.4f),new Vector3(.48f,.65f,-.4f),new Vector3(.44f,.87f,-.4f),new Vector3(.83f,1.05f,-.4f),new Vector3(.91f,.79f,-.4f),new Vector3(.59f,.66f,-.4f),new Vector3(.63f,.43f,-.4f),new Vector3(.40f,.38f,-.4f),new Vector3(.38f,.22f,-.4f)};
            for(int i=1;i<outline.Length-1;i++)d.Quad(outline[0],outline[i],outline[i+1],outline[0],i<3?C("926F39"):yellow);
            for(int k=0;k<2;k++)d.Oval(new Vector3(0,.35f+k*.17f,-.238f),new Vector3(.22f,.045f,.023f),C("956D38"));
        }
        else if(species==1)
        {
            d.Oval(new Vector3(0,.39f,0),new Vector3(.31f,.34f,.28f),C("395F8E"));
            for(int s=-1;s<=1;s+=2)d.Oval(new Vector3(s*.2f,.08f,.04f),new Vector3(.14f,.09f,.20f),C("516D8F"));
            Eyes(d,.45f,.265f,.12f,.045f);
            for(int i=0;i<5;i++)
            {
                float a=i*Mathf.PI*2/5;var root=new Vector3(0,.66f,0);var tip=new Vector3(Mathf.Cos(a)*.55f,1.12f+(i%2)*.15f,Mathf.Sin(a)*.55f);
                var side=new Vector3(-Mathf.Sin(a),0,Mathf.Cos(a))*.16f;var mid=(root+tip)/2+Vector3.up*.18f;
                d.Quad(root,mid+side,tip,mid-side,C(i%2==0?"53884C":"7EA14F"));d.Tube(root,tip,.015f,.003f,C("B0BD64"),5);
            }
            d.Oval(new Vector3(0,.33f,.279f),new Vector3(.05f,.027f,.015f),C("BD6B81"));
        }
        else if(species==2)
        {
            for(int i=0;i<5;i++){float r=.25f-i*.025f;d.Oval(new Vector3(0,.24f,-i*.23f),new Vector3(r,r,r),C(i%2==0?"85B74D":"6B9E47"));for(int s=-1;s<=1;s+=2)d.Oval(new Vector3(s*.20f,.095f,-i*.23f),new Vector3(.095f,.07f,.10f),C("DDD49C"));}
            d.Oval(new Vector3(0,.43f,.13f),new Vector3(.31f,.31f,.26f),C("A0C359"));
            d.Oval(new Vector3(0,.32f,.23f),new Vector3(.27f,.11f,.21f),C("E6C970"));Eyes(d,.49f,.363f,.16f,.085f);
            for(int s=-1;s<=1;s+=2)d.Tube(new Vector3(0,.7f,.17f),new Vector3(s*.2f,.93f,.18f),.05f,.035f,C("CD6157"),8);
        }
        else
        {
            var yellow=C("E0C354");d.Oval(new Vector3(0,.45f,0),new Vector3(.35f,.4f,.29f),yellow);d.Oval(new Vector3(0,.93f,.02f),new Vector3(.39f,.32f,.31f),yellow);
            for(int s=-1;s<=1;s+=2){d.Oval(new Vector3(s*.22f,.08f,.14f),new Vector3(.18f,.06f,.26f),C("D6BB86"));d.Oval(new Vector3(s*.31f,.65f,.12f),new Vector3(.11f,.23f,.10f),yellow);d.Oval(new Vector3(s*.17f,1.0f,.293f),new Vector3(.105f,.12f,.036f),C("F7F1D9"));d.Oval(new Vector3(s*.17f,1.0f,.329f),Vector3.one*.022f,C("202B30"),8,5);}
            d.Oval(new Vector3(0,.82f,.38f),new Vector3(.24f,.105f,.23f),C("DCC293"));
            for(int s=-1;s<=1;s+=2)d.Oval(new Vector3(s*.10f,.87f,.558f),new Vector3(.014f,.009f,.011f),C("6E6851"),6,4);
            for(int k=-1;k<=1;k++)d.Tube(new Vector3(k*.05f,1.20f,0),new Vector3(k*.10f,1.42f,-.04f),.016f,.01f,C("383E38"),6);
            d.Oval(new Vector3(0,.36f,-.30f),new Vector3(.17f,.1f,.22f),yellow);
        }
        return d.ToMesh(english[species]+" stylised wildlife mesh");
    }
    private void OnDestroy(){foreach(var m in meshes)Destroy(m);if(material!=null)Destroy(material);}
}
