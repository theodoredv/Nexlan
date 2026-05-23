# Nexlan

局域网文件传输与实时聊天工具。无需注册，打开即用，同一网络下的设备可以互相传输文件和聊天。

## 功能特性

- **文件传输** — 支持大文件分片上传、断点续传、MD5 秒传、上传取消
- **实时聊天** — 基于 SSE 的消息推送，多设备实时同步，自动重连
- **文件预览** — 支持图片、视频、PDF、文本在线预览
- **设备识别** — 自动分配设备 ID 和昵称，支持跨浏览器识别
- **深色模式** — 支持深色/浅色主题切换
- **响应式布局** — 适配桌面端和移动端
- **聊天记录管理** — 搜索、日期筛选、批量删除
- **错误边界** — 子组件崩溃不会导致白屏
- **健康检查** — 运行状态、内存、磁盘、连接数监控

## 技术栈

- **前端**: React 18 + TypeScript + Tailwind CSS + Zustand
- **后端**: Express + TypeScript
- **构建**: Vite
- **实时通信**: Server-Sent Events (SSE) + 心跳检测 + 自动重连
- **文件处理**: Multer + 分片上传 + MD5 (SparkMD5 + Web Worker)

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装

```bash
git clone https://github.com/theodoredv/Nexlan.git
cd Nexlan
npm install
```

### 配置

```bash
cp .env.example .env
```

编辑 `.env` 文件可修改配置：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 服务端口 | `34567` |
| `UPLOAD_LIMIT` | 文件上传大小限制 | `10mb` |
| `NODE_ENV` | 环境类型 | `development` |
| `VITE_CLIENT_PORT` | 前端开发服务器端口（仅开发模式） | `5175` |

### 开发模式

```bash
npm run dev
```

前后端同时启动，前端通过 Vite 开发服务器（5175 端口），后端通过 nodemon 热重载（34567 端口）。

如需统一端口访问，可额外启动反向代理：

```bash
node proxy.js
# 访问 http://localhost:8080
```

### 生产部署

#### 方式一：直接运行（推荐）

```bash
npm run build      # 构建前端
npm start          # 启动生产服务
```

生产模式下 Express 同时托管前端静态文件和 API，**单进程**即可运行。局域网其他设备访问 `http://你的IP:34567` 即可使用。

#### 方式二：Docker 部署

```bash
docker compose up -d
```

自动构建镜像、安装依赖、启动服务，数据持久化到 Docker volumes。

#### 方式三：Nginx 反向代理

如需 80 端口或 HTTPS，使用 Nginx 代理到 Express：

```bash
# macOS
sudo cp nginx.conf /usr/local/etc/nginx/servers/

# Linux
sudo cp nginx.conf /etc/nginx/conf.d/
```

#### 方式四：PM2 守护进程

```bash
pm2 start ecosystem.config.json
```

## 项目结构

```
nexlan/
├── api/                  # 后端 API
│   ├── app.ts           # Express 应用（含静态文件托管）
│   ├── server.ts        # 服务器入口
│   ├── sse.ts           # SSE 连接管理器
│   ├── logger.ts        # 日志模块
│   └── routes/          # API 路由
│       ├── files.ts     # 文件上传/下载/预览
│       ├── messages.ts  # 聊天消息
│       ├── network.ts   # 网络信息
│       └── deviceNames.ts # 设备命名
├── src/                  # 前端源码
│   ├── components/      # React 组件
│   ├── hooks/           # 自定义 Hooks
│   ├── store/           # Zustand 状态管理
│   ├── utils/           # 工具函数
│   ├── config/          # 配置
│   └── pages/           # 页面
├── shared/               # 前后端共享类型
│   └── types.ts
├── public/               # 静态资源
├── data/                 # 运行时数据
├── Dockerfile            # Docker 镜像构建
├── docker-compose.yml    # Docker Compose 编排
├── nginx.conf            # Nginx 反向代理配置
└── ecosystem.config.json # PM2 配置
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查（内存、磁盘、连接数） |
| GET | `/api/files` | 获取文件列表 |
| POST | `/api/files/check-file` | 检查文件是否存在（秒传） |
| POST | `/api/files/upload-chunk` | 上传文件分片 |
| POST | `/api/files/merge-chunks` | 合并文件分片 |
| GET | `/api/files/:id/preview` | 文件预览 |
| GET | `/api/files/:id/download` | 文件下载 |
| DELETE | `/api/files/:id` | 删除文件 |
| GET | `/api/messages` | 获取消息列表 |
| POST | `/api/messages/send` | 发送消息 |
| DELETE | `/api/messages/:id` | 删除消息 |
| GET | `/api/network` | 获取网络信息 |
| GET | `/api/device-names/:deviceId` | 获取/创建设备名 |
| POST | `/api/device-names/:deviceId` | 修改设备名 |

## License

MIT
