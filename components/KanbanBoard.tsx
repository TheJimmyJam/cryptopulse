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
      gsap.set(cards, { x: 80, opacity: 0, scale: 0.95 });
      gsap.to(cards, {
        x: 0,
        opacity: 1,
        scale: 1,
        duration: 0.5,
        ease: "power3.out",
        stagger: 0.07,
        clearProps: "transform,opacity",
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
