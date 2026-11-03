"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { Button, Card, Icon, cx } from "./ui";
import { disablePush, enablePush, pushState, testPush, type PushState } from "@/lib/push";

const DISMISS_KEY = "abound.pushBannerDismissed";

export function usePushState(): [PushState, (s: PushState) => void] {
  const [s, setS] = useState<PushState>("checking");
  useEffect(() => {
    pushState().then(setS);
  }, []);
  return [s, setS];
}

/** 设置页：推送通知开关 */
export function PushCard() {
  const { t, api } = useAuth();
  const [state, setState] = usePushState();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const on = async () => {
    setBusy(true);
    setErr("");
    try {
      setState(await enablePush(api));
    } catch (e) {
      console.error(e);
      setErr(t("push.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="flex flex-col gap-4 max-w-[720px]">
      <h2 className="m-0 text-[15px] font-bold">{t("push.title")}</h2>
      <p className="m-0 text-[14px] text-muted leading-relaxed">{t("push.desc")}</p>
      <div className={cx("text-[14px] font-medium", state === "on" ? "text-ok" : state === "denied" ? "text-danger" : "text-ink-2")}>
        ● {t(`push.state.${state}`)}
      </div>
      {state === "ios-install" && (
        <ol className="m-0 pl-5 text-[13px] text-ink-2 leading-relaxed flex flex-col gap-1">
          <li>{t("push.ios1")}</li>
          <li>{t("push.ios2")}</li>
          <li>{t("push.ios3")}</li>
        </ol>
      )}
      {state === "denied" && <p className="m-0 text-[13px] text-ink-2">{t("push.deniedHelp")}</p>}
      <div className="flex flex-wrap gap-2">
        {state === "off" && (
          <Button variant="primary" onClick={on} disabled={busy}>
            <Icon name="bell" size={16} />
            {t("push.enable")}
          </Button>
        )}
        {state === "on" && (
          <>
            <Button onClick={() => testPush()}>{t("push.test")}</Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setState(await disablePush(api));
                setBusy(false);
              }}
            >
              {t("push.disable")}
            </Button>
          </>
        )}
      </div>
      {err && <p className="m-0 text-[13px] text-danger">{err}</p>}
      <p className="m-0 text-[12px] text-faint">{t("push.perDevice")}</p>
    </Card>
  );
}

/** 仪表盘顶部提示：还没开启通知时提醒一次，可关闭 */
export function PushBanner() {
  const { t, api } = useAuth();
  const [state, setState] = usePushState();
  const [hidden, setHidden] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      setHidden(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setHidden(false);
    }
  }, []);

  if (hidden || (state !== "off" && state !== "ios-install")) return null;
  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* 忽略 */
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-[18px] bg-accent-soft border border-[#F8C9C4] text-[14px]">
      <Icon name="bell" />
      <span className="flex-1 min-w-[200px]">{state === "ios-install" ? t("push.bannerIos") : t("push.banner")}</span>
      {state === "off" && (
        <Button
          size="sm"
          variant="primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              setState(await enablePush(api));
            } catch {
              /* 设置页会显示错误 */
            }
            setBusy(false);
          }}
        >
          {t("push.enable")}
        </Button>
      )}
      <Button size="sm" variant="ghost" onClick={dismiss}>
        {t("common.close")}
      </Button>
    </div>
  );
}
