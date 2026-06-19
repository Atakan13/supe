import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const ATTACKER_ACTIONS = ['Şut çek', 'Çalım at', 'Orta yap', 'Pas ver', 'Hızlan']
const DEFENDER_ACTIONS = ['Önüne geç', 'Müdahale et', 'Pozisyon al', 'Baskı yap', 'Kaçmasına izin ver']
const GK_ACTIONS = ['Köşeye at', 'Tutmaya çalış', 'Yumrukla', 'Çık araya']

const ZONES = ['sol kanattan', 'orta sahadan', 'sağ kanattan']
const EVENT_NARRATIVES = [
  '{attacker} topu kaptı, {zone} geliyor!',
  '{attacker} hızlı bir kontratak başlattı!',
  '{attacker} ceza sahasına yaklaşıyor!',
  '{attacker} rakip savunmayı geçmeye çalışıyor!',
  'Tehlikeli bir atak! {attacker} {zone} ilerliyor!',
]

const STAT_MAP = {
  'Şut çek': 'shooting',
  'Çalım at': 'dribbling',
  'Orta yap': 'passing',
  'Pas ver': 'passing',
  'Hızlan': 'pace',
  'Önüne geç': 'defending',
  'Müdahale et': 'defending',
  'Pozisyon al': 'defending',
  'Baskı yap': 'physical',
  'Kaçmasına izin ver': 'pace',
  'Köşeye at': 'goalkeeper',
  'Tutmaya çalış': 'goalkeeper',
  'Yumrukla': 'physical',
  'Çık araya': 'pace',
}

function rollDice() { return Math.floor(Math.random() * 20) + 1 }

function getPositionStyle(pos, formation) {
  const layouts = {
    'GK': { bottom: '5%', left: '50%' },
    'LB': { bottom: '25%', left: '15%' },
    'CB': { bottom: '25%', left: '38%' },
    'RB': { bottom: '25%', left: '85%' },
    'LM': { bottom: '50%', left: '10%' },
    'CM': { bottom: '50%', left: '50%' },
    'RM': { bottom: '50%', left: '90%' },
    'CDM': { bottom: '40%', left: '50%' },
    'CAM': { bottom: '62%', left: '50%' },
    'LW': { bottom: '72%', left: '15%' },
    'RW': { bottom: '72%', left: '85%' },
    'ST': { bottom: '78%', left: '50%' },
    'CF': { bottom: '75%', left: '35%' },
  }
  return layouts[pos] || { bottom: '50%', left: '50%' }
}

export default function MatchPage() {
  const { matchId } = useParams()
  const navigate = useNavigate()

  const [match, setMatch] = useState(null)
  const [lobby, setLobby] = useState(null)
  const [mySquad, setMySquad] = useState([])
  const [opponentSquad, setOpponentSquad] = useState([])
  const [events, setEvents] = useState([])
  const [currentEvent, setCurrentEvent] = useState(null)
  const [commentary, setCommentary] = useState([])
  const [phase, setPhase] = useState('watching') // watching | pick_attacker | pick_defender | pick_gk | resolved
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [selectedAction, setSelectedAction] = useState(null)
  const [myAction, setMyAction] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [minute, setMinute] = useState(0)
  const [scores, setScores] = useState({ home: 0, away: 0 })
  const [isFinished, setIsFinished] = useState(false)
  const commentaryRef = useRef(null)

  const userId = localStorage.getItem('draft_user_id')

  useEffect(() => {
    init()
    const channel = supabase
      .channel(`match-${matchId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_events', filter: `match_id=eq.${matchId}` }, (payload) => {
        handleEventChange(payload)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` }, (payload) => {
        setMatch(payload.new)
        setScores({ home: payload.new.home_score, away: payload.new.away_score })
        if (payload.new.status === 'finished') setIsFinished(true)
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [matchId])

  const init = async () => {
    const { data: m } = await supabase.from('matches').select('*').eq('id', matchId).maybeSingle()
    if (!m) return
    setMatch(m)
    setScores({ home: m.home_score, away: m.away_score })

    const { data: lb } = await supabase.from('lobbies').select('*').eq('id', m.lobby_id).maybeSingle()
    setLobby(lb)

    const { data: myS } = await supabase.from('squads').select('*').eq('lobby_id', m.lobby_id).eq('user_id', userId).maybeSingle()
    const opId = m.home_user_id === userId ? m.away_user_id : m.home_user_id
    const { data: opS } = await supabase.from('squads').select('*').eq('lobby_id', m.lobby_id).eq('user_id', opId).maybeSingle()

    if (myS) setMySquad(myS.lineup || [])
    if (opS) setOpponentSquad(opS.lineup || [])

    const { data: evs } = await supabase.from('match_events').select('*').eq('match_id', matchId).order('created_at')
    if (evs) setEvents(evs)

    setLoading(false)

    // Host ise maç motorunu başlat
    const { data: lp } = await supabase.from('lobby_players').select('*').eq('lobby_id', m.lobby_id).eq('user_id', userId).maybeSingle()
    if (lp?.is_host && evs?.length === 0) {
      setTimeout(() => runMatchEngine(m, myS, opS), 1000)
    }
  }

  const addCommentary = (text, type = 'normal') => {
    setCommentary(prev => [...prev.slice(-20), { text, type, id: Date.now() }])
    setTimeout(() => {
      if (commentaryRef.current) commentaryRef.current.scrollTop = commentaryRef.current.scrollHeight
    }, 100)
  }

  const handleEventChange = async (payload) => {
    const ev = payload.new || payload.old
    if (!ev) return

    if (payload.eventType === 'INSERT') {
      setEvents(prev => [...prev, ev])
      setCurrentEvent(ev)
      setMinute(ev.minute || 0)

      if (ev.event_type === 'narrative') {
        addCommentary(ev.narrative_text, 'normal')
        return
      }

      if (ev.event_type === 'goal') {
        addCommentary('⚽ GOL!!! ' + (ev.narrative_text || ''), 'goal')
        return
      }

      if (ev.event_type === 'attack') {
        addCommentary('🔥 ' + ev.narrative_text, 'attack')
        // Rolü belirle
        if (ev.attacking_user === userId) {
          setPhase('pick_attacker')
          setMyAction(null)
          setSelectedPlayer(null)
          setSelectedAction(null)
        } else {
          setPhase('pick_defender')
          setMyAction(null)
          setSelectedPlayer(null)
          setSelectedAction(null)
        }
      }

      if (ev.event_type === 'shot') {
        addCommentary('🥅 Şut geliyor!', 'attack')
        if (ev.defending_user === userId) {
          setPhase('pick_gk')
          setMyAction(null)
          setSelectedPlayer(null)
          setSelectedAction(null)
        } else {
          addCommentary('Rakip kalecisi pozisyon alıyor...', 'normal')
        }
      }
    }

    if (payload.eventType === 'UPDATE') {
      if (ev.action_phase === 'resolved') {
        setPhase('watching')
        setResult({ result: ev.result, attacker_total: ev.attacker_total, defender_total: ev.defender_total, attacker_roll: ev.attacker_roll, defender_roll: ev.defender_roll })
        const msg = ev.result === 'attack_success' ? '✅ Atak başarılı! Şut pozisyonu...' :
          ev.result === 'goal' ? '⚽ GOOOL!' :
          ev.result === 'save' ? '🧤 Kaleci kurtardı!' :
          ev.result === 'no_goal' ? '😤 Gol değil!' : '❌ Savunma kesti!'
        addCommentary(msg, ev.result === 'goal' ? 'goal' : 'normal')
        setTimeout(() => setResult(null), 3000)
      }
    }
  }

  const runMatchEngine = async (m, myS, opS) => {
    const totalEvents = 12 // 90 dakika simülasyonu, 12 olay
    const minutes = [5,12,18,24,31,38,45,52,60,68,75,83,88]

    for (let i = 0; i < totalEvents; i++) {
      await new Promise(r => setTimeout(r, 3000))
      const min = minutes[i] || 90
      const isAttack = Math.random() > 0.3
      const attackingUser = Math.random() > 0.5 ? m.home_user_id : m.away_user_id
      const defendingUser = attackingUser === m.home_user_id ? m.away_user_id : m.home_user_id
      const zone = ZONES[Math.floor(Math.random() * ZONES.length)]

      // Anlatı ekle
      const narr = EVENT_NARRATIVES[Math.floor(Math.random() * EVENT_NARRATIVES.length)]
        .replace('{attacker}', 'Atak takımı').replace('{zone}', zone)

      await supabase.from('match_events').insert({
        match_id: m.id,
        minute: min,
        event_type: 'attack',
        attacking_user: attackingUser,
        defending_user: defendingUser,
        zone,
        narrative_text: narr,
        action_phase: 'pending',
      })

      // Hamleler için bekle (15sn)
      await new Promise(r => setTimeout(r, 15000))

      // Hala pending ise otomatik çöz
      const { data: pendingEv } = await supabase
        .from('match_events')
        .select('*')
        .eq('match_id', m.id)
        .eq('action_phase', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (pendingEv) {
        await resolveEvent(pendingEv, m)
      }
    }

    // Maçı bitir
    await supabase.from('matches').update({ status: 'finished' }).eq('id', m.id)
    addCommentary('🏁 Maç sona erdi!', 'goal')
    setIsFinished(true)
  }

  const resolveEvent = async (ev, m) => {
    const { data: actions } = await supabase.from('match_actions').select('*').eq('event_id', ev.id)
    const attackAction = actions?.find(a => a.role === 'attacker')
    const defAction = actions?.find(a => a.role === 'defender')

    // Rastgele stat seç eğer hamle gönderilmediyse
    const atkStat = attackAction ? STAT_MAP[attackAction.action_choice] || 'shooting' : 'shooting'
    const defStat = defAction ? STAT_MAP[defAction.action_choice] || 'defending' : 'defending'

    // Squad'lardan oyuncu bul
    const atkSquad = ev.attacking_user === (m?.home_user_id) ?
      (await supabase.from('squads').select('*').eq('lobby_id', m.lobby_id).eq('user_id', ev.attacking_user).maybeSingle()).data?.lineup || [] :
      (await supabase.from('squads').select('*').eq('lobby_id', m.lobby_id).eq('user_id', ev.attacking_user).maybeSingle()).data?.lineup || []

    const randomAtk = atkSquad[Math.floor(Math.random() * Math.min(3, atkSquad.length))]
    const atkStat_val = randomAtk ? (randomAtk[atkStat] || 70) : 70
    const defStat_val = 65 + Math.floor(Math.random() * 20)

    const atkRoll = rollDice()
    const defRoll = rollDice()
    const atkTotal = atkStat_val + atkRoll
    const defTotal = defStat_val + defRoll

    const attackSuccess = atkTotal > defTotal

    if (attackSuccess) {
      // Şut pozisyonu
      const shotRoll = rollDice()
      const shootStat = randomAtk ? (randomAtk['shooting'] || 70) : 70
      const gkStat = 72 + Math.floor(Math.random() * 15)
      const gkRoll = rollDice()
      const isGoal = (shootStat + shotRoll) > (gkStat + gkRoll)

      if (isGoal) {
        const newScore = ev.attacking_user === m.home_user_id
          ? { home_score: (m.home_score || 0) + 1 }
          : { away_score: (m.away_score || 0) + 1 }
        await supabase.from('matches').update(newScore).eq('id', m.id)
        await supabase.from('match_events').update({
          action_phase: 'resolved', result: 'goal',
          attacker_roll: atkRoll, defender_roll: defRoll,
          attacker_total: atkTotal, defender_total: defTotal,
          narrative_text: `${randomAtk?.name || 'Oyuncu'} GOOOL! (${shootStat + shotRoll} vs ${gkStat + gkRoll})`,
        }).eq('id', ev.id)

        await supabase.from('match_events').insert({
          match_id: m.id, minute: ev.minute, event_type: 'goal',
          attacking_user: ev.attacking_user, narrative_text: `⚽ ${randomAtk?.name || 'Oyuncu'} attı!`,
          action_phase: 'resolved',
        })
      } else {
        await supabase.from('match_events').update({
          action_phase: 'resolved', result: 'save',
          attacker_roll: atkRoll, defender_roll: defRoll,
          attacker_total: atkTotal, defender_total: defTotal,
        }).eq('id', ev.id)
      }
    } else {
      await supabase.from('match_events').update({
        action_phase: 'resolved', result: 'attack_fail',
        attacker_roll: atkRoll, defender_roll: defRoll,
        attacker_total: atkTotal, defender_total: defTotal,
      }).eq('id', ev.id)
    }
  }

  const submitAction = async () => {
    if (!selectedPlayer || !selectedAction || !currentEvent) return
    const role = phase === 'pick_attacker' ? 'attacker' : phase === 'pick_defender' ? 'defender' : 'goalkeeper'

    await supabase.from('match_actions').insert({
      match_id: matchId,
      event_id: currentEvent.id,
      user_id: userId,
      role,
      selected_player_id: selectedPlayer.id,
      action_choice: selectedAction,
    })

    setMyAction({ player: selectedPlayer, action: selectedAction })
    setPhase('waiting')
    addCommentary(`✅ Hamlen gönderildi: ${selectedPlayer.name} - ${selectedAction}`, 'normal')
  }

  const isHome = match?.home_user_id === userId
  const squadToShow = phase === 'pick_attacker' ? mySquad :
    phase === 'pick_defender' ? mySquad.filter(p => ['GK','CB','LB','RB','CDM'].includes(p.squad_pos || p.position)) :
    phase === 'pick_gk' ? mySquad.filter(p => p.position === 'GK') : []
  const actionsToShow = phase === 'pick_attacker' ? ATTACKER_ACTIONS :
    phase === 'pick_defender' ? DEFENDER_ACTIONS :
    phase === 'pick_gk' ? GK_ACTIONS : []

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--text-secondary)' }}>Maç yükleniyor...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'grid', gridTemplateColumns: '1fr 340px', height: '100vh', overflow: 'hidden' }}>

      {/* SOL: Saha + Skor */}
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Skor Tablosu */}
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>{isHome ? '🏠 ' : ''}{match?.home_user_id === userId ? localStorage.getItem('draft_user_name') : 'Rakip'}</div>
          </div>
          <div style={{ textAlign: 'center', padding: '0 1.5rem' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: '0.1em' }}>
              <span style={{ color: isHome ? 'var(--green)' : 'var(--text-secondary)' }}>{scores.home}</span>
              <span style={{ color: 'var(--text-muted)', margin: '0 0.5rem' }}>-</span>
              <span style={{ color: !isHome ? 'var(--green)' : 'var(--text-secondary)' }}>{scores.away}</span>
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>{minute}' {isFinished ? '• BİTTİ' : ''}</div>
          </div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>{!isHome ? '🏠 ' : ''}Rakip</div>
          </div>
        </div>

        {/* Saha */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: 'linear-gradient(180deg, #0d3320 0%, #0f4a28 50%, #0d3320 100%)' }}>
          {/* Saha çizgileri */}
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 400 600" preserveAspectRatio="none">
            <rect x="20" y="20" width="360" height="560" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2"/>
            <line x1="20" y1="300" x2="380" y2="300" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5"/>
            <circle cx="200" cy="300" r="50" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5"/>
            <rect x="120" y="20" width="160" height="80" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5"/>
            <rect x="120" y="500" width="160" height="80" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5"/>
            <rect x="160" y="20" width="80" height="40" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>
            <rect x="160" y="540" width="80" height="40" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>
          </svg>

          {/* Kadro oyuncuları */}
          {mySquad.map((player, i) => {
            const pos = player.squad_pos || player.position
            const style = getPositionStyle(pos, lobby?.formation)
            return (
              <div
                key={i}
                onClick={() => phase !== 'watching' && phase !== 'waiting' && setSelectedPlayer(player)}
                style={{
                  position: 'absolute',
                  bottom: style.bottom,
                  left: style.left,
                  transform: 'translate(-50%, 50%)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                  cursor: phase !== 'watching' && phase !== 'waiting' ? 'pointer' : 'default',
                  zIndex: 2,
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: selectedPlayer?.id === player.id ? 'var(--gold)' : 'var(--purple)',
                  border: `2px solid ${selectedPlayer?.id === player.id ? 'white' : 'rgba(255,255,255,0.3)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: '0.7rem',
                  boxShadow: selectedPlayer?.id === player.id ? '0 0 12px rgba(251,191,36,0.8)' : 'none',
                  transition: 'all 0.2s',
                }}>
                  {player.overall}
                </div>
                <div style={{ background: 'rgba(0,0,0,0.7)', borderRadius: 4, padding: '1px 4px', fontSize: '0.6rem', fontWeight: 700, whiteSpace: 'nowrap', maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {player.name?.split(' ').pop()}
                </div>
              </div>
            )
          })}

          {/* Sonuç Popup */}
          {result && (
            <div style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
              background: 'rgba(0,0,0,0.9)', border: '2px solid var(--purple)',
              borderRadius: 16, padding: '1.5rem 2rem', textAlign: 'center', zIndex: 10,
              animation: 'fadeIn 0.3s ease',
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
                {result.result === 'goal' ? '⚽' : result.result === 'attack_success' ? '✅' : result.result === 'save' ? '🧤' : '❌'}
              </div>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                {result.result === 'goal' ? 'GOOOL!' : result.result === 'attack_success' ? 'Başarılı Atak!' : result.result === 'save' ? 'Kurtarış!' : 'Savunma Kesti!'}
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                Atak: {result.attacker_total} vs Savunma: {result.defender_total}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                Zar: {result.attacker_roll} vs {result.defender_roll}
              </div>
            </div>
          )}
        </div>

        {/* Hamle Seçim Paneli */}
        {(phase === 'pick_attacker' || phase === 'pick_defender' || phase === 'pick_gk') && (
          <div style={{ borderTop: '2px solid var(--purple)', background: 'var(--bg-secondary)', padding: '1rem 1.5rem' }}>
            <div style={{ color: 'var(--purple-light)', fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>
              {phase === 'pick_attacker' ? '⚡ ATAK HAMLESİ SEÇ' : phase === 'pick_gk' ? '🧤 KALECİ HAMLESİ' : '🛡️ SAVUNMA HAMLESİ'}
            </div>

            {/* Oyuncu Seç */}
            <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', marginBottom: '0.75rem', paddingBottom: '0.25rem' }}>
              {squadToShow.map((p, i) => (
                <div
                  key={i}
                  onClick={() => setSelectedPlayer(p)}
                  style={{
                    minWidth: 80, background: selectedPlayer?.id === p.id ? 'var(--purple)' : 'var(--bg-card)',
                    border: `1px solid ${selectedPlayer?.id === p.id ? 'var(--purple-light)' : 'var(--border)'}`,
                    borderRadius: 8, padding: '0.5rem', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{p.overall}</div>
                  <div style={{ fontSize: '0.65rem', fontWeight: 600, marginBottom: '0.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.name?.split(' ').pop()}
                  </div>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{p.squad_pos || p.position}</div>
                </div>
              ))}
            </div>

            {/* Hamle Seç */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              {actionsToShow.map(action => (
                <button
                  key={action}
                  onClick={() => setSelectedAction(action)}
                  style={{
                    background: selectedAction === action ? 'var(--purple)' : 'var(--bg-card)',
                    border: `1px solid ${selectedAction === action ? 'var(--purple-light)' : 'var(--border)'}`,
                    borderRadius: 8, padding: '0.4rem 0.75rem', color: 'white', fontSize: '0.8rem', fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {action}
                </button>
              ))}
            </div>

            <button
              className="btn btn-primary"
              onClick={submitAction}
              disabled={!selectedPlayer || !selectedAction}
              style={{ width: '100%', opacity: selectedPlayer && selectedAction ? 1 : 0.5 }}
            >
              HAMLE GÖNDER →
            </button>
          </div>
        )}

        {phase === 'waiting' && (
          <div style={{ borderTop: '2px solid var(--green)', background: 'var(--bg-secondary)', padding: '1rem 1.5rem', textAlign: 'center' }}>
            <div style={{ color: 'var(--green)', fontWeight: 700 }} className="animate-pulse">
              ✅ Hamlen gönderildi! Rakip bekleniyor...
            </div>
            {myAction && (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                {myAction.player.name} · {myAction.action}
              </div>
            )}
          </div>
        )}

        {isFinished && (
          <div style={{ borderTop: '2px solid var(--gold)', background: 'var(--bg-secondary)', padding: '1rem 1.5rem', textAlign: 'center' }}>
            <div style={{ color: 'var(--gold)', fontWeight: 800, fontSize: '1.1rem', marginBottom: '0.5rem' }}>🏁 MAÇ BİTTİ</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '0.75rem' }}>{scores.home} - {scores.away}</div>
            <button className="btn btn-primary" onClick={() => navigate('/')}>Ana Menüye Dön</button>
          </div>
        )}
      </div>

      {/* SAĞ: Spiker / Maç Anlatısı */}
      <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>📺 Maç Anlatısı</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Canlı spiker yorumları</div>
        </div>

        <div ref={commentaryRef} style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {commentary.length === 0 && (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', marginTop: '2rem' }}>
              Maç başlıyor...
            </div>
          )}
          {commentary.map(c => (
            <div key={c.id} className="animate-fade" style={{
              padding: '0.6rem 0.75rem', borderRadius: 8, fontSize: '0.85rem',
              background: c.type === 'goal' ? 'rgba(251,191,36,0.1)' : c.type === 'attack' ? 'rgba(124,58,237,0.1)' : 'var(--bg-secondary)',
              borderLeft: `3px solid ${c.type === 'goal' ? 'var(--gold)' : c.type === 'attack' ? 'var(--purple)' : 'var(--border)'}`,
              color: c.type === 'goal' ? 'var(--gold)' : 'var(--text-primary)',
              fontWeight: c.type === 'goal' ? 700 : 400,
            }}>
              {c.text}
            </div>
          ))}
        </div>

        {/* Maç İstatistikleri */}
        <div style={{ padding: '1rem', borderTop: '1px solid var(--border)' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em', marginBottom: '0.75rem' }}>MAÇ İSTATİSTİKLERİ</div>
          {[
            ['Toplam Olaylar', events.length, ''],
            ['Goller', scores.home + scores.away, ''],
            ['Dakika', minute, "'"],
          ].map(([label, value, suffix]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
              <span style={{ fontWeight: 700 }}>{value}{suffix}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
