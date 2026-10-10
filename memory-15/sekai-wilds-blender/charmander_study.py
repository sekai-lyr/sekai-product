# -*- coding: utf-8 -*-
"""
小火龙 · Q 版低模「临摹学习」脚本 v2（图鉴考据版） (Blender 3.x / 4.x)

用途说明
--------
- 对经典角色形象的临摹学习试作，仅供个人学习 / 还原练习，不可用于
  Sekai Wilds 或任何发布内容（形象受版权保护）。
- 本版依据图鉴要点重设：
    1) 大圆头且无外耳（官方没有耳朵，之前也不该加）
    2) 深色圆眼 + 白色高光
    3) 梨形蛋身 + 胸口连腹部的奶油色色块
    4) 短前臂 + 短腿；尾巴自后腰下沿向后上方扬起
    5) 尾焰三层（红底 / 橙中 / 黄芯）+ 自发光 + 48 帧摇曳动画

运行方法
--------
方法 1：命令行
    blender --background --python charmander_study.py
方法 2：Blender 内 Scripting 面板打开运行（只清理 CS_ 前缀对象与材质）。
生成后：按 A 全选，可导出 FBX / glTF 供 Unity 导入。
"""

import bpy
from math import radians

PREFIX = "CS_"
FRAMES = 48

# ---------------------------------------------------------------------------
# 清理：只移除本脚本命名空间内的对象 / 材质（可反复运行）
# ---------------------------------------------------------------------------
def purge():
    for obj in list(bpy.data.objects):
        if obj.name.startswith(PREFIX):
            bpy.data.objects.remove(obj, do_unused_data=True)
    for mat in list(bpy.data.materials):
        if mat.name.startswith(PREFIX):
            bpy.data.materials.remove(mat)

# ---------------------------------------------------------------------------
# 材质：Principled BSDF，尾焰带自发光
# ---------------------------------------------------------------------------
def make_mat(name, color, rough=0.6, emit=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    r, g, b = color
    bsdf.inputs["Base Color"].default_value = (r, g, b, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    if emit > 0.0:
        bsdf.inputs["Emission Color"].default_value = (r, g, b, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emit
    return mat

# ---------------------------------------------------------------------------
# 基元生成（Z 轴向上；正面朝向 +Y）
# ---------------------------------------------------------------------------
def add_sphere(name, loc, scale, mat, seg=28):
    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=1.0, location=loc, segments=seg, ring_count=max(8, int(seg / 2)))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return obj

def add_cylinder(name, loc, rot, radius, depth, mat, verts=18):
    bpy.ops.mesh.primitive_cylinder_add(
        radius=radius, depth=depth, location=loc, rotation=rot, vertices=verts)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return obj

def add_cone(name, loc, radius, depth, mat, verts=20):
    bpy.ops.mesh.primitive_cone_add(
        radius1=radius, radius2=0.0, depth=depth, location=loc, vertices=verts)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return obj

# ---------------------------------------------------------------------------
# 主体（图鉴考据版）
# ---------------------------------------------------------------------------
purge()

# 调色板：官方橙 + 奶油 + 深海军蓝眼 + 三层火焰
orange    = make_mat(PREFIX + "orange", (0.93, 0.49, 0.16), rough=0.55)
cream     = make_mat(PREFIX + "cream",  (0.98, 0.91, 0.78), rough=0.70)
navy      = make_mat(PREFIX + "navy",   (0.13, 0.16, 0.28), rough=0.30)
white     = make_mat(PREFIX + "white",  (1.00, 1.00, 1.00), rough=0.40)
flame_red = make_mat(PREFIX + "flame_red",    (0.95, 0.33, 0.12), rough=0.5, emit=0.6)
flame_org = make_mat(PREFIX + "flame_orange", (1.00, 0.62, 0.16), rough=0.5, emit=0.9)
flame_yll = make_mat(PREFIX + "flame_yellow", (1.00, 0.85, 0.35), rough=0.5, emit=1.4)

# 身体：蛋形（图鉴为梨形直立身，竖直蛋形近似）
body = add_sphere(PREFIX + "body", (0, 0, 1.45), (1.05, 0.92, 1.30), orange)
# 头部：大圆头、前置、无外耳
head = add_sphere(PREFIX + "head", (0, 0.02, 2.90), (0.82, 0.76, 0.88), orange)

# 奶油色腹：胸口连腹部的大色块（比旧版更大、位置更高）
add_sphere(PREFIX + "belly", (0, 0.55, 0.98), (0.58, 0.42, 0.58), cream)

# 双眼（深海军蓝，Q 版大眼）+ 白色高光
eye_l = add_sphere(PREFIX + "eye_l", (-0.34, 0.62, 3.12), (0.09, 0.065, 0.10), navy, seg=16)
eye_r = add_sphere(PREFIX + "eye_r", (0.34, 0.62, 3.12), (0.09, 0.065, 0.10), navy, seg=16)
add_sphere(PREFIX + "glint_l", (-0.285, 0.68, 3.17), (0.028, 0.020, 0.030), white, seg=12)
add_sphere(PREFIX + "glint_r", (0.395, 0.68, 3.17), (0.028, 0.020, 0.030), white, seg=12)

# 双臂：沿 +Y 前伸的短柱（旋转 -90° 把圆柱轴转到 Y 向）
add_cylinder(PREFIX + "arm_l", (-0.78, 0.30, 2.15), (radians(-90), 0, 0), 0.12, 0.55, orange)
add_cylinder(PREFIX + "arm_r", (0.78, 0.30, 2.15), (radians(-90), 0, 0), 0.12, 0.55, orange)

# 双腿：短而粗，埋入身体下半
add_cylinder(PREFIX + "leg_l", (-0.38, 0.02, 0.30), (0, 0, 0), 0.145, 0.60, orange)
add_cylinder(PREFIX + "leg_r", (0.38, 0.02, 0.30), (0, 0, 0), 0.145, 0.60, orange)

# 尾巴：起点放在后腰下沿，绕 X 转 +30° 向后上方扬起
tail = add_cylinder(PREFIX + "tail", (0, -0.78, 1.19), (radians(30), 0, 0), 0.095, 1.30, orange)

# 尾焰三层：红底 / 橙中 / 黄芯（基部咬住尾尖，逐层抬高收窄）
f1 = add_cone(PREFIX + "flame_1", (0, -1.13, 2.21), 0.40, 1.00, flame_red)
f2 = add_cone(PREFIX + "flame_2", (0, -1.19, 2.60), 0.24, 0.80, flame_org)
f3 = add_cone(PREFIX + "flame_3", (0, -1.25, 2.93), 0.12, 0.50, flame_yll)

# ---------------------------------------------------------------------------
# 火焰摇曳动画（48 帧循环：宽窄 + 高低错位）
# ---------------------------------------------------------------------------
bpy.context.scene.frame_end = FRAMES
bpy.context.scene.frame_current = 0
curve = [(1.00, 1.00), (1.14, 0.94), (0.92, 1.06), (1.08, 0.97), (1.00, 1.00)]
step = FRAMES // (len(curve) - 1)
for flame in (f1, f2, f3):
    s0 = tuple(flame.scale)
    for i, (sx, sz) in enumerate(curve):
        frame = step * i
        flame.scale = (s0[0] * sx, s0[1] * sx, s0[2] * sz)
        flame.keyframe_insert(data_path="scale", frame=frame)

print("完成（v2 图鉴考据版）：对象均以 %s 开头；按 A 全选后可导出 FBX / glTF。" % PREFIX)
