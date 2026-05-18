# Course-cheating-script-for-the-Xinjing-Smart-Education-Platform

**4/15号更新，改变了切换资源页逻辑，减少发生平台读取不到视频看完信号的可能性。已完善文档页面检测功能，现在你可以在任何资源页运行此脚本**


此脚本为针对新境智慧教育平台的脚本，你也可以参考大概代码结构对其他课程平台编写脚本。  

此脚本代码部分使用ai辅助。

下面的使用手册和日志部分也为ai总结

使用模型为ChatGPT 5.4 Thinking

提供了Tampermonkey用户脚本和可以直接在DevTools的Console页面使用的Js脚本，我推荐使用后者，因为Tampermonkey脚本我还没有进行过测试，很有可能出现不知名bug。

同时DEVLOG.md中提到的部分本地测试程序也上传到了文件中，但是由于部分程序已经被我删除，因此并不全，仅供参考

至于为什么不让ai顺带开发一个可以在本地跑的自动化脚本，可以参考日志DEVLOG.md，这个也是ai总结的

第一次使用github上传文件，欢迎各位大佬前来指正错误给出建议。

使用手册如下：

## 功能概览

- 自动识别左侧课程目录项
- 基于当前激活项判断当前位置
- 自动切换到下一个学习对象
-**- 自动跳过习题**
-**因为没做自动答题模块，建议用户刷完课之后再手动完成一下题目**
- 自动完成文档页确认
- 拦截后台切换导致的媒体 `pause()`

对于不同类型的页面：
- 视频：后台自动播放，后台拦截暂停指令，视频结束后切到下一个对象
- 音频：后台自动播放，结束后切到下一个对象
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


## console脚本使用方法

### 1. 打开课程页面

登录账号后打开课程页面，确保该页面不是已确认过的文档页面或者答题页面

### 2. 使用脚本

按f12打开 DevTools 面板：

- 找到Console/命令行页面
- 把 `course-auto.js` 的全部内容粘贴进去
- 回车


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
- 对初始页面为文档页/习题页的状态会产生bug
