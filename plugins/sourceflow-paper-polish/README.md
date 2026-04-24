# Paper Polish

`Paper Polish` 是一个轻量的 SourceFlow 笔记美化插件，目标是让长文阅读和持续写作更稳、更安静。

## 功能

- 顶部栏一键开启或关闭排版美化。
- 状态栏显示当前美化状态。
- 设置项支持默认启用、紧凑密度、柔和对比。
- 优化正文最大宽度、行距、标题输入区、引用块、表格、行内代码和整体背景。
- 不申请联网、工作区读写或宿主控制权限。

## 适用场景

- 写长文、读长笔记、整理知识库。
- 希望减少界面噪声，但不想更换完整主题。
- 希望插件失败时只影响视觉效果，不影响笔记和同步主流程。

## 本地测试

```powershell
node .\scripts\validate-plugin-manifest.js .\plugins\sourceflow-paper-polish
node .\scripts\smoke-plugin-runtime.js .\plugins\sourceflow-paper-polish
python .\插件商城.py .\plugins\sourceflow-paper-polish --owner lonelyor --repo sourceflow-paper-polish --skip-push
```

