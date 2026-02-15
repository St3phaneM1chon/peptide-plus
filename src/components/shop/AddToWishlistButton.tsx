'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from '@/hooks/useTranslations';

interface WishlistCollection {
  id: string;
  name: string;
  isDefault: boolean;
  _count: {
    items: number;
  };
}

interface AddToWishlistButtonProps {
  productId: string;
  variant?: 'button' | 'icon';
  size?: 'sm' | 'md' | 'lg';
}

export default function AddToWishlistButton({
  productId,
  variant = 'icon',
  size = 'md',
}: AddToWishlistButtonProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useTranslations();
  const [collections, setCollections] = useState<WishlistCollection[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isInAnyWishlist, setIsInAnyWishlist] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchCollections();
    }
  }, [status]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const fetchCollections = async () => {
    try {
      const res = await fetch('/api/account/wishlists');
      if (res.ok) {
        const data = await res.json();
        setCollections(data.wishlists || []);

        // Check if product is in any wishlist
        const checkPromises = (data.wishlists || []).map(async (collection: WishlistCollection) => {
          const itemsRes = await fetch(`/api/account/wishlists/items?collectionId=${collection.id}`);
          if (itemsRes.ok) {
            const itemsData = await itemsRes.json();
            return (itemsData.items || []).some((item: any) => item.productId === productId);
          }
          return false;
        });

        const results = await Promise.all(checkPromises);
        setIsInAnyWishlist(results.some(result => result));
      }
    } catch (error) {
      console.error('Error fetching wishlists:', error);
    }
  };

  const handleClick = () => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=' + encodeURIComponent(window.location.pathname));
      return;
    }

    if (collections.length === 0) {
      addToDefaultWishlist();
    } else if (collections.length === 1) {
      addToWishlist(collections[0].id);
    } else {
      setShowDropdown(!showDropdown);
    }
  };

  const addToDefaultWishlist = async () => {
    setIsAdding(true);
    try {
      // First create or get default wishlist
      const collectionsRes = await fetch('/api/account/wishlists');
      if (!collectionsRes.ok) throw new Error('Failed to fetch wishlists');

      const collectionsData = await collectionsRes.json();
      const defaultCollection = collectionsData.wishlists?.find((c: WishlistCollection) => c.isDefault);

      if (defaultCollection) {
        await addToWishlist(defaultCollection.id);
      } else {
        // Create default wishlist
        const createRes = await fetch('/api/account/wishlists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'My Wishlist' }),
        });

        if (createRes.ok) {
          const createData = await createRes.json();
          await addToWishlist(createData.wishlist.id);
        }
      }
    } catch (error) {
      console.error('Error adding to wishlist:', error);
      toast.error('Failed to add to wishlist');
    } finally {
      setIsAdding(false);
    }
  };

  const addToWishlist = async (collectionId: string) => {
    setIsAdding(true);
    try {
      const res = await fetch('/api/account/wishlists/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectionId, productId }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(data.message || 'Added to wishlist');
        setIsInAnyWishlist(true);
        setShowDropdown(false);
      } else {
        const data = await res.json();
        if (res.status === 200) {
          toast.info(data.message || 'Already in wishlist');
        } else {
          toast.error(data.error || 'Failed to add to wishlist');
        }
      }
    } catch (error) {
      console.error('Error adding to wishlist:', error);
      toast.error('Failed to add to wishlist');
    } finally {
      setIsAdding(false);
    }
  };

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  const iconSizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  if (variant === 'icon') {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={handleClick}
          disabled={isAdding || status === 'loading'}
          className={`${sizeClasses[size]} flex items-center justify-center rounded-lg border transition-all ${
            isInAnyWishlist
              ? 'bg-red-50 border-red-300 text-red-500 hover:bg-red-100'
              : 'bg-white border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200'
          }`}
          title={t('shop.addToWishlist') || 'Add to wishlist'}
        >
          {isAdding ? (
            <div className="animate-spin rounded-full border-2 border-red-500 border-t-transparent w-4 h-4" />
          ) : (
            <svg
              className={iconSizeClasses[size]}
              fill={isInAnyWishlist ? 'currentColor' : 'none'}
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          )}
        </button>

        {showDropdown && collections.length > 1 && (
          <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-50">
            <div className="p-2 bg-gray-50 border-b">
              <p className="text-xs font-semibold text-gray-600 uppercase">Add to wishlist</p>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {collections.map((collection) => (
                <button
                  key={collection.id}
                  onClick={() => addToWishlist(collection.id)}
                  className="w-full px-4 py-3 text-left hover:bg-orange-50 transition-colors flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium text-sm text-gray-900">
                      {collection.name}
                      {collection.isDefault && (
                        <span className="ml-2 text-xs text-gray-500">(Default)</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {collection._count.items} {collection._count.items === 1 ? 'item' : 'items'}
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              ))}
            </div>
            <div className="p-2 bg-gray-50 border-t">
              <button
                onClick={() => {
                  setShowDropdown(false);
                  router.push('/account/wishlist');
                }}
                className="w-full px-3 py-2 text-sm text-orange-600 hover:bg-orange-50 rounded transition-colors"
              >
                Manage wishlists
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleClick}
        disabled={isAdding || status === 'loading'}
        className={`px-6 py-3 rounded-lg font-semibold transition-all flex items-center gap-2 ${
          isInAnyWishlist
            ? 'bg-red-50 border-2 border-red-300 text-red-600 hover:bg-red-100'
            : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-orange-300 hover:text-orange-600'
        }`}
      >
        {isAdding ? (
          <div className="animate-spin rounded-full border-2 border-red-500 border-t-transparent w-5 h-5" />
        ) : (
          <svg
            className="w-5 h-5"
            fill={isInAnyWishlist ? 'currentColor' : 'none'}
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
        )}
        {isInAnyWishlist ? 'Saved' : t('shop.addToWishlist') || 'Add to Wishlist'}
        {collections.length > 1 && (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {showDropdown && collections.length > 1 && (
        <div className="absolute top-full left-0 mt-2 w-full min-w-[250px] bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-50">
          <div className="p-2 bg-gray-50 border-b">
            <p className="text-xs font-semibold text-gray-600 uppercase">Choose a wishlist</p>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {collections.map((collection) => (
              <button
                key={collection.id}
                onClick={() => addToWishlist(collection.id)}
                className="w-full px-4 py-3 text-left hover:bg-orange-50 transition-colors"
              >
                <div className="font-medium text-sm text-gray-900">
                  {collection.name}
                  {collection.isDefault && <span className="ml-2 text-xs text-gray-500">(Default)</span>}
                </div>
                <div className="text-xs text-gray-500">
                  {collection._count.items} {collection._count.items === 1 ? 'item' : 'items'}
                </div>
              </button>
            ))}
          </div>
          <div className="p-2 bg-gray-50 border-t">
            <button
              onClick={() => {
                setShowDropdown(false);
                router.push('/account/wishlist');
              }}
              className="w-full px-3 py-2 text-sm text-orange-600 hover:bg-orange-50 rounded transition-colors"
            >
              Manage wishlists
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
