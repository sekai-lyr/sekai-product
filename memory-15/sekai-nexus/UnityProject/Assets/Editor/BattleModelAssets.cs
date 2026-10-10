#if UNITY_EDITOR
using UnityEditor;
using UnityEngine;

public static class BattleModelAssets
{
    public static void Prepare()
    {
        const string path="Assets/Resources/Characters/BattleCharmander.prefab";
        if(AssetDatabase.LoadAssetAtPath<GameObject>(path)!=null)return;
        var source=AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Generated/CharmanderReferenceLocked/CharmanderReferenceLocked.fbx");
        if(source==null)throw new System.InvalidOperationException("Reference-locked Charmander FBX is missing.");
        var instance=(GameObject)PrefabUtility.InstantiatePrefab(source);
        PrefabUtility.UnpackPrefabInstance(instance,PrefabUnpackMode.Completely,InteractionMode.AutomatedAction);
        PrefabUtility.SaveAsPrefabAsset(instance,path);Object.DestroyImmediate(instance);AssetDatabase.SaveAssets();
    }
}
#endif
