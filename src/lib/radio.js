// Radyo stream URL'leri
export const STATIONS = [
  { id:'paradise', name:'Radio Paradise',  genre:'Alternatif',  url:'https://stream.radioparadise.com/mp3-128' },
  { id:'paradise2',name:'RP Mellow',       genre:'Chill',       url:'https://stream.radioparadise.com/mellow-128' },
  { id:'paradise3',name:'RP Rock',         genre:'Rock',        url:'https://stream.radioparadise.com/rock-128' },
  { id:'lofi',     name:'Lofi Hip Hop',    genre:'Lofi',        url:'https://streams.ilovemusic.de/iloveradio17.mp3' },
  { id:'chillhop', name:'Chillhop',        genre:'Chill',       url:'https://streams.ilovemusic.de/iloveradio21.mp3' },
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
