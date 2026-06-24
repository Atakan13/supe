import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import IntroPage from './pages/IntroPage'
import MenuPage from './pages/MenuPage'
import CreateInfoPage from './pages/CreateInfoPage'
import CreateLogoPage from './pages/CreateLogoPage'
import CreateKitPage from './pages/CreateKitPage'
import LobbyPage from './pages/LobbyPage'
import JoinClubPage from './pages/JoinClubPage'
import DraftPage from './pages/DraftPage'
import GamePage from './pages/GamePage'
import MatchPage from './pages/MatchPage'

function JoinRedirect() {
  const params = window.location.pathname.split('/join/')[1]
  const dest = '/join/' + (params||'')
  // Intro daha önce gösterildiyse direkt git
  if (sessionStorage.getItem('intro_shown')) {
    window.location.replace(dest)
  } else {
    sessionStorage.setItem('intro_redirect', dest)
    window.location.replace('/')
  }
  return null
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<IntroPage />} />
        <Route path="/menu" element={<MenuPage />} />
        <Route path="/create/info" element={<CreateInfoPage />} />
        <Route path="/create/logo" element={<CreateLogoPage />} />
        <Route path="/create/kit" element={<CreateKitPage />} />
        <Route path="/join/:code" element={<JoinRedirect />} />
        <Route path="/join-direct/:code" element={<JoinClubPage />} />
        <Route path="/lobby/:code" element={<LobbyPage />} />
        <Route path="/draft/:code" element={<DraftPage />} />
        <Route path="/game/:code" element={<GamePage />} />
        <Route path="/match/:matchId" element={<MatchPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
