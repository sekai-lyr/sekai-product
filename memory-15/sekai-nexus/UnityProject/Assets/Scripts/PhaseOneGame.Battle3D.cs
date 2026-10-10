using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public sealed partial class PhaseOneGame
{
    private PokemonBattleScene battleScene;
    private GameObject hiddenBattleWild;
    private readonly List<GameObject> hiddenExplorationHud=new List<GameObject>();
    private bool battleAshWasVisible;
    private void BuildBattleScene()
    {
        if(!openWorldEnabled||PokemonWildlife.Find(currentBattle.Enemy.Id)==null)return;
        foreach(Transform child in hudCanvas.transform)if(child.gameObject!=battlePanel&&child.gameObject.activeSelf){hiddenExplorationHud.Add(child.gameObject);child.gameObject.SetActive(false);}
        battleAshWasVisible=ashAvatar.gameObject.activeSelf;ashAvatar.gameObject.SetActive(false);
        Vector3 enemy=battleCameraAnchor;
        if(worldCreatures.TryGetValue(currentBattle.Enemy.Id,out hiddenBattleWild)){enemy=hiddenBattleWild.transform.position;hiddenBattleWild.SetActive(false);}
        var root=new GameObject("3D Pokemon battle");battleScene=root.AddComponent<PokemonBattleScene>();battleScene.Build(currentBattle.Enemy.Id,player.transform.position,enemy);
        mainCamera.transform.position=battleScene.CameraPosition;mainCamera.transform.LookAt(battleScene.Focus);
    }
    private void ClearBattleScene()
    {
        if(battleScene==null)return;
        foreach(var item in hiddenExplorationHud)if(item!=null)item.SetActive(true);hiddenExplorationHud.Clear();
        ashAvatar.gameObject.SetActive(battleAshWasVisible);
        if(hiddenBattleWild!=null && !caughtIds.Contains(currentBattle.Enemy.Id)&&!defeatedIds.Contains(currentBattle.Enemy.Id))hiddenBattleWild.SetActive(true);
        hiddenBattleWild=null;if(battleScene!=null){battleScene.gameObject.SetActive(false);Destroy(battleScene.gameObject);battleScene=null;}
    }
    private IEnumerator PlayBattleAttack(bool partner)
    {
        var battle=currentBattle;
        battle.Message=(partner?ActiveCreature.Name:battle.Enemy.Name)+" 使用了 "+battleScene.MoveName(partner)+"！";UpdateBattleHud();
        yield return battleScene.Attack(partner,()=>
        {
            int damage=partner?ActiveCreature.Attack+playerLevel+Random.Range(0,4):Mathf.Max(2,battle.Enemy.Attack+Random.Range(-1,3));
            if(partner)battle.EnemyHp=Mathf.Max(0,battle.EnemyHp-damage);else battle.PlayerHp=Mathf.Max(0,battle.PlayerHp-damage);
            battle.Message="命中！造成 "+damage+" 点伤害。";UpdateBattleHud();
        });
        if(battle!=currentBattle)yield break;
        bool defeated=partner?battle.EnemyHp<=0:battle.PlayerHp<=0;
        if(defeated){yield return battleScene.Knockout(partner);FinishBattle(partner?BattleResult.Defeated:BattleResult.Lost);yield break;}
        if(partner){yield return new WaitForSecondsRealtime(.22f);EnemyTurn();}
        else{battle.Busy=false;UpdateBattleHud();}
    }
}
