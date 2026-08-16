import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import App from './App'
import ChatPage from './pages/ChatPage'
import MemoryPage from './pages/MemoryPage'
import SearchPage from './pages/SearchPage'
import LibraryPage from './pages/LibraryPage'
import ModulesPage from './pages/ModulesPage'
import ProjectsPage from './pages/ProjectsPage'
import KnowledgePage from './pages/KnowledgePage'
import { SettingsProvider } from './settings'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<App />}>
            <Route index element={<ChatPage />} />
            <Route path="memory" element={<MemoryPage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="library" element={<LibraryPage />} />
            <Route path="modules" element={<ModulesPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="knowledge" element={<KnowledgePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SettingsProvider>
  </StrictMode>,
)
