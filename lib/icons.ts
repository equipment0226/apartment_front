import {
  Activity, AlertTriangle, Award, BadgeCheck, Building2, Calendar, ChartLine,
  Clock, Coins, Dot, GraduationCap, Home, Lock, Percent, Ruler, Scale,
  Sparkles, TrainFront, TrendingUp, Users, type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  percent: Percent,
  coins: Coins,
  trending: TrendingUp,
  users: Users,
  scale: Scale,
  chart: ChartLine,
  lock: Lock,
  alert: AlertTriangle,
  train: TrainFront,
  sparkles: Sparkles,
  school: GraduationCap,
  calendar: Calendar,
  building: Building2,
  ruler: Ruler,
  badge: BadgeCheck,
  award: Award,
  clock: Clock,
  home: Home,
  activity: Activity,
  dot: Dot,
};

export function iconFor(key: string): LucideIcon {
  return MAP[key] || Dot;
}
