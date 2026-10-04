import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { registerPushToken } from "@/services/api";

// The DM partner whose chat is open right now (set by dm-chat.tsx), so a
// push for a message you're already looking at doesn't banner/buzz.
let activeDmPartner: string | null = null;
export function setActiveDmPartner(partner: string | null) {
  activeDmPartner = partner;
}

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = (notification.request.content.data ?? {}) as Record<string, any>;
    const show = !(data.type === "dm" && data.sender && data.sender === activeDmPartner);
    return {
      shouldShowAlert: show,
      shouldPlaySound: show,
      shouldSetBadge: false,
      shouldShowBanner: show,
      shouldShowList: show,
    };
  },
});

export function usePushNotifications(username: string | null) {
  useEffect(() => {
    if (!username) return;

    async function register() {
      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;

      if (existing !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") return;

      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "default",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
        });
      }

      const tokenData = await Notifications.getExpoPushTokenAsync();
      if (username) await registerPushToken(username, tokenData.data);
    }

    register().catch(console.error);
  }, [username]);
}

// Routes a tapped push to the screen it's about. useLastNotificationResponse
// also covers cold starts (app launched by the tap). `ready` should be false
// until auth has settled, so the target screen loads with a session.
export function useNotificationTapRouting(ready: boolean) {
  const router = useRouter();
  const response = Notifications.useLastNotificationResponse();
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    if (!ready || !response) return;
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;

    const id = response.notification.request.identifier;
    if (handledRef.current === id) return;
    handledRef.current = id;
    Notifications.clearLastNotificationResponse();

    const data = (response.notification.request.content.data ?? {}) as Record<string, any>;
    if (data.type === "dm" && data.sender) {
      router.push({ pathname: "/dm-chat", params: { partner: String(data.sender) } });
    } else if (data.type === "invite") {
      // Invites are accepted/declined from the inbox, not the target screen.
      router.push("/notifications");
    } else if (data.bubbleId) {
      router.push({ pathname: "/bubble-detail", params: { id: String(data.bubbleId) } });
    } else if (data.eventId) {
      router.push({ pathname: "/event-details", params: { id: String(data.eventId) } });
    } else {
      router.push("/notifications");
    }
  }, [ready, response, router]);
}
