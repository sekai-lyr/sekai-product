# 通用名称匹配优化复测

2026-10-28。当前仅使用 Bangumi 资料源，不保证全球全部作品、所有语言译名或简称均有收录。此轮增加跨语言标点拆分回退、指定季数原词补搜、无中文名时使用原名、原始名称精确优先、同季数无关候选过滤，以及合集电影候选展示。

150 条账号原始名称：自动推荐 137 条（上一轮 135），人工确认 13 条，无结果 0 条。推荐数量不是独立事实核验的正确率。使用真实数据源及应用缓存，未修改账号记录。

验证：51 项测试通过；部署后 150 条 HTTP 接口结果与服务层推荐和候选顺序一致；页面验证译名、剧场版和中英文副标题填入。

|标题|本轮状态|推荐或候选首项|上一轮状态|
|---|---|---|---|
|碧蓝档案|REVIEW|蔚蓝档案 动画版|REVIEW|
|SHINE POST|AUTO|闪耀路标|AUTO|
|亚托莉 -我挚爱的时光|AUTO|亚托莉 -我挚爱的时光-|AUTO|
|寄宿学校的朱丽叶|AUTO|寄宿学校的朱丽叶|AUTO|
|政宗君的复仇|AUTO|政宗君的复仇|AUTO|
|政宗君的复仇第二季|AUTO|政宗君的复仇R|AUTO|
|天气之子|AUTO|天气之子|AUTO|
|你的名字|AUTO|你的名字。|AUTO|
|言叶之庭|AUTO|言叶之庭|AUTO|
|秒速五厘米|AUTO|秒速5厘米|AUTO|
|可塑性记忆|AUTO|可塑性记忆|AUTO|
|我想要吃掉你的胰脏|AUTO|我想吃掉你的胰脏|AUTO|
|选择项目|AUTO|偶像选拔|AUTO|
|超时空辉夜姬|AUTO|超辉夜姬！|AUTO|
|古诺希亚|AUTO|古诺希亚|AUTO|
|剧场版世界计划 破碎的世界与无法歌唱的初音未来|REVIEW|世界计划 无法歌唱的初音未来|REVIEW|
|BanG Dream! It's MyGO!!!!!|AUTO|BanG Dream! It's MyGO!!!!!|AUTO|
|游戏人生|AUTO|游戏人生|AUTO|
|我的青春恋爱物语果然有问题 第一季|AUTO|我的青春恋爱物语果然有问题|AUTO|
|我的青春恋爱物语果然有问题 第二季|AUTO|我的青春恋爱物语果然有问题 续|AUTO|
|我的青春恋爱物语果然有问题 第三季|AUTO|我的青春恋爱物语果然有问题 完|AUTO|
|堀与宫村|AUTO|堀与宫村|AUTO|
|堀与宫村 piece|AUTO|堀与宫村 -piece-|AUTO|
|破灭之国|AUTO|破灭之国|AUTO|
|夏日口袋|AUTO|夏日口袋|AUTO|
|莉可丽丝|AUTO|莉可丽丝|AUTO|
|我家女友可不止可爱呢|AUTO|式守同学不只可爱而已|AUTO|
|铃芽之旅|AUTO|铃芽之旅|AUTO|
|通往夏天的隧道，离别的出口|REVIEW|通往夏天的隧道，再见的出口|REVIEW|
|游戏人生 零|AUTO|游戏人生 零|AUTO|
|声之形|AUTO|声之形|AUTO|
|玉子的爱情故事|AUTO|玉子爱情故事|AUTO|
|败犬女主太多了！|AUTO|败犬女主太多了！|AUTO|
|剧场总集篇 孤独摇滚|REVIEW|剧场总集篇孤独摇滚！ Re:|REVIEW|
|碧蓝之海|AUTO|碧蓝之海|AUTO|
|碧蓝之海 第二季|AUTO|碧蓝之海 第二季|AUTO|
|全职法师第一季|AUTO|全职法师|AUTO|
|全职法师第二季|AUTO|全职法师 第二季|AUTO|
|全职法师第三季|AUTO|全职法师 第三季|AUTO|
|全职法师第四季|AUTO|全职法师 第四季|AUTO|
|全职法师第五季|AUTO|全职法师 第五季|AUTO|
|全职法师 第六季|AUTO|全职法师 第六季|AUTO|
|全职法师 特别篇 神秘委托|AUTO|全职法师特别篇之神秘委托|REVIEW|
|凹凸世界第一季|AUTO|凹凸世界|AUTO|
|凹凸世界第二季|AUTO|凹凸世界 第二季|AUTO|
|凹凸世界第三季|REVIEW|凹凸世界 第三季·上|REVIEW|
|凹凸世界第四季|AUTO|凹凸世界 第四季|AUTO|
|凹凸世界·新生|REVIEW|凹凸世界·新生 先行集|REVIEW|
|更衣人偶坠入爱河|AUTO|更衣人偶坠入爱河|AUTO|
|更衣人偶坠入爱河 第二季|AUTO|更衣人偶坠入爱河 第二季|AUTO|
|未闻花名|AUTO|我们仍未知道那天所看见的花的名字。|AUTO|
|亲爱的弗兰克斯|AUTO|DARLING in the FRANXX|AUTO|
|今天开始做明星|AUTO|今天开始做明星|AUTO|
|今天开始做明星之天使情歌|AUTO|今天开始做明星之天使情歌|AUTO|
|今天开始闪耀登场|AUTO|今天开始闪耀登场|AUTO|
|烟花|AUTO|烟花|AUTO|
|刀剑神域：序列之争剧场版|AUTO|刀剑神域 序列之争|AUTO|
|BanG Dream! Episode of Roselia I: 约定|AUTO|BanG Dream! Episode of Roselia Ⅰ : 约定|AUTO|
|黑子的篮球剧场版：LAST GAME|AUTO|剧场版 黑子的篮球 终极一战|AUTO|
|轻音少女|AUTO|轻音少女|AUTO|
|轻音少女 第二季|AUTO|轻音少女 第二季|AUTO|
|轻音少女 剧场版|AUTO|轻音少女 剧场版|AUTO|
|孤独摇滚！|AUTO|孤独摇滚！|AUTO|
|吹响！上低音号|AUTO|吹响吧！上低音号|AUTO|
|吹响！上低音号第二季|AUTO|吹响吧！上低音号 第二季|AUTO|
|吹响！上低音号第三季|AUTO|吹响吧！上低音号 第三季|AUTO|
|吹响！上低音号剧场版合集|REVIEW|剧场版 吹响吧！上低音号～欢迎来到北宇治高中吹奏乐部～|REVIEW|
|金牌得主|AUTO|金牌得主|AUTO|
|金牌得主 第二季|AUTO|金牌得主 第二季|AUTO|
|想吃掉我的非人少女|AUTO|对我垂涎欲滴的非人少女|AUTO|
|关于我在无意间被隔壁的天使变成废柴这件事|AUTO|关于邻家的天使大人不知不觉把我惯成了废人这档子事|AUTO|
|关于我在无意间被隔壁的天使变成废柴这件事 第二季|AUTO|关于邻家的天使大人不知不觉把我惯成了废人这档子事 第二季|AUTO|
|欢迎来到实力至上主义教室第四季|AUTO|欢迎来到实力至上主义的教室 第四季|AUTO|
|咒术回战 第三季|AUTO|咒术回战 死灭回游 前篇|AUTO|
|杖与剑的魔剑谭 第二季|AUTO|杖与剑的魔剑谭 第二季|AUTO|
|夜樱家的大作战 第二季|AUTO|夜樱家的大作战 第二季|AUTO|
|魔法少女与恶曾是敌人|AUTO|魔法少女与邪恶曾经敌对。|AUTO|
|Love Live!|AUTO|Love Live!|AUTO|
|Love Live!第二季|AUTO|Love Live! 第二季|AUTO|
|Love Live! 虹咲学园校园偶像同好会|AUTO|Love Live! 虹咲学园校园偶像同好会|AUTO|
|Love Live! Superstar!!|AUTO|Love Live! Superstar!!|AUTO|
|Love Live! Superstar!!第二季|AUTO|Love Live! Superstar!! 第二季|AUTO|
|Love Live! 虹咲学园校园偶像同好会 第二季|AUTO|Love Live! 虹咲学园校园偶像同好会 第二季|AUTO|
|租借女友|AUTO|租借女友|AUTO|
|租借女友 第二季|AUTO|租借女友 第二季|AUTO|
|租借女友 第三季|AUTO|租借女友 第三季|AUTO|
|租借女友 第四季|AUTO|租借女友 第四季|AUTO|
|租借女友 第五季|AUTO|租借女友 第五季|AUTO|
|Re：从零开始的异世界生活|AUTO|Re：从零开始的异世界生活|AUTO|
|Re：从零开始的异世界生活 Memory Snow|AUTO|Re：从零开始的异世界生活 雪之回忆|AUTO|
|Re：从零开始的异世界生活 新编集版|AUTO|Re：从零开始的异世界生活 新编集版|AUTO|
|Re：从零开始的异世界生活 冰结之绊|AUTO|Re：从零开始的异世界生活 冰结之绊|AUTO|
|Re：从零开始的异世界生活第二季|AUTO|Re：从零开始的异世界生活 第二季|AUTO|
|Re：从零开始的异世界生活第三季|REVIEW|Re：从零开始的异世界生活 第三季 袭击篇|REVIEW|
|Re：从零开始的异世界生活第四季|REVIEW|Re：从零开始的异世界生活 第四季 丧失篇|REVIEW|
|我推的孩子|AUTO|【我推的孩子】|AUTO|
|我推的孩子 第二季|AUTO|【我推的孩子】 第二季|AUTO|
|我推的孩子 第三季|AUTO|【我推的孩子】 第三季|AUTO|
|最近的侦探真没用|AUTO|最近的侦探真没用|AUTO|
|9-nine- 支配者的王冠|AUTO|9-nine- 支配者的王冠|AUTO|
|莉可丽丝 Friends are thieves of time.|AUTO|莉可丽丝：友谊是时间的窃贼|AUTO|
|想要成为影之实力者！|AUTO|想要成为影之实力者！|AUTO|
|想要成为影之实力者！ 第二季|AUTO|想要成为影之实力者！ 第二季|AUTO|
|薰香花朵凛然绽放|AUTO|薰香花朵凛然绽放|AUTO|
|瑠璃的宝石|AUTO|琉璃的宝石|AUTO|
|时光流逝，饭菜依旧美味|AUTO|时光流逝，饭菜依旧美味|AUTO|
|鸭乃桥论的禁忌推理|AUTO|鸭乃桥论的禁忌推理|AUTO|
|鸭乃桥论的禁忌推理 第二季|AUTO|鸭乃桥论的禁忌推理 第二季|AUTO|
|新 狼与香辛料|AUTO|狼与香辛料 行商邂逅贤狼|AUTO|
|辉夜大小姐想让我告白～天才们的恋爱头脑战～ OVA|AUTO|辉夜大小姐想让我告白？～天才们的恋爱头脑战～ OVA|AUTO|
|辉夜大小姐想让我告白～天才们的恋爱头脑战～|AUTO|辉夜大小姐想让我告白～天才们的恋爱头脑战～|REVIEW|
|辉夜大小姐想让我告白 -Ultra Romantic-|AUTO|辉夜大小姐想让我告白-超级浪漫-|AUTO|
|辉夜大小姐想让我告白：初吻不会结束|AUTO|辉夜大小姐想让我告白-初吻不会结束-|AUTO|
|辉夜大小姐想让我告白 通往大人的阶梯|AUTO|辉夜大小姐想让我告白 通往大人的阶梯|AUTO|
|BanG Dream! Ave Mujica|AUTO|BanG Dream! Ave Mujica|AUTO|
|葬送的芙莉莲|AUTO|葬送的芙莉莲|AUTO|
|葬送的芙莉莲 第二季|AUTO|葬送的芙莉莲 第二季|AUTO|
|我独自升级|AUTO|我独自升级|AUTO|
|我独自升级 第二季|REVIEW|我独自升级 第二季 -起于暗影-|REVIEW|
|小林家的龙女仆剧场版 怕寂寞的龙|AUTO|小林家的龙女仆 怕寂寞的龙|AUTO|
|杖与剑的魔剑谭|AUTO|杖与剑的魔剑谭|AUTO|
|转生七王子的魔法全解|AUTO|转生为第七王子，随心所欲的魔法学习之路|AUTO|
|最强阴阳师的异世界转生记|AUTO|最强阴阳师的异世界转生记|AUTO|
|转生七王子的魔法全解 第二季|AUTO|转生为第七王子，随心所欲的魔法学习之路 第二季|AUTO|
|鬼灭之刃 游郭篇 特别编辑版|AUTO|鬼灭之刃 游郭篇 特別编集版|AUTO|
|继母的拖油瓶是我的前女友|AUTO|继母的拖油瓶是我的前女友|AUTO|
|无职转生～到了异世界就拿出真本事～|AUTO|无职转生～到了异世界就拿出真本事～|AUTO|
|小林家的龙女仆|AUTO|小林家的龙女仆|AUTO|
|小林家的龙女仆S|AUTO|小林家的龙女仆S|AUTO|
|辉夜大小姐想让我告白？第二季|REVIEW|辉夜大小姐想让我告白?～天才们的恋爱头脑战～|REVIEW|
|Re：从零开始的异世界生活 第二季|AUTO|Re：从零开始的异世界生活 第二季|AUTO|
|Re：从零开始的异世界生活 第三季|REVIEW|Re：从零开始的异世界生活 第三季 袭击篇|REVIEW|
|Re：从零开始的异世界生活 第四季|REVIEW|Re：从零开始的异世界生活 第四季 丧失篇|REVIEW|
|欢迎来到实力至上主义教室|AUTO|欢迎来到实力至上主义的教室|AUTO|
|欢迎来到实力至上主义教室 第二季|AUTO|欢迎来到实力至上主义的教室 第二季|AUTO|
|欢迎来到实力至上主义教室 第三季|AUTO|欢迎来到实力至上主义的教室 第三季|AUTO|
|咒术回战|AUTO|咒术回战|AUTO|
|咒术回战 0|AUTO|剧场版 咒术回战 0|AUTO|
|咒术回战 第二季|AUTO|咒术回战 怀玉･玉折 / 涩谷事变|AUTO|
|夜樱家的大作战|AUTO|夜樱家的大作战|AUTO|
|夏洛特 Charlotte|AUTO|夏洛特|AUTO|
|刀剑神域 第一季|AUTO|刀剑神域|AUTO|
|刀剑神域 第二季|AUTO|刀剑神域 第二季|AUTO|
|刀剑神域：序列之争 剧场版|AUTO|刀剑神域 序列之争|AUTO|
|黑子的篮球|AUTO|黑子的篮球|AUTO|
|黑子的篮球 第二季|AUTO|黑子的篮球 第二季|AUTO|
|黑子的篮球 第三季|AUTO|黑子的篮球 第三季|AUTO|
|男女之间的友情存在吗？（不，不存在!!）|AUTO|男女之间的友情存在吗？（不，不存在!!）|AUTO|
|Re：从零开始的异世界生活第三季 反击篇|AUTO|Re：从零开始的异世界生活 第三季 反击篇|AUTO|
|黑色五叶草|AUTO|黑色五叶草|AUTO|
