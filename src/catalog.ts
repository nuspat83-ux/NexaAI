export type CatalogMode = 'products' | 'menu' | 'services' | 'none';

export interface ProductVariant {
  id: string;
  label: string;
  value: string;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  price?: number;
  salePrice?: number;
  currency?: string;
  category?: string;
  images?: string[];
  variants?: ProductVariant[];
  size?: string;
  color?: string;
  stock?: string;
  sku?: string;
  featured?: boolean;
  tags?: string[];
  customFields?: Record<string, string>;
}

export interface ServiceItem {
  id: string;
  name: string;
  description?: string;
  price?: number;
  currency?: string;
  category?: string;
  image?: string;
  featured?: boolean;
  tags?: string[];
  customFields?: Record<string, string>;
}

export interface CatalogData {
  mode: CatalogMode;
  products: Product[];
  services: ServiceItem[];
  payment?: 'whatsapp' | 'cod' | 'online' | 'both' | 'unknown';
  orderFlow?: 'none' | 'whatsapp' | 'cart' | 'checkout';
  delivery?: {
    local?: boolean;
    shipping?: boolean;
    pickup?: boolean;
    notes?: string;
    areas?: string;
  };
}

export type CatalogFieldKey =
  | 'name'
  | 'description'
  | 'price'
  | 'salePrice'
  | 'category'
  | 'images'
  | 'variants'
  | 'size'
  | 'color'
  | 'stock'
  | 'sku'
  | 'featured'
  | 'tags'
  | 'ageGroup'
  | 'specifications'
  | 'vegetarian';

export interface CatalogFieldConfig {
  key: CatalogFieldKey;
  label: string;
  placeholder: string;
  optional?: boolean;
  multiline?: boolean;
}

const commonFields: CatalogFieldConfig[] = [
  { key: 'name', label: 'Name', placeholder: 'Product name' },
  { key: 'price', label: 'Price', placeholder: '₹1,299', optional: true },
  { key: 'category', label: 'Category', placeholder: 'e.g. Dresses', optional: true },
  { key: 'images', label: 'Image', placeholder: 'Asset filename, optional', optional: true },
];

export function catalogModeForCategory(category: string): CatalogMode {
  if (category === 'E-commerce') return 'products';
  if (category === 'Restaurant' || category === 'Cafe') return 'menu';
  if (['Portfolio', 'Personal Brand', 'Local Business', 'Real Estate', 'Construction', 'Legal', 'Finance', 'Healthcare', 'Fitness', 'Beauty / Salon', 'Hotel', 'Travel', 'Agency', 'Technology', 'SaaS', 'Education'].includes(category)) return category === 'Portfolio' || category === 'Personal Brand' || category === 'Agency' || category === 'Technology' || category === 'SaaS' || category === 'Education' ? 'services' : 'services';
  return 'none';
}

export function catalogFieldsForCategory(category: string, businessHint = ''): CatalogFieldConfig[] {
  if (category === 'E-commerce') {
    if (/clothing|fashion|apparel|dress|kurti|boutique/i.test(businessHint)) {
      return [...commonFields, { key: 'size', label: 'Sizes', placeholder: 'S, M, L', optional: true }, { key: 'color', label: 'Colors', placeholder: 'Black, blue', optional: true }, { key: 'stock', label: 'Stock', placeholder: 'In stock / unknown', optional: true }];
    }
    return [...commonFields, { key: 'variants', label: 'Variants', placeholder: 'e.g. 128GB; 256GB', optional: true }, { key: 'stock', label: 'Stock', placeholder: 'In stock / unknown', optional: true }];
  }
  if (category === 'Cafe' || category === 'Restaurant') {
    return [...commonFields, { key: 'description', label: 'Description', placeholder: 'What is this item?', optional: true, multiline: true }, { key: 'tags', label: 'Tags', placeholder: 'Vegetarian, spicy, bestseller', optional: true }, { key: 'vegetarian', label: 'Dietary info', placeholder: 'Vegetarian / non-vegetarian', optional: true }];
  }
  if (category === 'E-commerce' && /toy|kids/i.test(businessHint)) return [...commonFields, { key: 'ageGroup', label: 'Age group', placeholder: '3–5 years', optional: true }, { key: 'stock', label: 'Stock', placeholder: 'In stock / unknown', optional: true }];
  if (category === 'E-commerce' && /electronic|gadget|computer|phone/i.test(businessHint)) return [...commonFields, { key: 'specifications', label: 'Specifications', placeholder: 'Key technical specs', optional: true, multiline: true }, { key: 'stock', label: 'Stock', placeholder: 'In stock / unknown', optional: true }];
  return [
    { key: 'name', label: 'Service', placeholder: 'Service name' },
    { key: 'description', label: 'Details', placeholder: 'What is included?', optional: true, multiline: true },
    { key: 'price', label: 'Price', placeholder: 'Starting at ₹…', optional: true },
    { key: 'category', label: 'Category', placeholder: 'e.g. Consultation', optional: true },
    { key: 'images', label: 'Image', placeholder: 'Asset filename, optional', optional: true },
  ];
}

export function emptyProduct(id: string): Product {
  return { id, name: '', currency: 'INR', images: [], variants: [], tags: [] };
}

export function emptyService(id: string): ServiceItem {
  return { id, name: '', currency: 'INR', tags: [] };
}

export function parseOptionalPrice(value: string): number | undefined {
  const cleaned = value.replace(/[^0-9.]/g, '');
  if (!cleaned) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}
