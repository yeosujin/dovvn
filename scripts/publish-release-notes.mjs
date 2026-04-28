// electron-builder가 publish한 GitHub Release의 본문을 build/release-notes.md 내용으로 덮어쓴다.
// electron-builder의 releaseInfo.releaseNotesFile이 안정적으로 동작하지 않는 케이스를 보완.
import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
const version = pkg.version
const tag = `v${version}`

const notesPath = path.join(root, 'build', 'release-notes.md')
if (!existsSync(notesPath)) {
  console.error(`build/release-notes.md가 없어요. release-notes 스크립트를 먼저 실행해주세요.`)
  process.exit(1)
}

// electron-builder.yml에서 publish.owner/repo를 읽어둔다 (간단 파싱).
const builderYml = readFileSync(path.join(root, 'electron-builder.yml'), 'utf8')
const owner = builderYml.match(/owner:\s*(\S+)/)?.[1]
const repo = builderYml.match(/repo:\s*(\S+)/)?.[1]
if (!owner || !repo) {
  console.error('electron-builder.yml에서 publish.owner/repo를 찾지 못했어요.')
  process.exit(1)
}

const result = spawnSync(
  'gh',
  ['release', 'edit', tag, '--repo', `${owner}/${repo}`, '--notes-file', notesPath],
  { stdio: 'inherit' }
)

if (result.status !== 0) {
  console.error(`gh release edit 실패. ${tag} 릴리즈가 publish되었는지 확인해주세요.`)
  process.exit(result.status ?? 1)
}

console.log(`release notes 본문 갱신: ${owner}/${repo}@${tag}`)
