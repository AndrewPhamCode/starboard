import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Landing from './pages/Landing'
import QuestionBank from './pages/QuestionBank'
import InterviewSession from './pages/InterviewSession'

const LeetCodeSession = lazy(() => import('./pages/LeetCodeSession'))

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/practice/:type" element={<QuestionBank />} />
        <Route path="/practice/leetcode/session" element={
          <Suspense fallback={
            <div className="min-h-screen bg-amber-50 flex items-center justify-center">
              <p className="text-amber-700 font-bold">Loading editor…</p>
            </div>
          }>
            <LeetCodeSession />
          </Suspense>
        } />
        <Route path="/practice/:type/session" element={<InterviewSession />} />
        <Route path="/practice" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
