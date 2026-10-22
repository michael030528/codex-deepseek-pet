# 修改版素材与提示词

本目录保存修改版采用的标准形象、内置 ImageGen 原始输出及实际提示词。原项目作者：YunYueSama；原仓库：https://github.com/YunYueSama/codex-deepseek-pet 。这是经过修改的社区衍生版本，保留仓库 LICENSE 与 ASSET_LICENSE.md 的署名和第三方权利说明。

- `canonical.png`：统一参考姿势。
- `expressions/`：吃口粮、表情、伸手、审阅、坐姿/蜷缩、字谜/尾摆的6张原始图及对应精确提示词。
- `transitions/`：坐躺、起停、收手、思考原画及对应提示词。
- `walking/`：本轮左右低抬脚步态、生成所用前版参考、腿部骨架参考及精确提示词。最终采用两个v4完整原画，未采用高抬膝异常候选。步幅按支撑鞋位移标定；左右分别为252/255源像素，移动速度150屏幕像素/秒（100%尺寸）。
- `registration-and-color.json`：完整角色等比缩放和平移、脚位及发色参数。头发颜色单独校准，保留alpha与非头发像素。原始图中的参考中立帧不替代canonical。
- 最终运行图集在 `../../assets/whale/custom-*.png`（从仓库根目录查看）。

素材生成采用内置 ImageGen，未使用API密钥生成脚本。没有光流补帧、局部脸部拼贴或身体拉伸。小憩/蜷缩不播放不合适的深蹲中间姿势。历史测量中的 `local-build/` 是已匿名化的本机构建记录，并非运行依赖。
