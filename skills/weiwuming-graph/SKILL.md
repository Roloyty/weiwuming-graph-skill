---
name: weiwuming-graph
description: 编绘并发布谓无名（weiwuming.cn）知识图谱。当用户想做知识图谱、人物关系图、学术谱系、师承图、思想史/学术史/文学史时间轴，想把图谱推送到谓无名预览或投稿，或提到「谓无名图谱」「图谱包」「weiwuming-graph」时使用。产出符合 weiwuming-graph/1 规范的 JSON 图谱包，可在用户授权后直接推送到网站预览并投稿。
---

# 谓无名知识图谱包（weiwuming-graph/1）

谓无名的知识图谱是一套统一的「星空时间轴」界面：**纵轴是时间**，每个节点的头像落在起始年（生年），一条淡色竖线延伸到结束年（卒年）；**横向按泳道分栏**（国家、学派或阵营）；节点之间的连线是师承、影响、论战等关系；左侧时间轨显示事件。你要做的是产出一份数据文件，界面由网站统一渲染。

参考文件（需要时读取；本 Skill 目录里有就读本地的，没有再读线上地址）：
- 命令行助手：`wwm-graph.mjs`（缺失时下载 https://weiwuming.cn/graph-kit/wwm-graph.mjs 到本 Skill 目录）
- 规范 JSON Schema：`graph.schema.json`（https://weiwuming.cn/graph-kit/graph.schema.json）
- 空白模板：`template.json`（https://weiwuming.cn/graph-kit/template.json）
- 完整示例（宋明理学师承）：`example.json`（https://weiwuming.cn/graph-kit/example.json）
- Word 填写模板与填好的示例：`graph-template.docx`、`graph-example.docx`（给想自己手工整理资料的用户）

安装与更新：https://github.com/Roloyty/weiwuming-graph-skill

## 工作流程

用户给的是填好的 Word 模板时，先按「Word 填写模板」一节转换，再从第 2 步接着做。

1. **确定范围**。先和用户确认：主题与主线、时间跨度、大致人物数（建议 20–150 个，上限 600）、泳道怎么分（1–6 条，例如「中国 / 日本」或「理学 / 心学」）、资料依据。范围不清时先问，不要自行扩写成百科。
2. **列人物与事件清单**，核对事实后再写 JSON。生卒年以权威工具书为准；只知道大概年份时取通行说法，并在 `bio` 里注明「生卒年一说……」；绝不编造年份、著作或师承。
3. **按下面的字段规范写图谱包**，保存为 `<slug>.graph.json`（UTF-8）。
4. **校验**，修到通过为止（见「校验」）。
5. **推送预览**：用户想在网站上看效果时，连接账号并推送草稿，把预览链接交给用户（见「连接账号、推送与投稿」）。改完再推送同一 slug，预览链接不变，让用户刷新即可。
6. **投稿**：用户在预览页点「提交审核」，或明确同意后由你运行 `submit`。也可以不连接账号，只交付文件，让用户到 https://weiwuming.cn/graph/submit 上传。审核通过后图谱出现在 https://weiwuming.cn/graph ，标注为社区图谱与作者。

## 文件结构

```json
{
  "$schema": "https://weiwuming.cn/graph-kit/graph.schema.json",
  "format": "weiwuming-graph/1",
  "graph": { "slug": "…", "title": "…", "subtitle": "…", "category": "…", "description": "…", "lanes": [ … ], "theme": null },
  "nodes": [ … ],
  "relations": [ … ],
  "events": [ … ]
}
```

### graph（图谱元信息）

| 字段 | 必填 | 说明 |
|---|---|---|
| `slug` | ✓ | 图谱地址 `/graph/<slug>`，3–60 位小写字母、数字、连字符，全站唯一。不可用 submit、create、new、kit、preview、catalog、mine、edit、admin、connect |
| `title` | ✓ | 图谱名，≤60 字 |
| `subtitle` |  | 一句话副标题，≤80 字 |
| `category` | ✓ | 目录分类，如 历史 / 文学 / 思想与哲学 / 艺术，≤20 字 |
| `description` |  | 主线、范围、资料依据，≤4000 字 |
| `lanes` | ✓ | 1–6 条泳道 `{ "key": "cn", "label": "中国", "color": "#f0b45c" }`；key 用小写字母/数字/`-`/`_`，不能叫 `both` |
| `theme` |  | 一般填 `null`（默认星空）。可覆盖 `background` / `panel` / `accent`（#十六进制）与 `starColor`（`"r, g, b"`） |

泳道配色建议从 `#f0b45c`（金）、`#5cc8f0`（青）、`#b9a0f0`（紫）、`#7fd6a4`（绿）、`#f08a8a`（红）中取，深色背景上都清楚。

### nodes（节点）

| 字段 | 必填 | 说明 |
|---|---|---|
| `nodeId` | ✓ | 稳定 id，小写拼音/罗马字加连字符：`lu-xun`、`naito-konan`；同图内唯一 |
| `name` | ✓ | 显示名，≤40 字 |
| `birth` | ✓ | 生年（整数，公元前用负数）；事件或作品类节点填起始年 |
| `death` |  | 卒年；**省略表示在世或延续至今**（画成虚线），已故但卒年不详时取通行说法并在 bio 注明 |
| `lane` | ✓ | 所属泳道 key |
| `altNames` |  | 字号、别名、原文写法（≤10 个），用于搜索 |
| `roles` |  | 身份标签（≤8 个），如 `["史学家","汉学家"]` |
| `school` |  | 学派 / 阵营 |
| `bio` |  | 生平简介，≤1500 字 |
| `thought` |  | 主要思想 / 核心贡献，≤1500 字 |
| `works` |  | 代表作（≤30 个），带书名号 |
| `importance` |  | 3 = 核心人物（头像最大，任何缩放都标名）；2 = 重要（默认）；1 = 次要。核心人物控制在全图 15% 以内 |
| `avatarUrl` |  | 头像：https 图片地址，或本地图片路径（相对 JSON 文件，push 时自动上传）。没有就省略，见下方「头像」 |

`bio` 与 `thought` 至少写一项，否则点开人物卡片是空的。用自己的话概括，不要整段复制百科或论著原文。

#### 头像

- **大多数人物不用管头像**：push 时，没有头像的人物会自动复用站内已有的同一人物头像（按 nodeId，或「姓名/别名 + 生年」匹配）。所以 nodeId 尽量沿用通行拼写（如 `lu-xun`、`naito-konan`），生年要准。
- **用户自己有图片**：放到 JSON 旁的 `avatars/<nodeId>.jpg`（或 .png/.webp），或在 `avatarUrl` 里写相对路径。`wwm push` 会自动上传；服务器统一裁成 256px 正方形 WebP，并去掉照片里的位置等元数据。同一张图片在全站只存一份，重复上传会直接复用。单张不超过 4MB。
- 加 `--write` 时，push 会把上传后的站内地址写回 JSON，这份文件之后也可以直接在网页上传。
- 只用用户有权使用的图片（自己拍摄、公有领域、明确授权）。不要替用户去网上找人物照片下载；找不到合适的就省略，网站会显示文字头像。

### relations（关系）

`{ "source": "<nodeId>", "target": "<nodeId>", "type": "…", "note": "一句话说明" }`

| type | 含义 | 方向 |
|---|---|---|
| `teacher` | 师承 | source 是老师 |
| `influence` | 思想影响 | source 影响 target |
| `critique` | 批判性回应 | source 批判 target |
| `study` | 研究阐释 | source 研究 target |
| `rival` | 论战 / 对立 | 无向 |
| `friend` | 交游 | 无向 |
| `colleague` | 同侪 / 同事 | 无向 |
| `family` | 亲缘 | 无向 |

`note` ≤80 字，写具体依据（「万木草堂受业」「鹅湖之会」）。同一对节点同一类型只写一条；两端必须是已存在的 nodeId 且不能相同。每个节点至少连一条关系，孤立节点会被提示。

### events（时间轴事件）

`{ "eventId": "ehu-zhi-hui", "year": 1175, "label": "鹅湖之会", "tier": 1, "side": "both" }`

- `eventId` 同图唯一；`label` ≤60 字；`month`/`day` 可选，填日必须同时填月，日期不确定就只写年。
- `tier`：1 = 时代节点（任何缩放都显示，全图控制在 10 条左右）；2 = 重要转折（默认）；3 = 具体事件（放大后出现）。
- `side`：归属泳道 key，`both` 表示共同事件。

## 校验

下文 `wwm` 指 `node <本 Skill 目录>/wwm-graph.mjs`（Node 18+）。校验不需要登录，也不会保存：

```bash
node <本 Skill 目录>/wwm-graph.mjs validate my-graph.graph.json
```

错误逐条给出路径，如 `nodes[3](lu-xun).birth: 卒年早于生年`，按路径定位修改；有错误时网站不会接收。提示（孤立节点、空简介等）不阻止投稿，但应尽量处理。

没有 Node 时可直接调接口（**必须用 `--data-binary`**，否则中文与换行可能被破坏）：

```bash
curl -sS -X POST https://weiwuming.cn/api/graph-submissions/validate   -H "Content-Type: application/json" --data-binary @my-graph.graph.json
```

返回 `{ "data": { "ok", "errors", "warnings", "stats" } }`。

## 连接账号、推送与投稿

用户说「推送到网站」「让我看看效果」「帮我投稿」时：

1. **连接账号**（每台机器一次，令牌 30 天有效）：运行 `wwm login --client "<你的工具名，如 Claude Code>"`。它会打印一个链接和授权码，把两者原样告诉用户，请用户在**已登录谓无名**的浏览器里打开链接、核对授权码、点「允许」。用户说已允许后运行 `wwm login --wait`；输出「仍在等待」就再运行一次。
   - **绝不向用户索要谓无名密码**，也不要读取、打印或转述 `~/.weiwuming/graph-agent.json` 里的令牌。
   - 已连接时 `login` 会直接显示当前账号，不会重复授权。
2. **推送草稿**：`wwm push my-graph.graph.json`。成功会输出**预览链接**和草稿 ID，把预览链接交给用户。预览页与正式图谱同一界面，只有本人登录后可见，页面上有「提交审核」按钮。推送失败会列出错误，修改后重新推送。同一 slug 再次推送会更新同一份草稿。
3. **投稿**：只有在用户**明确表示要投稿**后才运行 `wwm submit <草稿ID>`；否则告诉用户可以在预览页自己点「提交审核」。提交后进入站方审核。
4. **其他命令**：`wwm status` 查看草稿与审核状态和审核意见；`wwm withdraw <ID>` 删除草稿或撤回待审稿；`wwm logout` 撤销本机令牌。

令牌失效（输出要求重新 login）时重新走第 1 步。用户也可以在 https://weiwuming.cn/graph/submit 的「已连接的 AI 工具」里随时撤销授权。

## Word 填写模板

有的用户习惯先在 Word 里整理资料。本 Skill 目录里有 `graph-template.docx`（空白模板）和 `graph-example.docx`（宋明理学示例），可以发给用户填写。模板有五张表：图谱信息、泳道、人物、关系、时间轴事件；关系用姓名互相引用，编号、泳道标识、颜色都可以空着。

用户交回填好的文件后：

1. 运行 `wwm from-word 文件.docx`，在同目录生成 `文件.graph.json` 并立即校验（`-o` 可指定输出路径）。
2. 输出的「Word 里需要修改的地方」带表名和行号（如 `人物表第 3 行（梁启超）.生年`），逐条和用户确认后改 JSON；能从资料里核实的可以补，拿不准的问用户，不要编造。
3. 「转换说明」是自动处理的结果，例如自动生成的图谱地址、编号，需要时告诉用户。
4. 改到校验通过后，照常推送预览、投稿。

用户也可以不经过你，直接把填好的 Word 文件上传到 https://weiwuming.cn/graph/submit ，网站会自动转换。

## 交付前自查

- [ ] 范围与用户确认过，`description` 写明了资料依据
- [ ] 生卒年、事件年份逐一核对，没有编造；不确定处在 bio 中说明
- [ ] 关系方向正确（teacher 的 source 是老师，critique/study/influence 的 source 是发起方）
- [ ] 核心人物（importance 3）不过多，tier 1 事件不过多
- [ ] 校验通过，提示已处理或向用户说明
- [ ] 推送了草稿就给出预览链接；投稿只在用户明确同意后进行，并说明需经站方审核；同一账号用同一 slug 再次投稿即为更新
