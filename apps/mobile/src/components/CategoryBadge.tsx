import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Category } from '../types';
import { getCategoryColor } from '../constants/colors';

interface Props {
  category: Category | undefined;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export default function CategoryBadge({ category, size = 'md', style }: Props) {
  if (!category) return null;

  const color = category.color_hex || getCategoryColor(category.id);
  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: `${color}20`,
          paddingHorizontal: isSmall ? 6 : 8,
          paddingVertical: isSmall ? 2 : 4,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.dot,
          {
            backgroundColor: color,
            width: isSmall ? 5 : 7,
            height: isSmall ? 5 : 7,
          },
        ]}
      />
      <Text
        style={[
          styles.label,
          {
            color,
            fontSize: isSmall ? 10 : 12,
          },
        ]}
        numberOfLines={1}
      >
        {category.name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    gap: 4,
    alignSelf: 'flex-start',
  },
  dot: {
    borderRadius: 99,
  },
  label: {
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
