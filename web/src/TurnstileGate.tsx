import { forwardRef, useImperativeHandle, useRef } from "react";
import Turnstile from "react-turnstile";

type Props = {
  onVerify: (token: string) => void;
};

export type TurnstileGateHandle = {
  reset: () => void;
};

export const TurnstileGate = forwardRef<TurnstileGateHandle, Props>(({ onVerify }, ref) => {
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string;

  // react-turnstile expone métodos en ref (como reset)
  const tsRef = useRef<any>(null);

  useImperativeHandle(ref, () => ({
    reset: () => {
      try {
        tsRef.current?.reset?.();
      } catch {
        // no-op
      }
    },
  }));

  return (
    <Turnstile
      ref={tsRef}
      sitekey={siteKey}
      onVerify={(token: string) => onVerify(token)}
      onExpire={() => onVerify("")} // si expira el token, lo vaciamos
      theme="auto"
    />
  );
});

TurnstileGate.displayName = "TurnstileGate";