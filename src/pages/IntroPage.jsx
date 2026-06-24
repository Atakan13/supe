import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

export default function IntroPage() {
  const navigate = useNavigate()
  const videoRef = useRef(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    video.play().catch(() => {
      const dest = sessionStorage.getItem('intro_redirect') || '/menu'
      sessionStorage.removeItem('intro_redirect')
      navigate(dest, { replace: true })
    })

    const handleEnd = () => {
      const dest = sessionStorage.getItem('intro_redirect') || '/menu'
      sessionStorage.removeItem('intro_redirect')
      navigate(dest, { replace: true })
    }

    video.addEventListener('ended', handleEnd)
    return () => video.removeEventListener('ended', handleEnd)
  }, [])

  return (
    <div
      onClick={() => {
        const dest = sessionStorage.getItem('intro_redirect') || '/menu'
        sessionStorage.removeItem('intro_redirect')
        navigate(dest, { replace: true })
      }}
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
