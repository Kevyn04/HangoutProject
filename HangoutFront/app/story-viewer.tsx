import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Animated, Dimensions, Pressable,
  StyleSheet, Text, View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { deleteStory, getActiveStories, Story } from "@/services/api";
import { useAuth } from "@/services/auth-context";
import { useToast } from "@/context/ToastContext";

const SEEN_KEY = "@hangout/seen_stories";
const STORY_MS = 5000;
const { width: SCREEN_W } = Dimensions.get("window");

async function markSeen(id: number) {
  try {
    const raw = await AsyncStorage.getItem(SEEN_KEY);
    const ids: number[] = raw ? JSON.parse(raw) : [];
    if (!ids.includes(id)) {
      // Keep the list bounded — old ids belong to expired stories anyway
      const next = [...ids, id].slice(-500);
      await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(next));
    }
  } catch {}
}

function timeAgo(dateStr: string): string {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h`;
}

export default function StoryViewerScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { user } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  const [stories, setStories] = useState<Story[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const progress = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!user || !username) return;
    getActiveStories(user)
      .then((groups) => {
        const group = groups.find((g) => g.username === username);
        if (!group) {
          router.back();
          return;
        }
        setStories(group.stories);
      })
      .catch(() => {
        showToast("Couldn't load stories.");
        router.back();
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, username]);

  const goNext = useCallback(() => {
    setIndex((i) => {
      if (i + 1 >= stories.length) {
        router.back();
        return i;
      }
      return i + 1;
    });
  }, [stories.length, router]);

  const goPrev = () => setIndex((i) => Math.max(0, i - 1));

  // Per-story timer + seen tracking
  useEffect(() => {
    const story = stories[index];
    if (!story) return;
    markSeen(story.id);

    progress.setValue(0);
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: STORY_MS,
      useNativeDriver: false,
    });
    animRef.current = anim;
    anim.start(({ finished }) => {
      if (finished) goNext();
    });
    return () => anim.stop();
  }, [index, stories, progress, goNext]);

  const handleDelete = () => {
    const story = stories[index];
    if (!story) return;
    Alert.alert("Delete Story", "Remove this story for everyone?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            await deleteStory(story.id);
            const remaining = stories.filter((st) => st.id !== story.id);
            if (remaining.length === 0) {
              router.back();
            } else {
              setStories(remaining);
              setIndex((i) => Math.min(i, remaining.length - 1));
            }
          } catch {
            showToast("Couldn't delete story.");
          }
        },
      },
    ]);
  };

  const story = stories[index];

  if (loading || !story) {
    return (
      <View style={s.container}>
        <ActivityIndicator size="large" color="#fff" style={{ flex: 1 }} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <Image source={{ uri: story.imageUrl }} style={StyleSheet.absoluteFill} contentFit="contain" transition={100} />

      {/* Tap zones: left third = back, rest = forward */}
      <Pressable style={s.leftZone} onPress={goPrev} />
      <Pressable style={s.rightZone} onPress={goNext} />

      {/* Progress bars */}
      <View style={s.progressRow} pointerEvents="none">
        {stories.map((st, i) => (
          <View key={st.id} style={s.progressTrack}>
            <Animated.View
              style={[
                s.progressFill,
                i < index && { width: "100%" },
                i === index && {
                  width: progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
                },
              ]}
            />
          </View>
        ))}
      </View>

      {/* Header */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.username}>@{story.username}</Text>
          <Text style={s.time}>{timeAgo(story.createdAt)}</Text>
        </View>
        {story.username === user && (
          <Pressable style={s.headerBtn} onPress={handleDelete} hitSlop={8}>
            <Ionicons name="trash-outline" size={20} color="#fff" />
          </Pressable>
        )}
        <Pressable style={s.headerBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>
      </View>

      {/* Caption */}
      {!!story.caption && (
        <View style={s.captionBox} pointerEvents="none">
          <Text style={s.caption}>{story.caption}</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  leftZone: { position: "absolute", left: 0, top: 0, bottom: 0, width: SCREEN_W / 3 },
  rightZone: { position: "absolute", right: 0, top: 0, bottom: 0, width: (SCREEN_W / 3) * 2 },

  progressRow: {
    position: "absolute", top: 54, left: 12, right: 12,
    flexDirection: "row", gap: 4,
  },
  progressTrack: {
    flex: 1, height: 3, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.25)", overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: "#fff", width: "0%" },

  header: {
    position: "absolute", top: 66, left: 16, right: 12,
    flexDirection: "row", alignItems: "center", gap: 8,
  },
  username: { color: "#fff", fontSize: 15, fontWeight: "800" },
  time: { color: "rgba(255,255,255,0.6)", fontSize: 12 },
  headerBtn: { padding: 8 },

  captionBox: {
    position: "absolute", bottom: 48, left: 20, right: 20,
    backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  caption: { color: "#fff", fontSize: 15, lineHeight: 21, textAlign: "center" },
});
