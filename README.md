<div align="center">

# 🚀 YMind Pro Studio

**Next-Gen Apple-Crafted Vector Mind Mapping, Outliner & Active Recall Studio**  
*极简 Apple 原生美学 · 万级节点流式渲染 · 线性大纲双向同步 · 3D 抽认卡复习 · 军工级双层信封加密*

[![Version](https://img.shields.io/badge/version-v3.0--ultra-0071e3?style=flat-square&logo=apple)](https://github.com/)
[![License](https://img.shields.io/badge/license-MIT-34c759?style=flat-square)](LICENSE)
[![Frame-Rate](https://img.shields.io/badge/rendering-120_FPS-ff9500?style=flat-square&logo=speedtest)](https://github.com/)
[![Security](https://img.shields.io/badge/encryption-AES--256--GCM-ff3b30?style=flat-square&logo=vault)](https://github.com/)
[![Offline](https://img.shields.io/badge/privacy-100%25_Local_Offline-64748b?style=flat-square&logo=icloud)](https://github.com/)

[🇨🇳 简体中文](#-中文文档) | [🇺🇸 English](#-english-docs)

</div>

---

<a name="-中文文档"></a>
## 🇨🇳 中文文档

**YMind Pro Studio** 是一款为深度思考者、知识工程师与科研人员打造的现代化思维图谱工作室。融合了 **Apple Human Interface Guidelines (HIG)** 极简美学设计哲学，兼具顶级性能与全方位的隐私安全。

### ✨ 核心特性

#### 1. 🍏 极致 Apple 美学设计与「三岛屿」流式架构
* **三岛式流式顶栏**：模式视角岛 `[ 🌳导图 | 📑大纲 | 🎴抽认卡 ]`、纯粹动态节点创作坞 `[ +子主题 | ↵同级 | 📝备注 | 🏷️属性 ]` 与文档状态工具区清晰解耦。
* **高定视觉体系**：0.62 黄金曲率超椭圆（Squircle）、高斯模糊毛玻璃拟物（`backdrop-filter`）、11 款大师级调色盘（莫兰迪、赛博冷霓等）及 15 款舒适画布背景底纹。
* **双语排版引擎**：支持本地系统字体自动扫描检测，中文字形与西文字体独立分流配置。

#### 2. ⚡ 万级节点视锥剔除引擎 (Hierarchical Frustum Culling)
* **10,000+ 节点稳跑 120 FPS**：内置分支级包围盒空间索引（Subtree Bounding Box），`O(1)` 瞬时跳过视口外离屏子树渲染。
* **极度轻量低开销**：DOM 树活跃元素始终控制在 50~150 个，内存占用骤降 90%（~20MB），彻底消除重排（Reflow）与垃圾回收卡顿。
* **Apple 微惯性阻尼动力学**：`friction: 0.86` 算法，画布平移与缩放体验紧实跟手。

#### 3. 🧠 深度学习：3D 抽认卡工坊与现场记忆掩码测试
* **🎴 3D 抽认卡复习 (Alt+F)**：一键将整棵思维导图转化为 Anki 级 3D 翻转卡片，支持 `1/2/3` 掌握度评分与记忆统计。
* **🎭 画布现场记忆测试 (Alt+R)**：所有子节点一键打上磨砂模糊遮罩，支持点按逐一揭晓与复盘。
* **📝 节点富文本 / Markdown 备注 (Alt+N)**：右侧滑出磨砂玻璃抽屉，支持代码块高亮、任务待办清单与实时渲染。

#### 4. 💭 自由浮动主题与多根节点网络 (Floating Nodes)
* **灵感白板自由度**：双击画布任意空白处即可生成独立浮动主题，打破单一根节点约束。
* **自由拖拽移动**：直接鼠标按住浮动节点在无限画布中自由漫游并自动记忆坐标。

#### 5. 🛡️ 军工级双层信封加密与时光机 (Security & Vault)
* **双层信封加密 (Envelope Encryption)**：PBKDF2-HMAC-SHA-512（**600,000 次**高抗爆迭代派生 KEK）封装 256 位 DEK 数据主密钥，数据采用带 AAD 认证头部的 **AES-256-GCM**。
* **毫秒级换密**：修改密码仅需重封 32 字节 DEK，万级节点换密无延迟、零风险。
* **macOS 沉浸式锁屏海报**：动态 4 段式密码强度条、密码提示、输错密码触发经典 macOS 左右弹性抖动（Shake Animation）。
* **版本快照时光机 (Ctrl+Shift+H)**：毫秒级定时自动备份 + 随时手动快照，支持无损覆盖还原与断电崩溃防丢。

---

### ⌨️ 快捷键速查表

| 快捷键 | 功能操作 | 快捷键 | 功能操作 |
| :--- | :--- | :--- | :--- |
| **`Tab`** | 添加子主题 | **`Enter`** | 添加同级分支 |
| **`Delete` / `Backspace`** | 批量删除选中节点 | **`Space` / `F2`** | 快速编辑当前节点文字 |
| **`Alt + 1`** | 切换至 思维导图视图 | **`Alt + 2`** | 切换至 线性大纲视图 |
| **`Alt + F`** | 打开 3D 抽认卡复习工坊 | **`Alt + R`** | 切换 画布现场记忆掩码测试 |
| **`Alt + N`** | 打开 / 编辑节点 Markdown 备注 | **`Alt + L` / `⌘L`** | 打开 安全加密保险箱 |
| **`Alt + C`** | 画布智能自适应居中 | **`⌘F` / `Ctrl + F`** | 全局穿透搜索 |
| **`⌘S` / `Ctrl + S`** | 保存导图文件 | **`⌘Z` / `⌘Y`** | 撤销 / 重做时光机 |
| **`1` ~ `4`** / **`0`** | 设置 P1~P4 优先级 / 清除 | **双击空白画布** | 新建自由浮动主题 |

---

### 📁 项目工程目录

```text
ymind-pro-studio/
├── src/
│   ├── index.html            # 单页核心宿主与 Apple 模态视图层
│   ├── style.css             # 模块化样式聚合入口
│   ├── main.js               # 应用程序全局装配生命周期
│   ├── css/                  # Apple HIG 模块化样式架构
│   │   ├── base.css          # 全局变量、排版与 Reset
│   │   ├── themes.css        # 15 款舒适画布底纹矩阵
│   │   ├── workspace.css     # 三岛式顶栏、画布与大纲排版
│   │   └── dialogs.css       # 抽屉、模态弹窗、3D 抽认卡与锁屏海报
│   └── js/
│       ├── core/             # 核心架构 (Camera, State, Serializer, Tabs)
│       ├── geometry/         # 空间几何计算 (Layout, Squircle, Lines)
│       ├── render/           # 渲染引擎 (Frustum Culling Render, Minimap, Outliner)
│       ├── storage/          # 数据与加密 (Envelope Crypto, Snapshot Machine)
│       ├── ui/               # 交互组件 (Vault, Notes, Flashcards, Search, Settings)
│       └── data/             # 静态预设 (Palettes, Icons, Templates)