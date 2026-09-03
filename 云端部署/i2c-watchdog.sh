#!/bin/bash
# I2C 总线看门狗 —— smart-farm 专用
# 功能：每60秒检测 I2C 总线健康（SDA 电平 + PCA9685 0x40 可读性）；
#       连续2次异常 → 9时钟脉冲恢复总线 → 成功后重启 smart-farm 重新初始化驱动；
#       连续4次恢复失败 → 兜底重启系统。
# 日志：/var/log/i2c-watchdog.log

PIN_SDA=2
PIN_SCL=3
LOGFILE=/var/log/i2c-watchdog.log
FAIL=0

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOGFILE"; }

sda_level() { /usr/bin/pinctrl get $PIN_SDA 2>/dev/null | awk '{print $5}'; }

probe() { timeout 3 /usr/sbin/i2cget -y 1 0x40 0x00 >/dev/null 2>&1; }

bus_recover() {
  for i in $(seq 1 9); do
    /usr/bin/pinctrl set $PIN_SCL op dl
    /usr/bin/pinctrl set $PIN_SCL op dh
  done
  /usr/bin/pinctrl set $PIN_SCL a3 pu
  sleep 1
}

log "=== I2C 看门狗启动 (PID $$) ==="

while true; do
  sleep 60
  lvl=$(sda_level)
  probe; probe_ok=$?
  if [ "$lvl" = "lo" ] || [ $probe_ok -ne 0 ]; then
    FAIL=$((FAIL+1))
    log "ALERT: 总线异常 (SDA=$lvl, 0x40探测$([ $probe_ok -ne 0 ] && echo 失败 || echo 正常))，异常计数=$FAIL"
    if [ $FAIL -ge 2 ]; then
      log "ACTION: 执行9时钟总线恢复..."
      bus_recover
      recovered=0
      for r in 1 2 3; do
        sleep 2
        if probe && [ "$(sda_level)" = "hi" ]; then recovered=1; break; fi
        log "  重试探测 ${r}/3 失败，继续等待..."
        sleep 2
      done
      if [ $recovered -eq 1 ]; then
        log "OK: 总线恢复成功，重启 smart-farm 以重新初始化驱动"
        systemctl restart smart-farm
        FAIL=0
        log "OK: 本轮自愈完成"
      else
        log "WARN: 恢复后仍异常 (SDA=$(sda_level))"
        if [ $FAIL -ge 4 ]; then
          log "ERROR: 连续4轮恢复失败，重启系统兜底"
          FAIL=0
          systemctl reboot
        fi
      fi
    fi
  else
    # 总线健康，清零异常计数
    FAIL=0
  fi
done
