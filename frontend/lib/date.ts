export function monthRange(date = new Date()) {
  const from = new Date(date.getFullYear(), date.getMonth(), 1)
  const to = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return {
    from: ymd(from),
    to: ymd(to),
    label: `${from.getFullYear()}년 ${from.getMonth() + 1}월`,
  }
}

export function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
