using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using UnityEngine;

public sealed partial class PhaseOneGame
{
    private IEnumerator CaptureWorldReview(string directory)
    {
        capturingTown=true;Directory.CreateDirectory(directory);
        var review=RunWorldChecks(directory);
        while(true)
        {
            bool next;
            try { next=review.MoveNext(); }
            catch(Exception e){Debug.LogError("WORLD_REVIEW_FAILED: "+e);Application.Quit(1);yield break;}
            if(!next)break;yield return review.Current;
        }
        Debug.Log("WORLD_REVIEW_OK: routes, bridge, shore, terrain, wildlife, encounter, capture, save serialization and map passed.");
        Application.Quit(0);
    }
    private IEnumerator RunWorldChecks(string directory)
    {
        yield return null;yield return null;Physics.SyncTransforms();
        openWorld.ValidateNatureModels();
        if(openWorld.TerrainTiles!=64||openWorld.TreeCount<500||wildlife.Actors.Count!=20||transitionPoints.Count!=0)throw new Exception("World content or seamless state is invalid.");
        Debug.Log("WORLD_DIMENSIONS_OK: 768 x 768 m, 64 terrain tiles, 6 landmarks, 20 wild Pokemon, zero scene-transition portals.");
        TeleportPlayer(GroundPosition(new Vector2(6,66))+Vector3.up*.1f);cameraYaw=0;cameraPitch=12;UpdateCameraFollow();UpdateExpeditionHud();UpdateExpeditionNavigation();
        yield return null;CaptureExpeditionCamera(Path.Combine(directory,"00-first-look.png"),true);
        for(int i=0;i<OpenWorldBuilder.Landmarks.Length;i++)
        {
            var p=OpenWorldBuilder.Surface(OpenWorldBuilder.Landmarks[i]);
            if(p.y<OpenWorldBuilder.WaterY+.2f)throw new Exception("Landmark underwater: "+OpenWorldBuilder.Names[i]+" at "+p);
        }
        // Run the exact keyboard controller along every route, including the river bridge.
        float totalTravel=0;
        foreach(var route in OpenWorldBuilder.Routes)
        {
            TeleportPlayer(GroundPosition(route[0])+Vector3.up*.15f);Physics.SyncTransforms();
            for(int settle=0;settle<30;settle++)MovePlayer(Vector2.zero,false,false,1f/60);
            for(int waypoint=1;waypoint<route.Length;waypoint++)
            {
                var target=route[waypoint];int steps=0;int stalled=0;
                while(Vector2.Distance(new Vector2(player.transform.position.x,player.transform.position.z),target)>1.2f)
                {
                    var p=player.transform.position;var d=target-new Vector2(p.x,p.z);cameraYaw=Mathf.Atan2(d.x,d.y)*Mathf.Rad2Deg;
                    MovePlayer(Vector2.up,true,false,1f/60);
                    float moved=Vector3.Distance(p,player.transform.position);totalTravel+=moved;
                    stalled=moved<.015f?stalled+1:0;
                    if(stalled>90||++steps>1500)throw new Exception("Route blocked at "+player.transform.position+" heading to "+target);
                    if(player.transform.position.y<OpenWorldBuilder.WaterY-.4f)throw new Exception("Controller fell below traversable ground.");
                    DiscoverExpeditionRegion();
                }
            }
        }
        Debug.Log("WORLD_ROUTES_OK: travelled "+totalTravel.ToString("F1")+" metres using the player controller, including bridge and coast.");
        // Boundary and water safety use the same movement constraint as live input.
        TeleportPlayer(OpenWorldBuilder.Surface(new Vector2(140,230),.2f));Physics.SyncTransforms();
        var unsafePoint=new Vector3(225,player.transform.position.y,248);
        if(ConstrainExpeditionMovement(unsafePoint).x==unsafePoint.x)throw new Exception("Deep lake is incorrectly walkable.");
        var clamped=ConstrainExpeditionMovement(new Vector3(900,150,900));if(clamped.x>360||clamped.z>580)throw new Exception("World boundary clamp failed.");
        var ash=ashAvatar.GetComponentInChildren<SkinnedMeshRenderer>();if(ash==null||ashAvatar.BoneCount!=17)throw new Exception("Playable Ash rig missing.");
        var actor=wildlife.Actors[0];
        // Real attack coroutines: HP must remain unchanged during windup; double input is ignored.
        foreach(int index in new[]{0,1,2,12})
        {
            var wild=wildlife.Actors[index];TeleportPlayer(wild.Object.transform.position+new Vector3(0,.1f,-2));
            battleCameraAnchor=wild.Object.transform.position;StartBattle(wild.Definition,false);
            if(battleScene==null||battleScene.Partner.JointCount<6||battleScene.Enemy.JointCount<6)throw new Exception("Articulated battle models are missing.");
            int before=currentBattle.EnemyHp,playerBefore=currentBattle.PlayerHp;AttackEnemy();AttackEnemy();
            if(currentBattle.EnemyHp!=before||!currentBattle.Busy)throw new Exception("Attack damages before impact or fails to lock input.");
            yield return new WaitForSecondsRealtime(.12f);
            if(currentBattle.EnemyHp!=before)throw new Exception("Damage was applied during charge.");
            if(battleScene.Partner.PoseDeviation<5)throw new Exception("Battle joints are not animating.");
            CaptureExpeditionCamera(Path.Combine(directory,"battle-"+index+"-charge.png"),true);
            float deadline=Time.unscaledTime+6;
            while(battleScene.Phase!="Release"&&Time.unscaledTime<deadline)yield return null;
            yield return new WaitForSecondsRealtime(.18f);
            CaptureExpeditionCamera(Path.Combine(directory,"battle-"+index+"-projectile.png"),true);
            while(battleScene.Phase!="Impact"&&Time.unscaledTime<deadline)yield return null;
            if(battleScene.Phase!="Impact")throw new Exception("Player attack did not reach impact.");
            CaptureExpeditionCamera(Path.Combine(directory,"battle-"+index+"-impact.png"),true);
            while(battleScene.Impacts<2&&Time.unscaledTime<deadline)yield return null;
            CaptureExpeditionCamera(Path.Combine(directory,"battle-"+index+"-counter.png"),true);
            while(currentBattle.Busy&&Time.unscaledTime<deadline)yield return null;
            int dealt=before-currentBattle.EnemyHp;
            if(currentBattle.Busy||battleScene.Impacts!=2||currentBattle.PlayerHp>=playerBefore||dealt<ActiveCreature.Attack+playerLevel||dealt>ActiveCreature.Attack+playerLevel+3)throw new Exception("Attack/counter/double-click validation failed.");
            EscapeBattle();ReturnToWorld();if(!wild.Object.activeSelf||battleScene!=null)throw new Exception("Battle cleanup did not restore wild Pokemon.");
        }
        Debug.Log("BATTLE_3D_ATTACK_OK: four opponents, articulated models, charge/impact timing, duplicate-input lock, four counters and escape cleanup.");
        int oldLevel=playerLevel,oldExperience=playerExperience,oldWins=battleWins;
        TeleportPlayer(actor.Object.transform.position+new Vector3(0,.1f,-2));StartBattle(actor.Definition,false);
        currentBattle.EnemyHp=1;AttackEnemy();float knockoutDeadline=Time.unscaledTime+6;
        while(currentBattle.Result==BattleResult.None&&Time.unscaledTime<knockoutDeadline)yield return null;
        if(currentBattle.Result!=BattleResult.Defeated||battleScene.Enemy.Fainted!=1)throw new Exception("Enemy defeat animation failed.");
        CaptureExpeditionCamera(Path.Combine(directory,"battle-enemy-defeated.png"),true);ReturnToWorld();defeatedIds.Remove(actor.Definition.Id);actor.Object.SetActive(true);
        StartBattle(actor.Definition,false);currentBattle.PlayerHp=1;EnemyTurn();knockoutDeadline=Time.unscaledTime+6;
        while(currentBattle.Result==BattleResult.None&&Time.unscaledTime<knockoutDeadline)yield return null;
        if(currentBattle.Result!=BattleResult.Lost||battleScene.Partner.Fainted!=1)throw new Exception("Partner defeat animation failed.");
        CaptureExpeditionCamera(Path.Combine(directory,"battle-partner-defeated.png"),true);ReturnToWorld();
        playerLevel=oldLevel;playerExperience=oldExperience;battleWins=oldWins;
        Debug.Log("BATTLE_3D_RESULT_OK: enemy/partner fainting, results, exploration return and wild-object restoration.");
        TeleportPlayer(actor.Object.transform.position+new Vector3(0,.1f,-2));StartBattle(actor.Definition,false);CaptureEnemy();CaptureEnemy();
        if(currentBattle.CaptureAttempts!=1)throw new Exception("Repeated capture is not locked.");
        yield return new WaitForSecondsRealtime(.16f);CaptureExpeditionCamera(Path.Combine(directory,"battle-pokeball.png"),true);
        float captureDeadline=Time.unscaledTime+6;
        while(currentBattle.Busy&&Time.unscaledTime<captureDeadline)yield return null;
        if(currentBattle.Busy||currentBattle.Result!=BattleResult.None||battleScene.Impacts!=1||!battleScene.Enemy.gameObject.activeSelf||currentBattle.PlayerHp>=currentBattle.PlayerMaxHp)throw new Exception("Failed capture does not restore model and counterattack.");
        EscapeBattle();ReturnToWorld();Debug.Log("BATTLE_3D_CAPTURE_FAIL_OK: capture input lock, ball animation, escape, enemy restoration and counterattack.");
        TeleportPlayer(actor.Object.transform.position+new Vector3(0,.1f,-2));Physics.SyncTransforms();
        UpdateFieldInteractions();if(nearestFieldObject!=actor.Object)throw new Exception("Nearby Pokemon interaction failed.");
        battleCameraAnchor=actor.Object.transform.position;StartBattle(actor.Definition,false);
        if(currentBattle==null||!battlePanel.activeSelf)throw new Exception("Wild encounter did not start.");
        currentBattle.EnemyHp=1;CaptureEnemy();
        yield return new WaitForSecondsRealtime(.8f);
        if(currentBattle.Result!=BattleResult.Captured||!caughtIds.Contains(actor.Definition.Id)||actor.Object.activeSelf)throw new Exception("Capture result did not update world and collection.");
        ReturnToWorld();if(currentBattle!=null||battlePanel.activeSelf)throw new Exception("Return from encounter failed.");
        // No PlayerPrefs writes: exercise the exact save payload through JSON roundtrip.
        var json=JsonUtility.ToJson(MakeExpeditionSave());var restored=JsonUtility.FromJson<ExpeditionSave>(json);
        if(restored.Discovered!=discoveredRegions||!restored.Caught.Contains(actor.Definition.Id)||Mathf.Abs(restored.X-player.transform.position.x)>.01f)throw new Exception("Expedition save roundtrip failed.");
        Debug.Log("WORLD_GAMEPLAY_OK: E interaction target, encounter, weakened capture, return, collection and save-payload roundtrip.");
        ToggleExpeditionMap();yield return null;Canvas.ForceUpdateCanvases();
        var mapInput=expeditionMapPanel.GetComponentInChildren<ExpeditionMapInput>();var mapRect=(RectTransform)mapInput.transform;
        var testUv=WorldMapUv(OpenWorldBuilder.Landmarks[2]);
        Vector3 localClick=new Vector3(mapRect.rect.xMin+testUv.x*mapRect.rect.width,mapRect.rect.yMin+testUv.y*mapRect.rect.height,0);
        var pointer=new UnityEngine.EventSystems.PointerEventData(UnityEngine.EventSystems.EventSystem.current){position=RectTransformUtility.WorldToScreenPoint(null,mapRect.TransformPoint(localClick))};
        var hits=new List<UnityEngine.EventSystems.RaycastResult>();UnityEngine.EventSystems.EventSystem.current.RaycastAll(pointer,hits);
        if(hits.Count==0||hits[0].gameObject!=mapInput.gameObject)throw new Exception("Map terrain is not receiving UI clicks: hits="+hits.Count+" first="+(hits.Count>0?hits[0].gameObject.name:"none")+" at="+pointer.position+" rect="+mapRect.rect);
        mapInput.OnPointerClick(pointer);
        if(!expeditionWaypoint.HasValue||Vector2.Distance(expeditionWaypoint.Value,OpenWorldBuilder.Landmarks[2])>.1f)throw new Exception("Map click to world waypoint projection failed.");
        ToggleExpeditionMap();Debug.Log("WORLD_MAP_UI_OK: UI raycast and actual click handler place the correct world-space waypoint.");
        caughtIds.Remove(actor.Definition.Id);actor.Object.SetActive(true);battleWins=0;discoveredRegions=1;playerExperience=0;expeditionWaypoint=OpenWorldBuilder.Landmarks[1];
        thirdPerson=true;townOverview=false;UpdateTownCameraMode();ashAvatar.ResetPose();
        var shots=new[]{
            new Vector3(6,0,66),new Vector3(-55,0,181),new Vector3(145,0,195),new Vector3(64,0,424),new Vector3(-83,0,-62)};
        var yaw=new[]{0f,-22f,68f,153f,-148f};
        var fileNames=new[]{"01-meadow-gameplay.png","02-forest-gameplay.png","03-lake-gameplay.png","04-ridge-gameplay.png","05-coast-gameplay.png"};
        for(int i=0;i<shots.Length;i++)
        {
            var p=shots[i];TeleportPlayer(GroundPosition(new Vector2(p.x,p.z))+Vector3.up*.1f);Physics.SyncTransforms();
            for(int j=0;j<45;j++)MovePlayer(Vector2.zero,false,false,1f/60);
            player.transform.rotation=Quaternion.Euler(0,yaw[i],0);cameraYaw=yaw[i];cameraPitch=i==3?19:12;resolvedCameraDistance=thirdPersonDistance;
            UpdateCameraFollow();UpdateFieldInteractions();UpdateExpeditionHud();UpdateExpeditionNavigation();noticeText.text="";
            yield return null;CaptureExpeditionCamera(Path.Combine(directory,fileNames[i]),true);
        }
        // An overview verifies world-scale shape, rivers, trees, routes, and landmark placement.
        mainCamera.transform.position=new Vector3(410,380,-155);mainCamera.transform.LookAt(new Vector3(0,14,205));mainCamera.fieldOfView=58;
        CaptureExpeditionCamera(Path.Combine(directory,"06-world-overview.png"),false);
        ToggleExpeditionMap();UpdateExpeditionNavigation();CaptureExpeditionCamera(Path.Combine(directory,"07-field-map.png"),true);ToggleExpeditionMap();
        actor.Object.transform.rotation=Quaternion.Euler(0,180,0);
        mainCamera.transform.position=actor.Object.transform.position+new Vector3(1.7f,1.1f,-3.2f);mainCamera.transform.LookAt(actor.Object.transform.position+Vector3.up*.6f);mainCamera.fieldOfView=38;
        CaptureExpeditionCamera(Path.Combine(directory,"08-pikachu-wildlife.png"),false);mainCamera.fieldOfView=60;
        CaptureNatureStudies(directory);
        // Hidden batch-mode windows need explicit rendering; a 1-pixel readback waits for GPU completion.
        var sampleTarget=new RenderTexture(1440,900,24){antiAliasing=4};var probe=new Texture2D(1,1,TextureFormat.RGB24,false);
        var previousTarget=mainCamera.targetTexture;var previousActive=RenderTexture.active;
        mainCamera.targetTexture=sampleTarget;
        for(int region=0;region<2;region++)
        {
            TeleportPlayer(OpenWorldBuilder.Surface(region==0?new Vector2(0,41):new Vector2(-55,181),.1f));
            cameraYaw=region==0?12:-22;cameraPitch=12;resolvedCameraDistance=thirdPersonDistance;UpdateCameraFollow();
            var frames=new List<float>();var draws=new List<float>();var timer=new System.Diagnostics.Stopwatch();
            for(int i=0;i<150;i++)
            {
                yield return null;timer.Restart();mainCamera.Render();RenderTexture.active=sampleTarget;
                probe.ReadPixels(new Rect(0,0,1,1),0,0,false);timer.Stop();
                if(i>29){frames.Add(Time.unscaledDeltaTime*1000);draws.Add((float)timer.Elapsed.TotalMilliseconds);}
            }
            if(openWorld.DetailedInstances==0||openWorld.SimplifiedInstances==0)throw new Exception("Nature LOD selection is not rendering both detail levels.");
            frames.Sort();draws.Sort();
            Debug.Log("NATURE_"+(region==0?"MEADOW":"FOREST")+"_SAMPLE: frame median="+frames[frames.Count/2].ToString("F2")+"ms p95="+frames[(int)(frames.Count*.95f)].ToString("F2")+"ms; render+GPU-readback median="+draws[draws.Count/2].ToString("F2")+"ms p95="+draws[(int)(draws.Count*.95f)].ToString("F2")+"ms; near="+openWorld.DetailedInstances+", far="+openWorld.SimplifiedInstances+", submitted vegetation triangles="+openWorld.VegetationTriangles+", batches="+openWorld.VisibleBatches+", Unity allocations="+UnityEngine.Profiling.Profiler.GetTotalAllocatedMemoryLong()/1048576+" MiB. 1440x900, 4x MSAA, 60 FPS cap; not a whole-world stress test.");
        }
        mainCamera.targetTexture=previousTarget;RenderTexture.active=previousActive;sampleTarget.Release();Destroy(sampleTarget);Destroy(probe);
    }
    private void CaptureNatureStudies(string directory)
    {
        bool fog=RenderSettings.fog;var flags=mainCamera.clearFlags;var background=mainCamera.backgroundColor;
        RenderSettings.fog=false;mainCamera.clearFlags=CameraClearFlags.SolidColor;mainCamera.backgroundColor=OpenWorldBuilder.Hex("D1D9D3");
        var origin=new Vector3(2000,0,0);
        var floorData=new WorldMeshData();floorData.Box(origin-new Vector3(0,.25f,0),new Vector3(30,.1f,30),OpenWorldBuilder.Hex("B7BCAC"));
        var floorMesh=floorData.ToMesh("Model review ground");var floorMat=new Material(Resources.Load<Shader>("WorldNature"));
        var floor=new GameObject("Model review ground");floor.AddComponent<MeshFilter>().sharedMesh=floorMesh;floor.AddComponent<MeshRenderer>().sharedMaterial=floorMat;
        var names=new[]{"broadleaf","cedar","stone","grass"};
        var views=new[]{new Vector3(1.1f,.45f,-1.5f),Vector3.back,Vector3.left,Vector3.right,Vector3.forward};
        var viewNames=new[]{"perspective","front","left","right","back"};
        for(int model=0;model<4;model++)
        {
            var g=openWorld.CreateNatureStudy(origin,model,true);var bounds=g.GetComponent<MeshFilter>().sharedMesh.bounds;
            floor.transform.position=new Vector3(0,model==3?.195f:0,0);
            var centre=origin+bounds.center;float extent=Mathf.Max(bounds.size.x,bounds.size.y,bounds.size.z);
            for(int view=0;view<views.Length;view++)
            {
                mainCamera.orthographic=view!=0;mainCamera.orthographicSize=extent*.62f;mainCamera.fieldOfView=38;
                mainCamera.transform.position=centre+views[view].normalized*extent*2.1f;mainCamera.transform.LookAt(centre);
                CaptureExpeditionCamera(Path.Combine(directory,"09-"+names[model]+"-"+viewNames[view]+".png"),false);
            }
            g.SetActive(false);Destroy(g);
            var far=openWorld.CreateNatureStudy(origin,model,false);mainCamera.orthographic=false;
            mainCamera.transform.position=centre+views[0].normalized*extent*2.1f;mainCamera.transform.LookAt(centre);
            CaptureExpeditionCamera(Path.Combine(directory,"10-"+names[model]+"-far-lod.png"),false);far.SetActive(false);Destroy(far);
        }
        floor.SetActive(false);Destroy(floor);Destroy(floorMesh);Destroy(floorMat);
        mainCamera.orthographic=false;mainCamera.fieldOfView=60;mainCamera.clearFlags=flags;mainCamera.backgroundColor=background;RenderSettings.fog=fog;
        Debug.Log("NATURE_REVIEW_OK: exact gameplay meshes captured in front/left/right/back/perspective and far LOD.");
    }
    private void CaptureExpeditionCamera(string path,bool withHud)
    {
        var mode=hudCanvas.renderMode;bool wasEnabled=hudCanvas.enabled;hudCanvas.enabled=withHud;
        if(withHud){hudCanvas.renderMode=RenderMode.ScreenSpaceCamera;hudCanvas.worldCamera=mainCamera;hudCanvas.planeDistance=.4f;Canvas.ForceUpdateCanvases();}
        var target=new RenderTexture(1920,1200,24){antiAliasing=4};var previous=RenderTexture.active;
        mainCamera.targetTexture=target;mainCamera.Render();RenderTexture.active=target;
        var image=new Texture2D(target.width,target.height,TextureFormat.RGB24,false);image.ReadPixels(new Rect(0,0,target.width,target.height),0,0);image.Apply();File.WriteAllBytes(path,image.EncodeToPNG());
        mainCamera.targetTexture=null;RenderTexture.active=previous;target.Release();Destroy(target);Destroy(image);hudCanvas.renderMode=mode;hudCanvas.enabled=wasEnabled;
    }
}
