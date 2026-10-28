# 初音未来 · DivaStage 自建 2D 模型

这是项目内新增的动态 2D 舞台角色，按照现有模型目录的方式放在 `models/2d` 下。角色以参考立绘为基础，运行时通过 PixiJS 进行切片分层和参数驱动。

- `hatsune_miku.png`：根据参考图生成并处理为透明背景的全身立绘
- `hatsune_miku.svg`：无图像资源时使用的矢量备用立绘
- `miku-face-*.svg`：矢量备用立绘使用的表情层
- `hatsune_miku.model.json`：动态切片模型清单，声明图层、参数、动作和表情

运行时将全身立绘放入 9×17 网格主体，并从同一透明素材中裁出双马尾、刘海、躯干、袖套、裙摆和领带，再叠加脸部表情控制层。模型支持 `AngleX`、`AngleY`、`AngleZ`、`BodyAngleX/Y/Z`、`Breath`、`EyeLOpen/R`、`EyeBallX/Y`、`MouthForm`、`MouthOpenY`、`BustY`、`HairFront/Side/Back`、`Ribbon`、`Skirt` 参数，以及 `Idle`、`Tap`、`Flick`、`Shake` 动作和五种表情；同时复用现有模型的点击、拖动、缩放、鼠标跟随和生命周期入口。现有 Cubism 模型不受影响。
