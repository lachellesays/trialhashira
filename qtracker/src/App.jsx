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
  const [activeTab, setActiveTab] = useState('my-pack') // Default view
  const [dogs, setDogs] = useState([])

  // --- STATE: Add New Dog ---
  const [dogForm, setDogForm] = useState({ regName: '', callName: '', dob: '', breed: '', akcHt: '', ukiHt: '' })

  // --- STATE: Log New Trial ---
  const [trialInfo, setTrialInfo] = useState({ dog_id: '', venue: 'AKC', trial_date: '', location: '', judge_name: '' })
  const [runs, setRuns] = useState([{ class_name: '', class_level: '', is_q: false, nq_reason: '', comments: '' }])

  // --- STATE: Dashboard ---
  const [trials, setTrials] = useState([])
  const [dashboardFilters, setDashboardFilters] = useState({ dogId: '', dateFrom: '', dateTo: '', venue: '', sortBy: 'date-desc' })
  const [dashboardView, setDashboardView] = useState('list') // 'list' or 'stats'
  const [editingTrial, setEditingTrial] = useState(null)
  const [editTrialForm, setEditTrialForm] = useState({})
  const [editRuns, setEditRuns] = useState([])

  // 1. Auth & Initial Data Fetch
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) fetchDogs()
  }, [session])

  const fetchDogs = async () => {
    const { data } = await supabase.from('dog_info').select('*').order('call_name')
    if (data) setDogs(data)
  }

  const fetchTrials = async () => {
    const query = supabase.from('trials').select('*, dog_info(call_name), trial_runs(*)')
    if (dashboardFilters.dogId) query = query.eq('dog_id', dashboardFilters.dogId)
    if (dashboardFilters.venue) query = query.eq('venue', dashboardFilters.venue)
    if (dashboardFilters.dateFrom) query = query.gte('trial_date', dashboardFilters.dateFrom)
    if (dashboardFilters.dateTo) query = query.lte('trial_date', dashboardFilters.dateTo)

    let { data } = await query.order('trial_date', { ascending: false })
    if (data) setTrials(data)
  }

  useEffect(() => {
    if (session && activeTab === 'dashboard') {
      fetchTrials()
    }
  }, [session, activeTab, dashboardFilters])

  // 2. LOGIC: Manage Dogs
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

  // 3. LOGIC: Manage Trials & Runs
  const addRunRow = () => setRuns([...runs, { class_name: '', class_level: '', is_q: false, nq_reason: '', comments: '' }])
  
  const updateRun = (index, field, value) => {
    const newRuns = [...runs]
    newRuns[index][field] = value
    setRuns(newRuns)
  }

  const saveTrial = async (e) => {
    e.preventDefault()
    const { data, error: tErr } = await supabase.from('trials').insert([trialInfo]).select()
    if (tErr) return alert(tErr.message)

    const runsWithId = runs.map(run => ({ ...run, trial_id: data[0].id }))
    const { error: rErr } = await supabase.from('trial_runs').insert(runsWithId)
    
    if (rErr) alert(rErr.message)
    else {
      alert("Trial Saved!"); setRuns([{ class_name: '', is_q: false, nq_reason: '', comments: '' }]); setActiveTab('my-pack')
    }
  }

  // EDIT: Start editing a trial
  const startEditTrial = (trial) => {
    setEditingTrial(trial.id)
    setEditTrialForm({
      id: trial.id,
      dog_id: trial.dog_id,
      venue: trial.venue,
      trial_date: trial.trial_date,
      location: trial.location,
      judge_name: trial.judge_name
    })
    setEditRuns(trial.trial_runs || [])
  }

  // EDIT: Update edit form
  const updateEditRun = (index, field, value) => {
    const newRuns = [...editRuns]
    newRuns[index][field] = value
    setEditRuns(newRuns)
  }

  // EDIT: Add new run row
  const addEditRunRow = () => {
    setEditRuns([...editRuns, { class_name: '', class_level: '', is_q: false, nq_reason: '', comments: '' }])
  }

  // EDIT: Save edited trial
  const saveEditedTrial = async (e) => {
    e.preventDefault()
    const { error: tErr } = await supabase.from('trials').update({
      dog_id: editTrialForm.dog_id,
      venue: editTrialForm.venue,
      trial_date: editTrialForm.trial_date,
      location: editTrialForm.location,
      judge_name: editTrialForm.judge_name
    }).eq('id', editTrialForm.id)

    if (tErr) return alert(tErr.message)

    const { error: rErr } = await supabase.from('trial_runs').delete().eq('trial_id', editTrialForm.id)
    if (rErr) return alert(rErr.message)

    const runsWithId = editRuns.map(run => ({ ...run, trial_id: editTrialForm.id }))
    const { error: insertErr } = await supabase.from('trial_runs').insert(runsWithId)
    
    if (insertErr) alert(insertErr.message)
    else {
      alert("Trial Updated!")
      setEditingTrial(null)
      fetchTrials()
    }
  }

  if (!session) return <div style={{ padding: '50px' }}><Auth /></div>

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', marginBottom: '15px' }}>
        <h2>Agility Log</h2>
        <button onClick={() => supabase.auth.signOut()} style={{ background: 'none', border: 'none', color: 'red', cursor: 'pointer' }}>Sign Out</button>
      </header>

      {/* Main Navigation */}
      <nav style={{ display: 'flex', gap: '5px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {['my-pack', 'add-dog', 'log-trial', 'dashboard'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ 
            padding: '10px', flex: 1, cursor: 'pointer',
            backgroundColor: activeTab === tab ? '#007bff' : '#f0f0f0',
            color: activeTab === tab ? 'white' : 'black',
            border: 'none', borderRadius: '4px', textTransform: 'capitalize'
          }}>
            {tab.replace('-', ' ')}
          </button>
        ))}
      </nav>

      {/* VIEW: My Pack */}
      {activeTab === 'my-pack' && (
        <div>
          <h3>Your Dogs</h3>
          {dogs.length === 0 ? <p>No dogs yet. Add one!</p> : dogs.map(dog => (
            <div key={dog.id} style={{ border: '1px solid #ddd', padding: '10px', borderRadius: '8px', marginBottom: '10px' }}>
              <strong>{dog.call_name}</strong> ({dog.breed})
              <div style={{ fontSize: '0.8em', color: '#666' }}>AKC: {dog.venue_height?.AKC}" | UKI: {dog.venue_height?.UKI}"</div>
            </div>
          ))}
        </div>
      )}

      {/* VIEW: Add New Dog */}
      {activeTab === 'add-dog' && (
        <form onSubmit={saveDog} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h3>Register New Dog</h3>
          <input placeholder="Call Name" required value={dogForm.callName} onChange={e => setDogForm({...dogForm, callName: e.target.value})} />
          <input placeholder="Registered Name" value={dogForm.regName} onChange={e => setDogForm({...dogForm, regName: e.target.value})} />
          <input type="date" value={dogForm.dob} onChange={e => setDogForm({...dogForm, dob: e.target.value})} />
          <input placeholder="Breed" value={dogForm.breed} onChange={e => setDogForm({...dogForm, breed: e.target.value})} />
          <div style={{ display: 'flex', gap: '5px' }}>
            <input type="number" placeholder="AKC Ht" onChange={e => setDogForm({...dogForm, akcHt: e.target.value})} />
            <input type="number" placeholder="UKI Ht" onChange={e => setDogForm({...dogForm, ukiHt: e.target.value})} />
          </div>
          <button type="submit" style={{ padding: '10px', background: '#28a745', color: 'white', border: 'none' }}>Save Dog</button>
        </form>
      )}

      {/* VIEW: Log Trial */}
      {activeTab === 'log-trial' && (
        <form onSubmit={saveTrial}>
          <h3>New Trial Header</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
            <select required onChange={e => setTrialInfo({...trialInfo, dog_id: e.target.value})}>
              <option value="">Select Dog</option>
              {dogs.map(d => <option key={d.id} value={d.id}>{d.call_name}</option>)}
            </select>
            <select onChange={e => setTrialInfo({...trialInfo, venue: e.target.value})}>
              <option value="AKC">AKC</option>
              <option value="UKI">UKI</option>
            </select>
            <input type="date" required onChange={e => setTrialInfo({...trialInfo, trial_date: e.target.value})} />
            <input placeholder="Location" onChange={e => setTrialInfo({...trialInfo, location: e.target.value})} />
            <input placeholder="Judge Name" onChange={e => setTrialInfo({...trialInfo, judge_name: e.target.value})} />
          </div>

          <h4>Runs</h4>
          {runs.map((run, i) => (
            <div key={i} style={{ background: '#f9f9f9', padding: '10px', marginBottom: '10px', border: '1px solid #eee' }}>
              <div style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
                <select required onChange={e => updateRun(i, 'class_name', e.target.value)} style={{ flex: 1 }}>
                  <option value="">Class</option>
                  {VENUE_CLASSES[trialInfo.venue].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select required onChange={e => updateRun(i, 'class_level', e.target.value)} style={{ flex: 1 }}>
                  <option value="">Level</option>
                  {CLASS_LEVELS[trialInfo.venue].map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <label style={{ marginLeft: '0px' }}>
                <input type="checkbox" onChange={e => updateRun(i, 'is_q', e.target.checked)} /> Q?
              </label>
              {!run.is_q && (
                <select style={{ marginLeft: '10px' }} onChange={e => updateRun(i, 'nq_reason', e.target.value)}>
                  <option value="">Reason</option>
                  {NQ_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              )}
              <textarea placeholder="Comments" style={{ width: '100%', marginTop: '5px' }} onChange={e => updateRun(i, 'comments', e.target.value)} />
            </div>
          ))}
          <button type="button" onClick={addRunRow}>+ Add Run</button>
          <button type="submit" style={{ width: '100%', padding: '10px', marginTop: '10px', background: 'blue', color: 'white' }}>Save Trial</button>
        </form>
      )}

      {/* VIEW: Dashboard */}
      {activeTab === 'dashboard' && (
        <div>
          <h3>Trial Results Dashboard</h3>
          
          {/* Filter Controls */}
          <div style={{ background: '#f5f5f5', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <select value={dashboardFilters.dogId} onChange={e => setDashboardFilters({...dashboardFilters, dogId: e.target.value})}>
                <option value="">All Dogs</option>
                {dogs.map(d => <option key={d.id} value={d.id}>{d.call_name}</option>)}
              </select>
              <select value={dashboardFilters.venue} onChange={e => setDashboardFilters({...dashboardFilters, venue: e.target.value})}>
                <option value="">All Venues</option>
                <option value="AKC">AKC</option>
                <option value="UKI">UKI</option>
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '0.9em', color: '#666' }}>From:</label>
                <input type="date" value={dashboardFilters.dateFrom} onChange={e => setDashboardFilters({...dashboardFilters, dateFrom: e.target.value})} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.9em', color: '#666' }}>To:</label>
                <input type="date" value={dashboardFilters.dateTo} onChange={e => setDashboardFilters({...dashboardFilters, dateTo: e.target.value})} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.9em', color: '#666' }}>Sort:</label>
                <select value={dashboardFilters.sortBy} onChange={e => setDashboardFilters({...dashboardFilters, sortBy: e.target.value})} style={{ width: '100%' }}>
                  <option value="date-desc">Newest First</option>
                  <option value="date-asc">Oldest First</option>
                </select>
              </div>
            </div>
            <div style={{ marginTop: '10px', display: 'flex', gap: '5px' }}>
              <button onClick={() => setDashboardView('list')} style={{ flex: 1, padding: '8px', background: dashboardView === 'list' ? '#28a745' : '#e0e0e0', color: dashboardView === 'list' ? 'white' : 'black', border: 'none', borderRadius: '4px' }}>List View</button>
              <button onClick={() => setDashboardView('stats')} style={{ flex: 1, padding: '8px', background: dashboardView === 'stats' ? '#28a745' : '#e0e0e0', color: dashboardView === 'stats' ? 'white' : 'black', border: 'none', borderRadius: '4px' }}>Stats View</button>
            </div>
          </div>

          {/* List View */}
          {dashboardView === 'list' && (
            <div>
              {trials.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#999' }}>No trials found. Log some trials to see results!</p>
              ) : (
                trials.map(trial => {
                  const totalRuns = trial.trial_runs?.length || 0
                  const qs = trial.trial_runs?.filter(r => r.is_q).length || 0
                  const qPercent = totalRuns > 0 ? Math.round((qs / totalRuns) * 100) : 0
                  
                  return (
                    <div key={trial.id} onClick={() => startEditTrial(trial)} style={{ border: '1px solid #ddd', padding: '12px', borderRadius: '8px', marginBottom: '10px', background: '#fafafa', cursor: 'pointer', transition: 'all 0.2s', opacity: editingTrial === trial.id ? 0.6 : 1 }} onMouseEnter={e => e.currentTarget.style.background = '#f0f0f0'} onMouseLeave={e => e.currentTarget.style.background = '#fafafa'}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                        <div>
                          <strong>{trial.dog_info?.call_name}</strong> | {trial.trial_date}
                          <div style={{ fontSize: '0.9em', color: '#666', marginTop: '5px' }}>
                            📍 {trial.location || 'No location'} | {trial.venue}
                          </div>
                          {trial.judge_name && <div style={{ fontSize: '0.85em', color: '#999' }}>Judge: {trial.judge_name}</div>}
                        </div>
                        <div style={{ textAlign: 'right', background: qPercent === 100 ? '#d4edda' : qPercent >= 75 ? '#fff3cd' : '#f8d7da', padding: '8px 12px', borderRadius: '6px', minWidth: '60px' }}>
                          <div style={{ fontSize: '1.5em', fontWeight: 'bold', color: qPercent === 100 ? '#155724' : qPercent >= 75 ? '#856404' : '#721c24' }}>
                            {qPercent}%
                          </div>
                          <div style={{ fontSize: '0.85em', color: '#666' }}>
                            {qs}/{totalRuns} Qs
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize: '0.8em', color: '#999', marginTop: '8px', fontStyle: 'italic' }}>Click to edit</div>
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* Stats View */}
          {dashboardView === 'stats' && (
            <div>
              {trials.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#999' }}>No trials found. Log some trials to see results!</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  {/* Overall Stats */}
                  <div style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '8px', background: '#f0f8ff' }}>
                    <h4 style={{ margin: '0 0 10px 0' }}>Overall Stats</h4>
                    {(() => {
                      const totalRuns = trials.reduce((sum, t) => sum + (t.trial_runs?.length || 0), 0)
                      const totalQs = trials.reduce((sum, t) => sum + (t.trial_runs?.filter(r => r.is_q).length || 0), 0)
                      const overallPercent = totalRuns > 0 ? Math.round((totalQs / totalRuns) * 100) : 0
                      return (
                        <>
                          <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#007bff' }}>{overallPercent}%</div>
                          <div style={{ fontSize: '0.9em', color: '#666' }}>{totalQs} Qs out of {totalRuns} runs</div>
                          <div style={{ fontSize: '0.9em', color: '#666', marginTop: '5px' }}>{trials.length} trials</div>
                        </>
                      )
                    })()}
                  </div>

                  {/* Per Dog Stats */}
                  {dogs.map(dog => {
                    const dogTrials = trials.filter(t => t.dog_id === dog.id)
                    if (dogTrials.length === 0) return null
                    
                    const totalRuns = dogTrials.reduce((sum, t) => sum + (t.trial_runs?.length || 0), 0)
                    const totalQs = dogTrials.reduce((sum, t) => sum + (t.trial_runs?.filter(r => r.is_q).length || 0), 0)
                    const percent = totalRuns > 0 ? Math.round((totalQs / totalRuns) * 100) : 0
                    
                    return (
                      <div key={dog.id} style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '8px', background: percent === 100 ? '#d4edda' : percent >= 75 ? '#fff3cd' : '#f8d7da' }}>
                        <h4 style={{ margin: '0 0 10px 0' }}>{dog.call_name}</h4>
                        <div style={{ fontSize: '2em', fontWeight: 'bold', color: percent === 100 ? '#155724' : percent >= 75 ? '#856404' : '#721c24' }}>{percent}%</div>
                        <div style={{ fontSize: '0.9em', color: '#666' }}>{totalQs} Qs out of {totalRuns} runs</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Edit Modal */}
          {editingTrial && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div style={{ background: 'white', padding: '20px', borderRadius: '8px', maxWidth: '500px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
                <h3 style={{ marginTop: 0 }}>Edit Trial</h3>
                <form onSubmit={saveEditedTrial}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                    <select value={editTrialForm.dog_id} onChange={e => setEditTrialForm({...editTrialForm, dog_id: e.target.value})}>
                      <option value="">Select Dog</option>
                      {dogs.map(d => <option key={d.id} value={d.id}>{d.call_name}</option>)}
                    </select>
                    <select value={editTrialForm.venue} onChange={e => setEditTrialForm({...editTrialForm, venue: e.target.value})}>
                      <option value="AKC">AKC</option>
                      <option value="UKI">UKI</option>
                    </select>
                    <input type="date" value={editTrialForm.trial_date} onChange={e => setEditTrialForm({...editTrialForm, trial_date: e.target.value})} />
                    <input placeholder="Location" value={editTrialForm.location} onChange={e => setEditTrialForm({...editTrialForm, location: e.target.value})} />
                    <input placeholder="Judge Name" value={editTrialForm.judge_name} onChange={e => setEditTrialForm({...editTrialForm, judge_name: e.target.value})} />
                  </div>

                  <h4>Runs</h4>
                  {editRuns.map((run, i) => (
                    <div key={i} style={{ background: '#f9f9f9', padding: '10px', marginBottom: '10px', border: '1px solid #eee' }}>
                      <div style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
                        <select value={run.class_name} onChange={e => updateEditRun(i, 'class_name', e.target.value)} style={{ flex: 1 }}>
                          <option value="">Class</option>
                          {VENUE_CLASSES[editTrialForm.venue].map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select value={run.class_level} onChange={e => updateEditRun(i, 'class_level', e.target.value)} style={{ flex: 1 }}>
                          <option value="">Level</option>
                          {CLASS_LEVELS[editTrialForm.venue].map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                      </div>
                      <label style={{ marginLeft: '0px' }}>
                        <input type="checkbox" checked={run.is_q} onChange={e => updateEditRun(i, 'is_q', e.target.checked)} /> Q?
                      </label>
                      {!run.is_q && (
                        <select style={{ marginLeft: '10px' }} value={run.nq_reason} onChange={e => updateEditRun(i, 'nq_reason', e.target.value)}>
                          <option value="">Reason</option>
                          {NQ_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      )}
                      <textarea placeholder="Comments" value={run.comments} style={{ width: '100%', marginTop: '5px' }} onChange={e => updateEditRun(i, 'comments', e.target.value)} />
                    </div>
                  ))}
                  <button type="button" onClick={addEditRunRow} style={{ width: '100%', padding: '8px', marginBottom: '15px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px' }}>+ Add Run</button>
                  
                  <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                    <button type="submit" style={{ flex: 1, padding: '10px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}>Save Changes</button>
                    <button type="button" onClick={() => setEditingTrial(null)} style={{ flex: 1, padding: '10px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px' }}>Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default App