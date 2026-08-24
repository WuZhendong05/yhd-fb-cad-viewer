# SETUP：环境搭建与启动指南

> 本文面向**新克隆仓库的同事**。目标：在你的机器上装好依赖，把查看器（3245）和上传 API（8420）跑起来。

## 1. 前置要求

| 依赖 | 版本 | 用途 |
|---|---|---|
| Git | 任意 | 克隆仓库 |
| Node.js | ≥ 18 | 前端构建/开发（Vite） |
| conda 或 Python 3.11 | 3.11 推荐 | CAD Python 环境 |
| Chrome（可选） | 任意 | 仅 `verify_upload.mjs` 无头验证用 |

## 2. 克隆后得到什么 / 没得到什么

```bash
git clone <仓库地址> step-viewer && cd step-viewer
```

**你会得到**：全部源码（`viewer/`、`tools/`）、`README.md`、`SETUP.md`、`.gitignore`。

**你不会得到**（不入库，需自备）：

- **CAD 样本**（`samples/`、`step/` 的真实零件 STEP）——样本需向团队索取或自备（见第 8 节）；
- **运行时数据**（`uploads/`、`__cadgen__/`）；
- **`node_modules`、`dist/`**（构建产物，需 `npm install` / `npm run build`）；
- **CAD Python 环境**（OCP/build123d/cadgen 的 venv）——见第 4 节。

## 3. 前端依赖

```bash
cd viewer
npm install
```

构建生产产物（查看器 serve 模式需要，否则用 `npm run dev`）：

```bash
npm run build
```

## 4. CAD Python 环境（关键，含 OCP）

STEP→GLB 转换依赖 **OCP**（pythonocc-core）、**build123d**、**cadgen**。三者需要装进**同一个** Python 3.11 环境：

```bash
# 建议 conda（pythonocc 用 conda-forge 最省事）
conda create -n cadviewer python=3.11 -y
conda activate cadviewer
conda install -c conda-forge pythonocc-core -y
pip install build123d
pip install -r viewer/requirements.txt    # cadgen==0.4.4
```

**验证**（三条 import 都必须通过，无 ModuleNotFoundError）：

```bash
python -c "import OCP; import build123d; import cadgen.step_artifact; print('CAD 环境 OK')"
```

> 常见坑：
> - **pythonocc 装不上**：优先 conda-forge；pip 只有部分版本有预编译 wheel；Python 3.13 兼容性较差，用 3.11。
> - **`pip install -r viewer/requirements.txt` 找不到 cadgen**：该包来自本仓库 `viewer/packages/cadgen`（editable 安装），如失败先 `pip install -e viewer/packages/cadgen`。
> - 记录你的环境 Python 路径，后面启动查看器要用（记为 `<CAD_PYTHON>`）。

## 5. 环境变量

按需设置（对照 `viewer/.env.example`）：

| 变量 | 说明 |
|---|---|
| `VIEWER_CAD_PYTHON` | CAD 环境 Python 路径（给 `npm run dev/start` 的 shim 用）|
| `VIEWER_API_KEY` | 上传 API 的密钥（业务系统请求头 `Authorization: Bearer <KEY>`）|
| `VIEWER_API_KEY_FILE` | 或从文件读密钥（第一行）|
| `VIEWER_UPLOAD_ROOT` | 上传根目录（默认 `<项目根>\uploads`；**查看器与 API 必须指向同一目录**）|
| `VIEWER_PYTHONOCC_PYTHON` | 含 pythonocc 的 Python 路径（可选，用于 GLB 的 stepEntityId 注入）|
| `VIEWER_BASE` | 测试脚本 `test_link.py`/`test_open.py` 的服务地址（默认 `http://127.0.0.1:3245`）|

## 6. 启动三件套

### 6.1 查看器（3245）

用第 4 节的 CAD 环境 Python 启动（无 OCP 的普通 python 无法构建 GLB）：

```powershell
cd viewer
set PYTHONPATH=%CD%
<CAD_PYTHON> -m server_py.server --host 0.0.0.0 --port 3245
```

- 绑 `0.0.0.0` 可同时被本机与局域网访问；只本机用可 `--host 127.0.0.1`。
- 首次启动会做 CAD 环境自检（import OCP/build123d/cadgen），失败会报错退出并提示。

### 6.2 上传 API（8420）

```powershell
cd viewer
set VIEWER_API_KEY=<你的密钥>
set PYTHONPATH=%CD%
python -m server_py.api_server --port 8420 --host 0.0.0.0 --viewer-host <本机IP> --viewer-port 3245
```

- `--viewer-host <本机IP>`：决定返回的 `viewerUrl` 指向哪个地址（业务系统要能访问它，别写 127.0.0.1 除非纯本机）。
- 密钥建议 `--api-key-file <文件>` 代替命令行明文。

### 6.3 健康检查

```powershell
curl http://127.0.0.1:3245/__cad/server
# {"schemaVersion":1,"app":"cad-viewer",...}
curl http://127.0.0.1:8420/healthz
# {"ok":true,"service":"cad-viewer-upload-api"}
```

## 7. 联调自测

```bash
# 1) 提交（step=文件，features=文本字段）
curl -X POST http://<本机IP>:8420/api/v1/jobs \
  -H "Authorization: Bearer <API_KEY>" \
  -F "step=@part.STEP" \
  -F 'features={"code":200,"partType":"rectangular_part"}'
# → {"jobId":"...","status":"received"}

# 2) 轮询直到 landed，取 result.viewerUrl
curl -H "Authorization: Bearer <API_KEY>" http://<本机IP>:8420/api/v1/jobs/<jobId>
# viewerUrl 形如: http://<本机IP>:3245/?task=<jobId>&file=part.STEP&features=part.特征识别.json

# 3) 浏览器打开该 URL 即可查看模型与特征高亮
```

> PowerShell 里 `-F 'features={...}'` 的双引号可能被剥掉导致 400，用 `--form-string 'features={...}'` 或把 JSON 存文件后 `-F "features=$(Get-Content -Raw f.json)"`。

## 8. 样本数据

`sample/`、`step/` 里的真实零件 STEP **不入库**。需要样本时：

- 向团队/维护者索取（`.step` + 对应 `特征识别.json`）；
- 或放入任意本地目录，用 **path 模式** URL 打开：`http://<host>:3245/<绝对目录>?file=<文件名>`。

## 9. 故障排查

| 现象 | 原因与处理 |
|---|---|
| 查看器启动报 `ModuleNotFoundError: No module named 'OCP'` | 用的 Python 不是第 4 节的 CAD 环境；改用 `<CAD_PYTHON>` 启动 |
| 打开模型报 `Render artifact build failed` | 同上——GLB 构建需要 OCP |
| `npm start` 报 `Port 3245 is already in use` | Windows 下启动器对 `0.0.0.0`/本机 IP 的端口探测会误判；改用 `python -m server_py.server --host 0.0.0.0 --port 3245` 直启 |
| 绑了具体 IP 后 `127.0.0.1` 连不通 | 监听地址是具体 IP 时回环不在范围内；绑 `0.0.0.0` 两者都通 |
| 提交返回 400 `invalid features JSON` | PowerShell 引号问题（见第 7 节）；或 features 字段格式不符 |
| 提交返回 401 | 没带 / 带错 `Authorization: Bearer <KEY>` |
| 任务 `landed` 但模型不显示 | 查看器用的 Python 无 OCP，GLB 构建失败；或查看器未启动/端口不对 |
