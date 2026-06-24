// Ses sistemi
const sounds = {}
let ambientPlaying = false
let ambientAudio = null

export function loadSounds() {
  sounds.goal    = new Audio('/assets/sounds/goal.mp3')
  sounds.whistle = new Audio('/assets/sounds/whistle.mp3')
  sounds.ambient = new Audio('/assets/sounds/crowd_ambient.mp3')
  
  sounds.goal.volume    = 0.8
  sounds.whistle.volume = 0.7
  sounds.ambient.volume = 0.2
  sounds.ambient.loop   = true
}

export function playSound(name) {
  try {
    if (!sounds[name]) loadSounds()
    const s = sounds[name]
    s.currentTime = 0
    s.play().catch(() => {})
  } catch(e) {}
}

export function startAmbient() {
  try {
    if (!sounds.ambient) loadSounds()
    if (!ambientPlaying) {
      sounds.ambient.play().catch(() => {})
      ambientPlaying = true
      ambientAudio = sounds.ambient
    }
  } catch(e) {}
}

export function stopAmbient() {
  try {
    if (ambientAudio) {
      ambientAudio.pause()
      ambientAudio.currentTime = 0
      ambientPlaying = false
    }
  } catch(e) {}
}

export function setAmbientVolume(v) {
  try {
    if (sounds.ambient) sounds.ambient.volume = v
  } catch(e) {}
}
