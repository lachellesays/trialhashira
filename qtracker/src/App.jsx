import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Auth from './Auth'

function App() {
  const [session, setSession] = useState(null)
  const [userName, setUserName] = useState('')
  const [dogName, setDogName] = useState('')

  // Check for an existing session when the app loads
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    // Listen for changes (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function saveDogInfo() {
    // We don't need to manually pass user_id; the database handles it with auth.uid()
    const { error } = await supabase
      .from('user_profiles') 
      .insert([{ person_name: userName, dog_name: dogName }])
    
    if (error) alert(error.message)
    else alert("Information saved!")
  }

  if (!session) {
    return <div style={{ padding: '50px' }}><Auth /></div>
  }

  return (
    <div style={{ padding: '40px' }}>
      <h1>Dog Tracker</h1>
      <p>Logged in as: {session.user.email}</p>
      
      <input placeholder="Your Name" onChange={(e) => setUserName(e.target.value)} />
      <input placeholder="Dog's Name" onChange={(e) => setDogName(e.target.value)} />
      <button onClick={saveDogInfo}>Save</button>

      <div style={{ marginTop: '20px' }}>
        <button onClick={() => supabase.auth.signOut()}>Sign Out</button>
      </div>
    </div>
  )
}

export default App