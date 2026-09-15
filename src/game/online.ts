import { supabase } from '../supabase';
import type { Mode, RuleConfig } from './engine';

export type RemoteRoom = { mode: Mode; title: string; entryFee: number };

/** Persist the local match as a durable event stream when Supabase is enabled. */
export async function createGameSession(userId: string | undefined, room: RemoteRoom, rules: RuleConfig) {
  if (!userId || !supabase) return null;
  const { data, error } = await supabase.from('games').insert({
    created_by: userId, mode: room.mode, status: 'in_progress',
    round_count: rules.roundCount, current_turn: 0, rules,
  }).select('id').single();
  if (error || !data) return null;
  await supabase.from('game_players').insert({ game_id: data.id, player_id: userId, seat: 0 });
  return data.id as string;
}

export async function appendGameAction(gameId: string | undefined, playerId: string | undefined, actionType: string, payload: Record<string, unknown> = {}) {
  if (!gameId || !playerId || !supabase) return;
  await supabase.from('game_actions').insert({ game_id: gameId, sequence: Date.now(), player_id: playerId, action_type: actionType, payload });
}

export async function saveRoundResult(gameId: string | undefined, round: number, winner: number | null, finishType: string | null, scores: number[]) {
  if (!gameId || !supabase) return;
  await supabase.from('game_rounds').upsert({ game_id: gameId, round_no: round, status: 'finished', winner_seat: winner, finish_type: finishType, score_snapshot: scores }, { onConflict: 'game_id,round_no' });
}

export async function finishGameSession(gameId: string | undefined, finished: boolean) {
  if (!gameId || !supabase) return;
  await supabase.from('games').update({ status: finished ? 'finished' : 'round_finished' }).eq('id', gameId);
}
