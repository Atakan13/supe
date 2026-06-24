import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

export default function IntroPage() {
  const navigate = useNavigate()
  const videoRef = useRef(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    video.play().catch(() => {
      navigate('/menu', { replace: true })
    })

    const handleEnd = () => {
      navigate('/menu', { replace: true })
    }

    video.addEventListener('ended', handleEnd)
    return () => video.removeEventListener('ended', handleEnd)
  }, [])

  return (
    <div
      onClick={() => navigate('/menu', { replace: true })}
      style={{
        position: 'fixed', inset: 0, background: '#000',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999, cursor: 'pointer',
      }}>
      <video
        ref={videoRef}
        src="/intro.mp4"
        style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
        playsInline
        muted
        autoPlay
      />
    </div>
  )
}
