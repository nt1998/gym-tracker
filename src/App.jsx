import { useState, useEffect } from 'react'
import './App.css'

const defaultRoutines = {
  push: {
    name: 'Push',
    exercises: [
      { id: 1, name: 'Incline Chest Press', warmupSets: 2, workSets: 3, reps: '3-15', notes: '' },
      { id: 2, name: 'Butterfly', warmupSets: 1, workSets: 2, reps: '5-8', notes: '' },
      { id: 3, name: 'Lateral Raise Machine', warmupSets: 1, workSets: 2, reps: '5-8', notes: '' },
      { id: 4, name: 'Triceps Cable Pushdowns', warmupSets: 1, workSets: 2, reps: '5-8', notes: '' },
      { id: 5, name: 'Seated Leg Extensions', warmupSets: 1, workSets: 3, reps: '5-10', notes: '' },
      { id: 6, name: 'Standing Calf Raises', warmupSets: 1, workSets: 3, reps: '5-15', notes: '' },
      { id: 7, name: 'Crunch Cable', warmupSets: 0, workSets: 3, reps: '8', notes: '' }
    ]
  },
  pull: {
    name: 'Pull',
    exercises: [
      { id: 1, name: 'Lat Pulldown', warmupSets: 2, workSets: 2, reps: '5-15', notes: '' },
      { id: 2, name: 'RDL', warmupSets: 2, workSets: 2, reps: '5-10', notes: '' },
      { id: 3, name: 'Upper Back Row (gray)', warmupSets: 1, workSets: 2, reps: '5-8', notes: '' },
      { id: 4, name: 'Low Machine Row', warmupSets: 0, workSets: 2, reps: '4-5', notes: '' },
      { id: 5, name: 'Reverse Butterfly', warmupSets: 1, workSets: 1, reps: '5-8', notes: '' },
      { id: 6, name: 'Preacher Curl', warmupSets: 1, workSets: 2, reps: '5-10', notes: '' },
      { id: 7, name: 'Seated Leg Curl', warmupSets: 1, workSets: 3, reps: '4-15', notes: '' },
      { id: 8, name: 'Hip Adduction', warmupSets: 1, workSets: 3, reps: '5-15', notes: '' }
    ]
  }
}

function App() {
  const [tab, setTab] = useState('log')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [workouts, setWorkouts] = useState({})
  const [routines, setRoutines] = useState(defaultRoutines)
  const [exerciseNotes, setExerciseNotes] = useState({})
  const [github, setGithub] = useState({ token: '', repo: '', owner: '', connected: false })
  const [bodyTrackerGithub, setBodyTrackerGithub] = useState({ token: '', repo: '', owner: '', connected: false })
  const [phases, setPhases] = useState([])
  const [syncStatus, setSyncStatus] = useState('')
  const [currentExerciseIdx, setCurrentExerciseIdx] = useState(0)

  const today = new Date().toISOString().split('T')[0]
  const isToday = date === today

  useEffect(() => {
    const savedWorkouts = localStorage.getItem('gymtracker_workouts')
    if (savedWorkouts) setWorkouts(JSON.parse(savedWorkouts))
    const savedRoutines = localStorage.getItem('gymtracker_routines')
    if (savedRoutines) setRoutines(JSON.parse(savedRoutines))
    const savedNotes = localStorage.getItem('gymtracker_notes')
    if (savedNotes) setExerciseNotes(JSON.parse(savedNotes))
    const savedGithub = localStorage.getItem('gymtracker_github')
    if (savedGithub) {
      const gh = JSON.parse(savedGithub)
      setGithub(gh)
      if (gh.connected) autoLoadFromGithub(gh)
    }
    const savedBodyGithub = localStorage.getItem('gymtracker_body_github')
    if (savedBodyGithub) {
      const gh = JSON.parse(savedBodyGithub)
      setBodyTrackerGithub(gh)
      if (gh.connected) loadPhasesFromBodyTracker(gh)
    }
  }, [])

  const autoLoadFromGithub = async (gh) => {
    try {
      const res = await fetch(`https://api.github.com/repos/${gh.owner}/${gh.repo}/contents/workouts.json`, { headers: { Authorization: `token ${gh.token}` } })
      if (res.ok) {
        const file = await res.json()
        const data = JSON.parse(decodeURIComponent(escape(atob(file.content))))
        if (data.workouts) {
          setWorkouts(data.workouts)
          localStorage.setItem('gymtracker_workouts', JSON.stringify(data.workouts))
        }
        if (data.notes) {
          setExerciseNotes(data.notes)
          localStorage.setItem('gymtracker_notes', JSON.stringify(data.notes))
        }
      }
      const routinesRes = await fetch(`https://api.github.com/repos/${gh.owner}/${gh.repo}/contents/routines.json`, { headers: { Authorization: `token ${gh.token}` } })
      if (routinesRes.ok) {
        const file = await routinesRes.json()
        const data = JSON.parse(decodeURIComponent(escape(atob(file.content))))
        setRoutines(data)
        localStorage.setItem('gymtracker_routines', JSON.stringify(data))
      }
    } catch {}
  }

  const loadPhasesFromBodyTracker = async (gh) => {
    try {
      const res = await fetch(`https://api.github.com/repos/${gh.owner}/${gh.repo}/contents/data.json`, { headers: { Authorization: `token ${gh.token}` } })
      if (res.ok) {
        const file = await res.json()
        const data = JSON.parse(decodeURIComponent(escape(atob(file.content))))
        if (data.phases) setPhases(data.phases)
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
        warmupSets: Array(ex.warmupSets).fill().map(() => ({ weight: '', reps: '', done: false })),
        workSets: Array(ex.workSets).fill().map(() => ({ weight: '', reps: '', done: false })),
        notes: exerciseNotes[ex.name] || ex.notes || ''
      })),
      completed: false
    }
  }

  const workout = getWorkout()
  const currentExercise = workout.exercises[currentExerciseIdx]
  const routineTemplate = currentRoutine?.exercises[currentExerciseIdx]

  const saveAll = async (newWorkouts, newNotes) => {
    localStorage.setItem('gymtracker_workouts', JSON.stringify(newWorkouts))
    localStorage.setItem('gymtracker_notes', JSON.stringify(newNotes))
    if (github.connected) await syncWorkoutsToGithub(newWorkouts, newNotes)
  }

  const saveRoutines = async (newRoutines) => {
    localStorage.setItem('gymtracker_routines', JSON.stringify(newRoutines))
    if (github.connected) await syncRoutinesToGithub(newRoutines)
  }

  const syncWorkoutsToGithub = async (data, notes) => {
    if (!github.token || !github.repo || !github.owner) return
    try {
      setSyncStatus('Syncing...')
      const payload = { workouts: data, notes }
      const content = btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 2))))
      const apiUrl = `https://api.github.com/repos/${github.owner}/${github.repo}/contents/workouts.json`
      let sha = ''
      try {
        const getRes = await fetch(apiUrl, { headers: { Authorization: `token ${github.token}` } })
        if (getRes.ok) { const file = await getRes.json(); sha = file.sha }
      } catch {}
      await fetch(apiUrl, {
        method: 'PUT',
        headers: { Authorization: `token ${github.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `Update ${new Date().toISOString()}`, content, ...(sha && { sha }) })
      })
      setSyncStatus('Synced!')
      setTimeout(() => setSyncStatus(''), 2000)
    } catch { setSyncStatus('Sync failed'); setTimeout(() => setSyncStatus(''), 3000) }
  }

  const syncRoutinesToGithub = async (data) => {
    if (!github.token || !github.repo || !github.owner) return
    try {
      const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))))
      const apiUrl = `https://api.github.com/repos/${github.owner}/${github.repo}/contents/routines.json`
      let sha = ''
      try {
        const getRes = await fetch(apiUrl, { headers: { Authorization: `token ${github.token}` } })
        if (getRes.ok) { const file = await getRes.json(); sha = file.sha }
      } catch {}
      await fetch(apiUrl, {
        method: 'PUT',
        headers: { Authorization: `token ${github.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `Update routines ${new Date().toISOString()}`, content, ...(sha && { sha }) })
      })
    } catch {}
  }

  const updateSet = (type, setIdx, field, value) => {
    const newWorkout = JSON.parse(JSON.stringify(workout))
    const sets = type === 'warmup' ? newWorkout.exercises[currentExerciseIdx].warmupSets : newWorkout.exercises[currentExerciseIdx].workSets
    sets[setIdx] = { ...sets[setIdx], [field]: value }
    const newWorkouts = { ...workouts, [date]: newWorkout }
    setWorkouts(newWorkouts)
    saveAll(newWorkouts, exerciseNotes)
  }

  const toggleSetDone = (type, setIdx) => {
    const sets = type === 'warmup' ? workout.exercises[currentExerciseIdx].warmupSets : workout.exercises[currentExerciseIdx].workSets
    updateSet(type, setIdx, 'done', !sets[setIdx].done)
  }

  const copyFromPrevSet = (type, setIdx) => {
    const sets = type === 'warmup' ? workout.exercises[currentExerciseIdx].warmupSets : workout.exercises[currentExerciseIdx].workSets
    if (setIdx > 0 && sets[setIdx - 1].weight) {
      updateSet(type, setIdx, 'weight', sets[setIdx - 1].weight)
    } else if (type === 'work' && workout.exercises[currentExerciseIdx].warmupSets.length > 0) {
      const lastWarmup = workout.exercises[currentExerciseIdx].warmupSets[workout.exercises[currentExerciseIdx].warmupSets.length - 1]
      if (lastWarmup.weight) updateSet(type, setIdx, 'weight', lastWarmup.weight)
    }
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

  const changeDate = (days) => {
    const d = new Date(date)
    d.setDate(d.getDate() + days)
    const newDate = d.toISOString().split('T')[0]
    if (newDate > today) return
    setDate(newDate)
    setCurrentExerciseIdx(0)
  }

  const switchRoutine = () => {
    const newType = currentRoutineType === 'push' ? 'pull' : 'push'
    const newWorkout = {
      routineType: newType,
      exercises: routines[newType].exercises.map(ex => ({
        id: ex.id,
        name: ex.name,
        warmupSets: Array(ex.warmupSets).fill().map(() => ({ weight: '', reps: '', done: false })),
        workSets: Array(ex.workSets).fill().map(() => ({ weight: '', reps: '', done: false })),
        notes: exerciseNotes[ex.name] || ex.notes || ''
      })),
      completed: false
    }
    const newWorkouts = { ...workouts, [date]: newWorkout }
    setWorkouts(newWorkouts)
    setCurrentExerciseIdx(0)
    saveAll(newWorkouts, exerciseNotes)
  }

  const getSessionsThisYear = () => {
    const year = new Date().getFullYear()
    return Object.keys(workouts).filter(d => d.startsWith(year)).length
  }

  const getStreak = () => {
    const sortedDates = Object.keys(workouts).sort().reverse()
    let streak = 0
    let lastDate = new Date()
    for (const d of sortedDates) {
      const dt = new Date(d)
      const diff = Math.floor((lastDate - dt) / (1000 * 60 * 60 * 24))
      if (diff <= 3) {
        streak++
        lastDate = dt
      } else break
    }
    return streak
  }

  const getCurrentPhase = () => phases.find(p => !p.end)

  const getPhaseWorkouts = () => {
    const phase = getCurrentPhase()
    if (!phase) return 0
    return Object.keys(workouts).filter(d => d >= phase.start && (!phase.end || d <= phase.end)).length
  }

  const addExercise = (routineKey) => {
    const name = prompt('Exercise name:')
    if (!name) return
    const warmupSets = parseInt(prompt('Warmup sets:', '1')) || 1
    const workSets = parseInt(prompt('Work sets:', '2')) || 2
    const reps = prompt('Rep range:', '5-8') || '5-8'
    const newRoutines = JSON.parse(JSON.stringify(routines))
    const newId = Math.max(...newRoutines[routineKey].exercises.map(e => e.id), 0) + 1
    newRoutines[routineKey].exercises.push({ id: newId, name, warmupSets, workSets, reps, notes: '' })
    setRoutines(newRoutines)
    saveRoutines(newRoutines)
  }

  const deleteExercise = (routineKey, exerciseId) => {
    const newRoutines = JSON.parse(JSON.stringify(routines))
    newRoutines[routineKey].exercises = newRoutines[routineKey].exercises.filter(e => e.id !== exerciseId)
    setRoutines(newRoutines)
    saveRoutines(newRoutines)
  }

  const moveExercise = (routineKey, exerciseId, direction) => {
    const newRoutines = JSON.parse(JSON.stringify(routines))
    const exercises = newRoutines[routineKey].exercises
    const idx = exercises.findIndex(e => e.id === exerciseId)
    if ((direction === -1 && idx > 0) || (direction === 1 && idx < exercises.length - 1)) {
      [exercises[idx], exercises[idx + direction]] = [exercises[idx + direction], exercises[idx]]
      setRoutines(newRoutines)
      saveRoutines(newRoutines)
    }
  }

  const editExercise = (routineKey, exerciseId) => {
    const exercise = routines[routineKey].exercises.find(e => e.id === exerciseId)
    const name = prompt('Exercise name:', exercise.name)
    if (!name) return
    const warmupSets = parseInt(prompt('Warmup sets:', exercise.warmupSets)) || 1
    const workSets = parseInt(prompt('Work sets:', exercise.workSets)) || 2
    const reps = prompt('Rep range:', exercise.reps) || '5-8'
    const newRoutines = JSON.parse(JSON.stringify(routines))
    const idx = newRoutines[routineKey].exercises.findIndex(e => e.id === exerciseId)
    newRoutines[routineKey].exercises[idx] = { ...exercise, name, warmupSets, workSets, reps }
    setRoutines(newRoutines)
    saveRoutines(newRoutines)
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

  const connectBodyTracker = () => {
    const newGithub = { ...bodyTrackerGithub, connected: true }
    setBodyTrackerGithub(newGithub)
    localStorage.setItem('gymtracker_body_github', JSON.stringify(newGithub))
    loadPhasesFromBodyTracker(newGithub)
  }

  const disconnectBodyTracker = () => {
    setBodyTrackerGithub({ token: '', repo: '', owner: '', connected: false })
    localStorage.setItem('gymtracker_body_github', JSON.stringify({ token: '', repo: '', owner: '', connected: false }))
    setPhases([])
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

  return (
    <div className="app">
      <header className="header"><h1>Gym Tracker</h1></header>

      <main className="content">
        {tab === 'log' && currentExercise && (
          <div className="log-page">
            <div className="date-row">
              <button onClick={() => changeDate(-1)}>&lt;</button>
              <input type="date" value={date} max={today} onChange={(e) => e.target.value <= today && setDate(e.target.value)} />
              <button onClick={() => changeDate(1)} disabled={isToday} className={isToday ? 'disabled' : ''}>&gt;</button>
            </div>

            <div className="routine-header">
              <button className="routine-switch" onClick={switchRoutine}>{currentRoutine.name}</button>
              <span className="exercise-count">{currentExerciseIdx + 1} / {workout.exercises.length}</span>
            </div>

            <div className="exercise-nav">
              <button onClick={prevExercise} disabled={currentExerciseIdx === 0}>&lt;</button>
              <h2 className="exercise-name">{currentExercise.name}</h2>
              <button onClick={nextExercise} disabled={currentExerciseIdx === workout.exercises.length - 1}>&gt;</button>
            </div>

            {lastData && <div className="last-workout">Last: {lastData.weight}kg x {lastData.reps}</div>}

            <div className="sets-section">
              {currentExercise.warmupSets.length > 0 && (
                <>
                  <div className="sets-label">Warm-up</div>
                  {currentExercise.warmupSets.map((set, idx) => (
                    <div key={`w${idx}`} className={`set-row ${set.done ? 'done' : ''}`}>
                      <span className="set-num">W{idx + 1}</span>
                      <input type="number" inputMode="decimal" placeholder="kg" value={set.weight} onChange={(e) => updateSet('warmup', idx, 'weight', e.target.value)} onFocus={() => !set.weight && copyFromPrevSet('warmup', idx)} />
                      <span className="set-x">x</span>
                      <input type="number" inputMode="numeric" placeholder={routineTemplate?.reps || 'reps'} value={set.reps} onChange={(e) => updateSet('warmup', idx, 'reps', e.target.value)} />
                      <button className={`check-btn ${set.done ? 'checked' : ''}`} onClick={() => toggleSetDone('warmup', idx)}>{set.done ? '✓' : '○'}</button>
                    </div>
                  ))}
                </>
              )}

              <div className="sets-label">Working Sets</div>
              {currentExercise.workSets.map((set, idx) => (
                <div key={`s${idx}`} className={`set-row work ${set.done ? 'done' : ''}`}>
                  <span className="set-num">{idx + 1}</span>
                  <input type="number" inputMode="decimal" placeholder="kg" value={set.weight} onChange={(e) => updateSet('work', idx, 'weight', e.target.value)} onFocus={() => !set.weight && copyFromPrevSet('work', idx)} />
                  <span className="set-x">x</span>
                  <input type="number" inputMode="numeric" placeholder={routineTemplate?.reps || 'reps'} value={set.reps} onChange={(e) => updateSet('work', idx, 'reps', e.target.value)} />
                  <button className={`check-btn ${set.done ? 'checked' : ''}`} onClick={() => toggleSetDone('work', idx)}>{set.done ? '✓' : '○'}</button>
                </div>
              ))}
            </div>

            <div className="notes-section">
              <textarea placeholder="Notes (e.g., seat position, grip width...)" value={currentExercise.notes} onChange={(e) => updateExerciseNote(e.target.value)} />
            </div>

            {syncStatus && <div className="sync-status">{syncStatus}</div>}
          </div>
        )}

        {tab === 'routines' && (
          <div className="routines-page">
            {Object.entries(routines).map(([key, routine]) => (
              <div key={key} className="routine-section">
                <h3>{routine.name}</h3>
                <div className="exercise-list">
                  {routine.exercises.map((ex, idx) => (
                    <div key={ex.id} className="exercise-item">
                      <div className="exercise-info">
                        <span className="exercise-title">{ex.name}</span>
                        <span className="exercise-sets">{ex.warmupSets}W + {ex.workSets}S · {ex.reps}</span>
                      </div>
                      <div className="exercise-actions">
                        <button onClick={() => moveExercise(key, ex.id, -1)} disabled={idx === 0}>↑</button>
                        <button onClick={() => moveExercise(key, ex.id, 1)} disabled={idx === routine.exercises.length - 1}>↓</button>
                        <button onClick={() => editExercise(key, ex.id)}>Edit</button>
                        <button className="del" onClick={() => deleteExercise(key, ex.id)}>×</button>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="add-btn" onClick={() => addExercise(key)}>+ Add Exercise</button>
              </div>
            ))}
          </div>
        )}

        {tab === 'stats' && (
          <div className="stats-page">
            <div className="stat-cards">
              <div className="stat-card">
                <span className="stat-value">{getSessionsThisYear()}</span>
                <span className="stat-label">Sessions {new Date().getFullYear()}</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{getStreak()}</span>
                <span className="stat-label">Current Streak</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{getPhaseWorkouts()}</span>
                <span className="stat-label">This Phase</span>
              </div>
            </div>

            {getCurrentPhase() && (
              <div className="phase-info-card">
                <h3>{getCurrentPhase().name}</h3>
                <span className="phase-dates">{getCurrentPhase().start} → ongoing</span>
                {getCurrentPhase().goals && (
                  <div className="phase-goals">
                    {getCurrentPhase().goals.weight && <span>W: {getCurrentPhase().goals.weight}kg</span>}
                    {getCurrentPhase().goals.bodyFat && <span>BF: {getCurrentPhase().goals.bodyFat}%</span>}
                    {getCurrentPhase().goals.musclePct && <span>M: {getCurrentPhase().goals.musclePct}%</span>}
                  </div>
                )}
              </div>
            )}

            <div className="recent-workouts">
              <h3>Recent Workouts</h3>
              {Object.keys(workouts).sort().reverse().slice(0, 10).map(d => (
                <div key={d} className="workout-item">
                  <span className="workout-date">{d}</span>
                  <span className="workout-type">{workouts[d].routineType?.toUpperCase()}</span>
                </div>
              ))}
              {Object.keys(workouts).length === 0 && <p className="empty">No workouts yet</p>}
            </div>
          </div>
        )}

        {tab === 'settings' && (
          <div className="settings-page">
            <h2>Workout Data Sync</h2>
            {!github.connected ? (
              <div className="form">
                <div className="field"><label>Token</label><input type="password" value={github.token} onChange={(e) => setGithub({...github, token: e.target.value})} placeholder="ghp_..." /></div>
                <div className="field"><label>Owner</label><input value={github.owner} onChange={(e) => setGithub({...github, owner: e.target.value})} placeholder="username" /></div>
                <div className="field"><label>Repo</label><input value={github.repo} onChange={(e) => setGithub({...github, repo: e.target.value})} placeholder="gym-tracker-data" /></div>
                <button className="primary-btn" onClick={connectGithub}>Connect</button>
              </div>
            ) : (
              <div className="connected-info">
                <p>Connected to {github.owner}/{github.repo}</p>
                <button className="danger-btn" onClick={disconnectGithub}>Disconnect</button>
              </div>
            )}

            <h2>Body Tracker (Phases)</h2>
            {!bodyTrackerGithub.connected ? (
              <div className="form">
                <div className="field"><label>Token</label><input type="password" value={bodyTrackerGithub.token} onChange={(e) => setBodyTrackerGithub({...bodyTrackerGithub, token: e.target.value})} placeholder="ghp_..." /></div>
                <div className="field"><label>Owner</label><input value={bodyTrackerGithub.owner} onChange={(e) => setBodyTrackerGithub({...bodyTrackerGithub, owner: e.target.value})} placeholder="username" /></div>
                <div className="field"><label>Repo</label><input value={bodyTrackerGithub.repo} onChange={(e) => setBodyTrackerGithub({...bodyTrackerGithub, repo: e.target.value})} placeholder="body-tracker-data" /></div>
                <button className="primary-btn" onClick={connectBodyTracker}>Connect</button>
              </div>
            ) : (
              <div className="connected-info">
                <p>Phases from {bodyTrackerGithub.owner}/{bodyTrackerGithub.repo}</p>
                <button className="danger-btn" onClick={disconnectBodyTracker}>Disconnect</button>
              </div>
            )}

            {syncStatus && <div className="sync-status">{syncStatus}</div>}
            <h2>App</h2>
            <button className="primary-btn" onClick={() => window.location.reload()}>Reload App</button>
          </div>
        )}
      </main>

      <nav className="navbar">
        <button className={tab === 'log' ? 'active' : ''} onClick={() => setTab('log')}><span className="nav-icon">🏋️</span><span>Log</span></button>
        <button className={tab === 'routines' ? 'active' : ''} onClick={() => setTab('routines')}><span className="nav-icon">📋</span><span>Routines</span></button>
        <button className={tab === 'stats' ? 'active' : ''} onClick={() => setTab('stats')}><span className="nav-icon">📊</span><span>Stats</span></button>
        <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}><span className="nav-icon">⚙️</span><span>Settings</span></button>
      </nav>
    </div>
  )
}

export default App
