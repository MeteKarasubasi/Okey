import { supabase } from './supabase';

export async function saveFriendRequest(senderId: string | undefined, botKey: string) {
  if (!senderId || !supabase) return;
  await supabase.from('friendship_requests').insert({ sender_id: senderId, recipient_bot_key: botKey, status: 'pending' });
}

export async function saveGift(senderId: string | undefined, botKey: string, gift: { hours: number; cost: number; emoji: string; title: string }) {
  if (!senderId || !supabase) return { ok: true, remaining: null };
  const { data, error } = await supabase.rpc('send_bot_gift', {
    recipient_key: botKey, gift_hours: gift.hours, gift_cost: gift.cost,
    gift_emoji: gift.emoji, gift_title: gift.title,
  });
  if (!error && typeof data === 'number') return { ok: true, remaining: data };
  // A deployed RPC can reject insufficient funds or invalid input. Do not
  // fall back in that case; falling back would create a free gift.
  if (error && error.code !== 'PGRST202') return { ok: false, remaining: null };
  const fallback = await supabase.from('gift_events').insert({ sender_id: senderId, recipient_bot_key: botKey, hours: gift.hours, cost: gift.cost, emoji: gift.emoji, title: gift.title });
  return { ok: !fallback.error, remaining: null };
}
