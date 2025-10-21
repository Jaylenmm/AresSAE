import { supabase } from '@/lib/supabase'

export async function upsertGame(payload: any) {
  const { data } = await supabase
    .from('games')
    .upsert(payload, { onConflict: 'espn_game_id', ignoreDuplicates: false })
    .select()
    .single()
  return data
}

export async function upsertOdds(payload: any, onConflict: string) {
  await supabase.from('odds_data').upsert(payload, { onConflict })
}

export async function upsertPlayerProp(payload: any, onConflict: string) {
  await supabase.from('player_props').upsert(payload, { onConflict })
}
