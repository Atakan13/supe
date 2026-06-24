import { useState, useEffect } from 'react'
import { STATIONS, playRadio, stopRadio, setRadioVolume } from '../lib/radio'

export default function RadioWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [currentId, setCurrentId] = useState(null)
  const [volume, setVolume] = useState(0.3)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleStation = async (id) => {
    setError(null)
    if (currentId === id && playing) {
      stopRadio()
      setPlaying(false)
      setCurrentId(null)
      return
    }
    setLoading(true)
    try {
      playRadio(id)
      setCurrentId(id)
      setPlaying(true)
      setTimeout(() => setLoading(false), 2000)
    } catch(e) {
      setError('Stream bağlanamadı')
      setLoading(false)
    }
  }

  const handleVolume = (v) => {
    setVolume(v)
    setRadioVolume(v)
  }

  const currentStation = STATIONS.find(s => s.id === currentId)

  return (
    <div style={{ position:'fixed', bottom:16, right:16, zIndex:1000 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Rajdhani:wght@400;600;700&display=swap');
        @keyframes soundWave { 0%,100%{height:4px} 50%{height:12px} }
      `}</style>

      {/* Panel */}
      {isOpen && (
        <div style={{
          position:'absolute', bottom:52, right:0,
          width:220,
          background:'rgba(8,8,24,0.97)',
          border:'1px solid rgba(0,200,255,0.2)',
          borderRadius:12,
          overflow:'hidden',
          boxShadow:'0 20px 40px rgba(0,0,0,0.6)',
          marginBottom:6,
        }}>
          {/* Başlık */}
          <div style={{ padding:'10px 12px', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(0,0,0,0.3)', display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ display:'flex', gap:2, alignItems:'flex-end' }}>
              {playing && [0,1,2,3].map(i => (
                <div key={i} style={{ width:3, background:'#00c8ff', borderRadius:1, animation:`soundWave 0.8s ease-in-out ${i*0.15}s infinite` }}/>
              ))}
              {!playing && <span style={{ fontSize:14 }}>📻</span>}
            </div>
            <div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:11, letterSpacing:2, color:'rgba(255,255,255,0.6)' }}>RADYO</div>
              {currentStation && playing && (
                <div style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:10, color:'#00c8ff', letterSpacing:0.5 }}>{currentStation.name}</div>
              )}
            </div>
          </div>

          {/* İstasyonlar */}
          <div style={{ padding:'8px 0' }}>
            {STATIONS.map(s => {
              const isActive = currentId === s.id && playing
              return (
                <div key={s.id} onClick={() => handleStation(s.id)}
                  style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 12px', cursor:'pointer', background:isActive?'rgba(0,200,255,0.08)':'transparent', transition:'background .15s' }}
                  onMouseEnter={e => !isActive && (e.currentTarget.style.background='rgba(255,255,255,0.03)')}
                  onMouseLeave={e => !isActive && (e.currentTarget.style.background='transparent')}
                >
                  <div style={{ width:6, height:6, borderRadius:'50%', background:isActive?'#00c8ff':'rgba(255,255,255,0.15)', boxShadow:isActive?'0 0 6px #00c8ff':'none', flexShrink:0 }}/>
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:12, fontWeight:600, color:isActive?'#00c8ff':'rgba(255,255,255,0.7)' }}>{s.name}</div>
                    <div style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:10, color:'rgba(255,255,255,0.25)' }}>{s.genre}</div>
                  </div>
                  {isActive && loading && <div style={{ fontSize:10, color:'rgba(0,200,255,0.5)' }}>...</div>}
                  {isActive && !loading && <span style={{ fontSize:10 }}>▶</span>}
                </div>
              )
            })}
          </div>

          {error && (
            <div style={{ padding:'6px 12px', background:'rgba(239,68,68,0.1)', borderTop:'1px solid rgba(239,68,68,0.2)' }}>
              <div style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:10, color:'#f87171' }}>⚠️ {error} — farklı istasyon dene</div>
            </div>
          )}

          {/* Ses kontrolü */}
          <div style={{ padding:'8px 12px', borderTop:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:11, color:'rgba(255,255,255,0.3)' }}>🔈</span>
            <input type="range" min={0} max={1} step={0.05} value={volume}
              onChange={e => handleVolume(parseFloat(e.target.value))}
              style={{ flex:1, accentColor:'#00c8ff', height:3 }}
            />
            <span style={{ fontSize:11, color:'rgba(255,255,255,0.3)' }}>🔊</span>
          </div>
        </div>
      )}

      {/* Ana buton */}
      <button onClick={() => setIsOpen(o => !o)}
        style={{
          width:42, height:42,
          borderRadius:'50%',
          border:`1px solid ${playing?'rgba(0,200,255,0.4)':'rgba(255,255,255,0.1)'}`,
          background:playing?'rgba(0,200,255,0.12)':'rgba(8,8,24,0.9)',
          color:playing?'#00c8ff':'rgba(255,255,255,0.5)',
          fontSize:18,
          cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow:playing?'0 0 15px rgba(0,200,255,0.2)':'none',
          transition:'all .2s',
        }}>
        📻
      </button>
    </div>
  )
}
