using System;
using System.Collections;
using UnityEngine;

public sealed class PokemonBattleScene : MonoBehaviour
{
    public PokemonBattleActor Partner { get; private set; }
    public PokemonBattleActor Enemy { get; private set; }
    public bool Animating { get; private set; }
    public string Phase { get; private set; }="Idle";
    public int Impacts { get; private set; }
    private GameObject projectile;
    private readonly GameObject[] sparks=new GameObject[9];
    private GameObject captureBall;
    private Mesh ballMesh;
    private Material ballMaterial;
    private LineRenderer trail;
    private Material effectMaterial;
    private Vector3 side,axis;
    public Vector3 Focus=>(Partner.transform.position+Enemy.transform.position)*.5f+Vector3.up*.65f;
    public Vector3 CameraPosition=>Focus+side*5.6f-axis*5.8f+Vector3.up*2.4f;

    public void Build(string enemyId,Vector3 player,Vector3 wild)
    {
        Partner=PokemonBattleActor.Create(transform,"charmander",true);Enemy=PokemonBattleActor.Create(transform,enemyId,false);
        axis=wild-player;axis.y=0;if(axis.sqrMagnitude<.01f)axis=Vector3.forward;axis.Normalize();side=Vector3.Cross(Vector3.up,axis);
        var centre=(player+wild)*.5f;
        Vector3 a=centre-axis*1.9f,b=centre+axis*1.9f;
        a.y=OpenWorldBuilder.Height(a.x,a.z)+.03f;b.y=OpenWorldBuilder.Height(b.x,b.z)+.03f;
        Partner.Place(a,b);Enemy.Place(b,a);
        effectMaterial=new Material(Resources.Load<Shader>("BattleEffect"));
        projectile=GameObject.CreatePrimitive(PrimitiveType.Sphere);projectile.name="Battle skill projectile";projectile.transform.SetParent(transform,false);Destroy(projectile.GetComponent<Collider>());
        projectile.GetComponent<Renderer>().sharedMaterial=effectMaterial;projectile.SetActive(false);
        for(int i=0;i<sparks.Length;i++)
        {
            sparks[i]=GameObject.CreatePrimitive(PrimitiveType.Sphere);sparks[i].name="Impact spark";sparks[i].transform.SetParent(transform,false);
            Destroy(sparks[i].GetComponent<Collider>());sparks[i].GetComponent<Renderer>().sharedMaterial=effectMaterial;sparks[i].SetActive(false);
        }
        var ballData=new WorldMeshData();ballData.Oval(Vector3.zero,Vector3.one*.14f,Color.white,20,12);
        for(int i=0;i<ballData.Vertices.Count;i++)ballData.Colors[i]=ballData.Vertices[i].y>.012f?OpenWorldBuilder.Hex("EA5547"):ballData.Vertices[i].y<-.012f?OpenWorldBuilder.Hex("F7F0DE"):OpenWorldBuilder.Hex("263740");
        ballData.Oval(new Vector3(0,0,-.138f),new Vector3(.04f,.04f,.012f),Color.white,10,6);
        ballMesh=ballData.ToMesh("Battle Pokeball");ballMaterial=new Material(Resources.Load<Shader>("WorldNature"));
        captureBall=new GameObject("Capture Pokeball");captureBall.transform.SetParent(transform,false);captureBall.AddComponent<MeshFilter>().sharedMesh=ballMesh;captureBall.AddComponent<MeshRenderer>().sharedMaterial=ballMaterial;captureBall.SetActive(false);
        var line=new GameObject("Skill trail");line.transform.SetParent(transform,false);trail=line.AddComponent<LineRenderer>();trail.sharedMaterial=effectMaterial;trail.widthMultiplier=.05f;trail.numCapVertices=4;trail.positionCount=0;
    }
    private void Update()
    {
        if(Animating||Partner==null)return;
        Partner.Pose(Time.unscaledTime);Enemy.Pose(Time.unscaledTime);
    }
    public string MoveName(bool partner)
    {
        int species=partner?4:Enemy.Species;return species==4?"火花":species==0?"电击":species==1?"飞叶":species==2?"撞击":"水弹";
    }
    public IEnumerator Attack(bool partner,Action impact)
    {
        Animating=true;var attacker=partner?Partner:Enemy;var defender=partner?Enemy:Partner;
        Phase="Charge";
        for(float t=0;t<.32f;t+=Time.unscaledDeltaTime){attacker.Pose(Time.unscaledTime,t/.32f);defender.Pose(Time.unscaledTime);yield return null;}
        Phase="Release";int species=attacker.Species;
        Color color=OpenWorldBuilder.Hex(species==4?"FF9C35":species==0?"FFF18A":species==1?"B6EC68":species==2?"F8E1BA":"6EDFF8");effectMaterial.color=color;
        projectile.SetActive(species!=2);trail.positionCount=species==0?9:2;
        var start=attacker.transform.position+Vector3.up*(species==4?1.04f:.83f);var end=defender.transform.position+Vector3.up*.68f;
        for(float t=0;t<.38f;t+=Time.unscaledDeltaTime)
        {
            float u=t/.38f;attacker.Pose(Time.unscaledTime,1-u,0,species==2?Mathf.Sin(u*Mathf.PI*.5f)*2.5f:.18f*Mathf.Sin(u*Mathf.PI));
            var point=Vector3.Lerp(start,end,u);projectile.transform.position=point;
            projectile.transform.localScale=species==1?new Vector3(.34f,.035f,.15f):Vector3.one*(species==4?.24f:.20f);
            projectile.transform.rotation=Quaternion.Euler(u*480,u*600,0);
            if(species==0)for(int k=0;k<9;k++)trail.SetPosition(k,Vector3.Lerp(start,point,k/8f)+side*((k==0||k==8)?0:Mathf.Sin(k*13+t*80)*.13f));
            else{trail.SetPosition(0,Vector3.Lerp(start,point,.65f));trail.SetPosition(1,point);}
            yield return null;
        }
        Phase="Impact";Impacts++;impact();trail.positionCount=0;projectile.SetActive(true);projectile.transform.position=end;
        foreach(var spark in sparks)spark.SetActive(true);
        for(float t=0;t<.30f;t+=Time.unscaledDeltaTime)
        {
            float u=t/.30f;projectile.transform.localScale=Vector3.one*(.38f+u*.42f);
            effectMaterial.color=Color.Lerp(color,new Color(color.r,color.g,color.b,0),u);
            for(int i=0;i<sparks.Length;i++)
            {
                float a=i*Mathf.PI*2/sparks.Length;var direction=side*Mathf.Cos(a)+Vector3.up*Mathf.Sin(a);
                sparks[i].transform.position=end+direction*(.48f+u*.60f);sparks[i].transform.localScale=Vector3.one*(.12f*(1-u)+.03f);
            }
            defender.Pose(Time.unscaledTime,0,Mathf.Sin(u*Mathf.PI),-.12f*Mathf.Sin(u*Mathf.PI));
            attacker.Pose(Time.unscaledTime,0,0,species==2?2.5f*(1-u):0);yield return null;
        }
        foreach(var spark in sparks)spark.SetActive(false);
        projectile.SetActive(false);attacker.Pose(Time.unscaledTime);defender.Pose(Time.unscaledTime);Phase="Idle";Animating=false;
    }
    public IEnumerator Knockout(bool enemy)
    {
        Animating=true;Phase="Faint";var actor=enemy?Enemy:Partner;
        for(float t=0;t<.55f;t+=Time.unscaledDeltaTime){actor.Fainted=Mathf.SmoothStep(0,1,t/.55f);actor.Pose(Time.unscaledTime);yield return null;}
        actor.Fainted=1;actor.Pose(Time.unscaledTime);Animating=false;Phase="Result";
    }
    public IEnumerator Capture(bool success)
    {
        Animating=true;Phase="Capture";captureBall.SetActive(true);
        Vector3 from=Partner.transform.position+Vector3.up,to=Enemy.Home+Vector3.up*.18f;
        for(float t=0;t<.25f;t+=Time.unscaledDeltaTime){float u=t/.25f;captureBall.transform.position=Vector3.Lerp(from,to,u)+Vector3.up*Mathf.Sin(u*Mathf.PI)*1.2f;yield return null;}
        captureBall.transform.position=to;
        for(float t=0;t<.30f;t+=Time.unscaledDeltaTime){Enemy.transform.localScale=Vector3.one*(1-t/.30f);captureBall.transform.rotation=Quaternion.Euler(0,0,Mathf.Sin(t*55)*25);yield return null;}
        Enemy.gameObject.SetActive(!success);Enemy.transform.localScale=Vector3.one;captureBall.SetActive(false);Animating=false;Phase="Idle";
    }
    private void OnDestroy(){if(effectMaterial!=null)Destroy(effectMaterial);if(ballMaterial!=null)Destroy(ballMaterial);if(ballMesh!=null)Destroy(ballMesh);}
}
