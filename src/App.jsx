import { useState, useEffect, useRef } from 'react'
import { Line, Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend } from 'chart.js'
import './App.css'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend)

// Convert lbs to kg
const lbsToKg = (lbs) => Math.round(lbs * 0.453592 * 10) / 10

// Convert weight to kg for stats
const toKg = (weight, unit, kgPerUnit = null) => {
  if (!weight) return 0
  const w = parseFloat(weight) || 0
  if (kgPerUnit) {
    return w * kgPerUnit
  }
  if (unit === 'lbs') {
    return lbsToKg(w)
  }
  return w
}

// Generate weight steps from start, increment, and max
const generateWeightSteps = (start, increment, max = 200) => {
  const steps = []
  for (let w = start; w <= max; w += increment) {
    steps.push(Math.round(w * 10) / 10)
  }
  return steps
}

// Calculate plate combination for a given total weight (per side)
const getPlatesPerSide = (totalWeight, barWeight, unit) => {
  const weightPerSide = (totalWeight - barWeight) / 2
  if (weightPerSide <= 0) return []

  // Available plates (per side) - no 35lbs
  const plates = unit === 'lbs'
    ? [45, 25, 10, 5, 2.5]
    : [20, 10, 5, 2.5, 1.25]

  const result = []
  let remaining = weightPerSide

  for (const plate of plates) {
    while (remaining >= plate - 0.01) {
      result.push(plate)
      remaining -= plate
    }
  }

  return result
}

// Format plates display (e.g., "45+25+10" or "2×45+25")
const formatPlates = (plates) => {
  if (plates.length === 0) return 'bar only'

  const counts = {}
  plates.forEach(p => counts[p] = (counts[p] || 0) + 1)

  return Object.entries(counts)
    .sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]))
    .map(([plate, count]) => count > 1 ? `${count}×${plate}` : plate)
    .join('+')
}

const defaultRoutines = {
  push: {
    name: 'Push',
    schedule: 'Mon & Thu',
    warmups: [
      { id: 'w1', name: 'Shoulder Circles', reps: '10', checks: ['Forward Left', 'Forward Right', 'Backward Left', 'Backward Right'] },
      { id: 'w2', name: 'Wrist Circles', reps: '10', checks: ['Clockwise Left', 'Clockwise Right', 'Counterclockwise Left', 'Counterclockwise Right'] },
      { id: 'w3', name: 'Ankle Circles', reps: '10', notes: 'Prep for calf raises', checks: ['Clockwise Left', 'Clockwise Right', 'Counterclockwise Left', 'Counterclockwise Right'] },
      { id: 'w4', name: 'Isometric Elbow Extension', reps: '20-30s', notes: 'Mid-range (~100°) · 50-60% effort · Skip if painful', checks: ['Set 1', 'Set 2', 'Set 3'] },
    ],
    exercises: [
      { id: 1, name: 'Pushdown', warmupSets: 2, workSets: 2, reps: '15-20', unit: 'lbs', equipmentType: 'cable', startWeight: 10, increment: 15, templateNotes: '3s ecc / 3s con · Stop 15° before lockout · Pain ≤3/10' },
      { id: 2, name: 'Lateral Raise Machine', warmupSets: 2, workSets: 2, reps: '10-15', unit: 'lbs', equipmentType: 'machine', startWeight: 5, increment: 5, templateNotes: 'Small muscle, long lever — heavier isn\'t better here' },
      { id: 3, name: 'Incline Chest Press', warmupSets: 3, workSets: 2, reps: '8-12', unit: 'lbs', equipmentType: 'plates', startWeight: 0, increment: 5, barWeight: 0, templateNotes: 'Stop 2-3cm before lockout' },
      { id: 4, name: 'Butterfly', warmupSets: 1, workSets: 2, reps: '10-15', unit: 'kg', equipmentType: 'machine', startWeight: 7, increment: 7, templateNotes: 'Heavy flyes stress shoulder joint at stretch — higher reps safer' },
      { id: 5, name: 'Seated Leg Extensions', warmupSets: 3, workSets: 1, reps: '12-15', unit: 'kg', equipmentType: 'machine', startWeight: 5, increment: 5, templateNotes: 'No knee lockout · First warmup = joint prep, no weight' },
      { id: 6, name: 'Standing Calf Raises', warmupSets: 1, workSets: 1, reps: '15-20', unit: 'kg', equipmentType: 'machine', startWeight: 35, increment: 10, templateNotes: 'Slow 3s ecc · Heel STRAIGHT · Limit depth if snapping' },
    ]
  },
  pull: {
    name: 'Pull',
    schedule: 'Tue & Fri',
    warmups: [
      { id: 'w1', name: 'Shoulder Circles', reps: '10', checks: ['Forward Left', 'Forward Right', 'Backward Left', 'Backward Right'] },
      { id: 'w2', name: 'Wrist Circles', reps: '10', notes: 'Prep for curls + rows', checks: ['Clockwise Left', 'Clockwise Right', 'Counterclockwise Left', 'Counterclockwise Right'] },
    ],
    exercises: [
      { id: 1, name: 'Preacher Curl', warmupSets: 1, workSets: 2, reps: '4-8', unit: 'kg', equipmentType: 'machine', startWeight: 5, increment: 5 },
      { id: 2, name: 'RDL', warmupSets: 3, workSets: 1, reps: '4-8', unit: 'lbs', equipmentType: 'plates', startWeight: 25, increment: 5, barWeight: 25 },
      { id: 3, name: 'Lat Pulldown', warmupSets: 3, workSets: 2, reps: '4-8', unit: 'lbs', equipmentType: 'cable', startWeight: 10, increment: 15 },
      { id: 4, name: 'Chest-Supported Row', warmupSets: 1, workSets: 1, reps: '4-8', unit: 'lbs', equipmentType: 'machine', startWeight: 30, increment: 10 },
      { id: 5, name: 'Reverse Butterfly', warmupSets: 1, workSets: 1, reps: '4-8', unit: 'kg', equipmentType: 'machine', startWeight: 7, increment: 7 },
      { id: 6, name: 'Crunch Cable', warmupSets: 1, workSets: 2, reps: '4-8', unit: 'lbs', equipmentType: 'cable', startWeight: 10, increment: 15 },
      { id: 7, name: 'Hip Adduction', warmupSets: 1, workSets: 1, reps: '12-15', unit: 'lbs', equipmentType: 'machine', startWeight: 20, increment: 10, templateNotes: 'Superset with abduction' },
      { id: 8, name: 'Hip Abduction', warmupSets: 1, workSets: 1, reps: '12-15', unit: 'lbs', equipmentType: 'machine', startWeight: 20, increment: 10, templateNotes: 'Glute medius — patellar tracking · Superset with adduction' },
    ]
  },
  rest: {
    name: 'Rest Day',
    schedule: 'Wed, Sat, Sun',
    isRest: true,
    warmups: [],
    exercises: [],
    blocks: [
      {
        name: 'Foot Core',
        icon: '🦶',
        duration: '~8 min',
        exercises: [
          { id: 1, name: 'Short Foot Exercise', sets: 3, reps: '10', notes: '5-10 sec hold · Seated → standing · DON\'T curl toes' },
          { id: 2, name: 'Toe Yoga', sets: 3, reps: '10 each', notes: 'Big toe up / small toes down, then reverse' },
          { id: 3, name: 'Towel Curls', sets: 3, reps: '10', notes: 'Smooth floor · Toes only, heel stays planted' },
          { id: 4, name: 'Banded Inversion', sets: 3, reps: '15', notes: 'Posterior tibial · Turn foot inward against band · Slow' },
        ]
      },
      {
        name: 'Ankle Stability',
        icon: '🦶',
        duration: '~5 min',
        exercises: [
          { id: 5, name: 'Banded Eversion', sets: 3, reps: '15', notes: 'Peroneals · Turn foot outward against band · Slow' },
          { id: 6, name: 'Single-Leg Balance (eyes closed)', sets: 3, reps: '30s each', notes: 'Flat ground · Engage arch · Near a wall for safety' },
        ]
      },
      {
        name: 'Hip / Knee Chain',
        icon: '🦵',
        duration: '~7 min',
        exercises: [
          { id: 7, name: 'Side-Lying Clamshells', sets: 3, reps: '15', notes: 'Band above knees · Feet stay together · Don\'t rock pelvis' },
          { id: 8, name: 'Single-Leg Glute Bridge', sets: 3, reps: '12 each', notes: 'Drive through heel · 2 sec squeeze at top · Keep hips level' },
        ]
      },
      {
        name: 'Mobility + Stretching',
        icon: '🧘',
        duration: '~8 min',
        exercises: [
          { id: 9, name: 'Standing Hamstring Stretch', sets: 2, reps: '30s each', notes: 'Foot on chair/step · Straight leg · Hinge at hips' },
          { id: 10, name: 'Calf Stretch (supinated foot)', sets: 2, reps: '30s each', notes: 'Wall stretch · Straight + bent knee · Roll foot OUTWARD' },
          { id: 11, name: 'Half-Kneeling Ankle Dorsiflexion', sets: 2, reps: '10 each', notes: 'Knee over 2nd/3rd toe · Heel stays down' },
          { id: 12, name: 'Hip Flexor Stretch (half-kneeling)', sets: 2, reps: '30s each', notes: 'Back knee on ground · Squeeze glute · Don\'t arch lower back' },
          { id: 13, name: '90/90 Hip Switches', sets: 2, reps: '8 each', notes: 'Slow transitions · Torso tall' },
          { id: 14, name: 'Doorframe Chest Stretch', sets: 2, reps: '30s', notes: 'Arm at 90° on doorframe · Step through' },
          { id: 15, name: 'Thoracic Spine Rotation (lying)', sets: 2, reps: '8 each', notes: 'Side-lying · Top arm opens up · Follow hand with eyes' },
          { id: 16, name: 'Tricep/Lat Overhead Stretch', sets: 2, reps: '30s each', notes: 'Arm overhead, hand behind head · Pain-free range only' },
        ]
      }
    ]
  }
}

function App() {
  const [tab, setTab] = useState('log')
  const [date] = useState(new Date().toISOString().split('T')[0])
  const [workouts, setWorkouts] = useState({})
  const [routines, setRoutines] = useState(defaultRoutines)
  const [exerciseNotes, setExerciseNotes] = useState({})
  const [github, setGithub] = useState({ token: '', repo: '', owner: '', connected: false })
  const [editModal, setEditModal] = useState(null)
  const [phases, setPhases] = useState([])
  const [syncStatus, setSyncStatus] = useState('')
  const [currentExerciseIdx, setCurrentExerciseIdx] = useState(0)
  const [activeSetIdx, setActiveSetIdx] = useState({ type: 'work', idx: 0 }) // Track last interacted set
  const [settingsSection, setSettingsSection] = useState('sync')
  const [ghExpanded, setGhExpanded] = useState(false)
  const [dragState, setDragState] = useState(null)
  const [touchDrag, setTouchDrag] = useState(null)
  const [routinePicker, setRoutinePicker] = useState(false)
  const longPressRef = useRef(null)
  const touchTimeout = useRef(null)
  const [statsFilter, setStatsFilter] = useState('current')
  const [statsTab, setStatsTab] = useState('overview')
  const [exSort, setExSort] = useState('recent')
  const [histFilter, setHistFilter] = useState('all')
  const [balanceMode, setBalanceMode] = useState('volume')
  const [openHistDates, setOpenHistDates] = useState(new Set())
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [selectedWorkoutDay, setSelectedWorkoutDay] = useState(null)
  const [selectedExercise, setSelectedExercise] = useState(null)
  const [lastSyncTime, setLastSyncTime] = useState(0)
  const [needsSync, setNeedsSync] = useState(false)
  const [commitsToday, setCommitsToday] = useState(null)
  const syncIntervalRef = useRef(null)

  // Lock screen orientation to portrait (or counter-rotate on iOS)
  useEffect(() => {
    // Try the API first (works on Android PWA)
    if (screen.orientation?.lock) {
      screen.orientation.lock('portrait').catch(() => {})
    }

    // For iOS: counter-rotate content when in landscape
    const handleOrientationChange = () => {
      const isLandscape = window.innerWidth > window.innerHeight
      document.body.classList.toggle('landscape-override', isLandscape)
    }

    handleOrientationChange()
    window.addEventListener('resize', handleOrientationChange)
    window.addEventListener('orientationchange', handleOrientationChange)

    return () => {
      window.removeEventListener('resize', handleOrientationChange)
      window.removeEventListener('orientationchange', handleOrientationChange)
    }
  }, [])

  // Load from localStorage first, then optionally merge with GitHub
  useEffect(() => {
    const savedWorkouts = localStorage.getItem('gymtracker_workouts')
    if (savedWorkouts) setWorkouts(JSON.parse(savedWorkouts))
    const savedRoutines = localStorage.getItem('gymtracker_routines')
    if (savedRoutines) {
      setRoutines(JSON.parse(savedRoutines))
    } else {
      localStorage.setItem('gymtracker_routines', JSON.stringify(defaultRoutines))
      setRoutines(defaultRoutines)
    }
    const savedNotes = localStorage.getItem('gymtracker_notes')
    if (savedNotes) setExerciseNotes(JSON.parse(savedNotes))
    const savedLastSync = localStorage.getItem('gymtracker_lastsync')
    if (savedLastSync) setLastSyncTime(parseInt(savedLastSync))
    const savedGithub = localStorage.getItem('gymtracker_github')
    if (savedGithub) {
      const gh = JSON.parse(savedGithub)
      setGithub(gh)
      if (gh.connected) autoLoadFromGithub(gh)
    }
  }, [])

  // Debounced sync - sync 5 seconds after last change
  useEffect(() => {
    if (needsSync && github.connected) {
      // Clear any existing timeout
      if (syncIntervalRef.current) clearTimeout(syncIntervalRef.current)
      // Set new timeout to sync after 5 seconds of no changes
      syncIntervalRef.current = setTimeout(() => {
        forceSyncToGithub()
      }, 5000)
    }
    return () => {
      if (syncIntervalRef.current) clearTimeout(syncIntervalRef.current)
    }
  }, [needsSync, github.connected, workouts, exerciseNotes])

  // Sync when app goes to background (more reliable than beforeunload)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && needsSync && github.connected) {
        forceSyncToGithub()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [needsSync, github.connected])

  const autoLoadFromGithub = async (gh) => {
    try {
      const dataRes = await fetch(`https://api.github.com/repos/${gh.owner}/${gh.repo}/contents/data.json`, { headers: { Authorization: `token ${gh.token}` } })
      if (dataRes.ok) {
        const file = await dataRes.json()
        const data = JSON.parse(decodeURIComponent(escape(atob(file.content))))
        if (data.phases) setPhases(data.phases)
      }

      const gymRes = await fetch(`https://api.github.com/repos/${gh.owner}/${gh.repo}/contents/gym.json`, { headers: { Authorization: `token ${gh.token}` } })
      if (gymRes.ok) {
        const file = await gymRes.json()
        const remoteData = JSON.parse(decodeURIComponent(escape(atob(file.content))))
        const localWorkouts = JSON.parse(localStorage.getItem('gymtracker_workouts') || '{}')
        const localNotes = JSON.parse(localStorage.getItem('gymtracker_notes') || '{}')

        // Check if local has data that remote doesn't
        const localDates = Object.keys(localWorkouts)
        const remoteDates = Object.keys(remoteData.workouts || {})
        const localHasMore = localDates.some(d => !remoteDates.includes(d) ||
          JSON.stringify(localWorkouts[d]) !== JSON.stringify(remoteData.workouts[d]))

        if (localHasMore) {
          // Local has data remote doesn't - merge and sync
          const mergedWorkouts = { ...remoteData.workouts, ...localWorkouts }
          const mergedNotes = { ...remoteData.notes, ...localNotes }
          setWorkouts(mergedWorkouts)
          setExerciseNotes(mergedNotes)
          localStorage.setItem('gymtracker_workouts', JSON.stringify(mergedWorkouts))
          localStorage.setItem('gymtracker_notes', JSON.stringify(mergedNotes))
          // Sync merged data to remote
          await syncGymToGithub(mergedWorkouts, mergedNotes, true)
        } else {
          // Remote is up to date - use remote
          setWorkouts(remoteData.workouts || {})
          localStorage.setItem('gymtracker_workouts', JSON.stringify(remoteData.workouts || {}))
          if (remoteData.notes) {
            setExerciseNotes(remoteData.notes)
            localStorage.setItem('gymtracker_notes', JSON.stringify(remoteData.notes))
          }
        }
      }

      const routinesRes = await fetch(`https://api.github.com/repos/${gh.owner}/${gh.repo}/contents/routines.json`, { headers: { Authorization: `token ${gh.token}` } })
      if (routinesRes.ok) {
        const file = await routinesRes.json()
        const data = JSON.parse(decodeURIComponent(escape(atob(file.content))))
        // Normalize units to lowercase (Lbs → lbs, Kg → kg)
        for (const routine of Object.values(data)) {
          for (const ex of routine.exercises || []) {
            if (ex.unit) ex.unit = ex.unit.toLowerCase()
          }
        }
        setRoutines(data)
        localStorage.setItem('gymtracker_routines', JSON.stringify(data))
      }

      setLastSyncTime(Date.now())
      localStorage.setItem('gymtracker_lastsync', Date.now().toString())
    } catch (e) {
      console.error('Auto-load failed:', e)
    }
  }

  // Force immediate sync to GitHub
  const forceSyncToGithub = async () => {
    if (!github.connected) return
    const currentWorkouts = JSON.parse(localStorage.getItem('gymtracker_workouts') || '{}')
    const currentNotes = JSON.parse(localStorage.getItem('gymtracker_notes') || '{}')
    await syncGymToGithub(currentWorkouts, currentNotes, true)
    setNeedsSync(false)
    // Refresh commit count after sync
    fetchCommitsToday()
  }

  // Fetch today's commit count from GitHub (count from Link header)
  const fetchCommitsToday = async () => {
    if (!github.connected || !github.token || !github.repo || !github.owner) return
    try {
      const today = new Date().toISOString().split('T')[0]
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
      // Use per_page=1 and check Link header for total count
      const res = await fetch(
        `https://api.github.com/repos/${github.owner}/${github.repo}/commits?since=${today}T00:00:00Z&until=${tomorrow}T00:00:00Z&per_page=1`,
        { headers: { Authorization: `token ${github.token}` } }
      )
      if (res.ok) {
        const link = res.headers.get('Link')
        if (link) {
          // Parse last page number from Link header
          const match = link.match(/&page=(\d+)>; rel="last"/)
          if (match) {
            setCommitsToday(parseInt(match[1]))
            return
          }
        }
        // If no Link header, count directly (less than 1 page)
        const commits = await res.json()
        setCommitsToday(commits.length)
      }
    } catch {}
  }

  const getNextRoutineType = () => {
    const dayOfWeek = new Date().getDay()
    const isRestDay = [0, 3, 6].includes(dayOfWeek)
    if (isRestDay) return 'rest'
    const sortedDates = Object.keys(workouts).sort().reverse()
    if (sortedDates.length === 0) return 'push'
    const lastGymWorkout = sortedDates.find(d => workouts[d]?.routineType !== 'rest')
    if (!lastGymWorkout) return 'push'
    return workouts[lastGymWorkout]?.routineType === 'push' ? 'pull' : 'push'
  }

  const getTodaysRoutineType = () => {
    if (workouts[date]?.routineType) return workouts[date].routineType
    return getNextRoutineType()
  }

  const routineTypes = Object.keys(routines)

  const currentRoutineType = getTodaysRoutineType()
  const currentRoutine = routines[currentRoutineType]

  const getWorkout = () => {
    if (workouts[date]) return workouts[date]
    if (currentRoutine?.isRest) {
      return {
        routineType: currentRoutineType,
        exercises: [],
        restChecks: (currentRoutine.blocks || []).flatMap(b => b.exercises).map(() => false),
        warmupChecks: [],
        completed: false
      }
    }
    return {
      routineType: currentRoutineType,
      exercises: currentRoutine.exercises.map(ex => ({
        id: ex.id,
        name: ex.name,
        warmupSets: Array(ex.warmupSets).fill().map(() => ({ weight: '', reps: '', committed: false })),
        workSets: Array(ex.workSets).fill().map(() => ({ weight: '', reps: '', committed: false })),
        notes: exerciseNotes[ex.name] || ''
      })),
      warmupChecks: (currentRoutine.warmups || []).map(() => false),
      completed: false
    }
  }

  const workout = getWorkout()
  const warmups = currentRoutine?.warmups || []
  const hasWarmups = warmups.length > 0
  // Warmup is a single page at index 0 (if any warmups exist), exercises follow
  const isOnWarmup = hasWarmups && currentExerciseIdx === 0
  const currentWarmup = null // no longer per-warmup page
  const exerciseIdx = hasWarmups ? currentExerciseIdx - 1 : currentExerciseIdx
  const currentExercise = isOnWarmup ? null : workout.exercises[exerciseIdx]
  const routineTemplate = currentExercise ? (currentRoutine?.exercises.find(e => e.id === currentExercise?.id) || currentRoutine?.exercises[exerciseIdx]) : null
  const totalItems = (hasWarmups ? 1 : 0) + workout.exercises.length

  const saveAll = (newWorkouts, newNotes, forceSync = false) => {
    localStorage.setItem('gymtracker_workouts', JSON.stringify(newWorkouts))
    localStorage.setItem('gymtracker_notes', JSON.stringify(newNotes))
    setNeedsSync(true)
    if (forceSync && github.connected) {
      syncGymToGithub(newWorkouts, newNotes, true)
    }
  }

  const saveRoutines = async (newRoutines) => {
    localStorage.setItem('gymtracker_routines', JSON.stringify(newRoutines))
    if (github.connected) await syncRoutinesToGithub(newRoutines)
  }

  const syncGymToGithub = async (newWorkouts, newNotes, force = false) => {
    if (!github.token || !github.repo || !github.owner) return
    if (!force) return // Only sync when forced

    // Only sync committed workouts to GitHub
    const committedWorkouts = Object.fromEntries(
      Object.entries(newWorkouts).filter(([, w]) => w.committed)
    )

    try {
      setSyncStatus('Checking...')
      const apiUrl = `https://api.github.com/repos/${github.owner}/${github.repo}/contents/gym.json`
      let sha = ''
      let remoteData = null

      try {
        const getRes = await fetch(apiUrl, { headers: { Authorization: `token ${github.token}` } })
        if (getRes.ok) {
          const file = await getRes.json()
          sha = file.sha
          remoteData = JSON.parse(decodeURIComponent(escape(atob(file.content))))
        }
      } catch {}

      // Compare local vs remote - only sync if different
      const localPayload = JSON.stringify({ workouts: committedWorkouts, notes: newNotes })
      const remotePayload = remoteData ? JSON.stringify({ workouts: remoteData.workouts, notes: remoteData.notes }) : null

      if (localPayload === remotePayload) {
        // No changes, skip commit
        setSyncStatus('No changes')
        setTimeout(() => setSyncStatus(''), 1500)
        setNeedsSync(false)
        return
      }

      setSyncStatus('Syncing...')
      const content = btoa(unescape(encodeURIComponent(JSON.stringify({ workouts: committedWorkouts, notes: newNotes }, null, 2))))
      await fetch(apiUrl, {
        method: 'PUT',
        headers: { Authorization: `token ${github.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `Gym ${new Date().toISOString()}`, content, ...(sha && { sha }) })
      })
      setLastSyncTime(Date.now())
      localStorage.setItem('gymtracker_lastsync', Date.now().toString())
      setNeedsSync(false)
      setSyncStatus('Synced!')
      setTimeout(() => setSyncStatus(''), 2000)
    } catch { setSyncStatus('Sync failed'); setTimeout(() => setSyncStatus(''), 3000) }
  }

  const syncRoutinesToGithub = async (newRoutines) => {
    if (!github.token || !github.repo || !github.owner) return
    try {
      const apiUrl = `https://api.github.com/repos/${github.owner}/${github.repo}/contents/routines.json`
      let sha = ''
      try {
        const getRes = await fetch(apiUrl, { headers: { Authorization: `token ${github.token}` } })
        if (getRes.ok) { const file = await getRes.json(); sha = file.sha }
      } catch {}
      const content = btoa(unescape(encodeURIComponent(JSON.stringify(newRoutines, null, 2))))
      await fetch(apiUrl, {
        method: 'PUT',
        headers: { Authorization: `token ${github.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `Routines ${new Date().toISOString()}`, content, ...(sha && { sha }) })
      })
    } catch {}
  }

  const updateSet = (type, setIdx, field, value, autoCommit = false) => {
    const newWorkout = JSON.parse(JSON.stringify(workout))
    const sets = type === 'warmup' ? newWorkout.exercises[exerciseIdx].warmupSets : newWorkout.exercises[exerciseIdx].workSets
    sets[setIdx] = { ...sets[setIdx], [field]: value }
    if (field === 'weight' && value) sets[setIdx].unit = routineTemplate?.unit || 'kg'
    if (autoCommit) sets[setIdx].committed = true
    const newWorkouts = { ...workouts, [date]: newWorkout }
    setWorkouts(newWorkouts)
    saveAll(newWorkouts, exerciseNotes)
    setActiveSetIdx({ type, idx: setIdx })
  }

  const toggleSetCommitted = (type, setIdx) => {
    const newWorkout = JSON.parse(JSON.stringify(workout))
    const sets = type === 'warmup' ? newWorkout.exercises[exerciseIdx].warmupSets : newWorkout.exercises[exerciseIdx].workSets
    const set = sets[setIdx]

    if (set.committed) {
      // Uncommit - keep values but mark as not committed
      set.committed = false
    } else {
      // Commit - use current values or previous values
      const prevSets = type === 'warmup' ? lastExerciseValues.warmupSets : lastExerciseValues.workSets
      const prevSet = prevSets[setIdx]
      if (!set.weight && prevSet?.weight) {
        set.weight = prevSet.weight
        set.unit = prevSet.unit || routineTemplate?.unit || 'kg'
      }
      if (!set.reps && prevSet?.reps) set.reps = prevSet.reps
      set.committed = true
    }
    setActiveSetIdx({ type, idx: setIdx })

    const newWorkouts = { ...workouts, [date]: newWorkout }
    setWorkouts(newWorkouts)
    saveAll(newWorkouts, exerciseNotes)
  }

  const adjustWeight = (type, setIdx, delta) => {
    const sets = type === 'warmup' ? currentExercise.warmupSets : currentExercise.workSets
    const set = sets[setIdx]
    // If current is empty, start from previous value
    const prevSets = type === 'warmup' ? lastExerciseValues.warmupSets : lastExerciseValues.workSets
    const prevWeight = prevSets[setIdx]?.weight || ''
    const currentWeight = parseFloat(set.weight) || parseFloat(prevWeight) || 0
    let newWeight

    const equipType = routineTemplate?.equipmentType || 'machine'
    const increment = routineTemplate?.increment || 5
    const startWeight = routineTemplate?.startWeight || 5

    if (equipType === 'plates') {
      // For plates, increment is total weight change
      newWeight = Math.max(0, Math.round((currentWeight + delta * increment) * 10) / 10)
    } else {
      // Machine/cable - use generated steps
      const steps = generateWeightSteps(startWeight, increment)
      const currentIdx = steps.findIndex(s => Math.abs(s - currentWeight) < 0.1)
      if (currentIdx === -1) {
        // Find closest step
        const closest = steps.reduce((a, b) => Math.abs(b - currentWeight) < Math.abs(a - currentWeight) ? b : a)
        const closestIdx = steps.indexOf(closest)
        const newIdx = Math.max(0, Math.min(steps.length - 1, closestIdx + delta))
        newWeight = steps[newIdx]
      } else {
        const newIdx = Math.max(0, Math.min(steps.length - 1, currentIdx + delta))
        newWeight = steps[newIdx]
      }
    }

    // Also fill in reps from previous if empty, and commit
    const newWorkout = JSON.parse(JSON.stringify(workout))
    const newSets = type === 'warmup' ? newWorkout.exercises[exerciseIdx].warmupSets : newWorkout.exercises[exerciseIdx].workSets
    newSets[setIdx].weight = newWeight.toString()
    newSets[setIdx].unit = routineTemplate?.unit || 'kg'
    if (!newSets[setIdx].reps && prevSets[setIdx]?.reps) {
      newSets[setIdx].reps = prevSets[setIdx].reps
    }
    newSets[setIdx].committed = true
    const newWorkouts = { ...workouts, [date]: newWorkout }
    setWorkouts(newWorkouts)
    saveAll(newWorkouts, exerciseNotes)
    setActiveSetIdx({ type, idx: setIdx })
  }

  const adjustReps = (type, setIdx, delta) => {
    const sets = type === 'warmup' ? currentExercise.warmupSets : currentExercise.workSets
    const set = sets[setIdx]
    // If current is empty, start from previous value
    const prevSets = type === 'warmup' ? lastExerciseValues.warmupSets : lastExerciseValues.workSets
    const prevReps = prevSets[setIdx]?.reps || ''
    const currentReps = parseInt(set.reps) || parseInt(prevReps) || 0
    const newReps = Math.max(0, currentReps + delta)

    // Also fill in weight from previous if empty, and commit
    const newWorkout = JSON.parse(JSON.stringify(workout))
    const newSets = type === 'warmup' ? newWorkout.exercises[exerciseIdx].warmupSets : newWorkout.exercises[exerciseIdx].workSets
    newSets[setIdx].reps = newReps.toString()
    if (!newSets[setIdx].weight && prevSets[setIdx]?.weight) {
      newSets[setIdx].weight = prevSets[setIdx].weight
      newSets[setIdx].unit = prevSets[setIdx].unit || routineTemplate?.unit || 'kg'
    }
    newSets[setIdx].committed = true
    const newWorkouts = { ...workouts, [date]: newWorkout }
    setWorkouts(newWorkouts)
    saveAll(newWorkouts, exerciseNotes)
    setActiveSetIdx({ type, idx: setIdx })
  }

  const updateExerciseNote = (note) => {
    const newWorkout = JSON.parse(JSON.stringify(workout))
    newWorkout.exercises[exerciseIdx].notes = note
    const newWorkouts = { ...workouts, [date]: newWorkout }
    setWorkouts(newWorkouts)
    const newNotes = { ...exerciseNotes, [currentExercise.name]: note }
    setExerciseNotes(newNotes)
    saveAll(newWorkouts, newNotes)
  }

  const nextExercise = () => {
    if (currentExerciseIdx < totalItems - 1) setCurrentExerciseIdx(currentExerciseIdx + 1)
  }

  const prevExercise = () => {
    if (currentExerciseIdx > 0) setCurrentExerciseIdx(currentExerciseIdx - 1)
  }

  const switchRoutine = (targetType) => {
    const newType = targetType || routineTypes[(routineTypes.indexOf(currentRoutineType) + 1) % routineTypes.length]
    if (newType === currentRoutineType) return

    const todayWorkout = workouts[date]
    if (todayWorkout) {
      const hasData = todayWorkout.exercises?.some(ex =>
        ex.warmupSets?.some(s => s.weight || s.reps) ||
        ex.workSets?.some(s => s.weight || s.reps)
      ) || todayWorkout.restChecks?.some(Boolean)
      if (hasData) {
        if (!confirm(`You have data logged today. Switching to ${routines[newType].name} will lose this data. Continue?`)) {
          return
        }
      }
    }

    const routine = routines[newType]
    const newWorkout = routine.isRest ? {
      routineType: newType,
      exercises: [],
      restChecks: (routine.blocks || []).flatMap(b => b.exercises).map(() => false),
      warmupChecks: [],
      completed: false
    } : {
      routineType: newType,
      exercises: routine.exercises.map(ex => ({
        id: ex.id,
        name: ex.name,
        warmupSets: Array(ex.warmupSets).fill().map(() => ({ weight: '', reps: '', committed: false })),
        workSets: Array(ex.workSets).fill().map(() => ({ weight: '', reps: '', committed: false })),
        notes: exerciseNotes[ex.name] || ''
      })),
      warmupChecks: (routine.warmups || []).map(() => false),
      completed: false
    }
    const newWorkouts = { ...workouts, [date]: newWorkout }
    setWorkouts(newWorkouts)
    setCurrentExerciseIdx(0)
    saveAll(newWorkouts, exerciseNotes)
  }

  const commitWorkout = () => {
    const newWorkout = JSON.parse(JSON.stringify(workout))
    newWorkout.committed = true
    const newWorkouts = { ...workouts, [date]: newWorkout }
    setWorkouts(newWorkouts)
    saveAll(newWorkouts, exerciseNotes, true)
  }

  const toggleWarmupCheck = (warmupIdx) => {
    const newWorkout = JSON.parse(JSON.stringify(workout))
    if (!Array.isArray(newWorkout.warmupChecks) || newWorkout.warmupChecks.some(v => Array.isArray(v))) {
      // Initialize or convert from old per-check format to flat boolean array
      newWorkout.warmupChecks = (currentRoutine.warmups || []).map(() => false)
    }
    newWorkout.warmupChecks[warmupIdx] = !newWorkout.warmupChecks[warmupIdx]
    const newWorkouts = { ...workouts, [date]: newWorkout }
    setWorkouts(newWorkouts)
    saveAll(newWorkouts, exerciseNotes)
  }

  const toggleRestCheck = (idx) => {
    const newWorkout = JSON.parse(JSON.stringify(workout))
    if (!newWorkout.restChecks) newWorkout.restChecks = (currentRoutine.blocks || []).flatMap(b => b.exercises).map(() => false)
    newWorkout.restChecks[idx] = !newWorkout.restChecks[idx]
    const newWorkouts = { ...workouts, [date]: newWorkout }
    setWorkouts(newWorkouts)
    saveAll(newWorkouts, exerciseNotes)
  }

  const getSessionsThisYear = () => {
    const year = new Date().getFullYear()
    return Object.keys(workouts).filter(d => d.startsWith(year) && workouts[d].committed).length
  }

  const getWeekNumber = (d) => {
    const date = new Date(d)
    const startOfYear = new Date(date.getFullYear(), 0, 1)
    const days = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000))
    return Math.ceil((days + startOfYear.getDay() + 1) / 7)
  }

  const getWeeklyStreak = (filterByPhase = false) => {
    const phase = getCurrentPhase()
    const committedWorkouts = Object.entries(workouts)
      .filter(([d, w]) => w.committed && (!filterByPhase || !phase || d >= phase.start))
      .map(([d, w]) => ({ date: d, type: w.routineType }))

    // Group by week
    const weeklyWorkouts = {}
    committedWorkouts.forEach(({ date: d, type }) => {
      const year = d.slice(0, 4)
      const week = `${year}-W${getWeekNumber(d)}`
      if (!weeklyWorkouts[week]) weeklyWorkouts[week] = { push: false, pull: false }
      if (type === 'push') weeklyWorkouts[week].push = true
      if (type === 'pull') weeklyWorkouts[week].pull = true
    })

    // Count consecutive complete weeks (both push and pull)
    const sortedWeeks = Object.keys(weeklyWorkouts).sort().reverse()
    let streak = 0

    // Start from current week
    const now = new Date()
    const currentWeek = `${now.getFullYear()}-W${getWeekNumber(now.toISOString().split('T')[0])}`

    for (let i = 0; i < sortedWeeks.length; i++) {
      const week = sortedWeeks[i]
      const data = weeklyWorkouts[week]

      // Check if this is a complete week (both push and pull)
      if (data.push && data.pull) {
        streak++
      } else if (week !== currentWeek) {
        // Allow current week to be incomplete
        break
      }
    }

    return streak
  }

  const getCurrentPhase = () => phases.find(p => !p.end)

  const getDaysSincePhaseStart = () => {
    const phase = getCurrentPhase()
    if (!phase) return 0
    const start = new Date(phase.start)
    const today = new Date()
    return Math.floor((today - start) / (1000 * 60 * 60 * 24))
  }

  const getPhaseWorkouts = () => {
    const phase = getCurrentPhase()
    if (!phase) return 0
    return Object.keys(workouts).filter(d => d >= phase.start && (!phase.end || d <= phase.end) && workouts[d].committed).length
  }

  const getLastExerciseValues = (exerciseName) => {
    // Only look at committed workouts for previous values
    const sortedDates = Object.keys(workouts).filter(d => d < date && workouts[d].committed).sort().reverse()
    for (const d of sortedDates) {
      const w = workouts[d]
      const ex = w.exercises?.find(e => e.name === exerciseName)
      if (ex) {
        return { warmupSets: ex.warmupSets || [], workSets: ex.workSets || [] }
      }
    }
    return { warmupSets: [], workSets: [] }
  }

  const getFilteredWorkouts = () => {
    if (statsFilter === 'all') {
      return Object.fromEntries(Object.entries(workouts).filter(([, w]) => w.committed))
    }

    let phase
    if (statsFilter === 'current') {
      phase = getCurrentPhase()
    } else {
      phase = phases.find(p => p.id === statsFilter)
    }

    if (phase) {
      return Object.fromEntries(
        Object.entries(workouts).filter(([d, w]) => d >= phase.start && (!phase.end || d <= phase.end) && w.committed)
      )
    }
    return Object.fromEntries(Object.entries(workouts).filter(([, w]) => w.committed))
  }

  const getExerciseProgressData = (exerciseName) => {
    const filtered = getFilteredWorkouts()
    const config = getExerciseConfig(exerciseName)
    const sortedDates = Object.keys(filtered).sort()

    const data = []
    sortedDates.forEach(d => {
      const w = filtered[d]
      const ex = w.exercises?.find(e => e.name === exerciseName)
      if (ex) {
        let maxWeight = 0
        let maxOneRM = 0
        ex.workSets?.forEach(set => {
          const weight = toKg(set.weight, set.unit || config.unit, config.kgPerUnit)
          const reps = parseInt(set.reps) || 0
          if (weight > 0 && reps > 0) {
            if (weight > maxWeight) maxWeight = weight
            const oneRM = weight * (1 + reps / 30)
            if (oneRM > maxOneRM) maxOneRM = oneRM
          }
        })
        if (maxWeight > 0) {
          data.push({ date: d, weight: Math.round(maxWeight * 10) / 10, oneRM: Math.round(maxOneRM * 10) / 10 })
        }
      }
    })
    return data
  }

  const getAllExercises = () => {
    // Include all exercises from routines + any from workout history
    const exercises = new Set()
    Object.values(routines).forEach(routine => {
      routine.exercises?.forEach(ex => exercises.add(ex.name))
    })
    const filtered = getFilteredWorkouts()
    Object.values(filtered).forEach(w => {
      w.exercises?.forEach(ex => exercises.add(ex.name))
    })
    // Sort by max weight (descending)
    return Array.from(exercises).sort((a, b) => {
      const statsA = getExerciseStats(a)
      const statsB = getExerciseStats(b)
      return statsB.maxWeight - statsA.maxWeight
    })
  }

  const getExerciseStats = (exerciseName) => {
    const filtered = getFilteredWorkouts()
    const config = getExerciseConfig(exerciseName)
    let maxWeight = 0
    let maxOneRepMax = 0
    let totalSets = 0
    let totalReps = 0

    Object.values(filtered).forEach(w => {
      const ex = w.exercises?.find(e => e.name === exerciseName)
      if (ex) {
        ex.workSets?.forEach(set => {
          const weight = toKg(set.weight, set.unit || config.unit, config.kgPerUnit)
          const reps = parseInt(set.reps) || 0
          if (weight > 0 && reps > 0) {
            totalSets++
            totalReps += reps
            if (weight > maxWeight) maxWeight = weight
            // Epley formula: 1RM = weight × (1 + reps/30)
            const oneRM = weight * (1 + reps / 30)
            if (oneRM > maxOneRepMax) maxOneRepMax = oneRM
          }
        })
      }
    })

    return { maxWeight: Math.round(maxWeight * 10) / 10, maxOneRepMax: Math.round(maxOneRepMax * 10) / 10, totalSets, totalReps }
  }

  // Get exercise config from routines
  // Fallback config for exercises no longer in routines
  const retiredExercises = {
    'Triceps Cable Pushdowns': { unit: 'lbs', equipmentType: 'cable', startWeight: 10, increment: 15 },
    'Upper Back Row (gray)': { unit: 'lbs', equipmentType: 'machine', startWeight: 30, increment: 10 },
    'Low Machine Row': { unit: 'lbs', equipmentType: 'plates', startWeight: 0, increment: 5, barWeight: 0 },
    'Reverse Grip Pushdown': { unit: 'lbs', equipmentType: 'cable', startWeight: 10, increment: 15 },
    'Seated Leg Curl': { unit: 'kg', equipmentType: 'machine', startWeight: 5, increment: 5, kgPerUnit: 5 },
    'Hip Abduction Machine': { unit: 'lbs', equipmentType: 'machine', startWeight: 20, increment: 10 },
  }

  const getExerciseConfig = (exerciseName) => {
    for (const routine of Object.values(routines)) {
      const ex = routine.exercises?.find(e => e.name === exerciseName)
      if (ex) return ex
    }
    return retiredExercises[exerciseName] || { unit: 'kg', equipmentType: 'machine', startWeight: 5, increment: 5 }
  }

  const getExercisePR = (exerciseName) => {
    // Get PR from all committed workouts before today (returns values in kg)
    let maxWeight = 0
    let maxRepsAtMaxWeight = 0
    const config = getExerciseConfig(exerciseName)

    Object.entries(workouts).forEach(([d, w]) => {
      if (d >= date || !w.committed) return // Only past committed workouts
      const ex = w.exercises?.find(e => e.name === exerciseName)
      if (ex) {
        ex.workSets?.forEach(set => {
          // Only count sets that are committed (or old data without committed flag)
          if (set.committed === false) return
          const weight = toKg(set.weight, set.unit || config.unit, config.kgPerUnit)
          const reps = parseInt(set.reps) || 0
          if (weight > 0 && reps > 0) {
            if (weight > maxWeight) {
              maxWeight = weight
              maxRepsAtMaxWeight = reps
            } else if (Math.abs(weight - maxWeight) < 0.1 && reps > maxRepsAtMaxWeight) {
              maxRepsAtMaxWeight = reps
            }
          }
        })
      }
    })

    return { maxWeight: Math.round(maxWeight * 10) / 10, maxRepsAtMaxWeight }
  }

  const getWorkoutDayStats = (workoutDate) => {
    const w = workouts[workoutDate]
    if (!w) return null

    let totalWeight = 0
    let totalSets = 0
    let totalReps = 0

    w.exercises?.forEach(ex => {
      const config = getExerciseConfig(ex.name)
      ;[...(ex.warmupSets || []), ...(ex.workSets || [])].forEach(set => {
        const weight = toKg(set.weight, set.unit || config.unit, config.kgPerUnit)
        const reps = parseInt(set.reps) || 0
        if (weight > 0 && reps > 0) {
          totalWeight += weight * reps
          totalSets++
          totalReps += reps
        }
      })
    })

    return {
      routineType: w.routineType,
      totalWeight: Math.round(totalWeight),
      totalSets,
      totalReps,
      exercises: w.exercises?.length || 0
    }
  }

  const getWorkoutDayExerciseDetails = (workoutDate) => {
    const w = workouts[workoutDate]
    if (!w) return []

    return w.exercises?.map(ex => {
      const config = getExerciseConfig(ex.name)
      // Get PR before this workout date (in kg)
      let maxWeightBefore = 0
      let maxRepsAtMaxBefore = 0
      Object.entries(workouts).forEach(([d, workout]) => {
        if (d >= workoutDate || !workout.committed) return
        const prevEx = workout.exercises?.find(e => e.name === ex.name)
        if (prevEx) {
          prevEx.workSets?.forEach(set => {
            if (set.committed === false) return
            const weight = toKg(set.weight, set.unit || config.unit, config.kgPerUnit)
            const reps = parseInt(set.reps) || 0
            if (weight > maxWeightBefore) {
              maxWeightBefore = weight
              maxRepsAtMaxBefore = reps
            } else if (Math.abs(weight - maxWeightBefore) < 0.1 && reps > maxRepsAtMaxBefore) {
              maxRepsAtMaxBefore = reps
            }
          })
        }
      })

      // Get best set from this workout (in kg)
      let bestWeight = 0
      let bestReps = 0
      let totalVolume = 0
      ex.workSets?.forEach(set => {
        if (set.committed === false) return
        const weight = toKg(set.weight, set.unit || config.unit, config.kgPerUnit)
        const reps = parseInt(set.reps) || 0
        if (weight > 0 && reps > 0) {
          totalVolume += weight * reps
          if (weight > bestWeight || (Math.abs(weight - bestWeight) < 0.1 && reps > bestReps)) {
            bestWeight = weight
            bestReps = reps
          }
        }
      })

      const isWeightPR = bestWeight > maxWeightBefore
      const isRepPR = Math.abs(bestWeight - maxWeightBefore) < 0.1 && bestReps > maxRepsAtMaxBefore && maxWeightBefore > 0

      return {
        name: ex.name,
        bestWeight: Math.round(bestWeight * 10) / 10,
        bestReps,
        totalVolume: Math.round(totalVolume),
        isWeightPR,
        isRepPR
      }
    }).filter(ex => ex.bestWeight > 0) || []
  }

  const getSessionVolume = (w) => {
    let total = 0
    let setCount = 0
    w.exercises?.forEach(ex => {
      const cfg = getExerciseConfig(ex.name)
      ex.workSets?.forEach(s => {
        if (s.committed === false) return
        const wt = toKg(s.weight, cfg.unit, cfg.kgPerUnit)
        const r = parseInt(s.reps) || 0
        if (wt > 0 && r > 0) { total += wt * r; setCount++ }
      })
    })
    return { volume: total, sets: setCount }
  }

  const getWeeklyVolume = () => {
    const filtered = getFilteredWorkouts()
    const map = {}
    Object.entries(filtered).forEach(([date, w]) => {
      if (w.routineType === 'rest') return
      const d = new Date(date)
      const day = (d.getDay() + 6) % 7
      d.setDate(d.getDate() - day)
      const wk = d.toISOString().slice(0, 10)
      if (!map[wk]) map[wk] = { week: wk, push: 0, pull: 0 }
      const { volume } = getSessionVolume(w)
      if (w.routineType === 'push') map[wk].push += volume
      else if (w.routineType === 'pull') map[wk].pull += volume
    })
    return Object.values(map).sort((a, b) => a.week.localeCompare(b.week))
  }

  const buildExerciseIndex = () => {
    const filtered = getFilteredWorkouts()
    const idx = {}
    Object.entries(filtered).sort(([a], [b]) => a.localeCompare(b)).forEach(([date, w]) => {
      if (w.routineType === 'rest') return
      w.exercises?.forEach(ex => {
        const cfg = getExerciseConfig(ex.name)
        const workSets = (ex.workSets || []).filter(s => s.committed !== false).map(s => {
          const wKg = toKg(s.weight, cfg.unit, cfg.kgPerUnit)
          const reps = parseInt(s.reps) || 0
          return { weight: s.weight, weightKg: wKg, reps, unit: s.unit || cfg.unit, e1RM: wKg > 0 && reps > 0 ? wKg * (1 + reps / 30) : 0 }
        })
        const valid = workSets.filter(s => s.weightKg > 0 && s.reps > 0)
        if (!valid.length) return
        const topSet = valid.reduce((b, s) => !b || s.weightKg > b.weightKg ? s : b, null)
        const e1RM = valid.reduce((m, s) => Math.max(m, s.e1RM), 0)
        const volume = valid.reduce((s, x) => s + x.weightKg * x.reps, 0)
        if (!idx[ex.name]) idx[ex.name] = { name: ex.name, sessions: [] }
        idx[ex.name].sessions.push({ date, topSet, e1RM, volume, workSets, notes: ex.notes || '' })
      })
    })
    const now = new Date()
    Object.values(idx).forEach(e => {
      e.maxWeight = Math.max(...e.sessions.map(s => s.topSet.weightKg))
      e.maxE1RM = Math.max(...e.sessions.map(s => s.e1RM))
      e.totalVolume = e.sessions.reduce((s, x) => s + x.volume, 0)
      e.totalSets = e.sessions.reduce((s, x) => s + x.workSets.length, 0)
      e.totalReps = e.sessions.reduce((s, x) => s + x.workSets.reduce((a, b) => a + b.reps, 0), 0)
      e.lastDate = e.sessions[e.sessions.length - 1].date
      e.daysSince = Math.floor((now - new Date(e.lastDate)) / 86400000)
      const last = e.sessions.slice(-4)
      if (last.length >= 2) {
        const xs = last.map((_, i) => i)
        const ys = last.map(s => s.e1RM)
        const mx = xs.reduce((a, b) => a + b, 0) / xs.length
        const my = ys.reduce((a, b) => a + b, 0) / ys.length
        let num = 0, den = 0
        for (let i = 0; i < xs.length; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2 }
        e.slope = den ? num / den : 0
      } else { e.slope = 0 }
      if (e.sessions.length >= 4) {
        const cutE1 = Math.max(...e.sessions.slice(0, -3).map(s => s.e1RM))
        const recentMax = Math.max(...e.sessions.slice(-3).map(s => s.e1RM))
        e.stalled = recentMax <= cutE1 + 0.1
      } else { e.stalled = false }
    })
    return idx
  }

  const detectPRsInRange = () => {
    const filtered = getFilteredWorkouts()
    const sorted = Object.entries(filtered).sort(([a], [b]) => a.localeCompare(b))
    const best = {}
    const prs = []
    sorted.forEach(([date, w]) => {
      if (w.routineType === 'rest') return
      w.exercises?.forEach(ex => {
        const cfg = getExerciseConfig(ex.name)
        let topW = 0, topR = 0, e1RM = 0
        ex.workSets?.forEach(s => {
          if (s.committed === false) return
          const wt = toKg(s.weight, cfg.unit, cfg.kgPerUnit)
          const r = parseInt(s.reps) || 0
          if (wt > 0 && r > 0) {
            if (wt > topW) { topW = wt; topR = r }
            const e = wt * (1 + r / 30)
            if (e > e1RM) e1RM = e
          }
        })
        if (e1RM === 0) return
        const cur = best[ex.name] || 0
        if (e1RM > cur + 0.1) {
          if (cur > 0) prs.push({ date, name: ex.name, weight: topW, reps: topR, e1RM })
          best[ex.name] = e1RM
        } else { best[ex.name] = Math.max(cur, e1RM) }
      })
    })
    return prs
  }

  const getCadenceCells = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dow = (today.getDay() + 6) % 7
    const end = new Date(today); end.setDate(end.getDate() - dow + 6)
    const start = new Date(end); start.setDate(start.getDate() - (12 * 7 - 1))
    const cols = []
    let maxVol = 1
    Object.entries(workouts).forEach(([d, w]) => {
      if (w.committed && w.routineType !== 'rest') maxVol = Math.max(maxVol, getSessionVolume(w).volume)
    })
    let lastMonth = -1
    for (let w = 0; w < 12; w++) {
      const colStart = new Date(start); colStart.setDate(colStart.getDate() + w * 7)
      let monthLabel = ''
      if (colStart.getMonth() !== lastMonth) {
        monthLabel = colStart.toLocaleDateString('en', { month: 'short' })
        lastMonth = colStart.getMonth()
      }
      const days = []
      for (let d = 0; d < 7; d++) {
        const day = new Date(start); day.setDate(day.getDate() + w * 7 + d)
        const ds = day.toISOString().slice(0, 10)
        const wk = workouts[ds]
        if (wk?.committed) {
          if (wk.routineType === 'rest') days.push({ ds, type: 'rest', level: 0 })
          else {
            const vol = getSessionVolume(wk).volume
            const lvl = Math.min(4, Math.max(1, Math.ceil((vol / maxVol) * 4)))
            days.push({ ds, type: wk.routineType, level: lvl, volume: vol })
          }
        } else {
          days.push({ ds, type: null, level: 0 })
        }
      }
      cols.push({ monthLabel, days })
    }
    return cols
  }

  const getCalendarDays = () => {
    const year = calendarMonth.getFullYear()
    const month = calendarMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const days = []

    // Add empty cells for days before first day of month (Monday = 0)
    const startDay = (firstDay.getDay() + 6) % 7
    for (let i = 0; i < startDay; i++) {
      days.push(null)
    }

    // Add all days of month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      days.push({
        day: d,
        date: dateStr,
        hasWorkout: workouts[dateStr]?.committed,
        routineType: workouts[dateStr]?.routineType,
      })
    }

    return days
  }

  const lastExerciseValues = currentExercise ? getLastExerciseValues(currentExercise.name) : { warmupSets: [], workSets: [] }

  const openAddExercise = (routineKey) => {
    setEditModal({ type: 'exercise', routineKey, exercise: { name: '', warmupSets: 1, workSets: 2, reps: '8', unit: 'kg', equipmentType: 'machine', startWeight: 5, increment: 5 }, isNew: true })
  }

  const openEditExercise = (routineKey, exerciseId) => {
    const exercise = routines[routineKey].exercises.find(e => e.id === exerciseId)
    setEditModal({ type: 'exercise', routineKey, exercise: { ...exercise }, isNew: false })
  }

  // Sync current workout with routine template (when routine changes)
  const syncWorkoutWithRoutine = (newRoutines, routineKey) => {
    if (currentRoutineType !== routineKey) return // Only sync if it's today's routine
    if (!workouts[date]) return // No workout to sync

    const template = newRoutines[routineKey]
    const newWorkout = JSON.parse(JSON.stringify(workouts[date]))

    // Build new exercises list based on template order
    const newExercises = template.exercises.map(templateEx => {
      const existing = newWorkout.exercises.find(e => e.id === templateEx.id || e.name === templateEx.name)
      if (existing) {
        // Preserve data but adjust set counts
        const warmupSets = [...existing.warmupSets]
        const workSets = [...existing.workSets]
        // Add/remove sets to match template
        while (warmupSets.length < templateEx.warmupSets) warmupSets.push({ weight: '', reps: '', committed: false })
        while (warmupSets.length > templateEx.warmupSets) warmupSets.pop()
        while (workSets.length < templateEx.workSets) workSets.push({ weight: '', reps: '', committed: false })
        while (workSets.length > templateEx.workSets) workSets.pop()
        return { ...existing, id: templateEx.id, name: templateEx.name, warmupSets, workSets }
      } else {
        // New exercise
        return {
          id: templateEx.id,
          name: templateEx.name,
          warmupSets: Array(templateEx.warmupSets).fill().map(() => ({ weight: '', reps: '', committed: false })),
          workSets: Array(templateEx.workSets).fill().map(() => ({ weight: '', reps: '', committed: false })),
          notes: exerciseNotes[templateEx.name] || ''
        }
      }
    })

    newWorkout.exercises = newExercises
    const newWorkouts = { ...workouts, [date]: newWorkout }
    setWorkouts(newWorkouts)
    saveAll(newWorkouts, exerciseNotes)
  }

  const saveExerciseModal = () => {
    const { routineKey, exercise, isNew } = editModal
    const newRoutines = JSON.parse(JSON.stringify(routines))
    if (isNew) {
      const newId = Math.max(...newRoutines[routineKey].exercises.map(e => e.id), 0) + 1
      newRoutines[routineKey].exercises.push({ ...exercise, id: newId })
    } else {
      const idx = newRoutines[routineKey].exercises.findIndex(e => e.id === exercise.id)
      newRoutines[routineKey].exercises[idx] = exercise
    }
    setRoutines(newRoutines)
    saveRoutines(newRoutines)
    syncWorkoutWithRoutine(newRoutines, routineKey)
    setEditModal(null)
  }

  const deleteExercise = (routineKey, exerciseId) => {
    const newRoutines = JSON.parse(JSON.stringify(routines))
    newRoutines[routineKey].exercises = newRoutines[routineKey].exercises.filter(e => e.id !== exerciseId)
    setRoutines(newRoutines)
    saveRoutines(newRoutines)
    syncWorkoutWithRoutine(newRoutines, routineKey)
  }

  const moveExercise = (routineKey, exerciseId, direction) => {
    const newRoutines = JSON.parse(JSON.stringify(routines))
    const exercises = newRoutines[routineKey].exercises
    const idx = exercises.findIndex(e => e.id === exerciseId)
    if ((direction === -1 && idx > 0) || (direction === 1 && idx < exercises.length - 1)) {
      [exercises[idx], exercises[idx + direction]] = [exercises[idx + direction], exercises[idx]]
      setRoutines(newRoutines)
      saveRoutines(newRoutines)
      syncWorkoutWithRoutine(newRoutines, routineKey)
    }
  }

  const handleDragStart = (routineKey, exerciseId) => {
    setDragState({ routineKey, exerciseId })
  }

  const handleDragOver = (e, routineKey, targetId) => {
    e.preventDefault()
    if (!dragState || dragState.routineKey !== routineKey || dragState.exerciseId === targetId) return

    const newRoutines = JSON.parse(JSON.stringify(routines))
    const exercises = newRoutines[routineKey].exercises
    const fromIdx = exercises.findIndex(e => e.id === dragState.exerciseId)
    const toIdx = exercises.findIndex(e => e.id === targetId)

    if (fromIdx !== -1 && toIdx !== -1) {
      const [moved] = exercises.splice(fromIdx, 1)
      exercises.splice(toIdx, 0, moved)
      setRoutines(newRoutines)
      setDragState({ ...dragState, exerciseId: dragState.exerciseId })
    }
  }

  const handleDragEnd = () => {
    if (dragState) {
      saveRoutines(routines)
      syncWorkoutWithRoutine(routines, dragState.routineKey)
    }
    setDragState(null)
  }

  const handleTouchStart = (e, routineKey, exerciseId) => {
    const startY = e.touches[0].clientY
    touchTimeout.current = setTimeout(() => {
      setTouchDrag({ routineKey, exerciseId, active: true })
      navigator.vibrate?.(100)
    }, 1000)
    // Store start position to detect scrolling
    touchTimeout.startY = startY
  }

  const handleTouchMove = (e, routineKey) => {
    // If drag mode not active yet, check if user is scrolling
    if (!touchDrag?.active) {
      const deltaY = Math.abs(e.touches[0].clientY - touchTimeout.startY)
      if (deltaY > 10) {
        // User is scrolling, cancel the long press
        clearTimeout(touchTimeout.current)
      }
      return
    }

    // Drag mode is active
    e.preventDefault()
    const touch = e.touches[0]
    const elements = document.elementsFromPoint(touch.clientX, touch.clientY)
    const targetItem = elements.find(el => el.classList.contains('exercise-item'))

    if (targetItem) {
      const targetId = parseInt(targetItem.dataset.id)
      if (targetId && targetId !== touchDrag.exerciseId) {
        const newRoutines = JSON.parse(JSON.stringify(routines))
        const exercises = newRoutines[routineKey].exercises
        const fromIdx = exercises.findIndex(ex => ex.id === touchDrag.exerciseId)
        const toIdx = exercises.findIndex(ex => ex.id === targetId)

        if (fromIdx !== -1 && toIdx !== -1) {
          const [moved] = exercises.splice(fromIdx, 1)
          exercises.splice(toIdx, 0, moved)
          setRoutines(newRoutines)
        }
      }
    }
  }

  const handleTouchEnd = () => {
    clearTimeout(touchTimeout.current)
    if (touchDrag?.active) {
      saveRoutines(routines)
      syncWorkoutWithRoutine(routines, touchDrag.routineKey)
    }
    setTouchDrag(null)
  }

  const handleTouchCancel = () => {
    clearTimeout(touchTimeout.current)
    setTouchDrag(null)
  }

  const connectGithub = () => {
    const newGithub = { ...github, connected: true }
    setGithub(newGithub)
    localStorage.setItem('gymtracker_github', JSON.stringify(newGithub))
  }

  const disconnectGithub = () => {
    setGithub({ token: '', repo: '', owner: '', connected: false })
    localStorage.setItem('gymtracker_github', JSON.stringify({ token: '', repo: '', owner: '', connected: false }))
  }

  const getLastExerciseData = (exerciseName) => {
    const sortedDates = Object.keys(workouts).filter(d => d < date && workouts[d].committed).sort().reverse()
    for (const d of sortedDates) {
      const w = workouts[d]
      const ex = w.exercises?.find(e => e.name === exerciseName)
      if (ex) {
        const lastWorkSet = ex.workSets?.filter(s => s.weight)?.pop()
        if (lastWorkSet) return lastWorkSet
      }
    }
    return null
  }

  const lastData = currentExercise ? getLastExerciseData(currentExercise.name) : null

  // Check if a specific set beats the PR (comparing in kg, rounded to match PR precision)
  const isSetPR = (exerciseName, weight, reps) => {
    const pr = getExercisePR(exerciseName)
    const config = getExerciseConfig(exerciseName)
    const w = Math.round(toKg(weight, config.unit, config.kgPerUnit) * 10) / 10
    const r = parseInt(reps) || 0
    if (w <= 0 || r <= 0) return { isWeightPR: false, isRepPR: false }
    const isWeightPR = w > pr.maxWeight
    const isRepPR = !isWeightPR && w === pr.maxWeight && r > pr.maxRepsAtMaxWeight
    return { isWeightPR, isRepPR }
  }

  const renderSetRow = (set, idx, type, label) => {
    const prevSet = type === 'work' ? lastExerciseValues.workSets[idx] : lastExerciseValues.warmupSets[idx]
    const prevWeight = prevSet?.weight || ''
    const prevReps = prevSet?.reps || ''
    const goalRepsRaw = routineTemplate?.reps || ''
    const goalReps = goalRepsRaw.split('-')[0] || ''
    const unit = routineTemplate?.unit || 'kg'

    // Has actual values entered today
    const hasValues = set.weight || set.reps

    // Committed: explicitly true, OR has values (backward compat with old data)
    const isCommitted = set.committed === true || (hasValues && set.committed !== false)

    // PR status (only for committed work sets with values)
    const prStatus = type === 'work' && isCommitted && set.weight && set.reps
      ? isSetPR(currentExercise.name, set.weight, set.reps)
      : { isWeightPR: false, isRepPR: false }

    return (
      <div key={`${type}${idx}`} className={`set-row ${type === 'work' ? 'work' : ''} ${isCommitted ? 'committed' : 'uncommitted'} ${prStatus.isWeightPR ? 'weight-pr' : ''} ${prStatus.isRepPR ? 'rep-pr' : ''}`}>
        <div className="set-controls">
          <div className="set-field">
            <button className="adj-btn" onClick={() => adjustWeight(type, idx, -1)}>−</button>
            <input
              type="text"
              inputMode="decimal"
              value={set.weight}
              placeholder={prevWeight || unit}
              onChange={(e) => updateSet(type, idx, 'weight', e.target.value)}
            />
            <button className="adj-btn" onClick={() => adjustWeight(type, idx, 1)}>+</button>
          </div>
          <span
            className="set-label clickable"
            onClick={() => toggleSetCommitted(type, idx)}
          >
            {label}{prStatus.isWeightPR && '⭐'}{prStatus.isRepPR && '✓'}
          </span>
          <div className="set-field reps">
            <button className="adj-btn" onClick={() => adjustReps(type, idx, -1)}>−</button>
            <input
              type="text"
              inputMode="numeric"
              value={set.reps}
              placeholder={prevReps || goalReps || '-'}
              onChange={(e) => updateSet(type, idx, 'reps', e.target.value)}
            />
            <button className="adj-btn" onClick={() => adjustReps(type, idx, 1)}>+</button>
          </div>
        </div>
      </div>
    )
  }

  const isLastExercise = currentExerciseIdx === totalItems - 1

  return (
    <div className="app">
      <div style={{position:'fixed',top:0,left:0,right:0,zIndex:9999,background:'red',color:'#fff',padding:4,fontSize:10,pointerEvents:'none',fontFamily:'monospace'}}>
        v0.3.5 sa:{String(window.navigator.standalone)} iH:{window.innerHeight} cH:{document.documentElement.clientHeight} sH:{window.screen.height}
        {' '}sab:{getComputedStyle(document.documentElement).getPropertyValue('--sab') || 'n/a'}
      </div>
      <main className="content" key={tab}>
        {tab === 'log' && currentRoutine?.isRest && (
          <div className="log-page rest-log">
            <div className="rest-header">
              <h2>Rest Day — Home Rehab</h2>
              <span className="rest-schedule">{currentRoutine.schedule} · ~28 min · Barefoot</span>
            </div>
            {currentRoutine.blocks?.map((block, blockIdx) => {
              const blockStartIdx = currentRoutine.blocks.slice(0, blockIdx).reduce((sum, b) => sum + b.exercises.length, 0)
              return (
                <div key={block.name} className="rest-block">
                  <div className="rest-block-header">
                    <span>{block.icon} {block.name}</span>
                    <span className="rest-block-duration">{block.duration}</span>
                  </div>
                  {block.exercises.map((ex, exIdx) => {
                    const globalIdx = blockStartIdx + exIdx
                    const checked = workout.restChecks?.[globalIdx] || false
                    return (
                      <div key={ex.id} className={`rest-exercise ${checked ? 'checked' : ''}`} onClick={() => toggleRestCheck(globalIdx)}>
                        <div className="rest-check">{checked ? '✓' : ''}</div>
                        <div className="rest-exercise-info">
                          <div className="rest-exercise-name">{ex.name}</div>
                          <div className="rest-exercise-detail">{ex.sets}×{ex.reps}</div>
                          {ex.notes && <div className="rest-exercise-notes">{ex.notes}</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
            <button className={`commit-rest-btn ${workout.committed ? 'committed' : ''}`} onClick={commitWorkout}>
              {workout.committed ? 'Done ✓' : 'Mark Complete'}
            </button>
          </div>
        )}

        {tab === 'log' && !currentRoutine?.isRest && (isOnWarmup || currentExercise) && (
          <div className="log-page">
            <div className="exercise-nav">
              <button onClick={prevExercise} disabled={currentExerciseIdx === 0}>&lt;</button>
              <div className="exercise-info-center">
                <h2 className="exercise-name">{isOnWarmup ? 'Warm-up' : currentExercise.name}</h2>
                <span className="exercise-count">
                  {isOnWarmup ? '' : `${exerciseIdx + 1} / ${workout.exercises.length}`}
                  {!isOnWarmup && routineTemplate?.reps && ` · ${routineTemplate.reps} reps`}
                  {!isOnWarmup && workout.committed && ' ✓'}
                </span>
              </div>
              {isLastExercise ? (
                <button className={`commit-btn ${workout.committed ? 'committed' : ''}`} onClick={commitWorkout}>
                  {workout.committed ? '✓' : 'Save'}
                </button>
              ) : (
                <button onClick={nextExercise}>&gt;</button>
              )}
            </div>

            {isOnWarmup ? (
              <div className="warmup-all">
                {warmups.map((wu, wuIdx) => {
                  const isChecked = workout.warmupChecks?.[wuIdx] === true
                  const desc = [
                    wu.checks?.join(', '),
                    wu.notes
                  ].filter(Boolean).join(' · ')
                  return (
                    <div
                      key={wu.id}
                      className={`warmup-block ${isChecked ? 'checked' : ''}`}
                      onClick={() => toggleWarmupCheck(wuIdx)}
                    >
                      <div className="warmup-check-box">{isChecked ? '✓' : ''}</div>
                      <div className="warmup-block-info">
                        <div className="warmup-block-header">
                          <span className="warmup-block-name">{wu.name}</span>
                          <span className="warmup-block-reps">{wu.reps}</span>
                        </div>
                        {desc && <div className="warmup-block-notes">{desc}</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <>
                {(() => {
                  const pr = getExercisePR(currentExercise.name)
                  const unit = routineTemplate?.unit || 'kg'
                  const kgPerUnit = routineTemplate?.kgPerUnit
                  let bestWeightNative = 0, bestReps = 0
                  currentExercise.workSets?.forEach(set => {
                    const hasValues = set.weight || set.reps
                    const isCommitted = set.committed === true || (hasValues && set.committed !== false)
                    if (!isCommitted) return
                    const w = parseFloat(set.weight) || 0
                    const r = parseInt(set.reps) || 0
                    if (w > 0 && r > 0 && (w > bestWeightNative || (w === bestWeightNative && r > bestReps))) {
                      bestWeightNative = w
                      bestReps = r
                    }
                  })
                  const bestWeightKg = Math.round(toKg(bestWeightNative, unit, kgPerUnit) * 10) / 10
                  const isWeightPR = bestWeightKg > pr.maxWeight
                  const isRepPR = !isWeightPR && bestWeightKg === pr.maxWeight && bestReps > pr.maxRepsAtMaxWeight
                  const lastDataKg = lastData ? toKg(lastData.weight, unit, kgPerUnit) : 0

                  if (pr.maxWeight > 0 || isWeightPR || isRepPR) {
                    return (
                      <div className={`pr-info ${isWeightPR ? 'new-weight-pr' : ''} ${isRepPR ? 'new-rep-pr' : ''}`}>
                        <span className="pr-label">{isWeightPR || isRepPR ? 'NEW PR!' : 'PR'}</span>
                        <span className="pr-value">{pr.maxWeight}kg × {pr.maxRepsAtMaxWeight}</span>
                        {lastData && <span className="last-value">Last: {lastData.weight}{unit} {unit !== 'kg' ? `(${lastDataKg}kg)` : ''} × {lastData.reps}</span>}
                      </div>
                    )
                  } else if (lastData) {
                    return <div className="last-workout">Last: {lastData.weight}{unit} {unit !== 'kg' ? `(${lastDataKg}kg)` : ''} × {lastData.reps}</div>
                  }
                  return null
                })()}

                {routineTemplate?.templateNotes && (
                  <div className="template-notes">{routineTemplate.templateNotes}</div>
                )}

                <div className="sets-section">
                  {currentExercise.warmupSets.length > 0 && (
                    <>
                      <div className="sets-label">Warm-up</div>
                      {currentExercise.warmupSets.map((set, idx) => renderSetRow(set, idx, 'warmup', `W${idx + 1}`))}
                    </>
                  )}

                  <div className="sets-label">Working Sets</div>
                  {currentExercise.workSets.map((set, idx) => renderSetRow(set, idx, 'work', `${idx + 1}`))}
                </div>

                <div className="bottom-section">
                  {(() => {
                    const sets = activeSetIdx.type === 'warmup' ? currentExercise.warmupSets : currentExercise.workSets
                    const activeSet = sets?.[activeSetIdx.idx] || currentExercise.workSets?.[0]
                    const weight = parseFloat(activeSet?.weight) || 0

                    const weightType = routineTemplate?.weightType
                    const isPlates = routineTemplate?.equipmentType === 'plates' ||
                      weightType === 'plates-kg' || weightType === 'plates-lbs'
                    const unit = routineTemplate?.unit ||
                      (weightType === 'plates-lbs' ? 'lbs' : 'kg')
                    const kgPerUnit = routineTemplate?.kgPerUnit
                    const kgWeight = toKg(weight, unit, kgPerUnit)

                    let detail = null
                    if (isPlates && weight > 0) {
                      const defaultBar = unit === 'lbs' ? 45 : 20
                      const barWeight = routineTemplate?.barWeight ?? defaultBar
                      const plates = getPlatesPerSide(weight, barWeight, unit)
                      detail = `${formatPlates(plates)}/side`
                    }

                    return (
                      <div className="weight-info">
                        <span className="weight-kg">{weight > 0 ? `${Math.round(kgWeight * 10) / 10}kg` : '-'}</span>
                        {detail && <span className="weight-detail">{detail}</span>}
                      </div>
                    )
                  })()}

                  <div className="notes-section">
                    <input
                      type="text"
                      value={currentExercise.notes || ''}
                      onChange={(e) => updateExerciseNote(e.target.value)}
                      placeholder={routineTemplate?.templateNotes || '+ Add note'}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'stats' && (() => {
          const exIdx = buildExerciseIndex()
          const prs = detectPRsInRange()
          const filtered = getFilteredWorkouts()
          const filteredEntries = Object.entries(filtered)
          const workSessions = filteredEntries.filter(([, w]) => w.routineType !== 'rest')
          const totalVolume = workSessions.reduce((s, [, w]) => s + getSessionVolume(w).volume, 0)
          const weekly = getWeeklyVolume()
          const cadence = getCadenceCells()

          let pushAgg = 0, pullAgg = 0
          workSessions.forEach(([, w]) => {
            const v = getSessionVolume(w)
            const amt = balanceMode === 'volume' ? v.volume : v.sets
            if (w.routineType === 'push') pushAgg += amt
            else if (w.routineType === 'pull') pullAgg += amt
          })
          const balTotal = pushAgg + pullAgg || 1
          const pushPct = pushAgg / balTotal * 100
          const pullPct = pullAgg / balTotal * 100

          const exList = Object.values(exIdx)
          const upEx = [...exList].filter(e => e.slope > 0.1).sort((a, b) => b.slope - a.slope).slice(0, 4)
          const stallEx = [...exList].filter(e => e.stalled).sort((a, b) => a.slope - b.slope).slice(0, 4)

          const sortedExList = [...exList]
          if (exSort === 'alpha') sortedExList.sort((a, b) => a.name.localeCompare(b.name))
          else if (exSort === 'recent') sortedExList.sort((a, b) => b.lastDate.localeCompare(a.lastDate))
          else if (exSort === 'trend') sortedExList.sort((a, b) => b.slope - a.slope)
          else if (exSort === 'volume') sortedExList.sort((a, b) => b.totalVolume - a.totalVolume)

          const fmtKgVal = v => v >= 1000 ? (v / 1000).toFixed(1) + 'k' : Math.round(v).toString()
          const fmtMD = d => { const [, m, da] = d.split('-'); return `${m}/${da}` }

          const histSessions = filteredEntries
            .filter(([, w]) => histFilter === 'all' || w.routineType === histFilter)
            .sort(([a], [b]) => b.localeCompare(a))
          const histGroups = {}
          histSessions.forEach(([d, w]) => {
            const dt = new Date(d); const day = (dt.getDay() + 6) % 7
            dt.setDate(dt.getDate() - day)
            const wk = dt.toISOString().slice(0, 10)
            if (!histGroups[wk]) histGroups[wk] = []
            histGroups[wk].push([d, w])
          })
          const prSet = new Set(); prs.forEach(p => prSet.add(p.date + '|' + p.name))

          const periodLabel = statsFilter === 'all' ? 'All Time' :
            statsFilter === 'current' ? (getCurrentPhase()?.name || 'All Time') :
            phases.find(p => p.id === statsFilter)?.name || 'All Time'

          return (
            <div className="stats-page">
              <div className="stats-filter">
                <select value={statsFilter} onChange={(e) => setStatsFilter(e.target.value)}>
                  {getCurrentPhase() && <option value="current">{getCurrentPhase().name} (current)</option>}
                  {phases.filter(p => p.end).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                  <option value="all">All Time</option>
                </select>
              </div>

              <div className="stats-subtabs">
                <button className={statsTab === 'overview' ? 'active' : ''} onClick={() => setStatsTab('overview')}>Overview</button>
                <button className={statsTab === 'exercises' ? 'active' : ''} onClick={() => setStatsTab('exercises')}>Exercises</button>
                <button className={statsTab === 'history' ? 'active' : ''} onClick={() => setStatsTab('history')}>History</button>
              </div>

              {statsTab === 'overview' && (
                <>
                  <div className="hero-quad">
                    <div className="hero-card"><div className="v">{workSessions.length}</div><div className="l">Sessions</div></div>
                    <div className="hero-card streak"><div className="v">{getWeeklyStreak(true)}</div><div className="l">Week Streak</div></div>
                    <div className="hero-card"><div className="v">{fmtKgVal(totalVolume)} kg</div><div className="l">Volume</div></div>
                    <div className="hero-card pr"><div className="v">{prs.length}</div><div className="l">PRs</div></div>
                  </div>

                  <div className="stats-block">
                    <h4>Weekly Volume</h4>
                    {weekly.length >= 1 ? (
                      <div className="chart-host" style={{ height: 180 }}>
                        <Bar
                          data={{
                            labels: weekly.map(w => fmtMD(w.week)),
                            datasets: [
                              { label: 'Push', data: weekly.map(w => Math.round(w.push)), backgroundColor: '#89b4fa', stack: 'v', borderRadius: 4 },
                              { label: 'Pull', data: weekly.map(w => Math.round(w.pull)), backgroundColor: '#cba6f7', stack: 'v', borderRadius: 4 },
                            ]
                          }}
                          options={{
                            responsive: true, maintainAspectRatio: false,
                            plugins: { legend: { position: 'bottom', labels: { color: '#a6adc8', boxWidth: 10, font: { size: 10 } } } },
                            scales: {
                              x: { stacked: true, ticks: { color: '#6c7086', font: { size: 9 } }, grid: { display: false } },
                              y: { stacked: true, ticks: { color: '#6c7086', font: { size: 9 }, callback: v => fmtKgVal(v) }, grid: { color: '#313244' } }
                            }
                          }}
                        />
                      </div>
                    ) : <div className="empty-msg">No data</div>}
                  </div>

                  <div className="stats-block">
                    <h4>Cadence <span className="sub">12wk · 1col=1wk Mon→Sun</span></h4>
                    <div className="heatmap-wrap">
                      <div className="heatmap-months">
                        <span></span>
                        {cadence.map((c, i) => <span key={i}>{c.monthLabel}</span>)}
                      </div>
                      <div className="heatmap-body">
                        <div className="heatmap-days">
                          <span>M</span><span></span><span>W</span><span></span><span>F</span><span></span><span>S</span>
                        </div>
                        <div className="heatmap-grid">
                          {cadence.map((c, ci) => (
                            <div className="heatmap-col" key={ci}>
                              {c.days.map((d, di) => (
                                <div
                                  key={di}
                                  className={`heatmap-cell ${d.type === 'rest' ? 'rest' : d.level ? 'l' + d.level : ''} ${d.ds === date ? 'today' : ''}`}
                                  onClick={() => d.type && setSelectedWorkoutDay(d.ds)}
                                  title={d.ds + (d.type ? ` · ${d.type}` : '')}
                                />
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="heatmap-legend">
                      <div className="grad">
                        <span>Less</span>
                        <span className="sw" />
                        <span className="sw l1" />
                        <span className="sw l2" />
                        <span className="sw l3" />
                        <span className="sw l4" />
                        <span>More</span>
                      </div>
                      <div><span className="sw rest" /> Rehab</div>
                    </div>
                  </div>

                  <div className="calendar-section">
                    <div className="calendar-header">
                      <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))}>&lt;</button>
                      <span>{calendarMonth.toLocaleDateString('en', { month: 'long', year: 'numeric' })}</span>
                      <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))}>&gt;</button>
                    </div>
                    <div className="calendar-weekdays">
                      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i}>{d}</span>)}
                    </div>
                    <div className="calendar-grid">
                      {getCalendarDays().map((day, i) => (
                        <div
                          key={i}
                          className={`calendar-day ${day?.hasWorkout ? 'workout' : ''} ${day?.routineType || ''} ${day?.date === date ? 'today' : ''}`}
                          onClick={() => day?.hasWorkout && setSelectedWorkoutDay(day.date)}
                        >
                          {day?.day}
                        </div>
                      ))}
                    </div>
                    <div className="cal-legend">
                      <span><span className="sw push" /> Push</span>
                      <span><span className="sw pull" /> Pull</span>
                      <span><span className="sw rest" /> Rehab</span>
                    </div>
                  </div>

                  <div className="stats-block">
                    <h4>
                      Push / Pull Balance
                      <span className="toggle">
                        <button className={balanceMode === 'volume' ? 'active' : ''} onClick={() => setBalanceMode('volume')}>Vol</button>
                        <button className={balanceMode === 'sets' ? 'active' : ''} onClick={() => setBalanceMode('sets')}>Sets</button>
                      </span>
                    </h4>
                    <div className="balance-bar">
                      <div className="seg push" style={{ width: pushPct + '%' }} />
                      <div className="seg pull" style={{ width: pullPct + '%' }} />
                    </div>
                    <div className="balance-labels">
                      <span className="push">Push {Math.round(pushPct)}% ({fmtKgVal(pushAgg)}{balanceMode === 'volume' ? ' kg' : ''})</span>
                      <span className="pull">Pull {Math.round(pullPct)}% ({fmtKgVal(pullAgg)}{balanceMode === 'volume' ? ' kg' : ''})</span>
                    </div>
                  </div>

                  <div className="stats-block">
                    <h4>Trending</h4>
                    <div className="trend-grid">
                      <div className="trend-list up">
                        <div className="title">📈 Progressing</div>
                        {upEx.length ? upEx.map(e => (
                          <div key={e.name} className="trend-row" onClick={() => setSelectedExercise(e.name)}>
                            <span className="nm">{e.name}</span>
                            <span className="v">+{e.slope.toFixed(1)}</span>
                          </div>
                        )) : <div className="empty-mini">None yet</div>}
                      </div>
                      <div className="trend-list stall">
                        <div className="title">⚠ Stalled</div>
                        {stallEx.length ? stallEx.map(e => (
                          <div key={e.name} className="trend-row" onClick={() => setSelectedExercise(e.name)}>
                            <span className="nm">{e.name}</span>
                            <span className="v">{e.daysSince}d</span>
                          </div>
                        )) : <div className="empty-mini">None 🎉</div>}
                      </div>
                    </div>
                  </div>

                  <div className="stats-block">
                    <h4>Recent PRs</h4>
                    {prs.length ? (
                      <div className="pr-feed">
                        {[...prs].reverse().slice(0, 6).map((p, i) => (
                          <div key={i} className="pr-row" onClick={() => setSelectedExercise(p.name)}>
                            <div>
                              <div className="nm">{p.name}</div>
                              <div className="meta">{fmtMD(p.date)}</div>
                            </div>
                            <div className="v">{p.weight.toFixed(1)}kg × {p.reps}</div>
                          </div>
                        ))}
                      </div>
                    ) : <div className="empty-msg">No PRs in this period</div>}
                  </div>
                </>
              )}

              {statsTab === 'exercises' && (
                <>
                  <div className="ex-sort-bar">
                    <select value={exSort} onChange={(e) => setExSort(e.target.value)}>
                      <option value="recent">Sort: Recent</option>
                      <option value="alpha">Sort: A-Z</option>
                      <option value="trend">Sort: Trend</option>
                      <option value="volume">Sort: Volume</option>
                    </select>
                  </div>
                  {sortedExList.length === 0 && <div className="empty-msg">No exercises in this period</div>}
                  {sortedExList.map(e => {
                    const last = e.sessions[e.sessions.length - 1]
                    const cls = e.slope > 0.2 ? 'up' : e.slope < -0.2 ? 'down' : 'flat'
                    const arr = e.slope > 0.2 ? '▲' : e.slope < -0.2 ? '▼' : '–'
                    return (
                      <div key={e.name} className="ex-card2">
                        <div className="head">
                          <div>
                            <div className="nm">{e.name}</div>
                            <div className="sub">
                              <span>{last.topSet.weightKg.toFixed(1)}kg × {last.topSet.reps}</span>
                              <span className={`arr ${cls}`}>{arr}</span>
                              <span>· {e.daysSince}d ago</span>
                            </div>
                          </div>
                          <button className="log-btn" onClick={() => setSelectedExercise(e.name)}>Log</button>
                        </div>
                        <div className="chart-host" style={{ height: 170 }}>
                          {e.sessions.length < 2 ? (
                            <div className="single-note">Only 1 session — need ≥2 for a chart</div>
                          ) : (
                            <Line
                              data={{
                                labels: e.sessions.map(s => fmtMD(s.date)),
                                datasets: [
                                  { label: 'Weight', data: e.sessions.map(s => +s.topSet.weightKg.toFixed(1)), borderColor: '#89b4fa', backgroundColor: '#89b4fa22', tension: 0.3, borderWidth: 2, pointRadius: 2.5, yAxisID: 'y' },
                                  { label: '1RM', data: e.sessions.map(s => +s.e1RM.toFixed(1)), borderColor: '#f9e2af', backgroundColor: '#f9e2af22', tension: 0.3, borderWidth: 2, pointRadius: 2.5, borderDash: [4, 3], yAxisID: 'y' },
                                  { label: 'Volume', data: e.sessions.map(s => Math.round(s.volume)), borderColor: '#cba6f7', backgroundColor: '#cba6f733', tension: 0.3, borderWidth: 2, pointRadius: 2.5, yAxisID: 'y2' },
                                ]
                              }}
                              options={{
                                responsive: true, maintainAspectRatio: false,
                                interaction: { mode: 'index', intersect: false },
                                plugins: {
                                  legend: { position: 'bottom', labels: { color: '#a6adc8', boxWidth: 10, font: { size: 9 }, padding: 6, usePointStyle: true } },
                                  tooltip: { backgroundColor: '#181825', borderColor: '#45475a', borderWidth: 1, titleColor: '#cdd6f4', bodyColor: '#cdd6f4', padding: 8 }
                                },
                                scales: {
                                  x: { ticks: { color: '#6c7086', font: { size: 8 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 6 }, grid: { display: false } },
                                  y: { position: 'left', ticks: { color: '#89b4fa', font: { size: 8 } }, grid: { color: '#31324480' }, title: { display: true, text: 'kg', color: '#89b4fa', font: { size: 9 } } },
                                  y2: { position: 'right', ticks: { color: '#cba6f7', font: { size: 8 }, callback: v => fmtKgVal(v) }, grid: { display: false }, title: { display: true, text: 'vol', color: '#cba6f7', font: { size: 9 } } },
                                }
                              }}
                            />
                          )}
                        </div>
                        <div className="stats-row">
                          <div><span>Top</span><b>{e.maxWeight.toFixed(1)}kg</b></div>
                          <div><span>e1RM</span><b>{e.maxE1RM.toFixed(1)}kg</b></div>
                          <div><span>Sets</span><b>{e.totalSets}</b></div>
                          <div><span>Vol</span><b>{fmtKgVal(e.totalVolume)}kg</b></div>
                        </div>
                      </div>
                    )
                  })}
                </>
              )}

              {statsTab === 'history' && (
                <>
                  <div className="hist-filter">
                    {['all', 'push', 'pull', 'rest'].map(r => (
                      <button key={r} className={histFilter === r ? 'active' : ''} onClick={() => setHistFilter(r)}>
                        {r === 'rest' ? 'Rehab' : r.charAt(0).toUpperCase() + r.slice(1)}
                      </button>
                    ))}
                  </div>
                  {histSessions.length === 0 && <div className="empty-msg">No sessions in this period</div>}
                  {Object.keys(histGroups).sort().reverse().map(wk => (
                    <div key={wk}>
                      <div className="hist-week">Week of {fmtMD(wk)}</div>
                      {histGroups[wk].map(([d, w]) => {
                        const isRest = w.routineType === 'rest'
                        const { volume, sets } = isRest ? { volume: 0, sets: 0 } : getSessionVolume(w)
                        const open = openHistDates.has(d)
                        const exPRs = isRest ? 0 : (w.exercises || []).filter(ex => prSet.has(d + '|' + ex.name)).length
                        return (
                          <div key={d} className="sess-card">
                            <div className="sess-head" onClick={() => {
                              const next = new Set(openHistDates)
                              if (next.has(d)) next.delete(d); else next.add(d)
                              setOpenHistDates(next)
                            }}>
                              <div className="left">
                                <span className={`badge ${w.routineType}`}>{w.routineType}</span>
                                <span className="date">{fmtMD(d)}</span>
                              </div>
                              <div className="meta">
                                {isRest ? <span>rehab ✓</span> : <><span>{fmtKgVal(volume)}kg</span><span>{sets} sets</span></>}
                                {exPRs > 0 && <span className="pr">{exPRs}⭐</span>}
                                <span className="chev">{open ? '▴' : '▾'}</span>
                              </div>
                            </div>
                            {open && (
                              <div className="sess-body">
                                {isRest ? (
                                  <div className="sess-rest">Rehab session completed.</div>
                                ) : (w.exercises || []).map((ex, ei) => {
                                  const cfg = getExerciseConfig(ex.name)
                                  const work = (ex.workSets || []).filter(s => s.committed !== false && parseFloat(s.weight) > 0)
                                  const warm = (ex.warmupSets || []).filter(s => parseFloat(s.weight) > 0)
                                  const isPR = prSet.has(d + '|' + ex.name)
                                  if (!work.length && !warm.length) return null
                                  return (
                                    <div key={ei} className="sess-ex">
                                      <div className="nm">
                                        <span>{ex.name}</span>
                                        {isPR && <span className="pr">⭐ PR</span>}
                                      </div>
                                      <div className="sets">
                                        {work.map((s, si) => (
                                          <span key={si} className="work">{s.weight}{s.unit || cfg.unit}×{s.reps}{si < work.length - 1 ? ', ' : ''}</span>
                                        ))}
                                        {warm.length > 0 && (
                                          <span className="warm"> · w: {warm.map((s, si) => `${s.weight}${s.unit || cfg.unit}×${s.reps}`).join(', ')}</span>
                                        )}
                                      </div>
                                      {ex.notes && <div className="notes">{ex.notes}</div>}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </>
              )}
            </div>
          )
        })()}

        {tab === 'settings' && (
          <div className="settings-page">
            <div className="settings-tabs">
              <button className={settingsSection === 'sync' ? 'active' : ''} onClick={() => setSettingsSection('sync')}>Settings</button>
              <button className={settingsSection === 'routines' ? 'active' : ''} onClick={() => setSettingsSection('routines')}>Routines</button>
            </div>

            {settingsSection === 'sync' && (
              <>
                <div className="settings-section">Data</div>

                <div className="settings-row" onClick={() => setGhExpanded && setGhExpanded(!ghExpanded)}>
                  <div className="sr-left">
                    <span className="sr-icon">{'\u2693'}</span>
                    <span className="sr-label">GitHub Sync</span>
                  </div>
                  <span className="sr-arrow">{ghExpanded ? '\u2039' : '\u203A'}</span>
                </div>

                {ghExpanded && (
                  <div className="gh-form">
                    {!github.connected ? (
                      <>
                        <div className="field"><label>Token</label><input type="password" value={github.token} onChange={(e) => setGithub({...github, token: e.target.value})} placeholder="ghp_..." /></div>
                        <div className="field"><label>Owner</label><input value={github.owner} onChange={(e) => setGithub({...github, owner: e.target.value})} placeholder="username" /></div>
                        <div className="field"><label>Repo</label><input value={github.repo} onChange={(e) => setGithub({...github, repo: e.target.value})} placeholder="body-tracker-data" /></div>
                        <button className="primary-btn" onClick={connectGithub}>Connect</button>
                      </>
                    ) : (
                      <>
                        <div className="connected-info">Connected to {github.owner}/{github.repo}</div>
                        <div className="sync-stats">
                          {lastSyncTime > 0 && <p className="sync-note">Last sync: {new Date(lastSyncTime).toLocaleTimeString()}</p>}
                          <p className="sync-note">Commits today: {commitsToday !== null ? commitsToday : '...'}</p>
                        </div>
                        <button className="primary-btn" onClick={forceSyncToGithub} disabled={!needsSync}>
                          {needsSync ? 'Sync Now' : 'Up to date'}
                        </button>
                        <button className="danger-btn" onClick={() => {
                          if (confirm('Disconnect from GitHub? Local data will be preserved.')) disconnectGithub()
                        }}>Disconnect</button>
                      </>
                    )}
                    {syncStatus && <div className="sync-status" style={{ marginTop: 8 }}>{syncStatus}</div>}
                  </div>
                )}

                <button className="primary-btn" style={{ marginTop: 12 }} onClick={async () => {
                  if (needsSync && github.connected) {
                    setSyncStatus('Syncing before reload...')
                    await forceSyncToGithub()
                  }
                  window.location.reload()
                }}>Reload App</button>
                {needsSync && <p className="sync-note" style={{marginTop: '8px'}}>Changes pending sync</p>}
                <p className="version-text">v0.3.2</p>
              </>
            )}

            {settingsSection === 'routines' && (
              <>
                {Object.entries(routines).map(([key, routine]) => (
                  <div key={key} className="routine-section">
                    <div className="routine-section-header">
                      <h3>{routine.name}</h3>
                      {routine.schedule && <span className="routine-schedule">{routine.schedule}</span>}
                    </div>

                    {routine.warmups?.length > 0 && (
                      <>
                        <div className="subsection-label">Warmup</div>
                        <div className="exercise-list">
                          {routine.warmups.map((w) => (
                            <div key={w.id} className="exercise-item warmup-type" onClick={() => setEditModal({ type: 'warmup', routineKey: key, warmup: { ...w }, isNew: false })}>
                              <div className="exercise-info">
                                <span className="exercise-title">{w.name}</span>
                                <span className="exercise-sets">{w.sets ? `${w.sets}×` : ''}{w.reps}{w.notes ? ` · ${w.notes}` : ''}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        <button className="add-btn add-btn-small" onClick={() => setEditModal({ type: 'warmup', routineKey: key, warmup: { id: 'w' + Date.now(), name: '', reps: '', notes: '' }, isNew: true })}>+ Add Warmup</button>
                      </>
                    )}
                    {!routine.warmups?.length && !routine.isRest && (
                      <button className="add-btn add-btn-small" onClick={() => setEditModal({ type: 'warmup', routineKey: key, warmup: { id: 'w' + Date.now(), name: '', reps: '', notes: '' }, isNew: true })}>+ Add Warmup</button>
                    )}

                    {routine.isRest ? (
                      <>
                        {routine.blocks?.map((block, blockIdx) => (
                          <div key={blockIdx}>
                            <div className="subsection-label">{block.icon} {block.name} <span className="subsection-duration">{block.duration}</span></div>
                            <div className="exercise-list">
                              {block.exercises.map((ex) => (
                                <div key={ex.id} className="exercise-item rest-type" onClick={() => setEditModal({ type: 'restExercise', routineKey: key, blockIdx, exercise: { ...ex }, isNew: false })}>
                                  <div className="exercise-info">
                                    <span className="exercise-title">{ex.name}</span>
                                    <span className="exercise-sets">{ex.sets}×{ex.reps}{ex.notes ? ` · ${ex.notes}` : ''}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <button className="add-btn add-btn-small" onClick={() => setEditModal({ type: 'restExercise', routineKey: key, blockIdx, exercise: { id: Math.max(0, ...routine.blocks.flatMap(b => b.exercises.map(e => e.id))) + 1, name: '', sets: 3, reps: '', notes: '' }, isNew: true })}>+ Add Exercise</button>
                          </div>
                        ))}
                      </>
                    ) : (
                      <>
                        <div className="subsection-label">Exercises</div>
                        <div className="exercise-list">
                          {routine.exercises.map((ex) => (
                            <div
                              key={ex.id}
                              data-id={ex.id}
                              className={`exercise-item ${dragState?.exerciseId === ex.id || (touchDrag?.active && touchDrag?.exerciseId === ex.id) ? 'dragging' : ''}`}
                              draggable
                              onDragStart={() => handleDragStart(key, ex.id)}
                              onDragOver={(e) => handleDragOver(e, key, ex.id)}
                              onDragEnd={handleDragEnd}
                              onTouchStart={(e) => handleTouchStart(e, key, ex.id)}
                              onTouchMove={(e) => handleTouchMove(e, key)}
                              onTouchEnd={handleTouchEnd}
                              onTouchCancel={handleTouchCancel}
                              onClick={() => !touchDrag?.active && openEditExercise(key, ex.id)}
                            >
                              <div className="exercise-info">
                                <span className="exercise-title">{ex.name}</span>
                                <span className="exercise-sets">
                                  {ex.warmupSets}W + {ex.workSets}S · {ex.reps} reps · {ex.equipmentType === 'plates' ? `±${ex.increment}${ex.unit}` : `${ex.startWeight}-${ex.startWeight + ex.increment * 10}${ex.unit}`}
                                </span>
                                {ex.templateNotes && <span className="exercise-template-notes">{ex.templateNotes}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                        <button className="add-btn" onClick={() => openAddExercise(key)}>+ Add Exercise</button>
                      </>
                    )}
                  </div>
                ))}
                <button className="danger-btn" style={{marginTop: '20px'}} onClick={() => {
                  if (confirm('Reset all routines to default? This will restore original exercises and order.')) {
                    setRoutines(defaultRoutines)
                    saveRoutines(defaultRoutines)
                  }
                }}>Reset to Default</button>
              </>
            )}
          </div>
        )}
      </main>

      {routinePicker && (
        <div className="routine-picker-overlay" onClick={() => setRoutinePicker(false)}>
          <div className="routine-picker" onClick={e => e.stopPropagation()}>
            {Object.entries(routines).map(([key, r]) => (
              <button
                key={key}
                className={`rp-option ${currentRoutineType === key ? 'active' : ''}`}
                onClick={() => { switchRoutine(key); setRoutinePicker(false) }}
              >
                {r.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <nav className="navbar">
        <button
          className={tab === 'log' ? 'active' : ''}
          onClick={() => { if (!longPressRef.current?.fired) setTab('log') }}
          onTouchStart={() => {
            longPressRef.current = { id: setTimeout(() => {
              if (tab === 'log') { longPressRef.current.fired = true; setRoutinePicker(true) }
            }, 500), fired: false }
          }}
          onTouchEnd={() => { if (longPressRef.current) clearTimeout(longPressRef.current.id) }}
          onMouseDown={() => {
            longPressRef.current = { id: setTimeout(() => {
              if (tab === 'log') { longPressRef.current.fired = true; setRoutinePicker(true) }
            }, 500), fired: false }
          }}
          onMouseUp={() => { if (longPressRef.current) clearTimeout(longPressRef.current.id) }}
          onContextMenu={e => e.preventDefault()}
        ><span className="nav-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3v18M7 3v18M3 7v10M21 7v10M7 12h10M3 12h4M17 12h4"/></svg></span></button>
        <button className={tab === 'stats' ? 'active' : ''} onClick={() => setTab('stats')}><span className="nav-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 3v18h18"/><path d="M7 16l4-8 4 4 4-6"/></svg></span></button>
        <button className={tab === 'settings' ? 'active' : ''} onClick={() => { setTab('settings'); fetchCommitsToday() }}><span className="nav-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg></span></button>
      </nav>

      {editModal && editModal.type === 'exercise' && (
        <div className="modal-overlay" onClick={() => setEditModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editModal.isNew ? 'Add Exercise' : 'Edit Exercise'}</h3>
              {!editModal.isNew && (
                <button className="trash-btn" onClick={() => {
                  if (confirm(`Delete ${editModal.exercise.name}?`)) {
                    deleteExercise(editModal.routineKey, editModal.exercise.id)
                    setEditModal(null)
                  }
                }}>🗑</button>
              )}
            </div>
            <div className="form">
              <div className="field">
                <label>Name</label>
                <input value={editModal.exercise.name} onChange={(e) => setEditModal({...editModal, exercise: {...editModal.exercise, name: e.target.value}})} placeholder="Exercise name" />
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Warmup Sets</label>
                  <input type="number" value={editModal.exercise.warmupSets} onChange={(e) => setEditModal({...editModal, exercise: {...editModal.exercise, warmupSets: parseInt(e.target.value) || 0}})} onFocus={(e) => e.target.select()} />
                </div>
                <div className="field">
                  <label>Work Sets</label>
                  <input type="number" value={editModal.exercise.workSets} onChange={(e) => setEditModal({...editModal, exercise: {...editModal.exercise, workSets: parseInt(e.target.value) || 1}})} onFocus={(e) => e.target.select()} />
                </div>
                <div className="field">
                  <label>Target Reps</label>
                  <input type="number" value={editModal.exercise.reps} onChange={(e) => setEditModal({...editModal, exercise: {...editModal.exercise, reps: e.target.value}})} placeholder="8" onFocus={(e) => e.target.select()} />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Unit</label>
                  <select value={editModal.exercise.unit ?? 'kg'} onChange={(e) => setEditModal({...editModal, exercise: {...editModal.exercise, unit: e.target.value}})}>
                    <option value="kg">kg</option>
                    <option value="lbs">lbs</option>
                  </select>
                </div>
                <div className="field">
                  <label>Equipment</label>
                  <select value={editModal.exercise.equipmentType ?? 'machine'} onChange={(e) => setEditModal({...editModal, exercise: {...editModal.exercise, equipmentType: e.target.value}})}>
                    <option value="machine">Machine</option>
                    <option value="cable">Cable</option>
                    <option value="plates">Plates</option>
                  </select>
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Start Weight</label>
                  <input type="number" step="0.5" value={editModal.exercise.startWeight ?? ''} onChange={(e) => setEditModal({...editModal, exercise: {...editModal.exercise, startWeight: e.target.value === '' ? '' : parseFloat(e.target.value)}})} onBlur={(e) => e.target.value === '' && setEditModal({...editModal, exercise: {...editModal.exercise, startWeight: 0}})} onFocus={(e) => e.target.select()} placeholder="0" />
                </div>
                <div className="field">
                  <label>Increment</label>
                  <input type="number" step="0.5" value={editModal.exercise.increment ?? ''} onChange={(e) => setEditModal({...editModal, exercise: {...editModal.exercise, increment: e.target.value === '' ? '' : parseFloat(e.target.value)}})} onBlur={(e) => e.target.value === '' && setEditModal({...editModal, exercise: {...editModal.exercise, increment: 5}})} onFocus={(e) => e.target.select()} placeholder="5" />
                </div>
                {editModal.exercise.equipmentType === 'plates' && (
                  <div className="field">
                    <label>Bar Weight</label>
                    <input type="number" step="0.5" value={editModal.exercise.barWeight ?? ''} onChange={(e) => setEditModal({...editModal, exercise: {...editModal.exercise, barWeight: e.target.value === '' ? '' : parseFloat(e.target.value)}})} onBlur={(e) => e.target.value === '' && setEditModal({...editModal, exercise: {...editModal.exercise, barWeight: 0}})} onFocus={(e) => e.target.select()} placeholder="0" />
                  </div>
                )}
              </div>
              <div className="field">
                <label>Notes (shown during workout)</label>
                <input value={editModal.exercise.templateNotes ?? ''} onChange={(e) => setEditModal({...editModal, exercise: {...editModal.exercise, templateNotes: e.target.value}})} placeholder="e.g. 3s eccentric, stop before lockout" />
              </div>
            </div>
            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setEditModal(null)}>Cancel</button>
              <button className="primary-btn" onClick={saveExerciseModal}>Save</button>
            </div>
          </div>
        </div>
      )}

      {editModal && editModal.type === 'warmup' && (
        <div className="modal-overlay" onClick={() => setEditModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editModal.isNew ? 'Add Warmup' : 'Edit Warmup'}</h3>
              {!editModal.isNew && (
                <button className="trash-btn" onClick={() => {
                  if (confirm(`Delete ${editModal.warmup.name}?`)) {
                    const newRoutines = JSON.parse(JSON.stringify(routines))
                    newRoutines[editModal.routineKey].warmups = (newRoutines[editModal.routineKey].warmups || []).filter(w => w.id !== editModal.warmup.id)
                    setRoutines(newRoutines)
                    saveRoutines(newRoutines)
                    setEditModal(null)
                  }
                }}>🗑</button>
              )}
            </div>
            <div className="form">
              <div className="field">
                <label>Name</label>
                <input value={editModal.warmup.name} onChange={(e) => setEditModal({...editModal, warmup: {...editModal.warmup, name: e.target.value}})} placeholder="e.g. Shoulder Circles" />
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Sets (optional)</label>
                  <input type="number" value={editModal.warmup.sets ?? ''} onChange={(e) => setEditModal({...editModal, warmup: {...editModal.warmup, sets: e.target.value === '' ? undefined : parseInt(e.target.value)}})} placeholder="-" />
                </div>
                <div className="field">
                  <label>Reps / Duration</label>
                  <input value={editModal.warmup.reps} onChange={(e) => setEditModal({...editModal, warmup: {...editModal.warmup, reps: e.target.value}})} placeholder="e.g. 10 each" />
                </div>
              </div>
              <div className="field">
                <label>Notes</label>
                <input value={editModal.warmup.notes ?? ''} onChange={(e) => setEditModal({...editModal, warmup: {...editModal.warmup, notes: e.target.value}})} placeholder="Cues or instructions" />
              </div>
            </div>
            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setEditModal(null)}>Cancel</button>
              <button className="primary-btn" onClick={() => {
                const newRoutines = JSON.parse(JSON.stringify(routines))
                if (!newRoutines[editModal.routineKey].warmups) newRoutines[editModal.routineKey].warmups = []
                if (editModal.isNew) {
                  newRoutines[editModal.routineKey].warmups.push(editModal.warmup)
                } else {
                  const idx = newRoutines[editModal.routineKey].warmups.findIndex(w => w.id === editModal.warmup.id)
                  if (idx !== -1) newRoutines[editModal.routineKey].warmups[idx] = editModal.warmup
                }
                setRoutines(newRoutines)
                saveRoutines(newRoutines)
                setEditModal(null)
              }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {editModal && editModal.type === 'restExercise' && (
        <div className="modal-overlay" onClick={() => setEditModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editModal.isNew ? 'Add Exercise' : 'Edit Exercise'}</h3>
              {!editModal.isNew && (
                <button className="trash-btn" onClick={() => {
                  if (confirm(`Delete ${editModal.exercise.name}?`)) {
                    const newRoutines = JSON.parse(JSON.stringify(routines))
                    newRoutines[editModal.routineKey].blocks[editModal.blockIdx].exercises =
                      newRoutines[editModal.routineKey].blocks[editModal.blockIdx].exercises.filter(e => e.id !== editModal.exercise.id)
                    setRoutines(newRoutines)
                    saveRoutines(newRoutines)
                    setEditModal(null)
                  }
                }}>🗑</button>
              )}
            </div>
            <div className="form">
              <div className="field">
                <label>Name</label>
                <input value={editModal.exercise.name} onChange={(e) => setEditModal({...editModal, exercise: {...editModal.exercise, name: e.target.value}})} placeholder="Exercise name" />
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Sets</label>
                  <input type="number" value={editModal.exercise.sets} onChange={(e) => setEditModal({...editModal, exercise: {...editModal.exercise, sets: parseInt(e.target.value) || 1}})} />
                </div>
                <div className="field">
                  <label>Reps / Duration</label>
                  <input value={editModal.exercise.reps} onChange={(e) => setEditModal({...editModal, exercise: {...editModal.exercise, reps: e.target.value}})} placeholder="e.g. 10 each, 30s" />
                </div>
              </div>
              <div className="field">
                <label>Notes</label>
                <input value={editModal.exercise.notes ?? ''} onChange={(e) => setEditModal({...editModal, exercise: {...editModal.exercise, notes: e.target.value}})} placeholder="Cues or instructions" />
              </div>
            </div>
            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setEditModal(null)}>Cancel</button>
              <button className="primary-btn" onClick={() => {
                const newRoutines = JSON.parse(JSON.stringify(routines))
                const block = newRoutines[editModal.routineKey].blocks[editModal.blockIdx]
                if (editModal.isNew) {
                  block.exercises.push(editModal.exercise)
                } else {
                  const idx = block.exercises.findIndex(e => e.id === editModal.exercise.id)
                  if (idx !== -1) block.exercises[idx] = editModal.exercise
                }
                setRoutines(newRoutines)
                saveRoutines(newRoutines)
                setEditModal(null)
              }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {selectedWorkoutDay && (
        <div className="modal-overlay" onClick={() => setSelectedWorkoutDay(null)}>
          <div className="modal stats-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedWorkoutDay}</h3>
              <button className="trash-btn" onClick={() => {
                if (confirm(`Delete workout from ${selectedWorkoutDay}?`)) {
                  const newWorkouts = { ...workouts }
                  delete newWorkouts[selectedWorkoutDay]
                  setWorkouts(newWorkouts)
                  saveAll(newWorkouts, exerciseNotes)
                  setSelectedWorkoutDay(null)
                }
              }}>🗑</button>
            </div>
            {(() => {
              const stats = getWorkoutDayStats(selectedWorkoutDay)
              const exerciseDetails = getWorkoutDayExerciseDetails(selectedWorkoutDay)
              if (!stats) return <p>No data</p>
              const prCount = exerciseDetails.filter(e => e.isWeightPR || e.isRepPR).length
              return (
                <>
                  <div className="workout-day-stats">
                    <div className="stat-row"><span>Routine</span><span>{stats.routineType?.toUpperCase()}</span></div>
                    <div className="stat-row"><span>Total Volume</span><span>{stats.totalWeight.toLocaleString()} kg</span></div>
                    <div className="stat-row"><span>Total Sets</span><span>{stats.totalSets}</span></div>
                    <div className="stat-row"><span>PRs</span><span>{prCount > 0 ? `${prCount} 🎉` : '0'}</span></div>
                  </div>
                  <div className="workout-exercises-list">
                    <h4>Exercises</h4>
                    {exerciseDetails.map(ex => (
                      <div key={ex.name} className={`workout-exercise-row ${ex.isWeightPR ? 'weight-pr' : ''} ${ex.isRepPR ? 'rep-pr' : ''}`}>
                        <span className="exercise-name">{ex.name}</span>
                        <span className="exercise-best">
                          {ex.bestWeight}kg × {ex.bestReps}
                          {ex.isWeightPR && ' ⭐'}
                          {ex.isRepPR && ' ✓'}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )
            })()}
            <button className="primary-btn" onClick={() => setSelectedWorkoutDay(null)}>Close</button>
          </div>
        </div>
      )}

      {selectedExercise && (
        <div className="modal-overlay" onClick={() => setSelectedExercise(null)}>
          <div className="modal stats-modal exercise-modal" onClick={e => e.stopPropagation()}>
            <h3>{selectedExercise}</h3>
            <span className="stats-period">
              {statsFilter === 'all' ? 'All Time' : statsFilter === 'current' ? (getCurrentPhase()?.name || 'All Time') : phases.find(p => p.id === statsFilter)?.name || 'All Time'}
            </span>
            {(() => {
              const stats = getExerciseStats(selectedExercise)
              const progressData = getExerciseProgressData(selectedExercise)
              const chartData = {
                labels: progressData.map(d => d.date.slice(5)),
                datasets: [
                  {
                    label: 'Weight (kg)',
                    data: progressData.map(d => d.weight),
                    borderColor: '#89b4fa',
                    backgroundColor: 'rgba(137, 180, 250, 0.2)',
                    tension: 0.3,
                    fill: true
                  },
                  {
                    label: 'Est. 1RM (kg)',
                    data: progressData.map(d => d.oneRM),
                    borderColor: '#f9e2af',
                    backgroundColor: 'rgba(249, 226, 175, 0.1)',
                    tension: 0.3,
                    borderDash: [5, 5]
                  }
                ]
              }
              const chartOptions = {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'top', labels: { color: '#cdd6f4', boxWidth: 12, font: { size: 10 } } }
                },
                scales: {
                  x: { ticks: { color: '#6c7086', font: { size: 9 } }, grid: { color: '#313244' } },
                  y: { ticks: { color: '#6c7086' }, grid: { color: '#313244' } }
                }
              }
              return (
                <>
                  <div className="exercise-detail-stats">
                    <div className="stat-row"><span>Max Weight</span><span>{stats.maxWeight} kg</span></div>
                    <div className="stat-row"><span>Est. 1RM</span><span>{stats.maxOneRepMax} kg</span></div>
                    <div className="stat-row"><span>Total Sets</span><span>{stats.totalSets}</span></div>
                    <div className="stat-row"><span>Total Reps</span><span>{stats.totalReps}</span></div>
                  </div>
                  {progressData.length >= 1 && (
                    <div className="exercise-chart">
                      <Line data={chartData} options={chartOptions} />
                    </div>
                  )}
                </>
              )
            })()}
            <button className="primary-btn" onClick={() => setSelectedExercise(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
