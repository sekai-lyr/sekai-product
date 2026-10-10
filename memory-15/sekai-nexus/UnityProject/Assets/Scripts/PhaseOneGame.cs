using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

public enum WorldMap
{
    Town,
    Trail,
    Grove
}

public enum BattleResult
{
    None,
    Captured,
    Defeated,
    Lost,
    Escaped
}

public sealed partial class PhaseOneGame : MonoBehaviour
{
    private const string SaveKey = "sekai-wilds-phase-one-save";

    [Serializable]
    private sealed class SaveData
    {
        public int Map;
        public float PlayerX;
        public float PlayerZ;
        public int Level = 1;
        public int Experience;
        public int BattleWins;
        public string Caught;
        public string Defeated;
    }

    private sealed class TransitionPoint
    {
        public Vector3 Position;
        public Vector3 Entry;
        public WorldMap Target;
        public string Label;
    }

    private sealed class SkyStepRuntime
    {
        public Transform Transform;
        public Vector3 StartPosition;
        public Vector3 TargetPosition;
        public float Delay;
    }

    private sealed class SkyMotionRuntime
    {
        public Transform Transform;
        public Vector3 StartPosition;
        public float Phase;
    }

    private sealed class BattleRuntime
    {
        public CreatureDefinition Enemy;
        public bool IsTrainer;
        public int EnemyHp;
        public int PlayerHp;
        public int PlayerMaxHp;
        public int CaptureAttempts;
        public string Message;
        public BattleResult Result;
        public bool Busy;
    }

    private WorldMap currentMap = WorldMap.Town;
    private Transform mapRoot;
    private GameObject player;
    private CharacterController playerController;
    private Camera mainCamera;
    private float cameraYaw;
    private float cameraPitch = 18f;
    private bool townOverview;
    private bool thirdPerson = true;
    private float thirdPersonDistance = 5.2f;
    private float resolvedCameraDistance = 5.2f;
    private AshAvatar ashAvatar;
    private bool townWideView = true;
    private bool capturingTown;
    private Text controlsText;
    private Text crosshairText;
    private const float FirstPersonEyeHeight = 1.65f;
    private const float PlayerGravity = -22f;
    private const float PlayerJumpHeight = 1.25f;
    private float verticalVelocity;
    private bool mouseLookCaptured;
    private ParticleSystem skyMotes;
    private ParticleSystem skyGateMist;
    private Transform skyBeaconCore;
    private Transform skyBeaconHalo;
    private Transform skyGateCrown;
    private float skyStepSequenceStartedAt;
    private float hudRefreshAt;
    private bool transitionBusy;
    private bool saveAvailable;
    private Vector3 savePointPosition;
    private GameObject savePointObject;
    private GameObject selectedNpcObject;
    private readonly List<TransitionPoint> transitionPoints = new List<TransitionPoint>();
    private readonly Dictionary<string, GameObject> worldCreatures = new Dictionary<string, GameObject>();
    private readonly Dictionary<string, GameObject> worldNpcs = new Dictionary<string, GameObject>();
    private readonly Dictionary<Vector3Int, GameObject> voxelBlocks = new Dictionary<Vector3Int, GameObject>();
    private readonly Dictionary<string, Material> voxelMaterials = new Dictionary<string, Material>();
    private readonly HashSet<string> caughtIds = new HashSet<string>();
    private readonly HashSet<string> defeatedIds = new HashSet<string>();
    private readonly List<SkyStepRuntime> skySteps = new List<SkyStepRuntime>();
    private readonly List<SkyMotionRuntime> skyCrystals = new List<SkyMotionRuntime>();
    private readonly List<SkyMotionRuntime> skyClouds = new List<SkyMotionRuntime>();
    private BattleRuntime currentBattle;
    private WorldInteractable selectedInteractable;
    private string selectedNpcDialog;
    private string selectedBlockType = "grass";

    private int playerLevel = 1;
    private int playerExperience;
    private int battleWins;
    private Vector3 savedPlayerPosition = new Vector3(0f, 0f, 8f);

    private Canvas hudCanvas;
    private CanvasGroup fadeGroup;
    private Text mapText;
    private Text progressText;
    private Text introText;
    private Text infoText;
    private Text saveText;
    private Text noticeText;
    private Button infoButton;
    private Button saveButton;
    private GameObject infoPanel;
    private GameObject savePanel;
    private GameObject battlePanel;
    private Text battleTitleText;
    private Text battleEnemyText;
    private Text battlePartnerText;
    private Text battleMessageText;
    private Button attackButton;
    private Button captureButton;
    private Button runButton;
    private Button returnButton;
    private GameObject battleActions;
    private GameObject battleResultActions;

    private bool IsChinese { get { return language == "中文"; } }
    private string language = "中文";
    private CreatureDefinition ActiveCreature { get { return CreatureCatalog.Charmander; } }
    private int ExperienceToNext { get { return playerLevel * 30; } }

    private void Start()
    {
        Application.targetFrameRate = 60;
        Cursor.lockState = CursorLockMode.None;
        Cursor.visible = true;
        var startupArgs = Environment.GetCommandLineArgs();
        openWorldEnabled = Array.IndexOf(startupArgs, "-legacyWorld") < 0 && Array.IndexOf(startupArgs, "-palletCapture") < 0 && Array.IndexOf(startupArgs, "-ashCapture") < 0;
        if (openWorldEnabled) LoadExpeditionProgress();
        else LoadProgress();
        if (Array.IndexOf(Environment.GetCommandLineArgs(), "-palletCapture") >= 0 || Array.IndexOf(Environment.GetCommandLineArgs(), "-ashCapture") >= 0) currentMap = WorldMap.Town;
        SetupSceneLighting();
        SetupCamera();
        SetupEventSystem();
        SetupHud();
        CreatePlayer();
        BuildMap();
        if (openWorldEnabled) SetupOpenWorldEnvironment();
        UpdateHud(true);
        UpdateCameraFollow();
        var args = Environment.GetCommandLineArgs();
        var captureIndex = Array.IndexOf(args, "-palletCapture");
        if (captureIndex >= 0 && captureIndex + 1 < args.Length) StartCoroutine(CaptureTownReview(args[captureIndex + 1]));
        captureIndex = Array.IndexOf(args, "-ashCapture");
        if (captureIndex >= 0 && captureIndex + 1 < args.Length) StartCoroutine(CaptureAshReview(args[captureIndex + 1]));
        captureIndex = Array.IndexOf(args, "-worldCapture");
        if (captureIndex >= 0 && captureIndex + 1 < args.Length) StartCoroutine(CaptureWorldReview(args[captureIndex + 1]));
    }

    private void Update()
    {
        if (mainCamera == null || player == null) return;
        if (capturingTown) return;
        if (Input.GetKeyDown(KeyCode.F1)) hudCanvas.enabled = !hudCanvas.enabled;
        if (openWorldEnabled) { UpdateExpeditionFrame(); return; }
        if (currentBattle == null && !transitionBusy)
        {
            UpdateCameraInput();
            HandleBlockSelection();
            UpdatePlayerMovement();
            CheckNearbyWorldObjects();
            HandleWorldClick();
        }
        AnimateWorld();
        if (ashAvatar != null)
        {
            var horizontalVelocity = playerController.velocity; horizontalVelocity.y = 0;
            ashAvatar.Animate(currentBattle == null && !transitionBusy ? horizontalVelocity.magnitude : 0, playerController.isGrounded || currentBattle != null, verticalVelocity, Time.deltaTime);
        }
        UpdateCameraFollow();
        if (Time.unscaledTime >= hudRefreshAt) UpdateHud(false);
    }

    private void SetupSceneLighting()
    {
        RenderSettings.fog = true;
        RenderSettings.fogMode = FogMode.ExponentialSquared;
        RenderSettings.fogColor = new Color(.72f, .86f, .88f);
        RenderSettings.fogDensity = 0.0018f;
        RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
        RenderSettings.ambientLight = new Color(.43f, .47f, .49f);
        QualitySettings.shadows = ShadowQuality.All;
        QualitySettings.shadowResolution = ShadowResolution.High;
        QualitySettings.shadowDistance = 130f;
        QualitySettings.antiAliasing = 4;

        var sunObject = new GameObject("Sunlight");
        var sun = sunObject.AddComponent<Light>();
        sun.type = LightType.Directional;
        sun.color = new Color(1f, .96f, .85f);
        sun.intensity = .72f;
        sun.shadows = LightShadows.Soft;
        sun.shadowStrength = .6f;
        sun.shadowBias = .035f;
        sun.transform.rotation = Quaternion.Euler(48f, -35f, 0f);

        var skyObject = new GameObject("SkyFill");
        var sky = skyObject.AddComponent<Light>();
        sky.type = LightType.Directional;
        sky.color = new Color(.72f, .85f, 1f);
        sky.intensity = .12f;
        sky.transform.rotation = Quaternion.Euler(48f, 146f, 0f);
    }

    private void SetupCamera()
    {
        mainCamera = Camera.main;
        if (mainCamera == null)
        {
            var cameraObject = new GameObject("Main Camera");
            mainCamera = cameraObject.AddComponent<Camera>();
            cameraObject.tag = "MainCamera";
        }
        mainCamera.fieldOfView = 72f;
        mainCamera.nearClipPlane = .1f;
        mainCamera.farClipPlane = 180f;
        mainCamera.clearFlags = CameraClearFlags.SolidColor;
        mainCamera.backgroundColor = new Color(.72f, .86f, .88f);
        mainCamera.transform.position = new Vector3(0f, FirstPersonEyeHeight, 8f);
    }

    private void SetupEventSystem()
    {
        if (EventSystem.current != null) return;
        var eventSystemObject = new GameObject("EventSystem", typeof(EventSystem), typeof(StandaloneInputModule));
        DontDestroyOnLoad(eventSystemObject);
    }

    private void SetupHud()
    {
        if (openWorldEnabled) { SetupExpeditionHud(); return; }
        var canvasObject = new GameObject("Phase One HUD", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
        hudCanvas = canvasObject.GetComponent<Canvas>();
        hudCanvas.renderMode = RenderMode.ScreenSpaceOverlay;
        var scaler = canvasObject.GetComponent<CanvasScaler>();
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(1440f, 900f);
        scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.Expand;

        var font = Font.CreateDynamicFontFromOSFont(new[] { "Microsoft YaHei", "Arial" }, 24);
        var titleCard = CreatePanel(canvasObject.transform, new Vector2(.022f,.856f), new Vector2(.252f,.972f), new Color(.98f,.97f,.89f,.95f));
        titleCard.GetComponent<Image>().raycastTarget = false;
        mapText = CreateText(canvasObject.transform, "Map", 29, TextAnchor.UpperLeft, new Vector2(.036f,.9f), new Vector2(.245f,.961f), font);
        mapText.color = new Color(.19f,.34f,.29f);
        var partnerCard = CreatePanel(canvasObject.transform, new Vector2(.77f,.866f), new Vector2(.983f,.972f), new Color(.98f,.97f,.89f,.92f));
        partnerCard.GetComponent<Image>().raycastTarget = false;
        progressText = CreateText(canvasObject.transform, "Progress", 15, TextAnchor.UpperRight, new Vector2(.73f,.87f), new Vector2(.97f,.96f), font);
        progressText.color = new Color(.17f,.29f,.26f);
        introText = CreateText(canvasObject.transform, "Intro", 13, TextAnchor.UpperLeft, new Vector2(.037f,.854f), new Vector2(.245f,.9f), font);
        introText.color = new Color(.37f,.45f,.35f);
        noticeText = CreateText(canvasObject.transform, "Notice", 16, TextAnchor.MiddleCenter, new Vector2(.34f, .82f), new Vector2(.66f, .88f), font);
        noticeText.color = new Color(1f, .88f, .57f);

        infoPanel = CreatePanel(canvasObject.transform, new Vector2(.68f, .06f), new Vector2(.96f, .34f), new Color(.13f, .08f, .25f, .78f));
        infoText = CreateText(infoPanel.transform, "Info", 16, TextAnchor.UpperLeft, new Vector2(.08f, .28f), new Vector2(.92f, .9f), font);
        infoButton = CreateButton(infoPanel.transform, "Action", new Vector2(.08f, .06f), new Vector2(.58f, .24f), font);

        savePanel = CreatePanel(canvasObject.transform, new Vector2(.35f, .05f), new Vector2(.65f, .14f), new Color(.2f, .1f, .28f, .84f));
        saveText = CreateText(savePanel.transform, "Save", 13, TextAnchor.MiddleLeft, new Vector2(.06f, .22f), new Vector2(.62f, .82f), font);
        saveButton = CreateButton(savePanel.transform, "Save", new Vector2(.66f, .18f), new Vector2(.94f, .82f), font);

        var controlsCard = CreatePanel(canvasObject.transform, new Vector2(.017f,.016f), new Vector2(.983f,.077f), new Color(.13f,.22f,.2f,.87f));
        controlsCard.GetComponent<Image>().raycastTarget = false;
        var controls = CreateText(canvasObject.transform, "Controls", 13, TextAnchor.LowerLeft, new Vector2(.04f, .04f), new Vector2(.42f, .15f), font);
        controlsText = controls;
        controls.GetComponent<RectTransform>().anchorMin = new Vector2(.027f,.027f);
        controls.GetComponent<RectTransform>().anchorMax = new Vector2(.97f,.065f);
        controls.color = new Color(1f, .97f, .86f, .8f);
        controls.text = IsChinese ? "WASD / 方向键移动 · 空格跳跃 · 点击场景后移动鼠标转向 · Esc 释放鼠标\n中键拖动也可环视 · 滚轮调整视野 · 左键挖掘 · 右键放置 · 1/2/3 选择方块" : "WASD / arrows move · Space jump · click the world, then move the mouse to look · Esc releases the cursor\nMiddle drag also looks · wheel adjusts FOV · left break · right place · 1/2/3 choose block";

        var crosshair = CreateText(canvasObject.transform, "Crosshair", 22, TextAnchor.MiddleCenter, new Vector2(.485f, .485f), new Vector2(.515f, .515f), font);
        crosshairText = crosshair;
        crosshair.text = "+";
        crosshair.color = new Color(1f, .97f, .86f, .72f);

        var fadeObject = CreatePanel(canvasObject.transform, new Vector2(0f, 0f), new Vector2(1f, 1f), Color.black);
        fadeObject.GetComponent<Image>().raycastTarget = false;
        fadeGroup = fadeObject.AddComponent<CanvasGroup>();
        fadeGroup.alpha = 0f;
        fadeObject.transform.SetAsLastSibling();

        SetupBattleHud(canvasObject.transform, font);
    }

    private void SetupBattleHud(Transform parent, Font font)
    {
        battlePanel = CreatePanel(parent, new Vector2(0f, 0f), new Vector2(1f, 1f), new Color(.04f, .11f, .15f, .92f));
        battlePanel.name = "Trainer Battle Overlay";
        battleTitleText = CreateText(battlePanel.transform, "Battle title", 29, TextAnchor.UpperCenter, new Vector2(.2f, .83f), new Vector2(.8f, .94f), font);
        battleEnemyText = CreateText(battlePanel.transform, "Enemy", 21, TextAnchor.UpperLeft, new Vector2(.12f, .59f), new Vector2(.54f, .76f), font);
        battlePartnerText = CreateText(battlePanel.transform, "Partner", 21, TextAnchor.UpperRight, new Vector2(.46f, .36f), new Vector2(.88f, .53f), font);
        battleMessageText = CreateText(battlePanel.transform, "Message", 17, TextAnchor.MiddleLeft, new Vector2(.13f, .16f), new Vector2(.87f, .3f), font);
        battleActions = new GameObject("Battle actions");
        battleActions.transform.SetParent(battlePanel.transform, false);
        attackButton = CreateButton(battleActions.transform, "Attack", new Vector2(.12f, .04f), new Vector2(.34f, .13f), font);
        captureButton = CreateButton(battleActions.transform, "Capture", new Vector2(.39f, .04f), new Vector2(.61f, .13f), font);
        runButton = CreateButton(battleActions.transform, "Run", new Vector2(.66f, .04f), new Vector2(.88f, .13f), font);
        battleResultActions = new GameObject("Battle result actions");
        battleResultActions.transform.SetParent(battlePanel.transform, false);
        returnButton = CreateButton(battleResultActions.transform, "Return", new Vector2(.38f, .04f), new Vector2(.62f, .13f), font);
        battlePanel.SetActive(false);
    }

    private Text CreateText(Transform parent, string objectName, int fontSize, TextAnchor alignment, Vector2 anchorMin, Vector2 anchorMax, Font font)
    {
        var textObject = new GameObject(objectName, typeof(Text));
        textObject.transform.SetParent(parent, false);
        var text = textObject.GetComponent<Text>();
        text.font = font;
        text.fontSize = fontSize;
        text.alignment = alignment;
        text.color = new Color(1f, .97f, .88f);
        text.raycastTarget = false;
        text.horizontalOverflow = HorizontalWrapMode.Wrap;
        text.verticalOverflow = VerticalWrapMode.Overflow;
        text.resizeTextForBestFit = true;
        text.resizeTextMinSize = 10;
        text.resizeTextMaxSize = fontSize;
        var rect = textObject.GetComponent<RectTransform>();
        rect.anchorMin = anchorMin;
        rect.anchorMax = anchorMax;
        rect.offsetMin = Vector2.zero;
        rect.offsetMax = Vector2.zero;
        return text;
    }

    private GameObject CreatePanel(Transform parent, Vector2 anchorMin, Vector2 anchorMax, Color color)
    {
        var panel = new GameObject("Panel", typeof(Image));
        panel.transform.SetParent(parent, false);
        var image = panel.GetComponent<Image>();
        image.color = color;
        var rect = panel.GetComponent<RectTransform>();
        rect.anchorMin = anchorMin;
        rect.anchorMax = anchorMax;
        rect.offsetMin = Vector2.zero;
        rect.offsetMax = Vector2.zero;
        return panel;
    }

    private Button CreateButton(Transform parent, string label, Vector2 anchorMin, Vector2 anchorMax, Font font)
    {
        var buttonObject = new GameObject(label + " Button", typeof(Image), typeof(Button));
        buttonObject.transform.SetParent(parent, false);
        buttonObject.GetComponent<Image>().color = new Color(.88f, .7f, .36f, .96f);
        var rect = buttonObject.GetComponent<RectTransform>();
        rect.anchorMin = anchorMin;
        rect.anchorMax = anchorMax;
        rect.offsetMin = Vector2.zero;
        rect.offsetMax = Vector2.zero;
        var text = CreateText(buttonObject.transform, "Label", 14, TextAnchor.MiddleCenter, new Vector2(.04f, .04f), new Vector2(.96f, .96f), font);
        text.color = new Color(.12f, .22f, .25f);
        text.text = label;
        return buttonObject.GetComponent<Button>();
    }

    private void SetButton(Button button, string label, UnityEngine.Events.UnityAction action, bool active = true)
    {
        button.gameObject.SetActive(active);
        button.onClick.RemoveAllListeners();
        button.onClick.AddListener(action);
        var text = button.GetComponentInChildren<Text>();
        if (text != null) text.text = label;
    }

    private void CreatePlayer()
    {
        player = new GameObject("Player - Ash Ketchum");
        player.transform.position = currentMap == WorldMap.Town ? new Vector3(0f, .12f, -1.5f) : savedPlayerPosition;
        playerController = player.AddComponent<CharacterController>();
        playerController.height = 1.82f;
        playerController.radius = .26f;
        playerController.center = new Vector3(0f, .91f, 0f);
        playerController.slopeLimit = 55f;
        playerController.stepOffset = .28f;
        playerController.skinWidth = .025f;
        playerController.minMoveDistance = 0f;
        ashAvatar = AshAvatar.Create(player.transform);
    }

    private void BuildMap()
    {
        if (openWorldEnabled) { BuildOpenWorldMap(); return; }
        if (mapRoot != null) Destroy(mapRoot.gameObject);
        mapRoot = new GameObject(MapName(currentMap) + " Map").transform;
        transitionPoints.Clear();
        worldCreatures.Clear();
        worldNpcs.Clear();
        voxelBlocks.Clear();
        skySteps.Clear();
        skyCrystals.Clear();
        skyClouds.Clear();
        skyMotes = null;
        skyGateMist = null;
        skyBeaconCore = null;
        skyBeaconHalo = null;
        skyGateCrown = null;
        selectedInteractable = null;
        selectedNpcDialog = null;
        savePointObject = null;
        saveAvailable = false;

        BuildVoxelTerrain();
        if (currentMap == WorldMap.Town) BuildVoxelTown();
        if (currentMap == WorldMap.Trail) BuildVoxelTrail();
        if (currentMap == WorldMap.Grove) BuildVoxelGrove();

        for (var index = 0; index < CreatureCatalog.All.Length; index++)
        {
            var creature = CreatureCatalog.All[index];
            if (creature.IsWild && creature.SpawnMap == currentMap) CreateCreature(creature);
        }
        if (currentMap == WorldMap.Town) transitionPoints.Add(new TransitionPoint { Position = new Vector3(0f, 0f, 23.5f), Entry = new Vector3(0f, 0f, 9f), Target = WorldMap.Trail, Label = "沿1号道路离开真新镇" });
        if (currentMap == WorldMap.Trail)
        {
            AddTransition(new Vector3(0f, 0f, 13f), new Vector3(0f, .1f, 18f), WorldMap.Town, "返回真新镇");
            AddTransition(new Vector3(11f, 0f, -23f), new Vector3(-10f, 0f, 9f), WorldMap.Grove, "进入苔光林地");
        }
        if (currentMap == WorldMap.Grove) AddTransition(new Vector3(-10f, 0f, 10f), new Vector3(10f, 0f, -20f), WorldMap.Trail, "回到风铃野路");
        UpdateTownCameraMode();
    }

    private void BuildVoxelTerrain()
    {
        if (currentMap == WorldMap.Town)
        {
            return;
        }

        var pathType = "grass";
        for (var z = -30; z <= 15; z++)
        {
            for (var x = -16; x <= 15; x++)
            {
                var type = Mathf.Abs(x) <= 2 || currentMap == WorldMap.Grove && Mathf.Abs(x) <= 1 ? pathType : "grass";
                CreateVoxelBlock(new Vector3Int(x, 0, z), type, true);
                CreateVoxelBlock(new Vector3Int(x, -1, z), "dirt", false);
                if (Mathf.Abs(x) == 16 || Mathf.Abs(z) == 30) CreateVoxelBlock(new Vector3Int(x, -2, z), "stone", false);
            }
        }

        for (var x = -18; x <= 17; x++)
        {
            CreateVoxelBlock(new Vector3Int(x, -1, -32), "water", false);
            CreateVoxelBlock(new Vector3Int(x, -1, 17), "water", false);
        }
        for (var z = -31; z <= 16; z++)
        {
            CreateVoxelBlock(new Vector3Int(-18, -1, z), "water", false);
            CreateVoxelBlock(new Vector3Int(17, -1, z), "water", false);
        }
    }

    private void BuildSkyStartPlatform()
    {
        var platform = new GameObject("Circular sky altar");
        platform.transform.SetParent(mapRoot, false);
        platform.transform.position = new Vector3(0f, 0f, 8f);
        CreateBeveledDisc("Altar underside", platform.transform, new Vector3(0f, -.72f, 0f), 3.1f, .58f, GetVoxelMaterial("skyShadow"), true);
        CreateBeveledDisc("Altar foundation", platform.transform, new Vector3(0f, -.36f, 0f), 3.6f, .72f, GetVoxelMaterial("skyStone"), true);
        CreateBeveledDisc("Altar top", platform.transform, new Vector3(0f, -.035f, 0f), 3.32f, .08f, GetVoxelMaterial("skyStone"), true);

        var gold = GetVoxelMaterial("skyGold");
        CreateFlatRing("Altar gold inlay", platform.transform, new Vector3(0f, .027f, 0f), 3.18f, 3.03f, gold, false);
    }

    private void BuildVoxelTown()
    {
        new PalletTownBuilder(mapRoot).Build();
        savePointPosition = new Vector3(6f, 0f, -10.8f);
        savePointObject = new GameObject("研究所存档点");
        savePointObject.transform.SetParent(mapRoot, false);
        savePointObject.transform.position = savePointPosition;
        PalletTownBuilder.Pokeball(savePointObject.transform, new Vector3(0,.75f,0), .3f);
        for (var i=0; i<Npcs.Length; i++) if(Npcs[i].Map == WorldMap.Town) CreateNpc(Npcs[i]);
    }

    private void BuildTrueNewTownTerrain()
    {
        for (var z = -23; z <= 14; z++)
        {
            for (var x = -16; x <= 15; x++)
            {
                var isMainRoad = Mathf.Abs(x) <= 2 || Mathf.Abs(z - 2) <= 2;
                var type = isMainRoad ? "path" : "grass";
                CreateVoxelBlock(new Vector3Int(x, 0, z), type, true);
                CreateVoxelBlock(new Vector3Int(x, -1, z), "dirt", false);
            }
        }
    }

    private void BuildTrueNewTown()
    {
        CreateTownHouse(new Vector3(-8f, 0f, 7.2f), "玩家的家", new Color(.9f, .78f, .58f), new Color(.34f, .48f, .78f), "玩家的家");
        CreateTownHouse(new Vector3(8f, 0f, 7.2f), "劲敌的家", new Color(.82f, .72f, .62f), new Color(.55f, .3f, .42f), "劲敌的家");
        CreateProfessorLab(new Vector3(0f, 0f, -6f));
        CreateTownPlaza();
        CreateSignBoard(mapRoot, new Vector3(0f, 0f, -20.6f), "真新镇", new Color(.2f, .4f, .62f));

        var treeSpots = new[]
        {
            new Vector3(-13f, 0f, 11f), new Vector3(13f, 0f, 11f),
            new Vector3(-13f, 0f, 4f), new Vector3(13f, 0f, 4f),
            new Vector3(-12f, 0f, -8f), new Vector3(12f, 0f, -8f),
            new Vector3(-13f, 0f, -17f), new Vector3(13f, 0f, -17f)
        };
        for (var index = 0; index < treeSpots.Length; index++) AddTree(treeSpots[index], .78f + (index % 3) * .08f);

        CreateTownFence(new Vector3(-14f, 0f, 12.5f), new Vector3(-10.5f, 0f, 12.5f), 2);
        CreateTownFence(new Vector3(10.5f, 0f, 12.5f), new Vector3(14f, 0f, 12.5f), 2);
        CreateTownFence(new Vector3(-14f, 0f, -12.5f), new Vector3(-8f, 0f, -12.5f), 3);
        CreateTownFence(new Vector3(8f, 0f, -12.5f), new Vector3(14f, 0f, -12.5f), 3);

        CreateSavePoint();
        CreateCreature(CreatureCatalog.Charmander, new Vector2(5.3f, 3.7f));
        for (var index = 0; index < Npcs.Length; index++)
        {
            if (Npcs[index].Map == WorldMap.Town) CreateNpc(Npcs[index]);
        }
    }

    private void CreateTownPlaza()
    {
        CreatePrimitive(PrimitiveType.Cylinder, "真新镇中央广场", mapRoot, new Vector3(0f, .055f, 2f), new Vector3(7.8f, .11f, 5.8f), GetVoxelMaterial("path"));
        CreatePrimitive(PrimitiveType.Cylinder, "广场中心花坛", mapRoot, new Vector3(0f, .18f, 2f), new Vector3(2.2f, .25f, 2.2f), MakeMaterial(new Color(.3f, .62f, .36f)));
        CreatePrimitive(PrimitiveType.Cylinder, "花坛中心", mapRoot, new Vector3(0f, .48f, 2f), new Vector3(.7f, .42f, .7f), MakeMaterial(new Color(.95f, .55f, .28f), true));
    }

    private void CreateTownHouse(Vector3 position, string objectName, Color wallColor, Color roofColor, string signText)
    {
        var house = new GameObject(objectName);
        house.transform.SetParent(mapRoot, false);
        house.transform.position = position;
        var wall = MakeMaterial(wallColor);
        var roof = MakeMaterial(roofColor);
        var wood = MakeMaterial(new Color(.43f, .25f, .16f));
        var window = MakeMaterial(new Color(.27f, .67f, .82f), true);

        CreatePrimitive(PrimitiveType.Cube, "墙体", house.transform, new Vector3(0f, 1.45f, 0f), new Vector3(4.8f, 2.9f, 4.1f), wall);
        var roofLeft = CreatePrimitive(PrimitiveType.Cube, "左侧屋顶", house.transform, new Vector3(-1.18f, 3.35f, 0f), new Vector3(2.9f, .34f, 4.7f), roof);
        roofLeft.transform.localRotation = Quaternion.Euler(0f, 0f, -24f);
        var roofRight = CreatePrimitive(PrimitiveType.Cube, "右侧屋顶", house.transform, new Vector3(1.18f, 3.35f, 0f), new Vector3(2.9f, .34f, 4.7f), roof);
        roofRight.transform.localRotation = Quaternion.Euler(0f, 0f, 24f);
        CreatePrimitive(PrimitiveType.Cube, "门", house.transform, new Vector3(0f, .78f, -2.08f), new Vector3(.82f, 1.56f, .1f), wood);
        CreatePrimitive(PrimitiveType.Cube, "左窗", house.transform, new Vector3(-1.35f, 1.65f, -2.08f), new Vector3(.86f, .72f, .08f), window);
        CreatePrimitive(PrimitiveType.Cube, "右窗", house.transform, new Vector3(1.35f, 1.65f, -2.08f), new Vector3(.86f, .72f, .08f), window);
        CreatePrimitive(PrimitiveType.Cube, "烟囱", house.transform, new Vector3(1.3f, 3.9f, .6f), new Vector3(.48f, .8f, .48f), wood);
        CreateSignBoard(house.transform, new Vector3(0f, 2.65f, -2.14f), signText, roofColor);
    }

    private void CreateProfessorLab(Vector3 position)
    {
        var lab = new GameObject("大木博士研究所");
        lab.transform.SetParent(mapRoot, false);
        lab.transform.position = position;
        var wall = MakeMaterial(new Color(.82f, .84f, .8f));
        var roof = MakeMaterial(new Color(.72f, .2f, .22f));
        var trim = MakeMaterial(new Color(.28f, .34f, .42f));
        var glass = MakeMaterial(new Color(.25f, .7f, .86f), true);

        CreatePrimitive(PrimitiveType.Cube, "研究所墙体", lab.transform, new Vector3(0f, 1.8f, 0f), new Vector3(7.4f, 3.6f, 5.4f), wall);
        var roofLeft = CreatePrimitive(PrimitiveType.Cube, "研究所左屋顶", lab.transform, new Vector3(-1.9f, 4.05f, 0f), new Vector3(4.35f, .42f, 6.1f), roof);
        roofLeft.transform.localRotation = Quaternion.Euler(0f, 0f, -22f);
        var roofRight = CreatePrimitive(PrimitiveType.Cube, "研究所右屋顶", lab.transform, new Vector3(1.9f, 4.05f, 0f), new Vector3(4.35f, .42f, 6.1f), roof);
        roofRight.transform.localRotation = Quaternion.Euler(0f, 0f, 22f);
        CreatePrimitive(PrimitiveType.Cube, "研究所入口", lab.transform, new Vector3(0f, .9f, -2.74f), new Vector3(1.05f, 1.8f, .12f), trim);
        CreatePrimitive(PrimitiveType.Cube, "研究所左窗", lab.transform, new Vector3(-2.3f, 2f, -2.74f), new Vector3(1.3f, 1.2f, .1f), glass);
        CreatePrimitive(PrimitiveType.Cube, "研究所右窗", lab.transform, new Vector3(2.3f, 2f, -2.74f), new Vector3(1.3f, 1.2f, .1f), glass);
        CreatePrimitive(PrimitiveType.Cylinder, "研究所天线", lab.transform, new Vector3(0f, 5.25f, 0f), new Vector3(.12f, 1.7f, .12f), trim);
        CreatePrimitive(PrimitiveType.Sphere, "研究所天线灯", lab.transform, new Vector3(0f, 6.15f, 0f), new Vector3(.35f, .35f, .35f), MakeMaterial(new Color(1f, .35f, .25f), true));
        CreateSignBoard(lab.transform, new Vector3(0f, 3.05f, -2.8f), "大木博士研究所", new Color(.72f, .2f, .22f));
    }

    private void CreateSignBoard(Transform parent, Vector3 localPosition, string label, Color boardColor)
    {
        var sign = new GameObject(label + " 牌");
        sign.transform.SetParent(parent, false);
        sign.transform.localPosition = localPosition;
        var wood = MakeMaterial(new Color(.38f, .23f, .14f));
        CreatePrimitive(PrimitiveType.Cube, "牌柱", sign.transform, new Vector3(0f, -.55f, 0f), new Vector3(.12f, 1.1f, .12f), wood);
        CreatePrimitive(PrimitiveType.Cube, "牌面", sign.transform, new Vector3(0f, 0f, 0f), new Vector3(Mathf.Max(1.5f, label.Length * .28f), .62f, .1f), MakeMaterial(boardColor));
        var textObject = new GameObject("牌面文字");
        textObject.transform.SetParent(sign.transform, false);
        textObject.transform.localPosition = new Vector3(0f, -.06f, -.07f);
        textObject.transform.localRotation = Quaternion.Euler(0f, 180f, 0f);
        var text = textObject.AddComponent<TextMesh>();
        text.text = label;
        text.anchor = TextAnchor.MiddleCenter;
        text.alignment = TextAlignment.Center;
        text.fontSize = 32;
        text.characterSize = .12f;
        text.color = Color.white;
    }

    private void CreateTownFence(Vector3 start, Vector3 end, int segments)
    {
        var wood = MakeMaterial(new Color(.52f, .34f, .2f));
        for (var index = 0; index <= segments; index++)
        {
            var position = Vector3.Lerp(start, end, index / (float)segments);
            CreatePrimitive(PrimitiveType.Cube, "篱笆柱", mapRoot, position + Vector3.up * .55f, new Vector3(.18f, 1.1f, .18f), wood);
        }

        var middle = Vector3.Lerp(start, end, .5f) + Vector3.up * .7f;
        var length = Vector3.Distance(start, end) + .12f;
        var horizontal = Mathf.Abs(end.x - start.x) > Mathf.Abs(end.z - start.z);
        var railScale = horizontal ? new Vector3(length, .14f, .14f) : new Vector3(.14f, .14f, length);
        CreatePrimitive(PrimitiveType.Cube, "篱笆横木", mapRoot, middle, railScale, wood);
    }

    private void BuildStartRoadPresentation()
    {
        CreateSkySteps();
        CreateSkyCrystalLights();
        CreateSkyClouds();
        CreateSkyMotes();
        CreateStartRoadGate();
    }

    private void CreateStartRoadGate()
    {
        var gate = new GameObject("Screenshot shape sky portal");
        gate.transform.SetParent(mapRoot, false);
        gate.transform.position = new Vector3(0f, 5.25f, -17.2f);
        var stone = GetVoxelMaterial("skyStone");
        var gold = GetVoxelMaterial("skyGold");
        var glow = GetVoxelMaterial("skyGlow");
        var leftWing = CreateOctahedron("Portal left white wing", gate.transform, new Vector3(-3.25f, 3.05f, 0f), .92f, new Vector3(2.65f, 4.8f, 1.25f), stone, true);
        leftWing.transform.localRotation = Quaternion.Euler(0f, 0f, -13f);
        var rightWing = CreateOctahedron("Portal right white wing", gate.transform, new Vector3(3.25f, 3.05f, 0f), .92f, new Vector3(2.65f, 4.8f, 1.25f), stone, true);
        rightWing.transform.localRotation = Quaternion.Euler(0f, 0f, 13f);
        CreateBeveledBox("Portal top white block", gate.transform, new Vector3(0f, 6.7f, 0f), new Vector3(4.6f, 1.05f, 1.25f), .2f, stone, true);
        CreateBeveledBox("Portal gold threshold", gate.transform, new Vector3(0f, .16f, 0f), new Vector3(7.1f, .3f, 1.3f), .08f, gold, true);
        skyGateCrown = CreateUvSphere("Portal blue crown", gate.transform, new Vector3(0f, 7.3f, -.35f), new Vector3(1.15f, 1.15f, .55f), glow, false).transform;
        var portalCore = CreateUvSphere("Portal blue core", gate.transform, new Vector3(0f, 3.35f, -.5f), new Vector3(3.15f, 5.15f, .45f), glow, false);
        portalCore.GetComponent<Renderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
        var leftLeaf = CreateOctahedron("Portal blue leaf left", gate.transform, new Vector3(-.78f, 3.25f, -.86f), .65f, new Vector3(.48f, 2.55f, .3f), glow, false);
        leftLeaf.transform.localRotation = Quaternion.Euler(0f, 0f, -11f);
        var rightLeaf = CreateOctahedron("Portal blue leaf right", gate.transform, new Vector3(.78f, 3.25f, -.86f), .65f, new Vector3(.48f, 2.55f, .3f), glow, false);
        rightLeaf.transform.localRotation = Quaternion.Euler(0f, 0f, 11f);

        var mistObject = new GameObject("Flowing gate cloud mist");
        mistObject.transform.SetParent(gate.transform, false);
        mistObject.transform.localPosition = new Vector3(0f, 3.2f, -.35f);
        skyGateMist = mistObject.AddComponent<ParticleSystem>();
        var mistMain = skyGateMist.main;
        mistMain.loop = true;
        mistMain.simulationSpace = ParticleSystemSimulationSpace.Local;
        mistMain.startLifetime = 3.4f;
        mistMain.startSpeed = new ParticleSystem.MinMaxCurve(.12f, .38f);
        mistMain.startSize = new ParticleSystem.MinMaxCurve(.42f, 1.15f);
        mistMain.startColor = new Color(.92f, .78f, 1f, .42f);
        mistMain.maxParticles = 70;
        var mistEmission = skyGateMist.emission;
        mistEmission.rateOverTime = 16f;
        var mistShape = skyGateMist.shape;
        mistShape.shapeType = ParticleSystemShapeType.Box;
        mistShape.scale = new Vector3(6.8f, 5.6f, .3f);
        var mistRenderer = skyGateMist.GetComponent<ParticleSystemRenderer>();
        mistRenderer.renderMode = ParticleSystemRenderMode.Billboard;
        mistRenderer.material = MakeParticleMaterial(new Color(.92f, .78f, 1f, .42f));

        var light = gate.AddComponent<Light>();
        light.type = LightType.Point;
        light.color = new Color(1f, .45f, .3f);
        light.range = 15f;
        light.intensity = 2.8f;
    }

    private void CreateSkySteps()
    {
        skyStepSequenceStartedAt = Time.time;
        var stone = GetVoxelMaterial("skyStone");
        for (var index = 0; index < 16; index++)
        {
            var target = new Vector3(0f, .18f + index * .34f, 6.55f - index * 1.45f);
            var stepRootObject = new GameObject("Sky step " + index);
            stepRootObject.transform.SetParent(mapRoot, false);
            stepRootObject.transform.localPosition = target + Vector3.down * 2.4f;
            var step = stepRootObject.transform;
            CreateBeveledBox("Marble slab", step, Vector3.zero, new Vector3(4.6f, .34f, 1.5f), .1f, stone, true);
            CreateBeveledBox("Marble shadow edge", step, new Vector3(0f, -.21f, .02f), new Vector3(4.76f, .1f, 1.56f), .035f, GetVoxelMaterial("skyShadow"), false);
            CreateSkyStepVeins(step, index);
            skySteps.Add(new SkyStepRuntime
            {
                Transform = step,
                StartPosition = step.localPosition,
                TargetPosition = target,
                Delay = index * .12f,
            });
        }
    }

    private void CreateSkyStepVeins(Transform step, int index)
    {
        var gold = GetVoxelMaterial("skyGold");
        var veinA = CreateBeveledBox("Marble gold vein", step, new Vector3(-1.25f, .181f, -.22f), new Vector3(1.85f, .025f, .035f), .01f, gold, false);
        veinA.transform.localRotation = Quaternion.Euler(0f, 0f, index % 2 == 0 ? -7f : 7f);
        var veinB = CreateBeveledBox("Marble gold vein", step, new Vector3(.72f, .183f, .2f), new Vector3(1.25f, .025f, .035f), .01f, gold, false);
        veinB.transform.localRotation = Quaternion.Euler(0f, 0f, index % 2 == 0 ? 9f : -9f);
    }

    private void CreateSkyCrystalLights()
    {
        for (var index = 0; index < 3; index++)
        {
            var stepIndex = 1 + index * 5;
            var y = .18f + stepIndex * .34f;
            var z = 6.55f - stepIndex * 1.45f;
            var scale = 1f + index * .18f;
            CreateSkyCrystalLight(new Vector3(-3.65f - index * .15f, y, z), index * 2, scale);
            CreateSkyCrystalLight(new Vector3(3.65f + index * .15f, y, z), index * 2 + 1, scale);
        }
    }

    private void CreateSkyCrystalLight(Vector3 position, int index, float scale)
    {
        var lamp = new GameObject("Screenshot crystal form " + index);
        lamp.transform.SetParent(mapRoot, false);
        lamp.transform.localPosition = position;
        var stone = GetVoxelMaterial("skyStone");
        var baseObject = CreateBeveledDisc("Crystal white base", lamp.transform, new Vector3(0f, -.06f, 0f), .72f * scale, .28f * scale, stone, false);
        baseObject.transform.localRotation = Quaternion.Euler(0f, index * 17f, 0f);
        var crystalMaterial = GetVoxelMaterial("skyGlow");
        var mainCrystal = CreateOctahedron("Crystal blue body", lamp.transform, new Vector3(0f, .55f * scale, 0f), .62f, new Vector3(.72f, 1.8f, .72f) * scale, crystalMaterial, false);
        mainCrystal.transform.localRotation = Quaternion.Euler(0f, 8f + index * 9f, -4f);
        var upperCrystal = CreateOctahedron("Crystal blue upper shard", lamp.transform, new Vector3(.52f * scale, .42f * scale, .18f * scale), .32f, new Vector3(.72f, 1.5f, .72f) * scale, crystalMaterial, false);
        upperCrystal.transform.localRotation = Quaternion.Euler(0f, -8f + index * 13f, 8f);
        if (index % 2 == 0)
        {
            var light = lamp.AddComponent<Light>();
            light.type = LightType.Point;
            light.color = new Color(.55f, .78f, 1f);
            light.range = 6.5f;
            light.intensity = .85f;
            light.shadows = LightShadows.None;
        }
        skyCrystals.Add(new SkyMotionRuntime { Transform = lamp.transform, StartPosition = position, Phase = index * .67f });
    }

    private void CreateSkyClouds()
    {
        var warmCloud = MakeSkyCloudMaterial(new Color(1f, .76f, .9f));
        var coolCloud = MakeSkyCloudMaterial(new Color(.72f, .65f, .92f));
        CreateCloudCluster(new Vector3(-8f, 5.5f, -8f), 1.15f, warmCloud, 0f);
        CreateCloudCluster(new Vector3(8f, 6.7f, -13f), 1.25f, coolCloud, 1.3f);
        CreateCloudCluster(new Vector3(-10f, 8.4f, -22f), 1.45f, warmCloud, 2.4f);
        CreateCloudCluster(new Vector3(10f, 8.1f, -27f), 1.1f, coolCloud, 3.1f);
    }

    private void CreateCloudCluster(Vector3 position, float scale, Material material, float phase)
    {
        var cloud = new GameObject("Sky cloud");
        cloud.transform.SetParent(mapRoot, false);
        cloud.transform.position = position;
        cloud.transform.localScale = Vector3.one * scale;
        skyClouds.Add(new SkyMotionRuntime { Transform = cloud.transform, StartPosition = position, Phase = phase });
        var offsets = new[]
        {
            new Vector3(-1.1f, 0f, 0f),
            new Vector3(0f, .35f, 0f),
            new Vector3(1.15f, .05f, .05f),
            new Vector3(.35f, -.18f, .55f),
        };
        var sizes = new[]
        {
            new Vector3(2.5f, 1.15f, 1.45f),
            new Vector3(2.8f, 1.45f, 1.7f),
            new Vector3(2.35f, 1.05f, 1.35f),
            new Vector3(1.8f, .8f, 1.2f),
        };
        for (var index = 0; index < offsets.Length; index++)
        {
            CreateCloudPuff("Cloud puff", cloud.transform, offsets[index], sizes[index], material);
        }
    }

    private void CreateSunsetRays()
    {
        var rayMaterial = MakeTransparentMaterial(new Color(1f, .48f, .3f, .1f));
        CreateLightBeam("Sunset light ray", new Vector3(13f, 10f, -38f), new Vector3(-3f, 2.6f, -9f), 2.2f, 5.4f, rayMaterial);
        CreateLightBeam("Sunset light ray", new Vector3(16f, 9f, -40f), new Vector3(3f, 2.1f, -8f), 1.8f, 4.2f, rayMaterial);
        CreateLightBeam("Sunset light ray", new Vector3(8f, 12f, -42f), new Vector3(7f, 3.5f, -12f), 1.6f, 3.8f, rayMaterial);
        CreateUvSphere("Distant sunset", mapRoot, new Vector3(14f, 9f, -42f), new Vector3(5f, 5f, 5f), GetVoxelMaterial("skySun"), false);
    }

    private void CreateSkyMotes()
    {
        var motesObject = new GameObject("Sky motes");
        motesObject.transform.SetParent(mapRoot, false);
        motesObject.transform.position = new Vector3(0f, 4.5f, -9f);
        skyMotes = motesObject.AddComponent<ParticleSystem>();
        var main = skyMotes.main;
        main.loop = true;
        main.startLifetime = 5.5f;
        main.startSpeed = new ParticleSystem.MinMaxCurve(.08f, .24f);
        main.startSize = new ParticleSystem.MinMaxCurve(.035f, .11f);
        main.startColor = new Color(1f, .76f, .62f, .9f);
        main.maxParticles = 96;
        var emission = skyMotes.emission;
        emission.rateOverTime = 18f;
        var shape = skyMotes.shape;
        shape.shapeType = ParticleSystemShapeType.Box;
        shape.scale = new Vector3(18f, 9f, 34f);
        var renderer = skyMotes.GetComponent<ParticleSystemRenderer>();
        renderer.renderMode = ParticleSystemRenderMode.Billboard;
        renderer.material = MakeParticleMaterial(new Color(1f, .58f, .38f, .9f));
    }

    private void BuildSkylineDistrict()
    {
        AddVoxelTower(new Vector3Int(-15, 1, -27), 5, 5, 10, "towerBlue", "gold");
        AddVoxelTower(new Vector3Int(-8, 1, -25), 4, 5, 7, "towerPlum", "glow");
        AddVoxelTower(new Vector3Int(4, 1, -29), 4, 3, 16, "towerBlue", "gold");
        AddVoxelTower(new Vector3Int(8, 1, -28), 5, 5, 13, "towerBlue", "gold");
        AddVoxelTower(new Vector3Int(12, 1, -7), 3, 4, 8, "towerPlum", "glow");
    }

    private void AddVoxelTower(Vector3Int origin, int width, int depth, int height, string bodyType, string windowType)
    {
        AddVoxelBox(origin, new Vector3Int(width, height, depth), bodyType);
        var frontZ = origin.z + depth;
        for (var y = 2; y < height; y += 2)
        {
            for (var x = 1; x < width - 1; x += 2) CreateVoxelBlock(new Vector3Int(origin.x + x, y, frontZ), windowType, false);
        }
        var sideX = origin.x - 1;
        for (var y = 2; y < height; y += 2)
        {
            for (var z = 1; z < depth - 1; z += 2) CreateVoxelBlock(new Vector3Int(sideX, y, origin.z + z), windowType, false);
        }
        for (var y = 3; y < height; y += 4)
        {
            AddVoxelBox(new Vector3Int(origin.x + 1, y, frontZ + 1), new Vector3Int(Mathf.Max(1, width - 2), 1, 1), "stone");
        }
        AddVoxelBox(new Vector3Int(origin.x, height, origin.z), new Vector3Int(width, 1, depth), "stone");
        AddVoxelBox(new Vector3Int(origin.x - 1, height + 1, origin.z - 1), new Vector3Int(width + 2, 1, depth + 2), "stone");
        AddVoxelBox(new Vector3Int(origin.x + width / 2, height + 1, origin.z + depth / 2), new Vector3Int(1, 2, 1), windowType);
        ChangeVoxelBlock(new Vector3Int(origin.x + width / 2, height + 1, origin.z + depth / 2), windowType);
        var beacon = new GameObject("Tower beacon");
        beacon.transform.SetParent(mapRoot, false);
        beacon.transform.position = new Vector3(origin.x + width / 2, height + 3, origin.z + depth / 2);
        var light = beacon.AddComponent<Light>();
        light.type = LightType.Point;
        light.color = windowType == "gold" ? new Color(1f, .64f, .25f) : new Color(.35f, .82f, .78f);
        light.range = 8f;
        light.intensity = 1.2f;
    }

    private void AddVoxelStreetLamp(Vector3Int origin)
    {
        AddVoxelBox(origin, new Vector3Int(1, 3, 1), "skyStone");
        AddVoxelBox(new Vector3Int(origin.x - 1, origin.y + 3, origin.z), new Vector3Int(3, 1, 1), "skyStone");
        CreateVoxelBlock(new Vector3Int(origin.x, origin.y + 4, origin.z), "skyGlow", false);
        var lamp = new GameObject("Street lamp");
        lamp.transform.SetParent(mapRoot, false);
        lamp.transform.position = new Vector3(origin.x, origin.y + 4, origin.z);
        var light = lamp.AddComponent<Light>();
        light.type = LightType.Point;
        light.color = new Color(.48f, .82f, 1f);
        light.range = 6f;
        light.intensity = .75f;
    }

    private void BuildVoxelTrail()
    {
        AddVoxelHill(new Vector3Int(-13, 1, -15), 3, "grass");
        AddVoxelHill(new Vector3Int(13, 1, -22), 4, "grass");
        for (var x = 6; x <= 11; x++)
        {
            for (var z = -11; z <= -6; z++) ChangeVoxelBlock(new Vector3Int(x, 0, z), "water");
        }
        var treeSpots = new[] { new Vector3Int(-10, 1, 4), new Vector3Int(10, 1, -2), new Vector3Int(-10, 1, -9), new Vector3Int(11, 1, -16), new Vector3Int(-10, 1, -24) };
        for (var index = 0; index < treeSpots.Length; index++) AddVoxelTree(treeSpots[index], 2 + index % 2);
        CreateNpc(Npcs[2]);
    }

    private void BuildVoxelGrove()
    {
        AddVoxelHill(new Vector3Int(-13, 1, -20), 4, "leaf");
        AddVoxelHill(new Vector3Int(13, 1, -16), 3, "leaf");
        var crystalSpots = new[] { new Vector3Int(-8, 1, -6), new Vector3Int(7, 1, -8), new Vector3Int(-7, 1, -22), new Vector3Int(7, 1, -24) };
        var crystalTypes = new[] { "glow", "crystal", "crystal", "gold" };
        for (var index = 0; index < crystalSpots.Length; index++) AddVoxelCrystal(crystalSpots[index], crystalTypes[index]);
        var treeSpots = new[] { new Vector3Int(-10, 1, 4), new Vector3Int(10, 1, 3), new Vector3Int(-11, 1, -13), new Vector3Int(11, 1, -15) };
        for (var index = 0; index < treeSpots.Length; index++) AddVoxelTree(treeSpots[index], 2 + index % 2);
        for (var x = -4; x <= 4; x++)
        {
            for (var z = -13; z <= -8; z++) ChangeVoxelBlock(new Vector3Int(x, 0, z), "water");
        }
    }

    private void AddVoxelHouse(Vector3Int origin, string roofType)
    {
        AddVoxelBox(origin, new Vector3Int(4, 2, 4), "wood");
        AddVoxelBox(new Vector3Int(origin.x, origin.y + 2, origin.z), new Vector3Int(4, 1, 4), roofType);
        ChangeVoxelBlock(new Vector3Int(origin.x + 1, 0, origin.z - 1), "path");
        AddVoxelBox(new Vector3Int(origin.x + 1, origin.y, origin.z - 1), new Vector3Int(2, 1, 1), "glow");
        CreateVoxelBlock(new Vector3Int(origin.x + 1, origin.y + 1, origin.z + 4), "gold", false);
        CreateVoxelBlock(new Vector3Int(origin.x + 2, origin.y + 1, origin.z + 4), "gold", false);
    }

    private void AddVoxelHill(Vector3Int center, int radius, string type)
    {
        for (var layer = 0; layer < radius; layer++)
        {
            var span = radius - layer;
            for (var x = -span; x <= span; x++)
            {
                for (var z = -span; z <= span; z++)
                {
                    if (Mathf.Abs(x) + Mathf.Abs(z) > span + 1) continue;
                    CreateVoxelBlock(new Vector3Int(center.x + x, center.y + layer, center.z + z), type, false);
                }
            }
        }
    }

    private void AddVoxelTree(Vector3Int origin, int height)
    {
        AddVoxelBox(origin, new Vector3Int(1, height, 1), "wood");
        AddVoxelBox(new Vector3Int(origin.x - 1, origin.y + height, origin.z - 1), new Vector3Int(3, 1, 3), "leaf");
        AddVoxelBox(new Vector3Int(origin.x, origin.y + height + 1, origin.z), new Vector3Int(1, 1, 1), "leaf");
    }

    private void AddVoxelCrystal(Vector3Int origin, string type)
    {
        AddVoxelBox(origin, new Vector3Int(1, 3, 1), type);
        AddVoxelBox(new Vector3Int(origin.x + 1, origin.y, origin.z), new Vector3Int(1, 2, 1), type);
    }

    private void AddVoxelBox(Vector3Int origin, Vector3Int size, string type)
    {
        for (var x = 0; x < size.x; x++)
        {
            for (var y = 0; y < size.y; y++)
            {
                for (var z = 0; z < size.z; z++) CreateVoxelBlock(origin + new Vector3Int(x, y, z), type, false);
            }
        }
    }

    private GameObject CreateVoxelBlock(Vector3Int coordinate, string blockType, bool breakable)
    {
        if (voxelBlocks.ContainsKey(coordinate)) return voxelBlocks[coordinate];
        var block = GameObject.CreatePrimitive(PrimitiveType.Cube);
        block.name = blockType + " block " + coordinate;
        block.transform.SetParent(mapRoot, false);
        block.transform.localPosition = new Vector3(coordinate.x, coordinate.y - .5f, coordinate.z);
        block.transform.localScale = Vector3.one;
        block.GetComponent<Renderer>().sharedMaterial = GetVoxelMaterial(blockType);
        var voxel = block.AddComponent<VoxelBlock>();
        voxel.Coordinate = coordinate;
        voxel.BlockType = blockType;
        voxel.Breakable = breakable;
        voxelBlocks.Add(coordinate, block);
        return block;
    }

    private void ChangeVoxelBlock(Vector3Int coordinate, string blockType)
    {
        GameObject block;
        if (!voxelBlocks.TryGetValue(coordinate, out block))
        {
            CreateVoxelBlock(coordinate, blockType, true);
            return;
        }
        block.GetComponent<Renderer>().sharedMaterial = GetVoxelMaterial(blockType);
        var voxel = block.GetComponent<VoxelBlock>();
        voxel.BlockType = blockType;
    }

    private Material GetVoxelMaterial(string blockType)
    {
        Material material;
        if (voxelMaterials.TryGetValue(blockType, out material)) return material;
        var color = new Color(.4f, .6f, .42f);
        var emission = false;
        if (blockType == "grass") color = new Color(.32f, .72f, .38f);
        if (blockType == "dirt") color = new Color(.5f, .33f, .2f);
        if (blockType == "stone") color = new Color(.5f, .56f, .6f);
        if (blockType == "path") color = new Color(.76f, .58f, .34f);
        if (blockType == "wood") color = new Color(.56f, .35f, .2f);
        if (blockType == "leaf") color = new Color(.22f, .58f, .32f);
        if (blockType == "roofBlue") color = new Color(.26f, .42f, .65f);
        if (blockType == "roofPlum") color = new Color(.46f, .31f, .62f);
        if (blockType == "towerBlue") color = new Color(.2f, .36f, .52f);
        if (blockType == "towerPlum") color = new Color(.34f, .28f, .5f);
        if (blockType == "water") color = new Color(.22f, .58f, .73f);
        if (blockType == "skyStone") color = new Color(.92f, .97f, 1f);
        if (blockType == "skyShadow") color = new Color(.26f, .18f, .42f);
        if (blockType == "skyGold") color = new Color(.86f, .5f, .2f);
        if (blockType == "skySun") { color = new Color(1f, .34f, .2f); emission = true; }
        if (blockType == "skyGlow") { color = new Color(.42f, .84f, 1f); emission = true; }
        if (blockType == "glow") { color = new Color(.25f, .9f, .78f); emission = true; }
        if (blockType == "crystal") { color = new Color(.55f, .48f, .9f); emission = true; }
        if (blockType == "gold") { color = new Color(.98f, .7f, .26f); emission = true; }
        if (blockType == "skyStone") material = MakeSkyMarbleMaterial(color, new Color(.78f, .48f, .24f), 1.15f, .14f, .18f, .9f);
        else if (blockType == "skyGold") material = MakeSkyMarbleMaterial(color, new Color(1f, .82f, .4f), 2.2f, .3f, .78f, .9f);
        else if (blockType == "skyShadow") material = MakeSkyMarbleMaterial(color, new Color(.12f, .08f, .22f), .8f, .1f, .1f, .65f);
        else if (blockType == "skyGlow" || blockType == "skySun") material = MakeSkyGlowMaterial(color, blockType == "skySun" ? 3.5f : 2.8f);
        else material = MakeMaterial(color, emission);
        if (material != null && material.HasProperty("_Metallic")) material.SetFloat("_Metallic", blockType == "skyGold" ? .72f : blockType == "skyStone" ? .18f : 0f);
        voxelMaterials.Add(blockType, material);
        return material;
    }

    private Material MakeParticleMaterial(Color color)
    {
        var shader = Shader.Find("Universal Render Pipeline/Particles/Unlit");
        if (shader == null) shader = Shader.Find("Particles/Standard Unlit");
        if (shader == null) return MakeMaterial(color, true);
        var material = new Material(shader);
        if (material.HasProperty("_BaseColor")) material.SetColor("_BaseColor", color);
        if (material.HasProperty("_Color")) material.SetColor("_Color", color);
        if (material.HasProperty("_Cull")) material.SetFloat("_Cull", 0f);
        return material;
    }

    private Material MakeTransparentMaterial(Color color)
    {
        var shader = Shader.Find("Sekai/SkyTransparent");
        if (shader == null) shader = Shader.Find("Universal Render Pipeline/Unlit");
        if (shader == null) shader = Shader.Find("Unlit/Transparent");
        if (shader == null) return MakeMaterial(color);
        var material = new Material(shader);
        if (material.HasProperty("_BaseColor")) material.SetColor("_BaseColor", color);
        if (material.HasProperty("_Color")) material.SetColor("_Color", color);
        if (material.HasProperty("_Surface")) material.SetFloat("_Surface", 1f);
        if (material.HasProperty("_Blend")) material.SetFloat("_Blend", 0f);
        if (material.HasProperty("_SrcBlend")) material.SetFloat("_SrcBlend", (float)UnityEngine.Rendering.BlendMode.SrcAlpha);
        if (material.HasProperty("_DstBlend")) material.SetFloat("_DstBlend", (float)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);
        if (material.HasProperty("_ZWrite")) material.SetFloat("_ZWrite", 0f);
        if (material.HasProperty("_Cull")) material.SetFloat("_Cull", 0f);
        material.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");
        material.renderQueue = 3000;
        return material;
    }

    private Material MakeSkyMarbleMaterial(Color baseColor, Color veinColor, float scale, float veinStrength, float metallic, float smoothness)
    {
        var shader = Shader.Find("Sekai/SkyMarble");
        if (shader == null) return MakeMaterial(baseColor);
        var material = new Material(shader);
        material.SetColor("_BaseColor", baseColor);
        material.SetColor("_VeinColor", veinColor);
        material.SetFloat("_Scale", scale);
        material.SetFloat("_VeinStrength", veinStrength);
        material.SetFloat("_Metallic", metallic);
        material.SetFloat("_Smoothness", smoothness);
        return material;
    }

    private Material MakeSkyGlowMaterial(Color color, float emission)
    {
        var shader = Shader.Find("Sekai/SkyGlow");
        if (shader == null) return MakeMaterial(color, true);
        var material = new Material(shader);
        material.SetColor("_Color", color);
        material.SetFloat("_Emission", emission);
        return material;
    }

    private Material MakeSkyCloudMaterial(Color color)
    {
        var shader = Shader.Find("Sekai/SkyCloud");
        if (shader == null) return MakeMaterial(color);
        var material = new Material(shader);
        material.SetColor("_Color", color);
        material.SetFloat("_Alpha", .72f);
        return material;
    }

    private void HandleBlockSelection()
    {
        if (Input.GetKeyDown(KeyCode.Alpha1)) SelectBlockType("grass", "草方块");
        if (Input.GetKeyDown(KeyCode.Alpha2)) SelectBlockType("wood", "木方块");
        if (Input.GetKeyDown(KeyCode.Alpha3)) SelectBlockType("stone", "石方块");
    }

    private void SelectBlockType(string blockType, string label)
    {
        selectedBlockType = blockType;
        SetNotice("已选择 " + label);
    }

    private void BreakVoxelBlock(VoxelBlock block)
    {
        if (block == null || !block.Breakable) return;
        voxelBlocks.Remove(block.Coordinate);
        Destroy(block.gameObject);
        SetNotice("挖掘了 " + block.BlockType);
    }

    private void PlaceVoxelBlock(VoxelBlock block, Vector3 normal)
    {
        if (block == null || currentMap == WorldMap.Town) return;
        var offset = new Vector3Int(Mathf.RoundToInt(normal.x), Mathf.RoundToInt(normal.y), Mathf.RoundToInt(normal.z));
        var coordinate = block.Coordinate + offset;
        if (coordinate.y < 0 || coordinate.x < -16 || coordinate.x > 15 || coordinate.z < -30 || coordinate.z > 15) return;
        if (voxelBlocks.ContainsKey(coordinate)) return;
        if (Vector3.Distance(player.transform.position, new Vector3(coordinate.x, 0f, coordinate.z)) < 1.25f) return;
        CreateVoxelBlock(coordinate, selectedBlockType, true);
        SetNotice("放置了 " + selectedBlockType + " 方块");
    }

    private void CreateVoxelSavePoint()
    {
        savePointPosition = new Vector3(0f, 0f, 10f);
        var shrine = new GameObject("Screenshot Crystal Save Point");
        shrine.transform.SetParent(mapRoot, false);
        shrine.transform.position = savePointPosition;
        var stone = GetVoxelMaterial("skyStone");
        var glow = GetVoxelMaterial("skyGlow");
        CreateBeveledDisc("Shrine white base", shrine.transform, new Vector3(0f, -.06f, 0f), .78f, .28f, stone, false);
        var body = CreateOctahedron("Shrine blue body", shrine.transform, new Vector3(0f, .55f, 0f), .62f, new Vector3(.72f, 1.8f, .72f), glow, false);
        body.transform.localRotation = Quaternion.Euler(0f, 10f, -4f);
        var upper = CreateOctahedron("Shrine blue upper shard", shrine.transform, new Vector3(.52f, .42f, .18f), .32f, new Vector3(.72f, 1.5f, .72f), glow, false);
        upper.transform.localRotation = Quaternion.Euler(0f, -8f, 8f);
        var light = shrine.AddComponent<Light>();
        light.type = LightType.Point;
        light.color = new Color(.28f, .82f, 1f);
        light.range = 7f;
        light.intensity = 1.25f;
        savePointObject = shrine;
    }

    private void BuildTown()
    {
        AddHouse(new Vector3(-8f, 0f, -12f), new Color(.38f, .52f, .68f));
        AddHouse(new Vector3(8f, 0f, -12f), new Color(.48f, .42f, .62f));
        CreatePrimitive(PrimitiveType.Cylinder, "Town fountain", mapRoot, new Vector3(0f, .15f, 5f), new Vector3(4.2f, .3f, 4.2f), MakeMaterial(new Color(.82f, .72f, .53f)));
        CreatePrimitive(PrimitiveType.Cylinder, "Fountain water", mapRoot, new Vector3(0f, .42f, 5f), new Vector3(2.3f, .22f, 2.3f), MakeMaterial(new Color(.38f, .68f, .72f)));
        CreateSavePoint();
        for (var index = 0; index < Npcs.Length; index++)
        {
            if (Npcs[index].Map == WorldMap.Town) CreateNpc(Npcs[index]);
        }
    }

    private void BuildTrail()
    {
        AddHill(new Vector3(-15f, 3.8f, -14f), 1.18f, new Color(.43f, .61f, .52f));
        AddHill(new Vector3(15f, 3.5f, -22f), 1.35f, new Color(.45f, .63f, .5f));
        CreatePrimitive(PrimitiveType.Cylinder, "Trail lake", mapRoot, new Vector3(9f, -.01f, -8f), new Vector3(12f, .04f, 12f), MakeMaterial(new Color(.37f, .67f, .72f)));
        var treeSpots = new[] { new Vector3(-10f, 0f, 4f), new Vector3(10f, 0f, -2f), new Vector3(-10f, 0f, -9f), new Vector3(11f, 0f, -16f), new Vector3(-10f, 0f, -24f) };
        for (var index = 0; index < treeSpots.Length; index++) AddTree(treeSpots[index], .88f + (index % 2) * .18f);
        CreateNpc(Npcs[2]);
    }

    private void BuildGrove()
    {
        AddHill(new Vector3(-14f, 4f, -20f), 1.35f, new Color(.4f, .55f, .48f));
        AddHill(new Vector3(14f, 3.8f, -16f), 1.2f, new Color(.42f, .58f, .49f));
        var crystalSpots = new[] { new Vector3(-8f, 0f, -6f), new Vector3(7f, 0f, -8f), new Vector3(-7f, 0f, -22f), new Vector3(7f, 0f, -24f) };
        var crystalColors = new[] { new Color(.45f, .84f, .81f), new Color(.7f, .84f, .4f), new Color(.62f, .5f, .85f), new Color(.95f, .72f, .36f) };
        for (var index = 0; index < crystalSpots.Length; index++) AddCrystal(crystalSpots[index], crystalColors[index], .8f);
        var treeSpots = new[] { new Vector3(-10f, 0f, 4f), new Vector3(10f, 0f, 3f), new Vector3(-11f, 0f, -13f), new Vector3(11f, 0f, -15f) };
        for (var index = 0; index < treeSpots.Length; index++) AddTree(treeSpots[index], .92f + (index % 2) * .2f);
        CreatePrimitive(PrimitiveType.Cylinder, "Grove pool", mapRoot, new Vector3(0f, 0f, -10f), new Vector3(11f, .04f, 11f), MakeMaterial(new Color(.4f, .7f, .7f)));
    }

    private void CreateSavePoint()
    {
        savePointPosition = new Vector3(0f, 0f, -10f);
        var shrine = new GameObject("Star Lamp Save Point");
        shrine.transform.SetParent(mapRoot, false);
        shrine.transform.position = savePointPosition;
        CreatePrimitive(PrimitiveType.Cylinder, "Shrine base", shrine.transform, new Vector3(0f, .12f, 0f), new Vector3(2.5f, .25f, 2.5f), MakeMaterial(new Color(.82f, .68f, .45f)));
        CreatePrimitive(PrimitiveType.Cylinder, "Star lamp", shrine.transform, new Vector3(0f, 1f, 0f), new Vector3(1.15f, 1.7f, 1.15f), MakeMaterial(new Color(.33f, .54f, .56f), true));
        CreatePrimitive(PrimitiveType.Sphere, "Star light", shrine.transform, new Vector3(0f, 2.2f, 0f), new Vector3(.7f, .7f, .7f), MakeMaterial(new Color(1f, .72f, .32f), true));
        var light = shrine.AddComponent<Light>();
        light.type = LightType.Point;
        light.color = new Color(1f, .68f, .32f);
        light.range = 10f;
        light.intensity = 2.6f;
        savePointObject = shrine;
    }

    private void CreateCreature(CreatureDefinition creature)
    {
        CreateCreature(creature, creature.SpawnPosition);
    }

    private void CreateCreature(CreatureDefinition creature, Vector2 position)
    {
        var group = new GameObject(creature.Name);
        group.transform.SetParent(mapRoot, false);
        group.transform.position = new Vector3(position.x, 0f, position.y);
        var interactable = group.AddComponent<WorldInteractable>();
        interactable.CreatureId = creature.Id;
        var collider = group.AddComponent<BoxCollider>();
        collider.center = new Vector3(0f, 1.15f, 0f);
        collider.size = new Vector3(2.1f, 2.5f, 2.1f);
        var body = MakeMaterial(creature.BodyColor);
        var accent = MakeMaterial(creature.AccentColor);
        var eyes = MakeMaterial(new Color(.08f, .14f, .18f));
        CreatePrimitive(PrimitiveType.Sphere, "Body", group.transform, new Vector3(0f, .78f, 0f), new Vector3(1.45f, 1.05f, 1.35f), body);
        CreatePrimitive(PrimitiveType.Sphere, "Head", group.transform, new Vector3(0f, 1.48f, .04f), new Vector3(1.1f, 1.1f, 1.1f), body);
        CreatePrimitive(PrimitiveType.Sphere, "Belly", group.transform, new Vector3(0f, .76f, .58f), new Vector3(.76f, .92f, .34f), accent);
        var earLeft = CreatePrimitive(PrimitiveType.Cylinder, "Ear L", group.transform, new Vector3(-.36f, 2.05f, .02f), new Vector3(.42f, .78f, .42f), body);
        earLeft.transform.localRotation = Quaternion.Euler(0f, 0f, -16f);
        var earRight = CreatePrimitive(PrimitiveType.Cylinder, "Ear R", group.transform, new Vector3(.36f, 2.05f, .02f), new Vector3(.42f, .78f, .42f), body);
        earRight.transform.localRotation = Quaternion.Euler(0f, 0f, 16f);
        CreatePrimitive(PrimitiveType.Sphere, "Eye L", group.transform, new Vector3(-.2f, 1.5f, .52f), new Vector3(.15f, .15f, .15f), eyes);
        CreatePrimitive(PrimitiveType.Sphere, "Eye R", group.transform, new Vector3(.2f, 1.5f, .52f), new Vector3(.15f, .15f, .15f), eyes);
        var tail = CreatePrimitive(PrimitiveType.Cylinder, "Tail", group.transform, new Vector3(.62f, .72f, -.18f), new Vector3(.28f, .72f, .28f), body);
        tail.transform.localRotation = Quaternion.Euler(0f, 90f, -20f);
        var ring = CreatePrimitive(PrimitiveType.Cylinder, "Selection ring", group.transform, new Vector3(0f, .06f, 0f), new Vector3(2.15f, .05f, 2.15f), MakeMaterial(new Color(1f, .8f, .36f), true));
        ring.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
        ring.SetActive(false);
        group.SetActive(!caughtIds.Contains(creature.Id) && !defeatedIds.Contains(creature.Id));
        worldCreatures.Add(creature.Id, group);
    }

    private void CreateNpc(NpcData npc)
    {
        var group = new GameObject(npc.Id);
        group.transform.SetParent(mapRoot, false);
        group.transform.position = new Vector3(npc.Position.x, 0f, npc.Position.y);
        var interactable = group.AddComponent<WorldInteractable>();
        interactable.NpcId = npc.Id;
        var collider = group.AddComponent<BoxCollider>();
        collider.center = new Vector3(0f, 1.15f, 0f);
        collider.size = new Vector3(1.6f, 2.8f, 1.6f);
        if (npc.Map == WorldMap.Town)
        {
            PalletTownBuilder.Trainer(group.transform, npc.Id, npc.Color);
            worldNpcs.Add(npc.Id, group);
            return;
        }
        var outfit = MakeMaterial(npc.Color);
        var skin = MakeMaterial(new Color(.93f, .68f, .55f));
        var hair = MakeMaterial(new Color(.27f, .2f, .35f));
        CreatePrimitive(PrimitiveType.Cylinder, "Outfit", group.transform, new Vector3(0f, 1.1f, 0f), new Vector3(.85f, 1.25f, .85f), outfit);
        CreatePrimitive(PrimitiveType.Sphere, "Head", group.transform, new Vector3(0f, 2f, 0f), new Vector3(.88f, .88f, .88f), skin);
        CreatePrimitive(PrimitiveType.Sphere, "Hair", group.transform, new Vector3(0f, 2.28f, 0f), new Vector3(.94f, .46f, .94f), hair);
        CreatePrimitive(PrimitiveType.Cylinder, "Foot L", group.transform, new Vector3(-.23f, .35f, 0f), new Vector3(.25f, .7f, .25f), hair);
        CreatePrimitive(PrimitiveType.Cylinder, "Foot R", group.transform, new Vector3(.23f, .35f, 0f), new Vector3(.25f, .7f, .25f), hair);
        worldNpcs.Add(npc.Id, group);
    }

    private void AddTransition(Vector3 position, Vector3 entry, WorldMap target, string label)
    {
        transitionPoints.Add(new TransitionPoint { Position = position, Entry = entry, Target = target, Label = label });
        var marker = new GameObject("Map marker: " + label);
        marker.transform.SetParent(mapRoot, false);
        marker.transform.position = position;
        CreatePrimitive(PrimitiveType.Cylinder, "Marker", marker.transform, new Vector3(0f, 1.1f, 0f), new Vector3(.26f, 2.2f, .26f), MakeMaterial(new Color(.9f, .75f, .48f), true));
        CreatePrimitive(PrimitiveType.Sphere, "Marker light", marker.transform, new Vector3(0f, 2.5f, 0f), new Vector3(.62f, .62f, .62f), MakeMaterial(new Color(.55f, .9f, .86f), true));
        var light = marker.AddComponent<Light>();
        light.type = LightType.Point;
        light.range = 7f;
        light.intensity = 1.4f;
        light.color = new Color(.5f, .9f, .86f);
    }

    private void AddTree(Vector3 position, float scale)
    {
        var tree = new GameObject("Tree");
        tree.transform.SetParent(mapRoot, false);
        tree.transform.position = position;
        tree.transform.localScale = Vector3.one * scale;
        CreatePrimitive(PrimitiveType.Cylinder, "Trunk", tree.transform, new Vector3(0f, .8f, 0f), new Vector3(.32f, 1.6f, .32f), MakeMaterial(new Color(.48f, .32f, .22f)));
        CreatePrimitive(PrimitiveType.Sphere, "Leaves", tree.transform, new Vector3(0f, 2.2f, 0f), new Vector3(2.3f, 2.8f, 2.3f), MakeMaterial(new Color(.26f, .55f, .37f)));
        CreatePrimitive(PrimitiveType.Sphere, "Crown", tree.transform, new Vector3(.08f, 3.18f, .02f), new Vector3(1.45f, 1.25f, 1.45f), MakeMaterial(new Color(.35f, .67f, .45f)));
    }

    private void AddHill(Vector3 position, float scale, Color color)
    {
        CreatePrimitive(PrimitiveType.Sphere, "Hill", mapRoot, position, new Vector3(11f, 9f, 11f) * scale, MakeMaterial(color));
    }

    private void AddHouse(Vector3 position, Color roofColor)
    {
        var house = new GameObject("Town house");
        house.transform.SetParent(mapRoot, false);
        house.transform.position = position;
        CreatePrimitive(PrimitiveType.Cube, "Wall", house.transform, new Vector3(0f, 1.35f, 0f), new Vector3(3.6f, 2.7f, 3f), MakeMaterial(new Color(.86f, .76f, .59f)));
        CreatePrimitive(PrimitiveType.Cube, "Roof", house.transform, new Vector3(0f, 3.35f, 0f), new Vector3(4.2f, .55f, 3.6f), MakeMaterial(roofColor));
        CreatePrimitive(PrimitiveType.Cube, "Door", house.transform, new Vector3(0f, .72f, -1.54f), new Vector3(.7f, 1.3f, .08f), MakeMaterial(new Color(1f, .72f, .38f), true));
    }

    private void AddCrystal(Vector3 position, Color color, float scale)
    {
        var crystal = new GameObject("Grove crystal");
        crystal.transform.SetParent(mapRoot, false);
        crystal.transform.position = position;
        crystal.transform.localScale = Vector3.one * scale;
        var material = MakeMaterial(color, true);
        var shard = CreatePrimitive(PrimitiveType.Cylinder, "Crystal shard", crystal.transform, new Vector3(0f, .7f, 0f), new Vector3(1.05f, 2.6f, 1.05f), material);
        shard.transform.localRotation = Quaternion.Euler(0f, 12f, 8f);
        CreatePrimitive(PrimitiveType.Cylinder, "Crystal chip", crystal.transform, new Vector3(.65f, .45f, .2f), new Vector3(.58f, 1.4f, .58f), material);
        var light = crystal.AddComponent<Light>();
        light.type = LightType.Point;
        light.color = color;
        light.range = 5f;
        light.intensity = .65f;
    }

    private GameObject CreateOctahedron(string objectName, Transform parent, Vector3 localPosition, float radius, Vector3 localScale, Material material, bool collidable)
    {
        var vertices = new[]
        {
            new Vector3(0f, radius, 0f),
            new Vector3(radius, 0f, 0f),
            new Vector3(0f, 0f, radius),
            new Vector3(-radius, 0f, 0f),
            new Vector3(0f, 0f, -radius),
            new Vector3(0f, -radius, 0f),
        };
        var triangles = new[]
        {
            0, 2, 1, 0, 3, 2, 0, 4, 3, 0, 1, 4,
            5, 1, 2, 5, 2, 3, 5, 3, 4, 5, 4, 1,
        };
        var mesh = new Mesh { name = objectName + " mesh" };
        mesh.vertices = vertices;
        mesh.triangles = triangles;
        mesh.RecalculateNormals();
        mesh.RecalculateBounds();
        return CreateMeshObject(objectName, parent, localPosition, localScale, mesh, material, collidable);
    }

    private GameObject CreateLightBeam(string objectName, Vector3 start, Vector3 end, float startWidth, float endWidth, Material material)
    {
        var direction = (end - start).normalized;
        var right = Vector3.Cross(Vector3.up, direction).normalized;
        var up = Vector3.Cross(direction, right).normalized;
        var startRight = right * startWidth * .5f;
        var startUp = up * startWidth * .5f;
        var endRight = right * endWidth * .5f;
        var endUp = up * endWidth * .5f;
        var vertices = new[]
        {
            start - startRight - startUp,
            start + startRight - startUp,
            start + startRight + startUp,
            start - startRight + startUp,
            end - endRight - endUp,
            end + endRight - endUp,
            end + endRight + endUp,
            end - endRight + endUp,
        };
        var triangles = new[]
        {
            0, 4, 5, 0, 5, 1,
            1, 5, 6, 1, 6, 2,
            2, 6, 7, 2, 7, 3,
            3, 7, 4, 3, 4, 0,
            4, 7, 6, 4, 6, 5,
            3, 0, 1, 3, 1, 2,
        };
        var mesh = new Mesh { name = objectName + " mesh" };
        mesh.vertices = vertices;
        mesh.triangles = triangles;
        mesh.RecalculateNormals();
        mesh.RecalculateBounds();
        var beam = CreateMeshObject(objectName, mapRoot, Vector3.zero, Vector3.one, mesh, material, false);
        beam.GetComponent<Renderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
        return beam;
    }

    private GameObject CreateBeveledBox(string objectName, Transform parent, Vector3 localPosition, Vector3 size, float bevel, Material material, bool collidable)
    {
        var halfX = size.x * .5f;
        var halfY = size.y * .5f;
        var halfZ = size.z * .5f;
        var edge = Mathf.Clamp(bevel, .002f, Mathf.Min(halfX, Mathf.Min(halfY, halfZ)) * .45f);
        var vertices = new List<Vector3>();
        var triangles = new List<int>();
        var rings = new int[4][];
        rings[0] = AddBoxRing(vertices, halfX - edge, halfZ - edge, edge * .55f, -halfY);
        rings[1] = AddBoxRing(vertices, halfX, halfZ, edge, -halfY + edge);
        rings[2] = AddBoxRing(vertices, halfX, halfZ, edge, halfY - edge);
        rings[3] = AddBoxRing(vertices, halfX - edge, halfZ - edge, edge * .55f, halfY);
        for (var ringIndex = 0; ringIndex < rings.Length - 1; ringIndex++) AddRingFaces(triangles, rings[ringIndex], rings[ringIndex + 1]);
        var bottomCenter = vertices.Count;
        vertices.Add(new Vector3(0f, -halfY, 0f));
        var topCenter = vertices.Count;
        vertices.Add(new Vector3(0f, halfY, 0f));
        for (var index = 0; index < 8; index++)
        {
            var next = (index + 1) % 8;
            triangles.Add(bottomCenter);
            triangles.Add(rings[0][index]);
            triangles.Add(rings[0][next]);
            triangles.Add(topCenter);
            triangles.Add(rings[3][next]);
            triangles.Add(rings[3][index]);
        }
        var mesh = new Mesh { name = objectName + " mesh" };
        mesh.vertices = vertices.ToArray();
        mesh.triangles = triangles.ToArray();
        mesh.RecalculateNormals();
        mesh.RecalculateBounds();
        return CreateMeshObject(objectName, parent, localPosition, Vector3.one, mesh, material, collidable);
    }

    private int[] AddBoxRing(List<Vector3> vertices, float halfX, float halfZ, float corner, float y)
    {
        var start = vertices.Count;
        vertices.Add(new Vector3(-halfX + corner, y, -halfZ));
        vertices.Add(new Vector3(halfX - corner, y, -halfZ));
        vertices.Add(new Vector3(halfX, y, -halfZ + corner));
        vertices.Add(new Vector3(halfX, y, halfZ - corner));
        vertices.Add(new Vector3(halfX - corner, y, halfZ));
        vertices.Add(new Vector3(-halfX + corner, y, halfZ));
        vertices.Add(new Vector3(-halfX, y, halfZ - corner));
        vertices.Add(new Vector3(-halfX, y, -halfZ + corner));
        var ring = new int[8];
        for (var index = 0; index < ring.Length; index++) ring[index] = start + index;
        return ring;
    }

    private void AddRingFaces(List<int> triangles, int[] lower, int[] upper)
    {
        for (var index = 0; index < lower.Length; index++)
        {
            var next = (index + 1) % lower.Length;
            triangles.Add(lower[next]);
            triangles.Add(lower[index]);
            triangles.Add(upper[index]);
            triangles.Add(lower[next]);
            triangles.Add(upper[index]);
            triangles.Add(upper[next]);
        }
    }

    private GameObject CreateBeveledDisc(string objectName, Transform parent, Vector3 localPosition, float radius, float height, Material material, bool collidable)
    {
        const int segments = 32;
        var bevel = Mathf.Min(.12f, height * .35f, radius * .08f);
        var vertices = new List<Vector3>();
        var triangles = new List<int>();
        var rings = new int[4][];
        rings[0] = AddDiscRing(vertices, radius - bevel, -height * .5f);
        rings[1] = AddDiscRing(vertices, radius, -height * .5f + bevel);
        rings[2] = AddDiscRing(vertices, radius, height * .5f - bevel);
        rings[3] = AddDiscRing(vertices, radius - bevel, height * .5f);
        for (var ringIndex = 0; ringIndex < rings.Length - 1; ringIndex++) AddDiscRingFaces(triangles, rings[ringIndex], rings[ringIndex + 1]);
        var bottomCenter = vertices.Count;
        vertices.Add(new Vector3(0f, -height * .5f, 0f));
        var topCenter = vertices.Count;
        vertices.Add(new Vector3(0f, height * .5f, 0f));
        for (var index = 0; index < segments; index++)
        {
            var next = (index + 1) % segments;
            triangles.Add(bottomCenter);
            triangles.Add(rings[0][index]);
            triangles.Add(rings[0][next]);
            triangles.Add(topCenter);
            triangles.Add(rings[3][next]);
            triangles.Add(rings[3][index]);
        }
        var mesh = new Mesh { name = objectName + " mesh" };
        mesh.vertices = vertices.ToArray();
        mesh.triangles = triangles.ToArray();
        mesh.RecalculateNormals();
        mesh.RecalculateBounds();
        return CreateMeshObject(objectName, parent, localPosition, Vector3.one, mesh, material, collidable);
    }

    private int[] AddDiscRing(List<Vector3> vertices, float radius, float y)
    {
        const int segments = 32;
        var start = vertices.Count;
        for (var index = 0; index < segments; index++)
        {
            var angle = index * Mathf.PI * 2f / segments;
            vertices.Add(new Vector3(Mathf.Cos(angle) * radius, y, Mathf.Sin(angle) * radius));
        }
        var ring = new int[segments];
        for (var index = 0; index < segments; index++) ring[index] = start + index;
        return ring;
    }

    private void AddDiscRingFaces(List<int> triangles, int[] lower, int[] upper)
    {
        for (var index = 0; index < lower.Length; index++)
        {
            var next = (index + 1) % lower.Length;
            triangles.Add(lower[next]);
            triangles.Add(lower[index]);
            triangles.Add(upper[index]);
            triangles.Add(lower[next]);
            triangles.Add(upper[index]);
            triangles.Add(upper[next]);
        }
    }

    private GameObject CreateFlatRing(string objectName, Transform parent, Vector3 localPosition, float outerRadius, float innerRadius, Material material, bool collidable)
    {
        const int segments = 32;
        const float thickness = .035f;
        var vertices = new List<Vector3>();
        var triangles = new List<int>();
        var outerBottom = AddDiscRing(vertices, outerRadius, -thickness * .5f);
        var innerBottom = AddDiscRing(vertices, innerRadius, -thickness * .5f);
        var outerTop = AddDiscRing(vertices, outerRadius, thickness * .5f);
        var innerTop = AddDiscRing(vertices, innerRadius, thickness * .5f);
        for (var index = 0; index < segments; index++)
        {
            var next = (index + 1) % segments;
            triangles.Add(outerBottom[next]); triangles.Add(outerBottom[index]); triangles.Add(outerTop[index]);
            triangles.Add(outerBottom[next]); triangles.Add(outerTop[index]); triangles.Add(outerTop[next]);
            triangles.Add(innerBottom[index]); triangles.Add(innerBottom[next]); triangles.Add(innerTop[next]);
            triangles.Add(innerBottom[index]); triangles.Add(innerTop[next]); triangles.Add(innerTop[index]);
            triangles.Add(outerTop[index]); triangles.Add(innerTop[index]); triangles.Add(innerTop[next]);
            triangles.Add(outerTop[index]); triangles.Add(innerTop[next]); triangles.Add(outerTop[next]);
            triangles.Add(outerBottom[next]); triangles.Add(innerBottom[next]); triangles.Add(innerBottom[index]);
            triangles.Add(outerBottom[next]); triangles.Add(innerBottom[index]); triangles.Add(outerBottom[index]);
        }
        var mesh = new Mesh { name = objectName + " mesh" };
        mesh.vertices = vertices.ToArray();
        mesh.triangles = triangles.ToArray();
        mesh.RecalculateNormals();
        mesh.RecalculateBounds();
        return CreateMeshObject(objectName, parent, localPosition, Vector3.one, mesh, material, collidable);
    }

    private GameObject CreateFacetedCrystal(string objectName, Transform parent, Vector3 localPosition, float radius, float height, Material material, bool collidable)
    {
        const int segments = 6;
        var vertices = new List<Vector3>();
        var triangles = new List<int>();
        var bottomStart = vertices.Count;
        AddCrystalRing(vertices, radius * .55f, 0f, segments);
        var lowerStart = vertices.Count;
        AddCrystalRing(vertices, radius, height * .25f, segments);
        var upperStart = vertices.Count;
        AddCrystalRing(vertices, radius * .68f, height * .78f, segments);
        var apex = vertices.Count;
        vertices.Add(new Vector3(0f, height, 0f));
        var baseCenter = vertices.Count;
        vertices.Add(new Vector3(0f, 0f, 0f));
        for (var index = 0; index < segments; index++)
        {
            var next = (index + 1) % segments;
            triangles.Add(bottomStart + next); triangles.Add(bottomStart + index); triangles.Add(lowerStart + index);
            triangles.Add(bottomStart + next); triangles.Add(lowerStart + index); triangles.Add(lowerStart + next);
            triangles.Add(lowerStart + next); triangles.Add(lowerStart + index); triangles.Add(upperStart + index);
            triangles.Add(lowerStart + next); triangles.Add(upperStart + index); triangles.Add(upperStart + next);
            triangles.Add(upperStart + index); triangles.Add(apex); triangles.Add(upperStart + next);
            triangles.Add(baseCenter); triangles.Add(bottomStart + index); triangles.Add(bottomStart + next);
        }
        var mesh = new Mesh { name = objectName + " mesh" };
        mesh.vertices = vertices.ToArray();
        mesh.triangles = triangles.ToArray();
        mesh.RecalculateNormals();
        mesh.RecalculateBounds();
        return CreateMeshObject(objectName, parent, localPosition, Vector3.one, mesh, material, collidable);
    }

    private void AddCrystalRing(List<Vector3> vertices, float radius, float y, int segments)
    {
        for (var index = 0; index < segments; index++)
        {
            var angle = index * Mathf.PI * 2f / segments;
            vertices.Add(new Vector3(Mathf.Cos(angle) * radius, y, Mathf.Sin(angle) * radius));
        }
    }

    private GameObject CreateUvSphere(string objectName, Transform parent, Vector3 localPosition, Vector3 size, Material material, bool collidable)
    {
        const int segments = 16;
        const int rings = 8;
        var vertices = new List<Vector3>();
        var triangles = new List<int>();
        for (var ring = 0; ring <= rings; ring++)
        {
            var vertical = ring / (float)rings;
            var phi = vertical * Mathf.PI;
            var y = Mathf.Cos(phi) * size.y * .5f;
            var radius = Mathf.Sin(phi);
            for (var segment = 0; segment <= segments; segment++)
            {
                var angle = segment / (float)segments * Mathf.PI * 2f;
                vertices.Add(new Vector3(Mathf.Cos(angle) * radius * size.x * .5f, y, Mathf.Sin(angle) * radius * size.z * .5f));
            }
        }
        for (var ring = 0; ring < rings; ring++)
        {
            for (var segment = 0; segment < segments; segment++)
            {
                var current = ring * (segments + 1) + segment;
                var next = current + segments + 1;
                triangles.Add(current); triangles.Add(next); triangles.Add(next + 1);
                triangles.Add(current); triangles.Add(next + 1); triangles.Add(current + 1);
            }
        }
        var mesh = new Mesh { name = objectName + " mesh" };
        mesh.vertices = vertices.ToArray();
        mesh.triangles = triangles.ToArray();
        mesh.RecalculateNormals();
        mesh.RecalculateBounds();
        return CreateMeshObject(objectName, parent, localPosition, Vector3.one, mesh, material, collidable);
    }

    private GameObject CreateCloudPuff(string objectName, Transform parent, Vector3 localPosition, Vector3 size, Material material)
    {
        return CreateUvSphere(objectName, parent, localPosition, size, material, false);
    }

    private GameObject CreateMeshObject(string objectName, Transform parent, Vector3 localPosition, Vector3 localScale, Mesh mesh, Material material, bool collidable)
    {
        var meshObject = new GameObject(objectName);
        meshObject.transform.SetParent(parent, false);
        meshObject.transform.localPosition = localPosition;
        meshObject.transform.localScale = localScale;
        var filter = meshObject.AddComponent<MeshFilter>();
        filter.sharedMesh = mesh;
        var renderer = meshObject.AddComponent<MeshRenderer>();
        renderer.sharedMaterial = material;
        renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.On;
        renderer.receiveShadows = true;
        if (collidable)
        {
            var collider = meshObject.AddComponent<MeshCollider>();
            collider.sharedMesh = mesh;
        }
        return meshObject;
    }

    private GameObject CreatePrimitive(PrimitiveType type, string objectName, Transform parent, Vector3 localPosition, Vector3 localScale, Material material)
    {
        var primitive = GameObject.CreatePrimitive(type);
        primitive.name = objectName;
        primitive.transform.SetParent(parent, false);
        primitive.transform.localPosition = localPosition;
        primitive.transform.localScale = localScale;
        var renderer = primitive.GetComponent<Renderer>();
        renderer.sharedMaterial = material;
        renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.On;
        renderer.receiveShadows = true;
        return primitive;
    }

    private Material MakeMaterial(Color color, bool emission = false)
    {
        var template = Resources.Load<Material>("VoxelBase");
        if (template != null)
        {
            var materialFromAsset = new Material(template);
            materialFromAsset.color = color;
            if (materialFromAsset.HasProperty("_Cull")) materialFromAsset.SetFloat("_Cull", 0f);
            if (materialFromAsset.HasProperty("_Smoothness")) materialFromAsset.SetFloat("_Smoothness", emission ? .5f : .82f);
            if (emission)
            {
                materialFromAsset.EnableKeyword("_EMISSION");
                materialFromAsset.SetColor("_EmissionColor", color * .55f);
            }
            return materialFromAsset;
        }
        var shader = Shader.Find("Universal Render Pipeline/Lit");
        if (shader == null) shader = Shader.Find("Standard");
        if (shader == null)
        {
            var fallback = Resources.GetBuiltinResource<Material>("Default-Material.mat");
            if (fallback != null)
            {
                var fallbackMaterial = new Material(fallback);
                fallbackMaterial.color = color;
                return fallbackMaterial;
            }
            Debug.LogError("No Unity material shader is available.");
            return null;
        }
        var material = new Material(shader);
        material.color = color;
        if (material.HasProperty("_Cull")) material.SetFloat("_Cull", 0f);
        if (emission)
        {
            material.EnableKeyword("_EMISSION");
            material.SetColor("_EmissionColor", color * .55f);
        }
        return material;
    }

    private void UpdatePlayerMovement()
    {
        MovePlayer(new Vector2(Input.GetAxisRaw("Horizontal"), Input.GetAxisRaw("Vertical")), Input.GetKey(KeyCode.LeftShift), Input.GetKeyDown(KeyCode.Space), Time.deltaTime);
    }

    private void MovePlayer(Vector2 movement, bool running, bool jump, float deltaTime)
    {
        var input = new Vector3(movement.x, 0f, movement.y);
        var moveDirection = Vector3.zero;
        if (input.sqrMagnitude >= .01f)
        {
            moveDirection = Quaternion.Euler(0f, cameraYaw, 0f) * input.normalized;
            player.transform.rotation = Quaternion.Slerp(player.transform.rotation, Quaternion.LookRotation(moveDirection, Vector3.up), 1f - Mathf.Exp(-14f * deltaTime));
        }

        if (playerController.isGrounded && verticalVelocity < 0f) verticalVelocity = -2f;
        if (playerController.isGrounded && jump)
        {
            verticalVelocity = Mathf.Sqrt(PlayerJumpHeight * -2f * PlayerGravity);
        }
        verticalVelocity += PlayerGravity * deltaTime;

        var speed = running ? (openWorldEnabled ? 9.2f : 6.8f) : 4.3f;
        var motion = moveDirection * speed;
        var unclampedPosition = player.transform.position + motion * deltaTime;
        if (openWorldEnabled) unclampedPosition = ConstrainExpeditionMovement(unclampedPosition);
        else
        {
            unclampedPosition.x = Mathf.Clamp(unclampedPosition.x, currentMap == WorldMap.Town ? -19f : -12.8f, currentMap == WorldMap.Town ? 19f : 12.8f);
            var townSouthLimit = Mathf.Abs(unclampedPosition.x + 1.5f) < 1.3f ? -21.3f : -17.5f;
            unclampedPosition.z = Mathf.Clamp(unclampedPosition.z, currentMap == WorldMap.Town ? townSouthLimit : -27f, currentMap == WorldMap.Town ? 25f : 14f);
        }
        motion.x = (unclampedPosition.x - player.transform.position.x) / Mathf.Max(.0001f, deltaTime);
        motion.z = (unclampedPosition.z - player.transform.position.z) / Mathf.Max(.0001f, deltaTime);
        motion.y = verticalVelocity;
        playerController.Move(motion * deltaTime);
        if (currentMap == WorldMap.Town && player.transform.position.y < (openWorldEnabled ? -25f : -8f))
        {
            TeleportPlayer(new Vector3(0f, 0f, 8f));
            SetNotice(IsChinese ? "已回到真新镇小径" : "Returned to Pallet Town");
        }
    }

    private void UpdateCameraInput()
    {
        if (Input.GetKeyDown(KeyCode.Tab)) { townOverview = false; thirdPerson = !thirdPerson; UpdateTownCameraMode(); }
        if (currentMap == WorldMap.Town)
        {
            if (Input.GetKeyDown(KeyCode.F2)) { townOverview = !townOverview; thirdPerson = true; townWideView = true; UpdateTownCameraMode(); }
            if (!openWorldEnabled && Input.GetKeyDown(KeyCode.E))
            {
                GameObject nearest = null; float distance = 3.5f;
                foreach(var npc in worldNpcs.Values)
                {
                    var d = Vector3.Distance(npc.transform.position, player.transform.position);
                    if(d < distance) { distance=d; nearest=npc; }
                }
                if(nearest != null) SelectInteractable(nearest.GetComponent<WorldInteractable>());
            }
            if (townOverview) return;
        }
        if (Input.GetKeyDown(KeyCode.Escape))
        {
            mouseLookCaptured = false;
            Cursor.lockState = CursorLockMode.None;
            Cursor.visible = true;
        }

        var pointerOverUi = EventSystem.current != null && EventSystem.current.IsPointerOverGameObject();
        if ((!thirdPerson && Input.GetMouseButtonDown(0) || thirdPerson && Input.GetMouseButtonDown(1)) && !pointerOverUi)
        {
            mouseLookCaptured = true;
            Cursor.lockState = CursorLockMode.Locked;
            Cursor.visible = false;
        }
        if (thirdPerson && Input.GetMouseButtonUp(1))
        {
            mouseLookCaptured = false;
            Cursor.lockState = CursorLockMode.None;
            Cursor.visible = true;
        }

        if (mouseLookCaptured || Input.GetMouseButton(2) || (thirdPerson && Input.GetMouseButton(1)))
        {
            cameraYaw += Input.GetAxis("Mouse X") * 3.4f;
            cameraPitch = Mathf.Clamp(cameraPitch - Input.GetAxis("Mouse Y") * 2.4f, thirdPerson ? -12f : -55f, thirdPerson ? 65f : 55f);
        }
        if(thirdPerson) thirdPersonDistance = Mathf.Clamp(thirdPersonDistance - Input.mouseScrollDelta.y * .5f, 2.6f, 8f);
        else mainCamera.fieldOfView = Mathf.Clamp(mainCamera.fieldOfView - Input.mouseScrollDelta.y * 1.5f, 55f, 78f);
    }

    private void UpdateCameraFollow()
    {
        if (mainCamera == null || player == null) return;
        if (openWorldEnabled && currentBattle != null) { UpdateFieldBattleCamera(); return; }
        if (currentMap == WorldMap.Town && townOverview)
        {
            var focus = townWideView ? new Vector3(0f, 0f, 2f) : player.transform.position;
            mainCamera.transform.position = focus + new Vector3(26f, 35f, -40f);
            mainCamera.transform.LookAt(focus);
            cameraYaw = mainCamera.transform.eulerAngles.y;
            return;
        }
        if (thirdPerson)
        {
            var pivot = player.transform.position + Vector3.up * 1.15f;
            var direction = Quaternion.Euler(cameraPitch, cameraYaw, 0f) * Vector3.back;
            float distance = thirdPersonDistance;
            // On sloping banks, lift the camera above the terrain before pushing it into Ash's back.
            for (var attempt = 0; attempt < (openWorldEnabled ? 5 : 1); attempt++)
            {
                distance = thirdPersonDistance;
                bool terrainBlocked = false;
                foreach(var hit in Physics.SphereCastAll(pivot, .2f, direction, thirdPersonDistance, ~0, QueryTriggerInteraction.Ignore))
                {
                    if (hit.transform.IsChildOf(player.transform)) continue;
                    if (hit.distance < distance)
                    {
                        distance = Mathf.Max(.3f, hit.distance - .12f);
                        terrainBlocked = hit.transform.name.StartsWith("Landscape ");
                    }
                }
                if (!terrainBlocked || distance >= 3.8f || attempt == 4) break;
                direction = Quaternion.Euler(Mathf.Min(65, cameraPitch + (attempt + 1) * 12), cameraYaw, 0f) * Vector3.back;
            }
            resolvedCameraDistance = distance < resolvedCameraDistance ? distance : Mathf.Lerp(resolvedCameraDistance, distance, 1f - Mathf.Exp(-9f * Time.deltaTime));
            mainCamera.transform.position = pivot + direction * resolvedCameraDistance;
            mainCamera.transform.LookAt(pivot);
            return;
        }
        var target = player.transform.position + Vector3.up * FirstPersonEyeHeight;
        mainCamera.transform.position = Vector3.Lerp(mainCamera.transform.position, target, 1f - Mathf.Pow(.0008f, Time.deltaTime));
        mainCamera.transform.rotation = Quaternion.Euler(cameraPitch, cameraYaw, 0f);
    }

    private void UpdateTownCameraMode()
    {
        if (mainCamera == null) return;
        var overview = currentMap == WorldMap.Town && townOverview;
        mainCamera.orthographic = overview;
        mainCamera.orthographicSize = townWideView ? 23.5f : 11f;
        mainCamera.fieldOfView = thirdPerson ? (openWorldEnabled ? 60f : 55f) : 65f;
        resolvedCameraDistance = thirdPersonDistance;
        mouseLookCaptured = false;
        Cursor.lockState = CursorLockMode.None;
        Cursor.visible = true;
        if(ashAvatar != null) ashAvatar.gameObject.SetActive(overview || thirdPerson);
        if(crosshairText != null) crosshairText.enabled = !overview && !thirdPerson;
        if(!overview && !thirdPerson) mainCamera.transform.position = player.transform.position + Vector3.up * FirstPersonEyeHeight;
    }

    private IEnumerator CaptureTownReview(string directory)
    {
        capturingTown = true;
        System.IO.Directory.CreateDirectory(directory);
        yield return null;
        yield return null;
        Physics.SyncTransforms();
        // Ignore the trainer's own capsule when probing the ground beneath spawn.
        playerController.enabled = false;
        ValidateTownLayout();
        playerController.enabled = true;
        playerController.Move(Vector3.down * .3f);
        townOverview = true; UpdateTownCameraMode();
        UpdateCameraFollow();
        CaptureTownCamera(System.IO.Path.Combine(directory,"pallet-town-overview.png"));
        // Render the actual HUD too: scene-only screenshots cannot verify UI overlap.
        var previousMode = hudCanvas.renderMode;
        hudCanvas.renderMode = RenderMode.ScreenSpaceCamera;
        hudCanvas.worldCamera = mainCamera;
        hudCanvas.planeDistance = .4f;
        Canvas.ForceUpdateCanvases();
        CaptureTownCamera(System.IO.Path.Combine(directory,"pallet-town-gameplay.png"));
        hudCanvas.renderMode = previousMode;
        mainCamera.orthographicSize = 12.5f;
        mainCamera.transform.position = new Vector3(-9,0,7) + new Vector3(15,19,-26);
        mainCamera.transform.LookAt(new Vector3(-4,1,7));
        CaptureTownCamera(System.IO.Path.Combine(directory,"pallet-town-houses.png"));
        mainCamera.orthographic = false;
        mainCamera.fieldOfView = 65;
        mainCamera.transform.position = new Vector3(0,2.1f,-13);
        mainCamera.transform.LookAt(new Vector3(7,2,-4));
        CaptureTownCamera(System.IO.Path.Combine(directory,"pallet-town-street.png"));
        // Exercise the same coroutine used by walking through the route exit.
        yield return SwitchMap(transitionPoints[0]);
        if(currentMap != WorldMap.Trail) throw new Exception("North exit did not load Trail.");
        yield return null;
        yield return SwitchMap(transitionPoints[0]);
        yield return null;
        if(currentMap != WorldMap.Town || Vector3.Distance(player.transform.position,new Vector3(0,.1f,18)) > .1f) throw new Exception("Return to Pallet Town failed.");
        if(transitionBusy) throw new Exception("Map transition did not complete.");
        Debug.Log("PALLET_ROUNDTRIP_OK: Town -> Trail -> Town; safe return at north path.");
        Debug.Log("PALLET_REVIEW_OK: 4 runtime images rendered including HUD; buildings, ground and route checked.");
        Application.Quit();
    }

    private void CaptureTownCamera(string path)
    {
        var target = new RenderTexture(1800,1200,24) { antiAliasing = 4 };
        var previous = RenderTexture.active;
        mainCamera.targetTexture = target;
        mainCamera.Render();
        RenderTexture.active = target;
        var image = new Texture2D(1800,1200,TextureFormat.RGB24,false);
        image.ReadPixels(new Rect(0,0,1800,1200),0,0);
        image.Apply();
        System.IO.File.WriteAllBytes(path,image.EncodeToPNG());
        mainCamera.targetTexture = null;
        RenderTexture.active = previous;
        target.Release();
        Destroy(target); Destroy(image);
    }

    private IEnumerator CaptureAshReview(string directory)
    {
        capturingTown = true;
        System.IO.Directory.CreateDirectory(directory);
        yield return null; yield return null;
        Physics.SyncTransforms();
        var body = ashAvatar.GetComponentInChildren<SkinnedMeshRenderer>();
        if (body == null || ashAvatar.BoneCount != 17) throw new Exception("Ash skinned model or skeleton is missing.");
        if (body.bounds.size.y < 1.7f || body.bounds.size.y > 2f) throw new Exception("Incorrect Ash model size: " + body.bounds.size);
        Debug.Log("ASH_IMPORT_OK: 17 bones; model bounds " + body.bounds.size);
        townOverview = false; thirdPerson = true; cameraYaw = 0; cameraPitch = 18;
        UpdateTownCameraMode();
        // Test the same movement function used by keyboard input, at fixed steps.
        TeleportPlayer(new Vector3(0,.15f,-1.5f));
        for(var i=0;i<30;i++) MovePlayer(Vector2.zero,false,false,1f/60);
        var start = player.transform.position;
        for(var i=0;i<60;i++) MovePlayer(Vector2.up,false,false,1f/60);
        var walkDistance = player.transform.position.z - start.z;
        if(walkDistance < 4f || walkDistance > 4.6f) throw new Exception("Ash walking failed: " + walkDistance);
        start = player.transform.position;
        float jumpPeak = start.y;
        for(var i=0;i<100;i++)
        {
            MovePlayer(Vector2.zero,false,i==0,1f/60);
            jumpPeak = Mathf.Max(jumpPeak,player.transform.position.y);
        }
        if(jumpPeak-start.y < 1f || !playerController.isGrounded) throw new Exception("Ash jump or landing failed.");
        TeleportPlayer(new Vector3(0,.1f,4));
        for(var i=0;i<30;i++)MovePlayer(Vector2.zero,false,false,1f/60);
        start=player.transform.position;
        for(var i=0;i<60;i++)MovePlayer(Vector2.up,true,false,1f/60);
        var runDistance=player.transform.position.z-start.z;
        if(runDistance<6.5f || runDistance>7.1f)throw new Exception("Ash running failed: "+runDistance);
        // Walk toward a house: the controller must stop at its wall.
        TeleportPlayer(new Vector3(-9,.1f,4.5f)); cameraYaw=0;
        for(var i=0;i<100;i++)MovePlayer(Vector2.up,false,false,1f/60);
        if(player.transform.position.z>6.1f)throw new Exception("Player passed through house wall.");
        cameraYaw=180;resolvedCameraDistance=thirdPersonDistance;Physics.SyncTransforms();UpdateCameraFollow();
        if(resolvedCameraDistance>1.2f)throw new Exception("Third-person camera failed wall obstruction test.");
        Debug.Log("ASH_MOVEMENT_OK: walk="+walkDistance+" run="+runDistance+" jump="+(jumpPeak-start.y)+"; building and camera collision passed.");
        TeleportPlayer(new Vector3(0,.1f,-1.5f));
        for(var i=0;i<30;i++)MovePlayer(Vector2.zero,false,false,1f/60);
        player.transform.rotation=Quaternion.identity; ashAvatar.ResetPose();
        cameraYaw=0;cameraPitch=18;UpdateTownCameraMode();UpdateCameraFollow();
        CaptureTownCamera(System.IO.Path.Combine(directory,"ash-third-person.png"));
        var mode=hudCanvas.renderMode;
        hudCanvas.renderMode=RenderMode.ScreenSpaceCamera;hudCanvas.worldCamera=mainCamera;hudCanvas.planeDistance=.4f;
        Canvas.ForceUpdateCanvases();
        CaptureTownCamera(System.IO.Path.Combine(directory,"ash-gameplay.png"));
        hudCanvas.renderMode=mode;
        mainCamera.fieldOfView=35f;
        var centre=player.transform.position+Vector3.up*.95f;
        mainCamera.transform.position=player.transform.position+new Vector3(1.7f,1.35f,3.8f);
        mainCamera.transform.LookAt(centre);
        CaptureTownCamera(System.IO.Path.Combine(directory,"ash-front.png"));
        var restMesh=new Mesh();body.BakeMesh(restMesh);
        var restVertices=restMesh.vertices;
        ashAvatar.Animate(6.8f,true,0,.35f);
        yield return null;
        var posedMesh=new Mesh();body.BakeMesh(posedMesh);
        var posedVertices=posedMesh.vertices;
        var maxDisplacement=0f;
        for(var i=0;i<restVertices.Length;i++)maxDisplacement=Mathf.Max(maxDisplacement,Vector3.Distance(restVertices[i],posedVertices[i]));
        if(maxDisplacement<.05f)throw new Exception("Ash bones did not deform the skinned mesh.");
        Debug.Log("ASH_SKINNING_OK: run-pose vertex displacement="+maxDisplacement);
        Destroy(restMesh);Destroy(posedMesh);
        CaptureTownCamera(System.IO.Path.Combine(directory,"ash-run-pose.png"));
        ashAvatar.ResetPose();
        // Third-person state and visible avatar must survive both directions.
        yield return SwitchMap(transitionPoints[0]);
        if(currentMap!=WorldMap.Trail || !thirdPerson || !ashAvatar.gameObject.activeSelf || mainCamera.orthographic)throw new Exception("Third-person state lost on Trail.");
        yield return null;
        yield return SwitchMap(transitionPoints[0]);
        yield return null;
        if(currentMap!=WorldMap.Town || !thirdPerson || !ashAvatar.gameObject.activeSelf)throw new Exception("Ash return to Pallet Town failed.");
        Debug.Log("ASH_REVIEW_OK: runtime portraits, third-person view, controls, collisions and map roundtrip passed.");
        Application.Quit();
    }

    private void ValidateTownLayout()
    {
        foreach(var position in new[]{new Vector3(-1,0,1),new Vector3(0,0,18),new Vector3(0,0,23.5f),new Vector3(6,0,-10.8f)})
        {
            if(!Physics.Raycast(position+Vector3.up*3,Vector3.down,out var hit,5)) throw new Exception("Town floor missing at "+position);
            if(Mathf.Abs(hit.point.y)>.25f) throw new Exception("Town path obstructed at "+position);
        }
        if(Vector3.Distance(transitionPoints[0].Position,new Vector3(0,0,18))<3f) throw new Exception("Town return point overlaps exit.");
        if(worldNpcs.Count!=3) throw new Exception("Town NPCs missing.");
        for(var z = 2; z <= 23; z++)
            if(Physics.CheckCapsule(new Vector3(0,.42f,z),new Vector3(0,1.5f,z),.29f)) throw new Exception("Northern path blocked at z="+z);
        foreach(var npc in worldNpcs.Values)
        {
            if(!Physics.Raycast(npc.transform.position+Vector3.up*4,Vector3.down,out var hit,5) || !hit.transform.IsChildOf(npc.transform)) throw new Exception("NPC is hidden inside scenery: "+npc.name);
        }
        Debug.Log("PALLET_LAYOUT_OK: walkable spawn, save point, north exit and non-overlapping return point; 3 NPCs.");
    }

    private void HandleWorldClick()
    {
        var leftClick = Input.GetMouseButtonDown(0);
        var rightClick = Input.GetMouseButtonDown(1);
        if (!leftClick && !rightClick) return;
        if (rightClick && thirdPerson) return;
        if (EventSystem.current != null && EventSystem.current.IsPointerOverGameObject()) return;
        var ray = mainCamera.ScreenPointToRay(Input.mousePosition);
        var hits = Physics.RaycastAll(ray, 80f);
        Array.Sort(hits, (first, second) => first.distance.CompareTo(second.distance));
        if (hits.Length == 0) return;
        for (var hitIndex = 0; hitIndex < hits.Length; hitIndex++)
        {
            var hit = hits[hitIndex];
            var interactable = hit.collider.GetComponentInParent<WorldInteractable>();
            if (interactable != null)
            {
                if (!leftClick) return;
                SelectInteractable(interactable);
                return;
            }
            var block = hit.collider.GetComponent<VoxelBlock>();
            if (block != null)
            {
                if (leftClick) BreakVoxelBlock(block);
                else PlaceVoxelBlock(block, hit.normal);
                return;
            }
        }
    }

    private void SelectInteractable(WorldInteractable interactable)
    {
        if (openWorldEnabled && Vector3.Distance(interactable.transform.position, player.transform.position) > 5f) return;
        selectedInteractable = interactable;
        selectedNpcDialog = null;
        if (!string.IsNullOrEmpty(interactable.CreatureId))
        {
            var creature = CreatureCatalog.Find(interactable.CreatureId);
            selectedInteractable = interactable;
            selectedNpcObject = null;
            ShowCreatureSelection(creature);
        }
        else if (!string.IsNullOrEmpty(interactable.NpcId))
        {
            selectedNpcObject = worldNpcs.ContainsKey(interactable.NpcId) ? worldNpcs[interactable.NpcId] : null;
            var npc = FindNpc(interactable.NpcId);
            selectedNpcDialog = npc.Dialog;
            selectedInteractable = interactable;
            selectedNpcObject = worldNpcs[interactable.NpcId];
        }
    }

    private void ShowCreatureSelection(CreatureDefinition creature)
    {
        if (creature == null) return;
        var selectedVisual = worldCreatures.ContainsKey(creature.Id) ? worldCreatures[creature.Id] : null;
        if (selectedVisual != null)
        {
            for (var index = 0; index < selectedVisual.transform.childCount; index++)
            {
                var child = selectedVisual.transform.GetChild(index);
                if (child.name == "Selection ring") child.gameObject.SetActive(true);
            }
        }
        selectedNpcDialog = null;
    }

    private void CheckNearbyWorldObjects()
    {
        if (player == null) return;
        if (savePointObject != null && currentMap == WorldMap.Town)
        {
            saveAvailable = Vector3.Distance(player.transform.position, savePointPosition) < 2.8f;
        }
        else saveAvailable = false;

        for (var index = 0; index < transitionPoints.Count; index++)
        {
            if (Vector3.Distance(player.transform.position, transitionPoints[index].Position) < 2.2f)
            {
                StartCoroutine(SwitchMap(transitionPoints[index]));
                return;
            }
        }

        if (currentMap == WorldMap.Town) return;
        foreach (var pair in worldCreatures)
        {
            if (!pair.Value.activeSelf) continue;
            if (Vector3.Distance(player.transform.position, pair.Value.transform.position) < 1.8f)
            {
                var creature = CreatureCatalog.Find(pair.Key);
                StartBattle(creature, false);
                return;
            }
        }
    }

    private IEnumerator SwitchMap(TransitionPoint transition)
    {
        if (transitionBusy) yield break;
        transitionBusy = true;
        SetNotice(transition.Label);
        yield return Fade(1f, .22f);
        currentMap = transition.Target;
        TeleportPlayer(transition.Entry);
        BuildMap();
        yield return Fade(0f, .38f);
        transitionBusy = false;
    }

    private void TeleportPlayer(Vector3 position)
    {
        if (playerController != null) playerController.enabled = false;
        player.transform.position = position;
        verticalVelocity = 0f;
        if (playerController != null) playerController.enabled = true;
    }

    private IEnumerator Fade(float alpha, float duration)
    {
        if (fadeGroup == null) yield break;
        var start = fadeGroup.alpha;
        var elapsed = 0f;
        while (elapsed < duration)
        {
            elapsed += Time.unscaledDeltaTime;
            fadeGroup.alpha = Mathf.Lerp(start, alpha, elapsed / duration);
            yield return null;
        }
        fadeGroup.alpha = alpha;
    }

    private void StartBattle(CreatureDefinition creature, bool trainerBattle)
    {
        if (creature == null || currentBattle != null) return;
        if (!trainerBattle && (!creature.IsWild || caughtIds.Contains(creature.Id) || defeatedIds.Contains(creature.Id))) return;
        if (!trainerBattle && worldCreatures.ContainsKey(creature.Id) && !openWorldEnabled) worldCreatures[creature.Id].SetActive(false);
        mouseLookCaptured = false;
        Cursor.lockState = CursorLockMode.None;
        Cursor.visible = true;
        currentBattle = new BattleRuntime
        {
            Enemy = creature,
            IsTrainer = trainerBattle,
            EnemyHp = creature.MaxHp,
            PlayerMaxHp = ActiveCreature.MaxHp + playerLevel * 3,
            PlayerHp = ActiveCreature.MaxHp + playerLevel * 3,
            Message = trainerBattle ? "路线训练师发起了挑战！" : creature.Name + " 出现了！",
            Result = BattleResult.None,
        };
        selectedInteractable = null;
        selectedNpcDialog = null;
        battlePanel.SetActive(true);
        BuildBattleScene();
        SetNotice("");
        UpdateBattleHud();
    }

    private void AttackEnemy()
    {
        if (currentBattle == null || currentBattle.Busy || currentBattle.Result != BattleResult.None) return;
        currentBattle.Busy = true;
        if(battleScene!=null){UpdateBattleHud();StartCoroutine(PlayBattleAttack(true));return;}
        var damage = ActiveCreature.Attack + playerLevel + UnityEngine.Random.Range(0, 4);
        currentBattle.EnemyHp = Mathf.Max(0, currentBattle.EnemyHp - damage);
        currentBattle.Message = ActiveCreature.Name + " 发起攻击，造成 " + damage + " 点伤害。";
        UpdateBattleHud();
        StartCoroutine(AfterPlayerAction(currentBattle.EnemyHp <= 0));
    }

    private IEnumerator AfterPlayerAction(bool defeated)
    {
        yield return new WaitForSecondsRealtime(.55f);
        if (currentBattle == null) yield break;
        if (defeated)
        {
            FinishBattle(BattleResult.Defeated);
            yield break;
        }
        EnemyTurn();
    }

    private void EnemyTurn()
    {
        if (currentBattle == null) return;
        if(battleScene!=null){currentBattle.Busy=true;UpdateBattleHud();StartCoroutine(PlayBattleAttack(false));return;}
        var damage = Mathf.Max(2, currentBattle.Enemy.Attack + UnityEngine.Random.Range(-1, 3));
        currentBattle.PlayerHp = Mathf.Max(0, currentBattle.PlayerHp - damage);
        if (currentBattle.PlayerHp <= 0)
        {
            currentBattle.Message = IsChinese ? "伙伴体力耗尽，回到小镇休息吧。" : "Your partner needs a rest. Return to town when ready.";
            FinishBattle(BattleResult.Lost);
        }
        else
        {
            currentBattle.Message = currentBattle.Enemy.Name + " 反击，造成 " + damage + " 点伤害。";
            currentBattle.Busy = false;
            UpdateBattleHud();
        }
    }

    private void CaptureEnemy()
    {
        if (currentBattle == null || currentBattle.Busy || currentBattle.Result != BattleResult.None || currentBattle.IsTrainer) return;
        currentBattle.Busy = true;
        currentBattle.CaptureAttempts++;
        var weakened = currentBattle.EnemyHp <= currentBattle.Enemy.MaxHp * .58f;
        var success = weakened || currentBattle.CaptureAttempts >= 2;
        currentBattle.Message = openWorldEnabled ? "投出了精灵球！" : success ? currentBattle.Enemy.Name + " 被捕捉晶球的光包围了！" : currentBattle.Enemy.Name + " 从晶球中挣脱了！";
        UpdateBattleHud();
        StartCoroutine(AfterCapture(success));
    }

    private IEnumerator AfterCapture(bool success)
    {
        if(battleScene!=null)yield return battleScene.Capture(success);
        else yield return new WaitForSecondsRealtime(.65f);
        if (currentBattle == null) yield break;
        if (success) FinishBattle(BattleResult.Captured);
        else
        {
            if(openWorldEnabled){currentBattle.Message=currentBattle.Enemy.Name+" 从精灵球中挣脱了！";UpdateBattleHud();yield return new WaitForSecondsRealtime(.35f);}
            EnemyTurn();
        }
    }

    private void EscapeBattle()
    {
        if (currentBattle == null || currentBattle.Busy || currentBattle.Result != BattleResult.None) return;
        currentBattle.Message = IsChinese ? "你安全地离开了遭遇。" : "You safely left the encounter.";
        FinishBattle(BattleResult.Escaped);
    }

    private void FinishBattle(BattleResult result)
    {
        if (currentBattle == null) return;
        currentBattle.Result = result;
        currentBattle.Busy = false;
        if (result == BattleResult.Captured)
        {
            caughtIds.Add(currentBattle.Enemy.Id);
            GainExperience(18);
            battleWins++;
            currentBattle.Message = currentBattle.Enemy.Name + " 加入了你的图鉴！";
        }
        else if (result == BattleResult.Defeated)
        {
            if (!currentBattle.IsTrainer) defeatedIds.Add(currentBattle.Enemy.Id);
            GainExperience(currentBattle.IsTrainer ? 24 : 12);
            battleWins++;
            currentBattle.Message = currentBattle.IsTrainer ? "训练师战斗胜利，伙伴获得了大量经验。" : currentBattle.Enemy.Name + " 已退回森林。";
        }
        if (openWorldEnabled && (result == BattleResult.Captured || result == BattleResult.Defeated) && !currentBattle.IsTrainer && worldCreatures.TryGetValue(currentBattle.Enemy.Id, out var fieldCreature)) fieldCreature.SetActive(false);
        UpdateBattleHud();
    }

    private void ReturnToWorld()
    {
        if (currentBattle == null || currentBattle.Result == BattleResult.None) return;
        ClearBattleScene();
        var result = currentBattle.Result;
        if (result == BattleResult.Lost)
        {
            currentMap = WorldMap.Town;
            TeleportPlayer(new Vector3(0f, 0f, 8f));
            if (!openWorldEnabled) BuildMap();
        }
        else if (!currentBattle.IsTrainer && result == BattleResult.Escaped && worldCreatures.ContainsKey(currentBattle.Enemy.Id))
        {
            worldCreatures[currentBattle.Enemy.Id].SetActive(true);
        }
        currentBattle = null;
        battlePanel.SetActive(false);
        selectedInteractable = null;
        UpdateHud(true);
    }

    private void GainExperience(int amount)
    {
        playerExperience += amount;
        while (playerExperience >= ExperienceToNext)
        {
            playerExperience -= ExperienceToNext;
            playerLevel++;
            SetNotice("升级！等级 " + playerLevel);
        }
    }

    private void SaveGame()
    {
        if (openWorldEnabled) { SaveExpeditionProgress(); return; }
        if (!saveAvailable || currentMap != WorldMap.Town) return;
        var data = new SaveData
        {
            Map = (int)currentMap,
            PlayerX = player.transform.position.x,
            PlayerZ = player.transform.position.z,
            Level = playerLevel,
            Experience = playerExperience,
            BattleWins = battleWins,
            Caught = string.Join("|", new List<string>(caughtIds)),
            Defeated = string.Join("|", new List<string>(defeatedIds)),
        };
        PlayerPrefs.SetString(SaveKey, JsonUtility.ToJson(data));
        PlayerPrefs.Save();
        SetNotice(IsChinese ? "进度已保存" : "Progress saved");
    }

    private void LoadProgress()
    {
        if (!PlayerPrefs.HasKey(SaveKey)) return;
        try
        {
            var data = JsonUtility.FromJson<SaveData>(PlayerPrefs.GetString(SaveKey));
            currentMap = Enum.IsDefined(typeof(WorldMap), data.Map) ? (WorldMap)data.Map : WorldMap.Town;
            savedPlayerPosition = new Vector3(data.PlayerX, 0f, data.PlayerZ);
            playerLevel = Mathf.Max(1, data.Level);
            playerExperience = Mathf.Max(0, data.Experience);
            battleWins = Mathf.Max(0, data.BattleWins);
            AddIds(caughtIds, data.Caught);
            AddIds(defeatedIds, data.Defeated);
        }
        catch (Exception)
        {
            PlayerPrefs.DeleteKey(SaveKey);
        }
    }

    private void AddIds(HashSet<string> destination, string serialized)
    {
        if (string.IsNullOrEmpty(serialized)) return;
        var ids = serialized.Split('|');
        for (var index = 0; index < ids.Length; index++)
        {
            if (CreatureCatalog.Find(ids[index]) != null) destination.Add(ids[index]);
        }
    }

    private void AnimateWorld()
    {
        var elapsed = Time.time;
        AnimateSkySteps(elapsed);
        AnimateSkyDetails(elapsed);
        foreach (var pair in worldCreatures)
        {
            if (!pair.Value.activeSelf) continue;
            var bob = Mathf.Sin(elapsed * 1.5f + pair.Key.Length) * .06f;
            pair.Value.transform.localPosition = new Vector3(pair.Value.transform.localPosition.x, bob, pair.Value.transform.localPosition.z);
            pair.Value.transform.Rotate(Vector3.up, Mathf.Sin(elapsed * .7f + pair.Key.Length) * .02f);
            for (var index = 0; index < pair.Value.transform.childCount; index++)
            {
                if (pair.Value.transform.GetChild(index).name == "Selection ring") pair.Value.transform.GetChild(index).Rotate(Vector3.up, Time.deltaTime * 36f);
            }
        }
    }

    private void AnimateSkyDetails(float elapsed)
    {
        var beaconPulse = 1f + Mathf.Sin(elapsed * 2.2f) * .1f;
        if (skyBeaconCore != null) skyBeaconCore.localScale = Vector3.one * beaconPulse;
        if (skyBeaconHalo != null) skyBeaconHalo.Rotate(Vector3.up, Time.deltaTime * 22f, Space.Self);
        if (skyGateCrown != null) skyGateCrown.localScale = Vector3.one * (1f + Mathf.Sin(elapsed * 1.7f + 1f) * .08f);
        for (var index = 0; index < skyCrystals.Count; index++)
        {
            var crystal = skyCrystals[index];
            crystal.Transform.localPosition = crystal.StartPosition + Vector3.up * Mathf.Sin(elapsed * 1.6f + crystal.Phase) * .08f;
            crystal.Transform.Rotate(Vector3.up, Time.deltaTime * (18f + index % 3 * 6f), Space.Self);
        }
        for (var index = 0; index < skyClouds.Count; index++)
        {
            var cloud = skyClouds[index];
            cloud.Transform.localPosition = cloud.StartPosition + Vector3.right * Mathf.Sin(elapsed * .08f + cloud.Phase) * .65f + Vector3.up * Mathf.Sin(elapsed * .12f + cloud.Phase) * .12f;
            cloud.Transform.localRotation = Quaternion.Euler(0f, Mathf.Sin(elapsed * .05f + cloud.Phase) * 4f, 0f);
        }
    }

    private void AnimateSkySteps(float elapsed)
    {
        for (var index = 0; index < skySteps.Count; index++)
        {
            var step = skySteps[index];
            var progress = Mathf.Clamp01((elapsed - skyStepSequenceStartedAt - step.Delay) / .72f);
            var eased = 1f - Mathf.Pow(1f - progress, 3f);
            var bounce = Mathf.Sin(progress * Mathf.PI) * .55f * (1f - progress);
            step.Transform.localPosition = Vector3.Lerp(step.StartPosition, step.TargetPosition, eased) + Vector3.up * bounce;
            var tilt = (1f - progress) * Mathf.Sin(progress * Mathf.PI * 2f) * 10f;
            step.Transform.localRotation = Quaternion.Euler(tilt, 0f, -tilt * .7f);
        }
    }

    private void UpdateHud(bool immediate)
    {
        if (openWorldEnabled) { UpdateExpeditionHud(); return; }
        hudRefreshAt = Time.unscaledTime + (immediate ? .08f : .18f);
        if (mapText == null) return;
        mapText.text = MapName(currentMap) + (currentMap == WorldMap.Town ? "  /  KANTO" : "");
        progressText.text = (IsChinese ? "伙伴 " : "Partner ") + ActiveCreature.Name + "\n" + (IsChinese ? "等级 " : "Lv. ") + playerLevel + "   EXP " + playerExperience + "/" + ExperienceToNext + "\n" + (IsChinese ? "捕捉 " : "Caught ") + caughtIds.Count + "   " + (IsChinese ? "胜场 " : "Wins ") + battleWins;
        introText.text = currentMap == WorldMap.Town ? "PALLET TOWN\n梦想与冒险，从这里开始。" : "前往草地，继续你的旅程。";
        if(controlsText != null) controlsText.text = "小智 · WASD 移动   Shift 跑步   空格跳跃   按住右键转镜头 / 滚轮缩放   E 对话   Tab 视角   F2 全镇   Esc 鼠标";
        infoPanel.SetActive(currentBattle == null && (currentMap != WorldMap.Town || selectedInteractable != null));
        savePanel.SetActive(saveAvailable && currentBattle == null);
        saveText.text = IsChinese ? "在研究所门前保存你的冒险" : "Save your adventure outside Oak's Lab";
        SetButton(saveButton, IsChinese ? "保存进度" : "Save", SaveGame, true);

        if (selectedNpcDialog != null && selectedInteractable != null)
        {
            var npc = FindNpc(selectedInteractable.NpcId);
            infoText.text = npc.Name + " · " + npc.Role + "\n\n" + selectedNpcDialog;
            if (npc.Id == "sora") SetButton(infoButton, IsChinese ? "挑战训练师" : "Challenge trainer", () => StartBattle(CreatureCatalog.Find("ember-mole"), true));
            else SetButton(infoButton, IsChinese ? "关闭对话" : "Close", () => { selectedNpcDialog = null; selectedInteractable = null; });
        }
        else if (selectedInteractable != null && !string.IsNullOrEmpty(selectedInteractable.CreatureId))
        {
            var creature = CreatureCatalog.Find(selectedInteractable.CreatureId);
            var status = caughtIds.Contains(creature.Id) ? "\n" + (IsChinese ? "已捕捉" : "Caught") : defeatedIds.Contains(creature.Id) ? "\n" + (IsChinese ? "已击败" : "Defeated") : "";
            infoText.text = creature.Name + " · " + creature.EnglishName + "\n" + creature.Description + "\n\n" + (IsChinese ? "属性：" : "Affinity: ") + creature.ElementLabel + "    " + (IsChinese ? "等级：" : "Lv. ") + creature.Level + status;
            if (string.IsNullOrEmpty(status) && creature.IsWild) SetButton(infoButton, IsChinese ? "进入战斗" : "Start battle", () => StartBattle(creature, false));
            else SetButton(infoButton, IsChinese ? "关闭图鉴" : "Close guide", () => { selectedInteractable = null; });
        }
        else
        {
            infoText.text = IsChinese ? "生物图鉴\n\n点击野外生物查看资料。靠近它会自动进入遭遇。\n\n完成循环：探索 → 战斗 → 捕捉或击败 → 获得经验 → 回镇保存。" : "FIELD GUIDE\n\nClick a wild creature to inspect it. Walk close to trigger an encounter.\n\nLoop: explore → battle → capture or defeat → gain EXP → return and save.";
            SetButton(infoButton, IsChinese ? "关闭" : "Close", () => { infoPanel.SetActive(false); });
        }
        if (noticeText != null && !string.IsNullOrEmpty(noticeText.text) && Time.unscaledTime > hudRefreshAt + 2f) noticeText.text = "";
    }

    private void UpdateBattleHud()
    {
        if (currentBattle == null) return;
        battleTitleText.text = (currentBattle.IsTrainer ? (IsChinese ? "训练师战斗" : "Trainer battle") : (IsChinese ? "野外遭遇" : "Wild encounter")) + " · " + (openWorldEnabled ? OpenWorldBuilder.Names[OpenWorldBuilder.Region(player.transform.position)] : MapName(currentMap));
        battleEnemyText.text = currentBattle.Enemy.Name + " · " + currentBattle.Enemy.EnglishName + "\n" + (IsChinese ? "等级 " : "Lv. ") + currentBattle.Enemy.Level + "\nHP  " + currentBattle.EnemyHp + " / " + currentBattle.Enemy.MaxHp;
        battlePartnerText.text = ActiveCreature.Name + "\n" + (IsChinese ? "你的伙伴 · 等级 " : "Your partner · Lv. ") + playerLevel + "\nHP  " + currentBattle.PlayerHp + " / " + currentBattle.PlayerMaxHp;
        battleMessageText.text = currentBattle.Message;
        battleActions.SetActive(currentBattle.Result == BattleResult.None);
        battleResultActions.SetActive(currentBattle.Result != BattleResult.None);
        SetButton(attackButton, openWorldEnabled ? "1  攻击" : IsChinese ? "攻击" : "Attack", AttackEnemy, currentBattle.Result == BattleResult.None && !currentBattle.Busy);
        SetButton(captureButton, openWorldEnabled ? "2  精灵球" : IsChinese ? "捕捉晶球" : "Capture orb", CaptureEnemy, currentBattle.Result == BattleResult.None && !currentBattle.Busy && !currentBattle.IsTrainer);
        SetButton(runButton, openWorldEnabled ? "3  离开战斗" : IsChinese ? "离开战斗" : "Run away", EscapeBattle, currentBattle.Result == BattleResult.None && !currentBattle.Busy);
        SetButton(returnButton, openWorldEnabled ? "Enter  继续探索" : IsChinese ? "返回世界" : "Return to world", ReturnToWorld, currentBattle.Result != BattleResult.None);
        if(openWorldEnabled&&currentBattle.Result==BattleResult.None)
        {
            attackButton.gameObject.SetActive(true);attackButton.interactable=!currentBattle.Busy;
            captureButton.gameObject.SetActive(!currentBattle.IsTrainer);captureButton.interactable=!currentBattle.Busy;
            runButton.gameObject.SetActive(true);runButton.interactable=!currentBattle.Busy;
        }
    }

    private void SetNotice(string message)
    {
        if (noticeText != null) noticeText.text = message;
        expeditionNoticeUntil = Time.unscaledTime + 4;
    }

    private string MapName(WorldMap map)
    {
        if (map == WorldMap.Town) return IsChinese ? "真新镇" : "Pallet Town";
        if (map == WorldMap.Trail) return IsChinese ? "风铃野路" : "Bellwind Trail";
        return IsChinese ? "苔光林地" : "Mossglow Grove";
    }

    private static readonly NpcData[] Npcs =
    {
        new NpcData("mira", "妈妈", "玩家家人", "欢迎回到真新镇。出发前记得去研究所看看。", WorldMap.Town, new Vector2(-7f, 3.5f), new Color(.9f, .56f, .44f)),
        new NpcData("orin", "大木博士", "宝可梦博士", "宝可梦和人类一起生活。研究所就在身后，北边的1号道路通往冒险。", WorldMap.Town, new Vector2(8f, -10.2f), new Color(.95f, .94f, .86f)),
        new NpcData("sora", "索拉", "路线训练师", "这条路尽头是苔光林地。你的伙伴会在每场战斗后获得经验。", WorldMap.Trail, new Vector2(7f, 3f), new Color(.68f, .52f, .82f)),
        new NpcData("rival", "小茂", "劲敌", "别磨蹭了，我会先一步成为最强的宝可梦训练家。", WorldMap.Town, new Vector2(7f, 3.3f), new Color(.55f, .3f, .42f)),
    };

    private sealed class NpcData
    {
        public readonly string Id;
        public readonly string Name;
        public readonly string Role;
        public readonly string Dialog;
        public readonly WorldMap Map;
        public readonly Vector2 Position;
        public readonly Color Color;

        public NpcData(string id, string name, string role, string dialog, WorldMap map, Vector2 position, Color color)
        {
            Id = id;
            Name = name;
            Role = role;
            Dialog = dialog;
            Map = map;
            Position = position;
            Color = color;
        }
    }

    private NpcData FindNpc(string id)
    {
        for (var index = 0; index < Npcs.Length; index++)
        {
            if (Npcs[index].Id == id) return Npcs[index];
        }
        return null;
    }

    private void OnDestroy()
    {
        DisposeExpeditionAssets();
        Cursor.lockState = CursorLockMode.None;
        Cursor.visible = true;
        if (mapRoot != null) Destroy(mapRoot.gameObject);
        if (hudCanvas != null) Destroy(hudCanvas.gameObject);
        if (player != null) Destroy(player);
    }
}
