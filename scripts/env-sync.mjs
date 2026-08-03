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

// secret 계열로 간주하는 키 이름 패턴 (denylist). 이름 기반이라 완전하지 않다 —
// 예: NTS_API_KEY는 실제 자격증명이지만 이 패턴에 안 걸린다 (Finding 4). 그래서
// 브라우저에 실제로 전달되는 frontend/.env.local에는 이 패턴을 1차 방어선으로만 쓰고,
// 최종 결정은 아래 FRONTEND_ALLOWED_* allowlist(2차·주 방어선)에 맡긴다.
const SECRET_PATTERN = /SECRET|SERVICE_ROLE|PRIVATE_KEY|PASSWORD|DATABASE_URL|_TOKEN\b/i

// 이 목록에 있는 target 파일만 SECRET_PATTERN에 걸리는 키를 가질 수 있다.
// (지금은 backend/.env 뿐이다.) 여기 없는 target에서 매치가 하나라도 나오면
// 스크립트는 파일을 하나도 쓰지 않고 즉시 에러로 멈춘다.
const GUARD_EXEMPT_FILES = new Set(['backend/.env'])

// SECRET_PATTERN(denylist)에 걸리지만 의도적으로 통과시켜야 하는 "file:key" 이름 있는
// 예외. 과거에는 이런 예외를 buildDevLoginLines()라는 별도 함수로 가드 자체를 우회해
// 처리했는데, 그러면 그 함수가 만드는 다른 줄도 가드를 영영 안 거치게 된다(Finding 1).
// 지금은 예외를 이 표 하나에 이름으로 적어두고, DEV_LOGIN_PASSWORD도 TARGETS의 일반
// optionalNoDefault 항목으로 되돌린다 — "어떤 키가 어디로 가는지 표 하나만 보면 된다"는
// 요구사항이 복구된다.
const GUARD_ALLOWLIST = new Set([
  // NEXT_PUBLIC_ 접두사가 없어 Next.js 클라이언트 번들에 인라인되지 않는다(서버에서만
  // 읽는 로컬 전용 dev 퀵 로그인 토글). 이름에 PASSWORD가 있다는 이유만으로
  // SECRET_PATTERN에 걸리므로 명시적으로 예외 처리한다.
  'frontend/.env.local:DEV_LOGIN_PASSWORD',
])

// frontend/.env.local은 브라우저까지 실제로 전달되는 유일한 대상이라, denylist가 아니라
// allowlist(화이트리스트)로 검사한다 — "표에 없는 키는 이름이 뭐든 거부"가 기본값이다.
// 이 목록이 곧 "프론트로 나가도 되는 키 전체"이므로, 나중에 누가 매핑 표나 별도 빌더에
// 새 키를 몰래 추가해도(Finding 4의 NTS_API_KEY 재현처럼) 여기 없으면 막힌다.
const FRONTEND_FILE = 'frontend/.env.local'
const FRONTEND_ALLOWED_KEYS = new Set([
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_API_BASE_URL',
])
const FRONTEND_ALLOWED_PREFIXES = ['DEV_LOGIN_']

function isFrontendKeyAllowed(key) {
  if (FRONTEND_ALLOWED_KEYS.has(key)) return true
  return FRONTEND_ALLOWED_PREFIXES.some((prefix) => key.startsWith(prefix))
}

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
    optionalNoDefault: [
      // dev 퀵 로그인 토글 — 로컬 전용, 로그인 화면에 역할별 원클릭 배너를 띄운다.
      // DEV_LOGIN_PASSWORD는 이름에 PASSWORD가 있어 SECRET_PATTERN(denylist)에 걸리지만
      // GUARD_ALLOWLIST('frontend/.env.local:DEV_LOGIN_PASSWORD')로 이름 있는 예외 처리돼
      // 있고, 어차피 FRONTEND_ALLOWED_PREFIXES('DEV_LOGIN_')가 출력 단계에서도 통과시킨다.
      // NEXT_PUBLIC_ 접두사가 없어 Next.js 클라이언트 번들에는 들어가지 않는다.
      {
        from: 'DEV_LOGIN_ENABLED',
        to: 'DEV_LOGIN_ENABLED',
        comment: 'dev 퀵 로그인 — 켜려면 루트 .env에 DEV_LOGIN_ENABLED=1을 설정하고 pnpm env:sync를 다시 실행하세요. 프로덕션에는 절대 설정하지 마세요.',
      },
      {
        from: 'DEV_LOGIN_PASSWORD',
        to: 'DEV_LOGIN_PASSWORD',
        comment: '시드 비밀번호(SEED_PASSWORD)를 바꾼 경우에만 설정하세요 (기본값 ***REMOVED***).',
      },
    ],
  },
]

// ---------------------------------------------------------------------------
// CLI 인자
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const args = { root: null, force: false }
  const unknown = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--force') {
      args.force = true
    } else if (a === '--root') {
      const value = argv[i + 1]
      // 값을 안 주거나(마지막 인자) 다음 토큰이 또 다른 플래그면, 조용히 undefined로
      // 폴백해 진짜 리포 루트에 쓰는 대신 에러로 거부한다.
      if (value === undefined || value.startsWith('--')) {
        throw new EnvSyncError(
          `--root 뒤에 디렉터리 경로가 필요합니다 (받은 값: ${value === undefined ? '(없음)' : value}).`
        )
      }
      args.root = value
      i++
    } else if (a.startsWith('--root=')) {
      const value = a.slice('--root='.length)
      if (value === '') {
        throw new EnvSyncError('--root= 뒤에 디렉터리 경로가 필요합니다.')
      }
      args.root = value
    } else {
      unknown.push(a)
    }
  }
  if (unknown.length > 0) {
    throw new EnvSyncError(`알 수 없는 인자: ${unknown.join(', ')}`)
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
    // `export KEY=value` 형태(README가 SUPABASE_PROJECT_REF에 안내하는 셸 관용구)도 인식한다.
    // 이걸 안 벗기면 키가 "export ENVIRONMENT"로 저장돼 매칭이 조용히 실패한다.
    const key = line.slice(0, eq).trim().replace(/^export\s+/, '')
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
      if (GUARD_ALLOWLIST.has(`${target.file}:${entry.to}`)) continue
      if (SECRET_PATTERN.test(entry.from) || SECRET_PATTERN.test(entry.to)) {
        problems.push(`${target.file}: ${entry.from} -> ${entry.to}`)
      }
    }
  }
  if (problems.length > 0) {
    throw new EnvSyncError(
      [
        'secret 가드 위반 — 매핑 테이블에 secret로 보이는 키가 프론트(또는 비허용) 대상에 있습니다.',
        '다음 항목을 TARGETS에서 제거하거나, 정말 의도한 것이면 GUARD_EXEMPT_FILES/GUARD_ALLOWLIST를 검토하세요:',
        ...problems.map((p) => `  - ${p}`),
        '(파일은 하나도 쓰지 않았습니다.)',
      ].join('\n')
    )
  }
}

// ---------------------------------------------------------------------------
// secret 가드(2단계) — buildFileContent가 만든 "실제 렌더된 내용"을 다시 파싱해 검사한다.
// assertNoSecretLeak은 TARGETS 표만 보므로, 표를 거치지 않고 내용을 추가하는 어떤 코드
// (과거의 buildDevLoginLines() 같은)가 생겨도 이 검사는 놓치지 않는다 (Finding 1).
//
// frontend/.env.local은 allowlist로, 그 외 non-exempt 대상은 SECRET_PATTERN denylist로
// 검사한다 — 조합 근거는 파일 상단 FRONTEND_ALLOWED_KEYS 주석 참고.
// ---------------------------------------------------------------------------
function assertNoSecretInOutput(file, content) {
  if (GUARD_EXEMPT_FILES.has(file)) return
  const keys = Object.keys(parseEnvFile(content))

  if (file === FRONTEND_FILE) {
    const problems = keys.filter((key) => !isFrontendKeyAllowed(key))
    if (problems.length > 0) {
      throw new EnvSyncError(
        [
          `secret 가드 위반 — ${file}에 기록될 내용에 allowlist에 없는 키가 있습니다:`,
          ...problems.map((p) => `  - ${p}`),
          `허용된 키: ${[...FRONTEND_ALLOWED_KEYS].join(', ')}, 접두사 허용: ${FRONTEND_ALLOWED_PREFIXES.join(', ')}*`,
          '(파일은 하나도 쓰지 않았습니다.)',
        ].join('\n')
      )
    }
    return
  }

  const problems = keys.filter(
    (key) => SECRET_PATTERN.test(key) && !GUARD_ALLOWLIST.has(`${file}:${key}`)
  )
  if (problems.length > 0) {
    throw new EnvSyncError(
      [
        `secret 가드 위반 — ${file}에 기록될 내용에 secret로 보이는 키가 있습니다:`,
        ...problems.map((p) => `  - ${p}`),
        '(파일은 하나도 쓰지 않았습니다.)',
      ].join('\n')
    )
  }
}

class EnvSyncError extends Error {}

// ---------------------------------------------------------------------------
// 쓸 때 항상 안전하게 인용한다 (Finding 3). 파서(parseEnvFile)는 따옴표를 벗기지만
// 쓰는 쪽은 늘 raw로 찍어서, 공백이나 `#`이 든 값(예: SEED_PASSWORD='Dev 1234 #x')이
// 따옴표 없이 다운스트림에 넘어가면 python-dotenv/JS dotenv가 `#` 이후를 주석으로
// 잘라 값이 조용히 잘렸다. 이 리포의 실제 값 형태(Supabase 키, DSN, URL)에서 흔한
// 문자는 인용 없이 그대로 두고, 그 밖의 문자가 하나라도 있으면 통째로 인용한다.
// ---------------------------------------------------------------------------
const SAFE_UNQUOTED_VALUE = /^[A-Za-z0-9_.:/@+=%,!~-]*$/
function quote(value) {
  if (SAFE_UNQUOTED_VALUE.test(value)) return value
  return `"${value.replace(/(["\\$`])/g, '\\$1')}"`
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
    lines.push(`${entry.to}=${quote(rootEnv[entry.from])}`)
  }

  if (target.optionalWithDefault.length > 0) {
    lines.push('')
    lines.push('# ---- 앱 고유 값 (루트 .env에 없으면 기본값 사용) ----')
    for (const entry of target.optionalWithDefault) {
      const value = rootEnv[entry.from] !== undefined && rootEnv[entry.from] !== ''
        ? rootEnv[entry.from]
        : entry.default
      lines.push(`${entry.to}=${quote(value)}`)
    }
  }

  if (target.optionalNoDefault.length > 0) {
    lines.push('')
    lines.push('# ---- 선택 (기본값 없음, 루트 .env에 있을 때만 포함) ----')
    for (const entry of target.optionalNoDefault) {
      if (entry.comment) lines.push(`# ${entry.comment}`)
      const value = rootEnv[entry.from]
      if (value !== undefined && value !== '') {
        lines.push(`${entry.to}=${quote(value)}`)
      } else {
        // `KEY=` 뒤에 값 없이 바로 설명을 붙이면 안 된다 — 사용자가 `#`만 지우고
        // uncomment하면 설명 텍스트가 그대로 값이 돼 버린다(예:
        // `DATABASE_URL=  (루트 .env에 없음)`). `#` 뒤에 별도 주석으로 둬서, 지워도
        // 빈 값(`KEY=`)만 남게 한다.
        lines.push(`# ${entry.to}=      # 루트 .env에 없어 생략됨`)
      }
    }
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

  // 표 검사(assertNoSecretLeak)와 별개로, 실제로 쓰일 내용도 검사한다 — buildDevLoginLines
  // 같은 표 밖 빌더가 나중에 다시 생겨도 이 단계가 잡는다 (Finding 1).
  for (const plan of plans) {
    assertNoSecretInOutput(plan.target.file, plan.content)
  }

  // 쓰기 전에 전부 검사 — 하나라도 막히면 아무 파일도 쓰지 않는다 (부분 생성 방지).
  for (const plan of plans) {
    if (!fs.existsSync(plan.targetPath)) continue
    const existingContent = fs.readFileSync(plan.targetPath, 'utf8')
    const generated = isGeneratedByUs(existingContent)
    const diff = summarizeKeyDiff(existingContent, plan.content)

    if (!generated && !cli.force) {
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

    // 여기 도달했다는 건 마커가 있거나 --force라 실제로 덮어쓴다는 뜻이다. 그렇더라도
    // 기존 파일에만 있던 키(예: 사람이 직접 넣은 DATABASE_URL)가 조용히 사라지면 안 되므로
    // 경고는 반드시 찍는다 (Finding 2 — 마커 있는 파일도, --force도 예외 없음).
    if (diff.onlyInExisting.length > 0) {
      console.warn(
        [
          `경고: ${plan.target.file}에 있던 다음 키가 새로 생성되는 파일에는 없어 사라집니다:`,
          `  - ${diff.onlyInExisting.join(', ')}`,
          '이 키가 계속 필요하면(예: DATABASE_URL은 RLS 테스트 전용) 루트 .env에도 추가한 뒤',
          '`pnpm env:sync`를 다시 실행하세요.',
        ].join('\n')
      )
    }
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
