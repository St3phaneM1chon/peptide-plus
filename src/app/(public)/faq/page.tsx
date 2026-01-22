/**
 * PAGE FAQ
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';

const faqCategories = [
  {
    name: 'Général',
    icon: '❓',
    questions: [
      {
        q: 'Qu\'est-ce que Formations Pro?',
        a: 'Formations Pro est une plateforme de formation professionnelle en ligne qui propose des cours, certifications et programmes de développement des compétences pour les professionnels et les entreprises.',
      },
      {
        q: 'Comment fonctionne la plateforme?',
        a: 'Après votre inscription, vous accédez à notre catalogue de formations. Vous pouvez suivre les cours à votre rythme, avec des vidéos, exercices pratiques et évaluations. Un certificat est délivré à la fin de chaque formation.',
      },
      {
        q: 'Les formations sont-elles reconnues?',
        a: 'Oui, nos formations sont reconnues par de nombreux employeurs et organismes professionnels. Certaines formations mènent également à des certifications internationales.',
      },
    ],
  },
  {
    name: 'Compte & Inscription',
    icon: '👤',
    questions: [
      {
        q: 'Comment créer un compte?',
        a: 'Cliquez sur "S\'inscrire" en haut de la page. Vous pouvez vous inscrire avec votre email, ou utiliser Google, Apple ou Facebook pour une inscription rapide.',
      },
      {
        q: 'Puis-je changer mon adresse email?',
        a: 'Oui, rendez-vous dans les paramètres de votre profil pour modifier votre adresse email. Une vérification sera envoyée à la nouvelle adresse.',
      },
      {
        q: 'Comment réinitialiser mon mot de passe?',
        a: 'Cliquez sur "Mot de passe oublié" sur la page de connexion. Vous recevrez un lien par email pour créer un nouveau mot de passe.',
      },
    ],
  },
  {
    name: 'Paiement & Tarifs',
    icon: '💳',
    questions: [
      {
        q: 'Quels modes de paiement acceptez-vous?',
        a: 'Nous acceptons les cartes de crédit (Visa, Mastercard, Amex), PayPal, Apple Pay et Google Pay. Pour les entreprises, nous offrons aussi le paiement par virement.',
      },
      {
        q: 'Puis-je être remboursé?',
        a: 'Oui, nous offrons une garantie satisfait ou remboursé de 30 jours sur toutes les formations. Contactez notre support pour faire une demande.',
      },
      {
        q: 'Y a-t-il des réductions pour les entreprises?',
        a: 'Oui, nous proposons des tarifs dégressifs selon le nombre d\'employés. Contactez notre équipe commerciale pour un devis personnalisé.',
      },
      {
        q: 'Puis-je payer en plusieurs fois?',
        a: 'Oui, pour les formations et parcours de plus de 200$, nous offrons le paiement en 3 ou 6 mensualités sans frais.',
      },
    ],
  },
  {
    name: 'Formations',
    icon: '📚',
    questions: [
      {
        q: 'Combien de temps ai-je accès à une formation?',
        a: 'L\'accès est illimité dans le temps pour toutes les formations achetées. Vous pouvez y revenir autant de fois que vous le souhaitez.',
      },
      {
        q: 'Puis-je télécharger les contenus?',
        a: 'Les supports de cours (PDF, exercices) sont téléchargeables. Les vidéos sont accessibles uniquement en streaming pour des raisons de droits d\'auteur.',
      },
      {
        q: 'Comment obtenir mon certificat?',
        a: 'Le certificat est automatiquement généré une fois que vous avez complété 100% de la formation et réussi l\'évaluation finale (si applicable).',
      },
      {
        q: 'Les formations sont-elles sous-titrées?',
        a: 'Oui, la plupart de nos formations sont disponibles avec sous-titres en français et en anglais.',
      },
    ],
  },
  {
    name: 'Support',
    icon: '🛟',
    questions: [
      {
        q: 'Comment contacter le support?',
        a: 'Vous pouvez nous joindre par chat (en bas à droite), par email à support@formationspro.com, ou par téléphone au 1-800-XXX-XXXX.',
      },
      {
        q: 'Quels sont vos horaires de support?',
        a: 'Notre support est disponible du lundi au vendredi, de 9h à 17h (heure de l\'Est). Le chat IA est disponible 24/7.',
      },
      {
        q: 'Comment signaler un problème technique?',
        a: 'Utilisez le formulaire de contact ou le chat en précisant votre navigateur, appareil et une description détaillée du problème.',
      },
    ],
  },
];

export default function FAQPage() {
  const [openItems, setOpenItems] = useState<string[]>([]);

  const toggleItem = (id: string) => {
    setOpenItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <div style={{ backgroundColor: 'var(--gray-100)', minHeight: '100vh' }}>
      {/* Hero */}
      <section
        style={{
          backgroundColor: 'var(--gray-500)',
          color: 'white',
          padding: '64px 24px',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: '42px', fontWeight: 700, marginBottom: '16px' }}>
          Questions fréquentes
        </h1>
        <p style={{ fontSize: '18px', opacity: 0.9, marginBottom: '32px' }}>
          Trouvez rapidement les réponses à vos questions
        </p>
        
        {/* Search */}
        <div style={{ maxWidth: '500px', margin: '0 auto' }}>
          <input
            type="search"
            placeholder="Rechercher une question..."
            style={{
              width: '100%',
              padding: '14px 20px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '16px',
            }}
          />
        </div>
      </section>

      {/* FAQ Content */}
      <section style={{ padding: '64px 24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          {faqCategories.map((category, catIndex) => (
            <div key={catIndex} style={{ marginBottom: '48px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <span style={{ fontSize: '28px' }}>{category.icon}</span>
                <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--gray-500)' }}>
                  {category.name}
                </h2>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {category.questions.map((item, qIndex) => {
                  const itemId = `${catIndex}-${qIndex}`;
                  const isOpen = openItems.includes(itemId);

                  return (
                    <div
                      key={qIndex}
                      style={{
                        backgroundColor: 'white',
                        borderRadius: '12px',
                        overflow: 'hidden',
                      }}
                    >
                      <button
                        onClick={() => toggleItem(itemId)}
                        style={{
                          width: '100%',
                          padding: '20px 24px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          backgroundColor: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <span style={{ fontSize: '16px', fontWeight: 500, color: 'var(--gray-500)' }}>
                          {item.q}
                        </span>
                        <span
                          style={{
                            fontSize: '20px',
                            transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
                            transition: 'transform 0.2s ease',
                          }}
                        >
                          ▼
                        </span>
                      </button>
                      {isOpen && (
                        <div style={{ padding: '0 24px 20px', fontSize: '15px', color: 'var(--gray-400)', lineHeight: 1.7 }}>
                          {item.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Contact CTA */}
      <section style={{ backgroundColor: 'white', padding: '64px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px', color: 'var(--gray-500)' }}>
          Vous n'avez pas trouvé votre réponse?
        </h2>
        <p style={{ fontSize: '16px', color: 'var(--gray-400)', marginBottom: '24px' }}>
          Notre équipe de support est là pour vous aider.
        </p>
        <Link href="/contact" className="btn btn-primary" style={{ padding: '14px 32px' }}>
          Contactez-nous
        </Link>
      </section>
    </div>
  );
}
