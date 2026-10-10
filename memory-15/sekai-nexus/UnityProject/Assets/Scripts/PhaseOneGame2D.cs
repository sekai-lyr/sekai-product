using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// 2D replacement for the original voxel prototype.
/// The old PhaseOneGame.cs is intentionally left in the project so the 3D
/// version can still be restored, but the active scene now uses this class.
/// </summary>
public sealed class PhaseOneGame2D : MonoBehaviour
{
    private const float WorldWidth = 32f;
    private const float WorldHeight = 22f;
    private const float PlayerSpeed = 5.2f;

    private sealed class PortalPoint
    {
        public Vector2 Position;
        public WorldMap Target;
        public Vector2 Entry;
        public string Label;
    }

    private readonly List<GameObject> worldObjects = new List<GameObject>();
    private readonly List<WorldInteractable> interactables = new List<WorldInteractable>();
    private readonly List<PortalPoint> portals = new List<PortalPoint>();

    private Camera worldCamera;
    private GameObject worldRoot;
    private GameObject player;
    private WorldMap currentMap = WorldMap.Town;
    private CreatureDefinition activeEncounter;
    private int activeEncounterHp;
    private string notice = "欢迎来到 2D 版本。靠近生物后按 E 开始遭遇。";
    private float noticeUntil;
    private Sprite squareSprite;
    private Sprite circleSprite;
    private Sprite charmanderSprite;
    private GUIStyle titleStyle;
    private GUIStyle bodyStyle;
    private GUIStyle smallStyle;

    private void Start()
    {
        Application.targetFrameRate = 60;
        SetupCamera();
        LoadCharmanderArt();
        GetCircleSprite();
        BuildWorld(Vector2.zero);
    }

    private void Update()
    {
        if (player == null) return;

        if (!IsBattleActive())
        {
            MovePlayer();
            UpdateCamera();

            if (Input.GetKeyDown(KeyCode.E) || Input.GetKeyDown(KeyCode.Space))
            {
                Interact();
            }
        }
    }

    private void SetupCamera()
    {
        worldCamera = Camera.main;
        if (worldCamera == null)
        {
            var cameraObject = new GameObject("2D World Camera");
            worldCamera = cameraObject.AddComponent<Camera>();
            cameraObject.tag = "MainCamera";
        }

        worldCamera.orthographic = true;
        worldCamera.orthographicSize = 8.2f;
        worldCamera.transform.position = new Vector3(0f, 0f, -20f);
        worldCamera.clearFlags = CameraClearFlags.SolidColor;
        worldCamera.backgroundColor = new Color(0.04f, 0.06f, 0.09f);
    }

    private void LoadCharmanderArt()
    {
        charmanderSprite = Resources.Load<Sprite>("Characters/Charmander2D");
    }

    private void BuildWorld(Vector2 playerEntry)
    {
        ClearWorld();
        portals.Clear();
        interactables.Clear();

        worldRoot = new GameObject("2D Overworld - " + currentMap);
        CreateMapBackdrop();
        CreateDecorations();
        CreatePortals();
        CreateMapCreatures();
        CreateGuideNpc();
        CreateCharmanderShowcase();
        CreatePlayer(playerEntry == Vector2.zero ? GetDefaultSpawn() : playerEntry);
        SetNotice("当前地图：" + GetMapName(currentMap) + "。方向键/WASD 移动，E 互动。", 5f);
    }

    private void ClearWorld()
    {
        if (worldRoot != null)
        {
            Destroy(worldRoot);
        }
        worldRoot = null;
        player = null;
        worldObjects.Clear();
    }

    private void CreateMapBackdrop()
    {
        CreateShape("Grass", Vector2.zero, new Vector2(WorldWidth, WorldHeight), new Color(0.16f, 0.36f, 0.23f), -20);
        CreateShape("Main Path", new Vector2(0f, -1f), new Vector2(WorldWidth - 2f, 2.1f), new Color(0.67f, 0.51f, 0.32f), -19);
        CreateShape("Cross Path", new Vector2(0f, 1.5f), new Vector2(2.1f, WorldHeight - 2f), new Color(0.67f, 0.51f, 0.32f), -19);
        CreateShape("Path Highlight", new Vector2(0f, -0.28f), new Vector2(WorldWidth - 2f, 0.24f), new Color(0.82f, 0.68f, 0.45f), -18);

        if (currentMap == WorldMap.Town)
        {
            CreateShape("Town Plaza", new Vector2(0f, 1.3f), new Vector2(8f, 4.4f), new Color(0.31f, 0.47f, 0.31f), -18);
            CreateShape("Town Water", new Vector2(-8.5f, 6.1f), new Vector2(8f, 2.2f), new Color(0.12f, 0.42f, 0.57f), -18);
        }
        else if (currentMap == WorldMap.Trail)
        {
            CreateShape("Trail Stream", new Vector2(-8f, 6.5f), new Vector2(7f, 2.6f), new Color(0.12f, 0.42f, 0.57f), -18);
            CreateShape("Trail Meadow", new Vector2(8f, 4.8f), new Vector2(7f, 4.1f), new Color(0.20f, 0.42f, 0.24f), -18);
        }
        else
        {
            CreateShape("Grove Pond", new Vector2(8.2f, 6.2f), new Vector2(6.2f, 2.5f), new Color(0.13f, 0.37f, 0.52f), -18);
            CreateShape("Grove Clearing", new Vector2(-7.5f, 5.5f), new Vector2(6.5f, 4.2f), new Color(0.26f, 0.44f, 0.28f), -18);
        }
    }

    private void CreateDecorations()
    {
        var treePositions = new[]
        {
            new Vector2(-13f, 8.6f), new Vector2(-10.5f, 8.9f), new Vector2(-5.8f, 8.4f),
            new Vector2(5.9f, 8.7f), new Vector2(10.2f, 8.4f), new Vector2(14f, 7.6f),
            new Vector2(-14f, -7.2f), new Vector2(-11.5f, -8.2f), new Vector2(5.5f, -8.2f),
            new Vector2(11f, -7.4f), new Vector2(14f, -6.5f)
        };

        for (var index = 0; index < treePositions.Length; index++)
        {
            CreateTree(treePositions[index]);
        }

        for (var index = 0; index < 12; index++)
        {
            var x = -14f + (index * 2.55f % 28f);
            var y = -5.8f + ((index * 1.83f) % 2.2f);
            CreateShape("Flower", new Vector2(x, y), new Vector2(0.16f, 0.16f), index % 2 == 0 ? new Color(1f, 0.76f, 0.45f) : new Color(0.84f, 0.58f, 0.9f), 0, circleSprite);
        }
    }

    private void CreateTree(Vector2 position)
    {
        CreateShape("Tree Trunk", position + new Vector2(0f, -0.45f), new Vector2(0.45f, 1.15f), new Color(0.28f, 0.16f, 0.10f), -2);
        CreateShape("Tree Crown", position + new Vector2(0f, 0.2f), new Vector2(1.7f, 1.7f), new Color(0.08f, 0.25f, 0.15f), -1, circleSprite);
        CreateShape("Tree Crown Light", position + new Vector2(-0.25f, 0.48f), new Vector2(0.8f, 0.68f), new Color(0.23f, 0.53f, 0.28f), 0, circleSprite);
    }

    private void CreatePortals()
    {
        if (currentMap == WorldMap.Town)
        {
            AddPortal(new Vector2(14.2f, -1f), WorldMap.Trail, new Vector2(-13f, -1f), "风铃野路");
        }
        else if (currentMap == WorldMap.Trail)
        {
            AddPortal(new Vector2(-14.2f, -1f), WorldMap.Town, new Vector2(12f, -1f), "晨露镇");
            AddPortal(new Vector2(14.2f, 1.5f), WorldMap.Grove, new Vector2(-12f, 1.5f), "苔光林地");
        }
        else
        {
            AddPortal(new Vector2(-14.2f, 1.5f), WorldMap.Trail, new Vector2(12f, 1.5f), "风铃野路");
        }
    }

    private void AddPortal(Vector2 position, WorldMap target, Vector2 entry, string label)
    {
        portals.Add(new PortalPoint { Position = position, Target = target, Entry = entry, Label = label });
        var portal = CreateShape("Portal to " + label, position, new Vector2(1.25f, 2.1f), new Color(0.28f, 0.76f, 0.94f), 1, circleSprite);
        var collider = portal.AddComponent<BoxCollider2D>();
        collider.isTrigger = true;
        CreateShape("Portal Glow", position, new Vector2(0.58f, 1.55f), new Color(0.73f, 0.94f, 1f), 2, circleSprite);
    }

    private void CreateMapCreatures()
    {
        if (currentMap == WorldMap.Town)
        {
            CreateCreature(CreatureCatalog.Charmander, new Vector2(4.7f, 1.9f), false);
            return;
        }

        for (var index = 0; index < CreatureCatalog.All.Length; index++)
        {
            var creature = CreatureCatalog.All[index];
            if (creature.IsWild && creature.SpawnMap == currentMap)
            {
                CreateCreature(creature, creature.SpawnPosition, true);
            }
        }
    }

    private void CreateCreature(CreatureDefinition definition, Vector2 position, bool wild)
    {
        var group = new GameObject(definition.EnglishName + " 2D");
        group.transform.SetParent(worldRoot.transform);
        group.transform.position = new Vector3(position.x, position.y, 0f);
        worldObjects.Add(group);

        if (definition.Id == "charmander" && charmanderSprite != null)
        {
            var art = group.AddComponent<SpriteRenderer>();
            art.sprite = charmanderSprite;
            art.color = Color.white;
            art.sortingOrder = 5;
            group.transform.localScale = new Vector3(0.18f, 0.18f, 1f);
            AddCreatureInteraction(group, definition, 0.55f);
            return;
        }

        var body = group.AddComponent<SpriteRenderer>();
        body.sprite = circleSprite;
        body.color = definition.BodyColor;
        body.sortingOrder = 5;
        group.transform.localScale = new Vector3(1.25f, 1.25f, 1f);

        var belly = CreateChildShape(group, "Belly", new Vector2(0f, -0.16f), new Vector2(0.68f, 0.55f), definition.AccentColor, 6, circleSprite);
        CreateChildShape(group, "Eye Left", new Vector2(-0.24f, 0.28f), new Vector2(0.15f, 0.22f), new Color(0.04f, 0.08f, 0.12f), 7, circleSprite);
        CreateChildShape(group, "Eye Right", new Vector2(0.24f, 0.28f), new Vector2(0.15f, 0.22f), new Color(0.04f, 0.08f, 0.12f), 7, circleSprite);
        CreateChildShape(group, "Accent", new Vector2(0f, 0.62f), new Vector2(0.22f, 0.24f), definition.AccentColor, 6, circleSprite);

        AddCreatureInteraction(group, definition, 0.72f);

        if (!wild)
        {
            CreateChildShape(group, "Starter Spark", new Vector2(0f, 0.92f), new Vector2(0.1f, 0.1f), new Color(1f, 0.87f, 0.36f), 8, circleSprite);
        }
    }

    private void AddCreatureInteraction(GameObject group, CreatureDefinition definition, float radius)
    {
        var interactable = group.AddComponent<WorldInteractable>();
        interactable.CreatureId = definition.Id;
        interactables.Add(interactable);
        var collider = group.AddComponent<CircleCollider2D>();
        collider.radius = radius;
    }

    private void CreateGuideNpc()
    {
        var npc = CreateShape("Guide NPC", new Vector2(-3.8f, 1.7f), new Vector2(0.78f, 1.15f), new Color(0.92f, 0.73f, 0.48f), 4, circleSprite);
        npc.AddComponent<BoxCollider2D>();
        var interactable = npc.AddComponent<WorldInteractable>();
        interactable.NpcId = "guide";
        interactables.Add(interactable);
        CreateChildShape(npc, "Guide Hat", new Vector2(0f, 0.55f), new Vector2(1.05f, 0.28f), new Color(0.30f, 0.55f, 0.87f), 5, circleSprite);
    }

    private void CreateCharmanderShowcase()
    {
        if (currentMap != WorldMap.Town || charmanderSprite == null) return;

        var showcase = new GameObject("Charmander2D Showcase");
        showcase.transform.SetParent(worldRoot.transform);
        showcase.transform.position = new Vector3(-6.4f, 1.5f, 0f);
        showcase.transform.localScale = new Vector3(0.48f, 0.48f, 1f);
        var renderer = showcase.AddComponent<SpriteRenderer>();
        renderer.sprite = charmanderSprite;
        renderer.sortingOrder = 3;
        worldObjects.Add(showcase);

        CreateShape("Showcase Ground", new Vector2(-6.4f, -0.18f), new Vector2(1.8f, 0.26f), new Color(0.07f, 0.16f, 0.11f), 2, circleSprite);
    }

    private void CreatePlayer(Vector2 position)
    {
        player = CreateShape("Player 2D", position, new Vector2(0.8f, 1.05f), new Color(0.97f, 0.88f, 0.58f), 10, circleSprite);
        CreateChildShape(player, "Player Coat", new Vector2(0f, -0.2f), new Vector2(0.72f, 0.78f), new Color(0.30f, 0.62f, 0.92f), 11, circleSprite);
        CreateChildShape(player, "Player Hair", new Vector2(0f, 0.44f), new Vector2(0.64f, 0.35f), new Color(0.16f, 0.10f, 0.08f), 12, circleSprite);
        player.AddComponent<CircleCollider2D>().radius = 0.5f;
    }

    private void MovePlayer()
    {
        var input = new Vector2(Input.GetAxisRaw("Horizontal"), Input.GetAxisRaw("Vertical"));
        if (input.sqrMagnitude > 1f) input.Normalize();

        var position = player.transform.position;
        position += new Vector3(input.x, input.y, 0f) * PlayerSpeed * Time.deltaTime;
        position.x = Mathf.Clamp(position.x, -WorldWidth * 0.5f + 0.7f, WorldWidth * 0.5f - 0.7f);
        position.y = Mathf.Clamp(position.y, -WorldHeight * 0.5f + 0.7f, WorldHeight * 0.5f - 0.7f);
        player.transform.position = position;
    }

    private void UpdateCamera()
    {
        var target = player.transform.position;
        target.z = -20f;
        worldCamera.transform.position = Vector3.Lerp(worldCamera.transform.position, target, 8f * Time.deltaTime);
    }

    private void Interact()
    {
        var portal = FindNearestPortal();
        if (portal != null)
        {
            currentMap = portal.Target;
            BuildWorld(portal.Entry);
            return;
        }

        var interactable = FindNearestInteractable();
        if (interactable == null)
        {
            SetNotice("附近没有可以互动的对象。", 2.5f);
            return;
        }

        if (!string.IsNullOrEmpty(interactable.NpcId))
        {
            SetNotice("向导：这版已经切成纯 2D，传送门和遭遇战都保留了。", 4f);
            return;
        }

        var creature = CreatureCatalog.Find(interactable.CreatureId);
        if (creature == null) return;

        activeEncounter = creature;
        activeEncounterHp = creature.MaxHp;
        SetNotice("遭遇了 " + creature.Name + "！", 3f);
    }

    private PortalPoint FindNearestPortal()
    {
        PortalPoint result = null;
        var nearestDistance = 1.65f;
        var playerPosition = (Vector2)player.transform.position;

        for (var index = 0; index < portals.Count; index++)
        {
            var distance = Vector2.Distance(playerPosition, portals[index].Position);
            if (distance < nearestDistance)
            {
                nearestDistance = distance;
                result = portals[index];
            }
        }

        return result;
    }

    private WorldInteractable FindNearestInteractable()
    {
        WorldInteractable result = null;
        var nearestDistance = 1.55f;
        var playerPosition = (Vector2)player.transform.position;

        for (var index = 0; index < interactables.Count; index++)
        {
            var candidate = interactables[index];
            if (candidate == null) continue;

            var distance = Vector2.Distance(playerPosition, candidate.transform.position);
            if (distance < nearestDistance)
            {
                nearestDistance = distance;
                result = candidate;
            }
        }

        return result;
    }

    private bool IsBattleActive()
    {
        return activeEncounter != null;
    }

    private void Attack()
    {
        if (!IsBattleActive()) return;

        var attack = CreatureCatalog.Charmander.Attack;
        activeEncounterHp = Mathf.Max(0, activeEncounterHp - attack);
        if (activeEncounterHp == 0)
        {
            SetNotice(activeEncounter.Name + " 被击退了。", 3f);
            activeEncounter = null;
        }
        else
        {
            SetNotice("造成了 " + attack + " 点伤害。", 2f);
        }
    }

    private void Capture()
    {
        if (!IsBattleActive()) return;

        SetNotice("你记录了 " + activeEncounter.Name + " 的图鉴信息。", 3f);
        activeEncounter = null;
    }

    private void RunAway()
    {
        if (!IsBattleActive()) return;

        SetNotice("你离开了遭遇区域。", 2f);
        activeEncounter = null;
    }

    private void SetNotice(string value, float seconds)
    {
        notice = value;
        noticeUntil = Time.time + seconds;
    }

    private Vector2 GetDefaultSpawn()
    {
        if (currentMap == WorldMap.Town) return new Vector2(0f, -2.6f);
        return new Vector2(0f, -5.8f);
    }

    private string GetMapName(WorldMap map)
    {
        if (map == WorldMap.Town) return "晨露镇";
        if (map == WorldMap.Trail) return "风铃野路";
        return "苔光林地";
    }

    private GameObject CreateShape(string objectName, Vector2 position, Vector2 size, Color color, int sortingOrder, Sprite sprite = null)
    {
        var shape = new GameObject(objectName);
        shape.transform.SetParent(worldRoot.transform);
        shape.transform.position = new Vector3(position.x, position.y, 0f);
        shape.transform.localScale = new Vector3(size.x, size.y, 1f);

        var renderer = shape.AddComponent<SpriteRenderer>();
        renderer.sprite = sprite == null ? GetSquareSprite() : sprite;
        renderer.color = color;
        renderer.sortingOrder = sortingOrder;
        worldObjects.Add(shape);
        return shape;
    }

    private GameObject CreateChildShape(GameObject parent, string objectName, Vector2 localPosition, Vector2 size, Color color, int sortingOrder, Sprite sprite)
    {
        var child = new GameObject(objectName);
        child.transform.SetParent(parent.transform);
        child.transform.localPosition = new Vector3(localPosition.x, localPosition.y, -0.01f);
        child.transform.localScale = new Vector3(size.x, size.y, 1f);

        var renderer = child.AddComponent<SpriteRenderer>();
        renderer.sprite = sprite;
        renderer.color = color;
        renderer.sortingOrder = sortingOrder;
        return child;
    }

    private Sprite GetSquareSprite()
    {
        if (squareSprite != null) return squareSprite;

        var texture = new Texture2D(2, 2, TextureFormat.RGBA32, false);
        texture.name = "Runtime 2D Square";
        texture.filterMode = FilterMode.Bilinear;
        texture.SetPixels(new[] { Color.white, Color.white, Color.white, Color.white });
        texture.Apply();
        squareSprite = Sprite.Create(texture, new Rect(0f, 0f, 2f, 2f), new Vector2(0.5f, 0.5f), 2f);
        return squareSprite;
    }

    private Sprite GetCircleSprite()
    {
        if (circleSprite != null) return circleSprite;

        const int size = 64;
        var texture = new Texture2D(size, size, TextureFormat.RGBA32, false);
        texture.name = "Runtime 2D Circle";
        texture.filterMode = FilterMode.Bilinear;
        var pixels = new Color[size * size];
        var center = (size - 1) * 0.5f;
        var radius = size * 0.5f - 1f;

        for (var y = 0; y < size; y++)
        {
            for (var x = 0; x < size; x++)
            {
                var distance = Vector2.Distance(new Vector2(x, y), new Vector2(center, center));
                pixels[(y * size) + x] = distance <= radius ? Color.white : Color.clear;
            }
        }

        texture.SetPixels(pixels);
        texture.Apply();
        circleSprite = Sprite.Create(texture, new Rect(0f, 0f, size, size), new Vector2(0.5f, 0.5f), size);
        return circleSprite;
    }

    private void OnGUI()
    {
        EnsureGuiStyles();

        GUI.Box(new Rect(18f, 18f, 365f, 112f), string.Empty);
        GUI.Label(new Rect(34f, 30f, 330f, 32f), "SEKAI NEXUS · 2D 探索版", titleStyle);
        GUI.Label(new Rect(34f, 66f, 330f, 24f), "地图：" + GetMapName(currentMap), bodyStyle);
        GUI.Label(new Rect(34f, 91f, 330f, 24f), "WASD/方向键移动 · E/空格互动", smallStyle);

        if (Time.time < noticeUntil)
        {
            GUI.Box(new Rect(18f, Screen.height - 86f, 520f, 54f), notice);
        }

        var nearbyPortal = player == null ? null : FindNearestPortal();
        var nearbyInteractable = player == null ? null : FindNearestInteractable();
        if (!IsBattleActive() && (nearbyPortal != null || nearbyInteractable != null))
        {
            var prompt = nearbyPortal != null ? "E：进入传送门 → " + nearbyPortal.Label : "E：与附近对象互动";
            GUI.Box(new Rect(Screen.width * 0.5f - 170f, Screen.height - 72f, 340f, 38f), prompt);
        }

        if (IsBattleActive())
        {
            DrawBattlePanel();
        }
    }

    private void DrawBattlePanel()
    {
        var panel = new Rect(Screen.width - 390f, 18f, 360f, 420f);
        GUI.Box(panel, string.Empty);
        GUI.Label(new Rect(panel.x + 20f, panel.y + 14f, 320f, 30f), "遭遇战 · " + activeEncounter.Name, titleStyle);
        GUI.Label(new Rect(panel.x + 20f, panel.y + 48f, 320f, 24f), activeEncounter.ElementLabel + "  Lv." + activeEncounter.Level, bodyStyle);

        if (charmanderSprite != null)
        {
            GUI.DrawTexture(new Rect(panel.x + 82f, panel.y + 76f, 195f, 185f), charmanderSprite.texture, ScaleMode.ScaleToFit, true);
        }

        GUI.Label(new Rect(panel.x + 20f, panel.y + 270f, 320f, 25f), "对方 HP：" + activeEncounterHp + " / " + activeEncounter.MaxHp, bodyStyle);
        GUI.Label(new Rect(panel.x + 20f, panel.y + 296f, 320f, 48f), activeEncounter.Description, smallStyle);
        if (GUI.Button(new Rect(panel.x + 20f, panel.y + 355f, 100f, 38f), "攻击")) Attack();
        if (GUI.Button(new Rect(panel.x + 130f, panel.y + 355f, 100f, 38f), "记录")) Capture();
        if (GUI.Button(new Rect(panel.x + 240f, panel.y + 355f, 100f, 38f), "逃跑")) RunAway();
    }

    private void EnsureGuiStyles()
    {
        if (titleStyle != null) return;

        titleStyle = new GUIStyle(GUI.skin.label)
        {
            fontSize = 20,
            fontStyle = FontStyle.Bold,
            normal = { textColor = Color.white }
        };
        bodyStyle = new GUIStyle(GUI.skin.label)
        {
            fontSize = 15,
            normal = { textColor = new Color(0.86f, 0.94f, 1f) }
        };
        smallStyle = new GUIStyle(GUI.skin.label)
        {
            fontSize = 13,
            wordWrap = true,
            normal = { textColor = new Color(0.76f, 0.84f, 0.9f) }
        };
    }
}
