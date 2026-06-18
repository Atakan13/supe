import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://qnnxwniguwjkwdrfjyyf.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFubnh3bmlndXdqa3dkcmZqeXlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MDM2MzksImV4cCI6MjA5NzM3OTYzOX0.-_zgWlO7hjis3kusdLUjlbJouf_35lT_VnPvpgyj-iE'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})
