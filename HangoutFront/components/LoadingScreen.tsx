import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function LoadingScreen() {
  const translateX = useRef(new Animated.Value(-300)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(translateX, {
        toValue: 300,
        duration: 1200,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    ).start();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Loading</Text>
      <View style={styles.track}>
        <Animated.View style={[styles.fluid, { transform: [{ translateX }] }]}>
          <LinearGradient
            colors={['transparent', '#dc2626', '#ff4444', '#dc2626', 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#120303',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  text: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '500',
    letterSpacing: 2,
  },
  track: {
    width: 200,
    height: 4,
    backgroundColor: '#2a0a0a',
    borderRadius: 2,
    overflow: 'hidden',
  },
  fluid: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
  },
});
