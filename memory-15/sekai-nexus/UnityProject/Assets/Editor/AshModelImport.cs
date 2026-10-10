#if UNITY_EDITOR
using UnityEditor;

public sealed class AshModelImport : AssetPostprocessor
{
    private void OnPreprocessModel()
    {
        if (!assetPath.EndsWith("/Characters/Ash/AshKetchum.fbx")) return;
        var model = (ModelImporter)assetImporter;
        model.globalScale = 1f;
        model.useFileScale = true;
        model.bakeAxisConversion = true;
        model.importAnimation = false;
        model.animationType = ModelImporterAnimationType.Generic;
        model.optimizeGameObjects = false;
        model.isReadable = true;
        model.materialImportMode = ModelImporterMaterialImportMode.ImportStandard;
    }
}
#endif
