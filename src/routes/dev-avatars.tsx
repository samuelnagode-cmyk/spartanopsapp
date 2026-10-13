import { createFileRoute } from "@tanstack/react-router";
import { AVATAR_COLORS, AVATAR_ICONS } from "@/lib/avatars";
import { PlayerAvatar } from "@/components/PlayerAvatar";
export const Route = createFileRoute("/dev-avatars")({ component: () => (
  <div style={{ background: "#0b0d09", padding: 16, paddingTop: 90 }}>
    {[40, 96].map((s) => (
      <div key={s} style={{ display: "grid", gridTemplateColumns: `repeat(20, ${s}px)`, gap: 6, marginBottom: 20 }}>
        {AVATAR_COLORS.flatMap((c) => AVATAR_ICONS.map((i) => <PlayerAvatar key={c.id + i.id} icon={i.id} color={c.id} name="x" size={s} />))}
      </div>
    ))}
  </div>
) });
