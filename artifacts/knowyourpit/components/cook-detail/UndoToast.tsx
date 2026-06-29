import React, { useEffect, useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

interface UndoToastProps {
  stepLabel: string;
  bottom: number;
  onUndo: () => void;
  onDismiss: () => void;
}

const VISIBLE_MS = 4750;
const ANIMATE_IN_MS = 220;
const ANIMATE_OUT_MS = 250;

export function UndoToast({ stepLabel, bottom, onUndo, onDismiss }: UndoToastProps) {
  const anim = useRef(new Animated.Value(0)).current;
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: ANIMATE_IN_MS,
      useNativeDriver: true,
    }).start();

    dismissTimerRef.current = setTimeout(() => {
      Animated.timing(anim, {
        toValue: 0,
        duration: ANIMATE_OUT_MS,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) onDismiss();
      });
    }, VISIBLE_MS);

    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  const handleUndo = () => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    Animated.timing(anim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => onUndo());
  };

  return (
    <Animated.View
      style={{
        position: "absolute",
        bottom,
        left: 16,
        right: 16,
        backgroundColor: "#1C1C1F",
        borderColor: "#f59e0b",
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 8,
        zIndex: 9999,
        opacity: anim,
        transform: [
          {
            translateY: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [12, 0],
            }),
          },
        ],
      }}
    >
      <Feather name="check-circle" size={16} color="#f59e0b" />
      <Text
        style={{
          flex: 1,
          color: "#F3EDE1",
          fontFamily: "Inter_400Regular",
          fontSize: 13,
        }}
        numberOfLines={1}
      >
        <Text style={{ fontFamily: "Inter_600SemiBold" }}>{stepLabel}</Text>
        {" confirmed"}
      </Text>
      <Pressable
        onPress={handleUndo}
        hitSlop={10}
        style={{
          backgroundColor: "#f59e0b20",
          borderRadius: 6,
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderWidth: 1,
          borderColor: "#f59e0b40",
        }}
      >
        <Text
          style={{
            color: "#f59e0b",
            fontFamily: "Inter_600SemiBold",
            fontSize: 12,
          }}
        >
          Undo
        </Text>
      </Pressable>
    </Animated.View>
  );
}
