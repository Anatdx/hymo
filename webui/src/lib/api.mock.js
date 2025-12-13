import { DEFAULT_CONFIG } from './constants';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const MOCK_STATE = {
    modules: [
        { id: "magisk_module_test", name: "Magisk Module", version: "1.0", author: "User", description: "A test module", mode: "auto", enabled: true },
        { id: "youtube_revanced", name: "YouTube ReVanced", version: "18.0.0", author: "ReVanced", description: "Extended YouTube", mode: "magic", enabled: true },
        { id: "my_custom_mod", name: "Custom Tweak", version: "v2", author: "Me", description: "System tweaks", mode: "auto", enabled: true }
    ],
    config: { ...DEFAULT_CONFIG, partitions: ["product", "system_ext"] },
    logs: [
        "[INFO] Hymo Daemon v0.1.0 started",
        "[INFO] Storage backend: tmpfs (XATTR supported)",
        "[INFO] Mounting overlay for /system...",
        "[WARN] /vendor overlay skipped: target busy",
        "[INFO] Magic mount active: youtube_revanced",
        "[INFO] System operational."
    ]
};

export const MockAPI = {
    loadConfig: async () => {
        await delay(500);
        return MOCK_STATE.config;
    },

    saveConfig: async (config) => {
        await delay(800);
        MOCK_STATE.config = config;
        console.log("[Mock] Config Saved:", config);
    },

    scanModules: async () => {
        await delay(1000);
        return MOCK_STATE.modules;
    },

    saveModules: async (modules) => {
        await delay(600);
        MOCK_STATE.modules = modules;
        console.log("[Mock] Module Modes Saved:", modules.map(m => `${m.id}=${m.mode}`));
    },

    readLogs: async () => {
        await delay(400);
        return MOCK_STATE.logs.join('\n');
    },

    getStorageUsage: async () => {
        await delay(600);
        return {
            size: '3.8G',
            used: '1.2G',
            percent: '31%',
            type: 'tmpfs' 
        };
    },

    getSystemInfo: async () => {
        await delay(600);
        return {
            kernel: '5.10.177-android12-9-00001-g5d3f2a (Mock)',
            selinux: 'Enforcing',
            mountBase: '/data/adb/hymo/mnt',
            activeMounts: ['system', 'product', 'system_ext']
        };
    },

    getActiveMounts: async () => {
        return ['system', 'product'];
    },

    openLink: async (url) => {
        console.log("[Mock] Opening URL:", url);
        window.open(url, '_blank');
    },

    fetchSystemColor: async () => {
        await delay(200);
        return '#8FBC8F'; 
    },

    listFiles: async (path) => {
        await delay(300);
        if (path === '/sdcard') {
            return [
                { name: 'Download', isDir: true, path: '/sdcard/Download' },
                { name: 'DCIM', isDir: true, path: '/sdcard/DCIM' },
                { name: 'test.png', isDir: false, path: '/sdcard/test.png' }
            ];
        }
        if (path === '/sdcard/Download') {
             return [
                { name: 'wallpaper.jpg', isDir: false, path: '/sdcard/Download/wallpaper.jpg' }
            ];
        }
        return [];
    },

    readFileBase64: async (path) => {
        await delay(500);
        // Return a 1x1 transparent pixel base64
        return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    }
};