import { app } from 'electron'
import fs from 'fs'
import path from 'path'

function filePath(name: string): string {
  return path.join(app.getPath('userData'), name)
}

export function loadJson<T>(name: string, fallback: T): T {
  try {
    const raw = fs.readFileSync(filePath(name), 'utf-8')
    return { ...fallback, ...JSON.parse(raw) } as T
  } catch {
    return fallback
  }
}

export function loadJsonArray<T>(name: string): T[] {
  try {
    const raw = fs.readFileSync(filePath(name), 'utf-8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

export function saveJson(name: string, data: unknown): void {
  const p = filePath(name)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8')
}
