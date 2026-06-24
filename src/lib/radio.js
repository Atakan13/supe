// Radyo stream URL'leri
export const STATIONS = [
  { id:'nrj',      name:'NRJ Türkiye',    genre:'Pop/Dance',    url:'https://nrj.com.tr/radyo/nrj-turkiye' },
  { id:'power',    name:'Power FM',        genre:'Türkçe Pop',   url:'https://listen.powerapp.com.tr/powerfm/abr/playlist.m3u8' },
  { id:'kral',     name:'Kral FM',         genre:'Türkçe',       url:'https://listen.powerapp.com.tr/kralfm/abr/playlist.m3u8' },
  { id:'fenomen',  name:'Radyo Fenomen',   genre:'Elektronik',   url:'https://radyofenomen.com.tr/listen.pls' },
  { id:'virgin',   name:'Virgin Radio TR', genre:'Rock/Pop',     url:'https://listen.powerapp.com.tr/virginradio/abr/playlist.m3u8' },
]

let radioAudio = null
let currentStation = null
let volume = 0.3

export function playRadio(stationId) {
  const station = STATIONS.find(s => s.id === stationId)
  if (!station) return

  if (radioAudio) {
    radioAudio.pause()
    radioAudio = null
  }

  radioAudio = new Audio(station.url)
  radioAudio.volume = volume
  radioAudio.play().catch(e => console.log('Radio error:', e))
  currentStation = stationId
  return station
}

export function stopRadio() {
  if (radioAudio) {
    radioAudio.pause()
    radioAudio = null
    currentStation = null
  }
}

export function setRadioVolume(v) {
  volume = v
  if (radioAudio) radioAudio.volume = v
}

export function getCurrentStation() {
  return currentStation
}
