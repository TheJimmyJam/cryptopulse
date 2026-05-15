"use client";
import { useEffect, useRef } from "react";
import { ScoredAsset } from "@/types/crypto";
import { AssetCard } from "./AssetCard";

interface Props {
  assets: ScoredAsset[];
  animKey: string;
}

export function KanbanBoard({ assets, animKey }: Props) {
  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!boardRef.current) return;
    const cards = boardRef.current.querySelectorAll<HTMLElement>(".kanban-card");
    if (!cards.length) return;

    import("gsap").then(({ gsap }) => {
      gsap.killTweensOf(cards);

      // Push each card off-screen to the left (relative to its own grid position)
      cards.forEach((card) => {
        const rect = card.getBoundingClientRect();
        gsap.set(card, { x: -(rect.left + rect.width + 40), opacity: 0 });
      });

      // Reveal order: 1st→pos0, 2nd→pos2, 3rd→pos4, 4th→pos1, 5th→pos3
      const revealOrder = [0, 2, 4, 1, 3];
      revealOrder.forEach((pos, i) => {
        if (cards[pos]) {
          gsap.to(cards[pos], {
            x: 0,
            opacity: 1,
            duration: 1.8,
            ease: "power1.inOut",
            delay: i * 0.75,
            clearProps: "transform,opacity",
          });
        }
      });
    });
  }, [animKey]);

  return (
    <div
      ref={boardRef}
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4"
    >
      {assets.map((asset, i) => (
        <AssetCard key={asset.id} asset={asset} rank={i + 1} />
      ))}
    </div>
  );
}
