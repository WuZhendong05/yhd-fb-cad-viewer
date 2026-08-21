// Feature-recognition result parsing: builds a nested tree from the external
// recognition JSON (报价版). All part types share one feature schema; only the
// "整体信息" section differs between 方类 / 圆类. Structure:
//   零件 (Part)
//   ├─ 整体信息 — 几何信息 / 加工面信息 / 轮廓信息（按类别取字段）
//   └─ 特征分支 — 孔/槽/凸台/回转/特殊/倒角/圆角/曲面/斜面/PMI/DFM
//        每个类型一个分支，组内实例带方向标注，编号前缀 H/G/B/R/S/X/F/Q/V/P。
// Nodes that can highlight carry { highlight: { entityIds } }; the caller maps
// entityIds (STEP ADVANCED_FACE numbers) to component face ids via the GLB
// topology's stepEntityId column.

// ---------- shared helpers ----------
function uniqueNumbers(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0 && !seen.has(numeric)) {
      seen.add(numeric);
      out.push(numeric);
    }
  }
  return out;
}

function flattenEntityIds(item) {
  const raw = Array.isArray(item?.relatedEntityIds) ? item.relatedEntityIds : [];
  const ids = [];
  for (const entry of raw) {
    if (Array.isArray(entry)) {
      ids.push(...entry);
    } else if (entry != null) {
      ids.push(entry);
    }
  }
  return uniqueNumbers(ids);
}

// fmtNum keeps trailing zeros (overview values like 68.00 mm);
// fmtDim trims them (feature dimensions like 深4.5 / 长24 / R1).
const fmtNum = (v, digits = 2) => (Number.isFinite(Number(v)) ? Number(v).toFixed(digits) : String(v ?? ""));
const fmtDim = (v) => {
  const numeric = Number(v);
  if (!Number.isFinite(numeric)) {
    return String(v ?? "");
  }
  return String(numeric.toFixed(2).replace(/\.?0+$/, ""));
};

// ---------- enums ----------
const DIRECTION_LABELS = Object.freeze({
  top: "上表面",
  front: "前表面",
  back: "后表面",
  bottom: "下表面",
  left: "左表面",
  right: "右表面",
  none: "无方向"
});

const PART_TYPE_LABELS = Object.freeze({
  rectangular_part: "方件",
  rectangular_board_part: "大板",
  round_pure_part: "圆件",
  round_rectangular_part: "方圆件"
});

const ROUND_TYPES = new Set(["round_pure_part", "round_rectangular_part"]);

// ---------- instance collection ----------
// `number` is the merged count of same-parameter features; relatedEntityIds is
// 1D for a single instance and 2D when merged. number === 1 merges all ids into
// one instance; otherwise each inner array is one instance.
function collectInstances(item) {
  const rawInstances = Array.isArray(item.relatedEntityIds) ? item.relatedEntityIds : [];
  if (!rawInstances.length) {
    return [];
  }
  const number = Number(item.number);
  const instanceCount = Number.isFinite(number) && number > 0 ? number : rawInstances.length;
  if (instanceCount === 1) {
    return [{ entityIds: flattenEntityIds(item), direction: String(item.direction || "").toLowerCase() }];
  }
  return rawInstances.map((instance) => ({
    entityIds: uniqueNumbers(Array.isArray(instance) ? instance : [instance]),
    direction: String(item.direction || "").toLowerCase()
  }));
}

// ---------- tree node helpers ----------
function leafNode(id, label, sub, highlightEntityIds, dot) {
  const node = { id, label, sub: String(sub ?? ""), leaf: true };
  if (highlightEntityIds && highlightEntityIds.length) {
    node.highlight = { entityIds: highlightEntityIds };
  }
  if (dot) {
    node.dot = dot;
  }
  return node;
}
function branchNode(id, label, children, dot, sub) {
  const node = { id, label, children: children.filter(Boolean) };
  if (dot) {
    node.dot = dot;
  }
  if (sub) {
    node.sub = String(sub);
  }
  return node;
}

const TYPE_DOTS = Object.freeze({
  hole: "var(--hole)",
  groove: "var(--groove)",
  boss: "var(--boss)",
  dfm: "var(--dfm)",
  info: "var(--text-3)",
  face: "var(--select)"
});

// ---------- feature description builders ----------
const roundTypeLabel = (type) => (type === "cone" ? " 锥形" : type === "plane" ? " 平面" : type ? ` ${type}` : "");

const holeDesc = {
  threadedHole: (item) =>
    `螺纹孔 Φ${fmtDim(item.diameter)}×${fmtDim(item.diameterMajor)} 深${fmtDim(item.depth)}/${fmtDim(item.depthMajor)} 螺距${fmtDim(item.pitch)} ${item.through ? "贯穿" : "盲孔"}`,
  throughAndBlindHoles: (item) =>
    `通孔 Φ${fmtDim(item.diameter)} 深${fmtDim(item.depth)} ${item.through ? "贯穿" : "盲孔"}`,
  counterbore: (item) => {
    const mx = item.diameterMax || {};
    const mn = item.diameterMin || {};
    const mid = item.diameterMid || {};
    const midPart = mid.diameter != null ? `/${fmtDim(mid.diameter)}` : "";
    return `沉头孔 Φ${fmtDim(mx.diameter)}${midPart}/${fmtDim(mn.diameter)} 深${fmtDim(mx.depth)}/${fmtDim(mn.depth)} ${item.through ? "贯穿" : "盲孔"}`;
  },
  precisionHole: (item) => {
    const mx = item.diameterMax || {};
    const mn = item.diameterMin || {};
    const single = item.diameter != null
      ? `Φ${fmtDim(item.diameter)} 深${fmtDim(item.depth)}`
      : `Φ${fmtDim(mx.diameter)}/${fmtDim(mn.diameter)} 深${fmtDim(mx.depth)}/${fmtDim(mn.depth)}`;
    return `精密孔 ${single} ${item.through ? "贯穿" : "盲孔"}`;
  }
};

const grooveDesc = {
  rectangularGroove: (item, subKey) => {
    const through = subKey === "throughRounded" || subKey === "throughSharp";
    const sharp = subKey === "throughSharp" || subKey === "nonThroughSharp";
    const radius = item.radius != null ? ` 四角R${fmtDim(item.radius)}` : "";
    return `矩形${through ? "通" : "盲"}槽 长${fmtDim(item.length)}×宽${fmtDim(item.width)}×深${fmtDim(item.depth)}${sharp ? " 尖角" : radius}`;
  },
  irregularGroove: (item) =>
    `不规则槽 深${fmtDim(item.depth)} ${item.through ? "通槽" : "非通槽"}`,
  sawGroove: (item) =>
    `锯片槽 长${fmtDim(item.length)}×宽${fmtDim(item.width)}×深${fmtDim(item.depth)}`,
  uGroove: (item, subKey) =>
    `U形${subKey === "through" ? "通" : "盲"}槽 长${fmtDim(item.length)}×宽${fmtDim(item.width)}×深${fmtDim(item.depth)}`,
  flat: (item) =>
    `平槽 长${fmtDim(item.length)}×宽${fmtDim(item.width)}×深${fmtDim(item.depth)}`,
  keyway: (item) =>
    `键槽 长${fmtDim(item.length)}×宽${fmtDim(item.width)}×深${fmtDim(item.depth)}${item.through ? " 贯穿" : ""}`,
  unRegularRB: (item) => `不规则回转槽 深${fmtDim(item.depth)}`
};

const bossDesc = {
  step: (item) => `台阶 高${fmtDim(item.depth)} 底面积${fmtDim(item.basalArea)}`,
  convex: (item) => `凸台 高${fmtDim(item.depth)} 底面积${fmtDim(item.basalArea)} 底周长${fmtDim(item.basalPerimeter)}`
};

const roundBossDesc = {
  outerCircle: (item) => `外圆 Φ${fmtDim(item.diameter)}×长${fmtDim(item.length)}`,
  innerCircle: (item) => `内圆 Φ${fmtDim(item.diameter)}×长${fmtDim(item.length)}${roundTypeLabel(item.type)}`,
  centreDrilling: (item) => `中心钻 Φ${fmtDim(item.diameter)}×长${fmtDim(item.length)}${roundTypeLabel(item.type)}`,
  coneCircle: (item) => `锥面 角度${fmtDim(item.angle)} Φ${fmtDim(item.diameter)}×长${fmtDim(item.length)}`,
  circlip: (item) => `卡簧槽 Φ${fmtDim(item.diameterMax)}/${fmtDim(item.diameterMin)} 长${fmtDim(item.length)}`,
  circularGroove: (item) => `环形槽 Φ${fmtDim(item.diameterMax)}/${fmtDim(item.diameterMin)} 长${fmtDim(item.length)}`
};

const specialDesc = {
  carve: (item) => `雕刻 深${fmtDim(item.depth)} 底面积${fmtDim(item.basalArea)}`,
  normalSP: (item) => `特殊加工 深${fmtDim(item.depth)}`,
  solidThread: (item) => `实体螺纹 长${fmtDim(item.length)}`
};

const chamferDesc = (item) => `倒角 宽${fmtDim(item.width)}`;
const filletDesc = (item, subKey) => {
  const concave = item.type === "concaveFillet" ? "内凹" : item.type === "convexFillet" ? "凸圆角" : item.type ? String(item.type) : "";
  return `${subKey === "close" ? "闭合" : ""}圆角 宽${fmtDim(item.width)}${concave ? ` ${concave}` : ""}`;
};
const curvedSurfaceDesc = (item) => `曲面 面积${fmtDim(item.superficialArea)} 体积${fmtDim(item.volume)} 深${fmtDim(item.depth)}`;
const bevelDesc = (item) => `斜面 倾角${fmtDim(item.angle)} 深${fmtDim(item.depth)}`;
const PMI_SUB_LABELS = Object.freeze({ linearTolerance: "线性公差", geometricTolerance: "几何公差", roughness: "粗糙度" });
const pmiDesc = (item, subKey) => `PMI ${PMI_SUB_LABELS[subKey] || subKey || ""}`;

// ---------- feature-type registry (order = display order) ----------
// group  -> key on part; subs  -> sub-features under group.
// nested : group[key] is a dict of arrays (throughRounded etc.)
// object : group itself is a dict of arrays (fillet.open/close, pmi.*)
// array  : group itself is an array (chamfer, curvedSurface, bevel)
const FEATURE_TYPES = Object.freeze([
  { id: "hole", label: "孔 (hole)", prefix: "H", dot: TYPE_DOTS.hole, group: "hole", subs: [
    { key: "threadedHole", sub: holeDesc.threadedHole },
    { key: "throughAndBlindHoles", sub: holeDesc.throughAndBlindHoles },
    { key: "counterbore", sub: holeDesc.counterbore },
    { key: "precisionHole", sub: holeDesc.precisionHole }
  ] },
  { id: "groove", label: "槽 (groove)", prefix: "G", dot: TYPE_DOTS.groove, group: "groove", subs: [
    { key: "rectangularGroove", nested: true, sub: grooveDesc.rectangularGroove },
    { key: "irregularGroove", sub: grooveDesc.irregularGroove },
    { key: "sawGroove", sub: grooveDesc.sawGroove },
    { key: "uGroove", nested: true, sub: grooveDesc.uGroove },
    { key: "flat", sub: grooveDesc.flat },
    { key: "keyway", sub: grooveDesc.keyway },
    { key: "unRegularRB", sub: grooveDesc.unRegularRB }
  ] },
  { id: "boss", label: "凸台 (boss)", prefix: "B", dot: TYPE_DOTS.boss, group: "boss", subs: [
    { key: "step", sub: bossDesc.step },
    { key: "convex", sub: bossDesc.convex }
  ] },
  { id: "roundBoss", label: "回转 (roundBoss)", prefix: "R", dot: TYPE_DOTS.boss, group: "roundBoss", subs: [
    { key: "outerCircle", sub: roundBossDesc.outerCircle },
    { key: "innerCircle", sub: roundBossDesc.innerCircle },
    { key: "centreDrilling", sub: roundBossDesc.centreDrilling },
    { key: "coneCircle", sub: roundBossDesc.coneCircle },
    { key: "circlip", sub: roundBossDesc.circlip },
    { key: "circularGroove", sub: roundBossDesc.circularGroove }
  ] },
  { id: "specialFeature", label: "特殊加工 (specialFeature)", prefix: "S", dot: TYPE_DOTS.groove, group: "specialFeature", subs: [
    { key: "carve", sub: specialDesc.carve },
    { key: "normalSP", sub: specialDesc.normalSP },
    { key: "solidThread", sub: specialDesc.solidThread }
  ] },
  { id: "chamfer", label: "倒角 (chamfer)", prefix: "X", dot: TYPE_DOTS.groove, group: "chamfer", array: true, subs: [
    { key: "chamfer", sub: chamferDesc }
  ] },
  { id: "fillet", label: "圆角 (fillet)", prefix: "F", dot: TYPE_DOTS.groove, group: "fillet", object: true, subs: [
    { key: "fillet", sub: filletDesc }
  ] },
  { id: "curvedSurface", label: "曲面 (curvedSurface)", prefix: "Q", dot: TYPE_DOTS.groove, group: "curvedSurface", array: true, subs: [
    { key: "curvedSurface", sub: curvedSurfaceDesc }
  ] },
  { id: "bevel", label: "斜面 (bevel)", prefix: "V", dot: TYPE_DOTS.groove, group: "bevel", array: true, subs: [
    { key: "bevel", sub: bevelDesc }
  ] },
  { id: "pmi", label: "PMI", prefix: "P", dot: TYPE_DOTS.info, group: "pmi", object: true, subs: [
    { key: "pmi", sub: pmiDesc }
  ] }
]);

// Resolve the raw item list for a sub-feature under a part.
function resolveSubFeature(part, type, subFeature) {
  const group = type.group;
  if (subFeature.nested || type.object) {
    const holder = subFeature.nested ? (part[group] || {})[subFeature.key] : part[group];
    if (!holder || typeof holder !== "object") {
      return [];
    }
    if (Array.isArray(holder)) {
      // 旧格式兼容：fillet / pmi 等直接输出为数组
      return holder.map((item) => ({ item, subKey: "" }));
    }
    return Object.entries(holder)
      .filter(([, values]) => Array.isArray(values) && values.length)
      .flatMap(([subKey, values]) => values.map((item) => ({ item, subKey })));
  }
  const raw = type.array ? part[group] : (part[group] || {})[subFeature.key];
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((item) => ({ item, subKey: "" }));
}

// Collect labelled instances for one feature type (e.g. 孔), numbered continuously.
function collectTypeInstances(part, type) {
  const out = [];
  for (const subFeature of type.subs) {
    for (const { item, subKey } of resolveSubFeature(part, type, subFeature)) {
      for (const instance of collectInstances(item)) {
        let label = subFeature.sub(item, subKey);
        const dir = instance.direction;
        if (dir && DIRECTION_LABELS[dir]) {
          label += ` (${DIRECTION_LABELS[dir]})`;
        }
        out.push({ label, entityIds: instance.entityIds });
      }
    }
  }
  return out;
}

function buildDfmLeaves(part) {
  const dfm = part.DFM || {};
  return Object.entries(dfm)
    .filter(([, entries]) => Array.isArray(entries))
    .map(([code, entries]) => leafNode(
      `dfm:${code}`,
      code,
      `共 ${entries.length} 组实体ID`,
      flattenEntityIds({ relatedEntityIds: entries.map((entry) => (Array.isArray(entry) ? entry : [entry])) }),
      TYPE_DOTS.dfm
    ));
}

// ---------- 整体信息 ----------
function buildOverview(part, isRound) {
  if (isRound) {
    const geo = part.partGeometryInformation || {};
    const geoLeaves = [
      ["最大直径", "diameterMax", "mm", fmtNum],
      ["最大长度", "lengthMax", "mm", fmtNum],
      ["表面积", "surfaceArea", "mm²", fmtNum],
      ["体积", "volume", "mm³", fmtNum]
    ].map(([label, key, unit, fmt]) => leafNode(`info:${key}`, label, `${fmt(geo[key])}${unit ? ` ${unit}` : ""}`));
    return branchNode("info", "整体信息", [branchNode("info:geometry", "几何信息", geoLeaves)], TYPE_DOTS.info);
  }

  // 方类：几何信息 + 加工面信息 + 轮廓信息（含轮廓缺口槽）
  const partInfo = part.partGeometryInformation || {};
  const machined = part.machinedSurface || {};
  const infoChildren = [
    branchNode("info:geometry", "几何信息", [
      leafNode("info:sa", "表面积", `${fmtNum(partInfo.surfaceArea)} mm²`),
      leafNode("info:vol", "体积", `${fmtNum(partInfo.volume)} mm³`),
      leafNode("info:ba", "底面面积", `${fmtNum(partInfo.basalArea)} mm²`)
    ]),
    branchNode("info:surface", "加工面信息", [
      leafNode("info:nms", "加工面数量", String(machined.numberOfMachiningSurface ?? "")),
      leafNode("info:nb", "斜面数量", String(machined.numberOfBevels ?? "")),
      leafNode("info:ns", "侧面数量", String(machined.numberOfSides ?? ""))
    ])
  ];

  const contour = part.contour || {};
  const contourGroup = Object.entries(contour).find(([key]) => key === "regular" || key === "irregular");
  if (contourGroup) {
    const [, contourData] = contourGroup;
    const contourLeaves = [
      ["周长", "perimeter", "mm", fmtNum],
      ["长度", "length", "mm", fmtNum],
      ["宽度", "width", "mm", fmtNum],
      ["高度", "height", "mm", fmtNum],
      ["切削体积", "cuttingVolume", "mm³", fmtNum],
      ["底面面积", "basalArea", "mm²", fmtNum],
      ["间隙比", "gapRatio", "", (v) => (Number.isFinite(Number(v)) ? String(Number(v)) : String(v ?? ""))]
    ].map(([label, key, unit, fmt]) => leafNode(`info:contour:${key}`, label, `${fmt(contourData[key])}${unit ? ` ${unit}` : ""}`));
    infoChildren.push(branchNode("info:contour", "轮廓信息", contourLeaves));
  }
  const contourGroove = Array.isArray(contour.contourGroove) ? contour.contourGroove : [];
  if (contourGroove.length) {
    infoChildren.push(branchNode("info:contourGroove", "轮廓缺口槽 (contourGroove)", contourGroove.map((item, index) => leafNode(
      `info:contourGroove:${index}`,
      `缺口槽 长${fmtDim(item.length)}×宽${fmtDim(item.width)}×深${fmtDim(item.depth)}`,
      item.radius != null ? `四角R${fmtDim(item.radius)}` : ""
    ))));
  }

  return branchNode("info", "整体信息", infoChildren, TYPE_DOTS.info);
}

// ---------- 特征分支 ----------
function buildFeatureBranches(part) {
  const branches = [];
  const counters = {};
  for (const type of FEATURE_TYPES) {
    const instances = collectTypeInstances(part, type);
    if (!instances.length) {
      continue;
    }
    const prefix = type.prefix;
    if (!(prefix in counters)) {
      counters[prefix] = 1;
    }
    const leaves = instances.map((instance) => {
      const code = `${prefix}-${String(counters[prefix]++).padStart(3, "0")}`;
      return leafNode(`feat:${code}`, code, instance.label, instance.entityIds, type.dot);
    });
    branches.push(branchNode(`feat:${type.id}`, type.label, leaves, type.dot));
  }
  const dfmLeaves = buildDfmLeaves(part);
  if (dfmLeaves.length) {
    branches.push(branchNode("dfm", "DFM 信息", [branchNode("dfm:check", "DFM 检查项", dfmLeaves)], TYPE_DOTS.dfm));
  }
  return branches;
}

// ---------- main builder ----------
export function buildFeatureTree(payload) {
  const root = payload && typeof payload === "object" ? payload : {};
  const partType = String(root.partType || "").trim();
  const typeLabel = PART_TYPE_LABELS[partType];
  if (!typeLabel) {
    throw new Error("暂不支持该类零件特征树展示");
  }
  const part = root[partType] && typeof root[partType] === "object" ? root[partType] : root;
  const children = [buildOverview(part, ROUND_TYPES.has(partType))];
  children.push(...buildFeatureBranches(part));
  return [branchNode("part", "零件", children, TYPE_DOTS.info, typeLabel)];
}

// Map STEP entity ids to component face reference ids and attach faceIds to
// every node that carries { highlight: { entityIds } }. Recurses the whole tree.
export function resolveFeatureFaceIds(featureTree, selectorRuntime) {
  const faces = Array.isArray(selectorRuntime?.faces) ? selectorRuntime.faces : [];
  const references = Array.isArray(selectorRuntime?.references) ? selectorRuntime.references : [];
  const faceIdByEntityId = new Map();
  for (const reference of references) {
    if (reference?.selectorType !== "face" || !reference?.id) {
      continue;
    }
    const row = faces[Number(reference.rowIndex)];
    const entityId = Number(row?.stepEntityId);
    if (Number.isFinite(entityId) && entityId > 0) {
      faceIdByEntityId.set(entityId, reference.id);
    }
  }
  const resolve = (node) => {
    if (!node || typeof node !== "object") {
      return node;
    }
    const next = { ...node };
    if (next.highlight && Array.isArray(next.highlight.entityIds)) {
      const faceIds = next.highlight.entityIds
        .map((entityId) => faceIdByEntityId.get(Number(entityId)))
        .filter(Boolean);
      next.faceIds = faceIds;
    }
    if (Array.isArray(next.children)) {
      next.children = next.children.map(resolve);
    }
    return next;
  };
  return (featureTree || []).map(resolve);
}
