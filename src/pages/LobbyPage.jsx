import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getClub } from '../lib/club'
import { LogoPreview } from '../components/LogoPreview'

function getUserId() {
  let id = localStorage.getItem('draft_user_id')
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('draft_user_id', id) }
  return id
}

export default function LobbyPage() {
  const { code } = useParams()
  const navigate = useNavigate()
  const userId = getUserId()
  const club = getClub()

  const [lobby, setLobby] = useState(null)
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const lobbyIdRef = useRef(null)
  const channelRef = useRef(null)

  useEffect(() => {
    loadLobby()
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [code])

  useEffect(() => {
    const interval = setInterval(() => {
      if (lobbyIdRef.current) loadPlayers(lobbyIdRef.current)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const loadLobby = async () => {
    const { data, error } = await supabase.from('lobbies').select('*').ilike('code', code).single()
    if (error || !data) { setError('Lobi bulunamadı'); setLoading(false); return }
    setLobby(data)
    lobbyIdRef.current = data.id
    await loadPlayers(data.id)
    setLoading(false)
    setupRealtime(data.id)
  }

  const setupRealtime = (lobbyId) => {
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    channelRef.current = supabase.channel('lobby-' + lobbyId)
      .on('postgres_changes', { event:'*', schema:'public', table:'lobby_players', filter:`lobby_id=eq.${lobbyId}` }, () => loadPlayers(lobbyId))
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'lobbies', filter:`id=eq.${lobbyId}` }, (payload) => {
        setLobby(payload.new)
        if (payload.new.status === 'drafting') navigate(`/draft/${code}`)
      })
      .subscribe()
  }

  const loadPlayers = async (lobbyId) => {
    const { data } = await supabase.from('lobby_players').select('*').eq('lobby_id', lobbyId).order('joined_at')
    if (data) setPlayers(data)
  }

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
    <div style={{ minHeight:'100vh', background:'#080c18', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:20, letterSpacing:4, color:'rgba(0,200,255,0.6)' }}>YÜKLENİYOR...</div>
    </div>
  )

  if (error) return (
    <div style={{ minHeight:'100vh', background:'#080c18', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:'1rem' }}>
      <div style={{ color:'#ef4444', fontSize:'1.1rem' }}>{error}</div>
      <button onClick={() => navigate('/menu')} style={{ padding:'10px 24px', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'#fff', cursor:'pointer' }}>← Ana Menü</button>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', backgroundImage:'url(/assets/stadium_info.jpg)', backgroundSize:'cover', backgroundPosition:'center', display:'flex', flexDirection:'column', alignItems:'center', padding:'2.5rem 1.5rem', position:'relative' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Rajdhani:wght@400;500;600;700&display=swap');`}</style>
      <div style={{ position:'fixed', inset:0, background:'rgba(4,4,16,0.82)', pointerEvents:'none' }}/>
      <div style={{ position:'fixed', inset:0, background:'radial-gradient(ellipse 60% 50% at 50% 0%,rgba(0,200,255,0.08) 0%,transparent 70%)', pointerEvents:'none' }}/>

      <div style={{ position:'relative', zIndex:1, width:'100%', maxWidth:700, display:'flex', flexDirection:'column', gap:'1.25rem' }}>

        {/* Başlık */}
        <div style={{ textAlign:'center' }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:11, letterSpacing:4, color:'rgba(0,200,255,0.6)', marginBottom:6 }}>OYUN LOBİSİ</div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:36, letterSpacing:3, color:'#fff', marginBottom:4 }}>TAKIM KUR ⚽</div>
          <div style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:13, color:'rgba(255,255,255,0.35)', letterSpacing:1 }}>Arkadaşını bekle, hazır olunca başla.</div>
        </div>

        {/* Üst iki panel */}
        <div style={{ display:'flex', gap:'1.25rem' }}>

          {/* Lobi Kodu */}
          <div style={{ flex:1, background:'rgba(20,25,40,0.55)', backdropFilter:'blur(12px)', border:'1px solid rgba(0,200,255,0.3)', borderRadius:12, padding:'1.5rem', boxShadow:'0 8px 32px rgba(0,0,0,0.5), inset 0 0 15px rgba(0,200,255,0.05)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'1rem' }}>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:10, letterSpacing:3, color:'rgba(255,255,255,0.35)' }}>LOBİ KODU</div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:52, letterSpacing:8, color:'#a855f7', lineHeight:1, textShadow:'0 0 20px rgba(168,85,247,0.5)' }}>{lobby?.code}</div>
            <button onClick={copyLink}
              style={{ width:'80%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.15)', color:'#fff', padding:'10px', borderRadius:6, fontFamily:"'Rajdhani',sans-serif", fontSize:13, fontWeight:600, cursor:'pointer', letterSpacing:1, transition:'all .2s' }}>
              🔗 Linki Kopyala
            </button>
          </div>

          {/* Profil */}
          <div style={{ flex:1, background:'rgba(20,25,40,0.55)', backdropFilter:'blur(12px)', border:'1px solid rgba(0,200,255,0.3)', borderRadius:12, padding:'1.5rem', boxShadow:'0 8px 32px rgba(0,0,0,0.5)', display:'flex', alignItems:'center', gap:'1rem' }}>
            {/* Logo */}
            <div style={{ border:'2px solid #ffcc00', borderRadius:8, padding:4, boxShadow:'0 0 20px rgba(255,204,0,0.3)', flexShrink:0 }}>
              <LogoPreview shape={club?.logo?.shape||'shield'} icon={club?.logo?.icon||'lion'} bgColor={club?.logo?.bg||'#7c3aed'} accentColor={club?.logo?.accent||'#fbbf24'} size={70}/>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:16, letterSpacing:1, color:'#ffcc00', marginBottom:8 }}>SEVİYE 1: ACEMİ</div>
              <div style={{ background:'rgba(0,0,0,0.4)', padding:'10px', borderRadius:6, border:'1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:11, color:'rgba(255,255,255,0.4)', marginBottom:4 }}>🛡️ Taktik Bonusu:</div>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:16, color:'#00ffcc', marginBottom:6 }}>{club?.managerStyle?.toUpperCase()||'MENAJER'} +5</div>
                <div style={{ display:'flex', gap:4 }}>
                  {[1,2,3,4,5].map(i=>(
                    <div key={i} style={{ flex:1, height:4, borderRadius:2, background:i<=3?'#5c6bc0':'#333', boxShadow:i<=3?'0 0 6px #5c6bc0':'none' }}/>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Oyuncular */}
        <div style={{ background:'rgba(20,25,40,0.55)', backdropFilter:'blur(12px)', border:'1px solid rgba(0,200,255,0.3)', borderRadius:12, padding:'1.5rem', boxShadow:'0 8px 32px rgba(0,0,0,0.5)' }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:10, letterSpacing:3, color:'rgba(255,255,255,0.35)', marginBottom:14 }}>OYUNCULAR ({players.length}/2)</div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {players.map(p => (
              <div key={p.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(30,20,50,0.6)', border:`1px solid ${p.user_id===userId?'rgba(138,43,226,0.6)':'rgba(138,43,226,0.2)'}`, padding:'12px 16px', borderRadius:8 }}>
                <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                  <div style={{ width:38, height:38, background:p.is_host?'#8a2be2':'#1e40af', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, borderRadius:6, fontSize:16, flexShrink:0 }}>
                    {p.user_name?.[0]?.toUpperCase()||'?'}
                  </div>
                  <div>
                    <div style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:16, fontWeight:700, color:'#fff' }}>
                      {p.user_name}
                      {p.user_id===userId && <span style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:12, color:'rgba(168,85,247,0.8)', marginLeft:6, fontWeight:400 }}>(sen)</span>}
                    </div>
                    <div style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:12, color:'rgba(255,255,255,0.4)' }}>{p.team_name}</div>
                  </div>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  {p.is_host && (
                    <span style={{ background:'rgba(138,43,226,0.2)', color:'#c084fc', border:'1px solid rgba(138,43,226,0.5)', padding:'4px 10px', borderRadius:4, fontFamily:"'Bebas Neue',sans-serif", fontSize:11, letterSpacing:1 }}>HOST</span>
                  )}
                  <span style={{ background:p.is_ready||p.is_host?'rgba(0,204,102,0.15)':'rgba(100,100,100,0.2)', color:p.is_ready||p.is_host?'#00ff88':'#666', border:`1px solid ${p.is_ready||p.is_host?'rgba(0,204,102,0.4)':'rgba(100,100,100,0.2)'}`, padding:'4px 10px', borderRadius:4, fontFamily:"'Bebas Neue',sans-serif", fontSize:11, letterSpacing:1 }}>
                    {p.is_host||p.is_ready?'HAZIR':'BEKLİYOR'}
                  </span>
                </div>
              </div>
            ))}
            {players.length < 2 && (
              <div style={{ border:'1px dashed rgba(255,255,255,0.15)', background:'rgba(0,0,0,0.2)', padding:'16px', borderRadius:8, textAlign:'center', fontFamily:"'Rajdhani',sans-serif", fontSize:13, color:'rgba(255,255,255,0.4)', letterSpacing:1 }}>
                Arkadaşın bekleniyor...
              </div>
            )}
          </div>
        </div>

        {/* Alt butonlar */}
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {!isHost && me && (
            <button onClick={handleReady}
              style={{ width:'100%', background:me.is_ready?'rgba(239,68,68,0.2)':'linear-gradient(90deg,#8a2be2,#b82bf2)', border:me.is_ready?'1px solid rgba(239,68,68,0.5)':'none', color:'#fff', padding:'16px', fontSize:16, fontWeight:700, fontFamily:"'Bebas Neue',sans-serif", letterSpacing:3, borderRadius:8, cursor:'pointer', boxShadow:me.is_ready?'none':'0 0 20px rgba(138,43,226,0.4)', transition:'all .2s' }}>
              {me.is_ready ? '❌ HAZIR DEĞİLİM' : '✅ HAZIRM'}
            </button>
          )}
          {isHost && (
            <button onClick={handleStart} disabled={!allReady}
              style={{ width:'100%', background:allReady?'linear-gradient(90deg,#8a2be2,#b82bf2)':'rgba(255,255,255,0.06)', border:'none', color:allReady?'#fff':'rgba(255,255,255,0.3)', padding:'16px', fontSize:16, fontWeight:700, fontFamily:"'Bebas Neue',sans-serif", letterSpacing:3, borderRadius:8, cursor:allReady?'pointer':'not-allowed', boxShadow:allReady?'0 0 20px rgba(138,43,226,0.5)':'none', transition:'all .2s' }}>
              {allReady ? '🚀 DRAFTI BAŞLAT' : players.length < 2 ? 'OYUNCU BEKLENİYOR...' : 'HERKES HAZIR DEĞİL'}
            </button>
          )}
          <button onClick={() => navigate('/menu')}
            style={{ width:'100%', background:'rgba(20,20,25,0.8)', border:'1px solid rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.5)', padding:'13px', fontFamily:"'Bebas Neue',sans-serif", fontSize:13, letterSpacing:2, borderRadius:8, cursor:'pointer', transition:'all .2s' }}>
            ← MENÜYE DÖN
          </button>
        </div>

      </div>
    </div>
  )
}
