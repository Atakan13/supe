export function getClub() {
  try {
    const raw = localStorage.getItem('draft_club')
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function saveClub(club) {
  localStorage.setItem('draft_club', JSON.stringify(club))
}

export function clearClub() {
  localStorage.removeItem('draft_club')
}
