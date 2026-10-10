# 真新镇 / Pallet Town

当前 `Assets/Scenes/PhaseOneWorld.unity` 在运行时生成可探索的 3D 真新镇。

## 运行

打开 `Builds/Windows/SekaiWilds.exe`，或在 Unity 中打开上述场景并按 Play。
可执行程序需要与同目录的 `SekaiWilds_Data`、UnityPlayer.dll 等文件一起保留。

- WASD / 方向键：按镜头方向移动；Shift：奔跑；空格：跳跃。
- 默认小智第三人称；按住鼠标右键环绕镜头，滚轮调整距离，墙体会使镜头自动收近。
- Tab：第三人称 / 第一人称。第一人称点击场景后用鼠标转向，Esc 释放鼠标。
- F2：全镇俯视 / 返回第三人称。
- E：与附近人物交谈；也可点击人物。
- F1：隐藏 / 显示界面。
- 走到北侧 1 号道路可进入现有野外地图；沿野外入口返回真新镇。
- 研究所门外的小精灵球附近可以保存现有冒险进度。

## 场景范围

西北红顶玩家家、东北蓝顶劲敌家、东南大木博士研究所、西侧花园、南侧沙岸与码头、北侧草地入口、树木边界、白栅栏、路灯、长椅和信箱。
妈妈、小茂和大木博士位于室外，可交谈。此版本实现室外小镇，房屋没有可进入的室内场景。
可交互的伙伴数据沿用现有项目；本次场景不把原先的通用球体生物当作小火龙摆放。

美术参考：[Pokémon: Let's Go 官方关都与真新镇介绍](https://pokemonletsgo.pokemon.com/en-us/kanto-region/)。
建筑、道具、材质均在项目内程序生成；未下载或使用游戏原模型。

## 实现位置

- `Assets/Scripts/PalletTownBuilder.cs`：建筑、园艺、水岸、NPC 外观。
- `Assets/Scripts/PhaseOneGame.cs`：现有玩法、相机、对话、地图切换与截图检查。
- `Assets/Scripts/AshAvatar.cs`：小智蒙皮模型与骨骼走跑跳动画。
- `Assets/Resources/Characters/Ash/AshKetchum.fbx`：Blender 导出的玩家模型，17 根骨骼，20,427 三角面。
- `Assets/Resources/PalletMatte.shader`：场景哑光材质。
- `Assets/Resources/PalletWater.shader`：流动水面。
- `Assets/Resources/PalletText.shader`：遵守深度遮挡的世界标牌文字。

## 重现验收

构建沿用编辑器方法 `PhaseOneBuild.BuildWindows`。
构建后的程序支持 `-batchmode -palletCapture <截图目录> -logFile <日志路径>`，需要真实图形设备，不能使用 `-nographics`。
该模式使用游戏本身渲染全景、带界面的游戏画面、住宅、街道四张 PNG，检查地面、北侧通路、室外 NPC 和真新镇 → 野外 → 真新镇往返，然后退出。
检查成功时日志包含 `PALLET_LAYOUT_OK`、`PALLET_ROUNDTRIP_OK` 和 `PALLET_REVIEW_OK`。
截图模式不写入玩家存档。

## 小智建模与验证

形象为初代服装的卡通游戏化模型：红白帽、绿帽徽、黑色尖发、蓝色黄边马甲、白袖、绿色露指手套、牛仔裤与背包。
经过躯干、四肢、头部、服饰、骨骼五个 Blender 检查阶段。面部固定表情；没有面部动画或口型系统。

Blender 工程、GLB、分阶段截图与生成脚本位于 `B:/Blender/workspace/AshKetchum/`；最终工程为 `ash-stage-5.blend`。
参考：[Ash anime art](https://bulbapedia.bulbagarden.net/wiki/File:Ash_anime_art.png)。

使用构建参数 `-batchmode -ashCapture <截图目录> -logFile <日志路径>` 可重现小智检查：模型尺寸/骨骼、实际控制器走跑跳、建筑碰撞、镜头收近、蒙皮顶点变化与地图往返。自动检查使用与键盘相同的移动代码；截图是 Unity 运行时渲染。
