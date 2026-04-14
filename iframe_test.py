from selenium import webdriver
from selenium.webdriver.edge.options import Options
import time

options = Options()
driver = webdriver.Edge(options=options)

driver.get("https://myccr.net/#/login")

print("请手动登录，并进入视频播放页面。")
input("进入播放页面后按回车继续...")

frames = driver.execute_script("""
    return Array.from(document.querySelectorAll('iframe')).map((f, i) => ({
        index: i,
        id: f.id,
        className: f.className,
        src: f.src
    }));
""")

print("当前页面 iframe 列表：")
for item in frames:
    print(item)

input("按回车退出...")
driver.quit()