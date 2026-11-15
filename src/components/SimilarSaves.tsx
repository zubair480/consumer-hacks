import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useOwnerId } from "../identity/OwnerProvider";
import type { SavedItemView } from "../shared/contracts";
import { ItemCard } from "./ItemCard";
import { Section } from "./Section";
import { space } from "./tokens";

/** Horizontal row of saves similar to this one. Renders nothing until there are results. */
export function SimilarSaves({ itemId }: { itemId: Id<"savedItems"> }) {
  const ownerId = useOwnerId();
  const findSimilar = useAction(api.similar.forItem);
  const [items, setItems] = useState<SavedItemView[]>([]);

  useEffect(() => {
    let cancelled = false;
    findSimilar({ ownerId, itemId })
      .then((rows) => !cancelled && setItems(rows))
      .catch(() => !cancelled && setItems([]));
    return () => {
      cancelled = true;
    };
  }, [findSimilar, ownerId, itemId]);

  if (items.length === 0) return null;
  return (
    <View testID="similar-saves">
      <Section title="Similar saves">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} testID="similar-saves-list" contentContainerStyle={styles.row}>
          {items.map((item) => (
            <ItemCard key={item._id} item={item} compact />
          ))}
        </ScrollView>
      </Section>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: space.md },
});
