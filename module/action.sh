#!/system/bin/sh
# Hymo Action Script
# 用于在管理器中一键重置 HymoFS 映射

HYMO_BIN="/data/adb/modules/hymo/hymod"
LOG_FILE="/data/adb/hymo/daemon.log"

echo "----------------------------------------"
echo "⚡ HymoFS 紧急重置"
echo "----------------------------------------"

if [ -x "$HYMO_BIN" ]; then
    echo "正在尝试清空映射规则..."
    
    if "$HYMO_BIN" clear; then
        echo "✅ 成功: 所有 HymoFS 映射已清空"
        echo "   系统路径应已恢复原状"
    else
        echo "❌ 失败: hymod 执行失败"
    fi
else
    echo "❌ 失败: 找不到 hymod 可执行文件"
fi

echo "----------------------------------------"
echo "操作完成"
