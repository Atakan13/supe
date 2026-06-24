import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getClub, saveClub } from '../lib/club'
import { KitPreview } from './MenuPage'

const KIT_COLORS = ['#7c3aed','#2563eb','#dc2626','#16a34a','#d97706','#0891b2','#db2777','#1f2937','#ffffff','#f59e0b','#10b981','#ef4444','#0ea5e9','#8b5cf6','#ec4899','#14b8a6']
const KIT_PATTERNS = [
  { id:'solid',    name:'Düz',         emoji:'▬' },
  { id:'stripes',  name:'Çubuklu',     emoji:'⫴' },
  { id:'hoops',    name:'Yatay Şerit', emoji:'☰' },
  { id:'halves',   name:'İki Renk',    emoji:'◨' },
  { id:'quarters', name:'Çeyrek',      emoji:'◩' },
  { id:'diagonal', name:'Çapraz',      emoji:'◪' },
  { id:'sash',     name:'Omuz Bandı',  emoji:'⟋' },
  { id:'panel',    name:'Panel',       emoji:'▤' },
]

const BUDGETS = [
  { label:'€100M',    value:100000000 },
  { label:'€300M',    value:300000000 },
  { label:'€600M',    value:600000000 },
  { label:'Sınırsız', value:999999999999 },
]
const FORMATIONS = ['4-4-2','4-3-3','3-5-2','4-2-3-1','5-3-2','3-4-3']

export default function CreateKitPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = location.state?.redirectTo || null
  const existing = getClub()

  const [kitPrimary,   setKitPrimary]   = useState(existing?.kit?.primary   || '#dc2626')
  const [kitSecondary, setKitSecondary] = useState(existing?.kit?.secondary || '#ffffff')
  const [kitPattern,   setKitPattern]   = useState(existing?.kit?.pattern   || 'solid')
  const [budget,       setBudget]       = useState(existing?.budget          || 999999999999)
  const [formation,    setFormation]    = useState(existing?.formation       || '4-3-3')

  const handleSave = () => {
    const updated = {
      ...existing,
      kit: { primary:kitPrimary, secondary:kitSecondary, pattern:kitPattern },
      budget, formation,
    }
    saveClub(updated)
    if (redirectTo) navigate(redirectTo)
    else navigate('/menu')
  }

  return (
    <div style={{ minHeight:'100vh', background:'#080c18', backgroundImage:'linear-gradient(rgba(0,200,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(0,200,255,0.02) 1px,transparent 1px)', backgroundSize:'40px 40px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'2rem', position:'relative' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Rajdhani:wght@400;500;600;700&display=swap'); @keyframes shimmer{0%{left:-100%}100%{left:200%}}`}</style>
      <div style={{ position:'fixed', inset:0, background:'radial-gradient(ellipse 60% 50% at 50% 0%,rgba(124,58,237,0.12) 0%,transparent 70%)', pointerEvents:'none' }}/>

      <div style={{ width:'100%', maxWidth:700, position:'relative', zIndex:1 }}>

        {/* Başlık + Step bar */}
        <div style={{ textAlign:'center', marginBottom:'2rem' }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:11, letterSpacing:4, color:'rgba(124,58,237,0.8)', marginBottom:8 }}>KULÜP OLUŞTUR</div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:32, letterSpacing:3, color:'#fff', marginBottom:16 }}>FORMA & LOBİ AYARLARI</div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:0 }}>
            {[['1','Bilgiler',false],['2','Logo',false],['3','Forma',true]].map(([num,label,active],i)=>(
              <div key={num} style={{ display:'flex', alignItems:'center' }}>
                <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <div style={{ width:24, height:24, borderRadius:'50%', background:active?'#7c3aed':'rgba(124,58,237,0.5)', border:`2px solid ${active?'#7c3aed':'rgba(124,58,237,0.5)'}`, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Bebas Neue',sans-serif", fontSize:12, color:'#fff' }}>{i<2?'✓':num}</div>
                  <span style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:12, fontWeight:600, letterSpacing:1, color:active?'#fff':'rgba(255,255,255,0.4)' }}>{label.toUpperCase()}</span>
                </div>
                {i<2 && <div style={{ width:32, height:1, background:'rgba(124,58,237,0.5)', margin:'0 8px' }}/>}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem' }}>

          {/* SOL: Forma tasarımı */}
          <div style={{ background:'rgba(15,12,30,0.95)', border:'1px solid rgba(124,58,237,0.25)', borderRadius:16, padding:'1.5rem', display:'flex', flexDirection:'column', gap:'1.25rem' }}>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:14, letterSpacing:2, color:'rgba(255,255,255,0.6)' }}>FORMA TASARIMI</div>

            {/* Forma önizleme */}
            <div style={{ display:'flex', justifyContent:'center', padding:'1rem 0' }}>
              <div style={{ position:'relative', display:'flex', flexDirection:'column', alignItems:'center' }}>
                <KitPreview primary={kitPrimary} secondary={kitSecondary} pattern={kitPattern} size={120}/>
                <div style={{ width:80, height:5, background:'rgba(255,255,255,0.06)', borderRadius:3, marginTop:6 }}/>
              </div>
            </div>

            <div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:10, letterSpacing:3, color:'rgba(255,255,255,0.3)', marginBottom:8 }}>ANA RENK</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(8,1fr)', gap:5 }}>
                {KIT_COLORS.map(c => (
                  <button key={c} onClick={() => setKitPrimary(c)}
                    style={{ width:'100%', aspectRatio:'1', borderRadius:5, background:c, border:`2px solid ${kitPrimary===c?'#fff':'rgba(255,255,255,0.08)'}`, cursor:'pointer', boxShadow:kitPrimary===c?`0 0 8px ${c}`:'none', transition:'all .15s' }}/>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:10, letterSpacing:3, color:'rgba(255,255,255,0.3)', marginBottom:8 }}>İKİNCİL RENK</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(8,1fr)', gap:5 }}>
                {KIT_COLORS.map(c => (
                  <button key={c} onClick={() => setKitSecondary(c)}
                    style={{ width:'100%', aspectRatio:'1', borderRadius:5, background:c, border:`2px solid ${kitSecondary===c?'#fff':'rgba(255,255,255,0.08)'}`, cursor:'pointer', boxShadow:kitSecondary===c?`0 0 8px ${c}`:'none', transition:'all .15s' }}/>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:10, letterSpacing:3, color:'rgba(255,255,255,0.3)', marginBottom:8 }}>DESEN</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                {KIT_PATTERNS.map(p => (
                  <div key={p.id} onClick={() => setKitPattern(p.id)}
                    style={{ padding:'8px 10px', borderRadius:8, border:`1.5px solid ${kitPattern===p.id?'#7c3aed':'rgba(255,255,255,0.07)'}`, background:kitPattern===p.id?'rgba(124,58,237,0.2)':'rgba(255,255,255,0.03)', cursor:'pointer', display:'flex', alignItems:'center', gap:8, transition:'all .15s' }}>
                    <span style={{ fontSize:14, opacity:0.8 }}>{p.emoji}</span>
                    <span style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:12, fontWeight:600, color:kitPattern===p.id?'#a78bfa':'rgba(255,255,255,0.5)' }}>{p.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* SAĞ: Lobi ayarları + Kaydet */}
          <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
            <div style={{ background:'rgba(15,12,30,0.95)', border:'1px solid rgba(124,58,237,0.25)', borderRadius:16, padding:'1.5rem', display:'flex', flexDirection:'column', gap:'1rem' }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:14, letterSpacing:2, color:'rgba(255,255,255,0.6)' }}>LOBİ AYARLARI</div>

              <div>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:10, letterSpacing:3, color:'rgba(255,255,255,0.3)', marginBottom:8 }}>DİZİLİŞ</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                  {FORMATIONS.map(f => (
                    <button key={f} onClick={() => setFormation(f)}
                      style={{ padding:'8px 4px', borderRadius:7, border:`1.5px solid ${formation===f?'#7c3aed':'rgba(255,255,255,0.07)'}`, background:formation===f?'rgba(124,58,237,0.2)':'rgba(255,255,255,0.03)', color:formation===f?'#a78bfa':'rgba(255,255,255,0.4)', fontFamily:"'Bebas Neue',sans-serif", fontSize:13, letterSpacing:1, cursor:'pointer', transition:'all .15s' }}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:10, letterSpacing:3, color:'rgba(255,255,255,0.3)', marginBottom:8 }}>TRANSFER BÜTÇESİ</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                  {BUDGETS.map(b => (
                    <div key={b.value} onClick={() => setBudget(b.value)}
                      style={{ padding:'10px', borderRadius:8, border:`1.5px solid ${budget===b.value?'#7c3aed':'rgba(255,255,255,0.07)'}`, background:budget===b.value?'rgba(124,58,237,0.2)':'rgba(255,255,255,0.03)', cursor:'pointer', textAlign:'center', transition:'all .15s' }}>
                      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:16, color:budget===b.value?'#a78bfa':'rgba(255,255,255,0.6)', letterSpacing:1 }}>{b.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Butonlar */}
            <button onClick={handleSave}
              style={{ padding:'1.1rem', borderRadius:10, border:'none', background:'linear-gradient(135deg,#6d28d9,#7c3aed,#8b5cf6)', color:'#fff', fontFamily:"'Bebas Neue',sans-serif", fontSize:16, letterSpacing:3, cursor:'pointer', boxShadow:'0 8px 25px rgba(124,58,237,0.4)', position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:0, left:'-100%', width:'60%', height:'100%', background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.15),transparent)', animation:'shimmer 2s ease-in-out infinite' }}/>
              💾 KULÜBÜ KAYDET →
            </button>

            <button onClick={() => navigate('/create/logo')}
              style={{ padding:'.85rem', borderRadius:10, border:'1px solid rgba(255,255,255,0.08)', background:'transparent', color:'rgba(255,255,255,0.35)', fontFamily:"'Bebas Neue',sans-serif", fontSize:13, letterSpacing:2, cursor:'pointer' }}>
              ← GERİ: LOGO
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
