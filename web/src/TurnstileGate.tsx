import Turnstile from "react-turnstile";

export function TurnstileGate({ onVerify }: { onVerify: (token: string) => void }) {
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

  return (
    <Turnstile
      sitekey={siteKey}
      onVerify={(token) => onVerify(token)}
      theme="auto"
    />
  );
}