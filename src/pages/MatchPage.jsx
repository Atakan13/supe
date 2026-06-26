import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PLAYER_CARDS } from '../lib/playerCards'

function getUserId() {
  let id = localStorage.getItem('draft_user_id')
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('draft_user_id', id) }
  return id
}

// ── Sabitler ──────────────────────────────────────────────
const TOTAL_EVENTS = 20  // Maçta toplam zar atışı

const SPIKER_LINES = {
  start: [
    'Maç başlıyor! İki takım sahaya çıkıyor!',
    'Düdük çaldı, mücadele başlıyor!',
    'Stadyum doldu taştı, maç başlıyor!',
  ],
  attack: [
    '{team} hücuma geçti! Kritik bir an!',
    '{team} top kontrolünü ele geçirdi!',
    '{team} rakip ceza sahasına yaklaşıyor!',
    'Tehlikeli bir atak! {team} ilerliyor!',
  ],
  goal: [
    'GOOOOOL! {player} müthiş bir gol attı!',
    'AĞ BULUNDU! {player} takımını öne geçirdi!',
    'İNANILMAZ! {player} defansı delip geçti!',
  ],
  save: [
    'Kaleci kurtardı! Muhteşem bir refleks!',
    'Direğe çarptı! Şans kurtardı savunmayı!',
    'Kurtarış! Kaleci kapıyı kapattı!',
  ],
  defense: [
    'Savunma sağlam! Top geri döndü.',
    'Müthiş bir müdahale! Atak kırıldı.',
    '{team} savunması görevini yaptı!',
  ],
  halftime: [
    'İlk yarı bitti! Soyunma odasına gidiliyor.',
    'Hakem ilk yarıyı bitiriyor!',
  ],
  end: [
    'Maç bitti! Harika bir mücadeleydi!',
    'Final düdüğü çaldı! Sonuç kesinleşti!',
  ],
}

function getRand(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function rollDice() { return Math.floor(Math.random() * 20) + 1 }

// ── Component ─────────────────────────────────────────────
export default function MatchPage() {
  const { matchId } = useParams()
  const navigate = useNavigate()
  const userId = getUserId()

  // Veri state'leri
  const [match, setMatch] = useState(null)
  const [lobby, setLobby] = useState(null)
  const [homePlayers, setHomePlayers] = useState([]) // Ev sahibi kadro
  const [awayPlayers, setAwayPlayers] = useState([]) // Deplasman kadro
  const [homeTeam, setHomeTeam] = useState(null)
  const [awayTeam, setAwayTeam] = useState(null)
  const [loading, setLoading] = useState(true)

  // Maç state'leri
  const [homeScore, setHomeScore] = useState(0)
  const [awayScore, setAwayScore] = useState(0)
  const [eventNo, setEventNo] = useState(0)       // Kaçıncı event (0-19)
  const [isHome, setIsHome] = useState(false)     // Bu kullanıcı ev sahibi mi
  const [minute, setMinute] = useState(0)
  const [phase, setPhase] = useState('waiting')   // waiting|dice|select_atk|select_def|clash|result|finished
  const [isFinished, setIsFinished] = useState(false)
  const [isHost, setIsHost] = useState(false)

  // Kondisyon (0-100)
  const [homeStamina, setHomeStamina] = useState({})
  const [awayStamina, setAwayStamina] = useState({})

  // Zar state'leri
  const [homeDice, setHomeDice] = useState(null)
  const [awayDice, setAwayDice] = useState(null)
  const [diceRolling, setDiceRolling] = useState(false)
  const [attackingHome, setAttackingHome] = useState(true) // kim hücumda

  // Oyuncu seçimi
  const [selectedAttackers, setSelectedAttackers] = useState([])  // hücum seçilen 4 oyuncu
  const [selectedDefenders, setSelectedDefenders] = useState([])  // savunma seçilen 4 oyuncu
  const [myRole, setMyRole] = useState(null)   // 'attacker' | 'defender' | null
  const [timeLeft, setTimeLeft] = useState(20)

  // Kapışma
  const [clashResult, setClashResult] = useState(null) // {winner, atkScore, defScore, goalScorer}

  // Spiker
  const [commentary, setCommentary] = useState([])
  const commentaryRef = useRef(null)

  // Realtime
  const channelRef = useRef(null)
  const isHostRef = useRef(false)
  const timerRef = useRef(null)

  // ── Init ─────────────────────────────────────────────────
  useEffect(() => {
    init()
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [matchId])

  const init = async () => {
    const { data: m } = await supabase.from('matches').select('*').eq('id', matchId).maybeSingle()
    if (!m) return
    setMatch(m)

    const { data: lb } = await supabase.from('lobbies').select('*').eq('id', m.lobby_id).maybeSingle()
    setLobby(lb)

    const { data: players } = await supabase.from('lobby_players').select('*').eq('lobby_id', m.lobby_id)
    const home = players?.find(p => p.user_id === m.home_user_id)
    const away = players?.find(p => p.user_id === m.away_user_id)
    setHomeTeam(home)
    setAwayTeam(away)

    // Kadroları çek
    const { data: squads } = await supabase.from('squads').select('*').eq('lobby_id', m.lobby_id)
    const homeSquad = squads?.find(s => s.user_id === m.home_user_id)
    const awaySquad = squads?.find(s => s.user_id === m.away_user_id)

    const homeLp = (homeSquad?.lineup || []).filter(Boolean).map(p => {
      const card = PLAYER_CARDS.find(c => c.name === p.name) || p
      return { ...p, ...card }
    })
    const awayLp = (awaySquad?.lineup || []).filter(Boolean).map(p => {
      const card = PLAYER_CARDS.find(c => c.name === p.name) || p
      return { ...p, ...card }
    })
    setHomePlayers(homeLp)
    setAwayPlayers(awayLp)

    // Kondisyon başlat
    const hStam = {}; homeLp.forEach(p => { hStam[p.name] = 100 })
    const aStam = {}; awayLp.forEach(p => { aStam[p.name] = 100 })
    setHomeStamina(hStam)
    setAwayStamina(aStam)

    // Host kontrolü
    const amHost = m.home_user_id === userId
    setIsHost(amHost)
    isHostRef.current = amHost

    setLoading(false)
    setupRealtime(m.id)

    // Maç daha önce başlamadıysa host başlatsın
    if (m.status !== 'finished' && amHost) {
      await supabase.from('matches').update({ status: 'active', current_event: 0, home_score: 0, away_score: 0 }).eq('id', m.id)
      setTimeout(() => startNextEvent(0, homeLp, awayLp, hStam, aStam), 2000)
    }
  }

  // ── Realtime ─────────────────────────────────────────────
  const setupRealtime = (mId) => {
    channelRef.current = supabase.channel('match-' + mId)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${mId}` }, (p) => {
        handleMatchUpdate(p.new)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'match_events', filter: `match_id=eq.${mId}` }, (p) => {
        handleNewEvent(p.new)
      })
      .subscribe()
  }

  const handleMatchUpdate = (m) => {
    setHomeScore(m.home_score || 0)
    setAwayScore(m.away_score || 0)
    setMinute(m.current_minute || 0)
    setEventNo(m.current_event || 0)
    if (m.status === 'finished') { setIsFinished(true); setPhase('finished') }
  }

  const handleNewEvent = (ev) => {
    addCommentary(ev.narrative_text, ev.event_type)
    if (ev.event_type === 'dice') {
      setHomeDice(ev.home_dice)
      setAwayDice(ev.away_dice)
      setDiceRolling(false)
      setAttackingHome(ev.attacking_home ?? (ev.home_dice >= ev.away_dice))
      // Oyuncu seçimi fazına geç
      const amHost = isHostRef.current
      const attackHome = ev.attacking_home ?? (ev.home_dice >= ev.away_dice)
      // Ev sahibi hücumdaysa: host=attacker, misafir=defender
      // Deplasman hücumdaysa: host=defender, misafir=attacker
      if (attackHome) {
        setMyRole(amHost ? 'attacker' : 'defender')
      } else {
        setMyRole(amHost ? 'defender' : 'attacker')
      }
      setPhase('select')
      setTimeLeft(20)
    }
    if (ev.event_type === 'clash') {
      setClashResult({ winner: ev.winner, atkScore: ev.atk_score, defScore: ev.def_score, goalScorer: ev.goal_scorer })
      setPhase('clash')
      setTimeout(() => {
        setClashResult(null)
        setSelectedAttackers([])
        setSelectedDefenders([])
        setMyRole(null)
        setPhase('waiting')
      }, 4000)
    }
    if (ev.event_type === 'goal') {
      addCommentary(ev.narrative_text, 'goal')
      // Skor zaten clash event'te DB'ye yazıldı, handleMatchUpdate okur
    }
  }

  const addCommentary = (text, type = 'normal') => {
    if (!text) return
    setCommentary(prev => [...prev.slice(-20), { text, type, id: Date.now() }])
    setTimeout(() => { if (commentaryRef.current) commentaryRef.current.scrollTop = commentaryRef.current.scrollHeight }, 50)
  }

  // ── Maç Motoru (sadece host çalıştırır) ──────────────────
  const startNextEvent = async (evNo, hPlayers, aPlayers, hStam, aStam) => {
    if (evNo >= TOTAL_EVENTS) {
      // Maç bitti
      await supabase.from('matches').update({ status: 'finished' }).eq('id', matchId)
      addCommentary(getRand(SPIKER_LINES.end), 'end')
      setIsFinished(true)
      setPhase('finished')
      return
    }

    // Dakika hesapla (0-90)
    const min = Math.floor((evNo / TOTAL_EVENTS) * 90)
    await supabase.from('matches').update({ current_event: evNo, current_minute: min }).eq('id', matchId)
    setEventNo(evNo)
    setMinute(min)

    // Yarı arası
    if (evNo === 10) addCommentary(getRand(SPIKER_LINES.halftime), 'normal')

    // Spiker konuşması
    const atkTeam = evNo % 2 === 0 ? homeTeam?.team_name : awayTeam?.team_name
    addCommentary(getRand(SPIKER_LINES.attack).replace('{team}', atkTeam || 'Ev Sahibi'), 'attack')

    // Zar animasyonu
    setDiceRolling(true)
    setPhase('dice')
    await sleep(1500)

    const hDice = rollDice()
    const aDice = rollDice()

    // DB'ye yaz
    await supabase.from('match_events').insert({
      match_id: matchId,
      minute: min,
      event_type: 'dice',
      home_dice: hDice,
      away_dice: aDice,
      narrative_text: `🎲 Zar atıldı! Ev: ${hDice} — Dep: ${aDice}. ${hDice >= aDice ? homeTeam?.team_name : awayTeam?.team_name} hücuma geçiyor!`,
      event_no: evNo,
    })

    setHomeDice(hDice)
    setAwayDice(aDice)
    setDiceRolling(false)

    // 20 saniye seçim süresi, sonra otomatik hesapla
    await sleep(20000)

    // Oyuncu seçimlerini DB'den çek
    const { data: actions } = await supabase.from('match_actions').select('*').eq('match_id', matchId).eq('event_no', evNo)
    
    const atkHome = hDice > aDice || (hDice === aDice && Math.random() > 0.5)
    const atkPlayers = atkHome ? hPlayers : aPlayers
    const defPlayers = atkHome ? aPlayers : hPlayers
    const atkStam = atkHome ? hStam : aStam
    const defStam = atkHome ? aStam : hStam

    // Seçilen oyuncular (yoksa en iyi 4)
    const atkAction = actions?.find(a => a.role === 'attacker')
    const defAction = actions?.find(a => a.role === 'defender')

    const atkSelected = atkAction?.player_ids
      ? atkPlayers.filter(p => atkAction.player_ids.includes(p.name))
      : atkPlayers.filter(p => ['ST','CF','LW','RW','CAM'].includes(p.squad_pos||p.position)).slice(0,4)

    const defSelected = defAction?.player_ids
      ? defPlayers.filter(p => defAction.player_ids.includes(p.name))
      : defPlayers.filter(p => ['CB','LB','RB','CDM'].includes(p.squad_pos||p.position)).slice(0,4)

    // Stat hesapla
    const atkScore = atkSelected.reduce((sum, p) => {
      const stam = (atkStam[p.name] || 100) / 100
      return sum + ((p.shooting||70) + (p.pace||70) + (p.dribbling||70)) / 3 * stam
    }, 0) / Math.max(atkSelected.length, 1)

    const defScore = defSelected.reduce((sum, p) => {
      const stam = (defStam[p.name] || 100) / 100
      return sum + ((p.defending||70) + (p.physical||70)) / 2 * stam
    }, 0) / Math.max(defSelected.length, 1)

    const atkWins = atkScore > defScore
    const goalScorer = atkWins && atkSelected.length > 0 ? atkSelected[Math.floor(Math.random() * atkSelected.length)] : null

    // Kondisyon güncelle
    const newHStam = { ...hStam }
    const newAStam = { ...aStam }
    ;[...atkSelected, ...defSelected].forEach(p => {
      if (atkHome) {
        if (atkSelected.includes(p)) newHStam[p.name] = Math.max(0, (newHStam[p.name]||100) - 8)
        else newAStam[p.name] = Math.max(0, (newAStam[p.name]||100) - 5)
      } else {
        if (atkSelected.includes(p)) newAStam[p.name] = Math.max(0, (newAStam[p.name]||100) - 8)
        else newHStam[p.name] = Math.max(0, (newHStam[p.name]||100) - 5)
      }
    })
    setHomeStamina(newHStam)
    setAwayStamina(newAStam)

    // Sonuç DB'ye
    // DB'den güncel skoru çek
    const { data: currentMatch } = await supabase.from('matches').select('home_score,away_score').eq('id', matchId).maybeSingle()
    let newHomeScore = currentMatch?.home_score || 0
    let newAwayScore = currentMatch?.away_score || 0

    if (atkWins && goalScorer) {
      if (atkHome) newHomeScore++
      else newAwayScore++

      await supabase.from('matches').update({ home_score: newHomeScore, away_score: newAwayScore }).eq('id', matchId)
      // setHomeScore/setAwayScore kaldırıldı - handleMatchUpdate realtime ile günceller

      const goalLine = getRand(SPIKER_LINES.goal).replace('{player}', goalScorer.name?.split(' ').pop() || 'Oyuncu')
      await supabase.from('match_events').insert({
        match_id: matchId, minute: min, event_type: 'goal',
        narrative_text: `⚽ GOL! ${goalLine}`,
        event_no: evNo,
      })
    }

    // Kapışma sonucu
    await supabase.from('match_events').insert({
      match_id: matchId, minute: min, event_type: 'clash',
      atk_score: Math.round(atkScore),
      def_score: Math.round(defScore),
      winner: atkWins ? 'attack' : 'defense',
      goal_scorer: goalScorer?.name || null,
      narrative_text: atkWins
        ? getRand(SPIKER_LINES.goal).replace('{player}', goalScorer?.name?.split(' ').pop() || 'Oyuncu')
        : getRand(SPIKER_LINES.defense).replace('{team}', atkHome ? awayTeam?.team_name : homeTeam?.team_name),
      event_no: evNo,
    })

    await sleep(4000)
    startNextEvent(evNo + 1, hPlayers, aPlayers, newHStam, newAStam)
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

  // ── Oyuncu Seçimi ─────────────────────────────────────────
  const togglePlayer = (player, role) => {
    if (role === 'attacker') {
      setSelectedAttackers(prev => {
        if (prev.find(p => p.name === player.name)) return prev.filter(p => p.name !== player.name)
        if (prev.length >= 4) return prev
        return [...prev, player]
      })
    } else {
      setSelectedDefenders(prev => {
        if (prev.find(p => p.name === player.name)) return prev.filter(p => p.name !== player.name)
        if (prev.length >= 4) return prev
        return [...prev, player]
      })
    }
  }

  const submitSelection = async () => {
    const selected = myRole === 'attacker' ? selectedAttackers : selectedDefenders
    if (selected.length === 0) return

    await supabase.from('match_actions').upsert({
      match_id: matchId,
      user_id: userId,
      role: myRole,
      player_ids: selected.map(p => p.name),
      event_no: eventNo,
    }, { onConflict: 'match_id,user_id,event_no' })

    setMyRole(null)
  }

  // ── Timer ──────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'select') return
    setTimeLeft(20)
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [phase])

  // ── Yardımcılar ───────────────────────────────────────────
  const getStamColor = (val) => val >= 70 ? '#10b981' : val >= 40 ? '#f59e0b' : '#ef4444'
  const isAttackingHome = (homeDice || 0) >= (awayDice || 0)

  // ── Render ────────────────────────────────────────────────
  if (loading) return (
    <div style={{ height:'100vh', background:'#050508', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:24, letterSpacing:4, color:'rgba(0,200,255,0.6)' }}>YÜKLENİYOR...</div>
    </div>
  )

  const myPlayers = isHost ? homePlayers : awayPlayers
  const opPlayers = isHost ? awayPlayers : homePlayers
  const myStamina = isHost ? homeStamina : awayStamina

  return (
    <div style={{ height:'100vh', backgroundImage:'url(/assets/stadium_bg.jpg)', backgroundSize:'cover', backgroundPosition:'center', display:'flex', flexDirection:'column', overflow:'hidden', position:'relative', fontFamily:"'Rajdhani',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Rajdhani:wght@400;500;600;700&display=swap');
        @keyframes diceRoll { 0%{transform:rotate(0deg) scale(1)} 25%{transform:rotate(90deg) scale(1.2)} 50%{transform:rotate(180deg) scale(0.9)} 75%{transform:rotate(270deg) scale(1.1)} 100%{transform:rotate(360deg) scale(1)} }
        @keyframes clashAnim { 0%{transform:scale(0.5);opacity:0} 50%{transform:scale(1.2);opacity:1} 100%{transform:scale(1);opacity:1} }
        @keyframes goalFlash { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes slideIn { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
      `}</style>
      <div style={{ position:'absolute', inset:0, background:'rgba(3,3,10,0.88)', pointerEvents:'none', zIndex:0 }}/>

      {/* SKOR HEADER */}
      <div style={{ position:'relative', zIndex:2, background:'rgba(15,15,35,0.85)', backdropFilter:'blur(20px)', borderBottom:'1px solid rgba(255,255,255,0.07)', padding:'.6rem 2rem', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        {/* Ev Sahibi */}
        <div style={{ flex:1, display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:32, height:32, background:'rgba(74,144,226,0.2)', border:'1px solid rgba(74,144,226,0.4)', borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>🏠</div>
          <div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:16, letterSpacing:2, color:'#fff' }}>{homeTeam?.team_name}</div>
            <div style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:10, color:'rgba(255,255,255,0.3)', letterSpacing:1 }}>{isHost?'(sen)':''}</div>
          </div>
        </div>

        {/* Skor */}
        <div style={{ textAlign:'center' }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:40, letterSpacing:8, lineHeight:1, color:'#fff' }}>
            <span style={{ color:homeScore>awayScore?'#10b981':'#fff' }}>{homeScore}</span>
            <span style={{ color:'rgba(255,255,255,0.2)', margin:'0 8px' }}>—</span>
            <span style={{ color:awayScore>homeScore?'#10b981':'#fff' }}>{awayScore}</span>
          </div>
          <div style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:11, letterSpacing:2, color:isFinished?'#ffd700':'rgba(255,255,255,0.4)', background:'rgba(0,0,0,0.4)', padding:'2px 12px', borderRadius:20, display:'inline-block', marginTop:2 }}>
            {isFinished ? '⏱ MAÇ BİTTİ' : `${minute}' — EVENT ${eventNo+1}/${TOTAL_EVENTS}`}
          </div>
        </div>

        {/* Deplasman */}
        <div style={{ flex:1, display:'flex', alignItems:'center', gap:10, justifyContent:'flex-end' }}>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:16, letterSpacing:2, color:'#fff' }}>{awayTeam?.team_name}</div>
            <div style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:10, color:'rgba(255,255,255,0.3)', letterSpacing:1 }}>{!isHost?'(sen)':''}</div>
          </div>
          <div style={{ width:32, height:32, background:'rgba(226,176,74,0.2)', border:'1px solid rgba(226,176,74,0.4)', borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>⚽</div>
        </div>
      </div>

      {/* ANA İÇERİK */}
      <div style={{ position:'relative', zIndex:1, flex:1, display:'grid', gridTemplateColumns:'1fr 340px 1fr', overflow:'hidden', gap:0 }}>

        {/* SOL: Ev Sahibi Kadrosu */}
        <div style={{ background:'rgba(10,15,30,0.6)', borderRight:'1px solid rgba(74,144,226,0.15)', padding:'1rem', overflowY:'auto' }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:11, letterSpacing:3, color:'rgba(74,144,226,0.6)', marginBottom:10 }}>EV SAHİBİ KADROSU</div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {homePlayers.map((p, i) => {
              const stam = homeStamina[p.name] || 100
              const isSelected = selectedAttackers.find(s=>s.name===p.name) || selectedDefenders.find(s=>s.name===p.name)
              // Sol panel = ev sahibi oyuncuları. Sadece isHost seçebilir
              const canSelect = phase === 'select' && isHost && myRole !== null
              return (
                <div key={i} onClick={() => canSelect && togglePlayer(p, myRole)}
                  style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px', borderRadius:8, background:isSelected?'rgba(74,144,226,0.25)':'rgba(255,255,255,0.03)', border:`1px solid ${isSelected?'rgba(74,144,226,0.6)':'rgba(255,255,255,0.05)'}`, cursor:canSelect?'pointer':'default', transition:'all .15s' }}>
                  {p.image && <img src={p.image} style={{ width:32, height:32, borderRadius:'50%', objectFit:'cover', objectPosition:'top', border:'1px solid rgba(74,144,226,0.3)' }} onError={e=>e.target.style.display='none'}/>}
                  {!p.image && <div style={{ width:32, height:32, borderRadius:'50%', background:'rgba(74,144,226,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Bebas Neue',sans-serif", fontSize:12, color:'#4a90e2' }}>{p.overall||'?'}</div>}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:13, fontWeight:700, color:'#fff', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.name?.split(' ').pop()}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                      <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:9, color:'rgba(74,144,226,0.7)', letterSpacing:1 }}>{p.squad_pos||p.position}</span>
                      <div style={{ flex:1, height:3, background:'rgba(255,255,255,0.1)', borderRadius:2, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${stam}%`, background:getStamColor(stam), borderRadius:2, transition:'width .3s' }}/>
                      </div>
                      <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:9, color:getStamColor(stam) }}>{stam}%</span>
                    </div>
                  </div>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:14, color:'#f5e663' }}>{p.overall}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ORTA: Spiker + Zar + Sonuç */}
        <div style={{ display:'flex', flexDirection:'column', background:'rgba(5,5,15,0.7)', borderLeft:'1px solid rgba(255,255,255,0.05)', borderRight:'1px solid rgba(255,255,255,0.05)' }}>

          {/* ZAR ANİMASYONU */}
          {(phase === 'dice' || homeDice !== null) && (
            <div style={{ padding:'1rem', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'center', gap:'2rem', background:'rgba(0,0,0,0.4)', flexShrink:0 }}>
              {/* Ev sahibi zar */}
              <div style={{ textAlign:'center' }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:10, letterSpacing:2, color:'rgba(74,144,226,0.6)', marginBottom:4 }}>EV</div>
                <div style={{ width:56, height:56, background:'rgba(74,144,226,0.15)', border:'2px solid rgba(74,144,226,0.5)', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Bebas Neue',sans-serif", fontSize:28, color:'#4a90e2', animation:diceRolling?'diceRoll 0.3s linear infinite':'none', boxShadow:homeDice&&homeDice>=(awayDice||0)?'0 0 15px rgba(74,144,226,0.5)':'none' }}>
                  {diceRolling ? '?' : (homeDice||'?')}
                </div>
              </div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:20, color:'rgba(255,255,255,0.3)' }}>VS</div>
              {/* Deplasman zar */}
              <div style={{ textAlign:'center' }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:10, letterSpacing:2, color:'rgba(226,176,74,0.6)', marginBottom:4 }}>DEP</div>
                <div style={{ width:56, height:56, background:'rgba(226,176,74,0.15)', border:'2px solid rgba(226,176,74,0.5)', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Bebas Neue',sans-serif", fontSize:28, color:'#e2b04a', animation:diceRolling?'diceRoll 0.3s linear infinite 0.15s':'none', boxShadow:awayDice&&awayDice>(homeDice||0)?'0 0 15px rgba(226,176,74,0.5)':'none' }}>
                  {diceRolling ? '?' : (awayDice||'?')}
                </div>
              </div>
            </div>
          )}

          {/* KAPIŞMA SONUCU */}
          {clashResult && (
            <div style={{ padding:'1rem', background:clashResult.winner==='attack'?'rgba(16,185,129,0.1)':'rgba(59,130,246,0.1)', borderBottom:'1px solid rgba(255,255,255,0.06)', textAlign:'center', animation:'clashAnim 0.5s ease', flexShrink:0 }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:clashResult.winner==='attack'?24:18, color:clashResult.winner==='attack'?'#10b981':'#3b82f6', letterSpacing:2, marginBottom:4, animation:clashResult.winner==='attack'?'goalFlash 0.5s ease infinite':'none' }}>
                {clashResult.winner === 'attack' ? '⚽ GOL!' : '🛡️ SAVUNMA!'}
              </div>
              <div style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:12, color:'rgba(255,255,255,0.5)' }}>
                Atak: {clashResult.atkScore} — Savunma: {clashResult.defScore}
              </div>
            </div>
          )}

          {/* OYUNCU SEÇİMİ */}
          {phase === 'select' && myRole && (
            <div style={{ padding:'1rem', background:myRole==='attacker'?'rgba(239,68,68,0.08)':'rgba(59,130,246,0.08)', borderBottom:'1px solid rgba(255,255,255,0.06)', flexShrink:0 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:14, color:myRole==='attacker'?'#ef4444':'#3b82f6', letterSpacing:2 }}>
                  {myRole === 'attacker' ? '⚡ 4 HÜCUMCU SEÇ' : '🛡️ 4 SAVUNMACI SEÇ'}
                </div>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:16, color:timeLeft<=5?'#ef4444':'#fff', animation:timeLeft<=5?'pulse 0.5s ease infinite':'none' }}>
                  {timeLeft}s
                </div>
              </div>
              <div style={{ display:'flex', gap:6, justifyContent:'center', marginBottom:8 }}>
                {(myRole==='attacker'?selectedAttackers:selectedDefenders).map((p,i)=>(
                  <div key={i} style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:11, color:'#fff', background:'rgba(255,255,255,0.1)', padding:'3px 8px', borderRadius:4 }}>{p.name?.split(' ').pop()}</div>
                ))}
              </div>
              <button onClick={submitSelection}
                disabled={(myRole==='attacker'?selectedAttackers:selectedDefenders).length===0}
                style={{ width:'100%', padding:'8px', borderRadius:6, border:'none', background:myRole==='attacker'?'#ef4444':'#3b82f6', color:'#fff', fontFamily:"'Bebas Neue',sans-serif", fontSize:13, letterSpacing:2, cursor:'pointer', opacity:(myRole==='attacker'?selectedAttackers:selectedDefenders).length===0?0.5:1 }}>
                ONAYLA ({(myRole==='attacker'?selectedAttackers:selectedDefenders).length}/4)
              </button>
            </div>
          )}

          {/* SPİKER YORUMLARI */}
          <div ref={commentaryRef} style={{ flex:1, overflowY:'auto', padding:'1rem', display:'flex', flexDirection:'column', gap:6 }}>
            {commentary.map(c => (
              <div key={c.id} style={{ padding:'8px 12px', borderRadius:8, background:c.type==='goal'?'rgba(16,185,129,0.12)':c.type==='attack'?'rgba(239,68,68,0.08)':'rgba(255,255,255,0.04)', border:`1px solid ${c.type==='goal'?'rgba(16,185,129,0.3)':c.type==='attack'?'rgba(239,68,68,0.15)':'rgba(255,255,255,0.05)'}`, animation:'slideIn 0.3s ease' }}>
                <div style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:13, color:c.type==='goal'?'#10b981':c.type==='attack'?'#fca5a5':'rgba(255,255,255,0.7)', lineHeight:1.4 }}>{c.text}</div>
              </div>
            ))}
            {commentary.length === 0 && (
              <div style={{ textAlign:'center', color:'rgba(255,255,255,0.2)', fontFamily:"'Rajdhani',sans-serif", fontSize:13, marginTop:'2rem' }}>
                🎙️ Maç başlıyor...
              </div>
            )}
          </div>

          {/* MAÇ SONU */}
          {isFinished && (
            <div style={{ padding:'1rem', borderTop:'1px solid rgba(255,255,255,0.08)', background:'rgba(0,0,0,0.5)', textAlign:'center', flexShrink:0 }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, letterSpacing:3, color:homeScore>awayScore?(isHost?'#10b981':'#ef4444'):awayScore>homeScore?(isHost?'#ef4444':'#10b981'):'#f59e0b', marginBottom:8 }}>
                {homeScore>awayScore?(isHost?'🏆 KAZANDIN!':'😔 KAYBETTİN'):awayScore>homeScore?(isHost?'😔 KAYBETTİN':'🏆 KAZANDIN!'):'🤝 BERABERLİK!'}
              </div>
              <button onClick={() => navigate(`/game/${lobby?.code}`)}
                style={{ padding:'10px 28px', borderRadius:8, border:'none', background:'linear-gradient(135deg,#7c3aed,#8b5cf6)', color:'#fff', fontFamily:"'Bebas Neue',sans-serif", fontSize:14, letterSpacing:3, cursor:'pointer' }}>
                ANA MENÜYE DÖN →
              </button>
            </div>
          )}
        </div>

        {/* SAĞ: Deplasman Kadrosu */}
        <div style={{ background:'rgba(30,10,10,0.6)', borderLeft:'1px solid rgba(226,176,74,0.15)', padding:'1rem', overflowY:'auto' }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:11, letterSpacing:3, color:'rgba(226,176,74,0.6)', marginBottom:10 }}>DEPLASMAN KADROSU</div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {awayPlayers.map((p, i) => {
              const stam = awayStamina[p.name] || 100
              const isSelected = selectedAttackers.find(s=>s.name===p.name) || selectedDefenders.find(s=>s.name===p.name)
              // Sağ panel = deplasman oyuncuları. Sadece !isHost seçebilir
              const canSelect = phase === 'select' && !isHost && myRole !== null
              return (
                <div key={i} onClick={() => canSelect && togglePlayer(p, myRole)}
                  style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px', borderRadius:8, background:isSelected?'rgba(226,176,74,0.2)':'rgba(255,255,255,0.03)', border:`1px solid ${isSelected?'rgba(226,176,74,0.5)':'rgba(255,255,255,0.05)'}`, cursor:canSelect?'pointer':'default', transition:'all .15s' }}>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:14, color:'#f5e663' }}>{p.overall}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:13, fontWeight:700, color:'#fff', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', textAlign:'right' }}>{p.name?.split(' ').pop()}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:4, justifyContent:'flex-end' }}>
                      <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:9, color:getStamColor(stam) }}>{stam}%</span>
                      <div style={{ flex:1, height:3, background:'rgba(255,255,255,0.1)', borderRadius:2, overflow:'hidden', maxWidth:60 }}>
                        <div style={{ height:'100%', width:`${stam}%`, background:getStamColor(stam), borderRadius:2 }}/>
                      </div>
                      <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:9, color:'rgba(226,176,74,0.7)', letterSpacing:1 }}>{p.squad_pos||p.position}</span>
                    </div>
                  </div>
                  {p.image && <img src={p.image} style={{ width:32, height:32, borderRadius:'50%', objectFit:'cover', objectPosition:'top', border:'1px solid rgba(226,176,74,0.3)' }} onError={e=>e.target.style.display='none'}/>}
                  {!p.image && <div style={{ width:32, height:32, borderRadius:'50%', background:'rgba(226,176,74,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Bebas Neue',sans-serif", fontSize:12, color:'#e2b04a' }}>{p.overall||'?'}</div>}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
