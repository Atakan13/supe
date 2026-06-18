import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function LobbyPage() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [lobby, setLobby] = useState(null)
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const lobbyIdRef = useRef(null)
  const channelRef = useRef(null)

  const userId = localStorage.getItem('draft_user_id')

  useEffect(() => {
    loadLobby()
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [code])

  const loadLobby = async () => {
    const { data, error } = await supabase
      .from('lobbies')
      .select('*')
      .ilike('code', code)
      .single()

    if (error || !data) {
      setError('Lobi bulunamadı')
      setLoading(false)
      return
    }

    setLobby(data)
    lobbyIdRef.current = data.id

    await loadPlayers(data.id)
    setLoading(false)

    // Önceki channel varsa temizle
    if (channelRef.current) supabase.removeChannel(channelRef.current)

    // Yeni channel kur
    channelRef.current = supabase
      .channel(`lobby-${data.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'lobby_players',
        filter: `lobby_id=eq.${data.id}`,
      }, () => {
        loadPlayers(data.id)
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'lobbies',
        filter: `id=eq.${data.id}`,
      }, (payload) => {
        setLobby(payload.new)
        if (payload.new.status === 'drafting') {
          navigate(`/draft/${code}`)
        }
      })
      .subscribe()
  }

  const loadPlayers = async (lobbyId) => {
    const { data } = await supabase
      .from('lobby_players')
      .select('*')
      .eq('lobby_id', lobbyId)
      .order('joined_at')
    if (data) setPlayers(data)
  }

  // 3 saniyede bir otomatik yenile (realtime backup)
  useEffect(() => {
    const interval = setInterval(() => {
      if (lobbyIdRef.current) loadPlayers(lobbyIdRef.current)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const handleReady = async () => {
    const me = players.find(p => p.user_id === userId)
    if (!me) return
    await supabase
      .from('lobby_players')
      .update({ is_ready: !me.is_ready })
      .eq('id', me.id)
    loadPlayers(lobbyIdRef.current)
  }

  const handleStart = async () => {
    if (players.length < 2) return
    const allReady = players.filter(p => !p.is_host).every(p => p.is_ready)
    if (!allReady) return
    await supabase.from('lobbies').update({ status: 'drafting' }).eq('id', lobby.id)
    navigate(`/draft/${code}`)
  }

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href)
  }

  const me = players.find(p => p.user_id === userId)
  const isHost = me?.is_host
  const allReady = players.length >= 2 && players.filter(p => !p.is_host).every(p => p.is_ready)

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--text-secondary)' }}>Yükleniyor...</div>
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ color: 'var(--red)', fontSize: '1.1rem' }}>{error}</div>
      <button className="btn btn-secondary" onClick={() => navigate('/')}>← Ana Menü</button>
    </div>
  )

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem',
    }}>
      <div style={{ width: '100%', maxWidth: '560px' }}>

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <p style={{ color: 'var(--purple-light)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            OYUN LOBİSİ
          </p>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '0.5rem' }}>Takımını Kur ⚽</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Arkadaşını bekle, hazır olunca başla.</p>
        </div>

        <div className="card" style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', marginBottom: '0.5rem' }}>LOBİ KODU</p>
          <div style={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: '0.3em', color: 'var(--purple-light)', marginBottom: '1rem' }}>
            {lobby?.code}
          </div>
          <button className="btn btn-secondary" style={{ width: '100%' }} onClick={copyLink}>
            🔗 Linki Kopyala
          </button>
        </div>

        <div className="card" style={{ marginBottom: '1rem' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', marginBottom: '1rem' }}>OYUN AYARLARI</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            {[
              ['Diziliş', lobby?.formation],
              ['Zorluk', lobby?.difficulty === 'easy' ? 'Kolay' : lobby?.difficulty === 'medium' ? 'Orta' : 'Zor'],
              ['Bütçe', `€${(lobby?.budget / 1000000).toFixed(0)}M`],
              ['Yıldız Limit', `${lobby?.star_limit} ⭐`],
            ].map(([label, value]) => (
              <div key={label} style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '0.75rem' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em', marginBottom: '0.25rem' }}>{label}</div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ marginBottom: '1rem' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', marginBottom: '1rem' }}>
            OYUNCULAR ({players.length}/2)
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {players.map(p => (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--bg-secondary)', borderRadius: 10, padding: '0.75rem 1rem',
                border: p.user_id === userId ? '1px solid var(--purple)' : '1px solid transparent',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: p.is_host ? 'var(--purple)' : 'var(--blue)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: '0.9rem',
                  }}>
                    {p.user_name[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                      {p.user_name}
                      {p.user_id === userId && <span style={{ color: 'var(--purple-light)', fontSize: '0.7rem', marginLeft: '0.4rem' }}>(sen)</span>}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{p.team_name}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {p.is_host && (
                    <span style={{ background: 'rgba(124,58,237,0.2)', color: 'var(--purple-light)', fontSize: '0.65rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: 6 }}>
                      HOST
                    </span>
                  )}
                  <span style={{
                    fontSize: '0.65rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: 6,
                    background: p.is_ready || p.is_host ? 'rgba(16,185,129,0.2)' : 'rgba(100,100,100,0.2)',
                    color: p.is_ready || p.is_host ? 'var(--green)' : 'var(--text-muted)',
                  }}>
                    {p.is_host ? 'HAZIR' : p.is_ready ? 'HAZIR' : 'BEKLİYOR'}
                  </span>
                </div>
              </div>
            ))}

            {players.length < 2 && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--bg-secondary)', borderRadius: 10, padding: '1rem',
                border: '1px dashed var(--border-light)', color: 'var(--text-muted)', fontSize: '0.85rem',
              }}>
                Arkadaşın bekleniyor...
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {!isHost && (
            <button
              className={`btn ${me?.is_ready ? 'btn-danger' : 'btn-success'}`}
              style={{ width: '100%', padding: '1rem' }}
              onClick={handleReady}
            >
              {me?.is_ready ? '❌ Hazır Değilim' : '✅ Hazırım'}
            </button>
          )}

          {isHost && (
            <button
              className="btn btn-primary"
              style={{ width: '100%', padding: '1rem', opacity: allReady ? 1 : 0.5 }}
              onClick={handleStart}
              disabled={!allReady}
            >
              {allReady ? '🚀 DRAFTI BAŞLAT' : players.length < 2 ? 'Oyuncu bekleniyor...' : 'Herkes hazır değil'}
            </button>
          )}

          <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => navigate('/')}>
            ← Menüye Dön
          </button>
        </div>

      </div>
    </div>
  )
}
