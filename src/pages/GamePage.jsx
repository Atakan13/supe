import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getClub } from '../lib/club'

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

// FM Taktikleri
const TACTICS_CONFIG = {
  pressing: {
    label: 'PRES',
    icon: '⚡',
    options: [
      { id: 'gegenpressing', name: 'Gegenpressing', desc: 'Top kaybedince anında yüksek pres', statBonus: { defending: 8, pace: 5 }, narrativeTag: 'agresif pres yapıyor' },
      { id: 'high_press', name: 'Yüksek Pres', desc: 'Rakip sahada sürekli baskı', statBonus: { defending: 5, physical: 3 }, narrativeTag: 'yüksek pres uyguluyor' },
      { id: 'mid_press', name: 'Orta Pres', desc: 'Dengeli baskı stratejisi', statBonus: { defending: 2 }, narrativeTag: 'dengeli pres yapıyor' },
      { id: 'low_block', name: 'Alçak Blok', desc: 'Kendi yarısında kompakt savunma', statBonus: { defending: 10, shooting: -3 }, narrativeTag: 'alçak blok oynuyor' },
    ]
  },
  tempo: {
    label: 'TEMPO',
    icon: '🏃',
    options: [
      { id: 'fast', name: 'Yüksek Tempo', desc: 'Hızlı geçiş ve çabuk oyun', statBonus: { pace: 8, passing: 3 }, narrativeTag: 'yüksek tempoda oynuyor' },
      { id: 'normal', name: 'Normal Tempo', desc: 'Dengeli oyun temposu', statBonus: {}, narrativeTag: 'kontrollü oynuyor' },
      { id: 'slow', name: 'Düşük Tempo', desc: 'Top tutma ve pozisyon oyunu', statBonus: { passing: 8, dribbling: 5 }, narrativeTag: 'topla oynuyor' },
    ]
  },
  attack_width: {
    label: 'HÜCUM GENİŞLİĞİ',
    icon: '↔️',
    options: [
      { id: 'wide', name: 'Geniş Hücum', desc: 'Kanatları etkin kullan', statBonus: { dribbling: 6 }, narrativeTag: 'kanatlardan geliyor' },
      { id: 'central', name: 'Ortadan Hücum', desc: 'Merkezi geçiş ve şut', statBonus: { shooting: 6, passing: 4 }, narrativeTag: 'ortadan yaratıyor' },
      { id: 'mixed', name: 'Karma Hücum', desc: 'Hem kanat hem orta', statBonus: { passing: 3 }, narrativeTag: 'çeşitli bölgelerden hücum ediyor' },
    ]
  },
  defense_line: {
    label: 'SAVUNMA HATTI',
    icon: '🛡️',
    options: [
      { id: 'high', name: 'Yüksek Hat', desc: 'Offside tuzağı, rakibe az alan', statBonus: { defending: 5, pace: -3 }, narrativeTag: 'yüksek savunma hattı tutuyor' },
      { id: 'standard', name: 'Normal Hat', desc: 'Dengeli savunma pozisyonu', statBonus: { defending: 2 }, narrativeTag: 'standart hat tutuyor' },
      { id: 'deep', name: 'Alçak Hat', desc: 'Derin savunma, kompakt blok', statBonus: { defending: 8, shooting: -5 }, narrativeTag: 'derin savunma yapıyor' },
    ]
  },
  buildup: {
    label: 'YAPILAN OYUN',
    icon: '🎯',
    options: [
      { id: 'short', name: 'Kısa Paslaşma', desc: 'Tiki-taka stili top tutma', statBonus: { passing: 10, dribbling: 5 }, narrativeTag: 'kısa paslarla oynuyor' },
      { id: 'direct', name: 'Direkt Oyun', desc: 'Uzun toplar ve hızlı geçiş', statBonus: { shooting: 5, physical: 5 }, narrativeTag: 'direkt top oynuyor' },
      { id: 'counter', name: 'Kontratak', desc: 'Savun ve hızla hücuma geç', statBonus: { pace: 10, shooting: 5 }, narrativeTag: 'kontratak oynuyor' },
    ]
  },
  set_piece: {
    label: 'DURAN TOP',
    icon: '🚩',
    options: [
      { id: 'short', name: 'Kısa Korner/FK', desc: 'Kısa kombinasyonlar', statBonus: { passing: 5 }, narrativeTag: 'kısa duran top oynuyor' },
      { id: 'long', name: 'Uzun Top', desc: 'Kafa topuna yönel', statBonus: { physical: 8 }, narrativeTag: 'uzun duran top kullanıyor' },
    ]
  },
}

// Oyuncu Rolleri
const PLAYER_ROLES = {
  GK: [
    { id: 'sweeper_keeper', name: 'Sweeper Keeper', desc: 'Topu ayakla oynar, çıkar', statBonus: { pace: 10, passing: 8 }, narrativeTag: 'ceza sahasından çıkıyor' },
    { id: 'classic_gk', name: 'Klasik Kaleci', desc: 'Pozisyonda bekler', statBonus: { goalkeeper: 5 }, narrativeTag: 'çizgisinde bekliyor' },
  ],
  CB: [
    { id: 'ball_playing', name: 'Ball-Playing Def.', desc: 'Pas oyununu başlatır', statBonus: { passing: 8, dribbling: 5 }, narrativeTag: 'topa sahip çıkıp pas arıyor' },
    { id: 'stopper', name: 'Stopper', desc: 'Agresif müdahale', statBonus: { defending: 8, physical: 5 }, narrativeTag: 'agresif müdahale yapıyor' },
    { id: 'libero', name: 'Libero', desc: 'Öne çıkar, yaratır', statBonus: { dribbling: 8, passing: 6 }, narrativeTag: 'öne çıkıp oyun kuruyor' },
  ],
  LB: [
    { id: 'wing_back', name: 'Wing Back', desc: 'Kanat oyuncusu gibi çıkar', statBonus: { pace: 8, dribbling: 6 }, narrativeTag: 'kanat bekinden hücuma çıkıyor' },
    { id: 'full_back', name: 'Full Back', desc: 'Dengeli bek', statBonus: { defending: 5, passing: 5 }, narrativeTag: 'pozisyonunu koruyarak çıkıyor' },
    { id: 'inverted_wb', name: 'Inverted Wing Back', desc: 'İçe keserek şut atar', statBonus: { shooting: 8, dribbling: 6 }, narrativeTag: 'içe kesip şut deniyor' },
  ],
  RB: [
    { id: 'wing_back', name: 'Wing Back', desc: 'Kanat oyuncusu gibi çıkar', statBonus: { pace: 8, dribbling: 6 }, narrativeTag: 'kanat bekinden hücuma çıkıyor' },
    { id: 'full_back', name: 'Full Back', desc: 'Dengeli bek', statBonus: { defending: 5, passing: 5 }, narrativeTag: 'pozisyonunu koruyarak çıkıyor' },
    { id: 'inverted_wb', name: 'Inverted Wing Back', desc: 'İçe keserek şut atar', statBonus: { shooting: 8, dribbling: 6 }, narrativeTag: 'içe kesip şut deniyor' },
  ],
  CDM: [
    { id: 'anchor', name: 'Anchor Man', desc: 'Defans önünde bekler', statBonus: { defending: 10 }, narrativeTag: 'defans önünde duruyor' },
    { id: 'dlp', name: 'Deep Lying Playmaker', desc: 'Derinden oyun kurar', statBonus: { passing: 10, dribbling: 5 }, narrativeTag: 'derineden oyun kuruyor' },
    { id: 'bwm', name: 'Ball Winning Mid.', desc: 'Top kapma uzmanı', statBonus: { defending: 8, physical: 8 }, narrativeTag: 'topu kazanmaya çalışıyor' },
  ],
  CM: [
    { id: 'box_to_box', name: 'Box to Box', desc: 'Her iki ceza sahasında', statBonus: { physical: 8, shooting: 5 }, narrativeTag: 'cezadan cezaya koşuyor' },
    { id: 'carrilero', name: 'Carrilero', desc: 'Yandan destek verir', statBonus: { passing: 8, defending: 5 }, narrativeTag: 'yandan koşuyor' },
    { id: 'mezzala', name: 'Mezzala', desc: 'İçe keser, şut dener', statBonus: { shooting: 8, dribbling: 6 }, narrativeTag: 'içe kesip şut denedi' },
  ],
  CAM: [
    { id: 'trequartista', name: 'Trequartista', desc: 'Tam özgürlük, pozisyon arar', statBonus: { dribbling: 10, shooting: 8 }, narrativeTag: 'serbest dolaşıp pozisyon arıyor' },
    { id: 'shadow_striker', name: 'Shadow Striker', desc: 'Gizli santrfor', statBonus: { shooting: 10, pace: 5 }, narrativeTag: 'arkadan gelerek şut denedi' },
    { id: 'adv_playmaker', name: 'Advanced Playmaker', desc: 'Asist üretir', statBonus: { passing: 10, dribbling: 6 }, narrativeTag: 'yaratıcı paslar atıyor' },
  ],
  LM: [
    { id: 'winger', name: 'Winger', desc: 'Kanat koşusu ve orta', statBonus: { pace: 10, dribbling: 6 }, narrativeTag: 'kanat koşusu yapıyor' },
    { id: 'inside_forward', name: 'Inside Forward', desc: 'İçe keser, şut atar', statBonus: { shooting: 10, dribbling: 8 }, narrativeTag: 'içe keserek şut denedi' },
    { id: 'wide_playmaker', name: 'Wide Playmaker', desc: 'Kanaldan oyun kurar', statBonus: { passing: 10, dribbling: 5 }, narrativeTag: 'kanaldan oyun kurdu' },
  ],
  RM: [
    { id: 'winger', name: 'Winger', desc: 'Kanat koşusu ve orta', statBonus: { pace: 10, dribbling: 6 }, narrativeTag: 'kanat koşusu yapıyor' },
    { id: 'inside_forward', name: 'Inside Forward', desc: 'İçe keser, şut atar', statBonus: { shooting: 10, dribbling: 8 }, narrativeTag: 'içe keserek şut denedi' },
    { id: 'wide_playmaker', name: 'Wide Playmaker', desc: 'Kanaldan oyun kurar', statBonus: { passing: 10, dribbling: 5 }, narrativeTag: 'kanaldan oyun kurdu' },
  ],
  LW: [
    { id: 'winger', name: 'Winger', desc: 'Kanat koşusu ve orta', statBonus: { pace: 10, dribbling: 6 }, narrativeTag: 'kanat koşusu yapıyor' },
    { id: 'inside_forward', name: 'Inside Forward', desc: 'İçe keser, şut atar', statBonus: { shooting: 10, dribbling: 8 }, narrativeTag: 'içe keserek şut denedi' },
  ],
  RW: [
    { id: 'winger', name: 'Winger', desc: 'Kanat koşusu ve orta', statBonus: { pace: 10, dribbling: 6 }, narrativeTag: 'kanat koşusu yapıyor' },
    { id: 'inside_forward', name: 'Inside Forward', desc: 'İçe keser, şut atar', statBonus: { shooting: 10, dribbling: 8 }, narrativeTag: 'içe keserek şut denedi' },
  ],
  ST: [
    { id: 'advanced_forward', name: 'Advanced Forward', desc: 'Hareketli, kaçış yapar', statBonus: { pace: 8, shooting: 6 }, narrativeTag: 'arkayı zorlayan koşu yapıyor' },
    { id: 'target_man', name: 'Target Man', desc: 'Kafa topu ve sırt dönük oyun', statBonus: { physical: 10, shooting: 5 }, narrativeTag: 'sırtını dönerek top aldı' },
    { id: 'poacher', name: 'Poacher', desc: 'Ceza sahasında bekler', statBonus: { shooting: 12 }, narrativeTag: 'ceza sahasında pozisyon aldı' },
    { id: 'dlf', name: 'Deep Lying Forward', desc: 'Geriye düşer, oyuna katılır', statBonus: { passing: 8, dribbling: 6 }, narrativeTag: 'geriye düşüp oyun kurdu' },
  ],
  CF: [
    { id: 'advanced_forward', name: 'Advanced Forward', desc: 'Hareketli santrfor', statBonus: { pace: 8, shooting: 6 }, narrativeTag: 'hızlı koşuyla arkayı zorluyor' },
    { id: 'poacher', name: 'Poacher', desc: 'Ceza sahasında bekler', statBonus: { shooting: 12 }, narrativeTag: 'ceza sahasında pozisyon aldı' },
  ],
}

const FORMATION_POSITIONS = {
  '4-4-2':   [['GK',[50,90]],['LB',[12,68]],['CB',[35,68]],['CB',[65,68]],['RB',[88,68]],['LM',[12,45]],['CM',[35,45]],['CM',[65,45]],['RM',[88,45]],['ST',[35,18]],['ST',[65,18]]],
  '4-3-3':   [['GK',[50,90]],['LB',[12,68]],['CB',[35,68]],['CB',[65,68]],['RB',[88,68]],['CM',[25,48]],['CM',[50,42]],['CM',[75,48]],['LW',[15,18]],['ST',[50,12]],['RW',[85,18]]],
  '4-2-3-1': [['GK',[50,90]],['LB',[12,68]],['CB',[35,68]],['CB',[65,68]],['RB',[88,68]],['CDM',[32,55]],['CDM',[68,55]],['LM',[15,38]],['CAM',[50,35]],['RM',[85,38]],['ST',[50,14]]],
  '3-5-2':   [['GK',[50,90]],['CB',[25,70]],['CB',[50,68]],['CB',[75,70]],['LM',[8,48]],['CM',[30,45]],['CDM',[50,52]],['CM',[70,45]],['RM',[92,48]],['ST',[35,16]],['ST',[65,16]]],
  '5-3-2':   [['GK',[50,90]],['LB',[8,72]],['CB',[28,68]],['CB',[50,66]],['CB',[72,68]],['RB',[92,72]],['CM',[28,46]],['CM',[50,42]],['CM',[72,46]],['ST',[35,16]],['ST',[65,16]]],
  '3-4-3':   [['GK',[50,90]],['CB',[25,70]],['CB',[50,68]],['CB',[75,70]],['LM',[10,50]],['CM',[35,46]],['CM',[65,46]],['RM',[90,50]],['LW',[18,16]],['ST',[50,10]],['RW',[82,16]]],
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
  const [mySquad, setMySquad] = useState(null)
  const [standings, setStandings] = useState([])
  const [activeTab, setActiveTab] = useState('home')
  const [matchReady, setMatchReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [news, setNews] = useState([])
  const [saving, setSaving] = useState(false)

  // Kadro/Taktik state
  const [lineup, setLineup] = useState(Array(11).fill(null))  // 11 slot
  const [bench, setBench] = useState([])                        // yedekler
  const [unassigned, setUnassigned] = useState([])              // sağdaki liste
  const [tactics, setTactics] = useState({
    pressing: 'high_press',
    tempo: 'normal',
    attack_width: 'mixed',
    defense_line: 'standard',
    buildup: 'short',
    set_piece: 'long',
  })
  const [playerRoles, setPlayerRoles] = useState({})
  const [draggedPlayer, setDraggedPlayer] = useState(null)
  const [dragSource, setDragSource] = useState(null) // { type: 'lineup'|'bench'|'list', index }
  const [selectedPlayerForRole, setSelectedPlayerForRole] = useState(null)
  const [formation, setFormation] = useState('4-4-2')

  const channelRef = useRef(null)
  const isHost = lobbyPlayers.find(p => p.user_id === userId)?.is_host

  useEffect(() => { init() }, [code])

  const init = async () => {
    const { data: lb } = await supabase.from('lobbies').select('*').ilike('code', code).maybeSingle()
    if (!lb) return
    setLobby(lb)
    setFormation(lb.formation || '4-4-2')

    const { data: pl } = await supabase.from('lobby_players').select('*').eq('lobby_id', lb.id).order('joined_at')
    setLobbyPlayers(pl || [])

    const { data: myS } = await supabase.from('squads').select('*').eq('lobby_id', lb.id).eq('user_id', userId).maybeSingle()
    if (myS) {
      setMySquad(myS)
      const savedLineup = myS.lineup || []
      const savedBench = myS.bench || []
      setLineup(savedLineup.length === 11 ? savedLineup : [...savedLineup, ...Array(11 - savedLineup.length).fill(null)])
      setBench(savedBench)
      if (myS.tactics) setTactics(myS.tactics)
      if (myS.player_roles) setPlayerRoles(myS.player_roles)

      // Atanmamış oyuncular
      const assignedNames = [...savedLineup.filter(Boolean), ...savedBench].map(p => p?.name)
      const allPicks = [...savedLineup.filter(Boolean), ...savedBench]
      // draft_picks'ten tüm oyuncuları çek
      const { data: picks } = await supabase.from('draft_picks').select('*').eq('lobby_id', lb.id).eq('picked_by', userId)
      if (picks) {
        const { PLAYER_CARDS } = await import('../lib/playerCards')
        const allPlayers = picks.map(p => PLAYER_CARDS.find(c => c.id === p.player_card_id)).filter(Boolean)
        const unassignedPlayers = allPlayers.filter(p => !assignedNames.includes(p.name))
        setUnassigned(unassignedPlayers)
      }
    } else {
      // İlk kez - draft picks'ten yükle
      const { data: picks } = await supabase.from('draft_picks').select('*').eq('lobby_id', lb.id).eq('picked_by', userId).order('pick_order')
      if (picks && picks.length > 0) {
        const { PLAYER_CARDS } = await import('../lib/playerCards')
        const allPlayers = picks.map(p => PLAYER_CARDS.find(c => c.id === p.player_card_id)).filter(Boolean)
        setUnassigned(allPlayers)
        setLineup(Array(11).fill(null))
        setBench([])
      }
    }

    const { data: stats } = await supabase.from('season_stats').select('*').eq('lobby_id', lb.id)
    setStandings(stats || [])

    const teams = (pl || []).map(p => p.team_name)
    setNews(Array.from({ length: 6 }, (_, i) => ({
      id: i,
      text: NEWS_TEMPLATES[i % NEWS_TEMPLATES.length](teams[0] || 'Ev Sahibi', teams[1] || 'Deplasman'),
      time: `${i + 1} saat önce`
    })))

    setLoading(false)

    channelRef.current = supabase.channel('game-' + lb.id)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lobbies', filter: `id=eq.${lb.id}` }, async (p) => {
        setLobby(p.new)
        const homeReady = p.new.match_ready_home
        const awayReady = p.new.match_ready_away
        if (homeReady && awayReady) {
          await createMatch(lb.id, pl || [])
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
    const newReady = !matchReady
    setMatchReady(newReady)
    const field = isHost ? { match_ready_home: newReady } : { match_ready_away: newReady }
    await supabase.from('lobbies').update(field).eq('id', lobby.id)
  }

  const saveSquad = async () => {
    if (!lobby) return
    setSaving(true)
    try {
      const squadData = {
        lobby_id: lobby.id,
        user_id: userId,
        formation,
        lineup: lineup.map((p, i) => p ? { ...p, squad_pos: FORMATION_POSITIONS[formation]?.[i]?.[0] || 'GK' } : null).filter(Boolean),
        bench,
        tactics,
        player_roles: playerRoles,
      }
      const { data: ex } = await supabase.from('squads').select('id').eq('lobby_id', lobby.id).eq('user_id', userId).maybeSingle()
      if (ex) await supabase.from('squads').update(squadData).eq('id', ex.id)
      else await supabase.from('squads').insert(squadData)
    } finally {
      setSaving(false)
    }
  }

  // Sürükle bırak
  const handleDragStart = (player, source) => {
    setDraggedPlayer(player)
    setDragSource(source)
  }

  const handleDropOnSlot = (slotIndex) => {
    if (!draggedPlayer) return
    const newLineup = [...lineup]
    const newBench = [...bench]
    const newUnassigned = [...unassigned]

    // Slotta zaten oyuncu var mı?
    const existingInSlot = newLineup[slotIndex]

    // Kaynaktan kaldır
    if (dragSource.type === 'lineup') {
      newLineup[dragSource.index] = existingInSlot || null
    } else if (dragSource.type === 'bench') {
      newBench.splice(dragSource.index, 1)
      if (existingInSlot) newBench.push(existingInSlot)
    } else if (dragSource.type === 'list') {
      const idx = newUnassigned.findIndex(p => p.id === draggedPlayer.id)
      if (idx > -1) newUnassigned.splice(idx, 1)
      if (existingInSlot) newUnassigned.push(existingInSlot)
    }

    newLineup[slotIndex] = draggedPlayer
    setLineup(newLineup)
    setBench(newBench)
    setUnassigned(newUnassigned)
    setDraggedPlayer(null)
    setDragSource(null)
  }

  const handleDropOnBench = () => {
    if (!draggedPlayer) return
    const newLineup = [...lineup]
    const newBench = [...bench]
    const newUnassigned = [...unassigned]

    if (dragSource.type === 'lineup') {
      newLineup[dragSource.index] = null
    } else if (dragSource.type === 'list') {
      const idx = newUnassigned.findIndex(p => p.id === draggedPlayer.id)
      if (idx > -1) newUnassigned.splice(idx, 1)
    }

    if (!newBench.find(p => p.id === draggedPlayer.id)) {
      newBench.push(draggedPlayer)
    }

    setLineup(newLineup)
    setBench(newBench)
    setUnassigned(newUnassigned)
    setDraggedPlayer(null)
    setDragSource(null)
  }

  const removeFromSlot = (slotIndex) => {
    const player = lineup[slotIndex]
    if (!player) return
    const newLineup = [...lineup]
    newLineup[slotIndex] = null
    setLineup(newLineup)
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

  const formationSlots = FORMATION_POSITIONS[formation] || FORMATION_POSITIONS['4-4-2']
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
            <div style={{ color:'#606080', fontSize:'.7rem' }}>{formation} · Lobi: {lobby?.code}</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:'1rem', alignItems:'center' }}>
          {opTeam && (
            <div style={{ display:'flex', alignItems:'center', gap:'.5rem', color:'#a0a0c0', fontSize:'.85rem' }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:'#f59e0b' }}/>
              {opTeam.team_name}
            </div>
          )}
          <button onClick={handleReadyForMatch}
            style={{ padding:'.5rem 1.1rem', borderRadius:8, border:'none', background:matchReady?'#10b981':'#7c3aed', color:'#fff', fontWeight:700, fontSize:'.82rem', cursor:'pointer' }}>
            {matchReady ? '✅ Hazırım' : '⚽ Maça Hazır'}
          </button>
        </div>
      </div>

      {/* NAV */}
      <div style={{ background:'#0f0f2a', borderBottom:'1px solid #1e1e4a', display:'flex', padding:'0 1.5rem' }}>
        {[['home','🏠 Ana'],['squad','👥 Kadro & Taktik'],['standings','🏆 Puan'],['news','📰 Haberler']].map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ padding:'.75rem 1rem', border:'none', background:'transparent', color:activeTab===tab?'#a78bfa':'#606080', fontWeight:700, fontSize:'.78rem', cursor:'pointer', borderBottom:activeTab===tab?'2px solid #7c3aed':'2px solid transparent', transition:'all .15s' }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ flex:1, overflow:'hidden' }}>

        {/* ANA SAYFA */}
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
                  <div style={{ fontSize:'.7rem', color:'#606080', marginTop:'.25rem' }}>İki taraf hazır olunca başlar</div>
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
          <div style={{ display:'grid', gridTemplateColumns:'1fr 280px', height:'calc(100vh - 110px)', overflow:'hidden' }}>

            {/* SOL: Saha + Taktikler */}
            <div style={{ display:'flex', flexDirection:'column', overflow:'hidden', borderRight:'1px solid #1e1e4a' }}>

              {/* Formasyon seç */}
              <div style={{ padding:'.5rem 1rem', borderBottom:'1px solid #1e1e4a', display:'flex', alignItems:'center', gap:'.5rem', flexShrink:0, flexWrap:'wrap' }}>
                <span style={{ fontSize:'.7rem', color:'#606080', fontWeight:700 }}>DİZİLİŞ:</span>
                {Object.keys(FORMATION_POSITIONS).map(f => (
                  <button key={f} onClick={() => setFormation(f)}
                    style={{ padding:'.25rem .6rem', borderRadius:6, border:`1px solid ${formation===f?'#7c3aed':'#2a2a5a'}`, background:formation===f?'rgba(124,58,237,.2)':'transparent', color:formation===f?'#a78bfa':'#606080', fontWeight:700, fontSize:'.72rem', cursor:'pointer' }}>
                    {f}
                  </button>
                ))}
                <button onClick={saveSquad} disabled={saving}
                  style={{ marginLeft:'auto', padding:'.3rem .8rem', borderRadius:6, border:'none', background:'#7c3aed', color:'#fff', fontWeight:700, fontSize:'.72rem', cursor:'pointer' }}>
                  {saving ? '...' : '💾 Kaydet'}
                </button>
              </div>

              <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
                {/* Saha */}
                <div style={{ flex:'0 0 55%', position:'relative', background:'linear-gradient(180deg,#0d3320 0%,#0f4a28 50%,#0d3320 100%)', overflow:'hidden' }}
                  onDragOver={e => e.preventDefault()}
                >
                  <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%' }} viewBox="0 0 100 100" preserveAspectRatio="none">
                    <rect x="3" y="2" width="94" height="96" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth=".4"/>
                    <line x1="3" y1="50" x2="97" y2="50" stroke="rgba(255,255,255,.12)" strokeWidth=".3"/>
                    <circle cx="50" cy="50" r="12" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth=".3"/>
                    <rect x="22" y="2" width="56" height="18" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth=".3"/>
                    <rect x="22" y="80" width="56" height="18" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth=".3"/>
                  </svg>

                  {formationSlots.map(([pos, [x, y]], i) => {
                    const player = lineup[i]
                    return (
                      <div key={i}
                        onDragOver={e => e.preventDefault()}
                        onDrop={() => handleDropOnSlot(i)}
                        style={{ position:'absolute', left:`${x}%`, top:`${y}%`, transform:'translate(-50%,-50%)', zIndex:2 }}
                      >
                        {player ? (
                          <div
                            draggable
                            onDragStart={() => handleDragStart(player, { type:'lineup', index:i })}
                            style={{ position:'relative', cursor:'grab' }}
                          >
                            {/* Çarpı butonu */}
                            <button onClick={() => removeFromSlot(i)}
                              style={{ position:'absolute', top:-6, right:-6, width:14, height:14, borderRadius:'50%', background:'#ef4444', border:'none', color:'#fff', fontSize:8, fontWeight:900, cursor:'pointer', zIndex:10, display:'flex', alignItems:'center', justifyContent:'center', padding:0, lineHeight:1 }}>
                              ×
                            </button>
                            {/* Oyuncu kartı */}
                            <div onClick={() => setSelectedPlayerForRole(selectedPlayerForRole?.name === player.name ? null : { ...player, slotPos: pos })}
                              style={{ background:getPosColor(pos), border:`1.5px solid ${getPosTextColor(pos)}`, borderRadius:6, padding:'2px 4px', minWidth:50, textAlign:'center', boxShadow:'0 2px 8px rgba(0,0,0,.5)' }}>
                              <div style={{ fontSize:'.55rem', color:getPosTextColor(pos), fontWeight:700, letterSpacing:'.02em' }}>{pos}</div>
                              <div style={{ fontSize:'.75rem', fontWeight:900, color:'#fbbf24' }}>{player.overall}</div>
                              <div style={{ fontSize:'.52rem', fontWeight:700, color:'#fff', whiteSpace:'nowrap', maxWidth:52, overflow:'hidden', textOverflow:'ellipsis' }}>
                                {(player.name || '').split(' ').pop()}
                              </div>
                              {playerRoles[player.name] && (
                                <div style={{ fontSize:'.45rem', color:getPosTextColor(pos), marginTop:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:52 }}>
                                  {PLAYER_ROLES[pos]?.find(r => r.id === playerRoles[player.name])?.name?.split(' ')[0]}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div style={{ width:50, height:46, borderRadius:6, border:`1.5px dashed ${getPosTextColor(pos)}`, background:'rgba(0,0,0,.3)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2 }}>
                            <div style={{ fontSize:'.6rem', color:getPosTextColor(pos), fontWeight:700 }}>{pos}</div>
                            <div style={{ fontSize:'.5rem', color:'rgba(255,255,255,.3)' }}>Sürükle</div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Rol seçim paneli */}
                {selectedPlayerForRole && (
                  <div style={{ padding:'.75rem 1rem', borderTop:'1px solid #1e1e4a', background:'#0f0f2a', flexShrink:0 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'.5rem' }}>
                      <div style={{ fontWeight:700, fontSize:'.82rem' }}>{selectedPlayerForRole.name} — Rol Seç</div>
                      <button onClick={() => setSelectedPlayerForRole(null)} style={{ background:'none', border:'none', color:'#606080', cursor:'pointer', fontSize:'.8rem' }}>✕</button>
                    </div>
                    <div style={{ display:'flex', gap:'.4rem', flexWrap:'wrap' }}>
                      {(PLAYER_ROLES[selectedPlayerForRole.slotPos] || PLAYER_ROLES[selectedPlayerForRole.position] || []).map(role => (
                        <button key={role.id}
                          onClick={() => { setPlayerRoles(prev => ({ ...prev, [selectedPlayerForRole.name]: role.id })) }}
                          title={role.desc}
                          style={{ padding:'.3rem .65rem', borderRadius:7, border:`1.5px solid ${playerRoles[selectedPlayerForRole.name]===role.id?'#a78bfa':'#2a2a5a'}`, background:playerRoles[selectedPlayerForRole.name]===role.id?'rgba(124,58,237,.2)':'#12122a', color:playerRoles[selectedPlayerForRole.name]===role.id?'#a78bfa':'#606080', fontWeight:700, fontSize:'.72rem', cursor:'pointer' }}>
                          {role.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Yedek alanı */}
                <div style={{ borderTop:'1px solid #1e1e4a', padding:'.5rem .75rem', flexShrink:0, background:'rgba(0,0,0,.2)' }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={handleDropOnBench}
                >
                  <div style={{ fontSize:'.6rem', color:'#606080', fontWeight:700, letterSpacing:'.06em', marginBottom:'.4rem' }}>YEDEKLER ({bench.length}/7)</div>
                  <div style={{ display:'flex', gap:'.35rem', flexWrap:'wrap' }}>
                    {bench.map((player, i) => (
                      <div key={i} draggable onDragStart={() => handleDragStart(player, { type:'bench', index:i })}
                        style={{ position:'relative', cursor:'grab' }}>
                        <button onClick={() => removeFromBench(i)}
                          style={{ position:'absolute', top:-5, right:-5, width:13, height:13, borderRadius:'50%', background:'#ef4444', border:'none', color:'#fff', fontSize:7, fontWeight:900, cursor:'pointer', zIndex:10, display:'flex', alignItems:'center', justifyContent:'center', padding:0 }}>
                          ×
                        </button>
                        <div style={{ background:'#1a1a3a', border:'1px solid #2a2a5a', borderRadius:6, padding:'2px 5px', textAlign:'center', minWidth:44 }}>
                          <div style={{ fontSize:'.7rem', fontWeight:900, color:'#a0a0c0' }}>{player.overall}</div>
                          <div style={{ fontSize:'.5rem', color:'#606080', whiteSpace:'nowrap', maxWidth:44, overflow:'hidden', textOverflow:'ellipsis' }}>{(player.name||'').split(' ').pop()}</div>
                        </div>
                      </div>
                    ))}
                    {bench.length < 7 && Array.from({ length: 7 - bench.length }).map((_, i) => (
                      <div key={'eb'+i} style={{ width:44, height:38, borderRadius:6, border:'1px dashed #2a2a5a', background:'rgba(0,0,0,.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <span style={{ fontSize:'.55rem', color:'rgba(255,255,255,.2)' }}>Yedek</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Taktik ayarları */}
                <div style={{ borderTop:'1px solid #1e1e4a', padding:'.6rem 1rem', overflowY:'auto', flexShrink:0, maxHeight:200 }}>
                  <div style={{ fontSize:'.6rem', color:'#606080', fontWeight:700, letterSpacing:'.06em', marginBottom:'.5rem' }}>TAKTİKLER</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'.5rem' }}>
                    {Object.entries(TACTICS_CONFIG).map(([key, config]) => (
                      <div key={key}>
                        <div style={{ fontSize:'.6rem', color:'#a0a0c0', fontWeight:700, marginBottom:'.25rem' }}>{config.icon} {config.label}</div>
                        <select
                          value={tactics[key]}
                          onChange={e => setTactics(prev => ({ ...prev, [key]: e.target.value }))}
                          style={{ width:'100%', background:'#0f0f2a', border:'1px solid #2a2a5a', borderRadius:6, padding:'.25rem .4rem', color:'#a78bfa', fontSize:'.7rem', outline:'none', cursor:'pointer' }}
                        >
                          {config.options.map(opt => (
                            <option key={opt.id} value={opt.id}>{opt.name}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* SAĞ: Oyuncu Listesi */}
            <div style={{ display:'flex', flexDirection:'column', overflow:'hidden' }}>
              <div style={{ padding:'.75rem', borderBottom:'1px solid #1e1e4a', flexShrink:0 }}>
                <div style={{ fontWeight:800, fontSize:'.85rem' }}>Oyuncular</div>
                <div style={{ color:'#606080', fontSize:'.7rem' }}>Sürükle → sahaya veya yedek alanına bırak</div>
              </div>
              <div style={{ flex:1, overflowY:'auto', padding:'.5rem' }}>
                {unassigned.length === 0 && (
                  <div style={{ textAlign:'center', color:'#606080', fontSize:'.8rem', padding:'2rem' }}>Tüm oyuncular yerleştirildi!</div>
                )}
                {unassigned.map((player, i) => (
                  <div key={player.id || i} draggable
                    onDragStart={() => handleDragStart(player, { type:'list', index:i })}
                    style={{ display:'flex', alignItems:'center', gap:'.4rem', padding:'.4rem .5rem', borderRadius:7, marginBottom:'.25rem', background:'#12122a', border:'1px solid #1e1e4a', cursor:'grab' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor='#7c3aed'}
                    onMouseLeave={e => e.currentTarget.style.borderColor='#1e1e4a'}
                  >
                    <span style={{ background:getPosColor(player.position), color:getPosTextColor(player.position), fontSize:'.58rem', fontWeight:700, padding:'.1rem .3rem', borderRadius:4, minWidth:30, textAlign:'center', flexShrink:0 }}>{player.position}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:'.75rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{player.name}</div>
                      <div style={{ color:'#606080', fontSize:'.62rem' }}>{player.club}</div>
                    </div>
                    <div style={{ fontWeight:800, color:'#fbbf24', fontSize:'.82rem', flexShrink:0 }}>{player.overall}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PUAN TABLOSU */}
        {activeTab === 'standings' && (
          <div style={{ padding:'1.5rem', maxWidth:700, margin:'0 auto' }}>
            <div style={{ background:'#12122a', border:'1px solid #1e1e4a', borderRadius:14, overflow:'hidden' }}>
              <div style={{ padding:'1rem 1.25rem', borderBottom:'1px solid #1e1e4a' }}>
                <div style={{ fontSize:'.7rem', color:'#606080', fontWeight:700, letterSpacing:'.08em' }}>PUAN TABLOSU</div>
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'#0f0f2a' }}>
                    {['#','Takım','O','G','B','M','AG','YG','AV','P'].map(h => (
                      <th key={h} style={{ padding:'.6rem .75rem', textAlign:h==='Takım'?'left':'center', fontSize:'.68rem', color:'#606080', fontWeight:700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lobbyPlayers.map((player, i) => {
                    const stat = standings.find(s => s.user_id === player.user_id) || { played:0,wins:0,draws:0,losses:0,goals_for:0,goals_against:0,points:0 }
                    const isMe = player.user_id === userId
                    const av = (stat.goals_for||0) - (stat.goals_against||0)
                    return (
                      <tr key={player.id} style={{ borderTop:'1px solid #1e1e4a', background:isMe?'rgba(124,58,237,.08)':'transparent' }}>
                        <td style={{ padding:'.6rem .75rem', textAlign:'center', fontWeight:800, color:i===0?'#fbbf24':'#606080' }}>{i+1}</td>
                        <td style={{ padding:'.6rem .75rem' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
                            <LogoMini logo={isMe?club?.logo:null} size={22}/>
                            <span style={{ fontWeight:isMe?700:400, fontSize:'.85rem' }}>{player.team_name}</span>
                            {isMe && <span style={{ fontSize:'.6rem', color:'#7c3aed', fontWeight:700 }}>(sen)</span>}
                          </div>
                        </td>
                        {[stat.played,stat.wins,stat.draws,stat.losses,stat.goals_for,stat.goals_against,av>0?`+${av}`:av].map((v,j)=>(
                          <td key={j} style={{ padding:'.6rem .75rem', textAlign:'center', fontSize:'.85rem', color:'#a0a0c0' }}>{v}</td>
                        ))}
                        <td style={{ padding:'.6rem .75rem', textAlign:'center', fontWeight:800, fontSize:'.9rem', color:'#a78bfa' }}>{stat.points||0}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* HABERLER */}
        {activeTab === 'news' && (
          <div style={{ padding:'1.5rem', maxWidth:700, margin:'0 auto', display:'flex', flexDirection:'column', gap:'.75rem' }}>
            {news.map(n => (
              <div key={n.id} style={{ background:'#12122a', border:'1px solid #1e1e4a', borderRadius:12, padding:'1rem 1.25rem', display:'flex', gap:'1rem', alignItems:'flex-start' }}>
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
