# DogSC Linux Soft Silver

意图：优化 UI · 升级档（品牌 Soft Silver 锁定）· 编辑器工作区

## 北极星

机加工银片：不透明岛、铂金选中、稀疏材质只盖在媒体上；Linux 壳对齐 mac Soft Silver，不套默认蓝焦点。

## 变量（`web/app.css` `:root`）

- 表面：`--bg` / `--panel` / `--raised` / `--chrome`
- 文字：`--ink` / `--muted` / `--faint`（可读性 ≥ 4.5:1）
- 强调：`--platinum` 主操作与选中；`--red` 录制与危险
- 形状：`--radius-compact` … `--radius-island`
- 阴影：接触 + 软层 + 环境；岛用 `::before` 顶高光

## 组件习惯

- 分段控件用滑动白拇指（`.seg-thumb`）
- 检查器轨用铂金滑动拇指（`.rail-thumb`）
- 焦点：`:focus-visible` 铂金环，禁用浏览器蓝 outline
- 项目行：缩略帧 + 名称 + 时长分辨率
