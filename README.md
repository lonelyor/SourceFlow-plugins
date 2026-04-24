# SourceFlow Plugins

这是 SourceFlow 的独立插件商城仓库，默认发布到：

`https://github.com/lonelyor/SourceFlow-plugins`

推荐集市源地址：

`https://cdn.jsdelivr.net/gh/lonelyor/SourceFlow-plugins@main/`

GitHub Pages 备用地址：

`https://lonelyor.github.io/SourceFlow-plugins/`

当前仓库维护插件源码、商城提交文件、插件包和 GitHub Pages 发布工作流。SourceFlow 笔记端优先读取提交到仓库根目录的静态 CDN 源，GitHub Pages 作为备用镜像，用于展示、安装和更新这里发布的插件。

## 在 SourceFlow 笔记中使用

确认下面地址可以访问：

`https://cdn.jsdelivr.net/gh/lonelyor/SourceFlow-plugins@main/version.json`

然后在 SourceFlow 的插件/集市源设置中添加自定义源：

```text
Version Info URL: https://cdn.jsdelivr.net/gh/lonelyor/SourceFlow-plugins@main/version.json
Stage Base URL:   https://cdn.jsdelivr.net/gh/lonelyor/SourceFlow-plugins@main
Package Base URL: https://cdn.jsdelivr.net/gh/lonelyor/SourceFlow-plugins@main
Stat Base URL:    https://cdn.jsdelivr.net/gh/lonelyor/SourceFlow-plugins@main/stat
README CDN Base:  https://cdn.jsdelivr.net/gh
```

添加后，在 SourceFlow 的插件商城里刷新列表，选择插件安装。已安装插件默认不应绕过宿主权限确认；启用前请检查插件来源、版本、`SHA-256` 和权限声明。

### 当前示例插件

`sourceflow-paper-polish` 是一个轻量笔记美化插件：

- 优化长文阅读和写作排版。
- 支持顶部栏一键开关。
- 支持状态栏提示当前状态。
- 支持默认启用、紧凑密度、柔和对比设置。
- 不申请联网、工作区读写或宿主控制权限。

安装后如果插件异常，预期只影响视觉美化，不影响笔记编辑、保存和同步主流程。

## 插件开发教程

请阅读：

`PLUGIN_DEVELOPMENT.md`

这份教程包含插件目录结构、`plugin.json` 字段、运行时 API、权限选择、测试命令和发布流程。

## 仓库结构

```text
plugins/
  <plugin-name>/
    plugin.json
    index.js
    index.css
    README.md
submissions/
  plugins/*.json
packages/
  package/<owner>/<repo>@<hash>.zip
  package/<owner>/<repo>@<hash>/
stats/
dist/
scripts/
.github/workflows/
```

- `plugins/<plugin-name>/`：本地维护的插件源码目录，发布独立仓库时会一起导出。
- `submissions/<type>/*.json`：商城提交源文件，`type` 可为 `plugins/themes/icons/templates/widgets`。
- `packages/`：发布后的静态资源目录。
- `stats/index.json`：下载统计输入文件。
- `dist/`：由 `node scripts/generate-bazaar.js` 生成的最终静态集市内容，不需要手工编辑；发布脚本会把同一份静态根目录同步提交到仓库根目录，供 CDN 直接读取。

## 维护者发布插件

在 SourceFlow 主仓库根目录运行：

```powershell
python .\插件商城.py .\plugins\sourceflow-paper-polish `
  --owner lonelyor `
  --repo sourceflow-paper-polish `
  --github-token-file .release.local.env
```

只更新本地商城，不推送 GitHub：

```powershell
python .\插件商城.py .\plugins\sourceflow-paper-polish `
  --owner lonelyor `
  --repo sourceflow-paper-polish `
  --skip-push
```

只预览计划，不写文件：

```powershell
python .\插件商城.py .\plugins\sourceflow-paper-polish `
  --owner lonelyor `
  --repo sourceflow-paper-polish `
  --dry-run
```

脚本会自动完成：

- 校验 `plugin.json`。
- 运行插件运行时烟测。
- 打包 ZIP。
- 计算 ZIP 的 `SHA-1` 与 `SHA-256`。
- 生成 `submissions/plugins/*.json`。
- 复制 ZIP 到 `packages/package/<owner>/<repo>@<hash>.zip`。
- 复制插件 README、图标、预览图到对应静态目录。
- 生成 `dist/version.json` 和 stage 索引，并同步到仓库根目录。
- 推送 `plugins/`、商城提交物、包文件、文档和 Pages 工作流到 `lonelyor/SourceFlow-plugins`。

## GitHub Pages 发布

远端仓库需要启用 GitHub Pages，Source 选择 `GitHub Actions`。

发布工作流：

`.github/workflows/sourceflow-plugins.yml`

工作流会在提交后自动：

- 校验商城提交文件。
- 生成静态商城索引。
- 上传并部署到 GitHub Pages。

## GitHub Token 权限

使用 fine-grained PAT 时，至少给 `lonelyor/SourceFlow-plugins` 仓库这些权限：

- `Contents: Read and write`
- `Workflows: Read and write`
- `Actions: Read and write`
- `Pages: Read and write`
- `Administration: Read and write`

真实 token 写在 SourceFlow 主仓库根目录的 `.release.local.env`，不要提交到 Git。

```dotenv
GH_TOKEN=
```

## 本地校验

在 SourceFlow 主仓库根目录运行：

```powershell
node .\scripts\validate-plugin-manifest.js .\plugins\sourceflow-paper-polish
node .\scripts\smoke-plugin-runtime.js .\plugins\sourceflow-paper-polish
python .\插件商城.py .\plugins\sourceflow-paper-polish --owner lonelyor --repo sourceflow-paper-polish --skip-push
```

在这个独立商城仓库中运行：

```powershell
node .\scripts\validate-bazaar.js --root .
node .\scripts\generate-bazaar.js --root . --output .\dist
```

## 稳定性约束

- 插件不应该承担笔记编辑、保存、同步、启动这些主流程职责。
- 插件失败应只影响插件自身，不能阻塞笔记和同步。
- 权限声明要最小化，能不申请 `network.http`、`workspace.write`、`host.control` 就不要申请。
- 插件升级后如果权限声明变化，宿主应要求用户重新确认。
- 发布前不要跳过运行时烟测，除非只是临时调试包。
