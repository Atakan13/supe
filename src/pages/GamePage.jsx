import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getClub } from '../lib/club'
import { PLAYER_CARDS } from '../lib/playerCards'

function getUserId() {
  let id = localStorage.getItem('draft_user_id')
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('draft_user_id', id) }
  return id
}

function LogoMini({ logo, size = 32 }) {
  if (!logo) return <div style={{ width:size, height:size, borderRadius:'50%', background:'#7c3aed', display:'flex', alignItems:'center', justifyContent:'center', fontSize:size*.4 }}>⚽</div>
  const s = size
  const getPath = () => {
    switch(logo.shape) {
      case 'shield': return `M${s/2},${s*.05} L${s*.9},${s*.25} L${s*.9},${s*.6} Q${s*.9},${s*.85} ${s/2},${s*.95} Q${s*.1},${s*.85} ${s*.1},${s*.6} L${s*.1},${s*.25} Z`
      case 'diamond': return `M${s/2},${s*.05} L${s*.92},${s/2} L${s/2},${s*.95} L${s*.08},${s/2} Z`
      case 'hexagon': return `M${s/2},${s*.05} L${s*.88},${s*.27} L${s*.88},${s*.73} L${s/2},${s*.95} L${s*.12},${s*.73} L${s*.12},${s*.27} Z`
      case 'square': return `M${s*.08},${s*.08} L${s*.92},${s*.08} L${s*.92},${s*.92} L${s*.08},${s*.92} Z`
      default: return null
    }
  }
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      {logo.shape==='circle'
        ? <circle cx={s/2} cy={s/2} r={s*.45} fill={logo.bg} stroke={logo.accent} strokeWidth={s*.04}/>
        : <path d={getPath()} fill={logo.bg} stroke={logo.accent} strokeWidth={s*.04}/>}
      <text x={s/2} y={s/2} textAnchor="middle" dominantBaseline="central" fontSize={s*.38}>{logo.icon}</text>
    </svg>
  )
}

const TACTICS_CONFIG = {
  pressing:      { label:'PRES',             icon:'⚡', options:[{id:'gegenpressing',name:'Gegenpressing',statBonus:{defending:8,pace:5}},{id:'high_press',name:'Yüksek Pres',statBonus:{defending:5,physical:3}},{id:'mid_press',name:'Orta Pres',statBonus:{defending:2}},{id:'low_block',name:'Alçak Blok',statBonus:{defending:10,shooting:-3}}]},
  tempo:         { label:'TEMPO',            icon:'🏃', options:[{id:'fast',name:'Yüksek Tempo',statBonus:{pace:8,passing:3}},{id:'normal',name:'Normal',statBonus:{}},{id:'slow',name:'Düşük Tempo',statBonus:{passing:8,dribbling:5}}]},
  attack_width:  { label:'HÜCUM',            icon:'↔️', options:[{id:'wide',name:'Kanatlardan',statBonus:{dribbling:6}},{id:'central',name:'Ortadan',statBonus:{shooting:6,passing:4}},{id:'mixed',name:'Karma',statBonus:{passing:3}}]},
  defense_line:  { label:'SAVUNMA HATTI',    icon:'🛡️', options:[{id:'high',name:'Yüksek Hat',statBonus:{defending:5,pace:-3}},{id:'standard',name:'Normal Hat',statBonus:{defending:2}},{id:'deep',name:'Alçak Hat',statBonus:{defending:8,shooting:-5}}]},
  buildup:       { label:'OYUN TARZI',       icon:'🎯', options:[{id:'short',name:'Kısa Pas',statBonus:{passing:10,dribbling:5}},{id:'direct',name:'Direkt Oyun',statBonus:{shooting:5,physical:5}},{id:'counter',name:'Kontratak',statBonus:{pace:10,shooting:5}}]},
  set_piece:     { label:'DURAN TOP',        icon:'🚩', options:[{id:'short',name:'Kısa',statBonus:{passing:5}},{id:'long',name:'Uzun Top',statBonus:{physical:8}}]},
}

const PLAYER_ROLES = {
  GK:  [{id:'sweeper_keeper',name:'Sweeper Keeper',statBonus:{pace:10,passing:8}},{id:'classic_gk',name:'Klasik Kaleci',statBonus:{goalkeeper:5}}],
  CB:  [{id:'ball_playing',name:'Ball-Playing Def.',statBonus:{passing:8,dribbling:5}},{id:'stopper',name:'Stopper',statBonus:{defending:8,physical:5}},{id:'libero',name:'Libero',statBonus:{dribbling:8,passing:6}}],
  LB:  [{id:'wing_back',name:'Wing Back',statBonus:{pace:8,dribbling:6}},{id:'full_back',name:'Full Back',statBonus:{defending:5,passing:5}},{id:'inverted_wb',name:'Inverted WB',statBonus:{shooting:8,dribbling:6}}],
  RB:  [{id:'wing_back',name:'Wing Back',statBonus:{pace:8,dribbling:6}},{id:'full_back',name:'Full Back',statBonus:{defending:5,passing:5}},{id:'inverted_wb',name:'Inverted WB',statBonus:{shooting:8,dribbling:6}}],
  CDM: [{id:'anchor',name:'Anchor Man',statBonus:{defending:10}},{id:'dlp',name:'Deep Lying PM',statBonus:{passing:10,dribbling:5}},{id:'bwm',name:'Ball Winning Mid',statBonus:{defending:8,physical:8}}],
  CM:  [{id:'box_to_box',name:'Box to Box',statBonus:{physical:8,shooting:5}},{id:'carrilero',name:'Carrilero',statBonus:{passing:8,defending:5}},{id:'mezzala',name:'Mezzala',statBonus:{shooting:8,dribbling:6}}],
  CAM: [{id:'trequartista',name:'Trequartista',statBonus:{dribbling:10,shooting:8}},{id:'shadow_striker',name:'Shadow Striker',statBonus:{shooting:10,pace:5}},{id:'adv_playmaker',name:'Adv. Playmaker',statBonus:{passing:10,dribbling:6}}],
  LM:  [{id:'winger',name:'Winger',statBonus:{pace:10,dribbling:6}},{id:'inside_forward',name:'Inside Forward',statBonus:{shooting:10,dribbling:8}},{id:'wide_pm',name:'Wide Playmaker',statBonus:{passing:10,dribbling:5}}],
  RM:  [{id:'winger',name:'Winger',statBonus:{pace:10,dribbling:6}},{id:'inside_forward',name:'Inside Forward',statBonus:{shooting:10,dribbling:8}},{id:'wide_pm',name:'Wide Playmaker',statBonus:{passing:10,dribbling:5}}],
  LW:  [{id:'winger',name:'Winger',statBonus:{pace:10,dribbling:6}},{id:'inside_forward',name:'Inside Forward',statBonus:{shooting:10,dribbling:8}}],
  RW:  [{id:'winger',name:'Winger',statBonus:{pace:10,dribbling:6}},{id:'inside_forward',name:'Inside Forward',statBonus:{shooting:10,dribbling:8}}],
  ST:  [{id:'advanced_forward',name:'Advanced Forward',statBonus:{pace:8,shooting:6}},{id:'target_man',name:'Target Man',statBonus:{physical:10,shooting:5}},{id:'poacher',name:'Poacher',statBonus:{shooting:12}},{id:'dlf',name:'Deep Lying Fwd',statBonus:{passing:8,dribbling:6}}],
  CF:  [{id:'advanced_forward',name:'Advanced Forward',statBonus:{pace:8,shooting:6}},{id:'poacher',name:'Poacher',statBonus:{shooting:12}}],
}

const FORMATION_POSITIONS = {
  '4-4-2':   [['GK',[50,90]],['LB',[12,68]],['CB',[35,68]],['CB',[65,68]],['RB',[88,68]],['LM',[12,45]],['CM',[35,45]],['CM',[65,45]],['RM',[88,45]],['ST',[35,18]],['ST',[65,18]]],
  '4-3-3':   [['GK',[50,90]],['LB',[12,68]],['CB',[35,68]],['CB',[65,68]],['RB',[88,68]],['CM',[25,48]],['CM',[50,42]],['CM',[75,48]],['LW',[15,18]],['ST',[50,12]],['RW',[85,18]]],
  '4-2-3-1': [['GK',[50,90]],['LB',[12,68]],['CB',[35,68]],['CB',[65,68]],['RB',[88,68]],['CDM',[32,55]],['CDM',[68,55]],['LM',[15,38]],['CAM',[50,35]],['RM',[85,38]],['ST',[50,14]]],
  '3-5-2':   [['GK',[50,90]],['CB',[25,70]],['CB',[50,68]],['CB',[75,70]],['LM',[8,48]],['CM',[30,45]],['CDM',[50,52]],['CM',[70,45]],['RM',[92,48]],['ST',[35,16]],['ST',[65,16]]],
  '5-3-2':   [['GK',[50,90]],['LB',[8,72]],['CB',[28,68]],['CB',[50,66]],['CB',[72,68]],['RB',[92,72]],['CM',[28,46]],['CM',[50,42]],['CM',[72,46]],['ST',[35,16]],['ST',[65,16]]],
  '3-4-3':   [['GK',[50,90]],['CB',[25,70]],['CB',[50,68]],['CB',[75,70]],['LM',[10,50]],['CM',[35,46]],['CM',[65,46]],['RM',[90,50]],['LW',[18,16]],['ST',[50,10]],['RW',[82,16]]],
}

// Mevkiye göre en uygun oyuncuyu seç
function getBestPlayerForPos(pos, players, usedNames) {
  const posGroups = {
    GK:  ['GK'],
    CB:  ['CB'],
    LB:  ['LB','CB'],
    RB:  ['RB','CB'],
    CDM: ['CDM','CM'],
    CM:  ['CM','CDM','CAM'],
    CAM: ['CAM','CM'],
    LM:  ['LM','LW','RM'],
    RM:  ['RM','RW','LM'],
    LW:  ['LW','LM','RM'],
    RW:  ['RW','RM','LM'],
    ST:  ['ST','CF'],
    CF:  ['CF','ST'],
  }
  // #9 - hem squad_pos hem position'a bak
  const preferred = posGroups[pos] || [pos]
  const available = players.filter(p => !usedNames.has(p.name))
  for (const pref of preferred) {
    // #9 - squad_pos ve position her ikisine bak
    const found = available.filter(p => (p.squad_pos||p.position) === pref || p.position === pref).sort((a,b) => b.overall - a.overall)
    if (found.length > 0) return found[0]
  }
  return available.sort((a,b) => b.overall - a.overall)[0] || null
}

// Otomatik diz
function autoArrange(players, formation) {
  const slots = FORMATION_POSITIONS[formation] || FORMATION_POSITIONS['4-4-2']
  const used = new Set()
  const squadLineup = slots.map(([pos]) => {
    const player = getBestPlayerForPos(pos, players, used)
    if (player) used.add(player.name)
    return player || null
  })
  const bench = players.filter(p => !used.has(p.name)).slice(0, 7)
  const unassigned = players.filter(p => !used.has(p.name) && !bench.find(b => b.name === p.name))
  return { squadLineup, bench, unassigned }
}

const NEWS_TEMPLATES = [
  (a, b) => `${a} bu hafta ${b} ile karşılaşıyor!`,
  (a, b) => `${a} - ${b} maçı öncesi heyecan tavan yaptı!`,
  (a) => `${a} antrenmanlarını tamamladı, hazır!`,
  (a, b) => `${b} teknik direktörü: "${a} maçı çok kritik"`,
  (a) => `${a} bu sezon büyük bir performans sergiliyor!`,
  (a, b) => `${a} ve ${b} arasındaki güç savaşı kızışıyor!`,
]

export default function GamePage() {
  const { code } = useParams()
  const navigate = useNavigate()
  const userId = getUserId()
  const club = getClub()

  const [lobby, setLobby] = useState(null)
  const [lobbyPlayers, setLobbyPlayers] = useState([])
  const [standingsData, setStandingsData] = useState([])
  const [activeTab, setActiveTab] = useState('home')
  const [matchReady, setMatchReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [news, setNews] = useState([])
  const [saving, setSaving] = useState(false)

  const [squadLineup, setSquadLineup] = useState(Array(11).fill(null))
  const [bench, setBench] = useState([])
  const [unassigned, setUnassigned] = useState([])
  const [tactics, setTactics] = useState({ pressing:'high_press', tempo:'normal', attack_width:'mixed', defense_line:'standard', buildup:'short', set_piece:'long' })
  const [playerRoles, setPlayerRoles] = useState({})
  const [draggedPlayer, setDraggedPlayer] = useState(null)
  const [dragSource, setDragSource] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [selectedPlayerForRole, setSelectedPlayerForRole] = useState(null)
  const [formation, setFormation] = useState('4-4-2')
  const [allMyPlayers, setAllMyPlayers] = useState([])

  const channelRef = useRef(null)
  const lobbyRef = useRef(null)
  const playersRef = useRef([])
  const isHost = lobbyPlayers.find(p => p.user_id === userId)?.is_host

  useEffect(() => { init() }, [code])

  const init = async () => {
    const { data: lb } = await supabase.from('lobbies').select('*').ilike('code', code).maybeSingle()
    if (!lb) return
    setLobby(lb)
    lobbyRef.current = lb
    setFormation(lb.formation || '4-4-2')

    const { data: pl } = await supabase.from('lobby_players').select('*').eq('lobby_id', lb.id).order('joined_at')
    setLobbyPlayers(pl || [])
    playersRef.current = pl || []

    // Draft picks'ten oyuncuları yükle
    const { data: picks } = await supabase.from('draft_picks').select('*').eq('lobby_id', lb.id).eq('picked_by', userId).order('pick_order')
    const myPlayers = (picks || []).map(p => PLAYER_CARDS.find(c => c.id === p.player_card_id)).filter(Boolean)
    setAllMyPlayers(myPlayers)

    // Kayıtlı kadro var mı?
    const { data: myS } = await supabase.from('squads').select('*').eq('lobby_id', lb.id).eq('user_id', userId).maybeSingle()
    if (myS && myS.squadLineup && myS.squadLineup.length > 0) {
      const savedLineup = [...myS.squadLineup, ...Array(11 - myS.squadLineup.length).fill(null)].slice(0, 11)
      setSquadLineup(savedLineup)
      setBench(myS.bench || [])
      if (myS.tactics) setTactics(myS.tactics)
      if (myS.player_roles) setPlayerRoles(myS.player_roles)
      const usedNames = new Set([...savedLineup.filter(Boolean), ...(myS.bench||[])].map(p => p?.name))
      setUnassigned(myPlayers.filter(p => !usedNames.has(p.name)))
    } else if (myPlayers.length > 0) {
      // Otomatik diz
      const { lineup: autoLineup, bench: autoBench, unassigned: autoUnassigned } = autoArrange(myPlayers, lb.formation || '4-4-2')
      setSquadLineup(autoLineup)
      setBench(autoBench)
      setUnassigned(autoUnassigned)
    }

    const { data: stats } = await supabase.from('season_stats').select('*').eq('lobby_id', lb.id)
    setStandingsData(stats || [])

    const teams = (pl || []).map(p => p.team_name)
    setNews(Array.from({ length: 6 }, (_, i) => ({
      id: i,
      text: NEWS_TEMPLATES[i % NEWS_TEMPLATES.length](teams[0] || 'Ev Sahibi', teams[1] || 'Deplasman'),
      time: `${i + 1} saat önce`
    })))

    setLoading(false)

    if (channelRef.current) {
      await supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
    channelRef.current = supabase.channel('game-' + lb.id)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lobbies', filter: `id=eq.${lb.id}` }, async (p) => {
        setLobby(p.new)
        lobbyRef.current = p.new
        if (p.new.match_ready_home && p.new.match_ready_away) {
          await createMatch(lb.id, playersRef.current)
        }
      })
      .subscribe()
  }

  const createMatch = async (lobbyId, players) => {
    const { data: existing } = await supabase.from('matches').select('id').eq('lobby_id', lobbyId).maybeSingle()
    if (existing) { navigate(`/match/${existing.id}`); return }
    const home = players[0], away = players[1]
    if (!home || !away) return
    const { data: match } = await supabase.from('matches').insert({
      lobby_id: lobbyId, home_user_id: home.user_id, away_user_id: away.user_id, status: 'active'
    }).select().single()
    await supabase.from('lobbies').update({ status: 'playing', match_ready_home: false, match_ready_away: false }).eq('id', lobbyId)
    if (match) navigate(`/match/${match.id}`)
  }

  const handleReadyForMatch = async () => {
    if (!lobby) return
    const newReady = !matchReady
    setMatchReady(newReady)
    // Önce kadroyu kaydet
    await saveSquadInternal()
    const field = isHost ? { match_ready_home: newReady } : { match_ready_away: newReady }
    await supabase.from('lobbies').update(field).eq('id', lobby.id)
    // Her iki taraf hazırsa maçı başlat
    const updatedLobby = { ...lobby, ...field }
    if (updatedLobby.match_ready_home && updatedLobby.match_ready_away) {
      await createMatch(lobby.id, playersRef.current)
    }
  }

  const saveSquadInternal = async () => {
    if (!lobby) return
    const formationSlots = (FORMATION_POSITIONS[formation] || FORMATION_POSITIONS['4-4-2']).filter(Boolean)
    const squadData = {
      lobby_id: lobby.id,
      user_id: userId,
      formation,
      lineup: squadLineup.map((p, i) => p ? { ...p, squad_pos: formationSlots[i]?.[0] || p.position } : null).filter(Boolean),
      bench,
      tactics,
      player_roles: playerRoles,
    }
    const { data: ex } = await supabase.from('squads').select('id').eq('lobby_id', lobby.id).eq('user_id', userId).maybeSingle()
    if (ex) await supabase.from('squads').update(squadData).eq('id', ex.id)
    else await supabase.from('squads').insert(squadData)
  }

  const saveSquad = async () => {
    setSaving(true)
    await saveSquadInternal()
    setSaving(false)
  }

  const handleFormationChange = (newFormation) => {
    setFormation(newFormation)
    // Mevcut oyuncuları yeni dizilişe göre yeniden diz
    const currentPlayers = [...squadLineup.filter(Boolean), ...bench, ...unassigned]
    const { lineup: newLineup, bench: newBench, unassigned: newUnassigned } = autoArrange(currentPlayers, newFormation)
    setSquadLineup(newLineup)
    setBench(newBench)
    setUnassigned(newUnassigned)
  }

  const handleAutoArrange = () => {
    const all = [...squadLineup.filter(Boolean), ...bench, ...unassigned]
    const { lineup: newLineup, bench: newBench, unassigned: newUnassigned } = autoArrange(all, formation)
    setSquadLineup(newLineup)
    setBench(newBench)
    setUnassigned(newUnassigned)
  }

  // Sürükle bırak
  const handleDragStart = (player, source) => {
    setDraggedPlayer(player)
    setDragSource(source)
  }

  const handleDropOnSlot = (slotIndex) => {
    if (!draggedPlayer) return
    const newLineup = [...squadLineup]
    const newBench = [...bench]
    const newUnassigned = [...unassigned]
    const existingInSlot = newLineup[slotIndex]

    if (dragSource.type === 'squadLineup') {
      newLineup[dragSource.index] = existingInSlot || null
    } else if (dragSource.type === 'bench') {
      newBench.splice(dragSource.index, 1)
      if (existingInSlot) newBench.push(existingInSlot)
    } else {
      const idx = newUnassigned.findIndex(p => p.id === draggedPlayer.id)
      if (idx > -1) newUnassigned.splice(idx, 1)
      if (existingInSlot) newUnassigned.push(existingInSlot)
    }

    newLineup[slotIndex] = draggedPlayer
    setSquadLineup(newLineup)
    setBench(newBench)
    setUnassigned(newUnassigned)
    setDraggedPlayer(null)
    setDragSource(null)
    setSelectedSlot(null)
  }

  const handleDropOnBench = () => {
    if (!draggedPlayer) return
    const newLineup = [...squadLineup]
    const newBench = [...bench]
    const newUnassigned = [...unassigned]

    if (dragSource.type === 'squadLineup') newLineup[dragSource.index] = null
    else if (dragSource.type === 'list') {
      const idx = newUnassigned.findIndex(p => p.id === draggedPlayer.id)
      if (idx > -1) newUnassigned.splice(idx, 1)
    }

    if (!newBench.find(p => p.id === draggedPlayer.id)) newBench.push(draggedPlayer)
    setSquadLineup(newLineup)
    setBench(newBench)
    setUnassigned(newUnassigned)
    setDraggedPlayer(null)
    setDragSource(null)
  }

  // Boş slota tıklayınca öneri listesi
  const handleEmptySlotClick = (slotIndex) => {
    setSelectedSlot(selectedSlot === slotIndex ? null : slotIndex)
    setSelectedPlayerForRole(null)
  }

  const handleSlotPlayerPick = (slotIndex, player) => {
    const newLineup = [...squadLineup]
    const newUnassigned = [...unassigned]
    const newBench = [...bench]
    const existing = newLineup[slotIndex]
    if (existing) newUnassigned.push(existing)
    const unIdx = newUnassigned.findIndex(p => p.id === player.id)
    if (unIdx > -1) newUnassigned.splice(unIdx, 1)
    const bIdx = newBench.findIndex(p => p.id === player.id)
    if (bIdx > -1) newBench.splice(bIdx, 1)
    newLineup[slotIndex] = player
    setSquadLineup(newLineup)
    setUnassigned(newUnassigned)
    setBench(newBench)
    setSelectedSlot(null)
  }

  const removeFromSlot = (slotIndex) => {
    const player = squadLineup[slotIndex]
    if (!player) return
    const newLineup = [...squadLineup]
    newLineup[slotIndex] = null
    setSquadLineup(newLineup)
    setUnassigned(prev => [...prev, player])
  }

  const removeFromBench = (benchIndex) => {
    const player = bench[benchIndex]
    const newBench = [...bench]
    newBench.splice(benchIndex, 1)
    setBench(newBench)
    setUnassigned(prev => [...prev, player])
  }

  const getPosColor = (pos) => {
    if (pos === 'GK') return '#1e3a5f'
    if (['CB','LB','RB'].includes(pos)) return '#1e4a2a'
    if (['CDM','CM','CAM','LM','RM'].includes(pos)) return '#3a2a1e'
    return '#3a1e1e'
  }
  const getPosTextColor = (pos) => {
    if (pos === 'GK') return '#60a5fa'
    if (['CB','LB','RB'].includes(pos)) return '#4ade80'
    if (['CDM','CM','CAM','LM','RM'].includes(pos)) return '#fb923c'
    return '#f87171'
  }

  const formationSlots = (FORMATION_POSITIONS[formation] || FORMATION_POSITIONS['4-4-2']).filter(Boolean)
  const myTeam = lobbyPlayers.find(p => p.user_id === userId)
  const opTeam = lobbyPlayers.find(p => p.user_id !== userId)

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#0a0a1a', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ color:'#a0a0c0' }}>Yükleniyor...</div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#0a0a1a', display:'flex', flexDirection:'column' }}>

      {/* TOP BAR */}
      <div style={{ background:'#0f0f2a', borderBottom:'1px solid #1e1e4a', padding:'.6rem 1.5rem', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'.75rem' }}>
          <LogoMini logo={club?.logo} size={36}/>
          <div>
            <div style={{ fontWeight:800, fontSize:'.9rem' }}>{club?.clubName || myTeam?.team_name}</div>
            <div style={{ color:'#606080', fontSize:'.7rem' }}>{formation} · {lobby?.code}</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:'1rem', alignItems:'center' }}>
          {opTeam && (
            <div style={{ display:'flex', alignItems:'center', gap:'.5rem', color:'#a0a0c0', fontSize:'.85rem' }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background: lobby?.match_ready_home && !isHost || lobby?.match_ready_away && isHost ? '#10b981' : '#f59e0b' }}/>
              {opTeam.team_name}
            </div>
          )}
          <button onClick={handleReadyForMatch}
            style={{ padding:'.5rem 1.25rem', borderRadius:8, border:'none', background:matchReady?'#10b981':'#7c3aed', color:'#fff', fontWeight:700, fontSize:'.85rem', cursor:'pointer', transition:'all .2s' }}>
            {matchReady ? '✅ Hazırım — Bekliyor' : '⚽ Maça Hazır'}
          </button>
        </div>
      </div>

      {/* NAV */}
      <div style={{ background:'#0f0f2a', borderBottom:'1px solid #1e1e4a', display:'flex', padding:'0 1.5rem' }}>
        {[['home','🏠 Ana'],['squad','👥 Kadro & Taktik'],['standingsData','🏆 Puan'],['news','📰 Haberler']].map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ padding:'.75rem 1rem', border:'none', background:'transparent', color:activeTab===tab?'#a78bfa':'#606080', fontWeight:700, fontSize:'.78rem', cursor:'pointer', borderBottom:activeTab===tab?'2px solid #7c3aed':'2px solid transparent' }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ flex:1, overflow:'hidden' }}>

        {/* ANA */}
        {activeTab === 'home' && (
          <div style={{ padding:'1.5rem', maxWidth:900, margin:'0 auto', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
            <div style={{ background:'#12122a', border:'1px solid #1e1e4a', borderRadius:14, padding:'1.25rem', gridColumn:'1/-1' }}>
              <div style={{ fontSize:'.7rem', color:'#606080', fontWeight:700, letterSpacing:'.08em', marginBottom:'1rem' }}>HAFTALIK MAÇ</div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'.75rem', flex:1 }}>
                  <LogoMini logo={club?.logo} size={48}/>
                  <div>
                    <div style={{ fontWeight:800, fontSize:'1rem' }}>{myTeam?.team_name}</div>
                    <div style={{ color:matchReady?'#10b981':'#f59e0b', fontSize:'.75rem', fontWeight:600 }}>{matchReady?'✅ Hazır':'⏳ Hazır Değil'}</div>
                  </div>
                </div>
                <div style={{ textAlign:'center', padding:'0 2rem' }}>
                  <div style={{ fontSize:'1.8rem', fontWeight:900, color:'#606080' }}>VS</div>
                  <div style={{ fontSize:'.7rem', color:'#606080' }}>İki taraf hazır olunca başlar</div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'.75rem', flex:1, justifyContent:'flex-end' }}>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontWeight:800, fontSize:'1rem' }}>{opTeam?.team_name || 'Rakip'}</div>
                    <div style={{ color:'#f59e0b', fontSize:'.75rem', fontWeight:600 }}>⏳ Bekleniyor</div>
                  </div>
                  <div style={{ width:48, height:48, borderRadius:'50%', background:'#1e1e4a', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.5rem' }}>⚽</div>
                </div>
              </div>
            </div>
            <div style={{ background:'#12122a', border:'1px solid #1e1e4a', borderRadius:14, padding:'1.25rem' }}>
              <div style={{ fontSize:'.7rem', color:'#606080', fontWeight:700, letterSpacing:'.08em', marginBottom:'1rem' }}>AKTİF TAKTİKLER</div>
              {Object.entries(tactics).map(([key, val]) => {
                const config = TACTICS_CONFIG[key]
                const opt = config?.options.find(o => o.id === val)
                return (
                  <div key={key} style={{ display:'flex', justifyContent:'space-between', marginBottom:'.5rem', fontSize:'.82rem' }}>
                    <span style={{ color:'#606080' }}>{config?.label}</span>
                    <span style={{ fontWeight:700, color:'#a78bfa' }}>{opt?.name}</span>
                  </div>
                )
              })}
            </div>
            <div style={{ background:'#12122a', border:'1px solid #1e1e4a', borderRadius:14, padding:'1.25rem' }}>
              <div style={{ fontSize:'.7rem', color:'#606080', fontWeight:700, letterSpacing:'.08em', marginBottom:'1rem' }}>SON HABERLER</div>
              {news.slice(0,3).map(n => (
                <div key={n.id} style={{ borderLeft:'2px solid #7c3aed', paddingLeft:'.75rem', marginBottom:'.75rem' }}>
                  <div style={{ fontSize:'.82rem', fontWeight:600, marginBottom:'.15rem' }}>{n.text}</div>
                  <div style={{ color:'#606080', fontSize:'.7rem' }}>{n.time}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* KADRO & TAKTİK */}
        {activeTab === 'squad' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 260px', height:'calc(100vh - 112px)', overflow:'hidden' }}>

            {/* SOL */}
            <div style={{ display:'flex', flexDirection:'column', overflow:'hidden', borderRight:'1px solid #1e1e4a' }}>

              {/* Formasyon + butonlar */}
              <div style={{ padding:'.4rem .75rem', borderBottom:'1px solid #1e1e4a', display:'flex', alignItems:'center', gap:'.4rem', flexShrink:0, flexWrap:'wrap', background:'#0a0a1a' }}>
                {Object.keys(FORMATION_POSITIONS).map(f => (
                  <button key={f} onClick={() => handleFormationChange(f)}
                    style={{ padding:'.2rem .55rem', borderRadius:5, border:`1px solid ${formation===f?'#7c3aed':'#2a2a5a'}`, background:formation===f?'rgba(124,58,237,.2)':'transparent', color:formation===f?'#a78bfa':'#606080', fontWeight:700, fontSize:'.7rem', cursor:'pointer' }}>
                    {f}
                  </button>
                ))}
                <button onClick={handleAutoArrange}
                  style={{ padding:'.2rem .6rem', borderRadius:5, border:'1px solid #f59e0b', background:'rgba(245,158,11,.1)', color:'#f59e0b', fontWeight:700, fontSize:'.7rem', cursor:'pointer' }}>
                  ⚡ Otomatik Diz
                </button>
                <button onClick={saveSquad} disabled={saving}
                  style={{ marginLeft:'auto', padding:'.2rem .7rem', borderRadius:5, border:'none', background:'#7c3aed', color:'#fff', fontWeight:700, fontSize:'.7rem', cursor:'pointer' }}>
                  {saving ? '...' : '💾 Kaydet'}
                </button>
              </div>

              {/* Saha */}
              <div style={{ flex:'0 0 52%', position:'relative', background:'linear-gradient(180deg,#0d3320 0%,#0f4a28 50%,#0d3320 100%)', overflow:'hidden', minHeight:280 }}
                onDragOver={e => e.preventDefault()}
              >
                <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%' }} viewBox="0 0 100 100" preserveAspectRatio="none">
                  <rect x="3" y="2" width="94" height="96" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth=".4"/>
                  <line x1="3" y1="50" x2="97" y2="50" stroke="rgba(255,255,255,.12)" strokeWidth=".3"/>
                  <circle cx="50" cy="50" r="12" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth=".3"/>
                  <rect x="22" y="2" width="56" height="18" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth=".3"/>
                  <rect x="22" y="80" width="56" height="18" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth=".3"/>
                </svg>

                {formationSlots.map((slot, i) => { const [pos, coords] = slot || []; const [x, y] = coords || [50, 50]; const player = squadLineup[i]; const isSelectedSlot = selectedSlot === i;
                  // Boş slot için öneri oyuncular
                  const suggestions = !player ? [...unassigned, ...bench]
                    .filter(p => {
                      const posGroups = { GK:['GK'], CB:['CB'], LB:['LB','CB'], RB:['RB','CB'], CDM:['CDM','CM'], CM:['CM','CDM','CAM'], CAM:['CAM','CM'], LM:['LM','LW'], RM:['RM','RW'], LW:['LW','LM'], RW:['RW','RM'], ST:['ST','CF'], CF:['CF','ST'] }
                      return (posGroups[pos] || [pos]).includes(p.position)
                    })
                    .sort((a,b) => b.overall - a.overall)
                    .slice(0, 4) : []

                  return (
                    <div key={i}
                      onDragOver={e => e.preventDefault()}
                      onDrop={() => handleDropOnSlot(i)}
                      style={{ position:'absolute', left:`${x}%`, top:`${y}%`, transform:'translate(-50%,-50%)', zIndex:2 }}
                    >
                      {player ? (
                        <div draggable onDragStart={() => handleDragStart(player, { type:'squadLineup', index:i })}
                          style={{ position:'relative', cursor:'grab' }}>
                          <button onClick={() => removeFromSlot(i)}
                            style={{ position:'absolute', top:-5, right:-5, width:13, height:13, borderRadius:'50%', background:'#ef4444', border:'none', color:'#fff', fontSize:8, fontWeight:900, cursor:'pointer', zIndex:10, display:'flex', alignItems:'center', justifyContent:'center', padding:0 }}>
                            ×
                          </button>
                          <div
                            onClick={() => setSelectedPlayerForRole(selectedPlayerForRole?.name===player.name ? null : { ...player, slotPos:pos })}
                            style={{ position:'relative', width:56, borderRadius:8, overflow:'hidden', boxShadow:'0 4px 15px rgba(0,0,0,0.6)', cursor:'pointer', border:`2px solid ${getPosTextColor(pos)}44` }}>
                            {/* Arka plan rengi */}
                            <div style={{ position:'absolute', inset:0, background:getPosColor(pos), opacity:0.9 }}/>
                            {/* Oyuncu resmi */}
                            {player.image ? (
                              <img src={player.image} alt={player.name}
                                style={{ width:'100%', height:60, objectFit:'cover', objectPosition:'top', display:'block', position:'relative', zIndex:1 }}
                                onError={e => e.target.style.display='none'}
                              />
                            ) : (
                              <div style={{ height:44, display:'flex', alignItems:'center', justifyContent:'center', position:'relative', zIndex:1 }}>
                                <svg viewBox="0 0 60 80" width={40} height={52} style={{ opacity:0.6 }}>
                                  <ellipse cx="30" cy="16" rx="11" ry="12" fill="rgba(255,255,255,0.3)"/>
                                  <path d="M10 45 C10 28 20 22 30 22 C40 22 50 28 50 45 L48 68 L38 68 L36 50 L30 54 L24 50 L22 68 L12 68 Z" fill="rgba(255,255,255,0.3)"/>
                                </svg>
                              </div>
                            )}
                            {/* Alt bilgi */}
                            <div style={{ position:'relative', zIndex:2, padding:'2px 3px', background:'rgba(0,0,0,0.7)', textAlign:'center' }}>
                              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                                <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:9, color:getPosTextColor(pos), letterSpacing:0.5 }}>{pos}</span>
                                <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:11, color:'#ffd700' }}>{player.overall}</span>
                              </div>
                              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:9, color:'#fff', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', letterSpacing:0.5 }}>{(player.name||'').split(' ').pop()}</div>
                              {playerRoles[player.name] && (
                                <div style={{ fontSize:7, color:getPosTextColor(pos), whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', opacity:0.8 }}>
                                  {(PLAYER_ROLES[pos]||PLAYER_ROLES[player.position]||[]).find(r=>r.id===playerRoles[player.name])?.name?.split(' ')[0]}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ position:'relative' }}>
                          <div onClick={() => handleEmptySlotClick(i)}
                            style={{ width:52, height:48, borderRadius:6, border:`1.5px dashed ${isSelectedSlot?getPosTextColor(pos):'rgba(255,255,255,.2)'}`, background:isSelectedSlot?`${getPosColor(pos)}99`:'rgba(0,0,0,.3)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                            <div style={{ fontSize:'.6rem', color:getPosTextColor(pos), fontWeight:700 }}>{pos}</div>
                            <div style={{ fontSize:'.48rem', color:'rgba(255,255,255,.4)' }}>Tıkla/Sürükle</div>
                          </div>
                          {isSelectedSlot && suggestions.length > 0 && (
                            <div style={{ position:'absolute', top:'100%', left:'50%', transform:'translateX(-50%)', zIndex:50, background:'#12122a', border:'1px solid #7c3aed', borderRadius:8, padding:'.4rem', minWidth:130, boxShadow:'0 4px 20px rgba(0,0,0,.8)', marginTop:2 }}>
                              <div style={{ fontSize:'.58rem', color:'#606080', fontWeight:700, marginBottom:'.3rem', letterSpacing:'.04em' }}>EN UYGUN OYUNCULAR</div>
                              {suggestions.map(s => (
                                <div key={s.id} onClick={() => handleSlotPlayerPick(i, s)}
                                  style={{ display:'flex', alignItems:'center', gap:'.35rem', padding:'.3rem .4rem', borderRadius:5, cursor:'pointer', marginBottom:'.15rem', background:'rgba(124,58,237,.1)' }}
                                  onMouseEnter={e=>e.currentTarget.style.background='rgba(124,58,237,.25)'}
                                  onMouseLeave={e=>e.currentTarget.style.background='rgba(124,58,237,.1)'}
                                >
                                  <span style={{ background:getPosColor(s.position), color:getPosTextColor(s.position), fontSize:'.55rem', fontWeight:700, padding:'.1rem .25rem', borderRadius:3, minWidth:26, textAlign:'center' }}>{s.position}</span>
                                  <span style={{ fontSize:'.68rem', fontWeight:600, flex:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{s.name}</span>
                                  <span style={{ fontSize:'.72rem', fontWeight:800, color:'#fbbf24' }}>{s.overall}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Rol seçim */}
              {selectedPlayerForRole && (
                <div style={{ padding:'.6rem 1rem', borderTop:'1px solid #1e1e4a', background:'#0a0a1a', flexShrink:0 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'.4rem' }}>
                    <div style={{ fontWeight:700, fontSize:'.8rem' }}>{selectedPlayerForRole.name} — Rol</div>
                    <button onClick={() => setSelectedPlayerForRole(null)} style={{ background:'none', border:'none', color:'#606080', cursor:'pointer', fontSize:'.9rem' }}>✕</button>
                  </div>
                  <div style={{ display:'flex', gap:'.35rem', flexWrap:'wrap' }}>
                    {(PLAYER_ROLES[selectedPlayerForRole.slotPos] || PLAYER_ROLES[selectedPlayerForRole.position] || []).map(role => (
                      <button key={role.id} onClick={() => setPlayerRoles(prev => ({ ...prev, [selectedPlayerForRole.name]: role.id }))}
                        title={role.desc}
                        style={{ padding:'.25rem .55rem', borderRadius:6, border:`1.5px solid ${playerRoles[selectedPlayerForRole.name]===role.id?'#a78bfa':'#2a2a5a'}`, background:playerRoles[selectedPlayerForRole.name]===role.id?'rgba(124,58,237,.2)':'#12122a', color:playerRoles[selectedPlayerForRole.name]===role.id?'#a78bfa':'#606080', fontWeight:700, fontSize:'.7rem', cursor:'pointer' }}>
                        {role.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Yedekler */}
              <div style={{ borderTop:'1px solid #1e1e4a', padding:'.4rem .75rem', flexShrink:0, background:'rgba(0,0,0,.15)' }}
                onDragOver={e => e.preventDefault()} onDrop={handleDropOnBench}>
                <div style={{ fontSize:'.58rem', color:'#606080', fontWeight:700, letterSpacing:'.06em', marginBottom:'.3rem' }}>YEDEKLER ({bench.length}/7)</div>
                <div style={{ display:'flex', gap:'.3rem', flexWrap:'wrap' }}>
                  {bench.map((player, i) => (
                    <div key={i} draggable onDragStart={() => handleDragStart(player, { type:'bench', index:i })}
                      style={{ position:'relative', cursor:'grab' }}>
                      <button onClick={() => removeFromBench(i)}
                        style={{ position:'absolute', top:-4, right:-4, width:12, height:12, borderRadius:'50%', background:'#ef4444', border:'none', color:'#fff', fontSize:7, fontWeight:900, cursor:'pointer', zIndex:10, display:'flex', alignItems:'center', justifyContent:'center', padding:0 }}>
                        ×
                      </button>
                      <div style={{ background:getPosColor(player.position), border:`1px solid ${getPosTextColor(player.position)}`, borderRadius:5, padding:'2px 5px', textAlign:'center', minWidth:44 }}>
                        <div style={{ fontSize:'.72rem', fontWeight:900, color:'#fbbf24' }}>{player.overall}</div>
                        <div style={{ fontSize:'.5rem', color:'#fff', whiteSpace:'nowrap', maxWidth:44, overflow:'hidden', textOverflow:'ellipsis' }}>{(player.name||'').split(' ').pop()}</div>
                      </div>
                    </div>
                  ))}
                  {bench.length < 7 && Array.from({ length:7-bench.length }).map((_,i) => (
                    <div key={'eb'+i} style={{ width:44, height:36, borderRadius:5, border:'1px dashed #2a2a5a', background:'rgba(0,0,0,.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <span style={{ fontSize:'.5rem', color:'rgba(255,255,255,.2)' }}>Yedek</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Taktikler */}
              <div style={{ borderTop:'1px solid #1e1e4a', padding:'.5rem .75rem', flexShrink:0, background:'#0a0a1a', overflowX:'auto' }}>
                <div style={{ fontSize:'.58rem', color:'#606080', fontWeight:700, letterSpacing:'.06em', marginBottom:'.4rem' }}>TAKTİKLER</div>
                <div style={{ display:'flex', gap:'.75rem', flexWrap:'wrap' }}>
                  {Object.entries(TACTICS_CONFIG).map(([key, config]) => (
                    <div key={key} style={{ minWidth:110 }}>
                      <div style={{ fontSize:'.6rem', color:'#a0a0c0', fontWeight:700, marginBottom:'.2rem' }}>{config.icon} {config.label}</div>
                      <select value={tactics[key]} onChange={e => setTactics(prev => ({ ...prev, [key]:e.target.value }))}
                        style={{ width:'100%', background:'#12122a', border:'1px solid #2a2a5a', borderRadius:5, padding:'.2rem .35rem', color:'#a78bfa', fontSize:'.68rem', outline:'none', cursor:'pointer' }}>
                        {config.options.map(opt => (
                          <option key={opt.id} value={opt.id}>{opt.name}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* SAĞ: Oyuncu listesi */}
            <div style={{ display:'flex', flexDirection:'column', overflow:'hidden' }}>
              <div style={{ padding:'.6rem .75rem', borderBottom:'1px solid #1e1e4a', flexShrink:0, background:'#0a0a1a' }}>
                <div style={{ fontWeight:800, fontSize:'.82rem' }}>Oyuncular</div>
                <div style={{ color:'#606080', fontSize:'.65rem' }}>Sürükle → sahaya veya yedeğe bırak</div>
              </div>
              <div style={{ flex:1, overflowY:'auto', padding:'.4rem' }}>
                {unassigned.length === 0 && (
                  <div style={{ textAlign:'center', color:'#10b981', fontSize:'.8rem', padding:'1.5rem', fontWeight:600 }}>✅ Tüm oyuncular yerleştirildi!</div>
                )}
                {[...unassigned].sort((a,b) => {
                  const order = { GK:0, CB:1, LB:2, RB:3, CDM:4, CM:5, CAM:6, LM:7, RM:8, LW:9, RW:10, ST:11, CF:12 }
                  return (order[a.position]||99) - (order[b.position]||99) || b.overall - a.overall
                }).map((player, i) => (
                  <div key={player.id||i} draggable
                    onDragStart={() => handleDragStart(player, { type:'list', index:i })}
                    style={{ display:'flex', alignItems:'center', gap:'.35rem', padding:'.35rem .5rem', borderRadius:7, marginBottom:'.2rem', background:'#12122a', border:'1px solid #1e1e4a', cursor:'grab', transition:'border-color .1s' }}
                    onMouseEnter={e=>e.currentTarget.style.borderColor='#7c3aed'}
                    onMouseLeave={e=>e.currentTarget.style.borderColor='#1e1e4a'}
                  >
                    <span style={{ background:getPosColor(player.position), color:getPosTextColor(player.position), fontSize:'.55rem', fontWeight:700, padding:'.1rem .28rem', borderRadius:4, minWidth:28, textAlign:'center', flexShrink:0 }}>{player.position}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:'.72rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{player.name}</div>
                      <div style={{ color:'#606080', fontSize:'.6rem' }}>{player.club}</div>
                    </div>
                    <div style={{ fontWeight:800, color:'#fbbf24', fontSize:'.78rem', flexShrink:0 }}>{player.overall}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PUAN TABLOSU */}
        {activeTab === 'standingsData' && (
          <div style={{ padding:'1.5rem', maxWidth:700, margin:'0 auto' }}>
            <div style={{ background:'rgba(8,12,24,0.95)', border:'1px solid rgba(0,200,255,0.12)', borderRadius:14, overflow:'hidden', boxShadow:'0 8px 30px rgba(0,0,0,0.4)' }}>
              
              {/* Başlık */}
              <div style={{ padding:'1rem 1.25rem', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(0,0,0,0.3)', display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:18 }}>🏆</span>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:14, letterSpacing:3, color:'rgba(255,255,255,0.6)' }}>PUAN TABLOSU</div>
              </div>

              {/* Header */}
              <div style={{ display:'grid', gridTemplateColumns:'30px 1fr 36px 36px 36px 36px 36px 36px 44px 44px', padding:'.5rem 1rem', background:'rgba(0,0,0,0.2)', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                {['#','TAKIM','O','G','B','M','AG','YG','AV','P'].map((h,i) => (
                  <div key={h} style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:10, letterSpacing:2, color:'rgba(255,255,255,0.25)', textAlign:i<=1?'left':'center' }}>{h}</div>
                ))}
              </div>

              {/* Satırlar - puana göre sırala */}
              {[...lobbyPlayers]
                .map(player => {
                  const stat = standingsData.find(s=>s.user_id===player.user_id) || { played:0,wins:0,draws:0,losses:0,goals_for:0,goals_against:0,points:0 }
                  const av = (stat.goals_for||0)-(stat.goals_against||0)
                  return { player, stat, av }
                })
                .sort((a,b) => {
                  if ((b.stat.points||0) !== (a.stat.points||0)) return (b.stat.points||0)-(a.stat.points||0)
                  if (b.av !== a.av) return b.av - a.av
                  return (b.stat.goals_for||0)-(a.stat.goals_for||0)
                })
                .map(({ player, stat, av }, i) => {
                  const isMe = player.user_id === userId
                  const isFirst = i === 0
                  return (
                    <div key={player.id} style={{ display:'grid', gridTemplateColumns:'30px 1fr 36px 36px 36px 36px 36px 36px 44px 44px', padding:'.75rem 1rem', borderBottom:'1px solid rgba(255,255,255,0.04)', background:isMe?'rgba(0,200,255,0.05)':'transparent', transition:'background .15s' }}>
                      {/* Sıra */}
                      <div style={{ display:'flex', alignItems:'center' }}>
                        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:14, color:isFirst?'#ffd700':isMe?'#00c8ff':'rgba(255,255,255,0.3)', fontWeight:800 }}>{i+1}</div>
                      </div>
                      {/* Takım */}
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <LogoMini logo={isMe?club?.logo:null} size={22}/>
                        <div>
                          <div style={{ fontFamily:"'Rajdhani',sans-serif", fontWeight:700, fontSize:13, color:isMe?'#00c8ff':'rgba(255,255,255,0.8)' }}>{player.team_name}</div>
                          {isMe && <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:8, letterSpacing:2, color:'rgba(0,200,255,0.5)' }}>SEN</div>}
                        </div>
                      </div>
                      {/* İstatistikler */}
                      {[stat.played||0, stat.wins||0, stat.draws||0, stat.losses||0, stat.goals_for||0, stat.goals_against||0].map((v,j) => (
                        <div key={j} style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:13, color:'rgba(255,255,255,0.5)', textAlign:'center', display:'flex', alignItems:'center', justifyContent:'center' }}>{v}</div>
                      ))}
                      {/* AV */}
                      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:13, textAlign:'center', display:'flex', alignItems:'center', justifyContent:'center', color:av>0?'#10b981':av<0?'#ef4444':'rgba(255,255,255,0.4)' }}>
                        {av>0?`+${av}`:av}
                      </div>
                      {/* Puan */}
                      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:16, textAlign:'center', display:'flex', alignItems:'center', justifyContent:'center', color:isFirst?'#ffd700':isMe?'#00c8ff':'rgba(255,255,255,0.8)', fontWeight:800 }}>
                        {stat.points||0}
                      </div>
                    </div>
                  )
                })
              }

              {/* Açıklama */}
              <div style={{ padding:'.75rem 1rem', display:'flex', gap:'1rem', borderTop:'1px solid rgba(255,255,255,0.04)' }}>
                {[['G','Galibiyet'],['B','Beraberlik'],['M','Mağlubiyet'],['AG','Attığı Gol'],['YG','Yediği Gol'],['AV','Averaj'],['P','Puan']].map(([k,v])=>(
                  <div key={k} style={{ display:'flex', gap:4, alignItems:'center' }}>
                    <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:9, color:'rgba(0,200,255,0.6)', letterSpacing:1 }}>{k}</span>
                    <span style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:9, color:'rgba(255,255,255,0.2)' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* HABERLER */}
        {activeTab === 'news' && (
          <div style={{ padding:'1.5rem', maxWidth:700, margin:'0 auto', display:'flex', flexDirection:'column', gap:'.75rem' }}>
            {news.map(n => (
              <div key={n.id} style={{ background:'#12122a', border:'1px solid #1e1e4a', borderRadius:12, padding:'1rem 1.25rem', display:'flex', gap:'1rem' }}>
                <div style={{ width:40, height:40, borderRadius:8, background:'#1e1e4a', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem', flexShrink:0 }}>📰</div>
                <div>
                  <div style={{ fontWeight:600, fontSize:'.9rem', marginBottom:'.25rem' }}>{n.text}</div>
                  <div style={{ color:'#606080', fontSize:'.75rem' }}>{n.time}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
