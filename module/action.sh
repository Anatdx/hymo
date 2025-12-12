#!/system/bin/sh
# Hymo Action Script
# 用于在管理器中一键重置 HymoFS 映射

HYMO_DEV="/dev/hymo_ctl"
HYMO_BIN="/data/adb/modules/hymo/hymod"
LOG_FILE="/data/adb/hymo/daemon.log"

echo "----------------------------------------"
echo "⚡ HymoFS 紧急重置"
echo "----------------------------------------"

if [ -e "$HYMO_DEV" ]; then
    echo "正在尝试清空映射规则..."
    
    if [ -x "$HYMO_BIN" ]; then
        if "$HYMO_BIN" clear; then
            echo "✅ 成功: 所有 HymoFS 映射已清空"
            echo "   系统路径应已恢复原状"
            
            # 记录日志
            echo "[$(date "+%Y-%m-%d %H:%M:%S")] [ACTION] User triggered manual reset (clear rules)" >> "$LOG_FILE"
        else
            echo "❌ 失败: hymod 执行失败"
        fi
    else
        echo "❌ 失败: 找不到 hymod 可执行文件"
    fi
else
    echo "⚠️ 警告: 未检测到 HymoFS 内核接口"
    echo "   (/dev/hymo_ctl 不存在)"
    echo "   可能是内核不支持 HymoFS"
fi

echo "----------------------------------------"
echo "操作完成"
