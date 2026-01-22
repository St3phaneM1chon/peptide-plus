/**
 * PAGE MES ACHATS (CUSTOMER)
 * Historique des achats avec reçus téléchargeables
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';

async function getPurchases(userId: string) {
  return prisma.purchase.findMany({
    where: { userId },
    include: {
      product: {
        include: { category: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export default async function PurchasesPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  const purchases = await getPurchases(session.user.id);

  const statusLabels: Record<string, { label: string; color: string }> = {
    COMPLETED: { label: 'Payé', color: 'bg-green-100 text-green-700' },
    PENDING: { label: 'En attente', color: 'bg-yellow-100 text-yellow-700' },
    FAILED: { label: 'Échoué', color: 'bg-red-100 text-red-700' },
    REFUNDED: { label: 'Remboursé', color: 'bg-gray-100 text-gray-700' },
  };

  const paymentMethodLabels: Record<string, string> = {
    STRIPE_CARD: 'Carte',
    APPLE_PAY: 'Apple Pay',
    GOOGLE_PAY: 'Google Pay',
    PAYPAL: 'PayPal',
    VISA_CLICK_TO_PAY: 'Visa',
    MASTERCARD_CLICK_TO_PAY: 'Mastercard',
  };

  // Calculer les totaux
  const totalSpent = purchases
    .filter((p) => p.status === 'COMPLETED')
    .reduce((acc, p) => acc + Number(p.amount), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-2">
                <Link href="/dashboard/customer" className="hover:text-gray-700">
                  Dashboard
                </Link>
                <span>/</span>
                <span className="text-gray-900">Mes achats</span>
              </nav>
              <h1 className="text-2xl font-bold text-gray-900">Historique des achats</h1>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Total dépensé</p>
              <p className="text-2xl font-bold text-gray-900">{totalSpent.toFixed(2)} $</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {purchases.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <svg
              className="w-16 h-16 mx-auto text-gray-300 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z"
              />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Aucun achat
            </h3>
            <p className="text-gray-600 mb-4">
              Commencez par explorer notre catalogue de formations
            </p>
            <Link href="/catalogue" className="btn-primary">
              Voir les formations
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Formation
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Paiement
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Montant
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reçu
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {purchases.map((purchase) => (
                  <tr key={purchase.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(purchase.createdAt).toLocaleDateString('fr-CA', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex-shrink-0 mr-3 overflow-hidden">
                          {purchase.product.imageUrl ? (
                            <img
                              src={purchase.product.imageUrl}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-blue-500 to-blue-700" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {purchase.product.name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {purchase.product.category?.name}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {paymentMethodLabels[purchase.paymentMethod] || purchase.paymentMethod}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          statusLabels[purchase.status]?.color || 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {statusLabels[purchase.status]?.label || purchase.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                      {Number(purchase.amount).toFixed(2)} $
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {purchase.status === 'COMPLETED' && (
                        <div className="flex items-center justify-end space-x-2">
                          <a
                            href={`/api/receipts/${purchase.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <svg
                              className="w-4 h-4 mr-1"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                            PDF
                          </a>
                          <button
                            onClick={() => window.print()}
                            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                          >
                            <svg
                              className="w-4 h-4 mr-1"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                              />
                            </svg>
                            Imprimer
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
