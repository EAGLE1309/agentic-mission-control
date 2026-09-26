"use client";

import Github from "@thesvg/react/github";
import Google from "@thesvg/react/google";
import { IconCircleX, IconEye, IconEyeOff } from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BlurInText, blurIn } from "@/features/landing/blur-in-text";
import { authClient } from "@/lib/auth-client";
import { DEFAULT_APP_PATH } from "@/lib/safe-next";
import { NAME_MAX_LENGTH, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/shared/constants";

export type SocialProviders = { github: boolean; google: boolean };

type Mode = "sign-in" | "sign-up";
type Pending = null | "email" | "github" | "google";
type Values = { name: string; email: string; password: string };
type Errors = Partial<Record<keyof Values | "form", string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const COPY = {
  "sign-in": {
    title: "Welcome back.",
    subtitle: "Sign in to open your missions.",
    submit: "Sign in",
    pending: "Signing in…",
    switchText: "No account?",
    switchLink: "Create one",
    switchPath: "/sign-up",
  },
  "sign-up": {
    title: "Create your account.",
    subtitle: "It is free, and you do not need a card.",
    submit: "Create account",
    pending: "Creating account…",
    switchText: "Have an account?",
    switchLink: "Sign in",
    switchPath: "/sign-in",
  },
} as const;

function validate(mode: Mode, values: Values): Errors {
  const errors: Errors = {};
  if (mode === "sign-up" && !values.name.trim()) errors.name = "Enter your name.";
  if (!values.email.trim()) errors.email = "Enter your email.";
  else if (!EMAIL_PATTERN.test(values.email.trim())) errors.email = "Enter an email in the form name@example.com.";
  if (!values.password) errors.password = "Enter your password.";
  else if (mode === "sign-up" && values.password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `Use ${PASSWORD_MIN_LENGTH} or more characters.`;
  }
  return errors;
}

/** Better Auth error codes → field or form errors in plain words (design §9). */
function serverErrors(mode: Mode, error: { code?: string; status?: number } | null): Errors {
  switch (error?.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return { form: "The email or password is not correct." };
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return { email: "An account with this email exists. Sign in instead." };
    case "INVALID_EMAIL":
      return { email: "Enter an email in the form name@example.com." };
    case "PASSWORD_TOO_SHORT":
      return { password: `Use ${PASSWORD_MIN_LENGTH} or more characters.` };
    case "PASSWORD_TOO_LONG":
      return { password: `Use ${PASSWORD_MAX_LENGTH} characters or less.` };
  }
  if (error?.status === 429) return { form: "Too many attempts. Wait a minute, then try again." };
  return {
    form:
      mode === "sign-in"
        ? "Sign-in did not complete. Check your connection, then try again."
        : "The account was not created. Check your connection, then try again.",
  };
}

function oauthErrorMessage(code: string | null): string | null {
  if (!code) return null;
  if (code === "account_not_linked") {
    return "This email already has an account. Sign in with your email and password.";
  }
  if (code === "access_denied") return "Sign-in was canceled. Choose a way to sign in.";
  return "Sign-in with that provider did not complete. Try again.";
}

export function AuthForm({
  mode,
  next,
  providers,
  oauthError,
}: {
  mode: Mode;
  next: string;
  providers: SocialProviders;
  oauthError: string | null;
}) {
  const copy = COPY[mode];
  const router = useRouter();
  const id = useId();
  const [values, setValues] = useState<Values>({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState<Errors>(() => {
    const message = oauthErrorMessage(oauthError);
    return message ? { form: message } : {};
  });
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [showPassword, setShowPassword] = useState(false);

  // A social sign-in leaves the page. If the user comes back with the Back
  // button, the page can come from the cache with the buttons still disabled.
  useEffect(() => {
    const reset = (event: PageTransitionEvent) => {
      if (event.persisted) setPending(null);
    };
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  const nextQuery = next === DEFAULT_APP_PATH ? "" : `?next=${encodeURIComponent(next)}`;
  const hasSocial = providers.github || providers.google;
  const busy = pending !== null;

  function update(field: keyof Values, value: string) {
    const nextValues = { ...values, [field]: value };
    setValues(nextValues);
    // Validate late: only after the first submit, so an error clears as soon as it is fixed.
    if (submitted) setErrors(validate(mode, nextValues));
    else if (errors.form) setErrors({});
  }

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setSubmitted(true);
    const found = validate(mode, values);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      const first = (["name", "email", "password"] as const).find((field) => found[field]);
      if (first) document.getElementById(`${id}-${first}`)?.focus();
      return;
    }

    setPending("email");
    try {
      const { error } =
        mode === "sign-in"
          ? await authClient.signIn.email({ email: values.email.trim(), password: values.password })
          : await authClient.signUp.email({
              name: values.name.trim(),
              email: values.email.trim(),
              password: values.password,
            });
      if (error) {
        setErrors(serverErrors(mode, error));
        setPending(null);
        return;
      }
      // Keep the button busy until the next page loads.
      router.replace(next);
      router.refresh();
    } catch {
      setErrors(serverErrors(mode, null));
      setPending(null);
    }
  }

  async function submitSocial(provider: "github" | "google") {
    if (busy) return;
    setPending(provider);
    setErrors({});
    try {
      const { error } = await authClient.signIn.social({
        provider,
        callbackURL: next,
        errorCallbackURL: `${mode === "sign-in" ? "/sign-in" : "/sign-up"}${nextQuery}`,
      });
      if (error) {
        setErrors({ form: oauthErrorMessage("provider_error") ?? undefined });
        setPending(null);
      }
    } catch {
      setErrors({ form: oauthErrorMessage("provider_error") ?? undefined });
      setPending(null);
    }
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl leading-[1.1] font-semibold tracking-[-0.03em] text-balance">
          <BlurInText text={copy.title} step={60} />
        </h1>
        <p className="blur-in text-base text-pretty text-muted-foreground" style={blurIn(120)}>
          {copy.subtitle}
        </p>
      </div>

      <div className="blur-in flex flex-col gap-6" style={blurIn(200, { y: 12 })}>
        {hasSocial && (
          <div className="flex flex-col gap-2">
            {providers.github && (
              <Button type="button" variant="outline" size="lg" className="w-full" disabled={busy} onClick={() => submitSocial("github")}>
                {pending === "github" ? <Spinner data-icon="inline-start" /> : <Github variant="mono" data-icon="inline-start" aria-hidden />}
                Continue with GitHub
              </Button>
            )}
            {providers.google && (
              <Button type="button" variant="outline" size="lg" className="w-full" disabled={busy} onClick={() => submitSocial("google")}>
                {pending === "google" ? <Spinner data-icon="inline-start" /> : <Google variant="default" data-icon="inline-start" aria-hidden />}
                Continue with Google
              </Button>
            )}
          </div>
        )}

        <form noValidate onSubmit={submitEmail} className="flex flex-col gap-6" aria-describedby={errors.form ? `${id}-form-error` : undefined}>
          {hasSocial && <FieldSeparator>or</FieldSeparator>}

          <FieldGroup className="gap-4">
            {mode === "sign-up" && (
              <Field data-invalid={errors.name ? true : undefined}>
                <FieldLabel htmlFor={`${id}-name`}>Name</FieldLabel>
                <Input
                  id={`${id}-name`}
                  className="h-10"
                  name="name"
                  autoComplete="name"
                  maxLength={NAME_MAX_LENGTH}
                  value={values.name}
                  onChange={(event) => update("name", event.target.value)}
                  aria-invalid={errors.name ? true : undefined}
                  aria-describedby={errors.name ? `${id}-name-error` : undefined}
                  disabled={busy}
                />
                <FieldMessage id={`${id}-name-error`} message={errors.name} />
              </Field>
            )}

            <Field data-invalid={errors.email ? true : undefined}>
              <FieldLabel htmlFor={`${id}-email`}>Email</FieldLabel>
              <Input
                id={`${id}-email`}
                className="h-10"
                name="email"
                type="email"
                autoComplete="email"
                spellCheck={false}
                value={values.email}
                onChange={(event) => update("email", event.target.value)}
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={errors.email ? `${id}-email-error` : undefined}
                disabled={busy}
              />
              <FieldMessage id={`${id}-email-error`} message={errors.email} />
            </Field>

            <Field data-invalid={errors.password ? true : undefined}>
              <FieldLabel htmlFor={`${id}-password`}>Password</FieldLabel>
              <InputGroup className="h-10">
                <InputGroupInput
                  id={`${id}-password`}
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                  maxLength={PASSWORD_MAX_LENGTH}
                  value={values.password}
                  onChange={(event) => update("password", event.target.value)}
                  aria-invalid={errors.password ? true : undefined}
                  aria-describedby={errors.password ? `${id}-password-error` : undefined}
                  disabled={busy}
                />
                <InputGroupAddon align="inline-end">
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <InputGroupButton
                          size="icon-xs"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          aria-pressed={showPassword}
                          onClick={() => setShowPassword((shown) => !shown)}
                          disabled={busy}
                        />
                      }
                    >
                      {showPassword ? <IconEyeOff /> : <IconEye />}
                    </TooltipTrigger>
                    <TooltipContent>{showPassword ? "Hide password" : "Show password"}</TooltipContent>
                  </Tooltip>
                </InputGroupAddon>
              </InputGroup>
              <FieldMessage id={`${id}-password-error`} message={errors.password} />
            </Field>
          </FieldGroup>

          <div className="flex flex-col gap-3">
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {pending === "email" && <Spinner data-icon="inline-start" />}
              {pending === "email" ? copy.pending : copy.submit}
            </Button>
            {errors.form && (
              <p id={`${id}-form-error`} role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
                <IconCircleX aria-hidden className="mt-0.5 size-4 shrink-0" />
                {errors.form}
              </p>
            )}
          </div>
        </form>
      </div>

      <p className="blur-in text-sm text-muted-foreground" style={blurIn(280)}>
        {copy.switchText}{" "}
        <Link href={`${copy.switchPath}${nextQuery}`} className="text-link underline-offset-2 hover:underline">
          {copy.switchLink}
        </Link>
      </p>
    </div>
  );
}

function FieldMessage({ id, message }: { id: string; message: string | undefined }) {
  if (!message) return null;
  return (
    <FieldError id={id} className="flex items-start gap-1.5">
      <IconCircleX aria-hidden className="mt-0.5 size-4 shrink-0" />
      {message}
    </FieldError>
  );
}
