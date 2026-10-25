// A realistic test semester (5 subjects, exams, assignments, study history).
// Dates are relative to the given day. Used by the tests only.
import { addDays, todayISO } from '../../src/lib/dates.js'

const SYLLABUS = [
  {
    id: 'os',
    code: 'CS501',
    name: 'Operating Systems',
    color: 'orange',
    teacher: 'Prof. Menon',
    units: [
      ['Processes & Scheduling', ['OS structure & system calls', 'Process states & PCB', 'Threads & multithreading', 'CPU scheduling: FCFS, SJF, RR, Priority'], 4],
      ['Synchronisation & Deadlocks', ['Critical section & Peterson’s solution', 'Semaphores & mutex locks', 'Producer-consumer & dining philosophers', 'Deadlocks & Banker’s algorithm'], 2],
      ['Memory Management', ['Paging & segmentation', 'TLB & effective access time', 'Virtual memory & demand paging', 'Page replacement: FIFO, LRU, Optimal'], 1],
      ['Storage & File Systems', ['Disk scheduling: SSTF, SCAN, C-LOOK', 'File allocation methods', 'RAID levels'], 0],
    ],
  },
  {
    id: 'dbms',
    code: 'CS502',
    name: 'Database Management Systems',
    color: 'mint',
    teacher: 'Dr. Kapoor',
    units: [
      ['ER & Relational Model', ['ER diagrams & cardinality', 'Keys: super, candidate, primary', 'Relational algebra'], 3],
      ['SQL', ['DDL, DML & constraints', 'Joins & subqueries', 'Views, triggers & procedures'], 3],
      ['Normalisation', ['Functional dependencies & closure', '1NF, 2NF and 3NF', 'BCNF & lossless decomposition'], 1],
      ['Transactions', ['ACID properties', 'Conflict & view serializability', 'Two-phase locking', 'Recovery & checkpoints'], 0],
    ],
  },
  {
    id: 'cn',
    code: 'CS503',
    name: 'Computer Networks',
    color: 'teal',
    teacher: 'Prof. Rao',
    units: [
      ['Network Models', ['OSI & TCP/IP layers', 'Transmission media', 'Circuit vs packet switching'], 3],
      ['Data Link Layer', ['Framing & CRC', 'Sliding window protocols', 'CSMA/CD & CSMA/CA'], 1],
      ['Network Layer', ['IPv4 addressing & subnetting', 'Distance vector & link state routing', 'IPv6 basics'], 0],
      ['Transport & Application', ['TCP vs UDP', 'Congestion control', 'DNS, HTTP & SMTP'], 0],
    ],
  },
  {
    id: 'daa',
    code: 'CS504',
    name: 'Design & Analysis of Algorithms',
    color: 'rose',
    teacher: 'Dr. Sharma',
    units: [
      ['Foundations', ['Asymptotic notation', 'Recurrences & Master theorem', 'Merge sort & quick sort'], 3],
      ['Greedy Algorithms', ['Huffman coding', 'Kruskal & Prim', 'Dijkstra’s algorithm', 'Fractional knapsack'], 2],
      ['Dynamic Programming', ['0/1 knapsack', 'Longest common subsequence', 'Matrix chain multiplication', 'Floyd-Warshall'], 1],
      ['Backtracking & NP', ['N-Queens', 'Branch & bound', 'P, NP & NP-complete'], 0],
    ],
  },
  {
    id: 'toc',
    code: 'CS505',
    name: 'Theory of Computation',
    color: 'gold',
    teacher: 'Prof. Nair',
    units: [
      ['Finite Automata', ['DFA & NFA', 'NFA to DFA conversion', 'DFA minimisation'], 2],
      ['Regular Languages', ['Regular expressions', 'Pumping lemma', 'Closure properties'], 0],
      ['Grammars & PDA', ['CFGs & derivations', 'CNF & GNF', 'Pushdown automata'], 0],
      ['Turing Machines', ['TM design', 'Decidability & the halting problem'], 0],
    ],
  },
]

// Small deterministic random so the demo looks the same on every load.
function seeded(seed) {
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

export function demoSemester(today = todayISO()) {
  const d = (n) => addDays(today, n)
  const subjects = []
  const units = []
  const topics = []

  for (const s of SYLLABUS) {
    subjects.push({ id: s.id, code: s.code, name: s.name, color: s.color, teacher: s.teacher })
    s.units.forEach(([title, list, doneCount], ui) => {
      const unitId = `${s.id}-u${ui + 1}`
      units.push({ id: unitId, subjectId: s.id, title, order: ui })
      list.forEach((t, ti) => {
        const done = ti < doneCount
        topics.push({ id: `${unitId}-t${ti + 1}`, unitId, subjectId: s.id, title: t, done, doneOn: done ? d(-(20 - ui * 4 - ti)) : null })
      })
    })
  }

  const exams = [
    { id: 'e1', subjectId: 'dbms', title: 'Quiz 2: Normalisation', type: 'Quiz', date: d(3), time: '10:00', venue: 'Room 204', unitIds: ['dbms-u3'] },
    { id: 'e2', subjectId: 'os', title: 'Mid-semester exam', type: 'Mid-sem', date: d(6), time: '09:30', venue: 'Exam Hall B', unitIds: ['os-u1', 'os-u2', 'os-u3'] },
    { id: 'e3', subjectId: 'cn', title: 'Internal assessment 1', type: 'Internal', date: d(11), time: '14:00', venue: 'Room 112', unitIds: ['cn-u1', 'cn-u2'] },
    { id: 'e4', subjectId: 'daa', title: 'Mid-semester exam', type: 'Mid-sem', date: d(15), time: '09:30', venue: 'Exam Hall A', unitIds: ['daa-u1', 'daa-u2', 'daa-u3'] },
    { id: 'e5', subjectId: 'toc', title: 'Quiz 1: Automata', type: 'Quiz', date: d(20), time: '11:00', venue: 'Room 301', unitIds: ['toc-u1', 'toc-u2'] },
    { id: 'e6', subjectId: 'dbms', title: 'Quiz 1: ER & SQL', type: 'Quiz', date: d(-12), time: '10:00', venue: 'Room 204', unitIds: ['dbms-u1', 'dbms-u2'] },
  ]

  const assignments = [
    { id: 'a1', subjectId: 'cn', title: 'Subnetting worksheet', due: d(1), priority: 'high', status: 'todo', estimate: 60, notes: 'Questions 1-12 from the handout.' },
    { id: 'a2', subjectId: 'os', title: 'Round Robin scheduler in C', due: d(2), priority: 'high', status: 'doing', estimate: 120, notes: 'Print Gantt chart and average waiting time.' },
    { id: 'a3', subjectId: 'dbms', title: 'ER diagram: library system', due: d(-1), priority: 'medium', status: 'todo', estimate: 45, notes: '' },
    { id: 'a4', subjectId: 'dbms', title: 'SQL lab record: joins & subqueries', due: d(4), priority: 'medium', status: 'todo', estimate: 90, notes: '' },
    { id: 'a5', subjectId: 'daa', title: 'Problem set 3: dynamic programming', due: d(5), priority: 'high', status: 'doing', estimate: 150, notes: 'Knapsack, LCS and matrix chain.' },
    { id: 'a6', subjectId: 'toc', title: 'DFA design exercises', due: d(6), priority: 'medium', status: 'todo', estimate: 60, notes: '' },
    { id: 'a7', subjectId: 'cn', title: 'Wireshark packet capture report', due: d(8), priority: 'low', status: 'todo', estimate: 90, notes: '' },
    { id: 'a8', subjectId: 'toc', title: 'Regular expression problems', due: d(12), priority: 'low', status: 'todo', estimate: 45, notes: '' },
    { id: 'a9', subjectId: 'daa', title: 'Greedy algorithms assignment', due: d(-4), priority: 'medium', status: 'done', estimate: 90, notes: '' },
    { id: 'a10', subjectId: 'os', title: 'Banker’s algorithm problems', due: d(-2), priority: 'medium', status: 'done', estimate: 60, notes: '' },
  ]

  // Planned study blocks for the week around today.
  const plan = {
    '-3': [['09:00', 'os', 'Process scheduling numericals', 50], ['18:00', 'daa', 'Huffman coding practice', 45]],
    '-2': [['10:00', 'dbms', 'SQL joins revision', 40], ['17:30', 'cn', 'OSI layers flash review', 30], ['20:00', 'os', 'Banker’s algorithm problems', 60]],
    '-1': [['09:30', 'toc', 'NFA to DFA conversions', 45], ['16:00', 'daa', 'Kruskal & Prim', 50]],
    0: [
      ['09:00', 'os', 'Page replacement: LRU vs Optimal', 50],
      ['11:30', 'dbms', 'Normalisation: BCNF practice', 45],
      ['16:00', 'cn', 'Subnetting worksheet', 60],
      ['19:30', 'daa', '0/1 knapsack with DP', 45],
      ['21:30', 'dbms', 'Quick revision before Quiz 2', 30],
    ],
    1: [['09:00', 'os', 'Virtual memory & demand paging', 50], ['14:00', 'toc', 'DFA minimisation', 40], ['20:00', 'dbms', 'Lossless decomposition', 45]],
    2: [['10:00', 'os', 'TLB & effective access time', 45], ['18:30', 'daa', 'LCS and matrix chain', 60]],
    3: [['08:00', 'dbms', 'Final pass: FDs & closure', 30], ['16:00', 'cn', 'Sliding window protocols', 45]],
  }
  const blocks = []
  const sessions = []
  for (const [offset, list] of Object.entries(plan)) {
    const day = d(Number(offset))
    list.forEach(([start, subjectId, title, minutes], i) => {
      const done = Number(offset) < 0 || (Number(offset) === 0 && i < 2)
      const id = `b${offset}-${i}`
      blocks.push({ id, subjectId, title, date: day, start, minutes, done })
      if (done) sessions.push({ id: `s-${id}`, subjectId, minutes: minutes - 3 + i * 2, date: day, note: title, blockId: id })
    })
  }

  // Older study history for the analytics and streak.
  const rand = seeded(42)
  const ids = SYLLABUS.map((s) => s.id)
  for (let back = 4; back <= 110; back++) {
    if (back === 8 || back === 15 || back === 16 || (back > 30 && rand() < 0.22)) continue // rest days
    const count = 1 + Math.floor(rand() * 3)
    for (let k = 0; k < count; k++) {
      sessions.push({
        id: `h${back}-${k}`,
        subjectId: ids[Math.floor(rand() * ids.length)],
        minutes: 25 + Math.round(rand() * 70),
        date: d(-back),
        note: '',
      })
    }
  }

  return {
    profile: { name: 'Aarav', course: 'B.Tech CSE', semester: 'Semester 5' },
    prefs: { dailyGoal: 180 },
    subjects,
    units,
    topics,
    exams,
    assignments,
    blocks,
    sessions,
    timer: null,
  }
}
