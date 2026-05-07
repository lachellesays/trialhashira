import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://qdzdqzwbxbzqkwvvhgcc.supabase.co'
const supabaseKey = 'sb_publishable_SCXOFw_Re9D_rgP-9jCaEg_dQwNKVEe'

export const supabase = createClient(supabaseUrl, supabaseKey)