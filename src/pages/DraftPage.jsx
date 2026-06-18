import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const POSITION_BADGE = {
  GK: 'badge-gk', CB: 'badge-def', LB: 'badge-def', RB: 'badge-def',
  CDM: 'badge-mid', CM: 'badge-mid', CAM: 'badge-mid', LM: 'badge-mid', RM: 'badge-mid',
  LW: 'badge-att', RW: 'badge-att', ST: 'badge-att', CF: 'badge-att',
}

const FORMATION_SLOTS = {
  '4-4-2':   ['GK','LB','CB','CB','RB','LM','CM','CM','RM','ST','ST'],
  '4-3-3':   ['GK','LB','CB','CB','RB','CM','CM','CM','LW','ST','RW'],
  '4-2-3-1': ['GK','LB','CB','CB','RB','CDM','CDM','CAM','LW','RW','ST'],
  '3-5-2':   ['GK','CB','CB','CB','LM','CM','CDM','CM','RM','ST','ST'],
  '5-3-2':   ['GK','LB','CB','CB','CB','RB','CM','CM','CM','ST','ST'],
  '3-4-3':   ['GK','CB','CB','CB','LM','CM','CM','RM','LW','ST','RW'],
}

export default function DraftPage() {
  const { code } = useParams()
  const navigate = useNavigate()

  const [lobby, setLobby] = useState(null)
  const [players, setPlayers] = useState([])
  const [cards, setCards] = useState([])
  const [picks, setPicks] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCard, setSelectedCard] = useState(null)
  const [budget, setBudget] = useState(500000000)
  const [filterPos, setFilterPos] = useState('ALL')
  const [search, setSearch] = useState('')

  const userId = localStorage.getItem('draft_user_id')

  useEffect(() => {
    init()
    const channel = supabase
      .channel(`draft-${code}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'draft_picks' }, () => fetchPicks())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lobbies' }, (payload) => {
        setLobby(payload.new)
        if (payload.new.status === 'playing') {
          fetchAndNavigateMatch(payload.new.id)
        }
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [code])

  const init = async () => {
    const { data: lb } = await supabase.from('lobbies').select('*').ilike('code', code).single()
    if (!lb) return
    setLobby(lb)
    setBudget(lb.budget)

    const { data: pl } = await supabase.from('lobby_players').select('*').eq('lobby_id', lb.id).order('joined_at')
    setPlayers(pl || [])

    const { data: cr } = await supabase.from('player_cards').select('*').order('overall', { ascending: false })
    setCards(cr || [])

    await fetchPicks(lb.id)
    setLoading(false)
  }

  const fetchPicks = async (lobbyId) => {
    const id = lobbyId || lobby?.id
    if (!id) return
    const { data } = await supabase.from('draft_picks').select('*, player_cards(*)').eq('lobby_id', id)
    if (data) setPicks(data)
  }

  const fetchAndNavigateMatch = async (lobbyId) => {
    const { data } = await supabase.from('matches').select('id').eq('lobby_id', lobbyId).single()
    if (data) navigate(`/match/${data.id}`)
  }

  const myPicks = picks.filter(p => p.picked_by === userId)
  const remainingBudget = budget - myPicks.reduce((s, p) => s + p.price, 0)
  const pickedCardIds = picks.map(p => p.player_card_id)
  const mySquad = FORMATION_SLOTS[lobby?.formation || '4-4-2']

  const handlePick = async () => {
    if (!selectedCard) return
    if (myPicks.length >= 11) return
    if (selectedCard.market_value > remainingBudget) return

    const round = Math.floor(myPicks.length / 1) + 1
    const { error } = await supabase.from('draft_picks').insert({
      lobby_id: lobby.id,
      player_card_id: selectedCard.id,
      picked_by: userId,
      round,
      pick_order: picks.length + 1,
      price: selectedCard.market_value,
      squad_position: mySquad[myPicks.length] || 'SUB',
    })

    if (!error) {
      setSelectedCard(null)
      fetchPicks()
    }
  }

  const handleFinish = async () => {
    if (myPicks.length < 11) return

    // Kadroyu kaydet
    const { data: existing } = await supabase.from('squads').select('id').eq('lobby_id', lobby.id).eq('user_id', userId).single()
    const squadData = {
      lobby_id: lobby.id,
      user_id: userId,
      formation: lobby.formation,
      lineup: myPicks.map((p, i) => ({ ...p.player_cards, squad_pos: mySquad[i] || 'SUB', pick_id: p.id })),
      bench: [],
    }
    if (existing) {
      await supabase.from('squads').update(squadData).eq('id', existing.id)
    } else {
      await supabase.from('squads').insert(squadData)
    }

    // Tüm oyuncular bitirdiyse maç oluştur
    const { data: allSquads } = await supabase.from('squads').select('*').eq('lobby_id', lobby.id)
    if (allSquads && allSquads.length >= players.length) {
      const home = players[0]
      const away = players[1]
      const { data: match } = await supabase.from('matches').insert({
        lobby_id: lobby.id,
        home_user_id: home.user_id,
        away_user_id: away.user_id,
        status: 'active',
      }).select().single()

      await supabase.from('lobbies').update({ status: 'playing' }).eq('id', lobby.id)
      if (match) navigate(`/match/${match.id}`)
    }
  }

  const filteredCards = cards.filter(c => {
    if (pickedCardIds.includes(c.id)) return false
    if (filterPos !== 'ALL' && c.position !== filterPos) return false
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.club?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const otherPicks = picks.filter(p => p.picked_by !== userId)
  const myFinished = myPicks.length >= 11

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--text-secondary)' }}>Yükleniyor...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'grid', gridTemplateColumns: '1fr 320px', height: '100vh', overflow: 'hidden' }}>

      {/* SOL: Oyuncu Havuzu */}
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid var(--border)' }}>

        {/* Header */}
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--purple-light)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>DRAFT</div>
            <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{lobby?.code}</div>
          </div>
          <div style={{ flex: 1, display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input
              className="input"
              placeholder="Oyuncu ara..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, minWidth: 120, padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
            />
            <select className="input" value={filterPos} onChange={e => setFilterPos(e.target.value)} style={{ width: 'auto', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}>
              <option value="ALL">Tüm Mevkiler</option>
              {['GK','CB','LB','RB','CDM','CM','CAM','LW','RW','ST','CF'].map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Bütçe: </span>
              <span style={{ color: 'var(--green)', fontWeight: 700 }}>€{(remainingBudget / 1000000).toFixed(0)}M</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Seçilen: </span>
              <span style={{ fontWeight: 700 }}>{myPicks.length}/11</span>
            </div>
          </div>
        </div>

        {/* Kart Listesi */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
            {filteredCards.map(card => (
              <div
                key={card.id}
                onClick={() => setSelectedCard(selectedCard?.id === card.id ? null : card)}
                style={{
                  background: selectedCard?.id === card.id ? 'rgba(124,58,237,0.15)' : 'var(--bg-card)',
                  border: `1px solid ${selectedCard?.id === card.id ? 'var(--purple)' : 'var(--border)'}`,
                  borderRadius: 12, padding: '0.75rem', cursor: 'pointer',
                  transition: 'all 0.15s', opacity: card.market_value > remainingBudget ? 0.4 : 1,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div style={{ fontSize: '1.8rem', fontWeight: 900, color: card.overall >= 85 ? 'var(--gold)' : card.overall >= 75 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    {card.overall}
                  </div>
                  <span className={`badge ${POSITION_BADGE[card.position] || 'badge-mid'}`}>{card.position}</span>
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.name}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: '0.5rem' }}>{card.club} · {card.nation}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.2rem', fontSize: '0.7rem', marginBottom: '0.5rem' }}>
                  {[['HZ', card.pace], ['ŞUT', card.shooting], ['PAS', card.passing], ['ÇAL', card.dribbling], ['DEF', card.defending], ['FİZ', card.physical]].map(([l, v]) => (
                    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                      <span>{l}</span><span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{v}</span>
                    </div>
                  ))}
                </div>
                <div style={{ color: 'var(--green)', fontSize: '0.75rem', fontWeight: 700 }}>
                  €{(card.market_value / 1000000).toFixed(1)}M
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Seç Butonu */}
        {selectedCard && !myFinished && (
          <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{selectedCard.name}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{selectedCard.position} · €{(selectedCard.market_value / 1000000).toFixed(1)}M</div>
            </div>
            <button className="btn btn-primary" onClick={handlePick} disabled={selectedCard.market_value > remainingBudget}>
              {selectedCard.market_value > remainingBudget ? 'Bütçe Yetersiz' : '+ Kadroya Ekle'}
            </button>
          </div>
        )}
      </div>

      {/* SAĞ: Kadro */}
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: '0.25rem' }}>
            {players.find(p => p.user_id === userId)?.team_name || 'Kadrom'}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{lobby?.formation} · {myPicks.length}/11 oyuncu</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
          {mySquad.map((pos, i) => {
            const pick = myPicks[i]
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.5rem 0.75rem', borderRadius: 8, marginBottom: '0.3rem',
                background: pick ? 'var(--bg-card)' : 'var(--bg-secondary)',
                border: `1px solid ${pick ? 'var(--border)' : 'var(--border)'}`,
              }}>
                <span className={`badge ${POSITION_BADGE[pos] || 'badge-mid'}`} style={{ fontSize: '0.65rem', minWidth: 36, justifyContent: 'center' }}>{pos}</span>
                {pick ? (
                  <>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pick.player_cards?.name}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>€{(pick.price / 1000000).toFixed(1)}M</div>
                    </div>
                    <div style={{ fontWeight: 800, color: 'var(--gold)', fontSize: '0.9rem' }}>{pick.player_cards?.overall}</div>
                  </>
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Boş slot</div>
                )}
              </div>
            )
          })}

          {/* Rakibin seçimleri */}
          {otherPicks.length > 0 && (
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em', marginBottom: '0.5rem' }}>RAKİP SEÇİMLERİ</div>
              {otherPicks.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.75rem', borderRadius: 8, marginBottom: '0.3rem', background: 'var(--bg-secondary)' }}>
                  <span className={`badge ${POSITION_BADGE[p.player_cards?.position] || 'badge-mid'}`} style={{ fontSize: '0.65rem', minWidth: 36, justifyContent: 'center' }}>
                    {p.player_cards?.position}
                  </span>
                  <div style={{ flex: 1, fontWeight: 600, fontSize: '0.82rem' }}>{p.player_cards?.name}</div>
                  <div style={{ fontWeight: 800, color: 'var(--gold)', fontSize: '0.9rem' }}>{p.player_cards?.overall}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bitir Butonu */}
        <div style={{ padding: '1rem', borderTop: '1px solid var(--border)' }}>
          {myFinished ? (
            <div>
              <div style={{ textAlign: 'center', color: 'var(--green)', fontWeight: 700, marginBottom: '0.75rem', fontSize: '0.9rem' }}>
                ✅ Kadron hazır! Rakip bekleniyor...
              </div>
              <button className="btn btn-success" style={{ width: '100%' }} onClick={handleFinish}>
                MAÇA BAŞLA →
              </button>
            </div>
          ) : (
            <button className="btn btn-primary" style={{ width: '100%', opacity: myPicks.length < 11 ? 0.4 : 1 }} disabled={myPicks.length < 11} onClick={handleFinish}>
              Kadroyu Tamamla ({myPicks.length}/11)
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
