# 谓无名知识图谱 Skill

让 AI 帮你编绘一张[谓无名](https://weiwuming.cn/graph)风格的知识图谱：纵轴是时间，人物按生卒年排布，连线是师承、影响、论战等关系，左侧是历史事件时间轴。你只需要告诉 AI 主题和资料，它会按统一格式写出图谱，在线校验。征得你同意后，它还能把图谱推送到网站生成只有你能看到的预览页，由你一键投稿。站方审核通过后，图谱会出现在 [weiwuming.cn/graph](https://weiwuming.cn/graph)，署上你的名字。

适用于 Claude Code，也可以给 Codex、Cursor 等其他 AI 工具使用。

## 安装

### Claude Code（推荐）

在 Claude Code 里依次运行：

```
/plugin marketplace add Roloyty/weiwuming-graph-skill
/plugin install weiwuming-graph@weiwuming
```

以后在 `/plugin` 面板里就能更新到最新版本。

### 手动安装为 Skill

```bash
git clone https://github.com/Roloyty/weiwuming-graph-skill.git
mkdir -p ~/.claude/skills
cp -r weiwuming-graph-skill/skills/weiwuming-graph ~/.claude/skills/
```

### 其他 AI 工具

下载 [`skills/weiwuming-graph`](skills/weiwuming-graph) 整个文件夹，把 `SKILL.md` 的内容发给 AI，或放进它读取的指令文件里。文件夹里的 `wwm-graph.mjs` 需要 Node.js 18 或更高版本。

## 使用

安装后直接对 AI 说，例如：

- 「帮我做一张谓无名图谱：清代浙东学派的师承，大约 30 人，资料以《清儒学案》为主」
- 「把这张图谱推送到谓无名让我看看效果」
- 「没问题了，帮我投稿」

AI 会按下面的流程走：

1. **确定范围**：主题、时间跨度、人物数量、泳道划分（如「中国 / 日本」「理学 / 心学」）、资料依据。
2. **编写图谱包**：一个 `<slug>.graph.json` 文件，格式见 [`graph.schema.json`](skills/weiwuming-graph/graph.schema.json)，示例见 [`example.json`](skills/weiwuming-graph/example.json)。
3. **校验**：调用网站的公开校验接口，逐条修正错误。
4. **连接账号**（第一次）：AI 给你一个链接和授权码。你在已登录谓无名的浏览器里打开链接、核对授权码、点「允许」。**AI 不会也不需要知道你的密码。**
5. **推送预览**：AI 给你一个预览链接。改完再推送，链接不变，刷新即可看到新版本。
6. **投稿**：在预览页点「提交审核」，或明确同意后让 AI 提交。

不想连接账号也可以：让 AI 只交出 JSON 文件，你到 [weiwuming.cn/graph/submit](https://weiwuming.cn/graph/submit) 上传、预览、投稿。

## 人物头像

- 大多数人物不用管：网站上已有同一人物的头像时会自动复用（按 nodeId，或「姓名/别名＋生年」匹配）。
- 用自己的图片：放到图谱 JSON 旁边的 `avatars/<nodeId>.jpg`（也可以是 png、webp），推送时会自动上传。服务器统一裁成 256px 正方形，并去掉照片里的位置等元数据；同一张图在全站只存一份。
- 只使用你有权使用的图片。

## 命令行助手

`skills/weiwuming-graph/wwm-graph.mjs` 由 AI 调用，你也可以自己用：

| 命令 | 作用 |
|---|---|
| `node wwm-graph.mjs validate <file>` | 校验图谱包（不需要登录） |
| `node wwm-graph.mjs login` / `login --wait` | 连接谓无名账号 |
| `node wwm-graph.mjs push <file> [--write]` | 推送为草稿并给出预览链接；`--write` 把上传后的头像地址写回文件 |
| `node wwm-graph.mjs submit <草稿ID>` | 提交审核 |
| `node wwm-graph.mjs status` | 查看草稿、审核状态与审核意见 |
| `node wwm-graph.mjs withdraw <ID>` | 删除草稿或撤回待审稿 |
| `node wwm-graph.mjs logout` | 撤销本机授权 |

## 安全与隐私

- 连接账号采用授权码流程：你在网站上批准，AI 拿到的是**只能上传和投稿图谱**的令牌，不能查看或修改账号、不能发表其他内容，也不能跳过审核。
- 令牌保存在本机 `~/.weiwuming/graph-agent.json`，30 天过期。可以随时在 [weiwuming.cn/graph/submit](https://weiwuming.cn/graph/submit) 的「已连接的 AI 工具」里撤销，或运行 `logout`。
- 推送的草稿只有你本人登录后能看到；投稿须经站方审核才会公开。

## 许可协议

本仓库的代码与文档以 [MIT 协议](LICENSE) 开源：可以自由使用、修改和再分发，保留版权声明即可。

## 反馈

问题与建议请提 [Issue](https://github.com/Roloyty/weiwuming-graph-skill/issues)。本仓库的 `skills/weiwuming-graph` 与网站 [weiwuming.cn/graph-kit](https://weiwuming.cn/graph-kit/SKILL.md) 上的工具包保持同步。
