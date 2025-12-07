#!/system/bin/sh
# Hymo Action Script
# 用于在管理器中一键重置 HymoFS 映射

HYMO_CTL="/proc/hymo_ctl"
LOG_FILE="/data/adb/hymo/daemon.log"

echo "----------------------------------------"
echo "⚡ HymoFS 紧急重置"
echo "----------------------------------------"

if [ -e "$HYMO_CTL" ]; then
    echo "正在尝试清空映射规则..."
    
    # 尝试写入 clear 指令
    if echo "clear" > "$HYMO_CTL"; then
        echo "✅ 成功: 所有 HymoFS 映射已清空"
        echo "   系统路径应已恢复原状"
        
        # 记录日志
        echo "[$(date "+%Y-%m-%d %H:%M:%S")] [ACTION] User triggered manual reset (clear rules)" >> "$LOG_FILE"
    else
        echo "❌ 失败: 无法写入内核接口"
        echo "   请检查 Root 权限或内核模块状态"
    fi
else
    echo "⚠️ 警告: 未检测到 HymoFS 内核模块"
    echo "   (/proc/hymo_ctl 不存在)"
    echo "   可能是模块未加载或已卸载"
fi

echo "----------------------------------------"
echo "操作完成"
