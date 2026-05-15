"use client";
import { useEffect, useRef } from "react";
import { ScoredAsset } from "@/types/crypto";
import { AssetCard } from "./AssetCard";

interface Props {
  assets: ScoredAsset[];
  /** Pass a unique key that changes when new data loads so animation re-fires */
  animKey: string;
}

export function KanbanBoard({ assets, animKey }: Props) {
  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!boardRef.current) return;
    const cards = boardRef.current.querySelectorAll<HTMLElement>(".kanban-card");
    if (!cards.length) return;

    // Dynamically import GSAP to keep it client-only
    import("gsap").then(({ gsap }) => {
      // Kill any in-progress tweens on these elements first
      gsap.killTweensOf(cards);

      // Set initial state: off-screen right + invisible
      gsap.set(cards, { x: 120, opacity: 0 });

      // Staggered fade-slide in from the right
      gsap.to(cards, {
        x: 0,
        opacity: 1,
        duration: 0.55,
        ease: "power3.out",
        stagger: 0.08,
        clearProps: "transform,opacity", // clean up inline styles after animation
      });
    });
  }, [animKey]);

  return (
    <div ref={boardRef} className="space-y-3">
      {assets.map((asset, i) => (
        <AssetCard key={asset.id} asset={asset} rank={i + 1} />
      ))}
    </div>
  );
}
