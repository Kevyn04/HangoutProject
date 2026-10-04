import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { getBlockedUsers } from "@/services/api";

// Usernames the current user has blocked, refreshed whenever the screen
// regains focus (so blocking/unblocking on a profile applies on return).
// Fails open to an empty set — a failed fetch shouldn't break the screen.
export function useBlockedUsers(user: string | null | undefined): Set<string> {
  const [blocked, setBlocked] = useState<Set<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      let active = true;
      getBlockedUsers(user)
        .then((list) => { if (active) setBlocked(new Set(list)); })
        .catch(() => {});
      return () => { active = false; };
    }, [user])
  );

  return blocked;
}
