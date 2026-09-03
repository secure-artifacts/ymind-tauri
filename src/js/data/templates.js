export const TEMPLATES = {
  "ymind-feature-tour": {
    "id": "ymind-feature-tour",
    "name": "🚀 YMind Pro 功能与实战全景",
    "icon": "🌟",
    "desc": "一图掌握全部功能：骨架、200+图标、Markdown备注、3D抽认卡、记忆掩码、加密保险箱与时光机",
    "category": "scenario",
    "layout": "mindmap",
    "data": {
      "id": "root",
      "text": "🚀 YMind Pro 全功能实战指南",
      "note": "### 欢迎使用 YMind Pro Studio\n\n这是一份交互式全景实战指南，带你体验 **思维导图、大纲文档、3D记忆抽认卡与加密保险箱** 的极致生产力！\n\n- **查看备注**：选中任意节点按 `Alt+N` 查看富文本与代码块\n- **3D 抽认卡**：按 `Alt+F` 将当前导图一键转换为记忆复习卡片\n- **记忆掩码测试**：按 `Alt+R` 开启现场模糊遮罩自测\n- **双向大纲**：按 `Alt+2` 进入线性 Markdown 大纲模式\n- **版本时光机**：按 `Ctrl+Shift+H` 查看历史版本快照",
      "children": [
        {
          "id": "tour_1",
          "text": "📐 核心骨架与排版美学",
          "icon": "🎨",
          "priority": "P1",
          "progress": "100%",
          "tags": ["视觉系统", "排版"],
          "note": "### 视觉与排版系统\n遵循 Apple Human Interface Guidelines 设计规范，提供极致的留白、比例与对比度控制。\n\n- **自适应布局**：自动计算节点字形宽度与几何间距，杜绝重叠\n- **Retina 高清**：Canvas 矢量级高帧率渲染，任意缩放不失真",
          "children": [
            {
              "id": "tour_1_1",
              "text": "🌳 4 款经典思维骨架",
              "children": [
                { "id": "tour_1_1_1", "text": "经典双向导图：左右动态平衡，激发发散性联想与头脑风暴", "tags": ["推荐"], "children": [] },
                { "id": "tour_1_1_2", "text": "向右逻辑推导：严谨因果链条，适合PRD、方案设计与敏捷迭代", "children": [] },
                { "id": "tour_1_1_3", "text": "向左逆向归因：逆向回溯根因，适合故障排查、复盘与根因分析", "children": [] },
                { "id": "tour_1_1_4", "text": "组织架构图：自上而下纵向层级流动，权责结构一目了然", "children": [] }
              ]
            },
            {
              "id": "tour_1_2",
              "text": "🌈 20 款大师配色方案",
              "children": [
                { "id": "tour_1_2_1", "text": "经典系列：Apple经典 / 温暖手绘 / 包豪斯极简 / 剑桥古典", "children": [] },
                { "id": "tour_1_2_2", "text": "自然系列：京都抹茶木 / 极地冷杉 / 鼠尾草园 / 初夏薄荷 / 深海蓝浪", "children": [] },
                { "id": "tour_1_2_3", "text": "雅致系列：莫兰迪雅致 / 陶土日晒 / 斯堪的纳 / 焦糖拿铁 / 法式马卡龙", "children": [] },
                { "id": "tour_1_2_4", "text": "深邃系列：落日晚霞 / 灵动星云 / 复古浪潮 / 赛博霓虹 / 极光暮色 / 石墨极客", "children": [] }
              ]
            },
            {
              "id": "tour_1_3",
              "text": "〰️ 5 款几何连线与 4 款卡片形态",
              "children": [
                { "id": "tour_1_3_1", "text": "连线算法：平滑贝塞尔曲线 / 圆角折线 / 直角折线 / 极简直线 / 现代圆弧", "children": [] },
                { "id": "tour_1_3_2", "text": "卡片形态：超椭圆 (Squircle 0.62) / 几何方框 / 极简下划线 / 实色填充", "children": [] }
              ]
            },
            {
              "id": "tour_1_4",
              "text": "🖼 15 款画布底色与 15 款工程底纹",
              "children": [
                { "id": "tour_1_4_1", "text": "15款底色：雪域纯白 / 暖心象牙 / 复古羊皮 / 京都抹茶 / 深空灰钛 / 极夜黑曜等", "children": [] },
                { "id": "tour_1_4_2", "text": "15款底纹：点阵 / 方格 / 等距 / 准星 / 横线 / 蓝图 / 谱线 / 坐标网格等", "children": [] }
              ]
            }
          ]
        },
        {
          "id": "tour_2",
          "text": "⌨️ 极速创作与键盘流体系",
          "icon": "⚡",
          "priority": "P1",
          "progress": "100%",
          "tags": ["生产力", "快捷键"],
          "note": "### 极速创作快捷键速查表\n\n| 操作 | 快捷键 | 功能描述 |\n| :--- | :--- | :--- |\n| **添加子级** | `Tab` | 选中节点下新建子主题并聚焦编辑 |\n| **添加同级** | `Enter` | 在当前节点后新增同级主题 |\n| **就地编辑** | `F2` 或 `双击` | 直接呼出当前节点的文本行内编辑器 |\n| **删除节点** | `Delete` / `Backspace` | 删除当前选中的节点及其子分支 |\n| **四向穿透漫游** | `↑` `↓` `←` `→` | 在导图树分支之间无极切换选中焦点 |\n| **撤销 / 重做** | `⌘Z` / `⌘Y` | 50步结构化撤销/重做栈 |\n| **保存文件** | `⌘S` | 保存并自动落盘到本地沙箱/文件系统 |",
          "children": [
            {
              "id": "tour_2_1",
              "text": "🌟 200+ 专属分类图标库",
              "children": [
                { "id": "tour_2_1_1", "text": "涵盖精选、任务状态、商务办公、人物团队、符号方向、创意构想、科技研发等 7 大分类", "children": [] },
                { "id": "tour_2_1_2", "text": "右侧格式检查器一键点选，支持随时清除或通过顶栏属性菜单快速插入", "children": [] }
              ]
            },
            {
              "id": "tour_2_2",
              "text": "🚩 优先级、环形进度与多维标签",
              "children": [
                { "id": "tour_2_2_1", "text": "四级优先级徽标 (P1 紧急 ~ P4 低优)，支持键盘快捷键 1~4 快速标记", "priority": "P1", "children": [] },
                { "id": "tour_2_2_2", "text": "25% ~ 100% 动态微型进度指示圆点，清晰把控任务推进全流程", "progress": "75%", "children": [] },
                { "id": "tour_2_2_3", "text": "自由标签胶囊管理器：输入后按回车即刻上标，支持按标签穿透过滤", "tags": ["待跟进", "核心需求"], "children": [] }
              ]
            },
            {
              "id": "tour_2_3",
              "text": "📦 矩形批量框选 (Shift+拖拽)",
              "children": [
                { "id": "tour_2_3_1", "text": "按住 Shift 键在画布拖出柔光蓝选框，批量选中范围内所有分支", "children": [] },
                { "id": "tour_2_3_2", "text": "支持批量统一修改文字颜色、批量设定优先级/标签或一键粉碎删除", "children": [] }
              ]
            }
          ]
        },
        {
          "id": "tour_3",
          "text": "📝 富文本 Markdown 节点备注",
          "icon": "📝",
          "priority": "P1",
          "progress": "100%",
          "tags": ["富文本", "知识管理"],
          "note": "### 节点富文本备注能力\n\n```javascript\n// 支持在备注中记录代码实现逻辑与算法要点\nfunction calculateMomentum(velocity, friction) {\n  return velocity * Math.exp(-friction * 16);\n}\n```\n\n- [x] 完成脑图骨架几何解算\n- [x] 实现 IndexedDB 百兆级快照库\n- [ ] 进行第二轮抽认卡主动复习\n\n> **设计哲学**：主画布保持极度精炼的高层级要点，详细推导与长篇参考资料置于抽屉中，实现心流不中断。",
          "children": [
            {
              "id": "tour_3_1",
              "text": "快捷呼出抽屉 (Alt+N)",
              "note": "选中任意节点直接按下 `Alt+N` 即可滑动展开右侧 Markdown 抽屉面板，按 `Esc` 或点击 `✕` 收起。",
              "children": []
            },
            {
              "id": "tour_3_2",
              "text": "双模切换与实时渲染",
              "children": [
                { "id": "tour_3_2_1", "text": "顶部一键切换「✍️ 编辑」与「👁️ 预览」视图", "children": [] },
                { "id": "tour_3_2_2", "text": "完整支持 H1~H3 标题、语法高亮代码块、待办复选框、引用块与无序列表", "children": [] },
                { "id": "tour_3_2_3", "text": "输入过程防抖自动保存至树结构，撤销/重做栈完整追踪备注变动", "children": [] }
              ]
            }
          ]
        },
        {
          "id": "tour_4",
          "text": "🧠 深度认知与主动复盘引擎",
          "icon": "🎴",
          "priority": "P1",
          "progress": "100%",
          "tags": ["主动回忆", "Anki级别"],
          "note": "### 认知科学双引擎\n\n结合艾宾浩斯遗忘曲线与主动回忆（Active Recall）理论：\n\n1. **3D 抽认卡工坊 (Alt+F)**：将树状层级瞬间拆解为双面 3D 翻转卡片\n2. **现场记忆掩码测试 (Alt+R)**：现场模糊子分支自查要点\n3. **大纲模式 (Alt+2)**：线性化深度排版阅读",
          "children": [
            {
              "id": "tour_4_1",
              "text": "🎴 3D 记忆抽认卡工坊 (Alt+F)",
              "priority": "P1",
              "note": "#### 抽认卡快捷操控指引：\n- **Space / Enter**：3D 立体翻转卡片正面与背面\n- **← / →**：上一张 / 下一张\n- **数字 1**：❓ 遗忘重来\n- **数字 2**：🤔 模糊待巩固\n- **数字 3**：✅ 熟练掌握\n- **Esc**：退出复习工坊",
              "children": [
                { "id": "tour_4_1_1", "text": "正面呈现主题提问与上级路径引导，背面呈现所有子要点与详细备注", "children": [] },
                { "id": "tour_4_1_2", "text": "内置三级掌握度评分与统计计数，完成本轮复习后自动生成学习反馈报告", "children": [] }
              ]
            },
            {
              "id": "tour_4_2",
              "text": "🎭 画布现场记忆掩码自测 (Alt+R)",
              "priority": "P2",
              "children": [
                { "id": "tour_4_2_1", "text": "一键给画布所有子节点打上高斯磨砂毛玻璃遮罩，文字隐藏率 100%", "children": [] },
                { "id": "tour_4_2_2", "text": "点击任意遮罩节点即时揭晓答案，再次松开即恢复遮罩，随测随练", "children": [] }
              ]
            },
            {
              "id": "tour_4_3",
              "text": "📑 线性 Markdown 大纲模式 (Alt+2)",
              "children": [
                { "id": "tour_4_3_1", "text": "导图与大纲毫秒级双向无损同步，适合快速长文阅读与线性汇报", "children": [] },
                { "id": "tour_4_3_2", "text": "支持 Tab 缩进降级、Shift+Tab 升级、Enter 回车建项与 Backspace 向上合并", "children": [] }
              ]
            }
          ]
        },
        {
          "id": "tour_5",
          "text": "🗺️ 全景导航与全局穿透检索",
          "icon": "🔍",
          "priority": "P2",
          "progress": "100%",
          "tags": ["检索", "画布漫游"],
          "children": [
            {
              "id": "tour_5_1",
              "text": "🔎 全局智能穿透搜索 (⌘F / Ctrl+F)",
              "note": "不仅搜索节点标题，还能穿透检索标签名、优先级与长篇 Markdown 详细备注；命中折叠分支时自动沿途展开父级并居中聚焦。",
              "children": [
                { "id": "tour_5_1_1", "text": "输入关键词即时高亮计数，支持 Enter / Shift+Enter 上下项快速跳转", "children": [] },
                { "id": "tour_5_1_2", "text": "自动沿途展开所有祖先折叠节点，镜头平滑飞跃直达目标节点", "children": [] }
              ]
            },
            {
              "id": "tour_5_2",
              "text": "🗺️ 视网膜级全景小地图",
              "children": [
                { "id": "tour_5_2_1", "text": "按当前主题配色高精度微缩呈现整张思维导图全景轮廓", "children": [] },
                { "id": "tour_5_2_2", "text": "支持拖拽红框或单点快速漫游视口，侧边栏展开时自适应避让", "children": [] }
              ]
            },
            {
              "id": "tour_5_3",
              "text": "🔭 单分支沉浸专注模式",
              "children": [
                { "id": "tour_5_3_1", "text": "右键任意节点点击「专注此分支」，屏蔽全局干扰，仅查看该子树", "children": [] },
                { "id": "tour_5_3_2", "text": "左上角面包屑导航清晰标注层级链路，支持一键点击任意层级跳回", "children": [] }
              ]
            },
            {
              "id": "tour_5_4",
              "text": "🎯 动态对数阻尼缩放与漫游",
              "children": [
                { "id": "tour_5_4_1", "text": "滚轮严格对准光标中心缩放，每刻度恒定 9.5% 黄金比例，零漂移", "children": [] },
                { "id": "tour_5_4_2", "text": "空白区左键拖拽平移带物理动量惯性滑行，按 Alt+C 随时自适应居中", "children": [] }
              ]
            }
          ]
        },
        {
          "id": "tour_6",
          "text": "🛡️ 安全加密、时光机与隐私",
          "icon": "🔒",
          "priority": "P1",
          "progress": "100%",
          "tags": ["离线隐私", "数据资产"],
          "children": [
            {
              "id": "tour_6_1",
              "text": "🔒 AES-256-GCM 密码保险箱 (Alt+L)",
              "note": "采用双层信封加密与 PBKDF2/SHA-512 (10万次迭代) + AES-256-GCM 认证加密。锁定后内存与剪贴板立刻粉碎置空，即便文件遗失也绝无暴力破解可能。",
              "children": [
                { "id": "tour_6_1_1", "text": "支持主访问密码设定、实时密码强度计量与找回提示语配置", "children": [] },
                { "id": "tour_6_1_2", "text": "专属 macOS 毛玻璃全景锁屏海报，输错密码触发经典弹性微晃动效", "children": [] }
              ]
            },
            {
              "id": "tour_6_2",
              "text": "📸 版本快照时光机 (Ctrl+Shift+H)",
              "children": [
                { "id": "tour_6_2_1", "text": "定时自动保存快照 + 随时手动定格拍摄快照，基于 IndexedDB 百兆级本地库", "children": [] },
                { "id": "tour_6_2_2", "text": "支持作为新标签页开启对比、一键覆盖还原、导出独立 .ymind 备份或彻底粉碎", "children": [] }
              ]
            },
            {
              "id": "tour_6_3",
              "text": "🛡️ 意外退出与崩溃草稿自愈",
              "children": [
                { "id": "tour_6_3_1", "text": "异常断电或浏览器崩溃时，下次启动自动检测未落盘草稿并提示一键恢复", "children": [] }
              ]
            },
            {
              "id": "tour_6_4",
              "text": "💾 100% 纯本地离线沙箱",
              "children": [
                { "id": "tour_6_4_1", "text": "零云端同步依赖、零隐私遥测上报，一切脑图思考资产均完整保存在您的设备中", "children": [] }
              ]
            }
          ]
        }
      ]
    }
  },
  "mindmap-blank": {
    id: "mindmap-blank",
    name: "经典双向导图",
    icon: "🌳",
    desc: "发散性思维，左右平衡分布",
    category: "structure",
    layout: "mindmap",
    data: {
      id: "root",
      text: "中心主题",
      children: [
        { id: "node_1", text: "分支主题 1", children: [] },
        { id: "node_2", text: "分支主题 2", children: [] },
        { id: "node_3", text: "分支主题 3", children: [] },
        { id: "node_4", text: "分支主题 4", children: [] }
      ]
    }
  },
  "logic-right-blank": {
    id: "logic-right-blank",
    name: "向右逻辑图",
    icon: "➡️",
    desc: "层级分明，表达因果推导与流程",
    category: "structure",
    layout: "logic-right",
    data: {
      id: "root",
      text: "核心目标",
      children: [
        {
          id: "node_1",
          text: "前期准备",
          children: [
            { id: "node_1_1", text: "需求调研", children: [] },
            { id: "node_1_2", text: "方案评审", children: [] }
          ]
        },
        {
          id: "node_2",
          text: "执行阶段",
          children: [
            { id: "node_2_1", text: "核心开发", children: [] },
            { id: "node_2_2", text: "联调测试", children: [] }
          ]
        }
      ]
    }
  },
  "logic-left-blank": {
    id: "logic-left-blank",
    name: "向左逻辑图",
    icon: "⬅️",
    desc: "向左扩展，逆向推导与根因追溯",
    category: "structure",
    layout: "logic-left",
    data: {
      id: "root",
      text: "逆向分析",
      children: [
        { id: "node_1", text: "结果现象", children: [] },
        { id: "node_2", text: "可能诱因", children: [] },
        { id: "node_3", text: "根因定位", children: [] }
      ]
    }
  },
  "org-down-blank": {
    id: "org-down-blank",
    name: "组织架构图",
    icon: "🏢",
    desc: "自上而下，清晰展现组织与层级",
    category: "structure",
    layout: "org-down",
    data: {
      id: "root",
      text: "总负责人 / 团队",
      children: [
        { id: "node_1", text: "产品与设计部", children: [] },
        { id: "node_2", text: "技术研发部", children: [] },
        { id: "node_3", text: "运营市场部", children: [] }
      ]
    }
  },
  "project-sprint": {
    id: "project-sprint",
    name: "敏捷项目冲刺",
    icon: "🚀",
    desc: "需求规划、迭代拆解与交付跟踪",
    category: "scenario",
    layout: "mindmap",
    data: {
      id: "root",
      text: "Sprint 迭代冲刺",
      children: [
        {
          id: "node_1",
          text: "🎯 目标与里程碑",
          priority: "P1",
          progress: "75%",
          children: [
            { id: "node_1_1", text: "完成 3.0 版本架构跃迁", children: [] },
            { id: "node_1_2", text: "核心链路 GPU 加速", children: [] }
          ]
        },
        {
          id: "node_2",
          text: "💻 待办需求池",
          priority: "P2",
          progress: "50%",
          children: [
            { id: "node_2_1", text: "标签管理器支持批量编辑", tags: ["功能"], children: [] },
            { id: "node_2_2", text: "快捷键漫游画布", tags: ["体验"], children: [] }
          ]
        },
        {
          id: "node_3",
          text: "🧪 质量保障 & QA",
          priority: "P2",
          progress: "25%",
          children: [
            { id: "node_3_1", text: "全平台兼容性回归", children: [] }
          ]
        },
        {
          id: "node_4",
          text: "📦 发布与上线",
          priority: "P3",
          progress: "25%",
          children: [
            { id: "node_4_1", text: "更新 Release Notes", children: [] }
          ]
        }
      ]
    }
  },
  "meeting-minutes": {
    id: "meeting-minutes",
    name: "高效会议纪要",
    icon: "📋",
    desc: "议题讨论、决策结论与行动项",
    category: "scenario",
    layout: "logic-right",
    data: {
      id: "root",
      text: "产品周会纪要",
      children: [
        {
          id: "node_1",
          text: "📌 核心议题",
          children: [
            { id: "node_1_1", text: "Q3 季度核心功能排期", children: [] },
            { id: "node_1_2", text: "用户体验优化反馈", children: [] }
          ]
        },
        {
          id: "node_2",
          text: "✅ 决议与共识",
          children: [
            { id: "node_2_1", text: "优先上线大纲模式切换", children: [] }
          ]
        },
        {
          id: "node_3",
          text: "🚀 Action Items (待办)",
          priority: "P1",
          children: [
            { id: "node_3_1", text: "完成交互原型设计 @Alex", tags: ["本周五前"], children: [] }
          ]
        }
      ]
    }
  },
  "swot-analysis": {
    id: "swot-analysis",
    name: "SWOT 战略分析",
    icon: "🎯",
    desc: "优势、劣势、机会与威胁全局洞察",
    category: "scenario",
    layout: "mindmap",
    data: {
      id: "root",
      text: "SWOT 分析",
      children: [
        {
          id: "node_1",
          text: "💪 Strengths (优势)",
          priority: "P1",
          children: [
            { id: "node_1_1", text: "离线本地运行，隐私安全极高", children: [] },
            { id: "node_1_2", text: "丝滑 120FPS 矢量平移与缩放", children: [] }
          ]
        },
        {
          id: "node_2",
          text: "⚠️ Weaknesses (劣势)",
          priority: "P2",
          children: [
            { id: "node_2_1", text: "暂未支持实时多人协同", children: [] }
          ]
        },
        {
          id: "node_3",
          text: "🌟 Opportunities (机会)",
          priority: "P2",
          children: [
            { id: "node_3_1", text: "替代传统笨重思维导图软件", children: [] }
          ]
        },
        {
          id: "node_4",
          text: "⚡ Threats (威胁)",
          priority: "P3",
          children: [
            { id: "node_4_1", text: "主流导图工具生态竞争", children: [] }
          ]
        }
      ]
    }
  },
  "decision-tree": {
    id: "decision-tree",
    name: "问题复盘与决策",
    icon: "💡",
    desc: "问题定位、归因分析与改进对策",
    category: "scenario",
    layout: "org-down",
    data: {
      id: "root",
      text: "核心问题排查",
      children: [
        {
          id: "node_1",
          text: "维度 A: 客户端渲染",
          children: [
            { id: "node_1_1", text: "DOM 节点是否过量", children: [] }
          ]
        },
        {
          id: "node_2",
          text: "维度 B: 数据持久化",
          children: [
            { id: "node_2_1", text: "LocalStorage 容量上限检查", children: [] }
          ]
        }
      ]
    }
  }
};
