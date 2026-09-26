import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type CurrentUser = { name: string; email: string; image: string | null };

export function initialOf(user: Pick<CurrentUser, "name" | "email">): string {
  const source = user.name.trim() || user.email.trim();
  return (source[0] ?? "?").toUpperCase();
}

/** OAuth avatar with a letter fallback (design §5.2). */
export function UserAvatar({ user, size = "default", className }: { user: CurrentUser; size?: "default" | "sm" | "lg"; className?: string }) {
  return (
    <Avatar size={size} className={className}>
      {user.image && <AvatarImage src={user.image} alt="" referrerPolicy="no-referrer" />}
      <AvatarFallback className={cn("bg-background text-xs font-medium text-foreground")}>{initialOf(user)}</AvatarFallback>
    </Avatar>
  );
}
