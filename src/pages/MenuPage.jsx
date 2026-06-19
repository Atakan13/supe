import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function getUserId() {
  let id = localStorage.getItem('draft_user_id')
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('draft_user_id', id) }
  return id
}

const MANAGER_STYLES = [
  { id: 'aggressive', name: 'Agresif', emoji: '⚡', desc: 'Atak statlarına +5 bonus', bonusStat: 'shooting', bonus: 5, color: '#ef4444' },
  { id: 'defensive',  name: 'Defansif', emoji: '🛡️', desc: 'Defans statlarına +5 bonus', bonusStat: 'defending', bonus: 5, color: '#3b82f6' },
  { id: 'possession', name: 'Tiki-Taka', emoji: '🎯', desc: 'Pas statlarına +5 bonus', bonusStat: 'passing', bonus: 5, color: '#10b981' },
  { id: 'counter',    name: 'Kontra',   emoji: '💨', desc: 'Hız statlarına +5 bonus', bonusStat: 'pace', bonus: 5, color: '#f59e0b' },
  { id: 'physical',   name: 'Fiziksel', emoji: '💪', desc: 'Fizik statlarına +5 bonus', bonusStat: 'physical', bonus: 5, color: '#8b5cf6' },
  { id: 'technical',  name: 'Teknik',   emoji: '🎨', desc: 'Çalım statlarına +5 bonus', bonusStat: 'dribbling', bonus: 5, color: '#ec4899' },
]

const BUDGETS = [
  { label: '€100M', value: 100000000 },
  { label: '€300M', value: 300000000 },
  { label: '€600M', value: 600000000 },
  { label: 'Sınırsız', value: 999999999999 },
]

const LEAGUES = [
  { id: 'all', name: 'Tüm Ligler', flag: '🌍', active: true },
  { id: 'premier', name: 'Premier Lig', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', active: false },
  { id: 'laliga', name: 'La Liga', flag: '🇪🇸', active: false },
  { id: 'bundesliga', name: 'Bundesliga', flag: '🇩🇪', active: false },
  { id: 'seriea', name: 'Serie A', flag: '🇮🇹', active: false },
  { id: 'superlig', name: 'Süper Lig', flag: '🇹🇷', active: false },
]

const LOGO_SHAPES = ['circle', 'shield', 'diamond', 'hexagon', 'square']
const LOGO_ICONS = ['⚽','🦁','🐯','🦅','🐺','🦊','🐻','⭐','🔥','💎','⚔️','🏆','👑','🌙','⚡']
const LOGO_BG_COLORS = ['#7c3aed','#2563eb','#dc2626','#16a34a','#d97706','#0891b2','#db2777','#4f46e5','#059669','#b45309']
const LOGO_ACCENT_COLORS = ['#fbbf24','#ffffff','#f87171','#86efac','#93c5fd','#c4b5fd','#fdba74','#6ee7b7','#fde68a','#bfdbfe']

const KIT_COLORS = ['#7c3aed','#2563eb','#dc2626','#16a34a','#d97706','#0891b2','#db2777','#1f2937','#ffffff','#f59e0b','#10b981','#ef4444']
const KIT_PATTERNS = [
  { id: 'solid', name: 'Düz' },
  { id: 'stripes', name: 'Çizgili' },
  { id: 'halves', name: 'İki Renk' },
  { id: 'hoops', name: 'Halka' },
  { id: 'quarters', name: 'Çeyrek' },
]

function LogoPreview({ shape, icon, bgColor, accentColor, size = 80 }) {
  const s = size
  const getShapePath = () => {
    switch(shape) {
      case 'shield': return `M${s/2},${s*0.05} L${s*0.9},${s*0.25} L${s*0.9},${s*0.6} Q${s*0.9},${s*0.85} ${s/2},${s*0.95} Q${s*0.1},${s*0.85} ${s*0.1},${s*0.6} L${s*0.1},${s*0.25} Z`
      case 'diamond': return `M${s/2},${s*0.05} L${s*0.92},${s/2} L${s/2},${s*0.95} L${s*0.08},${s/2} Z`
      case 'hexagon': return `M${s/2},${s*0.05} L${s*0.88},${s*0.27} L${s*0.88},${s*0.73} L${s/2},${s*0.95} L${s*0.12},${s*0.73} L${s*0.12},${s*0.27} Z`
      case 'square': return `M${s*0.08},${s*0.08} L${s*0.92},${s*0.08} L${s*0.92},${s*0.92} L${s*0.08},${s*0.92} Z`
      default: return null
    }
  }

  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      {shape === 'circle'
        ? <circle cx={s/2} cy={s/2} r={s*0.45} fill={bgColor} stroke={accentColor} strokeWidth={s*0.04}/>
        : <path d={getShapePath()} fill={bgColor} stroke={accentColor} strokeWidth={s*0.04}/>
      }
      <text x={s/2} y={s/2} textAnchor="middle" dominantBaseline="central" fontSize={s*0.38}>{icon}</text>
    </svg>
  )
}

function KitPreview({ primary, secondary, pattern, size = 100 }) {
  const w = size * 0.7, h = size
  const cx = size / 2

  const getPattern = () => {
    switch(pattern) {
      case 'stripes':
        return Array.from({length:5}, (_,i) => (
          <rect key={i} x={w/5*i} y={0} width={w/10} height={h} fill={secondary} opacity={0.9}/>
        ))
      case 'halves':
        return <rect x={w/2} y={0} width={w/2} height={h} fill={secondary}/>
      case 'hoops':
        return Array.from({length:4}, (_,i) => (
          <rect key={i} x={0} y={h/4*i} width={w} height={h/8} fill={secondary} opacity={0.9}/>
        ))
      case 'quarters':
        return <>
          <rect x={0} y={0} width={w/2} height={h/2} fill={secondary}/>
          <rect x={w/2} y={h/2} width={w/2} height={h/2} fill={secondary}/>
        </>
      default: return null
    }
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g transform={`translate(${(size-w)/2},0)`}>
        {/* Gövde */}
        <path d={`M${w*0.2},0 L0,${h*0.2} L0,${h*0.75} Q0,${h} ${w*0.1},${h} L${w*0.9},${h} Q${w},${h} ${w},${h*0.75} L${w},${h*0.2} L${w*0.8},0 Z`} fill={primary}/>
        {/* Desen */}
        <clipPath id="kitClip">
          <path d={`M${w*0.2},0 L0,${h*0.2} L0,${h*0.75} Q0,${h} ${w*0.1},${h} L${w*0.9},${h} Q${w},${h} ${w},${h*0.75} L${w},${h*0.2} L${w*0.8},0 Z`}/>
        </clipPath>
        <g clipPath="url(#kitClip)">{getPattern()}</g>
        {/* Yaka */}
        <path d={`M${w*0.35},0 Q${w*0.35},${h*0.12} ${w/2},${h*0.15} Q${w*0.65},${h*0.12} ${w*0.65},0`} fill="none" stroke={secondary} strokeWidth={w*0.04}/>
        {/* Kollar */}
        <path d={`M${w*0.2},0 L0,${h*0.2} L${w*0.15},${h*0.35} L${w*0.3},${h*0.15}`} fill={secondary} opacity={0.8}/>
        <path d={`M${w*0.8},0 L${w},${h*0.2} L${w*0.85},${h*0.35} L${w*0.7},${h*0.15}`} fill={secondary} opacity={0.8}/>
      </g>
    </svg>
  )
}

export default function MenuPage() {
  const navigate = useNavigate()
  const userId = getUserId()

  const [step, setStep] = useState('main') // main | create-club | create-lobby | join
  const [lobbyCode, setLobbyCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Kulüp oluşturma state
  const [clubTab, setClubTab] = useState('info') // info | logo | kit | lobby
  const [clubName, setClubName] = useState('')
  const [managerName, setManagerName] = useState('')
  const [managerStyle, setManagerStyle] = useState(null)
  const [logoShape, setLogoShape] = useState('shield')
  const [logoIcon, setLogoIcon] = useState('⚽')
  const [logoBg, setLogoBg] = useState('#7c3aed')
  const [logoAccent, setLogoAccent] = useState('#fbbf24')
  const [kitPrimary, setKitPrimary] = useState('#7c3aed')
  const [kitSecondary, setKitSecondary] = useState('#fbbf24')
  const [kitPattern, setKitPattern] = useState('solid')
  const [selectedBudget, setSelectedBudget] = useState(500000000)
  const [selectedLeague, setSelectedLeague] = useState('all')
  const [formation, setFormation] = useState('4-4-2')

  const canProceedInfo = clubName.trim() && managerName.trim() && managerStyle

  const handleCreate = async () => {
    if (!canProceedInfo) return
    setLoading(true)
    setError('')
    try {
      localStorage.setItem('draft_user_name', managerName)
      localStorage.setItem('draft_club_name', clubName)
      localStorage.setItem('draft_manager_style', managerStyle)
      localStorage.setItem('draft_logo', JSON.stringify({ shape: logoShape, icon: logoIcon, bg: logoBg, accent: logoAccent }))
      localStorage.setItem('draft_kit', JSON.stringify({ primary: kitPrimary, secondary: kitSecondary, pattern: kitPattern }))

      const { data: lobby, error: le } = await supabase.from('lobbies').insert({
        host_id: userId,
        host_name: managerName,
        formation,
        difficulty: 'medium',
        budget: selectedBudget,
        star_limit: 5,
      }).select().single()

      if (le) throw le

      await supabase.from('lobby_players').insert({
        lobby_id: lobby.id,
        user_id: userId,
        user_name: managerName,
        team_name: clubName,
        is_host: true,
        is_ready: false,
      })

      navigate(`/lobby/${lobby.code}`)
    } catch(e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async () => {
    const name = managerName.trim() || localStorage.getItem('draft_user_name')
    const team = clubName.trim() || localStorage.getItem('draft_club_name') || 'Misafir FC'
    if (!name || !lobbyCode.trim()) { setError('Menajer adı ve lobi kodu gerekli'); return }
    setLoading(true)
    setError('')
    try {
      localStorage.setItem('draft_user_name', name)
      const { data: lobbies } = await supabase.from('lobbies').select('*').ilike('code', lobbyCode.trim()).eq('status', 'waiting')
      if (!lobbies?.length) throw new Error('Lobi bulunamadı')
      const lobby = lobbies[0]
      const { error: pe } = await supabase.from('lobby_players').insert({ lobby_id: lobby.id, user_id: userId, user_name: name, team_name: team, is_host: false, is_ready: false })
      if (pe) throw pe
      navigate(`/lobby/${lobby.code}`)
    } catch(e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // ANA EKRAN
  if (step === 'main') return (
    <div style={{ minHeight:'100vh', background:'#0a0a1a', display:'flex', alignItems:'center', justifyContent:'center', padding:'2rem', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'fixed', inset:0, pointerEvents:'none', background:'radial-gradient(ellipse 60% 50% at 20% 50%,rgba(124,58,237,.15) 0%,transparent 70%),radial-gradient(ellipse 40% 60% at 80% 50%,rgba(124,58,237,.08) 0%,transparent 70%)' }}/>
      <div style={{ width:'100%', maxWidth:960, position:'relative', zIndex:1 }}>
        <div style={{ marginBottom:'3rem' }}>
          <p style={{ color:'#8b5cf6', fontSize:'.75rem', fontWeight:700, letterSpacing:'.15em', textTransform:'uppercase', marginBottom:'.5rem' }}>TEKNİK DİREKTÖR KARİYERİ</p>
          <h1 style={{ fontSize:'3rem', fontWeight:900, lineHeight:1.1, marginBottom:'1rem' }}>Kulübünü kur.<br/><span style={{ color:'#8b5cf6' }}>Sezonu yönet.</span></h1>
          <p style={{ color:'#a0a0c0', maxWidth:500 }}>Arkadaşlarınla gerçek zamanlı draft yap, kadronuzu kur ve maç motorunda mücadele et.</p>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', maxWidth:560, marginBottom:'2rem' }}>
          <div onClick={() => setStep('create-club')} style={{ background:'#12122a', border:'1px solid #1e1e4a', borderRadius:16, padding:'1.5rem', cursor:'pointer', transition:'all .2s' }}
            onMouseEnter={e=>e.currentTarget.style.borderColor='#7c3aed'} onMouseLeave={e=>e.currentTarget.style.borderColor='#1e1e4a'}>
            <div style={{ width:44, height:44, borderRadius:12, background:'#10b981', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.4rem', marginBottom:'1rem' }}>⚽</div>
            <div style={{ fontWeight:800, fontSize:'.95rem', marginBottom:'.25rem' }}>KULÜP OLUŞTUR</div>
            <div style={{ color:'#606080', fontSize:'.8rem' }}>Kendi kulübünü tasarla ve lobi kur</div>
          </div>
          <div onClick={() => setStep('join')} style={{ background:'#12122a', border:'1px solid #1e1e4a', borderRadius:16, padding:'1.5rem', cursor:'pointer', transition:'all .2s' }}
            onMouseEnter={e=>e.currentTarget.style.borderColor='#7c3aed'} onMouseLeave={e=>e.currentTarget.style.borderColor='#1e1e4a'}>
            <div style={{ width:44, height:44, borderRadius:12, background:'#3b82f6', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.4rem', marginBottom:'1rem' }}>🔗</div>
            <div style={{ fontWeight:800, fontSize:'.95rem', marginBottom:'.25rem' }}>LOBİYE KATIL</div>
            <div style={{ color:'#606080', fontSize:'.8rem' }}>Arkadaşının lobisine kod ile gir</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:'2rem' }}>
          {[['30+','OYUNCU KARTI'],['6','DİZİLİŞ'],['4','MENAJER STİLİ']].map(([v,l])=>(
            <div key={l}><div style={{ fontSize:'1.8rem', fontWeight:900 }}>{v}</div><div style={{ fontSize:'.7rem', color:'#606080', letterSpacing:'.1em', fontWeight:600 }}>{l}</div></div>
          ))}
        </div>
      </div>
    </div>
  )

  // KATIL EKRANI
  if (step === 'join') return (
    <div style={{ minHeight:'100vh', background:'#0a0a1a', display:'flex', alignItems:'center', justifyContent:'center', padding:'2rem' }}>
      <div style={{ width:'100%', maxWidth:400 }}>
        <div style={{ textAlign:'center', marginBottom:'2rem' }}>
          <p style={{ color:'#8b5cf6', fontSize:'.7rem', fontWeight:700, letterSpacing:'.15em', textTransform:'uppercase', marginBottom:'.5rem' }}>LOBİYE KATIL</p>
          <h1 style={{ fontSize:'2rem', fontWeight:900 }}>🔗 Kod ile Gir</h1>
        </div>
        <div style={{ background:'#12122a', border:'1px solid #1e1e4a', borderRadius:16, padding:'2rem', display:'flex', flexDirection:'column', gap:'.75rem' }}>
          <input className="input" placeholder="Menajer adın" value={managerName} onChange={e=>setManagerName(e.target.value)}/>
          <input className="input" placeholder="Takım adın (opsiyonel)" value={clubName} onChange={e=>setClubName(e.target.value)}/>
          <input className="input" placeholder="LOBİ KODU" value={lobbyCode} onChange={e=>setLobbyCode(e.target.value.toUpperCase())} maxLength={6} style={{ letterSpacing:'.2em', fontWeight:700, textAlign:'center', textTransform:'uppercase' }}/>
          {error && <p style={{ color:'#ef4444', fontSize:'.8rem' }}>{error}</p>}
          <button onClick={handleJoin} disabled={loading} style={{ padding:'1rem', borderRadius:10, border:'none', background:'#7c3aed', color:'#fff', fontWeight:700, fontSize:'1rem', cursor:'pointer' }}>
            {loading ? 'Katılıyor...' : 'KATIL →'}
          </button>
          <button onClick={() => setStep('main')} style={{ padding:'.75rem', borderRadius:10, border:'1px solid #2a2a5a', background:'transparent', color:'#a0a0c0', fontWeight:600, cursor:'pointer' }}>
            ← Geri
          </button>
        </div>
      </div>
    </div>
  )

  // KULÜP OLUŞTURMA EKRANI
  return (
    <div style={{ minHeight:'100vh', background:'#0a0a1a', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'2rem' }}>
      <div style={{ width:'100%', maxWidth:700 }}>

        {/* Başlık */}
        <div style={{ textAlign:'center', marginBottom:'1.5rem' }}>
          <p style={{ color:'#8b5cf6', fontSize:'.7rem', fontWeight:700, letterSpacing:'.15em', textTransform:'uppercase', marginBottom:'.5rem' }}>KULÜP OLUŞTUR</p>
          <h1 style={{ fontSize:'2rem', fontWeight:900 }}>Kulübünü Tasarla ⚽</h1>
        </div>

        {/* Sekme Nav */}
        <div style={{ display:'flex', background:'#0f0f2a', borderRadius:12, padding:'.25rem', marginBottom:'1.5rem', gap:'.25rem' }}>
          {[['info','📋 Bilgiler'],['logo','🎨 Logo'],['kit','👕 Forma'],['lobby','⚙️ Lobi']].map(([tab, label]) => (
            <button key={tab} onClick={() => setClubTab(tab)}
              style={{ flex:1, padding:'.6rem', borderRadius:9, border:'none', background: clubTab===tab ? '#7c3aed' : 'transparent', color: clubTab===tab ? '#fff' : '#606080', fontWeight:700, fontSize:'.78rem', cursor:'pointer', transition:'all .15s' }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ background:'#12122a', border:'1px solid #1e1e4a', borderRadius:16, padding:'1.75rem' }}>

          {/* BİLGİLER SEKMESİ */}
          {clubTab === 'info' && (
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
                      style={{ padding:'.85rem', borderRadius:12, border:`2px solid ${managerStyle===style.id ? style.color : '#1e1e4a'}`, background: managerStyle===style.id ? `${style.color}20` : '#0f0f2a', cursor:'pointer', transition:'all .15s' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'.6rem', marginBottom:'.35rem' }}>
                        <span style={{ fontSize:'1.2rem' }}>{style.emoji}</span>
                        <span style={{ fontWeight:800, fontSize:'.85rem', color: managerStyle===style.id ? style.color : '#fff' }}>{style.name}</span>
                      </div>
                      <div style={{ fontSize:'.72rem', color:'#606080' }}>{style.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={() => setClubTab('logo')} disabled={!canProceedInfo}
                style={{ padding:'1rem', borderRadius:10, border:'none', background: canProceedInfo ? '#7c3aed' : '#1e1e4a', color: canProceedInfo ? '#fff' : '#606080', fontWeight:700, cursor: canProceedInfo ? 'pointer' : 'not-allowed', transition:'all .2s' }}>
                Sonraki: Logo Tasarla →
              </button>
            </div>
          )}

          {/* LOGO SEKMESİ */}
          {clubTab === 'logo' && (
            <div style={{ display:'flex', gap:'2rem' }}>
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'1.25rem' }}>
                <div>
                  <label style={{ display:'block', fontSize:'.75rem', fontWeight:700, color:'#a0a0c0', letterSpacing:'.08em', marginBottom:'.6rem' }}>LOGO ŞEKLİ</label>
                  <div style={{ display:'flex', gap:'.5rem', flexWrap:'wrap' }}>
                    {LOGO_SHAPES.map(s => (
                      <button key={s} onClick={() => setLogoShape(s)}
                        style={{ padding:'.4rem .85rem', borderRadius:8, border:`2px solid ${logoShape===s?'#7c3aed':'#2a2a5a'}`, background: logoShape===s?'rgba(124,58,237,.2)':'#0f0f2a', color: logoShape===s?'#a78bfa':'#606080', fontWeight:700, fontSize:'.75rem', cursor:'pointer', textTransform:'capitalize' }}>
                        {s === 'circle' ? 'Daire' : s === 'shield' ? 'Kalkan' : s === 'diamond' ? 'Elmas' : s === 'hexagon' ? 'Altıgen' : 'Kare'}
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
                  <label style={{ display:'block', fontSize:'.75rem', fontWeight:700, color:'#a0a0c0', letterSpacing:'.08em', marginBottom:'.6rem' }}>KENARLIK / VURGu RENGİ</label>
                  <div style={{ display:'flex', gap:'.4rem', flexWrap:'wrap' }}>
                    {LOGO_ACCENT_COLORS.map(c => (
                      <button key={c} onClick={() => setLogoAccent(c)}
                        style={{ width:30, height:30, borderRadius:'50%', background:c, border:`3px solid ${logoAccent===c?'#fff':'transparent'}`, cursor:'pointer' }}/>
                    ))}
                  </div>
                </div>
              </div>

              {/* Logo Preview */}
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'1rem', minWidth:160 }}>
                <div style={{ background:'#0f0f2a', borderRadius:16, padding:'1.5rem', border:'1px solid #2a2a5a', display:'flex', flexDirection:'column', alignItems:'center', gap:'.75rem' }}>
                  <LogoPreview shape={logoShape} icon={logoIcon} bgColor={logoBg} accentColor={logoAccent} size={100}/>
                  <div style={{ fontWeight:800, fontSize:'.85rem', textAlign:'center', maxWidth:130, wordBreak:'break-word' }}>{clubName || 'Kulüp Adı'}</div>
                </div>
                <button onClick={() => setClubTab('kit')}
                  style={{ width:'100%', padding:'.75rem', borderRadius:10, border:'none', background:'#7c3aed', color:'#fff', fontWeight:700, cursor:'pointer' }}>
                  Sonraki: Forma →
                </button>
              </div>
            </div>
          )}

          {/* FORMA SEKMESİ */}
          {clubTab === 'kit' && (
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

              {/* Forma Preview */}
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'1rem', minWidth:160 }}>
                <div style={{ background:'#0f0f2a', borderRadius:16, padding:'1.5rem', border:'1px solid #2a2a5a', display:'flex', flexDirection:'column', alignItems:'center', gap:'.75rem' }}>
                  <KitPreview primary={kitPrimary} secondary={kitSecondary} pattern={kitPattern} size={110}/>
                  <div style={{ fontWeight:700, fontSize:'.8rem' }}>İç Saha Forması</div>
                </div>
                <button onClick={() => setClubTab('lobby')}
                  style={{ width:'100%', padding:'.75rem', borderRadius:10, border:'none', background:'#7c3aed', color:'#fff', fontWeight:700, cursor:'pointer' }}>
                  Sonraki: Lobi Ayarları →
                </button>
              </div>
            </div>
          )}

          {/* LOBİ AYARLARI SEKMESİ */}
          {clubTab === 'lobby' && (
            <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
              <div>
                <label style={{ display:'block', fontSize:'.75rem', fontWeight:700, color:'#a0a0c0', letterSpacing:'.08em', marginBottom:'.75rem' }}>DİZİLİŞ</label>
                <div style={{ display:'flex', gap:'.5rem', flexWrap:'wrap' }}>
                  {['4-4-2','4-3-3','3-5-2','4-2-3-1','5-3-2','3-4-3'].map(f => (
                    <button key={f} onClick={() => setFormation(f)}
                      style={{ padding:'.5rem 1rem', borderRadius:8, border:`2px solid ${formation===f?'#7c3aed':'#2a2a5a'}`, background: formation===f?'rgba(124,58,237,.2)':'#0f0f2a', color: formation===f?'#a78bfa':'#606080', fontWeight:700, fontSize:'.82rem', cursor:'pointer' }}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display:'block', fontSize:'.75rem', fontWeight:700, color:'#a0a0c0', letterSpacing:'.08em', marginBottom:'.75rem' }}>TRANSFER BÜTÇESİ</label>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'.6rem' }}>
                  {BUDGETS.map(b => (
                    <div key={b.value} onClick={() => setSelectedBudget(b.value)}
                      style={{ padding:'1rem', borderRadius:12, border:`2px solid ${selectedBudget===b.value?'#7c3aed':'#1e1e4a'}`, background: selectedBudget===b.value?'rgba(124,58,237,.2)':'#0f0f2a', cursor:'pointer', textAlign:'center', transition:'all .15s' }}>
                      <div style={{ fontWeight:800, fontSize:'1.1rem', color: selectedBudget===b.value?'#a78bfa':'#fff' }}>{b.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display:'block', fontSize:'.75rem', fontWeight:700, color:'#a0a0c0', letterSpacing:'.08em', marginBottom:'.5rem' }}>
                  LİG SEÇİMİ <span style={{ color:'#606080', fontWeight:400, textTransform:'none', letterSpacing:0 }}>(yakında aktif olacak)</span>
                </label>
                <div style={{ display:'flex', flexDirection:'column', gap:'.4rem' }}>
                  {LEAGUES.map(lg => (
                    <div key={lg.id} onClick={() => lg.active && setSelectedLeague(lg.id)}
                      style={{ padding:'.75rem 1rem', borderRadius:10, border:`1px solid ${selectedLeague===lg.id?'#7c3aed':'#1e1e4a'}`, background: selectedLeague===lg.id?'rgba(124,58,237,.15)':'#0f0f2a', display:'flex', alignItems:'center', gap:'.75rem', cursor: lg.active ? 'pointer' : 'not-allowed', opacity: lg.active ? 1 : .45 }}>
                      <span style={{ fontSize:'1.1rem' }}>{lg.flag}</span>
                      <span style={{ fontWeight:600, fontSize:'.85rem' }}>{lg.name}</span>
                      {!lg.active && <span style={{ marginLeft:'auto', background:'#1e1e4a', color:'#606080', fontSize:'.6rem', fontWeight:700, padding:'.15rem .4rem', borderRadius:4, letterSpacing:'.05em' }}>YAKINDA</span>}
                      {lg.active && selectedLeague===lg.id && <span style={{ marginLeft:'auto', color:'#10b981', fontSize:'.8rem' }}>✓</span>}
                    </div>
                  ))}
                </div>
              </div>

              {error && <p style={{ color:'#ef4444', fontSize:'.85rem' }}>{error}</p>}

              <button onClick={handleCreate} disabled={loading || !canProceedInfo}
                style={{ padding:'1.1rem', borderRadius:12, border:'none', background: canProceedInfo ? '#7c3aed' : '#1e1e4a', color: canProceedInfo ? '#fff' : '#606080', fontWeight:800, fontSize:'1rem', cursor: canProceedInfo && !loading ? 'pointer' : 'not-allowed', transition:'all .2s' }}>
                {loading ? 'Oluşturuluyor...' : '🚀 LOBİYİ OLUŞTUR'}
              </button>
            </div>
          )}
        </div>

        {/* Geri butonu */}
        <button onClick={() => step === 'create-club' ? setStep('main') : setStep('main')}
          style={{ marginTop:'1rem', width:'100%', padding:'.75rem', borderRadius:10, border:'1px solid #2a2a5a', background:'transparent', color:'#606080', fontWeight:600, cursor:'pointer' }}>
          ← Ana Menüye Dön
        </button>
      </div>
    </div>
  )
}
