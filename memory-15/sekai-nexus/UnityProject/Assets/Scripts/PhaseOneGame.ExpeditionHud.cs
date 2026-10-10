using System;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

public sealed partial class PhaseOneGame
{
    private Font expeditionFont;
    private static Color Ink { get { return new Color(.06f,.14f,.16f,.86f); } }
    private static Color Parchment { get { return new Color(.96f,.94f,.83f); } }
    private GameObject HudCard(Transform parent,Vector2 min,Vector2 max,Color color)
    {
        var panel=CreatePanel(parent,min,max,color);panel.GetComponent<Image>().raycastTarget=false;return panel;
    }
    private Text HudLabel(Transform parent,string name,string value,int size,Vector2 min,Vector2 max,TextAnchor align=TextAnchor.UpperLeft)
    {
        var label=CreateText(parent,name,size,align,min,max,expeditionFont);label.text=value;label.color=Parchment;return label;
    }
    private void SetupExpeditionHud()
    {
        var canvasObject=new GameObject("Kanto expedition interface",typeof(Canvas),typeof(CanvasScaler),typeof(GraphicRaycaster));
        hudCanvas=canvasObject.GetComponent<Canvas>();hudCanvas.renderMode=RenderMode.ScreenSpaceOverlay;
        var scaler=canvasObject.GetComponent<CanvasScaler>();scaler.uiScaleMode=CanvasScaler.ScaleMode.ScaleWithScreenSize;scaler.referenceResolution=new Vector2(1440,900);scaler.screenMatchMode=CanvasScaler.ScreenMatchMode.Expand;
        expeditionFont=Font.CreateDynamicFontFromOSFont(new[]{"Microsoft YaHei","Arial"},24);
        var parent=canvasObject.transform;
        HudCard(parent,new Vector2(.025f,.854f),new Vector2(.263f,.969f),Ink);
        HudCard(parent,new Vector2(.025f,.854f),new Vector2(.028f,.969f),new Color(.91f,.70f,.36f));
        mapText=HudLabel(parent,"Region","真新镇",30,new Vector2(.042f,.884f),new Vector2(.252f,.943f));
        introText=HudLabel(parent,"Region subtitle","KANTO / SOUTHERN EXPEDITION",11,new Vector2(.043f,.864f),new Vector2(.255f,.886f));
        HudLabel(parent,"Series","宝可梦  /  关都之旅",11,new Vector2(.043f,.943f),new Vector2(.26f,.963f));
        HudCard(parent,new Vector2(.354f,.923f),new Vector2(.646f,.963f),new Color(.07f,.15f,.17f,.64f));
        compassText=HudLabel(parent,"Compass","",15,new Vector2(.36f,.925f),new Vector2(.64f,.96f),TextAnchor.MiddleCenter);
        HudCard(parent,new Vector2(.777f,.806f),new Vector2(.975f,.969f),Ink);
        HudLabel(parent,"Journal eyebrow","FIELD JOURNAL   /   野外调查",11,new Vector2(.793f,.936f),new Vector2(.964f,.958f));
        expeditionQuestText=HudLabel(parent,"Exploration goals","",15,new Vector2(.794f,.825f),new Vector2(.961f,.926f));
        HudCard(parent,new Vector2(.025f,.101f),new Vector2(.235f,.197f),Ink);
        progressText=HudLabel(parent,"Partner","",14,new Vector2(.041f,.111f),new Vector2(.223f,.186f));
        noticeText=HudLabel(parent,"Discovery notice","",21,new Vector2(.28f,.80f),new Vector2(.73f,.89f),TextAnchor.MiddleCenter);
        noticeText.gameObject.AddComponent<Shadow>().effectDistance=new Vector2(1,-2);
        HudCard(parent,new Vector2(.025f,.027f),new Vector2(.975f,.073f),new Color(.055f,.12f,.14f,.79f));
        controlsText=HudLabel(parent,"Controls","WASD 移动   Shift 奔跑   空格 跳跃     右键环视 / 滚轮缩放     E 互动     M 地图     F5 保存     Tab 视角",13,new Vector2(.040f,.030f),new Vector2(.96f,.068f),TextAnchor.MiddleLeft);
        interactionText=HudLabel(parent,"Interact prompt","",18,new Vector2(.32f,.17f),new Vector2(.68f,.23f),TextAnchor.MiddleCenter);
        interactionText.gameObject.AddComponent<Shadow>().effectDistance=new Vector2(1,-2);
        crosshairText=HudLabel(parent,"Crosshair","+",20,new Vector2(.49f,.49f),new Vector2(.51f,.51f),TextAnchor.MiddleCenter);crosshairText.enabled=false;
        var waypoint=HudLabel(parent,"World waypoint","◆",24,new Vector2(.5f,.5f),new Vector2(.5f,.5f),TextAnchor.MiddleCenter);
        waypoint.color=new Color(1,.81f,.37f);worldWaypointIcon=waypoint.rectTransform;worldWaypointIcon.sizeDelta=new Vector2(220,68);
        waypointText=waypoint;
        infoPanel=HudCard(parent,new Vector2(.31f,.10f),new Vector2(.69f,.32f),Ink);
        infoText=HudLabel(infoPanel.transform,"Dialogue","",17,new Vector2(.05f,.27f),new Vector2(.95f,.94f));
        infoButton=CreateButton(infoPanel.transform,"关闭",new Vector2(.71f,.07f),new Vector2(.94f,.23f),expeditionFont);infoPanel.SetActive(false);
        var fade=HudCard(parent,Vector2.zero,Vector2.one,Color.black);fadeGroup=fade.AddComponent<CanvasGroup>();fadeGroup.alpha=0;fadeGroup.blocksRaycasts=false;
        SetupFieldBattleHud(parent);
    }
    private void SetupFieldBattleHud(Transform parent)
    {
        battlePanel=HudCard(parent,Vector2.zero,Vector2.one,new Color(0,0,0,.05f));battlePanel.name="Field battle HUD";
        HudCard(battlePanel.transform,new Vector2(.035f,.70f),new Vector2(.305f,.90f),Ink);
        HudCard(battlePanel.transform,new Vector2(.695f,.32f),new Vector2(.965f,.50f),Ink);
        HudCard(battlePanel.transform,new Vector2(.025f,.025f),new Vector2(.975f,.25f),new Color(.055f,.12f,.14f,.96f));
        battleTitleText=HudLabel(battlePanel.transform,"Battle title","",20,new Vector2(.32f,.85f),new Vector2(.69f,.93f),TextAnchor.UpperCenter);
        battleEnemyText=HudLabel(battlePanel.transform,"Wild Pokemon status","",22,new Vector2(.055f,.73f),new Vector2(.295f,.88f));
        battlePartnerText=HudLabel(battlePanel.transform,"Partner status","",20,new Vector2(.718f,.34f),new Vector2(.95f,.48f));
        battleMessageText=HudLabel(battlePanel.transform,"Battle log","",19,new Vector2(.05f,.16f),new Vector2(.95f,.225f));
        battleActions=FullRect("Battle actions",battlePanel.transform);battleResultActions=FullRect("Battle result",battlePanel.transform);
        attackButton=CreateButton(battleActions.transform,"1  攻击",new Vector2(.05f,.055f),new Vector2(.32f,.13f),expeditionFont);
        captureButton=CreateButton(battleActions.transform,"2  精灵球",new Vector2(.365f,.055f),new Vector2(.635f,.13f),expeditionFont);
        runButton=CreateButton(battleActions.transform,"3  离开",new Vector2(.68f,.055f),new Vector2(.95f,.13f),expeditionFont);
        returnButton=CreateButton(battleResultActions.transform,"Enter  继续探索",new Vector2(.37f,.055f),new Vector2(.63f,.13f),expeditionFont);
        battlePanel.SetActive(false);
    }
    private static GameObject FullRect(string name,Transform parent)
    {
        var g=new GameObject(name,typeof(RectTransform));g.transform.SetParent(parent,false);var r=g.GetComponent<RectTransform>();r.anchorMin=Vector2.zero;r.anchorMax=Vector2.one;r.offsetMin=Vector2.zero;r.offsetMax=Vector2.zero;return g;
    }
    private void CreateExpeditionMap()
    {
        expeditionMapPanel=CreatePanel(hudCanvas.transform,new Vector2(.075f,.07f),new Vector2(.925f,.96f),new Color(.035f,.105f,.12f,.98f));expeditionMapPanel.name="Kanto field map";
        HudLabel(expeditionMapPanel.transform,"Map title","关都南部 / FIELD MAP",28,new Vector2(.035f,.90f),new Vector2(.68f,.97f));
        var mapObject=new GameObject("Terrain map",typeof(RectTransform),typeof(RawImage),typeof(ExpeditionMapInput));mapObject.transform.SetParent(expeditionMapPanel.transform,false);
        var rect=mapObject.GetComponent<RectTransform>();rect.anchorMin=rect.anchorMax=new Vector2(.34f,.46f);rect.sizeDelta=new Vector2(640,640);rect.anchoredPosition=Vector2.zero;
        mapObject.GetComponent<RawImage>().texture=openWorld.MapTexture;
        mapObject.GetComponent<ExpeditionMapInput>().OnMapClick=uv=>
        {
            var p=new Vector2(OpenWorldBuilder.MinX+uv.x*OpenWorldBuilder.Size,OpenWorldBuilder.MinZ+uv.y*OpenWorldBuilder.Size);
            if(p.x< -360||p.x>360||p.y< -135||p.y>580||OpenWorldBuilder.Height(p.x,p.y)<OpenWorldBuilder.WaterY+.2f){SetNotice("请选择陆地区域作为目的地");return;}
            expeditionWaypoint=p;SetNotice("已设定地图路标");UpdateExpeditionNavigation();
        };
        mapLandmarkLabels=new Text[OpenWorldBuilder.Landmarks.Length];
        for(int i=0;i<mapLandmarkLabels.Length;i++)
        {
            var uv=WorldMapUv(OpenWorldBuilder.Landmarks[i]);var label=HudLabel(mapObject.transform,"Landmark "+i,"",13,uv,uv,TextAnchor.MiddleCenter);label.rectTransform.sizeDelta=new Vector2(126,42);label.gameObject.AddComponent<Shadow>().effectDistance=new Vector2(1,-1);mapLandmarkLabels[i]=label;
        }
        var playerLabel=HudLabel(mapObject.transform,"Player on map","▲",23,Vector2.zero,Vector2.zero,TextAnchor.MiddleCenter);playerLabel.color=Color.white;mapPlayerIcon=playerLabel.rectTransform;mapPlayerIcon.sizeDelta=new Vector2(25,25);
        var marker=HudLabel(mapObject.transform,"Waypoint on map","◆",25,Vector2.zero,Vector2.zero,TextAnchor.MiddleCenter);marker.color=new Color(1,.76f,.3f);mapWaypointIcon=marker.rectTransform;mapWaypointIcon.sizeDelta=new Vector2(28,28);
        mapLegendText=HudLabel(expeditionMapPanel.transform,"Map legend","",17,new Vector2(.66f,.38f),new Vector2(.96f,.86f));
        HudLabel(expeditionMapPanel.transform,"Map instructions","▲ 小智的位置    ◆ 目的地\n\n点击地图设置路标。\n在世界中沿道路和距离提示前进。\n湖水不可通行，请寻找桥梁。",14,new Vector2(.66f,.16f),new Vector2(.955f,.38f));
        var close=CreateButton(expeditionMapPanel.transform,"M / Esc  返回旅程",new Vector2(.67f,.06f),new Vector2(.95f,.13f),expeditionFont);close.onClick.AddListener(()=>expeditionMapPanel.SetActive(false));
        HudLabel(expeditionMapPanel.transform,"Map scale","N ↑     768 m × 768 m    /    连续区域 · 非官方同人原型",11,new Vector2(.04f,.016f),new Vector2(.96f,.046f));
        expeditionMapPanel.SetActive(false);
    }
    private static Vector2 WorldMapUv(Vector2 p){return new Vector2((p.x-OpenWorldBuilder.MinX)/OpenWorldBuilder.Size,(p.y-OpenWorldBuilder.MinZ)/OpenWorldBuilder.Size);}
    private void ToggleExpeditionMap()
    {
        expeditionMapPanel.SetActive(!expeditionMapPanel.activeSelf);mouseLookCaptured=false;Cursor.lockState=CursorLockMode.None;Cursor.visible=true;UpdateExpeditionNavigation();
    }
    private void UpdateExpeditionNavigation()
    {
        var position=player.transform.position;var p=new Vector2(position.x,position.z);
        int direction=Mathf.RoundToInt(Mathf.Repeat(cameraYaw,360)/45)%8;var directions=new[]{"北  N","东北  NE","东  E","东南  SE","南  S","西南  SW","西  W","西北  NW"};
        compassText.text="—     "+directions[direction]+"     ·     "+Mathf.RoundToInt(Mathf.Repeat(cameraYaw,360))+"°     —";
        worldWaypointIcon.gameObject.SetActive(expeditionWaypoint.HasValue && currentBattle==null && !expeditionMapPanel.activeSelf);
        if(expeditionWaypoint.HasValue)
        {
            var point=OpenWorldBuilder.Surface(expeditionWaypoint.Value,4);var screen=mainCamera.WorldToViewportPoint(point);
            if(screen.z<0){screen.x=screen.x<.5f?.93f:.07f;screen.y=.60f;}
            var uv=new Vector2(Mathf.Clamp(screen.x,.10f,.90f),Mathf.Clamp(screen.y,.27f,.76f));worldWaypointIcon.anchorMin=worldWaypointIcon.anchorMax=uv;worldWaypointIcon.anchoredPosition=Vector2.zero;
            waypointText.text="◆\n"+Mathf.RoundToInt(Vector2.Distance(p,expeditionWaypoint.Value))+" m";waypointText.fontSize=17;
        }
        if(expeditionMapPanel.activeSelf)
        {
            mapPlayerIcon.anchorMin=mapPlayerIcon.anchorMax=WorldMapUv(p);mapPlayerIcon.anchoredPosition=Vector2.zero;mapPlayerIcon.localRotation=Quaternion.Euler(0,0,-player.transform.eulerAngles.y);
            mapWaypointIcon.gameObject.SetActive(expeditionWaypoint.HasValue);
            if(expeditionWaypoint.HasValue){mapWaypointIcon.anchorMin=mapWaypointIcon.anchorMax=WorldMapUv(expeditionWaypoint.Value);mapWaypointIcon.anchoredPosition=Vector2.zero;}
            string legend="调查地点\n\n";
            for(int i=0;i<mapLandmarkLabels.Length;i++)
            {
                bool seen=(discoveredRegions&(1<<i))!=0;mapLandmarkLabels[i].text=(seen?"● ":"◇ ")+OpenWorldBuilder.Names[i];mapLandmarkLabels[i].color=seen?Parchment:new Color(.99f,.80f,.39f);
                legend+=(seen?"✓  ":"○  ")+OpenWorldBuilder.Names[i]+"\n";
            }
            mapLegendText.text=legend+"\n已记录宝可梦："+caughtIds.Count;
        }
    }
    private void UpdateExpeditionHud()
    {
        hudRefreshAt=Time.unscaledTime+.15f;if(mapText==null || player==null)return;
        int region=OpenWorldBuilder.Region(player.transform.position);mapText.text=OpenWorldBuilder.Names[region];introText.text=OpenWorldBuilder.EnglishNames[region];
        int count=0;for(int i=0;i<6;i++)if((discoveredRegions&(1<<i))!=0)count++;
        string target="自由探索";for(int i=1;i<6;i++)if((discoveredRegions&(1<<i))==0){target="前往"+OpenWorldBuilder.Names[i];break;}
        expeditionQuestText.text=target+"\n地点发现  "+count+" / 6\n图鉴记录  "+caughtIds.Count+"   ·   胜场  "+battleWins;
        progressText.text="小智   /   小火龙  Lv."+playerLevel+"\n经验  "+playerExperience+" / "+ExperienceToNext+"    ·    F5 存档";
        interactionText.text="";
        if(nearestFieldObject!=null && currentBattle==null && !expeditionMapPanel.activeSelf)
        {
            var w=nearestFieldObject.GetComponent<WorldInteractable>();
            interactionText.text=!string.IsNullOrEmpty(w.CreatureId)?"[ E ]  观察并遭遇 "+CreatureCatalog.Find(w.CreatureId).Name:"[ E ]  与"+FindNpc(w.NpcId).Name+"交谈";
        }
        infoPanel.SetActive(selectedInteractable!=null && selectedNpcDialog!=null && currentBattle==null && !expeditionMapPanel.activeSelf);
        if(infoPanel.activeSelf)
        {
            var npc=FindNpc(selectedInteractable.NpcId);infoText.text=npc.Name+" · "+npc.Role+"\n\n"+(npc.Id=="orin"?"去探索常青森林、澄蓝湖畔和风见山脊吧。用 M 查看地图，遇到野生宝可梦时按 E 互动；随时用 F5 保存调查记录。":selectedNpcDialog);
            SetButton(infoButton,"关闭对话",()=>{selectedInteractable=null;selectedNpcDialog=null;});
        }
        if(Time.unscaledTime>expeditionNoticeUntil)noticeText.text="";
    }
}

public sealed class ExpeditionMapInput : MonoBehaviour,IPointerClickHandler
{
    public Action<Vector2> OnMapClick;
    public void OnPointerClick(PointerEventData eventData)
    {
        var rect=(RectTransform)transform;
        if(RectTransformUtility.ScreenPointToLocalPointInRectangle(rect,eventData.position,eventData.pressEventCamera,out var p))
            OnMapClick?.Invoke(new Vector2((p.x-rect.rect.xMin)/rect.rect.width,(p.y-rect.rect.yMin)/rect.rect.height));
    }
}
