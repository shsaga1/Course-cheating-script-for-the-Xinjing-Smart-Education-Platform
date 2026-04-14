# Course-cheating-script-for-the-Xinjing-Smart-Education-Platform
此脚本为针对新境智慧教育平台的刷课脚本，你也可以参考大概代码结构对其他课程平台编写脚本
此脚本为纯粹的ai编程。本人没有系统学过怎么写前端代码和JS脚本，因此此脚本除了JS逆向思路和抓包分析过程是我本人想的做的以外，
其他所有内容都是ai所做，包括改进思路，写代码，改进代码，修复bug等。
使用模型为ChatGPT 5.4 Thinking
我提供了Tampermonkey用户脚本和可以直接在DevTools的Console页面使用的Js脚本，我推荐使用后者，因为Tampermonkey脚本我还没有进行过测试，很有可能出现不知名bug。
至于为什么不让ai顺带开发一个可以在本地跑的自动化脚本，可以参考日志DEVLOG.md
第一次使用github上传文件，欢迎各位大佬前来指正错误给出建议。
使用手册如下：
## 功能概览

- 自动识别左侧课程目录项
- 基于当前激活项判断当前位置
- 自动切换到下一个学习对象
**- 自动跳过习题**
**由于没有题库，因此没做自动答题模块，建议用户刷完课之后再手动完成一下题目**
- 自动完成文档页确认按钮
- 拦截后台切换导致的媒体 `pause()`
- 视频/音频结束后自动切下一个

对于不同类型的页面：
- 视频：自动播放，后台拦截 `pause()`，结束后切到下一个对象
- 音频：自动播放，结束后切到下一个对象
- 文档：自动点击“完成学习/完成阅读”类按钮，完成后切到下一个对象
- 习题：直接跳过
因此使用时请勿在已确认过的文档页面或者习题页面运行该脚本！会出现卡死的情况

## 适用前提

脚本目前按以下页面结构编写：

- 目录项根节点：`div.courseware`
- 标题区域：`div.courseware__title`
- 标题文字：`span.title`
- 当前项标记：`div.courseware__title.active`
- 文档完成按钮文字节点：`span.fixed-action__label`

如果页面结构发生变化，需要同步修改脚本中的选择器。


## Tampermonkey脚本使用方法

### 1. 安装 Tampermonkey

先在浏览器里安装 Tampermonkey 扩展。

### 2. 新建脚本

打开 Tampermonkey 面板：

- 点击 “Create a new script”
- 删除默认模板
- 把 `tampermonkey-course-auto.user.js` 的全部内容粘贴进去
- 保存

### 3. 打开课程页面

进入课程页面后，脚本会自动运行。

## 使用方式

正常打开课程页面即可，脚本会自动轮询并处理当前对象。

如果需要手动触发一轮：

```js
__catalogMainLoop()
```

如果需要停止脚本：

```js
clearInterval(window.__catalogTimer)
```

## 调试

脚本默认会在控制台输出日志，前缀为：

```text
[catalog-auto]
```

如果你想在控制台里查看当前解析到的目录项，可以临时执行：

```js
console.table(__catalogItems?.map((x,i)=>({
  i,
  type:x.type,
  title:x.title,
  current: __catalogCurrentItem && x.title===__catalogCurrentItem.title && x.type===__catalogCurrentItem.type
})))
```

## 当前逻辑说明

### 视频 / 音频
- 自动获取当前媒体对象
- 如果媒体被暂停则尝试恢复播放
- 覆盖 `pause()` 以拦截后台切换时的主动暂停
- 监听 `ended`
- 接近结束时也会做兜底切换

### 文档
- 查找“完成学习 / 点击完成学习 / 完成阅读 / 我已学习”类按钮
- 自动点击
- 检测文档是否已完成
- 完成后切到下一个对象

### 习题
- 当前脚本不做答题
- 遇到习题时直接跳过

## 已知限制

- 习题只会跳过，不会自动作答
- 文档完成状态的判断基于按钮文本 / class / aria 属性，若页面逻辑变更需要调整
- 该脚本依赖页面现有 DOM 结构，不适合结构变化频繁的页面
- 只对匹配 `https://myccr.net/*` 的页面自动生效
