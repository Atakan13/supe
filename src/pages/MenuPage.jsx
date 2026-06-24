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
  const uid = primary.replace('#','') + pattern

  return (
    <div style={{ position:'relative', width:size, height:size }}>
      {/* Renkli arka plan — forma maskesiyle kesilecek */}
      <div style={{
        position:'absolute', inset:0,
        WebkitMaskImage:'url(/assets/kit_base.png)',
        WebkitMaskSize:'contain',
        WebkitMaskRepeat:'no-repeat',
        WebkitMaskPosition:'center',
        maskImage:'url(/assets/kit_base.png)',
        maskSize:'contain',
        maskRepeat:'no-repeat',
        maskPosition:'center',
      }}>
        {/* Ana renk */}
        <div style={{ position:'absolute', inset:0, background:primary }}/>
        
        {/* Desen overlay */}
        {pattern==='stripes' && Array.from({length:6},(_,i)=>(
          <div key={i} style={{ position:'absolute', top:0, bottom:0, left:`${i*16.66}%`, width:'8.33%', background:secondary, opacity:.7 }}/>
        ))}
        {pattern==='halves' && <div style={{ position:'absolute', top:0, right:0, bottom:0, width:'50%', background:secondary }}/>}
        {pattern==='hoops' && Array.from({length:4},(_,i)=>(
          <div key={i} style={{ position:'absolute', left:0, right:0, top:`${i*25}%`, height:'12.5%', background:secondary, opacity:.7 }}/>
        ))}
        {pattern==='quarters' && <>
          <div style={{ position:'absolute', top:0, left:0, width:'50%', height:'50%', background:secondary }}/>
          <div style={{ position:'absolute', bottom:0, right:0, width:'50%', height:'50%', background:secondary }}/>
        </>}

        {/* Highlight — 3D his için */}
        <div style={{
          position:'absolute', inset:0,
          background:'linear-gradient(135deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.05) 40%, rgba(0,0,0,0.15) 100%)',
        }}/>
      </div>

      {/* Forma PNG üstte — gölge ve detaylar için */}
      <img
        src="/assets/kit_base.png"
        alt="forma"
        style={{
          position:'absolute', inset:0,
          width:'100%', height:'100%',
          objectFit:'contain',
          filter:'drop-shadow(0 4px 12px rgba(0,0,0,0.5))',
          mixBlendMode:'multiply',
        }}
      />
    </div>
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
  const managerStyleObj = MANAGER_STYLES.find(x => x.id === club?.managerStyle)

  return (
    <div style={{ minHeight:'100vh', backgroundImage:'url(/bg.jpg)', backgroundSize:'cover', backgroundPosition:'center', backgroundAttachment:'fixed', display:'flex', alignItems:'center', justifyContent:'center', padding:'2rem', position:'relative', overflow:'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Rajdhani:wght@400;500;600;700&display=swap');
        @keyframes shimmer{0%{left:-100%}100%{left:200%}}
      `}</style>

      {/* Koyu overlay */}
      <div style={{ position:'fixed', inset:0, background:'rgba(5,5,15,0.70)', pointerEvents:'none' }}/>
      <div style={{ position:'fixed', inset:0, background:'radial-gradient(ellipse 45% 80% at 0% 50%, rgba(180,60,0,0.18) 0%, transparent 55%)', pointerEvents:'none' }}/>
      <div style={{ position:'fixed', inset:0, background:'radial-gradient(ellipse 45% 80% at 100% 50%, rgba(0,60,180,0.18) 0%, transparent 55%)', pointerEvents:'none' }}/>

      <div style={{ position:'relative', zIndex:1, width:'100%', maxWidth:880 }}>

        {/* 3 kolonlu ana panel */}
        <div style={{
          display:'grid',
          gridTemplateColumns:'220px 1fr 140px',
          gap:0,
          background:'linear-gradient(145deg,rgba(12,12,28,0.97) 0%,rgba(8,8,20,0.99) 100%)',
          border:'1px solid rgba(180,120,0,0.35)',
          borderRadius:16,
          overflow:'hidden',
          boxShadow:'0 30px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}>

          {/* SOL PANEL */}
          <div style={{ background:'rgba(0,0,0,0.25)', borderRight:'1px solid rgba(180,120,0,0.15)', padding:'1.75rem 1.25rem', display:'flex', flexDirection:'column', alignItems:'center', gap:'1rem' }}>
            
            {/* Logo */}
            <div style={{ position:'relative' }}>
              <div style={{ position:'absolute', inset:-6, borderRadius:'50%', background:'radial-gradient(circle,rgba(180,120,0,0.3) 0%,transparent 70%)', filter:'blur(8px)' }}/>
              <div style={{ position:'relative', background:'linear-gradient(145deg,#1a1400,#2a2000)', borderRadius:'50%', padding:6, border:'2px solid rgba(180,120,0,0.4)', boxShadow:'0 0 20px rgba(180,120,0,0.2)' }}>
                <LogoPreview shape={club?.logo?.shape||'shield'} icon={club?.logo?.icon||'⚽'} bgColor={club?.logo?.bg||'#7c3aed'} accentColor={club?.logo?.accent||'#fbbf24'} size={70}/>
              </div>
            </div>

            {/* Seviye */}
            <div style={{ textAlign:'center' }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:13, letterSpacing:2, color:'rgba(200,160,0,0.9)' }}>SEVİYE 1: Acemi</div>
              <div style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:10, color:'rgba(255,255,255,0.3)', letterSpacing:1 }}>MENAJER PROFİLİ</div>
            </div>

            {/* Taktik Bonus Kutusu */}
            {managerStyleObj && (
              <div style={{ width:'100%', background:'rgba(0,0,0,0.4)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, padding:'.75rem', position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,transparent,${managerStyleObj.color},transparent)` }}/>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                  <span style={{ fontSize:16 }}>{managerStyleObj.emoji}</span>
                  <div>
                    <div style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:10, color:'rgba(255,255,255,0.4)', letterSpacing:1 }}>Taktik Bonusu:</div>
                    <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:13, letterSpacing:1, color:managerStyleObj.color }}>{managerStyleObj.name.toUpperCase()}</div>
                  </div>
                </div>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:18, color:'#4ade80', letterSpacing:1 }}>+5 Atak</div>
                {/* Bar göstergesi */}
                <div style={{ display:'flex', gap:2, marginTop:4 }}>
                  {[managerStyleObj.color,managerStyleObj.color,managerStyleObj.color,'#1e1e1e','#1e1e1e'].map((c,i)=>(
                    <div key={i} style={{ flex:1, height:4, borderRadius:2, background:c }}/>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ORTA PANEL */}
          <div style={{ padding:'1.75rem 1.5rem', display:'flex', flexDirection:'column', gap:'1.1rem' }}>

            {/* Başlık */}
            <div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:26, letterSpacing:3, color:'#fff', lineHeight:1, marginBottom:2 }}>
                {club?.clubName || 'SEVİYE 1: Acemi'}
              </div>
              <div style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:11, color:'rgba(255,255,255,0.3)', letterSpacing:2 }}>MENAJER PROFİLİ</div>
              {managerStyleObj && (
                <div style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:12, color:managerStyleObj.color, marginTop:4 }}>
                  {managerStyleObj.emoji} {managerStyleObj.name} · {managerStyleObj.desc}
                </div>
              )}
            </div>

            {/* Taktik + Bütçe */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'.65rem' }}>
              <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:8, padding:'.65rem .85rem' }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:9, letterSpacing:2, color:'rgba(255,255,255,0.25)', marginBottom:4 }}>TAKTİKSEL BAKIŞ</div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:18 }}>📋</span>
                  <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:15, letterSpacing:1, color:'rgba(255,255,255,0.85)' }}>DİZİLİŞ: {club?.formation||'4-4-2'}</span>
                </div>
              </div>
              <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:8, padding:'.65rem .85rem' }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:9, letterSpacing:2, color:'rgba(255,255,255,0.25)', marginBottom:4 }}>TRANSFER BÜTÇESİ</div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:18 }}>💰</span>
                  <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:15, letterSpacing:1, color:'rgba(255,255,255,0.85)' }}>{club?.budget >= 999999999999 ? '∞ (Sınırsız)' : `€${(club?.budget/1e6)||500}M`}</span>
                </div>
              </div>
            </div>

            {/* Ayırıcı */}
            <div style={{ height:1, background:'linear-gradient(90deg,transparent,rgba(124,58,237,0.3),transparent)' }}/>

            {/* Butonlar */}
            <div style={{ display:'flex', flexDirection:'column', gap:'.6rem' }}>
              <button onClick={handleCreateLobby} disabled={loading}
                style={{ padding:'.9rem', borderRadius:9, border:'none', background:'linear-gradient(135deg,#5b21b6,#7c3aed,#8b5cf6)', color:'#fff', fontFamily:"'Bebas Neue',sans-serif", fontSize:16, letterSpacing:3, cursor:'pointer', position:'relative', overflow:'hidden', boxShadow:'0 6px 20px rgba(124,58,237,0.4)' }}>
                <div style={{ position:'absolute', top:0, left:'-100%', width:'60%', height:'100%', background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent)', animation:'shimmer 2.5s ease-in-out infinite' }}/>
                {loading ? 'OLUŞTURULUYOR...' : '⚽ YENİ LOBİ OLUŞTUR'}
              </button>

              {!showJoin ? (
                <button onClick={() => setShowJoin(true)}
                  style={{ padding:'.75rem', borderRadius:9, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.45)', fontFamily:"'Bebas Neue',sans-serif", fontSize:13, letterSpacing:2, cursor:'pointer' }}>
                  🔗 Lobiye Katıl
                </button>
              ) : (
                <div style={{ background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:9, padding:'.85rem', display:'flex', flexDirection:'column', gap:'.5rem' }}>
                  <input className="input" placeholder="LOBİ KODU" value={lobbyCode} onChange={e=>setLobbyCode(e.target.value.toUpperCase())} maxLength={6}
                    style={{ letterSpacing:'.25em', fontWeight:700, textAlign:'center', textTransform:'uppercase', fontSize:'1rem', fontFamily:"'Bebas Neue',sans-serif" }}/>
                  {joinError && <p style={{ color:'#ef4444', fontSize:'.75rem', textAlign:'center', margin:0 }}>{joinError}</p>}
                  <div style={{ display:'flex', gap:'.5rem' }}>
                    <button onClick={() => setShowJoin(false)}
                      style={{ flex:1, padding:'.65rem', borderRadius:7, border:'1px solid rgba(255,255,255,0.08)', background:'transparent', color:'rgba(255,255,255,0.3)', fontFamily:"'Bebas Neue',sans-serif", fontSize:12, letterSpacing:1, cursor:'pointer' }}>
                      İPTAL
                    </button>
                    <button onClick={handleJoin} disabled={loading}
                      style={{ flex:2, padding:'.65rem', borderRadius:7, border:'none', background:'linear-gradient(135deg,#5b21b6,#7c3aed)', color:'#fff', fontFamily:"'Bebas Neue',sans-serif", fontSize:13, letterSpacing:2, cursor:'pointer' }}>
                      {loading ? 'KATILIYOR...' : 'KATIL →'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <p style={{ fontFamily:"'Rajdhani',sans-serif", color:'rgba(255,255,255,0.2)', fontSize:11, letterSpacing:0.5, margin:0, textAlign:'center' }}>
              Kulüp ve Taktikleri Değiştirmek için <strong style={{ color:'rgba(255,255,255,0.4)' }}>Düzenle</strong> Bölümünü Kullanın.
            </p>
          </div>

          {/* SAĞ PANEL: Kit stand */}
          <div style={{ background:'rgba(0,0,0,0.25)', borderLeft:'1px solid rgba(180,120,0,0.15)', padding:'1.75rem 1rem', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'.75rem' }}>
            
            {/* Kit 3D görünüm */}
            <div style={{ position:'relative', display:'flex', flexDirection:'column', alignItems:'center' }}>
              <KitPreview primary={club?.kit?.primary||'#dc2626'} secondary={club?.kit?.secondary||'#fbbf24'} pattern={club?.kit?.pattern||'solid'} size={90}/>
              {/* Stand */}
              <div style={{ width:50, height:3, background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)', borderRadius:2, marginTop:4 }}/>
              <div style={{ width:20, height:6, background:'rgba(255,255,255,0.08)', borderRadius:'50%', marginTop:2 }}/>
              {/* Gölge */}
              <div style={{ position:'absolute', bottom:-2, left:'15%', right:'15%', height:8, background:'rgba(0,0,0,0.4)', borderRadius:'50%', filter:'blur(4px)', zIndex:-1 }}/>
            </div>

            <div style={{ textAlign:'center' }}>
              <button onClick={() => setEditing(true)}
                style={{ display:'flex', alignItems:'center', gap:4, background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:6, padding:'5px 12px', color:'rgba(255,255,255,0.55)', fontFamily:"'Rajdhani',sans-serif", fontSize:12, fontWeight:600, cursor:'pointer', letterSpacing:0.5 }}>
                ✏️ Düzenle
              </button>
              <div style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:9, color:'rgba(255,255,255,0.2)', letterSpacing:1, marginTop:3 }}>Özelleştir</div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}