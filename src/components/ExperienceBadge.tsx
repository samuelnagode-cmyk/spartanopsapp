import { ChevronUp } from "lucide-react";

export type ExperienceLevel = "slabo" | "dobro" | "zelo_dobro";

export const EXPERIENCE_LEVELS: {
  value: ExperienceLevel;
  labelSl: string;
  labelEn: string;
  arrows: 1 | 2 | 3;
}[] = [
  { value: "slabo", labelSl: "Začetnik", labelEn: "Recruit", arrows: 1 },
  { value: "dobro", labelSl: "Izkušen", labelEn: "Veteran", arrows: 2 },
  { value: "zelo_dobro", labelSl: "Profesionalec", labelEn: "Operator", arrows: 3 },
];

export function experienceLabel(level: ExperienceLevel, en = false) {
  const found = EXPERIENCE_LEVELS.find((l) => l.value === level) ?? EXPERIENCE_LEVELS[1];
  return en ? found.labelEn : found.labelSl;
}

export function ExperienceBadge({
  level,
  size = 14,
  color,
}: {
  level: ExperienceLevel;
  size?: number;
  color?: string;
}) {
  const found = EXPERIENCE_LEVELS.find((l) => l.value === level) ?? EXPERIENCE_LEVELS[1];
  const arrows = found.arrows;
  const stroke = color ?? "currentColor";
  return (
    <span
      aria-label={`${found.labelSl} / ${found.labelEn}`}
      title={`${found.labelSl} / ${found.labelEn}`}
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        lineHeight: 0.55,
        color: stroke,
      }}
    >
      {Array.from({ length: arrows }).map((_, i) => (
        <ChevronUp
          key={i}
          size={size}
          strokeWidth={2.8}
          style={{ marginTop: i === 0 ? 0 : -Math.round(size * 0.45) }}
        />
      ))}
    </span>
  );
}
