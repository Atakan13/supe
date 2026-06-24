import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getClub, saveClub } from '../lib/club'
import { LogoPreview } from './MenuPage'

const LOGO_SHAPES = ['shield','circle','hexagon','diamond','square']
const LOGO_ICONS  = ['⚽','🦁','🐯','🦅','🐺','🦊','🐻','⭐','🔥','💎','⚔️','🏆','👑','🌙','⚡']
const LOGO_BG_COLORS     = ['#7c3aed','#2563eb','#dc2626','#16a34a','#d97706','#0891b2','#db2777','#4f46e5','#059669','#b45309','#111827','#ffffff','#b91c1c','#1d4ed8','#92400e']
const LOGO_ACCENT_COLORS = ['#fbbf24','#ffffff','#f87171','#86efac','#93c5fd','#c4b5fd','#fdba74','#6ee7b7','#fde68a','#bfdbfe']

const SHAPE_LABELS = { shield:'Modern', circle:'Klasik', hexagon:'Altıgen', diamond:'Elmas', square:'Rozet' }

export default function CreateLogoPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = location.state?.redirectTo || null
  const existing = getClub()

  const [logoShape,  setLogoShape]  = useState(existing?.logo?.shape  || 'shield')
  const [logoIcon,   setLogoIcon]   = useState(existing?.logo?.icon   || '⚽')
  const [logoBg,     setLogoBg]     = useState(existing?.logo?.bg     || '#7c3aed')
  const [logoAccent, setLogoAccent] = useState(existing?.logo?.accent || '#fbbf24')

  const handleNext = () => {
    const updated = { ...existing, logo: { shape:logoShape, icon:logoIcon, bg:logoBg, accent:logoAccent } }
    saveClub(updated)
    navigate('/create/kit', { state: { redirectTo } })
  }

  return (
    <div style={{ position:'fixed', inset:0, backgroundImage:'url(/assets/stadium_bg.jpg)', backgroundSize:'cover', backgroundPosition:'center', display:'grid', gridTemplateColumns:'260px 1fr 260px', overflow:'hidden', fontFamily:"'Rajdhani',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Rajdhani:wght@400;500;600;700&display=swap'); @keyframes shimmer{0%{left:-100%}100%{left:200%}}`}</style>
      <div style={{ position:'absolute', inset:0, background:'rgba(4,4,16,0.82)', zIndex:0 }}/>
      <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse 60% 70% at 50% 100%, rgba(124,58,237,0.18) 0%, transparent 60%)', zIndex:0, pointerEvents:'none' }}/>

      {/* SOL PANEL */}
      <div style={{ position:'relative', zIndex:2, background:'rgba(6,6,20,0.88)', borderRight:'1px solid rgba(255,255,255,0.06)', padding:'1.5rem', display:'flex', flexDirection:'column', gap:'1.5rem', overflowY:'auto', backdropFilter:'blur(12px)' }}>
        <div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:16, letterSpacing:3, color:'rgba(255,255,255,0.7)', marginBottom:4 }}>LOGO EDITÖRÜ</div>
          <div style={{ height:1, background:'linear-gradient(90deg,#7c3aed,transparent)', marginBottom:0 }}/>
        </div>

        <div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:10, letterSpacing:3, color:'rgba(255,255,255,0.3)', marginBottom:10 }}>ARMA ŞEKLİ</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
            {LOGO_SHAPES.map(id => (
              <div key={id} onClick={() => setLogoShape(id)}
                style={{ background:logoShape===id?'rgba(124,58,237,0.35)':'rgba(255,255,255,0.04)', border:`2px solid ${logoShape===id?'#7c3aed':'rgba(255,255,255,0.08)'}`, borderRadius:10, padding:'10px 4px', cursor:'pointer', textAlign:'center', transition:'all .15s' }}>
                <div style={{ display:'flex', justifyContent:'center', marginBottom:4 }}>
                  <svg width={36} height={36} viewBox="0 0 36 36">
                    {id==='shield'  && <path d="M18,2 L32,7 L32,20 Q32,30 18,34 Q4,30 4,20 L4,7 Z" fill={logoShape===id?logoBg:'rgba(255,255,255,0.1)'} stroke={logoShape===id?logoAccent:'rgba(255,255,255,0.2)'} strokeWidth={1.5}/>}
                    {id==='circle'  && <circle cx={18} cy={18} r={14} fill={logoShape===id?logoBg:'rgba(255,255,255,0.1)'} stroke={logoShape===id?logoAccent:'rgba(255,255,255,0.2)'} strokeWidth={1.5}/>}
                    {id==='hexagon' && <path d="M18,2 L32,10 L32,26 L18,34 L4,26 L4,10 Z" fill={logoShape===id?logoBg:'rgba(255,255,255,0.1)'} stroke={logoShape===id?logoAccent:'rgba(255,255,255,0.2)'} strokeWidth={1.5}/>}
                    {id==='diamond' && <path d="M18,2 L34,18 L18,34 L2,18 Z" fill={logoShape===id?logoBg:'rgba(255,255,255,0.1)'} stroke={logoShape===id?logoAccent:'rgba(255,255,255,0.2)'} strokeWidth={1.5}/>}
                    {id==='square'  && <rect x={3} y={3} width={30} height={30} rx={4} fill={logoShape===id?logoBg:'rgba(255,255,255,0.1)'} stroke={logoShape===id?logoAccent:'rgba(255,255,255,0.2)'} strokeWidth={1.5}/>}
                    <text x={18} y={20} textAnchor="middle" dominantBaseline="central" fontSize={12}>{logoShape===id?logoIcon:''}</text>
                  </svg>
                </div>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:9, letterSpacing:1, color:logoShape===id?'#a78bfa':'rgba(255,255,255,0.3)' }}>{SHAPE_LABELS[id]}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:10, letterSpacing:3, color:'rgba(255,255,255,0.3)', marginBottom:10 }}>MERKEZ İKON</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:6 }}>
            {LOGO_ICONS.map(icon => (
              <button key={icon} onClick={() => setLogoIcon(icon)}
                style={{ width:'100%', aspectRatio:'1', borderRadius:8, border:`1.5px solid ${logoIcon===icon?'#7c3aed':'rgba(255,255,255,0.07)'}`, background:logoIcon===icon?'rgba(124,58,237,0.25)':'rgba(255,255,255,0.03)', fontSize:'1.1rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all .15s' }}>
                {icon}
              </button>
            ))}
          </div>
        </div>

        <button onClick={() => navigate('/create/info')}
          style={{ marginTop:'auto', padding:'10px', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'rgba(255,255,255,0.4)', fontFamily:"'Bebas Neue',sans-serif", fontSize:12, letterSpacing:2, cursor:'pointer' }}>
          ← GERİ
        </button>
      </div>

      {/* ORTA */}
      <div style={{ position:'relative', zIndex:2, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'1.5rem' }}>
        <div style={{ position:'absolute', bottom:0, left:'5%', right:'5%', height:'50%', background:'radial-gradient(ellipse at bottom, rgba(124,58,237,0.2) 0%, transparent 70%)', pointerEvents:'none' }}/>
        <div style={{ position:'absolute', top:0, left:'50%', transform:'translateX(-50%)', width:'60%', height:'40%', background:'radial-gradient(ellipse at top, rgba(255,255,255,0.04) 0%, transparent 70%)', pointerEvents:'none' }}/>

        {/* Step bar */}
        <div style={{ display:'flex', alignItems:'center', gap:0 }}>
          {[['1','Bilgiler',false],['2','Logo',true],['3','Forma',false]].map(([num,label,active],i)=>(
            <div key={num} style={{ display:'flex', alignItems:'center' }}>
              <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                <div style={{ width:24, height:24, borderRadius:'50%', background:active?'#7c3aed':i===0?'rgba(124,58,237,0.5)':'rgba(255,255,255,0.08)', border:`2px solid ${active?'#7c3aed':i===0?'#7c3aed':'rgba(255,255,255,0.15)'}`, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Bebas Neue',sans-serif", fontSize:12, color:'#fff' }}>{i===0?'✓':num}</div>
                <span style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:12, fontWeight:600, letterSpacing:1, color:active?'#fff':i===0?'rgba(255,255,255,0.5)':'rgba(255,255,255,0.25)' }}>{label.toUpperCase()}</span>
              </div>
              {i<2 && <div style={{ width:32, height:1, background:i<1?'rgba(124,58,237,0.5)':'rgba(255,255,255,0.1)', margin:'0 8px' }}/>}
            </div>
          ))}
        </div>

        {/* Logo büyük önizleme */}
        <div style={{ position:'relative' }}>
          <div style={{ filter:'drop-shadow(0 0 40px rgba(124,58,237,0.6)) drop-shadow(0 30px 60px rgba(0,0,0,0.9))', transform:'perspective(800px) rotateX(6deg)' }}>
            <LogoPreview shape={logoShape} icon={logoIcon} bgColor={logoBg} accentColor={logoAccent} size={200}/>
          </div>
          <div style={{ position:'absolute', top:8, left:'15%', width:'70%', height:'40%', background:'linear-gradient(180deg,rgba(255,255,255,0.12) 0%,transparent 100%)', pointerEvents:'none', borderRadius:12 }}/>
        </div>

        {/* Platform */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
          <div style={{ width:150, height:8, background:'radial-gradient(ellipse, rgba(124,58,237,0.7) 0%, transparent 70%)', borderRadius:'50%', filter:'blur(5px)' }}/>
          <div style={{ width:180, height:5, background:'rgba(255,255,255,0.06)', borderRadius:3 }}/>
          <div style={{ width:140, height:3, background:'rgba(255,255,255,0.04)', borderRadius:2 }}/>
        </div>

        <div style={{ textAlign:'center' }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:20, letterSpacing:4, color:'rgba(255,255,255,0.8)' }}>{existing?.clubName||'KULÜP ADI'} | EST. 2024</div>
        </div>

        <button onClick={handleNext}
          style={{ padding:'13px 40px', borderRadius:8, border:'none', background:'linear-gradient(135deg,#6d28d9,#7c3aed,#8b5cf6)', color:'#fff', fontFamily:"'Bebas Neue',sans-serif", fontSize:16, letterSpacing:3, cursor:'pointer', boxShadow:'0 8px 25px rgba(124,58,237,0.5)', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:0, left:'-100%', width:'60%', height:'100%', background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.15),transparent)', animation:'shimmer 2s ease-in-out infinite' }}/>
          ARMAYI KAYDET →
        </button>
      </div>

      {/* SAĞ PANEL */}
      <div style={{ position:'relative', zIndex:2, background:'rgba(6,6,20,0.88)', borderLeft:'1px solid rgba(255,255,255,0.06)', padding:'1.5rem', display:'flex', flexDirection:'column', gap:'1.5rem', overflowY:'auto', backdropFilter:'blur(12px)' }}>
        <div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:16, letterSpacing:3, color:'rgba(255,255,255,0.7)', marginBottom:4 }}>ELEMENTS & COLOR</div>
          <div style={{ height:1, background:'linear-gradient(90deg,#7c3aed,transparent)', marginBottom:0 }}/>
        </div>

        <div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:10, letterSpacing:3, color:'rgba(255,255,255,0.3)', marginBottom:10 }}>BİRİNCİL RENKLER</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:6 }}>
            {LOGO_BG_COLORS.map(c => (
              <button key={c} onClick={() => setLogoBg(c)}
                style={{ width:'100%', aspectRatio:'1', borderRadius:7, background:c, border:`2px solid ${logoBg===c?'#fff':'rgba(255,255,255,0.08)'}`, cursor:'pointer', boxShadow:logoBg===c?`0 0 10px ${c}`:'none', transition:'all .15s' }}/>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:10, letterSpacing:3, color:'rgba(255,255,255,0.3)', marginBottom:10 }}>AKSAN / VURGU</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:6 }}>
            {LOGO_ACCENT_COLORS.map(c => (
              <button key={c} onClick={() => setLogoAccent(c)}
                style={{ width:'100%', aspectRatio:'1', borderRadius:7, background:c, border:`2px solid ${logoAccent===c?'#fff':'rgba(255,255,255,0.08)'}`, cursor:'pointer', boxShadow:logoAccent===c?`0 0 10px ${c}`:'none', transition:'all .15s' }}/>
            ))}
          </div>
        </div>

        {/* Renk önizleme */}
        <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'12px' }}>
          <div style={{ height:36, borderRadius:8, background:`linear-gradient(135deg,${logoBg},${logoAccent})`, boxShadow:`0 4px 15px ${logoBg}44`, marginBottom:8 }}/>
          <div style={{ display:'flex', gap:6 }}>
            <div style={{ flex:1, height:20, borderRadius:5, background:logoBg }}/>
            <div style={{ flex:1, height:20, borderRadius:5, background:logoAccent }}/>
          </div>
        </div>

        <div style={{ marginTop:'auto', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'12px' }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:9, letterSpacing:2, color:'rgba(255,255,255,0.25)', marginBottom:6 }}>ÖNİZLEME</div>
          <LogoPreview shape={logoShape} icon={logoIcon} bgColor={logoBg} accentColor={logoAccent} size={60}/>
        </div>
      </div>
    </div>
  )
}
