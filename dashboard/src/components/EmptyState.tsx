import { Inbox, type LucideIcon } from "lucide-react";

interface Props {
  message: string;
  icon?: LucideIcon;
}

export default function EmptyState({ message, icon: Icon = Inbox }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
      <Icon size={32} className="mb-2 opacity-50" />
      <p className="text-sm text-center max-w-sm">{message}</p>
    </div>
  );
}
