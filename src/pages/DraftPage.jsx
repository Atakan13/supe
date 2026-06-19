import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function getUserId() {
  let id = localStorage.getItem('draft_user_id')
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('draft_user_id', id) }
  return id
}

const CATEGORIES = {
  'Kaleci':    { positions: ['GK'], color: '#1e3a5f', textColor: '#60a5fa', badge: 'badge-gk' },
  'Defans':    { positions: ['CB','LB','RB','SW'], color: '#1e4a2a', textColor: '#4ade80', badge: 'badge-def' },
  'Orta Saha': { positions: ['CDM','CM','CAM','LM','RM'], color: '#3a2a1e', textColor: '#fb923c', badge: 'badge-mid' },
  'Hücum':     { positions: ['LW','RW','ST','CF'], color: '#3a1e1e', textColor: '#f87171', badge: 'badge-att' },
}

const ALL_POSITIONS = ['GK','CB','LB','RB','CDM','CM','CAM','LM','RM','LW','RW','ST','CF']

function getPosCategory(pos) {
  for (const [cat, val] of Object.entries(CATEGORIES)) {
    if (val.positions.includes(pos)) return cat
  }
  return 'Orta Saha'
}

function getPosColor(pos) {
  const cat = getPosCategory(pos)
  return CATEGORIES[cat]
}

const TICKER_MESSAGES = [
  'TRANSFER HABERİ', 'SON DAKİKA', 'TRANSFER GELİŞMESİ', 'BOMBA TRANSFER', 'RESMİ AÇIKLAMA'
]

export default function DraftPage() {
  const { code } = useParams()
  const navigate = useNavigate()
  const userId = getUserId()

  const [lobby, setLobby] = useState(null)
  const [lobbyPlayers, setLobbyPlayers] = useState([])
  const [allCards, setAllCards] = useState([])
  const [picks, setPicks] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCard, setSelectedCard] = useState(null)
  const [selectedPos, setSelectedPos] = useState(null)
  const [activeCategory, setActiveCategory] = useState('Kaleci')
  const [search, setSearch] = useState('')
  const [currentTurnUserId, setCurrentTurnUserId] = useState(null)
  const [tickerItems, setTickerItems] = useState([])
  const [showPosModal, setShowPosModal] = useState(false)
  const channelRef = useRef(null)
  const tickerRef = useRef(null)

  const myPicks = picks.filter(p => p.picked_by === userId)
  const opPicks = picks.filter(p => p.picked_by !== userId)
  const isMyTurn = currentTurnUserId === userId
  const totalPicks = picks.length
  const myFinished = myPicks.length >= 18

  useEffect(() => {
    init()
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [code])

  const init = async () => {
    const { data: lb } = await supabase.from('lobbies').select('*').ilike('code', code).single()
    if (!lb) return
    setLobby(lb)

    const { data: pl } = await supabase.from('lobby_players').select('*').eq('lobby_id', lb.id).order('joined_at')
    setLobbyPlayers(pl || [])

    const { data: cr } = await supabase.from('player_cards').select('*').order('overall', { ascending: false })
    setAllCards(cr || [])

    await loadPicks(lb.id, pl || [])
    setLoading(false)

    channelRef.current = supabase.channel('draft-' + lb.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'draft_picks', filter: `lobby_id=eq.${lb.id}` }, () => loadPicks(lb.id, pl || []))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lobbies', filter: `id=eq.${lb.id}` }, async (p) => {
        if (p.new.status === 'playing') {
          const { data } = await supabase.from('matches').select('id').eq('lobby_id', lb.id).single()
          if (data) navigate(`/match/${data.id}`)
        }
      })
      .subscribe()
  }

  const loadPicks = async (lobbyId, players) => {
    const { data } = await supabase.from('draft_picks').select('*, player_cards(*)').eq('lobby_id', lobbyId).order('pick_order')
    if (!data) return
    setPicks(data)
    
    // Sıra hesapla: snake draft (1,2,2,1,1,2,2...)
    const pl = players.length > 0 ? players : lobbyPlayers
    if (pl.length >= 2) {
      const turn = calcTurn(data.length, pl)
      setCurrentTurnUserId(turn)
    }

    // Yeni rakip seçimini ticker'a ekle
    const newOpPick = data.filter(p => p.picked_by !== userId).slice(-1)[0]
    if (newOpPick?.player_cards) {
      addTickerItem(newOpPick.player_cards.name, newOpPick.squad_position, newOpPick.player_cards.overall)
    }
  }

  // Snake draft sırası: 0→p0, 1→p1, 2→p1, 3→p0, 4→p0, 5→p1...
  const calcTurn = (totalPickCount, players) => {
    if (players.length < 2) return players[0]?.user_id
    const idx = totalPickCount % (players.length * 2)
    if (idx < players.length) return players[idx % players.length]?.user_id
    return players[players.length - 1 - (idx - players.length)]?.user_id
  }

  const addTickerItem = (name, pos, overall) => {
    const label = TICKER_MESSAGES[Math.floor(Math.random() * TICKER_MESSAGES.length)]
    const item = `${label}: ${name} (${overall}) ${pos} mevkiine transfer oldu!`
    setTickerItems(prev => [...prev, item])
  }

  const handleCardClick = (card) => {
    if (!isMyTurn || myFinished) return
    const pickedIds = picks.map(p => p.player_card_id)
    if (pickedIds.includes(card.id)) return
    setSelectedCard(card)
    setSelectedPos(null)
    setShowPosModal(true)
  }

  const handleConfirmPick = async () => {
    if (!selectedCard || !selectedPos) return
    await supabase.from('draft_picks').insert({
      lobby_id: lobby.id,
      player_card_id: selectedCard.id,
      picked_by: userId,
      round: Math.floor(myPicks.length / 1) + 1,
      pick_order: picks.length + 1,
      price: selectedCard.market_value,
      squad_position: selectedPos,
    })
    setSelectedCard(null)
    setSelectedPos(null)
    setShowPosModal(false)
  }

  const handleFinish = async () => {
    if (myPicks.length < 18) return
    const lineup = myPicks.slice(0, 11).map(p => ({ ...p.player_cards, squad_pos: p.squad_position, pick_id: p.id }))
    const bench = myPicks.slice(11).map(p => ({ ...p.player_cards, squad_pos: p.squad_position, pick_id: p.id }))
    
    const { data: ex } = await supabase.from('squads').select('id').eq('lobby_id', lobby.id).eq('user_id', userId).single()
    const squadData = { lobby_id: lobby.id, user_id: userId, formation: lobby.formation, lineup, bench }
    if (ex) await supabase.from('squads').update(squadData).eq('id', ex.id)
    else await supabase.from('squads').insert(squadData)

    const { data: allSquads } = await supabase.from('squads').select('*').eq('lobby_id', lobby.id)
    if (allSquads && allSquads.length >= lobbyPlayers.length) {
      const home = lobbyPlayers[0], away = lobbyPlayers[1]
      const { data: match } = await supabase.from('matches').insert({
        lobby_id: lobby.id, home_user_id: home.user_id, away_user_id: away.user_id, status: 'active'
      }).select().single()
      await supabase.from('lobbies').update({ status: 'playing' }).eq('id', lobby.id)
      if (match) navigate(`/match/${match.id}`)
    }
  }

  const pickedIds = picks.map(p => p.player_card_id)
  const catPositions = CATEGORIES[activeCategory]?.positions || []
  const filteredCards = allCards.filter(c => {
    if (pickedIds.includes(c.id)) return false
    if (!catPositions.includes(c.position)) return false
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const myTeamName = lobbyPlayers.find(p => p.user_id === userId)?.team_name || 'Kadrom'
  const turnPlayerName = lobbyPlayers.find(p => p.user_id === currentTurnUserId)?.team_name || '...'
  const budget = lobby ? lobby.budget - myPicks.reduce((s,p) => s + (p.price||0), 0) : 0

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'var(--bg-primary)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ color:'var(--text-secondary)' }}>Yükleniyor...</div>
    </div>
  )

  return (
    <div style={{ height:'100vh', background:'var(--bg-primary)', display:'flex', flexDirection:'column', overflow:'hidden' }}>

      {/* SIRA GÖSTERGESİ */}
      <div style={{ padding:'.6rem 1.5rem', background: isMyTurn ? 'rgba(124,58,237,.2)' : 'rgba(30,30,70,.5)', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', transition:'background .3s' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'1rem' }}>
          <div style={{ width:8, height:8, borderRadius:'50%', background: isMyTurn ? 'var(--green)' : 'var(--yellow)', animation: isMyTurn ? 'pulse 1s infinite' : 'none' }}></div>
          <span style={{ fontWeight:700, fontSize:'.9rem', color: isMyTurn ? 'var(--purple-light)' : 'var(--text-secondary)' }}>
            {isMyTurn ? '⚡ Sıra sende! Oyuncu seç.' : `⏳ ${turnPlayerName} seçiyor...`}
          </span>
        </div>
        <div style={{ display:'flex', gap:'1.5rem', fontSize:'.8rem' }}>
          <span style={{ color:'var(--text-muted)' }}>Pick: <strong style={{ color:'var(--text-primary)' }}>{picks.length + 1}/36</strong></span>
          <span style={{ color:'var(--text-muted)' }}>Bütçe: <strong style={{ color:'var(--green)' }}>€{(budget/1e6).toFixed(0)}M</strong></span>
          <span style={{ color:'var(--text-muted)' }}>Seçilen: <strong style={{ color:'var(--text-primary)' }}>{myPicks.length}/18</strong></span>
        </div>
      </div>

      {/* ANA İÇERİK */}
      <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 300px', overflow:'hidden' }}>

        {/* SOL: Oyuncu Havuzu */}
        <div style={{ display:'flex', flexDirection:'column', overflow:'hidden', borderRight:'1px solid var(--border)', position:'relative' }}>

          {/* Kilit overlay */}
          {!isMyTurn && (
            <div style={{ position:'absolute', inset:0, background:'rgba(10,10,26,.7)', zIndex:10, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:'1rem', backdropFilter:'blur(2px)' }}>
              <div style={{ fontSize:'3rem' }}>🔒</div>
              <div style={{ fontWeight:800, fontSize:'1.1rem', color:'var(--text-secondary)' }}>Rakip seçiyor...</div>
              <div style={{ color:'var(--text-muted)', fontSize:'.85rem' }}>{turnPlayerName} kendi oyuncusunu seçiyor</div>
            </div>
          )}

          {/* Kategori Sekmeleri */}
          <div style={{ display:'flex', borderBottom:'1px solid var(--border)', background:'var(--bg-secondary)' }}>
            {Object.entries(CATEGORIES).map(([cat, val]) => (
              <button key={cat} onClick={() => setActiveCategory(cat)} style={{ flex:1, padding:'.75rem .5rem', border:'none', background:'transparent', color: activeCategory===cat ? val.textColor : 'var(--text-muted)', fontWeight:700, fontSize:'.78rem', cursor:'pointer', borderBottom: activeCategory===cat ? `2px solid ${val.textColor}` : '2px solid transparent', transition:'all .15s' }}>
                {cat}
              </button>
            ))}
          </div>

          {/* Arama */}
          <div style={{ padding:'.75rem 1rem', borderBottom:'1px solid var(--border)' }}>
            <input className="input" placeholder={`${activeCategory} ara...`} value={search} onChange={e => setSearch(e.target.value)} style={{ padding:'.5rem .75rem', fontSize:'.85rem' }} />
          </div>

          {/* Kartlar */}
          <div style={{ flex:1, overflowY:'auto', padding:'1rem' }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:'.6rem' }}>
              {filteredCards.map(card => {
                const catInfo = getPosColor(card.position)
                return (
                  <div key={card.id} onClick={() => handleCardClick(card)} style={{ background:'var(--bg-card)', border:`1px solid ${selectedCard?.id===card.id?'var(--purple)':'var(--border)'}`, borderRadius:12, padding:'.75rem', cursor: isMyTurn ? 'pointer' : 'default', transition:'all .15s', opacity: isMyTurn ? 1 : .7 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'.4rem' }}>
                      <div style={{ fontSize:'1.7rem', fontWeight:900, color: card.overall>=85?'var(--gold)':card.overall>=75?'var(--text-primary)':'var(--text-secondary)' }}>{card.overall}</div>
                      <span style={{ background:catInfo.color, color:catInfo.textColor, fontSize:'.65rem', fontWeight:700, padding:'.2rem .4rem', borderRadius:5, letterSpacing:'.04em' }}>{card.position}</span>
                    </div>
                    <div style={{ fontWeight:700, fontSize:'.85rem', marginBottom:'.15rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{card.name}</div>
                    <div style={{ color:'var(--text-muted)', fontSize:'.7rem', marginBottom:'.4rem' }}>{card.club} · {card.nation}</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'.15rem', fontSize:'.68rem', marginBottom:'.4rem' }}>
                      {[['HZ',card.pace],['ŞUT',card.shooting],['PAS',card.passing],['ÇAL',card.dribbling],['DEF',card.defending],['FİZ',card.physical]].map(([l,v])=>(
                        <div key={l} style={{ display:'flex', justifyContent:'space-between', color:'var(--text-muted)' }}>
                          <span>{l}</span><span style={{ color:'var(--text-primary)', fontWeight:600 }}>{v}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ color:'var(--green)', fontSize:'.72rem', fontWeight:700 }}>€{(card.market_value/1e6).toFixed(1)}M</div>
                  </div>
                )
              })}
              {filteredCards.length === 0 && (
                <div style={{ gridColumn:'1/-1', textAlign:'center', color:'var(--text-muted)', padding:'3rem 1rem', fontSize:'.9rem' }}>
                  Bu kategoride müsait oyuncu yok
                </div>
              )}
            </div>
          </div>

          {/* Alt Ticker */}
          <div style={{ background:'#0a0a1a', borderTop:'1px solid var(--border)', padding:'.4rem 0', overflow:'hidden', position:'relative', height:32 }}>
            <div style={{ display:'flex', alignItems:'center', height:'100%' }}>
              <div style={{ background:'var(--red)', color:'white', fontWeight:800, fontSize:'.65rem', padding:'.2rem .5rem', whiteSpace:'nowrap', marginRight:'1rem', letterSpacing:'.05em', flexShrink:0 }}>SON DAKİKA</div>
              <div style={{ overflow:'hidden', flex:1 }}>
                <div ref={tickerRef} style={{ display:'flex', gap:'3rem', animation:'ticker 20s linear infinite', whiteSpace:'nowrap' }}>
                  {tickerItems.length === 0 ? (
                    <span style={{ color:'var(--text-muted)', fontSize:'.72rem' }}>Draft başladı! Oyuncular seçiliyor...</span>
                  ) : (
                    [...tickerItems, ...tickerItems].map((item, i) => (
                      <span key={i} style={{ color:'var(--text-secondary)', fontSize:'.72rem', flexShrink:0 }}>
                        <span style={{ color:'var(--gold)', fontWeight:700 }}>●</span> {item}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SAĞ: Kadro */}
        <div style={{ display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ padding:'1rem', borderBottom:'1px solid var(--border)' }}>
            <div style={{ fontWeight:800, fontSize:'.95rem', marginBottom:'.2rem' }}>{myTeamName}</div>
            <div style={{ color:'var(--text-muted)', fontSize:'.75rem' }}>{myPicks.length}/18 oyuncu seçildi</div>
          </div>

          <div style={{ flex:1, overflowY:'auto', padding:'.5rem' }}>
            {/* İlk 11 */}
            <div style={{ fontSize:'.65rem', color:'var(--text-muted)', fontWeight:700, letterSpacing:'.08em', padding:'.3rem .5rem', marginBottom:'.25rem' }}>İLK 11</div>
            {myPicks.slice(0,11).map((pick, i) => (
              <div key={pick.id} style={{ display:'flex', alignItems:'center', gap:'.4rem', padding:'.4rem .6rem', borderRadius:8, marginBottom:'.25rem', background:'var(--bg-card)', border:'1px solid var(--border)' }}>
                <span style={{ background:getPosColor(pick.squad_position||pick.player_cards?.position).color, color:getPosColor(pick.squad_position||pick.player_cards?.position).textColor, fontSize:'.6rem', fontWeight:700, padding:'.15rem .35rem', borderRadius:4, minWidth:32, textAlign:'center', flexShrink:0 }}>{pick.squad_position||pick.player_cards?.position}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:'.78rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{pick.player_cards?.name}</div>
                </div>
                <div style={{ fontWeight:800, color:'var(--gold)', fontSize:'.85rem', flexShrink:0 }}>{pick.player_cards?.overall}</div>
              </div>
            ))}

            {/* Yedekler */}
            {myPicks.length > 11 && (
              <>
                <div style={{ fontSize:'.65rem', color:'var(--text-muted)', fontWeight:700, letterSpacing:'.08em', padding:'.3rem .5rem', margin:'.5rem 0 .25rem' }}>YEDEKLER</div>
                {myPicks.slice(11).map((pick, i) => (
                  <div key={pick.id} style={{ display:'flex', alignItems:'center', gap:'.4rem', padding:'.4rem .6rem', borderRadius:8, marginBottom:'.25rem', background:'rgba(30,30,60,.5)', border:'1px solid var(--border)' }}>
                    <span style={{ background:getPosColor(pick.squad_position||pick.player_cards?.position).color, color:getPosColor(pick.squad_position||pick.player_cards?.position).textColor, fontSize:'.6rem', fontWeight:700, padding:'.15rem .35rem', borderRadius:4, minWidth:32, textAlign:'center', flexShrink:0 }}>{pick.squad_position||pick.player_cards?.position}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:600, fontSize:'.78rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', color:'var(--text-secondary)' }}>{pick.player_cards?.name}</div>
                    </div>
                    <div style={{ fontWeight:700, color:'var(--text-secondary)', fontSize:'.82rem', flexShrink:0 }}>{pick.player_cards?.overall}</div>
                  </div>
                ))}
              </>
            )}

            {/* Boş slotlar */}
            {Array.from({ length: Math.max(0, 18 - myPicks.length) }).map((_, i) => (
              <div key={'empty-'+i} style={{ display:'flex', alignItems:'center', gap:'.4rem', padding:'.4rem .6rem', borderRadius:8, marginBottom:'.25rem', background:'var(--bg-secondary)', border:'1px dashed var(--border)', opacity:.5 }}>
                <div style={{ width:32, height:18, background:'var(--border)', borderRadius:4 }}></div>
                <div style={{ color:'var(--text-muted)', fontSize:'.75rem' }}>{i + myPicks.length < 11 ? 'İlk 11 slotu' : 'Yedek slotu'}</div>
              </div>
            ))}
          </div>

          {/* Bitir */}
          <div style={{ padding:'1rem', borderTop:'1px solid var(--border)' }}>
            {myFinished ? (
              <button className="btn btn-success" style={{ width:'100%' }} onClick={handleFinish}>MAÇA BAŞLA →</button>
            ) : (
              <button className="btn btn-primary" style={{ width:'100%', opacity:.4 }} disabled>
                {myPicks.length}/18 Seçildi
              </button>
            )}
          </div>
        </div>
      </div>

      {/* MEVKİ SEÇİM MODALI */}
      {showPosModal && selectedCard && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
          <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:16, padding:'1.5rem', width:'100%', maxWidth:420 }}>
            <div style={{ fontWeight:800, fontSize:'1.1rem', marginBottom:'.25rem' }}>{selectedCard.name}</div>
            <div style={{ color:'var(--text-muted)', fontSize:'.8rem', marginBottom:'1.25rem' }}>Hangi mevkiye oynayacak?</div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'.75rem', marginBottom:'1.25rem' }}>
              {Object.entries(CATEGORIES).map(([cat, val]) => (
                <div key={cat}>
                  <div style={{ fontSize:'.65rem', fontWeight:700, color:val.textColor, letterSpacing:'.06em', marginBottom:'.35rem', textTransform:'uppercase' }}>{cat}</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:'.3rem' }}>
                    {val.positions.map(pos => (
                      <button key={pos} onClick={() => setSelectedPos(pos)} style={{ background: selectedPos===pos ? val.color : 'var(--bg-secondary)', border:`1px solid ${selectedPos===pos ? val.textColor : 'var(--border)'}`, color: selectedPos===pos ? val.textColor : 'var(--text-secondary)', padding:'.3rem .6rem', borderRadius:6, fontSize:'.75rem', fontWeight:700, cursor:'pointer', transition:'all .15s' }}>
                        {pos}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display:'flex', gap:'.75rem' }}>
              <button className="btn btn-secondary" style={{ flex:1 }} onClick={() => { setShowPosModal(false); setSelectedCard(null); setSelectedPos(null) }}>İptal</button>
              <button className="btn btn-primary" style={{ flex:2, opacity: selectedPos ? 1 : .4 }} disabled={!selectedPos} onClick={handleConfirmPick}>
                {selectedPos ? `${selectedCard.name} → ${selectedPos} ✓` : 'Mevki Seç'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes pulse {
          0%,100% { opacity:1; transform:scale(1); }
          50% { opacity:.6; transform:scale(1.3); }
        }
      `}</style>
    </div>
  )
}