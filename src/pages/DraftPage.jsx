import { useState, useEffect, useRef, useCallback } from 'react'
import { PLAYER_CARDS } from '../lib/playerCards'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function getUserId() {
  let id = localStorage.getItem('draft_user_id')
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('draft_user_id', id) }
  return id
}

const CATEGORIES = {
  'Kaleci':    { positions: ['GK'],                              color: '#1e3a5f', textColor: '#60a5fa' },
  'Defans':    { positions: ['CB','LB','RB'],                    color: '#1e4a2a', textColor: '#4ade80' },
  'Orta Saha': { positions: ['CDM','CM','CAM','LM','RM'],        color: '#3a2a1e', textColor: '#fb923c' },
  'Hücum':     { positions: ['LW','RW','ST','CF','LM','RM'],     color: '#3a1e1e', textColor: '#f87171' },
}

function getPosStyle(pos) {
  for (const val of Object.values(CATEGORIES)) {
    if (val.positions.includes(pos)) return val
  }
  return { color: '#2a2a5a', textColor: '#a0a0c0' }
}

const TICKER_MSGS = ['TRANSFER HABERİ','SON DAKİKA','BOMBA TRANSFER','RESMİ AÇIKLAMA','TRANSFER GELİŞMESİ']

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
  const [modalCard, setModalCard] = useState(null)
  const [modalPos, setModalPos] = useState(null)
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
    const { data, error } = await supabase
      .from('draft_picks')
      .select('*')
      .eq('lobby_id', lobbyId)
      .order('pick_order')
    if (error || !data) return

    // Lokal player_cards verisiyle zenginleştir
    const enriched = data.map(pick => ({
      ...pick,
      player_cards: PLAYER_CARDS.find(c => c.id === pick.player_card_id)
    }))
    setPicks(enriched)
    setCurrentTurnUserId(calcTurn(data.length, lobbyPlayersRef.current))

    const newOpPicks = data.filter(p => p.picked_by !== userId)
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
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [code])

  // 2 saniyede bir polling
  useEffect(() => {
    const interval = setInterval(() => {
      loadPicks()
    }, 2000)
    return () => clearInterval(interval)
  }, [loadPicks])

  const init = async () => {
    const { data: lb } = await supabase.from('lobbies').select('*').ilike('code', code).single()
    if (!lb) return
    setLobby(lb)
    lobbyRef.current = lb
    lobbyIdRef.current = lb.id

    const { data: pl } = await supabase.from('lobby_players').select('*').eq('lobby_id', lb.id).order('joined_at')
    setLobbyPlayers(pl || [])
    lobbyPlayersRef.current = pl || []



    await loadPicks()
    setLoading(false)

    channelRef.current = supabase
      .channel('draft-' + lb.id)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'draft_picks',
        filter: `lobby_id=eq.${lb.id}`
      }, () => loadPicks())
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'lobbies',
        filter: `id=eq.${lb.id}`
      }, async (p) => {
        if (p.new.status === 'playing') {
          const { data } = await supabase.from('matches').select('id').eq('lobby_id', lb.id).single()
          if (data) navigate(`/match/${data.id}`)
        }
      })
      .subscribe()
  }

  const myPicks = picks.filter(p => p.picked_by === userId)
  const isMyTurn = currentTurnUserId === userId
  const myFinished = myPicks.length >= 18
  const budget = lobbyRef.current
    ? lobbyRef.current.budget - myPicks.reduce((s, p) => s + (p.price || 0), 0)
    : 0

  const openModal = (card) => {
    if (!isMyTurn || myFinished || submitting) return
    setErrorMsg('')
    setModalCard(card)
    setModalPos(null)
  }

  const closeModal = () => {
    if (submitting) return
    setModalCard(null)
    setModalPos(null)
    setErrorMsg('')
  }

  const confirmPick = async () => {
    if (!modalCard || !modalPos || submitting) return
    setSubmitting(true)
    setErrorMsg('')
    try {
      const lb = lobbyRef.current
      const { data: freshPicks } = await supabase
        .from('draft_picks')
        .select('player_card_id, picked_by')
        .eq('lobby_id', lb.id)

      const alreadyPicked = freshPicks?.find(p => p.player_card_id === modalCard.id)
      if (alreadyPicked) {
        setErrorMsg('Bu oyuncu zaten seçildi!')
        await loadPicks()
        setSubmitting(false)
        return
      }

      const myFreshPicks = freshPicks?.filter(p => p.picked_by === userId) || []

      const { error } = await supabase
        .from('draft_picks')
        .insert({
          lobby_id: lb.id,
          player_card_id: modalCard.id,
          picked_by: userId,
          round: myFreshPicks.length + 1,
          pick_order: (freshPicks?.length || 0) + 1,
          price: modalCard.market_value,
          squad_position: modalPos,
        })

      if (error) {
        if (error.code === '23505') {
          setErrorMsg('Bu oyuncu az önce seçildi!')
          await loadPicks()
        } else {
          setErrorMsg('Hata: ' + error.message)
        }
      } else {
        setModalCard(null)
        setModalPos(null)
        await loadPicks()
      }
    } catch (e) {
      setErrorMsg('Hata: ' + e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleFinish = async () => {
    if (myPicks.length < 18 || submitting) return
    setSubmitting(true)
    try {
      const lb = lobbyRef.current
      const lineup = myPicks.slice(0, 11).map(p => ({ ...p.player_cards, squad_pos: p.squad_position, pick_id: p.id }))
      const bench  = myPicks.slice(11).map(p => ({ ...p.player_cards, squad_pos: p.squad_position, pick_id: p.id }))

      const { data: ex } = await supabase.from('squads').select('id').eq('lobby_id', lb.id).eq('user_id', userId).single()
      const squadData = { lobby_id: lb.id, user_id: userId, formation: lb.formation, lineup, bench }
      if (ex) await supabase.from('squads').update(squadData).eq('id', ex.id)
      else await supabase.from('squads').insert(squadData)

      const { data: allSquads } = await supabase.from('squads').select('*').eq('lobby_id', lb.id)
      if (allSquads && allSquads.length >= lobbyPlayersRef.current.length) {
        const home = lobbyPlayersRef.current[0]
        const away = lobbyPlayersRef.current[1]
        const { data: match } = await supabase.from('matches').insert({
          lobby_id: lb.id,
          home_user_id: home.user_id,
          away_user_id: away.user_id,
          status: 'active'
        }).select().single()
        await supabase.from('lobbies').update({ status: 'playing' }).eq('id', lb.id)
        if (match) navigate(`/match/${match.id}`)
      }
    } finally {
      setSubmitting(false)
    }
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
  const turnName   = lobbyPlayers.find(p => p.user_id === currentTurnUserId)?.team_name || '...'

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#0a0a1a', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ color:'#a0a0c0' }}>Yükleniyor...</div>
    </div>
  )

  return (
    <div style={{ height:'100vh', background:'#0a0a1a', display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <style>{`
        @keyframes tickerMove{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.4}}
      `}</style>

      {/* SIRA BAR */}
      <div style={{ padding:'.6rem 1.5rem', background:isMyTurn?'rgba(124,58,237,.25)':'rgba(20,20,50,.8)', borderBottom:'1px solid #1e1e4a', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'.75rem' }}>
          <div style={{ width:10, height:10, borderRadius:'50%', background:isMyTurn?'#10b981':'#f59e0b', animation:isMyTurn?'blink 1s infinite':'none' }}/>
          <span style={{ fontWeight:700, fontSize:'.9rem', color:isMyTurn?'#a78bfa':'#a0a0c0' }}>
            {isMyTurn ? '⚡ Sıra sende!' : `⏳ ${turnName} seçiyor...`}
          </span>
        </div>
        <div style={{ display:'flex', gap:'1.5rem', fontSize:'.8rem', color:'#606080' }}>
          <span>Pick <strong style={{ color:'#fff' }}>{picks.length+1}/36</strong></span>
          <span>Bütçe <strong style={{ color:'#10b981' }}>€{(budget/1e6).toFixed(0)}M</strong></span>
          <span>Seçilen <strong style={{ color:'#fff' }}>{myPicks.length}/18</strong></span>
        </div>
      </div>

      {/* GRID */}
      <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 290px', overflow:'hidden' }}>

        {/* SOL */}
        <div style={{ display:'flex', flexDirection:'column', overflow:'hidden', borderRight:'1px solid #1e1e4a', position:'relative' }}>
          {!isMyTurn && (
            <div style={{ position:'absolute', inset:0, background:'rgba(10,10,26,.78)', zIndex:20, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'1rem', backdropFilter:'blur(3px)' }}>
              <div style={{ fontSize:'4rem' }}>🔒</div>
              <div style={{ fontWeight:800, fontSize:'1.2rem', color:'#a0a0c0' }}>Rakip seçiyor...</div>
              <div style={{ color:'#606080' }}>{turnName} kendi oyuncusunu seçiyor</div>
            </div>
          )}

          <div style={{ display:'flex', background:'#0f0f2a', borderBottom:'1px solid #1e1e4a', flexShrink:0 }}>
            {Object.entries(CATEGORIES).map(([cat, val]) => (
              <button key={cat} onClick={() => { setActiveCategory(cat); setSearch('') }}
                style={{ flex:1, padding:'.7rem .4rem', border:'none', background:'transparent', color:activeCategory===cat?val.textColor:'#606080', fontWeight:700, fontSize:'.76rem', cursor:'pointer', borderBottom:activeCategory===cat?`2px solid ${val.textColor}`:'2px solid transparent', transition:'all .15s' }}>
                {cat}
              </button>
            ))}
          </div>

          <div style={{ padding:'.6rem 1rem', borderBottom:'1px solid #1e1e4a', flexShrink:0 }}>
            <input style={{ width:'100%', background:'#0f0f2a', border:'1px solid #2a2a5a', borderRadius:8, padding:'.45rem .75rem', color:'#fff', fontSize:'.82rem', outline:'none' }}
              placeholder={`${activeCategory} ara...`} value={search} onChange={e => setSearch(e.target.value)}/>
          </div>

          <div style={{ flex:1, overflowY:'auto', padding:'.75rem' }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(170px,1fr))', gap:'.5rem' }}>
              {filteredCards.map(card => {
                const ps = getPosStyle(card.position)
                return (
                  <div key={card.id}
                    onClick={() => openModal(card)}
                    style={{ background:'#12122a', border:'1px solid #1e1e4a', borderRadius:10, padding:'.65rem', cursor:isMyTurn?'pointer':'not-allowed', userSelect:'none', transition:'border-color .15s' }}
                    onMouseEnter={e => { if(isMyTurn) e.currentTarget.style.borderColor='#7c3aed' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor='#1e1e4a' }}
                  >
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'.35rem' }}>
                      <span style={{ fontSize:'1.6rem', fontWeight:900, color:card.overall>=85?'#fbbf24':card.overall>=75?'#fff':'#a0a0c0' }}>{card.overall}</span>
                      <span style={{ background:ps.color, color:ps.textColor, fontSize:'.6rem', fontWeight:700, padding:'.15rem .35rem', borderRadius:4 }}>{card.position}</span>
                    </div>
                    <div style={{ fontWeight:700, fontSize:'.82rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', marginBottom:'.1rem' }}>{card.name}</div>
                    <div style={{ color:'#606080', fontSize:'.68rem', marginBottom:'.35rem' }}>{card.club}</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'.1rem', fontSize:'.65rem' }}>
                      {[['HZ',card.pace],['ŞUT',card.shooting],['PAS',card.passing],['ÇAL',card.dribbling],['DEF',card.defending],['FİZ',card.physical]].map(([l,v])=>(
                        <div key={l} style={{ display:'flex', justifyContent:'space-between', color:'#606080' }}>
                          <span>{l}</span><span style={{ color:'#fff', fontWeight:600 }}>{v}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ color:'#10b981', fontSize:'.68rem', fontWeight:700, marginTop:'.35rem' }}>€{(card.market_value/1e6).toFixed(1)}M</div>
                  </div>
                )
              })}
              {filteredCards.length === 0 && (
                <div style={{ gridColumn:'1/-1', textAlign:'center', color:'#606080', padding:'3rem' }}>Bu kategoride müsait oyuncu kalmadı</div>
              )}
            </div>
          </div>

          <div style={{ height:30, background:'#050510', borderTop:'1px solid #1e1e4a', display:'flex', alignItems:'center', overflow:'hidden', flexShrink:0 }}>
            <div style={{ background:'#ef4444', color:'#fff', fontSize:'.6rem', fontWeight:800, padding:'.2rem .5rem', whiteSpace:'nowrap', flexShrink:0 }}>SON DAKİKA</div>
            <div style={{ overflow:'hidden', flex:1 }}>
              <div style={{ display:'inline-flex', gap:'4rem', animation:'tickerMove 25s linear infinite', whiteSpace:'nowrap' }}>
                {[...tickerItems, ...tickerItems].map((item, i) => (
                  <span key={i} style={{ color:'#a0a0c0', fontSize:'.68rem' }}>
                    <span style={{ color:'#fbbf24', marginRight:'.3rem' }}>●</span>{item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* SAĞ: KADRO */}
        <div style={{ display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ padding:'.75rem 1rem', borderBottom:'1px solid #1e1e4a', flexShrink:0 }}>
            <div style={{ fontWeight:800, fontSize:'.9rem' }}>{myTeamName}</div>
            <div style={{ color:'#606080', fontSize:'.72rem' }}>{myPicks.length}/18 seçildi</div>
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:'.5rem' }}>
            <div style={{ fontSize:'.6rem', color:'#606080', fontWeight:700, letterSpacing:'.08em', padding:'.25rem .4rem', marginBottom:'.2rem' }}>İLK 11</div>
            {myPicks.slice(0,11).map(pick => {
              const ps = getPosStyle(pick.squad_position || pick.player_cards?.position)
              return (
                <div key={pick.id} style={{ display:'flex', alignItems:'center', gap:'.35rem', padding:'.35rem .5rem', borderRadius:7, marginBottom:'.2rem', background:'#12122a', border:'1px solid #1e1e4a' }}>
                  <span style={{ background:ps.color, color:ps.textColor, fontSize:'.58rem', fontWeight:700, padding:'.1rem .3rem', borderRadius:4, minWidth:30, textAlign:'center', flexShrink:0 }}>{pick.squad_position}</span>
                  <div style={{ flex:1, minWidth:0, fontWeight:700, fontSize:'.75rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{pick.player_cards?.name}</div>
                  <div style={{ fontWeight:800, color:'#fbbf24', fontSize:'.8rem', flexShrink:0 }}>{pick.player_cards?.overall}</div>
                </div>
              )
            })}
            {myPicks.length > 11 && <>
              <div style={{ fontSize:'.6rem', color:'#606080', fontWeight:700, letterSpacing:'.08em', padding:'.25rem .4rem', margin:'.4rem 0 .2rem' }}>YEDEKLER</div>
              {myPicks.slice(11).map(pick => {
                const ps = getPosStyle(pick.squad_position || pick.player_cards?.position)
                return (
                  <div key={pick.id} style={{ display:'flex', alignItems:'center', gap:'.35rem', padding:'.35rem .5rem', borderRadius:7, marginBottom:'.2rem', background:'rgba(18,18,42,.5)', border:'1px solid #1e1e4a' }}>
                    <span style={{ background:ps.color, color:ps.textColor, fontSize:'.58rem', fontWeight:700, padding:'.1rem .3rem', borderRadius:4, minWidth:30, textAlign:'center', flexShrink:0 }}>{pick.squad_position}</span>
                    <div style={{ flex:1, minWidth:0, fontWeight:600, fontSize:'.75rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', color:'#a0a0c0' }}>{pick.player_cards?.name}</div>
                    <div style={{ fontWeight:700, color:'#a0a0c0', fontSize:'.78rem', flexShrink:0 }}>{pick.player_cards?.overall}</div>
                  </div>
                )
              })}
            </>}
            {Array.from({ length: Math.max(0, 18-myPicks.length) }).map((_,i) => (
              <div key={'e'+i} style={{ display:'flex', alignItems:'center', gap:'.35rem', padding:'.35rem .5rem', borderRadius:7, marginBottom:'.2rem', background:'#0f0f2a', border:'1px dashed #1e1e4a', opacity:.4 }}>
                <div style={{ width:30, height:16, background:'#1e1e4a', borderRadius:3, flexShrink:0 }}/>
                <div style={{ color:'#606080', fontSize:'.72rem' }}>{i+myPicks.length < 11 ? 'İlk 11 slotu' : 'Yedek slotu'}</div>
              </div>
            ))}
          </div>
          <div style={{ padding:'.75rem', borderTop:'1px solid #1e1e4a', flexShrink:0 }}>
            <button onClick={handleFinish} disabled={!myFinished || submitting}
              style={{ width:'100%', padding:'.75rem', borderRadius:10, border:'none', background:myFinished?'#10b981':'#1e1e4a', color:myFinished?'#fff':'#606080', fontWeight:700, fontSize:'.9rem', cursor:myFinished&&!submitting?'pointer':'not-allowed' }}>
              {myFinished ? (submitting?'Kaydediliyor...':'MAÇA BAŞLA →') : `${myPicks.length}/18 seçildi`}
            </button>
          </div>
        </div>
      </div>

      {/* MEVKİ MODAL */}
      {modalCard && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}
          onClick={e => { if(e.target===e.currentTarget && !submitting) closeModal() }}>
          <div style={{ background:'#12122a', border:'1px solid #2a2a5a', borderRadius:16, padding:'1.5rem', width:'100%', maxWidth:420 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', gap:'1rem', marginBottom:'1rem', paddingBottom:'1rem', borderBottom:'1px solid #1e1e4a' }}>
              <div style={{ width:48, height:48, borderRadius:10, background:'#1e1e4a', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.4rem', fontWeight:900, color:'#fbbf24' }}>{modalCard.overall}</div>
              <div>
                <div style={{ fontWeight:800, fontSize:'1rem' }}>{modalCard.name}</div>
                <div style={{ color:'#606080', fontSize:'.8rem' }}>{modalCard.club} · {modalCard.nation}</div>
                <div style={{ color:'#10b981', fontSize:'.75rem', fontWeight:700 }}>€{(modalCard.market_value/1e6).toFixed(1)}M</div>
              </div>
            </div>
            <div style={{ fontWeight:700, fontSize:'.85rem', color:'#a0a0c0', marginBottom:'.75rem' }}>Hangi mevkide oynayacak?</div>
            {Object.entries(CATEGORIES).map(([cat, val]) => (
              <div key={cat} style={{ marginBottom:'.75rem' }}>
                <div style={{ fontSize:'.62rem', color:val.textColor, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase', marginBottom:'.3rem' }}>{cat}</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'.3rem' }}>
                  {val.positions.map(pos => (
                    <button key={pos} onClick={() => setModalPos(pos)}
                      style={{ background:modalPos===pos?val.color:'#0f0f2a', border:`1.5px solid ${modalPos===pos?val.textColor:'#2a2a5a'}`, color:modalPos===pos?val.textColor:'#606080', padding:'.3rem .65rem', borderRadius:7, fontSize:'.78rem', fontWeight:700, cursor:'pointer', transition:'all .1s' }}>
                      {pos}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {errorMsg && (
              <div style={{ color:'#ef4444', fontSize:'.8rem', marginBottom:'.75rem', padding:'.5rem', background:'rgba(239,68,68,.1)', borderRadius:6 }}>
                {errorMsg}
              </div>
            )}
            <div style={{ display:'flex', gap:'.75rem', marginTop:'1rem' }}>
              <button onClick={closeModal} disabled={submitting}
                style={{ flex:1, padding:'.7rem', borderRadius:10, border:'1px solid #2a2a5a', background:'transparent', color:'#a0a0c0', fontWeight:600, cursor:'pointer' }}>
                İptal
              </button>
              <button onClick={confirmPick} disabled={!modalPos || submitting}
                style={{ flex:2, padding:'.7rem', borderRadius:10, border:'none', background:modalPos&&!submitting?'#7c3aed':'#1e1e4a', color:modalPos&&!submitting?'#fff':'#606080', fontWeight:700, cursor:modalPos&&!submitting?'pointer':'not-allowed', fontSize:'.88rem' }}>
                {submitting ? 'Ekleniyor...' : modalPos ? `✓ ${modalPos} olarak ekle` : 'Mevki seç'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
