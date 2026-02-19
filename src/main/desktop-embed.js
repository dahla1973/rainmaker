const koffi = require('koffi');

const user32 = koffi.load('user32.dll');

const HWND = 'void *';

// Use intptr for hWndInsertAfter since HWND_BOTTOM is the integer 1
const SetWindowPos = user32.func('SetWindowPos', 'bool', [HWND, 'intptr', 'int', 'int', 'int', 'int', 'uint32']);
const GetWindowLongPtrA = user32.func('GetWindowLongPtrA', 'long', [HWND, 'int']);
const SetWindowLongPtrA = user32.func('SetWindowLongPtrA', 'long', [HWND, 'int', 'long']);

const GWL_EXSTYLE = -20;
const WS_EX_TOOLWINDOW = 0x00000080;
const WS_EX_NOACTIVATE = 0x08000000;
const WS_EX_APPWINDOW = 0x00040000;
const SWP_NOSIZE = 0x0001;
const SWP_NOMOVE = 0x0002;
const SWP_NOACTIVATE = 0x0010;
const SWP_SHOWWINDOW = 0x0040;
const HWND_BOTTOM = 1;

function embedWindow(electronHwndBuffer) {
  const electronHwnd = koffi.decode(electronHwndBuffer, HWND);

  // Remove from taskbar, prevent activation
  const exStyle = GetWindowLongPtrA(electronHwnd, GWL_EXSTYLE);
  SetWindowLongPtrA(
    electronHwnd,
    GWL_EXSTYLE,
    (exStyle | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE) & ~WS_EX_APPWINDOW
  );

  // Place at bottom of z-order
  SetWindowPos(electronHwnd, HWND_BOTTOM, 0, 0, 0, 0,
    SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW);

  console.log('Window set to always-on-bottom');
}

function keepAtBottom(electronHwndBuffer) {
  const electronHwnd = koffi.decode(electronHwndBuffer, HWND);
  SetWindowPos(electronHwnd, HWND_BOTTOM, 0, 0, 0, 0,
    SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
}

module.exports = { embedWindow, keepAtBottom };
