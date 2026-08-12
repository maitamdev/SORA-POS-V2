import type { Product } from '../types/domain.type';

export const PRODUCTS_CHANGED_EVENT = 'sora:products-changed';

export type ProductMutation = {
  action: 'created' | 'updated' | 'deleted' | 'bulk';
  product?: Product;
  productId?: string;
};

type ProductMutationListener = (mutation: ProductMutation) => void;

const listeners = new Set<ProductMutationListener>();
let productsChannel: BroadcastChannel | null = null;

const isProductMutation = (value: unknown): value is ProductMutation => {
  if (!value || typeof value !== 'object') return false;
  const action = (value as { action?: unknown }).action;
  return action === 'created' || action === 'updated' || action === 'deleted' || action === 'bulk';
};

const ensureProductsChannel = () => {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null;
  if (!productsChannel) {
    productsChannel = new BroadcastChannel('sora-pos-products');
    productsChannel.onmessage = (event) => {
      if (!isProductMutation(event.data)) return;
      listeners.forEach((listener) => listener(event.data));
    };
  }
  return productsChannel;
};

export const publishProductMutation = (mutation: ProductMutation) => {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent<ProductMutation>(PRODUCTS_CHANGED_EVENT, { detail: mutation })
  );
  ensureProductsChannel()?.postMessage(mutation);
};

export const subscribeProductMutations = (listener: ProductMutationListener) => {
  if (typeof window === 'undefined') return () => undefined;

  const handleWindowEvent = (event: Event) => {
    const mutation = (event as CustomEvent<ProductMutation>).detail;
    if (isProductMutation(mutation)) listener(mutation);
  };

  listeners.add(listener);
  window.addEventListener(PRODUCTS_CHANGED_EVENT, handleWindowEvent);
  ensureProductsChannel();

  return () => {
    listeners.delete(listener);
    window.removeEventListener(PRODUCTS_CHANGED_EVENT, handleWindowEvent);
    if (listeners.size === 0 && productsChannel) {
      productsChannel.close();
      productsChannel = null;
    }
  };
};
