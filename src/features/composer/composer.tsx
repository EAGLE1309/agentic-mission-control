"use client";

import { IconArrowUp, IconChevronDown, IconCircleX } from "@tabler/icons-react";
import {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ModelProfile } from "@/shared/events";

// The one input for goals and revisions (design §5.4).

export const MODEL_PROFILES: readonly { value: ModelProfile; label: string; description: string }[] = [
  { value: "balanced", label: "Balanced", description: "Stronger models. Slower." },
  { value: "fast", label: "Fast", description: "Faster models. Shorter reports." },
];

const LINE_HEIGHT = 20;
const MAX_ROWS = 8;

export type ComposerHandle = {
  focus: () => void;
};

export type BannerTone = "neutral" | "warning";

export const Composer = forwardRef<
  ComposerHandle,
  {
    value: string;
    onChange: (value: string) => void;
    onSubmit: (value: string) => void | Promise<void>;
    placeholder: string;
    labelledBy: string;
    submitLabel: string;
    /** Blocks sending and shows the placeholder as the reason. */
    disabled?: boolean;
    /** Blocks sending (quota or capacity), but keeps typing possible. */
    blocked?: boolean;
    pending?: boolean;
    error?: string | null;
    banner?: ReactNode;
    bannerTone?: BannerTone;
    profile?: ModelProfile;
    onProfileChange?: (profile: ModelProfile) => void;
    maxLength?: number;
    className?: string;
  }
>(function Composer(
  {
    value,
    onChange,
    onSubmit,
    placeholder,
    labelledBy,
    submitLabel,
    disabled = false,
    blocked = false,
    pending = false,
    error,
    banner,
    bannerTone = "neutral",
    profile,
    onProfileChange,
    maxLength,
    className,
  },
  ref,
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const errorId = `${labelledBy}-composer-error`;

  useImperativeHandle(ref, () => ({
    focus: () => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      const end = textarea.value.length;
      textarea.setSelectionRange(end, end);
    },
  }));

  // Grow from 1 to 8 rows, then scroll.
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const max = LINE_HEIGHT * MAX_ROWS + 12;
    textarea.style.height = `${Math.min(textarea.scrollHeight, max)}px`;
    textarea.style.overflowY = textarea.scrollHeight > max ? "auto" : "hidden";
  }, [value]);

  const empty = value.trim().length === 0;
  const canSend = !empty && !disabled && !blocked && !pending;

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!canSend) return;
    void onSubmit(value);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends. Shift+Enter adds a line. No send during IME composition (FR-8).
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    submit();
  };

  const selected = MODEL_PROFILES.find((item) => item.value === profile) ?? MODEL_PROFILES[0];

  return (
    <div className={cn("flex flex-col", className)}>
      <div className={cn("rounded-xl", banner && (bannerTone === "warning" ? "bg-warning-subtle" : "bg-muted"))}>
        {banner && (
          <div
            className={cn(
              "flex min-h-9 items-center gap-2 px-3 py-2 text-xs text-pretty",
              bannerTone === "warning" ? "text-warning-foreground" : "text-muted-foreground",
            )}
          >
            {banner}
          </div>
        )}
        <form onSubmit={submit} className="flex flex-col gap-1 rounded-xl bg-card p-1.5 shadow-raised">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            aria-labelledby={labelledBy}
            aria-describedby={error ? errorId : undefined}
            aria-invalid={error ? true : undefined}
            readOnly={pending}
            disabled={disabled}
            maxLength={maxLength}
            rows={1}
            autoComplete="off"
            className="block w-full resize-none bg-transparent px-2 py-1.5 text-base leading-5 text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed md:text-sm"
          />
          <div className="flex items-center justify-between gap-2">
            {profile && onProfileChange ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button type="button" variant="ghost" size="xs" disabled={disabled || pending} aria-label={`Model: ${selected.label}`} />}
                >
                  {selected.label}
                  <IconChevronDown data-icon="inline-end" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  <DropdownMenuGroup>
                    <DropdownMenuRadioGroup value={profile} onValueChange={(next) => onProfileChange(next as ModelProfile)}>
                      {MODEL_PROFILES.map((item) => (
                        <DropdownMenuRadioItem key={item.value} value={item.value}>
                          <span className="flex flex-col">
                            <span className="text-sm text-foreground">{item.label}</span>
                            <span className="text-xs text-muted-foreground">{item.description}</span>
                          </span>
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <span />
            )}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="submit"
                    size="icon-sm"
                    aria-label={submitLabel}
                    disabled={!canSend}
                    className="rounded-full disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
                  />
                }
              >
                {pending ? <Spinner aria-hidden /> : <IconArrowUp />}
              </TooltipTrigger>
              <TooltipContent>{submitLabel}</TooltipContent>
            </Tooltip>
          </div>
        </form>
      </div>
      {error && (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 px-3 pt-2 text-xs text-destructive">
          <IconCircleX aria-hidden className="mt-px size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
});
