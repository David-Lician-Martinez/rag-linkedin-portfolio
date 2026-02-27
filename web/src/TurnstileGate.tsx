import Turnstile from "react-turnstile";

export function TurnstileGate({ onVerify }: { onVerify: (token: string) => void }) {
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string;

  return (
    <Turnstile
      sitekey={siteKey}
      onVerify={(token: string) => onVerify(token)}
      theme="auto"
    />
  );
}