import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getClub, saveClub } from '../lib/club'

function getUserId() {
  let id = localStorage.getItem('draft_user_id')
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('draft_user_id', id) }
  return id
}

const MANAGER_STYLES = [
  { id:'aggressive', name:'Agresif',   emoji:'⚡', desc:'Atak statlarına +5 bonus',  color:'#ef4444' },
  { id:'defensive',  name:'Defansif',  emoji:'🛡️', desc:'Defans statlarına +5 bonus', color:'#3b82f6' },
  { id:'possession', name:'Tiki-Taka', emoji:'🎯', desc:'Pas statlarına +5 bonus',    color:'#10b981' },
  { id:'counter',    name:'Kontra',    emoji:'💨', desc:'Hız statlarına +5 bonus',    color:'#f59e0b' },
  { id:'physical',   name:'Fiziksel',  emoji:'💪', desc:'Fizik statlarına +5 bonus',  color:'#8b5cf6' },
  { id:'technical',  name:'Teknik',    emoji:'🎨', desc:'Çalım statlarına +5 bonus',  color:'#ec4899' },
]

export default function JoinClubPage() {
  const { code } = useParams()
  const navigate = useNavigate()
  const userId = getUserId()
  const existingClub = getClub()

  const [step, setStep] = useState(existingClub ? 'joining' : 'create')
  const [clubName,     setClubName]     = useState(existingClub?.clubName     || '')
  const [managerName,  setManagerName]  = useState(existingClub?.managerName  || '')
  const [managerStyle, setManagerStyle] = useState(existingClub?.managerStyle || null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const canProceed = clubName.trim() && managerName.trim() && managerStyle

  // Kulübü varsa direkt lobiye katıl
  useEffect(() => {
    if (existingClub && step === 'joining') {
      joinLobby(existingClub)
    }
  }, [])

  const joinLobby = async (club) => {
    setLoading(true)
    setError('')
    try {
      const { data: lobbies } = await supabase
        .from('lobbies').select('*').ilike('code', code).eq('status', 'waiting')
      if (!lobbies?.length) throw new Error('Lobi bulunamadı veya başlamış')
      const lobby = lobbies[0]

      // Zaten katılmış mı?
      const { data: existing } = await supabase
        .from('lobby_players').select('id').eq('lobby_id', lobby.id).eq('user_id', userId).maybeSingle()

      if (!existing) {
        const { error: pe } = await supabase.from('lobby_players').insert({
          lobby_id: lobby.id, user_id: userId,
          user_name: club.managerName, manager_name: club.managerName,
          team_name: club.clubName,
          logo: club.logo || null, kit: club.kit || null,
          manager_style: club.managerStyle || null,
          is_host: false, is_ready: false,
        })
        if (pe && pe.code !== '23505') throw pe
      }
      navigate(`/lobby/${lobby.code}`)
    } catch(e) {
      setError(e.message)
      setStep('create')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveAndJoin = async () => {
    if (!canProceed) return
    const club = {
      clubName, managerName, managerStyle,
      logo: { shape:'shield', icon:'⚽', bg:'#7c3aed', accent:'#fbbf24' },
      kit:  { primary:'#dc2626', secondary:'#ffffff', pattern:'solid' },
    }
    saveClub(club)
    localStorage.setItem('draft_user_name', managerName)
    await joinLobby(club)
  }

  if (step === 'joining' && loading) return (
    <div style={{ minHeight:'100vh', background:'#080c18', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:'1rem' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Rajdhani:wght@400;600;700&display=swap');`}</style>
      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:20, letterSpacing:4, color:'rgba(0,200,255,0.8)' }}>LOBİYE KATILINIYOR...</div>
      <div style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:14, color:'rgba(255,255,255,0.3)', letterSpacing:1 }}>Lobi kodu: {code}</div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', backgroundImage:'url(/assets/stadium_info.jpg)', backgroundSize:'cover', backgroundPosition:'center', display:'flex', alignItems:'center', justifyContent:'center', padding:'2rem', position:'relative' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Rajdhani:wght@400;600;700&display=swap');`}</style>
      <div style={{ position:'fixed', inset:0, background:'rgba(4,4,16,0.80)', pointerEvents:'none' }}/>
      <div style={{ position:'fixed', inset:0, background:'radial-gradient(ellipse 60% 50% at 50% 0%,rgba(124,58,237,0.15) 0%,transparent 70%)', pointerEvents:'none' }}/>

      <div style={{ width:'100%', maxWidth:520, position:'relative', zIndex:1 }}>
        {/* Başlık */}
        <div style={{ textAlign:'center', marginBottom:'2rem' }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:11, letterSpacing:4, color:'rgba(0,200,255,0.7)', marginBottom:8 }}>LOBİYE KATIL</div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:32, letterSpacing:3, color:'#fff', marginBottom:6 }}>KULÜBÜNÜ OLUŞTUR</div>
          <div style={{ background:'rgba(0,200,255,0.08)', border:'1px solid rgba(0,200,255,0.2)', borderRadius:8, padding:'8px 16px', display:'inline-block' }}>
            <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:13, letterSpacing:3, color:'rgba(0,200,255,0.8)' }}>LOBİ KODU: {code}</span>
          </div>
        </div>

        {/* Form */}
        <div style={{ background:'rgba(12,10,28,0.97)', border:'1px solid rgba(124,58,237,0.25)', borderRadius:16, padding:'2rem', boxShadow:'0 20px 60px rgba(0,0,0,0.6)', display:'flex', flexDirection:'column', gap:'1.25rem' }}>

          {error && (
            <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, padding:'10px 14px', color:'#f87171', fontFamily:"'Rajdhani',sans-serif", fontSize:13 }}>
              ⚠️ {error}
            </div>
          )}

          <div>
            <label style={{ display:'block', fontFamily:"'Bebas Neue',sans-serif", fontSize:11, letterSpacing:3, color:'rgba(255,255,255,0.35)', marginBottom:8 }}>KULÜP ADI</label>
            <div style={{ position:'relative' }}>
              <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', fontSize:16 }}>🛡️</span>
              <input
                placeholder="Örn: FC İstanbul"
                value={clubName}
                onChange={e => setClubName(e.target.value)}
                style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, padding:'12px 12px 12px 40px', color:'#fff', fontSize:'1rem', fontFamily:"'Rajdhani',sans-serif", fontWeight:600, outline:'none', boxSizing:'border-box' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display:'block', fontFamily:"'Bebas Neue',sans-serif", fontSize:11, letterSpacing:3, color:'rgba(255,255,255,0.35)', marginBottom:8 }}>MENAJER ADINIZ</label>
            <div style={{ position:'relative' }}>
              <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', fontSize:16 }}>👤</span>
              <input
                placeholder="Adınız"
                value={managerName}
                onChange={e => setManagerName(e.target.value)}
                style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, padding:'12px 12px 12px 40px', color:'#fff', fontSize:'1rem', fontFamily:"'Rajdhani',sans-serif", fontWeight:600, outline:'none', boxSizing:'border-box' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display:'block', fontFamily:"'Bebas Neue',sans-serif", fontSize:11, letterSpacing:3, color:'rgba(255,255,255,0.35)', marginBottom:10 }}>MENAJER STİLİ</label>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'.65rem' }}>
              {MANAGER_STYLES.map(s => {
                const isSel = managerStyle === s.id
                return (
                  <div key={s.id} onClick={() => setManagerStyle(s.id)}
                    style={{ padding:'.85rem', borderRadius:10, border:`2px solid ${isSel?s.color:'rgba(255,255,255,0.08)'}`, background:isSel?`${s.color}18`:'rgba(255,255,255,0.03)', cursor:'pointer', transition:'all .15s', position:'relative', overflow:'hidden' }}>
                    {isSel && <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:s.color }}/>}
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <div>
                        <div style={{ fontFamily:"'Rajdhani',sans-serif", fontWeight:700, fontSize:14, color:isSel?s.color:'rgba(255,255,255,0.8)', marginBottom:2 }}>{s.name}</div>
                        <div style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:11, color:'rgba(255,255,255,0.3)' }}>{s.desc}</div>
                      </div>
                      <span style={{ fontSize:20, opacity:isSel?1:0.5 }}>{s.emoji}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <button onClick={handleSaveAndJoin} disabled={!canProceed||loading}
            style={{ padding:'1rem', borderRadius:10, border:'none', background:canProceed?'linear-gradient(135deg,#6d28d9,#7c3aed,#8b5cf6)':'rgba(255,255,255,0.06)', color:canProceed?'#fff':'rgba(255,255,255,0.25)', fontFamily:"'Bebas Neue',sans-serif", fontSize:16, letterSpacing:3, cursor:canProceed&&!loading?'pointer':'not-allowed', transition:'all .2s' }}>
            {loading ? 'KATILINIYOR...' : '🔗 LOBİYE KATIL →'}
          </button>

          <button onClick={() => navigate('/menu')}
            style={{ padding:'.75rem', borderRadius:10, border:'1px solid rgba(255,255,255,0.08)', background:'transparent', color:'rgba(255,255,255,0.3)', fontFamily:"'Bebas Neue',sans-serif", fontSize:13, letterSpacing:2, cursor:'pointer' }}>
            ← ANA MENÜ
          </button>
        </div>
      </div>
    </div>
  )
}
