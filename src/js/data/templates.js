export const TEMPLATES = {
  // -------------------------------------------------------------
  // 🌟 旗舰全景指南 (交互式实战演练)
  // -------------------------------------------------------------
  "ymind-feature-tour": {
    "id": "ymind-feature-tour",
    "name": "🚀 YMind Pro 功能与实战全景",
    "icon": "🌟",
    "desc": "掌握全景特性：骨架、200+图标、Markdown备注、3D抽认卡、记忆掩码、加密保险箱与时光机",
    "category": "project",
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

  // -------------------------------------------------------------
  // 1. 📐 基础思维骨架 (Structure - 4款)
  // -------------------------------------------------------------
  "mindmap-blank": {
    id: "mindmap-blank",
    name: "经典双向思维导图",
    icon: "🌳",
    desc: "发散性思维，左右平衡自适应分布",
    category: "structure",
    layout: "mindmap",
    data: {
      id: "root",
      text: "中心议题",
      children: [
        { id: "s1_1", text: "维度一：核心背景", children: [{ id: "s1_1_1", text: "现状梳理", children: [] }, { id: "s1_1_2", text: "关键瓶颈", children: [] }] },
        { id: "s1_2", text: "维度二：战略目标", children: [{ id: "s1_2_1", text: "短期交付物", children: [] }, { id: "s1_2_2", text: "长期愿景", children: [] }] },
        { id: "s1_3", text: "维度三：资源盘点", children: [{ id: "s1_3_1", text: "团队与预算", children: [] }, { id: "s1_3_2", text: "技术基建", children: [] }] },
        { id: "s1_4", text: "维度四：潜在风险", children: [{ id: "s1_4_1", text: "合规与安全", children: [] }, { id: "s1_4_2", text: "应对预案", children: [] }] }
      ]
    }
  },
  "logic-right-blank": {
    id: "logic-right-blank",
    name: "向右逻辑推导图",
    icon: "➡️",
    desc: "严谨层级因果流动，适合产品 PRD 与技术方案",
    category: "structure",
    layout: "logic-right",
    data: {
      id: "root",
      text: "核心落地工程",
      children: [
        {
          id: "lr_1", text: "阶段一：需求收敛与技术评审", priority: "P1", children: [
            { id: "lr_1_1", text: "业务痛点调研与用例梳理", children: [] },
            { id: "lr_1_2", text: "架构设计与存储选型评审", children: [] }
          ]
        },
        {
          id: "lr_2", text: "阶段二：核心模块研发冲刺", priority: "P2", children: [
            { id: "lr_2_1", text: "底层引擎改造与单元测试", children: [] },
            { id: "lr_2_2", text: "前后端接口联调", children: [] }
          ]
        },
        {
          id: "lr_3", text: "阶段三：灰度发布与效果观测", priority: "P3", children: [
            { id: "lr_3_1", text: "全链路监控与性能指标打点", children: [] },
            { id: "lr_3_2", text: "复盘与文档沉淀", children: [] }
          ]
        }
      ]
    }
  },
  "logic-left-blank": {
    id: "logic-left-blank",
    name: "向左逆向分析图",
    icon: "⬅️",
    desc: "逆向因果回溯，适合根因分析与复盘排查",
    category: "structure",
    layout: "logic-left",
    data: {
      id: "root",
      text: "故障与现象根因",
      children: [
        {
          id: "ll_1", text: "直接表象：系统响应超时", children: [
            { id: "ll_1_1", text: "网关层 P99 抖动飙升", children: [] },
            { id: "ll_1_2", text: "下游数据库连接池耗尽", children: [] }
          ]
        },
        {
          id: "ll_2", text: "中间机理：慢查询导致锁等待", children: [
            { id: "ll_2_1", text: "缺失复合联合索引", children: [] },
            { id: "ll_2_2", text: "未加分页的大批量深度扫描", children: [] }
          ]
        },
        {
          id: "ll_3", text: "根因定位：发版缺失压测拦截", priority: "P1", children: [
            { id: "ll_3_1", text: "CI/CD 流水线未集成慢 SQL 审查", children: [] },
            { id: "ll_3_2", text: "生产变更发布时间窗口重叠", children: [] }
          ]
        }
      ]
    }
  },
  "org-down-blank": {
    id: "org-down-blank",
    name: "组织架构与层级流",
    icon: "🏢",
    desc: "自上而下纵向流动，权责划分与管理汇报一览无遗",
    category: "structure",
    layout: "org-down",
    data: {
      id: "root",
      text: "产研委员会 / CTO",
      children: [
        {
          id: "org_1", text: "技术架构部", children: [
            { id: "org_1_1", text: "基础设施组 (K8s/DB)", children: [] },
            { id: "org_1_2", text: "核心计算引擎组", children: [] }
          ]
        },
        {
          id: "org_2", text: "产品与体验部", children: [
            { id: "org_2_1", text: "用户体验 UX/UI", children: [] },
            { id: "org_2_2", text: "商业化产品组", children: [] }
          ]
        },
        {
          id: "org_3", text: "质量效能部", children: [
            { id: "org_3_1", text: "自动化回归平台", children: [] },
            { id: "org_3_2", text: "安全合规与红蓝演练", children: [] }
          ]
        }
      ]
    }
  },

  // -------------------------------------------------------------
  // 2. 💼 敏捷工程与项目管理 (Project - 4款)
  // -------------------------------------------------------------
  "project-sprint": {
    id: "project-sprint",
    name: "敏捷 Sprint 迭代看板",
    icon: "🚀",
    desc: "需求梳理、任务认领、阻碍排查与发版交付全追踪",
    category: "project",
    layout: "mindmap",
    data: {
      id: "root",
      text: "Sprint 34 冲刺交付",
      children: [
        {
          id: "sp_1", text: "🎯 本期重点里程碑", priority: "P1", progress: "100%", children: [
            { id: "sp_1_1", text: "完成双层 AES 密文加密协议重构", children: [] },
            { id: "sp_1_2", text: "集成 3D 翻转卡片学习工坊", children: [] }
          ]
        },
        {
          id: "sp_2", text: "💻 研发中需求池", priority: "P2", progress: "50%", children: [
            { id: "sp_2_1", text: "空间四叉树多选算法平滑支持", tags: ["已提测"], children: [] },
            { id: "sp_2_2", text: "Markdown 抽屉代码高亮支持", tags: ["开发中"], children: [] }
          ]
        },
        {
          id: "sp_3", text: "⚠️ 阻塞性问题 (Blockers)", priority: "P1", children: [
            { id: "sp_3_1", text: "等待外部鉴权接口文档回执", tags: ["依赖外部"], children: [] }
          ]
        },
        {
          id: "sp_4", text: "📦 上线与回归计划", priority: "P3", progress: "25%", children: [
            { id: "sp_4_1", text: "全链路端到端自动化测试运行", children: [] },
            { id: "sp_4_2", text: "更新用户指南与 Release Notes", children: [] }
          ]
        }
      ]
    }
  },
  "tech-architecture": {
    id: "tech-architecture",
    name: "系统架构设计与技术选型",
    icon: "🏗️",
    desc: "微服务边界划分、高并发高可用保障与技术栈考量",
    category: "project",
    layout: "logic-right",
    data: {
      id: "root",
      text: "分布式架构设计规范",
      children: [
        {
          id: "arch_1", text: "客户端与接入层 (Gateway)", children: [
            { id: "arch_1_1", text: "动态路由与流量染色", children: [] },
            { id: "arch_1_2", text: "自适应限流降级 (Sentinel/Envoy)", children: [] }
          ]
        },
        {
          id: "arch_2", text: "核心业务服务划分", children: [
            { id: "arch_2_1", text: "用户认证与授权中心 (OAuth2/JWT)", children: [] },
            { id: "arch_2_2", text: "核心业务编排流水线 (Temporal/Camunda)", children: [] }
          ]
        },
        {
          id: "arch_3", text: "数据存储与持久化架构", children: [
            { id: "arch_3_1", text: "关系主库分库分表策略", children: [] },
            { id: "arch_3_2", text: "Redis 分布式多级缓存一致性", children: [] },
            { id: "arch_3_3", text: "Elasticsearch 亿级向量与文本倒排索引", children: [] }
          ]
        }
      ]
    }
  },
  "release-checklist": {
    id: "release-checklist",
    name: "版本发布与上线 Checklist",
    icon: "📋",
    desc: "发布前基线核查、数据库迁移、回滚预案与在线监控",
    category: "project",
    layout: "logic-right",
    data: {
      id: "root",
      text: "生产发版质量门禁",
      children: [
        {
          id: "rel_1", text: "1. 准出与静态门禁检查", priority: "P1", progress: "100%", children: [
            { id: "rel_1_1", text: "代码审查 (Code Review) 严格双签通过", children: [] },
            { id: "rel_1_2", text: "静态安全漏洞代码扫描通过 (SonarQube/Snyk)", children: [] }
          ]
        },
        {
          id: "rel_2", text: "2. 运维与数据库迁移", priority: "P1", progress: "75%", children: [
            { id: "rel_2_1", text: "DDL 生产执行与锁表评估已完成", children: [] },
            { id: "rel_2_2", text: "配置中心新变量全部部署至配置中心", children: [] }
          ]
        },
        {
          id: "rel_3", text: "3. 灰度放量与应急回滚", priority: "P2", progress: "25%", children: [
            { id: "rel_3_1", text: "首批 5% 灰度节点健康探测无报错", children: [] },
            { id: "rel_3_2", text: "一键快速回滚镜像脚本校验就绪", children: [] }
          ]
        }
      ]
    }
  },
  "post-mortem": {
    id: "post-mortem",
    name: "线上故障复盘分析 (Post-mortem)",
    icon: "🔍",
    desc: "时间线还原、根因分析(5-Whys)、影响面评估与落地改进行动",
    category: "project",
    layout: "mindmap",
    data: {
      id: "root",
      text: "0828 线上故障复盘报告",
      children: [
        {
          id: "pm_1", text: "⏱️ 故障时间线脉络", priority: "P2", children: [
            { id: "pm_1_1", text: "14:10 告警触发：RPC 响应超时率超标", children: [] },
            { id: "pm_1_2", text: "14:18 应急熔断：启用静态降级策略", children: [] },
            { id: "pm_1_3", text: "14:32 恢复正常：扩容下游实例完成恢复", children: [] }
          ]
        },
        {
          id: "pm_2", text: "🎯 根因剖析 (5-Whys)", priority: "P1", children: [
            { id: "pm_2_1", text: "为何响应慢？由于连接池耗尽", children: [] },
            { id: "pm_2_2", text: "为何连接池耗尽？因未设置单次查询超时强制熔断", children: [] }
          ]
        },
        {
          id: "pm_3", text: "🛠️ 改进措施与责任人 (Action Items)", priority: "P1", progress: "50%", children: [
            { id: "pm_3_1", text: "设置全局 1.5s 客户端超时截断 @DevTeam", tags: ["本周完成"], children: [] },
            { id: "pm_3_2", text: "补充混沌工程故障注入断网演练 @QA", tags: ["下周完成"], children: [] }
          ]
        }
      ]
    }
  },

  // -------------------------------------------------------------
  // 3. 📊 战略规划与商业决策 (Business - 4款)
  // -------------------------------------------------------------
  "swot-analysis": {
    id: "swot-analysis",
    name: "SWOT 战略决策分析",
    icon: "🎯",
    desc: "全面剖析优势 (S)、劣势 (W)、机会 (O) 与威胁 (T)",
    category: "business",
    layout: "mindmap",
    data: {
      id: "root",
      text: "企业战略 SWOT 洞察",
      children: [
        {
          id: "swot_1", text: "💪 Strengths (内部优势)", priority: "P1", children: [
            { id: "swot_1_1", text: "自研超轻量底层引擎，启动速度业界领先", children: [] },
            { id: "swot_1_2", text: "高度注重数据主权，100% 离线隐私保护", children: [] }
          ]
        },
        {
          id: "swot_2", text: "⚠️ Weaknesses (内部劣势)", priority: "P2", children: [
            { id: "swot_2_1", text: "品牌知名度处于初期，市场心智认知不足", children: [] },
            { id: "swot_2_2", text: "暂未支持公网多人实时协同编辑", children: [] }
          ]
        },
        {
          id: "swot_3", text: "🌟 Opportunities (外部机会)", priority: "P1", children: [
            { id: "swot_3_1", text: "企业客户对数据隐私与离线加密需求井喷", children: [] },
            { id: "swot_3_2", text: "传统臃肿脑图工具用户迁移诉求强烈", children: [] }
          ]
        },
        {
          id: "swot_4", text: "⚡ Threats (外部威胁)", priority: "P3", children: [
            { id: "swot_4_1", text: "行业头部厂商降价促销与生态绑定", children: [] },
            { id: "swot_4_2", text: "开源通用导图组件低门槛竞争", children: [] }
          ]
        }
      ]
    }
  },
  "pestel-analysis": {
    id: "pestel-analysis",
    name: "PESTEL 宏观环境模型",
    icon: "🌐",
    desc: "政治、经济、社会、科技、环境与法律全方位宏观战略扫描",
    category: "business",
    layout: "mindmap",
    data: {
      id: "root",
      text: "PESTEL 宏观战略扫描",
      children: [
        { id: "pst_1", text: "🏛️ 政治因素 (Political)", children: [{ id: "pst_1_1", text: "出海数据合规与监管趋势", children: [] }] },
        { id: "pst_2", text: "💰 经济因素 (Economic)", children: [{ id: "pst_2_1", text: "企业 IT 预算精细化支出趋势", children: [] }] },
        { id: "pst_3", text: "👥 社会文化 (Social)", children: [{ id: "pst_3_1", text: "远程办公与个人数字第二大脑常态化", children: [] }] },
        { id: "pst_4", text: "💻 科技演进 (Technological)", children: [{ id: "pst_4_1", text: "本地端侧大模型结合与高性能 WebAssembly", children: [] }] },
        { id: "pst_5", text: "🌱 环境保护 (Environmental)", children: [{ id: "pst_5_1", text: "全流程绿色低功耗软件架构", children: [] }] },
        { id: "pst_6", text: "⚖️ 法律合规 (Legal)", children: [{ id: "pst_6_1", text: "GDPR 与网络数据安全法案落地要求", children: [] }] }
      ]
    }
  },
  "porter-five-forces": {
    id: "porter-five-forces",
    name: "波特五力竞争模型",
    icon: "⚔️",
    desc: "透析行业盈利潜能与竞争结构竞争分析框架",
    category: "business",
    layout: "mindmap",
    data: {
      id: "root",
      text: "行业波特五力竞争态势",
      children: [
        { id: "p5_1", text: "1. 供应商议价能力 (中)", children: [{ id: "p5_1_1", text: "基础设施算力与操作系统供应商格局稳定", children: [] }] },
        { id: "p5_2", text: "2. 买方议价能力 (高)", children: [{ id: "p5_2_1", text: "软件替代方案较多，转换成本逐步降低", children: [] }] },
        { id: "p5_3", text: "3. 潜在进入者威胁 (高)", children: [{ id: "p5_3_1", text: "前端 Canvas/SVG 技术栈开源门槛不高", children: [] }] },
        { id: "p5_4", text: "4. 替代品威胁 (中)", children: [{ id: "p5_4_1", text: "白板工具 (Miro/Excalidraw) 跨界分流用户", children: [] }] },
        { id: "p5_5", text: "5. 行业内现有对手 (极高)", children: [{ id: "p5_5_1", text: "老牌导图巨头市场教育充分且壁垒深厚", children: [] }] }
      ]
    }
  },
  "okr-alignment": {
    id: "okr-alignment",
    name: "OKR 目标与关键结果对齐",
    icon: "🎯",
    desc: "组织野心目标分解，透明驱动上下同欲与业务破局",
    category: "business",
    layout: "logic-right",
    data: {
      id: "root",
      text: "Q3 季度核心 OKR 规划",
      children: [
        {
          id: "okr_1", text: "目标 O1：打造行业顶尖的桌面端性能与质感口碑", priority: "P1", children: [
            { id: "okr_1_1", text: "KR 1.1：万级节点平移缩放帧率稳定在 60FPS 以上", progress: "75%", children: [] },
            { id: "okr_1_2", text: "KR 1.2：冷启动耗时优化至 180ms 以内", progress: "100%", children: [] },
            { id: "okr_1_3", text: "KR 1.3：Apple HIG 视觉设计用户好评率达 95%", progress: "50%", children: [] }
          ]
        },
        {
          id: "okr_2", text: "目标 O2：构筑隐私安全护城河，赢得深度知识用户认可", priority: "P2", children: [
            { id: "okr_2_1", text: "KR 2.1：推出 Argon2id + AES-256 原生加密沙箱", progress: "100%", children: [] },
            { id: "okr_2_2", text: "KR 2.2：上线 3D 抽认卡复习工坊并打通记忆曲线", progress: "100%", children: [] }
          ]
        }
      ]
    }
  },

  // -------------------------------------------------------------
  // 4. 🧠 深度学习与知识内化 (Learning - 4款，深度适配 3D 抽认卡)
  // -------------------------------------------------------------
  "computer-systems": {
    id: "computer-systems",
    name: "计算机系统基础体系 (CSAPP)",
    icon: "💻",
    desc: "内存体系结构、虚拟内存与系统调用（一键导出 3D 抽认卡自测）",
    category: "learning",
    layout: "mindmap",
    data: {
      id: "root",
      text: "CSAPP 核心原理全景",
      note: "计算机科学底层骨干知识库，按 Alt+F 可直接生成系统级 3D 抽认卡自查知识点盲区。",
      children: [
        {
          id: "cs_1", text: "一、信息的表示与处理", priority: "P1", note: "重点掌握补码编码原理、浮点数 IEEE 754 标准以及整数溢出处理。", children: [
            { id: "cs_1_1", text: "整数无符号与有符号补码运算", children: [] },
            { id: "cs_1_2", text: "浮点数舍入与精度截断效应", children: [] }
          ]
        },
        {
          id: "cs_2", text: "二、存储器层级结构", priority: "P1", note: "核心思想：局部性原理（时间局部性与空间局部性）。", children: [
            { id: "cs_2_1", text: "SRAM 与 DRAM 物理硬件特性区别", children: [] },
            { id: "cs_2_2", text: "高速缓存 Cache 组相联映射机制", children: [] },
            { id: "cs_2_3", text: "高速缓存命中与未命中惩罚 (Miss Penalty)", children: [] }
          ]
        },
        {
          id: "cs_3", text: "三、虚拟内存与异常控制流", priority: "P2", note: "TLB、页表与 MMU 地址翻译全过程。", children: [
            { id: "cs_3_1", text: "页面置换算法 (LRU/Clock/FIFO)", children: [] },
            { id: "cs_3_2", text: "上下文切换与软硬件中断机制", children: [] }
          ]
        }
      ]
    }
  },
  "dsa-algorithms": {
    id: "dsa-algorithms",
    name: "高频算法与数据结构图谱",
    icon: "🧮",
    desc: "排序树论、动态规划与图论解法模式总结（高频面试复习库）",
    category: "learning",
    layout: "logic-right",
    data: {
      id: "root",
      text: "数据结构与算法核心思维",
      note: "掌握经典核心模型，面试与工程解构利器。",
      children: [
        {
          id: "algo_1", text: "1. 树与平衡结构", priority: "P1", children: [
            { id: "algo_1_1", text: "二叉搜索树 BST 与平衡红黑树 (R-B Tree)", children: [] },
            { id: "algo_1_2", text: "前缀树 Trie 与海量字符串路由匹配", children: [] }
          ]
        },
        {
          id: "algo_2", text: "2. 动态规划 (DP) 核心思想", priority: "P1", note: "状态定义、状态转移方程与无后效性边界。", children: [
            { id: "algo_2_1", text: "0-1 背包与完全背包推导", children: [] },
            { id: "algo_2_2", text: "最长公共子序列 (LCS) 与单调递增子序列 (LIS)", children: [] }
          ]
        },
        {
          id: "algo_3", text: "3. 高级图论与网络流", priority: "P2", children: [
            { id: "algo_3_1", text: "最短路径算法：Dijkstra 与 SPFA", children: [] },
            { id: "algo_3_2", text: "拓扑排序与并查集 (Union-Find) 判环", children: [] }
          ]
        }
      ]
    }
  },
  "english-vocabulary": {
    id: "english-vocabulary",
    name: "专业英语核心词根与搭配",
    icon: "📖",
    desc: "前缀后缀构词法与高阶学术表达（最佳 3D 抽认卡复习模版）",
    category: "learning",
    layout: "mindmap",
    data: {
      id: "root",
      text: "进阶英语词根词缀精选",
      note: "按 Alt+F 可直接将本导图作为双面背词卡，点击卡片 3D 翻转看词义与例句！",
      children: [
        {
          id: "eng_1", text: "词根: -vert-/-vers- (转动/改变)", priority: "P1", note: "本意为 to turn，引申出转化、倒置、敌对等大量高阶词汇。", children: [
            { id: "eng_1_1", text: "Controversy: 争论，辩论", note: "contra-(反) + vers-(转) -> 朝相反方向转 -> 观点对抗。", children: [] },
            { id: "eng_1_2", text: "Inadvertent: 非故意的，疏忽的", note: "in-(不) + ad-(去) + vert-(转) -> 心思没转过去 -> 疏忽大意。", children: [] },
            { id: "eng_1_3", text: "Subvert: 颠覆，推翻", note: "sub-(从下往上) + vert-(翻转) -> 彻底颠覆制度或政权。", children: [] }
          ]
        },
        {
          id: "eng_2", text: "词根: -spec-/-spect- (看见/观察)", priority: "P1", children: [
            { id: "eng_2_1", text: "Introspective: 内省的，自省的", note: "intro-(向内) + spect-(看) -> 审视自己内心的思想情感。", children: [] },
            { id: "eng_2_2", text: "Circumspect: 审慎的，慎重的", note: "circum-(圆周/四周) + spect-(看) -> 四周环视观察危险 -> 行事极其周全谨慎。", children: [] }
          ]
        },
        {
          id: "eng_3", text: "词根: -flu-/-flux- (流动)", priority: "P2", children: [
            { id: "eng_3_1", text: "Superfluous: 多余的，累赘的", note: "super-(超过) + flu-(流淌) -> 溢出来的多余部分。", children: [] },
            { id: "eng_3_2", text: "Effluent: 排放物，流出物", children: [] }
          ]
        }
      ]
    }
  },
  "cognitive-psychology": {
    id: "cognitive-psychology",
    name: "认知心理学与主动回忆原理",
    icon: "🧠",
    desc: "工作记忆带宽、艾宾浩斯遗忘曲线与刻意练习神经回路",
    category: "learning",
    layout: "mindmap",
    data: {
      id: "root",
      text: "认知科学与心智模型",
      children: [
        {
          id: "cog_1", text: "一、工作记忆与心流带宽", priority: "P1", note: "人类工作记忆只有 4±1 个信息块容量，需善用外部画布减轻认知负荷。", children: [
            { id: "cog_1_1", text: "组块化处理 (Chunking) 扩大容量", children: [] },
            { id: "cog_1_2", text: "外部脑图作为认知支架 (Cognitive Offloading)", children: [] }
          ]
        },
        {
          id: "cog_2", text: "二、提取练习效应 (Testing Effect)", priority: "P1", note: "主动从脑中提取信息（Active Recall）比被动重复阅读的记忆留存率高 300% 以上！", children: [
            { id: "cog_2_1", text: "3D 抽认卡自测加深神经突触连接", children: [] },
            { id: "cog_2_2", text: "记忆遮罩模式驱动大脑产生认知摩擦", children: [] }
          ]
        },
        {
          id: "cog_3", text: "三、间隔重复 (Spaced Repetition)", priority: "P2", children: [
            { id: "cog_3_1", text: "艾宾浩斯遗忘曲线黄金复习间隔点", children: [] },
            { id: "cog_3_2", text: "遗忘并非敌人，而是在为长期记忆重塑索引", children: [] }
          ]
        }
      ]
    }
  },

  // -------------------------------------------------------------
  // 5. 💡 个人效能与工作会议 (Productivity - 4款)
  // -------------------------------------------------------------
  "meeting-minutes": {
    id: "meeting-minutes",
    name: "高效率会议纪要与决策链",
    icon: "📝",
    desc: "明确议题背景、现场决议共识与唯一责任人行动清单",
    category: "productivity",
    layout: "logic-right",
    data: {
      id: "root",
      text: "产品产研周会纪要",
      children: [
        {
          id: "meet_1", text: "📌 会议背景与核心议题", children: [
            { id: "meet_1_1", text: "Q3 季度核心体验优化指标复盘", children: [] },
            { id: "meet_1_2", text: "本地加密功能发版排期与验收", children: [] }
          ]
        },
        {
          id: "meet_2", text: "✅ 关键决议与产出共识", priority: "P1", children: [
            { id: "meet_2_1", text: "统一采用 Argon2id 作为主访问加密算子", children: [] },
            { id: "meet_2_2", text: "默认开启记忆掩码主动复习入口", children: [] }
          ]
        },
        {
          id: "meet_3", text: "🚀 待办行动项 (Action Items)", priority: "P1", progress: "25%", children: [
            { id: "meet_3_1", text: "输出端到端安全测试用例 @Alex", tags: ["本周五"], children: [] },
            { id: "meet_3_2", text: "完成全量 20 款高频场景模板发布 @Design", tags: ["已上线"], children: [] }
          ]
        }
      ]
    }
  },
  "first-principles": {
    id: "first-principles",
    name: "第一性原理思考与破局",
    icon: "💡",
    desc: "剥离表面经验类比，回归事物物理本质进行推演创新",
    category: "productivity",
    layout: "mindmap",
    data: {
      id: "root",
      text: "第一性原理思维模型",
      children: [
        {
          id: "fp_1", text: "1. 识别并质疑一切现存假设", priority: "P1", children: [
            { id: "fp_1_1", text: "为什么思维导图软件必须依赖庞大云端？", children: [] },
            { id: "fp_1_2", text: "现有的商业竞争对手究竟把代码用在了哪里？", children: [] }
          ]
        },
        {
          id: "fp_2", text: "2. 解构为不可再分的基础要素", priority: "P1", children: [
            { id: "fp_2_1", text: "要素 A：树形层级数据结构 (Tree Data)", children: [] },
            { id: "fp_2_2", text: "要素 B：毫秒级高性能渲染 (Canvas 2D)", children: [] },
            { id: "fp_2_3", text: "要素 C：绝对安全的个人隐私 (Local Only)", children: [] }
          ]
        },
        {
          id: "fp_3", text: "3. 从基石出发重新推导重构", priority: "P2", children: [
            { id: "fp_3_1", text: "自研超椭圆与四叉树，榨干原生浏览器潜能", children: [] },
            { id: "fp_3_2", text: "提供极致丝滑的本地桌面级单机体验", children: [] }
          ]
        }
      ]
    }
  },
  "gtd-workflow": {
    id: "gtd-workflow",
    name: "GTD 任务与个人精力管理",
    icon: "⏳",
    desc: "收集箱、排期处理、两分钟原则与每周复盘闭环",
    category: "productivity",
    layout: "mindmap",
    data: {
      id: "root",
      text: "GTD 精力与效能系统",
      children: [
        {
          id: "gtd_1", text: "📥 收集箱 (Inbox)", priority: "P1", children: [
            { id: "gtd_1_1", text: "闪念灵感与待读技术文章", children: [] },
            { id: "gtd_1_2", text: "待报销发票与税务材料整理", children: [] }
          ]
        },
        {
          id: "gtd_2", text: "⚡ 两分钟原则 (立即执行)", priority: "P2", progress: "100%", children: [
            { id: "gtd_2_1", text: "回复团队关键决策邮件", children: [] },
            { id: "gtd_2_2", text: "合并主分支修复补丁", children: [] }
          ]
        },
        {
          id: "gtd_3", text: "🗓️ 本周深度项目池", priority: "P1", progress: "50%", children: [
            { id: "gtd_3_1", text: "完成 Q3 技术规划白皮书撰写", children: [] },
            { id: "gtd_3_2", text: "重构数据库持久层慢调用链路", children: [] }
          ]
        },
        {
          id: "gtd_4", text: "🌱 愿景与未来清单 (Someday)", priority: "P4", children: [
            { id: "gtd_4_1", text: "学习 Rust 异步图形学开发", children: [] },
            { id: "gtd_4_2", text: "计划一次深度自驾旅行", children: [] }
          ]
        }
      ]
    }
  },
  "feynman-technique": {
    id: "feynman-technique",
    name: "费曼学习法与知识萃取",
    icon: "🎓",
    desc: "以教促学：概念确立、通俗解释、查漏补缺与类比精炼",
    category: "productivity",
    layout: "logic-right",
    data: {
      id: "root",
      text: "费曼极简学习四部曲",
      children: [
        {
          id: "fey_1", text: "步骤一：确立目标概念", priority: "P1", children: [
            { id: "fey_1_1", text: "在空白导图中心写下要彻底吃透的核心主题", children: [] }
          ]
        },
        {
          id: "fey_2", text: "步骤二：假想向 8 岁儿童讲解", priority: "P1", children: [
            { id: "fey_2_1", text: "杜绝使用任何行业生僻黑话与晦涩术语", children: [] },
            { id: "fey_2_2", text: "大量运用生活中司空见惯的事物进行形象比喻", children: [] }
          ]
        },
        {
          id: "fey_3", text: "步骤三：定位卡壳点，回归原典查漏补缺", priority: "P2", children: [
            { id: "fey_3_1", text: "一旦解释不通，说明此处存在逻辑跳跃与认知盲区", children: [] },
            { id: "fey_3_2", text: "重新研读基础文献直到能用自己的大白话讲清楚", children: [] }
          ]
        },
        {
          id: "fey_4", text: "步骤四：精炼升华并形成记忆卡片", priority: "P3", progress: "100%", children: [
            { id: "fey_4_1", text: "录入节点备注并在抽认卡中自测强化", children: [] }
          ]
        }
      ]
    }
  }
};
