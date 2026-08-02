#!/usr/bin/env node
// scripts/env-sync.mjs
//
// 루트 `.env`를 유일한 소스(source of truth)로 삼아 backend/.env, frontend/.env.local을
// 생성한다. 세 파일에 같은 값을 손으로 복사해 넣다 보면 키를 회전할 때 한 곳을 놓치기
// 쉽고, 그러면 "프론트만 401" 같은 디버깅이 시작된다. — 그걸 막는 스크립트다.
//
// Node.js 내장 모듈만 사용한다 (node_modules 없이도 동작해야 함).
//
// 사용법:
//   node scripts/env-sync.mjs              # 루트 .env를 읽어 backend/.env, frontend/.env.local 생성
//   node scripts/env-sync.mjs --force       # 사람이 만든 기존 파일도 덮어씀
//   node scripts/env-sync.mjs --root <dir>  # 테스트용 — 다른 디렉터리를 "루트"로 취급
//
// 절대 하지 않는 것: 값을 stdout에 찍는 것. 키 이름과 파일 경로만 출력한다.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))

// 생성된 파일의 첫 줄에 반드시 들어가는, grep 가능한 마커.
// 이 마커가 있으면 "우리가 만든 파일"로 간주해 재실행 시 조용히 덮어쓴다.
// 이 마커가 없으면 "사람이 손으로 만든 파일"로 간주해 --force 없이는 멈춘다.
const GENERATED_MARKER = '# env-sync:generated — 이 파일은 pnpm env:sync 가 생성합니다'

// secret 계열로 간주하는 키 이름 패턴. 프론트로 나가는 매핑 테이블에는
// 이 패턴에 걸리는 키가 절대 등장하면 안 된다 (from/to 이름 둘 다 검사).
const SECRET_PATTERN = /SECRET|SERVICE_ROLE|PRIVATE_KEY|PASSWORD|DATABASE_URL|_TOKEN\b/i

// 이 목록에 있는 target 파일만 SECRET_PATTERN에 걸리는 키를 가질 수 있다.
// (지금은 backend/.env 뿐이다.) 여기 없는 target에서 매치가 하나라도 나오면
// 스크립트는 파일을 하나도 쓰지 않고 즉시 에러로 멈춘다.
const GUARD_EXEMPT_FILES = new Set(['backend/.env'])

// ---------------------------------------------------------------------------
// 명시적 매핑 테이블 — 어떤 키가 어느 파일로, 어떤 이름으로 가는지 여기 전부 적는다.
// "NEXT_PUBLIC_이 붙으면 프론트로" 같은 암묵적 규칙은 쓰지 않는다.
//
//   required            — 루트 .env에 없으면 스크립트가 실패한다 (이름을 대며).
//   optionalWithDefault — 루트 .env에 없으면 default 값으로 채운다.
//   optionalNoDefault   — 루트 .env에 없으면 생성 파일에서 그냥 빠진다 (실패하지 않음).
// ---------------------------------------------------------------------------
const TARGETS = [
  {
    file: 'backend/.env',
    required: [
      { from: 'SUPABASE_URL', to: 'SUPABASE_URL' },
      { from: 'SUPABASE_SECRET_KEY', to: 'SUPABASE_SECRET_KEY' },
      { from: 'SUPABASE_PUBLISHABLE_KEY', to: 'SUPABASE_PUBLISHABLE_KEY' },
      // backend/src/core/config.py의 Settings에 기본값 없이 선언돼 있어 없으면 앱이 기동조차 안 됨
      { from: 'NTS_API_KEY', to: 'NTS_API_KEY' },
    ],
    optionalWithDefault: [
      { from: 'ALLOWED_ORIGINS', to: 'ALLOWED_ORIGINS', default: 'http://localhost:3000' },
      { from: 'ENVIRONMENT', to: 'ENVIRONMENT', default: 'development' },
      // backend/scripts/seed/world.py 가 이미 동일 기본값으로 os.environ.get() 하지만,
      // 여기서도 명시해 backend/.env만 보고도 실제 시드 비밀번호를 알 수 있게 한다.
      { from: 'SEED_PASSWORD', to: 'SEED_PASSWORD', default: '***REMOVED***' },
    ],
    optionalNoDefault: [
      // RLS 테스트(-m rls)에서만 필요한 Postgres 직결 DSN. 프로젝트마다 달라 기본값을 줄 수 없다.
      { from: 'DATABASE_URL', to: 'DATABASE_URL' },
    ],
  },
  {
    file: 'frontend/.env.local',
    required: [
      { from: 'SUPABASE_URL', to: 'NEXT_PUBLIC_SUPABASE_URL' },
      { from: 'SUPABASE_PUBLISHABLE_KEY', to: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY' },
      // SUPABASE_SECRET_KEY는 의도적으로 여기 없다. 있으면 안 된다.
    ],
    optionalWithDefault: [
      { from: 'NEXT_PUBLIC_API_BASE_URL', to: 'NEXT_PUBLIC_API_BASE_URL', default: 'http://localhost:8000' },
    ],
    optionalNoDefault: [],
    // DEV_LOGIN_ENABLED / DEV_LOGIN_PASSWORD 는 여기 목록에 없다 — 의도적.
    // DEV_LOGIN_PASSWORD라는 이름은 SECRET_PATTERN(PASSWORD)에 걸리므로, 이 배열에 넣으면
    // 가드가 즉시 막는다. 이 값은 실제로는 로컬 전용 dev 퀵 로그인 토글(기본값
    // '***REMOVED***', ENVIRONMENT=production에서는 seed 스크립트 자체가 거부)이라 낮은 위험도의
    // 예외지만, 그 판단을 이 표 안에서 조용히 허용목록으로 처리하지 않고
    // buildDevLoginLines()라는 별도의, 코드리뷰에서 눈에 띄는 경로로 뺐다.
    // → 가드는 "이 배열 안에서는 예외 없음"이라는 불변식을 유지한다.
  },
]

// ---------------------------------------------------------------------------
// CLI 인자
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const args = { root: null, force: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--force') args.force = true
    else if (a === '--root') args.root = argv[++i]
    else if (a.startsWith('--root=')) args.root = a.slice('--root='.length)
  }
  return args
}

// ---------------------------------------------------------------------------
// 아주 단순한 .env 파서 — KEY=VALUE, '#' 주석, 앞뒤 공백 제거, 단순 따옴표 벗기기만 지원.
// ---------------------------------------------------------------------------
function parseEnvFile(content) {
  const result = {}
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1)
    }
    result[key] = value
  }
  return result
}

// ---------------------------------------------------------------------------
// secret 가드 — 파일을 하나도 건드리기 전에, 매핑 테이블 자체를 검사한다.
// ---------------------------------------------------------------------------
function assertNoSecretLeak(targets) {
  const problems = []
  for (const target of targets) {
    if (GUARD_EXEMPT_FILES.has(target.file)) continue
    const allEntries = [
      ...target.required,
      ...target.optionalWithDefault,
      ...target.optionalNoDefault,
    ]
    for (const entry of allEntries) {
      if (SECRET_PATTERN.test(entry.from) || SECRET_PATTERN.test(entry.to)) {
        problems.push(`${target.file}: ${entry.from} -> ${entry.to}`)
      }
    }
  }
  if (problems.length > 0) {
    throw new EnvSyncError(
      [
        'secret 가드 위반 — 매핑 테이블에 secret로 보이는 키가 프론트(또는 비허용) 대상에 있습니다.',
        '다음 항목을 TARGETS에서 제거하거나, 정말 의도한 것이면 GUARD_EXEMPT_FILES를 검토하세요:',
        ...problems.map((p) => `  - ${p}`),
        '(파일은 하나도 쓰지 않았습니다.)',
      ].join('\n')
    )
  }
}

class EnvSyncError extends Error {}

// ---------------------------------------------------------------------------
// dev 퀵 로그인 전용 라인 빌더 — 의도적으로 TARGETS/가드 경로 밖에 있다 (위 주석 참고).
// ---------------------------------------------------------------------------
function buildDevLoginLines(rootEnv) {
  const lines = []
  lines.push('')
  lines.push('# ---- dev 퀵 로그인 (선택, 로컬 전용) ----')
  lines.push('# 켜려면 루트 .env에 DEV_LOGIN_ENABLED=1 을 설정하고 pnpm env:sync를 다시 실행하세요.')
  lines.push('# 프로덕션에는 절대 설정하지 마세요.')
  if (rootEnv.DEV_LOGIN_ENABLED) {
    lines.push(`DEV_LOGIN_ENABLED=${rootEnv.DEV_LOGIN_ENABLED}`)
  } else {
    lines.push('# DEV_LOGIN_ENABLED=1')
  }
  if (rootEnv.DEV_LOGIN_PASSWORD) {
    lines.push(`DEV_LOGIN_PASSWORD=${rootEnv.DEV_LOGIN_PASSWORD}`)
  } else {
    lines.push("# DEV_LOGIN_PASSWORD=***REMOVED***  # 시드 비밀번호(SEED_PASSWORD)를 바꾼 경우에만 설정")
  }
  return lines
}

// ---------------------------------------------------------------------------
// 루트 .env에서 필요한 키가 다 있는지 검증. 모자라면 이름을 대며 에러를 던진다.
// (한 파일이라도 실패하면 아무 파일도 쓰지 않는다 — 부분 생성 방지.)
// ---------------------------------------------------------------------------
function collectMissingRequired(targets, rootEnv) {
  const missing = [] // { key, files: [file, ...] }
  const byKey = new Map()
  for (const target of targets) {
    for (const entry of target.required) {
      const value = rootEnv[entry.from]
      if (value === undefined || value === '') {
        if (!byKey.has(entry.from)) {
          byKey.set(entry.from, [])
          missing.push(entry.from)
        }
        byKey.get(entry.from).push(target.file)
      }
    }
  }
  return missing.map((key) => ({ key, files: byKey.get(key) }))
}

// ---------------------------------------------------------------------------
// 파일 하나의 내용을 만든다.
// ---------------------------------------------------------------------------
function buildFileContent(target, rootEnv) {
  const lines = []
  lines.push(GENERATED_MARKER)
  lines.push('# 직접 고치지 마세요 — 대신 루트 .env를 고치고 `pnpm env:sync`를 다시 실행하세요.')
  lines.push(`# 소스: 루트 .env  →  ${target.file}`)
  lines.push('')

  lines.push('# ---- 필수 (공유 값, 루트 .env에서 복사) ----')
  for (const entry of target.required) {
    lines.push(`${entry.to}=${rootEnv[entry.from]}`)
  }

  if (target.optionalWithDefault.length > 0) {
    lines.push('')
    lines.push('# ---- 앱 고유 값 (루트 .env에 없으면 기본값 사용) ----')
    for (const entry of target.optionalWithDefault) {
      const value = rootEnv[entry.from] !== undefined && rootEnv[entry.from] !== ''
        ? rootEnv[entry.from]
        : entry.default
      lines.push(`${entry.to}=${value}`)
    }
  }

  if (target.optionalNoDefault.length > 0) {
    lines.push('')
    lines.push('# ---- 선택 (기본값 없음, 루트 .env에 있을 때만 포함) ----')
    for (const entry of target.optionalNoDefault) {
      const value = rootEnv[entry.from]
      if (value !== undefined && value !== '') {
        lines.push(`${entry.to}=${value}`)
      } else {
        lines.push(`# ${entry.to}=  (루트 .env에 없음)`)
      }
    }
  }

  if (target.file === 'frontend/.env.local') {
    lines.push(...buildDevLoginLines(rootEnv))
  }

  lines.push('')
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// 기존 파일과 새 내용을 "키 이름만" 비교해 요약을 만든다. 값은 절대 포함하지 않는다.
// ---------------------------------------------------------------------------
function summarizeKeyDiff(existingContent, newContent) {
  const existingKeys = new Set(Object.keys(parseEnvFile(existingContent)))
  const newKeys = new Set(Object.keys(parseEnvFile(newContent)))
  const onlyInExisting = [...existingKeys].filter((k) => !newKeys.has(k)).sort()
  const onlyInNew = [...newKeys].filter((k) => !existingKeys.has(k)).sort()
  const inBoth = [...existingKeys].filter((k) => newKeys.has(k)).sort()
  return { onlyInExisting, onlyInNew, inBoth }
}

function isGeneratedByUs(content) {
  return content.split(/\r?\n/, 5).some((line) => line.trim() === GENERATED_MARKER)
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
function main() {
  const cli = parseArgs(process.argv.slice(2))
  const root = path.resolve(cli.root ?? path.join(SCRIPT_DIR, '..'))
  const rootEnvPath = path.join(root, '.env')

  assertNoSecretLeak(TARGETS)

  if (!fs.existsSync(rootEnvPath)) {
    throw new EnvSyncError(
      [
        `루트 .env 파일을 찾을 수 없습니다: ${rootEnvPath}`,
        '먼저 다음을 실행하세요:',
        '  cp .env.example .env',
        '그런 다음 Supabase 대시보드 등에서 실제 값을 채우고 다시 `pnpm env:sync`를 실행하세요.',
      ].join('\n')
    )
  }

  const rootEnv = parseEnvFile(fs.readFileSync(rootEnvPath, 'utf8'))

  const missing = collectMissingRequired(TARGETS, rootEnv)
  if (missing.length > 0) {
    throw new EnvSyncError(
      [
        '루트 .env에 다음 필수 키가 없습니다 (값은 표시하지 않습니다):',
        ...missing.map((m) => `  - ${m.key}  (필요: ${m.files.join(', ')})`),
        '.env.example을 참고해 루트 .env에 값을 채운 뒤 다시 실행하세요.',
      ].join('\n')
    )
  }

  const plans = TARGETS.map((target) => {
    const targetPath = path.join(root, ...target.file.split('/'))
    const content = buildFileContent(target, rootEnv)
    return { target, targetPath, content }
  })

  // 쓰기 전에 전부 검사 — 하나라도 막히면 아무 파일도 쓰지 않는다 (부분 생성 방지).
  for (const plan of plans) {
    if (!fs.existsSync(plan.targetPath)) continue
    const existingContent = fs.readFileSync(plan.targetPath, 'utf8')
    const generated = isGeneratedByUs(existingContent)
    if (generated || cli.force) continue

    const diff = summarizeKeyDiff(existingContent, plan.content)
    const msg = [
      `${plan.target.file} 파일이 이미 있고, env:sync가 만든 파일처럼 보이지 않습니다 (사람이 만든 파일로 간주).`,
      '값은 보여주지 않고 키 이름만 비교합니다:',
      `  - 기존 파일에만 있음: ${diff.onlyInExisting.length > 0 ? diff.onlyInExisting.join(', ') : '(없음)'}`,
      `  - 새로 생성되면 추가됨: ${diff.onlyInNew.length > 0 ? diff.onlyInNew.join(', ') : '(없음)'}`,
      `  - 둘 다에 있음(값은 덮어쓰기 대상): ${diff.inBoth.length > 0 ? diff.inBoth.join(', ') : '(없음)'}`,
      '계속 덮어쓰려면 `--force`를 붙여 다시 실행하세요.',
    ].join('\n')
    throw new EnvSyncError(msg)
  }

  for (const plan of plans) {
    fs.mkdirSync(path.dirname(plan.targetPath), { recursive: true })
    fs.writeFileSync(plan.targetPath, plan.content, 'utf8')
    console.log(`생성됨: ${plan.target.file}`)
  }

  console.log('env:sync 완료.')
}

try {
  main()
} catch (err) {
  if (err instanceof EnvSyncError) {
    console.error(err.message)
    process.exitCode = 1
  } else {
    throw err
  }
}
