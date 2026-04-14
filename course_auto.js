//请勿在已确认过的文档页面或者习题页面运行该脚本！

(function () {
  "use strict";

  if (window.__studyCatalogAutoInstalled) {
    console.log("[catalog-auto] 脚本已经安装过了");
    return;
  }
  window.__studyCatalogAutoInstalled = true;

  const CONFIG = {
    loopInterval: 2000,
    skipTypes: ["习题"],
    playTypes: ["视频", "音频"],
    textTypes: ["文档"],
    endToleranceSec: 1.0,
    nextDebounceMs: 4000,
    textClickDebounceMs: 4000,
    clickSettleMs: 1500,
    mediaWaitMs: 12000,
    debugTable: false
  };

  function log(...args) {
    console.log("[catalog-auto]", ...args);
  }

  function textOf(el) {
    return (el?.innerText || el?.textContent || "").trim();
  }

  function isVisible(el) {
    if (!el) return false;
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }

  function now() {
    return Date.now();
  }

  function getCatalogItems() {
    const roots = Array.from(document.querySelectorAll("div.courseware"))
      .filter(el => isVisible(el));

    const items = [];

    for (const root of roots) {
      const titleEl = root.querySelector("div.courseware__title > span.title");
      if (!titleEl) continue;

      const title = textOf(titleEl);
      if (!title) continue;

      const fullText = textOf(root);
      const type = ["视频", "音频", "文档", "习题"].find(t => fullText.includes(t)) || "未知";
      if (type === "未知") continue;

      const clickable =
        root.querySelector("div.courseware__title") ||
        root.querySelector("span.title") ||
        root;

      items.push({
        root,
        clickable,
        titleEl,
        title,
        type,
        fullText
      });
    }

    return items;
  }

  function sameItem(a, b) {
    if (!a || !b) return false;
    return a.title === b.title && a.type === b.type;
  }

  function findIndexOfItem(items, item) {
    if (!items.length || !item) return -1;
    return items.findIndex(x => sameItem(x, item));
  }

  function detectPageMode() {
    const pageText = (document.body?.innerText || "").slice(0, 5000);

    if (/单选题|多选题|判断题|提交答案|正确答案|题目/.test(pageText)) {
      return "quiz";
    }

    if (/完成学习|点击完成学习|完成阅读|我已学习/.test(pageText)) {
      return "text";
    }

    if (document.querySelector("video")) return "video";
    if (document.querySelector("audio")) return "audio";

    return "unknown";
  }

  function detectCurrentItem(items) {
    if (!items.length) return null;

    // 1. active 类
    const active = items.find(item => {
      const titleBox = item.root.querySelector("div.courseware__title");
      return titleBox && titleBox.classList.contains("active");
    });
    if (active) return active;

    // 2. 蓝色标题
    const blue = items.find(item => {
      try {
        return getComputedStyle(item.titleEl).color === "rgb(0, 128, 255)";
      } catch (e) {
        return false;
      }
    });
    if (blue) return blue;

    // 3. 上次点击项
    if (window.__catalogLastClickedItem) {
      const idx = findIndexOfItem(items, window.__catalogLastClickedItem);
      if (idx >= 0) return items[idx];
    }

    // 4. 上次稳定项
    if (window.__catalogLastStableItem) {
      const idx = findIndexOfItem(items, window.__catalogLastStableItem);
      if (idx >= 0) return items[idx];
    }

    // 5. 上次索引
    if (typeof window.__catalogCurrentIndex === "number" && items[window.__catalogCurrentIndex]) {
      return items[window.__catalogCurrentIndex];
    }

    return null;
  }

  function rememberCurrentItem(items, item) {
    if (!item) return;
    const idx = findIndexOfItem(items, item);
    if (idx >= 0) {
      window.__catalogCurrentIndex = idx;
      window.__catalogLastStableItem = {
        title: item.title,
        type: item.type
      };
    }
  }

  function clickItem(item, reason = "") {
    if (!item) return false;

    const target =
      item.root.querySelector("div.courseware__title") ||
      item.titleEl ||
      item.clickable ||
      item.root;

    try {
      target.click();

      window.__catalogLastClickedAt = now();
      window.__catalogLastClickedItem = {
        title: item.title,
        type: item.type
      };

      log("点击目录项", {
        reason,
        type: item.type,
        title: item.title
      });
      return true;
    } catch (e) {
      log("点击目录项失败", reason, e);
      return false;
    }
  }

  function getCurrentMedia() {
    const video = document.querySelector("video");
    if (video) return { type: "视频", media: video };

    const audio = document.querySelector("audio");
    if (audio) return { type: "音频", media: audio };

    return null;
  }

  function installPauseBlock(media) {
    if (!media) return;

    if (!media.__rawPause) {
      media.__rawPause = media.pause.bind(media);
    }
    if (!media.__rawPlay) {
      media.__rawPlay = media.play.bind(media);
    }

    if (!media.__pauseBlockedInstalled) {
      media.pause = function () {
        log("pause() 已拦截", {
          currentTime: media.currentTime,
          visibilityState: document.visibilityState,
          hidden: document.hidden
        });
        return;
      };
      media.__pauseBlockedInstalled = true;
    }
  }

  function ensurePlaying(media, type) {
    if (!media) return;

    if (media.paused) {
      Promise.resolve()
        .then(() => (media.__rawPlay ? media.__rawPlay() : media.play()))
        .then(() => log(type, "开始/恢复播放成功"))
        .catch(err => log(type, "播放失败", err));
    }
  }

  function bindEnded(media) {
    if (!media) return;

    if (media.__catalogEndedHandler) {
      media.removeEventListener("ended", media.__catalogEndedHandler);
    }

    const handler = function () {
      const items = getCatalogItems();
      const currentItem = detectCurrentItem(items);
      if (currentItem) rememberCurrentItem(items, currentItem);

      log("媒体 ended，切换下一对象", currentItem);

      setTimeout(() => {
        gotoNextEligible(getCatalogItems(), detectCurrentItem(getCatalogItems()), "ended");
      }, 1200);
    };

    media.addEventListener("ended", handler);
    media.__catalogEndedHandler = handler;
  }

  function isNearEnd(media) {
    if (!media) return false;
    if (!isFinite(media.duration) || media.duration <= 0) return false;
    return media.duration - media.currentTime <= CONFIG.endToleranceSec;
  }

  function findBaseIndex(items, currentItem) {
    let idx = findIndexOfItem(items, currentItem);

    if (idx < 0 && window.__catalogLastClickedItem) {
      idx = findIndexOfItem(items, window.__catalogLastClickedItem);
    }

    if (idx < 0 && window.__catalogLastStableItem) {
      idx = findIndexOfItem(items, window.__catalogLastStableItem);
    }

    if (idx < 0 && typeof window.__catalogCurrentIndex === "number") {
      idx = window.__catalogCurrentIndex;
    }

    return idx;
  }

  function gotoNextEligible(items, currentItem, reason = "") {
    if (!items.length) {
      log("无法跳下一项：items 为空", { reason });
      return false;
    }

    const idx = findBaseIndex(items, currentItem);

    if (idx < 0) {
      log("当前索引未知，拒绝盲跳，避免跳回前面对象", { reason });
      return false;
    }

    for (let i = idx + 1; i < items.length; i++) {
      const next = items[i];
      if (!next) continue;

      if (currentItem && sameItem(next, currentItem)) {
        continue;
      }

      // 真正跳过习题：不点击，不进入
      if (CONFIG.skipTypes.includes(next.type)) {
        log("真正跳过习题/非播放对象，不进入页面", {
          type: next.type,
          title: next.title,
          reason
        });
        continue;
      }

      // 文档：进入后自动完成
      if (CONFIG.textTypes.includes(next.type)) {
        log("切换到文档对象", {
          type: next.type,
          title: next.title,
          reason
        });
        if (clickItem(next, "text_" + next.type)) {
          window.__catalogCurrentIndex = i;
        }
        return true;
      }

      // 视频/音频：进入并播放
      if (CONFIG.playTypes.includes(next.type)) {
        log("切换到下一播放对象", {
          type: next.type,
          title: next.title,
          reason
        });
        if (clickItem(next, "play_" + next.type)) {
          window.__catalogCurrentIndex = i;
          window.__waitingMediaItem = {
            title: next.title,
            type: next.type,
            since: now()
          };
        }
        return true;
      }
    }

    log("已经没有下一个可处理对象了");
    return false;
  }

  function findTextCompleteButton() {
    const labelNodes = Array.from(document.querySelectorAll("span.fixed-action__label"))
      .filter(el => isVisible(el));

    const byText = labelNodes.find(el => /完成学习|点击完成学习|完成阅读|我已学习/.test(textOf(el)));
    if (byText) {
      return byText.closest("button, div, a") || byText.parentElement || byText;
    }

    const all = Array.from(document.querySelectorAll("button, a, div, span"))
      .filter(el => isVisible(el));

    return all.find(el => /完成学习|点击完成学习|完成阅读|我已学习/.test(textOf(el))) || null;
  }

  function isCurrentItemChanged(items, oldItem) {
    const current = detectCurrentItem(items);
    return current && oldItem && !sameItem(current, oldItem);
  }

  function handleTextPage(currentItem, items) {
    const btn = findTextCompleteButton();

    if (window.__lastTextClickItem && sameItem(window.__lastTextClickItem, currentItem)) {
      const delta = now() - (window.__lastTextCompleteClickTime || 0);

      if (delta < CONFIG.clickSettleMs) {
        log("文档按钮刚点击，等待页面结算...", currentItem);
        return;
      }

      if (isCurrentItemChanged(getCatalogItems(), window.__lastTextClickItem)) {
        log("文档点击后当前项已变化，进入下一对象");
        window.__lastTextClickItem = null;
        return;
      }

      if (!btn) {
        log("文档按钮已消失，尝试进入下一对象", currentItem);
        window.__lastTextClickItem = null;
        gotoNextEligible(items, currentItem, "text_button_disappeared");
        return;
      }
    }

    if (!btn) {
      log("文档页未找到完成按钮，等待...", currentItem);
      return;
    }

    const n = now();
    if (!window.__lastTextCompleteClickTime || n - window.__lastTextCompleteClickTime > CONFIG.textClickDebounceMs) {
      btn.click();
      window.__lastTextCompleteClickTime = n;
      window.__lastTextClickItem = {
        title: currentItem.title,
        type: currentItem.type
      };

      log("已点击文档完成按钮", {
        title: currentItem.title,
        btnText: textOf(btn)
      });
      return;
    }

    log("文档按钮已点过，等待状态变化...", currentItem);
  }

  function handlePendingMediaWait(currentItem) {
    if (!currentItem) return false;
    if (!CONFIG.playTypes.includes(currentItem.type)) return false;

    const waiting = window.__waitingMediaItem;

    if (!waiting || !sameItem(waiting, currentItem)) {
      window.__waitingMediaItem = {
        title: currentItem.title,
        type: currentItem.type,
        since: now()
      };
      log("开始等待媒体对象挂载", currentItem);
      return true;
    }

    const delta = now() - waiting.since;
    if (delta < CONFIG.mediaWaitMs) {
      log("媒体对象尚未出现，继续等待...", {
        item: currentItem,
        waitedMs: delta
      });
      return true;
    }

    log("等待媒体挂载超时，但不自动跳过，继续观察", {
      item: currentItem,
      waitedMs: delta
    });
    return true;
  }

  function printCatalog(items, currentItem) {
    if (!CONFIG.debugTable) return;
    const simple = items.map((x, i) => ({
      i,
      type: x.type,
      title: x.title,
      current: !!(currentItem && sameItem(x, currentItem))
    }));
    console.table(simple);
  }

  function mainLoop() {
    try {
      const items = getCatalogItems();
      if (!items.length) {
        log("未扫描到目录项");
        return;
      }

      const currentItem = detectCurrentItem(items);

      window.__catalogItems = items;
      window.__catalogCurrentItem = currentItem;

      if (currentItem) {
        rememberCurrentItem(items, currentItem);
      }

      printCatalog(items, currentItem);

      if (!currentItem) {
        log("未识别到当前目录项");
        return;
      }

      const mediaInfo = getCurrentMedia();
      const pageMode = detectPageMode();

      // 文档处理
      if (CONFIG.textTypes.includes(currentItem.type) && !mediaInfo) {
        handleTextPage(currentItem, items);
        return;
      }

      if (!mediaInfo) {
        // 正常情况下，不应该再进入习题页
        if (pageMode === "quiz") {
          log("警告：脚本仍然进入了习题页，这说明别处还在点击习题项");
          return;
        }

        if (CONFIG.skipTypes.includes(currentItem.type)) {
          log("当前项本身是可跳过对象，直接继续往后找", {
            type: currentItem.type,
            title: currentItem.title
          });
          gotoNextEligible(items, currentItem, "non_media_current");
          return;
        }

        if (CONFIG.playTypes.includes(currentItem.type)) {
          handlePendingMediaWait(currentItem);
          return;
        }

        log("当前项是", currentItem.type, "，但未命中处理逻辑，等待...");
        return;
      }

      if (window.__waitingMediaItem && sameItem(window.__waitingMediaItem, currentItem)) {
        window.__waitingMediaItem = null;
      }

      const media = mediaInfo.media;
      window.__catalogMedia = media;

      installPauseBlock(media);
      ensurePlaying(media, mediaInfo.type);
      bindEnded(media);

      if (isNearEnd(media) && !media.paused) {
        const n = now();
        if (!window.__lastNextTriggerTime || n - window.__lastNextTriggerTime > CONFIG.nextDebounceMs) {
          window.__lastNextTriggerTime = n;
          log("媒体接近结束，尝试切换下一对象", {
            type: currentItem.type,
            title: currentItem.title
          });
          gotoNextEligible(items, currentItem, "near_end");
        }
      }
    } catch (e) {
      log("mainLoop 异常", e);
    }
  }

  window.__catalogMainLoop = mainLoop;
  window.__catalogTimer = setInterval(mainLoop, CONFIG.loopInterval);

  log("目录驱动自动脚本安装成功");
  log("手动执行一轮：__catalogMainLoop()");
  log("停止脚本：clearInterval(window.__catalogTimer)");

  mainLoop();
})();