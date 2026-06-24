import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getClub, saveClub } from '../lib/club'

const MANAGER_STYLES = [
  { id:'aggressive', name:'Agresif',   emoji:'⚡', desc:'Atak statlarına +5 bonus',   color:'#ef4444' },
  { id:'defensive',  name:'Defansif',  emoji:'🛡️', desc:'Defans statlarına +5 bonus',  color:'#3b82f6' },
  { id:'possession', name:'Tiki-Taka', emoji:'🎯', desc:'Pas statlarına +5 bonus',     color:'#10b981' },
  { id:'counter',    name:'Kontra',    emoji:'💨', desc:'Hız statlarına +5 bonus',     color:'#f59e0b' },
  { id:'physical',   name:'Fiziksel',  emoji:'💪', desc:'Fizik statlarına +5 bonus',   color:'#8b5cf6' },
  { id:'technical',  name:'Teknik',    emoji:'🎨', desc:'Çalım statlarına +5 bonus',   color:'#ec4899' },
]

export default function CreateInfoPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const existing = getClub()
  const redirectTo = location.state?.redirectTo || null

  const [clubName,     setClubName]     = useState(existing?.clubName     || '')
  const [managerName,  setManagerName]  = useState(existing?.managerName  || '')
  const [managerStyle, setManagerStyle] = useState(existing?.managerStyle || null)

  const canProceed = clubName.trim() && managerName.trim() && managerStyle

  const handleNext = () => {
    // Geçici kaydet
    const partial = { ...existing, clubName, managerName, managerStyle }
    saveClub(partial)
    navigate('/create/logo', { state: { redirectTo } })
  }

  return (
    <div style={{ minHeight:'100vh', background:'#080c18', backgroundImage:'linear-gradient(rgba(0,200,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(0,200,255,0.02) 1px,transparent 1px)', backgroundSize:'40px 40px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'2rem', position:'relative' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Rajdhani:wght@400;500;600;700&display=swap');`}</style>
      <div style={{ position:'fixed', inset:0, background:'radial-gradient(ellipse 60% 50% at 50% 0%,rgba(124,58,237,0.12) 0%,transparent 70%)', pointerEvents:'none' }}/>

      <div style={{ width:'100%', maxWidth:560, position:'relative', zIndex:1 }}>

        {/* Başlık */}
        <div style={{ textAlign:'center', marginBottom:'2.5rem' }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:11, letterSpacing:4, color:'rgba(124,58,237,0.8)', marginBottom:8 }}>
            {existing ? 'KULÜP DÜZENLE' : 'HOŞ GELDİN'}
          </div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:36, letterSpacing:3, color:'#fff' }}>
            {existing ? 'BİLGİLERİ GÜNCELLE' : 'KULÜBÜNÜ OLUŞTUR'}
          </div>
          {/* Step bar */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:0, marginTop:20 }}>
            {[['1','Bilgiler',true],['2','Logo',false],['3','Forma',false]].map(([num,label,active],i)=>(
              <div key={num} style={{ display:'flex', alignItems:'center' }}>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <div style={{ width:28, height:28, borderRadius:'50%', background:active?'#7c3aed':'rgba(255,255,255,0.08)', border:`2px solid ${active?'#7c3aed':'rgba(255,255,255,0.15)'}`, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Bebas Neue',sans-serif", fontSize:13, color:'#fff' }}>{num}</div>
                  <span style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:13, fontWeight:600, letterSpacing:1, color:active?'#fff':'rgba(255,255,255,0.3)' }}>{label.toUpperCase()}</span>
                </div>
                {i<2 && <div style={{ width:40, height:1, background:'rgba(255,255,255,0.1)', margin:'0 8px' }}/>}
              </div>
            ))}
          </div>
        </div>

        {/* Form */}
        <div style={{ background:'rgba(15,12,30,0.95)', border:'1px solid rgba(124,58,237,0.25)', borderRadius:16, padding:'2rem', boxShadow:'0 20px 60px rgba(0,0,0,0.5)', display:'flex', flexDirection:'column', gap:'1.5rem' }}>

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
            <label style={{ display:'block', fontFamily:"'Bebas Neue',sans-serif", fontSize:11, letterSpacing:3, color:'rgba(255,255,255,0.35)', marginBottom:12 }}>MENAJER STİLİ</label>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'.75rem' }}>
              {MANAGER_STYLES.map(s => {
                const isSel = managerStyle === s.id
                return (
                  <div key={s.id} onClick={() => setManagerStyle(s.id)}
                    style={{ padding:'1rem', borderRadius:12, border:`2px solid ${isSel?s.color:'rgba(255,255,255,0.08)'}`, background:isSel?`${s.color}18`:'rgba(255,255,255,0.03)', cursor:'pointer', transition:'all .15s', position:'relative', overflow:'hidden' }}>
                    {isSel && <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:s.color }}/>}
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <div>
                        <div style={{ fontFamily:"'Rajdhani',sans-serif", fontWeight:700, fontSize:15, color:isSel?s.color:'rgba(255,255,255,0.8)', marginBottom:3 }}>{s.name}</div>
                        <div style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:11, color:'rgba(255,255,255,0.35)' }}>{s.desc}</div>
                      </div>
                      <span style={{ fontSize:22, opacity:isSel?1:0.5 }}>{s.emoji}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <button onClick={handleNext} disabled={!canProceed}
            style={{ padding:'1rem', borderRadius:10, border:'none', background:canProceed?'linear-gradient(135deg,#6d28d9,#7c3aed)':'rgba(255,255,255,0.06)', color:canProceed?'#fff':'rgba(255,255,255,0.25)', fontFamily:"'Bebas Neue',sans-serif", fontSize:16, letterSpacing:3, cursor:canProceed?'pointer':'not-allowed', transition:'all .2s' }}>
            SONRAKI: LOGO →
          </button>

          {existing && (
            <button onClick={() => navigate('/menu')}
              style={{ padding:'.75rem', borderRadius:10, border:'1px solid rgba(255,255,255,0.08)', background:'transparent', color:'rgba(255,255,255,0.3)', fontFamily:"'Bebas Neue',sans-serif", fontSize:13, letterSpacing:2, cursor:'pointer' }}>
              ← ANA MENÜYE DÖN
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
