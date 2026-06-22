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

// Her aksiyon için hangi stat kullanılır ve karşı stat
const ATK_ACTION_DEFS = {
  shot:    { atkStat:'shooting',  defStat:'defending', defBonus:0,  narrative:'şut çekti' },
  dribble: { atkStat:'dribbling', defStat:'defending', defBonus:0,  narrative:'çalım attı' },
  cross:   { atkStat:'passing',   defStat:'defending', defBonus:-3, narrative:'orta yaptı' },
  pass:    { atkStat:'passing',   defStat:'defending', defBonus:-5, narrative:'pas verdi' },
  sprint:  { atkStat:'pace',      defStat:'pace',      defBonus:0,  narrative:'hız yaptı' },
}

const DEF_ACTION_DEFS = {
  block:    { statBonus:10, narrative:'önüne geçti' },
  tackle:   { statBonus:5,  narrative:'müdahale etti' },
  position: { statBonus:7,  narrative:'pozisyon aldı' },
  press:    { statBonus:8,  narrative:'baskı yaptı', stat:'physical' },
  let:      { statBonus:-15, narrative:'geçmesine izin verdi' },
}

const GK_ACTION_DEFS = {
  dive:   { statBonus:8,  narrative:'daldı' },
  catch:  { statBonus:5,  narrative:'tutmaya çalıştı' },
  corner: { statBonus:3,  narrative:'köşeye attı' },
  punch:  { statBonus:6,  narrative:'yumrukladı' },
}

const ATK_ACTIONS = [
  { id:'shot',    label:'Şut Çek',  emoji:'⚡', desc:'Direkt şuta geç' },
  { id:'dribble', label:'Çalım At', emoji:'🔥', desc:'Savunmacıyı geç' },
  { id:'cross',   label:'Orta Yap', emoji:'📐', desc:'Ortaya çık' },
  { id:'pass',    label:'Pas Ver',  emoji:'↗️', desc:'Pas oyunu kur' },
  { id:'sprint',  label:'Hızlan',   emoji:'💨', desc:'Hız farkı yarat' },
]
const DEF_ACTIONS = [
  { id:'block',    label:'Önüne Geç',   emoji:'🛡️', desc:'+10 savunma' },
  { id:'tackle',   label:'Müdahale',    emoji:'⚔️', desc:'+5 savunma' },
  { id:'position', label:'Pozisyon Al', emoji:'📍', desc:'+7 savunma' },
  { id:'press',    label:'Baskı Yap',   emoji:'💪', desc:'+8 fizik' },
  { id:'let',      label:'Geç Gitsin',  emoji:'🏃', desc:'-15 savunma' },
]
const GK_ACTIONS = [
  { id:'dive',   label:'Dal',       emoji:'🤸', desc:'+8 kaleci' },
  { id:'catch',  label:'Tut',       emoji:'🧤', desc:'+5 kaleci' },
  { id:'corner', label:'Köşeye At', emoji:'🥅', desc:'+3 kaleci' },
  { id:'punch',  label:'Yumrukla',  emoji:'👊', desc:'+6 fizik' },
]

// 70+ Spiker anlatımı
const ATK_NARR = {
  shot: [
    (p,z,diff) => diff>15?`${p} ${z} MUHTEŞEM bir şut çekti, savunma çaresiz kaldı!`:`${p} ${z} güçlü bir şut denedi!`,
    (p,z,diff) => diff>10?`${p} ani dönerek kalecinin köşesini hedef aldı!`:`${p} ${z} sert bir vuruş denedi!`,
    (p,z) => `${p} ceza sahasının dışından uzaktan vurdu!`,
    (p,z) => `${p} vollede topu ağlara göndermeye çalıştı!`,
    (p,z) => `${p} kafa vuruşuyla kaleyi hedef aldı!`,
    (p,z) => `${p} bilek hareketiyle kalecinin altını hedef aldı!`,
    (p,z) => `${p} sağ ayak dışıyla şaşırtan bir şut çekti!`,
    (p,z) => `${p} pivot yaparak ani dönüşle şut çekti!`,
    (p,z) => `${p} ${z} frenk vuruşu denedi!`,
    (p,z) => `${p} ilk temaşta şut çekti, kaleci hazırlıksız!`,
  ],
  dribble: [
    (p,z,diff) => diff>15?`${p} ${z} OLAĞANÜSTÜ bir çalımla savunmacıyı tarihe gömdü!`:`${p} ${z} harika bir çalımla savunmacıyı geçti!`,
    (p,z,diff) => diff>10?`${p} elastico hareketiyle savunmacıyı tamamen alt etti!`:`${p} ${z} çalım atarak geçmeye çalıştı!`,
    (p,z) => `${p} hızlı ayak hareketleriyle rakibini geride bıraktı!`,
    (p,z) => `${p} topla dans ederek iki savunmacıyı geçti!`,
    (p,z) => `${p} ${z} ani duraklamayla savunmacıyı şaşırttı!`,
    (p,z) => `${p} sırt dönük topla rakibini mağlup etti!`,
    (p,z) => `${p} ${z} tek iki yaparak içe girdi!`,
    (p,z) => `${p} defans duvarını yıkarak hücuma devam etti!`,
    (p,z) => `${p} ${z} finta yapıp rakibini geride bıraktı!`,
    (p,z) => `${p} arka topukla şaşırtan bir hareketle geçti!`,
  ],
  cross: [
    (p,z,diff) => diff>15?`${p} ${z} CESARETİ TAM orta yaptı, savunma çözüldü!`:`${p} ${z} tehlikeli bir orta yaptı!`,
    (p,z) => `${p} hızlı çıkışın ardından ölüm ortası yaptı!`,
    (p,z) => `${p} ${z} savunmanın arkasına sertçe orta attı!`,
    (p,z) => `${p} geri orta yaparak ceza sahasına çekti!`,
    (p,z) => `${p} ${z} hava topuna yönelik yüksek orta attı!`,
    (p,z) => `${p} kalecinin önünden geçen ölümcül orta!`,
    (p,z) => `${p} ikinci direğe yönelik kesin orta attı!`,
    (p,z) => `${p} savunmanın arkasını bulan mükemmel orta!`,
    (p,z) => `${p} santrfor için biçilmiş orta gönderdi!`,
    (p,z) => `${p} ${z} kısa köşe kombinasyonundan orta yaptı!`,
  ],
  pass: [
    (p,z,diff) => diff>15?`${p} NEFES KESEN bir pas verdi, savunma dağıldı!`:`${p} ${z} boşlukta koşan arkadaşını buldu!`,
    (p,z) => `${p} derinlemesine nefis bir pas verdi!`,
    (p,z) => `${p} ${z} defansın arkasına uzun top gönderdi!`,
    (p,z) => `${p} rakip presinin altından çıkan mükemmel pas!`,
    (p,z) => `${p} topuğuyla harika bir pas verdi!`,
    (p,z) => `${p} baskı altında sakin kalıp doğru pasını verdi!`,
    (p,z) => `${p} savunmayı yarıp geçen harika bir pas attı!`,
    (p,z) => `${p} üçgen kombinasyonuyla savunmayı geçti!`,
    (p,z) => `${p} rakip bloğunun arasından pas sızdırdı!`,
    (p,z) => `${p} ileriye doğru yaptığı pas pozisyon yarattı!`,
  ],
  sprint: [
    (p,z,diff) => diff>15?`${p} ROCKET GİBİ fırladı, savunma eridi!`:`${p} ${z} defans hattının arkasına koştu!`,
    (p,z) => `${p} inanılmaz bir hızla boş alana girdi!`,
    (p,z) => `${p} ${z} ofside düşmeden hız yaptı!`,
    (p,z) => `${p} savunmacıyı geride bırakarak koşmaya devam etti!`,
    (p,z) => `${p} uzun koşunun ardından pozisyon aldı!`,
    (p,z) => `${p} ani hızlanmayla defans hattını geçti!`,
    (p,z) => `${p} kontratak pozisyonunda tek başına kaldı!`,
    (p,z) => `${p} boş kanatta tek başına koştu!`,
    (p,z) => `${p} hız patlamasıyla tüm savunmayı geçti!`,
    (p,z) => `${p} rocket gibi fırlayarak boşluğa daldı!`,
  ],
}

const DEF_NARR = {
  block: [
    (p,diff) => diff>15?`${p} MÜKEMMELİYET! Vücudunu siper ederek şutu tamamen engelledi!`:`${p} harika pozisyonla şutu engelledi!`,
    (p) => `${p} son anda önüne geçerek topu uzaklaştırdı!`,
    (p) => `${p} kritik anda devreye girerek engel oldu!`,
    (p) => `${p} mükemmel zamanlama ile bloğunu koydu!`,
    (p) => `${p} çift bacakla şutu önledi!`,
    (p) => `${p} son adımda topu çizgi üzerinde kurtardı!`,
    (p) => `${p} vücuduyla koridor kapattı!`,
  ],
  tackle: [
    (p,diff) => diff>15?`${p} MUHTEŞEMDİ! Topu tamamen söküp aldı!`:`${p} sert müdahaleyle topu rakibinden aldı!`,
    (p) => `${p} temiz müdahaleyle topu kazandı!`,
    (p) => `${p} zamanlı kayışla topu kapıverdi!`,
    (p) => `${p} kayan müdahaleyle topu uzaklaştırdı!`,
    (p) => `${p} arkadan gelip topu kaptı!`,
    (p) => `${p} son anda topu rakibinden söküp aldı!`,
  ],
  position: [
    (p,diff) => diff>15?`${p} TAKTİK DAHİSİ! Mükemmel pozisyonla atağı tamamen kapattı!`:`${p} iyi pozisyon alarak tehlikeyi önledi!`,
    (p) => `${p} kapanarak rakibin rotasını kesti!`,
    (p) => `${p} koridor kapayarak rakibini sıkıştırdı!`,
    (p) => `${p} defans arkasını kapatarak ofsayt tuzağı kurdu!`,
    (p) => `${p} konsantrasyonla boşluğu kapattı!`,
    (p) => `${p} akıllıca geri çekilerek topu bekledi!`,
  ],
  press: [
    (p,diff) => diff>15?`${p} AMANSIZ BASKIYLA rakibini tamamen bunalttı!`:`${p} sürekli baskıyla rakibini bunalttı!`,
    (p) => `${p} yüksek pres uygulamasıyla rakibin hatasını provoke etti!`,
    (p) => `${p} amansız baskıyla rakibi pas atmak zorunda bıraktı!`,
    (p) => `${p} ekibiyle koordineli pres yaparak topu çaldı!`,
    (p) => `${p} baskısıyla rakibi uzun topa zorladı!`,
  ],
  let: [
    (p) => `${p} geçmesine izin verdi, tehlike kapıda!`,
    (p) => `${p} dengesini kaybetti, rakip geçti!`,
    (p) => `${p} müdahale edemedi, atak devam ediyor!`,
    (p) => `${p} savunmada boşluk bıraktı!`,
  ],
}

const GK_NARR = {
  dive: [
    (p,diff) => diff>15?`${p} İNANILMAZ KURTULUŞ! Köşeye fırlayarak gole izin vermedi!`:`${p} harika bir dalışla kurtardı!`,
    (p) => `${p} son saniyede dalıp topu uzaklaştırdı!`,
    (p) => `${p} inanılmaz refleksle köşeye uzandı!`,
    (p) => `${p} fırlayıp topu parmaklarıyla uzaklaştırdı!`,
  ],
  catch: [
    (p,diff) => diff>15?`${p} OLAĞANÜSTÜ! Topu tereyağı gibi kucakladı!`:`${p} topu emin ellerde kavradı!`,
    (p) => `${p} güçlü elleriyle topu tuttu!`,
    (p) => `${p} konsantrasyonunu kaybetmeden yakaladı!`,
    (p) => `${p} sakin kalıp topu güvenle kucakladı!`,
  ],
  corner: [
    (p) => `${p} topu güvenle köşeye attı!`,
    (p) => `${p} refleksiyle topu köşeye yönlendirdi!`,
    (p) => `${p} zor açıdan topu köşeye savuşturdu!`,
  ],
  punch: [
    (p,diff) => diff>15?`${p} GELDİ VE YUMRUKLADI! Top nereye gitti bilinmez!`:`${p} güçlü yumrukla topu uzaklaştırdı!`,
    (p) => `${p} topu yumruklayarak ceza sahasını temizledi!`,
    (p) => `${p} güçlü yumruğuyla kalemi kurtardı!`,
  ],
}

const GOAL_NARR = [
  (p,score) => `⚽ GOOOOL! ${p} tarihi bir an yaşattı! Skor: ${score}`,
  (p,score) => `⚽ GOOOOL! ${p} harika bir bitirişle fileleri havalandırdı! ${score}`,
  (p,score) => `⚽ GOOOOL! Muhteşem! ${p} imzasını attı! ${score}`,
  (p,score) => `⚽ GOOOOL! ${p} durdurulamadı! ${score}`,
  (p,score) => `⚽ GOOOOL! ${p} bunu hak etti! ${score}`,
]

const MISS_NARR = [
  (p) => `😤 ${p} az kaldı! Top direkten döndü!`,
  (p) => `😤 Kurtarış! Ama ${p} çok yaklaşmıştı!`,
  (p) => `😤 ${p} gol diye bağırdı ama top dışarı!`,
  (p) => `😤 Üst direkten geri döndü! ${p} şanssız!`,
]

const MATCH_MINUTES = [5,12,18,24,31,38,42,47,54,60,67,74,80,86,90]
const ZONES = ['sol kanattan','orta sahadan','sağ kanattan','ceza sahasından']
const ACTION_TIMEOUT = 30

function rollDice(min=1,max=20){ return Math.floor(Math.random()*(max-min+1))+min }
function getRand(arr){ return arr[Math.floor(Math.random()*arr.length)] }

function getStaminaPenalty(stamina) {
  if (stamina >= 80) return 0
  if (stamina >= 60) return 3
  if (stamina >= 40) return 6
  if (stamina >= 20) return 10
  return 15
}

function calcPlayerStat(player, stat, tactics, playerRoles, stamina=100) {
  if (!player) return 50
  let base = player[stat] || 50
  if (tactics) {
    Object.entries(tactics).forEach(([tKey, tVal]) => {
      const cfg = TACTICS_CONFIG[tKey]
      const opt = cfg?.options.find(o => o.id === tVal)
      if (opt?.statBonus?.[stat]) base += opt.statBonus[stat]
    })
  }
  if (playerRoles?.[player.name]) {
    const bonus = PLAYER_ROLES_BONUS[playerRoles[player.name]]
    if (bonus?.[stat]) base += bonus[stat]
  }
  base -= getStaminaPenalty(stamina)
  return Math.min(99, Math.max(1, Math.round(base)))
}

function calcTeamStrength(squad, tactics, roles) {
  if (!squad?.length) return 70
  const base = squad.filter(Boolean).reduce((s,p)=>s+(p.overall||70),0)/squad.filter(Boolean).length
  let bonus = 0
  if (tactics?.pressing==='gegenpressing') bonus+=3
  if (tactics?.buildup==='counter') bonus+=2
  if (tactics?.defense_line==='high') bonus+=1
  return base + bonus
}

// Düello sonucu hesapla
function resolveDuel(atkStat, defStat, atkRoll, defRoll, defActionBonus=0) {
  const atkTotal = atkStat + atkRoll
  const defTotal = defStat + defRoll + defActionBonus
  const diff = atkTotal - defTotal
  return { atkTotal, defTotal, diff, atkWins: diff > 0 }
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
  const [duelContext, setDuelContext] = useState(null) // { atkPlayer, defPlayer, zone, atkAction }

  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [selectedAction, setSelectedAction] = useState(null)
  const [myActionSubmitted, setMyActionSubmitted] = useState(false)
  const [timeLeft, setTimeLeft] = useState(ACTION_TIMEOUT)
  const [lastResult, setLastResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [homeStamina, setHomeStamina] = useState({})
  const [awayStamina, setAwayStamina] = useState({})

  const [stats, setStats] = useState({
    home: { shots:0, shotsOnTarget:0, possession:50, passes:0, tackles:0 },
    away: { shots:0, shotsOnTarget:0, possession:50, passes:0, tackles:0 },
  })

  const commentaryRef = useRef(null)
  const channelRef = useRef(null)
  const matchRef = useRef(null)
  const engineRunning = useRef(false)
  const timerRef = useRef(null)

  useEffect(() => {
    init()
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [matchId])

  useEffect(() => {
    if (['pick_attacker','pick_defender','pick_gk'].includes(phase)) {
      setTimeLeft(ACTION_TIMEOUT)
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) { clearInterval(timerRef.current); return 0 }
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
    setMatch(m); matchRef.current = m
    setHomeScore(m.home_score||0); setAwayScore(m.away_score||0)
    if (m.status==='finished') setIsFinished(true)

    const { data: lb } = await supabase.from('lobbies').select('*').eq('id', m.lobby_id).maybeSingle()
    setLobby(lb)
    const { data: pl } = await supabase.from('lobby_players').select('*').eq('lobby_id', m.lobby_id).order('joined_at')
    setLobbyPlayers(pl||[])

    const opId = m.home_user_id===userId ? m.away_user_id : m.home_user_id
    const { data: myS } = await supabase.from('squads').select('*').eq('lobby_id', m.lobby_id).eq('user_id', userId).maybeSingle()
    const { data: opS } = await supabase.from('squads').select('*').eq('lobby_id', m.lobby_id).eq('user_id', opId).maybeSingle()
    setMySquad(myS); setOpSquad(opS)
    setHomeStamina(m.home_stamina||{})
    setAwayStamina(m.away_stamina||{})
    setMyTactics(myS?.tactics||{}); setMyRoles(myS?.player_roles||{})
    setOpTactics(opS?.tactics||{}); setOpRoles(opS?.player_roles||{})
    setLoading(false)

    if (channelRef.current) supabase.removeChannel(channelRef.current)
    channelRef.current = supabase.channel('match-'+matchId)
      .on('postgres_changes', {event:'INSERT',schema:'public',table:'match_events',filter:`match_id=eq.${matchId}`}, p => handleNewEvent(p.new, m))
      .on('postgres_changes', {event:'UPDATE',schema:'public',table:'match_events',filter:`match_id=eq.${matchId}`}, p => handleEventUpdate(p.new))
      .on('postgres_changes', {event:'UPDATE',schema:'public',table:'matches',filter:`id=eq.${matchId}`}, p => {
        const u = p.new
        setHomeScore(u.home_score||0); setAwayScore(u.away_score||0)
        setHomeStamina(u.home_stamina||{})
        setAwayStamina(u.away_stamina||{})
        if (u.status==='finished') {
          setIsFinished(true); setPhase('watching')
          addCommentary('🏁 MAÇ SONA ERDİ!', 'goal')
          updateSeasonStats(u, m.lobby_id, pl||[])
        }
      })
      .subscribe()

    const isHost = (pl||[]).find(p=>p.user_id===userId)?.is_host
    const { data: existing } = await supabase.from('match_events').select('id').eq('match_id', matchId).limit(1)
    if (isHost && (!existing||existing.length===0) && m.status==='active') {
      setTimeout(() => runMatchEngine(m, myS, opS, pl||[]), 2000)
    } else {
      const { data: events } = await supabase.from('match_events').select('*').eq('match_id', matchId).order('created_at')
      events?.forEach(ev => { if (ev.narrative_text) addCommentary(ev.narrative_text, ev.event_type==='goal'?'goal':ev.event_type==='attack'?'attack':'normal') })
    }
  }

  const updateSeasonStats = async (match, lobbyId, players) => {
    const hs=match.home_score||0, as=match.away_score||0
    const homeWin=hs>as, awayWin=as>hs, draw=hs===as
    for (const [uid,gf,ga,win,lose] of [[match.home_user_id,hs,as,homeWin,awayWin],[match.away_user_id,as,hs,awayWin,homeWin]]) {
      const teamName = players.find(p=>p.user_id===uid)?.team_name||''
      const { data: ex } = await supabase.from('season_stats').select('*').eq('lobby_id',lobbyId).eq('user_id',uid).maybeSingle()
      const upd = { lobby_id:lobbyId,user_id:uid,team_name:teamName,
        played:(ex?.played||0)+1,wins:(ex?.wins||0)+(win?1:0),draws:(ex?.draws||0)+(draw?1:0),losses:(ex?.losses||0)+(lose?1:0),
        goals_for:(ex?.goals_for||0)+gf,goals_against:(ex?.goals_against||0)+ga,points:(ex?.points||0)+(win?3:draw?1:0) }
      if (ex) await supabase.from('season_stats').update(upd).eq('id',ex.id)
      else await supabase.from('season_stats').insert(upd)
    }
  }

  const addCommentary = (text, type='normal') => {
    setCommentary(prev => {
      const updated = [...prev.slice(-50), {text,type,id:Date.now()+Math.random()}]
      setTimeout(() => { if (commentaryRef.current) commentaryRef.current.scrollTop=commentaryRef.current.scrollHeight }, 50)
      return updated
    })
  }

  const handleNewEvent = (ev, m) => {
    if (!ev) return
    setMatchMinute(ev.minute||0)
    if (ev.event_type==='narrative') { addCommentary(ev.narrative_text||'','normal'); return }
    if (ev.event_type==='goal') {
      addCommentary(`⚽ ${ev.narrative_text||'GOL!'}`, 'goal')
      setStats(prev => {
        const isHome = ev.attacking_user===m?.home_user_id
        const s = isHome?'home':'away'
        return {...prev,[s]:{...prev[s],shots:(prev[s].shots||0)+1,shotsOnTarget:(prev[s].shotsOnTarget||0)+1}}
      })
      return
    }
    if (ev.event_type==='attack') {
      addCommentary(`🔥 ${ev.narrative_text||''}`, 'attack')
      setStats(prev => {
        const isHome = ev.attacking_user===m?.home_user_id
        const h = isHome?(prev.home.passes||0)+1:(prev.home.passes||0)
        const a = isHome?(prev.away.passes||0):(prev.away.passes||0)+1
        const total = h+a||1
        return {
          home:{...prev.home,passes:h,possession:Math.round(h/total*100),tackles:isHome?prev.home.tackles:(prev.home.tackles||0)+1},
          away:{...prev.away,passes:a,possession:100-Math.round(h/total*100),tackles:isHome?(prev.away.tackles||0)+1:prev.away.tackles},
        }
      })
      setCurrentEvent(ev); setMyActionSubmitted(false)
      setSelectedPlayer(null); setSelectedAction(null)
      if (ev.attacking_user===userId) { setMyRole('attacker'); setPhase('pick_attacker') }
      else if (ev.defending_user===userId) { setMyRole('defender'); setPhase('pick_defender') }
    }
    if (ev.event_type==='shot') {
      addCommentary(`🥅 ${ev.narrative_text||'Şut geliyor!'}`, 'attack')
      setStats(prev => {
        const isHome = ev.attacking_user===m?.home_user_id
        const s = isHome?'home':'away'
        return {...prev,[s]:{...prev[s],shots:(prev[s].shots||0)+1,shotsOnTarget:(prev[s].shotsOnTarget||0)+1}}
      })
      if (ev.defending_user===userId) {
        setCurrentEvent(ev); setMyActionSubmitted(false)
        setSelectedPlayer(null); setSelectedAction(null)
        setMyRole('goalkeeper'); setPhase('pick_gk')
      }
    }
  }

  const handleEventUpdate = (ev) => {
    if (ev.action_phase==='resolved') {
      setPhase('watching')
      if (timerRef.current) clearInterval(timerRef.current)
      setLastResult(ev)
      const msgs = { goal:'⚽ GOOOL!', save:'🧤 Kurtarış!', attack_fail:'❌ Savunma kesti!', no_goal:'😤 Az kaldı!' }
      const detail = ev.attacker_total ? ` [Atak:${ev.attacker_total} vs Sav:${ev.defender_total}]` : ''
      addCommentary(`${msgs[ev.result]||''}${detail}`, ev.result==='goal'?'goal':'normal')
      setTimeout(() => setLastResult(null), 5000)
    }
  }

  const submitAction = async () => {
    if (!selectedPlayer||!selectedAction||!currentEvent||myActionSubmitted) return
    setMyActionSubmitted(true); setPhase('waiting')
    if (timerRef.current) clearInterval(timerRef.current)

    await supabase.from('match_actions').upsert({
      match_id:matchId, event_id:currentEvent.id, user_id:userId,
      role:myRole, selected_player_id:selectedPlayer.id||selectedPlayer.name, action_choice:selectedAction.id,
    }, {onConflict:'event_id,user_id'})

    // Stat hesapla ve spiker için narrative
    let statKey, statVal
    if (myRole==='attacker') {
      statKey = ATK_ACTION_DEFS[selectedAction.id]?.atkStat || 'dribbling'
      statVal = calcPlayerStat(selectedPlayer, statKey, myTactics, myRoles)
      const roll = rollDice()
      const narrFn = getRand(ATK_NARR[selectedAction.id]||ATK_NARR.dribble)
      const narr = narrFn((selectedPlayer.name||'').split(' ').pop(), currentEvent.zone||'', 0)
      addCommentary(`✅ ${narr} [${selectedPlayer.name}: ${statKey}=${statVal}+🎲${roll}=${statVal+roll}]`, 'normal')
    } else if (myRole==='goalkeeper') {
      const gkDef = GK_ACTION_DEFS[selectedAction.id]
      statVal = calcPlayerStat(selectedPlayer, 'goalkeeper', myTactics, myRoles) + (gkDef?.statBonus||0)
      const roll = rollDice()
      const narrFn = getRand(GK_NARR[selectedAction.id]||GK_NARR.dive)
      addCommentary(`🧤 ${narrFn((selectedPlayer.name||'').split(' ').pop(), 0)} [Kaleci: ${statVal}+🎲${roll}=${statVal+roll}]`, 'normal')
    } else {
      const defDef = DEF_ACTION_DEFS[selectedAction.id]
      const baseStat = defDef?.stat || 'defending'
      statVal = calcPlayerStat(selectedPlayer, baseStat, myTactics, myRoles) + (defDef?.statBonus||0)
      const roll = rollDice()
      const narrFn = getRand(DEF_NARR[selectedAction.id]||DEF_NARR.tackle)
      addCommentary(`🛡️ ${narrFn((selectedPlayer.name||'').split(' ').pop(), 0)} [${selectedPlayer.name}: ${baseStat}=${statVal}+🎲${roll}=${statVal+roll}]`, 'normal')
    }
  }

  // ===== MAÇ MOTORU =====
  const runMatchEngine = async (m, myS, opS, players) => {
    if (engineRunning.current) return
    engineRunning.current = true

    const homeUser=players[0], awayUser=players[1]
    if (!homeUser||!awayUser) return

    let homeScore=0, awayScore=0
    const homeTactics=myS?.tactics||{}, awayTactics=opS?.tactics||{}
    const homeRoles=myS?.player_roles||{}, awayRoles=opS?.player_roles||{}
    const homeLineup=myS?.lineup||[], awayLineup=opS?.lineup||[]
    const homeStrength=calcTeamStrength(homeLineup,homeTactics,homeRoles)
    const awayStrength=calcTeamStrength(awayLineup,awayTactics,awayRoles)
    const totalStr=homeStrength+awayStrength

    // Kondisyon sistemi - her oyuncu 100'den başlar
    const stamina = {}
    const allPlayers = [...homeLineup, ...awayLineup].filter(Boolean)
    allPlayers.forEach(p => { if(p.name) stamina[p.name] = 100 })

    const updateStamina = async (playerName, loss) => {
      if (!playerName || !stamina[playerName]) return
      stamina[playerName] = Math.max(0, stamina[playerName] - loss)
      // Home/away ayrımı yaparak Supabase'e kaydet
      const homeNames = homeLineup.filter(Boolean).map(p=>p.name)
      const awayNames = awayLineup.filter(Boolean).map(p=>p.name)
      const homeStam = {}
      const awayStam = {}
      Object.entries(stamina).forEach(([name, val]) => {
        if (homeNames.includes(name)) homeStam[name] = val
        else if (awayNames.includes(name)) awayStam[name] = val
      })
      await supabase.from('matches').update({
        home_stamina: homeStam,
        away_stamina: awayStam,
      }).eq('id', m.id)
    }

    const getStamina = (playerName) => stamina[playerName] ?? 100

    await insertEvent(m.id,0,'narrative','resolved',`Maç başlıyor! ${homeUser.team_name} sahaya çıkıyor.`)
    await sleep(2000)
    await insertEvent(m.id,0,'narrative','resolved',`${awayUser.team_name} hazır. Mücadele başlıyor!`)

    for (let i=0; i<MATCH_MINUTES.length; i++) {
      await sleep(5000)
      const minute = MATCH_MINUTES[i]
      const minuteNarrs = [
        `${minute}. dakikada mücadele kızışıyor!`,
        `${minute}. dakikada tempo artıyor!`,
        `${minute}. dakika, kritik bir an yaklaşıyor!`,
        `${minute}. dakikada sahada kıyasıya mücadele!`,
        `${minute}. dakikada oyun giderek ısınıyor!`,
      ]
      await insertEvent(m.id,minute,'narrative','resolved',getRand(minuteNarrs))
      await sleep(2000)

      // Atak yönü — takım gücüne göre ağırlıklı
      let homeAttackChance = homeStrength/totalStr
      if (homeTactics.buildup==='counter') homeAttackChance*=0.75
      if (awayTactics.pressing==='gegenpressing') homeAttackChance*=0.85
      if (homeTactics.pressing==='high_press') homeAttackChance*=1.1
      homeAttackChance = Math.min(0.75, Math.max(0.25, homeAttackChance))

      const attackingHome = Math.random()<homeAttackChance
      const atkUser = attackingHome?homeUser.user_id:awayUser.user_id
      const defUser = attackingHome?awayUser.user_id:homeUser.user_id
      const atkLineup = attackingHome?homeLineup:awayLineup
      const defLineup = attackingHome?awayLineup:homeLineup
      const atkTactics = attackingHome?homeTactics:awayTactics
      const defTactics = attackingHome?awayTactics:homeTactics
      const atkRoles = attackingHome?homeRoles:awayRoles
      const defRoles = attackingHome?awayRoles:homeRoles
      const atkTeamName = attackingHome?homeUser.team_name:awayUser.team_name
      const defTeamName = attackingHome?awayUser.team_name:homeUser.team_name

      // Oyuncu seç
      const fwdPos = ['ST','CF','LW','RW','LM','RM','CAM']
      const defPos = ['CB','LB','RB','CDM']
      const fwds = atkLineup.filter(p=>fwdPos.includes(p.squad_pos||p.position))
      const defs = defLineup.filter(p=>defPos.includes(p.squad_pos||p.position))
      const atkPlayer = fwds.length>0?getRand(fwds):atkLineup[0]
      const defPlayer = defs.length>0?getRand(defs):defLineup[0]

      // Zone
      let zonePool = ZONES
      if (atkTactics.attack_width==='wide') zonePool=['sol kanattan','sağ kanattan','sol kanattan','sağ kanattan']
      else if (atkTactics.attack_width==='central') zonePool=['orta sahadan','ceza sahasından']
      const zone = getRand(zonePool)

      const atkName = (atkPlayer?.name||atkTeamName).split(' ').pop()
      const atkActionKey = getRand(Object.keys(ATK_NARR))
      const narrFn = getRand(ATK_NARR[atkActionKey])
      const narrative = narrFn(atkName, zone, 0)

      // ATAK EVENT INSERT
      const { data: attackEvent } = await supabase.from('match_events').insert({
        match_id:m.id, minute, event_type:'attack',
        attacking_user:atkUser, defending_user:defUser,
        zone, narrative_text:narrative, action_phase:'pending',
      }).select().single()
      if (!attackEvent) continue

      // 30 saniye bekle
      await sleep(ACTION_TIMEOUT*1000)

      const { data: evCheck } = await supabase.from('match_events').select('action_phase').eq('id',attackEvent.id).maybeSingle()
      if (evCheck?.action_phase!=='pending') { await sleep(2000); continue }

      // Kullanıcı hamlelerini al
      const { data: actions } = await supabase.from('match_actions').select('*').eq('event_id',attackEvent.id)
      const atkAction = actions?.find(a=>a.role==='attacker')
      const defAction = actions?.find(a=>a.role==='defender')

      // === DÜELLO 1: Atakçı vs Savunmacı ===
      const atkActionDef = ATK_ACTION_DEFS[atkAction?.action_choice||'dribble']
      const defActionDef = DEF_ACTION_DEFS[defAction?.action_choice||'position']

      const atkCardPlayer = PLAYER_CARDS.find(c=>c.name===atkPlayer?.name)||atkPlayer
      const defCardPlayer = PLAYER_CARDS.find(c=>c.name===defPlayer?.name)||defPlayer

      const atkStamina = getStamina(atkPlayer?.name)
      const defStamina = getStamina(defPlayer?.name)
      const atkStat = calcPlayerStat(atkCardPlayer, atkActionDef.atkStat, atkTactics, atkRoles, atkStamina)
      const defStat = calcPlayerStat(defCardPlayer, defActionDef?.stat||'defending', defTactics, defRoles, defStamina)
      const defBonus = defActionDef?.statBonus||0

      // Kondisyon göster spikere
      if (atkStamina < 60) addCommentary(`⚠️ ${(atkPlayer?.name||'').split(' ').pop()} yorgunluk hissediyor! (Kondisyon: %${atkStamina})`, 'normal')
      if (defStamina < 60) addCommentary(`⚠️ ${(defPlayer?.name||'').split(' ').pop()} yoruldu! (Kondisyon: %${defStamina})`, 'normal')

      const atkRoll1 = rollDice()
      const defRoll1 = rollDice()
      const duel1 = resolveDuel(atkStat, defStat, atkRoll1, defRoll1, defBonus)

      // Spiker — düello sonucu
      const diff1 = Math.abs(duel1.diff)
      const atkNarrFn = getRand(ATK_NARR[atkAction?.action_choice||atkActionKey]||ATK_NARR.dribble)
      const defNarrFn = defAction ? getRand(DEF_NARR[defAction.action_choice]||DEF_NARR.tackle) : null
      const atkNarr = atkNarrFn(atkName, zone, duel1.diff)
      const defName = (defPlayer?.name||defTeamName).split(' ').pop()
      const defNarr = defNarrFn ? defNarrFn(defName, diff1) : null

      // Kondisyon düşür
      const sprintLoss = (atkAction?.action_choice === 'sprint') ? 8 : 5
      await updateStamina(atkPlayer?.name, sprintLoss)
      await updateStamina(defPlayer?.name, 5)

      if (duel1.atkWins) {
        // Atakçı kazandı — şuta geç
        const duelNarr = `${atkNarr} [${atkStat}+🎲${atkRoll1}=${duel1.atkTotal}]${defNarr?` — Ama ${defNarr} [${defStat+defBonus}+🎲${defRoll1}=${duel1.defTotal}] yetmedi!`:''}`

        // ŞUT EVENT
        const shotNarrFn = getRand(ATK_NARR.shot)
        const shotNarr = shotNarrFn(atkName, 'ceza sahasından', 0)
        await insertEvent(m.id, minute, 'shot', 'pending', `${duelNarr}\n🥅 ${shotNarr}`, atkUser, defUser)

        // 15 saniye daha bekle (kaleci hamlesi için)
        await sleep(15000)

        // === DÜELLO 2: Şut vs Kaleci ===
        const { data: gkActions } = await supabase.from('match_actions').select('*').eq('event_id',attackEvent.id)
        const gkAction = gkActions?.find(a=>a.role==='goalkeeper')

        const gkPlayer = defLineup.find(p=>p.position==='GK'||p.squad_pos==='GK')
        const gkCardPlayer = PLAYER_CARDS.find(c=>c.name===gkPlayer?.name)||gkPlayer
        const gkActionDef = GK_ACTION_DEFS[gkAction?.action_choice||'dive']

        const shootStat = calcPlayerStat(atkCardPlayer, 'shooting', atkTactics, atkRoles, getStamina(atkPlayer?.name))
        const gkStat = calcPlayerStat(gkCardPlayer, 'goalkeeper', defTactics, defRoles, getStamina(gkPlayer?.name))
        await updateStamina(gkPlayer?.name, 3)
        const gkBonus = gkActionDef?.statBonus||0
        // Kontratak güçlendirmesi
        const counterBonus = atkTactics.buildup==='counter' ? 4 : 0

        const shootRoll = rollDice()
        const gkRoll = rollDice()
        const duel2 = resolveDuel(shootStat+counterBonus, gkStat, shootRoll, gkRoll, gkBonus)

        const gkName = (gkPlayer?.name||defTeamName).split(' ').pop()
        const gkNarrFn = gkAction ? getRand(GK_NARR[gkAction.action_choice]||GK_NARR.dive) : getRand(GK_NARR.dive)
        const gkNarr = gkNarrFn(gkName, Math.abs(duel2.diff))

        if (duel2.atkWins) {
          // GOL!
          if (attackingHome) homeScore++; else awayScore++
          await supabase.from('matches').update({home_score:homeScore,away_score:awayScore}).eq('id',m.id)

          const scoreStr = `${homeScore}-${awayScore}`
          const goalNarrFn = getRand(GOAL_NARR)
          const goalNarr = goalNarrFn(atkPlayer?.name?.split(' ').pop()||atkName, scoreStr)
          await insertEvent(m.id, minute, 'goal', 'resolved', `${goalNarr} (Şut:${shootStat+counterBonus}+🎲${shootRoll}=${duel2.atkTotal} vs Kaleci:${gkStat+gkBonus}+🎲${gkRoll}=${duel2.defTotal})`, atkUser, defUser)
          await supabase.from('match_events').update({action_phase:'resolved',result:'goal',attacker_total:duel1.atkTotal,defender_total:duel1.defTotal,attacker_roll:atkRoll1,defender_roll:defRoll1}).eq('id',attackEvent.id)
        } else {
          // Kurtarış
          const missNarrFn = getRand(MISS_NARR)
          const missNarr = missNarrFn(atkName)
          await supabase.from('match_events').update({
            action_phase:'resolved', result:'save',
            attacker_total:duel1.atkTotal, defender_total:duel1.defTotal,
            attacker_roll:atkRoll1, defender_roll:defRoll1,
            narrative_text:`${gkNarr} ${missNarr} (Şut:${duel2.atkTotal} vs Kaleci:${duel2.defTotal})`,
          }).eq('id',attackEvent.id)
        }
      } else {
        // Savunma kazandı — atak kesildi
        const failNarr = defNarrFn
          ? defNarrFn(defName, diff1)
          : `${defName} atağı kesti!`
        await supabase.from('match_events').update({
          action_phase:'resolved', result:'attack_fail',
          attacker_total:duel1.atkTotal, defender_total:duel1.defTotal,
          attacker_roll:atkRoll1, defender_roll:defRoll1,
          narrative_text:`${failNarr} [Sav:${duel1.defTotal} vs Atak:${duel1.atkTotal}] — Atak kesildi!`,
        }).eq('id',attackEvent.id)
      }

      await sleep(3000)
    }

    // Maç sonu
    const winner = homeScore>awayScore?homeUser.team_name:awayScore>homeScore?awayUser.team_name:null
    const finalNarr = winner
      ? `Hakem düdüğü çaldı! ${winner} galip geliyor! Final skor: ${homeScore}-${awayScore}`
      : `Hakem düdüğü çaldı! Beraberlik! ${homeScore}-${awayScore}`
    await insertEvent(m.id,90,'narrative','resolved',finalNarr)
    await supabase.from('matches').update({status:'finished'}).eq('id',m.id)
    engineRunning.current = false
  }

  async function insertEvent(matchId,minute,type,phase,narrative,atkUser=null,defUser=null) {
    const {data} = await supabase.from('match_events').insert({
      match_id:matchId,minute,event_type:type,action_phase:phase,
      narrative_text:narrative,attacking_user:atkUser,defending_user:defUser,
    }).select().single()
    return data
  }
  function sleep(ms){return new Promise(r=>setTimeout(r,ms))}

  const myTeam = lobbyPlayers.find(p=>p.user_id===userId)
  const opTeam = lobbyPlayers.find(p=>p.user_id!==userId)
  const isHome = match?.home_user_id===userId
  const myLineup = mySquad?.lineup||[]
  const playersToShow = phase==='pick_attacker'
    ? myLineup.filter(p=>['ST','CF','LW','RW','LM','RM','CAM','CM'].includes(p.squad_pos||p.position))
    : phase==='pick_gk'
    ? myLineup.filter(p=>p.position==='GK'||p.squad_pos==='GK')
    : myLineup.filter(p=>['CB','LB','RB','CDM','CM'].includes(p.squad_pos||p.position))
  const actionsToShow = phase==='pick_attacker'?ATK_ACTIONS:phase==='pick_gk'?GK_ACTIONS:DEF_ACTIONS

  if (loading) return (
    <div style={{minHeight:'100vh',background:'#0a0a1a',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{color:'#a0a0c0'}}>Maç yükleniyor...</div>
    </div>
  )

  return (
    <div style={{height:'100vh',background:'#0a0a1a',display:'flex',flexDirection:'column',overflow:'hidden'}}>

      {/* SKOR */}
      <div style={{background:'#0f0f2a',borderBottom:'1px solid #1e1e4a',padding:'.6rem 1.5rem',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <div style={{flex:1,textAlign:'center'}}>
          <div style={{fontWeight:800,fontSize:'.88rem'}}>{isHome?'🏠 ':''}{myTeam?.team_name}</div>
          <div style={{fontSize:'.62rem',color:'#606080'}}>{mySquad?.formation||'?'}</div>
        </div>
        <div style={{textAlign:'center',padding:'0 1.5rem'}}>
          <div style={{fontSize:'2.5rem',fontWeight:900,letterSpacing:'.1em',lineHeight:1}}>
            <span style={{color:isHome&&homeScore>awayScore?'#10b981':'#fff'}}>{homeScore}</span>
            <span style={{color:'#606080',margin:'0 .3rem'}}>-</span>
            <span style={{color:!isHome&&awayScore>homeScore?'#10b981':'#fff'}}>{awayScore}</span>
          </div>
          <div style={{color:isFinished?'#fbbf24':'#606080',fontSize:'.7rem',fontWeight:600}}>
            {isFinished?'⏱ MAÇ BİTTİ':`⏱ ${matchMinute}'`}
          </div>
        </div>
        <div style={{flex:1,textAlign:'center'}}>
          <div style={{fontWeight:800,fontSize:'.88rem'}}>{!isHome?'🏠 ':''}{opTeam?.team_name}</div>
          <div style={{fontSize:'.62rem',color:'#606080'}}>{opSquad?.formation||'?'}</div>
        </div>
      </div>

      <div style={{flex:1,display:'grid',gridTemplateColumns:'1fr 300px',overflow:'hidden'}}>

        {/* SOL */}
        <div style={{display:'flex',flexDirection:'column',overflow:'hidden',borderRight:'1px solid #1e1e4a'}}>

          {/* Hamle paneli */}
          {['pick_attacker','pick_defender','pick_gk'].includes(phase) && (
            <div style={{background:phase==='pick_attacker'?'rgba(239,68,68,.15)':'rgba(59,130,246,.15)',borderBottom:`2px solid ${phase==='pick_attacker'?'#ef4444':'#3b82f6'}`,padding:'.75rem 1rem',flexShrink:0}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'.5rem'}}>
                <div style={{fontWeight:800,fontSize:'.88rem',color:phase==='pick_attacker'?'#f87171':'#60a5fa'}}>
                  {phase==='pick_attacker'?'⚡ ATAK HAMLESİ — Oyuncu ve Hamle Seç':phase==='pick_gk'?'🧤 KALECİ HAMLESİ':'🛡️ SAVUNMA HAMLESİ — Oyuncu ve Hamle Seç'}
                </div>
                <div style={{display:'flex',alignItems:'center',gap:'.4rem'}}>
                  <div style={{width:32,height:32,borderRadius:'50%',background:timeLeft>15?'rgba(16,185,129,.2)':'rgba(239,68,68,.2)',border:`2px solid ${timeLeft>15?'#10b981':'#ef4444'}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'.82rem',fontWeight:800,color:timeLeft>15?'#10b981':'#ef4444'}}>
                    {timeLeft}
                  </div>
                  <span style={{fontSize:'.65rem',color:'#606080'}}>sn</span>
                </div>
              </div>

              <div style={{marginBottom:'.5rem'}}>
                <div style={{fontSize:'.6rem',color:'#606080',fontWeight:700,letterSpacing:'.06em',marginBottom:'.3rem'}}>OYUNCU SEÇ</div>
                <div style={{display:'flex',gap:'.35rem',overflowX:'auto',paddingBottom:'.2rem'}}>
                  {playersToShow.map((p,i) => {
                    const card = PLAYER_CARDS.find(c=>c.name===p.name)||p
                    const isSel = selectedPlayer?.name===p.name
                    return (
                      <div key={i} onClick={()=>setSelectedPlayer(card)}
                        style={{flexShrink:0,background:isSel?'rgba(124,58,237,.3)':'#12122a',border:`1.5px solid ${isSel?'#a78bfa':'#2a2a5a'}`,borderRadius:7,padding:'.3rem .5rem',cursor:'pointer',minWidth:64,textAlign:'center'}}>
                        <div style={{fontSize:'.82rem',fontWeight:900,color:'#fbbf24'}}>{card.overall}</div>
                        <div style={{fontSize:'.58rem',fontWeight:700,color:'#fff',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:62}}>{(p.name||'').split(' ').pop()}</div>
                        <div style={{fontSize:'.52rem',color:'#606080'}}>{p.squad_pos||p.position}</div>
                        {selectedPlayer?.name===p.name && selectedAction && (
                          <div style={{fontSize:'.5rem',color:'#fbbf24',marginTop:2}}>
                            {calcPlayerStat(card, ATK_ACTION_DEFS[selectedAction.id]?.atkStat||'defending', myTactics, myRoles)}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div style={{marginBottom:'.6rem'}}>
                <div style={{fontSize:'.6rem',color:'#606080',fontWeight:700,letterSpacing:'.06em',marginBottom:'.3rem'}}>HAMLEYİ SEÇ</div>
                <div style={{display:'flex',gap:'.3rem',flexWrap:'wrap'}}>
                  {actionsToShow.map(action => {
                    const isSel = selectedAction?.id===action.id
                    const statKey = phase==='pick_attacker'
                      ? ATK_ACTION_DEFS[action.id]?.atkStat
                      : phase==='pick_gk'
                      ? 'goalkeeper'
                      : (DEF_ACTION_DEFS[action.id]?.stat||'defending')
                    const bonus = phase==='pick_attacker' ? 0 : phase==='pick_gk' ? (GK_ACTION_DEFS[action.id]?.statBonus||0) : (DEF_ACTION_DEFS[action.id]?.statBonus||0)
                    const statVal = selectedPlayer ? calcPlayerStat(selectedPlayer, statKey, myTactics, myRoles)+bonus : null
                    return (
                      <button key={action.id} onClick={()=>setSelectedAction(action)}
                        title={action.desc}
                        style={{padding:'.3rem .6rem',borderRadius:7,border:`1.5px solid ${isSel?'#a78bfa':'#2a2a5a'}`,background:isSel?'rgba(124,58,237,.25)':'#12122a',color:isSel?'#a78bfa':'#a0a0c0',fontWeight:700,fontSize:'.75rem',cursor:'pointer',display:'flex',alignItems:'center',gap:'.25rem'}}>
                        <span>{action.emoji}</span>
                        <span>{action.label}</span>
                        {statVal!==null && <span style={{color:'#fbbf24',fontSize:'.65rem'}}>[{statVal}]</span>}
                      </button>
                    )
                  })}
                </div>
              </div>

              <button onClick={submitAction} disabled={!selectedPlayer||!selectedAction}
                style={{padding:'.5rem 1.25rem',borderRadius:8,border:'none',background:selectedPlayer&&selectedAction?'#7c3aed':'#1e1e4a',color:selectedPlayer&&selectedAction?'#fff':'#606080',fontWeight:800,fontSize:'.85rem',cursor:selectedPlayer&&selectedAction?'pointer':'not-allowed'}}>
                HAMLE GÖNDER →
              </button>
            </div>
          )}

          {phase==='waiting' && (
            <div style={{background:'rgba(16,185,129,.1)',borderBottom:'2px solid #10b981',padding:'.5rem 1rem',flexShrink:0,display:'flex',alignItems:'center',gap:'.75rem'}}>
              <div style={{fontSize:'1.1rem'}}>⏳</div>
              <div>
                <div style={{fontWeight:700,color:'#10b981',fontSize:'.85rem'}}>Hamlen gönderildi! Rakip hamlesi bekleniyor...</div>
                <div style={{color:'#606080',fontSize:'.7rem'}}>{selectedPlayer?.name} → {selectedAction?.label}</div>
              </div>
            </div>
          )}

          {lastResult && (
            <div style={{background:lastResult.result==='goal'?'rgba(251,191,36,.15)':'rgba(124,58,237,.1)',borderBottom:`2px solid ${lastResult.result==='goal'?'#fbbf24':'#7c3aed'}`,padding:'.5rem 1rem',flexShrink:0}}>
              <div style={{display:'flex',alignItems:'center',gap:'.75rem'}}>
                <div style={{fontSize:'1.8rem'}}>{lastResult.result==='goal'?'⚽':lastResult.result==='save'?'🧤':lastResult.result==='attack_fail'?'❌':'✅'}</div>
                <div>
                  <div style={{fontWeight:800,color:lastResult.result==='goal'?'#fbbf24':'#a78bfa',fontSize:'.9rem'}}>
                    {lastResult.result==='goal'?'GOOOL!':lastResult.result==='save'?'Kurtarış!':lastResult.result==='attack_fail'?'Savunma Kesti!':''}
                  </div>
                  {lastResult.attacker_total&&<div style={{color:'#606080',fontSize:'.7rem'}}>
                    Atak toplam: {lastResult.attacker_total} | Savunma toplam: {lastResult.defender_total}
                  </div>}
                </div>
              </div>
            </div>
          )}

          {/* İstatistikler */}
          <div style={{flex:1,overflowY:'auto',padding:'1rem'}}>
            <div style={{fontSize:'.62rem',color:'#606080',fontWeight:700,letterSpacing:'.08em',marginBottom:'.75rem'}}>MAÇ İSTATİSTİKLERİ</div>
            {[
              ['Topla Oynama',`${stats.home.possession}%`,`${stats.away.possession}%`,stats.home.possession,stats.away.possession],
              ['Şutlar',stats.home.shots,stats.away.shots,stats.home.shots,stats.away.shots],
              ['İsabetli Şutlar',stats.home.shotsOnTarget,stats.away.shotsOnTarget,stats.home.shotsOnTarget,stats.away.shotsOnTarget],
              ['Paslar',stats.home.passes,stats.away.passes,stats.home.passes,stats.away.passes],
              ['Top Kapma',stats.home.tackles,stats.away.tackles,stats.home.tackles,stats.away.tackles],
              ['Goller',homeScore,awayScore,homeScore,awayScore],
            ].map(([label,hv,av,hn,an])=>{
              const total=(Number(hn)||0)+(Number(an)||0)||1
              const hw=Math.round((Number(hn)||0)/total*100)
              return (
                <div key={label} style={{marginBottom:'.85rem'}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:'.25rem',fontSize:'.82rem'}}>
                    <span style={{fontWeight:700,color:isHome&&hn>an?'#10b981':'#fff'}}>{hv}</span>
                    <span style={{color:'#606080',fontSize:'.7rem'}}>{label}</span>
                    <span style={{fontWeight:700,color:!isHome&&an>hn?'#10b981':'#fff'}}>{av}</span>
                  </div>
                  <div style={{height:4,background:'#1e1e4a',borderRadius:2,overflow:'hidden',display:'flex'}}>
                    <div style={{width:`${hw}%`,background:isHome?'#7c3aed':'#2a2a5a',transition:'width .5s'}}/>
                    <div style={{flex:1,background:!isHome?'#7c3aed':'#2a2a5a'}}/>
                  </div>
                </div>
              )
            })}

            {/* Kondisyon Paneli */}
            <div style={{marginTop:'1rem',marginBottom:'1rem'}}>
              <div style={{fontSize:'.62rem',color:'#606080',fontWeight:700,letterSpacing:'.08em',marginBottom:'.5rem'}}>OYUNCU KONDİSYONU</div>
              <div style={{display:'flex',flexDirection:'column',gap:'.25rem'}}>
                {myLineup.slice(0,11).map((p,i) => {
                  const stam = isHome ? (homeStamina[p.name]??100) : (awayStamina[p.name]??100)
                  const stamColor = stam>=80?'#10b981':stam>=60?'#f59e0b':stam>=40?'#ef4444':'#7f1d1d'
                  return (
                    <div key={i} style={{display:'flex',alignItems:'center',gap:'.4rem'}}>
                      <span style={{fontSize:'.6rem',color:'#a0a0c0',minWidth:80,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{(p.name||'').split(' ').pop()}</span>
                      <div style={{flex:1,height:4,background:'#1e1e4a',borderRadius:2,overflow:'hidden'}}>
                        <div style={{width:`${stam}%`,height:'100%',background:stamColor,transition:'width .5s'}}/>
                      </div>
                      <span style={{fontSize:'.58rem',color:stamColor,minWidth:24,textAlign:'right'}}>{stam}%</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Kondisyon Paneli */}
            <div style={{marginTop:'1rem',marginBottom:'1rem'}}>
              <div style={{fontSize:'.62rem',color:'#606080',fontWeight:700,letterSpacing:'.08em',marginBottom:'.5rem'}}>OYUNCU KONDİSYONU</div>
              <div style={{display:'flex',flexDirection:'column',gap:'.25rem'}}>
                {myLineup.slice(0,11).map((p,i) => {
                  const stam = isHome ? (homeStamina[p.name]??100) : (awayStamina[p.name]??100)
                  const stamColor = stam>=80?'#10b981':stam>=60?'#f59e0b':stam>=40?'#ef4444':'#7f1d1d'
                  return (
                    <div key={i} style={{display:'flex',alignItems:'center',gap:'.4rem'}}>
                      <span style={{fontSize:'.6rem',color:'#a0a0c0',minWidth:80,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{(p.name||'').split(' ').pop()}</span>
                      <div style={{flex:1,height:4,background:'#1e1e4a',borderRadius:2,overflow:'hidden'}}>
                        <div style={{width:`${stam}%`,height:'100%',background:stamColor,transition:'width .5s'}}/>
                      </div>
                      <span style={{fontSize:'.58rem',color:stamColor,minWidth:24,textAlign:'right'}}>{stam}%</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {isFinished && (
              <div style={{marginTop:'1.5rem',textAlign:'center',background:'rgba(124,58,237,.1)',borderRadius:12,padding:'1.25rem',border:'1px solid #7c3aed'}}>
                <div style={{fontSize:'1.4rem',fontWeight:900,marginBottom:'.4rem',color:(isHome&&homeScore>awayScore)||(!isHome&&awayScore>homeScore)?'#fbbf24':'#a0a0c0'}}>
                  {homeScore>awayScore?(isHome?'🏆 KAZANDIN!':'😔 Kaybettin'):awayScore>homeScore?(isHome?'😔 Kaybettin':'🏆 KAZANDIN!'):'🤝 Beraberlik!'}
                </div>
                <div style={{fontSize:'2rem',fontWeight:900,marginBottom:'1rem'}}>{homeScore} - {awayScore}</div>
                <button onClick={()=>navigate(`/game/${lobby?.code}`)}
                  style={{padding:'.65rem 1.5rem',borderRadius:9,border:'none',background:'#7c3aed',color:'#fff',fontWeight:700,cursor:'pointer',fontSize:'.88rem'}}>
                  Ana Menüye Dön
                </button>
              </div>
            )}
          </div>
        </div>

        {/* SAĞ: Spiker */}
        <div style={{display:'flex',flexDirection:'column',overflow:'hidden'}}>
          <div style={{padding:'.65rem 1rem',borderBottom:'1px solid #1e1e4a',flexShrink:0,background:'#0f0f2a'}}>
            <div style={{fontWeight:800,fontSize:'.85rem'}}>📺 Spiker</div>
            <div style={{color:'#606080',fontSize:'.65rem'}}>Canlı maç anlatısı</div>
          </div>
          <div ref={commentaryRef} style={{flex:1,overflowY:'auto',padding:'.6rem',display:'flex',flexDirection:'column',gap:'.3rem'}}>
            {commentary.length===0&&<div style={{color:'#606080',fontSize:'.82rem',textAlign:'center',marginTop:'2rem'}}>Maç başlıyor...</div>}
            {commentary.map(c=>(
              <div key={c.id} style={{padding:'.4rem .6rem',borderRadius:6,fontSize:'.8rem',lineHeight:1.4,
                background:c.type==='goal'?'rgba(251,191,36,.12)':c.type==='attack'?'rgba(239,68,68,.08)':'rgba(255,255,255,.03)',
                borderLeft:`3px solid ${c.type==='goal'?'#fbbf24':c.type==='attack'?'#ef4444':'#2a2a5a'}`,
                color:c.type==='goal'?'#fbbf24':'#e0e0e0',fontWeight:c.type==='goal'?700:400}}>
                {c.text}
              </div>
            ))}
          </div>
          <div style={{padding:'.6rem',borderTop:'1px solid #1e1e4a',flexShrink:0,background:'#0a0a1a'}}>
            <div style={{fontSize:'.58rem',color:'#606080',fontWeight:700,letterSpacing:'.06em',marginBottom:'.25rem'}}>AKTİF TAKTİK</div>
            <div style={{fontSize:'.7rem',color:'#a78bfa',fontWeight:600}}>
              {myTactics.pressing?`${myTactics.pressing.replace('_',' ')}`:'Belirsiz'}
              {myTactics.buildup?` • ${myTactics.buildup.replace('_',' ')}`:''}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
