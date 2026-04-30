import { supabase } from "../config/supabase";

export const getOrCreateConversation = async (userA, userB) => {
  const { data, error } = await supabase.rpc("get_or_create_conversation", {
    user_a: userA,
    user_b: userB,
  });

  if (error) throw error;
  return data;
};