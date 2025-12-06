# Hymo Makefile - Multi-Architecture Build System

VERSION := $(shell grep '^version=' module/module.prop | cut -d= -f2)
MODULE_ID := $(shell grep '^id=' module/module.prop | cut -d= -f2)
ANDROID_API := 30

SRC_DIR := src
OUTPUT_DIR := out
BUILD_DIR := build
MODULE_DIR := module
WEBUI_DIR := webui

NDK_PATH ?= $(shell if [ -n "$$NDK_PATH" ]; then echo $$NDK_PATH; elif [ -d "$(HOME)/Android/Sdk/ndk" ]; then ls -d $(HOME)/Android/Sdk/ndk/* 2>/dev/null | tail -1; elif [ -d "$(HOME)/android-ndk" ]; then ls -d $(HOME)/android-ndk/* 2>/dev/null | tail -1; else echo "NDK_NOT_FOUND"; fi)

NDK_LLVM := $(NDK_PATH)/toolchains/llvm/prebuilt/linux-x86_64/bin
CXXFLAGS := -std=c++17 -O2 -Wall -Wextra -static-libstdc++ -static-libgcc -fPIE -pie -Wno-unused-parameter -I$(SRC_DIR) -D__ANDROID__

# Source files
SRC_FILES := $(SRC_DIR)/main.cpp \
             $(SRC_DIR)/utils.cpp \
             $(SRC_DIR)/conf/config.cpp \
             $(SRC_DIR)/core/inventory.cpp \
             $(SRC_DIR)/core/storage.cpp \
             $(SRC_DIR)/core/state.cpp \
             $(SRC_DIR)/core/sync.cpp \
             $(SRC_DIR)/core/modules.cpp \
             $(SRC_DIR)/core/planner.cpp \
             $(SRC_DIR)/core/executor.cpp \
             $(SRC_DIR)/mount/overlay.cpp \
             $(SRC_DIR)/mount/magic.cpp

.PHONY: all clean distclean zip install help check webui arm64 armv7 x86_64 x86 testbuild testziptest

all: check webui arm64 armv7 x86_64 x86

testbuild: check webui arm64

testzip: testbuild
	@echo ""
	@echo "📦 Creating test package (arm64 only)..."
	@rm -rf $(BUILD_DIR)
	@mkdir -p $(BUILD_DIR)
	@cp -r $(MODULE_DIR)/* $(BUILD_DIR)/
	@cp $(OUTPUT_DIR)/hymod-arm64-v8a $(BUILD_DIR)/
	@chmod 755 $(BUILD_DIR)/hymod-arm64-v8a
	@cd $(BUILD_DIR) && zip -r ../$(OUTPUT_DIR)/$(MODULE_ID)-$(VERSION).zip * >/dev/null
	@echo "✅ Test package: $(OUTPUT_DIR)/$(MODULE_ID)-$(VERSION).zip"
	@ls -lh $(OUTPUT_DIR)/$(MODULE_ID)-$(VERSION).zip

check:
	@echo "🔍 Checking build environment..."
	@if [ "$(NDK_PATH)" = "NDK_NOT_FOUND" ]; then echo "❌ NDK not found"; exit 1; fi
	@echo "✅ NDK: $(NDK_PATH)"

$(OUTPUT_DIR):
	@mkdir -p $(OUTPUT_DIR)

webui:
	@echo "🎨 Building WebUI..."
	@cd $(WEBUI_DIR) && npm install && npm run build
	@echo "✅ WebUI built -> $(MODULE_DIR)/webroot/"

arm64: $(OUTPUT_DIR)
	@echo "🔨 Compiling arm64-v8a..."
	@$(NDK_LLVM)/aarch64-linux-android$(ANDROID_API)-clang++ $(CXXFLAGS) -o $(OUTPUT_DIR)/hymod-arm64-v8a $(SRC_FILES)
	@$(NDK_LLVM)/llvm-strip $(OUTPUT_DIR)/hymod-arm64-v8a
	@echo "✅ arm64: $$(du -h $(OUTPUT_DIR)/hymod-arm64-v8a | cut -f1)"

armv7: $(OUTPUT_DIR)
	@echo "🔨 Compiling armeabi-v7a..."
	@$(NDK_LLVM)/armv7a-linux-androideabi$(ANDROID_API)-clang++ $(CXXFLAGS) -o $(OUTPUT_DIR)/hymod-armeabi-v7a $(SRC_FILES)
	@$(NDK_LLVM)/llvm-strip $(OUTPUT_DIR)/hymod-armeabi-v7a
	@echo "✅ armv7: $$(du -h $(OUTPUT_DIR)/hymod-armeabi-v7a | cut -f1)"

x86_64: $(OUTPUT_DIR)
	@echo "🔨 Compiling x86_64..."
	@$(NDK_LLVM)/x86_64-linux-android$(ANDROID_API)-clang++ $(CXXFLAGS) -o $(OUTPUT_DIR)/hymod-x86_64 $(SRC_FILES)
	@$(NDK_LLVM)/llvm-strip $(OUTPUT_DIR)/hymod-x86_64
	@echo "✅ x86_64: $$(du -h $(OUTPUT_DIR)/hymod-x86_64 | cut -f1)"

x86: $(OUTPUT_DIR)
	@echo "🔨 Compiling x86..."
	@$(NDK_LLVM)/i686-linux-android$(ANDROID_API)-clang++ $(CXXFLAGS) -o $(OUTPUT_DIR)/hymod-x86 $(SRC_FILES)
	@$(NDK_LLVM)/llvm-strip $(OUTPUT_DIR)/hymod-x86
	@echo "✅ x86: $$(du -h $(OUTPUT_DIR)/hymod-x86 | cut -f1)"

clean:
	@echo "🧹 Cleaning..."
	@rm -rf $(OUTPUT_DIR) $(BUILD_DIR)
	@rm -rf $(MODULE_DIR)/webroot/*
	@echo "✅ Clean complete"

distclean: clean
	@rm -f *.zip
	@echo "✅ Distclean complete"

zip: all
	@echo ""
	@echo "📦 Creating module package..."
	@rm -rf $(BUILD_DIR)
	@mkdir -p $(BUILD_DIR)
	@cp -r $(MODULE_DIR)/* $(BUILD_DIR)/
	@cp $(OUTPUT_DIR)/hymod-* $(BUILD_DIR)/
	@chmod 755 $(BUILD_DIR)/hymod-*
	@cd $(BUILD_DIR) && zip -r ../$(OUTPUT_DIR)/$(MODULE_ID)-$(VERSION).zip * >/dev/null
	@echo "✅ Package: $(OUTPUT_DIR)/$(MODULE_ID)-$(VERSION).zip"
	@ls -lh $(OUTPUT_DIR)/$(MODULE_ID)-$(VERSION).zip
	@echo ""
	@unzip -l $(OUTPUT_DIR)/$(MODULE_ID)-$(VERSION).zip | head -30

install: zip
	@if command -v adb >/dev/null 2>&1; then adb push $(OUTPUT_DIR)/$(MODULE_ID)-$(VERSION).zip /sdcard/; echo "✅ Uploaded"; else echo "⚠️  adb not found"; fi

help:
	@echo "Hymo Build System - C++ Multi-Architecture"
	@echo ""
	@echo "Targets:"
	@echo "  all       - Build WebUI and all architectures"
	@echo "  testbuild - Build WebUI and arm64 only (快速测试)"
	@echo "  testzip   - Create test package (arm64 only)"
	@echo "  webui     - Build WebUI only"
	@echo "  arm64     - Build ARM 64-bit only"
	@echo "  armv7     - Build ARM 32-bit only"
	@echo "  x86_64    - Build Intel 64-bit only"
	@echo "  x86       - Build Intel 32-bit only"
	@echo "  zip       - Create module package"
	@echo "  install   - Push to device via adb"
	@echo "  clean     - Clean build files"
	@echo "  distclean - Clean everything"
	@echo "  help      - Show this help"
