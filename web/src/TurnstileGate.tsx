import { forwardRef, useImperativeHandle, useState } from "react";
import Turnstile from "react-turnstile";

type Props = {
  onVerify: (token: string) => void;
};

export type TurnstileGateHandle = {
  reset: () => void;
};

export const TurnstileGate = forwardRef<TurnstileGateHandle, Props>(
  ({ onVerify }, ref) => {
    const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string;
    const [widgetKey, setWidgetKey] = useState(0);

    useImperativeHandle(ref, () => ({
      reset: () => {
        // Forzamos re-mount del widget
        setWidgetKey((k) => k + 1);
        onVerify(""); // limpiamos token en el parent
      },
    }));

    return (
      <Turnstile
        key={widgetKey}
        sitekey={siteKey}
        onVerify={(token: string) => onVerify(token)}
        onExpire={() => onVerify("")}
        theme="auto"
      />
    );
  }
);

TurnstileGate.displayName = "TurnstileGate";