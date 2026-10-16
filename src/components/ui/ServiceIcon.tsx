import { FileSearch, Landmark, Scale, type LucideProps } from "lucide-react";
import type { ServiceIcon as ServiceIconName } from "@/config/services";

const icons = {
  valuation: Landmark,
  court: Scale,
  research: FileSearch,
} satisfies Record<ServiceIconName, unknown>;

export function ServiceIcon({ name, ...props }: { name: ServiceIconName } & LucideProps) {
  const Icon = icons[name];
  return <Icon aria-hidden="true" strokeWidth={1.6} {...props} />;
}
