import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getClub, saveClub } from '../lib/club'
import { KitPreview } from './MenuPage'

const KIT_COLORS = ['#8a2be2','#4169e1','#dc143c','#ffa500','#20b2aa','#ff69b4','#ffffff','#ff4500','#1e90ff','#9370db','#ff1493','#00fa9a','#7c3aed','#1f2937','#10b981','#f59e0b']
const KIT_PATTERNS = [
  { id:'solid',    name:'Düz',         emoji:'—' },
  { id:'stripes',  name:'Çizgili',     emoji:'|' },
  { id:'hoops',    name:'Yatay Şerit', emoji:'≡' },
  { id:'halves',   name:'İki Renk',    emoji:'◨' },
  { id:'quarters', name:'Çeyrek',      emoji:'◩' },
  { id:'diagonal', name:'Çapraz',      emoji:'▨' },
  { id:'sash',     name:'Omuz Bandı',  emoji:'/' },
  { id:'panel',    name:'Panel',       emoji:'▭' },
]

export default function CreateKitPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = location.state?.redirectTo || null
  const existing = getClub()

  const [activeTab, setActiveTab] = useState('home')
  const [kitPrimary,   setKitPrimary]   = useState(existing?.kit?.primary   || '#ffa500')
  const [kitSecondary, setKitSecondary] = useState(existing?.kit?.secondary || '#1f2937')
  const [kitPattern,   setKitPattern]   = useState(existing?.kit?.pattern   || 'solid')
  const [awayPrimary,   setAwayPrimary]   = useState(existing?.kitAway?.primary   || '#1f2937')
  const [awaySecondary, setAwaySecondary] = useState(existing?.kitAway?.secondary || '#ffffff')
  const [awayPattern,   setAwayPattern]   = useState(existing?.kitAway?.pattern   || 'solid')

  const primary   = activeTab === 'home' ? kitPrimary   : awayPrimary
  const secondary = activeTab === 'home' ? kitSecondary : awaySecondary
  const pattern   = activeTab === 'home' ? kitPattern   : awayPattern
  const setPrimary   = activeTab === 'home' ? setKitPrimary   : setAwayPrimary
  const setSecondary = activeTab === 'home' ? setKitSecondary : setAwaySecondary
  const setPattern   = activeTab === 'home' ? setKitPattern   : setAwayPattern

  const handleSave = () => {
    const updated = {
      ...existing,
      kit:     { primary:kitPrimary,  secondary:kitSecondary, pattern:kitPattern },
      kitAway: { primary:awayPrimary, secondary:awaySecondary, pattern:awayPattern },
    }
    saveClub(updated)
    if (redirectTo) navigate(redirectTo)
    else navigate('/menu')
  }

  return (
    <div style={{ minHeight:'100vh', backgroundImage:'url(/assets/locker_room.jpg)', backgroundSize:'cover', backgroundPosition:'center', display:'flex', flexDirection:'column', alignItems:'center', padding:'2rem', position:'relative' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Rajdhani:wght@400;500;600;700&display=swap');
        @keyframes shimmer{0%{left:-100%}100%{left:200%}}
      `}</style>
      <div style={{ position:'fixed', inset:0, background:'rgba(4,4,16,0.80)', pointerEvents:'none' }}/>
      <div style={{ position:'fixed', inset:0, background:'radial-gradient(ellipse 60% 50% at 50% 0%,rgba(124,58,237,0.12) 0%,transparent 70%)', pointerEvents:'none' }}/>

      <div style={{ position:'relative', zIndex:1, width:'100%', maxWidth:1200 }}>

        {/* Başlık */}
        <div style={{ textAlign:'center', marginBottom:'1.5rem' }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:11, letterSpacing:4, color:'rgba(124,58,237,0.8)', marginBottom:6 }}>KULÜP OLUŞTUR</div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:32, letterSpacing:3, color:'#fff', marginBottom:14 }}>FORMA & LOBİ AYARLARI</div>
          {/* Step bar */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:0 }}>
            {[['1','Bilgiler',false],['2','Logo',false],['3','Forma',true]].map(([num,label,active],i)=>(
              <div key={num} style={{ display:'flex', alignItems:'center' }}>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <div style={{ width:24, height:24, borderRadius:'50%', background:active?'#7c3aed':'rgba(124,58,237,0.5)', border:`2px solid ${active?'#7c3aed':'rgba(124,58,237,0.5)'}`, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Bebas Neue',sans-serif", fontSize:12, color:'#fff' }}>{i<2?'✓':num}</div>
                  <span style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:12, fontWeight:600, letterSpacing:1, color:active?'#fff':'rgba(255,255,255,0.4)' }}>{label.toUpperCase()}</span>
                </div>
                {i<2 && <div style={{ width:32, height:1, background:'rgba(124,58,237,0.5)', margin:'0 8px' }}/>}
              </div>
            ))}
          </div>
        </div>

        {/* Ana grid */}
        <div style={{ display:'flex', gap:'1.25rem' }}>

          {/* SOL: Düzenleme paneli */}
          <div style={{ flex:1.2, background:'rgba(20,20,25,0.7)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:'1.25rem', backdropFilter:'blur(15px)', boxShadow:'0 10px 30px rgba(0,0,0,0.5)' }}>

            {/* Tab */}
            <div style={{ display:'flex', background:'rgba(0,0,0,0.4)', borderRadius:8, marginBottom:16, overflow:'hidden' }}>
              {['home','away'].map(t=>(
                <div key={t} onClick={()=>setActiveTab(t)}
                  style={{ flex:1, textAlign:'center', padding:'10px', cursor:'pointer', fontFamily:"'Bebas Neue',sans-serif", fontSize:13, letterSpacing:2, background:activeTab===t?'#fff':'transparent', color:activeTab===t?'#000':'#888', transition:'all .2s' }}>
                  {t==='home'?'EV SAHİBİ FORMASI':'DEPLASMAN FORMASI'}
                </div>
              ))}
            </div>

            <div style={{ display:'flex', gap:'1.25rem' }}>
              {/* Forma Önizleme */}
              <div style={{ flex:1, background:'rgba(0,0,0,0.2)', borderRadius:8, minHeight:280, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <KitPreview primary={primary} secondary={secondary} pattern={pattern} size={160}/>
              </div>

              {/* Seçenekler */}
              <div style={{ flex:1.2, display:'flex', flexDirection:'column', gap:14 }}>

                {/* Ana Renk */}
                <div>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:10, letterSpacing:2, color:'rgba(255,255,255,0.35)', marginBottom:8 }}>ANA RENK</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:6 }}>
                    {KIT_COLORS.map(c=>(
                      <div key={c} onClick={()=>setPrimary(c)}
                        style={{ width:'100%', aspectRatio:'1', borderRadius:4, background:c, border:`2px solid ${primary===c?'#fff':'transparent'}`, cursor:'pointer', boxShadow:primary===c?`0 0 8px ${c}`:'none', transition:'all .15s' }}/>
                    ))}
                  </div>
                </div>

                {/* İkincil Renk */}
                <div>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:10, letterSpacing:2, color:'rgba(255,255,255,0.35)', marginBottom:8 }}>İKİNCİL RENK</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:6 }}>
                    {KIT_COLORS.map(c=>(
                      <div key={c} onClick={()=>setSecondary(c)}
                        style={{ width:'100%', aspectRatio:'1', borderRadius:4, background:c, border:`2px solid ${secondary===c?'#fff':'transparent'}`, cursor:'pointer', boxShadow:secondary===c?`0 0 8px ${c}`:'none', transition:'all .15s' }}/>
                    ))}
                  </div>
                </div>

                {/* Desen */}
                <div>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:10, letterSpacing:2, color:'rgba(255,255,255,0.35)', marginBottom:8 }}>DESEN</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                    {KIT_PATTERNS.map(p=>(
                      <div key={p.id} onClick={()=>setPattern(p.id)}
                        style={{ background:pattern===p.id?'rgba(138,43,226,0.3)':'rgba(0,0,0,0.4)', border:`1px solid ${pattern===p.id?'#8a2be2':'rgba(255,255,255,0.08)'}`, color:pattern===p.id?'#fff':'#888', padding:'8px 10px', borderRadius:6, cursor:'pointer', display:'flex', alignItems:'center', gap:8, fontFamily:"'Rajdhani',sans-serif", fontSize:13, fontWeight:600, transition:'all .15s' }}>
                        <span style={{ fontSize:12, opacity:0.8 }}>{p.emoji}</span>
                        {p.name}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SAĞ: Önizleme paneli */}
          <div style={{ flex:1, background:'rgba(20,20,25,0.7)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:'1.25rem', backdropFilter:'blur(15px)', boxShadow:'0 10px 30px rgba(0,0,0,0.5)', display:'flex', flexDirection:'column' }}>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:11, letterSpacing:3, color:'rgba(255,255,255,0.3)', marginBottom:14 }}>FORMA ÖNİZLEME</div>

            {/* İç + Deplasman */}
            <div style={{ display:'flex', gap:12, flex:1, marginBottom:16 }}>
              <div style={{ flex:1, background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.05)', borderRadius:8, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'space-between', padding:'16px 8px' }}>
                <KitPreview primary={kitPrimary} secondary={kitSecondary} pattern={kitPattern} size={110}/>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:10, letterSpacing:2, color:'rgba(255,255,255,0.3)', marginTop:10 }}>İÇ SAHA</div>
              </div>
              <div style={{ flex:1, background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.05)', borderRadius:8, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'space-between', padding:'16px 8px' }}>
                <KitPreview primary={awayPrimary} secondary={awaySecondary} pattern={awayPattern} size={110}/>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:10, letterSpacing:2, color:'rgba(255,255,255,0.3)', marginTop:10 }}>DEPLASMAN</div>
              </div>
            </div>

            {/* Renk bar */}
            <div style={{ display:'flex', gap:6, marginBottom:16 }}>
              <div style={{ flex:1, height:6, borderRadius:3, background:kitPrimary }}/>
              <div style={{ flex:1, height:6, borderRadius:3, background:kitSecondary }}/>
            </div>

            <button onClick={handleSave}
              style={{ width:'100%', background:'linear-gradient(90deg,#8a2be2,#b82bf2)', border:'none', color:'#fff', padding:'14px', fontSize:16, fontWeight:700, fontFamily:"'Bebas Neue',sans-serif", letterSpacing:3, borderRadius:8, cursor:'pointer', boxShadow:'0 0 15px rgba(138,43,226,0.4)', marginBottom:10, position:'relative', overflow:'hidden', transition:'all .2s' }}>
              <div style={{ position:'absolute', top:0, left:'-100%', width:'60%', height:'100%', background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.15),transparent)', animation:'shimmer 2s ease-in-out infinite' }}/>
              💾 KULÜBÜ KAYDET →
            </button>

            <button onClick={() => navigate('/create/logo')}
              style={{ width:'100%', background:'transparent', border:'1px solid rgba(255,255,255,0.1)', color:'#888', padding:'12px', fontSize:13, fontFamily:"'Bebas Neue',sans-serif", letterSpacing:2, borderRadius:8, cursor:'pointer', transition:'all .2s' }}>
              ← GERİ: LOGO
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
