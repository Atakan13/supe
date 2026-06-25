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

const ATK_ACTION_DEFS = {
  shot:    { atkStat:'shooting',  defStat:'defending', narrative:'şut çekti' },
  dribble: { atkStat:'dribbling', defStat:'defending', narrative:'çalım attı' },
  cross:   { atkStat:'passing',   defStat:'defending', narrative:'orta yaptı' },
  pass:    { atkStat:'passing',   defStat:'defending', narrative:'pas verdi' },
  sprint:  { atkStat:'pace',      defStat:'pace',      narrative:'hız yaptı' },
}

const DEF_ACTION_DEFS = {
  block:    { stat:'defending', statBonus:10, narrative:'önüne geçti' },
  tackle:   { stat:'defending', statBonus:5,  narrative:'müdahale etti' },
  position: { stat:'defending', statBonus:7,  narrative:'pozisyon aldı' },
  press:    { stat:'physical',  statBonus:8,  narrative:'baskı yaptı' },
  let:      { stat:'defending', statBonus:-15, narrative:'geçmesine izin verdi' },
}

const GK_ACTION_DEFS = {
  dive:   { statBonus:8,  narrative:'daldı' },
  catch:  { statBonus:5,  narrative:'tutmaya çalıştı' },
  corner: { statBonus:3,  narrative:'köşeye attı' },
  punch:  { statBonus:6,  narrative:'yumrukladı' },
}

const ATK_ACTIONS = [
  { id:'shot',    label:'Şut Çek',  emoji:'⚡' },
  { id:'dribble', label:'Çalım At', emoji:'🔥' },
  { id:'cross',   label:'Orta Yap', emoji:'📐' },
  { id:'pass',    label:'Pas Ver',  emoji:'↗️' },
  { id:'sprint',  label:'Hızlan',   emoji:'💨' },
]
const DEF_ACTIONS = [
  { id:'block',    label:'Önüne Geç',   emoji:'🛡️' },
  { id:'tackle',   label:'Müdahale',    emoji:'⚔️' },
  { id:'position', label:'Pozisyon Al', emoji:'📍' },
  { id:'press',    label:'Baskı Yap',   emoji:'💪' },
  { id:'let',      label:'Geç Gitsin',  emoji:'🏃' },
]
const GK_ACTIONS = [
  { id:'dive',   label:'Dal',       emoji:'🤸' },
  { id:'catch',  label:'Tut',       emoji:'🧤' },
  { id:'corner', label:'Köşeye At', emoji:'🥅' },
  { id:'punch',  label:'Yumrukla',  emoji:'👊' },
]

const ATK_NARR = {
  shot:    [(p,z,d)=>d>15?`${p} MUHTEŞEM şut çekti!`:`${p} ${z} güçlü şut denedi!`, (p)=>`${p} ceza sahasından sert vurdu!`, (p,z)=>`${p} ${z} kalecinin köşesini hedef aldı!`, (p)=>`${p} vollede şut denedi!`, (p)=>`${p} kafa vuruşuyla kaleyi hedef aldı!`],
  dribble: [(p,z,d)=>d>15?`${p} OLAĞANÜSTÜ çalımla savunmacıyı geçti!`:`${p} ${z} harika çalım attı!`, (p)=>`${p} hızlı ayak hareketleriyle geçti!`, (p,z)=>`${p} ${z} elastico hareketiyle alt etti!`, (p)=>`${p} topla dans ederek iki savunmacıyı geçti!`, (p)=>`${p} finta yapıp rakibini geride bıraktı!`],
  cross:   [(p,z,d)=>d>15?`${p} CESARETİ TAM orta yaptı!`:`${p} ${z} tehlikeli orta yaptı!`, (p)=>`${p} düşük orta yaparak santrforu buldu!`, (p)=>`${p} ölüm ortası yaptı!`, (p,z)=>`${p} ${z} savunmanın arkasına sertçe orta attı!`, (p)=>`${p} ikinci direğe kesin orta attı!`],
  pass:    [(p,z,d)=>d>15?`${p} NEFES KESEN pas verdi!`:`${p} ${z} boşlukta arkadaşını buldu!`, (p)=>`${p} derinlemesine nefis pas verdi!`, (p)=>`${p} defansın arkasına uzun top gönderdi!`, (p)=>`${p} topuğuyla harika pas verdi!`, (p)=>`${p} savunmayı yarıp geçen pas attı!`],
  sprint:  [(p,z,d)=>d>15?`${p} ROCKET GİBİ fırladı!`:`${p} ${z} defans hattının arkasına koştu!`, (p)=>`${p} inanılmaz hızla boş alana girdi!`, (p)=>`${p} ani hızlanmayla defans hattını geçti!`, (p)=>`${p} kontratak pozisyonunda tek başına kaldı!`, (p)=>`${p} hız patlamasıyla tüm savunmayı geçti!`],
}
const DEF_NARR = {
  block:    [(p,d)=>d>15?`${p} MÜKEMMELİYET! Şutu tamamen engelledi!`:`${p} harika pozisyonla şutu engelledi!`, (p)=>`${p} son anda önüne geçerek topu uzaklaştırdı!`, (p)=>`${p} vücudunu siper ederek kesti!`, (p)=>`${p} çift bacakla şutu önledi!`],
  tackle:   [(p,d)=>d>15?`${p} MUHTEŞEMDİ! Topu söküp aldı!`:`${p} sert müdahaleyle topu aldı!`, (p)=>`${p} zamanlı kayışla topu kapıverdi!`, (p)=>`${p} kayan müdahaleyle topu uzaklaştırdı!`, (p)=>`${p} son anda topu söküp aldı!`],
  position: [(p,d)=>d>15?`${p} TAKTİK DAHİSİ! Atağı kapattı!`:`${p} iyi pozisyon alarak tehlikeyi önledi!`, (p)=>`${p} koridor kapayarak rakibini sıkıştırdı!`, (p)=>`${p} defans arkasını kapatarak ofsayt tuzağı kurdu!`],
  press:    [(p,d)=>d>15?`${p} AMANSIZ BASKIYLA rakibini bunalttı!`:`${p} sürekli baskıyla rakibini bunalttı!`, (p)=>`${p} yüksek presle rakibin hatasını provoke etti!`, (p)=>`${p} baskısıyla rakibi uzun topa zorladı!`],
  let:      [(p)=>`${p} geçmesine izin verdi, tehlike kapıda!`, (p)=>`${p} dengesini kaybetti, rakip geçti!`, (p)=>`${p} müdahale edemedi, atak devam ediyor!`],
}
const GK_NARR = {
  dive:   [(p,d)=>d>15?`${p} İNANILMAZ KURTULUŞ!`:`${p} harika dalışla kurtardı!`, (p)=>`${p} köşeye dalarak kurtardı!`, (p)=>`${p} inanılmaz refleksle uzandı!`],
  catch:  [(p,d)=>d>15?`${p} OLAĞANÜSTÜ! Topu kucakladı!`:`${p} topu emin ellerde kavradı!`, (p)=>`${p} güçlü elleriyle tuttu!`],
  corner: [(p)=>`${p} topu köşeye attı!`, (p)=>`${p} refleksiyle köşeye yönlendirdi!`],
  punch:  [(p,d)=>d>15?`${p} GELDİ VE YUMRUKLADI!`:`${p} güçlü yumrukla uzaklaştırdı!`, (p)=>`${p} yumruklayarak ceza sahasını temizledi!`],
}
const GOAL_NARR = [
  (p,s)=>`⚽ GOOOOL! ${p} tarihi an yaşattı! ${s}`,
  (p,s)=>`⚽ GOOOOL! ${p} fileleri havalandırdı! ${s}`,
  (p,s)=>`⚽ GOOOOL! Muhteşem! ${p} imzasını attı! ${s}`,
  (p,s)=>`⚽ GOOOOL! ${p} durdurulamadı! ${s}`,
]
const MISS_NARR = [
  (p)=>`😤 ${p} az kaldı! Top direkten döndü!`,
  (p)=>`😤 Kurtarış! Ama ${p} çok yaklaşmıştı!`,
  (p)=>`😤 ${p} gol diye bağırdı ama dışarı!`,
]

const MATCH_MINUTES = [5,12,18,24,31,38,42,47,54,60,67,74,80,86,90]
const ZONES = ['sol kanattan','orta sahadan','sağ kanattan','ceza sahasından']
const ACTION_TIMEOUT = 20

function rollDice(min=1,max=20){ return Math.floor(Math.random()*(max-min+1))+min }
function getRand(arr){ return arr[Math.floor(Math.random()*arr.length)] }

function getStaminaPenalty(s){ return s>=80?0:s>=60?3:s>=40?6:s>=20?10:15 }

function calcPlayerStat(player, stat, tactics, playerRoles, stamina=100) {
  if (!player) return 50
  let base = player[stat] || 50
  if (tactics) Object.entries(tactics).forEach(([k,v])=>{
    const opt = TACTICS_CONFIG[k]?.options.find(o=>o.id===v)
    if (opt?.statBonus?.[stat]) base += opt.statBonus[stat]
  })
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
  return base+bonus
}

function resolveDuel(atkStat, defStat, atkRoll, defRoll, defBonus=0) {
  const atkTotal = atkStat+atkRoll
  const defTotal = defStat+defRoll+defBonus
  return { atkTotal, defTotal, diff:atkTotal-defTotal, atkWins:atkTotal>defTotal }
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
  const [activeMatchTab, setActiveMatchTab] = useState('stats')

  const [homeStamina, setHomeStamina] = useState({})
  const [awayStamina, setAwayStamina] = useState({})
  const [homeLineupLive, setHomeLineupLive] = useState([])
  const [awayLineupLive, setAwayLineupLive] = useState([])
  const [homeSubs, setHomeSubs] = useState([])
  const [awaySubs, setAwaySubs] = useState([])
  const [homeSubCount, setHomeSubCount] = useState(0)
  const [awaySubCount, setAwaySubCount] = useState(0)
  const [subOut, setSubOut] = useState(null)
  const [subIn, setSubIn] = useState(null)
  const [subLoading, setSubLoading] = useState(false)

  const [stats, setStats] = useState({
    home:{shots:0,shotsOnTarget:0,possession:50,passes:0,tackles:0},
    away:{shots:0,shotsOnTarget:0,possession:50,passes:0,tackles:0},
  })

  const [matchReport, setMatchReport] = useState(null)
  const commentaryRef = useRef(null)
  const channelRef = useRef(null)
  const matchRef = useRef(null)
  const engineRunning = useRef(false)
  const timerRef = useRef(null)

  useEffect(()=>{ init(); return ()=>{ if(channelRef.current) supabase.removeChannel(channelRef.current); if(timerRef.current) clearInterval(timerRef.current) } },[matchId])

  useEffect(()=>{
    if(['pick_attacker','pick_defender','pick_gk'].includes(phase)){
      setTimeLeft(ACTION_TIMEOUT)
      if(timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(()=>setTimeLeft(p=>{ if(p<=1){clearInterval(timerRef.current);return 0} return p-1 }),1000)
    } else { if(timerRef.current) clearInterval(timerRef.current) }
    return ()=>{ if(timerRef.current) clearInterval(timerRef.current) }
  },[phase])

  const init = async () => {
    const {data:m} = await supabase.from('matches').select('*').eq('id',matchId).maybeSingle()
    if(!m) return
    setMatch(m); matchRef.current=m
    setHomeScore(m.home_score||0); setAwayScore(m.away_score||0)
    if(m.status==='finished') setIsFinished(true)

    const {data:lb} = await supabase.from('lobbies').select('*').eq('id',m.lobby_id).maybeSingle()
    setLobby(lb)
    const {data:pl} = await supabase.from('lobby_players').select('*').eq('lobby_id',m.lobby_id).order('joined_at')
    setLobbyPlayers(pl||[])

    const opId = m.home_user_id===userId?m.away_user_id:m.home_user_id
    const {data:myS} = await supabase.from('squads').select('*').eq('lobby_id',m.lobby_id).eq('user_id',userId).maybeSingle()
    const {data:opS} = await supabase.from('squads').select('*').eq('lobby_id',m.lobby_id).eq('user_id',opId).maybeSingle()
    setMySquad(myS); setOpSquad(opS)
    setMyTactics(myS?.tactics||{}); setMyRoles(myS?.player_roles||{})
    setOpTactics(opS?.tactics||{}); setOpRoles(opS?.player_roles||{})

    setHomeStamina(m.home_stamina||{})
    setAwayStamina(m.away_stamina||{})
    setHomeLineupLive(m.home_lineup_live?.length?m.home_lineup_live:myS?.lineup||[])
    setAwayLineupLive(m.away_lineup_live?.length?m.away_lineup_live:opS?.lineup||[])
    setHomeSubs(m.home_subs||[])
    setAwaySubs(m.away_subs||[])
    setHomeSubCount(m.home_sub_count||0)
    setAwaySubCount(m.away_sub_count||0)
    setLoading(false)

    if(channelRef.current) supabase.removeChannel(channelRef.current)
    channelRef.current = supabase.channel('match-'+matchId)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'match_events',filter:`match_id=eq.${matchId}`},p=>handleNewEvent(p.new,m))
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'match_events',filter:`match_id=eq.${matchId}`},p=>handleEventUpdate(p.new))
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'matches',filter:`id=eq.${matchId}`},p=>{
        const u=p.new
        setHomeScore(u.home_score||0); setAwayScore(u.away_score||0)
        setHomeStamina(u.home_stamina||{})
        setAwayStamina(u.away_stamina||{})
        if(u.home_lineup_live?.length) setHomeLineupLive(u.home_lineup_live)
        if(u.away_lineup_live?.length) setAwayLineupLive(u.away_lineup_live)
        setHomeSubs(u.home_subs||[]); setAwaySubs(u.away_subs||[])
        setHomeSubCount(u.home_sub_count||0); setAwaySubCount(u.away_sub_count||0)
        if(u.status==='finished'){
          setIsFinished(true); setPhase('watching')
          addCommentary('🏁 MAÇ SONA ERDİ!','goal')
              updateSeasonStats(u,m.lobby_id,pl||[])
          generateMatchReport(u, matchId)
        }
      })
      .subscribe()

    const isHost=(pl||[]).find(p=>p.user_id===userId)?.is_host
    const {data:existing} = await supabase.from('match_events').select('id').eq('match_id',matchId).limit(1)
    if(isHost&&(!existing||existing.length===0)&&m.status==='active'){
      setTimeout(()=>runMatchEngine(m,myS,opS,pl||[]),2000)
    } else {
      const {data:events} = await supabase.from('match_events').select('*').eq('match_id',matchId).order('created_at')
      events?.forEach(ev=>{ if(ev.narrative_text) addCommentary(ev.narrative_text,ev.event_type==='goal'?'goal':ev.event_type==='attack'?'attack':'normal') })
    }
  }

  const updateSeasonStats = async (match,lobbyId,players) => {
    const hs=match.home_score||0, as=match.away_score||0
    const homeWin=hs>as, awayWin=as>hs, draw=hs===as
    for(const [uid,gf,ga,win,lose] of [[match.home_user_id,hs,as,homeWin,awayWin],[match.away_user_id,as,hs,awayWin,homeWin]]){
      const teamName=players.find(p=>p.user_id===uid)?.team_name||''
      const {data:ex}=await supabase.from('season_stats').select('*').eq('lobby_id',lobbyId).eq('user_id',uid).maybeSingle()
      const upd={lobby_id:lobbyId,user_id:uid,team_name:teamName,
        played:(ex?.played||0)+1,wins:(ex?.wins||0)+(win?1:0),draws:(ex?.draws||0)+(draw?1:0),losses:(ex?.losses||0)+(lose?1:0),
        goals_for:(ex?.goals_for||0)+gf,goals_against:(ex?.goals_against||0)+ga,points:(ex?.points||0)+(win?3:draw?1:0)}
      if(ex) await supabase.from('season_stats').update(upd).eq('id',ex.id)
      else await supabase.from('season_stats').insert(upd)
    }
  }

  const addCommentary = (text,type='normal') => {
    setCommentary(prev=>{
      const updated=[...prev.slice(-50),{text,type,id:Date.now()+Math.random()}]
      setTimeout(()=>{ if(commentaryRef.current) commentaryRef.current.scrollTop=commentaryRef.current.scrollHeight },50)
      return updated
    })
  }

  const handleNewEvent = (ev,m) => {
    if(!ev) return
    setMatchMinute(ev.minute||0)
    if(ev.event_type==='narrative'){ addCommentary(ev.narrative_text||'','normal'); return }
    if(ev.event_type==='goal'){
      addCommentary(`⚽ ${ev.narrative_text||'GOL!'}`, 'goal')
      setStats(prev=>{ const isHome=ev.attacking_user===m?.home_user_id; const s=isHome?'home':'away'; return {...prev,[s]:{...prev[s],shots:(prev[s].shots||0)+1,shotsOnTarget:(prev[s].shotsOnTarget||0)+1}} })
      return
    }
    if(ev.event_type==='attack'){
      addCommentary(`🔥 ${ev.narrative_text||''}`, 'attack')
      setStats(prev=>{
        const isHome=ev.attacking_user===m?.home_user_id
        const h=isHome?(prev.home.passes||0)+1:(prev.home.passes||0)
        const a=isHome?(prev.away.passes||0):(prev.away.passes||0)+1
        const total=h+a||1
        return {
          home:{...prev.home,passes:h,possession:Math.round(h/total*100),tackles:isHome?prev.home.tackles:(prev.home.tackles||0)+1},
          away:{...prev.away,passes:a,possession:100-Math.round(h/total*100),tackles:isHome?(prev.away.tackles||0)+1:prev.away.tackles},
        }
      })
      setCurrentEvent(ev); setMyActionSubmitted(false); setSelectedPlayer(null); setSelectedAction(null)
      if(ev.attacking_user===userId){ setMyRole('attacker'); setPhase('pick_attacker') }
      else if(ev.defending_user===userId){ setMyRole('defender'); setPhase('pick_defender') }
    }
    if(ev.event_type==='shot'){
      addCommentary(`🥅 ${ev.narrative_text||'Şut geliyor!'}`, 'attack')
      setStats(prev=>{ const isHome=ev.attacking_user===m?.home_user_id; const s=isHome?'home':'away'; return {...prev,[s]:{...prev[s],shots:(prev[s].shots||0)+1,shotsOnTarget:(prev[s].shotsOnTarget||0)+1}} })
      if(ev.defending_user===userId){
        setCurrentEvent(ev); setMyActionSubmitted(false); setSelectedPlayer(null); setSelectedAction(null)
        setMyRole('goalkeeper'); setPhase('pick_gk')
      }
    }
  }

  const handleEventUpdate = (ev) => {
    if(ev.action_phase==='resolved'){
      setPhase('watching')
      if(timerRef.current) clearInterval(timerRef.current)
      setLastResult(ev)
      const msgs={goal:'⚽ GOOOL!',save:'🧤 Kurtarış!',attack_fail:'❌ Savunma kesti!'}
      const detail=ev.attacker_total?` [Atak:${ev.attacker_total} vs Sav:${ev.defender_total}]`:''
      addCommentary(`${msgs[ev.result]||''}${detail}`,ev.result==='goal'?'goal':'normal')
      setTimeout(()=>setLastResult(null),5000)
    }
  }

  const submitAction = async () => {
    if(!selectedPlayer||!selectedAction||!currentEvent||myActionSubmitted) return
    setMyActionSubmitted(true); setPhase('waiting')
    if(timerRef.current) clearInterval(timerRef.current)
    await supabase.from('match_actions').upsert({
      match_id:matchId,event_id:currentEvent.id,user_id:userId,
      role:myRole,selected_player_id:selectedPlayer.id||selectedPlayer.name,action_choice:selectedAction.id,
    },{onConflict:'event_id,user_id'})
    const statKey = myRole==='attacker'?ATK_ACTION_DEFS[selectedAction.id]?.atkStat:'defending'
    const statVal = calcPlayerStat(selectedPlayer,statKey,myTactics,myRoles)
    const roll=rollDice()
    addCommentary(`✅ ${selectedPlayer.name?.split(' ').pop()} — ${selectedAction.label} [${statVal}+🎲${roll}=${statVal+roll}]`,'normal')
  }

  const generateMatchReport = async (matchData, mId) => {
    try {
      // Gol eventlerini çek
      const { data: events } = await supabase
        .from('match_events')
        .select('*')
        .eq('match_id', mId)
        .eq('event_type', 'goal')
        .order('minute')

      // Maç aksiyonlarından oyuncu istatistikleri
      const { data: actions } = await supabase
        .from('match_actions')
        .select('*')
        .eq('match_id', mId)

      // Oyuncu başına aksiyon sayısı
      const playerActions = {}
      actions?.forEach(a => {
        const pid = a.selected_player_id
        if (!pid) return
        if (!playerActions[pid]) playerActions[pid] = { actions:0, role: a.role }
        playerActions[pid].actions++
      })

      // En aktif oyuncu
      const mostActive = Object.entries(playerActions)
        .sort((a,b) => b[1].actions - a[1].actions)[0]

      // Goller
      const goals = events?.map(e => ({
        minute: e.minute,
        scorer: e.narrative_text?.match(/GOOOOL! (\w+)/)?.[1] || '?',
        isHome: e.attacking_user === matchData.home_user_id,
      })) || []

      setMatchReport({
        goals,
        mostActive: mostActive ? { name: mostActive[0], actions: mostActive[1].actions } : null,
        homeScore: matchData.home_score || 0,
        awayScore: matchData.away_score || 0,
        totalShots: actions?.filter(a => a.action_choice === 'shot').length || 0,
        totalTackles: actions?.filter(a => ['tackle','block','position'].includes(a.action_choice)).length || 0,
      })
    } catch(e) {
      console.error('Rapor hatası:', e)
    }
  }

  const makeSub = async () => {
    if(!subOut||!subIn||subLoading||isFinished) return
    const mySubCount=isHome?homeSubCount:awaySubCount
    if(mySubCount>=3){ return }
    setSubLoading(true)
    const myLiveLineup=isHome?[...homeLineupLive]:[...awayLineupLive]
    const newLineup=myLiveLineup.map(p=>p.name===subOut.name?{...subIn,squad_pos:subOut.squad_pos}:p)
    const subRecord={out:subOut.name,in:subIn.name,minute:matchMinute,squad_pos:subOut.squad_pos}
    const updateData=isHome?{
      home_lineup_live:newLineup,home_subs:[...homeSubs,subRecord],home_sub_count:homeSubCount+1,
    }:{
      away_lineup_live:newLineup,away_subs:[...awaySubs,subRecord],away_sub_count:awaySubCount+1,
    }
    await supabase.from('matches').update(updateData).eq('id',matchId)
    await supabase.from('match_events').insert({
      match_id:matchId,minute:matchMinute,event_type:'narrative',action_phase:'resolved',
      narrative_text:`🔄 DEĞİŞİKLİK! ${subOut.name?.split(' ').pop()} çıkıyor, ${subIn.name?.split(' ').pop()} giriyor! (${matchMinute}')`,
    })
    setSubOut(null); setSubIn(null); setSubLoading(false)
  }

  const runMatchEngine = async (m,myS,opS,players) => {
    if(engineRunning.current) return
    engineRunning.current=true
    const homeUser=players[0],awayUser=players[1]
    if(!homeUser||!awayUser) return

    let hs=0,as=0
    const homeTactics=myS?.tactics||{},awayTactics=opS?.tactics||{}
    const homeRoles=myS?.player_roles||{},awayRoles=opS?.player_roles||{}
    const homeLineup=myS?.lineup||[],awayLineup=opS?.lineup||[]
    const homeStr=calcTeamStrength(homeLineup,homeTactics,homeRoles)
    const awayStr=calcTeamStrength(awayLineup,awayTactics,awayRoles)
    const totalStr=homeStr+awayStr

    const stamina={}
    ;[...homeLineup,...awayLineup].filter(Boolean).forEach(p=>{ if(p.name) stamina[p.name]=100 })

    const updateStamina=async(name,loss,mid)=>{
      if(!name||!stamina[name]) return
      stamina[name]=Math.max(0,stamina[name]-loss)
      if(stamina[name]<60) addCommentary(`⚠️ ${name.split(' ').pop()} yorgunluk hissediyor! (${stamina[name]}%)`,'normal')
      const homeNames=homeLineup.filter(Boolean).map(p=>p.name)
      const hStam={},aStam={}
      Object.entries(stamina).forEach(([n,v])=>{ if(homeNames.includes(n)) hStam[n]=v; else aStam[n]=v })
      await supabase.from('matches').update({home_stamina:hStam,away_stamina:aStam}).eq('id',m.id)
    }

    await insertEvent(m.id,0,'narrative','resolved',`Maç başlıyor! ${homeUser.team_name} sahaya çıkıyor.`)
    await sleep(2000)
    await insertEvent(m.id,0,'narrative','resolved',`${awayUser.team_name} hazır. Mücadele başlıyor!`)

    for(let i=0;i<MATCH_MINUTES.length;i++){
      await sleep(5000)
      const minute=MATCH_MINUTES[i]
      const mNarrs=[`${minute}. dakikada mücadele kızışıyor!`,`${minute}. dakikada tempo artıyor!`,`${minute}. dakika, kritik an yaklaşıyor!`,`${minute}. dakikada kıyasıya mücadele!`]
      await insertEvent(m.id,minute,'narrative','resolved',getRand(mNarrs))
      await sleep(2000)

      let homeAttackChance=homeStr/totalStr
      if(homeTactics.buildup==='counter') homeAttackChance*=0.75
      if(awayTactics.pressing==='gegenpressing') homeAttackChance*=0.85
      if(homeTactics.pressing==='high_press') homeAttackChance*=1.1
      homeAttackChance=Math.min(0.75,Math.max(0.25,homeAttackChance))

      const attackingHome=Math.random()<homeAttackChance
      const atkUser=attackingHome?homeUser.user_id:awayUser.user_id
      const defUser=attackingHome?awayUser.user_id:homeUser.user_id
      const atkLineup=attackingHome?homeLineup:awayLineup
      const defLineup=attackingHome?awayLineup:homeLineup
      const atkTactics=attackingHome?homeTactics:awayTactics
      const defTactics=attackingHome?awayTactics:homeTactics
      const atkRoles=attackingHome?homeRoles:awayRoles
      const defRoles=attackingHome?awayRoles:homeRoles
      const atkTeamName=attackingHome?homeUser.team_name:awayUser.team_name
      const defTeamName=attackingHome?awayUser.team_name:homeUser.team_name

      const fwdPos=['ST','CF','LW','RW','LM','RM','CAM']
      const defPos=['CB','LB','RB','CDM']
      const fwds=atkLineup.filter(p=>fwdPos.includes(p.squad_pos||p.position))
      const defs=defLineup.filter(p=>defPos.includes(p.squad_pos||p.position))
      const atkPlayer=fwds.length>0?getRand(fwds):atkLineup[0]
      const defPlayer=defs.length>0?getRand(defs):defLineup[0]

      let zonePool=ZONES
      if(atkTactics.attack_width==='wide') zonePool=['sol kanattan','sağ kanattan','sol kanattan','sağ kanattan']
      else if(atkTactics.attack_width==='central') zonePool=['orta sahadan','ceza sahasından']
      const zone=getRand(zonePool)

      const atkActionKey=getRand(Object.keys(ATK_NARR))
      const narrFn=getRand(ATK_NARR[atkActionKey])
      const narrative=narrFn(atkName,zone,0)

      const {data:attackEvent}=await supabase.from('match_events').insert({
        match_id:m.id,minute,event_type:'attack',
        attacking_user:atkUser,defending_user:defUser,
        zone,narrative_text:narrative,action_phase:'pending',
      }).select().single()
      if(!attackEvent) continue

      await sleep(ACTION_TIMEOUT*1000)

      const {data:evCheck}=await supabase.from('match_events').select('action_phase').eq('id',attackEvent.id).maybeSingle()
      if(evCheck?.action_phase!=='pending'){await sleep(2000);continue}

      const {data:actions}=await supabase.from('match_actions').select('*').eq('event_id',attackEvent.id)
      const atkAction=actions?.find(a=>a.role==='attacker')
      const defAction=actions?.find(a=>a.role==='defender')

      const atkActionDef=ATK_ACTION_DEFS[atkAction?.action_choice||'dribble']
      const defActionDef=DEF_ACTION_DEFS[defAction?.action_choice||'position']

      const atkCard=PLAYER_CARDS.find(c=>c.name===atkPlayer?.name)||atkPlayer
      const defCard=PLAYER_CARDS.find(c=>c.name===defPlayer?.name)||defPlayer

      const atkStam=getStam(atkPlayer?.name)
      const defStam=getStam(defPlayer?.name)
      const atkStat=calcPlayerStat(atkCard,atkActionDef.atkStat,atkTactics,atkRoles,atkStam)
      const defStat=calcPlayerStat(defCard,defActionDef?.stat||'defending',defTactics,defRoles,defStam)
      const defBonus=defActionDef?.statBonus||0

      const atkRoll1=rollDice(),defRoll1=rollDice()
      const duel1=resolveDuel(atkStat,defStat,atkRoll1,defRoll1,defBonus)

      await updateStamina(atkPlayer?.name,atkAction?.action_choice==='sprint'?8:5,minute)
      await updateStamina(defPlayer?.name,5,minute)

      if(duel1.atkWins){
        const shotNarrFn=getRand(ATK_NARR.shot)
        const shotNarr=shotNarrFn(atkName,'ceza sahasından',0)
        const duelDetail=`[Atak:${atkStat}+🎲${atkRoll1}=${duel1.atkTotal} vs Sav:${defStat+defBonus}+🎲${defRoll1}=${duel1.defTotal}]`
        await insertEvent(m.id,minute,'shot','pending',`${duelDetail} 🥅 ${shotNarr}`,atkUser,defUser)
        await sleep(10000)

        const {data:gkActions}=await supabase.from('match_actions').select('*').eq('event_id',attackEvent.id)
        const gkAction=gkActions?.find(a=>a.role==='goalkeeper')
        const gkPlayer=defLineup.find(p=>p.position==='GK'||p.squad_pos==='GK')
        const gkCard=PLAYER_CARDS.find(c=>c.name===gkPlayer?.name)||gkPlayer
        const gkActionDef=GK_ACTION_DEFS[gkAction?.action_choice||'dive']

        const shootStat=calcPlayerStat(atkCard,'shooting',atkTactics,atkRoles,getStam(atkPlayer?.name))
        const gkStat=calcPlayerStat(gkCard,'goalkeeper',defTactics,defRoles,getStam(gkPlayer?.name))
        const gkBonus=gkActionDef?.statBonus||0
        const counterBonus=atkTactics.buildup==='counter'?4:0

        const shootRoll=rollDice(),gkRoll=rollDice()
        const duel2=resolveDuel(shootStat+counterBonus,gkStat,shootRoll,gkRoll,gkBonus)

        await updateStamina(gkPlayer?.name,3,minute)

        const gkName=(gkPlayer?.name||defTeamName).split(' ').pop()
        const gkNarrFn=getRand(GK_NARR[gkAction?.action_choice||'dive'])
        const gkNarr=gkNarrFn(gkName,Math.abs(duel2.diff))

        if(duel2.atkWins){
          if(attackingHome) hs++; else as++
          await supabase.from('matches').update({home_score:hs,away_score:as}).eq('id',m.id)
          const scoreStr=`${hs}-${as}`
          const goalNarrFn=getRand(GOAL_NARR)
          const goalNarr=goalNarrFn(atkPlayer?.name?.split(' ').pop()||atkName,scoreStr)
          await insertEvent(m.id,minute,'goal','resolved',`${goalNarr} (Şut:${duel2.atkTotal} vs Kal:${duel2.defTotal})`,atkUser,defUser)
          await supabase.from('match_events').update({action_phase:'resolved',result:'goal',attacker_total:duel1.atkTotal,defender_total:duel1.defTotal,attacker_roll:atkRoll1,defender_roll:defRoll1}).eq('id',attackEvent.id)
        } else {
          const missNarrFn=getRand(MISS_NARR)
          await supabase.from('match_events').update({
            action_phase:'resolved',result:'save',
            attacker_total:duel1.atkTotal,defender_total:duel1.defTotal,
            attacker_roll:atkRoll1,defender_roll:defRoll1,
            narrative_text:`${gkNarr} ${missNarrFn(atkName)} (Şut:${duel2.atkTotal} vs Kal:${duel2.defTotal})`,
          }).eq('id',attackEvent.id)
        }
      } else {
        const defNarrFn=defAction?getRand(DEF_NARR[defAction.action_choice]||DEF_NARR.tackle):getRand(DEF_NARR.tackle)
        const defNarr=defNarrFn(defName,Math.abs(duel1.diff))
        await supabase.from('match_events').update({
          action_phase:'resolved',result:'attack_fail',
          attacker_total:duel1.atkTotal,defender_total:duel1.defTotal,
          attacker_roll:atkRoll1,defender_roll:defRoll1,
          narrative_text:`${defNarr} [Sav:${duel1.defTotal} vs Atak:${duel1.atkTotal}] — Atak kesildi!`,
        }).eq('id',attackEvent.id)
      }
      await sleep(3000)
    }

    const winner=hs>as?homeUser.team_name:as>hs?awayUser.team_name:null
    const finalNarr=winner?`Hakem düdüğü çaldı! ${winner} galip! Final: ${hs}-${as}`:`Hakem düdüğü çaldı! Beraberlik! ${hs}-${as}`
    await insertEvent(m.id,90,'narrative','resolved',finalNarr)
    await supabase.from('matches').update({status:'finished'}).eq('id',m.id)
    engineRunning.current=false
  }

  async function insertEvent(matchId,minute,type,phase,narrative,atkUser=null,defUser=null){
    const {data}=await supabase.from('match_events').insert({
      match_id:matchId,minute,event_type:type,action_phase:phase,
      narrative_text:narrative,attacking_user:atkUser,defending_user:defUser,
    }).select().single()
    return data
  }
  function sleep(ms){return new Promise(r=>setTimeout(r,ms))}


  const playersToShow=phase==='pick_attacker'
    ?myLineup.filter(p=>['ST','CF','LW','RW','LM','RM','CAM','CM'].includes(p.squad_pos||p.position))
    :phase==='pick_gk'
    ?myLineup.filter(p=>p.position==='GK'||p.squad_pos==='GK')
    :myLineup.filter(p=>['CB','LB','RB','CDM','CM'].includes(p.squad_pos||p.position))

  if(loading) return <div style={{minHeight:'100vh',background:'#0a0a1a',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{color:'#a0a0c0'}}>Maç yükleniyor...</div></div>


  const myTeam=lobbyPlayers.find(p=>p.user_id===userId)
  const opTeam=lobbyPlayers.find(p=>p.user_id!==userId)
  const isHome=match?.home_user_id===userId
  const myLineup=isHome?homeLineupLive:awayLineupLive
  const myBench=mySquad?.bench||[]
  const myCurrentStamina=isHome?homeStamina:awayStamina

  const actionsToShow=phase==='pick_attacker'?ATK_ACTIONS:phase==='pick_gk'?GK_ACTIONS:DEF_ACTIONS


  if(loading) return (
    <div style={{minHeight:'100vh',background:'#080c18',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:4,color:'rgba(0,200,255,0.6)'}}>MAÇ YÜKLENİYOR...</div>
    </div>
  )

  const myScore = isHome ? homeScore : awayScore
  const opScore = isHome ? awayScore : homeScore

  return (
    <div style={{height:'100vh',background:'#080c18',display:'flex',flexDirection:'column',overflow:'hidden',position:'relative'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Rajdhani:wght@400;500;600;700&display=swap');
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes shimmer{0%{left:-100%}100%{left:200%}}
        @keyframes goalFlash{0%,100%{opacity:0}10%,90%{opacity:1}}
        @keyframes pulse{0%,100%{box-shadow:0 0 0 2px rgba(0,200,255,0.5)}50%{box-shadow:0 0 0 3px rgba(0,200,255,0.9)}}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:2px}
      `}</style>

      {/* BG efektleri */}
      <div style={{position:'absolute',inset:0,backgroundImage:'linear-gradient(rgba(0,200,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(0,200,255,0.02) 1px,transparent 1px)',backgroundSize:'40px 40px',pointerEvents:'none',zIndex:0}}/>
      <div style={{position:'absolute',width:600,height:600,background:'radial-gradient(circle,rgba(0,80,255,0.06) 0%,transparent 70%)',top:-200,left:-200,pointerEvents:'none',zIndex:0}}/>
      <div style={{position:'absolute',width:400,height:400,background:'radial-gradient(circle,rgba(123,47,255,0.05) 0%,transparent 70%)',bottom:-100,right:-100,pointerEvents:'none',zIndex:0}}/>

      {/* SKOR HERO */}
      <div style={{background:'rgba(0,0,0,0.7)',borderBottom:'1px solid rgba(0,200,255,0.12)',padding:'.75rem 1.5rem',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,position:'relative',zIndex:10}}>
        {/* Kendi takım */}
        <div style={{flex:1}}>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:2,background:'linear-gradient(180deg,#fff 0%,#8899bb 100%)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>{myTeam?.team_name}</div>
          <div style={{display:'inline-block',background:'rgba(0,200,255,0.1)',border:'1px solid rgba(0,200,255,0.25)',borderRadius:3,padding:'1px 7px',fontFamily:"'Bebas Neue',sans-serif",fontSize:11,letterSpacing:1,color:'#00c8ff',marginTop:2}}>{mySquad?.formation||'?'}</div>
        </div>

        {/* Skor */}
        <div style={{textAlign:'center',padding:'0 2rem'}}>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:52,letterSpacing:8,lineHeight:1,color:'#fff',textShadow:'0 0 30px rgba(0,200,255,0.3)'}}>
            <span style={{color:myScore>opScore?'#00c8ff':'#fff'}}>{myScore}</span>
            <span style={{color:'rgba(255,255,255,0.2)',margin:'0 .2rem'}}>—</span>
            <span style={{color:opScore>myScore?'#ff4444':'#fff'}}>{opScore}</span>
          </div>
          <div style={{display:'inline-block',background:isFinished?'rgba(255,200,0,0.15)':'rgba(0,200,255,0.1)',border:`1px solid ${isFinished?'rgba(255,200,0,0.4)':'rgba(0,200,255,0.3)'}`,borderRadius:2,padding:'2px 10px',fontFamily:"'Bebas Neue',sans-serif",fontSize:11,letterSpacing:2,color:isFinished?'#ffd700':'#00c8ff',marginTop:4}}>
            {isFinished?'MAÇ BİTTİ':`${matchMinute}'`}
          </div>
        </div>

        {/* Rakip takım */}
        <div style={{flex:1,textAlign:'right'}}>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:2,background:'linear-gradient(180deg,rgba(255,255,255,0.6) 0%,rgba(136,153,187,0.6) 100%)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>{opTeam?.team_name}</div>
          <div style={{display:'inline-block',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:3,padding:'1px 7px',fontFamily:"'Bebas Neue',sans-serif",fontSize:11,letterSpacing:1,color:'rgba(255,255,255,0.3)',marginTop:2}}>{opSquad?.formation||'?'}</div>
        </div>
      </div>

      {/* TAB BAR */}
      <div style={{background:'rgba(0,0,0,0.5)',borderBottom:'1px solid rgba(255,255,255,0.05)',display:'flex',padding:'0 1rem',flexShrink:0,position:'relative',zIndex:10}}>
        {[['stats','📊 İSTATİSTİK'],['lineup','👥 KADROLAR'],['subs','🔄 DEĞİŞİKLİK']].map(([tab,label])=>(
          <button key={tab} onClick={()=>setActiveMatchTab(tab)}
            style={{padding:'.55rem .9rem',border:'none',background:'transparent',color:activeMatchTab===tab?'#00c8ff':'rgba(255,255,255,0.25)',fontFamily:"'Bebas Neue',sans-serif",fontSize:12,letterSpacing:2,cursor:'pointer',borderBottom:activeMatchTab===tab?'2px solid #00c8ff':'2px solid transparent',transition:'all .15s'}}>
            {label}{tab==='subs'?` (${isHome?homeSubCount:awaySubCount}/3)`:''}
          </button>
        ))}
      </div>

      <div style={{flex:1,display:'grid',gridTemplateColumns:'1fr 280px',overflow:'hidden',position:'relative',zIndex:1}}>

        {/* SOL */}
        <div style={{display:'flex',flexDirection:'column',overflow:'hidden',borderRight:'1px solid rgba(255,255,255,0.05)'}}>

          {/* Hamle paneli */}
          {['pick_attacker','pick_defender','pick_gk'].includes(phase) && !isFinished && (
            <div style={{background:phase==='pick_attacker'?'rgba(255,60,60,0.08)':'rgba(0,100,255,0.08)',borderBottom:`1px solid ${phase==='pick_attacker'?'rgba(255,60,60,0.3)':'rgba(0,100,255,0.3)'}`,padding:'.75rem 1rem',flexShrink:0,position:'relative'}}>

              {/* Başlık + Timer */}
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'.6rem'}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{width:3,height:18,background:phase==='pick_attacker'?'linear-gradient(180deg,#ff4444,#ff0000)':'linear-gradient(180deg,#00c8ff,#0066ff)',borderRadius:2}}/>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,letterSpacing:2,color:phase==='pick_attacker'?'#ff6666':phase==='pick_gk'?'#00c8ff':'#60a5fa'}}>
                    {phase==='pick_attacker'?'⚡ ATAK HAMLESİ':phase==='pick_gk'?'🧤 KALECİ HAMLESİ':'🛡️ SAVUNMA HAMLESİ'}
                  </div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <div style={{width:34,height:34,borderRadius:'50%',border:`2px solid ${timeLeft>15?'rgba(0,200,255,0.5)':'rgba(255,60,60,0.6)'}`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Bebas Neue',sans-serif",fontSize:15,color:timeLeft>15?'#00c8ff':'#ff4444',animation:timeLeft<=10?'pulse 1s infinite':'none'}}>
                    {timeLeft}
                  </div>
                  <span style={{fontSize:10,color:'rgba(255,255,255,0.25)',letterSpacing:1,fontFamily:"'Rajdhani',sans-serif"}}>SN</span>
                </div>
              </div>

              {/* Oyuncu seç */}
              <div style={{marginBottom:'.5rem'}}>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:10,letterSpacing:2,color:'rgba(255,255,255,0.25)',marginBottom:6}}>OYUNCU SEÇ</div>
                <div style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:4}}>
                  {playersToShow.map((p,i)=>{
                    const card=PLAYER_CARDS.find(c=>c.name===p.name)||p
                    const isSel=selectedPlayer?.name===p.name
                    const stam=myCurrentStamina[p.name]??100
                    return (
                      <div key={i} onClick={()=>setSelectedPlayer(card)}
                        style={{flexShrink:0,minWidth:60,background:isSel?'rgba(0,200,255,0.12)':'rgba(255,255,255,0.03)',border:`1px solid ${isSel?'#00c8ff':'rgba(255,255,255,0.08)'}`,borderRadius:7,padding:'6px 5px',cursor:'pointer',textAlign:'center',transition:'all .15s',boxShadow:isSel?'0 0 12px rgba(0,200,255,0.2)':'none'}}>
                        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:isSel?'#00c8ff':'rgba(255,255,255,0.8)',lineHeight:1}}>{card.overall}</div>
                        <div style={{fontSize:9,color:'rgba(255,255,255,0.4)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:58,fontFamily:"'Rajdhani',sans-serif",letterSpacing:0.5}}>{(p.name||'').split(' ').pop()}</div>
                        <div style={{fontSize:8,color:'rgba(255,255,255,0.2)',letterSpacing:1,fontFamily:"'Bebas Neue',sans-serif"}}>{p.squad_pos||p.position}</div>
                        <div style={{fontSize:11,marginTop:2}}>{getStamHeart(stam)}</div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Hamle seç */}
              <div style={{marginBottom:'.6rem'}}>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:10,letterSpacing:2,color:'rgba(255,255,255,0.25)',marginBottom:6}}>HAMLEYİ SEÇ</div>
                <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                  {actionsToShow.map(action=>{
                    const isSel=selectedAction?.id===action.id
                    const statKey=phase==='pick_attacker'?ATK_ACTION_DEFS[action.id]?.atkStat:phase==='pick_gk'?'goalkeeper':(DEF_ACTION_DEFS[action.id]?.stat||'defending')
                    const bonus=phase==='pick_attacker'?0:phase==='pick_gk'?(GK_ACTION_DEFS[action.id]?.statBonus||0):(DEF_ACTION_DEFS[action.id]?.statBonus||0)
                    const stam=selectedPlayer?(myCurrentStamina[selectedPlayer.name]??100):100
                    const statVal=selectedPlayer?calcPlayerStat(selectedPlayer,statKey,myTactics,myRoles,stam)+bonus:null
                    return (
                      <button key={action.id} onClick={()=>setSelectedAction(action)}
                        style={{padding:'6px 10px',borderRadius:6,border:`1px solid ${isSel?'rgba(0,200,255,0.5)':'rgba(255,255,255,0.07)'}`,background:isSel?'rgba(0,200,255,0.1)':'rgba(255,255,255,0.03)',color:isSel?'#00c8ff':'rgba(255,255,255,0.4)',fontFamily:"'Bebas Neue',sans-serif",fontSize:12,letterSpacing:1,cursor:'pointer',display:'flex',alignItems:'center',gap:5,transition:'all .15s',boxShadow:isSel?'0 0 10px rgba(0,200,255,0.15)':'none',position:'relative'}}>
                        {isSel && <div style={{position:'absolute',top:0,left:'15%',right:'15%',height:1,background:'linear-gradient(90deg,transparent,#00c8ff,transparent)'}}/>}
                        <span>{action.emoji}</span>
                        <span>{action.label}</span>
                        {statVal!==null&&<span style={{color:'rgba(255,200,0,0.8)',fontSize:11}}>[{statVal}]</span>}
                      </button>
                    )
                  })}
                </div>
              </div>

              <button onClick={submitAction} disabled={!selectedPlayer||!selectedAction}
                style={{width:'100%',padding:'10px',borderRadius:6,border:'none',background:selectedPlayer&&selectedAction?'linear-gradient(135deg,#00c8ff,#0066ff,#7b2fff)':'rgba(255,255,255,0.05)',color:selectedPlayer&&selectedAction?'#fff':'rgba(255,255,255,0.2)',fontFamily:"'Bebas Neue',sans-serif",fontSize:14,letterSpacing:3,cursor:selectedPlayer&&selectedAction?'pointer':'not-allowed',position:'relative',overflow:'hidden'}}>
                {selectedPlayer&&selectedAction&&<div style={{position:'absolute',top:0,left:'-100%',width:'60%',height:'100%',background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent)',animation:'shimmer 2s ease-in-out infinite'}}/>}
                HAMLE GÖNDER →
              </button>
            </div>
          )}

          {phase==='waiting' && (
            <div style={{background:'rgba(0,200,100,0.06)',borderBottom:'1px solid rgba(0,200,100,0.2)',padding:'.5rem 1rem',flexShrink:0,display:'flex',alignItems:'center',gap:10}}>
              <div style={{fontSize:'1rem',animation:'blink 1s infinite'}}>⏳</div>
              <div>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:13,letterSpacing:2,color:'#00c864'}}>HAMLEN GÖNDERİLDİ</div>
                <div style={{fontSize:11,color:'rgba(255,255,255,0.3)',fontFamily:"'Rajdhani',sans-serif"}}>{selectedPlayer?.name} → {selectedAction?.label}</div>
              </div>
            </div>
          )}

          {lastResult && (
            <div style={{background:lastResult.result==='goal'?'rgba(255,200,0,0.08)':'rgba(123,47,255,0.08)',borderBottom:`1px solid ${lastResult.result==='goal'?'rgba(255,200,0,0.3)':'rgba(123,47,255,0.3)'}`,padding:'.5rem 1rem',flexShrink:0,display:'flex',alignItems:'center',gap:10}}>
              <div style={{fontSize:'1.6rem'}}>{lastResult.result==='goal'?'⚽':lastResult.result==='save'?'🧤':lastResult.result==='corner'?'🚩':lastResult.result==='freekick'?'🟡':'❌'}</div>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,letterSpacing:2,color:lastResult.result==='goal'?'#ffd700':'#a78bfa'}}>
                {lastResult.result==='goal'?'GOOOL!':lastResult.result==='save'?'KURTULUŞ!':lastResult.result==='corner'?'KORNER!':lastResult.result==='freekick'?'FRİKİK!':'SAVUNMA KESİNTİSİ!'}
              </div>
            </div>
          )}

          {/* TAB İÇERİKLERİ */}
          <div style={{flex:1,overflowY:'auto',padding:'.85rem'}}>

            {activeMatchTab==='stats' && (
              <div>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:11,letterSpacing:3,color:'rgba(255,255,255,0.2)',marginBottom:12}}>MAÇ İSTATİSTİKLERİ</div>
                {[
                  ['TOPLA OYNAMA',`${stats.home.possession}%`,`${stats.away.possession}%`,stats.home.possession,stats.away.possession],
                  ['ŞUTLAR',stats.home.shots,stats.away.shots,stats.home.shots,stats.away.shots],
                  ['İSABETLİ ŞUTLAR',stats.home.shotsOnTarget,stats.away.shotsOnTarget,stats.home.shotsOnTarget,stats.away.shotsOnTarget],
                  ['PASLAR',stats.home.passes,stats.away.passes,stats.home.passes,stats.away.passes],
                  ['TOP KAPMA',stats.home.tackles,stats.away.tackles,stats.home.tackles,stats.away.tackles],
                  ['KORNER',stats.home.corners||0,stats.away.corners||0,stats.home.corners||0,stats.away.corners||0],
                  ['FRİKİK',stats.home.freekicks||0,stats.away.freekicks||0,stats.home.freekicks||0,stats.away.freekicks||0],
                  ['GOLLER',homeScore,awayScore,homeScore,awayScore],
                ].map(([label,hv,av,hn,an])=>{
                  const total=(Number(hn)||0)+(Number(an)||0)||1
                  const hw=Math.round((Number(hn)||0)/total*100)
                  const myVal=isHome?hv:av
                  const opVal=isHome?av:hv
                  const myNum=isHome?Number(hn):Number(an)
                  const opNum=isHome?Number(an):Number(hn)
                  return (
                    <div key={label} style={{marginBottom:10}}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:4,alignItems:'center'}}>
                        <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:14,color:myNum>opNum?'#00c8ff':'rgba(255,255,255,0.7)'}}>{myVal}</span>
                        <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:9,letterSpacing:2,color:'rgba(255,255,255,0.2)'}}>{label}</span>
                        <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:14,color:opNum>myNum?'#ff4444':'rgba(255,255,255,0.3)'}}>{opVal}</span>
                      </div>
                      <div style={{height:3,background:'rgba(255,255,255,0.05)',borderRadius:2,overflow:'hidden',display:'flex'}}>
                        <div style={{width:`${isHome?hw:100-hw}%`,background:'linear-gradient(90deg,#00c8ff,#0066ff)',borderRadius:2,transition:'width .5s'}}/>
                        <div style={{flex:1,background:'rgba(255,60,60,0.3)'}}/>
                      </div>
                    </div>
                  )
                })}

                {/* Kondisyon */}
                <div style={{marginTop:16}}>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:11,letterSpacing:3,color:'rgba(255,255,255,0.2)',marginBottom:8}}>OYUNCU KONDİSYONU</div>
                  {myLineup.slice(0,11).map((p,i)=>{
                    const stam=myCurrentStamina[p.name]??100
                    return (
                      <div key={i} style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                        <span style={{fontFamily:"'Rajdhani',sans-serif",fontSize:11,color:'rgba(255,255,255,0.3)',minWidth:75,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{(p.name||'').split(' ').pop()}</span>
                        <span style={{fontSize:12}}>{getStamHeart(stam)}</span>
                        <span style={{fontFamily:"'Rajdhani',sans-serif",fontSize:11,color:'rgba(255,255,255,0.2)'}}>{stam}%</span>
                      </div>
                    )
                  })}
                </div>

                {isFinished && (
                  <div style={{marginTop:20,textAlign:'center',background:'rgba(123,47,255,0.08)',borderRadius:10,padding:'1.25rem',border:'1px solid rgba(123,47,255,0.25)'}}>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:3,marginBottom:6,color:(isHome&&homeScore>awayScore)||(!isHome&&awayScore>homeScore)?'#ffd700':'rgba(255,255,255,0.4)'}}>
                      {homeScore>awayScore?(isHome?'🏆 KAZANDIN!':'😔 KAYBETTİN'):awayScore>homeScore?(isHome?'😔 KAYBETTİN':'🏆 KAZANDIN!'):'🤝 BERABERLİK!'}
                    </div>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:40,letterSpacing:8,marginBottom:16,color:'#fff'}}>{myScore} — {opScore}</div>
                    <button onClick={()=>navigate(`/game/${lobby?.code}`)}
                      style={{padding:'10px 24px',borderRadius:6,border:'none',background:'linear-gradient(135deg,#00c8ff,#0066ff,#7b2fff)',color:'#fff',fontFamily:"'Bebas Neue',sans-serif",fontSize:14,letterSpacing:3,cursor:'pointer'}}>
                      ANA MENÜYE DÖN →
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeMatchTab==='lineup' && (
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                {[
                  {team:isHome?myTeam:opTeam,lineup:homeLineupLive,stamina:homeStamina,subs:homeSubs,isMe:isHome},
                  {team:isHome?opTeam:myTeam,lineup:awayLineupLive,stamina:awayStamina,subs:awaySubs,isMe:!isHome},
                ].map(({team,lineup,stamina,subs,isMe},ti)=>(
                  <div key={ti}>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:13,letterSpacing:2,marginBottom:8,color:isMe?'#00c8ff':'rgba(255,255,255,0.3)'}}>
                      {isMe?'▶ ':''}{team?.team_name?.toUpperCase()}{isMe?' (SEN)':''}
                    </div>
                    {(lineup||[]).map((p,i)=>{
                      const stam=stamina[p.name]??100
                      const sub=subs?.find(s=>s.in===p.name)
                      return (
                        <div key={i} style={{display:'flex',alignItems:'center',gap:5,padding:'4px 6px',borderRadius:5,marginBottom:3,background:isMe?'rgba(0,200,255,0.04)':'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.05)'}}>
                          <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:9,color:'rgba(255,255,255,0.2)',minWidth:24,textAlign:'center',letterSpacing:1}}>{p.squad_pos||p.position}</span>
                          <span style={{flex:1,fontFamily:"'Rajdhani',sans-serif",fontSize:12,color:'rgba(255,255,255,0.6)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.name}</span>
                          {sub&&<span style={{fontSize:9,color:'#00c864'}}>🔄</span>}
                          <span style={{fontSize:11}}>{getStamHeart(stam)}</span>
                        </div>
                      )
                    })}
                    {subs?.length>0&&(
                      <div style={{marginTop:6,padding:5,background:'rgba(0,200,100,0.04)',borderRadius:5,border:'1px solid rgba(0,200,100,0.15)'}}>
                        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:9,letterSpacing:2,color:'rgba(0,200,100,0.6)',marginBottom:3}}>DEĞİŞİKLİKLER</div>
                        {subs.map((s,i)=>(
                          <div key={i} style={{fontFamily:"'Rajdhani',sans-serif",fontSize:11,color:'rgba(255,255,255,0.3)'}}>{s.minute}' 🔄 {s.out?.split(' ').pop()} → {s.in?.split(' ').pop()}</div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {activeMatchTab==='subs' && (
              <div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:11,letterSpacing:3,color:'rgba(255,255,255,0.2)'}}>OYUNCU DEĞİŞİKLİĞİ</div>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:12,letterSpacing:1,color:(isHome?homeSubCount:awaySubCount)>=3?'#ff4444':'#00c864'}}>{isHome?homeSubCount:awaySubCount}/3 KULLANILDI</div>
                </div>

                {(isHome?homeSubCount:awaySubCount)>=3?(
                  <div style={{textAlign:'center',color:'#ff4444',padding:'2rem',fontFamily:"'Bebas Neue',sans-serif",fontSize:14,letterSpacing:2}}>DEĞİŞİKLİK HAKKI DOLDU</div>
                ):isFinished?(
                  <div style={{textAlign:'center',color:'rgba(255,255,255,0.2)',padding:'2rem',fontFamily:"'Bebas Neue',sans-serif",fontSize:13,letterSpacing:2}}>MAÇ BİTTİ</div>
                ):(
                  <div>
                    <div style={{marginBottom:10}}>
                      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:10,letterSpacing:2,color:'rgba(255,255,255,0.2)',marginBottom:6}}>ÇIKACAK OYUNCU</div>
                      {myLineup.map((p,i)=>{
                        const stam=myCurrentStamina[p.name]??100
                        const isSel=subOut?.name===p.name
                        return (
                          <div key={i} onClick={()=>setSubOut(isSel?null:p)}
                            style={{display:'flex',alignItems:'center',gap:6,padding:'5px 8px',borderRadius:5,cursor:'pointer',background:isSel?'rgba(255,60,60,0.1)':'rgba(255,255,255,0.02)',border:`1px solid ${isSel?'rgba(255,60,60,0.4)':'rgba(255,255,255,0.05)'}`,marginBottom:3,transition:'all .1s'}}>
                            <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:9,color:'rgba(255,255,255,0.2)',minWidth:24,letterSpacing:1}}>{p.squad_pos||p.position}</span>
                            <span style={{flex:1,fontFamily:"'Rajdhani',sans-serif",fontSize:12,color:'rgba(255,255,255,0.65)'}}>{p.name}</span>
                            <span style={{fontSize:11}}>{getStamHeart(stam)}</span>
                          </div>
                        )
                      })}
                    </div>

                    {subOut&&(
                      <div style={{marginBottom:10}}>
                        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:10,letterSpacing:2,color:'rgba(255,255,255,0.2)',marginBottom:6}}>GİRECEK OYUNCU</div>
                        {myBench.filter(p=>!myLineup.find(l=>l.name===p.name)).map((p,i)=>{
                          const isSel=subIn?.name===p.name
                          return (
                            <div key={i} onClick={()=>setSubIn(isSel?null:p)}
                              style={{display:'flex',alignItems:'center',gap:6,padding:'5px 8px',borderRadius:5,cursor:'pointer',background:isSel?'rgba(0,200,100,0.1)':'rgba(255,255,255,0.02)',border:`1px solid ${isSel?'rgba(0,200,100,0.4)':'rgba(255,255,255,0.05)'}`,marginBottom:3,transition:'all .1s'}}>
                              <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:9,color:'rgba(255,255,255,0.2)',minWidth:24,letterSpacing:1}}>{p.squad_pos||p.position}</span>
                              <span style={{flex:1,fontFamily:"'Rajdhani',sans-serif",fontSize:12,color:'rgba(255,255,255,0.65)'}}>{p.name}</span>
                              <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,color:'rgba(255,200,0,0.8)'}}>{p.overall}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {subOut&&subIn&&(
                      <button onClick={makeSub} disabled={subLoading}
                        style={{width:'100%',padding:'10px',borderRadius:6,border:'none',background:'linear-gradient(135deg,#00c864,#00a050)',color:'#fff',fontFamily:"'Bebas Neue',sans-serif",fontSize:13,letterSpacing:2,cursor:'pointer',position:'relative',overflow:'hidden'}}>
                        <div style={{position:'absolute',top:0,left:'-100%',width:'60%',height:'100%',background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.15),transparent)',animation:'shimmer 2s ease-in-out infinite'}}/>
                        {subLoading?'YAPILIYOR...':`🔄 ${subOut.name?.split(' ').pop()} → ${subIn.name?.split(' ').pop()} DEĞİŞİKLİK YAP`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* SAĞ: SPİKER */}
        <div style={{display:'flex',flexDirection:'column',overflow:'hidden',background:'rgba(0,0,0,0.3)'}}>
          <div style={{padding:'10px 14px',borderBottom:'1px solid rgba(255,255,255,0.05)',flexShrink:0}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{width:6,height:6,borderRadius:'50%',background:'#ff3030',animation:'blink 1.5s infinite',boxShadow:'0 0 6px #ff3030'}}/>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:13,letterSpacing:3,color:'rgba(255,255,255,0.5)'}}>CANLI SPİKER</div>
            </div>
          </div>
          <div ref={commentaryRef} style={{flex:1,overflowY:'auto',padding:'8px 10px',display:'flex',flexDirection:'column',gap:4}}>
            {commentary.length===0&&<div style={{color:'rgba(255,255,255,0.15)',fontSize:12,textAlign:'center',marginTop:'3rem',fontFamily:"'Bebas Neue',sans-serif",letterSpacing:2}}>MAÇ BAŞLIYOR...</div>}
            {commentary.map(c=>(
              <div key={c.id} style={{display:'flex',gap:6,padding:'5px 8px',borderRadius:5,fontSize:11,lineHeight:1.4,
                background:c.type==='goal'?'rgba(255,200,0,0.06)':c.type==='attack'?'rgba(255,60,60,0.04)':'rgba(255,255,255,0.02)',
                borderLeft:`2px solid ${c.type==='goal'?'#ffd700':c.type==='attack'?'#ff4444':'rgba(255,255,255,0.08)'}`,
                color:c.type==='goal'?'#ffd700':'rgba(255,255,255,0.5)',
                fontFamily:"'Rajdhani',sans-serif",fontWeight:c.type==='goal'?600:400,letterSpacing:0.3}}>
                {c.text}
              </div>
            ))}
          </div>
          <div style={{padding:'8px 12px',borderTop:'1px solid rgba(255,255,255,0.05)',flexShrink:0,background:'rgba(0,0,0,0.3)'}}>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:9,letterSpacing:2,color:'rgba(255,255,255,0.15)',marginBottom:3}}>AKTİF TAKTİK</div>
            <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:11,color:'rgba(0,200,255,0.5)',letterSpacing:0.5}}>
              {myTactics.pressing?myTactics.pressing.replace(/_/g,' '):'—'}
              {myTactics.buildup?` · ${myTactics.buildup.replace(/_/g,' ')}`:''}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
