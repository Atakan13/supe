import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LogoPreview } from '../components/LogoPreview'

function getUserId() {
  let id = localStorage.getItem('draft_user_id')
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('draft_user_id', id) }
  return id
}

export default function PreMatchPage() {
  const { matchId } = useParams()
  const navigate = useNavigate()
  const userId = getUserId()

  const [match, setMatch] = useState(null)
  const [homePlr, setHomePlr] = useState(null)
  const [awayPlr, setAwayPlr] = useState(null)
  const [homeSquad, setHomeSquad] = useState(null)
  const [awaySquad, setAwaySquad] = useState(null)
  const [phase, setPhase] = useState('intro') // intro -> reveal -> countdown -> go
  const [countdown, setCountdown] = useState(3)

  useEffect(() => {
    init()
  }, [matchId])

  useEffect(() => {
    // Animasyon sekansı
    const t1 = setTimeout(() => setPhase('reveal'), 1200)
    const t2 = setTimeout(() => setPhase('countdown'), 3000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  useEffect(() => {
    if (phase !== 'countdown') return
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          setPhase('go')
          setTimeout(() => navigate(`/match/${matchId}`, { replace: true }), 800)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [phase])

  const init = async () => {
    const { data: m } = await supabase.from('matches').select('*').eq('id', matchId).maybeSingle()
    if (!m) return
    setMatch(m)

    const { data: players } = await supabase.from('lobby_players').select('*').eq('lobby_id', m.lobby_id)
    const home = players?.find(p => p.user_id === m.home_user_id)
    const away = players?.find(p => p.user_id === m.away_user_id)
    setHomePlr(home)
    setAwayPlr(away)

    const { data: squads } = await supabase.from('squads').select('*').eq('lobby_id', m.lobby_id)
    setHomeSquad(squads?.find(s => s.user_id === m.home_user_id))
    setAwaySquad(squads?.find(s => s.user_id === m.away_user_id))
  }

  const isHome = match?.home_user_id === userId

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#02020a',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Rajdhani:wght@400;600;700&display=swap');

        @keyframes fadeIn { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideLeft { from{opacity:0;transform:translateX(-80px)} to{opacity:1;transform:translateX(0)} }
        @keyframes slideRight { from{opacity:0;transform:translateX(80px)} to{opacity:1;transform:translateX(0)} }
        @keyframes vsFlash { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.7;transform:scale(1.1)} }
        @keyframes countFlash { from{opacity:0;transform:scale(2)} to{opacity:1;transform:scale(1)} }
        @keyframes goAnim { from{opacity:0;transform:scale(0.5)} to{opacity:1;transform:scale(1.2)} }
        @keyframes scanline { from{top:-100%} to{top:100%} }
        @keyframes flicker { 0%,100%{opacity:1} 92%{opacity:1} 93%{opacity:0.8} 94%{opacity:1} }
      `}</style>

      {/* Arka plan efektleri */}
      <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(124,58,237,0.08) 0%, transparent 70%)', pointerEvents:'none' }}/>
      <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(rgba(0,200,255,0.015) 1px,transparent 1px),linear-gradient(90deg,rgba(0,200,255,0.015) 1px,transparent 1px)', backgroundSize:'60px 60px', pointerEvents:'none' }}/>
      
      {/* Scanline efekti */}
      <div style={{ position:'absolute', left:0, right:0, height:'2px', background:'rgba(0,200,255,0.08)', animation:'scanline 3s linear infinite', pointerEvents:'none', zIndex:0 }}/>

      {/* Sol ışık */}
      <div style={{ position:'absolute', left:'-10%', top:'50%', transform:'translateY(-50%)', width:'40%', height:'80%', background:'radial-gradient(ellipse, rgba(239,68,68,0.08) 0%, transparent 70%)', pointerEvents:'none' }}/>
      {/* Sağ ışık */}
      <div style={{ position:'absolute', right:'-10%', top:'50%', transform:'translateY(-50%)', width:'40%', height:'80%', background:'radial-gradient(ellipse, rgba(0,100,255,0.08) 0%, transparent 70%)', pointerEvents:'none' }}/>

      {/* Ana içerik */}
      <div style={{ position:'relative', zIndex:2, width:'100%', maxWidth:900, padding:'0 2rem' }}>

        {/* Üst: Lig / Maç bilgisi */}
        <div style={{ textAlign:'center', marginBottom:'3rem', animation:phase!=='intro'?'fadeIn 0.6s ease':'', opacity:phase==='intro'?0:1, transition:'opacity 0.6s' }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:11, letterSpacing:5, color:'rgba(0,200,255,0.5)', marginBottom:6 }}>DRAFT FC · SÜPER LİG</div>
          <div style={{ height:1, background:'linear-gradient(90deg,transparent,rgba(0,200,255,0.3),transparent)', marginBottom:6 }}/>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:11, letterSpacing:5, color:'rgba(255,255,255,0.15)' }}>MAÇ BAŞLIYOR</div>
        </div>

        {/* Takımlar */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', alignItems:'center', gap:'2rem' }}>

          {/* EV SAHİBİ */}
          <div style={{
            textAlign:'right',
            animation: phase==='reveal'||phase==='countdown'||phase==='go' ? 'slideLeft 0.7s ease' : '',
            opacity: phase==='intro' ? 0 : 1,
            transition:'opacity 0.7s',
          }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:12 }}>
              {/* Logo */}
              <div style={{ position:'relative' }}>
                <div style={{ position:'absolute', inset:-12, borderRadius:'50%', background:'radial-gradient(circle,rgba(239,68,68,0.15) 0%,transparent 70%)', filter:'blur(8px)' }}/>
                <LogoPreview
                  shape={homePlr?.logo?.shape||'shield'}
                  icon={homePlr?.logo?.icon||'⚽'}
                  bgColor={homePlr?.logo?.bg||'#dc2626'}
                  accentColor={homePlr?.logo?.accent||'#fbbf24'}
                  size={110}
                />
              </div>
              <div>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:28, letterSpacing:3, color:'#fff', lineHeight:1 }}>{homePlr?.team_name||'EV SAHİBİ'}</div>
                <div style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:13, color:'rgba(255,255,255,0.3)', letterSpacing:2, marginTop:4 }}>{homeSquad?.formation||'?'} · {homePlr?.manager_name||''}</div>
                {match?.home_user_id === userId && (
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:9, letterSpacing:3, color:'rgba(0,200,255,0.6)', marginTop:4 }}>SEN</div>
                )}
              </div>
            </div>
          </div>

          {/* VS / COUNTDOWN / GO */}
          <div style={{ textAlign:'center', minWidth:120 }}>
            {phase === 'countdown' && (
              <div key={countdown} style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:96, color:'#fff', lineHeight:1, animation:'countFlash 0.5s ease', textShadow:'0 0 40px rgba(0,200,255,0.5)' }}>
                {countdown}
              </div>
            )}
            {phase === 'go' && (
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:64, color:'#00c8ff', lineHeight:1, animation:'goAnim 0.5s ease', textShadow:'0 0 40px rgba(0,200,255,0.8)' }}>
                BAŞLA!
              </div>
            )}
            {(phase === 'reveal' || phase === 'intro') && (
              <div style={{ animation:'vsFlash 1.5s ease-in-out infinite' }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:72, letterSpacing:4, background:'linear-gradient(135deg,#ff4444,#fff,#0066ff)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', lineHeight:1 }}>VS</div>
                <div style={{ display:'flex', gap:4, justifyContent:'center', marginTop:8 }}>
                  {[0,1,2].map(i=><div key={i} style={{ width:6, height:6, borderRadius:'50%', background:i===1?'#fff':'rgba(255,255,255,0.3)' }}/>)}
                </div>
              </div>
            )}
          </div>

          {/* DEPLASMAN */}
          <div style={{
            textAlign:'left',
            animation: phase==='reveal'||phase==='countdown'||phase==='go' ? 'slideRight 0.7s ease' : '',
            opacity: phase==='intro' ? 0 : 1,
            transition:'opacity 0.7s',
          }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:12 }}>
              <div style={{ position:'relative' }}>
                <div style={{ position:'absolute', inset:-12, borderRadius:'50%', background:'radial-gradient(circle,rgba(0,100,255,0.15) 0%,transparent 70%)', filter:'blur(8px)' }}/>
                <LogoPreview
                  shape={awayPlr?.logo?.shape||'shield'}
                  icon={awayPlr?.logo?.icon||'⚽'}
                  bgColor={awayPlr?.logo?.bg||'#2563eb'}
                  accentColor={awayPlr?.logo?.accent||'#fbbf24'}
                  size={110}
                />
              </div>
              <div>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:28, letterSpacing:3, color:'#fff', lineHeight:1 }}>{awayPlr?.team_name||'DEPLASMAN'}</div>
                <div style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:13, color:'rgba(255,255,255,0.3)', letterSpacing:2, marginTop:4 }}>{awaySquad?.formation||'?'} · {awayPlr?.manager_name||''}</div>
                {match?.away_user_id === userId && (
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:9, letterSpacing:3, color:'rgba(0,200,255,0.6)', marginTop:4 }}>SEN</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Alt: Countdown bar */}
        {phase === 'countdown' && (
          <div style={{ marginTop:'3rem', textAlign:'center', animation:'fadeIn 0.5s ease' }}>
            <div style={{ height:2, background:'rgba(255,255,255,0.06)', borderRadius:1, overflow:'hidden', maxWidth:300, margin:'0 auto' }}>
              <div style={{ height:'100%', background:'linear-gradient(90deg,#00c8ff,#7b2fff)', borderRadius:1, width:`${((3-countdown)/3)*100}%`, transition:'width 1s linear' }}/>
            </div>
            <div style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:12, letterSpacing:3, color:'rgba(255,255,255,0.25)', marginTop:12 }}>HAZIR OL</div>
          </div>
        )}

        {/* Atla butonu */}
        {phase !== 'go' && (
          <div style={{ textAlign:'center', marginTop:'2rem' }}>
            <button onClick={() => navigate(`/match/${matchId}`, { replace:true })}
              style={{ background:'transparent', border:'none', color:'rgba(255,255,255,0.2)', fontFamily:"'Rajdhani',sans-serif", fontSize:12, letterSpacing:2, cursor:'pointer' }}>
              ATLA →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
