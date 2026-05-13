export const DEFAULT_COLLECTION_COVER = require('@/assets/images/placeholders/default-collection.png') as number;

export const CATEGORY_COVERS = {
  coffee: require('@/assets/images/planner/categories/categories-coffee.png'),
  culture: require('@/assets/images/planner/categories/categories-culture.png'),
  food: require('@/assets/images/planner/categories/categories-food.png'),
  history: require('@/assets/images/planner/categories/categories-history.png'),
  museums: require('@/assets/images/planner/categories/categories-museums.png'),
  nature: require('@/assets/images/planner/categories/categories-nature.png'),
  nightlife: require('@/assets/images/planner/categories/categories-nightlife.png'),
  shopping: require('@/assets/images/planner/categories/categories-shopping.png'),
} as const;

export type CategoryKey = keyof typeof CATEGORY_COVERS;

export function getCover(): number {
  return DEFAULT_COLLECTION_COVER;
}
