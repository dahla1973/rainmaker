const koffi = require('koffi');

const user32 = koffi.load('user32.dll');

// Type aliases
const HWND = 'void *';
const LPARAM = 'intptr';
const WPARAM = 'uintptr';
const LRESULT = 'intptr';

// Function declarations
const FindWindowA = user32.func('FindWindowA', HWND, ['str', 'str']);
const FindWindowExA = user32.func('FindWindowExA', HWND, [HWND, HWND, 'str', 'str']);
const SendMessageTimeoutW = user32.func('SendMessageTimeoutW', LRESULT, [HWND, 'uint32', WPARAM, LPARAM, 'uint32', 'uint32', 'void *']);
const SetParent = user32.func('SetParent', HWND, [HWND, HWND]);
const GetWindowLongPtrA = user32.func('GetWindowLongPtrA', 'long', [HWND, 'int']);
const SetWindowLongPtrA = user32.func('SetWindowLongPtrA', 'long', [HWND, 'int', 'long']);
const ShowWindow = user32.func('ShowWindow', 'bool', [HWND, 'int']);

// EnumWindows callback prototype
const WNDENUMPROC = koffi.proto('bool __stdcall WNDENUMPROC(void *hwnd, intptr lParam)');
const EnumWindows = user32.func('EnumWindows', 'bool', [koffi.pointer(WNDENUMPROC), LPARAM]);

const SMTO_NORMAL = 0x0000;
const GWL_EXSTYLE = -20;
const WS_EX_TOOLWINDOW = 0x00000080;
const WS_EX_NOACTIVATE = 0x08000000;
const SW_SHOWNOACTIVATE = 8;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function enumDesktopTarget() {
  let workerW = null;
  let shellParent = null;

  const enumCallback = koffi.register((hwnd, _lParam) => {
    const shellView = FindWindowExA(hwnd, null, 'SHELLDLL_DefView', null);
    if (shellView) {
      shellParent = hwnd;
      // Look for a sibling WorkerW (the classic technique)
      const nextWorkerW = FindWindowExA(null, hwnd, 'WorkerW', null);
      if (nextWorkerW) {
        workerW = nextWorkerW;
      }
    }
    return true;
  }, koffi.pointer(WNDENUMPROC));

  EnumWindows(enumCallback, 0);
  koffi.unregister(enumCallback);

  return { workerW, shellParent };
}

async function findDesktopParent() {
  const progman = FindWindowA('Progman', null);
  if (!progman) {
    throw new Error('Could not find Progman window');
  }
  console.log('Found Progman');

  // Send 0x052C to spawn WorkerW (send twice for reliability)
  const resultBuf = Buffer.alloc(8);
  SendMessageTimeoutW(progman, 0x052C, 0, 0, SMTO_NORMAL, 1000, resultBuf);
  await sleep(100);
  SendMessageTimeoutW(progman, 0x052C, 0, 0, SMTO_NORMAL, 1000, resultBuf);

  // Try to find WorkerW with retries
  for (let attempt = 0; attempt < 5; attempt++) {
    await sleep(300);
    const { workerW, shellParent } = enumDesktopTarget();

    if (workerW) {
      console.log(`Found WorkerW on attempt ${attempt + 1}`);
      return workerW;
    }

    if (shellParent && attempt === 4) {
      // Windows 11: SHELLDLL_DefView is inside Progman, no sibling WorkerW.
      // Use Progman itself as the parent.
      console.log('No sibling WorkerW found; using Progman as parent (Windows 11 mode)');
      return progman;
    }
  }

  // Last resort: just use Progman
  console.log('Fallback: using Progman as parent');
  return progman;
}

async function embedWindow(electronHwndBuffer) {
  const desktopParent = await findDesktopParent();

  // Read the HWND pointer from the native window handle buffer
  const electronHwnd = koffi.decode(electronHwndBuffer, HWND);

  // Remove from taskbar and prevent activation stealing
  const exStyle = GetWindowLongPtrA(electronHwnd, GWL_EXSTYLE);
  SetWindowLongPtrA(electronHwnd, GWL_EXSTYLE, exStyle | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE);

  // Set the Electron window as a child of the desktop parent
  SetParent(electronHwnd, desktopParent);

  // Ensure it's visible
  ShowWindow(electronHwnd, SW_SHOWNOACTIVATE);

  console.log('Window embedded into desktop successfully');
}

module.exports = { embedWindow };
