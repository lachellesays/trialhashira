import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false) // Your original toggle switch
  const [isForgotPassword, setIsForgotPassword] = useState(false) // New toggle for reset flow
  
  // Form State
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')

  const handleAuth = async (e) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (isForgotPassword) {
        // --- FORGOT PASSWORD LOGIC ---
        const { error } = await supabase.auth.resetPasswordForEmail(email)
        if (error) throw error
        alert('Password reset email sent! Please check your inbox.')
        setIsForgotPassword(false) // Send them back to the sign-in screen
        
      } else if (isSignUp) {
        // --- SIGN UP LOGIC ---
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName,
              last_name: lastName,
            }
          }
        })
        if (error) throw error
        alert('Success! Please check your email for a confirmation link to log in.')
        
      } else {
        // --- LOG IN LOGIC ---
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
      }
    } catch (error) {
      alert(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '400px', margin: '40px auto', padding: '30px', fontFamily: 'sans-serif', border: '1px solid #eee', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
      
      <h2 style={{ textAlign: 'center', marginBottom: '25px', color: '#333' }}>
        {isForgotPassword ? 'Reset Password' : (isSignUp ? 'Create an Account' : 'Welcome Back')}
      </h2>
      
      <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        
        {/* Only show Name fields if they are signing up and NOT resetting password */}
        {isSignUp && !isForgotPassword && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <input 
              type="text" 
              placeholder="First Name" 
              required 
              value={firstName} 
              onChange={(e) => setFirstName(e.target.value)} 
              style={{ flex: 1, padding: '12px', borderRadius: '6px', border: '1px solid #ccc' }}
            />
            <input 
              type="text" 
              placeholder="Last Name" 
              required 
              value={lastName} 
              onChange={(e) => setLastName(e.target.value)} 
              style={{ flex: 1, padding: '12px', borderRadius: '6px', border: '1px solid #ccc' }}
            />
          </div>
        )}

        <input 
          type="email" 
          placeholder="Email address" 
          required 
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
          style={{ padding: '12px', borderRadius: '6px', border: '1px solid #ccc' }}
        />
        
        {/* Hide password input if they just need to enter their email for a reset link */}
        {!isForgotPassword && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <input 
              type="password" 
              placeholder="Password (min 6 characters)" 
              required 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              style={{ padding: '12px', borderRadius: '6px', border: '1px solid #ccc' }}
            />
            {/* Show 'Forgot Password?' link only on the standard Sign In view */}
            {!isSignUp && (
              <button 
                type="button" 
                onClick={() => setIsForgotPassword(true)} 
                style={{ alignSelf: 'flex-end', background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '0.8em', marginTop: '8px' }}
              >
                Forgot password?
              </button>
            )}
          </div>
        )}

        <button 
          type="submit" 
          disabled={isLoading}
          style={{ 
            marginTop: '10px',
            padding: '14px', 
            backgroundColor: '#007bff', 
            color: 'white', 
            border: 'none', 
            borderRadius: '6px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            fontSize: '1em'
          }}
        >
          {isLoading ? 'Processing...' : (isForgotPassword ? 'Send Reset Link' : (isSignUp ? 'Sign Up' : 'Sign In'))}
        </button>
      </form>

      {/* The Bottom Toggle Area */}
      <div style={{ textAlign: 'center', marginTop: '25px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
        {isForgotPassword ? (
          <button onClick={() => setIsForgotPassword(false)} style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', fontSize: '0.9em' }}>
            Back to Sign In
          </button>
        ) : (
          <button 
            onClick={() => setIsSignUp(!isSignUp)} 
            style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '0.9em' }}
          >
            {isSignUp ? (
              <span>Already have an account? <strong style={{color: '#007bff'}}>Sign in here.</strong></span>
            ) : (
              <span>Don't have an account? <strong style={{color: '#007bff'}}>Sign up here.</strong></span>
            )}
          </button>
        )}
      </div>
    </div>
  )
}