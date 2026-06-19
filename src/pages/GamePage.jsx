import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getClub, } from '../lib/club'
import { PLAYER_CARDS } from '../lib/playerCards'

function getUserId() {
  let id = localStorage.getItem('draft_user_id')
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('draft_user_id', id) }
  return id
}

function LogoMini({ logo, size = 32 }) {
  if (!logo) return <div style={{ width: size, height: size, borderRadius: '50%', background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4 }}>⚽</div>
  const s = size
  const getPath = () => {
    switch (logo.shape) {
      case 'shield': return `M${s/2},${s*.05} L${s*.9},${s*.25} L${s*.9},${s*.6} Q${s*.9},${s*.85} ${s/2},${s*.95} Q${s*.1},${s*.85} ${s*.1},${s*.6} L${s*.1},${s*.25} Z`
      case 'diamond': return `M${s/2},${s*.05} L${s*.92},${s/2} L${s/2},${s*.95} L${s*.08},${s/2} Z`
      case 'hexagon': return `M${s/2},${s*.05} L${s*.88},${s*.27} L${s*.88},${s*.73} L${s/2},${s*.95} L${s*.12},${s*.73} L${s*.12},${s*.27} Z`
      case 'square': return `M${s*.08},${s*.08} L${s*.92},${s*.08} L${s*.92},${s*.92} L${s*.08},${s*.92} Z`
      default: return null
    }
  }
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      {logo.shape === 'circle'
        ? <circle cx={s/2} cy={s/2} r={s*.45} fill={logo.bg} stroke={logo.accent} strokeWidth={s*.04}/>
        : <path d={getPath()} fill={logo.bg} stroke={logo.accent} strokeWidth={s*.04}/>}
      <text x={s/2} y={s/2} textAnchor="middle" dominantBaseline="central" fontSize={s*.38}>{logo.icon}</text>
    </svg>
  )
}

const FORMATIONS = {
  '4-4-2':   { GK:[[50,88]], DEF:[[15,70],[35,70],[65,70],[85,70]], MID:[[15,45],[38,45],[62,45],[85,45]], FWD:[[35,20],[65,20]] },
  '4-3-3':   { GK:[[50,88]], DEF:[[15,70],[35,70],[65,70],[85,70]], MID:[[25,50],[50,45],[75,50]], FWD:[[20,18],[50,15],[80,18]] },
  '4-2-3-1': { GK:[[50,88]], DEF:[[15,70],[35,70],[65,70],[85,70]], MID:[[30,58],[70,58],[20,38],[50,33],[80,38]], FWD:[[50,15]] },
  '3-5-2':   { GK:[[50,88]], DEF:[[25,72],[50,70],[75,72]], MID:[[10,50],[30,45],[50,42],[70,45],[90,50]], FWD:[[35,18],[65,18]] },
  '5-3-2':   { GK:[[50,88]], DEF:[[10,72],[28,70],[50,68],[72,70],[90,72]], MID:[[25,48],[50,45],[75,48]], FWD:[[35,18],[65,18]] },
  '3-4-3':   { GK:[[50,88]], DEF:[[25,72],[50,70],[75,72]], MID:[[15,48],[38,48],[62,48],[85,48]], FWD:[[20,18],[50,15],[80,18]] },
}

const NEWS_TEMPLATES = [
  (a, b) => `${a} takımı bu hafta ${b} ile karşılaşacak!`,
  (a, b) => `${a} - ${b} maçı öncesi heyecan dorukta!`,
  (a) => `${a} kadrosu bu hafta antrenmanlarını tamamladı.`,
  (a, b) => `${b} teknik direktörü: "${a} maçı için hazırız"`,
  (a) => `${a} transferde sürpriz hamle yapabilir!`,
  (a, b) => `${a} ve ${b} arasındaki rekabet kızışıyor!`,
]

export default function GamePage() {
  const { code } = useParams()
  const navigate = useNavigate()
  const userId = getUserId()
  const club = getClub()

  const [lobby, setLobby] = useState(null)
  const [lobbyPlayers, setLobbyPlayers] = useState([])
  const [mySquad, setMySquad] = useState(null)
  const [opSquad, setOpSquad] = useState(null)
  const [standings, setStandings] = useState([])
  const [activeTab, setActiveTab] = useState('home')
  const [matchReady, setMatchReady] = useState(false)
  const [opponentReady, setOpponentReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [news, setNews] = useState([])
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const channelRef = useRef(null)

  const isHost = lobbyPlayers.find(p => p.user_id === userId)?.is_host

  useEffect(() => {
    init()
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [code])

  const init = async () => {
    const { data: lb } = await supabase.from('lobbies').select('*').ilike('code', code).maybeSingle()
    if (!lb) return
    setLobby(lb)

    const { data: pl } = await supabase.from('lobby_players').select('*').eq('lobby_id', lb.id).order('joined_at')
    setLobbyPlayers(pl || [])

    const { data: myS } = await supabase.from('squads').select('*').eq('lobby_id', lb.id).eq('user_id', userId).maybeSingle()
    setMySquad(myS)

    const opId = pl?.find(p => p.user_id !== userId)?.user_id
    if (opId) {
      const { data: opS } = await supabase.from('squads').select('*').eq('lobby_id', lb.id).eq('user_id', opId).maybeSingle()
      setOpSquad(opS)
    }

    const { data: stats } = await supabase.from('season_stats').select('*').eq('lobby_id', lb.id)
    if (stats && stats.length > 0) {
      setStandings(stats.sort((a, b) => b.points - a.points))
    } else {
      // İlk kez - boş puan tablosu oluştur
      const initStats = (pl || []).map(p => ({
        lobby_id: lb.id, user_id: p.user_id, team_name: p.team_name,
        played: 0, wins: 0, draws: 0, losses: 0,
        goals_for: 0, goals_against: 0, points: 0,
      }))
      setStandings(initStats)
    }

    // Haberler oluştur
    const teams = (pl || []).map(p => p.team_name)
    const generatedNews = Array.from({ length: 6 }, (_, i) => {
      const tmpl = NEWS_TEMPLATES[i % NEWS_TEMPLATES.length]
      return { id: i, text: tmpl(teams[0] || 'Ev Sahibi', teams[1] || 'Deplasman'), time: `${i + 1} saat önce` }
    })
    setNews(generatedNews)

    setLoading(false)

    // Realtime
    channelRef.current = supabase.channel('game-' + lb.id)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lobbies', filter: `id=eq.${lb.id}` }, (p) => {
        setLobby(p.new)
        if (p.new.match_ready_home && p.new.match_ready_away) {
          startMatch(lb.id, pl)
        }
      })
      .subscribe()
  }

  const handleReadyForMatch = async () => {
    const newReady = !matchReady
    setMatchReady(newReady)
    const field = isHost ? { match_ready_home: newReady } : { match_ready_away: newReady }
    await supabase.from('lobbies').update(field).eq('id', lobby.id)
  }

  const startMatch = async (lobbyId, players) => {
    const pl = players || lobbyPlayers
    const home = pl[0], away = pl[1]
    if (!home || !away) return

    const { data: existing } = await supabase.from('matches').select('id').eq('lobby_id', lobbyId).maybeSingle()
    if (existing) { navigate(`/match/${existing.id}`); return }

    const { data: match } = await supabase.from('matches').insert({
      lobby_id: lobbyId,
      home_user_id: home.user_id,
      away_user_id: away.user_id,
      status: 'active',
    }).select().single()

    await supabase.from('lobbies').update({ status: 'playing', match_ready_home: false, match_ready_away: false }).eq('id', lobbyId)
    if (match) navigate(`/match/${match.id}`)
  }

  const myTeam = lobbyPlayers.find(p => p.user_id === userId)
  const opTeam = lobbyPlayers.find(p => p.user_id !== userId)
  const myLineup = mySquad?.lineup || []
  const formation = lobby?.formation || '4-4-2'

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#a0a0c0' }}>Yükleniyor...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a1a', display: 'flex', flexDirection: 'column' }}>

      {/* TOP BAR */}
      <div style={{ background: '#0f0f2a', borderBottom: '1px solid #1e1e4a', padding: '.6rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
          <LogoMini logo={club?.logo} size={36} />
          <div>
            <div style={{ fontWeight: 800, fontSize: '.9rem' }}>{club?.clubName || myTeam?.team_name}</div>
            <div style={{ color: '#606080', fontSize: '.7rem' }}>{formation} · Lobi: {lobby?.code}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {/* Rakip */}
          {opTeam && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', color: '#a0a0c0', fontSize: '.85rem' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: opSquad ? '#10b981' : '#f59e0b' }} />
              {opTeam.team_name}
            </div>
          )}

          {/* Maça Hazır Butonu */}
          <button
            onClick={handleReadyForMatch}
            style={{ padding: '.5rem 1.1rem', borderRadius: 8, border: 'none', background: matchReady ? '#10b981' : '#7c3aed', color: '#fff', fontWeight: 700, fontSize: '.82rem', cursor: 'pointer', transition: 'all .2s' }}
          >
            {matchReady ? '✅ Hazırım' : '⚽ Maça Hazır'}
          </button>
        </div>
      </div>

      {/* NAV TABS */}
      <div style={{ background: '#0f0f2a', borderBottom: '1px solid #1e1e4a', display: 'flex', padding: '0 1.5rem' }}>
        {[['home','🏠 Ana Sayfa'],['squad','👥 Kadro'],['tactics','⚙️ Taktik'],['standings','🏆 Puan Tablosu'],['news','📰 Haberler']].map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ padding: '.75rem 1rem', border: 'none', background: 'transparent', color: activeTab === tab ? '#a78bfa' : '#606080', fontWeight: 700, fontSize: '.78rem', cursor: 'pointer', borderBottom: activeTab === tab ? '2px solid #7c3aed' : '2px solid transparent', transition: 'all .15s' }}>
            {label}
          </button>
        ))}
      </div>

      {/* İÇERİK */}
      <div style={{ flex: 1, padding: '1.5rem', maxWidth: 1100, width: '100%', margin: '0 auto' }}>

        {/* ANA SAYFA */}
        {activeTab === 'home' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {/* Maç Durumu */}
            <div style={{ background: '#12122a', border: '1px solid #1e1e4a', borderRadius: 14, padding: '1.25rem', gridColumn: '1/-1' }}>
              <div style={{ fontSize: '.7rem', color: '#606080', fontWeight: 700, letterSpacing: '.08em', marginBottom: '1rem' }}>HAFTALIK MAÇ</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', flex: 1 }}>
                  <LogoMini logo={club?.logo} size={48} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1rem' }}>{myTeam?.team_name}</div>
                    <div style={{ color: matchReady ? '#10b981' : '#f59e0b', fontSize: '.75rem', fontWeight: 600 }}>{matchReady ? '✅ Hazır' : '⏳ Hazır Değil'}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'center', padding: '0 2rem' }}>
                  <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#606080' }}>VS</div>
                  <div style={{ fontSize: '.7rem', color: '#606080', marginTop: '.25rem' }}>İki taraf hazır olunca başlar</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', flex: 1, justifyContent: 'flex-end' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: '1rem' }}>{opTeam?.team_name || 'Rakip'}</div>
                    <div style={{ color: lobby?.match_ready_away || lobby?.match_ready_home ? '#10b981' : '#f59e0b', fontSize: '.75rem', fontWeight: 600 }}>
                      {opTeam ? '⏳ Bekleniyor' : 'Rakip yok'}
                    </div>
                  </div>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#1e1e4a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>⚽</div>
                </div>
              </div>
            </div>

            {/* Takım Özeti */}
            <div style={{ background: '#12122a', border: '1px solid #1e1e4a', borderRadius: 14, padding: '1.25rem' }}>
              <div style={{ fontSize: '.7rem', color: '#606080', fontWeight: 700, letterSpacing: '.08em', marginBottom: '1rem' }}>TAKIM GÜCÜ</div>
              {myLineup.length > 0 ? (
                <>
                  <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#a78bfa', marginBottom: '.25rem' }}>
                    {Math.round(myLineup.slice(0,11).reduce((s, p) => s + (p.overall || 0), 0) / Math.min(myLineup.length, 11))}
                  </div>
                  <div style={{ color: '#606080', fontSize: '.8rem', marginBottom: '1rem' }}>Ortalama Overall</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem' }}>
                    {[
                      ['Hücum', Math.round(myLineup.filter(p => ['ST','CF','LW','RW','LM','RM'].includes(p.squad_pos)).reduce((s,p,_,a) => s + p.shooting/a.length, 0)) || '-'],
                      ['Defans', Math.round(myLineup.filter(p => ['CB','LB','RB'].includes(p.squad_pos)).reduce((s,p,_,a) => s + p.defending/a.length, 0)) || '-'],
                      ['Orta Saha', Math.round(myLineup.filter(p => ['CM','CAM','CDM'].includes(p.squad_pos)).reduce((s,p,_,a) => s + p.passing/a.length, 0)) || '-'],
                      ['Hız', Math.round(myLineup.reduce((s,p,_,a) => s + p.pace/a.length, 0)) || '-'],
                    ].map(([l,v]) => (
                      <div key={l} style={{ background: '#0f0f2a', borderRadius: 8, padding: '.5rem .75rem' }}>
                        <div style={{ color: '#606080', fontSize: '.65rem', fontWeight: 600, marginBottom: '.15rem' }}>{l.toUpperCase()}</div>
                        <div style={{ fontWeight: 800, fontSize: '1rem', color: '#a78bfa' }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ color: '#606080', fontSize: '.85rem' }}>Kadro henüz oluşturulmadı</div>
              )}
            </div>

            {/* Son Haberler */}
            <div style={{ background: '#12122a', border: '1px solid #1e1e4a', borderRadius: 14, padding: '1.25rem' }}>
              <div style={{ fontSize: '.7rem', color: '#606080', fontWeight: 700, letterSpacing: '.08em', marginBottom: '1rem' }}>SON HABERLER</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
                {news.slice(0, 3).map(n => (
                  <div key={n.id} style={{ borderLeft: '2px solid #7c3aed', paddingLeft: '.75rem' }}>
                    <div style={{ fontSize: '.82rem', fontWeight: 600, marginBottom: '.15rem' }}>{n.text}</div>
                    <div style={{ color: '#606080', fontSize: '.7rem' }}>{n.time}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* KADRO */}
        {activeTab === 'squad' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem' }}>
            {/* Saha */}
            <div style={{ background: '#12122a', border: '1px solid #1e1e4a', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ position: 'relative', paddingBottom: '130%', background: 'linear-gradient(180deg,#0d3320 0%,#0f4a28 50%,#0d3320 100%)' }}>
                <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 100 130" preserveAspectRatio="none">
                  <rect x="5" y="3" width="90" height="124" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth=".5"/>
                  <line x1="5" y1="65" x2="95" y2="65" stroke="rgba(255,255,255,.15)" strokeWidth=".4"/>
                  <circle cx="50" cy="65" r="12" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth=".4"/>
                  <rect x="25" y="3" width="50" height="20" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth=".4"/>
                  <rect x="25" y="107" width="50" height="20" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth=".4"/>
                  <rect x="35" y="3" width="30" height="10" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth=".3"/>
                  <rect x="35" y="117" width="30" height="10" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth=".3"/>
                </svg>
                {myLineup.slice(0, 11).map((player, i) => {
                  const fmData = FORMATIONS[formation] || FORMATIONS['4-4-2']
                  const allPos = [...(fmData.GK||[]), ...(fmData.DEF||[]), ...(fmData.MID||[]), ...(fmData.FWD||[])]
                  const pos = allPos[i] || [50, 50]
                  const isSelected = selectedPlayer?.name === player.name
                  return (
                    <div key={i} onClick={() => setSelectedPlayer(isSelected ? null : player)}
                      style={{ position: 'absolute', left: `${pos[0]}%`, top: `${pos[1]}%`, transform: 'translate(-50%,-50%)', cursor: 'pointer', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: isSelected ? '#fbbf24' : '#7c3aed', border: `2px solid ${isSelected ? '#fff' : 'rgba(255,255,255,.3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '.65rem', boxShadow: isSelected ? '0 0 10px rgba(251,191,36,.6)' : 'none' }}>
                        {player.overall}
                      </div>
                      <div style={{ background: 'rgba(0,0,0,.75)', borderRadius: 3, padding: '1px 3px', fontSize: '.55rem', fontWeight: 700, whiteSpace: 'nowrap', maxWidth: 48, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {(player.name || '').split(' ').pop()}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Oyuncu Listesi */}
            <div style={{ background: '#12122a', border: '1px solid #1e1e4a', borderRadius: 14, padding: '1rem', overflowY: 'auto', maxHeight: 600 }}>
              <div style={{ fontSize: '.7rem', color: '#606080', fontWeight: 700, letterSpacing: '.08em', marginBottom: '.75rem' }}>İLK 11</div>
              {myLineup.slice(0, 11).map((p, i) => (
                <div key={i} onClick={() => setSelectedPlayer(selectedPlayer?.name === p.name ? null : p)}
                  style={{ display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.4rem .6rem', borderRadius: 8, marginBottom: '.25rem', background: selectedPlayer?.name === p.name ? 'rgba(124,58,237,.2)' : '#0f0f2a', border: `1px solid ${selectedPlayer?.name === p.name ? '#7c3aed' : '#1e1e4a'}`, cursor: 'pointer' }}>
                  <span style={{ background: '#1e1e4a', color: '#a0a0c0', fontSize: '.58rem', fontWeight: 700, padding: '.1rem .3rem', borderRadius: 4, minWidth: 32, textAlign: 'center' }}>{p.squad_pos}</span>
                  <div style={{ flex: 1, fontWeight: 700, fontSize: '.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                  <div style={{ fontWeight: 800, color: '#fbbf24', fontSize: '.82rem' }}>{p.overall}</div>
                </div>
              ))}

              {mySquad?.bench?.length > 0 && <>
                <div style={{ fontSize: '.7rem', color: '#606080', fontWeight: 700, letterSpacing: '.08em', margin: '.75rem 0 .5rem' }}>YEDEKLER</div>
                {(mySquad.bench || []).map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.4rem .6rem', borderRadius: 8, marginBottom: '.25rem', background: '#0f0f2a', border: '1px solid #1e1e4a', opacity: .7 }}>
                    <span style={{ background: '#1e1e4a', color: '#a0a0c0', fontSize: '.58rem', fontWeight: 700, padding: '.1rem .3rem', borderRadius: 4, minWidth: 32, textAlign: 'center' }}>{p.squad_pos}</span>
                    <div style={{ flex: 1, fontWeight: 600, fontSize: '.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#a0a0c0' }}>{p.name}</div>
                    <div style={{ fontWeight: 700, color: '#a0a0c0', fontSize: '.78rem' }}>{p.overall}</div>
                  </div>
                ))}
              </>}

              {/* Seçili oyuncu detayı */}
              {selectedPlayer && (
                <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(124,58,237,.1)', border: '1px solid #7c3aed', borderRadius: 10 }}>
                  <div style={{ fontWeight: 800, fontSize: '.95rem', marginBottom: '.75rem' }}>{selectedPlayer.name}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.4rem', fontSize: '.75rem' }}>
                    {[['Hız',selectedPlayer.pace],['Şut',selectedPlayer.shooting],['Pas',selectedPlayer.passing],['Çalım',selectedPlayer.dribbling],['Defans',selectedPlayer.defending],['Fizik',selectedPlayer.physical]].map(([l,v])=>(
                      <div key={l} style={{ display: 'flex', justifyContent: 'space-between', background: '#0f0f2a', padding: '.3rem .5rem', borderRadius: 6 }}>
                        <span style={{ color: '#606080' }}>{l}</span>
                        <span style={{ fontWeight: 700, color: '#a78bfa' }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAKTİK */}
        {activeTab === 'tactics' && (
          <div style={{ background: '#12122a', border: '1px solid #1e1e4a', borderRadius: 14, padding: '1.5rem' }}>
            <div style={{ fontSize: '.7rem', color: '#606080', fontWeight: 700, letterSpacing: '.08em', marginBottom: '1.5rem' }}>TAKTİK AYARLARI</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              {[
                { label: 'BASIN', options: ['Yüksek Baskı','Orta Baskı','Düşük Baskı'], icon: '⚡' },
                { label: 'SAVUNMA', options: ['Ofansif','Dengeli','Defansif'], icon: '🛡️' },
                { label: 'HÜCUM', options: ['Kanatlardan','Ortadan','Kontratak'], icon: '⚔️' },
                { label: 'TEMPO', options: ['Hızlı','Normal','Yavaş'], icon: '🏃' },
                { label: 'KALE VURUŞU', options: ['Kısa','Uzun','Karma'], icon: '🥅' },
                { label: 'KORNER', options: ['Kısa','Uzun','Karma'], icon: '🚩' },
              ].map(tactic => (
                <div key={tactic.label} style={{ background: '#0f0f2a', borderRadius: 10, padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.75rem' }}>
                    <span>{tactic.icon}</span>
                    <span style={{ fontSize: '.7rem', color: '#606080', fontWeight: 700, letterSpacing: '.06em' }}>{tactic.label}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '.3rem' }}>
                    {tactic.options.map((opt, i) => (
                      <div key={opt} style={{ padding: '.4rem .6rem', borderRadius: 6, background: i === 1 ? 'rgba(124,58,237,.2)' : 'transparent', border: `1px solid ${i === 1 ? '#7c3aed' : '#1e1e4a'}`, fontSize: '.78rem', fontWeight: i === 1 ? 700 : 400, color: i === 1 ? '#a78bfa' : '#606080', cursor: 'pointer' }}>
                        {opt}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PUAN TABLOSU */}
        {activeTab === 'standings' && (
          <div style={{ background: '#12122a', border: '1px solid #1e1e4a', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #1e1e4a' }}>
              <div style={{ fontSize: '.7rem', color: '#606080', fontWeight: 700, letterSpacing: '.08em' }}>PUAN TABLOSU</div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#0f0f2a' }}>
                  {['#','Takım','O','G','B','M','AG','YG','AV','P'].map(h => (
                    <th key={h} style={{ padding: '.6rem .75rem', textAlign: h === 'Takım' ? 'left' : 'center', fontSize: '.68rem', color: '#606080', fontWeight: 700, letterSpacing: '.06em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lobbyPlayers.map((player, i) => {
                  const stat = standings.find(s => s.user_id === player.user_id) || { played:0,wins:0,draws:0,losses:0,goals_for:0,goals_against:0,points:0 }
                  const isMe = player.user_id === userId
                  return (
                    <tr key={player.id} style={{ borderTop: '1px solid #1e1e4a', background: isMe ? 'rgba(124,58,237,.08)' : 'transparent' }}>
                      <td style={{ padding: '.6rem .75rem', textAlign: 'center', fontWeight: 800, color: i === 0 ? '#fbbf24' : '#606080' }}>{i+1}</td>
                      <td style={{ padding: '.6rem .75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                          <LogoMini logo={isMe ? club?.logo : null} size={24} />
                          <span style={{ fontWeight: isMe ? 700 : 400, fontSize: '.85rem' }}>{player.team_name}</span>
                          {isMe && <span style={{ fontSize: '.6rem', color: '#7c3aed', fontWeight: 700 }}>(sen)</span>}
                        </div>
                      </td>
                      {[stat.played,stat.wins,stat.draws,stat.losses,stat.goals_for,stat.goals_against,(stat.goals_for-stat.goals_against)>0?`+${stat.goals_for-stat.goals_against}`:stat.goals_for-stat.goals_against].map((v,j) => (
                        <td key={j} style={{ padding: '.6rem .75rem', textAlign: 'center', fontSize: '.85rem', color: '#a0a0c0' }}>{v}</td>
                      ))}
                      <td style={{ padding: '.6rem .75rem', textAlign: 'center', fontWeight: 800, fontSize: '.9rem', color: '#a78bfa' }}>{stat.points}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* HABERLER */}
        {activeTab === 'news' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
            <div style={{ fontSize: '.7rem', color: '#606080', fontWeight: 700, letterSpacing: '.08em', marginBottom: '.25rem' }}>HABER MERKEZİ</div>
            {news.map(n => (
              <div key={n.id} style={{ background: '#12122a', border: '1px solid #1e1e4a', borderRadius: 12, padding: '1rem 1.25rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: '#1e1e4a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>📰</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '.9rem', marginBottom: '.25rem' }}>{n.text}</div>
                  <div style={{ color: '#606080', fontSize: '.75rem' }}>{n.time}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
