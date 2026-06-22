import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getClub, saveClub } from '../lib/club'

function getUserId() {
  let id = localStorage.getItem('draft_user_id')
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('draft_user_id', id) }
  return id
}

const MANAGER_STYLES = [
  { id:'aggressive', name:'Agresif',   emoji:'⚡', desc:'Atak statlarına +5 bonus',   color:'#ef4444' },
  { id:'defensive',  name:'Defansif',  emoji:'🛡️', desc:'Defans statlarına +5 bonus',  color:'#3b82f6' },
  { id:'possession', name:'Tiki-Taka', emoji:'🎯', desc:'Pas statlarına +5 bonus',     color:'#10b981' },
  { id:'counter',    name:'Kontra',    emoji:'💨', desc:'Hız statlarına +5 bonus',     color:'#f59e0b' },
  { id:'physical',   name:'Fiziksel',  emoji:'💪', desc:'Fizik statlarına +5 bonus',   color:'#8b5cf6' },
  { id:'technical',  name:'Teknik',    emoji:'🎨', desc:'Çalım statlarına +5 bonus',   color:'#ec4899' },
]
const BUDGETS = [
  { label:'€100M',    value:100000000 },
  { label:'€300M',    value:300000000 },
  { label:'€600M',    value:600000000 },
  { label:'Sınırsız', value:999999999999 },
]
const LEAGUES = [
  { id:'all',        name:'Tüm Ligler',  flag:'🌍', active:true  },
  { id:'premier',    name:'Premier Lig', flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', active:false },
  { id:'laliga',     name:'La Liga',     flag:'🇪🇸', active:false },
  { id:'bundesliga', name:'Bundesliga',  flag:'🇩🇪', active:false },
  { id:'seriea',     name:'Serie A',     flag:'🇮🇹', active:false },
  { id:'superlig',   name:'Süper Lig',   flag:'🇹🇷', active:false },
]
const LOGO_SHAPES        = ['circle','shield','diamond','hexagon','square']
const LOGO_ICONS         = ['⚽','🦁','🐯','🦅','🐺','🦊','🐻','⭐','🔥','💎','⚔️','🏆','👑','🌙','⚡']
const LOGO_BG_COLORS     = ['#7c3aed','#2563eb','#dc2626','#16a34a','#d97706','#0891b2','#db2777','#4f46e5','#059669','#b45309']
const LOGO_ACCENT_COLORS = ['#fbbf24','#ffffff','#f87171','#86efac','#93c5fd','#c4b5fd','#fdba74','#6ee7b7','#fde68a','#bfdbfe']
const KIT_COLORS         = ['#7c3aed','#2563eb','#dc2626','#16a34a','#d97706','#0891b2','#db2777','#1f2937','#ffffff','#f59e0b','#10b981','#ef4444']
const KIT_PATTERNS       = [
  { id:'solid',    name:'Düz'      },
  { id:'stripes',  name:'Çizgili'  },
  { id:'halves',   name:'İki Renk' },
  { id:'hoops',    name:'Halka'    },
  { id:'quarters', name:'Çeyrek'   },
]

export function LogoPreview({ shape, icon, bgColor, accentColor, size=80 }) {
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

export function KitPreview({ primary, secondary, pattern, size=100 }) {
  const w = size*.7, h = size
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
        <clipPath id="kc2"><path d={`M${w*.2},0 L0,${h*.2} L0,${h*.75} Q0,${h} ${w*.1},${h} L${w*.9},${h} Q${w},${h} ${w},${h*.75} L${w},${h*.2} L${w*.8},0 Z`}/></clipPath>
        <g clipPath="url(#kc2)">{getPattern()}</g>
        <path d={`M${w*.35},0 Q${w*.35},${h*.12} ${w/2},${h*.15} Q${w*.65},${h*.12} ${w*.65},0`} fill="none" stroke={secondary} strokeWidth={w*.04}/>
        <path d={`M${w*.2},0 L0,${h*.2} L${w*.15},${h*.35} L${w*.3},${h*.15}`} fill={secondary} opacity={.8}/>
        <path d={`M${w*.8},0 L${w},${h*.2} L${w*.85},${h*.35} L${w*.7},${h*.15}`} fill={secondary} opacity={.8}/>
      </g>
    </svg>
  )
}

function ClubEditor({ initialClub, onSave, onCancel, showLobbyTab = true }) {
  const [tab, setTab] = useState('info')
  const [clubName,     setClubName]     = useState(initialClub?.clubName     || '')
  const [managerName,  setManagerName]  = useState(initialClub?.managerName  || '')
  const [managerStyle, setManagerStyle] = useState(initialClub?.managerStyle || null)
  const [logoShape,    setLogoShape]    = useState(initialClub?.logo?.shape   || 'shield')
  const [logoIcon,     setLogoIcon]     = useState(initialClub?.logo?.icon    || '⚽')
  const [logoBg,       setLogoBg]       = useState(initialClub?.logo?.bg      || '#7c3aed')
  const [logoAccent,   setLogoAccent]   = useState(initialClub?.logo?.accent  || '#fbbf24')
  const [kitPrimary,   setKitPrimary]   = useState(initialClub?.kit?.primary   || '#7c3aed')
  const [kitSecondary, setKitSecondary] = useState(initialClub?.kit?.secondary || '#fbbf24')
  const [kitPattern,   setKitPattern]   = useState(initialClub?.kit?.pattern   || 'solid')
  const [budget,       setBudget]       = useState(initialClub?.budget        || 500000000)
  const [formation,    setFormation]    = useState(initialClub?.formation     || '4-4-2')
  const [league,       setLeague]       = useState(initialClub?.league        || 'all')

  const canProceed = clubName.trim() && managerName.trim() && managerStyle
  const tabs = showLobbyTab
    ? [['info','📋 Bilgiler'],['logo','🎨 Logo'],['kit','👕 Forma'],['lobby','⚙️ Lobi']]
    : [['info','📋 Bilgiler'],['logo','🎨 Logo'],['kit','👕 Forma']]

  const handleSave = () => {
    const club = {
      clubName, managerName, managerStyle,
      logo: { shape:logoShape, icon:logoIcon, bg:logoBg, accent:logoAccent },
      kit:  { primary:kitPrimary, secondary:kitSecondary, pattern:kitPattern },
      budget, formation, league,
    }
    onSave(club)
  }

  return (
    <div style={{ width:'100%', maxWidth:700, margin:'0 auto' }}>
      {/* Sekme Nav */}
      <div style={{ display:'flex', background:'#0f0f2a', borderRadius:12, padding:'.25rem', marginBottom:'1.5rem', gap:'.25rem' }}>
        {tabs.map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            style={{ flex:1, padding:'.6rem', borderRadius:9, border:'none', background:tab===t?'#7c3aed':'transparent', color:tab===t?'#fff':'#606080', fontWeight:700, fontSize:'.78rem', cursor:'pointer', transition:'all .15s' }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ background:'#12122a', border:'1px solid #1e1e4a', borderRadius:16, padding:'1.75rem' }}>

        {/* BİLGİLER */}
        {tab==='info' && (
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
                {MANAGER_STYLES.map(s => (
                  <div key={s.id} onClick={() => setManagerStyle(s.id)}
                    style={{ padding:'.85rem', borderRadius:12, border:`2px solid ${managerStyle===s.id?s.color:'#1e1e4a'}`, background:managerStyle===s.id?`${s.color}20`:'#0f0f2a', cursor:'pointer', transition:'all .15s' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'.6rem', marginBottom:'.35rem' }}>
                      <span style={{ fontSize:'1.2rem' }}>{s.emoji}</span>
                      <span style={{ fontWeight:800, fontSize:'.85rem', color:managerStyle===s.id?s.color:'#fff' }}>{s.name}</span>
                    </div>
                    <div style={{ fontSize:'.72rem', color:'#606080' }}>{s.desc}</div>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={() => setTab('logo')} disabled={!canProceed}
              style={{ padding:'1rem', borderRadius:10, border:'none', background:canProceed?'#7c3aed':'#1e1e4a', color:canProceed?'#fff':'#606080', fontWeight:700, cursor:canProceed?'pointer':'not-allowed', transition:'all .2s' }}>
              Sonraki: Logo →
            </button>
          </div>
        )}

        {/* LOGO */}
        {tab==='logo' && (
          <div style={{ display:'flex', gap:'2rem' }}>
            <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'1.1rem' }}>
              <div>
                <label style={{ display:'block', fontSize:'.75rem', fontWeight:700, color:'#a0a0c0', letterSpacing:'.08em', marginBottom:'.5rem' }}>ŞEKİL</label>
                <div style={{ display:'flex', gap:'.4rem', flexWrap:'wrap' }}>
                  {LOGO_SHAPES.map(s => (
                    <button key={s} onClick={() => setLogoShape(s)}
                      style={{ padding:'.4rem .75rem', borderRadius:8, border:`2px solid ${logoShape===s?'#7c3aed':'#2a2a5a'}`, background:logoShape===s?'rgba(124,58,237,.2)':'#0f0f2a', color:logoShape===s?'#a78bfa':'#606080', fontWeight:700, fontSize:'.73rem', cursor:'pointer' }}>
                      {s==='circle'?'Daire':s==='shield'?'Kalkan':s==='diamond'?'Elmas':s==='hexagon'?'Altıgen':'Kare'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'.75rem', fontWeight:700, color:'#a0a0c0', letterSpacing:'.08em', marginBottom:'.5rem' }}>İKON</label>
                <div style={{ display:'flex', gap:'.35rem', flexWrap:'wrap' }}>
                  {LOGO_ICONS.map(icon => (
                    <button key={icon} onClick={() => setLogoIcon(icon)}
                      style={{ width:36, height:36, borderRadius:8, border:`2px solid ${logoIcon===icon?'#7c3aed':'#2a2a5a'}`, background:logoIcon===icon?'rgba(124,58,237,.2)':'#0f0f2a', fontSize:'1rem', cursor:'pointer' }}>
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'.75rem', fontWeight:700, color:'#a0a0c0', letterSpacing:'.08em', marginBottom:'.5rem' }}>ARKAPLAN</label>
                <div style={{ display:'flex', gap:'.35rem', flexWrap:'wrap' }}>
                  {LOGO_BG_COLORS.map(c => (
                    <button key={c} onClick={() => setLogoBg(c)}
                      style={{ width:28, height:28, borderRadius:'50%', background:c, border:`3px solid ${logoBg===c?'#fff':'transparent'}`, cursor:'pointer' }}/>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'.75rem', fontWeight:700, color:'#a0a0c0', letterSpacing:'.08em', marginBottom:'.5rem' }}>VURGU</label>
                <div style={{ display:'flex', gap:'.35rem', flexWrap:'wrap' }}>
                  {LOGO_ACCENT_COLORS.map(c => (
                    <button key={c} onClick={() => setLogoAccent(c)}
                      style={{ width:28, height:28, borderRadius:'50%', background:c, border:`3px solid ${logoAccent===c?'#fff':'transparent'}`, cursor:'pointer' }}/>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'1rem', minWidth:150 }}>
              <div style={{ background:'#0f0f2a', borderRadius:16, padding:'1.25rem', border:'1px solid #2a2a5a', display:'flex', flexDirection:'column', alignItems:'center', gap:'.6rem' }}>
                <LogoPreview shape={logoShape} icon={logoIcon} bgColor={logoBg} accentColor={logoAccent} size={90}/>
                <div style={{ fontWeight:800, fontSize:'.82rem', textAlign:'center', maxWidth:120, wordBreak:'break-word' }}>{clubName||'Kulüp'}</div>
              </div>
              <button onClick={() => setTab('kit')}
                style={{ width:'100%', padding:'.7rem', borderRadius:10, border:'none', background:'#7c3aed', color:'#fff', fontWeight:700, cursor:'pointer' }}>
                Sonraki: Forma →
              </button>
            </div>
          </div>
        )}

        {/* FORMA */}
        {tab==='kit' && (
          <div style={{ display:'flex', gap:'2rem' }}>
            <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'1.1rem' }}>
              <div>
                <label style={{ display:'block', fontSize:'.75rem', fontWeight:700, color:'#a0a0c0', letterSpacing:'.08em', marginBottom:'.5rem' }}>ANA RENK</label>
                <div style={{ display:'flex', gap:'.35rem', flexWrap:'wrap' }}>
                  {KIT_COLORS.map(c => (
                    <button key={c} onClick={() => setKitPrimary(c)}
                      style={{ width:28, height:28, borderRadius:6, background:c, border:`3px solid ${kitPrimary===c?'#fff':'transparent'}`, cursor:'pointer' }}/>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'.75rem', fontWeight:700, color:'#a0a0c0', letterSpacing:'.08em', marginBottom:'.5rem' }}>İKİNCİL RENK</label>
                <div style={{ display:'flex', gap:'.35rem', flexWrap:'wrap' }}>
                  {KIT_COLORS.map(c => (
                    <button key={c} onClick={() => setKitSecondary(c)}
                      style={{ width:28, height:28, borderRadius:6, background:c, border:`3px solid ${kitSecondary===c?'#fff':'transparent'}`, cursor:'pointer' }}/>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'.75rem', fontWeight:700, color:'#a0a0c0', letterSpacing:'.08em', marginBottom:'.5rem' }}>DESEN</label>
                <div style={{ display:'flex', gap:'.4rem', flexWrap:'wrap' }}>
                  {KIT_PATTERNS.map(p => (
                    <button key={p.id} onClick={() => setKitPattern(p.id)}
                      style={{ padding:'.4rem .75rem', borderRadius:8, border:`2px solid ${kitPattern===p.id?'#7c3aed':'#2a2a5a'}`, background:kitPattern===p.id?'rgba(124,58,237,.2)':'#0f0f2a', color:kitPattern===p.id?'#a78bfa':'#606080', fontWeight:700, fontSize:'.73rem', cursor:'pointer' }}>
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'1rem', minWidth:150 }}>
              <div style={{ background:'#0f0f2a', borderRadius:16, padding:'1.25rem', border:'1px solid #2a2a5a', display:'flex', flexDirection:'column', alignItems:'center', gap:'.6rem' }}>
                <KitPreview primary={kitPrimary} secondary={kitSecondary} pattern={kitPattern} size={100}/>
                <div style={{ fontWeight:700, fontSize:'.78rem' }}>İç Saha</div>
              </div>
              <button onClick={() => setTab(showLobbyTab ? 'lobby' : 'save')}
                style={{ width:'100%', padding:'.7rem', borderRadius:10, border:'none', background:'#7c3aed', color:'#fff', fontWeight:700, cursor:'pointer' }}
                onClickCapture={!showLobbyTab ? handleSave : undefined}>
                {showLobbyTab ? 'Sonraki: Lobi →' : '💾 Kaydet'}
              </button>
            </div>
          </div>
        )}

        {/* LOBİ AYARLARI */}
        {tab==='lobby' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
            <div>
              <label style={{ display:'block', fontSize:'.75rem', fontWeight:700, color:'#a0a0c0', letterSpacing:'.08em', marginBottom:'.75rem' }}>DİZİLİŞ</label>
              <div style={{ display:'flex', gap:'.5rem', flexWrap:'wrap' }}>
                {['4-4-2','4-3-3','3-5-2','4-2-3-1','5-3-2','3-4-3'].map(f => (
                  <button key={f} onClick={() => setFormation(f)}
                    style={{ padding:'.5rem 1rem', borderRadius:8, border:`2px solid ${formation===f?'#7c3aed':'#2a2a5a'}`, background:formation===f?'rgba(124,58,237,.2)':'#0f0f2a', color:formation===f?'#a78bfa':'#606080', fontWeight:700, fontSize:'.82rem', cursor:'pointer' }}>
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ display:'block', fontSize:'.75rem', fontWeight:700, color:'#a0a0c0', letterSpacing:'.08em', marginBottom:'.75rem' }}>TRANSFER BÜTÇESİ</label>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'.6rem' }}>
                {BUDGETS.map(b => (
                  <div key={b.value} onClick={() => setBudget(b.value)}
                    style={{ padding:'1rem', borderRadius:12, border:`2px solid ${budget===b.value?'#7c3aed':'#1e1e4a'}`, background:budget===b.value?'rgba(124,58,237,.2)':'#0f0f2a', cursor:'pointer', textAlign:'center', transition:'all .15s' }}>
                    <div style={{ fontWeight:800, fontSize:'1.1rem', color:budget===b.value?'#a78bfa':'#fff' }}>{b.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label style={{ display:'block', fontSize:'.75rem', fontWeight:700, color:'#a0a0c0', letterSpacing:'.08em', marginBottom:'.5rem' }}>
                LİG <span style={{ color:'#606080', fontWeight:400, textTransform:'none', letterSpacing:0 }}>(yakında)</span>
              </label>
              <div style={{ display:'flex', flexDirection:'column', gap:'.4rem' }}>
                {LEAGUES.map(lg => (
                  <div key={lg.id} onClick={() => lg.active && setLeague(lg.id)}
                    style={{ padding:'.7rem 1rem', borderRadius:10, border:`1px solid ${league===lg.id?'#7c3aed':'#1e1e4a'}`, background:league===lg.id?'rgba(124,58,237,.15)':'#0f0f2a', display:'flex', alignItems:'center', gap:'.75rem', cursor:lg.active?'pointer':'not-allowed', opacity:lg.active?1:.4 }}>
                    <span style={{ fontSize:'1rem' }}>{lg.flag}</span>
                    <span style={{ fontWeight:600, fontSize:'.85rem' }}>{lg.name}</span>
                    {!lg.active && <span style={{ marginLeft:'auto', background:'#1e1e4a', color:'#606080', fontSize:'.6rem', fontWeight:700, padding:'.15rem .4rem', borderRadius:4 }}>YAKINDA</span>}
                    {lg.active && league===lg.id && <span style={{ marginLeft:'auto', color:'#10b981' }}>✓</span>}
                  </div>
                ))}
              </div>
            </div>
            <button onClick={handleSave}
              style={{ padding:'1.1rem', borderRadius:12, border:'none', background:'#7c3aed', color:'#fff', fontWeight:800, fontSize:'1rem', cursor:'pointer', transition:'all .2s' }}>
              💾 Kaydet ve Devam Et
            </button>
          </div>
        )}
      </div>

      {onCancel && (
        <button onClick={onCancel}
          style={{ marginTop:'1rem', width:'100%', padding:'.75rem', borderRadius:10, border:'1px solid #2a2a5a', background:'transparent', color:'#606080', fontWeight:600, cursor:'pointer' }}>
          ← İptal
        </button>
      )}
    </div>
  )
}

export default function MenuPage() {
  const navigate = useNavigate()
  const userId = getUserId()
  const [screen, setScreen] = useState(() => getClub() ? 'home' : 'create')
  const [editing, setEditing] = useState(false)
  const [lobbyCode, setLobbyCode] = useState('')
  const [joinError, setJoinError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showJoin, setShowJoin] = useState(false)

  const club = getClub()

  const handleSaveClub = async (club) => {
    saveClub(club)
    localStorage.setItem('draft_user_name', club.managerName)
    setEditing(false)
    setScreen('home')
  }

  const handleCreateLobby = async () => {
    const c = getClub()
    if (!c) return
    setLoading(true)
    try {
      const genCode = () => Math.random().toString(36).substring(2, 7).toUpperCase()
      const lobbyCode = genCode()
      const { data: lobby, error: le } = await supabase.from('lobbies').insert({
        code: lobbyCode,
        host_id: userId,
        formation: c.formation || '4-4-2',
        budget: c.budget || 300000000,
        
        
      }).select().single()
      if (le) throw le
      await supabase.from('lobby_players').insert({
        lobby_id: lobby.id,
        user_id: userId,
        user_name: c.managerName, manager_name: c.managerName,
        team_name: c.clubName,
        logo: c.logo || null,
        kit: c.kit || null,
        manager_style: c.managerStyle || null,
        is_host: true,
        is_ready: false,
      })
      navigate(`/lobby/${lobby.code}`)
    } catch(e) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async () => {
    const c = getClub()
    if (!c || !lobbyCode.trim()) { setJoinError('Lobi kodu gir'); return }
    setLoading(true)
    setJoinError('')
    try {
      const { data: lobbies } = await supabase.from('lobbies').select('*').ilike('code', lobbyCode.trim()).eq('status','waiting')
      if (!lobbies?.length) throw new Error('Lobi bulunamadı')
      const lobby = lobbies[0]
      const { error: pe } = await supabase.from('lobby_players').insert({
        lobby_id: lobby.id, user_id: userId,
        user_name: c.managerName, manager_name: c.managerName, team_name: c.clubName,
        logo: c.logo || null, kit: c.kit || null,
        manager_style: c.managerStyle || null,
        is_host: false, is_ready: false,
      })
      if (pe) throw pe
      navigate(`/lobby/${lobby.code}`)
    } catch(e) {
      setJoinError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // İLK KULÜP OLUŞTURMA
  if (screen === 'create') return (
    <div style={{ minHeight:'100vh', background:'#0a0a1a', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'2rem' }}>
      <div style={{ textAlign:'center', marginBottom:'1.5rem' }}>
        <p style={{ color:'#8b5cf6', fontSize:'.7rem', fontWeight:700, letterSpacing:'.15em', textTransform:'uppercase', marginBottom:'.5rem' }}>HOŞ GELDİN</p>
        <h1 style={{ fontSize:'2rem', fontWeight:900 }}>Kulübünü Oluştur ⚽</h1>
        <p style={{ color:'#606080', fontSize:'.85rem', marginTop:'.5rem' }}>Bir kez oluştur, her oyunda kullan</p>
      </div>
      <ClubEditor initialClub={null} onSave={handleSaveClub} showLobbyTab={true} />
    </div>
  )

  // DÜZENLEME MODU
  if (editing) return (
    <div style={{ minHeight:'100vh', background:'#0a0a1a', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'2rem' }}>
      <div style={{ textAlign:'center', marginBottom:'1.5rem' }}>
        <p style={{ color:'#8b5cf6', fontSize:'.7rem', fontWeight:700, letterSpacing:'.15em', textTransform:'uppercase', marginBottom:'.5rem' }}>KULÜP DÜZENLE</p>
        <h1 style={{ fontSize:'2rem', fontWeight:900 }}>Kulübünü Güncelle ✏️</h1>
      </div>
      <ClubEditor initialClub={club} onSave={handleSaveClub} onCancel={() => setEditing(false)} showLobbyTab={true} />
    </div>
  )

  // ANA EKRAN — kulüp mevcut
  return (
    <div style={{ minHeight:'100vh', background:'rgba(10,10,26,0.75)', backgroundImage:'url(/bg.jpg)', backgroundSize:'cover', backgroundPosition:'center', backgroundAttachment:'fixed', display:'flex', alignItems:'center', justifyContent:'center', padding:'2rem', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'fixed', inset:0, pointerEvents:'none', background:'radial-gradient(ellipse 60% 50% at 20% 50%,rgba(124,58,237,.15) 0%,transparent 70%)' }}/>
      <div style={{ width:'100%', maxWidth:580, position:'relative', zIndex:1 }}>

        {/* Kulüp Kartı */}
        <div style={{ background:'#12122a', border:'1px solid #2a2a5a', borderRadius:20, padding:'1.75rem', marginBottom:'1.25rem' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'1.25rem', marginBottom:'1.25rem' }}>
            <LogoPreview shape={club?.logo?.shape||'shield'} icon={club?.logo?.icon||'⚽'} bgColor={club?.logo?.bg||'#7c3aed'} accentColor={club?.logo?.accent||'#fbbf24'} size={72}/>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:900, fontSize:'1.4rem', marginBottom:'.2rem' }}>{club?.clubName}</div>
              <div style={{ color:'#a0a0c0', fontSize:'.85rem' }}>Menajer: <strong style={{ color:'#fff' }}>{club?.managerName}</strong></div>
              {club?.managerStyle && (() => {
                const s = MANAGER_STYLES.find(x => x.id === club.managerStyle)
                return s ? <div style={{ color:s.color, fontSize:'.78rem', fontWeight:700, marginTop:'.2rem' }}>{s.emoji} {s.name} · {s.desc}</div> : null
              })()}
            </div>
            <KitPreview primary={club?.kit?.primary||'#7c3aed'} secondary={club?.kit?.secondary||'#fbbf24'} pattern={club?.kit?.pattern||'solid'} size={70}/>
          </div>
          <div style={{ display:'flex', gap:'.75rem' }}>
            <div style={{ flex:1, background:'#0f0f2a', borderRadius:10, padding:'.6rem .75rem' }}>
              <div style={{ fontSize:'.65rem', color:'#606080', fontWeight:600, letterSpacing:'.06em', marginBottom:'.2rem' }}>DİZİLİŞ</div>
              <div style={{ fontWeight:800 }}>{club?.formation||'4-4-2'}</div>
            </div>
            <div style={{ flex:1, background:'#0f0f2a', borderRadius:10, padding:'.6rem .75rem' }}>
              <div style={{ fontSize:'.65rem', color:'#606080', fontWeight:600, letterSpacing:'.06em', marginBottom:'.2rem' }}>BÜTÇE</div>
              <div style={{ fontWeight:800 }}>{club?.budget >= 999999999999 ? 'Sınırsız' : `€${(club?.budget/1e6)||500}M`}</div>
            </div>
            <button onClick={() => setEditing(true)}
              style={{ padding:'.6rem 1rem', borderRadius:10, border:'1px solid #2a2a5a', background:'transparent', color:'#a0a0c0', fontWeight:700, fontSize:'.8rem', cursor:'pointer' }}>
              ✏️ Düzenle
            </button>
          </div>
        </div>

        {/* Aksiyonlar */}
        <div style={{ display:'flex', flexDirection:'column', gap:'.75rem' }}>
          <button onClick={handleCreateLobby} disabled={loading}
            style={{ padding:'1.1rem', borderRadius:14, border:'none', background:'#7c3aed', color:'#fff', fontWeight:800, fontSize:'1rem', cursor:'pointer', transition:'all .2s' }}>
            {loading ? 'Oluşturuluyor...' : '⚽ YENİ LOBİ OLUŞTUR'}
          </button>

          {!showJoin ? (
            <button onClick={() => setShowJoin(true)}
              style={{ padding:'1.1rem', borderRadius:14, border:'1px solid #2a2a5a', background:'transparent', color:'#a0a0c0', fontWeight:700, fontSize:'1rem', cursor:'pointer' }}>
              🔗 Lobiye Katıl
            </button>
          ) : (
            <div style={{ background:'#12122a', border:'1px solid #1e1e4a', borderRadius:14, padding:'1.25rem', display:'flex', flexDirection:'column', gap:'.75rem' }}>
              <input className="input" placeholder="LOBİ KODU" value={lobbyCode} onChange={e=>setLobbyCode(e.target.value.toUpperCase())} maxLength={6}
                style={{ letterSpacing:'.2em', fontWeight:700, textAlign:'center', textTransform:'uppercase', fontSize:'1.1rem' }}/>
              {joinError && <p style={{ color:'#ef4444', fontSize:'.8rem' }}>{joinError}</p>}
              <div style={{ display:'flex', gap:'.75rem' }}>
                <button onClick={() => setShowJoin(false)}
                  style={{ flex:1, padding:'.75rem', borderRadius:10, border:'1px solid #2a2a5a', background:'transparent', color:'#606080', fontWeight:600, cursor:'pointer' }}>
                  İptal
                </button>
                <button onClick={handleJoin} disabled={loading}
                  style={{ flex:2, padding:'.75rem', borderRadius:10, border:'none', background:'#7c3aed', color:'#fff', fontWeight:700, cursor:'pointer' }}>
                  {loading ? 'Katılıyor...' : 'KATIL →'}
                </button>
              </div>
            </div>
          )}
        </div>

        <p style={{ textAlign:'center', color:'#606080', fontSize:'.75rem', marginTop:'1.25rem' }}>
          Farklı bir kulüpte oynamak için ✏️ Düzenle butonunu kullan
        </p>
      </div>
    </div>
  )
}
