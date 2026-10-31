export interface Level { name: string; question: string; key: string; hint: string; answer: string; completed: boolean; combatWon: boolean; chests: boolean[]; attempts: number }
export interface Quest { id: string; hero: string; title: string; current: number; levels: Level[] }
export interface Library { active: string; quests: Quest[] }
export const STORAGE = 'questbound-assignments-v2'
export const newId = () => crypto.randomUUID()

// Deliberately accepts numbers/fractions, not executable expressions or arbitrary algebra.
function numeric(text: string): number | null {
  const raw = text.trim().replace(/[−–]/g, '-')
  if (raw.includes(',') && !raw.replace(/%$/, '').split('/').every(part => /^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(part.trim()) || !part.includes(','))) return null
  const clean = raw.replace(/,/g, '')
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?(?:\s*\/\s*[+-]?(?:\d+(?:\.\d*)?|\.\d+))?%?$/i.test(clean)) return null
  const percent = clean.endsWith('%')
  const parts = clean.replace('%', '').split('/').map(Number)
  const value = parts.length === 2 ? parts[0] / parts[1] : parts[0]
  return Number.isFinite(value) ? value / (percent ? 100 : 1) : null
}
const normalize = (text: string) => text.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ').replace(/[−–]/g, '-')
export function matchesAnswer(answer: string, key: string): boolean {
  if (!answer.trim() || !key.trim()) return false
  return key.split('|').some(alternative => {
    if (!alternative.trim()) return false
    const expected = numeric(alternative), actual = numeric(answer)
    if (expected !== null && actual !== null) return Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(expected))
    return normalize(answer) === normalize(alternative)
  })
}
export function demoQuest(): Quest {
  const items = [
    ['The First Step', 'Find the next term: 3, 7, 11, 15, …', '19', 'This is an arithmetic progression. Find the difference between consecutive terms.'],
    ['The Tower of Terms', 'An arithmetic progression has first term a = 5 and common difference d = 3. Find its 10th term.', '32', 'For an AP, aₙ = a + (n − 1)d.'],
    ['The Sumkeeper', 'Find the sum of the first 20 positive integers: 1 + 2 + … + 20.', '210', 'Use Sₙ = n(n + 1)/2.'],
    ['The Doubling Dungeon', 'Find the 6th term of the geometric progression 2, 6, 18, …', '486', 'The common ratio is 3. For a GP, aₙ = arⁿ⁻¹.'],
    ['The Infinite Bridge', 'Find the sum to infinity of 8 + 4 + 2 + 1 + …', '16', 'For |r| < 1, the infinite GP sum is a/(1 − r).'],
    ['The Crown of Series', 'Find the sum of the first 5 terms of the geometric progression 3, 6, 12, …', '93', 'Use Sₙ = a(rⁿ − 1)/(r − 1), or add the five terms.']
  ]
  return { id: newId(), hero: 'The Scholar', title: 'Sequences & Series: The Lost Crown', current: 0,
    levels: items.map(([name, question, key, hint]) => ({ name, question, key, hint, answer: '', completed: false, combatWon: false, chests: [false,false], attempts: 0 })) }
}
export function sanitizeLibrary(value: unknown): Library | null {
  const lib = value as Library
  if (!lib || !Array.isArray(lib.quests) || !lib.quests.length || lib.quests.length > 10 || typeof lib.active !== 'string') return null
  const ids = new Set<string>()
  for (const q of lib.quests) {
    if (!q || typeof q.id !== 'string' || !q.id || q.id.length > 100 || ids.has(q.id) || typeof q.hero !== 'string' || q.hero.length > 40 || typeof q.title !== 'string' || q.title.length > 80 || !Array.isArray(q.levels) || !q.levels.length || q.levels.length > 30) return null
    ids.add(q.id)
    for (const l of q.levels) {
      if (!l || !['name', 'question', 'key', 'answer', 'hint'].every(k => typeof l[k as keyof Level] === 'string') || !l.question.trim() || !l.key.trim()) return null
      if (l.name.length > 70 || l.question.length > 3000 || l.key.length > 1000 || l.hint.length > 1000 || l.answer.length > 10000 || l.key.split('|').some(k => !k.trim())) return null
      l.attempts = Number.isInteger(l.attempts) && l.attempts >= 0 ? l.attempts : 0
      l.completed = l.completed === true && matchesAnswer(l.answer, l.key)
      l.combatWon = l.combatWon === true
      l.chests = Array.isArray(l.chests) ? [l.chests[0] === true, l.chests[1] === true] : [false,false]
    }
    const firstLocked = q.levels.findIndex(l => !l.completed || !l.combatWon)
    q.current = Number.isInteger(q.current) && q.current >= 0 && q.current < q.levels.length ? q.current : 0
    if (firstLocked >= 0 && q.current > firstLocked) q.current = firstLocked
  }
  if (!ids.has(lib.active)) lib.active = lib.quests[0].id
  return lib
}
export function loadLibrary(): Library {
  try { const saved = sanitizeLibrary(JSON.parse(localStorage.getItem(STORAGE) || 'null')); if (saved) return saved } catch { }
  const demo = demoQuest(); return { active: demo.id, quests: [demo] }
}
export function badges(q: Quest) {
  const count = q.levels.filter(l => l.completed).length
  const all = count === q.levels.length && q.levels.every(l => l.combatWon)
  return [
    { icon: '⚔', name: 'Oath of the First Knight', detail: 'Break your first assignment seal', earned: count >= 1 },
    { icon: '✦', name: 'Guardian of Wisdom', detail: 'Solve at least half the questions', earned: count >= Math.ceil(q.levels.length / 2) },
    { icon: '♛', name: 'Honor of the Proudest Knight', detail: 'Open every gate and rescue the queen', earned: all },
    { icon: '◇', name: 'The Flawless Crown', detail: 'Clear every gate on the first attempt', earned: all && q.levels.every(l => l.attempts === 1) }
  ]
}
