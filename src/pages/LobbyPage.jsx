import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// Kullanıcı ID her zaman oluştur
function getUserId() {
  let id = localStorage.getItem('draft_user_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('draft_user_id', id)
  }
  return id
}

export default function LobbyPage() {
  const { code } = useParams()
  const navigate = useNavigate()
  const userId = getUserId()

  const [lobby, setLobby] = useState(null)
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [needsJoin, setNeedsJoin] = useState(false)
  const [joinName, setJoinName] = useState('')
  const [joinTeam, setJoinTeam] = useState('')
  const [joinError, setJoinError] = useState('')
  const lobbyIdRef = useRef(null)
  const channelRef = useRef(null)

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

    const { data: existing } = await supabase
      .from('lobby_players')
      .select('*')
      .eq('lobby_id', data.id)
      .eq('user_id', userId)
      .single()

    if (!existing) {
      setNeedsJoin(true)
      setLoading(false)
      return
    }

    await loadPlayers(data.id)
    setLoading(false)
    setupRealtime(data.id)
  }

  const handleJoinLobby = async () => {
    if (!joinName.trim() || !joinTeam.trim()) {
      setJoinError('İsim ve takım adı gir')
      return
    }
    localStorage.setItem('draft_user_name', joinName)

    const { error: pe } = await supabase.from('lobby_players').insert({
      lobby_id: lobby.id,
      user_id: userId,
      user_name: joinName.trim(),
      team_name: joinTeam.trim(),
      is_host: false,
      is_ready: false,
    })

    if (pe) { setJoinError('Hata: ' + pe.message); return }
    setNeedsJoin(false)
    await loadPlayers(lobby.id)
    setupRealtime(lobby.id)
  }

  const setupRealtime = (lobbyId) => {
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    channelRef.current = supabase
      .channel('lobby-' + lobbyId)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'lobby_players',
        filter: `lobby_id=eq.${lobbyId}`,
      }, () => loadPlayers(lobbyId))
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'lobbies',
        filter: `id=eq.${lobbyId}`,
      }, (payload) => {
        setLobby(payload.new)
        if (payload.new.status === 'drafting') navigate(`/draft/${code}`)
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

  useEffect(() => {
    const interval = setInterval(() => {
      if (lobbyIdRef.current && !needsJoin) loadPlayers(lobbyIdRef.current)
    }, 3000)
    return () => clearInterval(interval)
  }, [needsJoin])

  const handleReady = async () => {
    const me = players.find(p => p.user_id === userId)
    if (!me) return
    await supabase.from('lobby_players').update({ is_ready: !me.is_ready }).eq('id', me.id)
    loadPlayers(lobbyIdRef.current)
  }

  const handleStart = async () => {
    if (players.length < 2) return
    const allReady = players.filter(p => !p.is_host).every(p => p.is_ready)
    if (!allReady) return
    await supabase.from('lobbies').update({ status: 'drafting' }).eq('id', lobby.id)
    navigate(`/draft/${code}`)
  }

  const copyLink = () => navigator.clipboard.writeText(window.location.origin + '/join/' + lobby?.code)

  const me = players.find(p => p.user_id === userId)
  const isHost = me?.is_host
  const allReady = players.length >= 2 && players.filter(p => !p.is_host).every(p => p.is_ready)

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'var(--bg-primary)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ color:'var(--text-secondary)' }}>Yükleniyor...</div>
    </div>
  )

  if (error) return (
    <div style={{ minHeight:'100vh', background:'var(--bg-primary)', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:'1rem' }}>
      <div style={{ color:'var(--red)', fontSize:'1.1rem' }}>{error}</div>
      <button className="btn btn-secondary" onClick={() => navigate('/menu')}>← Ana Menü</button>
    </div>
  )

  if (needsJoin) return (
    <div style={{ minHeight:'100vh', background:'var(--bg-primary)', display:'flex', alignItems:'center', justifyContent:'center', padding:'2rem' }}>
      <div style={{ width:'100%', maxWidth:'400px' }}>
        <div style={{ textAlign:'center', marginBottom:'2rem' }}>
          <p style={{ color:'var(--purple-light)', fontSize:'.7rem', fontWeight:700, letterSpacing:'.15em', textTransform:'uppercase', marginBottom:'.5rem' }}>LOBİYE KATIL</p>
          <h1 style={{ fontSize:'1.8rem', fontWeight:900, marginBottom:'.5rem' }}>⚽ {lobby?.code}</h1>
          <p style={{ color:'var(--text-secondary)', fontSize:'.9rem' }}>Lobiye katılmak için bilgilerini gir.</p>
        </div>
        <div className="card" style={{ display:'flex', flexDirection:'column', gap:'.75rem' }}>
          <input className="input" placeholder="Adın" value={joinName} onChange={e => setJoinName(e.target.value)} />
          <input className="input" placeholder="Takım adın" value={joinTeam} onChange={e => setJoinTeam(e.target.value)} />
          {joinError && <p style={{ color:'var(--red)', fontSize:'.8rem' }}>{joinError}</p>}
          <button className="btn btn-primary" style={{ width:'100%', padding:'1rem' }} onClick={handleJoinLobby}>
            KATIL →
          </button>
          <button className="btn btn-secondary" style={{ width:'100%' }} onClick={() => navigate('/menu')}>
            ← Ana Menü
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg-primary)', display:'flex', alignItems:'center', justifyContent:'center', padding:'2rem' }}>
      <div style={{ width:'100%', maxWidth:'560px' }}>
        <div style={{ textAlign:'center', marginBottom:'2rem' }}>
          <p style={{ color:'var(--purple-light)', fontSize:'.7rem', fontWeight:700, letterSpacing:'.15em', textTransform:'uppercase', marginBottom:'.5rem' }}>OYUN LOBİSİ</p>
          <h1 style={{ fontSize:'2rem', fontWeight:900, marginBottom:'.5rem' }}>Takımını Kur ⚽</h1>
          <p style={{ color:'var(--text-secondary)', fontSize:'.9rem' }}>Arkadaşını bekle, hazır olunca başla.</p>
        </div>

        <div className="card" style={{ textAlign:'center', marginBottom:'1rem' }}>
          <p style={{ color:'var(--text-muted)', fontSize:'.75rem', fontWeight:600, letterSpacing:'.1em', marginBottom:'.5rem' }}>LOBİ KODU</p>
          <div style={{ fontSize:'2.5rem', fontWeight:900, letterSpacing:'.3em', color:'var(--purple-light)', marginBottom:'1rem' }}>{lobby?.code}</div>
          <button className="btn btn-secondary" style={{ width:'100%' }} onClick={copyLink}>🔗 Linki Kopyala</button>
        </div>

        <div className="card" style={{ marginBottom:'1rem' }}>
          <p style={{ color:'var(--text-muted)', fontSize:'.75rem', fontWeight:600, letterSpacing:'.1em', marginBottom:'1rem' }}>OYUN AYARLARI</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'.75rem' }}>
            {[
              ['Diziliş', lobby?.formation],
              ['Zorluk', lobby?.difficulty === 'easy' ? 'Kolay' : lobby?.difficulty === 'medium' ? 'Orta' : 'Zor'],
              ['Bütçe', `€${(lobby?.budget/1000000).toFixed(0)}M`],
              ['Yıldız Limit', `${lobby?.star_limit} ⭐`],
            ].map(([label, value]) => (
              <div key={label} style={{ background:'var(--bg-secondary)', borderRadius:10, padding:'.75rem' }}>
                <div style={{ color:'var(--text-muted)', fontSize:'.7rem', fontWeight:600, letterSpacing:'.08em', marginBottom:'.25rem' }}>{label}</div>
                <div style={{ fontWeight:700, fontSize:'.95rem' }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ marginBottom:'1rem' }}>
          <p style={{ color:'var(--text-muted)', fontSize:'.75rem', fontWeight:600, letterSpacing:'.1em', marginBottom:'1rem' }}>
            OYUNCULAR ({players.length}/2)
          </p>
          <div style={{ display:'flex', flexDirection:'column', gap:'.5rem' }}>
            {players.map(p => (
              <div key={p.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--bg-secondary)', borderRadius:10, padding:'.75rem 1rem', border:`1px solid ${p.user_id===userId?'var(--purple)':'transparent'}` }}>
                <div style={{ display:'flex', alignItems:'center', gap:'.75rem' }}>
                  <div style={{ width:36, height:36, borderRadius:8, background:p.is_host?'var(--purple)':'var(--blue)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:'.9rem' }}>
                    {p.user_name[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight:700, fontSize:'.9rem' }}>
                      {p.user_name}
                      {p.user_id === userId && <span style={{ color:'var(--purple-light)', fontSize:'.7rem', marginLeft:'.4rem' }}>(sen)</span>}
                    </div>
                    <div style={{ color:'var(--text-muted)', fontSize:'.75rem' }}>{p.team_name}</div>
                  </div>
                </div>
                <div style={{ display:'flex', gap:'.5rem', alignItems:'center' }}>
                  {p.is_host && <span style={{ background:'rgba(124,58,237,.2)', color:'var(--purple-light)', fontSize:'.65rem', fontWeight:700, padding:'.2rem .5rem', borderRadius:6 }}>HOST</span>}
                  <span style={{ fontSize:'.65rem', fontWeight:700, padding:'.2rem .5rem', borderRadius:6, background:p.is_ready||p.is_host?'rgba(16,185,129,.2)':'rgba(100,100,100,.2)', color:p.is_ready||p.is_host?'var(--green)':'var(--text-muted)' }}>
                    {p.is_host||p.is_ready?'HAZIR':'BEKLİYOR'}
                  </span>
                </div>
              </div>
            ))}
            {players.length < 2 && (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg-secondary)', borderRadius:10, padding:'1rem', border:'1px dashed var(--border-light)', color:'var(--text-muted)', fontSize:'.85rem' }}>
                Arkadaşın bekleniyor...
              </div>
            )}
          </div>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:'.75rem' }}>
          {!isHost && me && (
            <button className={`btn ${me.is_ready?'btn-danger':'btn-success'}`} style={{ width:'100%', padding:'1rem' }} onClick={handleReady}>
              {me.is_ready ? '❌ Hazır Değilim' : '✅ Hazırım'}
            </button>
          )}
          {isHost && (
            <button className="btn btn-primary" style={{ width:'100%', padding:'1rem', opacity:allReady?1:.5 }} onClick={handleStart} disabled={!allReady}>
              {allReady ? '🚀 DRAFTI BAŞLAT' : players.length < 2 ? 'Oyuncu bekleniyor...' : 'Herkes hazır değil'}
            </button>
          )}
          <button className="btn btn-secondary" style={{ width:'100%' }} onClick={() => navigate('/menu')}>← Menüye Dön</button>
        </div>
      </div>
    </div>
  )
}
