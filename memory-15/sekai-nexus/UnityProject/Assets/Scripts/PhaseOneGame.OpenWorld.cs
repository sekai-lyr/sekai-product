using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

public sealed partial class PhaseOneGame
{
    private const string ExpeditionSaveKey="kanto-open-world-expedition-v1";
    private bool openWorldEnabled=true;
    private OpenWorldBuilder openWorld;
    private PokemonWildlife wildlife;
    private int discoveredRegions=1, previousRegion=-1;
    private Vector2? expeditionWaypoint=OpenWorldBuilder.Landmarks[1];
    private float expeditionNoticeUntil;
    private ExpeditionSave loadedExpedition;
    private GameObject expeditionMapPanel;
    private Text expeditionQuestText, compassText, interactionText, mapLegendText, waypointText;
    private RectTransform mapPlayerIcon, mapWaypointIcon, worldWaypointIcon;
    private Text[] mapLandmarkLabels;
    private GameObject nearestFieldObject;
    private Vector3 battleCameraAnchor;
    private AudioClip fieldAmbience;
    private Material expeditionSky;

    [Serializable] private sealed class ExpeditionSave
    {
        public int Version=1,Level=5,Experience,Wins,Discovered=1;
        public float X,Z,Yaw;
        public string Caught,Defeated;
    }

    private void BuildOpenWorldMap()
    {
        currentMap=WorldMap.Town;
        if(mapRoot!=null)Destroy(mapRoot.gameObject);
        mapRoot=new GameObject("Kanto / continuous expedition world").transform;
        transitionPoints.Clear();worldCreatures.Clear();worldNpcs.Clear();
        openWorld=mapRoot.gameObject.AddComponent<OpenWorldBuilder>();openWorld.Build();
        var town=new GameObject("Pallet Town settlement");town.transform.SetParent(mapRoot,false);new PalletTownBuilder(town.transform).Build(true);
        for(int i=0;i<Npcs.Length;i++)if(Npcs[i].Map==WorldMap.Town)CreateNpc(Npcs[i]);
        wildlife=mapRoot.gameObject.AddComponent<PokemonWildlife>();wildlife.Build(caughtIds,defeatedIds,worldCreatures);
        thirdPersonDistance=6.8f;resolvedCameraDistance=6.8f;cameraPitch=14;
        playerController.stepOffset=.38f;
        Physics.SyncTransforms();
        if(loadedExpedition!=null)
        {
            Vector2 pos=new Vector2(loadedExpedition.X,loadedExpedition.Z);
            var surface=GroundPosition(pos);TeleportPlayer(surface+Vector3.up*.15f);cameraYaw=loadedExpedition.Yaw;
        }
        else TeleportPlayer(new Vector3(0,.16f,8));
        CreateExpeditionMap();UpdateTownCameraMode();
    }

    private void SetupOpenWorldEnvironment()
    {
        mainCamera.farClipPlane=1400;
        mainCamera.clearFlags=CameraClearFlags.Skybox;
        expeditionSky=new Material(Resources.Load<Shader>("WorldSky"));RenderSettings.skybox=expeditionSky;
        RenderSettings.fogMode=FogMode.ExponentialSquared;RenderSettings.fogDensity=.00145f;RenderSettings.fogColor=new Color(.72f,.82f,.81f);
        RenderSettings.ambientMode=UnityEngine.Rendering.AmbientMode.Trilight;
        RenderSettings.ambientSkyColor=new Color(.55f,.66f,.72f);RenderSettings.ambientEquatorColor=new Color(.43f,.51f,.44f);RenderSettings.ambientGroundColor=new Color(.27f,.31f,.23f);
        QualitySettings.shadowDistance=115;QualitySettings.shadowCascades=4;QualitySettings.lodBias=1.4f;
        var sun=GameObject.Find("Sunlight").GetComponent<Light>();sun.intensity=1.04f;sun.color=new Color(1,.96f,.82f);sun.transform.rotation=Quaternion.Euler(48,-35,0);sun.shadowStrength=.68f;
        // Low-volume original synthesized wind/birds; no external music or audio assets.
        const int sampleRate=22050;const int seconds=24;
        var samples=new float[sampleRate*seconds];var rng=new System.Random(251);float wind=0;
        for(int i=0;i<samples.Length;i++)
        {
            float t=(float)i/sampleRate;wind=Mathf.Lerp(wind,(float)rng.NextDouble()*2-1,.012f);
            float chirpTime=t%6.0f,chirp=0;
            if(chirpTime>.6f && chirpTime<1.02f){float q=(chirpTime-.6f)/.42f;chirp=Mathf.Sin(2*Mathf.PI*(1800*t+120*Mathf.Sin(q*9)))*Mathf.Sin(q*Mathf.PI)*.022f;}
            samples[i]=(wind*.14f+chirp)*Mathf.Min(1,Mathf.Min(t,seconds-t));
        }
        fieldAmbience=AudioClip.Create("Original meadow wind and birds",samples.Length,1,sampleRate,false);fieldAmbience.SetData(samples,0);
        if(mainCamera.GetComponent<AudioListener>()==null)mainCamera.gameObject.AddComponent<AudioListener>();
        var source=mapRoot.gameObject.AddComponent<AudioSource>();source.clip=fieldAmbience;source.loop=true;source.volume=.28f;source.Play();
        SetNotice("关都之旅 · 从真新镇出发，沿北侧道路探索原野");
    }

    private void UpdateExpeditionFrame()
    {
        if(Input.GetKeyDown(KeyCode.M) && currentBattle==null)ToggleExpeditionMap();
        if(Input.GetKeyDown(KeyCode.Escape))
        {
            if(expeditionMapPanel.activeSelf)expeditionMapPanel.SetActive(false);
            selectedInteractable=null;selectedNpcDialog=null;
            mouseLookCaptured=false;Cursor.lockState=CursorLockMode.None;Cursor.visible=true;
        }
        if(Input.GetKeyDown(KeyCode.F5) && currentBattle==null)SaveExpeditionProgress();
        bool modal=expeditionMapPanel.activeSelf;
        if(currentBattle==null && !modal)
        {
            UpdateCameraInput();UpdatePlayerMovement();UpdateFieldInteractions();
            if(Input.GetKeyDown(KeyCode.E) && nearestFieldObject!=null)
            {
                var interactable=nearestFieldObject.GetComponent<WorldInteractable>();
                if(!string.IsNullOrEmpty(interactable.CreatureId))
                {
                    battleCameraAnchor=nearestFieldObject.transform.position;
                    StartBattle(CreatureCatalog.Find(interactable.CreatureId),false);
                }
                else SelectInteractable(interactable);
            }
            DiscoverExpeditionRegion();
        }
        else if(currentBattle!=null)
        {
            if(currentBattle.Result==BattleResult.None)
            {
                if(Input.GetKeyDown(KeyCode.Alpha1))AttackEnemy();
                if(Input.GetKeyDown(KeyCode.Alpha2))CaptureEnemy();
                if(Input.GetKeyDown(KeyCode.Alpha3))EscapeBattle();
            }
            else if(Input.GetKeyDown(KeyCode.Return))ReturnToWorld();
        }
        wildlife.Animate(player.transform.position,Time.time,Time.deltaTime,currentBattle!=null||modal);
        var speed=playerController.velocity;speed.y=0;
        if(ashAvatar!=null)ashAvatar.Animate(currentBattle==null&&!modal?speed.magnitude:0,playerController.isGrounded||currentBattle!=null,verticalVelocity,Time.deltaTime);
        UpdateCameraFollow();UpdateExpeditionNavigation();
        if(Time.unscaledTime>=hudRefreshAt)UpdateHud(false);
    }

    private Vector3 ConstrainExpeditionMovement(Vector3 next)
    {
        next.x=Mathf.Clamp(next.x,-360,360);next.z=Mathf.Clamp(next.z,-135,580);
        if(OpenWorldBuilder.Height(next.x,next.z)<OpenWorldBuilder.WaterY+.28f)
        {
            // Bridges and the town dock remain walkable over water. Ignore the player's own capsule.
            bool bridge=false;
            foreach(var hit in Physics.RaycastAll(new Vector3(next.x,player.transform.position.y+2,next.z),Vector3.down,5,~0,QueryTriggerInteraction.Ignore))
            {
                if(hit.transform.IsChildOf(player.transform))continue;
                if(hit.point.y>=OpenWorldBuilder.WaterY+.3f && hit.point.y<=player.transform.position.y+.5f){bridge=true;break;}
            }
            if(!bridge){next.x=player.transform.position.x;next.z=player.transform.position.z;}
        }
        return next;
    }
    private Vector3 GroundPosition(Vector2 p)
    {
        float y=OpenWorldBuilder.Height(p.x,p.y);
        // Use the highest built surface, including the bridge/platforms, on save restore.
        foreach(var hit in Physics.RaycastAll(new Vector3(p.x,220,p.y),Vector3.down,250,~0,QueryTriggerInteraction.Ignore))
        {
            if(player!=null && hit.transform.IsChildOf(player.transform))continue;
            y=Mathf.Max(y,hit.point.y);
        }
        if(y<OpenWorldBuilder.WaterY+.15f)return new Vector3(0,.1f,8);
        return new Vector3(p.x,y,p.y);
    }
    private void UpdateFieldInteractions()
    {
        nearestFieldObject=null;float nearest=4.2f;
        foreach(var a in wildlife.Actors)
        {
            if(!a.Object.activeSelf)continue;float d=Vector3.Distance(a.Object.transform.position,player.transform.position);
            if(d<nearest){nearest=d;nearestFieldObject=a.Object;}
        }
        foreach(var npc in worldNpcs.Values)
        {
            float d=Vector3.Distance(npc.transform.position,player.transform.position);
            if(d<nearest){nearest=d;nearestFieldObject=npc;}
        }
        if(selectedInteractable!=null && Vector3.Distance(selectedInteractable.transform.position,player.transform.position)>6){selectedInteractable=null;selectedNpcDialog=null;}
    }
    private void DiscoverExpeditionRegion()
    {
        var p=player.transform.position;int region=OpenWorldBuilder.Region(p);
        if(region!=previousRegion)
        {
            if(previousRegion>=0)SetNotice(OpenWorldBuilder.Names[region]+"  /  "+OpenWorldBuilder.EnglishNames[region]);
            previousRegion=region;
        }
        for(int i=0;i<OpenWorldBuilder.Landmarks.Length;i++)
        {
            if((discoveredRegions&(1<<i))!=0)continue;
            if(Vector2.Distance(new Vector2(p.x,p.z),OpenWorldBuilder.Landmarks[i])>19)continue;
            discoveredRegions|=1<<i;GainExperience(20);SetNotice("发现新地点："+OpenWorldBuilder.Names[i]+"  ·  调查经验 +20");
            if(expeditionWaypoint.HasValue && Vector2.Distance(expeditionWaypoint.Value,OpenWorldBuilder.Landmarks[i])<1)
            {
                expeditionWaypoint=null;
                for(int j=1;j<OpenWorldBuilder.Landmarks.Length;j++)if((discoveredRegions&(1<<j))==0){expeditionWaypoint=OpenWorldBuilder.Landmarks[j];break;}
            }
        }
    }
    private void UpdateFieldBattleCamera()
    {
        if(battleScene!=null){mainCamera.transform.position=Vector3.Lerp(mainCamera.transform.position,battleScene.CameraPosition,1-Mathf.Exp(-7*Time.deltaTime));mainCamera.transform.LookAt(battleScene.Focus);return;}
        var enemyPosition=battleCameraAnchor;
        if(worldCreatures.TryGetValue(currentBattle.Enemy.Id,out var creature))enemyPosition=creature.transform.position;
        var focus=(player.transform.position+enemyPosition)*.5f+Vector3.up*.85f;
        var axis=(enemyPosition-player.transform.position);axis.y=0;
        if(axis.sqrMagnitude<.1f)axis=Vector3.forward;
        var side=Vector3.Cross(Vector3.up,axis.normalized);
        var target=focus+side*4.8f-axis.normalized*3.4f+Vector3.up*1.6f;
        mainCamera.transform.position=Vector3.Lerp(mainCamera.transform.position,target,1-Mathf.Exp(-5*Time.deltaTime));mainCamera.transform.LookAt(focus);
    }
    private ExpeditionSave MakeExpeditionSave()
    {
        return new ExpeditionSave{X=player.transform.position.x,Z=player.transform.position.z,Yaw=cameraYaw,Level=playerLevel,Experience=playerExperience,Wins=battleWins,Discovered=discoveredRegions,Caught=string.Join("|",caughtIds),Defeated=string.Join("|",defeatedIds)};
    }
    private void SaveExpeditionProgress()
    {
        if(currentBattle!=null)return;
        PlayerPrefs.SetString(ExpeditionSaveKey,JsonUtility.ToJson(MakeExpeditionSave()));PlayerPrefs.Save();SetNotice("已保存：位置、图鉴、等级与探索记录");
    }
    private void LoadExpeditionProgress()
    {
        playerLevel=5;
        // Automated review is deterministic and never reads or overwrites the player's expedition save.
        if(Array.IndexOf(Environment.GetCommandLineArgs(),"-worldCapture")>=0 || !PlayerPrefs.HasKey(ExpeditionSaveKey))return;
        try
        {
            var data=JsonUtility.FromJson<ExpeditionSave>(PlayerPrefs.GetString(ExpeditionSaveKey));
            if(data==null||data.Version!=1||float.IsNaN(data.X)||float.IsNaN(data.Z)||Mathf.Abs(data.X)>360||data.Z< -135||data.Z>580)throw new Exception("Invalid expedition position");
            loadedExpedition=data;playerLevel=Mathf.Max(5,data.Level);playerExperience=Mathf.Max(0,data.Experience);battleWins=Mathf.Max(0,data.Wins);discoveredRegions=(data.Discovered&63)|1;
            AddIds(caughtIds,data.Caught);AddIds(defeatedIds,data.Defeated);
            expeditionWaypoint=null;
            for(int i=1;i<OpenWorldBuilder.Landmarks.Length;i++)if((discoveredRegions&(1<<i))==0){expeditionWaypoint=OpenWorldBuilder.Landmarks[i];break;}
        }
        catch(Exception e){Debug.LogWarning("Expedition save was left unchanged: "+e.Message);}
    }
    private void DisposeExpeditionAssets()
    {
        if(fieldAmbience!=null)Destroy(fieldAmbience);if(expeditionSky!=null)Destroy(expeditionSky);
    }
}
