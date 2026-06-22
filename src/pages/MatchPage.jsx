import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PLAYER_CARDS } from '../lib/playerCards'

function getUserId() {
  let id = localStorage.getItem('draft_user_id')
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('draft_user_id', id) }
  return id
}

const TACTICS_CONFIG = {
  pressing:     { options:[{id:'gegenpressing',statBonus:{defending:8,pace:5}},{id:'high_press',statBonus:{defending:5,physical:3}},{id:'mid_press',statBonus:{defending:2}},{id:'low_block',statBonus:{defending:10,shooting:-3}}]},
  tempo:        { options:[{id:'fast',statBonus:{pace:8,passing:3}},{id:'normal',statBonus:{}},{id:'slow',statBonus:{passing:8,dribbling:5}}]},
  attack_width: { options:[{id:'wide',statBonus:{dribbling:6}},{id:'central',statBonus:{shooting:6,passing:4}},{id:'mixed',statBonus:{passing:3}}]},
  defense_line: { options:[{id:'high',statBonus:{defending:5,pace:-3}},{id:'standard',statBonus:{defending:2}},{id:'deep',statBonus:{defending:8,shooting:-5}}]},
  buildup:      { options:[{id:'short',statBonus:{passing:10,dribbling:5}},{id:'direct',statBonus:{shooting:5,physical:5}},{id:'counter',statBonus:{pace:10,shooting:5}}]},
  set_piece:    { options:[{id:'short',statBonus:{passing:5}},{id:'long',statBonus:{physical:8}}]},
}

const PLAYER_ROLES_BONUS = {
  sweeper_keeper:{pace:10,passing:8}, classic_gk:{goalkeeper:5},
  ball_playing:{passing:8,dribbling:5}, stopper:{defending:8,physical:5}, libero:{dribbling:8,passing:6},
  wing_back:{pace:8,dribbling:6}, full_back:{defending:5,passing:5}, inverted_wb:{shooting:8,dribbling:6},
  anchor:{defending:10}, dlp:{passing:10,dribbling:5}, bwm:{defending:8,physical:8},
  box_to_box:{physical:8,shooting:5}, carrilero:{passing:8,defending:5}, mezzala:{shooting:8,dribbling:6},
  trequartista:{dribbling:10,shooting:8}, shadow_striker:{shooting:10,pace:5}, adv_playmaker:{passing:10,dribbling:6},
  winger:{pace:10,dribbling:6}, inside_forward:{shooting:10,dribbling:8}, wide_pm:{passing:10,dribbling:5},
  advanced_forward:{pace:8,shooting:6}, target_man:{physical:10,shooting:5}, poacher:{shooting:12}, dlf:{passing:8,dribbling:6},
}

const PLAYER_ROLES_NARRATIVE = {
  sweeper_keeper:'ceza sahasından çıktı', classic_gk:'çizgisinde bekledi',
  ball_playing:'topa sahip çıkıp pas aradı', stopper:'agresif müdahale yaptı', libero:'öne çıkıp oyun kurdu',
  wing_back:'kanat bekinden hücuma çıktı', full_back:'pozisyonunu koruyarak çıktı', inverted_wb:'içe kesip şut denedi',
  anchor:'defans önünde durdu', dlp:'derineden oyun kurdu', bwm:'topu kazanmaya çalıştı',
  box_to_box:'cezadan cezaya koştu', carrilero:'yandan koşu yaptı', mezzala:'içe kesip şut denedi',
  trequartista:'serbest dolaşıp pozisyon aradı', shadow_striker:'arkadan gelerek şut denedi', adv_playmaker:'yaratıcı paslar attı',
  winger:'kanat koşusu yaptı', inside_forward:'içe keserek şut denedi', wide_pm:'kanaldan oyun kurdu',
  advanced_forward:'arkayı zorlayan koşu yaptı', target_man:'sırtını dönerek top aldı', poacher:'ceza sahasında pozisyon aldı', dlf:'geriye düşüp oyun kurdu',
}

const TACTICS_NARRATIVE = {
  gegenpressing:'yüksek baskıyla topu geri kazanmaya çalışıyor', high_press:'rakip yarısında pres uyguluyor',
  mid_press:'orta alanda blok oluşturuyor', low_block:'kompakt blokla savunuyor',
  fast:'yüksek tempoda oynuyor', normal:'dengeli tempo tutuyor', slow:'topla oynayarak tempo kırıyor',
  wide:'kanatları etkin kullanıyor', central:'merkezi hücum kuruyor', mixed:'çeşitli bölgelerden hücum ediyor',
  high:'yüksek savunma hattı tutuyor', standard:'standart hat tutuyor', deep:'derin savunma yapıyor',
  short:'kısa paslarla oyun kuruyor', direct:'direkt top oynuyor', counter:'kontratak oynuyor',
  long:'uzun duran top kullanıyor',
}

const ATK_ACTIONS = [
  { id:'shot',    label:'Şut Çek',  stat:'shooting',  emoji:'⚡' },
  { id:'dribble', label:'Çalım At', stat:'dribbling', emoji:'🔥' },
  { id:'cross',   label:'Orta Yap', stat:'passing',   emoji:'📐' },
  { id:'pass',    label:'Pas Ver',  stat:'passing',   emoji:'↗️' },
  { id:'sprint',  label:'Hızlan',   stat:'pace',      emoji:'💨' },
]
const DEF_ACTIONS = [
  { id:'block',    label:'Önüne Geç',      stat:'defending', emoji:'🛡️' },
  { id:'tackle',   label:'Müdahale Et',    stat:'defending', emoji:'⚔️' },
  { id:'position', label:'Pozisyon Al',    stat:'defending', emoji:'📍' },
  { id:'press',    label:'Baskı Yap',      stat:'physical',  emoji:'💪' },
  { id:'let',      label:'Geçmesine İzin', stat:'pace',      emoji:'🏃' },
]
const GK_ACTIONS = [
  { id:'corner', label:'Köşeye At',     stat:'goalkeeper', emoji:'🥅' },
  { id:'catch',  label:'Tut',           stat:'goalkeeper', emoji:'🧤' },
  { id:'punch',  label:'Yumrukla',      stat:'physical',   emoji:'👊' },
  { id:'dive',   label:'Dal',           stat:'goalkeeper', emoji:'🤸' },
]

// 70+ Spiker anlatımı
const ATK_NARRATIVES = {
  shot: [
    (p,z) => `${p} ${z} rakip defansı geçip güçlü bir şut çekti!`,
    (p,z) => `${p} ${z} ani dönerek sert bir şut denedi!`,
    (p,z) => `${p} ceza sahasının dışından uzaktan vurdu!`,
    (p,z) => `${p} ${z} kalecinin köşesini hedef aldı!`,
    (p,z) => `${p} yıkılmadan dengeli bir şut çekmeyi başardı!`,
    (p,z) => `${p} boş pozisyonu değerlendirip şut çekti!`,
    (p,z) => `${p} vollede topu ağlara göndermeye çalıştı!`,
    (p,z) => `${p} kafa vuruşuyla kaleyi hedef aldı!`,
    (p,z) => `${p} bilek hareketiyle kalecinin altını hedef aldı!`,
    (p,z) => `${p} sağ ayak dışıyla şaşırtan bir şut çekti!`,
    (p,z) => `${p} pivot yaparak ani dönüşle şut çekti!`,
    (p,z) => `${p} ${z} frenk vuruşu denedi!`,
    (p,z) => `${p} son anda dengeli durarak güçlü bir şut denedi!`,
    (p,z) => `${p} boşlukta topla buluşup güçlü şut çekti!`,
    (p,z) => `${p} ${z} ilk temaşta şut çekti, kaleci hazırlıksız!`,
  ],
  dribble: [
    (p,z) => `${p} ${z} harika bir çalımla savunmacıyı geçti!`,
    (p,z) => `${p} ${z} hız ve çevikliğiyle defans hattını deldi!`,
    (p,z) => `${p} rakibini hem sağa hem sola salladı!`,
    (p,z) => `${p} ${z} elastico hareketiyle savunmacıyı alt etti!`,
    (p,z) => `${p} hızlı ayak hareketleriyle rakibini geride bıraktı!`,
    (p,z) => `${p} topla dans ederek iki savunmacıyı geçti!`,
    (p,z) => `${p} ${z} ani duraklamayla savunmacıyı şaşırttı!`,
    (p,z) => `${p} ${z} rüzgar gibi esip savunmayı geçti!`,
    (p,z) => `${p} sırt dönük topla rakibini mağlup etti!`,
    (p,z) => `${p} ${z} tek iki yaparak içe girdi!`,
    (p,z) => `${p} defans duvarını yıkarak hücuma devam etti!`,
    (p,z) => `${p} ${z} finta yapıp rakibini geride bıraktı!`,
    (p,z) => `${p} kombinasyonun içinden süzülerek çıktı!`,
    (p,z) => `${p} ${z} sprint yaparak yan duvarı geçti!`,
    (p,z) => `${p} arka topukla şaşırtan bir hareketle geçti!`,
  ],
  cross: [
    (p,z) => `${p} ${z} ceza sahasına tehlikeli bir orta yaptı!`,
    (p,z) => `${p} ${z} düşük orta yaparak santrforu buldu!`,
    (p,z) => `${p} hızlı çıkışın ardından ölüm ortası yaptı!`,
    (p,z) => `${p} ${z} savunmanın arkasına sertçe orta attı!`,
    (p,z) => `${p} geri orta yaparak ceza sahasına çekti!`,
    (p,z) => `${p} ${z} hava topuna yönelik yüksek orta attı!`,
    (p,z) => `${p} defansın önünden geçen tehlikeli bir orta yaptı!`,
    (p,z) => `${p} ${z} kalecinin önünden geçen ölümcül orta!`,
    (p,z) => `${p} ikinci direğe yönelik kesin orta attı!`,
    (p,z) => `${p} ${z} kısa köşe kombinasyonundan orta yaptı!`,
    (p,z) => `${p} savunmanın arkasını bulan mükemmel orta!`,
    (p,z) => `${p} ${z} yan hattın ucundan keskin orta yaptı!`,
    (p,z) => `${p} tek seferlik hareketle orta attı!`,
    (p,z) => `${p} ${z} hızlı kombinasyonla ceza sahasına yüklendi!`,
    (p,z) => `${p} santrfor için biçilmiş orta gönderdi!`,
  ],
  pass: [
    (p,z) => `${p} ${z} boşlukta koşan arkadaşını buldu!`,
    (p,z) => `${p} derinlemesine nefis bir pas verdi!`,
    (p,z) => `${p} ${z} defansın arkasına uzun top gönderdi!`,
    (p,z) => `${p} rakip presinin altından çıkan mükemmel pas!`,
    (p,z) => `${p} ${z} kısa kombinasyonla oyun kurdu!`,
    (p,z) => `${p} topuğuyla harika bir pas verdi!`,
    (p,z) => `${p} ${z} uzun mesafeli isabetli pas gönderdi!`,
    (p,z) => `${p} baskı altında sakin kalıp doğru pasını verdi!`,
    (p,z) => `${p} ${z} açık kanada hızlı pas gönderdi!`,
    (p,z) => `${p} savunmayı yarıp geçen harika bir pas attı!`,
    (p,z) => `${p} ${z} taktiksel geçiş yaparak tempo değiştirdi!`,
    (p,z) => `${p} ileriye doğru yaptığı pas pozisyon yarattı!`,
    (p,z) => `${p} ${z} üçgen kombinasyonuyla savunmayı geçti!`,
    (p,z) => `${p} ${z} rakip bloğunun arasından pas sızdırdı!`,
    (p,z) => `${p} yüksek top tutma oranıyla pozisyon aradı!`,
  ],
  sprint: [
    (p,z) => `${p} ${z} defans hattının arkasına koştu!`,
    (p,z) => `${p} inanılmaz bir hızla boş alana girdi!`,
    (p,z) => `${p} ${z} ofside düşmeden hız yaptı!`,
    (p,z) => `${p} savunmacıyı geride bırakarak koşmaya devam etti!`,
    (p,z) => `${p} uzun koşunun ardından pozisyon aldı!`,
    (p,z) => `${p} ${z} hız farkıyla savunmacıyı geçti!`,
    (p,z) => `${p} diyagonal koşuyla boşluğa girdi!`,
    (p,z) => `${p} ${z} kontratak pozisyonunda tek başına kaldı!`,
    (p,z) => `${p} ani hızlanmayla defans hattını geçti!`,
    (p,z) => `${p} boş kanatta tek başına koştu!`,
    (p,z) => `${p} ${z} savunma sıkıştırmasından süratle çıktı!`,
    (p,z) => `${p} rakibini temiz geçerek alana girdi!`,
    (p,z) => `${p} ${z} hız patlamasıyla tüm savunmayı geçti!`,
    (p,z) => `${p} rocket gibi fırlayarak boşluğa daldı!`,
    (p,z) => `${p} ${z} sprint yaparak rakibini sollayıp geçti!`,
  ],
}

const DEF_NARRATIVES = {
  block: [
    (p) => `${p} harika pozisyonla şutu engelledi!`,
    (p) => `${p} son anda önüne geçerek topu uzaklaştırdı!`,
    (p) => `${p} vücudunu siper ederek şutu kesti!`,
    (p) => `${p} kritik anda devreye girerek engel oldu!`,
    (p) => `${p} mükemmel zamanlama ile bloğunu koydu!`,
    (p) => `${p} çift bacakla şutu önledi!`,
    (p) => `${p} gövdesiyle topu sahaya yaptı!`,
    (p) => `${p} son adımda topu çizgi üzerinde kurtardı!`,
    (p) => `${p} pozisyon alarak atağı durdurdu!`,
    (p) => `${p} vücuduyla koridor kapattı!`,
  ],
  tackle: [
    (p) => `${p} sert müdahaleyle topu rakibinden aldı!`,
    (p) => `${p} temiz müdahaleyle topu kazandı!`,
    (p) => `${p} zamanlı kayışla topu kapıverdi!`,
    (p) => `${p} agresif müdahaleyle topu söküp aldı!`,
    (p) => `${p} düşerek topu sahaya atmayı başardı!`,
    (p) => `${p} arkadan gelip topu kaptı!`,
    (p) => `${p} taktiksel müdahaleyle atağı kesti!`,
    (p) => `${p} kayan müdahaleyle topu uzaklaştırdı!`,
    (p) => `${p} çift bacakla temiz müdahale yaptı!`,
    (p) => `${p} son anda topu rakibinden söküp aldı!`,
  ],
  position: [
    (p) => `${p} iyi pozisyon alarak tehlikeyi önledi!`,
    (p) => `${p} kapanarak rakibin rotasını kesti!`,
    (p) => `${p} doğru pozisyonla atağı boşa çıkardı!`,
    (p) => `${p} koridor kapayarak rakibini sıkıştırdı!`,
    (p) => `${p} geriye düşerek atağı yavaşlattı!`,
    (p) => `${p} defans arkasını kapatarak ofsayt tuzağı kurdu!`,
    (p) => `${p} konsantrasyonla boşluğu kapattı!`,
    (p) => `${p} ekibini yönlendirerek pozisyon aldı!`,
    (p) => `${p} akıllıca geri çekilerek topu bekledi!`,
    (p) => `${p} savunma hattını sağlam tutarak geçirmedi!`,
  ],
  press: [
    (p) => `${p} sürekli baskıyla rakibini bunalttı!`,
    (p) => `${p} yüksek pres uygulamasıyla rakibin hatasını provoke etti!`,
    (p) => `${p} arkasından gelip topu kapmaya çalıştı!`,
    (p) => `${p} rakibini köşeye sıkıştırdı!`,
    (p) => `${p} amansız baskıyla rakibi pas atmak zorunda bıraktı!`,
    (p) => `${p} yüksek tempolu pressingle topu geri kazandı!`,
    (p) => `${p} ekibiyle koordineli pres yaparak topu çaldı!`,
    (p) => `${p} rakibin üzerine giderek hata yaptırdı!`,
    (p) => `${p} baskısıyla rakibi uzun topa zorladı!`,
    (p) => `${p} pes etmeden rakibini takip ederek fırsatı bekledi!`,
  ],
  let: [
    (p) => `${p} geçmesine izin verdi, tehlike kapıda!`,
    (p) => `${p} savunmada boşluk bıraktı!`,
    (p) => `${p} dengesini kaybetti, rakip geçti!`,
    (p) => `${p} yavaş kalınca rakip hız yaptı!`,
    (p) => `${p} müdahale edemedi, atak devam ediyor!`,
  ],
}

const GK_NARRATIVES = {
  corner: [
    (p) => `${p} topu güvenle köşeye attı!`,
    (p) => `${p} refleksiyle topu köşeye yönlendirdi!`,
    (p) => `${p} son anda topu köşeye uzaklaştırdı!`,
    (p) => `${p} mükemmel pozisyonla köşeye çıkardı!`,
    (p) => `${p} zor açıdan topu köşeye savuşturdu!`,
  ],
  catch: [
    (p) => `${p} topu emin ellerde kavradı!`,
    (p) => `${p} güçlü elleriyle topu tuttu!`,
    (p) => `${p} şutu rahat bir şekilde avuçladı!`,
    (p) => `${p} konsantrasyonunu kaybetmeden yakaladı!`,
    (p) => `${p} sakin kalıp topu güvenle kucakladı!`,
  ],
  punch: [
    (p) => `${p} güçlü yumrukla topu uzaklaştırdı!`,
    (p) => `${p} savunucularıyla birlikte yumrukla uzaklaştırdı!`,
    (p) => `${p} topu yumruklayarak ceza sahasını temizledi!`,
    (p) => `${p} büyük yumrukla tehlikeyi savuşturdu!`,
    (p) => `${p} güçlü yumruğuyla kalemi kurtardı!`,
  ],
  dive: [
    (p) => `${p} harika bir dalışla kurtardı!`,
    (p) => `${p} köşeye dalarak muhteşem kurtarış yaptı!`,
    (p) => `${p} son saniyede dalıp topu uzaklaştırdı!`,
    (p) => `${p} inanılmaz refleksle köşeye uzandı!`,
    (p) => `${p} fırlayıp topu parmaklarıyla uzaklaştırdı!`,
  ],
}

const MATCH_MINUTES = [5,12,18,24,31,38,42,47,54,60,67,74,80,86,90]
const ZONES = ['sol kanattan','orta sahadan','sağ kanattan','ceza sahasından']
const ACTION_TIMEOUT = 30 // saniye

function rollDice(min=1,max=20){ return Math.floor(Math.random()*(max-min+1))+min }

function getRandNarr(arr) {
  if (!arr || arr.length === 0) return () => ''
  return arr[Math.floor(Math.random() * arr.length)]
}

function calcPlayerStat(player, stat, tactics, playerRoles) {
  if (!player) return 50
  let base = player[stat] || 50
  if (tactics) {
    Object.entries(tactics).forEach(([tKey, tVal]) => {
      const cfg = TACTICS_CONFIG[tKey]
      const opt = cfg?.options.find(o => o.id === tVal)
      if (opt?.statBonus?.[stat]) base += opt.statBonus[stat]
    })
  }
  if (playerRoles && player.name && playerRoles[player.name]) {
    const bonus = PLAYER_ROLES_BONUS[playerRoles[player.name]]
    if (bonus?.[stat]) base += bonus[stat]
  }
  return Math.min(99, Math.max(1, base))
}

// Takım genel gücü
function calcTeamStrength(squad, tactics, roles) {
  if (!squad || squad.length === 0) return 70
  const players = squad.filter(Boolean)
  const base = players.reduce((s, p) => s + (p.overall || 70), 0) / Math.max(players.length, 1)
  let tacticBonus = 0
  if (tactics?.pressing === 'gegenpressing') tacticBonus += 3
  if (tactics?.buildup === 'counter') tacticBonus += 2
  return base + tacticBonus
}

export default function MatchPage() {
  const { matchId } = useParams()
  const navigate = useNavigate()
  const userId = getUserId()

  const [match, setMatch] = useState(null)
  const [lobby, setLobby] = useState(null)
  const [lobbyPlayers, setLobbyPlayers] = useState([])
  const [mySquad, setMySquad] = useState(null)
  const [opSquad, setOpSquad] = useState(null)
  const [myTactics, setMyTactics] = useState({})
  const [myRoles, setMyRoles] = useState({})
  const [opTactics, setOpTactics] = useState({})
  const [opRoles, setOpRoles] = useState({})

  const [homeScore, setHomeScore] = useState(0)
  const [awayScore, setAwayScore] = useState(0)
  const [matchMinute, setMatchMinute] = useState(0)
  const [isFinished, setIsFinished] = useState(false)

  const [commentary, setCommentary] = useState([])
  const [phase, setPhase] = useState('watching')
  const [currentEvent, setCurrentEvent] = useState(null)
  const [myRole, setMyRole] = useState(null)

  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [selectedAction, setSelectedAction] = useState(null)
  const [myActionSubmitted, setMyActionSubmitted] = useState(false)
  const [timeLeft, setTimeLeft] = useState(ACTION_TIMEOUT)

  const [lastResult, setLastResult] = useState(null)
  const [loading, setLoading] = useState(true)

  const [stats, setStats] = useState({
    home: { shots:0, shotsOnTarget:0, possession:50, passes:0, tackles:0, goals:0 },
    away: { shots:0, shotsOnTarget:0, possession:50, passes:0, tackles:0, goals:0 },
  })

  const commentaryRef = useRef(null)
  const channelRef = useRef(null)
  const matchRef = useRef(null)
  const engineRunning = useRef(false)
  const timerRef = useRef(null)
  const currentEventRef = useRef(null)
  const myRoleRef = useRef(null)
  const selectedPlayerRef = useRef(null)
  const selectedActionRef = useRef(null)

  useEffect(() => {
    init()
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [matchId])

  // Geri sayım
  useEffect(() => {
    if (phase === 'pick_attacker' || phase === 'pick_defender' || phase === 'pick_gk') {
      setTimeLeft(ACTION_TIMEOUT)
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current)
            // Süre doldu - otomatik hamle YAPMA, sadece bekle
            // Motor otomatik çözecek
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [phase])

  const init = async () => {
    const { data: m } = await supabase.from('matches').select('*').eq('id', matchId).maybeSingle()
    if (!m) return
    setMatch(m)
    matchRef.current = m
    setHomeScore(m.home_score || 0)
    setAwayScore(m.away_score || 0)
    if (m.status === 'finished') setIsFinished(true)

    const { data: lb } = await supabase.from('lobbies').select('*').eq('id', m.lobby_id).maybeSingle()
    setLobby(lb)

    const { data: pl } = await supabase.from('lobby_players').select('*').eq('lobby_id', m.lobby_id).order('joined_at')
    setLobbyPlayers(pl || [])

    const opId = m.home_user_id === userId ? m.away_user_id : m.home_user_id

    const { data: myS } = await supabase.from('squads').select('*').eq('lobby_id', m.lobby_id).eq('user_id', userId).maybeSingle()
    const { data: opS } = await supabase.from('squads').select('*').eq('lobby_id', m.lobby_id).eq('user_id', opId).maybeSingle()

    setMySquad(myS)
    setOpSquad(opS)
    setMyTactics(myS?.tactics || {})
    setMyRoles(myS?.player_roles || {})
    setOpTactics(opS?.tactics || {})
    setOpRoles(opS?.player_roles || {})

    setLoading(false)

    channelRef.current = supabase.channel('match-' + matchId)
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'match_events', filter:`match_id=eq.${matchId}` }, p => handleNewEvent(p.new, myS, opS, m))
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'match_events', filter:`match_id=eq.${matchId}` }, p => handleEventUpdate(p.new))
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'matches', filter:`id=eq.${matchId}` }, p => {
        const upd = p.new
        setHomeScore(upd.home_score || 0)
        setAwayScore(upd.away_score || 0)
        if (upd.status === 'finished') {
          setIsFinished(true)
          setPhase('watching')
          addCommentary('🏁 MAÇ SONA ERDİ!', 'goal')
          updateSeasonStats(upd, m.lobby_id, pl || [])
        }
      })
      .subscribe()

    const { data: pl2 } = await supabase.from('lobby_players').select('*').eq('lobby_id', m.lobby_id).order('joined_at')
    const isHost = (pl2 || []).find(p => p.user_id === userId)?.is_host
    const { data: existingEvents } = await supabase.from('match_events').select('id').eq('match_id', matchId).limit(1)

    if (isHost && (!existingEvents || existingEvents.length === 0) && m.status === 'active') {
      setTimeout(() => runMatchEngine(m, myS, opS, pl2 || []), 2000)
    } else {
      const { data: events } = await supabase.from('match_events').select('*').eq('match_id', matchId).order('created_at')
      if (events) {
        events.forEach(ev => {
          if (ev.narrative_text) addCommentary(ev.narrative_text, ev.event_type==='goal'?'goal':ev.event_type==='attack'?'attack':'normal')
        })
      }
    }
  }

  const updateSeasonStats = async (match, lobbyId, players) => {
    const hs = match.home_score || 0
    const as = match.away_score || 0
    const homeWin = hs > as, awayWin = as > hs, draw = hs === as
    for (const [uid, gf, ga, win, lose] of [
      [match.home_user_id, hs, as, homeWin, awayWin],
      [match.away_user_id, as, hs, awayWin, homeWin],
    ]) {
      const teamName = players.find(p => p.user_id === uid)?.team_name || ''
      const { data: ex } = await supabase.from('season_stats').select('*').eq('lobby_id', lobbyId).eq('user_id', uid).maybeSingle()
      const upd = {
        lobby_id: lobbyId, user_id: uid, team_name: teamName,
        played: (ex?.played||0)+1, wins: (ex?.wins||0)+(win?1:0),
        draws: (ex?.draws||0)+(draw?1:0), losses: (ex?.losses||0)+(lose?1:0),
        goals_for: (ex?.goals_for||0)+gf, goals_against: (ex?.goals_against||0)+ga,
        goal_diff: ((ex?.goals_for||0)+gf) - ((ex?.goals_against||0)+ga),
        points: (ex?.points||0)+(win?3:draw?1:0),
      }
      if (ex) await supabase.from('season_stats').update(upd).eq('id', ex.id)
      else await supabase.from('season_stats').insert(upd)
    }
  }

  const addCommentary = (text, type='normal') => {
    setCommentary(prev => {
      const updated = [...prev.slice(-40), { text, type, id: Date.now()+Math.random() }]
      setTimeout(() => { if (commentaryRef.current) commentaryRef.current.scrollTop = commentaryRef.current.scrollHeight }, 50)
      return updated
    })
  }

  const handleNewEvent = (ev, myS, opS, m) => {
    if (!ev) return
    setMatchMinute(ev.minute || 0)

    if (ev.event_type === 'narrative') {
      addCommentary(ev.narrative_text || '', 'normal')
      return
    }
    if (ev.event_type === 'goal') {
      addCommentary(`⚽ ${ev.narrative_text || 'GOL!'}`, 'goal')
      setStats(prev => {
        const isHome = ev.attacking_user === m?.home_user_id
        const s = isHome ? 'home' : 'away'
        return { ...prev, [s]: { ...prev[s], goals: (prev[s].goals||0)+1, shots: (prev[s].shots||0)+1, shotsOnTarget: (prev[s].shotsOnTarget||0)+1 }}
      })
      return
    }
    if (ev.event_type === 'attack') {
      addCommentary(`🔥 ${ev.narrative_text || ''}`, 'attack')
      setStats(prev => {
        const isHome = ev.attacking_user === m?.home_user_id
        const s = isHome ? 'home' : 'away'
        const d = isHome ? 'away' : 'home'
        const total = (prev.home.passes||0) + (prev.away.passes||0) + 1
        const homePasses = isHome ? (prev.home.passes||0)+1 : (prev.home.passes||0)
        return {
          home: { ...prev.home, passes: homePasses, possession: Math.round(homePasses/total*100), tackles: isHome ? prev.home.tackles : (prev.home.tackles||0)+1 },
          away: { ...prev.away, passes: isHome?(prev.away.passes||0):(prev.away.passes||0)+1, possession: 100-Math.round(homePasses/total*100), tackles: isHome?(prev.away.tackles||0)+1:prev.away.tackles },
        }
      })
      setCurrentEvent(ev)
      currentEventRef.current = ev
      setMyActionSubmitted(false)
      setSelectedPlayer(null)
      setSelectedAction(null)
      selectedPlayerRef.current = null
      selectedActionRef.current = null
      if (ev.attacking_user === userId) {
        setMyRole('attacker')
        myRoleRef.current = 'attacker'
        setPhase('pick_attacker')
      } else if (ev.defending_user === userId) {
        setMyRole('defender')
        myRoleRef.current = 'defender'
        setPhase('pick_defender')
      }
    }
    if (ev.event_type === 'shot') {
      addCommentary(`🥅 ${ev.narrative_text || 'Şut geliyor!'}`, 'attack')
      setStats(prev => {
        const isHome = ev.attacking_user === m?.home_user_id
        const s = isHome ? 'home' : 'away'
        return { ...prev, [s]: { ...prev[s], shots: (prev[s].shots||0)+1, shotsOnTarget: (prev[s].shotsOnTarget||0)+1 }}
      })
      if (ev.defending_user === userId) {
        setCurrentEvent(ev)
        currentEventRef.current = ev
        setMyActionSubmitted(false)
        setSelectedPlayer(null)
        setSelectedAction(null)
        setMyRole('goalkeeper')
        myRoleRef.current = 'goalkeeper'
        setPhase('pick_gk')
      }
    }
  }

  const handleEventUpdate = (ev) => {
    if (ev.action_phase === 'resolved') {
      setPhase('watching')
      if (timerRef.current) clearInterval(timerRef.current)
      setLastResult(ev)

      const resultMsgs = {
        goal:           '⚽ GOOOL! Muhteşem gol!',
        save:           '🧤 Kaleci kurtardı! İnanılmaz refleks!',
        attack_success: '✅ Atak başarılı, şuta geçildi!',
        attack_fail:    '❌ Savunma kesti, tehlike geçti!',
      }

      const detailMsg = ev.result ? `[Atak: ${ev.attacker_total} vs Savunma: ${ev.defender_total}]` : ''
      addCommentary(`${resultMsgs[ev.result] || '...'} ${detailMsg}`, ev.result==='goal'?'goal':'normal')
      setTimeout(() => setLastResult(null), 5000)
    }
  }

  const submitAction = async () => {
    if (!selectedPlayer || !selectedAction || !currentEvent || myActionSubmitted) return
    setMyActionSubmitted(true)
    setPhase('waiting')
    if (timerRef.current) clearInterval(timerRef.current)

    await supabase.from('match_actions').insert({
      match_id: matchId,
      event_id: currentEvent.id,
      user_id: userId,
      role: myRole,
      selected_player_id: selectedPlayer.id || selectedPlayer.name,
      action_choice: selectedAction.id,
    })

    const statVal = calcPlayerStat(selectedPlayer, selectedAction.stat, myTactics, myRoles)
    const roll = rollDice()
    const roleNarr = myRoles[selectedPlayer.name] ? PLAYER_ROLES_NARRATIVE[myRoles[selectedPlayer.name]] : null

    let narrativeFn
    if (myRole === 'attacker') narrativeFn = getRandNarr(ATK_NARRATIVES[selectedAction.id])
    else if (myRole === 'goalkeeper') narrativeFn = getRandNarr(GK_NARRATIVES[selectedAction.id])
    else narrativeFn = getRandNarr(DEF_NARRATIVES[selectedAction.id])

    const zone = currentEvent.zone || 'sol kanattan'
    const playerShortName = (selectedPlayer.name||'').split(' ').pop()
    const narrative = narrativeFn ? (myRole==='attacker' ? narrativeFn(playerShortName, zone) : narrativeFn(playerShortName)) : `${playerShortName} hamle yaptı`
    const fullNarr = roleNarr ? `${narrative} (${roleNarr})` : narrative
    addCommentary(`✅ ${fullNarr} — ${selectedAction.label} [${statVal}+${roll}=${statVal+roll}]`, 'normal')
  }

  // MAÇ MOTORU
  const runMatchEngine = async (m, myS, opS, players) => {
    if (engineRunning.current) return
    engineRunning.current = true

    const homeUser = players[0]
    const awayUser = players[1]
    if (!homeUser || !awayUser) return

    let currentHomeScore = 0
    let currentAwayScore = 0

    const homeTactics = myS?.tactics || {}
    const awayTactics = opS?.tactics || {}
    const homeRoles = myS?.player_roles || {}
    const awayRoles = opS?.player_roles || {}
    const homeLineup = myS?.lineup || []
    const awayLineup = opS?.lineup || []

    // Takım gücü hesapla
    const homeStrength = calcTeamStrength(homeLineup, homeTactics, homeRoles)
    const awayStrength = calcTeamStrength(awayLineup, awayTactics, awayRoles)
    const totalStrength = homeStrength + awayStrength

    // Giriş
    await insertEvent(m.id, 0, 'narrative', 'resolved', `Maç başlıyor! ${homeUser.team_name} sahaya çıkıyor. ${homeTactics.buildup ? TACTICS_NARRATIVE[homeTactics.buildup] : ''}`)
    await sleep(2000)
    await insertEvent(m.id, 0, 'narrative', 'resolved', `${awayUser.team_name} hazır. ${awayTactics.pressing ? TACTICS_NARRATIVE[awayTactics.pressing] : ''}`)

    for (let i = 0; i < MATCH_MINUTES.length; i++) {
      await sleep(5000)
      const minute = MATCH_MINUTES[i]

      const minuteNarrs = [
        `${minute}. dakikada mücadele kızışıyor!`,
        `${minute}. dakikada tempo artıyor!`,
        `${minute}. dakika, kritik bir an yaklaşıyor!`,
        `${minute}. dakikada sahada kıyasıya mücadele!`,
        `${minute}. dakikada oyun giderek ısınıyor!`,
      ]
      await insertEvent(m.id, minute, 'narrative', 'resolved', minuteNarrs[Math.floor(Math.random()*minuteNarrs.length)])
      await sleep(2000)

      // ATAK YÖNLENDİRME — takım gücüne göre ağırlıklı
      // Güçlü takım daha fazla atak yapar
      // Kontratak oynayan takım az ama tehlikeli atak yapar
      let homeAttackWeight = homeStrength / totalStrength

      // Taktik modifierleri
      if (homeTactics.buildup === 'counter') homeAttackWeight *= 0.75  // Kontratak: az atak, 2x tehlikeli
      if (awayTactics.pressing === 'gegenpressing') homeAttackWeight *= 0.85  // Rakip pres yaparsa ev sahibi zorlanır
      if (homeTactics.pressing === 'high_press') homeAttackWeight *= 1.1

      const attackingHome = Math.random() < homeAttackWeight
      const attackingUser = attackingHome ? homeUser.user_id : awayUser.user_id
      const defendingUser = attackingHome ? awayUser.user_id : homeUser.user_id
      const atkLineup = attackingHome ? homeLineup : awayLineup
      const defLineup = attackingHome ? awayLineup : homeLineup
      const atkTactics = attackingHome ? homeTactics : awayTactics
      const defTactics = attackingHome ? awayTactics : homeTactics
      const atkRoles = attackingHome ? homeRoles : awayRoles
      const defRoles = attackingHome ? awayRoles : homeRoles
      const atkTeam = attackingHome ? homeUser.team_name : awayUser.team_name
      const defTeam = attackingHome ? awayUser.team_name : homeUser.team_name

      // Atak oyuncusu — hücum oyuncularına öncelik
      const fwdPositions = ['ST','CF','LW','RW','LM','RM','CAM']
      const fwdPlayers = atkLineup.filter(p => fwdPositions.includes(p.squad_pos||p.position))
      const midPlayers = atkLineup.filter(p => ['CM','CDM'].includes(p.squad_pos||p.position))
      const atkPlayer = fwdPlayers.length > 0
        ? fwdPlayers[Math.floor(Math.random()*fwdPlayers.length)]
        : midPlayers.length > 0 ? midPlayers[Math.floor(Math.random()*midPlayers.length)]
        : atkLineup[Math.floor(Math.random()*atkLineup.length)]

      // Savunma oyuncusu — defans oyuncularına öncelik
      const defPositions = ['CB','LB','RB','CDM']
      const defPlayers = defLineup.filter(p => defPositions.includes(p.squad_pos||p.position))
      const defPlayer = defPlayers.length > 0
        ? defPlayers[Math.floor(Math.random()*defPlayers.length)]
        : defLineup[Math.floor(Math.random()*defLineup.length)]

      // Zone — taktiklere göre
      let zonePool = ZONES
      if (atkTactics.attack_width === 'wide') zonePool = ['sol kanattan','sağ kanattan','sol kanattan','sağ kanattan']
      else if (atkTactics.attack_width === 'central') zonePool = ['orta sahadan','ceza sahasından','orta sahadan']
      const zone = zonePool[Math.floor(Math.random()*zonePool.length)]

      const atkPlayerName = atkPlayer?.name || atkTeam
      const atkActionKeys = Object.keys(ATK_NARRATIVES)
      const atkNarrKey = atkActionKeys[Math.floor(Math.random()*atkActionKeys.length)]
      const narrativeFn = getRandNarr(ATK_NARRATIVES[atkNarrKey])
      const narrative = narrativeFn ? narrativeFn((atkPlayerName).split(' ').pop(), zone) : `${atkPlayerName} ${zone} geliyor!`

      const { data: attackEvent } = await supabase.from('match_events').insert({
        match_id: m.id, minute, event_type: 'attack',
        attacking_user: attackingUser, defending_user: defendingUser,
        zone, narrative_text: narrative, action_phase: 'pending',
      }).select().single()

      if (!attackEvent) continue

      // Kullanıcı hamlesi için 30 saniye bekle
      await sleep(ACTION_TIMEOUT * 1000)

      const { data: pendingCheck } = await supabase.from('match_events').select('action_phase').eq('id', attackEvent.id).maybeSingle()
      if (!pendingCheck || pendingCheck.action_phase !== 'pending') {
        await sleep(2000)
        continue
      }

      // Kullanıcı hamlelerini al
      const { data: actions } = await supabase.from('match_actions').select('*').eq('event_id', attackEvent.id)
      const atkAction = actions?.find(a => a.role === 'attacker')
      const defAction = actions?.find(a => a.role === 'defender')

      // STAT HESABI — gerçekçi karşılaştırma
      const atkStatKey = atkAction ? (ATK_ACTIONS.find(a=>a.id===atkAction.action_choice)?.stat || 'dribbling') : 'dribbling'
      const defStatKey = defAction ? (DEF_ACTIONS.find(a=>a.id===defAction.action_choice)?.stat || 'defending') : 'defending'

      // Oyuncuyu PLAYER_CARDS'tan bul (tam statslarla)
      const atkCardPlayer = PLAYER_CARDS.find(c=>c.name===atkPlayer?.name) || atkPlayer
      const defCardPlayer = PLAYER_CARDS.find(c=>c.name===defPlayer?.name) || defPlayer

      const atkStatVal = calcPlayerStat(atkCardPlayer, atkStatKey, atkTactics, atkRoles)
      const defStatVal = calcPlayerStat(defCardPlayer, defStatKey, defTactics, defRoles)

      // Zar at — stat farkı zar aralığını etkiler
      const atkRoll = rollDice(1, 20)
      const defRoll = rollDice(1, 20)
      const atkTotal = atkStatVal + atkRoll
      const defTotal = defStatVal + defRoll

      const atkWins = atkTotal > defTotal

      if (atkWins) {
        // ŞUT AŞAMASI
        const shootStat = calcPlayerStat(atkCardPlayer, 'shooting', atkTactics, atkRoles)
        const gkPlayer = defLineup.find(p => p.position==='GK' || p.squad_pos==='GK')
        const gkCardPlayer = PLAYER_CARDS.find(c=>c.name===gkPlayer?.name) || gkPlayer
        const gkStat = calcPlayerStat(gkCardPlayer, 'goalkeeper', defTactics, defRoles)

        // GK hamlesi var mı?
        const gkAction = actions?.find(a => a.role === 'goalkeeper')
        const gkActionBonus = gkAction ? 5 : 0

        const shootRoll = rollDice(1, 20)
        const gkRoll = rollDice(1, 20)
        const shootTotal = shootStat + shootRoll
        const gkTotal = gkStat + gkRoll + gkActionBonus

        const shotNarrFn = getRandNarr(ATK_NARRATIVES.shot)
        const shotNarr = shotNarrFn ? shotNarrFn((atkPlayerName).split(' ').pop(), 'ceza sahasından') : `${(atkPlayerName).split(' ').pop()} şut çekti!`

        await insertEvent(m.id, minute, 'shot', 'resolved', shotNarr, attackingUser, defendingUser)
        await sleep(2000)

        // Kontratak güçlendirmesi — kontratak oynayan ataklardan %15 daha fazla faydalanır
        const counterBonus = atkTactics.buildup === 'counter' ? 3 : 0
        const isGoal = (shootTotal + counterBonus) > gkTotal

        if (isGoal) {
          if (attackingHome) currentHomeScore++
          else currentAwayScore++

          await supabase.from('matches').update({ home_score: currentHomeScore, away_score: currentAwayScore }).eq('id', m.id)

          const goalNarrs = [
            `⚽ GOOOL! ${(atkPlayerName).split(' ').pop()} attı! ${atkTeam} öne geçiyor! (Şut: ${shootTotal} vs Kaleci: ${gkTotal})`,
            `⚽ GOOOL! Muhteşem! ${(atkPlayerName).split(' ').pop()} tarihe geçiyor! Skor: ${attackingHome?currentHomeScore:currentAwayScore}-${attackingHome?currentAwayScore:currentHomeScore}`,
            `⚽ GOOOL! ${atkTeam} fırsatı değerlendirdi! ${(atkPlayerName).split(' ').pop()} imzasını attı!`,
          ]
          await insertEvent(m.id, minute, 'goal', 'resolved', goalNarrs[Math.floor(Math.random()*goalNarrs.length)], attackingUser, defendingUser)
          await supabase.from('match_events').update({
            action_phase:'resolved', result:'goal',
            attacker_total: atkTotal, defender_total: defTotal,
            attacker_roll: atkRoll, defender_roll: defRoll,
          }).eq('id', attackEvent.id)
        } else {
          const saveNarrFn = getRandNarr(GK_NARRATIVES.dive)
          const saveNarr = saveNarrFn ? saveNarrFn((gkPlayer?.name||'Kaleci').split(' ').pop()) : 'Kaleci kurtardı!'
          await supabase.from('match_events').update({
            action_phase:'resolved', result:'save',
            attacker_total: atkTotal, defender_total: defTotal,
            attacker_roll: atkRoll, defender_roll: defRoll,
            narrative_text: `${saveNarr} (Şut: ${shootTotal} vs Kaleci: ${gkTotal})`,
          }).eq('id', attackEvent.id)
        }
      } else {
        // SAVUNMA KAZANDI
        const defNarrFn = getRandNarr(DEF_NARRATIVES.tackle)
        const defNarr = defNarrFn ? defNarrFn((defPlayer?.name||'Savunma').split(' ').pop()) : 'Savunma kesti!'
        await supabase.from('match_events').update({
          action_phase:'resolved', result:'attack_fail',
          attacker_total: atkTotal, defender_total: defTotal,
          attacker_roll: atkRoll, defender_roll: defRoll,
          narrative_text: `${defNarr} (Atak: ${atkTotal} vs Savunma: ${defTotal})`,
        }).eq('id', attackEvent.id)
      }

      await sleep(3000)
    }

    // Maç sonu
    const winner = currentHomeScore > currentAwayScore ? homeUser.team_name : currentAwayScore > currentHomeScore ? awayUser.team_name : null
    const finalNarr = winner
      ? `Düdük çalıyor! ${winner} ${Math.abs(currentHomeScore-currentAwayScore)} fark atarak galip geldi! Final: ${currentHomeScore}-${currentAwayScore}`
      : `Düdük çalıyor! Beraberlik! Her iki takım da 1'er puan alıyor. Final: ${currentHomeScore}-${currentAwayScore}`

    await insertEvent(m.id, 90, 'narrative', 'resolved', finalNarr)
    await supabase.from('matches').update({ status:'finished' }).eq('id', m.id)
    engineRunning.current = false
  }

  async function insertEvent(matchId, minute, type, phase, narrative, atkUser=null, defUser=null) {
    return await supabase.from('match_events').insert({
      match_id: matchId, minute, event_type: type, action_phase: phase,
      narrative_text: narrative,
      attacking_user: atkUser, defending_user: defUser,
    }).select().single()
  }

  function sleep(ms){ return new Promise(r => setTimeout(r, ms)) }

  const myTeam = lobbyPlayers.find(p => p.user_id === userId)
  const opTeam = lobbyPlayers.find(p => p.user_id !== userId)
  const isHome = match?.home_user_id === userId

  const myLineup = mySquad?.lineup || []
  const attackerCandidates = myLineup.filter(p => ['ST','CF','LW','RW','LM','RM','CAM','CM'].includes(p.squad_pos||p.position))
  const defenderCandidates = myLineup.filter(p => ['CB','LB','RB','CDM','CM'].includes(p.squad_pos||p.position))
  const gkCandidates = myLineup.filter(p => (p.position==='GK'||p.squad_pos==='GK'))

  const actionsToShow = phase==='pick_attacker' ? ATK_ACTIONS : phase==='pick_gk' ? GK_ACTIONS : DEF_ACTIONS
  const playersToShow = phase==='pick_attacker' ? attackerCandidates : phase==='pick_gk' ? gkCandidates : defenderCandidates

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#0a0a1a', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ color:'#a0a0c0' }}>Maç yükleniyor...</div>
    </div>
  )

  return (
    <div style={{ height:'100vh', background:'#0a0a1a', display:'flex', flexDirection:'column', overflow:'hidden' }}>

      {/* SKOR */}
      <div style={{ background:'#0f0f2a', borderBottom:'1px solid #1e1e4a', padding:'.6rem 1.5rem', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div style={{ flex:1, textAlign:'center' }}>
          <div style={{ fontWeight:800, fontSize:'.88rem' }}>{isHome?'🏠 ':''}{myTeam?.team_name}</div>
          <div style={{ fontSize:'.62rem', color:'#606080' }}>{mySquad?.formation||'?'}</div>
        </div>
        <div style={{ textAlign:'center', padding:'0 1.5rem' }}>
          <div style={{ fontSize:'2.5rem', fontWeight:900, letterSpacing:'.1em', lineHeight:1 }}>
            <span style={{ color:isHome&&homeScore>awayScore?'#10b981':'#fff' }}>{homeScore}</span>
            <span style={{ color:'#606080', margin:'0 .3rem' }}>-</span>
            <span style={{ color:!isHome&&awayScore>homeScore?'#10b981':'#fff' }}>{awayScore}</span>
          </div>
          <div style={{ color:isFinished?'#fbbf24':'#606080', fontSize:'.7rem', fontWeight:600 }}>
            {isFinished ? '⏱ MAÇ BİTTİ' : `⏱ ${matchMinute}'`}
          </div>
        </div>
        <div style={{ flex:1, textAlign:'center' }}>
          <div style={{ fontWeight:800, fontSize:'.88rem' }}>{!isHome?'🏠 ':''}{opTeam?.team_name}</div>
          <div style={{ fontSize:'.62rem', color:'#606080' }}>{opSquad?.formation||'?'}</div>
        </div>
      </div>

      <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 300px', overflow:'hidden' }}>

        {/* SOL */}
        <div style={{ display:'flex', flexDirection:'column', overflow:'hidden', borderRight:'1px solid #1e1e4a' }}>

          {/* Hamle paneli */}
          {(phase==='pick_attacker'||phase==='pick_defender'||phase==='pick_gk') && (
            <div style={{ background:phase==='pick_attacker'?'rgba(239,68,68,.15)':'rgba(59,130,246,.15)', borderBottom:`2px solid ${phase==='pick_attacker'?'#ef4444':'#3b82f6'}`, padding:'.75rem 1rem', flexShrink:0 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'.6rem' }}>
                <div style={{ fontWeight:800, fontSize:'.88rem', color:phase==='pick_attacker'?'#f87171':'#60a5fa' }}>
                  {phase==='pick_attacker'?'⚡ ATAK HAMLESİ':phase==='pick_gk'?'🧤 KALECİ HAMLESİ':'🛡️ SAVUNMA HAMLESİ'}
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
                  <div style={{ width:28, height:28, borderRadius:'50%', background: timeLeft>10?'rgba(16,185,129,.2)':'rgba(239,68,68,.2)', border:`2px solid ${timeLeft>10?'#10b981':'#ef4444'}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.75rem', fontWeight:800, color:timeLeft>10?'#10b981':'#ef4444' }}>
                    {timeLeft}
                  </div>
                  <span style={{ fontSize:'.68rem', color:'#606080' }}>saniye</span>
                </div>
              </div>

              {/* Oyuncu seç */}
              <div style={{ marginBottom:'.5rem' }}>
                <div style={{ fontSize:'.6rem', color:'#606080', fontWeight:700, letterSpacing:'.06em', marginBottom:'.3rem' }}>OYUNCU SEÇ</div>
                <div style={{ display:'flex', gap:'.35rem', overflowX:'auto', paddingBottom:'.2rem' }}>
                  {playersToShow.map((p, i) => {
                    const card = PLAYER_CARDS.find(c=>c.name===p.name) || p
                    const isSelected = selectedPlayer?.name===p.name
                    return (
                      <div key={i} onClick={() => { setSelectedPlayer(card); selectedPlayerRef.current = card }}
                        style={{ flexShrink:0, background:isSelected?'rgba(124,58,237,.3)':'#12122a', border:`1.5px solid ${isSelected?'#a78bfa':'#2a2a5a'}`, borderRadius:7, padding:'.35rem .5rem', cursor:'pointer', minWidth:64, textAlign:'center', transition:'all .1s' }}>
                        <div style={{ fontSize:'.82rem', fontWeight:900, color:'#fbbf24' }}>{card.overall}</div>
                        <div style={{ fontSize:'.58rem', fontWeight:700, color:'#fff', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:62 }}>{(p.name||'').split(' ').pop()}</div>
                        <div style={{ fontSize:'.52rem', color:'#606080' }}>{p.squad_pos||p.position}</div>
                        {myRoles[p.name] && <div style={{ fontSize:'.46rem', color:'#a78bfa' }}>{myRoles[p.name]}</div>}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Hamle seç */}
              <div style={{ marginBottom:'.6rem' }}>
                <div style={{ fontSize:'.6rem', color:'#606080', fontWeight:700, letterSpacing:'.06em', marginBottom:'.3rem' }}>HAMLEYİ SEÇ</div>
                <div style={{ display:'flex', gap:'.35rem', flexWrap:'wrap' }}>
                  {actionsToShow.map(action => {
                    const isSelected = selectedAction?.id===action.id
                    const statVal = selectedPlayer ? calcPlayerStat(selectedPlayer, action.stat, myTactics, myRoles) : '?'
                    return (
                      <button key={action.id} onClick={() => { setSelectedAction(action); selectedActionRef.current = action }}
                        style={{ padding:'.35rem .65rem', borderRadius:7, border:`1.5px solid ${isSelected?'#a78bfa':'#2a2a5a'}`, background:isSelected?'rgba(124,58,237,.25)':'#12122a', color:isSelected?'#a78bfa':'#a0a0c0', fontWeight:700, fontSize:'.75rem', cursor:'pointer', display:'flex', alignItems:'center', gap:'.3rem' }}>
                        <span>{action.emoji}</span><span>{action.label}</span>
                        {selectedPlayer && <span style={{ color:'#fbbf24', fontSize:'.65rem' }}>[{statVal}]</span>}
                      </button>
                    )
                  })}
                </div>
              </div>

              <button onClick={submitAction} disabled={!selectedPlayer||!selectedAction}
                style={{ padding:'.5rem 1.25rem', borderRadius:8, border:'none', background:selectedPlayer&&selectedAction?'#7c3aed':'#1e1e4a', color:selectedPlayer&&selectedAction?'#fff':'#606080', fontWeight:800, fontSize:'.85rem', cursor:selectedPlayer&&selectedAction?'pointer':'not-allowed', transition:'all .2s' }}>
                HAMLE GÖNDER →
              </button>
            </div>
          )}

          {phase==='waiting' && (
            <div style={{ background:'rgba(16,185,129,.1)', borderBottom:'2px solid #10b981', padding:'.6rem 1rem', flexShrink:0, display:'flex', alignItems:'center', gap:'.75rem' }}>
              <div style={{ fontSize:'1.1rem' }}>⏳</div>
              <div>
                <div style={{ fontWeight:700, color:'#10b981', fontSize:'.85rem' }}>Hamlen gönderildi!</div>
                <div style={{ color:'#606080', fontSize:'.72rem' }}>{selectedPlayer?.name} → {selectedAction?.label}</div>
              </div>
            </div>
          )}

          {lastResult && (
            <div style={{ background:lastResult.result==='goal'?'rgba(251,191,36,.15)':'rgba(124,58,237,.1)', borderBottom:`2px solid ${lastResult.result==='goal'?'#fbbf24':'#7c3aed'}`, padding:'.6rem 1rem', flexShrink:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:'.75rem' }}>
                <div style={{ fontSize:'1.8rem' }}>{lastResult.result==='goal'?'⚽':lastResult.result==='save'?'🧤':lastResult.result==='attack_fail'?'❌':'✅'}</div>
                <div>
                  <div style={{ fontWeight:800, color:lastResult.result==='goal'?'#fbbf24':'#a78bfa', fontSize:'.9rem' }}>
                    {lastResult.result==='goal'?'GOOOL!':lastResult.result==='save'?'Kurtarış!':lastResult.result==='attack_fail'?'Savunma Kesti!':'Atak Başarılı!'}
                  </div>
                  {lastResult.attacker_total && (
                    <div style={{ color:'#606080', fontSize:'.72rem' }}>
                      Atak {lastResult.attacker_total} (stat+zar) vs Savunma {lastResult.defender_total} (stat+zar)
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* İstatistikler */}
          <div style={{ flex:1, overflowY:'auto', padding:'1rem' }}>
            <div style={{ fontSize:'.62rem', color:'#606080', fontWeight:700, letterSpacing:'.08em', marginBottom:'.75rem' }}>MAÇ İSTATİSTİKLERİ</div>
            {[
              ['Topla Oynama', `${stats.home.possession}%`, `${stats.away.possession}%`, stats.home.possession, stats.away.possession],
              ['Şutlar', stats.home.shots, stats.away.shots, stats.home.shots, stats.away.shots],
              ['İsabetli Şutlar', stats.home.shotsOnTarget, stats.away.shotsOnTarget, stats.home.shotsOnTarget, stats.away.shotsOnTarget],
              ['Paslar', stats.home.passes, stats.away.passes, stats.home.passes, stats.away.passes],
              ['Top Kapma', stats.home.tackles, stats.away.tackles, stats.home.tackles, stats.away.tackles],
              ['Goller', homeScore, awayScore, homeScore, awayScore],
            ].map(([label, homeVal, awayVal, homeNum, awayNum]) => {
              const total = (Number(homeNum)||0) + (Number(awayNum)||0) || 1
              const homeW = Math.round((Number(homeNum)||0)/total*100)
              return (
                <div key={label} style={{ marginBottom:'.9rem' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'.3rem', fontSize:'.82rem' }}>
                    <span style={{ fontWeight:700, color:isHome&&homeNum>awayNum?'#10b981':'#fff' }}>{homeVal}</span>
                    <span style={{ color:'#606080', fontSize:'.7rem' }}>{label}</span>
                    <span style={{ fontWeight:700, color:!isHome&&awayNum>homeNum?'#10b981':'#fff' }}>{awayVal}</span>
                  </div>
                  <div style={{ height:4, background:'#1e1e4a', borderRadius:2, overflow:'hidden', display:'flex' }}>
                    <div style={{ width:`${homeW}%`, background:isHome?'#7c3aed':'#2a2a5a', transition:'width .5s' }}/>
                    <div style={{ flex:1, background:!isHome?'#7c3aed':'#2a2a5a' }}/>
                  </div>
                </div>
              )
            })}

            {isFinished && (
              <div style={{ marginTop:'1.5rem', textAlign:'center', background:'rgba(124,58,237,.1)', borderRadius:12, padding:'1.25rem', border:'1px solid #7c3aed' }}>
                <div style={{ fontSize:'1.4rem', fontWeight:900, marginBottom:'.4rem', color:
                  (isHome&&homeScore>awayScore)||(!isHome&&awayScore>homeScore)?'#fbbf24':'#a0a0c0' }}>
                  {homeScore>awayScore?(isHome?'🏆 KAZANDIN!':'😔 Kaybettin'):
                   awayScore>homeScore?(isHome?'😔 Kaybettin':'🏆 KAZANDIN!'):'🤝 Beraberlik!'}
                </div>
                <div style={{ fontSize:'2rem', fontWeight:900, marginBottom:'1rem' }}>{homeScore} - {awayScore}</div>
                <button onClick={() => navigate(`/game/${lobby?.code}`)}
                  style={{ padding:'.65rem 1.5rem', borderRadius:9, border:'none', background:'#7c3aed', color:'#fff', fontWeight:700, cursor:'pointer', fontSize:'.88rem' }}>
                  Ana Menüye Dön
                </button>
              </div>
            )}
          </div>
        </div>

        {/* SAĞ: Spiker */}
        <div style={{ display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ padding:'.65rem 1rem', borderBottom:'1px solid #1e1e4a', flexShrink:0, background:'#0f0f2a' }}>
            <div style={{ fontWeight:800, fontSize:'.85rem' }}>📺 Spiker</div>
            <div style={{ color:'#606080', fontSize:'.65rem' }}>Canlı maç anlatısı</div>
          </div>

          <div ref={commentaryRef} style={{ flex:1, overflowY:'auto', padding:'.6rem', display:'flex', flexDirection:'column', gap:'.35rem' }}>
            {commentary.length===0 && (
              <div style={{ color:'#606080', fontSize:'.82rem', textAlign:'center', marginTop:'2rem' }}>Maç başlıyor...</div>
            )}
            {commentary.map(c => (
              <div key={c.id} style={{ padding:'.45rem .65rem', borderRadius:6, fontSize:'.8rem', lineHeight:1.4,
                background:c.type==='goal'?'rgba(251,191,36,.12)':c.type==='attack'?'rgba(239,68,68,.08)':'rgba(255,255,255,.03)',
                borderLeft:`3px solid ${c.type==='goal'?'#fbbf24':c.type==='attack'?'#ef4444':'#2a2a5a'}`,
                color:c.type==='goal'?'#fbbf24':'#e0e0e0', fontWeight:c.type==='goal'?700:400,
              }}>
                {c.text}
              </div>
            ))}
          </div>

          <div style={{ padding:'.6rem', borderTop:'1px solid #1e1e4a', flexShrink:0, background:'#0a0a1a' }}>
            <div style={{ fontSize:'.58rem', color:'#606080', fontWeight:700, letterSpacing:'.06em', marginBottom:'.3rem' }}>AKTİF TAKTİK</div>
            <div style={{ fontSize:'.7rem', color:'#a78bfa', fontWeight:600, lineHeight:1.4 }}>
              {myTactics.pressing ? TACTICS_NARRATIVE[myTactics.pressing] : 'Taktik belirsiz'}
              {myTactics.buildup ? ` • ${TACTICS_NARRATIVE[myTactics.buildup]}` : ''}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
