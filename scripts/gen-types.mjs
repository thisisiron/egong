#!/usr/bin/env node
// scripts/gen-types.mjs
//
// Supabase CLI로 DB 스키마 → frontend/lib/supabase/database.types.ts 를 생성한다.
//
// 왜 스크립트인가: 예전 package.json은 이렇게 돼 있었다.
//
//   supabase gen types typescript --project-id "$SUPABASE_PROJECT_REF" > ...
//
// `$VAR` 확장과 `>` 리다이렉션은 둘 다 셸 문법이라, npm이 스크립트를 cmd.exe로 돌리는
// Windows에서는 `$SUPABASE_PROJECT_REF`가 문자 그대로 CLI에 넘어갔다. 게다가 ref를
// 루트 .env가 아니라 셸 환경에 따로 export해 두라고 요구해서, "유일한 소스" 원칙
// (scripts/env-sync.mjs)도 깨져 있었다.
//
// 이 스크립트는 셸에 의존하지 않는다:
//   - ref를 process.env → 루트 .env 순으로 찾는다
//   - 자식 프로세스를 shell 없이 spawn하고, stdout을 Node가 파일로 쓴다
//
// Node.js 내장 모듈만 사용한다.
//
// 사용법:
//   node scripts/gen-types.mjs
//   SUPABASE_PROJECT_REF=<ref> node scripts/gen-types.mjs   # 환경변수가 .env보다 우선

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(SCRIPT_DIR, '..')
const OUT_FILE = path.join(ROOT, 'frontend', 'lib', 'supabase', 'database.types.ts')

// env-sync.mjs와 같은 최소 파서. 값이 아니라 ref 하나만 꺼내 쓴다.
function readEnvKey(file, key) {
  if (!fs.existsSync(file)) return undefined
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    if (line.slice(0, eq).trim().replace(/^export\s+/, '') !== key) continue
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1)
    }
    return value === '' ? undefined : value
  }
  return undefined
}

// ref는 SUPABASE_URL(https://<ref>.supabase.co)에서도 뽑을 수 있다. 그러면 루트 .env에
// 이미 있는 값만으로 충분해서, 별도 키를 또 관리할 필요가 없다.
function refFromUrl(url) {
  if (!url) return undefined
  const m = /^https:\/\/([a-z0-9-]+)\.supabase\.(co|in)/i.exec(url.trim())
  return m ? m[1] : undefined
}

// Windows에서는 아래에서 shell을 거쳐 실행하므로(EINVAL 회피), ref는 셸 메타문자가
// 절대 통과할 수 없는 화이트리스트로 검증한다. 플레이스홀더(`<your-ref>`)도 여기서 걸린다.
const REF_PATTERN = /^[a-z0-9]{16,40}$/i

function resolveRef() {
  const rootEnv = path.join(ROOT, '.env')
  const candidates = [
    ['SUPABASE_PROJECT_REF 환경변수', process.env.SUPABASE_PROJECT_REF],
    ['루트 .env의 SUPABASE_PROJECT_REF', readEnvKey(rootEnv, 'SUPABASE_PROJECT_REF')],
    ['SUPABASE_URL 환경변수', refFromUrl(process.env.SUPABASE_URL)],
    ['루트 .env의 SUPABASE_URL', refFromUrl(readEnvKey(rootEnv, 'SUPABASE_URL'))],
  ]
  for (const [source, value] of candidates) {
    if (value && REF_PATTERN.test(value.trim())) return { ref: value.trim(), source }
  }
  return null
}

const resolved = resolveRef()
if (!resolved) {
  console.error(
    [
      'Supabase 프로젝트 ref를 찾을 수 없습니다.',
      '다음 중 하나를 설정하세요 (위쪽이 우선):',
      '  1. SUPABASE_PROJECT_REF 환경변수',
      '  2. 루트 .env의 SUPABASE_PROJECT_REF',
      '  3. 루트 .env의 SUPABASE_URL (https://<ref>.supabase.co 에서 자동 추출)',
      '루트 .env가 아직 없다면: cp .env.example .env',
    ].join('\n')
  )
  process.exit(1)
}

console.log(`project ref 출처: ${resolved.source}`)

// Windows에서 npx는 npx.cmd(배치 파일)이고, Node는 CVE-2024-27980 이후 shell 없이
// .cmd/.bat 실행을 EINVAL로 거부한다. 그래서 Windows에서만 shell을 거친다.
// 셸을 쓰더라도 `>` 리다이렉션이나 `$VAR` 확장은 여전히 쓰지 않는다 — stdout은 Node가
// 받아 파일로 쓰고, 유일한 가변 인자인 ref는 위 REF_PATTERN으로 이미 검증됐다.
// shell:true + args 배열 조합은 Node가 DEP0190으로 경고한다(인자가 이스케이프되지 않고
// 이어붙여지기 때문). 경고를 끄려고 무시하는 대신, Windows에서는 처음부터 명령 문자열
// 하나로 넘긴다 — "이스케이프 없이 이어붙는다"는 사실을 코드에 드러내는 형태다.
const isWindows = process.platform === 'win32'
const ARGS = ['-y', 'supabase', 'gen', 'types', 'typescript', '--project-id', resolved.ref]
const result = isWindows
  ? spawnSync(`npx ${ARGS.join(' ')}`, {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'inherit'],
      shell: true,
    })
  : spawnSync('npx', ARGS, {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'inherit'],
    })

if (result.error) {
  console.error(`supabase CLI 실행 실패: ${result.error.message}`)
  process.exit(1)
}
if (result.status !== 0) {
  console.error(`supabase gen types 실패 (exit ${result.status}). 위 stderr를 확인하세요.`)
  process.exit(result.status ?? 1)
}

// 생성물이 비어 있으면 쓰지 않는다. 예전 `> file` 방식은 CLI가 실패해도 셸이 파일을
// 먼저 비워버려서, 실패할 때마다 database.types.ts가 0바이트로 날아갔다.
const output = result.stdout
if (!output || !output.includes('export type Database')) {
  console.error(
    [
      'supabase CLI가 예상한 형태의 타입을 출력하지 않았습니다 (기존 파일은 그대로 둡니다).',
      `받은 길이: ${output ? output.length : 0} bytes`,
    ].join('\n')
  )
  process.exit(1)
}

fs.writeFileSync(OUT_FILE, output, 'utf8')
console.log(`생성됨: ${path.relative(ROOT, OUT_FILE).replace(/\\/g, '/')} (${output.length} bytes)`)
