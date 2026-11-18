import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from './src/Theme';

const BAR_WIDTH = 160;
const FILL_WIDTH = 60;

export default function StartupSplashScreen() {
  // Each Animated.Value is like a dimmer knob we turn over time
  const logoScale = useRef(new Animated.Value(0.6)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const brandOpacity = useRef(new Animated.Value(0)).current;
  const brandSlide = useRef(new Animated.Value(16)).current;
  const captionOpacity = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const bar = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1) Intro: logo pops in -> brand name slides up -> caption fades in
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(brandOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(brandSlide, { toValue: 0, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.timing(captionOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();

    // 2) Loops: glowing ring + sliding loading bar
    const pulseLoop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true })
    );
    const barLoop = Animated.loop(
      Animated.timing(bar, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
    );
    pulseLoop.start();
    barLoop.start();

    // Stop loops when the screen goes away
    return () => {
      pulseLoop.stop();
      barLoop.stop();
    };
  }, []);

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });
  const barX = bar.interpolate({ inputRange: [0, 1], outputRange: [-FILL_WIDTH, BAR_WIDTH] });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.logoWrap}>
        <Animated.View
          style={[styles.ring, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]}
        />
        <Animated.Image
          source={require('./EchoReaderLogo.jpeg')}
          style={[styles.logo, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}
        />
      </View>

      <Animated.Text
        style={[styles.brand, { opacity: brandOpacity, transform: [{ translateY: brandSlide }] }]}
      >
        EchoReader
      </Animated.Text>

      <Animated.View
        style={[styles.track, { opacity: captionOpacity }]}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Getting EchoReader ready"
      >
        <Animated.View style={[styles.fill, { transform: [{ translateX: barX }] }]} />
      </Animated.View>

      <Animated.Text style={[styles.caption, { opacity: captionOpacity }]}>
        Getting EchoReader ready…
      </Animated.Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 20 },
  logoWrap: { width: 150, height: 150, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 2,
    borderColor: C.cyan,
  },
  logo: { width: 150, height: 150, borderRadius: 75 },
  brand: { color: C.text, fontSize: 27, fontWeight: '800', letterSpacing: 1 },
  track: {
    width: BAR_WIDTH,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: C.textMuted + '33', // faint track (20% opacity)
  },
  fill: { width: FILL_WIDTH, height: 4, borderRadius: 2, backgroundColor: C.cyan },
  caption: { color: C.textMuted, fontSize: 13 },
});