import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, Modal, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const CAPTION_MAX = 200; // matches stories.caption CHECK (migration 018)

// Full-screen preview shown after picking a story photo: optional caption,
// then Share. Pass uri=null to hide. Always dark, like the story viewer.
export function StoryComposer({
  uri, posting, onCancel, onPost,
}: {
  uri: string | null;
  posting: boolean;
  onCancel: () => void;
  onPost: (caption: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [caption, setCaption] = useState("");

  useEffect(() => { if (uri) setCaption(""); }, [uri]);

  return (
    <Modal visible={!!uri} animationType="slide" presentationStyle="fullScreen" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={s.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[s.header, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={onCancel} disabled={posting} hitSlop={12}>
            <Text style={s.cancel}>Cancel</Text>
          </Pressable>
          <Text style={s.title}>New Story</Text>
          <Pressable
            style={[s.shareBtn, posting && { opacity: 0.6 }]}
            onPress={() => onPost(caption)}
            disabled={posting}
          >
            {posting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.shareText}>Share</Text>}
          </Pressable>
        </View>

        {!!uri && <Image source={{ uri }} style={s.preview} contentFit="contain" />}

        <View style={[s.captionRow, { paddingBottom: insets.bottom + 12 }]}>
          <TextInput
            style={s.input}
            value={caption}
            onChangeText={setCaption}
            placeholder="Add a caption…"
            placeholderTextColor="rgba(255,255,255,0.45)"
            maxLength={CAPTION_MAX}
            multiline
            editable={!posting}
          />
          {caption.length > CAPTION_MAX - 40 && (
            <Text style={s.counter}>{CAPTION_MAX - caption.length}</Text>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12,
  },
  cancel: { color: "#fff", fontSize: 16 },
  title: { color: "#fff", fontSize: 16, fontWeight: "700" },
  shareBtn: {
    backgroundColor: "#dc2626", borderRadius: 18, minWidth: 72, height: 36,
    paddingHorizontal: 16, alignItems: "center", justifyContent: "center",
  },
  shareText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  preview: { flex: 1 },
  captionRow: { paddingHorizontal: 16, paddingTop: 12 },
  input: {
    color: "#fff", fontSize: 15, maxHeight: 100,
    backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 14,
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10,
  },
  counter: { color: "rgba(255,255,255,0.5)", fontSize: 11, alignSelf: "flex-end", marginTop: 4 },
});
