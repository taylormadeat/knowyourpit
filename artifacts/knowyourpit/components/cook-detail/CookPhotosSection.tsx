import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Image,
  Modal,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useAuth } from "@clerk/expo";
import {
  useListCookPhotos,
  useDeleteCookPhoto,
  getListCookPhotosQueryKey,
  type CookPhoto,
} from "@workspace/api-client-react";

const MAX_PHOTOS = 10;
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "");

interface Props {
  cookId: number;
  colors: any;
}

async function compressToJpeg(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}

export function CookPhotosSection({ cookId, colors }: Props) {
  const qc = useQueryClient();
  const { getToken } = useAuth();
  const { data: photos = [], isLoading } = useListCookPhotos(cookId);
  const deletePhoto = useDeleteCookPhoto();

  const [uploading, setUploading] = useState(false);
  const [viewerPhoto, setViewerPhoto] = useState<CookPhoto | null>(null);
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());

  const markUrlFailed = useCallback((url: string) => {
    setFailedUrls((prev) => new Set(prev).add(url));
  }, []);

  const handleReload = useCallback(async () => {
    setFailedUrls(new Set());
    await qc.invalidateQueries({ queryKey: getListCookPhotosQueryKey(cookId) });
  }, [qc, cookId]);

  const handleAddPhoto = useCallback(() => {
    Alert.alert("Add Photo", "Choose a source", [
      { text: "Camera", onPress: () => openCamera() },
      { text: "Photo Library", onPress: () => openLibrary() },
      { text: "Cancel", style: "cancel" },
    ]);
  }, []);

  const uploadImage = async (uri: string) => {
    setUploading(true);
    try {
      const compressedUri = await compressToJpeg(uri);
      const token = await getToken();
      const formData = new FormData();
      formData.append("photo", {
        uri: compressedUri,
        name: `cook-${cookId}-${Date.now()}.jpg`,
        type: "image/jpeg",
      } as any);

      const response = await fetch(`${API_BASE_URL}/api/cooks/${cookId}/photos`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? `Upload failed (${response.status})`);
      }

      await qc.invalidateQueries({ queryKey: getListCookPhotosQueryKey(cookId) });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert("Upload Failed", err.message ?? "Could not upload photo. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const openCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Camera Permission", "Allow camera access to take photos of your cook.");
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 1, mediaTypes: ["images"] });
    if (!res.canceled && res.assets[0]) {
      await uploadImage(res.assets[0].uri);
    }
  };

  const openLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Library Permission", "Allow photo library access to pick photos.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      quality: 1,
      mediaTypes: ["images"],
      allowsMultipleSelection: false,
    });
    if (!res.canceled && res.assets[0]) {
      await uploadImage(res.assets[0].uri);
    }
  };

  const confirmDelete = (photo: CookPhoto) => {
    Alert.alert(
      "Delete Photo?",
      "This photo will be permanently removed from this cook.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setViewerPhoto(null);
            try {
              await deletePhoto.mutateAsync({ id: cookId, photoId: photo.id });
              await qc.invalidateQueries({ queryKey: getListCookPhotosQueryKey(cookId) });
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            } catch {
              Alert.alert("Delete Failed", "Could not delete the photo. Please try again.");
            }
          },
        },
      ]
    );
  };

  const photoList = Array.isArray(photos) ? photos : [];
  const canAddMore = photoList.length < MAX_PHOTOS && !uploading;

  const viewerUrlFailed =
    !!viewerPhoto?.signedUrl && failedUrls.has(viewerPhoto.signedUrl);
  const viewerHasUrl = !!viewerPhoto?.signedUrl && !viewerUrlFailed;

  return (
    <View style={[st.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={st.header}>
        <Feather name="camera" size={15} color={colors.foreground} />
        <Text style={[st.title, { color: colors.foreground }]}>Photos</Text>
        {photoList.length > 0 && (
          <Text style={[st.count, { color: colors.mutedForeground }]}>{photoList.length}/{MAX_PHOTOS}</Text>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.scroll} contentContainerStyle={st.scrollContent}>
          {photoList.map((photo) => {
            const urlFailed = !!photo.signedUrl && failedUrls.has(photo.signedUrl);
            return (
              <Pressable
                key={photo.id}
                onPress={() => setViewerPhoto(photo)}
                style={({ pressed }) => [st.thumb, pressed && { opacity: 0.7 }]}
              >
                {photo.signedUrl && !urlFailed ? (
                  <Image
                    source={{ uri: photo.signedUrl }}
                    style={st.thumbImg}
                    onError={() => photo.signedUrl && markUrlFailed(photo.signedUrl)}
                  />
                ) : (
                  <View style={[st.thumbImg, { backgroundColor: colors.border, justifyContent: "center", alignItems: "center" }]}>
                    <Feather name="refresh-cw" size={16} color={colors.mutedForeground} />
                  </View>
                )}
              </Pressable>
            );
          })}

          {uploading && (
            <View style={[st.thumb, { backgroundColor: colors.border, justifyContent: "center", alignItems: "center" }]}>
              <ActivityIndicator color={colors.primary} />
            </View>
          )}

          {canAddMore && (
            <Pressable
              onPress={handleAddPhoto}
              style={({ pressed }) => [
                st.thumb,
                st.addBtn,
                { backgroundColor: colors.border, borderColor: colors.mutedForeground },
                pressed && { opacity: 0.6 },
              ]}
            >
              <Feather name="plus" size={22} color={colors.mutedForeground} />
            </Pressable>
          )}

          {photoList.length === 0 && !uploading && (
            <Text style={[st.empty, { color: colors.mutedForeground }]}>
              No photos yet — tap + to add one
            </Text>
          )}
        </ScrollView>
      )}

      {/* Full-screen viewer */}
      <Modal visible={viewerPhoto !== null} transparent animationType="fade" onRequestClose={() => setViewerPhoto(null)}>
        <View style={st.viewerOverlay}>
          <Pressable style={st.viewerClose} onPress={() => setViewerPhoto(null)}>
            <Feather name="x" size={24} color="#fff" />
          </Pressable>

          {viewerHasUrl ? (
            <Image
              source={{ uri: viewerPhoto!.signedUrl! }}
              style={st.viewerImg}
              resizeMode="contain"
              onError={() => viewerPhoto?.signedUrl && markUrlFailed(viewerPhoto.signedUrl)}
            />
          ) : (
            <View style={st.viewerPlaceholder}>
              <Feather name="image" size={48} color="#ffffff55" />
              <Text style={{ color: "#ffffff88", marginTop: 8 }}>
                {viewerUrlFailed ? "Link expired" : "Photo unavailable"}
              </Text>
              {viewerUrlFailed && (
                <Pressable style={st.reloadBtn} onPress={handleReload}>
                  <Feather name="refresh-cw" size={14} color="#fff" />
                  <Text style={st.reloadText}>Reload photos</Text>
                </Pressable>
              )}
            </View>
          )}

          <Pressable style={st.viewerDelete} onPress={() => viewerPhoto && confirmDelete(viewerPhoto)}>
            <Feather name="trash-2" size={20} color="#ef4444" />
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    flex: 1,
  },
  count: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  scroll: {
    paddingBottom: 14,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  thumb: {
    width: 80,
    height: 80,
    borderRadius: 10,
    overflow: "hidden",
  },
  thumbImg: {
    width: 80,
    height: 80,
    borderRadius: 10,
  },
  addBtn: {
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderStyle: "dashed",
  },
  empty: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    paddingVertical: 16,
    paddingRight: 14,
  },
  viewerOverlay: {
    flex: 1,
    backgroundColor: "#000000ee",
    justifyContent: "center",
    alignItems: "center",
  },
  viewerClose: {
    position: "absolute",
    top: 60,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ffffff22",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  viewerDelete: {
    position: "absolute",
    bottom: 60,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#ef444422",
    borderWidth: 1,
    borderColor: "#ef444455",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  viewerImg: {
    width: "100%",
    height: "70%",
  },
  viewerPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  reloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 16,
    backgroundColor: "#ffffff22",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  reloadText: {
    color: "#fff",
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
});
