import {
  Globe, CreditCard, Truck, ShoppingBag, Building2, Landmark,
  FileText, BarChart2, Settings, Users, Mail, Phone, Package,
  Wallet, Receipt, ExternalLink, Podcast, GraduationCap, User,
  Quote, HelpCircle, Monitor, BookOpen, Heart, Microscope,
  type LucideIcon,
} from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  globe: Globe,
  'credit-card': CreditCard,
  truck: Truck,
  'shopping-bag': ShoppingBag,
  building: Building2,
  landmark: Landmark,
  'file-text': FileText,
  'bar-chart': BarChart2,
  settings: Settings,
  users: Users,
  mail: Mail,
  phone: Phone,
  package: Package,
  wallet: Wallet,
  receipt: Receipt,
  'external-link': ExternalLink,
  podcast: Podcast,
  'graduation-cap': GraduationCap,
  user: User,
  quote: Quote,
  'help-circle': HelpCircle,
  monitor: Monitor,
  'book-open': BookOpen,
  heart: Heart,
  microscope: Microscope,
};

export function resolveIcon(name: string | null | undefined): LucideIcon {
  if (!name) return Globe;
  return iconMap[name] ?? Globe;
}

export const availableIcons = Object.keys(iconMap);
