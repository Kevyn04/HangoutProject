import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { StoryGroup } from '@/services/api';

type Props = {
  groups: StoryGroup[];
  me: string;
  seenIds: Set<number>;
  posting: boolean;
  onAddStory: () => void;
  onOpen: (username: string) => void;
};

export function StoryBar({ groups, me, seenIds, posting, onAddStory, onOpen }: Props) {
  const myGroup = groups.find((g) => g.username === me);
  const others = groups.filter((g) => g.username !== me);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.row}
      style={s.bar}
    >
      {/* Your story: opens if you have one, camera-roll picker adds a new one */}
      <View style={s.slot}>
        <Pressable
          style={s.ringWrap}
          onPress={() => (myGroup ? onOpen(me) : onAddStory())}
          disabled={posting}
        >
          <View style={[s.ring, myGroup ? s.ringUnseen : s.ringNone]}>
            {myGroup ? (
              <Image source={{ uri: myGroup.stories[myGroup.stories.length - 1].imageUrl }} style={s.thumb} contentFit="cover" />
            ) : (
              <View style={[s.thumb, s.thumbEmpty]}>
                {posting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons name="add" size={26} color="rgba(255,255,255,0.8)" />
                )}
              </View>
            )}
          </View>
          {!!myGroup && (
            <Pressable style={s.addBadge} onPress={onAddStory} disabled={posting} hitSlop={6}>
              {posting
                ? <ActivityIndicator color="#fff" size={10 as any} />
                : <Ionicons name="add" size={12} color="#fff" />}
            </Pressable>
          )}
        </Pressable>
        <Text style={s.name} numberOfLines={1}>Your story</Text>
      </View>

      {others.map((g) => {
        const unseen = g.stories.some((st) => !seenIds.has(st.id));
        return (
          <View key={g.username} style={s.slot}>
            <Pressable style={s.ringWrap} onPress={() => onOpen(g.username)}>
              <View style={[s.ring, unseen ? s.ringUnseen : s.ringSeen]}>
                <Image
                  source={{ uri: g.stories[g.stories.length - 1].imageUrl }}
                  style={s.thumb}
                  contentFit="cover"
                />
              </View>
            </Pressable>
            <Text style={s.name} numberOfLines={1}>{g.username}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  bar: { marginTop: 12 },
  row: { paddingHorizontal: 20, gap: 14 },
  slot: { width: 66, alignItems: 'center', gap: 5 },
  ringWrap: { position: 'relative' },
  ring: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5,
  },
  ringUnseen: { borderColor: '#7c3aed' },
  ringSeen: { borderColor: 'rgba(255,255,255,0.2)' },
  ringNone: { borderColor: 'rgba(255,255,255,0.2)', borderStyle: 'dashed' },
  thumb: { width: 54, height: 54, borderRadius: 27 },
  thumbEmpty: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  addBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#120303',
  },
  name: { color: 'rgba(255,255,255,0.6)', fontSize: 11, maxWidth: 66, textAlign: 'center' },
});
