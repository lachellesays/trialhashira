import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Auth from './Auth'

// --- Configuration Constants ---
const VENUE_CLASSES = {
  AKC: ['JWW', 'STD', 'FAST', 'Premier', 'T2B', 'ISC J', 'ISC A'],
  UKI: ['Jumping', 'Agility', 'Gamblers', 'Snookers', 'Masters Jumping', 'Masters Agility', 'Speedstakes']
}
const CLASS_LEVELS = {
  AKC: ['Novice', 'Open', 'Excellent', 'Master'],
  UKI: ['Beginner', 'Novice', 'Senior', 'Champ']
}
const NQ_REASONS = ['wrong course', 'refusal', 'bar', 'a-frame', 'teeter', 'dogwalk', 'other']

function App() {
  const [session, setSession] = useState(null)
  const [activeTab, setActiveTab] = useState('my-pack')
  const [dogs, setDogs] = useState([])

  // --- STATE: Add New Dog ---
  const [dogForm, setDogForm] = useState({ regName: '', callName: '', dob: '', breed: '', akcHt: '', ukiHt: '' })

  // --- STATE: Log New Trial ---
  const [trialInfo, setTrialInfo] = useState({ dog_id: '', venue: 'AKC', trial_date: '', location: '', judge_name: '' })
  const [runs, setRuns] = useState([{ class_name: '', class_level: '', jump_height: '', is_q: false, nq_reason: '', comments: '', yps: '', course_time: '' }])

  // --- STATE: Dashboard ---
  const [trials, setTrials] = useState([])
  const [dashboardFilters, setDashboardFilters] = useState({ dogId: '', dateFrom: '', dateTo: '', venue: '', sortBy: 'date-desc' })
  const [dashboardView, setDashboardView] = useState('list') 
  const [editingTrial, setEditingTrial] = useState(null)
  const [editTrialForm, setEditTrialForm] = useState({})
  const [editRuns, setEditRuns] = useState([])

  // --- STATE: Title Progress ---
  const [titles, setTitles] = useState([])
  const [titleForm, setTitleForm] = useState({ dog_id: '', venue: 'AKC', class_type: '', current_level: '', initialQs: 0 })

  // 1. Auth & Initial Data Fetch
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

  // --- SMART DEFAULTS LOGIC ---
  useEffect(() => {
    if (trialInfo.dog_id && trialInfo.venue) {
      const selectedDog = dogs.find(d => d.id === trialInfo.dog_id)
      const defaultHeight = selectedDog?.venue_height?.[trialInfo.venue] || ''
      const lastTrial = trials.find(t => t.dog_id === trialInfo.dog_id && t.venue === trialInfo.venue)
      const lastLevel = lastTrial?.trial_runs?.[0]?.class_level || ''

      const updatedRuns = runs.map(run => ({
        ...run,
        jump_height: run.jump_height || defaultHeight,
        class_level: run.class_level || lastLevel
      }))
      setRuns(updatedRuns)
    }
  }, [trialInfo.dog_id, trialInfo.venue, dogs])

  // 2. LOGIC: Dog Management
  const saveDog = async (e) => {
    e.preventDefault()
    const { error } = await supabase.from('dog_info').insert([{
      registered_name: dogForm.regName,
      call_name: dogForm.callName,
      dob: dogForm.dob,
      breed: dogForm.breed,
      venue_height: { AKC: dogForm.akcHt, UKI: dogForm.ukiHt }
    }])
    if (error) alert(error.message)
    else {
      alert("Dog Added!"); fetchDogs(); setActiveTab('my-pack')
      setDogForm({ regName: '', callName: '', dob: '', breed: '', akcHt: '', ukiHt: '' })
    }
  }

  // 3. LOGIC: Trial Logging
  const addRunRow = () => {
    const selectedDog = dogs.find(d => d.id === trialInfo.dog_id)
    const defaultHeight = selectedDog?.venue_height?.[trialInfo.venue] || ''
    const lastLevel = runs[runs.length - 1]?.class_level || ''
    setRuns([...runs, { class_name: '', class_level: lastLevel, jump_height: defaultHeight, is_q: false, nq_reason: '', comments: '', yps: '', course_time: '' }])
  }
  const removeRunRow = (index) => { if (runs.length > 1) setRuns(runs.filter((_, i) => i !== index)) }
  const updateRun = (index, field, value) => { const newRuns = [...runs]; newRuns[index][field] = value; setRuns(newRuns) }

  const saveTrial = async (e) => {
    e.preventDefault()
    const { data, error: tErr } = await supabase.from('trials').insert([trialInfo]).select()
    if (tErr) return alert(tErr.message)

    const runsWithId = runs.map(run => ({ ...run, trial_id: data[0].id, yps: run.yps === '' ? null : parseFloat(run.yps), course_time: run.course_time === '' ? null : parseFloat(run.course_time) }))
    const { error: rErr } = await supabase.from('trial_runs').insert(runsWithId)
    if (rErr) return alert(rErr.message)

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

  // 4. LOGIC: Titles
  const handleStartTitleTracking = async (e) => {
    e.preventDefault()
    const req = (titleForm.venue === 'AKC' && titleForm.current_level === 'Master') ? 10 : 3
    const { error } = await supabase.from('title_progress').insert([{ dog_id: titleForm.dog_id, venue: titleForm.venue, class_type: titleForm.class_type, current_level: titleForm.current_level, qs_earned_manually: parseInt(titleForm.initialQs || 0), required_qs: req }])
    if (error) alert(error.message); else fetchTitles()
  }
  const deleteTitle = (id) => { if (window.confirm("Delete tracker?")) supabase.from('title_progress').delete().eq('id', id).then(fetchTitles) }

  // 5. EDIT LOGIC
  const startEditTrial = (trial) => { setEditingTrial(trial.id); setEditTrialForm({ ...trial }); setEditRuns(trial.trial_runs || []) }
  const updateEditRun = (index, field, value) => { const newRuns = [...editRuns]; newRuns[index][field] = value; setEditRuns(newRuns) }
  const addEditRunRow = () => setEditRuns([...editRuns, { class_name: '', class_level: '', jump_height: '', is_q: false, nq_reason: '', comments: '', yps: '', course_time: '' }])
  const removeEditRunRow = (index) => { if (editRuns.length > 1) setEditRuns(editRuns.filter((_, i) => i !== index)) }
  const saveEditedTrial = async (e) => {
    e.preventDefault()
    await supabase.from('trials').update({ dog_id: editTrialForm.dog_id, venue: editTrialForm.venue, trial_date: editTrialForm.trial_date, location: editTrialForm.location, judge_name: editTrialForm.judge_name }).eq('id', editTrialForm.id)
    await supabase.from('trial_runs').delete().eq('trial_id', editTrialForm.id)
    const runsWithId = editRuns.map(run => ({ ...run, trial_id: editTrialForm.id, yps: run.yps === '' ? null : parseFloat(run.yps), course_time: run.course_time === '' ? null : parseFloat(run.course_time) }))
    await supabase.from('trial_runs').insert(runsWithId)
    setEditingTrial(null); fetchTrials()
  }

  if (!session) return <div style={{ padding: '50px' }}><Auth /></div>

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', marginBottom: '15px' }}>
        <h2>Agility Log</h2>
        <button onClick={() => supabase.auth.signOut()} style={{ background: 'none', border: 'none', color: 'red', cursor: 'pointer' }}>Sign Out</button>
      </header>

      <nav style={{ display: 'flex', gap: '5px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {['my-pack', 'add-dog', 'log-trial', 'titles', 'dashboard'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '10px', flex: 1, backgroundColor: activeTab === tab ? '#007bff' : '#f0f0f0', color: activeTab === tab ? 'white' : 'black', border: 'none', borderRadius: '4px' }}>{tab.replace('-', ' ')}</button>
        ))}
      </nav>

      {/* VIEW: My Pack */}
      {activeTab === 'my-pack' && (
        <div>
          <h3>Your Dogs</h3>
          {dogs.length === 0 ? <p>No dogs yet.</p> : dogs.map(dog => (
            <div key={dog.id} style={{ border: '1px solid #ddd', padding: '10px', borderRadius: '8px', marginBottom: '10px' }}>
              <strong>{dog.call_name}</strong> ({dog.breed})
              <div style={{ fontSize: '0.8em', color: '#666' }}>AKC: {dog.venue_height?.AKC}" | UKI: {dog.venue_height?.UKI}"</div>
            </div>
          ))}
        </div>
      )}

      {/* VIEW: Add New Dog - RESTORED */}
      {activeTab === 'add-dog' && (
        <form onSubmit={saveDog} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h3>Register New Dog</h3>
          <input placeholder="Call Name" required value={dogForm.callName} onChange={e => setDogForm({...dogForm, callName: e.target.value})} />
          <input placeholder="Registered Name" value={dogForm.regName} onChange={e => setDogForm({...dogForm, regName: e.target.value})} />
          <input type="date" value={dogForm.dob} onChange={e => setDogForm({...dogForm, dob: e.target.value})} />
          <input placeholder="Breed" value={dogForm.breed} onChange={e => setDogForm({...dogForm, breed: e.target.value})} />
          <div style={{ display: 'flex', gap: '5px' }}>
            <input type="number" placeholder="AKC Ht" value={dogForm.akcHt} onChange={e => setDogForm({...dogForm, akcHt: e.target.value})} />
            <input type="number" placeholder="UKI Ht" value={dogForm.ukiHt} onChange={e => setDogForm({...dogForm, ukiHt: e.target.value})} />
          </div>
          <button type="submit" style={{ padding: '10px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px' }}>Save Dog</button>
        </form>
      )}

      {/* VIEW: Log Trial */}
      {activeTab === 'log-trial' && (
        <form onSubmit={saveTrial}>
          <h3>Log Trial</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
            <select required value={trialInfo.dog_id} onChange={e => setTrialInfo({...trialInfo, dog_id: e.target.value})}><option value="">Select Dog</option>{dogs.map(d => <option key={d.id} value={d.id}>{d.call_name}</option>)}</select>
            <select value={trialInfo.venue} onChange={e => setTrialInfo({...trialInfo, venue: e.target.value})}><option value="AKC">AKC</option><option value="UKI">UKI</option></select>
            <input type="date" required value={trialInfo.trial_date} onChange={e => setTrialInfo({...trialInfo, trial_date: e.target.value})} />
            <input placeholder="Location" value={trialInfo.location} onChange={e => setTrialInfo({...trialInfo, location: e.target.value})} />
            <input placeholder="Judge Name" value={trialInfo.judge_name} onChange={e => setTrialInfo({...trialInfo, judge_name: e.target.value})} />
          </div>
          {runs.map((run, i) => (
            <div key={i} style={{ background: '#f9f9f9', padding: '15px', marginBottom: '10px', border: '1px solid #eee', position: 'relative' }}>
              {runs.length > 1 && <button type="button" onClick={() => removeRunRow(i)} style={{ position: 'absolute', right: '5px', top: '5px', border: 'none', background: 'none' }}>✕</button>}
              <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
                <select required value={run.class_name} onChange={e => updateRun(i, 'class_name', e.target.value)} style={{ flex: 1 }}><option value="">Class</option>{VENUE_CLASSES[trialInfo.venue].map(c => <option key={c} value={c}>{c}</option>)}</select>
                <select required value={run.class_level} onChange={e => updateRun(i, 'class_level', e.target.value)} style={{ flex: 1 }}><option value="">Level</option>{CLASS_LEVELS[trialInfo.venue].map(l => <option key={l} value={l}>{l}</option>)}</select>
                <input placeholder="Ht" value={run.jump_height} onChange={e => updateRun(i, 'jump_height', e.target.value)} style={{ width: '60px' }} />
              </div>
              <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}><input type="number" step="0.01" placeholder="YPS" value={run.yps} onChange={e => updateRun(i, 'yps', e.target.value)} style={{ flex: 1 }} /><input type="number" step="0.01" placeholder="Time" value={run.course_time} onChange={e => updateRun(i, 'course_time', e.target.value)} style={{ flex: 1 }} /></div>
              <label><input type="checkbox" checked={run.is_q} onChange={e => updateRun(i, 'is_q', e.target.checked)} /> Q?</label>
              {!run.is_q && <select style={{marginLeft:'10px'}} value={run.nq_reason} onChange={e => updateRun(i, 'nq_reason', e.target.value)}><option value="">Reason</option>{NQ_REASONS.map(r => <option key={r} value={r}>{r}</option>)}</select>}
              <textarea placeholder="Comments" value={run.comments} style={{ width: '100%', marginTop: '10px' }} onChange={e => updateRun(i, 'comments', e.target.value)} />
            </div>
          ))}
          <button type="button" onClick={addRunRow} style={{ width: '100%', padding: '8px' }}>+ Add Run</button>
          <button type="submit" style={{ width: '100%', padding: '10px', marginTop: '10px', background: 'blue', color: 'white', border: 'none' }}>Save Trial</button>
        </form>
      )}

      {/* VIEW: Titles */}
      {activeTab === 'titles' && (
        <div>
          <h3>Title Progress</h3>
          <form onSubmit={handleStartTitleTracking} style={{ background: '#f9f9f9', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
            <select required value={titleForm.dog_id} style={{ width: '100%', marginBottom: '10px' }} onChange={e => setTitleForm({...titleForm, dog_id: e.target.value})}><option value="">Select Dog</option>{dogs.map(d => <option key={d.id} value={d.id}>{d.call_name}</option>)}</select>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <select value={titleForm.venue} onChange={e => setTitleForm({...titleForm, venue: e.target.value})}><option value="AKC">AKC</option><option value="UKI">UKI</option></select>
              <select value={titleForm.class_type} onChange={e => setTitleForm({...titleForm, class_type: e.target.value})}><option value="">Class</option>{VENUE_CLASSES[titleForm.venue].map(c => <option key={c} value={c}>{c}</option>)}</select>
              <select value={titleForm.current_level} onChange={e => setTitleForm({...titleForm, current_level: e.target.value})}><option value="">Level</option>{CLASS_LEVELS[titleForm.venue].map(l => <option key={l} value={l}>{l}</option>)}</select>
              <input type="number" placeholder="Existing Qs" value={titleForm.initialQs} onChange={e => setTitleForm({...titleForm, initialQs: e.target.value})} />
            </div>
            <button type="submit" style={{ width: '100%', marginTop: '10px' }}>Start Tracking</button>
          </form>
          {titles.map(t => (
            <div key={t.id} style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '8px', marginBottom: '10px', position: 'relative' }}>
              <button onClick={() => deleteTitle(t.id)} style={{ position: 'absolute', right: '10px', top: '10px', background: 'none', border: 'none', color: '#ccc' }}>✕</button>
              <strong>{t.dog_info?.call_name}: {t.current_level} {t.class_type}</strong>
              <div style={{ marginTop: '5px' }}>{t.qs_earned_manually + (t.qs_earned_in_app || 0)}/{t.required_qs} Qs</div>
            </div>
          ))}
        </div>
      )}

      {/* VIEW: Dashboard */}
      {activeTab === 'dashboard' && (
        <div>
          <h3>Dashboard</h3>
          <div style={{ background: '#f5f5f5', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <select value={dashboardFilters.dogId} onChange={e => setDashboardFilters({...dashboardFilters, dogId: e.target.value})}><option value="">All Dogs</option>{dogs.map(d => <option key={d.id} value={d.id}>{d.call_name}</option>)}</select>
              <select value={dashboardFilters.venue} onChange={e => setDashboardFilters({...dashboardFilters, venue: e.target.value})}><option value="">All Venues</option><option value="AKC">AKC</option><option value="UKI">UKI</option></select>
            </div>
            <div style={{ marginTop: '10px', display: 'flex', gap: '5px' }}>
              <button onClick={() => setDashboardView('list')} style={{ flex: 1, padding: '8px', background: dashboardView === 'list' ? '#28a745' : '#e0e0e0', color: dashboardView === 'list' ? 'white' : 'black', border: 'none' }}>List View</button>
              <button onClick={() => setDashboardView('stats')} style={{ flex: 1, padding: '8px', background: dashboardView === 'stats' ? '#28a745' : '#e0e0e0', color: dashboardView === 'stats' ? 'white' : 'black', border: 'none' }}>Stats View</button>
            </div>
          </div>
          {dashboardView === 'list' && trials.map(trial => (
            <div key={trial.id} onClick={() => startEditTrial(trial)} style={{ border: '1px solid #ddd', padding: '12px', borderRadius: '8px', marginBottom: '10px', background: '#fafafa', cursor: 'pointer' }}>
               <strong>{trial.dog_info?.call_name}</strong> | {trial.trial_date} ({trial.venue})
               {trial.trial_runs?.map(run => (<div key={run.id} style={{ fontSize: '0.85em', color: '#666' }}>{run.class_name} ({run.class_level}) @ {run.jump_height}": {run.is_q ? 'Q' : 'NQ'}</div>))}
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

      {/* Edit Modal */}
      {editingTrial && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '20px', borderRadius: '8px', maxWidth: '500px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3>Edit Trial</h3>
            <form onSubmit={saveEditedTrial}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                <select value={editTrialForm.dog_id} onChange={e => setEditTrialForm({...editTrialForm, dog_id: e.target.value})}><option value="">Select Dog</option>{dogs.map(d => <option key={d.id} value={d.id}>{d.call_name}</option>)}</select>
                <select value={editTrialForm.venue} onChange={e => setEditTrialForm({...editTrialForm, venue: e.target.value})}><option value="AKC">AKC</option><option value="UKI">UKI</option></select>
                <input type="date" value={editTrialForm.trial_date} onChange={e => setEditTrialForm({...editTrialForm, trial_date: e.target.value})} />
                <input placeholder="Location" value={editTrialForm.location} onChange={e => setEditTrialForm({...editTrialForm, location: e.target.value})} />
                <input placeholder="Judge" value={editTrialForm.judge_name} onChange={e => setEditTrialForm({...editTrialForm, judge_name: e.target.value})} />
              </div>
              {editRuns.map((run, i) => (
                <div key={i} style={{ background: '#f9f9f9', padding: '10px', marginBottom: '10px', position: 'relative' }}>
                  {editRuns.length > 1 && <button type="button" onClick={() => removeEditRunRow(i)} style={{ position: 'absolute', right: '5px', top: '5px', border: 'none', background: 'none' }}>✕</button>}
                  <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}><select value={run.class_name} onChange={e => updateEditRun(i, 'class_name', e.target.value)} style={{ flex: 1 }}><option value="">Class</option>{VENUE_CLASSES[editTrialForm.venue].map(c => <option key={c} value={c}>{c}</option>)}</select><select value={run.class_level} onChange={e => updateEditRun(i, 'class_level', e.target.value)} style={{ flex: 1 }}><option value="">Level</option>{CLASS_LEVELS[editTrialForm.venue].map(l => <option key={l} value={l}>{l}</option>)}</select><input placeholder="Ht" value={run.jump_height} onChange={e => updateEditRun(i, 'jump_height', e.target.value)} style={{ width: '60px' }} /></div>
                  <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}><input type="number" step="0.01" placeholder="YPS" value={run.yps} onChange={e => updateEditRun(i, 'yps', e.target.value)} style={{ flex: 1 }} /><input type="number" step="0.01" placeholder="Time" value={run.course_time} onChange={e => updateEditRun(i, 'course_time', e.target.value)} style={{ flex: 1 }} /></div>
                  <label><input type="checkbox" checked={run.is_q} onChange={e => updateEditRun(i, 'is_q', e.target.checked)} /> Q?</label>
                  {!run.is_q && <select style={{marginLeft:'10px'}} value={run.nq_reason} onChange={e => updateEditRun(i, 'nq_reason', e.target.value)}>{NQ_REASONS.map(r => <option key={r} value={r}>{r}</option>)}</select>}
                  <textarea placeholder="Comments" value={run.comments} style={{ width: '100%', marginTop: '5px' }} onChange={e => updateEditRun(i, 'comments', e.target.value)} />
                </div>
              ))}
              <button type="button" onClick={addEditRunRow} style={{width:'100%', padding:'8px', marginBottom:'15px'}}>+ Add Run</button>
              <div style={{ display: 'flex', gap: '10px' }}><button type="submit" style={{ flex: 1, padding: '10px', background: '#007bff', color: 'white', border: 'none' }}>Save</button><button type="button" onClick={() => setEditingTrial(null)} style={{ flex: 1, padding: '10px' }}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default App