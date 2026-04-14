from selenium import webdriver
from selenium.webdriver.edge.options import Options
import time
import json

options = Options()
driver = webdriver.Edge(options=options)

driver.get("https://myccr.net/#/login")

print("请手动登录，并进入课程页面。")
print("注意：先不要点播放。")
input("到达课程页面后，按回车注入观测脚本...")

observe_js = r'''
(function() {
    if (window.__mediaHookInstalled) return "already installed";
    window.__mediaHookInstalled = true;

    window.__mediaLogs = [];

    function pushLog(type, data) {
        const item = {
            time: new Date().toISOString(),
            type,
            data
        };
        window.__mediaLogs.push(item);
        console.log("[media-hook]", type, data);
    }

    function brief(el) {
        if (!el) return null;
        return {
            tag: el.tagName || null,
            id: el.id || "",
            className: el.className || "",
            currentTime: typeof el.currentTime === "number" ? el.currentTime : null,
            duration: typeof el.duration === "number" ? el.duration : null,
            paused: typeof el.paused === "boolean" ? el.paused : null,
            src: el.currentSrc || el.src || ""
        };
    }

    // Hook createElement，看看有没有动态创建 video/audio
    const rawCreateElement = Document.prototype.createElement;
    Document.prototype.createElement = function(tagName, options) {
        const el = rawCreateElement.call(this, tagName, options);
        const tag = String(tagName || "").toLowerCase();
        if (tag === "video" || tag === "audio") {
            pushLog("createElement", { tag, el: brief(el) });
        }
        return el;
    };

    // Hook appendChild，看看 video/audio 是否被插入 DOM
    const rawAppendChild = Node.prototype.appendChild;
    Node.prototype.appendChild = function(child) {
        try {
            if (child && child.tagName) {
                const tag = String(child.tagName).toLowerCase();
                if (tag === "video" || tag === "audio") {
                    pushLog("appendChild", {
                        parentTag: this.tagName || null,
                        child: brief(child)
                    });

                    ["play", "pause", "ended", "timeupdate", "loadedmetadata", "canplay", "waiting", "seeking", "seeked"].forEach(evt => {
                        child.addEventListener(evt, function() {
                            pushLog("mediaEvent:" + evt, brief(child));
                        });
                    });
                }
            }
        } catch (e) {
            pushLog("appendChildHookError", { error: String(e) });
        }
        return rawAppendChild.call(this, child);
    };

    // Hook play/pause
    const rawPlay = HTMLMediaElement.prototype.play;
    const rawPause = HTMLMediaElement.prototype.pause;

    HTMLMediaElement.prototype.play = function(...args) {
        pushLog("prototype.play", {
            el: brief(this),
            visibilityState: document.visibilityState,
            hidden: document.hidden
        });
        return rawPlay.apply(this, args);
    };

    HTMLMediaElement.prototype.pause = function(...args) {
        pushLog("prototype.pause", {
            el: brief(this),
            visibilityState: document.visibilityState,
            hidden: document.hidden
        });
        try {
            console.trace("[media-hook] pause stack");
        } catch (e) {}
        return rawPause.apply(this, args);
    };

    // 页面生命周期
    document.addEventListener("visibilitychange", function() {
        pushLog("visibilitychange", {
            visibilityState: document.visibilityState,
            hidden: document.hidden
        });
    }, true);

    window.addEventListener("blur", function() {
        pushLog("window.blur", {});
    }, true);

    window.addEventListener("focus", function() {
        pushLog("window.focus", {});
    }, true);

    // 先扫一次当前 DOM 里是否已有媒体元素
    const existing = Array.from(document.querySelectorAll("video, audio")).map(brief);
    pushLog("initialScan", existing);

    return "media hook installed";
})();
'''

result = driver.execute_script(observe_js)
print("注入结果:", result)

print("现在请你手动点击播放，然后等待几秒。")
input("播放起来后按回车抓取日志...")

logs = driver.execute_script("return window.__mediaLogs || [];")
print("========== 当前日志 ==========")
print(json.dumps(logs, ensure_ascii=False, indent=2))

print("\n接下来请你最小化窗口或切后台，等待 3~5 秒后再回来。")
input("回来后按回车继续抓日志...")

logs2 = driver.execute_script("return window.__mediaLogs || [];")
print("========== 切后台后的日志 ==========")
print(json.dumps(logs2, ensure_ascii=False, indent=2))

input("按回车退出...")
driver.quit()