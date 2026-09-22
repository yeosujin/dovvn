import { BrowserWindow, ipcMain } from 'electron'
import { isRestartPending, onRestartPendingChange } from '../restart'

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload)
  }
}

export function registerRestartIpc(): void {
  onRestartPendingChange((pending) => broadcast('restart:pending-changed', pending))

  ipcMain.handle('restart:is-pending', () => isRestartPending())
}
