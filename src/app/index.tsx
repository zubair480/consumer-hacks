import { useState } from "react";
import { Button, FlatList, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../convex/_generated/api";
import { useOwnedMutation, useOwnedQuery } from "../identity/OwnerProvider";

export default function Index() {
  const items = useOwnedQuery(api.items.list, {});
  const add = useOwnedMutation(api.items.create);
  const [text, setText] = useState("");

  const submit = async () => {
    if (!text.trim()) return;
    await add({ rawText: text.trim() });
    setText("");
  };

  return (
    <SafeAreaView style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 24, fontWeight: "600" }}>Items</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput
          testID="item-input"
          accessibilityLabel="New item"
          value={text}
          onChangeText={setText}
          onSubmitEditing={submit}
          placeholder="New item"
          style={{ flex: 1, borderWidth: 1, borderColor: "#ccc", borderRadius: 6, padding: 8 }}
        />
        <Button testID="add-button" title="Add" onPress={submit} />
      </View>
      <FlatList
        data={items ?? []}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => <Text style={{ fontSize: 16, paddingVertical: 6 }}>{item.title ?? item.sourceUrl ?? item.rawText ?? "Image"}</Text>}
      />
    </SafeAreaView>
  );
}
