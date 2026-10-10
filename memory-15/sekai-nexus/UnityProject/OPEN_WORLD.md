# 关都之旅 / Kanto Journey

Windows / Unity 6000.3.23f1，内置渲染管线。非官方宝可梦同人探索原型。

## 本次范围

把原来的真新镇、方块野路和林地切图玩法，扩展为一张 768 × 768 米的连续地形；保留既有小智蒙皮角色与真新镇建筑。不宣称完成商业级开放世界或完整关都复刻。

- 六个探索地点：真新镇、启程原野、常青森林、澄蓝湖畔、风见山脊、南风海岸。
- 64 块可碰撞地形，共 294,912 个地形三角形；道路沿地形铺色，河流有真实河床，湖岸禁止步行进入深水，可通过木桥跨河。
- 固定随机种子的树木、岩石与风动草丛；按空间批次、距离裁剪植被，远山、天空云层、方向光与雾构成景深。
- 山脊观测站含可攀行楼梯、4 米高观景平台与栏杆；湖岸陡坡会触发第三人称镜头抬升以避免贴住人物背部。
- 20 只简化网格野生宝可梦：皮卡丘、走路草、绿毛虫、可达鸭；游荡、近距离 E 互动、现有回合制战斗与捕捉。
- M 地形地图、点击设置路标、方向与距离提示、地点发现记录、F5 随时存档。
- 保存使用独立 PlayerPrefs 键 `kanto-open-world-expedition-v1`，不覆盖旧版存档；旧版 Windows 构建不覆盖。

## 操作

WASD 移动；Shift 奔跑；空格跳跃；按住右键环视；滚轮缩放；E 对话/野外遭遇；M 地图；F5 保存；Tab 第一/第三人称；F1 隐藏 HUD；Esc 关闭地图/对话并释放鼠标。

战斗支持鼠标按钮及 1 攻击、2 捕捉、3 离开、Enter 返回。大世界四种野生宝可梦已接入双方 3D 模型、分件关节出招/受击/倒下与基础技能表现，小火龙使用已有 FBX；范围与验收见 `BATTLE_3D.md`。尚无完整骨骼技能库。无游泳、房屋内部、完整任务剧情、骑乘和多人联机；捕捉记录以个体 ID 存储。

## 文件与构建

- `Assets/Scripts/OpenWorldBuilder.cs`：地形、水域、植被批次、营地、观景台、地形地图与共享网格构造。
- `Assets/Scripts/WorldNatureModels.cs`：树根/分枝/叶簇、破面岩石和弯曲草叶，包含近远两级网格；本轮说明和验收见 `MODEL_DEPTH.md`。
- `Assets/Scripts/PokemonWildlife.cs`：四种简化宝可梦网格、20 个分布点和游荡。
- `Assets/Scripts/PhaseOneGame.OpenWorld.cs`：连续世界接入、交互、探索与独立存档。
- `Assets/Scripts/PhaseOneGame.ExpeditionHud.cs`：探索界面、地图点击、路标、野外战斗界面。
- `Assets/Scripts/PhaseOneGame.WorldReview.cs`：独立运行验收与截图。
- `Assets/Resources/World*.shader`：地形/植被、天空、水面着色。

```powershell
& 'B:\Unity\Editor\6000.3.23f1\Editor\Unity.exe' -batchmode -quit -projectPath 'D:\Sekai_two\memory-15\sekai-nexus\UnityProject' -executeMethod PhaseOneBuild.BuildOpenWorld -logFile 'D:\Sekai_two\memory-15\open-world-build.log'
& 'D:\Sekai_two\memory-15\sekai-nexus\UnityProject\Builds\OpenWorldWindows\KantoJourney.exe' -batchmode -screen-fullscreen 0 -screen-width 1440 -screen-height 900 -worldCapture 'D:\Sekai_two\memory-15\open-world-review' -logFile 'D:\Sekai_two\memory-15\open-world-runtime.log'
```

验收模式不读写用户冒险存档。它使用同一角色移动函数沿三条道路前进，检查桥梁、水域与边界、20 个体/角色骨骼、遭遇捕捉返回、存档 JSON 往返，并输出实景截图及帧时间采样。失败记录 `WORLD_REVIEW_FAILED` 并退出 1，全部通过才记录 `WORLD_REVIEW_OK` 并退出 0。帧时间为独立运行程序的采样，不代表所有设备与所有地点性能。

旧版城镇测试仍可以用 `-ashCapture` / `-palletCapture`；新构建使用 `-legacyWorld` 可进入旧版模式，正常启动默认连续大世界。

## 2026-09-30 验收记录

`open-world-build.log`：`OPEN_WORLD_BUILD: Succeeded`，没有 C# 或着色器编译错误。

`open-world-runtime.log`：`WORLD_REVIEW_OK`。

- 实例内容：64 地形块、1,881 棵树、35,930 簇草、20 只野生宝可梦。
- 使用实际玩家控制器沿三条路线累计移动 865.0 米，包含出镇、森林营地、山脊楼梯、跨河桥与海岸；未切换地图。
- 检查深水限制与世界边界、17 骨骼小智、附近互动目标、遭遇、削弱后捕捉、返回探索、图鉴记录与存档 JSON 往返。
- 地图先经过 UI 射线命中，再调用真实点击处理器，森林营地路标坐标匹配。
- RTX 5060 Laptop GPU 独立程序、1440×900、60 FPS 上限，原野视角采样 120 帧：中位数及 P95 均 16.67 ms；Unity 分配内存约 84 MiB。不是全地图压力测试，不代表总进程/显存占用。
- **2026-10-01 更正：** 上述早期性能采样没有在隐藏窗口显式逐帧渲染，不能作为场景渲染性能证据。现已改为显式渲染及 GPU 同步读回；最新原野/森林采样条件与结果见 `MODEL_DEPTH.md`。
- 检查真实 Unity 渲染的原野、森林、湖畔、山脊观景台、海岸、俯瞰、地图和皮卡丘截图；不是概念图。
- 新构建以 `-ashCapture` 回归旧版：`open-world-legacy-check.log` 记录 `ASH_REVIEW_OK`，17 骨骼、走跑跳、建筑与镜头碰撞、蒙皮变形、旧地图往返均通过。

验收由 Unity 内部自动化执行，未声称通过桌面键鼠手动跑图。截图位于 `D:\Sekai_two\memory-15\open-world-review`。

## 来源和边界

新增地形、植被、道具、宝可梦简化网格、界面与合成环境音均由本项目代码构造，没有下载第三方模型/音乐。小智模型沿用 B 盘 Blender 分阶段建模成果；参考来源见 `PALLET_TOWN.md`。宝可梦人物/名称等属于其各自权利人；此实现不是官方产品，未获得素材商业授权，不应据此宣称可以商用或开源全部角色资产。

实现时核对 Unity 官方 [DrawMeshInstanced](https://docs.unity.com/en-us/engine/6000.0/script-reference/unityengine/graphics/drawmeshinstanced) 的单批 1023 实例限制与材质启用条件；草丛单格最多 750 实例，构建保留运行时实例化着色变体。
