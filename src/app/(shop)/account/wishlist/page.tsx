'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useTranslations } from '@/hooks/useTranslations';
import { useCurrency } from '@/contexts/CurrencyContext';
import PriceDropButton from '@/components/shop/PriceDropButton';
import { toast } from 'sonner';

interface WishlistProduct {
  name: string;
  slug: string;
  imageUrl: string | null;
  price: number;
  comparePrice: number | null;
  purity: number | null;
  isActive: boolean;
  inStock: boolean;
  category: string | null;
  categorySlug: string | null;
}

interface WishlistItem {
  id: string;
  productId: string;
  collectionId: string;
  createdAt: string;
  product: WishlistProduct;
}

interface WishlistCollection {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
  _count: {
    items: number;
  };
}

export default function WishlistPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useTranslations();
  const { formatPrice } = useCurrency();

  const [collections, setCollections] = useState<WishlistCollection[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameCollectionId, setRenameCollectionId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveItemId, setMoveItemId] = useState<string | null>(null);
  const [moveTargetId, setMoveTargetId] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/account/wishlist');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user) {
      fetchCollections();
    }
  }, [session]);

  useEffect(() => {
    if (activeCollectionId) {
      fetchItems(activeCollectionId);
    }
  }, [activeCollectionId]);

  const fetchCollections = async () => {
    try {
      const res = await fetch('/api/account/wishlists');
      if (res.ok) {
        const data = await res.json();
        setCollections(data.wishlists || []);
        if (data.wishlists?.length > 0 && !activeCollectionId) {
          setActiveCollectionId(data.wishlists[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching wishlists:', error);
      toast.error('Failed to load wishlists');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchItems = async (collectionId: string) => {
    try {
      const res = await fetch(`/api/account/wishlists/items?collectionId=${collectionId}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (error) {
      console.error('Error fetching wishlist items:', error);
      toast.error('Failed to load items');
    }
  };

  const handleCreateList = async () => {
    if (!newListName.trim()) {
      toast.error('Please enter a name');
      return;
    }

    try {
      const res = await fetch('/api/account/wishlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newListName.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success('Wishlist created');
        setCollections((prev) => [...prev, data.wishlist]);
        setActiveCollectionId(data.wishlist.id);
        setShowCreateModal(false);
        setNewListName('');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to create wishlist');
      }
    } catch (error) {
      console.error('Error creating wishlist:', error);
      toast.error('Failed to create wishlist');
    }
  };

  const handleRenameList = async () => {
    if (!renameValue.trim() || !renameCollectionId) return;

    try {
      const res = await fetch('/api/account/wishlists', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: renameCollectionId, name: renameValue.trim() }),
      });

      if (res.ok) {
        toast.success('Wishlist renamed');
        setCollections((prev) =>
          prev.map((c) => (c.id === renameCollectionId ? { ...c, name: renameValue.trim() } : c))
        );
        setShowRenameModal(false);
        setRenameCollectionId(null);
        setRenameValue('');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to rename wishlist');
      }
    } catch (error) {
      console.error('Error renaming wishlist:', error);
      toast.error('Failed to rename wishlist');
    }
  };

  const handleDeleteList = async (id: string, isDefault: boolean) => {
    if (isDefault) {
      toast.error('Cannot delete default wishlist');
      return;
    }

    if (!confirm('Delete this wishlist? Items will be moved to your default wishlist.')) {
      return;
    }

    try {
      const res = await fetch(`/api/account/wishlists?id=${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(data.message);
        setCollections((prev) => prev.filter((c) => c.id !== id));
        if (activeCollectionId === id) {
          const defaultList = collections.find((c) => c.isDefault);
          setActiveCollectionId(defaultList?.id || null);
        }
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to delete wishlist');
      }
    } catch (error) {
      console.error('Error deleting wishlist:', error);
      toast.error('Failed to delete wishlist');
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    setRemovingId(itemId);
    try {
      const res = await fetch(`/api/account/wishlists/items?id=${itemId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== itemId));
        setCollections((prev) =>
          prev.map((c) =>
            c.id === activeCollectionId ? { ...c, _count: { items: c._count.items - 1 } } : c
          )
        );
        toast.info('Removed from wishlist');
      } else {
        toast.error('Failed to remove item');
      }
    } catch (error) {
      console.error('Error removing item:', error);
      toast.error('Failed to remove item');
    } finally {
      setRemovingId(null);
    }
  };

  const handleMoveItem = async () => {
    if (!moveItemId || !moveTargetId) return;

    try {
      const res = await fetch('/api/account/wishlists/items', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: moveItemId, newCollectionId: moveTargetId }),
      });

      if (res.ok) {
        toast.success('Item moved');
        setItems((prev) => prev.filter((i) => i.id !== moveItemId));
        fetchCollections(); // Refresh counts
        setShowMoveModal(false);
        setMoveItemId(null);
        setMoveTargetId(null);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to move item');
      }
    } catch (error) {
      console.error('Error moving item:', error);
      toast.error('Failed to move item');
    }
  };

  const openRenameModal = (collection: WishlistCollection) => {
    setRenameCollectionId(collection.id);
    setRenameValue(collection.name);
    setShowRenameModal(true);
  };

  const openMoveModal = (itemId: string) => {
    setMoveItemId(itemId);
    setMoveTargetId(collections.find((c) => c.id !== activeCollectionId)?.id || null);
    setShowMoveModal(true);
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const activeCollection = collections.find((c) => c.id === activeCollectionId);
  const totalItems = collections.reduce((sum, c) => sum + c._count.items, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <section className="bg-gradient-to-br from-neutral-900 via-neutral-800 to-black text-white py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link href="/account" className="text-neutral-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
                <svg className="w-8 h-8 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
                {t('account.wishlist') || 'My Wishlists'}
              </h1>
              <p className="text-neutral-400 mt-1">
                {totalItems} {totalItems === 1 ? 'item saved' : 'items saved'} across {collections.length}{' '}
                {collections.length === 1 ? 'list' : 'lists'}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs / Collection Switcher */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {collections.map((collection) => (
            <button
              key={collection.id}
              onClick={() => setActiveCollectionId(collection.id)}
              className={`group relative px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                activeCollectionId === collection.id
                  ? 'bg-orange-500 text-white shadow-md'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <span className="flex items-center gap-2">
                {collection.name}
                <span
                  className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                    activeCollectionId === collection.id
                      ? 'bg-white/20 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {collection._count.items}
                </span>
              </span>

              {/* Dropdown menu on hover */}
              {activeCollectionId === collection.id && (
                <div className="absolute top-full right-0 mt-1 hidden group-hover:block z-10">
                  <div className="bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden min-w-[150px]">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openRenameModal(collection);
                      }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                    >
                      ✏️ Rename
                    </button>
                    {!collection.isDefault && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteList(collection.id, collection.isDefault);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        🗑️ Delete
                      </button>
                    )}
                  </div>
                </div>
              )}
            </button>
          ))}

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-lg font-medium text-sm bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:shadow-md transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create List
          </button>
        </div>

        {/* Items Grid */}
        {items.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {items.map((item) => (
              <div
                key={item.id}
                className={`bg-white rounded-xl border border-neutral-200 overflow-hidden hover:shadow-lg transition-all ${
                  removingId === item.id ? 'opacity-50 scale-95' : ''
                }`}
              >
                {/* Product Image */}
                <Link href={`/product/${item.product.slug}`}>
                  <div className="relative aspect-square bg-neutral-100">
                    <Image
                      src={item.product.imageUrl || '/images/products/peptide-default.png'}
                      alt={item.product.name}
                      fill
                      className="object-cover hover:scale-105 transition-transform duration-300"
                    />
                    {item.product.category && (
                      <span className="absolute top-3 left-3 px-3 py-1 bg-black/80 text-white text-xs font-medium rounded-full">
                        {item.product.category}
                      </span>
                    )}
                    {!item.product.inStock && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="bg-red-600 text-white text-sm font-bold px-4 py-2 rounded-lg">
                          {t('shop.outOfStock') || 'Out of Stock'}
                        </span>
                      </div>
                    )}
                  </div>
                </Link>

                {/* Product Info */}
                <div className="p-4">
                  <Link href={`/product/${item.product.slug}`}>
                    <h3 className="font-bold text-lg text-neutral-900 hover:text-orange-600 transition-colors line-clamp-2">
                      {item.product.name}
                    </h3>
                  </Link>

                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-orange-600 font-bold text-lg">
                      {formatPrice(item.product.price)}
                    </span>
                    {item.product.comparePrice && item.product.comparePrice > item.product.price && (
                      <span className="text-sm text-neutral-400 line-through">
                        {formatPrice(item.product.comparePrice)}
                      </span>
                    )}
                    <PriceDropButton productId={item.productId} currentPrice={item.product.price} variant="icon" />
                  </div>

                  {item.product.purity && (
                    <p className="text-sm text-neutral-500 mt-1">
                      {t('shop.purity') || 'Purity'} {item.product.purity}%
                    </p>
                  )}

                  <p className="text-xs text-neutral-400 mt-2">
                    {t('account.addedOn') || 'Added'} {new Date(item.createdAt).toLocaleDateString()}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-4">
                    <Link
                      href={`/product/${item.product.slug}`}
                      className="flex-1 py-2 px-4 bg-orange-500 text-white text-center text-sm font-semibold rounded-lg hover:bg-orange-600 transition-colors"
                    >
                      {t('shop.viewProduct') || 'View'}
                    </Link>
                    {collections.length > 1 && (
                      <button
                        onClick={() => openMoveModal(item.id)}
                        className="w-10 h-10 flex items-center justify-center rounded-lg border border-neutral-200 text-neutral-400 hover:text-orange-500 hover:border-orange-200 transition-colors"
                        title="Move to another list"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                          />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={() => handleRemoveItem(item.id)}
                      disabled={removingId === item.id}
                      className="w-10 h-10 flex items-center justify-center rounded-lg border border-neutral-200 text-neutral-400 hover:text-red-500 hover:border-red-200 transition-colors"
                      title={t('account.removeFromWishlist') || 'Remove'}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl p-12 shadow-sm border border-neutral-200 text-center">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-2">
              {activeCollection?.name || 'This wishlist'} is empty
            </h3>
            <p className="text-neutral-500 mb-6 max-w-md mx-auto">
              Browse our products and save the ones you love by clicking the heart icon.
            </p>
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              {t('account.startShopping') || 'Browse Products'}
            </Link>
          </div>
        )}
      </div>

      {/* Create List Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Create New Wishlist</h3>
            <input
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="Enter list name"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 mb-4"
              maxLength={100}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreateList()}
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewListName('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateList}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename List Modal */}
      {showRenameModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Rename Wishlist</h3>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Enter new name"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 mb-4"
              maxLength={100}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleRenameList()}
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRenameModal(false);
                  setRenameCollectionId(null);
                  setRenameValue('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRenameList}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move Item Modal */}
      {showMoveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Move to Another List</h3>
            <select
              value={moveTargetId || ''}
              onChange={(e) => setMoveTargetId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 mb-4"
            >
              {collections
                .filter((c) => c.id !== activeCollectionId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c._count.items} items)
                  </option>
                ))}
            </select>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowMoveModal(false);
                  setMoveItemId(null);
                  setMoveTargetId(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleMoveItem}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
              >
                Move
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
