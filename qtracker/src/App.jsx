// ========================================== //
// === SECTION 1: IMPORTS & CONFIGURATION === //
// ========================================== //
import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Auth from './Auth'

// Static data used for dropdown menus throughout the app
const VENUE_CLASSES = {
  AKC: ['JWW', 'STD', 'FAST', 'Premier', 'T2B', 'ISC J', 'ISC A'],
  UKI: ['Jumping', 'Agility', 'Gamblers', 'Snookers', 'Masters Jumping', 'Masters Agility', 'Speedstakes']
}
const CLASS_LEVELS = {
  AKC: ['Novice', 'Open', 'Excellent', 'Master'],
  UKI: ['Beginner', 'Novice', 'Senior', 'Champ']
}
const NQ_REASONS = ['wrong course', 'refusal', 'bar', 'a-frame', 'teeter', 'dogwalk', 'other']

// Helper to determine the correct levels based on Venue and Class (Handles ISC exceptions)
const getLevelsForClass = (venue, className) => {
  if (!venue) return []
  if (venue === 'AKC' && (className === 'ISC J' || className === 'ISC A')) {
    return ['1', '2', '3']
  }
  return CLASS_LEVELS[venue] || []
}

export default function App() {
  // ========================================== //
  // === SECTION 2: STATE INITIALIZATION    === //
  // ========================================== //
  
  // App Core State
  const [session, setSession] = useState(null)
  const [activeTab, setActiveTab] = useState('my-pack')
  const [dogs, setDogs] = useState([])
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  // Forms State
  const [dogForm, setDogForm] = useState({ regName: '', callName: '', dob: '', breed: '', akcHt: '', ukiHt: '' })
  const [trialInfo, setTrialInfo] = useState({ dog_id: '', venue: 'AKC', trial_date: '', location: '', judge_name: '' })
  // NOTE: placement is initialized here
  const [runs, setRuns] = useState([{ class_name: '', class_level: '', jump_height: '', is_q: false, nq_reason: '', comments: '', yps: '', course_time: '', placement: '' }])
  const [titleForm, setTitleForm] = useState({ dog_id: '', venue: 'AKC', class_type: '', current_level: '', initialQs: 0, initialMachPoints: 0, initialMachQQs: 0 })
  const [newPassword, setNewPassword] = useState('') // For the Settings Tab

  // Dashboard & Tracking State
  const [trials, setTrials] = useState([])
  const [titles, setTitles] = useState([])
  const [dashboardFilters, setDashboardFilters] = useState({ dogId: '', dateFrom: '', dateTo: '', venue: '', sortBy: 'date-desc' })
  const [dashboardView, setDashboardView] = useState('list') 

  // Editing Modals State
  const [editingDog, setEditingDog] = useState(null)
  const [editDogForm, setEditDogForm] = useState({ id: '', regName: '', callName: '', dob: '', breed: '', akcHt: '', ukiHt: '' })
  const [editingTrial, setEditingTrial] = useState(null)
  const [editTrialForm, setEditTrialForm] = useState({})
  const [editRuns, setEditRuns] = useState([])


  // ========================================== //
  // === SECTION 3: LIFECYCLE & DATA FETCHING== //
  // ========================================== //

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) {
      fetchDogs()
      fetchTitles()
      fetchTrials() 
    }
  }, [session])

  const fetchDogs = async () => {
    const { data } = await supabase.from('dog_info').select('*').order('call_name')
    if (data) setDogs(data)
  }

  const fetchTitles = async () => {
    const { data } = await supabase.from('title_progress').select('*, dog_info(call_name)')
    if (data) setTitles(data)
  }

  const fetchTrials = async () => {
    let query = supabase.from('trials').select('*, dog_info(call_name), trial_runs(*)')
    if (dashboardFilters.dogId) query = query.eq('dog_id', dashboardFilters.dogId)
    if (dashboardFilters.venue) query = query.eq('venue', dashboardFilters.venue)
    if (dashboardFilters.dateFrom) query = query.gte('trial_date', dashboardFilters.dateFrom)
    if (dashboardFilters.dateTo) query = query.lte('trial_date', dashboardFilters.dateTo)

    let { data } = await query.order('trial_date', { ascending: dashboardFilters.sortBy === 'date-asc' })
    if (data) setTrials(data)
  }

  useEffect(() => {
    if (session && activeTab === 'dashboard') fetchTrials()
  }, [session, activeTab, dashboardFilters])


  // ========================================== //
  // === SECTION 4: SMART DEFAULTS          === //
  // ========================================== //
  
  useEffect(() => {
  if (!trialInfo.dog_id || !trialInfo.venue) return

  const selectedDog = dogs.find(d => d.id === trialInfo.dog_id)
  const defaultHeight = selectedDog?.venue_height?.[trialInfo.venue] || ''

  // Find the most recent trial for this dog+venue combo
  const relevantTrials = trials
    .filter(t => t.dog_id === trialInfo.dog_id && t.venue === trialInfo.venue)
    .sort((a, b) => new Date(b.trial_date) - new Date(a.trial_date))
  const lastRun = relevantTrials[0]?.trial_runs?.[0]
  const lastLevel = lastRun?.class_level || ''

  setRuns(prev => prev.map(run => ({
    ...run,
    jump_height: run.jump_height || defaultHeight,
    class_level: run.class_level || lastLevel
  })))
}, [trialInfo.dog_id, trialInfo.venue, dogs, trials])


  // ========================================== //
  // === SECTION 5: DOG MGMT & SETTINGS     === //
  // ========================================== //

  const saveDog = async (e) => {
    e.preventDefault()
    const { error } = await supabase.from('dog_info').insert([{
      registered_name: dogForm.regName, call_name: dogForm.callName, dob: dogForm.dob,
      breed: dogForm.breed, venue_height: { AKC: dogForm.akcHt, UKI: dogForm.ukiHt }
    }])
    if (error) alert(error.message)
    else { alert("Dog Added!"); fetchDogs(); setActiveTab('my-pack'); setDogForm({ regName: '', callName: '', dob: '', breed: '', akcHt: '', ukiHt: '' }) }
  }

  const startEditDog = (dog) => {
    setEditingDog(dog.id)
    setEditDogForm({
      id: dog.id, regName: dog.registered_name || '', callName: dog.call_name || '',
      dob: dog.dob || '', breed: dog.breed || '', akcHt: dog.venue_height?.AKC || '', ukiHt: dog.venue_height?.UKI || ''
    })
  }

  const saveEditedDog = async (e) => {
    e.preventDefault()
    const { error } = await supabase.from('dog_info').update({
      registered_name: editDogForm.regName, call_name: editDogForm.callName, dob: editDogForm.dob,
      breed: editDogForm.breed, venue_height: { AKC: editDogForm.akcHt, UKI: editDogForm.ukiHt }
    }).eq('id', editDogForm.id)
    if (error) alert(error.message)
    else { alert("Dog Updated!"); setEditingDog(null); fetchDogs() }
  }

  const deleteDog = async (id) => {
    if (window.confirm("CRITICAL WARNING: Delete dog? This permanently deletes ALL their trials, runs, and titles.")) {
      const { error } = await supabase.from('dog_info').delete().eq('id', id)
      if (error) alert(error.message)
      else { fetchDogs(); fetchTrials(); fetchTitles() }
    }
  }

  const handleUpdatePassword = async (e) => {
    e.preventDefault()
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      alert("Error updating password: " + error.message)
    } else {
      alert("Password updated successfully!")
      setNewPassword('')
      setActiveTab('my-pack')
    }
  }


  // ========================================== //
  // === SECTION 6: TRIAL LOGGING LOGIC     === //
  // ========================================== //

  const addRunRow = () => {
    const selectedDog = dogs.find(d => d.id === trialInfo.dog_id)
    const defaultHeight = selectedDog?.venue_height?.[trialInfo.venue] || ''
    const lastLevel = runs[runs.length - 1]?.class_level || '' 
    setRuns([...runs, { class_name: '', class_level: lastLevel, jump_height: defaultHeight, is_q: false, nq_reason: '', comments: '', yps: '', course_time: '', placement: '' }])
  }
  
  const removeRunRow = (index) => { if (runs.length > 1) setRuns(runs.filter((_, i) => i !== index)) }
  
  const updateRun = (index, field, value) => { 
    const newRuns = [...runs]; 
    newRuns[index][field] = value; 
    // Auto-reset the level if the class changes to one with different level rules (like ISC)
    if (field === 'class_name') {
      const validLevels = getLevelsForClass(trialInfo.venue, value)
      if (!validLevels.includes(newRuns[index].class_level)) newRuns[index].class_level = '' 
    }
    setRuns(newRuns) 
  }

const saveTrial = async (e) => {
  e.preventDefault()

  // Detect a Double Q (QQ): AKC, same day, both Masters STD and Masters JWW are Q
  const isMastersSTDQ = runs.some(r => r.class_name === 'STD' && r.class_level === 'Master' && r.is_q)
  const isMastersJWWQ = runs.some(r => r.class_name === 'JWW' && r.class_level === 'Master' && r.is_q)
  const earnedQQ = trialInfo.venue === 'AKC' && isMastersSTDQ && isMastersJWWQ

  if (earnedQQ) {
    const confirmed = window.confirm("🎉 It looks like you earned a Double Q (QQ) today! Confirm to record this as a QQ toward your MACH.")
    if (!confirmed) return
  }

  const { data, error: tErr } = await supabase.from('trials').insert([trialInfo]).select()
  if (tErr) return alert(tErr.message)

  const runsWithId = runs.map(run => ({
    ...run,
    trial_id: data[0].id,
    yps: run.yps === '' ? null : parseFloat(run.yps),
    course_time: run.course_time === '' ? null : parseFloat(run.course_time),
    placement: run.placement === '' ? null : parseInt(run.placement),
    mach_points: run.mach_points === '' || run.mach_points == null ? null : parseInt(run.mach_points)
  }))

  const { error: rErr } = await supabase.from('trial_runs').insert(runsWithId)
  if (rErr) return alert(rErr.message)

  // Standard title Q tracking
  for (const run of runs) {
    if (run.is_q) {
      const { data: tracker } = await supabase.from('title_progress').select('*').eq('dog_id', trialInfo.dog_id).eq('venue', trialInfo.venue).eq('class_type', run.class_name).eq('current_level', run.class_level).maybeSingle()
      if (tracker) {
        const newInApp = (tracker.qs_earned_in_app || 0) + 1
        await supabase.from('title_progress').update({ qs_earned_in_app: newInApp, is_completed: (tracker.qs_earned_manually + newInApp) >= tracker.required_qs }).eq('id', tracker.id)
      }
    }
  }

  // MACH tracker: update points and QQs
  if (trialInfo.venue === 'AKC') {
    const { data: machTracker } = await supabase.from('title_progress').select('*').eq('dog_id', trialInfo.dog_id).eq('venue', 'AKC').eq('class_type', 'MACH').maybeSingle()
    if (machTracker) {
      const newQQs = (machTracker.mach_qqs || 0) + (earnedQQ ? 1 : 0)
      const pointsEarned = runs
        .filter(r => r.is_q && r.class_level === 'Master' && (r.class_name === 'STD' || r.class_name === 'JWW') && r.mach_points)
        .reduce((sum, r) => sum + parseInt(r.mach_points || 0), 0)
      const newPoints = (machTracker.mach_points || 0) + pointsEarned
      const isCompleted = newPoints >= 750 && newQQs >= 20
      await supabase.from('title_progress').update({ mach_points: newPoints, mach_qqs: newQQs, is_completed: isCompleted }).eq('id', machTracker.id)
    }
  }

  alert("Trial Saved!"); fetchTrials(); fetchTitles(); setActiveTab('dashboard')
}

    // Formats text input into numbers for the database
    const runsWithId = runs.map(run => ({ 
      ...run, 
      trial_id: data[0].id, 
      yps: run.yps === '' ? null : parseFloat(run.yps), 
      course_time: run.course_time === '' ? null : parseFloat(run.course_time),
      placement: run.placement === '' ? null : parseInt(run.placement)
    }))
    
    const { error: rErr } = await supabase.from('trial_runs').insert(runsWithId)
    if (rErr) return alert(rErr.message)

    // Title Tracking auto-incrementer
    for (const run of runs) {
      if (run.is_q) {
        const { data: tracker } = await supabase.from('title_progress').select('*').eq('dog_id', trialInfo.dog_id).eq('venue', trialInfo.venue).eq('class_type', run.class_name).eq('current_level', run.class_level).maybeSingle()
        if (tracker) {
          const newInApp = (tracker.qs_earned_in_app || 0) + 1
          await supabase.from('title_progress').update({ qs_earned_in_app: newInApp, is_completed: (tracker.qs_earned_manually + newInApp) >= tracker.required_qs }).eq('id', tracker.id)
        }
      }
    }
    alert("Trial Saved!"); fetchTrials(); fetchTitles(); setActiveTab('dashboard')
  }


  // ========================================== //
  // === SECTION 7: TITLE TRACKING LOGIC    === //
  // ========================================== //

const handleStartTitleTracking = async (e) => {
  e.preventDefault()
  const isMACH = titleForm.class_type === 'MACH'
  const req = isMACH ? null : (titleForm.venue === 'AKC' && titleForm.current_level === 'Master') ? 10 : 3

  const { error } = await supabase.from('title_progress').insert([{
    dog_id: titleForm.dog_id,
    venue: titleForm.venue,
    class_type: titleForm.class_type,
    current_level: isMACH ? null : titleForm.current_level,
    qs_earned_manually: isMACH ? 0 : parseInt(titleForm.initialQs || 0),
    required_qs: req,
    mach_points: isMACH ? parseInt(titleForm.initialMachPoints || 0) : null,
    mach_qqs: isMACH ? parseInt(titleForm.initialMachQQs || 0) : null,
  }])
  if (error) alert(error.message)
  else {
    fetchTitles()
    setTitleForm({ dog_id: titleForm.dog_id, venue: 'AKC', class_type: '', current_level: '', initialQs: 0, initialMachPoints: 0, initialMachQQs: 0 })
  }
}
  const deleteTitle = (id) => { if (window.confirm("Delete tracker?")) supabase.from('title_progress').delete().eq('id', id).then(fetchTitles) }


  // ========================================== //
  // === SECTION 8: TRIAL EDITING LOGIC     === //
  // ========================================== //

  const startEditTrial = (trial) => { setEditingTrial(trial.id); setEditTrialForm({ ...trial }); setEditRuns(trial.trial_runs || []) }
  
  const updateEditRun = (index, field, value) => { 
    const newRuns = [...editRuns]; 
    newRuns[index][field] = value; 
    if (field === 'class_name') {
      const validLevels = getLevelsForClass(editTrialForm.venue, value)
      if (!validLevels.includes(newRuns[index].class_level)) newRuns[index].class_level = '' 
    }
    setEditRuns(newRuns) 
  }

  const addEditRunRow = () => setEditRuns([...editRuns, { class_name: '', class_level: '', jump_height: '', is_q: false, nq_reason: '', comments: '', yps: '', course_time: '', placement: '' }])
  const removeEditRunRow = (index) => { if (editRuns.length > 1) setEditRuns(editRuns.filter((_, i) => i !== index)) }
  
  const saveEditedTrial = async (e) => {
    e.preventDefault()
    await supabase.from('trials').update({ dog_id: editTrialForm.dog_id, venue: editTrialForm.venue, trial_date: editTrialForm.trial_date, location: editTrialForm.location, judge_name: editTrialForm.judge_name }).eq('id', editTrialForm.id)
    await supabase.from('trial_runs').delete().eq('trial_id', editTrialForm.id)
    const runsWithId = editRuns.map(run => ({ 
      ...run, 
      trial_id: editTrialForm.id, 
      yps: run.yps === '' ? null : parseFloat(run.yps), 
      course_time: run.course_time === '' ? null : parseFloat(run.course_time),
      placement: run.placement === '' ? null : parseInt(run.placement)
    }))
    await supabase.from('trial_runs').insert(runsWithId)
    setEditingTrial(null); fetchTrials()
  }


  // ========================================== //
  // === SECTION 9: STYLING HELPERS         === //
  // ========================================== //

  const navContainerStyle = isMobile ? {
    position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTop: '1px solid #ddd', 
    display: 'flex', justifyContent: 'space-around', padding: '10px 5px', zIndex: 999, boxShadow: '0 -2px 10px rgba(0,0,0,0.1)'
  } : { display: 'flex', gap: '5px', marginBottom: '20px', flexWrap: 'wrap' }

  const getTabStyle = (tab) => {
    if (isMobile) {
      return { flex: 1, padding: '8px 4px', fontSize: '0.8em', border: 'none', background: 'transparent', color: activeTab === tab ? '#007bff' : '#666', fontWeight: activeTab === tab ? 'bold' : 'normal', borderBottom: activeTab === tab ? '3px solid #007bff' : '3px solid transparent', textTransform: 'capitalize' }
    }
    return { padding: '10px', flex: 1, cursor: 'pointer', border: 'none', borderRadius: '4px', textTransform: 'capitalize', backgroundColor: activeTab === tab ? '#007bff' : '#f0f0f0', color: activeTab === tab ? 'white' : 'black' }
  }

  // Force login if no session
  if (!session) return <div style={{ padding: '50px' }}><Auth /></div>


 // ========================================== //
  // === SECTION 10: MAIN RENDER (JSX)      === //
  // ========================================== //
  return (
    // Note: paddingBottom is now 120px on mobile to clear the bottom nav bar completely
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px', paddingBottom: isMobile ? '120px' : '20px', fontFamily: 'sans-serif' }}>
      
      {/* Gentle CSS Reset: Fixes width issues without breaking vertical scrolling */}
      <style>{`
        * {
          box-sizing: border-box;
        }
        body {
          margin: 0;
          padding: 0;
        }
      `}</style>

      {/* HEADER */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', marginBottom: '15px' }}>
        <h2>Trial Tracker</h2>
        <button onClick={() => supabase.auth.signOut()} style={{ background: 'none', border: 'none', color: 'red', cursor: 'pointer' }}>Sign Out</button>
      </header>

      {/* NAVIGATION */}
      <nav style={navContainerStyle}>
        {['my-pack', 'add-dog', 'log-trial', 'titles', 'dashboard', 'settings'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={getTabStyle(tab)}>{tab.replace('-', ' ')}</button>
        ))}
      </nav>

      {/* === TAB VIEW: MY PACK === */}
      {activeTab === 'my-pack' && (
        <div>
          <h3>Your Dogs</h3>
          {dogs.length === 0 ? <p>No dogs yet.</p> : dogs.map(dog => (
            <div key={dog.id} style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '8px', marginBottom: '10px', position: 'relative' }}>
              <div style={{ position: 'absolute', right: '10px', top: '10px', display: 'flex', gap: '15px' }}>
                 <button onClick={() => startEditDog(dog)} style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', fontWeight: 'bold' }}>Edit</button>
                 <button onClick={() => deleteDog(dog.id)} style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
              </div>
              <strong style={{ fontSize: '1.2em' }}>{dog.call_name}</strong> <span style={{ color: '#666' }}>({dog.breed})</span>
              <div style={{ marginTop: '5px', fontSize: '0.9em', color: '#444' }}>
                 {dog.registered_name && <div>Reg: <em>{dog.registered_name}</em></div>}
                 <div>AKC: {dog.venue_height?.AKC || 'N/A'}" | UKI: {dog.venue_height?.UKI || 'N/A'}"</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* === TAB VIEW: ADD DOG === */}
      {activeTab === 'add-dog' && (
        <form onSubmit={saveDog} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h3>Register New Dog</h3>
          <input placeholder="Call Name" required value={dogForm.callName} onChange={e => setDogForm({...dogForm, callName: e.target.value})} style={{ padding: '10px', boxSizing: 'border-box' }}/>
          <input placeholder="Registered Name" value={dogForm.regName} onChange={e => setDogForm({...dogForm, regName: e.target.value})} style={{ padding: '10px', boxSizing: 'border-box' }}/>
          <input type="date" value={dogForm.dob} onChange={e => setDogForm({...dogForm, dob: e.target.value})} style={{ padding: '10px', boxSizing: 'border-box' }}/>
          <input placeholder="Breed" value={dogForm.breed} onChange={e => setDogForm({...dogForm, breed: e.target.value})} style={{ padding: '10px', boxSizing: 'border-box' }}/>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <input type="number" inputMode="decimal" placeholder="AKC Ht" value={dogForm.akcHt} onChange={e => setDogForm({...dogForm, akcHt: e.target.value})} style={{ padding: '10px', boxSizing: 'border-box' }}/>
            <input type="number" inputMode="decimal" placeholder="UKI Ht" value={dogForm.ukiHt} onChange={e => setDogForm({...dogForm, ukiHt: e.target.value})} style={{ padding: '10px', boxSizing: 'border-box' }}/>
          </div>
          <button type="submit" style={{ padding: '12px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', boxSizing: 'border-box' }}>Save Dog</button>
        </form>
      )}

      {/* === TAB VIEW: LOG TRIAL === */}
{activeTab === 'log-trial' && (
  <form onSubmit={saveTrial}>
    <h3>Log Trial</h3>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
      <select required value={trialInfo.dog_id} onChange={e => setTrialInfo({...trialInfo, dog_id: e.target.value})} style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc', width: '100%', boxSizing: 'border-box' }}>
        <option value="">Select Dog</option>{dogs.map(d => <option key={d.id} value={d.id}>{d.call_name}</option>)}
      </select>
      <select value={trialInfo.venue} onChange={e => setTrialInfo({...trialInfo, venue: e.target.value})} style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc', width: '100%', boxSizing: 'border-box' }}>
        <option value="AKC">AKC</option><option value="UKI">UKI</option>
      </select>
      <input type="date" required value={trialInfo.trial_date} onChange={e => setTrialInfo({...trialInfo, trial_date: e.target.value})} style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc', width: '100%', boxSizing: 'border-box' }} />
      <input placeholder="Location" value={trialInfo.location} onChange={e => setTrialInfo({...trialInfo, location: e.target.value})} style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc', width: '100%', boxSizing: 'border-box' }} />
      <input placeholder="Judge Name" value={trialInfo.judge_name} onChange={e => setTrialInfo({...trialInfo, judge_name: e.target.value})} style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc', width: '100%', boxSizing: 'border-box', gridColumn: '1 / -1' }} />
    </div>

    {runs.map((run, i) => (
      <div key={i} style={{ background: '#f9f9f9', padding: '15px', marginBottom: '10px', border: '1px solid #e0e0e0', borderRadius: '8px', position: 'relative' }}>
        {runs.length > 1 && (
          <button type="button" onClick={() => removeRunRow(i)} style={{ position: 'absolute', right: '10px', top: '10px', border: 'none', background: 'none', fontSize: '1.1em', color: '#bbb', cursor: 'pointer', lineHeight: 1 }}>✕</button>
        )}

        <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', fontSize: '0.85em', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Run {i + 1}</p>

        {/* Row 1: Class | Level | Height */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr', gap: '8px', marginBottom: '8px' }}>
          <select required value={run.class_name} onChange={e => updateRun(i, 'class_name', e.target.value)} style={{ padding: '9px 8px', borderRadius: '4px', border: '1px solid #ccc', width: '100%', boxSizing: 'border-box', fontSize: '0.95em' }}>
            <option value="">Class</option>{VENUE_CLASSES[trialInfo.venue].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select required value={run.class_level} onChange={e => updateRun(i, 'class_level', e.target.value)} style={{ padding: '9px 8px', borderRadius: '4px', border: '1px solid #ccc', width: '100%', boxSizing: 'border-box', fontSize: '0.95em' }}>
            <option value="">Level</option>{getLevelsForClass(trialInfo.venue, run.class_name).map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <input inputMode="decimal" placeholder="Ht" value={run.jump_height} onChange={e => updateRun(i, 'jump_height', e.target.value)} style={{ padding: '9px 8px', borderRadius: '4px', border: '1px solid #ccc', width: '100%', boxSizing: 'border-box', fontSize: '0.95em' }} />
        </div>

        {/* Row 2: YPS | Time | Place */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
          <input type="number" step="0.01" inputMode="decimal" placeholder="YPS" value={run.yps} onChange={e => updateRun(i, 'yps', e.target.value)} style={{ padding: '9px 8px', borderRadius: '4px', border: '1px solid #ccc', width: '100%', boxSizing: 'border-box', fontSize: '0.95em' }} />
          <input type="number" step="0.01" inputMode="decimal" placeholder="Time (s)" value={run.course_time} onChange={e => updateRun(i, 'course_time', e.target.value)} style={{ padding: '9px 8px', borderRadius: '4px', border: '1px solid #ccc', width: '100%', boxSizing: 'border-box', fontSize: '0.95em' }} />
          <input type="number" inputMode="numeric" placeholder="Place" value={run.placement} onChange={e => updateRun(i, 'placement', e.target.value)} style={{ padding: '9px 8px', borderRadius: '4px', border: '1px solid #ccc', width: '100%', boxSizing: 'border-box', fontSize: '0.95em' }} />
        </div>

        {/* MACH Points field — only shown for AKC Masters STD or JWW that is a Q */}
        {trialInfo.venue === 'AKC' && (run.class_level === 'Master') && (run.class_name === 'STD' || run.class_name === 'JWW') && run.is_q && (
          <div style={{ marginBottom: '8px' }}>
            <input
              type="number"
              inputMode="numeric"
              placeholder="MACH Points earned"
              value={run.mach_points || ''}
              onChange={e => updateRun(i, 'mach_points', e.target.value)}
              style={{ width: '100%', padding: '9px 8px', borderRadius: '4px', border: '1px solid #ffe082', background: '#fff8e1', boxSizing: 'border-box', fontSize: '0.95em' }}
            />
          </div>
        )}

        {/* Row 3: Q checkbox + NQ reason */}
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', whiteSpace: 'nowrap', padding: '9px 12px', background: run.is_q ? '#d4edda' : '#f8f8f8', border: '1px solid', borderColor: run.is_q ? '#c3e6cb' : '#ccc', borderRadius: '4px', cursor: 'pointer' }}>
            <input type="checkbox" checked={run.is_q} onChange={e => updateRun(i, 'is_q', e.target.checked)} style={{ transform: 'scale(1.2)' }} />
            {run.is_q ? '✅ Q' : 'Q?'}
          </label>
          {!run.is_q
            ? <select value={run.nq_reason} onChange={e => updateRun(i, 'nq_reason', e.target.value)} style={{ padding: '9px 8px', borderRadius: '4px', border: '1px solid #ccc', width: '100%', boxSizing: 'border-box', fontSize: '0.95em' }}>
                <option value="">NQ Reason</option>{NQ_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            : <div style={{ padding: '9px 8px', color: '#888', fontSize: '0.9em' }}>Qualified! 🎉</div>
          }
        </div>

        {/* Row 4: Comments */}
        <textarea rows={2} placeholder="Comments" value={run.comments} onChange={e => updateRun(i, 'comments', e.target.value)} style={{ width: '100%', padding: '9px 8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box', fontSize: '0.95em', resize: 'vertical', fontFamily: 'sans-serif' }} />
      </div>
    ))}

    <button type="button" onClick={addRunRow} style={{ width: '100%', padding: '12px', marginBottom: '10px', border: '2px dashed #ccc', background: 'transparent', borderRadius: '6px', cursor: 'pointer', color: '#666', fontSize: '0.95em' }}>
      + Add Run
    </button>
    <button type="submit" style={{ width: '100%', padding: '14px', background: '#007bff', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1em' }}>
      Save Trial
    </button>
  </form>
)}

      {/* === TAB VIEW: TITLES === */}
      {activeTab === 'titles' && (
  <div>
    <h3>Title Progress</h3>
    <form onSubmit={handleStartTitleTracking} style={{ background: '#f9f9f9', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
      <select required value={titleForm.dog_id} style={{ width: '100%', marginBottom: '10px', padding: '10px', boxSizing: 'border-box' }} onChange={e => setTitleForm({...titleForm, dog_id: e.target.value})}>
        <option value="">Select Dog</option>{dogs.map(d => <option key={d.id} value={d.id}>{d.call_name}</option>)}
      </select>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px' }}>
        <select value={titleForm.venue} onChange={e => setTitleForm({...titleForm, venue: e.target.value, class_type: '', current_level: ''})} style={{ padding: '10px', boxSizing: 'border-box' }}>
          <option value="AKC">AKC</option><option value="UKI">UKI</option>
        </select>
        <select required value={titleForm.class_type} onChange={e => setTitleForm({...titleForm, class_type: e.target.value, current_level: ''})} style={{ padding: '10px', boxSizing: 'border-box' }}>
          <option value="">Class</option>
          {titleForm.venue === 'AKC' && <option value="MACH">MACH</option>}
          {VENUE_CLASSES[titleForm.venue].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          required={titleForm.class_type !== 'MACH'}
          disabled={titleForm.class_type === 'MACH'}
          value={titleForm.class_type === 'MACH' ? '' : titleForm.current_level}
          onChange={e => setTitleForm({...titleForm, current_level: e.target.value})}
          style={{ padding: '10px', boxSizing: 'border-box', background: titleForm.class_type === 'MACH' ? '#e9e9e9' : 'white', color: titleForm.class_type === 'MACH' ? '#aaa' : 'black', cursor: titleForm.class_type === 'MACH' ? 'not-allowed' : 'pointer' }}
        >
          <option value="">{titleForm.class_type === 'MACH' ? 'N/A — MACH has no level' : 'Level'}</option>
          {getLevelsForClass(titleForm.venue, titleForm.class_type).map(l => <option key={l} value={l}>{l}</option>)}
        </select>

        {titleForm.class_type !== 'MACH' && (
          <input type="number" inputMode="numeric" placeholder="Existing Qs" value={titleForm.initialQs} onChange={e => setTitleForm({...titleForm, initialQs: e.target.value})} style={{ padding: '10px', boxSizing: 'border-box' }}/>
        )}
      </div>

      {/* MACH-specific starting stats */}
      {titleForm.class_type === 'MACH' && (
        <div style={{ marginTop: '10px', background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '6px', padding: '12px' }}>
          <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', fontSize: '0.9em', color: '#b8860b' }}>Enter your current MACH progress:</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.85em', color: '#666', display: 'block', marginBottom: '4px' }}>Current MACH Points</label>
              <input type="number" inputMode="numeric" placeholder="e.g. 342" value={titleForm.initialMachPoints} onChange={e => setTitleForm({...titleForm, initialMachPoints: e.target.value})} style={{ width: '100%', padding: '10px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}/>
            </div>
            <div>
              <label style={{ fontSize: '0.85em', color: '#666', display: 'block', marginBottom: '4px' }}>Current QQs</label>
              <input type="number" inputMode="numeric" placeholder="e.g. 8" value={titleForm.initialMachQQs} onChange={e => setTitleForm({...titleForm, initialMachQQs: e.target.value})} style={{ width: '100%', padding: '10px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}/>
            </div>
          </div>
        </div>
      )}

      <button type="submit" style={{ width: '100%', marginTop: '10px', padding: '12px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', boxSizing: 'border-box' }}>Start Tracking</button>
    </form>

    {titles.map(t => {
      const isMACH = t.class_type === 'MACH'
      const machPoints = t.mach_points || 0
      const machQQs = t.mach_qqs || 0
      return (
        <div key={t.id} style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '8px', marginBottom: '10px', position: 'relative' }}>
          <button onClick={() => deleteTitle(t.id)} style={{ position: 'absolute', right: '10px', top: '10px', background: 'none', border: 'none', color: '#ccc', fontSize: '1.2em' }}>✕</button>
          <strong>{t.dog_info?.call_name}: {isMACH ? 'MACH' : `${t.current_level} ${t.class_type}`}</strong>
          {isMACH ? (
            <div style={{ marginTop: '8px', fontSize: '0.9em' }}>
              <div style={{ marginBottom: '4px' }}>
                <span style={{ color: '#555' }}>Points: </span>
                <strong>{machPoints} / 750</strong>
                <span style={{ marginLeft: '8px', fontSize: '0.85em', color: '#888' }}>({750 - machPoints} to go)</span>
              </div>
              <div style={{ background: '#e9ecef', borderRadius: '4px', height: '8px', marginBottom: '8px' }}>
                <div style={{ background: '#007bff', height: '8px', borderRadius: '4px', width: `${Math.min((machPoints / 750) * 100, 100)}%` }} />
              </div>
              <div style={{ marginBottom: '4px' }}>
                <span style={{ color: '#555' }}>QQs: </span>
                <strong>{machQQs} / 20</strong>
                <span style={{ marginLeft: '8px', fontSize: '0.85em', color: '#888' }}>({Math.max(20 - machQQs, 0)} to go)</span>
              </div>
              <div style={{ background: '#e9ecef', borderRadius: '4px', height: '8px' }}>
                <div style={{ background: '#28a745', height: '8px', borderRadius: '4px', width: `${Math.min((machQQs / 20) * 100, 100)}%` }} />
              </div>
            </div>
          ) : (
            <div style={{ marginTop: '5px' }}>{t.qs_earned_manually + (t.qs_earned_in_app || 0)}/{t.required_qs} Qs</div>
          )}
        </div>
      )
    })}
  </div>
)}
          {titles.map(t => (
            <div key={t.id} style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '8px', marginBottom: '10px', position: 'relative' }}>
              <button onClick={() => deleteTitle(t.id)} style={{ position: 'absolute', right: '10px', top: '10px', background: 'none', border: 'none', color: '#ccc', fontSize: '1.2em' }}>✕</button>
              <strong>{t.dog_info?.call_name}: {t.current_level} {t.class_type}</strong>
              <div style={{ marginTop: '5px' }}>{t.qs_earned_manually + (t.qs_earned_in_app || 0)}/{t.required_qs} Qs</div>
            </div>
          ))}
        </div>
      )}

      {/* === TAB VIEW: DASHBOARD === */}
      {activeTab === 'dashboard' && (
        <div>
          <h3>Dashboard</h3>
          <div style={{ background: '#f5f5f5', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <select value={dashboardFilters.dogId} onChange={e => setDashboardFilters({...dashboardFilters, dogId: e.target.value})} style={{ padding: '10px', boxSizing: 'border-box' }}><option value="">All Dogs</option>{dogs.map(d => <option key={d.id} value={d.id}>{d.call_name}</option>)}</select>
              <select value={dashboardFilters.venue} onChange={e => setDashboardFilters({...dashboardFilters, venue: e.target.value})} style={{ padding: '10px', boxSizing: 'border-box' }}><option value="">All Venues</option><option value="AKC">AKC</option><option value="UKI">UKI</option></select>
            </div>
            <div style={{ marginTop: '10px', display: 'flex', gap: '5px' }}>
              <button onClick={() => setDashboardView('list')} style={{ flex: 1, padding: '10px', background: dashboardView === 'list' ? '#28a745' : '#e0e0e0', color: dashboardView === 'list' ? 'white' : 'black', border: 'none', borderRadius: '4px' }}>List View</button>
              <button onClick={() => setDashboardView('stats')} style={{ flex: 1, padding: '10px', background: dashboardView === 'stats' ? '#28a745' : '#e0e0e0', color: dashboardView === 'stats' ? 'white' : 'black', border: 'none', borderRadius: '4px' }}>Stats View</button>
            </div>
          </div>
          {dashboardView === 'list' && trials.map(trial => (
            <div key={trial.id} onClick={() => startEditTrial(trial)} style={{ border: '1px solid #ddd', padding: '12px', borderRadius: '8px', marginBottom: '10px', background: '#fafafa', cursor: 'pointer' }}>
               <strong>{trial.dog_info?.call_name}</strong> | {trial.trial_date} ({trial.venue})
               {trial.trial_runs?.map(run => (
                 <div key={run.id} style={{ fontSize: '0.85em', color: '#666', marginTop: '4px' }}>
                   {run.class_name} ({run.class_level}) @ {run.jump_height}": {run.is_q ? 'Q' : 'NQ'}
                   {run.placement && ` | 🏆 ${run.placement}`}
                 </div>
                ))}
            </div>
          ))}
          {dashboardView === 'stats' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '8px', background: '#f0f8ff' }}>
                <h4>Overall</h4>
                {(() => {
                  const total = trials.reduce((sum, t) => sum + (t.trial_runs?.length || 0), 0);
                  const qs = trials.reduce((sum, t) => sum + (t.trial_runs?.filter(r => r.is_q).length || 0), 0);
                  return <div style={{fontSize: '2em', fontWeight:'bold'}}>{total > 0 ? Math.round((qs/total)*100) : 0}%</div>
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* === TAB VIEW: SETTINGS === */}
      {activeTab === 'settings' && (
        <div>
          <h3>Account Settings</h3>
          <div style={{ background: '#f9f9f9', padding: '20px', borderRadius: '8px', border: '1px solid #eee' }}>
            <h4 style={{ marginTop: 0 }}>Change Password</h4>
            <p style={{ fontSize: '0.9em', color: '#666', marginBottom: '15px' }}>
              If you used a "Forgot Password" email link to get here, please set your new password below.
            </p>
            <form onSubmit={handleUpdatePassword} style={{ display: 'flex', gap: '10px', flexDirection: isMobile ? 'column' : 'row' }}>
              <input type="password" placeholder="Enter new password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
              <button type="submit" style={{ padding: '10px 20px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', boxSizing: 'border-box' }}>Update</button>
            </form>
          </div>
        </div>
      )}


      {/* ========================================== */}
      {/* === MODALS (Render over everything else) === */}
      {/* ========================================== */}

      {/* MODAL: EDIT DOG INFO */}
      {editingDog && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: isMobile ? '10px' : '0' }}>
          <div style={{ background: 'white', padding: '20px', borderRadius: '8px', maxWidth: '500px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box' }}>
            <h3 style={{ marginTop: 0 }}>Edit Dog Info</h3>
            <form onSubmit={saveEditedDog} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input placeholder="Call Name" required value={editDogForm.callName} onChange={e => setEditDogForm({...editDogForm, callName: e.target.value})} style={{ padding: '10px', boxSizing: 'border-box' }}/>
              <input placeholder="Registered Name" value={editDogForm.regName} onChange={e => setEditDogForm({...editDogForm, regName: e.target.value})} style={{ padding: '10px', boxSizing: 'border-box' }}/>
              <input type="date" value={editDogForm.dob} onChange={e => setEditDogForm({...editDogForm, dob: e.target.value})} style={{ padding: '10px', boxSizing: 'border-box' }}/>
              <input placeholder="Breed" value={editDogForm.breed} onChange={e => setEditDogForm({...editDogForm, breed: e.target.value})} style={{ padding: '10px', boxSizing: 'border-box' }}/>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <input type="number" inputMode="decimal" placeholder="AKC Ht" value={editDogForm.akcHt} onChange={e => setEditDogForm({...editDogForm, akcHt: e.target.value})} style={{ padding: '10px', boxSizing: 'border-box' }}/>
                <input type="number" inputMode="decimal" placeholder="UKI Ht" value={editDogForm.ukiHt} onChange={e => setEditDogForm({...editDogForm, ukiHt: e.target.value})} style={{ padding: '10px', boxSizing: 'border-box' }}/>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="submit" style={{ flex: 1, padding: '12px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', boxSizing: 'border-box' }}>Save Changes</button>
                <button type="button" onClick={() => setEditingDog(null)} style={{ flex: 1, padding: '12px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT TRIAL */}
      {editingTrial && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: isMobile ? '10px' : '0' }}>
          <div style={{ background: 'white', padding: '20px', borderRadius: '8px', maxWidth: '500px', width: '100%', boxSizing: 'border-box', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginTop: 0 }}>Edit Trial</h3>
            <form onSubmit={saveEditedTrial}>
              
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                <select value={editTrialForm.dog_id} onChange={e => setEditTrialForm({...editTrialForm, dog_id: e.target.value})} style={{ width: '100%', padding: '10px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}><option value="">Select Dog</option>{dogs.map(d => <option key={d.id} value={d.id}>{d.call_name}</option>)}</select>
                <select value={editTrialForm.venue} onChange={e => setEditTrialForm({...editTrialForm, venue: e.target.value})} style={{ width: '100%', padding: '10px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}><option value="AKC">AKC</option><option value="UKI">UKI</option></select>
                <input type="date" value={editTrialForm.trial_date} onChange={e => setEditTrialForm({...editTrialForm, trial_date: e.target.value})} style={{ width: '100%', padding: '10px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }} />
                <input placeholder="Location" value={editTrialForm.location} onChange={e => setEditTrialForm({...editTrialForm, location: e.target.value})} style={{ width: '100%', padding: '10px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }} />
                <input placeholder="Judge" value={editTrialForm.judge_name} onChange={e => setEditTrialForm({...editTrialForm, judge_name: e.target.value})} style={{ width: '100%', padding: '10px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }} />
              </div>

              {editRuns.map((run, i) => (
                <div key={i} style={{ background: '#f9f9f9', padding: '15px', marginBottom: '10px', position: 'relative', border: '1px solid #eee', borderRadius: '8px' }}>
                  {editRuns.length > 1 && <button type="button" onClick={() => removeEditRunRow(i)} style={{ position: 'absolute', right: '5px', top: '5px', border: 'none', background: 'none', fontSize: '1.2em', color: '#999' }}>✕</button>}
                  
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                    <select required value={run.class_name} onChange={e => updateEditRun(i, 'class_name', e.target.value)} style={{ flex: 1, minWidth: isMobile ? '45%' : 'auto', padding: '8px', boxSizing: 'border-box' }}><option value="">Class</option>{VENUE_CLASSES[editTrialForm.venue].map(c => <option key={c} value={c}>{c}</option>)}</select>
                    <select required value={run.class_level} onChange={e => updateEditRun(i, 'class_level', e.target.value)} style={{ flex: 1, minWidth: isMobile ? '45%' : 'auto', padding: '8px', boxSizing: 'border-box' }}><option value="">Level</option>{getLevelsForClass(editTrialForm.venue, run.class_name).map(l => <option key={l} value={l}>{l}</option>)}</select>
                    <input inputMode="decimal" placeholder="Ht" value={run.jump_height} onChange={e => updateEditRun(i, 'jump_height', e.target.value)} style={{ width: isMobile ? '100%' : '60px', padding: '8px', boxSizing: 'border-box' }} />
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                    <input type="number" step="0.01" inputMode="decimal" placeholder="YPS" value={run.yps} onChange={e => updateEditRun(i, 'yps', e.target.value)} style={{ flex: 1, padding: '8px', boxSizing: 'border-box', minWidth: 0 }} />
                    <input type="number" step="0.01" inputMode="decimal" placeholder="Time" value={run.course_time} onChange={e => updateEditRun(i, 'course_time', e.target.value)} style={{ flex: 1, padding: '8px', boxSizing: 'border-box', minWidth: 0 }} />
                    <input type="number" inputMode="numeric" placeholder="Place" value={run.placement} onChange={e => updateEditRun(i, 'placement', e.target.value)} style={{ width: '70px', padding: '8px', boxSizing: 'border-box' }} />
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold' }}>
                      <input type="checkbox" checked={run.is_q} onChange={e => updateEditRun(i, 'is_q', e.target.checked)} style={{ transform: 'scale(1.2)' }} /> Q?
                    </label>
                    {!run.is_q && <select style={{ flex: 1, padding: '8px', boxSizing: 'border-box' }} value={run.nq_reason} onChange={e => updateEditRun(i, 'nq_reason', e.target.value)}><option value="">Reason</option>{NQ_REASONS.map(r => <option key={r} value={r}>{r}</option>)}</select>}
                  </div>
                  
                  <textarea placeholder="Comments" value={run.comments} style={{ width: '100%', marginTop: '10px', padding: '8px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }} onChange={e => updateEditRun(i, 'comments', e.target.value)} />
                </div>
              ))}
              
              <button type="button" onClick={addEditRunRow} style={{ width: '100%', boxSizing: 'border-box', padding: '12px', marginBottom: '15px', border: '1px dashed #ccc', background: 'transparent', borderRadius: '4px', cursor: 'pointer' }}>+ Add Run</button>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" style={{ flex: 1, padding: '12px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', boxSizing: 'border-box', fontWeight: 'bold' }}>Save</button>
                <button type="button" onClick={() => setEditingTrial(null)} style={{ flex: 1, padding: '12px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}