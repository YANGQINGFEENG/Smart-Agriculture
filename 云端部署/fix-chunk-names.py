#!/usr/bin/env python3
"""修复 .next 中含连续点(..)的 chunk 文件名：
1. 找出 .next/static 下文件名含 '..' 的文件
2. 复制为安全名（连续点 -> 双横线）
3. 在整个 .next 目录中做字节级引用替换
"""
import os, shutil, sys

APP = '/opt/Smart-Agriculture/smart-agriculture/.next'
STATIC = os.path.join(APP, 'static')

# 1. 收集坏文件
bad_files = []
for root, _dirs, files in os.walk(STATIC):
    for f in files:
        if '..' in f:
            bad_files.append(os.path.join(root, f))

print(f"发现 {len(bad_files)} 个含连续点的文件:")
mapping = []
for path in bad_files:
    name = os.path.basename(path)
    safe = ''
    i = 0
    while i < len(name):
        if name[i] == '.' and i + 1 < len(name) and name[i+1] == '.':
            safe += '--'
            while i < len(name) and name[i] == '.':
                i += 1
        else:
            safe += name[i]
            i += 1
    mapping.append((path, os.path.join(os.path.dirname(path), safe)))
    print(f"  {name}  ->  {safe}")

if not mapping:
    print("无需修复")
    sys.exit(0)

# 2. 复制安全副本
for src, dst in mapping:
    shutil.copy2(src, dst)
    print(f"已复制: {dst}")

# 3. 全局替换引用（字节级，遍历所有文本类文件）
replacements = [(os.path.basename(s).encode(), os.path.basename(d).encode()) for s, d in mapping]
changed = 0
scanned = 0
for root, _dirs, files in os.walk(APP):
    for f in files:
        fp = os.path.join(root, f)
        # 跳过二进制不可控的大文件类型之外的判断，直接尝试读取
        try:
            with open(fp, 'rb') as fh:
                data = fh.read()
        except OSError:
            continue
        scanned += 1
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

print(f"扫描 {scanned} 个文件，更新 {changed} 个")
print("=== 修复完成 ===")
