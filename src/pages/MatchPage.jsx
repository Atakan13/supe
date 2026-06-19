import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PLAYER_CARDS } from '../lib/playerCards'

function getUserId() {
  let id = localStorage.getItem('draft_user_id')
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('draft_user_id', id) }
  return id
}

const TACTICS_CONFIG = {
  pressing:     { options:[{id:'gegenpressing',statBonus:{defending:8,pace:5}},{id:'high_press',statBonus:{defending:5,physical:3}},{id:'mid_press',statBonus:{defending:2}},{id:'low_block',statBonus:{defending:10,shooting:-3}}]},
  tempo:        { options:[{id:'fast',statBonus:{pace:8,passing:3}},{id:'normal',statBonus:{}},{id:'slow',statBonus:{passing:8,dribbling:5}}]},
  attack_width: { options:[{id:'wide',statBonus:{dribbling:6}},{id:'central',statBonus:{shooting:6,passing:4}},{id:'mixed',statBonus:{passing:3}}]},
  defense_line: { options:[{id:'high',statBonus:{defending:5,pace:-3}},{id:'standard',statBonus:{defending:2}},{id:'deep',statBonus:{defending:8,shooting:-5}}]},
  buildup:      { options:[{id:'short',statBonus:{passing:10,dribbling:5}},{id:'direct',statBonus:{shooting:5,physical:5}},{id:'counter',statBonus:{pace:10,shooting:5}}]},
  set_piece:    { options:[{id:'short',statBonus:{passing:5}},{id:'long',statBonus:{physical:8}}]},
}

const PLAYER_ROLES_BONUS = {
  sweeper_keeper:   {pace:10,passing:8},
  classic_gk:       {goalkeeper:5},
  ball_playing:     {passing:8,dribbling:5},
  stopper:          {defending:8,physical:5},
  libero:           {dribbling:8,passing:6},
  wing_back:        {pace:8,dribbling:6},
  full_back:        {defending:5,passing:5},
  inverted_wb:      {shooting:8,dribbling:6},
  anchor:           {defending:10},
  dlp:              {passing:10,dribbling:5},
  bwm:              {defending:8,physical:8},
  box_to_box:       {physical:8,shooting:5},
  carrilero:        {passing:8,defending:5},
  mezzala:          {shooting:8,dribbling:6},
  trequartista:     {dribbling:10,shooting:8},
  shadow_striker:   {shooting:10,pace:5},
  adv_playmaker:    {passing:10,dribbling:6},
  winger:           {pace:10,dribbling:6},
  inside_forward:   {shooting:10,dribbling:8},
  wide_pm:          {passing:10,dribbling:5},
  advanced_forward: {pace:8,shooting:6},
  target_man:       {physical:10,shooting:5},
  poacher:          {shooting:12},
  dlf:              {passing:8,dribbling:6},
}

const PLAYER_ROLES_NARRATIVE = {
  sweeper_keeper:   'ceza sahasından çıktı',
  classic_gk:       'çizgisinde bekledi',
  ball_playing:     'topa sahip çıkıp pas aradı',
  stopper:          'agresif müdahale yaptı',
  libero:           'öne çıkıp oyun kurdu',
  wing_back:        'kanat bekinden hücuma çıktı',
  full_back:        'pozisyonunu koruyarak çıktı',
  inverted_wb:      'içe kesip şut denedi',
  anchor:           'defans önünde durdu',
  dlp:              'derineden oyun kurdu',
  bwm:              'topu kazanmaya çalıştı',
  box_to_box:       'cezadan cezaya koştu',
  carrilero:        'yandan koşu yaptı',
  mezzala:          'içe kesip şut denedi',
  trequartista:     'serbest dolaşıp pozisyon aradı',
  shadow_striker:   'arkadan gelerek şut denedi',
  adv_playmaker:    'yaratıcı paslar attı',
  winger:           'kanat koşusu yaptı',
  inside_forward:   'içe keserek şut denedi',
  wide_pm:          'kanaldan oyun kurdu',
  advanced_forward: 'arkayı zorlayan koşu yaptı',
  target_man:       'sırtını dönerek top aldı',
  poacher:          'ceza sahasında pozisyon aldı',
  dlf:              'geriye düşüp oyun kurdu',
}

const TACTICS_NARRATIVE = {
  gegenpressing:  'yüksek baskıyla topu geri kazanmaya çalışıyor',
  high_press:     'rakip yarısında pres uyguluyor',
  mid_press:      'orta alanda blok oluşturuyor',
  low_block:      'kompakt blokla savunuyor',
  fast:           'yüksek tempoda oynuyor',
  normal:         'dengeli tempo tutuyor',
  slow:           'topla oynayarak tempo kırıyor',
  wide:           'kanatları etkin kullanıyor',
  central:        'merkezi hücum kuruyor',
  mixed:          'çeşitli bölgelerden hücum ediyor',
  high:           'yüksek savunma hattı tutuyor',
  standard:       'standart hat tutuyor',
  deep:           'derin savunma yapıyor',
  short:          'kısa paslarla oyun kuruyor',
  direct:         'direkt top oynuyor',
  counter:        'kontratak oynuyor',
  long:           'uzun duran top kullanıyor',
}

const ATK_ACTIONS = [
  { id:'shot',    label:'Şut Çek',   stat:'shooting',   emoji:'⚡' },
  { id:'dribble', label:'Çalım At',  stat:'dribbling',  emoji:'🔥' },
  { id:'cross',   label:'Orta Yap',  stat:'passing',    emoji:'📐' },
  { id:'pass',    label:'Pas Ver',   stat:'passing',    emoji:'↗️' },
  { id:'sprint',  label:'Hızlan',    stat:'pace',       emoji:'💨' },
]
const DEF_ACTIONS = [
  { id:'block',    label:'Önüne Geç',      stat:'defending', emoji:'🛡️' },
  { id:'tackle',   label:'Müdahale Et',    stat:'defending', emoji:'⚔️' },
  { id:'position', label:'Pozisyon Al',    stat:'defending', emoji:'📍' },
  { id:'press',    label:'Baskı Yap',      stat:'physical',  emoji:'💪' },
  { id:'let',      label:'Geçmesine İzin', stat:'pace',      emoji:'🏃' },
]
const GK_ACTIONS = [
  { id:'corner', label:'Köşeye At',       stat:'goalkeeper', emoji:'🥅' },
  { id:'catch',  label:'Tutmaya Çalış',   stat:'goalkeeper', emoji:'🧤' },
  { id:'punch',  label:'Yumrukla',        stat:'physical',   emoji:'👊' },
  { id:'dive',   label:'Dal',             stat:'goalkeeper', emoji:'🤸' },
]

const MATCH_MINUTES = [5,12,18,24,31,38,42,47,54,60,67,74,80,86,90]
const ZONES = ['sol kanattan','orta sahadan','sağ kanattan','ceza sahasından']

const ATK_NARRATIVES = {
  shot:    (p,z) => `${p} ${z} güçlü bir şut çekti!`,
  dribble: (p,z) => `${p} ${z} çalım atarak savunmayı geçmeye çalışıyor!`,
  cross:   (p,z) => `${p} ${z} tehlikeli bir orta yaptı!`,
  pass:    (p,z) => `${p} ${z} pas arıyor, açık adam buluyor!`,
  sprint:  (p,z) => `${p} ${z} hız yaparak defansın arkasına geçti!`,
}
const DEF_NARRATIVES = {
  block:    (p) => `${p} harika bir pozisyonla önünü kesti!`,
  tackle:   (p) => `${p} sert müdahaleyle topu kaptı!`,
  position: (p) => `${p} iyi pozisyon alarak tehlikeyi önledi!`,
  press:    (p) => `${p} sürekli baskıyla rakibi bunalttı!`,
  let:      (p) => `${p} geçmesine izin verdi, tehlike kapıda!`,
}
const GK_NARRATIVES = {
  corner: (p) => `${p} topu köşeye attı, büyük kurtarış!`,
  catch:  (p) => `${p} topu güvenle kavradı!`,
  punch:  (p) => `${p} yumrukla uzaklaştırdı!`,
  dive:   (p) => `${p} harika bir dalışla kurtardı!`,
}

function rollDice(min=1, max=20) { return Math.floor(Math.random()*(max-min+1))+min }

function calcPlayerStat(player, stat, tactics, playerRoles) {
  if (!player) return 50
  let base = player[stat] || 50

  // Taktik bonusu
  if (tactics) {
    Object.entries(tactics).forEach(([tKey, tVal]) => {
      const cfg = TACTICS_CONFIG[tKey]
      const opt = cfg?.options.find(o => o.id === tVal)
      if (opt?.statBonus?.[stat]) base += opt.statBonus[stat]
    })
  }

  // Rol bonusu
  if (playerRoles && player.name && playerRoles[player.name]) {
    const roleId = playerRoles[player.name]
    const bonus = PLAYER_ROLES_BONUS[roleId]
    if (bonus?.[stat]) base += bonus[stat]
  }

  return Math.min(99, Math.max(1, base))
}

export default function MatchPage() {
  const { matchId } = useParams()
  const navigate = useNavigate()
  const userId = getUserId()

  const [match, setMatch] = useState(null)
  const [lobby, setLobby] = useState(null)
  const [lobbyPlayers, setLobbyPlayers] = useState([])
  const [mySquad, setMySquad] = useState(null)
  const [opSquad, setOpSquad] = useState(null)
  const [myTactics, setMyTactics] = useState({})
  const [myRoles, setMyRoles] = useState({})
  const [opTactics, setOpTactics] = useState({})
  const [opRoles, setOpRoles] = useState({})

  const [homeScore, setHomeScore] = useState(0)
  const [awayScore, setAwayScore] = useState(0)
  const [matchMinute, setMatchMinute] = useState(0)
  const [isFinished, setIsFinished] = useState(false)

  const [commentary, setCommentary] = useState([])
  const [phase, setPhase] = useState('watching') // watching | pick_attacker | pick_defender | pick_gk | waiting | resolved
  const [currentEvent, setCurrentEvent] = useState(null)
  const [myRole, setMyRole] = useState(null) // 'attacker' | 'defender' | 'goalkeeper'

  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [selectedAction, setSelectedAction] = useState(null)
  const [myActionSubmitted, setMyActionSubmitted] = useState(false)

  const [lastResult, setLastResult] = useState(null)
  const [loading, setLoading] = useState(true)

  // İstatistikler
  const [stats, setStats] = useState({
    home: { shots:0, shotsOnTarget:0, possession:50, passes:0, tackles:0, fouls:0, corners:0 },
    away: { shots:0, shotsOnTarget:0, possession:50, passes:0, tackles:0, fouls:0, corners:0 },
  })

  const commentaryRef = useRef(null)
  const channelRef = useRef(null)
  const matchRef = useRef(null)
  const engineRunning = useRef(false)

  useEffect(() => {
    init()
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [matchId])

  const init = async () => {
    const { data: m } = await supabase.from('matches').select('*').eq('id', matchId).maybeSingle()
    if (!m) return
    setMatch(m)
    matchRef.current = m
    setHomeScore(m.home_score || 0)
    setAwayScore(m.away_score || 0)
    if (m.status === 'finished') setIsFinished(true)

    const { data: lb } = await supabase.from('lobbies').select('*').eq('id', m.lobby_id).maybeSingle()
    setLobby(lb)

    const { data: pl } = await supabase.from('lobby_players').select('*').eq('lobby_id', m.lobby_id).order('joined_at')
    setLobbyPlayers(pl || [])

    const opId = m.home_user_id === userId ? m.away_user_id : m.home_user_id

    const { data: myS } = await supabase.from('squads').select('*').eq('lobby_id', m.lobby_id).eq('user_id', userId).maybeSingle()
    const { data: opS } = await supabase.from('squads').select('*').eq('lobby_id', m.lobby_id).eq('user_id', opId).maybeSingle()

    setMySquad(myS)
    setOpSquad(opS)
    setMyTactics(myS?.tactics || {})
    setMyRoles(myS?.player_roles || {})
    setOpTactics(opS?.tactics || {})
    setOpRoles(opS?.player_roles || {})

    setLoading(false)

    // Realtime
    channelRef.current = supabase.channel('match-' + matchId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'match_events', filter: `match_id=eq.${matchId}` }, p => handleNewEvent(p.new))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'match_events', filter: `match_id=eq.${matchId}` }, p => handleEventUpdate(p.new))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` }, p => {
        const updated = p.new
        setHomeScore(updated.home_score || 0)
        setAwayScore(updated.away_score || 0)
        if (updated.status === 'finished') {
          setIsFinished(true)
          setPhase('watching')
          addCommentary('🏁 MAÇ SONA ERDİ!', 'goal')
          // Sezon istatistiklerini güncelle
          updateSeasonStats(updated, m.lobby_id, pl || [])
        }
      })
      .subscribe()

    // Host maç motorunu başlatır
    const isHost = (pl || []).find(p => p.user_id === userId)?.is_host
    const { data: existingEvents } = await supabase.from('match_events').select('id').eq('match_id', matchId).limit(1)
    if (isHost && (!existingEvents || existingEvents.length === 0) && m.status === 'active') {
      setTimeout(() => runMatchEngine(m, myS, opS, pl || []), 1500)
    } else {
      // Mevcut yorumları yükle
      const { data: events } = await supabase.from('match_events').select('*').eq('match_id', matchId).order('created_at')
      if (events) {
        events.forEach(ev => {
          if (ev.narrative_text) addCommentary(ev.narrative_text, ev.event_type === 'goal' ? 'goal' : ev.event_type === 'attack' ? 'attack' : 'normal')
        })
      }
    }
  }

  const updateSeasonStats = async (match, lobbyId, players) => {
    const homeScore = match.home_score || 0
    const awayScore = match.away_score || 0
    const homeUserId = match.home_user_id
    const awayUserId = match.away_user_id

    const homeWin = homeScore > awayScore
    const awayWin = awayScore > homeScore
    const draw = homeScore === awayScore

    for (const [uid, gf, ga, win, lose] of [
      [homeUserId, homeScore, awayScore, homeWin, awayWin],
      [awayUserId, awayScore, homeScore, awayWin, homeWin],
    ]) {
      const teamName = players.find(p => p.user_id === uid)?.team_name || ''
      const { data: ex } = await supabase.from('season_stats').select('*').eq('lobby_id', lobbyId).eq('user_id', uid).maybeSingle()
      const upd = {
        lobby_id: lobbyId, user_id: uid, team_name: teamName,
        played: (ex?.played||0)+1,
        wins: (ex?.wins||0)+(win?1:0),
        draws: (ex?.draws||0)+(draw?1:0),
        losses: (ex?.losses||0)+(lose?1:0),
        goals_for: (ex?.goals_for||0)+gf,
        goals_against: (ex?.goals_against||0)+ga,
        points: (ex?.points||0)+(win?3:draw?1:0),
      }
      if (ex) await supabase.from('season_stats').update(upd).eq('id', ex.id)
      else await supabase.from('season_stats').insert(upd)
    }
  }

  const addCommentary = (text, type='normal') => {
    setCommentary(prev => {
      const updated = [...prev.slice(-30), { text, type, id: Date.now() + Math.random() }]
      setTimeout(() => { if (commentaryRef.current) commentaryRef.current.scrollTop = commentaryRef.current.scrollHeight }, 50)
      return updated
    })
  }

  const handleNewEvent = (ev) => {
    if (!ev) return
    setMatchMinute(ev.minute || 0)
    setStats(prev => updateMatchStats(prev, ev))

    if (ev.event_type === 'narrative') {
      addCommentary(ev.narrative_text || '', 'normal')
      return
    }
    if (ev.event_type === 'goal') {
      addCommentary(`⚽ GOL! ${ev.narrative_text || ''}`, 'goal')
      return
    }
    if (ev.event_type === 'attack') {
      addCommentary(`🔥 ${ev.narrative_text || ''}`, 'attack')
      setCurrentEvent(ev)
      setMyActionSubmitted(false)
      setSelectedPlayer(null)
      setSelectedAction(null)
      if (ev.attacking_user === userId) {
        setMyRole('attacker')
        setPhase('pick_attacker')
      } else {
        setMyRole('defender')
        setPhase('pick_defender')
      }
    }
    if (ev.event_type === 'shot') {
      addCommentary(`🥅 ${ev.narrative_text || 'Şut geliyor!'}`, 'attack')
      setCurrentEvent(ev)
      setMyActionSubmitted(false)
      setSelectedPlayer(null)
      setSelectedAction(null)
      if (ev.defending_user === userId) {
        setMyRole('goalkeeper')
        setPhase('pick_gk')
      } else {
        addCommentary('Kaleci hazırlanıyor...', 'normal')
      }
    }
  }

  const handleEventUpdate = (ev) => {
    if (ev.action_phase === 'resolved') {
      setPhase('watching')
      setLastResult(ev)
      const msgs = {
        goal:           '⚽ GOOOL! Muhteşem!',
        save:           '🧤 Kaleci kurtardı! Harika refleks!',
        attack_success: '✅ Atak başarılı! Şut pozisyonu...',
        attack_fail:    '❌ Savunma kesti! Top uzaklaştırıldı.',
        no_goal:        '😤 Az kaldı! Top direkten döndü.',
      }
      addCommentary(msgs[ev.result] || '...', ev.result === 'goal' ? 'goal' : 'normal')
      setTimeout(() => setLastResult(null), 4000)
    }
  }

  const updateMatchStats = (prev, ev) => {
    const isHome = ev.attacking_user === matchRef.current?.home_user_id
    const side = isHome ? 'home' : 'away'
    const defSide = isHome ? 'away' : 'home'
    const updated = { home: { ...prev.home }, away: { ...prev.away } }
    if (ev.event_type === 'attack') {
      updated[side].passes = (updated[side].passes||0) + 1
      updated[defSide].tackles = (updated[defSide].tackles||0) + 1
    }
    if (ev.event_type === 'shot') {
      updated[side].shots = (updated[side].shots||0) + 1
      updated[side].shotsOnTarget = (updated[side].shotsOnTarget||0) + 1
    }
    if (ev.event_type === 'goal') {
      updated[side].shots = (updated[side].shots||0) + 1
    }
    // Topla oynama
    const totalPasses = (updated.home.passes||0) + (updated.away.passes||0)
    if (totalPasses > 0) {
      updated.home.possession = Math.round((updated.home.passes||0) / totalPasses * 100)
      updated.away.possession = 100 - updated.home.possession
    }
    return updated
  }

  const submitAction = async () => {
    if (!selectedPlayer || !selectedAction || !currentEvent || myActionSubmitted) return
    setMyActionSubmitted(true)
    setPhase('waiting')

    const actionData = {
      match_id: matchId,
      event_id: currentEvent.id,
      user_id: userId,
      role: myRole,
      selected_player_id: selectedPlayer.id,
      action_choice: selectedAction.id,
    }
    await supabase.from('match_actions').insert(actionData)

    const actionStat = calcPlayerStat(selectedPlayer, selectedAction.stat, myTactics, myRoles)
    const roll = rollDice()
    const narrativeFn = myRole === 'attacker'
      ? ATK_NARRATIVES[selectedAction.id]
      : myRole === 'goalkeeper'
      ? GK_NARRATIVES[selectedAction.id]
      : DEF_NARRATIVES[selectedAction.id]

    const roleNarr = myRoles[selectedPlayer.name] ? PLAYER_ROLES_NARRATIVE[myRoles[selectedPlayer.name]] : null
    const narrative = narrativeFn
      ? narrativeFn(selectedPlayer.name.split(' ').pop(), currentEvent.zone || 'sol kanattan')
      : `${selectedPlayer.name} hamle yaptı`
    const fullNarr = roleNarr ? `${narrative} (${roleNarr})` : narrative
    addCommentary(`✅ ${fullNarr} [${actionStat}+${roll}=${actionStat+roll}]`, 'normal')
  }

  // MAÇ MOTORU
  const runMatchEngine = async (m, myS, opS, players) => {
    if (engineRunning.current) return
    engineRunning.current = true

    const homeUser = players[0]
    const awayUser = players[1]
    if (!homeUser || !awayUser) return

    let currentHomeScore = 0
    let currentAwayScore = 0

    const getTacticNarr = (tactics) => {
      if (!tactics) return ''
      const parts = []
      if (tactics.pressing) parts.push(TACTICS_NARRATIVE[tactics.pressing] || '')
      if (tactics.buildup) parts.push(TACTICS_NARRATIVE[tactics.buildup] || '')
      return parts.filter(Boolean).join(', ')
    }

    const homeNarr = getTacticNarr(myS?.tactics)
    const awayNarr = getTacticNarr(opS?.tactics)

    // Giriş anlatısı
    await supabase.from('match_events').insert({ match_id: m.id, minute: 0, event_type: 'narrative', action_phase: 'resolved',
      narrative_text: `Maç başlıyor! ${homeUser.team_name} ${homeNarr ? homeNarr + ' oynuyor' : 'sahaya çıkıyor'}.`})
    await sleep(2000)
    await supabase.from('match_events').insert({ match_id: m.id, minute: 0, event_type: 'narrative', action_phase: 'resolved',
      narrative_text: `${awayUser.team_name} ${awayNarr ? awayNarr + ' oynuyor' : 'hazır durumda'}.`})

    for (let i = 0; i < MATCH_MINUTES.length; i++) {
      await sleep(4000)
      const minute = MATCH_MINUTES[i]

      // Dakika anlatısı
      const minuteNarrs = [
        `${minute}. dakikada oyun kızışıyor!`,
        `${minute}. dakikada tempo artıyor!`,
        `${minute}. dakika, kritik bir an yaklaşıyor!`,
        `${minute}. dakikada sahada mücadele kıyasıya!`,
      ]
      await supabase.from('match_events').insert({ match_id: m.id, minute, event_type: 'narrative', action_phase: 'resolved',
        narrative_text: minuteNarrs[Math.floor(Math.random()*minuteNarrs.length)]})
      await sleep(2000)

      // Atak yönü - taktiklere göre ağırlıklı
      const homeSquad = myS?.lineup || []
      const awaySquad = opS?.lineup || []
      const homeTactics = myS?.tactics || {}
      const awayTactics = opS?.tactics || {}

      // Kontratak oynayan takım daha az hücum başlatır ama daha tehlikeli
      const homeAttackChance = homeTactics.buildup === 'counter' ? 0.35 : homeTactics.buildup === 'direct' ? 0.55 : 0.50
      const attackingHome = Math.random() < homeAttackChance
      const attackingUser = attackingHome ? homeUser.user_id : awayUser.user_id
      const defendingUser = attackingHome ? awayUser.user_id : homeUser.user_id
      const atkSquad = attackingHome ? homeSquad : awaySquad
      const defSquad = attackingHome ? awaySquad : homeSquad
      const atkTactics = attackingHome ? homeTactics : awayTactics
      const defTactics = attackingHome ? awayTactics : homeTactics
      const atkRoles = attackingHome ? (myS?.player_roles||{}) : (opS?.player_roles||{})
      const defRoles = attackingHome ? (opS?.player_roles||{}) : (myS?.player_roles||{})
      const atkTeam = attackingHome ? homeUser.team_name : awayUser.team_name
      const defTeam = attackingHome ? awayUser.team_name : homeUser.team_name

      // Atak oyuncusu seç (hücum oyuncularına öncelik)
      const fwdPlayers = atkSquad.filter(p => ['ST','CF','LW','RW','LM','RM','CAM'].includes(p.squad_pos || p.position))
      const atkPlayer = fwdPlayers.length > 0
        ? fwdPlayers[Math.floor(Math.random()*fwdPlayers.length)]
        : atkSquad[Math.floor(Math.random()*Math.min(5,atkSquad.length))]

      // Savunma oyuncusu seç
      const defPlayers = defSquad.filter(p => ['CB','LB','RB','CDM'].includes(p.squad_pos || p.position))
      const defPlayer = defPlayers.length > 0
        ? defPlayers[Math.floor(Math.random()*defPlayers.length)]
        : defSquad[Math.floor(Math.random()*Math.min(5,defSquad.length))]

      // Zone seç - taktiklere göre
      let zonePool = ZONES
      if (atkTactics.attack_width === 'wide') zonePool = ['sol kanattan','sağ kanattan','sol kanattan','sağ kanattan']
      else if (atkTactics.attack_width === 'central') zonePool = ['orta sahadan','ceza sahasından','orta sahadan']
      const zone = zonePool[Math.floor(Math.random()*zonePool.length)]

      const atkPlayerName = atkPlayer?.name || atkTeam
      const atkNarrKey = ['shot','dribble','cross','pass','sprint'][Math.floor(Math.random()*5)]
      const narrativeFn = ATK_NARRATIVES[atkNarrKey]
      const narrative = narrativeFn ? narrativeFn(atkPlayerName.split(' ').pop(), zone) : `${atkPlayerName} ${zone} tehlikeli geliyor!`

      const { data: attackEvent } = await supabase.from('match_events').insert({
        match_id: m.id, minute, event_type: 'attack',
        attacking_user: attackingUser, defending_user: defendingUser,
        zone, narrative_text: narrative, action_phase: 'pending',
      }).select().single()

      if (!attackEvent) continue

      // Kullanıcı hamlelerini bekle (12 saniye)
      await sleep(12000)

      // Hala pending mi? Otomatik çöz
      const { data: pendingCheck } = await supabase.from('match_events').select('action_phase').eq('id', attackEvent.id).maybeSingle()
      if (!pendingCheck || pendingCheck.action_phase !== 'pending') continue

      // Kullanıcı hamlelerini al
      const { data: actions } = await supabase.from('match_actions').select('*').eq('event_id', attackEvent.id)
      const atkAction = actions?.find(a => a.role === 'attacker')
      const defAction = actions?.find(a => a.role === 'defender')

      // Stat hesapla
      const atkStatKey = atkAction ? (ATK_ACTIONS.find(a=>a.id===atkAction.action_choice)?.stat || 'shooting') : 'dribbling'
      const defStatKey = defAction ? (DEF_ACTIONS.find(a=>a.id===defAction.action_choice)?.stat || 'defending') : 'defending'

      // Oyuncu stat'larını taktik ve rol bonusuyla hesapla
      const atkStatVal = atkPlayer ? calcPlayerStat(
        PLAYER_CARDS.find(c=>c.name===atkPlayer.name) || atkPlayer,
        atkStatKey, atkTactics, atkRoles
      ) : 65

      const defStatVal = defPlayer ? calcPlayerStat(
        PLAYER_CARDS.find(c=>c.name===defPlayer.name) || defPlayer,
        defStatKey, defTactics, defRoles
      ) : 65

      const atkRoll = rollDice()
      const defRoll = rollDice()
      const atkTotal = atkStatVal + atkRoll
      const defTotal = defStatVal + defRoll

      const atkWins = atkTotal > defTotal

      if (atkWins) {
        // Şut aşaması
        const shootStat = atkPlayer ? calcPlayerStat(
          PLAYER_CARDS.find(c=>c.name===atkPlayer.name) || atkPlayer,
          'shooting', atkTactics, atkRoles
        ) : 65

        // Kaleci seç
        const gkPlayer = defSquad.find(p => p.position === 'GK' || p.squad_pos === 'GK')
        const gkStatVal = gkPlayer ? calcPlayerStat(
          PLAYER_CARDS.find(c=>c.name===gkPlayer.name) || gkPlayer,
          'goalkeeper', defTactics, defRoles
        ) : 70

        // Kullanıcı GK hamlesi varsa
        const gkAction = actions?.find(a => a.role === 'goalkeeper')
        const gkBonus = gkAction ? 5 : 0

        const shootRoll = rollDice()
        const gkRoll = rollDice()
        const shootTotal = shootStat + shootRoll
        const gkTotal = gkStatVal + gkRoll + gkBonus

        const isGoal = shootTotal > gkTotal

        // Şut eventi
        await supabase.from('match_events').insert({
          match_id: m.id, minute, event_type: 'shot',
          attacking_user: attackingUser, defending_user: defendingUser,
          action_phase: 'resolved',
          narrative_text: `${atkPlayerName.split(' ').pop()} ceza sahasından güçlü şut! [${shootTotal} vs ${gkTotal}]`,
        })
        await sleep(2000)

        if (isGoal) {
          if (attackingHome) currentHomeScore++
          else currentAwayScore++

          await supabase.from('matches').update({
            home_score: currentHomeScore,
            away_score: currentAwayScore,
          }).eq('id', m.id)

          const goalNarrs = [
            `⚽ GOOOL! ${atkPlayerName.split(' ').pop()} attı! ${atkTeam} öne geçiyor!`,
            `⚽ GOOOL! Muhteşem bir gol! ${atkPlayerName.split(' ').pop()} tarihe geçiyor!`,
            `⚽ GOOOL! ${atkTeam} fırsatı değerlendirdi! ${atkPlayerName.split(' ').pop()} imzasını attı!`,
          ]
          await supabase.from('match_events').insert({
            match_id: m.id, minute, event_type: 'goal', action_phase: 'resolved',
            narrative_text: goalNarrs[Math.floor(Math.random()*goalNarrs.length)],
          })
          await supabase.from('match_events').update({
            action_phase:'resolved', result:'goal', attacker_total:atkTotal, defender_total:defTotal,
            attacker_roll:atkRoll, defender_roll:defRoll,
          }).eq('id', attackEvent.id)
        } else {
          const saveNarrs = [
            `🧤 ${gkPlayer?.name?.split(' ').pop() || 'Kaleci'} inanılmaz bir kurtarış yaptı!`,
            `🧤 Direkten döndü! ${defTeam} şansını korudu!`,
            `🧤 ${gkPlayer?.name?.split(' ').pop() || 'Kaleci'} harika refleksle kurtardı!`,
          ]
          await supabase.from('match_events').update({
            action_phase:'resolved', result:'save', attacker_total:atkTotal, defender_total:defTotal,
            attacker_roll:atkRoll, defender_roll:defRoll,
            narrative_text: saveNarrs[Math.floor(Math.random()*saveNarrs.length)],
          }).eq('id', attackEvent.id)
        }
      } else {
        const failNarrs = [
          `❌ ${defPlayer?.name?.split(' ').pop() || 'Savunma'} topu kaptı! ${defTeam} tehlikeyi atlattı!`,
          `❌ Harika savunma! ${defPlayer?.name?.split(' ').pop() || 'Savunmacı'} rakibini geçirmedi!`,
          `❌ ${defTeam} savunması sağlam! Top uzaklaştırıldı.`,
        ]
        await supabase.from('match_events').update({
          action_phase:'resolved', result:'attack_fail', attacker_total:atkTotal, defender_total:defTotal,
          attacker_roll:atkRoll, defender_roll:defRoll,
          narrative_text: failNarrs[Math.floor(Math.random()*failNarrs.length)],
        }).eq('id', attackEvent.id)
      }

      await sleep(2000)
    }

    // Maç sonu
    const finalNarrs = [
      `Hakeme göre uzatma dakikaları doldu. MAÇ BİTTİ!`,
      `Düdük çalıyor! ${currentHomeScore} - ${currentAwayScore} sonuçla maç tamamlandı!`,
    ]
    await supabase.from('match_events').insert({ match_id: m.id, minute:90, event_type:'narrative', action_phase:'resolved',
      narrative_text: finalNarrs[Math.floor(Math.random()*finalNarrs.length)]})

    await supabase.from('matches').update({ status:'finished' }).eq('id', m.id)
    engineRunning.current = false
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

  const myTeam = lobbyPlayers.find(p => p.user_id === userId)
  const opTeam = lobbyPlayers.find(p => p.user_id !== userId)
  const isHome = match?.home_user_id === userId

  const myLineup = mySquad?.lineup || []
  const attackerCandidates = myLineup.filter(p => ['ST','CF','LW','RW','LM','RM','CAM','CM'].includes(p.squad_pos||p.position))
  const defenderCandidates = myLineup.filter(p => ['CB','LB','RB','CDM','CM'].includes(p.squad_pos||p.position))
  const gkCandidates = myLineup.filter(p => p.position==='GK' || p.squad_pos==='GK')

  const actionsToShow = phase==='pick_attacker' ? ATK_ACTIONS : phase==='pick_gk' ? GK_ACTIONS : DEF_ACTIONS
  const playersToShow = phase==='pick_attacker' ? attackerCandidates : phase==='pick_gk' ? gkCandidates : defenderCandidates

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#0a0a1a', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ color:'#a0a0c0' }}>Maç yükleniyor...</div>
    </div>
  )

  return (
    <div style={{ height:'100vh', background:'#0a0a1a', display:'flex', flexDirection:'column', overflow:'hidden' }}>

      {/* SKOR BAR */}
      <div style={{ background:'#0f0f2a', borderBottom:'1px solid #1e1e4a', padding:'.75rem 1.5rem', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ flex:1, textAlign:'center' }}>
          <div style={{ fontWeight:800, fontSize:'.9rem' }}>{isHome ? '🏠 ' : ''}{myTeam?.team_name}</div>
          <div style={{ fontSize:'.65rem', color:'#606080' }}>{mySquad?.formation || '?'}</div>
        </div>
        <div style={{ textAlign:'center', padding:'0 2rem' }}>
          <div style={{ fontSize:'2.8rem', fontWeight:900, letterSpacing:'.1em', lineHeight:1 }}>
            <span style={{ color: isHome && homeScore > awayScore ? '#10b981' : '#fff' }}>{homeScore}</span>
            <span style={{ color:'#606080', margin:'0 .4rem' }}>-</span>
            <span style={{ color: !isHome && awayScore > homeScore ? '#10b981' : '#fff' }}>{awayScore}</span>
          </div>
          <div style={{ color: isFinished ? '#fbbf24' : '#606080', fontSize:'.72rem', fontWeight:600, marginTop:'.1rem' }}>
            {isFinished ? '⏱ MAÇ BİTTİ' : `⏱ ${matchMinute}'`}
          </div>
        </div>
        <div style={{ flex:1, textAlign:'center' }}>
          <div style={{ fontWeight:800, fontSize:'.9rem' }}>{!isHome ? '🏠 ' : ''}{opTeam?.team_name}</div>
          <div style={{ fontSize:'.65rem', color:'#606080' }}>{opSquad?.formation || '?'}</div>
        </div>
      </div>

      {/* ANA İÇERİK */}
      <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 320px', overflow:'hidden' }}>

        {/* SOL: Hamle + Saha */}
        <div style={{ display:'flex', flexDirection:'column', overflow:'hidden', borderRight:'1px solid #1e1e4a' }}>

          {/* Hamle paneli */}
          {(phase==='pick_attacker'||phase==='pick_defender'||phase==='pick_gk') && (
            <div style={{ background: phase==='pick_attacker'?'rgba(239,68,68,.15)':'rgba(59,130,246,.15)', borderBottom:'2px solid', borderColor: phase==='pick_attacker'?'#ef4444':'#3b82f6', padding:'1rem 1.25rem', flexShrink:0 }}>
              <div style={{ fontWeight:800, fontSize:'.9rem', marginBottom:'.75rem', color: phase==='pick_attacker'?'#f87171':'#60a5fa' }}>
                {phase==='pick_attacker'?'⚡ ATAK HAMLESİ SEÇ':phase==='pick_gk'?'🧤 KALECİ HAMLESİ':'🛡️ SAVUNMA HAMLESİ'}
                <span style={{ fontSize:'.7rem', color:'#606080', fontWeight:400, marginLeft:'.75rem' }}>Hızlı seç! Süre dolunca otomatik hesaplanır.</span>
              </div>

              {/* Oyuncu seç */}
              <div style={{ marginBottom:'.6rem' }}>
                <div style={{ fontSize:'.62rem', color:'#606080', fontWeight:700, letterSpacing:'.06em', marginBottom:'.35rem' }}>OYUNCU SEÇ</div>
                <div style={{ display:'flex', gap:'.4rem', overflowX:'auto', paddingBottom:'.25rem' }}>
                  {playersToShow.map((p, i) => {
                    const card = PLAYER_CARDS.find(c=>c.name===p.name) || p
                    const isSelected = selectedPlayer?.name===p.name
                    return (
                      <div key={i} onClick={() => setSelectedPlayer(card)}
                        style={{ flexShrink:0, background:isSelected?'rgba(124,58,237,.3)':'#12122a', border:`1.5px solid ${isSelected?'#a78bfa':'#2a2a5a'}`, borderRadius:8, padding:'.4rem .6rem', cursor:'pointer', minWidth:72, textAlign:'center', transition:'all .1s' }}>
                        <div style={{ fontSize:'.85rem', fontWeight:900, color:'#fbbf24' }}>{card.overall}</div>
                        <div style={{ fontSize:'.6rem', fontWeight:700, color:'#fff', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:70 }}>{(p.name||'').split(' ').pop()}</div>
                        <div style={{ fontSize:'.55rem', color:'#606080' }}>{p.squad_pos||p.position}</div>
                        {myRoles[p.name] && <div style={{ fontSize:'.48rem', color:'#a78bfa', marginTop:1 }}>{myRoles[p.name].replace('_',' ')}</div>}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Hamle seç */}
              <div style={{ marginBottom:'.75rem' }}>
                <div style={{ fontSize:'.62rem', color:'#606080', fontWeight:700, letterSpacing:'.06em', marginBottom:'.35rem' }}>HAMLEYİ SEÇ</div>
                <div style={{ display:'flex', gap:'.4rem', flexWrap:'wrap' }}>
                  {actionsToShow.map(action => {
                    const isSelected = selectedAction?.id===action.id
                    const statVal = selectedPlayer ? calcPlayerStat(selectedPlayer, action.stat, myTactics, myRoles) : '?'
                    return (
                      <button key={action.id} onClick={() => setSelectedAction(action)}
                        style={{ padding:'.4rem .75rem', borderRadius:8, border:`1.5px solid ${isSelected?'#a78bfa':'#2a2a5a'}`, background:isSelected?'rgba(124,58,237,.25)':'#12122a', color:isSelected?'#a78bfa':'#a0a0c0', fontWeight:700, fontSize:'.78rem', cursor:'pointer', display:'flex', alignItems:'center', gap:'.3rem' }}>
                        <span>{action.emoji}</span>
                        <span>{action.label}</span>
                        {selectedPlayer && <span style={{ color:'#fbbf24', fontSize:'.7rem' }}>[{statVal}]</span>}
                      </button>
                    )
                  })}
                </div>
              </div>

              <button onClick={submitAction} disabled={!selectedPlayer||!selectedAction}
                style={{ padding:'.6rem 1.5rem', borderRadius:9, border:'none', background:selectedPlayer&&selectedAction?'#7c3aed':'#1e1e4a', color:selectedPlayer&&selectedAction?'#fff':'#606080', fontWeight:800, fontSize:'.88rem', cursor:selectedPlayer&&selectedAction?'pointer':'not-allowed', transition:'all .2s' }}>
                HAMLE GÖNDER →
              </button>
            </div>
          )}

          {phase==='waiting' && (
            <div style={{ background:'rgba(16,185,129,.1)', borderBottom:'2px solid #10b981', padding:'.75rem 1.25rem', flexShrink:0, display:'flex', alignItems:'center', gap:'.75rem' }}>
              <div style={{ animation:'spin 1s linear infinite', fontSize:'1.2rem' }}>⏳</div>
              <div>
                <div style={{ fontWeight:700, color:'#10b981', fontSize:'.88rem' }}>Hamlen gönderildi!</div>
                <div style={{ color:'#606080', fontSize:'.75rem' }}>{selectedPlayer?.name} → {selectedAction?.label}</div>
              </div>
            </div>
          )}

          {/* Son sonuç */}
          {lastResult && (
            <div style={{ background: lastResult.result==='goal'?'rgba(251,191,36,.15)':'rgba(124,58,237,.1)', borderBottom:`2px solid ${lastResult.result==='goal'?'#fbbf24':'#7c3aed'}`, padding:'.75rem 1.25rem', flexShrink:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:'1rem' }}>
                <div style={{ fontSize:'2rem' }}>{lastResult.result==='goal'?'⚽':lastResult.result==='save'?'🧤':lastResult.result==='attack_success'?'✅':'❌'}</div>
                <div>
                  <div style={{ fontWeight:800, color: lastResult.result==='goal'?'#fbbf24':'#a78bfa', fontSize:'.95rem' }}>
                    {lastResult.result==='goal'?'GOOOL!':lastResult.result==='save'?'Kurtarış!':lastResult.result==='attack_success'?'Başarılı Atak!':'Savunma Kesti!'}
                  </div>
                  <div style={{ color:'#606080', fontSize:'.75rem' }}>
                    Atak: {lastResult.attacker_total} vs Savunma: {lastResult.defender_total} (Zar: {lastResult.attacker_roll} vs {lastResult.defender_roll})
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* İstatistikler */}
          <div style={{ flex:1, overflowY:'auto', padding:'1rem 1.25rem' }}>
            <div style={{ fontSize:'.65rem', color:'#606080', fontWeight:700, letterSpacing:'.08em', marginBottom:'1rem' }}>MAÇ İSTATİSTİKLERİ</div>

            {[
              ['Topla Oynama', `${stats.home.possession}%`, `${stats.away.possession}%`],
              ['Şutlar', stats.home.shots, stats.away.shots],
              ['İsabetli Şutlar', stats.home.shotsOnTarget, stats.away.shotsOnTarget],
              ['Paslar', stats.home.passes, stats.away.passes],
              ['Top Kapma', stats.home.tackles, stats.away.tackles],
              ['Goller', homeScore, awayScore],
            ].map(([label, home, away]) => {
              const homeNum = parseFloat(home) || 0
              const awayNum = parseFloat(away) || 0
              const total = homeNum + awayNum || 1
              const homeW = Math.round(homeNum/total*100)
              return (
                <div key={label} style={{ marginBottom:'1rem' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'.35rem', fontSize:'.82rem' }}>
                    <span style={{ fontWeight:700, color: isHome && homeNum > awayNum ? '#10b981' : '#fff' }}>{home}</span>
                    <span style={{ color:'#606080', fontSize:'.72rem' }}>{label}</span>
                    <span style={{ fontWeight:700, color: !isHome && awayNum > homeNum ? '#10b981' : '#fff' }}>{away}</span>
                  </div>
                  <div style={{ height:5, background:'#1e1e4a', borderRadius:3, overflow:'hidden', display:'flex' }}>
                    <div style={{ width:`${homeW}%`, background: isHome?'#7c3aed':'#2a2a5a', transition:'width .5s' }}/>
                    <div style={{ flex:1, background: !isHome?'#7c3aed':'#2a2a5a' }}/>
                  </div>
                </div>
              )
            })}

            {isFinished && (
              <div style={{ marginTop:'1.5rem', textAlign:'center' }}>
                <div style={{ fontSize:'1.5rem', fontWeight:900, marginBottom:'.5rem', color:'#fbbf24' }}>
                  {homeScore > awayScore ? (isHome?'🏆 KAZANDIN!':'😔 Kaybettin') :
                   awayScore > homeScore ? (isHome?'😔 Kaybettin':'🏆 KAZANDIN!') : '🤝 Beraberlik!'}
                </div>
                <div style={{ fontSize:'2rem', fontWeight:900, marginBottom:'1rem' }}>{homeScore} - {awayScore}</div>
                <button onClick={() => navigate(`/game/${lobby?.code}`)}
                  style={{ padding:'.75rem 1.5rem', borderRadius:10, border:'none', background:'#7c3aed', color:'#fff', fontWeight:700, cursor:'pointer', fontSize:'.9rem' }}>
                  Ana Menüye Dön
                </button>
              </div>
            )}
          </div>
        </div>

        {/* SAĞ: Spiker */}
        <div style={{ display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ padding:'.75rem 1rem', borderBottom:'1px solid #1e1e4a', flexShrink:0, background:'#0f0f2a' }}>
            <div style={{ fontWeight:800, fontSize:'.88rem' }}>📺 Maç Anlatısı</div>
            <div style={{ color:'#606080', fontSize:'.68rem' }}>Canlı spiker yorumları</div>
          </div>

          <div ref={commentaryRef} style={{ flex:1, overflowY:'auto', padding:'.75rem', display:'flex', flexDirection:'column', gap:'.4rem' }}>
            {commentary.length === 0 && (
              <div style={{ color:'#606080', fontSize:'.85rem', textAlign:'center', marginTop:'2rem' }}>Maç başlıyor...</div>
            )}
            {commentary.map((c, i) => (
              <div key={c.id} style={{ padding:'.5rem .75rem', borderRadius:7, fontSize:'.82rem', lineHeight:1.4,
                background: c.type==='goal'?'rgba(251,191,36,.12)':c.type==='attack'?'rgba(239,68,68,.08)':'rgba(255,255,255,.03)',
                borderLeft: `3px solid ${c.type==='goal'?'#fbbf24':c.type==='attack'?'#ef4444':'#2a2a5a'}`,
                color: c.type==='goal'?'#fbbf24':'#e0e0e0',
                fontWeight: c.type==='goal'?700:400,
              }}>
                {c.text}
              </div>
            ))}
          </div>

          {/* Taktik özeti */}
          <div style={{ padding:'.75rem', borderTop:'1px solid #1e1e4a', flexShrink:0, background:'#0a0a1a' }}>
            <div style={{ fontSize:'.6rem', color:'#606080', fontWeight:700, letterSpacing:'.06em', marginBottom:'.4rem' }}>AKTİF TAKTİK</div>
            <div style={{ fontSize:'.72rem', color:'#a78bfa', fontWeight:600 }}>
              {myTactics.pressing ? TACTICS_NARRATIVE[myTactics.pressing] : 'Taktik yok'} •{' '}
              {myTactics.buildup ? TACTICS_NARRATIVE[myTactics.buildup] : ''}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </div>
  )
}
