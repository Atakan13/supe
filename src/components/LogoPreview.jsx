export function LogoPreview({ shape, icon, bgColor, accentColor, size=80 }) {
  const s = size
  const getPath = () => {
    switch(shape) {
      case 'shield':  return `M${s/2},${s*.05} L${s*.9},${s*.25} L${s*.9},${s*.6} Q${s*.9},${s*.85} ${s/2},${s*.95} Q${s*.1},${s*.85} ${s*.1},${s*.6} L${s*.1},${s*.25} Z`
      case 'diamond': return `M${s/2},${s*.05} L${s*.92},${s/2} L${s/2},${s*.95} L${s*.08},${s/2} Z`
      case 'hexagon': return `M${s/2},${s*.05} L${s*.88},${s*.27} L${s*.88},${s*.73} L${s/2},${s*.95} L${s*.12},${s*.73} L${s*.12},${s*.27} Z`
      case 'square':  return `M${s*.08},${s*.08} L${s*.92},${s*.08} L${s*.92},${s*.92} L${s*.08},${s*.92} Z`
      default: return null
    }
  }

  // PNG ikon mu emoji mi?
  const isPng = icon && !icon.includes(' ') && icon.length > 2

  return (
    <div style={{ position:'relative', width:s, height:s, display:'inline-block', flexShrink:0 }}>
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={{ position:'absolute', inset:0 }}>
        {shape==='circle'
          ? <circle cx={s/2} cy={s/2} r={s*.45} fill={bgColor} stroke={accentColor} strokeWidth={s*.04}/>
          : <path d={getPath()} fill={bgColor} stroke={accentColor} strokeWidth={s*.04}/>}
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
        {isPng
          ? <img src={`/assets/icons/${icon}.png`} alt={icon} style={{ width:s*.6, height:s*.6, objectFit:'contain' }} onError={e => e.target.style.display='none'}/>
          : <span style={{ fontSize:s*.38, lineHeight:1 }}>{icon}</span>
        }
      </div>
    </div>
  )
}
