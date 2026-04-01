import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function MapScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Map is only available on the mobile app.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#120303",
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
  },
});
