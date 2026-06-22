import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function getUserId() {
  let id = localStorage.getItem('draft_user_id')
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('draft_user_id', id) }
  return id
}

const MANAGER_STYLES = [
  { id: 'aggressive', name: 'Agresif',  emoji: '⚡', desc: 'Atak statlarına +5 bonus',  color: '#ef4444' },
  { id: 'defensive',  name: 'Defansif', emoji: '🛡️', desc: 'Defans statlarına +5 bonus', color: '#3b82f6' },
  { id: 'possession', name: 'Tiki-Taka',emoji: '🎯', desc: 'Pas statlarına +5 bonus',    color: '#10b981' },
  { id: 'counter',    name: 'Kontra',   emoji: '💨', desc: 'Hız statlarına +5 bonus',    color: '#f59e0b' },
  { id: 'physical',   name: 'Fiziksel', emoji: '💪', desc: 'Fizik statlarına +5 bonus',  color: '#8b5cf6' },
  { id: 'technical',  name: 'Teknik',   emoji: '🎨', desc: 'Çalım statlarına +5 bonus',  color: '#ec4899' },
]

const LOGO_SHAPES = ['circle','shield','diamond','hexagon','square']
const LOGO_ICONS  = ['⚽','🦁','🐯','🦅','🐺','🦊','🐻','⭐','🔥','💎','⚔️','🏆','👑','🌙','⚡']
const LOGO_BG_COLORS     = ['#7c3aed','#2563eb','#dc2626','#16a34a','#d97706','#0891b2','#db2777','#4f46e5','#059669','#b45309']
const LOGO_ACCENT_COLORS = ['#fbbf24','#ffffff','#f87171','#86efac','#93c5fd','#c4b5fd','#fdba74','#6ee7b7','#fde68a','#bfdbfe']
const KIT_COLORS   = ['#7c3aed','#2563eb','#dc2626','#16a34a','#d97706','#0891b2','#db2777','#1f2937','#ffffff','#f59e0b','#10b981','#ef4444']
const KIT_PATTERNS = [
  { id:'solid',   name:'Düz' },
  { id:'stripes', name:'Çizgili' },
  { id:'halves',  name:'İki Renk' },
  { id:'hoops',   name:'Halka' },
  { id:'quarters',name:'Çeyrek' },
]

function LogoPreview({ shape, icon, bgColor, accentColor, size=80 }) {
  const s = size
  const getPath = () => {
    switch(shape) {
      case 'shield':  return `M${s/2},${s*.05} L${s*.9},${s*.25} L${s*.9},${s*.6} Q${s*.9},${s*.85} ${s/2},${s*.95} Q${s*.1},${s*.85} ${s*.1},${s*.6} L${s*.1},${s*.25} Z`
      case 'diamond': return `M${s/2},${s*.05} L${s*.92},${s/2} L${s/2},${s*.95} L${s*.08},${s/2} Z`
      case 'hexagon': return `M${s/2},${s*.05} L${s*.88},${s*.27} L${s*.88},${s*.73} L${s/2},${s*.95} L${s*.12},${s*.73} L${s*.12},${s*.27} Z`
      case 'square':  return `M${s*.08},${s*.08} L${s*.92},${s*.08} L${s*.92},${s*.92} L${s*.08},${s*.92} Z`
      default: return null
    }
  }
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      {shape==='circle'
        ? <circle cx={s/2} cy={s/2} r={s*.45} fill={bgColor} stroke={accentColor} strokeWidth={s*.04}/>
        : <path d={getPath()} fill={bgColor} stroke={accentColor} strokeWidth={s*.04}/>}
      <text x={s/2} y={s/2} textAnchor="middle" dominantBaseline="central" fontSize={s*.38}>{icon}</text>
    </svg>
  )
}

function KitPreview({ primary, secondary, pattern, size=100 }) {
  const w = size*.7, h = size, cx = size/2
  const getPattern = () => {
    switch(pattern) {
      case 'stripes':  return Array.from({length:5},(_,i)=><rect key={i} x={w/5*i} y={0} width={w/10} height={h} fill={secondary} opacity={.9}/>)
      case 'halves':   return <rect x={w/2} y={0} width={w/2} height={h} fill={secondary}/>
      case 'hoops':    return Array.from({length:4},(_,i)=><rect key={i} x={0} y={h/4*i} width={w} height={h/8} fill={secondary} opacity={.9}/>)
      case 'quarters': return <><rect x={0} y={0} width={w/2} height={h/2} fill={secondary}/><rect x={w/2} y={h/2} width={w/2} height={h/2} fill={secondary}/></>
      default: return null
    }
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g transform={`translate(${(size-w)/2},0)`}>
        <path d={`M${w*.2},0 L0,${h*.2} L0,${h*.75} Q0,${h} ${w*.1},${h} L${w*.9},${h} Q${w},${h} ${w},${h*.75} L${w},${h*.2} L${w*.8},0 Z`} fill={primary}/>
        <clipPath id="kc"><path d={`M${w*.2},0 L0,${h*.2} L0,${h*.75} Q0,${h} ${w*.1},${h} L${w*.9},${h} Q${w},${h} ${w},${h*.75} L${w},${h*.2} L${w*.8},0 Z`}/></clipPath>
        <g clipPath="url(#kc)">{getPattern()}</g>
        <path d={`M${w*.35},0 Q${w*.35},${h*.12} ${w/2},${h*.15} Q${w*.65},${h*.12} ${w*.65},0`} fill="none" stroke={secondary} strokeWidth={w*.04}/>
        <path d={`M${w*.2},0 L0,${h*.2} L${w*.15},${h*.35} L${w*.3},${h*.15}`} fill={secondary} opacity={.8}/>
        <path d={`M${w*.8},0 L${w},${h*.2} L${w*.85},${h*.35} L${w*.7},${h*.15}`} fill={secondary} opacity={.8}/>
      </g>
    </svg>
  )
}

export default function JoinClubPage() {
  const { code } = useParams()
  const navigate = useNavigate()
  const userId = getUserId()

  const [tab, setTab] = useState('info')
  const [clubName,     setClubName]     = useState('')
  const [managerName,  setManagerName]  = useState('')
  const [managerStyle, setManagerStyle] = useState(null)
  const [logoShape,    setLogoShape]    = useState('shield')
  const [logoIcon,     setLogoIcon]     = useState('⚽')
  const [logoBg,       setLogoBg]       = useState('#2563eb')
  const [logoAccent,   setLogoAccent]   = useState('#fbbf24')
  const [kitPrimary,   setKitPrimary]   = useState('#2563eb')
  const [kitSecondary, setKitSecondary] = useState('#ffffff')
  const [kitPattern,   setKitPattern]   = useState('solid')
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const canProceed = clubName.trim() && managerName.trim() && managerStyle

  const handleJoin = async () => {
    if (!canProceed) return
    setLoading(true)
    setError('')
    try {
      localStorage.setItem('draft_user_name', managerName)
      localStorage.setItem('draft_club_name', clubName)
      localStorage.setItem('draft_manager_style', managerStyle)
      localStorage.setItem('draft_logo', JSON.stringify({ shape:logoShape, icon:logoIcon, bg:logoBg, accent:logoAccent }))
      localStorage.setItem('draft_kit',  JSON.stringify({ primary:kitPrimary, secondary:kitSecondary, pattern:kitPattern }))

      const { data: lobbies } = await supabase.from('lobbies').select('*').ilike('code', code).eq('status','waiting')
      if (!lobbies?.length) throw new Error('Lobi bulunamadı veya oyun başlamış')
      const lobby = lobbies[0]

      const { error: pe } = await supabase.from('lobby_players').insert({
        lobby_id: lobby.id,
        user_id: userId,
        user_name: managerName, manager_name: managerName,
        team_name: clubName,
        logo: { shape: logoShape, icon: logoIcon, bg: logoBg, accent: logoAccent },
        kit: { primary: kitPrimary, secondary: kitSecondary, pattern: kitPattern },
        is_host: false,
        is_ready: false,
      })
      if (pe) throw pe
      navigate(`/lobby/${lobby.code}`)
    } catch(e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight:'100vh', background:'#0a0a1a', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'2rem' }}>
      <div style={{ width:'100%', maxWidth:700 }}>

        <div style={{ textAlign:'center', marginBottom:'1.5rem' }}>
          <p style={{ color:'#8b5cf6', fontSize:'.7rem', fontWeight:700, letterSpacing:'.15em', textTransform:'uppercase', marginBottom:'.5rem' }}>LOBİYE KATIL</p>
          <h1 style={{ fontSize:'2rem', fontWeight:900 }}>Kulübünü Tasarla ⚽</h1>
          <p style={{ color:'#606080', fontSize:'.85rem', marginTop:'.5rem' }}>Lobi kodu: <strong style={{ color:'#a78bfa', letterSpacing:'.1em' }}>{code}</strong></p>
        </div>

        {/* Sekme Nav */}
        <div style={{ display:'flex', background:'#0f0f2a', borderRadius:12, padding:'.25rem', marginBottom:'1.5rem', gap:'.25rem' }}>
          {[['info','📋 Bilgiler'],['logo','🎨 Logo'],['kit','👕 Forma']].map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              style={{ flex:1, padding:'.6rem', borderRadius:9, border:'none', background: tab===t?'#7c3aed':'transparent', color: tab===t?'#fff':'#606080', fontWeight:700, fontSize:'.78rem', cursor:'pointer', transition:'all .15s' }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ background:'#12122a', border:'1px solid #1e1e4a', borderRadius:16, padding:'1.75rem' }}>

          {/* BİLGİLER */}
          {tab === 'info' && (
            <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
              <div>
                <label style={{ display:'block', fontSize:'.75rem', fontWeight:700, color:'#a0a0c0', letterSpacing:'.08em', marginBottom:'.5rem' }}>KULÜP ADI</label>
                <input className="input" placeholder="örn: Galactic FC" value={clubName} onChange={e=>setClubName(e.target.value)} style={{ fontSize:'1.1rem', fontWeight:700 }}/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'.75rem', fontWeight:700, color:'#a0a0c0', letterSpacing:'.08em', marginBottom:'.5rem' }}>MENAJER ADINIZ</label>
                <input className="input" placeholder="Adınız" value={managerName} onChange={e=>setManagerName(e.target.value)}/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'.75rem', fontWeight:700, color:'#a0a0c0', letterSpacing:'.08em', marginBottom:'.75rem' }}>MENAJER STİLİ</label>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'.6rem' }}>
                  {MANAGER_STYLES.map(style => (
                    <div key={style.id} onClick={() => setManagerStyle(style.id)}
                      style={{ padding:'.85rem', borderRadius:12, border:`2px solid ${managerStyle===style.id?style.color:'#1e1e4a'}`, background: managerStyle===style.id?`${style.color}20`:'#0f0f2a', cursor:'pointer', transition:'all .15s' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'.6rem', marginBottom:'.35rem' }}>
                        <span style={{ fontSize:'1.2rem' }}>{style.emoji}</span>
                        <span style={{ fontWeight:800, fontSize:'.85rem', color: managerStyle===style.id?style.color:'#fff' }}>{style.name}</span>
                      </div>
                      <div style={{ fontSize:'.72rem', color:'#606080' }}>{style.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={() => setTab('logo')} disabled={!canProceed}
                style={{ padding:'1rem', borderRadius:10, border:'none', background: canProceed?'#7c3aed':'#1e1e4a', color: canProceed?'#fff':'#606080', fontWeight:700, cursor: canProceed?'pointer':'not-allowed', transition:'all .2s' }}>
                Sonraki: Logo Tasarla →
              </button>
            </div>
          )}

          {/* LOGO */}
          {tab === 'logo' && (
            <div style={{ display:'flex', gap:'2rem' }}>
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'1.25rem' }}>
                <div>
                  <label style={{ display:'block', fontSize:'.75rem', fontWeight:700, color:'#a0a0c0', letterSpacing:'.08em', marginBottom:'.6rem' }}>LOGO ŞEKLİ</label>
                  <div style={{ display:'flex', gap:'.5rem', flexWrap:'wrap' }}>
                    {LOGO_SHAPES.map(s => (
                      <button key={s} onClick={() => setLogoShape(s)}
                        style={{ padding:'.4rem .85rem', borderRadius:8, border:`2px solid ${logoShape===s?'#7c3aed':'#2a2a5a'}`, background: logoShape===s?'rgba(124,58,237,.2)':'#0f0f2a', color: logoShape===s?'#a78bfa':'#606080', fontWeight:700, fontSize:'.75rem', cursor:'pointer' }}>
                        {s==='circle'?'Daire':s==='shield'?'Kalkan':s==='diamond'?'Elmas':s==='hexagon'?'Altıgen':'Kare'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:'.75rem', fontWeight:700, color:'#a0a0c0', letterSpacing:'.08em', marginBottom:'.6rem' }}>İKON</label>
                  <div style={{ display:'flex', gap:'.4rem', flexWrap:'wrap' }}>
                    {LOGO_ICONS.map(icon => (
                      <button key={icon} onClick={() => setLogoIcon(icon)}
                        style={{ width:38, height:38, borderRadius:8, border:`2px solid ${logoIcon===icon?'#7c3aed':'#2a2a5a'}`, background: logoIcon===icon?'rgba(124,58,237,.2)':'#0f0f2a', fontSize:'1.1rem', cursor:'pointer' }}>
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:'.75rem', fontWeight:700, color:'#a0a0c0', letterSpacing:'.08em', marginBottom:'.6rem' }}>ARKAPLAN RENGİ</label>
                  <div style={{ display:'flex', gap:'.4rem', flexWrap:'wrap' }}>
                    {LOGO_BG_COLORS.map(c => (
                      <button key={c} onClick={() => setLogoBg(c)}
                        style={{ width:30, height:30, borderRadius:'50%', background:c, border:`3px solid ${logoBg===c?'#fff':'transparent'}`, cursor:'pointer' }}/>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:'.75rem', fontWeight:700, color:'#a0a0c0', letterSpacing:'.08em', marginBottom:'.6rem' }}>VURGU RENGİ</label>
                  <div style={{ display:'flex', gap:'.4rem', flexWrap:'wrap' }}>
                    {LOGO_ACCENT_COLORS.map(c => (
                      <button key={c} onClick={() => setLogoAccent(c)}
                        style={{ width:30, height:30, borderRadius:'50%', background:c, border:`3px solid ${logoAccent===c?'#fff':'transparent'}`, cursor:'pointer' }}/>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'1rem', minWidth:160 }}>
                <div style={{ background:'#0f0f2a', borderRadius:16, padding:'1.5rem', border:'1px solid #2a2a5a', display:'flex', flexDirection:'column', alignItems:'center', gap:'.75rem' }}>
                  <LogoPreview shape={logoShape} icon={logoIcon} bgColor={logoBg} accentColor={logoAccent} size={100}/>
                  <div style={{ fontWeight:800, fontSize:'.85rem', textAlign:'center', maxWidth:130, wordBreak:'break-word' }}>{clubName||'Kulüp Adı'}</div>
                </div>
                <button onClick={() => setTab('kit')}
                  style={{ width:'100%', padding:'.75rem', borderRadius:10, border:'none', background:'#7c3aed', color:'#fff', fontWeight:700, cursor:'pointer' }}>
                  Sonraki: Forma →
                </button>
              </div>
            </div>
          )}

          {/* FORMA */}
          {tab === 'kit' && (
            <div style={{ display:'flex', gap:'2rem' }}>
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'1.25rem' }}>
                <div>
                  <label style={{ display:'block', fontSize:'.75rem', fontWeight:700, color:'#a0a0c0', letterSpacing:'.08em', marginBottom:'.6rem' }}>ANA RENK</label>
                  <div style={{ display:'flex', gap:'.4rem', flexWrap:'wrap' }}>
                    {KIT_COLORS.map(c => (
                      <button key={c} onClick={() => setKitPrimary(c)}
                        style={{ width:30, height:30, borderRadius:6, background:c, border:`3px solid ${kitPrimary===c?'#fff':'transparent'}`, cursor:'pointer' }}/>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:'.75rem', fontWeight:700, color:'#a0a0c0', letterSpacing:'.08em', marginBottom:'.6rem' }}>İKİNCİL RENK</label>
                  <div style={{ display:'flex', gap:'.4rem', flexWrap:'wrap' }}>
                    {KIT_COLORS.map(c => (
                      <button key={c} onClick={() => setKitSecondary(c)}
                        style={{ width:30, height:30, borderRadius:6, background:c, border:`3px solid ${kitSecondary===c?'#fff':'transparent'}`, cursor:'pointer' }}/>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:'.75rem', fontWeight:700, color:'#a0a0c0', letterSpacing:'.08em', marginBottom:'.6rem' }}>DESEN</label>
                  <div style={{ display:'flex', gap:'.5rem', flexWrap:'wrap' }}>
                    {KIT_PATTERNS.map(p => (
                      <button key={p.id} onClick={() => setKitPattern(p.id)}
                        style={{ padding:'.4rem .85rem', borderRadius:8, border:`2px solid ${kitPattern===p.id?'#7c3aed':'#2a2a5a'}`, background: kitPattern===p.id?'rgba(124,58,237,.2)':'#0f0f2a', color: kitPattern===p.id?'#a78bfa':'#606080', fontWeight:700, fontSize:'.75rem', cursor:'pointer' }}>
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'1rem', minWidth:160 }}>
                <div style={{ background:'#0f0f2a', borderRadius:16, padding:'1.5rem', border:'1px solid #2a2a5a', display:'flex', flexDirection:'column', alignItems:'center', gap:'.75rem' }}>
                  <KitPreview primary={kitPrimary} secondary={kitSecondary} pattern={kitPattern} size={110}/>
                  <div style={{ fontWeight:700, fontSize:'.8rem' }}>İç Saha Forması</div>
                </div>
                {error && <p style={{ color:'#ef4444', fontSize:'.8rem', textAlign:'center' }}>{error}</p>}
                <button onClick={handleJoin} disabled={loading||!canProceed}
                  style={{ width:'100%', padding:'.85rem', borderRadius:10, border:'none', background: canProceed?'#7c3aed':'#1e1e4a', color: canProceed?'#fff':'#606080', fontWeight:700, cursor: canProceed&&!loading?'pointer':'not-allowed', transition:'all .2s' }}>
                  {loading ? 'Katılıyor...' : '🚀 LOBİYE KATIL'}
                </button>
              </div>
            </div>
          )}
        </div>

        <button onClick={() => navigate('/menu')}
          style={{ marginTop:'1rem', width:'100%', padding:'.75rem', borderRadius:10, border:'1px solid #2a2a5a', background:'transparent', color:'#606080', fontWeight:600, cursor:'pointer' }}>
          ← Ana Menüye Dön
        </button>
      </div>
    </div>
  )
}
