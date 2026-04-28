// CHANGELOG.md에서 현재 package.json 버전의 섹션을 뽑아 build/release-notes.md로 저장한다.
// electron-builder가 publish 시 이 파일을 GitHub Release 본문으로 사용한다.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
const version = pkg.version

const changelogPath = path.join(root, 'CHANGELOG.md')
if (!existsSync(changelogPath)) {
  console.error('CHANGELOG.md not found')
  process.exit(1)
}
const changelog = readFileSync(changelogPath, 'utf8')

// "## <version>" 섹션의 본문(다음 "## "까지)을 추출
const re = new RegExp(`(?:^|\\n)##\\s+${version.replace(/\./g, '\\.')}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`)
const m = changelog.match(re)

if (!m) {
  console.error(`CHANGELOG.md에 ## ${version} 섹션이 없어요. 추가한 뒤 다시 빌드해주세요.`)
  process.exit(1)
}

const body = m[1].trim()
if (!body) {
  console.error(`## ${version} 섹션이 비어 있어요.`)
  process.exit(1)
}

const outDir = path.join(root, 'build')
mkdirSync(outDir, { recursive: true })
const outPath = path.join(outDir, 'release-notes.md')
writeFileSync(outPath, body + '\n', 'utf8')

console.log(`release notes written: ${outPath}`)
console.log('---')
console.log(body)
