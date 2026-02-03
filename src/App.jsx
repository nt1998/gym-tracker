import { useState, useEffect, useRef } from 'react'
import { Line } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js'
import './App.css'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

// Convert lbs to kg
const lbsToKg = (lbs) => Math.round(lbs * 0.453592 * 10) / 10

// Convert weight to kg for stats
const toKg = (weight, unit) => {
  if (!weight) return 0
  const w = parseFloat(weight) || 0
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
    exercises: [
      { id: 1, name: 'Incline Chest Press', warmupSets: 2, workSets: 3, reps: '8', unit: 'kg', equipmentType: 'plates', startWeight: 20, increment: 5, barWeight: 20 },
      { id: 2, name: 'Butterfly', warmupSets: 1, workSets: 2, reps: '8', unit: 'kg', equipmentType: 'machine', startWeight: 5, increment: 5 },
      { id: 3, name: 'Lateral Raise Machine', warmupSets: 1, workSets: 2, reps: '8', unit: 'kg', equipmentType: 'machine', startWeight: 5, increment: 5 },
      { id: 4, name: 'Triceps Cable Pushdowns', warmupSets: 1, workSets: 2, reps: '8', unit: 'kg', equipmentType: 'cable', startWeight: 5, increment: 5 },
      { id: 5, name: 'Seated Leg Extensions', warmupSets: 1, workSets: 3, reps: '8', unit: 'kg', equipmentType: 'machine', startWeight: 5, increment: 5 },
      { id: 6, name: 'Standing Calf Raises', warmupSets: 1, workSets: 3, reps: '8', unit: 'kg', equipmentType: 'machine', startWeight: 5, increment: 5 },
      { id: 7, name: 'Crunch Cable', warmupSets: 0, workSets: 3, reps: '8', unit: 'kg', equipmentType: 'cable', startWeight: 5, increment: 5 }
    ]
  },
  pull: {
    name: 'Pull',
    exercises: [
      { id: 1, name: 'Lat Pulldown', warmupSets: 2, workSets: 2, reps: '8', unit: 'kg', equipmentType: 'cable', startWeight: 5, increment: 5 },
      { id: 2, name: 'RDL', warmupSets: 2, workSets: 2, reps: '8', unit: 'kg', equipmentType: 'plates', startWeight: 20, increment: 5, barWeight: 20 },
      { id: 3, name: 'Upper Back Row (gray)', warmupSets: 1, workSets: 2, reps: '8', unit: 'kg', equipmentType: 'machine', startWeight: 5, increment: 5 },
      { id: 4, name: 'Low Machine Row', warmupSets: 0, workSets: 2, reps: '8', unit: 'kg', equipmentType: 'machine', startWeight: 5, increment: 5 },
      { id: 5, name: 'Reverse Butterfly', warmupSets: 1, workSets: 1, reps: '8', unit: 'kg', equipmentType: 'machine', startWeight: 5, increment: 5 },
      { id: 6, name: 'Preacher Curl', warmupSets: 1, workSets: 2, reps: '8', unit: 'kg', equipmentType: 'machine', startWeight: 5, increment: 5 },
      { id: 7, name: 'Seated Leg Curl', warmupSets: 1, workSets: 3, reps: '8', unit: 'kg', equipmentType: 'machine', startWeight: 5, increment: 5 },
      { id: 8, name: 'Hip Adduction', warmupSets: 1, workSets: 3, reps: '8', unit: 'kg', equipmentType: 'machine', startWeight: 5, increment: 5 }
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
  const [settingsSection, setSettingsSection] = useState('sync')
  const [dragState, setDragState] = useState(null)
  const [touchDrag, setTouchDrag] = useState(null)
  const touchTimeout = useRef(null)
  const [statsFilter, setStatsFilter] = useState('current')
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
    if (savedRoutines) setRoutines(JSON.parse(savedRoutines))
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
    const sortedDates = Object.keys(workouts).sort().reverse()
    if (sortedDates.length === 0) return 'push'
    const lastWorkout = workouts[sortedDates[0]]
    return lastWorkout?.routineType === 'push' ? 'pull' : 'push'
  }

  const getTodaysRoutineType = () => {
    if (workouts[date]?.routineType) return workouts[date].routineType
    return getNextRoutineType()
  }

  const currentRoutineType = getTodaysRoutineType()
  const currentRoutine = routines[currentRoutineType]

  const getWorkout = () => {
    if (workouts[date]) return workouts[date]
    return {
      routineType: currentRoutineType,
      exercises: currentRoutine.exercises.map(ex => ({
        id: ex.id,
        name: ex.name,
        warmupSets: Array(ex.warmupSets).fill().map(() => ({ weight: '', reps: '', committed: false })),
        workSets: Array(ex.workSets).fill().map(() => ({ weight: '', reps: '', committed: false })),
        notes: exerciseNotes[ex.name] || ''
      })),
      completed: false
    }
  }

  const workout = getWorkout()
  const currentExercise = workout.exercises[currentExerciseIdx]
  const routineTemplate = currentRoutine?.exercises.find(e => e.id === currentExercise?.id) || currentRoutine?.exercises[currentExerciseIdx]

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
      const localPayload = JSON.stringify({ workouts: newWorkouts, notes: newNotes })
      const remotePayload = remoteData ? JSON.stringify({ workouts: remoteData.workouts, notes: remoteData.notes }) : null

      if (localPayload === remotePayload) {
        // No changes, skip commit
        setSyncStatus('No changes')
        setTimeout(() => setSyncStatus(''), 1500)
        setNeedsSync(false)
        return
      }

      setSyncStatus('Syncing...')
      const content = btoa(unescape(encodeURIComponent(JSON.stringify({ workouts: newWorkouts, notes: newNotes }, null, 2))))
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
    const sets = type === 'warmup' ? newWorkout.exercises[currentExerciseIdx].warmupSets : newWorkout.exercises[currentExerciseIdx].workSets
    sets[setIdx] = { ...sets[setIdx], [field]: value }
    if (autoCommit) sets[setIdx].committed = true
    const newWorkouts = { ...workouts, [date]: newWorkout }
    setWorkouts(newWorkouts)
    saveAll(newWorkouts, exerciseNotes)
  }

  const toggleSetCommitted = (type, setIdx) => {
    const newWorkout = JSON.parse(JSON.stringify(workout))
    const sets = type === 'warmup' ? newWorkout.exercises[currentExerciseIdx].warmupSets : newWorkout.exercises[currentExerciseIdx].workSets
    const set = sets[setIdx]

    if (set.committed) {
      // Uncommit - keep values but mark as not committed
      set.committed = false
    } else {
      // Commit - use current values or previous values
      const prevSets = type === 'warmup' ? lastExerciseValues.warmupSets : lastExerciseValues.workSets
      const prevSet = prevSets[setIdx]
      if (!set.weight && prevSet?.weight) set.weight = prevSet.weight
      if (!set.reps && prevSet?.reps) set.reps = prevSet.reps
      set.committed = true
    }

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
      // For plates, increment is per side, so total change is 2x
      const step = increment * 2
      const barWeight = routineTemplate?.barWeight || (routineTemplate?.unit === 'lbs' ? 45 : 20)
      newWeight = Math.max(barWeight, Math.round((currentWeight + delta * step) * 10) / 10)
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
    const newSets = type === 'warmup' ? newWorkout.exercises[currentExerciseIdx].warmupSets : newWorkout.exercises[currentExerciseIdx].workSets
    newSets[setIdx].weight = newWeight.toString()
    if (!newSets[setIdx].reps && prevSets[setIdx]?.reps) {
      newSets[setIdx].reps = prevSets[setIdx].reps
    }
    newSets[setIdx].committed = true
    const newWorkouts = { ...workouts, [date]: newWorkout }
    setWorkouts(newWorkouts)
    saveAll(newWorkouts, exerciseNotes)
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
    const newSets = type === 'warmup' ? newWorkout.exercises[currentExerciseIdx].warmupSets : newWorkout.exercises[currentExerciseIdx].workSets
    newSets[setIdx].reps = newReps.toString()
    if (!newSets[setIdx].weight && prevSets[setIdx]?.weight) {
      newSets[setIdx].weight = prevSets[setIdx].weight
    }
    newSets[setIdx].committed = true
    const newWorkouts = { ...workouts, [date]: newWorkout }
    setWorkouts(newWorkouts)
    saveAll(newWorkouts, exerciseNotes)
  }

  const updateExerciseNote = (note) => {
    const newWorkout = JSON.parse(JSON.stringify(workout))
    newWorkout.exercises[currentExerciseIdx].notes = note
    const newWorkouts = { ...workouts, [date]: newWorkout }
    setWorkouts(newWorkouts)
    const newNotes = { ...exerciseNotes, [currentExercise.name]: note }
    setExerciseNotes(newNotes)
    saveAll(newWorkouts, newNotes)
  }

  const nextExercise = () => {
    if (currentExerciseIdx < workout.exercises.length - 1) setCurrentExerciseIdx(currentExerciseIdx + 1)
  }

  const prevExercise = () => {
    if (currentExerciseIdx > 0) setCurrentExerciseIdx(currentExerciseIdx - 1)
  }

  const switchRoutine = () => {
    const newType = currentRoutineType === 'push' ? 'pull' : 'push'

    // Check if today's workout has any data entered
    const todayWorkout = workouts[date]
    if (todayWorkout) {
      const hasData = todayWorkout.exercises?.some(ex =>
        ex.warmupSets?.some(s => s.weight || s.reps) ||
        ex.workSets?.some(s => s.weight || s.reps)
      )
      if (hasData) {
        if (!confirm(`You have data logged today. Switching to ${newType.toUpperCase()} will lose this data. Continue?`)) {
          return
        }
      }
    }

    const newWorkout = {
      routineType: newType,
      exercises: routines[newType].exercises.map(ex => ({
        id: ex.id,
        name: ex.name,
        warmupSets: Array(ex.warmupSets).fill().map(() => ({ weight: '', reps: '', committed: false })),
        workSets: Array(ex.workSets).fill().map(() => ({ weight: '', reps: '', committed: false })),
        notes: exerciseNotes[ex.name] || ''
      })),
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
    saveAll(newWorkouts, exerciseNotes, true) // Force sync on workout commit
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
    const sortedDates = Object.keys(workouts).filter(d => d < date).sort().reverse()
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
          const weight = toKg(set.weight, config.unit)
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
    const filtered = getFilteredWorkouts()
    const exercises = new Set()
    Object.values(filtered).forEach(w => {
      w.exercises?.forEach(ex => exercises.add(ex.name))
    })
    return Array.from(exercises).sort()
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
          const weight = toKg(set.weight, config.unit)
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
  const getExerciseConfig = (exerciseName) => {
    for (const routine of Object.values(routines)) {
      const ex = routine.exercises?.find(e => e.name === exerciseName)
      if (ex) return ex
    }
    return { unit: 'kg', equipmentType: 'machine', startWeight: 5, increment: 5 }
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
          const weight = toKg(set.weight, config.unit)
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

  // Check if today's exercise beats the PR (based on best committed set)
  // Read directly from workouts state to ensure fresh values
  const getExercisePRStatus = (exerciseName) => {
    const pr = getExercisePR(exerciseName)
    const todayWorkout = workouts[date]
    const ex = todayWorkout?.exercises?.find(e => e.name === exerciseName)
    if (!ex) return { isWeightPR: false, isRepPR: false }

    let bestWeight = 0
    let bestRepsAtBestWeight = 0

    // Find best committed set from today
    ex.workSets?.forEach(set => {
      if (!set.committed) return
      const weight = parseFloat(set.weight) || 0
      const reps = parseInt(set.reps) || 0
      if (weight > 0 && reps > 0) {
        if (weight > bestWeight) {
          bestWeight = weight
          bestRepsAtBestWeight = reps
        } else if (weight === bestWeight && reps > bestRepsAtBestWeight) {
          bestRepsAtBestWeight = reps
        }
      }
    })

    if (bestWeight <= 0) return { isWeightPR: false, isRepPR: false }

    const isWeightPR = bestWeight > pr.maxWeight
    const isRepPR = bestWeight === pr.maxWeight && bestRepsAtBestWeight > pr.maxRepsAtMaxWeight

    return { isWeightPR, isRepPR }
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
        const weight = toKg(set.weight, config.unit)
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
            const weight = toKg(set.weight, config.unit)
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
        const weight = toKg(set.weight, config.unit)
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
        hasWorkout: workouts[dateStr]?.committed
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
    const sortedDates = Object.keys(workouts).filter(d => d < date).sort().reverse()
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

  // Check if a specific set beats the PR (comparing in kg)
  const isSetPR = (exerciseName, weight, reps) => {
    const pr = getExercisePR(exerciseName)
    const config = getExerciseConfig(exerciseName)
    const w = toKg(weight, config.unit)
    const r = parseInt(reps) || 0
    if (w <= 0 || r <= 0) return { isWeightPR: false, isRepPR: false }
    const isWeightPR = w > pr.maxWeight
    const isRepPR = !isWeightPR && Math.abs(w - pr.maxWeight) < 0.1 && r > pr.maxRepsAtMaxWeight
    return { isWeightPR, isRepPR }
  }

  const renderSetRow = (set, idx, type, label) => {
    const prevSet = type === 'work' ? lastExerciseValues.workSets[idx] : lastExerciseValues.warmupSets[idx]
    const prevWeight = prevSet?.weight || ''
    const prevReps = prevSet?.reps || ''
    const goalReps = routineTemplate?.reps || ''
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

  const isLastExercise = currentExerciseIdx === workout.exercises.length - 1

  return (
    <div className="app">
      <header className="header">
        <h1>Gym Tracker</h1>
        {tab === 'log' && <button className="routine-switch" onClick={switchRoutine}>{currentRoutine.name}</button>}
      </header>

      <main className="content">
        {tab === 'log' && currentExercise && (
          <div className="log-page">
            <div className="exercise-nav">
              <button onClick={prevExercise} disabled={currentExerciseIdx === 0}>&lt;</button>
              <div className="exercise-info-center">
                <h2 className="exercise-name">{currentExercise.name}</h2>
                <span className="exercise-count">{currentExerciseIdx + 1} / {workout.exercises.length}{workout.committed && ' ✓'}</span>
              </div>
              {isLastExercise ? (
                <button className={`commit-btn ${workout.committed ? 'committed' : ''}`} onClick={commitWorkout}>
                  {workout.committed ? '✓' : 'Save'}
                </button>
              ) : (
                <button onClick={nextExercise}>&gt;</button>
              )}
            </div>

            {(() => {
              const pr = getExercisePR(currentExercise.name)
              const unit = routineTemplate?.unit || 'kg'
              // Calculate PR status directly from currentExercise (same data being rendered)
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
              const bestWeightKg = toKg(bestWeightNative, unit)
              const isWeightPR = bestWeightKg > pr.maxWeight
              const isRepPR = !isWeightPR && Math.abs(bestWeightKg - pr.maxWeight) < 0.1 && bestReps > pr.maxRepsAtMaxWeight
              const lastDataKg = lastData ? toKg(lastData.weight, unit) : 0

              if (pr.maxWeight > 0 || isWeightPR || isRepPR) {
                return (
                  <div className={`pr-info ${isWeightPR ? 'new-weight-pr' : ''} ${isRepPR ? 'new-rep-pr' : ''}`}>
                    <span className="pr-label">{isWeightPR || isRepPR ? 'NEW PR!' : 'PR'}</span>
                    <span className="pr-value">{pr.maxWeight}kg × {pr.maxRepsAtMaxWeight}</span>
                    {lastData && <span className="last-value">Last: {lastData.weight}{unit} {unit === 'lbs' ? `(${lastDataKg}kg)` : ''} × {lastData.reps}</span>}
                  </div>
                )
              } else if (lastData) {
                return <div className="last-workout">Last: {lastData.weight}{unit} {unit === 'lbs' ? `(${lastDataKg}kg)` : ''} × {lastData.reps}</div>
              }
              return null
            })()}

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

            {routineTemplate?.equipmentType === 'plates' && (() => {
              // Get the current/last weight being used
              const lastWorkSet = currentExercise.workSets?.filter(s => s.weight).pop()
              const weight = parseFloat(lastWorkSet?.weight) || 0
              if (weight <= 0) return null

              const unit = routineTemplate.unit || 'kg'
              const barWeight = routineTemplate.barWeight || (unit === 'lbs' ? 45 : 20)
              const plates = getPlatesPerSide(weight, barWeight, unit)
              const kgWeight = unit === 'lbs' ? lbsToKg(weight) : weight

              return (
                <div className="plate-info">
                  <span className="plate-kg">{kgWeight}kg</span>
                  <span className="plate-combo">{formatPlates(plates)}/side</span>
                </div>
              )
            })()}

            <div className="notes-section">
              <textarea placeholder="Notes (e.g., seat position, grip width...)" value={currentExercise.notes} onChange={(e) => updateExerciseNote(e.target.value)} />
            </div>

                      </div>
        )}

        {tab === 'stats' && (
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

            <div className="stat-cards">
              <div className="stat-card">
                <span className="stat-value">{getWeeklyStreak(false)}</span>
                <span className="stat-label">All-time Streak</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{getWeeklyStreak(true)}</span>
                <span className="stat-label">Phase Streak</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{getDaysSincePhaseStart()}</span>
                <span className="stat-label">Days in Phase</span>
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
                    className={`calendar-day ${day?.hasWorkout ? 'workout' : ''} ${day?.date === date ? 'today' : ''}`}
                    onClick={() => day?.hasWorkout && setSelectedWorkoutDay(day.date)}
                  >
                    {day?.day}
                  </div>
                ))}
              </div>
            </div>

            <div className="exercises-section">
              <h3>Exercises</h3>
              <div className="exercise-stats-list">
                {getAllExercises().map(name => {
                  const stats = getExerciseStats(name)
                  return (
                    <div key={name} className="exercise-stat-item" onClick={() => setSelectedExercise(name)}>
                      <span className="exercise-stat-name">{name}</span>
                      <span className="exercise-stat-max">{stats.maxWeight}kg</span>
                    </div>
                  )
                })}
                {getAllExercises().length === 0 && <p className="empty">No exercises yet</p>}
              </div>
            </div>
          </div>
        )}

        {tab === 'settings' && (
          <div className="settings-page">
            <div className="settings-tabs">
              <button className={settingsSection === 'sync' ? 'active' : ''} onClick={() => setSettingsSection('sync')}>Settings</button>
              <button className={settingsSection === 'routines' ? 'active' : ''} onClick={() => setSettingsSection('routines')}>Routines</button>
            </div>

            {settingsSection === 'sync' && (
              <>
                <h2>GitHub Sync</h2>
                <p className="settings-note">Syncs with body-tracker-data repo</p>
                {!github.connected ? (
                  <div className="form">
                    <div className="field"><label>Token</label><input type="password" value={github.token} onChange={(e) => setGithub({...github, token: e.target.value})} placeholder="ghp_..." /></div>
                    <div className="field"><label>Owner</label><input value={github.owner} onChange={(e) => setGithub({...github, owner: e.target.value})} placeholder="username" /></div>
                    <div className="field"><label>Repo</label><input value={github.repo} onChange={(e) => setGithub({...github, repo: e.target.value})} placeholder="body-tracker-data" /></div>
                    <button className="primary-btn" onClick={connectGithub}>Connect</button>
                  </div>
                ) : (
                  <div className="connected-info">
                    <p>Connected to {github.owner}/{github.repo}</p>
                    <div className="sync-stats">
                      {lastSyncTime > 0 && (
                        <p className="sync-note">Last sync: {new Date(lastSyncTime).toLocaleTimeString()}</p>
                      )}
                      <p className="sync-note">Commits today: {commitsToday !== null ? commitsToday : '...'}</p>
                    </div>
                    <button className="primary-btn" style={{marginTop: '12px'}} onClick={forceSyncToGithub} disabled={!needsSync}>
                      {needsSync ? 'Sync Now' : 'Up to date'}
                    </button>
                    <button className="danger-btn" style={{marginTop: '8px'}} onClick={() => {
                      if (confirm('Disconnect from GitHub? Local data will be preserved.')) {
                        disconnectGithub()
                      }
                    }}>Disconnect</button>
                  </div>
                )}
                                <h2>App</h2>
                <button className="primary-btn" onClick={async () => {
                  if (needsSync && github.connected) {
                    setSyncStatus('Syncing before reload...')
                    await forceSyncToGithub()
                  }
                  window.location.reload()
                }}>Reload App</button>
                {needsSync && <p className="sync-note" style={{marginTop: '8px'}}>Changes pending sync</p>}
                <p className="version-text">v0.0.1</p>
              </>
            )}

            {settingsSection === 'routines' && (
              <>
                {Object.entries(routines).map(([key, routine]) => (
                  <div key={key} className="routine-section">
                    <h3>{routine.name}</h3>
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
                              {ex.warmupSets}W + {ex.workSets}S · {ex.reps} reps · {ex.equipmentType === 'plates' ? `±${ex.increment * 2}${ex.unit}` : `${ex.startWeight}-${ex.startWeight + ex.increment * 10}${ex.unit}`}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button className="add-btn" onClick={() => openAddExercise(key)}>+ Add Exercise</button>
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

      <nav className="navbar">
        <button className={tab === 'log' ? 'active' : ''} onClick={() => setTab('log')}><span className="nav-icon">🏋️</span><span>Log</span></button>
        <button className={tab === 'stats' ? 'active' : ''} onClick={() => setTab('stats')}><span className="nav-icon">📊</span><span>Stats</span></button>
        <button className={tab === 'settings' ? 'active' : ''} onClick={() => { setTab('settings'); fetchCommitsToday() }}><span className="nav-icon">⚙️</span><span>Settings</span></button>
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
                  <input type="number" value={editModal.exercise.warmupSets} onChange={(e) => setEditModal({...editModal, exercise: {...editModal.exercise, warmupSets: parseInt(e.target.value) || 0}})} />
                </div>
                <div className="field">
                  <label>Work Sets</label>
                  <input type="number" value={editModal.exercise.workSets} onChange={(e) => setEditModal({...editModal, exercise: {...editModal.exercise, workSets: parseInt(e.target.value) || 1}})} />
                </div>
                <div className="field">
                  <label>Target Reps</label>
                  <input type="number" value={editModal.exercise.reps} onChange={(e) => setEditModal({...editModal, exercise: {...editModal.exercise, reps: e.target.value}})} placeholder="8" />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Unit</label>
                  <select value={editModal.exercise.unit || 'kg'} onChange={(e) => setEditModal({...editModal, exercise: {...editModal.exercise, unit: e.target.value}})}>
                    <option value="kg">kg</option>
                    <option value="lbs">lbs</option>
                  </select>
                </div>
                <div className="field">
                  <label>Equipment</label>
                  <select value={editModal.exercise.equipmentType || 'machine'} onChange={(e) => setEditModal({...editModal, exercise: {...editModal.exercise, equipmentType: e.target.value}})}>
                    <option value="machine">Machine</option>
                    <option value="cable">Cable</option>
                    <option value="plates">Plates</option>
                  </select>
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Start Weight</label>
                  <input type="number" step="0.5" value={editModal.exercise.startWeight || 5} onChange={(e) => setEditModal({...editModal, exercise: {...editModal.exercise, startWeight: parseFloat(e.target.value) || 5}})} />
                </div>
                <div className="field">
                  <label>Increment</label>
                  <input type="number" step="0.5" value={editModal.exercise.increment || 5} onChange={(e) => setEditModal({...editModal, exercise: {...editModal.exercise, increment: parseFloat(e.target.value) || 5}})} />
                </div>
                {editModal.exercise.equipmentType === 'plates' && (
                  <div className="field">
                    <label>Bar Weight</label>
                    <input type="number" step="0.5" value={editModal.exercise.barWeight || (editModal.exercise.unit === 'lbs' ? 45 : 20)} onChange={(e) => setEditModal({...editModal, exercise: {...editModal.exercise, barWeight: parseFloat(e.target.value) || 20}})} />
                  </div>
                )}
              </div>
            </div>
            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setEditModal(null)}>Cancel</button>
              <button className="primary-btn" onClick={saveExerciseModal}>Save</button>
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
