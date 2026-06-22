import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PLAYER_CARDS } from '../lib/playerCards'

function getUserId() {
  let id = localStorage.getItem('draft_user_id')
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('draft_user_id', id) }
  return id
}

const CATEGORIES = {
  'Kaleci':    { positions: ['GK'],                          label: 'KALECİ' },
  'Defans':    { positions: ['CB','LB','RB'],                label: 'DEFANS' },
  'Orta Saha': { positions: ['CDM','CM','CAM','LM','RM'],    label: 'ORTA SAHA' },
  'Hücum':     { positions: ['LW','RW','ST','CF'],           label: 'HÜCUM' },
}

const TICKER_MSGS = ['TRANSFER HABERİ','SON DAKİKA','BOMBA TRANSFER','RESMİ AÇIKLAMA','TRANSFER GELİŞMESİ']

// Kart tipi: overall'a göre
function getCardType(overall) {
  if (overall >= 85) return 'special'
  if (overall >= 78) return 'gold'
  if (overall >= 72) return 'silver'
  return 'bronze'
}

function getCardStyle(type) {
  switch(type) {
    case 'special': return {
      bg: 'linear-gradient(160deg, #0d1b3e 0%, #162040 40%, #0a1628 100%)',
      border: 'linear-gradient(160deg, #00c8ff, #7b2fff, #00c8ff)',
      shadow: '0 0 25px rgba(0,200,255,0.25)',
      overall: '#00c8ff',
      overallShadow: '0 0 10px rgba(0,200,255,0.5)',
      pos: '#7b2fff',
      name: '#00c8ff',
      stat: '#fff',
      statLbl: 'rgba(0,200,255,0.6)',
      corner: 'rgba(0,200,255,0.4)',
    }
    case 'gold': return {
      bg: 'linear-gradient(160deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)',
      border: 'linear-gradient(160deg, #d4af37, #f5e663, #d4af37, #8b6914)',
      shadow: '0 0 20px rgba(212,175,55,0.3)',
      overall: '#f5e663',
      overallShadow: '0 0 10px rgba(245,230,99,0.5)',
      pos: '#d4af37',
      name: '#f5e663',
      stat: '#f5e663',
      statLbl: 'rgba(212,175,55,0.6)',
      corner: 'rgba(212,175,55,0.4)',
    }
    case 'silver': return {
      bg: 'linear-gradient(160deg, #1a1e2e 0%, #232840 40%, #1a1e35 100%)',
      border: 'linear-gradient(160deg, #a0a8c0, #d0d8f0, #a0a8c0)',
      shadow: '0 0 15px rgba(160,168,192,0.15)',
      overall: '#d0d8f0',
      overallShadow: 'none',
      pos: '#a0a8c0',
      name: '#d0d8f0',
      stat: '#d0d8f0',
      statLbl: 'rgba(160,168,192,0.6)',
      corner: 'rgba(160,168,192,0.3)',
    }
    default: return {
      bg: 'linear-gradient(160deg, #1a1510 0%, #1e1a12 40%, #161208 100%)',
      border: 'linear-gradient(160deg, #8b6914, #c4972a, #8b6914)',
      shadow: '0 0 10px rgba(139,105,20,0.2)',
      overall: '#c4972a',
      overallShadow: 'none',
      pos: '#8b6914',
      name: '#c4972a',
      stat: '#c4972a',
      statLbl: 'rgba(139,105,20,0.6)',
      corner: 'rgba(139,105,20,0.3)',
    }
  }
}

function FutCard({ card, onClick, disabled, selected }) {
  const type = getCardType(card.overall)
  const s = getCardStyle(type)
  const shortName = card.name.split(' ').slice(-1)[0].toUpperCase()

  return (
    <div
      onClick={() => !disabled && onClick(card)}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '0.68',
        borderRadius: 10,
        overflow: 'hidden',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: s.bg,
        boxShadow: selected
          ? `0 0 0 2px #00c8ff, 0 0 30px rgba(0,200,255,0.5), ${s.shadow}`
          : `0 2px 12px rgba(0,0,0,0.5), ${s.shadow}`,
        transform: selected ? 'translateY(-6px) scale(1.04)' : 'translateY(0) scale(1)',
        transition: 'all 0.25s ease',
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.transform = 'translateY(-4px) scale(1.03)' }}
      onMouseLeave={e => { if (!disabled && !selected) e.currentTarget.style.transform = 'translateY(0) scale(1)' }}
    >
      {/* Gradient border via pseudo-outline */}
      <div style={{
        position: 'absolute', inset: 0,
        borderRadius: 10,
        padding: 1.5,
        background: s.border,
        WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
        WebkitMaskComposite: 'xor',
        maskComposite: 'exclude',
        pointerEvents: 'none',
        zIndex: 5,
      }}/>

      {/* Shine */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, transparent 50%, rgba(255,255,255,0.02) 100%)',
        pointerEvents: 'none', zIndex: 4,
      }}/>

      {/* Corner decos */}
      {[
        { top:5, left:5, borderWidth:'1.5px 0 0 1.5px' },
        { top:5, right:5, borderWidth:'1.5px 1.5px 0 0' },
        { bottom:5, left:5, borderWidth:'0 0 1.5px 1.5px' },
        { bottom:5, right:5, borderWidth:'0 1.5px 1.5px 0' },
      ].map((pos, i) => (
        <div key={i} style={{
          position:'absolute', width:10, height:10,
          borderStyle:'solid', borderColor: s.corner,
          ...pos, zIndex: 5, pointerEvents:'none',
        }}/>
      ))}

      {/* Overall + Pozisyon */}
      <div style={{ position:'absolute', top:7, left:8, zIndex:3 }}>
        <div style={{
          fontFamily: "'Bebas Neue', 'Rajdhani', sans-serif",
          fontSize: 26, fontWeight:900, lineHeight:1,
          color: s.overall,
          textShadow: s.overallShadow,
        }}>{card.overall}</div>
        <div style={{
          fontFamily: "'Bebas Neue', 'Rajdhani', sans-serif",
          fontSize: 11, letterSpacing:1,
          color: s.pos, marginTop:-2,
        }}>{card.position}</div>
      </div>

      {/* Silüet */}
      <div style={{
        position:'absolute', inset:0,
        display:'flex', alignItems:'flex-end', justifyContent:'center',
        zIndex: 2,
      }}>
        <svg viewBox="0 0 100 160" style={{
          width:'72%', height:'78%', marginBottom:-2,
          filter: type==='special'
            ? 'drop-shadow(0 0 8px rgba(0,200,255,0.35))'
            : type==='gold'
            ? 'drop-shadow(0 0 6px rgba(212,175,55,0.3))'
            : 'drop-shadow(0 0 4px rgba(160,168,192,0.2))',
          opacity: 0.88,
        }}>
          <ellipse cx="50" cy="21" rx="15" ry="16" fill={type==='special'?'#1a2a4a':type==='gold'?'#1a1a2e':'#1a1e35'}/>
          <path d="M18 72 C18 46 34 36 50 36 C66 36 82 46 82 72 L79 112 L63 112 L61 82 L50 87 L39 82 L37 112 L21 112 Z"
            fill={type==='special'?'#1a2a4a':type==='gold'?'#1a1a2e':'#1a1e35'}/>
          <path d="M21 112 L17 157 L37 157 L43 122 L50 127 L57 122 L63 157 L83 157 L79 112 Z"
            fill={type==='special'?'#1a2a4a':type==='gold'?'#1a1a2e':'#1a1e35'}/>
        </svg>
      </div>

      {/* Alt: İsim + Statslar */}
      <div style={{
        position:'absolute', bottom:0, left:0, right:0,
        background:'linear-gradient(0deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.5) 70%, transparent 100%)',
        padding:'18px 6px 7px',
        zIndex: 3,
      }}>
        <div style={{
          fontFamily: "'Bebas Neue', 'Rajdhani', sans-serif",
          fontSize: 12, letterSpacing:1.5, textAlign:'center',
          color: s.name,
          whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
          marginBottom: 5,
        }}>{card.name.toUpperCase()}</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'2px 1px' }}>
          {[['HZ',card.pace],['ŞUT',card.shooting],['PAS',card.passing],['ÇAL',card.dribbling],['DEF',card.defending],['FİZ',card.physical]].map(([l,v])=>(
            <div key={l} style={{ textAlign:'center' }}>
              <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:12, color:s.stat, lineHeight:1 }}>{v}</div>
              <div style={{ fontSize:7, color:s.statLbl, letterSpacing:0.5 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function DraftPage() {
  const { code } = useParams()
  const navigate = useNavigate()
  const userId = getUserId()

  const [lobby, setLobby] = useState(null)
  const [lobbyPlayers, setLobbyPlayers] = useState([])
  const [allCards, setAllCards] = useState([])
  const [picks, setPicks] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('Kaleci')
  const [search, setSearch] = useState('')
  const [currentTurnUserId, setCurrentTurnUserId] = useState(null)
  const [tickerItems, setTickerItems] = useState(['Draft başladı! Oyuncular seçiliyor...'])
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const channelRef = useRef(null)
  const prevOpPickCount = useRef(0)
  const lobbyRef = useRef(null)
  const lobbyPlayersRef = useRef([])
  const lobbyIdRef = useRef(null)

  const calcTurn = (totalCount, players) => {
    if (!players || players.length < 2) return players?.[0]?.user_id
    const cycle = players.length * 2
    const pos = totalCount % cycle
    if (pos < players.length) return players[pos].user_id
    return players[cycle - 1 - pos].user_id
  }

  const loadPicks = useCallback(async () => {
    const lobbyId = lobbyIdRef.current
    if (!lobbyId) return
    const { data, error } = await supabase.from('draft_picks').select('*').eq('lobby_id', lobbyId).order('pick_order')
    if (error || !data) return
    const enriched = data.map(pick => ({
      ...pick,
      player_cards: PLAYER_CARDS.find(c => c.id === pick.player_card_id)
    }))
    setPicks(enriched)
    setCurrentTurnUserId(calcTurn(enriched.length, lobbyPlayersRef.current))
    const newOpPicks = enriched.filter(p => p.picked_by !== userId)
    if (newOpPicks.length > prevOpPickCount.current) {
      const newest = newOpPicks[newOpPicks.length - 1]
      if (newest?.player_cards) {
        const label = TICKER_MSGS[Math.floor(Math.random() * TICKER_MSGS.length)]
        setTickerItems(prev => [...prev, `${label}: ${newest.player_cards.name} (${newest.player_cards.overall}) → ${newest.squad_position}`])
      }
      prevOpPickCount.current = newOpPicks.length
    }
  }, [userId])

  useEffect(() => {
    init()
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [code])

  useEffect(() => {
    const interval = setInterval(() => { loadPicks() }, 2000)
    return () => clearInterval(interval)
  }, [loadPicks])

  const init = async () => {
    const { data: lb } = await supabase.from('lobbies').select('*').ilike('code', code).maybeSingle()
    if (!lb) return
    setLobby(lb); lobbyRef.current = lb; lobbyIdRef.current = lb.id
    const { data: pl } = await supabase.from('lobby_players').select('*').eq('lobby_id', lb.id).order('joined_at')
    setLobbyPlayers(pl || []); lobbyPlayersRef.current = pl || []
    setAllCards([...PLAYER_CARDS].sort((a, b) => b.overall - a.overall))
    await loadPicks()
    setLoading(false)
    channelRef.current = supabase.channel('draft-' + lb.id)
      .on('postgres_changes', { event:'*', schema:'public', table:'draft_picks', filter:`lobby_id=eq.${lb.id}` }, () => loadPicks())
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'lobbies', filter:`id=eq.${lb.id}` }, async (p) => {
        if (p.new.status === 'playing') navigate(`/game/${code}`)
      })
      .subscribe()
  }

  const myPicks = picks.filter(p => p.picked_by === userId)
  const isMyTurn = currentTurnUserId === userId
  const myFinished = myPicks.length >= 18
  const budget = lobbyRef.current ? lobbyRef.current.budget - myPicks.reduce((s, p) => s + (p.price || 0), 0) : 0

  const handleCardClick = async (card) => {
    if (!isMyTurn || myFinished || submitting) return
    setSubmitting(true); setErrorMsg('')
    try {
      const lb = lobbyRef.current
      const { data: freshPicks } = await supabase.from('draft_picks').select('player_card_id, picked_by').eq('lobby_id', lb.id)
      if (freshPicks?.find(p => p.player_card_id === card.id)) { await loadPicks(); return }
      const myFreshPicks = freshPicks?.filter(p => p.picked_by === userId) || []
      const { error } = await supabase.from('draft_picks').insert({
        lobby_id: lb.id, player_card_id: card.id, picked_by: userId,
        round: myFreshPicks.length + 1, pick_order: (freshPicks?.length || 0) + 1,
        price: card.market_value, squad_position: card.position,
      })
      if (error && error.code !== '23505') setErrorMsg('Hata: ' + error.message)
      else await loadPicks()
    } catch (e) { setErrorMsg('Hata: ' + e.message) }
    finally { setSubmitting(false) }
  }

  const handleFinish = async () => {
    if (myPicks.length < 18 || submitting) return
    setSubmitting(true)
    try {
      const lb = lobbyRef.current
      const lineup = myPicks.slice(0, 11).map(p => ({ ...p.player_cards, squad_pos: p.squad_position, pick_id: p.id }))
      const bench  = myPicks.slice(11).map(p => ({ ...p.player_cards, squad_pos: p.squad_position, pick_id: p.id }))
      const { data: ex } = await supabase.from('squads').select('id').eq('lobby_id', lb.id).eq('user_id', userId).maybeSingle()
      const squadData = { lobby_id: lb.id, user_id: userId, formation: lb.formation, lineup, bench }
      if (ex) await supabase.from('squads').update(squadData).eq('id', ex.id)
      else await supabase.from('squads').insert(squadData)
      const { data: allSquads } = await supabase.from('squads').select('*').eq('lobby_id', lb.id)
      if (allSquads && allSquads.length >= lobbyPlayersRef.current.length) {
        await supabase.from('lobbies').update({ status: 'playing' }).eq('id', lb.id)
      }
      navigate(`/game/${code}`)
    } finally { setSubmitting(false) }
  }

  const pickedCardIds = picks.map(p => p.player_card_id)
  const catPositions = CATEGORIES[activeCategory]?.positions || []
  const filteredCards = allCards.filter(c => {
    if (pickedCardIds.includes(c.id)) return false
    if (!catPositions.includes(c.position)) return false
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const myTeamName = lobbyPlayers.find(p => p.user_id === userId)?.team_name || 'Kadrom'
  const turnName = lobbyPlayers.find(p => p.user_id === currentTurnUserId)?.team_name || '...'

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#080c18', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ color:'rgba(255,255,255,0.4)', fontFamily:"'Bebas Neue', sans-serif", fontSize:18, letterSpacing:3 }}>YÜKLENİYOR...</div>
    </div>
  )

  return (
    <div style={{ height:'100vh', background:'#080c18', display:'flex', flexDirection:'column', overflow:'hidden', position:'relative' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Rajdhani:wght@400;500;600;700&display=swap');
        @keyframes tickerMove{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes ringPulse{0%,100%{box-shadow:0 0 0 2px rgba(0,200,255,0.6)}50%{box-shadow:0 0 0 3px rgba(0,200,255,0.9)}}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:2px}
      `}</style>

      {/* Arka plan grid */}
      <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(rgba(0,200,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(0,200,255,0.025) 1px, transparent 1px)', backgroundSize:'40px 40px', pointerEvents:'none', zIndex:0 }}/>
      <div style={{ position:'absolute', width:500, height:500, background:'radial-gradient(circle, rgba(0,100,255,0.07) 0%, transparent 70%)', top:-150, left:-150, pointerEvents:'none', zIndex:0 }}/>

      {/* SIRA BAR */}
      <div style={{ padding:'.6rem 1.25rem', background: isMyTurn ? 'rgba(0,200,255,0.08)' : 'rgba(0,0,0,0.7)', borderBottom: isMyTurn ? '1px solid rgba(0,200,255,0.25)' : '1px solid rgba(255,255,255,0.05)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, position:'relative', zIndex:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'.75rem' }}>
          <div style={{ width:8, height:8, borderRadius:'50%', background:isMyTurn?'#00c8ff':'#f59e0b', animation:isMyTurn?'blink 1s infinite':'none', boxShadow:isMyTurn?'0 0 8px #00c8ff':'none' }}/>
          <span style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:15, letterSpacing:2, color:isMyTurn?'#00c8ff':'rgba(255,255,255,0.4)' }}>
            {isMyTurn ? '⚡ SIRA SENİN — TIKLAYARAK SEÇ' : `⏳ ${turnName.toUpperCase()} SEÇİYOR...`}
          </span>
        </div>
        <div style={{ display:'flex', gap:'1.5rem', fontSize:12 }}>
          <span style={{ color:'rgba(255,255,255,0.3)', fontFamily:"'Bebas Neue', sans-serif", letterSpacing:1 }}>PİCK <strong style={{ color:'#fff' }}>{picks.length+1}/36</strong></span>
          <span style={{ color:'rgba(255,255,255,0.3)', fontFamily:"'Bebas Neue', sans-serif", letterSpacing:1 }}>BÜTÇE <strong style={{ color:'#00c8ff' }}>€{(budget/1e6).toFixed(0)}M</strong></span>
          <span style={{ color:'rgba(255,255,255,0.3)', fontFamily:"'Bebas Neue', sans-serif", letterSpacing:1 }}>SEÇİLEN <strong style={{ color:'#fff' }}>{myPicks.length}/18</strong></span>
        </div>
      </div>

      {/* ANA GRID */}
      <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 260px', overflow:'hidden', position:'relative', zIndex:1 }}>

        {/* SOL: Kartlar */}
        <div style={{ display:'flex', flexDirection:'column', overflow:'hidden', borderRight:'1px solid rgba(255,255,255,0.05)', position:'relative' }}>

          {/* Kilid overlay */}
          {!isMyTurn && (
            <div style={{ position:'absolute', inset:0, background:'rgba(8,12,24,0.82)', zIndex:20, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'1rem', backdropFilter:'blur(4px)' }}>
              <div style={{ fontSize:'3.5rem' }}>🔒</div>
              <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:22, letterSpacing:3, color:'rgba(255,255,255,0.4)' }}>RAKİP SEÇİYOR</div>
              <div style={{ fontSize:13, color:'rgba(255,255,255,0.2)', letterSpacing:1 }}>{turnName} kendi oyuncusunu seçiyor</div>
            </div>
          )}

          {/* Kategori tabları */}
          <div style={{ display:'flex', background:'rgba(0,0,0,0.5)', borderBottom:'1px solid rgba(255,255,255,0.05)', flexShrink:0 }}>
            {Object.entries(CATEGORIES).map(([cat]) => {
              const isActive = activeCategory === cat
              return (
                <button key={cat} onClick={() => { setActiveCategory(cat); setSearch('') }}
                  style={{ flex:1, padding:'.65rem .3rem', border:'none', background:'transparent', color: isActive ? '#00c8ff' : 'rgba(255,255,255,0.25)', fontFamily:"'Bebas Neue', sans-serif", fontSize:13, letterSpacing:1.5, cursor:'pointer', borderBottom: isActive ? '2px solid #00c8ff' : '2px solid transparent', transition:'all .15s', position:'relative' }}>
                  {cat.toUpperCase()}
                  {isActive && <div style={{ position:'absolute', bottom:0, left:'20%', right:'20%', height:1, background:'rgba(0,200,255,0.3)', filter:'blur(2px)' }}/>}
                </button>
              )
            })}
          </div>

          {/* Arama */}
          <div style={{ padding:'.5rem .75rem', borderBottom:'1px solid rgba(255,255,255,0.04)', flexShrink:0 }}>
            <input
              style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:6, padding:'.4rem .75rem', color:'rgba(255,255,255,0.8)', fontSize:13, outline:'none', fontFamily:"'Rajdhani', sans-serif", letterSpacing:0.5 }}
              placeholder={`${activeCategory} ara...`}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Kart grid */}
          <div style={{ flex:1, overflowY:'auto', padding:'.75rem' }}>
            {errorMsg && (
              <div style={{ background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,0.4)', borderRadius:6, padding:'.5rem .75rem', marginBottom:'.75rem', color:'#ef4444', fontSize:12, fontFamily:"'Rajdhani', sans-serif" }}>
                {errorMsg}
              </div>
            )}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px, 1fr))', gap:'10px' }}>
              {filteredCards.map(card => (
                <FutCard
                  key={card.id}
                  card={card}
                  onClick={handleCardClick}
                  disabled={!isMyTurn || submitting || myFinished}
                  selected={false}
                />
              ))}
              {filteredCards.length === 0 && (
                <div style={{ gridColumn:'1/-1', textAlign:'center', color:'rgba(255,255,255,0.2)', padding:'3rem', fontFamily:"'Bebas Neue', sans-serif", letterSpacing:2, fontSize:14 }}>
                  BU KATEGORİDE MÜSAİT OYUNCU KALMADI
                </div>
              )}
            </div>
          </div>

          {/* Ticker */}
          <div style={{ height:28, background:'rgba(0,0,0,0.8)', borderTop:'1px solid rgba(255,255,255,0.04)', display:'flex', alignItems:'center', overflow:'hidden', flexShrink:0 }}>
            <div style={{ background:'#ff3030', color:'#fff', fontFamily:"'Bebas Neue', sans-serif", fontSize:10, letterSpacing:2, padding:'.15rem .6rem', whiteSpace:'nowrap', flexShrink:0 }}>SON DAKİKA</div>
            <div style={{ overflow:'hidden', flex:1 }}>
              <div style={{ display:'inline-flex', gap:'5rem', animation:'tickerMove 28s linear infinite', whiteSpace:'nowrap' }}>
                {[...tickerItems, ...tickerItems].map((item, i) => (
                  <span key={i} style={{ color:'rgba(255,255,255,0.35)', fontSize:11, fontFamily:"'Rajdhani', sans-serif", letterSpacing:0.5 }}>
                    <span style={{ color:'#00c8ff', marginRight:'.4rem' }}>◆</span>{item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* SAĞ: Seçilen oyuncular */}
        <div style={{ display:'flex', flexDirection:'column', overflow:'hidden', background:'rgba(0,0,0,0.3)' }}>
          <div style={{ padding:'.75rem 1rem', borderBottom:'1px solid rgba(255,255,255,0.05)', flexShrink:0 }}>
            <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:16, letterSpacing:2, color:'rgba(255,255,255,0.8)' }}>{myTeamName.toUpperCase()}</div>
            <div style={{ color:'rgba(255,255,255,0.25)', fontSize:11, letterSpacing:1, marginTop:2, fontFamily:"'Rajdhani', sans-serif" }}>{myPicks.length}/18 OYUNCU SEÇİLDİ</div>
          </div>

          <div style={{ flex:1, overflowY:'auto', padding:'.5rem .6rem' }}>
            <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:10, letterSpacing:2, color:'rgba(255,255,255,0.2)', padding:'.2rem .3rem', marginBottom:'.35rem' }}>
              SEÇİLEN OYUNCULAR
            </div>
            {myPicks.map((pick, i) => {
              const card = pick.player_cards
              const type = getCardType(card?.overall || 70)
              const s = getCardStyle(type)
              return (
                <div key={pick.id} style={{ display:'flex', alignItems:'center', gap:'.35rem', padding:'.3rem .45rem', borderRadius:6, marginBottom:'.2rem', background:'rgba(255,255,255,0.03)', border:`1px solid rgba(255,255,255,0.06)`, transition:'all .1s' }}>
                  <span style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:11, color:'rgba(255,255,255,0.2)', minWidth:14, textAlign:'center', flexShrink:0 }}>{i+1}</span>
                  <span style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:10, color:s.pos, minWidth:28, textAlign:'center', flexShrink:0, letterSpacing:1 }}>{card?.position || pick.squad_position}</span>
                  <div style={{ flex:1, minWidth:0, fontFamily:"'Rajdhani', sans-serif", fontWeight:600, fontSize:13, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', color:'rgba(255,255,255,0.75)' }}>{card?.name}</div>
                  <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:15, color:s.overall, flexShrink:0 }}>{card?.overall}</div>
                </div>
              )
            })}
            {Array.from({ length: Math.max(0, 18-myPicks.length) }).map((_,i) => (
              <div key={'e'+i} style={{ display:'flex', alignItems:'center', gap:'.35rem', padding:'.3rem .45rem', borderRadius:6, marginBottom:'.2rem', background:'transparent', border:'1px dashed rgba(255,255,255,0.06)', opacity:.4 }}>
                <span style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:11, color:'rgba(255,255,255,0.15)', minWidth:14, textAlign:'center' }}>{myPicks.length+i+1}</span>
                <div style={{ width:26, height:12, background:'rgba(255,255,255,0.06)', borderRadius:3, flexShrink:0 }}/>
                <div style={{ color:'rgba(255,255,255,0.15)', fontSize:11, fontFamily:"'Rajdhani', sans-serif", letterSpacing:1 }}>BOŞ SLOT</div>
              </div>
            ))}
          </div>

          <div style={{ padding:'.65rem', borderTop:'1px solid rgba(255,255,255,0.05)', flexShrink:0 }}>
            <button onClick={handleFinish} disabled={!myFinished || submitting}
              style={{
                width:'100%', padding:'.75rem',
                borderRadius:6, border:'none',
                background: myFinished
                  ? 'linear-gradient(135deg, #00c8ff 0%, #0066ff 50%, #7b2fff 100%)'
                  : 'rgba(255,255,255,0.06)',
                color: myFinished ? '#fff' : 'rgba(255,255,255,0.25)',
                fontFamily:"'Bebas Neue', sans-serif",
                fontSize:14, letterSpacing:2,
                cursor: myFinished && !submitting ? 'pointer' : 'not-allowed',
                position:'relative', overflow:'hidden',
              }}>
              {myFinished ? (submitting ? 'KAYDEDİLİYOR...' : 'KADROYU ONAYLA →') : `${myPicks.length}/18 SEÇİLDİ`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
