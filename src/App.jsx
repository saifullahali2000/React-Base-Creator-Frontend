import { Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './components/AppShell'
import GeneratePage from './pages/GeneratePage'
import OpenBookPage from './pages/OpenBookPage'
import PreviewPage from './pages/PreviewPage'
import './App.css'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/topin-base" replace />} />
        <Route path="topin-base" element={<GeneratePage />} />
        <Route path="open-book" element={<OpenBookPage />} />
        <Route path="preview" element={<PreviewPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/topin-base" replace />} />
    </Routes>
  )
}
