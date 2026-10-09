/**
 * Shop store — live BeaTrackFam catalog, cart/wishlist, auth + profile.
 *
 * Catalog (products/collections) loads from the live storefront on mount.
 * Cart and wishlist are app-local; checkout hands off to Shopify's secure
 * checkout via a cart permalink (no API token needed).
 * Auth is device-local app accounts (lib/accounts.ts) — sign-in never
 * depends on Shopify's Customer Account API. Checkout attaches the buyer's
 * name/email/address to the Shopify cart so orders link to the customer
 * in Shopify admin.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { fetchPurchasableVariantIds } from "../lib/storefront";
import {
  INITIAL_CART,
  INITIAL_WISHLIST_IDS,
  fetchCollections,
  fetchProducts,
  formatMoney,
  type CartLine,
  type Collection,
  type MoneyV2,
  type Product,
  type ProductVariant,
} from "../data/mock";
import {
  clearLocalProfile,
  getLocalProfile,
  saveLocalProfile,
  startLogin as startShopifyLogin,
  type LocalAddress,
  type LocalProfile,
  type SocialHandles,
} from "../lib/customer";
import {
  addOrderReceipt as persistOrderReceipt,
  requestCancelOrderReceipt,
  changePassword as changeAccountPassword,
  createAccount,
  deleteCurrentAccount,
  getCurrentAccount,
  saveAccount,
  signIn as signInToAccount,
  signInWithShopifyCustomer,
  linkShopifyOrderToCurrentAccount,
  signOutAccount,
  type AccountResult,
  type AppAccount,
  type LinkedShopifyOrder,
  type OrderReceipt,
} from "../lib/accounts";
import {
  getOnboardingDone,
  markOnboardingDone,
} from "../lib/onboarding";

interface ShopContextValue {
  // Live catalog
  products: Product[];
  collections: Collection[];
  catalogLoading: boolean;
  catalogError: string | null;
  refreshCatalog: () => void;
  getProduct: (numericId: string) => Product | undefined;
  // Cart + wishlist
  cartLines: CartLine[];
  wishlistIds: string[];
  cartCount: number;
  subtotal: MoneyV2;
  addToCart: (
    product: Product,
    variant: ProductVariant,
    quantity: number
  ) => void;
  isVariantPurchasable: (variantId: string) => boolean;
  updateQuantity: (lineId: string, quantity: number) => void;
  removeLine: (lineId: string) => void;
  clearCart: () => void;
  toggleWishlist: (productId: string) => void;
  removeFromWishlist: (productId: string) => void;
  isWishlisted: (productId: string) => boolean;
  // Auth — device-local app accounts (lib/accounts.ts). Sign-in never
  // depends on Shopify, so a Shopify API hiccup can't lock anyone out.
  account: AppAccount | null;
  orders: OrderReceipt[];
  authLoading: boolean;
  onboardingDone: boolean;
  isGuest: boolean;
  signUp: (
    name: string,
    email: string,
    password: string
  ) => Promise<AccountResult>;
  signIn: (email: string, password: string) => Promise<AccountResult>;
  /** Continue with Shopify → the same one app account, linked by email. */
  signInWithShopify: () => Promise<AccountResult>;
  linkShopifyOrder: (order: LinkedShopifyOrder) => Promise<void>;
  signOut: () => Promise<void>;
  continueAsGuest: () => Promise<void>;
  changePassword: (
    oldPassword: string,
    newPassword: string
  ) => Promise<AccountResult>;
  deleteAccount: (
    password: string
  ) => Promise<{ ok: boolean; reason?: string }>;
  addOrderReceipt: (
    receipt: Omit<OrderReceipt, "placedAt">
  ) => Promise<void>;
  cancelOrder: (orderId: string) => Promise<void>;
  reloadAccount: () => Promise<void>;
  // Profile-local extras (device-persisted, work with or without login)
  profile: LocalProfile;
  updateProfile: (patch: Partial<LocalProfile>) => Promise<void>;
  setAvatar: (uri: string | null) => Promise<void>;
  addAddress: (address: Omit<LocalAddress, "id">) => Promise<void>;
  updateAddress: (id: string, patch: Partial<LocalAddress>) => Promise<void>;
  removeAddress: (id: string) => Promise<void>;
  setDefaultAddress: (id: string) => Promise<void>;
  toggleInterest: (interest: string) => Promise<void>;
  setSocial: (key: keyof SocialHandles, value: string) => Promise<void>;
  eraseLocalData: () => Promise<void>;
}

const ShopContext = createContext<ShopContextValue | null>(null);

let lineSeq = 100;

export function ShopProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [purchasableVariantIds, setPurchasableVariantIds] =
    useState<Set<string> | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [cartLines, setCartLines] = useState<CartLine[]>(INITIAL_CART);
  const [wishlistIds, setWishlistIds] = useState<string[]>(INITIAL_WISHLIST_IDS);

  // ---- Auth + profile state ----
  const [account, setAccount] = useState<AppAccount | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [onboardingDone, setOnboardingDone] = useState(false);
  // Device-local profile for guests. Signed-in members keep their
  // profile on their account instead.
  const [deviceProfile, setDeviceProfile] = useState<LocalProfile>({
    addresses: [],
    interests: [],
    socials: { instagram: "", tiktok: "", facebook: "", x: "" },
    avatarUri: null,
    firstName: "",
    lastName: "",
    phone: "",
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [current, localProfile, done] = await Promise.all([
          getCurrentAccount(),
          getLocalProfile(),
          getOnboardingDone(),
        ]);
        if (cancelled) return;
        setAccount(current);
        setDeviceProfile(localProfile);
        setOnboardingDone(done);
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signUp = useCallback(
    async (
      name: string,
      email: string,
      password: string
    ): Promise<AccountResult> => {
      // A guest's device-local profile (addresses etc.) moves into the
      // new account so nothing they've saved is lost.
      const seed = await getLocalProfile();
      const result = await createAccount({
        name,
        email,
        password,
        seedProfile: seed,
      });
      if (result.ok) {
        setAccount(result.account);
        setOnboardingDone(true);
        void markOnboardingDone();
      }
      return result;
    },
    []
  );

  const signIn = useCallback(
    async (email: string, password: string): Promise<AccountResult> => {
      const result = await signInToAccount({ email, password });
      if (result.ok) {
        setAccount(result.account);
        setOnboardingDone(true);
        void markOnboardingDone();
      }
      return result;
    },
    []
  );

  /** Continue with Shopify: OAuth in the in-app browser (Shopify's own
   * page — same flow as Order History), then link or create the one
   * app account for that email, so both sign-in paths land in the same
   * account and its orders. startLogin also persisted the Shopify
   * session, so Order History is live immediately. */
  const signInWithShopify = useCallback(async (): Promise<AccountResult> => {
    const login = await startShopifyLogin();
    if (!login.ok) return { ok: false, reason: login.reason };
    const seed = await getLocalProfile();
    const result = await signInWithShopifyCustomer({
      customer: login.session.customer,
      seedProfile: seed,
    });
    if (result.ok) {
      setAccount(result.account);
      setOnboardingDone(true);
      void markOnboardingDone();
    }
    return result;
  }, []);

  const linkShopifyOrder = useCallback(
    async (order: LinkedShopifyOrder): Promise<void> => {
      const next = await linkShopifyOrderToCurrentAccount(order);
      if (next) setAccount(next);
    },
    []
  );

  const signOut = useCallback(async () => {
    await signOutAccount();
    setAccount(null);
  }, []);

  const continueAsGuest = useCallback(async () => {
    // "Guest" means "not signing in right now" — it is NOT a sign-out.
    // Any stored session stays untouched, so closing and reopening the
    // app never throws a signed-in user back to the login screens.
    // We only record that onboarding is finished.
    setOnboardingDone(true);
    await markOnboardingDone();
  }, []);

  const changePassword = useCallback(
    async (
      oldPassword: string,
      newPassword: string
    ): Promise<AccountResult> => {
      const result = await changeAccountPassword(oldPassword, newPassword);
      if (result.ok) setAccount(result.account);
      return result;
    },
    []
  );

  const deleteAccount = useCallback(
    async (password: string) => {
      const result = await deleteCurrentAccount(password);
      if (result.ok) setAccount(null);
      return result;
    },
    []
  );

  const addOrderReceipt = useCallback(
    async (receipt: Omit<OrderReceipt, "placedAt">) => {
      const next = await persistOrderReceipt(receipt);
      if (next) setAccount(next);
    },
    []
  );

  const cancelOrder = useCallback(async (orderId: string) => {
    const next = await requestCancelOrderReceipt(orderId);
    if (next) setAccount(next);
  }, []);

  const clearCart = useCallback(() => {
    setCartLines([]);
  }, []);

  const reloadAccount = useCallback(async () => {
    setAccount(await getCurrentAccount());
  }, []);

  // The profile the UI edits: the account's when signed in, the
  // device-local one for guests.
  const profile: LocalProfile = account?.profile ?? deviceProfile;

  const persistProfile = useCallback(
    async (next: LocalProfile) => {
      if (account) {
        const updated: AppAccount = { ...account, profile: next };
        await saveAccount(updated);
        setAccount(updated);
      } else {
        setDeviceProfile(next);
        await saveLocalProfile(next);
      }
    },
    [account]
  );

  const updateProfile = useCallback(
    async (patch: Partial<LocalProfile>) => {
      const next = { ...profile, ...patch };
      await persistProfile(next);
    },
    [profile, persistProfile]
  );

  const setAvatar = useCallback(
    async (uri: string | null) => {
      await persistProfile({ ...profile, avatarUri: uri });
    },
    [profile, persistProfile]
  );

  const addAddress = useCallback(
    async (address: Omit<LocalAddress, "id">) => {
      const entry: LocalAddress = {
        ...address,
        id: `addr-${Date.now()}`,
        isDefault: profile.addresses.length === 0 ? true : address.isDefault,
      };
      const addresses = entry.isDefault
        ? profile.addresses.map((a) => ({ ...a, isDefault: false }))
        : profile.addresses;
      await persistProfile({ ...profile, addresses: [...addresses, entry] });
    },
    [profile, persistProfile]
  );

  const updateAddress = useCallback(
    async (id: string, patch: Partial<LocalAddress>) => {
      const addresses = profile.addresses.map((a) =>
        a.id === id
          ? {
              ...a,
              ...patch,
              isDefault:
                patch.isDefault === true
                  ? true
                  : patch.isDefault === false
                    ? false
                    : a.isDefault,
            }
          : patch.isDefault === true
            ? { ...a, isDefault: false }
            : a
      );
      await persistProfile({ ...profile, addresses });
    },
    [profile, persistProfile]
  );

  const removeAddress = useCallback(
    async (id: string) => {
      const addresses = profile.addresses.filter((a) => a.id !== id);
      if (addresses.length > 0 && !addresses.some((a) => a.isDefault)) {
        addresses[0] = { ...addresses[0], isDefault: true };
      }
      await persistProfile({ ...profile, addresses });
    },
    [profile, persistProfile]
  );

  const setDefaultAddress = useCallback(
    async (id: string) => {
      await updateAddress(id, { isDefault: true });
    },
    [updateAddress]
  );

  const toggleInterest = useCallback(
    async (interest: string) => {
      const interests = profile.interests.includes(interest)
        ? profile.interests.filter((i) => i !== interest)
        : [...profile.interests, interest];
      await persistProfile({ ...profile, interests });
    },
    [profile, persistProfile]
  );

  const setSocial = useCallback(
    async (key: keyof SocialHandles, value: string) => {
      await persistProfile({
        ...profile,
        socials: { ...profile.socials, [key]: value },
      });
    },
    [profile, persistProfile]
  );

  /** Erase device-local guest data (used by Delete Account → "just this device"). */
  const eraseLocalData = useCallback(async () => {
    await clearLocalProfile();
    setDeviceProfile({
      addresses: [],
      interests: [],
      socials: { instagram: "", tiktok: "", facebook: "", x: "" },
      avatarUri: null,
      firstName: "",
      lastName: "",
      phone: "",
    });
    await signOutAccount();
    setAccount(null);
  }, []);

  const orders = useMemo<OrderReceipt[]>(
    () => account?.orders ?? [],
    [account]
  );

  const refreshCatalog = useCallback(() => {
    let cancelled = false;
    setCatalogLoading(true);
    setCatalogError(null);
    Promise.all([fetchProducts(), fetchCollections(), fetchPurchasableVariantIds()])
      .then(([ps, cs, purchasableIds]) => {
        if (cancelled) return;
        setProducts(ps);
        setCollections(cs);
        setPurchasableVariantIds(purchasableIds);
        setCatalogLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setCatalogError(
          e instanceof Error ? e.message : "Couldn't load the catalog."
        );
        setCatalogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const cancel = refreshCatalog();
    return cancel;
  }, [refreshCatalog]);

  const getProduct = useCallback(
    (numericId: string) => products.find((p) => p.numericId === numericId),
    [products]
  );

  // True unless we know Shopify's Storefront API can't sell this variant
  // (product never published to the app sales channel). Unknown = fail open.
  const isVariantPurchasable = useCallback(
    (variantId: string) =>
      purchasableVariantIds === null || purchasableVariantIds.has(variantId),
    [purchasableVariantIds]
  );

  const addToCart = useCallback(
    (product: Product, variant: ProductVariant, quantity: number) => {
      setCartLines((lines) => {
        const existing = lines.find(
          (l) => l.product.id === product.id && l.variantId === variant.id
        );
        if (existing) {
          return lines.map((l) =>
            l.id === existing.id
              ? { ...l, quantity: l.quantity + quantity }
              : l
          );
        }
        lineSeq += 1;
        return [
          ...lines,
          {
            id: `line-${lineSeq}`,
            product,
            variantId: variant.id,
            variantTitle: variant.title,
            unitPrice: variant.price,
            quantity,
          },
        ];
      });
    },
    []
  );

  const updateQuantity = useCallback((lineId: string, quantity: number) => {
    setCartLines((lines) =>
      quantity <= 0
        ? lines.filter((l) => l.id !== lineId)
        : lines.map((l) => (l.id === lineId ? { ...l, quantity } : l))
    );
  }, []);

  const removeLine = useCallback((lineId: string) => {
    setCartLines((lines) => lines.filter((l) => l.id !== lineId));
  }, []);

  const toggleWishlist = useCallback((productId: string) => {
    setWishlistIds((ids) =>
      ids.includes(productId)
        ? ids.filter((id) => id !== productId)
        : [...ids, productId]
    );
  }, []);

  const removeFromWishlist = useCallback((productId: string) => {
    setWishlistIds((ids) => ids.filter((id) => id !== productId));
  }, []);

  const isWishlisted = useCallback(
    (productId: string) => wishlistIds.includes(productId),
    [wishlistIds]
  );

  const value = useMemo<ShopContextValue>(() => {
    const cartCount = cartLines.reduce((n, l) => n + l.quantity, 0);
    const total = cartLines.reduce(
      (sum, l) => sum + Number(l.unitPrice.amount) * l.quantity,
      0
    );
    const subtotal: MoneyV2 = {
      amount: total.toFixed(2),
      currencyCode: "USD",
    };
    return {
      products,
      collections,
      catalogLoading,
      catalogError,
      refreshCatalog,
      getProduct,
      cartLines,
      wishlistIds,
      cartCount,
      subtotal,
      addToCart,
      isVariantPurchasable,
      updateQuantity,
      removeLine,
      clearCart,
      toggleWishlist,
      removeFromWishlist,
      isWishlisted,
      account,
      orders,
      authLoading,
      onboardingDone,
      isGuest: !account,
      signUp,
      signIn,
      signInWithShopify,
      linkShopifyOrder,
      signOut,
      continueAsGuest,
      changePassword,
      deleteAccount,
      addOrderReceipt,
      cancelOrder,
      reloadAccount,
      profile,
      updateProfile,
      setAvatar,
      addAddress,
      updateAddress,
      removeAddress,
      setDefaultAddress,
      toggleInterest,
      setSocial,
      eraseLocalData,
    };
  }, [
    products,
    collections,
    catalogLoading,
    catalogError,
    refreshCatalog,
    getProduct,
    cartLines,
    wishlistIds,
    addToCart,
    updateQuantity,
    removeLine,
    clearCart,
    toggleWishlist,
    removeFromWishlist,
    isWishlisted,
    account,
    orders,
    authLoading,
    onboardingDone,
    signUp,
    signIn,
    signInWithShopify,
    linkShopifyOrder,
    signOut,
    continueAsGuest,
    changePassword,
    deleteAccount,
    addOrderReceipt,
    cancelOrder,
    reloadAccount,
    profile,
    updateProfile,
    setAvatar,
    addAddress,
    updateAddress,
    removeAddress,
    setDefaultAddress,
    toggleInterest,
    setSocial,
    eraseLocalData,
  ]);

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop(): ShopContextValue {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error("useShop must be used inside <ShopProvider>");
  return ctx;
}

export { formatMoney };
