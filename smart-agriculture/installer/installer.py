"""
天工慧眼 - 智慧农业物联网平台 安装程序
使用 customtkinter 构建现代化UI
"""

import customtkinter as ctk
import subprocess
import threading
import os
import sys
import shutil
from pathlib import Path
import tkinter as tk
from tkinter import filedialog, messagebox

# 设置主题
ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")


class InstallerApp(ctk.CTk):
    def __init__(self):
        super().__init__()
        
        self.title("天工慧眼 - 智慧农业物联网平台 安装程序")
        self.resizable(True, True)
        self.minsize(700, 550)
        
        # 获取屏幕尺寸并设置窗口大小（80%屏幕）
        screen_width = self.winfo_screenwidth()
        screen_height = self.winfo_screenheight()
        win_width = min(800, int(screen_width * 0.8))
        win_height = min(600, int(screen_height * 0.8))
        
        # 居中显示
        x = (screen_width - win_width) // 2
        y = (screen_height - win_height) // 2
        self.geometry(f"{win_width}x{win_height}+{x}+{y}")
        
        # 安装目录
        self.install_dir = ctk.StringVar(value=str(Path.home() / "TianGongHuiYan"))
        
        # 状态
        self.install_running = False
        
        # 创建UI
        self.create_widgets()
        
    def create_widgets(self):
        # ===== 底部：按钮（固定在底部） =====
        button_frame = ctk.CTkFrame(self, fg_color="#1f2937", corner_radius=0)
        button_frame.pack(fill="x", side="bottom")
        
        btn_inner = ctk.CTkFrame(button_frame, fg_color="transparent")
        btn_inner.pack(fill="x", padx=20, pady=10)
        
        self.cancel_btn = ctk.CTkButton(btn_inner, text="取消", 
                                         height=40, width=100,
                                         font=("Microsoft YaHei", 13),
                                         fg_color="#6b7280", hover_color="#4b5563",
                                         command=self.cancel_install)
        self.cancel_btn.pack(side="right")
        
        self.install_btn = ctk.CTkButton(btn_inner, text="开始安装", 
                                          height=40, width=120,
                                          font=("Microsoft YaHei", 13, "bold"),
                                          fg_color="#2563eb", hover_color="#1d4ed8",
                                          command=self.start_install)
        self.install_btn.pack(side="right", padx=(10, 0))
        
        # ===== 主内容区域（可滚动） =====
        main_frame = ctk.CTkFrame(self, fg_color="transparent")
        main_frame.pack(fill="both", expand=True, padx=20, pady=(15, 5))
        
        # ===== 顶部：Logo和标题 =====
        header_frame = ctk.CTkFrame(main_frame, fg_color="transparent")
        header_frame.pack(fill="x", pady=(0, 15))
        
        # Logo区域
        logo_frame = ctk.CTkFrame(header_frame, width=60, height=60, 
                                   fg_color="#2563eb", corner_radius=12)
        logo_frame.pack(side="left", padx=(0, 12))
        logo_frame.pack_propagate(False)
        
        logo_label = ctk.CTkLabel(logo_frame, text="TG", 
                                   font=("Microsoft YaHei", 22, "bold"),
                                   text_color="white")
        logo_label.place(relx=0.5, rely=0.5, anchor="center")
        
        # 标题
        title_frame = ctk.CTkFrame(header_frame, fg_color="transparent")
        title_frame.pack(side="left", fill="y")
        
        ctk.CTkLabel(title_frame, text="天工慧眼", 
                      font=("Microsoft YaHei", 20, "bold"),
                      text_color="#ffffff").pack(anchor="w")
        ctk.CTkLabel(title_frame, text="智慧农业物联网监控平台 v1.0.0", 
                      font=("Microsoft YaHei", 11),
                      text_color="#9ca3af").pack(anchor="w")
        
        # ===== 安装选项 =====
        options_frame = ctk.CTkFrame(main_frame, corner_radius=10)
        options_frame.pack(fill="x", pady=(0, 10))
        
        ctk.CTkLabel(options_frame, text="安装选项", 
                      font=("Microsoft YaHei", 13, "bold")).pack(anchor="w", padx=15, pady=(10, 8))
        
        # 安装目录
        dir_frame = ctk.CTkFrame(options_frame, fg_color="transparent")
        dir_frame.pack(fill="x", padx=15, pady=(0, 10))
        
        ctk.CTkLabel(dir_frame, text="安装目录:", 
                      font=("Microsoft YaHei", 11)).pack(anchor="w", pady=(0, 3))
        
        dir_input_frame = ctk.CTkFrame(dir_frame, fg_color="transparent")
        dir_input_frame.pack(fill="x")
        
        self.dir_entry = ctk.CTkEntry(dir_input_frame, textvariable=self.install_dir,
                                       height=36, font=("Microsoft YaHei", 11))
        self.dir_entry.pack(side="left", fill="x", expand=True, padx=(0, 8))
        
        browse_btn = ctk.CTkButton(dir_input_frame, text="浏览", width=70, height=36,
                                    font=("Microsoft YaHei", 11),
                                    command=self.browse_directory)
        browse_btn.pack(side="right")
        
        # 组件选择
        components_frame = ctk.CTkFrame(options_frame, fg_color="transparent")
        components_frame.pack(fill="x", padx=15, pady=(0, 10))
        
        ctk.CTkLabel(components_frame, text="安装组件:", 
                      font=("Microsoft YaHei", 11)).pack(anchor="w", pady=(0, 3))
        
        self.var_nodejs = ctk.BooleanVar(value=True)
        self.var_python = ctk.BooleanVar(value=True)
        self.var_ollama = ctk.BooleanVar(value=True)
        self.var_yolo = ctk.BooleanVar(value=True)
        self.var_rag = ctk.BooleanVar(value=True)
        
        checks_frame = ctk.CTkFrame(components_frame, fg_color="transparent")
        checks_frame.pack(fill="x")
        
        ctk.CTkCheckBox(checks_frame, text="Node.js", 
                        variable=self.var_nodejs, font=("Microsoft YaHei", 10)).pack(side="left", padx=(0, 12))
        ctk.CTkCheckBox(checks_frame, text="Python", 
                        variable=self.var_python, font=("Microsoft YaHei", 10)).pack(side="left", padx=(0, 12))
        ctk.CTkCheckBox(checks_frame, text="Ollama", 
                        variable=self.var_ollama, font=("Microsoft YaHei", 10)).pack(side="left", padx=(0, 12))
        ctk.CTkCheckBox(checks_frame, text="YOLO", 
                        variable=self.var_yolo, font=("Microsoft YaHei", 10)).pack(side="left", padx=(0, 12))
        ctk.CTkCheckBox(checks_frame, text="RAG", 
                        variable=self.var_rag, font=("Microsoft YaHei", 10)).pack(side="left")
        
        # ===== 进度区域 =====
        progress_frame = ctk.CTkFrame(main_frame, corner_radius=10)
        progress_frame.pack(fill="both", expand=True, pady=(0, 5))
        
        ctk.CTkLabel(progress_frame, text="安装进度", 
                      font=("Microsoft YaHei", 13, "bold")).pack(anchor="w", padx=15, pady=(10, 5))
        
        # 进度条
        self.progress_bar = ctk.CTkProgressBar(progress_frame, height=6)
        self.progress_bar.pack(fill="x", padx=15, pady=(0, 5))
        self.progress_bar.set(0)
        
        # 状态标签
        self.status_label = ctk.CTkLabel(progress_frame, text="准备安装...", 
                                          font=("Microsoft YaHei", 10),
                                          text_color="#9ca3af")
        self.status_label.pack(anchor="w", padx=15, pady=(0, 3))
        
        # 日志区域
        self.log_text = ctk.CTkTextbox(progress_frame, height=150, 
                                        font=("Consolas", 10),
                                        fg_color="#111827",
                                        text_color="#d1d5db")
        self.log_text.pack(fill="both", expand=True, padx=15, pady=(0, 10))
        
    def browse_directory(self):
        directory = filedialog.askdirectory(initialdir=self.install_dir.get())
        if directory:
            self.install_dir.set(directory)
            
    def log(self, message, level="info"):
        """添加日志"""
        colors = {
            "info": "#d1d5db",
            "success": "#10b981",
            "warning": "#f59e0b",
            "error": "#ef4444"
        }
        self.log_text.configure(state="normal")
        self.log_text.insert("end", f"{message}\n")
        self.log_text.see("end")
        self.log_text.configure(state="disabled")
        
    def update_status(self, text, progress=None):
        """更新状态"""
        self.status_label.configure(text=text)
        if progress is not None:
            self.progress_bar.set(progress)
        self.update_idletasks()
        
    def check_command(self, cmd):
        """检查命令是否存在"""
        try:
            subprocess.run([cmd, "--version"], capture_output=True, timeout=5)
            return True
        except:
            return False
            
    def run_command(self, cmd, cwd=None):
        """运行命令"""
        try:
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=cwd)
            stdout = result.stdout or ""
            stderr = result.stderr or ""
            return result.returncode == 0, stdout + stderr
        except Exception as e:
            return False, str(e)
            
    def run_command_with_progress(self, cmd, cwd=None, progress_callback=None):
        """运行命令并实时输出进度"""
        try:
            process = subprocess.Popen(
                cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                cwd=cwd, bufsize=1
            )
            
            output_lines = []
            for raw_line in process.stdout:
                try:
                    line = raw_line.decode('utf-8', errors='ignore').strip()
                except:
                    try:
                        line = raw_line.decode('gbk', errors='ignore').strip()
                    except:
                        line = ""
                
                if line:
                    output_lines.append(line)
                    self.log(f"  {line}")
                    if progress_callback:
                        progress_callback(line)
                    self.update_idletasks()
            
            process.wait()
            return process.returncode == 0, "\n".join(output_lines)
        except Exception as e:
            return False, str(e)
            
    def start_install(self):
        """开始安装"""
        if self.install_running:
            return
            
        self.install_running = True
        self.install_btn.configure(state="disabled", text="安装中...")
        self.cancel_btn.configure(state="disabled")
        
        # 在新线程中执行安装
        thread = threading.Thread(target=self.install_process, daemon=True)
        thread.start()
        
    def cancel_install(self):
        """取消安装"""
        if not self.install_running:
            self.destroy()
            
    def install_process(self):
        """安装流程"""
        try:
            install_path = Path(self.install_dir.get())
            total_steps = 8
            current_step = 0
            
            # 步骤1：检查依赖
            self.log("=" * 50)
            self.log("开始检查系统依赖...")
            self.update_status("检查系统依赖...", current_step / total_steps)
            
            # 检查Git
            if self.check_command("git"):
                self.log("✓ Git 已安装", "success")
            else:
                self.log("✗ Git 未安装，请先安装 Git", "error")
                self.update_status("安装失败：缺少 Git", 0)
                return
                
            # 检查Node.js
            if self.check_command("node"):
                self.log("✓ Node.js 已安装", "success")
            else:
                if self.var_nodejs.get():
                    self.log("⚠ Node.js 未安装，将尝试自动安装...", "warning")
                else:
                    self.log("⚠ Node.js 未安装", "warning")
                    
            # 检查Python
            if self.check_command("python"):
                self.log("✓ Python 已安装", "success")
            else:
                if self.var_python.get():
                    self.log("⚠ Python 未安装，将尝试自动安装...", "warning")
                else:
                    self.log("⚠ Python 未安装", "warning")
                    
            current_step += 1
            
            # 步骤2：创建安装目录
            self.log("")
            self.log("创建安装目录...")
            self.update_status("创建安装目录...", current_step / total_steps)
            
            try:
                install_path.mkdir(parents=True, exist_ok=True)
                self.log(f"✓ 安装目录: {install_path}", "success")
            except Exception as e:
                self.log(f"✗ 创建目录失败: {e}", "error")
                return
                
            current_step += 1
            
            # 步骤3：获取项目文件
            self.log("")
            self.log("获取项目文件...")
            self.update_status("获取项目文件...", current_step / total_steps)
            
            target_dir = install_path / "smart-agriculture"
            
            if target_dir.exists():
                self.log("✓ 项目目录已存在，跳过下载", "success")
            else:
                # 尝试多个下载源
                repo_urls = [
                    "https://github.com/YANGQINGFEENG/Smart-Agriculture.git",
                    "https://gitee.com/mirrors_yangqingfeeng/Smart-Agriculture.git",  # Gitee镜像
                ]
                
                download_success = False
                
                # 方式1：尝试Git克隆
                for repo_url in repo_urls:
                    self.log(f"尝试下载: {repo_url}")
                    
                    def git_progress(line):
                        if "Receiving objects:" in line:
                            try:
                                pct = line.split("Receiving objects:")[1].strip().split("%")[0].strip()
                                if pct.isdigit():
                                    self.update_status(f"下载中... {pct}%", (current_step + int(pct) / 100) / total_steps)
                            except:
                                pass
                    
                    success, output = self.run_command_with_progress(
                        f'git clone --progress {repo_url} "{target_dir}"',
                        progress_callback=git_progress
                    )
                    if success:
                        download_success = True
                        self.log("✓ 项目下载完成", "success")
                        break
                    else:
                        self.log(f"  下载失败，尝试下一个源...")
                        # 清理失败的目录
                        if target_dir.exists():
                            shutil.rmtree(target_dir, ignore_errors=True)
                
                # 方式2：如果Git都失败，提示用户手动选择
                if not download_success:
                    self.log("")
                    self.log("⚠ 自动下载失败，可能原因：", "warning")
                    self.log("  - 网络连接问题")
                    self.log("  - 无法访问GitHub")
                    self.log("")
                    self.log("请选择以下方式之一继续：", "info")
                    self.log("  1. 选择已下载的项目ZIP文件")
                    self.log("  2. 选择已解压的项目文件夹")
                    self.log("")
                    
                    # 弹出选择对话框
                    from tkinter import messagebox
                    choice = messagebox.askyesnocancel(
                        "选择安装方式",
                        "自动下载失败，请选择安装方式：\n\n"
                        "是(Y) - 选择已下载的ZIP文件\n"
                        "否(N) - 选择已解压的项目文件夹\n"
                        "取消 - 退出安装"
                    )
                    
                    if choice is None:  # 取消
                        self.log("用户取消安装", "warning")
                        return
                    elif choice:  # 选择ZIP文件
                        zip_path = filedialog.askopenfilename(
                            title="选择项目ZIP文件",
                            filetypes=[("ZIP文件", "*.zip"), ("所有文件", "*.*")]
                        )
                        if zip_path:
                            self.log(f"选择文件: {zip_path}")
                            try:
                                import zipfile
                                with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                                    zip_ref.extractall(install_path)
                                # 查找解压后的目录
                                extracted_dirs = [d for d in install_path.iterdir() if d.is_dir() and "smart-agriculture" in d.name.lower()]
                                if extracted_dirs:
                                    extracted_dirs[0].rename(target_dir)
                                self.log("✓ 项目文件解压完成", "success")
                                download_success = True
                            except Exception as e:
                                self.log(f"✗ 解压失败: {e}", "error")
                        else:
                            self.log("未选择文件", "warning")
                    else:  # 选择文件夹
                        folder_path = filedialog.askdirectory(title="选择已解压的项目文件夹")
                        if folder_path:
                            folder_path = Path(folder_path)
                            self.log(f"选择目录: {folder_path}")
                            # 复制到目标目录
                            shutil.copytree(folder_path, target_dir)
                            self.log("✓ 项目文件复制完成", "success")
                            download_success = True
                        else:
                            self.log("未选择目录", "warning")
                
                if not download_success:
                    self.log("✗ 无法获取项目文件，安装终止", "error")
                    return
                    
            current_step += 1
            
            # 步骤4：安装Node.js依赖
            self.log("")
            self.log("安装 Node.js 依赖（请稍候）...")
            self.update_status("安装 Node.js 依赖...", current_step / total_steps)
            
            os.chdir(target_dir)
            def npm_progress(line):
                if "added" in line and "packages" in line:
                    self.update_status("Node.js 依赖安装完成", (current_step + 0.9) / total_steps)
                elif "npm warn" not in line.lower() and "npm ERR" not in line.lower():
                    if len(line) < 100:
                        self.update_status(f"npm: {line[:50]}...", current_step / total_steps)
            
            success, output = self.run_command_with_progress("npm install", cwd=str(target_dir), progress_callback=npm_progress)
            if success:
                self.log("✓ Node.js 依赖安装完成", "success")
            else:
                self.log(f"⚠ Node.js 依赖安装可能有问题，继续...", "warning")
                
            current_step += 1
            
            # 步骤5：安装Python依赖
            self.log("")
            self.log("安装 Python 依赖（请稍候）...")
            self.update_status("安装 Python 依赖...", current_step / total_steps)
            
            venv_path = target_dir / "inference-service" / "venv"
            if not venv_path.exists():
                self.log("创建 Python 虚拟环境...")
                self.run_command(f'python -m venv "{venv_path}"')
                
            # 安装Python依赖
            if os.name == 'nt':  # Windows
                pip_cmd = f'"{venv_path}\\Scripts\\pip" install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple'
            else:
                pip_cmd = f'source "{venv_path}/bin/activate" && pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple'
                
            def pip_progress(line):
                if "Successfully installed" in line:
                    self.update_status("Python 依赖安装完成", (current_step + 0.9) / total_steps)
                elif "Downloading" in line or "Installing" in line:
                    self.update_status(f"pip: {line[:60]}...", current_step / total_steps)
            
            success, output = self.run_command_with_progress(pip_cmd, cwd=str(target_dir / "inference-service"), progress_callback=pip_progress)
            if success:
                self.log("✓ Python 依赖安装完成", "success")
            else:
                self.log(f"⚠ Python 依赖安装可能有问题，继续...", "warning")
                
            current_step += 1
            
            # 步骤6：初始化数据库
            self.log("")
            self.log("初始化数据库...")
            self.update_status("初始化数据库...", current_step / total_steps)
            
            success, output = self.run_command("node scripts/init-db.js", cwd=str(target_dir))
            if success:
                self.log("✓ 数据库初始化完成", "success")
            else:
                self.log(f"⚠ 数据库可能已存在，继续...", "warning")
                
            current_step += 1
            
            # 步骤7：创建环境变量
            self.log("")
            self.log("配置环境变量...")
            self.update_status("配置环境变量...", current_step / total_steps)
            
            env_example = target_dir / ".env.example"
            env_local = target_dir / ".env.local"
            
            if env_example.exists() and not env_local.exists():
                shutil.copy(env_example, env_local)
                self.log("✓ 环境变量文件已创建", "success")
            else:
                self.log("✓ 环境变量文件已存在", "success")
                
            current_step += 1
            
            # 步骤8：创建启动脚本
            self.log("")
            self.log("创建快捷方式...")
            self.update_status("创建快捷方式...", current_step / total_steps)
            
            # 创建桌面快捷方式（Windows）
            if os.name == 'nt':
                desktop = Path.home() / "Desktop"
                shortcut_path = desktop / "TianGongHuiYan.bat"
                
                with open(shortcut_path, 'w', encoding='utf-8') as f:
                    f.write(f'@echo off\n')
                    f.write(f'chcp 65001 >nul\n')
                    f.write(f'cd /d "{target_dir}"\n')
                    f.write(f'start http://localhost:3000\n')
                    f.write(f'npm run dev\n')
                    
                self.log(f"✓ Desktop shortcut created: {shortcut_path}", "success")
                
            current_step += 1
            
            # 完成
            self.log("")
            self.log("=" * 50)
            self.log("🎉 安装完成！", "success")
            self.log("")
            self.log(f"安装目录: {target_dir}")
            self.log("")
            self.log("启动方式:")
            self.log(f"  1. 进入目录: cd {target_dir}")
            self.log(f"  2. 运行: setup.bat (Windows) 或 ./setup.sh (Linux/macOS)")
            self.log(f"  3. 访问: http://localhost:3000")
            self.log("")
            self.log("Or double-click desktop shortcut 'TianGongHuiYan.bat'")
            
            self.update_status("安装完成！", 1.0)
            
            # 启用按钮
            self.install_btn.configure(state="normal", text="完成")
            self.install_btn.configure(command=self.destroy)
            
        except Exception as e:
            self.log(f"✗ 安装过程中出现错误: {e}", "error")
            self.update_status("安装失败", 0)
            
        finally:
            self.install_running = False
            self.cancel_btn.configure(state="normal")


if __name__ == "__main__":
    app = InstallerApp()
    app.mainloop()
