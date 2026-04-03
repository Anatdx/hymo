let callbackCounter = 0;

function uniqueName(prefix) {
  callbackCounter += 1;
  return `${prefix}_callback_${Date.now()}_${callbackCounter}`;
}

export function hasKernelSU() {
  return typeof globalThis.ksu !== "undefined";
}

export function exec(command, options = {}) {
  return new Promise((resolve, reject) => {
    if (!hasKernelSU()) {
      resolve({ errno: 1, stdout: "", stderr: "ksu is not defined" });
      return;
    }

    const callbackName = uniqueName("exec");
    globalThis[callbackName] = (errno, stdout, stderr) => {
      delete globalThis[callbackName];
      resolve({ errno, stdout, stderr });
    };

    try {
      globalThis.ksu.exec(command, JSON.stringify(options), callbackName);
    } catch (error) {
      delete globalThis[callbackName];
      reject(error);
    }
  });
}

export async function enableEdgeToEdge(enabled = true) {
  if (!hasKernelSU()) {
    return false;
  }

  if (typeof globalThis.ksu.enableEdgeToEdge === "function") {
    globalThis.ksu.enableEdgeToEdge(enabled);
    return true;
  }

  if (typeof globalThis.ksu.enableInsets === "function") {
    globalThis.ksu.enableInsets(enabled);
    return true;
  }

  return false;
}

export function toast(message) {
  if (hasKernelSU() && typeof globalThis.ksu.toast === "function") {
    globalThis.ksu.toast(String(message));
    return;
  }

  console.log(`[toast] ${message}`);
}
