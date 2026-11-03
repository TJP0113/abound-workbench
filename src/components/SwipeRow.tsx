"use client";

import { useRef, useState, type ReactNode } from "react";
import { Icon } from "./ui";

const ACTION_W = 88;

/** 往左滑（手指或鼠标拖动）露出删除按钮 */
export function SwipeRow({
  open,
  onOpenChange,
  onDelete,
  deleteLabel,
  enabled = true,
  className,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
  deleteLabel: string;
  enabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const start = useRef<{ x: number; y: number; base: number } | null>(null);
  const dragging = useRef(false);
  const moved = useRef(false);
  const [dx, setDx] = useState<number | null>(null);

  if (!enabled) return <div className={className}>{children}</div>;

  const offset = dx ?? (open ? -ACTION_W : 0);

  return (
    <div className={`relative overflow-hidden ${className ?? ""}`}>
      <button
        type="button"
        tabIndex={open ? 0 : -1}
        aria-hidden={!open}
        onClick={onDelete}
        className="absolute inset-y-0 right-0 flex flex-col items-center justify-center gap-1 bg-[#C42B2B] text-white text-[13px] font-medium cursor-pointer"
        style={{ width: ACTION_W }}
      >
        <Icon name="trash" size={18} />
        {deleteLabel}
      </button>
      <div
        className="relative bg-card"
        style={{
          transform: `translateX(${offset}px)`,
          transition: dx === null ? "transform .2s ease" : "none",
          touchAction: "pan-y",
        }}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          start.current = { x: e.clientX, y: e.clientY, base: open ? -ACTION_W : 0 };
          dragging.current = false;
          moved.current = false;
        }}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s) return;
          const mx = e.clientX - s.x;
          const my = e.clientY - s.y;
          if (!dragging.current) {
            if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) {
              start.current = null; // 垂直滚动，不处理
              return;
            }
            if (Math.abs(mx) < 8) return;
            dragging.current = true;
            moved.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
          }
          setDx(Math.max(-ACTION_W - 24, Math.min(0, s.base + mx)));
        }}
        onPointerUp={() => {
          if (dragging.current && dx !== null) onOpenChange(dx < -ACTION_W / 2);
          start.current = null;
          dragging.current = false;
          setDx(null);
        }}
        onPointerCancel={() => {
          start.current = null;
          dragging.current = false;
          setDx(null);
        }}
        onClickCapture={(e) => {
          // 刚拖动过，或已展开时点内容 → 只收起，不打开链接
          if (moved.current) {
            e.preventDefault();
            e.stopPropagation();
            moved.current = false;
          } else if (open) {
            e.preventDefault();
            e.stopPropagation();
            onOpenChange(false);
          }
        }}
        onDragStart={(e) => e.preventDefault()}
      >
        {children}
      </div>
    </div>
  );
}
