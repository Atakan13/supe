import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function MenuPage() {
  const navigate = useNavigate()
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [userName, setUserName] = useState('')
  const [teamName, setTeamName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [settings, setSettings] = useState({
    formation: '4-4-2',
    difficulty: 'medium',
    budget: 500000000,
    star_limit: 1,
  })

  const getUserId = () => {
    let id = localStorage.getItem('draft_user_id')
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem('draft_user_id', id)
    }
    return id
  }

  const handleCreate = async () => {
    if (!userName.trim() || !teamName.trim()) return setError('İsim ve takım adı gir')
    setLoading(true)
    setError('')
    try {
      const userId = getUserId()
      localStorage.setItem('draft_user_name', userName)

      const { data: lobby, error: le } = await supabase
        .from('lobbies')
        .insert({
          host_id: userId,
          host_name: userName,
          formation: settings.formation,
          difficulty: settings.difficulty,
          budget: settings.budget,
          star_limit: settings.star_limit,
        })
        .select()
        .single()

      if (le) throw le

      await supabase.from('lobby_players').insert({
        lobby_id: lobby.id,
        user_id: userId,
        user_name: userName,
        team_name: teamName,
        is_host: true,
        is_ready: false,
      })

      navigate(`/lobby/${lobby.code}`)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async () => {
    if (!userName.trim() || !teamName.trim() || !joinCode.trim()) return setError('Tüm alanları doldur')
    setLoading(true)
    setError('')
    try {
      const userId = getUserId()
      localStorage.setItem('draft_user_name', userName)

      const { data: lobbies, error: le } = await supabase
        .from('lobbies')
        .select('*')
        .ilike('code', joinCode.trim())
        .eq('status', 'waiting')

      if (le) throw le
      if (!lobbies || lobbies.length === 0) throw new Error('Lobi bulunamadı veya oyun başlamış')

      const lobby = lobbies[0]

      const { error: pe } = await supabase.from('lobby_players').insert({
        lobby_id: lobby.id,
        user_id: userId,
        user_name: userName,
        team_name: teamName,
        is_host: false,
        is_ready: false,
      })

      if (pe) throw pe

      navigate(`/lobby/${lobby.code}`)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Arka plan efekti */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 60% 50% at 20% 50%, rgba(124,58,237,0.15) 0%, transparent 70%), radial-gradient(ellipse 40% 60% at 80% 50%, rgba(124,58,237,0.08) 0%, transparent 70%)',
      }} />

      <div style={{ width: '100%', maxWidth: '960px', position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div style={{ marginBottom: '3rem' }}>
          <p style={{ color: 'var(--purple-light)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            TEKNİK DİREKTÖR KARİYERİ
          </p>
          <h1 style={{ fontSize: '3rem', fontWeight: 900, lineHeight: 1.1, marginBottom: '1rem' }}>
            Kulübünü kur.<br />
            <span style={{ color: 'var(--purple-light)' }}>Sezonu yönet.</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '500px' }}>
            Arkadaşlarınla gerçek zamanlı draft yap, kadronuzu kur ve maç motorunda mücadele et.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', maxWidth: '600px' }}>
          {/* Lobi Oluştur */}
          <div
            className="card"
            style={{ cursor: 'pointer', borderColor: showCreate ? 'var(--purple)' : 'var(--border)', transition: 'all 0.2s' }}
            onClick={() => { setShowCreate(!showCreate); setShowJoin(false); setError('') }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: showCreate ? '1rem' : 0 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>⚽</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>LOBİ OLUŞTUR</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Yeni oyun başlat</div>
              </div>
            </div>

            {showCreate && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }} onClick={e => e.stopPropagation()}>
                <input className="input" placeholder="Adın" value={userName} onChange={e => setUserName(e.target.value)} />
                <input className="input" placeholder="Takım adı" value={teamName} onChange={e => setTeamName(e.target.value)} />
                <select className="input" value={settings.formation} onChange={e => setSettings(s => ({ ...s, formation: e.target.value }))}>
                  {['4-4-2','4-3-3','3-5-2','4-2-3-1','5-3-2','3-4-3'].map(f => <option key={f}>{f}</option>)}
                </select>
                <select className="input" value={settings.difficulty} onChange={e => setSettings(s => ({ ...s, difficulty: e.target.value }))}>
                  <option value="easy">Kolay</option>
                  <option value="medium">Orta</option>
                  <option value="hard">Zor</option>
                </select>
                <select className="input" value={settings.star_limit} onChange={e => setSettings(s => ({ ...s, star_limit: +e.target.value }))}>
                  {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} Yıldız Limit</option>)}
                </select>
                {error && <p style={{ color: 'var(--red)', fontSize: '0.8rem' }}>{error}</p>}
                <button className="btn btn-primary" onClick={handleCreate} disabled={loading}>
                  {loading ? 'Oluşturuluyor...' : 'BAŞLAT'}
                </button>
              </div>
            )}
          </div>

          {/* Lobiye Katıl */}
          <div
            className="card"
            style={{ cursor: 'pointer', borderColor: showJoin ? 'var(--purple)' : 'var(--border)', transition: 'all 0.2s' }}
            onClick={() => { setShowJoin(!showJoin); setShowCreate(false); setError('') }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: showJoin ? '1rem' : 0 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>🔗</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>LOBİYE KATIL</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Kod ile gir</div>
              </div>
            </div>

            {showJoin && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }} onClick={e => e.stopPropagation()}>
                <input className="input" placeholder="Adın" value={userName} onChange={e => setUserName(e.target.value)} />
                <input className="input" placeholder="Takım adı" value={teamName} onChange={e => setTeamName(e.target.value)} />
                <input className="input" placeholder="Lobi kodu (örn: AB12CD)" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} maxLength={6} style={{ letterSpacing: '0.2em', fontWeight: 700, textAlign: 'center' }} />
                {error && <p style={{ color: 'var(--red)', fontSize: '0.8rem' }}>{error}</p>}
                <button className="btn btn-primary" onClick={handleJoin} disabled={loading}>
                  {loading ? 'Katılıyor...' : 'KATIL'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '2rem', marginTop: '3rem' }}>
          {[['30+', 'OYUNCU KARTI'], ['6', 'DİZİLİŞ'], ['3', 'ZORLUK SEVİYESİ']].map(([v, l]) => (
            <div key={l}>
              <div style={{ fontSize: '1.8rem', fontWeight: 900 }}>{v}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '0.1em', fontWeight: 600 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
