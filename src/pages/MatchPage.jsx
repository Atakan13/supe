import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PLAYER_CARDS } from '../lib/playerCards'

function getUserId() {
  let id = localStorage.getItem('draft_user_id')
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('draft_user_id', id) }
  return id
}

// ── Sabitler ──────────────────────────────────────────────
const TOTAL_TURNS = 10
const ZONES = ['Orta Saha', 'Kanat', 'Ceza Sahası']

const TACTIC_CARDS = [
  { id:'sert_mudahale', name:'Sert Müdahale', emoji:'💢', desc:'Rakibin zarına -5, sarı kart riski', type:'debuff', target:'opponent_dice', value:-5, yellowCardRisk:0.3 },
  { id:'kontra_atak',   name:'Kontra Atak',   emoji:'⚡', desc:'Bu tur hücum statına +10', type:'buff', target:'atk_stat', value:10 },
  { id:'yuksek_pres',   name:'Yüksek Pres',   emoji:'🔥', desc:'Rakibin pas statına -8', type:'debuff', target:'opp_pass', value:-8 },
  { id:'savunma_duvar', name:'Savunma Duvarı', emoji:'🛡️', desc:'Defans statına +12', type:'buff', target:'def_stat', value:12 },
  { id:'kritik_pas',    name:'Kritik Pas',     emoji:'🎯', desc:'Bir sonraki zarı +5 bonus', type:'buff', target:'dice_bonus', value:5 },
  { id:'moral_bozma',   name:'Moral Bozma',    emoji:'😤', desc:'Rakibin tüm statlarına -5', type:'debuff', target:'all_stats', value:-5 },
]

const COMMENTARY = {
  start: ['Maç başlıyor! İki takım hazır!', 'Düdük çaldı, mücadele başlıyor!', 'Stadyum coştu, top ortaya atıldı!'],
  dice_roll: ['Zarlar masaya atılıyor...', 'Kader zarları belirleyecek!', 'Kritik an, zarlar havada!'],
  critical_success: ['KRİTİK BAŞARI! {player} inanılmaz bir hamle yaptı!', 'OLAĞANÜSTÜ! 20 çıktı, {player} sahnede!'],
  critical_fail: ['KRİTİK HATA! {player} fırsatı harcadı!', 'İnanılmaz! Boş kaleye kaçırdı {player}!'],
  goal: ['GOOOOOL! {player} ağları havalandırdı!', 'AĞ BULUNDU! {player} takımını öne geçirdi!', 'MUHTEŞEM GOL! {player} seyircileri coşturdu!'],
  save: ['Kaleci kurtardı! Muazzam refleks!', 'Direğe çarptı! Şans defansı kurtardı!', 'Harika kurtarış! Kale sağlam!'],
  defense: ['Savunma sağlam! Top geri döndü.', 'Müthiş müdahale! Atak kırıldı.', 'Defans görevi yaptı!'],
  tactic: ['{player} "{card}" kartını oynadı!', 'Taktik hamle! {card} devreye girdi!'],
  zone: ['Top {zone} bölgesine taşındı.', 'Oyun {zone} üzerinden şekilleniyor.'],
  halftime: ['DEVRE! Soyunma odasına gidiliyor.', 'İlk yarı bitti! Menajerler konuşuyor.'],
  end: ['MAÇ BİTTİ! Harika bir mücadeleydi!', 'Final düdüğü çaldı! Sonuç kesinleşti!'],
}

function getRand(arr, vars = {}) {
  let str = arr[Math.floor(Math.random() * arr.length)]
  Object.entries(vars).forEach(([k, v]) => { str = str.replace(`{${k}}`, v) })
  return str
}

function rollD20() { return Math.floor(Math.random() * 20) + 1 }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ── Ana Component ─────────────────────────────────────────
export default function MatchPage() {
  const { matchId } = useParams()
  const navigate = useNavigate()
  const userId = getUserId()

  // Veriler
  const [match, setMatch]           = useState(null)
  const [lobby, setLobby]           = useState(null)
  const [homeTeam, setHomeTeam]     = useState(null)
  const [awayTeam, setAwayTeam]     = useState(null)
  const [homePlayers, setHomePlayers] = useState([])
  const [awayPlayers, setAwayPlayers] = useState([])
  const [loading, setLoading]       = useState(true)
  const [isHost, setIsHost]         = useState(false)

  // Maç state
  const [gameState, setGameState] = useState({
    turn: 0,              // 0-9
    phase: 'waiting',     // waiting|tactic|dice|duel|result|finished
    zone: 'Orta Saha',
    homeScore: 0,
    awayScore: 0,
    attackingHome: true,  // kim hücumda
    // Zar
    homeDice: null,
    awayDice: null,
    diceRolling: false,
    // Aktif buffs/debuffs
    homeBuffs: {},        // { atk_stat: 10, dice_bonus: 5, ... }
    awayBuffs: {},
    // Kondisyon
    homeStamina: {},      // { 'Osimhen': 95, ... }
    awayStamina: {},
    // Sarı kartlar
    homeYellow: [],
    awayYellow: [],
    // Duel sonucu
    lastDuel: null,       // { atkTotal, defTotal, winner, goalScorer, critical }
  })

  // Taktik kartları
  const [myHand, setMyHand]           = useState([])   // elindeki kartlar
  const [playedCard, setPlayedCard]   = useState(null) // bu tur oynadığı kart
  const [opPlayedCard, setOpPlayedCard] = useState(null)
  const [cardPhaseReady, setCardPhaseReady] = useState(false)

  // Spiker
  const [commentary, setCommentary] = useState([{ text:'Maç başlamak üzere...', type:'normal', id:0 }])
  const commentaryRef = useRef(null)

  // Refs
  const channelRef  = useRef(null)
  const isHostRef   = useRef(false)
  const gameRef     = useRef(gameState)
  gameRef.current   = gameState

  // ── Init ────────────────────────────────────────────────
  useEffect(() => {
    init()
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [matchId])

  const init = async () => {
    const { data: m } = await supabase.from('matches').select('*').eq('id', matchId).maybeSingle()
    if (!m) return
    setMatch(m)

    const { data: lb } = await supabase.from('lobbies').select('*').eq('id', m.lobby_id).maybeSingle()
    setLobby(lb)

    const { data: lp } = await supabase.from('lobby_players').select('*').eq('lobby_id', m.lobby_id)
    const home = lp?.find(p => p.user_id === m.home_user_id)
    const away = lp?.find(p => p.user_id === m.away_user_id)
    setHomeTeam(home)
    setAwayTeam(away)

    // Kadroları yükle
    const { data: squads } = await supabase.from('squads').select('*').eq('lobby_id', m.lobby_id)
    const hSquad = squads?.find(s => s.user_id === m.home_user_id)
    const aSquad = squads?.find(s => s.user_id === m.away_user_id)

    const enrich = (lineup) => (lineup || []).filter(Boolean).map(p => {
      const card = PLAYER_CARDS.find(c => c.name === p.name) || {}
      return { ...card, ...p }
    })

    const hPlayers = enrich(hSquad?.lineup)
    const aPlayers = enrich(aSquad?.lineup)
    setHomePlayers(hPlayers)
    setAwayPlayers(aPlayers)

    // Kondisyon başlat
    const hStam = {}; hPlayers.forEach(p => { hStam[p.name] = 100 })
    const aStam = {}; aPlayers.forEach(p => { aStam[p.name] = 100 })

    const amHost = m.home_user_id === userId
    setIsHost(amHost)
    isHostRef.current = amHost

    // Rastgele 3 taktik kartı ver
    const shuffled = [...TACTIC_CARDS].sort(() => Math.random() - 0.5)
    setMyHand(shuffled.slice(0, 3))

    setLoading(false)
    setupRealtime(m.id)

    // Host maçı başlatır
    if (amHost && m.status !== 'finished') {
      await supabase.from('matches').update({ status: 'active', home_score: 0, away_score: 0, current_event: 0 }).eq('id', m.id)
      setTimeout(() => startTurn(0, hPlayers, aPlayers, hStam, aStam, {}, {}), 2000)
    }
  }

  // ── Realtime ────────────────────────────────────────────
  const setupRealtime = (mId) => {
    channelRef.current = supabase.channel('match-v2-' + mId)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${mId}` }, (p) => {
        const m = p.new
        setGameState(prev => ({ ...prev, homeScore: m.home_score || 0, awayScore: m.away_score || 0, turn: m.current_event || 0 }))
        if (m.status === 'finished') setGameState(prev => ({ ...prev, phase: 'finished' }))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'match_events', filter: `match_id=eq.${mId}` }, (p) => {
        handleEvent(p.new)
      })
      .subscribe()
  }

  const handleEvent = (ev) => {
    addComment(ev.narrative_text, ev.event_type)

    if (ev.event_type === 'turn_start') {
      setGameState(prev => ({ ...prev, zone: ev.zone, turn: ev.event_no, phase: 'tactic', attackingHome: ev.attacking_home }))
      setPlayedCard(null)
      setOpPlayedCard(null)
      setCardPhaseReady(false)
    }
    if (ev.event_type === 'dice') {
      setGameState(prev => ({ ...prev, homeDice: ev.home_dice, awayDice: ev.away_dice, diceRolling: false, phase: 'duel' }))
    }
    if (ev.event_type === 'tactic_played') {
      if (ev.user_id !== userId) {
        setOpPlayedCard(ev.card_id)
        addComment(getRand(COMMENTARY.tactic, { player: ev.user_name, card: ev.card_name }), 'tactic')
      }
    }
    if (ev.event_type === 'duel_result') {
      setGameState(prev => ({
        ...prev,
        phase: 'result',
        lastDuel: { atkTotal: ev.atk_total, defTotal: ev.def_total, winner: ev.winner, goalScorer: ev.goal_scorer, critical: ev.critical_type }
      }))
    }
  }

  const addComment = (text, type = 'normal') => {
    if (!text) return
    setCommentary(prev => [...prev.slice(-30), { text, type, id: Date.now() + Math.random() }])
    setTimeout(() => { if (commentaryRef.current) commentaryRef.current.scrollTop = commentaryRef.current.scrollHeight }, 100)
  }

  // ── TURN MOTORU (sadece host) ────────────────────────────
  const startTurn = async (turnNo, hPlayers, aPlayers, hStam, aStam, hBuffs, aBuffs) => {
    if (turnNo >= TOTAL_TURNS) {
      await supabase.from('matches').update({ status: 'finished' }).eq('id', matchId)
      addComment(getRand(COMMENTARY.end), 'end')
      return
    }

    if (turnNo === 5) addComment(getRand(COMMENTARY.halftime), 'halftime')

    const zone = ZONES[Math.floor(Math.random() * ZONES.length)]
    const attackHome = Math.random() > 0.5

    await supabase.from('match_events').insert({
      match_id: matchId, event_type: 'turn_start', event_no: turnNo,
      zone, attacking_home: attackHome,
      narrative_text: getRand(COMMENTARY.zone, { zone }),
    })
    await supabase.from('matches').update({ current_event: turnNo }).eq('id', matchId)

    // Taktik kartı fazı - 15 saniye bekle
    addComment('⏳ Menajerler taktik kartlarını seçiyor...', 'tactic')
    await sleep(15000)

    // Taktik kartlarını DB'den çek
    const { data: tactics } = await supabase.from('match_actions')
      .select('*').eq('match_id', matchId).eq('event_no', turnNo).eq('event_type', 'tactic')

    const homeTactic = tactics?.find(t => t.user_id === gameRef.current.homeTeamUserId)
    const awayTactic  = tactics?.find(t => t.user_id !== gameRef.current.homeTeamUserId)

    // Buff hesapla
    const newHBuffs = applyTactic(homeTactic?.card_id, hBuffs)
    const newABuffs = applyTactic(awayTactic?.card_id, aBuffs)

    // Sarı kart riski
    let newHYellow = [...(gameRef.current.homeYellow || [])]
    let newAYellow = [...(gameRef.current.awayYellow || [])]
    if (homeTactic?.card_id === 'sert_mudahale' && Math.random() < 0.3) {
      const victim = hPlayers[Math.floor(Math.random() * hPlayers.length)]
      newHYellow.push(victim?.name)
      addComment(`🟡 Sarı kart! ${victim?.name?.split(' ').pop()} uyarıldı!`, 'yellow')
    }

    // Zar animasyonu
    addComment(getRand(COMMENTARY.dice_roll), 'dice')
    await supabase.from('match_events').insert({
      match_id: matchId, event_type: 'dice_anim', event_no: turnNo, narrative_text: '🎲 Zarlar atılıyor...',
    })
    await sleep(2000)

    // Zar at
    let hDice = rollD20()
    let aDice = rollD20()

    // Dice bonus buff uygula
    if (newHBuffs.dice_bonus) hDice = Math.min(20, hDice + newHBuffs.dice_bonus)
    if (newABuffs.dice_bonus) aDice = Math.min(20, aDice + newABuffs.dice_bonus)
    // Debuff uygula
    if (newABuffs.opponent_dice) hDice = Math.max(1, hDice + newABuffs.opponent_dice)
    if (newHBuffs.opponent_dice) aDice = Math.max(1, aDice + newHBuffs.opponent_dice)

    await supabase.from('match_events').insert({
      match_id: matchId, event_type: 'dice', event_no: turnNo,
      home_dice: hDice, away_dice: aDice, attacking_home: attackHome,
      narrative_text: `🎲 Ev: ${hDice} — Dep: ${aDice}`,
    })
    await sleep(2000)

    // Düello hesapla
    const atkPlayers = attackHome ? hPlayers : aPlayers
    const defPlayers = attackHome ? aPlayers : hPlayers
    const atkStam    = attackHome ? hStam : aStam
    const defStam    = attackHome ? aStam : hStam
    const atkBuffs   = attackHome ? newHBuffs : newABuffs
    const defBuffs   = attackHome ? newABuffs : newHBuffs

    // Hücum oyuncusu (en iyi hücumcu)
    const fwdPos = ['ST','CF','LW','RW','CAM']
    const atkPlayer = atkPlayers.filter(p => fwdPos.includes(p.squad_pos||p.position)).sort((a,b)=>(b.overall||0)-(a.overall||0))[0]
      || atkPlayers.sort((a,b)=>(b.overall||0)-(a.overall||0))[0]

    // Savunma oyuncusu
    const defPos = ['CB','LB','RB','CDM']
    const defPlayer = defPlayers.filter(p => defPos.includes(p.squad_pos||p.position)).sort((a,b)=>(b.overall||0)-(a.overall||0))[0]
      || defPlayers.sort((a,b)=>(b.overall||0)-(a.overall||0))[0]

    // Stat hesapla
    const atkStamMod = (atkStam[atkPlayer?.name] || 100) / 100
    const defStamMod = (defStam[defPlayer?.name] || 100) / 100

    let atkStat = Math.round(((atkPlayer?.shooting||70) + (atkPlayer?.pace||70) + (atkPlayer?.dribbling||70)) / 3 * atkStamMod)
    let defStat = Math.round(((defPlayer?.defending||70) + (defPlayer?.physical||70)) / 2 * defStamMod)

    // Buff uygula
    if (atkBuffs.atk_stat) atkStat += atkBuffs.atk_stat
    if (defBuffs.def_stat) defStat += defBuffs.def_stat
    if (atkBuffs.all_stats) atkStat += atkBuffs.all_stats  // negatifse debuff
    if (defBuffs.all_stats) defStat += defBuffs.all_stats

    // Zona göre modifiye
    if (zone === 'Ceza Sahası') atkStat += 5
    if (zone === 'Kanat') atkStat += 3

    // Zar değeri (hücum için ev sahibi zarı, savunma için deplasman zarı)
    const atkDice = attackHome ? hDice : aDice
    const defDice = attackHome ? aDice : hDice

    const atkTotal = atkStat + atkDice
    const defTotal = defStat + defDice

    // Kritik kontrol
    let critical = null
    let atkWins = atkTotal > defTotal

    if (atkDice === 20) { critical = 'success'; atkWins = true }
    if (atkDice === 1)  { critical = 'fail';    atkWins = false }
    if (defDice === 20) { critical = 'def_success'; atkWins = false }

    // Kondisyon güncelle
    const newHStam = { ...hStam }
    const newAStam = { ...aStam }
    if (atkPlayer) {
      if (attackHome) newHStam[atkPlayer.name] = Math.max(0, (newHStam[atkPlayer.name]||100) - 8)
      else newAStam[atkPlayer.name] = Math.max(0, (newAStam[atkPlayer.name]||100) - 8)
    }
    if (defPlayer) {
      if (attackHome) newAStam[defPlayer.name] = Math.max(0, (newAStam[defPlayer.name]||100) - 5)
      else newHStam[defPlayer.name] = Math.max(0, (newHStam[defPlayer.name]||100) - 5)
    }

    // Spiker metni
    let comment = ''
    if (critical === 'success') comment = getRand(COMMENTARY.critical_success, { player: atkPlayer?.name?.split(' ').pop()||'Oyuncu' })
    else if (critical === 'fail') comment = getRand(COMMENTARY.critical_fail, { player: atkPlayer?.name?.split(' ').pop()||'Oyuncu' })
    else if (atkWins) comment = getRand(COMMENTARY.goal, { player: atkPlayer?.name?.split(' ').pop()||'Oyuncu' })
    else comment = getRand(COMMENTARY.defense)

    // Skor güncelle
    const { data: cur } = await supabase.from('matches').select('home_score,away_score').eq('id', matchId).maybeSingle()
    let newHS = cur?.home_score || 0
    let newAS = cur?.away_score || 0
    if (atkWins) { if (attackHome) newHS++; else newAS++ }

    await supabase.from('matches').update({ home_score: newHS, away_score: newAS }).eq('id', matchId)

    // Duel sonucu kaydet
    await supabase.from('match_events').insert({
      match_id: matchId, event_type: 'duel_result', event_no: turnNo,
      atk_total: atkTotal, def_total: defTotal,
      winner: atkWins ? 'attack' : 'defense',
      goal_scorer: atkWins ? atkPlayer?.name : null,
      critical_type: critical,
      narrative_text: comment,
      attacking_home: attackHome,
    })

    await sleep(4000)
    startTurn(turnNo + 1, hPlayers, aPlayers, newHStam, newAStam, clearBuffs(newHBuffs), clearBuffs(newABuffs))
  }

  const applyTactic = (cardId, currentBuffs) => {
    if (!cardId) return currentBuffs
    const card = TACTIC_CARDS.find(c => c.id === cardId)
    if (!card) return currentBuffs
    return { ...currentBuffs, [card.target]: (currentBuffs[card.target] || 0) + card.value }
  }

  const clearBuffs = (buffs) => {
    // Tek turlu bufflar temizle
    const persistent = {}
    return persistent
  }

  // ── Taktik Kartı Oyna ────────────────────────────────────
  const playTacticCard = async (card) => {
    if (gameState.phase !== 'tactic' || playedCard) return
    setPlayedCard(card)

    const me = isHost ? homeTeam : awayTeam
    await supabase.from('match_actions').insert({
      match_id: matchId,
      user_id: userId,
      event_no: gameState.turn,
      event_type: 'tactic',
      card_id: card.id,
      card_name: card.name,
      user_name: me?.user_name || 'Menajer',
    })

    addComment(getRand(COMMENTARY.tactic, { player: 'Sen', card: card.name }), 'tactic')
    setMyHand(prev => prev.filter(c => c.id !== card.id))
  }

  // ── Yardımcılar ─────────────────────────────────────────
  const getStamColor = (v) => v >= 70 ? '#10b981' : v >= 40 ? '#f59e0b' : '#ef4444'
  const myPlayers  = isHost ? homePlayers : awayPlayers
  const opPlayers  = isHost ? awayPlayers : homePlayers
  const myStamina  = isHost ? gameState.homeStamina : gameState.awayStamina
  const opStamina  = isHost ? gameState.awayStamina : gameState.homeStamina

  if (loading) return (
    <div style={{ height:'100vh', background:'#050508', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:24, letterSpacing:4, color:'rgba(0,200,255,0.6)' }}>YÜKLENİYOR...</div>
    </div>
  )

  const gs = gameState

  return (
    <div style={{ height:'100vh', backgroundImage:'url(/assets/stadium_bg.jpg)', backgroundSize:'cover', backgroundPosition:'center', display:'flex', flexDirection:'column', overflow:'hidden', position:'relative', fontFamily:"'Rajdhani',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Rajdhani:wght@400;500;600;700&display=swap');
        @keyframes diceRoll{0%{transform:rotate(0deg) scale(1.2)}100%{transform:rotate(360deg) scale(1)}}
        @keyframes goalFlash{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.7;transform:scale(1.05)}}
        @keyframes slideIn{from{transform:translateY(10px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes cardPlay{from{transform:scale(0.8) rotate(-5deg);opacity:0}to{transform:scale(1) rotate(0deg);opacity:1}}
      `}</style>
      <div style={{ position:'absolute', inset:0, background:'rgba(3,3,10,0.88)', zIndex:0, pointerEvents:'none' }}/>

      {/* HEADER - SKOR */}
      <div style={{ position:'relative', zIndex:2, background:'rgba(15,15,35,0.9)', backdropFilter:'blur(20px)', borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'.5rem 2rem', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div style={{ flex:1, display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:18, letterSpacing:2, color:'#fff' }}>{homeTeam?.team_name}</div>
          {isHost && <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:9, letterSpacing:2, color:'rgba(0,200,255,0.5)', background:'rgba(0,200,255,0.08)', padding:'2px 6px', borderRadius:4 }}>SEN</span>}
        </div>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:36, letterSpacing:8, color:'#fff', lineHeight:1 }}>
            <span style={{ color:gs.homeScore>gs.awayScore?'#10b981':'#fff' }}>{gs.homeScore}</span>
            <span style={{ color:'rgba(255,255,255,0.2)', margin:'0 6px' }}>—</span>
            <span style={{ color:gs.awayScore>gs.homeScore?'#10b981':'#fff' }}>{gs.awayScore}</span>
          </div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:10, letterSpacing:2, color:'rgba(255,255,255,0.35)', background:'rgba(0,0,0,0.4)', padding:'2px 10px', borderRadius:20, display:'inline-block', marginTop:2 }}>
            {gs.phase==='finished' ? '⏱ MAÇ BİTTİ' : `TUR ${gs.turn+1}/${TOTAL_TURNS} · ${gs.zone}`}
          </div>
        </div>
        <div style={{ flex:1, display:'flex', alignItems:'center', gap:10, justifyContent:'flex-end' }}>
          {!isHost && <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:9, letterSpacing:2, color:'rgba(0,200,255,0.5)', background:'rgba(0,200,255,0.08)', padding:'2px 6px', borderRadius:4 }}>SEN</span>}
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:18, letterSpacing:2, color:'#fff' }}>{awayTeam?.team_name}</div>
        </div>
      </div>

      {/* ANA GRID */}
      <div style={{ position:'relative', zIndex:1, flex:1, display:'grid', gridTemplateColumns:'280px 1fr 280px', overflow:'hidden' }}>

        {/* SOL: Ev Sahibi */}
        <div style={{ background:'rgba(10,15,35,0.7)', borderRight:'1px solid rgba(74,144,226,0.12)', padding:'1rem', overflowY:'auto', display:'flex', flexDirection:'column', gap:4 }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:10, letterSpacing:3, color:'rgba(74,144,226,0.5)', marginBottom:6 }}>EV SAHİBİ</div>
          {homePlayers.map((p,i) => {
            const stam = gs.homeStamina[p.name] ?? 100
            const isYellow = gs.homeYellow?.includes(p.name)
            return (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 8px', borderRadius:6, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.04)' }}>
                {p.image && <img src={p.image} style={{ width:28, height:28, borderRadius:'50%', objectFit:'cover', objectPosition:'top' }} onError={e=>e.target.style.display='none'}/>}
                {!p.image && <div style={{ width:28, height:28, borderRadius:'50%', background:'rgba(74,144,226,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Bebas Neue',sans-serif", fontSize:11, color:'#4a90e2' }}>{p.overall}</div>}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                    <span style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:12, fontWeight:700, color:'#fff', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.name?.split(' ').pop()}</span>
                    {isYellow && <span style={{ fontSize:10 }}>🟡</span>}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:3 }}>
                    <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:8, color:'rgba(74,144,226,0.6)' }}>{p.squad_pos||p.position}</span>
                    <div style={{ flex:1, height:2, background:'rgba(255,255,255,0.08)', borderRadius:1 }}>
                      <div style={{ height:'100%', width:`${stam}%`, background:getStamColor(stam), borderRadius:1 }}/>
                    </div>
                  </div>
                </div>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:13, color:'#f5e663' }}>{p.overall}</div>
              </div>
            )
          })}
        </div>

        {/* ORTA: Spiker + Zar + Taktik */}
        <div style={{ display:'flex', flexDirection:'column', background:'rgba(5,5,18,0.8)' }}>

          {/* ZAR PANELİ */}
          <div style={{ padding:'1rem 1.5rem', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(0,0,0,0.4)', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'3rem' }}>
              {/* Ev zar */}
              <div style={{ textAlign:'center' }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:9, letterSpacing:3, color:'rgba(74,144,226,0.5)', marginBottom:4 }}>EV</div>
                <div style={{ width:60, height:60, background:'rgba(74,144,226,0.1)', border:`2px solid ${gs.homeDice?(gs.homeDice>=(gs.awayDice||0)?'rgba(74,144,226,0.8)':'rgba(74,144,226,0.3)'):'rgba(74,144,226,0.3)'}`, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Bebas Neue',sans-serif", fontSize:32, color:'#4a90e2', boxShadow:gs.homeDice>=20?'0 0 20px rgba(74,144,226,0.8)':'none', animation:gs.diceRolling?'diceRoll 0.2s linear infinite':'none' }}>
                  {gs.diceRolling ? '?' : (gs.homeDice || '—')}
                </div>
                {gs.homeDice === 20 && <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:10, color:'#ffd700', marginTop:4, animation:'goalFlash 0.5s infinite' }}>KRİTİK!</div>}
              </div>

              <div style={{ textAlign:'center' }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:11, color:'rgba(255,255,255,0.2)', letterSpacing:2 }}>VS</div>
                {gs.phase === 'tactic' && (
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:9, letterSpacing:2, color:'rgba(255,200,0,0.6)', marginTop:4, animation:'pulse 1s infinite' }}>TAKTİK FAZINDA</div>
                )}
                {gs.lastDuel && (
                  <div style={{ marginTop:4 }}>
                    <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:12, color:gs.lastDuel.winner==='attack'?'#10b981':'#3b82f6', letterSpacing:1 }}>
                      {gs.lastDuel.winner==='attack'?'⚽ GOL!':'🛡️ KURTARIŞ!'}
                    </div>
                    <div style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:10, color:'rgba(255,255,255,0.3)' }}>
                      Atak {gs.lastDuel.atkTotal} — Def {gs.lastDuel.defTotal}
                    </div>
                  </div>
                )}
              </div>

              {/* Dep zar */}
              <div style={{ textAlign:'center' }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:9, letterSpacing:3, color:'rgba(226,176,74,0.5)', marginBottom:4 }}>DEP</div>
                <div style={{ width:60, height:60, background:'rgba(226,176,74,0.1)', border:`2px solid ${gs.awayDice?(gs.awayDice>(gs.homeDice||0)?'rgba(226,176,74,0.8)':'rgba(226,176,74,0.3)'):'rgba(226,176,74,0.3)'}`, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Bebas Neue',sans-serif", fontSize:32, color:'#e2b04a', boxShadow:gs.awayDice>=20?'0 0 20px rgba(226,176,74,0.8)':'none', animation:gs.diceRolling?'diceRoll 0.2s linear infinite 0.1s':'none' }}>
                  {gs.diceRolling ? '?' : (gs.awayDice || '—')}
                </div>
                {gs.awayDice === 20 && <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:10, color:'#ffd700', marginTop:4, animation:'goalFlash 0.5s infinite' }}>KRİTİK!</div>}
              </div>
            </div>
          </div>

          {/* TAKTİK KARTLARI */}
          {gs.phase === 'tactic' && myHand.length > 0 && (
            <div style={{ padding:'.75rem 1rem', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(255,200,0,0.04)', flexShrink:0 }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:10, letterSpacing:3, color:'rgba(255,200,0,0.6)', marginBottom:8 }}>
                {playedCard ? `✅ "${playedCard.name}" oynandı!` : 'TAKTİK KARTI OYNA (opsiyonel)'}
              </div>
              {!playedCard && (
                <div style={{ display:'flex', gap:8 }}>
                  {myHand.map(card => (
                    <div key={card.id} onClick={() => playTacticCard(card)}
                      style={{ flex:1, background:'rgba(20,20,40,0.9)', border:'1px solid rgba(255,200,0,0.3)', borderRadius:10, padding:'8px', cursor:'pointer', textAlign:'center', transition:'all .15s', animation:'cardPlay 0.3s ease' }}
                      onMouseEnter={e=>e.currentTarget.style.borderColor='rgba(255,200,0,0.7)'}
                      onMouseLeave={e=>e.currentTarget.style.borderColor='rgba(255,200,0,0.3)'}>
                      <div style={{ fontSize:20, marginBottom:4 }}>{card.emoji}</div>
                      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:11, letterSpacing:1, color:'#ffd700' }}>{card.name}</div>
                      <div style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:10, color:'rgba(255,255,255,0.4)', marginTop:2 }}>{card.desc}</div>
                    </div>
                  ))}
                </div>
              )}
              {opPlayedCard && (
                <div style={{ marginTop:6, fontFamily:"'Rajdhani',sans-serif", fontSize:11, color:'rgba(255,100,100,0.7)' }}>
                  ⚠️ Rakip taktik kartı oynadı!
                </div>
              )}
            </div>
          )}

          {/* SPİKER */}
          <div ref={commentaryRef} style={{ flex:1, overflowY:'auto', padding:'1rem', display:'flex', flexDirection:'column', gap:6 }}>
            {commentary.map(c => (
              <div key={c.id} style={{ padding:'8px 12px', borderRadius:8, background:c.type==='goal'?'rgba(16,185,129,0.1)':c.type==='tactic'?'rgba(255,200,0,0.06)':c.type==='yellow'?'rgba(255,200,0,0.08)':'rgba(255,255,255,0.03)', border:`1px solid ${c.type==='goal'?'rgba(16,185,129,0.25)':c.type==='tactic'?'rgba(255,200,0,0.2)':'rgba(255,255,255,0.05)'}`, animation:'slideIn 0.3s ease' }}>
                <div style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:13, color:c.type==='goal'?'#10b981':c.type==='tactic'?'#ffd700':c.type==='yellow'?'#fbbf24':'rgba(255,255,255,0.75)', lineHeight:1.4 }}>{c.text}</div>
              </div>
            ))}
          </div>

          {/* MAÇ SONU */}
          {gs.phase === 'finished' && (
            <div style={{ padding:'1rem', borderTop:'1px solid rgba(255,255,255,0.08)', background:'rgba(0,0,0,0.6)', textAlign:'center', flexShrink:0 }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:24, letterSpacing:3, marginBottom:8, color:gs.homeScore>gs.awayScore?(isHost?'#10b981':'#ef4444'):gs.awayScore>gs.homeScore?(isHost?'#ef4444':'#10b981'):'#f59e0b' }}>
                {gs.homeScore>gs.awayScore?(isHost?'🏆 KAZANDIN!':'😔 KAYBETTİN'):gs.awayScore>gs.homeScore?(isHost?'😔 KAYBETTİN':'🏆 KAZANDIN!'):'🤝 BERABERLİK!'}
              </div>
              <button onClick={() => navigate(`/game/${lobby?.code}`)}
                style={{ padding:'10px 28px', borderRadius:8, border:'none', background:'linear-gradient(135deg,#7c3aed,#8b5cf6)', color:'#fff', fontFamily:"'Bebas Neue',sans-serif", fontSize:14, letterSpacing:3, cursor:'pointer' }}>
                ANA MENÜYE DÖN →
              </button>
            </div>
          )}
        </div>

        {/* SAĞ: Deplasman */}
        <div style={{ background:'rgba(30,10,10,0.7)', borderLeft:'1px solid rgba(226,176,74,0.12)', padding:'1rem', overflowY:'auto', display:'flex', flexDirection:'column', gap:4 }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:10, letterSpacing:3, color:'rgba(226,176,74,0.5)', marginBottom:6 }}>DEPLASMAN</div>
          {awayPlayers.map((p,i) => {
            const stam = gs.awayStamina[p.name] ?? 100
            const isYellow = gs.awayYellow?.includes(p.name)
            return (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 8px', borderRadius:6, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:13, color:'#f5e663' }}>{p.overall}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:4, justifyContent:'flex-end' }}>
                    {isYellow && <span style={{ fontSize:10 }}>🟡</span>}
                    <span style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:12, fontWeight:700, color:'#fff', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.name?.split(' ').pop()}</span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:3, justifyContent:'flex-end' }}>
                    <div style={{ flex:1, height:2, background:'rgba(255,255,255,0.08)', borderRadius:1 }}>
                      <div style={{ height:'100%', width:`${stam}%`, background:getStamColor(stam), borderRadius:1 }}/>
                    </div>
                    <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:8, color:'rgba(226,176,74,0.6)' }}>{p.squad_pos||p.position}</span>
                  </div>
                </div>
                {p.image && <img src={p.image} style={{ width:28, height:28, borderRadius:'50%', objectFit:'cover', objectPosition:'top' }} onError={e=>e.target.style.display='none'}/>}
                {!p.image && <div style={{ width:28, height:28, borderRadius:'50%', background:'rgba(226,176,74,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Bebas Neue',sans-serif", fontSize:11, color:'#e2b04a' }}>{p.overall}</div>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
