#!/usr/bin/env python3
"""二次修复：上次把含连续点的 chunk 名转换为 '--js'（丢了 .js 扩展名），
导致 Turbopack runtime 无法从 URL 推断 chunk 类型。
本次把 `xxx--js` 重命名为 `xxx--.js`（css 同理），并同步全局引用。"""
import os, shutil

APP = '/opt/Smart-Agriculture/smart-agriculture/.next'
STATIC = os.path.join(APP, 'static')

def fix_name(name):
    """在最后一个 '--js'/'--css' 段前补点：X--js -> X--.js"""
    for ext in ('--js', '--css', '--map'):
        idx = name.rfind(ext)
        if idx != -1 and (idx + len(ext) == len(name)):
            return name[:idx] + '-.' + ext[2:] + name[idx+len(ext):] if False else name[:idx] + '--.' + name[idx+2:]
    return None

# 1. 收集需二次修复的文件（仅上次转换产物：名字含 '--js'/'--css' 结尾且原扩展点丢失）
bad = []
for root, _dirs, files in os.walk(STATIC):
    for f in files:
        nf = fix_name(f)
        if nf and nf != f and not os.path.exists(os.path.join(root, nf)):
            bad.append((os.path.join(root, f), os.path.join(root, nf), f, nf))

print(f"需二次修复 {len(bad)} 个文件:")
mapping = []
for src, dst, old, new in bad:
    shutil.move(src, dst)
    mapping.append((old, new))
    print(f"  {old} -> {new}")

if not mapping:
    print("无需修复")
    raise SystemExit(0)

# 2. 全局替换引用（字节级）
replacements = [(a.encode(), b.encode()) for a, b in mapping]
changed = 0
for root, _dirs, files in os.walk(APP):
    for f in files:
        fp = os.path.join(root, f)
        try:
            with open(fp, 'rb') as fh:
                data = fh.read()
        except OSError:
            continue
        nd = data
        hit = False
        for old, new in replacements:
            if old in nd:
                nd = nd.replace(old, new)
                hit = True
        if hit:
            with open(fp, 'wb') as fh:
                fh.write(nd)
            changed += 1
            print(f"已更新引用: {fp}")
print(f"更新 {changed} 个文件的引用")
print("=== 二次修复完成 ===")
