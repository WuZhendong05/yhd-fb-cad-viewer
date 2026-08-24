# -*- coding: utf-8 -*-
"""STEP 实体映射增强工具（方案 2 的后端部分）

给组件 GLB 的 STEP_topology 扩展的 face 表新增 stepEntityId 列：
把 pythonocc 提取的 "TopExp ordinal -> STEP 实体 id" 映射写入 GLB，
使前端能通过特征识别结果中的 relatedEntityIds（STEP 实体 id）定位面。

用法:
  python step_feature_augment.py --step <step文件> --glb <组件.glb> [--out <输出.glb>]

依赖: pythonocc-core（安装示例: conda install -c conda-forge pythonocc-core，或 pip install pythonocc-core）
"""
import argparse
import json
import re
import struct
import sys


# ---------- pythonocc 提取 ordinal -> 实体 id ----------

def extract_entity_map(step_path):
    """用 pythonocc 遍历面，建立 ordinal(1-based) -> (STEP实体id, surfaceType, radius)"""
    from OCC.Core.STEPControl import STEPControl_Reader
    from OCC.Core.TopExp import TopExp_Explorer
    from OCC.Core.TopAbs import TopAbs_FACE
    from OCC.Core.BRepAdaptor import BRepAdaptor_Surface

    reader = STEPControl_Reader()
    status = reader.ReadFile(str(step_path))
    if status != 1:  # IFSelect_RetDone
        raise RuntimeError(f"ReadFile failed: {status}")
    reader.TransferRoots()
    shape = reader.OneShape()

    model = reader.StepModel()
    tr = reader.WS().TransferReader()

    exp = TopExp_Explorer(shape, TopAbs_FACE)
    result = {}
    ordinal = 0
    while exp.More():
        face = exp.Current()
        ordinal += 1
        # 实体 id
        entity_id = 0
        try:
            item = tr.EntityFromShapeResult(face, 1)
            if item:
                entity_id = int(model.IdentLabel(item))
        except Exception:
            entity_id = 0
        # 几何（用于与 GLB 对账）
        surface_type = ""
        radius = None
        try:
            surf = BRepAdaptor_Surface(face)
            t = int(surf.GetType())
            if t == 0:
                surface_type = "plane"
            elif t == 1:
                surface_type = "cylinder"
                radius = round(surf.Cylinder().Radius(), 4)
            elif t == 2:
                surface_type = "cone"
            elif t == 3:
                surface_type = "sphere"
            elif t == 4:
                surface_type = "torus"
            else:
                surface_type = f"type{t}"
        except Exception:
            pass
        result[ordinal] = {"entityId": entity_id, "surfaceType": surface_type, "radius": radius}
        exp.Next()
    return result


# ---------- GLB 读写 ----------

def read_glb(path):
    data = open(path, "rb").read()
    if data[:4] != b"glTF":
        raise RuntimeError("not a GLB file")
    json_len = struct.unpack("<I", data[12:16])[0]
    gltf = json.loads(data[20:20 + json_len])
    bin_start = 20 + json_len + 8
    binary = data[bin_start:]
    return gltf, binary


def write_glb(path, gltf, binary):
    json_chunk = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    json_chunk += b" " * ((4 - (len(json_chunk) % 4)) % 4)
    binary += b"\0" * ((4 - (len(binary) % 4)) % 4)
    payload = 12 + 8 + len(json_chunk) + 8 + len(binary)
    with open(path, "wb") as f:
        f.write(b"glTF" + struct.pack("<II", 2, payload))
        f.write(struct.pack("<I4s", len(json_chunk), b"JSON"))
        f.write(json_chunk)
        f.write(struct.pack("<I4s", len(binary), b"BIN\0"))
        f.write(binary)
    return path


def read_selector_manifest(gltf, binary):
    ext = gltf["extensions"]["STEP_topology"]
    bv = gltf["bufferViews"][ext["selectorView"]]
    start = bv.get("byteOffset", 0)
    raw = binary[start:start + bv["byteLength"]]
    return json.loads(raw.decode("utf-8"))


def inject_step_entity_column(gltf, binary, entity_map):
    """把 stepEntityId 列注入 selectorView manifest，返回 (新gltf, 新binary)"""
    ext = gltf["extensions"]["STEP_topology"]
    sv_idx = ext["selectorView"]
    bv = gltf["bufferViews"][sv_idx]
    start = bv.get("byteOffset", 0)

    manifest = read_selector_manifest(gltf, binary)
    tables = manifest.setdefault("tables", {})
    face_columns = tables.get("faceColumns")
    faces = manifest.get("faces")
    if not isinstance(face_columns, list) or not isinstance(faces, list):
        raise RuntimeError("selector manifest has no faceColumns/faces")
    if "stepEntityId" in face_columns:
        print("stepEntityId 列已存在，跳过")
        return gltf, binary

    # 对账：ordinal 列（faceColumns 里 "ordinal" 的索引）
    ordinal_idx = face_columns.index("ordinal") if "ordinal" in face_columns else None
    matched = 0
    checked = 0
    for row in faces:
        if ordinal_idx is None:
            ordinal = checked + 1
        else:
            ordinal = int(row[ordinal_idx])
        info = entity_map.get(ordinal)
        if info is None:
            row.append(0)
            continue
        # 几何对账（surfaceType 一致才可信）
        row_surface = row[face_columns.index("surfaceType")] if "surfaceType" in face_columns else ""
        if info["surfaceType"] and row_surface and info["surfaceType"] != row_surface:
            row.append(0)
            continue
        row.append(info["entityId"])
        matched += 1
        checked += 1

    face_columns.append("stepEntityId")
    print(f"对账匹配: {matched}/{len(faces)}")

    # 序列化新 manifest，替换尾部
    new_payload = json.dumps(manifest, separators=(",", ":")).encode("utf-8")
    # 保留 selectorView 之前的所有字节（含 [0, start) 与 [start, start+len) 原样），
    # 只把 [start, end) 换成新 manifest + 对齐 padding
    head = binary[:start]
    # 旧的 tail 部分（selectorView 之后）不存在（它是最后一个 bufferView），
    # 但保留对齐 padding：直接截掉原尾
    new_view = new_payload + b"\0" * ((4 - (len(new_payload) % 4)) % 4)
    new_binary = head + new_view

    # 更新 bufferView 长度（byteLength 只算 JSON 本身，不含对齐 padding）
    new_bv = dict(bv)
    new_bv["byteLength"] = len(new_payload)
    gltf["bufferViews"][sv_idx] = new_bv
    # 更新 buffer byteLength
    gltf["buffers"][0]["byteLength"] = len(new_binary)
    return gltf, new_binary


def main():
    parser = argparse.ArgumentParser(description="注入 stepEntityId 列到 GLB")
    parser.add_argument("--step", required=True, help="STEP 文件路径")
    parser.add_argument("--glb", required=True, help="组件 GLB 路径（原地增强）")
    args = parser.parse_args()

    entity_map = extract_entity_map(args.step)
    with_entity = sum(1 for v in entity_map.values() if v["entityId"])
    print(f"STEP 面数: {len(entity_map)}, 拿到实体 id 的: {with_entity}")

    gltf, binary = read_glb(args.glb)
    gltf, new_binary = inject_step_entity_column(gltf, binary, entity_map)
    write_glb(args.glb, gltf, new_binary)
    print(f"增强完成: {args.glb}")


if __name__ == "__main__":
    main()
