import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Auth from './Auth'

function App() {
  const [session, setSession] = useState(null)
  const [activeTab, setActiveTab] = useState('add') // 'add' or 'profile'
  
  // State for adding new data
  const [userName, setUserName] = useState('')
  const [dogName, setDogName] = useState('')

  // State for displaying saved data
  const [profileData, setProfileData] = useState([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Function to fetch data from Supabase
  const fetchProfile = async () => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('person_name, dog_name, created_at')
      .order('created_at', { ascending: false })

    if (error) console.error("Error fetching:", error.message)
    else setProfileData(data)
  }

  // Fetch data whenever the user switches to the 'profile' tab
  useEffect(() => {
    if (activeTab === 'profile' && session) {
      fetchProfile()
    }
  }, [activeTab, session])

  async function saveDogInfo() {
    const { error } = await supabase
      .from('user_profiles') 
      .insert([{ person_name: userName, dog_name: dogName }])
    
    if (error) alert(error.message)
    else {
      alert("Information saved!")
      setUserName('')
      setDogName('')
      setActiveTab('profile') // Automatically jump to the list after saving
    }
  }

  if (!session) {
    return <div style={{ padding: '50px' }}><Auth /></div>
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '40px', fontFamily: 'sans-serif' }}>
      <h1>Dog Tracker</h1>
      
      {/* Tab Navigation */}
      <div style={{ borderBottom: '1px solid #ccc', marginBottom: '20px' }}>
        <button 
          onClick={() => setActiveTab('add')}
          style={{ padding: '10px 20px', border: 'none', background: activeTab === 'add' ? '#eee' : 'transparent', borderBottom: activeTab === 'add' ? '2px solid blue' : 'none', cursor: 'pointer' }}
        >
          Add New
        </button>
        <button 
          onClick={() => setActiveTab('profile')}
          style={{ padding: '10px 20px', border: 'none', background: activeTab === 'profile' ? '#eee' : 'transparent', borderBottom: activeTab === 'profile' ? '2px solid blue' : 'none', cursor: 'pointer' }}
        >
          View Profiles
        </button>
      </div>

      {/* Tab Content: Add Info */}
      {activeTab === 'add' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h3>Add Dog Details</h3>
          <input placeholder="Handler Name" value={userName} onChange={(e) => setUserName(e.target.value)} style={{ padding: '10px' }} />
          <input placeholder="Dog's Name" value={dogName} onChange={(e) => setDogName(e.target.value)} style={{ padding: '10px' }} />
          <button onClick={saveDogInfo} style={{ padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Save to Database
          </button>
        </div>
      )}

      {/* Tab Content: View Profile */}
      {activeTab === 'profile' && (
        <div>
          <h3>Your Team</h3>
          {profileData.length === 0 ? (
            <p>No dogs found. Go to the Add tab to get started!</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {profileData.map((item, index) => (
                <li key={index} style={{ padding: '15px', border: '1px solid #eee', marginBottom: '10px', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
                  <strong>{item.dog_name}</strong> <br />
                  <span style={{ fontSize: '0.9em', color: '#666' }}>Handler: {item.person_name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div style={{ marginTop: '40px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
        <button onClick={() => supabase.auth.signOut()} style={{ color: 'red', background: 'none', border: 'none', cursor: 'pointer' }}>
          Sign Out ({session.user.email})
        </button>
      </div>
    </div>
  )
}

export default App