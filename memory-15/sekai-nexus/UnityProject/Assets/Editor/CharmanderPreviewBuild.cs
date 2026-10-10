#if UNITY_EDITOR
using System.IO;
using UnityEditor;
using UnityEngine;

/// <summary>
/// 小火龙 · 图鉴考据版「拼装低模」批处理渲染截图（临摹学习用，不进游戏）
/// 调用：Unity.exe -batchmode -quit -projectPath <工程> -executeMethod CharmanderPreviewBuild.Capture
/// 输出：D:/Sekai_two/memory-15/charmander_preview.png
/// </summary>
public static class CharmanderPreviewBuild
{
    private const string OutPath = "D:/Sekai_two/memory-15/charmander_preview.png";

    [MenuItem("Sekai/Preview Charmander Study")]
    public static void Capture()
    {
        Cleanup();
        var root = new GameObject("CP_Root");
        var orange = Mat("CP_orange", new Color(0.933f, 0.490f, 0.165f));
        var cream = Mat("CP_cream", new Color(0.99f, 0.93f, 0.78f));
        var navy = Mat("CP_navy", new Color(0.145f, 0.16f, 0.28f));
        var white = Mat("CP_white", Color.white);
        var flameRed = Mat("CP_flame_red", new Color(0.97f, 0.35f, 0.12f));
        var flameOrg = Mat("CP_flame_orange", new Color(1f, 0.62f, 0.16f));
        var flameYll = Mat("CP_flame_yellow", new Color(1f, 0.85f, 0.35f));

        // ---- 身体（蛋形）与头部（大圆头）----
        Sphere("Body", new Vector3(0, 1.45f, 0), new Vector3(1.9f, 2.5f, 1.75f), Vector3.zero, orange);
        Sphere("Belly", new Vector3(0, 1.0f, 0.72f), new Vector3(1.15f, 1.1f, 0.75f), Vector3.zero, cream);
        Sphere("Head", new Vector3(0, 2.85f, 0.12f), new Vector3(1.75f, 1.7f, 1.8f), Vector3.zero, orange);

        // ---- 面部：双眼 + 白色高光 ----
        Sphere("EyeL", new Vector3(-0.44f, 3.08f, 0.98f), new Vector3(0.34f, 0.4f, 0.2f), Vector3.zero, navy);
        Sphere("EyeR", new Vector3(0.44f, 3.08f, 0.98f), new Vector3(0.34f, 0.4f, 0.2f), Vector3.zero, navy);
        Sphere("GlintL", new Vector3(-0.56f, 3.18f, 1.06f), new Vector3(0.13f, 0.15f, 0.09f), Vector3.zero, white);
        Sphere("GlintR", new Vector3(0.56f, 3.18f, 1.06f), new Vector3(0.13f, 0.15f, 0.09f), Vector3.zero, white);

        // ---- 四肢 ----
        Cylinder("ArmL", new Vector3(-1.0f, 2.15f, 0.35f), new Vector3(0.24f, 0.275f, 0.24f), Vector3.right * 90f, orange);
        Cylinder("ArmR", new Vector3(1.0f, 2.15f, 0.35f), new Vector3(0.24f, 0.275f, 0.24f), Vector3.right * 90f, orange);
        Cylinder("LegL", new Vector3(-0.42f, 0.3f, 0.1f), new Vector3(0.3f, 0.3f, 0.3f), Vector3.zero, orange);
        Cylinder("LegR", new Vector3(0.42f, 0.3f, 0.1f), new Vector3(0.3f, 0.3f, 0.3f), Vector3.zero, orange);

        // ---- 尾巴：后腰右下侧向后上方扬起 ----
        var tailDir = new Vector3(0f, 0.87f, -0.49f).normalized;
        CylinderAlong("Tail", new Vector3(0.55f, 1.8f, -0.7f), tailDir, new Vector3(0.2f, 0.88f, 0.2f), orange);

        // ---- 尾焰：三层叠球（红 / 橙 / 黄）从尾尖升起 ----
        Sphere("FlameRed", new Vector3(0.65f, 2.6f, -1.15f), new Vector3(0.85f, 1.0f, 0.85f), Vector3.zero, flameRed);
        Sphere("FlameOrg", new Vector3(0.68f, 2.9f, -1.28f), new Vector3(0.6f, 0.72f, 0.6f), Vector3.zero, flameOrg);
        Sphere("FlameYll", new Vector3(0.7f, 3.15f, -1.38f), new Vector3(0.32f, 0.45f, 0.32f), Vector3.zero, flameYll);

        // ---- 相机（3/4 视角，确保脸与尾焰同框）----
        var camGo = new GameObject("CP_Camera");
        var cam = camGo.AddComponent<Camera>();
        cam.clearFlags = CameraClearFlags.SolidColor;
        cam.backgroundColor = new Color(0.86f, 0.92f, 0.98f);
        cam.fieldOfView = 32f;
        camGo.transform.position = new Vector3(5.6f, 3.4f, 7.4f);
        camGo.transform.LookAt(new Vector3(0f, 2.1f, 0f));

        // ---- 渲染到 RenderTexture 并存 PNG（批处理可用）----
        var rt = new RenderTexture(1500, 1500, 24);
        cam.targetTexture = rt;
        cam.Render();
        RenderTexture.active = rt;
        var tex = new Texture2D(rt.width, rt.height, TextureFormat.RGB24, false);
        tex.ReadPixels(new Rect(0, 0, rt.width, rt.height), 0, 0);
        tex.Apply();
        RenderTexture.active = null;
        File.WriteAllBytes(OutPath, tex.EncodeToPNG());
        Debug.Log("Charmander preview saved: " + OutPath);
        Cleanup();
        Object.DestroyImmediate(rt);
        Object.DestroyImmediate(tex);
    }

    // ---------- helpers ----------

    private static void Cleanup()
    {
        foreach (var go in Object.FindObjectsByType<GameObject>(FindObjectsSortMode.None))
        {
            if (go.name.StartsWith("CP_")) Object.DestroyImmediate(go);
        }
    }

    private static Material Mat(string name, Color color)
    {
        var m = new Material(Shader.Find("Unlit/Color")) { name = name, color = color };
        return m;
    }

    private static GameObject Spawn(PrimitiveType type, string name)
    {
        var go = GameObject.CreatePrimitive(type);
        go.name = name;
        var col = go.GetComponent<Collider>();
        if (col != null) Object.DestroyImmediate(col);
        go.transform.SetParent(GameObject.Find("CP_Root").transform, false);
        return go;
    }

    private static void Sphere(string name, Vector3 pos, Vector3 scale, Vector3 euler, Material mat)
    {
        var go = Spawn(PrimitiveType.Sphere, name);
        go.transform.localPosition = pos;
        go.transform.localScale = scale;
        go.transform.localEulerAngles = euler;
        go.GetComponent<Renderer>().sharedMaterial = mat;
    }

    private static void Cylinder(string name, Vector3 pos, Vector3 scale, Vector3 euler, Material mat)
    {
        var go = Spawn(PrimitiveType.Cylinder, name);
        go.transform.localPosition = pos;
        go.transform.localScale = scale;
        go.transform.localEulerAngles = euler;
        go.GetComponent<Renderer>().sharedMaterial = mat;
    }

    private static void CylinderAlong(string name, Vector3 pos, Vector3 dir, Vector3 scale, Material mat)
    {
        var go = Spawn(PrimitiveType.Cylinder, name);
        go.transform.localPosition = pos;
        go.transform.localScale = scale;
        go.transform.rotation = Quaternion.FromToRotation(Vector3.up, dir);
        go.GetComponent<Renderer>().sharedMaterial = mat;
    }
}
#endif
