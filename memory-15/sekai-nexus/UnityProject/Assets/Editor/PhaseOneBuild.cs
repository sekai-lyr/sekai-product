#if UNITY_EDITOR
using System.IO;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEngine;

public static class PhaseOneBuild
{
    private const string ScenePath = "Assets/Scenes/PhaseOneWorld.unity";

    [MenuItem("Sekai/Build Phase One Windows")]
    public static void BuildWindows()
    {
        var outputDirectory = Path.Combine(Directory.GetParent(Application.dataPath).FullName, "Builds", "Windows");
        Directory.CreateDirectory(outputDirectory);
        var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions
        {
            scenes = new[] { ScenePath },
            locationPathName = Path.Combine(outputDirectory, "SekaiWilds.exe"),
            target = BuildTarget.StandaloneWindows64,
            options = BuildOptions.None,
        });
        Debug.Log("Phase One build result: " + report.summary.result + " | " + report.summary.totalSize + " bytes");
        if (report.summary.result != BuildResult.Succeeded)
        {
            throw new BuildFailedException("Phase One Windows build failed.");
        }
    }

    [MenuItem("Sekai/Build Kanto Open World Windows")]
    public static void BuildOpenWorld()
    {
        BattleModelAssets.Prepare();
        var directory = Path.Combine(Directory.GetParent(Application.dataPath).FullName, "Builds", "OpenWorldWindows");
        Directory.CreateDirectory(directory);
        var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions
        {
            scenes = new[] { ScenePath },
            locationPathName = Path.Combine(directory, "KantoJourney.exe"),
            target = BuildTarget.StandaloneWindows64,
            options = BuildOptions.None,
        });
        Debug.Log("OPEN_WORLD_BUILD: " + report.summary.result + " | " + report.summary.totalSize + " bytes");
        if (report.summary.result != BuildResult.Succeeded) throw new BuildFailedException("Open world build failed.");
    }
}
#endif
