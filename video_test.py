from selenium import webdriver
from selenium.webdriver.edge.options import Options
import time

options = Options()
driver = webdriver.Edge(options=options)

driver.get("https://myccr.net/#/login")

print("请手动登录，并进入视频播放页面。")
input("进入播放页面后按回车继续...")

result = driver.execute_script("""
    const videos = Array.from(document.querySelectorAll('video'));
    return videos.map((v, i) => ({
        index: i,
        id: v.id,
        className: v.className,
        currentTime: v.currentTime,
        duration: v.duration,
        paused: v.paused,
        readyState: v.readyState,
        src: v.currentSrc || v.src
    }));
""")

print("当前页面 video 列表：")
print(result)

input("按回车退出...")
driver.quit()