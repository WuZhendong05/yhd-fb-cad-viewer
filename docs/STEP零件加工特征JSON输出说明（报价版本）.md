# STEP零件加工特征JSON输出说明（报价版本）

## STEP零件加工特征识别结果 JSON（报价版本）

**输出位置**:

*   与导入的 STEP 文件同一目录下插入链接
    

**输出方式**:

*   解析 STEP 零件后生成报价版本 JSON 文件
    

**json描述**:

本 JSON 用于描述自动报价服务所需的STEP零件特征识别结果。 它保留了零件类型、装夹方式、基础几何信息、主要加工特征、结构化PMI、DFM信息和轮廓实体ID等内容，但整体上比工艺版本更“轻”：

*   不输出 `isIrregularPart`
    
*   不输出 `GeometryScene`
    
*   不输出工艺版本里的原始 `PMIJson`
    
*   大多数特征不输出 `Handle`
    
*   大多数特征不输出 `topPocketFeatureID`、`transitionFeatureID`、`contourLine`
    

同一类特征如果几何参数一致，会在报价版 JSON 中合并输出，并使用 `number` 表示该组特征数量。 但也有一些特征当前源码明确不做合并，例如：

*   `boss`
    
*   `irregularGroove`
    
*   `sawGroove`
    
*   `unRegularRB`
    

**钣金说明**:

当 `partType` 为以下三类之一时：

*   `sheet_metal_panel`
    
*   `sheet_metal_bent`
    
*   `sheet_metal_welded`
    

JSON文件为**钣金版本**。 本文档重点说明**非标零件**输出结构。

---

## 1. 根结构示意

报价版本 JSON 的根节点为一个对象，基础结构如下：

```javascript
{
  "code": 200,
  "partType": "rectangular_part",
  "numOfPart": 0,
  "fixtureType": "Vise",
  "msg": "",
  "rectangular_part": {
    "machinedSurface": {
      "numberOfMachiningSurface": 2,
      "numberOfBevels": 0,
      "numberOfSides": 0
    },
    "partGeometryInformation": {
      "surfaceArea": 14113.31,
      "volume": 74597.72,
      "basalArea": 3894.13,
      "primeDirection": [0.00, 0.00, 1.00],
      "assistantDirection": [1.00, 0.00, 0.00]
    },
    "contour": {
      "regular": {
        "length": 77.03,
        "width": 50.55,
        "height": 30.00,
        "cuttingVolume": 0.00,
        "basalArea": 0.00,
        "gapRatio": 0.000000
      }
    },
    "hole": {
      "throughAndBlindHoles": [
        {
          "number": 2,
          "diameter": 6.00,
          "depth": 10.00,
          "through": true,
          "direction": "top",
          "vector": [0.00, 0.00, 1.00],
          "relatedEntityIds": [[101, 102], [201, 202]],
          "supportFaceId": [56]
        }
      ]
    },
    "groove": {
      "rectangularGroove": {
        "throughRounded": [
          {
            "length": 20.00,
            "width": 10.00,
            "depth": 5.00,
            "number": 1,
            "radius": 2.00,
            "radiusNumber": 4,
            "direction": "top",
            "relatedEntityIds": [[301, 302]],
            "supportFaceId": [56]
          }
        ]
      }
    },
    "curvedSurface": [
      {
        "superficialArea": 8788.38,
        "volume": 47473.89,
        "depth": 16.86,
        "relatedEntityIds": [ 8734, 4093, 1887, 7953, 10852, 1874, 1229 ]
      },
      {
        "superficialArea": 5101.13,
        "volume": 15077.21,
        "depth": 18.76,
        "relatedEntityIds": [ 12794, 6408, 4282, 431, 2293, 953, 11510, 12897, 2134, 9228, 625, 13353, 8764, 10652, 1096, 12551, 13696, 8716, 11451, 3293, 10745, 1379, 10569, 13102, 6252, 12290, 7239 ]
      },
      {
        "superficialArea": 71.37,
        "volume": 59.34,
        "depth": 1.44,
        "relatedEntityIds": [ 12290, 3293 ]
      },
      {
        "superficialArea": 91.11,
        "volume": 99.10,
        "depth": 1.96,
        "relatedEntityIds": [ 7239, 8382, 11451, 10745 ]
      },
      {
        "superficialArea": 0.81,
        "volume": 0.15,
        "depth": 1.01,
        "relatedEntityIds": [ 6506 ]
      },
      {
        "superficialArea": 0.81,
        "volume": 0.15,
        "depth": 1.01,
        "relatedEntityIds": [ 3418 ]
      },
      {
        "superficialArea": 0.81,
        "volume": 0.15,
        "depth": 1.01,
        "relatedEntityIds": [ 4652 ]
      },
      {
        "superficialArea": 0.81,
        "volume": 0.15,
        "depth": 1.01,
        "relatedEntityIds": [ 10832 ]
      }
    ],
    "DFM": {
      "5004": [
        {
          "relatedEntityIds": [383, 742]
        }
      ]
    },
    "ContourID": {
      "Edge": [
        {
          "relatedEntityIds": [549, 287, 616]
        }
      ]
    }
  }
}
```
---

## 2. 字段层级总览

```text
root
├─ code
├─ partType
├─ numOfPart
├─ fixtureType
├─ msg
└─ [partType]
   ├─ machinedSurface                 仅方类零件
   ├─ partGeometryInformation
   ├─ contour                         仅方类零件
   │  ├─ regular / irregular
   │  └─ contourGroove               可选
   ├─ hole
   │  ├─ threadedHole
   │  ├─ throughAndBlindHoles
   │  ├─ counterbore
   │  └─ precisionHole
   ├─ groove
   │  ├─ rectangularGroove
   │  │  ├─ throughRounded
   │  │  ├─ nonThroughRounded
   │  │  ├─ throughSharp
   │  │  └─ nonThroughSharp
   │  ├─ irregularGroove
   │  ├─ sawGroove
   │  ├─ uGroove
   │  │  ├─ through
   │  │  └─ nonThrough
   │  ├─ flat
   │  ├─ keyway
   │  └─ unRegularRB
   ├─ boss
   │  ├─ step
   │  └─ convex
   ├─ specialFeature
   │  ├─ carve
   │  ├─ normalSP
   │  └─ solidThread
   ├─ roundBoss
   │  ├─ outerCircle
   │  ├─ innerCircle
   │  ├─ centreDrilling
   │  ├─ coneCircle
   │  ├─ circlip
   │  └─ circularGroove
   ├─ chamfer
   ├─ fillet
   │  ├─ open
   │  └─ close
   ├─ bevel
   ├─ curvedSurface
   ├─ pmi
   │  ├─ linearTolerance
   │  ├─ geometricTolerance
   │  └─ roughness
   ├─ DFM
   └─ ContourID
```
---

## 3. 与工艺版本的主要区别

报价版本与工艺版本最值得注意的差异有：

1.  根节点更轻不输出 `isIrregularPart`、`GeometryScene`、`PMIJson`
    
2.  大量特征字段被裁剪常见地不再输出：`HandlecontourLinetopPocketFeatureIDtransitionFeatureIDcrossbottomToTopDistance`
    
3.  PMI 结构不同工艺版本输出原始 `PMIJson`报价版本输出结构化后的 `pmi`
    
4.  顶/底面轮廓信息不同工艺版本有 `TopFace`报价版本没有 `TopFace`
    
5.  孔和槽的细分类更少报价版当前不直接输出：`multistageHoleincompleteHoleyhdGroove`
    
6.  圆角输出结构不同工艺版本按 `fillets` 明细输出报价版本按 `open` / `close` 拆分
    

---

## 4. 根节点字段

| 字段名 | 说明 | 是否必须 | 类型 | 备注 |
| --- | --- | --- | --- | --- |
| `code` | 解析状态码 | 是 | integer | `200` 表示成功，失败码见文末 |
| `partType` | 零件类型 | 是 | string | 见“零件类型枚举” |
| `numOfPart` | 其余实体数量 | 是 | integer | STEP 文件中除当前主体外的其他实体数 |
| `fixtureType` | 推荐装夹方式 | 是 | string | 见“装夹方式枚举” |
| `msg` | 解析消息 | 是 | string | 当前源码固定输出空字符串 |
| `[partType]` | 零件主体信息 | 是 | object | 动态字段名，与 `partType` 值相同 |

---

## 5. 零件主体基础字段

### 5.1 方类零件

#### `machinedSurface(加工面信息)`

| 字段名 | 说明 | 类型 | 备注 |
| --- | --- | --- | --- |
| `numberOfMachiningSurface` | 加工表面数量 | integer | 计算方式为 `2 + 斜面方向数 + 侧面方向数` |
| `numberOfBevels` | 斜面方向数量 | integer | 基于识别到的非主方向法向数 |
| `numberOfSides` | 侧面方向数量 | integer | 基于 X/Y 侧向特征方向统计 |

#### `partGeometryInformation(零件几何信息)`

| 字段名 | 说明 | 类型 | 备注 |
| --- | --- | --- | --- |
| `surfaceArea` | 零件表面积 | number |  |
| `volume` | 零件体积 | number |  |
| `basalArea` | 主投影面积 | number | 来自 `m_prtProjectBottomArea` |
| `primeDirection` | 主方向 | array\[number\] | 通常对应矩阵 Z 轴 |
| `assistantDirection` | 辅助方向 | array\[number\] | 通常对应矩阵 X 轴 |

#### `contour(轮廓)`

只在方类零件下输出，且只会输出一种：

*   `regular`
    
*   `irregular`
    

| 字段名 | 说明 | 类型 | 备注 |
| --- | --- | --- | --- |
| `perimeter` | 外轮廓周长 | number | ~~仅~~ `~~irregular~~` ~~输出~~ |
| `length` | 外形长 | number |  |
| `width` | 外形宽 | number |  |
| `height` | 外形高 | number |  |
| `cuttingVolume` | 外形切削体积 | number |  |
| `basalArea` | 外形底面积 | number |  |
| `gapRatio` | 切削体积占包围盒比例 | number | 由 `cuttingVolume / (L*W*H)` 计算 |

#### `contourGroove`

用于描述外轮廓缺口槽。

| 字段名 | 说明 | 类型 | 备注 |
| --- | --- | --- | --- |
| `number` | 同参数缺口槽数量 | integer | 相同几何参数会合并 |
| `bottomArea` | 底面积 | number |  |
| `perimeter` | 周长 | number |  |
| `length` | 长度 | number |  |
| `width` | 宽度 | number |  |
| `depth` | 深度 | number |  |
| `radius` | 最小圆角半径 | number |  |
| `radiusDepth` | 圆角深度 | number |  |
| `radiusNumber` | 圆角数量 | integer |  |

### 5.2 圆类零件

按圆类零件方式输出。

此时通常不输出 `machinedSurface` 和 `contour`，而是输出：

| 字段名 | 说明 | 类型 | 备注 |
| --- | --- | --- | --- |
| `diameterMax` | 最大直径 | number | `m_maxRadius * 2` |
| `lengthMax` | 最大长度 | number |  |
| `surfaceArea` | 表面积 | number |  |
| `volume` | 体积 | number |  |

---

## 6. 通用字段约定

| 字段名 | 说明 | 类型 | 备注 |
| --- | --- | --- | --- |
| `number` | 合并后的数量 | integer | 同参数特征合并后输出数量 |
| `relatedEntityIds` | 关联实体 ID | array\[integer\] 或 array\[array\[integer\]\] | 单特征常为一维数组，合并输出时常为二维数组 |
| `supportFaceId` | 支持面 ID | array\[integer\] | 多数特征为单元素数组，如 `[56]` |
| `direction` | 特征方向 | string | 见“方向枚举” |
| `vector` | 方向向量 | array\[number\] | 三维向量 `[x, y, z]` |
| `through` | 是否贯穿 | boolean | 报价版仅部分特征输出 |
| `length` / `width` / `depth` / `height` | 线性尺寸 | number | 单位通常为 mm |
| `diameter` / `diameterMax` / `diameterMin` | 圆类尺寸 | number | 单位通常为 mm |
| `basalArea` / `bottomArea` | 底面积 | number | 字段含义随节点略有差异 |
| `surfaceArea` / `superficialArea` | 表面积 | number |  |
| `volume` / `cuttingVolume` | 体积或切削体积 | number |  |
| `steelMachiningTime` | 钢件加工时间估算 | number | 主要见复杂槽、凸台 |
| `aluminumMachiningTime` | 铝件加工时间估算 | number | 主要见复杂槽、凸台 |

---

## 7. 孔特征 `hole`

报价版当前输出四类孔：

*   `threadedHole`
    
*   `throughAndBlindHoles`
    
*   `counterbore`
    
*   `precisionHole`
    

当前源码中 **不直接输出**：

*   `multistageHole`
    
*   `incompleteHole`
    

### 7.1 `throughAndBlindHoles`

| 字段名 | 说明 | 类型 |
| --- | --- | --- |
| `number` | 数量 | integer |
| `diameter` | 直径 | number |
| `depth` | 深度 | number |
| `through` | 是否贯穿 | boolean |
| `direction` | 方向 | string |
| `vector` | 方向向量 | array\[number\] |
| `relatedEntityIds` | 关联实体 ID | array\[array\[integer\]\] |
| `supportFaceId` | 支持面 ID | array\[integer\] |

### 7.2 `threadedHole`

| 字段名 | 说明 | 类型 |
| --- | --- | --- |
| `number` | 数量 | integer |
| `diameter` | 小径/底孔直径 | number |
| `diameterMajor` | 大径 | number |
| `depth` | 底孔深度 | number |
| `depthMajor` | 螺纹有效深度 | number |
| `pitch` | 螺距 | number |
| `through` | 是否贯穿 | boolean |
| `direction` | 方向 | string |
| `vector` | 方向向量 | array\[number\] |
| `relatedEntityIds` | 关联实体 ID | array\[array\[integer\]\] |
| `supportFaceId` | 支持面 ID | array\[integer\] |

说明：

*   报价版当前不输出 `threadSpecification`
    
*   报价版当前不输出 `threadHoleToothType`
    

### 7.3 `counterbore`

| 字段名 | 说明 | 类型 | 备注 |
| --- | --- | --- | --- |
| `type` | 圆柱段数量 | integer | 当前按 `GetDiameterVec().size()` 输出 |
| `number` | 数量 | integer |  |
| `diameterMax` | 大圆柱段 | object | 含 `diameter`、`depth` |
| `diameterMid` | 中圆柱段 | object | 仅三段时输出 |
| `diameterMin` | 小圆柱段 | object | 含 `diameter`、`depth` |
| `through` | 是否贯穿 | boolean |  |
| `direction` | 方向 | string |  |
| `vector` | 方向向量 | array\[number\] |  |
| `relatedEntityIds` | 关联实体 ID | array\[array\[integer\]\] |  |
| `supportFaceId` | 支持面 ID | array\[integer\] |  |

### 7.4 `precisionHole`

| 字段名 | 说明 | 类型 | 备注 |
| --- | --- | --- | --- |
| `type` | 圆柱段数量 | integer |  |
| `number` | 数量 | integer |  |
| `diameter` | 单段孔直径 | number | 仅 `type == 1` |
| `depth` | 单段孔深度 | number | 仅 `type == 1` |
| `diameterMax` | 大圆柱段 | object | `type >= 2` |
| `diameterMid` | 中圆柱段 | object | `type == 3` |
| `diameterMin` | 小圆柱段 | object | `type >= 2` |
| `through` | 是否贯穿 | boolean |  |
| `direction` | 方向 | string |  |
| `vector` | 方向向量 | array\[number\] |  |
| `relatedEntityIds` | 关联实体 ID | array\[array\[integer\]\] |  |
| `supportFaceId` | 支持面 ID | array\[integer\] |  |

---

## 8. 槽特征 `groove`

报价版槽特征包含：

*   `rectangularGroove`
    
*   `irregularGroove`
    
*   `sawGroove`
    
*   `uGroove`
    
*   `flat`
    
*   `keyway`
    
*   `unRegularRB`
    

### 8.1 `rectangularGroove`

包含四类：

*   `throughRounded`
    
*   `nonThroughRounded`
    
*   `throughSharp`
    
*   `nonThroughSharp`
    

公共字段：

| 字段名 | 说明 | 类型 |
| --- | --- | --- |
| `length` | 长度 | number |
| `width` | 宽度 | number |
| `depth` | 深度 | number |
| `number` | 数量 | integer |
| `radius` | 圆角半径 | number / null |
| `radiusNumber` | 圆角数量 | integer / null |
| `direction` | 方向 | string |
| `relatedEntityIds` | 关联实体 ID | array\[array\[integer\]\] |
| `supportFaceId` | 支持面 ID | array\[integer\] |

说明：

*   圆角槽的 `radius`、`radiusNumber` 为实际值
    
*   尖角槽的 `radius`、`radiusNumber` 输出 `null`
    

### 8.2 `irregularGroove`

报价版中的不规则槽字段与工艺版差异较大，实际以源码为准：

| 字段名 | 说明 | 类型 | 备注 |
| --- | --- | --- | --- |
| `number` | 数量 | integer | 当前固定输出 `1` |
| `steelMachiningTime` | 钢件加工时间估算 | number |  |
| `aluminumMachiningTime` | 铝件加工时间估算 | number |  |
| `roundSteelMachiningTime` | 特殊附加参数 | number | <font color='red'>未知，需要核实 |
| `roundAluminumMachiningTime` | 特殊附加参数 | number | <font color='red'>未知，需要核实 |
| `basalArea` | 底面积 | number |  |
| `basalPerimeter` | 底面周长 | number |  |
| `through` | 是否贯穿 | boolean |  |
| `width` | 宽度 | number | 实际写入“不规则槽最大内切圆半径” |
| `depth` | 深度 | number |  |
| `direction` | 方向 | string |  |
| `relatedEntityIds` | 关联实体 ID | array\[integer\] | 单个不规则槽不合并 |
| `supportFaceId` | 支持面 ID | array\[integer\] |  |

### 8.3 `sawGroove`

| 字段名 | 说明 | 类型 |
| --- | --- | --- |
| `number` | 数量 | integer |
| `length` | 长度 | number |
| `width` | 宽度 | number |
| `depth` | 深度 | number |
| `direction` | 方向 | string |
| `relatedEntityIds` | 关联实体 ID | array\[integer\] |
| `supportFaceId` | 支持面 ID | array\[integer\] |

说明：

*   报价版当前不输出工艺版里的 `sideWallType`
    
*   报价版当前不输出 `bDepth`、`cHeight`
    

### 8.4 `uGroove`

包含：

*   `through`
    
*   `nonThrough`
    

字段相同：

| 字段名 | 说明 | 类型 |
| --- | --- | --- |
| `length` | 长度 | number |
| `width` | 宽度 | number |
| `depth` | 深度 | number |
| `number` | 数量 | integer |
| `direction` | 方向 | string |
| `relatedEntityIds` | 关联实体 ID | array\[array\[integer\]\] |
| `supportFaceId` | 支持面 ID | array\[integer\] |

### 8.5 `flat`

仅圆类零件常见。

| 字段名 | 说明 | 类型 |
| --- | --- | --- |
| `number` | 数量 | integer |
| `length` | 长度 | number |
| `width` | 宽度 | number |
| `depth` | 深度 | number |
| `direction` | 方向 | string |
| `relatedEntityIds` | 关联实体 ID | array\[array\[integer\]\] |

说明：

*   报价版中的 `flat` 通常对应**圆类零件上的扁位(这个说法感觉有问题)**
    
*   当前源码不输出 `supportFaceId`
    

### 8.6 `keyway`

| 字段名 | 说明 | 类型 |
| --- | --- | --- |
| `number` | 数量 | integer |
| `length` | 长度 | number |
| `width` | 宽度 | number |
| `depth` | 深度 | number |
| `through` | 是否贯穿 | boolean |
| `direction` | 方向 | string |
| `relatedEntityIds` | 关联实体 ID | array\[array\[integer\]\] |

说明：

*   当前源码不输出 `supportFaceId`
    

### 8.7 `unRegularRB`

即不规则回转型槽。

| 字段名 | 说明 | 类型 |
| --- | --- | --- |
| `number` | 数量 | integer |
| `steelMachiningTime` | 钢件加工时间估算 | number |
| `aluminumMachiningTime` | 铝件加工时间估算 | number |
| `basalArea` | 底面积 | number |
| `depth` | 深度 | number |
| `relatedEntityIds` | 关联实体 ID | array\[array\[integer\]\] |

说明：

*   当前报价版不输出 `length`
    
*   当前报价版不输出 `width`
    
*   当前报价版不输出 `direction`
    
*   当前报价版不输出 `supportFaceId`
    

---

## 9. 凸台、特殊加工、回转类特征

### 9.1 `boss`

报价版输出：

*   `step`
    
*   `convex`
    

公共字段：

| 字段名 | 说明 | 类型 |
| --- | --- | --- |
| `number` | 数量 | integer |
| `steelMachiningTime` | 钢件加工时间估算 | number |
| `aluminumMachiningTime` | 铝件加工时间估算 | number |
| `basalArea` | 底面积 | number |
| `basalPerimeter` | 底面周长 | number |
| `through` | 是否贯穿 | boolean |
| `depth` | 深度 | number |
| `direction` | 方向 | string |
| `relatedEntityIds` | 关联实体 ID | array\[integer\] |
| `supportFaceId` | 支持面 ID | array\[integer\] |

说明：

*   报价版 `boss` 当前不合并，同类对象通常逐个输出，`number` 实际固定为 `1`
    

### 9.2 `specialFeature`

报价版输出：

*   `carve`
    
*   `normalSP`
    
*   `solidThread`
    

公共字段：

| 字段名 | 说明 | 类型 |
| --- | --- | --- |
| `number` | 数量 | integer |
| `basalArea` | 底面积 | number |
| `cuttingVolunmn` | 切削体积 | number |
| `through` | 是否贯穿 | boolean |
| `length` | 长度 | number |
| `width` | 宽度 | number |
| `depth` | 深度 | number |
| `direction` | 方向 | string |
| `relatedEntityIds` | 关联实体 ID | array\[integer\] |
| `supportFaceId` | 支持面 ID | array\[integer\] |

说明：

*   字段名在源码中拼写为 `cuttingVolunmn`
    

### 9.3 `roundBoss`

报价版输出：

*   `outerCircle`
    
*   `innerCircle`
    
*   `centreDrilling`
    
*   `coneCircle`
    
*   `circlip`
    
*   `circularGroove`
    

#### `outerCircle`

| 字段名 | 说明 | 类型 |
| --- | --- | --- |
| `number` | 数量 | integer |
| `diameter` | 直径 | number |
| `length` | 长度 | number |
| `relatedEntityIds` | 关联实体 ID | array\[array\[integer\]\] |

#### `innerCircle` / `centreDrilling`

| 字段名 | 说明 | 类型 | 备注 |
| --- | --- | --- | --- |
| `number` | 数量 | integer |  |
| `diameter` | 直径 | number |  |
| `length` | 长度 | number |  |
| `type` | 底面类型 | string | `unknow`、`plane`、`cone` |
| `relatedEntityIds` | 关联实体 ID | array\[array\[integer\]\] |  |

#### `coneCircle`

| 字段名 | 说明 | 类型 |
| --- | --- | --- |
| `number` | 数量 | integer |
| `angle` | 水平夹角 | number |
| `volume` | 体积 | number |
| `length` | 长度 | number |
| `contourLength` | 轮廓长度 | number |
| `diameter` | 直径 | number |
| `relatedEntityIds` | 关联实体 ID | array\[array\[integer\]\] |

#### `circlip` / `circularGroove`

| 字段名 | 说明 | 类型 |
| --- | --- | --- |
| `number` | 数量 | integer |
| `diameterMax` | 最大直径 | number |
| `diameterMin` | 最小直径 | number |
| `length` | 长度 | number |
| `relatedEntityIds` | 关联实体 ID | array\[array\[integer\]\] |

---

## 10. 倒角、圆角、斜面、曲面

### 10.1 `chamfer`

报价版中 `chamfer` 是数组，每个对象表示一组同宽度倒角。

| 字段名 | 说明 | 类型 |
| --- | --- | --- |
| `width` | 倒角宽度 | number |
| `number` | 倒角面数量 | integer |
| `relatedEntityIds` | 关联实体 ID | array\[array\[integer\]\] |

### 10.2 `fillet`

报价版 `fillet` 不是数组，而是一个对象，分成：

*   `open`
    
*   `close`
    

#### `open`

| 字段名 | 说明 | 类型 |
| --- | --- | --- |
| `type` | 圆角类型 | string |
| `xDirectionDistance` | X 向距离 | number |
| `surfaceDistance` | 曲面距离 | number |
| `width` | 圆角宽度/半径 | number |
| `number` | 数量 | integer |
| `relatedEntityIds` | 关联实体 ID | array\[array\[integer\]\] |

#### `close`

| 字段名 | 说明 | 类型 |
| --- | --- | --- |
| `type` | 圆角类型 | string |
| `outerPerimeter` | 外周长 | number |
| `innerPerimeter` | 内周长 | number |
| `xDirectionDistance` | X 向距离 | number |
| `surfaceDistance` | 曲面距离 | number |
| `width` | 圆角宽度/半径 | number |
| `number` | 数量 | integer |
| `relatedEntityIds` | 关联实体 ID | array\[array\[integer\]\] |

`type` 取值：

*   `concaveFillet`
    
*   `convexFillet`
    

### 10.3 `bevel`

| 字段名 | 说明 | 类型 |
| --- | --- | --- |
| `superficialArea` | 表面积 | number |
| `volume` | 体积 | number |
| angle | 水平倾角 | number |
| `depth` | 最大深度 | number |
| `relatedEntityIds` | 关联实体 ID | array\[integer\] |

说明：

*   报价版中的 `bevel` 比工艺版更简化
    
*   当前不输出 `type`、`innerWidth`、`bevelWidth`、`partThickness` 等字段
    

### 10.4 `curvedSurface`

| 字段名 | 说明 | 类型 |
| --- | --- | --- |
| `superficialArea` | 曲面表面积 | number |
| `volume` | 加工体积 | number |
| `depth` | 最大深度 | number |
| `relatedEntityIds` | 关联实体 ID | array\[integer\] |

---

## 12. DFM 与轮廓字段

### 12.1 `DFM`

报价版实际输出的是 `m_dfmIDVec`，即各 DFM 编号命中的面 ID，不输出完整 DFM 特征几何对象。

可能出现的编号包括：

*   `3001`
    
*   `3003`
    
*   `3004`
    
*   `4001`
    
*   `4002`
    
*   `5001`
    
*   `5002`
    
*   `5003`
    
*   `5004`
    
*   `5005`
    
*   `5006`
    
*   `6001`
    
*   `6003`
    
*   `6004`
    
*   `6005`
    

每个编号下的对象结构相同：

| 字段名 | 说明 | 类型 |
| --- | --- | --- |
| `relatedEntityIds` | 关联实体 ID | array\[integer\] |

### 12.2 `ContourID`

报价版在成功输出时按源码设计会写出 `ContourID` 节点。

结构如下：

```javascript
"ContourID": {
  "Edge": [
    {
      "relatedEntityIds": [id1, id2, id3]
    }
  ]
}
```

字段说明：

| 字段名 | 说明 | 类型 |
| --- | --- | --- |
| `relatedEntityIds` | 外轮廓边 ID 列表 | array\[integer\] |

---

## 13. 零件类型枚举

| partType | 说明 |
| --- | --- |
| `rectangular_part` | 方件 |
| `rectangular_board_part` | 大板 |
| `round_pure_part` | 纯圆件 |
| `round_rectangular_part` | 车铣件 |
| `sheet_metal_panel` | 钣金平板 |
| `sheet_metal_bent` | 钣金折弯件 |
| `sheet_metal_welded` | 钣金焊接件 |

---

## 14. 装夹方式枚举

| fixtureType | 说明 |
| --- | --- |
| `FiveAxisClamp` | 五轴装夹 |
| `FourAxisClamp` | 四轴装夹 |
| `SuctionCupNesting` | 吸盘排布 |
| `SingleSuctionCup` | 单吸盘 |
| `PressurePlate` | 压板 |
| `Vise` | 虎钳 |
| `Unknow` | 未知/未识别 |

---

## 15. 方向枚举

| direction | 说明 |
| --- | --- |
| `top` | 顶面方向 |
| `bottom` | 底面方向 |
| `front` | 前侧方向 |
| `back` | 后侧方向 |
| `left` | 左侧方向 |
| `right` | 右侧方向 |
| `none` | 非标准六向或无法归类方向 |

---

## 16. 其他枚举

| 字段 | 取值 | 说明 |
| --- | --- | --- |
| `roundBoss.type` | `unknow` / `plane` / `cone` | 内圆/中心钻的底面类型，未知、平面、锥面 |
| `fillet.type` | `concaveFillet` / `convexFillet` | 凹圆角 / 凸圆角 |

---

## 17. 状态码说明

| 状态码 | 说明 |
| --- | --- |
| `200` | 解析成功 |
| `50001` | 解析失败 |
| `50002` | 解析失败 |
| `50003` | 解析失败 |
| `50005` | 解析失败 |
| `50007` | 解析失败 |
| `50008` | 解析超时 |

---

## 18. 补充说明

1.  本文档描述的是报价版本 JSON，也就是 `rbcFirstVersion` 对应的输出结构。
    
2.  报价版是结构化特征说明，不等同于工艺版，因此字段不追求“最全”，而是偏向报价所需。
    
3.  除特别说明外，没有识别到的特征类别通常不会输出空数组。
    
4.  文中所有长度、面积、体积单位通常分别为 mm、mm²、mm³。
    
5.  部分字段命名完全以当前源码为准，例如：`cuttingVolunmnroundSteelMachiningTimeroundAluminumMachiningTimeunknow`这些拼写在业务上不一定最理想，但为了和现有 JSON 严格一致，文档保持原样。
    
6.  钣金零件走的是 `rbcSheetMetalWriteFile` 分支，字段结构可能与本文档不同，使用时需要单独对照钣金输出逻辑。