using System;
using System.Collections.Generic;
using UnityEngine;

// Rigid-part articulation preserves the authored silhouette (no guessed skin weights).
public sealed class PokemonBattleActor : MonoBehaviour
{
    public Vector3 Home { get; private set; }
    public int Species { get; private set; }
    public float Fainted;
    private Quaternion facing;
    private readonly List<Transform> joints=new List<Transform>();
    private readonly List<Quaternion> rest=new List<Quaternion>();
    private readonly List<UnityEngine.Object> owned=new List<UnityEngine.Object>();
    private Renderer[] renderers;
    private readonly MaterialPropertyBlock properties=new MaterialPropertyBlock();
    public int JointCount=>joints.Count;
    public float PoseDeviation
    {
        get{float angle=0;for(int i=0;i<joints.Count;i++)angle+=Quaternion.Angle(rest[i],joints[i].localRotation);return angle;}
    }

    public static PokemonBattleActor Create(Transform parent,string id,bool partner)
    {
        var g=new GameObject(partner?"Battle Charmander":"Battle "+id);g.transform.SetParent(parent,false);
        var actor=g.AddComponent<PokemonBattleActor>();
        actor.Species=partner?4:id.Contains("pikachu")?0:id.Contains("oddish")?1:id.Contains("caterpie")?2:3;
        if(partner)actor.Charmander();else actor.WildPokemon();
        actor.renderers=g.GetComponentsInChildren<Renderer>();
        if(actor.renderers.Length==0)throw new InvalidOperationException("Battle Pokemon has no visible geometry.");
        return actor;
    }
    private Transform Joint(string name,Vector3 pivot)
    {
        var g=new GameObject(name);g.transform.SetParent(transform,false);g.transform.localPosition=pivot;
        joints.Add(g.transform);rest.Add(g.transform.localRotation);return g.transform;
    }
    private static Bounds BoundsOf(GameObject g)
    {
        var all=g.GetComponentsInChildren<Renderer>();var bounds=all[0].bounds;
        foreach(var r in all)bounds.Encapsulate(r.bounds);return bounds;
    }
    private void Charmander()
    {
        var prefab=Resources.Load<GameObject>("Characters/BattleCharmander");
        if(prefab==null)throw new InvalidOperationException("BattleCharmander prefab missing. Build via PhaseOneBuild.BuildOpenWorld.");
        var model=Instantiate(prefab,transform);model.name="Reference-locked Charmander";
        Transform head=null,eye=null;
        foreach(var t in model.GetComponentsInChildren<Transform>()){if(t.name=="CHR_Head")head=t;if(t.name=="CHR_LEye")eye=t;}
        if(head!=null&&eye!=null)
        {
            var forward=eye.position-head.position;forward.y=0;forward.x=0;
            if(forward.sqrMagnitude>.00001f)model.transform.rotation=Quaternion.FromToRotation(forward.normalized,Vector3.forward)*model.transform.rotation;
        }
        var bounds=BoundsOf(model);model.transform.localScale*=1.55f/bounds.size.y;
        bounds=BoundsOf(model);model.transform.position-=new Vector3(bounds.center.x,bounds.min.y,bounds.center.z);
        var parts=model.GetComponentsInChildren<Renderer>();
        var materialMap=new Dictionary<string,Material>();
        foreach(var renderer in parts)
        {
            var mats=renderer.sharedMaterials;
            for(int i=0;i<mats.Length;i++)
            {
                string name=mats[i].name;
                if(!materialMap.TryGetValue(name,out var material))
                {
                    string hex=name.Contains("Orange")?"F49746":name.Contains("Belly")?"F8D996":name.Contains("Navy")?"203444":name.Contains("Blue")?"428FAC":name.Contains("Black")?"18232A":name.Contains("Claws")?"F6EFD8":name.Contains("Red")?"F56C38":"FFD35C";
                    material=new Material(Resources.Load<Shader>("AshCharacter")){color=OpenWorldBuilder.Hex(hex),name=name+" battle"};owned.Add(material);materialMap.Add(name,material);
                }
                mats[i]=material;
            }
            renderer.sharedMaterials=mats;
        }
        var groups=new[]{Joint("Head joint",new Vector3(0,.91f,.03f)),Joint("Left arm joint",new Vector3(-.30f,.78f,0)),Joint("Right arm joint",new Vector3(.30f,.78f,0)),Joint("Tail joint",new Vector3(0,.40f,-.12f)),Joint("Left foot joint",new Vector3(-.18f,.21f,0)),Joint("Right foot joint",new Vector3(.18f,.21f,0))};
        foreach(var r in parts)
        {
            string n=r.name;int group=n.Contains("Tail")?3:n.Contains("LArm")||n.Contains("LHand")?1:n.Contains("RArm")||n.Contains("RHand")?2:n.Contains("LFoot")||n.Contains("LClaw")?4:n.Contains("RFoot")||n.Contains("RClaw")?5:n.Contains("Head")||n.Contains("Muzzle")||n.Contains("Eye")||n.Contains("Iris")||n.Contains("Pupil")||n.Contains("Glint")||n.Contains("Nostril")||n.Contains("Mouth")?0:-1;
            if(group>=0)r.transform.SetParent(groups[group],true);
        }
    }
    private void WildPokemon()
    {
        var mesh=PokemonWildlife.BuildMesh(Species);var vertices=mesh.vertices;var colors=mesh.colors;var triangles=mesh.triangles;var normals=mesh.normals;
        var parent=new int[vertices.Length];for(int i=0;i<parent.Length;i++)parent[i]=i;
        Func<int,int> root=null;root=i=>{while(parent[i]!=i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
        for(int i=0;i<triangles.Length;i+=3){int a=root(triangles[i]);parent[root(triangles[i+1])]=a;parent[root(triangles[i+2])]=a;}
        var centres=new Dictionary<int,Vector3>();var counts=new Dictionary<int,int>();
        for(int i=0;i<vertices.Length;i++){int r=root(i);if(!centres.ContainsKey(r)){centres[r]=Vector3.zero;counts[r]=0;}centres[r]+=vertices[i];counts[r]++;}
        var groups=new[]{Joint("Head joint",new Vector3(0,Species==1?.64f:.73f,0)),Joint("Left arm joint",new Vector3(-.26f,.57f,0)),Joint("Right arm joint",new Vector3(.26f,.57f,0)),Joint("Tail joint",new Vector3(0,.25f,-.25f)),Joint("Left foot joint",new Vector3(-.19f,.14f,0)),Joint("Right foot joint",new Vector3(.19f,.14f,0)),Joint("Body joint",Vector3.zero)};
        var data=new WorldMeshData[groups.Length];for(int i=0;i<data.Length;i++)data[i]=new WorldMeshData();
        var partNormals=new List<Vector3>[groups.Length];for(int i=0;i<groups.Length;i++)partNormals[i]=new List<Vector3>();
        for(int i=0;i<triangles.Length;i+=3)
        {
            int r=root(triangles[i]);var p=centres[r]/counts[r];
            int group=p.y<(Species==2?.13f:.15f)?(p.x<0?4:5):Species==2?(p.z<-.2f?3:0):p.y>(Species==1?.67f:.76f)?0:p.z<-.27f?3:Mathf.Abs(p.x)>.25f&&p.y>.3f?(p.x<0?1:2):6;
            var d=data[group];int n=d.Vertices.Count;
            for(int k=0;k<3;k++){int v=triangles[i+k];d.Vertices.Add(vertices[v]-groups[group].localPosition);d.Colors.Add(colors[v]);partNormals[group].Add(normals[v]);}d.Tri(n,n+1,n+2);
        }
        var mat=new Material(Resources.Load<Shader>("WorldNature")){name="Articulated Pokemon colours"};owned.Add(mat);
        for(int i=0;i<data.Length;i++)if(data[i].Vertices.Count>0)
        {
            var part=data[i].ToMesh("Pokemon rigid part "+i);owned.Add(part);
            part.SetNormals(partNormals[i]);
            groups[i].gameObject.AddComponent<MeshFilter>().sharedMesh=part;groups[i].gameObject.AddComponent<MeshRenderer>().sharedMaterial=mat;
        }
        Destroy(mesh);
    }
    public void Place(Vector3 home,Vector3 towards)
    {
        Home=home;var direction=towards-home;direction.y=0;facing=Quaternion.LookRotation(direction.normalized);transform.localPosition=home;transform.localRotation=facing;
    }
    public void Pose(float time,float charge=0,float recoil=0,float lunge=0)
    {
        transform.localPosition=Home+facing*Vector3.forward*lunge+Vector3.up*(Mathf.Sin(time*2.5f)*.012f*(1-Fainted));
        transform.localRotation=facing*Quaternion.Euler(-charge*10+recoil*18,0,-Fainted*82);
        transform.localScale=Vector3.one*(1-Fainted*.15f);
        for(int i=0;i<joints.Count;i++)
        {
            float x=i==0?-charge*18+recoil*20:i==1||i==2?-charge*55+Mathf.Sin(time*2.5f+i)*3:i==4||i==5?Mathf.Sin(time*8+i*3)*Mathf.Abs(lunge)*24:0;
            float y=i==3?Mathf.Sin(time*3)*9+charge*22:0;
            joints[i].localRotation=rest[i]*Quaternion.Euler(x,y,0);
        }
        foreach(var r in renderers)
        {
            properties.SetColor("_Color",Color.Lerp(r.sharedMaterial.color,Color.white,recoil*.85f));r.SetPropertyBlock(properties);
        }
    }
    private void OnDestroy(){foreach(var obj in owned)if(obj!=null)Destroy(obj);}
}
