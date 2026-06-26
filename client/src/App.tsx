import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Landing from './pages/Landing'
import QuestionBank from './pages/QuestionBank'
import InterviewSession from './pages/InterviewSession'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile'

const LeetCodeSession = lazy(() => import('./pages/LeetCodeSession'))

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/practice/:type" element={<QuestionBank />} />
        <Route path="/practice/leetcode/session" element={
          <Suspense fallback={
            <div style={{ minHeight: '100vh', background: '#0c0c0e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: '#6b6b7a', fontFamily: 'Inter, system-ui, sans-serif' }}>Loading editor…</p>
            </div>
          }>
            <LeetCodeSession />
          </Suspense>
        } />
        <Route path="/practice/:type/session" element={<InterviewSession />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/practice" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
