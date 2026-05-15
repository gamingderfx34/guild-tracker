import { createClient } from '@supabase/supabase-js'
const supabaseUrl = 'https://mbalsusqtkbtoxuawjau.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1iYWxzdXNxdGtidG94dWF3amF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NTk3NzgsImV4cCI6MjA5NDIzNTc3OH0.jlVXg6yCUHG2B2YkO05rSK9S0uzJ8QmOgVsST-HVgOE'
export const supabase = createClient(supabaseUrl, supabaseKey)
