import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import IntroPage from './pages/IntroPage'
import MenuPage from './pages/MenuPage'
import LobbyPage from './pages/LobbyPage'
import JoinClubPage from './pages/JoinClubPage'
import DraftPage from './pages/DraftPage'
import GamePage from './pages/GamePage'
import MatchPage from './pages/MatchPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<IntroPage />} />
        <Route path="/menu" element={<MenuPage />} />
        <Route path="/join/:code" element={<JoinClubPage />} />
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
