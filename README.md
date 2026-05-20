# 🎨 小祥绘图

基于 OpenAI gpt-image 系列 API 的 AI 图像生成工作台，支持文生图、参考图编辑与遮罩功能。

纯前端应用，所有数据保存在浏览器本地 IndexedDB，不经过任何第三方服务器。

## ✨ 功能特性

- **双模接口** — 支持 Images API (`/v1/images`) 和 Responses API (`/v1/responses`)
- **SSE 流式传输** — 实时进度条，图片逐步显现
- **参考图与遮罩** — 上传参考图、内置遮罩编辑器
- **多服务商** — OpenAI 兼容接口、fal.ai、自定义 HTTP 服务商
- **多配置管理** — 保存多套 API 配置，一键切换
- **历史管理** — 本地存储，瀑布流浏览，批量操作，ZIP 导出
- **参数追踪** — 请求参数与 API 实际生效参数对比展示

## 🐳 Docker 部署

### 1. 克隆项目

```bash
git clone https://github.com/Makima04/saki-image-web.git
cd saki-image-web
```

### 2. 构建镜像并启动

```bash
docker compose build
docker compose up -d
```

### 3. 访问应用

打开浏览器访问 `http://localhost:12324`

### 常用命令

```bash
# 查看运行状态
docker compose ps

# 查看日志
docker compose logs -f

# 停止服务
docker compose down
```

## 💻 本地开发

```bash
npm install
npm run dev
```

访问 `http://localhost:5173`

## 🛠️ 技术栈

React 19 · TypeScript · Vite · Tailwind CSS · Zustand · IndexedDB

## 📄 许可证

[MIT License](LICENSE)
