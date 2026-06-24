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
  const { code } = window.location.pathname.match(/\/join\/(.+)/)||{}
  const params = window.location.pathname.split('/join/')[1]
  sessionStorage.setItem('intro_redirect', '/join/' + (params||''))
  window.location.replace('/')
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
