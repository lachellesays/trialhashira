import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSignUp = async (e) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) alert(error.message)
    else alert('Check your email for confirmation (if enabled) or try logging in!')
    setLoading(false)
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) alert(error.message)
    setLoading(false)
  }

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h2>Login or Sign Up</h2>
      <form>
        <input type="email" placeholder="Email" onChange={e => setEmail(e.target.value)} style={{ display: 'block', margin: '10px 0' }} />
        <input type="password" placeholder="Password" onChange={e => setPassword(e.target.value)} style={{ display: 'block', margin: '10px 0' }} />
        <button onClick={handleLogin} disabled={loading} style={{ marginRight: '10px' }}>Log In</button>
        <button onClick={handleSignUp} disabled={loading}>Sign Up</button>
      </form>
    </div>
  )
}