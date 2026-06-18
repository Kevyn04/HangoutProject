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
            colors={['transparent', 'rgba(255,255,255,0.9)', '#ffffff', 'rgba(255,255,255,0.9)', 'transparent']}
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
    backgroundColor: '#dc2626',
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
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  fluid: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
  },
});
