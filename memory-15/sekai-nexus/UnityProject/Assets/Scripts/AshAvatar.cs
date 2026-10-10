using System;
using System.Collections.Generic;
using UnityEngine;

// Drives the imported Blender skeleton. The mesh is skinned, not assembled limbs.
public sealed class AshAvatar : MonoBehaviour
{
    private sealed class Joint
    {
        public Transform Bone;
        public Quaternion Rest;
        public Vector3 BendAxis;
    }

    private readonly Dictionary<string, Joint> joints = new Dictionary<string, Joint>();
    private readonly List<Material> ownedMaterials = new List<Material>();
    private float phase;
    private float stride;
    public int BoneCount { get { return joints.Count; } }
    public GameObject Model { get; private set; }

    public static AshAvatar Create(Transform parent)
    {
        var prefab = Resources.Load<GameObject>("Characters/Ash/AshKetchum");
        if (prefab == null) throw new InvalidOperationException("AshKetchum.fbx has not been imported.");
        var holder = new GameObject("Ash Ketchum Avatar");
        holder.transform.SetParent(parent, false);
        var avatar = holder.AddComponent<AshAvatar>();
        avatar.Model = Instantiate(prefab, holder.transform, false);
        avatar.Model.name = "AshKetchum";
        // FBX bake-axis import retains the model facing -Z; gameplay faces +Z.
        avatar.Model.transform.localRotation = Quaternion.Euler(0, 180f, 0);
        avatar.Prepare();
        return avatar;
    }

    private void Prepare()
    {
        var importedAnimator = Model.GetComponent<Animator>();
        if (importedAnimator != null) importedAnimator.enabled = false;
        var shader = Resources.Load<Shader>("AshCharacter");
        var materials = new Dictionary<string, Material>();
        foreach (var renderer in Model.GetComponentsInChildren<Renderer>())
        {
            var slots = renderer.sharedMaterials;
            for (int i = 0; i < slots.Length; i++)
            {
                var sourceName = slots[i] != null ? slots[i].name : "ASH_Skin";
                if (!materials.TryGetValue(sourceName, out var material))
                {
                    material = new Material(shader) { name = sourceName, color = MaterialColor(sourceName) };
                    materials.Add(sourceName, material);
                    ownedMaterials.Add(material);
                }
                slots[i] = material;
            }
            renderer.sharedMaterials = slots;
            renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.On;
            if (renderer is SkinnedMeshRenderer skin) skin.updateWhenOffscreen = true;
        }
        foreach (var bone in Model.GetComponentsInChildren<Transform>())
        {
            var name = bone.name.Replace('_', '.');
            if (name == "Root" || name == "Hips" || name == "Spine" || name == "Neck" || name == "Head" || name.StartsWith("Thigh.") || name.StartsWith("Shin.") || name.StartsWith("Foot.") || name.StartsWith("UpperArm.") || name.StartsWith("Forearm.") || name.StartsWith("Hand."))
                joints[name] = new Joint { Bone = bone, Rest = bone.localRotation, BendAxis = bone.InverseTransformDirection(transform.right).normalized };
        }
        if (joints.Count != 17) throw new InvalidOperationException("Expected 17 Ash bones; imported " + joints.Count);
    }

    public void Animate(float speed, bool grounded, float verticalSpeed, float deltaTime)
    {
        var target = Mathf.Clamp01(speed / 4.3f);
        stride = Mathf.MoveTowards(stride, target, deltaTime * 5f);
        phase += deltaTime * Mathf.Lerp(6f, 13f, Mathf.Clamp01(speed / 6.8f));
        float swing = Mathf.Sin(phase), opposite = -swing;
        float amplitude = Mathf.Lerp(26f, 43f, Mathf.Clamp01((speed - 3.8f) / 3f)) * stride;
        Bend("Thigh.L", swing * amplitude);
        Bend("Thigh.R", opposite * amplitude);
        Bend("Shin.L", Mathf.Max(0, swing) * 48f * stride);
        Bend("Shin.R", Mathf.Max(0, opposite) * 48f * stride);
        Bend("Foot.L", -Mathf.Max(0, swing) * 15f * stride);
        Bend("Foot.R", -Mathf.Max(0, opposite) * 15f * stride);
        Bend("UpperArm.L", -swing * amplitude * .72f);
        Bend("UpperArm.R", -opposite * amplitude * .72f);
        Bend("Forearm.L", -12f - Mathf.Max(0, opposite) * 28f * stride);
        Bend("Forearm.R", -12f - Mathf.Max(0, swing) * 28f * stride);
        Bend("Spine", Mathf.Sin(Time.time * 1.7f) * .8f - stride * 4f);
        if (!grounded)
        {
            Bend("Thigh.L", -18f); Bend("Thigh.R", 12f);
            Bend("Shin.L", 32f); Bend("Shin.R", 38f);
            Bend("UpperArm.L", verticalSpeed > 0 ? -40f : -20f);
            Bend("UpperArm.R", verticalSpeed > 0 ? -40f : -20f);
        }
    }

    private void Bend(string name, float degrees)
    {
        if (joints.TryGetValue(name, out var joint))
            joint.Bone.localRotation = joint.Rest * Quaternion.AngleAxis(degrees, joint.BendAxis);
    }

    public void ResetPose()
    {
        foreach (var joint in joints.Values) joint.Bone.localRotation = joint.Rest;
        stride = 0;
    }

    private static Color MaterialColor(string name)
    {
        string hex;
        if (name.Contains("Highlight")) hex = "FFFFFF";
        else if (name.Contains("Skin")) hex = "F0B98E";
        else if (name.Contains("Hair")) hex = "202C34";
        else if (name.Contains("Denim")) hex = "83B1D1";
        else if (name.Contains("Blue")) hex = "2573B6";
        else if (name.Contains("White")) hex = "F1EFE1";
        else if (name.Contains("Red")) hex = "D84436";
        else if (name.Contains("Gold")) hex = "EFB74B";
        else if (name.Contains("Green")) hex = "44875D";
        else if (name.Contains("Pack")) hex = "668B51";
        else if (name.Contains("Dark")) hex = "24433E";
        else if (name.Contains("Sole")) hex = "DCE3D6";
        else if (name.Contains("Brown")) hex = "674731";
        else if (name.Contains("Iris")) hex = "6D4530";
        else hex = "18222C";
        ColorUtility.TryParseHtmlString("#" + hex, out var color);
        return color;
    }

    private void OnDestroy()
    {
        foreach (var material in ownedMaterials) if (material != null) Destroy(material);
    }
}
